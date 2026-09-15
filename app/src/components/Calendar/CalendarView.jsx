import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarItem } from './CalendarItem';
import {
  WEEKDAYS, addMonths, dateToDayOffset, formatMonth, isSameDay, layoutWeek, monthGrid, parseISO,
  spanToPx, startOfMonth, taskSpan, toISO,
} from './calendarLayout';
import './CalendarView.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/icons/${name}.svg`;
const addIcon = `${import.meta.env.BASE_URL}images/calendar/add_circle.svg`;

const ITEM_H = 60;
const ITEM_GAP = 10;
const ITEM_TOP = 46;
const ROW_MIN = 130;
const ROW_BOTTOM = 16;
const DRAG_THRESHOLD = 4;
/** Resize: fraction of a day cell the dragged edge must cross before the date snaps over. */
const SNAP_THRESHOLD = 0.7;

/** Block tint follows the timeline bar (`.timeline-bar-<status>` in components.css). */
const STATUSES = ['pending', 'inprogress', 'done', 'overdue', 'pause', 'drop'];

function directionOf(seg) {
  if (seg.continuesLeft && seg.continuesRight) return 'middle';
  if (seg.continuesRight) return 'start';
  if (seg.continuesLeft) return 'end';
  return 'both';
}

function dateAtPoint(x, y) {
  for (const el of document.elementsFromPoint(x, y)) {
    const date = el.dataset?.date;
    if (date) return date;
  }
  return null;
}

/**
 * Calendar view — Figma Tixup-V2.0 Calendar_View 37643:4421 / Calendar_View_Hover_Drag 37658:5140.
 * Each block is a parent Tix placed by its timeline bar (48 px/day); the text under the title
 * is the titles of its sub-tix. Drag a block to move it (its sub-tix bars move with it), drag
 * the edge handles to change start/end, hover a day and press + to create a Tix on that day.
 *
 * Every gesture reports once through `onCommit(updates)` where updates = [{ id, start, width }]
 * in stored px, so one gesture = one undo step for the caller.
 */
