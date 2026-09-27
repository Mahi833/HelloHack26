import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createSipDetector,
  CUP_ABSENT_BELOW_G,
  FILTER_WINDOW_SAMPLES,
  LIFT_OFF_LIMIT_G,
  NOISE_FLOOR_G,
  REFILL_HOLD_SAMPLES,
  REFILL_MIN_BASELINE_G,
  REFILL_RATIO,
  REFILL_REVERT_GRACE_SAMPLES,
  STABILITY_SPREAD_G,
} from './sip-detector.ts';

const hold = (grams: number, samples: number): number[] =>
  Array.from({ length: samples }, () => grams);

const SETTLE = FILTER_WINDOW_SAMPLES + 2;
const HELD = REFILL_HOLD_SAMPLES + 4;

const runDetector = (readings: number[]) => {
  const detector = createSipDetector();
  const logged: number[] = [];
  for (const reading of readings) {
    const ml = detector.push(reading);
    if (ml !== null) {
      logged.push(ml);
    }
  }
  return { detector, logged };
};

const feed = (readings: number[]): number[] => runDetector(readings).logged;

test('the detector constants are the agreed values', () => {
  assert.equal(NOISE_FLOOR_G, 20);
  assert.equal(LIFT_OFF_LIMIT_G, 1200);
  assert.equal(CUP_ABSENT_BELOW_G, 30);
  assert.equal(FILTER_WINDOW_SAMPLES, 8);
  assert.equal(STABILITY_SPREAD_G, 10);
  assert.equal(REFILL_HOLD_SAMPLES, 16);
  assert.equal(REFILL_RATIO, 1.5);
  assert.equal(REFILL_MIN_BASELINE_G, 50);
  assert.equal(REFILL_REVERT_GRACE_SAMPLES, 16);
});

test('the stability gate sits below the noise floor', () => {
  assert.equal(STABILITY_SPREAD_G < NOISE_FLOOR_G, true);
});

test('the refill hold covers two filter windows', () => {
  assert.equal(REFILL_HOLD_SAMPLES, FILTER_WINDOW_SAMPLES * 2);
  assert.equal(REFILL_REVERT_GRACE_SAMPLES, FILTER_WINDOW_SAMPLES * 2);
});

test('logs a settled sip in whole millilitres', () => {
  assert.deepEqual(feed([...hold(500, SETTLE), ...hold(450, SETTLE)]), [50]);
});

test('logs nothing until the filter window has refilled with the new level', () => {
  const detector = createSipDetector();
  for (const reading of hold(500, SETTLE)) {
    detector.push(reading);
  }
  for (let sample = 1; sample < FILTER_WINDOW_SAMPLES; sample += 1) {
    assert.equal(detector.push(450), null);
  }
  assert.equal(detector.push(450), 50);
});

test('ignores drift below the noise floor', () => {
  assert.deepEqual(
    feed([...hold(500, SETTLE), 498, 497, 499, 498, 497, 498, 499, 498, 497, 499]),
    [],
  );
});

test('logs two consecutive sips separately', () => {
  assert.deepEqual(
    feed([...hold(500, SETTLE), ...hold(450, SETTLE), ...hold(400, SETTLE)]),
    [50, 50],
  );
});

test('logs a continuous pour once at its settled total', () => {
  assert.deepEqual(
    feed([...hold(600, SETTLE), 550, 500, 450, 400, 350, 300, ...hold(300, SETTLE)]),
    [300],
  );
});

test('rounds fractional grams to the nearest millilitre', () => {
  assert.deepEqual(feed([...hold(512.4, SETTLE), ...hold(461.9, SETTLE)]), [51]);
});

test('accepts a drop exactly at the noise floor', () => {
  assert.deepEqual(feed([...hold(500, SETTLE), ...hold(480, SETTLE)]), [20]);
});

test('rejects a drop one gram short of the noise floor', () => {
  assert.deepEqual(feed([...hold(500, SETTLE), ...hold(481, SETTLE)]), []);
});

test('accepts a drop exactly at the lift off limit', () => {
  assert.deepEqual(feed([...hold(1300, SETTLE), ...hold(100, SETTLE)]), [1200]);
});

test('rejects a drop one gram past the lift off limit', () => {
  assert.deepEqual(feed([...hold(1301, SETTLE), ...hold(100, SETTLE)]), []);
});

