/**
 * Kalejdoskop Café - Serwis API (Google Apps Script WebApp)
 * Bezpieczna komunikacja odporna na blokady CORS (text/plain + redirect: follow)
 * Obsługa akcji: auth, registerRequest, requestResetPin, confirmResetPin, getArticles, upload, getSecurePdf, chat, scan, delete, proposal
 */

import { APP_CONFIG } from './config.js';

/**
 * Bezpieczna funkcja wywołania Google Apps Script odporna na blokady CORS:
 * @param {string} action - Nazwa akcji backendu (np. 'getArticles', 'upload', 'getSecurePdf')
 * @param {Object} payload - Obiekt danych
 * @returns {Promise<Object>}
 */
export async function callGoogleScript(action, payload = {}) {
  const scriptUrl = localStorage.getItem('APPS_SCRIPT_WEBAPP_URL') || localStorage.getItem('gas_api_url') || APP_CONFIG.API_URL;
  
  // Dołączamy akcję również do query params dla 100% pewności routingu
  const urlWithAction = `${scriptUrl}?action=${encodeURIComponent(action)}`;

  const bodyData = JSON.stringify({
    action: action,
    ...payload
  });

  const response = await fetch(urlWithAction, {
    method: 'POST',
    // Użycie text/plain zapobiega wysyłaniu zapytania preflight OPTIONS, które blokuje Apps Script
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: bodyData,
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Błąd HTTP: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  return result;
}

export async function sendGasRequest(payload) {
  const action = payload.action || 'getArticles';
  return await callGoogleScript(action, payload);
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

  return await callGoogleScript("upload", payload);
}

/**
 * Aktualizacja metadanych publikacji (poziom dostępu i kategoria)
 */
export async function updateArticleMeta(recordId, accessLevel, category, adminPin = "2026") {
  const payload = {
    action: "updateArticleMeta",
    recordId: recordId,
    articleId: recordId,
    accessLevel: accessLevel,
    category: category,
    adminPin: adminPin
  };
  return await callGoogleScript("updateArticleMeta", payload);
}

/**
 * Pytanie do artykułu Journal Club (AI Assistant) z pełnym wstrzyknięciem kontekstu
 */
export async function askDocument(article, userQuestion) {
  const meta = article.meta || article.data || article;
  const payload = {
    action: "askDocument",
    question: userQuestion,
    query: userQuestion,
    recordId: article.id,
    articleId: article.id,
    fileId: article.fileIdOriginal || article.fileId || article.id,
    title: meta.titlePL || article.titlePL || article.title || "Publikacja",
    authors: meta.authors || article.authors || "Autor nieznany",
    year: meta.year || article.year || "2026",
    category: meta.category || article.category || "Edukacja Seksualna",
    abstract: meta.abstractPL || article.abstractPL || article.abstract || "",
    abstractPL: meta.abstractPL || article.abstractPL || article.abstract || "",
    reportContext: article.report ? (typeof article.report === "object" ? JSON.stringify(article.report) : String(article.report)) : ""
  };
  return await callGoogleScript("askDocument", payload);
}

/**
 * Zapisuje artykuł ze źródła internetowego (WEB) w Arkuszu Google
 */
export async function saveWebArticle(articleData, adminPin = "2026") {
  const payload = {
    action: "saveWebArticle",
    type: "WEB",
    ...articleData,
    adminPin: adminPin
  };
  return await callGoogleScript("saveWebArticle", payload);
}

export default {
  callGoogleScript,
  sendGasRequest,
  readFileAsBase64,
  uploadPdfArticle,
  saveWebArticle,
  updateArticleMeta,
  askDocument
};
