import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js?v=6.0.0";
import { LEGACY_CONTENT } from "./legacy-content.js?v=4.0.0";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = (id) => document.getElementById(id);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
}[char]));
const normalize = (value = "") => String(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/×/g, "x")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();
const slugify = (value = "") => normalize(value).replace(/\s+/g, "-");
const isAdmin = (user) => user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
const now = () => new Date().toISOString();
const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120'%3E%3Crect width='100%25' height='100%25' fill='%23222'/%3E%3C/svg%3E";

const state = {
  events: [], performers: [], albums: [], photos: [], videos: [], sponsors: [], tickets: [], pages: []
};

function toast(message, type = "ok") {
  const element = $("toast");
  element.textContent = message;
  element.className = `toast ${type}`;
  setTimeout(() => { element.className = "toast hidden"; }, 3500);
}

function identityKey(collectionName, item) {
  if (collectionName === "photos") return item.id;
  if (collectionName === "videos") return normalize(String(item.title || "").replace(/after\s*movie/gi, ""));
  if (collectionName === "pages") return normalize(item.pageType === "existing" ? item.targetPath : item.slug);
  return normalize(item.name || item.title || item.slug || item.id);
}

function itemScore(item) {
  let score = 0;
  if (item.coverUrl || item.imageUrl || item.logoUrl || item.photoUrl) score += 100;
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

function dedupeItems(collectionName, items) {
  const map = new Map();
  for (const item of items) {
    if (item.deleted === true || item.hidden === true) continue;
    const key = identityKey(collectionName, item) || item.id;
    map.set(key, map.has(key) ? choosePreferred(map.get(key), item) : item);
  }
  return [...map.values()];
}

const legacyByCollection = {
  events: LEGACY_CONTENT.events || [],
  performers: LEGACY_CONTENT.performers || [],
  albums: LEGACY_CONTENT.albums || [],
  videos: LEGACY_CONTENT.videos || [],
  sponsors: LEGACY_CONTENT.sponsors || [],
  tickets: LEGACY_CONTENT.tickets || []
};

function mergeWithLegacy(collectionName, firestoreItems) {
  const mergedById = new Map();
  for (const item of legacyByCollection[collectionName] || []) {
    mergedById.set(item.id, { ...item, isExistingWebsiteContent: true });
  }
  for (const item of firestoreItems) {
    mergedById.set(item.id, { ...(mergedById.get(item.id) || {}), ...item });
  }
  return dedupeItems(collectionName, [...mergedById.values()]);
}

async function readDocs(collectionName, sortField = "createdAt") {
  let firestoreItems = [];
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    firestoreItems = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  } catch (error) {
    console.error("Firestore olvasási hiba:", collectionName, error);
    toast(`A ${collectionName} adatai nem olvashatók.`, "error");
  }
  const items = collectionName === "pages"
    ? dedupeItems(collectionName, firestoreItems)
    : mergeWithLegacy(collectionName, firestoreItems);
  return items.sort((a, b) => String(b[sortField] || "").localeCompare(String(a[sortField] || "")));
}

async function uploadImage(file, folder, maxSize = 1800, quality = 0.84) {
  if (!file) return null;
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  if (Math.max(width, height) > maxSize) {
    const ratio = maxSize / Math.max(width, height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob) throw new Error("A kép átalakítása sikertelen.");
  const storagePath = `${folder}/${Date.now()}-${crypto.randomUUID()}.webp`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, { contentType: "image/webp" });
  return { url: await getDownloadURL(storageRef), path: storagePath };
}

async function removeStored(path) {
  if (!path) return;
  try { await deleteObject(ref(storage, path)); } catch (error) { console.warn("Storage törlés:", error); }
}

