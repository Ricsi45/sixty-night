
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js?v=6.3.0";
import { LEGACY_CONTENT } from "./legacy-content.js?v=6.3.0";

let app, auth, db, storage;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  document.addEventListener("DOMContentLoaded", () => {
    const errorBox = document.getElementById("loginError");
    if (errorBox) {
      errorBox.textContent = "Firebase inicializálási hiba: " + (error?.message || error);
    }
  });
  throw error;
}
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const toast=(m,type="ok")=>{const t=$("toast");t.textContent=m;t.className=`toast ${type}`;setTimeout(()=>t.className="toast hidden",3500)};
const isAdmin=u=>u && u.email && u.email.toLowerCase()===ADMIN_EMAIL.toLowerCase();

$("loginBtn").onclick=async()=>{
  $("loginError").textContent="";
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  } catch(e) {
    console.error("Firebase Google-belépési hiba:", e);
    const messages={
      "auth/popup-blocked":"A böngésző blokkolta a bejelentkezési ablakot. Engedélyezd a felugró ablakokat.",
      "auth/popup-closed-by-user":"A bejelentkezési ablak bezárult.",
      "auth/unauthorized-domain":"A domain nincs engedélyezve. Ellenőrizd a Firebase Authentication Authorized domains listáját, valamint a Google Cloud API-kulcs HTTP-hivatkozóit.",
      "auth/api-key-not-valid.-please-pass-a-valid-api-key.":"A Firebase API-kulcs hibás vagy nem használható erről a domainről.",
      "auth/network-request-failed":"Hálózati vagy API-kulcs jogosultsági hiba történt. Ellenőrizd az API-kulcs domainkorlátozásait."
    };
    $("loginError").textContent=messages[e.code]||("Firebase: "+(e.message||e.code||"Ismeretlen belépési hiba"));
  }
};
$("logoutBtn").onclick=()=>signOut(auth);

onAuthStateChanged(auth,async user=>{
 if(!user){$("loginView").classList.remove("hidden");$("appView").classList.add("hidden");return}
 if(!isAdmin(user)){await signOut(auth);$("loginError").textContent=`Ez a fiók nem admin: ${user.email}. Állítsd be az ADMIN_EMAIL értékét.`;return}
 $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");
 $("userName").textContent=user.displayName||user.email;$("userPhoto").src=user.photoURL||"";
 try {
   const imported = await importExistingWebsiteContent(false);
   await ensureBuiltInPages();
   if (imported) toast("A meglévő weboldaltartalmak bekerültek a Firebase-be.");
 } catch (error) {
   console.error("Automatikus import hiba:", error);
   toast("A Firebase-import nem futott le, de az összes meglévő weboldaltartalom így is látható és szerkeszthető.", "error");
 }
 await refreshAll();
});

const views=["dashboard","events","performers","albums","videos","sponsors","tickets","pages","settings"];
function showView(v){views.forEach(x=>$(`${x}View`).classList.toggle("hidden",x!==v));document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===v));$("viewTitle").textContent=document.querySelector(`#nav button[data-view="${v}"]`)?.textContent.replace(/^.. /,"")||v}
document.querySelectorAll("#nav button").forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll("[data-jump]").forEach(b=>b.onclick=()=>showView(b.dataset.jump));
const importExistingBtn = document.getElementById("importExistingBtn");
if (importExistingBtn) {
  importExistingBtn.onclick = async () => {
    if (!confirm("Újra betöltsem a weboldal alap tartalmait? A meglévő módosításokat az azonos elemeknél felülírhatja.")) return;
    importExistingBtn.disabled = true;
    try {
      await importExistingWebsiteContent(true);
      await refreshAll();
      toast("A meglévő tartalmak újra betöltve.");
    } catch (e) {
      toast(e.message || String(e), "error");
    } finally {
      importExistingBtn.disabled = false;
    }
  };
}


