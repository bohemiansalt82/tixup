import { useMemo, useState } from 'react';
import { useSpaces } from '../../store/useSpaces';
import { avatarFor } from '../../store/useAuth';
import { useActivityLog } from '../../store/activityLog';
import { useInvite } from '../../hooks/useInvite';
import { STATUS_LABELS } from '../../constants';
import { todayISO as todayIso } from '../../utils/timeline';
import { MakeModal } from '../Modals/MakeModal';
import { InviteModal } from '../Modals/InviteModal';
import {
  overview, keywords, byAssignee, distribution, assigneeName, assigneePicture,
  buildDayLine, buildWeekLine, countInRange, dayISO, shortDate, clock,
} from './dashboardStats';
import './DashboardView.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/dashboard/${name}.svg`;
const headerIcon = (name) => `${import.meta.env.BASE_URL}images/header/${name}.svg`;

/**
 * Dashboard — Figma Tixup-V2.0 "Tixup_Dashboard" 37700:8285.
 *
 * Live: header counts, New Project (creates a box), team invite, Overview (This Week / This Month),
 * Keywords (word frequency over Tix titles), Issue status by Assignee (sortable), Issue status
 * Distribution, and the activity Timeline (Day / Week day line, click a day to filter).
 * Visual only: "Files" count, the "Ai" badge, the ⋮ menu.
 */
