/**
 * Tixup Common Components Logic
 * Handles Data Grid, Timeline, and Drag-and-Drop interactions.
 */

class TixupCore {
    constructor() {
        this.indicatorLine = null;
        this.lastDropTarget = null;
        this.gridSize = 48; // Unit width for 1 day in timeline
    }

    init() {
        this.createIndicatorLine();
        this.initEventListeners();
        this.initSortable();
        // this.initTimelineInteraction(); // DISABLED: conflicts with test-drive-script
        this.syncScroll();
    }

    createIndicatorLine() {
        if (!document.querySelector('.drop-indicator-line')) {
            this.indicatorLine = document.createElement('div');
            this.indicatorLine.className = 'drop-indicator-line';
            document.body.appendChild(this.indicatorLine);
        } else {
            this.indicatorLine = document.querySelector('.drop-indicator-line');
        }
    }

    initEventListeners() {
        // 1. Click Interaction
        document.addEventListener('click', (e) => {
            // Toggle Expander
            const expander = e.target.closest('.tree-expander');
            if (expander && !expander.classList.contains('empty')) {
                this.handleToggle(expander);
                return;
            }

            // Add Child Button (handled in page script, but included here for consistency)
            const addBtn = e.target.closest('.add-child-btn');
            if (addBtn) return;
        });

        // 2. Hover Effects
        document.addEventListener('mouseover', (e) => {
            const row = e.target.closest('.data-grid-row');
            if (row && !row.classList.contains('grid-child-row')) {
                const btn = row.querySelector('.add-child-btn');
                if (btn) btn.style.opacity = '1';
            }
        });
        document.addEventListener('mouseout', (e) => {
            const row = e.target.closest('.data-grid-row');
            if (row && !row.classList.contains('grid-child-row')) {
                const btn = row.querySelector('.add-child-btn');
                if (btn) btn.style.opacity = '0';
            }
        });

        // 3. Robust Manual Double-Click Detection on Timeline Bar (Bypasses drag conflict)
        let lastBarClickTime = 0;
        let lastBarTarget = null;
        document.addEventListener('mousedown', (e) => {
            const bar = e.target.closest('.timeline-bar');
            if (bar) {
                const now = Date.now();
                const timeSinceLast = now - lastBarClickTime;
                
                if (timeSinceLast < 500 && lastBarTarget === bar) {
                    const timelineRow = bar.closest('.timeline-row, .timeline-tbody-row');
                    const isParent = timelineRow && timelineRow.getAttribute('data-type') === 'parent';
                    
                    if (isParent) {
                        console.log("%c[Tixup] SUCCESS: Timeline Bar Auto-Resize Triggered", "background: #00bcd4; color: white; padding: 2px 5px; border-radius: 3px; font-weight: bold;");
                        // We need to find the sidebar row equivalent to pass to handleAutoResize
                        const groupId = timelineRow.getAttribute('data-group');
                        const sidebarRow = document.querySelector(`.data-grid-row[data-group="${groupId}"]`);
                        if (sidebarRow) {
                            this.handleAutoResize(sidebarRow);
                        } else {
                            // Fallback if full grid is used or ID mapping is direct
                            this.handleAutoResize(timelineRow);
                        }
                        lastBarClickTime = 0; // Reset
                    }
                } else {
                    lastBarClickTime = now;
                    lastBarTarget = bar;
                }
            }
        }, true); // USE CAPTURING to win against stopPropagation in other scripts








    }

    handleToggle(expander) {
        const row = expander.closest('.data-grid-row');
        const groupName = row.getAttribute('data-group');
        if (!groupName) return;

        const isExpanded = expander.classList.contains('expanded');
        const container = expander.closest('.timeline-grid-container') || document.body;
        const children = container.querySelectorAll(`.grid-child-row[data-parent="${groupName}"]`);

        if (isExpanded) {
            // Collapsing
            expander.classList.remove('expanded');
            expander.classList.add('collapsed');
            children.forEach(child => child.classList.add('collapsed'));
        } else {
            // Expanding
            expander.classList.remove('collapsed');
            expander.classList.add('expanded');
            children.forEach(child => child.classList.remove('collapsed'));
        }
    }



    syncScroll() {
        const sidebar = document.querySelector('.timeline-sidebar');
        const viewport = document.querySelector('.timeline-view-viewport');

        if (sidebar && viewport) {
            let isScrollingSidebar = false;
            let isScrollingViewport = false;

            sidebar.addEventListener('scroll', () => {
                if (isScrollingViewport) {
                    isScrollingViewport = false;
                    return;
                }
                isScrollingSidebar = true;
                viewport.scrollTop = sidebar.scrollTop;
            }, { passive: true });

            viewport.addEventListener('scroll', () => {
                if (isScrollingSidebar) {
                    isScrollingSidebar = false;
                    return;
                }
                isScrollingViewport = true;
                sidebar.scrollTop = viewport.scrollTop;
            }, { passive: true });
        }
    }

