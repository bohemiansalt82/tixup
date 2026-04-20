function initTimelineDragging() {
    if (initTimelineDragging._done) return;
    initTimelineDragging._done = true;

    const tbody = document.getElementById('timeline-tbody');
    if (!tbody) return;

    tbody.addEventListener('mousedown', (e) => {
        const resizer = e.target.closest('.timeline-bar-resizer');
        const bar = e.target.closest('.timeline-bar');

        if (resizer) {
            e.stopImmediatePropagation();
            const side = resizer.classList.contains('resizer-left') ? 'left' : 'right';
            const id = bar.parentElement.getAttribute('data-group');
            if (!TixupState.timelineSelectedIds.has(id)) {
                if (!e.shiftKey && !e.metaKey && !e.ctrlKey) TixupState.timelineSelectedIds.clear();
                TixupState.timelineSelectedIds.add(id);
                syncTimelineSelectionUI();
            }
            startResize(e, side);
            return;
        }

        document.documentElement.classList.add('dragging-active');
        document.body.classList.add('dragging-active');

        if (!bar) {
            e.stopImmediatePropagation();
            if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
                TixupState.timelineSelectedIds.clear();
                deselectAll();
                syncTimelineSelectionUI();
            }
            document.documentElement.classList.remove('dragging-active');
            document.body.classList.remove('dragging-active');
            return;
        }

        e.stopImmediatePropagation();
        const id = bar.parentElement.getAttribute('data-group');
        const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;

        if (isMulti) {
            if (TixupState.timelineSelectedIds.has(id)) TixupState.timelineSelectedIds.delete(id);
            else TixupState.timelineSelectedIds.add(id);
        } else {
            if (!TixupState.timelineSelectedIds.has(id)) {
                TixupState.timelineSelectedIds.clear();
                TixupState.timelineSelectedIds.add(id);
            }
        }

        syncTimelineSelectionUI();
        startDrag(e);
    }, true);
}

// AbortController로 드래그 중에만 window 리스너 활성화
function _attachDragListeners() {
    const ac = new AbortController();
    const { signal } = ac;

    window.addEventListener('mousemove', (e) => {
        if (!TixupState.isDragging && !TixupState.isResizing) return;
        if (window.getSelection) window.getSelection().removeAllRanges();

        let deltaX = e.clientX - TixupState.dragStartX;

        if (TixupState.isDragging) {
            TixupState.initialPositions.forEach((startPos, id) => {
                const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
                if (bar) bar.style.left = `${startPos + deltaX}px`;
            });
        } else if (TixupState.isResizing) {
            let allowedDeltaX = deltaX;
            TixupState.initialWidths.forEach((startWidth) => {
                if (TixupState.resizeSide === 'right' && startWidth + deltaX < TixupState.currentCellWidth) {
                    allowedDeltaX = Math.min(allowedDeltaX, TixupState.currentCellWidth - startWidth);
                } else if (TixupState.resizeSide === 'left' && startWidth - deltaX < TixupState.currentCellWidth) {
                    allowedDeltaX = Math.max(allowedDeltaX, startWidth - TixupState.currentCellWidth);
                }
            });
            deltaX = allowedDeltaX;

            TixupState.initialPositions.forEach((startPos, id) => {
                const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
                const startWidth = TixupState.initialWidths.get(id);
                if (!bar || !startWidth) return;
                if (TixupState.resizeSide === 'right') {
                    bar.style.width = `${Math.max(TixupState.currentCellWidth, startWidth + deltaX)}px`;
                } else {
                    bar.style.left = `${startPos + deltaX}px`;
                    bar.style.width = `${Math.max(TixupState.currentCellWidth, startWidth - deltaX)}px`;
                }
            });
        }
    }, { signal });

    window.addEventListener('mouseup', () => {
        if (!TixupState.isDragging && !TixupState.isResizing) return;

        TixupState.isDragging = false;
        TixupState.isResizing = false;

        // Snap to grid
        TixupState.initialPositions.forEach((_, id) => {
            const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
            if (bar) {
                let finalLeft = parseSafePx(bar.style.left, UI_CONSTANTS.CENTER_PX);
                finalLeft = UI_CONSTANTS.CENTER_PX + Math.round((finalLeft - UI_CONSTANTS.CENTER_PX) / TixupState.currentCellWidth) * TixupState.currentCellWidth;
                bar.style.left = `${finalLeft}px`;

                let finalWidth = parseSafePx(bar.style.width, TixupState.currentCellWidth);
                finalWidth = Math.max(TixupState.currentCellWidth, Math.round(finalWidth / TixupState.currentCellWidth) * TixupState.currentCellWidth);
                bar.style.width = `${finalWidth}px`;

                bar.classList.remove('is-dragging');
            }
        });

        saveData();
        TixupState.initialPositions.clear();
        TixupState.initialWidths.clear();
        document.body.style.cursor = '';
        document.documentElement.classList.remove('dragging-active');
        document.body.classList.remove('dragging-active');

        // 드래그 종료 후 window 리스너 즉시 제거
        ac.abort();
    }, { signal });

    return ac;
}

function startResize(e, side) {
    TixupState.isResizing = true;
    TixupState.resizeSide = side;
    TixupState.dragStartX = e.clientX;
    TixupState.initialPositions.clear();
    TixupState.initialWidths.clear();

    TixupState.timelineSelectedIds.forEach(id => {
        const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
        if (bar) {
            TixupState.initialPositions.set(id, parseSafePx(bar.style.left, UI_CONSTANTS.CENTER_PX));
            TixupState.initialWidths.set(id, parseSafePx(bar.style.width, 48));
            bar.classList.add('is-dragging');
        }
    });

    document.body.style.cursor = 'ew-resize';
    document.documentElement.classList.add('dragging-active');
    document.body.classList.add('dragging-active');
    _attachDragListeners();
}

function syncTimelineSelectionUI() {
    document.querySelectorAll('.timeline-bar').forEach(bar => {
        const id = bar.parentElement.getAttribute('data-group');
        bar.classList.toggle('selected', TixupState.timelineSelectedIds.has(id));
    });
}

function startDrag(e) {
    TixupState.isDragging = true;
    TixupState.dragStartX = e.clientX;
    TixupState.initialPositions.clear();
    TixupState.initialWidths.clear();

    const dragSet = new Set(TixupState.timelineSelectedIds);
    TixupState.timelineSelectedIds.forEach(id => {
        const row = document.querySelector(`#timeline-tbody [data-group="${id}"]`);
        if (row && (row.getAttribute('data-type') === 'parent' || !row.getAttribute('data-parent'))) {
            document.querySelectorAll(`#timeline-tbody [data-parent="${id}"]`).forEach(childRow => {
                dragSet.add(childRow.getAttribute('data-group'));
            });
        }
    });

    dragSet.forEach(id => {
        const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
        if (bar) {
            TixupState.initialPositions.set(id, parseSafePx(bar.style.left, UI_CONSTANTS.CENTER_PX));
            TixupState.initialWidths.set(id, parseSafePx(bar.style.width, TixupState.currentCellWidth));
            bar.classList.add('is-dragging');
        }
    });

    document.body.style.cursor = 'grabbing';
    document.documentElement.classList.add('dragging-active');
    document.body.classList.add('dragging-active');
    _attachDragListeners();
}
