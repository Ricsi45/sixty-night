import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=6.7.1";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

function pageUrl(page) {
  if (page.pageType === "existing" && page.targetPath) return page.targetPath;
  return `page.html?slug=${encodeURIComponent(page.slug || page.id)}`;
}

function normalizedUrl(value) {
  const url = new URL(value, location.href);
  return `${url.pathname}${url.search}`;
}

async function loadPages() {
  const snapshot = await getDocs(collection(db, "pages"));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((page) => page.deleted !== true && page.published === true && page.showInMenu !== false)
    .sort((a, b) => Number(a.order ?? 100) - Number(b.order ?? 100));
}

function findMenu() {
  return document.querySelector("header nav.menu, header nav.nav, header nav, nav.menu, nav.nav");
}

function insertPageLink(menu, page, existing) {
  const href = pageUrl(page);
  const key = normalizedUrl(href);
  if (existing.has(key)) return;

  const link = document.createElement("a");
  link.href = href;
  link.textContent = page.menuLabel || page.title || "Oldal";
  link.dataset.cmsPageLink = page.id;

  const contact = [...menu.querySelectorAll(":scope > a")]
    .find((item) => /kapcsolat/i.test(item.textContent || ""));
  menu.insertBefore(link, contact || null);
  existing.add(key);
}


const INTERNAL_LABEL_PATTERN = /adminból\s+kezelt|admin\s+előnézet|weboldalon\s+kezelt/i;

function removeInternalPublicLabels() {
  document.querySelectorAll("a,button,small,span,p").forEach((element) => {
    const text = String(element.textContent || "").trim();
    if (/^admin\s+előnézet$/i.test(text)) {
      const parent = element.parentElement;
      element.remove();
      if (parent && !String(parent.textContent || "").trim() && parent.children.length === 0) parent.remove();
    }
  });

  document.querySelectorAll("h1,h2,h3,h4").forEach((heading) => {
    const text = String(heading.textContent || "").trim();
    if (!INTERNAL_LABEL_PATTERN.test(text)) return;
    const section = heading.closest("section");
    if (section) section.remove();
    else heading.remove();
  });
}

function installInternalLabelGuard() {
  removeInternalPublicLabels();
  [100, 500, 1500].forEach((delay) => setTimeout(removeInternalPublicLabels, delay));
  const observer = new MutationObserver(removeInternalPublicLabels);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10000);
}

async function boot() {
  installInternalLabelGuard();
  try {
    const menu = findMenu();
    if (!menu) return;
    menu.querySelectorAll("[data-cms-page-link]").forEach((element) => element.remove());
    const existing = new Set([...menu.querySelectorAll("a[href]")].map((link) => normalizedUrl(link.getAttribute("href"))));
    const pages = await loadPages();
    pages.forEach((page) => insertPageLink(menu, page, existing));
  } catch (error) {
    console.warn("[Sixty Night] A dinamikus oldalak menüje nem tölthető be:", error);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
