
export interface SensorView {
  azimuth: number;
  elevation: number;
  hfov: number;
  range: number | null;
  vfov: number;
}

export interface Point {
  lat: number;
  lon: number;
  ce?: number | null;
  hae?: number | null;
  le?: number | null;
}

import {
  Viewer,
  Property,
  PostProcessStageComposite,
  Quaternion,
  Scene,
  ShadowMap,
  PerspectiveFrustum,
  Camera,
  Color,
  defaultValue,
  ConstantPositionProperty,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  EllipsoidTerrainProvider,
  PostProcessStage,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  Transforms,
} from 'cesium';

type FrameState = {
  shadowMaps: InternalShadowMap[];
};

declare module 'cesium' {
  interface Scene {
    context: WebGLContext;
  }
}

interface WebGLContext {
  canvas: HTMLCanvasElement;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
}
interface SensorShadowOptions {
  cameraPosition: Point;
  viewAreaColor?: Color;
  shadowAreaColor?: Color;
  alpha?: number;
  shadowAlpha: number;
  size?: number;
  frustum?: boolean;
  depthBias?: number;
  sensorParameters?: SensorView;
}

interface InternalShadowMap {
  _lightCamera: Camera;
  _shadowMapTexture: () => unknown;
  _shadowMapMatrix: Matrix4;
  _lightPositionEC: Cartesian3;
  _lightDirectionEC: Cartesian3;
  _cascadeSplits: number[];
  _cascadeMatrices: Matrix4[];
  _cascadeDistances: number[];
  _isPointLight: boolean;
  _pointBias: {
    normalShadingSmooth: number;
    normalOffsetScale: number;
  };
  _primitiveBias: {
    normalShadingSmooth: number;
    normalOffsetScale: number;
  };
  _textureSize: Cartesian2;
  _distance: number;
  maximumDistance: number;
  normalOffset: boolean;
  _terrainBias: {
    depthBias: number;
  };
  _darkness: number;
}

// Constants
const DEFAULT_SHADOW_MAP_SIZE = 2048;
const DEFAULT_DEPTH_BIAS = 2e-12;
const DEFAULT_VIEW_AREA_COLOR = new Color(0, 1, 0, 0.5);
const DEFAULT_SHADOW_AREA_COLOR = new Color(1, 0, 0, 0.5);
const DEFAULT_ALPHA = 0.5;
const DEFAULT_NEAR_PLANE = 5;
const DEFAULT_VISUALIZATION_RANGE = 2000; // Default range when sensor range is null

const DEFAULT_SENSOR_PARAMETERS: SensorView = {
  azimuth: 0,
  elevation: 0,
  hfov: 66,
  range: 1000,
  vfov: 40,
};

export class SensorShadow {
  viewer: Viewer;
  private _fsShader: string;
  private _cameraPosition!: Property;
  private _viewAreaColor!: Color;
  private _shadowAreaColor!: Color;
  private _alpha!: number;
  private _shadowAlpha!: number;
  private _size!: number;
  private _depthBias!: number;
  private _sensorParameters!: SensorView;
  private _calculatedViewPosition: Cartesian3;
  private preUpdateListener: (() => void) | null = null;
  public viewShadowMap?: InternalShadowMap;
  private _isDestroyed: boolean;
  public postProcess?: PostProcessStage | PostProcessStageComposite;

  constructor(viewer: Viewer, options: SensorShadowOptions, fsShader: string) {
    this.viewer = viewer;
    this._fsShader = fsShader;
    this._isDestroyed = false;

    // Initialize properties
    this._initializeProperties(options);
    this._calculatedViewPosition = new Cartesian3();

    // Initial setup
    this._addToScene();
  }

