/**
 * Space invite links. No backend yet: the link carries the space's identity
 * (id, name, visibility, inviter) in the URL hash. Anyone who opens it gets the
 * space added to their own local space list and switched to it.
 * NOTE: task data is still per-browser (localStorage) — the link shares the
 * space, not its contents, until a backend exists.
 */
const PENDING_KEY = 'tixup-pending-invite';
const HASH_PREFIX = '#invite=';

function encode(obj) {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

export function buildInviteLink(space, inviter) {
  const payload = {
    v: 1,
    id: space.id,
    name: space.name,
    visibility: space.visibility || 'private',
    by: inviter ? { name: inviter.name, email: inviter.email } : null,
    at: Date.now(),
  };
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return `${base}${HASH_PREFIX}${encode(payload)}`;
}

export function parseInviteHash(hash = window.location.hash) {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  try {
    const p = decode(hash.slice(HASH_PREFIX.length));
    if (!p || p.v !== 1 || !p.id || !p.name) return null;
    return p;
  } catch {
    return null;
  }
}

/** Stash an invite from the URL so it survives the login flow (which clears the hash). */
export function stashPendingInvite(payload) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
}
export function takePendingInvite() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
