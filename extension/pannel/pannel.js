const elStatus = document.getElementById('status');
const elList = document.getElementById('list');

// Close button (old id="btn-close")
const closeBtn = document.getElementById('btn-close') || document.querySelector('.close-btn');
if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        window.parent.postMessage({ type: 'TOGGLE_PANEL' }, '*');
    });
}

document.getElementById('btn-scan').onclick = () => {
    setStatus('스캔 요청…');
    window.parent.postMessage({ type: 'PANEL_SCAN' }, '*');
};

document.getElementById('btn-dl-all').onclick = () => {
    const urls = [...document.querySelectorAll('a[data-url]')].map(a => a.getAttribute('data-url'));
    if (!urls.length) return alert('먼저 스캔하세요.');
    window.parent.postMessage({ type: 'PANEL_DOWNLOAD_BULK', payload: { urls, prefix: 'filterest' } }, '*');
};

window.addEventListener('message', (e) => {
    const { type, payload } = e.data || {};
    if (type === 'SCAN_RESULT') {
        const { images = [] } = payload || {};
        render(images);
        setStatus(`이미지 ${images.length}개`);
    }
});

function setStatus(t) {
    elStatus.textContent = t;
}

function render(urls) {
    elList.innerHTML = '';
    urls.forEach((u, i) => {
        const div = document.createElement('div');
        div.className = 'fr-item';
        div.innerHTML = `
      <div class="fr-row">
        <a class="fr-btn fr-link" data-url="${u}" href="${u}" target="_blank" rel="noreferrer">열기</a>
        <button class="fr-btn" data-i="${i}">저장</button>
      </div>
      
    `;
        elList.appendChild(div);
    });
    // <div className="fr-small">${escapeHtml(u)}</div>
    // 개별 저장
    elList.querySelectorAll('button[data-i]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-i'), 10);
            const url = urls[idx];
            window.parent.postMessage({type: 'PANEL_DOWNLOAD_ONE', payload: {url}}, '*');
        });
    });
}

// function escapeHtml(s){return String(s).replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',\"'\":'&#39;'}[m]))}