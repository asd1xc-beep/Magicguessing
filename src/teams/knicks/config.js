export const knicksConfig = {
  id: 'knicks',
  name: 'New York Knicks',
  shortName: 'Knicks',
  abbreviation: 'NYK',
  copy: {
    pageTitle: 'Knicks Player Guess',
    description: 'Guess the New York Knicks player in 5 clues.',
    unknownPlayer: "That isn't a Knicks player we know. Pick a name from the list.",
    shareTitle: 'Knicks Player Guess',
    footer: 'Stats are with the Knicks only, through the 2025–26 season. Daily players debuted with the Knicks in 1979–80 or later. Sources: Basketball-Reference.com (stats, rosters, uniform numbers, draft history, honors); famous moments checked against NBA.com, Wikipedia and news coverage.',
    missingDaily: 'Today’s daily puzzle has not been published yet. Practice rounds are still available.',
    seasonLabel: 'First Knicks season',
    seasonsLabel: 'Seasons with New York',
    gamesLabel: 'Games with New York',
    pointsLabel: 'Points per game with New York',
  },
  theme: {
    primary: '#f58426',
    hover: '#ff9a45',
    border: '#f58426',
    text: '#0b1a33',
    background: '#003478',
    surface: '#111827',
  },
  modes: [
    { id: 'daily', label: 'Daily' },
    { id: 'all', label: 'All Players', difficulties: ['headliner', 'deep-cut'] },
    { id: 'true_fan', label: 'True Fan', difficulties: ['deep-cut'] },
  ],
  rules: {
    maxGuesses: 5,
    points: [50, 40, 30, 20, 10],
    dailyNumberEpoch: '2026-10-25',
    dailyEligibility: {
      difficulties: ['headliner'],
      minimumGamesForOthers: 100,
      // Era cutoff: daily answers began their Knicks career in 1979–80 or later.
      minimumFirstSeason: 1980,
    },
    comparison: {
      thresholds: { debut: 3, seasons: 1, games: 50, pointsPerGame: 2, jersey: 2 },
      labels: {
        position: 'Position',
        debut: 'First Knicks season',
        seasons: 'Seasons with New York',
        games: 'Games with New York',
        pointsPerGame: 'Points per game with New York',
        jersey: 'Jersey number',
      },
    },
  },
  dataset: {
    seasonCoverage: 'through the 2025–26 season',
    verificationStatus: 'sourced',
    sources: [
      { id: 'basketball-reference', label: 'Basketball-Reference.com' },
      { id: 'nba', label: 'NBA.com' },
      { id: 'wikipedia', label: 'Wikipedia' },
      { id: 'news', label: 'News coverage' },
    ],
  },
};