async function seedCollection(collectionName, items) {
  const snapshot = await getDocs(collection(db, collectionName));
  const existing = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  const byId = new Map(existing.map((item) => [item.id, item]));
  const byIdentity = new Map();
  for (const item of existing) {
    if (item.deleted === true) continue;
    const key = identityKey(collectionName, item);
    if (key && !byIdentity.has(key)) byIdentity.set(key, item);
  }

  for (const item of items) {
    const { id, ...defaults } = item;
    const equivalent = byId.get(id) || byIdentity.get(identityKey(collectionName, item));
    if (!equivalent) {
      await setDoc(doc(db, collectionName, id), { ...defaults, importedFromWebsite: true, createdAt: now(), updatedAt: now() });
      const created = { id, ...defaults, importedFromWebsite: true };
      byId.set(id, created);
      byIdentity.set(identityKey(collectionName, created), created);
      continue;
    }

    const missing = {};
    for (const [key, value] of Object.entries(defaults)) {
      const currentValue = equivalent[key];
      if ((currentValue === undefined || currentValue === null || currentValue === "") && value !== "") missing[key] = value;
    }
    if (Object.keys(missing).length) {
      await setDoc(doc(db, collectionName, equivalent.id), { ...missing, updatedAt: now() }, { merge: true });
      Object.assign(equivalent, missing);
    }
  }
}

async function importMissingWebsiteContent(automatic = false) {
  const systemRef = doc(db, "settings", "system");
  const systemSnapshot = await getDoc(systemRef);
  const version = systemSnapshot.exists() ? Number(systemSnapshot.data().legacySeedVersion || 0) : 0;
  if (automatic && version >= 2) return false;
  await seedCollection("events", LEGACY_CONTENT.events || []);
  await seedCollection("albums", LEGACY_CONTENT.albums || []);
  await seedCollection("videos", LEGACY_CONTENT.videos || []);
  await seedCollection("performers", LEGACY_CONTENT.performers || []);
  await seedCollection("sponsors", LEGACY_CONTENT.sponsors || []);
  const siteRef = doc(db, "settings", "site");
  const siteSnapshot = await getDoc(siteRef);
  if (!siteSnapshot.exists()) await setDoc(siteRef, LEGACY_CONTENT.settings || {});
  await setDoc(systemRef, { legacySeedVersion: 2, legacyImportedAt: now() }, { merge: true });
  return true;
}

async function cleanupDuplicates() {
  const collectionNames = ["events", "performers", "albums", "videos", "sponsors", "tickets", "pages"];
  let removed = 0;
  for (const collectionName of collectionNames) {
    const snapshot = await getDocs(collection(db, collectionName));
    const items = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).filter((item) => item.deleted !== true);
    const groups = new Map();
    for (const item of items) {
      const key = identityKey(collectionName, item);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const keep = group.reduce((best, item) => choosePreferred(best, item));
      for (const item of group) {
        if (item.id === keep.id) continue;
        await setDoc(doc(db, collectionName, item.id), { deleted: true, duplicateOf: keep.id, updatedAt: now() }, { merge: true });
        removed += 1;
      }
    }
  }
  return removed;
}

const views = ["dashboard", "events", "performers", "albums", "videos", "sponsors", "tickets", "pages", "settings"];
function showView(view) {
  for (const name of views) $(`${name}View`)?.classList.toggle("hidden", name !== view);
  document.querySelectorAll("#nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const navButton = document.querySelector(`#nav button[data-view="${view}"]`);
  $("viewTitle").textContent = navButton ? navButton.textContent.replace(/^\S+\s*/, "") : view;
}

document.querySelectorAll("#nav button").forEach((button) => { button.onclick = () => showView(button.dataset.view); });
document.querySelectorAll("[data-jump]").forEach((button) => { button.onclick = () => showView(button.dataset.jump); });

$("loginBtn").onclick = async () => {
  $("loginError").textContent = "";
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    const messages = {
      "auth/popup-blocked": "A böngésző blokkolta a bejelentkezési ablakot.",
      "auth/popup-closed-by-user": "A bejelentkezési ablak bezárult.",
      "auth/unauthorized-domain": "A domain nincs engedélyezve a Firebase-ben."
    };
    $("loginError").textContent = messages[error.code] || `Firebase: ${error.message || error.code}`;
  }
};
$("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("loginView").classList.remove("hidden");
    $("appView").classList.add("hidden");
    return;
  }
  if (!isAdmin(user)) {
    await signOut(auth);
    $("loginError").textContent = `Ez a fiók nem admin: ${user.email}`;
    return;
  }
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("userName").textContent = user.displayName || user.email;
  $("userPhoto").src = user.photoURL || "";
  try {
    const imported = await importMissingWebsiteContent(true);
    if (imported) toast("A hiányzó alapadatok bekerültek a Firebase-be.");
  } catch (error) {
    console.error("Automatikus import:", error);
    toast("Az alapadatok importja nem futott le.", "error");
  }
  await refreshAll();
});

