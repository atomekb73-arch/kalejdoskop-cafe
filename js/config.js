/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Nd6)
 * Studenckie Koło Naukowe Seksuologii
 */

export const APP_CONFIG = {
  VERSION: "2.1.0_Nd7",
  API_URL: "https://script.google.com/macros/s/AKfycbwPnVC6bxOK176Mu2GKFZGPNSeGFFr4SQqxliv2Pr4fDPQQEpciX2DPtzFkq0eYkmO0/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwPnVC6bxOK176Mu2GKFZGPNSeGFFr4SQqxliv2Pr4fDPQQEpciX2DPtzFkq0eYkmO0/exec",
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
