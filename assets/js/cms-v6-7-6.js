console.info("Sixty Night CMS V6.7.6 képes jegy és rendezett album modul betöltve");

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js?v=6.7.6";
import { LEGACY_CONTENT } from "./legacy-content.js?v=6.7.6";

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
const BUILT_IN_PAGES = [
  {id:"page-existing-index",title:"Főoldal",heroTitle:"SIXTY NIGHT PARTY – AZ ÉJSZAKA A TIÉD.",slug:"fooldal",pageType:"existing",targetPath:"index.html",menuLabel:"Főoldal",order:0,published:true,showInMenu:false,replaceMain:false,intro:"Látvány. Zene. Élmény. Egy helyen.",content:"",seoTitle:"Sixty Night Party",seoDescription:"Sixty Night Party – Az éjszaka a tiéd."},
  {id:"page-existing-events",title:"Események",heroTitle:"KORÁBBI ESEMÉNYEINK",slug:"esemenyek",pageType:"existing",targetPath:"esemenyek.html",menuLabel:"Események",order:10,published:true,showInMenu:false,replaceMain:false,intro:"A Sixty Night korábbi rendezvényei és fellépői egy helyen.",content:"",seoTitle:"Események | Sixty Night Party",seoDescription:"A Sixty Night Party eseményei."},
  {id:"page-existing-performers",title:"Fellépők",heroTitle:"EDDIGI FELLÉPŐINK",slug:"fellepok",pageType:"existing",targetPath:"fellepok.html",menuLabel:"Fellépők",order:20,published:true,showInMenu:false,replaceMain:false,intro:"Előadók és DJ-k, akik már színpadra léptek a Sixty Night rendezvényein.",content:"",seoTitle:"Fellépők | Sixty Night Party",seoDescription:"A Sixty Night Party fellépői."},
  {id:"page-existing-photos",title:"Fotók",heroTitle:"FOTÓK",slug:"fotok",pageType:"existing",targetPath:"fotok.html",menuLabel:"Fotók",order:30,published:true,showInMenu:false,replaceMain:false,intro:"Válogatott képek a Sixty Night Party eseményeiről.",content:"",seoTitle:"Fotók | Sixty Night Party",seoDescription:"Sixty Night Party fotóalbumok."},
  {id:"page-existing-videos",title:"Videótár",heroTitle:"NÉZD VISSZA A BULIKAT",slug:"videotar",pageType:"existing",targetPath:"videotar.html",menuLabel:"Videótár",order:40,published:true,showInMenu:false,replaceMain:false,intro:"Aftermovie-k a Sixty Night leglátványosabb eseményeiről.",content:"",seoTitle:"Videótár | Sixty Night Party",seoDescription:"Sixty Night Party aftermovie-k és videók."},
  {id:"page-existing-about",title:"Rólunk",heroTitle:"RÓLUNK",slug:"rolunk",pageType:"existing",targetPath:"rolunk.html",menuLabel:"Rólunk",order:50,published:true,showInMenu:false,replaceMain:false,intro:"Ismerd meg a Sixty Night Party rendezvénymárkát.",content:"",seoTitle:"Rólunk | Sixty Night Party",seoDescription:"Ismerd meg a Sixty Night Party rendezvénymárkát."},
  {id:"page-existing-location",title:"Helyszín",heroTitle:"SIXTY NIGHT PARTY PARK",slug:"helyszin",pageType:"existing",targetPath:"helyszin.html",menuLabel:"Helyszín",order:60,published:true,showInMenu:false,replaceMain:false,intro:"A Sixty Night Party Park helyszíninformációi.",content:"",seoTitle:"Helyszín | Sixty Night Party",seoDescription:"Sixty Night Party Park helyszíninformációk."},
  {id:"page-existing-vip",title:"VIP",heroTitle:"VIP CLUB",slug:"vip",pageType:"existing",targetPath:"vip.html",menuLabel:"VIP",order:70,published:true,showInMenu:false,replaceMain:false,intro:"Exkluzívabb környezet és különleges rálátás az eseményekre.",content:"",seoTitle:"VIP | Sixty Night Party",seoDescription:"Sixty Night Party VIP információk."},
  {id:"page-existing-ticket-order",title:"Jegyrendelés",heroTitle:"JEGYRENDELÉS",slug:"jegyrendeles",pageType:"existing",targetPath:"jegyrendeles.html",menuLabel:"Jegyrendelés",order:75,published:true,showInMenu:true,replaceMain:false,intro:"Rendeld meg a belépőjegyedet közvetlenül a Sixty Night Party oldalán.",content:"",seoTitle:"Jegyrendelés | Sixty Night Party",seoDescription:"Online jegyrendelés a Sixty Night Party eseményeire."},
  {id:"page-existing-contact",title:"Kapcsolat",heroTitle:"ÍRJ NEKÜNK",slug:"kapcsolat",pageType:"existing",targetPath:"kapcsolat.html",menuLabel:"Kapcsolat",order:80,published:true,showInMenu:false,replaceMain:false,intro:"Jegyek, fellépői megkeresések, szponzoráció és együttműködés.",content:"",seoTitle:"Kapcsolat | Sixty Night Party",seoDescription:"Kapcsolatfelvétel a Sixty Night Party csapatával."},
  {id:"page-existing-mulat",title:"Mulat Hatvan",heroTitle:"MULAT HATVAN",slug:"mulat-hatvan",pageType:"existing",targetPath:"mulat-hatvan.html",menuLabel:"Mulat Hatvan",order:90,published:true,showInMenu:false,replaceMain:false,intro:"2026. szeptember 12. • Sixty Night Party Park",content:"",seoTitle:"Mulat Hatvan | Sixty Night Party",seoDescription:"Mulat Hatvan eseményinformációk."},
  {id:"page-existing-uv",title:"UV Cirkusz 2.0",heroTitle:"UV CIRKUSZ 2.0",slug:"uv-cirkusz",pageType:"existing",targetPath:"uv-cirkusz.html",menuLabel:"UV Cirkusz",order:100,published:true,showInMenu:false,replaceMain:false,intro:"2026. május 23. • Sixty Night Party Park, Hatvan",content:"",seoTitle:"UV Cirkusz 2.0 | Sixty Night Party",seoDescription:"UV Cirkusz 2.0 eseményinformációk."},
  {id:"page-existing-holi",title:"Holi Jungle",heroTitle:"HOLI JUNGLE",slug:"holi-jungle",pageType:"existing",targetPath:"holi-jungle.html",menuLabel:"Holi Jungle",order:110,published:true,showInMenu:false,replaceMain:false,intro:"2026. május 24. • Sixty Night Party Park, Hatvan",content:"",seoTitle:"Holi Jungle | Sixty Night Party",seoDescription:"Holi Jungle eseményinformációk."}
];
const CMS_PAGES = BUILT_IN_PAGES;

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
   await ensureAlbumDataRepair();
   if (imported) toast("A meglévő weboldaltartalmak bekerültek a Firebase-be.");
 } catch (error) {
   console.error("Automatikus import hiba:", error);
   toast("A Firebase-import nem futott le, de az összes meglévő weboldaltartalom így is látható és szerkeszthető.", "error");
 }
 await refreshAll();
});

