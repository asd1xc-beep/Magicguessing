// Research step 2: turn research files into game data.
//
//   node scripts/research/build-team-data.js <team-id>
//
// Reads  research/<team>/roster.json   (from scripts/research/bbref.js parse)
//        research/<team>/settings.json (pool rules, wording, aliases)
//        research/<team>/clues.json    (hand-written, sourced clue ladders and facts)
// Writes src/teams/<team>/players.json and adds or reuses identities in
//        src/data/player-identities.json, matched by Basketball-Reference ID so a player who
//        was on another team keeps one permanent ID.
//
// Generated clues run from hardest to easiest: stat line, position + background,
// draft/honors (or a hand-written fact), tenure + teammates, jersey + initials.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeName } from '../../src/game/names.js';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const readJson = (...parts) => JSON.parse(readFileSync(join(ROOT, ...parts), 'utf8'));

const POSITION_WORDS = { G: 'guard', 'G/F': 'guard-forward', F: 'forward', 'F/C': 'forward-center', C: 'center' };
const POSITION_GROUPS = {
  PG: ['G'], SG: ['G'], G: ['G'], SF: ['F'], PF: ['F'], F: ['F'], C: ['C'],
  'G-F': ['G', 'F'], 'F-G': ['G', 'F'], 'F-C': ['F', 'C'], 'C-F': ['F', 'C'],
};
const COUNTRIES = {
  AG: 'Antigua and Barbuda', AR: 'Argentina', AU: 'Australia', BA: 'Bosnia and Herzegovina', BE: 'Belgium',
  CA: 'Canada', CD: 'the Democratic Republic of the Congo', CH: 'Switzerland', DE: 'Germany', ES: 'Spain',
  FR: 'France', GB: 'England', GF: 'French Guiana', GN: 'Guinea', GR: 'Greece', HR: 'Croatia', HT: 'Haiti',
  IT: 'Italy', JM: 'Jamaica', LT: 'Lithuania', LV: 'Latvia', MQ: 'Martinique', NG: 'Nigeria', NL: 'the Netherlands',
  PA: 'Panama', PL: 'Poland', RO: 'Romania', RS: 'Serbia', RU: 'Russia', SI: 'Slovenia', SN: 'Senegal',
  UA: 'Ukraine', US: 'the United States',
};

// ---------- small text helpers ----------

export function seasonLabel(year) {
  return year % 100 === 0 ? `${year - 1}–${year}` : `${year - 1}–${String(year).slice(2)}`;
}

export function stints(seasons) {
  const groups = [];
  for (const year of seasons) {
    const last = groups.at(-1);
    if (last && year === last.at(-1) + 1) last.push(year);
    else groups.push([year]);
  }
  const parts = groups.map((group) => (group.length === 1
    ? seasonLabel(group[0])
    : `${seasonLabel(group[0])} to ${seasonLabel(group.at(-1))}`));
  return parts.length <= 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

export function ordinal(number) {
  const tens = number % 100;
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[number % 10] ?? 'th');
  return `${number}${suffix}`;
}

export function initials(name) {
  const tokens = name.split(/\s+/).filter((token) => !/^(Jr|Sr|II|III|IV)\.?$/.test(token));
  return `${tokens[0][0]}.${tokens.at(-1)[0]}.`.toUpperCase();
}

