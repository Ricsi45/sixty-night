
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=6.7.1";

const TICKET_ORDER_URL = "jegyrendeles.html";

const app=getApps().length?getApps()[0]:initializeApp(firebaseConfig);const db=getFirestore(app);
const $=id=>document.getElementById(id);const text=(id,value)=>{const el=$(id);if(el&&value!==undefined&&value!==null&&String(value)!=="")el.textContent=value};
const setLink=(id,label,url)=>{const el=$(id);if(!el)return;if(label)el.textContent=label;if(url)el.href=url;el.style.display=(label||url)?"inline-flex":"none"};
const safeCssUrl=value=>String(value||"").replace(/["\\\n\r]/g,char=>encodeURIComponent(char));
let countdownTimer=null;
function installStyles(){if($("cmsHomepageStyles"))return;const style=document.createElement("style");style.id="cmsHomepageStyles";style.textContent=`
#cmsHomepageHero.cms-home-image .hero-video-bg,#cmsHomepageHero.cms-home-image .hero-slide{display:none!important}
#cmsHomepageHero.cms-home-image .hero-bg{display:block!important;background-image:linear-gradient(180deg,rgba(5,5,10,.16),rgba(5,5,10,.78)),var(--cms-home-desktop-bg);background-size:cover;background-position:var(--cms-home-position,center)}
#cmsHomepageHero.cms-home-video .hero-bg{display:none!important}
#cmsHomepageHero .event-card.cms-event-cover{background-image:linear-gradient(180deg,rgba(8,8,15,.38),rgba(8,8,15,.92)),var(--cms-event-cover);background-size:cover;background-position:center}
#cmsHomepageHero .event-card.cms-event-cover .event-inner{background:transparent}
@media(max-width:760px){#cmsHomepageHero.cms-home-image .hero-bg,#cmsHomepageHero.cms-home-video.cms-mobile-cover .hero-bg{display:block!important;background-image:linear-gradient(180deg,rgba(5,5,10,.24),rgba(5,5,10,.84)),var(--cms-home-mobile-bg,var(--cms-home-desktop-bg));background-size:cover;background-position:var(--cms-home-position,center)}#cmsHomepageHero.cms-home-video.cms-mobile-cover .hero-video-bg{display:none!important}}
`;document.head.appendChild(style)}
function formatDate(value){if(!value)return"";const d=new Date(value);if(Number.isNaN(d.getTime()))return"";return new Intl.DateTimeFormat("hu-HU",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Budapest"}).format(d)}
function applyMedia(data){const hero=$("cmsHomepageHero");if(!hero)return;installStyles();hero.classList.remove("cms-home-image","cms-home-video","cms-mobile-cover");hero.style.setProperty("--cms-home-position",data.backgroundPosition||"center");
  const video=hero.querySelector(".hero-video-bg"),source=video?.querySelector("source");
  if(data.desktopImageUrl)hero.style.setProperty("--cms-home-desktop-bg",`url("${safeCssUrl(data.desktopImageUrl)}")`);if(data.mobileImageUrl){hero.style.setProperty("--cms-home-mobile-bg",`url("${safeCssUrl(data.mobileImageUrl)}")`);hero.classList.add("cms-mobile-cover")}
  if(data.mediaMode==="image"&&data.desktopImageUrl){hero.classList.add("cms-home-image");if(video)video.pause()}
  else if(data.mediaMode==="video"&&data.videoUrl&&video){hero.classList.add("cms-home-video");if(source){source.src=data.videoUrl;source.type=data.videoUrl.toLowerCase().includes(".webm")?"video/webm":"video/mp4"}else video.src=data.videoUrl;if(data.videoPosterUrl)video.poster=data.videoPosterUrl;video.load();video.play().catch(()=>{})}
}
function applyCountdown(data){const box=$("homepageCountdown");if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null}if(!box)return;if(data.countdownEnabled===false||!data.eventDate){box.style.display="none";return}const target=new Date(data.eventDate).getTime();if(!Number.isFinite(target)){box.style.display="none";return}box.style.display="flex";const tick=()=>{let diff=target-Date.now();if(diff<=0){["days","hours","minutes","seconds"].forEach(id=>text(id,"00"));if(data.countdownAfterEnd!=="zero")box.style.display="none";return}box.style.display="flex";const days=Math.floor(diff/86400000);diff%=86400000;const hours=Math.floor(diff/3600000);diff%=3600000;const minutes=Math.floor(diff/60000);const seconds=Math.floor((diff%60000)/1000);text("days",String(days).padStart(2,"0"));text("hours",String(hours).padStart(2,"0"));text("minutes",String(minutes).padStart(2,"0"));text("seconds",String(seconds).padStart(2,"0"))};tick();countdownTimer=setInterval(tick,1000)}
function applyHomepage(data){if(!data||data.enabled===false)return;installStyles();text("homepageEyebrowPublic",data.eyebrow);text("homepageHeroTitlePublic",data.heroTitle);text("homepageHeroAccentPublic",data.heroAccent);text("homepageHeroLeadPublic",data.heroLead);setLink("homepagePrimaryPublic",data.primaryText,data.primaryUrl);setLink("homepageSecondaryPublic",data.secondaryText,data.secondaryUrl);applyMedia(data);
  const eventCard=$("homepageEventCard"),eventSection=$("event");const visible=data.eventEnabled!==false;if(eventCard)eventCard.style.display=visible?"block":"none";if(eventSection)eventSection.style.display=visible?"block":"none";
  if(visible){text("homepageEventBadgePublic",data.eventBadge);text("homepageEventTitlePublic",data.eventTitle);text("homepageEventDatePublic",data.eventDateText||formatDate(data.eventDate));text("homepageEventLocationPublic",data.eventLocation);text("homepageEventLineupPublic",data.eventLineup);text("homepageEventSectionTitle",data.eventTitle);text("homepageEventDescriptionPublic",data.eventDescription);text("homepageEventLineupStrong",data.eventLineup?.split(/\n/)[0]||data.eventTitle);text("homepageEventLineupSub",data.eventLineup?.split(/\n/).slice(1).join(" • ")||data.eventDescription);text("homepageEventTicketInfoPublic",data.eventTicketInfo);text("homepageEventTicketSubtextPublic",data.eventTicketSubtext);text("homepageEventLocationStrong",data.eventLocation);text("homepageEventLocationSub",data.eventDescription);setLink("homepageEventTicketLinkPublic",data.eventTicketText,TICKET_ORDER_URL);setLink("homepageEventDetailsLinkPublic","Részletek →",data.eventDetailsUrl);if(data.eventCoverUrl){eventCard?.classList.add("cms-event-cover");eventCard?.style.setProperty("--cms-event-cover",`url("${safeCssUrl(data.eventCoverUrl)}")`);const visual=$("homepageEventVisual");if(visual){visual.style.backgroundImage=`linear-gradient(180deg,rgba(8,8,15,.08),rgba(8,8,15,.58)),url("${safeCssUrl(data.eventCoverUrl)}")`;visual.style.backgroundSize="cover";visual.style.backgroundPosition="center"}}}
  applyCountdown(data);if(data.seoTitle)document.title=data.seoTitle;const meta=document.querySelector('meta[name="description"]');if(meta&&data.seoDescription)meta.content=data.seoDescription;document.querySelectorAll('meta[property="og:title"]').forEach(el=>{if(data.seoTitle)el.content=data.seoTitle});document.querySelectorAll('meta[property="og:description"]').forEach(el=>{if(data.seoDescription)el.content=data.seoDescription});if(data.desktopImageUrl)document.querySelectorAll('meta[property="og:image"]').forEach(el=>el.content=data.desktopImageUrl)
}

function forceSingleTicketOrderButton(){
  const primary=document.getElementById("ticketOrderPrimary");
  if(primary){
    primary.textContent="Jegyet szeretnék";
    primary.href=TICKET_ORDER_URL;
    primary.removeAttribute("target");
    primary.removeAttribute("rel");
    primary.style.removeProperty("display");
  }

  document.querySelectorAll("a").forEach((link)=>{
    if(link===primary)return;
    const label=(link.textContent||"").trim().toLocaleLowerCase("hu-HU");
    const href=link.getAttribute("href")||"";
    const isTicketLabel=/jegyvásárlás|jegyet szeretnék|jegyrendelés/.test(label);
    const isOldTicketMail=/^mailto:/i.test(href)&&/jegyv/i.test(decodeURIComponent(href));
    if(isTicketLabel||isOldTicketMail){
      link.style.display="none";
      link.setAttribute("aria-hidden","true");
      link.setAttribute("tabindex","-1");
    }
  });
}

async function boot(){try{forceSingleTicketOrderButton();const preview=new URLSearchParams(location.search).get("homepagePreview")==="1";const snap=await getDoc(doc(db,"settings",preview?"homepageDraft":"homepage"));if(!snap.exists())return;const data=snap.data();applyHomepage(data);requestAnimationFrame(()=>applyHomepage(data));setTimeout(()=>applyHomepage(data),500);setTimeout(()=>applyHomepage(data),1400);setTimeout(forceSingleTicketOrderButton,0);setTimeout(forceSingleTicketOrderButton,600);setTimeout(forceSingleTicketOrderButton,1600)}catch(error){console.error("[Sixty Night] Főoldal CMS hiba:",error)}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
