import test from 'node:test';
import assert from 'node:assert/strict';

import { orlandoTeam } from '../../src/teams/orlando/index.js';
import { loadTeam, teamRegistry } from '../../src/teams/index.js';

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

test('Orlando publishes the original 103-player daily cycle by permanent ID', () => {
  assert.equal(Object.keys(orlandoTeam.schedule).length, 103);
  assert.equal(orlandoTeam.schedule['2026-10-19'], 'mickael-pietrus');
  assert.equal(orlandoTeam.schedule['2026-10-20'], 'victor-oladipo');
  assert.equal(orlandoTeam.schedule['2026-10-21'], 'tracy-mcgrady');
});

test('the production registry contains Orlando only and loads a normalized bundle', async () => {
  assert.deepEqual(teamRegistry.map(({ id, label }) => ({ id, label })), [
    { id: 'orlando', label: 'Orlando Magic' },
  ]);

  const team = await loadTeam('orlando');
  assert.equal(team.config.id, 'orlando');
  assert.equal(team.playerById.get('tracy-mcgrady').stats.pointsPerGame, 28.1);
  await assert.rejects(() => loadTeam('sample'), /Unknown team/i);
});