function slug(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const perGame = (total, games) => (total == null ? null : Math.round((10 * total) / games) / 10);
const oneDecimal = (value) => value.toFixed(1);

/** Most-played position group, or a two-position label when the player split time. */
export function positionFromSeasons(positions) {
  const weight = { G: 0, F: 0, C: 0 };
  let total = 0;
  for (const [label, seasons] of Object.entries(positions)) {
    const groups = POSITION_GROUPS[label];
    if (!groups) continue;
    for (const group of groups) weight[group] += seasons / groups.length;
    total += seasons;
  }
  if (total === 0) return 'F';
  const ranked = Object.entries(weight).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (top[1] / total >= 0.7 || second[1] / total < 0.25) return top[0];
  const pair = [top[0], second[0]].sort((a, b) => 'GFC'.indexOf(a) - 'GFC'.indexOf(b)).join('/');
  return pair === 'G/C' ? top[0] : pair;
}

// ---------- clue builders ----------

function statLine(player, words) {
  const { totals } = player;
  const games = totals.games === 1 ? 'my only game' : `${totals.games.toLocaleString('en-US')} games`;
  const parts = [`${oneDecimal(perGame(totals.points, totals.games))} points`];
  if (totals.rebounds != null) parts.push(`${oneDecimal(perGame(totals.rebounds, totals.games))} rebounds`);
  if (totals.assists != null) parts.push(`${oneDecimal(perGame(totals.assists, totals.games))} assists`);
  const list = parts.length === 3 ? `${parts[0]}, ${parts[1]} and ${parts[2]}` : parts.join(' and ');
  let sentence = `Over ${games} with ${words.place}, I averaged ${list}`;
  const blocks = perGame(totals.blocks, totals.games);
  const steals = perGame(totals.steals, totals.games);
  if ((totals.threes ?? 0) >= 150) sentence += `, and hit ${totals.threes.toLocaleString('en-US')} threes`;
  else if (blocks != null && blocks >= 1.2) sentence += `, with ${oneDecimal(blocks)} blocks a game`;
  else if (steals != null && steals >= 1.5) sentence += `, with ${oneDecimal(steals)} steals a game`;
  return `${sentence}.`;
}

// The season-roster college is the school a player is known for; player pages list every
// school attended, including ones marked "attended but did not play".
export function collegeFor(player) {
  const played = (name) => name && !/did not play/i.test(name);
  if (played(player.college)) return player.college.trim();
  const listed = (player.profile?.college ?? '').split(/,\s*/).filter(played);
  return listed.at(-1)?.trim() ?? null;
}

function background(player, position) {
  const role = POSITION_WORDS[position];
  const college = collegeFor(player);
  if (college) return `I'm a ${role} who played college ball at ${college}.`;
  const place = player.profile?.birthplace;
  if (place) return `I'm a ${role} from ${place}.`;
  if (player.birthCountry && player.birthCountry !== 'US') return `I'm a ${role} born in ${COUNTRIES[player.birthCountry] ?? player.birthCountry}.`;
  return `I'm a ${role}.`;
}

function draftSentence(player, words) {
  const draft = player.profile?.draft;
  if (!draft) {
    return player.profile && player.seasons[0] >= 1960 ? 'I went undrafted.' : '';
  }
  if (!draft.pick) return '';
  const ours = draft.team === words.franchiseName;
  const who = ours ? `The ${words.teamName}` : `The ${draft.team}`;
  const draftName = draft.league === 'NBA' ? draft.year : `${draft.year} ${draft.league}`;
  if (draft.pick === 1) return `${who} made me the No. 1 overall pick in ${draftName}.`;
  if (draft.round === 1) return `${who} drafted me ${ordinal(draft.pick)} overall in ${draftName}.`;
  return `${who} drafted me in round ${draft.round} (${ordinal(draft.pick)} overall) in ${draftName}.`;
}

// Career honors as listed on Basketball-Reference ("3x All Star", "1994-95 Sixth Man").
const AWARDS = [
  [/^(\d{4})-(\d{2}) MVP$/, 'MVP'],
  [/^(\d{4})-(\d{2}) Def\. POY$/, 'Defensive Player of the Year'],
  [/^(\d{4})-(\d{2}) ROY$/, 'Rookie of the Year'],
  [/^(\d{4})-(\d{2}) Sixth Man$/, 'Sixth Man of the Year'],
  [/^(\d{4})-(\d{2}) Most Improved$/, 'Most Improved Player'],
];
const COUNTED_AWARDS = [[/^(\d+)x Sixth Man$/, 'Sixth Man of the Year'], [/^(\d+)x Def\. POY$/, 'Defensive Player of the Year']];

export function honorsSentence(player) {
  const honors = player.profile?.honors ?? [];
  const count = (pattern, single) => honors.map((honor) => honor.match(pattern)?.[1] ?? (honor === single ? '1' : null)).find(Boolean);
  const allStar = count(/^(\d+)x All Star$/, 'All Star');
  const titles = count(/^(\d+)x NBA Champ$/, null) ?? (honors.some((honor) => /^\d{4} NBA Champ$/.test(honor)) ? '1' : null);
  const parts = [];
  if (allStar) parts.push(allStar === '1' ? 'an All-Star once' : `an All-Star ${allStar} times`);
  if (titles) parts.push(titles === '1' ? 'an NBA champion' : `a ${titles}-time NBA champion`);
  const awards = [];
  for (const honor of honors) {
    for (const [pattern, label] of AWARDS) {
      const match = honor.match(pattern);
      if (match) awards.push(`${label} in ${match[1]}–${match[2]}`);
    }
    for (const [pattern, label] of COUNTED_AWARDS) {
      const match = honor.match(pattern);
      if (match) awards.push(`${label} ${match[1]} times`);
    }
  }
  const sentences = [];
  if (parts.length) sentences.push(`In my career I was ${parts.join(' and ')}.`);
  if (awards.length) sentences.push(`I was ${awards.slice(0, 2).join(' and ')}.`);
  return sentences.join(' ');
}

function tenure(player, words) {
  if (player.seasons.length === 1) return `My only ${words.teamName} season was ${seasonLabel(player.seasons[0])}.`;
  return `I spent ${player.seasons.length} seasons with the ${words.teamName}: ${stints(player.seasons)}.`;
}

// Stars count as teammates only in seasons they played (nearly) all of, so a mid-season
// trade can't produce a teammate who never actually overlapped.
function fullSeasonStars(players, starIds) {
  const maxGames = new Map();
  for (const player of players) {
    for (const [year, games] of Object.entries(player.seasonGames)) {
      maxGames.set(year, Math.max(maxGames.get(year) ?? 0, games));
    }
  }
  return players
    .filter((player) => starIds.has(player.bbrefId))
    .sort((a, b) => b.totals.games - a.totals.games)
    .map((player) => ({
      name: player.displayName,
      bbrefId: player.bbrefId,
      seasons: new Set(Object.entries(player.seasonGames)
        .filter(([year, games]) => games >= 0.85 * maxGames.get(year))
        .map(([year]) => Number(year))),
    }));
}

function teammatesSentence(player, stars, words) {
  const names = stars
    .filter((star) => star.bbrefId !== player.bbrefId && player.seasons.some((year) => star.seasons.has(year)))
    .slice(0, 2)
    .map((star) => star.name);
  if (!names.length) return '';
  return `My ${words.teamName} teammates included ${names.join(' and ')}.`;
}

function jersey(player, words) {
  const label = initials(player.displayName);
  if (!player.numbers.length) return `My initials are ${label}`;
  return `I wore No. ${player.numbers.join(' and No. ')} for ${words.place}. My initials are ${label}`;
}

function summary(player, words) {
  const seasons = player.seasons.length === 1
    ? seasonLabel(player.seasons[0])
    : `${seasonLabel(player.seasons[0])} to ${seasonLabel(player.seasons.at(-1))}`;
  const numbers = player.numbers.length ? ` · No. ${player.numbers.join(', ')}` : '';
  return `${words.teamName} seasons: ${seasons} · ${player.totals.games.toLocaleString('en-US')} games${numbers}`;
}

const finish = (text) => (/[.!?"”)]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

export function generatedClues(player, position, stars, words, fact) {
  const draft = draftSentence(player, words);
  const honors = honorsSentence(player);
  const mates = teammatesSentence(player, stars, words);
  const third = fact ?? ([draft, honors].filter(Boolean).join(' ') || mates || tenure(player, words));
  const fourth = [tenure(player, words), third === mates ? '' : mates].filter(Boolean).join(' ');
  return [statLine(player, words), background(player, position), third, fourth, jersey(player, words)].map(finish);
}

export function sourceRefForUrl(url) {
  if (/basketball-reference\.com/.test(url)) return 'basketball-reference';
  if (/(^|\.)nba\.com/.test(new URL(url).hostname)) return 'nba';
  if (/wikipedia\.org/.test(url)) return 'wikipedia';
  return 'news';
}

// ---------- main ----------

function build(teamId) {
  const settings = readJson('research', teamId, 'settings.json');
  const roster = readJson('research', teamId, 'roster.json');
  const written = readJson('research', teamId, 'clues.json');
  const identitiesFile = join(ROOT, 'src', 'data', 'player-identities.json');
  const identities = JSON.parse(readFileSync(identitiesFile, 'utf8'));
  const words = settings.words;
  const verifiedAt = settings.retrieved;

  const byBbref = new Map(identities.filter((identity) => identity.bbrefId).map((identity) => [identity.bbrefId, identity]));
  const usedIds = new Set(identities.map((identity) => identity.id));
  let added = 0;

  for (const player of roster.players) {
    let identity = byBbref.get(player.bbrefId);
    if (!identity) {
      const name = settings.displayNames?.[player.bbrefId] ?? player.name;
      let id = slug(name);
      if (usedIds.has(id)) id = `${id}-${player.bbrefId.replace(/^\D+/, '')}`;
      identity = { id, name, aliases: [], bbrefId: player.bbrefId };
      identities.push(identity);
      byBbref.set(player.bbrefId, identity);
      usedIds.add(id);
      added += 1;
    }
    for (const alias of settings.aliases?.[player.bbrefId] ?? []) {
      if (!identity.aliases.some((existing) => normalizeName(existing) === normalizeName(alias))) identity.aliases.push(alias);
    }
    player.identity = identity;
    player.displayName = identity.name;
  }

  const starIds = new Set(settings.answers.headliners);
  const stars = fullSeasonStars(roster.players, starIds);
  const sourceRefs = settings.sources.map((source) => source.id);
  const players = roster.players.map((player) => {
    const position = settings.positions?.[player.bbrefId] ?? positionFromSeasons(player.positions);
    const record = {
      playerId: player.identity.id,
      stats: {
        position,
        firstSeason: player.seasons[0],
        seasons: player.seasons.length,
        games: player.totals.games,
        pointsPerGame: perGame(player.totals.points, player.totals.games),
        numbers: player.numbers,
      },
    };
    if (player.answerCandidate) {
      const handWritten = written[player.bbrefId];
      const clues = handWritten?.clues
        ?? generatedClues(player, position, stars, words, handWritten?.fact);
      record.answer = { difficulty: player.difficulty, clues, summary: summary(player, words) };
    }
    // Every record cites Basketball-Reference; hand-written clues add the sites their facts came from.
    const extraRefs = (written[player.bbrefId]?.sources ?? []).map(sourceRefForUrl);
    record.provenance = { sourceRefs: [...new Set([sourceRefs[0], ...extraRefs])], verifiedAt };
    return record;
  });

  writeFileSync(identitiesFile, `${JSON.stringify(identities, null, 2)}\n`);
  writeFileSync(join(ROOT, 'src', 'teams', teamId, 'players.json'), `${JSON.stringify(players, null, 2)}\n`);
  const answers = players.filter((player) => player.answer);
  console.log(`${teamId}: ${players.length} players, ${answers.length} answers (${answers.filter((player) => player.answer.difficulty === 'headliner').length} headliners), ${added} new identities`);
  const missingWritten = settings.answers.headliners.filter((id) => !written[id]?.clues);
  if (missingWritten.length) console.log(`Headliners using generated clues: ${missingWritten.join(', ')}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const teamId = process.argv[2];
  if (!teamId) {
    console.error('Usage: node scripts/research/build-team-data.js <team-id>');
    process.exitCode = 1;
  } else {
    build(teamId);
  }
}
