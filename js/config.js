/**
 * Kalejdoskop Café - Konfiguracja Endpointu API
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "Kalejdoskop_34",
  API_URL: "https://script.google.com/macros/s/AKfycbxWpi5BQHlsiyilsEa7GoktwKodlsgsG7LD23rbO14x44apSLgkxM1k98VhtpPzbWj6/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxWpi5BQHlsiyilsEa7GoktwKodlsgsG7LD23rbO14x44apSLgkxM1k98VhtpPzbWj6/exec",
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
