/**
 * Shared space storage through the Apps Script backend (app/mail/Code.gs).
 * With no endpoint configured the app stays local-only (localStorage per browser).
 */
import { API_ENDPOINT } from '../constants';

export const canSync = () => Boolean(API_ENDPOINT);

async function call(payload) {
  // text/plain keeps this a "simple" request (no CORS preflight), which Apps Script requires.
  const res = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok || !data?.ok) throw new Error(data?.error || `Backend returned ${res.status}`);
  return data;
}

/** → { found, space?, tasks?, rev?, updatedAt?, online?, version? } (members get only the boxes / Tix they may see) */
export function loadRemoteSpace(spaceId, member) {
  return call({ action: 'load', space: spaceId, member: member ? { email: member.email } : null });
}

/** Space fields sent with a save; boxes / access only from the owner (the backend ignores them otherwise). */
const spacePayload = (space) => {
  const out = { id: space.id, name: space.name, visibility: space.visibility };
  if (Array.isArray(space.boxes)) out.boxes = space.boxes;
  if (space.access && typeof space.access === 'object') out.access = space.access;
  return out;
};

/** → { rev, updatedAt, version? } */
export function saveRemoteSpace(space, tasks, by) {
  return call({
    action: 'save',
    space: spacePayload(space),
    tasks,
    by: by ? { name: by.name, email: by.email } : null,
  });
}

/** Fire-and-forget save for pagehide/unload; the response is ignored. */
export function beaconSaveRemoteSpace(space, tasks, by) {
  if (!API_ENDPOINT || typeof navigator.sendBeacon !== 'function') return false;
  const body = JSON.stringify({
    action: 'save',
    space: spacePayload(space),
    tasks,
    by: by ? { name: by.name, email: by.email } : null,
  });
  try {
    return navigator.sendBeacon(API_ENDPOINT, new Blob([body], { type: 'text/plain;charset=utf-8' }));
  } catch {
    return false;
  }
}

// ---- account profile (the user's spaces + boxes, keyed by e-mail) ----

/** → { found, spaces?, boxes?, active?, rev?, updatedAt? } */
export function loadRemoteProfile(user) {
  return call({ action: 'profile', user: { email: user.email } });
}

/** → { rev, updatedAt } */
export function saveRemoteProfile(user, spaces, boxes, active) {
  return call({ action: 'saveProfile', user: { email: user.email, name: user.name }, spaces, boxes, active: active || null });
}

/** Fire-and-forget profile save for pagehide; the response is ignored. */
export function beaconSaveRemoteProfile(user, spaces, boxes, active) {
  if (!API_ENDPOINT || typeof navigator.sendBeacon !== 'function') return false;
  const body = JSON.stringify({ action: 'saveProfile', user: { email: user.email, name: user.name }, spaces, boxes, active: active || null });
  try {
    return navigator.sendBeacon(API_ENDPOINT, new Blob([body], { type: 'text/plain;charset=utf-8' }));
  } catch {
    return false;
  }
}
