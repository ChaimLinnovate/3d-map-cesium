import { useMemo } from 'react';
import {
  Cartesian3,
  Color,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  Quaternion,
  Transforms,
  PerspectiveFrustum,
  FrustumGeometry,
  GeometryInstance,
  ColorGeometryInstanceAttribute,
  PerInstanceColorAppearance,
} from 'cesium';
import { Primitive } from 'resium';
import { Point } from './SensorShadowLogic';

/**
 * Helper validation & math utilities
 */
const isValidAngle = (angle: number) =>
  Number.isFinite(angle) && angle > 0 && angle < 180;

const isValidRange = (r: number | undefined) =>
  r !== undefined && Number.isFinite(r) && r > 0;

const VECTOR_EPSILON = CesiumMath.EPSILON10; // 1.0e-10

const safeNormalize = (v: Cartesian3): Cartesian3 | null => {
  if (Cartesian3.magnitudeSquared(v) <= VECTOR_EPSILON) {
    return null; // zero‑length vector, cannot normalise
  }
  return Cartesian3.normalize(v, new Cartesian3());
};

interface FrustumVisualizerProps {
  point: Point;
  azimuth: number;
  elevation: number;
  hfov: number;
  vfov: number;
  range?: number;
  color?: Color;
  alpha?: number;
  isDeviceSelected: boolean;
}

