import {
  getMostRecentWorkout,
  isHealthDataAvailable,
  queryCategorySamples,
  requestAuthorization,
  saveQuantitySample,
  CategoryValueSleepAnalysis,
} from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';

export type WorkoutIntensity = 'easy' | 'moderate' | 'hard';

export type WorkoutSummary = {
  endedAt: number;
  durationMinutes: number;
  activeEnergyKcal: number | null;
  intensity: WorkoutIntensity;
};

export type SleepSummary = {
  wokeAt: number;
};

const WATER_IDENTIFIER = 'HKQuantityTypeIdentifierDietaryWater';
const SLEEP_IDENTIFIER = 'HKCategoryTypeIdentifierSleepAnalysis';
const WORKOUT_IDENTIFIER = 'HKWorkoutTypeIdentifier';

const MILLILITRE_UNIT = 'mL';

const SLEEP_LOOKBACK_MS = 48 * 60 * 60 * 1000;
const SLEEP_SAMPLE_LIMIT = 120;

const ASLEEP_VALUES: readonly number[] = [
  CategoryValueSleepAnalysis.asleepUnspecified,
  CategoryValueSleepAnalysis.asleepCore,
  CategoryValueSleepAnalysis.asleepDeep,
  CategoryValueSleepAnalysis.asleepREM,
];

const EASY_KCAL_PER_MINUTE = 4;
const MODERATE_KCAL_PER_MINUTE = 9;
const MODERATE_MINUTES_WITHOUT_ENERGY = 45;

export const HYDRATION_READ_TYPES = [
  WORKOUT_IDENTIFIER,
  SLEEP_IDENTIFIER,
  WATER_IDENTIFIER,
] as const;

export const HYDRATION_WRITE_TYPES = [WATER_IDENTIFIER] as const;

export const isHealthAvailable = (): boolean => {
  if (Platform.OS !== 'ios') return false;
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
};

export const requestHydrationAuthorization = async (): Promise<boolean> => {
  if (!isHealthAvailable()) return false;
  try {
    return await requestAuthorization({
      toRead: HYDRATION_READ_TYPES,
      toShare: HYDRATION_WRITE_TYPES,
    });
  } catch {
    return false;
  }
};

export const writeWaterMl = async (ml: number, at: number): Promise<boolean> => {
  const volume = Math.round(ml);
  if (!Number.isFinite(volume) || volume <= 0) return false;
  if (!isHealthAvailable()) return false;
  try {
    const when = new Date(at);
    const saved = await saveQuantitySample(WATER_IDENTIFIER, MILLILITRE_UNIT, volume, when, when);
    return saved !== undefined;
  } catch {
    return false;
  }
};

const classifyIntensity = (kcal: number | null, minutes: number): WorkoutIntensity => {
  if (kcal === null || minutes <= 0) {
    return minutes >= MODERATE_MINUTES_WITHOUT_ENERGY ? 'moderate' : 'easy';
  }
  const rate = kcal / minutes;
  if (rate < EASY_KCAL_PER_MINUTE) return 'easy';
  if (rate < MODERATE_KCAL_PER_MINUTE) return 'moderate';
  return 'hard';
};

export const readLastWorkout = async (): Promise<WorkoutSummary | null> => {
  if (!isHealthAvailable()) return null;
  try {
    const workout = await getMostRecentWorkout();
    if (!workout) return null;
    const endedAt = workout.endDate.getTime();
    const startedAt = workout.startDate.getTime();
    if (!Number.isFinite(endedAt)) return null;
    const durationMinutes = Math.max(0, Math.round((endedAt - startedAt) / 60000));
    const energy = workout.totalEnergyBurned;
    const activeEnergyKcal = energy ? Math.round(energy.quantity) : null;
    return {
      endedAt,
      durationMinutes,
      activeEnergyKcal,
      intensity: classifyIntensity(activeEnergyKcal, durationMinutes),
    };
  } catch {
    return null;
  }
};

export const readLastSleep = async (): Promise<SleepSummary | null> => {
  if (!isHealthAvailable()) return null;
  try {
    const samples = await queryCategorySamples(SLEEP_IDENTIFIER, {
      limit: SLEEP_SAMPLE_LIMIT,
      ascending: false,
      filter: { date: { startDate: new Date(Date.now() - SLEEP_LOOKBACK_MS) } },
    });
    let wokeAt = 0;
    let inBedWokeAt = 0;
    for (const sample of samples) {
      const endedAt = sample.endDate.getTime();
      if (!Number.isFinite(endedAt)) continue;
      if (ASLEEP_VALUES.includes(sample.value)) {
        if (endedAt > wokeAt) wokeAt = endedAt;
      } else if (sample.value === CategoryValueSleepAnalysis.inBed && endedAt > inBedWokeAt) {
        inBedWokeAt = endedAt;
      }
    }
    const resolved = wokeAt > 0 ? wokeAt : inBedWokeAt;
    return resolved > 0 ? { wokeAt: resolved } : null;
  } catch {
    return null;
  }
};
