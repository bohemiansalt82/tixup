import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { StatusBadge } from '../Shared/StatusBadge';
import { ContextMenu } from '../Shared/ContextMenu';
import { useContextMenu } from '../../hooks/useContextMenu';

export function TaskRow({ task, isExiting, isCollapsing, isNew, isSelected, isDragging, isCollapsed, isDropInto, hasChildren = false, onSelect, onToggle, onAddChild, onRename, onStatusChange, onRowMouseDown, onOpen }) {
  const isParent = task.type === 'parent';
  const hasNoTitle = !task.title;

  const menu = useContextMenu(); // shared menu: stays inside the viewport, closes on scroll / Escape
  const editRef = useRef(null);
  // Where the mouse went down: a click that travelled further than this was a drag, not a click.
  const downPos = useRef(null);
  const CLICK_SLOP = 4;

  const animClass = isExiting ? 'tix-anim-exit' : isCollapsing ? 'tix-collapsing' : isNew ? 'tix-anim-enter' : '';

  const cls = [
    'data-grid-row',
    isParent ? 'level-0' : 'grid-child-row',
    task.collapsed ? 'collapsed' : '',
    animClass,
    isDragging ? 'row-dragging' : '',
    isCollapsed ? 'collapsed' : '',
    isDropInto ? 'row-drop-into' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      data-row-id={task.id}
      data-group={task.id}
      data-type={task.type}
      data-status={task.status}
      data-parent={task.parentId || undefined}
      onMouseDown={e => {
        if (e.button !== 0 || e.ctrlKey) return; // right-click / ctrl-click opens the menu, never a drag
        downPos.current = { x: e.clientX, y: e.clientY };
        if (e.target.closest('button, input, label, .marker')) return;
        onRowMouseDown(e, task);
      }}
      onClick={e => {
        // Plain click anywhere on the row opens the Tix detail popup; controls and drags are excluded.
        if (!onOpen) return;
        if (e.target.closest('button, input, label, .marker, .tree-expander, .add-child-btn')) return;
        const d = downPos.current;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > CLICK_SLOP) return;
        onOpen(task.id);
      }}
      onContextMenu={menu.open}
      style={{ cursor: 'default' }} /* grabbing only while a drag is running (body.dragging-active) */
    >
      <div className="data-grid-cell center">
        <label className="checkbox-container">
          <input type="checkbox" checked={isSelected} onChange={() => onSelect(task.id)} />
          <div className="checkbox-box" />
        </label>
      </div>
      <div className="data-grid-cell">
        <div className={`row-title-container ${!isParent ? 'depth-2' : ''}`}>
          {isParent && hasChildren && (
            <button
              className={`tree-expander ${task.collapsed ? 'collapsed' : 'expanded'}`}
              onClick={() => onToggle(task.id)}
            >
              <div className="nav-icon icon-chevron-lg-bottom" />
            </button>
          )}
          {isParent && !hasChildren && <span className="tree-expander tree-expander-placeholder" aria-hidden="true" />}
          <div className={`nav-icon ${isParent ? 'icon-tix' : 'icon-stat'}`} />
          <EditableTitle ref={editRef} task={task} onRename={onRename} autoEdit={hasNoTitle} isParent={isParent} />
          {isParent && (
            <button className="add-child-btn" onClick={() => onAddChild(task.id)}>
              <div className="nav-icon icon-add" />
            </button>
          )}
        </div>
      </div>
      <div className="data-grid-cell">
        <StatusBadge status={task.status} onChange={status => onStatusChange(task.id, status)} />
      </div>

      <ContextMenu
        state={menu}
        items={[
          { label: '이름 변경', onClick: () => editRef.current?.startEdit() },
          { label: '삭제하기', danger: true, onClick: () => onRename(task.id, null) },
        ]}
      />
    </div>
  );
}

const OPEN_DELAY = 220; // ms: give a double-click (rename) a chance before a single click opens the popup

export const EditableTitle = forwardRef(function EditableTitle({ task, onRename, autoEdit, isParent, onOpen }, ref) {
  const [editing, setEditing] = useState(autoEdit);
  const [value, setValue] = useState(task.title);
  const inputRef = useRef(null);
  const openTimer = useRef(null);
  useEffect(() => () => clearTimeout(openTimer.current), []);

  useImperativeHandle(ref, () => ({
    startEdit: () => { setValue(task.title); setEditing(true); },
  }));

  useEffect(() => {
    if (editing) inputRef.current?.focus({ preventScroll: true });
  }, [editing]);

  const finish = (cancel = false) => {
    const name = value.trim();
    if (!cancel && name) {
      onRename(task.id, name);
    } else if (autoEdit) {
      const defaultName = isParent ? 'New Tix' : 'New Sub Tix';
      onRename(task.id, defaultName);
      setValue(defaultName);
    } else {
      setValue(task.title);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="grid-create-input"
        value={value}
        placeholder={autoEdit ? (isParent ? 'Tix name...' : 'Sub tix name...') : ''}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') finish(true); }}
        onBlur={() => finish()}
        style={{ minWidth: 100 }}
      />
    );
  }

  return (
    <span
      className={`data-grid-text${onOpen ? ' data-grid-text-link' : ''}`}
      onClick={onOpen ? (e) => { e.stopPropagation(); clearTimeout(openTimer.current); openTimer.current = setTimeout(() => onOpen(task.id), OPEN_DELAY); } : undefined}
      onDoubleClick={() => { clearTimeout(openTimer.current); setEditing(true); }}
    >
      {task.title}
    </span>
  );
});
