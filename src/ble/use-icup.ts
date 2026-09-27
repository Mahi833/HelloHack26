import { useEffect, useMemo, useRef, useState } from 'react';

import { createSipDetector, FILTER_WINDOW_SAMPLES } from '@/ble/sip-detector';
import type { ScaleSample } from '@/ble/weight-payload';
import type { DrinkEvent, DrinkSource } from '@/store/types';

const SIMULATED_SAMPLE_INTERVAL_MS = 250;
const SIMULATED_BATTERY_PCT = 87;
const SIMULATED_JITTER_G = 2;
const SIMULATED_MIN_SAMPLES_PER_STEP = FILTER_WINDOW_SAMPLES + 4;

export type AddDrink = (ml: number, source: DrinkSource) => Promise<DrinkEvent>;

export type IcupStatus = {
  connected: boolean;
  weightG: number | null;
  batteryPct: number | null;
  error: string | null;
};

export type WeightSink = {
  weight: (grams: number) => void;
  connected: (value: boolean) => void;
  battery: (percent: number | null) => void;
  failed: (message: string | null) => void;
};

export type WeightSource = (sink: WeightSink) => () => void;

export type UseIcupOptions = {
  addDrink: AddDrink;
  source: WeightSource;
  enabled?: boolean;
};

export type UseIcupSipsOptions = {
  addDrink: AddDrink;
  sample: ScaleSample | null;
  connected: boolean;
};

const describeError = (cause: unknown): string => {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }
  if (typeof cause === 'string' && cause.length > 0) {
    return cause;
  }
  return 'iCup hit an unknown Bluetooth error';
};

export type SimulatedCupOptions = {
  startG?: number;
  sipG?: number;
  emptyAtG?: number;
  intervalMs?: number;
  samplesPerStep?: number;
};

export const createSimulatedWeightSource =
  (options: SimulatedCupOptions = {}): WeightSource =>
  (sink) => {
    const startG = options.startG ?? 520;
    const sipG = options.sipG ?? 60;
    const emptyAtG = options.emptyAtG ?? 100;
    const intervalMs = options.intervalMs ?? SIMULATED_SAMPLE_INTERVAL_MS;
    const samplesPerStep = Math.max(
      SIMULATED_MIN_SAMPLES_PER_STEP,
      options.samplesPerStep ?? SIMULATED_MIN_SAMPLES_PER_STEP,
    );

    let level = startG;
    let heldSamples = 0;

    const jitter = () => (Math.random() - 0.5) * SIMULATED_JITTER_G;

    sink.failed(null);
    sink.battery(SIMULATED_BATTERY_PCT);
    sink.connected(true);
    sink.weight(level);

    const timer = setInterval(() => {
      heldSamples += 1;
      if (heldSamples < samplesPerStep) {
        sink.weight(level + jitter());
        return;
      }
      heldSamples = 0;
      level = level - sipG < emptyAtG ? startG : level - sipG;
      sink.weight(level);
    }, intervalMs);

    return () => {
      clearInterval(timer);
      sink.connected(false);
    };
  };

export const useIcup = ({ addDrink, source, enabled = true }: UseIcupOptions): IcupStatus => {
  const [connected, setConnected] = useState(false);
  const [weightG, setWeightG] = useState<number | null>(null);
  const [batteryPct, setBatteryPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addDrinkRef = useRef(addDrink);

  useEffect(() => {
    addDrinkRef.current = addDrink;
  }, [addDrink]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const detector = createSipDetector();
    let live = true;

    const sink: WeightSink = {
      weight: (grams) => {
        if (!live) {
          return;
        }
        setWeightG(grams);
        const ml = detector.push(grams);
        if (ml === null) {
          return;
        }
        addDrinkRef.current(ml, 'cup').catch((cause: unknown) => {
          if (live) {
            setError(describeError(cause));
          }
        });
      },
      connected: (value) => {
        if (live) {
          setConnected(value);
        }
      },
      battery: (percent) => {
        if (live) {
          setBatteryPct(percent);
        }
      },
      failed: (message) => {
        if (live) {
          setError(message);
        }
      },
    };

    const stop = source(sink);

    return () => {
      live = false;
      stop();
      detector.reset();
    };
  }, [enabled, source]);

  return enabled
    ? { connected, weightG, batteryPct, error }
    : { connected: false, weightG: null, batteryPct: null, error: null };
};

export const useIcupSips = ({ addDrink, sample, connected }: UseIcupSipsOptions): string | null => {
  const [error, setError] = useState<string | null>(null);

  const addDrinkRef = useRef(addDrink);
  const detectorRef = useRef<ReturnType<typeof createSipDetector> | null>(null);

  useEffect(() => {
    addDrinkRef.current = addDrink;
  }, [addDrink]);

  useEffect(() => {
    if (!connected) {
      detectorRef.current?.reset();
      detectorRef.current = null;
      return;
    }
    detectorRef.current = createSipDetector();
    return () => {
      detectorRef.current?.reset();
      detectorRef.current = null;
    };
  }, [connected]);

  useEffect(() => {
    const detector = detectorRef.current;
    if (detector === null || sample === null) {
      return;
    }
    const ml = detector.push(sample.grams);
    if (ml === null) {
      return;
    }
    let live = true;
    addDrinkRef.current(ml, 'cup')
      .then(() => {
        if (live) {
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (live) {
          setError(describeError(cause));
        }
      });
    return () => {
      live = false;
    };
  }, [sample]);

  return connected ? error : null;
};

export const useSimulatedIcup = (
  addDrink: AddDrink,
  options: SimulatedCupOptions = {},
  enabled = true,
): IcupStatus => {
  const source = useMemo(
    () =>
      createSimulatedWeightSource({
        startG: options.startG,
        sipG: options.sipG,
        emptyAtG: options.emptyAtG,
        intervalMs: options.intervalMs,
        samplesPerStep: options.samplesPerStep,
      }),
    [
      options.startG,
      options.sipG,
      options.emptyAtG,
      options.intervalMs,
      options.samplesPerStep,
    ],
  );
  return useIcup({ addDrink, source, enabled });
};
