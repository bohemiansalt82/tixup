/**
 * localStorage schema versioning.
 * Bump SCHEMA_VERSION when the stored data shape changes incompatibly;
 * all `tixup*` keys except the signed-in user are wiped on mismatch.
 */
export const SCHEMA_VERSION = '2';
const SCHEMA_KEY = 'tixup-schema';
const KEEP = new Set(['tixup-user', SCHEMA_KEY]);

export function resetLegacyStorage() {
  try {
    if (localStorage.getItem(SCHEMA_KEY) === SCHEMA_VERSION) return false;
    Object.keys(localStorage)
      .filter((k) => k.startsWith('tixup') && !KEEP.has(k))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
    return true;
  } catch {
    return false;
  }
}
