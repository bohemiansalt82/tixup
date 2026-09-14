import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StatusBadge } from '../Shared/StatusBadge';
import { useModalClose } from '../Modals/useModalClose';
import { avatarFor } from '../../store/useAuth';
import { getBarEndDate, uid } from '../../utils/timeline';
import './TixDetailModal.css';

const icon = (dir, name) => `${import.meta.env.BASE_URL}images/${dir}/${name}.svg`;
const TABS = ['Activity', 'Files', 'Timeline'];
const SUB_PREVIEW = 2;

function timeAgo(iso) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString();
}

function assigneeName(a, currentUser) {
  if (!a) return '';
  if (a.name) return a.name;
  if (a.email === currentUser?.email && currentUser?.name) return currentUser.name;
  return (a.email || '').split('@')[0];
}

/** Highlights @mentions the way Figma does (blue). */
function CommentText({ text }) {
  const parts = text.split(/(@\S+)/g);
  return (
    <p className="td-comment-text">
      {parts.map((p, i) => (p.startsWith('@') ? <span key={i} className="td-mention">{p}</span> : <span key={i}>{p}</span>))}
    </p>
  );
}

/**
 * Tix detail popup — Figma Tixup-V2.0 Tixup_Detail_Asigneed 37581:7211 / Tixup_Detail_Unassigned 37575:5948.
 * Docked to the right like a drawer. Shows status (editable), tags, assignee (Assign to me / Accept),
 * due date (end of the timeline bar), the parent's sub-tix grid, and an Activity tab with comments
 * stored on the task (`task.comments`). Files / Timeline tabs are placeholders.
 */
