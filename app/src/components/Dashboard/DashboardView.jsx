import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSpaces } from '../../store/useSpaces';
import { avatarFor } from '../../store/useAuth';
import { useInvite } from '../../hooks/useInvite';
import { STATUS_LABELS } from '../../constants';
import { MakeModal } from '../Modals/MakeModal';
import { InviteModal } from '../Modals/InviteModal';
import {
  overview, keywords, byAssignee, distribution, assigneeName, assigneePicture,
  buildDayLine, buildWeekLine, archiveEntries, entryOnDay, shortDate, dateTime,
} from './dashboardStats';
import './DashboardView.css';

const icon = (name) => `${import.meta.env.BASE_URL}images/dashboard/${name}.svg`;
const headerIcon = (name) => `${import.meta.env.BASE_URL}images/header/${name}.svg`;

/**
 * Dashboard — Figma Tixup-V2.0 "Tixup_Dashboard" 37700:8285.
 *
 * Live: header counts, New Project (creates a box), team invite, Overview (This Week / This Month),
 * Keywords (word frequency over Tix titles), Issue status by Assignee (sortable), Issue status
 * Distribution, and the Archive: every add / change recorded on a Tix (`task.history`, newest
 * first) as a card — an add shows the whole Tix, a change only the fields that changed (old › new).
 * The day line dots show how many entries happened each day (dot size = count); clicking a day /
 * week tints those cards and scrolls to the first. Only the archive panes scroll, not the page.
 * Visual only: "Files" count, the "Ai" badge, the ⋮ menu.
 */
