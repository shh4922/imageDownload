// popup.js
// 팝업에서 bulk 버튼 클릭 시 content.js에 단축키 이벤트를 강제로 발생시켜 일괄 다운로드 실행

document.getElementById('bulk').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            const ev = new KeyboardEvent('keydown', { key: 'D', shiftKey: true });
            document.dispatchEvent(ev);
        }
    });
    window.close();
});