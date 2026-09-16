import { CELL_WIDTH, CENTER_PX, BASE_EPOCH, STATUS_LABELS } from '../../constants';
import { avatarFor } from '../../store/useAuth';
import { addDays, diffDays, toISO, isSameDay, startOfMonth, formatMonth } from '../Calendar/calendarLayout';

/* Pure helpers behind the dashboard (Figma Tixup_Dashboard 37700:8285). */

/** Day offsets (0 = today) covered by a bar; null when unplaced. */
export function taskDays(task) {
  if (!task || !Number.isFinite(task.start)) return null;
  const startOffset = Math.round((task.start - CENTER_PX) / CELL_WIDTH);
  const len = Math.max(1, Math.round((Number.isFinite(task.width) ? task.width : CELL_WIDTH) / CELL_WIDTH));
  return { startOffset, endOffset: startOffset + len - 1 };
}

/** 'week' = Monday–Sunday of this week, 'month' = the current calendar month (day offsets). */
export function periodRange(period, today = BASE_EPOCH) {
  if (period === 'week') {
    const start = -((today.getDay() + 6) % 7);
    return { start, end: start + 6 };
  }
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: diffDays(today, first), end: diffDays(today, last) };
}

export function inPeriod(task, range) {
  const s = taskDays(task);
  return !!s && s.startOffset <= range.end && s.endOffset >= range.start;
}

/** Overview cards: Tix whose schedule touches the period. */
export function overview(tasks, period) {
  const range = periodRange(period);
  const list = tasks.filter((t) => inPeriod(t, range));
  const done = list.filter((t) => t.status === 'done').length;
  return { total: list.length, done, unresolved: list.length - done, critical: list.filter((t) => t.status === 'overdue').length };
}

/* ---- keywords (word frequency over Tix titles; the Figma "Ai" badge is visual only) ---- */
const STOP = new Set(('a an the and or of to in on for with is are be at by from it its this that as if not no '
  + 'we you i my our your they them their new add fix update change make do done todo task tix test '
  + 'after before into over under about via per all any some more less up down out off then than when '
  + '및 등 그리고 또는 위한 대한 관련 작업 수정 추가 변경 진행 검토 완료 확인').split(' '));

