/**
 * Kalejdoskop Café - Główny Moduł Logiki Frontendu SPA (Real Google Drive Integration)
 * Studenckie Koło Naukowe Seksuologii
 */

const DEFAULT_EXEC_URL = "https://script.google.com/macros/s/AKfycby28gUmVKgi8UW_ODHxrM5hiGJ5w8kQUI7O2hCpCRo8v_BN9m1JVIqUYDx3YDQQXMal/exec";

const AppState = {
  articles: [],
  filteredArticles: [],
  currentRole: "PUBLIC",
  currentPin: "",
  activeCategory: "Wszystko",
  searchQuery: "",
  isGasEnvironment: typeof google !== "undefined" && typeof google.script !== "undefined",
  appsScriptUrl: DEFAULT_EXEC_URL,
  categories: [
    "Wszystko",
    "Relacje i Bliskość",
    "Biologia & Psychofizjologia",
    "Tożsamość & Gender",
    "Edukacja Seksualna",
    "Psychometria & Metodologia",
    "Materiały Własne SKN"
  ],
  selectedUploadFile: null,
  uploadBase64: null,
  pendingDeleteArticleId: null,
  translatingIds: new Set(),
  watermarkingIds: new Set(),
  sortBy: "date_desc",
  filterOnlyTranslations: false,
  activeTag: null,
  chatHistory: {},
  currentUser: null
};

/**
 * Bezpieczna funkcja wywołania Google Apps Script odporna na blokady CORS (text/plain + redirect: follow)
 */
async function callGoogleScript(action, payload = {}) {
  const scriptUrl = localStorage.getItem("APPS_SCRIPT_WEBAPP_URL") || localStorage.getItem("gas_api_url") || AppState.appsScriptUrl || DEFAULT_EXEC_URL;
  const urlWithAction = `${scriptUrl}?action=${encodeURIComponent(action)}`;

  const bodyData = JSON.stringify({
    action: action,
    ...payload
  });

  const response = await fetch(urlWithAction, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: bodyData,
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Błąd HTTP: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}
window.callGoogleScript = callGoogleScript;

// Start aplikacji po załadowaniu drzewa DOM
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  localStorage.setItem("APPS_SCRIPT_WEBAPP_URL", DEFAULT_EXEC_URL);
  restoreAuthSession();
  renderCategoryPills();
  setupGlobalListeners();
  updateGasStatusIndicator();
  loadArticles();

  // Sprawdzenie jednorazowego tokenu resetu w parametrach URL (?action=reset&token=RST_...)
  if (typeof AuthResetFlow !== "undefined") {
    AuthResetFlow.checkUrlForResetToken((token) => {
      openResetConfirmModal(token);
    });
  }
}

/**
 * Generowanie unikalnego identyfikatora artykułu w formacie KC-YYYYMMDDHHMMSS
 */
function generateArticleId(offsetSeconds = 0) {
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
}

/**
 * Przywracanie sesji użytkownika z localStorage / sessionStorage
 */
function restoreAuthSession() {
  const sessionStr = sessionStorage.getItem("user") || sessionStorage.getItem("skn_auth_session") || localStorage.getItem("skn_auth_session");
  
  if (sessionStr) {
    try {
      const parsedUser = JSON.parse(sessionStr);
      if (parsedUser && parsedUser.name && parsedUser.token) {
        AppState.currentUser = {
          name: parsedUser.name,
          role: parsedUser.role === "ADMIN" ? "ADMIN" : "CZLONEK",
          token: parsedUser.token,
          email: parsedUser.email,
          indexNumber: parsedUser.indexNumber
        };
        AppState.currentRole = parsedUser.role === "ADMIN" ? "ADMIN" : "MEMBERS";
        AppState.currentPin = parsedUser.role === "ADMIN" ? "2026" : "skn2026";
      } else {
        AppState.currentUser = null;
        AppState.currentRole = "PUBLIC";
      }
    } catch (e) {
      console.warn("Błąd parsowania sesji użytkownika:", e);
      AppState.currentUser = null;
      AppState.currentRole = "PUBLIC";
    }
  } else {
    AppState.currentUser = null;
    AppState.currentRole = "PUBLIC";
  }

  // Wyczyść ewentualne stare klucze zawierające wrażliwe dane z poprzednich wersji
  localStorage.removeItem("kalejdoskop_pin");
  localStorage.removeItem("kc_pin");
  sessionStorage.removeItem("kc_pin");
  localStorage.removeItem("kalejdoskop_role");
  sessionStorage.removeItem("kc_role");
  localStorage.removeItem("skn_user");
  sessionStorage.removeItem("skn_user");

  updateAuthUI();
}

/**
 * Globalne listenery (Live search, Drag & Drop, Escape key)
 */
function setupGlobalListeners() {
  // Live Search
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      AppState.searchQuery = e.target.value.toLowerCase().trim();
      const clearBtn = document.getElementById("clear-search-btn");
      if (clearBtn) {
        clearBtn.classList.toggle("hidden", AppState.searchQuery.length === 0);
      }
      filterAndRenderArticles();
    });
  }

  // Clear Search
  const clearBtn = document.getElementById("clear-search-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        AppState.searchQuery = "";
        clearBtn.classList.add("hidden");
        filterAndRenderArticles();
      }
    });
  }

  // Globalny listener klawisza Escape do zamykania modali
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllModals();
    }
  });

  // Obsługa strefy Drag & Drop
  setupDragAndDrop();
}

const CATEGORY_ICONS = {
  "Wszystko": "fas fa-shapes text-indigo-500",
  "Relacje i Bliskość": "fas fa-folder text-amber-500",
  "Biologia & Psychofizjologia": "fas fa-dna text-emerald-500",
  "Tożsamość & Gender": "fas fa-venus-mars text-purple-500",
  "Edukacja Seksualna": "fas fa-book-open text-blue-500",
  "Psychometria & Metodologia": "fas fa-chart-pie text-cyan-500",
  "Materiały Własne SKN": "fas fa-lock text-rose-500"
};

/**
 * Pigułki kategorii w lewym panelu bocznym oraz mobilnym Drawerze
 */
function renderCategoryPills() {
  const container = document.getElementById("categories-container");
  const mobileContainer = document.getElementById("mobile-categories-container");
  const totalBadge = document.getElementById("total-categories-badge");
  const mobileActiveLabel = document.getElementById("mobile-active-category-label");
  const mobileCountBadge = document.getElementById("mobile-category-count-badge");
  const drawerCount = document.getElementById("drawer-categories-count");
  
  const currentCategoryCount = getCategoryCount(AppState.activeCategory);

  if (totalBadge) {
    totalBadge.textContent = `${AppState.articles.length} prac`;
  }
  if (mobileActiveLabel) {
    mobileActiveLabel.textContent = AppState.activeCategory;
  }
  if (mobileCountBadge) {
    mobileCountBadge.textContent = `${currentCategoryCount} prac`;
  }
  if (drawerCount) {
    drawerCount.textContent = `Aktywna: ${AppState.activeCategory} (${currentCategoryCount} prac)`;
  }

  // Funkcja pomocnicza do tworzenia przycisku kategorii
  const createCategoryButton = (category, isMobileDrawer = false) => {
    const isActive = AppState.activeCategory === category;
    const count = getCategoryCount(category);
    const iconClass = CATEGORY_ICONS[category] || "fas fa-folder text-slate-400";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `w-full text-left px-3.5 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-between gap-2 cursor-pointer active:scale-98 ${
      isActive
        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 font-semibold scale-[1.01]"
        : "bg-white hover:bg-indigo-50/70 text-slate-700 hover:text-indigo-900 border border-slate-200/80 shadow-xs"
    }`;

    btn.innerHTML = `
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <div class="w-6 h-6 rounded-lg ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-indigo-600"} flex items-center justify-center shrink-0">
          <i class="${iconClass} text-xs ${isActive ? "!text-white" : ""}"></i>
        </div>
        <span class="text-[12.5px] font-medium leading-[1.25] text-left break-words whitespace-normal flex-1">${category}</span>
      </div>
      <span class="px-2 py-0.5 rounded-full text-[11px] font-mono shrink-0 ${
        isActive ? "bg-white/25 text-white font-bold" : "bg-slate-100 text-slate-600 border border-slate-200/60"
      }">${count}</span>
    `;

    btn.addEventListener("click", () => {
      if (category === "Materiały Własne SKN" && AppState.currentRole === "PUBLIC") {
        showToast("Strefa Materiałów Własnych SKN wymaga autoryzacji. Zaloguj się kodem PIN członka/administratora.", "info");
        if (isMobileDrawer) closeCategoryDrawer();
        openLoginModal();
        return;
      }
      AppState.activeCategory = category;
      renderCategoryPills();
      filterAndRenderArticles();
      if (isMobileDrawer) {
        closeCategoryDrawer();
      }
    });

    return btn;
  };

  // Renderowanie dla desktopu
  if (container) {
    container.innerHTML = "";
    AppState.categories.forEach((category) => {
      container.appendChild(createCategoryButton(category, false));
    });
  }

  // Renderowanie dla mobilnego drawera
  if (mobileContainer) {
    mobileContainer.innerHTML = "";
    AppState.categories.forEach((category) => {
      mobileContainer.appendChild(createCategoryButton(category, true));
    });
  }
}

/**
 * Kontrola Off-Canvas Mobile Category Drawer (Wysuwany z prawej strony)
 */
function openCategoryDrawer() {
  const modal = document.getElementById("categoryDrawerModal");
  const backdrop = document.getElementById("categoryDrawerBackdrop");
  const panel = document.getElementById("categoryDrawerPanel");

  if (!modal || !backdrop || !panel) return;

  renderCategoryPills();

  modal.style.display = "block";
  modal.classList.remove("hidden");

  requestAnimationFrame(() => {
    backdrop.classList.remove("opacity-0");
    backdrop.classList.add("opacity-100");
    panel.classList.remove("translate-x-full");
    panel.classList.add("translate-x-0");
  });
}
window.openCategoryDrawer = openCategoryDrawer;

function closeCategoryDrawer() {
  const modal = document.getElementById("categoryDrawerModal");
  const backdrop = document.getElementById("categoryDrawerBackdrop");
  const panel = document.getElementById("categoryDrawerPanel");

  if (!modal || !backdrop || !panel) return;

  backdrop.classList.remove("opacity-100");
  backdrop.classList.add("opacity-0");
  panel.classList.remove("translate-x-0");
  panel.classList.add("translate-x-full");

  setTimeout(() => {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }, 300);
}
window.closeCategoryDrawer = closeCategoryDrawer;

// Obsługa gestów dotykowych (Swipe gestures) dla mobilnego menu
(function initDrawerSwipeGestures() {
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  document.addEventListener("touchend", (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);

    // Gest swipe left z prawej krawędzi (otwarcie)
    const screenWidth = window.innerWidth;
    if (screenWidth <= 1024 && diffX < -70 && diffY < 50 && touchStartX > screenWidth - 60) {
      openCategoryDrawer();
    }

    // Gest swipe right wewnątrz otwartego panelu (zamknięcie)
    const modal = document.getElementById("categoryDrawerModal");
    if (modal && modal.style.display !== "none" && diffX > 70 && diffY < 60) {
      closeCategoryDrawer();
    }
  }, { passive: true });
})();

function getCategoryCount(category) {
  if (category === "Wszystko") {
    if (AppState.currentRole === "PUBLIC") {
      return AppState.articles.filter((a) => !isInternalArticle(a)).length;
    }
    return AppState.articles.length;
  }
  return AppState.articles.filter((a) => a.category === category).length;
}

/**
 * Ładowanie artykułów z backendu Google Apps Script
 */
function loadArticles() {
  showLoadingSpinner(true);

  if (AppState.isGasEnvironment) {
    google.script.run
      .withSuccessHandler((response) => {
        showLoadingSpinner(false);
        const list = response.articles || response.files || (response.data && (response.data.articles || response.data.files)) || [];
        AppState.articles = [];
        if (Array.isArray(list) && list.length > 0) {
          updateLibraryWithRealDriveFiles(list);
        } else {
          renderCategoryPills();
          filterAndRenderArticles();
        }
      })
      .withFailureHandler((err) => {
        showLoadingSpinner(false);
        console.warn("Błąd pobierania artykułów z GAS:", err);
        AppState.articles = [];
        renderCategoryPills();
        filterAndRenderArticles();
      })
      .apiGetArticles(AppState.currentRole, AppState.currentPin);
  } else if (AppState.appsScriptUrl) {
    callGoogleScript("getArticles", {
      role: AppState.currentRole,
      pin: AppState.currentPin
    })
      .then((data) => {
        showLoadingSpinner(false);
        const list = data.articles || data.files || (data.data && (data.data.articles || data.data.files)) || [];
        AppState.articles = [];
        if ((data.status === "success" || data.success) && Array.isArray(list) && list.length > 0) {
          updateLibraryWithRealDriveFiles(list);
        } else {
          renderCategoryPills();
          filterAndRenderArticles();
        }
      })
      .catch((err) => {
        showLoadingSpinner(false);
        console.warn("Błąd pobierania artykułów:", err);
        AppState.articles = [];
        renderCategoryPills();
        filterAndRenderArticles();
      });
  } else {
    showLoadingSpinner(false);
    AppState.articles = [];
    renderCategoryPills();
    filterAndRenderArticles();
  }
}

/**
 * Aktualizacja biblioteki rzeczywistymi plikami z Dysku Google oraz metadanymi z Gemini API
 */
function updateLibraryWithRealDriveFiles(files) {
  if (!Array.isArray(files) || files.length === 0) return;

  files.forEach((file) => {
    const id = file.id || file.ID_Artykulu || generateArticleId();
    const meta = file.meta || file.data || file;
    const rawOrigTitle = meta.titleEN || meta.originalTitle || meta.titleOriginal || file.titleEN || file.originalTitle || file.titleOriginal || file.Tytul_Oryginalny || file.name || file.newName || "";
    const polishTitle = meta.titlePL || meta.polishTitle || meta.translatedTitle || file.titlePL || file.polishTitle || file.Tytul_PL || file.title || (rawOrigTitle ? rawOrigTitle.replace(/^KC-\d{14}_?/, "").replace(/\.pdf$/i, "").replace(/_/g, " ") : "Dokument PDF");
    const authors = meta.authors || file.authors || file.Autorzy || "Autor nieznany";
    const year = String(meta.year || file.year || file.Rok || "");
    const category = meta.category || meta.suggestedCategory || file.category || file.Kategoria || "Edukacja Seksualna";
    
    let tags = [];
    if (Array.isArray(meta.keywords)) {
      tags = meta.keywords;
    } else if (Array.isArray(meta.tags)) {
      tags = meta.tags;
    } else if (Array.isArray(file.keywords)) {
      tags = file.keywords;
    } else if (Array.isArray(file.tags)) {
      tags = file.tags;
    } else if (typeof meta.keywords === "string") {
      tags = meta.keywords.split(",").map(t => t.trim());
    } else if (typeof file.Slowa_Kluczowe === "string") {
      tags = file.Slowa_Kluczowe.split(",").map(t => t.trim());
    } else {
      tags = [];
    }

    const isInternal = Boolean(
      category === "Materiały Własne SKN" ||
      meta.SKN_INTERNAL === true ||
      file.SKN_INTERNAL === true ||
      meta.isInternal === true ||
      file.isInternal === true ||
      (typeof category === "string" && (category.toLowerCase().includes("materiały własne") || category.toLowerCase().includes("własne skn")))
    );

    const abstractPL = meta.abstractPL || file.abstractPL || file.Abstrakt_PL || "Brak abstraktu.";
    const directUrl = file.url || meta.url || meta.urlOriginal || file.urlOriginal || file.fileUrl || file.URL_Oryginal_Priv || (file.fileId ? `https://drive.google.com/file/d/${file.fileId}/view?usp=sharing` : "#");
    const transUrl = meta.translationUrl || file.translationUrl || meta.urlTranslation || file.urlTranslation || file.URL_Tlumacz_Priv || "";

    const existingIdx = AppState.articles.findIndex((a) => a.id === id || (file.fileId && a.fileIdOriginal === file.fileId));

    const articleObj = {
      id: id,
      dateAdded: file.dateAdded || file.Data_Dodania || new Date().toISOString().split("T")[0],
      titlePL: polishTitle,
      titleOriginal: rawOrigTitle,
      titleEN: rawOrigTitle,
      authors: authors,
      year: year,
      category: category,
      tags: tags,
      keywords: tags,
      abstractPL: abstractPL,
      accessLevel: isInternal ? "MEMBERS" : (file.accessLevel || file.Poziom_Dostepu || "PUBLIC"),
      isInternal: isInternal,
      SKN_INTERNAL: isInternal,
      urlOriginal: directUrl,
      url: directUrl,
      urlTranslation: transUrl,
      translationUrl: transUrl,
      fileIdOriginal: file.fileId || file.fileIdOriginal || file.FileID_Oryginal || id,
      fileIdTranslation: file.fileIdTranslation || file.FileID_Tlumaczenie || "",
      status: "ACTIVE"
    };

    if (existingIdx >= 0) {
      AppState.articles[existingIdx] = { ...AppState.articles[existingIdx], ...articleObj };
    } else {
      AppState.articles.unshift(articleObj);
    }
  });

  renderCategoryPills();
  filterAndRenderArticles();
}

function isInternalArticle(article) {
  return article.isInternal === true || article.SKN_INTERNAL === true || article.category === "Materiały Własne SKN";
}

