/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Nd6)
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "2.1.1",
  API_URL: "https://script.google.com/macros/s/AKfycbwKHxuqqUKKgsMECgDtzPOy6Ruu0TPxLlz5kNaCcGDQ2kU0jyLR0bQ15R9IKQiI6dw4/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwKHxuqqUKKgsMECgDtzPOy6Ruu0TPxLlz5kNaCcGDQ2kU0jyLR0bQ15R9IKQiI6dw4/exec",
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
