import { STATUS_LABELS } from '../constants';
import { getBarStartDate, getBarEndDate } from './timeline';
import { buildXlsx, buildWorkbook, colName, downloadBlob } from './xlsx';

const COLUMNS = [
  { header: 'Type', width: 10 },
  { header: 'Tix', width: 36 },
  { header: 'Parent Tix', width: 28 },
  { header: 'Status', width: 13 },
  { header: 'Assignee', width: 22 },
  { header: 'Start Date', width: 13 },
  { header: 'Due Date', width: 13 },
  { header: 'Days', width: 7 },
  { header: 'Tags', width: 22 },
  { header: 'Comments', width: 10 },
  { header: 'Created', width: 18 },
];

const assigneeLabel = (a) => (a ? (a.name || a.email || '') : '');
const created = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function row(task, parent) {
  const days = Number.isFinite(task.width) && task.width > 0 ? Math.max(1, Math.round(task.width / 48)) : '';
  return [
    task.type === 'child' ? 'Sub Tix' : 'Tix',
    task.title || (task.type === 'child' ? 'New Sub Tix' : 'New Tix'),
    parent ? (parent.title || 'New Tix') : '',
    STATUS_LABELS[task.status] || task.status || '',
    assigneeLabel(task.assignee),
    getBarStartDate(task.start) || '',
    getBarEndDate(task.start, task.width) || '',
    days,
    (task.tags || []).join(', '),
    task.comments?.length || 0,
    created(task.createdAt),
  ];
}

/** Each parent Tix of the box followed by its sub-tix, in list order: [{ task, parent }]. */
function boxTasks(tasks, boxId) {
  const out = [];
  tasks.filter((t) => t.type !== 'child' && t.boxId === boxId).forEach((p) => {
    out.push({ task: p, parent: null });
    tasks.filter((t) => t.type === 'child' && t.parentId === p.id).forEach((c) => out.push({ task: c, parent: p }));
  });
  return out;
}

/** Rows for one box: each parent Tix followed by its sub-tix, in list order. */
export function boxRows(tasks, boxId) {
  return boxTasks(tasks, boxId).map(({ task, parent }) => row(task, parent));
}

const safeFile = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseIso = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const fileName = (spaceName, box, suffix) => `${[safeFile(spaceName), safeFile(box.name), suffix, isoOf(new Date())].filter(Boolean).join('-')}.xlsx`;

/** Table export: `<Space>-<Box>-<YYYY-MM-DD>.xlsx` with every Tix / sub-tix of the box. */
export function exportBoxToExcel({ tasks, box, spaceName }) {
  const blob = buildXlsx({ sheetName: box.name, columns: COLUMNS, rows: boxRows(tasks, box.id) });
  downloadBlob(blob, fileName(spaceName, box, ''));
}

