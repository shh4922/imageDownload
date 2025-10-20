// panel/events.js
import { state } from './state.js';
import { el } from './dom.js';
import { parseBoardFromUrl } from './utils.js';
import { showDetect, startScan, renderToolbar, renderGrids, syncSelectedGrid } from './ui.js';

export function bindUIEvents() {
    bindNavbarTabs();

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

    // 전체 선택
    el.btnSelectAll?.addEventListener('click', () => {
        // 모든 핀 ID를 선택 상태로 추가
        state.selectedIds = new Set(state.pins.map(p => p.id));

        // 모든 카드에 selected 클래스 추가
        el.gridAll?.querySelectorAll('.card').forEach(card => {
            card.classList.add('selected');
        });

        syncSelectedGrid();
        renderToolbar();
    });


    el.btnDeselectAll?.addEventListener('click', clearSelection);
    el.btnDeselectAll2?.addEventListener('click', clearSelection);
    bindGridSelection()


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
function bindGridSelection() {
    // ALL / SELECTED 두 그리드 모두 위임 바인딩
    [el.gridAll, el.gridSel].forEach((grid) => {
        if (!grid) return;
        grid.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            if (!card) return;

            const id = card.dataset.id;
            if (!id) return;

            const willSelect = !card.classList.contains('selected');

            // DOM 표시
            setCardSelected(card, willSelect);

            // 상태 동기화
            if (willSelect) state.selectedIds.add(id);
            else            state.selectedIds.delete(id);

            // SELECTED 탭에서 해제하면 그리드에서 제거(선택사항)
            if (grid === el.gridSel && !willSelect) {
                card.remove();
            }

            // UI 갱신
            syncSelectedGrid();
            renderToolbar();
        });
    });
}

function setCardSelected(card, on) {
    card.classList.toggle('selected', !!on);
}

// 상단 네브바
function bindNavbarTabs() {
    // 패널 상단 네비 버튼들 (Board, Signin)
    const sections = {
        board:  el.sectionBoard,
        signin: el.sectionSignin
    };

    el.navTabs.forEach((btn) => {
        btn.addEventListener('click', () => {
            // 1) 버튼 active 토글
            el.navTabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 2) data-target 읽기 (예: 'nav-board' | 'nav-signin')
            const target = btn.dataset.target;
            const targetId = target === 'nav-board' ? 'board'
                : target === 'nav-signin' ? 'signin'
                    : null;
            if (!targetId) return;

            // 3) 섹션 전환
            Object.entries(sections).forEach(([id, el]) => {
                el.classList.toggle('active', id === targetId);
                el.classList.toggle('hidden', id !== targetId);
            });
        });
    });
}


// 전체 선택 해제
const clearSelection = () => {
    state.selectedIds.clear();
    el.gridAll?.querySelectorAll('.card').forEach(card => {
        card.classList.remove('selected');
    });
    syncSelectedGrid();
    renderToolbar();
};


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

        // 보드 총 핀 개수를 상태에 저장
        if (typeof res.pinCount === 'number') {
            state.board.pinCount = Number(res.pinCount);
        }

        showDetect(res.title || res.slug || state.board.slug || '—',
            typeof res.pinCount === 'number' ? `${res.pinCount} pins` : '— pins');
    });
}
