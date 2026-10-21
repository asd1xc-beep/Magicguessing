export const orlandoConfig = {
  id: 'orlando',
  name: 'Orlando Magic',
  shortName: 'Magic',
  abbreviation: 'ORL',
  copy: {
    pageTitle: 'Magic Player Guess',
    description: 'Guess the Orlando Magic player in 5 clues.',
    unknownPlayer: "That isn't a Magic player we know. Pick a name from the list.",
    shareTitle: 'Magic Player Guess',
    footer: 'Stats are with the Magic only, through the 2025–26 season. Sources: Basketball-Reference.com (stats, uniform numbers, draft history, All-Star selections), NBA.com and AP/news coverage for awards and famous moments.',
    missingDaily: 'Today’s daily puzzle has not been published yet. Practice rounds are still available.',
    seasonLabel: 'First Magic season',
    seasonsLabel: 'Seasons with Orlando',
    gamesLabel: 'Games with Orlando',
    pointsLabel: 'Points per game with Orlando',
  },
  theme: {
    primary: '#0077c0',
    hover: '#0065a3',
    border: '#0077c0',
    text: '#ffffff',
    background: '#001f3f',
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
    dailyNumberEpoch: '2026-10-19',
    dailyEligibility: {
      difficulties: ['headliner'],
      minimumGamesForOthers: 100,
    },
    comparison: {
      thresholds: { debut: 3, seasons: 1, games: 50, pointsPerGame: 2, jersey: 2 },
      labels: {
        position: 'Position',
        debut: 'First Magic season',
        seasons: 'Seasons with Orlando',
        games: 'Games with Orlando',
        pointsPerGame: 'Points per game with Orlando',
        jersey: 'Jersey number',
      },
    },
  },
  dataset: {
    seasonCoverage: 'through the 2025–26 season',
    verificationStatus: 'legacy-import',
    sources: [
      { id: 'basketball-reference', label: 'Basketball-Reference.com' },
      { id: 'nba', label: 'NBA.com' },
      { id: 'ap-news', label: 'AP/news coverage' },
    ],
  },
};

