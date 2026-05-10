import { useState, useRef, useCallback, useEffect } from 'react';
import { TaskRow } from './TaskRow';

const FILTERS = ['All', 'Done', 'Overdue'];

export function TaskGrid({ tasks, exitingIds, newIds, collapsingParentIds, expandingParentIds, selectedIds, onSelect, onSelectAll, onToggle, onAddChild, onRename, onStatusChange, onCreateTix, onMoveTask }) {
  const [filter, setFilter] = useState('all');

  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [ghostInfo, setGhostInfo] = useState(null);
  const [indicatorTop, setIndicatorTop] = useState(null);

  const dragIdRef = useRef(null);
  const dropTargetRef = useRef(null);
  const dragTypeRef = useRef(null);
  const dragOffsetY = useRef(0);
  const containerRef = useRef(null);

  const collapsedParentIds = new Set(tasks.filter(t => t.collapsed).map(t => t.id));

  const visible = tasks.filter(t => {
    if (t.type === 'child') {
      const fullyCollapsed = collapsedParentIds.has(t.parentId) && !collapsingParentIds?.has(t.parentId);
      if (fullyCollapsed) return false;
    }
    if (filter === 'done') return t.status === 'done';
    if (filter === 'overdue') return t.status === 'overdue';
    return true;
  });

  // 부모+자식 그룹으로 묶기
  const groups = [];
  const parentMap = new Map();
  for (const task of visible) {
    if (task.type === 'parent') {
      const group = { parent: task, children: [] };
      groups.push(group);
      parentMap.set(task.id, group);
    } else {
      parentMap.get(task.parentId)?.children.push(task);
    }
  }

  const allSelected = visible.length > 0 && visible.every(t => selectedIds.has(t.id));
  const handleSelectAll = () => {
    onSelectAll(allSelected ? [] : visible.map(t => t.id));
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

      setGhostInfo(prev => prev ? { ...prev, top: e.clientY - dragOffsetY.current } : null);

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
            <input type="checkbox" checked={allSelected} onChange={handleSelectAll} />
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
        {groups.map(({ parent, children }) => (
          <TaskGroup
            key={parent.id}
            parent={parent}
            children={children}
            isCollapsing={collapsingParentIds?.has(parent.id)}
            isExpanding={expandingParentIds?.has(parent.id)}
            exitingIds={exitingIds}
            newIds={newIds}
            selectedIds={selectedIds}
            dragId={dragId}
            dropTarget={dropTarget}
            onSelect={onSelect}
            onToggle={onToggle}
            onAddChild={onAddChild}
            onRename={onRename}
            onStatusChange={onStatusChange}
            onRowMouseDown={handleRowMouseDown}
          />
        ))}
      </div>

      {dragId && indicatorTop !== null && (
        <div
          className="drop-indicator"
          style={{ position: 'absolute', top: indicatorTop, left: 0, right: 0, zIndex: 10 }}
        />
      )}

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

      {onCreateTix && (
        <div className="timeline-footer-row">
          <div className="timeline-footer-cell">
            <button className="grid-create-btn" onClick={onCreateTix}>
              <div className="nav-icon icon-add" />
              <span className="data-grid-text">Create Tix</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ANIM = 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

function animateTo(el, targetHeight) {
  const full = el.scrollHeight;
  el.style.height = `${full}px`;
  el.style.overflow = 'hidden';
  el.style.transition = ANIM;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.height = `${targetHeight}px`;
  }));
}

function TaskGroup({ parent, children, isCollapsing, isExpanding, exitingIds, newIds, selectedIds, dragId, dropTarget, onSelect, onToggle, onAddChild, onRename, onStatusChange, onRowMouseDown }) {
  const groupRef = useRef(null);
  const isExiting = exitingIds.has(parent.id);

  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;

    if (isExiting) {
      animateTo(el, 0);
    } else if (isCollapsing) {
      const parentHeight = el.firstElementChild?.offsetHeight ?? 48;
      animateTo(el, parentHeight);
    } else {
      el.style.height = '';
      el.style.overflow = '';
      el.style.transition = '';
    }
  }, [isExiting, isCollapsing]);

  const sharedProps = { onSelect, onToggle, onAddChild, onRename, onStatusChange, onRowMouseDown };

  return (
    <div ref={groupRef}>
      <TaskRow
        task={parent}
        isExiting={false}
        isNew={newIds?.has(parent.id)}
        isSelected={selectedIds.has(parent.id)}
        isDragging={parent.id === dragId}
        isCollapsed={false}
        isDropInto={dropTarget?.id === parent.id && dropTarget?.position === 'into'}
        {...sharedProps}
      />
      {children.map(child => (
        <AnimatedChildRow
          key={child.id}
          child={child}
          isExiting={exitingIds.has(child.id)}
          isNew={newIds?.has(child.id) || isExpanding}
          isSelected={selectedIds.has(child.id)}
          isDragging={child.id === dragId || child.parentId === dragId}
          isDropInto={dropTarget?.id === child.id && dropTarget?.position === 'into'}
          {...sharedProps}
        />
      ))}
    </div>
  );
}

function AnimatedChildRow({ child, isExiting, ...props }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !isExiting) return;
    animateTo(el, 0);
  }, [isExiting]);

  return (
    <div ref={wrapRef}>
      <TaskRow
        task={child}
        isExiting={false}
        isCollapsing={false}
        {...props}
      />
    </div>
  );
}
