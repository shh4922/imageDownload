/**
 * 확장 전용 페이지의 스크립트
 * 브라우저 탭에 들어가있지 않아서 tabId를 모름
 * 그래서 미리 연결해두고 tabId를 구독하고있음
 */

// 1. background 와 포트 연결
const port = chrome.runtime.connect({ name: "panel" });
let tabId = null

// 2) DOM 참조
const listEl = document.getElementById("pin-list");
const statusEl = document.getElementById("status");


const progEl = document.getElementById('prog');




// 3) 현재 활성 탭을 구독
async function subscribeCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
        statusEl.textContent = "활성 탭을 찾지 못했어요.";
        return;
    }

    // background.js 와 현재 브라우저 탭 연결
    port.postMessage({ type: "PANEL_SUBSCRIBE", tabId: tab.id });
    tabId = tab.id

    statusEl.textContent = `탭 #${tab.id} 구독 중…`;

    const url = new URL(tab.url);

    // /{username}/{board-slug}/ 형태
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
        statusEl.textContent = `슬러그 없음`;
        console.log("슬러그 없음")
        return
    }

    const [username, slug] = parts;
    if (!username || !slug) {
        statusEl.textContent = `슬러그 없음`;
        console.log("슬러그 없음")
        return
    }
}


port.onMessage.addListener((msg) => {
    if (!msg || !msg.type) return;

    console.log("panel.js onRecive",msg)
    if (msg.type === "PINS_COLLECTED") {
        renderPins(msg.pins || []);
        // statusEl.textContent = ''
        return;
    }

    if (msg.type === "PINS_PROGRESS") {
        const pct = Math.min(100, Math.max(0, Number(msg.percent) || 0));
        statusEl.textContent = `탭 #${msg.tabId} 수집: ${pct}%${pct === 100 ? ' (완료)' : ''}`;
        if (progEl) progEl.value = pct;
        return;
    }

    if(msg.type === "SLUG_NOT_FOUND") {
        statusEl.textContent = "그룹을 찾지 못함ㅋㅋ"
        return;
    }
});

function renderPins(pins) {
    listEl.innerHTML = "";
    pins.forEach((p) => {
        const url = typeof p === "string" ? p : p.url;
        const id  = typeof p === "string" ? "" : (p.id ?? "");

        const img = document.createElement("img");
        img.src = url;
        img.alt = id;
        img.title = id || url;
        img.style.width = "150px";
        img.style.margin = "6px";
        img.style.borderRadius = "6px";
        img.style.border = "1px solid #ddd";

        listEl.appendChild(img);
    });

    // statusEl.textContent = `총 ${pins.length}개 이미지`;
}
subscribeCurrentTab(); // 패널 열리면 자동 구독

initNavBar()
initCloseButton()
initImageList()

// initImagePanel()

// panel.js




/**
 * 상단 Navigation 이벤트 등록
 */
function initNavBar() {
    const tabButtons = document.querySelectorAll('.tabs .tab')
    const tabContents = document.querySelectorAll('.tab-content')

    tabButtons.forEach((btn)=>{
        btn.addEventListener('click',()=>{
            // 1) 버튼 active 표시 갱신
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 2) 연결된 콘텐츠 id 확인
            const targetId = btn.dataset.target;

            // 3) 모든 콘텐츠 숨기고 대상만 보여주기
            tabContents.forEach(sec => {
                if (sec.id === targetId) {
                    sec.classList.add('active');
                } else {
                    sec.classList.remove('active');
                }
            });
        })
    })
}

/**
 * close 이벤트 등록
 * @type {HTMLElement}
 */
function initCloseButton() {
    const closeBtn = document.getElementById('btn-close') || document.querySelector('.close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if(!tabId) return
            chrome.runtime.sendMessage({
                type:"PANEL_CLOSE",
                tabId
            })
            // console.log("cilck close")
            // window.parent.postMessage({ type: 'PANEL_CLOSE' }, '*');
        });
    }
}


function initImageList() {
    const getImageListButton = document.getElementById('btn-getImageList')
    if(!getImageListButton) return
    getImageListButton.addEventListener('click',()=>{
        window.parent.postMessage({ type: "PANEL_SCAN" }, "*");
    })
}

