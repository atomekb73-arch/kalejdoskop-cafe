/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Kalejdoskop_32)
 * Studenckie Koło Naukowe Seksuologii
 */

const APP_CONFIG = {
  VERSION: "Kalejdoskop_32",
  API_URL: "https://script.google.com/macros/s/AKfycbySTxjI69scQYQljfGcYuZFS_8Riqz2sF9WcOp8xoWCkaSnFj8SvSnLw-tGhIFPB6t6/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbySTxjI69scQYQljfGcYuZFS_8Riqz2sF9WcOp8xoWCkaSnFj8SvSnLw-tGhIFPB6t6/exec",
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
