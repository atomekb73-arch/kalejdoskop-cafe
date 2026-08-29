/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Kalejdoskop_35)
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "Kalejdoskop_35",
  API_URL: "https://script.google.com/macros/s/AKfycby28gUmVKgi8UW_ODHxrM5hiGJ5w8kQUI7O2hCpCRo8v_BN9m1JVIqUYDx3YDQQXMal/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycby28gUmVKgi8UW_ODHxrM5hiGJ5w8kQUI7O2hCpCRo8v_BN9m1JVIqUYDx3YDQQXMal/exec",
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
