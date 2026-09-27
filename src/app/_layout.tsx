import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
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

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <HydrationStoreProvider>
        <IcupBleProvider>
          <AppTabs />
        </IcupBleProvider>
      </HydrationStoreProvider>
    </ThemeProvider>
  );
}
