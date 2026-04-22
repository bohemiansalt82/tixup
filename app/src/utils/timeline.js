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