    initSortable() {

        const containers = document.querySelectorAll('.data-grid-container, .timeline-sidebar, #grid-tbody');
        containers.forEach(container => {
            if (container._sortable) return;
            container._sortable = new Sortable(container, {
                animation: 0,
                handle: '.data-grid-row',
                draggable: '.data-grid-row:not(.data-grid-header):not(.data-grid-footer)',
                filter: '.tree-expander, .add-child-btn, .checkbox-container, button, input',
                preventOnFilter: true,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                forceFallback: true,
                onStart: (evt) => {
                    this.lastDropTarget = null;
                    if (this.indicatorLine) this.indicatorLine.style.display = 'none';
                    document.body.classList.add('dragging-active');
                    document.documentElement.classList.add('dragging-active');
                    window.getSelection().removeAllRanges(); // Clear any existing selection
                },




                onMove: (evt) => {
                    const dragEl = evt.dragged;
                    const targetEl = evt.related;
                    document.querySelectorAll('.drop-indicator-nest-active').forEach(el => el.classList.remove('drop-indicator-nest-active'));
                    if (targetEl && targetEl !== dragEl && !targetEl.classList.contains('data-grid-header')) {
                        const isDragChild = dragEl.getAttribute('data-type') === 'child';
                        const targetType = targetEl.getAttribute('data-type');
                        if (isDragChild) {
                            if (targetType === 'parent') {
                                targetEl.classList.add('drop-indicator-nest-active');
                                this.indicatorLine.style.display = 'none';
                                this.lastDropTarget = { element: targetEl, type: 'nest' };
                            } else {
                                this.showIndicator(targetEl);
                                this.lastDropTarget = { element: targetEl, type: 'before' };
                            }
                        } else {
                            // If dragging parent, we allow dropping before ANY row (parent or child)
                            this.showIndicator(targetEl, 'before');
                            this.lastDropTarget = { element: targetEl, type: 'before' };
                        }

                    } else {
                        this.indicatorLine.style.display = 'none';
                        this.lastDropTarget = null;
                    }
                    return true;
                },

                onEnd: (evt) => {
                    const item = evt.item;
                    const drop = this.lastDropTarget;
                    if (this.indicatorLine) this.indicatorLine.style.display = 'none';
                    document.querySelectorAll('.drop-indicator-nest-active').forEach(el => el.classList.remove('drop-indicator-nest-active'));
                    if (drop && drop.element !== item) {
                        const container = item.parentNode;
                        const itemId = item.getAttribute('data-group');
                        if (drop.type === 'nest') {
                            const newParentId = drop.element.getAttribute('data-group');
                            item.setAttribute('data-parent', newParentId);
                            item.setAttribute('data-type', 'child');
                            container.insertBefore(item, drop.element.nextSibling);
                            this.updateRowHierarchyUI(item, true);
                            this.updateParentExpander(drop.element);
                        } else {
                            container.insertBefore(item, drop.element);
                            if (item.getAttribute('data-type') === 'parent') {
                                const children = Array.from(container.querySelectorAll(`.grid-child-row[data-parent="${itemId}"]`));
                                // Append children one by one in correct order after the parent
                                let nextRef = item.nextSibling;
                                children.forEach(c => {
                                    container.insertBefore(c, nextRef);
                                });
                            }
 else {
                                const targetParent = drop.element.getAttribute('data-parent');
                                if (targetParent) {
                                    item.setAttribute('data-parent', targetParent);
                                    item.setAttribute('data-type', 'child');
                                    this.updateRowHierarchyUI(item, true);
                                } else {
                                    item.removeAttribute('data-parent');
                                    item.setAttribute('data-type', 'parent');
                                    this.updateRowHierarchyUI(item, false);
                                }
                            }
                        }
                    }
                    this.syncTimelineOrder();
                    document.body.classList.remove('dragging-active');
                    document.documentElement.classList.remove('dragging-active');
                    document.dispatchEvent(new CustomEvent('tixup:data-changed'));

                }


            });
        });
    }

    showIndicator(targetEl) {
        const rect = targetEl.getBoundingClientRect();
        this.indicatorLine.style.display = 'block';
        this.indicatorLine.style.top = `${window.scrollY + rect.top}px`;
        this.indicatorLine.style.left = `${rect.left}px`;
        this.indicatorLine.style.width = `${rect.width}px`;
    }

