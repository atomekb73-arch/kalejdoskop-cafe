/**
 * Kalejdoskop Café - Konfiguracja Endpointu API
 * Studenckie Koło Naukowe Seksuologii
 */

const APP_CONFIG = {
  VERSION: "Kalejdoskop_38",
  API_URL: "https://script.google.com/macros/s/AKfycbyorzABkXMHV-sl793E8dHpTGsmZm1tMxA6P5TNAbh4ld6f1kuTZLwCdslhKsjpWU9Q/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyorzABkXMHV-sl793E8dHpTGsmZm1tMxA6P5TNAbh4ld6f1kuTZLwCdslhKsjpWU9Q/exec",
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
