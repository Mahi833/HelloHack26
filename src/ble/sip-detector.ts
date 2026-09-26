export const NOISE_FLOOR_G = 20;
export const LIFT_OFF_LIMIT_G = 1200;
export const CUP_ABSENT_BELOW_G = 30;
export const CONFIRMATION_SAMPLES = 2;

export type SipDetectorSnapshot = {
  baselineG: number | null;
  candidateG: number | null;
  candidateSamples: number;
  cupPresent: boolean;
};

export type SipDetector = {
  push: (weightG: number) => number | null;
  reset: () => void;
  snapshot: () => SipDetectorSnapshot;
};

export const createSipDetector = (): SipDetector => {
  let baselineG: number | null = null;
  let candidateG: number | null = null;
  let candidateSamples = 0;
  let cupPresent = true;

  const forgetCandidate = () => {
    candidateG = null;
    candidateSamples = 0;
  };

  const push = (weightG: number): number | null => {
    if (!Number.isFinite(weightG)) {
      return null;
    }

    if (weightG < CUP_ABSENT_BELOW_G) {
      cupPresent = false;
      forgetCandidate();
      return null;
    }

    if (!cupPresent) {
      cupPresent = true;
      baselineG = weightG;
      forgetCandidate();
      return null;
    }

    if (baselineG === null) {
      baselineG = weightG;
      return null;
    }

    const lostG = baselineG - weightG;

    if (Math.abs(lostG) > LIFT_OFF_LIMIT_G) {
      forgetCandidate();
      return null;
    }

    if (lostG <= -NOISE_FLOOR_G) {
      baselineG = weightG;
      forgetCandidate();
      return null;
    }

    if (lostG < NOISE_FLOOR_G) {
      forgetCandidate();
      return null;
    }

    const settled =
      candidateG !== null && Math.abs(candidateG - weightG) < NOISE_FLOOR_G;

    if (!settled) {
      candidateG = weightG;
      candidateSamples = 1;
      return null;
    }

    candidateSamples += 1;
    if (candidateSamples < CONFIRMATION_SAMPLES) {
      return null;
    }

    const ml = Math.round(lostG);
    baselineG = weightG;
    forgetCandidate();
    return ml;
  };

  return {
    push,
    reset: () => {
      baselineG = null;
      cupPresent = true;
      forgetCandidate();
    },
    snapshot: () => ({ baselineG, candidateG, candidateSamples, cupPresent }),
  };
};
