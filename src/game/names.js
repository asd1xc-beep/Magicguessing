export function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function createNameIndex(identities, allowedIds = null) {
  const entries = [];
  const exact = new Map();

  for (const identity of identities) {
    if (allowedIds && !allowedIds.has(identity.id)) continue;

    const labels = [identity.name, ...(identity.aliases ?? [])];
    const keys = [...new Set(labels.map(normalizeName).filter(Boolean))];
    const entry = { ...identity, aliases: identity.aliases ?? [], keys };
    entries.push(entry);

    for (const key of keys) {
      if (!exact.has(key)) exact.set(key, new Set());
      exact.get(key).add(identity.id);
    }
  }

  return { entries, exact };
}

export function resolvePlayerId(raw, index) {
  const key = normalizeName(raw);
  if (!key) return null;

  const exactMatches = index.exact.get(key);
  if (exactMatches?.size === 1) return [...exactMatches][0];
  if (exactMatches?.size > 1 || key.length < 4) return null;

  const hits = new Set();
  for (const entry of index.entries) {
    if (entry.keys.some((candidate) => candidate.includes(key))) hits.add(entry.id);
  }
  return hits.size === 1 ? [...hits][0] : null;
}

export function searchPlayers(raw, index, limit = 8) {
  const key = normalizeName(raw);
  if (!key) return [];

  return index.entries
    .map((entry) => {
      const ranks = entry.keys.map((candidate) => {
        if (candidate.startsWith(key)) return 0;
        if (candidate.includes(key)) return 1;
        return 2;
      });
      return { entry, rank: Math.min(...ranks) };
    })
    .filter(({ rank }) => rank < 2)
    .sort((left, right) => left.rank - right.rank || left.entry.name.localeCompare(right.entry.name))
    .slice(0, limit)
    .map(({ entry }) => ({ id: entry.id, name: entry.name, aliases: entry.aliases }));
}

