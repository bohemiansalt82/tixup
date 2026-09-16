import { useEffect, useRef, useState } from 'react';
import { useAuth, logout } from '../../store/useAuth';
import { useSpaces } from '../../store/useSpaces';
import { MakeModal } from '../Modals/MakeModal';
import { ContextMenu, InlineName } from '../Shared/ContextMenu';
import { useContextMenu } from '../../hooks/useContextMenu';
import './Gnb.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/gnb/${name}.svg`;

function GnbIcon({ name, size = 20, className = '' }) {
  return (
    <span className={`gnb-icon ${className}`} style={{ width: size, height: size }}>
      <img src={icon(name)} alt="" width={size} height={size} />
    </span>
  );
}

function CountBadge({ value }) {
  return <span className="gnb-badge">{value}</span>;
}

function SectionHeader({ label, onAdd, addTitle }) {
  return (
    <div className="gnb-section-header">
      <span className="gnb-section-label">{label}</span>
      <button type="button" className="gnb-icon-btn" onClick={onAdd} title={addTitle}>
        <GnbIcon name="add_circle" size={24} />
      </button>
    </div>
  );
}

function useOutsideClose(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);
  return ref;
}

export function Gnb({ tasks = [], view = 'timeline', onViewChange }) {
  const user = useAuth();
  const { spaces, activeSpace, boxes, activeBox, createSpace, switchSpace, renameSpace, deleteSpace, createBox, renameBox, deleteBox, selectBox } = useSpaces();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [modal, setModal] = useState(null); // 'space' | 'box' | null
  const countInBox = (boxId) => tasks.filter((t) => t.boxId === boxId).length;
  // Picking a box / My Task from the dashboard returns to the timeline.
  const leaveDashboard = () => { if (view === 'dashboard') onViewChange?.('timeline'); };
  // Right-click: rename / delete a space or a box. `editing` = { kind: 'space'|'box', id } while renaming inline.
  const ctx = useContextMenu();
  const [ctxTarget, setCtxTarget] = useState(null); // { kind: 'space'|'box', id, name }
  const [editing, setEditing] = useState(null);
  const openCtx = (kind, item) => (e) => { setCtxTarget({ kind, id: item.id, name: item.name }); ctx.open(e); };
  const removeSpace = (space) => {
    if (spaces.length <= 1) { alert('마지막 스페이스는 삭제할 수 없어요.'); return; }
    if (confirm(`"${space.name}" 스페이스를 삭제할까요? 박스 목록도 함께 삭제됩니다.`)) deleteSpace(space.id);
  };
  const removeBox = (box) => {
    const n = countInBox(box.id);
    if (confirm(`"${box.name}" 박스를 삭제할까요?${n ? ` 안의 Tix ${n}개는 My Task에 남습니다.` : ''}`)) deleteBox(box.id);
  };
  const ctxItems = ctxTarget ? [
    { label: '이름 변경', onClick: () => setEditing({ kind: ctxTarget.kind, id: ctxTarget.id }) },
    { label: '삭제하기', danger: true, onClick: () => (ctxTarget.kind === 'space' ? removeSpace(ctxTarget) : removeBox(ctxTarget)) },
  ] : [];
  const isEditing = (kind, id) => editing?.kind === kind && editing?.id === id;
  const commitName = (kind, id) => (name) => { if (kind === 'space') renameSpace(id, name); else renameBox(id, name); setEditing(null); };

  const userMenuRef = useOutsideClose(userMenuOpen, () => setUserMenuOpen(false));

  const handleCreateSpace = () => setModal('space');
  const handleCreateBox = () => setModal('box');
  const handleModalSave = (data) => {
    if (modal === 'space') createSpace(data);
    else if (modal === 'box') createBox(data);
    setModal(null);
  };
  const handleDeleteSpace = () => { if (activeSpace) removeSpace(activeSpace); };

  return (
    <nav className="gnb">
      <header className="gnb-header">
        <img className="gnb-logo" src={icon('logo')} alt="Tixup" width={92} height={24} />
        <div className="gnb-header-actions">
          <button type="button" className="gnb-icon-btn" title="Collapse sidebar">
            <GnbIcon name="sidebar_close" size={24} />
          </button>
          <button type="button" className="gnb-icon-btn" title="Search">
            <GnbIcon name="search_short" size={24} />
          </button>
        </div>
      </header>

      {/* Home: Dashboard / My Task (Figma GNB_V5 37551:4091, section 37548:4420) */}
      <section className="gnb-section gnb-section-home">
        <div className="gnb-section-header">
          <span className="gnb-section-label">Home</span>
        </div>
        <div className="gnb-row">
          <button
            type="button"
            className={`gnb-item${view === 'dashboard' ? ' active' : ''}`}
            onClick={() => onViewChange?.('dashboard')}
            aria-current={view === 'dashboard' ? 'page' : undefined}
          >
            <GnbIcon name="analytics" />
            <span className="gnb-item-label">Dashboard</span>
          </button>
        </div>
        <div className="gnb-row">
          <button
            type="button"
            className={`gnb-item gnb-item-tasks${view !== 'dashboard' && !activeBox ? ' active' : ''}`}
            onClick={() => { leaveDashboard(); selectBox(null); }}
          >
            <GnbIcon name="work" />
            <span className="gnb-item-label">My Task</span>
            <CountBadge value={tasks.length} />
          </button>
        </div>
      </section>

      {/* Space: every space listed, the active one filled (section 39580:10388) */}
      <section className="gnb-section gnb-section-space">
        <SectionHeader label="Space" onAdd={handleCreateSpace} addTitle="New Space" />
        {spaces.map((s) => {
          const active = s.id === activeSpace?.id;
          return (
            <div className="gnb-row" key={s.id}>
              <button
                type="button"
                className={`gnb-item gnb-item-space${active ? ' active' : ''}`}
                onClick={() => { if (!isEditing('space', s.id)) switchSpace(s.id); }}
                onContextMenu={openCtx('space', s)}
                aria-current={active ? 'true' : undefined}
              >
                <GnbIcon name={active ? 'planet' : 'planet_muted'} />
                <InlineName
                  value={s.name}
                  editing={isEditing('space', s.id)}
                  onCommit={commitName('space', s.id)}
                  onCancel={() => setEditing(null)}
                  className="gnb-item-label"
                  inputClassName="gnb-item-label gnb-inline-input"
                />
              </button>
            </div>
          );
        })}
      </section>

      <section className="gnb-section gnb-section-box">
        <SectionHeader label="Box" onAdd={handleCreateBox} addTitle="New Box" />
        {boxes.map((b) => (
          <div className="gnb-row" key={b.id}>
            <button
              type="button"
              className={`gnb-item${activeBox?.id === b.id ? ' active' : ''}`}
              onClick={() => { if (!isEditing('box', b.id)) { leaveDashboard(); selectBox(b.id); } }}
              onContextMenu={openCtx('box', b)}
            >
              <GnbIcon name="deployed_code" />
              <InlineName
                value={b.name}
                editing={isEditing('box', b.id)}
                onCommit={commitName('box', b.id)}
                onCancel={() => setEditing(null)}
                className="gnb-item-label"
                inputClassName="gnb-item-label gnb-inline-input"
              />
              {countInBox(b.id) > 0 && <CountBadge value={countInBox(b.id)} />}
            </button>
          </div>
        ))}
      </section>

      <footer className="gnb-footer">
        <div className="gnb-footer-item" ref={userMenuRef}>
          <button type="button" className="gnb-icon-btn" title={user?.name ?? 'Account'} onClick={() => setUserMenuOpen((o) => !o)}>
            <GnbIcon name="emoji_people" size={24} />
          </button>
          {userMenuOpen && user && (
            <div className="gnb-user-menu">
              <img className="gnb-user-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
              <div className="gnb-user-info">
                <div className="gnb-user-name">{user.name}</div>
                <div className="gnb-user-email">{user.email}</div>
              </div>
              <button type="button" className="gnb-user-logout" onClick={() => { if (confirm('Sign out?')) logout(); }}>
                Sign out
              </button>
            </div>
          )}
        </div>
        <button type="button" className="gnb-icon-btn" title="Settings">
          <GnbIcon name="settings" size={24} />
        </button>
        <button type="button" className="gnb-icon-btn" title="Delete current space" onClick={handleDeleteSpace}>
          <GnbIcon name="delete" size={24} />
        </button>
      </footer>

      {modal && <MakeModal kind={modal} onClose={() => setModal(null)} onSave={handleModalSave} />}
      <ContextMenu state={ctx} items={ctxItems} />
    </nav>
  );
}
