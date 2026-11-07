// ===== Country Explorer =====
// ملاحظة مهمة: خدمة REST Countries القديمة (v3.1) تم إيقافها وأصبحت النسخة الجديدة تحتاج مفتاح API.
// لذلك أصبحت البيانات محفوظة داخل المشروع في الملف countries.js (المتغير COUNTRIES)،
// والتطبيق يعمل بدون إنترنت وبدون مفتاح. (الأعلام فقط تُحمّل من الإنترنت، ولها بديل إيموجي).

// ----- DOM elements -----
const form = document.getElementById("searchForm");
const input = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const randomBtn = document.getElementById("randomBtn");
const langBtn = document.getElementById("langBtn");
const themeBtn = document.getElementById("themeBtn");
const titleEl = document.getElementById("title");
const backLink = document.getElementById("backLink");
const countryInfo = document.getElementById("countryInfo");
const recentEl = document.getElementById("recent");
const datalist = document.getElementById("countryList");
const credits = document.getElementById("credits");

// ----- Translations -----
const TEXT = {
  ar: {
    title: "معلومات الدول",
    placeholder: "ابحث عن دولة... (مثال: egypt أو مصر)",
    search: "بحث",
    random: "🎲 دولة عشوائية",
    back: "→ الرجوع للرئيسية",
    loading: "جاري البحث...",
    notFound: "لم يتم العثور على الدولة. تأكد من الاسم وحاول مرة أخرى.",
    empty: "الرجاء إدخال اسم الدولة",
    welcome: "مرحباً 👋 ابحث عن أي دولة لعرض معلوماتها.",
    capital: "العاصمة",
    population: "عدد السكان",
    region: "القارة",
    area: "المساحة",
    languages: "اللغات",
    currency: "العملة",
    neighbors: "الدول المجاورة:",
    noNeighbors: "لا توجد حدود برية مع دول أخرى",
    map: "🗺️ عرض على الخريطة",
    recent: "عمليات بحث سابقة:",
    km2: "كم²",
    none: "غير متوفر",
    credits: "البيانات: mledoze/countries (ODbL) • السكان: World Bank • الأعلام: flagcdn.com",
    regions: { Africa: "أفريقيا", Americas: "الأمريكتان", Asia: "آسيا", Europe: "أوروبا", Oceania: "أوقيانوسيا", Antarctic: "القارة القطبية الجنوبية" },
  },
  en: {
    title: "Country Explorer",
    placeholder: "Search a country... (e.g. egypt or مصر)",
    search: "Search",
    random: "🎲 Random country",
    back: "← Back to home",
    loading: "Searching...",
    notFound: "Country not found. Check the name and try again.",
    empty: "Please type a country name",
    welcome: "Welcome 👋 Search for any country to see its info.",
    capital: "Capital",
    population: "Population",
    region: "Region",
    area: "Area",
    languages: "Languages",
    currency: "Currency",
    neighbors: "Neighbors:",
    noNeighbors: "No land borders with other countries",
    map: "🗺️ View on map",
    recent: "Recent searches:",
    km2: "km²",
    none: "N/A",
    credits: "Data: mledoze/countries (ODbL) • Population: World Bank • Flags: flagcdn.com",
    regions: {},
  },
};

