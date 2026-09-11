/**
 * Kalejdoskop Café - Klient API (fetchFromAppsScript)
 */

export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby9FSknW-cDoWyqfpGLQLJp3Bjk9vtPF98VgIL3sqJmp7eUwER-0XZszxq4zi02E5gg/exec";

export const fetchFromAppsScript = async (payload = { action: "scan" }, timeoutMs = 90000) => {
  const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const scriptUrl = localStorage.getItem("APPS_SCRIPT_WEBAPP_URL") || localStorage.getItem("gas_api_url") || SCRIPT_URL;
    const fetchOptions = {
      method: "POST",
      // Użycie text/plain zapobiega wysyłaniu zapytania wstępnego OPTIONS (preflight CORS):
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      // Google Apps Script zawsze zwraca kod 302 przekierowujący na właściwe dane:
      redirect: "follow",
    };
    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    const response = await fetch(scriptUrl, fetchOptions);
    if (timer) clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

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
    if (timer) clearTimeout(timer);
    if (error && error.name === "AbortError") {
      console.warn(`Przekroczono limit czasu oczekiwania na Google Apps Script (${Math.round(timeoutMs / 1000)}s).`);
      throw new Error(`Przekroczono limit czasu odpowiedzi Google Apps Script (${Math.round(timeoutMs / 1000)}s).`);
    }
    console.error("Błąd połączenia z Google Apps Script:", error);
    throw error;
  }
};

export default {
  SCRIPT_URL,
  fetchFromAppsScript
};
