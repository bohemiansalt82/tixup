import { useState, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { SignUp } from './components/Auth/SignUp';
import { Login } from './components/Auth/Login';
import { useAuth } from './store/useAuth';
import { Gnb } from './components/Layout/Gnb';
import { TopBar } from './components/Layout/TopBar';
import { TaskGrid } from './components/Grid/TaskGrid';
import { TimelineView } from './components/Timeline/TimelineView';
import { ListView } from './components/List/ListView';
import { SelectionBar } from './components/Shared/SelectionBar';
import { useTaskStore } from './store/useTaskStore';
import { useSpaces, useSpaceSync, joinSpace as joinSpaceForUser } from './store/useSpaces';
import { parseInviteHash, resolveInvite, stashPendingInvite, takePendingInvite } from './store/invites';
import './tokens.css';
import './components.css';
import './icons.css';

function subscribeHash(callback) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export default function App() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash);
  const user = useAuth();
  // Account profile (spaces + boxes) lives on the backend; sync it for the signed-in user.
  useSpaceSync(user);
  const { activeSpace, ready } = useSpaces();

  // Invite links (#join=<id> / legacy #invite=...): stash on arrival so the login flow can
  // clear the hash, then join once a user is signed in. One effect so a link opened in an
  // already signed-in tab (hash change, no reload) joins immediately too.
  useEffect(() => {
    const invite = parseInviteHash(hash);
    if (invite) {
      stashPendingInvite(invite);
      history.replaceState(null, '', window.location.pathname + window.location.search);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    if (!user) return;
    const pending = takePendingInvite();
    if (!pending) return;
    const userId = user.id;
    resolveInvite(pending).then((resolved) => { if (resolved) joinSpaceForUser(userId, resolved); });
  }, [hash, user]);
  if (!user) return hash === '#signup' ? <SignUp /> : <Login />;
  // Wait for the account's space list before showing anything, so a fresh browser never
  // starts on a made-up default space while the real ones are still loading.
  if (!ready) return <SyncSplash />;
  // Keyed by space so task state reloads when the active space changes.
  return <Dashboard key={activeSpace?.id ?? 'none'} spaceId={activeSpace?.id ?? null} />;
}

function SyncSplash() {
  return (
    <div className="tixup-root sync-splash" role="status" aria-live="polite">
      <div className="sync-splash-spinner" />
      <span className="sync-splash-text">Loading your spaces…</span>
    </div>
  );
}