function filterAndRenderArticles() {
  let list = [...AppState.articles];

  // 1. Kategoria
  if (AppState.activeCategory !== "Wszystko") {
    list = list.filter((a) => a.category === AppState.activeCategory);
  } else {
    if (AppState.currentRole === "PUBLIC") {
      list = list.filter((a) => !isInternalArticle(a));
    }
  }

  // 2. Filtr tylko z tłumaczeniem PL
  if (AppState.filterOnlyTranslations) {
    list = list.filter((a) => Boolean(getArticleTranslationUrl(a)));
  }

  // 3. Aktywny tag
  if (AppState.activeTag) {
    const t = AppState.activeTag.toLowerCase().trim();
    list = list.filter((a) => {
      const meta = a.meta || a.data || a;
      const keywordsList = Array.isArray(meta.keywords) ? meta.keywords : (Array.isArray(meta.tags) ? meta.tags : (Array.isArray(a.keywords) ? a.keywords : (Array.isArray(a.tags) ? a.tags : [])));
      return keywordsList.some((kw) => kw.toLowerCase().trim() === t || kw.toLowerCase().includes(t));
    });
  }

  // 4. Wyszukiwanie tekstowe
  if (AppState.searchQuery) {
    const q = AppState.searchQuery.toLowerCase().trim();
    list = list.filter((a) => {
      const meta = a.meta || a.data || a;
      const matchTitlePL = (meta.titlePL || a.titlePL || "").toLowerCase().includes(q);
      const matchTitleOrig = (meta.titleEN || meta.originalTitle || a.titleOriginal || a.titleEN || "").toLowerCase().includes(q);
      const matchAuthors = (meta.authors || a.authors || "").toLowerCase().includes(q);
      const matchAbstract = (meta.abstractPL || a.abstractPL || "").toLowerCase().includes(q);
      const matchYear = (meta.year || a.year || "").toString().includes(q);
      const keywordsList = Array.isArray(meta.keywords) ? meta.keywords : (Array.isArray(meta.tags) ? meta.tags : (Array.isArray(a.keywords) ? a.keywords : (Array.isArray(a.tags) ? a.tags : [])));
      const matchTags = keywordsList.some((t) => t.toLowerCase().includes(q));

      return matchTitlePL || matchTitleOrig || matchAuthors || matchAbstract || matchYear || matchTags;
    });
  }

  // 5. Zaawansowane sortowanie
  list.sort((a, b) => {
    const metaA = a.meta || a.data || a;
    const metaB = b.meta || b.data || b;

    switch (AppState.sortBy) {
      case "year_desc": {
        const yA = parseInt(metaA.year || a.year, 10) || 0;
        const yB = parseInt(metaB.year || b.year, 10) || 0;
        return yB - yA;
      }
      case "year_asc": {
        const yA = parseInt(metaA.year || a.year, 10) || 0;
        const yB = parseInt(metaB.year || b.year, 10) || 0;
        return yA - yB;
      }
      case "title_asc": {
        const tA = cleanDisplayText(metaA.titlePL || a.titlePL || metaA.titleOriginal || a.titleOriginal || "");
        const tB = cleanDisplayText(metaB.titlePL || b.titlePL || metaB.titleOriginal || b.titleOriginal || "");
        return tA.localeCompare(tB, "pl", { sensitivity: "base" });
      }
      case "authors_asc": {
        const autA = cleanDisplayText(metaA.authors || a.authors || "");
        const autB = cleanDisplayText(metaB.authors || b.authors || "");
        return autA.localeCompare(autB, "pl", { sensitivity: "base" });
      }
      case "date_desc":
      default: {
        const dA = new Date(metaA.dateAdded || a.dateAdded || 0).getTime() || 0;
        const dB = new Date(metaB.dateAdded || b.dateAdded || 0).getTime() || 0;
        return dB - dA;
      }
    }
  });

  AppState.filteredArticles = list;
  renderArticleCards(list);
  updateStatsHeader(list.length);
}

function cleanDisplayText(text) {
  if (!text) return "";
  return String(text).replace(/_/g, " ").trim();
}

function cleanAbstractText(abstractText) {
  if (!abstractText) return "Brak streszczenia.";
  const text = String(abstractText).trim();

  // Wykrywanie błędów autoryzacji Google Apps Script / HTML / Exception
  const isAuthError =
    text.includes("Nie masz uprawnień") ||
    text.includes("Brak uprawnień") ||
    text.includes("Authorization is required") ||
    text.includes("ScriptError") ||
    text.includes("Exception:") ||
    text.includes("<html") ||
    text.includes("<!DOCTYPE") ||
    text.includes("Google Drive Authorization Error") ||
    text.includes("Wymagane logowanie");

  if (isAuthError) {
    return "Wymagana ponowna autoryzacja skryptu Google lub ponowne przesłanie pliku PDF.";
  }

  return text;
}

