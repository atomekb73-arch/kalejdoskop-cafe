/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Nd6)
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "2.1.1",
  API_URL: "https://script.google.com/macros/s/AKfycbzYN-Li31tj2doOE3H9O09LL6upO53n2AO_sPuWHDrFjLMFscU5_aQR2BpchJkTooix/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzYN-Li31tj2doOE3H9O09LL6upO53n2AO_sPuWHDrFjLMFscU5_aQR2BpchJkTooix/exec",
  SPREADSHEET_ID: "1O_PbmKe8Dy8g1YeuUNmSgqsFBVZTdoVFIciJxQ0Ta_w",
  HEADERS: {
    "Content-Type": "text/plain;charset=utf-8"
  },
  AUTH: {
    RESET_TOKEN_EXPIRATION_MINUTES: 15,
    MIN_PIN_LENGTH: 6
  }
};

if (typeof window !== "undefined") {
  window.APP_CONFIG = APP_CONFIG;
  window.CONFIG_API = APP_CONFIG;
}

export default APP_CONFIG;
