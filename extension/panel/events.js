// panel/events.js
import { state } from './state.js';
import { el } from './dom.js';
import { parseBoardFromUrl } from './utils.js';
import { showDetect, startScan, renderToolbar, renderGrids, syncSelectedGrid } from './ui.js';

export function bindUIEvents() {
    // 닫기
    el.closeBtn?.addEventListener('click', () => {
        if (!state.tabId) return;
        chrome.runtime.sendMessage({ type: "PANEL_CLOSE", tabId: state.tabId });
    });

    // 스캔 버튼
    el.btnExtract?.addEventListener('click', () => {
        if (!state.tabId || el.btnExtract.disabled) return;
        startScan();
        chrome.runtime.sendMessage({ type: 'PANEL_SCAN', tabId: state.tabId });
    });

    // 탭
    el.tabAll?.addEventListener('click', () => {
        state.activeTab = 'all';
        renderToolbar();
    });
    el.tabSel?.addEventListener('click', () => {
        state.activeTab = 'sel';
        renderToolbar();
    });

    // 선택 버튼들
    el.btnSelectAll?.addEventListener('click', () => {
        state.selectedIds = new Set(state.pins.map(p => p.id));
        // 배지 일괄 갱신
        el.gridAll?.querySelectorAll('.card .chk').forEach(b => b.textContent = '✓');
        syncSelectedGrid();
        renderToolbar();
    });

    el.btnDeselectAll?.addEventListener('click', () => {
        state.selectedIds.clear();
        el.gridAll?.querySelectorAll('.card .chk').forEach(b => b.textContent = '+');
        syncSelectedGrid();
        renderToolbar();
    });

    el.btnDeselectAll2?.addEventListener('click', () => {
        state.selectedIds.clear();
        el.gridAll?.querySelectorAll('.card .chk').forEach(b => b.textContent = '+');
        syncSelectedGrid();
        renderToolbar();
    });

    // 로그인(선택)
    el.signinForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = (el.signinEmail?.value || '').trim();
        if (!email) {
            el.status && (el.status.textContent = "이메일을 입력하세요.");
            return;
        }
        el.status && (el.status.textContent = "인증 메일 전송 중...");
        chrome.runtime.sendMessage({ type: "START_INJECT", tabId: state.tabId, email });
        el.status && (el.status.textContent = `인증 완료: ${email}`);
    });
}

// 탭/URL 변화 추적
export function subscribeCurrentTab() {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (!tab) {
            el.status && (el.status.textContent = '활성 탭을 찾지 못했어요.');
            showDetect('⚠️ No active board detected.', '');
            return;
        }
        state.tabId = tab.id;
        state.port?.postMessage({ type: 'PANEL_SUBSCRIBE', tabId: state.tabId });

        const info = parseBoardFromUrl(tab.url || '');
        if (!info) {
            showDetect('⚠️ No active board detected.', '');
            return;
        }
        state.board.slug = info.slug;
        showDetect(info.slug, '— pins');
        requestBoardMeta();
    });
}

export function watchTabChanges() {
    chrome.tabs.onActivated.addListener(({ tabId }) => {
        chrome.tabs.get(tabId, (tab) => {
            if (!tab) return;
            state.tabId = tab.id;
            state.port?.postMessage({ type: "PANEL_SUBSCRIBE", tabId: state.tabId });

            const info = parseBoardFromUrl(tab.url || '');
            if (info) {
                state.board.slug = info.slug;
                showDetect(info.slug, '— pins');
                requestBoardMeta();
            } else {
                showDetect('⚠️ No active board detected.', '');
            }
        });
    });

    chrome.tabs.onUpdated.addListener((updatedId, changeInfo, tab) => {
        if (updatedId !== state.tabId) return;
        if (changeInfo.status === 'complete' || changeInfo.url) {
            const url = changeInfo.url || tab.url || '';
            const info = parseBoardFromUrl(url);
            if (info) {
                state.board.slug = info.slug;
                showDetect(info.slug, '— pins');
                requestBoardMeta();
            } else {
                showDetect('⚠️ No active board detected.', '');
            }
        }
    });
}

export function requestBoardMeta() {
    if (!state.tabId) return;
    chrome.tabs.sendMessage(state.tabId, { type: 'GET_BOARD_META' }, (res) => {
        if (chrome.runtime.lastError) {
            console.warn('[PANEL] meta error:', chrome.runtime.lastError.message);
            return;
        }
        if (!res || !res.ok) return;
        showDetect(res.title || res.slug || state.board.slug || '—',
            typeof res.pinCount === 'number' ? `${res.pinCount} pins` : '— pins');
    });
}