// panel/main.js
import { state } from './state.js';
import { initDomRefs } from './dom.js';
import { dispatchMessage } from './handlers.js';
import { bindUIEvents, subscribeCurrentTab, watchTabChanges } from './events.js';
import { showDetect } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    initDomRefs();

    // 포트 연결
    state.port = chrome.runtime.connect({ name: "panel" });
    state.port.onMessage.addListener(dispatchMessage);
    state.port.onDisconnect.addListener(() => {
        console.warn("[PANEL] port disconnected");
    });

    // 초기 UI
    showDetect();

    // 이벤트 바인딩
    bindUIEvents();

    // 탭 추적
    subscribeCurrentTab();
    watchTabChanges();
});
