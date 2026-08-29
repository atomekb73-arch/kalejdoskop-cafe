# Kalejdoskop Café (Wersja 2.0 – Jasny Motyw Naukowy)
### Wirtualna Baza Wiedzy & Potok AI dla Studenckiego Koła Naukowego Seksuologii

---

## 🏛️ Architektura i Główne Moduły

1. **Frontend SPA (Jasny Motyw Naukowy & Comfortaa):**
   - Czysty, akademicki interfejs w jasnej tonacji (`bg-slate-50`, `bg-white`, subtelne ramki i cienie).
   - Globalna typografia oparta na Google Font **Comfortaa**.
   - Wyszukiwarka na żywo (Live Search) przeszukująca tytuły PL/EN, autorów, rok, słowa kluczowe oraz treść abstraktów.
   - Pigułki filtracji kategorii tematycznych z dynamicznymi licznikami.
   - Trzypoziomowy system ról:
     - **PUBLIC** (Widok Publiczny dla wszystkich),
     - **MEMBERS** (Członkowie SKN – PIN `skn2026`),
     - **ADMIN** (Administratorzy – PIN `2026`, odblokowuje przycisk „Dodaj dokument” i usuwanie do Kosza).

2. **Piaskownica Dysku (Directory Sandboxing):**
   - Dedykowany folder główny: `1Wc6F-rYstNtmOkBpRdgtEPTIIrT4ghl5`.
   - Wszystkie operacje dyskowe ograniczone są wyłącznie do wnętrza tego katalogu i jego podfolderów.

3. **Rekurencyjna Weryfikacja Duplikatów & Katalogowanie YYYY_MM:**
   - Rekurencyjne sprawdzanie obecności pliku przed uploadem w całym drzewie katalogów.
   - Automatyczne tworzenie i grupowanie plików w podfolderach daty `YYYY_MM` (np. `2026_08`).
   - Standaryzowane nazewnictwo:
     - Oryginał: `YYYY_MM_DD_[Nazwa_Pliku].pdf`
     - Tłumaczenie PL: `YYYY_MM_DD_[Nazwa_Pliku]_PL.pdf`

4. **Potok Wielomodalny Gemini 1.5 Flash (DSM-5-TR / ICD-11):**
   - Analiza merytoryczna i tłumaczenie akademickie z zachowaniem ścisłej nomenklatury klinicznej.
   - Kompilacja polskiego pliku PDF ze stopką i nagłówkiem instytucjonalnym SKN Seksuologii.

5. **Soft Delete (Kosz Google Drive):**
   - Przenoszenie obu plików PDF do Kosza Google Drive (`file.setTrashed(true)`).
   - Oznaczenie wpisu w Arkuszu Google jako `TRASHED` i natychmiastowe usunięcie z wyników wyszukiwania.

---

## 🚀 Instrukcja Uruchomienia Lokalnego

```bash
# Uruchomienie serwera podglądu lokalnego
npm start
# lub: node server.js
```
Aplikacja jest dostępna pod adresem: **http://localhost:3000**

---

## ☁️ Instrukcja Wdrożenia w Google Apps Script

1. Otwórz nowy projekt na [script.google.com](https://script.google.com).
2. Skopiuj pliki backendu (`Code.gs`, `Config.gs`, `DriveService.gs`, `GeminiService.gs`, `DocPdfService.gs`, `SheetService.gs`, `appsscript.json`).
3. W ustawieniach projektu (**Project Settings -> Script Properties**) dodaj:
   - `GEMINI_API_KEY`: Twój klucz API do Google Gemini.
4. Kliknij **Wdróż (Deploy) -> Nowe wdrożenie -> Aplikacja internetowa (Web App)**:
   - *Wykonaj jako:* **Ja (Twoje konto)**
   - *Kto ma dostęp:* **Każdy (Anyone)**.
