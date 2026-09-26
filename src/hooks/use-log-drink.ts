import { useCallback } from 'react';

import { writeWaterMl } from '@/health/healthkit';
import { useHydrationStore } from '@/store/hydration-store';
import type { DrinkEvent, DrinkSource } from '@/store/types';

export const useLogDrink = (): ((ml: number, source: DrinkSource) => Promise<DrinkEvent>) => {
  const { addDrink } = useHydrationStore();

  return useCallback(
    async (ml: number, source: DrinkSource) => {
      const event = await addDrink(ml, source);
      writeWaterMl(event.ml, event.at).catch(() => {});
      return event;
    },
    [addDrink],
  );
};
