/**
 * Kalejdoskop Café - Serwis API (Google Apps Script WebApp)
 * Bezpieczna komunikacja odporna na blokady CORS (text/plain + redirect: follow)
 * Obsługa akcji: auth, registerRequest, requestResetPin, confirmResetPin, getArticles, upload, getSecurePdf, chat, scan, delete, proposal
 */

import { APP_CONFIG } from './config.js';

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxTBiZ8uGG3xHFfJY3lJDx9NO-G0apw4mNy7gOAGs3qieZjRe8stbrWUqpcwcFYVmVY/exec";

/**
 * Klient sieciowy Google Apps Script z obsługą CORS text/plain i przekierowań 302
 */
export const fetchFromAppsScript = async (payload = { action: "scan" }) => {
  try {
    const scriptUrl = localStorage.getItem("APPS_SCRIPT_WEBAPP_URL") || localStorage.getItem("gas_api_url") || APP_CONFIG?.API_URL || SCRIPT_URL;
    const response = await fetch(scriptUrl, {
      method: "POST",
      // Użycie text/plain zapobiega wysyłaniu zapytania wstępnego OPTIONS (preflight CORS):
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      // Google Apps Script zawsze zwraca kod 302 przekierowujący na właściwe dane:
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    // Zdjęcie flagi offline po pomyślnej komunikacji sieciowej
    if (typeof window !== "undefined") {
      window.isOffline = false;
      if (window.AppState) window.AppState.isOffline = false;
      if (typeof window.setSyncStatus === "function") {
        window.setSyncStatus("synced");
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Błąd połączenia z Google Apps Script:", error);
    throw error;
  }
};

/**
 * Bezpieczna funkcja wywołania akcji Google Apps Script
 */
export async function callGoogleScript(action, payload = {}) {
  return await fetchFromAppsScript({
    action: action,
    ...payload
  });
}

export async function sendGasRequest(payload) {
  return await fetchFromAppsScript(payload);
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
    titlePL: articleData.titlePL || articleData.title,
    titleEN: articleData.titleEN || "",
    authors: articleData.authors || "Autor nieznany",
    year: articleData.year || String(new Date().getFullYear()),
    category: articleData.category || "Edukacja Seksualna",
    abstractPL: articleData.abstractPL || articleData.abstract || "",
    sourceUrl: articleData.sourceUrl || articleData.url,
    url: articleData.sourceUrl || articleData.url,
    urlOriginal: articleData.sourceUrl || articleData.url,
    urlTranslation: articleData.sourceUrl || articleData.url,
    doi: articleData.doi || "",
    keywords: articleData.keywords || ["Artykuł Web", "Open Access", articleData.category || "Edukacja Seksualna"],
    accessLevel: articleData.accessLevel || "PUBLIC",
    adminPin: adminPin
  };

  const result = await callGoogleScript("saveWebArticle", payload);
  if (result && (result.status === "error" || result.success === false)) {
    throw new Error(result.message || result.error || "Błąd zapisu w Arkuszu Google");
  }
  return result;
}

export default {
  fetchFromAppsScript,
  callGoogleScript,
  sendGasRequest,
  readFileAsBase64,
  uploadPdfArticle,
  saveWebArticle,
  updateArticleMeta,
  askDocument
};
