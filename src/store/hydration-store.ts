import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import {
  insertDrinkEventAsync,
  readDrinkEventsAsync,
  readSettingAsync,
  writeSettingAsync,
} from '@/store/db';
import { localDayKey, type DayTotal, type DrinkEvent, type DrinkSource, type HydrationStore } from '@/store/types';

const DAILY_GOAL_SETTING_KEY = 'daily_goal_ml';
const DEFAULT_DAILY_GOAL_ML = 2000;
const MIN_MIDNIGHT_DELAY_MS = 1000;
const CLOCK_TICK_MS = 30000;

type StoreSnapshot = {
  ready: boolean;
  events: DrinkEvent[];
  dailyGoalMl: number;
};

let snapshot: StoreSnapshot = {
  ready: false,
  events: [],
  dailyGoalMl: DEFAULT_DAILY_GOAL_ML,
};

const listeners = new Set<() => void>();

const publish = (next: StoreSnapshot) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

const parseDailyGoal = (stored: string | null): number => {
  const parsed = stored === null ? Number.NaN : Number.parseInt(stored, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_GOAL_ML;
};

let loadPromise: Promise<void> | null = null;

const loadAsync = async (): Promise<void> => {
  try {
    const [events, storedGoal] = await Promise.all([
      readDrinkEventsAsync(),
      readSettingAsync(DAILY_GOAL_SETTING_KEY),
    ]);
    publish({ ready: true, events, dailyGoalMl: parseDailyGoal(storedGoal) });
  } catch (error) {
    console.warn('Hydration store could not read saved drinks', error);
    publish({ ...snapshot, ready: true });
  }
};

const ensureLoaded = (): Promise<void> => {
  loadPromise ??= loadAsync();
  return loadPromise;
};

let eventSequence = 0;

const nextEventId = (at: number): string => {
  eventSequence += 1;
  const noise = Math.floor(Math.random() * 0xffffff).toString(36);
  return `${at.toString(36)}-${eventSequence.toString(36)}-${noise}`;
};

const withEvent = (events: DrinkEvent[], event: DrinkEvent): DrinkEvent[] =>
  [event, ...events].sort((first, second) => second.at - first.at);

const requirePositiveMl = (ml: number, label: string): number => {
  const amount = Math.round(ml);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} requires a positive whole number of millilitres`);
  }
  return amount;
};

const addDrink = async (ml: number, source: DrinkSource): Promise<DrinkEvent> => {
  const amount = requirePositiveMl(ml, 'addDrink');
  await ensureLoaded();
  const at = Date.now();
  const event: DrinkEvent = { id: nextEventId(at), at, ml: amount, source };
  await insertDrinkEventAsync(event);
  publish({ ...snapshot, events: withEvent(snapshot.events, event) });
  return event;
};

const setDailyGoal = async (ml: number): Promise<void> => {
  const goal = requirePositiveMl(ml, 'setDailyGoal');
  await ensureLoaded();
  await writeSettingAsync(DAILY_GOAL_SETTING_KEY, `${goal}`);
  publish({ ...snapshot, dailyGoalMl: goal });
};

const computeDayTotals = (events: DrinkEvent[], fromDay: string, toDay: string): DayTotal[] => {
  const totals = new Map<string, number>();
  events.forEach((event) => {
    const day = localDayKey(event.at);
    if (day < fromDay || day > toDay) return;
    totals.set(day, (totals.get(day) ?? 0) + event.ml);
  });
  return [...totals.entries()]
    .map(([day, ml]) => ({ day, ml }))
    .sort((first, second) => (first.day < second.day ? -1 : 1));
};

export const useClock = (): number => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return now;
};

const useLocalDayKey = (): string => {
  const [dayKey, setDayKey] = useState(() => localDayKey(Date.now()));

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const delay = Math.max(MIN_MIDNIGHT_DELAY_MS, nextMidnight - now.getTime());
    const timer = setTimeout(() => setDayKey(localDayKey(Date.now())), delay);
    return () => clearTimeout(timer);
  }, [dayKey]);

  return dayKey;
};

const useHydrationStoreEngine = (): HydrationStore => {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const dayKey = useLocalDayKey();

  useEffect(() => {
    void ensureLoaded();
  }, []);

  return useMemo(
    () => ({
      ready: current.ready,
      todayMl: current.events.reduce(
        (sum, event) => (localDayKey(event.at) === dayKey ? sum + event.ml : sum),
        0,
      ),
      dailyGoalMl: current.dailyGoalMl,
      lastDrinkAt: current.events.length > 0 ? current.events[0].at : null,
      addDrink,
      setDailyGoal,
      dayTotals: (fromDay: string, toDay: string) => computeDayTotals(current.events, fromDay, toDay),
      eventsSince: (at: number) => current.events.filter((event) => event.at >= at),
    }),
    [current, dayKey],
  );
};

const HydrationStoreContext = createContext<HydrationStore | null>(null);

export function HydrationStoreProvider({ children }: { children: ReactNode }) {
  const store = useHydrationStoreEngine();
  return createElement(HydrationStoreContext.Provider, { value: store }, children);
}

export function useHydrationStore(): HydrationStore {
  const provided = useContext(HydrationStoreContext);
  const fallback = useHydrationStoreEngine();
  return provided ?? fallback;
}
