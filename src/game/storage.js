import { resolvePlayerId } from './names.js';
import { defaultStats } from './stats.js';

function readJson(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function hasKey(storage, key) {
  try {
    return storage.getItem(key) != null;
  } catch {
    return false;
  }
}

function dateFromDayIndex(epoch, dayIndex) {
  if (!Number.isInteger(dayIndex) || dayIndex < 0) return null;
  const date = new Date(`${epoch}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayIndex);
  return date.toISOString().slice(0, 10);
}

function nonNegativeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export function createTeamStorage(storage, teamId) {
  const prefix = `nba-guess:v1:${teamId}:`;
  const key = (name) => `${prefix}${name}`;
  return {
    key,
    has(name) {
      return hasKey(storage, key(name));
    },
    get(name, fallback) {
      return readJson(storage, key(name), fallback);
    },
    set(name, value) {
      return writeJson(storage, key(name), value);
    },
  };
}

export function migrateOrlandoLegacy(storage, nameIndex, {
  schedule = {},
  epoch = '2026-10-19',
  maxGuesses = 5,
} = {}) {
  const destination = createTeamStorage(storage, 'orlando');

  if (!destination.has('daily')) {
    const legacyDaily = readJson(storage, 'mpg_daily', null);
    const date = dateFromDayIndex(epoch, legacyDaily?.day);
    if (date) {
      const guesses = Array.isArray(legacyDaily.guesses)
        ? legacyDaily.guesses.map((name) => resolvePlayerId(name, nameIndex)).filter(Boolean)
        : [];
      destination.set('daily', { date, answerId: schedule[date] ?? null, guesses });
    }
  }

  if (!destination.has('stats')) {
    const legacyStats = readJson(storage, 'mpg_stats', null);
    if (legacyStats && typeof legacyStats === 'object') {
      const fallback = defaultStats(maxGuesses);
      const distribution = Array.isArray(legacyStats.dist)
        && legacyStats.dist.length === maxGuesses
        && legacyStats.dist.every((count) => Number.isInteger(count) && count >= 0)
        ? [...legacyStats.dist]
        : fallback.distribution;
      destination.set('stats', {
        played: nonNegativeInteger(legacyStats.played),
        wins: nonNegativeInteger(legacyStats.wins),
        currentStreak: nonNegativeInteger(legacyStats.cur),
        maxStreak: nonNegativeInteger(legacyStats.max),
        lastWinDate: dateFromDayIndex(epoch, legacyStats.lastWin),
        lastPlayedDate: dateFromDayIndex(epoch, legacyStats.lastPlayed),
        distribution,
      });
    }
  }

  if (!destination.has('best-streak')) {
    const legacyBest = readJson(storage, 'mpg_best_streak', null);
    if (Number.isInteger(legacyBest) && legacyBest >= 0) destination.set('best-streak', legacyBest);
  }
}

