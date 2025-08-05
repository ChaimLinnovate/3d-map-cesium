// hooks/useDeviceAlert.ts
import { useState, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAlertStore } from '@/entities/alert';
import { getActiveAlertForDevice } from '@/entities/alert/store/useAlertStore';
import { DetectionAlertDelayByDeviceType } from '@/shared/lib/detectionAlertDelayByDeviceTypeMap';
import { DeviceTypeEnum } from '@/shared/lib/deviceTypeEnum';
import type { Device } from '@/shared/types';
import { DEFAULT_ALERT_DELAY } from '../constants/mapDevice';

export const useDeviceAlert = (
  device: Device | undefined,
  sourceUid: string,
) => {
  const [isAlertShown, setIsAlertShown] = useState(false);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAlerts = useAlertStore(useShallow((state) => state.lastAlerts));

  useEffect(() => {
    if (!device) return;

    const activeAlert = getActiveAlertForDevice(device);
    if (!activeAlert) return;

    if (alertTimerRef.current) {
      clearTimeout(alertTimerRef.current);
    }

    setIsAlertShown(true);
    alertTimerRef.current = setTimeout(
      () => {
        setIsAlertShown(false);
        if (alertTimerRef.current) {
          clearTimeout(alertTimerRef.current);
        }
      },
      DetectionAlertDelayByDeviceType.get(device?.type as DeviceTypeEnum)
        ?.showAlertDelay || DEFAULT_ALERT_DELAY,
    );
  }, [lastAlerts, sourceUid, device]);

  useEffect(
    () => () => {
      if (alertTimerRef.current) {
        clearTimeout(alertTimerRef.current);
      }
    },
    [],
  );

  return { isAlertShown };
};
