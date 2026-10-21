import { resolvePlayerId } from '../../game/names.js';
import { defaultStats } from '../../game/stats.js';
import { createTeamStorage } from '../../game/storage.js';

function readJson(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function dateFromDayIndex(epoch, dayIndex) {
  if (!Number.isInteger(dayIndex) || dayIndex < 0) return null;
  const date = new Date(`${epoch}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayIndex);
  return date.toISOString().slice(0, 10);
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function migrateLegacyProgress(storage, nameIndex, {
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

