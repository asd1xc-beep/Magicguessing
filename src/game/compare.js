function shortSeason(year) {
  return `${String(year - 1).slice(2)}–${String(year).slice(2)}`;
}

function numericTile(key, value, guess, answer, closeWithin, label) {
  if (guess === answer) {
    return { key, value, color: 'g', arrow: '', title: `${label}: match` };
  }

  const close = Math.abs(guess - answer) <= closeWithin;
  const direction = answer > guess ? 'higher' : 'lower';
  return {
    key,
    value,
    color: close ? 'y' : 'x',
    arrow: answer > guess ? '↑' : '↓',
    title: `${label}: answer is ${direction}${close ? ' (close)' : ''}`,
  };
}

function jerseyTile(guessNumbers, answerNumbers, comparison) {
  const label = comparison.labels.jersey;
  if (!guessNumbers.length || !answerNumbers.length) {
    return {
      key: 'No.',
      value: guessNumbers.length ? `#${guessNumbers.join('/')}` : '—',
      color: 'x',
      arrow: '',
      title: label,
    };
  }

  const shared = guessNumbers.find((number) => answerNumbers.includes(number));
  if (shared !== undefined) {
    return { key: 'No.', value: `#${shared}`, color: 'g', arrow: '', title: `${label}: match` };
  }

  const guessValues = guessNumbers.map(Number);
  const answerValues = answerNumbers.map(Number);
  const close = guessValues.some((guess) => answerValues.some(
    (answer) => Math.abs(guess - answer) <= comparison.thresholds.jersey,
  ));
  const guessMinimum = Math.min(...guessValues);
  const answerMinimum = Math.min(...answerValues);
  const direction = answerMinimum > guessMinimum ? 'higher' : 'lower';

  return {
    key: 'No.',
    value: `#${guessNumbers.join('/')}`,
    color: close ? 'y' : 'x',
    arrow: answerMinimum === guessMinimum ? '' : answerMinimum > guessMinimum ? '↑' : '↓',
    title: `${label}: answer is ${direction}${close ? ' (close)' : ''}`,
  };
}

export function comparePlayers(guessPlayer, answerPlayer, comparison) {
  const guess = guessPlayer.stats;
  const answer = answerPlayer.stats;
  const guessPositions = guess.position.split('/');
  const answerPositions = answer.position.split('/');
  const positionColor = guess.position === answer.position
    ? 'g'
    : guessPositions.some((position) => answerPositions.includes(position)) ? 'y' : 'x';

  return [
    {
      key: 'Pos',
      value: guess.position,
      color: positionColor,
      arrow: '',
      title: `${comparison.labels.position}: ${positionColor === 'g' ? 'match' : positionColor === 'y' ? 'partial match' : 'no match'}`,
    },
    numericTile('Debut', shortSeason(guess.firstSeason), guess.firstSeason, answer.firstSeason, comparison.thresholds.debut, comparison.labels.debut),
    numericTile('Yrs', String(guess.seasons), guess.seasons, answer.seasons, comparison.thresholds.seasons, comparison.labels.seasons),
    numericTile('Games', String(guess.games), guess.games, answer.games, comparison.thresholds.games, comparison.labels.games),
    numericTile('PPG', guess.pointsPerGame.toFixed(1), guess.pointsPerGame, answer.pointsPerGame, comparison.thresholds.pointsPerGame, comparison.labels.pointsPerGame),
    jerseyTile(guess.numbers, answer.numbers, comparison),
  ];
}

