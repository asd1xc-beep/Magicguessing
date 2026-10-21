# Multi-Team Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Orlando-only single-file game into a tested Vite application with shared rules and interface code, registry-driven team selection, isolated Orlando data and storage, and a stable published daily schedule.

**Architecture:** Pure ES modules implement the game rules and accept a normalized team bundle. A shared DOM application renders the active team, while JSON and configuration modules under `src/teams/orlando/` own Orlando content. Node's built-in test runner and a data validator protect the behavior and schema; Vite emits a relative-path production bundle for GitHub Pages.

**Tech Stack:** Vite 8, browser ES modules, JSON data, Node.js built-in test runner, GitHub Actions/Pages

**Spec:** `docs/superpowers/specs/2026-10-21-multi-team-foundation-design.md`

## Global Constraints

- Preserve the Orlando game's visible behavior, three modes, five clues, scoring `[50, 40, 30, 20, 10]`, comparison thresholds, and current styling.
- Orlando is the only production team in this milestone; the test fixture team is never registered in the production selector.
- Shared game and interface modules contain no Orlando wording, colors, thresholds, or legacy storage keys.
- Permanent player IDs are lowercase ASCII slugs and are never generated at runtime.
- Existing legacy storage values are copied, never deleted.
- The published daily schedule starts October 19, 2026 and contains the complete current 103-player shuffle cycle.
- Do not invent missing source URLs or verification dates.
- Keep installed dependencies out of Git and push the completed history to the existing `main` branch on remote `Magicguessing`.

## Review Focus

- A normalized alias shared by two players must remain ambiguous rather than silently selecting the wrong player; pin this in Task 2 name tests.
- A migrated daily save whose player name cannot be resolved must preserve usable fields and skip only the bad guess; pin this in Task 4 migration tests.
- A local date outside the committed schedule must disable only Daily mode and leave practice playable; pin this in Task 5 UI tests/acceptance.
- Jersey number `00` must remain a string and compare numerically without losing its display form; pin this in Task 2 comparison tests.
- GitHub Pages must load assets from the repository subpath rather than the domain root; pin this in Task 6 build-output checks.

---

### Task 1: Attach the local work to the hosted repository and establish project hygiene

**Files:**
- Create: `.gitignore`
- Create: `vite.config.js`
- Modify: `package.json`
- Preserve: `.github/workflows/static.yml`

**Interfaces:**
- Consumes: remote `Magicguessing/main` commit `293a7e3` and the identical local/remote `index.html` blob `4531ec7`
- Produces: local `main` based on the hosted history, ignored dependencies/build output, and scripts `test`, `validate:data`, and `build`

- [ ] **Step 1: Reattach without overwriting the working files**

Rename the unborn local branch to `main`, set its baseline/index to `Magicguessing/main` with a mixed reset, and confirm `index.html` remains byte-identical to the remote version.

- [ ] **Step 2: Add project hygiene configuration**

Ignore `node_modules/`, `dist/`, Vite caches, logs, and local environment files. Configure Vite with `base: './'` so the built site works beneath the GitHub Pages repository path.

- [ ] **Step 3: Add test and validation scripts**

Set `test` to `node --test`, `validate:data` to `node scripts/validate-data.js`, `build:site` to `vite build`, and `build` to run validation, tests, then `build:site`.

- [ ] **Step 4: Verify the baseline**

Run: `git status --short --branch`, `npm exec vite -- --version`, and `git diff -- index.html`

Expected: branch `main` tracks the fetched history, Vite 8.3.5 is available, dependencies are untracked/ignored, and the HTML has no content diff yet.

- [ ] **Step 5: Commit**

Commit message: `chore: configure Vite project`

---

### Task 2: Characterize and extract the shared game rules

**Files:**
- Create: `tests/game/names.test.js`
- Create: `tests/game/compare.test.js`
- Create: `tests/game/rules.test.js`
- Create: `src/game/names.js`
- Create: `src/game/compare.js`
- Create: `src/game/rules.js`

