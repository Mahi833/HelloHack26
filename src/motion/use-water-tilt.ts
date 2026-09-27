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
const RESTING_GRAVITY_Y = -1;

const TILT_SPRING = { damping: 7, stiffness: 95, mass: 0.7 };
const TRACKING_SPRING = { damping: 14, stiffness: 220, mass: 0.6 };
const LAGGING_SPRING = { damping: 4.5, stiffness: 42, mass: 1 };

const SLOSH_GAIN = 3.2;

export type WaterMotion = {
  tiltDeg: DerivedValue<number>;
  slosh: DerivedValue<number>;
};

export const useWaterTilt = (enabled: boolean): WaterMotion => {
  const gravityX = useSharedValue(0);
  const gravityY = useSharedValue(RESTING_GRAVITY_Y);
  const trackingX = useSharedValue(0);
  const laggingX = useSharedValue(0);

  const tiltDeg = useDerivedValue(() => {
    const radians = Math.atan2(gravityX.value, -gravityY.value);
    const degrees = (-radians * 180) / Math.PI;
    return Math.min(Math.max(degrees, -MAX_TILT_DEG), MAX_TILT_DEG);
  });

  const slosh = useDerivedValue(() => {
    const banded = (trackingX.value - laggingX.value) * SLOSH_GAIN;
    return Math.min(Math.max(banded, -1), 1);
  });

  useEffect(() => {
    if (!enabled || Platform.OS !== 'ios' || !isGravityAvailable()) {
      return;
    }

    startGravityUpdates(SAMPLE_INTERVAL_MS);
    const subscription = onGravity(({ x, y }) => {
      gravityX.value = withSpring(x, TILT_SPRING);
      gravityY.value = withSpring(y, TILT_SPRING);
      trackingX.value = withSpring(x, TRACKING_SPRING);
      laggingX.value = withSpring(x, LAGGING_SPRING);
    });

    return () => {
      subscription?.remove();
      stopGravityUpdates();
      gravityX.value = withSpring(0, TILT_SPRING);
      gravityY.value = withSpring(RESTING_GRAVITY_Y, TILT_SPRING);
      trackingX.value = withSpring(0, TRACKING_SPRING);
      laggingX.value = withSpring(0, TRACKING_SPRING);
    };
  }, [enabled, gravityX, gravityY, trackingX, laggingX]);

  return { tiltDeg, slosh };
};
