// background.js
// content.js에서 보낸 메시지를 받아 실제 다운로드를 실행하는 부분

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === 'DOWNLOAD_ORIGINAL') {
        const { url, filename, saveAs } = msg.payload || {};
        if (!url) return sendResponse({ ok: false, error: 'NO_URL' });

        // chrome.downloads.download API 사용
        chrome.downloads.download(
            {
                url,
                filename: sanitizeFilename(filename) || undefined, // 파일명 정리
                saveAs: Boolean(saveAs)                            // true면 저장창 띄움
            },
            (downloadId) => {
                if (chrome.runtime.lastError) {
                    return sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                }
                sendResponse({ ok: true, id: downloadId });
            }
        );

        return true; // 비동기 응답을 위해 true 반환
    }
});

chrome.action.onClicked.addListener(() => {
    chrome.windows.create({
        url: "popup.html",
        type: "popup",
        width: 1600,
        height: 900
    });
});

// 파일명에서 허용되지 않는 문자 제거
function sanitizeFilename(name) {
    if (!name) return '';
    return name.replace(/[<>:\\"\|\?\*]/g, '_').slice(0, 180);
}