// components/DeviceModel.tsx
import { memo, type FC } from 'react';

import {
  BillboardGraphics,
  CylinderGraphics,
  Entity,
  LabelGraphics,
  ModelGraphics,
  PolylineGraphics,
} from 'resium';
import type { Device } from '@/shared/types';

import { MapSvgIcon } from '../../utils/MapSvgIcon';
import { DeviceIcon } from '../../utils/DeviceIcon';
import { DeviceStatusEnum } from '@/shared/lib/deviceStatusEnum';
import { StatusColorMap } from '@/shared/lib/statusColorMap';
import { DEVICE_NAME_OFFSET_Y } from './constants/mapDevice';
import {
  Cartesian2,
  Cartesian3,
  Color,
  DistanceDisplayCondition,
  HeightReference,
  HorizontalOrigin,
  PolylineDashMaterialProperty,
  VerticalOrigin,
} from '@cesium/engine';
import { DeviceTypeEnum } from '@/shared/lib/deviceTypeEnum';

const SELECTED_DEVICE_WIDTH = 64;
const DEFAULT_DEVICE_WIDTH = 48;

interface DeviceModelProps {
  point: { lon: number; lat: number; hae?: number };
  device?: Device;
  onSelect: () => void;
  isDeviceSelected?: boolean;
  isInTheAir?: boolean;
  isAlertShown?: boolean;
  status?: DeviceStatusEnum;
  event?: {
    spatialOrientation?: {
      attitude?: {
        yaw?: number;
      };
    } | null;
  };
}
const MODEL_CONFIG = {
  uri: '/models/drone_yellow.glb',
  minimumPixelSize: 30,
  maximumScale: 20,
  colorBlendAmount: 0.5,
  silhouetteAlpha: 0.3,
} as const;

export const DeviceModel: FC<DeviceModelProps> = memo(
  ({
    point,
    device,
    onSelect,
    isDeviceSelected,
    isInTheAir,
    isAlertShown,
    status,
    event,
  }) => {
    // const [groundHeight, setGroundHeight] = useState<number>(0);
    // const { viewer } = useCesium();

    // Effect to get the terrain height at the device's location
    // useEffect(() => {
    //   if (!viewer || !viewer.terrainProvider) return;

    //   const cartographic = Cartographic.fromDegrees(point.lon, point.lat);
    //   sampleTerrainMostDetailed(viewer.terrainProvider, [cartographic])
    //     .then((results) => {
    //       const height = results[0]?.height ?? 0;
    //       setGroundHeight(height);
    //     })
    //     .catch((error) => {
    //       console.error('Error sampling terrain height:', error);
    //       setGroundHeight(0); // Fallback to 0 if terrain sampling fails
    //     });
    // }, [point.lon, point.lat, viewer]);

    // // Calculate altitude above ground
    // const altitude =
    //   point.hae !== undefined && groundHeight !== null
    //     ? Math.round(point.hae - groundHeight)
    //     : null;

    // // Determine the height reference for graphics based on whether the device is in the air
    const currentHeightReference = isInTheAir
      ? HeightReference.NONE
      : HeightReference.CLAMP_TO_GROUND;

    // // Calculate the entity's position. If hae is provided, use it as absolute height; otherwise, use ground height.
    // const entityPosition = Cartesian3.fromDegrees(
    //   point.lon,
    //   point.lat,
    //   point.hae ?? groundHeight,
    // );
    const isDrone =
      device?.type === DeviceTypeEnum.EAS ||
      device?.type === DeviceTypeEnum.EAT;

    return (
      <>
        <Entity
          position={Cartesian3.fromDegrees(
            point.lon,
            point.lat,
            point.hae ?? 0,
          )}
          onClick={onSelect}
          name='device'
        >
          <BillboardGraphics
            image={MapSvgIcon(
              <DeviceIcon
                device={device}
                isDeviceSelected={!!isDeviceSelected}
                yaw={event?.spatialOrientation?.attitude?.yaw}
                isInTheAir={!!isInTheAir}
                isAlertShown={!!isAlertShown}
                statusColor={
                  StatusColorMap.get(status as DeviceStatusEnum) ?? '#ffffff'
                }
              />,
            )}
            distanceDisplayCondition={
              new DistanceDisplayCondition(0.0, 3000000)
            }
            width={
              isDeviceSelected ? SELECTED_DEVICE_WIDTH : DEFAULT_DEVICE_WIDTH
            }
            height={
              isDeviceSelected ? SELECTED_DEVICE_WIDTH : DEFAULT_DEVICE_WIDTH
            }
            verticalOrigin={VerticalOrigin.CENTER}
            show={!isDeviceSelected || !isDrone} // Show billboard when not selected
            disableDepthTestDistance={Number.POSITIVE_INFINITY} // Keep for icon always on top
          />
          {isDrone && (
            <ModelGraphics
              uri={MODEL_CONFIG.uri} // Use 'uri' instead of 'modelUri' for Cesium models
              scale={1.0}
              minimumPixelSize={64}
              maximumScale={20000}
              heightReference={currentHeightReference} // Dynamic height reference
              distanceDisplayCondition={
                new DistanceDisplayCondition(0.0, 3000000)
              }
              show={isDeviceSelected}
              colorBlendAmount={0.5}
              silhouetteColor={Color.YELLOWGREEN} // Set silhouette color
              silhouetteSize={2.0} // Set silhouette size
            />
          )}

          {/* Device Name Label */}
          {device && (
            <LabelGraphics
              text={device.name}
              font='bold 14px Helvetica'
              fillColor={Color.WHITE}
              outlineColor={Color.BLACK}
              outlineWidth={2}
              backgroundColor={Color.fromCssColorString('#1c1c1e')}
              showBackground={true}
              horizontalOrigin={HorizontalOrigin.CENTER}
              verticalOrigin={VerticalOrigin.BOTTOM}
              pixelOffset={new Cartesian2(0, DEVICE_NAME_OFFSET_Y)}
              distanceDisplayCondition={new DistanceDisplayCondition(0, 10000)}
              disableDepthTestDistance={Number.POSITIVE_INFINITY}
            />
          )}

          <CylinderGraphics
            length={0.1} // Total length of the column
            topRadius={0.1} // Thin column
            bottomRadius={0.5}
            outline
            outlineColor={Color.WHITE}
            material={Color.WHITE.withAlpha(0.0)}
            heightReference={HeightReference.CLAMP_TO_GROUND} // Crucial for ground alignment
          />
          <PolylineGraphics
            positions={[
              Cartesian3.fromDegrees(point.lon, point.lat, -500),
              Cartesian3.fromDegrees(point.lon, point.lat, point.hae ?? 0),
            ]}
            width={1}
            material={
              new PolylineDashMaterialProperty({
                color: Color.WHITE,
                dashLength: 24,
                dashPattern: 255,
              })
            }
          />
        </Entity>
      </>
    );
  },
);
