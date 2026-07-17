
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=4.0.0";
const app=initializeApp(firebaseConfig),db=getFirestore(app);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
async function readCollection(name){const s=await getDocs(collection(db,name));return s.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.published!==false)}

function normalizeAlbumName(value){
 return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
}
function syncStaticAlbumCards(albums,photos){
 const cards=[...document.querySelectorAll(".photo-album-card")];
 for(const card of cards){
  const title=card.querySelector("h3")?.textContent?.trim();
  if(!title) continue;
  const key=normalizeAlbumName(title);
  const album=albums.find(a=>normalizeAlbumName(a.name)===key);
  if(!album) continue;
  const firstPhoto=photos.find(p=>p.albumId===album.id);
  const cover=album.coverUrl||firstPhoto?.url||"";
  if(cover){
   const coverEl=card.querySelector(".photo-cover");
   if(coverEl){
    coverEl.style.backgroundImage=`url("${String(cover).replace(/"/g,"\\"")}")`;
    coverEl.dataset.firebaseCover="true";
   }
  }
  const desc=card.querySelector(".photo-album-body p");
  if(desc && album.description) desc.textContent=album.description;
  const fb=card.querySelector('a[href*="facebook.com"]');
  if(fb && album.facebook) fb.href=album.facebook;
 }
}

async function renderAlbums(){
 const root=document.getElementById("firebaseAlbums");if(!root)return;
 const [albums,photos]=await Promise.all([readCollection("albums"),readCollection("photos")]);
 syncStaticAlbumCards(albums,photos);
 if(!albums.length){root.innerHTML="<p>Még nincs Firebase-album feltöltve.</p>";return}
 root.innerHTML=albums.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(a=>`<article class="photo-album-card"><div class="photo-cover" style="background-image:url('${esc(a.coverUrl||photos.find(p=>p.albumId===a.id)?.url||"")}')"></div><div class="photo-album-body"><h3>${esc(a.name)}</h3><p>${esc(a.description||"")}</p><div class="album-actions"><button class="btn primary" data-open-fb-album="${a.id}">Webes galéria (${photos.filter(p=>p.albumId===a.id).length})</button>${a.facebook?`<a class="btn ghost" target="_blank" rel="noopener" href="${esc(a.facebook)}">Facebook album</a>`:""}</div></div></article>`).join("");
 root.querySelectorAll("[data-open-fb-album]").forEach(b=>b.onclick=()=>openAlbum(albums.find(a=>a.id===b.dataset.openFbAlbum),photos.filter(p=>p.albumId===b.dataset.openFbAlbum)));
}
function openAlbum(a,photos){let m=document.getElementById("firebaseAlbumModal");if(!m){m=document.createElement("div");m.id="firebaseAlbumModal";m.className="album-modal";document.body.appendChild(m)}m.innerHTML=`<div class="album-modal-inner"><div class="album-modal-head"><div><div class="eyebrow">SIXTY NIGHT PARTY</div><h2>${esc(a.name)}</h2></div><button class="album-close">×</button></div><div class="album-grid">${photos.map(p=>`<img loading="lazy" src="${esc(p.url)}" alt="${esc(a.name)}">`).join("")||'<div class="empty-album">Nincs kép.</div>'}</div></div>`;m.classList.add("open");m.querySelector(".album-close").onclick=()=>m.classList.remove("open")}
async function renderEvents(){const root=document.getElementById("firebaseEvents");if(!root)return;const xs=await readCollection("events");root.innerHTML=xs.sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(x=>`<article class="card"><div class="card-visual" style="background-image:url('${esc(x.coverUrl||"")}')"><div class="card-title">${esc(x.name)}</div></div><div class="card-body"><p>${esc(x.description||"")}</p><p><strong>${esc(x.date?.replace("T"," ")||"")}</strong> • ${esc(x.location||"")}</p>${x.ticketUrl?`<a class="btn primary" href="${esc(x.ticketUrl)}" target="_blank">Jegyvásárlás</a>`:""}</div></article>`).join("")||"<p>Nincs közelgő esemény.</p>"}
async function renderPerformers(){const root=document.getElementById("firebasePerformers");if(!root)return;const xs=await readCollection("performers");root.innerHTML=xs.map(x=>`<article class="card"><div class="card-visual" style="background-image:url('${esc(x.imageUrl||"")}')"><div class="card-title">${esc(x.name)}</div></div><div class="card-body"><strong>${esc(x.role||"")}</strong><p>${esc(x.bio||"")}</p></div></article>`).join("")||"<p>Nincs adat.</p>"}
async function renderVideos(){const root=document.getElementById("firebaseVideos");if(!root)return;const xs=await readCollection("videos");root.innerHTML=xs.map(x=>`<article class="card"><div class="card-body"><h3>${esc(x.title)}</h3><p>${esc(x.type||"")}</p><a class="btn primary" href="${esc(x.url)}" target="_blank">Videó megnyitása</a></div></article>`).join("")||"<p>Nincs videó.</p>"}
async function renderSponsors(){const root=document.getElementById("firebaseSponsors");if(!root)return;const xs=await readCollection("sponsors");root.innerHTML=xs.sort((a,b)=>(a.order||0)-(b.order||0)).map(x=>`<a class="sponsor" href="${esc(x.url||"#")}" target="_blank"><img src="${esc(x.logoUrl||"")}" alt="${esc(x.name)}"></a>`).join("")||"<p>Nincs szponzor.</p>"}
async function applySettings(){const s=await getDoc(doc(db,"settings","site"));if(!s.exists())return;const x=s.data();document.querySelectorAll("[data-site-hero]").forEach(e=>e.textContent=x.heroTitle||e.textContent)}
renderAlbums();renderEvents();renderPerformers();renderVideos();renderSponsors();applySettings();
