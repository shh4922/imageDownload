// content.js
// Pinterest 페이지에 버튼을 삽입하고, 이미지 URL을 추출하여 다운로드 요청을 background.js에 전달

const BTN_CLASS = 'filterest-download-btn'; // 다운로드 버튼 클래스
const SEEN_ATTR = 'data-filterest-seen';    // 중복 삽입 방지를 위한 속성
let observing = false;


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "CHECK_BOARD_PAGE") {
        sendResponse({ isBoard: isBoardPage() });
    }

    if (msg?.type === "GET_BOARD_IMAGES") {
        if (!isBoardPage()) {
            return sendResponse({ images: [] });
        }
        sendResponse({ images: collectBoardImages() });
    }
});


init();

function init() {
    // 최초 실행 시 버튼 주입 + DOM 변경 감시 시작
    injectButtons();
    if (!observing) startObserver();

    // 단축키 등록 (Shift+D → 보이는 이미지 일괄 저장)
    // document.addEventListener('keydown', (e) => {
    //     if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
    //         bulkDownloadVisible();
    //     }
    // });
}

function isBoardPage() {
    const parts = location.pathname.split('/').filter(Boolean);
    // 최소한 2개 이상 segment 있으면 보드라고 간주
    // return parts.length >= 2;
    return true
}


function collectBoardImages() {
    const images = Array.from(document.querySelectorAll("img"))
        .map(img => {
            if (img.srcset) {
                const parts = img.srcset.split(',').map(s => s.trim().split(' '));
                return parts[parts.length - 1][0];
            }
            return img.src;
        })
        .filter(src => src.includes("pinimg.com"));
    return [...new Set(images)];
}

// DOM 변경 감시 (무한스크롤 대응)
function startObserver() {
    observing = true;
    const obs = new MutationObserver(() => injectButtons());
    obs.observe(document.body, { subtree: true, childList: true });
}

// 이미지마다 버튼 삽입
function injectButtons() {
    const imgs = Array.from(document.querySelectorAll('img'))
        .filter(img => !img.hasAttribute(SEEN_ATTR)) // 아직 처리 안 된 이미지
        .filter(img => /pinimg\.com/.test(img.src) || /pinimg\.com/.test(img.srcset || ''));

    for (const img of imgs) {
        img.setAttribute(SEEN_ATTR, '1');

        // 카드 컨테이너 탐색
        let card = img.closest('div[role="listitem"], div[data-test-id], div[data-grid-item]') || img.parentElement;
        if (!card) card = img.parentElement;

        // 버튼 중복 삽입 방지
        if (card && card.querySelector(`.${BTN_CLASS}`)) continue;

        // 다운로드 버튼 생성
        const btn = document.createElement('button');
        btn.className = BTN_CLASS;
        btn.title = 'Download original';
        btn.textContent = '↓';
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            const bestUrl = getBestImageUrl(img); // 가장 큰 해상도 URL 추출
            const name = buildName(card, img);    // 파일명 생성
            triggerDownload(bestUrl, name);       // 다운로드 실행
        });

        // 카드 오른쪽 위에 버튼 삽입
        (card || img.parentElement).style.position ||= 'relative';
        (card || img.parentElement).appendChild(btn);
    }
}

// srcset에서 최대 해상도 URL 선택
function getBestImageUrl(img) {
    const set = img.getAttribute('srcset');
    if (set) {
        const parts = set.split(',').map(s => s.trim());
        let best = { url: img.src, w: 0 };
        for (const p of parts) {
            const [u, wtxt] = p.split(' ');
            const w = parseInt(wtxt);
            if (!Number.isNaN(w) && w > best.w) best = { url: u, w };
        }
        if (best.url) return absolutize(best.url);
    }
    return absolutize(img.src);
}

// 상대경로를 절대경로로 변환
function absolutize(url) {
    try {
        return new URL(url, location.href).toString();
    } catch {
        return url;
    }
}

// 파일명 생성 규칙
function buildName(card, img) {
    const t = new Date();
    const ts = `${t.getFullYear()}${String(t.getMonth()+1).padStart(2,'0')}${String(t.getDate()).padStart(2,'0')}`+
        `_${String(t.getHours()).padStart(2,'0')}${String(t.getMinutes()).padStart(2,'0')}${String(t.getSeconds()).padStart(2,'0')}`;
    const alt = (img.getAttribute('alt') || '').trim().slice(0, 60).replace(/\s+/g, '_');
    const label = alt || (card?.getAttribute('aria-label') || '').trim().slice(0,60).replace(/\s+/g,'_') || 'pin';
    const ext = guessExtFromUrl(img.src) || 'jpg';
    return `${ts}_${label}_${Math.random().toString(36).slice(2,6)}.${ext}`;
}

// URL에서 확장자 추측
function guessExtFromUrl(url) {
    const u = url.split('?')[0].toLowerCase();
    if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'jpg';
    if (u.endsWith('.png')) return 'png';
    if (u.endsWith('.webp')) return 'webp';
    return 'jpg';
}

// background.js에 다운로드 요청
async function triggerDownload(url, filename) {
    chrome.runtime.sendMessage({
        type: 'DOWNLOAD_ORIGINAL',
        payload: { url, filename, saveAs: false }
    }, (res) => {
        if (!res?.ok) {
            console.warn('Download failed:', res?.error);
        }
    });
}

// 현재 화면에 보이는 이미지들을 일괄 다운로드
function bulkDownloadVisible() {
    const viewport = document.documentElement.clientHeight;
    const imgs = Array.from(document.querySelectorAll('img'))
        .filter(img => /pinimg\.com/.test(img.src) || /pinimg\.com/.test(img.srcset || ''))
        .filter(img => {
            const r = img.getBoundingClientRect();
            return r.top < viewport && r.bottom > 0; // 뷰포트 안에 보이는 이미지만
        });

    // 100개까지, 250ms 간격으로 다운로드
    imgs.slice(0, 100).forEach((img, i) => {
        const url = getBestImageUrl(img);
        const name = buildName(img.closest('[role="listitem"]') || img.parentElement, img);
        setTimeout(() => triggerDownload(url, name), i * 250);
    });
}