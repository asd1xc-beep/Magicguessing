export const sampleTeam = {
  config: {
    id: 'sample',
    name: 'Sample Comets',
    shortName: 'Comets',
    abbreviation: 'SAM',
    copy: {
      pageTitle: 'Comets Player Guess',
      description: 'Guess the Sample Comets player in 5 clues.',
      unknownPlayer: 'That player is not on the Comets list.',
      shareTitle: 'Comets Player Guess',
      footer: 'Invented test data.',
      missingDaily: 'No Comets daily is published.',
      seasonLabel: 'First Comets season',
      seasonsLabel: 'Seasons with the Comets',
      gamesLabel: 'Games with the Comets',
      pointsLabel: 'Points per game with the Comets',
    },
    theme: {
      primary: '#aa2244', hover: '#881133', border: '#aa2244', text: '#ffffff',
      background: '#220011', surface: '#330022',
    },
    modes: [
      { id: 'daily', label: 'Daily' },
      { id: 'all', label: 'All Players', difficulties: ['headliner', 'deep-cut'] },
      { id: 'true_fan', label: 'True Fan', difficulties: ['deep-cut'] },
    ],
    rules: {
      maxGuesses: 5,
      points: [50, 40, 30, 20, 10],
      dailyNumberEpoch: '2026-10-19',
      dailyEligibility: { difficulties: ['headliner'], minimumGamesForOthers: 100 },
      comparison: {
        thresholds: { debut: 3, seasons: 1, games: 50, pointsPerGame: 2, jersey: 2 },
        labels: {
          position: 'Position', debut: 'First Comets season', seasons: 'Seasons with the Comets',
          games: 'Games with the Comets', pointsPerGame: 'Points per game with the Comets', jersey: 'Jersey number',
        },
      },
    },
    dataset: { seasonCoverage: 'test only', sources: [{ id: 'invented', label: 'Invented data' }] },
  },
  identities: [
    { id: 'alex-example', name: 'Alex Example', aliases: ['A. Example'] },
    { id: 'bailey-sample', name: 'Bailey Sample', aliases: [] },
  ],
  players: [
    {
      playerId: 'alex-example',
      stats: { position: 'G', firstSeason: 2020, seasons: 3, games: 150, pointsPerGame: 11, numbers: ['1'] },
      answer: { difficulty: 'headliner', clues: ['1', '2', '3', '4', '5'], summary: 'Alex summary.' },
      provenance: { sourceRefs: ['invented'], verifiedAt: '2026-10-21' },
    },
    {
      playerId: 'bailey-sample',
      stats: { position: 'F', firstSeason: 2021, seasons: 2, games: 20, pointsPerGame: 4, numbers: ['2'] },
      answer: { difficulty: 'deep-cut', clues: ['1', '2', '3', '4', '5'], summary: 'Bailey summary.' },
      provenance: { sourceRefs: ['invented'], verifiedAt: '2026-10-21' },
    },
  ],
  schedule: { '2026-10-21': 'alex-example' },
};

sampleTeam.identityById = new Map(sampleTeam.identities.map((identity) => [identity.id, identity]));
sampleTeam.playerById = new Map(sampleTeam.players.map((player) => [player.playerId, player]));

