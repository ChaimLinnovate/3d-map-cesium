// hooks/useDeviceSelection.ts
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/entities/app';
import { useMapStore } from '@/entities/map';
import { useControlMap } from '@/features/map';
import { MapEventTypesEnum } from '@/shared/lib/mapEventTypesEnum';
import { ApplicationSideMenuTabsEnum } from '@/shared/lib/applicationSideMenuTabsEnum';

export const useDeviceSelection = (sourceUid: string, objectUid: string) => {
  const setSideMenuTab = useAppStore((state) => state.setSideMenuTab);
  const selectedMapObject = useMapStore(
    useShallow((state) => state.selectedMapObject),
  );
  const { selectMapObject } = useControlMap();

  const isDeviceSelected =
    selectedMapObject?.type === MapEventTypesEnum.DEVICE &&
    selectedMapObject?.sourceUid === sourceUid;

  const handleSelectMapObject = () => {
    if (
      selectedMapObject?.type === MapEventTypesEnum.DEVICE &&
      objectUid === selectedMapObject?.objectUid
    ) {
      selectMapObject(null);
      return;
    }

    const selection = {
      type: MapEventTypesEnum.DEVICE,
      id: objectUid,
    };

    setSideMenuTab(ApplicationSideMenuTabsEnum.DEVICES);
    selectMapObject(selection);
  };

  return { isDeviceSelected, handleSelectMapObject };
};
