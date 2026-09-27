export const NOISE_FLOOR_G = 20;
export const LIFT_OFF_LIMIT_G = 1200;
export const CUP_ABSENT_BELOW_G = 30;
export const FILTER_WINDOW_SAMPLES = 8;
export const STABILITY_SPREAD_G = 10;
export const REFILL_HOLD_SAMPLES = 16;
export const REFILL_RATIO = 1.5;
export const REFILL_MIN_BASELINE_G = 50;
export const REFILL_REVERT_GRACE_SAMPLES = 16;

export type SipDetectorSnapshot = {
  baselineG: number | null;
  settledG: number | null;
  revertToG: number | null;
  cupPresent: boolean;
  windowFilled: boolean;
  elevatedSamples: number;
};

export type SipDetector = {
  push: (weightG: number) => number | null;
  reset: () => void;
  snapshot: () => SipDetectorSnapshot;
};

const medianOf = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

const spreadOf = (values: number[]): number => {
  let lowest = values[0];
  let highest = values[0];
  for (const value of values) {
    if (value < lowest) {
      lowest = value;
    }
    if (value > highest) {
      highest = value;
    }
  }
  return highest - lowest;
};

export const createSipDetector = (): SipDetector => {
  const recent: number[] = [];
  let baselineG: number | null = null;
  let baselineAnchored = false;
  let settledG: number | null = null;
  let cupPresent = true;
  let elevatedSamples = 0;
  let revertToG: number | null = null;
  let revertGraceLeft = 0;

  const clearWindow = () => {
    recent.length = 0;
    settledG = null;
  };

  const disarmRevert = () => {
    revertToG = null;
    revertGraceLeft = 0;
  };

  const armRevert = (previousBaselineG: number) => {
    revertToG = previousBaselineG;
    revertGraceLeft = REFILL_REVERT_GRACE_SAMPLES;
  };

  const push = (weightG: number): number | null => {
    if (!Number.isFinite(weightG)) {
      return null;
    }

    if (weightG < CUP_ABSENT_BELOW_G) {
      cupPresent = false;
      elevatedSamples = 0;
      disarmRevert();
      clearWindow();
      return null;
    }

    if (!cupPresent) {
      cupPresent = true;
      elevatedSamples = 0;
      disarmRevert();
      clearWindow();
      baselineG = weightG;
      baselineAnchored = false;
      return null;
    }

    if (baselineG === null) {
      baselineG = weightG;
      baselineAnchored = false;
    }

    elevatedSamples = weightG - baselineG >= NOISE_FLOOR_G ? elevatedSamples + 1 : 0;

    if (revertToG !== null && Math.abs(weightG - baselineG) > NOISE_FLOOR_G) {
      revertGraceLeft -= 1;
      if (revertGraceLeft <= 0) {
        disarmRevert();
      }
    }

    recent.push(weightG);
    if (recent.length > FILTER_WINDOW_SAMPLES) {
      recent.shift();
    }
    if (recent.length < FILTER_WINDOW_SAMPLES) {
      return null;
    }

    if (spreadOf(recent) > STABILITY_SPREAD_G) {
      settledG = null;
      return null;
    }

    const median = medianOf(recent);
    settledG = median;

    if (!baselineAnchored) {
      baselineG = median;
      baselineAnchored = true;
      return null;
    }

    if (revertToG !== null && Math.abs(median - revertToG) <= NOISE_FLOOR_G) {
      baselineG = revertToG;
      elevatedSamples = 0;
      disarmRevert();
      return null;
    }

    const risenG = median - baselineG;

    if (risenG >= NOISE_FLOOR_G) {
      const scaledRefill =
        baselineG >= REFILL_MIN_BASELINE_G && median >= baselineG * REFILL_RATIO;
      if (!scaledRefill && risenG > LIFT_OFF_LIMIT_G) {
        return null;
      }
      if (elevatedSamples >= REFILL_HOLD_SAMPLES) {
        armRevert(baselineG);
        baselineG = median;
        elevatedSamples = 0;
      }
      return null;
    }

    const lostG = -risenG;
    if (lostG < NOISE_FLOOR_G || lostG > LIFT_OFF_LIMIT_G) {
      return null;
    }

    baselineG = median;
    disarmRevert();
    return Math.round(lostG);
  };

  return {
    push,
    reset: () => {
      baselineG = null;
      baselineAnchored = false;
      cupPresent = true;
      elevatedSamples = 0;
      disarmRevert();
      clearWindow();
    },
    snapshot: () => ({
      baselineG,
      settledG,
      revertToG,
      cupPresent,
      windowFilled: recent.length === FILTER_WINDOW_SAMPLES,
      elevatedSamples,
    }),
  };
};
