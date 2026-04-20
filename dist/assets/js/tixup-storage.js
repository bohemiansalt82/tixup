function getStorageKey() {
    if (typeof TixupAuth === 'undefined') return 'tixup_master_v1';
    const spaceId = TixupAuth.getActiveSpaceId();
    return spaceId ? TixupAuth.getTasksKey(spaceId) : 'tixup_master_v1';
}

function parseSafePx(pxStr, defaultVal = 0) {
    if (!pxStr) return defaultVal;
    const val = parseFloat(pxStr);
    return isNaN(val) ? defaultVal : val;
}

function getDateFromPx(px) {
    const daysOffset = Math.floor((px - UI_CONSTANTS.CENTER_PX) / TixupState.currentCellWidth);
    const d = new Date(BASE_EPOCH);
    d.setDate(d.getDate() + daysOffset);
    return d;
}

function saveData() {
    const res = [];
    document.querySelectorAll('#grid-tbody .data-grid-row').forEach(row => {
        const id = row.getAttribute('data-group');
        const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
        if (!bar) return;
        const fRow = document.querySelector(`#full-grid-tbody [data-group="${id}"]`);

        const visualLeft = parseSafePx(bar.style.left, UI_CONSTANTS.CENTER_PX);
        const dayOffset = (visualLeft - UI_CONSTANTS.CENTER_PX) / TixupState.currentCellWidth;
        const normalizedStart = UI_CONSTANTS.CENTER_PX + (dayOffset * 48);

        const visualWidth = parseSafePx(bar.style.width, TixupState.currentCellWidth);
        const normalizedWidth = visualWidth * (48 / TixupState.currentCellWidth);

        res.push({
            id,
            title: row.querySelector('.data-grid-text')?.textContent || '',
            status: row.querySelector('.marker')?.classList[2]?.replace('marker-', '') || 'pending',
            type: row.getAttribute('data-type'),
            parentId: row.getAttribute('data-parent') || undefined,
            start: normalizedStart,
            width: normalizedWidth,
            assignee: fRow?.querySelector('.data-grid-text-sm')?.textContent || 'Unassigned',
            dueDate: fRow?.querySelectorAll('.data-grid-text-sm')[1]?.textContent || '2025-08-09',
            tag: fRow?.querySelector('.grid-tag')?.textContent || 'Design',
            collapsed: row.classList.contains('collapsed')
        });
    });

    TixupState.tasks = res;
    localStorage.setItem(getStorageKey(), JSON.stringify(res));
    if (window.tixupCore) window.tixupCore.syncTimelineOrder();
}

window.tixupSaveData = saveData;
