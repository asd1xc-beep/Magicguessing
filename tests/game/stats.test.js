import test from 'node:test';
import assert from 'node:assert/strict';

import { defaultStats, liveStreak, recordDailyResult } from '../../src/game/stats.js';

test('defaultStats creates an empty distribution for every allowed guess', () => {
  assert.deepEqual(defaultStats(5), {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastWinDate: null,
    lastPlayedDate: null,
    distribution: [0, 0, 0, 0, 0],
  });
});

test('recordDailyResult records a date only once and increments the winning bucket', () => {
  const first = recordDailyResult(defaultStats(5), {
    date: '2026-10-21', isWin: true, guessCount: 3,
  });
  const duplicate = recordDailyResult(first, {
    date: '2026-10-21', isWin: false, guessCount: 5,
  });

  assert.deepEqual(first, {
    played: 1,
    wins: 1,
    currentStreak: 1,
    maxStreak: 1,
    lastWinDate: '2026-10-21',
    lastPlayedDate: '2026-10-21',
    distribution: [0, 0, 1, 0, 0],
  });
  assert.deepEqual(duplicate, first);
  assert.notStrictEqual(duplicate, first);
});

test('recordDailyResult continues consecutive streaks and restarts broken streaks', () => {
  const dayOne = recordDailyResult(defaultStats(5), {
    date: '2026-10-19', isWin: true, guessCount: 1,
  });
  const dayTwo = recordDailyResult(dayOne, {
    date: '2026-10-20', isWin: true, guessCount: 2,
  });
  const dayFour = recordDailyResult(dayTwo, {
    date: '2026-10-22', isWin: true, guessCount: 4,
  });

  assert.equal(dayTwo.currentStreak, 2);
  assert.equal(dayTwo.maxStreak, 2);
  assert.equal(dayFour.currentStreak, 1);
  assert.equal(dayFour.maxStreak, 2);
});

test('a loss resets the current streak without erasing the maximum', () => {
  const won = recordDailyResult(defaultStats(5), {
    date: '2026-10-19', isWin: true, guessCount: 1,
  });
  const lost = recordDailyResult(won, {
    date: '2026-10-20', isWin: false, guessCount: 5,
  });

  assert.equal(lost.played, 2);
  assert.equal(lost.wins, 1);
  assert.equal(lost.currentStreak, 0);
  assert.equal(lost.maxStreak, 1);
});

test('liveStreak remains visible today and the day after the latest win', () => {
  const stats = { ...defaultStats(5), currentStreak: 4, lastWinDate: '2026-10-20' };

  assert.equal(liveStreak(stats, '2026-10-20'), 4);
  assert.equal(liveStreak(stats, '2026-10-21'), 4);
  assert.equal(liveStreak(stats, '2026-10-22'), 0);
});

