import type { BleManager, Subscription } from '@sfourdrinier/react-native-ble-plx';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

export const ICUP_SERVICE_UUID = '7a1e0001-5c2b-4e3a-9f6d-2b8c0a4d1e01';
export const ICUP_WEIGHT_UUID = '7a1e0002-5c2b-4e3a-9f6d-2b8c0a4d1e01';
export const ICUP_TARE_UUID = '7a1e0003-5c2b-4e3a-9f6d-2b8c0a4d1e01';

type IcupBleState = {
  isConnected: boolean;
  isWorking: boolean;
  latestWeightGrams: number | null;
  message: string;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  tare: () => Promise<void>;
};

type BrowserGattCharacteristic = {
  value?: DataView | null;
  startNotifications: () => Promise<BrowserGattCharacteristic>;
  writeValue: (value: Uint8Array) => Promise<void>;
  addEventListener: (type: string, listener: (event: { target?: { value?: DataView | null } | null }) => void) => void;
};

type BrowserGattService = {
  getCharacteristic: (uuid: string) => Promise<BrowserGattCharacteristic>;
};

type BrowserGattServer = {
  connected: boolean;
  connect: () => Promise<BrowserGattServer>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<BrowserGattService>;
};

type BrowserBluetoothDevice = {
  name?: string;
  gatt?: BrowserGattServer;
  addEventListener: (type: string, listener: () => void) => void;
};

type BrowserBluetooth = {
  requestDevice: (options: { filters: { services: string[] }[] }) => Promise<BrowserBluetoothDevice>;
};

const IcupBleContext = createContext<IcupBleState | null>(null);

function decodeBase64Ascii(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let decoded = '';
  for (let i = 0; i < value.length; i += 4) {
    const a = alphabet.indexOf(value[i] ?? 'A');
    const b = alphabet.indexOf(value[i + 1] ?? 'A');
    const c = value[i + 2] === '=' ? 0 : alphabet.indexOf(value[i + 2] ?? 'A');
    const d = value[i + 3] === '=' ? 0 : alphabet.indexOf(value[i + 3] ?? 'A');
    const combined = (a << 18) | (b << 12) | (c << 6) | d;
    decoded += String.fromCharCode((combined >> 16) & 0xff);
    if (value[i + 2] !== '=') decoded += String.fromCharCode((combined >> 8) & 0xff);
    if (value[i + 3] !== '=') decoded += String.fromCharCode(combined & 0xff);
  }
  return decoded;
}

async function requestBluetoothPermissions() {
  if (Platform.OS !== 'android') return true;

  const apiLevel = Number(Platform.Version);
  const permissions = apiLevel >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const requested = permissions.filter(Boolean);
  const results = await PermissionsAndroid.requestMultiple(requested);
  return requested.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
}

