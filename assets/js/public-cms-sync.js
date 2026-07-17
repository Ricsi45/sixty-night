import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=5.0.0";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const norm = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));

async function readCollection(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(item => ({ id: item.id, ...item.data() })).filter(item => item.published !== false);
}
function bestContainerByText(name) {
  const target = norm(name);
  const nodes = [...document.querySelectorAll("article,.card,.event-card,.performer-card,.photo-album-card,.sponsor,section div")];
  return nodes.find(node => norm(node.textContent).includes(target)) || null;
}
function setImage(container, url) {
  if (!container || !url) return;
  const img = container.querySelector("img");
  if (img) { img.src = url; img.removeAttribute("srcset"); }
  const visual = container.querySelector(".card-visual,.event-image,.performer-image,.photo-cover,[style*='background-image']") || container;
  if (!img && visual) visual.style.backgroundImage = `url("${String(url).replace(/"/g, "%22")}")`;
}
function setLink(container, url) {
  if (!container || !url) return;
  const link = container.querySelector("a.btn,a[href]");
  if (link) { link.href = url; if (/^https?:/i.test(url)) { link.target = "_blank"; link.rel = "noopener"; } }
}
function updateText(selector, value) { if (!value) return; document.querySelectorAll(selector).forEach(el => { el.textContent = value; }); }

async function syncSettings() {
  const snap = await getDoc(doc(db, "settings", "site"));
  if (!snap.exists()) return;
  const x = snap.data();
  updateText("[data-site-hero]", x.heroTitle);
  if (x.heroTitle) {
    const hero = document.querySelector(".hero h1,.page-hero h1");
    if (hero && /éjszaka|night|sixty/i.test(hero.textContent)) hero.textContent = x.heroTitle;
  }
  if (x.featuredEvent) updateText("[data-featured-event]", x.featuredEvent);
  document.querySelectorAll("a[href^='mailto:']").forEach(a => { if (x.email) { a.href = `mailto:${x.email}`; a.textContent = x.email; } });
  document.querySelectorAll("a[href^='tel:']").forEach(a => { if (x.phone) { a.href = `tel:${x.phone.replace(/\s+/g, "")}`; a.textContent = x.phone; } });
  document.querySelectorAll("a[href*='facebook.com']").forEach(a => { if (x.facebook) a.href = x.facebook; });
  document.querySelectorAll("a[href*='instagram.com']").forEach(a => { if (x.instagram) a.href = x.instagram; });
  if (x.location) document.querySelectorAll("[data-site-location]").forEach(el => el.textContent = x.location);
}

async function syncEvents() {
  const items = await readCollection("events");
  for (const item of items) {
    const card = bestContainerByText(item.name);
    if (!card) continue;
    setImage(card, item.coverUrl);
    setLink(card, item.ticketUrl);
    const title = card.querySelector("h2,h3,.card-title"); if (title && item.name) title.textContent = item.name;
    const desc = card.querySelector("p"); if (desc && item.description) desc.textContent = item.description;
  }
}
async function syncPerformers() {
  const items = await readCollection("performers");
  for (const item of items) {
    const card = bestContainerByText(item.name);
    if (!card) continue;
    setImage(card, item.imageUrl);
    setLink(card, item.url);
    const bio = [...card.querySelectorAll("p")].pop(); if (bio && item.bio) bio.textContent = item.bio;
  }
}
async function syncAlbums() {
  const items = await readCollection("albums");
  for (const item of items) {
    const card = bestContainerByText(item.name);
    if (!card) continue;
    setImage(card, item.coverUrl);
    setLink(card, item.facebook);
    const desc = card.querySelector("p"); if (desc && item.description) desc.textContent = item.description;
  }
}
async function syncVideos() {
  const items = await readCollection("videos");
  for (const item of items) {
    const card = bestContainerByText(item.title);
    if (!card) continue;
    setLink(card, item.url);
    const title = card.querySelector("h2,h3,.card-title"); if (title) title.textContent = item.title;
  }
}
async function syncSponsors() {
  const items = await readCollection("sponsors");
  for (const item of items) {
    const card = bestContainerByText(item.name);
    if (!card) continue;
    setImage(card, item.logoUrl);
    setLink(card, item.url);
  }
}
async function syncTickets() {
  const items = await readCollection("tickets");
  for (const item of items) {
    const title = item.name || item.title || item.event || "";
    const card = bestContainerByText(title);
    if (!card) continue;
    setLink(card, item.url || item.ticketUrl);
    const price = card.querySelector(".price,[data-price]"); if (price && item.price) price.textContent = item.price;
  }
}

Promise.allSettled([syncSettings(), syncEvents(), syncPerformers(), syncAlbums(), syncVideos(), syncSponsors(), syncTickets()]).then(results => {
  results.forEach(result => { if (result.status === "rejected") console.error("[Sixty Night CMS sync]", result.reason); });
});
