import { BleManager } from '@sfourdrinier/react-native-ble-plx';
import type { Device, Subscription } from '@sfourdrinier/react-native-ble-plx';
import { Buffer } from 'buffer';
import { useEffect, useMemo, useRef, useState } from 'react';

import { createSipDetector, FILTER_WINDOW_SAMPLES } from '@/ble/sip-detector';
import type { DrinkEvent, DrinkSource } from '@/store/types';

export const ICUP_DEVICE_NAME = 'iCup';
export const ICUP_SERVICE_UUID = 'a82f0001-4ef3-4b7a-9c2d-5bd3a1e0c101';
export const ICUP_WEIGHT_CHARACTERISTIC_UUID = 'a82f0002-4ef3-4b7a-9c2d-5bd3a1e0c101';

const RECONNECT_DELAY_MS = 1500;
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
  source?: WeightSource;
  enabled?: boolean;
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

export const parseWeightGrams = (base64Value: string | null): number | null => {
  if (base64Value === null || base64Value.length === 0) {
    return null;
  }
  try {
    const payload: unknown = JSON.parse(Buffer.from(base64Value, 'base64').toString('utf8'));
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }
    const grams = (payload as { weight_g?: unknown }).weight_g;
    return typeof grams === 'number' && Number.isFinite(grams) ? grams : null;
  } catch {
    return null;
  }
};

export const createBleWeightSource = (): WeightSource => (sink) => {
  const manager = new BleManager();
  let stopped = false;
  let scanning = false;
  let device: Device | null = null;
  let weightMonitor: Subscription | null = null;
  let disconnectWatcher: Subscription | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const ignore = () => undefined;

  const stopScan = () => {
    if (!scanning) {
      return;
    }
    scanning = false;
    manager.stopDeviceScan().catch(ignore);
  };

  const releaseDevice = () => {
    weightMonitor?.remove();
    weightMonitor = null;
    disconnectWatcher?.remove();
    disconnectWatcher = null;
    const identifier = device?.id;
    device = null;
    if (identifier !== undefined) {
      manager.cancelDeviceConnection(identifier).catch(ignore);
    }
  };

  const scheduleScan = () => {
    if (stopped || retryTimer !== null || scanning) {
      return;
    }
    retryTimer = setTimeout(() => {
      retryTimer = null;
      startScan();
    }, RECONNECT_DELAY_MS);
  };

  const attach = async (found: Device) => {
    try {
      const connected = await found.connect();
      const ready = await connected.discoverAllServicesAndCharacteristics();
      if (stopped) {
        manager.cancelDeviceConnection(ready.id).catch(ignore);
        return;
      }
      device = ready;
      disconnectWatcher = ready.onDisconnected(() => {
        if (stopped) {
          return;
        }
        sink.connected(false);
        sink.failed('iCup connection lost');
        releaseDevice();
        scheduleScan();
      });
      weightMonitor = manager.monitorCharacteristicForDevice(
        ready.id,
        ICUP_SERVICE_UUID,
        ICUP_WEIGHT_CHARACTERISTIC_UUID,
        (monitorError, characteristic) => {
          if (stopped) {
            return;
          }
          if (monitorError !== null) {
            sink.failed(describeError(monitorError));
            return;
          }
          const grams = parseWeightGrams(characteristic?.value ?? null);
          if (grams !== null) {
            sink.weight(grams);
          }
        },
      );
      sink.failed(null);
      sink.connected(true);
    } catch (cause) {
      if (stopped) {
        return;
      }
      sink.connected(false);
      sink.failed(describeError(cause));
      releaseDevice();
      scheduleScan();
    }
  };

  const startScan = () => {
    if (stopped || scanning || device !== null) {
      return;
    }
    scanning = true;
    manager
      .startDeviceScan([ICUP_SERVICE_UUID], null, (scanError, scanned) => {
        if (stopped) {
          return;
        }
        if (scanError !== null) {
          stopScan();
          sink.failed(describeError(scanError));
          scheduleScan();
          return;
        }
        if (scanned === null) {
          return;
        }
        stopScan();
        void attach(scanned);
      })
      .catch((cause: unknown) => {
        scanning = false;
        if (stopped) {
          return;
        }
        sink.failed(describeError(cause));
        scheduleScan();
      });
  };

  const stateWatcher = manager.onStateChange((state) => {
    if (stopped) {
      return;
    }
    if (state === 'PoweredOn') {
      sink.failed(null);
      startScan();
      return;
    }
    stopScan();
    sink.connected(false);
    if (state === 'PoweredOff') {
      sink.failed('Turn Bluetooth on to reach the iCup');
      releaseDevice();
      return;
    }
    if (state === 'Unauthorized') {
      sink.failed('Bluetooth permission was denied for this app');
      return;
    }
    if (state === 'Unsupported') {
      sink.failed('This device does not support Bluetooth Low Energy');
    }
  }, true);

  return () => {
    stopped = true;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    stateWatcher.remove();
    stopScan();
    releaseDevice();
    manager.destroy().catch(ignore);
  };
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

  const resolvedSource = useMemo(() => source ?? createBleWeightSource(), [source]);

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

    const stop = resolvedSource(sink);

    return () => {
      live = false;
      stop();
      detector.reset();
    };
  }, [enabled, resolvedSource]);

  return { connected, weightG, batteryPct, error };
};

export const useSimulatedIcup = (
  addDrink: AddDrink,
  options: SimulatedCupOptions = {},
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
  return useIcup({ addDrink, source });
};