**Interfaces:**
- Consumes: normalized identity records `{ id, name, aliases }`, team player records, and team rules
- Produces: `normalizeName(value)`, `createNameIndex(identities, allowedIds)`, `resolvePlayerId(raw, index)`, `searchPlayers(raw, index, limit)`, `comparePlayers(guess, answer, comparison)`, `scoreForGuess(points, guessNumber)`, `practicePool(players, mode)`, `createShuffleBag(ids, random)`, `localDateKey(date)`, and `scheduledPlayerId(schedule, date)`

- [ ] **Step 1: Write failing name tests**

Assert accent/case/apostrophe/suffix normalization, exact aliases, unique partial matches, ambiguous partial matches returning `null`, and ranked autocomplete capped at eight results.

- [ ] **Step 2: Run the name tests and verify RED**

Run: `node --test tests/game/names.test.js`

Expected: FAIL because `src/game/names.js` does not exist.

- [ ] **Step 3: Implement the name APIs**

Keep normalization and lookup team-independent; index entries retain both permanent IDs and display names.

- [ ] **Step 4: Run the name tests and verify GREEN**

Run: `node --test tests/game/names.test.js`

Expected: all name tests pass.

- [ ] **Step 5: Write failing comparison tests**

Pin exact/partial/no position matches; debut within 3; seasons within 1; games within 50; PPG within 2.0; shared, close, and distant jersey numbers; arrows; and display preservation for `00`.

- [ ] **Step 6: Run the comparison tests and verify RED**

Run: `node --test tests/game/compare.test.js`

Expected: FAIL because `src/game/compare.js` does not exist.

- [ ] **Step 7: Implement `comparePlayers(guess, answer, comparison)`**

Return the existing six tile objects with `{ key, value, color, arrow, title }`, using labels and thresholds supplied by team configuration.

- [ ] **Step 8: Run the comparison tests and verify GREEN**

Run: `node --test tests/game/compare.test.js`

Expected: all comparison tests pass.

- [ ] **Step 9: Write failing general-rule tests**

Assert five-step scoring, headliner/all versus deep-cut practice pools, nonrepeating shuffled bags, local ISO date keys, stable schedule lookup, and `null` for unpublished dates.

- [ ] **Step 10: Implement the general-rule APIs and verify GREEN**

Run: `node --test tests/game/rules.test.js`

Expected: all rule tests pass.

- [ ] **Step 11: Run the full suite and commit**

Run: `npm test`

Commit message: `feat: extract shared game rules`

---

### Task 3: Convert and validate Orlando data

**Files:**
- Create: `src/data/player-identities.json`
- Create: `src/teams/orlando/players.json`
- Create: `src/teams/orlando/daily-schedule.json`
- Create: `src/teams/orlando/config.js`
- Create: `src/teams/orlando/index.js`
- Create: `src/teams/index.js`
- Create: `src/data/validate.js`
- Create: `scripts/validate-data.js`
- Create: `tests/data/validate.test.js`
- Create: `tests/teams/orlando.test.js`

**Interfaces:**
- Consumes: the current inline `PLAYERS` (200 answers) and `ALL_NAMES` (297 searchable players)
- Produces: `validateRegistry(registry, identities) -> { errors, warnings }`, `teamRegistry`, and `loadTeam(teamId) -> normalized team bundle`

- [ ] **Step 1: Write failing validator tests**

Cover duplicate IDs/names/aliases, unknown identity references, duplicate team players, malformed stats, unsupported difficulty, missing clues/summary, invalid/gapped schedules, and required configuration. Assert null legacy verification dates warn rather than fail.

- [ ] **Step 2: Run validator tests and verify RED**

Run: `node --test tests/data/validate.test.js`

Expected: FAIL because the validator does not exist.

- [ ] **Step 3: Implement schema validation and verify GREEN**

