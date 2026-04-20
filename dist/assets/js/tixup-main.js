document.addEventListener('DOMContentLoaded', () => {
    if (typeof TixupAuth !== 'undefined' && !TixupAuth.getUser()) {
        window.location.href = 'login.html';
        return;
    }

    if (typeof TixupAuth !== 'undefined' && TixupAuth.migrateOldData) {
        TixupAuth.migrateOldData();
    }

    // Restore zoom level
    const savedZoom = localStorage.getItem('tixup_zoom');
    if (savedZoom) {
        TixupState.currentCellWidth = parseFloat(savedZoom);
        if (window.tixupCore) window.tixupCore.gridSize = TixupState.currentCellWidth;
    }

    // Load tasks for active space
    const saved = localStorage.getItem(getStorageKey());
    TixupState.tasks = saved ? JSON.parse(saved) : [];

    // Detect and fix corrupted coordinates (old format)
    if (TixupState.tasks.length > 0 && TixupState.tasks.some(t => t.start < 300000)) {
        TixupState.tasks.forEach(t => { if (t.start < 300000) t.start = UI_CONSTANTS.CENTER_PX + 48; });
        saveData();
    }

    // Set timeline virtual width
    const gridContent = document.querySelector('.timeline-grid-content');
    if (gridContent) gridContent.style.width = UI_CONSTANTS.VIRTUAL_WIDTH + 'px';

    // Initialize all modules
    renderSpaceList();
    renderUserProfile();
    initSpaceEvents();

    renderTimelineHeader();
    initFilters();
    initViewToggle();
    initSelection();
    initTaskCrudEvents();
    initTimelineDragging();

    const viewport = document.querySelector('.timeline-view-viewport');
    if (viewport) {
        initTimelineNav(viewport);
        initZoomControl(viewport);
    }

    renderAll();
});
