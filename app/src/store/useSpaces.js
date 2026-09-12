import { useSyncExternalStore, useMemo, useEffect } from 'react';
import { useAuth } from './useAuth';
import { canSync, loadRemoteProfile, saveRemoteProfile, beaconSaveRemoteProfile } from './remote';

/**
 * Spaces and boxes of the signed-in account.
 *
 * localStorage is only a cache. With the backend configured the account's profile (its list of
 * spaces and their boxes, keyed by e-mail) lives on the server, so the same account sees the same
 * spaces in every browser (see `useSpaceSync`, mounted once in App):
 *  - login / focus / every POLL_MS: pull the profile if its revision changed
 *  - every change (create / rename / join / delete space or box): debounced push, last write wins
 *  - the first pull never drops spaces this browser knows and the server does not: they are
 *    merged in and the union is published
 * Until the first pull has answered `ready` is false and no default space is created, so a fresh
 * browser does not invent a second "My Space" for an account that already has one.
 */

// localStorage keys shared with the vanilla app (dist/assets/js/tixup-auth.js)
const ACTIVE_SPACE_KEY = 'tixup-active-space';
const ACTIVE_BOX_KEY = 'tixup-active-box';
const spacesKey = (userId) => `tixup-spaces-${userId}`;
const boxesKey = (spaceId) => `tixup-boxes-${spaceId}`;

const PUSH_DEBOUNCE_MS = 700;
const POLL_MS = 15000;

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
function subscribe(cb) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

