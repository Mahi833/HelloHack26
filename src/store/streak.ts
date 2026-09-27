import type { DayTotal } from '@/store/types';

export type StreakSummary = {
  current: number;
  best: number;
};

const pad = (value: number): string => `${value}`.padStart(2, '0');

const dayBefore = (day: string): string => {
  const [year, month, date] = day.split('-').map(Number);
  const previous = new Date(year, month - 1, date - 1);
  return `${previous.getFullYear()}-${pad(previous.getMonth() + 1)}-${pad(previous.getDate())}`;
};

export const computeStreak = (
  totals: DayTotal[],
  dailyGoalMl: number,
  todayKey: string,
): StreakSummary => {
  if (dailyGoalMl <= 0) return { current: 0, best: 0 };

  const met = new Set(totals.filter((entry) => entry.ml >= dailyGoalMl).map((entry) => entry.day));

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...met].sort()) {
    run = previous !== null && dayBefore(day) === previous ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  let cursor = met.has(todayKey) ? todayKey : dayBefore(todayKey);
  let current = 0;
  while (met.has(cursor)) {
    current += 1;
    cursor = dayBefore(cursor);
  }

  return { current, best: Math.max(best, current) };
};
