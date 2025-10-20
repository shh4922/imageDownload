// panel/ui.js
import { state, resetSelection } from './state.js';
import { el } from './dom.js';
import { toggleHidden, withScrollLock, normalizePins } from './utils.js';

// ===== 뷰 전환 =====
export function setView(v) {
    state.view = v;
    toggleHidden(el.viewDetect, v !== 'detect');
    toggleHidden(el.viewLoading, v !== 'loading');
    toggleHidden(el.viewGallery, !(v === 'gallery' || v === 'downloading'));

    const downloading = (v === 'downloading');
    toggleHidden(el.dlWrap, !downloading);

    [el.tabAll, el.tabSel, el.btnSelectAll, el.btnDeselectAll, el.btnDeselectAll2, el.btnDownload]
        .forEach(b => b && (b.disabled = downloading));
}

export function showDetect(title = 'No board selected', pinText = '— pins') {
    if (el.boardName) el.boardName.textContent = title;
    if (el.boardPins) el.boardPins.textContent = pinText;
    setView('detect');
}

export function startScan() {
    setView('loading');
    if (el.prog) el.prog.value = 0;
    if (el.status) el.status.textContent = 'Scanning…';
}

export function onCollected(pins, meta = {}) {
    state.board.title = meta.title || state.board.title || state.board.slug || 'Unknown Board';
    state.board.slug  = meta.slug  || state.board.slug || null;
    state.pins = normalizePins(pins);
    resetSelection();
    state.activeTab = 'all';

    setView('gallery');
    renderToolbar();
    renderGrids();
}

export function startDownload() {
    if (state.selectedIds.size === 0) {
        state.pins.forEach(p => state.selectedIds.add(p.id));
        renderToolbar();
    }
    setView('downloading');
    if (el.dlProg) el.dlProg.value = 0;
    if (el.dlStatus) {
        // 총 다운로드 대상(선택된 개수) 표시 + 전체 보드 기준 퍼센트는 DL_PROGRESS에서 갱신
        el.dlStatus.textContent = `Downloading 0 / ${state.selectedIds.size}`;
    }
    state.port?.postMessage({ type: 'START_DOWNLOAD', ids: Array.from(state.selectedIds) });
}

export function onDownloadProgress(done, total) {
    // 보드 전체 핀 수가 있으면 그것을 기준으로 퍼센트 계산
    const boardTotal = Number(state.board?.pinCount) || 0;
    const denom = boardTotal || total || 1;
    const pct = denom ? Math.round((done / denom) * 100) : 0;

    if (el.dlProg) el.dlProg.value = pct;
    if (el.dlStatus) {
        // 총 다운로드된 개수(done)과 선택된 총개수(total)도 함께 보여줌, 퍼센트는 보드 전체 기준
        el.dlStatus.textContent = `Downloading ${done} / ${total} — ${pct}% of board${pct === 100 ? ' (완료)' : ''}`;
    }
}

export function onDownloadDone() {
    setView('gallery');
    renderToolbar();
    renderGrids();
}

export function setScanEnabled(enabled) {
    if (!el.btnExtract) return;
    el.btnExtract.disabled = !enabled;
    el.btnExtract.title = enabled ? 'Scan Pinterest board images' : 'This button is only available on Pinterest board pages';
}

// ===== 렌더링 =====
export function renderToolbar() {
    if (el.boardTitle) el.boardTitle.textContent = state.board.title || '—';
    if (el.countAll)   el.countAll.textContent   = String(state.pins.length);
    if (el.countSel)   el.countSel.textContent   = String(state.selectedIds.size);

    const tabAllActive = state.activeTab === 'all';
    el.tabAll?.classList.toggle('active', tabAllActive);
    el.tabSel?.classList.toggle('active', !tabAllActive);

    toggleHidden(el.actionsAll, !tabAllActive);
    toggleHidden(el.actionsSel, tabAllActive);

    toggleHidden(el.gridAll, !tabAllActive);
    toggleHidden(el.gridSel, tabAllActive);
}

export function renderGrids() {
    withScrollLock(() => {
        // ALL
        el.gridAll?.replaceChildren(...state.pins.map(makeCard));
        // SELECTED
        const selectedPins = state.pins.filter(p => state.selectedIds.has(p.id));
        el.gridSel?.replaceChildren(...selectedPins.map(makeCard));
    });
}

// ===== 카드/선택 =====
export function makeCard(pin) {
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.dataset.id = pin.id;

    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.fetchPriority = 'low';
    img.dataset.src = pin.thumb || pin.full || pin.url;
    el.io.observe(img);

    const badge = document.createElement('span');
    badge.className = 'chk';
    badge.textContent = state.selectedIds.has(pin.id) ? '✓' : '+';

    wrap.appendChild(img);
    wrap.appendChild(badge);

    wrap.addEventListener('click', () => toggleSelect(pin));

    return wrap;
}

export function updateBadge(grid, pinId) {
    if (!grid) return;
    const card = grid.querySelector(`[data-id="${CSS.escape(pinId)}"]`);
    if (!card) return;
    const badge = card.querySelector('.chk');
    if (badge) badge.textContent = state.selectedIds.has(pinId) ? '✓' : '+';
}

export function syncSelectedGrid() {
    withScrollLock(() => {
        const selectedPins = state.pins.filter(p => state.selectedIds.has(p.id));
        el.gridSel?.replaceChildren(...selectedPins.map(makeCard));
    });
}

export function toggleSelect(pin) {
    withScrollLock(() => {
        if (state.selectedIds.has(pin.id)) state.selectedIds.delete(pin.id);
        else state.selectedIds.add(pin.id);

        updateBadge(el.gridAll, pin.id);
        updateBadge(el.gridSel, pin.id);

        syncSelectedGrid();
        renderToolbar();
    });
}