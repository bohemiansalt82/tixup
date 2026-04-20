function handleAddChild(pRow) {
    try {
        const pId = pRow.getAttribute('data-group');
        const cId = 'live-' + Date.now();
        const task = { id: cId, title: '', status: 'pending', type: 'child', parentId: pId, start: UI_CONSTANTS.CENTER_PX, width: 96 };

        if (pRow.classList.contains('collapsed')) {
            const expander = pRow.querySelector('.tree-expander');
            if (expander && window.tixupCore) window.tixupCore.handleToggle(expander);
        }

        renderTask(task, true);

        const gRow = document.querySelector(`#grid-tbody [data-group="${cId}"]`);
        const fRow = document.querySelector(`#full-grid-tbody [data-group="${cId}"]`);
        const tRow = document.querySelector(`#timeline-tbody [data-group="${cId}"]`);

        [gRow, fRow, tRow].forEach(r => { if (r) r.classList.remove('collapsed'); });
        [gRow, fRow].forEach(r => {
            if (r) r.addEventListener('animationend', () => r.classList.remove('tix-anim-enter'), { once: true });
        });
        if (tRow) {
            const bar = tRow.querySelector('.timeline-bar');
            if (bar) bar.addEventListener('animationend', () => bar.classList.remove('tix-anim-enter'), { once: true });
        }

        try { if (window.tixupCore) window.tixupCore.syncTimelineOrder(); } catch (e) { }

        setTimeout(() => {
            try { inlineEditRow([gRow, fRow], tRow, true); } catch (e) { }
        }, 50);

        document.querySelectorAll(`[data-group="${pId}"] .tree-expander`).forEach(e => e.classList.remove('empty'));
    } catch (e) { }
}

function inlineEditRow(rows, tRow, isNew = false) {
    try {
        rows = rows.filter(r => r);
        const textSpans = rows.map(r => r.querySelector('.data-grid-text')).filter(s => s);
        if (textSpans.length === 0) return;

        textSpans.forEach(s => { s.style.display = 'none'; });

        const inputs = textSpans.map(s => {
            const inp = document.createElement('input');
            inp.className = 'grid-create-input';
            inp.style.minWidth = '100px';
            inp.value = s.textContent;
            if (isNew) inp.placeholder = 'sub tix';
            s.parentNode.insertBefore(inp, s.nextSibling);
            return inp;
        });

        const visibleInp = inputs.find(inp => inp.offsetParent !== null);
        if (visibleInp) { visibleInp.focus(); visibleInp.select(); }
        else if (inputs.length > 0) inputs[0].focus();

        inputs.forEach((inp, idx) => {
            inp.oninput = () => inputs.forEach(other => { if (other !== inp) other.value = inp.value; });

            const finish = (cancel = false) => {
                const name = inputs[0].value.trim();
                if (cancel || !name) {
                    if (isNew) {
                        rows.forEach(r => r.remove());
                        if (tRow) tRow.remove();
                    } else {
                        textSpans.forEach(s => s.style.display = 'inline');
                        inputs.forEach(i => i.remove());
                    }
                } else {
                    textSpans.forEach(s => { s.textContent = name; s.style.display = 'inline'; });
                    if (tRow) tRow.querySelector('.timeline-bar-label').textContent = name;
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
    TixupState.currentContextMenuId = id;
    const contextMenu = document.getElementById('context-menu');
    const statusMenu = document.getElementById('status-menu');
    if (contextMenu) { contextMenu.style.display = 'block'; contextMenu.style.left = x + 'px'; contextMenu.style.top = y + 'px'; }
    if (statusMenu) statusMenu.style.display = 'none';
}

function handleCreateTix(btn) {
    btn.style.setProperty('display', 'none', 'important');
    const form = document.createElement('div');
    form.className = 'grid-create-input-form';
    const addIcon = document.createElement('div');
    addIcon.className = 'nav-icon icon-add';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'grid-create-input';
    input.placeholder = 'Tix name...';
    form.appendChild(addIcon);
    form.appendChild(input);
    btn.parentElement.appendChild(form);
    input.focus();

    const finish = () => {
        const name = input.value.trim();
        form.remove();
        btn.style.display = 'flex';
        if (name) {
            document.querySelectorAll('.grid-filter-tab').forEach(t => {
                if (t.innerText.trim().toLowerCase() === 'all') t.classList.add('active');
                else t.classList.remove('active');
            });
            applyStatusFilter('all');

            const task = { id: 'live-' + Date.now(), title: name, status: 'pending', type: 'parent', start: UI_CONSTANTS.CENTER_PX, width: 96 };
            renderTask(task, true);

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

function animateAndRemove(ids, callback) {
    const elements = [];
    ids.forEach(id => document.querySelectorAll(`[data-group="${id}"]`).forEach(el => elements.push(el)));

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

    elements[0].offsetHeight; // force reflow

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

function initTaskCrudEvents() {
    if (initTaskCrudEvents._done) return;
    initTaskCrudEvents._done = true;

    const contextMenu = document.getElementById('context-menu');
    const statusMenu = document.getElementById('status-menu');
    const deleteTixBtn = document.getElementById('delete-tix');

    if (deleteTixBtn) {
        deleteTixBtn.onclick = () => {
            const id = TixupState.currentContextMenuId;
            if (!id) return;
            if (contextMenu) contextMenu.style.display = 'none';
            const idsToRemove = [id];
            document.querySelectorAll(`[data-parent="${id}"]`).forEach(el => idsToRemove.push(el.getAttribute('data-group')));
            animateAndRemove(idsToRemove, () => saveData());
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
                    el.setAttribute('data-status', nextStatus);
                    const marker = el.querySelector('.marker');
                    const bar = el.querySelector('.timeline-bar');
                    if (marker) {
                        states.forEach(s => marker.classList.remove(`marker-${s}`));
                        marker.classList.add(`marker-${nextStatus}`);
                        marker.textContent = item.querySelector('.marker').textContent;
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

    // 단일 click 핸들러: 메뉴 닫기 + 인터랙션 처리 통합
    document.addEventListener('click', (e) => {
        // 메뉴 닫기 (항상 먼저)
        if (!e.target.closest('#context-menu')) contextMenu?.style && (contextMenu.style.display = 'none');
        if (!e.target.closest('#status-menu')) statusMenu?.style && (statusMenu.style.display = 'none');

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
            return;
        }

        const footBtn = e.target.closest('#footer-create-btn') || e.target.closest('#full-grid-create-btn') || e.target.closest('#top-tix-btn');
        if (footBtn) handleCreateTix(footBtn);
    });
}