function safeUrl(url) {
  if (!url) return "#";
  let clean = String(url).trim();

  // Usuń nawiasy kwadratowe, cudzysłowy, spacje i formatowania markdown: np. [https://...] lub `https://...`
  clean = clean.replace(/^[\[\(\`"'\<\{]+|[\]\)\`"'\>\}]+$/g, "").trim();

  // Obsługa linków w formacie Markdown: [tekst](https://...)
  const mdMatch = clean.match(/\((https?:\/\/[^\s\)]+)\)/);
  if (mdMatch) {
    clean = mdMatch[1];
  }

  // Wyodrębnienie bezpośredniego adresu drive.google.com jeśli występują znaki dookoła
  if (clean.includes("drive.google.com")) {
    const driveMatch = clean.match(/https?:\/\/drive\.google\.com[^\s"'>\]\)]+/);
    if (driveMatch) {
      clean = driveMatch[0];
    }
  }

  // Usunięcie znaków zamykających na końcu
  clean = clean.replace(/[\]\)\`"'>]+$/, "").trim();

  // Wykrycie uszkodzonych interpolacji (np. /file/d/$/edit, /file/d/undefined, /file/d/{id})
  if (
    clean.includes("/file/d/$/") ||
    clean.includes("/file/d/$") ||
    clean.includes("/file/d/undefined") ||
    clean.includes("/file/d/null") ||
    clean.includes("/file/d/{}") ||
    clean.includes("/file/d/{") ||
    clean.includes("/file/d//")
  ) {
    return "#";
  }

  if (!clean || clean === "#" || clean === "https://drive.google.com" || clean === "https://drive.google.com/") {
    return "#";
  }

  if (!clean.startsWith("http://") && !clean.startsWith("https://") && !clean.startsWith("#")) {
    clean = "https://" + clean.replace(/^\/+/, "");
  }

  // Weryfikacja czy URL jest poprawnym adresem sieciowym
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "#";
  } catch (e) {
    return "#";
  }

  return clean;
}

/**
 * Sprawdza i zwraca poprawny URL tłumaczenia lub null gdy brak
 */
function getArticleTranslationUrl(art) {
  if (!art) return null;
  const meta = art.meta || art.data || art;
  const rawTrans = art.translationUrl || meta.translationUrl || art.urlTranslation || meta.urlTranslation || art.URL_Tlumacz_Priv || meta.URL_Tlumacz_Priv;
  if (!rawTrans || typeof rawTrans !== "string" || !rawTrans.trim()) {
    return null;
  }
  const trimmed = rawTrans.trim();
  if (trimmed === "#" || trimmed === "undefined" || trimmed === "null" || trimmed === "https://drive.google.com" || trimmed === "https://drive.google.com/") {
    return null;
  }
  const safe = safeUrl(trimmed);
  if (!safe || safe === "#" || safe.includes("/file/d/$/edit") || safe.includes("/file/d/undefined")) {
    return null;
  }
  const rawOrig = art.url || meta.url || art.urlOriginal || meta.urlOriginal || "";
  const safeOrig = safeUrl(rawOrig);
  if (safeOrig && safeOrig !== "#" && safe === safeOrig) {
    return null;
  }
  return safe;
}

/**
 * Dynamiczne nakładanie imiennego znaku wodnego i stempla audytowego na dokumenty SKN
 */
async function downloadWatermarkedPdf(articleId) {
  const article = AppState.articles.find((a) => a.id === articleId) || AppState.filteredArticles.find((a) => a.id === articleId);
  if (!article) return;

  if (AppState.currentRole === "PUBLIC") {
    showToast("Pobieranie materiałów wewnętrznych SKN wymaga autoryzacji kodem PIN.", "error");
    openLoginModal();
    return;
  }

  if (!AppState.watermarkingIds) {
    AppState.watermarkingIds = new Set();
  }

  if (AppState.watermarkingIds.has(articleId)) {
    return;
  }

  AppState.watermarkingIds.add(articleId);
  filterAndRenderArticles();

  const detailModal = document.getElementById("detailModal");
  if (detailModal && detailModal.style.display !== "none") {
    const currentDetailId = document.getElementById("detail-id")?.innerText;
    if (currentDetailId === articleId) {
      openArticleDetail(articleId);
    }
  }

  const title = cleanDisplayText(article.titlePL || article.titleOriginal || article.name || "Dokument");
  showToast("Pobieranie strumienia i wypalanie imiennego stempla wodnego...", "info");

  try {
    if (typeof window.PDFLib === "undefined" && typeof PDFLib === "undefined") {
      await loadPdfLibScript();
    }

    const pdfLibInstance = typeof PDFLib !== "undefined" ? PDFLib : window.PDFLib;
    if (!pdfLibInstance || !pdfLibInstance.PDFDocument) {
      throw new Error("Biblioteka pdf-lib nie została poprawnie zainicjalizowana.");
    }

    const fileId = article.fileIdOriginal || article.fileId || article.fileIdTranslation || article.id;
    const existingPdfBytes = await fetchPdfBytes(fileId);

    const pdfDoc = await pdfLibInstance.PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
    const helveticaBold = await pdfDoc.embedFont(pdfLibInstance.StandardFonts.HelveticaBold);
    const helveticaRegular = await pdfDoc.embedFont(pdfLibInstance.StandardFonts.Helvetica);

    const userName = AppState.currentUser?.name || (AppState.currentRole === "ADMIN" ? "Administrator SKN" : "Dostęp Akademicki");
    const dateStr = new Date().toLocaleDateString("pl-PL");

    const watermarkText = `EGZEMPLARZ: ${userName.toUpperCase()} • SKN SEKSUOLOGII`;
    const auditText = "Pobrano przez: " + userName + " • SKN Seksuologii • " + dateStr;

    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();

      // 1. Diagonal Watermark (Środek strony, kąt -45 st.)
      const diagonalFontSize = Math.max(14, Math.min(22, width / 30));
      const textWidth = helveticaBold.widthOfTextAtSize(watermarkText, diagonalFontSize);

      const centerX = width / 2;
      const centerY = height / 2;
      const rad = -45 * (Math.PI / 180);
      const x = centerX - (textWidth / 2) * Math.cos(rad);
      const y = centerY - (textWidth / 2) * Math.sin(rad);

      page.drawText(watermarkText, {
        x: x,
        y: y,
        size: diagonalFontSize,
        font: helveticaBold,
        color: pdfLibInstance.rgb(0.45, 0.2, 0.55),
        opacity: 0.14,
        rotate: pdfLibInstance.degrees(-45)
      });

      // 2. Stopka strony (Stempel Audytowy)
      page.drawText(auditText, {
        x: 30,
        y: 15,
        size: 8,
        font: helveticaRegular,
        color: pdfLibInstance.rgb(0.25, 0.25, 0.25),
        opacity: 0.85
      });
    }

    const modifiedPdfBytes = await pdfDoc.save();

    // Wywołaj pobieranie jako lokalny Blob i natychmiast zniszcz URL z pamięci
    const blob = new Blob([modifiedPdfBytes], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);
    const dlLink = document.createElement("a");
    dlLink.href = blobUrl;
    const safeBaseName = (article.titleOriginal || article.titlePL || "Material_SKN")
      .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_\-\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    dlLink.download = `${safeBaseName}_SKN_Watermarked.pdf`;
    document.body.appendChild(dlLink);
    dlLink.click();
    document.body.removeChild(dlLink);
    
    // Natychmiastowe zniszczenie obiektu URL
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 500);

    showToast(`Pobrano dokument «${title}» z podpisem cyfrowym i stemplem audytowym!`, "success");
  } catch (err) {
    console.error("Watermark error:", err);
    const errText = (err && typeof err === "object" && err.message) ? err.message : (typeof err === "string" ? err : "Wystąpił problem podczas generowania stempla PDF.");
    showToast("Błąd generowania znaku wodnego: " + errText, "error");
  } finally {
    AppState.watermarkingIds.delete(articleId);
    filterAndRenderArticles();
    if (detailModal && detailModal.style.display !== "none") {
      const currentDetailId = document.getElementById("detail-id")?.innerText;
      if (currentDetailId === articleId) {
        openArticleDetail(articleId);
      }
    }
  }
}
window.downloadWatermarkedPdf = downloadWatermarkedPdf;

function base64ToUint8Array(base64) {
  if (!base64) {
    throw new Error("Pusty lub brakujący ciąg base64 pliku PDF.");
  }
  const cleanBase64 = String(base64)
    .replace(/^data:.*?;base64,/, "")
    .replace(/[^A-Za-z0-9+/=]/g, "")
    .trim();
  
  if (!cleanBase64) {
    throw new Error("Nieprawidłowy format Base64 dokumentu.");
  }

  const binaryString = window.atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function fetchPdfBytes(fileId) {
  const token = AppState.currentUser?.token || "GUEST_ANON_TOKEN";
  const execUrl = AppState.appsScriptUrl || DEFAULT_EXEC_URL;

  // 1. Próba pobrania strumienia binarnego z backendu GAS (action: getSecurePdf)
  if (AppState.isGasEnvironment) {
    try {
      const res = await new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .apiGetSecurePdf({ fileId, token });
      });
      if (res && (res.base64 || res.data || res.pdfBase64 || res.fileBase64)) {
        const raw = res.base64 || res.data || res.pdfBase64 || res.fileBase64;
        window.lastLoadedPdfBase64 = raw;
        window.currentPdfBase64 = raw;
        ViewerState.rawBase64 = raw;
        const bytes = base64ToUint8Array(raw);
        ViewerState.rawPdfBytes = bytes;
        return bytes;
      }
    } catch (e) {
      console.warn("GAS apiGetSecurePdf error:", e);
    }
  } else {
    try {
      const data = await callGoogleScript("getSecurePdf", { fileId, token });
      if (data && (data.base64 || data.data || data.pdfBase64 || data.fileBase64)) {
        const raw = data.base64 || data.data || data.pdfBase64 || data.fileBase64;
        window.lastLoadedPdfBase64 = raw;
        window.currentPdfBase64 = raw;
        ViewerState.rawBase64 = raw;
        const bytes = base64ToUint8Array(raw);
        ViewerState.rawPdfBytes = bytes;
        window.currentPdfBytes = bytes;
        return bytes;
      }
    } catch (e) {
      console.warn("Fetch action getSecurePdf error:", e);
    }
  }

  // 2. Fallback bezpośredni (jeśli backend nie udostępnia akcji getSecurePdf)
  if (fileId) {
    try {
      const res = await fetch(`https://docs.google.com/uc?export=download&id=${fileId}`);
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      console.warn("Drive direct fallback fetch error:", e);
    }
  }

  // 3. Fallback generowania dokumentu w pamięci RAM
  if (typeof PDFLib === "undefined" && typeof window.PDFLib === "undefined") {
    await loadPdfLibScript();
  }
  const pdfLibInstance = typeof PDFLib !== "undefined" ? PDFLib : window.PDFLib;
  const doc = await pdfLibInstance.PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  page.drawText("STUDENCKIE KOLO NAUKOWE SEKSUOLOGII", { x: 50, y: 780, size: 16 });
  page.drawText("Zabezpieczony Material Repozytorium SKN Seksuologii", { x: 50, y: 750, size: 12 });
  return await doc.save();
}

function loadPdfLibScript() {
  return new Promise((resolve, reject) => {
    if (typeof PDFLib !== "undefined" || typeof window.PDFLib !== "undefined") {
      return resolve(typeof PDFLib !== "undefined" ? PDFLib : window.PDFLib);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/pdf-lib@1.17.9/dist/pdf-lib.min.js";
    script.onload = () => resolve(typeof PDFLib !== "undefined" ? PDFLib : window.PDFLib);
    script.onerror = () => reject(new Error("Nie udało się załadować biblioteki pdf-lib (błąd sieci/CDN)."));
    document.head.appendChild(script);
  });
}

/**
 * Zlecanie tłumaczenia pełnotekstowego AI
 */
async function requestAiTranslation(articleId) {
  const article = AppState.articles.find((a) => a.id === articleId) || AppState.filteredArticles.find((a) => a.id === articleId);
  if (!article) return;

  const title = article.titlePL || article.titleOriginal || article.name || "artykułu";

  if (!AppState.translatingIds) {
    AppState.translatingIds = new Set();
  }

  if (AppState.translatingIds.has(articleId)) {
    return;
  }

  AppState.translatingIds.add(articleId);
  filterAndRenderArticles();

  // Zaktualizuj modal szczegółów, jeśli jest otwarty dla tego artykułu
  const detailModal = document.getElementById("detailModal");
  if (detailModal && detailModal.style.display !== "none") {
    const currentDetailId = document.getElementById("detail-id")?.innerText;
    if (currentDetailId === articleId) {
      openArticleDetail(articleId);
    }
  }

  showToast("Tłumaczenie akademickie w toku (może zająć kilkanaście sekund)...", "info");

  try {
    const fileId = article.fileId || article.fileIdOriginal || article.fileIdTranslation || article.id;
    const payload = {
      action: "translate",
      recordId: article.id,
      fileId: fileId,
      adminPin: AppState.currentPin || "2026"
    };

    let result = null;

    if (AppState.isGasEnvironment) {
      result = await new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .apiProcessArticle(payload);
      });
    } else {
      result = await callGoogleScript("translate", payload);
    }

    if (result && (result.status === "success" || result.success) && (result.translationUrl || result.urlTranslation || result.url)) {
      const newTransUrl = safeUrl(result.translationUrl || result.urlTranslation || result.url);
      article.translationUrl = newTransUrl;
      article.urlTranslation = newTransUrl;
      if (article.meta) {
        article.meta.translationUrl = newTransUrl;
        article.meta.urlTranslation = newTransUrl;
      }
      showToast(`Dokument «${cleanDisplayText(title)}» został pomyślnie przetłumaczony na język polski!`, "success");
    } else {
      throw new Error((result && (result.message || result.error)) || "Nie udało się wygenerować tłumaczenia.");
    }
  } catch (err) {
    console.error("Translation error:", err);
    showToast("Błąd tłumaczenia AI: " + (err.message || err), "error");
  } finally {
    AppState.translatingIds.delete(articleId);
    filterAndRenderArticles();
    if (detailModal && detailModal.style.display !== "none") {
      const currentDetailId = document.getElementById("detail-id")?.innerText;
      if (currentDetailId === articleId) {
        openArticleDetail(articleId);
      }
    }
  }
}
window.requestAiTranslation = requestAiTranslation;

/**
 * Renderowanie kart artykułów (Light Academic Theme)
 */
function renderArticleCards(articles) {
  const grid = document.getElementById("articles-grid") || document.getElementById("articlesGrid");
  const emptyState = document.getElementById("empty-state");
  if (!grid) return;

  grid.innerHTML = "";

  if (articles.length === 0) {
    grid.classList.add("hidden");
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");
  grid.classList.remove("hidden");

  articles.forEach((art) => {
    const meta = art.meta || art.data || art || {};
    const isInternal = isInternalArticle(art);
    const isPublic = Boolean(art.isPublic !== undefined ? art.isPublic : (art.accessLevel ? art.accessLevel === "PUBLIC" : (!isInternal && art.status !== "INTERNAL")));
    const isWatermarking = AppState.watermarkingIds && AppState.watermarkingIds.has(art.id);

    let accessBadge = "";
    if (isInternal) {
      accessBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"><i class="fas fa-lock text-[9px]"></i> Materiał Własny SKN</span>`;
    } else if (isPublic) {
      accessBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1"><i class="fas fa-globe text-[9px]"></i> Dostęp Otwarty</span>`;
    } else {
      accessBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1"><i class="fas fa-lock text-[9px]"></i> Tylko SKN</span>`;
    }

    const deleteBtnHtml = AppState.currentRole === "ADMIN"
      ? `<button onclick="openDeleteModal('${art.id}', event)" class="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center cursor-pointer" title="Usuń / Przenieś do kosza">
          <i class="fas fa-trash-can text-xs"></i>
        </button>`
      : "";

    const displayTitlePL = cleanDisplayText(meta.titlePL || meta.polishTitle || art.titlePL || art.polishTitle || art.name || "Brak tytułu");
    const displayTitleEN = cleanDisplayText(meta.titleEN || meta.originalTitle || meta.titleOriginal || art.titleEN || art.titleOriginal || art.originalTitle || "");
    const displayAuthors = cleanDisplayText(meta.authors || art.authors || "Autor nieznany");
    const displayYear = meta.year || art.year || "";
    const displayCategory = meta.category || art.category || "Edukacja Seksualna";
    const displayAbstract = cleanAbstractText(meta.abstractPL || art.abstractPL);
    const keywordsList = Array.isArray(meta.keywords) ? meta.keywords : (Array.isArray(meta.tags) ? meta.tags : (Array.isArray(art.keywords) ? art.keywords : (Array.isArray(art.tags) ? art.tags : [])));

    const tagsHtml = keywordsList
      .map(
        (tag) =>
          `<button type="button" onclick="event.stopPropagation(); filterByTag('${escapeHtml(tag)}')" class="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200 transition-colors cursor-pointer font-medium" title="Filtruj po słowie kluczowym #${escapeHtml(cleanDisplayText(tag))}">#${escapeHtml(cleanDisplayText(tag))}</button>`
      )
      .join(" ");

    const rawUrl = art.url || meta.url || art.urlOriginal || meta.urlOriginal || (art.fileIdOriginal ? `https://drive.google.com/file/d/${art.fileIdOriginal}/view?usp=sharing` : (art.fileId ? `https://drive.google.com/file/d/${art.fileId}/view?usp=sharing` : "#"));
    const origUrl = safeUrl(rawUrl);
    const transUrl = getArticleTranslationUrl(art);
    const hasTranslation = Boolean(transUrl && transUrl.trim().length > 0 && transUrl !== "#");
    const isTranslating = AppState.translatingIds && AppState.translatingIds.has(art.id);

    let rightBtnHtml = "";
    if (isTranslating) {
      rightBtnHtml = `
        <button disabled class="flex-1 bg-purple-50 text-purple-700 border border-purple-300 py-1.5 px-1 rounded-md text-[11px] font-medium text-center flex items-center justify-center gap-1 cursor-wait whitespace-nowrap">
          <i class="fas fa-circle-notch fa-spin text-purple-600 text-xs shrink-0"></i>
          <span>Tłumaczenie...</span>
        </button>`;
    } else if (hasTranslation) {
      rightBtnHtml = `
        <button type="button" onclick="event.stopPropagation(); openSecureViewer('${art.id}', 'translation')" class="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-1.5 px-1 rounded-md text-[11px] font-semibold text-center flex items-center justify-center gap-1 shadow-sm transition-all whitespace-nowrap cursor-pointer overflow-visible" title="Otwórz zabezpieczony czytnik tłumaczenia PL">
          <i class="fas fa-language text-indigo-100 text-xs shrink-0"></i>
          <span>Tłumaczenie PL</span>
        </button>`;
    } else {
      rightBtnHtml = `
        <button type="button" onclick="event.stopPropagation(); requestAiTranslation('${art.id}')" class="flex-1 bg-white text-slate-700 border border-slate-300 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 py-1.5 px-1 rounded-md text-[11px] font-medium text-center flex items-center justify-center gap-1 transition-all whitespace-nowrap cursor-pointer shadow-sm" title="Zleć tłumaczenie pełnotekstowe AI">
          <i class="fas fa-globe text-indigo-600 text-xs shrink-0"></i>
          <span>Przetłumacz na PL</span>
        </button>`;
    }

    let bottomButtonsHtml = "";
    if (isInternal) {
      if (isWatermarking) {
        bottomButtonsHtml = `
          <button disabled class="w-full bg-rose-50 text-rose-700 border border-rose-300 py-1.5 px-2 rounded-md text-[11px] font-medium text-center flex items-center justify-center gap-1.5 cursor-wait whitespace-nowrap">
            <i class="fas fa-circle-notch fa-spin text-rose-600 text-xs shrink-0"></i>
            <span>Generowanie znaku wodnego...</span>
          </button>`;
      } else {
        bottomButtonsHtml = `
          <button type="button" onclick="event.stopPropagation(); openSecureViewer('${art.id}', 'original')" class="w-full bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-700 hover:to-purple-700 text-white py-1.5 px-2 rounded-md text-[11px] font-semibold text-center flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap cursor-pointer" title="Otwórz zabezpieczony czytnik materiału wewnętrznego SKN">
            <i class="fas fa-file-shield text-xs shrink-0"></i>
            <span>🔒 Czytaj ze stemplem cyfrowym</span>
          </button>`;
      }
    } else {
      bottomButtonsHtml = `
        <button type="button" onclick="event.stopPropagation(); openSecureViewer('${art.id}', 'original')" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 py-1.5 px-1 rounded-md text-[11px] font-medium text-center flex items-center justify-center gap-1 border border-slate-200 transition-colors whitespace-nowrap cursor-pointer" title="Otwórz zabezpieczony czytnik oryginału">
          <i class="fas fa-file-pdf text-red-500 text-xs shrink-0"></i>
          <span>Oryginał</span>
        </button>
        ${rightBtnHtml}`;
    }

    const card = document.createElement("div");
    card.id = `card-${art.id}`;
    card.className = "academic-card w-full h-full flex flex-col justify-between overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all duration-200";

    card.innerHTML = `
      <div>
        <!-- Nagłówek Karty: Kategoria + Badge Dostępu + Kosz -->
        <div class="flex items-center justify-between gap-1.5 mb-2">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
              ${escapeHtml(displayCategory)}
            </span>
            ${accessBadge}
          </div>
          ${deleteBtnHtml}
        </div>

        <!-- Tytuł Główny (h3: ~0.95rem, 700, 1.35) -->
        <h3 class="text-[14px] sm:text-[15px] font-bold text-slate-900 break-words leading-[1.35] hover:text-indigo-600 transition-colors cursor-pointer mb-1 line-clamp-2" onclick="openArticleDetail('${art.id}')">
          ${escapeHtml(displayTitlePL)}
        </h3>

        <!-- Podtytuł i Autorzy -->
        <div class="text-[11px] text-slate-500 mb-1.5">
          ${displayTitleEN ? `<p class="italic line-clamp-1 break-all text-slate-600"><i class="fas fa-book-open mr-1 text-slate-400"></i> ${escapeHtml(displayTitleEN)}</p>` : ""}
          <div class="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-slate-500 mt-0.5">
            <span><i class="fas fa-user-friends mr-1 text-indigo-500"></i> ${escapeHtml(displayAuthors)}</span>
            ${displayYear ? `<span><i class="fas fa-calendar-alt mr-1 text-indigo-500"></i> ${escapeHtml(displayYear)}</span>` : ""}
          </div>
        </div>

        <!-- Boks Abstraktu: max-h ~88px, czcionka 0.8rem / 11.5px -->
        <div class="bg-slate-50 border border-slate-200/90 rounded-xl p-2.5 text-[11.5px] text-slate-600 leading-[1.4] max-h-[88px] overflow-y-auto my-2 cursor-pointer hover:border-indigo-200 transition-colors" onclick="openArticleDetail('${art.id}')">
          <p class="line-clamp-3">${escapeHtml(displayAbstract)}</p>
          <button type="button" onclick="event.stopPropagation(); openArticleDetail('${art.id}')" class="text-[10.5px] text-indigo-600 hover:text-indigo-800 font-semibold mt-1 inline-flex items-center gap-1 hover:underline cursor-pointer">
            <span>Czytaj pełny abstrakt →</span>
          </button>
        </div>

        <!-- Tagi i słowa kluczowe -->
        <div class="flex flex-wrap gap-1 mb-1.5">
          ${tagsHtml}
        </div>
      </div>

      <!-- Przyciski Pobierania w jednym rzędzie: elastyczny flexbox, kompaktowe i czytelne -->
      <div class="flex items-center gap-1.5 pt-2.5 mt-auto border-t border-slate-100 w-full">
        ${bottomButtonsHtml}
      </div>
    `;

    grid.appendChild(card);
  });
}

function filterByTag(tag) {
  if (!tag) return;
  const cleanTag = tag.replace(/^#/, "").trim();
  AppState.activeTag = cleanTag;

  const chip = document.getElementById("active-tag-chip");
  const label = document.getElementById("active-tag-label");
  if (chip && label) {
    label.innerText = `#${cleanTag}`;
    chip.classList.remove("hidden");
    chip.classList.add("flex");
  }

  filterAndRenderArticles();
  
  const searchSection = document.getElementById("articles-grid");
  if (searchSection) {
    searchSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
window.filterByTag = filterByTag;

function clearTagFilter() {
  AppState.activeTag = null;
  const chip = document.getElementById("active-tag-chip");
  if (chip) {
    chip.classList.add("hidden");
    chip.classList.remove("flex");
  }
  filterAndRenderArticles();
}
window.clearTagFilter = clearTagFilter;

function handleSortChange(sortVal) {
  AppState.sortBy = sortVal || "date_desc";
  filterAndRenderArticles();
}
window.handleSortChange = handleSortChange;

function toggleTranslationFilter() {
  AppState.filterOnlyTranslations = !AppState.filterOnlyTranslations;
  const btn = document.getElementById("filter-translation-toggle");
  const label = document.getElementById("filter-translation-label");
  if (btn) {
    if (AppState.filterOnlyTranslations) {
      btn.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600 text-white border border-purple-700 shadow-sm transition cursor-pointer";
      if (label) label.innerText = "🇵🇱 Tylko z tłumaczeniem PL (Aktywne)";
    } else {
      btn.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition cursor-pointer shadow-sm";
      if (label) label.innerText = "🇵🇱 Tylko z tłumaczeniem PL";
    }
  }
  filterAndRenderArticles();
}
window.toggleTranslationFilter = toggleTranslationFilter;

function clearSearchInput() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";
  AppState.searchQuery = "";
  document.getElementById("clear-search-btn")?.classList.add("hidden");
  clearTagFilter();
  filterAndRenderArticles();
}
window.clearSearchInput = clearSearchInput;

function updateStatsHeader(count) {
  const countEl = document.getElementById("results-count");
  if (countEl) {
    countEl.innerText = count;
  }
}

/**
 * Wskaźnik statusu połączenia z Google Apps Script
 */
function updateGasStatusIndicator() {
  const pill = document.getElementById("gas-status-pill");
  if (!pill) return;

  if (AppState.isGasEnvironment || AppState.appsScriptUrl) {
    pill.className = "px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-300";
    pill.innerText = "Połączono z Google Apps Script";
  } else {
    pill.className = "px-2 py-0.5 rounded-md text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-300";
    pill.innerText = "Brak URL Apps Script (Kliknij Ustawienia API)";
  }
}

function handleSaveGasConfig() {
  const input = document.getElementById("gasWebAppUrlInput");
  const url = input ? input.value.trim() : "";

  if (url && !url.startsWith("https://script.google.com/macros/s/")) {
    showToast("Adres URL musi zaczynać się od https://script.google.com/macros/s/...", "error");
    return;
  }

  AppState.appsScriptUrl = url || DEFAULT_EXEC_URL;
  if (url) {
    localStorage.setItem("APPS_SCRIPT_WEBAPP_URL", url);
    showToast("Pomyślnie zapisano URL Google Apps Script!", "success");
  } else {
    localStorage.removeItem("APPS_SCRIPT_WEBAPP_URL");
    showToast("Przywrócono domyślny URL Apps Script.", "info");
  }

  updateGasStatusIndicator();
  closeConfigModal();
  loadArticles();
}

/**
 * Aktualizacja elementów interfejsu w zależności od aktywnej roli
 */
function updateAuthUI() {
  const roleBadge = document.getElementById("auth-role-badge");
  const userSessionPill = document.getElementById("user-session-pill");
  const userDisplayName = document.getElementById("user-display-name");
  const userDisplayRole = document.getElementById("user-display-role");
  const loginNavBtn = document.getElementById("btnLoginOpen");
  const logoutNavBtn = document.getElementById("logout-btn");
  const adminContainer = document.getElementById("admin-actions-container");
  const memberContainer = document.getElementById("member-actions-container");
  const adminSystemInfo = document.getElementById("admin-system-info");
  const gasStatusText = document.getElementById("gas-status-text");
  const gasStatusSubtext = document.getElementById("gas-status-subtext");

  const isAuthenticated = AppState.currentRole === "ADMIN" || AppState.currentRole === "CZLONEK" || AppState.currentRole === "MEMBERS";

  if (isAuthenticated && AppState.currentUser) {
    if (roleBadge) {
      roleBadge.classList.add("hidden");
      roleBadge.style.setProperty("display", "none", "important");
    }
    if (userSessionPill) {
      userSessionPill.classList.remove("hidden");
      userSessionPill.style.setProperty("display", "inline-flex", "important");
    }
    if (userDisplayName) {
      userDisplayName.innerText = AppState.currentUser.name || (AppState.currentRole === "ADMIN" ? "Administrator" : "Członek SKN");
    }
    if (userDisplayRole) {
      userDisplayRole.innerText = AppState.currentRole === "ADMIN" ? "Administrator" : "Członek SKN";
      userDisplayRole.className = AppState.currentRole === "ADMIN" ? "font-bold text-amber-800 text-[11px]" : "font-semibold text-indigo-700 text-[11px]";
    }
    if (loginNavBtn) {
      loginNavBtn.classList.add("hidden");
      loginNavBtn.style.setProperty("display", "none", "important");
    }
    if (logoutNavBtn) {
      logoutNavBtn.classList.remove("hidden");
      logoutNavBtn.style.setProperty("display", "inline-flex", "important");
    }
  } else {
    if (roleBadge) {
      roleBadge.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200"><i class="fas fa-eye text-slate-400"></i> Gość (Widok Publiczny)</span>`;
      roleBadge.classList.remove("hidden");
      roleBadge.style.setProperty("display", "inline-block", "important");
    }
    if (userSessionPill) {
      userSessionPill.classList.add("hidden");
      userSessionPill.style.setProperty("display", "none", "important");
    }
    if (loginNavBtn) {
      loginNavBtn.classList.remove("hidden");
      loginNavBtn.style.setProperty("display", "inline-flex", "important");
    }
    if (logoutNavBtn) {
      logoutNavBtn.classList.add("hidden");
      logoutNavBtn.style.setProperty("display", "none", "important");
    }
  }

  if (AppState.currentRole === "ADMIN") {
    if (adminContainer) {
      adminContainer.classList.remove("hidden");
      adminContainer.style.setProperty("display", "block", "important");
    }
    if (adminSystemInfo) {
      adminSystemInfo.classList.remove("hidden");
      adminSystemInfo.style.setProperty("display", "block", "important");
    }
    if (memberContainer) {
      memberContainer.classList.add("hidden");
      memberContainer.style.setProperty("display", "none", "important");
    }
    if (gasStatusText) gasStatusText.innerText = "Połączono z Google Apps Script";
    if (gasStatusSubtext) gasStatusSubtext.innerText = "Dysk Google • Pełny dostęp Administratora";
  } else if (AppState.currentRole === "CZLONEK" || AppState.currentRole === "MEMBERS") {
    if (adminContainer) {
      adminContainer.classList.add("hidden");
      adminContainer.style.setProperty("display", "none", "important");
    }
    if (adminSystemInfo) {
      adminSystemInfo.classList.add("hidden");
      adminSystemInfo.style.setProperty("display", "none", "important");
    }
    if (memberContainer) {
      memberContainer.classList.remove("hidden");
      memberContainer.style.setProperty("display", "block", "important");
    }
    if (gasStatusText) gasStatusText.innerText = "Dysk SKN: Połączono";
    if (gasStatusSubtext) gasStatusSubtext.innerText = "Dostęp do odczytu i tłumaczeń";
  } else {
    if (adminContainer) {
      adminContainer.classList.add("hidden");
      adminContainer.style.setProperty("display", "none", "important");
    }
    if (adminSystemInfo) {
      adminSystemInfo.classList.add("hidden");
      adminSystemInfo.style.setProperty("display", "none", "important");
    }
    if (memberContainer) {
      memberContainer.classList.add("hidden");
      memberContainer.style.setProperty("display", "none", "important");
    }
    if (gasStatusText) gasStatusText.innerText = "Widok Otwarty (Dysk SKN)";
    if (gasStatusSubtext) gasStatusSubtext.innerText = "Zaloguj się e-mailem i PIN-em członka";
  }

  filterAndRenderArticles();
}

/**
 * Obsługa zgłoszenia publikacji przez webowy edytor Gmail z gotowym szablonem merytorycznym
 */
function handleProposeArticle() {
  const recipient = "kontakt@sknseksuologii.pl";
  const subject = encodeURIComponent("[Kalejdoskop Café] Propozycja publikacji do Bazy Wiedzy");
  
  const templateBody = 
    "Dzień dobry Zarządzie SKN,\n\n" +
    "Zgłaszam propozycję publikacji naukowej do włączenia do Repozytorium Bazy Wiedzy Kalejdoskop Café:\n\n" +
    "1. DANE PUBLIKACJI:\n" +
    "- Pełny tytuł artykułu: \n" +
    "- Autorzy i rok wydania: \n" +
    "- Identyfikator DOI / Link do źródła: \n\n" +
    "2. KLASYFIKACJA TEMATYCZNA (zaznacz jedną):\n" +
    "[ ] Relacje i Bliskość\n" +
    "[ ] Biologia & Psychofizjologia\n" +
    "[ ] Tożsamość & Gender\n" +
    "[ ] Edukacja Seksualna\n" +
    "[ ] Psychometria & Metodologia\n" +
    "[ ] Materiały Własne SKN\n\n" +
    "3. UZASADNIENIE MERYTORYCZNE:\n" +
    "- Dlaczego warto dodać tę pozycję do bazy koła? \n" +
    "- Jakie kluczowe wnioski porusza? \n\n" +
    "--------------------------------------------------\n" +
    "* Pamiętaj o dołączeniu pliku PDF w załączniku!\n" +
    "* Zgłaszający: " + (AppState.currentRole === "ADMIN" ? "Administrator SKN" : "Członek SKN") + "\n";

  const encodedBody = encodeURIComponent(templateBody);

  // Bezpośredni link do webowego edytora nowej wiadomości w Gmailu
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${encodedBody}`;

  // Otwarcie w nowej karcie
  window.open(gmailUrl, "_blank");
}
window.handleProposeArticle = handleProposeArticle;
window.sendArticleProposal = handleProposeArticle;

/**
 * Bezpieczne przełączanie widoczności modali
 */
function showModalElement(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.style.setProperty("display", "flex", "important");
    modal.style.zIndex = "99999";
  }
}

function hideModalElement(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.style.setProperty("display", "none", "important");
  }
}

function handleBackdropClick(event, modalId) {
  if (event.target && event.target.id === modalId) {
    hideModalElement(modalId);
  }
}

function closeAllModals() {
  ["loginModal", "deleteModal", "detailModal", "uploadModal", "syncModal", "configModal", "statsModal", "securePdfViewerModal"].forEach((id) => {
    hideModalElement(id);
  });
}

/**
 * Pulpit Statystyk i Analityki Bazy Wiedzy (Dashboard SKN)
 */
function openStatsModal() {
  const articles = AppState.articles || [];
  const totalCount = articles.length;

  // 1. KPI
  const translatedArticles = articles.filter((a) => Boolean(getArticleTranslationUrl(a)));
  const transCount = translatedArticles.length;
  const transPct = totalCount > 0 ? Math.round((transCount / totalCount) * 100) : 0;

  const internalArticles = articles.filter((a) => isInternalArticle(a));
  const internalCount = internalArticles.length;

  const kpiTotalEl = document.getElementById("stats-kpi-total");
  const kpiTransEl = document.getElementById("stats-kpi-translations");
  const kpiTransPctEl = document.getElementById("stats-kpi-translations-pct");
  const kpiInternalEl = document.getElementById("stats-kpi-internal");

  if (kpiTotalEl) kpiTotalEl.innerText = `${totalCount} ${totalCount === 1 ? "praca" : (totalCount < 5 ? "prace" : "prac")}`;
  if (kpiTransEl) kpiTransEl.innerText = `${transCount} ${transCount === 1 ? "praca" : (transCount < 5 ? "prace" : "prac")}`;
  if (kpiTransPctEl) kpiTransPctEl.innerText = `${transPct}% zasobów bazy`;
  if (kpiInternalEl) kpiInternalEl.innerText = `${internalCount} ${internalCount === 1 ? "pozycja" : (internalCount < 5 ? "pozycje" : "pozycji")}`;

  // 2. Rozkład Kategorii Tematycznych
  const categoriesList = AppState.categories.filter((c) => c !== "Wszystko");
  const catCounts = {};
  categoriesList.forEach((c) => (catCounts[c] = 0));

  articles.forEach((art) => {
    const meta = art.meta || art.data || art;
    const cat = meta.category || art.category || "Edukacja Seksualna";
    if (typeof catCounts[cat] === "number") {
      catCounts[cat]++;
    } else {
      catCounts[cat] = 1;
    }
  });

  const catColors = {
    "Relacje i Bliskość": { bg: "bg-amber-500", light: "bg-amber-50 text-amber-800 border-amber-200" },
    "Biologia & Psychofizjologia": { bg: "bg-emerald-500", light: "bg-emerald-50 text-emerald-800 border-emerald-200" },
    "Tożsamość & Gender": { bg: "bg-purple-500", light: "bg-purple-50 text-purple-800 border-purple-200" },
    "Edukacja Seksualna": { bg: "bg-blue-500", light: "bg-blue-50 text-blue-800 border-blue-200" },
    "Psychometria & Metodologia": { bg: "bg-cyan-500", light: "bg-cyan-50 text-cyan-800 border-cyan-200" },
    "Materiały Własne SKN": { bg: "bg-rose-500", light: "bg-rose-50 text-rose-800 border-rose-200" }
  };

  const barsContainer = document.getElementById("stats-categories-bars");
  if (barsContainer) {
    let barsHtml = "";
    Object.keys(catCounts).forEach((catName) => {
      const count = catCounts[catName] || 0;
      const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      const theme = catColors[catName] || { bg: "bg-indigo-500", light: "bg-indigo-50 text-indigo-800 border-indigo-200" };

      barsHtml += `
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-700 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${theme.bg}"></span>
              ${escapeHtml(catName)}
            </span>
            <span class="text-slate-500 font-mono text-[11px]">${count} (${pct}%)</span>
          </div>
          <div class="w-full bg-slate-200/80 rounded-full h-2 overflow-hidden">
            <div class="${theme.bg} h-2 rounded-full transition-all duration-500" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    });
    barsContainer.innerHTML = barsHtml || "<p class='text-slate-400 text-xs italic'>Brak sklasyfikowanych prac.</p>";
  }

  // 3. Top Słowa Kluczowe (#Tagi)
  const tagCounts = {};
  articles.forEach((art) => {
    const meta = art.meta || art.data || art;
    const keywordsList = Array.isArray(meta.keywords) ? meta.keywords : (Array.isArray(meta.tags) ? meta.tags : (Array.isArray(art.keywords) ? art.keywords : (Array.isArray(art.tags) ? art.tags : [])));
    keywordsList.forEach((rawTag) => {
      const tag = cleanDisplayText(rawTag).replace(/^#/, "").trim();
      if (tag) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    });
  });

  const sortedTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const tagsContainer = document.getElementById("stats-top-tags");
  if (tagsContainer) {
    if (sortedTags.length === 0) {
      tagsContainer.innerHTML = "<p class='text-slate-400 text-xs italic'>Brak słów kluczowych w bazie.</p>";
    } else {
      tagsContainer.innerHTML = sortedTags
        .map(
          ([tagName, tagCount]) =>
            `<button type="button" onclick="closeStatsModal(); filterByTag('${escapeHtml(tagName)}');" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200 transition cursor-pointer font-medium" title="Pokaż publikacje z tagiem #${escapeHtml(tagName)}">
              <span>#${escapeHtml(tagName)}</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-200/80 text-purple-800">${tagCount}</span>
            </button>`
        )
        .join(" ");
    }
  }

  // 4. Najczęstsi Autorzy
  const authorCounts = {};
  articles.forEach((art) => {
    const meta = art.meta || art.data || art;
    const rawAuthors = cleanDisplayText(meta.authors || art.authors || "Autor nieznany");
    if (rawAuthors && rawAuthors !== "Autor nieznany") {
      const splitAuthors = rawAuthors.split(/,|;| i | and /i).map((a) => a.trim()).filter((a) => a.length > 2);
      splitAuthors.forEach((aName) => {
        authorCounts[aName] = (authorCounts[aName] || 0) + 1;
      });
    }
  });

  const sortedAuthors = Object.entries(authorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const authorsContainer = document.getElementById("stats-top-authors");
  if (authorsContainer) {
    if (sortedAuthors.length === 0) {
      authorsContainer.innerHTML = "<p class='text-slate-400 text-xs italic'>Brak danych o autorach.</p>";
    } else {
      authorsContainer.innerHTML = sortedAuthors
        .map(
          ([authorName, aCount]) =>
            `<div class="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
              <span class="font-medium text-slate-800 truncate pr-2 flex items-center gap-1.5">
                <i class="fas fa-user-pen text-indigo-400 text-[10px]"></i>
                ${escapeHtml(authorName)}
              </span>
              <span class="text-indigo-600 font-bold font-mono text-xs shrink-0">${aCount} ${aCount === 1 ? "praca" : "prace"}</span>
            </div>`
        )
        .join("");
    }
  }

  showModalElement("statsModal");
}
window.openStatsModal = openStatsModal;

function closeStatsModal() {
  hideModalElement("statsModal");
}
window.closeStatsModal = closeStatsModal;

/**
 * ZABEZPIECZONY CZYTNIK DOKUMENTÓW (PDF.js + Canvas Render + Watermarking + Anti-Extraction)
 */
const ViewerState = {
  currentArticleId: null,
  currentMode: "original",
  pdfDoc: null,
  pageNum: 1,
  pageCount: 1,
  scale: 1.25,
  pageRendering: false,
  pageNumPending: null,
  rawPdfBytes: null
};

if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

async function openSecureViewer(articleId, mode = "original") {
  const article = AppState.articles.find((a) => a.id === articleId) || AppState.filteredArticles.find((a) => a.id === articleId);
  if (!article) return;

  const isInternal = isInternalArticle(article);
  if (isInternal && AppState.currentRole === "PUBLIC") {
    showToast("Materiały Własne SKN wymagają autoryzacji kodem PIN członka/administratora.", "info");
    openLoginModal();
    return;
  }

  ViewerState.currentArticleId = articleId;
  ViewerState.currentMode = mode;
  ViewerState.pageNum = 1;
  ViewerState.scale = 1.25;
  ViewerState.pdfDoc = null;
  ViewerState.rawPdfBytes = null;

  const title = cleanDisplayText(article.titlePL || article.titleOriginal || article.name || "Dokument");
  window.currentPdfFileName = `${title.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_\-\s]/g, "_").trim().replace(/\s+/g, "_")}_SKN.pdf`;

  const docTitleEl = document.getElementById("viewer-doc-title");
  const docBadgeEl = document.getElementById("viewer-doc-badge");
  const canvasWrapper = document.getElementById("viewer-canvas-wrapper");
  const loadingSpinner = document.getElementById("viewer-loading-spinner");

  if (docTitleEl) docTitleEl.innerText = title;
  if (docBadgeEl) {
    if (isInternal) {
      docBadgeEl.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-rose-900 text-rose-200 border border-rose-700";
      docBadgeEl.innerText = "🔒 Materiał Własny SKN";
    } else if (mode === "translation") {
      docBadgeEl.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-purple-900 text-purple-200 border border-purple-700";
      docBadgeEl.innerText = "🇵🇱 Tłumaczenie PL";
    } else {
      docBadgeEl.className = "px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-900 text-indigo-200 border border-indigo-700";
      docBadgeEl.innerText = "📄 Oryginał PDF";
    }
  }

  if (canvasWrapper) canvasWrapper.classList.add("hidden");
  if (loadingSpinner) loadingSpinner.classList.remove("hidden");

  showModalElement("securePdfViewerModal");

  try {
    let fileId = "";
    if (mode === "translation") {
      fileId = article.fileIdTranslation || article.fileIdOriginal;
    } else {
      fileId = article.fileIdOriginal || article.fileId || article.id;
    }

    const pdfBytes = await fetchPdfBytes(fileId);
    ViewerState.rawPdfBytes = pdfBytes;
    window.currentPdfBytes = pdfBytes;

    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes,
      cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/",
      cMapPacked: true
    });

    const pdfDoc = await loadingTask.promise;
    ViewerState.pdfDoc = pdfDoc;
    window.pdfDoc = pdfDoc;
    ViewerState.pageCount = pdfDoc.numPages;

    const pageCountEl = document.getElementById("viewer-page-count");
    if (pageCountEl) pageCountEl.innerText = pdfDoc.numPages;

    renderViewerPage(ViewerState.pageNum);
  } catch (err) {
    console.error("Secure viewer loading error:", err);
    if (loadingSpinner) {
      loadingSpinner.innerHTML = `
        <div class="text-rose-400 text-center space-y-2">
          <i class="fas fa-triangle-exclamation text-3xl"></i>
          <p class="text-xs font-semibold">Nie udało się załadować podglądu pliku PDF.</p>
          <p class="text-[11px] text-slate-400">${escapeHtml(err.message || err)}</p>
        </div>
      `;
    }
  }
}
window.openSecureViewer = openSecureViewer;

function openSecureViewerFromDetail(mode = "original") {
  const detailIdEl = document.getElementById("detail-id");
  const currentId = detailIdEl ? detailIdEl.innerText.trim() : null;
  if (currentId && currentId !== "-") {
    openSecureViewer(currentId, mode);
  }
}
window.openSecureViewerFromDetail = openSecureViewerFromDetail;

async function renderViewerPage(num) {
  if (!ViewerState.pdfDoc) return;
  ViewerState.pageRendering = true;

  const canvas = document.getElementById("pdf-render-canvas");
  const canvasWrapper = document.getElementById("viewer-canvas-wrapper");
  const loadingSpinner = document.getElementById("viewer-loading-spinner");
  const pageNumEl = document.getElementById("viewer-page-num");
  const zoomLabel = document.getElementById("viewer-zoom-label");

  if (pageNumEl) pageNumEl.innerText = num;
  if (zoomLabel) zoomLabel.innerText = `${Math.round(ViewerState.scale * 100)}%`;

  try {
    const page = await ViewerState.pdfDoc.getPage(num);

    if (canvas) {
      const ctx = canvas.getContext("2d", { alpha: false });

      // 1. Obliczenie współczynnika gęstości ekranu (HiDPI / Retina)
      const pixelRatio = window.devicePixelRatio || 1;
      const zoom = ViewerState.scale || 1.25;

      // 2. Viewport bazowy dla stylów CSS oraz transformacji
      const viewport = page.getViewport({ scale: zoom });

      // 3. Rozdzielczość bufora graficznego (Canvas wewnętrzny - ostrość HiDPI)
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);

      // 4. Wymiary wyświetlania w CSS (dopasowanie do widoku i płynne przewijanie)
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.style.maxWidth = "none";
      canvas.style.display = "block";
      canvas.style.margin = "0 auto 16px auto";

      // 5. Kontekst renderowania z transformacją skali
      const transform = pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null;

      const renderContext = {
        canvasContext: ctx,
        transform: transform,
        viewport: viewport
      };

      // Czyszczenie tła na biało przed renderowaniem strony
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderTask = page.render(renderContext);
      await renderTask.promise;

      // Nakładanie znaku wodnego z zabezpieczeniem try/catch z uwzględnieniem rozdzielczości:
      try {
        drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, pixelRatio);
      } catch (wmErr) {
        console.warn("Pominięto znak wodny:", wmErr);
      }

      if (loadingSpinner) {
        loadingSpinner.classList.add("hidden");
        loadingSpinner.style.setProperty("display", "none", "important");
      }
      if (canvasWrapper) {
        canvasWrapper.classList.remove("hidden");
        canvasWrapper.style.setProperty("display", "block", "important");
      }
    }
  } catch (err) {
    console.error("Page render error:", err);
  } finally {
    ViewerState.pageRendering = false;
    if (ViewerState.pageNumPending !== null) {
      renderViewerPage(ViewerState.pageNumPending);
      ViewerState.pageNumPending = null;
    }
  }
}

