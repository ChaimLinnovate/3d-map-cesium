// components/DeviceConnectionLine.tsx
import { memo, type FC } from 'react';
import {
  Cartesian3,
  Color,
  ShadowMode,
  PolylineDashMaterialProperty,
} from '@cesium/engine';
import { Entity, PolylineGraphics } from 'resium';
import { SELECTED_LINE_WIDTH, DEFAULT_LINE_WIDTH } from './constants/mapDevice';

interface DeviceConnectionLineProps {
  fov: number[][] | false;
  fovCenter: [number, number] | undefined;
  point: { lon: number; lat: number; hae?: number };
  isDeviceSelected: boolean;
}

export const DeviceConnectionLine: FC<DeviceConnectionLineProps> = memo(
  ({ fov, fovCenter, point, isDeviceSelected }) => {
    if (!fov || fov.length <= 1 || !fovCenter) return null;

    return (
      <Entity>
        <PolylineGraphics
          shadows={ShadowMode.CAST_ONLY}
          positions={Cartesian3.fromDegreesArrayHeights([
            fovCenter[1],
            fovCenter[0],
            0,
            point.lon,
            point.lat,
            point.hae ?? 0,
          ])}
          material={
            new PolylineDashMaterialProperty({
              color: Color.fromCssColorString('#3cdeff'),
              dashLength: 16.0,
            })
          }
          width={isDeviceSelected ? SELECTED_LINE_WIDTH : DEFAULT_LINE_WIDTH}
        />
      </Entity>
    );
  },
);
