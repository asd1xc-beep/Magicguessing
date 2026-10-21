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

