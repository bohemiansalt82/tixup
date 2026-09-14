import { useCallback, useEffect, useRef } from 'react';

/**
 * Snapshot undo/redo for the task list. Call `record()` right before a change you want to be
 * undoable; it snapshots the current list. Keeps the last `limit` snapshots.
 * Keys (while `enabled`): Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z or Ctrl+Y redo. Ignored inside inputs.
 */
export function useUndoHistory(tasks, replaceTasks, { limit = 30, enabled = true } = {}) {
  const stack = useRef({ past: [], future: [] });
  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const record = useCallback(() => {
    const s = stack.current;
    s.past.push(tasksRef.current);
    if (s.past.length > limit) s.past.splice(0, s.past.length - limit);
    s.future = [];
  }, [limit]);

  const undo = useCallback(() => {
    const s = stack.current;
    if (!s.past.length) return;
    s.future.push(tasksRef.current);
    replaceTasks(s.past.pop());
  }, [replaceTasks]);

  const redo = useCallback(() => {
    const s = stack.current;
    if (!s.future.length) return;
    s.past.push(tasksRef.current);
    replaceTasks(s.future.pop());
  }, [replaceTasks]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      else if (key === 'z') { e.preventDefault(); undo(); }
      else if (key === 'y' && e.ctrlKey) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, undo, redo]);

  return { record, undo, redo };
}
