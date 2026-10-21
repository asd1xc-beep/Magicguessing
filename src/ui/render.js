export function appendClue(document, container, clue, index) {
  const clueElement = document.createElement('div');
  clueElement.className = 'clue-reveal bg-gray-800 p-4 rounded-lg border-l-4 text-gray-200';
  const label = document.createElement('span');
  label.className = 'font-bold team-accent';
  label.textContent = `Clue ${index + 1}:`;
  clueElement.append(label, document.createTextNode(` ${clue}`));
  container.appendChild(clueElement);
}

export function appendGuessRow(document, container, { name, correct, tiles }) {
  const row = document.createElement('div');
  row.className = `guess-row rounded-lg p-2 border ${correct ? 'bg-green-900/40 border-green-500' : 'bg-slate-900/60 border-slate-600'}`;
  const heading = document.createElement('div');
  heading.className = 'flex justify-between items-center px-1 mb-1.5 text-sm';
  const playerName = document.createElement('span');
  playerName.className = 'font-semibold truncate';
  playerName.textContent = name;
  const result = document.createElement('span');
  result.className = `font-bold ${correct ? 'text-green-300' : 'text-red-300'}`;
  result.textContent = correct ? '✓ CORRECT' : '✗';
  heading.append(playerName, result);

  const grid = document.createElement('div');
  grid.className = 'tiles';
  tiles.forEach((entry, index) => {
    const tile = document.createElement('div');
    tile.className = `tile t-${entry.color} flip-in`;
    tile.style.animationDelay = `${index * 60}ms`;
    tile.title = entry.title;
    tile.setAttribute('aria-label', `${entry.key} ${entry.value}. ${entry.title}`);
    const key = document.createElement('div');
    key.className = 'tile-k';
    key.textContent = entry.key;
    const value = document.createElement('div');
    value.className = 'tile-v';
    value.textContent = entry.value;
    const arrow = document.createElement('span');
    arrow.className = 'tile-a';
    arrow.textContent = entry.arrow;
    value.appendChild(arrow);
    tile.append(key, value);
    grid.appendChild(tile);
  });

  row.append(heading, grid);
  container.appendChild(row);
}

export function renderDailyStats(document, container, stats, { currentStreak, isWin, guessCount }) {
  container.innerHTML = '';
  const summary = document.createElement('div');
  summary.className = 'grid grid-cols-4 gap-2 text-center mb-4';
  const values = [
    [stats.played, 'Played'],
    [stats.played ? Math.round((100 * stats.wins) / stats.played) : 0, 'Win %'],
    [currentStreak, 'Streak'],
    [stats.maxStreak, 'Max streak'],
  ];
  for (const [value, label] of values) {
    const cell = document.createElement('div');
    const number = document.createElement('div');
    number.className = 'text-2xl font-bold';
    number.textContent = value;
    const caption = document.createElement('div');
    caption.className = 'text-[11px] text-gray-400';
    caption.textContent = label;
    cell.append(number, caption);
    summary.appendChild(cell);
  }
  container.appendChild(summary);

  const top = Math.max(1, ...stats.distribution);
  stats.distribution.forEach((count, index) => {
    const line = document.createElement('div');
    line.className = 'flex items-center gap-2 mb-1 text-sm';
    const label = document.createElement('span');
    label.className = 'w-3 text-gray-300';
    label.textContent = index + 1;
    const bar = document.createElement('span');
    bar.className = `dist-bar${isWin && index === guessCount - 1 ? ' today' : ''}`;
    bar.style.width = `${Math.max(8, Math.round((100 * count) / top))}%`;
    bar.textContent = count;
    line.append(label, bar);
    container.appendChild(line);
  });
}

