/**
 * Kalejdoskop Café - Konfiguracja Endpointu API
 * Studenckie Koło Naukowe Seksuologii
 */

const APP_CONFIG = {
  VERSION: "Kalejdoskop_36",
  API_URL: "https://script.google.com/macros/s/AKfycbxCMvWgJ0br3tJCKWAsy9x1SIQIGBq0fociZWVTEC85_QYMG5lXsQEFNgzKtkMsnjRd/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxCMvWgJ0br3tJCKWAsy9x1SIQIGBq0fociZWVTEC85_QYMG5lXsQEFNgzKtkMsnjRd/exec",
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