    updateRowHierarchyUI(row, isChild) {
        const titleContainer = row.querySelector('.row-title-container');
        if (!titleContainer) return;
        if (isChild) {
            titleContainer.classList.add('depth-2');
            row.classList.add('grid-child-row');
            row.classList.remove('level-0');
            row.setAttribute('data-type', 'child');
            const exp = titleContainer.querySelector('.tree-expander');
            if (exp) exp.remove();
            const addBtn = titleContainer.querySelector('.add-child-btn');
            if (addBtn) addBtn.remove();
            const tixIcon = titleContainer.querySelector('.nav-icon.icon-tix');
            if (tixIcon) { tixIcon.classList.remove('icon-tix'); tixIcon.classList.add('icon-stat'); }
        } else {
            titleContainer.classList.remove('depth-2');
            row.classList.remove('grid-child-row');
            row.classList.add('level-0');
            row.setAttribute('data-type', 'parent');
            row.removeAttribute('data-parent');
            const statIcon = titleContainer.querySelector('.nav-icon.icon-stat');
            if (statIcon) { statIcon.classList.remove('icon-stat'); statIcon.classList.add('icon-tix'); }
            if (!titleContainer.querySelector('.add-child-btn')) {
                const b = document.createElement('button');
                b.className = 'add-child-btn';
                b.innerHTML = '<div class="nav-icon icon-add"></div>';
                titleContainer.appendChild(b);
            }
        }
    }

    updateParentExpander(parentRow) {
        let exp = parentRow.querySelector('.tree-expander');
        if (!exp) {
            const tc = parentRow.querySelector('.row-title-container');
            exp = document.createElement('button');
            exp.className = 'tree-expander expanded';
            exp.innerHTML = '<div class="nav-icon icon-chevron-lg-bottom"></div>';
            tc.insertBefore(exp, tc.firstChild);
        }
        exp.classList.remove('empty');
        exp.style.opacity = '1';
        exp.style.pointerEvents = 'auto';
    }

    syncTimelineOrder() {
        const sidebar = document.getElementById('grid-tbody') || document.querySelector('.timeline-sidebar');
        const timelineBody = document.getElementById('timeline-tbody') || document.querySelector('.timeline-body');
        if (!sidebar || !timelineBody) return;
        const rows = Array.from(sidebar.querySelectorAll('.data-grid-row:not(.data-grid-header)'));
        
        rows.forEach((r, index) => {
            const id = r.getAttribute('data-group');
            const vRow = timelineBody.querySelector(`[data-group="${id}"]`);
            if (vRow) {
                // 1. Sync DOM Position
                if (timelineBody.children[index] !== vRow) {
                    timelineBody.insertBefore(vRow, timelineBody.children[index]);
                }
                
                // 2. Sync Hierarchy Attributes & Classes (Crucial for Toggle Animation)
                const type = r.getAttribute('data-type');
                const parentId = r.getAttribute('data-parent');
                vRow.setAttribute('data-type', type || 'parent');
                if (parentId) vRow.setAttribute('data-parent', parentId);
                else vRow.removeAttribute('data-parent');

                if (type === 'child') {
                    vRow.classList.add('grid-child-row');
                } else {
                    vRow.classList.remove('grid-child-row');
                }

                // 3. Sync Collapsed State
                if (r.classList.contains('collapsed')) {
                    vRow.classList.add('collapsed');
                } else {
                    vRow.classList.remove('collapsed');
                }
            }
        });
    }



    handleAutoResize(parentRow) {
        const groupId = parentRow.getAttribute('data-group');
        // Robustly find the timeline body
        const timelineBody = document.getElementById('timeline-tbody') || document.querySelector('.timeline-body #timeline-tbody');
        if (!timelineBody) {
            console.error('[TixupCore] timeline-tbody not found for auto-resize');
            return;
        }

        // Find all bars belonging to children of this group
        const children = Array.from(timelineBody.querySelectorAll(`[data-parent="${groupId}"] .timeline-bar`));
        if (children.length === 0) {
             console.log('[TixupCore] No children found for auto-resize of group:', groupId);
             return;
        }

        let minLeft = Infinity;
        let maxRight = -Infinity;

        children.forEach(bar => {
            const left = parseInt(bar.style.left) || 0;
            const width = parseInt(bar.style.width) || 0;
            minLeft = Math.min(minLeft, left);
            maxRight = Math.max(maxRight, left + width);
        });

        // Find the parent's bar in the timeline
        const parentBarRow = timelineBody.querySelector(`[data-group="${groupId}"]`);

        const parentBar = parentBarRow ? parentBarRow.querySelector('.timeline-bar') : null;
        
        if (parentBar) {
            parentBar.style.left = minLeft + 'px';
            parentBar.style.width = (maxRight - minLeft) + 'px';
            
            // Sync labels if needed
            const label = parentBar.querySelector('.timeline-bar-label');
            if (label) {
                const gridRow = document.querySelector(`.data-grid-row[data-group="${groupId}"]`);
                if (gridRow) label.innerText = gridRow.querySelector('.data-grid-text').innerText;
            }
            
            this.syncTimelineOrder();
            document.dispatchEvent(new CustomEvent('tixup:data-changed'));
        } else {
            console.error('[TixupCore] Parent bar not found in timeline for auto-resize');
        }
    }




}

// Global instance
window.tixupCore = new TixupCore();
document.addEventListener('DOMContentLoaded', () => window.tixupCore.init());
