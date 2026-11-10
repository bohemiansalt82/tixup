import { STATUS_LABELS } from '../constants';
import { getBarStartDate, getBarEndDate } from './timeline';
import { buildXlsx, downloadBlob } from './xlsx';

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

/** Rows for one box: each parent Tix followed by its sub-tix, in list order. */
export function boxRows(tasks, boxId) {
  const parents = tasks.filter((t) => t.type !== 'child' && t.boxId === boxId);
  const out = [];
  parents.forEach((p) => {
    out.push(row(p, null));
    tasks.filter((t) => t.type === 'child' && t.parentId === p.id).forEach((c) => out.push(row(c, p)));
  });
  return out;
}

const safeFile = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Builds `<Space>-<Box>-<YYYY-MM-DD>.xlsx` with every Tix / sub-tix of the box and downloads it. */
export function exportBoxToExcel({ tasks, box, spaceName }) {
  const blob = buildXlsx({ sheetName: box.name, columns: COLUMNS, rows: boxRows(tasks, box.id) });
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  downloadBlob(blob, `${[safeFile(spaceName), safeFile(box.name), stamp].filter(Boolean).join('-')}.xlsx`);
}
