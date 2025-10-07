// panel.js --------------------------------------------------------------------

// 0) 전역/DOM
const port = chrome.runtime.connect({ name: "panel" });
let tabId = null;
let currentScanEnabled = false;

const listEl     = document.getElementById("pin-list");
const statusEl   = document.getElementById("status");
const form       = document.getElementById("signin-form");
const emailInput = document.getElementById("signin-email");
const progEl     = document.getElementById("prog");
const btnScan    = document.getElementById('btn-getImageList');

let boardCard, boardName, boardPins, btnExtract;

document.addEventListener('DOMContentLoaded', () => {
    initDomRefs();          // DOM 요소 캐싱
    subscribeCurrentTab();  // 이후 로직 시작
    watchTabChanges();
    initNavBar();
    initCloseButton();
    initEventScanImage();
    initSignIn();
});


function initDomRefs() {
    boardCard  = document.getElementById('board-detect');
    boardName  = document.getElementById('board-name');
    boardPins  = document.getElementById('board-pins');
    btnExtract = document.getElementById('btn-extract');

    // 필수 요소 누락 로그
    if (!boardCard || !boardName || !boardPins) {
        console.warn('[PANEL] board card elements missing. Did you add the HTML?');
    }
}

// 1) IntersectionObserver (이미지 lazy)
const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
        if (!e.isIntersecting) continue;
        const img = e.target;
        img.src = img.dataset.src;
        io.unobserve(img);
    }
}, { root: null, rootMargin: '0px', threshold: 0.01 });

// 2) 포트 메시지 수신 (BG → Panel)
port.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === "PINS_COLLECTED") {
        const pins = msg.pins || [];
        renderPins(pins);
        boardPins.textContent = `${pins.length} pins`; // ✅ 스캔 완료 후 수량 반영
        statusEl.textContent = `탭 #${msg.tabId} 수집 완료 (${pins.length}개)`;
        if (progEl) progEl.value = 100;

        return;
    }

    if (msg.type === "PINS_PROGRESS") {
        const pct = Math.min(100, Math.max(0, Number(msg.percent) || 0));
        statusEl.textContent = `탭 #${msg.tabId} 수집: ${pct}%${pct === 100 ? ' (완료)' : ''}`;
        if (progEl) progEl.value = pct;
        return;
    }

    if (msg.type === "SLUG_NOT_FOUND") {
        statusEl.textContent = "Board slug not found";
        hideBoardCard();
        setScanEnabled(false);
        return;
    }
});

port.onDisconnect.addListener(() => {
    console.warn("[PANEL] port disconnected");
});

// 3) 현재 탭 구독 & 버튼 활성화 판정
// subscribeCurrentTab();
// watchTabChanges(); // 탭 변경/이동/로드 완료 시 버튼 활성화 재판정



async function subscribeCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
        statusEl.textContent = '활성 탭을 찾지 못했어요.';
        setScanEnabled(false);
        showNoActiveBoard();
        return;
    }

    port.postMessage({ type: 'PANEL_SUBSCRIBE', tabId: tab.id });
    tabId = tab.id;
    // statusEl.textContent = `탭 #${tabId} 구독 중…`;

    const info = parseBoardFromUrl(tab.url || '');
    if (!info) {
        setScanEnabled(false);
        showNoActiveBoard();   // ← 여기서 boardName이 null이면 또 터지므로 가드 필수
        return;
    }

    showBoardCard({ name: info.slug });
    setScanEnabled(true);
}

function watchTabChanges() {
    chrome.tabs.onActivated.addListener(({ tabId: activatedId }) => {
        chrome.tabs.get(activatedId, (tab) => {
            if (!tab) return;
            tabId = tab.id;
            port.postMessage({ type: "PANEL_SUBSCRIBE", tabId });

            const info = parseBoardFromUrl(tab.url || '');
            if (info) {
                showBoardCard({ name: info.slug });
                setScanEnabled(true);
            } else {
                hideBoardCard();
                setScanEnabled(false);
            }
        });
    });

    chrome.tabs.onUpdated.addListener((updatedId, changeInfo, tab) => {
        if (updatedId !== tabId) return;
        if (changeInfo.status === 'complete' || changeInfo.url) {
            const url = changeInfo.url || tab.url || '';
            const info = parseBoardFromUrl(url);
            if (info) {
                showBoardCard({ name: info.slug });
                setScanEnabled(true);
            } else {
                hideBoardCard();
                setScanEnabled(false);
            }
        }
    });
}

// 4) 네비/닫기/버튼 이벤트
// initNavBar();
// initCloseButton();
// initEventScanImage();
// initSignIn();

// 네비게이션 탭
function initNavBar() {
    const tabButtons  = document.querySelectorAll('.tabs .tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetId = btn.dataset.target;
            tabContents.forEach(sec => {
                sec.classList.toggle('active', sec.id === targetId);
            });
        });
    });
}

