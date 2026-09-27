import { DefaultTheme, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';

import AppTabs from '@/components/app-tabs';
import { Palette } from '@/constants/design';
import { IcupBleProvider } from '@/contexts/icup-ble-context';
import { HydrationStoreProvider } from '@/store/hydration-store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const icupTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Palette.canvas,
    card: Palette.canvas,
    text: Palette.ink,
    primary: Palette.accent,
    border: Palette.border,
  },
};

export default function TabLayout() {
  return (
    <ThemeProvider value={icupTheme}>
      <HydrationStoreProvider>
        <IcupBleProvider>
          <AppTabs />
        </IcupBleProvider>
      </HydrationStoreProvider>
    </ThemeProvider>
  );
}
