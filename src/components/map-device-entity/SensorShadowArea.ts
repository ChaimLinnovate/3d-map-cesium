import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useCesium } from 'resium';
import { Color, Cartographic, EllipsoidGeodesic } from '@cesium/engine';
import { SensorShadow } from './SensorShadowLogic';
import { FOV_ALPHA_SELECTED } from './constants/mapDevice';

const SHADER_URL = '/shaders/SensorShadow.fragment.shader.glsl';
const DEFAULT_RANGE = 1000;
const MAX_CAMERA_DISTANCE = 2000; // meters

interface Point {
  lat: number;
  lon: number;
  hae: number;
}


interface CurrentViewSensorInfo {
  hfov: number;
  vfov: number;
  range?: number;
  azimuth: number;
  elevation: number;
}

interface SensorShadowAreaProps {
  point: Point;
  currentViewSensorInfo: CurrentViewSensorInfo;
  isDeviceSelected: boolean;
}

export const SensorShadowArea = ({
  point,
  currentViewSensorInfo,
  isDeviceSelected,
}: SensorShadowAreaProps) => {
  const { viewer } = useCesium();
  const sensorShadowRef = useRef<SensorShadow | null>(null);
  const [fsShader, setFsShader] = useState<string | null>(null);
  const [shaderError, setShaderError] = useState<string | null>(null);

  /** memoized currentViewSensorInfo to prevent unnecessary recalculations */
  const memoizedCurrentViewSensorInfo = useMemo(() => {
    if (!currentViewSensorInfo) return null;
    
    return {
      hfov: currentViewSensorInfo.hfov,
      vfov: currentViewSensorInfo.vfov,
      range: currentViewSensorInfo.range,
      azimuth: currentViewSensorInfo.azimuth,
      elevation: -currentViewSensorInfo.elevation,
    };
  }, [
    currentViewSensorInfo?.hfov,
    currentViewSensorInfo?.vfov,
    currentViewSensorInfo?.range,
    currentViewSensorInfo?.azimuth,
    currentViewSensorInfo?.elevation,
  ]);

  /** camera position is stable unless `point` actually changes */
  const cameraPosition = useMemo<Point>(
    () => ({ lon: point.lon, lat: point.lat, hae: point.hae ?? 0 }),
    [point.lon, point.lat, point.hae],
  );

  /** sensor parameters bundled into a single memoised object */
  const sensorConfig = useMemo(() => {
    if (!memoizedCurrentViewSensorInfo) return null;

    return {
      cameraPosition,
      viewAreaColor:
        Color.fromCssColorString('#7FFF00').withAlpha(FOV_ALPHA_SELECTED),
      shadowAreaColor: Color.RED.withAlpha(FOV_ALPHA_SELECTED),
      alpha: 0.3,
      shadowAlpha: 0.0,
      depthBias: 0.0001,
      sensorParameters: {
        hfov: memoizedCurrentViewSensorInfo.hfov,
        vfov: memoizedCurrentViewSensorInfo.vfov,
        range: memoizedCurrentViewSensorInfo.range ?? DEFAULT_RANGE,
        azimuth: memoizedCurrentViewSensorInfo.azimuth,
        elevation: memoizedCurrentViewSensorInfo.elevation, // Fixed: removed double negation
      },
    };
  }, [cameraPosition, memoizedCurrentViewSensorInfo]);

  /** destroy helper */
  const cleanupSensorShadow = useCallback(() => {
    if (sensorShadowRef.current) {
      try {
        sensorShadowRef.current.destroy();
      } catch (err) {
        console.error('Error destroying sensor shadow:', err);
      } finally {
        sensorShadowRef.current = null;
      }
    }
  }, []);

  /** fetch shader once */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(SHADER_URL);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const txt = await res.text();
        if (cancelled) return;

        // strip `export default` wrapper if present
        setFsShader(txt.replace(/^export default `/, '').replace(/`;?$/, ''));
        setShaderError(null);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error('Failed to fetch shader:', msg);
          setShaderError(`Failed to load shader: ${msg}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** create / destroy sensor shadow when inputs change */
  useEffect(() => {
    if (!isDeviceSelected) {
      cleanupSensorShadow();
      return;
    }

    if (!(viewer && fsShader && sensorConfig && !shaderError)) {
      cleanupSensorShadow();
      return;
    }

    // Compute distance between camera and sensor point
    const cameraCarto = viewer.camera.positionCartographic;
    const sensorCarto = Cartographic.fromDegrees(
      point.lon,
      point.lat,
      point.hae || 0,
    );

    const geodesic = new EllipsoidGeodesic(cameraCarto, sensorCarto);
    const surfaceDistance = geodesic.surfaceDistance;
    const heightDifference = cameraCarto.height - sensorCarto.height;
    const distance = Math.sqrt(surfaceDistance ** 2 + heightDifference ** 2);

    if (distance > MAX_CAMERA_DISTANCE) {
      cleanupSensorShadow();
      return;
    }

    try {
      cleanupSensorShadow();
      sensorShadowRef.current = new SensorShadow(
        viewer,
        sensorConfig,
        fsShader,
      );
    } catch (err) {
      console.error('Failed to create SensorShadow:', err);
      cleanupSensorShadow();
    }

    return cleanupSensorShadow;
  }, [
    viewer,
    fsShader,
    sensorConfig,
    shaderError,
    isDeviceSelected,
    point.lon,
    point.lat,
    point.hae,
    cleanupSensorShadow,
  ]);

  /** tidy up on unmount */
  useEffect(() => cleanupSensorShadow, [cleanupSensorShadow]);

  return null; // nothing to render, side‑effects only
};