import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

type HydrationDevState = {
  waterDrank: number;
  setWaterDrank: Dispatch<SetStateAction<number>>;
  dailyGoal: number;
  setDailyGoal: Dispatch<SetStateAction<number>>;
  minutesSinceDrink: number;
  setMinutesSinceDrink: Dispatch<SetStateAction<number>>;
  isICupConnected: boolean;
  setIsICupConnected: Dispatch<SetStateAction<boolean>>;
  icupBattery: number;
  setICupBattery: Dispatch<SetStateAction<number>>;
};

const HydrationDevContext = createContext<HydrationDevState | null>(null);

export function HydrationDevStateProvider({ children }: { children: ReactNode }) {
  const [waterDrank, setWaterDrank] = useState(1250);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [minutesSinceDrink, setMinutesSinceDrink] = useState(32);
  const [isICupConnected, setIsICupConnected] = useState(false);
  const [icupBattery, setICupBattery] = useState(82);

  return (
    <HydrationDevContext.Provider value={{
      waterDrank,
      setWaterDrank,
      dailyGoal,
      setDailyGoal,
      minutesSinceDrink,
      setMinutesSinceDrink,
      isICupConnected,
      setIsICupConnected,
      icupBattery,
      setICupBattery,
    }}>
      {children}
    </HydrationDevContext.Provider>
  );
}

export function useHydrationDevState() {
  const state = useContext(HydrationDevContext);
  if (!state) throw new Error('useHydrationDevState must be used within HydrationDevStateProvider');
  return state;
}
