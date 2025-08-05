import { type FC, useEffect, useMemo, useState } from 'react';

import { Entity, ModelGraphics, useCesium } from 'resium';
import { Cartographic } from 'cesium';
import { SensorShadowArea } from './SensorShadowArea';
import { Color } from 'cesium';
import { Cartesian3 } from 'cesium';
import { HeadingPitchRange } from 'cesium';
import { FrustumVisualizer } from './FrustumVisualizer';

interface Point {
  lat: number;
  lon: number;
  hae: number;
}

const MODEL_CONFIG = {
  uri: '/models/drone_yellow.glb',
  minimumPixelSize: 30,
  maximumScale: 20,
  colorBlendAmount: 0.5,
  silhouetteAlpha: 0.3,
} as const;

export const MapDeviceEntity = ({ point: initialPoint }: { point: Point }) => {

  const [point, setPoint] = useState(initialPoint);

  const currentViewSensorInfo = {
    hfov: 60,
    vfov: 40,
    range: point.hae + 100,
    azimuth: 0,
    elevation: -45,
  }

  const { viewer } = useCesium();

  const getRandomDelta = (maxDelta = 0.005) => (Math.random() - 0.5) * 2 * maxDelta;

  const movePointRandomly = () => {
    setPoint((prevPoint) => {
      const random = Math.random();

      let newLat = prevPoint.lat;
      let newLon = prevPoint.lon;
      let newHae = prevPoint.hae;

      if (random < 0.5) {
        newLat += getRandomDelta();
      }
      if (random < 0.8) {
        newLon += getRandomDelta();
      }
      if (random < 0.9) {
        newHae += getRandomDelta();
      }

      return {
        ...prevPoint,
        lat: newLat,
        lon: newLon,
        hae: newHae,
      };
    });
  };
  // ---
  // Flight Experience: Update the camera to follow the drone

  // ---

  useEffect(() => {
    const intervalId = setInterval(movePointRandomly, 1000);
    // Cleanup function to clear the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array ensures this effect runs only once

  // Memoize sanitizedPoint to ensure referential stability
  const memoizedSanitizedPoint = useMemo(() => {
    const cartographic = Cartographic.fromDegrees(point.lon, point.lat, 0);
    const heightGlobe = viewer
      ? viewer.scene.globe.getHeight(cartographic)
      : 0;

    return {
      ...point,
      hae: point.hae ? point.hae + (heightGlobe ?? 0) : 0,
    };
  }, [point, viewer]);

  return (
    <>
      <Entity
        name="My Marker"
        position={Cartesian3.fromDegrees(point.lon, point.lat, point.hae)}
        point={{ pixelSize: 15, color: Color.RED }}
      >
        <ModelGraphics
          uri={MODEL_CONFIG.uri}
          scale={1.0}
          minimumPixelSize={64}
          maximumScale={20000}
          colorBlendAmount={0.5}
          silhouetteColor={Color.YELLOWGREEN}
          silhouetteSize={2.0}
        />

        <SensorShadowArea
          point={point}
          currentViewSensorInfo={currentViewSensorInfo}
          isDeviceSelected={true}
        />
        <FrustumVisualizer
          point={point}
          azimuth={currentViewSensorInfo?.azimuth ?? 0}
          elevation={currentViewSensorInfo?.elevation ?? 0}
          hfov={currentViewSensorInfo?.hfov ?? 0}
          vfov={currentViewSensorInfo?.vfov ?? 0}
          range={currentViewSensorInfo.range}
          isDeviceSelected={true} />
      </Entity>

    </>
  );
}