import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GoalCelebration } from '@/components/goal-celebration';
import { LogDrinkPanel } from '@/components/log-drink-panel';
import { ScreenBackground } from '@/components/screen-background';
import { ScreenHeader } from '@/components/screen-header';
import { StreakCard, type StreakDay } from '@/components/streak-card';
import { REMINDER_CHOICES, SettingsSheet } from '@/components/settings-sheet';
import { WaterOrb } from '@/components/water-orb';
import { Palette, Radius, Space, Surface, Type } from '@/constants/design';
import { useClock, useHydrationStore } from '@/store/hydration-store';
import { computeStreak } from '@/store/streak';
import { localDayKey, type DrinkEvent } from '@/store/types';
import { createSimulatedWeightSource, useIcup, useIcupSips } from '@/ble/use-icup';
import { shouldAlertToDrink } from '@/ble/drink-alert';
import { useIcupBle } from '@/contexts/icup-ble-context';
import type { WorkoutSummary } from '@/health/healthkit';
import { useHealthReminders } from '@/health/use-health-reminders';
import { useLogDrink, useUndoDrink } from '@/hooks/use-log-drink';
import { useWaterTilt } from '@/motion/use-water-tilt';

const DEV_DRINK_ML = 250;
const STREAK_LOOKBACK_DAYS = 400;
const WEEK_DOTS = 7;
const DAY_MS = 86400000;

const describeClock = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const describeDate = (at: number): string =>
  new Date(at).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

const describeFrequency = (minutes: number): string =>
  REMINDER_CHOICES.find((choice) => choice.minutes === minutes)?.label ?? `Every ${minutes} min`;

