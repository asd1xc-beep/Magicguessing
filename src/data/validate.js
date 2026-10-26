import { normalizeName } from '../game/names.js';
import { isDailyEligible, localDateKey } from '../game/rules.js';

const VALID_POSITIONS = new Set(['G', 'F', 'C', 'G/F', 'F/C']);
const VALID_DIFFICULTIES = new Set(['headliner', 'deep-cut']);
const REQUIRED_COPY = [
  'pageTitle', 'description', 'unknownPlayer', 'shareTitle', 'footer',
  'missingDaily', 'seasonLabel',
];
const REQUIRED_THEME = ['primary', 'hover', 'border', 'text', 'background', 'surface'];
const COMPARISON_FIELDS = ['debut', 'seasons', 'games', 'pointsPerGame', 'jersey'];
const COMPARISON_LABELS = ['position', ...COMPARISON_FIELDS];
const BBREF_ID = /^[a-z]+\d{2}$/;
const LEGACY_VERIFICATION = 'legacy-import';
const SCHEDULE_WARNING_DAYS = 30;

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

function daysBetween(start, end) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

// Different NBA players can share a name (two Dee Browns, a Jr. and a Sr.), so names are
// only required to be unambiguous within a team; see validateTeamNames.
function validateIdentities(identities, errors) {
  const byId = new Map();
  const bbrefIds = new Map();

  for (const identity of identities) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identity.id ?? '')) {
      errors.push(`Invalid player ID: ${identity.id ?? '(missing)'}`);
    }
    if (byId.has(identity.id)) errors.push(`Duplicate player ID: ${identity.id}`);
    byId.set(identity.id, identity);

    if (!isNonEmpty(identity.name)) errors.push(`Player ${identity.id} has no canonical name`);
    if (identity.bbrefId != null) {
      if (!BBREF_ID.test(identity.bbrefId)) {
        errors.push(`Player ${identity.id} has an invalid bbrefId: ${identity.bbrefId}`);
      } else if (bbrefIds.has(identity.bbrefId)) {
        errors.push(`Players ${bbrefIds.get(identity.bbrefId)} and ${identity.id} share bbrefId ${identity.bbrefId}; reuse one identity instead`);
      } else {
        bbrefIds.set(identity.bbrefId, identity.id);
      }
    }
  }
  return byId;
}

function validateTeamNames(teamId, playerIds, identitiesById, errors) {
  const labels = new Map();
  for (const playerId of playerIds) {
    const identity = identitiesById.get(playerId);
    if (!identity) continue;
    for (const label of [identity.name, ...(identity.aliases ?? [])]) {
      const normalized = normalizeName(label);
      if (!normalized) continue;
      if (!labels.has(normalized)) labels.set(normalized, new Set());
      labels.get(normalized).add(identity.id);
    }
  }
  for (const [label, ids] of labels) {
    if (ids.size > 1) {
      errors.push(`Team ${teamId} has an ambiguous normalized name or alias "${label}": ${[...ids].join(', ')}. Give one player a distinguishing display name.`);
    }
  }
}

