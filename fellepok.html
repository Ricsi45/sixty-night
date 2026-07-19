import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=6.7.7";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[char]));

function sanitizeHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html);
  template.content.querySelectorAll("script,style,object,embed,base").forEach((element) => element.remove());
  template.content.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on")) element.removeAttribute(attribute.name);
      if ((name === "href" || name === "src") && /^javascript:/i.test(value)) element.removeAttribute(attribute.name);
    });
  });
  return template.innerHTML;
}

function pageUrl(page) {
  if (page.pageType === "existing" && page.targetPath) return page.targetPath;
  return `page.html?slug=${encodeURIComponent(page.slug || page.id)}`;
}

async function loadPages() {
  const snapshot = await getDocs(query(collection(db, "pages"), where("published", "==", true)));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((page) => page.deleted !== true && page.published === true)
    .sort((a, b) => Number(a.order ?? 100) - Number(b.order ?? 100));
}

function addMenu(pages) {
  const root = document.querySelector("[data-dynamic-pages]");
  if (!root) return;
  root.innerHTML = pages
    .filter((page) => page.showInMenu !== false)
    .map((page) => `<a href="${escapeHtml(pageUrl(page))}">${escapeHtml(page.menuLabel || page.title || "Oldal")}</a>`)
    .join("");
}

function showNotFound(message) {
  const loading = document.getElementById("loading");
  if (loading) loading.textContent = message;
}

async function boot() {
  try {
    const pages = await loadPages();
    addMenu(pages);

    const slug = new URLSearchParams(location.search).get("slug") || "";
    const page = pages.find((item) => item.pageType !== "existing" && String(item.slug || item.id) === slug);
    if (!page) {
      showNotFound("Az oldal nem található vagy jelenleg nem publikus.");
      return;
    }

    document.title = `${page.seoTitle || page.title || "Oldal"} | Sixty Night Party`;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.content = page.seoDescription || page.intro || "";

    document.getElementById("title").textContent = page.title || "";
    document.getElementById("intro").textContent = page.intro || "";
    document.getElementById("body").innerHTML = sanitizeHtml(page.content || "");

    const cover = document.getElementById("cover");
    if (cover && page.coverUrl) {
      cover.src = page.coverUrl;
      cover.alt = page.title || "";
      cover.style.display = "block";
    }

    const loading = document.getElementById("loading");
    const article = document.getElementById("page");
    if (loading) loading.hidden = true;
    if (article) article.hidden = false;
  } catch (error) {
    console.error("[Sixty Night] Oldalbetöltési hiba:", error);
    showNotFound("Az oldal betöltése nem sikerült.");
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