async function cleanupDuplicateDocuments() {
  const collectionsToClean = ["events","performers","albums","videos","sponsors","tickets","pages"];
  let removed = 0;
  let groupsFixed = 0;
  let reassignedPhotos = 0;
  const photoSnapshot = await getDocs(collection(db, "photos"));
  const allPhotos = photoSnapshot.docs.map(entry => ({ id: entry.id, ...entry.data() }));

  for (const collectionName of collectionsToClean) {
    const snapshot = await getDocs(collection(db, collectionName));
    const items = snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() }));
    const groups = new Map();

    for (const item of items) {
      const key = itemIdentity(collectionName, item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }

    for (const [key, group] of groups.entries()) {
      const visible = group.filter(item => item.deleted !== true && item.hidden !== true);
      if (!visible.length || group.length < 2) continue;

      const merged = mergeDuplicateGroup(visible);
      const targetId = legacyIdByIdentity[collectionName]?.[key]
        || legacyIdByIdentity[collectionName]?.[String(key).replace(/^page:/, "")]
        || merged.id;
      const { id: _ignored, _sourceIds: _ignoredSources, ...data } = merged;

      await setDoc(doc(db, collectionName, targetId), {
        ...data,
        deleted: false,
        hidden: false,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      if (collectionName === "albums") {
        const aliases = new Set(group.map(item => item.id));
        for (const photo of allPhotos) {
          if (!aliases.has(photo.albumId) || photo.albumId === targetId) continue;
          await setDoc(doc(db, "photos", photo.id), {
            albumId: targetId,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          photo.albumId = targetId;
          reassignedPhotos += 1;
        }
      }

      for (const duplicate of group) {
        if (duplicate.id === targetId) continue;
        await setDoc(doc(db, collectionName, duplicate.id), {
          deleted: true,
          hidden: true,
          duplicateOf: targetId,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        if (duplicate.deleted !== true || duplicate.hidden !== true) removed += 1;
      }
      groupsFixed += 1;
    }
  }

  return { removed, groupsFixed, reassignedPhotos };
}

const cleanupDuplicatesBtn = document.getElementById("cleanupDuplicatesBtn");
if (cleanupDuplicatesBtn) {
  cleanupDuplicatesBtn.onclick = async () => {
    if (!confirm("A rendszer összevonja az azonos nevű duplikációkat, és a felesleges példányokat elrejti. Folytatod?")) return;
    cleanupDuplicatesBtn.disabled = true;
    const status = document.getElementById("cleanupStatus");
    if (status) status.textContent = "Duplikációk ellenőrzése…";
    try {
      const result = await cleanupDuplicateDocuments();
      await refreshAll();
      const details = [];
      if (result.removed) details.push(`${result.removed} felesleges bejegyzés elrejtve`);
      if (result.reassignedPhotos) details.push(`${result.reassignedPhotos} albumkép visszakapcsolva`);
      const message = details.length
        ? `${result.groupsFixed} csoport javítva: ${details.join(", ")}.`
        : "Nem találtam aktív duplikációt.";
      if (status) status.textContent = message;
      toast(message);
    } catch (error) {
      console.error("Duplikációtisztítási hiba:", error);
      if (status) status.textContent = "A tisztítás nem sikerült: " + (error.message || error);
      toast(error.message || String(error), "error");
    } finally {
      cleanupDuplicatesBtn.disabled = false;
    }
  };
}

async function uploadImage(file,path,max=1800,quality=.84){
 if(!file)return "";
 const img=await createImageBitmap(file);let w=img.width,h=img.height;
 if(Math.max(w,h)>max){const r=max/Math.max(w,h);w=Math.round(w*r);h=Math.round(h*r)}
 const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;canvas.getContext("2d").drawImage(img,0,0,w,h);
 const blob=await new Promise(res=>canvas.toBlob(res,"image/webp",quality));
 const storagePath=`${path}/${Date.now()}-${crypto.randomUUID()}.webp`;const r=ref(storage,storagePath);
 await uploadBytes(r,blob,{contentType:"image/webp"});return {url:await getDownloadURL(r),path:storagePath};
}
async function removeStored(path){if(path)try{await deleteObject(ref(storage,path))}catch{}}
async function docs(name,sort="createdAt"){
  let firestoreItems = [];
  try {
    const snap = await getDocs(collection(db,name));
    firestoreItems = snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch (error) {
    console.error("Firestore olvasási hiba:", name, error);
    toast(`A ${name} Firebase-adatai nem olvashatók, de a weboldal meglévő tartalmait továbbra is mutatom.`, "error");
  }
  return mergeWithExistingWebsite(name, firestoreItems)
    .sort((a,b)=>String(b[sort]||"").localeCompare(String(a[sort]||"")));
}
const thumb=x=>x||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='120'%3E%3Crect width='100%25' height='100%25' fill='%23222'/%3E%3C/svg%3E";


async function seedCollection(collectionName, items) {
  for (const item of items) {
    const { id, ...data } = item;
    await setDoc(doc(db, collectionName, id), {
      ...data,
      importedFromWebsite: true,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }
}

async function ensureBuiltInPages() {
  for (const page of (LEGACY_CONTENT.pages || [])) {
    const pageRef = doc(db, "pages", page.id);
    const snapshot = await getDoc(pageRef);
    if (!snapshot.exists()) {
      await setDoc(pageRef, {
        ...page,
        importedFromWebsite: true,
        deleted: false,
        hidden: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      continue;
    }
    const current = snapshot.data();
    const repair = {};
    if (current.deleted === true) repair.deleted = false;
    if (current.hidden === true) repair.hidden = false;
    if (!current.pageType) repair.pageType = "existing";
    if (!current.targetPath) repair.targetPath = page.targetPath;
    if (Object.keys(repair).length) {
      repair.updatedAt = new Date().toISOString();
      await setDoc(pageRef, repair, { merge: true });
    }
  }
}

async function importExistingWebsiteContent(force = false) {
  const systemRef = doc(db, "settings", "system");
  const systemSnap = await getDoc(systemRef);
  const currentVersion = systemSnap.exists() ? Number(systemSnap.data().legacySeedVersion || 0) : 0;
  let changed = false;

  // A teljes alapadat-import csak az első telepítéskor vagy kézi újratöltéskor fut.
  if (force || currentVersion < 1) {
    await seedCollection("events", LEGACY_CONTENT.events || []);
    await seedCollection("albums", LEGACY_CONTENT.albums || []);
    await seedCollection("videos", LEGACY_CONTENT.videos || []);
    await seedCollection("performers", LEGACY_CONTENT.performers || []);
    await seedCollection("sponsors", LEGACY_CONTENT.sponsors || []);
    await setDoc(doc(db, "settings", "site"), LEGACY_CONTENT.settings || {}, { merge: true });
    changed = true;
  }

  // A V6.2-ben megjelent Oldalak modul alapbejegyzéseit külön importáljuk,
  // ezért a korábban szerkesztett eseményeket és képeket nem írjuk felül.
  if (force || currentVersion < 2) {
    await seedCollection("pages", LEGACY_CONTENT.pages || []);
    changed = true;
  }

  if (!changed) return false;

  await setDoc(systemRef, {
    legacySeedVersion: 2,
    legacyImportedAt: new Date().toISOString()
  }, { merge: true });

  return true;
}

async function refreshAll(){await Promise.all([loadEvents(),loadPerformers(),loadAlbums(),loadVideos(),loadSponsors(),loadTickets(),loadPages(),loadSettings()]);updateStats()}
function updateStats(){$("countEvents").textContent=state.events.length;$("countPerformers").textContent=state.performers.length;$("countAlbums").textContent=state.albums.length;$("countPhotos").textContent=state.photos.length}
const state={events:[],performers:[],albums:[],photos:[],videos:[],sponsors:[],tickets:[],pages:[]};

const LEGACY_BY_COLLECTION = {
  events: LEGACY_CONTENT.events || [],
  performers: LEGACY_CONTENT.performers || [],
  albums: LEGACY_CONTENT.albums || [],
  videos: LEGACY_CONTENT.videos || [],
  sponsors: LEGACY_CONTENT.sponsors || [],
  tickets: LEGACY_CONTENT.tickets || [],
  pages: LEGACY_CONTENT.pages || []
};

const normalizeIdentity = value => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/×/g, "x")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const legacyIdentityById = {};
const legacyIdByIdentity = {};
for (const [collectionName, items] of Object.entries(LEGACY_BY_COLLECTION)) {
  legacyIdentityById[collectionName] = {};
  legacyIdByIdentity[collectionName] = {};
  for (const item of items) {
    const raw = collectionName === "videos"
      ? String(item.title || "").replace(/after\s*movie/gi, "")
      : collectionName === "pages"
        ? (item.targetPath || item.slug || item.title || item.id)
        : (item.name || item.title || item.id);
    const key = normalizeIdentity(raw);
    legacyIdentityById[collectionName][item.id] = key;
    legacyIdByIdentity[collectionName][key] = item.id;
  }
}

function itemIdentity(collectionName, item) {
  if (collectionName === "photos") return `photo:${item.id}`;
  const stable = legacyIdentityById[collectionName]?.[item.id];
  if (collectionName === "pages") return `page:${stable || normalizeIdentity(item.targetPath || item.slug || item.title || item.id)}`;
  if (stable) return stable;
  const raw = collectionName === "videos"
    ? String(item.title || "").replace(/after\s*movie/gi, "")
    : (item.name || item.title || item.id);
  return normalizeIdentity(raw) || String(item.id || "");
}

function recordScore(item) {
  let score = 0;
  if (item.coverUrl || item.imageUrl || item.logoUrl || item.photoUrl) score += 1000;
  if (item.description || item.bio || item.content) score += 100;
  if (item.ticketUrl || item.url || item.facebook) score += 50;
  if (item.date) score += 10;
  if (!item.importedFromWebsite) score += 2;
  return score;
}

function mergeDuplicateGroup(items) {
  const sorted = [...items].sort((a,b) => {
    const score = recordScore(a) - recordScore(b);
    if (score) return score;
    return String(a.updatedAt || a.createdAt || "").localeCompare(String(b.updatedAt || b.createdAt || ""));
  });
  const preferred = sorted.at(-1);
  return Object.assign({}, ...sorted, {
    id: preferred.id,
    _sourceIds: [...new Set(sorted.flatMap(item => [item.id, ...(Array.isArray(item._sourceIds) ? item._sourceIds : [])]).filter(Boolean))]
  });
}

function itemSourceIds(item) {
  return new Set([item?.id, ...(Array.isArray(item?._sourceIds) ? item._sourceIds : [])].filter(Boolean));
}

function dedupeVisibleItems(collectionName, items) {
  const groups = new Map();
  for (const item of items) {
    const key = itemIdentity(collectionName, item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const result = [];
  for (const group of groups.values()) {
    const visible = group.filter(item => item.hidden !== true && item.deleted !== true);
    if (visible.length) result.push(mergeDuplicateGroup(visible));
  }
  return result;
}

function mergeWithExistingWebsite(collectionName, firestoreItems) {
  const firestoreKeys = new Set(firestoreItems.map(item => itemIdentity(collectionName, item)));
  const fallback = (LEGACY_BY_COLLECTION[collectionName] || [])
    .filter(item => !firestoreKeys.has(itemIdentity(collectionName, item)))
    .map(item => ({ ...item, isExistingWebsiteContent: true }));
  return dedupeVisibleItems(collectionName, [...fallback, ...firestoreItems]);
}

function hasDuplicate(items, currentId, value, field="name") {
  const target = normalizeIdentity(value);
  return items.some(item => item.id !== currentId && normalizeIdentity(item[field] || "") === target);
}

function stableDocId(value, suffix="") {
  const base = normalizeIdentity(value).replace(/\s+/g, "-") || crypto.randomUUID();
  const tail = normalizeIdentity(suffix).replace(/\s+/g, "-");
  return (tail ? `${base}-${tail}` : base).slice(0, 120);
}


function itemHtml(img,title,sub,id,type){return `<div class="item"><img src="${esc(thumb(img))}"><div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div><div class="item-actions"><button class="btn ghost" data-edit="${type}:${id}">Szerkesztés</button><button class="btn danger" data-del="${type}:${id}">Törlés</button></div></div>`}
function bindListActions(root,edit,del){root.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>edit(b.dataset.edit.split(":")[1]));root.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>del(b.dataset.del.split(":")[1]))}

async function loadEvents(){state.events=await docs("events","date");$("eventsList").innerHTML=state.events.map(x=>itemHtml(x.coverUrl,x.name,`${x.date||""} • ${x.location||""}`,x.id,"event")).join("")||"<p>Nincs esemény.</p>";bindListActions($("eventsList"),editEvent,deleteEvent)}
function editEvent(id){const x=state.events.find(v=>v.id===id);$("eventId").value=x.id;$("eventName").value=x.name||"";$("eventDate").value=(x.date||"").slice(0,16);$("eventLocation").value=x.location||"";$("eventTicketUrl").value=x.ticketUrl||"";$("eventDescription").value=x.description||"";$("eventPublished").value=String(x.published!==false);scrollTo(0,0)}
async function deleteEvent(id){
 if(!confirm("Biztosan törlöd?"))return;
 const x=state.events.find(v=>v.id===id);
 await removeStored(x?.coverPath);
 await setDoc(doc(db,"events",id),{deleted:true,updatedAt:new Date().toISOString()},{merge:true});
 toast("Esemény elrejtve/törölve");
 loadEvents();
}
$("saveEvent").onclick=async()=>{try{
  const id=$("eventId").value;
  const name=$("eventName").value.trim();
  if(!name)return toast("Az esemény neve kötelező.","error");
  if(hasDuplicate(state.events,id,name,"name"))return toast("Már van ilyen nevű esemény. Nyisd meg és szerkeszd a meglévőt.","error");
  const old=id?state.events.find(x=>x.id===id):{};
  const img=await uploadImage($("eventCover").files[0],"events");
  const data={name,date:$("eventDate").value,location:$("eventLocation").value.trim(),ticketUrl:$("eventTicketUrl").value.trim(),description:$("eventDescription").value.trim(),published:$("eventPublished").value==="true",coverUrl:img?.url||old?.coverUrl||"",coverPath:img?.path||old?.coverPath||"",updatedAt:new Date().toISOString()};
  if(img&&old?.coverPath)await removeStored(old.coverPath);
  const targetId=id||stableDocId(name,String(data.date||"").slice(0,10));
  await setDoc(doc(db,"events",targetId),{...data,createdAt:old?.createdAt||new Date().toISOString(),deleted:false,hidden:false},{merge:true});
  resetEvent();toast("Esemény mentve");await loadEvents();
}catch(e){console.error(e);toast(e.message||String(e),"error")}}
function resetEvent(){["eventId","eventName","eventDate","eventTicketUrl","eventDescription"].forEach(x=>$(x).value="");$("eventCover").value=""}$("resetEvent").onclick=resetEvent;

async function loadPerformers(){state.performers=await docs("performers");$("performersList").innerHTML=state.performers.map(x=>itemHtml(x.imageUrl,x.name,x.role||"",x.id,"performer")).join("")||"<p>Nincs fellépő.</p>";bindListActions($("performersList"),editPerformer,deletePerformer)}
function editPerformer(id){const x=state.performers.find(v=>v.id===id);$("performerId").value=x.id;$("performerName").value=x.name||"";$("performerRole").value=x.role||"";$("performerBio").value=x.bio||"";$("performerUrl").value=x.url||"";scrollTo(0,0)}
async function deletePerformer(id){
 if(!confirm("Törlöd?"))return;
 const x=state.performers.find(v=>v.id===id);
 await removeStored(x?.imagePath);
 await setDoc(doc(db,"performers",id),{deleted:true,updatedAt:new Date().toISOString()},{merge:true});
 toast("Fellépő elrejtve/törölve");
 loadPerformers();
}
$("savePerformer").onclick=async()=>{try{
  const id=$("performerId").value;
  const name=$("performerName").value.trim();
  if(!name)return toast("A fellépő neve kötelező.","error");
  if(hasDuplicate(state.performers,id,name,"name"))return toast("Már van ilyen nevű fellépő. Nyisd meg és szerkeszd a meglévőt.","error");
  const old=id?state.performers.find(x=>x.id===id):{};
  const img=await uploadImage($("performerImage").files[0],"performers");
  const data={name,role:$("performerRole").value.trim(),bio:$("performerBio").value.trim(),url:$("performerUrl").value.trim(),imageUrl:img?.url||old?.imageUrl||"",imagePath:img?.path||old?.imagePath||"",updatedAt:new Date().toISOString()};
  if(img&&old?.imagePath)await removeStored(old.imagePath);
  const targetId=id||stableDocId(name);
  await setDoc(doc(db,"performers",targetId),{...data,createdAt:old?.createdAt||new Date().toISOString(),deleted:false,hidden:false},{merge:true});
  resetPerformer();toast("Fellépő mentve");await loadPerformers();
}catch(e){console.error(e);toast(e.message||String(e),"error")}}
function resetPerformer(){["performerId","performerName","performerRole","performerBio","performerUrl"].forEach(x=>$(x).value="");$("performerImage").value=""}$("resetPerformer").onclick=resetPerformer;

async function loadAlbums(){state.albums=await docs("albums","date");state.photos=await docs("photos");$("albumsList").innerHTML=state.albums.map(x=>{const ids=itemSourceIds(x);return itemHtml(x.coverUrl,x.name,`${x.date||""} • ${state.photos.filter(p=>ids.has(p.albumId)).length} kép`,x.id,"album")}).join("")||"<p>Nincs album.</p>";bindListActions($("albumsList"),editAlbum,deleteAlbum);const opts='<option value="">Válassz albumot</option>'+state.albums.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");$("uploadAlbumSelect").innerHTML=opts;$("photoManagerAlbum").innerHTML=opts}
function editAlbum(id){const x=state.albums.find(v=>v.id===id);$("albumId").value=x.id;$("albumName").value=x.name||"";$("albumDate").value=x.date||"";$("albumFacebook").value=x.facebook||"";$("albumDescription").value=x.description||"";$("albumPublished").value=String(x.published!==false);scrollTo(0,0)}
async function deleteAlbum(id){
 if(!confirm("Az album el lesz rejtve, a feltöltött képei törlődnek. Biztos?"))return;
 const a=state.albums.find(x=>x.id===id);
 const albumIds=itemSourceIds(a);
 for(const p of state.photos.filter(x=>albumIds.has(x.albumId))){await removeStored(p.storagePath);await deleteDoc(doc(db,"photos",p.id))}
 await removeStored(a?.coverPath);
 await setDoc(doc(db,"albums",id),{deleted:true,updatedAt:new Date().toISOString()},{merge:true});
 toast("Album elrejtve/törölve");
 loadAlbums();
}
$("saveAlbum").onclick=async()=>{try{
  const id=$("albumId").value;
  const name=$("albumName").value.trim();
  if(!name)return toast("Az album neve kötelező.","error");
  if(hasDuplicate(state.albums,id,name,"name"))return toast("Már van ilyen nevű album. Nyisd meg és szerkeszd a meglévőt.","error");
  const old=id?state.albums.find(x=>x.id===id):{};
  const img=await uploadImage($("albumCover").files[0],"album-covers");
  const data={name,date:$("albumDate").value,facebook:$("albumFacebook").value.trim(),description:$("albumDescription").value.trim(),published:$("albumPublished").value==="true",coverUrl:img?.url||old?.coverUrl||"",coverPath:img?.path||old?.coverPath||"",updatedAt:new Date().toISOString()};
  if(img&&old?.coverPath)await removeStored(old.coverPath);
  const targetId=id||`album-${stableDocId(name)}`;
  await setDoc(doc(db,"albums",targetId),{...data,createdAt:old?.createdAt||new Date().toISOString(),deleted:false,hidden:false},{merge:true});
  resetAlbum();toast("Album mentve");await loadAlbums();
}catch(e){console.error(e);toast(e.message||String(e),"error")}}
function resetAlbum(){["albumId","albumName","albumDate","albumFacebook","albumDescription"].forEach(x=>$(x).value="");$("albumCover").value=""}$("resetAlbum").onclick=resetAlbum;

$("uploadPhotos").onclick=async()=>{const albumId=$("uploadAlbumSelect").value,files=[...$("albumPhotos").files];if(!albumId||!files.length)return toast("Válassz albumot és képeket","error");$("uploadPhotos").disabled=true;for(let i=0;i<files.length;i++){try{const img=await uploadImage(files[i],`albums/${albumId}`,2000,.82);await addDoc(collection(db,"photos"),{albumId,url:img.url,storagePath:img.path,name:files[i].name,order:Date.now()+i,createdAt:new Date().toISOString()});$("uploadProgress").style.width=`${Math.round((i+1)/files.length*100)}%`;$("uploadStatus").textContent=`${i+1} / ${files.length} kép feltöltve`}catch(e){toast(`${files[i].name}: ${e.message}`,"error")}}$("uploadPhotos").disabled=false;$("albumPhotos").value="";toast("Képfeltöltés kész");loadAlbums()}
$("photoManagerAlbum").onchange=renderPhotos;
function renderPhotos(){const id=$("photoManagerAlbum").value,album=state.albums.find(x=>x.id===id),ids=itemSourceIds(album||{id}),ps=state.photos.filter(x=>ids.has(x.albumId));$("photosList").innerHTML=ps.map(p=>`<div class="item"><img src="${esc(p.url)}"><div><h3>${esc(p.name||"Fotó")}</h3><p>${esc(p.createdAt||"")}</p></div><div class="item-actions"><button class="btn danger" data-photo-del="${p.id}">Törlés</button></div></div>`).join("")||"<p>Nincs kép ebben az albumban.</p>";$("photosList").querySelectorAll("[data-photo-del]").forEach(b=>b.onclick=async()=>{if(!confirm("Törlöd a képet?"))return;const p=state.photos.find(x=>x.id===b.dataset.photoDel);await removeStored(p.storagePath);await deleteDoc(doc(db,"photos",p.id));toast("Kép törölve");await loadAlbums();$("photoManagerAlbum").value=id;renderPhotos()})}

async function genericLoad(col,listId,stateKey,titleKey,subFn){state[stateKey]=await docs(col);const root=$(listId);root.innerHTML=state[stateKey].map(x=>itemHtml(x.logoUrl||x.imageUrl||"",x[titleKey],subFn(x),x.id,col.slice(0,-1))).join("")||"<p>Nincs adat.</p>"}
async function loadVideos(){state.videos=await docs("videos");$("videosList").innerHTML=state.videos.map(x=>itemHtml("",x.title,`${x.type} • ${x.url}`,x.id,"video")).join("")||"<p>Nincs videó.</p>";bindListActions($("videosList"),id=>fillSimple("video",id),id=>delSimple("videos",id,loadVideos))}
async function loadSponsors(){state.sponsors=await docs("sponsors");$("sponsorsList").innerHTML=state.sponsors.map(x=>itemHtml(x.logoUrl,x.name,x.url||"",x.id,"sponsor")).join("")||"<p>Nincs szponzor.</p>";bindListActions($("sponsorsList"),id=>fillSimple("sponsor",id),deleteSponsor)}
async function loadTickets(){state.tickets=await docs("tickets");$("ticketsList").innerHTML=state.tickets.map(x=>itemHtml("",x.name,`${x.price||""} • ${x.url||""}`,x.id,"ticket")).join("")||"<p>Nincs jegy.</p>";bindListActions($("ticketsList"),id=>fillSimple("ticket",id),id=>delSimple("tickets",id,loadTickets))}
async function delSimple(col,id,reload){
 if(confirm("Törlöd?")){
   await setDoc(doc(db,col,id),{deleted:true,updatedAt:new Date().toISOString()},{merge:true});
   toast("Elrejtve/törölve");
   reload();
 }
}
function fillSimple(type,id){const map={video:state.videos,sponsor:state.sponsors,ticket:state.tickets};const x=map[type].find(v=>v.id===id);Object.entries(x).forEach(([k,v])=>{const el=$(`${type}${k[0].toUpperCase()+k.slice(1)}`);if(el)el.value=String(v??"")});$(`${type}Id`).value=id;scrollTo(0,0)}
async function deleteSponsor(id){
 if(!confirm("Törlöd?"))return;
 const x=state.sponsors.find(v=>v.id===id);
 await removeStored(x?.logoPath);
 await setDoc(doc(db,"sponsors",id),{deleted:true,updatedAt:new Date().toISOString()},{merge:true});
 toast("Szponzor elrejtve/törölve");
 loadSponsors();
}
$("saveVideo").onclick=()=>saveSimple("videos","video",["title","type","url"],loadVideos);$("resetVideo").onclick=()=>resetSimple("video",["title","url"]);
$("saveTicket").onclick=()=>saveSimple("tickets","ticket",["name","price","url","active"],loadTickets);$("resetTicket").onclick=()=>resetSimple("ticket",["name","price","url"]);
async function saveSimple(col,prefix,fields,reload){try{
  const id=$(`${prefix}Id`).value,data={updatedAt:new Date().toISOString()};
  fields.forEach(f=>{let v=$(`${prefix}${f[0].toUpperCase()+f.slice(1)}`).value;if(v==="true"||v==="false")v=v==="true";data[f]=typeof v==="string"?v.trim():v});
  const keyField=prefix==="video"?"title":"name";
  const keyValue=data[keyField]||"";
  const source=prefix==="video"?state.videos:prefix==="ticket"?state.tickets:[];
  if(!keyValue)return toast("A megnevezés kötelező.","error");
  if(hasDuplicate(source,id,keyValue,keyField))return toast("Már van ilyen nevű bejegyzés. A meglévőt szerkeszd.","error");
  const old=source.find(item=>item.id===id)||{};
  const targetId=id||stableDocId(keyValue);
  await setDoc(doc(db,col,targetId),{...data,createdAt:old.createdAt||new Date().toISOString(),deleted:false,hidden:false},{merge:true});
  resetSimple(prefix,fields);toast("Mentve");await reload();
}catch(e){console.error(e);toast(e.message||String(e),"error")}}
function resetSimple(prefix,fields){$(`${prefix}Id`).value="";fields.forEach(f=>{const e=$(`${prefix}${f[0].toUpperCase()+f.slice(1)}`);if(e)e.value=""})}
$("saveSponsor").onclick=async()=>{try{
  const id=$("sponsorId").value;
  const name=$("sponsorName").value.trim();
  if(!name)return toast("A szponzor neve kötelező.","error");
  if(hasDuplicate(state.sponsors,id,name,"name"))return toast("Már van ilyen nevű szponzor.","error");
  const old=id?state.sponsors.find(x=>x.id===id):{};
  const img=await uploadImage($("sponsorLogo").files[0],"sponsors",1200,.9);
  const data={name,url:$("sponsorUrl").value.trim(),order:Number($("sponsorOrder").value||0),logoUrl:img?.url||old?.logoUrl||"",logoPath:img?.path||old?.logoPath||"",updatedAt:new Date().toISOString()};
  if(img&&old?.logoPath)await removeStored(old.logoPath);
  const targetId=id||stableDocId(name);
  await setDoc(doc(db,"sponsors",targetId),{...data,createdAt:old?.createdAt||new Date().toISOString(),deleted:false,hidden:false},{merge:true});
  resetSimple("sponsor",["name","url","order"]);$("sponsorLogo").value="";toast("Szponzor mentve");await loadSponsors();
}catch(e){console.error(e);toast(e.message||String(e),"error")}};$("resetSponsor").onclick=()=>resetSimple("sponsor",["name","url","order"]);

async function loadSettings(){const s=await getDoc(doc(db,"settings","site"));if(s.exists()){const x=s.data();["heroTitle","featuredEvent","email","phone","facebook","instagram","location"].forEach(k=>{const e=$(`setting${k[0].toUpperCase()+k.slice(1)}`);if(e)e.value=x[k]||""})}}
$("saveSettings").onclick=async()=>{const data={};["heroTitle","featuredEvent","email","phone","facebook","instagram","location"].forEach(k=>data[k]=$(`setting${k[0].toUpperCase()+k.slice(1)}`).value.trim());await setDoc(doc(db,"settings","site"),data,{merge:true});toast("Beállítások mentve")};


// ===== V6.1 OLDALKEZELO MODUL =====
const slugify = value => String(value || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function loadPages(){
  let firestorePages = [];
  try {
    const snapshot = await getDocs(collection(db, "pages"));
    firestorePages = snapshot.docs.map(entry => ({ id: entry.id, ...entry.data() }));
  } catch (error) {
    console.error("Oldalak betöltési hiba:", error);
  }

  const builtIn = (LEGACY_CONTENT.pages || []).map((fallback) => {
    const matches = firestorePages.filter((item) =>
      item.id === fallback.id ||
      (item.pageType === "existing" && String(item.targetPath || "").replace(/^\//, "") === fallback.targetPath)
    );
    const current = matches.length ? mergeDuplicateGroup(matches) : {};
    return {
      ...fallback,
      ...current,
      id: current.id || fallback.id,
      pageType: "existing",
      targetPath: current.targetPath || fallback.targetPath,
      deleted: false,
      hidden: false,
      isBuiltInPage: true
    };
  });

  const builtInPaths = new Set(builtIn.map((item) => String(item.targetPath || "").replace(/^\//, "")));
  const custom = firestorePages.filter((item) =>
    item.deleted !== true && item.hidden !== true &&
    !(item.pageType === "existing" && builtInPaths.has(String(item.targetPath || "").replace(/^\//, "")))
  );

  state.pages = [...builtIn, ...dedupeVisibleItems("pages", custom)]
    .sort((a,b)=>(Number(a.order)||100)-(Number(b.order)||100));

  $("pagesList").innerHTML = state.pages.map(x=>{
    const destination=x.pageType==="existing"?`Meglévő: /${x.targetPath||""}`:`Új oldal: /page.html?slug=${x.slug||""}`;
    const status=`${x.published!==false?"Publikus":"Rejtett"} • ${x.showInMenu!==false?"Menüben":"Menüből elrejtve"} • ${destination}`;
    if (x.pageType === "existing" || x.isBuiltInPage) {
      return `<div class="item"><img src="${esc(thumb(x.coverUrl))}"><div><h3>${esc(x.title)}</h3><p>${esc(status)}</p></div><div class="item-actions"><button class="btn ghost" data-edit="page:${x.id}">Szerkesztés</button><a class="btn ghost" href="/${esc(x.targetPath||"")}" target="_blank" rel="noopener">Megnyitás</a></div></div>`;
    }
    return itemHtml(x.coverUrl,x.title,status,x.id,"page");
  }).join("") || "<p>Nincs létrehozott oldal.</p>";
  bindListActions($("pagesList"),editPage,deletePage);
}
function editPage(id){
  const x=state.pages.find(v=>v.id===id); if(!x)return;
  $("pageId").value=x.id;
  $("pageType").value=x.pageType||"custom";
  $("pageType").disabled=x.pageType==="existing"||x.isBuiltInPage===true;
  $("pageTargetPath").value=x.targetPath||"";
  $("pageReplaceMain").value=String(x.replaceMain===true);
  $("pageTitle").value=x.title||"";
  $("pageHeroTitle").value=x.heroTitle||x.title||"";
  $("pageSlug").value=x.slug||"";
  $("pageMenuLabel").value=x.menuLabel||x.title||"";
  $("pageOrder").value=Number(x.order??100);
  $("pagePublished").value=String(x.published!==false);
  $("pageShowInMenu").value=String(x.showInMenu!==false);
  $("pageIntro").value=x.intro||"";
  $("pageContent").value=x.content||"";
  $("pageSeoTitle").value=x.seoTitle||"";
  $("pageSeoDescription").value=x.seoDescription||"";
  updatePageTypeUi(); updatePagePreview(); scrollTo(0,0);
}
function resetPage(){
  ["pageId","pageTitle","pageHeroTitle","pageSlug","pageMenuLabel","pageIntro","pageContent","pageSeoTitle","pageSeoDescription"].forEach(id=>$(id).value="");
  $("pageType").disabled=false; $("pageTargetPath").disabled=false;
  $("pageType").value="custom"; $("pageTargetPath").value=""; $("pageReplaceMain").value="false";
  $("pageOrder").value="100"; $("pagePublished").value="true"; $("pageShowInMenu").value="true"; $("pageCover").value="";
  delete $("pageSlug").dataset.manual;
  updatePageTypeUi(); updatePagePreview();
}
function updatePageTypeUi(){
  const existing=$("pageType").value==="existing";
  const current=state.pages.find(item=>item.id===$("pageId").value);
  $("pageTargetPath").disabled=!existing || current?.isBuiltInPage===true || current?.pageType==="existing";
  $("pageReplaceMain").disabled=!existing;
}
function updatePagePreview(){
  const existing=$("pageType")?.value==="existing";
  const target=$("pageTargetPath")?.value||"";
  const slug=slugify($("pageSlug")?.value||$("pageTitle")?.value);
  const href=existing?(target?`/${target}`:""):(slug?`/page.html?slug=${encodeURIComponent(slug)}`:"");
  const a=$("previewPage");
  if(a){a.href=href||"#";a.style.pointerEvents=href?"auto":"none";a.style.opacity=href?"1":".5";}
}
$("pageTitle").addEventListener("input",()=>{
  if(!$("pageId").value&&!$("pageSlug").dataset.manual)$("pageSlug").value=slugify($("pageTitle").value);
  if(!$("pageMenuLabel").value)$("pageMenuLabel").value=$("pageTitle").value;
  if(!$("pageHeroTitle").value)$("pageHeroTitle").value=$("pageTitle").value;
  updatePagePreview();
});
$("pageSlug").addEventListener("input",()=>{$("pageSlug").dataset.manual="1";$("pageSlug").value=slugify($("pageSlug").value);updatePagePreview()});
$("pageType").addEventListener("change",()=>{updatePageTypeUi();updatePagePreview()});
$("pageTargetPath").addEventListener("change",()=>{
  const option=$("pageTargetPath").selectedOptions[0];
  if($("pageType").value==="existing"&&option?.value){
    if(!$("pageTitle").value)$("pageTitle").value=option.textContent;
    if(!$("pageHeroTitle").value)$("pageHeroTitle").value=option.textContent;
    if(!$("pageSlug").value)$("pageSlug").value=slugify(option.value.replace(/\.html$/,""));
    if(!$("pageMenuLabel").value)$("pageMenuLabel").value=option.textContent;
  }
  updatePagePreview();
});
$("resetPage").onclick=resetPage;
$("savePage").onclick=async()=>{try{
  const id=$("pageId").value, old=id?state.pages.find(x=>x.id===id):{};
  const pageType=$("pageType").value;
  const targetPath=pageType==="existing"?$("pageTargetPath").value:"";
  const title=$("pageTitle").value.trim();
  const slug=slugify($("pageSlug").value||title||targetPath.replace(/\.html$/,""));
  if(!title||!slug)return toast("Az oldal címe és URL-azonosítója kötelező.","error");
  if(pageType==="existing"&&!targetPath)return toast("Válaszd ki, melyik meglévő oldalt szerkeszted.","error");
  const duplicate=state.pages.find(x=>x.id!==id&&(
    (pageType==="existing"&&x.pageType==="existing"&&x.targetPath===targetPath)||
    (pageType!=="existing"&&x.pageType!=="existing"&&x.slug===slug)
  ));
  if(duplicate)return toast(pageType==="existing"?"Ez a meglévő oldal már szerepel a listában.":"Ez az URL-azonosító már használatban van.","error");
  const img=await uploadImage($("pageCover").files[0],"page-covers",2000,.86);
  const data={pageType,targetPath,replaceMain:pageType==="existing"&&$("pageReplaceMain").value==="true",title,heroTitle:$("pageHeroTitle").value.trim()||title,slug,menuLabel:$("pageMenuLabel").value.trim()||title,order:Number($("pageOrder").value||100),published:$("pagePublished").value==="true",showInMenu:$("pageShowInMenu").value==="true",intro:$("pageIntro").value.trim(),content:$("pageContent").value.trim(),seoTitle:$("pageSeoTitle").value.trim(),seoDescription:$("pageSeoDescription").value.trim(),coverUrl:img?.url||old?.coverUrl||"",coverPath:img?.path||old?.coverPath||"",updatedAt:new Date().toISOString()};
  if(img&&old?.coverPath)await removeStored(old.coverPath);
  const targetId=id||(pageType==="existing"?`page-existing-${stableDocId(targetPath.replace(/\.html$/,""))}`:`page-${stableDocId(slug)}`);
  await setDoc(doc(db,"pages",targetId),{...data,createdAt:old?.createdAt||new Date().toISOString(),deleted:false,hidden:false},{merge:true});
  resetPage();toast("Oldal mentve");await loadPages();
}catch(e){console.error(e);toast(e.message||String(e),"error")}};
async function deletePage(id){
  const x=state.pages.find(v=>v.id===id);
  if(x?.pageType==="existing"||x?.isBuiltInPage===true){
    toast("A beépített oldal nem törölhető. Az Állapot mezővel rejtsd el.","error");
    return;
  }
  if(!confirm("Törlöd ezt az oldalt?"))return;
  await removeStored(x?.coverPath);
  await setDoc(doc(db,"pages",id),{deleted:true,hidden:true,published:false,showInMenu:false,updatedAt:new Date().toISOString()},{merge:true});
  toast("Oldal törölve");await loadPages();
}
