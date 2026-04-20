function initSelection() {
    if (initSelection._done) return;
    initSelection._done = true;
    const bulkDeleteBtn = document.getElementById('bulk-delete');
    const bulkStatusBtn = document.getElementById('bulk-status');
    const bulkEditBtn = document.getElementById('bulk-edit');

    // Header "Select All" checkboxes
    document.querySelectorAll('.data-grid-header input[type="checkbox"]').forEach(headerCheckbox => {
        headerCheckbox.addEventListener('change', (e) => {
            const container = e.target.closest('.timeline-grid-container') || e.target.closest('.data-grid-container');
            if (!container) return;
            container.querySelectorAll('#grid-tbody input[type="checkbox"], #full-grid-tbody input[type="checkbox"]').forEach(cb => {
                cb.checked = e.target.checked;
            });
            updateSelectionBar();
        });
    });

    // Row checkbox changes (delegated)
    document.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' && (e.target.closest('#grid-tbody') || e.target.closest('#full-grid-tbody'))) {
            const row = e.target.closest('.data-grid-row');
            if (row) {
                const groupId = row.getAttribute('data-group');
                document.querySelectorAll(`[data-group="${groupId}"] input[type="checkbox"]`).forEach(cb => {
                    cb.checked = e.target.checked;
                });
            }
            updateSelectionBar();
            syncTimelineSelectionUI();
        }
    });

    if (bulkDeleteBtn) {
        bulkDeleteBtn.onclick = () => {
            const selectedIds = getSelectedIds();
            if (selectedIds.length === 0) return;
            const idsToRemove = [...selectedIds];
            selectedIds.forEach(id => {
                document.querySelectorAll(`[data-parent="${id}"]`).forEach(el => idsToRemove.push(el.getAttribute('data-group')));
            });
            animateAndRemove([...new Set(idsToRemove)], () => {
                updateSelectionBar();
                saveData();
            });
        };
    }

    if (bulkStatusBtn) {
        bulkStatusBtn.onclick = (e) => {
            const selectedIds = getSelectedIds();
            if (selectedIds.length === 0) return;
            const statusMenu = document.getElementById('status-menu');
            statusMenu.style.display = 'block';
            const rect = bulkStatusBtn.getBoundingClientRect();
            statusMenu.style.left = (window.scrollX + rect.left) + 'px';
            statusMenu.style.top = (window.scrollY + rect.top - statusMenu.offsetHeight - 8) + 'px';
            statusMenu.setAttribute('data-bulk-ids', selectedIds.join(','));
            statusMenu.removeAttribute('data-row-id');
            e.stopPropagation();
        };
    }

    if (bulkEditBtn) {
        bulkEditBtn.onclick = () => alert('Bulk edit is not implemented yet.');
    }
}

function getSelectedIds() {
    return Array.from(document.querySelectorAll('#grid-tbody .data-grid-row input[type="checkbox"]:checked'))
        .map(cb => cb.closest('.data-grid-row').getAttribute('data-group'));
}

function updateSelectionBar() {
    const fb = document.getElementById('floating-selection-bar');
    const fbCount = document.getElementById('selection-count');
    const selectedIds = getSelectedIds();
    const count = selectedIds.length;

    if (fbCount) fbCount.innerText = count;
    if (fb) {
        if (count > 0) fb.classList.add('active');
        else fb.classList.remove('active');
    }

    document.querySelectorAll('.data-grid-header input[type="checkbox"]').forEach(headerCheckbox => {
        const container = headerCheckbox.closest('.timeline-grid-container') || headerCheckbox.closest('.data-grid-container');
        if (!container) return;
        const allCbs = Array.from(container.querySelectorAll('#grid-tbody input[type="checkbox"], #full-grid-tbody input[type="checkbox"]'));
        const checkedCbs = allCbs.filter(cb => cb.checked);
        headerCheckbox.checked = allCbs.length > 0 && checkedCbs.length === allCbs.length;
        headerCheckbox.indeterminate = checkedCbs.length > 0 && checkedCbs.length < allCbs.length;
    });
}

function toggleRowSelection(id, forceValue) {
    document.querySelectorAll(`[data-group="${id}"] input[type="checkbox"]`).forEach(cb => {
        cb.checked = forceValue !== undefined ? forceValue : !cb.checked;
    });
    updateSelectionBar();
}

function deselectAll() {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateSelectionBar();
}
