function renderSpaceList() {
    const spaceList = document.getElementById('space-list');
    if (!spaceList || typeof TixupAuth === 'undefined') return;

    const spaces = TixupAuth.getSpaces();
    const activeId = TixupAuth.getActiveSpaceId();

    spaceList.innerHTML = '';
    spaces.forEach((space) => {
        const item = document.createElement('div');
        item.className = `space-item ${space.id === activeId ? 'active' : ''}`;
        item.setAttribute('data-space-id', space.id);

        const iconContainer = document.createElement('div');
        iconContainer.className = 'space-item-icon-container';
        const icon = document.createElement('img');
        icon.src = 'assets/images/icons/deployed_code.svg';
        icon.className = 'space-deployed-icon';
        iconContainer.appendChild(icon);

        const label = document.createElement('div');
        label.className = 'space-item-label';
        label.textContent = space.name;

        const moreBtn = document.createElement('button');
        moreBtn.className = 'space-item-more';
        moreBtn.title = 'More';
        const moreIcon = document.createElement('span');
        moreIcon.className = 'material-icons-outlined';
        moreIcon.style.cssText = 'font-size: 16px; color: #999;';
        moreIcon.textContent = 'more_horiz';
        moreBtn.appendChild(moreIcon);

        item.appendChild(iconContainer);
        item.appendChild(label);
        item.appendChild(moreBtn);

        item.addEventListener('click', (e) => {
            if (e.target.closest('.space-item-more')) return;
            switchSpace(space.id);
        });
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showSpaceContextMenu(e, space.id);
        });

        spaceList.appendChild(item);
    });

    const activeSpace = spaces.find(s => s.id === activeId);
    const locationTitle = document.querySelector('.location-title');
    if (locationTitle && activeSpace) locationTitle.textContent = activeSpace.name;
}

function renderUserProfile() {
    const profileEl = document.getElementById('nav-user-profile');
    if (!profileEl || typeof TixupAuth === 'undefined') return;
    const user = TixupAuth.getUser();
    if (!user) return;

    profileEl.innerHTML = '';

    const avatar = document.createElement('img');
    avatar.className = 'nav-user-avatar';
    avatar.src = user.picture;
    avatar.alt = user.name;
    avatar.onerror = () => { avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=6C5CE7&color=fff`; };

    const info = document.createElement('div');
    info.className = 'nav-user-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'nav-user-name';
    nameEl.textContent = user.name;
    const emailEl = document.createElement('div');
    emailEl.className = 'nav-user-email';
    emailEl.textContent = user.email;
    info.appendChild(nameEl);
    info.appendChild(emailEl);

    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'nav-logout-btn';
    logoutBtn.title = 'Sign Out';
    const logoutIcon = document.createElement('span');
    logoutIcon.className = 'material-icons-outlined';
    logoutIcon.style.cssText = 'font-size: 18px; color: #999;';
    logoutIcon.textContent = 'logout';
    logoutBtn.appendChild(logoutIcon);
    logoutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Sign out?')) TixupAuth.logout();
    });

    profileEl.appendChild(avatar);
    profileEl.appendChild(info);
    profileEl.appendChild(logoutBtn);
}

function initSpaceEvents() {
    const addBtn = document.getElementById('add-space-btn');
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showSpaceCreateInput();
        });
    }

    if (!TixupState.spaceContextMenu) {
        const menu = document.createElement('div');
        menu.className = 'space-context-menu';

        const renameItem = document.createElement('div');
        renameItem.className = 'space-context-menu-item';
        renameItem.setAttribute('data-action', 'rename');
        renameItem.innerHTML = '<span class="material-icons-outlined">edit</span> Rename';

        const deleteItem = document.createElement('div');
        deleteItem.className = 'space-context-menu-item danger';
        deleteItem.setAttribute('data-action', 'delete');
        deleteItem.innerHTML = '<span class="material-icons-outlined">delete</span> Delete';

        menu.appendChild(renameItem);
        menu.appendChild(deleteItem);
        document.body.appendChild(menu);
        TixupState.spaceContextMenu = menu;

        menu.addEventListener('click', (e) => {
            const action = e.target.closest('.space-context-menu-item')?.getAttribute('data-action');
            if (!action || !TixupState.spaceContextTargetId) return;

            if (action === 'rename') {
                const newName = prompt('Space name:');
                if (newName && newName.trim()) {
                    TixupAuth.renameSpace(TixupState.spaceContextTargetId, newName.trim());
                    renderSpaceList();
                }
            } else if (action === 'delete') {
                const spaces = TixupAuth.getSpaces();
                if (spaces.length <= 1) { alert('You must have at least one space.'); return; }
                if (confirm('Delete this space and all its data?')) {
                    const isActive = TixupState.spaceContextTargetId === TixupAuth.getActiveSpaceId();
                    TixupAuth.deleteSpace(TixupState.spaceContextTargetId);
                    if (isActive) switchSpace(TixupAuth.getSpaces()[0].id);
                    renderSpaceList();
                }
            }
            menu.style.display = 'none';
        });

        document.addEventListener('click', () => {
            if (TixupState.spaceContextMenu) TixupState.spaceContextMenu.style.display = 'none';
        });
    }
}

function showSpaceContextMenu(e, spaceId) {
    TixupState.spaceContextTargetId = spaceId;
    const rect = e.target.closest('.space-item-more').getBoundingClientRect();
    TixupState.spaceContextMenu.style.display = 'block';
    TixupState.spaceContextMenu.style.left = `${rect.right + 4}px`;
    TixupState.spaceContextMenu.style.top = `${rect.top}px`;
}

function showSpaceCreateInput() {
    const spaceList = document.getElementById('space-list');
    if (!spaceList) return;

    const existing = spaceList.querySelector('.space-create-wrapper');
    if (existing) {
        const existingInput = existing.querySelector('input');
        if (existingInput && existingInput._finish) existingInput._finish(true);
        existing.remove();
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'space-create-wrapper space-item';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'space-item-icon';
    iconDiv.style.background = SPACE_COLORS[TixupAuth.getSpaces().length % SPACE_COLORS.length];
    const addIcon = document.createElement('span');
    addIcon.className = 'material-icons-outlined';
    addIcon.style.fontSize = '14px';
    addIcon.textContent = 'add';
    iconDiv.appendChild(addIcon);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'space-create-input';
    input.placeholder = 'Space name...';
    input.style.paddingLeft = '8px';

    wrapper.appendChild(iconDiv);
    wrapper.appendChild(input);
    spaceList.appendChild(wrapper);
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
    input._finish = finish;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') finish(true); });
    input.addEventListener('blur', () => setTimeout(finish, 100));
}

function switchSpace(spaceId) {
    try { saveData(); } catch (e) { }
    TixupAuth.setActiveSpaceId(spaceId);
    const saved = localStorage.getItem(getStorageKey());
    TixupState.tasks = saved ? JSON.parse(saved) : [];
    setView('list');
    TixupState.panOffset = UI_CONSTANTS.CENTER_PX - (UI_CONSTANTS.VIRTUAL_WIDTH / 2);
    window.__tixupScrollInitialized = false;
    renderSpaceList();
    renderAll();
}
