/**
 * Kalejdoskop Café - Konfiguracja Endpointu API
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "Kalejdoskop_37",
  API_URL: "https://script.google.com/macros/s/AKfycbwaPxFAvBkFLAgOBFLWsaVOBYB6pxC4J8Zvvvm9L3L_Te0VxsdNqoqb88KeEJHWT1bx/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwaPxFAvBkFLAgOBFLWsaVOBYB6pxC4J8Zvvvm9L3L_Te0VxsdNqoqb88KeEJHWT1bx/exec",
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
