import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Palette, Radius, Space, Surface, Type } from '@/constants/design';

export const REMINDER_CHOICES = [
  { minutes: 2, label: 'Every 2 min' },
  { minutes: 30, label: 'Every 30 min' },
  { minutes: 60, label: 'Hourly' },
  { minutes: 120, label: 'Every 2 h' },
] as const;

export const GOAL_STEP_ML = 100;
export const GOAL_MIN_ML = 500;
export const GOAL_MAX_ML = 6000;

export type SettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
  dailyGoalMl: number;
  onChangeGoal: (ml: number) => void;
  remindersEnabled: boolean;
  onToggleReminders: (enabled: boolean) => void;
  reminderMinutes: number;
  onChangeReminderMinutes: (minutes: number) => void;
  reminderMessage: string;
  reminderBusy: boolean;
  cupConnected: boolean;
  cupBusy: boolean;
  cupMessage: string;
  cupWeightG: number | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onTare: () => void;
};

export const SettingsSheet = ({
  visible,
  onClose,
  dailyGoalMl,
  onChangeGoal,
  remindersEnabled,
  onToggleReminders,
  reminderMinutes,
  onChangeReminderMinutes,
  reminderMessage,
  reminderBusy,
  cupConnected,
  cupBusy,
  cupMessage,
  cupWeightG,
  onConnect,
  onDisconnect,
  onTare,
}: SettingsSheetProps) => {
  const stepGoal = (delta: number) =>
    onChangeGoal(Math.min(Math.max(dailyGoalMl + delta, GOAL_MIN_ML), GOAL_MAX_ML));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Settings</Text>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetBody}>
            <View style={[Surface.glassStrong, styles.section]}>
              <Text style={styles.sectionTitle}>Daily goal</Text>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease daily goal"
                  disabled={dailyGoalMl <= GOAL_MIN_ML}
                  onPress={() => stepGoal(-GOAL_STEP_ML)}
                  style={({ pressed }) => [styles.stepButton, dailyGoalMl <= GOAL_MIN_ML && styles.disabled, pressed && styles.pressed]}>
                  <Text style={styles.stepButtonText}>-</Text>
                </Pressable>
                <View style={styles.stepValue}>
                  <Text style={styles.stepNumber}>{dailyGoalMl.toLocaleString()}</Text>
                  <Text style={styles.stepUnit}>ml</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase daily goal"
                  disabled={dailyGoalMl >= GOAL_MAX_ML}
                  onPress={() => stepGoal(GOAL_STEP_ML)}
                  style={({ pressed }) => [styles.stepButton, dailyGoalMl >= GOAL_MAX_ML && styles.disabled, pressed && styles.pressed]}>
                  <Text style={styles.stepButtonText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={[Surface.glassStrong, styles.section]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Sip reminders</Text>
                {reminderBusy ? (
                  <ActivityIndicator color={Palette.accent} />
                ) : (
                  <Switch
                    accessibilityLabel="Sip reminders"
                    value={remindersEnabled}
                    onValueChange={onToggleReminders}
                    trackColor={{ false: '#C5D5DB', true: '#8AC7A1' }}
                    thumbColor={Palette.onAccent}
                  />
                )}
              </View>
              <Text style={styles.sectionNote}>{reminderMessage}</Text>
              <View style={styles.choiceRow}>
                {REMINDER_CHOICES.map(({ minutes, label }) => {
                  const selected = reminderMinutes === minutes;
                  return (
                    <Pressable
                      key={minutes}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={reminderBusy}
                      onPress={() => onChangeReminderMinutes(minutes)}
                      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}>
                      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[Surface.glassStrong, styles.section]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>iCup</Text>
                <Text style={styles.weight}>{cupWeightG === null ? 'no reading' : `${cupWeightG.toFixed(1)} g`}</Text>
              </View>
              <Text style={styles.sectionNote}>{cupMessage}</Text>
              <View style={styles.cupActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={cupBusy}
                  onPress={cupConnected ? onDisconnect : onConnect}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    cupConnected && styles.secondaryButton,
                    cupBusy && styles.disabled,
                    pressed && styles.pressed,
                  ]}>
                  {cupBusy ? (
                    <ActivityIndicator size="small" color={Palette.onAccent} />
                  ) : (
                    <Text style={styles.primaryButtonText}>{cupConnected ? 'Disconnect' : 'Connect'}</Text>
                  )}
                </Pressable>
                {cupConnected && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onTare}
                    style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}>
                    <Text style={styles.ghostButtonText}>Tare</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </ScrollView>

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.done}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(12, 44, 58, 0.34)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', backgroundColor: Palette.canvasDeep, borderTopLeftRadius: Radius.xlarge, borderTopRightRadius: Radius.xlarge, paddingHorizontal: Space.xl, paddingTop: Space.md, paddingBottom: Space.xxl },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: Radius.pill, backgroundColor: Palette.inkFaint, opacity: 0.5 },
  sheetTitle: { ...Type.heading, color: Palette.ink, textAlign: 'center', marginTop: Space.md },
  sheetBody: { paddingTop: Space.lg, gap: Space.md },
  section: { padding: Space.lg, gap: Space.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { ...Type.subheading, color: Palette.ink },
  sectionNote: { ...Type.caption, color: Palette.inkMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Space.sm },
  stepButton: { width: 52, height: 52, borderRadius: Radius.pill, backgroundColor: Palette.waterSoft, alignItems: 'center', justifyContent: 'center' },
  stepButtonText: { ...Type.heading, color: Palette.waterDeep, fontSize: 26, lineHeight: 30 },
  stepValue: { flexDirection: 'row', alignItems: 'baseline', gap: Space.xs },
  stepNumber: { ...Type.display, fontSize: 38, lineHeight: 44, color: Palette.waterDeep },
  stepUnit: { ...Type.body, color: Palette.inkMuted },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginTop: Space.xs },
  choice: { paddingHorizontal: Space.md, height: 34, justifyContent: 'center', borderRadius: Radius.pill, backgroundColor: Palette.canvas, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
  choiceSelected: { backgroundColor: Palette.accent, borderColor: Palette.accent },
  choiceText: { ...Type.caption, color: Palette.inkSoft, fontWeight: '600' },
  choiceTextSelected: { color: Palette.onAccent },
  weight: { ...Type.callout, color: Palette.waterDeep, fontVariant: ['tabular-nums'] },
  cupActions: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginTop: Space.xs },
  primaryButton: { flex: 1, height: 46, borderRadius: Radius.medium, backgroundColor: Palette.accent, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { backgroundColor: Palette.accentMuted },
  primaryButtonText: { ...Type.callout, color: Palette.onAccent, fontWeight: '700' },
  ghostButton: { minWidth: 76, height: 46, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.canvas, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
  ghostButtonText: { ...Type.callout, color: Palette.accent, fontWeight: '700' },
  done: { marginTop: Space.lg, height: 46, alignItems: 'center', justifyContent: 'center' },
  doneText: { ...Type.body, color: Palette.inkMuted, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
