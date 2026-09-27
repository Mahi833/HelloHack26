import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { DerivedValue, SharedValue } from 'react-native-reanimated';
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

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

const WALL = 1;
const DRIVE = 45;
const RESTORE = 30;
const DRAG = 2.6;
const RESTITUTION = 0.55;
const MAX_STEP_SECONDS = 1 / 30;

export type WaterMotion = {
  tiltDeg: DerivedValue<number>;
  slosh: SharedValue<number>;
};

export const useWaterTilt = (enabled: boolean): WaterMotion => {
  const gravityX = useSharedValue(0);
  const gravityY = useSharedValue(RESTING_GRAVITY_Y);
  const driveX = useSharedValue(0);
  const surge = useSharedValue(0);
  const surgeVelocity = useSharedValue(0);

  const tiltDeg = useDerivedValue(() => {
    const radians = Math.atan2(gravityX.value, -gravityY.value);
    const degrees = (-radians * 180) / Math.PI;
    return Math.min(Math.max(degrees, -MAX_TILT_DEG), MAX_TILT_DEG);
  });

  const frame = useFrameCallback(({ timeSincePreviousFrame }) => {
    const dt = Math.min((timeSincePreviousFrame ?? 16) / 1000, MAX_STEP_SECONDS);
    const accel = driveX.value * DRIVE - surge.value * RESTORE - surgeVelocity.value * DRAG;
    let velocity = surgeVelocity.value + accel * dt;
    let position = surge.value + velocity * dt;

    if (position > WALL) {
      position = WALL;
      velocity = -Math.abs(velocity) * RESTITUTION;
    } else if (position < -WALL) {
      position = -WALL;
      velocity = Math.abs(velocity) * RESTITUTION;
    }

    surgeVelocity.value = velocity;
    surge.value = position;
  }, false);

  useEffect(() => {
    const running = enabled && Platform.OS === 'ios' && isGravityAvailable();
    frame.setActive(running);
    if (!running) {
      return;
    }

    startGravityUpdates(SAMPLE_INTERVAL_MS);
    const subscription = onGravity(({ x, y }) => {
      driveX.value = x;
      gravityX.value = withSpring(x, TILT_SPRING);
      gravityY.value = withSpring(y, TILT_SPRING);
    });

    return () => {
      subscription?.remove();
      stopGravityUpdates();
      frame.setActive(false);
      driveX.value = 0;
      surge.value = 0;
      surgeVelocity.value = 0;
      gravityX.value = withSpring(0, TILT_SPRING);
      gravityY.value = withSpring(RESTING_GRAVITY_Y, TILT_SPRING);
    };
  }, [enabled, frame, driveX, surge, surgeVelocity, gravityX, gravityY]);

  return { tiltDeg, slosh: surge };
};
