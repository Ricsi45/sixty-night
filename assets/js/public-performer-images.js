import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=4.4.0";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

function normalizeName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function imageOf(performer) {
  return performer.imageUrl || performer.photoUrl || performer.coverUrl || "";
}

function findStaticCard(name) {
  const target = normalizeName(name);
  const headings = [...document.querySelectorAll("article.card h3")];
  const heading = headings.find((item) => normalizeName(item.textContent) === target);
  return heading?.closest("article.card") || null;
}

function applyImage(card, performer) {
  const url = imageOf(performer);
  if (!card || !url) return;

  let visual = card.querySelector(".card-visual[data-performer-photo]");
  if (!visual) {
    visual = document.createElement("div");
    visual.className = "card-visual";
    visual.dataset.performerPhoto = "true";
    card.insertBefore(visual, card.firstChild);
  }

  visual.style.backgroundImage = `linear-gradient(180deg, transparent 42%, rgba(0,0,0,.82)), url("${url.replace(/"/g, "%22")}")`;
  visual.style.backgroundSize = "cover";
  visual.style.backgroundPosition = "center top";
  visual.setAttribute("role", "img");
  visual.setAttribute("aria-label", `${performer.name || "Fellépő"} fotója`);
}

async function syncPerformerImages() {
  try {
    const snapshot = await getDocs(collection(db, "performers"));
    const performers = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.deleted !== true && item.hidden !== true && imageOf(item));

    for (const performer of performers) {
      applyImage(findStaticCard(performer.name), performer);
    }

    console.info(`[Sixty Night] ${performers.length} fellépőkép ellenőrizve.`);
  } catch (error) {
    console.error("[Sixty Night] Fellépőképek szinkronhibája:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", syncPerformerImages, { once: true });
} else {
  syncPerformerImages();
}
