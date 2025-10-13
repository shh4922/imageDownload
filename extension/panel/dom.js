// paneltadom.js
export const el = {
    // 상단 네브탭
    navTabs:null,
    sectionBoard:null,
    sectionSignin:null,

    // sections
    viewDetect: null,
    viewLoading: null,
    viewGallery: null,

    // detect card
    boardCard: null,
    boardName: null,
    boardPins: null,
    btnExtract: null,

    // loading
    prog: null,
    status: null,

    // gallery toolbar
    tabBtns:null,
    boardTitle: null,
    countAll: null,
    countSel: null,
    tabAll: null,
    tabSel: null,
    actionsAll: null,
    actionsSel: null,
    btnSelectAll: null,
    btnDeselectAll: null,
    btnDeselectAll2: null,
    btnDownload: null,

    // download progress
    dlWrap: null,
    dlProg: null,
    dlStatus: null,

    // grids
    gridAll: null,
    gridSel: null,

    // misc
    closeBtn: null,
    signinForm: null,
    signinEmail: null,

    // IntersectionObserver
    io: null,

    // 스크롤 기준 컨테이너(필요 시 커스터마이즈)
    scrollContainers: [],
};

export function initDomRefs() {
    // 상단 네브바
    el.navTabs   = document.querySelectorAll('.navbar .tab');   // Board / Signin
    el.sectionBoard = document.getElementById('board')
    el.sectionSignin = document.getElementById('signin')

    el.tabBtns   = document.querySelectorAll('.toolbar .tab-btn'); // ALL / SELECTED

    // sections
    el.viewDetect = document.getElementById('view-detect');
    el.viewLoading = document.getElementById('view-loading');
    el.viewGallery = document.getElementById('view-gallery');

    // detect card
    el.boardCard  = document.getElementById('board-detect');
    el.boardName  = document.getElementById('board-name');
    el.boardPins  = document.getElementById('board-pins');
    el.btnExtract = document.getElementById('btn-extract');

    // loading
    el.prog   = document.getElementById('prog');
    el.status = document.getElementById('status');

    // gallery toolbar
    el.boardTitle = document.getElementById('board-title');
    el.countAll   = document.getElementById('count-all');
    el.countSel   = document.getElementById('count-sel');
    el.tabAll     = document.getElementById('tab-all');
    el.tabSel     = document.getElementById('tab-sel');
    el.actionsAll = document.getElementById('actions-all');
    el.actionsSel = document.getElementById('actions-sel');
    el.btnSelectAll    = document.getElementById('btn-select-all');
    el.btnDeselectAll  = document.getElementById('btn-deselect-all');
    el.btnDeselectAll2 = document.getElementById('btn-deselect-all-2');
    el.btnDownload     = document.getElementById('btn-download');

    // download progress
    el.dlWrap   = document.getElementById('download-progress');
    el.dlProg   = document.getElementById('dl-prog');
    el.dlStatus = document.getElementById('dl-status');

    // grids
    el.gridAll = document.getElementById('grid-all');
    el.gridSel = document.getElementById('grid-sel');

    // misc
    el.closeBtn   = document.getElementById('btn-close') || document.querySelector('.close-btn');
    el.signinForm = document.getElementById('signin-form');
    el.signinEmail= document.getElementById('signin-email');

    // sticky/scroll 컨테이너 지정(필요 시 패널 래퍼 넣기)
    el.scrollContainers = [el.gridAll, el.gridSel].filter(Boolean);

    // lazy IO
    el.io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            if (!e.isIntersecting) continue;
            const img = e.target;
            img.src = img.dataset.src;
            el.io.unobserve(img);
        }
    }, { root: null, rootMargin: '0px', threshold: 0.01 });
}