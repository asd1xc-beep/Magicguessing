import test from 'node:test';
import assert from 'node:assert/strict';

import { comparePlayers } from '../../src/game/compare.js';

const comparison = {
  thresholds: { debut: 3, seasons: 1, games: 50, pointsPerGame: 2, jersey: 2 },
  labels: {
    position: 'Position',
    debut: 'First team season',
    seasons: 'Seasons with team',
    games: 'Games with team',
    pointsPerGame: 'Points per game with team',
    jersey: 'Jersey number',
  },
};

const answer = {
  stats: {
    position: 'G/F',
    firstSeason: 2022,
    seasons: 5,
    games: 268,
    pointsPerGame: 12.6,
    numbers: ['4'],
  },
};

function colorsFor(guess) {
  return comparePlayers({ stats: guess }, answer, comparison).map((tile) => tile.color);
}

test('comparePlayers marks exact, partial, and missing position matches', () => {
  const exact = colorsFor({ ...answer.stats, position: 'G/F' });
  const partial = colorsFor({ ...answer.stats, position: 'G' });
  const missing = colorsFor({ ...answer.stats, position: 'C' });

  assert.equal(exact[0], 'g');
  assert.equal(partial[0], 'y');
  assert.equal(missing[0], 'x');
});

test('comparePlayers preserves the current numeric close thresholds and arrows', () => {
  const tiles = comparePlayers({
    stats: {
      position: 'C',
      firstSeason: 2019,
      seasons: 4,
      games: 218,
      pointsPerGame: 10.6,
      numbers: ['1'],
    },
  }, answer, comparison);

  assert.deepEqual(tiles.slice(1, 5).map(({ color, arrow }) => ({ color, arrow })), [
    { color: 'y', arrow: '↑' },
    { color: 'y', arrow: '↑' },
    { color: 'y', arrow: '↑' },
    { color: 'y', arrow: '↑' },
  ]);
});

test('comparePlayers marks shared jersey numbers green', () => {
  const tiles = comparePlayers({ stats: { ...answer.stats, numbers: ['4', '12'] } }, answer, comparison);

  assert.deepEqual(tiles[5], {
    key: 'No.',
    value: '#4',
    color: 'g',
    arrow: '',
    title: 'Jersey number: match',
  });
});

test('comparePlayers keeps 00 for display while comparing jersey numbers numerically', () => {
  const close = comparePlayers({ stats: { ...answer.stats, numbers: ['00', '2'] } }, answer, comparison)[5];
  const distant = comparePlayers({ stats: { ...answer.stats, numbers: ['40'] } }, answer, comparison)[5];

  assert.equal(close.value, '#00/2');
  assert.equal(close.color, 'y');
  assert.equal(close.arrow, '↑');
  assert.equal(distant.color, 'x');
  assert.equal(distant.arrow, '↓');
});

test('comparePlayers handles an empty jersey list without an arrow', () => {
  const tile = comparePlayers({ stats: { ...answer.stats, numbers: [] } }, answer, comparison)[5];

  assert.equal(tile.value, '—');
  assert.equal(tile.color, 'x');
  assert.equal(tile.arrow, '');
});

