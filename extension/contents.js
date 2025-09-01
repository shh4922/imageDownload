/**
 * 실제 핀터레스트 웹 브라우저 위에서 돌아가는 Js
 * api콜 요청할때 쿠키랑 헤더 담아야해서 여기서 요청보내야함.
 */


// 페이지 위에 패널을 꽂고, 그 자리에서 스캔/다운로드까지 수행
if (!window.__filterest_injected) {
    window.__filterest_injected = true;
    mountIframePanel()
}



/**
 * Close 이벤트 등록
 */
window.addEventListener('message', (e) => {
    if (!String(e.origin).startsWith('chrome-extension://')) return;
    if (e.data?.type === 'PANEL_CLOSE') {
        closePanel();
    }
});


/**
 * 이미지 데이터 Fetch
 */
window.addEventListener('message', (e)=> {
    if (e.data?.type === "PANEL_SCAN") {
        console.log("[CS] 패널에서 스캔 요청 받음");
        injectScriptFile("injected.js");
    }
})

/**
 * 데이터 패치 완료후 이벤트 전달
 */
window.addEventListener("message", (event) => {
    // 같은 프레임에서 올라온 것만 처리
    if (event.source !== window) return;

    if (event.data?.type === "PINS_COLLECTED") {
        console.log("event submit ",event.data.pins)
        chrome.runtime.sendMessage({
            type: "PINS_COLLECTED",
            pins: event.data.pins
        });
    }

    // ---- 진행 상황 업데이트 ----
    if (event.data?.type === "PINS_PROGRESS") {
        chrome.runtime.sendMessage({
            type: "PINS_PROGRESS",
            percent: event.data.percent
        });
    }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    console.log(msg,_sender,sendResponse)
    if (msg?.type === 'TOGGLE_PANEL') {
        console.log('[CS] TOGGLE_PANEL received');
        togglePanel();
        sendResponse?.({ ok: true });
    }
});


// 페이지에 함수 주입
function injectScriptFile(file) {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(file);
    script.onload = () => {
        console.log("[CS] injected.js 로드 완료");
        script.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}


function togglePanel() {
    const overlay = document.getElementById('filterest-overlay');
    if (overlay) {
        closePanel();
    } else {
        mountIframePanel();
    }
}


function mountIframePanel() {
    // 스크롤 잠금
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.dataset.filterestOverflow = prevOverflow || '';
    document.documentElement.style.overflow = 'hidden';

    // ====== Overlay (배경) ======
    const overlay = document.createElement('div');
    overlay.id = 'filterest-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483646',                 // iframe 바로 아래
        background: 'rgba(0,0,0,0.45)',       // 어둡게
        backdropFilter: 'blur(6px) saturate(0.9)', // 배경 흐림
        WebkitBackdropFilter: 'blur(6px) saturate(0.9)',
        // 노이즈 (CSS only, 가벼운 패턴)
        backgroundImage:
            'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),' +
            'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '3px 3px, 5px 5px',
        backgroundPosition: '0 0, 1px 1px',
    });

    // 오버레이 클릭하면 닫기 (패널 외부 클릭 닫힘)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePanel();
    });

    // ====== Iframe (패널) ======
    const iframe = document.createElement('iframe');
    iframe.id = 'filterest-panel-iframe';
    iframe.src = chrome.runtime.getURL('panel/panel.html'); // ← 폴더명이 panel이면 'panel/panel.html'
    Object.assign(iframe.style, {
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '900px',   // 원하는 중앙 크기
        height: '600px',
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 40px)',
        border: '0',
        borderRadius: '14px',
        boxShadow: '0 20px 60px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.06) inset',
        zIndex: '2147483647',
        background: 'transparent',
    });

    // ESC 키로 닫기
    const onKey = (e) => {
        if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);

    // 닫기/정리 함수를 전역에 저장
    window.__filterest_close = () => {
        window.removeEventListener('keydown', onKey);
        overlay.remove();
        const prev = document.documentElement.dataset.filterestOverflow || '';
        document.documentElement.style.overflow = prev;
        delete window.__filterest_close;
    };

    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(iframe);
    window.__filterest_panel = true;
}

function closePanel() {
    document.getElementById('filterest-panel-iframe')?.remove();
    document.getElementById('filterest-overlay')?.remove();
    const prev = document.documentElement.dataset.filterestOverflow || '';
    document.documentElement.style.overflow = prev;
    window.__filterest_panel = false;
    if (typeof window.__filterest_close === 'function') window.__filterest_close();
}
