export type DrinkSource = 'cup' | 'manual' | 'health';

export type DrinkEvent = {
  id: string;
  at: number;
  ml: number;
  source: DrinkSource;
};

export type DayTotal = {
  day: string;
  ml: number;
};

export type HydrationStore = {
  ready: boolean;
  todayMl: number;
  dailyGoalMl: number;
  lastDrinkAt: number | null;
  addDrink: (ml: number, source: DrinkSource) => Promise<DrinkEvent>;
  removeDrink: (id: string) => Promise<void>;
  setDailyGoal: (ml: number) => Promise<void>;
  dayTotals: (fromDay: string, toDay: string) => DayTotal[];
  eventsSince: (at: number) => DrinkEvent[];
};

export const localDayKey = (at: number): string => {
  const date = new Date(at);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};