test('ignores a downward swing larger than the lift off limit', () => {
  assert.deepEqual(feed([...hold(1500, SETTLE), ...hold(200, SETTLE)]), []);
});

test('a single sample spike neither logs nor shifts the baseline', () => {
  assert.deepEqual(
    feed([...hold(520, SETTLE), 300, ...hold(520, SETTLE), ...hold(470, SETTLE)]),
    [50],
  );
});

test('takes the median of the window so one heavy sample does not inflate the baseline', () => {
  assert.deepEqual(feed([...hold(520, 7), 528, ...hold(500, SETTLE)]), [20]);
});

test('a hard press and release logs nothing and leaves the baseline where it was', () => {
  const { detector, logged } = runDetector([
    ...hold(520, SETTLE),
    700,
    760,
    710,
    780,
    690,
    740,
    ...hold(520, SETTLE),
  ]);
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 520);
});

test('a steady press held for two seconds logs nothing and does not rebase', () => {
  const { detector, logged } = runDetector([
    ...hold(520, SETTLE),
    ...hold(700, FILTER_WINDOW_SAMPLES),
    ...hold(520, SETTLE),
  ]);
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 520);
});

test('a press that doubles the reading but is released early never rebases', () => {
  const { detector, logged } = runDetector([
    ...hold(520, SETTLE),
    ...hold(1200, REFILL_HOLD_SAMPLES - 4),
    ...hold(520, SETTLE),
  ]);
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 520);
});

test('an elevated reading rebases only once it has been held for the refill window', () => {
  const detector = createSipDetector();
  for (const reading of hold(520, SETTLE)) {
    detector.push(reading);
  }
  for (const reading of hold(700, REFILL_HOLD_SAMPLES - 1)) {
    detector.push(reading);
  }
  assert.equal(detector.snapshot().baselineG, 520);
  detector.push(700);
  assert.equal(detector.snapshot().baselineG, 700);
  assert.equal(detector.snapshot().revertToG, 520);
});

test('a hard press past the refill window then released logs nothing and restores the baseline', () => {
  const { detector, logged } = runDetector([
    ...hold(520, SETTLE),
    ...hold(1200, HELD),
    ...hold(520, SETTLE),
  ]);
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 520);
  assert.equal(detector.snapshot().revertToG, null);
});

test('a press held well past the refill window still logs nothing on release', () => {
  const { detector, logged } = runDetector([
    ...hold(520, SETTLE),
    ...hold(1200, REFILL_HOLD_SAMPLES * 4),
    ...hold(520, SETTLE),
  ]);
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 520);
});

test('a refill held past the refill window rebases and the next sip measures from it', () => {
  assert.deepEqual(feed([...hold(500, SETTLE), ...hold(900, HELD), ...hold(850, SETTLE)]), [50]);
});

test('a refill held only briefly does not rebase the baseline', () => {
  const { detector, logged } = runDetector([
    ...hold(500, SETTLE),
    ...hold(900, REFILL_HOLD_SAMPLES - 4),
    ...hold(500, SETTLE),
  ]);
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 500);
});

test('filling two hundred grams to six hundred is a refill and the next sip measures from it', () => {
  const { detector, logged } = runDetector([
    ...hold(200, SETTLE),
    ...hold(600, HELD),
    ...hold(550, SETTLE),
  ]);
  assert.deepEqual(logged, [50]);
  assert.equal(detector.snapshot().baselineG, 550);
});

test('filling two hundred grams to sixteen hundred is a refill and is not discarded', () => {
  const { detector, logged } = runDetector([...hold(200, SETTLE), ...hold(1600, HELD)]);
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 1600);
});

test('a sip after a refill past the lift off limit measures from the refilled level', () => {
  assert.deepEqual(
    feed([...hold(200, SETTLE), ...hold(1600, HELD), ...hold(1500, SETTLE)]),
    [100],
  );
});

test('a small top up under the ratio still rebases so later volumes stay correct', () => {
  const detector = createSipDetector();
  for (const reading of [...hold(500, SETTLE), ...hold(560, HELD)]) {
    detector.push(reading);
  }
  assert.equal(detector.snapshot().baselineG, 560);
  const logged: number[] = [];
  for (const reading of hold(460, SETTLE)) {
    const ml = detector.push(reading);
    if (ml !== null) {
      logged.push(ml);
    }
  }
  assert.deepEqual(logged, [100]);
});

