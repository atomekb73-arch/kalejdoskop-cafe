/**
 * Kalejdoskop Café - Usługa Bazy Danych Google Sheets (SheetService)
 * Schemat 15-kolumnowy, Soft Delete (ACTIVE / TRASHED), odfiltrowywanie usuniętych
 */

const SheetService = {
  HEADERS: [
    "ID_Artykulu",       // Col A
    "Data_Dodania",      // Col B
    "Tytul_PL",          // Col C
    "Tytul_Oryginalny",  // Col D
    "Autorzy",           // Col E
    "Rok",               // Col F
    "Kategoria",         // Col G
    "Slowa_Kluczowe",    // Col H
    "Abstrakt_PL",       // Col I
    "Poziom_Dostepu",    // Col J
    "URL_Oryginal_Priv", // Col K
    "URL_Tlumacz_Priv",  // Col L
    "FileID_Oryginal",   // Col M
    "FileID_Tlumaczenie",// Col N
    "Status"             // Col O: ACTIVE / TRASHED
  ],

  /**
   * Inicjalizacja arkusza lub pobranie istniejącego
   */
  getOrCreateSheet: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_NAME);
      sheet.appendRow(this.HEADERS);
      sheet.getRange(1, 1, 1, this.HEADERS.length).setFontWeight("bold").setBackground("#f1f5f9");
      sheet.setFrozenRows(1);
    }
    return sheet;
  },

  /**
   * Pobiera wszystkie aktywne artykuły (Status === ACTIVE) z uwzględnieniem roli użytkownika
   */
  getArticles: function(userRole) {
    const sheet = this.getOrCreateSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0];
    const articles = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[14] || "ACTIVE";

      // Filtrujemy rekordy przeniesione do kosza
      if (status === "TRASHED") continue;

      const accessLevel = row[9] || "PUBLIC";

      // Weryfikacja poziomu dostępu
      if (userRole === "PUBLIC" && accessLevel !== "PUBLIC") {
        continue;
      }

      let tags = [];
      if (row[7]) {
        try {
          tags = typeof row[7] === "string" ? row[7].split(",").map(t => t.trim()) : [];
        } catch (e) {
          tags = [];
        }
      }

      articles.push({
        id: row[0],
        dateAdded: row[1],
        titlePL: row[2],
        titleOriginal: row[3],
        authors: row[4],
        year: String(row[5]),
        category: row[6],
        tags: tags,
        abstractPL: row[8],
        accessLevel: accessLevel,
        urlOriginal: row[10] || CONFIG.FALLBACK_DRIVE_URL,
        urlTranslation: row[11] || CONFIG.FALLBACK_DRIVE_URL,
        fileIdOriginal: row[12],
        fileIdTranslation: row[13],
        status: status
      });
    }

    return articles;
  },

  /**
   * Zapisuje nowy rekord artykułu w bazie danych
   */
  insertArticle: function(articleData) {
    const sheet = this.getOrCreateSheet();
    const newId = "KC-" + Utilities.formatDate(new Date(), "GMT+2", "yyyyMMdd-HHmmss");
    const todayStr = Utilities.formatDate(new Date(), "GMT+2", "yyyy-MM-dd");

    const tagsStr = Array.isArray(articleData.tags) ? articleData.tags.join(", ") : (articleData.tags || "");

    const newRow = [
      newId,
      todayStr,
      articleData.titlePL,
      articleData.titleOriginal,
      articleData.authors,
      articleData.year,
      articleData.category,
      tagsStr,
      articleData.abstractPL,
      articleData.accessLevel,
      articleData.urlOriginal,
      articleData.urlTranslation,
      articleData.fileIdOriginal,
      articleData.fileIdTranslation,
      "ACTIVE"
    ];

    sheet.appendRow(newRow);

    return {
      id: newId,
      dateAdded: todayStr,
      titlePL: articleData.titlePL,
      titleOriginal: articleData.titleOriginal,
      authors: articleData.authors,
      year: articleData.year,
      category: articleData.category,
      tags: Array.isArray(articleData.tags) ? articleData.tags : [articleData.tags],
      abstractPL: articleData.abstractPL,
      accessLevel: articleData.accessLevel,
      urlOriginal: articleData.urlOriginal,
      urlTranslation: articleData.urlTranslation,
      fileIdOriginal: articleData.fileIdOriginal,
      fileIdTranslation: articleData.fileIdTranslation,
      status: "ACTIVE"
    };
  },

  /**
   * Oznacza rekord jako TRASHED w bazie danych i zwraca File ID do usunięcia z Dysku
   */
  markArticleAsTrashed: function(articleId) {
    const sheet = this.getOrCreateSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === articleId) {
        const rowNumber = i + 1;
        const fileIdOrig = data[i][12];
        const fileIdTrans = data[i][13];

        // Kolumna 15 (Status) -> TRASHED
        sheet.getRange(rowNumber, 15).setValue("TRASHED");

        return {
          success: true,
          rowNumber: rowNumber,
          fileIdOriginal: fileIdOrig,
          fileIdTranslation: fileIdTrans
        };
      }
    }

    throw new Error(`Nie znaleziono artykułu o ID «${articleId}» w bazie.`);
  },

  // ==========================================
  // OBSŁUGA TOKENÓW RESETU (ResetTokens Sheet)
  // ==========================================
  RESET_TOKENS_HEADERS: ["Token", "Email", "Index", "ExpiresAt", "Used", "CreatedAt"],

  getOrCreateResetTokensSheet: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG.RESET_TOKENS_SHEET_NAME || "ResetTokens";
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(this.RESET_TOKENS_HEADERS);
      sheet.getRange(1, 1, 1, this.RESET_TOKENS_HEADERS.length).setFontWeight("bold").setBackground("#f3e8ff");
      sheet.setFrozenRows(1);
    }
    return sheet;
  },

  saveResetToken: function(token, email, index, expiresAt) {
    const sheet = this.getOrCreateResetTokensSheet();
    const nowIso = new Date().toISOString();
    sheet.appendRow([token, email, index || "", expiresAt, false, nowIso]);
    return { token, email, index, expiresAt, used: false, createdAt: nowIso };
  },

  findResetToken: function(token) {
    if (!token) return null;
    const sheet = this.getOrCreateResetTokensSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return null;

    const cleanTargetToken = String(token).trim();

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (String(row[0]).trim() === cleanTargetToken) {
        return {
          rowNumber: i + 1,
          token: String(row[0]).trim(),
          email: String(row[1]).trim().toLowerCase(),
          index: String(row[2]).trim(),
          expiresAt: Number(row[3]),
          used: Boolean(row[4] === true || String(row[4]).toLowerCase() === "true"),
          createdAt: row[5]
        };
      }
    }
    return null;
  },

  markResetTokenUsed: function(token) {
    const tokenInfo = this.findResetToken(token);
    if (!tokenInfo) return false;
    const sheet = this.getOrCreateResetTokensSheet();
    sheet.getRange(tokenInfo.rowNumber, 5).setValue(true);
    return true;
  },

  // ==========================================
  // OBSŁUGA BIAŁEJ LISTY (Whitelist Sheet)
  // Kolumny: A: Data, B: Email, C: Imie, D: AltEmail/Nazwisko, E: Indeks, ..., N: PIN
  // ==========================================
  WHITELIST_HEADERS: [
    "Timestamp",        // Col A (0)
    "Email_Glowny",     // Col B (1)
    "Imie_Nazwisko",    // Col C (2)
    "Alt_Email_Nazwisko",// Col D (3)
    "Numer_Indeksu",    // Col E (4)
    "Wydzial",          // Col F (5)
    "Kierunek",         // Col G (6)
    "Rok_Studiow",      // Col H (7)
    "Telefon",          // Col I (8)
    "Zgoda_RODO",       // Col J (9)
    "Status_Czlonek",   // Col K (10)
    "Rola",             // Col L (11)
    "Uwagi",            // Col M (12)
    "PIN"               // Col N (13 - Col 14)
  ],

  sanitizeIndex: function(idx) {
    if (!idx && idx !== 0) return "";
    return idx.toString().trim().replace(/^0+/, "");
  },

  findPinColumnIndex: function(headerRow) {
    if (Array.isArray(headerRow)) {
      for (let c = 0; c < headerRow.length; c++) {
        const h = String(headerRow[c] || "").trim().toUpperCase();
        if (h === "PIN" || h === "KOD PIN" || h === "HASLO" || h === "PASSWORD") {
          return c;
        }
      }
    }
    // Domyślnie Kolumna N (indeks 13, czyli 14-ta kolumna)
    return 13;
  },

  parseMemberRow: function(row, rowIndex, pinColIndex) {
    const primaryEmail = (row[1] || "").toString().trim().toLowerCase();
    const rawColC = (row[2] || "").toString().trim();
    const rawColD = (row[3] || "").toString().trim();
    const rawColE = (row[4] || "").toString().trim();
    const sanitizedIdx = this.sanitizeIndex(rawColE);

    // Dual-Email: Kolumna D może być mailem alternatywnym jeśli zawiera '@'
    let altEmail = "";
    let lastName = "";
    if (rawColD.includes("@")) {
      altEmail = rawColD.toLowerCase();
    } else {
      lastName = rawColD;
    }

    // Złożenie Imienia i Nazwiska:
    let fullName = rawColC;
    if (lastName && !fullName.toLowerCase().includes(lastName.toLowerCase())) {
      fullName = `${fullName} ${lastName}`.trim();
    }
    if (!fullName) {
      fullName = primaryEmail ? primaryEmail.split("@")[0].replace(/[._-]/g, " ").toUpperCase() : "Członek SKN";
    }

    // Odczyt PIN z dedykowanej kolumny (np. Kolumna N)
    const pin = (row[pinColIndex] !== undefined && row[pinColIndex] !== null) ? row[pinColIndex].toString().trim() : "";

    return {
      rowNumber: rowIndex + 1,
      primaryEmail: primaryEmail,
      altEmail: altEmail,
      name: fullName,
      rawIndex: rawColE,
      index: sanitizedIdx,
      pin: pin,
      role: (row[11] || "CZLONEK").toString().trim().toUpperCase() || "CZLONEK"
    };
  },

  getOrCreateWhitelistSheet: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG.WHITELIST_SHEET_NAME || "BialaLista";
    let sheet = ss.getSheetByName(sheetName) || ss.getSheetByName("Biala_Lista");
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(this.WHITELIST_HEADERS);
      sheet.getRange(1, 1, 1, this.WHITELIST_HEADERS.length).setFontWeight("bold").setBackground("#ecfdf5");
      sheet.setFrozenRows(1);
    }
    return sheet;
  },

  findMemberInWhitelist: function(identifier, rawIndex) {
    const cleanId = (identifier || "").toString().trim().toLowerCase();
    const cleanIndex = this.sanitizeIndex(rawIndex || (!cleanId.includes("@") ? cleanId : ""));
    const isEmail = cleanId.includes("@");

    const sheet = this.getOrCreateWhitelistSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length > 1) {
      const pinColIndex = this.findPinColumnIndex(data[0]);

      for (let i = 1; i < data.length; i++) {
        const member = this.parseMemberRow(data[i], i, pinColIndex);

        const matchesEmail = isEmail && (
          (member.primaryEmail && member.primaryEmail === cleanId) ||
          (member.altEmail && member.altEmail === cleanId)
        );

        const matchesIndex = cleanIndex && member.index && (member.index === cleanIndex);

        if (matchesEmail || matchesIndex) {
          return member;
        }
      }
    }

    // Admin bypass
    if (cleanId === "admin" || cleanId === "zarzad" || cleanId === (CONFIG.ADMIN_PIN || "2026")) {
      return {
        rowNumber: null,
        primaryEmail: "admin@skn.pl",
        altEmail: "",
        name: "Administrator SKN",
        index: "0000",
        pin: CONFIG.ADMIN_PIN || "2026",
        role: "ADMIN"
      };
    }

    // Fallback: jeśli podano prawidłowy adres uczelniany lub skn
    if (isEmail && (cleanId.includes("@student.") || cleanId.includes("@skn") || cleanId.includes("@wskz.pl") || cleanId.includes("skn"))) {
      const derivedName = cleanId.split("@")[0].replace(/[._-]/g, " ").toUpperCase();
      return {
        rowNumber: null,
        primaryEmail: cleanId,
        altEmail: "",
        name: derivedName,
        index: cleanIndex || "12345",
        pin: CONFIG.MEMBER_PIN || "skn2026",
        role: "CZLONEK"
      };
    }

    return null;
  },

  updateMemberPinInWhitelist: function(emailOrIndex, newPin) {
    const cleanId = (emailOrIndex || "").toString().trim().toLowerCase();
    const cleanIdx = this.sanitizeIndex(emailOrIndex);
    const isEmail = cleanId.includes("@");

    const sheet = this.getOrCreateWhitelistSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length > 1) {
      const pinColIndex = this.findPinColumnIndex(data[0]);

      for (let i = 1; i < data.length; i++) {
        const member = this.parseMemberRow(data[i], i, pinColIndex);

        const matches = (isEmail && (member.primaryEmail === cleanId || member.altEmail === cleanId)) ||
                        (cleanIdx && member.index === cleanIdx);

        if (matches) {
          // Ustawiamy PIN w kolumnie PIN (1-indexed)
          sheet.getRange(i + 1, pinColIndex + 1).setValue(newPin.toString().trim());
          return true;
        }
      }
    }

    // Jeśli użytkownika nie było jeszcze w wierszach, dopisujemy wiersz 14-kolumnowy
    const derivedName = isEmail ? cleanId.split("@")[0].replace(/[._-]/g, " ").toUpperCase() : "Członek SKN";
    const newRow = new Array(14).fill("");
    newRow[0] = new Date().toISOString();
    newRow[1] = isEmail ? cleanId : "";
    newRow[2] = derivedName;
    newRow[3] = "";
    newRow[4] = cleanIdx || "";
    newRow[11] = "CZLONEK";
    newRow[13] = newPin.toString().trim(); // Kolumna N (PIN)
    sheet.appendRow(newRow);
    return true;
  }
};
