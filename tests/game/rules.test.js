import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createShuffleBag,
  localDateKey,
  practicePool,
  scheduledPlayerId,
  scoreForGuess,
} from '../../src/game/rules.js';

const players = [
  { playerId: 'alpha', answer: { difficulty: 'headliner' } },
  { playerId: 'beta', answer: { difficulty: 'deep-cut' } },
  { playerId: 'search-only' },
];

test('scoreForGuess uses the configured one-based scoring ladder', () => {
  const points = [50, 40, 30, 20, 10];

  assert.equal(scoreForGuess(points, 1), 50);
  assert.equal(scoreForGuess(points, 5), 10);
  assert.equal(scoreForGuess(points, 6), 0);
  assert.equal(scoreForGuess(points, 0), 0);
});

test('practicePool includes only answer players allowed by the selected mode', () => {
  assert.deepEqual(
    practicePool(players, { difficulties: ['headliner', 'deep-cut'] }).map((player) => player.playerId),
    ['alpha', 'beta'],
  );
  assert.deepEqual(
    practicePool(players, { difficulties: ['deep-cut'] }).map((player) => player.playerId),
    ['beta'],
  );
});

test('createShuffleBag returns each supplied ID exactly once without mutating the input', () => {
  const ids = ['alpha', 'beta', 'gamma'];
  const bag = createShuffleBag(ids, () => 0);

  assert.deepEqual([...bag].sort(), ids);
  assert.deepEqual(ids, ['alpha', 'beta', 'gamma']);
  assert.notDeepEqual(bag, ids);
});

test('localDateKey formats the browser-local calendar date', () => {
  assert.equal(localDateKey(new Date(2026, 9, 21, 23, 59)), '2026-10-21');
});

test('scheduledPlayerId returns the published ID without deriving from a player pool', () => {
  const schedule = { '2026-10-21': 'tracy-mcgrady' };

  assert.equal(scheduledPlayerId(schedule, new Date(2026, 9, 21)), 'tracy-mcgrady');
  assert.equal(scheduledPlayerId(schedule, new Date(2026, 9, 22)), null);
});


test('isDailyEligible applies difficulty, games, and the optional era cutoff', async () => {
  const { isDailyEligible } = await import('../../src/game/rules.js');
  const player = (difficulty, games, firstSeason) => ({ answer: { difficulty }, stats: { games, firstSeason } });
  const rule = { difficulties: ['headliner'], minimumGamesForOthers: 100 };
  const eraRule = { ...rule, minimumFirstSeason: 1980 };

  assert.equal(isDailyEligible(player('headliner', 10, 1970), rule), true);
  assert.equal(isDailyEligible(player('deep-cut', 150, 1970), rule), true);
  assert.equal(isDailyEligible(player('deep-cut', 50, 2000), rule), false);
  assert.equal(isDailyEligible({ stats: { games: 500, firstSeason: 2000 } }, rule), false);
  assert.equal(isDailyEligible(player('headliner', 800, 1968), eraRule), false);
  assert.equal(isDailyEligible(player('headliner', 800, 1980), eraRule), true);
  assert.equal(isDailyEligible(player('deep-cut', 120, 1986), eraRule), true);
});
