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
        const meta = {
            title: msg.boardTitle || state.board.title,
            slug:  msg.slug       || state.board.slug,
        };
        onCollected(pins, meta);
        el.prog && (el.prog.value = 100);
    },

    SLUG_NOT_FOUND() {
        el.status && (el.status.textContent = "Board slug not found");
        showDetect('Board slug not found', '');
    },

    DL_PROGRESS(msg) {
        const done  = msg.done  || 0;
        const total = msg.total || state.selectedIds.size;
        onDownloadProgress(done, total);
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