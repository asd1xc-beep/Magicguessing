function readJson(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function hasKey(storage, key) {
  try {
    return storage.getItem(key) != null;
  } catch {
    return false;
  }
}

export function createTeamStorage(storage, teamId) {
  const prefix = `nba-guess:v1:${teamId}:`;
  const key = (name) => `${prefix}${name}`;
  return {
    key,
    has(name) {
      return hasKey(storage, key(name));
    },
    get(name, fallback) {
      return readJson(storage, key(name), fallback);
    },
    set(name, value) {
      return writeJson(storage, key(name), value);
    },
  };
}

