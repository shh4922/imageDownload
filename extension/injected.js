(async function () {
    console.log("[PAGE] injected.js 실행됨 → origin:", location.origin);


    function getCookie(name) {
        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1];
    }

    // 1. appVersion 자동 추출
    function getAppVersion() {
        const el = document.getElementById("__PWS_DATA__");
        if (!el) return null;
        try {
            const json = JSON.parse(el.textContent);
            return json?.client_context?.app_version || null;
        } catch {
            return null;
        }
    }

    // 2. ActiveUser payload 빌더
    function buildActiveUserPayload() {
        return {
            options: {
                data: {
                    appVersion: getAppVersion() || "unknown",
                    auxData: { stage: "prod" },
                    browser: 1,
                    clientUUID: crypto.randomUUID(),
                    event_type: 7137, // ActiveUser 이벤트 코드
                    time: Date.now() * 1000000, // ns 단위 timestamp
                    unauth_id: getCookie("unauth_id"),
                    view_type: 5,
                    view_parameter: 3070
                }
            },
            context: {}
        };
    }

    // 3. 세션 활성화
    async function ensureActiveSession() {
        const csrf = getCookie("csrftoken");
        if (!csrf) {
            console.warn("[PAGE] csrftoken 없음");
            return false;
        }

        const payload = buildActiveUserPayload();
        const body = new URLSearchParams();
        body.set("source_url", location.pathname);
        body.set("data", JSON.stringify(payload));

        const res = await fetch(`${location.origin}/resource/ActiveUserResource/create/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-csrftoken": csrf,
            },
            credentials: "include",
            body: body.toString()
        });

        // console.log("[PAGE] ActiveUserResource 응답:", res.status);
        return res.ok;
    }



    /**
     * slug로 보드 ID 가져오기
     * @param {string} username - 보드 주인 username
     * @param {string} slug - 보드 slug
     */
    async function getBoardInfo(username, slug) {
        const boardUrl = `/${username}/${slug}/`;
        const csrftoken = document.cookie
            .split("; ")
            .find(row => row.startsWith("csrftoken="))
            ?.split("=")[1];

        const url = `${location.origin}/resource/BoardResource/get/?` +
            "source_url=" + encodeURIComponent(boardUrl) +
            "&data=" + encodeURIComponent(JSON.stringify({
                options: { username, slug, field_set_key: "detailed" },
                context: {}
            }));

        const res = await fetch(url, {
            method: "GET",
            credentials: "include",
            headers: {
                "accept": "application/json, text/javascript, */*; q=0.01",
                "x-requested-with": "XMLHttpRequest",
                "x-pinterest-appstate": "active",
                "x-pinterest-source-url": boardUrl,
                "x-pinterest-pws-handler": "www/[username]/[slug].js",
                "x-app-version": "9d30d92",
                ...(csrftoken ? { "x-csrftoken": csrftoken } : {})
            }
        });

        if (!res.ok) {
            console.error("BoardResource 실패:", res.status);
            return null;
        }
        const json = await res.json();
        // console.log("boardInfo json", json)
        // console.log("pin count", json.resource_response.data.pin_count)
        // json.resource_response.data.pin_count : 이미지 개수. 이거 n개로 나누어서 병렬로 쏘게 하면 더 빠를듯.
        //     ?.resource_response?.data?.id;
        return json
    }

    // 4. 보드 핀 긁기
    async function fetchBoardPins() {
        const boardUrl = location.pathname;                                                 // "/duckduckduccoon/3-arcade/"
        const [userName, slug] = boardUrl.split('/').filter(v => v !== '');    // ""

        // 1. boardId 가져오기
        const boardInfoRes = await getBoardInfo(userName, slug);
        const boardId =  boardInfoRes?.resource_response?.data?.id;
        const pinCount =  boardInfoRes?.resource_response?.data?.pin_count

        if (!boardId || !pinCount) {
            console.warn("[PAGE] boardId 찾을 수 없음");
            return [];
        }
        console.log("[PAGE] boardId =", boardId);


        const pins = [];
        let bookmark = null;
        let page = 1;


        while (true) {
            // ✅ Pinterest 프론트에서 실제로 넣는 옵션들 반영
            const options = {
                board_id: boardId,
                board_url: boardUrl,
                currentFilter: -1,
                field_set_key: "react_grid_pin",
                filter_section_pins: true,
                sort: "default",
                layout: "default",
                page_size: 25,
                redux_normalize_feed: true,
            };
            if (bookmark) options.bookmarks = [bookmark];

            const url =
                `${location.origin}/resource/BoardFeedResource/get/` +
                `?source_url=${encodeURIComponent(boardUrl)}` +
                `&data=${encodeURIComponent(JSON.stringify({ options, context: {} }))}`;

            // console.log(`[REQ page=${page}]`, url);

            const res = await fetch(url, {
                credentials: "include",
                headers: {
                    "accept": "application/json, text/javascript, */*; q=0.01",
                    "x-requested-with": "XMLHttpRequest",
                    "x-pinterest-appstate": "active",
                    "x-pinterest-source-url": boardUrl,
                    // 👇 slug 핸들러: /username/slug/ 형태
                    "x-pinterest-pws-handler": `www/${userName}/${slug}.js`,
                },
            });

            if (!res.ok) {
                console.warn(`[PAGE] 요청 실패 status=${res.status}`);
                break;
            }

            const json = await res.json();


            // console.log("resultJson", json)
            const results = json?.resource_response?.data || [];
            if (!results.length) break;

            // 핀에서 이미지 추출
            for (const pin of results) {
                const orig = pin.images?.orig?.url;     // 원본 이미지 url
                const id = pin.id;                      // Pinterest에서 제공하는 pin 고유 ID
                if (orig && id) {
                    pins.push({
                        id,      // 선택할 때 key
                        url: orig
                    });
                }
            }

            // 진행률 계산 (0~100 정수), pinCount > 0 인지 체크
            const percent = pinCount > 0 ? Math.round((pins / pinCount) * 100) : 0;

// 안전하게 0~100로 클램프(선택)
            const safePercent = Math.min(100, Math.max(0, percent));

            window.postMessage({ type: "PINS_PROGRESS", percent: safePercent }, "*");

            // console.log(`[PAGE] 누적 pins=${pins.length}`);

            // 다음 페이지 bookmark 확인
            const nextBookmark = json?.resource?.options?.bookmarks?.[0];
            if (!nextBookmark || nextBookmark === "-end-") break;
            bookmark = nextBookmark;
            // console.log("bookmark", bookmark)
            page++;
        }

        return pins;
    }

    // 5. 실행 흐름
    // const ok = await ensureActiveSession();
    // if (!ok) {
    //     console.warn("[PAGE] 세션 활성화 실패 → 핀 조회 중단");
    //     return;
    // }

    const pins = await fetchBoardPins();
    console.log("[PAGE] 이미지 핀 개수:", pins.length);

    window.postMessage({ type: "PINS_COLLECTED", pins }, "*");
    // return pins
})();