$("importExistingBtn").onclick = async () => {
  if (!confirm("Pótoljam a hiányzó alapadatokat? A meglévő képeket és módosításokat nem írja felül.")) return;
  $("importExistingBtn").disabled = true;
  try {
    await importMissingWebsiteContent(false);
    await refreshAll();
    toast("A hiányzó alapadatok pótolva.");
  } catch (error) {
    toast(error.message || String(error), "error");
  } finally {
    $("importExistingBtn").disabled = false;
  }
};

$("cleanupDuplicatesBtn").onclick = async () => {
  if (!confirm("A rendszer az azonos nevű duplikációkból a legteljesebb, legfrissebb elemet tartja meg. Folytatod?")) return;
  $("cleanupDuplicatesBtn").disabled = true;
  try {
    const removed = await cleanupDuplicates();
    await refreshAll();
    toast(removed ? `${removed} duplikált elem elrejtve.` : "Nem találtam duplikációt.");
  } catch (error) {
    toast(error.message || String(error), "error");
  } finally {
    $("cleanupDuplicatesBtn").disabled = false;
  }
};

function itemHtml(image, title, subtitle, id, type) {
  return `<div class="item"><img src="${escapeHtml(image || placeholder)}"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(subtitle)}</p></div><div class="item-actions"><button class="btn ghost" data-edit="${type}:${id}">Szerkesztés</button><button class="btn danger" data-delete="${type}:${id}">Törlés</button></div></div>`;
}
function bindListActions(root, edit, remove) {
  root.querySelectorAll("[data-edit]").forEach((button) => { button.onclick = () => edit(button.dataset.edit.split(":").slice(1).join(":")); });
  root.querySelectorAll("[data-delete]").forEach((button) => { button.onclick = () => remove(button.dataset.delete.split(":").slice(1).join(":")); });
}

async function refreshAll() {
  await Promise.all([loadEvents(), loadPerformers(), loadAlbums(), loadVideos(), loadSponsors(), loadTickets(), loadPages(), loadSettings()]);
  $("countEvents").textContent = state.events.length;
  $("countPerformers").textContent = state.performers.length;
  $("countAlbums").textContent = state.albums.length;
  $("countPhotos").textContent = state.photos.length;
  $("countPages").textContent = state.pages.length;
}

