// background.js

// 탭별 핀 캐시 (선택 사항: 패널이 먼저 열려도 이전 데이터 보여주기용)
const pinsByTab = new Map(); // tabId -> [{id,url}, ...]

// 연결된 panel 포트 목록 (여러 개 열릴 수도 있음)
const panelPorts = []; // [{ port, tabId }]


// panel.html과의 포트 연결 관리
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "panel") return;

    const ctx = { port, tabId: null }; // 이 패널이 구독 중인 탭 id
    panelPorts.push(ctx);

    // panel에서 특정 탭을 구독하겠다고 알림
    port.onMessage.addListener((msg) => {
        if (msg.type === "PANEL_SUBSCRIBE" && typeof msg.tabId === "number") {
            ctx.tabId = msg.tabId;

            // 캐시가 있으면 즉시 보내기
            const cached = pinsByTab.get(ctx.tabId) || [];
            port.postMessage({ type: "PINS_COLLECTED", pins: cached, tabId: ctx.tabId });
        }
    });

    // 패널이 닫히면 정리
    port.onDisconnect.addListener(() => {
        const i = panelPorts.indexOf(ctx);
        if (i >= 0) panelPorts.splice(i, 1);
    });
});


chrome.runtime.onMessage.addListener((msg, sender) => {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    // 핀 수집 완료
    if (msg.type === "PINS_COLLECTED") {
        const pins = Array.isArray(msg.pins) ? msg.pins : [];
        pinsByTab.set(tabId, pins); // 캐시 갱신

        // 이 탭을 구독 중인 panel들에게만 전달
        for (const p of panelPorts) {
            if (p.tabId === tabId) {
                p.port.postMessage({ type: "PINS_COLLECTED", pins, tabId });
            }
        }
    }

    // 진행 상황
    if (msg.type === "PINS_PROGRESS") {
        for (const p of panelPorts) {
            if (p.tabId === tabId) {
                p.port.postMessage({
                    type: "PINS_PROGRESS",
                    percent: msg.percent,
                    tabId
                });
            }
        }
    }
});




/**
 * 확장 프로그램 on/off
 * 확장 프로그램 실행버튼을 눌렀을때 이벤트
 */
chrome.action.onClicked.addListener((tab) => {
    console.log("background Action run!!")
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }, (res) => {
        if (chrome.runtime.lastError) {
            // 여기서 "Receiving end does not exist" 나오면 content script가 안 붙은 상태
            console.warn('[BG] sendMessage error:', chrome.runtime.lastError.message);
            return;
        }
        console.log('[BG] toggle response:', res);
    });
});



// 파일명에서 허용되지 않는 문자 제거
function sanitizeFilename(name) {
    if (!name) return '';
    return name.replace(/[<>:\\"\|\?\*]/g, '_').slice(0, 180);
}