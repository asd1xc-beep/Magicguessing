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

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

export function resolveStorage(getStorage = () => globalThis.localStorage) {
  try {
    const storage = getStorage();
    if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
      return storage;
    }
  } catch {
    // Some privacy modes throw while the localStorage property is being read.
  }
  return createMemoryStorage();
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

