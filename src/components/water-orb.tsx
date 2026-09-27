import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { WaterMotion } from '@/motion/use-water-tilt';

const ORB_SIZE = 96;
const PIVOT_WIDTH = ORB_SIZE * 3;
const BLOB_SIZE = Math.round(ORB_SIZE * 1.7);
const BLOB_LEFT = PIVOT_WIDTH / 2 - BLOB_SIZE / 2;
const BLOB_SPREAD = Math.round(ORB_SIZE * 0.28);
const REST_DOME = 7;
const CREST_RISE = 11;
const CREST_DRIFT = 8;

export type WaterOrbProps = {
  progress: number;
  motion: WaterMotion;
};

export const WaterOrb = ({ progress, motion }: WaterOrbProps) => {
  const level = Math.min(Math.max(progress, 0), 1);
  const { tiltDeg, slosh } = motion;

  const pivotStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tiltDeg.value}deg` }],
  }));

  const leadingCrestStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -slosh.value * CREST_DRIFT },
      { translateY: -slosh.value * CREST_RISE },
    ],
  }));

  const trailingCrestStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: slosh.value * CREST_DRIFT },
      { translateY: slosh.value * CREST_RISE },
    ],
  }));

  return (
    <View
      style={styles.orb}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(level * 100) }}>
      <Animated.View style={[styles.pivot, { top: ORB_SIZE * (1 - level) }, pivotStyle]}>
        <Animated.View
          style={[styles.crest, { left: BLOB_LEFT - BLOB_SPREAD }, leadingCrestStyle]}
        />
        <Animated.View
          style={[styles.crest, { left: BLOB_LEFT + BLOB_SPREAD }, trailingCrestStyle]}
        />
        <View style={styles.body} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#C5E7F1',
    borderWidth: 1,
    borderColor: '#A9D6E3',
  },
  pivot: { position: 'absolute', left: -ORB_SIZE, right: -ORB_SIZE, height: 0 },
  crest: {
    position: 'absolute',
    top: -REST_DOME,
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    backgroundColor: '#52B2CF',
  },
  body: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ORB_SIZE * 3,
    backgroundColor: '#45A9C9',
  },
});
