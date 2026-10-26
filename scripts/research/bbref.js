// Research step 1: collect a team's history from Basketball-Reference.
//
//   node scripts/research/bbref.js fetch <team-id>    download pages into research/.cache (polite, resumable)
//   node scripts/research/bbref.js parse <team-id>    write research/<team-id>/roster.json from the cache
//
// Settings come from research/<team-id>/settings.json (franchise code, last season covered,
// and which players get answer clues). Pages are cached, so fetch can be re-run safely; delete a
// cached page to refresh it. Basketball-Reference asks bots to stay under 20 requests a minute,
// so requests are spaced REQUEST_GAP_MS apart. Stats are with this franchise only.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodeEntities, numberOrNull, parseTable, playerIdFromHref, stripTags } from './lib/bbref-html.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CACHE = join(ROOT, 'research', '.cache', 'bbref');
const BASE = 'https://www.basketball-reference.com';
const REQUEST_GAP_MS = 3500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cacheFile = (path) => join(CACHE, `${path.replace(/^\//, '').replace(/\.html$/, '').replace(/\//g, '_')}.html`);

export function readSettings(teamId) {
  return JSON.parse(readFileSync(join(ROOT, 'research', teamId, 'settings.json'), 'utf8'));
}

function readCached(path) {
  const file = cacheFile(path);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

async function download(paths) {
  mkdirSync(CACHE, { recursive: true });
  const missing = paths.filter((path) => !existsSync(cacheFile(path)));
  console.log(`${paths.length - missing.length} cached, ${missing.length} to download (~${Math.ceil((missing.length * REQUEST_GAP_MS) / 60000)} min)`);
  for (const [index, path] of missing.entries()) {
    const response = await fetch(`${BASE}${path}`);
    if (response.status === 429) throw new Error('Basketball-Reference rate limit hit; wait an hour, then re-run (cached pages are kept).');
    if (!response.ok) console.warn(`  ${response.status} ${path}`);
    else writeFileSync(cacheFile(path), await response.text());
    if ((index + 1) % 10 === 0) console.log(`  ${index + 1}/${missing.length}`);
    await sleep(REQUEST_GAP_MS);
  }
}

const seasonPath = (code, year) => `/teams/${code}/${year}.html`;
const playerPath = (bbrefId) => `/players/${bbrefId[0]}/${bbrefId}.html`;

function franchiseRegister(settings) {
  const html = readCached(`/teams/${settings.franchiseCode}/players.html`);
  if (!html) throw new Error('Franchise player page is not cached; run fetch first.');
  return parseTable(html, 'franchise_register');
}

// ---------- fetch ----------

async function fetchTeam(teamId) {
  const settings = readSettings(teamId);
  const code = settings.franchiseCode;
  await download([`/teams/${code}/players.html`, `/teams/${code}/numbers.html`]);
  const register = franchiseRegister(settings);
  const first = Math.min(...register.map((row) => Number(row.year_min)));
  const last = Math.max(...register.map((row) => Number(row.year_max)));
  const seasons = Array.from({ length: last - first + 1 }, (_, index) => seasonPath(code, first + index));
  await download(seasons);

  // Player pages (draft, college, birthplace, honors) are only needed for answer candidates.
  const roster = existsSync(rosterFile(teamId)) ? JSON.parse(readFileSync(rosterFile(teamId), 'utf8')) : null;
  if (!roster) {
    console.log('Run parse, then fetch again to download player pages for answer candidates.');
    return;
  }
  await download(roster.players.filter((player) => player.answerCandidate).map((player) => playerPath(player.bbrefId)));
}

// ---------- parse ----------

const rosterFile = (teamId) => join(ROOT, 'research', teamId, 'roster.json');
const STAT_FIELDS = { g: 'games', mp: 'minutes', pts: 'points', trb: 'rebounds', ast: 'assists', stl: 'steals', blk: 'blocks', fg3: 'threes' };
// Season pages call the games column "games" instead of "g".
const SEASON_STAT = (stat) => (stat === 'g' ? 'games' : stat);
const seasonRowId = (row) => row.$ids.name_display ?? row.$ids.player
  ?? playerIdFromHref(row.$links.name_display ?? row.$links.player);

function emptyPlayer(bbrefId, name) {
  return {
    bbrefId, name, seasons: [], seasonGames: {}, positions: {}, numbers: [], college: null, birthCountry: null,
    totals: Object.fromEntries(Object.values(STAT_FIELDS).map((field) => [field, 0])),
  };
}

function parseNumbersPage(html) {
  // The uniform-number page lists each number followed by links to the players who wore it.
  const byPlayer = new Map();
  const body = html.replace(/<!--|-->/g, '');
  for (const [, number, block] of body.matchAll(/<div class="data_grid_box">[\s\S]*?<caption[^>]*>\s*(\d{1,2})\s*<\/caption>([\s\S]*?)<\/table>/g)) {
    for (const [, href] of block.matchAll(/href="(\/players\/[^"]+)"/g)) {
      const id = playerIdFromHref(href);
      if (!id) continue;
      if (!byPlayer.has(id)) byPlayer.set(id, new Set());
      byPlayer.get(id).add(number);
    }
  }
  return byPlayer;
}

