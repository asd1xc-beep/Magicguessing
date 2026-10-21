function previousDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function defaultStats(maxGuesses) {
  return {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastWinDate: null,
    lastPlayedDate: null,
    distribution: Array.from({ length: maxGuesses }, () => 0),
  };
}

export function recordDailyResult(stats, { date, isWin, guessCount }) {
  const next = { ...stats, distribution: [...stats.distribution] };
  if (next.lastPlayedDate === date) return next;

  next.played += 1;
  next.lastPlayedDate = date;
  if (!isWin) {
    next.currentStreak = 0;
    return next;
  }

  next.wins += 1;
  if (guessCount >= 1 && guessCount <= next.distribution.length) {
    next.distribution[guessCount - 1] += 1;
  }
  next.currentStreak = next.lastWinDate === previousDate(date) ? next.currentStreak + 1 : 1;
  next.lastWinDate = date;
  next.maxStreak = Math.max(next.maxStreak, next.currentStreak);
  return next;
}

export function liveStreak(stats, today) {
  return stats.lastWinDate === today || stats.lastWinDate === previousDate(today)
    ? stats.currentStreak
    : 0;
}