  private _initializeProperties(options: SensorShadowOptions): void {
    // Convert cameraPosition input to Cartesian3 if needed
    if (this._isCameraInputPosition(options.cameraPosition)) {
      this._cameraPosition = new ConstantPositionProperty(
        Cartesian3.fromDegrees(
          options.cameraPosition.lon,
          options.cameraPosition.lat,
          options.cameraPosition.hae ?? 0,
        ),
      );
    } else {
      this._cameraPosition = new ConstantPositionProperty(
        options.cameraPosition,
      );
    }

    this._viewAreaColor = defaultValue(
      options.viewAreaColor,
      DEFAULT_VIEW_AREA_COLOR,
    );
    this._shadowAreaColor = defaultValue(
      options.shadowAreaColor,
      DEFAULT_SHADOW_AREA_COLOR,
    );
    this._alpha = defaultValue(options.alpha, DEFAULT_ALPHA);
    this._shadowAlpha = defaultValue(options.shadowAlpha, DEFAULT_ALPHA);
    this._size = defaultValue(options.size, DEFAULT_SHADOW_MAP_SIZE);
    this._depthBias = defaultValue(options.depthBias, DEFAULT_DEPTH_BIAS);
    this._sensorParameters = {
      ...DEFAULT_SENSOR_PARAMETERS,
      ...options.sensorParameters,
    };
  }

  private _isCameraInputPosition(
    position: Point | Cartesian3 | Property | undefined,
  ): position is Point {
    return (position as Point)?.hae !== undefined;
  }

  /**
   * Calculate camera orientation vectors based on azimuth and elevation
   * Fixed azimuth calculation: 0° = North, clockwise positive
   */
  private _calculateCameraVectors(
    position: Cartesian3,
    azimuthDeg: number,
    elevationDeg: number,
  ): {
    direction: Cartesian3;
    up: Cartesian3;
    right: Cartesian3;
  } {
    // Convert to radians
    const azimuthRad = CesiumMath.toRadians(azimuthDeg);
    const elevationRad = CesiumMath.toRadians(elevationDeg);

    // Get ENU transformation matrix at the camera position
    const enuTransform = Transforms.eastNorthUpToFixedFrame(position);
    const enuRotation = Matrix4.getMatrix3(enuTransform, new Matrix3());

    // Start with North direction in ENU frame (0° azimuth)
    const localUp = new Cartesian3(0, 0, 1);

    // Calculate horizontal direction (azimuth rotation around Up axis)
    // Positive azimuth rotates clockwise from North (when viewed from above)
    const horizontalDirection = new Cartesian3();
    horizontalDirection.x = Math.sin(azimuthRad); // East component
    horizontalDirection.y = Math.cos(azimuthRad); // North component
    horizontalDirection.z = 0; // No vertical component yet

    // Apply elevation: rotate the horizontal direction around the perpendicular horizontal axis
    // The perpendicular axis is 90° clockwise from the horizontal direction
    const perpendicularAxis = new Cartesian3();
    perpendicularAxis.x = Math.cos(azimuthRad); // 90° clockwise rotation
    perpendicularAxis.y = -Math.sin(azimuthRad);
    perpendicularAxis.z = 0;

    // Create rotation matrix for elevation around the perpendicular axis
    const axisNormalized = Cartesian3.normalize(
      perpendicularAxis,
      new Cartesian3(),
    );
    const quat = Quaternion.fromAxisAngle(
      axisNormalized,
      elevationRad,
      new Quaternion(),
    );
    const elevationMatrix = Matrix3.fromQuaternion(quat, new Matrix3());

    // Apply elevation rotation to get final local direction
    const localDirection = Matrix3.multiplyByVector(
      elevationMatrix,
      horizontalDirection,
      new Cartesian3(),
    );

    // Calculate local up vector after elevation rotation
    const localUpRotated = Matrix3.multiplyByVector(
      elevationMatrix,
      localUp,
      new Cartesian3(),
    );

    // Transform vectors from ENU to ECEF
    const direction = Matrix3.multiplyByVector(
      enuRotation,
      localDirection,
      new Cartesian3(),
    );
    const up = Matrix3.multiplyByVector(
      enuRotation,
      localUpRotated,
      new Cartesian3(),
    );

    // Calculate right vector (direction × up)
    const right = Cartesian3.cross(direction, up, new Cartesian3());

    // Normalize all vectors
    Cartesian3.normalize(direction, direction);
    Cartesian3.normalize(up, up);
    Cartesian3.normalize(right, right);

    // Ensure orthogonality (recalculate up = right × direction)
    Cartesian3.cross(right, direction, up);
    Cartesian3.normalize(up, up);

    return { direction, up, right };
  }

  private _getEffectiveRange(): number {
    return this._sensorParameters.range !== null
      ? this._sensorParameters.range
      : DEFAULT_VISUALIZATION_RANGE;
  }

