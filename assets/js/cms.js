
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { firebaseConfig, ADMIN_EMAIL } from "./firebase-config.js?v=4.0.0";
import { LEGACY_CONTENT } from "./legacy-content.js?v=4.0.0";

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
    await signInWithPopup(auth,new GoogleAuthProvider());
  } catch(e) {
    const messages={
      "auth/popup-blocked":"A böngésző blokkolta a bejelentkezési ablakot. Engedélyezd a felugró ablakokat.",
      "auth/popup-closed-by-user":"A bejelentkezési ablak bezárult.",
      "auth/unauthorized-domain":"A sixtynight.hu még nincs engedélyezve a Firebase Authorized domains listájában.",
      "auth/api-key-not-valid.-please-pass-a-valid-api-key.":"A Firebase API-kulcs hibás."
    };
    $("loginError").textContent=messages[e.code]||("Firebase: "+(e.message||e.code));
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
   if (imported) toast("A meglévő weboldaltartalmak bekerültek a Firebase-be.");
 } catch (error) {
   console.error("Automatikus import hiba:", error);
   toast("A Firebase-import nem futott le, de az összes meglévő weboldaltartalom így is látható és szerkeszthető.", "error");
 }
 await refreshAll();
});

const views=["dashboard","events","performers","albums","videos","sponsors","tickets","settings"];
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

async function importExistingWebsiteContent(force = false) {
  const systemRef = doc(db, "settings", "system");
  const systemSnap = await getDoc(systemRef);
  const currentVersion = systemSnap.exists() ? Number(systemSnap.data().legacySeedVersion || 0) : 0;

  if (!force && currentVersion >= 1) return false;

  await seedCollection("events", LEGACY_CONTENT.events);
  await seedCollection("albums", LEGACY_CONTENT.albums);
  await seedCollection("videos", LEGACY_CONTENT.videos);
  await seedCollection("performers", LEGACY_CONTENT.performers);
  await seedCollection("sponsors", LEGACY_CONTENT.sponsors);
  await setDoc(doc(db, "settings", "site"), LEGACY_CONTENT.settings, { merge: true });
  await setDoc(systemRef, {
    legacySeedVersion: 1,
    legacyImportedAt: new Date().toISOString()
  }, { merge: true });

  return true;
}

async function refreshAll(){await Promise.all([loadEvents(),loadPerformers(),loadAlbums(),loadVideos(),loadSponsors(),loadTickets(),loadSettings()]);updateStats()}
function updateStats(){$("countEvents").textContent=state.events.length;$("countPerformers").textContent=state.performers.length;$("countAlbums").textContent=state.albums.length;$("countPhotos").textContent=state.photos.length}
const state={events:[],performers:[],albums:[],photos:[],videos:[],sponsors:[],tickets:[]};

const LEGACY_BY_COLLECTION = {
  events: LEGACY_CONTENT.events || [],
  performers: LEGACY_CONTENT.performers || [],
  albums: LEGACY_CONTENT.albums || [],
  videos: LEGACY_CONTENT.videos || [],
  sponsors: LEGACY_CONTENT.sponsors || [],
  tickets: LEGACY_CONTENT.tickets || []
};