async function loadEvents() {
  state.events = await readDocs("events", "date");
  $("eventsList").innerHTML = state.events.map((item) => itemHtml(item.coverUrl, item.name, `${item.date || ""} • ${item.location || ""}`, item.id, "event")).join("") || "<p>Nincs esemény.</p>";
  bindListActions($("eventsList"), editEvent, deleteEvent);
}
function editEvent(id) {
  const item = state.events.find((entry) => entry.id === id);
  if (!item) return;
  $("eventId").value = item.id;
  $("eventName").value = item.name || "";
  $("eventDate").value = String(item.date || "").slice(0, 16);
  $("eventLocation").value = item.location || "";
  $("eventTicketUrl").value = item.ticketUrl || "";
  $("eventDescription").value = item.description || "";
  $("eventPublished").value = String(item.published !== false);
  scrollTo(0, 0);
}
async function deleteEvent(id) {
  if (!confirm("Biztosan törlöd az eseményt?")) return;
  const item = state.events.find((entry) => entry.id === id);
  await removeStored(item?.coverPath);
  await setDoc(doc(db, "events", id), { deleted: true, updatedAt: now() }, { merge: true });
  toast("Esemény törölve.");
  await loadEvents();
}
$("saveEvent").onclick = async () => {
  try {
    const id = $("eventId").value;
    const old = id ? state.events.find((item) => item.id === id) || {} : {};
    const image = await uploadImage($("eventCover").files[0], "events");
    const data = {
      name: $("eventName").value.trim(), date: $("eventDate").value, location: $("eventLocation").value.trim(),
      ticketUrl: $("eventTicketUrl").value.trim(), description: $("eventDescription").value.trim(),
      published: $("eventPublished").value === "true", coverUrl: image?.url || old.coverUrl || "", coverPath: image?.path || old.coverPath || "",
      deleted: false, updatedAt: now(), createdAt: old.createdAt || now()
    };
    if (!data.name) throw new Error("Az esemény neve kötelező.");
    if (image && old.coverPath) await removeStored(old.coverPath);
    if (id) await setDoc(doc(db, "events", id), data, { merge: true });
    else await addDoc(collection(db, "events"), data);
    resetEvent(); toast("Esemény mentve."); await loadEvents();
  } catch (error) { toast(error.message, "error"); }
};
function resetEvent() {
  ["eventId", "eventName", "eventDate", "eventTicketUrl", "eventDescription"].forEach((id) => { $(id).value = ""; });
  $("eventLocation").value = "Sixty Night Party Park";
  $("eventPublished").value = "true";
  $("eventCover").value = "";
}
$("resetEvent").onclick = resetEvent;

async function loadPerformers() {
  state.performers = await readDocs("performers");
  $("performersList").innerHTML = state.performers.map((item) => itemHtml(item.imageUrl, item.name, item.role || "", item.id, "performer")).join("") || "<p>Nincs fellépő.</p>";
  bindListActions($("performersList"), editPerformer, deletePerformer);
}
function editPerformer(id) {
  const item = state.performers.find((entry) => entry.id === id);
  if (!item) return;
  $("performerId").value = item.id; $("performerName").value = item.name || ""; $("performerRole").value = item.role || "";
  $("performerBio").value = item.bio || ""; $("performerUrl").value = item.url || ""; scrollTo(0, 0);
}
async function deletePerformer(id) {
  if (!confirm("Törlöd a fellépőt?")) return;
  const item = state.performers.find((entry) => entry.id === id);
  await removeStored(item?.imagePath);
  await setDoc(doc(db, "performers", id), { deleted: true, updatedAt: now() }, { merge: true });
  toast("Fellépő törölve."); await loadPerformers();
}
$("savePerformer").onclick = async () => {
  try {
    const id = $("performerId").value;
    const old = id ? state.performers.find((item) => item.id === id) || {} : {};
    const image = await uploadImage($("performerImage").files[0], "performers");
    const data = { name: $("performerName").value.trim(), role: $("performerRole").value.trim(), bio: $("performerBio").value.trim(), url: $("performerUrl").value.trim(), imageUrl: image?.url || old.imageUrl || "", imagePath: image?.path || old.imagePath || "", deleted: false, updatedAt: now(), createdAt: old.createdAt || now() };
    if (!data.name) throw new Error("A fellépő neve kötelező.");
    if (image && old.imagePath) await removeStored(old.imagePath);
    if (id) await setDoc(doc(db, "performers", id), data, { merge: true }); else await addDoc(collection(db, "performers"), data);
    resetPerformer(); toast("Fellépő mentve."); await loadPerformers();
  } catch (error) { toast(error.message, "error"); }
};
function resetPerformer() {
  ["performerId", "performerName", "performerRole", "performerBio", "performerUrl"].forEach((id) => { $(id).value = ""; });
  $("performerImage").value = "";
}
$("resetPerformer").onclick = resetPerformer;

