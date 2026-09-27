import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Palette, Radius, Space, Surface, Type } from '@/constants/design';

const SERVINGS = [150, 250, 350] as const;

const CUSTOM_STEP_ML = 50;
const CUSTOM_MIN_ML = 50;
const CUSTOM_MAX_ML = 2000;
const CUSTOM_DEFAULT_ML = 500;

export type LogDrinkPanelProps = {
  onAdd: (amountMl: number) => void;
  cupConnected: boolean;
  cupWeightG: number | null;
};

export const LogDrinkPanel = ({ onAdd, cupConnected, cupWeightG }: LogDrinkPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMl, setCustomMl] = useState(CUSTOM_DEFAULT_ML);

  const stepCustom = (delta: number) =>
    setCustomMl((value) => Math.min(Math.max(value + delta, CUSTOM_MIN_ML), CUSTOM_MAX_ML));

  const confirmCustom = () => {
    onAdd(customMl);
    setCustomOpen(false);
    setCustomMl(CUSTOM_DEFAULT_ML);
  };

  const addAndCollapse = (amountMl: number) => {
    onAdd(amountMl);
    setExpanded(false);
  };

  return (
    <View style={styles.wrapper}>
      <View style={[Surface.glass, styles.autoCard]}>
        <View style={[styles.autoDot, cupConnected ? styles.autoDotOn : styles.autoDotOff]} />
        <View style={styles.autoCopy}>
          <Text style={styles.autoTitle}>
            {cupConnected ? 'Logging your sips automatically' : 'Connect your iCup to log automatically'}
          </Text>
          <Text style={styles.autoNote}>
            {cupConnected
              ? 'The cup weighs every sip, so you do not need to tap anything.'
              : 'Open settings to pair the cup. Until then, log by hand below.'}
          </Text>
        </View>
        {cupWeightG !== null && <Text style={styles.autoWeight}>{cupWeightG.toFixed(0)} g</Text>}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((open) => !open)}
        style={({ pressed }) => [Surface.glassStrong, styles.toggle, pressed && styles.pressed]}>
        <Text style={styles.toggleText}>Log a drink by hand</Text>
        <Text style={styles.toggleChevron}>{expanded ? '–' : '+'}</Text>
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={styles.servingRow}>
          {SERVINGS.map((amount) => (
            <Pressable
              key={amount}
              accessibilityRole="button"
              accessibilityLabel={`Add ${amount} millilitres of water`}
              onPress={() => addAndCollapse(amount)}
              style={({ pressed }) => [Surface.glassStrong, styles.serving, pressed && styles.pressed]}>
              <Text style={styles.servingAmount}>{amount}</Text>
              <Text style={styles.servingUnit}>ml</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a custom amount of water"
            onPress={() => setCustomOpen(true)}
            style={({ pressed }) => [Surface.glassStrong, styles.serving, pressed && styles.pressed]}>
            <Text style={styles.servingAmount}>{'…'}</Text>
            <Text style={styles.servingUnit}>custom</Text>
          </Pressable>
        </Animated.View>
      )}

      <Modal visible={customOpen} transparent animationType="slide" onRequestClose={() => setCustomOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setCustomOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Custom amount</Text>

            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease by 50 millilitres"
                disabled={customMl <= CUSTOM_MIN_ML}
                onPress={() => stepCustom(-CUSTOM_STEP_ML)}
                style={({ pressed }) => [styles.stepButton, customMl <= CUSTOM_MIN_ML && styles.disabled, pressed && styles.pressed]}>
                <Text style={styles.stepButtonText}>-</Text>
              </Pressable>

              <View style={styles.stepValue}>
                <Text style={styles.stepNumber}>{customMl.toLocaleString()}</Text>
                <Text style={styles.stepUnit}>ml</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase by 50 millilitres"
                disabled={customMl >= CUSTOM_MAX_ML}
                onPress={() => stepCustom(CUSTOM_STEP_ML)}
                style={({ pressed }) => [styles.stepButton, customMl >= CUSTOM_MAX_ML && styles.disabled, pressed && styles.pressed]}>
                <Text style={styles.stepButtonText}>+</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={confirmCustom}
              style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}>
              <Text style={styles.confirmText}>Add {customMl.toLocaleString()} ml</Text>
            </Pressable>

            <Pressable accessibilityRole="button" onPress={() => setCustomOpen(false)} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginTop: Space.lg, gap: Space.sm },
  autoCard: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg },
  autoDot: { width: 9, height: 9, borderRadius: Radius.pill },
  autoDotOn: { backgroundColor: Palette.positive },
  autoDotOff: { backgroundColor: Palette.inkFaint },
  autoCopy: { flex: 1 },
  autoTitle: { ...Type.callout, color: Palette.ink },
  autoNote: { ...Type.caption, color: Palette.inkMuted, marginTop: 3 },
  autoWeight: { ...Type.callout, color: Palette.waterDeep, fontVariant: ['tabular-nums'] },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Space.lg, height: 52, borderRadius: Radius.medium },
  toggleText: { ...Type.body, color: Palette.inkSoft, fontWeight: '600' },
  toggleChevron: { ...Type.heading, color: Palette.accent, fontSize: 22, lineHeight: 26 },
  servingRow: { flexDirection: 'row', gap: Space.sm },
  serving: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Space.md, borderRadius: Radius.medium },
  servingAmount: { ...Type.subheading, color: Palette.waterDeep, fontVariant: ['tabular-nums'] },
  servingUnit: { ...Type.caption, color: Palette.inkFaint, marginTop: 2 },
  scrim: { flex: 1, backgroundColor: 'rgba(12, 44, 58, 0.34)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Palette.canvasDeep, borderTopLeftRadius: Radius.xlarge, borderTopRightRadius: Radius.xlarge, paddingHorizontal: Space.xl, paddingTop: Space.md, paddingBottom: Space.xxl },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: Radius.pill, backgroundColor: Palette.inkFaint, opacity: 0.5 },
  sheetTitle: { ...Type.heading, color: Palette.ink, textAlign: 'center', marginTop: Space.md },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Space.xl },
  stepButton: { width: 58, height: 58, borderRadius: Radius.pill, backgroundColor: Palette.waterSoft, alignItems: 'center', justifyContent: 'center' },
  stepButtonText: { ...Type.heading, color: Palette.waterDeep, fontSize: 28, lineHeight: 32 },
  stepValue: { flexDirection: 'row', alignItems: 'baseline', gap: Space.xs },
  stepNumber: { ...Type.display, fontSize: 42, lineHeight: 48, color: Palette.waterDeep },
  stepUnit: { ...Type.body, color: Palette.inkMuted },
  confirm: { marginTop: Space.xl, height: 52, borderRadius: Radius.medium, backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center' },
  confirmText: { ...Type.body, color: Palette.onAccent, fontWeight: '700' },
  cancel: { marginTop: Space.sm, height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { ...Type.body, color: Palette.inkMuted, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