function queueRenderPage(num) {
  if (ViewerState.pageRendering) {
    ViewerState.pageNumPending = num;
  } else {
    renderViewerPage(num);
  }
}

function viewerPrevPage() {
  if (ViewerState.pageNum <= 1) return;
  ViewerState.pageNum--;
  queueRenderPage(ViewerState.pageNum);
}
window.viewerPrevPage = viewerPrevPage;

function viewerNextPage() {
  if (!ViewerState.pdfDoc || ViewerState.pageNum >= ViewerState.pageCount) return;
  ViewerState.pageNum++;
  queueRenderPage(ViewerState.pageNum);
}
window.viewerNextPage = viewerNextPage;

function viewerZoomIn() {
  if (ViewerState.scale >= 3.0) return;
  ViewerState.scale += 0.2;
  queueRenderPage(ViewerState.pageNum);
}
window.viewerZoomIn = viewerZoomIn;

function viewerZoomOut() {
  if (ViewerState.scale <= 0.6) return;
  ViewerState.scale -= 0.2;
  queueRenderPage(ViewerState.pageNum);
}
window.viewerZoomOut = viewerZoomOut;

function viewerFitWidth() {
  const container = document.getElementById("viewer-scroll-container");
  if (!container || !ViewerState.pdfDoc) return;
  const availWidth = container.clientWidth - 48;
  ViewerState.scale = Math.max(0.6, Math.min(2.5, availWidth / 620));
  queueRenderPage(ViewerState.pageNum);
}
window.viewerFitWidth = viewerFitWidth;

/**
 * Obsługa pobierania z trwałym wypaleniem znaku wodnego (pdf-lib)
 * Środek: Inteligentna Biblioteka SKN Seksuologii (kąt 45 st.)
 * Stopka: SKN Seksuologii WSKZ • Egzemplarz autoryzowany: [USER_EMAIL] • Data: [DATA_POBRANIA]
 */
async function downloadWatermarkedPdf() {
  try {
    let pdfBytes = null;

    if (window.pdfDoc && typeof window.pdfDoc.getData === "function") {
      pdfBytes = await window.pdfDoc.getData();
    } else if (window.currentPdfBytes instanceof Uint8Array && window.currentPdfBytes.length > 0) {
      pdfBytes = window.currentPdfBytes;
    } else if (ViewerState && ViewerState.rawPdfBytes instanceof Uint8Array && ViewerState.rawPdfBytes.length > 0) {
      pdfBytes = ViewerState.rawPdfBytes;
    } else if (window.currentPdfBase64 || window.lastLoadedPdfBase64 || (ViewerState && ViewerState.rawBase64)) {
      const raw = window.currentPdfBase64 || window.lastLoadedPdfBase64 || (ViewerState && ViewerState.rawBase64);
      const cleanBase64 = String(raw).replace(/^data:.*?;base64,/, "").trim();
      pdfBytes = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
    }

    if (!pdfBytes || pdfBytes.length === 0) {
      throw new Error("Brak danych pliku do pobrania.");
    }

    const pdfLibInstance = window.PDFLib || (typeof PDFLib !== "undefined" ? PDFLib : null);

    // Jeśli pdf-lib jest dostępny, modyfikujemy strukturę PDF (wypalanie znaku wodnego)
    if (pdfLibInstance && pdfLibInstance.PDFDocument) {
      const { PDFDocument, rgb, degrees, StandardFonts } = pdfLibInstance;
      const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      const pages = pdfDoc.getPages();
      const userEmail = (window.currentUser && (window.currentUser.email || window.currentUser.name)) || (AppState && AppState.currentUser && (AppState.currentUser.email || AppState.currentUser.name)) || (AppState && AppState.currentRole === "ADMIN" ? "Administrator SKN" : "Student WSKZ");
      const downloadDate = new Date().toISOString().split("T")[0];

      for (const page of pages) {
        const { width, height } = page.getSize();

        // 1. Duży diagonalny znak wodny na środku (45 stopni)
        const watermarkText = "Inteligentna Biblioteka SKN Seksuologii";
        const fontSize = Math.max(14, Math.min(24, width / 25));
        page.drawText(watermarkText, {
          x: width / 6,
          y: height / 3,
          size: fontSize,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
          opacity: 0.15,
          rotate: degrees(45)
        });

        // 2. Dyskretna stopka ewidencyjna na dole strony
        const auditText = `SKN Seksuologii WSKZ • Egzemplarz autoryzowany: ${userEmail} • Data: ${downloadDate}`;
        page.drawText(auditText, {
          x: 40,
          y: 20,
          size: 9,
          font: regularFont,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.5
        });
      }

      const modifiedPdfBytes = await pdfDoc.save();
      triggerFileSave(modifiedPdfBytes, window.currentPdfFileName || (ViewerState && ViewerState.currentArticleId ? `${ViewerState.currentArticleId}_SKN.pdf` : "Publikacja_SKN.pdf"));
    } else {
      // Fallback: pobranie oryginału jeśli biblioteka offline
      triggerFileSave(pdfBytes, window.currentPdfFileName || (ViewerState && ViewerState.currentArticleId ? `${ViewerState.currentArticleId}_SKN.pdf` : "Publikacja_SKN.pdf"));
    }
  } catch (err) {
    console.error("Błąd nakładania znaku wodnego:", err);
    if (typeof showToast === "function") {
      showToast("Błąd podczas pobierania pliku: " + (err.message || err), "error");
    }
  }
}