function validateConfig(config, errors) {
  const teamId = config?.id ?? '(missing)';
  for (const key of ['id', 'name', 'shortName', 'abbreviation']) {
    if (!isNonEmpty(config?.[key])) errors.push(`Team config is missing ${key}`);
  }
  for (const key of REQUIRED_COPY) {
    if (!isNonEmpty(config?.copy?.[key])) errors.push(`Team ${teamId} is missing copy.${key}`);
  }
  for (const key of REQUIRED_THEME) {
    if (!isNonEmpty(config?.theme?.[key])) errors.push(`Team ${teamId} is missing theme.${key}`);
  }
  if (!Array.isArray(config?.modes) || config.modes.length === 0) {
    errors.push(`Team ${teamId} has no modes`);
  } else {
    const modeIds = new Set();
    for (const mode of config.modes) {
      if (!isNonEmpty(mode?.id) || !isNonEmpty(mode?.label)) {
        errors.push(`Team ${teamId} has a mode with an invalid id or label`);
        continue;
      }
      if (modeIds.has(mode.id)) errors.push(`Team ${teamId} has duplicate mode: ${mode.id}`);
      modeIds.add(mode.id);
      if (mode.id !== 'daily'
          && (!Array.isArray(mode.difficulties)
            || mode.difficulties.length === 0
            || mode.difficulties.some((difficulty) => !VALID_DIFFICULTIES.has(difficulty)))) {
        errors.push(`Team ${teamId} mode ${mode.id} has invalid difficulties`);
      }
    }
    if (!modeIds.has('daily')) errors.push(`Team ${teamId} must define a daily mode`);
    if (!modeIds.has('all')) errors.push(`Team ${teamId} must define an all mode`);
  }
  if (!Number.isInteger(config?.rules?.maxGuesses) || config.rules.maxGuesses < 1) {
    errors.push(`Team ${teamId} has invalid rules.maxGuesses`);
  }
  if (!Array.isArray(config?.rules?.points)
      || config.rules.points.length !== config?.rules?.maxGuesses
      || config.rules.points.some((point) => !Number.isFinite(point))) {
    errors.push(`Team ${teamId} has invalid rules.points`);
  }
  if (!validDateKey(config?.rules?.dailyNumberEpoch)) {
    errors.push(`Team ${teamId} has invalid rules.dailyNumberEpoch`);
  }

  const eligibility = config?.rules?.dailyEligibility;
  if (!Array.isArray(eligibility?.difficulties)
      || eligibility.difficulties.some((difficulty) => !VALID_DIFFICULTIES.has(difficulty))
      || !Number.isInteger(eligibility?.minimumGamesForOthers)
      || eligibility.minimumGamesForOthers < 0
      || (eligibility.minimumFirstSeason != null && !Number.isInteger(eligibility.minimumFirstSeason))) {
    errors.push(`Team ${teamId} has invalid rules.dailyEligibility`);
  }

  const comparison = config?.rules?.comparison;
  if (!comparison || typeof comparison !== 'object') {
    errors.push(`Team ${teamId} has invalid rules.comparison`);
  } else {
    for (const key of COMPARISON_FIELDS) {
      if (!Number.isFinite(comparison.thresholds?.[key]) || comparison.thresholds[key] < 0) {
        errors.push(`Team ${teamId} has invalid rules.comparison.thresholds.${key}`);
      }
    }
    for (const key of COMPARISON_LABELS) {
      if (!isNonEmpty(comparison.labels?.[key])) {
        errors.push(`Team ${teamId} is missing rules.comparison.labels.${key}`);
      }
    }
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

function validateSchedule(team, playerMap, errors, warnings, today) {
  const validDates = [];
  for (const [date, playerId] of Object.entries(team.schedule ?? {})) {
    if (!validDateKey(date)) {
      errors.push(`Team ${team.config?.id ?? '(missing)'} has invalid schedule date: ${date}`);
      continue;
    }
    validDates.push(date);
    const player = playerMap.get(playerId);
    if (!player) {
      errors.push(`Team ${team.config?.id ?? '(missing)'} has unknown scheduled player: ${playerId}`);
    } else if (!isDailyEligible(player, team.config?.rules?.dailyEligibility)) {
      errors.push(`Team ${team.config?.id ?? '(missing)'} scheduled player is not daily eligible: ${playerId}`);
    }
  }

  validDates.sort();
  for (let index = 1; index < validDates.length; index += 1) {
    if (validDates[index] !== nextDateKey(validDates[index - 1])) {
      errors.push(`Team ${team.config?.id ?? '(missing)'} has a schedule gap after ${validDates[index - 1]}`);
    }
  }

  const lastDate = validDates.at(-1);
  if (today && lastDate) {
    const remaining = daysBetween(today, lastDate);
    const extend = `run: node scripts/extend-schedule.js ${team.config?.id ?? '<team>'}`;
    if (remaining < 0) {
      warnings.push(`Team ${team.config?.id}: the daily schedule ran out on ${lastDate}; ${extend}`);
    } else if (remaining < SCHEDULE_WARNING_DAYS) {
      warnings.push(`Team ${team.config?.id}: the daily schedule ends ${lastDate} (${remaining} day${remaining === 1 ? '' : 's'} left); ${extend}`);
    }
  }
}

/**
 * Validates every team against the shared identity registry.
 * `today` (YYYY-MM-DD) enables schedule-expiry warnings; pass null to skip them.
 */
export function validateRegistry(teams, identities, { today = localDateKey() } = {}) {
  const errors = [];
  const warnings = [];
  const identitiesById = validateIdentities(identities, errors);
  const teamIds = new Set();

  for (const team of teams) {
    validateConfig(team.config, errors);
    const teamId = team.config?.id ?? '(missing)';
    if (teamIds.has(teamId)) errors.push(`Duplicate team ID: ${teamId}`);
    teamIds.add(teamId);

    const sourceIds = new Set((team.config?.dataset?.sources ?? []).map((source) => source.id));
    // Only the migrated Orlando import may lack per-record sourcing; every newer team must cite it.
    const legacy = team.config?.dataset?.verificationStatus === LEGACY_VERIFICATION;
    const teamPlayerIds = new Set();
    const playerMap = new Map();
    let unverified = 0;

    for (const player of team.players ?? []) {
      const prefix = `Team ${teamId} player ${player.playerId}`;
      if (teamPlayerIds.has(player.playerId)) errors.push(`Duplicate team player: ${player.playerId}`);
      teamPlayerIds.add(player.playerId);
      playerMap.set(player.playerId, player);
      const identity = identitiesById.get(player.playerId);
      if (!identity) errors.push(`Team ${teamId} references unknown player ID: ${player.playerId}`);
      else if (!legacy && identity.bbrefId == null) errors.push(`${prefix} needs a bbrefId on its identity`);
      validateStats(teamId, player.playerId, player.stats, errors);
      validateAnswer(teamId, player, errors);

      const sourceRefs = player.provenance?.sourceRefs ?? [];
      if (player.provenance?.verifiedAt == null) {
        if (legacy) unverified += 1;
        else errors.push(`${prefix} has no verifiedAt date`);
      } else if (!validDateKey(player.provenance.verifiedAt)) {
        errors.push(`${prefix} has invalid verifiedAt`);
      }
      if (!legacy && sourceRefs.length === 0) errors.push(`${prefix} has no source references`);
      for (const sourceRef of sourceRefs) {
        if (!sourceIds.has(sourceRef)) errors.push(`${prefix} has unknown source reference: ${sourceRef}`);
      }
    }

    if (unverified > 0) warnings.push(`Team ${teamId}: ${unverified} player record${unverified === 1 ? '' : 's'} have no verification date`);
    validateTeamNames(teamId, teamPlayerIds, identitiesById, errors);
    validateSchedule(team, playerMap, errors, warnings, today);
  }

  return { errors, warnings };
}

