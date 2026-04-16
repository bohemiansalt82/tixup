document.addEventListener('DOMContentLoaded', () => {
    // Auth guard - redirect to login if not authenticated
    if (typeof TixupAuth !== 'undefined' && !TixupAuth.getUser()) {
        window.location.href = 'login.html';
        return;
    }

    const SPACE_COLORS = ['#6C5CE7', '#00B894', '#E17055', '#0984E3', '#FDCB6E', '#E84393', '#00CEC9', '#D63031', '#636E72', '#2D3436'];

    function getStorageKey() {
        if (typeof TixupAuth === 'undefined') return 'tixup_master_v1';
        const spaceId = TixupAuth.getActiveSpaceId();
        return spaceId ? TixupAuth.getTasksKey(spaceId) : 'tixup_master_v1';
    }

    let tasks = [];
    let currentContextMenuId = null;

    const UI_CONSTANTS = { CELL_WIDTH: 48, VIRTUAL_WIDTH: 35000, CENTER_PX: 1000000 };
    let currentCellWidth = UI_CONSTANTS.CELL_WIDTH;
    let panOffset = 1000000 - (35000 / 2); // Explicitly lock to center point

    // Robust parsing for coordinates that might be in scientific notation (e.g. 1.00048e+06px)
    function parseSafePx(pxStr, defaultVal = 0) {
        if (!pxStr) return defaultVal;
        const val = parseFloat(pxStr);
        return isNaN(val) ? defaultVal : val;
    }

    const BASE_EPOCH = new Date();
    BASE_EPOCH.setHours(0, 0, 0, 0);

    function getDateFromPx(px) {
        const daysOffset = Math.floor((px - UI_CONSTANTS.CENTER_PX) / currentCellWidth);
        const d = new Date(BASE_EPOCH);
        d.setDate(d.getDate() + daysOffset);
        return d;
    }

    // DOM Element Caching
    const gB = document.getElementById('grid-tbody');
    const fGB = document.getElementById('full-grid-tbody');
    const tB = document.getElementById('timeline-tbody');
    const fb = document.getElementById('floating-selection-bar');
    const fbCount = document.getElementById('selection-count');
    const bulkDeleteBtn = document.getElementById('bulk-delete');
    const bulkStatusBtn = document.getElementById('bulk-status');
    const bulkEditBtn = document.getElementById('bulk-edit');
    const contextMenu = document.getElementById('context-menu');
    const statusMenu = document.getElementById('status-menu');
    const deleteTixBtn = document.getElementById('delete-tix');

    // Timeline-specific Selection State (strictly for movement)
    let timelineSelectedIds = new Set();

    // Double click detection state for capturing phase
    let lastClickTime = 0;
    let lastClickX = 0;
    let lastClickY = 0;
    // ─── Space System ───
    let spaceContextMenu = null;
    let spaceContextTargetId = null;

    function renderSpaceList() {
        const spaceList = document.getElementById('space-list');
        if (!spaceList || typeof TixupAuth === 'undefined') return;

        const spaces = TixupAuth.getSpaces();
        const activeId = TixupAuth.getActiveSpaceId();

        spaceList.innerHTML = '';
        spaces.forEach((space, idx) => {
            const color = SPACE_COLORS[idx % SPACE_COLORS.length];
            const initial = (space.name || 'S').charAt(0).toUpperCase();
            const isActive = space.id === activeId;

            const item = document.createElement('div');
            item.className = `space-item ${isActive ? 'active' : ''}`;
            item.setAttribute('data-space-id', space.id);
            item.innerHTML = `
                <div class="space-item-icon-container">
                    <img src="assets/images/icons/deployed_code.svg" class="space-deployed-icon">
                </div>
                <div class="space-item-label">${space.name}</div>
                <button class="space-item-more" title="More">
                    <span class="material-icons-outlined" style="font-size: 16px; color: #999;">more_horiz</span>
                </button>
            `;

            // Click to switch space
            item.addEventListener('click', (e) => {
                if (e.target.closest('.space-item-more')) return;
                switchSpace(space.id);
            });

            // More button → context menu
            item.querySelector('.space-item-more').addEventListener('click', (e) => {
                e.stopPropagation();
                showSpaceContextMenu(e, space.id);
            });

            spaceList.appendChild(item);
        });

        // Update location title to active space name
        const activeSpace = spaces.find(s => s.id === activeId);
        const locationTitle = document.querySelector('.location-title');
        if (locationTitle && activeSpace) {
            locationTitle.textContent = activeSpace.name;
        }
    }

    function renderUserProfile() {
        const profileEl = document.getElementById('nav-user-profile');
        if (!profileEl || typeof TixupAuth === 'undefined') return;

        const user = TixupAuth.getUser();
        if (!user) return;

        profileEl.innerHTML = `
            <img class="nav-user-avatar" src="${user.picture}" alt="${user.name}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6C5CE7&color=fff'">
            <div class="nav-user-info">
                <div class="nav-user-name">${user.name}</div>
                <div class="nav-user-email">${user.email}</div>
            </div>
            <button class="nav-logout-btn" title="Sign Out">
                <span class="material-icons-outlined" style="font-size: 18px; color: #999;">logout</span>
            </button>
        `;

        profileEl.querySelector('.nav-logout-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Sign out?')) TixupAuth.logout();
        });
    }

    function initSpaceEvents() {
        // Add space button
        const addBtn = document.getElementById('add-space-btn');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showSpaceCreateInput();
            });
        }

        // Create context menu element (once)
        if (!spaceContextMenu) {
            spaceContextMenu = document.createElement('div');
            spaceContextMenu.className = 'space-context-menu';
            spaceContextMenu.innerHTML = `
                <div class="space-context-menu-item" data-action="rename">
                    <span class="material-icons-outlined">edit</span> Rename
                </div>
                <div class="space-context-menu-item danger" data-action="delete">
                    <span class="material-icons-outlined">delete</span> Delete
                </div>
            `;
            document.body.appendChild(spaceContextMenu);

            spaceContextMenu.addEventListener('click', (e) => {
                const action = e.target.closest('.space-context-menu-item')?.getAttribute('data-action');
                if (!action || !spaceContextTargetId) return;

                if (action === 'rename') {
                    const newName = prompt('Space name:');
                    if (newName && newName.trim()) {
                        TixupAuth.renameSpace(spaceContextTargetId, newName.trim());
                        renderSpaceList();
                    }
                } else if (action === 'delete') {
                    const spaces = TixupAuth.getSpaces();
                    if (spaces.length <= 1) {
                        alert('You must have at least one space.');
                        return;
                    }
                    if (confirm('Delete this space and all its data?')) {
                        const isActive = spaceContextTargetId === TixupAuth.getActiveSpaceId();
                        TixupAuth.deleteSpace(spaceContextTargetId);
                        if (isActive) {
                            const remaining = TixupAuth.getSpaces();
                            switchSpace(remaining[0].id);
                        }
                        renderSpaceList();
                    }
                }
                spaceContextMenu.style.display = 'none';
            });

            document.addEventListener('click', () => {
                if (spaceContextMenu) spaceContextMenu.style.display = 'none';
            });
        }
    }

    function showSpaceContextMenu(e, spaceId) {
        spaceContextTargetId = spaceId;
        const rect = e.target.closest('.space-item-more').getBoundingClientRect();
        spaceContextMenu.style.display = 'block';
        spaceContextMenu.style.left = `${rect.right + 4}px`;
        spaceContextMenu.style.top = `${rect.top}px`;
    }

    function showSpaceCreateInput() {
        const spaceList = document.getElementById('space-list');
        if (!spaceList) return;

        // Remove existing input if any and prevent its finish() from running
        const existing = spaceList.querySelector('.space-create-wrapper');
        if (existing) {
            const existingInput = existing.querySelector('input');
            if (existingInput && existingInput._finish) {
                existingInput._finish(true); // Call with cancel=true
            }
            existing.remove();
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'space-create-wrapper space-item';
        wrapper.innerHTML = `
            <div class="space-item-icon" style="background: ${SPACE_COLORS[TixupAuth.getSpaces().length % SPACE_COLORS.length]}">
                <span class="material-icons-outlined" style="font-size: 14px;">add</span>
            </div>
            <input type="text" class="space-create-input" placeholder="Space name..." style="padding-left: 8px;">
        `;
        spaceList.appendChild(wrapper);

        const input = wrapper.querySelector('input');
        input.focus();

        let done = false;
        const finish = (cancel = false) => {
            if (done) return;
            done = true;
            const name = input.value.trim();
            wrapper.remove();
            if (!cancel && name) {
                const space = TixupAuth.createSpace(name);
                switchSpace(space.id);
            }
        };
        input._finish = finish; // Store for cancellation

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finish();
            if (e.key === 'Escape') finish(true);
        });
        input.addEventListener('blur', () => setTimeout(finish, 100));
    }

    function switchSpace(spaceId) {
        // Save current data first
        if (typeof saveData === 'function') {
            try { saveData(); } catch (e) { }
        }

        TixupAuth.setActiveSpaceId(spaceId);

        // Reload tasks for new space
        const saved = localStorage.getItem(getStorageKey());
        tasks = saved ? JSON.parse(saved) : [];

        // Every time we switch space, we reset to Data Grid by default!
        if (typeof setView === 'function') setView('list');
        
        // Fully reset timeline offset coordinates!
        panOffset = UI_CONSTANTS.CENTER_PX - (UI_CONSTANTS.VIRTUAL_WIDTH / 2);
        window.__tixupScrollInitialized = false;

        renderSpaceList();
        renderAll();
    }

    // 1. 초기 로드
    function init() {
        // Render sidebar: spaces + user profile
        renderSpaceList();
        renderUserProfile();
        initSpaceEvents();

        // 1. 초기 데이터 및 상태 로드
        const saved = localStorage.getItem(getStorageKey());
        tasks = saved ? JSON.parse(saved) : [];

        // Restore Zoom Level
        const savedZoom = localStorage.getItem('tixup_zoom');
        if (savedZoom) {
            currentCellWidth = parseFloat(savedZoom);
            if (window.tixupCore) window.tixupCore.gridSize = currentCellWidth;
        }

        // Detect corrupt or extremely outdated data
        let isOldFormat = tasks.length > 0 && tasks.some(t => t.start < 300000);
        if (isOldFormat) {
            console.warn("[Data Recovery] Old format detected. Resetting coordinates.");
            const todayPx = UI_CONSTANTS.CENTER_PX;
            tasks.forEach(t => {
                if (t.start < 300000) t.start = todayPx + 48;
            });
            saveData();
        }

        const gridContent = document.querySelector('.timeline-grid-content');
        if (gridContent) gridContent.style.width = UI_CONSTANTS.VIRTUAL_WIDTH + 'px';

        const viewport = document.querySelector('.timeline-view-viewport');
        if (viewport) {
            // Initialization is now deferred safely to setView() to avoid display:none bugs.
        }

        renderTimelineHeader();
        initFilters();
        initViewToggle();
        initSelection();
        initTimelineDragging();

        const goTodayBtn = document.getElementById('go-today-btn');
        const headerGoTodayBtn = document.getElementById('go-today-btn-header');
        const navPrevBtn = document.getElementById('nav-prev-2w');
        const navNextBtn = document.getElementById('nav-next-2w');

        // Smooth Scroll Helper (easeInOutQuart for premium feel)
        const animateScroll = (targetX) => {
            const startX = viewport.scrollLeft;
            const distance = targetX - startX;
            const duration = 500; // ms
            let startTime = null;

            const easing = (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;

            const step = (currentTime) => {
                if (!startTime) startTime = currentTime;
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                viewport.scrollLeft = startX + (distance * easing(progress));

                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            window.requestAnimationFrame(step);
        };

        const scrollToday = () => {
            // Calculate absolute pixel location for today's date
            const todayAbsPx = UI_CONSTANTS.CENTER_PX;
            
            // Recompute target scroll target based on the current panOffset drift
            const exactTarget = todayAbsPx - panOffset - (viewport.clientWidth / 2) + 24;
            const distance = Math.abs(exactTarget - viewport.scrollLeft);

            // Animate only if within the active virtual frame (safely away from treadmill jumps)
            if (exactTarget > 5000 && exactTarget < (UI_CONSTANTS.VIRTUAL_WIDTH - 5000) && distance < 15000) {
                animateScroll(exactTarget);
            } else {
                // If drifted too far (e.g. 2014), instantly reset everything to origin point
                panOffset = UI_CONSTANTS.CENTER_PX - (UI_CONSTANTS.VIRTUAL_WIDTH / 2);
                viewport.scrollLeft = (UI_CONSTANTS.VIRTUAL_WIDTH / 2) - (viewport.clientWidth / 2) + 24;
                renderTimelineHeader();
                renderAll();
            }
        };

        if (goTodayBtn && viewport) goTodayBtn.addEventListener('click', scrollToday);
        if (headerGoTodayBtn && viewport) headerGoTodayBtn.addEventListener('click', scrollToday);

        if (navPrevBtn && viewport) {
            navPrevBtn.addEventListener('click', () => {
                const target = viewport.scrollLeft - (14 * currentCellWidth);
                animateScroll(target);
            });
        }
        if (navNextBtn && viewport) {
            navNextBtn.addEventListener('click', () => {
                const target = viewport.scrollLeft + (14 * currentCellWidth);
                animateScroll(target);
            });
        }

        renderAll();

        // 줌 컨트롤 로직
        const zoomRange = document.getElementById('timeline-zoom-range');
        const zoomInBtn = document.getElementById('zoom-in-btn');
        const zoomOutBtn = document.getElementById('zoom-out-btn');

        const updateZoom = (val, focalX = null) => {
            // Use parseFloat to support fine-grained zooming and prevent 'sticking' at minimum values
            let newVal = parseFloat(val);
            newVal = Math.max(4, Math.min(150, newVal));

            // Allow small changes for a more 'premium' and fluid feel
            if (Math.abs(newVal - currentCellWidth) < 0.01) return;

            // 줌 기준점 계산 (전달된 focalX가 있으면 마우스 위치, 없으면 Viewport 중앙)
            const targetFocalX = focalX !== null ? focalX : (viewport.clientWidth / 2);
            const focalAbsoluteX = viewport.scrollLeft + panOffset + targetFocalX;
            const centerDateOffset = (focalAbsoluteX - UI_CONSTANTS.CENTER_PX) / currentCellWidth;

            currentCellWidth = newVal;
            localStorage.setItem('tixup_zoom', newVal);
            if (zoomRange) zoomRange.value = newVal;

            // Sync with global core for auto-resize logic
            if (window.tixupCore) window.tixupCore.gridSize = newVal;

            // 줌 이후 기준점이 제자리에 있도록 스크롤 조정
            const newFocalAbsoluteX = UI_CONSTANTS.CENTER_PX + (centerDateOffset * currentCellWidth);
            viewport.scrollLeft = newFocalAbsoluteX - panOffset - targetFocalX;

            renderAll();
            renderTimelineHeader();
        };

        if (zoomRange) {
            zoomRange.addEventListener('input', (e) => updateZoom(e.target.value));
        }
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => updateZoom(currentCellWidth * 1.2));
        }
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => updateZoom(currentCellWidth / 1.2));
        }

        // CMD/CTRL + Wheel 줌 기능 추가
        if (viewport) {
            viewport.addEventListener('wheel', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    // 휠 방향에 따라 줌 레벨 결정 (균형 잡힌 3~5%씩 촘촘하게 변경)
                    const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
                    const rect = viewport.getBoundingClientRect();
                    const focalX = e.clientX - rect.left;
                    updateZoom(currentCellWidth * zoomFactor, focalX);
                }
            }, { passive: false });

            viewport.addEventListener('scroll', () => {
                window.requestAnimationFrame(renderTimelineHeader);
            }, { passive: true });
        }
    }

    let lastRenderedStartDay = null;

    function renderTimelineHeader() {
        const viewport = document.querySelector('.timeline-view-viewport');
        if (!viewport) return;

        // CRITICAL BUGFIX: Never attempt math or treadmill jumps if the timeline is hidden or uninitialized!
        if (viewport.offsetParent === null || !window.__tixupScrollInitialized) return;

        let currentScrollLeft = viewport.scrollLeft;

        // Treadmill Anchoring Loop (Disabled during drag/resize to prevent math artifacts)
        if (!isDragging && !isResizing) {
            const JUMP_MARGIN = 5000;
            const CENTER_SCROLL = UI_CONSTANTS.VIRTUAL_WIDTH / 2;

            if (currentScrollLeft < JUMP_MARGIN) {
                console.log(`[Treadmill] Left Jump triggered. panOffset: ${panOffset} -> ${panOffset - (CENTER_SCROLL - currentScrollLeft)}`);
                const diff = CENTER_SCROLL - currentScrollLeft;
                panOffset -= diff;
                viewport.scrollLeft = CENTER_SCROLL;
                currentScrollLeft = CENTER_SCROLL;
                return; // Let the next scroll event re-trigger rendering cleanly
            } else if (currentScrollLeft > UI_CONSTANTS.VIRTUAL_WIDTH - JUMP_MARGIN) {
                console.log(`[Treadmill] Right Jump triggered. panOffset: ${panOffset} -> ${panOffset + (currentScrollLeft - CENTER_SCROLL)}`);
                const diff = currentScrollLeft - CENTER_SCROLL;
                panOffset += diff;
                viewport.scrollLeft = CENTER_SCROLL;
                currentScrollLeft = CENTER_SCROLL;
                return;
            }
        }

        const absoluteScrollLeft = currentScrollLeft + panOffset;
        const viewportWidth = viewport.clientWidth || window.innerWidth;

        const startVisiblePx = absoluteScrollLeft - (currentCellWidth * 15);
        const endVisiblePx = absoluteScrollLeft + viewportWidth + (currentCellWidth * 15);

        const startDayOffset = Math.floor((startVisiblePx - UI_CONSTANTS.CENTER_PX) / currentCellWidth);
        const endDayOffset = Math.floor((endVisiblePx - UI_CONSTANTS.CENTER_PX) / currentCellWidth);

        const fixedMaster = document.getElementById('timeline-fixed-master');
        if (fixedMaster) {
            const displayDate = getDateFromPx(absoluteScrollLeft + 80); // Anchor near the left edge
            const yearStr = displayDate.getFullYear() + '년';
            const monthStr = (displayDate.getMonth() + 1) + '월';
            fixedMaster.innerText = `${yearStr} ${monthStr}`;
        }

        const daysHeader = document.getElementById('timeline-days-header');
        const gridBack = document.getElementById('timeline-grid-back');
        const tbody = document.getElementById('timeline-tbody');
        const todayIndicator = document.getElementById('timeline-today-indicator');

        const translation = `translateX(${-panOffset}px)`;
        if (daysHeader) { daysHeader.style.position = 'absolute'; daysHeader.style.bottom = '0'; daysHeader.style.transform = translation; }
        if (gridBack) { gridBack.style.position = 'absolute'; gridBack.style.transform = translation; }
        if (tbody) tbody.style.transform = translation;

        const floatingLabels = document.getElementById('timeline-floating-labels');
        if (floatingLabels) {
            floatingLabels.style.transform = translation;
        }

        if (todayIndicator) {
            todayIndicator.style.transform = translation;
            const todayLeft = UI_CONSTANTS.CENTER_PX + (0 * currentCellWidth); // Today is at 0 offset
            todayIndicator.style.left = `${todayLeft}px`;
            todayIndicator.style.display = 'block';
            todayIndicator.style.zIndex = '5';
        }

        if (startDayOffset === lastRenderedStartDay) {
            updateFloatingMonthLabels(floatingLabels, startDayOffset, endDayOffset, absoluteScrollLeft);
            return;
        }
        lastRenderedStartDay = startDayOffset;

        if (!daysHeader || !gridBack) return;

        let daysHtml = '';
        let gridHtml = '';

        // 줌 레벨에 따른 렌더링 전략
        // 1. Day View (Width >= 30)
        // 2. Week View (10 < Width < 30)
        // 3. Month View (Width <= 10)

        if (currentCellWidth >= 30) {
            for (let i = startDayOffset; i <= endDayOffset; i++) {
                const date = new Date(BASE_EPOCH);
                date.setDate(date.getDate() + i);
                const isToday = i === 0;
                const leftPos = UI_CONSTANTS.CENTER_PX + (i * currentCellWidth);
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                daysHtml += `<div class="timeline-day-cell ${isToday ? 'today-marker' : ''}" style="position: absolute; left: ${leftPos}px; top: 0; width: ${currentCellWidth}px; ${isWeekend ? 'color: var(--primitive-colors-gray-400);' : ''}">${date.getDate()}</div>`;
                gridHtml += `<div class="timeline-grid-line ${isWeekend ? 'is-weekend' : ''}" style="position: absolute; left: ${leftPos}px; top: 0; bottom: 0; width:${currentCellWidth}px; border-right: 1px solid var(--primitive-colors-gray-100);"></div>`;
            }
        } else if (currentCellWidth > 10) {
            // Week View: 주차 표시
            for (let i = startDayOffset; i <= endDayOffset; i++) {
                const date = new Date(BASE_EPOCH);
                date.setDate(date.getDate() + i);
                const leftPos = UI_CONSTANTS.CENTER_PX + (i * currentCellWidth);

                // 월요일에만 주차 레이블 표시
                if (date.getDay() === 1) {
                    const weekStr = (date.getMonth() + 1) + '/' + date.getDate();
                    daysHtml += `<div class="timeline-day-cell" style="position: absolute; left: ${leftPos}px; top: 0; width: ${currentCellWidth * 7}px; font-size: 11px; justify-content: flex-start; padding-left: 4px;">${weekStr}</div>`;
                    gridHtml += `<div class="timeline-grid-line" style="position: absolute; left: ${leftPos}px; top: 0; bottom: 0; width:${currentCellWidth * 7}px; border-left: 1px solid var(--primitive-colors-gray-200); opacity: 0.5;"></div>`;
                }
            }
        } else {
            // Month View: 월 경계만 표시
            // (updateFloatingMonthLabels에서 이미 처리되지만, 그리드 라인은 여기서)
            for (let i = startDayOffset; i <= endDayOffset; i++) {
                const date = new Date(BASE_EPOCH);
                date.setDate(date.getDate() + i);
                const leftPos = UI_CONSTANTS.CENTER_PX + (i * currentCellWidth);
                if (date.getDate() === 1) {
                    gridHtml += `<div class="timeline-grid-line" style="position: absolute; left: ${leftPos}px; top: 0; bottom: 0; width:${currentCellWidth * 30}px; border-left: 1px solid var(--primitive-colors-gray-300);"></div>`;
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

        // Find all month boundaries in the visible range
        const months = [];
        let iterDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

        while (iterDate <= endDate) {
            const monthStartMs = iterDate.getTime();
            const dayOffset = Math.round((monthStartMs - BASE_EPOCH.getTime()) / (24 * 60 * 60 * 1000));
            const startPx = UI_CONSTANTS.CENTER_PX + (dayOffset * currentCellWidth);

            // Get end of month
            const nextMonth = new Date(iterDate.getFullYear(), iterDate.getMonth() + 1, 1);
            const nextMonthDayOffset = Math.round((nextMonth.getTime() - BASE_EPOCH.getTime()) / (24 * 60 * 60 * 1000));
            const endPx = UI_CONSTANTS.CENTER_PX + (nextMonthDayOffset * currentCellWidth);

            months.push({
                label: `${iterDate.getMonth() + 1}월`,
                start: startPx,
                end: endPx
            });

            iterDate = nextMonth;
        }

        let floatingHtml = '';
        months.forEach(m => {
            const labelWidth = 100;
            let leftPos = m.start; // Purely absolute grid position

            floatingHtml += `<div class="timeline-month-label-floating" style="left: ${leftPos}px; width: ${labelWidth}px;">${m.label}</div>`;
        });

        container.innerHTML = floatingHtml;
    }

    function initFilters() {
        const filterTabs = document.querySelectorAll('.grid-filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetStatus = e.target.innerText.trim().toLowerCase();

                // Sync all filter tabs
                filterTabs.forEach(t => {
                    if (t.innerText.trim().toLowerCase() === targetStatus) t.classList.add('active');
                    else t.classList.remove('active');
                });

                applyStatusFilter(targetStatus);
            });
        });
    }

    function applyStatusFilter(filterStatus) {
        // Find all rows in all view containers
        const rows = document.querySelectorAll('.data-grid-row, .timeline-row');
        rows.forEach(row => {
            // Skip headers and footers
            if (row.classList.contains('data-grid-header') || row.classList.contains('data-grid-footer')) return;

            const rowStatus = (row.getAttribute('data-status') || '').trim().toLowerCase();
            if (filterStatus === 'all') {
                row.style.setProperty('display', '', 'important');
            } else {
                if (rowStatus === filterStatus) {
                    row.style.setProperty('display', '', 'important');
                } else {
                    row.style.setProperty('display', 'none', 'important');
                }
            }
        });
    }

    function initSelection() {
        // Header Select All
        document.querySelectorAll('.data-grid-header input[type="checkbox"]').forEach(headerCheckbox => {
            headerCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                const container = e.target.closest('.timeline-grid-container') || e.target.closest('.data-grid-container');
                if (!container) return;

                container.querySelectorAll('#grid-tbody input[type="checkbox"], #full-grid-tbody input[type="checkbox"]').forEach(cb => {
                    cb.checked = isChecked;
                });
                updateSelectionBar();
            });
        });

        // Row Checkboxes (via delegation)
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' && (e.target.closest('#grid-tbody') || e.target.closest('#full-grid-tbody'))) {
                // Sync checkboxes for the same group across different views
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

        // Bulk Actions
        bulkDeleteBtn.onclick = () => {
            const selectedIds = getSelectedIds();
            if (selectedIds.length === 0) return;

            const idsToRemove = [...selectedIds];
            selectedIds.forEach(id => {
                document.querySelectorAll(`[data-parent="${id}"]`).forEach(el => {
                    idsToRemove.push(el.getAttribute('data-group'));
                });
            });

            animateAndRemove([...new Set(idsToRemove)], () => {
                updateSelectionBar();
                saveData();
            });
        };

        bulkStatusBtn.onclick = (e) => {
            const selectedIds = getSelectedIds();
            if (selectedIds.length === 0) return;

            statusMenu.style.display = 'block';
            const rect = bulkStatusBtn.getBoundingClientRect();
            statusMenu.style.left = (window.scrollX + rect.left) + 'px';
            statusMenu.style.top = (window.scrollY + rect.top - statusMenu.offsetHeight - 8) + 'px';
            statusMenu.setAttribute('data-bulk-ids', selectedIds.join(','));
            statusMenu.removeAttribute('data-row-id'); // Clear single row ID
            e.stopPropagation();
        };

        bulkEditBtn.onclick = () => {
            alert('Bulk edit is not implemented yet.');
        };
    }

    function getSelectedIds() {
        const checked = Array.from(document.querySelectorAll('#grid-tbody .data-grid-row input[type="checkbox"]:checked'));
        return checked.map(cb => cb.closest('.data-grid-row').getAttribute('data-group'));
    }

    function updateSelectionBar() {
        const selectedIds = getSelectedIds();
        const count = selectedIds.length;

        fbCount.innerText = count;
        if (count > 0) {
            fb.classList.add('active');
        } else {
            fb.classList.remove('active');
        }

        // Update Header Checkbox state
        document.querySelectorAll('.data-grid-header input[type="checkbox"]').forEach(headerCheckbox => {
            const container = headerCheckbox.closest('.timeline-grid-container') || headerCheckbox.closest('.data-grid-container');
            if (!container) return;
            const allCbs = Array.from(container.querySelectorAll('#grid-tbody input[type="checkbox"], #full-grid-tbody input[type="checkbox"]'));
            const checkedCbs = allCbs.filter(cb => cb.checked);

            headerCheckbox.checked = allCbs.length > 0 && checkedCbs.length === allCbs.length;
            headerCheckbox.indeterminate = checkedCbs.length > 0 && checkedCbs.length < allCbs.length;
        });
    }

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

            // Ensure scroll is initialized exactly ONCE when the timeline safely becomes visible
            if (!window.__tixupScrollInitialized) {
                const viewport = document.querySelector('.timeline-view-viewport');
                if (viewport) {
                    const centerTarget = (UI_CONSTANTS.VIRTUAL_WIDTH / 2) - (viewport.clientWidth / 2) + 24;
                    viewport.scrollLeft = centerTarget;
                    window.__tixupScrollInitialized = true;
                    // Force a full clean render now that it's visible and correctly centered
                    if (typeof renderAll === 'function') renderAll();
                }
            }
        }
    }

    function initViewToggle() {
        const listIcon = document.querySelector('.icon-list');
        const clockIcon = document.querySelector('.icon-clock');
        if (!listIcon || !clockIcon) return;

        const listBtn = listIcon.parentElement;
        const clockBtn = clockIcon.parentElement;

        listBtn.onclick = () => setView('list');
        clockBtn.onclick = () => setView('timeline');

        // Set default view to Data Grid (List)
        setView('list');
    }

    function renderAll() {
        const gB = document.getElementById('grid-tbody');
        const fGB = document.getElementById('full-grid-tbody');
        const tB = document.getElementById('timeline-tbody');
        if (!gB || !fGB || !tB) return;
        gB.innerHTML = ''; fGB.innerHTML = ''; tB.innerHTML = '';

        tasks.forEach(t => renderTask(t));

        // Re-initialize Sortable after DOM update
        if (window.tixupCore && typeof window.tixupCore.initSortable === 'function') {
            window.tixupCore.initSortable();
        }
    }

    function renderTask(task, animate = false) {
        const status = (task.status || 'pending').toLowerCase().replace('onhold', 'pause');
        const hasChildren = tasks.some(t => t.parentId === task.id);

        // 1. Sidebar Grid Row
        const gRow = document.createElement('div');
        gRow.className = `data-grid-row ${task.type === 'child' ? 'grid-child-row' : 'level-0'}`;
        if (task.collapsed) gRow.classList.add('collapsed');
        if (animate) gRow.classList.add('tix-anim-enter');
        gRow.setAttribute('data-group', task.id);
        gRow.setAttribute('data-type', task.type);
        gRow.setAttribute('data-status', status); // Added for filtering
        if (task.parentId) gRow.setAttribute('data-parent', task.parentId);

        const expanderHtml = task.type === 'parent'
            ? `<button class="tree-expander ${task.collapsed ? 'collapsed' : 'expanded'}"><div class="nav-icon icon-chevron-lg-bottom"></div></button>`
            : '';

        const iconHtml = task.type === 'parent'
            ? `${expanderHtml}<div class="nav-icon icon-tix"></div>`
            : '<div class="nav-icon icon-stat"></div>';

        gRow.innerHTML = `
            <div class="data-grid-cell center"><label class="checkbox-container"><input type="checkbox"><div class="checkbox-box"></div></label></div>
            <div class="data-grid-cell">
                <div class="row-title-container ${task.type === 'child' ? 'depth-2' : ''}">
                    ${iconHtml}
                    <span class="data-grid-text">${task.title}</span>
                    ${task.type === 'parent' ? '<button class="add-child-btn"><div class="nav-icon icon-add"></div></button>' : ''}
                </div>
            </div>
            <div class="data-grid-cell">
                <div class="marker marker-has-icon marker-${status}">
                    ${status === 'inprogress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
            </div>
        `;

        // 2. Full Width Grid Row
        const fRow = gRow.cloneNode(true);
        const assignee = task.assignee || (task.type === 'parent' ? '이대수' : '-');
        const dueDate = task.dueDate || '2025-08-09';
        const tag = task.tag || (task.type === 'parent' ? 'Design' : 'Sub');

        fRow.innerHTML += `
            <div class="data-grid-cell" style="gap: 8px;">
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(assignee)}&background=random"
                    style="width: 24px; height: 24px; border-radius: 50%;" />
                <span class="data-grid-text-sm">${assignee}</span>
            </div>
            <div class="data-grid-cell">
                <span class="data-grid-text-sm">${dueDate}</span>
            </div>
            <div class="data-grid-cell">
                <div class="grid-tag ${task.type === 'parent' ? 'grid-tag-green' : 'grid-tag-blue'}">${tag}</div>
            </div>
        `;

        // 3. Timeline Row
        const tRow = document.createElement('div');
        tRow.className = `timeline-row ${task.type === 'child' ? 'grid-child-row' : ''} ${animate ? 'tix-anim-enter' : ''}`;
        if (task.collapsed) tRow.classList.add('collapsed');
        tRow.setAttribute('data-group', task.id);
        tRow.setAttribute('data-type', task.type);
        tRow.setAttribute('data-status', status); // Added for filtering
        if (task.parentId) tRow.setAttribute('data-parent', task.parentId);

        // Calculate dynamic positioning based on zoom
        const dayOffset = (task.start - UI_CONSTANTS.CENTER_PX) / 48; // Base scale is 48
        const visualLeft = UI_CONSTANTS.CENTER_PX + (dayOffset * currentCellWidth);
        const visualWidth = task.width * (currentCellWidth / 48);

        tRow.innerHTML = `
            <div class="timeline-bar timeline-bar-${status} ${animate ? 'tix-anim-enter' : ''}" style="left: ${visualLeft}px; width: ${visualWidth}px;">
                <div class="timeline-bar-resizer resizer-left"></div>
                <span class="timeline-bar-label">${task.title}</span>
                <div class="timeline-bar-resizer resizer-right"></div>
            </div>
        `;

        insertRowToBody(gB, gRow, task);
        insertRowToBody(fGB, fRow, task);
        insertTimelineRow(tB, tRow, task);

        [gRow, fRow].forEach(row => {
            row.oncontextmenu = (e) => {
                e.preventDefault();
                showContextMenu(e.pageX, e.pageY, task.id);
            };
        });
    }

    function insertRowToBody(body, row, task) {
        if (task.type === 'child' && task.parentId) {
            // Find the last existing child of this parent, or the parent row itself
            const siblings = body.querySelectorAll(`[data-parent="${task.parentId}"]`);
            const parentRow = body.querySelector(`[data-group="${task.parentId}"]`);
            if (siblings.length > 0) {
                // Insert after last sibling
                const lastSibling = siblings[siblings.length - 1];
                lastSibling.insertAdjacentElement('afterend', row);
            } else if (parentRow) {
                // Insert right after parent
                parentRow.insertAdjacentElement('afterend', row);
            } else {
                body.appendChild(row);
            }
        } else {
            body.appendChild(row);
        }
    }

    function insertTimelineRow(tB, tRow, task) {
        if (task.type === 'child' && task.parentId) {
            const siblings = tB.querySelectorAll(`[data-parent="${task.parentId}"]`);
            const parentRow = tB.querySelector(`[data-group="${task.parentId}"]`);
            if (siblings.length > 0) {
                const lastSibling = siblings[siblings.length - 1];
                lastSibling.insertAdjacentElement('afterend', tRow);
            } else if (parentRow) {
                parentRow.insertAdjacentElement('afterend', tRow);
            } else {
                tB.appendChild(tRow);
            }
        } else {
            tB.appendChild(tRow);
        }
    }
    function handleAddChild(pRow) {
        try {
            const pId = pRow.getAttribute('data-group');
            const cId = 'live-' + Date.now();
            const todayPos = UI_CONSTANTS.CENTER_PX;
            const task = { id: cId, title: '', status: 'pending', type: 'child', parentId: pId, start: todayPos, width: 96 };

            // Auto-expand parent if collapsed before creating child
            if (pRow.classList.contains('collapsed')) {
                const expander = pRow.querySelector('.tree-expander');
                if (expander && window.tixupCore) {
                    window.tixupCore.handleToggle(expander);
                }
            }

            renderTask(task, true); // Animate creation

            const gRow = document.querySelector(`#grid-tbody [data-group="${cId}"]`);
            const fRow = document.querySelector(`#full-grid-tbody [data-group="${cId}"]`);
            const tRow = document.querySelector(`#timeline-tbody [data-group="${cId}"]`);

            // Ensure child is visible (not collapsed)
            [gRow, fRow, tRow].forEach(r => { if (r) r.classList.remove('collapsed'); });

            // Clean up animation class after it finishes
            [gRow, fRow].forEach(r => {
                if (r) r.addEventListener('animationend', () => r.classList.remove('tix-anim-enter'), { once: true });
            });
            if (tRow) {
                const bar = tRow.querySelector('.timeline-bar');
                if (bar) bar.addEventListener('animationend', () => bar.classList.remove('tix-anim-enter'), { once: true });
            }

            try {
                if (window.tixupCore) window.tixupCore.syncTimelineOrder();
            } catch (e) { }

            setTimeout(() => {
                try {
                    inlineEditRow([gRow, fRow], tRow, true);
                } catch (e) { }
            }, 50);

            document.querySelectorAll(`[data-group="${pId}"] .tree-expander`).forEach(e => e.classList.remove('empty'));
        } catch (e) { }
    }

    function inlineEditRow(rows, tRow, isNew = false) {
        try {
            rows = rows.filter(r => r);
            const textSpans = rows.map(r => r.querySelector('.data-grid-text')).filter(s => s);

            if (textSpans.length === 0) return;

            textSpans.forEach(s => {
                s.style.display = 'none';
            });

            const inputs = textSpans.map(s => {
                const inp = document.createElement('input');
                inp.className = 'grid-create-input';
                inp.style.minWidth = '100px';
                inp.value = s.innerText;
                if (isNew) inp.placeholder = 'sub tix';
                s.parentNode.insertBefore(inp, s.nextSibling);
                return inp;
            });

            const visibleInp = inputs.find(inp => inp.offsetParent !== null);
            if (visibleInp) {
                visibleInp.focus();
                visibleInp.select();
            } else if (inputs.length > 0) {
                inputs[0].focus();
            }

            inputs.forEach((inp, idx) => {
                inp.oninput = () => inputs.forEach(other => { if (other !== inp) other.value = inp.value; });

                const finish = (cancel = false) => {
                    const name = inputs[0].value.trim();
                    if (cancel || !name) {
                        if (isNew) {
                            rows.forEach(r => r.remove());
                            if (tRow) tRow.remove();
                        }
                        else { textSpans.forEach(s => s.style.display = 'inline'); inputs.forEach(i => i.remove()); }
                    } else {
                        textSpans.forEach(s => { s.innerText = name; s.style.display = 'inline'; });
                        if (tRow) tRow.querySelector('.timeline-bar-label').innerText = name;
                        inputs.forEach(i => i.remove());
                        saveData();
                    }
                };
                inp.onkeydown = (e) => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') finish(true); };
                inp.onblur = () => { if (idx === 0) setTimeout(() => { if (!inputs.includes(document.activeElement)) finish(); }, 10); };
            });
        } catch (e) { }
    }

    function showContextMenu(x, y, id) {
        currentContextMenuId = id;
        contextMenu.style.display = 'block';
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        statusMenu.style.display = 'none';
    }

    document.addEventListener('click', () => {
        if (contextMenu) contextMenu.style.display = 'none';
        if (statusMenu) statusMenu.style.display = 'none';
    });

    if (deleteTixBtn) {
        deleteTixBtn.onclick = () => {
            const id = currentContextMenuId;
            if (!id) return;

            const idsToRemove = [id];
            document.querySelectorAll(`[data-parent="${id}"]`).forEach(el => {
                idsToRemove.push(el.getAttribute('data-group'));
            });

            animateAndRemove(idsToRemove, () => {
                saveData();
            });
        };
    }

    document.querySelectorAll('.status-menu-item').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            const nextStatus = item.getAttribute('data-status');
            const rowId = statusMenu.getAttribute('data-row-id');
            const bulkIds = statusMenu.getAttribute('data-bulk-ids');

            const idsToUpdate = bulkIds ? bulkIds.split(',') : (rowId ? [rowId] : []);
            if (idsToUpdate.length === 0) return;

            const states = ['pending', 'inprogress', 'pause', 'done', 'overdue'];

            idsToUpdate.forEach(id => {
                document.querySelectorAll(`[data-group="${id}"]`).forEach(el => {
                    // Update data-status attribute for future filtering
                    el.setAttribute('data-status', nextStatus);

                    const marker = el.querySelector('.marker');
                    const bar = el.querySelector('.timeline-bar');
                    if (marker) {
                        states.forEach(s => marker.classList.remove(`marker-${s}`));
                        marker.classList.add(`marker-${nextStatus}`);
                        marker.innerText = item.querySelector('.marker').innerText;
                    }
                    if (bar) {
                        states.forEach(s => bar.classList.remove(`timeline-bar-${s}`));
                        bar.classList.add(`timeline-bar-${nextStatus}`);
                    }
                });
            });

            saveData();
            statusMenu.style.display = 'none';
            statusMenu.removeAttribute('data-bulk-ids');
        };
    });

    document.addEventListener('tixup:data-changed', saveData);

    document.addEventListener('click', (e) => {
        const addBtn = e.target.closest('.add-child-btn');
        if (addBtn) {
            e.stopPropagation();
            handleAddChild(addBtn.closest('.data-grid-row'));
            return;
        }

        const marker = e.target.closest('.marker');
        if (marker && !marker.closest('#status-menu')) {
            const rect = marker.getBoundingClientRect();
            statusMenu.style.display = 'block';
            statusMenu.style.left = (window.scrollX + rect.left) + 'px';
            statusMenu.style.top = (window.scrollY + rect.bottom + 4) + 'px';
            statusMenu.setAttribute('data-row-id', marker.closest('.data-grid-row').getAttribute('data-group'));
            contextMenu.style.display = 'none';
            return;
        }

        const footBtn = e.target.closest('#footer-create-btn') || e.target.closest('#full-grid-create-btn') || e.target.closest('#top-tix-btn');
        if (footBtn) { handleCreateTix(footBtn); }
    });

    function handleCreateTix(btn) {
        btn.style.setProperty('display', 'none', 'important');
        const form = document.createElement('div');
        form.className = 'grid-create-input-form';
        form.innerHTML = `<div class="nav-icon icon-add"></div><input type="text" class="grid-create-input" placeholder="Tix name...">`;
        btn.parentElement.appendChild(form);
        const input = form.querySelector('input'); input.focus();

        const finish = () => {
            const name = input.value.trim();
            form.remove(); btn.style.display = 'flex';
            if (name) {
                // Reset filter to 'All' so the new task is visible
                const allTabs = document.querySelectorAll('.grid-filter-tab');
                allTabs.forEach(t => {
                    if (t.innerText.trim().toLowerCase() === 'all') t.classList.add('active');
                    else t.classList.remove('active');
                });
                applyStatusFilter('all');

                const todayPos = UI_CONSTANTS.CENTER_PX;
                const task = { id: 'live-' + Date.now(), title: name, status: 'pending', type: 'parent', start: todayPos, width: 96 };
                renderTask(task, true); // Animate creation

                // Clean up animation class after it finishes
                document.querySelectorAll(`[data-group="${task.id}"]`).forEach(r => {
                    r.addEventListener('animationend', () => r.classList.remove('tix-anim-enter'), { once: true });
                    const bar = r.querySelector('.timeline-bar.tix-anim-enter');
                    if (bar) bar.addEventListener('animationend', () => bar.classList.remove('tix-anim-enter'), { once: true });
                });

                saveData();
            }
        };
        input.onkeydown = (e) => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') finish(); };
        input.onblur = finish;
    }

    function saveData() {
        const res = [];
        document.querySelectorAll('#grid-tbody .data-grid-row').forEach(row => {
            const id = row.getAttribute('data-group');
            const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
            if (!bar) return;
            const fRow = document.querySelector(`#full-grid-tbody [data-group="${id}"]`);
            const visualLeft = parseSafePx(bar.style.left, UI_CONSTANTS.CENTER_PX);
            const dayOffset = (visualLeft - UI_CONSTANTS.CENTER_PX) / currentCellWidth;
            const normalizedStart = UI_CONSTANTS.CENTER_PX + (dayOffset * 48);

            const visualWidth = parseSafePx(bar.style.width, currentCellWidth);
            const normalizedWidth = visualWidth * (48 / currentCellWidth);

            res.push({
                id, title: row.querySelector('.data-grid-text').innerText,
                status: row.querySelector('.marker')?.classList[2]?.replace('marker-', '') || 'pending',
                type: row.getAttribute('data-type'),
                parentId: row.getAttribute('data-parent'),
                start: normalizedStart,
                width: normalizedWidth,
                assignee: fRow ? fRow.querySelector('.data-grid-text-sm')?.innerText : '이대수',
                dueDate: fRow ? fRow.querySelectorAll('.data-grid-text-sm')[1]?.innerText : '2025-08-09',
                tag: fRow ? fRow.querySelector('.grid-tag')?.innerText : 'Design',
                collapsed: row.classList.contains('collapsed')
            });
        });
        tasks = res; // CRITICAL: Update in-memory state so renderAll uses latest data
        localStorage.setItem(getStorageKey(), JSON.stringify(res));
        if (window.tixupCore) window.tixupCore.syncTimelineOrder();
    }
    window.tixupSaveData = saveData; // Expose for TixupCore

    function animateAndRemove(ids, callback) {
        const elements = [];
        ids.forEach(id => {
            document.querySelectorAll(`[data-group="${id}"]`).forEach(el => elements.push(el));
        });

        if (elements.length === 0) {
            if (callback) callback();
            return;
        }

        elements.forEach(el => {
            el.style.height = el.offsetHeight + 'px';
            el.style.minHeight = 'unset';
            el.style.maxHeight = el.offsetHeight + 'px';
            el.style.overflow = 'hidden';
            el.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        });

        // Force browser reflow
        if (elements.length > 0) elements[0].offsetHeight;

        elements.forEach(el => {
            el.style.height = '0px';
            el.style.maxHeight = '0px';
            el.style.paddingTop = '0px';
            el.style.paddingBottom = '0px';
            el.style.marginTop = '0px';
            el.style.marginBottom = '0px';
            el.style.borderWidth = '0px';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-8px)';
        });

        setTimeout(() => {
            elements.forEach(el => el.remove());
            if (callback) callback();
        }, 300);
    }

    // --- Multi-Selection, Multi-Drag & Multi-Resize Logic ---
    let isDragging = false;
    let isResizing = false;
    let resizeSide = null; // 'left' or 'right'
    let dragStartX = 0;

    let initialPositions = new Map(); // id -> initialLeft
    let initialWidths = new Map();    // id -> initialWidth

    function initTimelineDragging() {
        const tbody = document.getElementById('timeline-tbody');
        if (!tbody) return;

        tbody.addEventListener('mousedown', (e) => {
            const resizer = e.target.closest('.timeline-bar-resizer');
            const bar = e.target.closest('.timeline-bar');

            if (resizer) {
                e.stopImmediatePropagation();
                const side = resizer.classList.contains('resizer-left') ? 'left' : 'right';
                const id = bar.parentElement.getAttribute('data-group');

                // If clicked resizer's bar isn't selected, select it
                if (!timelineSelectedIds.has(id)) {
                    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
                        timelineSelectedIds.clear();
                    }
                    timelineSelectedIds.add(id);
                    syncTimelineSelectionUI();
                }

                startResize(e, side);
                return;
            }

            // Add dragging-active immediately at the click to both roots
            document.documentElement.classList.add('dragging-active');
            document.body.classList.add('dragging-active');

            if (!bar) {
                e.stopImmediatePropagation();
                if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
                    timelineSelectedIds.clear();
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

            // Handle timeline-specific selection for drag initiation
            if (isMulti) {
                if (timelineSelectedIds.has(id)) {
                    timelineSelectedIds.delete(id);
                } else {
                    timelineSelectedIds.add(id);
                }
            } else {
                if (!timelineSelectedIds.has(id)) {
                    timelineSelectedIds.clear();
                    timelineSelectedIds.add(id);
                }
            }

            syncTimelineSelectionUI();

            // Start drag for all currently selected bars
            startDrag(e);
        }, true); // USE CAPTURING PHASE and STOP PROPAGATION to rule them all

        window.addEventListener('mousemove', (e) => {
            if (!isDragging && !isResizing) return;

            // DEFENDER: Actively strip any browser-initiated selection highlights in real-time
            if (window.getSelection) window.getSelection().removeAllRanges();

            let deltaX = e.clientX - dragStartX;

            if (isDragging) {
                initialPositions.forEach((startPos, id) => {
                    const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
                    if (bar) {
                        const newLeft = startPos + deltaX;
                        const dayDelta = (deltaX / currentCellWidth).toFixed(2);
                        console.log(`[Drag] ID: ${id}, deltaX: ${deltaX}px (~${dayDelta} days), newLeft: ${newLeft}`);
                        bar.style.left = `${newLeft}px`;
                    }
                });
            } else if (isResizing) {
                // GROUP CLAMPING: Verify if any bar hits the 48px limit
                let allowedDeltaX = deltaX;

                initialWidths.forEach((startWidth, id) => {
                    if (resizeSide === 'right') {
                        // For right resize, deltaX shrinking is limited by width reaching currentCellWidth
                        if (startWidth + deltaX < currentCellWidth) {
                            allowedDeltaX = Math.min(allowedDeltaX, currentCellWidth - startWidth);
                        }
                    } else if (resizeSide === 'left') {
                        // For left resize, deltaX growing is limited by width reaching currentCellWidth (since width = start - delta)
                        if (startWidth - deltaX < currentCellWidth) {
                            allowedDeltaX = Math.max(allowedDeltaX, startWidth - currentCellWidth);
                        }
                    }
                });

                deltaX = allowedDeltaX;

                initialPositions.forEach((startPos, id) => {
                    const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
                    const startWidth = initialWidths.get(id);
                    if (bar && startWidth) {
                        if (resizeSide === 'right') {
                            const newWidth = Math.max(currentCellWidth, startWidth + deltaX);
                            bar.style.width = `${newWidth}px`;
                        } else if (resizeSide === 'left') {
                            const newLeft = startPos + deltaX;
                            const newWidth = Math.max(currentCellWidth, startWidth - deltaX);
                            bar.style.left = `${newLeft}px`;
                            bar.style.width = `${newWidth}px`;
                        }
                    }
                });
            }
        });

        window.addEventListener('mouseup', () => {
            if (!isDragging && !isResizing) return;

            isDragging = false;
            isResizing = false;

            // Finalize positions & widths (snap to grid)
            initialPositions.forEach((_, id) => {
                const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
                if (bar) {
                    // Snap Left safely using CENTER_PX basis
                    let finalLeft = parseSafePx(bar.style.left, UI_CONSTANTS.CENTER_PX);
                    finalLeft = UI_CONSTANTS.CENTER_PX + Math.round((finalLeft - UI_CONSTANTS.CENTER_PX) / currentCellWidth) * currentCellWidth;
                    bar.style.left = `${finalLeft}px`;

                    // Snap Width safely
                    let finalWidth = parseSafePx(bar.style.width, currentCellWidth);
                    finalWidth = Math.round(finalWidth / currentCellWidth) * currentCellWidth;
                    bar.style.width = `${Math.max(currentCellWidth, finalWidth)}px`;

                    bar.classList.remove('is-dragging');
                }
            });

            saveData();
            console.log(`[Drag End] Finalized and snapped positions saved.`);
            initialPositions.clear();
            initialWidths.clear();
            document.body.style.cursor = '';
            document.documentElement.classList.remove('dragging-active');
            document.body.classList.remove('dragging-active');
        });
    }

    function startResize(e, side) {
        isResizing = true;
        resizeSide = side;
        dragStartX = e.clientX;
        initialPositions.clear();
        initialWidths.clear();

        timelineSelectedIds.forEach(id => {
            const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
            if (bar) {
                let sLeft = parseSafePx(bar.style.left, UI_CONSTANTS.CENTER_PX);
                let sWidth = parseSafePx(bar.style.width, 48);

                initialPositions.set(id, sLeft);
                initialWidths.set(id, sWidth);
                bar.classList.add('is-dragging');
            }
        });

        document.body.style.cursor = 'ew-resize';
        document.documentElement.classList.add('dragging-active');
        document.body.classList.add('dragging-active');
    }

    function syncTimelineSelectionUI() {
        document.querySelectorAll('.timeline-bar').forEach(bar => {
            const id = bar.parentElement.getAttribute('data-group');
            if (timelineSelectedIds.has(id)) bar.classList.add('selected');
            else bar.classList.remove('selected');
        });
    }

    function startDrag(e) {
        isDragging = true;
        dragStartX = e.clientX;
        initialPositions.clear();
        initialWidths.clear();

        // 1. Collect all explicit selections
        const dragSet = new Set(timelineSelectedIds);

        // 2. Expand dragSet to include all children of selected parents
        timelineSelectedIds.forEach(id => {
            const row = document.querySelector(`#timeline-tbody [data-group="${id}"]`);
            // Robust parent check: has data-type="parent" OR has no data-parent attribute
            if (row && (row.getAttribute('data-type') === 'parent' || !row.getAttribute('data-parent'))) {
                const children = document.querySelectorAll(`#timeline-tbody [data-parent="${id}"]`);
                children.forEach(childRow => {
                    dragSet.add(childRow.getAttribute('data-group'));
                });
            }
        });

        // 3. Initialize positions for the entire expanded set
        dragSet.forEach(id => {
            const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
            if (bar) {
                let sLeft = parseSafePx(bar.style.left, UI_CONSTANTS.CENTER_PX);
                let sWidth = parseSafePx(bar.style.width, currentCellWidth);

                initialPositions.set(id, sLeft);
                initialWidths.set(id, sWidth);
                console.log(`[Drag Start] ID: ${id}, initialLeft: ${sLeft}, initialWidth: ${sWidth}`);
                bar.classList.add('is-dragging');
            }
        });

        document.body.style.cursor = 'grabbing';
        document.documentElement.classList.add('dragging-active');
        document.body.classList.add('dragging-active');
    }

    function toggleRowSelection(id, forceSelect = null) {
        const checkbox = document.querySelector(`#grid-tbody [data-group="${id}"] input[type="checkbox"]`);
        if (checkbox) {
            checkbox.checked = (forceSelect !== null) ? forceSelect : !checkbox.checked;
            // Trigger custom sync
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function deselectAll() {
        document.querySelectorAll('#grid-tbody input[type="checkbox"]').forEach(cb => {
            if (cb.checked) {
                cb.checked = false;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }

    function deselectAll() {
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        updateSelectionBar();
    }

    function toggleRowSelection(id, forceValue) {
        document.querySelectorAll(`[data-group="${id}"] input[type="checkbox"]`).forEach(cb => {
            cb.checked = forceValue !== undefined ? forceValue : !cb.checked;
        });
        updateSelectionBar();
    }

    init();
});
