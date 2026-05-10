import { useState, useCallback, useEffect } from 'react';
import { Sidebar } from './components/Layout/Sidebar';
import { AppHeader } from './components/Layout/AppHeader';
import { TaskGrid } from './components/Grid/TaskGrid';
import { TimelineView } from './components/Timeline/TimelineView';
import { SelectionBar } from './components/Shared/SelectionBar';
import { useTaskStore } from './store/useTaskStore';
import './tokens.css';
import './components.css';
import './icons.css';

export default function App() {
  const { tasks, exitingIds, newIds, collapsingParentIds, expandingParentIds, addTask, addChild, removeTask, updateTask, toggleCollapse, moveTask } = useTaskStore();
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
      const el = document.querySelector(`[data-row-id="${newId}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 50);
  }, [tasks, addChild, toggleCollapse]);

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
    addTask('');
    setTimeout(() => {
      const sidebar = document.getElementById('sidebar-container');
      if (sidebar) sidebar.scrollTop = sidebar.scrollHeight;
    }, 50);
  }, [addTask]);

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
      <Sidebar />
      <main className="guide-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <AppHeader currentView={currentView} onViewChange={setCurrentView} />

        <section
          className="timeline-grid-container"
          id="data-grid-timeline"
          style={{ display: currentView === 'timeline' ? 'flex' : 'none', flex: 1, overflow: 'hidden', flexDirection: 'column' }}
        >
          <div className="timeline-grid-main" style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <TaskGrid
              tasks={tasks}
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
              tasks={tasks}
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
          style={{ display: currentView === 'list' ? 'flex' : 'none', flex: 1 }}
        >
          <p style={{ padding: 24, color: 'var(--primitive-colors-gray-400)' }}>List view — coming soon</p>
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
