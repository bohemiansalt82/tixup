const { invoke } = window.__TAURI__.core;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Tauri Initial Setup Check
    try {
        const isSetup = await invoke('check_initial_setup');
        if (!isSetup) {
            window.location.href = 'setup.html';
            return;
        }
    } catch (err) {
        // Silently fail if not in Tauri environment or command missing
    }

    // 2. Dashboard Tab Switching Logic
    const tabs = document.querySelectorAll('.status-tabs .tab');
    if (tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
            });
        });
    }

    // 3. Simple Row Selection Logic (for Index/Dashboard)
    const rowCheckboxes = document.querySelectorAll('.tix-row input[type="checkbox"]');
    const masterCheckbox = document.querySelector('thead input[type="checkbox"]');
    const floatingBar = document.querySelector('.floating-bar');
    const selectionInfo = document.querySelector('.selection-info');

    if (rowCheckboxes.length > 0 && masterCheckbox && floatingBar) {
        const updateSelectionInfo = () => {
            const checkedItems = document.querySelectorAll('.tix-row input[type="checkbox"]:checked');
            const selectedCount = checkedItems.length;

            rowCheckboxes.forEach(cb => {
                const row = cb.closest('tr');
                if (row) {
                    if (cb.checked) row.classList.add('selected');
                    else row.classList.remove('selected');
                }
            });

            if (selectedCount > 0) {
                if (selectionInfo) {
                    selectionInfo.innerHTML = `<span>${selectedCount}</span> items selected`;
                }
                floatingBar.style.display = 'flex';
                setTimeout(() => floatingBar.classList.add('visible'), 10);
            } else {
                floatingBar.classList.remove('visible');
                setTimeout(() => {
                    if (!floatingBar.classList.contains('visible')) {
                        floatingBar.style.display = 'none';
                    }
                }, 300);
            }
        };

        masterCheckbox.addEventListener('change', (e) => {
            rowCheckboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
            updateSelectionInfo();
        });

        rowCheckboxes.forEach(cb => {
            cb.addEventListener('change', updateSelectionInfo);
        });

        // Initialize state
        updateSelectionInfo();
    }
});
