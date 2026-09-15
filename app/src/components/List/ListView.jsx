import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { StatusBadge } from '../Shared/StatusBadge';
import { EditableTitle } from '../Grid/TaskRow';
import { ContextMenu } from '../Shared/ContextMenu';
import { useContextMenu } from '../../hooks/useContextMenu';
import { STATUS_LABELS, TAGS } from '../../constants';
import { avatarFor } from '../../store/useAuth';
import { getBarEndDate } from '../../utils/timeline';
import './ListView.css';

const FILTERS = ['All', 'Done', 'Overdue'];
const STATUS_ORDER = Object.keys(STATUS_LABELS);
const sortIcon = `${import.meta.env.BASE_URL}images/list/unfold_more_20.svg`;

/**
 * List (data grid) view — Figma Tixup-V2.0 "ListView Default" 39523:13757.
 * Columns: select | title (status tabs in the header) | Status | Assignee | Due Date | Tags.
 * Parent rows sit on gray-50, sub-tix on white; sort by clicking a header's unfold icon.
 */
export function ListView({ tasks, exitingIds, newIds, selectedIds, members, currentUser, onSelect, onSelectAll, onToggle, onAddChild, onRename, onStatusChange, onUpdateTask, onCreateTix, onOpen }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ key: null, dir: 'asc' });

  // Status filter: a parent stays visible when it or any of its sub-tix matches, so the
  // hierarchy is preserved. Collapsed parents hide their sub-tix.
  const matches = (t) => filter === 'all' || t.status === filter;
  const childCount = new Map();
  tasks.forEach(t => { if (t.type === 'child') childCount.set(t.parentId, (childCount.get(t.parentId) || 0) + 1); });
  const parentShown = new Set(tasks.filter(t => t.type === 'parent' && (matches(t) || tasks.some(c => c.parentId === t.id && matches(c)))).map(t => t.id));
  const visible = tasks.filter(t => {
    if (t.type === 'parent') return parentShown.has(t.id);
    const parent = tasks.find(p => p.id === t.parentId);
    if (!parent || !parentShown.has(parent.id)) return false;
    if (parent.collapsed) return false;
    return matches(t);
  });

  const groups = useMemo(() => {
    const out = [];
    const byParent = new Map();
    for (const task of visible) {
      if (task.type === 'parent') {
        const g = { parent: task, children: [], childCount: childCount.get(task.id) || 0 };
        out.push(g);
        byParent.set(task.id, g);
      } else {
        byParent.get(task.parentId)?.children.push(task);
      }
    }
    if (!sort.key) return out;
    const cmp = comparator(sort, currentUser);
    out.sort((a, b) => cmp(a.parent, b.parent));
    out.forEach(g => g.children.sort(cmp));
    return out;
  }, [visible, sort, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const allSelected = visible.length > 0 && visible.every(t => selectedIds.has(t.id));
  const cycleSort = (key) => setSort(s => (s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : { key: null, dir: 'asc' }));

  return (
    <div className="lv-table" id="full-data-grid-table">
      <div className="data-grid-row lv-header">
        <div className="data-grid-cell center">
          <label className="checkbox-container">
            <input type="checkbox" checked={allSelected} onChange={() => onSelectAll(allSelected ? [] : visible.map(t => t.id))} />
            <div className="checkbox-box" />
          </label>
        </div>
        <div className="data-grid-cell lv-header-tabs">
          <div className="grid-filter-tabs">
            {FILTERS.map(f => (
              <button key={f} type="button" className={`grid-filter-tab${filter === f.toLowerCase() ? ' active' : ''}`} onClick={() => setFilter(f.toLowerCase())}>{f}</button>
            ))}
          </div>
        </div>
        {[['status', 'Status'], ['assignee', 'Assignee'], ['dueDate', 'Due Date'], ['tags', 'Tags']].map(([key, label]) => (
          <div key={key} className={`data-grid-cell lv-header-cell${sort.key === key ? ` sorted ${sort.dir}` : ''}`}>
            <span>{label}</span>
            <button type="button" className="lv-sort-btn" title={`Sort by ${label}`} onClick={() => cycleSort(key)}>
              <img src={sortIcon} alt="" width={20} height={20} />
            </button>
          </div>
        ))}
      </div>

      <div className="lv-body" id="full-grid-tbody">
        {groups.map(({ parent, children, childCount: n }) => (
          <div key={parent.id} className="lv-group">
            <ListRow task={parent} hasChildren={n > 0} {...{ exitingIds, newIds, selectedIds, members, currentUser, onSelect, onToggle, onAddChild, onRename, onStatusChange, onUpdateTask, onOpen }} />
            {children.map(child => (
              <ListRow key={child.id} task={child} {...{ exitingIds, newIds, selectedIds, members, currentUser, onSelect, onToggle, onAddChild, onRename, onStatusChange, onUpdateTask, onOpen }} />
            ))}
          </div>
        ))}
        {groups.length === 0 && <div className="lv-empty">No Tix yet. Create one below.</div>}
      </div>

      <div className="lv-footer">
        <button type="button" className="grid-create-btn" onClick={onCreateTix}>
          <div className="nav-icon icon-add" />
          <span className="data-grid-text">Create Tix</span>
        </button>
      </div>
    </div>
  );
}

function comparator({ key, dir }, currentUser) {
  const sign = dir === 'desc' ? -1 : 1;
  const val = (t) => {
    if (key === 'status') return STATUS_ORDER.indexOf(t.status);
    if (key === 'assignee') return assigneeLabel(t.assignee, currentUser).toLowerCase();
    if (key === 'dueDate') return getBarEndDate(t.start, t.width) || '9999-99-99';
    if (key === 'tags') return (t.tags?.[0] || '').toLowerCase();
    return 0;
  };
  return (a, b) => {
    const x = val(a), y = val(b);
    return (x < y ? -1 : x > y ? 1 : 0) * sign;
  };
}

function assigneeLabel(assignee, currentUser) {
  if (!assignee) return '';
  if (assignee.name) return assignee.name;
  if (assignee.email === currentUser?.email && currentUser?.name) return currentUser.name;
  return (assignee.email || '').split('@')[0];
}

function ListRow({ task, hasChildren = false, exitingIds, newIds, selectedIds, members, currentUser, onSelect, onToggle, onAddChild, onRename, onStatusChange, onUpdateTask, onOpen }) {
  const isParent = task.type === 'parent';
  const anim = exitingIds.has(task.id) ? 'tix-anim-exit' : newIds.has(task.id) ? 'tix-anim-enter' : '';
  const cls = ['data-grid-row', 'lv-row', isParent ? 'lv-parent' : 'lv-child', selectedIds.has(task.id) ? 'selected' : '', anim].filter(Boolean).join(' ');
  // Right-click: rename (inline, via EditableTitle) / delete.
  const ctx = useContextMenu();
  const editRef = useRef(null);
  const ctxItems = [
    { label: '이름 변경', onClick: () => editRef.current?.startEdit() },
    { label: '삭제하기', danger: true, onClick: () => { if (confirm(`"${task.title || 'New Tix'}"을(를) 삭제할까요?${isParent && hasChildren ? ' 서브틱스도 함께 삭제됩니다.' : ''}`)) onRename(task.id, null); } },
  ];

  // Plain click anywhere on the row opens the Tix detail popup; cell controls are excluded.
  const handleRowClick = (e) => {
    if (!onOpen) return;
    if (e.target.closest('button, input, label, .marker, .tree-expander, .add-child-btn, .lv-assignee, .lv-tags')) return;
    onOpen(task.id);
  };

  return (
    <div className={cls} data-row-id={task.id} data-type={task.type} data-status={task.status} onClick={handleRowClick} onContextMenu={ctx.open} style={{ cursor: onOpen ? 'pointer' : undefined }}>
      <ContextMenu state={ctx} items={ctxItems} />
      <div className="data-grid-cell center">
        <label className="checkbox-container">
          <input type="checkbox" checked={selectedIds.has(task.id)} onChange={() => onSelect(task.id)} />
          <div className="checkbox-box" />
        </label>
      </div>

      <div className="data-grid-cell lv-cell-title">
        <div className={`row-title-container${isParent ? '' : ' depth-2'}`}>
          {isParent && hasChildren && (
            <button type="button" className={`tree-expander ${task.collapsed ? 'collapsed' : 'expanded'}`} onClick={() => onToggle(task.id)}>
              <div className="nav-icon icon-chevron-lg-bottom" />
            </button>
          )}
          {isParent && !hasChildren && <span className="tree-expander tree-expander-placeholder" aria-hidden="true" />}
          <div className={`nav-icon ${isParent ? 'icon-tix' : 'icon-stat'}`} />
          <EditableTitle ref={editRef} task={task} onRename={onRename} autoEdit={!task.title} isParent={isParent} />
          {isParent && (
            <button type="button" className="add-child-btn" title="Add sub tix" onClick={() => onAddChild(task.id)}>
              <div className="nav-icon icon-add" />
            </button>
          )}
        </div>
      </div>

      <div className="data-grid-cell">
        <StatusBadge status={task.status} onChange={status => onStatusChange(task.id, status)} />
      </div>

      <div className="data-grid-cell lv-cell-assignee">
        <AssigneeCell task={task} members={members} currentUser={currentUser} onChange={assignee => onUpdateTask(task.id, { assignee })} />
      </div>

      <div className="data-grid-cell lv-cell-due">
        <DueDateCell value={getBarEndDate(task.start, task.width)} />
      </div>

      <div className="data-grid-cell lv-cell-tags">
        <TagsCell tags={task.tags || []} onChange={tags => onUpdateTask(task.id, { tags })} />
      </div>
    </div>
  );
}

/** Small fixed-position popover anchored under a trigger; closes on outside click / Escape. */
function CellMenu({ anchorRef, onClose, children, className = '' }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
    const onDown = (e) => { if (!ref.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [anchorRef, onClose]);
  if (!pos) return null;
  return createPortal(
    <div ref={ref} className={`status-dropdown status-dropdown--row lv-menu ${className}`} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 99999 }}>
      {children}
    </div>,
    document.body,
  );
}

