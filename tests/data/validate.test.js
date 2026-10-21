import test from 'node:test';
import assert from 'node:assert/strict';

import { validateRegistry } from '../../src/data/validate.js';

const identities = [
  { id: 'alpha-player', name: 'Alpha Player', aliases: ['Alpha'] },
  { id: 'beta-player', name: 'Beta Player', aliases: [] },
];

const config = {
  id: 'sample',
  name: 'Sample Team',
  shortName: 'Sample',
  abbreviation: 'SAM',
  copy: {
    pageTitle: 'Sample Player Guess',
    description: 'Guess a Sample player.',
    unknownPlayer: 'Unknown player.',
    shareTitle: 'Sample Player Guess',
    footer: 'Sample data.',
    missingDaily: 'No puzzle published.',
    seasonLabel: 'First Sample season',
  },
  theme: { primary: '#123456', hover: '#234567', border: '#345678', text: '#ffffff' },
  modes: [
    { id: 'daily', label: 'Daily' },
    { id: 'all', label: 'All Players', difficulties: ['headliner', 'deep-cut'] },
    { id: 'true_fan', label: 'True Fan', difficulties: ['deep-cut'] },
  ],
  rules: {
    maxGuesses: 5,
    points: [50, 40, 30, 20, 10],
    dailyEligibility: { difficulties: ['headliner'], minimumGamesForOthers: 100 },
    comparison: {
      thresholds: { debut: 3, seasons: 1, games: 50, pointsPerGame: 2, jersey: 2 },
      labels: {
        position: 'Position', debut: 'Debut', seasons: 'Seasons', games: 'Games',
        pointsPerGame: 'PPG', jersey: 'Jersey',
      },
    },
  },
  dataset: {
    seasonCoverage: 'through test season',
    sources: [{ id: 'source-one', label: 'Source One' }],
  },
};

const validStats = {
  position: 'G', firstSeason: 2020, seasons: 2, games: 120,
  pointsPerGame: 10.5, numbers: ['00'],
};

const players = [
  {
    playerId: 'alpha-player',
    stats: validStats,
    answer: {
      difficulty: 'headliner',
      clues: ['One', 'Two', 'Three', 'Four', 'Five'],
      summary: 'A summary.',
    },
    provenance: { sourceRefs: ['source-one'], verifiedAt: null },
  },
  {
    playerId: 'beta-player',
    stats: { ...validStats, games: 20, numbers: ['2'] },
    provenance: { sourceRefs: ['source-one'], verifiedAt: '2026-10-21' },
  },
];

function validate(overrides = {}) {
  return validateRegistry(
    [{ config, players, schedule: { '2026-10-19': 'alpha-player' }, ...overrides.team }],
    overrides.identities ?? identities,
  );
}

test('validateRegistry accepts a complete team and aggregates missing verification dates as a warning', () => {
  const result = validate();

  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /1 player record.*no verification date/i);
});

test('validateRegistry rejects duplicate permanent IDs and ambiguous normalized names or aliases', () => {
  const result = validate({
    identities: [
      ...identities,
      { id: 'alpha-player', name: 'Another Person', aliases: [] },
      { id: 'gamma-player', name: 'Gamma Player', aliases: ['Alpha'] },
    ],
  });

  assert.ok(result.errors.some((error) => /duplicate player id.*alpha-player/i.test(error)));
  assert.ok(result.errors.some((error) => /ambiguous.*alpha/i.test(error)));
});

test('validateRegistry rejects unknown and duplicate team player references', () => {
  const result = validate({
    team: {
      players: [players[0], { ...players[0] }, { ...players[1], playerId: 'missing-player' }],
    },
  });

  assert.ok(result.errors.some((error) => /duplicate team player.*alpha-player/i.test(error)));
  assert.ok(result.errors.some((error) => /unknown player id.*missing-player/i.test(error)));
});

test('validateRegistry rejects malformed stats and answer data', () => {
  const result = validate({
    team: {
      players: [{
        ...players[0],
        stats: { ...validStats, position: 'QB', games: -1, pointsPerGame: 'ten', numbers: [0] },
        answer: { difficulty: 'mystery', clues: ['Only one'], summary: '' },
      }],
    },
  });

  assert.ok(result.errors.some((error) => /position/i.test(error)));
  assert.ok(result.errors.some((error) => /games/i.test(error)));
  assert.ok(result.errors.some((error) => /pointsPerGame/i.test(error)));
  assert.ok(result.errors.some((error) => /numbers/i.test(error)));
  assert.ok(result.errors.some((error) => /difficulty/i.test(error)));
  assert.ok(result.errors.some((error) => /five non-empty clues/i.test(error)));
  assert.ok(result.errors.some((error) => /summary/i.test(error)));
});

test('validateRegistry rejects missing configuration required by the shared interface', () => {
  const result = validate({ team: { config: { ...config, copy: { ...config.copy, shareTitle: '' } } } });

  assert.ok(result.errors.some((error) => /copy\.shareTitle/i.test(error)));
});

test('validateRegistry rejects invalid, gapped, unknown, and ineligible schedule entries', () => {
  const result = validate({
    team: {
      players: [players[0], { ...players[1], answer: { ...players[0].answer, difficulty: 'deep-cut' } }],
      schedule: {
        'not-a-date': 'alpha-player',
        '2026-10-19': 'missing-player',
        '2026-10-21': 'beta-player',
      },
    },
  });

  assert.ok(result.errors.some((error) => /invalid schedule date/i.test(error)));
  assert.ok(result.errors.some((error) => /schedule gap/i.test(error)));
  assert.ok(result.errors.some((error) => /unknown scheduled player.*missing-player/i.test(error)));
  assert.ok(result.errors.some((error) => /not daily eligible.*beta-player/i.test(error)));
});