const views=["dashboard","homepage","events","performers","albums","videos","sponsors","tickets","orders","pages","settings"];
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
  for (const page of CMS_PAGES) {
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

async function refreshAll(){await Promise.all([loadEvents(),loadPerformers(),loadAlbums(),loadVideos(),loadSponsors(),loadTickets(),loadOrders(),loadTicketShopSettings(),loadPages(),loadSettings()]);await loadHomepageEditor();updateStats()}
function updateStats(){$("countEvents").textContent=state.events.length;$("countPerformers").textContent=state.performers.length;$("countAlbums").textContent=state.albums.length;$("countPhotos").textContent=state.photos.length;const newOrders=state.orders.filter(x=>x.status==="new").length;const el=$("countNewOrders");if(el)el.textContent=newOrders}
const state={events:[],performers:[],albums:[],photos:[],videos:[],sponsors:[],tickets:[],orders:[],pages:[],ticketShop:{}};

const LEGACY_BY_COLLECTION = {
  events: LEGACY_CONTENT.events || [],
  performers: LEGACY_CONTENT.performers || [],
  albums: LEGACY_CONTENT.albums || [],
  videos: LEGACY_CONTENT.videos || [],
  sponsors: LEGACY_CONTENT.sponsors || [],
  tickets: LEGACY_CONTENT.tickets || [],
  pages: CMS_PAGES
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

async function loadEvents(){state.events=await docs("events","date");$("eventsList").innerHTML=state.events.map(x=>itemHtml(x.coverUrl,x.name,`${x.date||""} • ${x.location||""}`,x.id,"event")).join("")||"<p>Nincs esemény.</p>";bindListActions($("eventsList"),editEvent,deleteEvent);populateTicketEventOptions()}
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

function photoOrderValue(photo){
  const value=Number(photo?.order);
  return Number.isFinite(value)?value:Number.MAX_SAFE_INTEGER;
}
function compareAlbumPhotos(a,b){
  const orderDiff=photoOrderValue(a)-photoOrderValue(b);
  if(orderDiff)return orderDiff;
  const createdDiff=String(a.createdAt||"").localeCompare(String(b.createdAt||""));
  if(createdDiff)return createdDiff;
  return String(a.name||a.id||"").localeCompare(String(b.name||b.id||""),"hu");
}
function photosForAlbum(album){
  const ids=itemSourceIds(album||{});
  return state.photos.filter(photo=>ids.has(photo.albumId)&&photo.deleted!==true).sort(compareAlbumPhotos);
}
function albumCoverUrl(album){return album?.coverUrl||photosForAlbum(album)[0]?.url||""}
function setAlbumCoverPreview(url=""){
  const preview=$("albumCoverPreview");if(!preview)return;
  preview.src=url||"";preview.classList.toggle("hidden",!url);
  const empty=$("albumCoverEmpty");if(empty)empty.classList.toggle("hidden",Boolean(url));
}
async function loadAlbums(){
  const uploadCurrent=$("uploadAlbumSelect")?.value||"";
  const managerCurrent=$("photoManagerAlbum")?.value||"";
  state.albums=(await docs("albums","date")).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||String(a.name||"").localeCompare(String(b.name||""),"hu"));
  state.photos=await docs("photos");
  $("albumsList").innerHTML=state.albums.map(album=>{
    const count=photosForAlbum(album).length;
    const status=album.published===false?"Rejtett":"Publikus";
    return itemHtml(albumCoverUrl(album),album.name,`${album.date||"Nincs dátum"} • ${count} kép • ${status}`,album.id,"album");
  }).join("")||"<p>Nincs album.</p>";
  bindListActions($("albumsList"),editAlbum,deleteAlbum);
  const opts='<option value="">Válassz albumot</option>'+state.albums.map(album=>`<option value="${esc(album.id)}">${esc(album.date?`${album.date} • ${album.name}`:album.name)}</option>`).join("");
  $("uploadAlbumSelect").innerHTML=opts;$("photoManagerAlbum").innerHTML=opts;
  if([...$("uploadAlbumSelect").options].some(option=>option.value===uploadCurrent))$("uploadAlbumSelect").value=uploadCurrent;
  if([...$("photoManagerAlbum").options].some(option=>option.value===managerCurrent)){
    $("photoManagerAlbum").value=managerCurrent;renderPhotos();
  }else $("photosList").innerHTML='<p class="cms-help">Válassz albumot a képek kezeléséhez.</p>';
}
function editAlbum(id){
  const album=state.albums.find(item=>item.id===id);if(!album)return;
  $("albumId").value=album.id;$("albumName").value=album.name||"";$("albumDate").value=album.date||"";$("albumFacebook").value=album.facebook||"";$("albumDescription").value=album.description||"";$("albumPublished").value=String(album.published!==false);$("albumCover").value="";$("albumRemoveCover").checked=false;setAlbumCoverPreview(albumCoverUrl(album));scrollTo(0,0)
}
async function deleteAlbum(id){
  if(!confirm("Az album el lesz rejtve, a feltöltött képei törlődnek. Biztos?"))return;
  const album=state.albums.find(item=>item.id===id);if(!album)return;
  const albumIds=itemSourceIds(album);
  for(const photo of state.photos.filter(item=>albumIds.has(item.albumId))){await removeStored(photo.storagePath);await deleteDoc(doc(db,"photos",photo.id))}
  await removeStored(album.coverPath);
  for(const albumId of albumIds)await setDoc(doc(db,"albums",albumId),{deleted:true,hidden:true,updatedAt:new Date().toISOString()},{merge:true});
  resetAlbum();toast("Album és képei törölve");await loadAlbums();
}
$("albumCover")?.addEventListener("change",event=>{
  const file=event.target.files?.[0];
  if(!file){const current=state.albums.find(item=>item.id===$("albumId").value);return setAlbumCoverPreview(albumCoverUrl(current))}
  setAlbumCoverPreview(URL.createObjectURL(file));
});
$("saveAlbum").onclick=async()=>{try{
  const id=$("albumId").value;const name=$("albumName").value.trim();
  if(!name)return toast("Az album neve kötelező.","error");
  if(hasDuplicate(state.albums,id,name,"name"))return toast("Már van ilyen nevű album. Nyisd meg és szerkeszd a meglévőt.","error");
  const old=id?state.albums.find(item=>item.id===id):{};
  const uploaded=await uploadImage($("albumCover").files[0],"album-covers",1800,.86);
  let coverUrl=old?.coverUrl||"",coverPath=old?.coverPath||"",coverSourcePhotoId=old?.coverSourcePhotoId||"";
  if($("albumRemoveCover").checked&&!uploaded){await removeStored(coverPath);coverUrl="";coverPath="";coverSourcePhotoId=""}
  if(uploaded){await removeStored(coverPath);coverUrl=uploaded.url;coverPath=uploaded.path;coverSourcePhotoId=""}
  const data={name,date:$("albumDate").value,facebook:$("albumFacebook").value.trim(),description:$("albumDescription").value.trim(),published:$("albumPublished").value==="true",coverUrl,coverPath,coverSourcePhotoId,updatedAt:new Date().toISOString()};
  const targetId=id||`album-${stableDocId(name)}`;
  await setDoc(doc(db,"albums",targetId),{...data,createdAt:old?.createdAt||new Date().toISOString(),deleted:false,hidden:false},{merge:true});
  resetAlbum();toast("Album mentve és rendezve");await loadAlbums();
}catch(error){console.error(error);toast(error.message||String(error),"error")}}
function resetAlbum(){
  ["albumId","albumName","albumDate","albumFacebook","albumDescription"].forEach(id=>$(id).value="");$("albumCover").value="";$("albumRemoveCover").checked=false;$("albumPublished").value="true";setAlbumCoverPreview("")
}
$("resetAlbum").onclick=resetAlbum;

$("uploadPhotos").onclick=async()=>{
  const albumId=$("uploadAlbumSelect").value,files=[...$("albumPhotos").files];
  if(!albumId||!files.length)return toast("Válassz albumot és képeket","error");
  const album=state.albums.find(item=>item.id===albumId);const existing=photosForAlbum(album);let nextOrder=existing.length?Math.max(...existing.map(photo=>Number.isFinite(Number(photo.order))?Number(photo.order):0))+1000:1000;
  $("uploadPhotos").disabled=true;$("uploadProgress").style.width="0%";
  for(let i=0;i<files.length;i++){
    try{
      const image=await uploadImage(files[i],`albums/${albumId}`,2000,.82);
      await addDoc(collection(db,"photos"),{albumId,url:image.url,storagePath:image.path,name:files[i].name,order:nextOrder+i*1000,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),deleted:false});
      $("uploadProgress").style.width=`${Math.round((i+1)/files.length*100)}%`;$("uploadStatus").textContent=`${i+1} / ${files.length} kép feltöltve`;
    }catch(error){toast(`${files[i].name}: ${error.message}`,"error")}
  }
  $("uploadPhotos").disabled=false;$("albumPhotos").value="";toast("Képfeltöltés kész, a sorrend megmaradt");await loadAlbums();$("uploadAlbumSelect").value=albumId;$("photoManagerAlbum").value=albumId;renderPhotos();
}
$("photoManagerAlbum").onchange=renderPhotos;
async function setPhotoAsAlbumCover(photoId){
  const albumId=$("photoManagerAlbum").value;const album=state.albums.find(item=>item.id===albumId);const photo=state.photos.find(item=>item.id===photoId);if(!album||!photo)return;
  await removeStored(album.coverPath);
  await setDoc(doc(db,"albums",album.id),{coverUrl:photo.url,coverPath:"",coverSourcePhotoId:photo.id,updatedAt:new Date().toISOString()},{merge:true});
  toast("Borítókép beállítva");await loadAlbums();$("photoManagerAlbum").value=albumId;renderPhotos();
}
async function moveAlbumPhoto(photoId,direction){
  const albumId=$("photoManagerAlbum").value;const album=state.albums.find(item=>item.id===albumId);if(!album)return;
  const photos=photosForAlbum(album);const index=photos.findIndex(item=>item.id===photoId);const otherIndex=index+direction;if(index<0||otherIndex<0||otherIndex>=photos.length)return;
  const current=photos[index],other=photos[otherIndex];const currentOrder=Number.isFinite(Number(current.order))?Number(current.order):(index+1)*1000;const otherOrder=Number.isFinite(Number(other.order))?Number(other.order):(otherIndex+1)*1000;
  await Promise.all([
    setDoc(doc(db,"photos",current.id),{order:otherOrder,updatedAt:new Date().toISOString()},{merge:true}),
    setDoc(doc(db,"photos",other.id),{order:currentOrder,updatedAt:new Date().toISOString()},{merge:true})
  ]);
  current.order=otherOrder;other.order=currentOrder;renderPhotos();
}
async function deleteAlbumPhoto(photoId){
  if(!confirm("Törlöd ezt a képet?"))return;
  const albumId=$("photoManagerAlbum").value;const album=state.albums.find(item=>item.id===albumId);const photo=state.photos.find(item=>item.id===photoId);if(!album||!photo)return;
  await removeStored(photo.storagePath);await deleteDoc(doc(db,"photos",photo.id));
  if(album.coverSourcePhotoId===photo.id||album.coverUrl===photo.url)await setDoc(doc(db,"albums",album.id),{coverUrl:"",coverPath:"",coverSourcePhotoId:"",updatedAt:new Date().toISOString()},{merge:true});
  toast("Kép törölve");await loadAlbums();$("photoManagerAlbum").value=albumId;renderPhotos();
}
function renderPhotos(){
  const albumId=$("photoManagerAlbum").value;const album=state.albums.find(item=>item.id===albumId);
  if(!album){$("photosList").innerHTML='<p class="cms-help">Válassz albumot a képek kezeléséhez.</p>';return}
  const photos=photosForAlbum(album);const fallbackCover=!album.coverUrl&&photos[0]?.id;
  $("photosList").innerHTML=photos.map((photo,index)=>{
    const isCover=album.coverSourcePhotoId===photo.id||album.coverUrl===photo.url||fallbackCover===photo.id;
    return `<article class="photo-manager-card ${isCover?"is-cover":""}">${isCover?'<span class="photo-cover-badge">BORÍTÓ</span>':""}<img loading="lazy" src="${esc(photo.url)}" alt="${esc(photo.name||"Albumfotó")}"><div class="photo-manager-card-body"><h3>${esc(photo.name||`Fotó ${index+1}`)}</h3><p>${index+1}. kép a galériában</p><div class="photo-manager-actions"><button class="btn ghost" data-photo-cover="${esc(photo.id)}">Borítónak</button><button class="btn ghost" data-photo-up="${esc(photo.id)}" ${index===0?"disabled":""}>Előrébb</button><button class="btn ghost" data-photo-down="${esc(photo.id)}" ${index===photos.length-1?"disabled":""}>Hátrébb</button><button class="btn danger" data-photo-del="${esc(photo.id)}">Törlés</button></div></div></article>`;
  }).join("")||'<p class="cms-help">Nincs kép ebben az albumban.</p>';
  $("photosList").querySelectorAll("[data-photo-cover]").forEach(button=>button.onclick=()=>setPhotoAsAlbumCover(button.dataset.photoCover));
  $("photosList").querySelectorAll("[data-photo-up]").forEach(button=>button.onclick=()=>moveAlbumPhoto(button.dataset.photoUp,-1));
  $("photosList").querySelectorAll("[data-photo-down]").forEach(button=>button.onclick=()=>moveAlbumPhoto(button.dataset.photoDown,1));
  $("photosList").querySelectorAll("[data-photo-del]").forEach(button=>button.onclick=()=>deleteAlbumPhoto(button.dataset.photoDel));
}
async function repairAlbumDocuments(){
  const [albumSnapshot,photoSnapshot]=await Promise.all([getDocs(collection(db,"albums")),getDocs(collection(db,"photos"))]);
  const albums=albumSnapshot.docs.map(entry=>({id:entry.id,...entry.data()}));
  const photos=photoSnapshot.docs.map(entry=>({id:entry.id,...entry.data()}));
  const groups=new Map();
  for(const album of albums){const key=itemIdentity("albums",album);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(album)}
  let groupsFixed=0,duplicatesHidden=0,photosReassigned=0,ordersFixed=0;
  for(const [key,group] of groups){
    const visible=group.filter(item=>item.deleted!==true&&item.hidden!==true);if(!visible.length)continue;
    const merged=mergeDuplicateGroup(visible);const targetId=legacyIdByIdentity.albums?.[key]||merged.id;const aliases=new Set(group.map(item=>item.id));const {id:_id,_sourceIds:_sources,...data}=merged;
    await setDoc(doc(db,"albums",targetId),{...data,published:data.published!==false,deleted:false,hidden:false,updatedAt:new Date().toISOString()},{merge:true});
    for(const photo of photos){if(aliases.has(photo.albumId)&&photo.albumId!==targetId){await setDoc(doc(db,"photos",photo.id),{albumId:targetId,updatedAt:new Date().toISOString()},{merge:true});photo.albumId=targetId;photosReassigned++}}
    for(const duplicate of group){if(duplicate.id===targetId)continue;await setDoc(doc(db,"albums",duplicate.id),{deleted:true,hidden:true,duplicateOf:targetId,updatedAt:new Date().toISOString()},{merge:true});duplicatesHidden++}
    if(group.length>1)groupsFixed++;
  }
  const byAlbum=new Map();
  for(const photo of photos.filter(item=>item.deleted!==true)){if(!byAlbum.has(photo.albumId))byAlbum.set(photo.albumId,[]);byAlbum.get(photo.albumId).push(photo)}
  for(const albumPhotos of byAlbum.values()){
    albumPhotos.sort(compareAlbumPhotos);
    for(let index=0;index<albumPhotos.length;index++){
      const expected=(index+1)*1000;if(Number(albumPhotos[index].order)===expected)continue;
      await setDoc(doc(db,"photos",albumPhotos[index].id),{order:expected,updatedAt:new Date().toISOString()},{merge:true});albumPhotos[index].order=expected;ordersFixed++;
    }
  }
  await setDoc(doc(db,"settings","system"),{albumRepairVersion:1,albumRepairedAt:new Date().toISOString()},{merge:true});
  return {groupsFixed,duplicatesHidden,photosReassigned,ordersFixed};
}
async function ensureAlbumDataRepair(){
  const snapshot=await getDoc(doc(db,"settings","system"));
  if(snapshot.exists()&&Number(snapshot.data().albumRepairVersion||0)>=1)return null;
  return repairAlbumDocuments();
}
$("repairAlbums")?.addEventListener("click",async()=>{
  const button=$("repairAlbums"),status=$("albumRepairStatus");button.disabled=true;if(status)status.textContent="Albumok és képek ellenőrzése…";
  try{
    const result=await repairAlbumDocuments();await loadAlbums();
    const message=`Kész: ${result.groupsFixed} duplikált albumcsoport javítva, ${result.photosReassigned} kép visszakapcsolva, ${result.ordersFixed} képsorrend helyretéve.`;
    if(status)status.textContent=message;toast("A fotóalbumok rendben vannak.");
  }catch(error){console.error(error);if(status)status.textContent="A javítás nem sikerült: "+(error.message||error);toast(error.message||String(error),"error")}
  finally{button.disabled=false}
});

