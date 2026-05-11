import { useRef, useState, useEffect, useCallback, memo } from 'react';
import { CENTER_PX, VIRTUAL_WIDTH, INITIAL_PAN_OFFSET, CELL_WIDTH } from '../../constants';
import { toVisualLeft, toVisualWidth, parseSafePx, snapToGrid, toStoredLeft, toStoredWidth } from '../../utils/timeline';
import { useTimelineScroll } from '../../hooks/useTimelineScroll';
import { useTimelineDrag } from '../../hooks/useTimelineDrag';

const VIEW_PRESETS = { month: 20, week: 48, day: 80 };

const SIDEBAR_WIDTH = 400;

export function TimelineView({ tasks, exitingIds, newIds, collapsingParentIds, expandingParentIds, onSaveBarPositions }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const viewportRef = useRef(null);
  const tbodyRef = useRef(null);
  const daysHeaderRef = useRef(null);
  const gridBackRef = useRef(null);
  const floatingLabelsRef = useRef(null);
  const todayRef = useRef(null);
  const fixedMasterRef = useRef(null);
  const panOffsetRef = useRef(INITIAL_PAN_OFFSET);
  const cellWidthRef = useRef(CELL_WIDTH);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const initializedRef = useRef(false);

  const [cellWidth, setCellWidth] = useState(CELL_WIDTH);
  const [viewMode, setViewMode] = useState('week');

  const { renderHeader, scrollToToday, scrollPrev, scrollNext, updateZoom } = useTimelineScroll({
    viewportRef, tbodyRef, daysHeaderRef, gridBackRef, floatingLabelsRef,
    todayRef, fixedMasterRef, panOffsetRef, cellWidthRef,
    isDraggingRef, isResizingRef, setCellWidth,
  });

  const handleViewChange = useCallback((mode) => {
    setViewMode(mode);
    updateZoom(VIEW_PRESETS[mode]);
  }, [updateZoom]);

  const { startDrag, startResize } = useTimelineDrag({
    tbodyRef, cellWidthRef, isDraggingRef, isResizingRef,
    selectedIds, setSelectedIds, onSave: onSaveBarPositions,
  });

  // Init: runs once after mount. Uses window.innerWidth since clientWidth is unreliable at mount.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const saved = parseFloat(localStorage.getItem('tixup_zoom'));
    if (saved && saved >= 20 && saved <= 150) {
      cellWidthRef.current = saved;
      setCellWidth(saved);
    } else {
      localStorage.removeItem('tixup_zoom');
    }

    // Use window width minus sidebar as reliable viewport width estimate
    const vpWidth = window.innerWidth - SIDEBAR_WIDTH;
    const targetScrollLeft = VIRTUAL_WIDTH / 2 - vpWidth / 2 + 24;
    vp.scrollLeft = targetScrollLeft;

    const cw = cellWidthRef.current;
    const absLeft = targetScrollLeft + panOffsetRef.current;
    const dayOffset = Math.round((absLeft - CENTER_PX) / cw);
    console.log('[Timeline Init]', {
      windowInnerWidth: window.innerWidth,
      vpWidth,
      cellWidth: cw,
      panOffset: panOffsetRef.current,
      targetScrollLeft,
      absLeft,
      dayOffset,
      note: Math.abs(dayOffset) <= 1 ? '✅ 오늘 정중앙' : `⚠️ 오늘 기준 ${dayOffset}일 차이`,
    });

    initializedRef.current = true;
    renderHeader();
  }, []); // eslint-disable-line

  // Re-render header only after zoom changes (not on initial mount — init above handles that)
  useEffect(() => {
    if (initializedRef.current) renderHeader();
  }, [cellWidth, renderHeader]);

  const handleTbodyMouseDown = useCallback((e) => {
    const resizer = e.target.closest('.timeline-bar-resizer');
    const bar = e.target.closest('.timeline-bar');

    if (resizer) {
      e.stopPropagation();
      const side = resizer.classList.contains('resizer-left') ? 'left' : 'right';
      const id = bar.parentElement.getAttribute('data-group');
      let nextSelected = selectedIds;
      if (!selectedIds.has(id)) {
        const s = e.shiftKey || e.metaKey ? new Set(selectedIds) : new Set();
        s.add(id);
        nextSelected = s;
        setSelectedIds(nextSelected);
      }
      requestAnimationFrame(() => startResize(e, side, id, nextSelected));
      return;
    }

    if (!bar) {
      e.stopPropagation();
      if (!e.shiftKey && !e.metaKey) setSelectedIds(new Set());
      return;
    }

    e.stopPropagation();
    const id = bar.parentElement.getAttribute('data-group');
    const s = new Set(selectedIds);
    if (e.shiftKey || e.metaKey) {
      if (s.has(id)) s.delete(id); else s.add(id);
    } else {
      if (!s.has(id)) { s.clear(); s.add(id); }
    }
    setSelectedIds(s);
    requestAnimationFrame(() => startDrag(e, id, s));
  }, [selectedIds, setSelectedIds, startDrag, startResize]);

  const handleDblClick = useCallback((e) => {
    const bar = e.target.closest('.timeline-bar');
    if (!bar) return;
    const row = bar.parentElement;
    if (row.getAttribute('data-type') !== 'parent') return;
    const id = row.getAttribute('data-group');

    const childRows = tbodyRef.current?.querySelectorAll(`[data-parent="${id}"]`);
    if (!childRows || childRows.length === 0) return;

    let minLeft = Infinity;
    let maxRight = -Infinity;
    childRows.forEach(childRow => {
      const childBar = childRow.querySelector('.timeline-bar');
      if (!childBar) return;
      const left = parseSafePx(childBar.style.left, 0);
      const width = parseSafePx(childBar.style.width, 0);
      if (left < minLeft) minLeft = left;
      if (left + width > maxRight) maxRight = left + width;
    });

    if (minLeft === Infinity) return;

    const cw = cellWidthRef.current;
    const snappedLeft = snapToGrid(minLeft, cw);
    const snappedWidth = Math.max(cw, Math.round((maxRight - minLeft) / cw) * cw);
    bar.style.left = `${snappedLeft}px`;
    bar.style.width = `${snappedWidth}px`;

    onSaveBarPositions?.([{ id, start: toStoredLeft(snappedLeft, cw), width: toStoredWidth(snappedWidth, cw) }]);
  }, [tbodyRef, cellWidthRef, onSaveBarPositions]);

  return (
    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div className="timeline-nav-bar">
        <div className="timeline-nav-left">
          <div id="timeline-fixed-master" ref={fixedMasterRef} />
          <div id="timeline-floating-labels" ref={floatingLabelsRef} />
        </div>
        <div className="timeline-nav-right">
          <select className="nav-view-select" value={viewMode} onChange={e => handleViewChange(e.target.value)}>
            <option value="month">Month</option>
            <option value="week">Week</option>
            <option value="day">Day</option>
          </select>
          <div className="timeline-nav-group">
            <button className="nav-arrow-btn" onClick={scrollPrev}>
              <img src={`${import.meta.env.BASE_URL}images/icons/chevron_left.svg`} alt="이전" />
            </button>
            <button className="nav-today-btn" id="go-today-btn" onClick={scrollToToday}>Today</button>
            <button className="nav-arrow-btn" onClick={scrollNext}>
              <img src={`${import.meta.env.BASE_URL}images/icons/chevron_right.svg`} alt="다음" />
            </button>
          </div>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="timeline-view-viewport"
        id="viewport-container"
        style={{ flex: 1, minWidth: 0, overflowX: 'scroll', overflowY: 'auto' }}
      >
        <div className="timeline-grid-content" style={{ width: VIRTUAL_WIDTH, position: 'relative' }}>

          {/* Sticky header inside viewport so day-cell transforms work */}
          <div className="timeline-header">
            <div className="timeline-days-row" id="timeline-days-header" ref={daysHeaderRef} />
          </div>

          <div className="timeline-body">
            <div
              id="timeline-grid-back"
              ref={gridBackRef}
              style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '2000000px', pointerEvents: 'none' }}
            />
            <div className="timeline-today-line" id="timeline-today-indicator" ref={todayRef} />
            <div id="timeline-tbody" ref={tbodyRef} onMouseDown={handleTbodyMouseDown} onDoubleClick={handleDblClick}>
              {(() => {
                const collapsedParentIds = new Set(tasks.filter(t => t.collapsed).map(t => t.id));
                return tasks
                  .filter(t => {
                    if (t.type !== 'child') return true;
                    const fullyCollapsed = collapsedParentIds.has(t.parentId) && !collapsingParentIds?.has(t.parentId);
                    return !fullyCollapsed;
                  })
                  .map(task => (
                    <TimelineRow
                      key={task.id}
                      task={task}
                      cellWidth={cellWidth}
                      isExiting={exitingIds.has(task.id)}
                      isCollapsing={task.type === 'child' && collapsingParentIds?.has(task.parentId)}
                      isNew={newIds.has(task.id) || (task.type === 'child' && expandingParentIds?.has(task.parentId))}
                      isSelected={selectedIds.has(task.id)}
                    />
                  ));
              })()}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const TimelineRow = memo(function TimelineRow({ task, cellWidth, isExiting, isCollapsing, isNew, isSelected }) {
  const isParent = task.type === 'parent';
  const visualLeft = toVisualLeft(task.start, cellWidth);
  const visualWidth = toVisualWidth(task.width, cellWidth);

  const animClass = isExiting ? 'tix-anim-exit' : isCollapsing ? 'tix-collapsing' : isNew ? 'tix-anim-enter' : '';

  const rowCls = [
    'timeline-row',
    !isParent ? 'grid-child-row' : '',
    task.collapsed ? 'collapsed' : '',
    animClass,
  ].filter(Boolean).join(' ');

  const barCls = [
    'timeline-bar',
    `timeline-bar-${task.status}`,
    isSelected ? 'selected' : '',
    isExiting ? 'tix-anim-exit' : isNew ? 'tix-anim-enter' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={rowCls} data-group={task.id} data-type={task.type} data-parent={task.parentId || undefined}>
      <div className={barCls} style={{ left: visualLeft, width: visualWidth }}>
        <div className="timeline-bar-resizer resizer-left" />
        <span className="timeline-bar-label">{task.title}</span>
        <div className="timeline-bar-resizer resizer-right" />
      </div>
    </div>
  );
});
