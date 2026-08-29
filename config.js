/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Kalejdoskop_28)
 * Studenckie Koło Naukowe Seksuologii
 */

const APP_CONFIG = {
  VERSION: "Kalejdoskop_28",
  API_URL: "https://script.google.com/macros/s/AKfycbzdFSVsOW4Ee68Ny3aaNf-jxlBjZs__nGz8NT6S_sInO61-hBz6sJJbVKXvxMFNBoHZ/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzdFSVsOW4Ee68Ny3aaNf-jxlBjZs__nGz8NT6S_sInO61-hBz6sJJbVKXvxMFNBoHZ/exec",
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

if (typeof module !== "undefined" && module.exports) {
  module.exports = APP_CONFIG;
}
