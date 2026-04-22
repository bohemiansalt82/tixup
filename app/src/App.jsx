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
  const { tasks, exitingIds, newIds, addTask, addChild, removeTask, updateTask, toggleCollapse, moveTask } = useTaskStore();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentView, setCurrentView] = useState('timeline');

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

  const handleRename = useCallback((id, name) => {
    if (name === null) removeTask(id);
    else updateTask(id, { title: name });
  }, [removeTask, updateTask]);

  const handleSaveBarPositions = useCallback((updates) => {
    updates.forEach(({ id, start, width }) => updateTask(id, { start, width }));
  }, [updateTask]);

  useEffect(() => {
    const sidebar = document.getElementById('sidebar-container');
    const viewport = document.getElementById('viewport-container');
    if (!sidebar || !viewport) return;

    let syncing = false;

    const fromSidebar = () => {
      if (syncing) return;
      syncing = true;
      viewport.scrollTop = sidebar.scrollTop;
      syncing = false;
    };

    const fromViewport = () => {
      if (syncing) return;
      syncing = true;
      sidebar.scrollTop = viewport.scrollTop;
      syncing = false;
    };

    sidebar.addEventListener('scroll', fromSidebar, { passive: true });
    viewport.addEventListener('scroll', fromViewport, { passive: true });

    return () => {
      sidebar.removeEventListener('scroll', fromSidebar);
      viewport.removeEventListener('scroll', fromViewport);
    };
  }, []);

  const handleDeleteSelected = useCallback(() => {
    selectedIds.forEach(id => removeTask(id));
    setSelectedIds(new Set());
  }, [selectedIds, removeTask]);

  const handleChangeStatus = useCallback((status) => {
    selectedIds.forEach(id => updateTask(id, { status }));
    setSelectedIds(new Set());
  }, [selectedIds, updateTask]);

  return (
    <div className="tixup-root" style={{ display: 'flex', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main className="guide-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <AppHeader currentView={currentView} onViewChange={setCurrentView} />

        <section
          className="timeline-grid-container"
          id="data-grid-timeline"
          style={{ display: currentView === 'timeline' ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}
        >
          <div className="timeline-grid-main" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <TaskGrid
              tasks={tasks}
              exitingIds={exitingIds}
              newIds={newIds}
              selectedIds={selectedIds}
              onSelect={handleSelect}
              onToggle={toggleCollapse}
              onAddChild={addChild}
              onRename={handleRename}
              onStatusChange={(id, status) => updateTask(id, { status })}
              onCreateTix={addTask}
              onMoveTask={moveTask}
            />
            <TimelineView
              tasks={tasks}
              exitingIds={exitingIds}
              newIds={newIds}
              onSaveBarPositions={handleSaveBarPositions}
            />
          </div>
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
