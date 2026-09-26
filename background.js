

const SCRATCH_PROJECT_REGEX = /^https?:\/\/scratch\.mit\.edu\/projects\/\d+/;

chrome.action.onClicked.addListener(async (tab) => {
  // Bail out if we're not on a Scratch project page
  if (!tab || !tab.url || !SCRATCH_PROJECT_REGEX.test(tab.url)) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => alert("Only works in your scrath project page(not editor)")
    });
    return;
  }

  // Inject the main function into the page
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: initThumbnailChanger
  });
});



function initThumbnailChanger() {
  // Don't open twice
  const existing = document.getElementById("stc-snackbar");
  if (existing) {
    existing.style.visibility = "visible";
    existing.style.opacity = "1";
    return;
  }

  const projectId = document.location.pathname.replace(/\D/g, "");

  /* ---------- Styles ---------- */
  const style = document.createElement("style");
  style.textContent = `
    #stc-snackbar {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      min-width: 320px;
      max-width: 420px;
      padding: 18px 22px;
      background: #1f1f1f;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      text-align: center;
      border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
      z-index: 999999;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.25s ease, visibility 0.25s ease;
    }
    #stc-snackbar.visible {
      opacity: 1;
      visibility: visible;
    }
    #stc-snackbar a {
      color: #4d97ff;
      cursor: pointer;
      text-decoration: none;
      font-weight: 600;
    }
    #stc-snackbar a:hover {
      text-decoration: underline;
    }
    #stc-snackbar .stc-sep {
      margin: 8px 0;
      opacity: 0.5;
    }
    #stc-snackbar .stc-progress {
      margin-top: 12px;
      height: 6px;
      background: #333;
      border-radius: 3px;
      overflow: hidden;
    }
    #stc-snackbar .stc-progress-bar {
      height: 100%;
      width: 0%;
      background: #4d97ff;
      transition: width 0.15s ease;
    }
    #stc-snackbar img {
      display: block;
      margin: 12px auto;
      border-radius: 6px;
      background: #fff;
    }
  `;
  document.head.appendChild(style);

  /* ---------- Snackbar ---------- */
  const snackbar = document.createElement("div");
  snackbar.id = "stc-snackbar";
  snackbar.innerHTML = `
    <div>
      <a id="stc-select">Select an image</a> or drag and drop anywhere on this page.
    </div>
    <div class="stc-sep">—</div>
    <a id="stc-close">Close</a>
  `;
  document.body.appendChild(snackbar);

  // Fade-in animation
  requestAnimationFrame(() => snackbar.classList.add("visible"));

  const selectBtn = document.getElementById("stc-select");
  const closeBtn = document.getElementById("stc-close");

  /* ---------- Hidden file input ---------- */
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  selectBtn.onclick = () => fileInput.click();
  closeBtn.onclick = () => hideSnackbar();

  function hideSnackbar() {
    snackbar.classList.remove("visible");
  }

  /* ---------- Cookie helper ---------- */
  function getCookie(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    return parts.length === 2 ? parts.pop().split(";").shift() : null;
  }

  /* ---------- Snackbar state helpers ---------- */
  function showMessage(html) {
    snackbar.innerHTML = html;
    snackbar.classList.add("visible");

    const close = document.getElementById("stc-close");
    if (close) close.onclick = () => hideSnackbar();

    const select = document.getElementById("stc-select");
    if (select) select.onclick = () => fileInput.click();
  }

  function showProgress(percent) {
    snackbar.innerHTML = `
      <div>Uploading… <strong>${percent}%</strong></div>
      <div class="stc-progress"><div class="stc-progress-bar" style="width:${percent}%"></div></div>
    `;
    snackbar.classList.add("visible");
  }

  function showSuccess(previewUrl) {
    snackbar.innerHTML = `
      <div>Thumbnail updated successfully!</div>
      <img src="${previewUrl}" width="144" height="108">
      <div class="stc-sep">—</div>
      <a id="stc-select">Select another image</a><br>
      <a id="stc-close">Close</a>
    `;
    snackbar.classList.add("visible");

    document.getElementById("stc-select").onclick = () => fileInput.click();
    document.getElementById("stc-close").onclick = () => hideSnackbar();
  }

  function showError(text) {
    snackbar.innerHTML = `
      <div>${text}</div>
      <div class="stc-sep">—</div>
      <a id="stc-select">Select another image</a><br>
      <a id="stc-close">Close</a>
    `;
    snackbar.classList.add("visible");

    document.getElementById("stc-select").onclick = () => fileInput.click();
    document.getElementById("stc-close").onclick = () => hideSnackbar();
  }

  /* ---------- Upload ---------- */
  function uploadThumbnail(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("Please select an image file.");
      return;
    }

    showMessage("Reading file…");

    const reader = new FileReader();

    reader.onload = (event) => {
      const previewUrl = event.target.result;
      const csrf = getCookie("scratchcsrftoken");

      if (!csrf) {
        showError("Session not found. Please log in to Scratch.");
        return;
      }

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/internalapi/project/thumbnail/${projectId}/set/`, true);
      xhr.setRequestHeader("X-csrftoken", csrf);
      xhr.setRequestHeader("Content-Type", "");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          showProgress(Math.floor((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          showSuccess(previewUrl);
        } else {
          showError("Upload failed. Try a smaller image.");
        }
      };

      xhr.onerror = () => showError("Request failed. Check your connection.");

      // Convert data URL to ArrayBuffer for the POST body
      const base64 = previewUrl.split(",")[1];
      const binary = atob(base64);
      const buffer = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
      }
      xhr.send(buffer.buffer);
    };

    reader.onerror = () => showError("Could not read the file.");

    reader.readAsDataURL(file);
  }

  fileInput.onchange = () => {
    if (fileInput.files[0]) {
      uploadThumbnail(fileInput.files[0]);
    }
  };

  /* ---------- Drag & drop ---------- */
  const dragOverHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const dropHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const item = e.dataTransfer.items[0];
    if (item && item.kind === "file") {
      uploadThumbnail(item.getAsFile());
    }
  };

  document.addEventListener("dragover", dragOverHandler);
  document.addEventListener("drop", dropHandler);
}