function AssigneeCell({ task, members, currentUser, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const a = task.assignee;
  const isMine = a && currentUser && a.email === currentUser.email;
  const name = assigneeLabel(a, currentUser);
  const picture = isMine && currentUser.picture ? currentUser.picture : avatarFor(name || '?');

  return (
    <>
      <button type="button" ref={ref} className={`lv-assignee${a ? '' : ' empty'}`} onClick={() => setOpen(v => !v)} title="Assign">
        {a ? (
          <>
            <img className="lv-avatar" src={picture} alt="" referrerPolicy="no-referrer" />
            <span className="data-grid-text-sm">{name}</span>
            {isMine && <span className="marker lv-mine">Mine</span>}
          </>
        ) : (
          <span className="lv-placeholder">Unassigned</span>
        )}
      </button>
      {open && (
        <CellMenu anchorRef={ref} onClose={() => setOpen(false)}>
          {members.map(m => (
            <button key={m.email} type="button" className={`status-dropdown__item lv-menu-item${a?.email === m.email ? ' active' : ''}`} onClick={() => { onChange({ name: m.name, email: m.email }); setOpen(false); }}>
              <img className="lv-avatar" src={m.picture || avatarFor(m.name)} alt="" referrerPolicy="no-referrer" />
              <span>{m.name}</span>
              {m.email === currentUser?.email && <span className="marker lv-mine">Mine</span>}
            </button>
          ))}
          <button type="button" className="status-dropdown__item lv-menu-item lv-menu-clear" onClick={() => { onChange(null); setOpen(false); }}>Unassigned</button>
        </CellMenu>
      )}
    </>
  );
}

/** Due date is the last day of the Tix bar on the timeline (read-only here; drag the bar to change it). */
function DueDateCell({ value }) {
  return (
    <div className={`lv-due${value ? '' : ' empty'}`} title={value ? 'End date of the timeline bar' : 'Place the Tix on the timeline'}>
      <div className="nav-icon icon-calendar" />
      <span className="data-grid-text-sm">{value || <span className="lv-placeholder">No date</span>}</span>
    </div>
  );
}

function TagsCell({ tags, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const toggle = (tag) => onChange(tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]);
  return (
    <>
      <button type="button" ref={ref} className={`lv-tags${tags.length ? '' : ' empty'}`} onClick={() => setOpen(v => !v)} title="Tags">
        {tags.length ? tags.map(t => <span key={t} className={`marker lv-tag lv-tag-${t.toLowerCase()}`}>{t}</span>) : <span className="lv-placeholder">Add tag</span>}
      </button>
      {open && (
        <CellMenu anchorRef={ref} onClose={() => setOpen(false)} className="lv-menu-tags">
          {TAGS.map(t => (
            <button key={t} type="button" className={`status-dropdown__item lv-menu-item${tags.includes(t) ? ' active' : ''}`} onClick={() => toggle(t)}>
              <span className={`marker lv-tag lv-tag-${t.toLowerCase()}`}>{t}</span>
              {tags.includes(t) && <span className="lv-check">✓</span>}
            </button>
          ))}
        </CellMenu>
      )}
    </>
  );
}
