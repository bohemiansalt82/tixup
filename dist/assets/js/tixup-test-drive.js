document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'tixup_master_pro_data';
    let tasks = [];
    let currentContextMenuId = null;

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

    // 1. 초기 로드
    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        tasks = saved ? JSON.parse(saved) : [];

        // 만약 데이터가 없거나 과거 데이터라면 현재 날짜 기준으로 샘플 생성/보정
        if (tasks.length === 0) {
            tasks = [
                { id: 'p1', title: 'Design System Update', status: 'inprogress', type: 'parent', start: 48, width: 144, assignee: '이대수', dueDate: '2026-04-10', tag: 'Design' },
                { id: 'c1', title: 'Color Palette logic', status: 'done', type: 'child', parentId: 'p1', start: 48, width: 48, assignee: '김철수', dueDate: '2026-04-05', tag: 'Sub' },
                { id: 'c2', title: 'Icon set optimization', status: 'pending', type: 'child', parentId: 'p1', start: 96, width: 96, assignee: '이영희', dueDate: '2026-04-07', tag: 'Sub' },
                { id: 'p2', title: 'Backend Integration', status: 'pause', type: 'parent', start: 240, width: 192, assignee: '박지민', dueDate: '2026-04-15', tag: 'Dev' }
            ];
            saveData();
        }

        renderTimelineHeader();
        initFilters();
        initViewToggle();
        initSelection();
        initTimelineDragging(); // Initialize timeline dragging
        renderAll();
    }

    function renderTimelineHeader() {
        const now = new Date(); // Actual current date: 2026-04-04
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();

        // 1. Set Month Label (e.g., April 2026)
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('timeline-month-label').innerText = `${monthNames[month]} ${year}`;

        // 2. Generate Day Cells
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysHeader = document.getElementById('timeline-days-header');
        const gridBack = document.getElementById('timeline-grid-back');

        let daysHtml = '';
        let gridHtml = '';
        for (let i = 1; i <= daysInMonth; i++) {
            const isToday = i === today;
            daysHtml += `<div class="timeline-day-cell ${isToday ? 'today-marker' : ''}">${i}</div>`;
            gridHtml += `<div class="timeline-grid-line"></div>`;
        }
        daysHeader.innerHTML = daysHtml;
        gridBack.innerHTML = gridHtml;

        // 3. Position Today Line (48px per day, center it at 24px)
        const todayIndicator = document.getElementById('timeline-today-indicator');
        const leftPos = (today - 1) * 48 + 24;
        todayIndicator.style.left = `${leftPos}px`;
        todayIndicator.style.display = 'block';
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

    function initViewToggle() {
        const listIcon = document.querySelector('.icon-list');
        const clockIcon = document.querySelector('.icon-clock');
        if (!listIcon || !clockIcon) return;

        const listBtn = listIcon.parentElement;
        const clockBtn = clockIcon.parentElement;
        const timelineContainer = document.getElementById('data-grid-timeline');
        const fullGridContainer = document.getElementById('full-data-grid');

        if (!listBtn || !clockBtn || !timelineContainer || !fullGridContainer) {
            return;
        }

        listBtn.onclick = () => {
            timelineContainer.style.setProperty('display', 'none', 'important');
            fullGridContainer.style.setProperty('display', 'flex', 'important');
            listBtn.classList.add('selected');
            clockBtn.classList.remove('selected');
        };

        clockBtn.onclick = () => {
            timelineContainer.style.setProperty('display', 'flex', 'important');
            fullGridContainer.style.setProperty('display', 'none', 'important');
            clockBtn.classList.add('selected');
            listBtn.classList.remove('selected');
        };
    }

    function renderAll() {
        const gB = document.getElementById('grid-tbody');
        const fGB = document.getElementById('full-grid-tbody');
        const tB = document.getElementById('timeline-tbody');
        if (!gB || !fGB || !tB) return;
        gB.innerHTML = ''; fGB.innerHTML = ''; tB.innerHTML = '';

        tasks.filter(t => t.type === 'parent').forEach(t => renderTask(t));
        tasks.filter(t => t.type === 'child').forEach(t => renderTask(t));
    }

    function renderTask(task, animate = false) {
        const status = (task.status || 'pending').toLowerCase().replace('onhold', 'pause');
        const hasChildren = tasks.some(t => t.parentId === task.id);

        // 1. Sidebar Grid Row
        const gRow = document.createElement('div');
        gRow.className = `data-grid-row ${task.type === 'child' ? 'grid-child-row' : 'level-0'}`;
        if (animate) gRow.classList.add('tix-anim-enter');
        gRow.setAttribute('data-group', task.id);
        gRow.setAttribute('data-type', task.type);
        gRow.setAttribute('data-status', status); // Added for filtering
        if (task.parentId) gRow.setAttribute('data-parent', task.parentId);

        const expanderHtml = task.type === 'parent'
            ? `<button class="tree-expander expanded ${hasChildren ? '' : 'empty'}"><div class="nav-icon icon-chevron-lg-bottom"></div></button>`
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
        tRow.className = `timeline-row ${task.type === 'child' ? 'grid-child-row' : ''}`;
        tRow.setAttribute('data-group', task.id);
        tRow.setAttribute('data-type', task.type);
        tRow.setAttribute('data-status', status); // Added for filtering
        if (task.parentId) tRow.setAttribute('data-parent', task.parentId);
        tRow.innerHTML = `
            <div class="timeline-bar timeline-bar-${status} ${animate ? 'tix-anim-enter' : ''}" style="left: ${task.start}px; width: ${task.width}px;">
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
            const children = Array.from(body.querySelectorAll(`[data-parent="${task.parentId}"]`));
            const targetInsert = children.length > 0 ? children[children.length - 1] : body.querySelector(`[data-group="${task.parentId}"]`);
            if (targetInsert) targetInsert.insertAdjacentElement('afterend', row);
            else body.appendChild(row);
        } else {
            body.appendChild(row);
        }
    }

    function insertTimelineRow(tB, tRow, task) {
        if (task.type === 'child' && task.parentId) {
            const children = Array.from(tB.querySelectorAll(`[data-parent="${task.parentId}"]`));
            const targetInsert = children.length > 0 ? children[children.length - 1] : tB.querySelector(`[data-group="${task.parentId}"]`);
            if (targetInsert) targetInsert.insertAdjacentElement('afterend', tRow);
            else tB.appendChild(tRow);
        } else {
            tB.appendChild(tRow);
        }
    }
    function handleAddChild(pRow) {
        try {
            const pId = pRow.getAttribute('data-group');
            const cId = 'live-' + Date.now();
            const now = new Date();
            const todayPos = (now.getDate() - 1) * 48;
            const task = { id: cId, title: '', status: 'pending', type: 'child', parentId: pId, start: todayPos, width: 96 };
            renderTask(task, true); // Animate creation

            const gRow = document.querySelector(`#grid-tbody [data-group="${cId}"]`);
            const fRow = document.querySelector(`#full-grid-tbody [data-group="${cId}"]`);
            const tRow = document.querySelector(`#timeline-tbody [data-group="${cId}"]`);

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

                const now = new Date();
                const todayPos = (now.getDate() - 1) * 48;
                const task = { id: 'live-' + Date.now(), title: name, status: 'pending', type: 'parent', start: todayPos, width: 96 };
                renderTask(task, true); // Animate creation
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
            res.push({
                id, title: row.querySelector('.data-grid-text').innerText,
                status: row.querySelector('.marker')?.classList[2]?.replace('marker-', '') || 'pending',
                type: row.getAttribute('data-type'),
                parentId: row.getAttribute('data-parent'),
                start: parseInt(bar.style.left),
                width: parseInt(bar.style.width),
                assignee: fRow ? fRow.querySelector('.data-grid-text-sm')?.innerText : '이대수',
                dueDate: fRow ? fRow.querySelectorAll('.data-grid-text-sm')[1]?.innerText : '2025-08-09',
                tag: fRow ? fRow.querySelector('.grid-tag')?.innerText : 'Design'
            });
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(res));
        if (window.tixupCore) window.tixupCore.syncTimelineOrder();
    }

    function animateAndRemove(ids, callback) {
        const elements = [];
        ids.forEach(id => {
            document.querySelectorAll(`[data-group="${id}"]`).forEach(el => elements.push(el));
        });

        if (elements.length === 0) {
            if (callback) callback();
            return;
        }

        elements.forEach(el => el.classList.add('tix-anim-exit'));

        // Wait for the exit animation to finish (0.3s)
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
                        bar.style.left = `${newLeft}px`;
                    }
                });
            } else if (isResizing) {
                // GROUP CLAMPING: Verify if any bar hits the 48px limit
                let allowedDeltaX = deltaX;
                
                initialWidths.forEach((startWidth, id) => {
                    if (resizeSide === 'right') {
                        // For right resize, deltaX shrinking is limited by width reaching 48
                        if (startWidth + deltaX < 48) {
                            allowedDeltaX = Math.min(allowedDeltaX, 48 - startWidth); 
                        }
                    } else if (resizeSide === 'left') {
                        // For left resize, deltaX growing is limited by width reaching 48 (since width = start - delta)
                        if (startWidth - deltaX < 48) {
                            allowedDeltaX = Math.max(allowedDeltaX, startWidth - 48);
                        }
                    }
                });

                deltaX = allowedDeltaX;

                initialPositions.forEach((startPos, id) => {
                    const bar = document.querySelector(`#timeline-tbody [data-group="${id}"] .timeline-bar`);
                    const startWidth = initialWidths.get(id);
                    if (bar && startWidth) {
                        if (resizeSide === 'right') {
                            const newWidth = Math.max(48, startWidth + deltaX);
                            bar.style.width = `${newWidth}px`;
                        } else if (resizeSide === 'left') {
                            const newLeft = startPos + deltaX;
                            const newWidth = Math.max(48, startWidth - deltaX);
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
                    // Snap Left
                    let finalLeft = parseInt(bar.style.left);
                    finalLeft = Math.round(finalLeft / 48) * 48;
                    bar.style.left = `${finalLeft}px`;

                    // Snap Width
                    let finalWidth = parseInt(bar.style.width);
                    finalWidth = Math.round(finalWidth / 48) * 48;
                    bar.style.width = `${finalWidth}px`;
                    
                    bar.classList.remove('is-dragging');
                }
            });

            saveData();
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
                initialPositions.set(id, parseInt(bar.style.left) || 0);
                initialWidths.set(id, parseInt(bar.style.width) || 48);
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
                initialPositions.set(id, parseInt(bar.style.left) || 0);
                initialWidths.set(id, parseInt(bar.style.width) || 48);
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
