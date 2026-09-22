import { CELL_WIDTH, CENTER_PX, BASE_EPOCH } from '../../constants';

/* ---------- date helpers (local time, 'YYYY-MM-DD') ---------- */

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** whole-day difference b - a */
export function diffDays(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

/** Month grid: Sunday-first, always 6 weeks × 7 days. */
export function monthGrid(month, weeks = 6) {
  const first = startOfMonth(month);
  const gridStart = addDays(first, -first.getDay());
  const rows = [];
  for (let w = 0; w < weeks; w += 1) {
    const row = [];
    for (let d = 0; d < 7; d += 1) row.push(addDays(gridStart, w * 7 + d));
    rows.push(row);
  }
  return rows;
}

/**
 * Continuous week rows from the Sunday on/before `from` to the Saturday on/after the last day
 * before `toExclusive` (both month starts). Used by the scrolling calendar.
 */
export function weeksBetween(from, toExclusive) {
  const gridStart = addDays(from, -from.getDay());
  const last = addDays(toExclusive, -1);
  const gridEnd = addDays(last, 6 - last.getDay());
  const rows = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 7)) {
    const row = [];
    for (let i = 0; i < 7; i += 1) row.push(addDays(d, i));
    rows.push(row);
  }
  return rows;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const formatMonth = (date) => `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
export const formatMonthShort = (date) => MONTHS[date.getMonth()].slice(0, 3);
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ---------- timeline px (48 px/day, CENTER_PX = today) ↔ calendar days ---------- */

/** Day offset from today for a stored `start` px. */
export const pxToDayOffset = (px) => Math.round((px - CENTER_PX) / CELL_WIDTH);
export const dayOffsetToPx = (offset) => CENTER_PX + offset * CELL_WIDTH;
export const dateToDayOffset = (date) => diffDays(BASE_EPOCH, date);
export const dayOffsetToDate = (offset) => addDays(BASE_EPOCH, offset);

/**
 * Task → calendar span. Returns null for tasks that are not placed on the timeline.
 * `days` is the bar length in whole days (min 1), same rule as `getBarEndDate()`.
 */
export function taskSpan(task) {
  if (!Number.isFinite(task.start) || !Number.isFinite(task.width) || task.width <= 0) return null;
  const startOffset = pxToDayOffset(task.start);
  const days = Math.max(1, Math.round(task.width / CELL_WIDTH));
  const start = dayOffsetToDate(startOffset);
  const end = dayOffsetToDate(startOffset + days - 1);
  return { start, end, startISO: toISO(start), endISO: toISO(end), startOffset, days };
}

/** Stored px for a span given as day offsets (inclusive). */
export function spanToPx(startOffset, endOffset) {
  const days = Math.max(1, endOffset - startOffset + 1);
  return { start: dayOffsetToPx(startOffset), width: days * CELL_WIDTH };
}

/* ---------- lane layout per week ---------- */

/**
 * Lays out calendar blocks for one week: overlapping blocks stack into lanes.
 * `items` = [{ id, span, ...rest }]. Sort: earlier start first, then longer first.
 */
export function layoutWeek(week, items) {
  const weekStart = week[0];
  const weekEnd = week[6];
  const raw = [];
  for (const item of items) {
    const { start, end } = item.span;
    if (end < weekStart || start > weekEnd) continue;
    raw.push({
      ...item,
      startCol: Math.max(0, diffDays(weekStart, start)),
      endCol: Math.min(6, diffDays(weekStart, end)),
      continuesLeft: start < weekStart,
      continuesRight: end > weekEnd,
      totalDays: diffDays(start, end),
    });
  }
  raw.sort((a, b) => (a.span.start - b.span.start) || (b.totalDays - a.totalDays));

  const laneEnds = [];
  const segments = raw.map((seg) => {
    let lane = laneEnds.findIndex((end) => end < seg.startCol);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(seg.endCol); } else laneEnds[lane] = seg.endCol;
    return { ...seg, lane };
  });
  return { segments, laneCount: laneEnds.length };
}
