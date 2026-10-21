import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNameIndex,
  normalizeName,
  resolvePlayerId,
  searchPlayers,
} from '../../src/game/names.js';

const identities = [
  { id: 'hedo-turkoglu', name: 'Hedo Türkoğlu', aliases: ['Hedo'] },
  { id: 'shaquille-oneal', name: "Shaquille O'Neal", aliases: ['Shaq'] },
  { id: 'otto-porter-jr', name: 'Otto Porter Jr.', aliases: [] },
  { id: 'jalen-suggs', name: 'Jalen Suggs', aliases: [] },
  { id: 'jameer-nelson', name: 'Jameer Nelson', aliases: [] },
  { id: 'jett-howard', name: 'Jett Howard', aliases: [] },
  { id: 'jonathan-isaac', name: 'Jonathan Isaac', aliases: [] },
  { id: 'juwan-howard', name: 'Juwan Howard', aliases: [] },
  { id: 'jj-redick', name: 'JJ Redick', aliases: [] },
  { id: 'joe-wolf', name: 'Joe Wolf', aliases: [] },
  { id: 'jeff-green', name: 'Jeff Green', aliases: [] },
];

test('normalizeName removes accents, punctuation, case, apostrophes, and suffixes', () => {
  assert.equal(normalizeName('  HEDO Türkoğlu  '), 'hedoturkoglu');
  assert.equal(normalizeName('Shaquille O’Neal'), 'shaquilleoneal');
  assert.equal(normalizeName('Otto Porter Jr.'), 'ottoporter');
});

test('resolvePlayerId accepts canonical names and aliases', () => {
  const index = createNameIndex(identities);

  assert.equal(resolvePlayerId('Shaq', index), 'shaquille-oneal');
  assert.equal(resolvePlayerId('hedo turkoglu', index), 'hedo-turkoglu');
});

test('resolvePlayerId accepts only unique partial matches of four or more characters', () => {
  const index = createNameIndex(identities);

  assert.equal(resolvePlayerId('oneal', index), 'shaquille-oneal');
  assert.equal(resolvePlayerId('howard', index), null);
  assert.equal(resolvePlayerId('hed', index), null);
});

test('createNameIndex can limit search to players on the active team', () => {
  const index = createNameIndex(identities, new Set(['hedo-turkoglu']));

  assert.equal(resolvePlayerId('Hedo', index), 'hedo-turkoglu');
  assert.equal(resolvePlayerId('Shaq', index), null);
});

test('searchPlayers ranks prefix matches before contains matches and caps results', () => {
  const index = createNameIndex(identities);
  const results = searchPlayers('j', index, 8);

  assert.equal(results.length, 8);
  assert.equal(results[0].id, 'jalen-suggs');
  assert.ok(results.every((result) => result.id && result.name));
});

