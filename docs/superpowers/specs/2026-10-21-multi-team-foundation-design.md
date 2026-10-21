# Multi-Team Foundation Design

## Intent

Refactor the existing single-file Orlando Magic guessing game into a Vite application that can support additional NBA teams without duplicating game rules or embedding team assumptions in shared code.

The first milestone is deliberately behavior-preserving: Orlando remains the only real playable team, and users select it through a team menu. The app gains the structure, identifiers, validation, storage isolation, and published daily schedule needed to add another team safely later. No second team's production data is part of this milestone.

## Goals

- Preserve the current Orlando game's three modes, five-clue flow, scoring, comparison behavior, autocomplete, daily statistics, practice streaks, sharing, and visual presentation.
- Let the user select a team from a shared interface and remember that selection.
- Separate the shared game engine and interface from team configuration and team data.
- Give every NBA player a permanent, team-independent ID.
- Represent each Orlando player only once in Orlando's team dataset, with optional answer-specific clue data on that same record.
- Namespace saved progress by team and migrate existing Orlando progress without deleting the legacy values.
- Replace the mutable shuffled daily pool with a committed date-to-player-ID schedule.
- Validate team data before builds so malformed records cannot silently reach the game.
- Prove that the shared engine does not depend on Orlando by testing it with a small test-only sample team.

## Non-goals

- Adding a second real NBA team or researching new player data.
- Redesigning the interface or changing the Orlando color palette.
- Changing scoring, comparison thresholds, clue order, modes, or eligibility outcomes.
- Adding a server, database, account system, synchronization, or content-management interface.
- Automatically fetching NBA data or generating clues.
- Retrofitting source URLs or verification dates that are not present in the supplied HTML.

## Product behavior

### Team selection

The page includes a team selector in the shared header. The registry contains Orlando only for this milestone, but the selector is populated from the registry rather than hard-coded markup. Orlando is the default when no valid selection has been saved. The selected team is stored globally under `nba-guess:v1:selected-team`.

Changing teams replaces all team-facing text, theme tokens, pools, published daily answer, autocomplete roster, and persisted game state. A change starts or restores the selected team's current mode; no in-memory game state leaks between teams.

### Orlando behavior

The Orlando experience continues to use:

- Daily, All Players, and True Fan modes.
- Five guesses and points `[50, 40, 30, 20, 10]`.
- The current comparison categories and close thresholds.
- The current answer eligibility and difficulty assignments.
- The current name normalization and alias behavior.
- The current local-midnight daily rollover.

Team-facing copy such as the title, description, unknown-player message, season labels, share heading, data note, and colors comes from Orlando configuration. Shared modules must not contain the words `Magic` or `Orlando`, Orlando colors, or Orlando-specific player thresholds.

### Daily puzzles

Daily answers are read from a committed schedule whose keys are local calendar dates in `YYYY-MM-DD` form and whose values are permanent player IDs. The initial Orlando schedule is generated once from the existing epoch, seed, eligible pool, and shuffle algorithm for the complete current shuffle cycle. This preserves the already-published sequence beginning October 19, 2026 while making it immune to later roster edits.

The runtime never derives a daily answer from the current player pool. Adding, removing, or editing players therefore cannot change a published date. A date with no schedule entry shows a configurable "daily puzzle not published yet" state; practice modes remain available. Extending the schedule is an explicit data edit validated before build.

### Saved progress

Team-specific storage keys use the prefix `nba-guess:v1:<team-id>:`. Orlando uses:

- `nba-guess:v1:orlando:daily`
- `nba-guess:v1:orlando:stats`
- `nba-guess:v1:orlando:best-streak`

The current daily save is upgraded to store an ISO local date, the scheduled answer's permanent player ID, and guessed player IDs. Daily statistics store dates rather than the old numeric day indexes.

On first Orlando load, an idempotent migration copies `mpg_daily`, `mpg_stats`, and `mpg_best_streak` into the new namespace only when the corresponding new value is absent. Player names are resolved to permanent IDs, and numeric day indexes are converted using the legacy October 19, 2026 epoch. Malformed or unknown legacy fields are ignored conservatively. Legacy keys are retained so the migration is recoverable and does not destroy user data.

## Architecture

### Shared game engine

Pure modules own name normalization, name lookup, pool selection, random practice selection, comparison tiles, scoring, daily schedule lookup, statistics updates, and streak calculations. These modules accept team configuration and team data as inputs. They do not access the DOM or contain team-specific constants.

### Shared interface

Shared interface modules own rendering, event handling, autocomplete, clues, result screens, status chips, share/copy behavior, countdown behavior, and the team selector. The interface reads labels and theme values from the active team configuration. `index.html` becomes the stable page shell and loads `src/main.js` as a module.

### Team registry and configuration

`src/teams/index.js` exports the available team descriptors and lazy or direct loaders. Each descriptor has a permanent team ID, menu label, and loader. A team module exports a normalized bundle containing its configuration, identities, team player records, and daily schedule.

Orlando configuration includes:

- `id`, full name, short name, and abbreviation.
- Page title, description, unknown-player copy, share title, footer/data note, and missing-daily copy.
- Theme tokens for primary, hover, border, and text colors.
- Mode definitions and their labels.
- Rules such as maximum guesses, points, comparison closeness thresholds, and eligibility predicates or declarative thresholds.
- Dataset metadata including season coverage, source names, and verification state.

