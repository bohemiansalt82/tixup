/**
 * TixupAuth - Client-side authentication & space management
 * Stores user info and spaces in localStorage.
 * Supports demo login and future Google OAuth integration.
 */
const TixupAuth = (() => {
    const USER_KEY = 'tixup-user';
    const ACTIVE_SPACE_KEY = 'tixup-active-space';
    const OLD_TASKS_KEY = 'tixup-tasks'; // Legacy key for migration

    function getUser() {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    function setUser(user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    }

    function logout() {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ACTIVE_SPACE_KEY);
        window.location.href = 'login.html';
    }

    function requireAuth() {
        if (!getUser()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    }

    // --- Space Management ---
    function _spacesKey(userId) {
        return `tixup-spaces-${userId}`;
    }

    function getSpaces() {
        const user = getUser();
        if (!user) return [];
        try {
            const raw = localStorage.getItem(_spacesKey(user.id));
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    function saveSpaces(spaces) {
        const user = getUser();
        if (!user) return;
        localStorage.setItem(_spacesKey(user.id), JSON.stringify(spaces));
    }

    function createSpace(name) {
        const spaces = getSpaces();
        const space = {
            id: 'space-' + Date.now(),
            name: name || 'New Space',
            createdAt: new Date().toISOString()
        };
        spaces.push(space);
        saveSpaces(spaces);
        return space;
    }

    function deleteSpace(spaceId) {
        let spaces = getSpaces();
        spaces = spaces.filter(s => s.id !== spaceId);
        saveSpaces(spaces);
        // Also remove task data for this space
        localStorage.removeItem(`tixup-tasks-${spaceId}`);
        return spaces;
    }

    function renameSpace(spaceId, newName) {
        const spaces = getSpaces();
        const space = spaces.find(s => s.id === spaceId);
        if (space) {
            space.name = newName;
            saveSpaces(spaces);
        }
        return spaces;
    }

    function getActiveSpaceId() {
        return localStorage.getItem(ACTIVE_SPACE_KEY);
    }

    function setActiveSpaceId(spaceId) {
        localStorage.setItem(ACTIVE_SPACE_KEY, spaceId);
    }

    function getTasksKey(spaceId) {
        return `tixup-tasks-${spaceId}`;
    }

    // Migrate old data to first space on first login
    function migrateOldData() {
        const oldData = localStorage.getItem(OLD_TASKS_KEY);
        if (!oldData) return;

        const spaces = getSpaces();
        let targetSpace;
        if (spaces.length === 0) {
            targetSpace = createSpace('My First Space');
        } else {
            targetSpace = spaces[0];
        }

        // Move old tasks to the first space
        localStorage.setItem(getTasksKey(targetSpace.id), oldData);
        localStorage.removeItem(OLD_TASKS_KEY);
        setActiveSpaceId(targetSpace.id);
    }

    // Demo login (no Google OAuth needed)
    function demoLogin(name, email) {
        const user = {
            id: 'demo-' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16),
            name: name,
            email: email,
            picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6C5CE7&color=fff&size=128`
        };
        setUser(user);
        migrateOldData();

        // Create default space if none exist
        if (getSpaces().length === 0) {
            const space = createSpace('My Project');
            setActiveSpaceId(space.id);
        }
        return user;
    }

    return {
        getUser,
        setUser,
        logout,
        requireAuth,
        getSpaces,
        saveSpaces,
        createSpace,
        deleteSpace,
        renameSpace,
        getActiveSpaceId,
        setActiveSpaceId,
        getTasksKey,
        migrateOldData,
        demoLogin
    };
})();