  private _createShadowMap(updateOnly = false): void {
    const currentTime = this.viewer.clock.currentTime;
    const positionVector = this._cameraPosition.getValue(
      currentTime,
    ) as Cartesian3;

    if (!positionVector) {
      console.warn('Camera position is not available');
      return;
    }

    // Calculate camera orientation vectors with fixed azimuth calculation
    const { direction, up, right } = this._calculateCameraVectors(
      positionVector,
      this._sensorParameters.azimuth,
      this._sensorParameters.elevation ?? 0,
    );

    // Calculate view position based on sensor range
    const effectiveRange = this._getEffectiveRange();
    Cartesian3.add(
      positionVector,
      Cartesian3.multiplyByScalar(direction, effectiveRange, new Cartesian3()),
      this._calculatedViewPosition,
    );

    // Setup camera
    const scene: Scene = this.viewer.scene;
    const camera = new Camera(scene);
    camera.position = positionVector;
    camera.direction = direction;
    camera.up = up;
    camera.right = right;

    // Calculate aspect ratio and frustum
    const { aspectRatio, frustum } = this._createFrustum(effectiveRange);
    camera.frustum = frustum;

    if (!updateOnly) {
      this._createNewShadowMap(scene, camera, effectiveRange);
    } else if (this.viewShadowMap) {
      this._updateExistingShadowMap(camera, aspectRatio, effectiveRange);
    }

    // Configure shadow map properties
    if (this.viewShadowMap) {
      this.viewShadowMap.normalOffset = true;
      this.viewShadowMap._terrainBias.depthBias = 0.0;
    }
  }

  private _createFrustum(effectiveRange: number): {
    aspectRatio: number;
    frustum: PerspectiveFrustum;
  } {
    const hfovRad = CesiumMath.toRadians(this._sensorParameters.hfov / 2);
    const vfovRad = CesiumMath.toRadians(this._sensorParameters.vfov / 2);
    const aspectRatio = Math.tan(hfovRad) / Math.tan(vfovRad);

    const frustum = new PerspectiveFrustum({
      fov: CesiumMath.toRadians(this._sensorParameters.vfov),
      aspectRatio: aspectRatio,
      near: DEFAULT_NEAR_PLANE,
      far: effectiveRange,
    });

    return { aspectRatio, frustum };
  }

  private _createNewShadowMap(
    scene: Scene,
    camera: Camera,
    effectiveRange: number,
  ): void {
    try {
      // @ts-expect-error: ShadowMap constructor is internal
      this.viewShadowMap = new ShadowMap({
        lightCamera: camera,
        enable: true,
        isPointLight: false,
        isSpotLight: true,
        cascadesEnabled: false,
        context: scene['context'],
        size: this._size,
        pointLightRadius: effectiveRange,
        fromLightSource: false,
        maximumDistance: effectiveRange,
      });
    } catch (error) {
      console.error('Failed to create shadow map:', error);
    }
  }

  private _updateExistingShadowMap(
    camera: Camera,
    aspectRatio: number,
    effectiveRange: number,
  ): void {
    const lightCamera = this.viewShadowMap!._lightCamera;
    lightCamera.position = camera.position;
    lightCamera.direction = camera.direction;
    lightCamera.up = camera.up;
    lightCamera.right = camera.right;

    if (lightCamera.frustum instanceof PerspectiveFrustum) {
      lightCamera.frustum.fov = CesiumMath.toRadians(
        this._sensorParameters.vfov,
      );
      lightCamera.frustum.aspectRatio = aspectRatio;
      lightCamera.frustum.far = effectiveRange;
    }

    this.viewShadowMap!.maximumDistance = effectiveRange;
  }

  private _addPostProcess(): void {
    if (!this.viewShadowMap) {
      console.error(
        'ViewShadowMap not initialized. Cannot add post-process stage.',
      );
      return;
    }

    try {
      this.postProcess = this.viewer.scene.postProcessStages.add(
        new PostProcessStage({
          fragmentShader: this._fsShader,
          uniforms: this._createUniforms(),
        }),
      );

      this._setupPreUpdateListener();
    } catch (error) {
      console.error('Failed to create post process stage:', error);
    }
  }

