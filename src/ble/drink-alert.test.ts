import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldAlertToDrink } from './drink-alert.ts';

const MINUTE = 60000;
const NOW = 1_700_000_000_000;

const base = {
  remindersEnabled: true,
  lastDrinkAt: NOW - 90 * MINUTE,
  now: NOW,
  intervalMinutes: 60,
  goalReached: false,
};

test('stays dark while reminders are off', () => {
  assert.equal(shouldAlertToDrink({ ...base, remindersEnabled: false }), false);
});

test('lights up once the interval has passed since the last drink', () => {
  assert.equal(shouldAlertToDrink(base), true);
});

test('stays dark inside the interval', () => {
  assert.equal(shouldAlertToDrink({ ...base, lastDrinkAt: NOW - 20 * MINUTE }), false);
});

test('lights up exactly on the interval boundary', () => {
  assert.equal(shouldAlertToDrink({ ...base, lastDrinkAt: NOW - 60 * MINUTE }), true);
});

test('lights up when nothing has been logged yet', () => {
  assert.equal(shouldAlertToDrink({ ...base, lastDrinkAt: null }), true);
});

test('stays dark once the daily goal is met', () => {
  assert.equal(shouldAlertToDrink({ ...base, goalReached: true }), false);
});

test('a fresh drink clears an alert that was already showing', () => {
  assert.equal(shouldAlertToDrink(base), true);
  assert.equal(shouldAlertToDrink({ ...base, lastDrinkAt: NOW }), false);
});

test('a shorter interval lights up sooner', () => {
  const at = { ...base, lastDrinkAt: NOW - 5 * MINUTE };
  assert.equal(shouldAlertToDrink({ ...at, intervalMinutes: 30 }), false);
  assert.equal(shouldAlertToDrink({ ...at, intervalMinutes: 2 }), true);
});

test('a non-positive interval never lights up', () => {
  assert.equal(shouldAlertToDrink({ ...base, intervalMinutes: 0 }), false);
});

test('a clock that jumped backwards does not light up', () => {
  assert.equal(shouldAlertToDrink({ ...base, lastDrinkAt: NOW + 10 * MINUTE }), false);
});
