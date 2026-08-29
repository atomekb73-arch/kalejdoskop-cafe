/**
 * Kalejdoskop Café - Serwis API (Google Apps Script WebApp)
 * Obsługa akcji: auth, registerRequest, requestResetPin, confirmResetPin, getArticles, upload, getSecurePdf
 */

import { APP_CONFIG } from './config.js';

export async function sendGasRequest(payload) {
  const url = APP_CONFIG.API_URL;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  return await response.json();
}

/**
 * Bezpieczna konwersja obiektu File do Base64
 */
export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Brak wybranego pliku."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      if (!rawDataUrl || typeof rawDataUrl !== "string") {
        reject(new Error("Pusty strumień danych z odczytu pliku."));
        return;
      }
      let pureBase64 = rawDataUrl;
      if (rawDataUrl.includes(",")) {
        pureBase64 = rawDataUrl.split(",")[1];
      }
      resolve({
        dataUrl: rawDataUrl,
        base64: pureBase64
      });
    };
    reader.onerror = (err) => reject(new Error("Błąd odczytu pliku: " + (err.message || "FileReader error")));
    reader.readAsDataURL(file);
  });
}

/**
 * Przesyła plik PDF do Dysku Google przez WebApp Apps Script
 */
export async function uploadPdfArticle(file, metadata = {}, adminPin = "2026") {
  const { dataUrl, base64 } = await readFileAsBase64(file);

  if (!base64 || base64.trim().length === 0) {
    throw new Error("Brak danych base64 pliku.");
  }

  const payload = {
    action: "upload",
    fileBase64: base64,
    base64: base64,
    base64Data: dataUrl,
    fileName: file.name,
    name: file.name,
    mimeType: file.type || "application/pdf",
    adminPin: adminPin,
    metadata: {
      title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
      authors: metadata.authors || "SKN Seksuologii",
      year: metadata.year || new Date().getFullYear(),
      category: metadata.category || "Materiały Własne SKN",
      journal: metadata.journal || "Repozytorium SKN",
      abstract: metadata.abstract || "",
      hasPolishTranslation: Boolean(metadata.hasPolishTranslation)
    }
  };

  return await sendGasRequest(payload);
}

export default {
  sendGasRequest,
  readFileAsBase64,
  uploadPdfArticle
};
