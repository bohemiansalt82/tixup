import { useEffect, useRef, useState } from 'react';
import { useAuth, logout } from '../../store/useAuth';
import { useSpaces } from '../../store/useSpaces';
import { MakeModal } from '../Modals/MakeModal';
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

export function Gnb({ tasks = [] }) {
  const user = useAuth();
  const { spaces, activeSpace, boxes, activeBox, createSpace, switchSpace, deleteSpace, createBox, selectBox } = useSpaces();
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [modal, setModal] = useState(null); // 'space' | 'box' | null
  const countInBox = (boxId) => tasks.filter((t) => t.boxId === boxId).length;

  const spaceMenuRef = useOutsideClose(spaceMenuOpen, () => setSpaceMenuOpen(false));
  const userMenuRef = useOutsideClose(userMenuOpen, () => setUserMenuOpen(false));

  const handleCreateSpace = () => setModal('space');
  const handleCreateBox = () => setModal('box');
  const handleModalSave = (data) => {
    if (modal === 'space') createSpace(data);
    else if (modal === 'box') createBox(data);
    setModal(null);
  };
  const handleDeleteSpace = () => {
    if (!activeSpace) return;
    if (spaces.length <= 1) { alert('마지막 스페이스는 삭제할 수 없어요.'); return; }
    if (confirm(`"${activeSpace.name}" 스페이스를 삭제할까요? 박스 목록도 함께 삭제됩니다.`)) deleteSpace(activeSpace.id);
  };

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

      <section className="gnb-section gnb-section-space">
        <SectionHeader label="Space" onAdd={handleCreateSpace} addTitle="New Space" />

        <div className="gnb-row" ref={spaceMenuRef}>
          <button
            type="button"
            className="gnb-item gnb-item-space"
            onClick={() => setSpaceMenuOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={spaceMenuOpen}
          >
            <GnbIcon name="planet" />
            <span className="gnb-item-label">{activeSpace?.name ?? 'My Space'}</span>
            <GnbIcon name="swap" className="gnb-item-trailing" />
          </button>

          {spaceMenuOpen && (
            <ul className="gnb-dropdown" role="listbox">
              {spaces.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={s.id === activeSpace?.id}
                    className={`gnb-dropdown-item${s.id === activeSpace?.id ? ' selected' : ''}`}
                    onClick={() => { switchSpace(s.id); setSpaceMenuOpen(false); }}
                  >
                    <GnbIcon name="planet" />
                    <span>{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="gnb-row">
          <button
            type="button"
            className="gnb-item gnb-item-tasks"
            onClick={() => selectBox(null)}
          >
            <GnbIcon name="work_filled" />
            <span className="gnb-item-label">My Tasks</span>
            <CountBadge value={tasks.length} />
          </button>
        </div>
      </section>

      <section className="gnb-section gnb-section-box">
        <SectionHeader label="Box" onAdd={handleCreateBox} addTitle="New Box" />
        {boxes.map((b) => (
          <div className="gnb-row" key={b.id}>
            <button
              type="button"
              className={`gnb-item${activeBox?.id === b.id ? ' active' : ''}`}
              onClick={() => selectBox(b.id)}
            >
              <GnbIcon name="deployed_code" />
              <span className="gnb-item-label">{b.name}</span>
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
    </nav>
  );
}
