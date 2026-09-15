import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Right-click menu shared by spaces, boxes and Tix (timeline / list rows, calendar blocks).
 *
 *   const menu = useContextMenu();   // hooks/useContextMenu.js
 *   <div onContextMenu={menu.open}>…</div>
 *   <ContextMenu state={menu} items={[{ label: '이름 변경', onClick }, { label: '삭제하기', danger: true, onClick }]} />
 *
 * Renders into document.body with the existing `.ctx-menu` styles (components.css); closes on
 * outside mouse-down, Escape, scroll, or after an item is chosen.
 */
export function ContextMenu({ state, items }) {
  const ref = useRef(null);
  const { pos, close } = state;

  useEffect(() => {
    if (!pos) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
    };
  }, [pos, close]);

  if (!pos) return null;
  // Keep the menu inside the viewport.
  const left = Math.min(pos.x, window.innerWidth - 160);
  const top = Math.min(pos.y, window.innerHeight - 8 - items.length * 38);

  return createPortal(
    <div ref={ref} className="ctx-menu" role="menu" style={{ position: 'fixed', top, left, zIndex: 100001 }}>
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={`ctx-menu__item${item.danger ? ' ctx-menu__item--danger' : ''}`}
          disabled={item.disabled}
          onClick={() => { close(); item.onClick?.(); }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/**
 * Inline rename field: renders `value` as text until `editing`, then an input that commits on
 * Enter / blur and cancels on Escape. Used for space and box names in the GNB.
 */
export function InlineName({ value, editing, onCommit, onCancel, className = '', inputClassName = '' }) {
  if (!editing) return <span className={className}>{value}</span>;
  return <NameInput value={value} onCommit={onCommit} onCancel={onCancel} inputClassName={inputClassName} />;
}

function NameInput({ value, onCommit, onCancel, inputClassName }) {
  const [draft, setDraft] = useState(value); // mounts fresh each time editing starts
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.select(); }, []);
  const finish = (cancel) => {
    const name = draft.trim();
    if (cancel || !name || name === value) onCancel();
    else onCommit(name);
  };
  return (
    <input
      ref={inputRef}
      className={inputClassName}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') finish(false); if (e.key === 'Escape') finish(true); e.stopPropagation(); }}
      onBlur={() => finish(false)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label="Name"
    />
  );
}
