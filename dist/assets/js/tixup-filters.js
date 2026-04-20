function initFilters() {
    if (initFilters._done) return;
    initFilters._done = true;
    const filterTabs = document.querySelectorAll('.grid-filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const targetStatus = e.target.innerText.trim().toLowerCase();
            filterTabs.forEach(t => {
                if (t.innerText.trim().toLowerCase() === targetStatus) t.classList.add('active');
                else t.classList.remove('active');
            });
            applyStatusFilter(targetStatus);
        });
    });
}

function applyStatusFilter(filterStatus) {
    document.querySelectorAll('.data-grid-row, .timeline-row').forEach(row => {
        if (row.classList.contains('data-grid-header') || row.classList.contains('data-grid-footer')) return;
        const rowStatus = (row.getAttribute('data-status') || '').trim().toLowerCase();
        if (filterStatus === 'all') {
            row.style.setProperty('display', '', 'important');
        } else {
            row.style.setProperty('display', rowStatus === filterStatus ? '' : 'none', 'important');
        }
    });
}
