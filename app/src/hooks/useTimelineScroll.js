import { useRef, useCallback, useEffect } from 'react';
import { CENTER_PX, VIRTUAL_WIDTH, BASE_EPOCH } from '../constants';
import { getDateFromPx } from '../utils/timeline';

const JUMP_MARGIN = 5000;

export function useTimelineScroll({
  viewportRef, tbodyRef, daysHeaderRef, gridBackRef, floatingLabelsRef,
  todayRef, fixedMasterRef, panOffsetRef, cellWidthRef, isDraggingRef, isResizingRef,
  setCellWidth,
}) {
  const lastStartDayRef = useRef(null);
  const rafRef = useRef(null);

  const applyTransform = useCallback(() => {
    const pan = panOffsetRef.current;
    const t = `translateX(${-pan}px)`;
    if (daysHeaderRef.current) daysHeaderRef.current.style.transform = t;
    if (gridBackRef.current) gridBackRef.current.style.transform = t;
    if (tbodyRef.current) tbodyRef.current.style.transform = t;
    if (floatingLabelsRef.current) floatingLabelsRef.current.style.transform = t;
    if (todayRef.current) {
      todayRef.current.style.transform = t;
      todayRef.current.style.left = `${CENTER_PX}px`;
    }
  }, [panOffsetRef, daysHeaderRef, gridBackRef, tbodyRef, floatingLabelsRef, todayRef]);

  const renderHeader = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || viewport.offsetParent === null) return;

    let sl = viewport.scrollLeft;
    const cw = cellWidthRef.current;
    const pan = panOffsetRef.current;
    const CENTER_SCROLL = VIRTUAL_WIDTH / 2;

    if (!isDraggingRef.current && !isResizingRef.current) {
      if (sl < JUMP_MARGIN) {
        panOffsetRef.current = pan - (CENTER_SCROLL - sl);
        viewport.scrollLeft = CENTER_SCROLL;
        applyTransform();
        return;
      } else if (sl > VIRTUAL_WIDTH - JUMP_MARGIN) {
        panOffsetRef.current = pan + (sl - CENTER_SCROLL);
        viewport.scrollLeft = CENTER_SCROLL;
        applyTransform();
        return;
      }
    }

    const absLeft = sl + pan;
    const vpWidth = viewport.clientWidth || window.innerWidth;
    const startDay = Math.floor(((absLeft - cw * 15) - CENTER_PX) / cw);
    const endDay = Math.floor(((absLeft + vpWidth + cw * 15) - CENTER_PX) / cw);

    if (fixedMasterRef.current) {
      const d = getDateFromPx(absLeft + 80, cw);
      fixedMasterRef.current.innerText = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    }

    applyTransform();

    if (startDay === lastStartDayRef.current) {
      renderFloatingLabels(startDay, endDay);
      return;
    }
    lastStartDayRef.current = startDay;

    renderDays(startDay, endDay, cw);
    renderFloatingLabels(startDay, endDay);
  }, [viewportRef, cellWidthRef, panOffsetRef, isDraggingRef, isResizingRef, applyTransform, fixedMasterRef]);

  const renderDays = useCallback((startDay, endDay, cw) => {
    if (!daysHeaderRef.current || !gridBackRef.current) return;
    let dHtml = '', gHtml = '';

    if (cw >= 30) {
      for (let i = startDay; i <= endDay; i++) {
        const date = new Date(BASE_EPOCH);
        date.setDate(date.getDate() + i);
        const left = CENTER_PX + i * cw;
        const isWE = date.getDay() === 0 || date.getDay() === 6;
        dHtml += `<div class="timeline-day-cell${i === 0 ? ' today-marker' : ''}" style="position:absolute;left:${left}px;width:${cw}px;${isWE ? 'color:var(--primitive-colors-red-400);' : ''}">${date.getDate()}</div>`;
        gHtml += `<div class="timeline-grid-line${isWE ? ' is-weekend' : ''}" style="position:absolute;left:${left}px;top:0;bottom:0;width:${cw}px;border-right:1px solid var(--primitive-colors-gray-100);"></div>`;
      }
    } else if (cw > 10) {
      for (let i = startDay; i <= endDay; i++) {
        const date = new Date(BASE_EPOCH);
        date.setDate(date.getDate() + i);
        if (date.getDay() === 1) {
          const left = CENTER_PX + i * cw;
          dHtml += `<div class="timeline-day-cell" style="position:absolute;left:${left}px;width:${cw * 7}px;font-size:11px;justify-content:flex-start;padding-left:4px;">${(date.getMonth() + 1)}/${date.getDate()}</div>`;
          gHtml += `<div class="timeline-grid-line" style="position:absolute;left:${left}px;top:0;bottom:0;width:${cw * 7}px;border-left:1px solid var(--primitive-colors-gray-200);opacity:0.5;"></div>`;
        }
      }
    } else {
      for (let i = startDay; i <= endDay; i++) {
        const date = new Date(BASE_EPOCH);
        date.setDate(date.getDate() + i);
        if (date.getDate() === 1) {
          const left = CENTER_PX + i * cw;
          gHtml += `<div class="timeline-grid-line" style="position:absolute;left:${left}px;top:0;bottom:0;width:${cw * 30}px;border-left:1px solid var(--primitive-colors-gray-300);"></div>`;
        }
      }
    }

    daysHeaderRef.current.innerHTML = dHtml;
    gridBackRef.current.innerHTML = gHtml;
  }, [daysHeaderRef, gridBackRef]);

  const renderFloatingLabels = useCallback((startDay, endDay) => {
    if (!floatingLabelsRef.current) return;
    const cw = cellWidthRef.current;
    const start = new Date(BASE_EPOCH); start.setDate(start.getDate() + startDay);
    const end = new Date(BASE_EPOCH); end.setDate(end.getDate() + endDay);

    let html = '';
    let iter = new Date(start.getFullYear(), start.getMonth(), 1);
    while (iter <= end) {
      const dayOff = Math.round((iter - BASE_EPOCH) / 86400000);
      const left = CENTER_PX + dayOff * cw;
      html += `<div class="timeline-month-label-floating" style="left:${left}px;width:100px;">${iter.getMonth() + 1}월</div>`;
      iter = new Date(iter.getFullYear(), iter.getMonth() + 1, 1);
    }
    floatingLabelsRef.current.innerHTML = html;
  }, [floatingLabelsRef, cellWidthRef]);

  const animateScroll = useCallback((targetX) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const startX = viewport.scrollLeft;
    const distance = targetX - startX;
    const duration = 500;
    let startTime = null;
    const ease = (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;
    const step = (now) => {
      if (!startTime) startTime = now;
      const p = Math.min((now - startTime) / duration, 1);
      viewport.scrollLeft = startX + distance * ease(p);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [viewportRef]);

  const scrollToToday = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const target = CENTER_PX - panOffsetRef.current - viewport.clientWidth / 2 + 24;
    const dist = Math.abs(target - viewport.scrollLeft);
    if (target > 5000 && target < VIRTUAL_WIDTH - 5000 && dist < 15000) {
      animateScroll(target);
    } else {
      panOffsetRef.current = CENTER_PX - VIRTUAL_WIDTH / 2;
      viewport.scrollLeft = VIRTUAL_WIDTH / 2 - viewport.clientWidth / 2 + 24;
      renderHeader();
    }
  }, [viewportRef, panOffsetRef, animateScroll, renderHeader]);

  const scrollPrev = useCallback(() => {
    const vp = viewportRef.current;
    if (vp) animateScroll(vp.scrollLeft - 14 * cellWidthRef.current);
  }, [viewportRef, cellWidthRef, animateScroll]);

  const scrollNext = useCallback(() => {
    const vp = viewportRef.current;
    if (vp) animateScroll(vp.scrollLeft + 14 * cellWidthRef.current);
  }, [viewportRef, cellWidthRef, animateScroll]);

  const updateZoom = useCallback((val, focalX = null) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const newCw = Math.max(20, Math.min(150, parseFloat(val)));
    const oldCw = cellWidthRef.current;
    if (Math.abs(newCw - oldCw) < 0.01) return;

    const fx = focalX !== null ? focalX : viewport.clientWidth / 2;
    const absF = viewport.scrollLeft + panOffsetRef.current + fx;
    const dayOff = (absF - CENTER_PX) / oldCw;

    cellWidthRef.current = newCw;
    localStorage.setItem('tixup_zoom', newCw);

    const newAbsF = CENTER_PX + dayOff * newCw;
    viewport.scrollLeft = newAbsF - panOffsetRef.current - fx;

    lastStartDayRef.current = null;
    setCellWidth(newCw);
    renderHeader();
  }, [viewportRef, cellWidthRef, panOffsetRef, setCellWidth, renderHeader]);

  const handleScroll = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(renderHeader);
  }, [renderHeader]);

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const vp = viewportRef.current;
      if (!vp) return;
      const rect = vp.getBoundingClientRect();
      updateZoom(cellWidthRef.current * (e.deltaY > 0 ? 0.95 : 1.05), e.clientX - rect.left);
    }
  }, [viewportRef, cellWidthRef, updateZoom]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.addEventListener('scroll', handleScroll, { passive: true });
    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      vp.removeEventListener('scroll', handleScroll);
      vp.removeEventListener('wheel', handleWheel);
    };
  }, [viewportRef, handleScroll, handleWheel]);

  return { renderHeader, scrollToToday, scrollPrev, scrollNext, updateZoom };
}
