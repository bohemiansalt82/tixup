import { useState, useRef, useEffect } from 'react';
import { STATUS_LABELS } from '../../constants';
import { avatarFor } from '../../store/useAuth';

const STATUSES = Object.entries(STATUS_LABELS);

export function SelectionBar({ selectedIds, members = [], currentUser, onDelete, onChangeStatus, onAssign }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const dropdownRef = useRef(null);
  const assignRef = useRef(null);
  const count = selectedIds.size;

  useEffect(() => {
    if (!statusOpen && !assignOpen) return;
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target)) setStatusOpen(false);
      if (!assignRef.current?.contains(e.target)) setAssignOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusOpen, assignOpen]);

  // 선택 해제되면 드롭다운도 닫기 (render 중 상태 조정 — effect 안 setState 대신)
  const [prevCount, setPrevCount] = useState(count);
  if (count !== prevCount) {
    setPrevCount(count);
    if (count === 0) { setStatusOpen(false); setAssignOpen(false); }
  }

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
        <button className="action-btn" onClick={() => { setStatusOpen(v => !v); setAssignOpen(false); }}>
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

      {onAssign && (
        <>
          <div className="floating-selection-bar__divider" />

          <div style={{ position: 'relative' }} ref={assignRef}>
            <button className="action-btn" onClick={() => { setAssignOpen(v => !v); setStatusOpen(false); }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span>
              Assign
              <span className="material-symbols-outlined" style={{ fontSize: 16, opacity: 0.6 }}>
                {assignOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {assignOpen && (
              <div className="status-dropdown assign-dropdown">
                {members.map(m => (
                  <button
                    key={m.email}
                    className="status-dropdown__item assign-dropdown__item"
                    onClick={() => {
                      onAssign({ name: m.name, email: m.email });
                      setAssignOpen(false);
                    }}
                  >
                    <img className="assign-dropdown__avatar" src={m.picture || avatarFor(m.name)} alt="" referrerPolicy="no-referrer" />
                    <span className="assign-dropdown__name">{m.name}</span>
                    {m.email === currentUser?.email && <span className="marker lv-mine">Mine</span>}
                  </button>
                ))}
                <button
                  className="status-dropdown__item assign-dropdown__item assign-dropdown__clear"
                  onClick={() => {
                    onAssign(null);
                    setAssignOpen(false);
                  }}
                >
                  Unassigned
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="floating-selection-bar__divider" />

      <button className="action-btn delete" onClick={onDelete}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
        Delete
      </button>
    </div>
  );
}
