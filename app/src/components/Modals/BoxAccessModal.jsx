import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { avatarFor } from '../../store/useAuth';
import { LEVELS, LEVEL_LABELS, LEVEL_HINTS, DEFAULT_LEVEL, cleanAccess } from '../../utils/access';
import { useModalClose } from './useModalClose';
import './MakeModal.css';
import './InviteModal.css';
import './BoxAccessModal.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/gnb/${name}.svg`;
const LEVEL_ICONS = { edit: 'edit', view: 'visibility', hidden: 'visibility_off' };

/**
 * Box permissions popup (TopBar ⋮ → 권한 설정). Same shell as the Invite modal.
 * Owner: pick a box on the left, then the level every invited member gets (편집 / 보기 / 숨김) and
 * optional per-member overrides. Saved as `space.access` (utils/access.js).
 * Member: read-only list of the boxes they can see and their level on each.
 */
export function BoxAccessModal({ spaceName, boxes = [], members = [], access, isOwner, backendReady, onSave, onClose }) {
  const { closing, requestClose, overlayProps } = useModalClose(onClose);
  const [draft, setDraft] = useState(() => cleanAccess(access));
  const [boxId, setBoxId] = useState(boxes[0]?.id ?? null);
  const box = boxes.find((b) => b.id === boxId) || boxes[0] || null;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);

  const rule = (box && draft[box.id]) || { default: DEFAULT_LEVEL, members: {} };
  const setRule = (next) => setDraft((d) => ({ ...d, [box.id]: next }));
  const setDefault = (level) => setRule({ ...rule, default: level });
  const setMember = (email, level) => {
    const m = { ...(rule.members || {}) };
    if (level) m[email.toLowerCase()] = level; else delete m[email.toLowerCase()];
    setRule({ ...rule, members: m });
  };
  const changed = useMemo(() => JSON.stringify(cleanAccess(draft)) !== JSON.stringify(cleanAccess(access)), [draft, access]);

  const summary = (b) => {
    const r = draft[b.id];
    const overrides = Object.keys(r?.members || {}).length;
    return { level: r?.default || DEFAULT_LEVEL, overrides };
  };

  return createPortal(
    <div className={`inv-overlay${closing ? ' closing' : ''}`} {...overlayProps} onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <div className="inv-panel ba-panel" role="dialog" aria-modal="true" aria-labelledby="ba-title">
        <header className="mk-header">
          <img src={icon('deployed_code_32')} alt="" width={32} height={32} />
          <h2 id="ba-title" className="mk-title">{isOwner ? 'Box 권한 설정' : '내 Box 권한'}</h2>
        </header>
        <div className="mk-top-actions">
          <button type="button" className="mk-icon-btn mk-close" title="Close" onClick={() => requestClose()}>
            <img src={icon('close_32')} alt="" width={32} height={32} />
          </button>
        </div>

        <p className="ba-sub">
          {isOwner
            ? <><b>{spaceName}</b>에 초대된 멤버가 볼 수 있는 Box와 권한을 정해요. 박스 밖 Tix는 모두 편집할 수 있어요.</>
            : <><b>{spaceName}</b>의 소유자가 정한 권한이에요. 변경은 소유자만 할 수 있어요.</>}
        </p>

        {boxes.length === 0 ? (
          <div className="ba-empty">{isOwner ? '아직 Box가 없어요. 왼쪽 Box의 + 로 먼저 만들어 주세요.' : '볼 수 있는 Box가 없어요.'}</div>
        ) : !isOwner ? (
          <ul className="ba-mine">
            {boxes.map((b) => (
              <li key={b.id}>
                <img src={icon('deployed_code')} alt="" width={20} height={20} />
                <span className="ba-box-name">{b.name}</span>
                <LevelChip level={b.level || DEFAULT_LEVEL} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="ba-body">
            <ul className="ba-boxes" role="listbox" aria-label="Boxes">
              {boxes.map((b) => {
                const s = summary(b);
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={b.id === box?.id}
                      className={`ba-box${b.id === box?.id ? ' active' : ''}`}
                      onClick={() => setBoxId(b.id)}
                    >
                      <img src={icon('deployed_code')} alt="" width={20} height={20} />
                      <span className="ba-box-name">{b.name}</span>
                      <LevelChip level={s.level} small />
                      {s.overrides > 0 && <span className="ba-box-more" title="멤버별 설정">+{s.overrides}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            <section className="ba-detail">
              <div className="ba-row ba-row-all">
                <div className="ba-who">
                  <span className="ba-all-icon material-symbols-outlined" aria-hidden="true">group</span>
                  <div>
                    <div className="ba-name">초대된 모든 멤버</div>
                    <div className="ba-hint">{LEVEL_HINTS[rule.default]}</div>
                  </div>
                </div>
                <Segment value={rule.default} options={LEVELS} onChange={setDefault} />
              </div>

              <div className="ba-label">멤버별 설정</div>
              {members.length === 0 ? (
                <div className="ba-empty ba-empty-sm">아직 초대된 멤버가 없어요. 초대하면 여기서 사람마다 다르게 정할 수 있어요.</div>
              ) : (
                <ul className="ba-members">
                  {members.map((m) => {
                    const own = rule.members?.[m.email.toLowerCase()] || null;
                    return (
                      <li key={m.email} className="ba-row">
                        <div className="ba-who">
                          <img className="ba-avatar" src={m.picture || avatarFor(m.name || m.email)} alt="" referrerPolicy="no-referrer" />
                          <div className="ba-who-text">
                            <div className="ba-name">{m.name || m.email.split('@')[0]}</div>
                            <div className="ba-hint">{m.email}</div>
                          </div>
                        </div>
                        <Segment
                          value={own || ''}
                          options={['', ...LEVELS]}
                          labels={{ '': `기본 · ${LEVEL_LABELS[rule.default]}` }}
                          onChange={(level) => setMember(m.email, level || null)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        )}

        <footer className="ba-footer">
          <p className="ba-note">
            {isOwner && !backendReady && '서버(app/mail/Code.gs v4)를 새 버전으로 배포해야 다른 멤버에게 적용돼요.'}
          </p>
          <div className="inv-actions">
            {isOwner ? (
              <>
                <button type="button" className="mk-btn mk-btn-outline" onClick={() => requestClose()}>Cancel</button>
                <button type="button" className="mk-btn mk-btn-primary" disabled={!changed} onClick={() => requestClose(() => onSave(cleanAccess(draft)))}>Save</button>
              </>
            ) : (
              <button type="button" className="mk-btn mk-btn-primary" onClick={() => requestClose()}>OK</button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function LevelChip({ level, small = false }) {
  return (
    <span className={`ba-chip ba-chip-${level}${small ? ' small' : ''}`}>
      <span className="material-symbols-outlined" aria-hidden="true">{LEVEL_ICONS[level]}</span>
      {LEVEL_LABELS[level]}
    </span>
  );
}

function Segment({ value, options, labels = {}, onChange }) {
  return (
    <div className="ba-seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o || 'default'}
          type="button"
          role="radio"
          aria-checked={value === o}
          className={`ba-seg-btn${value === o ? ' active' : ''}${o ? ` ba-seg-${o}` : ' ba-seg-default'}`}
          title={o ? LEVEL_HINTS[o] : '모든 멤버 설정을 따라요'}
          onClick={() => onChange(o)}
        >
          {o && <span className="material-symbols-outlined" aria-hidden="true">{LEVEL_ICONS[o]}</span>}
          {labels[o] ?? LEVEL_LABELS[o]}
        </button>
      ))}
    </div>
  );
}
