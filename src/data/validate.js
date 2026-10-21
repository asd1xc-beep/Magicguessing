import { normalizeName } from '../game/names.js';

const VALID_POSITIONS = new Set(['G', 'F', 'C', 'G/F', 'F/C']);
const VALID_DIFFICULTIES = new Set(['headliner', 'deep-cut']);
const REQUIRED_COPY = [
  'pageTitle', 'description', 'unknownPlayer', 'shareTitle', 'footer',
  'missingDaily', 'seasonLabel',
];
const REQUIRED_THEME = ['primary', 'hover', 'border', 'text'];

function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function nextDateKey(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}

function validateIdentities(identities, errors) {
  const ids = new Set();
  const labels = new Map();

  for (const identity of identities) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identity.id ?? '')) {
      errors.push(`Invalid player ID: ${identity.id ?? '(missing)'}`);
    }
    if (ids.has(identity.id)) errors.push(`Duplicate player ID: ${identity.id}`);
    ids.add(identity.id);

    if (!isNonEmpty(identity.name)) errors.push(`Player ${identity.id} has no canonical name`);
    for (const label of [identity.name, ...(identity.aliases ?? [])]) {
      const normalized = normalizeName(label);
      if (!normalized) continue;
      if (!labels.has(normalized)) labels.set(normalized, new Set());
      labels.get(normalized).add(identity.id);
    }
  }

  for (const [label, playerIds] of labels) {
    if (playerIds.size > 1) {
      errors.push(`Ambiguous normalized name or alias "${label}": ${[...playerIds].join(', ')}`);
    }
  }
  return ids;
}

function validateConfig(config, errors) {
  for (const key of ['id', 'name', 'shortName', 'abbreviation']) {
    if (!isNonEmpty(config?.[key])) errors.push(`Team config is missing ${key}`);
  }
  for (const key of REQUIRED_COPY) {
    if (!isNonEmpty(config?.copy?.[key])) errors.push(`Team ${config?.id ?? '(missing)'} is missing copy.${key}`);
  }
  for (const key of REQUIRED_THEME) {
    if (!isNonEmpty(config?.theme?.[key])) errors.push(`Team ${config?.id ?? '(missing)'} is missing theme.${key}`);
  }
  if (!Array.isArray(config?.modes) || config.modes.length === 0) {
    errors.push(`Team ${config?.id ?? '(missing)'} has no modes`);
  }
  if (!Number.isInteger(config?.rules?.maxGuesses) || config.rules.maxGuesses < 1) {
    errors.push(`Team ${config?.id ?? '(missing)'} has invalid rules.maxGuesses`);
  }
  if (!Array.isArray(config?.rules?.points)
      || config.rules.points.length !== config.rules.maxGuesses
      || config.rules.points.some((point) => !Number.isFinite(point))) {
    errors.push(`Team ${config?.id ?? '(missing)'} has invalid rules.points`);
  }
}

function validateStats(teamId, playerId, stats, errors) {
  const prefix = `Team ${teamId} player ${playerId}`;
  if (!VALID_POSITIONS.has(stats?.position)) errors.push(`${prefix} has invalid position`);
  if (!Number.isInteger(stats?.firstSeason)) errors.push(`${prefix} has invalid firstSeason`);
  if (!Number.isInteger(stats?.seasons) || stats.seasons < 1) errors.push(`${prefix} has invalid seasons`);
  if (!Number.isInteger(stats?.games) || stats.games < 0) errors.push(`${prefix} has invalid games`);
  if (!Number.isFinite(stats?.pointsPerGame) || stats.pointsPerGame < 0) errors.push(`${prefix} has invalid pointsPerGame`);
  if (!Array.isArray(stats?.numbers) || stats.numbers.some((number) => typeof number !== 'string' || !/^\d{1,2}$/.test(number))) {
    errors.push(`${prefix} has invalid numbers`);
  }
}

function validateAnswer(teamId, player, errors) {
  if (!player.answer) return;
  const prefix = `Team ${teamId} player ${player.playerId}`;
  if (!VALID_DIFFICULTIES.has(player.answer.difficulty)) errors.push(`${prefix} has invalid difficulty`);
  if (!Array.isArray(player.answer.clues)
      || player.answer.clues.length !== 5
      || player.answer.clues.some((clue) => !isNonEmpty(clue))) {
    errors.push(`${prefix} must have five non-empty clues`);
  }
  if (!isNonEmpty(player.answer.summary)) errors.push(`${prefix} has an empty answer summary`);
}

function isDailyEligible(player, config) {
  if (!player?.answer) return false;
  const rule = config.rules.dailyEligibility;
  return rule.difficulties.includes(player.answer.difficulty)
    || player.stats.games >= rule.minimumGamesForOthers;
}

function validateSchedule(team, playerMap, errors) {
  const validDates = [];
  for (const [date, playerId] of Object.entries(team.schedule ?? {})) {
    if (!validDateKey(date)) {
      errors.push(`Team ${team.config.id} has invalid schedule date: ${date}`);
      continue;
    }
    validDates.push(date);
    const player = playerMap.get(playerId);
    if (!player) {
      errors.push(`Team ${team.config.id} has unknown scheduled player: ${playerId}`);
    } else if (!isDailyEligible(player, team.config)) {
      errors.push(`Team ${team.config.id} scheduled player is not daily eligible: ${playerId}`);
    }
  }

  validDates.sort();
  for (let index = 1; index < validDates.length; index += 1) {
    if (validDates[index] !== nextDateKey(validDates[index - 1])) {
      errors.push(`Team ${team.config.id} has a schedule gap after ${validDates[index - 1]}`);
    }
  }
}

export function validateRegistry(teams, identities) {
  const errors = [];
  const warnings = [];
  const identityIds = validateIdentities(identities, errors);
  const teamIds = new Set();

  for (const team of teams) {
    validateConfig(team.config, errors);
    const teamId = team.config?.id ?? '(missing)';
    if (teamIds.has(teamId)) errors.push(`Duplicate team ID: ${teamId}`);
    teamIds.add(teamId);

    const sourceIds = new Set((team.config?.dataset?.sources ?? []).map((source) => source.id));
    const teamPlayerIds = new Set();
    const playerMap = new Map();
    let unverified = 0;

    for (const player of team.players ?? []) {
      if (teamPlayerIds.has(player.playerId)) errors.push(`Duplicate team player: ${player.playerId}`);
      teamPlayerIds.add(player.playerId);
      playerMap.set(player.playerId, player);
      if (!identityIds.has(player.playerId)) errors.push(`Team ${teamId} references unknown player ID: ${player.playerId}`);
      validateStats(teamId, player.playerId, player.stats, errors);
      validateAnswer(teamId, player, errors);

      if (player.provenance?.verifiedAt == null) unverified += 1;
      else if (!validDateKey(player.provenance.verifiedAt)) errors.push(`Team ${teamId} player ${player.playerId} has invalid verifiedAt`);
      for (const sourceRef of player.provenance?.sourceRefs ?? []) {
        if (!sourceIds.has(sourceRef)) errors.push(`Team ${teamId} player ${player.playerId} has unknown source reference: ${sourceRef}`);
      }
    }

    if (unverified > 0) warnings.push(`Team ${teamId}: ${unverified} player record${unverified === 1 ? '' : 's'} have no verification date`);
    validateSchedule(team, playerMap, errors);
  }

  return { errors, warnings };
}

