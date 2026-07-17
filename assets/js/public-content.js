import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=6.3.0";

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

const safeCssUrl = (value = "") => String(value).replace(/["\\\n\r]/g, (char) => encodeURIComponent(char));
const currentFile = () => location.pathname.split("/").pop() || "index.html";

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

// A meglévő, statikus kártyák stabil kapcsolatai. A név később az adminban átírható,
// a dokumentum azonosítója alapján a kép és a tartalom akkor is ugyanarra a kártyára kerül.
const STATIC_BINDINGS = {
  events: {
    "mulat-hatvan-2026": "Mulat Hatvan",
    "uv-cirkusz-2-0": "UV Cirkusz 2.0",
    "holi-jungle": "Holi Jungle",
    "goolparty-jager-night": "GóólParty & Jäger Night",
    "wonderland-night": "Wonderland Night"
  },
  performers: {
    "sterbinszky-mynea": "Sterbinszky × Mynea",
    "naksi": "Náksi",
    "budai": "Budai",
    "dj-faczan": "DJ Fáczán",
    "brandnyul": "Brandnyúl",
    "szecsei": "Szecsei",
    "chrstphr": "CHRSTPHR",
    "rick-wayne": "Rick Wayne",
    "lyly": "LYLY",
    "breda-bia": "Bréda Bia",
    "katapult-dj": "Katapult DJ",
    "polevaya": "Polevaya",
    "czaga": "Czaga",
    "marcelfitt": "Marcelfitt",
    "glenn": "Glenn",
    "demeterp": "DemeterP",
    "vzs": "VZS",
    "rostas-szabika": "Rostás Szabika",
    "dondi-duo": "Döndi Duó",
    "szajko-nandor": "Szajkó Nándor"
  },
  albums: {
    "album-uv-cirkusz-2-0": "UV Cirkusz 2.0",
    "album-holi-jungle": "Holi Jungle",
    "album-wonderland-night": "Wonderland Night",
    "album-goolparty-jager-night": "GóólParty & Jäger Night",
    "album-mulat-hatvan": "Mulat Hatvan"
  },
  videos: {
    "video-uv-cirkusz": "UV Cirkusz 2.0",
    "video-holi-jungle": "Holi Jungle"
  }
};

function titleField(collectionName, item) {
  if (collectionName === "videos") return item.title || "";
  return item.name || item.title || "";
}

function canonicalTitle(collectionName, value) {
  if (collectionName === "videos") return normalize(String(value || "").replace(/after\s*movie/gi, ""));
  return normalize(value);
}

function logicalKey(collectionName, item) {
  if (collectionName === "pages") return normalize(item.targetPath || item.slug || item.title || item.id);
  const stableTitle = STATIC_BINDINGS[collectionName]?.[item.id];
  return canonicalTitle(collectionName, stableTitle || titleField(collectionName, item) || item.id);
}

function mediaUrl(item) {
  return item.coverUrl || item.imageUrl || item.logoUrl || item.photoUrl || "";
}

function itemScore(item) {
  let score = 0;
  if (mediaUrl(item)) score += 1000;
  if (item.description || item.bio) score += 100;
  if (item.ticketUrl || item.url || item.facebook) score += 50;
  if (item.date) score += 10;
  if (!item.importedFromWebsite) score += 2;
  return score;
}

function mergeGroup(items) {
  const sorted = [...items].sort((a, b) => {
    const scoreDiff = itemScore(a) - itemScore(b);
    if (scoreDiff) return scoreDiff;
    return String(a.updatedAt || a.createdAt || "").localeCompare(String(b.updatedAt || b.createdAt || ""));
  });
  const preferred = sorted.at(-1);
  return Object.assign({}, ...sorted, {
    id: preferred.id,
    _sourceIds: [...new Set(sorted.map((item) => item.id).filter(Boolean))]
  });
}

async function readCollectionState(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  const groups = new Map();

  snapshot.docs.forEach((entry) => {
    const item = { id: entry.id, ...entry.data() };
    const key = logicalKey(collectionName, item) || item.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const active = [];
  const inactiveKeys = new Set();

  groups.forEach((items, key) => {
    const visible = items.filter((item) => item.deleted !== true && item.hidden !== true && item.published !== false);
    if (visible.length) active.push(mergeGroup(visible));
    else inactiveKeys.add(key);
  });

  return { active, inactiveKeys };
}

function headingText(card, selectors) {
  for (const selector of selectors) {
    const element = card.querySelector(selector);
    if (element?.textContent?.trim()) return element.textContent.trim();
  }
  return "";
}

function staticCardMap(cards, selectors, collectionName) {
  const map = new Map();
  cards.forEach((card) => {
    const key = canonicalTitle(collectionName, headingText(card, selectors));
    if (key && !map.has(key)) map.set(key, card);
  });
  return map;
}

function matchingCard(collectionName, item, cardMap) {
  const candidates = [
    logicalKey(collectionName, item),
    canonicalTitle(collectionName, titleField(collectionName, item)),
    canonicalTitle(collectionName, STATIC_BINDINGS[collectionName]?.[item.id] || "")
  ].filter(Boolean);

  for (const key of candidates) {
    if (cardMap.has(key)) return cardMap.get(key);
  }
  return null;
}

function hideInactiveStaticCards(collectionName, inactiveKeys, cardMap) {
  inactiveKeys.forEach((key) => {
    const card = cardMap.get(key);
    if (card) card.hidden = true;
  });
}

function showCard(card) {
  if (card) card.hidden = false;
}

function setImage(card, url, selector = "") {
  if (!card || !url) return;
  const target = selector ? card.querySelector(selector) : null;
  const image = target?.matches("img") ? target : target?.querySelector("img") || (!target ? card.querySelector("img") : null);
  if (image) {
    image.src = url;
    image.removeAttribute("srcset");
    return;
  }
  const visual = target || card.querySelector(".history-image,.event-inner,.card-visual,.photo-cover,.performer-image,.visual");
  if (!visual) return;
  const overlay = visual.classList.contains("event-inner")
    ? "linear-gradient(180deg,transparent 28%,rgba(0,0,0,.92)),"
    : visual.classList.contains("card-visual")
      ? "linear-gradient(180deg,transparent 42%,rgba(0,0,0,.82)),"
      : "";
  visual.style.setProperty("background-image", `${overlay}url("${safeCssUrl(url)}")`, "important");
  visual.style.backgroundSize = "cover";
  visual.style.backgroundPosition = visual.classList.contains("card-visual") ? "center top" : "center";
}

function setLink(card, url, selectors = "a.btn,a[href]") {
  if (!card || !url) return;
  const link = card.querySelector(selectors);
  if (!link) return;
  link.href = url;
  if (/^https?:/i.test(url)) {
    link.target = "_blank";
    link.rel = "noopener";
  }
}

function renderGeneratedItems(root, type, html) {
  if (!root) return;
  root.querySelectorAll(`[data-cms-generated="${type}"]`).forEach((element) => element.remove());
  if (html.trim()) root.insertAdjacentHTML("beforeend", html);
}

function eventCardHtml(event) {
  const imageStyle = event.coverUrl ? ` style="background-image:url('${safeCssUrl(event.coverUrl)}')"` : "";
  return `<article class="history-card" data-cms-generated="event">
    <div class="history-image"${imageStyle}></div>
    <div class="history-copy"><p class="date">${escapeHtml(String(event.date || "").replace("T", " "))}${event.location ? ` • ${escapeHtml(event.location)}` : ""}</p><h2>${escapeHtml(event.name || "Esemény")}</h2><p>${escapeHtml(event.description || "")}</p>${event.ticketUrl ? `<a class="btn primary" href="${escapeHtml(event.ticketUrl)}" target="_blank" rel="noopener">Jegyvásárlás</a>` : ""}</div>
  </article>`;
}

async function syncEvents() {
  const file = currentFile();
  if (file !== "index.html" && file !== "esemenyek.html" && !document.getElementById("firebaseEvents")) return;
  const { active, inactiveKeys } = await readCollectionState("events");
  const cards = file === "index.html"
    ? [...document.querySelectorAll("main .event-card")]
    : [...document.querySelectorAll("main .history-card")];
  const map = staticCardMap(cards, ["h2", "h3", ".card-title"], "events");
  hideInactiveStaticCards("events", inactiveKeys, map);
  const matched = new Set();

  active.forEach((event) => {
    const card = matchingCard("events", event, map);
    if (!card) return;
    showCard(card);
    matched.add(event.id);
    setImage(card, event.coverUrl, ".history-image,.event-inner,.card-visual");
    setLink(card, event.ticketUrl, "a.btn.primary,a[href*='tixa'],a[href*='jegy']");
    const heading = card.querySelector("h2,h3,.card-title");
    if (heading && event.name) heading.textContent = event.name;
    const description = card.querySelector(".history-copy > p:not(.date),.card-body p,.event-copy p:last-of-type");
    if (description && event.description) description.textContent = event.description;
  });

  // A főoldalon csak a meglévő eseménykártyákat frissítjük.
  // Az Események oldalon az új CMS-es események az eredeti eseménylistába kerülnek.
  if (file === "index.html") return;
  const root = document.getElementById("firebaseEvents") || document.querySelector("main .event-history");
  const unmatched = active.filter((event) => !matched.has(event.id)).sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  renderGeneratedItems(root, "event", unmatched.map(eventCardHtml).join(""));
}

function performerCardHtml(performer) {
  const image = performer.imageUrl || performer.photoUrl || performer.coverUrl || "";
  return `<article class="card" data-cms-generated="performer">${image ? `<div class="card-visual" style="background-image:linear-gradient(180deg,transparent 42%,rgba(0,0,0,.82)),url('${safeCssUrl(image)}')"><div class="card-title">${escapeHtml(performer.name || "Fellépő")}</div></div>` : ""}<div class="card-body"><div class="role">${escapeHtml(performer.role || "Fellépő")}</div><h3>${escapeHtml(performer.name || "Fellépő")}</h3>${performer.bio ? `<p>${escapeHtml(performer.bio)}</p>` : ""}</div></article>`;
}

async function syncPerformers() {
  if (currentFile() !== "fellepok.html" && !document.getElementById("firebasePerformers")) return;
  const { active, inactiveKeys } = await readCollectionState("performers");
  const cards = [...document.querySelectorAll("main article.card")].filter((card) => !card.closest("#firebasePerformers"));
  const map = staticCardMap(cards, ["h3", ".card-title"], "performers");
  hideInactiveStaticCards("performers", inactiveKeys, map);
  const matched = new Set();

  active.forEach((performer) => {
    const card = matchingCard("performers", performer, map);
    if (!card) return;
    showCard(card);
    matched.add(performer.id);
    const image = performer.imageUrl || performer.photoUrl || performer.coverUrl || "";
    let visual = card.querySelector(".card-visual[data-performer-photo]");
    if (image && !visual) {
      visual = document.createElement("div");
      visual.className = "card-visual";
      visual.dataset.performerPhoto = "true";
      card.insertBefore(visual, card.firstChild);
    }
    if (visual && image) setImage(card, image, ".card-visual[data-performer-photo]");
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
    setLink(card, performer.url, "a[href]");
  });

  const root = document.getElementById("firebasePerformers") || document.querySelector("main .grid3");
  const unmatched = active.filter((performer) => !matched.has(performer.id));
  renderGeneratedItems(root, "performer", unmatched.map(performerCardHtml).join(""));
}

function albumSourceIds(album) {
  return new Set([album.id, ...(Array.isArray(album._sourceIds) ? album._sourceIds : [])].filter(Boolean));
}

function albumPhotos(album, photos) {
  const ids = albumSourceIds(album);
  return photos.filter((photo) => ids.has(photo.albumId) && photo.deleted !== true);
}

function albumCover(album, photos) {
  return album.coverUrl || albumPhotos(album, photos)[0]?.url || "";
}

function openAlbum(album, photos) {
  let modal = document.getElementById("firebaseAlbumModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "firebaseAlbumModal";
    modal.className = "album-modal";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="album-modal-inner"><div class="album-modal-head"><div><div class="eyebrow">SIXTY NIGHT PARTY</div><h2>${escapeHtml(album.name || "Album")}</h2></div><button class="album-close" type="button">×</button></div><div class="album-grid">${photos.length ? photos.map((photo) => `<img loading="lazy" src="${escapeHtml(photo.url || "")}" alt="${escapeHtml(album.name || "Album")}">`).join("") : '<div class="empty-album">Nincs kép ebben az albumban.</div>'}</div></div>`;
  modal.classList.add("open");
  modal.querySelector(".album-close")?.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (event) => { if (event.target === modal) modal.classList.remove("open"); }, { once: true });
}

function albumCardHtml(album, photos) {
  const items = albumPhotos(album, photos);
  return `<article class="photo-album-card" data-cms-generated="album"><div class="photo-cover" style="background-image:url('${safeCssUrl(albumCover(album, photos))}')"></div><div class="photo-album-body"><h3>${escapeHtml(album.name || "Album")}</h3><p>${escapeHtml(album.description || "")}</p><div class="album-actions"><button class="btn primary" data-open-cms-album="${escapeHtml(album.id)}">Webes galéria (${items.length})</button>${album.facebook ? `<a class="btn ghost" href="${escapeHtml(album.facebook)}" target="_blank" rel="noopener">Facebook album</a>` : ""}</div></div></article>`;
}

async function syncAlbums() {
  if (currentFile() !== "fotok.html" && !document.getElementById("firebaseAlbums")) return;
  const [{ active, inactiveKeys }, photoState] = await Promise.all([readCollectionState("albums"), readCollectionState("photos")]);
  const photos = photoState.active;
  const cards = [...document.querySelectorAll(".photo-album-card")].filter((card) => !card.closest("#firebaseAlbums"));
  const map = staticCardMap(cards, ["h3"], "albums");
  hideInactiveStaticCards("albums", inactiveKeys, map);
  const matched = new Set();

  active.forEach((album) => {
    const card = matchingCard("albums", album, map);
    if (!card) return;
    showCard(card);
    matched.add(album.id);
    const items = albumPhotos(album, photos);
    setImage(card, albumCover(album, photos), ".photo-cover");
    const heading = card.querySelector("h3");
    if (heading && album.name) heading.textContent = album.name;
    const description = card.querySelector(".photo-album-body p");
    if (description && album.description) description.textContent = album.description;
    const facebook = [...card.querySelectorAll("a")].find((link) => /facebook/i.test(link.textContent));
    if (facebook && album.facebook) facebook.href = album.facebook;
    const galleryButton = card.querySelector("button");
    if (galleryButton) {
      galleryButton.disabled = false;
      galleryButton.textContent = `Webes galéria (${items.length})`;
      galleryButton.onclick = () => openAlbum(album, items);
    }
  });

  const root = document.getElementById("firebaseAlbums") || document.querySelector("main .photo-albums");
  const unmatched = active.filter((album) => !matched.has(album.id));
  renderGeneratedItems(root, "album", unmatched.map((album) => albumCardHtml(album, photos)).join(""));
  root?.querySelectorAll("[data-open-cms-album]").forEach((button) => {
    const album = unmatched.find((item) => item.id === button.dataset.openCmsAlbum);
    if (album) button.onclick = () => openAlbum(album, albumPhotos(album, photos));
  });
}

function videoCardHtml(video) {
  return `<article class="card" data-cms-generated="video"><div class="card-body"><h3>${escapeHtml(video.title || "Videó")}</h3><p>${escapeHtml(video.type || "")}</p><a class="btn primary" href="${escapeHtml(video.url || "#")}" target="_blank" rel="noopener">Videó megnyitása</a></div></article>`;
}

async function syncVideos() {
  if (currentFile() !== "videotar.html" && !document.getElementById("firebaseVideos")) return;
  const { active, inactiveKeys } = await readCollectionState("videos");
  const cards = [...document.querySelectorAll("main article.card")].filter((card) => !card.closest("#firebaseVideos"));
  const map = staticCardMap(cards, ["h3", ".card-title"], "videos");
  hideInactiveStaticCards("videos", inactiveKeys, map);
  const matched = new Set();

  active.forEach((video) => {
    const card = matchingCard("videos", video, map);
    if (!card) return;
    showCard(card);
    matched.add(video.id);
    setLink(card, video.url, "a.btn,a[href]");
    const heading = card.querySelector("h3,.card-title");
    if (heading && video.title) heading.textContent = video.title;
  });

  const root = document.getElementById("firebaseVideos") || document.querySelector("main .grid2");
  const unmatched = active.filter((video) => !matched.has(video.id));
  renderGeneratedItems(root, "video", unmatched.map(videoCardHtml).join(""));
}

async function syncSponsors() {
  const root = document.getElementById("firebaseSponsors") || document.querySelector("#sponsors .sponsors");
  if (!root) return;
  const { active } = await readCollectionState("sponsors");
  const sorted = [...active].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const staticCards = [...root.querySelectorAll(".sponsor")].filter((card) => card.dataset.cmsGenerated !== "sponsor");
  const cardMap = new Map();
  staticCards.forEach((card) => {
    const name = card.querySelector("span")?.textContent?.trim() || card.querySelector("img")?.alt?.trim() || "";
    const key = normalize(name);
    if (key && !cardMap.has(key)) cardMap.set(key, card);
  });
  const matched = new Set();
  sorted.forEach((sponsor) => {
    const key = normalize(sponsor.name || sponsor.id);
    const card = cardMap.get(key);
    if (!card) return;
    matched.add(sponsor.id);
    const image = card.querySelector("img");
    if (image && sponsor.logoUrl) image.src = sponsor.logoUrl;
    if (image && sponsor.name) image.alt = sponsor.name;
    const label = card.querySelector("span");
    if (label && sponsor.name) label.textContent = sponsor.name;
    if (sponsor.url) {
      card.href = sponsor.url;
      card.target = "_blank";
      card.rel = "noopener";
    }
  });
  const unmatched = sorted.filter((sponsor) => !matched.has(sponsor.id));
  renderGeneratedItems(root, "sponsor", unmatched.map((sponsor) => `<a class="sponsor" data-cms-generated="sponsor" href="${escapeHtml(sponsor.url || "#")}" ${sponsor.url ? 'target="_blank" rel="noopener"' : ""}><img src="${escapeHtml(sponsor.logoUrl || "")}" alt="${escapeHtml(sponsor.name || "Szponzor")}"><span>${escapeHtml(sponsor.name || "")}</span></a>`).join(""));
}

function installManagedPageStyles() {
  if (document.getElementById("cmsManagedPageStyles")) return;
  const style = document.createElement("style");
  style.id = "cmsManagedPageStyles";
  style.textContent = `
    .cms-managed-hero{min-height:380px;display:flex;align-items:flex-end;padding:70px 0 55px;background-size:cover;background-position:center;position:relative}
    .cms-managed-hero:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,5,10,.18),rgba(5,5,10,.94))}
    .cms-managed-hero .container{position:relative;z-index:1}.cms-managed-hero h1{font-size:clamp(2.5rem,8vw,6rem);line-height:.95;margin:.2em 0}
    .cms-managed-intro{max-width:850px;color:#c8c8d3;font-size:1.08rem;line-height:1.75}.cms-rich-content{line-height:1.8;color:#e8e8ee}
    .cms-rich-content img{max-width:100%;height:auto;border-radius:20px}.cms-rich-content h2,.cms-rich-content h3{margin-top:1.6em}.cms-rich-content a{color:#27d9ff}
  `;
  document.head.appendChild(style);
}

function renderManagedExistingPage(page) {
  installManagedPageStyles();
  const main = document.querySelector("main");
  if (!main) return;
  const cover = page.coverUrl ? `style="background-image:url('${safeCssUrl(page.coverUrl)}')"` : "";
  main.innerHTML = `<section class="cms-managed-hero" ${cover}><div class="container"><div class="eyebrow">SIXTY NIGHT PARTY</div><h1>${escapeHtml(page.heroTitle || page.title || "")}</h1>${page.intro ? `<p class="cms-managed-intro">${escapeHtml(page.intro)}</p>` : ""}</div></section><section class="section"><div class="container"><div class="cms-rich-content">${sanitizeHtml(page.content || "")}</div></div></section>`;
}

async function syncExistingPage() {
  const { active } = await readCollectionState("pages");
  const file = currentFile();
  const page = active.find((item) => item.pageType === "existing" && String(item.targetPath || "").replace(/^\//, "") === file);
  if (!page) return;

  if (page.seoTitle || page.title) document.title = `${page.seoTitle || page.title} | Sixty Night Party`;
  const meta = document.querySelector('meta[name="description"]');
  if (meta && (page.seoDescription || page.intro)) meta.content = page.seoDescription || page.intro;

  if (page.replaceMain === true) {
    renderManagedExistingPage(page);
    return;
  }

  const heading = document.querySelector("main .hero h1,main .page-hero h1,main h1");
  if (heading && page.heroTitle) heading.textContent = page.heroTitle;
  const intro = document.querySelector("main .hero p,main .page-hero p,main h1 + p");
  if (intro && page.intro) intro.textContent = page.intro;
  const hero = heading?.closest("section,.hero,.page-hero");
  if (hero && page.coverUrl) {
    hero.style.backgroundImage = `linear-gradient(180deg,rgba(5,5,10,.18),rgba(5,5,10,.88)),url("${safeCssUrl(page.coverUrl)}")`;
    hero.style.backgroundSize = "cover";
    hero.style.backgroundPosition = "center";
  }

  document.querySelector("[data-cms-existing-content]")?.remove();
  if (page.content) {
    installManagedPageStyles();
    const section = document.createElement("section");
    section.className = "section";
    section.dataset.cmsExistingContent = "true";
    section.innerHTML = `<div class="container"><div class="cms-rich-content">${sanitizeHtml(page.content)}</div></div>`;
    document.querySelector("main")?.appendChild(section);
  }
}

async function applySettings() {
  const snapshot = await getDoc(doc(db, "settings", "site"));
  if (!snapshot.exists()) return;
  const settings = snapshot.data();
  document.querySelectorAll("[data-site-hero]").forEach((element) => { if (settings.heroTitle) element.textContent = settings.heroTitle; });
  document.querySelectorAll("[data-featured-event]").forEach((element) => { if (settings.featuredEvent) element.textContent = settings.featuredEvent; });
  document.querySelectorAll("a[href^='mailto:']").forEach((link) => {
    if (!settings.email) return;
    const query = link.href.includes("?") ? link.href.slice(link.href.indexOf("?")) : "";
    link.href = `mailto:${settings.email}${query}`;
    if (/^[^\s@]+@[^\s@]+$/.test(link.textContent.trim())) link.textContent = settings.email;
  });
  document.querySelectorAll("a[href^='tel:']").forEach((link) => {
    if (!settings.phone) return;
    link.href = `tel:${String(settings.phone).replace(/\s+/g, "")}`;
  });
  document.querySelectorAll("a[href*='facebook.com']").forEach((link) => { if (settings.facebook && !/share\//i.test(link.href)) link.href = settings.facebook; });
  document.querySelectorAll("a[href*='instagram.com']").forEach((link) => { if (settings.instagram) link.href = settings.instagram; });
  document.querySelectorAll("[data-site-location]").forEach((element) => { if (settings.location) element.textContent = settings.location; });
}

async function boot() {
  const tasks = [applySettings(), syncExistingPage()];
  const file = currentFile();
  if (file === "index.html" || file === "esemenyek.html" || document.getElementById("firebaseEvents")) tasks.push(syncEvents());
  if (file === "fellepok.html" || document.getElementById("firebasePerformers")) tasks.push(syncPerformers());
  if (file === "fotok.html" || document.getElementById("firebaseAlbums")) tasks.push(syncAlbums());
  if (file === "videotar.html" || document.getElementById("firebaseVideos")) tasks.push(syncVideos());
  if (document.getElementById("firebaseSponsors")) tasks.push(syncSponsors());

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected") console.error("[Sixty Night] Nyilvános CMS hiba:", result.reason);
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
else boot();