async function loadAlbums() {
  state.albums = await readDocs("albums", "date");
  state.photos = await readDocs("photos");
  $("albumsList").innerHTML = state.albums.map((item) => itemHtml(item.coverUrl, item.name, `${item.date || ""} • ${state.photos.filter((photo) => photo.albumId === item.id).length} kép`, item.id, "album")).join("") || "<p>Nincs album.</p>";
  bindListActions($("albumsList"), editAlbum, deleteAlbum);
  const options = '<option value="">Válassz albumot</option>' + state.albums.map((album) => `<option value="${escapeHtml(album.id)}">${escapeHtml(album.name)}</option>`).join("");
  $("uploadAlbumSelect").innerHTML = options;
  $("photoManagerAlbum").innerHTML = options;
}
function editAlbum(id) {
  const item = state.albums.find((entry) => entry.id === id);
  if (!item) return;
  $("albumId").value = item.id; $("albumName").value = item.name || ""; $("albumDate").value = item.date || "";
  $("albumFacebook").value = item.facebook || ""; $("albumDescription").value = item.description || ""; $("albumPublished").value = String(item.published !== false); scrollTo(0, 0);
}
async function deleteAlbum(id) {
  if (!confirm("Az album és a feltöltött képei törlődnek. Biztos?")) return;
  for (const photo of state.photos.filter((item) => item.albumId === id)) {
    await removeStored(photo.storagePath); await deleteDoc(doc(db, "photos", photo.id));
  }
  const album = state.albums.find((item) => item.id === id);
  await removeStored(album?.coverPath);
  await setDoc(doc(db, "albums", id), { deleted: true, updatedAt: now() }, { merge: true });
  toast("Album törölve."); await loadAlbums();
}
$("saveAlbum").onclick = async () => {
  try {
    const id = $("albumId").value;
    const old = id ? state.albums.find((item) => item.id === id) || {} : {};
    const image = await uploadImage($("albumCover").files[0], "album-covers");
    const data = { name: $("albumName").value.trim(), date: $("albumDate").value, facebook: $("albumFacebook").value.trim(), description: $("albumDescription").value.trim(), published: $("albumPublished").value === "true", coverUrl: image?.url || old.coverUrl || "", coverPath: image?.path || old.coverPath || "", deleted: false, updatedAt: now(), createdAt: old.createdAt || now() };
    if (!data.name) throw new Error("Az album neve kötelező.");
    if (image && old.coverPath) await removeStored(old.coverPath);
    if (id) await setDoc(doc(db, "albums", id), data, { merge: true }); else await addDoc(collection(db, "albums"), data);
    resetAlbum(); toast("Album mentve."); await loadAlbums();
  } catch (error) { toast(error.message, "error"); }
};
function resetAlbum() {
  ["albumId", "albumName", "albumDate", "albumFacebook", "albumDescription"].forEach((id) => { $(id).value = ""; });
  $("albumPublished").value = "true"; $("albumCover").value = "";
}
$("resetAlbum").onclick = resetAlbum;

$("uploadPhotos").onclick = async () => {
  const albumId = $("uploadAlbumSelect").value;
  const files = [...$("albumPhotos").files];
  if (!albumId || !files.length) return toast("Válassz albumot és képeket.", "error");
  $("uploadPhotos").disabled = true;
  for (let index = 0; index < files.length; index += 1) {
    try {
      const image = await uploadImage(files[index], `albums/${albumId}`, 2000, 0.82);
      await addDoc(collection(db, "photos"), { albumId, url: image.url, storagePath: image.path, name: files[index].name, order: Date.now() + index, createdAt: now() });
      $("uploadProgress").style.width = `${Math.round(((index + 1) / files.length) * 100)}%`;
      $("uploadStatus").textContent = `${index + 1} / ${files.length} kép feltöltve`;
    } catch (error) { toast(`${files[index].name}: ${error.message}`, "error"); }
  }
  $("uploadPhotos").disabled = false; $("albumPhotos").value = ""; toast("Képfeltöltés kész."); await loadAlbums();
};
$("photoManagerAlbum").onchange = renderPhotos;
function renderPhotos() {
  const albumId = $("photoManagerAlbum").value;
  const photos = state.photos.filter((photo) => photo.albumId === albumId);
  $("photosList").innerHTML = photos.map((photo) => `<div class="item"><img src="${escapeHtml(photo.url)}"><div><h3>${escapeHtml(photo.name || "Fotó")}</h3><p>${escapeHtml(photo.createdAt || "")}</p></div><div class="item-actions"><button class="btn danger" data-photo-delete="${escapeHtml(photo.id)}">Törlés</button></div></div>`).join("") || "<p>Nincs kép ebben az albumban.</p>";
  $("photosList").querySelectorAll("[data-photo-delete]").forEach((button) => {
    button.onclick = async () => {
      if (!confirm("Törlöd a képet?")) return;
      const photo = state.photos.find((item) => item.id === button.dataset.photoDelete);
      await removeStored(photo?.storagePath); await deleteDoc(doc(db, "photos", button.dataset.photoDelete)); await loadAlbums(); renderPhotos(); toast("Kép törölve.");
    };
  });
}

