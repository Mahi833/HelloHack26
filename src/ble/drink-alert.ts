export type DrinkAlertInput = {
  remindersEnabled: boolean;
  lastDrinkAt: number | null;
  now: number;
  intervalMinutes: number;
  goalReached: boolean;
};

const MS_PER_MINUTE = 60000;

export const shouldAlertToDrink = ({
  remindersEnabled,
  lastDrinkAt,
  now,
  intervalMinutes,
  goalReached,
}: DrinkAlertInput): boolean => {
  if (!remindersEnabled || goalReached || intervalMinutes <= 0) return false;
  if (lastDrinkAt === null) return true;
  return now - lastDrinkAt >= intervalMinutes * MS_PER_MINUTE;
};
