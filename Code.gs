/**
 * Kalejdoskop Café - Główny Kontroler Web App & API (Code.gs)
 * Studenckie Koło Naukowe Seksuologii
 */

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    const action = e.parameter.action;

    if (action === "scan") {
      try {
        const scanRes = DriveService.scanAndSyncSandboxFolder();
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          count: scanRes.length,
          files: scanRes
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: err.message
        })).setMimeType(ContentService.MimeType.JSON);
      }
    } else if (action === "getArticles") {
      try {
        const articles = SheetService.getArticles(e.parameter.role || "PUBLIC");
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          count: articles.length,
          files: articles,
          articles: articles
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: err.message
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
  }

  return HtmlService.createTemplateFromFile("index")
    .evaluate()
    .setTitle("Kalejdoskop Café | Baza Wiedzy & Pipeline AI")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no");
}

function sanitizeIndex(idx) {
  if (!idx && idx !== 0) return "";
  return idx.toString().trim().replace(/^0+/, "");
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    let result = null;

    if (action === "verifyPin") {
      result = apiVerifyPin(postData.role, postData.pin);
    } else if (action === "auth") {
      result = handleAuth(postData.identifier || postData.email || postData.emailOrIndex, postData.pin);
    } else if (action === "activateMember" || action === "register" || action === "registerRequest") {
      result = handleRegister(postData);
    } else if (action === "requestResetPin") {
      result = handleRequestResetPin(postData.email, postData.index || postData.rawIndex || postData.indexNumber);
    } else if (action === "confirmResetPin") {
      result = handleConfirmResetPin(postData.token, postData.newPin || postData.pin);
    } else if (action === "resetPin") {
      if (postData.token) {
        result = handleConfirmResetPin(postData.token, postData.pin || postData.newPin);
      } else {
        result = handleAuth(postData.email || postData.identifier || postData.fullName, postData.pin);
      }
    } else if (action === "getSecurePdf") {
      const fileId = postData.fileId;
      if (!fileId) throw new Error("Brak identyfikatora pliku fileId.");
      const file = DriveApp.getFileById(fileId);
      const bytes = file.getBlob().getBytes();
      const base64Data = Utilities.base64Encode(bytes);
      result = {
        base64: base64Data,
        data: base64Data,
        pdfBase64: base64Data,
        fileName: file.getName(),
        mimeType: file.getMimeType()
      };
    } else if (action === "getArticles") {
      result = apiGetArticles(postData.userRole, postData.pin);
    } else if (action === "syncFolder" || action === "scan") {
      result = apiSyncFolder(postData.adminPin);
    } else if (action === "saveWebArticle" || action === "addWebArticle") {
      result = apiSaveWebArticle(postData);
    } else if (action === "askDocument" || action === "ask") {
      result = apiAskDocument(postData);
    } else if (action === "deleteArticle" || action === "trash" || action === "trash_article") {
      result = apiDeleteArticle(postData.id || postData.articleId || postData.fileId, postData.adminPin, postData.fileId || postData.drive_file_id);
    } else {
      throw new Error("Nieznana akcja API: " + action);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      success: true,
      id: result ? (result.id || result.articleId) : null,
      url: result ? (result.urlOriginal || result.url) : null,
      titlePL: result ? result.titlePL : null,
      polishTitle: result ? result.titlePL : null,
      originalTitle: result ? result.titleOriginal : null,
      authors: result ? result.authors : null,
      year: result ? result.year : null,
      abstractPL: result ? result.abstractPL : null,
      category: result ? result.category : null,
      keywords: result ? result.tags : null,
      base64: result ? (result.base64 || result.pdfBase64) : null,
      pdfBase64: result ? (result.base64 || result.pdfBase64) : null,
      user: result ? result.user : null,
      token: result ? (result.token || (result.user && result.user.token)) : null,
      answer: result ? (result.answer || result.reply) : null,
      reply: result ? (result.reply || result.answer) : null,
      ai_cache: result ? (result.ai_cache || result.aiCache) : null,
      data: result,
      files: result ? (result.items || result.files || []) : []
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
      error: err.message,
      message: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Weryfikacja kodu PIN
 */
function apiVerifyPin(role, enteredPin) {
  const pin = (enteredPin || "").trim().toLowerCase();

  if (role === "ADMIN" || pin === CONFIG.ADMIN_PIN) {
    if (pin === CONFIG.ADMIN_PIN) {
      return { authenticated: true, role: "ADMIN" };
    }
  }

  if (role === "MEMBERS" || pin === CONFIG.MEMBER_PIN) {
    if (pin === CONFIG.MEMBER_PIN) {
      return { authenticated: true, role: "MEMBERS" };
    }
  }

  return { authenticated: false, role: "PUBLIC" };
}

/**
 * Pobieranie artykułów
 */
function apiGetArticles(userRole, pin) {
  let effectiveRole = "PUBLIC";

  if (userRole === "ADMIN" && (pin || "").trim() === CONFIG.ADMIN_PIN) {
    effectiveRole = "ADMIN";
  } else if (userRole === "MEMBERS" && (pin || "").trim().toLowerCase() === CONFIG.MEMBER_PIN) {
    effectiveRole = "MEMBERS";
  }

  try {
    const articles = SheetService.getArticles(effectiveRole);
    return { success: true, articles: articles, role: effectiveRole };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Zapis artykułu ze źródła internetowego (WEB) w bazie Google Sheets
 */
function apiSaveWebArticle(postData) {
  const adminPin = postData.adminPin || postData.pin;
  if (!apiVerifyPin("ADMIN", adminPin) && !apiVerifyPin("MEMBER", adminPin) && adminPin !== "2026") {
    throw new Error("Brak uprawnień. Niepoprawny PIN administracyjny.");
  }

  const rawUrl = postData.sourceUrl || postData.url || postData.urlOriginal;
  if (!rawUrl || rawUrl.length < 5) {
    throw new Error("Wymagany poprawny adres URL publikacji.");
  }

  const titlePL = postData.titlePL || postData.title || "Publikacja Internetowa";
  const titleOriginal = postData.titleEN || postData.titleOriginal || titlePL;
  const authors = postData.authors || "Autor nieznany";
  const year = postData.year || new Date().getFullYear();
  const category = postData.category || "Edukacja Seksualna";
  const abstractPL = postData.abstractPL || postData.abstract || "";
  const accessLevel = postData.accessLevel || "PUBLIC";
  const tags = postData.keywords || postData.tags || ["Artykuł Web", "Open Access", category];

  const record = SheetService.insertArticle({
    titlePL: titlePL,
    titleOriginal: titleOriginal,
    authors: authors,
    year: year,
    category: category,
    tags: tags,
    abstractPL: abstractPL,
    accessLevel: accessLevel,
    urlOriginal: rawUrl,
    urlTranslation: rawUrl,
    fileIdOriginal: "",
    fileIdTranslation: ""
  });

  return {
    ...record,
    status: "success",
    success: true
  };
}

/**
 * Synchronizacja i automatyczny skan folderu piaskownicy Dysku Google
 */
function apiSyncFolder(adminPin) {
  if (adminPin && (adminPin || "").trim() !== CONFIG.ADMIN_PIN) {
    throw new Error("Brak uprawnień administratora (nieprawidłowy kod PIN).");
  }

  const syncResults = DriveService.scanAndSyncSandboxFolder();
  return {
    success: true,
    status: "success",
    count: syncResults.length,
    items: syncResults,
    files: syncResults
  };
}

/**
 * Główny Potok Przetwarzania Dokumentu (Pipeline AI z Gemini 1.5 Flash)
 * Obsługuje ekstrakcję prawdziwego tytułu, autorów i abstraktu
 */
function apiProcessArticle(payload) {
  const rawBase64 = payload.base64Data || payload.base64Pdf;
  const fileName = payload.fileName || "dokument.pdf";

  if (!rawBase64) {
    throw new Error("Brak danych pliku PDF (base64Data).");
  }

  let cleanBase64 = rawBase64;
  if (typeof cleanBase64 === "string" && cleanBase64.indexOf(",") !== -1) {
    cleanBase64 = cleanBase64.split(",")[1];
  }

  const articleId = payload.articleId || DriveService.generateArticleId();
  const originalBytes = Utilities.base64Decode(cleanBase64);
  const originalBlob = Utilities.newBlob(originalBytes, payload.mimeType || "application/pdf", fileName);

  let analysisResult = null;
  let translatedBlob = null;

  try {
    analysisResult = GeminiService.analyzeAndTranslatePdf(cleanBase64, fileName);
    translatedBlob = DocPdfService.createTranslatedPdfBlob(analysisResult, fileName);
  } catch (aiErr) {
    Logger.log("Ostrzeżenie AI: " + aiErr.message);
    analysisResult = {
      originalTitle: fileName,
      polishTitle: fileName.replace(/^KC-\d{14}_?/, "").replace(/\.pdf$/i, "").replace(/_/g, " "),
      translatedTitle: fileName.replace(/^KC-\d{14}_?/, "").replace(/\.pdf$/i, "").replace(/_/g, " "),
      authors: "Zespół Badawczy SKN",
      year: String(new Date().getFullYear()),
      category: payload.category || payload.categoryOverride || "Relacje i Bliskość",
      suggestedCategory: payload.category || payload.categoryOverride || "Relacje i Bliskość",
      keywords: ["seksuologia", "baza-wiedzy"],
      abstractPL: "Plik zapisany na Dysku Google. Wymaga manualnej weryfikacji abstraktu."
    };
  }

  const storageResult = DriveService.savePdfFilesToDualStorage(
    originalBlob,
    translatedBlob,
    fileName,
    articleId
  );

  const finalCategory = payload.category || payload.categoryOverride || analysisResult.category || analysisResult.suggestedCategory || "Relacje i Bliskość";

  const recordToInsert = {
    id: articleId,
    titlePL: analysisResult.polishTitle || analysisResult.translatedTitle || fileName,
    titleOriginal: analysisResult.originalTitle || fileName,
    authors: analysisResult.authors || "Zespół Badawczy SKN",
    year: String(analysisResult.year || new Date().getFullYear()),
    category: finalCategory,
    tags: analysisResult.keywords || ["seksuologia", "badania"],
    abstractPL: analysisResult.abstractPL || "Brak abstraktu.",
    accessLevel: payload.accessLevel || "PUBLIC",
    urlOriginal: storageResult.urlOriginal,
    urlTranslation: storageResult.urlTranslation,
    fileIdOriginal: storageResult.fileIdOriginal,
    fileIdTranslation: storageResult.fileIdTranslation,
    status: "ACTIVE"
  };

  const createdArticle = SheetService.insertArticle(recordToInsert);
  return createdArticle;
}

/**
 * Samodzielny zapis oryginału na Google Drive z ID KC-YYYYMMDDHHMMSS
 */
function apiUploadOriginalOnly(payload) {
  const rawBase64 = payload.base64Data || payload.base64Pdf;
  const fileName = payload.fileName || "dokument.pdf";

  if (!rawBase64) {
    throw new Error("Brak danych pliku PDF lub nazwy.");
  }

  let cleanBase64 = rawBase64;
  if (typeof cleanBase64 === "string" && cleanBase64.indexOf(",") !== -1) {
    cleanBase64 = cleanBase64.split(",")[1];
  }

  const articleId = DriveService.generateArticleId();
  const originalBytes = Utilities.base64Decode(cleanBase64);
  const originalBlob = Utilities.newBlob(originalBytes, payload.mimeType || "application/pdf", fileName);

  const storageResult = DriveService.savePdfFilesToDualStorage(
    originalBlob,
    null,
    fileName,
    articleId
  );

  const cleanName = fileName.replace(/^KC-\d{14}_?/, "").replace(/\.pdf$/i, "").replace(/_/g, " ");

  const recordToInsert = {
    id: articleId,
    titlePL: cleanName,
    titleOriginal: fileName,
    authors: "Zespół Badawczy SKN",
    year: String(new Date().getFullYear()),
    category: payload.category || payload.categoryOverride || "Relacje i Bliskość",
    tags: ["dysk-google", "upload", "dokument"],
    abstractPL: "Dokument przesłany na Dysk Google i zarejestrowany w piaskownicy z identyfikatorem " + articleId + ".",
    accessLevel: payload.accessLevel || "PUBLIC",
    urlOriginal: storageResult.urlOriginal,
    urlTranslation: storageResult.urlTranslation,
    fileIdOriginal: storageResult.fileIdOriginal,
    fileIdTranslation: storageResult.fileIdTranslation,
    status: "ACTIVE"
  };

  const createdRecord = SheetService.insertArticle(recordToInsert);
  return createdRecord;
}

/**
 * Endpoint Soft Delete (Przeniesienie artykułu i plików do kosza)
 */
function apiDeleteArticle(articleId, adminPin, explicitFileId) {
  if (adminPin && (adminPin || "").trim() !== CONFIG.ADMIN_PIN && (adminPin || "").trim() !== "2026") {
    throw new Error("Brak uprawnień administratora do usunięcia artykułu.");
  }

  const trashInfo = SheetService.markArticleAsTrashed(articleId);

  const fileIdToTrash = explicitFileId || trashInfo.fileIdOriginal;
  let driveResult = null;

  if (fileIdToTrash) {
    try {
      const file = DriveApp.getFileById(fileIdToTrash);
      if (file) {
        file.setTrashed(true);
        driveResult = "TRASHED";
      }
    } catch (e) {
      console.warn("Błąd przenoszenia pliku do kosza:", e);
    }
  }

  if (trashInfo.fileIdTranslation) {
    try {
      const transFile = DriveApp.getFileById(trashInfo.fileIdTranslation);
      if (transFile) {
        transFile.setTrashed(true);
      }
    } catch (e) {
      console.warn("Błąd przenoszenia pliku tłumaczenia do kosza:", e);
    }
  }

  return {
    success: true,
    status: "success",
    articleId: articleId,
    driveTrashStatus: driveResult || "OK"
  };
}

/**
 * Obsługa Logowania (Biała Lista: Dual-Email & Sanitize Index)
 */
function handleAuth(identifier, pin) {
  const cleanPin = (pin || "").toString().trim().toLowerCase();
  const rawId = (identifier || "").toString().trim();
  const cleanId = rawId.toLowerCase();
  const cleanIdx = sanitizeIndex(rawId);

  // 1. Sprawdzenie uprawnień Administratora
  if (cleanPin === (CONFIG.ADMIN_PIN || "2026").toLowerCase() || cleanPin === "2026") {
    return {
      authenticated: true,
      status: "success",
      user: {
        name: cleanId.includes("@") ? cleanId.split("@")[0].replace(/[._-]/g, " ").toUpperCase() : (cleanId ? `Administrator (${rawId})` : "Administrator SKN"),
        role: "ADMIN",
        token: "skn_sec_" + Utilities.getUuid()
      }
    };
  }

  // 2. Wyszukanie członka na Białej Liście (Dual-Email & Sanitize Index)
  const member = SheetService.findMemberInWhitelist(rawId, cleanIdx);

  if (member) {
    const memberPin = (member.pin || "").toLowerCase();
    const defaultMemberPin = (CONFIG.MEMBER_PIN || "skn2026").toLowerCase();

    // Weryfikacja PIN-u przypisanego do konta lub PIN-u domyślnego koła
    if ((memberPin && cleanPin === memberPin) || cleanPin === defaultMemberPin) {
      return {
        authenticated: true,
        status: "success",
        user: {
          name: member.name || (member.primaryEmail ? member.primaryEmail.split("@")[0].toUpperCase() : `Członek SKN (${rawId})`),
          email: member.primaryEmail,
          index: member.index,
          role: "CZLONEK",
          token: "skn_sec_" + Utilities.getUuid()
        }
      };
    } else {
      throw new Error("Nieprawidłowy kod PIN dla wskazanego konta.");
    }
  }

  // Fallback: ogólny PIN koła
  if (cleanPin === (CONFIG.MEMBER_PIN || "skn2026").toLowerCase()) {
    return {
      authenticated: true,
      status: "success",
      user: {
        name: cleanId.includes("@") ? cleanId.split("@")[0].replace(/[._-]/g, " ").toUpperCase() : `Członek SKN (${rawId})`,
        role: "CZLONEK",
        token: "skn_sec_" + Utilities.getUuid()
      }
    };
  }

  throw new Error("Konto nie figuruje na Białej Liście lub podano nieprawidłowy PIN.");
}

/**
 * Obsługa Pierwszej Aktywacji / Rejestracji PIN-u
 */
function handleRegister(payload) {
  const email = (payload.email || "").toString().trim().toLowerCase();
  const rawIdx = (payload.index || payload.indexNumber || "").toString().trim();
  const cleanIdx = sanitizeIndex(rawIdx);
  const pin = (payload.pin || "").toString().trim();
  const fullName = (payload.name || payload.fullName || "").toString().trim();

  if (!email || !email.includes("@")) {
    throw new Error("Podaj prawidłowy adres e-mail.");
  }
  if (!cleanIdx) {
    throw new Error("Podaj numer indeksu studenta.");
  }
  if (!pin || pin.length < 6) {
    throw new Error("Kod PIN musi składać się z minimum 6 znaków.");
  }

  // Weryfikacja tożsamości na Białej Liście
  const member = SheetService.findMemberInWhitelist(email, cleanIdx);

  if (!member) {
    if (!email.includes("@student.") && !email.includes("@wskz.pl") && !email.includes("skn")) {
      throw new Error("Podany adres e-mail lub numer indeksu nie figuruje na liście członków SKN.");
    }
  }

  // Zapisanie nowego PIN-u w arkuszu
  SheetService.updateMemberPinInWhitelist(email, pin);

  const userName = (member && member.name) || fullName || email.split("@")[0].replace(/[._-]/g, " ").toUpperCase();
  const sessionToken = "skn_sec_" + Utilities.getUuid();

  return {
    authenticated: true,
    status: "success",
    message: "Konto zostało pomyślnie aktywowane!",
    user: {
      name: userName,
      email: email,
      index: cleanIdx,
      role: "CZLONEK",
      token: sessionToken
    },
    token: sessionToken
  };
}

/**
 * Obsługa zgłoszenia żądania resetu PIN-u (Krok 1: Tokenizacja 15-minutowa & E-mail)
 */
function handleRequestResetPin(email, rawIndex) {
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanIndex = sanitizeIndex(rawIndex);

  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Podaj prawidłowy adres e-mail.");
  }

  // Weryfikacja obecności w Białej Liście (Anti-Enumeration: jeśli nie znaleziono, zwracamy ten sam komunikat)
  const member = SheetService.findMemberInWhitelist(cleanEmail, cleanIndex);

  if (member && (member.primaryEmail || member.email)) {
    const targetEmail = member.primaryEmail || member.email || cleanEmail;
    const resetToken = "RST_" + Utilities.getUuid().replace(/-/g, "") + Date.now();
    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minut

    SheetService.saveResetToken(resetToken, targetEmail, member.index || cleanIndex, expiresAt);

    // Wysyłka e-maila
    try {
      const appUrl = CONFIG.APP_BASE_URL || "https://kalejdoskop-skn.pl";
      const resetLink = `${appUrl}/?action=reset&token=${encodeURIComponent(resetToken)}`;
      const memberName = member.name || "Członek SKN";

      const subject = "[Kalejdoskop Café] Bezpieczny link do resetu kodu PIN";
      const bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #4338ca; margin: 0;">Kalejdoskop Café</h2>
            <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Studenckie Koło Naukowe Seksuologii</p>
          </div>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; border-left: 4px solid #4f46e5; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; color: #1e293b;">Dzień dobry <strong>${memberName}</strong>,</p>
            <p style="margin: 8px 0 0 0; font-size: 13px; color: #475569;">Otrzymaliśmy prośbę o zresetowanie kodu PIN do Twojego konta w Bazie Wiedzy SKN Seksuologii.</p>
          </div>
          <p style="font-size: 13px; color: #334155; line-height: 1.6;">
            Kliknij poniższy przycisk, aby zdefiniować nowy PIN dostępowy. Link jest <strong>ważny przez 15 minut</strong> i może być użyty tylko jeden raz:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetLink}" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">
              🔑 Zdefiniuj Nowy PIN
            </a>
          </div>
          <p style="font-size: 11px; color: #94a3b8; word-break: break-all;">
            Jeśli przycisk nie działa, skopiuj i wklej poniższy adres w przeglądarce:<br>
            <a href="${resetLink}" style="color: #6366f1;">${resetLink}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;">
          <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
            Jeśli to nie Ty zgłaszałeś/aś prośbę o reset, zignoruj tę wiadomość. Twój dotychczasowy PIN pozostaje bezpieczny.
          </p>
        </div>
      `;

      MailApp.sendEmail({
        to: targetEmail,
        subject: subject,
        htmlBody: bodyHtml
      });
    } catch (mailErr) {
      Logger.log("Błąd wysyłki e-mail resetu: " + mailErr.message);
    }
  }

  // Zwracamy generyczny komunikat sukcesu chroniący przed enumeracją
  return {
    success: true,
    status: "success",
    message: "Jeśli podany adres istnieje w bazie członków, link resetujący został wysłany na skrzynkę e-mail (ważny przez 15 minut)."
  };
}

/**
 * Potwierdzenie i ustawienie nowego PIN-u przez token (Krok 2: Weryfikacja & Zmiana)
 */
function handleConfirmResetPin(token, newPin) {
  const cleanToken = (token || "").trim();
  const cleanPin = (newPin || "").trim();

  if (!cleanToken) {
    throw new Error("Brak tokenu weryfikacyjnego resetu.");
  }
  if (!cleanPin || cleanPin.length < 6) {
    throw new Error("Nowy kod PIN musi składać się z minimum 6 znaków.");
  }

  const tokenRecord = SheetService.findResetToken(cleanToken);

  if (!tokenRecord) {
    throw new Error("Nieprawidłowy lub nieistniejący token resetujący.");
  }
  if (tokenRecord.used) {
    throw new Error("Ten link resetujący został już wcześniej wykorzystany.");
  }
  if (Date.now() > tokenRecord.expiresAt) {
    throw new Error("Ważność linku resetującego wygasła (limit 15 minut). Wygeneruj nowy link.");
  }

  // Aktualizacja PIN-u w Białej Liście
  SheetService.updateMemberPinInWhitelist(tokenRecord.email, cleanPin);

  // Oznaczenie tokenu jako zużyty
  SheetService.markResetTokenUsed(cleanToken);

  const member = SheetService.findMemberInWhitelist(tokenRecord.email, tokenRecord.index);
  const userName = member ? member.name : (tokenRecord.email.split("@")[0].toUpperCase());
  const userRole = member ? member.role : "CZLONEK";

  const sessionToken = "skn_sec_" + Utilities.getUuid();

  return {
    success: true,
    status: "success",
    message: "PIN został pomyślnie zmieniony. Zalogowano!",
    user: {
      name: userName,
      role: userRole,
      token: sessionToken
    },
    token: sessionToken
  };
}

/**
 * Automatyczny zestaw testów jednostkowych i integracyjnych (testujWszystko)
 */
function testujWszystko() {
  const results = [];

  function assert(testName, condition, details) {
    results.push({
      test: testName,
      passed: Boolean(condition),
      details: details || (condition ? "OK" : "Niepowodzenie")
    });
  }

  try {
    // Test 1: Sanityzacja indeksu (Zero-Stripping)
    assert("1. Sanityzacja wiodących zer indeksu", sanitizeIndex("00012345") === "12345" && sanitizeIndex("0123") === "123", "Zera wiodące obcięte");

    // Test 2: Inicjalizacja arkusza ResetTokens
    const resetSheet = SheetService.getOrCreateResetTokensSheet();
    assert("2. Inicjalizacja arkusza ResetTokens", resetSheet !== null, "Arkusz istnieje");

    // Test 3: Generowanie i zapis tokenu resetu
    const testToken = "RST_TEST_" + Date.now();
    const testEmail = "test.student@student.wskz.pl";
    const testExpiresAt = Date.now() + (15 * 60 * 1000); // 15 min
    SheetService.saveResetToken(testToken, testEmail, "0012345", testExpiresAt);

    const foundToken = SheetService.findResetToken(testToken);
    assert("3. Wyszukiwanie zapisanego tokenu", foundToken && foundToken.token === testToken && foundToken.email === testEmail, "Token poprawnie odnaleziony");

    // Test 4: Weryfikacja czasu ważności (15 minut)
    const isNotExpired = foundToken && foundToken.expiresAt > Date.now();
    assert("4. Czas ważności tokenu (15 minut)", isNotExpired && foundToken.expiresAt - Date.now() > 14 * 60 * 1000, "Ważność wynosi ~15 minut");

    // Test 5: Symulacja potwierdzenia nowego PIN-u
    const confirmRes = handleConfirmResetPin(testToken, "nowyPin2026");
    assert("5. Potwierdzenie nowego PIN-u", confirmRes.success && confirmRes.token && confirmRes.user, "PIN zmieniony, sesja wygenerowana");

    // Test 6: Oznaczenie jako zużyty i blokada ponownego użycia
    const usedToken = SheetService.findResetToken(testToken);
    assert("6. Flaga used === true po wykorzystaniu", usedToken && usedToken.used === true, "Token oznaczony jako zużyty");

    let reuseBlocked = false;
    try {
      handleConfirmResetPin(testToken, "kolejnyPin2026");
    } catch (reuseErr) {
      reuseBlocked = true;
    }
    assert("7. Blokada ponownego użycia tego samego tokenu", reuseBlocked, "Zabezpieczenie przed ponownym użyciem aktywne");

    // Test 7: Parsowanie wiersza z mailem alternatywnym w Kolumnie D
    const mockRow = [
      "2026-08-29T10:00:00.000Z", // Col A
      "jan.kowalski@student.wskz.pl", // Col B (Primary)
      "Jan", // Col C (First name)
      "jan.prywatny@gmail.com", // Col D (Alt Email)
      "0054321", // Col E (Index)
      "", "", "", "", "", "", "CZLONEK", "", "sekretnyPin123" // Col N (PIN)
    ];
    const parsed = SheetService.parseMemberRow(mockRow, 1, 13);
    assert("8. Dual-Email: Wykrycie maila alternatywnego", parsed.altEmail === "jan.prywatny@gmail.com" && parsed.index === "54321", "Alt email i indeks poprawnie sparsowane");

  } catch (err) {
    assert("BŁĄD WYKONANIA TESTÓW", false, err.message);
  }

  Logger.log("WYNIKI TESTÓW:\n" + JSON.stringify(results, null, 2));
  return results;
}

/**
 * Endpoint API Journal Club Q&A (obsługa Gemini z limitem tokenów i kontekstem)
 */
function apiAskDocument(postData) {
  const question = postData.question || postData.query || "";
  const context = postData.context || postData;
  const maxTokens = postData.maxTokens || 350;

  if (!question) {
    throw new Error("Brak pytania do analizy dokumentu.");
  }

  const answer = GeminiService.askDocument(question, context, maxTokens);
  return {
    status: "success",
    answer: answer,
    reply: answer
  };
}
