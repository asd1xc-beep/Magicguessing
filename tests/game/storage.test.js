import test from 'node:test';
import assert from 'node:assert/strict';

import { createNameIndex } from '../../src/game/names.js';
import { createTeamStorage, resolveStorage } from '../../src/game/storage.js';
import { migrateLegacyProgress } from '../../src/teams/orlando/migrate.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test('createTeamStorage isolates values by team namespace', () => {
  const storage = new MemoryStorage();
  const orlando = createTeamStorage(storage, 'orlando');
  const miami = createTeamStorage(storage, 'miami');

  orlando.set('stats', { wins: 2 });
  miami.set('stats', { wins: 9 });

  assert.equal(orlando.key('stats'), 'nba-guess:v1:orlando:stats');
  assert.deepEqual(orlando.get('stats', null), { wins: 2 });
  assert.deepEqual(miami.get('stats', null), { wins: 9 });
});

test('createTeamStorage falls back when stored JSON is malformed or storage throws', () => {
  const malformed = new MemoryStorage({ 'nba-guess:v1:orlando:daily': '{bad json' });
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

  assert.deepEqual(createTeamStorage(malformed, 'orlando').get('daily', { fresh: true }), { fresh: true });
  assert.deepEqual(createTeamStorage(broken, 'orlando').get('daily', { fresh: true }), { fresh: true });
  assert.doesNotThrow(() => createTeamStorage(broken, 'orlando').set('daily', { value: 1 }));
});

test('resolveStorage provides working in-memory storage when browser storage is blocked', () => {
  const storage = resolveStorage(() => {
    throw new DOMException('Access denied', 'SecurityError');
  });

  assert.doesNotThrow(() => storage.setItem('selected-team', 'orlando'));
  assert.equal(storage.getItem('selected-team'), 'orlando');
});

test('migrateLegacyProgress converts legacy names and day indexes without deleting old keys', () => {
  const storage = new MemoryStorage({
    mpg_daily: JSON.stringify({ day: 2, guesses: ['Shaq', 'Unknown Person', 'Hedo Türkoğlu'] }),
    mpg_stats: JSON.stringify({
      played: 3, wins: 2, cur: 2, max: 4, lastWin: 2, lastPlayed: 2,
      dist: [1, 0, 1, 0, 0],
    }),
    mpg_best_streak: JSON.stringify(7),
  });
  const nameIndex = createNameIndex([
    { id: 'shaquille-oneal', name: "Shaquille O'Neal", aliases: ['Shaq'] },
    { id: 'hedo-turkoglu', name: 'Hedo Türkoğlu', aliases: ['Hedo'] },
  ]);

  migrateLegacyProgress(storage, nameIndex, {
    schedule: { '2026-10-21': 'tracy-mcgrady' },
    epoch: '2026-10-19',
    maxGuesses: 5,
  });
  const teamStorage = createTeamStorage(storage, 'orlando');

  assert.deepEqual(teamStorage.get('daily', null), {
    date: '2026-10-21',
    answerId: 'tracy-mcgrady',
    guesses: ['shaquille-oneal', 'hedo-turkoglu'],
  });
  assert.deepEqual(teamStorage.get('stats', null), {
    played: 3,
    wins: 2,
    currentStreak: 2,
    maxStreak: 4,
    lastWinDate: '2026-10-21',
    lastPlayedDate: '2026-10-21',
    distribution: [1, 0, 1, 0, 0],
  });
  assert.equal(teamStorage.get('best-streak', 0), 7);
  assert.notEqual(storage.getItem('mpg_daily'), null);
  assert.notEqual(storage.getItem('mpg_stats'), null);
  assert.notEqual(storage.getItem('mpg_best_streak'), null);
});

test('migrateLegacyProgress is idempotent and never overwrites new values', () => {
  const storage = new MemoryStorage({
    mpg_daily: JSON.stringify({ day: 0, guesses: ['Shaq'] }),
    'nba-guess:v1:orlando:daily': JSON.stringify({ date: 'saved-new-value' }),
  });
  const nameIndex = createNameIndex([
    { id: 'shaquille-oneal', name: "Shaquille O'Neal", aliases: ['Shaq'] },
  ]);

  migrateLegacyProgress(storage, nameIndex, { schedule: {}, epoch: '2026-10-19', maxGuesses: 5 });
  migrateLegacyProgress(storage, nameIndex, { schedule: {}, epoch: '2026-10-19', maxGuesses: 5 });

  assert.deepEqual(createTeamStorage(storage, 'orlando').get('daily', null), { date: 'saved-new-value' });
});

