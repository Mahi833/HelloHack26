import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { parseWeightText } from './weight-payload.ts';

const NUL = String.fromCharCode(0);

test('reads the bare decimal form the SipBase firmware sends', () => {
  assert.equal(parseWeightText('412.5'), 412.5);
  assert.equal(parseWeightText('0'), 0);
  assert.equal(parseWeightText('-3.2'), -3.2);
  assert.equal(parseWeightText('  508.0  '), 508);
});

test('reads the JSON form the committed iCup firmware sends', () => {
  assert.equal(parseWeightText('{"weight_g":312.4}'), 312.4);
  assert.equal(parseWeightText('{"weight_g":0.0}'), 0);
});

test('tolerates trailing NUL padding from a fixed width characteristic', () => {
  assert.equal(parseWeightText(`412.5${NUL}${NUL}${NUL}`), 412.5);
});

test('rejects payloads that are not a weight', () => {
  assert.equal(parseWeightText(null), null);
  assert.equal(parseWeightText(''), null);
  assert.equal(parseWeightText('   '), null);
  assert.equal(parseWeightText('NaN'), null);
  assert.equal(parseWeightText('Infinity'), null);
  assert.equal(parseWeightText('412.5g'), null);
  assert.equal(parseWeightText('ok'), null);
  assert.equal(parseWeightText('{"weight_g":"312.4"}'), null);
  assert.equal(parseWeightText('{"weight_g":null}'), null);
  assert.equal(parseWeightText('{"grams":312.4}'), null);
  assert.equal(parseWeightText('{broken'), null);
});
