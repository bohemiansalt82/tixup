function renderTimelineHeader() {
    const viewport = document.querySelector('.timeline-view-viewport');
    if (!viewport) return;
    if (viewport.offsetParent === null || !window.__tixupScrollInitialized) return;

    let currentScrollLeft = viewport.scrollLeft;

    // Treadmill: keep scroll position away from virtual edges
    if (!TixupState.isDragging && !TixupState.isResizing) {
        const JUMP_MARGIN = 5000;
        const CENTER_SCROLL = UI_CONSTANTS.VIRTUAL_WIDTH / 2;

        if (currentScrollLeft < JUMP_MARGIN) {
            TixupState.panOffset -= (CENTER_SCROLL - currentScrollLeft);
            viewport.scrollLeft = CENTER_SCROLL;
            return;
        } else if (currentScrollLeft > UI_CONSTANTS.VIRTUAL_WIDTH - JUMP_MARGIN) {
            TixupState.panOffset += (currentScrollLeft - CENTER_SCROLL);
            viewport.scrollLeft = CENTER_SCROLL;
            return;
        }
    }

    const absoluteScrollLeft = currentScrollLeft + TixupState.panOffset;
    const viewportWidth = viewport.clientWidth || window.innerWidth;
    const startDayOffset = Math.floor(((absoluteScrollLeft - TixupState.currentCellWidth * 15) - UI_CONSTANTS.CENTER_PX) / TixupState.currentCellWidth);
    const endDayOffset = Math.floor(((absoluteScrollLeft + viewportWidth + TixupState.currentCellWidth * 15) - UI_CONSTANTS.CENTER_PX) / TixupState.currentCellWidth);

    const fixedMaster = document.getElementById('timeline-fixed-master');
    if (fixedMaster) {
        const d = getDateFromPx(absoluteScrollLeft + 80);
        fixedMaster.innerText = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    }

    const daysHeader = document.getElementById('timeline-days-header');
    const gridBack = document.getElementById('timeline-grid-back');
    const tBody = document.getElementById('timeline-tbody');
    const todayIndicator = document.getElementById('timeline-today-indicator');
    const floatingLabels = document.getElementById('timeline-floating-labels');

    const translation = `translateX(${-TixupState.panOffset}px)`;
    if (daysHeader) { daysHeader.style.position = 'absolute'; daysHeader.style.bottom = '0'; daysHeader.style.transform = translation; }
    if (gridBack) { gridBack.style.position = 'absolute'; gridBack.style.transform = translation; }
    if (tBody) tBody.style.transform = translation;
    if (floatingLabels) floatingLabels.style.transform = translation;

    if (todayIndicator) {
        todayIndicator.style.transform = translation;
        todayIndicator.style.left = `${UI_CONSTANTS.CENTER_PX}px`;
        todayIndicator.style.display = 'block';
        todayIndicator.style.zIndex = '5';
    }

    if (startDayOffset === TixupState.lastRenderedStartDay) {
        updateFloatingMonthLabels(floatingLabels, startDayOffset, endDayOffset, absoluteScrollLeft);
        return;
    }
    TixupState.lastRenderedStartDay = startDayOffset;

    if (!daysHeader || !gridBack) return;

    let daysHtml = '';
    let gridHtml = '';
    const cw = TixupState.currentCellWidth;

    if (cw >= 30) {
        for (let i = startDayOffset; i <= endDayOffset; i++) {
            const date = new Date(BASE_EPOCH);
            date.setDate(date.getDate() + i);
            const leftPos = UI_CONSTANTS.CENTER_PX + (i * cw);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            daysHtml += `<div class="timeline-day-cell ${i === 0 ? 'today-marker' : ''}" style="position:absolute;left:${leftPos}px;top:0;width:${cw}px;${isWeekend ? 'color:var(--primitive-colors-gray-400);' : ''}">${date.getDate()}</div>`;
            gridHtml += `<div class="timeline-grid-line ${isWeekend ? 'is-weekend' : ''}" style="position:absolute;left:${leftPos}px;top:0;bottom:0;width:${cw}px;border-right:1px solid var(--primitive-colors-gray-100);"></div>`;
        }
    } else if (cw > 10) {
        for (let i = startDayOffset; i <= endDayOffset; i++) {
            const date = new Date(BASE_EPOCH);
            date.setDate(date.getDate() + i);
            if (date.getDay() === 1) {
                const leftPos = UI_CONSTANTS.CENTER_PX + (i * cw);
                const weekStr = (date.getMonth() + 1) + '/' + date.getDate();
                daysHtml += `<div class="timeline-day-cell" style="position:absolute;left:${leftPos}px;top:0;width:${cw * 7}px;font-size:11px;justify-content:flex-start;padding-left:4px;">${weekStr}</div>`;
                gridHtml += `<div class="timeline-grid-line" style="position:absolute;left:${leftPos}px;top:0;bottom:0;width:${cw * 7}px;border-left:1px solid var(--primitive-colors-gray-200);opacity:0.5;"></div>`;
            }
        }
    } else {
        for (let i = startDayOffset; i <= endDayOffset; i++) {
            const date = new Date(BASE_EPOCH);
            date.setDate(date.getDate() + i);
            if (date.getDate() === 1) {
                const leftPos = UI_CONSTANTS.CENTER_PX + (i * cw);
                gridHtml += `<div class="timeline-grid-line" style="position:absolute;left:${leftPos}px;top:0;bottom:0;width:${cw * 30}px;border-left:1px solid var(--primitive-colors-gray-300);"></div>`;
            }
        }
    }

    daysHeader.innerHTML = daysHtml;
    gridBack.innerHTML = gridHtml;

    updateFloatingMonthLabels(floatingLabels, startDayOffset, endDayOffset, absoluteScrollLeft);
}