Implement `validateRegistry` as pure validation and make `scripts/validate-data.js` print every warning/error, exiting nonzero only on errors.

- [ ] **Step 4: Mechanically convert the inline arrays**

Create 297 permanent identity records and 297 Orlando team records. Attach `answer` to the 200 matching answer players, map `L` to `headliner` and `D` to `deep-cut`, preserve jersey numbers as strings, and use aggregate legacy provenance with `verifiedAt: null`. Confirm there are no slug collisions or unmatched answer names.

- [ ] **Step 5: Materialize the stable schedule**

Reproduce the current sorted daily pool and seeded shuffle once, then commit 103 contiguous date entries from `2026-10-19`. Pin the first three entries to `mickael-pietrus`, `victor-oladipo`, and `tracy-mcgrady`.

- [ ] **Step 6: Add failing Orlando integrity tests**

Assert 297 searchable records, 200 answer records, 103 published daily entries, all legacy aliases retained, every answer joined by player ID, today's original answer on `2026-10-21`, and no production registration of the sample team.

- [ ] **Step 7: Implement Orlando config, bundle, and registry**

Move all Orlando labels, theme tokens, comparison labels/thresholds, modes, source notes, season coverage, and missing-daily copy into `config.js`. Keep `src/teams/index.js` generic.

- [ ] **Step 8: Verify production data**

Run: `npm run validate:data` and `node --test tests/teams/orlando.test.js`

Expected: zero errors, the explicitly counted null-verification warnings, and all integrity tests pass.

- [ ] **Step 9: Commit**

Commit message: `feat: add validated Orlando team data`

---

### Task 4: Add team-scoped statistics and storage migration

**Files:**
- Create: `src/game/stats.js`
- Create: `src/game/storage.js`
- Create: `tests/game/stats.test.js`
- Create: `tests/game/storage.test.js`

**Interfaces:**
- Consumes: Storage-compatible `{ getItem, setItem }`, team ID, identity/name index, legacy epoch, and maximum guesses
- Produces: `defaultStats(maxGuesses)`, `recordDailyResult(stats, result)`, `liveStreak(stats, today)`, `createTeamStorage(storage, teamId)`, and `migrateOrlandoLegacy(storage, nameIndex)`

- [ ] **Step 1: Write failing statistics tests**

Pin one-record-per-date behavior, wins/distribution, consecutive and broken streaks using ISO dates, losses resetting current streak, and live-streak display.

- [ ] **Step 2: Verify RED, implement, and verify GREEN**

Run before and after implementation: `node --test tests/game/stats.test.js`

Expected before: missing-module failure. Expected after: all statistics tests pass.

- [ ] **Step 3: Write failing storage tests**

Assert per-team key isolation, best-effort malformed JSON handling, idempotent legacy migration, name-to-ID conversion, numeric-day-to-date conversion, unknown guesses skipped individually, existing new values never overwritten, and legacy keys retained.

- [ ] **Step 4: Verify RED, implement, and verify GREEN**

Run before and after implementation: `node --test tests/game/storage.test.js`

