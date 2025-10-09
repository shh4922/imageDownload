/**
 * 브라우저 탭에 주입된 스크립트
 */

/**
 * window.addEventListener()
 *
 * background.js 와 통신시, chrome.runtime.sendMessage()..
 *
 *
 */
let currentInject = "inject-any.js"

if (!window.__filterest_injected) {
    window.__filterest_injected = true;
    mountIframePanel()
}


initWindowEvent()
onAddChromeRuntimeMessage()
/**
 * 이미지 데이터 Fetch
 */
// injectScriptFile("inject-any.js");
// window.addEventListener('message', (e)=> {
//     if (e.data?.type === "PANEL_SCAN") {
//         console.log("[CS] 패널에서 스캔 요청 받음");
//         injectScriptFile("inject-any.js");
//     }
// })


/**
 * windowMessage 이벤트
 * 보통 inject 스크립트에서 보냄.
 */
function initWindowEvent() {
    window.addEventListener('message', (event)=> {
        if (event.source !== window) return;

        switch (event.data.type) {
            case "PINS_COLLECTED":              // 이미지 GET 완료후
                console.info("[CS] - PINS_COLLECTED", event)
                chrome.runtime.sendMessage({
                    type: "PINS_COLLECTED",
                    pins: event.data.pins
                });
                break;

            case "PINS_PROGRESS":               // 이미지 다운로드 중
                console.info("[CS] - PINS_PROGRESS", event)
                chrome.runtime.sendMessage({
                    type: "PINS_PROGRESS",
                    percent: event.data.percent
                });
                break
            case "SLUG_NOT_FOUND":              // 보드에 들어가지 않은경우
                console.info("[CS] - SLUG_NOT_FOUND", event)
                chrome.runtime.sendMessage({
                    type: "SLUG_NOT_FOUND",
                });
                break

            default:
                break;
        }
    })
}


/**
 * background.js 에서 받는 메시지에 대한 이벤트 등록
 */
function onAddChromeRuntimeMessage() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        switch (msg.type) {
            case 'TOGGLE_PANEL':    // 확장 프로그램 on/off
                togglePanel();
                sendResponse?.({ ok: true });
                break
            case 'PANEL_CLOSE':     // 확장프로그램 종료
                closePanel();
                break
            case "START_INJECT":    // 로그인완료시, 스크립트파일 변경
                currentInject = 'inject-auth.js'
                break
            case "PANEL_SCAN":      // 스크립트 실행 요청
                injectScriptFile(currentInject);
                break;
            case "GET_BOARD_META":  // 보드 정보를 로드
                getBoardMeta()
                    .then((data)=>{
                        console.log("data",data)
                        sendResponse({ ok: true, ...data })
                    })
                    .catch((err)=>{
                        console.log("err", err)
                        sendResponse({ ok: false, error: String(err) })
                    })
                return true // 이거 안쓰면 비동기 안기다리고 바로 리턴함.
            default:
                break
        }
    });
}
async function getBoardMeta() {
    // URL에서 username/slug 파싱
    const info = parseBoardFromUrl(location.href);
    if (!info) throw new Error('No board slug');
    const { username, slug, safePath } = info;

    // Pinterest BoardResource 호출 (pin_count, 이름 등)
    const url = `${location.origin}/resource/BoardResource/get/?` +
        `source_url=${encodeURIComponent(safePath)}` +
        `&data=${encodeURIComponent(JSON.stringify({
            options: { username, slug, field_set_key: "detailed" },
            context: {}
        }))}`;

    const res = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'x-requested-with': 'XMLHttpRequest',
            'x-pinterest-appstate': 'active',
            // ASCII만 사용 (키릴릭 등 비ASCII 금지)
            'x-pinterest-source-url': safePath,
            'x-pinterest-pws-handler': 'www/[username]/[slug].js',
        }
    });
    if (!res.ok) throw new Error('BoardResource ' + res.status);
    const json = await res.json();
    const data = json?.resource_response?.data || {};
    return {
        username,
        slug,
        title: data?.name ?? slug,
        pinCount: Number(data?.pin_count ?? 0)
    };
}

function parseBoardFromUrl(raw) {
    try {
        const u = new URL(raw);
        if (!/\.?pinterest\./i.test(u.hostname)) return null;
        const seg = u.pathname.replace(/^\/|\/$/g, '').split('/');
        if (seg.length < 2) return null;
        const first = (seg[0] || '').toLowerCase();
        if (first === 'pin' || first === 'ideas' || first === 'explore') return null;
        const username = decodeURIComponent(seg[0]);
        const slug     = decodeURIComponent(seg[1]);
        const safeUser = encodeURIComponent(username);
        const safeSlug = encodeURIComponent(slug);
        const safePath = `/${safeUser}/${safeSlug}/`;
        return { username, slug, safePath };
    } catch { return null; }
}



/**
 * 스크립트 주입 함수
 * @param file
 */
function injectScriptFile(file) {
    let old = null
    if(file === 'inject-auth.js') {
        old = document.querySelector(`script[data-inject-any="true"]`);
    } else if(file === "inject-any.js") {
        old = document.querySelector(`script[data-inject-auth="true"]`);
    }

    if (old) {
        console.log("[CS] 이전 스크립트 제거", old);
        old.remove();
    }

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(file);
    currentInject = file

    // 어떤 스크립트인지 마킹
    if (file === "inject-auth.js") {
        script.dataset.injectAuth = "true";
    } else {
        script.dataset.injectAny = "true";
    }

    script.onload = () => {
        console.log(`[CS] ${file}  로드 완료`);
        // script.remove();
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

/**
 * DOM 에 우리 서비스 UI 추가
 */
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