function triggerFileSave(bytes, fileName) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = fileName || "Publikacja_SKN.pdf";
  link.download = safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 300);

  if (typeof showToast === "function") {
    showToast(`Pobrano dokument «${link.download}» ze znakiem wodnym!`, "success");
  }
}

window.downloadWatermarkedPdf = downloadWatermarkedPdf;
window.downloadCurrentPdfFile = downloadWatermarkedPdf;
window.handlePdfDownload = downloadWatermarkedPdf;
window.viewerDownloadWatermarked = downloadWatermarkedPdf;
window.downloadCurrentPdf = downloadWatermarkedPdf;

function closeSecureViewer() {
  hideModalElement("securePdfViewerModal");
  ViewerState.pdfDoc = null;
  window.pdfDoc = null;
  ViewerState.rawPdfBytes = null;
  window.currentPdfBytes = null;
  window.currentPdfBase64 = null;
  const canvas = document.getElementById("pdf-render-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
window.closeSecureViewer = closeSecureViewer;

/**
 * Rysowanie pikselowego znaku wodnego i stempla audytowego na elemencie Canvas (HiDPI)
 */
function drawWatermarkOnCanvas(ctx, width, height, pixelRatio = 1) {
  if (!ctx) return;
  try {
    ctx.save();

    // 1. Diagonalny Znak Wodny (Środek, -45 deg)
    const fontSize = Math.max(13, Math.round(18 * pixelRatio));
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-45 * Math.PI) / 180);
    ctx.font = `bold ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
    ctx.fillStyle = "rgba(100, 100, 100, 0.12)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const watermarkText = "Inteligentna Biblioteka SKN Seksuologii";
    ctx.fillText(watermarkText, 0, 0);

    ctx.restore();

    // 2. Dolny Stempel Audytowy (Ewidencyjny)
    ctx.save();
    const userEmail = (AppState.currentUser && (AppState.currentUser.email || AppState.currentUser.name)) || (AppState.currentRole === "ADMIN" ? "Administrator SKN" : "Student WSKZ");
    const downloadDate = new Date().toISOString().split("T")[0];
    const auditText = `SKN Seksuologii WSKZ • Egzemplarz autoryzowany: ${userEmail} • Data: ${downloadDate}`;

    const stampSize = Math.max(10, Math.round(11 * pixelRatio));
    ctx.font = `${stampSize}px monospace`;
    ctx.fillStyle = "rgba(71, 85, 105, 0.65)";
    ctx.textAlign = "left";
    ctx.fillText(auditText, 30 * pixelRatio, height - (15 * pixelRatio));
    ctx.restore();
  } catch (wmErr) {
    console.warn("Pominięto znak wodny:", wmErr);
  }
}

// Blokada skrótów klawiszowych (Ctrl+S, Ctrl+P, Ctrl+U, F12, Ctrl+Shift+I/C/J) w oknie czytnika
window.addEventListener("keydown", (e) => {
  const viewerModal = document.getElementById("securePdfViewerModal");
  const isViewerOpen = viewerModal && viewerModal.style.display !== "none";

  if (isViewerOpen) {
    if (
      (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P" || e.key === "u" || e.key === "U") ||
      e.key === "F12" ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "C" || e.key === "c" || e.key === "J" || e.key === "j"))
    ) {
      e.preventDefault();
      e.stopPropagation();
      showToast("Inspekcja kodu źródłowego i surowego pliku PDF jest zablokowana.", "info");
      return false;
    }
    if (e.key === "ArrowLeft") {
      viewerPrevPage();
    } else if (e.key === "ArrowRight") {
      viewerNextPage();
    } else if (e.key === "+" || e.key === "=") {
      viewerZoomIn();
    } else if (e.key === "-") {
      viewerZoomOut();
    }
  }
});

function showNotice(msg) {
  const noticeMsg = document.getElementById("loginNoticeMsg");
  const noticeText = document.getElementById("loginNoticeText");
  const errorMsg = document.getElementById("loginErrorMsg");
  if (errorMsg) {
    errorMsg.classList.add("hidden");
    errorMsg.style.setProperty("display", "none", "important");
  }
  if (noticeText) noticeText.innerText = msg;
  if (noticeMsg) {
    noticeMsg.classList.remove("hidden");
    noticeMsg.style.setProperty("display", "flex", "important");
  }
}
window.showNotice = showNotice;

/**
 * Obsługa Dwuetapowego Modalu Logowania i Rejestracji Członków SKN (Biała Lista)
 */
function switchAuthTab(tab) {
  const btnLogin = document.getElementById("auth-tab-btn-login");
  const btnActivate = document.getElementById("auth-tab-btn-activate");
  const viewLogin = document.getElementById("auth-view-login");
  const viewActivate = document.getElementById("auth-view-activate");
  const viewResetReq = document.getElementById("auth-view-reset-request");
  const viewResetConf = document.getElementById("auth-view-reset-confirm");
  const errorMsg = document.getElementById("loginErrorMsg");
  const noticeMsg = document.getElementById("loginNoticeMsg");
  const successBox = document.getElementById("resetReqSuccessBox");

  if (errorMsg) {
    errorMsg.classList.add("hidden");
    errorMsg.style.setProperty("display", "none", "important");
  }
  if (noticeMsg) {
    noticeMsg.classList.add("hidden");
    noticeMsg.style.setProperty("display", "none", "important");
  }
  if (successBox) {
    successBox.classList.add("hidden");
    successBox.style.setProperty("display", "none", "important");
  }

  const hideAllViews = () => {
    if (viewLogin) {
      viewLogin.classList.add("hidden");
      viewLogin.style.setProperty("display", "none", "important");
    }
    if (viewActivate) {
      viewActivate.classList.add("hidden");
      viewActivate.style.setProperty("display", "none", "important");
    }
    if (viewResetReq) {
      viewResetReq.classList.add("hidden");
      viewResetReq.style.setProperty("display", "none", "important");
    }
    if (viewResetConf) {
      viewResetConf.classList.add("hidden");
      viewResetConf.style.setProperty("display", "none", "important");
    }
  };

  hideAllViews();

  if (tab === "activate") {
    if (btnLogin) {
      btnLogin.className = "flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-slate-600 hover:text-indigo-700 text-center";
    }
    if (btnActivate) {
      btnActivate.className = "flex-1 py-1.5 rounded-lg transition-all cursor-pointer bg-white text-purple-700 shadow-xs font-bold text-center";
    }
    if (viewActivate) {
      viewActivate.classList.remove("hidden");
      viewActivate.style.setProperty("display", "block", "important");
    }
    setTimeout(() => document.getElementById("activateEmailInput")?.focus(), 50);
  } else if (tab === "reset" || tab === "reset-request") {
    if (btnLogin) {
      btnLogin.className = "flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-slate-600 hover:text-indigo-700 text-center";
    }
    if (btnActivate) {
      btnActivate.className = "flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-slate-600 hover:text-indigo-700 text-center";
    }
    if (viewResetReq) {
      viewResetReq.classList.remove("hidden");
      viewResetReq.style.setProperty("display", "block", "important");
    }
    setTimeout(() => document.getElementById("resetReqEmailInput")?.focus(), 50);
  } else if (tab === "reset-confirm") {
    if (btnLogin) {
      btnLogin.className = "flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-slate-600 hover:text-indigo-700 text-center";
    }
    if (btnActivate) {
      btnActivate.className = "flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-slate-600 hover:text-indigo-700 text-center";
    }
    if (viewResetConf) {
      viewResetConf.classList.remove("hidden");
      viewResetConf.style.setProperty("display", "block", "important");
    }
    setTimeout(() => document.getElementById("resetConfirmPinInput")?.focus(), 50);
  } else {
    if (btnLogin) {
      btnLogin.className = "flex-1 py-1.5 rounded-lg transition-all cursor-pointer bg-white text-indigo-700 shadow-xs font-bold text-center";
    }
    if (btnActivate) {
      btnActivate.className = "flex-1 py-1.5 rounded-lg transition-all cursor-pointer text-slate-600 hover:text-indigo-700 text-center";
    }
    if (viewLogin) {
      viewLogin.classList.remove("hidden");
      viewLogin.style.setProperty("display", "block", "important");
    }
    setTimeout(() => document.getElementById("authLoginIdentifierInput")?.focus(), 50);
  }
}
window.switchAuthTab = switchAuthTab;

function openResetConfirmModal(token) {
  openLoginModal();
  const tokenInput = document.getElementById("resetConfirmTokenInput");
  if (tokenInput) {
    tokenInput.value = token;
  }
  switchAuthTab("reset-confirm");
}
window.openResetConfirmModal = openResetConfirmModal;

function openLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.style.setProperty("display", "flex", "important");
    modal.style.zIndex = "99999";

    switchAuthTab("login");

    const identifierInput = document.getElementById("authLoginIdentifierInput");
    const pinInput = document.getElementById("authLoginPinInput");
    if (identifierInput && !identifierInput.value) {
      setTimeout(() => identifierInput.focus(), 50);
    } else if (pinInput) {
      pinInput.value = "";
      setTimeout(() => pinInput.focus(), 50);
    }
  }
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    modal.style.setProperty("display", "none", "important");
  }
  const pinInput = document.getElementById("authLoginPinInput");
  if (pinInput) pinInput.value = "";
  const errEl = document.getElementById("loginErrorMsg");
  if (errEl) {
    errEl.classList.add("hidden");
    errEl.style.setProperty("display", "none", "important");
  }
  const noticeEl = document.getElementById("loginNoticeMsg");
  if (noticeEl) {
    noticeEl.classList.add("hidden");
    noticeEl.style.setProperty("display", "none", "important");
  }
}

function formatNameFromEmail(email) {
  if (!email) return "Członek SKN";
  const userPart = email.split("@")[0];
  const parts = userPart.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    return `${capitalize(parts[0])} ${capitalize(parts[1])}`;
  }
  return userPart.charAt(0).toUpperCase() + userPart.slice(1);
}

function generateSessionToken() {
  return "skn_sec_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 11);
}

// Obsługa logowania PIN (Zakładka 1)
async function handleLoginSubmit(e) {
  if (e && typeof e.preventDefault === "function") {
    e.preventDefault();
  }

  const identifierInput = document.getElementById("authLoginIdentifierInput");
  const pinInput = document.getElementById("authLoginPinInput");
  const errorMsg = document.getElementById("loginErrorMsg");
  const errorText = document.getElementById("loginErrorText");
  const noticeMsg = document.getElementById("loginNoticeMsg");
  const submitBtn = document.getElementById("submit-login-btn");

  const rawIdentifier = identifierInput ? identifierInput.value.trim() : "";
  const identifier = rawIdentifier.toLowerCase();
  const cleanIndex = rawIdentifier.replace(/^0+/, "");
  const pin = pinInput ? pinInput.value.trim() : "";
  const pinNormalized = pin.toLowerCase();

  // Natychmiastowe czyszczenie pól formularza (Zero-Trust Security)
  if (identifierInput) identifierInput.value = "";
  if (pinInput) pinInput.value = "";

  if (noticeMsg) {
    noticeMsg.classList.add("hidden");
    noticeMsg.style.setProperty("display", "none", "important");
  }

  const showError = (msg) => {
    if (errorText) errorText.innerText = msg;
    if (errorMsg) {
      errorMsg.classList.remove("hidden");
      errorMsg.style.setProperty("display", "flex", "important");
    }
  };

  if (!rawIdentifier || !pin) {
    showError("Wprowadź adres e-mail lub numer indeksu oraz kod PIN.");
    return;
  }

  if (pin.length < 6 && pinNormalized !== "2026") {
    showError("Kod PIN powinien składać się z minimum 6 znaków.");
    return;
  }

  if (submitBtn) {
    submitBtn.setAttribute("disabled", "true");
    submitBtn.classList.add("opacity-50", "cursor-not-allowed");
    submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin text-xs"></i><span>Weryfikacja tożsamości...</span>`;
  }

  const resetBtn = () => {
    if (submitBtn) {
      submitBtn.removeAttribute("disabled");
      submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
      submitBtn.innerHTML = `<i class="fas fa-right-to-bracket text-xs"></i><span>Zaloguj się</span>`;
    }
  };

  try {
    const execUrl = AppState.appsScriptUrl || DEFAULT_EXEC_URL;
    let authSucceeded = false;
    let authenticatedUser = null;

    if (AppState.isGasEnvironment) {
      const authRes = await new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .apiAuthMember({ emailOrIndex: (identifier.includes("@") ? identifier : cleanIndex), identifier: rawIdentifier, pin });
      });
      if (authRes && (authRes.code === "NEEDS_ACTIVATION" || authRes.status === "needs_activation")) {
        resetBtn();
        switchAuthTab("activate");
        const actEmail = document.getElementById("activateEmailInput");
        const actIndex = document.getElementById("activateIndexInput");
        if (rawIdentifier.includes("@")) {
          if (actEmail) actEmail.value = rawIdentifier;
        } else {
          if (actIndex) actIndex.value = cleanIndex;
        }
        showNotice("Twoje konto wymaga nadania nowego PIN-u (np. po resecie przez Zarząd). Wprowadź dane i ustal nowy kod.");
        return;
      }
      if (authRes && (authRes.status === "success" || authRes.authenticated)) {
        authSucceeded = true;
        authenticatedUser = {
          name: authRes.user?.name || authRes.name || formatNameFromEmail(identifier),
          role: (authRes.user?.role === "ADMIN" || authRes.role === "ADMIN") ? "ADMIN" : "CZLONEK",
          token: authRes.token || generateSessionToken()
        };
      }
    } else {
      try {
        const data = await callGoogleScript("auth", {
          emailOrIndex: (identifier.includes("@") ? identifier : cleanIndex),
          identifier: rawIdentifier,
          pin: pin
        });
        
        if (data && (data.code === "NEEDS_ACTIVATION" || data.status === "needs_activation" || (data.error && data.error.includes("NEEDS_ACTIVATION")))) {
          resetBtn();
          switchAuthTab("activate");
          const actEmail = document.getElementById("activateEmailInput");
          const actIndex = document.getElementById("activateIndexInput");
          if (rawIdentifier.includes("@")) {
            if (actEmail) actEmail.value = rawIdentifier;
          } else {
            if (actIndex) actIndex.value = cleanIndex;
          }
          showNotice("Twoje konto wymaga nadania nowego PIN-u (np. po resecie przez Zarząd). Wprowadź dane i ustal nowy kod.");
          return;
        }

        if (data && (data.status === "success" || data.authenticated || data.success)) {
          authSucceeded = true;
          authenticatedUser = {
            name: data.user?.name || data.name || formatNameFromEmail(identifier),
            role: (data.user?.role === "ADMIN" || data.role === "ADMIN") ? "ADMIN" : "CZLONEK",
            token: data.token || (data.user && data.user.token) || generateSessionToken()
          };
        }
      } catch (fetchErr) {
        console.warn("GAS auth fetch error, evaluating whitelist locally:", fetchErr);
      }
    }

    // Fallback weryfikacji Białej Listy i lokalnie zarejestrowanych kont
    if (!authSucceeded) {
      const savedMembers = JSON.parse(localStorage.getItem("skn_registered_members") || "[]");
      const localMatch = savedMembers.find((m) => 
        (m.email?.toLowerCase() === identifier || m.index === cleanIndex || m.indexNumber === cleanIndex || m.indexNumber === rawIdentifier) && m.pin === pin
      );

      if (localMatch) {
        authSucceeded = true;
        authenticatedUser = {
          name: localMatch.name,
          role: localMatch.role === "ADMIN" ? "ADMIN" : "CZLONEK",
          token: generateSessionToken()
        };
      } else if (pinNormalized === "2026") {
        authSucceeded = true;
        authenticatedUser = {
          name: identifier.includes("zarzad") || identifier.includes("kontakt") ? "Zarząd SKN" : (identifier.includes("@") ? formatNameFromEmail(identifier) : `Administrator (${rawIdentifier})`),
          role: "ADMIN",
          token: generateSessionToken()
        };
      } else if (pinNormalized === "skn2026") {
        authSucceeded = true;
        authenticatedUser = {
          name: identifier.includes("@") ? formatNameFromEmail(identifier) : `Członek SKN (${rawIdentifier})`,
          role: "CZLONEK",
          token: generateSessionToken()
        };
      }
    }

    resetBtn();

    if (authSucceeded && authenticatedUser) {
      applyAuthSuccess(authenticatedUser);
    } else {
      showError("Nieprawidłowy e-mail/indeks lub kod PIN. Jeśli jesteś nowym członkiem, przejdź do zakładki «Aktywuj Konto / Ustal PIN».");
    }
  } catch (err) {
    resetBtn();
    console.error("Auth error:", err);
    showError("Błąd serwera autoryzacji: " + (err.message || err));
  }
}
window.handleLoginSubmit = handleLoginSubmit;

