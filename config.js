/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Nd5)
 * Studenckie Koło Naukowe Seksuologii
 */

const APP_CONFIG = {
  VERSION: "Kalejdoskop_Nd5",
  API_URL: "https://script.google.com/macros/s/AKfycbzH9ZwK7cS5wY91_KIVlA9GC-9mmy0W0mr94C3SD_5syDLHoDw44XD5jXbm0FPT6dvv/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzH9ZwK7cS5wY91_KIVlA9GC-9mmy0W0mr94C3SD_5syDLHoDw44XD5jXbm0FPT6dvv/exec",
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
