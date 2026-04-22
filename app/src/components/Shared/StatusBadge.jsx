import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { STATUS_LABELS } from '../../constants';

const STATUSES = Object.entries(STATUS_LABELS);

export function StatusBadge({ status, onChange }) {
  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!triggerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen(v => !v);
  };

  const label = STATUS_LABELS[status] || status;

  return (
    <div ref={triggerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <div
        className={`marker marker-has-icon marker-${status}`}
        onClick={handleOpen}
        style={{ cursor: 'pointer' }}
      >
        {label}
      </div>

      {open && createPortal(
        <div
          className="status-dropdown status-dropdown--row"
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, zIndex: 99999 }}
        >
          {STATUSES.map(([key, lbl]) => (
            <button
              key={key}
              className="status-dropdown__item"
              onClick={e => { e.stopPropagation(); onChange(key); setOpen(false); }}
            >
              <div className={`marker marker-has-icon marker-${key}`}>{lbl}</div>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
