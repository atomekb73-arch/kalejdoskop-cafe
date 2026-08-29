/**
 * Kalejdoskop Café - Usługi Dysku Google (DriveService)
 * Skaner folderu piaskownicy, automatyczne nadawanie ID w nazwie, Dual Sync, Soft Delete
 */

const DriveService = {
  /**
   * Generuje unikalny identyfikator w formacie KC-YYYYMMDDHHMMSS
   */
  generateArticleId: function(offsetSeconds) {
    const now = new Date();
    if (offsetSeconds) {
      now.setSeconds(now.getSeconds() + offsetSeconds);
    }
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    return `KC-${yyyy}${mm}${dd}${hh}${min}${ss}`;
  },

  /**
   * Rekurencyjne sprawdzanie obecności pliku w drzewie folderów (Directory Sandboxing)
   */
  fileExistsRecursively: function(folder, fileName) {
    const cleanTargetName = fileName.trim().toLowerCase();

    // 1. Sprawdź pliki w bieżącym folderze
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (!file.isTrashed() && file.getName().trim().toLowerCase() === cleanTargetName) {
        return true;
      }
    }

    // 2. Przeszukaj rekurencyjnie wszystkie podfoldery
    const subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      const subfolder = subfolders.next();
      if (!subfolder.isTrashed()) {
        if (this.fileExistsRecursively(subfolder, fileName)) {
          return true;
        }
      }
    }

    return false;
  },

  /**
   * Pobiera lub tworzy podfolder chronologiczny w formacie YYYY_MM
   */
  getOrCreateDateFolder: function(parentFolder, datePrefix) {
    const subfolders = parentFolder.getFoldersByName(datePrefix);
    if (subfolders.hasNext()) {
      return subfolders.next();
    }
    return parentFolder.createFolder(datePrefix);
  },

  /**
   * Zwraca bezpośredni link podglądu pliku z fallbackiem do piaskownicy
   */
  getDirectFileViewUrl: function(file) {
    if (!file) return CONFIG.FALLBACK_DRIVE_URL;
    try {
      const fileId = file.getId();
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
      }
      return file.getUrl() || CONFIG.FALLBACK_DRIVE_URL;
    } catch (e) {
      return CONFIG.FALLBACK_DRIVE_URL;
    }
  },

  /**
   * SKANER FOLDERU PIASKOWNICY (Synchronizacja i automatyczna zmiana nazw)
   * Odpytuje folder piaskownicy, wykrywa pliki bez prefiksu KC-,
   * nadaje unikalne ID w nazwie, rejestruje w arkuszu i zwraca pełną listę plików.
   */
  scanAndSyncSandboxFolder: function() {
    const rootFolder = DriveApp.getFolderById(CONFIG.FOLDER_PRIVATE_ID);
    const results = [];
    let counter = 0;

    const self = this;

    function processFolder(folder) {
      const files = folder.getFiles();
      while (files.hasNext()) {
        const file = files.next();
        if (file.isTrashed()) continue;

        let fileName = file.getName();
        
        // Sprawdzamy czy to plik PDF
        if (fileName.toLowerCase().endsWith(".pdf")) {
          let articleId = "";
          let isNewlyRenamed = false;
          let oldName = fileName;

          // Jeśli plik NIE MA prefiksu KC- (został wrzucony ręcznie na Dysk)
          if (!fileName.startsWith("KC-")) {
            articleId = self.generateArticleId(counter++);
            const cleanOldName = fileName.replace(/\s+/g, "_");
            const newName = `${articleId}_${cleanOldName}`;

            // Zmiana nazwy pliku na Dysku Google
            file.setName(newName);
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            fileName = newName;
            isNewlyRenamed = true;
          } else {
            // Plik posiada już prefiks KC-YYYYMMDDHHMMSS
            const match = fileName.match(/^(KC-\d{14})/);
            articleId = match ? match[1] : self.generateArticleId(counter++);
          }

          const fileUrl = self.getDirectFileViewUrl(file);
          const cleanDisplayTitle = fileName.replace(/^KC-\d{14}_?/, "").replace(/\.pdf$/i, "").replace(/_/g, " ");

          // Rejestracja w Arkuszu Google dla nowych plików
          if (isNewlyRenamed) {
            const record = {
              id: articleId,
              titlePL: cleanDisplayTitle,
              titleOriginal: oldName,
              authors: "Zespół Badawczy SKN",
              year: String(new Date().getFullYear()),
              category: "Relacje i Bliskość",
              tags: ["dysk-google", "synchronizacja", "id-kc"],
              abstractPL: `Plik wykryty w folderze Dysku Google i automatycznie zsynchronizowany. Nadano identyfikator ${articleId}. Nowa nazwa na Dysku: ${fileName}.`,
              accessLevel: "PUBLIC",
              urlOriginal: fileUrl,
              urlTranslation: fileUrl,
              fileIdOriginal: file.getId(),
              fileIdTranslation: file.getId(),
              status: "ACTIVE"
            };

            SheetService.insertArticle(record);
          }

          results.push({
            id: articleId,
            name: fileName,
            fileId: file.getId(),
            url: fileUrl,
            oldName: oldName,
            newName: fileName,
            title: cleanDisplayTitle
          });
        }
      }

      // Przeszukaj rekurencyjnie podfoldery
      const subfolders = folder.getFolders();
      while (subfolders.hasNext()) {
        const sub = subfolders.next();
        if (!sub.isTrashed()) {
          processFolder(sub);
        }
      }
    }

    processFolder(rootFolder);
    return results;
  },

  /**
   * Zapis plików w podfolderze chronologicznym z prefiksem ID
   */
  savePdfFilesToDualStorage: function(originalBlob, translatedBlob, cleanFileName, existingId) {
    const articleId = existingId || this.generateArticleId();

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const dateFolderStr = `${year}_${month}`;

    const cleanBaseName = cleanFileName.replace(/\.pdf$/i, "").replace(/\s+/g, "_");
    const standardOrigName = `${articleId}_${cleanBaseName}.pdf`;
    const standardTransName = `${articleId}_${cleanBaseName}_PL.pdf`;

    const privateRoot = DriveApp.getFolderById(CONFIG.FOLDER_PRIVATE_ID);

    if (this.fileExistsRecursively(privateRoot, standardOrigName)) {
      throw new Error(`Plik o nazwie «${standardOrigName}» już istnieje w folderze lub jego podfolderach!`);
    }

    const privateDateFolder = this.getOrCreateDateFolder(privateRoot, dateFolderStr);
    
    const origBlobCopy1 = originalBlob.setName(standardOrigName);
    const fileOrigPriv = privateDateFolder.createFile(origBlobCopy1);
    fileOrigPriv.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    let fileTransPriv = null;
    if (translatedBlob) {
      const transBlobCopy1 = translatedBlob.setName(standardTransName);
      fileTransPriv = privateDateFolder.createFile(transBlobCopy1);
      fileTransPriv.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    return {
      articleId: articleId,
      fileIdOriginal: fileOrigPriv.getId(),
      fileIdTranslation: fileTransPriv ? fileTransPriv.getId() : fileOrigPriv.getId(),
      urlOriginal: this.getDirectFileViewUrl(fileOrigPriv),
      urlTranslation: fileTransPriv ? this.getDirectFileViewUrl(fileTransPriv) : this.getDirectFileViewUrl(fileOrigPriv),
      standardOrigName: standardOrigName,
      standardTransName: standardTransName,
      dateFolder: dateFolderStr
    };
  },

  /**
   * Procedura Soft Delete (Przeniesienie do Kosza Google Drive)
   */
  trashArticleFiles: function(fileIdOrig, fileIdTrans) {
    let trashedOrig = false;
    let trashedTrans = false;

    if (fileIdOrig) {
      try {
        const fileOrig = DriveApp.getFileById(fileIdOrig);
        fileOrig.setTrashed(true);
        trashedOrig = true;
      } catch (e) {
        Logger.log("Nie można przenieść oryginału do kosza: " + e.message);
      }
    }

    if (fileIdTrans) {
      try {
        const fileTrans = DriveApp.getFileById(fileIdTrans);
        fileTrans.setTrashed(true);
        trashedTrans = true;
      } catch (e) {
        Logger.log("Nie można przenieść tłumaczenia do kosza: " + e.message);
      }
    }

    return { trashedOrig: trashedOrig, trashedTrans: trashedTrans };
  }
};
