# NBA Player Guess

A Vite-powered NBA player guessing game. The shared engine and interface are team-neutral; Orlando Magic content is the first production dataset.

## Local development

```powershell
npm install
npm run dev
```

Before publishing, run the full validation, test, and production-build gate:

```powershell
npm run build
```

## Adding a team

1. Add permanent player identities to `src/data/player-identities.json`. Reuse an existing ID when a player already appears for another team.
2. Create `src/teams/<team-id>/config.js`, `players.json`, `daily-schedule.json`, and `index.js` following the Orlando files.
3. Give each searchable team player one team record. Add an `answer` object only when that player can be selected as an answer.
4. Include five clues, a summary, source references, and an ISO verification date for each new answer record.
5. Publish daily puzzles explicitly as `YYYY-MM-DD` to permanent-player-ID entries; do not generate the schedule at runtime.
6. Register the team in `src/teams/index.js`.
7. Run `npm run build`. Do not publish while data validation or tests fail.

Browser progress is stored separately for each team under `nba-guess:v1:<team-id>:` keys.
