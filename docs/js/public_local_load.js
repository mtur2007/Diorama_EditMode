const EDITOR_SLOT_META_STORAGE_KEY = "mouse_demo_editor_slots_v1";
const EDITOR_THUMBNAIL_DB_NAME = "mouse-demo-editor-slot-thumbnails";
const EDITOR_THUMBNAIL_STORE_NAME = "slotThumbnails";

const bootPanel = document.querySelector(".boot-panel");
const bootMessage = document.querySelector(".boot-message");
const thumbnailApp = document.getElementById("thumbnail-app");
const thumbnailFrame = document.getElementById("thumbnail-frame");
const thumbnailStatus = document.getElementById("thumbnail-status");
const thumbnailCaptureBtn = document.getElementById("thumbnail-capture-btn");
const thumbnailBackBtn = document.getElementById("thumbnail-back-btn");
const thumbnailModal = document.getElementById("thumbnail-modal");
const thumbnailPreviewImage = document.getElementById("thumbnail-preview-image");
const thumbnailRetakeBtn = document.getElementById("thumbnail-retake-btn");
const thumbnailApplyBtn = document.getElementById("thumbnail-apply-btn");

let pendingThumbnailBlob = null;
let pendingThumbnailDataUrl = "";

function getSearchParams() {
  return new URLSearchParams(window.location.search);
}

function isThumbnailMode() {
  return String(getSearchParams().get("thumbnail_mode") || "").trim() === "1";
}

function getThumbnailSlotId() {
  return String(getSearchParams().get("slot") || "").trim();
}

function setThumbnailStatus(message) {
  if (thumbnailStatus) {
    thumbnailStatus.textContent = message;
  }
}

function showBootError(error) {
  if (bootPanel) {
    bootPanel.innerHTML = `
      <p class="boot-title">LOCAL RUNTIME VIEWER</p>
      <p class="boot-text">vewbasis.html の読込に失敗しました。</p>
      <p class="boot-text">${String(error?.message || error)}</p>
    `;
  }
  console.error("[public_local_load] index bootstrap failed", error);
}

function openThumbnailDb() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(EDITOR_THUMBNAIL_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EDITOR_THUMBNAIL_STORE_NAME)) {
        db.createObjectStore(EDITOR_THUMBNAIL_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

async function saveThumbnailRecord(slotId, record) {
  const db = await openThumbnailDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(EDITOR_THUMBNAIL_STORE_NAME, "readwrite");
    const store = transaction.objectStore(EDITOR_THUMBNAIL_STORE_NAME);
    store.put(record, slotId);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB write failed"));
    };
  });
}

function updateSlotMetaThumbnail(slotId, savedAt) {
  const raw = window.localStorage.getItem(EDITOR_SLOT_META_STORAGE_KEY);
  if (!raw) {
    return;
  }
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    return;
  }
  const updated = parsed.map((slot) => {
    if (String(slot?.slotId || "").trim() !== slotId) {
      return slot;
    }
    return {
      ...slot,
      thumbnailCapturedAt: savedAt,
    };
  });
  window.localStorage.setItem(EDITOR_SLOT_META_STORAGE_KEY, JSON.stringify(updated));
}

function closePreviewModal() {
  if (thumbnailModal) {
    thumbnailModal.hidden = true;
  }
}

function openPreviewModal(dataUrl) {
  if (thumbnailPreviewImage) {
    thumbnailPreviewImage.src = dataUrl;
  }
  if (thumbnailModal) {
    thumbnailModal.hidden = false;
  }
}

async function createThumbnailBlobFromCanvas(sourceCanvas) {
  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = 960;
  targetCanvas.height = 540;
  const ctx = targetCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("thumbnail canvas context の取得に失敗しました。");
  }
  ctx.drawImage(sourceCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
  return new Promise((resolve, reject) => {
    targetCanvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("サムネイル生成に失敗しました。"));
        return;
      }
      resolve(blob);
    }, "image/webp", 0.82);
  });
}

