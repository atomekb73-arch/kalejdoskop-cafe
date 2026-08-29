/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Kalejdoskop_33)
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "Kalejdoskop_33",
  API_URL: "https://script.google.com/macros/s/AKfycbzIXBbheNKdBQunarQ6nHMeYz53KPRk7S4klwsY1_ZPfeI9lN6eUFycLstui0n1QpWp/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzIXBbheNKdBQunarQ6nHMeYz53KPRk7S4klwsY1_ZPfeI9lN6eUFycLstui0n1QpWp/exec",
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
