/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Kalejdoskop_31)
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "Kalejdoskop_31",
  API_URL: "https://script.google.com/macros/s/AKfycbxTLhIM78g2eSrtVfl5VahODLuEesWMAUFrMM7QTaEXCbSpqZuJKdJpMEQnM4UsbV7N/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxTLhIM78g2eSrtVfl5VahODLuEesWMAUFrMM7QTaEXCbSpqZuJKdJpMEQnM4UsbV7N/exec",
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
