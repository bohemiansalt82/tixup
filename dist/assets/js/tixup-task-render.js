let _sortableTimer = null;

function renderAll() {
    const gB = document.getElementById('grid-tbody');
    const fGB = document.getElementById('full-grid-tbody');
    const tB = document.getElementById('timeline-tbody');
    if (!gB || !fGB || !tB) return;
    gB.innerHTML = ''; fGB.innerHTML = ''; tB.innerHTML = '';

    TixupState.tasks.forEach(t => renderTask(t));

    // 연속 렌더링 시 Sortable 재생성을 한 번만 실행
    clearTimeout(_sortableTimer);
    _sortableTimer = setTimeout(() => {
        if (window.tixupCore && typeof window.tixupCore.initSortable === 'function') {
            window.tixupCore.initSortable();
        }
    }, 50);
}

function renderTask(task, animate = false) {
    const gB = document.getElementById('grid-tbody');
    const fGB = document.getElementById('full-grid-tbody');
    const tB = document.getElementById('timeline-tbody');

    const status = (task.status || 'pending').toLowerCase().replace('onhold', 'pause');
    const statusLabel = status === 'inprogress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1);

    const expanderHtml = task.type === 'parent'
        ? `<button class="tree-expander ${task.collapsed ? 'collapsed' : 'expanded'}"><div class="nav-icon icon-chevron-lg-bottom"></div></button>`
        : '';
    const iconHtml = task.type === 'parent'
        ? `${expanderHtml}<div class="nav-icon icon-tix"></div>`
        : '<div class="nav-icon icon-stat"></div>';
    const addChildHtml = task.type === 'parent' ? '<button class="add-child-btn"><div class="nav-icon icon-add"></div></button>' : '';

    // 1. Sidebar Grid Row
    const gRow = document.createElement('div');
    gRow.className = `data-grid-row ${task.type === 'child' ? 'grid-child-row' : 'level-0'}`;
    if (task.collapsed) gRow.classList.add('collapsed');
    if (animate) gRow.classList.add('tix-anim-enter');
    gRow.setAttribute('data-group', task.id);
    gRow.setAttribute('data-type', task.type);
    gRow.setAttribute('data-status', status);
    if (task.parentId) gRow.setAttribute('data-parent', task.parentId);

    gRow.innerHTML = `
        <div class="data-grid-cell center"><label class="checkbox-container"><input type="checkbox"><div class="checkbox-box"></div></label></div>
        <div class="data-grid-cell">
            <div class="row-title-container ${task.type === 'child' ? 'depth-2' : ''}">
                ${iconHtml}
                <span class="data-grid-text"></span>
                ${addChildHtml}
            </div>
        </div>
        <div class="data-grid-cell">
            <div class="marker marker-has-icon marker-${status}">${statusLabel}</div>
        </div>
    `;
    gRow.querySelector('.data-grid-text').textContent = task.title;

    // 2. Full Width Grid Row (clone + append 3 extra cells)
    const fRow = gRow.cloneNode(true);
    const assignee = task.assignee || 'Unassigned';
    const dueDate = task.dueDate || '2025-08-09';
    const tag = task.tag || (task.type === 'parent' ? 'Design' : 'Sub');

    const assigneeCell = document.createElement('div');
    assigneeCell.className = 'data-grid-cell';
    assigneeCell.style.gap = '8px';
    const assigneeImg = document.createElement('img');
    assigneeImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(assignee)}&background=random`;
    assigneeImg.style.cssText = 'width: 24px; height: 24px; border-radius: 50%;';
    const assigneeName = document.createElement('span');
    assigneeName.className = 'data-grid-text-sm';
    assigneeName.textContent = assignee;
    assigneeCell.appendChild(assigneeImg);
    assigneeCell.appendChild(assigneeName);

    const dueDateCell = document.createElement('div');
    dueDateCell.className = 'data-grid-cell';
    const dueDateSpan = document.createElement('span');
    dueDateSpan.className = 'data-grid-text-sm';
    dueDateSpan.textContent = dueDate;
    dueDateCell.appendChild(dueDateSpan);

    const tagCell = document.createElement('div');
    tagCell.className = 'data-grid-cell';
    const tagDiv = document.createElement('div');
    tagDiv.className = `grid-tag ${task.type === 'parent' ? 'grid-tag-green' : 'grid-tag-blue'}`;
    tagDiv.textContent = tag;
    tagCell.appendChild(tagDiv);

    fRow.appendChild(assigneeCell);
    fRow.appendChild(dueDateCell);
    fRow.appendChild(tagCell);

    // 3. Timeline Row
    const tRow = document.createElement('div');
    tRow.className = `timeline-row ${task.type === 'child' ? 'grid-child-row' : ''} ${animate ? 'tix-anim-enter' : ''}`.trim();
    if (task.collapsed) tRow.classList.add('collapsed');
    tRow.setAttribute('data-group', task.id);
    tRow.setAttribute('data-type', task.type);
    tRow.setAttribute('data-status', status);
    if (task.parentId) tRow.setAttribute('data-parent', task.parentId);

    const dayOffset = (task.start - UI_CONSTANTS.CENTER_PX) / 48;
    const visualLeft = UI_CONSTANTS.CENTER_PX + (dayOffset * TixupState.currentCellWidth);
    const visualWidth = task.width * (TixupState.currentCellWidth / 48);

    const barDiv = document.createElement('div');
    barDiv.className = `timeline-bar timeline-bar-${status}${animate ? ' tix-anim-enter' : ''}`;
    barDiv.style.left = `${visualLeft}px`;
    barDiv.style.width = `${visualWidth}px`;

    const resizerLeft = document.createElement('div');
    resizerLeft.className = 'timeline-bar-resizer resizer-left';
    const barLabel = document.createElement('span');
    barLabel.className = 'timeline-bar-label';
    barLabel.textContent = task.title;
    const resizerRight = document.createElement('div');
    resizerRight.className = 'timeline-bar-resizer resizer-right';

    barDiv.appendChild(resizerLeft);
    barDiv.appendChild(barLabel);
    barDiv.appendChild(resizerRight);
    tRow.appendChild(barDiv);

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
        const siblings = body.querySelectorAll(`[data-parent="${task.parentId}"]`);
        const parentRow = body.querySelector(`[data-group="${task.parentId}"]`);
        if (siblings.length > 0) {
            siblings[siblings.length - 1].insertAdjacentElement('afterend', row);
        } else if (parentRow) {
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
            siblings[siblings.length - 1].insertAdjacentElement('afterend', tRow);
        } else if (parentRow) {
            parentRow.insertAdjacentElement('afterend', tRow);
        } else {
            tB.appendChild(tRow);
        }
    } else {
        tB.appendChild(tRow);
    }
}
