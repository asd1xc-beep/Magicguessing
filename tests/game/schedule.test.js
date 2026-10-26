import test from 'node:test';
import assert from 'node:assert/strict';

import { planScheduleExtension } from '../../scripts/extend-schedule.js';

const ids = ['a', 'b', 'c', 'd', 'e'];

test('planScheduleExtension appends contiguous dates and finishes the current cycle first', () => {
  const schedule = { '2026-01-01': 'a', '2026-01-02': 'b' };
  const plan = planScheduleExtension({ schedule, eligibleIds: ids, startDate: '2026-01-03', days: 3, seed: 's' });

  assert.deepEqual(Object.keys(plan), ['2026-01-03', '2026-01-04', '2026-01-05']);
  assert.deepEqual(Object.values(plan).sort(), ['c', 'd', 'e']);
});

test('planScheduleExtension never repeats a player within a cycle and is reproducible', () => {
  const plan = planScheduleExtension({ schedule: {}, eligibleIds: ids, startDate: '2026-01-01', days: 10, seed: 'x' });
  const again = planScheduleExtension({ schedule: {}, eligibleIds: ids, startDate: '2026-01-01', days: 10, seed: 'x' });
  const values = Object.values(plan);

  assert.deepEqual(plan, again);
  assert.equal(new Set(values.slice(0, 5)).size, 5);
  assert.equal(new Set(values.slice(5)).size, 5);
});

test('planScheduleExtension rejects an empty pool', () => {
  assert.throws(() => planScheduleExtension({ schedule: {}, eligibleIds: [], startDate: '2026-01-01', days: 1, seed: 'x' }), /No daily-eligible/);
});
