/**
 * Kalejdoskop Café - Konfiguracja Endpointu API (Nd6)
 * Studenckie Koło Naukowe Seksuologii
 */

const APP_CONFIG = {
  APP_NAME: "Kalejdoskop Café",
  VERSION: "2.1.0_Nd7",
  API_URL: "https://script.google.com/macros/s/AKfycbwPnVC6bxOK176Mu2GKFZGPNSeGFFr4SQqxliv2Pr4fDPQQEpciX2DPtzFkq0eYkmO0/exec",
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwPnVC6bxOK176Mu2GKFZGPNSeGFFr4SQqxliv2Pr4fDPQQEpciX2DPtzFkq0eYkmO0/exec",
  DRIVE_BASE_VIEW: "https://drive.google.com/file/d/",
  ADMIN_PIN: "2026",
  MEMBER_DEFAULT_PIN: "2026",
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
