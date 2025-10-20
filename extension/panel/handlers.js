// panel/handlers.js
import { state } from './state.js';
import { el } from './dom.js';
import { showDetect, onCollected, onDownloadProgress, onDownloadDone } from './ui.js';

export const messageHandlers = Object.freeze({
    PINS_PROGRESS(msg) {
        const pct = Math.min(100, Math.max(0, Number(msg.percent) || 0));
        el.status && (el.status.textContent = `탭 #${msg.tabId} 수집: ${pct}%${pct === 100 ? ' (완료)' : ''}`);
        el.prog && (el.prog.value = pct);
    },

    PINS_COLLECTED(msg) {
        const pins = msg.pins || [];
        // msg에 pinCount가 포함되어 올 수 있으므로 반영
        if (typeof msg.pinCount === 'number') {
            state.board.pinCount = Number(msg.pinCount);
        }
        const meta = {
            title: msg.boardTitle || state.board.title,
            slug:  msg.slug       || state.board.slug,
        };
        onCollected(pins, meta);
        el.prog && (el.prog.value = 100);
    },

    // background/content에서 보드 메타를 보냈을 때(선택)
    BOARD_META(msg) {
        // msg.data { username, slug, title, pinCount }
        if (msg?.data) {
            state.board.title = msg.data.title || state.board.title;
            state.board.slug  = msg.data.slug  || state.board.slug;
            if (typeof msg.data.pinCount === 'number') {
                state.board.pinCount = Number(msg.data.pinCount);
                // 뷰에 핀 개수 업데이트
                if (el.boardPins) el.boardPins.textContent = `${state.board.pinCount} pins`;
                if (el.boardTitle) el.boardTitle.textContent = state.board.title || '—';
            }
        }
    },

    SLUG_NOT_FOUND() {
        el.status && (el.status.textContent = "Board slug not found");
        showDetect('Board slug not found', '');
    },

    DL_PROGRESS(msg) {
        const done  = msg.done  || 0;
        const total = msg.total || state.selectedIds.size;

        // 보드 전체 핀 수가 있으면 그것을 기준으로 퍼센트 계산
        const boardTotal = Number(state.board?.pinCount) || 0;
        const denom = boardTotal || total || 1;
        const pct = denom ? Math.round((done / denom) * 100) : 0;

        onDownloadProgress(done, total);

        // 원형 프로그레스 바 업데이트 (존재하면 보드 기준 pct 사용)
        const circle = document.querySelector('.circle');
        const percentage = document.querySelector('.percentage');
        if (circle && percentage) {
            const radius = 15.9155;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (pct / 100) * circumference;
            circle.style.strokeDasharray = `${circumference - offset}, ${circumference}`;
            percentage.textContent = `${pct}%`;
        }
    },

    DL_DONE() {
        onDownloadDone();
    },

    BOARD_INFO(msg) {
        if (!msg.isBoard) return showDetect('⚠️ No active board detected.', '');
        showDetect(msg.boardTitle || '—', '— pins');
    },
});

export function dispatchMessage(msg) {
    if (!msg || !msg.type) return;
    const handler = messageHandlers[msg.type];
    if (handler) handler(msg);
    // else console.debug('[PANEL] Unhandled message:', msg.type, msg);
}
