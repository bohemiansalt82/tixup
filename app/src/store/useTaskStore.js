import { useState, useCallback, useRef } from 'react';
import { STORAGE_KEY, CENTER_PX } from '../constants';
import { uid } from '../utils/timeline';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function useTaskStore() {
  const [tasks, setTasks] = useState(() => load());
  const [exitingIds, setExitingIds] = useState(new Set());
  const [newIds, setNewIds] = useState(new Set());
  const [collapsingParentIds, setCollapsingParentIds] = useState(new Set());
  const [expandingParentIds, setExpandingParentIds] = useState(new Set());

  const updateTasks = useCallback((updater) => {
    setTasks(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      save(next);
      return next;
    });
  }, []);

  const addTask = useCallback((title) => {
    const task = { id: uid(), title, status: 'pending', type: 'parent', start: CENTER_PX, width: 96 };
    updateTasks(prev => [...prev, task]);
    setNewIds(prev => new Set([...prev, task.id]));
    setTimeout(() => setNewIds(prev => { const s = new Set(prev); s.delete(task.id); return s; }), 500);
    return task.id;
  }, [updateTasks]);

  const addChild = useCallback((parentId) => {
    const task = { id: uid(), title: '', status: 'pending', type: 'child', parentId, start: CENTER_PX, width: 96 };
    updateTasks(prev => {
      const siblings = prev.filter(t => t.parentId === parentId);
      const insertAfter = siblings.length > 0 ? siblings[siblings.length - 1].id : parentId;
      const idx = prev.findIndex(t => t.id === insertAfter);
      return [...prev.slice(0, idx + 1), task, ...prev.slice(idx + 1)];
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
