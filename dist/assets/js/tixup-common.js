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
            row.classList.add('collapsed'); // Mark the parent row itself
            children.forEach(child => child.classList.add('collapsed'));
        } else {
            // Expanding
            expander.classList.remove('collapsed');
            expander.classList.add('expanded');
            row.classList.remove('collapsed');
            children.forEach(child => child.classList.remove('collapsed'));
        }

        // Persist the state change
        if (window.tixupSaveData) window.tixupSaveData();
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
            // Support re-initialization by destroying existing instance
            if (container._sortable) {
                container._sortable.destroy();
            }

            // mousemove handler for custom drop detection
            let dragMouseHandler = null;
            let draggedItem = null;

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
                    draggedItem = evt.item;
                    if (this.indicatorLine) this.indicatorLine.style.display = 'none';
                    document.body.classList.add('dragging-active');
                    document.documentElement.classList.add('dragging-active');
                    window.getSelection().removeAllRanges();

                    // Attach mousemove for custom hit-testing
                    dragMouseHandler = (e) => {
                        this._handleDragMove(e, draggedItem, container);
                    };
                    document.addEventListener('mousemove', dragMouseHandler);
                },

                onMove: () => {
                    // Block SortableJS from moving DOM elements during drag
                    return false;
                },

                onEnd: (evt) => {
                    // Remove mousemove handler
                    if (dragMouseHandler) {
                        document.removeEventListener('mousemove', dragMouseHandler);
                        dragMouseHandler = null;
                    }
                    draggedItem = null;

                    const item = evt.item;
                    const drop = this.lastDropTarget;
                    if (this.indicatorLine) this.indicatorLine.style.display = 'none';
                    document.querySelectorAll('.drop-indicator-nest-active').forEach(el => el.classList.remove('drop-indicator-nest-active'));

                    if (!drop || drop.element === item) {
                        // No valid drop target - do nothing
                        this.syncTimelineOrder();
                        document.body.classList.remove('dragging-active');
                        document.documentElement.classList.remove('dragging-active');
                        return;
                    }

                    const container = item.parentNode;
                    const itemId = item.getAttribute('data-group');
                    const wasParent = item.getAttribute('data-type') === 'parent';

                    if (wasParent) {
                        // === PARENT DRAG: reorder among parents, children follow ===
                        let refEl = drop.element;
                        if (drop.type === 'after') {
                            // Drop after parent's last child
                            const groupId = refEl.getAttribute('data-group');
                            const groupChildren = container.querySelectorAll(`.grid-child-row[data-parent="${groupId}"]`);
                            refEl = groupChildren.length > 0 ? groupChildren[groupChildren.length - 1] : refEl;
                            container.insertBefore(item, refEl.nextSibling);
                        } else {
                            container.insertBefore(item, refEl);
                        }
                        // Ensure parent stays parent
                        item.removeAttribute('data-parent');
                        item.setAttribute('data-type', 'parent');
                        this.updateRowHierarchyUI(item, false);

                        // Move all its children right after it
                        const ownChildren = Array.from(container.querySelectorAll(`.grid-child-row[data-parent="${itemId}"]`));
                        let nextRef = item.nextSibling;
                        ownChildren.forEach(c => {
                            container.insertBefore(c, nextRef);
                        });

                    } else {
                        // === CHILD DRAG: always stays child, assign to target parent ===
                        let newParentId = null;

                        if (drop.type === 'nest') {
                            // Direct nesting onto a parent
                            newParentId = drop.element.getAttribute('data-group');
                            // Insert as first child (right after parent)
                            container.insertBefore(item, drop.element.nextSibling);
                        } else {
                            // Dropped before/after a row - determine which parent group
                            const dropTarget = drop.element;
                            if (dropTarget.getAttribute('data-type') === 'parent') {
                                newParentId = dropTarget.getAttribute('data-group');
                                if (drop.type === 'after') {
                                    // Insert as last child of this parent
                                    const groupChildren = container.querySelectorAll(`.grid-child-row[data-parent="${newParentId}"]`);
                                    const lastChild = groupChildren.length > 0 ? groupChildren[groupChildren.length - 1] : dropTarget;
                                    container.insertBefore(item, lastChild.nextSibling);
                                } else {
                                    // 'before' a parent → insert as last child of PREVIOUS parent
                                    // Find the previous parent
                                    const allParents = Array.from(container.querySelectorAll('.data-grid-row[data-type="parent"]'));
                                    const targetIdx = allParents.indexOf(dropTarget);
                                    if (targetIdx > 0) {
                                        const prevParent = allParents[targetIdx - 1];
                                        newParentId = prevParent.getAttribute('data-group');
                                        const groupChildren = container.querySelectorAll(`.grid-child-row[data-parent="${newParentId}"]`);
                                        const lastChild = groupChildren.length > 0 ? groupChildren[groupChildren.length - 1] : prevParent;
                                        container.insertBefore(item, lastChild.nextSibling);
                                    } else {
                                        // No previous parent, insert under this parent
                                        newParentId = dropTarget.getAttribute('data-group');
                                        container.insertBefore(item, dropTarget.nextSibling);
                                    }
                                }
                            } else {
                                // Dropped near a child → same parent as that child
                                newParentId = dropTarget.getAttribute('data-parent');
                                if (drop.type === 'after') {
                                    container.insertBefore(item, dropTarget.nextSibling);
                                } else {
                                    container.insertBefore(item, dropTarget);
                                }
                            }
                        }

                        // Enforce: child ALWAYS remains a child
                        if (newParentId) {
                            item.setAttribute('data-parent', newParentId);
                            item.setAttribute('data-type', 'child');
                            this.updateRowHierarchyUI(item, true);
                            // Update parent expander
                            const parentRow = container.querySelector(`.data-grid-row[data-group="${newParentId}"]`);
                            if (parentRow) {
                                this.updateParentExpander(parentRow);
                                // Auto-expand if collapsed so user can see the dropped child
                                if (parentRow.classList.contains('collapsed')) {
                                    const expander = parentRow.querySelector('.tree-expander');
                                    if (expander) {
                                        this.handleToggle(expander);
                                    }
                                }
                            }
                            // Ensure the dropped child itself is visible (not collapsed)
                            item.classList.remove('collapsed');
                        }
                        // Update old parent's expander (may need to hide if no children left)
                        const oldParentId = evt.item.getAttribute('data-parent');
                        if (oldParentId && oldParentId !== newParentId) {
                            // Old parent expander update handled by data-changed event
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

    _handleDragMove(e, draggedItem, container) {
        const mouseY = e.clientY;
        document.querySelectorAll('.drop-indicator-nest-active').forEach(el => el.classList.remove('drop-indicator-nest-active'));

        const isDragParent = draggedItem.getAttribute('data-type') === 'parent';
        const isDragChild = !isDragParent;
        const dragParentId = draggedItem.getAttribute('data-parent'); // child's current parent

        // Get all rows excluding the dragged item
        const allRows = Array.from(container.querySelectorAll('.data-grid-row:not(.data-grid-header):not(.data-grid-footer)'))
            .filter(r => r !== draggedItem && !r.classList.contains('sortable-drag'));

        // Filter eligible rows based on drag type
        let eligibleRows;
        if (isDragParent) {
            // Parent can only drop between other parents
            eligibleRows = allRows.filter(r => r.getAttribute('data-type') === 'parent');
        } else {
            // Child can drop near any row (we determine parent assignment in onEnd)
            eligibleRows = allRows;
        }

        if (eligibleRows.length === 0) {
            this.indicatorLine.style.display = 'none';
            this.lastDropTarget = null;
            return;
        }

        // Find closest row edge to mouse
        let bestTarget = null;
        let minDist = Infinity;

        for (const row of eligibleRows) {
            const rect = row.getBoundingClientRect();
            if (rect.height === 0) continue; // Skip collapsed

            const topDist = Math.abs(mouseY - rect.top);
            const botDist = Math.abs(mouseY - rect.bottom);

            if (topDist < minDist) {
                minDist = topDist;
                bestTarget = row;
            }
            if (botDist < minDist) {
                minDist = botDist;
                bestTarget = row;
            }
        }

        if (!bestTarget) {
            this.indicatorLine.style.display = 'none';
            this.lastDropTarget = null;
            return;
        }

        const effRect = bestTarget.getBoundingClientRect();
        const effMid = effRect.top + effRect.height / 2;

        if (isDragParent) {
            // Parent: only before/after other parents (no nesting)
            const pos = (mouseY > effMid) ? 'after' : 'before';
            this.showIndicator(bestTarget, pos);
            this.lastDropTarget = { element: bestTarget, type: pos };
        } else {
            // Child: allow nesting onto parent (top half), or positional drop
            if (bestTarget.getAttribute('data-type') === 'parent' && mouseY < effMid) {
                bestTarget.classList.add('drop-indicator-nest-active');
                this.indicatorLine.style.display = 'none';
                this.lastDropTarget = { element: bestTarget, type: 'nest' };
            } else {
                const pos = (mouseY > effMid) ? 'after' : 'before';
                this.showIndicator(bestTarget, pos);
                this.lastDropTarget = { element: bestTarget, type: pos };
            }
        }
    }

    showIndicator(targetEl, pos) {
        const rect = targetEl.getBoundingClientRect();
        // Only show in the timeline viewport area (right side)
        const viewport = document.querySelector('.timeline-view-viewport');
        const vpRect = viewport ? viewport.getBoundingClientRect() : null;

        if (!vpRect) return;

        this.indicatorLine.style.display = 'block';
        // Position at top or bottom of target depending on 'before'/'after'
        const yPos = (pos === 'after') ? rect.bottom : rect.top;
        this.indicatorLine.style.top = `${window.scrollY + yPos}px`;
        this.indicatorLine.style.left = `${vpRect.left}px`;
        this.indicatorLine.style.width = `${vpRect.width}px`;
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
            const left = parseFloat(bar.style.left) || 0;
            const width = parseFloat(bar.style.width) || 0;
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
            if (window.tixupSaveData) window.tixupSaveData();
            document.dispatchEvent(new CustomEvent('tixup:data-changed'));
        } else {
            console.error('[TixupCore] Parent bar not found in timeline for auto-resize');
        }
    }




}

// Global instance
window.tixupCore = new TixupCore();
document.addEventListener('DOMContentLoaded', () => window.tixupCore.init());