export function IcupBleProvider({ children }: { children: ReactNode }) {
  const managerRef = useRef<BleManager | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueSubscriptionRef = useRef<Subscription | null>(null);
  const disconnectSubscriptionRef = useRef<Subscription | null>(null);
  const browserDeviceRef = useRef<BrowserBluetoothDevice | null>(null);
  const browserTareCharacteristicRef = useRef<BrowserGattCharacteristic | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [latestWeightGrams, setLatestWeightGrams] = useState<number | null>(null);
  const [message, setMessage] = useState('Connect to SipBase to read the live scale.');

  const clearSubscriptions = useCallback(() => {
    valueSubscriptionRef.current?.remove();
    disconnectSubscriptionRef.current?.remove();
    valueSubscriptionRef.current = null;
    disconnectSubscriptionRef.current = null;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Load the native module only on iOS/Android so the web build never evaluates it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager: NativeBleManager } = require('@sfourdrinier/react-native-ble-plx') as {
      BleManager: new () => BleManager;
    };
    const manager = new NativeBleManager();
    managerRef.current = manager;
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      void manager.stopDeviceScan();
      clearSubscriptions();
      void manager.destroy();
      managerRef.current = null;
    };
  }, [clearSubscriptions]);

  const connect = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (isWorking || isConnected) return;
      const browserBluetooth = (navigator as Navigator & { bluetooth?: BrowserBluetooth }).bluetooth;
      if (!browserBluetooth) {
        setMessage('This browser does not support Bluetooth. Use Chrome or Edge on this computer.');
        return;
      }
      setIsWorking(true);
      setLatestWeightGrams(null);
      setMessage('Choose SipBase in the browser device picker…');
      try {
        // requestDevice must be called from the Connect button gesture in the browser.
        const device = await browserBluetooth.requestDevice({ filters: [{ services: [ICUP_SERVICE_UUID] }] });
        const server = await device.gatt?.connect();
        if (!server) throw new Error('Could not open the SipBase Bluetooth connection.');
        const service = await server.getPrimaryService(ICUP_SERVICE_UUID);
        const weightCharacteristic = await service.getCharacteristic(ICUP_WEIGHT_UUID);
        browserTareCharacteristicRef.current = await service.getCharacteristic(ICUP_TARE_UUID);
        await weightCharacteristic.startNotifications();
        weightCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
          const value = event.target?.value;
          if (!value) return;
          let textValue = '';
          for (let index = 0; index < value.byteLength; index += 1) {
            textValue += String.fromCharCode(value.getUint8(index));
          }
          const grams = Number.parseFloat(textValue);
          if (Number.isFinite(grams)) setLatestWeightGrams(grams);
        });
        device.addEventListener('gattserverdisconnected', () => {
          browserDeviceRef.current = null;
          browserTareCharacteristicRef.current = null;
          setIsConnected(false);
          setIsWorking(false);
          setMessage('SipBase disconnected.');
        });
        browserDeviceRef.current = device;
        setIsConnected(true);
        setIsWorking(false);
        setMessage(`Connected to ${device.name || 'SipBase'}. Live weight is in grams.`);
      } catch (connectionError) {
        setIsWorking(false);
        setMessage(connectionError instanceof Error ? connectionError.message : 'Could not connect to SipBase.');
      }
      return;
    }

    const manager = managerRef.current;
    if (!manager || isWorking || isConnected) return;
    setIsWorking(true);
    setLatestWeightGrams(null);

    try {
      const permitted = await requestBluetoothPermissions();
      if (!permitted) throw new Error('Bluetooth permission was not granted.');
      const bluetoothState = await manager.state();
      if (bluetoothState !== 'PoweredOn') throw new Error('Turn on Bluetooth, then try again.');

      setMessage('Scanning for SipBase…');
      let connecting = false;
      await manager.startDeviceScan([ICUP_SERVICE_UUID], null, (scanError, device) => {
        if (scanError) {
          if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
          scanTimerRef.current = null;
          setIsWorking(false);
          setMessage(scanError.message || 'Bluetooth scan failed.');
          return;
        }
        if (!device || connecting) return;
        connecting = true;
        if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
        void manager.stopDeviceScan();

        void (async () => {
          try {
            setMessage('Found SipBase. Connecting…');
            const connectedDevice = await manager.connectToDevice(device.id);
            await connectedDevice.discoverAllServicesAndCharacteristics();
            deviceIdRef.current = connectedDevice.id;
            clearSubscriptions();
            valueSubscriptionRef.current = manager.monitorCharacteristicForDevice(
              connectedDevice.id,
              ICUP_SERVICE_UUID,
              ICUP_WEIGHT_UUID,
              (valueError, characteristic) => {
                if (valueError) {
                  setMessage(valueError.message || 'Lost the live weight stream.');
                  return;
                }
                if (!characteristic?.value) return;
                const grams = Number.parseFloat(decodeBase64Ascii(characteristic.value));
                if (Number.isFinite(grams)) setLatestWeightGrams(grams);
              },
            );
            disconnectSubscriptionRef.current = manager.onDeviceDisconnected(connectedDevice.id, () => {
              clearSubscriptions();
              deviceIdRef.current = null;
              setIsConnected(false);
              setIsWorking(false);
              setMessage('SipBase disconnected.');
            });
            setIsConnected(true);
            setMessage('Connected to SipBase. Live weight is in grams.');
            setIsWorking(false);
          } catch (connectionError) {
            deviceIdRef.current = null;
            setIsConnected(false);
            setIsWorking(false);
            setMessage(connectionError instanceof Error ? connectionError.message : 'Could not connect to SipBase.');
          }
        })();
      });

      scanTimerRef.current = setTimeout(() => {
        scanTimerRef.current = null;
        if (!connecting) {
          void manager.stopDeviceScan();
          setIsWorking(false);
          setMessage('SipBase not found. Make sure it is powered on and advertising.');
        }
      }, 12000);
    } catch (connectionError) {
      setIsWorking(false);
      setMessage(connectionError instanceof Error ? connectionError.message : 'Could not start Bluetooth scan.');
    }
  }, [clearSubscriptions, isConnected, isWorking]);

  const disconnect = useCallback(async () => {
    if (Platform.OS === 'web') {
      browserDeviceRef.current?.gatt?.disconnect();
      browserDeviceRef.current = null;
      browserTareCharacteristicRef.current = null;
      setIsConnected(false);
      setIsWorking(false);
      setMessage('Disconnected from SipBase.');
      return;
    }
    const manager = managerRef.current;
    if (!manager) return;
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = null;
    await manager.stopDeviceScan();
    clearSubscriptions();
    const deviceId = deviceIdRef.current;
    deviceIdRef.current = null;
    if (deviceId) await manager.cancelDeviceConnection(deviceId).catch(() => undefined);
    setIsConnected(false);
    setIsWorking(false);
    setMessage('Disconnected from SipBase.');
  }, [clearSubscriptions]);

  const tare = useCallback(async () => {
    if (Platform.OS === 'web') {
      const characteristic = browserTareCharacteristicRef.current;
      if (!characteristic) return;
      try {
        await characteristic.writeValue(new Uint8Array([116]));
        setMessage('Tare command sent. The live reading should settle near 0 g.');
      } catch (tareError) {
        setMessage(tareError instanceof Error ? tareError.message : 'Could not tare the scale.');
      }
      return;
    }
    const manager = managerRef.current;
    const deviceId = deviceIdRef.current;
    if (!manager || !deviceId || !isConnected) return;
    try {
      await manager.writeCharacteristicWithResponseForDevice(
        deviceId,
        ICUP_SERVICE_UUID,
        ICUP_TARE_UUID,
        'dA==', // Base64 for the ASCII character "t".
      );
      setMessage('Tare command sent. The live reading should settle near 0 g.');
    } catch (tareError) {
      setMessage(tareError instanceof Error ? tareError.message : 'Could not tare the scale.');
    }
  }, [isConnected]);

  return (
    <IcupBleContext.Provider value={{ isConnected, isWorking, latestWeightGrams, message, connect, disconnect, tare }}>
      {children}
    </IcupBleContext.Provider>
  );
}

export function useIcupBle() {
  const value = useContext(IcupBleContext);
  if (!value) throw new Error('useIcupBle must be used within IcupBleProvider');
  return value;
}