export function DashboardView({ tasks, members = [], currentUser, onOpenTix }) {
  const { activeSpace, boxes, createBox } = useSpaces();
  const [period, setPeriod] = useState('week');
  const [issueSort, setIssueSort] = useState('desc');
  const [lineMode, setLineMode] = useState('day');
  const [selected, setSelected] = useState({ from: 0, to: 0 }); // day offsets (0 = today)
  const feedRef = useRef(null);
  const daylineRef = useRef(null);
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
  const entries = useMemo(() => archiveEntries(tasks), [tasks]);
  const boxName = (id) => (id ? (boxes.find((b) => b.id === id)?.name ?? '') : (activeSpace?.name ?? ''));

  // Selecting a day / week scrolls the Tix list to the first Tix of that range; the day line keeps
  // the selected item in view too (both panes scroll on their own).
  useLayoutEffect(() => {
    const feed = feedRef.current;
    const target = feed?.querySelector('.dv-entry-selected');
    if (feed && target) feed.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: 'smooth' });
    daylineRef.current?.querySelector('.dv-day-selected')?.scrollIntoView({ block: 'nearest' });
  }, [selected, lineMode, entries]);

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
                  {members.find((m) => m.email === currentUser.email)?.online && <img className="dv-avatar-online" src={headerIcon('online')} alt="" width={10} height={10} title="Online" />}
                </span>
              )}
              {teamMembers.map((m) => (
                <span key={m.email} className="dv-avatar dv-avatar-member" title={`${m.name || m.email}${m.online ? ' · online' : ''}`}>
                  <img src={m.picture || avatarFor(m.name || m.email)} alt="" referrerPolicy="no-referrer" />
                  {m.online && <img className="dv-avatar-online" src={headerIcon('online')} alt="" width={10} height={10} />}
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

        {/* Archive (Figma 37703:816): day line + add / change cards */}
        <div className="dv-col dv-col-right">
          <div className="dv-block-head">
            <h2 className="dv-block-title">Archive</h2>
            <Segment value={lineMode} onChange={(m) => { setLineMode(m); setSelected({ from: 0, to: 0 }); }} options={[['day', 'Day'], ['week', 'Week']]} />
          </div>
          <div className="dv-timeline">
            <div className="dv-dayline" ref={daylineRef}>
              {line.map((it) => {
                if (it.kind === 'label') return <div className="dv-day dv-day-label" key={it.key}>{it.text}</div>;
                const n = entries.filter((e) => entryOnDay(e, it.from, it.to)).length;
                const isSelected = selected.from === it.from && selected.to === it.to;
                return (
                  <button
                    type="button"
                    key={it.key}
                    className={`dv-day${isSelected ? ' dv-day-selected' : ''}${it.weekend ? ' dv-day-weekend' : ''}${it.today ? ' dv-day-today' : ''}`}
                    onClick={() => setSelected({ from: it.from, to: it.to })}
                    title={n ? `${n} ${n === 1 ? 'entry' : 'entries'}` : undefined}
                  >
                    <span className="dv-day-tix">{n > 0 && <span className={`dv-day-dot dv-day-dot-${n >= 4 ? 3 : n >= 2 ? 2 : 1}`} />}</span>
                    <span className="dv-day-letter">{it.letter}</span>
                    <span className="dv-day-num">{it.num}</span>
                  </button>
                );
              })}
            </div>
            <div className="dv-feed" ref={feedRef}>
              {entries.length === 0 && <div className="dv-feed-empty">Tix you add or change will be archived here.</div>}
              {entries.map((e) => (
                <ArchiveEntry
                  key={e.key}
                  entry={e}
                  boxName={boxName(e.task.boxId)}
                  boxNameOf={boxName}
                  selected={entryOnDay(e, selected.from, selected.to)}
                  members={members}
                  currentUser={currentUser}
                  onOpen={onOpenTix ? () => onOpenTix(e.task.id) : null}
                />
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

/**
 * One archive card (Figma "Tix" 37705:1016 / 37705:12623): title + timestamp, box, then rows.
 * kind 'add' lists the Tix as created (Due date start › end, Tix to, Status, Tags);
 * kind 'change' lists only the changed fields, each as old › new.
 */
function ArchiveEntry({ entry, boxName, boxNameOf, selected, members, currentUser, onOpen }) {
  const { task, kind, changes } = entry;
  const title = task.title || 'Untitled';
  const person = (a) => (a ? (
    <span className="dv-chip dv-chip-person">
      <img src={assigneePicture(a, members, currentUser)} alt="" referrerPolicy="no-referrer" />
      {assigneeName(a, members, currentUser)}
    </span>
  ) : <span className="dv-chip dv-chip-muted">Unassigned</span>);
  const tagChips = (tags) => (Array.isArray(tags) && tags.length
    ? tags.map((t) => <span key={t} className={`marker lv-tag lv-tag-${String(t).toLowerCase()}`}>{t}</span>)
    : <span className="dv-chip dv-chip-muted">No tag</span>);
  const text = (v) => <span className="dv-chip"><span className="dv-chip-text">{v || '—'}</span></span>;

  const rows = [];
  if (kind === 'add') {
    const c = changes;
    if (c.span?.[0]) rows.push(<Row key="span" label="Due date"><span className="dv-chip">{shortDate(c.span[0])}</span><Arrow /><span className="dv-chip">{shortDate(c.span[1])}</span></Row>);
    if (c.assignee) rows.push(<Row key="assignee" label="Tix to">{person(c.assignee)}</Row>);
    rows.push(<Row key="status" label="Status"><StatusChip status={c.status} /></Row>);
    if (c.tags?.length) rows.push(<Row key="tags" label="Tags">{tagChips(c.tags)}</Row>);
  } else {
    if (changes.title) rows.push(<Row key="title" label="Title">{text(changes.title.from)}<Arrow />{text(changes.title.to)}</Row>);
    if (changes.span) rows.push(<Row key="span" label="Due date"><span className="dv-chip">{shortDate(changes.span.from?.[1])}</span><Arrow /><span className="dv-chip">{shortDate(changes.span.to?.[1])}</span></Row>);
    if (changes.status) rows.push(<Row key="status" label="Status"><StatusChip status={changes.status.from} /><Arrow /><StatusChip status={changes.status.to} /></Row>);
    if (changes.assignee) rows.push(<Row key="assignee" label="Tix to">{person(changes.assignee.from)}<Arrow />{person(changes.assignee.to)}</Row>);
    if (changes.tags) rows.push(<Row key="tags" label="Tags">{tagChips(changes.tags.from)}<Arrow />{tagChips(changes.tags.to)}</Row>);
    if (changes.boxId) rows.push(<Row key="box" label="Box">{text(boxNameOf(changes.boxId.from))}<Arrow />{text(boxNameOf(changes.boxId.to))}</Row>);
  }

  return (
    <article className={`dv-entry dv-entry-${kind}${selected ? ' dv-entry-selected' : ''}`} data-task-id={task.id}>
      <div className="dv-entry-head">
        <div className="dv-entry-row">
          {onOpen ? <button type="button" className="dv-entry-title dv-entry-link" onClick={onOpen}>{title}</button> : <span className="dv-entry-title">{title}</span>}
          <span className="dv-entry-time">{dateTime(entry.at)}</span>
        </div>
        <div className="dv-entry-sub">{kind === 'add' ? 'Added' : 'Changed'}{boxName ? ` · ${boxName}` : ''}</div>
      </div>
      {rows}
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

/** Status as the Marker V3 icon badge (Figma 37705:12640 uses Marker V3 with its icon). */
function StatusChip({ status }) {
  return <span className={`marker marker-has-icon marker-${status}`}>{STATUS_LABELS[status] || status}</span>;
}
