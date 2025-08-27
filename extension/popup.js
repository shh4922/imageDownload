document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".tab");
    const contents = document.querySelectorAll(".tab-content");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            contents.forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            const targetId = tab.dataset.target;
            document.getElementById(targetId).classList.add("active");

            if (targetId === "board") {
                checkAndLoadBoard();
            }
        });
    });
});

function checkAndLoadBoard() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        console.log(tabs)
        chrome.tabs.sendMessage(tabs[0].id, { type: "CHECK_BOARD_PAGE" }, (res) => {
            console.log(res)
            if (!res?.isBoard) {
                document.getElementById("boardImages").innerHTML = `
          <p style="color:red;">⚠️ 현재 페이지는 보드(Board) 페이지가 아닙니다.</p>
        `;
                return;
            }

            // 보드라면 이미지 요청
            chrome.tabs.sendMessage(tabs[0].id, { type: "GET_BOARD_IMAGES" }, (res2) => {
                if (res2?.images?.length) {
                    renderBoardImages(res2.images);
                } else {
                    document.getElementById("boardImages").innerHTML = "<p>이미지를 찾을 수 없습니다.</p>";
                }
            });
        });
    });
}

function renderBoardImages(images) {
    const container = document.getElementById("boardImages");
    container.innerHTML = "";

    images.forEach(url => {
        const item = document.createElement("div");
        item.innerHTML = `
      <img src="${url}" width="80" />
      <button data-url="${url}" class="download-btn">다운로드</button>
    `;
        container.appendChild(item);
    });

    container.querySelectorAll(".download-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const url = e.target.dataset.url;
            chrome.runtime.sendMessage({
                type: "DOWNLOAD_ORIGINAL",
                payload: { url, filename: "pin_" + Date.now() + ".jpg" }
            });
        });
    });
}