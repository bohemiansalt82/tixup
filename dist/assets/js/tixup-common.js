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
        this.initTimelineInteraction();
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
        document.addEventListener('click', (e) => {
            // 1. Toggle Expander
            const expander = e.target.closest('.tree-expander');
            if (expander && !expander.classList.contains('empty')) {
                this.handleToggle(expander);
                return;
            }

            // 2. Add Child Button
            const addBtn = e.target.closest('.add-child-btn');
            if (addBtn) {
                // handleAddChild는 각 페이지의 스크립트에서 처리하므로 여기서는 중복 호출하지 않습니다.
                return;
            }
        });

        // 3. Double Click for Auto Resize Parent
        document.addEventListener('dblclick', (e) => {
            const row = e.target.closest('.data-grid-row');
            if (row && row.getAttribute('data-type') === 'parent') {
                this.handleAutoResize(row);
                return;
            }
            const bar = e.target.closest('.timeline-bar');
            if (bar) {
                const parentRow = bar.closest('.timeline-row');
                if (parentRow && !parentRow.classList.contains('grid-child-row')) {
                    const rowId = parentRow.getAttribute('data-group');
                    const gridRow = document.querySelector(`.data-grid-row[data-group="${rowId}"]`);
                    if (gridRow) this.handleAutoResize(gridRow);
                    return;
                }
            }
        });

        // Hover Effect for Add Button
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
    }

    handleToggle(expander) {
        const row = expander.closest('.data-grid-row');
        const groupName = row.getAttribute('data-group');
        if (!groupName) return;

        const isExpanded = expander.classList.contains('expanded');
        const container = expander.closest('.timeline-grid-container') || document.body;
        const children = container.querySelectorAll(`.grid-child-row[data-parent="${groupName}"]`);

        if (isExpanded) {
            expander.classList.remove('expanded');
            expander.classList.add('collapsed');
            children.forEach(child => child.classList.add('collapsed'));
        } else {
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

    initTimelineInteraction() {
        const bars = document.querySelectorAll('.timeline-bar');
        bars.forEach(bar => this.attachBarInteraction(bar));

        // Observe new bars
        const timelineBody = document.querySelector('.timeline-body');
        if (timelineBody) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            const newBars = node.querySelectorAll('.timeline-bar');
                            newBars.forEach(b => this.attachBarInteraction(b));
                            if (node.classList.contains('timeline-bar')) this.attachBarInteraction(node);
                        }
                    });
                });
            });
            observer.observe(timelineBody, { childList: true, subtree: true });
        }
    }

    attachBarInteraction(bar) {
        if (bar.classList.contains('is-initialized')) return;
        bar.classList.add('is-initialized');

        // Add Resizers
        if (!bar.querySelector('.timeline-bar-resizer-left')) {
            const l = document.createElement('div');
            l.className = 'timeline-bar-resizer timeline-bar-resizer-left';
            bar.appendChild(l);
        }
        if (!bar.querySelector('.timeline-bar-resizer-right')) {
            const r = document.createElement('div');
            r.className = 'timeline-bar-resizer timeline-bar-resizer-right';
            bar.appendChild(r);
        }

        let activeHandle = null;
        let startX, startLeft, startWidth;
        let childrenWithInitialState = []; // child bars and their initial lefts

        const onMouseDown = (e) => {
            startX = e.clientX;
            startLeft = parseInt(bar.style.left) || 0;
            startWidth = parseInt(bar.style.width) || bar.offsetWidth;

            if (e.target.classList.contains('timeline-bar-resizer-left')) activeHandle = 'left';
            else if (e.target.classList.contains('timeline-bar-resizer-right')) activeHandle = 'right';
            else activeHandle = 'drag';

            // 상위 업무 이동 시 하위 업무들도 함께 이동하기 위해 초기 상태 저장
            const row = bar.closest('.timeline-row');
            if (activeHandle === 'drag' && row && !row.classList.contains('grid-child-row')) {
                const groupId = row.getAttribute('data-group');
                const childRows = document.querySelectorAll(`.grid-child-row[data-parent="${groupId}"]`);
                childrenWithInitialState = Array.from(childRows).map(cr => {
                    const cb = cr.querySelector('.timeline-bar');
                    if (cb) {
                        return {
                            bar: cb,
                            initialLeft: parseInt(cb.style.left) || 0
                        };
                    }
                    return null;
                }).filter(c => c !== null);
            } else {
                childrenWithInitialState = [];
            }

            bar.classList.add(activeHandle === 'drag' ? 'is-dragging' : 'is-resizing');
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.stopPropagation();
        };

        const onMouseMove = (e) => {
            if (!activeHandle) return;
            const dx = e.clientX - startX;
            const gridDx = Math.round(dx / this.gridSize) * this.gridSize;

            if (activeHandle === 'left') {
                let nL = startLeft + gridDx;
                let nW = startWidth - (nL - startLeft);
                if (nW >= this.gridSize) {
                    bar.style.left = nL + 'px';
                    bar.style.width = nW + 'px';
                }
            } else if (activeHandle === 'right') {
                let nW = startWidth + gridDx;
                if (nW >= this.gridSize) bar.style.width = nW + 'px';
            } else if (activeHandle === 'drag') {
                const newLeft = startLeft + gridDx;
                bar.style.left = newLeft + 'px';
                
                // 하위 업무들도 같은 거리만큼 이동
                childrenWithInitialState.forEach(c => {
                    c.bar.style.left = (c.initialLeft + gridDx) + 'px';
                });
            }
        };

        const onMouseUp = () => {
            bar.classList.remove('is-dragging', 'is-resizing');
            activeHandle = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            // Trigger save if needed
            document.dispatchEvent(new CustomEvent('tixup:data-changed'));
        };

        bar.addEventListener('mousedown', onMouseDown);
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
                preventOnFilter: false,
                ghostClass: 'sortable-ghost',
                dragClass: 'sortable-drag',
                forceFallback: true,

                onStart: (evt) => {
                    this.lastDropTarget = null;
                    if (this.indicatorLine) this.indicatorLine.style.display = 'none';
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
                            if (targetType === 'parent') {
                                this.showIndicator(targetEl);
                                this.lastDropTarget = { element: targetEl, type: 'before' };
                            } else {
                                this.indicatorLine.style.display = 'none';
                                this.lastDropTarget = null;
                                return false;
                            }
                        }
                    } else {
                        this.indicatorLine.style.display = 'none';
                        this.lastDropTarget = null;
                    }
                    return false;
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
                            
                            // Update UI icons if needed
                            this.updateRowHierarchyUI(item, true);
                            this.updateParentExpander(drop.element);
                        } else {
                            container.insertBefore(item, drop.element);
                            if (item.getAttribute('data-type') === 'parent') {
                                // Move children with parent
                                const children = Array.from(container.querySelectorAll(`.grid-child-row[data-parent="${itemId}"]`));
                                let next = item.nextSibling;
                                children.forEach(c => {
                                    container.insertBefore(c, next);
                                    next = c.nextSibling;
                                });
                            } else {
                                // Target's parent가 있으면 상속, 없으면 부모(top-level)가 됨
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
            if (tixIcon) {
                tixIcon.classList.remove('icon-tix');
                tixIcon.classList.add('icon-stat');
            }
        } else {
            titleContainer.classList.remove('depth-2');
            row.classList.remove('grid-child-row');
            row.classList.add('level-0');
            row.setAttribute('data-type', 'parent');
            row.removeAttribute('data-parent');

            const statIcon = titleContainer.querySelector('.nav-icon.icon-stat');
            if (statIcon) {
                statIcon.classList.remove('icon-stat');
                statIcon.classList.add('icon-tix');
            }

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
            // Create expander if it doesn't exist
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
        // test_drive.html 구조에 맞게 정확한 컨테이너 선택
        const sidebar = document.getElementById('grid-tbody') || document.querySelector('.timeline-sidebar');
        const timelineBody = document.getElementById('timeline-tbody') || document.querySelector('.timeline-body');
        if (!sidebar || !timelineBody) return;

        const rows = sidebar.querySelectorAll('.data-grid-row:not(.data-grid-header)');
        rows.forEach(r => {
            const id = r.getAttribute('data-group');
            const vRow = timelineBody.querySelector(`[data-group="${id}"]`);
            if (vRow) timelineBody.appendChild(vRow);
        });
    }

    handleAutoResize(parentRow) {
        const parentId = parentRow.getAttribute('data-group');
        const children = document.querySelectorAll(`.grid-child-row[data-parent="${parentId}"]`);
        
        if (children.length === 0) return;

        let minLeft = Infinity;
        let maxRight = -Infinity;

        children.forEach(child => {
            const childGroupId = child.getAttribute('data-group');
            const bars = document.querySelectorAll(`[data-group="${childGroupId}"] .timeline-bar`);
            bars.forEach(bar => {
                const l = parseInt(bar.style.left) || 0;
                const w = parseInt(bar.style.width) || 0;
                minLeft = Math.min(minLeft, l);
                maxRight = Math.max(maxRight, l + w);
            });
        });

        if (minLeft !== Infinity) {
            const parentBars = document.querySelectorAll(`[data-group="${parentId}"] .timeline-bar`);
            parentBars.forEach(parentBar => {
                parentBar.style.left = minLeft + 'px';
                parentBar.style.width = (maxRight - minLeft) + 'px';
                
                // Visual feedback
                parentBar.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
                parentBar.classList.add('auto-resizing');
                setTimeout(() => {
                    parentBar.style.transition = '';
                    parentBar.classList.remove('auto-resizing');
                }, 300);
            });
            
            // Trigger save
            document.dispatchEvent(new CustomEvent('tixup:data-changed'));
        }
    }
}

// Global instance
window.tixupCore = new TixupCore();
document.addEventListener('DOMContentLoaded', () => window.tixupCore.init());