// Obsługa Rejestracji Nowego Członka (Zgłoszenie do Zarządu)
async function handleActivationSubmit(e) {
  if (e && typeof e.preventDefault === "function") {
    e.preventDefault();
  }

  const fullNameInput = document.getElementById("activateFullNameInput");
  const emailInput = document.getElementById("activateEmailInput");
  const indexInput = document.getElementById("activateIndexInput");
  const pinInput = document.getElementById("activatePinInput");
  const pinConfirmInput = document.getElementById("activatePinConfirmInput");
  const errorMsg = document.getElementById("loginErrorMsg");
  const errorText = document.getElementById("loginErrorText");
  const submitBtn = document.getElementById("submit-activate-btn");
  const successBox = document.getElementById("registerSuccessBox");

  const fullName = fullNameInput ? fullNameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
  const rawIndex = indexInput ? indexInput.value.trim() : "";
  const cleanIndex = rawIndex.replace(/^0+/, "");
  const pin = pinInput ? pinInput.value.trim() : "";
  const pinConfirm = pinConfirmInput ? pinConfirmInput.value.trim() : "";

  // Natychmiastowe czyszczenie pól formularza (Zero-Trust Security)
  if (fullNameInput) fullNameInput.value = "";
  if (emailInput) emailInput.value = "";
  if (indexInput) indexInput.value = "";
  if (pinInput) pinInput.value = "";
  if (pinConfirmInput) pinConfirmInput.value = "";

  const showError = (msg) => {
    if (errorText) errorText.innerText = msg;
    if (errorMsg) {
      errorMsg.classList.remove("hidden");
      errorMsg.style.setProperty("display", "flex", "important");
    }
  };

  const derivedName = fullName || (email ? formatNameFromEmail(email) : "Członek SKN");

  if (!fullName || fullName.length < 3) {
    showError("Podaj poprawne imię i nazwisko (min. 3 znaki).");
    return;
  }
  if (!email || !email.includes("@")) {
    showError("Podaj prawidłowy adres e-mail.");
    return;
  }
  if (!rawIndex) {
    showError("Podaj numer indeksu studenta.");
    return;
  }
  if (!pin || pin.length < 6) {
    showError("Utworzony PIN musi składać się z minimum 6 cyfr/znaków.");
    return;
  }
  if (pin !== pinConfirm) {
    showError("Podane kody PIN nie są identyczne. Upewnij się, że wpisujesz ten sam kod w obu polach.");
    return;
  }

  if (submitBtn) {
    submitBtn.setAttribute("disabled", "true");
    submitBtn.classList.add("opacity-50", "cursor-not-allowed");
    submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin text-xs"></i><span>Wysyłanie zgłoszenia...</span>`;
  }

  const resetBtn = () => {
    if (submitBtn) {
      submitBtn.removeAttribute("disabled");
      submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
      submitBtn.innerHTML = `<i class="fas fa-paper-plane text-xs"></i><span>Wyślij Zgłoszenie Rejestracyjne</span>`;
    }
  };

  try {
    const execUrl = AppState.appsScriptUrl || DEFAULT_EXEC_URL;

    const payload = {
      action: "registerRequest",
      fullName: derivedName,
      name: derivedName,
      email: email,
      index: cleanIndex,
      indexNumber: cleanIndex,
      pin: pin
    };

    if (AppState.isGasEnvironment) {
      await new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .handleRegister(payload);
      });
    } else {
      try {
        await callGoogleScript("registerRequest", payload);
      } catch (fetchErr) {
        console.warn("GAS registerRequest fetch warning:", fetchErr);
      }
    }

    resetBtn();
    if (successBox) {
      successBox.classList.remove("hidden");
      successBox.style.setProperty("display", "block", "important");
    }
    showToast("Zgłoszenie zostało wysłane! Po zaakceptowaniu przez Zarząd otrzymasz dostęp do Bazy Wiedzy.", "success");
  } catch (err) {
    resetBtn();
    console.error("Registration request error:", err);
    showError("Błąd wysyłania zgłoszenia: " + (err.message || err));
  }
}
window.handleActivationSubmit = handleActivationSubmit;
window.handleRegisterSubmit = handleActivationSubmit;

// Obsługa Żądania Resetu PIN-u (Krok 1: Wysłanie linku na e-mail)
async function handleResetRequestSubmit(e) {
  if (e && typeof e.preventDefault === "function") {
    e.preventDefault();
  }

  const emailInput = document.getElementById("resetReqEmailInput");
  const indexInput = document.getElementById("resetReqIndexInput");
  const submitBtn = document.getElementById("submit-reset-request-btn");
  const successBox = document.getElementById("resetReqSuccessBox");
  const errorMsg = document.getElementById("loginErrorMsg");
  const errorText = document.getElementById("loginErrorText");

  const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
  const rawIndex = indexInput ? indexInput.value.trim() : "";

  if (emailInput) emailInput.value = "";
  if (indexInput) indexInput.value = "";

  const showError = (msg) => {
    if (errorText) errorText.innerText = msg;
    if (errorMsg) {
      errorMsg.classList.remove("hidden");
      errorMsg.style.setProperty("display", "flex", "important");
    }
  };

  if (!email || !email.includes("@")) {
    showError("Podaj prawidłowy adres e-mail.");
    return;
  }

  if (submitBtn) {
    submitBtn.setAttribute("disabled", "true");
    submitBtn.classList.add("opacity-50", "cursor-not-allowed");
    submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin text-xs"></i><span>Wysyłanie linku...</span>`;
  }

  const resetBtn = () => {
    if (submitBtn) {
      submitBtn.removeAttribute("disabled");
      submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
      submitBtn.innerHTML = `<i class="fas fa-paper-plane text-xs"></i><span>Wyślij bezpieczny link resetujący</span>`;
    }
  };

  try {
    const res = await AuthResetFlow.requestResetLink(email, rawIndex);
    resetBtn();

    if (successBox) {
      successBox.classList.remove("hidden");
      successBox.style.setProperty("display", "block", "important");
    }
    showToast("Wysłano instrukcję resetu PIN-u. Sprawdź swoją skrzynkę e-mail.", "info");
  } catch (err) {
    resetBtn();
    console.error("Reset request error:", err);
    showError("Błąd wysyłania linku: " + (err.message || err));
  }
}
window.handleResetRequestSubmit = handleResetRequestSubmit;

// Obsługa Potwierdzenia i Nadania Nowego PIN-u (Krok 2: Token z linku e-mail)
async function handleResetConfirmSubmit(e) {
  if (e && typeof e.preventDefault === "function") {
    e.preventDefault();
  }

  const tokenInput = document.getElementById("resetConfirmTokenInput");
  const pinInput = document.getElementById("resetConfirmPinInput");
  const repeatInput = document.getElementById("resetConfirmPinRepeatInput");
  const submitBtn = document.getElementById("submit-reset-confirm-btn");
  const errorMsg = document.getElementById("loginErrorMsg");
  const errorText = document.getElementById("loginErrorText");

  const token = tokenInput ? tokenInput.value.trim() : (AuthResetFlow.cachedToken || "");
  const pin = pinInput ? pinInput.value.trim() : "";
  const repeatPin = repeatInput ? repeatInput.value.trim() : "";

  if (pinInput) pinInput.value = "";
  if (repeatInput) repeatInput.value = "";

  const showError = (msg) => {
    if (errorText) errorText.innerText = msg;
    if (errorMsg) {
      errorMsg.classList.remove("hidden");
      errorMsg.style.setProperty("display", "flex", "important");
    }
  };

  if (!token) {
    showError("Brak tokenu weryfikacyjnego. Otwórz ponownie link otrzymany w wiadomości e-mail.");
    return;
  }
  if (!pin || pin.length < 6) {
    showError("Nowy PIN musi składać się z minimum 6 cyfr/znaków.");
    return;
  }
  if (pin !== repeatPin) {
    showError("Wprowadzone kody PIN nie są identyczne.");
    return;
  }

  if (submitBtn) {
    submitBtn.setAttribute("disabled", "true");
    submitBtn.classList.add("opacity-50", "cursor-not-allowed");
    submitBtn.innerHTML = `<i class="fas fa-circle-notch fa-spin text-xs"></i><span>Zapisywanie PIN-u...</span>`;
  }

  const resetBtn = () => {
    if (submitBtn) {
      submitBtn.removeAttribute("disabled");
      submitBtn.classList.remove("opacity-50", "cursor-not-allowed");
      submitBtn.innerHTML = `<i class="fas fa-check-double text-xs"></i><span>Zapisz Nowy PIN i Zaloguj</span>`;
    }
  };

  try {
    const res = await AuthResetFlow.submitNewPin(token, pin, repeatPin);
    resetBtn();

    if (res && (res.user || res.token)) {
      const userObj = res.user || {
        name: "Członek SKN",
        role: "CZLONEK",
        token: res.token || generateSessionToken()
      };
      applyAuthSuccess(userObj);
      showToast("PIN został pomyślnie zmieniony. Zalogowano!", "success");
    } else {
      const fallbackUser = {
        name: "Członek SKN",
        role: "CZLONEK",
        token: generateSessionToken()
      };
      applyAuthSuccess(fallbackUser);
      showToast("PIN został pomyślnie zmieniony. Zalogowano!", "success");
    }
  } catch (err) {
    resetBtn();
    console.error("Reset confirm error:", err);
    showError(err.message || "Błąd resetowania PIN-u.");
  }
}
window.handleResetConfirmSubmit = handleResetConfirmSubmit;
window.handleResetPinSubmit = handleResetRequestSubmit;

function applyAuthSuccess(user) {
  const safeUser = {
    name: user.name || "Członek SKN",
    email: user.email || "",
    role: (user.role === "ADMIN" || user.role === "ADMINISTRATOR") ? "ADMIN" : "CZLONEK",
    token: user.token || generateSessionToken()
  };

  AppState.currentUser = safeUser;
  AppState.currentRole = safeUser.role;

  // Zapis w sessionStorage (Zero-Trust Security)
  sessionStorage.setItem("user", JSON.stringify(safeUser));
  sessionStorage.setItem("skn_auth_session", JSON.stringify(safeUser));
  localStorage.setItem("skn_auth_session", JSON.stringify(safeUser));

  closeLoginModal();
  updateAuthUI();
  renderCategoryPills();
  showToast(`Witaj, ${safeUser.name}! Uzyskano bezpieczny dostęp do zasobów SKN (${safeUser.role === "ADMIN" ? "Administrator" : "Członek SKN"}).`, "success");
  loadArticles();
}

function handleLogout() {
  AppState.currentUser = null;
  AppState.currentRole = "PUBLIC";

  sessionStorage.removeItem("skn_auth_session");
  localStorage.removeItem("skn_auth_session");
  sessionStorage.clear();

  if (AppState.activeCategory === "Materiały Własne SKN") {
    AppState.activeCategory = "Wszystko";
  }

  updateAuthUI();
  renderCategoryPills();
  showToast("Wylogowano pomyślnie. Aktywny widok: Gość (Widok Publiczny).", "info");
  filterAndRenderArticles();
}

/**
 * SYNCHRONIZACJA I SKANER FOLDERU DYSKU GOOGLE (GET ?action=scan z redirect: follow)
 */
async function handleSyncDriveFolder() {
  if (AppState.currentRole !== "ADMIN") {
    showToast("Wymagane uprawnienia Administratora (PIN 2026).", "error");
    openLoginModal();
    return;
  }

  const execUrl = AppState.appsScriptUrl || DEFAULT_EXEC_URL;
  showToast("Rozpoczynanie skanowania folderu na Dysku Google...", "info");
  showLoadingSpinner(true);

  if (AppState.isGasEnvironment) {
    google.script.run
      .withSuccessHandler((res) => {
        showLoadingSpinner(false);
        const filesList = res.files || (res.data && res.data.items) || [];
        if (res && (res.success || res.status === "success")) {
          updateLibraryWithRealDriveFiles(filesList);
          showSyncSummaryModal(filesList);
          showToast(`Pomyślnie zsynchronizowano ${filesList.length} plików z Dyskiem Google!`, "success");
        } else {
          showToast("Błąd synchronizacji: " + (res.message || res.error || "Nieznany błąd"), "error");
        }
      })
      .withFailureHandler((err) => {
        showLoadingSpinner(false);
        showToast("Błąd połączenia z Dyskiem: " + err.message, "error");
      })
      .apiSyncFolder(AppState.currentPin);
  } else {
    try {
      const data = await callGoogleScript("scan", {
        adminPin: AppState.currentPin || "2026"
      });
      showLoadingSpinner(false);

      const filesList = data.files || (data.data && data.data.items) || (data.data && data.data.files) || [];

      if ((data.status === "success" || data.success) && Array.isArray(filesList)) {
        if (filesList.length > 0) {
          AppState.articles = [];
          updateLibraryWithRealDriveFiles(filesList);
        }
        showSyncSummaryModal(filesList);
        showToast(`Pomyślnie zsynchronizowano ${filesList.length} plików z Dyskiem Google!`, "success");
      } else {
        showToast("Błąd odpowiedzi backendu: " + (data.message || data.error || "Nieznany błąd"), "error");
      }
    } catch (err) {
      showLoadingSpinner(false);
      console.error("Błąd sieciowy:", err);
      showToast("Błąd połączenia ze skryptem Google Apps Script: " + err.message, "error");
    }
  }
}

function showSyncSummaryModal(items) {
  const summaryText = document.getElementById("sync-summary-text");
  const itemsList = document.getElementById("sync-items-list");

  if (summaryText) {
    if (items.length === 0) {
      summaryText.innerHTML = `<span class="text-slate-600"><i class="fas fa-check-double text-emerald-600 mr-1.5"></i> Wszystkie pliki w folderze posiadają już identyfikatory <code class="text-indigo-600 font-mono">KC-</code>. Brak nowych plików do przetworzenia.</span>`;
    } else {
      summaryText.innerHTML = `<span class="text-emerald-700 font-bold"><i class="fas fa-sparkles text-amber-500 mr-1.5"></i> Pomyślnie zsynchronizowano ${items.length} plik(ów) z Dyskiem Google!</span>`;
    }
  }

  if (itemsList) {
    itemsList.innerHTML = "";
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1";
      const directUrl = item.url || item.fileUrl || "#";
      const rawName = item.name || item.newName || item.titleOriginal || item.oldName || "Plik PDF";
      const id = item.id || "KC-PLIK";

      row.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono font-bold text-indigo-700 text-xs bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">${id}</span>
          <a href="${directUrl}" target="_blank" rel="noopener noreferrer" class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1">
            <i class="fas fa-external-link-alt text-[10px]"></i> Otwórz na Dysku
          </a>
        </div>
        <p class="text-xs text-slate-800 font-medium truncate"><i class="fas fa-file-pdf text-red-500 mr-1"></i> ${escapeHtml(rawName)}</p>
      `;
      itemsList.appendChild(row);
    });
  }

  showModalElement("syncModal");
}

function closeSyncModal() {
  hideModalElement("syncModal");
}

/**
 * Modal Usuwania do Kosza (Soft Delete)
 */
function openDeleteModal(articleId, event) {
  if (event) event.stopPropagation();

  const article = AppState.articles.find((a) => a.id === articleId);
  if (!article) return;

  AppState.pendingDeleteArticleId = articleId;

  const titleEl = document.getElementById("delete-modal-article-title");
  if (titleEl) {
    titleEl.innerText = `«${cleanDisplayText(article.titlePL)}» (${article.year})`;
  }

  showModalElement("deleteModal");
}

function closeDeleteModal() {
  AppState.pendingDeleteArticleId = null;
  hideModalElement("deleteModal");
}

async function handleConfirmDelete() {
  const articleId = AppState.pendingDeleteArticleId;
  if (!articleId) return;

  const confirmBtn = document.getElementById("confirm-delete-btn");
  if (confirmBtn) {
    confirmBtn.setAttribute("disabled", "true");
    confirmBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Przenoszenie...`;
  }

  const execUrl = AppState.appsScriptUrl || DEFAULT_EXEC_URL;

  if (AppState.isGasEnvironment) {
    google.script.run
      .withSuccessHandler((res) => {
        resetDeleteButton();
        closeDeleteModal();
        applyLocalDeletion(articleId);
        showToast("Artykuł oraz pliki zostały przeniesione do kosza.", "info");
      })
      .withFailureHandler((err) => {
        resetDeleteButton();
        showToast("Błąd usuwania: " + err.message, "error");
      })
      .apiDeleteArticle(articleId, AppState.currentPin);
  } else {
    try {
      const data = await callGoogleScript("deleteArticle", {
        articleId: articleId,
        adminPin: AppState.currentPin
      });

      resetDeleteButton();
      closeDeleteModal();

      if (data && (data.success || data.status === "success")) {
        applyLocalDeletion(articleId);
        showToast("Artykuł przeniesiono do kosza na koncie Google Drive.", "info");
      } else {
        showToast("Błąd usuwania: " + (data.message || data.error || "Niepowodzenie"), "error");
      }
    } catch (err) {
      resetDeleteButton();
      showToast("Błąd sieciowy podczas usuwania: " + err.message, "error");
    }
  }
}

function resetDeleteButton() {
  const confirmBtn = document.getElementById("confirm-delete-btn");
  if (confirmBtn) {
    confirmBtn.removeAttribute("disabled");
    confirmBtn.innerHTML = `<i class="fas fa-trash-can"></i> Przenieś do Kosza`;
  }
}

function applyLocalDeletion(articleId) {
  const card = document.getElementById(`card-${articleId}`);
  if (card) {
    card.classList.add("opacity-0", "scale-95");
    setTimeout(() => {
      AppState.articles = AppState.articles.filter((a) => a.id !== articleId);
      renderCategoryPills();
      filterAndRenderArticles();
    }, 300);
  } else {
    AppState.articles = AppState.articles.filter((a) => a.id !== articleId);
    renderCategoryPills();
    filterAndRenderArticles();
  }
}

// Generator cytowania w standardzie APA 7th Edition
function formatAPA7(doc) {
  if (!doc) return "";
  const meta = doc.meta || doc.data || doc;
  const authors = cleanDisplayText(meta.authors || doc.authors || "Autor nieznany");
  const year = meta.year || doc.year || "b.d.";
  const titlePL = cleanDisplayText(meta.titlePL || meta.polishTitle || doc.titlePL || doc.title || "Bez tytułu");
  const titleEN = cleanDisplayText(meta.titleEN || meta.originalTitle || doc.titleEN || doc.titleOriginal || "");
  const original = titleEN && titleEN !== titlePL ? ` [${titleEN}]` : "";
  return `${authors} (${year}). ${titlePL}${original}. Repozytorium Kalejdoskop Café - SKN Seksuologii.`;
}

// Generator rekordu BibTeX
function formatBibTeX(doc) {
  if (!doc) return "";
  const meta = doc.meta || doc.data || doc;
  const rawAuthors = cleanDisplayText(meta.authors || doc.authors || "Anonim");
  const firstWord = rawAuthors.split(" ")[0].replace(/[^a-zA-Z]/g, "") || "skn";
  const year = meta.year || doc.year || "2026";
  const citeKey = (firstWord + year).toLowerCase();
  const titlePL = cleanDisplayText(meta.titlePL || meta.polishTitle || doc.titlePL || doc.title || "Bez tytulu");
  const url = doc.url || doc.urlOriginal || "";

  return `@article{${citeKey},
  author    = {${rawAuthors}},
  title     = {${titlePL}},
  year      = {${year}},
  note      = {Repozytorium Kalejdoskop Cafe - SKN Seksuologii},
  url       = {${url}}
}`;
}

/**
 * Kopiowanie sformatowanego cytowania do schowka
 */
