/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Kalejdoskop_29)
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "Kalejdoskop_29",
  API_URL: "https://script.google.com/macros/s/AKfycbxklQPE5jwlotnvtxr8vpV2ZthcRyhqqYWTkGGCOHxQHlVHg3cpZksSDZnoro3-_WTM/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxklQPE5jwlotnvtxr8vpV2ZthcRyhqqYWTkGGCOHxQHlVHg3cpZksSDZnoro3-_WTM/exec",
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
