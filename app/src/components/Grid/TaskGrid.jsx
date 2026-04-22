import { useState, useRef, useCallback, Fragment, useEffect } from 'react';
import { TaskRow } from './TaskRow';

const FILTERS = ['All', 'Done', 'Overdue'];

export function TaskGrid({ tasks, exitingIds, newIds, selectedIds, onSelect, onToggle, onAddChild, onRename, onStatusChange, onCreateTix, onMoveTask }) {
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const createInputRef = useRef(null);

  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [ghostInfo, setGhostInfo] = useState(null);   // { top, left, width, height, task }
  const [indicatorTop, setIndicatorTop] = useState(null);

  const dragIdRef = useRef(null);
  const dropTargetRef = useRef(null);
  const dragTypeRef = useRef(null);
  const dragOffsetY = useRef(0);
  const containerRef = useRef(null);

  const collapsedParentIds = new Set(tasks.filter(t => t.collapsed).map(t => t.id));

  const visible = tasks.filter(t => {
    if (filter === 'done') return t.status === 'done';
    if (filter === 'overdue') return t.status === 'overdue';
    return true;
  });

  const handleCreateFocus = () => {
    setCreating(true);
    setTimeout(() => createInputRef.current?.focus(), 10);
  };

  const handleCreateFinish = (e) => {
    const name = e.target.value.trim();
    if (name) onCreateTix(name);
    setCreating(false);
    e.target.value = '';
  };

  const endDrag = useCallback(() => {
    const did = dragIdRef.current;
    const dt = dropTargetRef.current;
    if (did && dt && did !== dt.id) {
      onMoveTask(did, dt.id, dt.position);
    }
    dragIdRef.current = null;
    dropTargetRef.current = null;
    dragTypeRef.current = null;
    setDragId(null);
    setDropTarget(null);
    setGhostInfo(null);
    setIndicatorTop(null);
  }, [onMoveTask]);

  const handleRowMouseDown = useCallback((e, task) => {
    e.preventDefault();
    e.stopPropagation();

    const rowEl = e.currentTarget;
    const rect = rowEl.getBoundingClientRect();
    dragOffsetY.current = e.clientY - rect.top;

    dragIdRef.current = task.id;
    dragTypeRef.current = task.type;
    setDragId(task.id);
    setGhostInfo({
      top: e.clientY - dragOffsetY.current,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      task,
    });
  }, []);

  useEffect(() => {
    if (!dragId) return;

    const onMouseMove = (e) => {
      const container = containerRef.current;
      if (!container) return;

      // ghost 위치 업데이트
      setGhostInfo(prev => prev ? { ...prev, top: e.clientY - dragOffsetY.current } : null);

      // 드롭 타겟 계산
      const rows = container.querySelectorAll('[data-row-id]');
      let found = null;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const taskId = row.getAttribute('data-row-id');
          const taskType = row.getAttribute('data-type');
          if (taskId === dragIdRef.current) break;
          const isTopHalf = e.clientY < rect.top + rect.height / 2;

          if (dragTypeRef.current === 'parent') {
            if (taskType !== 'parent') break;
            found = { id: taskId, position: isTopHalf ? 'before' : 'after' };
          } else {
            found = taskType === 'parent'
              ? { id: taskId, position: 'into' }
              : { id: taskId, position: isTopHalf ? 'before' : 'after' };
          }

          // indicator 위치 계산 (absolute, container 기준)
          if (found && found.position !== 'into') {
            const containerRect = container.getBoundingClientRect();
            const top = found.position === 'before'
              ? rect.top - containerRect.top + container.scrollTop
              : rect.bottom - containerRect.top + container.scrollTop;
            setIndicatorTop(top);
          } else {
            setIndicatorTop(null);
          }
          break;
        }
      }
      dropTargetRef.current = found;
      setDropTarget(found ? { ...found } : null);
    };

    const onMouseUp = () => endDrag();

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragId, endDrag]);

  return (
    <div className="timeline-sidebar" id="sidebar-container" ref={containerRef} style={{ position: 'relative' }}>
      <div className="data-grid-row data-grid-header">
        <div className="data-grid-cell center">
          <label className="checkbox-container">
            <input type="checkbox" />
            <div className="checkbox-box" />
          </label>
        </div>
        <div className="data-grid-cell" style={{ padding: 10 }}>
          <div className="grid-filter-tabs">
            {FILTERS.map(f => (
              <button
                key={f}
                className={`grid-filter-tab${filter === f.toLowerCase() ? ' active' : ''}`}
                onClick={() => setFilter(f.toLowerCase())}
              >{f}</button>
            ))}
          </div>
        </div>
        <div className="data-grid-cell" />
      </div>

      <div id="grid-tbody">
        {visible.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            isExiting={exitingIds.has(task.id)}
            isNew={newIds?.has(task.id)}
            isSelected={selectedIds.has(task.id)}
            isDragging={task.id === dragId || task.parentId === dragId}
            isCollapsed={task.type === 'child' && collapsedParentIds.has(task.parentId)}
            isDropInto={dropTarget?.id === task.id && dropTarget.position === 'into'}
            onSelect={onSelect}
            onToggle={onToggle}
            onAddChild={onAddChild}
            onRename={onRename}
            onStatusChange={onStatusChange}
            onRowMouseDown={handleRowMouseDown}
          />
        ))}
      </div>

      {/* 절대 위치 drop indicator — 레이아웃에 영향 없음 */}
      {dragId && indicatorTop !== null && (
        <div
          className="drop-indicator"
          style={{ position: 'absolute', top: indicatorTop, left: 0, right: 0, zIndex: 10 }}
        />
      )}

      {/* 마우스 따라다니는 ghost */}
      {ghostInfo && (
        <div
          className="drag-ghost"
          style={{
            position: 'fixed',
            top: ghostInfo.top,
            left: ghostInfo.left,
            width: ghostInfo.width,
            height: ghostInfo.height,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <TaskRow
            task={ghostInfo.task}
            isExiting={false}
            isNew={false}
            isSelected={false}
            isDragging={false}
            isCollapsed={false}
            isDropInto={false}
            onSelect={() => {}}
            onToggle={() => {}}
            onAddChild={() => {}}
            onRename={() => {}}
            onRowMouseDown={() => {}}
          />
        </div>
      )}

      <div className="timeline-footer-row">
        <div className="timeline-footer-cell">
          {creating ? (
            <div className="grid-create-input-form">
              <div className="nav-icon icon-add" />
              <input
                ref={createInputRef}
                type="text"
                className="grid-create-input"
                placeholder="Tix name..."
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateFinish(e);
                  if (e.key === 'Escape') setCreating(false);
                }}
                onBlur={handleCreateFinish}
              />
            </div>
          ) : (
            <button className="grid-create-btn" onClick={handleCreateFocus}>
              <div className="nav-icon icon-add" />
              <span className="data-grid-text">Create Tix</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
