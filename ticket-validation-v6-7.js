import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=6.0.0";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const normalize = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/×/g, "x")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[char]));

const safeCssUrl = (url = "") => String(url).replace(/["\\\n\r]/g, (char) => encodeURIComponent(char));
const currentFile = () => location.pathname.split("/").pop() || "index.html";
const mediaUrl = (item) => item.coverUrl || item.imageUrl || item.logoUrl || item.photoUrl || "";

function identityKey(collectionName, item) {
  if (collectionName === "videos") return normalize(String(item.title || "").replace(/after\s*movie/gi, ""));
  if (collectionName === "pages") return normalize(item.pageType === "existing" ? item.targetPath : item.slug);
  return normalize(item.name || item.title || item.slug || item.id);
}

function itemScore(item) {
  let score = 0;
  if (mediaUrl(item)) score += 100;
  if (item.description || item.bio || item.bodyHtml) score += 20;
  if (item.ticketUrl || item.url || item.facebook) score += 10;
  if (item.published !== false) score += 2;
  if (!item.importedFromWebsite) score += 1;
  return score;
}

function choosePreferred(first, second) {
  const firstScore = itemScore(first);
  const secondScore = itemScore(second);
  if (firstScore !== secondScore) return secondScore > firstScore ? second : first;
  const firstTime = String(first.updatedAt || first.createdAt || "");
  const secondTime = String(second.updatedAt || second.createdAt || "");
  return secondTime >= firstTime ? second : first;
}

function dedupe(collectionName, items) {
  const unique = new Map();
  for (const item of items) {
    const key = identityKey(collectionName, item) || item.id;
    unique.set(key, unique.has(key) ? choosePreferred(unique.get(key), item) : item);
  }
  return [...unique.values()];
}

async function readCollection(collectionName) {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    const items = snapshot.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .filter((item) => item.deleted !== true && item.hidden !== true && item.published !== false)
      .filter((item) => collectionName !== "tickets" || item.active !== false);
    return dedupe(collectionName, items);
  } catch (error) {
    console.error(`[Sixty Night] ${collectionName} olvasási hiba:`, error);
    return [];
  }
}

function titleFrom(card, selectors) {
  for (const selector of selectors) {
    const element = card.querySelector(selector);
    if (element?.textContent?.trim()) return element.textContent.trim();
  }
  return "";
}

function cardMap(cards, titleSelectors, canonical = normalize) {
  const result = new Map();
  for (const card of cards) {
    const key = canonical(titleFrom(card, titleSelectors));
    if (key && !result.has(key)) result.set(key, card);
  }
  return result;
}

function cardIdMap(cards) {
  const result = new Map();
  for (const card of cards) {
    const key = card.dataset.cmsKey || "";
    if (key && !result.has(key)) result.set(key, card);
  }
  return result;
}

function matchCard(item, cardsById, cardsByTitle, title, canonical = normalize) {
  return cardsById.get(item.id) || cardsByTitle.get(canonical(title));
}

function setImage(card, url, preferredSelector = "") {
  if (!card || !url) return;
  const visual = preferredSelector ? card.querySelector(preferredSelector) : null;
  const scopedImage = visual?.matches("img") ? visual : visual?.querySelector("img");
  const image = scopedImage || (!visual ? card.querySelector("img") : null);
  if (image) {
    image.src = url;
    image.removeAttribute("srcset");
    return;
  }
  const target = visual || card.querySelector(".history-image,.card-visual,.photo-cover,.event-inner,.performer-image,.visual");
  if (target) {
    const overlay = target.classList.contains("event-inner")
      ? "linear-gradient(180deg,transparent 28%,rgba(0,0,0,.92)),"
      : "";
    target.style.backgroundImage = `${overlay}url("${safeCssUrl(url)}")`;
    target.style.backgroundSize = "cover";
    target.style.backgroundPosition = target.classList.contains("card-visual") ? "center top" : "center";
  }
}

function setLink(card, url, selectors = "a.btn,a.link,a[href]") {
  if (!card || !url) return;
  const link = card.querySelector(selectors);
  if (!link) return;
  link.href = url;
  if (/^https?:/i.test(url)) {
    link.target = "_blank";
    link.rel = "noopener";
  }
}

function hideDynamicSection(root, hide) {
  const section = root?.closest("section");
  if (section) section.hidden = hide;
}

function eventCardHtml(event) {
  return `<article class="card" data-cms-generated="event">
    <div class="card-visual" style="background-image:url('${escapeHtml(event.coverUrl || "")}')">
      <div class="card-title">${escapeHtml(event.name)}</div>
    </div>
    <div class="card-body">
      <p>${escapeHtml(event.description || "")}</p>
      <p><strong>${escapeHtml(String(event.date || "").replace("T", " "))}</strong>${event.location ? ` • ${escapeHtml(event.location)}` : ""}</p>
      ${event.ticketUrl ? `<a class="btn primary" href="${escapeHtml(event.ticketUrl)}" target="_blank" rel="noopener">Jegyvásárlás</a>` : ""}
    </div>
  </article>`;
}

async function syncEvents(events) {
  const file = currentFile();
  let staticCards = [];
  let titleSelectors = ["h3", "h2", ".card-title"];
  if (file === "index.html") staticCards = [...document.querySelectorAll("main .event-card")];
  if (file === "esemenyek.html") staticCards = [...document.querySelectorAll("main .history-card")];
  const staticMap = cardMap(staticCards, titleSelectors);
  const staticIdMap = cardIdMap(staticCards);
  const matched = new Set();

  for (const event of events) {
    const card = matchCard(event, staticIdMap, staticMap, event.name);
    if (!card) continue;
    matched.add(event.id);
    setImage(card, event.coverUrl, ".history-image,.event-inner,.card-visual");
    setLink(card, event.ticketUrl, "a.btn.primary,a[href*='Jegy'],a[href*='jegy']");
    const heading = card.querySelector("h2,h3,.card-title");
    if (heading && event.name) heading.textContent = event.name;
    const description = card.querySelector(".history-copy > p:not(.date),.card-body p,.event-copy p:last-of-type");
    if (description && event.description) description.textContent = event.description;
  }

  const root = document.getElementById("firebaseEvents");
  if (!root) return;
  const unmatched = events
    .filter((event) => !matched.has(event.id))
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  root.innerHTML = unmatched.map(eventCardHtml).join("");
  hideDynamicSection(root, unmatched.length === 0);
}

function ensurePerformerVisual(card, performer) {
  const url = performer.imageUrl || performer.photoUrl || performer.coverUrl || "";
  if (!url || !card) return;
  let visual = card.querySelector(".card-visual[data-performer-photo]");
  if (!visual) {
    visual = document.createElement("div");
    visual.className = "card-visual";
    visual.dataset.performerPhoto = "true";
    card.insertBefore(visual, card.firstChild);
  }
  visual.style.backgroundImage = `linear-gradient(180deg,transparent 42%,rgba(0,0,0,.82)),url("${safeCssUrl(url)}")`;
  visual.style.backgroundSize = "cover";
  visual.style.backgroundPosition = "center top";
}

function performerCardHtml(performer) {
  return `<article class="card" data-cms-generated="performer">
    ${performer.imageUrl ? `<div class="card-visual" style="background-image:linear-gradient(180deg,transparent 42%,rgba(0,0,0,.82)),url('${escapeHtml(performer.imageUrl)}')"><div class="card-title">${escapeHtml(performer.name)}</div></div>` : ""}
    <div class="card-body"><div class="role">${escapeHtml(performer.role || "Fellépő")}</div><h3>${escapeHtml(performer.name)}</h3>${performer.bio ? `<p>${escapeHtml(performer.bio)}</p>` : ""}</div>
  </article>`;
}

async function syncPerformers(performers) {
  const root = document.getElementById("firebasePerformers");
  if (currentFile() !== "fellepok.html" && !root) return;
  const staticCards = [...document.querySelectorAll("main article.card")].filter((card) => !card.closest("#firebasePerformers"));
  const staticMap = cardMap(staticCards, ["h3", ".card-title"]);
  const staticIdMap = cardIdMap(staticCards);
  const matched = new Set();
  for (const performer of performers) {
    const card = matchCard(performer, staticIdMap, staticMap, performer.name);
    if (!card) continue;
    matched.add(performer.id);
    ensurePerformerVisual(card, performer);
    const heading = card.querySelector("h3,.card-title");
    if (heading && performer.name) heading.textContent = performer.name;
    const role = card.querySelector(".role");
    if (role && performer.role) role.textContent = performer.role;
    let bio = card.querySelector(".card-body p");
    if (!bio && performer.bio) {
      bio = document.createElement("p");
      card.querySelector(".card-body")?.appendChild(bio);
    }
    if (bio && performer.bio) bio.textContent = performer.bio;
  }
  if (!root) return;
  const unmatched = performers.filter((performer) => !matched.has(performer.id));
  root.innerHTML = unmatched.map(performerCardHtml).join("");
  hideDynamicSection(root, unmatched.length === 0);
}

function getAlbumCover(album, photos) {
  return album.coverUrl || photos.find((photo) => photo.albumId === album.id)?.url || "";
}

function openAlbum(album, photos) {
  let modal = document.getElementById("firebaseAlbumModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "firebaseAlbumModal";
    modal.className = "album-modal";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="album-modal-inner">
    <div class="album-modal-head"><div><div class="eyebrow">SIXTY NIGHT PARTY</div><h2>${escapeHtml(album.name)}</h2></div><button class="album-close" type="button">×</button></div>
    <div class="album-grid">${photos.length ? photos.map((photo) => `<img loading="lazy" src="${escapeHtml(photo.url)}" alt="${escapeHtml(album.name)}">`).join("") : '<div class="empty-album">Nincs kép ebben az albumban.</div>'}</div>
  </div>`;
  modal.classList.add("open");
  modal.querySelector(".album-close")?.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (event) => { if (event.target === modal) modal.classList.remove("open"); }, { once: true });
}

function albumCardHtml(album, photos) {
  const albumPhotos = photos.filter((photo) => photo.albumId === album.id);
  const cover = getAlbumCover(album, photos);
  return `<article class="photo-album-card" data-cms-generated="album">
    <div class="photo-cover" style="background-image:url('${escapeHtml(cover)}')"></div>
    <div class="photo-album-body"><h3>${escapeHtml(album.name)}</h3><p>${escapeHtml(album.description || "")}</p>
      <div class="album-actions"><button class="btn primary" data-cms-album="${escapeHtml(album.id)}">Webes galéria (${albumPhotos.length})</button>${album.facebook ? `<a class="btn ghost" href="${escapeHtml(album.facebook)}" target="_blank" rel="noopener">Facebook album</a>` : ""}</div>
    </div>
  </article>`;
}

async function syncAlbums(albums, photos) {
  const root = document.getElementById("firebaseAlbums");
  if (currentFile() !== "fotok.html" && !root) return;
  const staticCards = [...document.querySelectorAll(".photo-album-card")].filter((card) => !card.closest("#firebaseAlbums"));
  const staticMap = cardMap(staticCards, ["h3"]);
  const staticIdMap = cardIdMap(staticCards);
  const matched = new Set();
  for (const album of albums) {
    const card = matchCard(album, staticIdMap, staticMap, album.name);
    if (!card) continue;
    matched.add(album.id);
    const albumPhotos = photos.filter((photo) => photo.albumId === album.id);
    setImage(card, getAlbumCover(album, photos), ".photo-cover");
    const heading = card.querySelector("h3");
    if (heading && album.name) heading.textContent = album.name;
    const description = card.querySelector(".photo-album-body p");
    if (description && album.description) description.textContent = album.description;
    const facebook = [...card.querySelectorAll("a")].find((link) => /facebook/i.test(link.textContent));
    if (facebook && album.facebook) facebook.href = album.facebook;
    const galleryButton = card.querySelector("button");
    if (galleryButton) {
      galleryButton.disabled = false;
      galleryButton.onclick = () => openAlbum(album, albumPhotos);
      galleryButton.textContent = `Webes galéria (${albumPhotos.length})`;
    }
  }
  if (!root) return;
  const unmatched = albums.filter((album) => !matched.has(album.id));
  root.innerHTML = unmatched.map((album) => albumCardHtml(album, photos)).join("");
  root.querySelectorAll("[data-cms-album]").forEach((button) => {
    const album = unmatched.find((item) => item.id === button.dataset.cmsAlbum);
    if (album) button.onclick = () => openAlbum(album, photos.filter((photo) => photo.albumId === album.id));
  });
  hideDynamicSection(root, unmatched.length === 0);
}

const canonicalVideo = (value) => normalize(String(value || "").replace(/after\s*movie/gi, ""));

function videoCardHtml(video) {
  return `<article class="card" data-cms-generated="video"><div class="card-body"><h3>${escapeHtml(video.title)}</h3><p>${escapeHtml(video.type || "")}</p><a class="btn primary" href="${escapeHtml(video.url || "#")}" target="_blank" rel="noopener">Videó megnyitása</a></div></article>`;
}

async function syncVideos(videos) {
  const root = document.getElementById("firebaseVideos");
  if (currentFile() !== "videotar.html" && !root) return;
  const staticCards = [...document.querySelectorAll("main article.card")].filter((card) => !card.closest("#firebaseVideos"));
  const staticMap = cardMap(staticCards, ["h3", ".card-title"], canonicalVideo);
  const staticIdMap = cardIdMap(staticCards);
  const matched = new Set();
  for (const video of videos) {
    const card = matchCard(video, staticIdMap, staticMap, video.title, canonicalVideo);
    if (!card) continue;
    matched.add(video.id);
    setLink(card, video.url, "a.btn,a.link,a[href]");
  }
  if (!root) return;
  const unmatched = videos.filter((video) => !matched.has(video.id));
  root.innerHTML = unmatched.map(videoCardHtml).join("");
  hideDynamicSection(root, unmatched.length === 0);
}

async function syncSponsors(sponsors) {
  const root = document.getElementById("firebaseSponsors");
  if (!root) return;
  const sorted = [...sponsors].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  root.innerHTML = sorted.map((sponsor) => `<a class="sponsor" href="${escapeHtml(sponsor.url || "#")}" ${sponsor.url ? 'target="_blank" rel="noopener"' : ""}><img src="${escapeHtml(sponsor.logoUrl || "")}" alt="${escapeHtml(sponsor.name)}"><span>${escapeHtml(sponsor.name)}</span></a>`).join("");
  hideDynamicSection(root, sorted.length === 0);
}

async function applySettings() {
  const snapshot = await getDoc(doc(db, "settings", "site"));
  if (!snapshot.exists()) return;
  const settings = snapshot.data();
  document.querySelectorAll("[data-site-hero]").forEach((element) => { if (settings.heroTitle) element.textContent = settings.heroTitle; });
  document.querySelectorAll("[data-featured-event]").forEach((element) => { if (settings.featuredEvent) element.textContent = settings.featuredEvent; });
  document.querySelectorAll("a[href^='mailto:']").forEach((link) => {
    if (!settings.email) return;
    const subject = link.href.includes("?") ? link.href.slice(link.href.indexOf("?")) : "";
    link.href = `mailto:${settings.email}${subject}`;
  });
  document.querySelectorAll("a[href^='tel:']").forEach((link) => { if (settings.phone) link.href = `tel:${String(settings.phone).replace(/\s+/g, "")}`; });
  document.querySelectorAll("a[href*='facebook.com']").forEach((link) => { if (settings.facebook && !/share\//i.test(link.href)) link.href = settings.facebook; });
  document.querySelectorAll("a[href*='instagram.com']").forEach((link) => { if (settings.instagram) link.href = settings.instagram; });
  document.querySelectorAll("[data-site-location]").forEach((element) => { if (settings.location) element.textContent = settings.location; });
}

function pageUrl(page) {
  if (page.pageType === "existing" && page.targetPath) return page.targetPath;
  return `oldal.html?slug=${encodeURIComponent(page.slug || page.id)}`;
}

function installManagedPageStyles() {
  if (document.getElementById("cmsManagedStyles")) return;
  const style = document.createElement("style");
  style.id = "cmsManagedStyles";
  style.textContent = `
    .cms-managed-hero{min-height:380px;display:flex;align-items:flex-end;padding:70px 0 55px;background-size:cover;background-position:center;position:relative}
    .cms-managed-hero:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,5,10,.18),rgba(5,5,10,.94))}
    .cms-managed-hero .container{position:relative;z-index:1}.cms-managed-hero h1{font-size:clamp(2.5rem,8vw,6rem);line-height:.95;margin:.2em 0}
    .cms-managed-intro{max-width:850px;color:#c8c8d3;font-size:1.08rem;line-height:1.75}.cms-rich-content{line-height:1.8;color:#e8e8ee}
    .cms-rich-content img{max-width:100%;height:auto;border-radius:20px}.cms-rich-content h2,.cms-rich-content h3{margin-top:1.6em}.cms-rich-content a{color:#27d9ff}
  `;
  document.head.appendChild(style);
}

function renderManagedMain(page) {
  installManagedPageStyles();
  const main = document.querySelector("main");
  if (!main) return;
  const cover = page.coverUrl ? `style="background-image:url('${escapeHtml(page.coverUrl)}')"` : "";
  main.innerHTML = `<section class="cms-managed-hero" ${cover}><div class="container"><div class="eyebrow">${escapeHtml(page.eyebrow || "SIXTY NIGHT PARTY")}</div><h1>${escapeHtml(page.heroTitle || page.title)}</h1>${page.intro ? `<p class="cms-managed-intro">${escapeHtml(page.intro)}</p>` : ""}</div></section><section class="section"><div class="container"><div class="cms-rich-content">${page.bodyHtml || ""}</div></div></section>`;
  document.title = `${page.title || page.heroTitle || "Oldal"} | Sixty Night Party`;
}

function applyExistingPageOverride(page) {
  if (!page) return;
  if (page.replaceMain === true && page.bodyHtml) {
    renderManagedMain(page);
    return;
  }
  if (page.title) document.title = `${page.title} | Sixty Night Party`;
  const heroTitle = document.querySelector(".page-hero h1,.hero h1,main h1");
  if (heroTitle && page.heroTitle) heroTitle.textContent = page.heroTitle;
  const heroIntro = document.querySelector(".page-hero p,.hero p");
  if (heroIntro && page.intro) heroIntro.textContent = page.intro;
}

function renderCustomPage(pages) {
  if (currentFile() !== "oldal.html") return;
  const slug = new URLSearchParams(location.search).get("slug") || "";
  const page = pages.find((item) => normalize(item.slug) === normalize(slug));
  if (!page) {
    const main = document.querySelector("main");
    if (main) main.innerHTML = '<section class="section"><div class="container"><h1>Az oldal nem található</h1><p>Ez az oldal nem létezik vagy nincs publikálva.</p></div></section>';
    return;
  }
  renderManagedMain(page);
}

function syncPageMenu(pages) {
  const menu = document.querySelector("nav.menu");
  if (!menu) return;
  const existingUrls = new Set([...menu.querySelectorAll("a")].map((link) => new URL(link.getAttribute("href"), location.href).pathname + new URL(link.getAttribute("href"), location.href).search));
  pages
    .filter((page) => page.menuVisible !== false)
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .forEach((page) => {
      const url = pageUrl(page);
      const absolute = new URL(url, location.href);
      const key = absolute.pathname + absolute.search;
      if (existingUrls.has(key)) return;
      const link = document.createElement("a");
      link.href = url;
      link.textContent = page.menuLabel || page.title || page.heroTitle || "Oldal";
      link.dataset.cmsPageLink = page.id;
      const contactLink = [...menu.querySelectorAll("a")].find((item) => normalize(item.textContent) === "kapcsolat");
      menu.insertBefore(link, contactLink || null);
      existingUrls.add(key);
    });
}

async function syncPages(pages) {
  syncPageMenu(pages);
  renderCustomPage(pages);
  const existingPage = pages.find((page) => page.pageType === "existing" && normalize(page.targetPath) === normalize(currentFile()));
  applyExistingPageOverride(existingPage);
}

async function boot() {
  try {
    const [events, performers, albums, photos, videos, sponsors, pages] = await Promise.all([
      readCollection("events"),
      readCollection("performers"),
      readCollection("albums"),
      readCollection("photos"),
      readCollection("videos"),
      readCollection("sponsors"),
      readCollection("pages")
    ]);
    await Promise.allSettled([
      applySettings(),
      syncEvents(events),
      syncPerformers(performers),
      syncAlbums(albums, photos),
      syncVideos(videos),
      syncSponsors(sponsors),
      syncPages(pages)
    ]);
  } catch (error) {
    console.error("[Sixty Night] Nyilvános CMS hiba:", error);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
