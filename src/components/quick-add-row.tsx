import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

const SERVINGS = [
  { amount: 150, label: 'Small' },
  { amount: 250, label: 'Glass' },
  { amount: 350, label: 'Large' },
];

const CUSTOM_STEP_ML = 50;
const CUSTOM_MIN_ML = 50;
const CUSTOM_MAX_ML = 2000;
const CUSTOM_DEFAULT_ML = 500;

export type QuickAddRowProps = {
  onAdd: (amountMl: number) => void;
};

export const QuickAddRow = ({ onAdd }: QuickAddRowProps) => {
  const [customOpen, setCustomOpen] = useState(false);
  const [customMl, setCustomMl] = useState(CUSTOM_DEFAULT_ML);

  const stepCustom = (delta: number) =>
    setCustomMl((value) =>
      Math.min(Math.max(value + delta, CUSTOM_MIN_ML), CUSTOM_MAX_ML),
    );

  const confirmCustom = () => {
    onAdd(customMl);
    setCustomOpen(false);
    setCustomMl(CUSTOM_DEFAULT_ML);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.eyebrow}>LOG A DRINK</Text>
      <View style={styles.row}>
        {SERVINGS.map(({ amount, label }, index) => (
          <Pressable
            key={amount}
            accessibilityRole="button"
            accessibilityLabel={`Add ${amount} millilitres of water`}
            onPress={() => onAdd(amount)}
            style={({ pressed }) => [styles.serving, pressed && styles.pressed]}>
            <View style={styles.glass}>
              <View style={[styles.water, { height: `${35 + index * 18}%` }]} />
            </View>
            <Text style={styles.amount}>{amount} ml</Text>
            <Text style={styles.label}>{label}</Text>
          </Pressable>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a custom amount of water"
          onPress={() => setCustomOpen(true)}
          style={({ pressed }) => [styles.serving, styles.custom, pressed && styles.pressed]}>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.amount}>Custom</Text>
          <Text style={styles.label}>Any amount</Text>
        </Pressable>
      </View>

      <Modal
        visible={customOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setCustomOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>Custom amount</Text>

            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease by 50 millilitres"
                disabled={customMl <= CUSTOM_MIN_ML}
                onPress={() => stepCustom(-CUSTOM_STEP_ML)}
                style={({ pressed }) => [
                  styles.stepButton,
                  customMl <= CUSTOM_MIN_ML && styles.stepButtonDisabled,
                  pressed && styles.pressed,
                ]}>
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
                style={({ pressed }) => [
                  styles.stepButton,
                  customMl >= CUSTOM_MAX_ML && styles.stepButtonDisabled,
                  pressed && styles.pressed,
                ]}>
                <Text style={styles.stepButtonText}>+</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={confirmCustom}
              style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}>
              <Text style={styles.confirmText}>Add {customMl.toLocaleString()} ml</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setCustomOpen(false)}
              style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginTop: 18 },
  eyebrow: { color: '#7D9EAD', fontSize: 10, letterSpacing: 1.4, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 9 },
  serving: { flex: 1, alignItems: 'center', paddingVertical: 15, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9DDE3' },
  custom: { justifyContent: 'center' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  glass: { width: 28, height: 34, borderWidth: 2, borderColor: '#A6D7E4', borderTopWidth: 0, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  water: { width: '100%', backgroundColor: '#B5E5F0' },
  plus: { color: '#62B6D0', fontSize: 30, lineHeight: 34, fontWeight: '300' },
  amount: { color: '#326277', fontSize: 13, fontWeight: '700', marginTop: 10 },
  label: { color: '#9AB0B9', fontSize: 10, marginTop: 3 },
  scrim: { flex: 1, backgroundColor: 'rgba(12, 44, 58, 0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#F4FAFC', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 38 },
  sheetTitle: { color: '#163D52', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  stepButton: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#DDF3FA', borderWidth: 1, borderColor: '#B9DEE9', alignItems: 'center', justifyContent: 'center' },
  stepButtonDisabled: { opacity: 0.4 },
  stepButtonText: { color: '#176C8C', fontSize: 28, lineHeight: 32, fontWeight: '600' },
  stepValue: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  stepNumber: { color: '#176C8C', fontSize: 40, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  stepUnit: { color: '#54859A', fontSize: 16, fontWeight: '500' },
  confirm: { marginTop: 24, borderRadius: 18, backgroundColor: '#3188A8', paddingVertical: 16, alignItems: 'center' },
  confirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  cancel: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#7797A4', fontSize: 14, fontWeight: '600' },
});