export const FrustumVisualizer = ({
  point,
  azimuth,
  elevation,
  hfov,
  vfov,
  range = 1000,
  color = Color.YELLOWGREEN,
  alpha = 0.1,
  isDeviceSelected,
}: FrustumVisualizerProps) => {
  const isInputValid = useMemo(() => {
    return (
      isValidAngle(hfov) &&
      isValidAngle(vfov) &&
      isValidRange(range) &&
      Number.isFinite(azimuth) &&
      Number.isFinite(elevation) &&
      Number.isFinite(point.lat) &&
      Number.isFinite(point.lon)
    );
  }, [hfov, vfov, range, azimuth, elevation, point.lat, point.lon]);

  const normalizedAzimuth = useMemo(
    () => ((azimuth % 360) + 360) % 360,
    [azimuth],
  );
  const normalizedElevation = -elevation;

  const origin = useMemo(
    () => Cartesian3.fromDegrees(point.lon, point.lat, point.hae ?? 0),
    [point.lon, point.lat, point.hae],
  );

  const enuTransform = useMemo(() => {
    const transform = Transforms.eastNorthUpToFixedFrame(origin);
    return Matrix4.getMatrix3(transform, new Matrix3());
  }, [origin]);

  const orientation = useMemo(() => {
    try {
      const azimuthRad = CesiumMath.toRadians(normalizedAzimuth + 180);
      const elevationRad = CesiumMath.toRadians(normalizedElevation);

      const localDir = new Cartesian3(
        Math.sin(azimuthRad) * Math.cos(elevationRad),
        Math.cos(azimuthRad) * Math.cos(elevationRad),
        Math.sin(elevationRad),
      );

      const unitLocalDir = safeNormalize(localDir);
      if (!unitLocalDir) throw new Error('Direction vector is zero');

      const localUp = new Cartesian3(0, 0, 1);
      const localRight = Cartesian3.cross(
        unitLocalDir,
        localUp,
        new Cartesian3(),
      );
      const unitLocalRight = safeNormalize(localRight);
      if (!unitLocalRight) throw new Error('Right vector is zero');

      const localUpCorrected = Cartesian3.cross(
        unitLocalRight,
        unitLocalDir,
        new Cartesian3(),
      );
      const unitLocalUp = safeNormalize(localUpCorrected);
      if (!unitLocalUp) throw new Error('Up vector is zero');

      const direction = Matrix3.multiplyByVector(
        enuTransform,
        unitLocalDir,
        new Cartesian3(),
      );
      const right = Matrix3.multiplyByVector(
        enuTransform,
        unitLocalRight,
        new Cartesian3(),
      );
      const up = Matrix3.multiplyByVector(
        enuTransform,
        unitLocalUp,
        new Cartesian3(),
      );

      const unitDirection = safeNormalize(direction);
      const unitRight = safeNormalize(right);
      const unitUp = safeNormalize(up);
      if (!unitDirection || !unitRight || !unitUp) {
        throw new Error('Failed to normalise transformed vectors');
      }

      const rotationMatrix = new Matrix3();
      Matrix3.setColumn(rotationMatrix, 0, unitRight, rotationMatrix);
      Matrix3.setColumn(rotationMatrix, 1, unitUp, rotationMatrix);
      Matrix3.setColumn(
        rotationMatrix,
        2,
        Cartesian3.negate(unitDirection, new Cartesian3()),
        rotationMatrix,
      );

      return Quaternion.fromRotationMatrix(rotationMatrix, new Quaternion());
    } catch (error) {
      console.error('Failed to calculate frustum orientation:', error);
      return Quaternion.IDENTITY;
    }
  }, [normalizedAzimuth, normalizedElevation, enuTransform]);

  const frustum = useMemo(() => {
    if (!isInputValid) return null;

    const hfovRad = CesiumMath.toRadians(hfov);
    const vfovRad = CesiumMath.toRadians(vfov);

    const tanVFov = Math.tan(vfovRad / 2);
    const tanHFov = Math.tan(hfovRad / 2);

    if (
      tanVFov === 0 ||
      !Number.isFinite(tanVFov) ||
      !Number.isFinite(tanHFov)
    ) {
      console.warn('FrustumVisualizer: invalid FOV tangent values');
      return null;
    }

    const aspectRatio = tanHFov / tanVFov;

    try {
      return new PerspectiveFrustum({
        fov: vfovRad,
        aspectRatio,
        near: 0.5,
        far: range,
      });
    } catch (err) {
      console.error(
        'FrustumVisualizer: failed to create PerspectiveFrustum',
        err,
      );
      return null;
    }
  }, [hfov, vfov, range, isInputValid]);

  const geometryKey = useMemo(
    () =>
      `${normalizedAzimuth}-${normalizedElevation}-${hfov}-${vfov}-${range}-${point.lat}-${point.lon}-${point.hae}-${isDeviceSelected}`,
    [
      normalizedAzimuth,
      normalizedElevation,
      hfov,
      vfov,
      range,
      point.lat,
      point.lon,
      point.hae,
      isDeviceSelected,
    ],
  );

  const { geometryInstances, appearance } = useMemo(() => {
    if (!frustum || Quaternion.equals(orientation, Quaternion.IDENTITY)) {
      return { geometryInstances: null, appearance: null } as const;
    }

    try {
      const geometry = new FrustumGeometry({
        frustum,
        origin,
        orientation,
        vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
      });

      const instance = new GeometryInstance({
        geometry,
        id: geometryKey,
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(
            color.withAlpha(alpha),
          ),
        },
      });

      const appearanceInstance = new PerInstanceColorAppearance({
        flat: true,
        translucent: alpha < 1.0,
      });

      return {
        geometryInstances: instance,
        appearance: appearanceInstance,
      } as const;
    } catch (err) {
      console.error(
        'FrustumVisualizer: failed to create frustum geometry',
        err,
      );
      return { geometryInstances: null, appearance: null } as const;
    }
  }, [frustum, origin, orientation, color, alpha, geometryKey]);

  if (!isInputValid || !geometryInstances || !appearance || !isDeviceSelected) {
    return null;
  }
  if (!isDeviceSelected) {
    return;
  }

  return (
    <Primitive
      key={geometryKey}
      geometryInstances={geometryInstances}
      appearance={appearance}
      allowPicking={false}
      asynchronous={false}
    />
  );
};

export default FrustumVisualizer;