export function TixDetailModal({ taskId, tasks, currentUser, onClose, onUpdateTask, onOpenTask }) {
  const { closing, requestClose, overlayProps } = useModalClose(onClose);
  const task = tasks.find((t) => t.id === taskId);
  const parent = task?.type === 'child' ? tasks.find((t) => t.id === task.parentId) : null;
  const children = useMemo(() => (task ? tasks.filter((t) => t.parentId === task.id) : []), [tasks, task]);
  const [tab, setTab] = useState('Activity');
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);

  if (!task) return null;

  const assignee = task.assignee;
  const isMine = assignee && currentUser && assignee.email === currentUser.email;
  const comments = task.comments ?? [];
  const me = currentUser ? { name: currentUser.name, email: currentUser.email, picture: currentUser.picture || null } : { name: 'Guest', email: '', picture: null };

  const assignToMe = () => onUpdateTask(task.id, { assignee: { name: me.name, email: me.email } });
  const setComments = (next) => onUpdateTask(task.id, { comments: next });

  const submitComment = () => {
    const text = draft.trim();
    if (!text) return;
    setComments([...comments, { id: uid(), author: me, text, createdAt: new Date().toISOString() }]);
    setDraft('');
  };
  const startEdit = (c) => { setEditingId(c.id); setEditText(c.text); };
  const saveEdit = () => {
    const text = editText.trim();
    if (text) setComments(comments.map((c) => (c.id === editingId ? { ...c, text, editedAt: new Date().toISOString() } : c)));
    setEditingId(null);
  };
  const removeComment = (id) => setComments(comments.filter((c) => c.id !== id));
  const reply = (c) => { setDraft((d) => (d ? d : `@${c.author.name} `)); inputRef.current?.focus(); };

  const visibleChildren = showAll ? children : children.slice(0, SUB_PREVIEW);

  return createPortal(
    <div className={`td-overlay${closing ? ' closing' : ''}`} {...overlayProps} onMouseDown={(e) => { if (e.target === e.currentTarget) requestClose(); }}>
      <div className="td-panel" role="dialog" aria-modal="true" aria-labelledby="td-title">
        <header className="td-header">
          <span className="td-kicker">Tix</span>
          <div className="td-crumbs">
            {parent && (
              <>
                <button type="button" className="td-crumb td-crumb-parent" onClick={() => onOpenTask?.(parent.id)} title="Open parent Tix">{parent.title || 'New Tix'}</button>
                <img src={icon('icons', 'chevron_lg_right')} alt="" width={16} height={16} />
              </>
            )}
            <span id="td-title" className="td-crumb td-crumb-current">{task.title || (task.type === 'child' ? 'New Sub Tix' : 'New Tix')}</span>
          </div>
        </header>

        <div className="td-top-actions">
          <button type="button" className="td-icon-btn" title="More (coming soon)">
            <img src={icon('header', 'more_vert_32')} alt="" />
          </button>
          <button type="button" className="td-icon-btn td-close" title="Close" onClick={() => requestClose()}>
            <img src={icon('detail', 'close')} alt="" />
          </button>
        </div>

        <section className="td-card">
          <div className="td-info">
            <div className="td-field">
              <span className="td-field-label">Status</span>
              <div className="td-field-value">
                <StatusBadge status={task.status} onChange={(status) => onUpdateTask(task.id, { status })} />
              </div>
            </div>
            <div className="td-field">
              <span className="td-field-label">Tag</span>
              <div className="td-field-value td-tags">
                {(task.tags || []).length
                  ? task.tags.map((t) => <span key={t} className={`marker lv-tag lv-tag-${t.toLowerCase()}`}>{t}</span>)
                  : <span className="td-tags-empty">No tag</span>}
              </div>
            </div>
            <div className="td-field td-field-assignee">
              <span className="td-field-label">Asignee</span>
              <div className={`td-assignee${assignee ? ' assigned' : ''}`}>
                {assignee ? (
                  <img className="td-avatar" src={isMine && currentUser.picture ? currentUser.picture : avatarFor(assigneeName(assignee, currentUser))} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className="td-avatar-empty"><img src={icon('detail', 'person')} alt="" /></span>
                )}
                <span>{assignee ? assigneeName(assignee, currentUser) : 'Unassigned'}</span>
              </div>
              {assignee ? (
                !isMine && (
                  <button type="button" className="td-assign-btn accept" onClick={assignToMe} title="Take over this Tix">
                    <img src={icon('detail', 'medical_check')} alt="" />
                    Accept
                  </button>
                )
              ) : (
                <button type="button" className="td-assign-btn assign" onClick={assignToMe}>
                  <img src={icon('detail', 'medical_services')} alt="" />
                  Assign to me
                </button>
              )}
            </div>
            <div className="td-field">
              <span className="td-field-label">Due date</span>
              <div className="td-field-value">
                <span className="td-due">{getBarEndDate(task.start, task.width) || <span className="td-empty">No date</span>}</span>
              </div>
            </div>
          </div>

          {task.type === 'parent' && children.length > 0 && (
            <>
              <div className="td-sub-title">Sub Tixs</div>
              <div className="td-grid" role="table" aria-label="Sub Tixs">
                {visibleChildren.map((c) => (
                  <div key={c.id} style={{ display: 'contents' }} role="row">
                    <div className="td-grid-cell td-grid-title" role="cell" onClick={() => onOpenTask?.(c.id)}>
                      <img src={icon('icons', 'stat')} alt="" />
                      <span>{c.title || 'New Sub Tix'}</span>
                    </div>
                    <div className="td-grid-cell" role="cell">
                      <StatusBadge status={c.status} onChange={(status) => onUpdateTask(c.id, { status })} />
                    </div>
                    <div className="td-grid-cell td-grid-assignee" role="cell">
                      {c.assignee ? (
                        <>
                          <img className="td-avatar" src={avatarFor(assigneeName(c.assignee, currentUser))} alt="" referrerPolicy="no-referrer" />
                          <span>{assigneeName(c.assignee, currentUser)}</span>
                        </>
                      ) : <span className="td-empty">Unassigned</span>}
                    </div>
                    <div className="td-grid-cell td-grid-due" role="cell">
                      <img src={icon('icons', 'calendar')} alt="" />
                      <span>{getBarEndDate(c.start, c.width) || <span className="td-empty">No date</span>}</span>
                    </div>
                  </div>
                ))}
              </div>
              {children.length > SUB_PREVIEW && (
                <button type="button" className="td-view-more" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'View Less' : 'View More'}
                </button>
              )}
            </>
          )}
        </section>

        <div className="td-section">
          <div className="td-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={`td-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>

          <div className="td-activity" style={{ marginTop: 16 }}>
            {tab === 'Activity' ? (
              <>
                <div className="td-comments">
                  {comments.length === 0 && <div className="td-no-comments">No activity yet. Leave the first comment below.</div>}
                  {comments.map((c) => (
                    <article key={c.id} className="td-comment">
                      <div className="td-comment-head">
                        <img className="td-comment-avatar" src={c.author?.picture || avatarFor(c.author?.name)} alt="" referrerPolicy="no-referrer" />
                        <div className="td-comment-meta">
                          <span className="td-comment-author">{c.author?.name || 'Unknown'}</span>
                          <span className="td-comment-time">{timeAgo(c.createdAt)}{c.editedAt ? ' · edited' : ''}</span>
                        </div>
                      </div>
                      {editingId === c.id ? (
                        <textarea
                          className="td-comment-edit"
                          value={editText}
                          autoFocus
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditingId(null); }}
                          onBlur={saveEdit}
                        />
                      ) : (
                        <CommentText text={c.text} />
                      )}
                      <div className="td-comment-actions">
                        <button type="button" className="td-icon-btn" title="Add reaction (coming soon)"><img src={icon('detail', 'add_reaction')} alt="" style={{ width: 20, height: 20 }} /></button>
                        <button type="button" className="td-comment-action" onClick={() => reply(c)}>Reply</button>
                        {c.author?.email === me.email && <button type="button" className="td-comment-action" onClick={() => startEdit(c)}>Edit</button>}
                        {c.author?.email === me.email && <button type="button" className="td-comment-action" onClick={() => removeComment(c.id)}>Delete</button>}
                      </div>
                      <button type="button" className="td-icon-btn td-comment-more" title="More (coming soon)"><img src={icon('header', 'more_vert')} alt="" /></button>
                    </article>
                  ))}
                </div>

                <div className="td-chat">
                  <textarea
                    ref={inputRef}
                    className="td-chat-input"
                    rows={1}
                    placeholder="Enter a topic, product or doc..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitComment(); } }}
                  />
                  <button type="button" className="td-icon-btn td-chat-expand" title="Expand (coming soon)"><img src={icon('detail', 'open_in_full')} alt="" style={{ width: 16, height: 16 }} /></button>
                  <div className="td-chat-bar">
                    <div className="td-chat-tools">
                      <button type="button" className="td-icon-btn" title="Attach (coming soon)"><img src={icon('detail', 'attach')} alt="" style={{ width: 24, height: 24 }} /></button>
                      <button type="button" className="td-icon-btn" title="Emoji (coming soon)"><img src={icon('detail', 'add_reaction')} alt="" style={{ width: 24, height: 24 }} /></button>
                    </div>
                    <button type="button" className="td-chat-save" onClick={submitComment} disabled={!draft.trim()}>Save</button>
                  </div>
                </div>
              </>
            ) : (
              <div className="td-placeholder">{tab} — coming soon</div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