// ----- State (saved in the browser) -----
function readStorage(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

let lang = readStorage("lang", "ar");
let theme = readStorage("theme", "light");
let recent = [];
try { recent = JSON.parse(readStorage("recent", "[]")) || []; } catch { recent = []; }
let lastQuery = null;

const t = (key) => TEXT[lang][key];

// ----- Helpers -----
function esc(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function formatNumber(n) {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(n);
}

function localName(c) { return lang === "ar" ? c.nameAr : c.name; }
function localOfficial(c) { return lang === "ar" ? c.officialAr : c.official; }

// توحيد النص: يتجاهل حالة الأحرف والتشكيل والهمزات (أ إ آ = ا) والمسافات الزائدة
function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ----- "API" layer -----
// نفس فكرة fetch: الدوال ترجع Promise ونستخدم .then / .catch
const byCode = {};
COUNTRIES.forEach((c) => (byCode[c.cca3] = c));

function getCountries() {
  return new Promise((resolve, reject) => {
    if (typeof COUNTRIES === "undefined" || !COUNTRIES.length) reject(new Error("NO_DATA"));
    else resolve(COUNTRIES);
  });
}

function searchByName(query) {
  const q = normalize(query);
  return getCountries().then((list) => {
    const scored = [];
    list.forEach((c) => {
      const names = [c.name, c.official, c.nameAr, c.officialAr, ...c.alt].map(normalize);
      let score = 0;
      if (q === normalize(c.cca2) || q === normalize(c.cca3)) score = 90;
      names.forEach((n) => {
        if (n === q) score = Math.max(score, 100);
        else if (n.startsWith(q)) score = Math.max(score, 70);
        else if (n.split(" ").some((w) => w.startsWith(q))) score = Math.max(score, 50);
        else if (q.length >= 3 && n.includes(q)) score = Math.max(score, 30);
      });
      if (score > 0) scored.push({ c, score });
    });
    if (!scored.length) throw new Error("NOT_FOUND");
    scored.sort((a, b) => b.score - a.score || (b.c.population || 0) - (a.c.population || 0));
    return scored.slice(0, 6).map((s) => s.c);
  });
}

function getByCode(code) {
  return getCountries().then(() => {
    if (!byCode[code]) throw new Error("NOT_FOUND");
    return [byCode[code]];
  });
}

function getRandom() {
  return getCountries().then((list) => [list[Math.floor(Math.random() * list.length)]]);
}

// ----- UI states -----
function showLoading() {
  countryInfo.innerHTML = `<div class="message"><div class="spinner"></div>${t("loading")}</div>`;
}
function showError(message) {
  countryInfo.innerHTML = `<div class="message error">${esc(message)}</div>`;
}
function showWelcome() {
  countryInfo.innerHTML = `<div class="message">${t("welcome")}</div>`;
}

// ----- Search flow -----
function run(loader, label) {
  showLoading();
  loader()
    .then((countries) => {
      lastQuery = loader;
      displayCountries(countries);
      if (label) saveRecent(label);
    })
    .catch((err) => {
      showError(err.message === "NOT_FOUND" ? t("notFound") : "Error: " + err.message);
    });
}

function searchCountry() {
  const name = input.value.trim();
  if (!name) return showError(t("empty"));
  run(() => searchByName(name), name);
}

// ----- Display -----
function row(label, value) {
  return `<div class="row"><span class="label">${label}:</span><span>${esc(value)}</span></div>`;
}

function displayCountries(countries) {
  countryInfo.innerHTML = "";
  countries.forEach((c) => countryInfo.appendChild(buildCard(c)));
}

function buildCard(c) {
  const capital = c.capital.length ? c.capital.join("، ") : t("none");
  const currency = c.currencies.length
    ? c.currencies.map((x) => `${x.name}${x.symbol ? " (" + x.symbol + ")" : ""}`).join("، ")
    : t("none");
  const languages = c.languages.length ? c.languages.join("، ") : t("none");
  const regionName = (lang === "ar" && TEXT.ar.regions[c.region]) || c.region;
  const region = [regionName, c.subregion].filter(Boolean).join(" - ") || t("none");
  const population = c.population
    ? formatNumber(c.population) + (c.populationYear ? ` <span class="hint">(${c.populationYear})</span>` : "")
    : null;
  const area = c.area ? `${formatNumber(c.area)} ${t("km2")}` : t("none");

  const card = document.createElement("article");
  card.className = "country-card";
  card.innerHTML = `
    <img class="flag" src="https://flagcdn.com/w320/${c.cca2.toLowerCase()}.png" alt="${esc(c.name)}" />
    <div class="details">
      <h2>${esc(localName(c))} ${esc(c.flag)}</h2>
      <p class="official">${esc(localOfficial(c))}</p>
      ${row(t("capital"), capital)}
      <div class="row"><span class="label">${t("population")}:</span><span>${population ?? esc(t("none"))}</span></div>
      ${row(t("region"), region)}
      ${row(t("area"), area)}
      ${row(t("languages"), languages)}
      ${row(t("currency"), currency)}
      <div class="borders"></div>
      ${c.latlng.length ? `<a class="map-link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${c.latlng[0]},${c.latlng[1]}">${t("map")}</a>` : ""}
    </div>`;

  // إذا فشل تحميل صورة العلم (لا يوجد إنترنت) نعرض علم الإيموجي بدلاً منها
  const img = card.querySelector(".flag");
  img.addEventListener("error", () => {
    const fallback = document.createElement("div");
    fallback.className = "flag-emoji";
    fallback.textContent = c.flag;
    img.replaceWith(fallback);
  });

  // الدول المجاورة (أزرار قابلة للضغط)
  const bordersBox = card.querySelector(".borders");
  if (c.borders.length) {
    bordersBox.append(t("neighbors"));
    c.borders.forEach((code) => {
      const neighbor = byCode[code];
      if (!neighbor) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = localName(neighbor);
      chip.onclick = () => run(() => getByCode(code), null);
      bordersBox.appendChild(chip);
    });
  } else {
    bordersBox.textContent = t("noNeighbors");
  }
  return card;
}

// ----- Recent searches -----
function saveRecent(name) {
  recent = [name, ...recent.filter((n) => n.toLowerCase() !== name.toLowerCase())].slice(0, 5);
  writeStorage("recent", JSON.stringify(recent));
  renderRecent();
}

function renderRecent() {
  recentEl.hidden = recent.length === 0;
  recentEl.innerHTML = `<span>${t("recent")}</span>`;
  recent.forEach((name) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = name;
    chip.onclick = () => {
      input.value = name;
      searchCountry();
    };
    recentEl.appendChild(chip);
  });
}

// ----- اقتراحات الكتابة (datalist) -----
function fillSuggestions() {
  datalist.innerHTML = COUNTRIES
    .map((c) => localName(c))
    .sort((a, b) => a.localeCompare(b, lang))
    .map((n) => `<option value="${esc(n)}"></option>`)
    .join("");
}

// ----- Language & theme -----
function applyLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.title = `${t("title")} | Country Explorer`;
  titleEl.textContent = t("title");
  backLink.textContent = t("back");
  input.placeholder = t("placeholder");
  searchBtn.textContent = t("search");
  randomBtn.textContent = t("random");
  langBtn.textContent = lang === "ar" ? "EN" : "عربي";
  credits.textContent = t("credits");
  fillSuggestions();
  renderRecent();
  if (lastQuery) run(lastQuery, null);
  else showWelcome();
}

function applyTheme() {
  document.body.classList.toggle("dark", theme === "dark");
  themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
}

// ----- Events -----
form.addEventListener("submit", (e) => {
  e.preventDefault();
  searchCountry();
});
randomBtn.addEventListener("click", () => run(getRandom, null));
langBtn.addEventListener("click", () => {
  lang = lang === "ar" ? "en" : "ar";
  writeStorage("lang", lang);
  applyLanguage();
});
themeBtn.addEventListener("click", () => {
  theme = theme === "dark" ? "light" : "dark";
  writeStorage("theme", theme);
  applyTheme();
});

// ----- Start -----
applyTheme();
applyLanguage();
