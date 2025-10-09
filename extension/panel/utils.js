// panel/utils.js
import { el } from './dom.js';

export function toggleHidden(node, shouldHide) {
    if (!node) return;
    node.classList.toggle('hidden', !!shouldHide);
}

// 윈도우 & 컨테이너 스크롤 잠금
export function withScrollLock(fn, {
    containers = el.scrollContainers,
    lockWindow = true
} = {}) {
    const winY = window.scrollY;
    const positions = containers
        .filter(Boolean)
        .map(c => [c, c.scrollTop]);

    fn();

    requestAnimationFrame(() => {
        if (lockWindow) window.scrollTo({ top: winY });
        for (const [c, y] of positions) c.scrollTop = y;
    });
}

export function parseBoardFromUrl(raw) {
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

// pins 정규화
export function normalizePins(pins) {
    return (pins || []).map((p, idx) => {
        if (typeof p === 'string') return { id: String(idx), thumb: p, full: p, url: p };
        return {
            id: p.id != null ? String(p.id) : String(idx),
            thumb: p.thumb || p.url || p.full,
            full:  p.full  || p.url || p.thumb,
            url:   p.url   || p.full || p.thumb,
        };
    });
}