test('the ratio rule does not fire when the baseline is below the minimum', () => {
  const { detector, logged } = runDetector([...hold(40, SETTLE), ...hold(1400, HELD)]);
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 40);
});

test('the ratio rule fires when the baseline is above the minimum', () => {
  const { detector, logged } = runDetector([...hold(60, SETTLE), ...hold(1400, HELD)]);
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 1400);
});

test('a sustained rise past the lift off limit that is under the ratio is discarded', () => {
  const { detector, logged } = runDetector([...hold(3000, SETTLE), ...hold(4300, HELD)]);
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 3000);
});

test('lifting the bottle off the coaster logs nothing', () => {
  assert.deepEqual(feed([...hold(520, SETTLE), 2, 1, 0, 1, 2, 1, 0, 1]), []);
});

test('putting the bottle back logs nothing', () => {
  assert.deepEqual(feed([...hold(520, SETTLE), ...hold(0, 8), ...hold(505, SETTLE)]), []);
});

test('a sip right after the bottle is replaced is measured from the replaced level', () => {
  assert.deepEqual(
    feed([...hold(520, SETTLE), ...hold(0, 8), ...hold(505, SETTLE), ...hold(455, SETTLE)]),
    [50],
  );
});

test('an absent stretch does not rebase the baseline until the bottle returns', () => {
  const detector = createSipDetector();
  for (const reading of hold(520, SETTLE)) {
    detector.push(reading);
  }
  detector.push(0);
  detector.push(0);
  assert.equal(detector.snapshot().cupPresent, false);
  assert.equal(detector.snapshot().baselineG, 520);
  for (const reading of hold(505, SETTLE)) {
    assert.equal(detector.push(reading), null);
  }
  assert.equal(detector.snapshot().cupPresent, true);
  assert.equal(detector.snapshot().baselineG, 505);
});

test('the ratio rule does not fire while the bottle is absent', () => {
  const detector = createSipDetector();
  for (const reading of [...hold(520, SETTLE), ...hold(0, 8)]) {
    detector.push(reading);
  }
  assert.equal(detector.snapshot().cupPresent, false);
  assert.equal(detector.snapshot().elevatedSamples, 0);
  assert.equal(detector.snapshot().baselineG, 520);
  const logged: number[] = [];
  for (const reading of hold(900, SETTLE)) {
    const ml = detector.push(reading);
    if (ml !== null) {
      logged.push(ml);
    }
  }
  assert.deepEqual(logged, []);
  assert.equal(detector.snapshot().baselineG, 900);
  assert.equal(detector.snapshot().revertToG, null);
});

test('a reading exactly at the cup presence floor still counts as present', () => {
  assert.deepEqual(feed([...hold(55, SETTLE), ...hold(30, SETTLE)]), [25]);
});

test('a reading just above the cup presence floor still counts as present', () => {
  assert.deepEqual(feed([...hold(55, SETTLE), ...hold(31, SETTLE)]), [24]);
});

test('a reading just below the cup presence floor counts as absent', () => {
  assert.deepEqual(feed([...hold(55, SETTLE), ...hold(29, SETTLE)]), []);
});

test('ignores non finite readings', () => {
  assert.deepEqual(
    feed([
      ...hold(500, SETTLE),
      Number.NaN,
      Number.POSITIVE_INFINITY,
      ...hold(450, SETTLE),
    ]),
    [50],
  );
});

test('reset clears the baseline and the filter window', () => {
  const detector = createSipDetector();
  for (const reading of hold(500, SETTLE)) {
    detector.push(reading);
  }
  detector.reset();
  assert.equal(detector.snapshot().baselineG, null);
  assert.equal(detector.snapshot().windowFilled, false);
  for (const reading of hold(900, SETTLE)) {
    assert.equal(detector.push(reading), null);
  }
  assert.equal(detector.snapshot().baselineG, 900);
  const logged: number[] = [];
  for (const reading of hold(840, SETTLE)) {
    const ml = detector.push(reading);
    if (ml !== null) {
      logged.push(ml);
    }
  }
  assert.deepEqual(logged, [60]);
});
