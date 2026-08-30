/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Nd3)
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "Kalejdoskop_Nd3",
  API_URL: "https://script.google.com/macros/s/AKfycbzTO8fTgZEfAqD5KslGVOzK2j6_IWXaiswznuKRIFyx1Y1xqi9vEp_cwLcKlq9tKzHz/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzTO8fTgZEfAqD5KslGVOzK2j6_IWXaiswznuKRIFyx1Y1xqi9vEp_cwLcKlq9tKzHz/exec",
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
