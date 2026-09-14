import { CENTER_PX, BASE_EPOCH } from '../constants';

export function parseSafePx(pxStr, defaultVal = 0) {
  if (!pxStr) return defaultVal;
  const val = parseFloat(pxStr);
  return isNaN(val) ? defaultVal : val;
}

export function getDateFromPx(px, cellWidth) {
  const daysOffset = Math.floor((px - CENTER_PX) / cellWidth);
  const d = new Date(BASE_EPOCH);
  d.setDate(d.getDate() + daysOffset);
  return d;
}

/** Last day covered by a bar (stored px, 48 px/day) as a local 'YYYY-MM-DD' string; null when unplaced. */
export function getBarEndDate(start, width) {
  if (!Number.isFinite(start) || !Number.isFinite(width) || width <= 0) return null;
  const days = Math.round((start + width - CENTER_PX) / 48) - 1;
  const d = new Date(BASE_EPOCH);
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function snapToGrid(px, cellWidth) {
  return CENTER_PX + Math.round((px - CENTER_PX) / cellWidth) * cellWidth;
}

// Normalize stored position (48px base) → visual position at current zoom
export function toVisualLeft(storedStart, cellWidth) {
  const dayOffset = (storedStart - CENTER_PX) / 48;
  return CENTER_PX + dayOffset * cellWidth;
}

export function toVisualWidth(storedWidth, cellWidth) {
  return storedWidth * (cellWidth / 48);
}

// Visual position → stored (48px base)
export function toStoredLeft(visualLeft, cellWidth) {
  const dayOffset = (visualLeft - CENTER_PX) / cellWidth;
  return CENTER_PX + dayOffset * 48;
}

export function toStoredWidth(visualWidth, cellWidth) {
  return visualWidth * (48 / cellWidth);
}

export function uid() {
  return 'live-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

/* ---------- day anchoring ----------
 * Stored px are relative to "today" (CENTER_PX = BASE_EPOCH, midnight when the app loaded), so a
 * bar saved at CENTER_PX yesterday would render on *today* after a reload — every schedule drifted
 * one day per day. Each task now carries `anchor` ('YYYY-MM-DD'): the day its px were written
 * against. `rebaseTasks()` shifts px by the days elapsed since that anchor so dates stay put. */
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const todayISO = () => localISO(BASE_EPOCH);

function daysBetweenISO(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Re-anchors every task to today; returns the same array when nothing needed to change. */
export function rebaseTasks(tasks) {
  if (!Array.isArray(tasks)) return tasks;
  const today = todayISO();
  let changed = false;
  const out = tasks.map((t) => {
    if (!t || typeof t !== 'object' || t.anchor === today) return t;
    changed = true;
    if (!t.anchor || !/^\d{4}-\d{2}-\d{2}$/.test(t.anchor) || !Number.isFinite(t.start)) return { ...t, anchor: today };
    const delta = daysBetweenISO(t.anchor, today);
    return { ...t, anchor: today, start: t.start - delta * 48 };
  });
  return changed ? out : tasks;
}
