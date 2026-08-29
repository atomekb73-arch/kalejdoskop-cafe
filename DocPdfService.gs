/**
 * Kalejdoskop Café - Usługa Generowania Dokumentów PDF (DocPdfService)
 * Kompilacja standaryzowanego pliku PDF z tłumaczeniem akademickim
 */

const DocPdfService = {
  /**
   * Tworzy Dokument Google ze sformatowaną treścią tłumaczenia i konwertuje go do PDF
   */
  createTranslatedPdfBlob: function(analysisResult, originalFileName) {
    const docName = `Temp_Doc_${new Date().getTime()}`;
    const doc = DocumentApp.create(docName);
    const body = doc.getBody();

    // 1. Ustawienia marginesów
    body.setMarginTop(54);
    body.setMarginBottom(54);
    body.setMarginLeft(54);
    body.setMarginRight(54);

    // 2. Nagłówek instytucjonalny SKN Seksuologii
    const header = doc.addHeader();
    const headerP = header.appendParagraph("KALEJDOSKOP CAFÉ • STUDENCKIE KOŁO NAUKOWE SEKSUOLOGII");
    headerP.setFontFamily("Comfortaa").setFontSize(8).setForegroundColor("#64748b");
    headerP.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

    // 3. Tytuł polski i metadane
    const titleP = body.appendParagraph(analysisResult.translatedTitle || "Tłumaczenie Artykułu Naukowego");
    titleP.setHeading(DocumentApp.ParagraphHeading.TITLE);
    titleP.setFontFamily("Comfortaa").setFontSize(16).setBold(true).setForegroundColor("#0f172a");

    const origTitleP = body.appendParagraph(`Tytuł oryginalny: ${analysisResult.originalTitle || originalFileName}`);
    origTitleP.setFontFamily("Comfortaa").setFontSize(10).setItalic(true).setForegroundColor("#64748b");

    const metaP = body.appendParagraph(`Autorzy: ${analysisResult.authors || "Nieznani"} | Rok: ${analysisResult.year || "2026"} | Kategoria: ${analysisResult.suggestedCategory || "Ogólna"}`);
    metaP.setFontFamily("Comfortaa").setFontSize(9).setBold(false).setForegroundColor("#475569");
    metaP.setSpacingAfter(14);

    // Separator poziomy
    body.appendHorizontalRule();

    // 4. Streszczenie merytoryczne (Abstrakt PL)
    const absHeading = body.appendParagraph("STRESZCZENIE MERYTORYCZNE (ABSTRAKT PL)");
    absHeading.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    absHeading.setFontFamily("Comfortaa").setFontSize(12).setBold(true).setForegroundColor("#4f46e5");
    absHeading.setSpacingBefore(12);

    const absP = body.appendParagraph(analysisResult.abstractPL || "Brak abstraktu.");
    absP.setFontFamily("Comfortaa").setFontSize(10).setForegroundColor("#334155").setLineSpacing(1.2);
    absP.setSpacingAfter(14);

    // 5. Tłumaczenie treści / Pełne opracowanie
    const transHeading = body.appendParagraph("OPRACOWANIE I PRZEKŁAD AKADEMICKI (DSM-5-TR / ICD-11)");
    transHeading.setHeading(DocumentApp.ParagraphHeading.HEADING2);
    transHeading.setFontFamily("Comfortaa").setFontSize(12).setBold(true).setForegroundColor("#4f46e5");
    transHeading.setSpacingBefore(12);

    const contentP = body.appendParagraph(analysisResult.fullTranslation || analysisResult.abstractPL);
    contentP.setFontFamily("Comfortaa").setFontSize(10).setForegroundColor("#1e293b").setLineSpacing(1.25);

    // 6. Stopka
    const footer = doc.addFooter();
    const footerP = footer.appendParagraph("Materiał zintegrowany w ramach repozytorium wiedzy SKN Seksuologii • Opracowanie automatyczne Gemini 1.5 Flash");
    footerP.setFontFamily("Comfortaa").setFontSize(7).setForegroundColor("#94a3b8");
    footerP.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    doc.saveAndClose();

    // 7. Eksport do formatu PDF
    const docFile = DriveApp.getFileById(doc.getId());
    const pdfBlob = docFile.getAs("application/pdf");

    // Usunięcie pliku tymczasowego Google Doc
    docFile.setTrashed(true);

    return pdfBlob;
  }
};
