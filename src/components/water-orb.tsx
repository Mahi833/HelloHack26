import { StyleSheet, View } from 'react-native';
import type { DerivedValue } from 'react-native-reanimated';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

const ORB_SIZE = 96;

export type WaterOrbProps = {
  progress: number;
  tiltDeg: DerivedValue<number>;
};

export const WaterOrb = ({ progress, tiltDeg }: WaterOrbProps) => {
  const level = Math.min(Math.max(progress, 0), 1);

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tiltDeg.value}deg` }],
  }));

  return (
    <View
      style={styles.orb}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(level * 100) }}>
      <Animated.View style={[styles.pivot, { top: ORB_SIZE * (1 - level) }, surfaceStyle]}>
        <View style={styles.body} />
        <View style={styles.crest} />
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
  body: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ORB_SIZE * 3,
    backgroundColor: '#45A9C9',
  },
  crest: { position: 'absolute', top: -2, left: 0, right: 0, height: 3, backgroundColor: '#7ED0E8' },
});
