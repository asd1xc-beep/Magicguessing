import allIdentities from '../../data/player-identities.json' with { type: 'json' };
import schedule from './daily-schedule.json' with { type: 'json' };
import players from './players.json' with { type: 'json' };
import { orlandoConfig } from './config.js';
import { migrateLegacyProgress } from './migrate.js';

const playerIds = new Set(players.map((player) => player.playerId));
const identities = allIdentities.filter((identity) => playerIds.has(identity.id));
const identityById = new Map(identities.map((identity) => [identity.id, identity]));
const playerById = new Map(players.map((player) => [player.playerId, player]));

export const orlandoTeam = {
  config: orlandoConfig,
  identities,
  identityById,
  players,
  playerById,
  schedule,
  migrateLegacy(storage, nameIndex) {
    migrateLegacyProgress(storage, nameIndex, {
      schedule,
      epoch: orlandoConfig.rules.dailyNumberEpoch,
      maxGuesses: orlandoConfig.rules.maxGuesses,
    });
  },
};

export default orlandoTeam;

