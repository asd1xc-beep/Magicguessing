import { comparePlayers } from '../game/compare.js';
import { createNameIndex, resolvePlayerId } from '../game/names.js';
import {
  createShuffleBag,
  localDateKey,
  practicePool,
  scheduledPlayerId,
  scoreForGuess,
} from '../game/rules.js';
import { defaultStats, liveStreak, recordDailyResult } from '../game/stats.js';
import { createTeamStorage } from '../game/storage.js';
import { attachAutocomplete } from './autocomplete.js';
import { appendClue, appendGuessRow, renderDailyStats } from './render.js';

export const SELECTED_TEAM_KEY = 'nba-guess:v1:selected-team';

export function buildTeamOptions(registry) {
  return registry.map(({ id, label }) => ({ value: id, label }));
}

export function resolveInitialTeamId(storage, registry) {
  let saved = null;
  try {
    saved = storage.getItem(SELECTED_TEAM_KEY);
  } catch {
    // Storage is best effort; the first registered team remains available.
  }
  return registry.some((team) => team.id === saved) ? saved : registry[0]?.id ?? null;
}

export function createTeamController({ storage, registry, loadTeam, onTeamChange }) {
  let activeTeam = null;
  let selectionGeneration = 0;

  async function selectTeam(teamId) {
    if (!registry.some((team) => team.id === teamId)) throw new Error(`Unknown team: ${teamId}`);
    const generation = ++selectionGeneration;
    const team = await loadTeam(teamId);
    if (generation !== selectionGeneration) return activeTeam;
    activeTeam = team;
    try {
      storage.setItem(SELECTED_TEAM_KEY, teamId);
    } catch {
      // The game remains usable when browser storage is unavailable.
    }
    await onTeamChange(team);
    return team;
  }

  return {
    get activeTeam() {
      return activeTeam;
    },
    start() {
      const initialTeamId = resolveInitialTeamId(storage, registry);
      if (!initialTeamId) throw new Error('No teams are registered');
      return selectTeam(initialTeamId);
    },
    selectTeam,
  };
}

function daysBetween(start, end) {
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  return Math.round((endTime - startTime) / 86_400_000);
}

