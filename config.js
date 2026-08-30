/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Nd6)
 * Studenckie Koło Naukowe Seksuologii
 */

const APP_CONFIG = {
  VERSION: "Kalejdoskop_Nd6",
  API_URL: "https://script.google.com/macros/s/AKfycbzEsEWvs8tPk2hVbErW2f4iVQv9blCYpiCPhU_QxsaknVAdG5nfMMGDlT9EIm3R1qrX/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzEsEWvs8tPk2hVbErW2f4iVQv9blCYpiCPhU_QxsaknVAdG5nfMMGDlT9EIm3R1qrX/exec",
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
