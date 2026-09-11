import { useState, useCallback, useEffect, useRef } from 'react';
import { CENTER_PX } from '../constants';
import { uid } from '../utils/timeline';
import { canSync, loadRemoteSpace, saveRemoteSpace, beaconSaveRemoteSpace } from './remote';

const PUSH_DEBOUNCE_MS = 700;
const POLL_MS = 15000;

const tasksKey = (spaceId) => `tixup-tasks-${spaceId}`;

function load(spaceId) {
  if (!spaceId) return [];
  try {
    const raw = localStorage.getItem(tasksKey(spaceId));
    return raw ? JSON.parse(raw) : [];
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
    clearTimeout(s.timer);
    s.timer = setTimeout(push, PUSH_DEBOUNCE_MS);
  }, [spaceId, push]);

  const pull = useCallback(async () => {
    const s = syncRef.current;
    if (!spaceId || !canSync() || s.dirty || s.pushing) return;
    try {
      const r = await loadRemoteSpace(spaceId, metaRef.current.user);
      if (s.unmounted || s.dirty || s.pushing) return; // local edits happened meanwhile
      if (!r.found) {
        // Nothing on the server yet: publish what this browser has (the owner's list).
        if (s.rev === null && load(spaceId).length > 0) push();
        else s.rev = 0;
        return;
      }
      if (r.rev === s.rev) return;
      const remote = Array.isArray(r.tasks) ? r.tasks : [];
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
    pull();
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
      const next = typeof updater === 'function' ? updater(prev) : updater;
      save(spaceId, next);
      return next;
    });
    schedulePush();
  }, [spaceId, schedulePush]);

  const addTask = useCallback((title, boxId = null) => {
    const task = { id: uid(), title, status: 'pending', type: 'parent', boxId, start: CENTER_PX, width: 96 };
    updateTasks(prev => [...prev, task]);
    setNewIds(prev => new Set([...prev, task.id]));
    setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(task.id); return s; }), 500);
    return task.id;
  }, [updateTasks]);

  const addChild = useCallback((parentId) => {
    const task = { id: uid(), title: '', status: 'pending', type: 'child', parentId, start: CENTER_PX, width: 96 };
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

  return { tasks, exitingIds, newIds, collapsingParentIds, expandingParentIds, addTask, addChild, removeTask, updateTask, toggleCollapse, moveTask };
}
