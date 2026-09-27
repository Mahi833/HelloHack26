import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Palette, Radius, Space, Surface, Type } from '@/constants/design';

const AUTO_DISMISS_MS = 3200;

type Piece = {
  left: `${number}%`;
  delay: number;
  duration: number;
  spin: number;
  size: number;
  color: string;
};

const PIECES: Piece[] = [
  { left: '8%', delay: 0, duration: 2200, spin: 320, size: 11, color: Palette.water },
  { left: '18%', delay: 180, duration: 2600, spin: -260, size: 8, color: Palette.accent },
  { left: '28%', delay: 90, duration: 2000, spin: 400, size: 13, color: Palette.waterSoft },
  { left: '38%', delay: 320, duration: 2400, spin: -180, size: 9, color: Palette.water },
  { left: '48%', delay: 40, duration: 2800, spin: 240, size: 12, color: Palette.waterDeep },
  { left: '58%', delay: 260, duration: 2100, spin: -340, size: 8, color: Palette.accent },
  { left: '68%', delay: 140, duration: 2500, spin: 300, size: 14, color: Palette.waterSoft },
  { left: '78%', delay: 380, duration: 2300, spin: -220, size: 10, color: Palette.water },
  { left: '88%', delay: 70, duration: 2700, spin: 360, size: 9, color: Palette.accent },
];

const Confetti = ({ piece, fallTo }: { piece: Piece; fallTo: number }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: piece.duration, easing: Easing.out(Easing.quad) }),
    );
  }, [piece.delay, piece.duration, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * fallTo },
      { rotate: `${progress.value * piece.spin}deg` },
    ],
    opacity: 1 - progress.value * 0.85,
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        { left: piece.left, width: piece.size, height: piece.size, backgroundColor: piece.color },
        style,
      ]}
    />
  );
};

export type GoalCelebrationProps = {
  visible: boolean;
  todayMl: number;
  dailyGoalMl: number;
  streakDays: number;
  onDismiss: () => void;
};

export const GoalCelebration = ({
  visible,
  todayMl,
  dailyGoalMl,
  streakDays,
  onDismiss,
}: GoalCelebrationProps) => {
  const { height } = useWindowDimensions();
  const pop = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      pop.value = 0;
      return;
    }
    pop.value = withSpring(1, { damping: 11, stiffness: 140 });
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, pop, onDismiss]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.86 + pop.value * 0.14 }],
    opacity: pop.value,
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.scrim} onPress={onDismiss} accessibilityLabel="Dismiss celebration">
        <View pointerEvents="none" style={styles.confettiLayer}>
          {PIECES.map((piece, index) => (
            <Confetti key={index} piece={piece} fallTo={height} />
          ))}
        </View>

        <Animated.View style={[Surface.glassStrong, styles.card, cardStyle]}>
          <View style={styles.badge}>
            <View style={styles.badgeInner} />
          </View>
          <Text style={styles.title}>Goal reached</Text>
          <Text style={styles.amount}>
            {todayMl.toLocaleString()} of {dailyGoalMl.toLocaleString()} ml
          </Text>
          <Text style={styles.streak}>
            {streakDays <= 1
              ? 'That is day one. Keep it going tomorrow.'
              : `${streakDays} days in a row.`}
          </Text>
          <Text style={styles.hint}>Tap anywhere to dismiss</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(12, 44, 58, 0.42)', alignItems: 'center', justifyContent: 'center' },
  confettiLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  piece: { position: 'absolute', top: -30, borderRadius: 3 },
  card: { width: '82%', maxWidth: 360, alignItems: 'center', paddingVertical: Space.xxl, paddingHorizontal: Space.xl },
  badge: {
    width: 62,
    height: 62,
    borderRadius: Radius.pill,
    backgroundColor: Palette.waterSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInner: { width: 26, height: 26, borderRadius: Radius.pill, backgroundColor: Palette.water },
  title: { ...Type.title, color: Palette.ink, marginTop: Space.lg },
  amount: { ...Type.body, color: Palette.waterDeep, marginTop: Space.xs, fontVariant: ['tabular-nums'] },
  streak: { ...Type.callout, color: Palette.inkMuted, marginTop: Space.md, textAlign: 'center' },
  hint: { ...Type.caption, color: Palette.inkFaint, marginTop: Space.lg },
});
