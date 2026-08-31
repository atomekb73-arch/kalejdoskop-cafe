/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Nd6)
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "2.1.1",
  API_URL: "https://script.google.com/macros/s/AKfycbxTBiZ8uGG3xHFfJY3lJDx9NO-G0apw4mNy7gOAGs3qieZjRe8stbrWUqpcwcFYVmVY/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxTBiZ8uGG3xHFfJY3lJDx9NO-G0apw4mNy7gOAGs3qieZjRe8stbrWUqpcwcFYVmVY/exec",
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