const cache = new Map(); // key -> { raw, value }
function readJson(key, fallback) {
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { raw = null; }
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.value;
  let value = fallback;
  try { value = raw ? JSON.parse(raw) : fallback; } catch { value = fallback; }
  cache.set(key, { raw, value });
  return value;
}
function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  emit();
}
function readStr(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

// Stable empty snapshot: useSyncExternalStore must get the same reference each call.
const EMPTY = Object.freeze([]);

const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ---- Spaces ----
export function getSpaces(userId) {
  return userId ? readJson(spacesKey(userId), EMPTY) : EMPTY;
}
export function createSpace(userId, input) {
  const data = typeof input === 'string' ? { name: input } : (input || {});
  const space = {
    id: uid('space'),
    name: data.name || 'New Space',
    visibility: data.visibility || 'private',
    members: data.members || [], // invited emails
    createdAt: new Date().toISOString(),
  };
  writeJson(spacesKey(userId), [...getSpaces(userId), space]);
  setActiveSpaceId(space.id);
  schedulePush();
  return space;
}
export function renameSpace(userId, spaceId, name) {
  writeJson(spacesKey(userId), getSpaces(userId).map((s) => (s.id === spaceId ? { ...s, name } : s)));
  schedulePush();
}
/** Adds invited emails to a space (membership shown in the UI; the backend records real members on load). */
export function addMembers(userId, spaceId, emails) {
  writeJson(spacesKey(userId), getSpaces(userId).map((s) => {
    if (s.id !== spaceId) return s;
    const members = [...(s.members || [])];
    emails.forEach((e) => { if (!members.includes(e)) members.push(e); });
    return { ...s, members };
  }));
  schedulePush();
}

/** Accepts an invite payload: adds the space (if missing) to this user and makes it active. */
export function joinSpace(userId, invite) {
  const spaces = getSpaces(userId);
  if (!spaces.some((s) => s.id === invite.id)) {
    const space = {
      id: invite.id,
      name: invite.name,
      visibility: invite.visibility || 'private',
      members: [],
      invitedBy: invite.by || null,
      createdAt: new Date().toISOString(),
    };
    writeJson(spacesKey(userId), [...spaces, space]);
    schedulePush();
  }
  setActiveSpaceId(invite.id);
}

export function deleteSpace(userId, spaceId) {
  const rest = getSpaces(userId).filter((s) => s.id !== spaceId);
  writeJson(spacesKey(userId), rest);
  localStorage.removeItem(boxesKey(spaceId));
  if (getActiveSpaceId() === spaceId) setActiveSpaceId(rest[0]?.id ?? null);
  schedulePush();
}
export function getActiveSpaceId() {
  return readStr(ACTIVE_SPACE_KEY);
}
export function setActiveSpaceId(spaceId) {
  if (spaceId) localStorage.setItem(ACTIVE_SPACE_KEY, spaceId);
  else localStorage.removeItem(ACTIVE_SPACE_KEY);
  localStorage.removeItem(ACTIVE_BOX_KEY);
  emit();
}

// ---- Boxes (per space) ----
export function getBoxes(spaceId) {
  return spaceId ? readJson(boxesKey(spaceId), EMPTY) : EMPTY;
}
export function createBox(spaceId, input) {
  const data = typeof input === 'string' ? { name: input } : (input || {});
  const box = {
    id: uid('box'),
    spaceId,
    name: data.name || 'New Box',
    visibility: data.visibility || 'private',
    members: data.members || [],
    createdAt: new Date().toISOString(),
  };
  writeJson(boxesKey(spaceId), [...getBoxes(spaceId), box]);
  schedulePush();
  return box;
}
export function deleteBox(spaceId, boxId) {
  writeJson(boxesKey(spaceId), getBoxes(spaceId).filter((b) => b.id !== boxId));
  if (getActiveBoxId() === boxId) setActiveBoxId(null);
  schedulePush();
}
export function getActiveBoxId() {
  return readStr(ACTIVE_BOX_KEY);
}
export function setActiveBoxId(boxId) {
  if (boxId) localStorage.setItem(ACTIVE_BOX_KEY, boxId);
  else localStorage.removeItem(ACTIVE_BOX_KEY);
  emit();
}

/** Ensures the user has at least one space ("My Space") and an active one. */
function ensureDefaults(userId) {
  if (!userId) return;
  let spaces = getSpaces(userId);
  if (spaces.length === 0) {
    const space = { id: uid('space'), name: 'My Space', visibility: 'private', members: [], createdAt: new Date().toISOString() };
    writeJson(spacesKey(userId), [space]);
    spaces = [space];
    schedulePush();
  }
  const active = getActiveSpaceId();
  if (!active || !spaces.some((s) => s.id === active)) {
    localStorage.setItem(ACTIVE_SPACE_KEY, spaces[0].id);
    emit();
  }
}

// ---- Remote profile sync (one instance, driven by useSpaceSync in App) ----
const sync = {
  user: null,        // { id, email, name } currently synced
  ready: !canSync(), // false while the first pull for this user is in flight
  rev: null,         // last revision seen from the server (null = never synced)
  dirty: false,
  pushing: false,
  pulling: false,
  timer: null,
  disabled: false, // deployed backend predates the profile actions → local-only this session
};
/** A backend without the profile actions answers "Unknown action": stop retrying until reload. */
function noteBackendError(err) {
  if (err && /unknown action/i.test(err.message || '')) {
    sync.disabled = true;
    console.warn('Tixup sync: backend has no profile support yet, spaces stay local-only. Redeploy app/mail/Code.gs.');
  }
}
const setReady = (v) => { if (sync.ready !== v) { sync.ready = v; emit(); } };
export const isSpacesReady = () => sync.ready;

/** Snapshot of everything the profile holds for the synced user. */
function snapshot(userId) {
  const spaces = getSpaces(userId);
  const boxes = {};
  spaces.forEach((s) => { boxes[s.id] = getBoxes(s.id); });
  return { spaces, boxes };
}

function schedulePush() {
  if (!sync.user || !canSync() || sync.disabled) return;
  sync.dirty = true;
  clearTimeout(sync.timer);
  sync.timer = setTimeout(push, PUSH_DEBOUNCE_MS);
}

async function push() {
  const user = sync.user;
  if (!user || !canSync() || sync.disabled) return;
  if (sync.pushing) { sync.dirty = true; return; }
  sync.dirty = false;
  sync.pushing = true;
  try {
    const { spaces, boxes } = snapshot(user.id);
    const r = await saveRemoteProfile(user, spaces, boxes);
    if (sync.user === user && typeof r.rev === 'number') sync.rev = r.rev;
  } catch (err) {
    noteBackendError(err);
    if (sync.disabled) { sync.dirty = false; }
    else { console.warn('Tixup sync: profile push failed', err); sync.dirty = true; }
  } finally {
    sync.pushing = false;
    if (sync.dirty && sync.user === user && !sync.disabled) {
      clearTimeout(sync.timer);
      sync.timer = setTimeout(push, PUSH_DEBOUNCE_MS * 4);
    }
  }
}

async function pull() {
  const user = sync.user;
  if (!user || !canSync() || sync.disabled || sync.dirty || sync.pushing || sync.pulling) return;
  sync.pulling = true;
  try {
    const r = await loadRemoteProfile(user);
    if (sync.user !== user || sync.dirty || sync.pushing) return; // local edits happened meanwhile
    if (!r.found) {
      // Nothing on the server yet: publish what this browser has (or the default made below).
      sync.rev = 0;
      if (getSpaces(user.id).length > 0) push();
      return;
    }
    if (r.rev === sync.rev) return;
    const firstSync = sync.rev === null;
    sync.rev = r.rev;
    const remote = Array.isArray(r.spaces) ? r.spaces : [];
    const remoteBoxes = r.boxes && typeof r.boxes === 'object' ? r.boxes : {};
    // First contact for this user: keep spaces the server does not know about (merge + publish).
    const local = firstSync ? getSpaces(user.id) : EMPTY;
    const missing = local.filter((s) => !remote.some((x) => x.id === s.id));
    const next = missing.length ? [...remote, ...missing] : remote;
    localStorage.setItem(spacesKey(user.id), JSON.stringify(next));
    next.forEach((s) => {
      const boxes = remoteBoxes[s.id] ?? (firstSync ? getBoxes(s.id) : EMPTY);
      localStorage.setItem(boxesKey(s.id), JSON.stringify(boxes));
    });
    emit();
    if (missing.length) push();
  } catch (err) {
    noteBackendError(err);
    if (!sync.disabled) console.warn('Tixup sync: profile pull failed', err);
  } finally {
    sync.pulling = false;
    if (sync.user === user) {
      ensureDefaults(user.id);
      setReady(true);
    }
  }
}

/**
 * Mount once (App). Starts / stops profile sync for the signed-in user and creates the default
 * space when the account has none.
 */
export function useSpaceSync(user) {
  const userId = user?.id ?? null;
  const email = user?.email ?? null;
  useEffect(() => {
    if (!userId) { sync.user = null; sync.rev = null; setReady(!canSync()); return undefined; }
    const me = { id: userId, email, name: user?.name ?? null };
    sync.user = me;
    sync.rev = null;
    sync.dirty = false;
    if (!canSync()) { ensureDefaults(userId); setReady(true); return undefined; }
    setReady(false);
    // Deferred so StrictMode's mount/unmount/mount only issues one initial pull.
    const initial = setTimeout(pull, 0);
    const onVisible = () => { if (document.visibilityState === 'visible') pull(); };
    const onHide = () => {
      if (!sync.dirty) return;
      const { spaces, boxes } = snapshot(userId);
      if (beaconSaveRemoteProfile(me, spaces, boxes)) sync.dirty = false;
    };
    const interval = setInterval(() => { if (document.visibilityState === 'visible') pull(); }, POLL_MS);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      clearTimeout(sync.timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      window.removeEventListener('pagehide', onHide);
      if (sync.dirty && !sync.pushing) push(); // flush before the user changes
      if (sync.user === me) sync.user = null;
    };
  }, [userId, email, user?.name]);
}

export function useSpaces() {
  const user = useAuth();
  const userId = user?.id ?? null;

  const ready = useSyncExternalStore(subscribe, isSpacesReady);
  const spaces = useSyncExternalStore(subscribe, () => getSpaces(userId));
  const activeSpaceId = useSyncExternalStore(subscribe, getActiveSpaceId);
  const activeBoxId = useSyncExternalStore(subscribe, getActiveBoxId);
  const boxes = useSyncExternalStore(subscribe, () => getBoxes(activeSpaceId));

  return useMemo(() => ({
    ready,
    spaces,
    activeSpace: spaces.find((s) => s.id === activeSpaceId) ?? spaces[0] ?? null,
    boxes,
    activeBox: boxes.find((b) => b.id === activeBoxId) ?? null,
    createSpace: (data) => createSpace(userId, data),
    renameSpace: (id, name) => renameSpace(userId, id, name),
    deleteSpace: (id) => deleteSpace(userId, id),
    addMembers: (spaceId, emails) => addMembers(userId, spaceId, emails),
    joinSpace: (invite) => joinSpace(userId, invite),
    switchSpace: setActiveSpaceId,
    createBox: (data) => (activeSpaceId ? createBox(activeSpaceId, data) : null),
    deleteBox: (id) => (activeSpaceId ? deleteBox(activeSpaceId, id) : null),
    selectBox: setActiveBoxId,
  }), [ready, spaces, boxes, activeSpaceId, activeBoxId, userId]);
}