  private _createUniforms(): Record<string, () => unknown> {
    const viewShadowMap = this.viewShadowMap!;
    const primitiveBias = viewShadowMap._isPointLight
      ? viewShadowMap._pointBias
      : viewShadowMap._primitiveBias;

    return {
      view_distance: () => this.distance,
      viewArea_color: () => this._viewAreaColor,
      shadowArea_color: () => this._shadowAreaColor,
      percentShade: () => this._alpha,
      shadowAlpha: () => this._shadowAlpha,
      shadowMap: () => viewShadowMap._shadowMapTexture,
      _shadowMap_cascadeSplits: () => viewShadowMap._cascadeSplits,
      _shadowMap_cascadeMatrices: () => viewShadowMap._cascadeMatrices,
      _shadowMap_cascadeDistances: () => viewShadowMap._cascadeDistances,
      shadowMap_matrix: () => viewShadowMap._shadowMapMatrix,
      shadowMap_camera_positionEC: () => viewShadowMap._lightPositionEC,
      shadowMap_camera_directionEC: () => viewShadowMap._lightDirectionEC,
      cameraPosition_WC: () => this.viewer.camera.positionWC,
      viewPosition_WC: () => this._calculatedViewPosition,
      shadowMap_camera_up: () => viewShadowMap._lightCamera.up,
      shadowMap_camera_dir: () => viewShadowMap._lightCamera.direction,
      shadowMap_camera_right: () => viewShadowMap._lightCamera.right,
      ellipsoidInverseRadii: () => {
        const radii = this.viewer.scene.globe.ellipsoid.radii;
        return new Cartesian3(1 / radii.x, 1 / radii.y, 1 / radii.z);
      },
      shadowMap_texelSizeDepthBiasAndNormalShadingSmooth: () => {
        const texSize = viewShadowMap._textureSize;
        if (!texSize || !primitiveBias) {
          return new Cartesian4(0, 0, this._depthBias, 0);
        }
        const texelSize = new Cartesian2(1 / texSize.x, 1 / texSize.y);
        return Cartesian4.fromElements(
          texelSize.x,
          texelSize.y,
          this._depthBias,
          primitiveBias.normalShadingSmooth,
        );
      },
      shadowMap_normalOffsetScaleDistanceMaxDistanceAndDarkness: () => {
        if (!primitiveBias) {
          return new Cartesian4(
            0,
            viewShadowMap._distance,
            viewShadowMap.maximumDistance,
            viewShadowMap._darkness,
          );
        }
        return Cartesian4.fromElements(
          primitiveBias.normalOffsetScale,
          viewShadowMap._distance,
          viewShadowMap.maximumDistance,
          viewShadowMap._darkness,
        );
      },
      exclude_terrain: () =>
        this.viewer.terrainProvider instanceof EllipsoidTerrainProvider,
    };
  }

  private _setupPreUpdateListener(): void {
    if (this.preUpdateListener) {
      this.viewer.scene.preUpdate.removeEventListener(this.preUpdateListener);
    }

    this.preUpdateListener = () => {
      if (this.postProcess && this.viewShadowMap) {
        this.postProcess.enabled = !!this.viewShadowMap._shadowMapTexture;
      }
    };

    this.viewer.scene.preUpdate.addEventListener(this.preUpdateListener);
  }

  private _addToScene(): void {
    this._createShadowMap();
    this._addPostProcess();
    this.viewer.scene.primitives.add(this);
  }

  // Public methods
  destroy(): void {
    if (this.preUpdateListener) {
      this.viewer.scene.preUpdate.removeEventListener(this.preUpdateListener);
      this.preUpdateListener = null;
    }

    if (this.postProcess) {
      this.viewer.scene.postProcessStages.remove(this.postProcess);
      this.postProcess = undefined;
    }

    this.viewer.scene.primitives.remove(this);
    this._isDestroyed = true;
  }

  isDestroyed(): boolean {
    return this._isDestroyed;
  }

  update(frameState: FrameState): void {
    if (!this._isDestroyed) {
      this._createShadowMap(true);
      frameState.shadowMaps.push(this.viewShadowMap!);
    }
  }

  get distance(): number {
    return this._getEffectiveRange();
  }
}
