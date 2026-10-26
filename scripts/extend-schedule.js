// Appends daily puzzles to a team's published schedule.
//
//   node scripts/extend-schedule.js <team-id> [--days 90] [--seed <text>] [--dry-run]
//
// Published dates are never changed: new dates are added after the last scheduled date
// (or from the team's dailyNumberEpoch when the schedule is empty). Answers come from the
// team's daily-eligible players. Nobody repeats until every eligible player has had a day,
// and a new cycle avoids anyone used in the last few weeks of the previous one.
// The shuffle is seeded, so the same command on the same data gives the same schedule.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createShuffleBag, isDailyEligible } from '../src/game/rules.js';
import { loadTeam, teamRegistry } from '../src/teams/index.js';

const RECENT_GAP = 30;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
  return hash;
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Pure planner, exported for tests: returns the new {date: playerId} entries to append.
 * `schedule` is the existing published schedule; `eligibleIds` the daily-eligible pool.
 */
export function planScheduleExtension({ schedule, eligibleIds, startDate, days, seed }) {
  if (eligibleIds.length === 0) throw new Error('No daily-eligible players to schedule');
  const random = mulberry32(hashSeed(seed));
  const history = Object.keys(schedule).sort().map((date) => schedule[date]);
  const pool = new Set(eligibleIds);

  // Players already used in the current pass through the pool.
  const usedThisCycle = new Set();
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (!pool.has(history[index])) continue;
    if (usedThisCycle.has(history[index]) || usedThisCycle.size === pool.size) break;
    usedThisCycle.add(history[index]);
  }
  if (usedThisCycle.size === pool.size) usedThisCycle.clear();

  const additions = {};
  let bag = createShuffleBag(eligibleIds.filter((id) => !usedThisCycle.has(id)).sort(), random);
  for (let offset = 0; offset < days; offset += 1) {
    if (bag.length === 0) {
      // New cycle: shuffle everyone, then move recently used players to the end of the queue.
      const recent = new Set(history.slice(-RECENT_GAP));
      const fresh = createShuffleBag([...eligibleIds].sort(), random);
      bag = [...fresh.filter((id) => recent.has(id)), ...fresh.filter((id) => !recent.has(id))];
    }
    const playerId = bag.pop();
    const date = addDays(startDate, offset);
    additions[date] = playerId;
    history.push(playerId);
  }
  return additions;
}

function parseArgs(argv) {
  const args = { teamId: null, days: 90, seed: null, dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--days') args.days = Number(argv[++index]);
    else if (value === '--seed') args.seed = argv[++index];
    else if (value === '--dry-run') args.dryRun = true;
    else if (!args.teamId) args.teamId = value;
    else throw new Error(`Unexpected argument: ${value}`);
  }
  if (!args.teamId) throw new Error(`Usage: node scripts/extend-schedule.js <${teamRegistry.map((team) => team.id).join('|')}> [--days 90] [--seed text] [--dry-run]`);
  if (!Number.isInteger(args.days) || args.days < 1) throw new Error('--days must be a positive whole number');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const team = await loadTeam(args.teamId);
  const file = new URL(`../src/teams/${args.teamId}/daily-schedule.json`, import.meta.url);
  const schedule = JSON.parse(readFileSync(file, 'utf8'));
  const rule = team.config.rules.dailyEligibility;
  const eligibleIds = team.players.filter((player) => isDailyEligible(player, rule)).map((player) => player.playerId);
  const dates = Object.keys(schedule).sort();
  const startDate = dates.length ? addDays(dates.at(-1), 1) : team.config.rules.dailyNumberEpoch;
  const seed = args.seed ?? `${args.teamId}:${startDate}`;

  const additions = planScheduleExtension({ schedule, eligibleIds, startDate, days: args.days, seed });
  const merged = { ...schedule, ...additions };
  const sorted = Object.fromEntries(Object.keys(merged).sort().map((date) => [date, merged[date]]));
  const added = Object.keys(additions);

  console.log(`${team.config.name}: ${eligibleIds.length} daily-eligible players`);
  console.log(`Adding ${added.length} days: ${added[0]} to ${added.at(-1)} (seed "${seed}")`);
  if (args.dryRun) {
    for (const date of added.slice(0, 10)) console.log(`  ${date}  ${additions[date]}`);
    console.log('Dry run: nothing written.');
    return;
  }
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${fileURLToPath(file)}. Run npm run build to validate before publishing.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
