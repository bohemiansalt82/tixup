import { useState, useCallback, useEffect, useRef } from 'react';
import { CENTER_PX } from '../constants';
import { uid, rebaseTasks, recordHistory } from '../utils/timeline';
import { canSync, loadRemoteSpace, saveRemoteSpace, beaconSaveRemoteSpace } from './remote';

const PUSH_DEBOUNCE_MS = 700;
const POLL_MS = 15000;

const tasksKey = (spaceId) => `tixup-tasks-${spaceId}`;
// Set while a local change has not reached the backend yet. Survives a reload, so the first
// pull after a refresh pushes the pending list instead of overwriting it with the server copy
// (which used to make an edit "disappear" until the next poll brought the beacon-saved copy back).
const dirtyKey = (spaceId) => `tixup-dirty-${spaceId}`;
const hasPendingPush = (spaceId) => { try { return localStorage.getItem(dirtyKey(spaceId)) === '1'; } catch { return false; } };
const setPendingPush = (spaceId, on) => { try { if (on) localStorage.setItem(dirtyKey(spaceId), '1'); else localStorage.removeItem(dirtyKey(spaceId)); } catch { /* ignore */ } };

function load(spaceId) {
  if (!spaceId) return [];
  try {
    const raw = localStorage.getItem(tasksKey(spaceId));
    const parsed = raw ? JSON.parse(raw) : [];
    // Shift px written on an earlier day so every bar keeps its calendar date (see rebaseTasks).
    const list = rebaseTasks(parsed);
    if (list !== parsed) save(spaceId, list);
    return list;
  } catch { return []; }
}

function save(spaceId, tasks) {
  if (!spaceId) return;
  localStorage.setItem(tasksKey(spaceId), JSON.stringify(tasks));
}

/** Appends local-only tasks to the remote list, keeping children right after their parent. */
function mergeMissing(remote, missing) {
  const out = [...remote];
  missing.filter(t => t.type !== 'child').forEach(t => out.push(t));
  missing.filter(t => t.type === 'child').forEach(t => {
    let idx = out.findIndex(x => x.id === t.parentId);
    if (idx === -1) { out.push(t); return; }
    while (idx + 1 < out.length && out[idx + 1].parentId === t.parentId) idx++;
    out.splice(idx + 1, 0, t);
  });
  return out;
}

/**
 * Tasks for one space. Mount with a `key` of the space id so state reloads on switch.
 * localStorage is the immediate store; when a backend endpoint is configured the list is
 * also mirrored to the shared space document (see store/remote.js) so invitees see it:
 *  - mount / focus / every POLL_MS: pull the remote list if its revision changed
 *  - every local change: debounced push (last write wins)
 * `space` / `user` are only used to label the remote document.
 */
