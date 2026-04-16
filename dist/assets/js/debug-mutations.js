const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.removedNodes.length > 0) {
            mutation.removedNodes.forEach(node => {
                if (node.classList && (node.classList.contains('timeline-bar') || node.classList.contains('timeline-row'))) {
                    console.error('[Debug] Element REMOVED!', node, new Error().stack);
                }
            });
        }
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('timeline-tbody');
    if (tbody) observer.observe(tbody, { childList: true, subtree: true });
});
