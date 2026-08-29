/**
 * Kalejdoskop Café - Konfiguracja Środowiska Google Apps Script
 * Studenckie Koło Naukowe Seksuologii
 */

const CONFIG = {
  // ŚCIŚLE WYIZOLOWANY FOLDER GŁÓWNY NA TWOIM DYSKU GOOGLE (Directory Sandboxing)
  FOLDER_PRIVATE_ID: "1Wc6F-rYstNtmOkBpRdgtEPTIIrT4ghl5",

  // WSPÓŁDZIELONY FOLDER UCZELNIANY (Dual Cloud Storage Sync)
  FOLDER_UNIVERSITY_ID: "1Wc6F-rYstNtmOkBpRdgtEPTIIrT4ghl5", // Wstaw ID dysku uczelni

  // NAZWA ARKUSZA BAZODANOWEGO
  SHEET_NAME: "Baza_Artykulow",
  WHITELIST_SHEET_NAME: "BialaLista",
  RESET_TOKENS_SHEET_NAME: "ResetTokens",

  // BAZOWY ADRES APLIKACJI (do generowania linków e-mail)
  APP_BASE_URL: "https://kalejdoskop-skn.pl",

  // KODY PIN AUTORYZACJI
  ADMIN_PIN: "2026",
  MEMBER_PIN: "skn2026",

  // MODEL GEMINI API
  GEMINI_MODEL: "gemini-1.5-flash",

  // DOMYŚLNY FALLBACK LINKU FOLDERU PIASKOWNICY
  FALLBACK_DRIVE_URL: "https://drive.google.com/drive/folders/1Wc6F-rYstNtmOkBpRdgtEPTIIrT4ghl5"
};

/**
 * Bezpieczne pobieranie klucza Gemini API ze Script Properties
 */
function getGeminiApiKey() {
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("Brak skonfigurowanego klucza GEMINI_API_KEY w Script Properties!");
  }
  return apiKey;
}