function mergeWithExistingWebsite(collectionName, firestoreItems) {
  const merged = new Map();
  for (const item of (LEGACY_BY_COLLECTION[collectionName] || [])) {
    merged.set(item.id, { ...item, isExistingWebsiteContent: true });
  }
  for (const item of firestoreItems) {
    merged.set(item.id, { ...(merged.get(item.id) || {}), ...item, isExistingWebsiteContent: !!merged.get(item.id)?.isExistingWebsiteContent });
  }
  return [...merged.values()].filter(item => item.hidden !== true && item.deleted !== true);
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
$("saveEvent").onclick=async()=>{try{const id=$("eventId").value;let old=id?state.events.find(x=>x.id===id):{};let img=await uploadImage($("eventCover").files[0],"events");const data={name:$("eventName").value.trim(),date:$("eventDate").value,location:$("eventLocation").value.trim(),ticketUrl:$("eventTicketUrl").value.trim(),description:$("eventDescription").value.trim(),published:$("eventPublished").value==="true",coverUrl:img?.url||old.coverUrl||"",coverPath:img?.path||old.coverPath||"",updatedAt:new Date().toISOString()};if(img&&old.coverPath)await removeStored(old.coverPath);if(id)await setDoc(doc(db,"events",id),{...data,createdAt:old.createdAt||new Date().toISOString()},{merge:true});else await addDoc(collection(db,"events"),{...data,createdAt:new Date().toISOString()});resetEvent();toast("Esemény mentve");loadEvents()}catch(e){toast(e.message,"error")}}
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
$("savePerformer").onclick=async()=>{try{const id=$("performerId").value,old=id?state.performers.find(x=>x.id===id):{};const img=await uploadImage($("performerImage").files[0],"performers");const data={name:$("performerName").value.trim(),role:$("performerRole").value.trim(),bio:$("performerBio").value.trim(),url:$("performerUrl").value.trim(),imageUrl:img?.url||old.imageUrl||"",imagePath:img?.path||old.imagePath||"",updatedAt:new Date().toISOString()};if(img&&old.imagePath)await removeStored(old.imagePath);if(id)await setDoc(doc(db,"performers",id),{...data,createdAt:old.createdAt||new Date().toISOString()},{merge:true});else await addDoc(collection(db,"performers"),{...data,createdAt:new Date().toISOString()});resetPerformer();toast("Fellépő mentve");loadPerformers()}catch(e){toast(e.message,"error")}}
function resetPerformer(){["performerId","performerName","performerRole","performerBio","performerUrl"].forEach(x=>$(x).value="");$("performerImage").value=""}$("resetPerformer").onclick=resetPerformer;

async function loadAlbums(){state.albums=await docs("albums","date");state.photos=await docs("photos");$("albumsList").innerHTML=state.albums.map(x=>itemHtml(x.coverUrl,x.name,`${x.date||""} • ${state.photos.filter(p=>p.albumId===x.id).length} kép`,x.id,"album")).join("")||"<p>Nincs album.</p>";bindListActions($("albumsList"),editAlbum,deleteAlbum);const opts='<option value="">Válassz albumot</option>'+state.albums.map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("");$("uploadAlbumSelect").innerHTML=opts;$("photoManagerAlbum").innerHTML=opts}
function editAlbum(id){const x=state.albums.find(v=>v.id===id);$("albumId").value=x.id;$("albumName").value=x.name||"";$("albumDate").value=x.date||"";$("albumFacebook").value=x.facebook||"";$("albumDescription").value=x.description||"";$("albumPublished").value=String(x.published!==false);scrollTo(0,0)}
async function deleteAlbum(id){
 if(!confirm("Az album el lesz rejtve, a feltöltött képei törlődnek. Biztos?"))return;
 for(const p of state.photos.filter(x=>x.albumId===id)){await removeStored(p.storagePath);await deleteDoc(doc(db,"photos",p.id))}
 const a=state.albums.find(x=>x.id===id);
 await removeStored(a?.coverPath);
 await setDoc(doc(db,"albums",id),{deleted:true,updatedAt:new Date().toISOString()},{merge:true});
 toast("Album elrejtve/törölve");
 loadAlbums();
}
$("saveAlbum").onclick=async()=>{try{const id=$("albumId").value,old=id?state.albums.find(x=>x.id===id):{};const img=await uploadImage($("albumCover").files[0],"album-covers");const data={name:$("albumName").value.trim(),date:$("albumDate").value,facebook:$("albumFacebook").value.trim(),description:$("albumDescription").value.trim(),published:$("albumPublished").value==="true",coverUrl:img?.url||old.coverUrl||"",coverPath:img?.path||old.coverPath||"",updatedAt:new Date().toISOString()};if(img&&old.coverPath)await removeStored(old.coverPath);if(id)await setDoc(doc(db,"albums",id),{...data,createdAt:old.createdAt||new Date().toISOString()},{merge:true});else await addDoc(collection(db,"albums"),{...data,createdAt:new Date().toISOString()});resetAlbum();toast("Album mentve");loadAlbums()}catch(e){toast(e.message,"error")}}
function resetAlbum(){["albumId","albumName","albumDate","albumFacebook","albumDescription"].forEach(x=>$(x).value="");$("albumCover").value=""}$("resetAlbum").onclick=resetAlbum;

$("uploadPhotos").onclick=async()=>{const albumId=$("uploadAlbumSelect").value,files=[...$("albumPhotos").files];if(!albumId||!files.length)return toast("Válassz albumot és képeket","error");$("uploadPhotos").disabled=true;for(let i=0;i<files.length;i++){try{const img=await uploadImage(files[i],`albums/${albumId}`,2000,.82);await addDoc(collection(db,"photos"),{albumId,url:img.url,storagePath:img.path,name:files[i].name,order:Date.now()+i,createdAt:new Date().toISOString()});$("uploadProgress").style.width=`${Math.round((i+1)/files.length*100)}%`;$("uploadStatus").textContent=`${i+1} / ${files.length} kép feltöltve`}catch(e){toast(`${files[i].name}: ${e.message}`,"error")}}$("uploadPhotos").disabled=false;$("albumPhotos").value="";toast("Képfeltöltés kész");loadAlbums()}
$("photoManagerAlbum").onchange=renderPhotos;
function renderPhotos(){const id=$("photoManagerAlbum").value,ps=state.photos.filter(x=>x.albumId===id);$("photosList").innerHTML=ps.map(p=>`<div class="item"><img src="${esc(p.url)}"><div><h3>${esc(p.name||"Fotó")}</h3><p>${esc(p.createdAt||"")}</p></div><div class="item-actions"><button class="btn danger" data-photo-del="${p.id}">Törlés</button></div></div>`).join("")||"<p>Nincs kép ebben az albumban.</p>";$("photosList").querySelectorAll("[data-photo-del]").forEach(b=>b.onclick=async()=>{if(!confirm("Törlöd a képet?"))return;const p=state.photos.find(x=>x.id===b.dataset.photoDel);await removeStored(p.storagePath);await deleteDoc(doc(db,"photos",p.id));toast("Kép törölve");await loadAlbums();renderPhotos()})}

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
async function saveSimple(col,prefix,fields,reload){try{const id=$(`${prefix}Id`).value,data={updatedAt:new Date().toISOString()};fields.forEach(f=>{let v=$(`${prefix}${f[0].toUpperCase()+f.slice(1)}`).value;if(v==="true"||v==="false")v=v==="true";data[f]=v});if(id)await setDoc(doc(db,col,id),{...data,createdAt:new Date().toISOString()},{merge:true});else await addDoc(collection(db,col),{...data,createdAt:new Date().toISOString()});resetSimple(prefix,fields);toast("Mentve");reload()}catch(e){toast(e.message,"error")}}
function resetSimple(prefix,fields){$(`${prefix}Id`).value="";fields.forEach(f=>{const e=$(`${prefix}${f[0].toUpperCase()+f.slice(1)}`);if(e)e.value=""})}
$("saveSponsor").onclick=async()=>{try{const id=$("sponsorId").value,old=id?state.sponsors.find(x=>x.id===id):{};const img=await uploadImage($("sponsorLogo").files[0],"sponsors",1200,.9);const data={name:$("sponsorName").value.trim(),url:$("sponsorUrl").value.trim(),order:Number($("sponsorOrder").value||0),logoUrl:img?.url||old.logoUrl||"",logoPath:img?.path||old.logoPath||"",updatedAt:new Date().toISOString()};if(img&&old.logoPath)await removeStored(old.logoPath);if(id)await setDoc(doc(db,"sponsors",id),{...data,createdAt:old.createdAt||new Date().toISOString()},{merge:true});else await addDoc(collection(db,"sponsors"),{...data,createdAt:new Date().toISOString()});resetSimple("sponsor",["name","url","order"]);$("sponsorLogo").value="";toast("Szponzor mentve");loadSponsors()}catch(e){toast(e.message,"error")}};$("resetSponsor").onclick=()=>resetSimple("sponsor",["name","url","order"]);

async function loadSettings(){const s=await getDoc(doc(db,"settings","site"));if(s.exists()){const x=s.data();["heroTitle","featuredEvent","email","phone","facebook","instagram","location"].forEach(k=>{const e=$(`setting${k[0].toUpperCase()+k.slice(1)}`);if(e)e.value=x[k]||""})}}
$("saveSettings").onclick=async()=>{const data={};["heroTitle","featuredEvent","email","phone","facebook","instagram","location"].forEach(k=>data[k]=$(`setting${k[0].toUpperCase()+k.slice(1)}`).value.trim());await setDoc(doc(db,"settings","site"),data,{merge:true});toast("Beállítások mentve")};
