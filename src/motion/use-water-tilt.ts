import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { DerivedValue } from 'react-native-reanimated';
import { useDerivedValue, useSharedValue, withSpring } from 'react-native-reanimated';

import {
  isGravityAvailable,
  onGravity,
  startGravityUpdates,
  stopGravityUpdates,
} from 'icup-motion';

const SAMPLE_INTERVAL_MS = 1000 / 30;
const MAX_TILT_DEG = 32;
const SPRING = { damping: 7, stiffness: 95, mass: 0.7 };
const RESTING_GRAVITY_Y = -1;

export const useWaterTilt = (enabled: boolean): DerivedValue<number> => {
  const gravityX = useSharedValue(0);
  const gravityY = useSharedValue(RESTING_GRAVITY_Y);

  const tiltDeg = useDerivedValue(() => {
    const radians = Math.atan2(gravityX.value, -gravityY.value);
    const degrees = (-radians * 180) / Math.PI;
    return Math.min(Math.max(degrees, -MAX_TILT_DEG), MAX_TILT_DEG);
  });

  useEffect(() => {
    if (!enabled || Platform.OS !== 'ios' || !isGravityAvailable()) {
      return;
    }

    startGravityUpdates(SAMPLE_INTERVAL_MS);
    const subscription = onGravity(({ x, y }) => {
      gravityX.value = withSpring(x, SPRING);
      gravityY.value = withSpring(y, SPRING);
    });

    return () => {
      subscription?.remove();
      stopGravityUpdates();
      gravityX.value = withSpring(0, SPRING);
      gravityY.value = withSpring(RESTING_GRAVITY_Y, SPRING);
    };
  }, [enabled, gravityX, gravityY]);

  return tiltDeg;
};
