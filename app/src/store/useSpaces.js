import { useSyncExternalStore, useMemo } from 'react';
import { useAuth } from './useAuth';

// localStorage keys shared with the vanilla app (dist/assets/js/tixup-auth.js)
const ACTIVE_SPACE_KEY = 'tixup-active-space';
const ACTIVE_BOX_KEY = 'tixup-active-box';
const spacesKey = (userId) => `tixup-spaces-${userId}`;
const boxesKey = (spaceId) => `tixup-boxes-${spaceId}`;

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
    members: data.members || [], // invited emails (UI only for now)
    createdAt: new Date().toISOString(),
  };
  writeJson(spacesKey(userId), [...getSpaces(userId), space]);
  setActiveSpaceId(space.id);
  return space;
}
export function renameSpace(userId, spaceId, name) {
  writeJson(spacesKey(userId), getSpaces(userId).map((s) => (s.id === spaceId ? { ...s, name } : s)));
}
/** Adds invited emails to a space (UI-level membership; nothing is sent). */
export function addMembers(userId, spaceId, emails) {
  writeJson(spacesKey(userId), getSpaces(userId).map((s) => {
    if (s.id !== spaceId) return s;
    const members = [...(s.members || [])];
    emails.forEach((e) => { if (!members.includes(e)) members.push(e); });
    return { ...s, members };
  }));
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
  }
  setActiveSpaceId(invite.id);
}

export function deleteSpace(userId, spaceId) {
  const rest = getSpaces(userId).filter((s) => s.id !== spaceId);
  writeJson(spacesKey(userId), rest);
  localStorage.removeItem(boxesKey(spaceId));
  if (getActiveSpaceId() === spaceId) setActiveSpaceId(rest[0]?.id ?? null);
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
    members: data.members || [], // invited emails (UI only for now)
    createdAt: new Date().toISOString(),
  };
  writeJson(boxesKey(spaceId), [...getBoxes(spaceId), box]);
  return box;
}
export function deleteBox(spaceId, boxId) {
  writeJson(boxesKey(spaceId), getBoxes(spaceId).filter((b) => b.id !== boxId));
  if (getActiveBoxId() === boxId) setActiveBoxId(null);
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
    const space = { id: uid('space'), name: 'My Space', createdAt: new Date().toISOString() };
    localStorage.setItem(spacesKey(userId), JSON.stringify([space]));
    spaces = [space];
  }
  const active = getActiveSpaceId();
  if (!active || !spaces.some((s) => s.id === active)) {
    localStorage.setItem(ACTIVE_SPACE_KEY, spaces[0].id);
  }
}

export function useSpaces() {
  const user = useAuth();
  const userId = user?.id ?? null;
  if (userId) ensureDefaults(userId);

  const spaces = useSyncExternalStore(subscribe, () => getSpaces(userId));
  const activeSpaceId = useSyncExternalStore(subscribe, getActiveSpaceId);
  const activeBoxId = useSyncExternalStore(subscribe, getActiveBoxId);
  const boxes = useSyncExternalStore(subscribe, () => getBoxes(activeSpaceId));

  return useMemo(() => ({
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
  }), [spaces, boxes, activeSpaceId, activeBoxId, userId]);
}
