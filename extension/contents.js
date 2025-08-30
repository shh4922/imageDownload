

// 페이지 위에 패널을 꽂고, 그 자리에서 스캔/다운로드까지 수행
if (!window.__filterest_injected) {
    window.__filterest_injected = true;
    mountIframePanel()
    bindHotkey(); // Alt+F 토글
}


chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'TOGGLE_PANEL') {
        console.log('[CS] TOGGLE_PANEL received');
        togglePanel();
        sendResponse?.({ ok: true });
    }
});

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
    iframe.src = chrome.runtime.getURL('pannel/pannel.html'); // ← 폴더명이 panel이면 'panel/panel.html'
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

// Alt+F 토글
function bindHotkey() {
    window.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'f' || e.key === 'F')) {
            if (window.__filterest_injected) {
                document.getElementById('filterest-host')?.remove();
                window.__filterest_injected = false;
            } else {
                window.__filterest_injected = true;
                mountIframePanel();
            }
        }
    }, { capture: true });
}

// ===== 이미지 수집 유틸 =====
function isBoardPage() {
    const p = location.pathname.replace(/\/+$/, '');
    if (/^\/pin\//.test(p)) return false; // 핀 상세 제외
    return true; // MVP: 나머지는 보드로 간주
}

function bestFromSrcset(img) {
    const set = img.getAttribute('srcset');
    if (!set) return img.currentSrc || img.src;
    let best = img.currentSrc || img.src, wmax = 0;
    for (const part of set.split(',').map(s => s.trim())) {
        const [u, wtxt] = part.split(' ');
        const w = parseInt(wtxt);
        if (w && w > wmax) { wmax = w; best = u; }
    }
    try { return new URL(best, location.href).toString(); } catch { return best; }
}

function collectBoardImages() {
    // 보드가 아니어도 일단 pinimg 이미지 수집
    const imgs = [...document.querySelectorAll('img')].filter(
        (img) => /pinimg\.com/.test(img.src) || /pinimg\.com/.test(img.srcset || '')
    );
    // 최대 해상도 추정
    const urls = imgs.map(bestFromSrcset).filter(Boolean);

    // dedupe
    return [...new Set(urls)];
}

// ===== 도우미 =====
function escapeHtml(s){ return String(s).replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])) }

function makeDraggable(panel, handle) {
    let sx, sy, sl, st, dragging = false;
    handle.addEventListener('mousedown', (e) => {
        dragging = true; sx = e.clientX; sy = e.clientY;
        const rect = panel.getBoundingClientRect(); sl = rect.left; st = rect.top;
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        panel.style.left = (sl + dx) + 'px';
        panel.style.top  = (st + dy) + 'px';
        panel.style.right = 'auto'; // 고정 해제
        panel.style.position = 'fixed';
    });
    window.addEventListener('mouseup', () => dragging = false);
}