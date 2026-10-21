import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SELECTED_TEAM_KEY,
  buildTeamOptions,
  createTeamController,
  resolveInitialTeamId,
} from '../../src/ui/app.js';
import { sampleTeam } from '../fixtures/sample-team.js';

class MemoryStorage {
  constructor(entries = {}) { this.values = new Map(Object.entries(entries)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const registry = [
  { id: 'orlando', label: 'Orlando Magic' },
  { id: 'sample', label: 'Sample Comets' },
];

test('buildTeamOptions derives the selector entirely from the registry', () => {
  assert.deepEqual(buildTeamOptions(registry), [
    { value: 'orlando', label: 'Orlando Magic' },
    { value: 'sample', label: 'Sample Comets' },
  ]);
});

test('resolveInitialTeamId uses a valid saved team and otherwise falls back to the first registered team', () => {
  assert.equal(resolveInitialTeamId(new MemoryStorage({ [SELECTED_TEAM_KEY]: 'sample' }), registry), 'sample');
  assert.equal(resolveInitialTeamId(new MemoryStorage({ [SELECTED_TEAM_KEY]: 'missing' }), registry), 'orlando');
  assert.equal(resolveInitialTeamId(new MemoryStorage(), registry), 'orlando');
});

test('createTeamController persists selection and replaces the active team bundle', async () => {
  const storage = new MemoryStorage();
  const loaded = [];
  const loadTeam = async (teamId) => ({ ...sampleTeam, config: { ...sampleTeam.config, id: teamId } });
  const controller = createTeamController({
    storage,
    registry,
    loadTeam,
    onTeamChange(team) { loaded.push(team.config.id); },
  });

  await controller.start();
  const firstTeam = controller.activeTeam;
  await controller.selectTeam('sample');

  assert.deepEqual(loaded, ['orlando', 'sample']);
  assert.equal(storage.getItem(SELECTED_TEAM_KEY), 'sample');
  assert.equal(controller.activeTeam.config.id, 'sample');
  assert.notStrictEqual(controller.activeTeam, firstTeam);
  await assert.rejects(() => controller.selectTeam('missing'), /Unknown team/i);
});

test('the controller accepts a non-Orlando team without changing its copy or theme', async () => {
  const controller = createTeamController({
    storage: new MemoryStorage(),
    registry: [{ id: 'sample', label: 'Sample Comets' }],
    loadTeam: async () => sampleTeam,
    onTeamChange() {},
  });

  await controller.start();

  assert.equal(controller.activeTeam.config.copy.pageTitle, 'Comets Player Guess');
  assert.equal(controller.activeTeam.config.theme.primary, '#aa2244');
});