function Dashboard({ spaceId }) {
  const user = useAuth();
  const { activeSpace, activeBox } = useSpaces();
  const { tasks, exitingIds, newIds, collapsingParentIds, expandingParentIds, remoteMembers, addTask, addChild, removeTask, updateTask, toggleCollapse, moveTask } = useTaskStore(spaceId, { space: activeSpace, user });
  // Assignee candidates: me, emails invited locally, and members recorded on the shared space.
  const members = useMemo(() => {
    const list = [];
    const add = (email, name, picture) => {
      if (!email || list.some(m => m.email === email)) return;
      list.push({ email, name: name || email.split('@')[0], picture: picture || null });
    };
    if (user) add(user.email, user.name, user.picture);
    remoteMembers.forEach(m => add(m.email, m.name));
    (activeSpace?.members || []).forEach(email => add(email));
    return list;
  }, [user, remoteMembers, activeSpace]);
  // My Tasks shows every task in the space; a selected box narrows it down.
  const visibleTasks = activeBox ? tasks.filter(t => t.boxId === activeBox.id) : tasks;
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentView, setCurrentView] = useState('timeline');
  const [sidebarOverflow, setSidebarOverflow] = useState(false);

  const handleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      const isParent = tasks.find(t => t.id === id)?.type === 'parent';
      const children = isParent ? tasks.filter(t => t.parentId === id).map(t => t.id) : [];
      if (s.has(id)) {
        s.delete(id);
        children.forEach(cid => s.delete(cid));
      } else {
        s.add(id);
        children.forEach(cid => s.add(cid));
      }
      return s;
    });
  }, [tasks]);

  const handleSelectAll = useCallback((ids) => {
    setSelectedIds(new Set(ids));
  }, []);

  const handleAddChild = useCallback((parentId) => {
    const parent = tasks.find(t => t.id === parentId);
    if (parent?.collapsed) toggleCollapse(parentId);
    const newId = addChild(parentId);
    setTimeout(() => {
      const scope = currentView === 'list' ? '#full-data-grid ' : '#sidebar-container ';
      const el = document.querySelector(`${scope}[data-row-id="${newId}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 50);
  }, [tasks, addChild, toggleCollapse, currentView]);

  const handleRename = useCallback((id, name) => {
    if (name === null) removeTask(id);
    else updateTask(id, { title: name });
  }, [removeTask, updateTask]);

  const handleSaveBarPositions = useCallback((updates) => {
    updates.forEach(({ id, start, width }) => updateTask(id, { start, width }));
  }, [updateTask]);

  // 스크롤 동기화
  useEffect(() => {
    const sidebar = document.getElementById('sidebar-container');
    const viewport = document.getElementById('viewport-container');
    if (!sidebar || !viewport) return;

    let syncing = false;
    const fromSidebar = () => { if (syncing) return; syncing = true; viewport.scrollTop = sidebar.scrollTop; syncing = false; };
    const fromViewport = () => { if (syncing) return; syncing = true; sidebar.scrollTop = viewport.scrollTop; syncing = false; };

    sidebar.addEventListener('scroll', fromSidebar, { passive: true });
    viewport.addEventListener('scroll', fromViewport, { passive: true });
    return () => {
      sidebar.removeEventListener('scroll', fromSidebar);
      viewport.removeEventListener('scroll', fromViewport);
    };
  }, []);

  // 사이드바 overflow 감지
  useEffect(() => {
    const check = () => {
      const sidebar = document.getElementById('sidebar-container');
      if (sidebar) setSidebarOverflow(sidebar.scrollHeight > sidebar.clientHeight);
    };
    check();
    const ro = new ResizeObserver(check);
    const sidebar = document.getElementById('sidebar-container');
    const tbody = document.getElementById('grid-tbody');
    if (sidebar) ro.observe(sidebar);
    if (tbody) ro.observe(tbody);
    return () => ro.disconnect();
  }, []);

  const handleDeleteSelected = useCallback(() => {
    selectedIds.forEach(id => removeTask(id));
    setSelectedIds(new Set());
  }, [selectedIds, removeTask]);

  const handleChangeStatus = useCallback((status) => {
    selectedIds.forEach(id => updateTask(id, { status }));
    setSelectedIds(new Set());
  }, [selectedIds, updateTask]);

  const handleCreateTix = useCallback(() => {
    addTask('', activeBox?.id ?? null);
    setTimeout(() => {
      const el = document.getElementById(currentView === 'list' ? 'full-grid-tbody' : 'sidebar-container');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }, [addTask, activeBox, currentView]);

  const footer = (
    <div className="timeline-footer-row">
      <div className="timeline-footer-cell">
        <button className="grid-create-btn" onClick={handleCreateTix}>
          <div className="nav-icon icon-add" />
          <span className="data-grid-text">Create Tix</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="tixup-root" style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <Gnb tasks={tasks} />
      <main className="guide-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar
          title={activeBox?.name ?? activeSpace?.name ?? 'My Space'}
          currentView={currentView}
          onViewChange={setCurrentView}
          taskCount={visibleTasks.length}
        />

        <section
          className="timeline-grid-container"
          id="data-grid-timeline"
          style={{ display: currentView === 'timeline' ? 'flex' : 'none', flex: 1, overflow: 'hidden', flexDirection: 'column' }}
        >
          <div className="timeline-grid-main" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <TaskGrid
              tasks={visibleTasks}
              exitingIds={exitingIds}
              newIds={newIds}
              collapsingParentIds={collapsingParentIds}
              expandingParentIds={expandingParentIds}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onSelectAll={handleSelectAll}
              onToggle={toggleCollapse}
              onAddChild={handleAddChild}
              onRename={handleRename}
              onStatusChange={(id, status) => updateTask(id, { status })}
              onCreateTix={sidebarOverflow ? undefined : handleCreateTix}
              onMoveTask={moveTask}
            />
            <TimelineView
              tasks={visibleTasks}
              exitingIds={exitingIds}
              newIds={newIds}
              collapsingParentIds={collapsingParentIds}
              expandingParentIds={expandingParentIds}
              onSaveBarPositions={handleSaveBarPositions}
            />
          </div>
          {sidebarOverflow && footer}
        </section>

        <section
          id="full-data-grid"
          className="lv-section"
          style={{ display: currentView === 'list' ? 'flex' : 'none', flex: 1, minHeight: 0 }}
        >
          <ListView
            tasks={visibleTasks}
            exitingIds={exitingIds}
            newIds={newIds}
            selectedIds={selectedIds}
            members={members}
            currentUser={user}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onToggle={toggleCollapse}
            onAddChild={handleAddChild}
            onRename={handleRename}
            onStatusChange={(id, status) => updateTask(id, { status })}
            onUpdateTask={updateTask}
            onCreateTix={handleCreateTix}
          />
        </section>
      </main>

      <SelectionBar
        selectedIds={selectedIds}
        onDelete={handleDeleteSelected}
        onChangeStatus={handleChangeStatus}
      />
    </div>
  );
}
