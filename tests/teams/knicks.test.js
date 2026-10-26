import test from 'node:test';
import assert from 'node:assert/strict';

import { createNameIndex, resolvePlayerId } from '../../src/game/names.js';
import { isDailyEligible } from '../../src/game/rules.js';
import { knicksTeam } from '../../src/teams/knicks/index.js';
import { orlandoTeam } from '../../src/teams/orlando/index.js';

const { config, players, playerById, identities, schedule } = knicksTeam;

test('the Knicks dataset covers every franchise player through 2025-26 with a curated answer pool', () => {
  assert.equal(players.length, 560);
  assert.equal(identities.length, 560);
  const answers = players.filter((player) => player.answer);
  assert.equal(answers.length, 221);
  assert.equal(answers.filter((player) => player.answer.difficulty === 'headliner').length, 51);
  // Deep cuts (True Fan) all began their Knicks careers in the era-cutoff season or later.
  assert.ok(answers.filter((player) => player.answer.difficulty === 'deep-cut')
    .every((player) => player.stats.firstSeason >= 1980));
  assert.ok(players.every((player) => player.provenance.verifiedAt === '2026-10-25'));
});

test('players who were on both teams share one permanent identity', () => {
  for (const id of ['patrick-ewing', 'penny-hardaway', 'steve-francis', 'evan-fournier', 'gerald-wilkins']) {
    assert.ok(playerById.has(id), `${id} is a Knick`);
    assert.ok(orlandoTeam.playerById.has(id), `${id} is a Magic player`);
  }
  assert.equal(playerById.get('patrick-ewing').stats.games, 1039);
  assert.equal(orlandoTeam.playerById.get('patrick-ewing').stats.games, 65);
});

test('Knicks names, nicknames and spellings resolve within the Knicks roster only', () => {
  const index = createNameIndex(identities);
  const cases = {
    Clyde: 'walt-frazier',
    Melo: 'carmelo-anthony',
    'JR Smith': 'jr-smith',
    'Kristaps Porzingis': 'kristaps-porzingis',
    'Amare Stoudemire': 'amare-stoudemire',
    'Tim Hardaway': 'tim-hardaway-jr',
    'Sweetwater Clifton': 'nat-clifton',
    'Enes Kanter': 'enes-freedom',
  };
  for (const [typed, id] of Object.entries(cases)) assert.equal(resolvePlayerId(typed, index), id, typed);
  assert.equal(resolvePlayerId('Shaq', index), null);
});

test('the Knicks daily schedule starts on launch day and only uses era-eligible answers', () => {
  const dates = Object.keys(schedule).sort();
  assert.equal(dates[0], '2026-10-25');
  assert.equal(config.rules.dailyNumberEpoch, '2026-10-25');
  for (const date of dates) {
    const player = playerById.get(schedule[date]);
    assert.ok(isDailyEligible(player, config.rules.dailyEligibility), `${date} ${schedule[date]}`);
    assert.ok(player.stats.firstSeason >= 1980);
  }
});
