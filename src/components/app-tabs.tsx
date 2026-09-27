import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Palette } from '@/constants/design';

export default function AppTabs() {
  return (
    <NativeTabs
      blurEffect="systemThinMaterialLight"
      tintColor={Palette.accent}
      iconColor={Palette.inkMuted}
      labelStyle={{ color: Palette.inkMuted, selected: { color: Palette.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
          md={{ default: 'bar_chart', selected: 'bar_chart' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
