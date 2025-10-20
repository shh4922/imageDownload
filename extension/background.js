// background.js
// Pinterest 확장 중앙 허브 (inject/content/panel 중계)

const pinsByTab = new Map();   // tabId → pins[]
const panelPorts = new Map();  // tabId → port

// 초기화
initExtension();
setupPanelConnections();
setupRuntimeEvents();


/** ───────────────────────────────
 * 1. 확장 프로그램 on/off 토글 (action 버튼 클릭)
 * ─────────────────────────────── */
function initExtension() {
    chrome.action.onClicked.addListener((tab) => {
        if (!tab?.id) return;

        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }, (res) => {
            if (chrome.runtime.lastError) {
                console.warn('[BG] sendMessage error:', chrome.runtime.lastError.message);
            }
        });
    });
}


/** ───────────────────────────────
 * 2. panel.html 과의 Port 연결 관리
 * ─────────────────────────────── */
function setupPanelConnections() {
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== 'panel') return;

        console.log('[BG] Panel connected.');
        let currentTabId = null;

        // panel → background (패널 구독 요청)
        port.onMessage.addListener((msg) => {
            if (msg.type === 'PANEL_SUBSCRIBE' && typeof msg.tabId === 'number') {
                currentTabId = msg.tabId;
                panelPorts.set(currentTabId, port);
                console.log(`[BG] Panel subscribed tab #${currentTabId}`);

                // 이전에 캐싱된 핀 있으면 바로 전달
                const cached = pinsByTab.get(currentTabId) || [];
                port.postMessage({ type: 'PINS_COLLECTED', pins: cached, tabId: currentTabId });
            }
        });

        port.onDisconnect.addListener(() => {
            if (currentTabId && panelPorts.has(currentTabId)) {
                panelPorts.delete(currentTabId);
                console.log(`[BG] Panel disconnected from tab #${currentTabId}`);
            }
        });
    });
}


/** ───────────────────────────────
 * 3. content.js / panel.js에서 오는 단발 메시지 처리
 * ─────────────────────────────── */
function setupRuntimeEvents() {
    const handlers = {
        // ▶ content.js → panel 로 중계
        PINS_PROGRESS: (tabId, msg) => sendProgress(tabId, msg.percent),
        PINS_COLLECTED: (tabId, msg) => sendPins(tabId, msg.pins),
        BOARD_META: (tabId, msg) => sendBoardMeta(tabId, msg.data),
        SLUG_NOT_FOUND: (tabId) => broadcast(tabId, { type: 'SLUG_NOT_FOUND', tabId }),

        // ▶ panel.js → content.js 로 릴레이
        PANEL_SCAN: (tabId) => chrome.tabs.sendMessage(tabId, { type: 'PANEL_SCAN' }),
        START_INJECT: (tabId, msg) => chrome.tabs.sendMessage(tabId, { type: 'START_INJECT', email: msg.email }),
        PANEL_CLOSE: (tabId) => chrome.tabs.sendMessage(tabId, { type: 'PANEL_CLOSE' }),
    };

    chrome.runtime.onMessage.addListener((msg, sender) => {
        const tabId = msg.tabId ?? sender.tab?.id;
        if (!tabId) return;

        const handler = handlers[msg.type];
        if (handler) {
            try {
                handler(tabId, msg);
            } catch (err) {
                console.error(`[BG] handler error in ${msg.type}:`, err);
            }
        }
    });
}

/** ───────────────────────────────
 * 4. helper 함수들
 * ─────────────────────────────── */
function sendPins(tabId, pins = []) {
    const safePins = Array.isArray(pins) ? pins : [];
    pinsByTab.set(tabId, safePins);
    broadcast(tabId, { type: 'PINS_COLLECTED', pins: safePins, tabId });
}

function sendProgress(tabId, percent = 0) {
    broadcast(tabId, { type: 'PINS_PROGRESS', percent, tabId });
}

function sendBoardMeta(tabId, data = {}) {
    broadcast(tabId, { type: 'BOARD_META', data, tabId });
}

/** 패널로 메시지 브로드캐스트 */
function broadcast(tabId, payload) {
    const port = panelPorts.get(tabId);
    if (port) {
        port.postMessage(payload);
    } else {
        console.warn(`[BG] No panel connected for tab #${tabId}`);
    }
}