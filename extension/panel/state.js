// panel/state.js
export const state = {
    view: 'detect',          // 'detect' | 'loading' | 'gallery' | 'downloading'
    board: { title: null, slug: null },
    pins: [],                // [{id, thumb, full, url}]
    selectedIds: new Set(),  // 선택된 id들
    activeTab: 'all',        // 'all' | 'sel'
    tabId: null,             // 현재 탭 id
    port: null,              // chrome.runtime.Port
};

export function resetSelection() {
    state.selectedIds.clear();
}