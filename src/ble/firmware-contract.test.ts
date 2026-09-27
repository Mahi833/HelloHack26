import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = join(import.meta.dirname, '..', '..');

const appSource = readFileSync(join(ROOT, 'src/contexts/icup-ble-context.tsx'), 'utf8');
const firmwareSource = readFileSync(
  join(ROOT, 'firmware/xiao-esp32c5-icup/xiao-esp32c5-icup.ino'),
  'utf8',
);

const appConstant = (name: string): string | null =>
  new RegExp(`${name} = '([^']+)'`).exec(appSource)?.[1] ?? null;

const firmwareConstant = (name: string): string | null =>
  new RegExp(`${name} = "([^"]+)"`).exec(firmwareSource)?.[1] ?? null;

const firmwareChar = (name: string): string | null =>
  new RegExp(`char ${name} = '(.)'`).exec(firmwareSource)?.[1] ?? null;

const decode = (base64: string): string => Buffer.from(base64, 'base64').toString('latin1');

const UUID_PAIRS = [
  ['ICUP_SERVICE_UUID', 'SERVICE_UUID'],
  ['ICUP_WEIGHT_UUID', 'WEIGHT_CHARACTERISTIC_UUID'],
  ['ICUP_TARE_UUID', 'TARE_CHARACTERISTIC_UUID'],
  ['ICUP_ALERT_UUID', 'ALERT_CHARACTERISTIC_UUID'],
] as const;

for (const [appName, firmwareName] of UUID_PAIRS) {
  test(`${appName} is the UUID the firmware serves`, () => {
    const fromApp = appConstant(appName);
    const fromFirmware = firmwareConstant(firmwareName);
    assert.ok(fromApp, `${appName} is missing from the BLE context`);
    assert.ok(fromFirmware, `${firmwareName} is missing from the sketch`);
    assert.equal(
      fromApp,
      fromFirmware,
      'the app would scan for a service the cup never advertises',
    );
  });
}

const COMMAND_PAIRS = [
  ['ICUP_TARE_COMMAND', 'TARE_COMMAND'],
  ['ICUP_ALERT_ON_COMMAND', 'ALERT_ON_COMMAND'],
  ['ICUP_ALERT_OFF_COMMAND', 'ALERT_OFF_COMMAND'],
] as const;

for (const [appName, firmwareName] of COMMAND_PAIRS) {
  test(`${appName} decodes to the byte the firmware acts on`, () => {
    const encoded = appConstant(appName);
    const expected = firmwareChar(firmwareName);
    assert.ok(encoded, `${appName} is missing from the BLE context`);
    assert.ok(expected, `${firmwareName} is missing from the sketch`);
    assert.equal(decode(encoded), expected, 'the cup would ignore this command');
  });
}

test('the firmware advertises the service the app scans for', () => {
  const advertised = /advertising->addServiceUUID\((\w+)\)/.exec(firmwareSource)?.[1];
  assert.equal(advertised, 'SERVICE_UUID');
});

test('the alert and tare characteristics accept writes', () => {
  for (const uuid of ['TARE_CHARACTERISTIC_UUID', 'ALERT_CHARACTERISTIC_UUID']) {
    const declaration = new RegExp(`${uuid},\\s*\\n\\s*([^\\n]+)`).exec(firmwareSource)?.[1];
    assert.ok(declaration?.includes('WRITE'), `${uuid} is not writable`);
  }
});

test('the weight characteristic notifies', () => {
  const declaration = /WEIGHT_CHARACTERISTIC_UUID,\s*\n\s*([^\n]+)/.exec(firmwareSource)?.[1];
  assert.ok(declaration?.includes('NOTIFY'), 'the app subscribes, so the cup must notify');
});