### Permanent player identities

`src/data/player-identities.json` is the cross-team identity registry. Each record has:

```json
{
  "id": "shaquille-oneal",
  "name": "Shaquille O'Neal",
  "aliases": ["Shaq"]
}
```

IDs are lowercase ASCII slugs, permanent after publication, and never derived at runtime. Names and aliases used for search come from this registry. A future Lakers record and the Orlando record both reference `shaquille-oneal`.

### Team player records

`src/teams/orlando/players.json` has one team-specific record for every searchable Orlando player:

```json
{
  "playerId": "shaquille-oneal",
  "stats": {
    "position": "C",
    "firstSeason": 1993,
    "seasons": 4,
    "games": 295,
    "pointsPerGame": 27.2,
    "numbers": ["32"]
  },
  "answer": {
    "difficulty": "headliner",
    "clues": ["...", "...", "...", "...", "..."],
    "summary": "..."
  },
  "provenance": {
    "sourceRefs": ["basketball-reference", "nba", "ap-news"],
    "verifiedAt": null
  }
}
```

`answer` is absent for searchable players who cannot be selected as answers. This merges the current `PLAYERS` and `ALL_NAMES` arrays without losing the larger autocomplete roster. Difficulty values use descriptive names rather than `L` and `D`.

The initial conversion must not invent provenance. Orlando's existing source names and “through the 2025–26 season” note are preserved in dataset metadata. `verifiedAt: null` explicitly represents a legacy record with no supplied verification date. Validation reports this as a warning for migrated Orlando data; newly added team records are expected to use an ISO date and source references.

### Daily schedule

`src/teams/orlando/daily-schedule.json` maps ISO local dates to permanent player IDs. Every scheduled ID must exist in Orlando data, have answer data with exactly five clues, and be daily-eligible under Orlando's published rules at the time the entry is added. Schedule dates must be valid, unique, and contiguous within the published range.

### Storage

`src/game/storage.js` accepts a storage-compatible object and team ID. It builds keys, performs best-effort JSON reads and writes, and exposes the Orlando legacy migration as a separate adapter. This keeps browser storage out of pure rules and makes migration testable with an in-memory fake.

## Proposed file structure

```text
index.html
src/
  main.js
  styles.css
  data/
    player-identities.json
  game/
    compare.js
    daily.js
    names.js
    pools.js
    scoring.js
    stats.js
    storage.js
  ui/
    app.js
    autocomplete.js
    render.js
  teams/
    index.js
    orlando/
      config.js
      players.json
      daily-schedule.json
tests/
  fixtures/
    sample-team.js
  game/
  teams/
scripts/
  validate-data.js
```

The implementation may combine very small neighboring modules when that improves clarity, but it must retain the four boundaries the user specified: shared engine, shared interface, team configuration, and team data.

## Validation

The project uses Node's built-in test runner to avoid adding a test framework solely for this refactor. `npm test` runs behavioral tests, and `npm run validate:data` checks production data. `npm run build` runs data validation before Vite's production build.

Validation fails on:

- Duplicate team IDs, player IDs, canonical normalized names, or aliases that resolve ambiguously.
- A team record referencing an unknown permanent player ID.
- Duplicate team records for the same player ID.
- Invalid positions, seasons, games, points-per-game values, or uniform-number arrays.
- Answer data with an unsupported difficulty, anything other than five non-empty clues, or an empty summary.
- A schedule with invalid or duplicate dates, gaps inside its declared range, unknown players, or ineligible answers.
- Team-facing configuration required by the shared interface being absent.
- Shared game or interface source containing prohibited Orlando-specific wording or theme literals.

Null verification dates in the migrated Orlando dataset produce a clearly counted warning, not a failure. New team imports can tighten this policy when their data is added.

## Testing and acceptance

Pure rules are characterized before extraction so existing behavior remains fixed. Tests cover name normalization and aliases, ambiguous partial names, comparison tiles and arrows, pool membership, five-step scoring, published daily lookup, missing schedule dates, streak calculations, storage namespacing, and idempotent Orlando migration.

A test-only sample team uses invented players and different labels/colors to exercise the shared engine. It is never registered in the production selector.

Milestone acceptance requires:

- The Orlando page renders and all three modes remain playable.
- Today's scheduled Orlando daily answer matches the original algorithm's answer for that date.
- Existing same-day Orlando daily guesses and aggregate statistics restore after migration.
- Refreshing or switching away and back restores only Orlando's state.
- The team selector is registry-driven and shows Orlando.
- No shared engine or interface module contains Orlando-specific wording, colors, eligibility thresholds, or storage keys.
- Editing the eligible player pool does not change an already scheduled answer.
- Data validation, automated tests, and the Vite production build pass without errors.

## Builder decisions

The builder may choose exact function names, module grouping, and whether JSON is imported directly or normalized by a loader, provided the boundaries and behavior above remain intact. The builder may also improve semantic HTML and accessibility attributes where this does not visibly redesign the page or change game behavior.

## Known constraints

- The supplied folder is not currently a Git repository, so the design and implementation cannot be committed until the user initializes or supplies one.
- The existing HTML says its data was generated by `build.py`, but no generator was supplied. This milestone treats the HTML as the source dataset and does not attempt to recreate an absent generator.
- Existing provenance is aggregate and incomplete. The migration preserves that limitation explicitly rather than fabricating precision.
