import { useRef, useState, useEffect } from 'react';
import { StatusBadge } from '../Shared/StatusBadge';

export function TaskRow({ task, isExiting, isNew, isSelected, isDragging, isCollapsed, isDropInto, onSelect, onToggle, onAddChild, onRename, onStatusChange, onRowMouseDown }) {
  const isParent = task.type === 'parent';
  const hasNoTitle = !task.title;

  const cls = [
    'data-grid-row',
    isParent ? 'level-0' : 'grid-child-row',
    task.collapsed ? 'collapsed' : '',
    isExiting ? 'tix-anim-exit' : isNew ? 'tix-anim-enter' : '',
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
        if (e.target.closest('button, input, label, .marker')) return;
        onRowMouseDown(e, task);
      }}
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
          <EditableTitle task={task} onRename={onRename} autoEdit={hasNoTitle} />
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
    </div>
  );
}

function EditableTitle({ task, onRename, autoEdit }) {
  const [editing, setEditing] = useState(autoEdit);
  const [value, setValue] = useState(task.title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const finish = (cancel = false) => {
    const name = value.trim();
    if (!cancel && name) {
      onRename(task.id, name);
    } else {
      if (autoEdit) onRename(task.id, null);
      else setValue(task.title);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="grid-create-input"
        value={value}
        placeholder={autoEdit ? 'sub tix' : ''}
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
}
