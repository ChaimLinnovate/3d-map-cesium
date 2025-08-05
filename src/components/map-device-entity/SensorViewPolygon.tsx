import { useMemo } from 'react';
import {
  Cartesian3,
  Color,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  Quaternion,
  Transforms,
  GeometryInstance,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Material,
} from 'cesium';
import { Primitive } from 'resium';

interface Point {
  lat: number;
  lon: number;
  hae?: number;
}
interface SensorFrustumProps {
  point: Point;
  azimuth: number; // degrees
  elevation: number; // degrees
  hfov: number; // degrees - horizontal FOV
  vfov: number; // degrees - vertical FOV
  range?: number;
  color?: Color;
  alpha?: number;
  isDeviceSelected?: boolean;
  outlineColor?: Color;
  outlineWidth?: number;
}

export const SensorFrustum = ({
  point,
  azimuth,
  elevation,
  hfov,
  vfov,
  range = 1200,
  isDeviceSelected = false,
  outlineColor = Color.CADETBLUE,
  outlineWidth = 2,
}: SensorFrustumProps) => {
  const normalizedAzimuth = useMemo(
    () => ((azimuth % 360) + 360) % 360,
    [azimuth],
  );
  const normalizedElevation = useMemo(() => elevation, [elevation]);

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
      const azimuthRad = CesiumMath.toRadians(normalizedAzimuth);
      const elevationRad = CesiumMath.toRadians(normalizedElevation);

      const localDirection = new Cartesian3(
        Math.sin(azimuthRad) * Math.cos(elevationRad),
        Math.cos(azimuthRad) * Math.cos(elevationRad),
        Math.sin(elevationRad),
      );

      const localUp = new Cartesian3(0, 0, 1);
      const localRight = Cartesian3.cross(
        localDirection,
        localUp,
        new Cartesian3(),
      );
      Cartesian3.normalize(localRight, localRight);

      const localUpCorrected = Cartesian3.cross(
        localRight,
        localDirection,
        new Cartesian3(),
      );
      Cartesian3.normalize(localUpCorrected, localUpCorrected);

      const direction = Matrix3.multiplyByVector(
        enuTransform,
        localDirection,
        new Cartesian3(),
      );
      const right = Matrix3.multiplyByVector(
        enuTransform,
        localRight,
        new Cartesian3(),
      );
      const up = Matrix3.multiplyByVector(
        enuTransform,
        localUpCorrected,
        new Cartesian3(),
      );

      Cartesian3.normalize(direction, direction);
      Cartesian3.normalize(right, right);
      Cartesian3.normalize(up, up);

      const rotationMatrix = new Matrix3();
      Matrix3.setColumn(rotationMatrix, 0, right, rotationMatrix);
      Matrix3.setColumn(rotationMatrix, 1, up, rotationMatrix);
      Matrix3.setColumn(
        rotationMatrix,
        2,
        Cartesian3.negate(direction, new Cartesian3()),
        rotationMatrix,
      );

      return Quaternion.fromRotationMatrix(rotationMatrix, new Quaternion());
    } catch {
      return Quaternion.IDENTITY;
    }
  }, [normalizedAzimuth, normalizedElevation, enuTransform]);

  // חישוב נקודות המתאר (outline) של ה-frustum
  const outlinePositions = useMemo(() => {
    const corners: Cartesian3[] = [];

    const hfovRad = CesiumMath.toRadians(hfov);
    const vfovRad = CesiumMath.toRadians(vfov);

    const halfHFOV = hfovRad / 3;
    const halfVFOV = vfovRad / 3;

    const relativeAngles = [
      [-halfHFOV, -halfVFOV], // Bottom-Left
      [halfHFOV, -halfVFOV], // Bottom-Right
      [halfHFOV, halfVFOV], // Top-Right
      [-halfHFOV, halfVFOV], // Top-Left
    ];

    const rotationMatrixFromOrientation = Matrix3.fromQuaternion(
      orientation,
      new Matrix3(),
    );

    for (const [relativeH, relativeV] of relativeAngles) {
      const x = Math.tan(relativeH) * range;
      const y = Math.tan(relativeV) * range;
      const z = -range;
      const localCorner = new Cartesian3(x, y, z);

      const rotatedCorner = Matrix3.multiplyByVector(
        rotationMatrixFromOrientation,
        localCorner,
        new Cartesian3(),
      );

      corners.push(Cartesian3.add(origin, rotatedCorner, new Cartesian3()));
    }

    return [
      origin,
      corners[0],
      origin,
      corners[1],
      origin,
      corners[2],
      origin,
      corners[3],
      corners[0],
      corners[1],
      corners[1],
      corners[2],
      corners[2],
      corners[3],
      corners[3],
      corners[0],
    ];
  }, [origin, orientation, hfov, vfov, range]);

  return (
    <>
      {isDeviceSelected && (
        <Primitive
          geometryInstances={
            new GeometryInstance({
              geometry: new PolylineGeometry({
                positions: outlinePositions,
                width: outlineWidth,
              }),
            })
          }
          appearance={
            new PolylineMaterialAppearance({
              material: Material.fromType('Color', {
                color: outlineColor,
              }),
            })
          }
          allowPicking={false}
          asynchronous={false}
        />
      )}
    </>
  );
};

export default SensorFrustum;
