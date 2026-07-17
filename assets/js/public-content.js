import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=4.2.0";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[char]));

const normalizeName = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

async function readCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.published !== false && item.deleted !== true && item.hidden !== true);
}

function getAlbumCover(album, photos) {
  return album.coverUrl || photos.find((photo) => photo.albumId === album.id)?.url || "";
}

function syncStaticAlbumCovers(albums, photos) {
  const staticCards = [...document.querySelectorAll(".photo-albums .photo-album-card")]
    .filter((card) => !card.closest("#firebaseAlbums"));

  for (const card of staticCards) {
    const title = card.querySelector("h3")?.textContent;
    if (!title) continue;

    const album = albums.find((item) => normalizeName(item.name) === normalizeName(title));
    if (!album) continue;

    const coverUrl = getAlbumCover(album, photos);
    if (!coverUrl) continue;

    const cover = card.querySelector(".photo-cover");
    if (!cover) continue;

    cover.style.backgroundImage = `url("${coverUrl.replace(/"/g, "%22")}")`;
    cover.dataset.firebaseCover = "true";
  }
}

async function renderAlbums() {
  const [albums, photos] = await Promise.all([
    readCollection("albums"),
    readCollection("photos")
  ]);

  syncStaticAlbumCovers(albums, photos);

  const root = document.getElementById("firebaseAlbums");
  if (!root) return;

  if (!albums.length) {
    root.innerHTML = "<p>Még nincs Firebase-album feltöltve.</p>";
    return;
  }

  root.innerHTML = albums
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .map((album) => {
      const coverUrl = getAlbumCover(album, photos);
      const photoCount = photos.filter((photo) => photo.albumId === album.id).length;
      const facebookButton = album.facebook
        ? `<a class="btn ghost" target="_blank" rel="noopener" href="${escapeHtml(album.facebook)}">Facebook album</a>`
        : "";

      return `
        <article class="photo-album-card">
          <div class="photo-cover" style="background-image:url('${escapeHtml(coverUrl)}')"></div>
          <div class="photo-album-body">
            <h3>${escapeHtml(album.name)}</h3>
            <p>${escapeHtml(album.description || "")}</p>
            <div class="album-actions">
              <button class="btn primary" data-open-fb-album="${escapeHtml(album.id)}">Webes galéria (${photoCount})</button>
              ${facebookButton}
            </div>
          </div>
        </article>`;
    })
    .join("");

  root.querySelectorAll("[data-open-fb-album]").forEach((button) => {
    button.addEventListener("click", () => {
      const album = albums.find((item) => item.id === button.dataset.openFbAlbum);
      const albumPhotos = photos.filter((photo) => photo.albumId === button.dataset.openFbAlbum);
      if (album) openAlbum(album, albumPhotos);
    });
  });
}

function openAlbum(album, photos) {
  let modal = document.getElementById("firebaseAlbumModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "firebaseAlbumModal";
    modal.className = "album-modal";
    document.body.appendChild(modal);
  }

  const images = photos.length
    ? photos.map((photo) => `<img loading="lazy" src="${escapeHtml(photo.url)}" alt="${escapeHtml(album.name)}">`).join("")
    : '<div class="empty-album">Nincs kép.</div>';

  modal.innerHTML = `
    <div class="album-modal-inner">
      <div class="album-modal-head">
        <div><div class="eyebrow">SIXTY NIGHT PARTY</div><h2>${escapeHtml(album.name)}</h2></div>
        <button class="album-close" type="button">×</button>
      </div>
      <div class="album-grid">${images}</div>
    </div>`;

  modal.classList.add("open");
  modal.querySelector(".album-close")?.addEventListener("click", () => modal.classList.remove("open"));
}

async function renderEvents() {
  const root = document.getElementById("firebaseEvents");
  if (!root) return;
  const events = await readCollection("events");
  root.innerHTML = events
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .map((event) => `
      <article class="card">
        <div class="card-visual" style="background-image:url('${escapeHtml(event.coverUrl || "")}')">
          <div class="card-title">${escapeHtml(event.name)}</div>
        </div>
        <div class="card-body">
          <p>${escapeHtml(event.description || "")}</p>
          <p><strong>${escapeHtml(event.date?.replace("T", " ") || "")}</strong> • ${escapeHtml(event.location || "")}</p>
          ${event.ticketUrl ? `<a class="btn primary" href="${escapeHtml(event.ticketUrl)}" target="_blank">Jegyvásárlás</a>` : ""}
        </div>
      </article>`)
    .join("") || "<p>Nincs közelgő esemény.</p>";
}

async function renderPerformers() {
  const root = document.getElementById("firebasePerformers");
  if (!root) return;
  const performers = await readCollection("performers");
  root.innerHTML = performers.map((performer) => `
    <article class="card">
      <div class="card-visual" style="background-image:url('${escapeHtml(performer.imageUrl || "")}')">
        <div class="card-title">${escapeHtml(performer.name)}</div>
      </div>
      <div class="card-body"><strong>${escapeHtml(performer.role || "")}</strong><p>${escapeHtml(performer.bio || "")}</p></div>
    </article>`).join("") || "<p>Nincs adat.</p>";
}

async function renderVideos() {
  const root = document.getElementById("firebaseVideos");
  if (!root) return;
  const videos = await readCollection("videos");
  root.innerHTML = videos.map((video) => `
    <article class="card"><div class="card-body"><h3>${escapeHtml(video.title)}</h3><p>${escapeHtml(video.type || "")}</p><a class="btn primary" href="${escapeHtml(video.url)}" target="_blank">Videó megnyitása</a></div></article>`).join("") || "<p>Nincs videó.</p>";
}

async function renderSponsors() {
  const root = document.getElementById("firebaseSponsors");
  if (!root) return;
  const sponsors = await readCollection("sponsors");
  root.innerHTML = sponsors
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((sponsor) => `<a class="sponsor" href="${escapeHtml(sponsor.url || "#")}" target="_blank"><img src="${escapeHtml(sponsor.logoUrl || "")}" alt="${escapeHtml(sponsor.name)}"></a>`)
    .join("") || "<p>Nincs szponzor.</p>";
}

async function applySettings() {
  const snapshot = await getDoc(doc(db, "settings", "site"));
  if (!snapshot.exists()) return;
  const settings = snapshot.data();
  document.querySelectorAll("[data-site-hero]").forEach((element) => {
    element.textContent = settings.heroTitle || element.textContent;
  });
}

async function bootPublicContent() {
  const tasks = [renderAlbums(), renderEvents(), renderPerformers(), renderVideos(), renderSponsors(), applySettings()];
  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected") console.error("Nyilvános Firebase tartalomhiba:", result.reason);
  });
}

bootPublicContent();