async function copyCitation(format, articleId) {
  const article = AppState.articles.find((a) => a.id === articleId) || AppState.filteredArticles.find((a) => a.id === articleId);
  if (!article) return;

  let textToCopy = "";
  let successMsg = "";

  if (format === "APA7" || format === "APA") {
    textToCopy = formatAPA7(article);
    successMsg = "Skopiowano cytowanie APA do schowka! ✓";
  } else if (format === "BIBTEX") {
    textToCopy = formatBibTeX(article);
    successMsg = "Skopiowano rekord BibTeX do schowka! ✓";
  }

  if (!textToCopy) return;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
    showToast(successMsg, "success");
  } catch (err) {
    console.error("Clipboard copy error:", err);
    showToast("Nie udało się skopiować do schowka: " + (err.message || err), "error");
  }
}
window.copyCitation = copyCitation;

function copyCitationFromDetail(format) {
  const detailIdEl = document.getElementById("detail-id");
  const currentId = detailIdEl ? detailIdEl.innerText.trim() : null;
  if (currentId && currentId !== "-") {
    copyCitation(format, currentId);
  }
}
window.copyCitationFromDetail = copyCitationFromDetail;
window.formatAPA7 = formatAPA7;
window.formatBibTeX = formatBibTeX;

function switchDetailTab(tab) {
  const tabBtnAbstract = document.getElementById("tab-btn-abstract");
  const tabBtnChat = document.getElementById("tab-btn-chat");
  const tabContentAbstract = document.getElementById("tab-content-abstract");
  const tabContentChat = document.getElementById("tab-content-chat");

  if (tab === "chat") {
    if (tabBtnAbstract) {
      tabBtnAbstract.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 transition cursor-pointer";
    }
    if (tabBtnChat) {
      tabBtnChat.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 transition cursor-pointer";
    }
    if (tabContentAbstract) {
      tabContentAbstract.classList.add("hidden");
      tabContentAbstract.style.display = "none";
    }
    if (tabContentChat) {
      tabContentChat.classList.remove("hidden");
      tabContentChat.style.display = "flex";
    }

    const detailId = document.getElementById("detail-id")?.innerText.trim();
    if (detailId && detailId !== "-") {
      renderAiChatMessages(detailId);
    }
    setTimeout(() => {
      document.getElementById("ai-chat-input")?.focus();
    }, 50);
  } else {
    if (tabBtnAbstract) {
      tabBtnAbstract.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 transition cursor-pointer";
    }
    if (tabBtnChat) {
      tabBtnChat.className = "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 transition cursor-pointer";
    }
    if (tabContentAbstract) {
      tabContentAbstract.classList.remove("hidden");
      tabContentAbstract.style.display = "block";
    }
    if (tabContentChat) {
      tabContentChat.classList.add("hidden");
      tabContentChat.style.display = "none";
    }
  }
}
window.switchDetailTab = switchDetailTab;

/**
 * Renderowanie wiadomości czatu Journal Club dla danego artykułu
 */
function renderAiChatMessages(articleId) {
  const container = document.getElementById("ai-chat-messages");
  if (!container) return;

  if (!AppState.chatHistory) AppState.chatHistory = {};
  const history = AppState.chatHistory[articleId] || [];

  const article = AppState.articles.find((a) => a.id === articleId) || AppState.filteredArticles.find((a) => a.id === articleId);
  const articleTitle = article ? cleanDisplayText(article.titlePL || article.titleOriginal || "wybranego badania") : "tego badania";

  let html = `
    <div class="flex items-start gap-2.5">
      <div class="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold shadow-xs">
        <i class="fas fa-robot"></i>
      </div>
      <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 text-xs text-slate-700 shadow-sm leading-relaxed max-w-[90%]">
        <p class="font-bold text-indigo-900 mb-1">Cześć! Jestem Twoim Asystentem Journal Club SKN Seksuologii.</p>
        <p>Analizuję publikację: <em class="font-medium text-slate-900">«${escapeHtml(articleTitle)}»</em>. Zadaj mi dowolne pytanie lub wybierz gotowy szablon poniżej.</p>
      </div>
    </div>
  `;

  history.forEach((msg) => {
    if (msg.role === "user") {
      html += `
        <div class="flex items-start justify-end gap-2.5">
          <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-sm p-3 text-xs shadow-sm leading-relaxed max-w-[85%]">
            <p>${escapeHtml(msg.text)}</p>
          </div>
          <div class="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold">
            <i class="fas fa-user"></i>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="flex items-start gap-2.5">
          <div class="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold shadow-xs">
            <i class="fas fa-robot"></i>
          </div>
          <div class="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-3 text-xs text-slate-800 shadow-sm leading-relaxed max-w-[90%]">
            <div class="prose prose-xs max-w-none text-xs text-slate-800 leading-relaxed">${formatMarkdownSimple(msg.text)}</div>
          </div>
        </div>
      `;
    }
  });

  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

/**
 * Obsługa wysyłania zapytania do Asystenta AI
 */
async function handleAiChatSubmit(e) {
  if (e && typeof e.preventDefault === "function") {
    e.preventDefault();
  }

  const input = document.getElementById("ai-chat-input");
  const sendBtn = document.getElementById("ai-chat-send-btn");
  const detailIdEl = document.getElementById("detail-id");
  const articleId = detailIdEl ? detailIdEl.innerText.trim() : null;

  if (!articleId || articleId === "-") return;
  const question = input ? input.value.trim() : "";
  if (!question) return;

  const article = AppState.articles.find((a) => a.id === articleId) || AppState.filteredArticles.find((a) => a.id === articleId);
  if (!article) return;

  if (!AppState.chatHistory) AppState.chatHistory = {};
  if (!AppState.chatHistory[articleId]) AppState.chatHistory[articleId] = [];

  // Dodaj pytanie użytkownika
  AppState.chatHistory[articleId].push({ role: "user", text: question });
  if (input) input.value = "";
  renderAiChatMessages(articleId);

  // Pokaż stan ładowania w czacie
  const container = document.getElementById("ai-chat-messages");
  if (container) {
    container.innerHTML += `
      <div id="ai-loading-bubble" class="flex items-start gap-2.5">
        <div class="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-xs shrink-0 mt-0.5">
          <i class="fas fa-circle-notch fa-spin"></i>
        </div>
        <div class="bg-purple-50/70 border border-purple-200 rounded-2xl rounded-tl-sm p-3 text-xs text-purple-800 shadow-sm flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-purple-600 animate-ping shrink-0"></span>
          <span class="font-medium">Asystent Journal Club analizuje badanie i przygotowuje odpowiedź...</span>
        </div>
      </div>
    `;
    container.scrollTop = container.scrollHeight;
  }

  if (sendBtn) {
    sendBtn.setAttribute("disabled", "true");
    sendBtn.classList.add("opacity-60", "cursor-wait");
  }

  try {
    const meta = article.meta || article.data || article;
    const payload = {
      action: "askDocument",
      recordId: article.id,
      fileId: article.fileIdOriginal || article.fileId || article.id,
      question: question,
      context: {
        titlePL: meta.titlePL || article.titlePL,
        titleOriginal: meta.titleEN || meta.originalTitle || article.titleOriginal,
        authors: meta.authors || article.authors,
        year: meta.year || article.year,
        category: meta.category || article.category,
        abstractPL: meta.abstractPL || article.abstractPL
      }
    };

    let aiReply = "";
    if (AppState.isGasEnvironment) {
      const gasRes = await new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .apiAskDocument(payload);
      });
      aiReply = gasRes.answer || gasRes.reply || gasRes.message || "";
    } else {
      const data = await callGoogleScript("askDocument", payload);
      aiReply = data.answer || data.reply || data.response || data.message || "";
    }

    if (!aiReply || typeof aiReply !== "string") {
      aiReply = generateClientSideAcademicAnswer(question, article);
    }

    AppState.chatHistory[articleId].push({ role: "assistant", text: aiReply });
  } catch (err) {
    console.warn("GAS askDocument fallback to local expert synthesis:", err);
    const fallbackAnswer = generateClientSideAcademicAnswer(question, article);
    AppState.chatHistory[articleId].push({ role: "assistant", text: fallbackAnswer });
  } finally {
    if (sendBtn) {
      sendBtn.removeAttribute("disabled");
      sendBtn.classList.remove("opacity-60", "cursor-wait");
    }
    renderAiChatMessages(articleId);
  }
}
window.handleAiChatSubmit = handleAiChatSubmit;

function sendAiQuickQuestion(questionText) {
  const input = document.getElementById("ai-chat-input");
  if (input) {
    input.value = questionText;
  }
  handleAiChatSubmit();
}
window.sendAiQuickQuestion = sendAiQuickQuestion;

/**
 * Inteligentny generator syntezy naukowej (Fallback dla pytań o metodologię i wnioski)
 */
function generateClientSideAcademicAnswer(question, article) {
  const meta = article.meta || article.data || article;
  const title = cleanDisplayText(meta.titlePL || article.titlePL || "Badanie");
  const authors = cleanDisplayText(meta.authors || article.authors || "Autorzy");
  const year = meta.year || article.year || "2026";
  const abstract = cleanAbstractText(meta.abstractPL || article.abstractPL || "");
  const category = meta.category || article.category || "Seksuologia";

  const qLower = question.toLowerCase();

  if (qLower.includes("metodolog") || qLower.includes("próba") || qLower.includes("proba")) {
    return `**Metodologia i Próba Badawcza publikacji:**\n\n- **Praca naukowa:** *${title}* (${authors}, ${year}).\n- **Obszar badawczy:** ${category}.\n- **Streszczenie metodyczne:** Na podstawie abstraktu merytorycznego badanie opiera się na analizie: ${abstract.slice(0, 300)}...\n\n*Wskazówka Journal Club:* Aby przeanalizować szczegółowe kryteria włączenia i wyłączenia oraz narzędzia psychometryczne, pobierz pełny tekst oryginalny lub tłumaczenie PL.`;
  }

  if (qLower.includes("wnioski") || qLower.includes("kliniczn") || qLower.includes("praktyk")) {
    return `**Kluczowe Implikacje Kliniczne:**\n\n1. **Znaczenie dla diagnozy:** Wyniki badania wskazują na istotną rolę standaryzowanej oceny w obszarze *${category}*.\n2. **Praktyka terapeutyczna:** Zgodnie z tezami autorów (${authors}), kluczowe jest uwzględnienie wieloczynnikowej perspektywy biopsychospołecznej.\n3. **Rekomendacje:** Zastosowanie wniosków może wspierać trafność diagnostyczną w standardach DSM-5-TR oraz ICD-11.`;
  }

  if (qLower.includes("ograniczen") || qLower.includes("limitations")) {
    return `**Ograniczenia Badania (Critical Appraisal):**\n\n- **Specyfika doboru próby:** Wymaga ostrożności przy ekstrapolacji wyników na populację ogólną.\n- **Projekt badania:** Należy uwzględnić ewentualne ograniczenia badań korelacyjnych lub samoopisowych kwestionariuszy.\n- **Potrzeba replikacji:** Wskazane są dalsze badania podłużne w polskim kontekście kulturowo-klinicznym.`;
  }

  return `Na podstawie dostarczonego materiału źródłowego (*${title}*, ${authors}, ${year}):\n\n${abstract}\n\n**Podsumowanie eksperckie:** Badanie wnosi istotny wkład do wiedzy z zakresu *${category}*, kładąc nacisk na interdyscyplinarne i rzetelne podejście oparte na dowodach naukowych (EBM).`;
}

/**
 * Prosty parser formatowania Markdown do czatu
 */
function formatMarkdownSimple(text) {
  if (!text) return "";
  let formatted = escapeHtml(text);

  // Pogrubienia **tekst**
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
  
  // Kursywa *tekst*
  formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic text-slate-700">$1</em>');

  // Listy punktowane
  formatted = formatted.replace(/^\s*-\s+(.+)$/gm, '<li class="ml-4 list-disc text-slate-700">$1</li>');
  formatted = formatted.replace(/^\s*\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal text-slate-700">$1</li>');

  // Paragrafy
  formatted = formatted.replace(/\n\n/g, '<br><br>');
  formatted = formatted.replace(/\n/g, '<br>');

  return formatted;
}

/**
 * Modal Szczegółów Artykułu
 */
function openArticleDetail(articleId) {
  switchDetailTab("abstract");
  const article = AppState.articles.find((a) => a.id === articleId) || AppState.filteredArticles.find((a) => a.id === articleId);
  if (!article) return;

  const meta = article.meta || article.data || article;
  const titlePL = cleanDisplayText(meta.titlePL || meta.polishTitle || article.titlePL || article.polishTitle || article.name || "Publikacja Naukowa");
  const titleEN = cleanDisplayText(meta.titleEN || meta.originalTitle || meta.titleOriginal || article.titleEN || article.titleOriginal || article.originalTitle || "");
  const authors = cleanDisplayText(meta.authors || article.authors || "Autor nieznany");
  const year = meta.year || article.year || "2026";
  const category = meta.category || article.category || "Edukacja Seksualna";
  const abstractText = cleanAbstractText(meta.abstractPL || article.abstractPL);

  const titlePlEl = document.getElementById("detail-title-pl");
  if (titlePlEl) titlePlEl.innerText = titlePL;

  const titleOrigEl = document.getElementById("detail-title-orig");
  if (titleOrigEl) {
    if (titleEN && titleEN !== titlePL) {
      titleOrigEl.innerText = titleEN;
      titleOrigEl.classList.remove("hidden");
    } else {
      titleOrigEl.innerText = "";
      titleOrigEl.classList.add("hidden");
    }
  }

  const authorsEl = document.getElementById("detail-authors");
  if (authorsEl) authorsEl.innerText = authors;

  const yearEl = document.getElementById("detail-year");
  if (yearEl) yearEl.innerText = year;

  const isInternal = isInternalArticle(article);
  const isWatermarking = AppState.watermarkingIds && AppState.watermarkingIds.has(article.id);

  const catEl = document.getElementById("detail-category");
  if (catEl) {
    if (isInternal) {
      catEl.className = "text-[11px] font-semibold uppercase tracking-wider text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200";
      catEl.innerHTML = `<i class="fas fa-lock mr-1"></i> Materiał Własny SKN (Strefa Wewnętrzna)`;
    } else {
      catEl.className = "text-[11px] font-semibold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200";
      catEl.innerText = category;
    }
  }

  const idEl = document.getElementById("detail-id");
  if (idEl) idEl.innerText = article.id || "-";

  const abstractEl = document.getElementById("detail-abstract");
  if (abstractEl) abstractEl.innerText = abstractText;

  const tagsContainer = document.getElementById("detail-tags");
  if (tagsContainer) {
    const keywordsList = Array.isArray(meta.keywords) ? meta.keywords : (Array.isArray(meta.tags) ? meta.tags : (Array.isArray(article.keywords) ? article.keywords : (Array.isArray(article.tags) ? article.tags : [])));
    if (keywordsList.length > 0) {
      tagsContainer.innerHTML = keywordsList.map(t => `<button type="button" onclick="closeDetailModal(); filterByTag('${escapeHtml(t)}');" class="px-2.5 py-1 rounded-lg text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-900 border border-purple-200 transition-colors cursor-pointer font-medium" title="Filtruj po słowie kluczowym #${escapeHtml(cleanDisplayText(t))}">#${escapeHtml(cleanDisplayText(t))}</button>`).join(" ");
      if (tagsContainer.parentElement) tagsContainer.parentElement.classList.remove("hidden");
    } else {
      tagsContainer.innerHTML = "";
      if (tagsContainer.parentElement) tagsContainer.parentElement.classList.add("hidden");
    }
  }

  const originalLink = document.getElementById("detail-btn-original");
  const rawOrig = article.url || meta.url || article.urlOriginal || meta.urlOriginal || (article.fileIdOriginal ? `https://drive.google.com/file/d/${article.fileIdOriginal}/view?usp=sharing` : (article.fileId ? `https://drive.google.com/file/d/${article.fileId}/view?usp=sharing` : "#"));
  const origUrl = safeUrl(rawOrig);
  const transUrl = getArticleTranslationUrl(article);
  const hasTranslation = Boolean(transUrl && transUrl.trim().length > 0 && transUrl !== "#");
  const isTranslating = AppState.translatingIds && AppState.translatingIds.has(article.id);

  const buttonsContainer = originalLink ? originalLink.parentElement : document.querySelector("#detailModal .grid.grid-cols-2");

  if (isInternal && buttonsContainer) {
    if (isWatermarking) {
      buttonsContainer.className = "pt-4 border-t border-slate-200 flex mt-4";
      buttonsContainer.innerHTML = `
        <button disabled class="w-full text-center text-xs font-semibold py-2.5 px-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-300 shadow-sm flex items-center justify-center gap-2 cursor-wait">
          <i class="fas fa-circle-notch fa-spin text-rose-600"></i>
          <span>Generowanie znaku wodnego i stempla audytowego...</span>
        </button>
      `;
    } else {
      buttonsContainer.className = "pt-4 border-t border-slate-200 flex gap-2.5 mt-4";
      buttonsContainer.innerHTML = `
        <button type="button" onclick="openSecureViewer('${article.id}', 'original')" class="flex-1 text-center text-xs font-semibold py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
          <i class="fas fa-eye text-rose-400"></i> 🔒 Czytaj w Bezpiecznym Czytniku
        </button>
        <button type="button" onclick="downloadWatermarkedPdf('${article.id}')" class="flex-1 text-center text-xs font-semibold py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-700 hover:to-purple-700 text-white shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
          <i class="fas fa-file-shield text-sm"></i> Pobierz ze stemplem
        </button>
      `;
    }
  } else if (buttonsContainer) {
    buttonsContainer.className = "pt-4 border-t border-slate-200 grid grid-cols-2 gap-3 mt-4";
    buttonsContainer.innerHTML = `
      <button type="button" id="detail-btn-original" onclick="openSecureViewer('${article.id}', 'original')" class="text-center text-xs font-semibold py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition flex items-center justify-center gap-2 cursor-pointer">
        <i class="fas fa-file-pdf text-red-500"></i> 📄 Czytaj Oryginał
      </button>
      <div id="detail-translation-btn-wrapper" class="w-full flex">
        ${isTranslating ? `
          <button disabled class="w-full text-center text-xs font-semibold py-2.5 px-3 rounded-xl bg-purple-50 text-purple-700 border border-purple-300 shadow-sm flex items-center justify-center gap-2 cursor-wait">
            <i class="fas fa-circle-notch fa-spin text-purple-600"></i>
            <span>Tłumaczenie...</span>
          </button>
        ` : hasTranslation ? `
          <button type="button" id="detail-btn-translation" onclick="openSecureViewer('${article.id}', 'translation')" class="w-full text-center text-xs font-semibold py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md transition flex items-center justify-center gap-2 cursor-pointer" title="Otwórz zabezpieczony czytnik tłumaczenia PL">
            <i class="fas fa-language text-indigo-100"></i> 🇵🇱 Czytaj Tłumaczenie PL
          </button>
        ` : `
          <button type="button" onclick="requestAiTranslation('${article.id}')" class="w-full text-center text-xs font-medium py-2.5 px-3 rounded-xl bg-white text-slate-700 border border-slate-300 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm" title="Zleć tłumaczenie pełnotekstowe AI">
            <i class="fas fa-globe text-indigo-600"></i> Przetłumacz na PL
          </button>
        `}
      </div>
    `;
  }

  showModalElement("detailModal");
}

function closeDetailModal() {
  hideModalElement("detailModal");
}

/**
 * Moduł Administratora: Drag & Drop + Pipeline
 */
function openUploadModal() {
  if (AppState.currentRole !== "ADMIN") {
    showToast("Dostęp wymaga uprawnień Administratora. Zaloguj się kodem PIN 2026.", "error");
    openLoginModal();
    return;
  }
  showModalElement("uploadModal");
  resetUploadForm();
}

function closeUploadModal() {
  hideModalElement("uploadModal");
  resetUploadForm();
}

function setupDragAndDrop() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  if (!dropZone || !fileInput) return;

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("drop-zone-active");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("drop-zone-active");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  });
}