async function genericLoad(col,listId,stateKey,titleKey,subFn){state[stateKey]=await docs(col);const root=$(listId);root.innerHTML=state[stateKey].map(x=>itemHtml(x.logoUrl||x.imageUrl||"",x[titleKey],subFn(x),x.id,col.slice(0,-1))).join("")||"<p>Nincs adat.</p>"}
async function loadVideos(){state.videos=await docs("videos");$("videosList").innerHTML=state.videos.map(x=>itemHtml("",x.title,`${x.type} • ${x.url}`,x.id,"video")).join("")||"<p>Nincs videó.</p>";bindListActions($("videosList"),id=>fillSimple("video",id),id=>delSimple("videos",id,loadVideos))}
async function loadSponsors(){state.sponsors=await docs("sponsors");$("sponsorsList").innerHTML=state.sponsors.map(x=>itemHtml(x.logoUrl,x.name,x.url||"",x.id,"sponsor")).join("")||"<p>Nincs szponzor.</p>";bindListActions($("sponsorsList"),id=>fillSimple("sponsor",id),deleteSponsor)}
function populateTicketEventOptions(){
  const select=$("ticketEventId");if(!select)return;const current=select.value;
  select.innerHTML='<option value="">Nincs eseményhez kötve</option>'+state.events.map(event=>`<option value="${esc(event.id)}">${esc(event.name)}</option>`).join("");
  if([...select.options].some(option=>option.value===current))select.value=current;
}
function setTicketImagePreview(url=""){
  const preview=$("ticketImagePreview");
  if(!preview)return;
  preview.src=url||"";
  preview.classList.toggle("hidden",!url);
  const empty=$("ticketImageEmpty");if(empty)empty.classList.toggle("hidden",Boolean(url));
}
async function loadTickets(){
  state.tickets=await docs("tickets");
  $("ticketsList").innerHTML=state.tickets.map(x=>{
    const price=x.price||((Number(x.priceValue)||0).toLocaleString("hu-HU")+" Ft");
    const mode=x.orderEnabled===true?"Weboldalon rendelhető":(x.url?"Külső jegylink":"Nem rendelhető");
    return itemHtml(x.ticketImageUrl||"",x.name,`${x.eventName||""}${x.eventName?" • ":""}${price||""} • ${mode}`,x.id,"ticket");
  }).join("")||"<p>Nincs jegy.</p>";
  bindListActions($("ticketsList"),editTicket,id=>delSimple("tickets",id,loadTickets));populateTicketEventOptions();
}
function editTicket(id){
  const x=state.tickets.find(v=>v.id===id);if(!x)return;
  $("ticketId").value=x.id;$("ticketName").value=x.name||"";$("ticketEventId").value=x.eventId||"";$("ticketPrice").value=x.price||"";$("ticketPriceValue").value=Number(x.priceValue)||"";$("ticketUrl").value=x.url||"";$("ticketActive").value=String(x.active!==false);$("ticketOrderEnabled").value=String(x.orderEnabled===true);$("ticketMaxPerOrder").value=Number(x.maxPerOrder)||6;$("ticketImage").value="";$("ticketRemoveImage").checked=false;setTicketImagePreview(x.ticketImageUrl||"");scrollTo(0,0)
}
function resetTicket(){
  ["ticketId","ticketName","ticketPrice","ticketPriceValue","ticketUrl"].forEach(id=>$(id).value="");$("ticketEventId").value="";$("ticketActive").value="true";$("ticketOrderEnabled").value="false";$("ticketMaxPerOrder").value="6";$("ticketImage").value="";$("ticketRemoveImage").checked=false;setTicketImagePreview("");
}
$("ticketImage")?.addEventListener("change",event=>{
  const file=event.target.files?.[0];
  if(!file)return setTicketImagePreview(state.tickets.find(item=>item.id===$("ticketId").value)?.ticketImageUrl||"");
  setTicketImagePreview(URL.createObjectURL(file));
});
$("saveTicket").onclick=async()=>{try{
  const id=$("ticketId").value;const name=$("ticketName").value.trim();if(!name)return toast("A jegy megnevezése kötelező.","error");
  if(hasDuplicate(state.tickets,id,name,"name"))return toast("Már van ilyen nevű jegy. A meglévőt szerkeszd.","error");
  const event=state.events.find(item=>item.id===$("ticketEventId").value);const priceValue=Number($("ticketPriceValue").value||0);const orderEnabled=$("ticketOrderEnabled").value==="true";
  if(orderEnabled&&priceValue<=0)return toast("A weboldalon rendelhető jegyhez adj meg számszerű egységárat.","error");
  const old=state.tickets.find(item=>item.id===id)||{};
  const uploaded=await uploadImage($("ticketImage").files[0],"ticket-images",1800,.88);
  let ticketImageUrl=old.ticketImageUrl||"",ticketImagePath=old.ticketImagePath||"";
  if($("ticketRemoveImage").checked&&!uploaded){await removeStored(ticketImagePath);ticketImageUrl="";ticketImagePath=""}
  if(uploaded){await removeStored(ticketImagePath);ticketImageUrl=uploaded.url;ticketImagePath=uploaded.path}
  const data={name,eventId:event?.id||"",eventName:event?.name||"",eventDate:event?.date||"",eventLocation:event?.location||"Sixty Night Party Park • Hatvan",price:$("ticketPrice").value.trim(),priceValue,url:$("ticketUrl").value.trim(),active:$("ticketActive").value==="true",orderEnabled,maxPerOrder:Math.max(1,Math.min(20,Number($("ticketMaxPerOrder").value||6))),ticketImageUrl,ticketImagePath,updatedAt:new Date().toISOString()};
  const targetId=id||stableDocId(name,event?.id||"");await setDoc(doc(db,"tickets",targetId),{...data,createdAt:old.createdAt||new Date().toISOString(),deleted:false,hidden:false},{merge:true});resetTicket();toast("Jegytípus és jegykép mentve");await loadTickets();
}catch(e){console.error(e);toast(e.message||String(e),"error")}};
$("resetTicket").onclick=resetTicket;
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




