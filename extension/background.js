// background.js
// content.js에서 보낸 메시지를 받아 실제 다운로드를 실행하는 부분

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'DOWNLOAD_ORIGINAL') {
        const { url, filename, saveAs } = msg.payload || {};
        if (!url) return sendResponse({ ok: false, error: 'NO_URL' });

        chrome.downloads.download({ url, filename, saveAs: !!saveAs }, (id) => {
            if (chrome.runtime.lastError) {
                return sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            }
            sendResponse({ ok: true, id });
        });
        return true; // async 응답
    }

    if (msg?.type === 'DOWNLOAD_BULK') {
        const { urls = [], prefix = 'pin' } = msg.payload || {};
        let i = 0;
        const next = () => {
            if (i >= urls.length) return sendResponse({ ok: true, count: urls.length });
            const u = urls[i++];
            const name = `${prefix}_${String(i).padStart(3, '0')}.jpg`;
            chrome.downloads.download({ url: u, filename: name }, () => {
                // 에러가 나도 일단 계속 진행
                next();
            });
        };
        next();
        return true;
    }
});

chrome.action.onClicked.addListener((tab) => {
    console.log(tab?.id)
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