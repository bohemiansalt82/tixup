import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUS_LABELS } from '../../constants';
import { avatarFor } from '../../store/useAuth';
import { getBarEndDate } from '../../utils/timeline';
import { ContextMenu } from '../Shared/ContextMenu';
import { useContextMenu } from '../../hooks/useContextMenu';
import './KanbanView.css';

// Workflow order (left → right), Jira-style: open work first, closed work last.
const COLUMNS = ['pending', 'inprogress', 'pause', 'overdue', 'done', 'drop'];
const CLOSED = new Set(['done', 'drop']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const shortDate = (iso) => { const [, m, d] = iso.split('-'); return `${MONTHS[Number(m) - 1]} ${Number(d)}`; };

/**
 * Kanban board (Jira board style) built from the app's own pieces: Marker V3 status badges as
 * column heads, tix / stat row icons, `lv-tag-*` tags, the list view's avatars, the timeline bar
 * end as due date. One column per status; drag cards between columns to change status (a
 * selected card drags the whole selection), click a card to open the Tix detail, right-click to
 * rename / delete, "+ Create Tix" at a column's foot adds a Tix with that status.
 * Toolbar: search, assignee avatar filter, sub-tix toggle.
 */
export function KanbanView({ tasks, newIds, exitingIds, selectedIds, members = [], currentUser, onSelect, onMove, onCreate, onRename, onOpen }) {
  const [query, setQuery] = useState('');
  const [who, setWho] = useState(() => new Set()); // assignee e-mails ('' = unassigned)
  const [showSub, setShowSub] = useState(true);
  const [dragIds, setDragIds] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [creatingIn, setCreatingIn] = useState(null);

  const byId = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const subStats = useMemo(() => {
    const m = new Map();
    tasks.forEach(t => {
      if (t.type !== 'child') return;
      const s = m.get(t.parentId) || { total: 0, done: 0 };
      s.total += 1;
      if (t.status === 'done') s.done += 1;
      m.set(t.parentId, s);
    });
    return m;
  }, [tasks]);

  const q = query.trim().toLowerCase();
  const visible = tasks.filter(t => {
    if (!showSub && t.type === 'child') return false;
    if (q && !(t.title || '').toLowerCase().includes(q)) return false;
    if (who.size && !who.has(t.assignee?.email || '')) return false;
    return true;
  });
  const columns = COLUMNS.map(status => ({
    status,
    cards: visible.filter(t => (t.status === 'onhold' ? 'pause' : t.status) === status),
  }));
  // Anything with an unknown status lands in the first column rather than disappearing.
  visible.filter(t => !COLUMNS.includes(t.status) && t.status !== 'onhold').forEach(t => columns[0].cards.push(t));

  const filtered = !!q || who.size > 0 || !showSub;
  const toggleWho = (email) => setWho(prev => {
    const s = new Set(prev);
    if (s.has(email)) s.delete(email); else s.add(email);
    return s;
  });

  const onDragStart = (e, task) => {
    const ids = selectedIds.has(task.id) ? [...selectedIds] : [task.id];
    setDragIds(ids);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
  };
  const onDragEnd = () => { setDragIds(null); setOverCol(null); };
  const onDrop = (e, status) => {
    e.preventDefault();
    const ids = (dragIds || []).filter(id => byId.get(id) && byId.get(id).status !== status);
    if (ids.length) onMove(ids, status);
    onDragEnd();
  };

  return (
    <div className="kb-section">
      <div className="kb-board">
        <div className="kb-toolbar">
          <label className="kb-search">
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search board" />
          </label>

          <div className="kb-people" role="group" aria-label="Filter by assignee">
            {members.map(m => (
              <button
                key={m.email}
                type="button"
                className={`kb-person${who.has(m.email) ? ' active' : ''}`}
                title={m.name}
                aria-pressed={who.has(m.email)}
                onClick={() => toggleWho(m.email)}
              >
                <img src={m.picture || avatarFor(m.name)} alt={m.name} referrerPolicy="no-referrer" />
              </button>
            ))}
            <button
              type="button"
              className={`kb-person kb-person-none${who.has('') ? ' active' : ''}`}
              title="Unassigned"
              aria-pressed={who.has('')}
              onClick={() => toggleWho('')}
            >
              <span className="material-symbols-outlined" aria-hidden="true">person</span>
            </button>
          </div>

          <button type="button" className={`kb-chip-btn${showSub ? ' active' : ''}`} aria-pressed={showSub} onClick={() => setShowSub(v => !v)}>
            <span className="nav-icon icon-stat" aria-hidden="true" />
            Sub-tix
          </button>

          {filtered && (
            <button type="button" className="kb-clear" onClick={() => { setQuery(''); setWho(new Set()); setShowSub(true); }}>
              Clear filters
            </button>
          )}
        </div>

        <div className="kb-columns">
          {columns.map(({ status, cards }) => (
            <section
              key={status}
              className={`kb-col kb-col-${status}${overCol === status && dragIds ? ' drop-target' : ''}`}
              onDragOver={e => { if (!dragIds) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overCol !== status) setOverCol(status); }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOverCol(c => (c === status ? null : c)); }}
              onDrop={e => onDrop(e, status)}
            >
              <header className="kb-col-head">
                <div className={`marker marker-has-icon marker-${status}`}>{STATUS_LABELS[status]}</div>
                <span className="kb-col-count">{cards.length}</span>
              </header>

              <div className="kb-col-body">
                {cards.map(task => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    parent={task.type === 'child' ? byId.get(task.parentId) : null}
                    sub={subStats.get(task.id)}
                    selected={selectedIds.has(task.id)}
                    dragging={!!dragIds?.includes(task.id)}
                    anim={exitingIds.has(task.id) ? 'tix-anim-exit' : newIds.has(task.id) ? 'tix-anim-enter' : ''}
                    currentUser={currentUser}
                    onSelect={onSelect}
                    onOpen={onOpen}
                    onRename={onRename}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                ))}
                {creatingIn === status && (
                  <CreateCard
                    onSubmit={(title) => onCreate(title, status)}
                    onClose={() => setCreatingIn(null)}
                  />
                )}
                {cards.length === 0 && creatingIn !== status && <div className="kb-empty">No Tix</div>}
              </div>

              {creatingIn !== status && (
                <button type="button" className="kb-col-create" onClick={() => setCreatingIn(status)}>
                  <div className="nav-icon icon-add" />
                  <span>Create Tix</span>
                </button>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ task, parent, sub, selected, dragging, anim, currentUser, onSelect, onOpen, onRename, onDragStart, onDragEnd }) {
  const [editing, setEditing] = useState(false);
  const ctx = useContextMenu();
  const isParent = task.type === 'parent';
  const due = getBarEndDate(task.start, task.width);
  const late = !!due && due < todayIso() && !CLOSED.has(task.status);
  const a = task.assignee;
  const isMine = a && currentUser && a.email === currentUser.email;
  const aName = a ? (a.name || (isMine && currentUser.name) || (a.email || '').split('@')[0]) : '';
  const aPic = isMine && currentUser.picture ? currentUser.picture : avatarFor(aName || '?');
  const tags = task.tags || [];
  const comments = task.comments?.length || 0;
  const ctxItems = [
    { label: '이름 변경', onClick: () => setEditing(true) },
    { label: '삭제하기', danger: true, onClick: () => { if (confirm(`"${task.title || 'New Tix'}"을(를) 삭제할까요?${isParent && sub ? ' 서브틱스도 함께 삭제됩니다.' : ''}`)) onRename(task.id, null); } },
  ];

  const cls = ['kb-card', selected ? 'selected' : '', dragging ? 'dragging' : '', anim].filter(Boolean).join(' ');
  return (
    <article
      className={cls}
      data-row-id={task.id}
      draggable={!editing}
      onDragStart={e => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={() => { if (!editing) onOpen(task.id); }}
      onContextMenu={ctx.open}
    >
      <ContextMenu state={ctx} items={ctxItems} />

      <label className="checkbox-container kb-card-check" onClick={e => e.stopPropagation()} title="Select">
        <input type="checkbox" checked={selected} onChange={() => onSelect(task.id)} />
        <div className="checkbox-box" />
      </label>

      {parent && (
        <div className="kb-card-parent" title={parent.title}>
          <span className="nav-icon icon-tix" aria-hidden="true" />
          <span>{parent.title || 'New Tix'}</span>
        </div>
      )}

      {editing ? (
        <TitleInput
          initial={task.title}
          onDone={(title) => { setEditing(false); if (title !== null && title !== task.title) onRename(task.id, title); }}
        />
      ) : (
        <div className={`kb-card-title${task.title ? '' : ' empty'}`}>{task.title || 'New Tix'}</div>
      )}

      {tags.length > 0 && (
        <div className="kb-card-tags">
          {tags.map(t => <span key={t} className={`marker lv-tag lv-tag-${t.toLowerCase()}`}>{t}</span>)}
        </div>
      )}

      <div className="kb-card-foot">
        <span className={`nav-icon ${isParent ? 'icon-tix' : 'icon-stat'} kb-card-type`} title={isParent ? 'Tix' : 'Sub-tix'} />
        {sub && (
          <span className={`kb-meta${sub.done === sub.total ? ' complete' : ''}`} title={`${sub.done} of ${sub.total} sub-tix done`}>
            <span className="nav-icon icon-stat" aria-hidden="true" />
            {sub.done}/{sub.total}
          </span>
        )}
        {due && (
          <span className={`kb-meta kb-due${late ? ' late' : ''}`} title={late ? `Overdue · ${due}` : `Due ${due}`}>
            <span className="nav-icon icon-calendar" aria-hidden="true" />
            {shortDate(due)}
          </span>
        )}
        {comments > 0 && (
          <span className="kb-meta" title={`${comments} comment${comments > 1 ? 's' : ''}`}>
            <span className="material-symbols-outlined" aria-hidden="true">chat_bubble</span>
            {comments}
          </span>
        )}
        <span className="kb-card-spacer" />
        {a ? (
          <img className="kb-avatar" src={aPic} alt={aName} title={aName} referrerPolicy="no-referrer" />
        ) : (
          <span className="kb-avatar kb-avatar-none" title="Unassigned">
            <span className="material-symbols-outlined" aria-hidden="true">person</span>
          </span>
        )}
      </div>
    </article>
  );
}

/** Inline title editor: Enter saves, Escape cancels (null), blur saves. */
function TitleInput({ initial = '', onDone, placeholder }) {
  const ref = useRef(null);
  const done = useRef(false);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const finish = (value) => {
    if (done.current) return;
    done.current = true;
    onDone(value);
  };
  return (
    <textarea
      ref={ref}
      className="kb-title-input"
      rows={2}
      defaultValue={initial}
      placeholder={placeholder}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); finish(e.currentTarget.value.trim()); }
        if (e.key === 'Escape') { e.preventDefault(); finish(null); }
      }}
      onBlur={e => finish(e.currentTarget.value.trim())}
    />
  );
}

/** Column-foot composer (Jira "What needs to be done?"): Enter creates and keeps it open for the next one. */
function CreateCard({ onSubmit, onClose }) {
  const [key, setKey] = useState(0);
  return (
    <div className="kb-card kb-card-create">
      <TitleInput
        key={key}
        placeholder="What needs to be done?"
        onDone={(title) => {
          if (title) { onSubmit(title); setKey(k => k + 1); } else onClose();
        }}
      />
    </div>
  );
}
