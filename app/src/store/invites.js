/**
 * Space invite links.
 * With the backend configured the link is short: `#join=<spaceId>` — the space name and inviter
 * are looked up from the shared space document when the link is opened.
 * Legacy `#invite=<base64url JSON>` links (id, name, visibility, inviter) still work.
 * NOTE: task data is shared through the backend (store/remote.js); without an endpoint the link
 * shares the space identity only.
 */
import { canSync, loadRemoteSpace } from './remote';

const PENDING_KEY = 'tixup-pending-invite';
const JOIN_PREFIX = '#join=';
const LEGACY_PREFIX = '#invite=';

function encode(obj) {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

export function buildInviteLink(space, inviter) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  if (canSync()) return `${base}${JOIN_PREFIX}${encodeURIComponent(space.id)}`;
  // No backend to resolve the id: carry everything in the link.
  const payload = {
    v: 1,
    id: space.id,
    name: space.name,
    visibility: space.visibility || 'private',
    by: inviter ? { name: inviter.name, email: inviter.email } : null,
    at: Date.now(),
  };
  return `${base}${LEGACY_PREFIX}${encode(payload)}`;
}

/** → { v, id, name|null, visibility|null, by|null } or null. */
export function parseInviteHash(hash = window.location.hash) {
  if (hash.startsWith(JOIN_PREFIX)) {
    const id = decodeURIComponent(hash.slice(JOIN_PREFIX.length));
    return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? { v: 2, id, name: null, visibility: null, by: null } : null;
  }
  if (!hash.startsWith(LEGACY_PREFIX)) return null;
  try {
    const p = decode(hash.slice(LEGACY_PREFIX.length));
    if (!p || p.v !== 1 || !p.id || !p.name) return null;
    return p;
  } catch {
    return null;
  }
}

/**
 * Fills in name / inviter from the backend for short links. Falls back to a generic name when
 * the space has not been published yet (owner never opened the app with the backend on).
 */
export async function resolveInvite(invite) {
  if (!invite) return null;
  if (invite.name && !canSync()) return invite;
  try {
    const r = await loadRemoteSpace(invite.id, null);
    if (r.found) {
      const sp = r.space || {};
      return {
        ...invite,
        name: sp.name || invite.name || 'Shared Space',
        visibility: sp.visibility || invite.visibility || 'private',
        by: invite.by || (sp.owner ? { name: sp.ownerName || sp.owner, email: sp.owner } : null),
      };
    }
  } catch (err) {
    console.warn('Tixup invite: could not resolve space', err);
  }
  return { ...invite, name: invite.name || 'Shared Space', visibility: invite.visibility || 'private' };
}

/** Stash an invite from the URL so it survives the login flow (which clears the hash). */
export function stashPendingInvite(payload) {
  try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
}
/** Reads the stashed invite without consuming it (for the login screen). */
export function peekPendingInvite() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
