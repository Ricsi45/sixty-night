import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=4.3.0";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadCollection(name) {
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

function setCover(card, url) {
  const cover = card.querySelector(".photo-cover");
  if (!cover || !url) return false;
  cover.style.setProperty("background-image", `url("${String(url).replace(/"/g, "%22")}")`, "important");
  cover.dataset.firebaseCoverLoaded = "true";
  return true;
}

async function syncAlbumCovers() {
  try {
    const [albums, photos] = await Promise.all([
      loadCollection("albums"),
      loadCollection("photos")
    ]);

    const albumsById = new Map(albums.map((album) => [album.id, album]));
    let changed = 0;

    document.querySelectorAll(".photo-album-card[data-album-id]").forEach((card) => {
      const albumId = card.dataset.albumId;
      const album = albumsById.get(albumId);
      if (!album || album.deleted === true || album.hidden === true) return;

      const firstPhoto = photos.find((photo) => photo.albumId === albumId && photo.deleted !== true);
      const coverUrl = album.coverUrl || firstPhoto?.url || "";
      if (setCover(card, coverUrl)) changed += 1;
    });

    console.info(`[Sixty Night] ${changed} album borító frissítve Firebase-ből.`);
  } catch (error) {
    console.error("[Sixty Night] Album borító szinkronhiba:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", syncAlbumCovers, { once: true });
} else {
  syncAlbumCovers();
}