// ===== V6.7 JEGYRENDELÉSEK =====
const ORDER_STATUS={new:"Új",awaiting_payment:"Fizetésre vár",paid:"Fizetve",ticket_generated:"Jegy elkészült",sent:"Elküldve",cancelled:"Lemondva"};
const TICKET_SHOP_DEFAULTS={orderEnabled:false,contactEmail:"",companyName:"Nagy Richárd E.V.",companyAddress:"",taxNumber:"",phone:"",bankName:"",bankAccount:"",paymentDays:3,paymentInstructions:"A közleményben tüntesd fel a rendelési azonosítót.",privacyUrl:"",termsUrl:"",confirmationText:"A rendelést rögzítettük. A jegyet és a számlát a fizetés ellenőrzése után küldjük."};
function orderMillis(value){if(value?.toMillis)return value.toMillis();if(value?.seconds)return value.seconds*1000;const n=Date.parse(value||"");return Number.isFinite(n)?n:0}
function huDate(value,withTime=true){const ms=orderMillis(value);if(!ms)return "—";return new Intl.DateTimeFormat("hu-HU",withTime?{dateStyle:"medium",timeStyle:"short"}:{dateStyle:"long"}).format(new Date(ms))}
function money(value){return `${Number(value||0).toLocaleString("hu-HU")} Ft`}
function statusChip(status){return `<span class="status-chip status-${esc(status||"new")}">${esc(ORDER_STATUS[status]||status||"Új")}</span>`}
async function loadTicketShopSettings(){
  try{const snap=await getDoc(doc(db,"settings","ticketShop"));state.ticketShop={...TICKET_SHOP_DEFAULTS,...(snap.exists()?snap.data():{})}}
  catch(error){console.error("Jegyrendelési beállítások:",error);state.ticketShop={...TICKET_SHOP_DEFAULTS}}
  const map={ticketShopOrderEnabled:String(state.ticketShop.orderEnabled===true),ticketShopContactEmail:state.ticketShop.contactEmail,ticketShopCompanyName:state.ticketShop.companyName,ticketShopTaxNumber:state.ticketShop.taxNumber,ticketShopCompanyAddress:state.ticketShop.companyAddress,ticketShopBankName:state.ticketShop.bankName,ticketShopBankAccount:state.ticketShop.bankAccount,ticketShopPhone:state.ticketShop.phone,ticketShopPaymentDays:Number(state.ticketShop.paymentDays)||3,ticketShopPaymentInstructions:state.ticketShop.paymentInstructions,ticketShopPrivacyUrl:state.ticketShop.privacyUrl,ticketShopTermsUrl:state.ticketShop.termsUrl,ticketShopConfirmationText:state.ticketShop.confirmationText};
  Object.entries(map).forEach(([id,value])=>{const el=$(id);if(el)el.value=value??""});
}
$("saveTicketShopSettings").onclick=async()=>{try{
  const data={orderEnabled:$("ticketShopOrderEnabled").value==="true",contactEmail:$("ticketShopContactEmail").value.trim(),companyName:$("ticketShopCompanyName").value.trim(),taxNumber:$("ticketShopTaxNumber").value.trim(),companyAddress:$("ticketShopCompanyAddress").value.trim(),bankName:$("ticketShopBankName").value.trim(),bankAccount:$("ticketShopBankAccount").value.trim(),phone:$("ticketShopPhone").value.trim(),paymentDays:Math.max(1,Math.min(30,Number($("ticketShopPaymentDays").value||3))),paymentInstructions:$("ticketShopPaymentInstructions").value.trim(),privacyUrl:$("ticketShopPrivacyUrl").value.trim(),termsUrl:$("ticketShopTermsUrl").value.trim(),confirmationText:$("ticketShopConfirmationText").value.trim(),updatedAt:new Date().toISOString()};
  if(data.orderEnabled&&!data.contactEmail)return toast("Bekapcsolás előtt add meg a kapcsolati e-mail-címet.","error");
  await setDoc(doc(db,"settings","ticketShop"),data,{merge:true});state.ticketShop={...TICKET_SHOP_DEFAULTS,...data};toast("Jegyrendelési beállítások mentve.");
}catch(error){console.error(error);toast(error.message||String(error),"error")}};
async function loadOrders(){
  try{const snap=await getDocs(collection(db,"ticketOrders"));state.orders=snap.docs.map(entry=>({id:entry.id,...entry.data()})).sort((a,b)=>orderMillis(b.createdAt||b.clientCreatedAt)-orderMillis(a.createdAt||a.clientCreatedAt));renderOrders()}
  catch(error){console.error("Rendelések betöltési hiba:",error);state.orders=[];renderOrders();toast("A rendelések nem tölthetők be. Ellenőrizd a Firestore-szabályt.","error")}
  updateStats();
}
function renderOrders(){
  const root=$("ordersList");if(!root)return;const search=String($("orderSearch")?.value||"").trim().toLowerCase();const filter=$("orderStatusFilter")?.value||"";
  const items=state.orders.filter(order=>(!filter||order.status===filter)&&(!search||[order.orderNumber,order.buyerName,order.email,order.phone,order.eventName,order.ticketName].some(value=>String(value||"").toLowerCase().includes(search))));
  $("ordersSummary").textContent=`${items.length} / ${state.orders.length} rendelés`;
  root.innerHTML=items.map(order=>`<article class="order-card"><div><div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap"><h3>${esc(order.orderNumber||order.id)}</h3>${statusChip(order.status)}</div><p><strong>${esc(order.buyerName)}</strong> • ${esc(order.email)} • ${esc(order.phone||"")}</p><p>${esc(order.eventName||"")} • ${esc(order.ticketName||"")} × ${Number(order.quantity||1)}</p><p>${huDate(order.createdAt||order.clientCreatedAt)} • <span class="order-money">${money(order.total)}</span></p></div><div class="order-card-actions"><button class="btn ghost" data-open-order="${esc(order.id)}">Megnyitás</button></div></article>`).join("")||'<div class="order-empty">Nincs a szűrésnek megfelelő rendelés.</div>';
  root.querySelectorAll("[data-open-order]").forEach(button=>button.onclick=()=>openOrder(button.dataset.openOrder));
}
$("orderSearch").addEventListener("input",renderOrders);$("orderStatusFilter").addEventListener("change",renderOrders);
function selectedOrder(){return state.orders.find(item=>item.id===$("orderId").value)}
function openOrder(id){
  const order=state.orders.find(item=>item.id===id);if(!order)return;$("orderId").value=id;$("orderStatus").value=order.status||"new";$("orderInvoicePdf").value="";$("orderDetailHeading").textContent=`${order.orderNumber||id} • ${order.buyerName||""}`;
  const cards=[["Rendelés",order.orderNumber],["Állapot",ORDER_STATUS[order.status]||order.status],["Beérkezett",huDate(order.createdAt||order.clientCreatedAt)],["Vásárló",order.buyerName],["E-mail",order.email],["Telefon",order.phone],["Esemény",order.eventName],["Jegytípus",`${order.ticketName||""} × ${Number(order.quantity||1)}`],["Összeg",money(order.total)],["Számlázási név",order.billingName],["Számlázási cím",`${order.billingZip||""} ${order.billingCity||""}, ${order.billingAddress||""}`],["Adószám",order.taxNumber||"—"],["Megjegyzés",order.note||"—","full"],["Jegyszámok",Array.isArray(order.ticketNumbers)&&order.ticketNumbers.length?order.ticketNumbers.join("\n"):"A jegy letöltésekor készül el","full"]];
  $("orderDetail").innerHTML=cards.map(([label,value,cls])=>`<div class="order-detail-card ${cls||""}"><span>${esc(label)}</span><strong style="white-space:pre-line">${esc(value||"—")}</strong></div>`).join("");$("orderDetailPanel").classList.remove("hidden");$("orderDetailPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
$("closeOrderDetail").onclick=()=>$("orderDetailPanel").classList.add("hidden");
async function updateSelectedOrder(data,message){const order=selectedOrder();if(!order)return toast("Nincs kiválasztott rendelés.","error");await setDoc(doc(db,"ticketOrders",order.id),{...data,updatedAt:serverTimestamp()},{merge:true});toast(message);await loadOrders();openOrder(order.id)}
$("saveOrderStatus").onclick=()=>updateSelectedOrder({status:$("orderStatus").value},"Állapot mentve.");
$("markOrderSent").onclick=()=>updateSelectedOrder({status:"sent",sentAt:serverTimestamp()},"A rendelés elküldve állapotba került.");
function ticketNumberFor(order,index){return `${order.orderNumber||order.id}-${String(index+1).padStart(2,"0")}`}
async function ensureTicketNumbers(order){
  const quantity=Math.max(1,Math.min(20,Number(order.quantity||1)));
  const numbers=Array.from({length:quantity},(_,index)=>ticketNumberFor(order,index));
  await setDoc(doc(db,"ticketOrders",order.id),{ticketNumbers:numbers,status:"ticket_generated",ticketGeneratedAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
  order.ticketNumbers=numbers;order.status="ticket_generated";return numbers;
}
function wrapCanvasText(ctx,text,x,y,maxWidth,lineHeight,maxLines=8){const words=String(text||"").split(/\s+/).filter(Boolean);let line="",lines=[];for(const word of words){const test=line?line+" "+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test}if(line)lines.push(line);lines=lines.slice(0,maxLines);lines.forEach((value,index)=>ctx.fillText(value,x,y+index*lineHeight));return y+lines.length*lineHeight}
async function loadCanvasImage(url){
  if(!url)return null;
  try{const response=await fetch(url,{mode:"cors"});if(!response.ok)throw new Error("Kép letöltési hiba");return await createImageBitmap(await response.blob())}
  catch(error){console.warn("A jegykép nem tölthető be:",error);return null}
}
function drawCoverImage(ctx,image,x,y,width,height){
  if(!image)return false;
  const scale=Math.max(width/image.width,height/image.height);const sw=width/scale,sh=height/scale;const sx=(image.width-sw)/2,sy=(image.height-sh)/2;
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,width,height,28);ctx.clip();ctx.drawImage(image,sx,sy,sw,sh,x,y,width,height);ctx.restore();return true;
}
async function drawTicketCanvas(order,ticketNumber,index,total){
  const canvas=document.createElement("canvas");canvas.width=1240;canvas.height=1754;const ctx=canvas.getContext("2d");const gradient=ctx.createLinearGradient(0,0,1240,1754);gradient.addColorStop(0,"#06060b");gradient.addColorStop(.45,"#25103a");gradient.addColorStop(1,"#071b2b");ctx.fillStyle=gradient;ctx.fillRect(0,0,1240,1754);
  ctx.fillStyle="#ff24b3";ctx.fillRect(0,0,1240,18);ctx.fillStyle="#ffffff";ctx.font="900 66px Arial";ctx.fillText("SIXTY NIGHT",78,112);ctx.fillStyle="#ff33b8";ctx.fillText("PARTY",570,112);ctx.fillStyle="#b8b7c9";ctx.font="700 24px Arial";ctx.fillText("AZ ÉJSZAKA A TIÉD.",82,154);
  ctx.fillStyle="rgba(255,255,255,.97)";ctx.beginPath();ctx.roundRect(60,210,1120,1400,34);ctx.fill();
  const ticket=state.tickets.find(item=>item.id===order.ticketId);const imageUrl=order.ticketImageUrl||ticket?.ticketImageUrl||"";const image=await loadCanvasImage(imageUrl);
  if(!drawCoverImage(ctx,image,105,255,1030,520)){const fallback=ctx.createLinearGradient(105,255,1135,775);fallback.addColorStop(0,"#321050");fallback.addColorStop(.55,"#e1269c");fallback.addColorStop(1,"#073a52");ctx.fillStyle=fallback;ctx.beginPath();ctx.roundRect(105,255,1030,520,28);ctx.fill();ctx.fillStyle="rgba(255,255,255,.12)";ctx.beginPath();ctx.arc(940,380,210,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="900 62px Arial";wrapCanvasText(ctx,order.eventName||"SIXTY NIGHT PARTY",620,475,830,72,3);ctx.textAlign="left"}
  ctx.fillStyle="#12121a";ctx.font="900 48px Arial";let y=850;y=wrapCanvasText(ctx,order.eventName||"SIXTY NIGHT PARTY",105,y,1030,58,3)+18;ctx.fillStyle="#e1269c";ctx.font="900 32px Arial";y=wrapCanvasText(ctx,order.ticketName||"BELÉPŐJEGY",105,y,1030,40,2)+22;
  ctx.fillStyle="#383847";ctx.font="700 24px Arial";ctx.fillText(`Jegy ${index+1} / ${total}`,105,y);y+=50;
  ctx.fillStyle="#171722";ctx.font="800 25px Arial";ctx.fillText("IDŐPONT",105,y);ctx.fillText("HELYSZÍN",635,y);ctx.fillStyle="#4d4d5d";ctx.font="700 24px Arial";y+=38;wrapCanvasText(ctx,order.eventDate?huDate(order.eventDate):"A rendezvény adatlapja szerint",105,y,455,32,2);wrapCanvasText(ctx,order.eventLocation||"Sixty Night Party Park • Hatvan",635,y,455,32,2);y+=105;
  ctx.fillStyle="#171722";ctx.font="800 25px Arial";ctx.fillText("JEGY TULAJDONOSA",105,y);y+=39;ctx.fillStyle="#4d4d5d";ctx.font="700 31px Arial";wrapCanvasText(ctx,order.buyerName||order.billingName||"Vásárló",105,y,1000,40,2);y+=86;
  ctx.fillStyle="#f3e8f2";ctx.beginPath();ctx.roundRect(105,y,1030,150,24);ctx.fill();ctx.fillStyle="#701050";ctx.font="900 24px Arial";ctx.fillText("JEGYSZÁM",140,y+46);ctx.fillStyle="#171722";ctx.font="900 37px monospace";ctx.fillText(ticketNumber,140,y+101);y+=190;
  ctx.fillStyle="#171722";ctx.font="800 23px Arial";ctx.fillText("RENDELÉSI AZONOSÍTÓ",105,y);ctx.fillText("VÁSÁRLÓ E-MAIL-CÍME",635,y);y+=36;ctx.fillStyle="#555565";ctx.font="700 22px Arial";ctx.fillText(order.orderNumber||order.id,105,y);wrapCanvasText(ctx,order.email||"—",635,y,455,30,2);
  ctx.fillStyle="#171722";ctx.font="800 22px Arial";ctx.fillText(state.ticketShop.companyName||"Sixty Night Party",105,1480);ctx.fillStyle="#5c5c6b";ctx.font="600 18px Arial";let footerY=1514;footerY=wrapCanvasText(ctx,[state.ticketShop.companyAddress,state.ticketShop.taxNumber?`Adószám: ${state.ticketShop.taxNumber}`:"",state.ticketShop.contactEmail,state.ticketShop.phone].filter(Boolean).join(" • "),105,footerY,1020,25,3);ctx.fillStyle="#8a8a99";ctx.font="600 17px Arial";wrapCanvasText(ctx,"Ez a dokumentum belépőjegy. A hivatalos számla külön Billingo-bizonylatként kerül kiállításra.",105,footerY+16,1020,24,3);return canvas;
}
async function buildTicketPdf(order){
  if(!window.PDFLib)throw new Error("A PDF-modul nem töltődött be. Frissítsd az oldalt.");const numbers=await ensureTicketNumbers(order);const pdf=await window.PDFLib.PDFDocument.create();
  for(let i=0;i<numbers.length;i++){const canvas=await drawTicketCanvas(order,numbers[i],i,numbers.length);const png=await pdf.embedPng(canvas.toDataURL("image/png"));const page=pdf.addPage([595.28,841.89]);page.drawImage(png,{x:0,y:0,width:595.28,height:841.89})}pdf.setTitle(`${order.orderNumber||order.id} – Sixty Night jegy`);return await pdf.save();
}
function downloadBytes(bytes,filename,type="application/pdf"){const blob=new Blob([bytes],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function safeFileName(value){return String(value||"sixty-night").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9_-]+/gi,"-").replace(/^-+|-+$/g,"").toLowerCase()}
$("generateTicketPdf").onclick=async()=>{const order=selectedOrder();if(!order)return toast("Válassz rendelést.","error");const button=$("generateTicketPdf");button.disabled=true;try{const bytes=await buildTicketPdf(order);downloadBytes(bytes,`${safeFileName(order.orderNumber)}-jegy.pdf`);toast("A képes belépőjegy elkészült.");await loadOrders();openOrder(order.id)}catch(error){console.error(error);toast(error.message||String(error),"error")}finally{button.disabled=false}};
$("mergeInvoiceTicket").onclick=async()=>{const order=selectedOrder();const file=$("orderInvoicePdf").files[0];if(!order)return toast("Válassz rendelést.","error");if(!file)return toast("Válaszd ki a Billingo számla PDF-fájlját.","error");const button=$("mergeInvoiceTicket");button.disabled=true;try{const [invoiceBytes,ticketBytes]=await Promise.all([file.arrayBuffer(),buildTicketPdf(order)]);const invoice=await window.PDFLib.PDFDocument.load(invoiceBytes);const ticket=await window.PDFLib.PDFDocument.load(ticketBytes);const merged=await window.PDFLib.PDFDocument.create();for(const source of [invoice,ticket]){const pages=await merged.copyPages(source,source.getPageIndices());pages.forEach(page=>merged.addPage(page))}const bytes=await merged.save();downloadBytes(bytes,`${safeFileName(order.orderNumber)}-szamla-es-jegy.pdf`);toast("Az egyesített PDF elkészült.");await loadOrders();openOrder(order.id)}catch(error){console.error(error);toast("A PDF-ek egyesítése nem sikerült: "+(error.message||error),"error")}finally{button.disabled=false}};
$("openOrderEmail").onclick=()=>{const order=selectedOrder();if(!order)return toast("Válassz rendelést.","error");const subject=`Sixty Night Party jegy – ${order.orderNumber||order.id}`;const body=`Kedves ${order.buyerName||"Vásárló"}!\n\nCsatoltan küldjük a ${order.eventName||"Sixty Night Party"} rendezvényhez tartozó jegyet és a Billingo számlát.\n\nRendelési azonosító: ${order.orderNumber||order.id}\nJegytípus: ${order.ticketName||"Belépőjegy"}\nDarabszám: ${Number(order.quantity||1)}\n\nÜdvözlettel:\nSixty Night Party`;window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(order.email||"")}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,"_blank")};


// ===== V6.6 FŐOLDAL-SZERKESZTŐ =====
const HOMEPAGE_DEFAULTS = {
  enabled: true,
  eyebrow: "SIXTY NIGHT PARTY • HATVAN",
  heroTitle: "SIXTY NIGHT PARTY",
  heroAccent: "AZ ÉJSZAKA A TIÉD.",
  heroLead: "Látvány. Zene. Élmény. Egy helyen. Fedezd fel a Sixty Night Party világát, ahol minden este rólad szól.",
  primaryText: "Esemény részletei", primaryUrl: "#event",
  secondaryText: "Korábbi események", secondaryUrl: "esemenyek.html",
  mediaMode: "slider", backgroundPosition: "center",
  desktopImageUrl: "", desktopImagePath: "", mobileImageUrl: "", mobileImagePath: "",
  videoUrl: "", videoPath: "", videoPosterUrl: "", videoPosterPath: "",
  eventEnabled: true, eventBadge: "KÖVETKEZŐ ESEMÉNY", eventTitle: "MULAT HATVAN",
  eventDate: "2026-09-12T18:00:00.000Z", eventDateText: "2026. szeptember 12.",
  eventLocation: "Sixty Night Party Park • Hatvan",
  eventLineup: "Rostás Szabika • Döndi Duo\nHázigazda: Szajkó Nándor",
  eventDescription: "Nagyszabású, sátoros mulatós este. A rossz idő sem állíthatja meg a bulit, mert az esemény óriás rendezvénysátorban lesz megtartva.",
  eventDetailsUrl: "mulat-hatvan.html", eventTicketUrl: "mailto:sixtynightpartyproduction@gmail.com?subject=Jegyvásárlás%20–%20Mulat%20Hatvan",
  eventTicketText: "Jegyet szeretnék →", eventTicketInfo: "Elővétel: 2 500 Ft", eventTicketSubtext: "Helyszíni jegy: 3 500 Ft.",
  eventCoverUrl: "", eventCoverPath: "", countdownEnabled: true, countdownAfterEnd: "hide",
  seoTitle: "Sixty Night Party", seoDescription: "Sixty Night Party – Az éjszaka a tiéd."
};
const homepageEditorState = { published: null, draft: null, working: null };
const hpValue = id => $(id)?.value?.trim?.() ?? "";
const hpBool = id => $(id)?.value === "true";
const hpIsoToLocal = value => {
  if (!value) return "";
  const date = new Date(value); if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0,16);
};
const hpLocalToIso = value => { if(!value)return ""; const date=new Date(value); return Number.isNaN(date.getTime())?"":date.toISOString(); };
const hpDateLabel = value => {
  if(!value)return ""; const date=new Date(value); if(Number.isNaN(date.getTime()))return "";
  return new Intl.DateTimeFormat("hu-HU",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Budapest"}).format(date);
};
function hpSetImage(id,url){const el=$(id);if(!el)return;if(url){el.src=url;el.style.visibility="visible"}else{el.removeAttribute("src");el.style.visibility="hidden"}}
function hpRenderMedia(data){
  hpSetImage("homepageDesktopPreview",data.desktopImageUrl); hpSetImage("homepageMobilePreview",data.mobileImageUrl); hpSetImage("homepageEventPreview",data.eventCoverUrl);
  const box=$("homepageVideoCurrent"); if(box)box.innerHTML=data.videoUrl?`Jelenlegi videó: <a href="${esc(data.videoUrl)}" target="_blank" rel="noopener">megnyitás</a>`:"Nincs feltöltött videó.";
}
function hpFillForm(raw){
  const data={...HOMEPAGE_DEFAULTS,...(raw||{})}; homepageEditorState.working={...data};
  const values={homepageEyebrow:data.eyebrow,homepageHeroTitle:data.heroTitle,homepageHeroAccent:data.heroAccent,homepageHeroLead:data.heroLead,homepagePrimaryText:data.primaryText,homepagePrimaryUrl:data.primaryUrl,homepageSecondaryText:data.secondaryText,homepageSecondaryUrl:data.secondaryUrl,homepageMediaMode:data.mediaMode,homepageBackgroundPosition:data.backgroundPosition,homepageVideoUrl:data.videoUrl,homepageEventEnabled:String(data.eventEnabled!==false),homepageEventBadge:data.eventBadge,homepageEventTitle:data.eventTitle,homepageEventDate:hpIsoToLocal(data.eventDate),homepageEventDateText:data.eventDateText,homepageEventLocation:data.eventLocation,homepageEventLineup:data.eventLineup,homepageEventDescription:data.eventDescription,homepageEventDetailsUrl:data.eventDetailsUrl,homepageEventTicketUrl:data.eventTicketUrl,homepageEventTicketText:data.eventTicketText,homepageEventTicketInfo:data.eventTicketInfo,homepageEventTicketSubtext:data.eventTicketSubtext,homepageCountdownEnabled:String(data.countdownEnabled!==false),homepageCountdownAfterEnd:data.countdownAfterEnd||"hide",homepageSeoTitle:data.seoTitle,homepageSeoDescription:data.seoDescription};
  Object.entries(values).forEach(([id,value])=>{if($(id))$(id).value=value??""});
  ["homepageDesktopImage","homepageMobileImage","homepageVideoFile","homepageVideoPoster","homepageEventCover"].forEach(id=>{if($(id))$(id).value=""});
  ["homepageRemoveDesktop","homepageRemoveMobile","homepageRemoveVideo","homepageRemovePoster","homepageRemoveEventCover"].forEach(id=>{if($(id))$(id).checked=false});
  hpRenderMedia(data);
}
function hpRenderStatus(){
  const status=$("homepagePublishStatus"),info=$("homepageSaveInfo"); if(!status)return;
  const pub=homepageEditorState.published,draft=homepageEditorState.draft;
  if(pub){status.textContent="Publikálva";status.className="cms-status live"}else{status.textContent="Még nincs publikálva";status.className="cms-status"}
  if(draft && (!pub || String(draft.updatedAt||"")>String(pub.updatedAt||""))){status.textContent="Mentett piszkozat";status.className="cms-status draft"}
  if(info){const p=pub?.publishedAt?`Utolsó közzététel: ${new Date(pub.publishedAt).toLocaleString("hu-HU")}`:"Nincs még közzétett főoldal-beállítás.";const d=draft?.updatedAt?` Piszkozat: ${new Date(draft.updatedAt).toLocaleString("hu-HU")}.`:"";info.textContent=p+d}
}
function hpPopulateEvents(){
  const select=$("homepageEventSource"); if(!select)return; const current=select.value;
  select.innerHTML='<option value="">Kézi kitöltés</option>'+state.events.map(e=>`<option value="${esc(e.id)}">${esc(e.name)}${e.date?` • ${esc(hpDateLabel(e.date))}`:""}</option>`).join("");
  if(state.events.some(e=>e.id===current))select.value=current;
}
async function loadHomepageEditor(){
  if(!$("homepageView"))return;
  try{
    const [publishedSnap,draftSnap,siteSnap]=await Promise.all([getDoc(doc(db,"settings","homepage")),getDoc(doc(db,"settings","homepageDraft")),getDoc(doc(db,"settings","site"))]);
    const site=siteSnap.exists()?siteSnap.data():{};
    homepageEditorState.published=publishedSnap.exists()?publishedSnap.data():null;
    homepageEditorState.draft=draftSnap.exists()?draftSnap.data():null;
    const base={...HOMEPAGE_DEFAULTS}; if(site.heroTitle)base.heroAccent=site.heroTitle;if(site.featuredEvent)base.eventTitle=site.featuredEvent;
    hpPopulateEvents(); hpFillForm(homepageEditorState.draft||homepageEditorState.published||base); hpRenderStatus();
  }catch(error){console.error("Főoldal-szerkesztő betöltési hiba:",error);toast("A főoldal-beállításokat nem sikerült betölteni.","error")}
}
async function uploadMediaFile(file,path,maxBytes=19*1024*1024){
  if(!file)return null;if(file.size>maxBytes)throw new Error(`A videó túl nagy. Maximum ${Math.round(maxBytes/1024/1024)} MB tölthető fel.`);
  const ext=(file.name.split(".").pop()||"bin").replace(/[^a-z0-9]/gi,"").toLowerCase();const storagePath=`${path}/${Date.now()}-${crypto.randomUUID()}.${ext}`;const target=ref(storage,storagePath);
  await uploadBytes(target,file,{contentType:file.type||"application/octet-stream"});return {url:await getDownloadURL(target),path:storagePath};
}
async function hpCollectForm(){
  const old={...HOMEPAGE_DEFAULTS,...(homepageEditorState.working||{})}; const pathsToDelete=[];
  const data={...old,eyebrow:hpValue("homepageEyebrow"),heroTitle:hpValue("homepageHeroTitle"),heroAccent:hpValue("homepageHeroAccent"),heroLead:hpValue("homepageHeroLead"),primaryText:hpValue("homepagePrimaryText"),primaryUrl:hpValue("homepagePrimaryUrl"),secondaryText:hpValue("homepageSecondaryText"),secondaryUrl:hpValue("homepageSecondaryUrl"),mediaMode:$("homepageMediaMode").value,backgroundPosition:$("homepageBackgroundPosition").value,videoUrl:hpValue("homepageVideoUrl"),eventEnabled:hpBool("homepageEventEnabled"),eventBadge:hpValue("homepageEventBadge"),eventTitle:hpValue("homepageEventTitle"),eventDate:hpLocalToIso($("homepageEventDate").value),eventDateText:hpValue("homepageEventDateText"),eventLocation:hpValue("homepageEventLocation"),eventLineup:hpValue("homepageEventLineup"),eventDescription:hpValue("homepageEventDescription"),eventDetailsUrl:hpValue("homepageEventDetailsUrl"),eventTicketUrl:hpValue("homepageEventTicketUrl"),eventTicketText:hpValue("homepageEventTicketText"),eventTicketInfo:hpValue("homepageEventTicketInfo"),eventTicketSubtext:hpValue("homepageEventTicketSubtext"),countdownEnabled:hpBool("homepageCountdownEnabled"),countdownAfterEnd:$("homepageCountdownAfterEnd").value,seoTitle:hpValue("homepageSeoTitle"),seoDescription:hpValue("homepageSeoDescription")};
  const progress=$("homepageUploadProgress");if(progress)progress.style.width="10%";
  const replacements=[
    ["homepageDesktopImage","desktopImageUrl","desktopImagePath","homepageRemoveDesktop","homepage-backgrounds",2200,.86],
    ["homepageMobileImage","mobileImageUrl","mobileImagePath","homepageRemoveMobile","homepage-backgrounds/mobile",1800,.86],
    ["homepageVideoPoster","videoPosterUrl","videoPosterPath","homepageRemovePoster","homepage-backgrounds/posters",2200,.86],
    ["homepageEventCover","eventCoverUrl","eventCoverPath","homepageRemoveEventCover","homepage-events",1800,.86]
  ];
  let step=10;
  for(const [inputId,urlKey,pathKey,removeId,folder,max,quality] of replacements){
    if($(removeId)?.checked){if(old[pathKey])pathsToDelete.push(old[pathKey]);data[urlKey]="";data[pathKey]=""}
    const file=$(inputId)?.files?.[0];if(file){const uploaded=await uploadImage(file,folder,max,quality);if(old[pathKey])pathsToDelete.push(old[pathKey]);data[urlKey]=uploaded.url;data[pathKey]=uploaded.path}
    step+=15;if(progress)progress.style.width=`${step}%`;
  }
  if($("homepageRemoveVideo")?.checked){if(old.videoPath)pathsToDelete.push(old.videoPath);data.videoUrl="";data.videoPath=""}
  if(data.videoUrl && data.videoUrl !== old.videoUrl && old.videoPath){pathsToDelete.push(old.videoPath);data.videoPath=""}
  const videoFile=$("homepageVideoFile")?.files?.[0];if(videoFile){const uploaded=await uploadMediaFile(videoFile,"homepage-backgrounds/videos");if(old.videoPath)pathsToDelete.push(old.videoPath);data.videoUrl=uploaded.url;data.videoPath=uploaded.path}
  if(progress)progress.style.width="85%";
  data.updatedAt=new Date().toISOString();return {data,pathsToDelete:[...new Set(pathsToDelete.filter(Boolean))]};
}
async function hpPersist(mode){
  const buttons=["saveHomepageDraft","previewHomepage","publishHomepage","loadPublishedHomepage"].map($).filter(Boolean);buttons.forEach(b=>b.disabled=true);
  try{
    const {data,pathsToDelete}=await hpCollectForm();
    if(!data.heroTitle&&!data.heroAccent)throw new Error("Adj meg legalább egy főcímet.");
    if(data.eventEnabled && !data.eventTitle)throw new Error("A kiemelt esemény neve kötelező, vagy kapcsold ki a kiemelt eseményt.");
    let cleanupPaths=[];
    if(mode==="publish"){
      const oldPublished=homepageEditorState.published||{};
      const pathKeys=["desktopImagePath","mobileImagePath","videoPath","videoPosterPath","eventCoverPath"];
      const newPaths=new Set(pathKeys.map(key=>data[key]).filter(Boolean));
      const oldPublishedPaths=new Set(pathKeys.map(key=>oldPublished[key]).filter(Boolean));
      cleanupPaths=pathKeys.map(key=>oldPublished[key]).filter((path,index)=>path&&path!==data[pathKeys[index]]);
      cleanupPaths.push(...pathsToDelete.filter(path=>path&&!newPaths.has(path)&&!oldPublishedPaths.has(path)));
      cleanupPaths=[...new Set(cleanupPaths)];
      const published={...data,publishedAt:new Date().toISOString(),publishedBy:auth.currentUser?.email||""};
      await setDoc(doc(db,"settings","homepage"),published,{merge:false});
      await setDoc(doc(db,"settings","homepageDraft"),published,{merge:false});
      homepageEditorState.published=published;homepageEditorState.draft=published;homepageEditorState.working=published;toast("A főoldal közzétéve.");
    }else{
      // Piszkozat mentésekor nem törlünk fájlt, mert azt a jelenlegi publikus főoldal még használhatja.
      await setDoc(doc(db,"settings","homepageDraft"),data,{merge:false});homepageEditorState.draft=data;homepageEditorState.working=data;toast("Piszkozat mentve.");
    }
    if(cleanupPaths.length)await Promise.allSettled(cleanupPaths.map(removeStored));hpFillForm(homepageEditorState.working);hpRenderStatus();const progress=$("homepageUploadProgress");if(progress){progress.style.width="100%";setTimeout(()=>progress.style.width="0%",900)}
    return true;
  }catch(error){console.error("Főoldal mentési hiba:",error);toast(error.message||String(error),"error");const progress=$("homepageUploadProgress");if(progress)progress.style.width="0%";return false}
  finally{buttons.forEach(b=>b.disabled=false)}
}
$("saveHomepageDraft").onclick=()=>hpPersist("draft");
$("publishHomepage").onclick=async()=>{if(confirm("Biztosan közzéteszed a főoldal módosításait?"))await hpPersist("publish")};
$("previewHomepage").onclick=async()=>{const previewWindow=window.open("about:blank","_blank");const ok=await hpPersist("draft");if(ok){const url=`/index.html?homepagePreview=1&v=671`;if(previewWindow)previewWindow.location.href=url;else window.open(url,"_blank")}else if(previewWindow)previewWindow.close()};
$("loadPublishedHomepage").onclick=()=>{if(!homepageEditorState.published)return toast("Még nincs publikált főoldal-beállítás.","error");hpFillForm(homepageEditorState.published);toast("A publikált változat betöltve az űrlapba.")};
$("homepageCopyEvent").onclick=()=>{
  const event=state.events.find(item=>item.id===$("homepageEventSource").value);if(!event)return toast("Válassz egy mentett eseményt.","error");
  $("homepageEventTitle").value=event.name||"";$("homepageEventDate").value=hpIsoToLocal(event.date);$("homepageEventDateText").value="";$("homepageEventLocation").value=event.location||"Sixty Night Party Park • Hatvan";$("homepageEventDescription").value=event.description||"";$("homepageEventTicketUrl").value=event.ticketUrl||"";
  homepageEditorState.working={...(homepageEditorState.working||HOMEPAGE_DEFAULTS),eventCoverUrl:event.coverUrl||"",eventCoverPath:event.coverPath||""};hpSetImage("homepageEventPreview",event.coverUrl||"");toast("Az esemény adatai átvéve. Mentés előtt még módosíthatod őket.")
};

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

  const builtIn = CMS_PAGES.map((fallback) => {
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
    const status=`${x.isBuiltInPage===true?"Beépített oldal • ":""}${x.published!==false?"Publikus":"Rejtett"} • ${x.showInMenu!==false?"Menüben":"Menüből elrejtve"} • ${destination}`;
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
