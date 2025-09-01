// background.js

// 특정 브라우저 탭에 로드된 이미지 데이터.
const pinsByTab = new Map(); // tabId -> [{id,url}, ...]

// 연결된 panel 포트 목록 (여러 개 열릴 수도 있음)
const panelPorts = []; // [{ port, tabId }]


onConnect()
onAddRuntimeEvent()
initExtension()





/**
 * 확장 프로그램 on/off
 * 확장 프로그램 실행버튼을 눌렀을때 이벤트
 */
function initExtension() {
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
}




// panel.html 과의 포트 연결 관리
function onConnect() {

    chrome.runtime.onConnect.addListener((port) => {
        if (port.name !== "panel") return;
        console.log("onConnect", port)
        const ctx = { port, tabId: null }; // 이 패널이 구독 중인 탭 id
        panelPorts.push(ctx);

        // panel에서 특정 탭을 구독하겠다고 알림
        port.onMessage.addListener((msg) => {
            if (msg.type === "PANEL_SUBSCRIBE" && typeof msg.tabId === "number") {
                ctx.tabId = msg.tabId;

                // 기존에 로드했던 이미지데이터 있으면 로드
                const cached = pinsByTab.get(ctx.tabId) || [];
                port.postMessage({ type: "PINS_COLLECTED", pins: cached, tabId: ctx.tabId });
            }
        });

        // 브라우저 탭 닫히면 연결 해제
        port.onDisconnect.addListener(() => {
            const i = panelPorts.indexOf(ctx);
            if (i >= 0) panelPorts.splice(i, 1);
        });
    });
}

function onAddRuntimeEvent() {
    // contents.js에서 메시지를 받았을때
    chrome.runtime.onMessage.addListener((msg, sender) => {
        const tabId = sender.tab?.id;
        if (!tabId) return;

        switch (msg.type) {
            case "PINS_COLLECTED":
                sendPinsData(tabId)
                break
            case "PINS_PROGRESS":
                sendLoadingPercent()
                break
            case "PANEL_CLOSE":
                sendPanelClose(tabId)
                break
            default:
                break
        }
    });
}

function sendPinsData(tabId) {
    const pins = Array.isArray(msg.pins) ? msg.pins : [];
    pinsByTab.set(tabId, pins); // 캐시 갱신

    // const findTab = findTabByTabId(tabId)
    // if(!findTab) return

    findTab.port.postMessage({ type: "PINS_COLLECTED", pins, tabId });
}

function sendLoadingPercent(tabId) {
    // const findTab = findTabByTabId(tabId)
    // if(!findTab) return

    findTab.port.postMessage({
        type: "PINS_PROGRESS",
        percent: msg.percent,
        tabId
    });
}

// contents.js로 이벤트 전달
function sendPanelClose(tabId) {
    // const findTab = findTabByTabId(tabId)
    // if(!findTab) return
    chrome.tabs.sendMessage(tabId, { type: "PANEL_CLOSE" })
}

function findTabByTabId(tabId) {
    return  panelPorts.find((port)=>{
        return port.tabId === tabId
    })
}