export function useTaskStore(spaceId, { space = null, user = null } = {}) {
  const [tasks, setTasks] = useState(() => load(spaceId));
  const [exitingIds, setExitingIds] = useState(new Set());
  const [newIds, setNewIds] = useState(new Set());
  const [collapsingParentIds, setCollapsingParentIds] = useState(new Set());
  const [expandingParentIds, setExpandingParentIds] = useState(new Set());
  // Members recorded on the shared space document (owner + everyone who opened an invite).
  const [remoteMembers, setRemoteMembers] = useState([]);
  const [onlineEmails, setOnlineEmails] = useState([]); // members the backend saw in the last ~45 s

  // ---- remote sync (refs so callbacks stay stable) ----
  const syncRef = useRef({ rev: null, dirty: false, pushing: false, timer: null, unmounted: false });
  const metaRef = useRef({ space, user });
  useEffect(() => { metaRef.current = { space, user }; }, [space, user]);
  const pushRef = useRef(() => {}); // latest push(), for retries scheduled from inside push()
  const spaceMeta = useCallback(() => {
    const m = metaRef.current.space;
    return { id: spaceId, name: m?.name, visibility: m?.visibility };
  }, [spaceId]);

  const push = useCallback(async () => {
    const s = syncRef.current;
    if (!spaceId || !canSync()) return;
    if (s.pushing) { s.dirty = true; return; }
    s.dirty = false;
    s.pushing = true;
    try {
      // localStorage always holds the latest list (save() runs inside every update).
      const r = await saveRemoteSpace(spaceMeta(), load(spaceId), metaRef.current.user);
      s.rev = r.rev;
      if (!s.dirty) setPendingPush(spaceId, false);
    } catch (err) {
      console.warn('Tixup sync: push failed', err);
      s.dirty = true;
    } finally {
      s.pushing = false;
      if (s.dirty && !s.unmounted) {
        clearTimeout(s.timer);
        s.timer = setTimeout(() => pushRef.current(), PUSH_DEBOUNCE_MS * 4);
      }
    }
  }, [spaceId, spaceMeta]);
  useEffect(() => { pushRef.current = push; }, [push]);

  const schedulePush = useCallback(() => {
    const s = syncRef.current;
    if (!spaceId || !canSync()) return;
    s.dirty = true;
    setPendingPush(spaceId, true);
    clearTimeout(s.timer);
    s.timer = setTimeout(push, PUSH_DEBOUNCE_MS);
  }, [spaceId, push]);

  const pull = useCallback(async () => {
    const s = syncRef.current;
    if (!spaceId || !canSync() || s.dirty || s.pushing) return;
    // A change from before a reload never reached the server: publish it first. The push
    // records the new revision, so the next poll sees nothing to pull.
    if (hasPendingPush(spaceId)) { push(); return; }
    try {
      const r = await loadRemoteSpace(spaceId, metaRef.current.user);
      if (s.unmounted || s.dirty || s.pushing) return; // local edits happened meanwhile
      if (!r.found) {
        // Nothing on the server yet: publish what this browser has (the owner's list).
        if (s.rev === null && load(spaceId).length > 0) push();
        else s.rev = 0;
        return;
      }
      if (r.space) {
        const list = [];
        if (r.space.owner) list.push({ email: r.space.owner, name: r.space.ownerName || null });
        (r.space.members || []).forEach(email => { if (!list.some(m => m.email === email)) list.push({ email, name: null }); });
        setRemoteMembers(prev => (JSON.stringify(prev) === JSON.stringify(list) ? prev : list));
      }
      if (Array.isArray(r.online)) {
        const online = r.online.map(e => String(e).toLowerCase()).sort();
        setOnlineEmails(prev => (prev.join() === online.join() ? prev : online));
      }
      if (r.rev === s.rev) return;
      const remote = rebaseTasks(Array.isArray(r.tasks) ? r.tasks : []);
      const firstSync = s.rev === null;
      s.rev = r.rev;
      // First contact with the server for this space: never drop local Tix the server
      // does not know about — merge them in and publish the union.
      const local = firstSync ? load(spaceId) : [];
      const missing = local.filter(t => !remote.some(x => x.id === t.id));
      const next = missing.length ? mergeMissing(remote, missing) : remote;
      save(spaceId, next);
      setTasks(next);
      if (missing.length) push();
    } catch (err) {
      console.warn('Tixup sync: pull failed', err);
    }
  }, [spaceId, push]);

  useEffect(() => {
    if (!spaceId || !canSync()) return undefined;
    const s = syncRef.current;
    s.unmounted = false;
    // Deferred so StrictMode's mount/unmount/mount only issues one initial pull.
    const initial = setTimeout(pull, 0);
    const onVisible = () => { if (document.visibilityState === 'visible') pull(); };
    const onHide = () => {
      if (!s.dirty) return;
      if (beaconSaveRemoteSpace(spaceMeta(), load(spaceId), metaRef.current.user)) s.dirty = false;
    };
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') pull();
    }, POLL_MS);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    window.addEventListener('pagehide', onHide);
    return () => {
      s.unmounted = true;
      clearTimeout(initial);
      clearInterval(interval);
      clearTimeout(s.timer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
      window.removeEventListener('pagehide', onHide);
      if (s.dirty && !s.pushing) push(); // flush before the space switches away
    };
  }, [spaceId, pull, push, spaceMeta]);

  const updateTasks = useCallback((updater) => {
    setTasks(prev => {
      // Every write stamps `anchor` = today so other days/browsers can re-anchor the px values,
      // and appends add / change entries to each task's `history` (Dashboard Archive).
      const next = recordHistory(prev, rebaseTasks(typeof updater === 'function' ? updater(prev) : updater));
      save(spaceId, next);
      return next;
    });
    schedulePush();
  }, [spaceId, schedulePush]);

  const addTask = useCallback((title, boxId = null) => {
    const task = { id: uid(), title, status: 'pending', type: 'parent', boxId, start: CENTER_PX, width: 96, createdAt: new Date().toISOString() };
    updateTasks(prev => [...prev, task]);
    setNewIds(prev => new Set([...prev, task.id]));
    setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(task.id); return s; }), 500);
    return task.id;
  }, [updateTasks]);

  const addChild = useCallback((parentId) => {
    const task = { id: uid(), title: '', status: 'pending', type: 'child', parentId, start: CENTER_PX, width: 96, createdAt: new Date().toISOString() };
    updateTasks(prev => {
      const parent = prev.find(t => t.id === parentId);
      const child = { ...task, boxId: parent?.boxId ?? null };
      const siblings = prev.filter(t => t.parentId === parentId);
      const insertAfter = siblings.length > 0 ? siblings[siblings.length - 1].id : parentId;
      const idx = prev.findIndex(t => t.id === insertAfter);
      return [...prev.slice(0, idx + 1), child, ...prev.slice(idx + 1)];
    });
    setNewIds(prev => new Set([...prev, task.id]));
    setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(task.id); return s; }), 500);
    return task.id;
  }, [updateTasks]);

  const removeTask = useCallback((id) => {
    setExitingIds(prev => new Set([...prev, id]));
    setTimeout(() => {
      setExitingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      updateTasks(prev => prev.filter(t => t.id !== id && t.parentId !== id));
    }, 420);
  }, [updateTasks]);

  const updateTask = useCallback((id, patch) => {
    updateTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, [updateTasks]);

  /** Replace the whole list (undo/redo snapshots). */
  const replaceTasks = useCallback((list) => {
    updateTasks(list);
  }, [updateTasks]);

  const toggleCollapse = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    if (!task.collapsed) {
      // 접기: 자식 exit 애니메이션 후 실제 collapse
      setCollapsingParentIds(s => new Set([...s, id]));
      setTimeout(() => {
        updateTasks(p => p.map(t => t.id === id ? { ...t, collapsed: true } : t));
        setCollapsingParentIds(s => { const ns = new Set(s); ns.delete(id); return ns; });
      }, 420);
    } else {
      // 펼치기: 자식 enter 애니메이션
      setExpandingParentIds(s => new Set([...s, id]));
      updateTasks(p => p.map(t => t.id === id ? { ...t, collapsed: false } : t));
      setTimeout(() => {
        setExpandingParentIds(s => { const ns = new Set(s); ns.delete(id); return ns; });
      }, 500);
    }
  }, [tasks, updateTasks]);

  const moveTask = useCallback((dragId, targetId, position) => {
    // position: 'before' | 'after' | 'into'
    updateTasks(prev => {
      if (dragId === targetId) return prev;
      const drag = prev.find(t => t.id === dragId);
      const target = prev.find(t => t.id === targetId);
      if (!drag || !target) return prev;

      const isParentDrag = drag.type === 'parent';
      const dragChildren = isParentDrag ? prev.filter(t => t.parentId === dragId) : [];
      const dragBlock = [drag, ...dragChildren];

      const rest = prev.filter(t => !dragBlock.some(b => b.id === t.id));
      const targetIdx = rest.findIndex(t => t.id === targetId);
      if (targetIdx === -1) return prev;

      let insertIdx;
      let updatedDrag = drag;

      if (position === 'into') {
        let lastIdx = targetIdx;
        for (let i = targetIdx + 1; i < rest.length; i++) {
          if (rest[i].parentId === targetId) lastIdx = i;
          else break;
        }
        insertIdx = lastIdx + 1;
        updatedDrag = { ...drag, parentId: targetId };
      } else if (position === 'before') {
        insertIdx = targetIdx;
        if (!isParentDrag) updatedDrag = { ...drag, parentId: target.parentId };
      } else { // after
        if (isParentDrag) {
          let end = targetIdx + 1;
          while (end < rest.length && rest[end].parentId === targetId) end++;
          insertIdx = end;
        } else {
          insertIdx = targetIdx + 1;
          updatedDrag = { ...drag, parentId: target.parentId };
        }
      }

      const result = [...rest];
      result.splice(insertIdx, 0, updatedDrag, ...dragChildren);
      return result;
    });
  }, [updateTasks]);

  return { tasks, exitingIds, newIds, collapsingParentIds, expandingParentIds, remoteMembers, onlineEmails, addTask, addChild, removeTask, updateTask, replaceTasks, toggleCollapse, moveTask };
}