export function tokenize(title) {
  return String(title || '')
    .split(/[\s,.;:!?()[\]{}"'`/\\|<>#@+=~^*&%$_\-–—]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !STOP.has(w.toLowerCase()));
}

export function keywords(tasks, { spike = 3, frequent = 17 } = {}) {
  const counts = new Map();
  tasks.forEach((t) => {
    const seen = new Set();
    tokenize(t.title).forEach((w) => {
      const k = w.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      const e = counts.get(k) || { word: w, count: 0 };
      e.count += 1;
      counts.set(k, e);
    });
  });
  const sorted = [...counts.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  const top = sorted.slice(0, spike);
  const rest = sorted.slice(spike, spike + frequent);
  const max = rest[0]?.count || 0;
  return {
    spike: top,
    frequent: rest.map((e) => ({
      ...e,
      tier: max <= 1 ? 'mid' : e.count >= max * 0.66 ? 'high' : e.count >= max * 0.33 ? 'mid' : 'low',
    })),
  };
}

/* ---- issue status by assignee ---- */
export function assigneeName(assignee, members = [], currentUser = null) {
  if (!assignee) return 'Unassigned';
  if (assignee.name) return assignee.name;
  if (assignee.email && currentUser?.email === assignee.email && currentUser?.name) return currentUser.name;
  const member = members.find((m) => m.email && m.email === assignee.email);
  if (member?.name) return member.name;
  return (assignee.email || '').split('@')[0] || 'Unassigned';
}

export function assigneePicture(assignee, members = [], currentUser = null) {
  const name = assigneeName(assignee, members, currentUser);
  if (assignee?.email && currentUser?.email === assignee.email && currentUser?.picture) return currentUser.picture;
  const member = members.find((m) => m.email && m.email === assignee?.email);
  return member?.picture || avatarFor(name);
}

export function byAssignee(tasks, members = [], currentUser = null) {
  const map = new Map();
  tasks.forEach((t) => {
    const a = t.assignee || null;
    const key = a ? (a.email || a.name || 'unknown') : '__none';
    const row = map.get(key) || { key, assignee: a, name: assigneeName(a, members, currentUser), issues: 0, done: 0 };
    row.issues += 1;
    if (t.status === 'done') row.done += 1;
    map.set(key, row);
  });
  const rows = [...map.values()];
  const none = rows.find((r) => r.key === '__none');
  const people = rows.filter((r) => r.key !== '__none').sort((a, b) => b.issues - a.issues || a.name.localeCompare(b.name));
  return none ? [...people, none] : people;
}

/* ---- status distribution ---- */
export const STATUS_COLORS = { done: '#00c27b', inprogress: '#2196f3', overdue: '#c2185b', pending: '#c0ca33' };

export function distribution(tasks) {
  const total = tasks.length;
  return ['done', 'inprogress', 'overdue', 'pending'].map((status) => {
    const count = tasks.filter((t) => t.status === status).length;
    return { status, label: STATUS_LABELS[status], count, pct: total ? count / total : 0, color: STATUS_COLORS[status] };
  });
}

/* ---- timeline: Tix by date ---- */
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dayItem(date, today) {
  const offset = diffDays(today, date);
  return { kind: 'day', key: toISO(date), from: offset, to: offset, letter: LETTERS[date.getDay()], num: date.getDate(), weekend: date.getDay() === 0 || date.getDay() === 6, today: isSameDay(date, today) };
}

/** Day mode: 3 days of the previous month, the month label, then every day of this month. `from`/`to` are day offsets. */
export function buildDayLine(today = BASE_EPOCH) {
  const first = startOfMonth(today);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const items = [];
  for (let i = 3; i >= 1; i -= 1) items.push(dayItem(addDays(first, -i), today));
  items.push({ kind: 'label', key: `label-${toISO(first)}`, text: formatMonth(first) });
  for (let d = 1; d <= last.getDate(); d += 1) items.push(dayItem(new Date(today.getFullYear(), today.getMonth(), d), today));
  return items;
}

/** Week mode: Monday-based weeks covering the same range; a month label where the month changes. */
export function buildWeekLine(today = BASE_EPOCH) {
  const first = startOfMonth(today);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const rangeStart = addDays(first, -3);
  let monday = addDays(rangeStart, -((rangeStart.getDay() + 6) % 7));
  const items = [];
  let month = -1;
  while (monday <= last) {
    const sunday = addDays(monday, 6);
    if (monday.getMonth() !== month) {
      month = monday.getMonth();
      items.push({ kind: 'label', key: `label-${toISO(monday)}`, text: formatMonth(monday) });
    }
    const from = diffDays(today, monday);
    items.push({ kind: 'week', key: `w-${toISO(monday)}`, from, to: from + 6, letter: 'W', num: monday.getDate(), weekend: false, today: today >= monday && today <= sunday });
    monday = addDays(monday, 7);
  }
  return items;
}

/** Parent Tix ordered by start date (unplaced ones last), with their day span and ISO dates. */
export function timelineEntries(tasks) {
  return tasks
    .filter((t) => t.type !== 'child')
    .map((t) => {
      const span = taskDays(t);
      return { task: t, ...(span || { startOffset: null, endOffset: null }), startISO: span ? toISO(addDays(BASE_EPOCH, span.startOffset)) : null, endISO: span ? toISO(addDays(BASE_EPOCH, span.endOffset)) : null };
    })
    .sort((a, b) => (a.startOffset ?? Infinity) - (b.startOffset ?? Infinity) || (a.endOffset ?? 0) - (b.endOffset ?? 0) || (a.task.title || '').localeCompare(b.task.title || ''));
}

/** Does the Tix's span touch the day-offset range [from, to]? */
export const entryInRange = (entry, from, to) => entry.startOffset !== null && entry.startOffset <= to && entry.endOffset >= from;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function shortDate(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MON[m - 1]}`;
}
export function clock(isoOrMs) {
  const d = new Date(isoOrMs);
  if (Number.isNaN(d.getTime())) return '';
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
