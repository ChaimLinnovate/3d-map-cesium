// components/DeviceFov.tsx
import { memo, type FC } from 'react';
import { Cartesian3, Color, ColorMaterialProperty } from '@cesium/engine';
import { Entity, PolygonGraphics, PolylineGraphics } from 'resium';
import {
  FOV_ALPHA_DEFAULT,
  FOV_ALPHA_SELECTED,
  SELECTED_LINE_WIDTH,
} from './constants/mapDevice';

interface DeviceFovProps {
  fov: number[][] | false;
  isDeviceSelected: boolean;
}

export const DeviceFov: FC<DeviceFovProps> = memo(
  ({ fov, isDeviceSelected }) => {
    if (!fov || fov.length <= 1) return null;

    return (
      <Entity>
        <PolygonGraphics
          hierarchy={Cartesian3.fromDegreesArray(
            fov.flatMap((p) => [p[1], p[0]]),
          )}
          material={
            new ColorMaterialProperty(
              Color.fromCssColorString('#3cdeff').withAlpha(
                isDeviceSelected ? FOV_ALPHA_SELECTED : FOV_ALPHA_DEFAULT,
              ),
            )
          }
        />
        <PolylineGraphics
          clampToGround
          positions={Cartesian3.fromDegreesArray(
            [...fov, fov[0]].flatMap((p) => [p[1], p[0]]),
          )}
          width={isDeviceSelected ? SELECTED_LINE_WIDTH : 0}
          material={Color.fromCssColorString('#3cdeff')}
        />
      </Entity>
    );
  },
);
