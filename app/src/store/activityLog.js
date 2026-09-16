import { useSyncExternalStore } from 'react';
import { CELL_WIDTH, CENTER_PX, BASE_EPOCH } from '../constants';

/**
 * Activity feed for the dashboard "Timeline" (Figma 37700:8285, right column).
 *
 * useTaskStore diffs every committed task list against the previous one and records what changed
 * (created / deleted, title, status, assignee, tags, start / due date, box). Entries live in
 * localStorage per space (`tixup-activity-<spaceId>`, newest first, capped) — they are not synced
 * to the backend, so each browser sees the changes it witnessed (its own edits plus pulled ones).
 *
 *   entry = { id, ts, kind: 'create'|'update'|'delete', taskId, title, boxId,
 *             changes: [{ field: 'title'|'status'|'assignee'|'tags'|'start'|'end'|'box', from, to }] }
 */
const MAX_ENTRIES = 300;
// A diff touching more tasks than this is a sync / import, not a person editing: skip it.
const BULK_LIMIT = 12;
const TRACKED = ['title', 'status', 'assignee', 'tags', 'start', 'end', 'box'];

const storageKey = (spaceId) => `tixup-activity-${spaceId}`;
const EMPTY = [];
const cache = new Map();
const listeners = new Set();

export function getActivity(spaceId) {
  if (!spaceId) return EMPTY;
  if (!cache.has(spaceId)) {
    try {
      const raw = localStorage.getItem(storageKey(spaceId));
      const parsed = raw ? JSON.parse(raw) : [];
      cache.set(spaceId, Array.isArray(parsed) ? parsed : []);
    } catch { cache.set(spaceId, []); }
  }
  return cache.get(spaceId);
}

function write(spaceId, list) {
  cache.set(spaceId, list);
  try { localStorage.setItem(storageKey(spaceId), JSON.stringify(list)); } catch { /* quota / private mode */ }
  listeners.forEach((fn) => fn());
}

export function clearActivity(spaceId) { write(spaceId, []); }

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Newest-first activity entries for a space; re-renders when new ones are recorded. */
export function useActivityLog(spaceId) {
  return useSyncExternalStore(subscribe, () => getActivity(spaceId), () => EMPTY);
}

/* ---- diffing ---- */

function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function offsetISO(offset) {
  const d = new Date(BASE_EPOCH);
  d.setDate(d.getDate() + offset);
  return localISO(d);
}
/** 'YYYY-MM-DD' start / end of a bar (stored px, 48 px/day); null when unplaced. */
export function taskDates(task) {
  if (!task || !Number.isFinite(task.start)) return { start: null, end: null };
  const startOffset = Math.round((task.start - CENTER_PX) / CELL_WIDTH);
  const days = Math.max(1, Math.round((Number.isFinite(task.width) ? task.width : CELL_WIDTH) / CELL_WIDTH));
  return { start: offsetISO(startOffset), end: offsetISO(startOffset + days - 1) };
}

function snapshot(task) {
  const { start, end } = taskDates(task);
  return {
    title: task.title || '',
    status: task.status || 'pending',
    assignee: task.assignee ? { name: task.assignee.name || null, email: task.assignee.email || null } : null,
    tags: Array.isArray(task.tags) ? [...task.tags] : [],
    start,
    end,
    box: task.boxId || null,
  };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function diffTasks(prev, next) {
  const entries = [];
  const prevById = new Map(prev.map((t) => [t.id, t]));
  const nextById = new Map(next.map((t) => [t.id, t]));
  next.forEach((t) => {
    const before = prevById.get(t.id);
    const after = snapshot(t);
    if (!before) {
      entries.push({ kind: 'create', taskId: t.id, title: after.title, boxId: after.box, changes: [{ field: 'status', from: null, to: after.status }] });
      return;
    }
    const was = snapshot(before);
    const changes = TRACKED.filter((f) => !same(was[f], after[f])).map((field) => ({ field, from: was[field], to: after[field] }));
    if (changes.length) entries.push({ kind: 'update', taskId: t.id, title: after.title, boxId: after.box, changes });
  });
  prev.forEach((t) => {
    if (!nextById.has(t.id)) {
      const was = snapshot(t);
      entries.push({ kind: 'delete', taskId: t.id, title: was.title, boxId: was.box, changes: [] });
    }
  });
  return entries;
}

let seq = 0;
/** Called by useTaskStore after each committed change. */
export function recordActivity(spaceId, prev, next) {
  if (!spaceId || !Array.isArray(prev) || !Array.isArray(next)) return;
  const entries = diffTasks(prev, next);
  if (!entries.length || entries.length > BULK_LIMIT) return;
  const ts = Date.now();
  const stamped = entries.map((e) => ({ ...e, id: `${ts}-${seq += 1}`, ts }));
  // Newest first. Consecutive edits of the same field on the same Tix within a minute collapse
  // into one entry (typing a title, dragging a bar) so the feed stays readable.
  const current = getActivity(spaceId);
  const merged = [...current];
  stamped.forEach((e) => {
    const head = merged[0];
    if (e.kind === 'update' && head && head.kind === 'update' && head.taskId === e.taskId && ts - head.ts < 60_000
      && e.changes.length === 1 && head.changes.length === 1 && head.changes[0].field === e.changes[0].field) {
      merged[0] = { ...head, ts, title: e.title, changes: [{ ...e.changes[0], from: head.changes[0].from }] };
      return;
    }
    merged.unshift(e);
  });
  write(spaceId, merged.slice(0, MAX_ENTRIES));
}
