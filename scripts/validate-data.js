import identities from '../src/data/player-identities.json' with { type: 'json' };
import { validateRegistry } from '../src/data/validate.js';
import { orlandoTeam } from '../src/teams/orlando/index.js';

const result = validateRegistry([orlandoTeam], identities);

for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
for (const error of result.errors) console.error(`ERROR: ${error}`);

console.log(`Data validation: ${result.errors.length} errors, ${result.warnings.length} warnings`);
if (result.errors.length > 0) process.exitCode = 1;

