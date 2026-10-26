# NBA Player Guess

A Vite-powered NBA player guessing game. The shared engine and interface are team-neutral; the Orlando Magic and New York Knicks are the playable teams.

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

Team data is researched from Basketball-Reference and generated, not typed by hand.
The Knicks (`research/knicks/`) are the worked example.

1. **Settings.** Create `research/<team-id>/settings.json`: the Basketball-Reference franchise code,
   the last season covered, the headliner list (Basketball-Reference player IDs), how many deep cuts to
   include, the era cutoff for deep cuts, nicknames/aliases, and the clue wording (`place`, `teamName`).
2. **Fetch and parse.** `node scripts/research/bbref.js fetch <team-id>`, then
   `node scripts/research/bbref.js parse <team-id>`, then `fetch` and `parse` once more (the second
   fetch downloads player pages for answer candidates). Requests are spaced 3.5 seconds apart to stay
   under Basketball-Reference's limit; pages are cached in `research/.cache/` (not committed), so the
   commands can be re-run safely. This writes `research/<team-id>/roster.json`.
3. **Write headliner clues.** Add five-clue ladders (hardest to easiest) to
   `research/<team-id>/clues.json`, with the URLs each fact came from. Other answers get generated clues;
   a single hand-written `fact` can replace a generated third clue.
4. **Team module.** Create `src/teams/<team-id>/config.js` and `index.js` following the Orlando or Knicks
   files, an empty `daily-schedule.json` (`{}`), and register the team in `src/teams/index.js`.
5. **Generate data.** `node scripts/research/build-team-data.js <team-id>` writes `players.json` and adds
   identities to `src/data/player-identities.json`. Players are matched across teams by Basketball-Reference
   ID, so someone who played for two teams keeps one permanent ID.
6. **Schedule.** `node scripts/extend-schedule.js <team-id> --days 120` (or `npm run schedule -- <team-id>`).
7. Run `npm run build`. Do not publish while data validation or tests fail.

## Keeping daily puzzles running

Each team's daily answers are a committed date-to-player list. `npm run build` warns when a schedule has
fewer than 30 days left. Extend it with `node scripts/extend-schedule.js <team-id> --days 90`: published
dates never change, nobody repeats until every eligible player has had a day, and the same command on the
same data always produces the same schedule. Both schedules currently run through June 30, 2027.

## Data rules the build enforces

- Names, aliases and nicknames must be unambiguous within a team (different NBA players may share a name
  across teams).
- Every team except the legacy Orlando import needs a source reference and verification date on every
  record, and a Basketball-Reference ID on every identity.
- Daily answers must meet the team's eligibility rule, including an optional era cutoff
  (`dailyEligibility.minimumFirstSeason`; the Knicks use 1980, meaning 1979–80 or later).

Links can open a specific team: `?team=knicks`. Shared results include that link.

Browser progress is stored separately for each team under `nba-guess:v1:<team-id>:` keys.
