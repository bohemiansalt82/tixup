const { invoke } = window.__TAURI__.core;

document.addEventListener('DOMContentLoaded', async () => {
    // Check if initial setup is completed
    try {
        const isSetup = await invoke('check_initial_setup');
        if (!isSetup) {
            window.location.href = 'setup.html';
            return;
        }
    } catch (err) {
        console.error('Setup check failed', err);
    }

    // Tab switching logic
    const tabs = document.querySelectorAll('.status-tabs .tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    // Row selection logic
    const rowCheckboxes = document.querySelectorAll('.tix-row input[type="checkbox"]');
    const masterCheckbox = document.querySelector('thead input[type="checkbox"]');
    const floatingBar = document.querySelector('.floating-bar');

    const updateSelectionInfo = () => {
        const checkedItems = document.querySelectorAll('.tix-row input[type="checkbox"]:checked');
        const selectedCount = checkedItems.length;
        const selectionInfo = document.querySelector('.selection-info');

        // Update row classes
        rowCheckboxes.forEach(cb => {
            const row = cb.closest('tr');
            if (cb.checked) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });

        if (selectedCount > 0) {
            selectionInfo.innerHTML = `<span>${selectedCount}</span> items selected`;
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

    // Initial state
    updateSelectionInfo();
});
