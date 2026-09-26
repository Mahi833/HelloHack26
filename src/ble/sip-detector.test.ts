import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSipDetector,
  CUP_ABSENT_BELOW_G,
  LIFT_OFF_LIMIT_G,
  NOISE_FLOOR_G,
} from './sip-detector.ts';

const feed = (readings: number[]): number[] => {
  const detector = createSipDetector();
  const logged: number[] = [];
  for (const reading of readings) {
    const ml = detector.push(reading);
    if (ml !== null) {
      logged.push(ml);
    }
  }
  return logged;
};

test('the three bounds are the agreed values', () => {
  assert.equal(NOISE_FLOOR_G, 20);
  assert.equal(LIFT_OFF_LIMIT_G, 1200);
  assert.equal(CUP_ABSENT_BELOW_G, 30);
});

test('logs a confirmed sip in whole millilitres', () => {
  assert.deepEqual(feed([500, 500, 450, 450]), [50]);
});

test('ignores drift below the noise floor', () => {
  assert.deepEqual(feed([500, 498, 497, 499, 498, 497]), []);
});

test('treats a weight increase as a refill and logs nothing', () => {
  assert.deepEqual(feed([500, 500, 900, 900, 900]), []);
});

test('rebases after a refill so the next sip is measured from the new level', () => {
  assert.deepEqual(feed([500, 500, 900, 900, 850, 850]), [50]);
});

test('ignores a swing larger than the lift off limit', () => {
  assert.deepEqual(feed([1500, 1500, 200, 200, 200, 1500, 1500]), []);
});

test('lifting a full cup off the scale logs nothing', () => {
  assert.deepEqual(feed([520, 520, 2, 1, 0, 1, 2]), []);
});

test('putting the cup back logs nothing and does not log the replacement', () => {
  assert.deepEqual(feed([520, 520, 1, 0, 505, 505, 505]), []);
});

test('a sip right after the cup is replaced is measured from the replaced level', () => {
  assert.deepEqual(feed([520, 520, 0, 0, 505, 505, 455, 455]), [50]);
});

test('an absent stretch does not rebase the baseline until the cup returns', () => {
  const detector = createSipDetector();
  detector.push(520);
  detector.push(0);
  detector.push(0);
  assert.equal(detector.snapshot().cupPresent, false);
  assert.equal(detector.snapshot().baselineG, 520);
  assert.equal(detector.push(505), null);
  assert.equal(detector.snapshot().cupPresent, true);
  assert.equal(detector.snapshot().baselineG, 505);
});

test('a reading exactly at the cup presence floor still counts as present', () => {
  assert.deepEqual(feed([55, 55, 30, 30]), [25]);
});

test('a reading just above the cup presence floor still counts as present', () => {
  assert.deepEqual(feed([55, 55, 31, 31]), [24]);
});

test('a reading just below the cup presence floor counts as absent', () => {
  assert.deepEqual(feed([55, 55, 29, 29]), []);
});

test('logs nothing for a single sample spike', () => {
  assert.deepEqual(feed([500, 500, 300, 500, 500]), []);
});

test('logs two consecutive sips separately', () => {
  assert.deepEqual(feed([500, 500, 450, 450, 400, 400]), [50, 50]);
});

test('logs a continuous pour once at its settled total', () => {
  assert.deepEqual(feed([600, 600, 500, 400, 300, 300, 300]), [300]);
});

test('rounds fractional grams to the nearest millilitre', () => {
  assert.deepEqual(feed([512.4, 512.4, 461.9, 461.9]), [51]);
});

test('accepts a drop exactly at the lift off limit', () => {
  assert.deepEqual(feed([1300, 1300, 100, 100]), [1200]);
});

test('rejects a drop one gram past the lift off limit', () => {
  assert.deepEqual(feed([1301, 1301, 100, 100]), []);
});

test('accepts a drop exactly at the noise floor', () => {
  assert.deepEqual(feed([500, 500, 480, 480]), [20]);
});

test('rejects a drop one gram short of the noise floor', () => {
  assert.deepEqual(feed([500, 500, 481, 481]), []);
});

test('ignores non finite readings', () => {
  assert.deepEqual(feed([500, Number.NaN, Number.POSITIVE_INFINITY, 500, 450, 450]), [50]);
});

test('reset clears the baseline so the next reading becomes the new one', () => {
  const detector = createSipDetector();
  detector.push(500);
  detector.reset();
  assert.equal(detector.snapshot().baselineG, null);
  assert.equal(detector.push(900), null);
  assert.equal(detector.snapshot().baselineG, 900);
  assert.equal(detector.push(840), null);
  assert.equal(detector.push(840), 60);
});

test('a spike does not survive as a confirming sample', () => {
  const detector = createSipDetector();
  detector.push(500);
  assert.equal(detector.push(300), null);
  assert.equal(detector.push(500), null);
  assert.equal(detector.push(300), null);
  assert.equal(detector.snapshot().candidateSamples, 1);
});
