import assert from 'node:assert/strict';
import test from 'node:test';

import { computeStreak } from './streak.ts';
import type { DayTotal } from '@/store/types';

const totals = (entries: [string, number][]): DayTotal[] =>
  entries.map(([day, ml]) => ({ day, ml }));

test('no history means no streak', () => {
  assert.deepEqual(computeStreak([], 2000, '2026-09-26'), { current: 0, best: 0 });
});

test('meeting the goal today is a streak of one', () => {
  const history = totals([['2026-09-26', 2000]]);
  assert.deepEqual(computeStreak(history, 2000, '2026-09-26'), { current: 1, best: 1 });
});

test('an unfinished today does not break yesterday streak', () => {
  const history = totals([
    ['2026-09-24', 2100],
    ['2026-09-25', 2200],
    ['2026-09-26', 500],
  ]);
  assert.deepEqual(computeStreak(history, 2000, '2026-09-26'), { current: 2, best: 2 });
});

test('missing yesterday with an unfinished today ends the streak', () => {
  const history = totals([
    ['2026-09-24', 2100],
    ['2026-09-26', 500],
  ]);
  assert.deepEqual(computeStreak(history, 2000, '2026-09-26').current, 0);
});

test('counts consecutive days ending today', () => {
  const history = totals([
    ['2026-09-24', 2000],
    ['2026-09-25', 2500],
    ['2026-09-26', 2000],
  ]);
  assert.deepEqual(computeStreak(history, 2000, '2026-09-26'), { current: 3, best: 3 });
});

test('a gap breaks the run but the best streak remembers it', () => {
  const history = totals([
    ['2026-09-20', 2000],
    ['2026-09-21', 2000],
    ['2026-09-22', 2000],
    ['2026-09-23', 2000],
    ['2026-09-25', 2000],
    ['2026-09-26', 2000],
  ]);
  assert.deepEqual(computeStreak(history, 2000, '2026-09-26'), { current: 2, best: 4 });
});

test('days short of the goal never count', () => {
  const history = totals([
    ['2026-09-25', 1999],
    ['2026-09-26', 1999],
  ]);
  assert.deepEqual(computeStreak(history, 2000, '2026-09-26'), { current: 0, best: 0 });
});

test('a day exactly on the goal counts', () => {
  assert.equal(computeStreak(totals([['2026-09-26', 2000]]), 2000, '2026-09-26').current, 1);
});

test('unsorted history is handled', () => {
  const history = totals([
    ['2026-09-26', 2000],
    ['2026-09-24', 2000],
    ['2026-09-25', 2000],
  ]);
  assert.equal(computeStreak(history, 2000, '2026-09-26').current, 3);
});

test('a streak spanning a month boundary is continuous', () => {
  const history = totals([
    ['2026-08-30', 2000],
    ['2026-08-31', 2000],
    ['2026-09-01', 2000],
  ]);
  assert.deepEqual(computeStreak(history, 2000, '2026-09-01'), { current: 3, best: 3 });
});

test('a non-positive goal yields no streak', () => {
  assert.deepEqual(computeStreak(totals([['2026-09-26', 2000]]), 0, '2026-09-26'), {
    current: 0,
    best: 0,
  });
});