export function createApp({
  document,
  storage,
  registry,
  loadTeam,
  now = () => new Date(),
  random = Math.random,
  navigator: navigatorApi = globalThis.navigator,
}) {
  const elements = {
    pageTitle: document.getElementById('page-title'),
    pageDescription: document.getElementById('page-description'),
    teamSelector: document.getElementById('team-selector'),
    modeSelector: document.getElementById('mode-selector'),
    statusBar: document.getElementById('status-bar'),
    guessCounter: document.getElementById('guess-counter'),
    clues: document.getElementById('clues-container'),
    gameControls: document.getElementById('game-controls'),
    guessForm: document.getElementById('guess-form'),
    playerInput: document.getElementById('player-input'),
    guessMessage: document.getElementById('guess-message'),
    postGame: document.getElementById('post-game-controls'),
    resultTitle: document.getElementById('game-result-title'),
    resultAnswer: document.getElementById('game-result-answer'),
    resultPoints: document.getElementById('game-result-points'),
    resultSummary: document.getElementById('game-result-summary'),
    dailyExtras: document.getElementById('daily-extras'),
    shareButton: document.getElementById('share-btn'),
    shareMessage: document.getElementById('share-msg'),
    dailyStats: document.getElementById('daily-stats'),
    countdown: document.getElementById('countdown'),
    nextButton: document.getElementById('next-btn'),
    history: document.getElementById('guesses-history'),
    dataNote: document.getElementById('data-note'),
    dailyUnavailable: document.getElementById('daily-unavailable'),
    dailyUnavailableMessage: document.getElementById('daily-unavailable-message'),
    dailyPracticeButton: document.getElementById('daily-practice-btn'),
    postDailyPracticeButton: document.getElementById('post-daily-practice-btn'),
  };

  let team = null;
  let teamStorage = null;
  let nameIndex = createNameIndex([]);
  let currentMode = 'daily';
  let currentDate = null;
  let targetPlayerId = null;
  let guessCount = 0;
  let guessedPlayerIds = [];
  let gridRows = [];
  let gameOver = false;
  let lastPoints = 0;
  let session = { score: 0, streak: 0 };
  let bestStreak = 0;
  let bags = new Map();
  let countdownTimer = null;
  let autocomplete = null;
  let started = false;

  const controller = createTeamController({
    storage,
    registry,
    loadTeam,
    onTeamChange: activateTeam,
  });

  function identity(playerId) {
    return team.identityById.get(playerId);
  }

  function activeModeConfig() {
    return team.config.modes.find((mode) => mode.id === currentMode);
  }

  function setMessage(message) {
    elements.guessMessage.textContent = message;
  }

  function applyTheme(config) {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(config.theme)) {
      root.style.setProperty(`--team-${name}`, value);
    }
    document.title = config.copy.pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', config.copy.description);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', config.copy.pageTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', config.copy.description);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', config.theme.background);
  }

  function renderModes() {
    elements.modeSelector.innerHTML = '';
    for (const mode of team.config.modes) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.mode = mode.id;
      button.className = `mode-button ${mode.id === currentMode ? 'mode-button-active' : 'mode-button-idle'}`;
      button.setAttribute('aria-pressed', String(mode.id === currentMode));
      const count = mode.difficulties ? practicePool(team.players, mode).length : null;
      button.textContent = count == null ? mode.label : `${mode.label} (${count})`;
      button.addEventListener('click', () => setMode(mode.id));
      elements.modeSelector.appendChild(button);
    }
  }

  function renderStatus() {
    elements.statusBar.innerHTML = '';
    const chip = (text) => {
      const element = document.createElement('span');
      element.className = 'chip';
      element.textContent = text;
      elements.statusBar.appendChild(element);
    };

    if (currentMode === 'daily') {
      const number = Math.max(0, daysBetween(team.config.rules.dailyNumberEpoch, currentDate)) + 1;
      const date = now().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const stats = teamStorage.get('stats', defaultStats(team.config.rules.maxGuesses));
      chip(`Daily #${number} · ${date}`);
      chip(`🔥 Streak ${liveStreak(stats, currentDate)}`);
    } else {
      chip(`Score ${session.score}`);
      chip(`Streak ${session.streak}`);
      chip(`Best streak ${bestStreak}`);
    }
  }

  function showClue(index) {
    const answer = team.playerById.get(targetPlayerId)?.answer;
    if (answer?.clues[index]) appendClue(document, elements.clues, answer.clues[index], index);
  }

  function updateCounter() {
    const nextGuess = Math.min(guessCount + 1, team.config.rules.maxGuesses);
    const points = scoreForGuess(team.config.rules.points, nextGuess);
    elements.guessCounter.textContent = `Guess ${nextGuess} of ${team.config.rules.maxGuesses} · ${points} pts`;
  }

  function nextPracticePlayer() {
    const mode = activeModeConfig();
    let bag = bags.get(mode.id) ?? [];
    if (bag.length === 0) {
      bag = createShuffleBag(practicePool(team.players, mode).map((player) => player.playerId), random);
    }
    const next = bag.pop() ?? null;
    bags.set(mode.id, bag);
    return next;
  }

  function resetRoundView() {
    guessCount = 0;
    guessedPlayerIds = [];
    gridRows = [];
    gameOver = false;
    lastPoints = 0;
    elements.clues.innerHTML = '';
    elements.history.innerHTML = '';
    elements.playerInput.value = '';
    elements.shareMessage.textContent = '';
    setMessage('');
    autocomplete?.close();
    elements.gameControls.classList.remove('hidden');
    elements.postGame.classList.add('hidden');
    elements.dailyUnavailable.classList.add('hidden');
  }

  function initGame() {
    resetRoundView();
    currentDate = localDateKey(now());

    if (currentMode === 'daily') {
      targetPlayerId = scheduledPlayerId(team.schedule, now());
      if (!targetPlayerId) {
        elements.gameControls.classList.add('hidden');
        elements.dailyUnavailable.classList.remove('hidden');
        elements.dailyUnavailableMessage.textContent = team.config.copy.missingDaily;
        elements.guessCounter.textContent = 'Daily unavailable';
        renderStatus();
        return;
      }
    } else {
      targetPlayerId = nextPracticePlayer();
    }

    showClue(0);
    updateCounter();
    renderStatus();

    if (currentMode === 'daily') {
      const saved = teamStorage.get('daily', null);
      if (saved?.date === currentDate && (!saved.answerId || saved.answerId === targetPlayerId)) {
        for (const playerId of saved.guesses ?? []) {
          if (gameOver) break;
          if (team.playerById.has(playerId)) applyGuess(playerId, true);
        }
      }
    }
  }

  function addGuess(playerId, correct) {
    const guess = team.playerById.get(playerId);
    const answer = team.playerById.get(targetPlayerId);
    const tiles = comparePlayers(guess, answer, team.config.rules.comparison);
    gridRows.push(tiles.map((tile) => tile.color));
    appendGuessRow(document, elements.history, {
      name: identity(playerId).name,
      correct,
      tiles,
    });
  }

  function applyGuess(playerId, restoring = false) {
    guessCount += 1;
    guessedPlayerIds.push(playerId);
    const correct = playerId === targetPlayerId;
    addGuess(playerId, correct);

    if (currentMode === 'daily' && !restoring) {
      teamStorage.set('daily', {
        date: currentDate,
        answerId: targetPlayerId,
        guesses: guessedPlayerIds,
      });
    }

    if (correct) return endGame(true);
    if (guessCount >= team.config.rules.maxGuesses) return endGame(false);
    updateCounter();
    showClue(guessCount);
  }

  function endGame(isWin) {
    gameOver = true;
    lastPoints = isWin ? scoreForGuess(team.config.rules.points, guessCount) : 0;
    elements.gameControls.classList.add('hidden');
    elements.postGame.classList.remove('hidden');
    elements.guessCounter.textContent = isWin ? `Solved in ${guessCount}` : 'Out of guesses';

    const answerName = identity(targetPlayerId).name;
    elements.resultTitle.textContent = isWin ? 'You Got It!' : 'Game Over';
    elements.resultTitle.className = `text-3xl font-bold mb-2 ${isWin ? 'text-green-400' : 'text-red-400'}`;
    elements.resultAnswer.textContent = isWin
      ? `You guessed ${answerName} in ${guessCount} ${guessCount === 1 ? 'try' : 'tries'}.`
      : `Out of guesses! The player was ${answerName}.`;
    elements.resultPoints.textContent = `+${lastPoints} points`;
    elements.resultSummary.textContent = team.playerById.get(targetPlayerId).answer.summary;

    if (!isWin) {
      for (let index = guessCount; index < team.config.rules.maxGuesses; index += 1) showClue(index);
    }

    const daily = currentMode === 'daily';
    elements.dailyExtras.classList.toggle('hidden', !daily);
    elements.nextButton.classList.toggle('hidden', daily);

    if (daily) {
      const stats = recordDailyResult(
        teamStorage.get('stats', defaultStats(team.config.rules.maxGuesses)),
        { date: currentDate, isWin, guessCount },
      );
      teamStorage.set('stats', stats);
      renderDailyStats(document, elements.dailyStats, stats, {
        currentStreak: liveStreak(stats, currentDate),
        isWin,
        guessCount,
      });
    } else {
      session.score += lastPoints;
      session.streak = isWin ? session.streak + 1 : 0;
      if (session.streak > bestStreak) {
        bestStreak = session.streak;
        teamStorage.set('best-streak', bestStreak);
      }
    }
    renderStatus();
  }

  function setMode(modeId) {
    if (!team.config.modes.some((mode) => mode.id === modeId)) throw new Error(`Unknown mode: ${modeId}`);
    currentMode = modeId;
    renderModes();
    initGame();
  }

  async function activateTeam(nextTeam) {
    team = nextTeam;
    teamStorage = createTeamStorage(storage, team.config.id);
    nameIndex = createNameIndex(team.identities, new Set(team.players.map((player) => player.playerId)));
    team.migrateLegacy?.(storage, nameIndex);
    currentMode = team.config.modes[0].id;
    session = { score: 0, streak: 0 };
    bestStreak = teamStorage.get('best-streak', 0);
    bags = new Map();
    applyTheme(team.config);
    elements.teamSelector.value = team.config.id;
    elements.pageTitle.textContent = team.config.copy.pageTitle;
    elements.pageDescription.textContent = team.config.copy.description;
    elements.dataNote.textContent = `Points: ${team.config.rules.points.join(', ')} from the first clue through the last. The daily player changes at midnight your time. ${team.config.copy.footer}`;
    renderModes();
    initGame();
  }

  function handleGuessSubmit(event) {
    event.preventDefault();
    if (gameOver || !targetPlayerId) return;
    const raw = elements.playerInput.value.trim();
    if (!raw) return;
    const playerId = resolvePlayerId(raw, nameIndex);
    if (!playerId) {
      setMessage(team.config.copy.unknownPlayer);
      elements.playerInput.classList.remove('shake');
      void elements.playerInput.offsetWidth;
      elements.playerInput.classList.add('shake');
      return;
    }
    if (guessedPlayerIds.includes(playerId)) {
      setMessage(`You already guessed ${identity(playerId).name}.`);
      elements.playerInput.classList.remove('shake');
      void elements.playerInput.offsetWidth;
      elements.playerInput.classList.add('shake');
      return;
    }
    setMessage('');
    autocomplete.close();
    elements.playerInput.value = '';
    applyGuess(playerId);
  }

  function shareText() {
    const won = guessedPlayerIds.includes(targetPlayerId);
    const emoji = { g: '🟩', y: '🟨', x: '⬛' };
    const lines = gridRows.map((row) => row.map((color) => emoji[color]).join(''));
    const number = Math.max(0, daysBetween(team.config.rules.dailyNumberEpoch, currentDate)) + 1;
    let text = `${team.config.copy.shareTitle} #${number} — ${won ? guessCount : 'X'}/${team.config.rules.maxGuesses} · ${lastPoints} pts\n${lines.join('\n')}`;
    const location = document.defaultView?.location;
    if (location?.protocol?.startsWith('http')) text += `\n${location.origin}${location.pathname}`;
    return text;
  }

  async function shareResult() {
    const text = shareText();
    try {
      if (navigatorApi?.share && /Mobi|Android|iPhone|iPad/i.test(navigatorApi.userAgent ?? '')) {
        await navigatorApi.share({ text });
        return;
      }
      await navigatorApi.clipboard.writeText(text);
      elements.shareMessage.textContent = 'Result copied. Paste it anywhere!';
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        elements.shareMessage.textContent = 'Result copied. Paste it anywhere!';
      } catch {
        elements.shareMessage.textContent = 'Could not copy automatically.';
      }
      textarea.remove();
    }
  }

  function tickCountdown() {
    if (!team) return;
    const current = now();
    const midnight = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1);
    let seconds = Math.max(0, Math.floor((midnight - current) / 1000));
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;
    elements.countdown.textContent = `Next daily player in ${hours}h ${minutes}m ${seconds}s`;
    if (currentMode === 'daily' && localDateKey(current) !== currentDate) initGame();
  }

  function attachEvents() {
    elements.teamSelector.addEventListener('change', () => controller.selectTeam(elements.teamSelector.value));
    elements.guessForm.addEventListener('submit', handleGuessSubmit);
    elements.shareButton.addEventListener('click', shareResult);
    elements.nextButton.addEventListener('click', initGame);
    elements.dailyPracticeButton.addEventListener('click', () => setMode('all'));
    elements.postDailyPracticeButton.addEventListener('click', () => setMode('all'));
    autocomplete = attachAutocomplete({
      document,
      input: elements.playerInput,
      getIndex: () => nameIndex,
      onInput: () => setMessage(''),
    });
  }

  async function start() {
    if (started) return controller.activeTeam;
    started = true;
    for (const option of buildTeamOptions(registry)) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      elements.teamSelector.appendChild(element);
    }
    attachEvents();
    const activeTeam = await controller.start();
    tickCountdown();
    countdownTimer = setInterval(tickCountdown, 1000);
    return activeTeam;
  }

  function destroy() {
    if (countdownTimer) clearInterval(countdownTimer);
    autocomplete?.destroy();
  }

  return {
    start,
    selectTeam: controller.selectTeam,
    setMode,
    destroy,
  };
}