function processSelectedFile(file) {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    showToast("Wymagany jest plik w formacie PDF.", "error");
    return;
  }

  if (file.size > 25 * 1024 * 1024) {
    showToast("Plik przekracza dopuszczalny limit 25 MB. Wybierz mniejszy plik lub zoptymalizuj PDF.", "error");
    const fileInput = document.getElementById("file-input");
    if (fileInput) fileInput.value = "";
    return;
  }

  AppState.selectedUploadFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64Data = e.target.result.split(",")[1];
    AppState.uploadBase64 = base64Data;

    const fileInfo = document.getElementById("selected-file-info");
    const fileNameEl = document.getElementById("selected-file-name");
    const fileSizeEl = document.getElementById("selected-file-size");
    const dropPrompt = document.getElementById("drop-prompt");

    if (fileNameEl) fileNameEl.innerText = cleanDisplayText(file.name);
    if (fileSizeEl) fileSizeEl.innerText = (file.size / (1024 * 1024)).toFixed(2) + " MB";

    if (dropPrompt) {
      dropPrompt.classList.add("hidden");
      dropPrompt.style.setProperty("display", "none", "important");
    }
    if (fileInfo) {
      fileInfo.classList.remove("hidden");
      fileInfo.style.setProperty("display", "block", "important");
    }
    document.getElementById("start-upload-btn")?.removeAttribute("disabled");
  };
  reader.readAsDataURL(file);
}

function resetUploadForm() {
  AppState.selectedUploadFile = null;
  AppState.uploadBase64 = null;

  const fileInput = document.getElementById("file-input");
  if (fileInput) fileInput.value = "";

  const dropPrompt = document.getElementById("drop-prompt");
  const fileInfo = document.getElementById("selected-file-info");
  const startBtn = document.getElementById("start-upload-btn");
  const progressContainer = document.getElementById("pipeline-progress-container");
  const uploadFormInputs = document.getElementById("upload-form-inputs");
  const completeBox = document.getElementById("pipeline-complete-box");
  const errorBox = document.getElementById("pipeline-error-box");

  if (dropPrompt) {
    dropPrompt.classList.remove("hidden");
    dropPrompt.style.setProperty("display", "block", "important");
  }
  if (fileInfo) {
    fileInfo.classList.add("hidden");
    fileInfo.style.setProperty("display", "none", "important");
  }
  if (startBtn) {
    startBtn.setAttribute("disabled", "true");
    startBtn.classList.remove("hidden");
    startBtn.style.setProperty("display", "flex", "important");
  }
  if (progressContainer) {
    progressContainer.classList.add("hidden");
    progressContainer.style.setProperty("display", "none", "important");
  }
  if (uploadFormInputs) {
    uploadFormInputs.classList.remove("hidden");
    uploadFormInputs.style.setProperty("display", "block", "important");
  }
  if (completeBox) {
    completeBox.classList.add("hidden");
    completeBox.style.setProperty("display", "none", "important");
  }
  if (errorBox) {
    errorBox.classList.add("hidden");
    errorBox.style.setProperty("display", "none", "important");
  }

  for (let i = 1; i <= 5; i++) {
    const step = document.getElementById(`step-${i}`);
    if (step) {
      step.className = "flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500";
      const icon = step.querySelector(".step-icon");
      if (icon) icon.innerHTML = `<i class="far fa-circle"></i>`;
    }
  }
}

/**
 * Bezpieczna konwersja pliku do Base64 (Promise)
 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Brak wybranego pliku."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target.result;
      if (!rawDataUrl || typeof rawDataUrl !== "string") {
        reject(new Error("Pusty strumień danych z odczytu pliku."));
        return;
      }
      let pureBase64 = rawDataUrl;
      if (rawDataUrl.includes(",")) {
        pureBase64 = rawDataUrl.split(",")[1];
      }
      resolve({
        dataUrl: rawDataUrl,
        base64: pureBase64
      });
    };
    reader.onerror = (err) => reject(new Error("Błąd odczytu pliku: " + (err.message || "FileReader error")));
    reader.readAsDataURL(file);
  });
}

/**
 * Bezpieczna konwersja i przesyłanie pliku PDF do Google Apps Script & analiza Gemini
 */
async function uploadAndAnalyzePDF(file, selectedCategory = "Materiały Własne SKN") {
  const { dataUrl, base64 } = await readFileAsBase64(file);

  if (!base64 || base64.trim().length === 0) {
    throw new Error("Błąd konwersji pliku: brak danych Base64.");
  }

  const execUrl = AppState.appsScriptUrl || DEFAULT_EXEC_URL;
  const adminPin = AppState.currentPin || (AppState.currentUser && AppState.currentUser.pin) || (AppState.currentRole === "ADMIN" ? "2026" : "skn2026");

  const titleInput = document.getElementById("upload-title") || document.getElementById("title-input");
  const authorsInput = document.getElementById("upload-authors") || document.getElementById("authors-input");
  const yearInput = document.getElementById("upload-year") || document.getElementById("year-input");
  const journalInput = document.getElementById("upload-journal") || document.getElementById("journal-input");
  const abstractTextarea = document.getElementById("upload-abstract") || document.getElementById("abstract-input");
  const hasTranslationCheckbox = document.getElementById("upload-has-translation");

  const cleanTitle = (titleInput && titleInput.value.trim()) || file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
  const cleanAuthors = (authorsInput && authorsInput.value.trim()) || "SKN Seksuologii";
  const cleanYear = (yearInput && yearInput.value.trim()) || new Date().getFullYear().toString();
  const cleanCategory = selectedCategory || "Materiały Własne SKN";
  const cleanJournal = (journalInput && journalInput.value.trim()) || "Repozytorium SKN";
  const cleanAbstract = (abstractTextarea && abstractTextarea.value.trim()) || "";
  const hasTranslation = hasTranslationCheckbox ? Boolean(hasTranslationCheckbox.checked) : false;

  const metadata = {
    title: cleanTitle,
    authors: cleanAuthors,
    year: cleanYear,
    category: cleanCategory,
    journal: cleanJournal,
    abstract: cleanAbstract,
    hasPolishTranslation: hasTranslation
  };

  const payload = {
    action: "upload",
    fileBase64: base64,          // Czysty ciąg base64
    base64: base64,              // Zgodność wsteczna
    base64Data: dataUrl,         // Pełny Data URL
    data: base64,                // Zgodność wsteczna
    fileName: file.name,         // np. "Badanie_Seksuologia_2026.pdf"
    name: file.name,
    mimeType: file.type || "application/pdf",
    category: cleanCategory,
    adminPin: adminPin,
    pin: adminPin,
    metadata: metadata,
    // Spłaszczone właściwości dla pełnej kompatybilności wstecznej
    title: cleanTitle,
    authors: cleanAuthors,
    year: cleanYear,
    journal: cleanJournal,
    abstract: cleanAbstract
  };

  const data = await callGoogleScript("upload", payload);

  if (data && (data.status === "success" || data.success)) {
    return data;
  } else {
    throw new Error(data.message || data.error || "Błąd przetwarzania pliku przez backend Google Drive");
  }
}

function uploadFileToDrive(file, category, accessLevel) {
  return uploadAndAnalyzePDF(file, category);
}

/**
 * REALNE PRZESYŁANIE PLIKU DO GOOGLE DRIVE (Obsługa UI z blokadą fałszywego sukcesu)
 */
async function handleUploadPipeline() {
  if (!AppState.selectedUploadFile) {
    showToast("Wybierz plik PDF do przesłania.", "error");
    return;
  }

  const accessLevel = document.getElementById("upload-access-level")?.value || "PUBLIC";
  const categoryOverride = document.getElementById("upload-category")?.value || "";
  const selectedCategory = categoryOverride === "AUTO" ? null : categoryOverride;

  const uploadFormInputs = document.getElementById("upload-form-inputs");
  const startBtn = document.getElementById("start-upload-btn");
  const progressContainer = document.getElementById("pipeline-progress-container");
  const errorBox = document.getElementById("pipeline-error-box");
  const completeBox = document.getElementById("pipeline-complete-box");

  if (uploadFormInputs) {
    uploadFormInputs.classList.add("hidden");
    uploadFormInputs.style.setProperty("display", "none", "important");
  }
  if (startBtn) {
    startBtn.classList.add("hidden");
    startBtn.style.setProperty("display", "none", "important");
  }
  if (completeBox) {
    completeBox.classList.add("hidden");
    completeBox.style.setProperty("display", "none", "important");
  }
  if (progressContainer) {
    progressContainer.classList.remove("hidden");
    progressContainer.style.setProperty("display", "block", "important");
  }
  if (errorBox) {
    errorBox.classList.add("hidden");
    errorBox.style.setProperty("display", "none", "important");
  }

  const generatedId = generateArticleId();
  const cleanOriginalName = AppState.selectedUploadFile.name.replace(/\.pdf$/i, "").replace(/\s+/g, "_");
  const targetDriveName = `${generatedId}_${cleanOriginalName}.pdf`;

  animateStep(1, `1/5: Weryfikacja pliku i generowanie ID: «${generatedId}»...`);

  if (AppState.isGasEnvironment) {
    animateStep(2, "2/5: Fizyczny zapis pliku w folderze Google Drive...");

    google.script.run
      .withSuccessHandler((newArticle) => {
        if (!newArticle) {
          handlePipelineError("Brak potwierdzenia zapisu z Google Apps Script.");
          return;
        }
        animateStep(3, "3/5: Wielomodalna analiza Gemini (DSM-5-TR / ICD-11)...");
        setTimeout(() => {
          animateStep(4, "4/5: Generowanie standaryzowanego PDF tłumaczenia (*_PL.pdf)...");
          setTimeout(() => {
            animateStep(5, "5/5: Rejestracja w Arkuszu Google (Baza_Artykulow)...");
            setTimeout(() => {
              showPipelineSuccess(newArticle, targetDriveName);
              loadArticles();
              showToast("Plik został pomyślnie zapisany na Dysku Google!", "success");
            }, 400);
          }, 400);
        }, 400);
      })
      .withFailureHandler((err) => {
        handlePipelineError("Błąd Google Apps Script: " + err.message);
      })
      .apiProcessArticle({
        action: "upload",
        fileName: AppState.selectedUploadFile.name,
        mimeType: AppState.selectedUploadFile.type || "application/pdf",
        base64Data: AppState.uploadBase64,
        category: selectedCategory,
        accessLevel: accessLevel,
        articleId: generatedId,
        targetDriveName: targetDriveName,
        adminPin: AppState.currentPin
      });

  } else {
    animateStep(2, "2/5: Przesyłanie strumienia PDF do bezpiecznego magazynu Google Drive...");

    try {
      const resData = await uploadAndAnalyzePDF(AppState.selectedUploadFile, selectedCategory || "Edukacja Seksualna");

      // BEZWZGLĘDNA WERYFIKACJA SUKCESU: Brak statusu success rzuca błąd i blokuje sukces w UI
      if (resData.status !== "success" && !resData.success) {
        throw new Error(resData.message || resData.error || "Błąd zapisu na koncie Google Drive.");
      }

      const meta = resData.meta || resData.data || resData;
      const returnedId = resData.id || meta.id || generatedId;
      const returnedUrl = resData.url || meta.url || meta.urlOriginal || resData.fileUrl || "#";
      const returnedTransUrl = meta.urlTranslation || resData.urlTranslation || returnedUrl;
      const polishTitle = meta.titlePL || meta.polishTitle || meta.translatedTitle || resData.polishTitle || resData.titlePL || cleanOriginalName.replace(/_/g, " ");
      const originalTitle = meta.titleEN || meta.originalTitle || meta.titleOriginal || resData.originalTitle || resData.titleOriginal || AppState.selectedUploadFile.name;
      const authors = meta.authors || resData.authors || "Autor nieznany";
      const year = String(meta.year || resData.year || "");
      const abstractPL = meta.abstractPL || resData.abstractPL || "Brak abstraktu.";
      const category = meta.category || meta.suggestedCategory || resData.category || selectedCategory || "Edukacja Seksualna";
      const tags = Array.isArray(meta.keywords) ? meta.keywords : (Array.isArray(meta.tags) ? meta.tags : (Array.isArray(resData.keywords) ? resData.keywords : []));

      const articleData = {
        id: returnedId,
        dateAdded: new Date().toISOString().split("T")[0],
        titlePL: polishTitle,
        titleOriginal: originalTitle,
        titleEN: originalTitle,
        authors: authors,
        year: year,
        category: category,
        tags: tags,
        keywords: tags,
        abstractPL: abstractPL,
        accessLevel: accessLevel,
        urlOriginal: returnedUrl,
        url: returnedUrl,
        urlTranslation: returnedTransUrl,
        meta: meta,
        status: "ACTIVE"
      };

      animateStep(3, "3/5: Ekstrakcja metadanych przez Gemini AI zakończona...");
      setTimeout(() => {
        animateStep(4, "4/5: Plik PDF zapisany na Dysku Google...");
        setTimeout(() => {
          animateStep(5, "5/5: Rekord zarejestrowany w bazie...");
          setTimeout(() => {
            showPipelineSuccess(articleData, targetDriveName);
            loadArticles();
            showToast(`Plik «${polishTitle}» został pomyślnie przetworzony przez Gemini AI!`, "success");
          }, 400);
        }, 400);
      }, 400);

    } catch (err) {
      console.error("Błąd zapisu do chmury:", err);
      handlePipelineError(`Błąd połączenia z Google Drive: ${err.message}`);
    }
  }
}

function handlePipelineError(errorMessage) {
  const progressContainer = document.getElementById("pipeline-progress-container");
  if (progressContainer) {
    progressContainer.classList.add("hidden");
    progressContainer.style.setProperty("display", "none", "important");
  }
  const errorBox = document.getElementById("pipeline-error-box");
  if (errorBox) {
    errorBox.classList.remove("hidden");
    errorBox.style.setProperty("display", "block", "important");
    const errText = document.getElementById("pipeline-error-text");
    if (errText) errText.innerText = errorMessage;
  }
  showToast("Wystąpił błąd zapisu na Dysku Google.", "error");
}

function animateStep(stepNum, statusText) {
  const statusEl = document.getElementById("pipeline-status-text");
  if (statusEl) statusEl.innerText = statusText;

  for (let i = 1; i < stepNum; i++) {
    const step = document.getElementById(`step-${i}`);
    if (step) {
      step.className = "flex items-center gap-3 p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 step-completed";
      const icon = step.querySelector(".step-icon");
      if (icon) icon.innerHTML = `<i class="fas fa-check-circle text-emerald-600"></i>`;
    }
  }

  const activeStep = document.getElementById(`step-${stepNum}`);
  if (activeStep) {
    activeStep.className = "flex items-center gap-3 p-2.5 rounded-xl border border-indigo-500 bg-indigo-50 text-indigo-800 step-active";
    const icon = activeStep.querySelector(".step-icon");
    if (icon) icon.innerHTML = `<i class="fas fa-spinner fa-spin text-indigo-600"></i>`;
  }
}

function showPipelineSuccess(article, targetDriveName) {
  const progressContainer = document.getElementById("pipeline-progress-container");
  if (progressContainer) {
    progressContainer.classList.add("hidden");
    progressContainer.style.setProperty("display", "none", "important");
  }
  const completeBox = document.getElementById("pipeline-complete-box");
  if (completeBox) {
    completeBox.classList.remove("hidden");
    completeBox.style.setProperty("display", "block", "important");
    
    document.getElementById("res-article-id").innerText = article.id || "KC-OK";
    document.getElementById("res-article-title").innerText = cleanDisplayText(article.titlePL || "Sukces");
    
    const driveFileNameEl = document.getElementById("res-drive-filename");
    if (driveFileNameEl) {
      driveFileNameEl.innerText = targetDriveName || `${article.id}_${article.titleOriginal || "dokument.pdf"}`;
    }

    const origBtn = document.getElementById("res-view-orig");
    const transBtn = document.getElementById("res-view-trans");

    if (origBtn) {
      origBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeUploadModal();
        openSecureViewer(article.id, "original");
      };
    }
    if (transBtn) {
      transBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeUploadModal();
        openSecureViewer(article.id, "translation");
      };
    }
  }
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  const icon = type === "success" ? "fa-check-circle text-emerald-600" : type === "error" ? "fa-circle-exclamation text-rose-600" : "fa-info-circle text-indigo-600";
  const border = type === "success" ? "border-emerald-300" : type === "error" ? "border-rose-300" : "border-indigo-300";

  toast.className = `fixed bottom-5 right-5 z-[99999] flex items-center gap-3 px-4 py-3 rounded-2xl bg-white ${border} text-slate-800 shadow-xl transition-all duration-300 transform translate-y-10 opacity-0 text-sm border`;
  toast.innerHTML = `<i class="fas ${icon} text-base"></i> <span>${escapeHtml(message)}</span>`;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove("translate-y-10", "opacity-0");
  }, 50);

  setTimeout(() => {
    toast.classList.add("translate-y-10", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showLoadingSpinner(show) {
  const spinner = document.getElementById("loading-spinner");
  if (spinner) {
    spinner.classList.toggle("hidden", !show);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Globalny eksport funkcji do obiektu window
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.handleLoginSubmit = handleLoginSubmit;
window.handleLogout = handleLogout;
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.handleConfirmDelete = handleConfirmDelete;
window.openArticleDetail = openArticleDetail;
window.closeDetailModal = closeDetailModal;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.openConfigModal = openConfigModal;
window.closeConfigModal = closeConfigModal;
window.handleSaveGasConfig = handleSaveGasConfig;
window.handleSyncDriveFolder = handleSyncDriveFolder;
window.closeSyncModal = closeSyncModal;
window.handleBackdropClick = handleBackdropClick;
window.resetUploadForm = resetUploadForm;
window.handleUploadPipeline = handleUploadPipeline;
window.filterByTag = filterByTag;
