/**
 * Kalejdoskop Café - Integracja z Gemini API (GeminiService)
 * Automatyczna ekstrakcja prawdziwego tytułu, autorów i abstraktu z PDF przez Gemini API
 * Model: gemini-1.5-flash
 */

const GeminiService = {
  /**
   * Wysyła plik PDF do Gemini 1.5 Flash i zwraca ustrukturyzowane metadane akademickie w języku polskim
   */
  analyzeAndTranslatePdf: function(base64Pdf, originalFileName) {
    let cleanBase64 = base64Pdf;
    if (typeof cleanBase64 === "string" && cleanBase64.indexOf(",") !== -1) {
      cleanBase64 = cleanBase64.split(",")[1];
    }

    const apiKey = getGeminiApiKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL || "gemini-1.5-flash"}:generateContent?key=${apiKey}`;

    const systemPrompt = `Jesteś asystentem biblioteki naukowej SKN Seksuologii. Przeanalizuj dołączony artykuł naukowy PDF i wyodrębnij z niego metadane w formacie JSON:
{
  "originalTitle": "Prawdziwy pełny tytuł artykułu w języku oryginału",
  "polishTitle": "Profesjonalne tłumaczenie tytułu na język polski (zgodne z DSM-5-TR / ICD-11)",
  "authors": "Lista autorów (np. Debby Herbenick, Tsung-chieh Fu et al.)",
  "year": "Rok publikacji (np. 2022)",
  "category": "Dopasowana kategoria (Relacje i Bliskość / Biologia & Psychofizjologia / Tożsamość & Gender / Edukacja Seksualna / Psychometria & Metodologia)",
  "abstractPL": "Zwięzłe, rzetelne streszczenie merytoryczne abstraktu po polsku (ok. 3-5 zdań)",
  "keywords": ["słowo1", "słowo2", "słowo3"]
}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`Błąd Gemini API (${responseCode}): ${responseText}`);
    }

    try {
      const data = JSON.parse(responseText);
      const textContent = data.candidates[0].content.parts[0].text;
      const parsed = JSON.parse(textContent);

      const validCategories = [
        "Relacje i Bliskość",
        "Biologia & Psychofizjologia",
        "Tożsamość & Gender",
        "Edukacja Seksualna",
        "Psychometria & Metodologia"
      ];

      let matchedCategory = parsed.category || parsed.suggestedCategory || "Relacje i Bliskość";
      if (!validCategories.includes(matchedCategory)) {
        matchedCategory = "Relacje i Bliskość";
      }

      return {
        originalTitle: parsed.originalTitle || originalFileName,
        polishTitle: parsed.polishTitle || parsed.translatedTitle || parsed.originalTitle || originalFileName,
        translatedTitle: parsed.polishTitle || parsed.translatedTitle || parsed.originalTitle || originalFileName,
        authors: parsed.authors || "Zespół Badawczy SKN",
        year: parsed.year ? String(parsed.year) : String(new Date().getFullYear()),
        category: matchedCategory,
        suggestedCategory: matchedCategory,
        abstractPL: parsed.abstractPL || "Brak wygenerowanego abstraktu.",
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : ["seksuologia", "badania", "nauka"]
      };
    } catch (e) {
      throw new Error("Błąd parsowania odpowiedzi JSON z Gemini API: " + e.message);
    }
  },

  /**
   * Odpowiada na pytania do publikacji (Journal Club Q&A) z limitem tokenów
   */
  askDocument: function(question, context, maxTokens) {
    const apiKey = getGeminiApiKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL || "gemini-1.5-flash"}:generateContent?key=${apiKey}`;

    const title = context.titlePL || context.title || "Publikacja naukowa";
    const authors = context.authors || "Zespół badawczy";
    const year = context.year || "2026";
    const category = context.category || "Seksuologia";
    const abstract = context.abstractPL || context.abstract || "";
    const reportContext = context.reportContext || "";

    const systemPrompt = `Jesteś asystentem Journal Club SKN Seksuologii (EBM / DSM-5-TR / ICD-11).
Odpowiedz profesjonalnie, zwięźle i precyzyjnie językiem naukowym i klinicznym, wyłącznie w oparciu o poniższy kontekst publikacji. Nie zmyślaj faktów, których nie ma w tekście. Stosuj formatowanie Markdown (wypunktowania, pogrubienia).

Kontekst artykułu:
- Tytuł: ${title} (${authors}, ${year})
- Kategoria: ${category}
- Abstrakt: ${abstract}
${reportContext ? `- Raport kliniczny / Metodologia: ${reportContext}` : ""}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemPrompt + `\n\nPytanie użytkownika: ${question}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: maxTokens || 350
      }
    };

    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`Błąd Gemini API (${responseCode}): ${responseText}`);
    }

    const data = JSON.parse(responseText);
    return data.candidates[0].content.parts[0].text;
  }
};
