import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { StatusBadge } from '../Shared/StatusBadge';

export function TaskRow({ task, isExiting, isCollapsing, isNew, isSelected, isDragging, isCollapsed, isDropInto, onSelect, onToggle, onAddChild, onRename, onStatusChange, onRowMouseDown }) {
  const isParent = task.type === 'parent';
  const hasNoTitle = !task.title;

  const [contextMenu, setContextMenu] = useState(null);
  const editRef = useRef(null);
  const menuRef = useRef(null);

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

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e) => {
      if (!menuRef.current?.contains(e.target)) setContextMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  return (
    <div
      className={cls}
      data-row-id={task.id}
      data-group={task.id}
      data-type={task.type}
      data-status={task.status}
      data-parent={task.parentId || undefined}
      onMouseDown={e => {
        if (e.button !== 0) return;
        if (e.target.closest('button, input, label, .marker')) return;
        onRowMouseDown(e, task);
      }}
      onContextMenu={handleContextMenu}
      style={{ cursor: 'grab' }}
    >
      <div className="data-grid-cell center">
        <label className="checkbox-container">
          <input type="checkbox" checked={isSelected} onChange={() => onSelect(task.id)} />
          <div className="checkbox-box" />
        </label>
      </div>
      <div className="data-grid-cell">
        <div className={`row-title-container ${!isParent ? 'depth-2' : ''}`}>
          {isParent && (
            <button
              className={`tree-expander ${task.collapsed ? 'collapsed' : 'expanded'}`}
              onClick={() => onToggle(task.id)}
            >
              <div className="nav-icon icon-chevron-lg-bottom" />
            </button>
          )}
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

      {contextMenu && createPortal(
        <div
          ref={menuRef}
          className="ctx-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 99999 }}
        >
          <button
            className="ctx-menu__item"
            onClick={() => { setContextMenu(null); editRef.current?.startEdit(); }}
          >
            이름 변경
          </button>
          <button
            className="ctx-menu__item ctx-menu__item--danger"
            onClick={() => { setContextMenu(null); onRename(task.id, null); }}
          >
            삭제하기
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

const EditableTitle = forwardRef(function EditableTitle({ task, onRename, autoEdit, isParent }, ref) {
  const [editing, setEditing] = useState(autoEdit);
  const [value, setValue] = useState(task.title);
  const inputRef = useRef(null);

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
    <span className="data-grid-text" onDoubleClick={() => setEditing(true)}>
      {task.title}
    </span>
  );
});