export function DashboardView({ tasks, spaceId, members = [], currentUser, onOpenTix }) {
  const { activeSpace, boxes, createBox } = useSpaces();
  const activity = useActivityLog(spaceId);
  const [period, setPeriod] = useState('week');
  const [issueSort, setIssueSort] = useState('desc');
  const [lineMode, setLineMode] = useState('day');
  const [selectedRange, setSelectedRange] = useState(null); // { from, to } ISO
  const [boxModal, setBoxModal] = useState(false);
  const invite = useInvite();

  const stats = useMemo(() => overview(tasks, period), [tasks, period]);
  const words = useMemo(() => keywords(tasks), [tasks]);
  const assignees = useMemo(() => {
    const rows = byAssignee(tasks, members, currentUser);
    return issueSort === 'asc' ? [...rows].reverse() : rows;
  }, [tasks, members, currentUser, issueSort]);
  const dist = useMemo(() => distribution(tasks), [tasks]);
  const line = useMemo(() => (lineMode === 'day' ? buildDayLine() : buildWeekLine()), [lineMode]);
  const feed = useMemo(() => {
    if (!selectedRange) return activity;
    return activity.filter((e) => { const d = dayISO(e.ts); return d >= selectedRange.from && d <= selectedRange.to; });
  }, [activity, selectedRange]);
  const boxName = (id) => boxes.find((b) => b.id === id)?.name ?? activeSpace?.name ?? '';
  const todayISO = todayIso();

  const teamMembers = members.filter((m) => m.email !== currentUser?.email).slice(0, 3);

  return (
    <section className="dv-section" id="dashboard-view">
      <header className="dv-header">
        <h1 className="dv-title">Dashboard</h1>
        <div className="dv-header-right">
          <div className="dv-team">
            <span className="dv-team-label">My Team</span>
            <div className="dv-avatars">
              {currentUser && (
                <span className="dv-avatar" title={`${currentUser.name} (owner)`}>
                  <img src={currentUser.picture || avatarFor(currentUser.name)} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = avatarFor(currentUser.name); }} />
                  <img className="dv-avatar-crown" src={headerIcon('crown')} alt="" width={12} height={12} />
                </span>
              )}
              {teamMembers.map((m) => (
                <span key={m.email} className="dv-avatar dv-avatar-member" title={m.name || m.email}>
                  <img src={m.picture || avatarFor(m.name || m.email)} alt="" referrerPolicy="no-referrer" />
                </span>
              ))}
              <button type="button" className="dv-avatar dv-avatar-add" title="Invite member" onClick={() => invite.setInviteOpen(true)} disabled={!activeSpace}>
                <img src={headerIcon('add')} alt="" width={24} height={24} />
              </button>
            </div>
          </div>
          <div className="dv-count"><b>{boxes.length}</b><span>Projects</span></div>
          <div className="dv-count"><b>{tasks.length}</b><span>Tixs</span></div>
          <div className="dv-count" title="Files are not available yet"><b>0</b><span>Files</span></div>
          <button type="button" className="dv-new-project" onClick={() => setBoxModal(true)}>
            <img src={icon('add_circle')} alt="" width={24} height={24} />
            <span>New Project</span>
          </button>
          <button type="button" className="dv-more" title="More (coming soon)">
            <img src={icon('more_vert')} alt="" width={32} height={32} />
          </button>
        </div>
      </header>

      <div className="dv-body">
        <div className="dv-col dv-col-left">
          {/* Overview */}
          <section className="dv-block">
            <div className="dv-block-head">
              <h2 className="dv-block-title">Overview</h2>
              <Segment value={period} onChange={setPeriod} options={[['week', 'This Week'], ['month', 'This Month']]} />
            </div>
            <div className="dv-grid dv-grid-3">
              <div className="dv-card dv-stat">
                <div className="dv-card-label">Total Issues</div>
                <div className="dv-stat-value">{stats.total}</div>
              </div>
              <div className="dv-card dv-stat">
                <div className="dv-card-label">Completed &amp; Unresolved</div>
                <div className="dv-stat-value dv-stat-pair">
                  <span>{stats.done}</span><span className="dv-stat-sep">/</span><span className="dv-stat-unresolved">{stats.unresolved}</span>
                </div>
              </div>
              <div className="dv-card dv-stat">
                <div className="dv-card-label">Critical issue</div>
                <div className="dv-stat-value dv-stat-critical">
                  <span>{stats.critical}</span>
                  <img src={icon('bug_report')} alt="" width={32} height={32} />
                </div>
              </div>
            </div>
          </section>

          {/* Keywords */}
          <section className="dv-block">
            <div className="dv-block-head dv-block-head-start">
              <h2 className="dv-block-title">Keywords</h2>
              <span className="dv-ai-badge" title="AI keyword analysis (coming soon)">Ai</span>
            </div>
            <div className="dv-grid dv-grid-2">
              <div className="dv-card dv-keywords">
                <div className="dv-card-label">Spike</div>
                <div className="dv-spike-list">
                  {words.spike.length === 0 && <div className="dv-empty">No keywords yet</div>}
                  {words.spike.map((k, i) => (
                    <div className="dv-spike-row" key={k.word}>
                      <div className="dv-spike-track">
                        <div className={`dv-spike-bar dv-spike-${i}`} style={{ width: `${Math.max(20, Math.round((k.count / words.spike[0].count) * 100))}%` }}>{k.word}</div>
                      </div>
                      <span className="dv-spike-count">{k.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="dv-card dv-keywords">
                <div className="dv-card-label">Frequent</div>
                <div className="dv-frequent">
                  {words.frequent.length === 0 && <div className="dv-empty">Words from your Tix titles show up here</div>}
                  {words.frequent.map((k) => <span key={k.word} className={`dv-word dv-word-${k.tier}`} title={`${k.count}`}>{k.word}</span>)}
                </div>
              </div>
            </div>
          </section>

          {/* Issue status by Assignee */}
          <section className="dv-block">
            <div className="dv-block-head"><h2 className="dv-block-title">Issue status by Assignee</h2></div>
            <div className="dv-card dv-table">
              <div className="dv-trow dv-thead">
                <div className="dv-td dv-td-name">Assignee</div>
                <button type="button" className="dv-td dv-td-issues dv-sort" onClick={() => setIssueSort((s) => (s === 'desc' ? 'asc' : 'desc'))} title="Sort by issues">
                  <img src={icon('arrow_down')} alt="" width={20} height={20} className={issueSort === 'asc' ? 'dv-sort-asc' : ''} />
                  <span>Issues</span>
                </button>
                <div className="dv-td dv-td-done">Done</div>
              </div>
              {assignees.length === 0 && <div className="dv-trow"><div className="dv-td dv-td-name dv-empty">No Tix yet</div><div className="dv-td dv-td-issues" /><div className="dv-td dv-td-done" /></div>}
              {assignees.map((r, i) => {
                const max = Math.max(...assignees.map((x) => x.issues), 1);
                return (
                  <div className="dv-trow" key={r.key}>
                    <div className="dv-td dv-td-name">
                      <div className={`dv-person dv-person-${Math.min(i, 3)}`} style={{ width: `${Math.max(24, Math.round((r.issues / max) * 100))}%` }}>
                        {r.assignee ? <img className="dv-person-avatar" src={assigneePicture(r.assignee, members, currentUser)} alt="" referrerPolicy="no-referrer" /> : null}
                        <span>{r.name}</span>
                      </div>
                    </div>
                    <div className="dv-td dv-td-issues">{r.issues}</div>
                    <div className="dv-td dv-td-done">{r.done}</div>
                  </div>
                );
              })}
              <div className="dv-trow dv-tfoot"><div className="dv-td dv-td-name" /><div className="dv-td dv-td-issues" /><div className="dv-td dv-td-done" /></div>
            </div>
          </section>

          {/* Issue status Distribution */}
          <section className="dv-block">
            <div className="dv-block-head"><h2 className="dv-block-title">Issue status Distribution</h2></div>
            <div className="dv-grid dv-grid-4">
              {dist.map((d) => (
                <div className="dv-card dv-dist" key={d.status}>
                  <div className="dv-card-label">{d.label}</div>
                  <div className="dv-dist-row">
                    <Ring pct={d.pct} color={d.color} />
                    <span className="dv-dist-count">{d.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Timeline (activity) */}
        <div className="dv-col dv-col-right">
          <div className="dv-block-head">
            <h2 className="dv-block-title">Timeline</h2>
            <Segment value={lineMode} onChange={(m) => { setLineMode(m); setSelectedRange(null); }} options={[['day', 'Day'], ['week', 'Week']]} />
          </div>
          <div className="dv-timeline">
            <div className="dv-dayline">
              {line.map((it) => {
                if (it.kind === 'label') return <div className="dv-day dv-day-label" key={it.key}>{it.text}</div>;
                const n = countInRange(activity, it.from, it.to);
                const selected = selectedRange ? selectedRange.from === it.from : it.today;
                return (
                  <button
                    type="button"
                    key={it.key}
                    className={`dv-day${selected ? ' dv-day-selected' : ''}${it.weekend ? ' dv-day-weekend' : ''}`}
                    onClick={() => setSelectedRange((cur) => (cur && cur.from === it.from ? null : { from: it.from, to: it.to }))}
                    title={n ? `${n} change${n > 1 ? 's' : ''}` : undefined}
                  >
                    <span className="dv-day-tix">{n > 0 && <span className={`dv-day-dot dv-day-dot-${n >= 4 ? 3 : n >= 2 ? 2 : 1}`} />}</span>
                    <span className="dv-day-letter">{it.letter}</span>
                    <span className="dv-day-num">{it.num}</span>
                  </button>
                );
              })}
            </div>
            <div className="dv-feed">
              {feed.length === 0 && (
                <div className="dv-feed-empty">
                  {selectedRange ? 'No changes in this period.' : 'Changes to your Tix will show up here.'}
                </div>
              )}
              {feed.map((e) => (
                <Entry key={e.id} entry={e} boxName={boxName(e.boxId)} isToday={dayISO(e.ts) === todayISO} members={members} currentUser={currentUser} onOpen={onOpenTix && tasks.some((t) => t.id === e.taskId) ? () => onOpenTix(e.taskId) : null} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {boxModal && <MakeModal kind="box" onClose={() => setBoxModal(false)} onSave={(data) => { createBox(data); setBoxModal(false); }} />}
      {invite.inviteOpen && activeSpace && (
        <InviteModal space={activeSpace} inviter={invite.user} onClose={() => invite.setInviteOpen(false)} onInvite={invite.handleInvite} />
      )}
      {invite.toast && <div className={`topbar-toast ${invite.toast.kind}`} role="status">{invite.toast.text}</div>}
    </section>
  );
}

/** Tab / Segment Group (39557:2854): #F3F3F3 track, radius 8, 4px padding; selected item is white. */
function Segment({ value, onChange, options }) {
  return (
    <div className="dv-seg" role="tablist">
      {options.map(([id, label]) => (
        <button type="button" key={id} role="tab" aria-selected={value === id} className={`dv-seg-item${value === id ? ' selected' : ''}`} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** 56px donut: #EEE track, 11.2px ring (Figma "Blue" 56×56). */
function Ring({ pct, color }) {
  const r = 22.4;
  const c = 2 * Math.PI * r;
  return (
    <svg className="dv-ring" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#eeeeee" strokeWidth="11.2" />
      {pct > 0 && (
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="11.2" strokeDasharray={`${c * Math.min(pct, 1)} ${c}`} transform="rotate(-90 28 28)" />
      )}
    </svg>
  );
}

const FIELD_LABELS = { title: 'Renamed', status: 'Status', assignee: 'Tix to', tags: 'Tags', start: 'Change', end: 'Due date', box: 'Box' };

function Entry({ entry, boxName, isToday, members, currentUser, onOpen }) {
  const title = entry.title || 'Untitled';
  return (
    <article className={`dv-entry${isToday ? '' : ' dv-entry-past'}`}>
      <span className="dv-entry-dot" />
      <div className="dv-entry-head">
        <div className="dv-entry-row">
          {onOpen ? <button type="button" className="dv-entry-title dv-entry-link" onClick={onOpen}>{title}</button> : <span className="dv-entry-title">{title}</span>}
          <span className="dv-entry-time">{clock(entry.ts)}</span>
        </div>
        <div className="dv-entry-sub">{boxName}</div>
      </div>
      {entry.kind === 'create' && <Row label="Created"><StatusChip status={entry.changes[0]?.to || 'pending'} /></Row>}
      {entry.kind === 'delete' && <Row label="Deleted"><span className="dv-chip dv-chip-muted">Removed</span></Row>}
      {entry.kind === 'update' && entry.changes.map((c) => (
        <Row key={c.field} label={FIELD_LABELS[c.field] || c.field}>
          <Change change={c} members={members} currentUser={currentUser} />
        </Row>
      ))}
    </article>
  );
}

function Row({ label, children }) {
  return (
    <div className="dv-row">
      <span className="dv-row-label">{label}</span>
      <span className="dv-row-value">{children}</span>
    </div>
  );
}

function Arrow() { return <img className="dv-row-arrow" src={icon('arrow_right')} alt="→" width={24} height={24} />; }

function Change({ change, members, currentUser }) {
  const { field, from, to } = change;
  switch (field) {
    case 'start':
    case 'end':
      return <><span className="dv-chip">{shortDate(from)}</span><Arrow /><span className="dv-chip">{shortDate(to)}</span></>;
    case 'status':
      return <StatusChip status={to} />;
    case 'assignee':
      return to ? (
        <span className="dv-chip dv-chip-person">
          <img src={assigneePicture(to, members, currentUser)} alt="" referrerPolicy="no-referrer" />
          {assigneeName(to, members, currentUser)}
        </span>
      ) : <span className="dv-chip dv-chip-muted">Unassigned</span>;
    case 'tags':
      return to.length ? to.map((t) => <span key={t} className={`marker lv-tag lv-tag-${String(t).toLowerCase()}`}>{t}</span>) : <span className="dv-chip dv-chip-muted">No tags</span>;
    case 'title':
      return <><span className="dv-chip dv-chip-text">{from || 'Untitled'}</span><Arrow /><span className="dv-chip dv-chip-text">{to || 'Untitled'}</span></>;
    default:
      return <span className="dv-chip">{String(to ?? '—')}</span>;
  }
}

/** Marker V2 status chip: Drop (gray, ⊘) and Overdue (red, skull) follow the Figma entries. */
function StatusChip({ status }) {
  return (
    <span className={`dv-chip dv-chip-status dv-status-${status}`}>
      {status === 'drop' && <img src={icon('drop_dot')} alt="" width={10} height={10} />}
      {status === 'overdue' && <img src={icon('skull')} alt="" width={14} height={14} />}
      {STATUS_LABELS[status] || status}
    </span>
  );
}
