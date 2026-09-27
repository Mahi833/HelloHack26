import type { EventSubscription } from 'react-native';

import NativeIcupMotion from './NativeIcupMotion';
import type { GravitySample } from './NativeIcupMotion';

export type { GravitySample };

export const isGravityAvailable = (): boolean =>
  NativeIcupMotion !== null && NativeIcupMotion.isAvailable();

export const startGravityUpdates = (intervalMs: number): void => {
  NativeIcupMotion?.start(intervalMs);
};

export const stopGravityUpdates = (): void => {
  NativeIcupMotion?.stop();
};

export const onGravity = (
  handler: (sample: GravitySample) => void,
): EventSubscription | null => NativeIcupMotion?.onGravity(handler) ?? null;