// Gantt bar fills: the timeline bar hues one step stronger so they read on Excel's white grid.
const BAR_FILL = {
  pending: 'FEF08A',
  inprogress: 'BFDBFE',
  done: 'BBF7D0',
  overdue: 'FECACA',
  pause: 'E5E7EB',
  drop: 'D4D4D4',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const LEFT = [
  { header: 'Tix', width: 34 },
  { header: 'Status', width: 12 },
  { header: 'Assignee', width: 18 },
  { header: 'Start', width: 11 },
  { header: 'Due', width: 11 },
  { header: 'Days', width: 6 },
];
const DAY_WIDTH = 3.6;

/**
 * Timeline export: a Gantt chart drawn with cell fills. Left block = Tix / Status / Assignee /
 * Start / Due / Days (sub-tix indented under their parent); then one narrow column per day from
 * the first bar's Sunday to the last bar's Saturday, with a month row (merged), a day-number
 * row and a weekday row. A Tix's days are filled with its status colour; weekends are shaded,
 * today's column is outlined in red. Panes are frozen on the left block and the header rows.
 */
export function buildBoxTimeline(tasks, box) {
  const items = boxTasks(tasks, box.id).map(({ task, parent }) => {
    const from = getBarStartDate(task.start);
    const to = getBarEndDate(task.start, task.width);
    return { task, parent, from, to: to && from && to < from ? from : to };
  });
  const dated = items.filter((x) => x.from && x.to);
  const today = isoOf(new Date());
  const first = dated.length ? dated.reduce((m, x) => (x.from < m ? x.from : m), dated[0].from) : today;
  const last = dated.length ? dated.reduce((m, x) => (x.to > m ? x.to : m), dated[0].to) : today;
  // Whole weeks, Sunday first like the calendar view.
  const start = parseIso(first);
  start.setDate(start.getDate() - start.getDay());
  const end = parseIso(last);
  end.setDate(end.getDate() + (6 - end.getDay()));
  const days = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) days.push(new Date(d));

  // styles
  const styles = [null];
  const add = (st) => { styles.push(st); return styles.length - 1; };
  const LINE = 'E0E0E0';
  const sHead = add({ bold: true, fill: 'F3F3F3', border: LINE, valign: 'center' });
  const sMonth = add({ bold: true, fill: 'F3F3F3', border: LINE, align: 'left' });
  const sDay = add({ fill: 'FFFFFF', border: LINE, align: 'center', size: 9, color: '616161' });
  const sDayWeekend = add({ fill: 'F5F5F5', border: LINE, align: 'center', size: 9, color: 'E53935' });
  const sDayToday = add({ bold: true, fill: 'E53935', border: 'E53935', align: 'center', size: 9, color: 'FFFFFF' });
  const sParent = add({ bold: true, border: LINE });
  const sChild = add({ border: LINE, color: '424242' });
  const sCell = add({ border: LINE, align: 'center', color: '424242' });
  const sEmpty = add({ border: LINE });
  const sWeekend = add({ fill: 'FAFAFA', border: LINE });
  const sToday = add({ fill: 'FFEBEE', border: 'E53935' });
  const sBar = {};
  Object.entries(BAR_FILL).forEach(([k, fill]) => { sBar[k] = add({ fill, border: LINE }); });

  const L = LEFT.length;
  const rowsOut = [[], [], []];
  const merges = [];
  // left header spans the three header rows
  LEFT.forEach((c, i) => {
    rowsOut[0][i] = { v: c.header, s: sHead };
    rowsOut[1][i] = { v: '', s: sHead };
    rowsOut[2][i] = { v: '', s: sHead };
    merges.push(`${colName(i)}1:${colName(i)}3`);
  });
  // month row (merged across each month's days), day numbers, weekday letters
  let monthStart = 0;
  days.forEach((d, j) => {
    const c = L + j;
    const iso = isoOf(d);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const ds = iso === today ? sDayToday : weekend ? sDayWeekend : sDay;
    const newMonth = j === 0 || d.getDate() === 1;
    rowsOut[0][c] = { v: newMonth ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '', s: sMonth };
    rowsOut[1][c] = { v: d.getDate(), s: ds };
    rowsOut[2][c] = { v: WEEKDAYS[d.getDay()], s: ds };
    const nextIsNewMonth = j === days.length - 1 || days[j + 1].getDate() === 1;
    if (nextIsNewMonth) {
      if (j > monthStart) merges.push(`${colName(L + monthStart)}1:${colName(c)}1`);
      monthStart = j + 1;
    }
  });

  items.forEach(({ task, parent, from, to }) => {
    const child = !!parent;
    const title = task.title || (child ? 'New Sub Tix' : 'New Tix');
    const n = from && to ? Math.round((parseIso(to) - parseIso(from)) / 86400000) + 1 : '';
    const r = [
      { v: child ? `    ${title}` : title, s: child ? sChild : sParent },
      { v: STATUS_LABELS[task.status] || task.status || '', s: sCell },
      { v: assigneeLabel(task.assignee), s: sCell },
      { v: from || '', s: sCell },
      { v: to || '', s: sCell },
      { v: n, s: sCell },
    ];
    const bar = sBar[task.status === 'onhold' ? 'pause' : task.status] || sBar.pending;
    days.forEach((d) => {
      const iso = isoOf(d);
      const inBar = from && to && iso >= from && iso <= to;
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      r.push({ v: '', s: inBar ? bar : iso === today ? sToday : weekend ? sWeekend : sEmpty });
    });
    rowsOut.push(r);
  });

  const heights = { 0: 20, 1: 16, 2: 14 };
  for (let i = 3; i < rowsOut.length; i += 1) heights[i] = 20;
  return buildWorkbook({
    sheetName: `${box.name} timeline`,
    rows: rowsOut,
    styles,
    widths: [...LEFT.map((c) => c.width), ...days.map(() => DAY_WIDTH)],
    heights,
    merges,
    freeze: { cols: L, rows: 3 },
  });
}

/** Timeline export: `<Space>-<Box>-timeline-<YYYY-MM-DD>.xlsx` (Gantt drawn with cell fills). */
export function exportBoxTimelineToExcel({ tasks, box, spaceName }) {
  downloadBlob(buildBoxTimeline(tasks, box), fileName(spaceName, box, 'timeline'));
}