async function loadVideos() {
  state.videos = await readDocs("videos");
  $("videosList").innerHTML = state.videos.map((item) => itemHtml("", item.title, `${item.type || ""} • ${item.url || ""}`, item.id, "video")).join("") || "<p>Nincs videó.</p>";
  bindListActions($("videosList"), (id) => fillSimple("video", id), (id) => deleteSimple("videos", id, loadVideos));
}
async function loadSponsors() {
  state.sponsors = await readDocs("sponsors");
  $("sponsorsList").innerHTML = state.sponsors.map((item) => itemHtml(item.logoUrl, item.name, item.url || "", item.id, "sponsor")).join("") || "<p>Nincs szponzor.</p>";
  bindListActions($("sponsorsList"), (id) => fillSimple("sponsor", id), deleteSponsor);
}
async function loadTickets() {
  state.tickets = await readDocs("tickets");
  $("ticketsList").innerHTML = state.tickets.map((item) => itemHtml("", item.name, `${item.price || ""} • ${item.url || ""}`, item.id, "ticket")).join("") || "<p>Nincs jegy.</p>";
  bindListActions($("ticketsList"), (id) => fillSimple("ticket", id), (id) => deleteSimple("tickets", id, loadTickets));
}
function fillSimple(type, id) {
  const map = { video: state.videos, sponsor: state.sponsors, ticket: state.tickets };
  const item = map[type].find((entry) => entry.id === id);
  if (!item) return;
  Object.entries(item).forEach(([key, value]) => {
    const element = $(`${type}${key[0].toUpperCase()}${key.slice(1)}`);
    if (element) element.value = String(value ?? "");
  });
  $(`${type}Id`).value = id; scrollTo(0, 0);
}
async function deleteSimple(collectionName, id, reload) {
  if (!confirm("Törlöd?")) return;
  await setDoc(doc(db, collectionName, id), { deleted: true, updatedAt: now() }, { merge: true });
  toast("Elem törölve."); await reload();
}
async function saveSimple(collectionName, prefix, fields, reload) {
  try {
    const id = $(`${prefix}Id`).value;
    const data = { deleted: false, updatedAt: now() };
    fields.forEach((field) => {
      let value = $(`${prefix}${field[0].toUpperCase()}${field.slice(1)}`).value;
      if (value === "true" || value === "false") value = value === "true";
      data[field] = value;
    });
    if (id) await setDoc(doc(db, collectionName, id), data, { merge: true }); else await addDoc(collection(db, collectionName), { ...data, createdAt: now() });
    resetSimple(prefix, fields); toast("Mentve."); await reload();
  } catch (error) { toast(error.message, "error"); }
}
function resetSimple(prefix, fields) {
  $(`${prefix}Id`).value = "";
  fields.forEach((field) => { const element = $(`${prefix}${field[0].toUpperCase()}${field.slice(1)}`); if (element) element.value = ""; });
}
$("saveVideo").onclick = () => saveSimple("videos", "video", ["title", "type", "url"], loadVideos);
$("resetVideo").onclick = () => resetSimple("video", ["title", "url"]);
$("saveTicket").onclick = () => saveSimple("tickets", "ticket", ["name", "price", "url", "active"], loadTickets);
$("resetTicket").onclick = () => resetSimple("ticket", ["name", "price", "url"]);
async function deleteSponsor(id) {
  if (!confirm("Törlöd a szponzort?")) return;
  const item = state.sponsors.find((entry) => entry.id === id);
  await removeStored(item?.logoPath);
  await setDoc(doc(db, "sponsors", id), { deleted: true, updatedAt: now() }, { merge: true });
  toast("Szponzor törölve."); await loadSponsors();
}
$("saveSponsor").onclick = async () => {
  try {
    const id = $("sponsorId").value;
    const old = id ? state.sponsors.find((item) => item.id === id) || {} : {};
    const image = await uploadImage($("sponsorLogo").files[0], "sponsors", 1200, 0.9);
    const data = { name: $("sponsorName").value.trim(), url: $("sponsorUrl").value.trim(), order: Number($("sponsorOrder").value || 0), logoUrl: image?.url || old.logoUrl || "", logoPath: image?.path || old.logoPath || "", deleted: false, updatedAt: now(), createdAt: old.createdAt || now() };
    if (!data.name) throw new Error("A szponzor neve kötelező.");
    if (image && old.logoPath) await removeStored(old.logoPath);
    if (id) await setDoc(doc(db, "sponsors", id), data, { merge: true }); else await addDoc(collection(db, "sponsors"), data);
    resetSimple("sponsor", ["name", "url", "order"]); $("sponsorLogo").value = ""; toast("Szponzor mentve."); await loadSponsors();
  } catch (error) { toast(error.message, "error"); }
};
$("resetSponsor").onclick = () => resetSimple("sponsor", ["name", "url", "order"]);