async function captureThumbnail() {
  if (!thumbnailFrame?.contentWindow?.document) {
    throw new Error("ワールド表示の準備が完了していません。");
  }
  const sourceCanvas = thumbnailFrame.contentWindow.document.getElementById("three-canvas");
  if (!sourceCanvas || typeof sourceCanvas.getContext !== "function") {
    throw new Error("撮影対象の canvas が見つかりません。");
  }

  const blob = await createThumbnailBlobFromCanvas(sourceCanvas);
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("thumbnail preview の生成に失敗しました。"));
    reader.readAsDataURL(blob);
  });

  pendingThumbnailBlob = blob;
  pendingThumbnailDataUrl = dataUrl;
  openPreviewModal(dataUrl);
  setThumbnailStatus("サムネプレビューを生成しました。内容を確認して保存してください。");
}

async function applyThumbnailToSlot() {
  const slotId = getThumbnailSlotId();
  if (!slotId) {
    throw new Error("保存先スロットが指定されていません。");
  }
  if (!(pendingThumbnailBlob instanceof Blob)) {
    throw new Error("保存対象のサムネイルがありません。");
  }
  const savedAt = new Date().toISOString();
  await saveThumbnailRecord(slotId, {
    blob: pendingThumbnailBlob,
    dataUrl: pendingThumbnailDataUrl,
    mimeType: pendingThumbnailBlob.type || "image/webp",
    size: pendingThumbnailBlob.size || 0,
    savedAt,
  });
  updateSlotMetaThumbnail(slotId, savedAt);
  closePreviewModal();
  setThumbnailStatus("サムネイルをローカル保存しました。編集ページへ戻れます。");
}

function goBackToEdit() {
  const slot = getThumbnailSlotId();
  const suffix = slot ? `?slot=${encodeURIComponent(slot)}` : "";
  window.location.href = `./edit.html${suffix}`;
}

async function bootThumbnailMode() {
  if (!thumbnailApp || !thumbnailFrame) {
    throw new Error("thumbnail mode UI が見つかりません。");
  }
  if (bootMessage) {
    bootMessage.hidden = true;
  }
  thumbnailApp.hidden = false;

  const params = getSearchParams();
  const iframeUrl = `./vewbasis.html?${params.toString()}`;
  thumbnailFrame.src = iframeUrl;
  thumbnailFrame.addEventListener("load", () => {
    setThumbnailStatus("ワールドを操作して構図を決めてください。右下のカメラで撮影します。");
  }, { once: true });
}

async function bootIndexDocument() {
  const response = await fetch("./vewbasis.html", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`vewbasis.html fetch failed: ${response.status}`);
  }
  const html = await response.text();
  document.open();
  document.write(html);
  document.close();
}

if (thumbnailCaptureBtn) {
  thumbnailCaptureBtn.addEventListener("click", async () => {
    try {
      setThumbnailStatus("サムネプレビューを生成中です...");
      await captureThumbnail();
    } catch (error) {
      setThumbnailStatus(`撮影に失敗しました: ${error?.message || error}`);
    }
  });
}

if (thumbnailApplyBtn) {
  thumbnailApplyBtn.addEventListener("click", async () => {
    try {
      await applyThumbnailToSlot();
    } catch (error) {
      setThumbnailStatus(`保存に失敗しました: ${error?.message || error}`);
    }
  });
}

if (thumbnailRetakeBtn) {
  thumbnailRetakeBtn.addEventListener("click", () => {
    closePreviewModal();
    setThumbnailStatus("構図を調整してもう一度撮影してください。");
  });
}

if (thumbnailBackBtn) {
  thumbnailBackBtn.addEventListener("click", goBackToEdit);
}

(isThumbnailMode() ? bootThumbnailMode() : bootIndexDocument()).catch(showBootError);
