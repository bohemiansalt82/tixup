import { useRef, useCallback } from 'react';
import { CENTER_PX } from '../constants';
import { parseSafePx, snapToGrid, toStoredLeft, toStoredWidth } from '../utils/timeline';

function setDraggingCursor(cursor) {
  document.body.style.cursor = cursor;
  document.documentElement.classList.toggle('dragging-active', !!cursor);
  document.body.classList.toggle('dragging-active', !!cursor);
}

export function useTimelineDrag({ tbodyRef, cellWidthRef, isDraggingRef, isResizingRef, selectedIds, setSelectedIds, onSave }) {
  const dragStartX = useRef(0);
  const initialPositions = useRef(new Map());
  const initialWidths = useRef(new Map());
  const resizeSide = useRef(null);
  const abortRef = useRef(null);

  const getBar = useCallback((id) =>
    tbodyRef.current?.querySelector(`[data-group="${id}"] .timeline-bar`), [tbodyRef]);

  const initPositions = useCallback((ids) => {
    const cw = cellWidthRef.current;
    initialPositions.current.clear();
    initialWidths.current.clear();
    ids.forEach(id => {
      const bar = getBar(id);
      if (bar) {
        initialPositions.current.set(id, parseSafePx(bar.style.left, CENTER_PX));
        initialWidths.current.set(id, parseSafePx(bar.style.width, cw));
        bar.classList.add('is-dragging');
      }
    });
  }, [cellWidthRef, getBar]);

  const attachListeners = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const { signal } = ac;

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingRef.current && !isResizingRef.current) return;
      window.getSelection()?.removeAllRanges();
      const cw = cellWidthRef.current;
      let delta = e.clientX - dragStartX.current;

      if (isDraggingRef.current) {
        initialPositions.current.forEach((startPos, id) => {
          const bar = getBar(id);
          if (bar) bar.style.left = `${startPos + delta}px`;
        });
      } else {
        let allowed = delta;
        initialWidths.current.forEach((sw) => {
          if (resizeSide.current === 'right' && sw + delta < cw) allowed = Math.min(allowed, cw - sw);
          else if (resizeSide.current === 'left' && sw - delta < cw) allowed = Math.max(allowed, sw - cw);
        });
        delta = allowed;
        initialPositions.current.forEach((startPos, id) => {
          const bar = getBar(id);
          const sw = initialWidths.current.get(id);
          if (!bar || !sw) return;
          if (resizeSide.current === 'right') {
            bar.style.width = `${Math.max(cw, sw + delta)}px`;
          } else {
            bar.style.left = `${startPos + delta}px`;
            bar.style.width = `${Math.max(cw, sw - delta)}px`;
          }
        });
      }
    }, { signal });

    window.addEventListener('mouseup', () => {
      if (!isDraggingRef.current && !isResizingRef.current) return;
      isDraggingRef.current = false;
      isResizingRef.current = false;
      const cw = cellWidthRef.current;

      const updates = [];
      initialPositions.current.forEach((_, id) => {
        const bar = getBar(id);
        if (bar) {
          const snappedLeft = snapToGrid(parseSafePx(bar.style.left, CENTER_PX), cw);
          const snappedWidth = Math.max(cw, Math.round(parseSafePx(bar.style.width, cw) / cw) * cw);
          bar.style.left = `${snappedLeft}px`;
          bar.style.width = `${snappedWidth}px`;
          bar.classList.remove('is-dragging');
          updates.push({ id, start: toStoredLeft(snappedLeft, cw), width: toStoredWidth(snappedWidth, cw) });
        }
      });

      onSave?.(updates);
      initialPositions.current.clear();
      initialWidths.current.clear();
      setDraggingCursor('');
      ac.abort();
    }, { signal });
  }, [cellWidthRef, isDraggingRef, isResizingRef, getBar, onSave]);

  const startDrag = useCallback((e, id, idsOverride) => {
    dragStartX.current = e.clientX;
    isDraggingRef.current = true;

    const baseIds = idsOverride ?? selectedIds;
    const dragSet = new Set(baseIds);
    baseIds.forEach(sid => {
      tbodyRef.current?.querySelectorAll(`[data-parent="${sid}"]`).forEach(r => {
        dragSet.add(r.getAttribute('data-group'));
      });
    });

    initPositions(dragSet);
    setDraggingCursor('grabbing');
    attachListeners();
  }, [selectedIds, tbodyRef, isDraggingRef, initPositions, attachListeners]);

  const startResize = useCallback((e, side, id, idsOverride) => {
    dragStartX.current = e.clientX;
    isResizingRef.current = true;
    resizeSide.current = side;
    initPositions(idsOverride ?? selectedIds);
    setDraggingCursor('ew-resize');
    attachListeners();
  }, [selectedIds, isResizingRef, initPositions, attachListeners]);

  return { startDrag, startResize };
}
