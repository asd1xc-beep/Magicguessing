import test from 'node:test';
import assert from 'node:assert/strict';

import { orlandoTeam } from '../../src/teams/orlando/index.js';
import { loadRegisteredTeams, loadTeam, teamRegistry } from '../../src/teams/index.js';

test('Orlando preserves the complete searchable roster and answer pool', () => {
  assert.equal(orlandoTeam.identities.length, 297);
  assert.equal(orlandoTeam.players.length, 297);
  assert.equal(orlandoTeam.players.filter((player) => player.answer).length, 200);
  assert.ok(orlandoTeam.players.every((player) => orlandoTeam.identityById.has(player.playerId)));
});

test('Orlando retains legacy aliases on permanent identities', () => {
  assert.deepEqual(orlandoTeam.identityById.get('shaquille-oneal').aliases, ['Shaq']);
  assert.deepEqual(orlandoTeam.identityById.get('penny-hardaway').aliases, [
    'Anfernee Hardaway', 'Penny', 'Anfernee Penny Hardaway',
  ]);
  assert.deepEqual(orlandoTeam.identityById.get('moritz-wagner').aliases, ['Moe Wagner', 'Mo Wagner']);
});

test('Orlando keeps the original 103-player daily cycle by permanent ID, then extends it', () => {
  const dates = Object.keys(orlandoTeam.schedule).sort();
  const original = dates.filter((date) => date <= '2027-01-29');
  assert.equal(original.length, 103);
  assert.equal(new Set(original.map((date) => orlandoTeam.schedule[date])).size, 103);
  assert.equal(orlandoTeam.schedule['2027-01-29'], 'rashard-lewis');
  assert.ok(dates.length > 103);
  assert.equal(orlandoTeam.schedule['2026-10-19'], 'mickael-pietrus');
  assert.equal(orlandoTeam.schedule['2026-10-20'], 'victor-oladipo');
  assert.equal(orlandoTeam.schedule['2026-10-21'], 'tracy-mcgrady');
});

test('the production registry lists Orlando first, then the Knicks, and loads a normalized bundle', async () => {
  assert.deepEqual(teamRegistry.map(({ id, label }) => ({ id, label })), [
    { id: 'orlando', label: 'Orlando Magic' },
    { id: 'knicks', label: 'New York Knicks' },
  ]);

  const team = await loadTeam('orlando');
  assert.equal(team.config.id, 'orlando');
  assert.equal(team.playerById.get('tracy-mcgrady').stats.pointsPerGame, 28.1);
  await assert.rejects(() => loadTeam('sample'), /Unknown team/i);
});

test('loadRegisteredTeams loads every descriptor for production validation', async () => {
  const loaded = await loadRegisteredTeams([
    { id: 'first', load: async () => ({ config: { id: 'first' } }) },
    { id: 'second', load: async () => ({ config: { id: 'second' } }) },
  ]);

  assert.deepEqual(loaded.map((team) => team.config.id), ['first', 'second']);
});

