import * as Notifications from 'expo-notifications';
import * as SQLite from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  isHealthAvailable,
  readLastSleep,
  readLastWorkout,
  requestHydrationAuthorization,
  writeWaterMl,
} from '@/health/healthkit';
import type { SleepSummary, WorkoutSummary } from '@/health/healthkit';
import type { DrinkSource } from '@/store/types';
import { localDayKey } from '@/store/types';

export type HealthReminderKind = 'workout' | 'wake' | 'idle';

export type ScheduledNudge = {
  kind: HealthReminderKind;
  key: string;
  scheduledFor: number;
};

export type HealthRemindersOptions = {
  lastDrinkAt: number | null;
  todayMl: number;
  addDrink?: (ml: number, source: DrinkSource) => Promise<unknown>;
  enabled?: boolean;
  pollIntervalMs?: number;
  idleGapMs?: number;
};

export type HealthReminders = {
  healthAuthorized: boolean;
  notificationsAllowed: boolean;
  lastCheckedAt: number | null;
  lastNudge: ScheduledNudge | null;
  lastWorkout: WorkoutSummary | null;
  lastSleep: SleepSummary | null;
  checkNow: () => Promise<void>;
  logDrinkMl: (ml: number) => Promise<void>;
};

export const HEALTH_REMINDER_KIND = 'health-reminder';
export const HEALTH_REMINDER_CHANNEL = 'health-reminders';

const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_IDLE_GAP_MS = 90 * 60 * 1000;
const WORKOUT_FRESH_WINDOW_MS = 3 * 60 * 60 * 1000;
const WORKOUT_NUDGE_DELAY_MS = 10 * 60 * 1000;
const WAKE_FRESH_WINDOW_MS = 4 * 60 * 60 * 1000;
const MIN_LEAD_MS = 60 * 1000;
const WORKOUT_TOP_UP_ML = 500;
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 7;

const DB_NAME = 'icup-health-reminders.db';
const CREATE_MARKS = 'CREATE TABLE IF NOT EXISTS reminder_marks (mark_key TEXT PRIMARY KEY NOT NULL, at INTEGER NOT NULL)';

const firedThisSession = new Set<string>();

let marksDb: Promise<SQLite.SQLiteDatabase> | null = null;

const openMarks = (): Promise<SQLite.SQLiteDatabase> => {
  if (!marksDb) {
    marksDb = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(CREATE_MARKS);
      return db;
    });
  }
  return marksDb;
};

const hasFired = async (key: string): Promise<boolean> => {
  if (firedThisSession.has(key)) return true;
  try {
    const db = await openMarks();
    const row = await db.getFirstAsync<{ at: number }>(
      'SELECT at FROM reminder_marks WHERE mark_key = ?',
      key,
    );
    return row !== null;
  } catch {
    marksDb = null;
    return false;
  }
};

const markFired = async (key: string, at: number): Promise<void> => {
  firedThisSession.add(key);
  try {
    const db = await openMarks();
    await db.runAsync('INSERT OR REPLACE INTO reminder_marks (mark_key, at) VALUES (?, ?)', key, at);
  } catch {
    marksDb = null;
  }
};

const isQuietHour = (at: number): boolean => {
  const hour = new Date(at).getHours();
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
};

const startOfLocalDay = (at: number): number => {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const copyFor = (kind: HealthReminderKind): { title: string; body: string } => {
  if (kind === 'workout') {
    return {
      title: 'Nice workout',
      body: `Drink ${WORKOUT_TOP_UP_ML} ml to replace what you sweated out.`,
    };
  }
  if (kind === 'wake') {
    return { title: 'Good morning', body: 'Start the day with a glass of water.' };
  }
  return { title: 'Water check', body: 'It has been a while since your last sip.' };
};

const ensureChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(HEALTH_REMINDER_CHANNEL, {
      name: 'Health reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {
    return;
  }
};

const ensureNotificationPermission = async (): Promise<boolean> => {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
};

const scheduleNudge = async (
  kind: HealthReminderKind,
  key: string,
  fireAt: number,
): Promise<ScheduledNudge | null> => {
  const { title, body } = copyFor(kind);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: { kind: HEALTH_REMINDER_KIND, reason: kind, key },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAt),
        ...(Platform.OS === 'android' ? { channelId: HEALTH_REMINDER_CHANNEL } : {}),
      },
    });
    return { kind, key, scheduledFor: fireAt };
  } catch {
    return null;
  }
};

