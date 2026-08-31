/**
 * Kalejdoskop Café - Klient API (fetchFromAppsScript)
 */

export const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxTBiZ8uGG3xHFfJY3lJDx9NO-G0apw4mNy7gOAGs3qieZjRe8stbrWUqpcwcFYVmVY/exec";

export const fetchFromAppsScript = async (payload = { action: "scan" }) => {
  try {
    const scriptUrl = localStorage.getItem("APPS_SCRIPT_WEBAPP_URL") || localStorage.getItem("gas_api_url") || SCRIPT_URL;
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

export default {
  SCRIPT_URL,
  fetchFromAppsScript
};