// 닫기
function initCloseButton() {
    const closeBtn = document.getElementById('btn-close') || document.querySelector('.close-btn');
    if (!closeBtn) return;
    closeBtn.addEventListener('click', () => {
        if (!tabId) return;
        chrome.runtime.sendMessage({ type: "PANEL_CLOSE", tabId });
    });
}

// 스캔 버튼
function initEventScanImage() {
    btnExtract?.addEventListener('click', () => {
        if (!tabId || btnExtract.disabled) return;
        chrome.runtime.sendMessage({ type: 'PANEL_SCAN', tabId });
    });
}

function setScanEnabled(enabled) {
    currentScanEnabled = !!enabled;
    if (!btnScan) return;

    if (enabled) {
        btnScan.disabled = false;
        btnScan.classList.remove('disabled');
        btnScan.textContent = 'Get Board Images';
        btnScan.title = 'Scan Pinterest board images';
    } else {
        btnScan.disabled = true;
        btnScan.classList.add('disabled');
        btnScan.textContent = 'Slug not found';
        btnScan.title = 'This button is only available on Pinterest board pages';
    }
}

// 5) 로그인/인증 → 인증 스크립트 주입 요청
function initSignIn() {
    if (!form) return;
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const email = (emailInput?.value || '').trim();
        if (!email) {
            statusEl.textContent = "이메일을 입력하세요.";
            return;
        }
        signIn(email);
    });
}

async function signIn(email) {
    statusEl.textContent = "인증 메일 전송 중...";
    try {
        // TODO: 실제 서버 호출로 바꾸세요.
        // await fetch("/api/auth/send-code", { ... })

        // 인증 성공했다고 가정 → 인증 스크립트로 전환 요청
        chrome.runtime.sendMessage({ type: "START_INJECT", tabId, email });
        statusEl.textContent = `인증 완료: ${email}`;
    } catch (err) {
        console.error(err);
        statusEl.textContent = "서버 오류: " + err.message;
    }
}

// 6) 리스트 렌더링
function renderPins(pins) {
    listEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    (pins || []).forEach((p) => {
        const url = typeof p === "string" ? p : p.url;
        const id  = typeof p === "string" ? "" : (p.id ?? "");

        const img = document.createElement("img");
        img.dataset.src = url;            // lazy
        img.alt = id || "";
        img.decoding = "async";
        img.loading = "lazy";
        img.fetchPriority = "low";

        img.style.display = "block";
        img.style.width = "auto";
        img.style.height = "auto";
        img.style.maxWidth = "100%";
        img.style.maxHeight = "80vh";
        img.style.borderRadius = "6px";
        img.style.border = "1px solid #ddd";
        img.style.margin = "6px";

        frag.appendChild(img);
        io.observe(img);
    });

    listEl.appendChild(frag);
}

// 7) 유틸: 핀터레스트 보드 URL 판별
function isPinterestBoardUrl(raw) {
    try {
        const u = new URL(raw);
        if (!/\.?pinterest\./i.test(u.hostname)) return false; // kr., www. 등 포함
        const segments = u.pathname.replace(/^\/|\/$/g, '').split('/');
        if (segments.length < 2) return false;

        // /pin/, /ideas 등 제외
        const first = (segments[0] || '').toLowerCase();
        if (first === 'pin' || first === 'ideas' || first === 'explore') return false;

        const [username, slug] = segments.slice(0, 2).map(s => {
            try { return decodeURIComponent(s); } catch { return s; }
        });
        return Boolean(username && slug);
    } catch {
        return false;
    }
}


/** ---------------------------------------------------------------------------------------------------------------------- */
function showBoardCard({ name, pinCount } = {}) {
    if (!boardCard || !boardName || !boardPins) return;

    if (name) {
        boardCard.classList.remove('inactive');
        boardCard.classList.remove('hidden');
        boardName.textContent = name;
        boardPins.textContent = (typeof pinCount === 'number') ? `${pinCount} pins` : '— pins';
    } else {
        showNoActiveBoard();
    }
}

function showNoActiveBoard() {
    if (!boardCard || !boardName || !boardPins) return;
    boardCard.classList.remove('hidden');
    boardCard.classList.add('inactive');
    boardName.textContent = '⚠️ No active board detected.';
    boardPins.textContent = '';
}


function hideBoardCard() {
    // 완전히 숨기지 않음 → 대신 inactive 상태 유지
    showNoActiveBoard();
}

function parseBoardFromUrl(raw) {
    try {
        const u = new URL(raw);
        if (!/\.?pinterest\./i.test(u.hostname)) return null;
        const seg = u.pathname.replace(/^\/|\/$/g,'').split('/');
        if (seg.length < 2) return null;
        const first = (seg[0] || '').toLowerCase();
        if (first === 'pin' || first === 'ideas' || first === 'explore') return null;

        const username = decodeURIComponent(seg[0]);
        const slug     = decodeURIComponent(seg[1]);
        if (!username || !slug) return null;
        return { username, slug };
    } catch { return null; }
}