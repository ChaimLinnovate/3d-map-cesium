// constants/mapDevice.ts
export const DEFAULT_ALERT_DELAY = 25000; // Milliseconds
export const SELECTED_LINE_WIDTH = 2.0;
export const DEFAULT_LINE_WIDTH = 1.0;
export const FOV_ALPHA_SELECTED = 0.25;
export const FOV_ALPHA_DEFAULT = 0.2;
export const DEVICE_NAME_OFFSET_Y = -30;

// types/mapDevice.ts
import type { Device, MapDeviceEvent } from '@/shared/types';

export interface IMapDeviceMarkerProps extends MapDeviceEvent {
  device: Device | undefined;
}