const describeElapsed = (minutes: number): string => {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h ago` : `${hours}h ${rest}m ago`;
};

const describeWorkout = (workout: WorkoutSummary | null): string => {
  if (workout === null) return 'no workout found';
  const energy = workout.activeEnergyKcal === null ? '' : `, ${workout.activeEnergyKcal} kcal`;
  return `${workout.intensity}, ${workout.durationMinutes} min${energy} at ${describeClock(workout.endedAt)}`;
};

const cancelSipReminders = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === 'sip-reminder')
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
  );
};

const scheduleSipReminder = async (minutes: number): Promise<void> => {
  await cancelSipReminders();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('sip-reminders', {
      name: 'Sip reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time for a sip!',
      body: 'Take a moment to drink some water.',
      sound: 'default',
      data: { kind: 'sip-reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: minutes * 60,
      repeats: true,
      ...(Platform.OS === 'android' ? { channelId: 'sip-reminders' } : {}),
    },
  });
};

const triggerMinutes = (trigger: unknown): number | null => {
  if (typeof trigger !== 'object' || trigger === null) return null;
  const seconds = (trigger as { seconds?: unknown }).seconds;
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.max(1, Math.round(seconds / 60));
};

const playsSound = (sound: unknown): boolean =>
  typeof sound === 'string' ? sound.length > 0 : sound === true;

export default function HomeScreen() {
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [simulatedCup, setSimulatedCup] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sipRemindersEnabled, setSipRemindersEnabled] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState<number>(REMINDER_CHOICES[0].minutes);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('Reminders are off.');

  const { ready, todayMl, dailyGoalMl, lastDrinkAt, setDailyGoal, dayTotals } = useHydrationStore();
  const logDrink = useLogDrink();
  const undoDrink = useUndoDrink();
  const now = useClock();
  const minutesSinceDrink = lastDrinkAt === null ? null : Math.max(0, Math.floor((now - lastDrinkAt) / 60000));

  const icupBle = useIcupBle();
  const simulatedSource = useMemo(() => createSimulatedWeightSource(), []);
  const simulated = useIcup({ addDrink: logDrink, source: simulatedSource, enabled: simulatedCup });
  const liveSipError = useIcupSips({
    addDrink: logDrink,
    sample: icupBle.latestSample,
    connected: icupBle.isConnected && !simulatedCup,
  });
  const health = useHealthReminders({ lastDrinkAt, todayMl, addDrink: logDrink });

  const cupConnected = simulatedCup || icupBle.isConnected;
  const cupWeightG = simulatedCup ? simulated.weightG : icupBle.latestWeightGrams;
  const cupError = simulatedCup ? simulated.error : liveSipError;

  const todayKey = localDayKey(now);

  const history = useMemo(
    () => dayTotals(localDayKey(now - STREAK_LOOKBACK_DAYS * DAY_MS), todayKey),
    [dayTotals, now, todayKey],
  );
  const streak = useMemo(
    () => computeStreak(history, dailyGoalMl, todayKey),
    [history, dailyGoalMl, todayKey],
  );
  const recentDays = useMemo<StreakDay[]>(() => {
    const totalByDay = new Map(history.map((entry) => [entry.day, entry.ml]));
    return Array.from({ length: WEEK_DOTS }, (_, index) => {
      const at = now - (WEEK_DOTS - 1 - index) * DAY_MS;
      const day = localDayKey(at);
      return {
        label: new Date(at).toLocaleDateString([], { weekday: 'narrow' }),
        met: dailyGoalMl > 0 && (totalByDay.get(day) ?? 0) >= dailyGoalMl,
        isToday: day === todayKey,
      };
    });
  }, [history, now, todayKey, dailyGoalMl]);

  const [celebrating, setCelebrating] = useState(false);
  const previousTodayMl = useRef<number | null>(null);

  useEffect(() => {
    if (!ready) return;
    const previous = previousTodayMl.current;
    previousTodayMl.current = todayMl;
    if (previous === null) return;
    if (todayMl > previous && previous < dailyGoalMl && todayMl >= dailyGoalMl) {
      setCelebrating(true);
    }
  }, [ready, todayMl, dailyGoalMl]);

  const progress = dailyGoalMl > 0 ? Math.min(todayMl / dailyGoalMl, 1) : 0;

  const cupAlert = shouldAlertToDrink({
    remindersEnabled: sipRemindersEnabled,
    lastDrinkAt,
    now,
    intervalMinutes: reminderMinutes,
    goalReached: ready && dailyGoalMl > 0 && todayMl >= dailyGoalMl,
  });
  const { isConnected: cupLinked, setDrinkAlert } = icupBle;

  useEffect(() => {
    if (!cupLinked) return;
    void setDrinkAlert(cupAlert);
  }, [cupLinked, cupAlert, setDrinkAlert]);

  const waterMotion = useWaterTilt(ready);
  const remaining = Math.max(dailyGoalMl - todayMl, 0);

  useEffect(() => {
    let mounted = true;
    Notifications.getAllScheduledNotificationsAsync()
      .then((scheduled) => {
        const existing = scheduled.find((item) => item.content.data?.kind === 'sip-reminder');
        if (!mounted) return;
        setSipRemindersEnabled(existing !== undefined);
        if (existing === undefined) return;
        const minutes = triggerMinutes(existing.trigger) ?? REMINDER_CHOICES[0].minutes;
        setReminderMinutes(minutes);
        if (playsSound(existing.content.sound)) {
          setReminderMessage('Reminders are on.');
          return;
        }
        setReminderMessage('Reminders are on, now with sound.');
        void scheduleSipReminder(minutes);
      })
      .catch(() => {
        if (mounted) setReminderMessage('Notifications are unavailable on this device.');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const applySipReminders = async (enabled: boolean, minutes: number) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    try {
      await cancelSipReminders();
      if (!enabled) {
        setSipRemindersEnabled(false);
        setReminderMessage('Reminders are off.');
        return;
      }
      let permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        setSipRemindersEnabled(false);
        setReminderMessage('Allow notifications in Settings to turn on reminders.');
        return;
      }
      await scheduleSipReminder(minutes);
      setSipRemindersEnabled(true);
      setReminderMessage(`${describeFrequency(minutes)}, starting now.`);
    } catch {
      setSipRemindersEnabled(false);
      setReminderMessage('Could not update reminders. Please try again.');
    } finally {
      setReminderBusy(false);
    }
  };

  const changeReminderMinutes = (minutes: number) => {
    setReminderMinutes(minutes);
    if (sipRemindersEnabled) {
      void applySipReminders(true, minutes);
    } else {
      setReminderMessage(`${describeFrequency(minutes)} once you turn reminders on.`);
    }
  };

  const logManualDrink = async (ml: number): Promise<DrinkEvent | null> => {
    try {
      return await logDrink(ml, 'manual');
    } catch (error: unknown) {
      console.warn('Could not save that drink', error);
      return null;
    }
  };

  const revertDrink = (event: DrinkEvent) => {
    undoDrink(event).catch((error: unknown) => console.warn('Could not undo that drink', error));
  };

  const changeGoal = (ml: number) => {
    setDailyGoal(ml).catch((error: unknown) => console.warn('Could not save that goal', error));
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ScreenHeader
            subtitle={describeDate(now)}
            title="Today"
            status={{ connected: cupConnected, label: cupConnected ? 'Cup on' : 'No cup' }}
            onPressSettings={() => setSettingsOpen(true)}
          />

          <View style={[Surface.glass, styles.summaryCard]}>
            <View style={styles.summaryTop}>
              <View style={styles.summaryCopy}>
                <Text style={styles.eyebrow}>TODAY&apos;S PROGRESS</Text>
                <View style={styles.fractionRow}>
                  <Text style={styles.drunk}>{todayMl.toLocaleString()}</Text>
                  <Text style={styles.goal}>/ {dailyGoalMl.toLocaleString()} ml</Text>
                </View>
              </View>
              <WaterOrb progress={progress} motion={waterMotion} />
            </View>

            <View
              style={styles.progressTrack}
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressPercent}>{Math.round(progress * 100)}% of your goal</Text>
              <Text style={styles.remaining}>
                {!ready
                  ? 'Loading your saved drinks'
                  : remaining === 0
                    ? 'Goal reached!'
                    : `${remaining.toLocaleString()} ml to go`}
              </Text>
            </View>
            <Text style={styles.lastDrink}>
              {minutesSinceDrink === null ? 'No water logged yet' : `Last drink ${describeElapsed(minutesSinceDrink)}`}
            </Text>
          </View>

          <StreakCard current={streak.current} best={streak.best} recent={recentDays} />

          <LogDrinkPanel
            onAdd={logManualDrink}
            onUndo={revertDrink}
            cupConnected={cupConnected}
            cupWeightG={cupWeightG}
          />

          {__DEV__ && (
            <View style={[Surface.glassTint, styles.devPanel]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: devPanelOpen }}
                onPress={() => setDevPanelOpen((open) => !open)}
                style={styles.devPanelHeader}>
                <Text style={styles.devBadge}>DEV</Text>
                <Text style={styles.devPanelTitle}>Developer controls</Text>
                <Text style={styles.devChevron}>{devPanelOpen ? '–' : '+'}</Text>
              </Pressable>
              {devPanelOpen && (
                <View style={styles.devPanelContent}>
                  <View style={styles.devRow}>
                    <Text style={styles.devLabel}>Simulated cup</Text>
                    <Pressable
                      accessibilityRole="switch"
                      accessibilityState={{ checked: simulatedCup }}
                      onPress={() => setSimulatedCup((value) => !value)}
                      style={[styles.devToggle, simulatedCup && styles.devToggleOn]}>
                      <Text style={styles.devToggleText}>{simulatedCup ? 'Driving sips' : 'Real cup'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.devRow}>
                    <Text style={styles.devLabel}>Log a drink</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Log ${DEV_DRINK_ML} millilitres`}
                      onPress={() => void logManualDrink(DEV_DRINK_ML)}
                      style={styles.devToggle}>
                      <Text style={styles.devToggleText}>Add {DEV_DRINK_ML} ml</Text>
                    </Pressable>
                  </View>
                  <View style={styles.devRow}>
                    <Text style={styles.devLabel}>Live weight</Text>
                    <Text style={styles.devValue}>{cupWeightG === null ? 'no reading' : `${cupWeightG.toFixed(1)} g`}</Text>
                  </View>
                  <View style={styles.devRow}>
                    <Text style={styles.devLabel}>Apple Health</Text>
                    <Text style={styles.devValue}>{health.healthAuthorized ? 'authorized' : 'not authorized'}</Text>
                  </View>
                  <View style={styles.devRow}>
                    <Text style={styles.devLabel}>Health last read</Text>
                    <Text style={styles.devValue}>
                      {health.lastCheckedAt === null ? 'never' : describeClock(health.lastCheckedAt)}
                    </Text>
                  </View>
                  <View style={styles.devRow}>
                    <Text style={styles.devLabel}>Last workout</Text>
                    <Text style={styles.devValue}>{describeWorkout(health.lastWorkout)}</Text>
                  </View>
                  <View style={styles.devRow}>
                    <Text style={styles.devLabel}>Woke up</Text>
                    <Text style={styles.devValue}>
                      {health.lastSleep === null ? 'no sleep data' : describeClock(health.lastSleep.wokeAt)}
                    </Text>
                  </View>
                  <View style={styles.devRow}>
                    <Text style={styles.devLabel}>Last health nudge</Text>
                    <Text style={styles.devValue}>{health.lastNudge === null ? 'none yet' : health.lastNudge.kind}</Text>
                  </View>
                  {cupError !== null && (
                    <View style={styles.devRow}>
                      <Text style={styles.devLabel}>Bluetooth error</Text>
                      <Text style={styles.devValue}>{cupError}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <GoalCelebration
          visible={celebrating}
          todayMl={todayMl}
          dailyGoalMl={dailyGoalMl}
          streakDays={streak.current}
          onDismiss={() => setCelebrating(false)}
        />

        <SettingsSheet
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          dailyGoalMl={dailyGoalMl}
          onChangeGoal={changeGoal}
          remindersEnabled={sipRemindersEnabled}
          onToggleReminders={(enabled) => void applySipReminders(enabled, reminderMinutes)}
          reminderMinutes={reminderMinutes}
          onChangeReminderMinutes={changeReminderMinutes}
          reminderMessage={reminderMessage}
          reminderBusy={reminderBusy}
          cupConnected={icupBle.isConnected}
          cupBusy={icupBle.isWorking || simulatedCup}
          cupMessage={simulatedCup ? 'Simulated cup is driving sips. Turn it off in developer controls.' : icupBle.message}
          cupWeightG={cupWeightG}
          onConnect={() => void icupBle.connect()}
          onDisconnect={() => void icupBle.disconnect()}
          onTare={() => void icupBle.tare()}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: Space.xl, paddingTop: Space.lg, paddingBottom: 38, maxWidth: 560, width: '100%', alignSelf: 'center' },
  summaryCard: { padding: Space.xl, overflow: 'hidden' },
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.md },
  summaryCopy: { flex: 1 },
  eyebrow: { ...Type.eyebrow, color: Palette.inkFaint },
  fractionRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: Space.sm, flexWrap: 'wrap' },
  drunk: { ...Type.display, color: Palette.waterDeep },
  goal: { ...Type.body, color: Palette.inkMuted, marginLeft: Space.sm },
  progressTrack: { height: 10, marginTop: Space.xl, borderRadius: Radius.small, backgroundColor: Palette.waterSoft, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.small, backgroundColor: Palette.water },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Space.md },
  progressPercent: { ...Type.caption, color: Palette.accent, fontWeight: '700' },
  remaining: { ...Type.caption, color: Palette.inkMuted },
  lastDrink: { ...Type.caption, color: Palette.inkFaint, marginTop: Space.sm },
  devPanel: { marginTop: Space.xxl, overflow: 'hidden' },
  devPanelHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Space.lg },
  devBadge: { ...Type.caption, color: Palette.onAccent, backgroundColor: Palette.accentMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  devPanelTitle: { ...Type.caption, color: Palette.inkSoft, fontWeight: '700', marginLeft: Space.sm, flex: 1 },
  devChevron: { ...Type.subheading, color: Palette.inkMuted, paddingHorizontal: Space.xs },
  devPanelContent: { paddingHorizontal: Space.lg, paddingBottom: Space.md },
  devRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Palette.border },
  devLabel: { ...Type.caption, color: Palette.inkMuted, fontWeight: '600', flex: 1 },
  devValue: { ...Type.caption, color: Palette.inkSoft, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  devToggle: { minWidth: 104, alignItems: 'center', paddingHorizontal: Space.sm, paddingVertical: 7, borderRadius: Radius.small, backgroundColor: Palette.canvas, borderWidth: StyleSheet.hairlineWidth, borderColor: Palette.border },
  devToggleOn: { backgroundColor: '#CFEBD9' },
  devToggleText: { ...Type.caption, color: Palette.inkSoft, fontWeight: '700' },
});
