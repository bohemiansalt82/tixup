import { useState, useRef, useEffect } from 'react';
import { STATUS_LABELS } from '../../constants';

const STATUSES = Object.entries(STATUS_LABELS);

export function SelectionBar({ selectedIds, onDelete, onChangeStatus }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const dropdownRef = useRef(null);
  const count = selectedIds.size;

  useEffect(() => {
    if (!statusOpen) return;
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setStatusOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusOpen]);

  // 선택 해제되면 드롭다운도 닫기
  useEffect(() => {
    if (count === 0) setStatusOpen(false);
  }, [count]);

  return (
    <div className={`floating-selection-bar${count > 0 ? ' active' : ''}`}>
      <div className="selection-info">
        <span className="count">{count} Selected</span>
        <span style={{ color: 'rgba(255,255,255,0.6)' }}>items</span>
      </div>

      <div className="floating-selection-bar__divider" />

      <button className="action-btn">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit_note</span>
        Edit
      </button>

      <div className="floating-selection-bar__divider" />

      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <button className="action-btn" onClick={() => setStatusOpen(v => !v)}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>swap_horiz</span>
          Change Status
          <span className="material-symbols-outlined" style={{ fontSize: 16, opacity: 0.6 }}>
            {statusOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {statusOpen && (
          <div className="status-dropdown">
            {STATUSES.map(([key, label]) => (
              <button
                key={key}
                className="status-dropdown__item"
                onClick={() => {
                  onChangeStatus(key);
                  setStatusOpen(false);
                }}
              >
                <div className={`marker marker-has-icon marker-${key}`}>{label}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="floating-selection-bar__divider" />

      <button className="action-btn delete" onClick={onDelete}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
        Delete
      </button>
    </div>
  );
}
