import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const subscribeToNothing = () => () => {};
const hydrated = () => true;
const notHydrated = () => false;

export function useColorScheme() {
  const hasHydrated = useSyncExternalStore(subscribeToNothing, hydrated, notHydrated);
  const colorScheme = useRNColorScheme();

  return hasHydrated ? colorScheme : 'light';
}
