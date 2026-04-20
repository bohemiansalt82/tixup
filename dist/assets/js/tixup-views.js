function setView(viewType) {
    const listIcon = document.querySelector('.icon-list');
    const clockIcon = document.querySelector('.icon-clock');
    if (!listIcon || !clockIcon) return;

    const listBtn = listIcon.parentElement;
    const clockBtn = clockIcon.parentElement;
    const timelineContainer = document.getElementById('data-grid-timeline');
    const fullGridContainer = document.getElementById('full-data-grid');
    if (!listBtn || !clockBtn || !timelineContainer || !fullGridContainer) return;

    if (viewType === 'list') {
        timelineContainer.style.setProperty('display', 'none', 'important');
        fullGridContainer.style.setProperty('display', 'flex', 'important');
        listBtn.classList.add('selected');
        clockBtn.classList.remove('selected');
    } else {
        timelineContainer.style.setProperty('display', 'flex', 'important');
        fullGridContainer.style.setProperty('display', 'none', 'important');
        clockBtn.classList.add('selected');
        listBtn.classList.remove('selected');

        if (!window.__tixupScrollInitialized) {
            const viewport = document.querySelector('.timeline-view-viewport');
            if (viewport) {
                viewport.scrollLeft = (UI_CONSTANTS.VIRTUAL_WIDTH / 2) - (viewport.clientWidth / 2) + 24;
                window.__tixupScrollInitialized = true;
                renderAll();
            }
        }
    }
}

function initViewToggle() {
    if (initViewToggle._done) return;
    initViewToggle._done = true;
    const listIcon = document.querySelector('.icon-list');
    const clockIcon = document.querySelector('.icon-clock');
    if (!listIcon || !clockIcon) return;

    listIcon.parentElement.onclick = () => setView('list');
    clockIcon.parentElement.onclick = () => setView('timeline');

    setView('list');
}