Expected before: missing-module failure. Expected after: all storage tests pass.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`

Commit message: `feat: isolate team progress storage`

---

### Task 5: Extract the shared interface and add the team selector

**Files:**
- Modify: `index.html`
- Create: `src/styles.css`
- Create: `src/main.js`
- Create: `src/ui/app.js`
- Create: `src/ui/autocomplete.js`
- Create: `src/ui/render.js`
- Create: `tests/ui/config-boundaries.test.js`
- Create: `tests/fixtures/sample-team.js`

**Interfaces:**
- Consumes: `teamRegistry`, `loadTeam(teamId)`, shared game APIs, and team-scoped storage
- Produces: `createApp({ document, storage, registry, loadTeam, now, random })` with `start()`, `selectTeam(teamId)`, `setMode(modeId)`, and `destroy()`

- [ ] **Step 1: Write failing boundary tests**

Assert registry-driven selector options, default/fallback team selection, selection persistence, sample-team compatibility, team-scoped reset behavior, and absence of Orlando wording/color/storage literals from `src/game/` and `src/ui/`.

- [ ] **Step 2: Run boundary tests and verify RED**

Run: `node --test tests/ui/config-boundaries.test.js`

Expected: FAIL because the shared application does not exist.

- [ ] **Step 3: Split the page shell and styling**

Preserve the existing layout/classes and move CSS to `src/styles.css`. Replace inline handlers and script with shared DOM IDs plus `<script type="module" src="/src/main.js"></script>`. Add an accessible team selector to the header.

- [ ] **Step 4: Implement the shared DOM application**

Port modes, clues, guess submission, rows, daily restore, results, statistics, sharing, countdown, and autocomplete to injected team data/config. Handle an unpublished daily by showing configured copy and offering practice without disabling the rest of the app.

- [ ] **Step 5: Wire startup and the test-only sample team**

`src/main.js` starts the production registry. The invented sample team remains importable only by tests.

- [ ] **Step 6: Verify the boundary tests and full suite**

Run: `node --test tests/ui/config-boundaries.test.js` then `npm test`

Expected: all tests pass, and scans find no team-specific literals in shared source.

- [ ] **Step 7: Commit**

Commit message: `feat: add shared multi-team interface`

---

### Task 6: Build, deploy, and verify GitHub Pages

**Files:**
- Modify: `.github/workflows/static.yml`
- Modify: `README.md` if a minimal add-team guide is useful

**Interfaces:**
- Consumes: tested Vite source and existing GitHub Pages workflow
- Produces: GitHub Actions build of `dist/` and a pushed `Magicguessing/main`

- [ ] **Step 1: Update the Pages workflow**

Use Node setup, `npm ci`, `npm run build`, and upload only `dist/`. Preserve the existing Pages permissions, environment, concurrency, and `main` trigger.

- [ ] **Step 2: Run complete local verification**

Run: `npm run build`

Expected: data validation has zero errors, all tests pass, and Vite produces `dist/index.html` plus hashed assets.

- [ ] **Step 3: Check relative production paths**

Inspect `dist/index.html` and assert all generated asset URLs begin with `./assets/` or are otherwise relative; start `npm run preview` and exercise the built page in a browser at a nested path-compatible URL.

- [ ] **Step 4: Perform browser acceptance**

Verify team selector, Daily answer for October 21, 2026, both practice modes, autocomplete, correct/incorrect guesses, scoring, comparison tiles, refresh restore, legacy migration, share text, and responsive layout. Record any limitation rather than masking it.

- [ ] **Step 5: Review Git scope and commit**

Run: `git status --short`, `git diff --check`, `git diff --stat Magicguessing/main..HEAD`, and confirm `node_modules/` and `dist/` are absent from tracked files.

Commit message: `ci: build Vite site for GitHub Pages`

- [ ] **Step 6: Push and verify deployment**

Push `main` to remote `Magicguessing`. Confirm the GitHub Pages workflow completes successfully. Report the exact commit and distinguish local build success from live URL verification if the public deployment URL is unavailable.

---

## Self-review results

- Spec coverage: every goal and acceptance item maps to Tasks 2–6; repository reconciliation and Pages deployment are added in Tasks 1 and 6 because the user supplied that context after approving the design.
- Step scan: each implementation step names one module group, interface, or checkable output; generated Orlando JSON is explicitly a mechanical conversion rather than hand-authored production logic.
- Type consistency: all game and UI consumers use permanent `playerId` values, normalized team bundles, ISO date keys, and the same storage adapter.
- Review focus: ambiguous aliases, partial migration, unpublished dates, `00`, and Pages-relative paths are each attached to an owning task.
- Proportion: the plan is detailed because the refactor spans data migration, behavior preservation, persistence migration, UI extraction, and deployment, but implementation bodies remain with the implementer.
