const SPACE_COLORS = ['#6C5CE7', '#00B894', '#E17055', '#0984E3', '#FDCB6E', '#E84393', '#00CEC9', '#D63031', '#636E72', '#2D3436'];
const UI_CONSTANTS = { CELL_WIDTH: 48, VIRTUAL_WIDTH: 35000, CENTER_PX: 1000000 };

const BASE_EPOCH = new Date();
BASE_EPOCH.setHours(0, 0, 0, 0);

window.TixupState = {
    tasks: [],
    currentCellWidth: UI_CONSTANTS.CELL_WIDTH,
    panOffset: UI_CONSTANTS.CENTER_PX - (UI_CONSTANTS.VIRTUAL_WIDTH / 2),
    currentContextMenuId: null,
    isDragging: false,
    isResizing: false,
    resizeSide: null,
    dragStartX: 0,
    initialPositions: new Map(),
    initialWidths: new Map(),
    timelineSelectedIds: new Set(),
    spaceContextMenu: null,
    spaceContextTargetId: null,
    lastRenderedStartDay: null,
};