function pagePublicUrl(page) {
  return page.pageType === "existing" ? page.targetPath : `oldal.html?slug=${encodeURIComponent(page.slug || page.id)}`;
}
function updatePageTypeFields() {
  const existing = $("pagePageType").value === "existing";
  $("pageTargetPath").disabled = !existing;
  $("pageSlug").disabled = existing;
  if (existing) $("pageMenuVisible").value = "false";
}
$("pagePageType").onchange = updatePageTypeFields;
async function loadPages() {
  state.pages = await readDocs("pages", "order");
  $("pagesList").innerHTML = state.pages.map((page) => `<div class="item"><img src="${escapeHtml(page.coverUrl || placeholder)}"><div><h3>${escapeHtml(page.title || page.heroTitle || page.slug)}</h3><p>${escapeHtml(page.pageType === "existing" ? `Meglévő: ${page.targetPath}` : `Egyedi: ${page.slug}`)} • ${page.published === false ? "Rejtett" : "Publikus"}</p></div><div class="item-actions"><a class="btn ghost" target="_blank" rel="noopener" href="${escapeHtml(pagePublicUrl(page))}">Előnézet</a><button class="btn ghost" data-page-edit="${escapeHtml(page.id)}">Szerkesztés</button><button class="btn danger" data-page-delete="${escapeHtml(page.id)}">Törlés</button></div></div>`).join("") || "<p>Nincs létrehozott oldal.</p>";
  $("pagesList").querySelectorAll("[data-page-edit]").forEach((button) => { button.onclick = () => editPage(button.dataset.pageEdit); });
  $("pagesList").querySelectorAll("[data-page-delete]").forEach((button) => { button.onclick = () => deletePage(button.dataset.pageDelete); });
}
function editPage(id) {
  const page = state.pages.find((item) => item.id === id);
  if (!page) return;
  $("pageId").value = page.id; $("pageTitle").value = page.title || ""; $("pageMenuLabel").value = page.menuLabel || "";
  $("pagePageType").value = page.pageType || "custom"; $("pageSlug").value = page.slug || ""; $("pageTargetPath").value = page.targetPath || "";
  $("pageOrder").value = Number(page.order || 50); $("pageEyebrow").value = page.eyebrow || "SIXTY NIGHT PARTY"; $("pageHeroTitle").value = page.heroTitle || "";
  $("pageIntro").value = page.intro || ""; $("pageBodyHtml").value = page.bodyHtml || ""; $("pagePublished").value = String(page.published !== false);
  $("pageMenuVisible").value = String(page.menuVisible !== false); $("pageReplaceMain").value = String(page.replaceMain === true);
  $("pagePreview").href = pagePublicUrl(page); $("pagePreview").classList.remove("hidden"); updatePageTypeFields(); scrollTo(0, 0);
}
async function deletePage(id) {
  if (!confirm("Törlöd az oldalt?")) return;
  const page = state.pages.find((item) => item.id === id);
  await removeStored(page?.coverPath);
  await setDoc(doc(db, "pages", id), { deleted: true, updatedAt: now() }, { merge: true });
  toast("Oldal törölve."); await loadPages();
}
$("savePage").onclick = async () => {
  try {
    const id = $("pageId").value;
    const old = id ? state.pages.find((item) => item.id === id) || {} : {};
    const pageType = $("pagePageType").value;
    const title = $("pageTitle").value.trim();
    const slug = pageType === "custom" ? slugify($("pageSlug").value.trim() || title) : "";
    const targetPath = pageType === "existing" ? $("pageTargetPath").value : "";
    if (!title) throw new Error("Az oldal neve kötelező.");
    if (pageType === "custom" && !slug) throw new Error("Az URL azonosító kötelező.");
    if (pageType === "existing" && !targetPath) throw new Error("Válassz meglévő oldalt.");
    const key = normalize(pageType === "existing" ? targetPath : slug);
    const duplicate = state.pages.find((page) => page.id !== id && identityKey("pages", page) === key);
    if (duplicate) throw new Error("Ehhez az URL-hez már tartozik oldal.");
    const image = await uploadImage($("pageCover").files[0], "pages", 2000, 0.86);
    const data = {
      title, menuLabel: $("pageMenuLabel").value.trim() || title, pageType, slug, targetPath,
      order: Number($("pageOrder").value || 50), eyebrow: $("pageEyebrow").value.trim(), heroTitle: $("pageHeroTitle").value.trim() || title,
      intro: $("pageIntro").value.trim(), bodyHtml: $("pageBodyHtml").value, coverUrl: image?.url || old.coverUrl || "", coverPath: image?.path || old.coverPath || "",
      published: $("pagePublished").value === "true", menuVisible: $("pageMenuVisible").value === "true", replaceMain: $("pageReplaceMain").value === "true",
      deleted: false, updatedAt: now(), createdAt: old.createdAt || now()
    };
    if (image && old.coverPath) await removeStored(old.coverPath);
    const documentId = id || (pageType === "custom" ? slug : `existing-${targetPath.replace(/\.html$/i, "").replace(/[^a-z0-9-]/gi, "-")}`);
    await setDoc(doc(db, "pages", documentId), data, { merge: true });
    resetPage(); toast("Oldal mentve."); await loadPages();
  } catch (error) { toast(error.message, "error"); }
};
function resetPage() {
  ["pageId", "pageTitle", "pageMenuLabel", "pageSlug", "pageHeroTitle", "pageIntro", "pageBodyHtml"].forEach((id) => { $(id).value = ""; });
  $("pagePageType").value = "custom"; $("pageTargetPath").value = ""; $("pageOrder").value = "50"; $("pageEyebrow").value = "SIXTY NIGHT PARTY";
  $("pagePublished").value = "true"; $("pageMenuVisible").value = "true"; $("pageReplaceMain").value = "false"; $("pageCover").value = "";
  $("pagePreview").classList.add("hidden"); updatePageTypeFields();
}
$("resetPage").onclick = resetPage;
updatePageTypeFields();

async function loadSettings() {
  const snapshot = await getDoc(doc(db, "settings", "site"));
  if (!snapshot.exists()) return;
  const settings = snapshot.data();
  ["heroTitle", "featuredEvent", "email", "phone", "facebook", "instagram", "location"].forEach((key) => {
    const element = $(`setting${key[0].toUpperCase()}${key.slice(1)}`);
    if (element) element.value = settings[key] || "";
  });
}
$("saveSettings").onclick = async () => {
  const data = {};
  ["heroTitle", "featuredEvent", "email", "phone", "facebook", "instagram", "location"].forEach((key) => { data[key] = $(`setting${key[0].toUpperCase()}${key.slice(1)}`).value.trim(); });
  await setDoc(doc(db, "settings", "site"), data, { merge: true }); toast("Beállítások mentve.");
};