function updateFloatingMonthLabels(container, startOffset, endOffset, absoluteScrollLeft) {
    if (!container) return;

    const startDate = new Date(BASE_EPOCH);
    startDate.setDate(startDate.getDate() + startOffset);
    const endDate = new Date(BASE_EPOCH);
    endDate.setDate(endDate.getDate() + endOffset);

    const months = [];
    let iterDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (iterDate <= endDate) {
        const dayOffset = Math.round((iterDate.getTime() - BASE_EPOCH.getTime()) / 86400000);
        const startPx = UI_CONSTANTS.CENTER_PX + (dayOffset * TixupState.currentCellWidth);
        const nextMonth = new Date(iterDate.getFullYear(), iterDate.getMonth() + 1, 1);
        months.push({ label: `${iterDate.getMonth() + 1}월`, start: startPx });
        iterDate = nextMonth;
    }

    container.innerHTML = months.map(m => `<div class="timeline-month-label-floating" style="left:${m.start}px;width:100px;">${m.label}</div>`).join('');
}

function initTimelineNav(viewport) {
    const goTodayBtn = document.getElementById('go-today-btn');
    const headerGoTodayBtn = document.getElementById('go-today-btn-header');
    const navPrevBtn = document.getElementById('nav-prev-2w');
    const navNextBtn = document.getElementById('nav-next-2w');

    const animateScroll = (targetX) => {
        const startX = viewport.scrollLeft;
        const distance = targetX - startX;
        const duration = 500;
        let startTime = null;
        const easing = (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;
        const step = (now) => {
            if (!startTime) startTime = now;
            const progress = Math.min((now - startTime) / duration, 1);
            viewport.scrollLeft = startX + distance * easing(progress);
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    };

    const scrollToday = () => {
        const exactTarget = UI_CONSTANTS.CENTER_PX - TixupState.panOffset - (viewport.clientWidth / 2) + 24;
        const distance = Math.abs(exactTarget - viewport.scrollLeft);
        if (exactTarget > 5000 && exactTarget < (UI_CONSTANTS.VIRTUAL_WIDTH - 5000) && distance < 15000) {
            animateScroll(exactTarget);
        } else {
            TixupState.panOffset = UI_CONSTANTS.CENTER_PX - (UI_CONSTANTS.VIRTUAL_WIDTH / 2);
            viewport.scrollLeft = (UI_CONSTANTS.VIRTUAL_WIDTH / 2) - (viewport.clientWidth / 2) + 24;
            renderTimelineHeader();
            renderAll();
        }
    };

    if (goTodayBtn) goTodayBtn.addEventListener('click', scrollToday);
    if (headerGoTodayBtn) headerGoTodayBtn.addEventListener('click', scrollToday);
    if (navPrevBtn) navPrevBtn.addEventListener('click', () => animateScroll(viewport.scrollLeft - 14 * TixupState.currentCellWidth));
    if (navNextBtn) navNextBtn.addEventListener('click', () => animateScroll(viewport.scrollLeft + 14 * TixupState.currentCellWidth));

    viewport.addEventListener('scroll', () => window.requestAnimationFrame(renderTimelineHeader), { passive: true });
}

function initZoomControl(viewport) {
    const zoomRange = document.getElementById('timeline-zoom-range');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');

    const updateZoom = (val, focalX = null) => {
        let newVal = Math.max(4, Math.min(150, parseFloat(val)));
        if (Math.abs(newVal - TixupState.currentCellWidth) < 0.01) return;

        const targetFocalX = focalX !== null ? focalX : (viewport.clientWidth / 2);
        const focalAbsoluteX = viewport.scrollLeft + TixupState.panOffset + targetFocalX;
        const centerDateOffset = (focalAbsoluteX - UI_CONSTANTS.CENTER_PX) / TixupState.currentCellWidth;

        TixupState.currentCellWidth = newVal;
        localStorage.setItem('tixup_zoom', newVal);
        if (zoomRange) zoomRange.value = newVal;
        if (window.tixupCore) window.tixupCore.gridSize = newVal;

        const newFocalAbsoluteX = UI_CONSTANTS.CENTER_PX + (centerDateOffset * TixupState.currentCellWidth);
        viewport.scrollLeft = newFocalAbsoluteX - TixupState.panOffset - targetFocalX;

        renderAll();
        renderTimelineHeader();
    };

    if (zoomRange) zoomRange.addEventListener('input', (e) => updateZoom(e.target.value));
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => updateZoom(TixupState.currentCellWidth * 1.2));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => updateZoom(TixupState.currentCellWidth / 1.2));

    viewport.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const rect = viewport.getBoundingClientRect();
            updateZoom(TixupState.currentCellWidth * (e.deltaY > 0 ? 0.95 : 1.05), e.clientX - rect.left);
        }
    }, { passive: false });
}
