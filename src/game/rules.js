export function scoreForGuess(points, guessNumber) {
  if (!Number.isInteger(guessNumber) || guessNumber < 1) return 0;
  return points[guessNumber - 1] ?? 0;
}

export function practicePool(players, mode) {
  const allowed = new Set(mode.difficulties);
  return players.filter((player) => player.answer && allowed.has(player.answer.difficulty));
}

export function createShuffleBag(ids, random = Math.random) {
  const bag = [...ids];
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }
  return bag;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function scheduledPlayerId(schedule, date = new Date()) {
  return schedule[localDateKey(date)] ?? null;
}


/**
 * Whether a team player may be scheduled as a daily answer under the team's published rule:
 * answer data is required; the player must be in a listed difficulty or have enough games;
 * and, when the rule sets minimumFirstSeason (an era cutoff, as a season-ending year),
 * the player's first season with the team must be that season or later.
 */
export function isDailyEligible(player, rule) {
  if (!player?.answer || !rule) return false;
  const byDifficulty = Array.isArray(rule.difficulties) && rule.difficulties.includes(player.answer.difficulty);
  const byGames = Number.isInteger(rule.minimumGamesForOthers) && player.stats?.games >= rule.minimumGamesForOthers;
  if (!byDifficulty && !byGames) return false;
  if (rule.minimumFirstSeason != null && !(player.stats?.firstSeason >= rule.minimumFirstSeason)) return false;
  return true;
}