const planWorkoutNudge = async (
  now: number,
  workout: WorkoutSummary | null,
): Promise<ScheduledNudge | null> => {
  if (!workout) return null;
  if (now - workout.endedAt > WORKOUT_FRESH_WINDOW_MS) return null;
  const key = `workout:${workout.endedAt}`;
  if (await hasFired(key)) return null;
  const fireAt = Math.max(workout.endedAt + WORKOUT_NUDGE_DELAY_MS, now + MIN_LEAD_MS);
  await markFired(key, now);
  if (isQuietHour(fireAt)) return null;
  return scheduleNudge('workout', key, fireAt);
};

const planWakeNudge = async (
  now: number,
  lastDrinkAt: number | null,
  todayMl: number,
  sleep: SleepSummary | null,
): Promise<ScheduledNudge | null> => {
  const today = localDayKey(now);
  if (todayMl > 0) return null;
  if (lastDrinkAt !== null && localDayKey(lastDrinkAt) === today) return null;
  if (!sleep) return null;
  if (localDayKey(sleep.wokeAt) !== today) return null;
  if (now - sleep.wokeAt > WAKE_FRESH_WINDOW_MS) return null;
  const key = `wake:${today}`;
  if (await hasFired(key)) return null;
  const fireAt = now + MIN_LEAD_MS;
  await markFired(key, now);
  if (isQuietHour(fireAt)) return null;
  return scheduleNudge('wake', key, fireAt);
};

const planIdleNudge = async (
  now: number,
  lastDrinkAt: number | null,
  idleGapMs: number,
): Promise<ScheduledNudge | null> => {
  const since = lastDrinkAt ?? startOfLocalDay(now);
  const elapsed = now - since;
  if (elapsed < idleGapMs) return null;
  const slot = Math.floor(elapsed / idleGapMs);
  const key = `idle:${since}:${slot}`;
  if (await hasFired(key)) return null;
  const fireAt = now + MIN_LEAD_MS;
  await markFired(key, now);
  if (isQuietHour(fireAt)) return null;
  return scheduleNudge('idle', key, fireAt);
};

export const useHealthReminders = (options: HealthRemindersOptions): HealthReminders => {
  const {
    lastDrinkAt,
    todayMl,
    addDrink,
    enabled = true,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    idleGapMs = DEFAULT_IDLE_GAP_MS,
  } = options;

  const [healthAuthorized, setHealthAuthorized] = useState(false);
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [lastNudge, setLastNudge] = useState<ScheduledNudge | null>(null);
  const [lastWorkout, setLastWorkout] = useState<WorkoutSummary | null>(null);
  const [lastSleep, setLastSleep] = useState<SleepSummary | null>(null);

  const latest = useRef({ lastDrinkAt, todayMl, enabled, idleGapMs });

  useEffect(() => {
    latest.current = { lastDrinkAt, todayMl, enabled, idleGapMs };
  }, [lastDrinkAt, todayMl, enabled, idleGapMs]);

  const running = useRef(false);
  const readyPromise = useRef<Promise<boolean> | null>(null);

  const prepare = useCallback((): Promise<boolean> => {
    if (!readyPromise.current) {
      readyPromise.current = (async () => {
        await ensureChannel();
        const allowed = await ensureNotificationPermission();
        setNotificationsAllowed(allowed);
        if (isHealthAvailable()) {
          const granted = await requestHydrationAuthorization();
          setHealthAuthorized(granted);
        }
        return allowed;
      })();
    }
    return readyPromise.current;
  }, []);

  const checkNow = useCallback(async () => {
    if (!latest.current.enabled || running.current) return;
    running.current = true;
    try {
      const allowed = await prepare();
      const now = Date.now();
      setLastCheckedAt(now);
      const [workout, sleep] = await Promise.all([readLastWorkout(), readLastSleep()]);
      setLastWorkout(workout);
      setLastSleep(sleep);
      if (!allowed) return;
      const nudge =
        (await planWorkoutNudge(now, workout)) ??
        (await planWakeNudge(now, latest.current.lastDrinkAt, latest.current.todayMl, sleep)) ??
        (await planIdleNudge(now, latest.current.lastDrinkAt, latest.current.idleGapMs));
      if (nudge) setLastNudge(nudge);
    } finally {
      running.current = false;
    }
  }, [prepare]);

  const logDrinkMl = useCallback(
    async (ml: number) => {
      const volume = Math.round(ml);
      if (!Number.isFinite(volume) || volume <= 0) return;
      const at = Date.now();
      if (addDrink) await addDrink(volume, 'health');
      await writeWaterMl(volume, at);
    },
    [addDrink],
  );

  useEffect(() => {
    if (!enabled) return;
    checkNow();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkNow();
    });
    const timer = setInterval(checkNow, pollIntervalMs);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [checkNow, enabled, pollIntervalMs]);

  return {
    healthAuthorized,
    notificationsAllowed,
    lastCheckedAt,
    lastNudge,
    lastWorkout,
    lastSleep,
    checkNow,
    logDrinkMl,
  };
};