export function CalendarView({ tasks, onCommit, onCreateTix, onOpenTix }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const today = useMemo(() => new Date(), []);
  const weeks = useMemo(() => monthGrid(month), [month]);

  // Parent Tix → blocks; sub-tix titles come from the children in list order.
  const items = useMemo(() => {
    const subs = new Map();
    tasks.forEach((t) => {
      if (t.type !== 'child' || !t.parentId) return;
      if (!subs.has(t.parentId)) subs.set(t.parentId, []);
      if (t.title) subs.get(t.parentId).push(t.title);
    });
    return tasks
      .filter((t) => t.type === 'parent')
      .map((t) => ({ id: t.id, task: t, span: taskSpan(t), subTix: subs.get(t.id) ?? [], color: STATUSES.includes(t.status) ? t.status : 'pending' }))
      .filter((it) => it.span !== null);
  }, [tasks]);

  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);
  useEffect(() => { dragRef.current = drag; }, [drag]);
  const [preview, setPreview] = useState(null); // { id, startOffset, endOffset } while resizing
  const previewRef = useRef(null);
  useEffect(() => { previewRef.current = preview; }, [preview]);

  const effectiveItems = useMemo(() => {
    if (!preview) return items;
    return items.map((it) => {
      if (it.id !== preview.id) return it;
      const px = spanToPx(preview.startOffset, preview.endOffset);
      return { ...it, span: taskSpan({ ...it.task, ...px }) };
    });
  }, [items, preview]);
  const itemById = useMemo(() => new Map(effectiveItems.map((it) => [it.id, it])), [effectiveItems]);

  const startMove = (seg, e) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDrag({
      mode: 'move',
      id: seg.id,
      originDate: dateAtPoint(e.clientX, e.clientY) ?? seg.span.startISO,
      pointer: { x: e.clientX, y: e.clientY },
      offset: { x: e.clientX - rect.left, y: e.clientY - rect.top },
      width: rect.width,
      moved: false,
      hoverDate: null,
    });
  };

  const startResize = (seg, edge, e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // `x` / `row` let the dragged edge follow the pointer live; the span itself snaps per day.
    setDrag({ mode: 'resize', id: seg.id, edge, x: null, row: null });
  };

  useEffect(() => {
    if (!drag) return undefined;

    const onMove = (e) => {
      const current = dragRef.current;
      if (!current) return;
      const date = dateAtPoint(e.clientX, e.clientY);
      if (current.mode === 'move') {
        const moved = current.moved || Math.hypot(e.clientX - current.pointer.x, e.clientY - current.pointer.y) > DRAG_THRESHOLD;
        setDrag({ ...current, moved, pointer: moved ? { x: e.clientX, y: e.clientY } : current.pointer, hoverDate: date });
        return;
      }
      // Live edge: remember the pointer x and the week row under it (null outside the grid).
      const rowEl = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.classList?.contains('cv-week'));
      if (!rowEl) return;
      const rect = rowEl.getBoundingClientRect();
      setDrag({ ...current, x: e.clientX, row: { key: rowEl.dataset.week, left: rect.left, width: rect.width } });
      const item = itemById.get(current.id);
      if (!item) return;
      const base = previewRef.current ?? { id: item.id, startOffset: item.span.startOffset, endOffset: item.span.startOffset + item.span.days - 1 };
      // Edge position as a continuous day offset (row start + pointer x in cell widths). The
      // snapped day only changes once the edge has travelled SNAP_THRESHOLD of a cell past the
      // current boundary, in either direction, so a slight overshoot never flips the date.
      const p = dateToDayOffset(parseISO(rowEl.dataset.week)) + Math.min(Math.max(e.clientX - rect.left, 0), rect.width) / (rect.width / 7);
      let next = base;
      if (current.edge === 'end') {
        const b = base.endOffset + 1; // boundary after the last day
        let nb = b;
        if (p > b + SNAP_THRESHOLD) nb = Math.floor(p - SNAP_THRESHOLD) + 1;
        else if (p < b - SNAP_THRESHOLD) nb = Math.ceil(p + SNAP_THRESHOLD) - 1;
        next = { ...base, endOffset: Math.max(nb, base.startOffset + 1) - 1 };
      } else {
        const s = base.startOffset; // boundary before the first day
        let ns = s;
        if (p < s - SNAP_THRESHOLD) ns = Math.floor(p + SNAP_THRESHOLD);
        else if (p > s + SNAP_THRESHOLD) ns = Math.ceil(p - SNAP_THRESHOLD);
        next = { ...base, startOffset: Math.min(ns, base.endOffset) };
      }
      if (next.startOffset !== base.startOffset || next.endOffset !== base.endOffset) setPreview(next);
    };

    const onUp = (e) => {
      const current = dragRef.current;
      if (current?.mode === 'move' && !current.moved) {
        // Plain click (no drag): open the Tix detail popup.
        onOpenTix?.(current.id);
      } else if (current?.mode === 'move' && current.moved) {
        const dropDate = dateAtPoint(e.clientX, e.clientY);
        const item = itemById.get(current.id);
        if (dropDate && item) {
          const delta = dateToDayOffset(parseISO(dropDate)) - dateToDayOffset(parseISO(current.originDate));
          if (delta !== 0) {
            // Move the parent and its sub-tix bars together.
            const group = tasks.filter((t) => t.id === item.id || t.parentId === item.id);
            onCommit(group.map((t) => ({ id: t.id, start: t.start + delta * 48, width: t.width })));
          }
        }
      } else if (current?.mode === 'resize') {
        const final = previewRef.current;
        if (final) onCommit([{ id: final.id, ...spanToPx(final.startOffset, final.endOffset) }]);
        setPreview(null);
      }
      setDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [drag, itemById, tasks, onCommit, onOpenTix]);

  const moving = drag?.mode === 'move' && drag.moved ? itemById.get(drag.id) : undefined;

  return (
    <div className="cv-section">
      <div className="cv-calendar" role="grid" aria-label="Calendar">
        {/* Month toolbar sits inside the card (Figma 39552:12445): 18px month + ‹ This Month ›
            built from "Button / Ghost" SM (24px, radius 8, 10px SemiBold; hover #F5F5F5). */}
        <div className="cv-toolbar">
          <span className="cv-month">{formatMonth(month)}</span>
          <div className="cv-nav">
            <button type="button" className="cv-ghost-btn cv-arrow-btn" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
              <span className="cv-ghost-icon" style={{ '--icon': `url(${icon('chevron_left')})` }} aria-hidden="true" />
            </button>
            <button type="button" className="cv-ghost-btn" onClick={() => setMonth(startOfMonth(new Date()))}>This Month</button>
            <button type="button" className="cv-ghost-btn cv-arrow-btn" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
              <span className="cv-ghost-icon" style={{ '--icon': `url(${icon('chevron_right')})` }} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="cv-scroll">
        <div className="cv-weekdays" role="row">
          {WEEKDAYS.map((d) => <div key={d} className="cv-weekday" role="columnheader">{d}</div>)}
        </div>

        {weeks.map((week) => {
          const { segments, laneCount } = layoutWeek(week, effectiveItems);
          const rowHeight = Math.max(ROW_MIN, ITEM_TOP + laneCount * (ITEM_H + ITEM_GAP) - ITEM_GAP + ROW_BOTTOM + 1);
          const weekKey = toISO(week[0]);
          return (
            <div key={weekKey} className="cv-week" role="row" data-week={weekKey} style={{ minHeight: rowHeight }}>
              {week.map((day, col) => {
                const iso = toISO(day);
                const cls = ['cv-cell', col === 0 || col === 6 ? 'cv-weekend' : '', moving && drag.hoverDate === iso ? 'cv-drop-target' : ''].filter(Boolean).join(' ');
                const dateCls = ['cv-date', day.getMonth() !== month.getMonth() ? 'cv-other-month' : '', isSameDay(day, today) ? 'cv-today' : ''].filter(Boolean).join(' ');
                return (
                  <div key={iso} className={cls} data-date={iso} role="gridcell">
                    <div className="cv-date-row">
                      {onCreateTix && (
                        <button type="button" className="cv-add-btn" onClick={() => onCreateTix(iso)} title="Create Tix on this day">
                          <img src={addIcon} alt="" width={24} height={24} />
                        </button>
                      )}
                      <span className={dateCls}>{day.getDate()}</span>
                    </div>
                  </div>
                );
              })}

              <div className="cv-items">
                {segments.map((seg) => {
                  const style = { left: `${(seg.startCol / 7) * 100}%`, width: `${((seg.endCol - seg.startCol + 1) / 7) * 100}%`, top: ITEM_TOP + seg.lane * (ITEM_H + ITEM_GAP) };
                  // While resizing, the dragged edge in the row under the pointer follows the pointer
                  // pixel-for-pixel; the other edge stays on its day. Snaps on release.
                  if (drag?.mode === 'resize' && drag.id === seg.id && drag.row?.key === weekKey && drag.x !== null) {
                    const colW = drag.row.width / 7;
                    const x = Math.min(Math.max(drag.x - drag.row.left, 0), drag.row.width);
                    if (drag.edge === 'end' && !seg.continuesRight) {
                      const leftPx = seg.startCol * colW;
                      style.left = leftPx;
                      style.width = Math.min(Math.max(x - leftPx, colW), drag.row.width - leftPx);
                    } else if (drag.edge === 'start' && !seg.continuesLeft) {
                      const rightPx = (seg.endCol + 1) * colW;
                      const leftPx = Math.min(x, rightPx - colW);
                      style.left = leftPx;
                      style.width = rightPx - leftPx;
                    }
                  }
                  return (
                  <div
                    key={`${seg.id}-${seg.startCol}`}
                    className={['cv-segment', seg.continuesLeft ? 'cv-seg-from-left' : '', seg.continuesRight ? 'cv-seg-to-right' : ''].filter(Boolean).join(' ')}
                    style={style}
                  >
                    <CalendarItem
                      title={seg.task.title}
                      subTix={seg.subTix}
                      color={seg.color}
                      direction={directionOf(seg)}
                      active={drag?.mode === 'resize' && drag.id === seg.id}
                      data-task-id={seg.id}
                      onPointerDown={(e) => startMove(seg, e)}
                      onHandlePointerDown={(edge, e) => startResize(seg, edge, e)}
                    />
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {moving && (
        <div className="cv-ghost" style={{ left: drag.pointer.x - drag.offset.x, top: drag.pointer.y - drag.offset.y, width: drag.width }}>
          <CalendarItem title={moving.task.title} subTix={moving.subTix} color={moving.color} interaction="drag" />
        </div>
      )}
    </div>
  );
}