function parsePlayerPage(html) {
  const metaStart = html.indexOf('<div id="meta">');
  const meta = metaStart >= 0 ? html.slice(metaStart, html.indexOf('<!-- div#meta -->', metaStart)) : '';
  const field = (label) => {
    const match = meta.match(new RegExp(`<strong>\\s*${label}:?\\s*</strong>([\\s\\S]*?)</p>`));
    return match ? stripTags(match[1]).replace(/^:\s*/, '') : null;
  };
  // A player can be listed in several drafts ("..., and New York Knicks, 2nd round (...), 1949 BAA Draft").
  // Prefer the NBA (or BAA) selection with a full pick description.
  const draftText = field('Draft');
  const drafts = [...(draftText ?? '').matchAll(/(?:^|, and |^and )?([A-Z][^,()]*?), (\d+)(?:st|nd|rd|th) round \((\d+)(?:st|nd|rd|th) pick, (\d+)(?:st|nd|rd|th) overall\), (\d{4}) (NBA|BAA|ABA)/g)];
  const draft = drafts.find((match) => match[6] !== 'ABA') ?? drafts[0];
  const born = meta.match(/<span>\s*in&nbsp;([\s\S]*?)<\/span>/)?.[1];
  const nickname = meta.match(/<\/h1>[\s\S]*?<p>\s*\(([^)<]{2,160})\)\s*<\/p>/)?.[1]?.trim() ?? null;
  const honors = [...(html.match(/<ul id="bling">([\s\S]*?)<\/ul>/)?.[1] ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
    .map(([, item]) => stripTags(item));
  const uniforms = [...html.matchAll(/href="\/friv\/numbers\.cgi\?number=(\d{1,2})"[^>]*data-tip="([^"]+)"/g)]
    .map(([, number, tip]) => {
      const [, team, years] = decodeEntities(tip).match(/^(.*), (\d{4}(?:-\d{4})?)$/) ?? [null, decodeEntities(tip), null];
      return { number, team, years };
    });
  return {
    positionText: field('Position')?.split('▪')[0].trim() ?? null,
    birthplace: born ? stripTags(born) : null,
    college: field('Colleges?'),
    highSchool: field('High Schools?'),
    draft: draft
      ? { team: draft[1], round: Number(draft[2]), pick: Number(draft[4]), year: Number(draft[5]), league: draft[6] }
      : (draftText ? { text: draftText } : null),
    hallOfFame: field('Hall of Fame'),
    nickname,
    honors,
    uniforms,
  };
}

function parseTeam(teamId) {
  const settings = readSettings(teamId);
  const code = settings.franchiseCode;
  const through = settings.throughSeason;
  const players = new Map();
  const warnings = [];

  for (const row of franchiseRegister(settings)) {
    const bbrefId = row.$ids.player ?? playerIdFromHref(row.$links.player);
    const player = emptyPlayer(bbrefId, row.player);
    for (const [stat, field] of Object.entries(STAT_FIELDS)) player.totals[field] = numberOrNull(row[stat]);
    player.registerYears = { from: Number(row.year_min), to: Number(row.year_max), count: Number(row.years) };
    players.set(bbrefId, player);
  }

  const first = Math.min(...[...players.values()].map((player) => player.registerYears.from));
  const last = Math.max(...[...players.values()].map((player) => player.registerYears.to));
  for (let year = first; year <= last; year += 1) {
    const html = readCached(seasonPath(code, year));
    if (!html) throw new Error(`Season ${year} is not cached; run fetch first.`);
    if (year > through) {
      // Remove seasons after the covered range so totals stop at `throughSeason`.
      for (const row of parseTable(html, 'totals_stats')) {
        const player = players.get(seasonRowId(row));
        if (!player) continue;
        for (const [stat, field] of Object.entries(STAT_FIELDS)) {
          if (player.totals[field] != null) player.totals[field] -= numberOrNull(row[SEASON_STAT(stat)]) ?? 0;
        }
      }
      continue;
    }
    // Games per season, used to tell who was with the team for (nearly) a whole season.
    for (const row of parseTable(html, 'totals_stats')) {
      const player = players.get(seasonRowId(row));
      if (player) player.seasonGames[year] = (player.seasonGames[year] ?? 0) + (numberOrNull(row.games) ?? 0);
    }
    for (const row of parseTable(html, 'roster')) {
      const player = players.get(row.$ids.player ?? playerIdFromHref(row.$links.player));
      if (!player) {
        warnings.push(`${year}: ${row.player} is on the roster but not in the franchise register`);
        continue;
      }
      player.seasons.push(year);
      if (row.pos) player.positions[row.pos] = (player.positions[row.pos] ?? 0) + 1;
      if (/^\d{1,2}$/.test(row.number ?? '') && !player.numbers.includes(row.number)) player.numbers.push(row.number);
      player.college ||= row.college || null;
      player.birthCountry ||= row.flag?.split(' ')[1] ?? null;
    }
  }

  const numbersHtml = readCached(`/teams/${code}/numbers.html`);
  const numbersByPlayer = numbersHtml ? parseNumbersPage(numbersHtml) : new Map();

  const kept = [];
  for (const player of players.values()) {
    // A roster listing without games (injured, waived in camp) doesn't count as a season played.
    player.seasons = player.seasons.filter((year) => (player.seasonGames[year] ?? 0) > 0).sort((a, b) => a - b);
    if (player.seasons.length === 0) continue; // only played after the covered range
    const expectedCount = player.registerYears.count - (player.registerYears.to > through ? 1 : 0);
    if (player.seasons.length !== expectedCount) {
      warnings.push(`${player.name}: ${player.seasons.length} roster seasons vs ${expectedCount} in the register`);
    }
    for (const number of numbersByPlayer.get(player.bbrefId) ?? []) {
      if (!player.numbers.includes(number)) player.numbers.push(number);
    }
    player.numbers.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
    if (player.totals.games <= 0) {
      warnings.push(`${player.name}: no games through ${through}`);
      continue;
    }
    const playerHtml = readCached(playerPath(player.bbrefId));
    if (playerHtml) {
      player.profile = parsePlayerPage(playerHtml);
      // Jerseys listed on the player page for this franchise fill gaps in the roster tables.
      for (const uniform of player.profile.uniforms) {
        if (uniform.team === settings.franchiseName && !player.numbers.includes(uniform.number)) {
          player.numbers.push(uniform.number);
          player.numbers.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
        }
      }
    }
    delete player.registerYears;
    kept.push(player);
  }

  kept.sort((a, b) => a.name.split(' ').at(-1).localeCompare(b.name.split(' ').at(-1)) || a.name.localeCompare(b.name));
  markAnswerCandidates(kept, settings);
  const output = {
    team: teamId,
    source: `${BASE}/teams/${code}/ (franchise register, season rosters, uniform numbers, player pages)`,
    throughSeason: through,
    retrieved: settings.retrieved,
    players: kept,
  };
  writeFileSync(rosterFile(teamId), `${JSON.stringify(output, null, 1)}\n`);
  for (const warning of warnings) console.warn(`WARNING: ${warning}`);
  console.log(`Wrote ${kept.length} players to research/${teamId}/roster.json (${kept.filter((player) => player.answerCandidate).length} answer candidates)`);
}

// Answer candidates: every listed headliner, plus deep cuts with enough games whose first season
// with the team meets the era cutoff. Clues are written for these players only.
export function markAnswerCandidates(players, settings) {
  // extraDeepCuts: well-known names with short stints who would miss the games cut.
  const headliners = new Set(settings.answers.headliners);
  const extras = new Set(settings.answers.extraDeepCuts ?? []);
  const { minimumFirstSeason, deepCutCount } = settings.answers;
  const deepCuts = players
    .filter((player) => !headliners.has(player.bbrefId) && !extras.has(player.bbrefId)
      && player.seasons[0] >= minimumFirstSeason)
    .sort((a, b) => b.totals.games - a.totals.games || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, deepCutCount - extras.size));
  const deepCutIds = new Set([...deepCuts.map((player) => player.bbrefId), ...extras]);
  for (const player of players) {
    player.answerCandidate = headliners.has(player.bbrefId) || deepCutIds.has(player.bbrefId);
    player.difficulty = headliners.has(player.bbrefId) ? 'headliner' : deepCutIds.has(player.bbrefId) ? 'deep-cut' : null;
  }
  const missing = [...headliners, ...extras].filter((id) => !players.some((player) => player.bbrefId === id));
  if (missing.length) throw new Error(`Headliners not found in the roster: ${missing.join(', ')}`);
}

const [command, teamId] = process.argv.slice(2);
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const run = { fetch: fetchTeam, parse: parseTeam }[command];
  if (!run || !teamId) {
    console.error('Usage: node scripts/research/bbref.js <fetch|parse> <team-id>');
    process.exitCode = 1;
  } else {
    Promise.resolve(run(teamId)).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
