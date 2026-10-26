import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadRegisteredTeams } from '../../src/teams/index.js';

const root = new URL('../../src/', import.meta.url).pathname;
const sharedFiles = [
  ...['game', 'ui'].flatMap((dir) => readdirSync(join(root, dir)).map((file) => join(root, dir, file))),
  ...readdirSync(join(root, 'data')).filter((file) => file.endsWith('.js')).map((file) => join(root, 'data', file)),
  join(root, 'main.js'),
];

test('shared engine and interface code never names a registered team or uses its colors', async () => {
  const teams = await loadRegisteredTeams();
  for (const file of sharedFiles) {
    const source = readFileSync(file, 'utf8');
    for (const { config } of teams) {
      for (const word of [config.name, config.shortName, config.theme.primary]) {
        assert.ok(!source.toLowerCase().includes(word.toLowerCase()), `${file} mentions "${word}" from team ${config.id}`);
      }
    }
  }
});
