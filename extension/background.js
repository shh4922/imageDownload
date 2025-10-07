// background.js

const pinsByTab = new Map();        // tabId -> pins[]
const panelPorts = [];              // { port, tabId }

onConnect();
onAddRuntimeEvent();
initExtension();

/** 브라우저 액션 클릭 → 패널 토글 */
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

/** panel.html 과 Port 연결 관리 */
function onConnect() {
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== 'panel') return;

        const ctx = { port, tabId: null };
        panelPorts.push(ctx);

        port.onMessage.addListener((msg) => {
            if (msg.type === 'PANEL_SUBSCRIBE' && typeof msg.tabId === 'number') {
                ctx.tabId = msg.tabId;

                const cached = pinsByTab.get(ctx.tabId) || [];
                port.postMessage({ type: 'PINS_COLLECTED', pins: cached, tabId: ctx.tabId });
            }
        });

        port.onDisconnect.addListener(() => {
            const i = panelPorts.indexOf(ctx);
            if (i >= 0) panelPorts.splice(i, 1);
        });
    });
}

/** content.js / panel.js에서 오는 단발 메시지 처리 */
function onAddRuntimeEvent() {
    const handlers = {
        // ▶ content.js → panel 로 브로드캐스트
        PINS_COLLECTED: (tabId, msg) => sendPinsData(tabId, msg.pins),
        PINS_PROGRESS:  (tabId, msg) => sendLoadingPercent(tabId, msg.percent),
        SLUG_NOT_FOUND: (tabId)      => broadcastToPanel(tabId, { type: 'SLUG_NOT_FOUND', tabId }),

        // ▶ panel.js → 해당 탭의 content.js 로 릴레이 (panelPorts 없어도 전송)
        PANEL_SCAN:   (tabId)        => chrome.tabs.sendMessage(tabId, { type: 'PANEL_SCAN' }),
        START_INJECT: (tabId, msg)   => chrome.tabs.sendMessage(tabId, { type: 'START_INJECT', email: msg.email }),
        PANEL_CLOSE:  (tabId)        => chrome.tabs.sendMessage(tabId, { type: 'PANEL_CLOSE' }),
    };

    chrome.runtime.onMessage.addListener((msg, sender) => {
        // tabId 우선순위: msg.tabId(패널에서 지정) > sender.tab.id(컨텐트에서 옴)
        const tabId = msg.tabId ?? sender.tab?.id;
        if (!tabId) return;

        const handler = handlers[msg.type];
        if (!handler) return;

        try {
            handler(tabId, msg);
        } catch (e) {
            console.error('[BG] handler error:', msg.type, e);
        }
    });
}

/** panel 포트로 브로드캐스트 */
function broadcastToPanel(tabId, payload) {
    panelPorts
        .filter((p) => p.tabId === tabId)
        .forEach((p) => p.port.postMessage(payload));
}

/** pins 캐시 업데이트 + 패널로 전달 */
function sendPinsData(tabId, pins = []) {
    const list = Array.isArray(pins) ? pins : [];
    pinsByTab.set(tabId, list);
    broadcastToPanel(tabId, { type: 'PINS_COLLECTED', pins: list, tabId });
}

function sendLoadingPercent(tabId, percent = 0) {
    broadcastToPanel(tabId, { type: 'PINS_PROGRESS', percent, tabId });
}

function findTabByTabId(tabId) {
    return panelPorts.find((p) => p.tabId === tabId) || null;
}