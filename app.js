/* =====================================================================
   App patients — Centre Médical Prince de Liège
   Une seule app pour les patients et pour l'équipe : l'écran affiché
   dépend du rôle du compte (patient, secrétariat, prestataire, admin).
   Toute la sécurité est appliquée par la base (règles d'accès Supabase) :
   l'app ne fait qu'afficher ce que la base autorise.
   ===================================================================== */
/* App iPhone : la page garde toujours exactement la largeur de l'écran
   (WKWebView garde parfois un mauvais zoom au démarrage, après le clavier ou au retour dans l'app) */
if(/CMPLApp/.test(navigator.userAgent)){
  const VP="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover";
  const fitScreen=()=>{ const m=document.querySelector('meta[name=viewport]'); if(!m) return;
    m.setAttribute("content",VP+", user-scalable=no"); requestAnimationFrame(()=>m.setAttribute("content",VP));
    if(window.scrollX) window.scrollTo(0,window.scrollY); };
  fitScreen(); addEventListener("load",fitScreen); addEventListener("pageshow",fitScreen);
  addEventListener("orientationchange",()=>setTimeout(fitScreen,300));
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) setTimeout(fitScreen,150); });
  document.addEventListener("focusout",()=>setTimeout(fitScreen,300));
}

(() => {
"use strict";
const CFG = window.CMPL_CONFIG;
const sb = window.supabase.createClient(CFG.url, CFG.key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

/* ---------- langues (écrans des patients) ----------
   Les textes sont écrits en français dans le code. Pour un patient qui a choisi une
   autre langue, chaque texte affiché est remplacé par sa traduction (fichier i18n.js),
   automatiquement, au moment où il apparaît à l'écran. Les réponses enregistrées
   restent en français : l'équipe lit toujours tout en français.
   Les messages écrits par les personnes ne sont jamais traduits. */
const LANGS={fr:"Français",nl:"Nederlands",en:"English",ar:"العربية",tr:"Türkçe",es:"Español",it:"Italiano",ro:"Română",pt:"Português",pl:"Polski"};
const LOCALES={fr:"fr-BE",nl:"nl-BE",en:"en-GB",ar:"ar-MA",tr:"tr-TR",es:"es-ES",it:"it-IT",ro:"ro-RO",pt:"pt-PT",pl:"pl-PL"};
const I18N=window.CMPL_I18N||{};
const savedLang=()=>{ try{ const v=localStorage.getItem("cmpl_lang"); return LANGS[v]?v:null; }catch(e){ return null; } };
let L=savedLang()||(()=>{ const n=(navigator.language||"fr").slice(0,2).toLowerCase(); return LANGS[n]&&I18N[n]?n:"fr"; })();
if(!I18N[L]) L="fr";
let LOC=LOCALES[L];
const PATS={};
function tr(s){
  if(L==="fr"||s==null) return s; const D=I18N[L]; if(!D) return s;
  const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(s), core=m[2]; if(!core) return s;
  let r=D.t[core];
  if(r==null&&core.includes(" · ")){ const parts=core.split(" · "), t=parts.map(x=>tr(x)); if(t.some((x,i)=>x!==parts[i])) r=t.join(" · "); }
  if(r==null&&D.p){ const P=PATS[L]||(PATS[L]=D.p.map(([a,b])=>[new RegExp("^"+a+"$","u"),b]));
    for(const [re,b] of P){ const x=re.exec(core); if(x){ r=b.replace(/\$(\d)/g,(_,i)=>{ const g=x[+i]||""; return g&&g!==core?tr(g):g; }); break; } } }
  if(r==null&&core.includes(", ")){ const parts=core.split(", "), t=parts.map(x=>D.t[x]); if(t.every(Boolean)) r=t.join(L==="ar"?"، ":", "); }
  return r==null?s:m[1]+r+m[3];
}
const TR_ATTRS=["placeholder","aria-label","title","alt"];
function trTree(root){
  if(L==="fr"||!root) return;
  const skip=el=>!el||el.closest('[translate="no"],script,style,code');
  const skipT=el=>skip(el)||el.closest("textarea");
  if(root.nodeType===3){ if(!skipT(root.parentElement)){ const v=root.nodeValue,t=tr(v); if(t!==v) root.nodeValue=t; } return; }
  if(root.nodeType!==1||skip(root)) return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  for(let n=root;n;n=w.nextNode()){
    if(n.nodeType===3){ if(!skipT(n.parentElement)){ const v=n.nodeValue,t=tr(v); if(t!==v) n.nodeValue=t; } }
    else if(!skip(n)) for(const a of TR_ATTRS){ if(n.hasAttribute(a)){ const v=n.getAttribute(a),t=tr(v); if(t!==v) n.setAttribute(a,t); } }
  }
}
let trObs=null;
function applyLang(l){
  L=I18N[l]||l==="fr"?l:"fr"; LOC=LOCALES[L];
  document.documentElement.lang=L; document.documentElement.dir=L==="ar"?"rtl":"ltr";
  if(trObs){ trObs.disconnect(); trObs=null; }
  if(L!=="fr"){
    trObs=new MutationObserver(ms=>{ for(const m of ms){ if(m.type==="childList") m.addedNodes.forEach(trTree); else trTree(m.target); } });
    trObs.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:TR_ATTRS});
    trTree(document.body);
  }
}
const langPickerHTML = () => `<label class="langpick" translate="no"><span aria-hidden="true">🌐</span><select id="langsel" aria-label="Langue / Language">${Object.entries(LANGS).filter(([k])=>k==="fr"||I18N[k]).map(([k,v])=>`<option value="${k}" ${k===L?"selected":""}>${v}</option>`).join("")}</select></label>`;
function bindLangPicker(){ const s=document.getElementById("langsel"); if(!s) return;
  s.onchange=async()=>{ const l=s.value; try{ localStorage.setItem("cmpl_lang",l); }catch(e){}
    applyLang(l); if(S.me&&S.me.role==="patient"&&S.me.lang!==l){ S.me.lang=l; sb.from("profiles").update({lang:l}).eq("id",S.me.id).then(()=>{}); } render(); }; }

/* ---------- utilitaires ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const app = () => $("#app");
function toast(t){ const el=$("#toast"); el.textContent=tr(t); el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>el.hidden=true,2600); }
function fmt(d){ d=new Date(d); const h=(Date.now()-d)/3600e3;
  if(h<1/60) return "à l'instant"; if(h<1) return `il y a ${Math.round(h*60)} min`; if(h<24) return `il y a ${Math.round(h)} h`;
  return d.toLocaleDateString(LOC,{day:"numeric",month:"short"}); }
function fmtWhen(d){ d=new Date(d); const c=new Date(), hm=d.toLocaleTimeString(LOC,{hour:"2-digit",minute:"2-digit"});
  const day=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(); const diff=Math.round((day(d)-day(c))/864e5);
  if(diff===0) return hm; if(diff===1) return "demain "+hm;
  return d.toLocaleDateString(LOC,{weekday:"short",day:"numeric",month:"short"})+" "+hm; }
const fmtDate = d => d ? new Date(d).toLocaleDateString(LOC) : "—";
function frError(e){
  let m = (e && (e.message || e.error_description || e.msg)) || String(e);
  // Réponse vide du serveur (panne, ou e-mail de confirmation impossible à envoyer)
  if(m==="{}"||m==="[object Object]") return `Le serveur n'a pas pu traiter la demande${e&&e.status?` (erreur ${e.status})`:""}. Réessayez dans quelques minutes ; si cela continue, contactez le centre au 02 781 18 75.`;
  const map = [
    [/CMPL_TROP_INSCRIPTIONS|Database error saving new user/i, "Les inscriptions sont momentanément très nombreuses. Réessayez dans une heure, ou appelez le centre au 02 781 18 75."],
    [/Invalid login credentials/i, "Adresse e-mail ou mot de passe incorrect."],
    [/already registered|already been registered/i, "Un compte existe déjà avec cette adresse."],
    [/Email not confirmed/i, "Confirmez d'abord votre adresse e-mail (lien reçu par e-mail)."],
    [/Password should be at least/i, "Le mot de passe est trop court (8 caractères minimum)."],
    [/sending confirmation|confirmation email|sending recovery|sending magic/i, "L'e-mail n'a pas pu être envoyé. Réessayez dans quelques minutes ou contactez le centre au 02 781 18 75."],
    [/email rate limit/i, "Trop d'e-mails envoyés en peu de temps. Réessayez dans une heure."],
    [/rate limit|too many/i, "Trop de tentatives. Réessayez dans quelques minutes."],
    [/Failed to fetch|NetworkError/i, "Pas de connexion internet. Réessayez."],
    [/JWT|token/i, "Votre session a expiré. Reconnectez-vous."]
  ];
  for (const [re, fr] of map) if (re.test(m)) return fr;
  return m;
}
async function run(fn, okMsg){ try{ const r=await fn(); if(r&&r.error) throw r.error; if(okMsg) toast(okMsg); return r; }
  catch(e){ toast(frError(e)); console.error(e); return null; } }

const IC={
 rdv:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
 question:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
 prescription:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M9.5 9.5l5 5"/></svg>',
 resultats:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/></svg>',
 bell:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg>',
 user:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
 back:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
 check:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
 alert:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="flex:none;color:var(--danger)"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/></svg>',
 news:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11v3a1 1 0 0 0 1 1h2l5 4V6L7 10H5a1 1 0 0 0-1 1z"/><path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
 document:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 17v-6M9.5 13.5L12 11l2.5 2.5"/></svg>',
 rapport:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg>',
 centre:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
 scan:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/></svg>',
 search:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
 clip:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>',
 help:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4"/><path d="M12 17.4h.01"/></svg>',
 mic:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
 send:'<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4l17.5-7.5a1 1 0 0 0 0-1.8L3.4 3.6a.9.9 0 0 0-1.3 1l1.8 6.4 9 1-9 1-1.8 6.4a.9.9 0 0 0 1.3 1z"/></svg>',
 trash:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
 doc:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>'
};
const BRAND = `<div class="brand" lang="fr"><img class="logo" src="logo.png?v=1" alt="" width="46" height="46"><div><b>Centre Médical</b><span>Prince de Liège</span></div></div>`;
const AUTHLOGO = `<div class="authlogo" lang="fr"><img src="logo.png?v=1" alt="Logo du Centre Médical Prince de Liège" width="104" height="104"><b>Centre Médical</b><span>Prince de Liège</span></div>`;
const BANNER112 = `<div class="urgent">${IC.alert}<div><strong>Urgence vitale : appelez le 112.</strong><br>Les demandes envoyées ici sont lues pendant les heures d'ouverture, pas en urgence.</div></div>`;

/* ---------- état ---------- */
const S = {
  session:null, me:null, providers:[], hours:{}, news:[], reqs:[], meds:[], notifs:[], profiles:{}, children:{}, tasks:[], pendingKids:[],
  screen:"home", flow:null, answers:{}, drug:null, openReq:null, openNews:null, lastSent:null,
  // équipe
  tab:"secretariat", provFilter:"tous", archive:false, sel:null, cscreen:"inbox", drafts:{}, pending:[], team:[], allNews:[], settings:null,
  authMode:"login", recovery:false, loading:true
};

/* ---------- prestataires (depuis la base) ---------- */
const P = {
  list:   () => S.providers,
  specs:  () => [...new Set(S.providers.map(p=>p.specialty))],
  of:     spec => S.providers.filter(p=>p.specialty===spec),
  phys:   () => S.providers.filter(p=>p.is_physician),
  byId:   id => S.providers.find(p=>p.id===id),
  label:  p => p.specialty!=="Médecine générale" ? `${p.display_name} (${p.job.toLowerCase()})` : p.display_name,
  fromLabel: l => S.providers.find(p=>P.label(p)===l || p.display_name===l)
};
const provName = id => P.byId(id)?.display_name || "";
// À qui s'adresse la conversation : prestataire, Administration ou Secrétariat
const reqWho = r => provName(r.provider_id) || (r.queue==="administration"?"Administration":"Secrétariat");

/* ---------- horaires ---------- */
function isOpen(d){ const h=S.hours[d.getDay()]; if(!h) return false; const x=d.getHours()*60+d.getMinutes(); return x>=h[0] && x<h[1]; }
function nextOpen(d){ if(isOpen(d)) return d;
  for(let i=0;i<15;i++){ const day=new Date(d.getFullYear(),d.getMonth(),d.getDate()+i), h=S.hours[day.getDay()];
    if(!h) continue; const t=new Date(day); t.setHours(0,h[0],0,0); if(t>d) return t; } return d; }

/* ---------- formulaires guidés ---------- */
const TYPES={
 rdv:{label:"Rendez-vous",title:"Demander un rendez-vous",desc:"Avec le motif, pour bien préparer la consultation"},
 question:{label:"Question",title:"Poser une question",desc:"À un prestataire du centre"},
 prescription:{label:"Prescription",title:"Renouveler un médicament",desc:"Pour un traitement habituel"},
 resultats:{label:"Résultats",title:"Mes résultats",desc:"Signaler un examen dont vous attendez le résultat"},
 rapport:{label:"Rapport",title:"Demander un rapport médical",desc:"Pour la mutuelle, l'employeur, une assurance…"},
 document:{label:"Document",title:"Envoyer un document",desc:"Résultats, courrier d'un spécialiste, attestation…"},
 centre:{label:"Message du centre",title:"Message du centre",desc:""}
};
const PATIENT_TYPES=["rdv","question","prescription","rapport","resultats","document"];
// Motifs de médecine générale (la durée estimée de chacun n'est visible que par l'équipe : table motif_durations)
const GP="Médecine générale";
const GP_MOTIFS=["Vaccin ou injection","Prise de sang","Certificat (maladie, sport, école…)","Renouvellement de traitement","Maladie aiguë (fièvre, toux, douleur…)","Suivi d'une maladie chronique (diabète, tension…)","Frottis, petit soin ou petite chirurgie","Bilan ou check-up","Stress, moral, sommeil","Plusieurs problèmes à aborder","Autre"];
const isGP = a => a.specialite===GP;
/* ---------- Ma famille : enfants de moins de 16 ans ---------- */
const CHILD_MAX_AGE=16;
const famKids = () => (S.family?.children||[]);
const kids = () => famKids().filter(c=>c.status==="active"&&c.age<CHILD_MAX_AGE);
const kidLabel = c => { const same=kids().filter(x=>x.first_name===c.first_name).length>1; return `Pour ${c.first_name}${same?` (${new Date(c.birth_date).getFullYear()})`:""}`; };
const pourOptions = () => ["Pour moi", ...kids().map(kidLabel)];
const kidFromPour = v => kids().find(c=>kidLabel(c)===v)||null;
const childInfo = id => id ? (famKids().find(c=>c.id===id) || S.children?.[id] || null) : null;
const childFirst = id => childInfo(id)?.first_name || "votre enfant";

/* ---------- congés et absences ---------- */
const addDays = (iso,n) => { const d=new Date(iso+"T12:00"); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
async function loadLeaves(){
  try{ const [a,b]=await Promise.all([sb.from("staff_leaves").select("*").eq("user_id",S.me.id).gte("ends",todayISO()).order("starts"), sb.rpc("team_absences")]);
    S.leaves=a.error?[]:(a.data||[]); S.teamAbs=b.error?[]:(b.data||[]); }catch(e){ S.leaves=[]; S.teamAbs=[]; } }
// absences d'un prestataire (vues par les patients), la plus proche d'abord
function provAbs(pid){ const t=todayISO(); return (S.absences||[]).filter(x=>x.provider_id===pid&&(!x.ends||x.ends>=t)).sort((x,y)=>(x.starts||"").localeCompare(y.starts||"")); }
function absSentence(name,x){ const t=todayISO();
  if(!x.ends) return `${name} est actuellement absent(e).`;
  if(x.starts<=t) return `${name} est absent(e) jusqu'au ${fmtDate(x.ends+"T12:00")} inclus.`;
  return `${name} sera absent(e) du ${fmtDate(x.starts+"T12:00")} au ${fmtDate(x.ends+"T12:00")} inclus.`; }
// absent maintenant ou dans les 14 jours ?
function soonAbs(pid){ const lim=addDays(todayISO(),14); return provAbs(pid).find(x=>x.starts<=lim)||null; }
// Prestataire choisi dans le formulaire (ou seul prestataire de la spécialité)
const chosenProv = a => { let p=a.medecin?P.fromLabel(a.medecin):null; if(!p&&a.specialite&&P.of(a.specialite).length===1) p=P.of(a.specialite)[0]; return p||null; };
const DEJA_VU = {id:"deja_vu",kind:"choice",q:()=>`Avez-vous déjà consulté ${chosenProv(S.answers)?.display_name||"ce prestataire"} ?`,options:["Oui","Non, jamais"],
  when:a=>!!chosenProv(a)};
const VIA_SECR = {kind:"note",q:"Votre demande sera d'abord lue par le secrétariat, qui la transmettra au bon prestataire.",
  when:a=>{ const p=chosenProv(a); return !!p&&(p.direct_contact===false||a.deja_vu==="Non, jamais"); }};
const ABS_NOTE = {kind:"note",q:a=>{ const p=chosenProv(a||S.answers); const x=p&&soonAbs(p.id); return x?absSentence(p.display_name,x):""; },when:a=>{ const p=chosenProv(a); return !!(p&&soonAbs(p.id)); }};
const ABS_NOTE2 = {kind:"note",q:"Pour une demande qui ne peut pas attendre, le secrétariat peut vous aider : 02 781 18 75.",when:a=>{ const p=chosenProv(a); return !!(p&&soonAbs(p.id)); }};
// Délai souhaité : demandé pour toutes les demandes ; l'équipe décide ensuite du délai réel
const URG_OPTS=["Le plus tôt possible","Dans les prochains jours","Pas pressé"];
const URG_STEP = {id:"urgence",kind:"choice",q:"Pour quand souhaitez-vous une réponse ?",options:URG_OPTS};
const URG_NOTE = {kind:"note",q:"Cette app n'est pas faite pour les urgences vitales. Si votre demande ne peut pas attendre aujourd'hui, appelez le centre au 02 781 18 75.",when:a=>a.urgence==="Le plus tôt possible"};
const URG_NOTE2 = {kind:"note",q:"L'équipe décidera du délai en fonction de votre demande.",when:a=>!!a.urgence};
const POUR_STEP = {id:"pour",kind:"choice",q:"C'est pour qui ?",options:()=>pourOptions(),when:()=>kids().length>0};
const KID_NOTE = {kind:"note",q:"Pour un enfant de moins de 16 ans : ajoutez-le d'abord dans Mon compte → Ma famille.",when:()=>!kids().length};
const FLOWS={
 rdv:[
  {id:"pour",kind:"choice",q:()=>`Bonjour ${S.me?.first_name||""}. Le rendez-vous est pour qui ?`,options:()=>pourOptions(),when:()=>kids().length>0},
  {id:"specialite",kind:"choice",q:"Pour quel type de consultation ?",options:()=>P.specs()},
  {id:"medecin",kind:"choice",q:"Avec qui ?",options:a=>[...P.of(a.specialite).map(P.label),"Peu importe, le premier disponible"],when:a=>P.of(a.specialite).length>1},
  // Médecine générale : motif, détails, lieu (le délai souhaité est demandé à la fin, comme pour toutes les demandes)
  {id:"motif",kind:"choice",q:"Quel est le motif principal ?",options:GP_MOTIFS,when:isGP},
  {id:"details",kind:"text",q:"Décrivez en quelques mots ce qui vous amène.",placeholder:"Ex. toux depuis 5 jours, un peu de fièvre le soir",optional:true,when:isGP},
  // Autres prestataires (spécialiste, dentiste, psychologue…) : première fois ou non, et la raison
  {id:"premiere",kind:"choice",q:"Est-ce la première fois que vous consultez ce prestataire ?",options:["Oui, c'est la première fois","Non, je l'ai déjà consulté"],when:a=>!isGP(a)&&!chosenProv(a)},
  {id:"raison",kind:"text",q:"Pour quelle raison souhaitez-vous ce rendez-vous ?",placeholder:"Ex. contrôle annuel, douleur au genou depuis 2 semaines",when:a=>!isGP(a)},
  {id:"moment",kind:"multi",q:"Quels moments vous conviennent ? Vous pouvez en choisir plusieurs.",options:["Matin","Midi","Après-midi","Fin de journée","Peu importe"],exclusive:"Peu importe"},
  {id:"lieu",kind:"choice",q:"Vous préférez :",options:["Consultation au centre","Visite à domicile","Téléconsultation"],when:isGP}
 ],
 question:[
  {id:"specialite",kind:"choice",q:"Votre question concerne :",options:()=>P.specs()},
  {id:"medecin",kind:"choice",q:"Pour qui est votre question ?",options:a=>[...P.of(a.specialite).map(P.label),"Je ne sais pas"],when:a=>P.of(a.specialite).length>1},
  {id:"sujet",kind:"choice",q:"Elle concerne :",options:["Un symptôme","Un traitement en cours","Un document administratif","Autre chose"]},
  {id:"depuis",kind:"choice",q:"Depuis quand ?",options:["Aujourd'hui","2 à 3 jours","Une semaine","Plus longtemps"],when:a=>a.sujet==="Un symptôme"},
  {id:"texte",kind:"text",q:"Écrivez votre question.",placeholder:"Votre question en quelques phrases"},
  {kind:"note",q:"Si votre question demande un examen, le prestataire vous proposera plutôt un rendez-vous."}
 ],
 prescription:[
  {id:"medecin",kind:"choice",q:"Quel médecin vous suit pour ce traitement ?",options:()=>P.phys().map(P.label)},
  {id:"medicament",kind:"drug",q:"Quel médicament ? Tapez les premières lettres du nom (ou de la marque), puis choisissez la boîte. Vous pouvez en ajouter plusieurs."},
  {id:"historique",kind:"choice",q:"Ces médicaments vous ont-ils déjà été prescrits au centre ?",options:["Oui, c'est mon traitement habituel","Oui, mais il y a plus d'un an","Non, c'est une nouvelle demande"]},
  {id:"nouveau",kind:"choice",q:"Une première prescription demande en principe une consultation. Que souhaitez-vous faire ?",options:["Demander un rendez-vous","Envoyer quand même la demande"],when:a=>a.historique==="Non, c'est une nouvelle demande",jump:{"Demander un rendez-vous":"rdv"}},
  {id:"remarque",kind:"text",q:"Une remarque pour le médecin ?",placeholder:"Ex. effets secondaires, changement de dose",optional:true},
  {kind:"note",q:"Si le médecin accepte, la prescription est électronique : votre pharmacien la retrouve avec votre carte d'identité."}
 ],
 resultats:[
  {id:"examen",kind:"choice",q:"Quel examen avez-vous fait ?",options:["Prise de sang","Analyse d'urine ou de selles","Radio, échographie ou scanner","Autre"]},
  {id:"quand",kind:"choice",q:"Quand l'avez-vous fait ?",options:["Cette semaine","Il y a 1 à 2 semaines","Il y a plus d'un mois"]},
  {id:"demandeur",kind:"choice",q:"Qui l'a demandé ?",options:()=>[...P.phys().map(P.label),"Un médecin hors du centre (spécialiste, hôpital)"]},
  {id:"contact",kind:"choice",q:"Comment préférez-vous qu'on vous informe ?",options:["Message dans l'application","Appel téléphonique","Rendez-vous pour en parler"]},
  {kind:"note",q:"Vous avez déjà le résultat en main ? Utilisez plutôt « Envoyer un document ». Le centre vous contacte dès qu'ils sont analysés."}
 ]
};
FLOWS.rapport=[
  {id:"medecin",kind:"choice",q:"Quel médecin doit rédiger le rapport ?",options:()=>P.phys().map(P.label)},
  {id:"destinataire",kind:"text",q:"Pour qui est ce rapport ?",placeholder:"Ex. mutuelle, médecin conseil, employeur, assurance, école…"},
  {id:"echeance",kind:"text",q:"Pour quand en avez-vous besoin ?",placeholder:"Ex. avant le 30 octobre"},
  {id:"details",kind:"text",q:"Précisez votre demande si nécessaire.",placeholder:"Ex. rapport sur mon incapacité de travail depuis septembre",optional:true},
  {kind:"note",q:"S'il y a un formulaire à compléter, ajoutez-le ensuite dans la conversation (trombone ou scanner). Le médecin vous répond ici ; il peut vous proposer un rendez-vous si un examen est nécessaire."}
];
FLOWS.document=[
  {id:"doc",kind:"choice",q:"Quel document souhaitez-vous envoyer ?",options:["Résultats d'examen (prise de sang, radio…)","Courrier ou rapport d'un spécialiste ou de l'hôpital","Attestation ou formulaire à compléter","Autre document"]},
  {id:"medecin",kind:"choice",q:"Pour qui ?",options:()=>[...P.list().map(P.label),"Le secrétariat"]},
  {id:"fichiers",kind:"files",q:"Ajoutez votre document : prenez-le en photo, scannez-le (plusieurs pages possibles) ou choisissez un PDF."},
  {id:"note",kind:"text",q:"Un mot pour accompagner le document ?",placeholder:"Ex. résultats de la prise de sang du 10 octobre",optional:true},
  {kind:"note",q:"Le prestataire vous répond ici ou vous propose un rendez-vous."}
];
// Délai souhaité : après la dernière question de chaque demande, avant les remarques finales
Object.keys(FLOWS).forEach(k=>{ const f=FLOWS[k]; let i=f.length; while(i>0&&f[i-1].kind==="note") i--; f.splice(i,0,URG_STEP,URG_NOTE,URG_NOTE2); });
// Après le choix du prestataire : « Avez-vous déjà consulté… ? » (sauf rendez-vous et secrétariat)
["question","prescription","rapport","document"].forEach(k=>{ const i=FLOWS[k].findIndex(s=>s.id==="medecin"); FLOWS[k].splice(i+1,0,DEJA_VU); FLOWS[k].push(VIA_SECR); });
{ const i=FLOWS.rdv.findIndex(s=>s.id==="medecin"); FLOWS.rdv.splice(i+1,0,DEJA_VU); }
["rdv","question","prescription","rapport","document"].forEach(k=>FLOWS[k].push(ABS_NOTE,ABS_NOTE2));
["question","prescription","rapport","resultats","document"].forEach(k=>FLOWS[k].unshift(POUR_STEP));
FLOWS.rdv.push(KID_NOTE); FLOWS.question.push(KID_NOTE);
const LABELS={doc:"Document",fichiers:"Fichiers",note:"Message",de:"De",pour:"Pour",specialite:"Consultation",medecin:"Prestataire",motif:"Motif",delai:"Pour quand",urgence:"Délai souhaité",details:"Détails",moment:"Disponibilités",lieu:"Lieu",
 sujet:"Sujet",depuis:"Depuis",texte:"Question",medicament:"Médicaments",historique:"Déjà prescrit",nouveau:"Choix",remarque:"Remarque",
 examen:"Examen",quand:"Date",demandeur:"Demandé par",contact:"Contact souhaité",
 premiere:"Première consultation",deja_vu:"Déjà consulté",raison:"Raison",destinataire:"Rapport pour",echeance:"Pour quand"};
const HIDDEN_KEYS=new Set(["provider_id","medicaments"]);
const answersDL = a => Object.entries(a||{}).filter(([k])=>!HIDDEN_KEYS.has(k)).map(([k,v])=>`<dt>${esc(LABELS[k]||k)}</dt><dd>${esc(v||"—")}</dd>`).join("");
const summaryLine = a => a.motif||a.raison||(a.destinataire?"Pour "+a.destinataire:"")||a.texte||a.medicament||a.examen||a.doc||a.sujet||"";
const qText = s => typeof s.q==="function" ? s.q() : s.q;
const optsOf = s => typeof s.options==="function" ? s.options(S.answers) : s.options;

/* ---------- médicaments : liste officielle CBIP (table medicine_packs) ---------- */
const norm=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
let drugSeq=0;
async function searchDrugs(q){
  const words=norm(q).replace(/[%_,()*\\]/g," ").split(/\s+/).filter(Boolean);
  if(!words.join("").length||words.join("").length<2) return [];
  const {data,error}=await sb.from("medicine_packs").select("id,brand,label,generic").ilike("search",`%${words.join("%")}%`).order("brand").limit(60);
  if(error){ console.error(error); return null; }
  const w0=words[0];
  const score=r=>(norm(r.brand).startsWith(w0)?0:norm(r.generic).startsWith(w0)?1:2)*10+(/^[^(]*\(/.test(r.label.slice(r.brand.length,r.brand.length+3))?1:0);
  return (data||[]).sort((a,b)=>score(a)-score(b)||a.brand.localeCompare(b.brand)||a.label.length-b.label.length||a.label.localeCompare(b.label)).slice(0,15);
}
function hlite(text,q){const n=norm(text),i=n.indexOf(norm(q.trim()));if(i<0)return esc(text);const L=q.trim().length;return esc(text.slice(0,i))+"<b>"+esc(text.slice(i,i+L))+"</b>"+esc(text.slice(i+L))}

/* ---------- statut d'une demande ---------- */
const lastFrom = r => r.last_from;
const msgsOf = r => (r.messages||[]).slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
const awaitingStaff = r => r.status!=="traite" && r.last_from==="patient";
const newPatientMsg = r => awaitingStaff(r) && msgsOf(r).some(m=>!m.from_patient);
const closedLabel = r => r.purged_at ? "Effacée" : r.type==="centre" ? "Classée" : (r.request_items||[]).some(i=>i.decision==="accorde") ? "Prescription faite" : "Classée";
function stLabel(r){ if(r.status==="traite") return closedLabel(r); if(newPatientMsg(r)) return "Nouveau message"; if(!awaitingStaff(r)) return "En attente du patient"; return r.status==="nouveau"?"Nouveau":"En cours"; }
function stClass(r){ if(r.status==="traite") return "traite"; if(newPatientMsg(r)) return "nouveau"; if(!awaitingStaff(r)) return "wait"; return r.status; }
/* ----- suivi « demande vue / transmise » (le patient est prévenu) ----- */
const updsOf = r => (r.request_updates||[]).slice().sort((a,b)=>a.created_at<b.created_at?-1:1);
const lastPatientAt = r => { const ms=msgsOf(r).filter(m=>m.from_patient); return ms.length?ms[ms.length-1].created_at:r.created_at; };
const seenSinceLast = r => updsOf(r).filter(u=>u.kind==="vu"&&u.created_at>lastPatientAt(r)).pop()||null;
const canMarkSeen = r => r.status!=="traite"&&r.type!=="centre"&&r.last_from!=="staff"&&!seenSinceLast(r);
const GENERIC_LBL=new Set(["le secrétariat","l'administration du centre","l'équipe du centre"]);
function updTextP(u){ return u.kind==="vu"?`✓ Votre demande a été vue par ${u.label}. Elle est en cours de traitement.`:`↪ Votre demande a été transmise à ${u.label}, qui va la traiter.`; }
function updTextC(u){ return u.kind==="vu"?`✓ Patient prévenu : demande vue (${u.label})`:`↪ Patient prévenu du transfert vers ${u.label}`; }
function stLabelP(r){ if(r.status==="traite") return closedLabel(r); if(r.last_from==="staff") return r.type==="centre"?"Message reçu":"Réponse reçue"; if(seenSinceLast(r)) return "Vue · en cours"; return r.status==="encours"?"En cours":"Envoyée"; }
function stClassP(r){ if(r.status==="traite") return "traite"; if(r.last_from==="staff") return "reply"; return "encours"; }
const PRIO_LABEL={haute:"Haute priorité",normale:"Normale",basse:"Pas pressé"};
function dueHTML(r){ if(r.status==="traite") return ""; if(!awaitingStaff(r)) return `<span class="due wait">En attente de la réponse du patient</span>`;
  const late = r.due_at && new Date(r.due_at) < new Date();
  return late ? `<span class="due late">En retard · prévu ${fmtWhen(r.due_at)}</span>` : `<span class="due ${r.priority}">${PRIO_LABEL[r.priority]} · à voir avant ${r.due_at?fmtWhen(r.due_at):"—"}</span>`; }
/* =====================================================================
   CONVERSATIONS (façon messagerie) : bulles, photos, PDF, messages vocaux
   ===================================================================== */
const PURGE_DAYS=15;
const purgeDate = r => r.closed_at ? new Date(new Date(r.closed_at).getTime()+PURGE_DAYS*864e5) : null;
const longDate = d => new Date(d).toLocaleDateString(LOC,{weekday:"long",day:"numeric",month:"long"});
const hm = d => new Date(d).toLocaleTimeString(LOC,{hour:"2-digit",minute:"2-digit"});
const dur = s => `${Math.floor((s||0)/60)}:${String((s||0)%60).padStart(2,"0")}`;
const kb = n => n>=1048576 ? (n/1048576).toFixed(1).replace(".",L==="fr"?",":".")+(L==="fr"?" Mo":" MB") : Math.max(1,Math.round(n/1024))+(L==="fr"?" ko":" KB");
const AUTO_BODY = /^(📷 Photo|📄 .*|🎤 Message vocal)$/u;
function dayLabel(d){ d=new Date(d); const k=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(), diff=Math.round((k(new Date())-k(d))/864e5);
  return diff===0?"Aujourd'hui":diff===1?"Hier":longDate(d); }
function msgPreview(m){ if(!m) return ""; const a=(m.attachments||[])[0]; return a&&AUTO_BODY.test(m.body)?m.body:(a?(a.kind==="image"?"📷 ":a.kind==="pdf"?"📄 ":"🎤 ")+m.body:m.body); }
function attHTML(a){
  if(a.kind==="image") return `<button type="button" class="att img loading" data-att="${a.id}" data-kind="image" aria-label="Agrandir la photo"><img alt="Photo envoyée"></button>`;
  if(a.kind==="audio") return `<div class="att aud loading" data-att="${a.id}" data-kind="audio" data-dur="${a.duration_s||0}"><audio controls preload="metadata"></audio>${a.duration_s?`<small>${dur(a.duration_s)}</small>`:""}</div>`;
  return `<a class="att pdf loading" data-att="${a.id}" data-kind="pdf" href="#" download="${esc(a.name)}">${IC.doc}<span><b>${esc(a.name)}</b><small>PDF · ${kb(a.size)} · toucher pour ouvrir</small></span></a>`;
}
/* ----- ligne « nouveaux messages » dans une conversation (comme WhatsApp) -----
   À l'ouverture, on fige le moment de la dernière lecture : la ligne reste au même endroit
   tant que la conversation est affichée. Le moment de lecture est retenu sur cet appareil. */
const UNREAD={};
const seenKey = k => "cmpl_seen_"+(S.me?.id||"")+"_"+k;
function seenGet(k){ try{ return localStorage.getItem(seenKey(k)); }catch(e){ return null; } }
function seenSet(k,t){ try{ if(t) localStorage.setItem(seenKey(k),t); }catch(e){} }
function unreadLine(n){ return `<div class="unreadline" role="separator"><span>${n>1?n+" nouveaux messages":"1 nouveau message"}</span></div>`; }
function reqUnreadFrom(r, viewer, mine){
  const k="r"+r.id, ms=msgsOf(r);
  if(!(k in UNREAD)){
    let at=seenGet(k);
    if(!at){   // première ouverture sur cet appareil
      if(viewer==="patient"){ const un=S.notifs.filter(n=>n.request_id===r.id&&!n.read_at&&n.title!=="Demande bien reçue");
        at=un.length?new Date(Math.min(...un.map(n=>+new Date(n.created_at)))-60000).toISOString():"9999"; }
      else if(r.status!=="traite"&&r.last_from==="patient"){ const ls=[...ms].reverse().find(m=>!m.from_patient); at=ls?ls.created_at:"9999"; }
      else at="9999";
    }
    UNREAD[k]=at;
  }
  if(ms.length) seenSet(k,ms[ms.length-1].created_at);
  return UNREAD[k];
}
function chatHTML(r, viewer){
  // équipe : seuls MES messages sont à droite ; ceux des collègues et du patient sont à gauche, avec le nom
  const mine = m => viewer==="patient" ? m.from_patient : (!m.from_patient && (m.author_id ? m.author_id===S.me.id : false));
  const dest = reqWho(r);
  let h=`<div class="chat" id="chat">`, day="", who="";
  const sep = d => { const l=dayLabel(d); if(l!==day){ day=l; who=""; h+=`<div class="day"><span>${esc(l)}</span></div>`; } };
  if(viewer==="patient" && !r.purged_at && r.type!=="centre"){
    sep(r.created_at);
    const dl=answersDL(r.answers);
    h+=`<div class="msg me"><div class="bub me reqcard"><b>${TYPES[r.type].title}</b>${dl?`<dl>${dl}</dl>`:""}<span class="t">${hm(r.created_at)}</span></div></div>`;
    if(r.status!=="traite") h+=`<div class="sys"><span>Envoyée à :</span> <b translate="no">${esc(dest)}</b><br><span>${r.priority==="haute"?"Elle sera vue dans les 24 heures (heures d'ouverture).":r.priority==="basse"?"Elle sera vue dès que possible (heures d'ouverture).":"Elle sera vue dans les 72 heures (heures d'ouverture)."}</span> <span>${r.provider_id?"Le délai de réponse est ensuite décidé par le prestataire.":"Le délai de réponse est ensuite décidé par le centre."}</span><br>Urgence vitale : 112.</div>`;
  }
  const ufrom=reqUnreadFrom(r, viewer, mine), allM=msgsOf(r), nNew=allM.filter(m=>!mine(m)&&m.created_at>ufrom).length;
  let uDone=false; const upds=updsOf(r); let ui=0;
  const putUpd=u=>{ sep(u.created_at); who=""; h+=`<div class="sys upd ${u.kind}"><span>${esc(viewer==="patient"?updTextP(u):updTextC(u))}</span> <small class="t">${hm(u.created_at)}</small></div>`; };
  for(const m of allM){
    while(ui<upds.length&&upds[ui].created_at<=m.created_at) putUpd(upds[ui++]);
    sep(m.created_at);
    if(!uDone&&nNew&&!mine(m)&&m.created_at>ufrom&&(viewer==="patient"||m!==allM[0])){ uDone=true; who=""; h+=unreadLine(nNew); }
    const me=mine(m), atts=m.attachments||[];
    const name = viewer==="patient" ? (m.from_patient?"":m.author_label)
      : m.from_patient ? `${patientName(r.patient_id)} · ${r.child_id?"parent":"patient"}`
      : (m.author_id&&(S.team||[]).some(t=>t.id===m.author_id) ? staffName(m.author_id) : (m.author_label||"Le centre"));
    const showName = !me && name && name!==who; who = me ? "" : name;
    const col = viewer!=="patient" && !me && !m.from_patient;
    const showBody = !(atts.length && AUTO_BODY.test(m.body));
    h+=`<div class="msg ${me?"me":"them"}">${showName?`<small class="who${col?" colwho":""}">${viewer==="patient"&&!m.from_patient&&AV.get(m.author_id)?avatarHTML(AV.get(m.author_id),name,22):""}${esc(name)}</small>`:""}<div class="bub ${me?"me":"bot"}${col?" col":""}${atts.length?" hasatt":""}">${atts.map(attHTML).join("")}${showBody?`<div class="txt" dir="auto" translate="${AUTO_BODY.test(m.body)?"yes":"no"}">${esc(m.body)}</div>`:""}<span class="t">${hm(m.created_at)}</span></div></div>`;
  }
  while(ui<upds.length) putUpd(upds[ui++]);
  if(r.purged_at) h+=`<div class="sys">Le contenu de cette conversation a été effacé le ${fmtDate(r.purged_at)} pour protéger les données${viewer==="patient"?" de santé":" du patient"}.</div>`;
  else if(r.status==="traite"&&r.closed_at) h+=`<div class="sys">Conversation classée le ${fmtDate(r.closed_at)}. Elle sera effacée le ${fmtDate(purgeDate(r))}.</div>`;
  return h+`</div>`;
}

/* ----- photos de profil (facultatives) ----- */
const AV=new Map(), PAV=new Map(); let pavLoaded=false;
function b64url(d){ const bin=atob(d), u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([u],{type:d.startsWith("iVBOR")?"image/png":"image/jpeg"})); }
async function loadAvatars(ids){
  const need=[...new Set(ids.filter(Boolean))].filter(id=>!AV.has(id)); if(!need.length) return;
  need.forEach(id=>AV.set(id,null));
  const {data,error}=await sb.rpc("get_avatars",{p_ids:need}); if(error){ need.forEach(id=>AV.delete(id)); return; }
  (data||[]).forEach(a=>AV.set(a.user_id,b64url(a.data)));
}
async function loadProviderAvatars(){ if(pavLoaded) return; pavLoaded=true;
  const {data,error}=await sb.rpc("get_provider_avatars"); if(error){ pavLoaded=false; return; }
  (data||[]).forEach(a=>PAV.set(a.provider_id,b64url(a.data))); }
const initials = n => (n||"").split(/\s+/).filter(w=>w&&!/^dr\.?$/i.test(w)).slice(0,2).map(w=>w[0].toUpperCase()).join("")||"?";
function avatarHTML(url,name,size=40,fallback){
  return `<span class="av" style="width:${size}px;height:${size}px;font-size:${Math.round(size*.38)}px" aria-hidden="true">${url?`<img src="${url}" alt="">`:(fallback||esc(initials(name)))}</span>`; }
// Photo carrée 256 px, réenregistrée en JPEG (sans données cachées)
async function squarePhoto(file){
  const url=URL.createObjectURL(file);
  try{ const img=await new Promise((ok,ko)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=ko; i.src=url; });
    const s=Math.min(img.naturalWidth,img.naturalHeight), c=document.createElement("canvas"); c.width=c.height=256;
    c.getContext("2d").drawImage(img,(img.naturalWidth-s)/2,(img.naturalHeight-s)/2,s,s,0,0,256,256);
    return await new Promise(ok=>c.toBlob(ok,"image/jpeg",0.85));
  } finally { URL.revokeObjectURL(url); }
}
function photoCardHTML(hint){
  const url=AV.get(S.me.id), name=`${S.me.first_name||""} ${S.me.last_name||""}`;
  return `<section class="card photocard"><div class="photorow">${avatarHTML(url,name,84)}<div><h3>Photo de profil</h3><p class="hint">${hint}</p>
   <div class="btnrow"><button type="button" class="btn ghost" id="ph-pick">${url?"Changer la photo":"Ajouter une photo"}</button><button type="button" class="btn ghost" id="ph-draw">Choisir un dessin</button>${url?`<button type="button" class="linkbtn" id="ph-del">Retirer</button>`:""}</div></div></div>
   <input type="file" id="ph-file" accept="image/*" hidden></section>`;
}
function bindPhotoCard(){
  const inp=$("#ph-file"); if(!inp) return;
  $("#ph-pick").onclick=()=>inp.click(); $("#ph-draw").onclick=openAvatarPicker;
  inp.onchange=async()=>{ const f=inp.files[0]; inp.value=""; if(!f) return;
    try{ const blob=await squarePhoto(f); const data=await blobToB64(blob);
      if(await run(()=>sb.rpc("set_my_avatar",{p_data:data}),"Photo enregistrée")){ const old=AV.get(S.me.id); if(old) URL.revokeObjectURL(old); AV.set(S.me.id,URL.createObjectURL(blob)); render(); } }
    catch(e){ toast("Cette photo n'a pas pu être lue. Essayez une autre photo."); } };
  const d=$("#ph-del"); if(d) d.onclick=async()=>{ if(await run(()=>sb.rpc("delete_my_avatar"),"Photo retirée")){ AV.set(S.me.id,null); render(); } };
}

/* ----- pièces jointes : chargement à la demande (jamais stockées sur l'appareil) ----- */
const ATT=new Map();
function attLoad(id){
  if(ATT.has(id)) return ATT.get(id);
  const p=(async()=>{ const {data,error}=await sb.rpc("get_attachment",{p_id:id}); if(error) throw error;
    const bin=atob(data.data), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    const blob=new Blob([u8],{type:data.mime}); return {url:URL.createObjectURL(blob), blob, mime:data.mime, name:data.name}; })();
  ATT.set(id,p); p.catch(()=>ATT.delete(id)); return p;
}
/* ---------- messages vocaux : lecture fiable ----------
   Les enregistrements faits sur téléphone n'indiquent pas toujours leur durée dans le fichier :
   certains navigateurs s'arrêtent alors trop tôt (« terminé » alors que ce n'est pas fini).
   On mesure la vraie durée, et si la lecture s'arrête avant la fin, elle reprend là où elle s'est arrêtée. */
const audioPlaying = () => [...document.querySelectorAll("audio")].some(a=>!a.paused&&!a.ended);
async function realDuration(blob){ try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC||!blob) return 0;
  const ac=new AC(); const buf=await ac.decodeAudioData(await blob.arrayBuffer()); const d=buf.duration; ac.close&&ac.close(); return d||0; }catch(e){ return 0; } }
function fixAudio(au, blob, known){
  let want=known||0;
  if(!want&&blob) realDuration(blob).then(d=>{ if(d) want=d; });
  au.addEventListener("loadedmetadata",()=>{ if(!isFinite(au.duration)){ const back=()=>{ au.removeEventListener("timeupdate",back); au.currentTime=0; }; au.addEventListener("timeupdate",back); au.currentTime=1e7; } });
  let tries=0;
  au.addEventListener("play",()=>{ if(au.currentTime<0.5) tries=0; });
  au.addEventListener("ended",()=>{ const t=au.currentTime;
    if(want&&t>0.3&&t<want-0.8&&tries<5){ tries++; au.currentTime=t; au.play().catch(()=>{}); } });
}
function hydrateAtt(){
  $$("[data-att]:not([data-ready])").forEach(async el=>{
    el.dataset.ready="1";
    try{ const a=await attLoad(+el.dataset.att); el.classList.remove("loading");
      if(el.dataset.kind==="image"){ const img=el.querySelector("img"); img.onload=scrollChat; img.src=a.url; el.onclick=()=>openViewer(a.url); }
      else if(el.dataset.kind==="audio"){ const au=el.querySelector("audio"); au.onerror=()=>{ if(!el.querySelector(".attfail")) el.insertAdjacentHTML("beforeend",`<a class="attfail" href="${a.url}" download="message-vocal.${a.mime.includes("webm")?"webm":a.mime.includes("ogg")?"ogg":"m4a"}">Lecture impossible ici : télécharger le message vocal</a>`); }; au.src=a.url; fixAudio(au, a.blob, +el.dataset.dur||0); }
      else if(IS_NATIVE&&SEC()){ el.href="#"; el.removeAttribute("download"); el.onclick=async e=>{ e.preventDefault(); try{ await nativePreview(a.blob, a.name); }catch(err){ console.error(err); toast("Ce document n'a pas pu être ouvert."); } }; }
      else { el.href=a.url; el.target="_blank"; el.rel="noopener"; }
    }catch(e){ console.error(e); el.classList.remove("loading"); el.classList.add("failed"); el.insertAdjacentHTML("beforeend",`<small class="attfail">Pièce jointe indisponible</small>`); }
  });
}
function openViewer(url){
  // plein écran, avec zoom au doigt (pincer / double-toucher) et déplacement : marche aussi dans l'app iPhone
  const v=document.createElement("div"); v.className="viewer"; v.setAttribute("role","dialog"); v.setAttribute("aria-label","Photo");
  v.innerHTML=`<img alt="Photo agrandie" draggable="false"><button class="cbtn" aria-label="Fermer">✕</button><p class="vhint">Pincez ou touchez deux fois pour zoomer</p>`;
  const img=v.querySelector("img"); img.src=url;
  let sc=1, tx=0, ty=0, pts=new Map(), start=null, moved=false, lastTap=0;
  const apply=()=>{ img.style.transform=`translate(${tx}px,${ty}px) scale(${sc})`; v.classList.toggle("zoomed",sc>1.01); };
  const clamp=()=>{ if(sc<=1){sc=1;tx=0;ty=0;return;} sc=Math.min(sc,6);
    const r=img.getBoundingClientRect(), w=r.width/sc, h=r.height/sc, mx=Math.max(0,(w*sc-innerWidth)/2), my=Math.max(0,(h*sc-innerHeight)/2);
    tx=Math.max(-mx,Math.min(mx,tx)); ty=Math.max(-my,Math.min(my,ty)); };
  const zoomAt=(nsc,cx,cy)=>{ const r=v.getBoundingClientRect(), ox=cx-r.width/2, oy=cy-r.height/2;
    tx=ox-(ox-tx)*nsc/sc; ty=oy-(oy-ty)*nsc/sc; sc=nsc; };
  const close=()=>{ v.remove(); removeEventListener("keydown",esc_); }; const esc_=e=>{ if(e.key==="Escape") close(); };
  v.addEventListener("pointerdown",e=>{ if(e.target.closest(".cbtn")) return; v.setPointerCapture?.(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved=false;
    const a=[...pts.values()];
    start=a.length===2?{d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),sc,tx,ty,cx:(a[0].x+a[1].x)/2,cy:(a[0].y+a[1].y)/2}:{x:e.clientX,y:e.clientY,tx,ty}; });
  v.addEventListener("pointermove",e=>{ if(!pts.has(e.pointerId)) return; pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); const a=[...pts.values()];
    if(a.length===2&&start&&start.d){ const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y); sc=start.sc; tx=start.tx; ty=start.ty;
      zoomAt(Math.max(1,Math.min(6,start.sc*d/start.d)),start.cx,start.cy); moved=true; apply(); }
    else if(a.length===1&&start&&start.x!=null){ const dx=e.clientX-start.x, dy=e.clientY-start.y; if(Math.abs(dx)+Math.abs(dy)>6) moved=true;
      if(sc>1){ tx=start.tx+dx; ty=start.ty+dy; apply(); } } });
  const up=e=>{ if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if(pts.size===0){ clamp(); apply();
      if(!moved&&!e.target.closest(".cbtn")){ const now=Date.now();
        if(now-lastTap<320){ lastTap=0; if(sc>1){sc=1;tx=0;ty=0;} else zoomAt(2.5,e.clientX,e.clientY); clamp(); apply(); }
        else { lastTap=now; const onImg=e.target===img; setTimeout(()=>{ if(lastTap===now&&sc<=1&&!onImg) close(); },330); } } }
    else { const a=[...pts.values()]; start={x:a[0].x,y:a[0].y,tx,ty}; } };
  v.addEventListener("pointerup",up); v.addEventListener("pointercancel",up);
  v.addEventListener("wheel",e=>{ e.preventDefault(); zoomAt(Math.max(1,Math.min(6,sc*(e.deltaY<0?1.15:0.87))),e.clientX,e.clientY); clamp(); apply(); },{passive:false});
  v.querySelector("button").onclick=e=>{ e.stopPropagation(); close(); };
  addEventListener("keydown",esc_); document.body.appendChild(v); v.querySelector("button").focus();
}
function scrollToUnread(box){   // une seule fois par ouverture : la ligne « nouveaux messages » en vue
  const u=box&&box.querySelector(".unreadline"); if(!u) return false;
  const k=box.id+":"+(box.id==="tmsgs"?S.tthread:S.me?.role==="patient"?S.openReq:S.sel), t=UNREAD["s:"+k];
  if(t) return Date.now()-t<2500;   // juste après l'ouverture (photos qui se chargent) : on ne saute pas en bas
  UNREAD["s:"+k]=Date.now();
  if(box.scrollHeight>box.clientHeight+4) box.scrollTop=Math.max(0,u.offsetTop-box.offsetTop-40); else u.scrollIntoView({block:"center"});
  return true; }
function scrollChat(){
  const c=$("#chat"); if(!c) return;
  if(scrollToUnread(c)) return;
  if(c.closest(".detail")) c.scrollTop=c.scrollHeight; else scrollTo(0,document.body.scrollHeight);
}

/* ----- barre d'écriture : texte, pièce jointe, message vocal ----- */
function composerHTML(key){
  const draft=S.drafts[key]||"", pf=S.pend&&S.pend.key===key?S.pend:null, tpl=/^s\d/.test(key);
  return `<div class="chatbar" id="chatbar">
   ${pf?`<div class="attprev">${pf.kind==="image"?`<img src="${pf.url}" alt="">`:IC.doc}<span><b>${esc(pf.name)}</b><small>${kb(pf.blob.size)} · prêt à envoyer</small></span><button type="button" class="cbtn sm" id="c-unatt" aria-label="Retirer la pièce jointe">✕</button></div>`:""}
   <div class="cbrow" id="cbrow">
    <button type="button" class="cbtn" id="c-att" aria-label="Joindre une photo ou un PDF" title="Photo ou PDF">${IC.clip}</button>
    <button type="button" class="cbtn" id="c-scan" aria-label="Scanner un document" title="Scanner un document">${IC.scan}</button>
    <button type="button" class="cbtn emob" id="c-emo" aria-label="Emojis" title="Emojis" aria-haspopup="true">🙂</button>
    ${tpl?`<button type="button" class="cbtn tplb" id="c-tpl" aria-label="Réponses types" title="Réponses types" aria-haspopup="true">${SI.tpl}</button><button type="button" class="cbtn" id="c-fiche" aria-label="Joindre une fiche conseil" title="Fiche conseil (PDF)">📋</button>`:""}
    <input type="file" id="c-file" accept="image/*,application/pdf" hidden>
    <textarea id="c-text" rows="1" maxlength="4000" placeholder="${pf?"Ajouter un message (facultatif)":"Écrire un message"}" aria-label="Message">${esc(draft)}</textarea>
    <button type="button" class="cbtn go" id="c-go"></button>
   </div>
   <div class="recbar" id="recbar" hidden>
    <button type="button" class="cbtn" id="r-cancel" aria-label="Annuler le message vocal">${IC.trash}</button>
    <span class="recdot" aria-hidden="true"></span><span id="r-time" class="rtime">0:00</span><span class="lvl" aria-hidden="true"><i id="r-lvl"></i></span><span class="rech">Parlez, puis touchez ➤ pour envoyer</span>
    <button type="button" class="cbtn go" id="r-send" aria-label="Envoyer le message vocal">${IC.send}</button>
   </div>
  </div>`;
}
const canRecord = () => !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
const EMOJIS=["😊","🙂","😀","😄","😉","😅","😂","🙃","🤔","😮","😢","😴","😷","🤒","🤧","🙏","👍","👌","👏","👋","🤝","💪","❤️","💙","🌞","☀️","🌧️","❄️","🎉","🎂","💐","🍀","✅","❌","⚠️","❗","❓","📅","⏰","📞","📄","📎","💊","🩺","🏥","🚗","👶","👨‍⚕️","👩‍⚕️"];
function bindComposer(key, send, onInput){
  const ta=$("#c-text"), go=$("#c-go"), file=$("#c-file"); if(!ta) return;
  const upd=()=>{ const has=!!(ta.value.trim()||(S.pend&&S.pend.key===key)), mic=!has&&canRecord();
    go.innerHTML=mic?IC.mic:IC.send; go.dataset.mode=mic?"mic":"send"; go.disabled=!has&&!mic;
    go.setAttribute("aria-label",mic?"Enregistrer un message vocal":"Envoyer"); go.title=mic?"Message vocal":"Envoyer"; };
  const grow=()=>{ ta.style.height="auto"; ta.style.height=Math.min(ta.scrollHeight,150)+"px"; };
  ta.oninput=()=>{ S.drafts[key]=ta.value; grow(); upd(); if(onInput) onInput(ta.value); };
  grow(); upd();
  const emo=$("#c-emo"); if(emo) emo.onclick=e=>{ e.stopPropagation(); const old=$("#emopop"); if(old){ old.remove(); return; }
    const pop=document.createElement("div"); pop.id="emopop"; pop.className="emopop"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label","Emojis");
    pop.innerHTML=EMOJIS.map(x=>`<button type="button" data-emo="${x}" aria-label="${x}">${x}</button>`).join("");
    $("#cbrow").appendChild(pop);
    pop.querySelectorAll("[data-emo]").forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); const v=b.dataset.emo, a=ta.selectionStart??ta.value.length, z=ta.selectionEnd??a;
      ta.value=ta.value.slice(0,a)+v+ta.value.slice(z); ta.focus(); ta.setSelectionRange(a+v.length,a+v.length); ta.dispatchEvent(new Event("input")); });
    const off=ev=>{ if(!pop.contains(ev.target)&&ev.target!==emo){ pop.remove(); document.removeEventListener("click",off); } }; setTimeout(()=>document.addEventListener("click",off),0);
    const esc_=ev=>{ if(ev.key==="Escape"){ pop.remove(); document.removeEventListener("keydown",esc_); } }; document.addEventListener("keydown",esc_); };
  $("#c-att").onclick=()=>file.click();
  $("#c-scan").onclick=()=>openScanner(pend=>{ clearPend(); S.pend={...pend,key}; render(); $("#c-text")?.focus({preventScroll:true}); });
  file.onchange=async()=>{ const f=file.files[0]; file.value=""; if(!f) return;
    try{ clearPend(); S.pend=await prepFile(f,key); render(); $("#c-text")?.focus({preventScroll:true}); }catch(e){ toast(e.message); } };
  const un=$("#c-unatt"); if(un) un.onclick=()=>{ clearPend(); render(); };
  const fi=$("#c-fiche"); if(fi) fi.onclick=()=>pickFiche(async p=>{ clearPend(); S.pend={...p,key}; render(); $("#c-text")?.focus({preventScroll:true}); });
  go.onclick=async()=>{
    if(go.dataset.mode==="mic") return startRec(key, send);
    go.disabled=true; const pend=S.pend&&S.pend.key===key?S.pend:null;
    const ok=await send(ta.value.trim(), pend); if(!ok&&document.body.contains(go)) go.disabled=false; };
  ta.onkeydown=e=>{ if(e.key==="Enter"&&!e.shiftKey&&matchMedia("(pointer:fine)").matches){ e.preventDefault(); if(go.dataset.mode==="send"&&!go.disabled) go.click(); } };
}
function clearPend(){ if(S.pend&&S.pend.url) URL.revokeObjectURL(S.pend.url); S.pend=null; }
async function prepFile(f,key){
  const isPdf=f.type==="application/pdf"||/\.pdf$/i.test(f.name);
  if(isPdf){ if(f.size>5*1048576) throw new Error("Ce PDF est trop lourd (5 Mo maximum).");
    return {key,kind:"pdf",mime:"application/pdf",name:(f.name||"document.pdf").slice(0,80),blob:f}; }
  if(!(f.type||"").startsWith("image/")&&!/\.(jpe?g|png|heic|heif|webp)$/i.test(f.name)) throw new Error("Vous pouvez joindre une photo ou un PDF.");
  let blob; try{ blob=await shrinkImage(f); }catch(e){ throw new Error("Cette photo n'a pas pu être lue. Essayez une autre photo (format JPEG)."); }
  if(blob.size>5*1048576) throw new Error("Cette photo est trop lourde.");
  return {key,kind:"image",mime:"image/jpeg",name:"photo.jpg",blob,url:URL.createObjectURL(blob)};
}
// Photo réduite (1600 px) et réenregistrée : plus légère, et sans les données cachées (position GPS…)
async function shrinkImage(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((ok,ko)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=ko; i.src=url; });
    const k=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(img.naturalWidth*k)); c.height=Math.max(1,Math.round(img.naturalHeight*k));
    const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
    const blob=await new Promise(ok=>c.toBlob(ok,"image/jpeg",0.82)); if(!blob) throw new Error("conversion"); return blob;
  } finally { URL.revokeObjectURL(url); }
}
/* ----- scanner : pages photographiées → un seul PDF (fait dans le téléphone, rien n'est envoyé avant) ----- */
async function scanPage(file, enhance){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((ok,ko)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=ko; i.src=url; });
    const k=Math.min(1,1754/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(img.naturalWidth*k)); c.height=Math.max(1,Math.round(img.naturalHeight*k));
    const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
    if(enhance){ // gris + contraste automatique : fond blanc, texte net
      const d=g.getImageData(0,0,c.width,c.height), px=d.data, hist=new Uint32Array(256), n=px.length/4;
      for(let i=0;i<px.length;i+=4){ const y=(px[i]*299+px[i+1]*587+px[i+2]*114)/1000|0; px[i]=y; hist[y]++; }
      let lo=0,hi=255,acc=0; for(let v=0;v<256;v++){ acc+=hist[v]; if(acc>n*0.02){ lo=v; break; } }
      acc=0; for(let v=255;v>=0;v--){ acc+=hist[v]; if(acc>n*0.25){ hi=v; break; } }
      if(hi-lo<40){ lo=Math.max(0,hi-40); }
      for(let i=0;i<px.length;i+=4){ let y=(px[i]-lo)*255/(hi-lo); y=y<0?0:y>255?255:y; y=255*Math.pow(y/255,1.4); px[i]=px[i+1]=px[i+2]=y; }
      g.putImageData(d,0,0);
    }
    const blob=await new Promise(ok=>c.toBlob(ok,"image/jpeg",enhance?0.72:0.8));
    return {blob, w:c.width, h:c.height, thumb:URL.createObjectURL(blob)};
  } finally { URL.revokeObjectURL(url); }
}
async function makePdf(pages){
  const enc=new TextEncoder(), parts=[], offs=[]; let len=0;
  const push=x=>{ const b=typeof x==="string"?enc.encode(x):x; parts.push(b); len+=b.length; };
  const obj=(n,body)=>{ offs[n]=len; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const N=pages.length, kids=pages.map((_,i)=>`${3+i*3} 0 R`).join(" ");
  obj(1,()=>push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2,()=>push(`<< /Type /Pages /Kids [${kids}] /Count ${N} >>`));
  for(let i=0;i<N;i++){
    const pg=pages[i], W=595.28, H=+(W*pg.h/pg.w).toFixed(2), jpg=new Uint8Array(await pg.blob.arrayBuffer()), id=3+i*3;
    obj(id,()=>push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${id+2} 0 R >> >> /Contents ${id+1} 0 R >>`));
    const cs=`q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    obj(id+1,()=>push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(id+2,()=>{ push(`<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push("\nendstream"); });
  }
  const total=3+N*3, xref=len;
  let x=`xref\n0 ${total}\n0000000000 65535 f \n`; for(let n=1;n<total;n++) x+=String(offs[n]).padStart(10,"0")+" 00000 n \n";
  push(x+`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts,{type:"application/pdf"});
}
/* ----- Enregistrer une conversation en PDF (créé sur l'appareil, rien n'est envoyé) ----- */
const HELV=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const WIN={"€":128,"‚":130,"„":132,"…":133,"‰":137,"Š":138,"‹":139,"Œ":140,"Ž":142,"‘":145,"’":146,"“":147,"”":148,"•":149,"–":150,"—":151,"™":153,"š":154,"›":155,"œ":156,"ž":158,"Ÿ":159};
// texte → caractères de l'encodage WinAnsi (les émojis sont retirés)
function winText(t){ let o="";
  for(const ch of String(t||"").replace(/[   ]/g," ").replace(/\r/g,"")){ const c=ch.codePointAt(0);
    if(c===10||(c>=32&&c<127)||(c>=160&&c<256)) o+=ch; else if(WIN[ch]) o+=String.fromCharCode(WIN[ch]); else if(c>=0x1F000||(c>=0x2600&&c<0x2800)||c===0xFE0F) continue; else o+="?"; }
  return o.replace(/ {2,}/g," "); }
function chW(c,bold){ const k=c.charCodeAt(0); let w=k>=32&&k<127?HELV[k-32]:k>=192?HELV[c.normalize("NFD").charCodeAt(0)-32]||556:556; return bold?w*1.06:w; }
const textW=(t,size,bold)=>[...t].reduce((s,c)=>s+chW(c,bold),0)*size/1000;
function wrapText(t,size,width,bold){ const out=[];
  for(const para of winText(t).split("\n")){ let line="";
    for(const word of para.split(" ")){ const cand=line?line+" "+word:word;
      if(textW(cand,size,bold)<=width){ line=cand; continue; }
      if(line) out.push(line);
      let w=word; while(textW(w,size,bold)>width){ let i=w.length; while(i>1&&textW(w.slice(0,i),size,bold)>width) i--; out.push(w.slice(0,i)); w=w.slice(i); }
      line=w; }
    out.push(line); }
  return out; }
const pdfStr = t => "("+t.replace(/[\\()]/g,m=>"\\"+m)+")";
async function imageForPdf(url){
  const img=await new Promise((ok,ko)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=ko; i.src=url; });
  const k=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement("canvas");
  c.width=Math.round(img.naturalWidth*k); c.height=Math.round(img.naturalHeight*k);
  const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(img,0,0,c.width,c.height);
  const blob=await new Promise(ok=>c.toBlob(ok,"image/jpeg",0.82));
  return {w:c.width,h:c.height,data:new Uint8Array(await blob.arrayBuffer())};
}
async function conversationPdf(r, who){
  const W=595.28, H=841.89, M=50, CW=W-2*M, pages=[], imgs=[];
  let ops=[], y=0;
  const RED="0.439 0.149 0.161", GOLD="0.624 0.510 0.282", GREY="0.43 0.37 0.36", INK="0.17 0.11 0.11";
  const newPage=()=>{ ops=[]; pages.push(ops); y=H-M; };
  const need=h=>{ if(y-h<M+24) newPage(); };
  const text=(t,x,size,{bold=false,color=INK}={})=>ops.push(`BT /${bold?"F2":"F1"} ${size} Tf ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfStr(t)} Tj ET`);
  const para=(t,{size=10.5,bold=false,color=INK,indent=0,gap=3}={})=>{ for(const l of wrapText(t,size,CW-indent,bold)){ need(size+gap); y-=size+gap; text(l,M+indent,size,{bold,color}); } };
  const rule=()=>{ need(14); y-=8; ops.push(`0.85 0.80 0.76 RG 0.6 w ${M} ${y.toFixed(2)} m ${W-M} ${y.toFixed(2)} l S`); y-=6; };
  newPage();
  y-=12; text("CENTRE MÉDICAL",M,12,{bold:true,color:RED}); y-=15; text("PRINCE DE LIÈGE",M,12,{bold:true,color:GOLD});
  y-=13; text(winText("21-23 rue du Potaerdenberg, 1070 Anderlecht · 02 781 18 75"),M,8.5,{color:GREY});
  y-=10; rule(); y-=6;
  para(TYPES[r.type]?.title||"Conversation",{size:15,bold:true,gap:6});
  para(`Patient : ${who.name}${who.birth?` · né(e) le ${who.birth}`:""}`,{size:10,color:GREY});
  para(`Avec : ${reqWho(r)} · Commencée le ${fmtDate(r.created_at)}${r.closed_at?` · Clôturée le ${fmtDate(r.closed_at)}`:""}`,{size:10,color:GREY});
  para(`Document enregistré le ${new Date().toLocaleString("fr-BE")}`,{size:10,color:GREY});
  const ans=Object.entries(r.answers||{}).filter(([k,v])=>!HIDDEN_KEYS.has(k)&&v);
  if(ans.length&&r.type!=="centre"){ rule(); para("Votre demande",{size:11.5,bold:true,gap:5});
    for(const [k,v] of ans) para(`${LABELS[k]||k} : ${v}`,{indent:8}); }
  if(r.type==="prescription"&&(r.request_items||[]).some(i=>i.decision)){ para("Décision",{size:11.5,bold:true,gap:8});
    for(const i of r.request_items) para(`${i.label} (${qtyText(i.quantity||1).replace(/^ · /,"")}) : ${i.decision==="accorde"?"prescrit":i.decision?"non renouvelé":"en attente"}`,{indent:8}); }
  rule(); para("Messages",{size:11.5,bold:true,gap:5});
  for(const m of msgsOf(r)){
    const atts=m.attachments||[], from=m.from_patient?"Vous":(m.author_label||"Le centre");
    need(40); y-=8; para(`${from} · ${new Date(m.created_at).toLocaleDateString("fr-BE")} ${new Date(m.created_at).toLocaleTimeString("fr-BE",{hour:"2-digit",minute:"2-digit"})}`,{size:9.5,bold:true,color:m.from_patient?GOLD:RED});
    if(!(atts.length&&AUTO_BODY.test(m.body))) para(m.body,{indent:8});
    for(const a of atts){
      if(a.kind==="image"){ try{ const src=await attLoad(a.id), im=await imageForPdf(src.url), n=imgs.length;
          let w=Math.min(CW-8,300), h=w*im.h/im.w; if(h>380){ h=380; w=h*im.w/im.h; }
          need(h+8); y-=h+6; ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${M+8} ${y.toFixed(2)} cm /Im${n} Do Q`); imgs.push(im); }
        catch(e){ para("[Photo : impossible de l'ajouter]",{indent:8,color:GREY}); } }
      else if(a.kind==="pdf") para(`[Document PDF joint : ${a.name} — ouvrez-le dans l'application pour l'enregistrer séparément]`,{indent:8,color:GREY,size:9.5});
      else para(`[Message vocal${a.duration_s?` (${dur(a.duration_s)})`:""} — à écouter dans l'application]`,{indent:8,color:GREY,size:9.5});
    }
  }
  if(!msgsOf(r).length) para("Aucun message.",{color:GREY});
  // assemblage du fichier
  const N=pages.length, parts=[], offs=[]; let len=0;
  const bytes=s=>{ const u=new Uint8Array(s.length); for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i)&255; return u; };
  const push=x=>{ const b=typeof x==="string"?bytes(x):x; parts.push(b); len+=b.length; };
  const obj=(n,body)=>{ offs[n]=len; push(`${n} 0 obj\n`); body(); push("\nendobj\n"); };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const P0=5, I0=P0+N*2, total=I0+imgs.length;
  obj(1,()=>push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2,()=>push(`<< /Type /Pages /Kids [${pages.map((_,i)=>`${P0+i*2} 0 R`).join(" ")}] /Count ${N} >>`));
  obj(3,()=>push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  obj(4,()=>push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));
  const xo=imgs.map((_,i)=>`/Im${i} ${I0+i} 0 R`).join(" ");
  pages.forEach((o,i)=>{
    y=M-4; const foot=[...o]; ops=foot;
    text(winText(`Document confidentiel (données de santé) · Page ${i+1}/${N}`),M,8,{color:GREY});
    const cs=foot.join("\n");
    obj(P0+i*2,()=>push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xo?` /XObject << ${xo} >>`:""} >> /Contents ${P0+i*2+1} 0 R >>`));
    obj(P0+i*2+1,()=>push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
  });
  imgs.forEach((im,i)=>obj(I0+i,()=>{ push(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`); push(im.data); push("\nendstream"); }));
  const xref=len; let x=`xref\n0 ${total}\n0000000000 65535 f \n`; for(let n=1;n<total;n++) x+=String(offs[n]).padStart(10,"0")+" 00000 n \n";
  push(x+`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts,{type:"application/pdf"});
}
// Sur téléphone : feuille de partage (Enregistrer dans Fichiers, etc.) ; sur ordinateur : téléchargement
async function nativePreview(blob,name){ const data=await blobToB64(blob); await SEC().preview({data,name:name||"document.pdf"}); }
async function saveFile(blob,name){
  if(IS_NATIVE&&SEC()){ try{ await nativePreview(blob,name); return; }catch(e){ console.error(e); } }
  const file=new File([blob],name,{type:blob.type});
  if(matchMedia("(pointer:coarse)").matches&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file],title:name}); return; } catch(e){ if(e.name==="AbortError") return; } }
  const url=URL.createObjectURL(blob), a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function bindSavePdf(r){
  const b=$("#savepdf"); if(!b) return; let ready=null;
  b.onclick=async()=>{
    if(ready){ await saveFile(ready.blob,ready.name); return; }
    b.disabled=true; b.textContent="Préparation du PDF…";
    try{ const c=childInfo(r.child_id);
      const who=c?{name:`${c.first_name} ${c.last_name}`,birth:fmtDate(c.birth_date)}:{name:`${S.me.first_name||""} ${S.me.last_name||""}`.trim(),birth:S.me.birth_date?fmtDate(S.me.birth_date):""};
      const blob=await conversationPdf(r,who);
      ready={blob,name:`conversation-cmpl-${new Date(r.created_at).toISOString().slice(0,10)}-${r.id}.pdf`};
      b.textContent="Enregistrer le PDF"; b.classList.remove("ghost"); }
    catch(e){ console.error(e); toast("Le PDF n'a pas pu être créé. Réessayez."); b.textContent="Enregistrer la conversation (PDF)"; }
    b.disabled=false;
  };
}
function openScanner(done){
  const pages=[]; let enhance=true;
  const v=document.createElement("div"); v.className="scanner"; v.setAttribute("role","dialog"); v.setAttribute("aria-label","Scanner un document");
  const close=()=>{ pages.forEach(p=>URL.revokeObjectURL(p.thumb)); v.remove(); };
  const paint=()=>{
    v.innerHTML=`<div class="scanbox"><div class="scanhead"><h2>Scanner un document</h2><button type="button" class="cbtn" id="sc-x" aria-label="Fermer">✕</button></div>
     <p class="hint" style="margin:0">Posez le document à plat, bien éclairé, et photographiez chaque page. Elles seront réunies en un seul PDF.</p>
     <div class="scanpages">${pages.map((p,i)=>`<div class="scanpage"><img src="${p.thumb}" alt="Page ${i+1}"><span>${i+1}</span><button type="button" data-sdel="${i}" aria-label="Retirer la page ${i+1}">✕</button></div>`).join("")}
      ${pages.length<10?`<button type="button" class="scanadd" id="sc-add">${IC.scan}<b>${pages.length?"Ajouter une page":"Photographier la 1re page"}</b></button>`:""}</div>
     <input type="file" id="sc-file" accept="image/*" capture="environment" hidden>
     <label class="chk2"><input type="checkbox" id="sc-enh" ${enhance?"checked":""}> Améliorer la lisibilité (noir et blanc)</label>
     <div class="btnrow"><button type="button" class="btn" id="sc-ok" ${pages.length?"":"disabled"}>Créer le PDF${pages.length?` (${pages.length} page${pages.length>1?"s":""})`:""}</button><button type="button" class="btn ghost" id="sc-no">Annuler</button></div></div>`;
    v.querySelector("#sc-x").onclick=close; v.querySelector("#sc-no").onclick=close;
    v.querySelector("#sc-enh").onchange=e=>{ enhance=e.target.checked; };
    const add=v.querySelector("#sc-add"), inp=v.querySelector("#sc-file"); if(add) add.onclick=()=>inp.click();
    inp.onchange=async()=>{ const f=inp.files[0]; inp.value=""; if(!f) return; add&&(add.disabled=true);
      try{ pages.push(await scanPage(f,enhance)); }catch(e){ toast("Cette photo n'a pas pu être lue. Réessayez."); } paint(); };
    v.querySelectorAll("[data-sdel]").forEach(b=>b.onclick=()=>{ const p=pages.splice(+b.dataset.sdel,1)[0]; URL.revokeObjectURL(p.thumb); paint(); });
    v.querySelector("#sc-ok").onclick=async e=>{ e.target.disabled=true; e.target.textContent="Création du PDF…";
      try{ const blob=await makePdf(pages);
        if(blob.size>5*1048576) throw new Error("Le PDF dépasse 5 Mo : retirez une page ou décochez l'amélioration.");
        const name=`scan-${new Date().toISOString().slice(0,10)}.pdf`, n=pages.length; close();
        done({kind:"pdf",mime:"application/pdf",name,blob,pages:n}); }
      catch(err){ toast(err.message||"Le PDF n'a pas pu être créé."); paint(); } };
  };
  paint(); document.body.appendChild(v); v.querySelector("#sc-add")?.focus();
}
const blobToB64 = b => new Promise((ok,ko)=>{ const fr=new FileReader(); fr.onload=()=>ok(String(fr.result).split(",")[1]||""); fr.onerror=ko; fr.readAsDataURL(b); });
async function uploadAtt(reqId, pend, caption){
  toast(pend.kind==="audio"?"Envoi du message vocal…":"Envoi en cours…");
  const data=await blobToB64(pend.blob);
  return run(()=>sb.rpc("send_attachment",{p_request:reqId,p_mime:pend.mime,p_name:pend.name,p_data:data,p_caption:caption||null,p_duration:pend.duration||null}),"Envoyé");
}
// Message vocal : un appui pour commencer, un appui pour envoyer (ou la corbeille pour annuler)
let REC=null;
// Format choisi pour être lisible partout : AAC (mp4) d'abord, sinon Opus (webm/ogg)
function recType(){
  const ok=t=>{ try{ return MediaRecorder.isTypeSupported(t); }catch(e){ return false; } };
  const safari=/^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
  const list=["audio/mp4;codecs=mp4a.40.2", ...(safari?["audio/mp4"]:[]), "audio/webm;codecs=opus","audio/ogg;codecs=opus","audio/webm","audio/mp4"];
  for(const t of list) if(ok(t)) return t; return "";
}
function stopRec(){ if(!REC) return; try{ REC.mr.onstop=null; if(REC.mr.state!=="inactive") REC.mr.stop(); }catch(e){} REC.stream.getTracks().forEach(t=>t.stop()); clearInterval(REC.tick); try{ REC.ac&&REC.ac.close(); }catch(e){} REC=null; S.rec=false; }
async function startRec(key, send){
  let stream; try{ stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}); }
  catch(e){ return toast("Le micro n'est pas autorisé. Autorisez-le dans les réglages du navigateur."); }
  const type=recType(); let mr;
  try{ mr=new MediaRecorder(stream, type?{mimeType:type,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000}); }
  catch(e){ try{ mr=new MediaRecorder(stream); }catch(e2){ stream.getTracks().forEach(t=>t.stop()); return toast("L'enregistrement vocal n'est pas disponible sur cet appareil."); } }
  // Niveau du micro : montre que le son est bien capté, et évite d'envoyer un message muet
  let ac=null, an=null, buf=null, peak=0;
  try{ ac=new (window.AudioContext||window.webkitAudioContext)(); if(ac.state==="suspended") await ac.resume();
    an=ac.createAnalyser(); an.fftSize=512; ac.createMediaStreamSource(stream).connect(an); buf=new Uint8Array(an.fftSize); }catch(e){ ac=null; }
  const chunks=[], t0=Date.now(); mr.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
  REC={mr,stream,tick:null,ac}; S.rec=true;
  $("#cbrow").hidden=true; $("#recbar").hidden=false; const at=$("#chatbar .attprev"); if(at) at.hidden=true;
  let ms=0, secs=0;
  const finish=doSend=>{ if(!REC||REC.mr!==mr) return; clearInterval(REC.tick); ms=Date.now()-t0; secs=Math.max(1,Math.round(ms/1000));
    mr.onstop=async()=>{ stream.getTracks().forEach(t=>t.stop()); const measured=!!(ac&&ac.state==="running"); try{ ac&&ac.close(); }catch(e){} REC=null; S.rec=false;
      if(!doSend) return render();
      if(!chunks.length) await new Promise(r=>setTimeout(r,400));   // Safari : le dernier morceau arrive parfois après « stop »
      if(!chunks.length){ toast("L'enregistrement n'a pas fonctionné sur cet appareil. Réessayez, ou écrivez votre message."); return render(); }
      if(ms<800){ toast("Message vocal trop court : touchez le micro une fois, parlez, puis touchez ➤ pour envoyer."); return render(); }
      if(measured&&peak<0.02){ toast("Aucun son n'a été capté. Vérifiez que le micro est autorisé et non coupé, puis réessayez."); return render(); }
      const mime=((mr.mimeType||type||"audio/webm").split(";")[0]).replace("audio/x-m4a","audio/mp4").replace("audio/aac","audio/mp4");
      const ok=await send($("#c-text")?.value.trim()||"", {key,kind:"audio",mime,name:"Message vocal",blob:new Blob(chunks,{type:mime}),duration:secs});
      if(!ok) render(); };
    mr.stop(); };
  REC.tick=setInterval(()=>{ const s=Math.floor((Date.now()-t0)/1000), el=$("#r-time"); if(el) el.textContent=dur(s);
    if(an){ an.getByteTimeDomainData(buf); let m=0; for(const v of buf){ const d=Math.abs(v-128)/128; if(d>m) m=d; } peak=Math.max(peak,m);
      const lv=$("#r-lvl"); if(lv) lv.style.transform=`scaleX(${Math.min(1,0.08+m*2.5)})`; }
    if(s>=180) finish(true); },100);
  $("#r-cancel").onclick=()=>finish(false);
  $("#r-send").onclick=()=>finish(true);
  mr.start(1000);   // un morceau chaque seconde : rien n'est perdu, même sur iPhone
}
const patientName = id => { const p=S.profiles[id]; return p ? `${p.first_name||""} ${p.last_name||""}`.trim() || "Patient" : "Patient"; };
function extraContactsHTML(p){ const L=(p&&p.extra_contacts)||[]; if(!L.length&&!(p&&p.contact_note)) return "";
  return `<div class="xcontacts">${L.map(c=>`<span>${c.type==="personne"?`${esc(c.lien||"Contact")} : <b>${esc(c.nom||"")}</b>`:"Autre n°"} · <b>${esc(c.tel||"")}</b></span>`).join("")}${p.contact_note?`<span class="xnote">ℹ︎ ${esc(p.contact_note)}</span>`:""}</div>`; }
const kidName = id => { const c=S.children?.[id]; return c ? `${c.first_name} ${c.last_name}` : "Enfant"; };
const reqName = r => r.child_id ? kidName(r.child_id) : patientName(r.patient_id);

/* ---------- actualités ---------- */
function newsCard(n, full, inline){
  // inline : affichée telle quelle dans une page (écran de connexion…) : l'affiche reste dans un cadre, agrandie au toucher
  if(n.image_path&&!(n.body||"").trim()&&inline)
    return `<article class="news poster ${n.pinned?"pinned":""}"><div class="pimg" data-zoom="${esc(n.image_path)}" role="button" tabindex="0" aria-label="Agrandir l'affiche"><img src="${esc(n.image_path)}" alt="${esc(n.title)}"></div><button type="button" class="linkbtn zoomhint" data-zoom="${esc(n.image_path)}"><span aria-hidden="true">🔍 </span>Agrandir l'affiche</button><div class="nbody"><div class="nmeta"><span class="ncat">${esc(n.category)}</span>${n.pinned?'<span class="ncat pin">Épinglé</span>':""}<span>${fmt(n.published_at)}</span></div><h3 translate="no" dir="auto">${esc(n.title)}</h3></div></article>`;
  if(n.image_path&&!(n.body||"").trim())   // annonce « affiche » : l'image seule, affichée en entier
    return `<article class="news poster ${full?"full":""} ${n.pinned?"pinned":""}"><div class="pimg" ${full?`data-zoom="${esc(n.image_path)}" role="button" tabindex="0" aria-label="Agrandir l'affiche"`:""}><img src="${esc(n.image_path)}" alt="${esc(n.title)}"></div>${full?`<button type="button" class="linkbtn zoomhint" data-zoom="${esc(n.image_path)}"><span aria-hidden="true">🔍 </span>Agrandir l'affiche</button>`:""}<div class="nbody"><div class="nmeta"><span class="ncat">${esc(n.category)}</span>${n.pinned?'<span class="ncat pin">Épinglé</span>':""}<span>${fmt(n.published_at)}</span></div><h3 translate="no" dir="auto">${esc(n.title)}</h3></div></article>`;
  return `<article class="news ${n.pinned?"pinned":""}">${n.image_path?`<img src="${esc(n.image_path)}" alt="" ${full?`data-zoom="${esc(n.image_path)}" style="cursor:zoom-in"`:""}>`:""}<div class="nbody"><div class="nmeta"><span class="ncat">${esc(n.category)}</span>${n.pinned?'<span class="ncat pin">Épinglé</span>':""}<span>${fmt(n.published_at)}</span></div><h3 translate="no" dir="auto">${esc(n.title)}</h3><p translate="no" dir="auto" class="${full?"":"clamp"}">${esc(n.body)}</p></div></article>`;
}

/* =====================================================================
   CHARGEMENT DES DONNÉES
   ===================================================================== */
async function loadPublic(){
  const [pr, oh, nw] = await Promise.all([
    sb.from("providers").select("*").order("sort_order"),
    sb.from("opening_hours").select("dow,opens,closes"),
    sb.from("announcements").select("*").order("published_at",{ascending:false}).limit(30)
  ]);
  S.providers = pr.data || [];
  S.hours = {};
  for (const h of (oh.data||[])) { const m=t=>{const [a,b]=t.split(":");return +a*60+ +b}; S.hours[h.dow%7]=[m(h.opens),m(h.closes)]; }
  const now = new Date();
  S.news = (nw.data||[]).filter(n => !n.expires_at || new Date(n.expires_at) > now);
}
async function loadMe(){
  if(!S.session){ S.me=null; return; }
  const { data } = await sb.from("profiles").select("*").eq("id", S.session.user.id).maybeSingle();
  S.me = data;
}
const REQ_BASE = "*, messages(id,from_patient,author_id,author_label,body,created_at,attachments(id,kind,mime,name,size,duration_s)), request_items(id,label,decision,quantity)";
let REQ_SELECT = REQ_BASE+", request_updates(id,kind,label,created_at)";
// (si la migration 044 n'est pas encore passée, on charge sans le suivi « vue / transmise »)
async function reqQuery(build){ let r=await build(REQ_SELECT);
  if(r.error&&REQ_SELECT!==REQ_BASE&&/request_updates/i.test(JSON.stringify(r.error))){ REQ_SELECT=REQ_BASE; r=await build(REQ_SELECT); } return r; }
async function loadPatient(){
  const uid=S.session.user.id;
  const [rq, md, nt] = await Promise.all([
    reqQuery(sel=>sb.from("requests").select(sel).order("created_at",{ascending:false}).limit(150)),
    sb.from("patient_meds").select("*").order("last_granted_at",{ascending:false}),
    sb.from("notifications").select("*").eq("user_id", uid).order("created_at",{ascending:false}).limit(50)
  ]);
  S.reqs = rq.data||[]; S.meds = md.data||[]; S.notifs = nt.data||[];
  try{ const ab=await sb.rpc("provider_absences"); S.absences=ab.error?[]:(ab.data||[]); }catch(e){ S.absences=[]; }
  loadPhotos();
  if(S.me.status==="active"){ const f=await sb.rpc("my_family"); S.family=f.error?null:f.data; }
  await Promise.all([loadProviderAvatars(), loadAvatars([uid, ...S.reqs.flatMap(r=>(r.messages||[]).filter(m=>!m.from_patient).map(m=>m.author_id))])]);
}
async function loadStaff(){
  const role=S.me.role;
  const rq = await reqQuery(sel=>sb.from("requests").select(sel).order("created_at",{ascending:false}).limit(500));
  S.reqs = rq.data||[];
  const ids=[...new Set(S.reqs.map(r=>r.patient_id))];
  const tasks=[];
  if(ids.length) tasks.push(sb.from("profiles").select("id,first_name,last_name,birth_date,phone,extra_contacts,contact_note").in("id",ids).then(r=>{ for(const p of r.data||[]) S.profiles[p.id]=p; }));
  if(isAdminP(S.me)) tasks.push(sb.from("profiles").select("id,first_name,last_name,birth_date,phone,created_at").eq("role","patient").eq("status","pending").order("created_at").then(r=>S.pending=r.data||[]));
  tasks.push(sb.from("profiles").select("id,first_name,last_name,role,provider_id,status,created_at,is_admin").neq("role","patient").then(r=>S.team=r.data||[]));
  tasks.push(sb.from("motif_durations").select("motif,minutes").then(r=>{ S.durations=Object.fromEntries((r.data||[]).map(d=>[d.motif,d.minutes])); }));
  tasks.push(sb.from("staff_settings").select("*").eq("user_id",S.me.id).maybeSingle().then(r=>S.settings=r.data));
  if(role==="secretariat"||role==="admin"||role==="gestion") tasks.push(sb.from("announcements").select("*").order("published_at",{ascending:false}).limit(100).then(r=>S.allNews=r.data||[]));
  if(role==="secretariat"||role==="admin"||role==="gestion") tasks.push(sb.rpc("news_audience").then(r=>S.audience=r.data));
  if(isAdminP(S.me)) tasks.push(sb.from("children").select("id,first_name,last_name,birth_date,status,created_by,created_at").eq("status","pending").is("removed_at",null).order("created_at").then(r=>S.pendingKids=r.data||[]));
  tasks.push(loadTasks());
  if(isAdminP(S.me)) tasks.push(loadPhotos());
  tasks.push(loadInventory());
  tasks.push(sb.from("patient_records").select("*").order("last_name").then(r=>S.records=r.error?[]:(r.data||[])));
  tasks.push(sb.from("request_notes").select("*").order("created_at").then(r=>S.notes=r.error?[]:(r.data||[])));
  tasks.push(loadLeaves());
  tasks.push(loadTeam());
  if(S.waitlist!==undefined||S.cscreen==="waitlist") tasks.push(loadWaitlist());
  await Promise.all(tasks);
  // enfants (demandes, tâches) et parents à afficher
  const kidIds=[...new Set([...S.reqs.map(r=>r.child_id),...(S.tasks||[]).map(t=>t.child_id)].filter(Boolean))].filter(id=>!S.children[id]);
  if(kidIds.length){ const {data}=await sb.from("children").select("id,first_name,last_name,birth_date,status,created_by").in("id",kidIds); for(const c of data||[]) S.children[c.id]=c; }
  const more=[...new Set([...(S.pendingKids||[]).map(c=>c.created_by),...(S.tasks||[]).map(t=>t.patient_id)].filter(Boolean))].filter(id=>!S.profiles[id]);
  if(more.length){ const {data}=await sb.from("profiles").select("id,first_name,last_name,birth_date,phone").in("id",more); for(const p of data||[]) S.profiles[p.id]=p; }
  await Promise.all([loadProviderAvatars(), loadAvatars([S.me.id, ...ids, ...S.team.map(t=>t.id)])]);
  // Le premier onglet utile selon le rôle
  if(role==="provider") S.tab="prestataires";
  if(role==="gestion") S.tab="administration";
}
async function refresh(){
  await loadPublic();
  if(!S.session){ S.me=null; render(); return; }
  await loadMe();
  if(!S.me){ render(); return; }
  syncLang(); syncTextSize();
  S.mfa=null;
  if(S.me.status==="active"&&S.me.role!=="patient"){
    if(idleTooLong()){ await logout(idleMsg()); return; }
    const {data:aal}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if(!aal||aal.currentLevel!=="aal2"){ lockDone=true; S.mfa={hasFactor:aal&&aal.nextLevel==="aal2"}; render(); return; }
    markActive();
    if(!lockDone){ lockDone=true; setTimeout(lockApp,0); }   // app rouverte avec une session encore valide : Face ID d'abord
  }
  if(S.me.status==="active"){ if(S.me.role==="patient") await loadPatient(); else await loadStaff(); }
  render();
  if(S.me.status==="active") startRealtime();
  if(IS_NATIVE&&S.me.status==="active"&&!pushSynced){ pushSynced=true; nativePushInit().then(()=>{ if(nativePush!=="unsupported") render(); }); }
  else if(S.me.status==="active"&&!pushSynced&&pushState()==="granted"){ pushSynced=true; pushSubscribe().catch(()=>{ pushSynced=false; }); }
}

// L'équipe travaille toujours en français ; le patient retrouve sa langue sur tous ses appareils
/* ---------- taille du texte (Normal / Grand / Très grand) ---------- */
const TEXT_SIZES={normal:["Normal",1],grand:["Grand",1.15],tres_grand:["Très grand",1.3]};
function applyTextSize(v){ const z=(TEXT_SIZES[v]||TEXT_SIZES.normal)[1]; document.body.style.zoom=z===1?"":String(z);
  try{ localStorage.setItem("cmpl_ts",TEXT_SIZES[v]?v:"normal"); }catch(e){} }
try{ const t=localStorage.getItem("cmpl_ts"); if(t&&TEXT_SIZES[t]) applyTextSize(t); }catch(e){}
function syncTextSize(){ if(S.me&&S.me.text_size&&TEXT_SIZES[S.me.text_size]) applyTextSize(S.me.text_size); }
const textSizeHTML = () => `<section class="card tscard"><h3>Taille du texte</h3><p class="hint">Pour lire plus facilement. Le choix suit votre compte sur tous vos appareils.</p>
  <div class="seg tsseg" role="group" aria-label="Taille du texte">${Object.entries(TEXT_SIZES).map(([k,[l]],i)=>`<button type="button" data-ts="${k}" aria-pressed="${(S.me.text_size||"normal")===k}"><span style="font-size:${14+i*3}px">A</span> ${l}</button>`).join("")}</div></section>`;
function bindTextSize(){ $$("[data-ts]").forEach(b=>b.onclick=async()=>{ const v=b.dataset.ts; const old=S.me.text_size||"normal"; if(v===old) return;
  S.me.text_size=v; applyTextSize(v); render();
  const {error}=await sb.from("profiles").update({text_size:v}).eq("id",S.me.id); if(error){ console.error(error); } }); }
function syncLang(){
  if(S.me.role!=="patient"){ if(L!=="fr") applyLang("fr"); return; }
  const saved=savedLang();
  if(!saved&&S.me.lang&&LANGS[S.me.lang]&&S.me.lang!==L){ try{ localStorage.setItem("cmpl_lang",S.me.lang); }catch(e){} applyLang(S.me.lang); }
  else if(S.me.lang!==L&&(saved||!S.me.lang)){ const l=L; S.me.lang=l; sb.from("profiles").update({lang:l}).eq("id",S.me.id).then(()=>{}); }
}
/* ---------- équipe : déconnexion après une période d'inactivité ----------
   Ordinateur (souvent partagé, à l'accueil) : 30 minutes.
   Téléphone ou tablette (personnel, protégé par son propre verrouillage) : 8 heures. */
const ON_PHONE=matchMedia("(pointer:coarse)").matches;
// Ordinateur de confiance (poste du centre) : 2 heures
// App iPhone avec Face ID : pas de déconnexion (Face ID est demandé à chaque retour après 5 minutes)
const bioKeep = () => IS_NATIVE&&faceIdOn();
const idleMs = () => bioKeep()?30*24*3600*1000:(ON_PHONE?8*60:trustGet()?120:30)*60*1000;
const idleMsg = () => `Vous avez été déconnecté après ${bioKeep()?"30 jours":ON_PHONE?"8 heures":trustGet()?"2 heures":"30 minutes"} d'inactivité.`;
function markActive(){ try{ localStorage.setItem("cmpl_last_active", String(Date.now())); }catch(e){} }
function idleTooLong(){ try{ const t=+localStorage.getItem("cmpl_last_active"); return t>0 && Date.now()-t>idleMs(); }catch(e){ return false; } }
let lastAct=Date.now(), lastSaved=0;
["pointerdown","keydown","touchstart","scroll"].forEach(ev=>addEventListener(ev,()=>{ lastAct=Date.now(); if(lastAct-lastSaved>60000){ lastSaved=lastAct; markActive(); } },{passive:true}));
setInterval(()=>{ if(S.me&&S.me.role!=="patient"&&S.session&&Date.now()-lastAct>idleMs()) logout(idleMsg()); },60000);

/* ---------- équipe : double authentification ---------- */
/* ---------- Face ID (app iPhone) : remplace l'application d'authentification ----------
   Le secret de double authentification est rangé dans le trousseau de l'iPhone, protégé par Face ID.
   Après Face ID, l'app calcule elle-même le code à 6 chiffres. */
const SEC = () => IS_NATIVE ? CAP().CMPLSecure : null;
let BIO=null;
async function bioInfo(){ if(BIO) return BIO; const sec=SEC(); if(!sec) return BIO={available:false,type:"none"};
  try{ BIO=await sec.available(); }catch(e){ BIO={available:false,type:"none"}; } return BIO; }
const bioName = () => BIO&&BIO.type==="touchid"?"Touch ID":BIO&&BIO.type==="biometric"?"l'empreinte digitale":IS_ANDROID?"l'empreinte digitale":"Face ID";
const BioName = () => { const n=bioName(); return n.charAt(0).toUpperCase()+n.slice(1); };   // en début de phrase
const bioE = () => /empreinte/.test(bioName())?"e":"";   // « activée » (l'empreinte) / « activé » (Face ID)
const fidKey = () => "cmpl_faceid_"+(S.session?.user?.id||"");
const faceIdOn = () => { try{ return !!localStorage.getItem(fidKey()); }catch(e){ return false; } };
function b32decode(str){ const A="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits="", out=[];
  for(const ch of str.replace(/=+$/,"").replace(/\s/g,"").toUpperCase()){ const v=A.indexOf(ch); if(v<0) continue; bits+=v.toString(2).padStart(5,"0"); }
  for(let i=0;i+8<=bits.length;i+=8) out.push(parseInt(bits.slice(i,i+8),2)); return new Uint8Array(out); }
async function totpCode(secret, t=Date.now()){
  const ctr=Math.floor(t/1000/30), msg=new Uint8Array(8); let c=ctr; for(let i=7;i>=0;i--){ msg[i]=c&255; c=Math.floor(c/256); }
  const key=await crypto.subtle.importKey("raw",b32decode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const h=new Uint8Array(await crypto.subtle.sign("HMAC",key,msg)), o=h[h.length-1]&15;
  const n=((h[o]&127)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3]; return String(n%1000000).padStart(6,"0"); }
async function faceIdSetup(){
  const {data:lf}=await sb.auth.mfa.listFactors();
  for(const f of (lf?.all||[])) if(f.status!=="verified") await sb.auth.mfa.unenroll({factorId:f.id}).catch(()=>{});
  const {data,error}=await sb.auth.mfa.enroll({factorType:"totp",issuer:"Centre Médical Prince de Liège",friendlyName:(IS_ANDROID?"Empreinte Android ":bioName()+" iPhone ")+new Date().toISOString().slice(0,19)+" "+Math.random().toString(36).slice(2,6)});
  if(error) throw error;
  const v=await sb.auth.mfa.challengeAndVerify({factorId:data.id,code:await totpCode(data.totp.secret)});
  if(v.error){ await sb.auth.mfa.unenroll({factorId:data.id}).catch(()=>{}); throw v.error; }
  await SEC().save({key:fidKey(),value:JSON.stringify({f:data.id,s:data.totp.secret})});
  try{ localStorage.setItem(fidKey(),data.id); }catch(e){}
}
async function faceIdSecret(){ const r=await SEC().load({key:fidKey(),reason:"Connexion au Centre Médical Prince de Liège"}); return JSON.parse(r.value); }
async function faceIdLogin(){ const {f,s:sec}=await faceIdSecret(); const v=await sb.auth.mfa.challengeAndVerify({factorId:f,code:await totpCode(sec)}); if(v.error) throw v.error; }
async function faceIdForget(unenroll){ const f=(()=>{ try{ return localStorage.getItem(fidKey()); }catch(e){ return null; } })();
  if(unenroll&&f) await sb.auth.mfa.unenroll({factorId:f}).catch(()=>{});
  try{ await SEC().remove({key:fidKey()}); }catch(e){} try{ localStorage.removeItem(fidKey()); }catch(e){} }
/* ---------- diagnostic temporaire de mise en page (app iPhone) ----------
   Si la page devient plus large que l'écran ou zoomée, un bouton rouge « Diag » apparaît ;
   une capture de son contenu permet de trouver l'élément en cause. */
function layoutDiag(){
  const W=document.documentElement.clientWidth, vv=window.visualViewport, out=[];
  document.querySelectorAll("#app *").forEach(e=>{ const r=e.getBoundingClientRect(); if(r.width&&(r.right>W+1||r.left<-1)) out.push(`${e.tagName.toLowerCase()}${e.id?"#"+e.id:""}${e.className&&typeof e.className==="string"?"."+e.className.split(" ").slice(0,2).join("."):""}  L${Math.round(r.left)} R${Math.round(r.right)} W${Math.round(r.width)}`); });
  return {bad:out.length>0||document.documentElement.scrollWidth>W+1||(vv&&Math.abs(vv.scale-1)>0.02)||window.scrollX>0,
    text:`Version ${APP_VERSION}\nécran ${screen.width}×${screen.height} · dpr ${devicePixelRatio}\ninnerWidth ${innerWidth} · clientWidth ${W} · scrollWidth ${document.documentElement.scrollWidth} · scrollX ${Math.round(scrollX)}\nvisualViewport ${vv?`${Math.round(vv.width)} · zoom ${vv.scale.toFixed(2)} · décalage ${Math.round(vv.offsetLeft)}`:"—"}\nviewport: ${document.querySelector("meta[name=viewport]")?.content}\nécran affiché: ${S.cscreen||S.screen} · zoom texte ${document.body.style.zoom||"1"}\n\nÉléments qui dépassent (${out.length}) :\n${out.slice(0,20).join("\n")||"aucun"}`};
}
setTimeout(()=>{ if(IS_NATIVE) setInterval(()=>{ if(!S.me) return; const d=layoutDiag(); let b=$("#diagbtn");
  if(d.bad&&!b){ document.body.insertAdjacentHTML("beforeend",`<button id="diagbtn" type="button">Diag</button>`); b=$("#diagbtn");
    b.onclick=()=>{ const t=layoutDiag().text; document.body.insertAdjacentHTML("beforeend",`<div id="diagbox" role="dialog"><button type="button" class="btn" id="diagx">Fermer</button>\n${esc(t)}</div>`); $("#diagx").onclick=()=>$("#diagbox").remove(); }; }
  else if(!d.bad&&b&&!$("#diagbox")) b.remove(); },2000); },0);

/* ---------- app iPhone de l'équipe : verrouillage par Face ID ----------
   À l'ouverture de l'app et au retour après 5 minutes en arrière-plan, l'écran est masqué
   jusqu'à Face ID (seulement si Face ID est activé pour la connexion). */
const LOCK_MS=5*60*1000; let lockDone=false, hiddenAt=0;
const canLock = () => IS_NATIVE&&!!SEC()&&!!S.me&&S.me.role!=="patient"&&S.me.status==="active"&&faceIdOn();
async function lockApp(){
  if(!canLock()||$("#lock")) return;
  document.body.insertAdjacentHTML("beforeend",`<div id="lock" class="lock" role="dialog" aria-modal="true" aria-labelledby="lock-t"><div class="lockbox">
    <img src="logo.png" alt="" width="64" height="64"><h2 id="lock-t">App verrouillée</h2><p>Déverrouillez avec ${bioName()} pour voir les données des patients.</p>
    <button class="btn full" id="lock-go">Déverrouiller avec ${bioName()}</button><button class="btn ghost full" id="lock-out">Se déconnecter</button></div></div>`);
  app().inert=true;
  const unlock=()=>{ const l=$("#lock"); if(l) l.remove(); app().inert=false; markActive(); };
  const go=async()=>{ const b=$("#lock-go"); if(!b||b.disabled) return; b.disabled=true;
    try{ await faceIdSecret(); unlock(); }catch(e){ if(b) b.disabled=false; } };
  $("#lock-go").onclick=go;
  $("#lock-out").onclick=()=>{ unlock(); logout("Vous êtes déconnecté."); };
  go();
}
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){ hiddenAt=Date.now(); return; }
  if(hiddenAt&&Date.now()-hiddenAt>LOCK_MS) lockApp();
  hiddenAt=0;
});
function faceIdCardHTML(){
  if(!IS_NATIVE||!SEC()) return "";
  if(!BIO){ bioInfo().then(()=>{ if(S.cscreen==="settings") render(); }); return ""; }
  if(!BIO.available) return "";
  const n=bioName();
  return `<section class="card"><h3>${IS_ANDROID?"Empreinte digitale":n}</h3>${faceIdOn()?`<p class="hint">${BioName()} est activé${bioE()} sur ce téléphone : il remplace l'application d'authentification pour vous connecter.</p>
    <div class="btnrow"><button class="btn ghost" id="fid-code">Afficher un code pour l'ordinateur</button><button class="linkbtn" id="fid-off">Désactiver ${n}</button></div><div id="fid-out"></div>`
   :`<p class="hint">Connectez-vous avec ${n} au lieu de taper le code de l'application d'authentification. Ce téléphone pourra aussi vous afficher le code pour vous connecter sur un ordinateur.</p>
    <div class="btnrow"><button class="btn" id="fid-on">Activer ${n} sur ce téléphone</button></div>`}</section>`;
}
function bindFaceIdCard(){
  const on=$("#fid-on"), off=$("#fid-off"), cd=$("#fid-code");
  if(on) on.onclick=async()=>{ on.disabled=true; try{ await faceIdSetup(); toast(BioName()+" activé"+bioE()); }catch(e){ console.error(e); toast("Activation impossible : "+frError(e)); } render(); };
  if(off) off.onclick=async()=>{ off.disabled=true; await faceIdForget(true); toast(BioName()+" désactivé"+bioE()); render(); };
  if(cd) cd.onclick=async()=>{ try{ const {s:sec}=await faceIdSecret(); const show=async()=>{ const el=$("#fid-out"); if(!el) return clearInterval(tm);
      const left=30-Math.floor(Date.now()/1000)%30; el.innerHTML=`<p class="fidcode" translate="no">${(await totpCode(sec)).replace(/(\d{3})/,"$1 ")}</p><p class="hint">Valable encore ${left} s. Tapez-le sur l'ordinateur.</p>`; };
      await show(); const tm=setInterval(show,1000); setTimeout(()=>{ clearInterval(tm); const el=$("#fid-out"); if(el) el.innerHTML=""; },90000);
    }catch(e){ if(e&&e.code!=="CANCELED") toast(BioName()+" : lecture impossible. Désactivez puis réactivez "+bioName()+"."); } };
}

/* ---------- ordinateur de confiance (poste du centre) ----------
   Sur un ordinateur du centre coché « de confiance », un appareil de double authentification
   propre à cet ordinateur est créé : pendant 90 jours, e-mail + mot de passe suffisent.
   Chaque ordinateur de confiance est listé dans Mon profil et peut être retiré à tout moment
   (il est aussi effacé automatiquement par la base après 90 jours). */
const TRUST_DAYS=90, TRUST_NAME="Ordinateur de confiance";
const trustKey = () => "cmpl_trust_"+(S.session?.user?.id||"");
function trustRaw(){ try{ return JSON.parse(localStorage.getItem(trustKey())||"null"); }catch(e){ return null; } }
function trustGet(){ if(IS_NATIVE) return null; const t=trustRaw(); return t&&t.f&&t.s&&t.exp>Date.now()?t:null; }
function trustDrop(){ try{ localStorage.removeItem(trustKey()); }catch(e){} }
const isTrustFactor = f => (f.friendly_name||"").startsWith(TRUST_NAME);
async function trustSetup(){
  const d=new Date(), nm=`${TRUST_NAME} ${d.toLocaleDateString("fr-BE")} ${Math.random().toString(36).slice(2,6)}`;
  const {data,error}=await sb.auth.mfa.enroll({factorType:"totp",issuer:"Centre Médical Prince de Liège",friendlyName:nm});
  if(error) throw error;
  const v=await sb.auth.mfa.challengeAndVerify({factorId:data.id,code:await totpCode(data.totp.secret)});
  if(v.error){ await sb.auth.mfa.unenroll({factorId:data.id}).catch(()=>{}); throw v.error; }
  try{ localStorage.setItem(trustKey(),JSON.stringify({f:data.id,s:data.totp.secret,exp:Date.now()+TRUST_DAYS*864e5,name:nm})); }catch(e){}
}
// après une double authentification réussie : ancien appareil expiré à retirer, nouvelle confiance à créer
async function afterMfa(wantTrust){
  const old=trustRaw();
  if(old&&old.f&&!(old.exp>Date.now())){ await sb.auth.mfa.unenroll({factorId:old.f}).catch(()=>{}); trustDrop(); }
  if(wantTrust&&!trustGet()){ try{ await trustSetup(); toast("Cet ordinateur est maintenant de confiance pour 90 jours"); }
    catch(e){ console.error(e); toast("Ordinateur de confiance : activation impossible ("+frError(e)+")"); } }
}
async function trustedFactors(){ const {data}=await sb.auth.mfa.listFactors(); return (data?.totp||[]).filter(f=>f.status==="verified"&&isTrustFactor(f)); }
function trustCardHTML(){
  if(IS_NATIVE) return "";
  const L2=S.trustList; if(!L2&&!S.trustLoading){ S.trustLoading=true; trustedFactors().then(l=>{ S.trustList=l; }).catch(()=>{ S.trustList=[]; }).finally(()=>{ S.trustLoading=false; if(S.cscreen==="settings") render(); }); }
  const mine=trustGet(), list=L2||[];
  return `<section class="card"><h3>Ordinateurs de confiance</h3>
   <p class="hint">Sur un ordinateur de confiance (poste du centre), l'e-mail et le mot de passe suffisent pendant 90 jours, sans code de sécurité. Déconnexion après 2 heures d'inactivité. Retirez un ordinateur dès qu'il quitte le centre ou en cas de doute.</p>
   ${!L2?`<p class="hint">Chargement…</p>`:list.length?`<div class="list">${list.map(f=>`<div class="medrow"><div class="ic">${SI.out||IC.user}</div><div><b>${esc(f.friendly_name.replace(/ [a-z0-9]{4}$/,""))}</b><small>${mine&&mine.f===f.id?"Cet ordinateur · ":""}ajouté le ${fmt(f.created_at)} · ${(()=>{ const left=Math.ceil((new Date(f.created_at).getTime()+TRUST_DAYS*864e5-Date.now())/864e5); return left>0?`encore ${left} jour${left>1?"s":""}`:"expiré"; })()}</small></div><div class="acts"><button class="linkbtn" style="font-size:12px;color:var(--danger)" data-trdel="${f.id}">Retirer</button></div></div>`).join("")}</div>`
   :`<p class="hint">Aucun ordinateur de confiance.${ON_PHONE?"":" Pour en ajouter un, cochez « Faire confiance à cet ordinateur » au moment du code de sécurité."}</p>`}
   ${!mine&&!ON_PHONE&&L2?`<div class="btnrow"><button class="btn ghost" id="tr-add">Faire confiance à cet ordinateur</button></div>`:""}</section>`;
}
function bindTrustCard(){
  $$("[data-trdel]").forEach(b=>b.onclick=async()=>{ if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent="Confirmer ?"; return; }
    b.disabled=true; const {error}=await sb.auth.mfa.unenroll({factorId:b.dataset.trdel});
    if(error){ b.disabled=false; toast("Retrait impossible : "+frError(error)); return; }
    const m=trustRaw(); if(m&&m.f===b.dataset.trdel) trustDrop();
    S.trustList=null; toast("Ordinateur retiré"); render(); });
  const add=$("#tr-add"); if(add) add.onclick=async()=>{ add.disabled=true; await afterMfa(true); S.trustList=null; render(); };
}

function renderMfa(a){
  const enroll=!S.mfa.hasFactor;
  // déjà affiché : ne pas recréer (sinon le code QR déjà scanné serait remplacé par un nouveau)
  if(a.dataset.view===(enroll?"mfa-enroll":"mfa-code")&&$("#mfa-go")) return;
  a.dataset.view=enroll?"mfa-enroll":"mfa-code";
  a.className="wrap";
  a.innerHTML=`<div class="top">${BRAND}<button class="iconbtn" id="logout" aria-label="Se déconnecter">${IC.user}</button></div>
  <div class="auth"><h1>${enroll?"Activer la double authentification":"Code de sécurité"}</h1>
  <p class="sub" style="margin:0">${enroll?"Les comptes de l'équipe donnent accès à des données de santé. Une étape de sécurité supplémentaire est obligatoire, une seule fois par appareil et par connexion.":"Ouvrez votre application d'authentification et entrez le code à 6 chiffres affiché pour « Centre Médical Prince de Liège »."}</p>
  <div class="form">
   <div id="fid-zone"></div>
   ${enroll?`<ol class="legal" style="margin:0;padding-left:18px"><li>Installez sur votre téléphone une application d'authentification : <b>Google Authenticator</b> ou <b>Microsoft Authenticator</b> (gratuites).</li><li>Dans l'application, choisissez « Ajouter un compte », puis « Scanner un code QR ».</li><li>Scannez le code ci-dessous, puis entrez le code à 6 chiffres affiché.</li></ol>
   <div id="qr" style="display:grid;place-items:center;min-height:200px"><span class="hint">Préparation du code…</span></div>`:""}
   <label class="fld" for="mfa-code">Code à 6 chiffres<input id="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></label>
   ${IS_NATIVE?"":`<label class="chk2" style="align-items:flex-start"><input type="checkbox" id="mfa-trust"> <span>Faire confiance à cet ordinateur (poste du centre)<small class="hint" style="display:block;margin-top:2px">Pendant 90 jours, l'e-mail et le mot de passe suffiront ici. Déconnexion après 2 heures d'inactivité. Jamais sur un ordinateur personnel ou public.</small></span></label>`}
   <div id="mfa-msg"></div>
   <button class="btn full" id="mfa-go">${enroll?"Activer":"Valider"}</button>
  </div>
  <p class="hint">Téléphone perdu ou changé ? L'administrateur peut réinitialiser votre double authentification.</p></div>`;
  $("#logout").onclick=()=>logout();
  const msg=t=>$("#mfa-msg").innerHTML=`<div class="err">${esc(t)}</div>`;
  let factorId=null, factorIds=[];
  // App iPhone : Face ID à la place de l'application d'authentification
  if(IS_NATIVE&&SEC()) bioInfo().then(b=>{ const z=$("#fid-zone"); if(!z||!b.available) return; const n=bioName();
    if(!enroll&&faceIdOn()){
      z.innerHTML=`<button class="btn full" id="fid-go">Se connecter avec ${n}</button><p class="hint" style="text-align:center;margin:6px 0 0">ou entrez le code de votre application d'authentification</p>`;
      const go=async()=>{ const bt=$("#fid-go"); if(bt) bt.disabled=true;
        try{ await faceIdLogin(); markActive(); lastAct=Date.now(); toast("Connecté"); await refresh(); }
        catch(e){ if(bt) bt.disabled=false; if(e&&e.code==="CANCELED") return;
          if(e&&e.code!=="ERROR"){ await faceIdForget(false); z.innerHTML=""; msg(BioName()+" n'est plus configuré"+bioE()+" sur ce téléphone : entrez le code de votre application, puis réactivez "+n+" dans Mon profil."); }
          else msg(BioName()+" n'a pas fonctionné. Réessayez ou entrez le code."); } };
      $("#fid-go").onclick=go; go();
    } else if(enroll){
      z.innerHTML=`<button class="btn full" id="fid-new">Activer avec ${n} (recommandé)</button><p class="hint" style="text-align:center;margin:6px 0 0">Rien à installer : ${n} remplace l'application d'authentification sur ce téléphone. Ou utilisez le code QR ci-dessous.</p>`;
      $("#fid-new").onclick=async e=>{ e.target.disabled=true;
        try{ await faceIdSetup(); markActive(); lastAct=Date.now(); toast(BioName()+" activé"+bioE()); await refresh(); }
        catch(err){ e.target.disabled=false; console.error(err); msg("Activation impossible : "+frError(err)); } };
    } });
  (async()=>{
    const {data:lf}=await sb.auth.mfa.listFactors();
    if(enroll){
      for(const f of (lf?.all||[])) if(f.status!=="verified") await sb.auth.mfa.unenroll({factorId:f.id});
      const {data,error}=await sb.auth.mfa.enroll({factorType:"totp",issuer:"Centre Médical Prince de Liège",friendlyName:"CMPL "+new Date().toISOString().slice(0,19)+" "+Math.random().toString(36).slice(2,6)});
      if(error){ console.error("MFA enroll",error); msg("La préparation du code a échoué (erreur "+(error.status||"?")+(error.code?" "+error.code:"")+"). "+(error.message&&error.message!=="{}"?frError(error):"")+" Réessayez dans un instant ; si cela persiste, prévenez l'administrateur."); return; }
      factorId=data.id;
      const raw=String(data.totp.qr_code||""), svg=raw.replace(/^data:image\/svg\+xml;[^,]*,/,""), qrSrc=svg.trim().startsWith("<")?"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg):raw;
      $("#qr").innerHTML=`<img src="${esc(qrSrc)}" alt="Code QR à scanner" style="width:200px;height:200px;background:#fff;padding:8px;border-radius:12px"><p class="hint" style="text-align:center;word-break:break-all">Impossible de scanner ? Entrez cette clé : <b>${esc(data.totp.secret)}</b></p>`;
    } else {
      // plusieurs appareils possibles (application d'authentification, Face ID sur iPhone…) :
      // le code est essayé sur chacun, l'application d'authentification d'abord
      const vf=(lf?.totp||[]).filter(f=>f.status==="verified");
      const isBio=f=>/^(Face ID|Touch ID|Empreinte)/.test(f.friendly_name||"");
      factorIds=[...vf.filter(f=>!isBio(f)&&!isTrustFactor(f)),...vf.filter(isBio),...vf.filter(isTrustFactor)].map(f=>f.id); factorId=factorIds[0];
      // ordinateur de confiance : connexion sans code
      const tr=trustGet();
      if(tr){ if(vf.some(f=>f.id===tr.f)){ const z=$("#mfa-msg"); if(z) z.innerHTML=`<p class="hint">Ordinateur de confiance : connexion…</p>`;
          const v=await sb.auth.mfa.challengeAndVerify({factorId:tr.f,code:await totpCode(tr.s)});
          if(!v.error){ markActive(); lastAct=Date.now(); await refresh(); return; }
          if(z) z.innerHTML=""; }
        trustDrop(); }   // retiré entre-temps (depuis Mon profil ou après 90 jours) : code normal
    }
  })();
  $("#mfa-code").focus();
  $("#mfa-go").onclick=async e=>{
    const code=$("#mfa-code").value.replace(/\D/g,"");
    if(code.length!==6) return msg("Entrez les 6 chiffres du code.");
    if(!factorId) return msg("Un instant, la préparation n'est pas terminée. Réessayez dans quelques secondes.");
    e.target.disabled=true;
    let error=null;
    for(const fid of (factorIds.length?factorIds:[factorId])){ ({error}=await sb.auth.mfa.challengeAndVerify({factorId:fid,code})); if(!error) break; if(!/invalid|expired/i.test(error.message||"")) break; }
    if(error){ e.target.disabled=false; return msg(/invalid|expired/i.test(error.message)?"Code incorrect ou expiré. Entrez le code actuellement affiché.":frError(error)); }
    markActive(); lastAct=Date.now(); toast("Accès sécurisé activé");
    await afterMfa(!!$("#mfa-trust")?.checked); await refresh();
  };
}

/* =====================================================================
   RENDU
   ===================================================================== */
function render(){
  if(REC) stopRec();
  draw(); hydrateAtt();
  { const rid=$("#chat")?(S.me?.role==="patient"?S.openReq:S.sel):null, tid=$("#tmsgs")?S.tthread:null;   // conversations plus affichées : on oublie
    for(const k in UNREAD){ if((k[0]==="r"&&k!=="r"+rid)||(k.startsWith("s:chat:")&&k!=="s:chat:"+rid)||(k[0]==="t"&&k!=="t"+tid)||(k.startsWith("s:tmsgs:")&&k!=="s:tmsgs:"+tid)) delete UNREAD[k]; } }
  if($("#chat")) requestAnimationFrame(scrollChat);
  updateBadges();
}

/* ---------- pastille « nouveau » : titre de l'onglet, icône de l'onglet, icône de l'app ---------- */
const BASE_TITLE=document.title;
const badgeCount = () => !S.me||S.me.status!=="active" ? 0
  : S.me.role==="patient" ? S.notifs.filter(n=>!n.read_at).length
  : S.reqs.filter(awaitingStaff).length + (S.team2&&S.team2.threads?teamUnread():0);
let lastBadge=-1, lastHot=-1, favImg=null;
document.addEventListener("visibilitychange",()=>{ if(!document.hidden&&S.me) updateBadges(); });
addEventListener("focus",()=>{ if(S.me) updateBadges(); });
function setFavicon(n){
  const link=document.querySelector('link[rel="icon"]'); if(!link) return;
  if(!link.dataset.base) link.dataset.base=link.href;
  if(!n){ link.href=link.dataset.base; return; }
  const draw=()=>{ const c=document.createElement("canvas"); c.width=c.height=64; const g=c.getContext("2d");
    g.drawImage(favImg,0,0,64,64); g.fillStyle="#d92d20"; g.beginPath(); g.arc(46,18,17,0,Math.PI*2); g.fill();
    g.fillStyle="#fff"; g.font="bold 24px sans-serif"; g.textAlign="center"; g.textBaseline="middle"; g.fillText(n>9?"9+":String(n),46,19);
    link.href=c.toDataURL("image/png"); };
  if(favImg&&favImg.complete) draw(); else { favImg=new Image(); favImg.onload=draw; favImg.src=link.dataset.base; }
}
function updateBadges(n=badgeCount()){
  // le chiffre sur l'icône peut avoir été posé par une notification reçue : on le remet toujours d'aplomb
  const hot=S.me&&S.me.role!=="patient"?myUrgent().length:0;
  if(n!==lastBadge||hot!==lastHot){ lastBadge=n; lastHot=hot;
    document.title = (hot?"🔴 ":"")+(n ? `(${n}) ${BASE_TITLE}` : BASE_TITLE);
    setFavicon(n); }
  try{ if(navigator.setAppBadge){ (n?navigator.setAppBadge(n):navigator.clearAppBadge()).catch(()=>{}); } }catch(e){}
  try{ const sec=CAP().CMPLSecure; if(IS_NATIVE&&sec) sec.setBadge({count:n}).catch(()=>{}); }catch(e){}
}
// ---------- Notifications push (téléphone et ordinateur, même app fermée) ----------
const IS_IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
// Dans l'app iPhone / Android (App Store, Google Play) : notifications natives et Face ID
// Accès aux modules natifs de l'app (la page vient d'app.cmpl.be : on passe directement par le pont Capacitor)
function capPlugin(name, methods){
  const C=window.Capacitor; if(!C||typeof C.nativePromise!=="function") return null;
  const p={};
  for(const m of methods) p[m]=(opts)=>C.nativePromise(name,m,opts||{});
  p.addListener=(eventName,cb)=>{ const id=C.nativeCallback(name,"addListener",{eventName},cb);
    return Promise.resolve({remove:()=>C.nativeCallback(name,"removeListener",{callbackId:id,eventName})}); };
  return p;
}
const CAP = () => { if(CAP.c) return CAP.c; const c={};
  const pn=capPlugin("PushNotifications",["checkPermissions","requestPermissions","register","unregister","removeAllDeliveredNotifications"]);
  const sec=capPlugin("CMPLSecure",["available","save","load","remove","setBadge","preview"]);
  const ap=capPlugin("App",["minimizeApp","exitApp"]);
  if(pn) c.PushNotifications=pn; if(sec) c.CMPLSecure=sec; if(ap) c.App=ap; return CAP.c=c; };
const IS_ANDROID=/android/i.test(navigator.userAgent);
const IS_NATIVE=/CMPLApp/.test(navigator.userAgent)||!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
const IS_STANDALONE=IS_NATIVE||matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
let pushSynced=false;
// --- app Android : bouton « retour » du téléphone ---
function androidBack(){
  const v=$(".viewer"); if(v){ v.querySelector(".cbtn")?.click(); return; }
  const tops=[...document.querySelectorAll(".modal,.sent,#diagbox,.tour,.scanner")];
  if(tops.length){ const t=tops[tops.length-1]; const x=t.querySelector('[id$="-x"],#diagx,.cbtn,#sent-home,#t-skip,[data-close]');
    if(x) x.click(); else t.remove(); return; }
  if($(".dd:not([hidden])")){ closeDD(); return; }
  const b=$("#back"); if(b){ b.click(); return; }
  if(S.me&&S.me.role==="patient"&&S.screen&&S.screen!=="home"){ S.screen="home"; render(); scrollTo(0,0); return; }
  const ap=CAP().App; if(ap) ap.minimizeApp().catch(()=>{});
}
if(IS_NATIVE&&IS_ANDROID) setTimeout(()=>{ try{ const ap=CAP().App; if(ap) ap.addListener("backButton",androidBack); }catch(e){ console.error(e); } },0);
// --- notifications natives (app iPhone) ---
let nativePush=null;   // granted | denied | prompt | unsupported
const NPUSH = () => IS_NATIVE ? CAP().PushNotifications : null;
const ntokKey = "cmpl_ntoken";
async function nativePushInit(){
  const P=NPUSH(); if(!P){ nativePush="unsupported"; return; }
  if(!nativePushInit.done){ nativePushInit.done=true;
    try{
      P.addListener("registration", async t=>{ if(!S.me) return;
        const {error}=await sb.rpc("register_native_push",{p_token:t.value,p_platform:IS_ANDROID?"android":"ios"}); if(error) console.error(error);
        try{ localStorage.setItem(ntokKey,t.value); }catch(e){} });
      P.addListener("registrationError", e=>console.error("notifications",e));
      P.addListener("pushNotificationActionPerformed", ()=>{ setTimeout(autoRefresh,300); });
      P.addListener("pushNotificationReceived", ()=>{ setTimeout(autoRefresh,300); });
    }catch(e){ console.error(e); }
  }
  try{ const r=await P.checkPermissions(); nativePush=r.receive==="granted"?"granted":r.receive==="denied"?"denied":"prompt"; }catch(e){ nativePush="unsupported"; }
  if(nativePush==="granted"&&S.me&&S.me.status==="active") P.register().catch(()=>{});
}
function pushState(){
  if(IS_NATIVE) return nativePush==="granted"?"granted":nativePush==="denied"?"denied":nativePush==="prompt"?"default":"unsupported";
  if(IS_IOS&&!IS_STANDALONE&&!("PushManager" in window)) return "ios-browser";
  if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)) return "unsupported";
  return Notification.permission;   // default | granted | denied
}
const b64uToBytes=s=>{ s=s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4) s+="="; return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); };
const bytesToB64u=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function pushSubscribe(){
  const {data:key,error}=await sb.rpc("push_public_key"); if(error||!key) return "nokey";
  const reg=await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  const old=sub&&sub.options&&sub.options.applicationServerKey;
  if(sub&&old&&bytesToB64u(old)!==key){ await sub.unsubscribe(); sub=null; }
  if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64uToBytes(key)});
  const j=sub.toJSON();
  const {error:e2}=await sb.rpc("push_register",{p_endpoint:j.endpoint,p_p256dh:j.keys.p256dh,p_auth:j.keys.auth});
  return e2?"error":"ok";
}
async function pushForget(){
  pushSynced=false;
  if(IS_NATIVE){ try{ const t=localStorage.getItem(ntokKey); if(t) await sb.rpc("unregister_native_push",{p_token:t}); localStorage.removeItem(ntokKey); }catch(e){} return; }
  try{ if(!("serviceWorker" in navigator)) return; const reg=await navigator.serviceWorker.getRegistration(); const sub=reg&&await reg.pushManager.getSubscription();
    if(sub){ await sb.rpc("push_unregister",{p_endpoint:sub.endpoint}); await sub.unsubscribe(); } }catch(e){}
}
function pushBlockHTML(staff){
  const st=pushState();
  if(st==="unsupported") return "";
  if(st==="ios-browser") return `<div class="pref"><span><b>Notifications sur l'iPhone</b><small>Pour recevoir les notifications, ajoutez d'abord l'app à l'écran d'accueil : bouton Partager, puis « Sur l'écran d'accueil ». Ouvrez ensuite l'app depuis cette icône.</small></span></div>`;
  if(st==="granted") return `<div class="pref"><span><b>Notifications sur cet appareil ✓</b><small>${staff?"Vous êtes prévenu ici, au rythme choisi ci-dessus, même app fermée. Sans nom de patient ni information médicale.":"Vous êtes prévenu ici, même app fermée, avec le nombre de nouveautés sur l'icône. Sans aucune information médicale."}</small></span></div>`;
  if(st==="denied") return `<div class="pref"><span><b>Notifications bloquées sur cet appareil</b><small>Vous pouvez les autoriser dans les réglages du téléphone ou du navigateur.</small></span></div>`;
  return `<div class="pref"><span><b>Notifications sur cet appareil</b><small>${staff?"Recevez une alerte sur ce téléphone ou cet ordinateur pour les nouvelles demandes et les messages de patients, au rythme choisi ci-dessus, même app fermée. Sans nom de patient ni information médicale.":"Soyez prévenu ici dès que le centre vous écrit, même app fermée, avec le nombre de nouveautés sur l'icône de l'app, comme WhatsApp. Sans aucune information médicale. Votre appareil va vous demander l'autorisation."}</small><button class="btn ghost" id="pushon" style="margin-top:8px">Activer</button></span></div>`;
}
function bindPush(){
  const b=$("#pushon"); if(!b) return;
  b.onclick=async()=>{ b.disabled=true;
    if(IS_NATIVE){ const P=NPUSH();
      try{ const r=await P.requestPermissions();
        if(r.receive!=="granted"){ nativePush="denied"; toast("Notifications refusées : vous pouvez les autoriser dans les réglages du téléphone."); render(); return; }
        nativePush="granted"; await P.register(); pushSynced=true; lastBadge=-1; updateBadges(); toast("Notifications activées");
      }catch(e){ toast("Activation impossible sur cet appareil."); }
      render(); return; }
    try{
      const p=await Notification.requestPermission();
      if(p!=="granted"){ toast("Notifications refusées : vous pouvez les autoriser dans les réglages du téléphone."); render(); return; }
      const r=await pushSubscribe(); pushSynced=true; lastBadge=-1; updateBadges();
      toast(r==="ok"?"Notifications activées":"Notifications pas encore disponibles. Réessayez plus tard.");
    }catch(e){ toast("Activation impossible sur cet appareil."); }
    render(); };
}
// Onglet en arrière-plan : le compteur se met à jour toutes les 2 minutes, sans recharger l'écran
setInterval(async()=>{ if(!document.hidden||!S.me||S.me.status!=="active") return;
  try{
    if(S.me.role==="patient"){ const r=await sb.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",S.me.id).is("read_at",null); if(!r.error) updateBadges(r.count||0); }
    else { const r=await sb.from("requests").select("id",{count:"exact",head:true}).neq("status","traite").eq("last_from","patient"); if(!r.error) updateBadges(r.count||0); }
  }catch(e){}
},120000);
function draw(){
  const a=app(); document.body.classList.remove("hasbar","ddopen","sidenav");
  if(S.loading){ a.className="wrap"; a.innerHTML=`<div class="loading">Chargement…</div>`; return; }
  if(S.recovery) return renderRecovery(a);
  if(!S.session) return renderAuth(a);
  if(!S.me) { a.className="wrap"; a.innerHTML=`<div class="loading">Préparation de votre compte…</div>`; setTimeout(refresh,1500); return; }
  if(S.me.status==="pending") return renderPending(a);
  if(S.me.status==="blocked") return renderBlocked(a);
  if(S.mfa) return renderMfa(a);
  if(S.me.role==="patient") return renderPatient(a);
  return renderStaff(a);
}

/* ---------- connexion / inscription ---------- */
const PRIVACY = `<details class="legal"><summary>Protection de vos données</summary>
<p><b>Qui est responsable ?</b> La société qui exploite le Centre Médical Prince de Liège, 21-23 rue du Potaerdenberg, 1070 Anderlecht. Contact pour vos données : <b>admin@cmpl.be</b>.</p>
<p><b>Quelles données ?</b> Votre identité (nom, prénom, date de naissance, photo de profil si vous en ajoutez une), vos coordonnées (e-mail, téléphone), vos demandes et messages, les photos, documents et messages vocaux que vous envoyez, les médicaments renouvelés, et un journal technique de sécurité.</p>
<p><b>Ma famille.</b> Si vous ajoutez vos enfants de moins de 16 ans, nous enregistrons leur prénom, nom et date de naissance, et les demandes faites en leur nom. Ces informations sont visibles par vous, par l'autre parent que vous invitez, et par l'équipe du centre. À 16 ans, l'enfant crée son propre compte ; plus aucune demande ne peut être faite en son nom.</p>
<p><b>Autres contacts.</b> Si vous indiquez un autre numéro ou une personne à contacter, seule l'équipe du centre le voit. Prévenez cette personne que vous avez donné son numéro.</p>
<p><b>Pourquoi ?</b> Uniquement pour communiquer avec le centre : rendez-vous, questions, renouvellements de prescription, résultats. Base légale : la relation de soins (RGPD, art. 6.1.b et 9.2.h). Les notifications d'annonces du centre reposent sur votre accord, que vous pouvez retirer à tout moment (art. 6.1.a).</p>
<p><b>Qui les voit ?</b> Vous, et seulement les membres de l'équipe concernés par votre demande, tenus au secret professionnel. Chaque ouverture d'une conversation ou d'une pièce jointe par l'équipe est enregistrée. Aucune publicité, aucun traceur, aucune revente.</p>
<p><b>Où ?</b> Les données sont hébergées par Supabase dans l'Union européenne (Irlande), sous contrat de protection des données. Les pages de l'app sont fournies par GitHub, qui enregistre l'adresse IP des visiteurs à des fins de sécurité. Les e-mails de notification sont envoyés par Brevo (France, UE) et ne contiennent aucune information médicale.</p>
<p><b>Combien de temps ?</b> Une conversation est effacée 15 jours après sa clôture ; ce qui est utile à votre suivi est reporté par le prestataire dans votre dossier médical au centre, conservé selon la loi. Notifications : 90 jours. Compte non validé : 60 jours. Compte sans connexion pendant 3 ans : supprimé. Journal de sécurité : 5 ans.</p>
<p><b>Vos droits.</b> Accès, rectification, effacement, limitation, opposition, portabilité, retrait de votre accord. Dans « Mon compte », vous pouvez télécharger vos données et supprimer votre compte. Pour toute autre demande : admin@cmpl.be (réponse dans un délai d'un mois). Vous pouvez aussi introduire une plainte auprès de l'Autorité de protection des données (autoriteprotectiondonnees.be, rue de la Presse 35, 1000 Bruxelles).</p>
<p><a href="confidentialite.html" target="_blank" rel="noopener">Politique de confidentialité complète</a></p>
<p><small>Version du 16 octobre 2026.</small></p></details>`;
function renderAuth(a){
  a.className="wrap";
  const m=S.authMode;
  const pinned=S.news.filter(n=>n.pinned);
  a.innerHTML=`<div class="langbar">${langPickerHTML()}</div>${AUTHLOGO}
  ${pinned.map(n=>`<div style="margin-bottom:12px">${newsCard(n,true,true)}</div>`).join("")}
  <div class="auth">
   <h1>${m==="signup"?"Créer mon compte":m==="forgot"?"Mot de passe oublié":"Connexion"}</h1>
   <div class="seg" role="group" aria-label="Connexion ou inscription">
    <button id="m-login" aria-pressed="${m==="login"}">J'ai un compte</button>
    <button id="m-signup" aria-pressed="${m==="signup"}">Créer un compte</button>
   </div>
   <form class="form" id="authform" novalidate>
    ${m==="signup"?`
     <div class="row2"><label class="fld" for="f-first">Prénom<input id="f-first" autocomplete="given-name" required></label>
     <label class="fld" for="f-last">Nom<input id="f-last" autocomplete="family-name" required></label></div>
     <div class="row2"><label class="fld" for="f-birth">Date de naissance<input id="f-birth" type="date" required></label>
     <label class="fld" for="f-phone">Téléphone<input id="f-phone" type="tel" autocomplete="tel" placeholder="04xx xx xx xx" required></label></div>`:""}
    <label class="fld" for="f-email">Adresse e-mail<input id="f-email" type="email" autocomplete="${m==="signup"?"email":"username"}" autocapitalize="none" spellcheck="false" required></label>
    ${m!=="forgot"?`<label class="fld" for="f-pass">Mot de passe${m==="signup"?" (8 caractères minimum)":""}<input id="f-pass" type="password" autocomplete="${m==="signup"?"new-password":"current-password"}" required></label>`:""}
    ${m==="signup"?`<label class="chkline"><input type="checkbox" id="f-ok"> <span>J'ai lu les informations sur la protection de mes données et j'accepte qu'elles soient utilisées pour communiquer avec le centre.</span></label>${PRIVACY}`:""}
    <div id="f-msg"></div>
    <button class="btn full" type="submit">${m==="signup"?"Créer mon compte":m==="forgot"?"Recevoir un lien par e-mail":"Me connecter"}</button>
    ${m==="login"?`<button type="button" class="linkbtn" id="m-forgot">Mot de passe oublié ?</button>`:""}
    ${m==="forgot"?`<button type="button" class="linkbtn" id="m-back">Retour à la connexion</button>`:""}
   </form>
   ${m!=="signup"?PRIVACY:""}
   ${BANNER112}
  </div>`;
  bindLangPicker(); addEyes(a);
  $("#m-login").onclick=()=>{S.authMode="login";render()};
  $("#m-signup").onclick=()=>{S.authMode="signup";render()};
  const fg=$("#m-forgot"); if(fg) fg.onclick=()=>{S.authMode="forgot";render()};
  const bk=$("#m-back"); if(bk) bk.onclick=()=>{S.authMode="login";render()};
  $("#authform").onsubmit=async e=>{
    e.preventDefault();
    const msg=$("#f-msg"), btn=e.target.querySelector('button[type="submit"]');
    const show=(t,ok)=>msg.innerHTML=`<div class="${ok?"okmsg":"err"}">${esc(t)}</div>`;
    const email=$("#f-email").value.trim(), pass=$("#f-pass")?.value||"";
    if(!/^\S+@\S+\.\S+$/.test(email)) return show("Vérifiez l'adresse e-mail.");
    btn.disabled=true;
    try{
      if(m==="login"){
        const {error}=await sb.auth.signInWithPassword({email,password:pass}); if(error) throw error;
      } else if(m==="forgot"){
        const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}); if(error) throw error;
        show("Si un compte existe avec cette adresse, un lien vient de vous être envoyé.",true);
      } else {
        const first=$("#f-first").value.trim(), last=$("#f-last").value.trim(), birth=$("#f-birth").value, phone=$("#f-phone").value.trim();
        if(!first||!last||!birth||!phone) throw new Error("Remplissez tous les champs.");
        if(pass.length<8) throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
        if(!$("#f-ok").checked) throw new Error("Cochez la case sur la protection des données pour continuer.");
        const {data,error}=await sb.auth.signUp({email,password:pass,options:{data:{first_name:first,last_name:last,birth_date:birth,phone},emailRedirectTo:location.origin+location.pathname}});
        if(error) throw error;
        if(!data.session) show("Compte créé. Ouvrez l'e-mail que vous venez de recevoir pour confirmer votre adresse, puis connectez-vous.",true);
      }
    }catch(err){ show(frError(err)); }
    btn.disabled=false;
  };
}
// Bouton « œil » pour voir le mot de passe tapé
const EYE='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.1 6.1C3.6 7.8 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 4-.9"/></svg>';
function addEyes(root){
  (root||document).querySelectorAll('input[type="password"]:not([data-eye])').forEach(inp=>{
    inp.dataset.eye="1"; const w=document.createElement("span"); w.className="pwwrap"; inp.parentNode.insertBefore(w,inp); w.appendChild(inp);
    const b=document.createElement("button"); b.type="button"; b.className="pweye"; b.innerHTML=EYE; b.setAttribute("aria-label","Afficher le mot de passe"); w.appendChild(b);
    b.onclick=()=>{ const show=inp.type==="password"; inp.type=show?"text":"password"; b.innerHTML=show?EYE_OFF:EYE;
      b.setAttribute("aria-label",show?"Masquer le mot de passe":"Afficher le mot de passe"); inp.focus({preventScroll:true}); };
  });
}
function renderRecovery(a){
  a.className="wrap";
  a.innerHTML=`<div class="top">${BRAND}</div><div class="auth"><h1>Nouveau mot de passe</h1>
  <form class="form" id="recform"><label class="fld" for="r-pass">Nouveau mot de passe (8 caractères minimum)<input id="r-pass" type="password" autocomplete="new-password"></label>
   <div id="r-mfa" hidden><label class="fld" for="r-code">Code de sécurité (6 chiffres)<input id="r-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456"></label>
    <p class="hint">Votre compte de l'équipe est protégé par la double authentification : entrez le code affiché dans votre application d'authentification (Google Authenticator, Microsoft Authenticator…). Plus d'accès à cette application ? Demandez à l'administrateur de réinitialiser votre double authentification.</p></div>
   <div id="r-msg"></div><button class="btn full" type="submit">Enregistrer</button></form></div>`;
  addEyes(a);
  // compte de l'équipe avec double authentification : le code est demandé avant de changer le mot de passe
  let needMfa=false, fids=[];
  (async()=>{ try{ const {data:aal}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if(aal&&aal.nextLevel==="aal2"&&aal.currentLevel!=="aal2"){
      const {data:lf}=await sb.auth.mfa.listFactors(); const vf=(lf?.totp||[]).filter(f=>f.status==="verified");
      fids=[...vf.filter(f=>!isTrustFactor(f)),...vf.filter(isTrustFactor)].map(f=>f.id);
      const tr=trustGet();   // ordinateur de confiance : pas besoin de code
      if(tr&&vf.some(f=>f.id===tr.f)){ const v=await sb.auth.mfa.challengeAndVerify({factorId:tr.f,code:await totpCode(tr.s)}); if(!v.error) return; }
      needMfa=true; $("#r-mfa").hidden=false; } }catch(e){ console.error(e); } })();
  $("#recform").onsubmit=async e=>{ e.preventDefault(); const p=$("#r-pass").value, m=$("#r-msg");
    if(p.length<8){ m.innerHTML=`<div class="err">Le mot de passe doit contenir au moins 8 caractères.</div>`; return; }
    if(needMfa){ const code=$("#r-code").value.replace(/\D/g,"");
      if(code.length!==6){ m.innerHTML=`<div class="err">Entrez les 6 chiffres du code de sécurité.</div>`; $("#r-code").focus(); return; }
      let err=null; for(const fid of fids){ ({error:err}=await sb.auth.mfa.challengeAndVerify({factorId:fid,code})); if(!err) break; if(!/invalid|expired/i.test(err.message||"")) break; }
      if(err){ m.innerHTML=`<div class="err">${/invalid|expired/i.test(err.message||"")?"Code incorrect ou expiré. Entrez le code actuellement affiché.":esc(frError(err))}</div>`; return; }
      needMfa=false; $("#r-mfa").hidden=true; }
    const {error}=await sb.auth.updateUser({password:p});
    if(error){ m.innerHTML=`<div class="err">${/AAL2/i.test(error.message||"")?"Entrez d'abord votre code de sécurité (double authentification).":esc(frError(error))}</div>`; if(/AAL2/i.test(error.message||"")){ needMfa=true; $("#r-mfa").hidden=false; } return; }
    markActive(); S.recovery=false; toast("Mot de passe enregistré"); refresh(); };
}
function renderPending(a){
  a.className="wrap";
  a.innerHTML=`<div class="top">${BRAND}<button class="iconbtn" id="logout" aria-label="Se déconnecter" title="Se déconnecter">${IC.user}</button></div>
  <div class="langbar">${langPickerHTML()}</div>
  <h1 class="hello">Bonjour ${esc(S.me.first_name||"")}</h1>
  <div class="promise" style="margin:12px 0 18px;max-width:none"><b>Votre compte est en attente de validation</b><span>Le secrétariat vérifie que vous êtes bien patient du centre. Vous pourrez ensuite envoyer vos demandes. Revenez dans l'app après la validation.</span></div>
  ${BANNER112}
  ${S.news.length?`<div class="sechead"><h2>Actualités</h2></div><div class="newslist">${S.news.map(n=>newsCard(n,true,true)).join("")}</div>`:""}`;
  $("#logout").onclick=logout; bindLangPicker();
}
function renderBlocked(a){
  a.className="wrap";
  a.innerHTML=`<div class="top">${BRAND}<button class="iconbtn" id="logout" aria-label="Se déconnecter">${IC.user}</button></div>
  <div class="closed"><b>Compte non validé</b><span>Ce compte n'a pas pu être validé. Contactez le secrétariat au 02 781 18 75.</span></div>`;
  $("#logout").onclick=logout;
}
async function logout(reason){ if(typeof reason!=="string") await pushForget(); stopRealtime(); await sb.auth.signOut(); updateBadges(0); const keep=savedLang(); if(keep&&keep!==L) applyLang(keep); S.session=null; S.me=null; S.mfa=null; S.trustList=null; S.scope=null; S.iq=""; S.itype="all"; S.screen="home"; S.cscreen="inbox"; try{ localStorage.removeItem("cmpl_last_active"); }catch(e){} render(); if(typeof reason==="string") toast(reason); }

/* =====================================================================
   PATIENT
   ===================================================================== */
const PBAR_SCREENS=["home","reqs","news","account","notifs","absences","help"];
function patientBarHTML(){ const sc=S.screen, nU=S.notifs.filter(n=>n.request_id&&!n.read_at&&n.title!=="Demande bien reçue").length;
  const it=(k,ic,t,n)=>`<button data-pb="${k}" aria-current="${sc===k||(k==="news"&&sc==="news")?"page":"false"}">${ic}<span>${t}</span>${n?`<em class="pbn">${n}</em>`:""}</button>`;
  return `<nav class="pbar" aria-label="Navigation">${it("home",PI.home,"Accueil")}${it("reqs",IC.question,"Demandes",nU)}<button class="pbmid" id="pb-new" aria-label="Nouvelle demande"><b aria-hidden="true">＋</b><span>Nouvelle</span></button>${it("news",IC.news,"Actualités")}${it("account",IC.user,"Moi")}</nav>`; }
function bindPatientBar(){ $$("[data-pb]").forEach(b=>b.onclick=()=>{ S.screen=b.dataset.pb; if(S.screen==="news") S.openNews=null; render(); scrollTo(0,0); }); const nb=$("#pb-new"); if(nb) nb.onclick=openNewSheet; }
function renderPatient(a){
  a.className="wrap";
  const sc=S.screen, bar=PBAR_SCREENS.includes(sc)&&S.me.status==="active";
  document.body.classList.toggle("pbaron",bar);
  _renderPatient(a);
  if(bar){ a.insertAdjacentHTML("beforeend",patientBarHTML()); bindPatientBar(); }
}
function _renderPatient(a){
  const sc=S.screen;
  if(sc==="reqs") return patientReqs(a);
  if(sc==="flow") return patientFlow(a);
  if(sc==="req") return patientReq(a);
  if(sc==="notifs") return patientNotifs(a);
  if(sc==="news") return patientNews(a);
  if(sc==="account") return patientAccount(a);
  if(sc==="help") return patientHelp(a);
  if(sc==="absences") return patientAbsences(a);
  patientHome(a);
  if(!tourDone()) setTimeout(()=>{ if(S.me&&S.me.role==="patient"&&S.screen==="home"&&!tourDone()) openTour(); },400);
}
function topBar(){
  const unread=S.notifs.filter(n=>!n.read_at).length;
  return `<div class="top">${BRAND}<div class="menu"><button class="iconbtn" data-search aria-label="Rechercher">${SI.search}</button><button class="iconbtn" id="help" aria-label="Aide">${IC.help}</button><button class="iconbtn bell" id="bell" aria-label="Notifications">${IC.bell}${unread?`<span class="badge">${unread}</span>`:""}</button><button class="iconbtn" id="acct" aria-label="Mon compte">${AV.get(S.me.id)?avatarHTML(AV.get(S.me.id),"",42):IC.user}</button></div></div>`;
}
function bindTop(){ $("#help").onclick=()=>{S.screen="help";render();scrollTo(0,0)}; $("#bell").onclick=()=>{S.screen="notifs";render()}; $("#acct").onclick=()=>{S.screen="account";render()}; }
function patientAbsences(a){
  const t=todayISO(), list=P.list();
  const specs=[...new Set(list.map(p=>p.specialty))];
  const item=p=>{ const ab=provAbs(p.id), now=ab.find(x=>x.starts<=t);
    return `<details class="faq absprov"><summary><span translate="no">${esc(p.display_name)}</span>${now?`<span class="pill st-encours">Absent(e) en ce moment</span>`:ab.length?`<span class="pill st-wait">Absence prévue</span>`:""}</summary>
      ${ab.length?`<ul>${ab.map(x=>`<li>${esc(absSentence(p.display_name,x))}</li>`).join("")}</ul>`:`<p>Aucune absence prévue dans les 3 prochains mois.</p>`}</details>`; };
  a.innerHTML=`<div class="convhead"><button class="back" id="back" aria-label="Retour">${IC.back}</button><div><h2>Absences des prestataires</h2><small>Cliquez sur un prestataire pour voir ses dates d'absence.</small></div></div>
  <p class="hint absnote">Certains congés peuvent être prévus mais pas encore encodés dans l'application.</p>
  ${specs.map(sp=>`<h3 class="abspec">${esc(sp)}</h3><div class="faqlist">${list.filter(p=>p.specialty===sp).map(item).join("")}</div>`).join("")}
  <section class="card helpcontact"><p>Pour une demande qui ne peut pas attendre, le secrétariat peut vous aider : 02 781 18 75.</p><p class="hint">Urgence vitale : appelez le 112.</p></section>`;
  $("#back").onclick=()=>{S.screen="home";render()};
}
// Annonce en une ligne (accueil) : le détail s'ouvre au toucher
function newsBanner(n){ const poster=n.image_path;
  return `<button class="nban ${n.pinned?"pinned":""}" data-news="${n.id}">${poster?`<img src="${esc(n.image_path)}" alt="">`:`<span class="nbi" aria-hidden="true">📢</span>`}<span class="nbt"><b translate="no" dir="auto">${esc(n.title)}</b><small><span>${esc(n.category)}</span> · <span>${fmt(n.published_at)}</span></small></span><span class="chev" aria-hidden="true">›</span></button>`; }
// « Nouvelle demande » : les 6 choix dans un panneau qui monte du bas
function openNewSheet(){
  const v=document.createElement("div"); v.className="modal sheetmodal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true"); v.setAttribute("aria-labelledby","ns-t");
  v.innerHTML=`<div class="sheet"><div class="grab" aria-hidden="true"></div><div class="sheethead"><h2 id="ns-t">Que souhaitez-vous faire ?</h2><button type="button" class="cbtn sm" id="ns-x" aria-label="Fermer">✕</button></div>
    <div class="actions sheetacts">${PATIENT_TYPES.map(k=>[k,TYPES[k]]).map(([k,t])=>`<button class="act t-${k}" data-nstart="${k}"><div class="ic">${IC[k]}</div><b>${t.title}</b><span>${t.desc}</span></button>`).join("")}</div></div>`;
  document.body.appendChild(v); document.body.classList.add("sheeton");
  const close=()=>{ v.classList.add("closing"); document.body.classList.remove("sheeton"); removeEventListener("keydown",esc_); setTimeout(()=>v.remove(),180); };
  const esc_=e=>{ if(e.key==="Escape") close(); }; addEventListener("keydown",esc_);
  v.onclick=e=>{ if(e.target===v) close(); }; v.querySelector("#ns-x").onclick=close;
  v.querySelectorAll("[data-nstart]").forEach(b=>b.onclick=()=>{ v.remove(); document.body.classList.remove("sheeton"); removeEventListener("keydown",esc_); startFlow(b.dataset.nstart); });
  v.querySelector("[data-nstart]").focus();
}
function patientHome(a){
  const pinned=S.news.filter(n=>n.pinned), others=S.news.filter(n=>!n.pinned);
  const fk=famKids(), who=S.who&&(S.who==="me"||fk.some(c=>c.id===S.who))?S.who:"all";
  const forWho = x => who==="all" || (who==="me" ? !x.child_id : x.child_id===who);
  const mine=S.reqs.filter(forWho).sort((x,y)=>(x.status==="traite")-(y.status==="traite")||new Date(y.created_at)-new Date(x.created_at));
  const meds=S.meds.filter(forWho);
  const grown=fk.filter(c=>c.status==="active"&&c.age>=CHILD_MAX_AGE), waiting=fk.filter(c=>c.status==="pending");
  const chips=fk.length?`<div class="tabs whochips" role="group" aria-label="Afficher pour">${[["all","Tous"],["me","Moi"],...fk.map(c=>[c.id,c.first_name])].map(([id,l])=>`<button class="tab" data-who="${id}" aria-pressed="${who===id}">${esc(l)}</button>`).join("")}</div>`:"";
  const forTag = x => x.child_id ? ` · pour ${esc(childFirst(x.child_id))}` : "";
  const medsSec=`  <div class="sechead"><h2>${fk.length?"Médicaments":"Mes médicaments"}</h2><small class="hint">Accordés par votre médecin</small></div>
  <div class="list" style="margin-bottom:26px">${meds.length?meds.map(m=>`<div class="medrow"><div class="ic">${IC.prescription}</div><div><b>${esc(m.label)}</b><small>${m.child_id?`Pour ${esc(childFirst(m.child_id))} · `:fk.length?"Pour moi · ":""}Dernière prescription ${fmt(m.last_granted_at)} · ${m.times_granted} fois</small></div><div class="acts"><button class="mini" data-renew="${esc(m.label)}" data-renewkid="${m.child_id||""}">Renouveler</button><button class="linkbtn" style="font-size:12px;color:var(--muted)" data-forget="${m.id}">Retirer</button></div></div>`).join(""):`<div class="empty">Vos médicaments apparaîtront ici après votre première prescription accordée.</div>`}</div>`;
  const eve=new Date().getHours()>=18||new Date().getHours()<5;
  a.innerHTML=`<div class="phero">${topBar()}
  <div class="phello"><div><h1 class="hello">${eve?"Bonsoir":"Bonjour"} ${esc(S.me.first_name||"")}</h1>
  <p class="sub openst ${isOpen(new Date())?"on":""}"><span class="odot" aria-hidden="true"></span>${esc(openStatusText())}</p></div>${eve?MOON_SVG:SUN_SVG}</div></div>
  ${photosCarouselHTML()}
  ${S.me.news_choice_at?"":`<section class="consent" aria-labelledby="cq"><h2 id="cq">Annonces du centre</h2><p>Souhaitez-vous recevoir une notification pour les annonces importantes du centre (fermetures exceptionnelles, campagnes de vaccination) ?</p><p class="hint">Les réponses à vos demandes vous sont toujours notifiées. Vous pourrez changer d'avis à tout moment dans Notifications.</p><div class="btnrow"><button class="btn" data-consent="1">Oui, me prévenir</button><button class="btn ghost" data-consent="0">Non merci</button></div></section>`}
  <div class="urgent compact">${IC.alert}<div><strong>Urgence vitale : appelez le 112.</strong><br>Les demandes envoyées ici sont lues pendant les heures d'ouverture, pas en urgence.</div></div>
  ${grown.map(c=>`<div class="famnote"><b>${esc(c.first_name)} a ${c.age} ans.</b> Il ou elle doit maintenant créer son propre compte dans l'app pour ses demandes (Créer un compte, avec sa propre adresse e-mail).</div>`).join("")}
  ${waiting.length?`<div class="famnote soft">En attente de validation par le centre : ${waiting.map(c=>esc(c.first_name)).join(", ")}. Vous pourrez ensuite faire des demandes en son nom.</div>`:""}
  ${chips}
  <div class="sechead"><h2>${fk.length?"Demandes":"Mes demandes"}</h2>${mine.length>4?`<button class="linkbtn" id="allreqs">Tout voir (${mine.length})</button>`:""}</div>
  <div class="list">${reqRowsHTML(mine.slice(0,4))}</div>
  <div style="height:22px"></div>
  ${S.news.length?`<div class="sechead"><h2>Actualités</h2>${S.news.length>3?`<button class="linkbtn" id="allnews">Tout voir</button>`:""}</div>
  <div class="nbans" style="margin-bottom:22px">${[...pinned,...others].slice(0,3).map(newsBanner).join("")}</div>`:""}
  ${meds.length?medsSec:""}
  <button class="absrow" id="absbtn">${IC.rdv}<span>Absences des prestataires</span><span aria-hidden="true">›</span></button>
`;
  bindTop(); bindCarousel();
  const ar=$("#allreqs"); if(ar) ar.onclick=()=>{ S.screen="reqs"; render(); scrollTo(0,0); };
  $$("[data-start]").forEach(b=>b.onclick=()=>startFlow(b.dataset.start));
  bindHomeRest();
}
function reqRowsHTML(mine){ const forTag = x => x.child_id ? ` · pour ${esc(childFirst(x.child_id))}` : "";
  return mine.length?mine.map(r=>{const ms=msgsOf(r),last=ms[ms.length-1],unread=S.notifs.some(n=>n.request_id===r.id&&!n.read_at&&n.title!=="Demande bien reçue");
    const prev=r.purged_at?"Contenu effacé":last?(last.from_patient?"Vous : ":"")+msgPreview(last):summaryLine(r.answers);
    return `<button class="row chatrow ${unread?"unread":""}" data-req="${r.id}"><div class="ic t-${r.type}">${IC[r.type]}</div><div><b>${esc(reqWho(r))} · ${TYPES[r.type].label}${forTag(r)}</b><small>${esc(prev)}</small></div><div class="rside"><small>${fmt(last?last.created_at:r.created_at)}</small>${unread?`<span class="dot" aria-label="Nouveau message"></span>`:`<span class="pill st-${stClassP(r)}">${stLabelP(r)}</span>`}</div></button>`}).join(""):`<div class="empty">Aucune demande pour l'instant.<br><small>Touchez ＋ en bas de l'écran pour en faire une.</small></div>`; }
// demandes classées du patient : rangées par mois (le plus récent ouvert)
function pMonthsHTML(done){
  const when=r=>r.closed_at||r.created_at, keys=[...new Set(done.map(r=>String(when(r)).slice(0,7)))].sort().reverse();
  return keys.map((k,i)=>{ const its=done.filter(r=>String(when(r)).slice(0,7)===k), open=(S.pMonth||{})[k]??(i===0);
    const l=new Date(k+"-15").toLocaleDateString(LOC,{month:"long",year:"numeric"});
    return `<button type="button" class="pmonth" data-pmonth="${k}" aria-expanded="${open}"><span>${esc(l.charAt(0).toUpperCase()+l.slice(1))}</span><span><b>${its.length}</b> ${open?"▾":"▸"}</span></button>${open?`<div class="list" style="margin-bottom:10px">${reqRowsHTML(its)}</div>`:""}`; }).join("");
}
function patientReqs(a){
  const fk=famKids(), who=S.who&&(S.who==="me"||fk.some(c=>c.id===S.who))?S.who:"all";
  const forWho = x => who==="all" || (who==="me" ? !x.child_id : x.child_id===who);
  const mine=S.reqs.filter(forWho).sort((x,y)=>(x.status==="traite")-(y.status==="traite")||new Date(y.created_at)-new Date(x.created_at));
  const open=mine.filter(r=>r.status!=="traite"), done=mine.filter(r=>r.status==="traite");
  const chips=fk.length?`<div class="tabs whochips" role="group" aria-label="Afficher pour">${[["all","Tous"],["me","Moi"],...fk.map(c=>[c.id,c.first_name])].map(([id,l])=>`<button class="tab" data-who="${id}" aria-pressed="${who===id}">${esc(l)}</button>`).join("")}</div>`:"";
  a.innerHTML=`<div class="convhead"><div><h2>Mes demandes</h2><small>Vos conversations avec le centre</small></div></div>
  ${chips}
  <div class="list" style="margin-bottom:22px">${reqRowsHTML(open)}</div>
  ${done.length?`<div class="sechead"><h2>Classées</h2></div>${done.length>6?pMonthsHTML(done):`<div class="list">${reqRowsHTML(done)}</div>`}`:""}`;
  $$("[data-who]").forEach(b=>b.onclick=()=>{ S.who=b.dataset.who; render(); });
  $$("[data-pmonth]").forEach(b=>b.onclick=()=>{ (S.pMonth||(S.pMonth={}))[b.dataset.pmonth]=b.getAttribute("aria-expanded")!=="true"; render(); });
  $$("[data-req]").forEach(b=>b.onclick=()=>openRequest(+b.dataset.req));
}
function bindHomeRest(){
  $$("[data-consent]").forEach(b=>b.onclick=async()=>{ const ok=b.dataset.consent==="1";
    if(await run(()=>sb.rpc("set_news_consent",{p_ok:ok}),ok?"Vous serez prévenu des annonces importantes":"C'est noté : pas de notification pour les annonces")){ S.me.news_push=ok; S.me.news_choice_at=new Date().toISOString(); render(); } });
  $$("[data-news]").forEach(b=>b.onclick=()=>{S.openNews=+b.dataset.news;S.screen="news";render();scrollTo(0,0)});
  $("#absbtn").onclick=()=>{S.screen="absences";render();scrollTo(0,0)};
  const an=$("#allnews"); if(an) an.onclick=()=>{S.openNews=null;S.screen="news";render();scrollTo(0,0)};
  $$("[data-renew]").forEach(b=>b.onclick=()=>{ const c=kids().find(k=>k.id===b.dataset.renewkid); startFlow("prescription",[b.dataset.renew], c?kidLabel(c):(kids().length?"Pour moi":null)); });
  $$("[data-who]").forEach(b=>b.onclick=()=>{ S.who=b.dataset.who; render(); });
  $$("[data-forget]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.from("patient_meds").delete().eq("id",+b.dataset.forget),"Retiré de vos médicaments")){ S.meds=S.meds.filter(m=>m.id!==+b.dataset.forget); render(); } });
  $$("[data-req]").forEach(b=>b.onclick=()=>openRequest(+b.dataset.req));
}
async function openRequest(id){
  S.openReq=id; S.screen="req"; render();
  const unread=S.notifs.filter(n=>n.request_id===id&&!n.read_at);
  if(unread.length){ await sb.from("notifications").update({read_at:new Date().toISOString()}).in("id",unread.map(n=>n.id)); unread.forEach(n=>n.read_at=new Date().toISOString()); }
}
function patientNews(a){
  const one=S.openNews?S.news.find(n=>n.id===S.openNews):null;
  a.innerHTML=`<div class="convhead"><button class="back" id="back" aria-label="Retour">${IC.back}</button><div><h2>Actualités</h2><small>Les nouvelles du centre</small></div></div>
  <div class="newslist">${one?newsCard(one,true):S.news.length?S.news.map(n=>`<button class="newsbtn" data-news="${n.id}">${newsCard(n,false)}</button>`).join(""):`<div class="empty">Pas d'actualité en ce moment.</div>`}</div>`;
  $("#back").onclick=()=>{ if(S.openNews){S.openNews=null;render()} else {S.screen="home";render()} };
  $$("[data-news]").forEach(b=>b.onclick=()=>{S.openNews=+b.dataset.news;render();scrollTo(0,0)});
}
function patientNotifs(a){
  a.innerHTML=`<div class="convhead"><button class="back" id="back" aria-label="Retour">${IC.back}</button><div><h2>Notifications</h2></div></div>
  <label class="pref"><input type="checkbox" id="emailnotif" ${S.me.email_notify!==false?"checked":""}><span><b>Me prévenir par e-mail</b><small>Un e-mail court quand le centre vous écrit, sans aucune information médicale : il vous invite simplement à ouvrir l'application.</small></span></label>
  <label class="pref"><input type="checkbox" id="newspush" ${S.me.news_push?"checked":""}><span><b>Annonces importantes du centre</b><small>Fermetures exceptionnelles, campagnes de vaccination. Uniquement si vous cochez cette case. Les réponses à vos demandes restent toujours notifiées.</small></span></label>
  ${pushBlockHTML(false)}
  ${S.notifs.some(n=>!n.read_at)?`<div class="btnrow readall"><button class="btn ghost" id="readall">✓ Tout marquer comme lu</button></div>`:""}
  <div class="list">${S.notifs.length?S.notifs.map(n=>`<button class="row nrow ${n.read_at?"":"unread"}" data-n="${n.id}"><div class="ic">${n.announcement_id?IC.news:IC.bell}</div><div><b>${esc(n.title)}</b><small style="white-space:normal">${esc(n.body)}</small><small>${fmt(n.created_at)}</small></div><span></span></button>`).join(""):`<div class="empty">Aucune notification.</div>`}</div>`;
  $("#back").onclick=()=>{S.screen="home";render()};
  bindPush();
  const ra=$("#readall"); if(ra) ra.onclick=async()=>{ ra.disabled=true; const now=new Date().toISOString();
    if(await run(()=>sb.from("notifications").update({read_at:now}).eq("user_id",S.me.id).is("read_at",null),"Toutes les notifications sont marquées comme lues")){ S.notifs.forEach(n=>{ if(!n.read_at) n.read_at=now; }); render(); } else ra.disabled=false; };
  $("#emailnotif").onchange=async e=>{ const v=e.target.checked; if(await run(()=>sb.from("profiles").update({email_notify:v}).eq("id",S.me.id),v?"Vous serez prévenu par e-mail":"Plus d'e-mail de notification")) S.me.email_notify=v; else e.target.checked=!v; };
  $("#newspush").onchange=async e=>{ const v=e.target.checked; if(await run(()=>sb.rpc("set_news_consent",{p_ok:v}),v?"Annonces activées":"Annonces désactivées")){ S.me.news_push=v; S.me.news_choice_at=new Date().toISOString(); } else e.target.checked=!v; };
  $$("[data-n]").forEach(b=>b.onclick=async()=>{ const n=S.notifs.find(x=>x.id===+b.dataset.n);
    if(!n.read_at){ await sb.from("notifications").update({read_at:new Date().toISOString()}).eq("id",n.id); n.read_at=new Date().toISOString(); }
    if(n.request_id) openRequest(n.request_id); else if(n.announcement_id){ S.openNews=n.announcement_id; S.screen="news"; render(); } else render(); });
}
/* ---------- visite guidée et aide (patients) ---------- */
const TOUR=[
 {ic:"bell",t:"Bienvenue dans l'app du Centre Médical Prince de Liège",x:"Découvrez en une minute tout ce que vous pouvez faire avec l'app. Touchez « Suivant »."},
 {ic:"rdv",t:"Demander un rendez-vous",x:"Choisissez le type de consultation et le motif. Le secrétariat vous propose ensuite un moment, directement dans la conversation."},
 {ic:"question",t:"Poser une question",x:"Écrivez à un prestataire du centre : par message, photo ou message vocal. Réponse dans les 24 à 72 heures, pendant les heures d'ouverture."},
 {ic:"prescription",t:"Renouveler un médicament",x:"Choisissez votre traitement habituel. Si le médecin accepte, la prescription est électronique : votre pharmacien la retrouve avec votre carte d'identité."},
 {ic:"document",t:"Documents, résultats et rapports",x:"Envoyez un résultat ou un courrier, signalez un examen dont vous attendez le résultat, ou demandez un rapport médical."},
 {ic:"bell",t:"Vos réponses",x:"Les réponses arrivent dans « Mes demandes ». La cloche en haut vous prévient des nouveautés. Activez les notifications pour être prévenu même quand l'app est fermée."},
 {ic:"user",t:"Ma famille et mon compte",x:"Dans Mon compte (en haut à droite) : ajoutez vos enfants de moins de 16 ans pour faire des demandes en leur nom, et choisissez la langue de l'app."},
 {ic:"alert",t:"Important : pas pour les urgences",x:"L'app n'est pas faite pour les urgences. Urgence vitale : appelez le 112. Pour une question urgente pendant les heures d'ouverture, appelez le centre au 02 781 18 75."}
];
const tourKey = () => "cmpl_tour_"+(S.me?.id||"");
function tourDone(){ if(!S.me||S.me.status!=="active"||S.me.tour_done_at) return true; try{ return localStorage.getItem(tourKey())==="1"; }catch(e){ return false; } }
function markTourDone(){ if(!S.me) return; const now=new Date().toISOString(); S.me.tour_done_at=S.me.tour_done_at||now;
  try{ localStorage.setItem(tourKey(),"1"); }catch(e){}
  sb.from("profiles").update({tour_done_at:now}).eq("id",S.me.id).then(()=>{},()=>{}); }
function openTour(){
  if(document.querySelector(".tour")) return;
  let i=0; const v=document.createElement("div"); v.className="tour"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true"); v.setAttribute("aria-label","Visite guidée");
  const close=()=>{ markTourDone(); v.remove(); removeEventListener("keydown",key); };
  const key=e=>{ if(e.key==="Escape") close(); else if(e.key==="ArrowRight"&&i<TOUR.length-1){ i++; paint(); } else if(e.key==="ArrowLeft"&&i>0){ i--; paint(); } };
  const paint=()=>{ const st=TOUR[i], last=i===TOUR.length-1;
    v.innerHTML=`<div class="tourbox"><button type="button" class="linkbtn tourskip" id="t-skip">${last?"Fermer":"Passer"}</button>
     <div class="touric ${st.ic==="alert"?"warn":""}">${IC[st.ic]||IC.bell}</div>
     <h2>${esc(st.t)}</h2><p>${esc(st.x)}</p>
     <div class="tourdots" aria-hidden="true">${TOUR.map((_,k)=>`<span class="${k===i?"on":""}"></span>`).join("")}</div>
     <p class="hint tourstep">Étape ${i+1} sur ${TOUR.length}</p>
     <div class="btnrow">${i?`<button type="button" class="btn ghost" id="t-prev">Précédent</button>`:""}<button type="button" class="btn" id="t-next">${last?"C'est parti":"Suivant"}</button></div>
     ${last?`<p class="hint">Vous pouvez revoir cette visite à tout moment : bouton Aide (?) en haut de l'écran.</p>`:""}</div>`;
    v.querySelector("#t-skip").onclick=close;
    const pv=v.querySelector("#t-prev"); if(pv) pv.onclick=()=>{ i--; paint(); };
    v.querySelector("#t-next").onclick=()=>{ if(last) close(); else { i++; paint(); } };
    v.querySelector("#t-next").focus(); };
  paint(); document.body.appendChild(v); addEventListener("keydown",key);
}
const FAQ=[
 ["Puis-je utiliser l'app en cas d'urgence ?","Non. Urgence vitale : appelez le 112. Pour une question urgente pendant les heures d'ouverture, appelez le centre au 02 781 18 75."],
 ["Dans combien de temps aurai-je une réponse ?","À la fin de chaque demande, vous indiquez pour quand vous souhaitez une réponse. L'équipe décide ensuite du délai en fonction du contenu de votre demande : en général dans les 24 heures pour « Le plus tôt possible » et dans les 72 heures pour « Dans les prochains jours ». Ces délais comptent uniquement les heures d'ouverture du centre."],
 ["Qui lit mes messages ?","Uniquement l'équipe du centre : le prestataire concerné et le secrétariat. Vos données restent en Europe, sont protégées et ne sont jamais vendues."],
 ["Comment prendre rendez-vous ?","Touchez « Demander un rendez-vous », choisissez la consultation et le motif. Le secrétariat vous répond dans la conversation avec une proposition. Vous pouvez aussi réserver en ligne sur Rosa (rosa.be)."],
 ["Pourquoi ma demande est-elle passée par le secrétariat ?","Certains prestataires préfèrent que les demandes passent d'abord par le secrétariat. C'est aussi le cas si vous n'avez encore jamais consulté ce prestataire. Le secrétariat lit votre demande et la transmet à la bonne personne."],
 ["Comment renouveler un médicament ?","Touchez « Renouveler un médicament », tapez les premières lettres du nom, choisissez la boîte, puis envoyez. Si le médecin accepte, votre pharmacien retrouve la prescription avec votre carte d'identité. Vos médicaments déjà accordés apparaissent sur l'accueil : un bouton permet de les redemander."],
 ["Comment envoyer une photo, un document ou un message vocal ?","Dans une conversation : le trombone pour une photo ou un PDF, l'icône de scanner pour photographier un document papier, et le micro pour un message vocal. Pour le vocal : touchez le micro une fois, parlez, puis touchez ➤ pour envoyer."],
 ["Comment faire une demande pour mon enfant ?","Dans Mon compte → Ma famille, ajoutez votre enfant de moins de 16 ans. Après validation par le centre, choisissez son prénom au début de chaque demande."],
 ["Comment être prévenu d'une réponse ?","Par e-mail (sans aucune information médicale) et par notification sur votre téléphone. Réglez-les dans Notifications (la cloche). Sur iPhone, ajoutez d'abord l'app à l'écran d'accueil."],
 ["Une conversation a disparu, pourquoi ?","Pour protéger vos données, les conversations sont effacées 15 jours après leur clôture. Vous recevez un rappel 2 jours avant : ouvrez-la et touchez « Enregistrer la conversation (PDF) » si vous souhaitez la garder."],
 ["Comment changer la langue de l'app ?","Dans Mon compte, rubrique « Langue de l'application ». Les messages du centre restent écrits en français."],
 ["J'ai oublié mon mot de passe","Sur l'écran de connexion, touchez « Mot de passe oublié ? » et suivez le lien reçu par e-mail."],
 ["Comment supprimer mon compte ?","Dans Mon compte, rubrique « Mes données ». Vous pouvez aussi y télécharger une copie de vos données."]
];
function patientHelp(a){
  a.innerHTML=`<div class="convhead"><button class="back" id="back" aria-label="Retour">${IC.back}</button><div><h2>Aide</h2><small>Questions fréquentes</small></div></div>
  <section class="card helptour"><h3>Visite guidée</h3><p class="hint">Revoyez en une minute ce que l'app peut faire pour vous.</p><button class="btn" id="tourgo">Revoir la visite guidée</button></section>
  <div class="faqlist">${FAQ.map(([q,r])=>`<details class="faq"><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join("")}</div>
  <section class="card helpcontact"><h3>Une autre question ?</h3><p>Appelez le secrétariat pendant les heures d'ouverture du centre : <a href="tel:+3227811875" translate="no">02 781 18 75</a></p><p class="hint">Urgence vitale : appelez le 112.</p></section>`;
  $("#back").onclick=()=>{S.screen="home";render()};
  $("#tourgo").onclick=()=>openTour();
}
function patientAccount(a){
  const m=S.me;
  a.innerHTML=`<div class="convhead"><button class="back" id="back" aria-label="Retour">${IC.back}</button><div><h2>Mon compte</h2><small>${esc(S.session.user.email)}</small></div></div>
  <button type="button" class="absrow helprow" data-cs-help>${IC.help}<span>Aide et questions fréquentes</span>${IC.chev||"›"}</button>
  <section class="card langcard"><h3>Langue de l'application</h3><p class="hint">Les messages restent écrits par le centre en français.</p>${langPickerHTML()}</section>
  ${textSizeHTML()}
  ${photoCardHTML("Facultatif. Visible uniquement par vous et par l'équipe du centre, pour vous reconnaître.")}
  ${m.status==="active"?familyCardHTML():""}
  ${contactsCardHTML()}
  <form class="form acct" id="acctform" style="margin-top:12px">
   <div class="row2"><label class="fld" for="a-first">Prénom<input id="a-first" value="${esc(m.first_name)}"></label><label class="fld" for="a-last">Nom<input id="a-last" value="${esc(m.last_name)}"></label></div>
   <div class="row2"><label class="fld" for="a-birth">Date de naissance<input id="a-birth" type="date" value="${esc(m.birth_date||"")}"></label><label class="fld" for="a-phone">Téléphone<input id="a-phone" type="tel" value="${esc(m.phone)}"></label></div>
   <button class="btn" type="submit">Enregistrer</button>
  </form>
  <div style="margin-top:14px">${PRIVACY}</div>
  <section class="card mydata"><h3>Mes données</h3>
   <p class="hint">Téléchargez une copie de vos données (compte, demandes, messages, médicaments), ou supprimez votre compte et tout son contenu.</p>
   <div class="btnrow"><button class="btn ghost" id="export">Télécharger mes données</button><button class="btn ghost danger" id="delask">Supprimer mon compte</button></div>
   <div id="delbox" hidden><p><b>Suppression définitive.</b> Votre compte, vos demandes, messages, pièces jointes et médicaments enregistrés dans l'app seront effacés. Cela ne supprime pas votre dossier médical au centre, conservé selon la loi.</p>
    <label class="fld" for="delconf">Pour confirmer, tapez SUPPRIMER<input id="delconf" autocomplete="off"></label>
    <div class="btnrow"><button class="btn danger" id="delgo" disabled>Supprimer définitivement</button><button class="linkbtn" id="delno">Annuler</button></div></div>
  </section>
  <div class="btnrow" style="margin-top:18px"><button class="btn ghost" id="logout">Se déconnecter</button></div>
  ${versionHTML()}`;
  $("#back").onclick=()=>{S.cdraft=null;S.screen="home";render()};
  $("#logout").onclick=logout;
  $("#export").onclick=exportMyData;
  $("#delask").onclick=()=>{ $("#delbox").hidden=false; $("#delconf").focus(); };
  $("#delno").onclick=()=>{ $("#delbox").hidden=true; $("#delconf").value=""; $("#delgo").disabled=true; };
  $("#delconf").oninput=e=>{ $("#delgo").disabled=e.target.value.trim().toUpperCase()!=="SUPPRIMER"; };
  $("#delgo").onclick=async e=>{ e.target.disabled=true;
    if(await run(()=>sb.rpc("delete_my_account"))){ await logout("Votre compte et ses données ont été supprimés."); } else e.target.disabled=false; };
  bindPhotoCard(); bindFamily(); bindLangPicker(); bindContacts(); bindTextSize();
  $("#acctform").onsubmit=async e=>{ e.preventDefault();
    const upd={first_name:$("#a-first").value.trim(),last_name:$("#a-last").value.trim(),birth_date:$("#a-birth").value||null,phone:$("#a-phone").value.trim()};
    if(await run(()=>sb.from("profiles").update(upd).eq("id",m.id),"Enregistré")) Object.assign(S.me,upd); };
}

/* ----- Autres contacts (Mon compte) : autre numéro, personne à contacter, informations pratiques ----- */
const LIENS=["Conjoint(e)","Parent","Enfant","Frère ou sœur","Ami(e) ou voisin(e)","Aide ou soignant(e) à domicile","Autre"];
function contactsCardHTML(){
  const C=S.cdraft||(S.cdraft={list:JSON.parse(JSON.stringify(S.me.extra_contacts||[])),note:S.me.contact_note||""});
  const row=(c,i)=>`<div class="crow" data-ci="${i}">
    <label class="fld">Type<select data-cf="type"><option value="tel" ${c.type!=="personne"?"selected":""}>Autre numéro de téléphone</option><option value="personne" ${c.type==="personne"?"selected":""}>Personne à contacter</option></select></label>
    ${c.type==="personne"?`<div class="row2"><label class="fld">Nom de la personne<input data-cf="nom" maxlength="80" value="${esc(c.nom||"")}" autocomplete="off"></label>
    <label class="fld">Lien<select data-cf="lien">${LIENS.map(l=>`<option value="${esc(l)}" ${c.lien===l?"selected":""}>${esc(l)}</option>`).join("")}</select></label></div>`:""}
    <div class="crow2"><label class="fld">Téléphone<input data-cf="tel" type="tel" maxlength="30" value="${esc(c.tel||"")}" placeholder="04xx xx xx xx"></label><button type="button" class="linkbtn" data-crm="${i}">Retirer</button></div></div>`;
  return `<section class="card contacts" id="contacts"><h3>Autres contacts</h3>
   <p class="hint">Facultatif. Un autre numéro où vous joindre, ou une personne à prévenir. Visible uniquement par l'équipe du centre.</p>
   ${C.list.map(row).join("")}
   ${C.list.length<5?`<button type="button" class="btn ghost" id="c-add">+ Ajouter un numéro ou une personne</button>`:`<p class="hint">5 contacts maximum.</p>`}
   <label class="fld" style="margin-top:12px">Informations pratiques<textarea id="c-note" rows="2" maxlength="500" placeholder="Ex. joignable seulement après 17 h, parle mieux néerlandais, sonner chez le voisin…">${esc(C.note)}</textarea></label>
   <p class="hint">N'indiquez pas d'informations médicales ici.</p>
   <div class="btnrow"><button type="button" class="btn" id="c-save">Enregistrer les contacts</button></div></section>`;
}
function bindContacts(){
  const C=S.cdraft; if(!$("#contacts")) return;
  const again=()=>{ render(); setTimeout(()=>$("#contacts")?.scrollIntoView({block:"start"}),30); };
  $$("#contacts [data-ci]").forEach(r=>{ const c=C.list[+r.dataset.ci];
    r.querySelectorAll("[data-cf]").forEach(f=>{ f.oninput=f.onchange=()=>{ c[f.dataset.cf]=f.value; if(f.dataset.cf==="type"){ if(c.type==="personne"&&!c.lien) c.lien=LIENS[0]; again(); } }; }); });
  $$("[data-crm]").forEach(b=>b.onclick=()=>{ C.list.splice(+b.dataset.crm,1); again(); });
  const ad=$("#c-add"); if(ad) ad.onclick=()=>{ C.list.push({type:"tel",tel:""}); again(); };
  $("#c-note").oninput=e=>{ C.note=e.target.value; };
  $("#c-save").onclick=async()=>{
    const list=C.list.map(c=>c.type==="personne"?{type:"personne",nom:(c.nom||"").trim(),lien:c.lien||"Autre",tel:(c.tel||"").trim()}:{type:"tel",tel:(c.tel||"").trim()});
    if(list.some(c=>!c.tel)) return toast("Indiquez un numéro de téléphone pour chaque ligne.");
    if(list.some(c=>c.type==="personne"&&!c.nom)) return toast("Indiquez le nom de chaque personne à contacter.");
    const upd={extra_contacts:list,contact_note:C.note.trim()||null};
    if(await run(()=>sb.from("profiles").update(upd).eq("id",S.me.id),"Contacts enregistrés")){ Object.assign(S.me,upd); S.cdraft=null; again(); } };
}

/* ----- Ma famille (Mon compte) ----- */
function familyCardHTML(){
  const F=S.family||{parents:[],children:[],invites:[],sent:[]}, others=(F.parents||[]).filter(p=>!p.me);
  const st=c=>c.status==="pending"?`<span class="pill st-encours">En attente de validation</span>`:c.status==="blocked"?`<span class="pill st-traite">Non validé</span>`:c.age>=CHILD_MAX_AGE?`<span class="pill st-traite">${c.age} ans : propre compte</span>`:`<span class="pill st-reply">Validé</span>`;
  return `<section class="card family" id="family"><h3>Ma famille</h3>
   <p class="hint">Ajoutez vos enfants de moins de 16 ans pour faire des demandes en leur nom (rendez-vous, questions, prescriptions…). Le centre vérifie chaque enfant avant la première demande. À 16 ans, l'enfant crée son propre compte.</p>
   ${(F.invites||[]).map(i=>`<div class="famnote"><b>${esc(i.from||"Un parent")}</b> vous invite à suivre ensemble les demandes de vos enfants.<div class="btnrow"><button class="btn" data-inv="${i.id}" data-acc="1">Accepter</button><button class="btn ghost" data-inv="${i.id}" data-acc="0">Refuser</button></div></div>`).join("")}
   ${famKids().length?`<div class="list">${famKids().map(c=>`<div class="medrow"><div class="ic">${IC.user}</div><div><b>${esc(c.first_name+" "+c.last_name)}</b><small>Né(e) le ${fmtDate(c.birth_date)}</small></div><div class="acts">${st(c)}<button class="linkbtn" style="font-size:12px;color:var(--muted)" data-rmkid="${c.id}">Retirer</button></div></div>`).join("")}</div>`:""}
   <details class="famadd" ${famKids().length?"":"open"}><summary>Ajouter un enfant</summary>
    <div class="row2"><label class="fld">Prénom<input id="k-first" autocomplete="off"></label><label class="fld">Nom<input id="k-last" value="${esc(S.me.last_name||"")}" autocomplete="off"></label></div>
    <label class="fld">Date de naissance<input id="k-birth" type="date"></label>
    <div class="btnrow"><button class="btn" id="k-add">Ajouter</button></div></details>
   <h4>Autre parent</h4>
   ${others.length?`<p>${others.map(p=>`<b>${esc(`${p.first_name||""} ${p.last_name||""}`.trim()||"Autre parent")}</b>`).join(", ")} suit aussi les demandes des enfants.</p><button class="linkbtn" id="f-leave">Quitter cette famille</button>`
   :`<p class="hint">L'autre parent peut suivre les demandes des enfants avec son propre compte (validé). Indiquez l'adresse e-mail de son compte : il recevra une invitation.</p>
    <div class="row2"><label class="fld">E-mail de l'autre parent<input id="f-email" type="email" autocomplete="off"></label><div class="btnrow" style="align-self:end"><button class="btn ghost" id="f-invite">Inviter</button></div></div>
    ${(F.sent||[]).length?`<p class="hint">Invitation envoyée ${fmt(F.sent[F.sent.length-1].created_at)}, en attente de réponse.</p>`:""}`}
  </section>`;
}
function bindFamily(){
  if(!$("#family")) return;
  const reload=async()=>{ await loadPatient(); render(); setTimeout(()=>$("#family")?.scrollIntoView({block:"start"}),50); };
  $("#k-add").onclick=async e=>{ const f=$("#k-first").value.trim(), l=$("#k-last").value.trim(), b=$("#k-birth").value;
    if(!f||!l||!b) return toast("Indiquez le prénom, le nom et la date de naissance.");
    e.target.disabled=true;
    if(await run(()=>sb.rpc("add_child",{p_first:f,p_last:l,p_birth:b}),"Enfant ajouté : le centre va le valider")) await reload(); else e.target.disabled=false; };
  $$("[data-rmkid]").forEach(b=>b.onclick=async()=>{ const c=famKids().find(x=>x.id===b.dataset.rmkid);
    if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent=`Retirer ${c?.first_name||""} ? Confirmer`; b.style.color="var(--danger)"; return; }
    if(await run(()=>sb.rpc("remove_child",{p_child:b.dataset.rmkid}),"Retiré de votre famille")) await reload(); });
  $$("[data-inv]").forEach(b=>b.onclick=async()=>{ const ok=b.dataset.acc==="1";
    if(await run(()=>sb.rpc("respond_family_invite",{p_id:+b.dataset.inv,p_accept:ok}),ok?"Vous suivez maintenant les demandes de vos enfants":"Invitation refusée")) await reload(); });
  const inv=$("#f-invite"); if(inv) inv.onclick=async()=>{ const em=$("#f-email").value.trim(); if(!/^\S+@\S+\.\S+$/.test(em)) return toast("Indiquez une adresse e-mail valide.");
    const r=await run(()=>sb.rpc("invite_coparent",{p_email:em})); if(r){ toast(r.data||"Invitation envoyée"); await reload(); } };
  const lv=$("#f-leave"); if(lv) lv.onclick=async()=>{ if(lv.dataset.sure!=="1"){ lv.dataset.sure="1"; lv.textContent="Vous ne verrez plus les demandes des enfants. Confirmer ?"; lv.style.color="var(--danger)"; return; }
    if(await run(()=>sb.rpc("leave_family"),"Vous avez quitté la famille")) await reload(); };
}

// Droit d'accès et de portabilité : copie lisible de toutes les données du compte
async function exportMyData(){
  await loadPatient();
  const strip=r=>({ demande:r.id, type:TYPES[r.type]?.label||r.type, envoyee_le:r.created_at, statut:stLabelP(r), cloturee_le:r.closed_at, effacee_le:r.purged_at,
    destinataire:reqWho(r), reponses:Object.fromEntries(Object.entries(r.answers||{}).filter(([k])=>!HIDDEN_KEYS.has(k)).map(([k,v])=>[LABELS[k]||k,v])),
    medicaments:(r.request_items||[]).map(i=>({medicament:i.label,boites:i.quantity||1,decision:i.decision})),
    messages:msgsOf(r).map(m=>({de:m.from_patient?"Vous":m.author_label,le:m.created_at,texte:m.body,pieces_jointes:(m.attachments||[]).map(a=>({type:a.kind,nom:a.name,taille_octets:a.size}))})) });
  const data={ exporte_le:new Date().toISOString(), source:"Application du Centre Médical Prince de Liège (app.cmpl.be)",
    compte:{ email:S.session.user.email, prenom:S.me.first_name, nom:S.me.last_name, date_de_naissance:S.me.birth_date, telephone:S.me.phone,
      autres_contacts:S.me.extra_contacts||[], informations_pratiques:S.me.contact_note||null, cree_le:S.me.created_at, valide_le:S.me.approved_at,
      photo_de_profil:AV.get(S.me.id)?"oui (visible dans Mon compte)":"non", notifications_annonces:S.me.news_push, choix_annonces_le:S.me.news_choice_at },
    ma_famille:S.family?{parents:(S.family.parents||[]).map(p=>`${p.first_name||""} ${p.last_name||""}`.trim()),enfants:famKids().map(c=>({prenom:c.first_name,nom:c.last_name,date_de_naissance:c.birth_date,statut:c.status}))}:null,
    demandes:S.reqs.map(r=>({...strip(r),pour:r.child_id?childFirst(r.child_id):"moi"})), mes_medicaments:S.meds.map(m=>({medicament:m.label,derniere_prescription:m.last_granted_at,fois:m.times_granted})),
    notifications:S.notifs.map(n=>({titre:n.title,texte:n.body,le:n.created_at,lue_le:n.read_at})),
    note:"Le contenu des photos, documents et messages vocaux peut être ouvert dans l'app et enregistré depuis chaque conversation." };
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const a=document.createElement("a"); a.href=url; a.download=`mes-donnees-cmpl-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000); toast("Vos données ont été téléchargées");
}

/* ----- formulaire guidé ----- */
function startFlow(k, preset, pour){ (S.flowFiles||[]).forEach(f=>f.url&&URL.revokeObjectURL(f.url)); S.flowFiles=[]; S.flow=k; S.answers=pour&&kids().length?{pour}:{}; S.drug={q:"",basket:preset?[...preset]:[],manual:false}; S.screen="flow"; render(); scrollTo(0,0); }
const activeSteps = () => FLOWS[S.flow].filter(s=>!s.when||s.when(S.answers));
function patientFlow(a){
  const steps=activeSteps();
  let html=`<div class="convhead"><button class="back" id="back" aria-label="Retour">${IC.back}</button><div><h2>${TYPES[S.flow].title}</h2><small>Questions guidées</small></div></div><div class="thread">`;
  let current=null;
  for(const s of steps){
    if(s.kind==="note"){ continue; }
    html+=`<div class="bub bot">${esc(qText(s))}</div>`;
    if(s.id in S.answers){ html+=`<div class="bub me">${esc(S.answers[s.id]||"(pas de précision)")}</div><button class="edit" data-edit="${s.id}">Modifier</button>`; }
    else { current=s; break; }
  }
  if(!current) steps.filter(s=>s.kind==="note").forEach(s=>{ const q=typeof s.q==="function"?s.q(S.answers):s.q; if(q) html+=`<div class="bub bot note">${esc(q)}</div>`; });
  html+=`</div>`;
  html+= current ? answerUI(current) : summaryUI();
  a.innerHTML=html;
  $("#back").onclick=()=>{S.screen="home";render()};
  $$("[data-edit]").forEach(b=>b.onclick=()=>{ const ids=steps.map(s=>s.id); ids.slice(ids.indexOf(b.dataset.edit)).forEach(id=>delete S.answers[id]); render(); });
  if(current) bindAnswer(current); else bindSummary();
  const last=a.querySelector(".answer,.summary"); if(last) last.scrollIntoView({block:"nearest"});
}
function filesUI(){
  const F=S.flowFiles;
  return `<div class="answer"><div class="filelist">${F.length?F.map((f,i)=>`<div class="fileitem">${f.kind==="image"?`<img src="${f.url}" alt="">`:IC.doc}<span><b>${esc(f.name)}</b><small>${f.pages?f.pages+" page"+(f.pages>1?"s":"")+" · ":""}${kb(f.blob.size)}</small></span><button type="button" class="linkbtn" data-frm="${i}">Retirer</button></div>`).join(""):`<p class="hint" style="margin:0">Aucun fichier pour l'instant.</p>`}</div>
   <input type="file" id="ffile" accept="image/*,application/pdf" hidden>
   <div class="btnrow">${F.length<5?`<button type="button" class="btn ghost" id="fscan">${IC.scan} Scanner</button><button type="button" class="btn ghost" id="fpick">${IC.clip} Photo ou PDF</button>`:`<p class="hint">5 fichiers maximum.</p>`}</div>
   <div class="btnrow"><button class="btn" id="fnext" ${F.length?"":"disabled"}>Continuer${F.length>1?` avec ${F.length} fichiers`:""}</button></div></div>`;
}
function answerUI(s){
  if(s.kind==="files") return filesUI();
  if(s.kind==="drug") return drugUI();
  if(s.kind==="choice") return `<div class="answer"><div class="opts">${optsOf(s).map(o=>`<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`;
  if(s.kind==="multi") return `<div class="answer"><p class="hint" style="margin:0 0 8px">Plusieurs choix possibles</p><div class="opts">${optsOf(s).map(o=>`<button class="opt multi" aria-pressed="false" data-m="${esc(o)}"><span class="box" aria-hidden="true"></span>${esc(o)}</button>`).join("")}</div><div class="btnrow"><button class="btn" id="mnext" disabled>Continuer</button></div></div>`;
  return `<div class="answer"><label for="ta" class="hint">${s.optional?"Facultatif":"Votre réponse"}</label><textarea id="ta" rows="3" maxlength="2000" placeholder="${esc(s.placeholder||"")}"></textarea><div class="btnrow"><button class="btn" id="tnext" ${s.optional?"":"disabled"}>Continuer</button></div></div>`;
}
function bindAnswer(s){
  if(s.kind==="files"){ const F=S.flowFiles, inp=$("#ffile");
    $$("[data-frm]").forEach(b=>b.onclick=()=>{ const f=F.splice(+b.dataset.frm,1)[0]; if(f&&f.url) URL.revokeObjectURL(f.url); render(); });
    const pk=$("#fpick"); if(pk) pk.onclick=()=>inp.click();
    inp.onchange=async()=>{ const f=inp.files[0]; inp.value=""; if(!f) return; try{ F.push(await prepFile(f,"flow")); render(); }catch(e){ toast(e.message); } };
    const sc=$("#fscan"); if(sc) sc.onclick=()=>openScanner(pend=>{ F.push(pend); render(); });
    $("#fnext").onclick=()=>{ S.answers[s.id]=F.map(f=>f.name).join(", "); render(); };
    return; }
  if(s.kind==="drug") return bindDrug(s);
  if(s.kind==="choice") $$("[data-o]").forEach(b=>b.onclick=()=>{ const v=b.dataset.o;
    if(s.jump&&s.jump[v]){ toast("On passe à la demande de rendez-vous"); startFlow(s.jump[v]); return; }
    S.answers[s.id]=v; render(); });
  if(s.kind==="multi"){ const btns=$$("[data-m]"), next=$("#mnext");
    btns.forEach(b=>b.onclick=()=>{ const on=b.getAttribute("aria-pressed")!=="true"; b.setAttribute("aria-pressed", on);
      // « Peu importe » exclut les autres choix, et inversement
      if(on&&s.exclusive) btns.forEach(x=>{ if(x!==b&&(b.dataset.m===s.exclusive||x.dataset.m===s.exclusive)) x.setAttribute("aria-pressed","false"); });
      next.disabled=!btns.some(x=>x.getAttribute("aria-pressed")==="true"); });
    next.onclick=()=>{ S.answers[s.id]=btns.filter(b=>b.getAttribute("aria-pressed")==="true").map(b=>b.dataset.m).join(", "); render(); }; }
  if(s.kind==="text"){ const ta=$("#ta"), n=$("#tnext"); ta.focus({preventScroll:true});
    ta.oninput=()=>{ if(!s.optional) n.disabled=!ta.value.trim(); }; n.onclick=()=>{ S.answers[s.id]=ta.value.trim(); render(); }; }
}
const MAXBOX=6;
const boxes = l => Math.min(MAXBOX, Math.max(1, (S.drug.qty||{})[l]||1));
const boxLine = l => `${l} · ${boxes(l)} boîte${boxes(l)>1?"s":""}`;
const qtyText = n => n>1?` · ${n} boîtes`:` · 1 boîte`;
function drugUI(){
  const D=S.drug; let h=`<div class="answer"><div class="drugbox">`;
  if(S.meds.length&&!D.manual){
    h+=`<p class="hint" style="margin:0">Vos médicaments</p><div class="mymeds">${S.meds.map(m=>`<button class="opt" aria-pressed="${D.basket.includes(m.label)}" data-my="${esc(m.label)}"><span class="box"></span>${esc(m.label)}</button>`).join("")}</div><div class="divider">ou un autre médicament</div>`;
  }
  const extra=D.basket.filter(b=>!S.meds.some(m=>m.label===b));
  if(extra.length) h+=`<div class="basket">${extra.map(b=>`<div class="chip"><span>${esc(b)}</span><button data-rm="${esc(b)}">Retirer</button></div>`).join("")}</div>`;
  if(D.manual){
    h+=`<label for="dman" class="hint">Écrivez le nom tel qu'il figure sur la boîte</label><input type="text" id="dman" maxlength="120" placeholder="Ex. nom, dosage, nombre de comprimés"><div class="btnrow"><button class="btn ghost" id="dmadd" disabled>Ajouter</button><button class="linkbtn" id="dsearch">Revenir à la recherche</button></div>`;
  } else {
    h+=`<label for="dq" class="hint">${D.basket.length?"Ajouter un autre médicament":"Rechercher un médicament"} (nom de la boîte ou molécule)</label>
    <div class="search">${IC.search}<input type="text" id="dq" autocomplete="off" placeholder="Ex. colch, amlo 5, Asaflow…" value="${esc(D.q)}"></div>
    <ul class="sugg" id="sugg" hidden></ul><button class="linkbtn" id="dmanual">Je ne trouve pas mon médicament</button>`;
  }
  if(D.basket.length) h+=`<div class="qtys"><p class="hint" style="margin:0">Nombre de boîtes souhaité</p>${D.basket.map((b,i)=>{ const n=boxes(b); return `<div class="qrow"><span>${esc(b)}</span><div class="stepper" role="group" aria-label="Nombre de boîtes"><button type="button" data-qm="${i}" aria-label="Une boîte de moins" ${n<=1?"disabled":""}>−</button><b aria-live="polite">${n} boîte${n>1?"s":""}</b><button type="button" data-qp="${i}" aria-label="Une boîte de plus" ${n>=MAXBOX?"disabled":""}>+</button></div></div>`; }).join("")}<p class="hint" style="margin:0">Le médecin décide du nombre de boîtes prescrites.</p></div>`;
  h+=`<p class="src">Liste officielle des médicaments disponibles en Belgique (CBIP).</p></div><div class="btnrow"><button class="btn" id="dnext" ${D.basket.length?"":"disabled"}>Continuer${D.basket.length>1?` avec ${D.basket.length} médicaments`:""}</button></div></div>`;
  return h;
}
function bindDrug(s){
  const D=S.drug, again=()=>{ render(); const f=$("#dq")||$("#dman"); if(f) f.focus({preventScroll:true}); };
  $$("[data-rm]").forEach(b=>b.onclick=()=>{ D.basket=D.basket.filter(x=>x!==b.dataset.rm); again(); });
  $$("[data-my]").forEach(b=>b.onclick=()=>{ const l=b.dataset.my; D.basket=D.basket.includes(l)?D.basket.filter(x=>x!==l):[...D.basket,l]; render(); });
  $("#dnext").onclick=()=>{ S.answers[s.id]=D.basket.map(boxLine).join(" ; "); render(); };
  D.qty=D.qty||{};
  $$("[data-qm]").forEach(b=>b.onclick=()=>{ const l=D.basket[+b.dataset.qm]; D.qty[l]=Math.max(1,boxes(l)-1); render(); });
  $$("[data-qp]").forEach(b=>b.onclick=()=>{ const l=D.basket[+b.dataset.qp]; D.qty[l]=Math.min(MAXBOX,boxes(l)+1); render(); });
  if(D.manual){ const i=$("#dman"), ad=$("#dmadd"); i.oninput=()=>ad.disabled=!i.value.trim();
    const add=()=>{ if(!i.value.trim()) return; D.basket.push(i.value.trim()+" (saisi par le patient)"); D.manual=false; again(); };
    ad.onclick=add; i.onkeydown=e=>{ if(e.key==="Enter"){ e.preventDefault(); add(); } }; $("#dsearch").onclick=()=>{ D.manual=false; again(); }; return; }
  const inp=$("#dq"), ul=$("#sugg"); let hl=-1, res=[], timer;
  const pick=r=>{ if(!D.basket.includes(r.label)) D.basket.push(r.label); D.q=""; again(); };
  const paint=()=>{ ul.querySelectorAll("button").forEach((b,i)=>b.classList.toggle("hl",i===hl)); };
  const draw=async()=>{ D.q=inp.value; const q=inp.value, my=++drugSeq;
    if(norm(q).replace(/\s/g,"").length<2){ ul.hidden=true; res=[]; return; }
    ul.hidden=false; ul.innerHTML=`<li class="empty">Recherche…</li>`;
    const r=await searchDrugs(q); if(my!==drugSeq) return;
    if(r===null){ ul.innerHTML=`<li class="empty">La recherche n'est pas disponible pour l'instant. Utilisez « Je ne trouve pas mon médicament ».</li>`; return; }
    res=r; hl=res.length?0:-1;
    const w0=norm(q).trim().split(/\s+/)[0];
    ul.innerHTML=res.length?res.map((x,i)=>`<li><button data-i="${i}" class="${i===hl?"hl":""}"><span class="nm">${hlite(x.label,w0)}</span><span class="fm">${hlite(x.generic,w0)}</span></button></li>`).join(""):`<li class="empty">Aucun résultat. Vérifiez l'orthographe ou utilisez « Je ne trouve pas mon médicament ».</li>`;
    ul.querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>pick(res[+b.dataset.i])); };
  inp.oninput=()=>{ clearTimeout(timer); timer=setTimeout(draw,250); };
  inp.onkeydown=e=>{ if(!res.length) return;
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); hl=(hl+(e.key==="ArrowDown"?1:-1)+res.length)%res.length; paint(); }
    if(e.key==="Enter"&&hl>=0){ e.preventDefault(); pick(res[hl]); } };
  $("#dmanual").onclick=()=>{ D.manual=true; again(); };
  if(D.q) draw();
}
function summaryUI(){
  const now=new Date(), open=isOpen(now);
  const timing = open ? `<p class="route">Urgence vitale : appelez le 112.</p>`
    : `<div class="urgent">${IC.alert}<div><strong>Le centre est fermé.</strong> Votre demande sera vue à partir de ${fmtWhen(nextOpen(now))}.<br>Urgence vitale : appelez le 112.</div></div>`;
  return `<div class="summary"><h3 style="font-size:17px;margin-bottom:10px">Vérifiez votre demande</h3><dl>${answersDL(S.answers)}</dl>${timing}<div class="btnrow"><button class="btn" id="send">Envoyer la demande</button></div></div>`;
}
function bindSummary(){
  $("#send").onclick=async e=>{
    e.target.disabled=true;
    const ans={...S.answers};
    // prestataire choisi (ou seul prestataire de la spécialité)
    let prov = ans.medecin ? P.fromLabel(ans.medecin) : null;
    if(!prov && ans.specialite && P.of(ans.specialite).length===1) prov=P.of(ans.specialite)[0];
    if(prov) ans.provider_id=prov.id;
    if(S.flow==="prescription") ans.medicaments=S.drug.basket.map(l=>({label:l,boites:boxes(l)}));
    const kid=kidFromPour(ans.pour);
    const row={type:S.flow, answers:ans}; if(kid) row.child_id=kid.id;
    const r = await run(()=>sb.from("requests").insert(row).select(REQ_SELECT).single());
    if(!r){ e.target.disabled=false; return; }
    S.lastSent=r.data; S.reqs.unshift(r.data);
    if(S.flowFiles&&S.flowFiles.length){ e.target.textContent="Envoi des fichiers…";
      for(const f of S.flowFiles){ const ok=await uploadAtt(r.data.id,f,null); if(!ok){ toast("Un fichier n'a pas pu être envoyé : ajoutez-le dans la conversation."); break; } }
      S.flowFiles=[]; await loadPatient(); }
    openRequest(r.data.id); showSent(r.data);
    loadPatient().then(()=>{ if(S.screen==="req") render(); });
  };
}
/* ---------- après l'envoi : « C'est envoyé ! » ---------- */
/* ----- Photos du centre (carrousel de l'accueil des patients ; gérées par l'administrateur) ----- */
async function loadPhotos(){ const {data,error}=await sb.from("centre_photos").select("*").order("sort").order("id"); S.photos=error?null:(data||[]); }
const PI={ home:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>' };
const MOON_SVG = `<svg class="sun moon" viewBox="0 0 64 64" aria-hidden="true"><path d="M40 10a22 22 0 1 0 14 34A18 18 0 0 1 40 10z" fill="#ffd977"/><circle cx="16" cy="14" r="2" fill="#ffd977"/><circle cx="52" cy="22" r="1.6" fill="#ffd977"/><circle cx="10" cy="40" r="1.4" fill="#ffd977"/></svg>`;
const hmin = m => `${Math.floor(m/60)} h${m%60?" "+String(m%60).padStart(2,"0"):""}`;
function openStatusText(){
  const now=new Date(); if(!Object.keys(S.hours||{}).length) return "";
  if(isOpen(now)) return `Le centre est ouvert jusqu'à ${hmin(S.hours[now.getDay()][1])}`;
  const t=nextOpen(now); if(t===now) return "Le centre est fermé";
  const d0=new Date(now.getFullYear(),now.getMonth(),now.getDate()), d1=new Date(t.getFullYear(),t.getMonth(),t.getDate()), diff=Math.round((d1-d0)/864e5), at=hmin(t.getHours()*60+t.getMinutes());
  return diff===0?`Le centre est fermé – ouvre aujourd'hui à ${at}`:diff===1?`Le centre est fermé – ouvre demain à ${at}`:`Le centre est fermé – ouvre ${t.toLocaleDateString(LOC,{weekday:"long"})} à ${at}`;
}
function photosCarouselHTML(){
  const L=S.photos||[]; if(!L.length) return "";
  return `<div class="car" id="car" aria-roledescription="carrousel" aria-label="Photos du centre">
   ${L.map((p,i)=>`<figure class="cslide ${i===0?"on":""}" data-cview="${esc(p.url)}" aria-hidden="${i!==0}"><span class="cblur" aria-hidden="true" style="background-image:url('${esc(p.url)}')"></span><img src="${esc(p.url)}" alt="${esc(p.caption||"Photo du centre")}">${p.caption?`<figcaption translate="no" dir="auto">${esc(p.caption)}</figcaption>`:""}</figure>`).join("")}
   ${L.length>1?`<div class="cdots">${L.map((_,i)=>`<button type="button" data-cdot="${i}" aria-label="Photo ${i+1}" aria-current="${i===0}"></button>`).join("")}</div>`:""}</div>`;
}
// diaporama : une photo après l'autre (fondu), toutes les 4 secondes ; glisser du doigt pour changer
let carTimer=null, carIdx=0;
function bindCarousel(){
  clearInterval(carTimer); const car=$("#car"); if(!car) return;
  const slides=[...car.querySelectorAll(".cslide")], n=slides.length; let paused=0;
  if(carIdx>=n) carIdx=0;
  const show=i=>{ carIdx=(i+n)%n; slides.forEach((x,k)=>{ x.classList.toggle("on",k===carIdx); x.setAttribute("aria-hidden",String(k!==carIdx)); });
    $$("[data-cdot]").forEach((d,k)=>d.setAttribute("aria-current",String(k===carIdx))); };
  show(carIdx);
  $$("[data-cdot]").forEach(d=>d.onclick=e=>{ e.stopPropagation(); paused=Date.now(); show(+d.dataset.cdot); });
  let x0=null, moved=false;
  car.addEventListener("pointerdown",e=>{ x0=e.clientX; moved=false; });
  car.addEventListener("pointerup",e=>{ if(x0==null) return; const dx=e.clientX-x0; x0=null;
    if(Math.abs(dx)>40&&n>1){ moved=true; paused=Date.now(); show(carIdx+(dx<0?1:-1)); } });
  car.addEventListener("click",e=>{ if(moved||e.target.closest("[data-cdot]")) return; const f=slides[carIdx]; if(f) openViewer(f.dataset.cview); });
  if(n>1) carTimer=setInterval(()=>{ if(!document.body.contains(car)){ clearInterval(carTimer); return; } if(document.hidden||Date.now()-paused<8000) return; show(carIdx+1); },4000);
}
function photosAdminHTML(){
  const L=S.photos;
  if(L===undefined){ loadPhotos().then(()=>{ if(S.cscreen==="news") render(); }); return ""; }
  if(L===null) return `<section class="card"><h3>Photos de l'accueil des patients</h3><p class="hint">Pas encore activé (migration 047 à exécuter dans Supabase).</p></section>`;
  return `<section class="card phadmin"><h3>Photos de l'accueil des patients <small class="hint">(administrateur)</small></h3>
   <p class="hint">Elles défilent en haut de l'accueil des patients. Façade, salle d'attente, cabinets, équipe… En paysage, <b>jamais de patient reconnaissable</b>. 8 photos au maximum.</p>
   <div class="phlist">${L.map((p,i)=>`<div class="phrow"><img src="${esc(p.url)}" alt=""><div class="phc"><input type="text" maxlength="80" data-phcap="${p.id}" value="${esc(p.caption||"")}" placeholder="Légende (facultative), ex. Notre salle d'attente" aria-label="Légende"></div>
     <div class="phacts"><button type="button" class="cbtn sm" data-phmv="${p.id}:-1" ${i===0?"disabled":""} aria-label="Monter">↑</button><button type="button" class="cbtn sm" data-phmv="${p.id}:1" ${i===L.length-1?"disabled":""} aria-label="Descendre">↓</button><button type="button" class="linkbtn" data-phdel="${p.id}">Retirer</button></div></div>`).join("")||`<p class="hint">Aucune photo pour l'instant.</p>`}</div>
   ${L.length<8?`<label class="btn ghost phadd">＋ Ajouter une photo<input type="file" id="ph-file" accept="image/*" hidden></label>`:""}</section>`;
}
function bindPhotosAdmin(){
  const f=$("#ph-file"); if(f) f.onchange=async()=>{ const x=f.files[0]; if(!x) return; f.disabled=true;
    try{ let im=await shrinkPoster(x); if(im.size>3e6) throw new Error("Image trop lourde (3 Mo maximum).");
      const path=`accueil/${Date.now()}-${Math.random().toString(36).slice(2,8)}.jpg`;
      const up=await sb.storage.from("announcements").upload(path,im,{contentType:im.type||"image/jpeg"}); if(up.error) throw up.error;
      const url=sb.storage.from("announcements").getPublicUrl(path).data.publicUrl;
      if(await run(()=>sb.rpc("add_centre_photo",{p_url:url,p_caption:null}),"Photo ajoutée")){ await loadPhotos(); render(); }
      else await sb.storage.from("announcements").remove([path]);
    }catch(e){ toast("La photo n'a pas pu être ajoutée : "+frError(e)); } f.disabled=false; };
  $$("[data-phcap]").forEach(i=>i.onchange=async()=>{ if(await run(()=>sb.rpc("edit_centre_photo",{p_id:+i.dataset.phcap,p_caption:i.value}),"Légende enregistrée")) await loadPhotos(); });
  $$("[data-phmv]").forEach(b=>b.onclick=async()=>{ const [id,d]=b.dataset.phmv.split(":"); if(await run(()=>sb.rpc("move_centre_photo",{p_id:+id,p_dir:+d}))){ await loadPhotos(); render(); } });
  $$("[data-phdel]").forEach(b=>b.onclick=async()=>{ if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent="Confirmer ?"; b.style.color="var(--danger)"; return; }
    const r=await run(()=>sb.rpc("delete_centre_photo",{p_id:+b.dataset.phdel}),"Photo retirée");
    if(r){ const url=r.data||""; const m=url.split("/announcements/")[1]; if(m) await sb.storage.from("announcements").remove([decodeURIComponent(m)]); await loadPhotos(); render(); } });
}
const SUN_SVG = `<svg class="sun" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="14" fill="#ffc94d"/><g stroke="#ffb020" stroke-width="3.5" stroke-linecap="round"><path d="M32 5v7M32 52v7M5 32h7M52 32h7M13 13l5 5M46 46l5 5M13 51l5-5M46 18l5-5"/></g></svg>`;
function showSent(r){
  const old=$("#sent"); if(old) old.remove();
  const delay=r.priority==="haute"?"Elle sera vue dans les 24 heures (heures d'ouverture).":r.priority==="basse"?"Elle sera vue dès que possible (heures d'ouverture).":"Elle sera vue dans les 72 heures (heures d'ouverture).";
  const conf=["#ffc94d","#f28b6b","#7cc8b8","#b7a3ee","#8fc96a","#6fa8e8"].flatMap((c,i)=>[0,1,2].map(j=>`<i style="background:${c};left:${(i*17+j*31)%92+4}%;animation-delay:${(i*3+j)*0.07}s;--r:${(i*47+j*71)%360}deg"></i>`)).join("");
  document.body.insertAdjacentHTML("beforeend",`<div id="sent" class="sent" role="dialog" aria-modal="true" aria-labelledby="sent-t"><div class="confetti" aria-hidden="true">${conf}</div><div class="sentbox">
    <div class="sentcheck" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
    <h2 id="sent-t">C'est envoyé !</h2>
    <p>Votre demande est bien arrivée chez :</p><p class="sentdest" translate="no">${esc(reqWho(r))}</p>
    <div class="sentcard"><p>${delay}</p><p>L'équipe décidera du délai en fonction de votre demande.</p></div>
    <p class="hint">Vous recevrez une notification dès que l'équipe vous répond.</p>
    <button class="btn full" id="sent-ok">Voir ma demande</button><button class="btn ghost full" id="sent-home">Retour à l'accueil</button></div></div>`);
  const close=()=>{ const e=$("#sent"); if(e) e.remove(); };
  $("#sent-ok").onclick=close; $("#sent-home").onclick=()=>{ close(); clearPend(); S.screen="home"; render(); scrollTo(0,0); };
  $("#sent-ok").focus();
}
function patientReq(a){
  const r=S.reqs.find(x=>x.id===S.openReq); if(!r){ S.screen="home"; return draw(); }
  const items=(r.request_items||[]), key="p"+r.id;
  const itemsHTML = r.type==="prescription"&&items.some(i=>i.decision) ? `<div class="itemlist">${items.map(i=>`<div><span>${esc(i.label)}<small class="qty">${qtyText(i.quantity||1)}</small></span><span class="dtag ${i.decision==="accorde"?"ok":"no"}">${i.decision==="accorde"?"Prescrit":i.decision?"Non renouvelé":"En attente"}</span></div>`).join("")}</div>` : "";
  a.className="wrap chatpage";
  a.innerHTML=`<div class="convhead sticky"><button class="back" id="back" aria-label="Retour">${IC.back}</button>${PAV.get(r.provider_id)?avatarHTML(PAV.get(r.provider_id),"",40):`<div class="ic avatar">${IC[r.type]}</div>`}<div style="min-width:0"><h2>${esc(reqWho(r))}</h2><small>${TYPES[r.type].label}${r.child_id?` · pour ${esc(childFirst(r.child_id))}`:""} · ${stLabelP(r)}</small></div></div>
  ${chatHTML(r,"patient")}${itemsHTML}
  ${r.purged_at||r.status==="traite"?`<div class="closed"><b>${r.purged_at?"Conversation effacée":"Conversation clôturée par le centre"}</b><span>${r.purged_at?"":`Vous pouvez la relire jusqu'au ${fmtDate(purgeDate(r))}, date à laquelle elle sera effacée. <b>Pour la garder, enregistrez-la en PDF.</b> `}Pour une suite ou une autre question, ouvrez une nouvelle demande.</span>${r.purged_at?"":`<div class="btnrow savepdf"><button class="btn ghost" id="savepdf">${IC.doc} Enregistrer la conversation (PDF)</button></div>`}<div class="btnrow"><button class="btn" id="newq">Nouvelle question</button><button class="btn ghost" id="newr">Demander un rendez-vous</button></div></div>`
  :`${composerHTML(key)}<p class="hint center small">Lu pendant les heures d'ouverture. Urgence vitale : appelez le 112.</p>`}`;
  $("#back").onclick=()=>{ clearPend(); S.screen="home"; render(); scrollTo(0,0); };
  if(r.purged_at||r.status==="traite"){ $("#newq").onclick=()=>startFlow("question"); $("#newr").onclick=()=>startFlow("rdv"); bindSavePdf(r); return; }
  bindComposer(key, async (text,pend)=>{
    const ok = pend ? await uploadAtt(r.id,pend,text) : await run(()=>sb.from("messages").insert({request_id:r.id, body:text}),"Message envoyé");
    if(!ok) return false;
    S.drafts[key]=""; clearPend(); await loadPatient(); render(); return true;
  });
}

/* =====================================================================
   ÉQUIPE
   ===================================================================== */
// Agenda Rosa des professionnels : chacun s'y connecte avec son propre compte Rosa
const ROSA_PRO_URL="https://hp-calendar.rosa.be/";
const APP_VERSION="20261029e";
const versionHTML = () => `<p class="hint appver" translate="no">Version ${APP_VERSION}</p>`;
const ROLE_LABEL={secretariat:"Secrétariat",provider:"Prestataire",admin:"Administrateur",gestion:"Administration",patient:"Patient"};
const isDesk = () => S.me.role==="secretariat"||S.me.role==="admin";
const isGestion = () => S.me.role==="gestion";
// droits d'administrateur : rôle « Administrateur » ou case « Administrateur » cochée (en plus du rôle)
const isAdminP = p => !!p&&p.role!=="patient"&&(p.role==="admin"||!!p.is_admin);
const isAdmin = () => isAdminP(S.me);
const canPub = () => isDesk()||isGestion();
/* ----- navigation de l'équipe : 3 onglets + « Écrire » + menu de la photo -----
   Ordinateur : onglets en haut. Téléphone : barre en bas (comme les apps habituelles). */
const SI={
 inbox:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
 tasks:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
 centre:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/><path d="M10 9h4"/></svg>',
 pen:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
 cal:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
 ext:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
 team:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
 box:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>',
 phone:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
 hourglass:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22"/><path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/></svg>',
 ucheck:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg>',
 out:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
 chat:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
 tpl:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/></svg>',
 book:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h8M8 11h6"/></svg>',
 phone:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
 link:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
 down:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
};
function centreItems(){
  const it=[];
  if(canPub()) it.push({cs:"news",ic:SI.news||IC.news,t:"Actualités",d:"Annonces pour les patients",n:0});
  if(isAdmin()||isGestion()) it.push({cs:"team",ic:SI.team,t:"Équipe",d:"Collègues et comptes de l'équipe",n:0});
  it.push({cs:"desk",ic:SI.phone,t:"Accueil",d:"La liste commune du secrétariat",n:isDesk()?deskTodayCount():0});
  it.push({cs:"waitlist",ic:SI.hourglass,t:"Listes d'attente",d:"Patients à rappeler en cas de désistement",n:0});
  it.push({cs:"tasks",ic:SI.tasks,t:"Tâches",d:"Ce que l'équipe doit faire",n:myTasks().length,mob:true});
  it.push({cs:"binder",ic:SI.book,t:"Classeur",d:"Numéros utiles, procédures, documents",n:0});
  it.push({cs:"inventory",ic:SI.box,t:"Inventaire",d:"Matériel à commander",n:invOpen()});
  it.push({cs:"patients",ic:IC.user,t:"Fiches patients",d:"Patients sans compte dans l'app",n:0});
  it.push({cs:"leaves",ic:SI.cal,t:"Congés",d:"Absences et congés de l'équipe",n:0});
  if(isAdmin()) it.push({cs:"accounts",ic:SI.ucheck,t:"Comptes à valider",d:"Nouveaux patients",n:S.pending.length+(S.pendingKids||[]).length});
  return it;
}
const badge = n => n?`<span class="sn" aria-label="${n} en attente">${n}</span>`:"";
/* ---------- disponibilité : Disponible · En pause · Absent(e) ----------
   Pause : plus de notification ni d'e-mail (résumé à la fin de la pause), rien ne change pour les patients.
   Absent(e) : alertes renvoyées au collègue choisi et/ou message automatique aux patients. */
function availState(){
  const s=S.settings||{}, td=todayISO(), now=Date.now();
  if(s.away&&(!s.away_until||td<=s.away_until)) return {k:"away",until:s.away_until};
  if((S.leaves||[]).some(l=>l.user_id===S.me.id&&l.starts<=td&&td<=l.ends)) return {k:"leave"};
  if(s.pause_until&&(s.pause_until==="infinity"||new Date(s.pause_until).getTime()>now)) return {k:"pause",until:s.pause_until};
  return {k:"on"};
}
function pauseText(u){ if(u==="infinity") return "jusqu'à ce que vous la retiriez"; const d=new Date(u), t=d.toLocaleTimeString("fr-BE",{hour:"2-digit",minute:"2-digit"});
  return d.toDateString()===new Date().toDateString()?`jusqu'à ${t}`:`jusqu'au ${d.toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long"})} à ${t}`; }
const AVAIL_ICON={on:IC.bell,pause:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.7 3.7A6 6 0 0 1 18 9c0 2.6.5 4.4 1.1 5.6M17 17H3.5S6 15.5 6 9c0-.6.1-1.2.2-1.7"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/><path d="m2 2 20 20"/></svg>',
  away:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>'};
AVAIL_ICON.leave=AVAIL_ICON.away;
function availBtnHTML(){ const a=availState(), lab={on:"Disponible",pause:"En pause",away:"Absent(e)",leave:"En congé"}[a.k];
  return `<button type="button" class="savail av-${a.k}" data-avail title="Pause des notifications ou absence">${AVAIL_ICON[a.k]}<span>${lab}</span></button>`; }
function openAvail(){
  const a=availState(), s=S.settings||{}, others=S.team.filter(t=>t.id!==S.me.id&&t.status==="active"&&t.role!=="patient");
  const tomorrow8=()=>{ const d=new Date(); d.setDate(d.getDate()+1); d.setHours(8,0,0,0); return d.toISOString(); };
  const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true"); v.setAttribute("aria-labelledby","av-t");
  const stateLine={on:"Vous êtes <b>disponible</b> : vous recevez vos notifications normalement.",
    pause:`Vos notifications sont <b>en pause</b> ${esc(pauseText(a.until||""))}.`,
    away:`Vous êtes <b>absent(e)</b>${a.until?` jusqu'au ${fmtDate(a.until+"T12:00")} inclus`:""}.`,
    leave:"Vous êtes <b>en congé</b> aujourd'hui (Mon profil → Mes congés)."}[a.k];
  v.innerHTML=`<div class="mbox avbox"><h2 id="av-t">Mes notifications</h2><p class="avstate av-${a.k}">${stateLine}</p>
   ${a.k==="pause"?`<button class="btn full" id="av-resume">Reprendre les notifications</button>`:""}
   ${a.k==="away"?`<button class="btn full" id="av-back">Je suis de retour</button>`:""}
   ${a.k!=="away"&&a.k!=="leave"?`<h3>Pause des notifications</h3>
   <div class="avgrid"><button class="btn ghost" data-pause="1h">1 heure</button><button class="btn ghost" data-pause="t8">Jusqu'à demain 8 h</button><button class="btn ghost" data-pause="inf">Jusqu'à ce que je la retire</button></div>
   <p class="hint">Plus de notification ni d'e-mail, sauf les alertes de sécurité. Les demandes arrivent toujours dans l'app ; vous recevez un résumé à la fin de la pause. Rien ne change pour les patients.</p>`:""}
   ${a.k!=="away"?`<details class="avaway"${a.k==="leave"?" open":""}><summary><h3>Je suis absent(e)</h3></summary>
    <p class="hint">Maladie, imprévu… Vos alertes vont au collègue choisi${S.me.provider_id?" et/ou les patients qui vous écrivent reçoivent un message automatique":""}.</p>
    <label class="fld">Jusqu'au (inclus) — facultatif<input type="date" id="av-until" min="${todayISO()}" value=""></label>
    <label class="fld">Renvoyer mes notifications vers<select id="av-fw"><option value="">Ne pas renvoyer</option>${others.map(t=>`<option value="${t.id}" ${t.id===s.forward_to?"selected":""}>${esc(`${t.first_name||""} ${t.last_name||""}`.trim())} · ${ROLE_LABEL[t.role]}</option>`).join("")}</select></label>
    ${S.me.provider_id?`<label class="chk2"><input type="checkbox" id="av-amsg" checked> Répondre automatiquement aux patients qui m'écrivent</label>
    <textarea id="av-msg" rows="5" maxlength="1000" aria-label="Message automatique"></textarea>`:""}
    <button class="btn" id="av-away">Me déclarer absent(e)</button></details>`:""}
   <div class="btnrow"><button class="btn ghost" id="av-x">Fermer</button><button class="linkbtn" id="av-more">Plus de réglages</button></div></div>`;
  document.body.appendChild(v); const close=()=>v.remove();
  v.onclick=e=>{ if(e.target===v) close(); }; v.querySelector("#av-x").onclick=close;
  v.querySelector("#av-more").onclick=()=>{ close(); S.cscreen="settings"; render(); };
  const done=()=>{ close(); render(); };
  const setPause=async u=>{ const r=await run(()=>sb.rpc("set_my_pause",{p_until:u}),u?"Notifications en pause "+pauseText(u):"Notifications reprises");
    if(r){ S.settings={...(S.settings||{user_id:S.me.id}),pause_until:u}; done(); } };
  v.querySelectorAll("[data-pause]").forEach(b=>b.onclick=()=>{ const k=b.dataset.pause; setPause(k==="1h"?new Date(Date.now()+3600e3).toISOString():k==="t8"?tomorrow8():"infinity"); });
  const rs=v.querySelector("#av-resume"); if(rs) rs.onclick=()=>setPause(null);
  const bk=v.querySelector("#av-back"); if(bk) bk.onclick=async()=>{ bk.disabled=true;
    if(await run(()=>sb.from("staff_settings").upsert({user_id:S.me.id,away:false,away_until:null}),"Bon retour ! Vos notifications reprennent.")){ S.settings={...(S.settings||{}),user_id:S.me.id,away:false,away_until:null}; done(); } else bk.disabled=false; };
  const msg=v.querySelector("#av-msg"), am=v.querySelector("#av-amsg"), un=v.querySelector("#av-until"), fw=v.querySelector("#av-fw");
  if(msg){ msg.dataset.auto="1"; const fill=()=>{ if(msg.dataset.auto) msg.value=awayDefaultText(un.value,fw.value); }; fill();
    un.onchange=fill; fw.onchange=fill; msg.oninput=()=>{ msg.dataset.auto=""; }; am.onchange=()=>{ msg.hidden=!am.checked; }; }
  const ga=v.querySelector("#av-away"); if(ga) ga.onclick=async()=>{
    const row={user_id:S.me.id,away:true,away_until:un.value||null,forward_to:fw.value||null,away_message:am&&am.checked&&msg.value.trim()?msg.value.trim():null};
    if(!row.forward_to&&!row.away_message) return toast(am?"Choisissez un collègue, ou gardez le message automatique.":"Choisissez le collègue qui recevra vos notifications.");
    ga.disabled=true;
    if(await run(()=>sb.from("staff_settings").upsert(row),"Absence enregistrée")){ S.settings={...(S.settings||{}),...row}; done(); } else ga.disabled=false; };
}
function closeDD(){ $$(".dd").forEach(d=>d.hidden=true); $$("[aria-expanded]").forEach(b=>b.setAttribute("aria-expanded","false")); const bk=$(".ddback"); if(bk) bk.hidden=true; document.body.classList.remove("ddopen"); }
function openDD(id){ const d=$("#"+id); if(!d) return; const was=!d.hidden; closeDD(); if(was) return;
  d.hidden=false; $$(`[data-dd="${id}"]`).forEach(b=>b.setAttribute("aria-expanded","true")); const bk=$(".ddback"); if(bk) bk.hidden=false; document.body.classList.add("ddopen");
  const f=d.querySelector(".ddi"); if(f) f.focus({preventScroll:true}); }
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&$(".dd:not([hidden])")) closeDD(); });
// agrandir une image d'annonce, sur tous les écrans (patients, équipe, comptes en attente)
document.addEventListener("click",e=>{ const z=e.target.closest&&e.target.closest("[data-zoom]"); if(!z) return; e.preventDefault(); e.stopPropagation(); openViewer(z.dataset.zoom); },true);
document.addEventListener("keydown",e=>{ if(e.key!=="Enter"&&e.key!==" ") return; const z=e.target.closest&&e.target.closest("[data-zoom]"); if(!z||z.tagName==="BUTTON") return; e.preventDefault(); openViewer(z.dataset.zoom); });
document.addEventListener("click",e=>{ if(!$(".dd:not([hidden])")) return; if(e.target.closest(".dd,[data-dd],#dd-centre-b,#dd-me-b")) return; closeDD(); });
function leavesHTML(){
  const t=todayISO(), rows=(S.teamAbs||[]).slice().sort((x,y)=>(x.starts||"").localeCompare(y.starts||"")||(x.name||"").localeCompare(y.name||""));
  const who=x=>esc(x.provider_id?provName(x.provider_id):(x.name||"—"))+` <small>· ${ROLE_LABEL[x.role]||""}</small>`;
  const when=x=>!x.ends?"En cours, sans date de retour":(x.starts<=t?`En cours, jusqu'au ${fmtDate(x.ends+"T12:00")} inclus`:`Du ${fmtDate(x.starts+"T12:00")} au ${fmtDate(x.ends+"T12:00")} inclus`);
  return `<div class="chead"><div><h1>Congés et absences</h1><p>Les congés programmés et les absences en cours de toute l'équipe. Chacun gère les siens dans Mon profil et notifications.</p></div></div>
  <div class="settings">${rows.length?`<section class="card"><ul class="leavelist">${rows.map(x=>`<li class="${x.starts<=t?"now":""}"><b>${who(x)}</b><span>${when(x)}${x.kind==="absence"?" · absence imprévue":""}</span>${x.forward_name?`<small>Notifications renvoyées vers ${esc(x.forward_name)}</small>`:""}</li>`).join("")}</ul></section>`:`<div class="empty">Aucun congé ni absence prévus.</div>`}
  <div class="btnrow"><button class="btn ghost" data-cs="settings">Gérer mes congés</button></div></div>`;
}
/* =====================================================================
   MESSAGERIE DE L'ÉQUIPE · RÉPONSES TYPES · CLASSEUR
   ===================================================================== */
S.tthread=null; S.team2={threads:[],members:[],msgs:[]}; S.tpls=[]; S.binder=[]; S.bfilter="tout"; S.bq=""; S.bedit=null;
async function loadTeam(){
  try{
    const since=new Date(Date.now()-90*864e5).toISOString();
    const [t,m,g,tp,b]=await Promise.all([
      sb.from("team_threads").select("*").order("last_at",{ascending:false}),
      Promise.resolve(sb.from("team_members").select("thread_id,user_id,last_read_at,pinned_at")).then(r=>r.error?sb.from("team_members").select("thread_id,user_id,last_read_at"):r),
      sb.from("team_messages").select("id,thread_id,author_id,body,request_id,file_mime,file_name,file_size,created_at").gte("created_at",since).order("created_at").limit(3000),
      sb.from("reply_templates").select("*").order("title"),
      sb.from("binder_items").select("id,category,title,body,phone,url,file_mime,file_name,file_size,updated_by,updated_at,created_at").order("title")]);
    const older=(S.team2.msgs||[]).filter(x=>x.created_at<since&&(t.data||[]).some(th=>th.id===x.thread_id));
    S.team2={threads:t.data||[],members:m.data||[],msgs:[...older,...(g.data||[])],older:S.team2.older||{}}; S.tpls=tp.data||[]; S.binder=b.data||[];
  }catch(e){ console.error(e); }
}
const staffName = id => { const t=(S.team||[]).find(x=>x.id===id); if(!t) return "Ancien membre"; return (t.provider_id?provName(t.provider_id):"")||`${t.first_name||""} ${t.last_name||""}`.trim()||ROLE_LABEL[t.role]; };
const staffInitials = id => { const n=staffName(id).replace(/^Dr\.?\s+/,""); return n.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase()||"?"; };
const tMembers = tid => S.team2.members.filter(m=>m.thread_id===tid);
const tMsgs = tid => S.team2.msgs.filter(m=>m.thread_id===tid);
function tTitle(t){ if(t.kind!=="direct") return t.title||"Groupe"; const o=tMembers(t.id).find(m=>m.user_id!==S.me.id); return o?staffName(o.user_id):"Conversation"; }
function tUnread(t){ const me=tMembers(t.id).find(m=>m.user_id===S.me.id); if(!me) return 0; return tMsgs(t.id).filter(m=>m.author_id!==S.me.id&&m.created_at>me.last_read_at).length; }
const teamUnread = () => (S.team2.threads||[]).reduce((n,t)=>n+tUnread(t),0);
function tPreview(m){ if(!m) return "Aucun message"; const who=m.author_id===S.me.id?"Vous":staffName(m.author_id).split(" ").slice(-1)[0];
  const what=m.body||(m.file_mime?(m.file_mime.startsWith("audio")?"🎤 Message vocal":m.file_mime==="application/pdf"?"📄 "+(m.file_name||"PDF"):"📷 Photo"):m.request_id?"📋 Demande jointe":""); return `${who} : ${what}`; }
const avColor = s => ["#702629","#8a6d33","#1d5a8a","#2e6b2f","#6b3d7a","#9a5b00"][[...String(s)].reduce((a,c)=>a+c.charCodeAt(0),0)%6];
function tAvatar(t){ if(t.kind==="direct"){ const o=tMembers(t.id).find(m=>m.user_id!==S.me.id); if(o&&AV.get(o.user_id)) return avatarHTML(AV.get(o.user_id),"",40); return `<span class="tav" style="background:${avColor(o?.user_id||t.id)}">${esc(o?staffInitials(o.user_id):"?")}</span>`; }
  const ini=(t.title||"G").split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase(); return `<span class="tav grp" style="background:${avColor(t.title||t.id)}">${esc(ini)}</span>`; }
const tSorted = () => S.team2.threads.slice().sort((a,b)=>{ const la=tMsgs(a.id).slice(-1)[0], lb=tMsgs(b.id).slice(-1)[0]; return (lb?.created_at||b.last_at).localeCompare(la?.created_at||a.last_at); });
function reqCardHTML(id){ const r=S.reqs.find(x=>x.id===id);
  if(!r) return `<div class="treq off">📋 Demande non accessible ou effacée</div>`;
  return `<button type="button" class="treq" data-openreq="${r.id}">📋<span><b>${esc(reqName(r))} · ${TYPES[r.type].label}</b><small>« ${esc(summaryLine(r.answers))} » · ouvrir ›</small></span></button>`; }
function tMsgHTML(m){ const mine=m.author_id===S.me.id;
  const file=m.file_mime?(m.file_mime.startsWith("image")?`<button type="button" class="tfile img" data-tfile="${m.id}" data-kind="image"><span class="loading">Photo…</span></button>`
    :m.file_mime.startsWith("audio")?`<div class="tfile" data-tfile="${m.id}" data-kind="audio"><audio controls preload="none"></audio></div>`
    :`<a class="tfile pdf" href="#" data-tfile="${m.id}" data-kind="pdf">📄 ${esc(m.file_name||"document.pdf")}</a>`):"";
  return `<div class="tm ${mine?"me":""}">${mine?"":`<span class="who">${esc(staffName(m.author_id))}</span>`}${m.body?`<p>${esc(m.body)}</p>`:""}${m.request_id?reqCardHTML(m.request_id):""}${file}<small>${fmt(m.created_at)}</small></div>`; }
function tMsgsHTML(t){
  const k="t"+t.id, ms=tMsgs(t.id);
  if(!(k in UNREAD)){ const me=tMembers(t.id).find(m=>m.user_id===S.me.id); UNREAD[k]=me?me.last_read_at:"9999"; }
  const from=UNREAD[k], n=ms.filter(m=>m.author_id!==S.me.id&&m.created_at>from).length; let done=false;
  return ms.map(m=>{ let pre=""; if(!done&&n&&m.author_id!==S.me.id&&m.created_at>from&&m!==ms[0]){ done=true; pre=unreadLine(n); } return pre+tMsgHTML(m); }).join("");
}
function teamHTML2(){
  const F=S.tfilter||"all", all=tSorted(), list=all.filter(t=>tFilterOk(t,F)), cur=S.team2.threads.find(t=>t.id===S.tthread)||null;
  const pins=list.filter(tPinned), rest=list.filter(t=>!tPinned(t));
  const rowH=t=>{ const u=tUnread(t), last=tMsgs(t.id).slice(-1)[0]; return `<button type="button" class="trow ${t.id===S.tthread?"on":""} ${u?"unread":""}" data-thread="${t.id}">${tAvatar(t)}<span class="tx"><b>${tPinned(t)?`<i class="tpin" aria-label="Épinglée">${SI.pin}</i>`:""}${esc(tTitle(t))}${t.patient_related?`<i class="tpat" title="Concerne des patients : effacée après 90 jours">patients</i>`:""}</b><small>${esc(tPreview(last))}</small></span><span class="tside"><small>${last?fmt(last.created_at):""}</small>${u?`<span class="sn">${u}</span>`:""}</span></button>`; };
  const listHTML=`<div class="tlist"><button type="button" class="tnew" id="t-new">+ Nouvelle conversation</button>
    <div class="tfil" role="group" aria-label="Afficher">${TFILTERS.map(([k,l])=>{ const n=k==="all"?0:all.filter(t=>tFilterOk(t,k)).length; return k!=="all"&&!n?"":`<button type="button" data-tf="${k}" aria-pressed="${F===k}">${l}${k==="unread"&&n?` <i>${n}</i>`:""}</button>`; }).join("")}</div>
    ${pins.length?`<p class="tsec">${SI.pin} Épinglées</p>${pins.map(rowH).join("")}${rest.length?`<p class="tsec">Autres conversations</p>`:""}`:""}
    ${list.length?rest.map(rowH).join(""):`<div class="empty">${F==="all"?"Aucune conversation.":"Aucune conversation dans ce filtre."}</div>`}</div>`;
  const thHTML=cur?`<div class="tthread"><div class="thd"><button type="button" class="back tback" id="t-back" aria-label="Retour aux conversations">${IC.back}</button>${tAvatar(cur)}<div class="thinfo"><b>${esc(tTitle(cur))}</b><small>${esc(tMembers(cur.id).map(m=>m.user_id===S.me.id?"vous":staffName(m.user_id)).join(", "))}</small></div>
      <button type="button" class="tpinbtn" id="t-pin" aria-pressed="${tPinned(cur)}" title="${tPinned(cur)?"Désépingler":"Épingler en haut de la liste"}">${SI.pin}<span>${tPinned(cur)?"Épinglée":"Épingler"}</span></button>
      ${cur.kind==="group"?`<button type="button" class="linkbtn" id="t-addm">Ajouter</button><button type="button" class="linkbtn" id="t-leave">Quitter</button>`:""}</div>
      <label class="tpatsw"><input type="checkbox" id="t-pat" ${cur.patient_related?"checked":""}> <span><b>Concerne des patients</b> ${cur.patient_related?"– messages effacés après 90 jours":"– sinon, les messages sont gardés (organisation du centre)"}</span></label>
      <div class="tmsgs" id="tmsgs">${S.team2.older?.[cur.id]!=="fin"&&!cur.patient_related?`<button type="button" class="linkbtn tolder" id="t-older">Afficher les messages plus anciens</button>`:""}${tMsgsHTML(cur)||`<p class="hint center">Écrivez le premier message.</p>`}</div>
      ${S.tattach&&S.tattach.thread===cur.id?`<div class="tattach">${reqCardHTML(S.tattach.id)}<button type="button" class="linkbtn" id="t-unreq">Retirer</button></div>`:""}
      <div class="tcomp"><button type="button" class="cbtn" id="t-req" title="Joindre une demande de patient" aria-label="Joindre une demande de patient">📋</button>${composerHTML("t"+cur.id)}</div>
      <p class="hint small">${cur.patient_related?"Conversation sur des patients : messages effacés après 90 jours.":"Messages gardés. Un message qui joint une demande de patient est effacé après 90 jours."} Ne remplace pas le dossier médical.</p></div>`
    :`<div class="tthread empty-th"><p class="hint center">Choisissez une conversation, ou créez-en une nouvelle.</p></div>`;
  return `<div class="chead"><div><h1>Messages de l'équipe</h1><p>Conversations à deux ou en groupe. Jamais visibles par les patients.</p></div></div>
  <div class="tpane ${cur?"open":""}">${listHTML}${thHTML}</div>`;
}
let teamRtTimer=null;
function teamRt(){ clearTimeout(teamRtTimer); teamRtTimer=setTimeout(async()=>{ if(!S.me||S.me.role==="patient") return; await loadTeam();
  if(audioPlaying()){ updateBadges(); teamRt(); return; }
  const el=document.activeElement, typing=!!(el&&(el.tagName==="TEXTAREA"||el.tagName==="INPUT"));
  if(S.cscreen==="messages"&&S.tthread){ await sb.rpc("team_read",{p_thread:S.tthread}).then(()=>{ const me=tMembers(S.tthread).find(m=>m.user_id===S.me.id); if(me) me.last_read_at=new Date().toISOString(); }); }
  if(S.cscreen==="messages"&&typing&&$("#tmsgs")){ const t=S.team2.threads.find(x=>x.id===S.tthread); if(t){ $("#tmsgs").innerHTML=tMsgsHTML(t); hydrateTeam(); tScroll(); } updateBadges(); }
  else if(S.cscreen==="messages"&&!S.pend&&!REC&&!CREC) render(); else updateBadges();
 },500); }
const tScroll = () => { const b=$("#tmsgs"); if(!b) return; if(!scrollToUnread(b)) b.scrollTop=b.scrollHeight; };
const TFILES=new Map();
async function teamFile(id){ if(TFILES.has(id)) return TFILES.get(id);
  const p=(async()=>{ const {data,error}=await sb.rpc("team_file",{p_id:id}); if(error) throw error; const d=(data||[])[0]; if(!d) throw new Error("absent");
    const bin=atob(d.data), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    const blob=new Blob([u8],{type:d.mime}); return {blob,url:URL.createObjectURL(blob),name:d.name,mime:d.mime}; })();
  TFILES.set(id,p); p.catch(()=>TFILES.delete(id)); return p; }
function hydrateTeam(){ $$("[data-tfile]:not([data-ready])").forEach(async el=>{ el.dataset.ready="1";
  try{ const f=await teamFile(+el.dataset.tfile);
    if(el.dataset.kind==="image"){ el.innerHTML=`<img src="${f.url}" alt="Photo">`; el.onclick=()=>openViewer(f.url); el.querySelector("img").onload=tScroll; }
    else if(el.dataset.kind==="audio"){ const au=el.querySelector("audio"); au.src=f.url; fixAudio(au, f.blob, 0); }
    else el.onclick=async e=>{ e.preventDefault(); if(IS_NATIVE&&SEC()){ try{ await nativePreview(f.blob,f.name); }catch(_){ toast("Ce document n'a pas pu être ouvert."); } } else window.open(f.url,"_blank","noopener"); };
  }catch(e){ el.textContent="Fichier indisponible"; } }); }
function pickColleagues(title, exclude, done, withName, pre){
  const others=(S.team||[]).filter(t=>t.status==="active"&&t.id!==S.me.id&&!exclude.includes(t.id)).sort((a,b)=>staffName(a.id).localeCompare(staffName(b.id)));
  const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true");
  v.innerHTML=`<div class="mbox"><h2>${esc(title)}</h2>${withName?`<label class="fld">Nom du groupe (obligatoire si plusieurs collègues)<input id="pc-name" maxlength="60" placeholder="Ex. Médecins, Secrétariat…"></label>`:""}
    ${withName?`<label class="chk2 pcpat"><input type="checkbox" id="pc-pat"> <span><b>Concerne des patients</b><small>Les messages seront effacés après 90 jours. Sans cette case, ils sont gardés (organisation, fonctionnement, inventaire…).</small></span></label>`:""}
    <input id="pc-q" class="pcq" placeholder="Rechercher un collègue…" aria-label="Rechercher un collègue">
    <div class="pclist">${others.map(t=>`<label class="chk2 pcrow" data-n="${esc(staffName(t.id).toLowerCase())}"><input type="checkbox" value="${t.id}" ${(pre||[]).includes(t.id)?"checked":""}> ${esc(staffName(t.id))} <small>· ${ROLE_LABEL[t.role]}</small></label>`).join("")||`<p class="hint">Personne d'autre à ajouter.</p>`}</div>
    <div class="btnrow"><button class="btn" id="pc-ok">Valider</button><button class="btn ghost" id="pc-x">Annuler</button></div></div>`;
  document.body.appendChild(v); const close=()=>v.remove();
  v.querySelector("#pc-x").onclick=close; v.onclick=e=>{ if(e.target===v) close(); };
  v.querySelector("#pc-q").oninput=e=>{ const q=e.target.value.toLowerCase(); v.querySelectorAll(".pcrow").forEach(r=>r.hidden=!r.dataset.n.includes(q)); };
  v.querySelector("#pc-ok").onclick=async()=>{ const ids=[...v.querySelectorAll(".pcrow input:checked")].map(i=>i.value), name=withName?v.querySelector("#pc-name").value.trim():"";
    if(!ids.length&&!pre) return toast("Choisissez au moins un collègue.");
    if(withName&&ids.length>1&&!name) return toast("Donnez un nom au groupe.");
    if(await done(ids,name,!!v.querySelector("#pc-pat")?.checked)) close(); };
  v.querySelector("#pc-q").focus();
}
function pickRequest(done){
  const list=S.reqs.slice().sort((a,b)=>(a.status==="traite")-(b.status==="traite")||new Date(b.created_at)-new Date(a.created_at)).slice(0,200);
  const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true");
  v.innerHTML=`<div class="mbox"><h2>Joindre une demande</h2><input id="pr-q" class="pcq" placeholder="Nom du patient…" aria-label="Rechercher une demande">
    <div class="pclist">${list.map(r=>`<button type="button" class="prrow" data-pr="${r.id}" data-n="${esc(reqName(r).toLowerCase())}"><b>${esc(reqName(r))}</b><small>${TYPES[r.type].label} · ${esc(summaryLine(r.answers))} · ${fmt(r.created_at)}</small></button>`).join("")||`<p class="hint">Aucune demande.</p>`}</div>
    <div class="btnrow"><button class="btn ghost" id="pr-x">Annuler</button></div></div>`;
  document.body.appendChild(v); const close=()=>v.remove(); v.querySelector("#pr-x").onclick=close; v.onclick=e=>{ if(e.target===v) close(); };
  v.querySelector("#pr-q").oninput=e=>{ const q=e.target.value.toLowerCase(); v.querySelectorAll(".prrow").forEach(r=>r.hidden=!r.dataset.n.includes(q)); };
  v.querySelectorAll("[data-pr]").forEach(b=>b.onclick=()=>{ close(); done(+b.dataset.pr); }); v.querySelector("#pr-q").focus();
}
function bindTeam2(){
  $$("[data-thread]").forEach(b=>b.onclick=()=>{ S.tthread=+b.dataset.thread; const me=tMembers(S.tthread).find(m=>m.user_id===S.me.id); UNREAD["t"+S.tthread]=me?me.last_read_at:"9999"; delete UNREAD["s:tmsgs:"+S.tthread]; if(me) me.last_read_at=new Date().toISOString(); render(); sb.rpc("team_read",{p_thread:S.tthread}).then(()=>{}); });
  $("#t-new").onclick=()=>pickColleagues("Nouvelle conversation",[],async(ids,name,pat)=>{ const {data,error}=await sb.rpc("team_start",{p_members:ids,p_title:name||null}); if(error){ toast(frError(error)); return false; }
    if(pat) await sb.rpc("team_set_patient",{p_thread:data,p_on:true}); await loadTeam(); S.tthread=data; render(); return true; },true);
  const back=$("#t-back"); if(back) back.onclick=()=>{ S.tthread=null; render(); };
  $$("[data-tf]").forEach(b=>b.onclick=()=>{ S.tfilter=S.tfilter===b.dataset.tf?"all":b.dataset.tf; render(); });
  const t=S.team2.threads.find(x=>x.id===S.tthread); if(!t) return;
  $("#t-pin").onclick=async()=>{ const on=!tPinned(t); if(await run(()=>sb.rpc("team_pin",{p_thread:t.id,p_pin:on}),on?"Conversation épinglée":"Conversation désépinglée")){ const me=tMembers(t.id).find(m=>m.user_id===S.me.id); if(me) me.pinned_at=on?new Date().toISOString():null; render(); } };
  $("#t-pat").onchange=async e=>{ const on=e.target.checked; if(await run(()=>sb.rpc("team_set_patient",{p_thread:t.id,p_on:on}),on?"Conversation marquée « patients » : effacée après 90 jours":"Conversation d'organisation : messages gardés")){ t.patient_related=on; render(); } else e.target.checked=!on; };
  const ol=$("#t-older"); if(ol) ol.onclick=()=>{ ol.disabled=true; ol.textContent="Chargement…"; loadOlder(t); };
  hydrateTeam(); requestAnimationFrame(tScroll);
  const add=$("#t-addm"); if(add) add.onclick=()=>pickColleagues("Ajouter au groupe",tMembers(t.id).map(m=>m.user_id),async ids=>{ if(await run(()=>sb.rpc("team_add",{p_thread:t.id,p_members:ids}),"Ajouté au groupe")){ await loadTeam(); render(); return true; } return false; });
  const lv=$("#t-leave"); if(lv) lv.onclick=async()=>{ if(!confirmInline(lv,"Quitter ce groupe ?")) return; if(await run(()=>sb.rpc("team_leave",{p_thread:t.id}),"Vous avez quitté le groupe")){ S.tthread=null; await loadTeam(); render(); } };
  $("#t-req").onclick=()=>pickRequest(id=>{ S.tattach={thread:t.id,id}; render(); $("#c-text")?.focus(); });
  const ur=$("#t-unreq"); if(ur) ur.onclick=()=>{ S.tattach=null; render(); };
  $$("[data-openreq]").forEach(b=>b.onclick=()=>{ S.sel=+b.dataset.openreq; const r=S.reqs.find(x=>x.id===S.sel); if(r){ S.scope="all"; S.iq=""; S.itype="all"; S.archive=r.status==="traite"; } S.cscreen="inbox"; render(); scrollTo(0,0); });
  const key="t"+t.id;
  bindComposer(key, async (text,pend)=>{
    const req=S.tattach&&S.tattach.thread===t.id?S.tattach.id:null;
    const args={p_thread:t.id,p_body:text||"",p_request:req,p_mime:null,p_name:null,p_data:null};
    if(pend){ toast("Envoi…"); args.p_mime=pend.mime; args.p_name=pend.name; args.p_data=await blobToB64(pend.blob); }
    const {error}=await sb.rpc("team_send",args); if(error){ toast(frError(error)); return false; }
    S.drafts[key]=""; S.tattach=null; clearPend(); await loadTeam(); render(); return true;
  });
}
// petite confirmation en deux temps (pas de fenêtre système)
function confirmInline(btn,label){ if(btn.dataset.sure) return true; btn.dataset.sure="1"; const old=btn.textContent; btn.textContent=label+" Touchez à nouveau"; setTimeout(()=>{ if(document.body.contains(btn)){ btn.textContent=old; delete btn.dataset.sure; } },4000); return false; }

/* ----- fiches conseils (PDF du centre, à envoyer aux patients) ----- */
const FICHES_LIB=[
 ["Prévention","fiche-coeur-prevention.pdf","Protéger son cœur et ses artères","Alimentation et activité physique pour l'adulte"],
 ["Vaccination","fiche-vaccination-enfants.pdf","Calendrier de vaccination de l'enfant","Programme ONE, nouveau calendrier du 1er novembre 2026"],
 ["Alimentation","fiche-diabete-alimentation.pdf","Bien manger avec un diabète","Assiette, aliments à privilégier, hypoglycémie"],
 ["Alimentation","fiche-cholesterol-triglycerides.pdf","Cholestérol et triglycérides","À éviter, à privilégier"],
 ["Alimentation","fiche-calculs-vesicule.pdf","Calculs de la vésicule biliaire","Limiter les crises, signes d'alerte"],
 ["Alimentation","fiche-diverticulite.pdf","Diverticules et diverticulite","Pendant la poussée, puis prévention"],
 ["Alimentation","fiche-vitamines-b12-b9.pdf","Vitamines B12 et B9 (folates)","Sources alimentaires, quand compléter"]];
// fiches ajoutées par l'administrateur (base de données) + fiches fournies avec l'app
async function loadHandouts(){
  const [h,x]=await Promise.all([sb.from("handouts").select("id,category,title,subtitle,file_name,file_size,created_at,updated_at").order("category").order("title"), sb.from("handouts_hidden").select("file")]);
  S.handoutsOk=!h.error; S.handouts=h.error?[]:(h.data||[]); S.handoutsHidden=x.error?[]:(x.data||[]).map(r=>r.file); S.handoutsLoaded=true;
}
function allFiches(withHidden){
  const hid=new Set(S.handoutsHidden||[]);
  const base=FICHES_LIB.map(x=>({src:"app",id:x[1],cat:x[0],title:x[2],sub:x[3],hidden:hid.has(x[1])})).filter(x=>withHidden||!x.hidden);
  const db=(S.handouts||[]).map(h=>({src:"db",id:h.id,cat:h.category,title:h.title,sub:h.subtitle||"",size:h.file_size,at:h.updated_at||h.created_at}));
  return [...base,...db];
}
const ficheCats = L => [...new Set(L.map(x=>x.cat))].sort((a,b)=>a.localeCompare(b,"fr"));
async function ficheBlob(x){
  if(x.src==="db"){ const {data,error}=await sb.rpc("get_handout",{p_id:x.id}); if(error||!data||!data[0]) throw error||new Error("Fiche introuvable.");
    const bin=atob(data[0].data), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); return new Blob([u8],{type:"application/pdf"}); }
  const r=await fetch("fiches/"+x.id+"?v="+APP_VERSION,{cache:"no-cache"}); if(!r.ok) throw new Error("Fiche introuvable."); return new Blob([await r.blob()],{type:"application/pdf"});
}
async function openFiche(x,btn){ if(btn) btn.disabled=true;
  try{ const blob=await ficheBlob(x); if(IS_NATIVE&&SEC()){ await nativePreview(blob,x.title+".pdf"); } else { const u=URL.createObjectURL(blob); window.open(u,"_blank","noopener"); setTimeout(()=>URL.revokeObjectURL(u),60000); } }
  catch(e){ toast("La fiche n'a pas pu être ouverte."); } finally{ if(btn) btn.disabled=false; } }
async function pickFiche(done){
  if(!S.handoutsLoaded) await loadHandouts();
  const L=allFiches(false), cats=ficheCats(L);
  const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true"); v.setAttribute("aria-labelledby","pf-t");
  v.innerHTML=`<div class="mbox ficbox"><h2 id="pf-t">Joindre une fiche conseil</h2><p class="hint">Le PDF est joint au message : vous pouvez ajouter un mot avant d'envoyer.</p>
    <input id="pf-q" class="pcq" type="search" placeholder="Rechercher une fiche…" aria-label="Rechercher une fiche">
    <div class="ficlist">${cats.map(c=>`<p class="srg" data-cat>${esc(c)}</p>${L.filter(x=>x.cat===c).map((x,i)=>`<div class="ficrow" data-n="${esc(norm(x.title+" "+x.sub+" "+c))}"><button type="button" class="ficpick" data-fk="${L.indexOf(x)}"><span class="sric">📋</span><span><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></span></button><button type="button" class="linkbtn" data-fv="${L.indexOf(x)}">Voir</button></div>`).join("")}`).join("")||`<p class="hint">Aucune fiche.</p>`}</div>
    <div class="btnrow"><button class="btn ghost" id="pf-x">Annuler</button></div></div>`;
  document.body.appendChild(v); const close=()=>v.remove(); v.querySelector("#pf-x").onclick=close; v.onclick=e=>{ if(e.target===v) close(); };
  v.querySelector("#pf-q").oninput=e=>{ const q=norm(e.target.value); v.querySelectorAll(".ficrow").forEach(r=>r.hidden=!!q&&!r.dataset.n.includes(q)); };
  v.querySelectorAll("[data-fv]").forEach(b=>b.onclick=()=>openFiche(L[+b.dataset.fv],b));
  v.querySelectorAll("[data-fk]").forEach(b=>b.onclick=async()=>{ const x=L[+b.dataset.fk]; b.disabled=true;
    try{ const blob=await ficheBlob(x); close(); await done({kind:"pdf",mime:"application/pdf",name:x.title.slice(0,70)+".pdf",blob}); }
    catch(e){ b.disabled=false; toast("La fiche n'a pas pu être chargée. Réessayez."); } });
}
function fichesHTML(){
  if(!S.handoutsLoaded) return `<div class="chead"><div><h1>Fiches conseils</h1></div></div><div class="empty">Chargement…</div>`;
  const adm=isAdmin(), L=allFiches(adm), cats=ficheCats(L), D=S.ficDraft;
  const row=x=>`<div class="medrow${x.hidden?" fichid":""}"><div class="ic">📋</div><div><b>${esc(x.title)}</b><small>${esc(x.sub)}${x.src==="db"?` · ajoutée ${fmt(x.at)} · ${kb(x.size)}`:" · fournie avec l'app"}${x.hidden?" · <b>masquée</b>":""}</small></div>
    <div class="acts"><button type="button" class="mini ghostmini" data-fo="${L.indexOf(x)}">Ouvrir</button>${adm?(x.src==="db"?`<button type="button" class="linkbtn" data-fe="${x.id}">Modifier</button><button type="button" class="linkbtn" data-fd="${x.id}">Supprimer</button>`:`<button type="button" class="linkbtn" data-fh="${esc(x.id)}" data-on="${x.hidden?0:1}">${x.hidden?"Afficher":"Masquer"}</button>`):""}</div></div>`;
  const form=adm&&D?`<section class="card taskform"><h3>${D.id?"Modifier la fiche":"Ajouter une fiche"}</h3>
     ${D.id?"":`<div class="fld">Fichier PDF (5 Mo maximum)<div class="btnrow" style="margin:4px 0 0"><button type="button" class="btn ghost" id="fa-pick">${IC.clip} ${D.file?"Changer de fichier":"Choisir le PDF"}</button>${D.file?`<span class="hint">${esc(D.file.name)} · ${kb(D.file.size)}</span>`:""}</div><input type="file" id="fa-file" accept="application/pdf" hidden></div>`}
     <label class="fld">Titre<input id="fa-title" maxlength="120" value="${esc(D.title)}" placeholder="Ex. Hypertension : réduire le sel"></label>
     <label class="fld">Courte description (facultatif)<input id="fa-sub" maxlength="160" value="${esc(D.sub)}" placeholder="Ex. Les aliments les plus salés, astuces"></label>
     <label class="fld">Catégorie<input id="fa-cat" maxlength="40" list="fa-cats" value="${esc(D.cat)}" placeholder="Ex. Alimentation"><datalist id="fa-cats">${cats.map(c=>`<option value="${esc(c)}">`).join("")}</datalist></label>
     <div class="btnrow"><button class="btn" id="fa-save">${D.id?"Enregistrer":"Ajouter la fiche"}</button><button class="btn ghost" id="fa-x">Annuler</button></div>
     <p class="hint">Uniquement des documents généraux, jamais de donnée d'un patient. Le PDF est contrôlé (filtre anti-PDF piégé) avant d'être accepté.</p></section>`:"";
  return `<div class="chead"><div><h1>Fiches conseils</h1><p>Des fiches PDF à envoyer aux patients : dans une conversation, touchez 📋 à côté du champ de message (ou « Fiche conseil » dans Écrire à un patient).</p></div>${adm&&!D&&S.handoutsOk?`<button class="btn" id="fa-new">+ Ajouter une fiche</button>`:""}</div>
  <div class="settings">${form}${adm&&!S.handoutsOk?`<p class="hint">Pour ajouter vos propres fiches, la mise à jour du serveur (migration 054) doit d'abord être faite.</p>`:""}
  ${cats.map(c=>`<section class="card"><h3>${esc(c)}</h3><div class="list">${L.filter(x=>x.cat===c).map(row).join("")}</div></section>`).join("")}
  <p class="hint">Conseils généraux, relus par le centre.${adm?" Les fiches masquées ne sont plus proposées à l'équipe ; vous pouvez les afficher à nouveau.":" Pour proposer une nouvelle fiche ou une correction, parlez-en à l'administrateur."}</p></div>`;
}
function bindFiches(){
  if(!S.handoutsLoaded){ loadHandouts().then(()=>{ if(S.cscreen==="fiches") render(); }); return; }
  const adm=isAdmin(), L=allFiches(adm);
  $$("[data-fo]").forEach(b=>b.onclick=()=>openFiche(L[+b.dataset.fo],b));
  const nw=$("#fa-new"); if(nw) nw.onclick=()=>{ S.ficDraft={title:"",sub:"",cat:"",file:null}; render(); };
  $$("[data-fe]").forEach(b=>b.onclick=()=>{ const h=(S.handouts||[]).find(x=>x.id===+b.dataset.fe); S.ficDraft={id:h.id,title:h.title,sub:h.subtitle||"",cat:h.category}; render(); scrollTo(0,0); });
  $$("[data-fd]").forEach(b=>b.onclick=async()=>{ if(!confirmInline(b,"Supprimer ?")) return; if(await run(()=>sb.rpc("delete_handout",{p_id:+b.dataset.fd}),"Fiche supprimée")){ await loadHandouts(); render(); } });
  $$("[data-fh]").forEach(b=>b.onclick=async()=>{ const on=b.dataset.on==="1"; if(await run(()=>sb.rpc("set_handout_hidden",{p_file:b.dataset.fh,p_hidden:on}),on?"Fiche masquée":"Fiche affichée")){ await loadHandouts(); render(); } });
  const D=S.ficDraft; if(!D) return;
  const f={title:"#fa-title",sub:"#fa-sub",cat:"#fa-cat"}; Object.entries(f).forEach(([k,sel])=>{ const el=$(sel); el.oninput=()=>{ D[k]=el.value; }; });
  const inp=$("#fa-file"), pk=$("#fa-pick"); if(pk) pk.onclick=()=>inp.click();
  if(inp) inp.onchange=()=>{ const x=inp.files[0]; inp.value=""; if(!x) return;
    if(!(x.type==="application/pdf"||/\.pdf$/i.test(x.name))) return toast("Choisissez un fichier PDF.");
    if(x.size>5*1048576) return toast("Ce PDF est trop lourd (5 Mo maximum).");
    D.file=x; if(!D.title) D.title=x.name.replace(/\.pdf$/i,"").replace(/[-_]+/g," ").slice(0,120); render(); };
  $("#fa-x").onclick=()=>{ S.ficDraft=null; render(); };
  $("#fa-save").onclick=async e=>{ const btn=e.target;
    if(!D.id&&!D.file) return toast("Choisissez d'abord le fichier PDF.");
    if(!D.title.trim()||!D.cat.trim()) return toast("Indiquez le titre et la catégorie.");
    btn.disabled=true; btn.textContent="Envoi…";
    const ok=D.id ? await run(()=>sb.rpc("edit_handout",{p_id:D.id,p_category:D.cat,p_title:D.title,p_subtitle:D.sub}),"Fiche modifiée")
      : await run(async()=>sb.rpc("add_handout",{p_category:D.cat,p_title:D.title,p_subtitle:D.sub,p_name:D.file.name,p_data:await blobToB64(D.file)}),"Fiche ajoutée : elle est disponible pour toute l'équipe");
    if(ok){ S.ficDraft=null; await loadHandouts(); render(); } else { btn.disabled=false; btn.textContent=D.id?"Enregistrer":"Ajouter la fiche"; } };
}

/* ----- réponses types ----- */
const canCentreTpl = () => S.me.role==="secretariat"||S.me.role==="admin";
function tplFill(body,r){ const first=r?(r.child_id?(S.children?.[r.child_id]?.first_name||""):(S.profiles[r.patient_id]?.first_name||"")):"";
  return body.replace(/\{pr[ée]nom\}/gi,first).replace(/ ,/g,","); }
function bindTplPicker(r){
  const b=$("#c-tpl"); if(!b) return;
  b.onclick=e=>{ e.stopPropagation(); const old=$("#tplpop"); if(old){ old.remove(); return; }
    const mine=S.tpls.filter(t=>t.owner_id===S.me.id), centre=S.tpls.filter(t=>!t.owner_id); let tab=mine.length?"mine":"centre";
    const pop=document.createElement("div"); pop.id="tplpop"; pop.className="tplpop"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label","Réponses types");
    const paint=()=>{ const L=tab==="mine"?mine:centre;
      pop.innerHTML=`<div class="seg"><button type="button" data-tt="mine" aria-pressed="${tab==="mine"}">Mes réponses</button><button type="button" data-tt="centre" aria-pressed="${tab==="centre"}">Réponses du centre</button></div>
      <div class="tpllist">${L.map(t=>`<button type="button" class="tplit" data-tpl="${t.id}"><b>${esc(t.title)}</b><span>${esc(tplFill(t.body,r).slice(0,140))}</span></button>`).join("")||`<p class="hint">${tab==="mine"?"Vous n'avez pas encore de réponse type.":"Aucune réponse du centre."}</p>`}</div>
      <button type="button" class="linkbtn" id="tpl-manage">+ Créer une réponse type · Gérer</button>`;
      pop.querySelectorAll("[data-tt]").forEach(x=>x.onclick=ev=>{ ev.stopPropagation(); tab=x.dataset.tt; paint(); });
      pop.querySelectorAll("[data-tpl]").forEach(x=>x.onclick=()=>{ const t=S.tpls.find(y=>y.id===+x.dataset.tpl), ta=$("#c-text"); if(!t||!ta) return;
        const txt=tplFill(t.body,r), st=ta.selectionStart??ta.value.length, en=ta.selectionEnd??ta.value.length;
        ta.value=ta.value.slice(0,st)+(st&&!/\s$/.test(ta.value.slice(0,st))?"\n":"")+txt+ta.value.slice(en); ta.dispatchEvent(new Event("input")); pop.remove(); ta.focus(); });
      pop.querySelector("#tpl-manage").onclick=()=>{ pop.remove(); S.cscreen="templates"; render(); scrollTo(0,0); }; };
    paint(); $("#chatbar").appendChild(pop);
    const off=ev=>{ if(!pop.contains(ev.target)&&ev.target!==b){ pop.remove(); document.removeEventListener("click",off); } }; setTimeout(()=>document.addEventListener("click",off),0); };
}
function templatesHTML(){
  const mine=S.tpls.filter(t=>t.owner_id===S.me.id), centre=S.tpls.filter(t=>!t.owner_id), ed=S.tedit;
  const row=t=>`<li><div><b>${esc(t.title)}</b><p>${esc(t.body)}</p></div>${(t.owner_id===S.me.id||(!t.owner_id&&canCentreTpl()))?`<span class="tplact"><button type="button" class="linkbtn" data-tedit="${t.id}">Modifier</button><button type="button" class="linkbtn" data-tdel="${t.id}">Supprimer</button></span>`:""}</li>`;
  return `<div class="chead"><div><h1>Réponses types</h1><p>Des textes prêts à insérer dans vos réponses aux patients (bouton ${"💬"} à côté de la zone de message). Vous pouvez toujours les modifier avant d'envoyer.</p></div></div>
  <div class="settings">
   <section class="card"><h3>${ed&&ed.id?"Modifier la réponse":"Nouvelle réponse type"}</h3>
    <label class="fld">Titre<input id="tp-title" maxlength="80" value="${esc(ed?.title||"")}" placeholder="Ex. Prescription prête"></label>
    <label class="fld">Texte<textarea id="tp-body" rows="5" maxlength="2000" placeholder="Bonjour {prénom}, …">${esc(ed?.body||"")}</textarea></label>
    <p class="hint">Astuce : écrivez <b>{prénom}</b>, il sera remplacé par le prénom du patient.</p>
    ${canCentreTpl()?`<label class="chk2"><input type="checkbox" id="tp-centre" ${ed&&ed.id&&!ed.owner_id?"checked":""} ${ed&&ed.id?"disabled":""}> Réponse du centre (visible par toute l'équipe)</label>`:""}
    <div class="btnrow"><button class="btn" id="tp-save">${ed&&ed.id?"Enregistrer":"Ajouter"}</button>${ed?`<button class="btn ghost" id="tp-cancel">Annuler</button>`:""}</div></section>
   <section class="card"><h3>Mes réponses</h3>${mine.length?`<ul class="tplman">${mine.map(row).join("")}</ul>`:`<p class="hint">Aucune pour l'instant.</p>`}</section>
   <section class="card"><h3>Réponses du centre</h3>${centre.length?`<ul class="tplman">${centre.map(row).join("")}</ul>`:`<p class="hint">Aucune.</p>`}${canCentreTpl()?"":`<p class="hint">Gérées par l'administrateur et le secrétariat.</p>`}</section>
  </div>`;
}
function bindTemplates(){
  $("#tp-save").onclick=async()=>{ const title=$("#tp-title").value.trim(), body=$("#tp-body").value.trim(); if(!title||!body) return toast("Indiquez un titre et un texte.");
    const ed=S.tedit, centre=!!$("#tp-centre")?.checked;
    const ok = ed&&ed.id ? await run(()=>sb.from("reply_templates").update({title,body,updated_at:new Date().toISOString()}).eq("id",ed.id),"Enregistré")
                         : await run(()=>sb.from("reply_templates").insert({title,body,owner_id:centre?null:S.me.id}),"Réponse ajoutée");
    if(ok){ S.tedit=null; await loadTeam(); render(); } };
  const c=$("#tp-cancel"); if(c) c.onclick=()=>{ S.tedit=null; render(); };
  $$("[data-tedit]").forEach(b=>b.onclick=()=>{ S.tedit=S.tpls.find(t=>t.id===+b.dataset.tedit)||null; render(); scrollTo(0,0); });
  $$("[data-tdel]").forEach(b=>b.onclick=async()=>{ if(!confirmInline(b,"Supprimer ?")) return; if(await run(()=>sb.from("reply_templates").delete().eq("id",+b.dataset.tdel),"Supprimée")){ await loadTeam(); render(); } });
}

/* ----- classeur du centre ----- */
const BCAT={numero:["Numéros utiles","☎"],procedure:["Procédures","📄"],document:["Documents","📎"]};
function binderHTML(){
  const q=S.bq.toLowerCase(), f=S.bfilter, ed=S.bedit;
  const list=S.binder.filter(b=>(f==="tout"||b.category===f)&&(!q||(b.title+" "+b.body+" "+(b.phone||"")+" "+(b.url||"")).toLowerCase().includes(q)));
  const form=ed?`<section class="card binform"><h3>${ed.id?"Modifier la fiche":"Nouvelle fiche"}</h3>
    <div class="pgrid"><label class="fld">Catégorie<select id="bf-cat">${Object.entries(BCAT).map(([k,[l]])=>`<option value="${k}" ${ed.category===k?"selected":""}>${l}</option>`).join("")}</select></label>
    <label class="fld">Titre<input id="bf-title" maxlength="120" value="${esc(ed.title||"")}" placeholder="Ex. Laboratoire, pharmacie de garde…"></label></div>
    <label class="fld">Texte (facultatif)<textarea id="bf-body" rows="5" maxlength="8000">${esc(ed.body||"")}</textarea></label>
    <div class="pgrid"><label class="fld">Téléphone (facultatif)<input id="bf-phone" maxlength="40" value="${esc(ed.phone||"")}" inputmode="tel"></label>
    <label class="fld">Lien web (facultatif)<input id="bf-url" maxlength="500" value="${esc(ed.url||"")}" placeholder="https://…" inputmode="url"></label></div>
    <label class="fld">Fichier (photo ou PDF, 10 Mo maximum)<input type="file" id="bf-file" accept="image/*,application/pdf"></label>
    ${ed.file_name?`<label class="chk2"><input type="checkbox" id="bf-rmfile"> Retirer le fichier actuel (${esc(ed.file_name)})</label>`:""}
    <div class="btnrow"><button class="btn" id="bf-save">Enregistrer</button><button class="btn ghost" id="bf-cancel">Annuler</button>${ed.id?`<button class="btn ghost danger" id="bf-del">Supprimer</button>`:""}</div></section>`:"";
  return `<div class="chead"><div><h1>Classeur du centre</h1><p>Numéros utiles, procédures et documents de l'équipe. Visible par toute l'équipe, jamais par les patients.</p></div>${ed?"":`<button class="btn" id="b-add">+ Ajouter</button>`}</div>
  <div class="settings">${form}
   <input class="pcq" id="b-q" value="${esc(S.bq)}" placeholder="Rechercher : labo, stérilisation, garde…" aria-label="Rechercher dans le classeur">
   <div class="tabs" role="group" aria-label="Catégorie">${[["tout","Tout"],...Object.entries(BCAT).map(([k,[l]])=>[k,l])].map(([k,l])=>`<button class="tab" data-bf="${k}" aria-pressed="${f===k}">${l}</button>`).join("")}</div>
   ${list.length?list.map(b=>`<details class="bincard"><summary><span class="bic">${BCAT[b.category][1]}</span><span class="btx"><b>${esc(b.title)}</b><small>${esc([b.phone,b.url&&b.url.replace(/^https?:\/\//,"").replace(/\/$/,""),b.file_name].filter(Boolean).join(" · ")||BCAT[b.category][0])}</small></span></summary>
     <div class="bbody">${b.body?`<p>${esc(b.body)}</p>`:""}
      <div class="btnrow">${b.phone?`<a class="btn ghost" href="tel:${esc(b.phone.replace(/[^0-9+]/g,""))}">${SI.phone} Appeler</a>`:""}${b.url?`<a class="btn ghost" href="${esc(b.url)}" target="_blank" rel="noopener">${SI.link} Ouvrir le site</a>`:""}${b.file_name?`<button type="button" class="btn ghost" data-bfile="${b.id}">📎 ${esc(b.file_name)}</button>`:""}<button type="button" class="linkbtn" data-bedit="${b.id}">Modifier</button></div>
      <p class="hint small">Mis à jour ${fmt(b.updated_at)}${b.updated_by?` par ${esc(staffName(b.updated_by))}`:""}</p></div></details>`).join("")
     :`<div class="empty">${S.binder.length?"Aucun résultat.":"Le classeur est vide. Ajoutez la première fiche."}</div>`}
  </div>`;
}
function bindBinder(){
  const add=$("#b-add"); if(add) add.onclick=()=>{ S.bedit={category:S.bfilter!=="tout"?S.bfilter:"numero"}; render(); scrollTo(0,0); };
  const q=$("#b-q"); q.oninput=()=>{ S.bq=q.value; const pos=q.selectionStart; render(); const n=$("#b-q"); n.focus(); n.setSelectionRange(pos,pos); };
  $$("[data-bf]").forEach(b=>b.onclick=()=>{ S.bfilter=b.dataset.bf; render(); });
  $$("[data-bedit]").forEach(b=>b.onclick=()=>{ S.bedit={...S.binder.find(x=>x.id===+b.dataset.bedit)}; render(); scrollTo(0,0); });
  $$("[data-bfile]").forEach(b=>b.onclick=async()=>{ b.disabled=true;
    try{ const {data,error}=await sb.rpc("binder_file",{p_id:+b.dataset.bfile}); if(error) throw error; const d=(data||[])[0]; if(!d) throw new Error("absent");
      const bin=atob(d.data), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); const blob=new Blob([u8],{type:d.mime});
      if(d.mime.startsWith("image")) openViewer(URL.createObjectURL(blob)); else if(IS_NATIVE&&SEC()) await nativePreview(blob,d.name); else window.open(URL.createObjectURL(blob),"_blank","noopener");
    }catch(e){ toast("Ce fichier n'a pas pu être ouvert."); } b.disabled=false; });
  if(!S.bedit) return;
  $("#bf-cancel").onclick=()=>{ S.bedit=null; render(); };
  const del=$("#bf-del"); if(del) del.onclick=async()=>{ if(!confirmInline(del,"Supprimer ?")) return; if(await run(()=>sb.rpc("binder_delete",{p_id:S.bedit.id}),"Fiche supprimée")){ S.bedit=null; await loadTeam(); render(); } };
  $("#bf-save").onclick=async e=>{ const title=$("#bf-title").value.trim(); if(!title) return toast("Indiquez un titre.");
    let url=$("#bf-url").value.trim(); if(url&&!/^https?:\/\//i.test(url)) url="https://"+url;
    const args={p_id:S.bedit.id||null,p_category:$("#bf-cat").value,p_title:title,p_body:$("#bf-body").value,p_phone:$("#bf-phone").value,p_url:url||null,p_mime:null,p_name:null,p_data:null,p_remove_file:!!$("#bf-rmfile")?.checked};
    const f=$("#bf-file").files[0];
    if(f){ if(f.size>10*1048576) return toast("Fichier trop lourd (10 Mo maximum).");
      const isPdf=f.type==="application/pdf"||/\.pdf$/i.test(f.name); e.target.disabled=true;
      try{ const blob=isPdf?f:await shrinkImage(f); args.p_mime=isPdf?"application/pdf":"image/jpeg"; args.p_name=(isPdf?(f.name||"document.pdf"):"photo.jpg").slice(0,120); args.p_data=await blobToB64(blob); }
      catch(err){ e.target.disabled=false; return toast("Ce fichier n'a pas pu être lu."); } }
    e.target.disabled=true;
    if(await run(()=>sb.rpc("binder_save",args),"Fiche enregistrée")){ S.bedit=null; await loadTeam(); render(); } else e.target.disabled=false; };
}

function staffHelpHTML(){
  const Q=[
   ["Répondre à un patient","Ouvrez la demande dans « Demandes », écrivez votre message en bas (texte, photo, document ou message vocal), puis Envoyer. Quand tout est réglé, touchez « Clôturer »."],
   ["Transmettre une demande à un collègue","Dans la demande, touchez « Transférer » et choisissez le collègue. Il est prévenu tout de suite."],
   ["Écrire à un patient qui n'a rien demandé","Bouton « Écrire à un patient » (en haut sur ordinateur, au centre de la barre sur téléphone), puis cherchez le patient."],
   ["Être prévenu sur mon téléphone","Mon profil et notifications → « Quand me prévenir » et « Activer les notifications ». Vous pouvez aussi choisir d'être prévenu en dehors des heures d'ouverture."],
   ["Je suis absent(e)","Mon profil et notifications → « En cas d'absence » : vos alertes peuvent être renvoyées à un collègue, avec un message automatique pour les patients."],
   ["Écrire à un collègue","Onglet « Messages » : conversations à deux ou en groupe, et « Tout le centre ». Le bouton 📋 joint une demande de patient : votre collègue l'ouvre en un clic s'il y a accès. Les messages sont effacés après 90 jours."],
   ["Réponses types","Dans une demande, le bouton 💬 à côté de la zone de message insère un texte prêt (le prénom du patient est ajouté). Créez les vôtres dans Moi → Mes réponses types."],
   ["Le classeur du centre","Le centre → Classeur : numéros utiles, procédures et documents. Toute l'équipe peut ajouter et modifier les fiches."],
   ["Le menu","Sur ordinateur, le menu est à gauche, rangé en 4 rubriques : Patients (demandes, écrire, fiches, listes d'attente), Équipe (messages, tâches, congés), Secrétariat (accueil, horaires, caisse) et Le centre (actualités, classeur, inventaire). Sur téléphone : la barre du bas, et « Plus » pour tout le reste. Le chiffre rouge indique ce qui attend."],
   ["Rechercher","La loupe (ou Ctrl K sur ordinateur) cherche partout : patients, demandes et leurs messages, messages de l'équipe, tâches, fiches, listes d'attente, inventaire, classeur, actualités, réponses types, caisse. Touchez un résultat pour l'ouvrir."],
   ["Épingler et classer les conversations","Messages : touchez « Épingler » en haut d'une conversation pour la garder tout en haut de votre liste (vos épingles ne changent rien pour les collègues). Les filtres Non lues · Groupes · À deux · Patients trient la liste."],
   ["Ce qui est gardé, ce qui est effacé","Gardé : messages de l'équipe sur l'organisation, inventaire, congés, tâches sans patient, classeur, horaires (5 ans), caisse (10 ans). Effacé : conversations avec les patients (15 jours après la clôture), conversations d'équipe marquées « Concerne des patients » et messages qui joignent une demande (90 jours), tâches liées à un patient (90 jours après)."],
   ["Agenda Rosa","« Agenda Rosa » ouvre votre agenda Rosa dans l'app (téléphone) ou dans une fenêtre à côté (ordinateur). Connexion avec votre propre compte Rosa."],
   ["Horaires de l'accueil","Secrétariat → Horaires : touchez une case pour encoder l'arrivée, le départ et la pause d'une accueillante (ou un congé, une maladie…) ; chaque accueillante peut corriger les heures de toute l'équipe de l'accueil. Sous le tableau, une case libre pour les désidératas et indisponibilités de la semaine. Les heures de la semaine se calculent toutes seules. L'administration valide la semaine. Onglet « Mois » : le total par personne et le fichier Excel pour le secrétariat social."],
   ["Caisse","Secrétariat → Caisse : encodez chaque paiement en espèces (montant, prestataire, prestation). Jamais de nom de patient. Une erreur ne s'efface pas : « Annuler » avec un motif. Le 1er du mois, le résumé du mois précédent part par e-mail à l'administration, avec le fichier Excel."],
   ["Trouver et trier les demandes","Onglet Demandes : « Les miennes / Secrétariat / Tout le centre » choisit les demandes affichées ; la recherche trouve un patient par son nom ; les pastilles colorées filtrent par type. Les demandes sont rangées par ce qu'il faut faire : urgent ou en retard, le patient a répondu, nouvelles. « En attente du patient » (vous avez répondu) est replié en bas. Les renouvellements simples peuvent être accordés à la suite dans « Prescriptions en série », après les avoir faits dans CareConnect."],
   ["Un patient sans compte dans l'app","Patients → Fiches patients : créez une fiche (nom, prénom, date de naissance, téléphone, e-mail). Vous pouvez ensuite lui lier une tâche, en parler à un collègue (« En parler ») ou l'inviter par e-mail à créer son compte. Jamais de note médicale dans une fiche. Quand le patient s'inscrit, l'administrateur relie son compte à la fiche dans Comptes à valider."],
   ["Photos de l'accueil des patients","Administrateur : Le centre → Actualités → « Photos de l'accueil des patients ». Ajoutez jusqu'à 8 photos du centre (en paysage, jamais de patient reconnaissable), une légende si vous voulez, et l'ordre avec ↑ ↓. Elles défilent en haut de l'accueil des patients."],
   ["La liste de l'accueil","Secrétariat → Accueil : la liste commune du secrétariat (appels à passer, choses à ne pas oublier). Écrivez la tâche, choisissez le jour et, si besoin, l'heure (« vers 14h30 ») : à cette heure-là, le secrétariat reçoit une notification. Toute l'équipe peut y ajouter quelque chose ; le secrétariat coche quand c'est fait."],
   ["Les listes d'attente","Patients → Listes d'attente : un patient à rappeler en cas de désistement, pour un prestataire. Ajoutez-le (patient de l'app, fiche ou simplement nom + téléphone), avec un motif court et ses disponibilités. Quand une place se libère : « Pas de réponse » note l'appel, « RDV fixé » le retire de la liste. Jamais de détail médical."],
   ["Rassurer le patient : « Vu »","Dans une demande, le bouton « ✓ Vu · prévenir le patient » lui affiche « Votre demande a été vue… Elle est en cours de traitement » et lui envoie une notification (sans e-mail). Au transfert, la case « Prévenir le patient » (cochée) lui indique à qui sa demande a été transmise."],
   ["Transférer avec un mot","Dans une demande, choisissez le collègue dans « Transférer à », écrivez un mot dans le champ en dessous, puis Transférer. Le collègue voit le mot en haut de la demande ; le patient ne le voit jamais."],
   ["Ne pas être dérangé(e)","Touchez la cloche en haut de l'écran (à côté de « Écrire à un patient »). « Pause des notifications » : 1 heure, jusqu'à demain 8 h ou jusqu'à ce que vous la retiriez ; les demandes arrivent toujours dans l'app et vous recevez un résumé à la fin de la pause. « Je suis absent(e) » : vos alertes vont au collègue choisi et les patients reçoivent un message automatique. Cloche barrée orange = en pause ; rouge = absent(e)."],
   ["Rappel avant l'échéance d'une tâche","Équipe → Tâches : mettez une échéance, cochez « Recevoir un rappel par e-mail » et choisissez quand (le jour même, la veille, 48 h, 72 h ou 1 semaine avant). L'e-mail part à 8 h vers la personne qui doit faire la tâche. Vous pouvez changer le rappel d'une tâche existante avec la petite cloche 🔔. Les tâches sont classées de la plus urgente à la moins urgente."],
   ["Ordinateur de confiance (accueil)","Au moment du code de sécurité, cochez « Faire confiance à cet ordinateur » : pendant 90 jours, l'e-mail et le mot de passe suffisent sur cet ordinateur, avec déconnexion après 2 heures d'inactivité. Uniquement sur un ordinateur du centre. Pour le retirer : Mon profil et notifications → Ordinateurs de confiance."],
   ["Valider les comptes des patients","Seul un administrateur valide les nouveaux comptes et les enfants ajoutés par un parent (Patients → Comptes à valider). Un administrateur peut donner ces droits à n'importe quel membre de l'équipe (secrétariat compris) : Équipe → Comptes de l'équipe → case « Administrateur ». La personne garde son rôle."],
   ["Face ID sur l'iPhone","Dans l'app iPhone : Mon profil et notifications → Face ID. Ensuite l'app se déverrouille avec votre visage, sans code."],
   ["Un problème avec l'app","Prévenez l'administrateur du centre en précisant l'écran concerné (une capture d'écran aide beaucoup)."]];
  return `<div class="chead"><div><h1>Aide</h1><p>Les réponses aux questions les plus fréquentes de l'équipe.</p></div></div>
  <div class="settings">${Q.map(([q,r])=>`<details class="faq card"><summary>${q}</summary><p>${r}</p></details>`).join("")}${versionHTML()}</div>`;
}
function renderStaff(a){
  a.className="wrap wide staff";
  const sc=S.cscreen;
  const nav=staffNavHTML(sc);
  let body="";
  if(sc==="compose") body=composeHTML(); else if(sc==="inventory") body=inventoryHTML(); else if(sc==="tasks") body=tasksHTML(); else if(sc==="accounts") body=accountsHTML(); else if(sc==="news") body=newsAdminHTML(); else if(sc==="team") body=teamHTML(); else if(sc==="settings") body=settingsHTML(); else if(sc==="help") body=staffHelpHTML(); else if(sc==="leaves") body=leavesHTML(); else if(sc==="patients") body=patientsHTML(); else if(sc==="messages") body=teamHTML2(); else if(sc==="templates") body=templatesHTML(); else if(sc==="binder") body=binderHTML(); else if(sc==="desk") body=deskHTML(); else if(sc==="waitlist") body=waitlistHTML(); else if(sc==="fiches") body=fichesHTML(); else if(sc==="hours"&&canOffice()) body=hoursHTML(); else if(sc==="cash"&&canOffice()) body=cashHTML(); else body=inboxHTML();
  document.body.classList.add("hasbar","sidenav"); document.body.classList.remove("ddopen");
  a.innerHTML=nav+urgBannerHTML()+body;
  $("#logout").onclick=()=>{ closeDD(); logout(); };
  $$("[data-urgopen]").forEach(b=>b.onclick=()=>{ const r=S.reqs.find(x=>x.id===+b.dataset.urgopen); if(!r) return;
    S.cscreen="inbox"; S.archive=false; S.itype="all"; S.iq=""; S.short=false; S.sel=r.id;
    S.scope=r.queue==="prestataires"?(r.provider_id===S.me.provider_id?"mine":"prestataires"):r.queue; render(); scrollTo(0,0); });
  $$("[data-avail]").forEach(ab=>ab.onclick=e=>{ e.stopPropagation(); closeDD(); openAvail(); });
  $$("[data-dd]").forEach(b=>b.onclick=e=>{ e.stopPropagation(); openDD(b.dataset.dd); });
  const bk=$(".ddback"); if(bk) bk.onclick=closeDD;
  $$("[data-cs]").forEach(b=>b.onclick=()=>{ closeDD(); if(CREC&&b.dataset.cs!=="compose") composeRecStop(false); S.cscreen=b.dataset.cs; render(); window.scrollTo(0,0); });
  if(sc==="compose") bindCompose(); else if(sc==="inventory") bindInventory(); else if(sc==="tasks") bindTasks(); else if(sc==="accounts") bindAccounts(); else if(sc==="news") bindNewsAdmin(); else if(sc==="team") bindTeam(); else if(sc==="settings") bindSettings(); else if(sc==="help"||sc==="leaves") {} else if(sc==="patients") bindPatients(); else if(sc==="messages") bindTeam2(); else if(sc==="templates") bindTemplates(); else if(sc==="binder") bindBinder(); else if(sc==="desk") bindDesk(); else if(sc==="waitlist"){ if(S.waitlist) bindWaitlist(); } else if(sc==="fiches") bindFiches(); else if(sc==="hours"&&canOffice()) bindHours(); else if(sc==="cash"&&canOffice()) bindCash(); else bindInbox();
}

/* ----- durée estimée des rendez-vous de médecine générale (visible par l'équipe seulement) ----- */
function rdvMinutes(r){ const a=r.answers||{};
  if(r.type!=="rdv"||a.specialite!==GP||!a.motif||!S.durations) return undefined;
  return S.durations[a.motif]??null; }
function durHTML(r){ const m=rdvMinutes(r); if(m===undefined) return "";
  const dep=(r.answers||{}).lieu==="Visite à domicile"?" + déplacement":"";
  return `<span class="durtag ${m!==null&&m<=10?"short":""}" title="Durée estimée de la consultation">⏱ ${m===null?"À évaluer":"~"+m+" min"}${dep}</span>`; }
const isShort = r => { const m=rdvMinutes(r); return m!=null && m<=10; };

/* ----- boîte de réception ----- */
/* ---------- liste des demandes : vues, recherche, filtres, groupes par action ---------- */
function scopeOpts(){
  const qs=new Set(S.reqs.map(r=>r.queue)), o=[];
  if(S.me.provider_id&&(S.me.role==="provider"||S.me.role==="admin")) o.push(["mine","Les miennes"]);
  if(qs.has("secretariat")) o.push(["secretariat","Secrétariat"]);
  if(qs.has("administration")) o.push(["administration","Administration"]);
  if(qs.has("prestataires")&&!o.some(x=>x[0]==="mine")) o.push(["prestataires","Prestataires"]);
  if(o.length>1) o.push(["all","Tout le centre"]);
  if(!o.length) o.push(["all","Toutes"]);
  return o;
}
function inScope(r){ const sc=S.scope;
  if(sc==="all") return true;
  if(sc==="mine") return r.queue==="prestataires"&&r.provider_id===S.me.provider_id;
  return r.queue===sc; }
const SCOPE_TITLE={mine:"Mes demandes",secretariat:"Demandes du secrétariat",administration:"Demandes de l'administration",prestataires:"Demandes des prestataires",all:"Toutes les demandes"};
const ITYPES=["rdv","question","prescription","rapport","document","resultats"];
const IEMO={rdv:"📅",question:"💬",prescription:"💊",rapport:"📝",document:"📎",resultats:"🧪",centre:"✉️"};
const lastAt = r => { const m=msgsOf(r); return new Date(m.length?m[m.length-1].created_at:r.created_at); };
const isLate = r => awaitingStaff(r)&&r.due_at&&new Date(r.due_at)<new Date();
const reqGroup = r => r.status==="traite"?9:!awaitingStaff(r)?3:(r.priority==="haute"||isLate(r))?0:newPatientMsg(r)?1:2;
function iqMatch(r){ const w=norm(S.iq||"").split(/\s+/).filter(Boolean); if(!w.length) return true;
  const hay=norm(`${reqName(r)} ${r.child_id?patientName(r.patient_id):""}`); return w.every(x=>hay.includes(x)); }
function inboxBase(){ return S.reqs.filter(inScope).filter(iqMatch).filter(r=>S.archive?r.status==="traite":r.status!=="traite"); }
function inboxList(){
  const base=inboxBase().filter(r=>S.itype==="all"||r.type===S.itype).filter(r=>S.archive||!S.short||isShort(r));
  if(S.archive) return base.sort((a,b)=>new Date(b.closed_at||0)-new Date(a.closed_at||0));
  return base.sort((x,y)=>reqGroup(x)-reqGroup(y)||(reqGroup(x)===1?lastAt(y)-lastAt(x):reqGroup(x)===3?lastAt(y)-lastAt(x):new Date(x.due_at||8.64e15)-new Date(y.due_at||8.64e15)));
}
function durShort(ms){ const h=Math.round(ms/3600e3); return h<1?"moins d'1 h":h<48?`${h} h`:`${Math.round(h/24)} j`; }
function dueTagI(r){
  if(r.status==="traite") return `<span class="pill st-${stClass(r)}">${stLabel(r)}</span>`;
  if(!awaitingStaff(r)) return `<span class="ipill wait">attend le patient</span>`;
  if(isLate(r)) return `<span class="ipill late">en retard · ${durShort(Date.now()-new Date(r.due_at))}</span>`;
  if(newPatientMsg(r)) return `<span class="ipill rep">nouveau message</span>`;
  if(r.priority==="haute") return `<span class="ipill hi">avant ${r.due_at?fmtWhen(r.due_at):"—"}</span>`;
  return `<span class="ipill no">${r.priority==="basse"?"pas pressé":"normale"}</span>`; }
function irowHTML(r){ const ms=msgsOf(r), last=ms[ms.length-1];
  const rx=r.type==="prescription"&&(r.request_items||[]).length?(r.request_items||[]).map(i=>i.label+(i.quantity>1?` ×${i.quantity}`:"")).join(", "):"";
  const prev=newPatientMsg(r)&&last?`« ${msgPreview(last)} »`:rx||summaryLine(r.answers);
  return `<button class="row irow${r.status!=="traite"&&awaitingStaff(r)&&(r.priority==="haute"||isLate(r))?" ihot":""}" data-sel="${r.id}" aria-current="${r.id===S.sel}"><div class="ic t-${r.type}" aria-hidden="true">${IEMO[r.type]||IC[r.type]}</div>
   <div class="itx"><b>${esc(reqName(r))}</b>${r.child_id?` <span class="ipill no">enfant</span>`:""}<small>${TYPES[r.type].label}${prev?" · "+esc(prev):""}</small>${durHTML(r)}${S.scope==="all"?`<small class="iwho">${esc(reqWho(r))}</small>`:""}</div>
   <div class="iside">${dueTagI(r)}<small>${r.status==="traite"?fmt(r.closed_at):ms.length?fmt(last.created_at):"reçue "+fmt(r.created_at)}</small></div></button>`; }
// regroupement par jour (liste longue) : on touche le jour pour voir ses demandes
const dKey = d => { const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`; };
function dLabel(k){ const t=todayISO(), y=dKey(Date.now()-864e5); if(k===t) return "Aujourd'hui"; if(k===y) return "Hier";
  const d=new Date(k+"T12:00"), o={weekday:"long",day:"numeric",month:"long"}; if(d.getFullYear()!==new Date().getFullYear()) o.year="numeric";
  const s=d.toLocaleDateString(LOC,o); return s.charAt(0).toUpperCase()+s.slice(1); }
S.dayOpen=S.dayOpen||{};
function dayGroupsHTML(L, when, ns){
  const keys=[...new Set(L.map(r=>dKey(when(r))))].sort().reverse();
  return keys.map((k,i)=>{ const its=L.filter(r=>dKey(when(r))===k), id=ns+":"+k, open=S.dayOpen[id]??(i===0||its.some(r=>r.id===S.sel));
    return `<button type="button" class="iday" data-day="${id}" aria-expanded="${open}"><span>${esc(dLabel(k))}</span><span><b>${its.length}</b> ${open?"▾":"▸"}</span></button>${open?its.map(irowHTML).join(""):""}`; }).join("");
}
// demandes prioritaires qui me concernent directement (ma file de travail)
const myQueue = r => r.queue==="prestataires" ? !!S.me.provider_id&&r.provider_id===S.me.provider_id
  : r.queue==="secretariat" ? S.me.role==="secretariat" : r.queue==="administration" ? S.me.role==="gestion" : false;
const myUrgent = () => (S.reqs||[]).filter(r=>r.status!=="traite"&&awaitingStaff(r)&&(r.priority==="haute"||isLate(r))&&myQueue(r))
  .sort((a,b)=>new Date(a.due_at||8.64e15)-new Date(b.due_at||8.64e15));
function urgBannerHTML(){
  const U=myUrgent(); if(!U.length) return "";
  const r=U[0], late=isLate(r), nm=reqName(r).split(/\s+/), who=nm[0]+(nm[1]?" "+nm[1][0]+".":"");
  return `<button type="button" class="urgban" data-urgopen="${r.id}"><span class="ubdot" aria-hidden="true"></span><span><b>${U.length===1?"1 demande prioritaire attend une réponse":U.length+" demandes prioritaires attendent une réponse"}</b>
    <small>${late?"En retard":"À traiter avant "+fmtWhen(r.due_at)} · ${esc(who)} · ${TYPES[r.type]?.label||""}</small></span><span class="ubgo">Voir ›</span></button>`;
}
const IGROUPS=[["g0","🔴 Urgent ou en retard"],["g1","💬 Le patient a répondu"],["g2","🆕 Nouvelles"],["g3","⏳ En attente du patient"]];
// Prescriptions simples (traitement habituel, sans remarque) : à accorder en série
const isSimpleRx = r => r.type==="prescription"&&r.status!=="traite"&&awaitingStaff(r)&&(r.request_items||[]).length>0&&(r.request_items||[]).every(i=>!i.decision)
  &&r.answers?.historique==="Oui, c'est mon traitement habituel"&&!(r.answers?.remarque||"").trim()&&msgsOf(r).length===0;
function rxBatchHTML(){
  if(S.archive) return ""; const L=inboxBase().filter(isSimpleRx); if(L.length<2) return "";
  return `<section class="rxbatch"><h3>💊 Prescriptions en série <span class="ipill no">${L.length}</span></h3>
   <p class="hint">Renouvellements du traitement habituel, sans remarque du patient. <b>Faites d'abord la prescription dans CareConnect</b>, puis « Accorder » : le patient est prévenu et la demande est classée.</p>
   ${L.map(r=>`<div class="rxb"><div><b>${esc(reqName(r))}</b><small>${(r.request_items||[]).map(i=>esc(i.label)+(i.quantity>1?` ×${i.quantity}`:"")).join(" · ")}</small></div><div class="rxbact"><button class="btn small" data-rxok="${r.id}">Accorder</button><button class="btn ghost small" data-sel="${r.id}">Ouvrir</button></div></div>`).join("")}</section>`; }
const greetWord = () => { const h=new Date().getHours(); return h<18?"Bonjour":"Bonsoir"; };
function inboxHTML(){
  const opts=scopeOpts();
  if(!S.scope) S.scope=S.me.role==="gestion"?"administration":S.me.role==="secretariat"?"secretariat":"mine";
  if(!opts.some(o=>o[0]===S.scope)) S.scope=opts[0][0];
  if(!S.itype) S.itype="all";
  const base=inboxBase(), list=inboxList();
  if(!list.find(r=>r.id===S.sel)) S.sel=(list.find(r=>reqGroup(r)!==3)||list[0])?.id??null;
  const todo=S.reqs.filter(inScope).filter(r=>r.status!=="traite"&&awaitingStaff(r)), urg=todo.filter(r=>reqGroup(r)===0).length;
  const now=new Date(), nArch=S.reqs.filter(inScope).filter(r=>r.status==="traite").length;
  const nShort=base.filter(r=>r.status!=="traite"&&isShort(r)).length;
  const cnt=k=>base.filter(r=>r.type===k).length;
  let body="";
  if(!list.length) body=`<div class="empty">${S.iq?"Aucune demande ne correspond à la recherche.":S.archive?"Aucune conversation classée.":`<span class="yay" aria-hidden="true">🎉</span><b>Tout est traité !</b><br>Rien à traiter pour l'instant.`}</div>`;
  else if(S.archive) body=list.length>8?dayGroupsHTML(list,r=>r.closed_at||r.created_at,"a"):list.map(irowHTML).join("");
  else if(list.filter(r=>reqGroup(r)!==3).length>10){
    // beaucoup de demandes : les prioritaires épinglées en haut, le reste rangé par jour
    const U=list.filter(r=>reqGroup(r)===0), R=list.filter(r=>reqGroup(r)===1||reqGroup(r)===2), W=list.filter(r=>reqGroup(r)===3);
    if(U.length) body+=`<div class="igroup g0">📌 ${IGROUPS[0][1].replace("🔴 ","")} <b>${U.length}</b></div>${U.map(irowHTML).join("")}`;
    if(R.length) body+=`<div class="igroup g2">À traiter, par jour <b>${R.length}</b></div>${dayGroupsHTML(R.sort((a,b)=>reqGroup(a)-reqGroup(b)||lastAt(b)-lastAt(a)),lastAt,"o")}`;
    if(W.length) body+=`<button type="button" class="igroup g3 itoggle" id="i-wait" aria-expanded="${!!S.showWait}"><span>${IGROUPS[3][1]} <b>${W.length}</b></span><span>${S.showWait?"masquer ‹":"afficher ›"}</span></button>${S.showWait?W.map(irowHTML).join(""):""}`;
  }
  else { for(let g=0;g<4;g++){ const L=list.filter(r=>reqGroup(r)===g); if(!L.length) continue;
      if(g===3){ body+=`<button type="button" class="igroup g3 itoggle" id="i-wait" aria-expanded="${!!S.showWait}"><span>${IGROUPS[3][1]} <b>${L.length}</b></span><span>${S.showWait?"masquer ‹":"afficher ›"}</span></button>${S.showWait?L.map(irowHTML).join(""):""}`; }
      else body+=`<div class="igroup g${g}">${IGROUPS[g][1]} <b>${L.length}</b></div>${L.map(irowHTML).join("")}`; } }
  return `<div class="chead"><div><p class="greet">${greetWord()} ${esc(S.me.first_name||"")} 👋</p><h1>${SCOPE_TITLE[S.scope]||"Demandes"}</h1>
   <p>${now.toLocaleDateString(LOC,{weekday:"long",day:"numeric",month:"long"})} · ${isOpen(now)?'<span class="state on">Ouvert</span>':`<span class="state off">Fermé · réouverture ${fmtWhen(nextOpen(now))}</span>`} · ${todo.length?`<b>${todo.length}</b> demande${todo.length>1?"s":""} attend${todo.length>1?"ent":""} une réponse${urg?`, dont <b class="urgtxt">${urg} urgente${urg>1?"s":""}</b>`:""}`:"aucune demande en attente"}</p></div></div>
  <div class="ibar"><input id="i-q" type="search" class="isearch" placeholder="🔎 Rechercher un patient…" value="${esc(S.iq||"")}" aria-label="Rechercher un patient">
   ${opts.length>1?`<div class="seg" role="group" aria-label="Quelles demandes">${opts.map(([k,l])=>`<button data-scope="${k}" aria-pressed="${S.scope===k}">${l}</button>`).join("")}</div>`:""}
   <div class="seg" role="group" aria-label="Filtrer"><button id="f-open" aria-pressed="${!S.archive}">À traiter</button><button id="f-arch" aria-pressed="${!!S.archive}">Classées (${nArch})</button></div></div>
  <div class="ichips" role="group" aria-label="Type de demande"><button class="ichip all" data-itype="all" aria-pressed="${S.itype==="all"}">Toutes <i>${base.length}</i></button>${ITYPES.filter(k=>cnt(k)||S.itype===k).map(k=>`<button class="ichip t-${k}" data-itype="${k}" aria-pressed="${S.itype===k}">${IEMO[k]} ${TYPES[k].label}${k==="question"||k==="rapport"||k==="document"?"s":k==="rdv"?"":k==="prescription"?"s":""} <i>${cnt(k)}</i></button>`).join("")}${!S.archive&&(nShort||S.short)?`<button class="ichip" id="f-short" aria-pressed="${!!S.short}" title="Rendez-vous de médecine générale de 10 minutes ou moins">⏱ Rendez-vous courts <i>${nShort}</i></button>`:""}</div>
  <div class="pane">
   <div class="list inbox">${body}</div>
   <div id="detail">${rxBatchHTML()}${detailHTML()}</div>
  </div>`;
}
function detailHTML(){
  const r=S.reqs.find(x=>x.id===S.sel); if(!r) return "";
  const p=S.profiles[r.patient_id]||{}, open=r.status!=="traite", items=r.request_items||[];
  const isRx=r.type==="prescription"&&open&&items.some(i=>!i.decision);
  const dec=S.drafts["d"+r.id]||{}; const allDecided=isRx&&items.filter(i=>!i.decision).every(i=>dec[i.id]);
  const draft=S.drafts["s"+r.id]||"";
  const staffWrote=msgsOf(r).some(m=>!m.from_patient&&!/· message automatique$/.test(m.author_label||""));
  const canClose=isRx?allDecided:(staffWrote||!!draft.trim());
  const todo=items.filter(i=>!i.decision);
  const closeBtn=!isRx?"Clôturer et classer":!allDecided?`Décidez pour chaque médicament (${todo.filter(i=>dec[i.id]).length}/${todo.length})`:todo.some(i=>dec[i.id]==="accorde")?"Valider la prescription et classer":"Envoyer le refus et classer";
  const transferOpts=[`<option value="">Secrétariat</option>`,`<option value="__admin" ${r.queue==="administration"?"selected":""}>Administration</option>`,...S.providers.map(pv=>`<option value="${pv.id}" ${pv.id===r.provider_id?"selected":""}>${esc(P.label(pv))}</option>`)].join("");
  return `<div class="detail">
   <div class="dhead">${r.child_id?avatarHTML(null,reqName(r),52):avatarHTML(AV.get(r.patient_id),patientName(r.patient_id),52)}<div><h2>${esc(reqName(r))}</h2>
    ${r.child_id?`<div class="pinfo"><span>Né(e) le <b>${fmtDate(S.children[r.child_id]?.birth_date)}</b></span><span>Enfant de <b>${esc(patientName(r.patient_id))}</b></span><span>Tél. parent <b>${esc(p.phone||"—")}</b></span></div>`
    :`<div class="pinfo"><span>Né(e) le <b>${fmtDate(p.birth_date)}</b></span><span>Tél. <b>${esc(p.phone||"—")}</b></span></div>`}
    ${extraContactsHTML(p)}
    <div class="meta" style="margin-top:6px"><span class="tag">${TYPES[r.type].label}</span>${durHTML(r)}<span class="pill st-${stClass(r)}">${stLabel(r)}</span><span>Reçue ${fmt(r.created_at)} · ${esc(reqWho(r))}</span></div></div></div>
   ${open?`<div class="prioedit"><span class="hint">Priorité</span>${["haute","normale","basse"].map(k=>`<button class="dec p-${k}" aria-pressed="${r.priority===k}" data-prio="${k}">${PRIO_LABEL[k]}</button>`).join("")}</div><div>${dueHTML(r)}</div>`:""}
      ${open&&r.type!=="centre"?(canMarkSeen(r)?`<div class="seenrow"><button class="btn ghost seenbtn" id="seen">✓ Vu · prévenir le patient</button><span class="hint">Le patient voit que sa demande est en cours de traitement (notification, sans e-mail).</span></div>`
     :seenSinceLast(r)?`<div class="seenrow"><span class="seenok">✓ Patient prévenu ${fmt(seenSinceLast(r).created_at)}</span></div>`:""):""}
   ${notesHTML(r)}
   ${r.purged_at?"":`<dl class="qa">${Object.entries(r.answers||{}).filter(([k])=>!HIDDEN_KEYS.has(k)).map(([k,v])=>`<div><dt>${esc(LABELS[k]||k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`}
   ${items.some(i=>i.decision)?`<div class="itemlist">${items.filter(i=>i.decision).map(i=>`<div><span>${esc(i.label)}<small class="qty">${qtyText(i.quantity||1)}</small></span><span class="dtag ${i.decision==="accorde"?"ok":"no"}">${i.decision==="accorde"?"Accordé":"Refusé"}</span></div>`).join("")}</div>`:""}
   ${msgsOf(r).length||(r.request_updates||[]).length||r.purged_at||!open?chatHTML(r,"centre"):""}
   ${open?`${isRx?`<div class="rx"><p class="hint" style="margin:0">Décision par médicament</p>${todo.map(it=>`<div class="rxrow"><span>${esc(it.label)}<b class="qty">${qtyText(it.quantity||1)}</b></span><div class="decs"><button class="dec ok" aria-pressed="${dec[it.id]==="accorde"}" data-dec="${it.id}:accorde">Accorder</button><button class="dec no" aria-pressed="${dec[it.id]==="refuse"}" data-dec="${it.id}:refuse">Refuser</button></div></div>`).join("")}</div>`:""}
   ${composerHTML("s"+r.id)}
   <div class="btnrow"><button class="btn" id="close" ${canClose?"":"disabled"}>${closeBtn}</button></div>
   <p class="hint">Le message écrit ci-dessus est envoyé avec la clôture. <b>Avant de classer, reportez dans CareConnect ce qui doit rester au dossier</b> : la conversation et ses pièces jointes sont effacées ${PURGE_DAYS} jours après la clôture.</p>
   <div class="transfer">${r.status==="nouveau"?'<button class="linkbtn" id="take">Je m\'en occupe</button>':""}<label class="hint" for="tr">Transférer à</label><select id="tr">${transferOpts}</select><button class="linkbtn" id="dotr">Transférer</button>
    <textarea id="trnote" class="trnote" rows="2" maxlength="1000" placeholder="Un mot pour le collègue (facultatif) : visible seulement par l'équipe, jamais par le patient"></textarea>
    ${r.type!=="centre"?`<label class="chk2 trinform"><input type="checkbox" id="trinform" checked> Prévenir le patient que sa demande est transmise</label>`:""}</div>
   <p class="hint">Envoyer garde la conversation ouverte. Pas de diagnostic ni de résultat détaillé par message : pour un problème médical, proposez un rendez-vous.</p>`
   :r.purged_at?`<div class="closed"><b>Contenu effacé le ${fmtDate(r.purged_at)}</b><span>Effacement automatique ${PURGE_DAYS} jours après la clôture.</span></div>`
   :`<div class="closed"><b>Classée ${r.closed_at?fmt(r.closed_at):""}</b><span>Le patient peut la relire mais plus y écrire. Effacement automatique le ${fmtDate(purgeDate(r))}.</span><button class="btn ghost" id="reopen">Rouvrir</button></div>`}
  </div>`;
}
// Mots laissés lors d'un transfert (visibles seulement par l'équipe)
function notesHTML(r){ const N=(S.notes||[]).filter(n=>n.request_id===r.id); if(!N.length) return "";
  return `<div class="tnotes">${N.map(n=>`<div class="tnote"><span aria-hidden="true">📝</span><div><small>Mot de <b>${esc(teamName(n.author_id))}</b>${n.target?` pour <b>${esc(n.target)}</b>`:""} · ${fmt(n.created_at)} · <i>visible seulement par l'équipe</i></small><p>${esc(n.body)}</p></div></div>`).join("")}</div>`; }
const opened=new Set();
function bindInbox(){
  $$("[data-scope]").forEach(b=>b.onclick=()=>{ S.scope=b.dataset.scope; S.sel=null; render(); });
  $$("[data-itype]").forEach(b=>b.onclick=()=>{ S.itype=b.dataset.itype; S.sel=null; render(); });
  $("#f-open").onclick=()=>{ S.archive=false; S.sel=null; render(); };
  $("#f-arch").onclick=()=>{ S.archive=true; S.sel=null; render(); };
  const fs=$("#f-short"); if(fs) fs.onclick=()=>{ S.short=!S.short; S.sel=null; render(); };
  const w=$("#i-wait"); if(w) w.onclick=()=>{ S.showWait=!S.showWait; render(); };
  $$("[data-day]").forEach(b=>b.onclick=()=>{ S.dayOpen[b.dataset.day]=b.getAttribute("aria-expanded")!=="true"; render(); });
  const q=$("#i-q"); let tm; q.oninput=()=>{ clearTimeout(tm); tm=setTimeout(()=>{ S.iq=q.value; S.sel=null; render(); const n=$("#i-q"); if(n){ n.focus(); n.setSelectionRange(n.value.length,n.value.length); } },250); };
  $$("[data-sel]").forEach(b=>b.onclick=()=>{ clearPend(); S.sel=+b.dataset.sel; render(); if(innerWidth<760) $("#detail").scrollIntoView({behavior:"smooth"}); });
  $$("[data-rxok]").forEach(b=>b.onclick=async()=>{ if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent="Confirmer ?"; return; }
    const r=S.reqs.find(x=>x.id===+b.dataset.rxok); if(!r) return; b.disabled=true;
    const dec={}; (r.request_items||[]).forEach(i=>dec[i.id]="accorde");
    if(await run(()=>sb.rpc("close_request",{p_id:r.id,p_body:null,p_decisions:dec}),`Prescription accordée · ${reqName(r)} prévenu(e)`)) await refresh(); else b.disabled=false; });
  bindDetail();
}
function bindDetail(){
  const r=S.reqs.find(x=>x.id===S.sel); if(!r) return;
  if(!opened.has(r.id)){ opened.add(r.id); sb.rpc("mark_request_opened",{p_id:r.id}).then(()=>{}); }
  const ro=$("#reopen"); if(ro){ ro.onclick=async()=>{ if(await run(()=>sb.rpc("reopen_request",{p_id:r.id}),"Conversation rouverte")){ S.archive=false; await refresh(); } }; return; }
  if(r.status==="traite") return;
  const close=$("#close"), key="s"+r.id;
  const isRx=r.type==="prescription"&&(r.request_items||[]).some(i=>!i.decision);
  const dec=S.drafts["d"+r.id]||(S.drafts["d"+r.id]={});
  bindComposer(key, async (text,pend)=>{
    const ok = pend ? await uploadAtt(r.id,pend,text) : await run(()=>sb.rpc("staff_message",{p_id:r.id,p_body:text}),"Message envoyé · patient notifié");
    if(!ok) return false;
    S.drafts[key]=""; clearPend(); await refresh(); return true;
  }, v=>{ if(!isRx) close.disabled=!(msgsOf(r).some(m=>!m.from_patient)||v.trim()); });
  bindTplPicker(r);
  $$("[data-prio]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_request_priority",{p_id:r.id,p_priority:b.dataset.prio}),`Priorité : ${PRIO_LABEL[b.dataset.prio]}`)) await refresh(); });
  $$("[data-dec]").forEach(b=>b.onclick=()=>{ const [id,d]=b.dataset.dec.split(":"); dec[id]=dec[id]===d?undefined:d; if(!dec[id]) delete dec[id]; render(); });
  close.onclick=async()=>{ close.disabled=true; const text=($("#c-text")?.value||"").trim();
    const decisions={}; for(const [k,v] of Object.entries(dec)) decisions[k]=v;
    if(await run(()=>sb.rpc("close_request",{p_id:r.id,p_body:text||null,p_decisions:decisions}),"Conversation classée")){ S.drafts[key]=""; delete S.drafts["d"+r.id]; clearPend(); await refresh(); } else close.disabled=false; };
  const sn=$("#seen"); if(sn) sn.onclick=async()=>{ sn.disabled=true; if(await run(()=>sb.rpc("mark_request_seen",{p_id:r.id}),"Patient prévenu : demande vue")) await refresh(); else sn.disabled=false; };
  const tk=$("#take"); if(tk) tk.onclick=async()=>{ if(await run(()=>sb.rpc("take_request",{p_id:r.id}),"Demande prise en charge")) await refresh(); };
  $("#dotr").onclick=async()=>{ const v=$("#tr").value||null, note=($("#trnote")?.value||"").trim();
    if(note){ const tgt=v==="__admin"?"Administration":v?provName(v):"Secrétariat";
      const {error}=await sb.rpc("add_transfer_note",{p_id:r.id,p_body:note,p_target:tgt}); if(error){ toast("Le mot n'a pas pu être enregistré : "+frError(error)); return; } }
    if($("#trinform")?.checked){ const {error}=await sb.rpc("inform_patient_transfer",{p_id:r.id,p_target:v==="__admin"?"administration":v||"secretariat"});
      if(error) toast("Le patient n'a pas pu être prévenu : "+frError(error)); }
    const ok = v==="__admin" ? await run(()=>sb.rpc("transfer_to_administration",{p_id:r.id}),"Transférée : Administration")
                             : await run(()=>sb.rpc("transfer_request",{p_id:r.id,p_provider:v}),`Transférée : ${v?provName(v):"Secrétariat"}`);
    if(ok){ S.sel=null; await refresh(); } };
}

/* ----- écrire en premier à un patient ----- */
const SUBJECTS=["Résultats","Document ou certificat","Rappel (vaccin, contrôle…)","Information","Autre"];
// Recherche d'un patient (compte validé) ou d'un enfant validé, par nom ou prénom
async function searchPatients(words){
  const w=words[0];
  const [a,b]=await Promise.all([
    sb.from("profiles").select("id,first_name,last_name,birth_date,phone").eq("role","patient").eq("status","active").or(`first_name.ilike.*${w}*,last_name.ilike.*${w}*`).limit(20),
    sb.from("children").select("id,first_name,last_name,birth_date,status,created_by").eq("status","active").is("removed_at",null).or(`first_name.ilike.*${w}*,last_name.ilike.*${w}*`).limit(20)]);
  if(a.error&&b.error) return null;
  const all=[...(a.data||[]),...(b.data||[]).map(c=>({...c,child:true}))];
  return all.filter(p=>words.every(x=>norm(`${p.first_name||""} ${p.last_name||""}`).includes(x))).slice(0,12);
}
const patientPickRow = p => `<button type="button" class="row" data-pick="${p.id}"><div class="ic">${IC.user}</div><div><b>${esc(`${p.first_name||""} ${p.last_name||""}`)}</b><small>Né(e) le ${fmtDate(p.birth_date)} · ${p.child?"Enfant (via ses parents)":p.record?`Fiche sans compte · tél. ${esc(p.phone||"—")}`:`Tél. ${esc(p.phone||"—")}`}</small></div><span></span></button>`;
function composeHTML(){
  const C=S.compose||(S.compose={patient:null,subject:SUBJECTS[0],body:"",files:[],reply:true,q:""}), pt=C.patient;
  const who=S.me.provider_id?provName(S.me.provider_id):isGestion()?"Administration":"Secrétariat";
  return `<div class="chead"><div><h1>Écrire à un patient</h1><p>Pour un patient qui a un compte validé dans l'app. Il reçoit une notification neutre, sans contenu médical. Envoyé au nom de : <b>${esc(who)}</b>.</p></div></div>
  <div class="compose card">
   <h3>1. Destinataire</h3>
   ${pt?`<div class="recipient">${AV.get(pt.id)?avatarHTML(AV.get(pt.id),`${pt.first_name||""} ${pt.last_name||""}`,40):`<div class="ic">${IC.user}</div>`}<div><b>${esc(`${pt.first_name||""} ${pt.last_name||""}`)}</b><small>Né(e) le ${fmtDate(pt.birth_date)} · ${pt.child?"Enfant : le message va à ses parents dans l'app":`Tél. ${esc(pt.phone||"—")}`}</small></div><button type="button" class="linkbtn" id="cp-change">Changer</button></div>
     <p class="hint" style="margin:0">Vérifiez la date de naissance : un message au mauvais patient est une fuite de données.</p>`
   :`<label class="fld" for="cp-q">Nom ou prénom du patient<input id="cp-q" type="text" autocomplete="off" placeholder="Au moins 2 lettres" value="${esc(C.q)}"></label><div id="cp-res"></div>`}
   <h3>2. Message</h3>
   <label class="fld" for="cp-subj">Sujet<select id="cp-subj">${SUBJECTS.map(x=>`<option ${x===C.subject?"selected":""}>${x}</option>`).join("")}</select></label>
   <label class="fld" for="cp-body">Message au patient<textarea id="cp-body" rows="5" maxlength="4000" placeholder="Ex. Vos résultats de prise de sang sont normaux. Vous les trouverez en pièce jointe.">${esc(C.body)}</textarea></label>
   <div class="filelist">${C.files.map((f,i)=>`<div class="fileitem">${f.kind==="image"?`<img src="${f.url}" alt="">`:f.kind==="audio"?IC.mic:IC.doc}<span><b>${esc(f.name)}</b><small>${f.kind==="audio"?dur(f.duration)+" · ":""}${f.pages?f.pages+" page"+(f.pages>1?"s":"")+" · ":""}${kb(f.blob.size)}</small>${f.kind==="audio"?`<audio controls preload="metadata" src="${f.url}"></audio>`:""}</span><button type="button" class="linkbtn" data-cprm="${i}">Retirer</button></div>`).join("")}</div>
   ${CREC?`<div class="cprec" role="status"><span class="recdot" aria-hidden="true"></span><span id="cp-rtime" class="rtime">${dur(Math.floor((Date.now()-CREC.t0)/1000))}</span><span>Enregistrement en cours… (3 min max.)</span><button type="button" class="btn" id="cp-rstop">Terminer</button><button type="button" class="linkbtn" id="cp-rcancel">Annuler</button></div>`:""}
   <input type="file" id="cp-file" accept="image/*,application/pdf" multiple hidden>
   ${C.files.length<5&&!CREC?`<div class="btnrow"><button type="button" class="btn ghost" id="cp-pick">${IC.clip} Joindre un PDF ou une photo</button><button type="button" class="btn ghost" id="cp-scan">${IC.scan} Scanner</button><button type="button" class="btn ghost" id="cp-fiche">📋 Fiche conseil</button>${canRecord()&&!C.files.some(f=>f.kind==="audio")?`<button type="button" class="btn ghost" id="cp-mic">${IC.mic} Message vocal</button>`:""}</div>`:""}
   <p class="hint" style="margin:0">Le texte est facultatif si vous joignez un message vocal ou un document.</p>
   <h3>3. Réponse</h3>
   <label class="chk2"><input type="radio" name="cp-r" value="1" ${C.reply?"checked":""}> Le patient peut répondre</label>
   <label class="chk2"><input type="radio" name="cp-r" value="0" ${C.reply?"":"checked"}> Pour information (classée d'emblée, le patient peut la lire mais pas répondre)</label>
   <div class="btnrow"><button class="btn" id="cp-send" ${pt&&(C.body.trim()||C.files.length)&&!CREC?"":"disabled"}>${pt?`Envoyer à ${esc(`${pt.first_name||""} ${pt.last_name||""}`.trim())}`:"Choisissez d'abord le patient"}</button><button type="button" class="btn ghost" id="cp-reset">Effacer</button></div>
  </div>`;
}
function bindCompose(){
  const C=S.compose;
  const upd=()=>{ const b=$("#cp-send"); if(b) b.disabled=!(C.patient&&(C.body.trim()||C.files.length))||!!CREC; };
  const mic=$("#cp-mic"); if(mic) mic.onclick=()=>composeRecStart();
  const rs=$("#cp-rstop"); if(rs) rs.onclick=()=>composeRecStop(true);
  const rc=$("#cp-rcancel"); if(rc) rc.onclick=()=>composeRecStop(false);
  $("#cp-subj").onchange=e=>C.subject=e.target.value;
  $("#cp-body").oninput=e=>{ C.body=e.target.value; upd(); };
  $$("[name=cp-r]").forEach(r=>r.onchange=()=>C.reply=r.value==="1");
  const ch=$("#cp-change"); if(ch) ch.onclick=()=>{ C.patient=null; render(); $("#cp-q")?.focus(); };
  const q=$("#cp-q");
  if(q){ let t; const search=async()=>{ C.q=q.value; const words=norm(q.value).replace(/[*%,().]/g," ").split(/\s+/).filter(w=>w.length>=2), out=$("#cp-res");
      if(!words.length){ out.innerHTML=""; return; }
      const rows=await searchPatients(words); if(rows===null){ out.innerHTML=`<p class="hint">La recherche n'a pas fonctionné. Réessayez.</p>`; return; }
      out.innerHTML=rows.length?`<div class="list">${rows.map(p=>patientPickRow(p)).join("")}</div>`:`<p class="hint">Aucun patient avec un compte validé ne correspond.</p>`;
      out.querySelectorAll("[data-pick]").forEach(b=>b.onclick=async()=>{ C.patient=rows.find(p=>p.id===b.dataset.pick); if(!C.patient.child) await loadAvatars([C.patient.id]); render(); $("#cp-body")?.focus(); }); };
    q.oninput=()=>{ clearTimeout(t); t=setTimeout(search,300); }; if(C.q) search(); q.focus({preventScroll:true}); }
  const inp=$("#cp-file"), pk=$("#cp-pick"); if(pk) pk.onclick=()=>inp.click();
  const cf=$("#cp-fiche"); if(cf) cf.onclick=()=>pickFiche(p=>{ C.files.push({...p,key:"compose"}); render(); });
  inp.onchange=async()=>{ for(const f of [...inp.files].slice(0,5-C.files.length)){ try{ C.files.push(await prepFile(f,"compose")); }catch(e){ toast(e.message); } } inp.value=""; render(); };
  const sc=$("#cp-scan"); if(sc) sc.onclick=()=>openScanner(pend=>{ C.files.push(pend); render(); });
  $$("[data-cprm]").forEach(b=>b.onclick=()=>{ const f=C.files.splice(+b.dataset.cprm,1)[0]; if(f&&f.url) URL.revokeObjectURL(f.url); render(); });
  $("#cp-reset").onclick=()=>{ if(CREC) composeRecStop(false); C.files.forEach(f=>f.url&&URL.revokeObjectURL(f.url)); S.compose=null; render(); };
  const send=$("#cp-send"); send.onclick=async()=>{ if(CREC) return; send.disabled=true; send.textContent="Envoi…";
    const r=await run(()=>sb.rpc("staff_start_conversation",{p_patient:C.patient.child?null:C.patient.id,p_subject:C.subject,p_body:C.body.trim(),p_child:C.patient.child?C.patient.id:null}));
    if(!r){ send.disabled=false; send.textContent="Réessayer"; return; }
    const id=r.data; let okAll=true;
    for(const f of C.files){ if(!await uploadAtt(id,f,null)){ okAll=false; break; } }
    if(!C.reply) await run(()=>sb.rpc("close_request",{p_id:id,p_body:null}));
    toast(okAll?"Message envoyé · patient notifié":"Message envoyé, mais une pièce jointe a échoué : ajoutez-la dans la conversation.");
    C.files.forEach(f=>f.url&&URL.revokeObjectURL(f.url)); S.compose=null;
    if(C.patient.child) S.children[C.patient.id]=C.patient; else S.profiles[C.patient.id]=C.patient; S.cscreen="inbox"; S.archive=!C.reply; await refresh();
    const nr=S.reqs.find(x=>x.id===id); if(nr){ S.scope="all"; S.iq=""; S.itype="all"; S.sel=id; render(); } };
}

/* ----- message vocal dans « Écrire à un patient » ----- */
let CREC=null;
async function composeRecStart(){
  if(CREC) return;
  if(!canRecord()) return toast("L'enregistrement vocal n'est pas disponible sur cet appareil.");
  let stream; try{ stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}}); }
  catch(e){ return toast("Le micro n'est pas autorisé. Autorisez-le dans les réglages du navigateur."); }
  const type=recType(); let mr;
  try{ mr=new MediaRecorder(stream, type?{mimeType:type,audioBitsPerSecond:32000}:{audioBitsPerSecond:32000}); }
  catch(e){ try{ mr=new MediaRecorder(stream); }catch(e2){ stream.getTracks().forEach(t=>t.stop()); return toast("L'enregistrement vocal n'est pas disponible sur cet appareil."); } }
  const chunks=[], t0=Date.now(); mr.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
  CREC={mr,stream,chunks,t0,type,tick:setInterval(()=>{ const s=Math.floor((Date.now()-t0)/1000), el=$("#cp-rtime"); if(el) el.textContent=dur(s); if(s>=180) composeRecStop(true); },250)};
  mr.start(1000); render();
}
function composeRecStop(keep){
  const R=CREC; if(!R) return; CREC=null; clearInterval(R.tick);
  const ms=Date.now()-R.t0;
  R.mr.onstop=async()=>{ R.stream.getTracks().forEach(t=>t.stop());
    if(!keep||!S.compose) return render();
    if(!R.chunks.length) await new Promise(r=>setTimeout(r,400));
    if(!R.chunks.length){ toast("L'enregistrement n'a pas fonctionné sur cet appareil. Réessayez."); return render(); }
    if(ms<800){ toast("Message vocal trop court."); return render(); }
    const mime=((R.mr.mimeType||R.type||"audio/webm").split(";")[0]).replace("audio/x-m4a","audio/mp4").replace("audio/aac","audio/mp4");
    const blob=new Blob(R.chunks,{type:mime});
    S.compose.files.push({key:"compose",kind:"audio",mime,name:"Message vocal",blob,url:URL.createObjectURL(blob),duration:Math.max(1,Math.round(ms/1000))});
    render(); };
  try{ R.mr.stop(); }catch(e){ R.stream.getTracks().forEach(t=>t.stop()); render(); }
}

/* ----- inventaire (équipe) ----- */
const INV_ST={a_commander:"À commander",commande:"Commandé",recu:"Reçu"};
const invOpen = () => (S.inventory||[]).filter(i=>i.status==="a_commander").length;
const INVPH=new Map();
function invPhoto(id){
  if(INVPH.has(id)) return INVPH.get(id);
  const p=(async()=>{ const {data,error}=await sb.rpc("get_inventory_photo",{p_id:id}); if(error||!data||!data[0]) throw error||new Error("photo");
    const d=data[0], bin=atob(d.data), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u8],{type:d.mime})); })();
  INVPH.set(id,p); p.catch(()=>INVPH.delete(id)); return p;
}
async function loadInventory(){
  const [it,ph]=await Promise.all([sb.from("inventory_items").select("*").order("created_at",{ascending:false}).limit(1000),
    sb.from("inventory_photos").select("id,item_id").limit(3000)]);
  if(!it.error) S.inventory=it.data||[]; if(!ph.error) S.invPhotos=ph.data||[];
}
const newInv = () => ({title:"",qty:"",notes:"",urgent:false,photos:[],tab:"a_commander",q:"",sel:[],open:null,more:false,all:false});
// Inventaire compact : une ligne par article, ajout rapide en une ligne, actions groupées
function invSimilar(t){ const w=norm(t||"").split(/\s+/).filter(x=>x.length>2); if(!w.length) return null;
  return (S.inventory||[]).find(i=>i.status!=="recu"&&w.every(x=>norm(i.title).includes(x)))||null; }
function inventoryHTML(){
  const I=S.inv||(S.inv=newInv()); I.sel=I.sel||[];
  const all=S.inventory||[], n=st=>all.filter(i=>i.status===st).length, since=Date.now()-60*864e5;
  const q=norm(I.q||"").split(/\s+/).filter(Boolean);
  let list=all.filter(i=>i.status===I.tab).filter(i=>!q.length||q.every(x=>norm(`${i.title} ${i.quantity||""} ${i.notes||""}`).includes(x)));
  const hidden=I.tab==="recu"&&!I.all?list.filter(i=>new Date(i.status_at||i.created_at)<since).length:0;
  if(I.tab==="recu"&&!I.all) list=list.filter(i=>new Date(i.status_at||i.created_at)>=since);
  list.sort((a,b)=>I.tab==="recu"?new Date(b.status_at||b.created_at)-new Date(a.status_at||a.created_at):(b.urgent-a.urgent)||new Date(b.created_at)-new Date(a.created_at));
  const phs=id=>(S.invPhotos||[]).filter(p=>p.item_id===id), dup=invSimilar(I.title);
  const next={a_commander:["commande","Commandé"],commande:["recu","Reçu"]}[I.tab];
  const canDel=it=>it.created_by===S.me.id||isDesk()||isGestion();
  const row=it=>{ const ph=phs(it.id), op=I.open===it.id, urg=it.urgent&&it.status!=="recu";
    return `<div class="invrow${urg?" isurg":""}${op?" open":""}">
     ${next?`<label class="invchk"><input type="checkbox" data-invsel="${it.id}" ${I.sel.includes(it.id)?"checked":""} aria-label="Sélectionner ${esc(it.title)}"></label>`:""}
     <button type="button" class="invmain" data-invopen="${it.id}" aria-expanded="${op}"><b>${esc(it.title)}</b>${it.quantity?`<span class="invqty">${esc(it.quantity)}</span>`:""}${urg?`<span class="invtag">Urgent</span>`:""}${ph.length?`<span class="invcam" aria-label="${ph.length} photo${ph.length>1?"s":""}">📷${ph.length>1?ph.length:""}</span>`:""}
      ${it.notes&&!op?`<small class="invnote1">${esc(it.notes)}</small>`:""}</button>
     <small class="invwho">${esc(teamName(it.created_by))} · ${fmt(it.created_at)}${it.status!=="a_commander"&&it.status_at?`<br>${INV_ST[it.status]} ${fmt(it.status_at)}`:""}</small>
     <div class="invacts">${next?`<button type="button" class="mini" data-invst="${next[0]}" data-id="${it.id}">✓ ${next[1]}</button>`:""}</div>
     ${op?`<div class="invdet">${it.notes?`<p class="invnotes">${esc(it.notes)}</p>`:""}
       ${ph.length?`<div class="invphotos">${ph.map(p=>`<button type="button" class="invph" data-invph="${p.id}" aria-label="Agrandir la photo"><img alt=""></button>`).join("")}</div>`:""}
       <small class="invmeta">Demandé par ${esc(teamName(it.created_by))} ${fmt(it.created_at)}${it.status!=="a_commander"&&it.status_at?` · ${INV_ST[it.status]} ${fmt(it.status_at)}${it.status_by?` (${esc(teamName(it.status_by))})`:""}`:""}</small>
       <div class="btnrow">${it.status!=="a_commander"?`<button class="btn ghost" data-invst="a_commander" data-id="${it.id}">Remettre à commander</button>`:""}${canDel(it)?`<button class="linkbtn" data-invdel="${it.id}">Supprimer</button>`:""}</div></div>`:""}
    </div>`; };
  return `<div class="chead"><div><h1>Inventaire</h1><p>Ce qui manque au centre. Toute l'équipe ajoute ; le secrétariat coche ce qui est commandé puis reçu.</p></div></div>
  <div class="inv">
   <section class="card invquick">
    <div class="invline"><input id="inv-title" maxlength="200" autocomplete="off" placeholder="Ce qu'il faut (ex. gel d'échographie)" value="${esc(I.title)}" aria-label="Ce qu'il faut">
     <input id="inv-qty" class="invq" maxlength="60" autocomplete="off" placeholder="Quantité" value="${esc(I.qty)}" aria-label="Quantité (facultatif)">
     <label class="invurgchip"><input type="checkbox" id="inv-urg" ${I.urgent?"checked":""}> Urgent</label>
     <button type="button" class="cbtn" id="inv-pick" title="Ajouter une photo" aria-label="Ajouter une photo" ${I.photos.length>=3?"disabled":""}>${IC.scan}</button>
     <button class="btn" id="inv-add" ${I.title.trim()?"":"disabled"}>Ajouter</button></div>
    ${dup?`<p class="invdup">Déjà dans la liste : <b>${esc(dup.title)}</b>${dup.quantity?` (${esc(dup.quantity)})`:""} · ${INV_ST[dup.status].toLowerCase()}, demandé par ${esc(teamName(dup.created_by))}. Ajoutez seulement si c'est autre chose.</p>`:""}
    ${I.more?`<textarea id="inv-notes" rows="2" maxlength="1000" placeholder="Marque, référence, fournisseur, taille…" aria-label="Précisions">${esc(I.notes)}</textarea>`:`<button type="button" class="linkbtn invmore" id="inv-more">+ Précisions (marque, référence…)</button>`}
    ${I.photos.length?`<div class="invphotos">${I.photos.map((p,i)=>`<div class="invph"><img src="${p.url}" alt="Photo ${i+1}"><button type="button" class="invrm" data-invrm="${i}" aria-label="Retirer la photo">✕</button></div>`).join("")}</div>`:""}
    <input type="file" id="inv-file" accept="image/*" hidden>
   </section>
   <div class="invbar"><div class="tabs">${Object.entries(INV_ST).map(([k,l])=>`<button class="tab" data-invtab="${k}" aria-pressed="${I.tab===k}">${l}${k!=="recu"&&n(k)?`<span class="n">${n(k)}</span>`:""}</button>`).join("")}</div>
    <input id="inv-q" type="search" class="pcq" placeholder="Rechercher…" value="${esc(I.q||"")}" aria-label="Rechercher dans l'inventaire"></div>
   ${I.sel.length&&next?`<div class="invbulk"><b>${I.sel.length} sélectionné${I.sel.length>1?"s":""}</b><button type="button" class="btn" id="inv-bulk">Marquer ${next[1].toLowerCase()}${I.sel.length>1?"s":""}</button><button type="button" class="linkbtn" id="inv-unsel">Annuler</button></div>`:""}
   <div class="list invtable">${list.length?`${next&&list.length>1?`<label class="invall"><input type="checkbox" id="inv-selall" ${list.every(i=>I.sel.includes(i.id))?"checked":""}> Tout sélectionner</label>`:""}${list.map(row).join("")}`
     :`<div class="empty">${q.length?"Rien ne correspond.":I.tab==="a_commander"?"Rien à commander pour l'instant.":I.tab==="commande"?"Aucune commande en cours.":"Rien de reçu ces 60 derniers jours."}</div>`}</div>
   ${hidden?`<button type="button" class="linkbtn" id="inv-all">Afficher l'historique complet (${hidden} plus ancien${hidden>1?"s":""})</button>`:""}
  </div>`;
}
function bindInventory(){
  const I=S.inv, t=$("#inv-title"), add=$("#inv-add");
  let dupT=null; t.oninput=()=>{ I.title=t.value; add.disabled=!I.title.trim(); clearTimeout(dupT); dupT=setTimeout(()=>{ const had=!!$(".invdup"), has=!!invSimilar(I.title); if(had!==has){ render(); const n=$("#inv-title"); n.focus(); n.setSelectionRange(n.value.length,n.value.length); } },400); };
  t.onkeydown=e=>{ if(e.key==="Enter"&&!add.disabled) add.click(); };
  $("#inv-qty").oninput=e=>{ I.qty=e.target.value; };
  $("#inv-qty").onkeydown=e=>{ if(e.key==="Enter"&&!add.disabled) add.click(); };
  const nt=$("#inv-notes"); if(nt) nt.oninput=e=>{ I.notes=e.target.value; };
  const mo=$("#inv-more"); if(mo) mo.onclick=()=>{ I.more=true; render(); $("#inv-notes")?.focus(); };
  $("#inv-urg").onchange=e=>{ I.urgent=e.target.checked; };
  const f=$("#inv-file"), pk=$("#inv-pick"); if(pk) pk.onclick=()=>f.click();
  f.onchange=async()=>{ const x=f.files[0]; f.value=""; if(!x) return;
    try{ const blob=await shrinkImage(x); if(blob.size>3*1048576) throw 0; I.photos.push({blob,url:URL.createObjectURL(blob)}); render(); }
    catch(e){ toast("Cette photo n'a pas pu être lue. Essayez une autre photo."); } };
  $$("[data-invrm]").forEach(b=>b.onclick=()=>{ const ph=I.photos.splice(+b.dataset.invrm,1)[0]; if(ph) URL.revokeObjectURL(ph.url); render(); });
  add.onclick=async()=>{ add.disabled=true; add.textContent="Ajout…";
    const r=await run(()=>sb.rpc("add_inventory_item",{p_title:I.title,p_quantity:I.qty||null,p_notes:I.notes||null,p_urgent:I.urgent}));
    if(!r){ add.disabled=false; add.textContent="Ajouter"; return; }
    let okAll=true;
    for(const ph of I.photos){ const d=await blobToB64(ph.blob); if(!await run(()=>sb.rpc("add_inventory_photo",{p_item:r.data,p_mime:"image/jpeg",p_data:d}))){ okAll=false; break; } }
    I.photos.forEach(ph=>URL.revokeObjectURL(ph.url)); Object.assign(I,{title:"",qty:"",notes:"",urgent:false,photos:[],more:false,tab:"a_commander"});
    toast(okAll?"Ajouté à l'inventaire":"Ajouté, mais une photo n'a pas pu être envoyée."); await loadInventory(); render(); $("#inv-title")?.focus(); };
  $$("[data-invtab]").forEach(b=>b.onclick=()=>{ I.tab=b.dataset.invtab; I.sel=[]; I.open=null; render(); });
  const qi=$("#inv-q"); let qt; qi.oninput=()=>{ clearTimeout(qt); qt=setTimeout(()=>{ I.q=qi.value; render(); const n=$("#inv-q"); n.focus(); n.setSelectionRange(n.value.length,n.value.length); },250); };
  $$("[data-invopen]").forEach(b=>b.onclick=()=>{ const id=+b.dataset.invopen; I.open=I.open===id?null:id; render(); });
  $$("[data-invsel]").forEach(c=>c.onchange=()=>{ const id=+c.dataset.invsel; I.sel=c.checked?[...new Set([...I.sel,id])]:I.sel.filter(x=>x!==id); render(); });
  const sa=$("#inv-selall"); if(sa) sa.onchange=()=>{ const ids=[...document.querySelectorAll("[data-invsel]")].map(c=>+c.dataset.invsel); I.sel=sa.checked?ids:[]; render(); };
  const un=$("#inv-unsel"); if(un) un.onclick=()=>{ I.sel=[]; render(); };
  const bk=$("#inv-bulk"); if(bk) bk.onclick=async()=>{ const st=I.tab==="a_commander"?"commande":"recu"; bk.disabled=true; let n=0;
    for(const id of I.sel){ const {error}=await sb.rpc("set_inventory_status",{p_id:id,p_status:st}); if(error){ toast(frError(error)); break; } n++; }
    I.sel=[]; if(n) toast(`${n} article${n>1?"s":""} mis à jour`); await loadInventory(); render(); };
  const al=$("#inv-all"); if(al) al.onclick=()=>{ I.all=true; render(); };
  $$("[data-invst]").forEach(b=>b.onclick=async()=>{ b.disabled=true;
    if(await run(()=>sb.rpc("set_inventory_status",{p_id:+b.dataset.id,p_status:b.dataset.invst}),b.dataset.invst==="commande"?"Marqué commandé":b.dataset.invst==="recu"?"Marqué reçu":"Remis à commander")){ I.sel=I.sel.filter(x=>x!==+b.dataset.id); await loadInventory(); render(); } else b.disabled=false; });
  $$("[data-invdel]").forEach(b=>b.onclick=async()=>{
    if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent="Confirmer la suppression"; return; }
    b.disabled=true; if(await run(()=>sb.rpc("delete_inventory_item",{p_id:+b.dataset.invdel}),"Supprimé")){ I.open=null; await loadInventory(); render(); } else b.disabled=false; });
  $$("[data-invph]").forEach(async b=>{ try{ const u=await invPhoto(+b.dataset.invph); b.querySelector("img").src=u; b.onclick=()=>openViewer(u); }catch(e){ b.classList.add("failed"); } });
}

/* ----- fiches patients (sans compte) ----- */
// Identité et coordonnées uniquement : le dossier médical reste dans CareConnect.
const recordsMatching = words => (S.records||[]).filter(r=>words.every(x=>norm(`${r.first_name} ${r.last_name}`).includes(x))).map(r=>({...r,record:true}));
function patientsHTML(){
  const D=S.recDraft||(S.recDraft={first:"",last:"",birth:"",phone:"",email:""}), ed=S.recEdit?(S.records||[]).find(r=>r.id===S.recEdit):null;
  const q=norm(S.recQ||"").split(/\s+/).filter(Boolean), list=(S.records||[]).filter(r=>!q.length||q.every(x=>norm(`${r.first_name} ${r.last_name} ${r.phone||""}`).includes(x)));
  const open=t=>(S.tasks||[]).filter(x=>x.record_id===t&&!x.done_at).length;
  return `<div class="chead"><div><h1>Fiches patients</h1><p>Pour un patient qui n'a pas (encore) de compte dans l'app : lui confier une tâche, en parler entre collègues, l'inviter à s'inscrire. Identité et coordonnées uniquement, jamais de note médicale (le dossier reste dans CareConnect).</p></div></div>
  <div class="taskgrid">
   <section class="card taskform"><h3>${ed?"Modifier la fiche":"Nouvelle fiche"}</h3>
    <div class="row2"><label class="fld">Prénom<input id="rc-first" maxlength="80" autocomplete="off" value="${esc(D.first)}"></label><label class="fld">Nom<input id="rc-last" maxlength="80" autocomplete="off" value="${esc(D.last)}"></label></div>
    <div class="row2"><label class="fld">Date de naissance<input id="rc-birth" type="date" value="${esc(D.birth)}" max="${todayISO()}"></label><label class="fld">Téléphone<input id="rc-phone" type="tel" maxlength="40" value="${esc(D.phone)}"></label></div>
    <label class="fld">E-mail (facultatif, pour l'inviter)<input id="rc-email" type="email" maxlength="160" autocomplete="off" value="${esc(D.email)}"></label>
    <div class="btnrow"><button class="btn" id="rc-save">${ed?"Enregistrer":"Créer la fiche"}</button>${ed||S.recBack?`<button class="btn ghost" id="rc-cancel">Annuler</button>`:""}</div>
    <p class="hint">Quand le patient crée son compte avec les mêmes nom, prénom et date de naissance, l'administrateur relie son compte à la fiche : les tâches suivent. Une fiche inutilisée pendant 12 mois est effacée.</p>
   </section>
   <section>
    <input id="rc-q" class="pcq" type="search" placeholder="Rechercher une fiche (nom, prénom, téléphone)" value="${esc(S.recQ||"")}" aria-label="Rechercher une fiche" style="margin-bottom:10px">
    <div class="list">${list.length?list.map(r=>`<div class="medrow recrow"><div class="ic">${IC.user}</div><div><b>${esc(r.first_name+" "+r.last_name)}</b>
      <small>Né(e) le ${fmtDate(r.birth_date)} · Tél. ${esc(r.phone||"—")}${r.email?` · ${esc(r.email)}`:""}</small>
      <small>Fiche créée par ${esc(teamName(r.created_by))} ${fmt(r.created_at)}${open(r.id)?` · <b>${open(r.id)} tâche${open(r.id)>1?"s":""} en cours</b>`:""}${r.invited_at?` · invité(e) ${fmt(r.invited_at)}`:""}</small></div>
      <div class="acts recacts"><button class="mini" data-rtask="${r.id}">Tâche</button><button class="mini ghostmini" data-rmsg="${r.id}">En parler</button>${r.email?`<button class="mini ghostmini" data-rinv="${r.id}">Inviter</button>`:""}<button class="linkbtn" style="font-size:12px" data-redit="${r.id}">Modifier</button>${r.created_by===S.me.id||isAdmin()?`<button class="linkbtn" style="font-size:12px;color:var(--muted)" data-rdel="${r.id}">Supprimer</button>`:""}</div></div>`).join("")
      :`<div class="empty">${q.length?"Aucune fiche ne correspond.":"Aucune fiche pour l'instant."}</div>`}</div>
   </section></div>`;
}
function bindPatients(){
  const D=S.recDraft; const f={first:"#rc-first",last:"#rc-last",birth:"#rc-birth",phone:"#rc-phone",email:"#rc-email"};
  Object.entries(f).forEach(([k,sel])=>{ const el=$(sel); el.oninput=el.onchange=()=>{ D[k]=el.value; }; });
  const qi=$("#rc-q"); let tm; qi.oninput=()=>{ clearTimeout(tm); tm=setTimeout(()=>{ S.recQ=qi.value; render(); const n=$("#rc-q"); n.focus(); n.setSelectionRange(n.value.length,n.value.length); },250); };
  const done=()=>{ S.recDraft=null; S.recEdit=null; };
  const cancel=$("#rc-cancel"); if(cancel) cancel.onclick=()=>{ done(); if(S.recBack){ S.cscreen=S.recBack; S.recBack=null; } render(); };
  $("#rc-save").onclick=async e=>{ const b=e.target; if(!D.first.trim()||!D.last.trim()||!D.birth) return toast("Indiquez le prénom, le nom et la date de naissance.");
    b.disabled=true; const args={p_first:D.first,p_last:D.last,p_birth:D.birth,p_phone:D.phone||null,p_email:D.email||null};
    const r=S.recEdit?await run(()=>sb.rpc("update_patient_record",{p_id:S.recEdit,...args}),"Fiche enregistrée"):await run(()=>sb.rpc("create_patient_record",args),"Fiche créée");
    if(!r){ b.disabled=false; return; }
    const newId=!S.recEdit?r.data:null; done();
    const {data}=await sb.from("patient_records").select("*").order("last_name"); S.records=data||S.records;
    if(S.recBack==="tasks"&&newId){ const rec=S.records.find(x=>x.id===newId); if(S.tdraft&&rec) S.tdraft.patient={...rec,record:true}; S.cscreen="tasks"; S.recBack=null; }
    render(); };
  $$("[data-redit]").forEach(b=>b.onclick=()=>{ const r=S.records.find(x=>x.id===b.dataset.redit); S.recEdit=r.id; S.recDraft={first:r.first_name,last:r.last_name,birth:r.birth_date,phone:r.phone||"",email:r.email||""}; render(); scrollTo(0,0); });
  $$("[data-rdel]").forEach(b=>b.onclick=async()=>{ if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent="Confirmer ?"; b.style.color="var(--danger)"; return; }
    if(await run(()=>sb.rpc("delete_patient_record",{p_id:b.dataset.rdel}),"Fiche supprimée")){ S.records=S.records.filter(x=>x.id!==b.dataset.rdel); render(); } });
  $$("[data-rinv]").forEach(b=>b.onclick=async()=>{ b.disabled=true; if(await run(()=>sb.rpc("invite_patient_record",{p_id:b.dataset.rinv}),"Invitation envoyée par e-mail")){ const r=S.records.find(x=>x.id===b.dataset.rinv); if(r) r.invited_at=new Date().toISOString(); render(); } else b.disabled=false; });
  $$("[data-rtask]").forEach(b=>b.onclick=()=>{ const r=S.records.find(x=>x.id===b.dataset.rtask);
    S.tdraft={title:"",notes:"",due:"",to:"me",patient:{...r,record:true},q:"",remind:null}; S.tview="todo"; S.cscreen="tasks"; render(); scrollTo(0,0); $("#tk-title")?.focus(); });
  $$("[data-rmsg]").forEach(b=>b.onclick=()=>{ const r=S.records.find(x=>x.id===b.dataset.rmsg);
    pickColleagues("En parler avec…",[],async(ids,name)=>{ const {data,error}=await sb.rpc("team_start",{p_members:ids,p_title:name||null}); if(error){ toast(frError(error)); return false; }
      await loadTeam(); S.tthread=data; S.drafts["t"+data]=`À propos de ${r.first_name} ${r.last_name} (né(e) le ${fmtDate(r.birth_date)}, fiche sans compte) : `; S.cscreen="messages"; render(); const c=$("#c-text"); if(c){ c.focus(); c.setSelectionRange(c.value.length,c.value.length); } return true; },true); });
}

/* ----- tâches (équipe) ----- */
const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const teamName = id => { if(id===S.me.id) return "moi"; const t=S.team.find(x=>x.id===id); return t?`${t.first_name||""} ${t.last_name||""}`.trim()||ROLE_LABEL[t.role]:"—"; };
const taskPeople = t => (t.task_people||[]).map(p=>p.user_id);
const forMe = t => t.assigned_to===S.me.id || (t.assigned_group==="secretariat" && isDesk()) || taskPeople(t).includes(S.me.id);
const taskForLabel = t => { const main=t.assigned_group?"secrétariat":teamName(t.assigned_to); const more=taskPeople(t).filter(id=>id!==t.assigned_to).map(teamName);
  return [main,...more].join(", "); };
const myTasks = () => (S.tasks||[]).filter(t=>!t.done_at&&forMe(t));
const byDue = (a,b) => (a.due_date||"9999")<(b.due_date||"9999")?-1:(a.due_date||"9999")>(b.due_date||"9999")?1:new Date(b.created_at)-new Date(a.created_at);
function dueTag(t){ if(!t.due_date||t.done_at) return ""; const td=todayISO();
  const d=new Date(t.due_date+"T12:00").toLocaleDateString(LOC,{weekday:"short",day:"numeric",month:"short"});
  const h=t.due_time?` · vers ${String(t.due_time).slice(0,5).replace(":","h")}`:"";
  return t.due_date<td?`<span class="due late">En retard · ${d}${h}</span>`:t.due_date===td?`<span class="due haute">Aujourd'hui${h}</span>`:`<span class="due">Pour le ${d}${h}</span>`; }
const REMIND={0:"Le jour même",1:"La veille",2:"48 h avant",3:"72 h avant",7:"1 semaine avant"};
const remindOpts = v => Object.entries(REMIND).map(([k,l])=>`<option value="${k}" ${String(v)===k?"selected":""}>${l}</option>`).join("");
// regroupement par urgence (échéance)
function dueGroup(t){ if(!t.due_date) return 4; const td=todayISO(); if(t.due_date<td) return 0; if(t.due_date===td) return 1;
  const w=new Date(); w.setDate(w.getDate()+7); const wk=`${w.getFullYear()}-${String(w.getMonth()+1).padStart(2,"0")}-${String(w.getDate()).padStart(2,"0")}`;
  return t.due_date<=wk?2:3; }
const DUE_GROUPS=["En retard","Aujourd'hui","Dans les 7 jours","Plus tard","Sans échéance"];
function taskRowHTML(t){
  const canRem=!t.done_at&&t.due_date&&t.due_date>=todayISO();
  return `<div class="taskrow ${t.done_at?"done":""}">
     <button class="tcheck" data-tdone="${t.id}" aria-pressed="${!!t.done_at}" aria-label="${t.done_at?"Marquer comme à faire":"Marquer comme faite"}">${t.done_at?"✓":""}</button>
     <div><b>${esc(t.title)}</b>${isPatTask(t)?"":` <span class="ipill orgtag">🏥 Organisation</span>`}${t.notes?`<p class="tnotes">${esc(t.notes)}</p>`:""}${taskLinkHTML(t)}
      <small>Pour : ${esc(taskForLabel(t))}${t.created_by===S.me.id&&!t.done_at?` <button type="button" class="linkbtn tppl" data-tppl="${t.id}">👥 Personnes</button>`:""} · de ${esc(teamName(t.created_by))} · ${fmt(t.created_at)}${t.done_at?` · faite ${fmt(t.done_at)} par ${esc(teamName(t.done_by))}`:""}</small>${dueTag(t)}
      ${canRem?`<label class="tremind${t.remind_days!=null?" on":""}" title="Rappel par e-mail à 8 h à la personne qui doit faire la tâche"><span aria-hidden="true">🔔</span><select data-trem="${t.id}" aria-label="Rappel par e-mail"><option value="">Pas de rappel</option>${remindOpts(t.remind_days)}</select>${t.reminded_at?`<em>envoyé</em>`:""}</label>`:""}</div>
     ${t.created_by===S.me.id?`<button class="linkbtn tdel" data-tdel="${t.id}">Supprimer</button>`:"<span></span>"}</div>`;
}
function taskListHTML(list,grouped){
  if(!grouped) return list.map(taskRowHTML).join("");
  let out="", g=-1;
  for(const t of list){ const k=dueGroup(t); if(k!==g){ g=k; out+=`<h4 class="tgroup g${k}">${DUE_GROUPS[k]} <span>${list.filter(x=>dueGroup(x)===k).length}</span></h4>`; } out+=taskRowHTML(t); }
  return out;
}
// Tâche « Patients » = liée à un patient (compte, enfant ou fiche) ; sinon « Organisation »
const isPatTask = t => !!(t.patient_id||t.child_id||t.record_id);
const recName = id => { const r=(S.records||[]).find(x=>x.id===id); return r?`${r.first_name} ${r.last_name}`:"Fiche patient"; };
function taskLinkHTML(t){
  if(t.record_id){ const r=(S.records||[]).find(x=>x.id===t.record_id);
    return `<span class="tasklink">${IC.user}<b>${esc(recName(t.record_id))}</b>${r?` · né(e) le ${fmtDate(r.birth_date)}`:""} · <i>fiche sans compte</i>${r&&r.phone?` · tél. ${esc(r.phone)}`:""}</span>`; }
  if(!t.patient_id&&!t.child_id) return "";
  const nm=t.child_id?kidName(t.child_id):patientName(t.patient_id), bd=t.child_id?S.children[t.child_id]?.birth_date:S.profiles[t.patient_id]?.birth_date;
  return `<span class="tasklink">${IC.user}<b>${esc(nm)}</b>${bd?` · né(e) le ${fmtDate(bd)}`:""}${t.child_id?" · enfant":""}</span>`; }
function tasksHTML(){
  const D=S.tdraft||(S.tdraft={title:"",notes:"",due:"",to:"me",patient:null,q:"",remind:null}), V=S.tview||"todo";
  const all=S.tasks||[], todo=myTasks().sort(byDue), given=all.filter(t=>!t.done_at&&t.created_by===S.me.id&&!forMe(t)).sort(byDue),
        done=all.filter(t=>t.done_at).sort((a,b)=>new Date(b.done_at)-new Date(a.done_at));
  const K=S.tkind||"all", listAll=V==="todo"?todo:V==="given"?given:done;
  const nP=listAll.filter(isPatTask).length, nO=listAll.length-nP;
  const list=K==="pat"?listAll.filter(isPatTask):K==="org"?listAll.filter(t=>!isPatTask(t)):listAll;
  const others=S.team.filter(t=>t.id!==S.me.id&&t.status==="active");
  const pt=D.patient;
  return `<div class="chead"><div><h1>Tâches</h1><p>Pour vous, pour un collègue ou pour tout le secrétariat. Une tâche peut être liée à un patient. Elle n'est visible que par vous et la ou les personnes qui doivent la faire.</p></div></div>
  <div class="taskgrid">
  <section class="card taskform"><h3>Nouvelle tâche</h3>
   <label class="fld">Tâche<input id="tk-title" maxlength="200" autocomplete="off" placeholder="Ex. Changer les filtres de la ventilation" value="${esc(D.title)}"></label>
   <label class="fld">Note (facultatif)<textarea id="tk-notes" rows="3" maxlength="2000" placeholder="Ex. Vérifier sa prise de sang et l'appeler si anomalie">${esc(D.notes)}</textarea></label>
   <div class="row2"><label class="fld">Pour<select id="tk-to"><option value="me" ${D.to==="me"?"selected":""}>Moi</option><option value="secretariat" ${D.to==="secretariat"?"selected":""}>Secrétariat (toute l'équipe du secrétariat)</option>${others.map(t=>`<option value="${t.id}" ${D.to===t.id?"selected":""}>${esc(`${t.first_name||""} ${t.last_name||""}`.trim())} · ${ROLE_LABEL[t.role]}</option>`).join("")}</select></label>
   <label class="fld">Échéance (facultatif)<input id="tk-due" type="date" value="${esc(D.due)}"></label></div>
   <div class="tkextra"><span class="hint">Aussi concernés :</span>${(D.extra||[]).map(id=>`<span class="ipill">${esc(teamName(id))}</span>`).join("")||`<span class="hint">personne d'autre</span>`}
    <button type="button" class="linkbtn" id="tk-extra">${(D.extra||[]).length?"Modifier":"+ Ajouter des personnes"}</button></div>
   ${D.due?`<div class="tkrem"><label class="chk2"><input type="checkbox" id="tk-remon" ${D.remind!=null?"checked":""}> Recevoir un rappel par e-mail</label>
    ${D.remind!=null?`<select id="tk-rem" aria-label="Quand envoyer le rappel">${remindOpts(D.remind)}</select><small class="hint">Envoyé à 8 h à ${D.to==="me"?"vous":D.to==="secretariat"?"tout le secrétariat":"la personne choisie"}. L'e-mail ne contient ni le titre de la tâche ni le nom du patient.</small>`:""}</div>`:""}
   <div class="fld">Patient lié (facultatif : sans patient, la tâche est rangée dans « Organisation »)
   ${pt?`<div class="recipient">${`<div class="ic">${IC.user}</div>`}<div><b>${esc(`${pt.first_name||""} ${pt.last_name||""}`)}</b><small>Né(e) le ${fmtDate(pt.birth_date)}${pt.child?" · enfant":""}</small></div><button type="button" class="linkbtn" id="tk-unpick">Retirer</button></div>`
   :`<input id="tk-q" type="text" autocomplete="off" placeholder="Nom ou prénom (au moins 2 lettres)" value="${esc(D.q)}"><div id="tk-res"></div>`}</div>
   <div class="btnrow"><button class="btn" id="tk-add" ${D.title.trim()?"":"disabled"}>Ajouter la tâche</button></div>
  </section>
  <section>
   <div class="seg" role="group" aria-label="Afficher" style="margin-bottom:10px"><button data-tv="todo" aria-pressed="${V==="todo"}">À faire (${todo.length})</button><button data-tv="given" aria-pressed="${V==="given"}">Confiées (${given.length})</button><button data-tv="done" aria-pressed="${V==="done"}">Terminées</button></div>
   <div class="ichips tkinds" role="group" aria-label="Type de tâche"><button class="ichip all" data-tk="all" aria-pressed="${K==="all"}">Toutes <i>${listAll.length}</i></button><button class="ichip t-question" data-tk="pat" aria-pressed="${K==="pat"}">👤 Patients <i>${nP}</i></button><button class="ichip t-rapport" data-tk="org" aria-pressed="${K==="org"}">🏥 Organisation <i>${nO}</i></button></div>
   <div class="list tasks">${list.length?taskListHTML(list,V!=="done")
     :`<div class="empty">${V==="todo"?`<span class="yay" aria-hidden="true">✨</span>Rien à faire pour l'instant.`:V==="given"?"Aucune tâche confiée en cours.":"Aucune tâche terminée. Celles qui concernent un patient sont effacées 90 jours après."}</div>`}</div>
  </section></div>`;
}
function bindTasks(){
  const D=S.tdraft, add=$("#tk-add");
  const upd=()=>{ add.disabled=!D.title.trim(); };
  $("#tk-title").oninput=e=>{ D.title=e.target.value; upd(); };
  $("#tk-notes").oninput=e=>{ D.notes=e.target.value; };
  $("#tk-to").onchange=e=>{ D.to=e.target.value; if(D.due&&D.remind!=null) render(); };
  $("#tk-extra").onclick=()=>pickColleagues("Aussi concernés par cette tâche",[],async ids=>{ D.extra=ids; render(); return true; },false,D.extra||[]);
  $("#tk-due").onchange=e=>{ const had=!!D.due; D.due=e.target.value; if(!D.due) D.remind=null; if(had!==!!D.due) render(); };
  const ron=$("#tk-remon"); if(ron) ron.onchange=()=>{ D.remind=ron.checked?1:null; render(); };
  const rs=$("#tk-rem"); if(rs) rs.onchange=()=>{ D.remind=+rs.value; };
  const un=$("#tk-unpick"); if(un) un.onclick=()=>{ D.patient=null; render(); $("#tk-q")?.focus(); };
  const q=$("#tk-q");
  if(q){ let tm; const go=async()=>{ D.q=q.value; const words=norm(q.value).replace(/[*%,().]/g," ").split(/\s+/).filter(w=>w.length>=2), out=$("#tk-res");
      if(!words.length){ out.innerHTML=""; return; }
      let rows=await searchPatients(words); if(rows===null){ out.innerHTML=`<p class="hint">La recherche n'a pas fonctionné.</p>`; return; }
      rows=[...rows,...recordsMatching(words)].slice(0,14);
      out.innerHTML=(rows.length?`<div class="list">${rows.map(patientPickRow).join("")}</div>`:`<p class="hint">Aucun patient ne correspond.</p>`)
        +`<p class="hint">Patient sans compte ? <button type="button" class="linkbtn" id="tk-newrec">Créer une fiche patient</button></p>`;
      out.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{ D.patient=rows.find(p=>p.id===b.dataset.pick); render(); });
      $("#tk-newrec").onclick=()=>{ S.recBack="tasks"; S.recDraft={first:"",last:"",birth:"",phone:"",email:""}; S.cscreen="patients"; render(); scrollTo(0,0); }; };
    q.oninput=()=>{ clearTimeout(tm); tm=setTimeout(go,300); }; if(D.q) go(); }
  add.onclick=async()=>{ add.disabled=true; const pt=D.patient;
    const r=await run(()=>sb.rpc("create_task",{p_title:D.title.trim(),p_notes:D.notes.trim()||null,p_due:D.due||null,
      p_assignee:D.to==="me"?S.me.id:D.to==="secretariat"?null:D.to,p_group:D.to==="secretariat"?"secretariat":null,
      p_patient:pt&&!pt.child&&!pt.record?pt.id:null,p_child:pt&&pt.child?pt.id:null,p_record:pt&&pt.record?pt.id:null}),D.due&&D.remind!=null?null:"Tâche ajoutée");
    if(!r){ upd(); return; }
    if((D.extra||[]).length){ const {error}=await sb.rpc("set_task_people",{p_id:r.data,p_users:D.extra}); if(error) toast("Tâche ajoutée, mais les autres personnes n'ont pas pu être ajoutées : "+frError(error)); }
    if(D.due&&D.remind!=null){ const {error}=await sb.rpc("set_task_reminder",{p_id:r.data,p_days:D.remind});
      toast(error?"Tâche ajoutée, mais le rappel n'a pas pu être enregistré : "+frError(error):"Tâche ajoutée · rappel "+REMIND[D.remind].toLowerCase()); }
    if(pt&&!pt.record){ if(pt.child) S.children[pt.id]=pt; else S.profiles[pt.id]=pt; }
    S.tdraft=null; S.tview=D.to==="me"||(D.to==="secretariat"&&isDesk())?"todo":"given"; await refresh(); };
  $$("[data-tv]").forEach(b=>b.onclick=()=>{ S.tview=b.dataset.tv; render(); });
  $$("[data-tppl]").forEach(b=>b.onclick=()=>{ const t=S.tasks.find(x=>x.id===+b.dataset.tppl);
    pickColleagues("Personnes concernées par cette tâche",t.assigned_to?[t.assigned_to]:[],async ids=>{ if(await run(()=>sb.rpc("set_task_people",{p_id:t.id,p_users:ids}),ids.length?"Personnes mises à jour":"Plus personne en plus")){ t.task_people=ids.map(user_id=>({user_id})); render(); return true; } return false; },false,taskPeople(t)); });
  $$("[data-tk]").forEach(b=>b.onclick=()=>{ S.tkind=b.dataset.tk; render(); });
  $$("[data-trem]").forEach(sl=>sl.onchange=async()=>{ const t=S.tasks.find(x=>x.id===+sl.dataset.trem), v=sl.value===""?null:+sl.value;
    if(await run(()=>sb.rpc("set_task_reminder",{p_id:t.id,p_days:v}),v==null?"Rappel retiré":"Rappel : "+REMIND[v].toLowerCase())){ t.remind_days=v; t.reminded_at=null; render(); } else render(); });
  $$("[data-tdone]").forEach(b=>b.onclick=async()=>{ const t=S.tasks.find(x=>x.id===+b.dataset.tdone), d=!t.done_at;
    if(await run(()=>sb.rpc("set_task_done",{p_id:t.id,p_done:d}),d?"Tâche faite":"Tâche remise à faire")){ t.done_at=d?new Date().toISOString():null; t.done_by=d?S.me.id:null; render(); } });
  $$("[data-tdel]").forEach(b=>b.onclick=async()=>{ if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent="Confirmer ?"; b.style.color="var(--danger)"; return; }
    if(await run(()=>sb.rpc("delete_task",{p_id:+b.dataset.tdel}),"Tâche supprimée")){ S.tasks=S.tasks.filter(x=>x.id!==+b.dataset.tdel); render(); } });
}

/* ----- Accueil : la liste commune du secrétariat (tâches « secrétariat », avec une heure facultative) ----- */
const nowHM = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
const hm5 = t => t?String(t).slice(0,5):"";
const deskTasks = () => (S.tasks||[]).filter(t=>t.assigned_group==="secretariat");
const deskLate = t => !t.done_at&&t.due_date&&(t.due_date<todayISO()||(t.due_date===todayISO()&&t.due_time&&hm5(t.due_time)<=nowHM()));
const deskTodayCount = () => deskTasks().filter(t=>!t.done_at&&t.due_date&&t.due_date<=todayISO()).length;
function deskGroup(t){ const td=todayISO(); if(!t.due_date) return 4; if(deskLate(t)) return 0; if(t.due_date===td) return 1;
  const tm=new Date(); tm.setDate(tm.getDate()+1); const tmr=`${tm.getFullYear()}-${String(tm.getMonth()+1).padStart(2,"0")}-${String(tm.getDate()).padStart(2,"0")}`;
  return t.due_date===tmr?2:3; }
const DESK_GROUPS=["À faire maintenant","Aujourd'hui","Demain","Plus tard","Sans date"];
const deskSort = (a,b) => (a.due_date||"9999")<(b.due_date||"9999")?-1:(a.due_date||"9999")>(b.due_date||"9999")?1:(hm5(a.due_time)||"99")<(hm5(b.due_time)||"99")?-1:(hm5(a.due_time)||"99")>(hm5(b.due_time)||"99")?1:new Date(a.created_at)-new Date(b.created_at);
function deskRowHTML(t){
  const d=t.due_date&&t.due_date!==todayISO()?new Date(t.due_date+"T12:00").toLocaleDateString(LOC,{weekday:"short",day:"numeric",month:"short"}):"";
  return `<div class="deskrow ${t.done_at?"done":""} ${deskLate(t)?"late":""}">
    <button class="tcheck" data-ddone="${t.id}" aria-pressed="${!!t.done_at}" aria-label="${t.done_at?"Remettre à faire":"Fait"}">${t.done_at?"✓":""}</button>
    <div class="dtime">${t.due_time?`<b>${hm5(t.due_time).replace(":","h")}</b>`:`<span>—</span>`}${d?`<small>${esc(d)}</small>`:""}</div>
    <div class="dbody"><b>${esc(t.title)}</b>${t.notes?`<p class="tnotes">${esc(t.notes)}</p>`:""}${taskLinkHTML(t)}
     <small>Ajouté par ${esc(teamName(t.created_by))} · ${fmt(t.created_at)}${t.done_at?` · fait ${fmt(t.done_at)} par ${esc(teamName(t.done_by))}`:""}</small></div>
    <div class="dacts">${t.done_at?"":`<label class="dtimeedit" title="Changer l'heure"><span aria-hidden="true">🕑</span><input type="time" data-dtime="${t.id}" value="${hm5(t.due_time)}" aria-label="Heure"></label>`}
     ${t.created_by===S.me.id||isDesk()?`<button class="linkbtn tdel" data-ddel="${t.id}">Supprimer</button>`:""}</div></div>`;
}
function deskHTML(){
  const D=S.ddraft||(S.ddraft={title:"",notes:"",date:todayISO(),time:""});
  const open=deskTasks().filter(t=>!t.done_at).sort(deskSort), doneToday=deskTasks().filter(t=>t.done_at&&t.done_at.slice(0,10)>=todayISO()).sort((a,b)=>new Date(b.done_at)-new Date(a.done_at));
  let list="", g=-1;
  for(const t of open){ const k=deskGroup(t); if(k!==g){ g=k; list+=`<h4 class="tgroup g${k===0?0:k===1?1:k===2?2:3}">${DESK_GROUPS[k]} <span>${open.filter(x=>deskGroup(x)===k).length}</span></h4>`; } list+=deskRowHTML(t); }
  return `<div class="chead"><div><h1>Accueil</h1><p>La liste commune de l'accueil : appels à passer, choses à ne pas oublier. ${isDesk()?"Tout le secrétariat la voit et peut cocher.":"Ce que vous ajoutez ici va à tout le secrétariat (vous ne voyez que vos propres ajouts)."} À l'heure indiquée, le secrétariat reçoit une notification.</p></div></div>
  <section class="card deskform">
   <div class="deskadd"><label class="fld grow">À faire<input id="dk-title" maxlength="200" autocomplete="off" placeholder="Ex. Rappeler Mme Dupont (0470 12 34 56) pour son rendez-vous" value="${esc(D.title)}"></label>
    <label class="fld">Jour<input id="dk-date" type="date" value="${esc(D.date)}"></label>
    <label class="fld">Vers (heure)<input id="dk-time" type="time" value="${esc(D.time)}"></label>
    <button class="btn" id="dk-add" ${D.title.trim()?"":"disabled"}>Ajouter</button></div>
   <details class="dkmore" ${D.notes?"open":""}><summary>Ajouter une précision</summary><textarea id="dk-notes" rows="2" maxlength="2000" placeholder="Facultatif. Pas de détail médical.">${esc(D.notes)}</textarea></details>
  </section>
  <div class="desklist">${list||`<div class="empty"><span class="yay" aria-hidden="true">✨</span>Rien à faire à l'accueil pour l'instant.</div>`}</div>
  ${doneToday.length?`<details class="deskdone"><summary>Fait aujourd'hui (${doneToday.length})</summary><div class="desklist">${doneToday.map(deskRowHTML).join("")}</div></details>`:""}`;
}
let TASK_SEL="*, task_people(user_id)";
async function loadTasks(){ let r=await sb.from("tasks").select(TASK_SEL).order("created_at",{ascending:false}).limit(500);
  if(r.error&&TASK_SEL!=="*"){ TASK_SEL="*"; r=await sb.from("tasks").select("*").order("created_at",{ascending:false}).limit(500); }
  if(!r.error) S.tasks=r.data||[]; return r; }
let deskTimer=null;
function bindDesk(){
  clearInterval(deskTimer);
  deskTimer=setInterval(async()=>{ if(S.cscreen!=="desk"){ clearInterval(deskTimer); return; }
    const el=document.activeElement; if(el&&(el.tagName==="INPUT"||el.tagName==="TEXTAREA")) return;
    const before=JSON.stringify(S.tasks); const r=await loadTasks();
    if(!r.error&&JSON.stringify(S.tasks)!==before&&S.cscreen==="desk") render(); },45000);
  const D=S.ddraft, add=$("#dk-add"); const upd=()=>{ add.disabled=!D.title.trim(); };
  $("#dk-title").oninput=e=>{ D.title=e.target.value; upd(); };
  $("#dk-title").onkeydown=e=>{ if(e.key==="Enter"&&!add.disabled){ e.preventDefault(); add.click(); } };
  $("#dk-date").onchange=e=>{ D.date=e.target.value; };
  $("#dk-time").onchange=e=>{ D.time=e.target.value; };
  const nt=$("#dk-notes"); if(nt) nt.oninput=e=>{ D.notes=e.target.value; };
  add.onclick=async()=>{ add.disabled=true;
    const r=await run(()=>sb.rpc("create_task",{p_title:D.title.trim(),p_notes:D.notes.trim()||null,p_due:D.date||(D.time?todayISO():null),p_assignee:null,p_group:"secretariat",p_patient:null,p_child:null,p_record:null}),D.time?null:"Ajouté à la liste de l'accueil");
    if(!r){ upd(); return; }
    if(D.time){ const {error}=await sb.rpc("set_task_time",{p_id:r.data,p_time:D.time}); toast(error?"Ajouté, mais l'heure n'a pas pu être enregistrée : "+frError(error):`Ajouté · vers ${D.time.replace(":","h")}`); }
    S.ddraft=null; await refresh(); $("#dk-title")?.focus(); };
  $$("[data-ddone]").forEach(b=>b.onclick=async()=>{ const t=S.tasks.find(x=>x.id===+b.dataset.ddone), d=!t.done_at;
    if(await run(()=>sb.rpc("set_task_done",{p_id:t.id,p_done:d}),d?"Fait":"Remis à faire")){ t.done_at=d?new Date().toISOString():null; t.done_by=d?S.me.id:null; render(); } });
  $$("[data-dtime]").forEach(i=>i.onchange=async()=>{ const t=S.tasks.find(x=>x.id===+i.dataset.dtime), v=i.value||null;
    if(await run(()=>sb.rpc("set_task_time",{p_id:t.id,p_time:v}),v?`Heure : ${v.replace(":","h")}`:"Heure retirée")){ t.due_time=v; if(v&&!t.due_date) t.due_date=todayISO(); t.time_notified_at=null; render(); } });
  $$("[data-ddel]").forEach(b=>b.onclick=async()=>{ if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent="Confirmer ?"; b.style.color="var(--danger)"; return; }
    if(await run(()=>sb.rpc("delete_task",{p_id:+b.dataset.ddel}),"Supprimé")){ S.tasks=S.tasks.filter(x=>x.id!==+b.dataset.ddel); render(); } });
}

/* ----- Listes d'attente par prestataire (désistements) ----- */
const WL_SELECT="*, patient:profiles!waitlist_patient_id_fkey(first_name,last_name,birth_date,phone), child:children(first_name,last_name,birth_date,created_by), record:patient_records(first_name,last_name,birth_date,phone)";
async function loadWaitlist(){ const {data,error}=await sb.from("waitlist").select(WL_SELECT).order("created_at"); S.waitlist=error?null:(data||[]); }
const wlOpen = () => (S.waitlist||[]).filter(w=>w.status==="attente");
function wlWho(w){ const p=w.patient||w.child||w.record;
  const name=p?`${p.first_name||""} ${p.last_name||""}`.trim():(w.name||"Patient");
  const phone=w.phone||(w.patient&&w.patient.phone)||(w.record&&w.record.phone)||(w.child&&S.profiles[w.child.created_by]?.phone)||"";
  return {name,phone,birth:p&&p.birth_date,kind:w.child?"enfant":w.record?"fiche sans compte":w.patient?"":"sans compte"}; }
const daysSince = iso => Math.max(0,Math.floor((Date.now()-new Date(iso).getTime())/864e5));
function wlRowHTML(w,showProv){
  const x=wlWho(w), d=daysSince(w.created_at);
  return `<div class="wlrow ${w.urgent?"urgent":""} ${w.status!=="attente"?"closed":""}">
   <div class="wlmain"><b>${esc(x.name)}</b>${w.urgent?` <span class="ipill wlurg">Prioritaire</span>`:""}${showProv?` <span class="ipill">${esc(provName(w.provider_id))}</span>`:""}
    <small>${x.birth?`Né(e) le ${fmtDate(x.birth)} · `:""}${x.kind?esc(x.kind)+" · ":""}${x.phone?`<a href="tel:${esc(x.phone.replace(/\s/g,""))}">📞 ${esc(x.phone)}</a>`:"pas de téléphone"}</small>
    ${w.reason||w.availability?`<p class="wlinfo">${w.reason?`<span><i>Motif</i> ${esc(w.reason)}</span>`:""}${w.availability?`<span><i>Disponible</i> ${esc(w.availability)}</span>`:""}</p>`:""}
    <small class="wlmeta">${w.status==="attente"?`En attente depuis ${d===0?"aujourd'hui":d===1?"hier":d+" jours"}`:w.status==="fixe"?`Rendez-vous fixé ${fmt(w.closed_at)} par ${esc(teamName(w.closed_by))}`:`Retiré ${fmt(w.closed_at)} par ${esc(teamName(w.closed_by))}`} · ajouté par ${esc(teamName(w.created_by))}${w.attempts?` · <b>appelé ${w.attempts}× sans réponse</b> (dernier ${fmt(w.last_attempt_at)})`:""}</small></div>
   <div class="wlacts">${w.status==="attente"?`<button class="btn ghost sm" data-wl="${w.id}:appel">📞 Pas de réponse</button><button class="btn sm" data-wl="${w.id}:fixe">✓ RDV fixé</button>
     <button class="linkbtn" data-wl="${w.id}:${w.urgent?"normal":"urgent"}">${w.urgent?"Plus prioritaire":"Prioritaire"}</button><button class="linkbtn" data-wl="${w.id}:retire">Retirer</button>`
     :`<button class="linkbtn" data-wl="${w.id}:remettre">Remettre dans la liste</button>`}</div></div>`;
}
function waitlistHTML(){
  if(S.waitlist===undefined){ loadWaitlist().then(()=>{ if(S.cscreen==="waitlist") render(); }); return `<div class="chead"><div><h1>Listes d'attente</h1></div></div><p class="hint">Chargement…</p>`; }
  if(S.waitlist===null) return `<div class="chead"><div><h1>Listes d'attente</h1></div></div><div class="empty">Les listes d'attente ne sont pas encore activées (migration 045 à exécuter dans Supabase).</div>`;
  const F=S.wlProv||(S.me.provider_id&&S.providers.some(p=>p.id===S.me.provider_id)?S.me.provider_id:"all"), open=wlOpen();
  const provs=S.providers.filter(p=>open.some(w=>w.provider_id===p.id)||p.id===F);
  const sorted=l=>l.slice().sort((a,b)=>(b.urgent-a.urgent)||new Date(a.created_at)-new Date(b.created_at));
  const shown=sorted(F==="all"?open:open.filter(w=>w.provider_id===F));
  const closed=(S.waitlist||[]).filter(w=>w.status!=="attente"&&(F==="all"||w.provider_id===F)).sort((a,b)=>new Date(b.closed_at)-new Date(a.closed_at));
  const A=S.wlAdd;
  return `<div class="chead"><div><h1>Listes d'attente</h1><p>Les patients à appeler en cas de désistement, par prestataire. Les plus anciens et les prioritaires sont en haut. Identité, téléphone et un motif court seulement : jamais de détail médical.</p></div></div>
  <div class="ichips wlprov" role="group" aria-label="Prestataire"><button class="ichip all" data-wlp="all" aria-pressed="${F==="all"}">Tous <i>${open.length}</i></button>${provs.map(p=>`<button class="ichip" data-wlp="${p.id}" aria-pressed="${F===p.id}">${esc(P.label(p))} <i>${open.filter(w=>w.provider_id===p.id).length}</i></button>`).join("")}
   <button class="ichip" id="wl-pick" aria-label="Choisir un autre prestataire">+ Autre prestataire</button></div>
  ${A?`<section class="card wlform"><h3>Ajouter à la liste d'attente</h3>
    <label class="fld">Prestataire<select id="wl-prov">${S.providers.map(p=>`<option value="${p.id}" ${p.id===A.prov?"selected":""}>${esc(P.label(p))}</option>`).join("")}</select></label>
    <div class="fld">Patient
     ${A.patient?`<div class="recipient"><div class="ic">${IC.user}</div><div><b>${esc(`${A.patient.first_name||""} ${A.patient.last_name||""}`)}</b><small>Né(e) le ${fmtDate(A.patient.birth_date)}${A.patient.child?" · enfant":A.patient.record?" · fiche sans compte":""}</small></div><button type="button" class="linkbtn" id="wl-unpick">Changer</button></div>`
     :A.free?`<div class="row2"><label class="fld">Nom et prénom<input id="wl-name" maxlength="120" value="${esc(A.name||"")}"></label><label class="fld">Téléphone<input id="wl-phone" type="tel" maxlength="40" value="${esc(A.phone||"")}"></label></div><button type="button" class="linkbtn" id="wl-search">Chercher plutôt un patient de l'app</button>`
     :`<input id="wl-q" type="text" autocomplete="off" placeholder="Nom ou prénom (au moins 2 lettres)" value="${esc(A.q||"")}"><div id="wl-res"></div><p class="hint">Patient pas dans l'app ? <button type="button" class="linkbtn" id="wl-free">Écrire son nom et son téléphone</button></p>`}</div>
    ${A.patient?`<label class="fld">Téléphone à appeler (facultatif si déjà connu)<input id="wl-phone2" type="tel" maxlength="40" value="${esc(A.phone||"")}" placeholder="${esc(A.patient.phone||"")}"></label>`:""}
    <div class="row2"><label class="fld">Motif court<input id="wl-reason" maxlength="200" value="${esc(A.reason||"")}" placeholder="Ex. Contrôle, premier rendez-vous (pas de détail médical)"></label>
    <label class="fld">Disponibilités<input id="wl-avail" maxlength="200" value="${esc(A.avail||"")}" placeholder="Ex. matins, pas le mercredi, prévenir 2 h avant"></label></div>
    <label class="chk2"><input type="checkbox" id="wl-urg" ${A.urgent?"checked":""}> Prioritaire (à appeler en premier)</label>
    <div class="btnrow"><button class="btn" id="wl-save">Ajouter</button><button class="btn ghost" id="wl-cancel">Annuler</button></div></section>`
  :`<div class="btnrow"><button class="btn" id="wl-new">+ Ajouter un patient à une liste d'attente</button></div>`}
  <div class="wllist">${shown.length?shown.map(w=>wlRowHTML(w,F==="all")).join(""):`<div class="empty">Personne en attente${F==="all"?"":" pour "+esc(provName(F))}.</div>`}</div>
  ${closed.length?`<details class="deskdone"><summary>Sortis de la liste (${closed.length}, gardés 90 jours)</summary><div class="wllist">${closed.map(w=>wlRowHTML(w,F==="all")).join("")}</div></details>`:""}`;
}
function bindWaitlist(){
  $$("[data-wlp]").forEach(b=>b.onclick=()=>{ S.wlProv=b.dataset.wlp; render(); });
  const pk=$("#wl-pick"); if(pk) pk.onclick=()=>{ const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true");
    v.innerHTML=`<div class="mbox"><h2>Choisir un prestataire</h2><div class="pclist">${S.providers.map(p=>`<button type="button" class="prrow" data-pp="${p.id}"><b>${esc(P.label(p))}</b></button>`).join("")}</div><div class="btnrow"><button class="btn ghost" id="pp-x">Annuler</button></div></div>`;
    document.body.appendChild(v); const close=()=>v.remove(); v.querySelector("#pp-x").onclick=close; v.onclick=e=>{ if(e.target===v) close(); };
    v.querySelectorAll("[data-pp]").forEach(b=>b.onclick=()=>{ close(); S.wlProv=b.dataset.pp; render(); }); };
  const nw=$("#wl-new"); if(nw) nw.onclick=()=>{ S.wlAdd={prov:S.wlProv&&S.wlProv!=="all"?S.wlProv:(S.me.provider_id||S.providers[0]?.id),patient:null,q:""}; render(); $("#wl-q")?.focus(); };
  const A=S.wlAdd;
  if(A){
    const keep=()=>{ const g=id=>$(id)?.value; A.prov=g("#wl-prov")||A.prov; if($("#wl-name")) A.name=g("#wl-name"); if($("#wl-phone")) A.phone=g("#wl-phone"); if($("#wl-phone2")) A.phone=g("#wl-phone2");
      A.reason=g("#wl-reason")||""; A.avail=g("#wl-avail")||""; A.urgent=$("#wl-urg")?.checked||false; };
    $("#wl-cancel").onclick=()=>{ S.wlAdd=null; render(); };
    const un=$("#wl-unpick"); if(un) un.onclick=()=>{ keep(); A.patient=null; render(); $("#wl-q")?.focus(); };
    const fr=$("#wl-free"); if(fr) fr.onclick=()=>{ keep(); A.free=true; render(); $("#wl-name")?.focus(); };
    const se=$("#wl-search"); if(se) se.onclick=()=>{ keep(); A.free=false; render(); $("#wl-q")?.focus(); };
    const q=$("#wl-q");
    if(q){ let tm; const go=async()=>{ A.q=q.value; const words=norm(q.value).replace(/[*%,().]/g," ").split(/\s+/).filter(w=>w.length>=2), out=$("#wl-res");
        if(!words.length){ out.innerHTML=""; return; }
        let rows=await searchPatients(words); if(rows===null){ out.innerHTML=`<p class="hint">La recherche n'a pas fonctionné.</p>`; return; }
        rows=[...rows,...recordsMatching(words)].slice(0,14);
        out.innerHTML=rows.length?`<div class="list">${rows.map(patientPickRow).join("")}</div>`:`<p class="hint">Aucun patient ne correspond.</p>`;
        out.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{ keep(); A.patient=rows.find(p=>p.id===b.dataset.pick); render(); }); };
      q.oninput=()=>{ clearTimeout(tm); tm=setTimeout(go,300); }; if(A.q) go(); }
    $("#wl-save").onclick=async e=>{ keep(); const pt=A.patient, b=e.target; b.disabled=true;
      const ok=await run(()=>sb.rpc("waitlist_add",{p_provider:A.prov,p_patient:pt&&!pt.child&&!pt.record?pt.id:null,p_child:pt&&pt.child?pt.id:null,p_record:pt&&pt.record?pt.id:null,
        p_name:pt?null:(A.name||null),p_phone:A.phone||null,p_reason:A.reason||null,p_availability:A.avail||null,p_urgent:!!A.urgent}),`Ajouté à la liste d'attente de ${provName(A.prov)}`);
      if(!ok){ b.disabled=false; return; }
      S.wlProv=A.prov; S.wlAdd=null; await loadWaitlist(); render(); };
  }
  $$("[data-wl]").forEach(b=>b.onclick=async()=>{ const [id,act]=b.dataset.wl.split(":");
    if((act==="retire"||act==="fixe")&&b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent=act==="fixe"?"Confirmer : RDV fixé ?":"Confirmer ?"; return; }
    const msg={appel:"Appel noté : pas de réponse",fixe:"Rendez-vous fixé · retiré de la liste",retire:"Retiré de la liste",remettre:"Remis dans la liste",urgent:"Marqué prioritaire",normal:"Plus prioritaire"}[act];
    b.disabled=true; if(await run(()=>sb.rpc("waitlist_update",{p_id:+id,p_action:act}),msg)){ await loadWaitlist(); render(); } else b.disabled=false; });
}

/* ----- comptes à valider ----- */
function accountsHTML(){
  const K=S.pendingKids||[];
  return `<div class="chead"><div><h1>Comptes à valider</h1><p>Vérifiez que la personne est bien patiente du centre (nom, date de naissance, téléphone) avant de valider.</p></div></div>
  ${K.length?`<h3 class="subh">Enfants ajoutés par un parent</h3><p class="hint">Vérifiez dans le dossier que l'enfant existe et que la personne est bien son parent.</p>
  <div class="list" style="margin-bottom:20px">${K.map(c=>`<div class="medrow"><div class="ic">${IC.user}</div><div><b>${esc(c.first_name+" "+c.last_name)}</b><small>Né(e) le ${fmtDate(c.birth_date)} · ajouté par <b>${esc(patientName(c.created_by))}</b> (né(e) le ${fmtDate(S.profiles[c.created_by]?.birth_date)}, tél. ${esc(S.profiles[c.created_by]?.phone||"—")}) · ${fmt(c.created_at)}</small></div><div class="acts"><button class="mini" data-kok="${c.id}">Valider</button><button class="linkbtn" style="font-size:12px;color:var(--muted)" data-kno="${c.id}">Refuser</button></div></div>`).join("")}</div>
  <h3 class="subh">Comptes de patients</h3>`:""}
  <div class="list">${S.pending.length?S.pending.map(p=>`<div class="medrow"><div class="ic">${IC.user}</div><div><b>${esc((p.first_name||"")+" "+(p.last_name||""))}</b><small>Né(e) le ${fmtDate(p.birth_date)} · Tél. ${esc(p.phone||"—")} · inscrit ${fmt(p.created_at)}</small>${(()=>{ const m=recMatch(p); return m?`<div class="recmatch">📇 Une fiche existe pour ce patient (créée par ${esc(teamName(m.created_by))}, tél. ${esc(m.phone||"—")}). <button class="linkbtn" data-rlink="${m.id}|${p.id}">Relier le compte à la fiche</button></div>`:""; })()}</div><div class="acts"><button class="mini" data-ok="${p.id}">Valider</button><button class="linkbtn" style="font-size:12px;color:var(--muted)" data-no="${p.id}">Refuser</button></div></div>`).join(""):`<div class="empty">Aucun compte en attente.</div>`}</div>`;
}
const recMatch = p => (S.records||[]).find(r=>r.birth_date===p.birth_date&&norm((r.first_name||"").trim())===norm((p.first_name||"").trim())&&norm((r.last_name||"").trim())===norm((p.last_name||"").trim()));
function bindAccounts(){
  $$("[data-rlink]").forEach(b=>b.onclick=async()=>{ const [rid,pid]=b.dataset.rlink.split("|"); b.disabled=true;
    if(await run(()=>sb.rpc("link_patient_record",{p_record:rid,p_profile:pid}),"Compte relié à la fiche · les tâches suivent")) await refresh(); else b.disabled=false; });
  $$("[data-kok]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_child_status",{p_child:b.dataset.kok,p_status:"active"}),"Enfant validé · parents prévenus")) await refresh(); });
  $$("[data-kno]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_child_status",{p_child:b.dataset.kno,p_status:"blocked"}),"Ajout refusé · parents prévenus")) await refresh(); });
  $$("[data-ok]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_patient_status",{p_patient:b.dataset.ok,p_status:"active"}),"Compte validé")) await refresh(); });
  $$("[data-no]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_patient_status",{p_patient:b.dataset.no,p_status:"blocked"}),"Compte refusé")) await refresh(); });
}

/* ----- équipe (administrateur) ----- */
function teamHTML(){
  const provOpts=sel=>`<option value="">— prestataire —</option>`+S.providers.map(p=>`<option value="${p.id}" ${p.id===sel?"selected":""}>${esc(P.label(p))}</option>`).join("");
  const adm=isAdmin();
  return `<div class="chead"><div><h1>Équipe</h1><p>${adm?"Chaque membre de l'équipe crée d'abord son compte dans l'app (« Créer un compte »). Retrouvez-le ensuite ci-dessous et donnez-lui son rôle.":"Les membres de l'équipe du centre et leur rôle. Seul l'administrateur peut ajouter ou retirer quelqu'un."}</p></div></div>
  ${adm?`<section class="card" style="margin-bottom:12px"><h3>Donner un rôle à un compte</h3>
   <label class="fld" for="t-search">Nom de la personne inscrite<input id="t-search" type="text" placeholder="Tapez au moins 2 lettres du nom"></label>
   <div id="t-results"></div></section>`:""}
  <div class="list">${S.team.map(t=>`<div class="medrow">${avatarHTML(AV.get(t.id),`${t.first_name||""} ${t.last_name||""}`,32)}<div><b>${esc((t.first_name||"")+" "+(t.last_name||""))}</b><small>${ROLE_LABEL[t.role]}${t.provider_id?" · "+esc(provName(t.provider_id)):""}${t.is_admin&&t.role!=="admin"?" · administrateur":""}</small></div><div class="acts">${adm?`<label class="chk2 admchk" title="${t.id===S.me.id?"Vous ne pouvez pas modifier vos propres droits d'administrateur":"L'administrateur valide les comptes des patients et gère l'équipe"}"><input type="checkbox" data-admin="${t.id}" ${isAdminP(t)?"checked":""} ${t.id===S.me.id?"disabled":""}> Administrateur</label>`:""}${adm&&t.id!==S.me.id?`<button class="linkbtn" style="font-size:12px;color:var(--muted)" data-demote="${t.id}">Retirer de l'équipe</button>`:""}</div></div>`).join("")}</div>
  ${adm?`<p class="hint" style="margin-top:10px">Cochez « Administrateur » pour donner à un membre de l'équipe (secrétariat, prestataire, administration) les droits d'administrateur : valider les comptes des patients et des enfants, gérer l'équipe, recevoir les alertes de sécurité. La personne garde son rôle et tout son travail habituel. Vous ne pouvez pas modifier vos propres droits : demandez à un autre administrateur.</p>`:""}
  <template id="t-row"><div class="person" style="border-top:1px solid var(--line);padding-top:10px;margin-top:10px"><b class="t-name"></b><div class="pgrid"><label>Rôle<select class="t-role"><option value="secretariat">Secrétariat</option><option value="provider">Prestataire</option><option value="gestion">Administration (gestion du centre)</option><option value="admin">Prestataire et administrateur</option></select></label><label>Prestataire<select class="t-prov">${provOpts("")}</select></label></div><div class="btnrow"><button class="btn t-go">Enregistrer</button></div></div></template>`;
}
function bindTeam(){
  const inp=$("#t-search"), out=$("#t-results"); let timer;
  if(!inp) return;
  inp.oninput=()=>{ clearTimeout(timer); timer=setTimeout(async()=>{ const q=inp.value.trim(); out.innerHTML=""; if(q.length<2) return;
    const {data}=await sb.from("profiles").select("id,first_name,last_name,birth_date,role").or(`first_name.ilike.*${q.replace(/[*%,().]/g,"")}*,last_name.ilike.*${q.replace(/[*%,().]/g,"")}*`).limit(10);
    (data||[]).forEach(p=>{ const node=$("#t-row").content.cloneNode(true);
      node.querySelector(".t-name").textContent=`${p.first_name||""} ${p.last_name||""} · né(e) le ${fmtDate(p.birth_date)} · actuellement : ${ROLE_LABEL[p.role]}`;
      const role=node.querySelector(".t-role"), prov=node.querySelector(".t-prov"), go=node.querySelector(".t-go");
      go.onclick=async()=>{ if(await run(()=>sb.rpc("set_staff_role",{p_user:p.id,p_role:role.value,p_provider:prov.value||null}),"Rôle enregistré")) await refresh(); };
      out.appendChild(node); });
    if(!(data||[]).length) out.innerHTML=`<p class="hint">Aucun compte trouvé. La personne doit d'abord s'inscrire dans l'app.</p>`;
  },300); };
  $$("[data-admin]").forEach(c=>c.onchange=async()=>{ const t=S.team.find(x=>x.id===c.dataset.admin), on=c.checked;
    const nm=`${t.first_name||""} ${t.last_name||""}`.trim();
    c.disabled=true;
    if(await run(()=>sb.rpc("set_staff_admin",{p_user:t.id,p_on:on}),on?nm+" est maintenant administrateur":nm+" n'est plus administrateur")) await refresh();
    else { c.checked=!on; c.disabled=false; } });
  $$("[data-demote]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_staff_role",{p_user:b.dataset.demote,p_role:"patient",p_provider:null}),"Retiré de l'équipe")) await refresh(); });
}

/* ----- actualités (secrétariat, administrateur) ----- */
const NEWS_CATS=["Fermeture","Horaires","Prévention","Nouveau au centre","Pratique"];
function newsAdminHTML(){
  const now=new Date(), ed=S.editNews?S.allNews.find(n=>n.id===S.editNews):null;
  const v=ed||{category:NEWS_CATS[0],title:"",body:"",pinned:false,expires_at:null,image_path:null};
  if(S.newsMode==null||S.newsModeFor!==(ed?ed.id:0)){ S.newsMode=ed&&ed.image_path&&!(ed.body||"").trim()?"img":"txt"; S.newsModeFor=ed?ed.id:0; }
  const IM=S.newsMode==="img";
  return `<div class="chead"><div><h1>Actualités</h1><p>Publiées dans l'app des patients. Informations pratiques uniquement, sans donnée personnelle.</p></div></div>
  ${isAdmin()?photosAdminHTML():""}
  <div class="pane">
   <form class="card ${ed?"editing":""}" id="newsform">
    <h3>${ed?"Modifier l'annonce":"Nouvelle annonce"}</h3>
    <div class="seg" role="group" aria-label="Type d'annonce" style="margin-bottom:10px"><button type="button" data-nmode="txt" aria-pressed="${!IM}">📝 Texte</button><button type="button" data-nmode="img" aria-pressed="${IM}">🖼️ Image (affiche)</button></div>
    ${IM?`<p class="hint" style="margin-top:0">Comme une affiche de l'écran de la salle d'attente : l'image est montrée en entier, sans texte à côté. Paysage ou portrait, PNG ou JPG.</p>`:""}
    <label class="fld" for="n-title">${IM?"Titre court (pour la notification et les personnes malvoyantes)":"Titre"}<input type="text" id="n-title" maxlength="80" required value="${esc(v.title)}"></label>
    <label class="fld" for="n-body" ${IM?"hidden":""}>Texte<textarea id="n-body" rows="5" maxlength="800">${esc(v.body)}</textarea></label>
    <div class="pgrid"><label class="fld" for="n-cat">Catégorie<select id="n-cat">${NEWS_CATS.map(c=>`<option ${c===v.category?"selected":""}>${c}</option>`).join("")}</select></label>
    <label class="fld" for="n-exp">Retirer automatiquement le<input type="date" id="n-exp" value="${v.expires_at?esc(new Date(v.expires_at).toLocaleDateString("sv-SE")):""}"></label></div>
    ${ed&&v.image_path?`<div class="curimg"><img src="${esc(v.image_path)}" alt=""><label class="chk2"><input type="checkbox" id="n-noimg"> Retirer cette image</label></div>`:""}
    <label class="fld" for="n-img">${ed&&v.image_path?"Remplacer l'image (facultatif)":IM?"Image de l'affiche":"Image (facultatif)"}<input type="file" id="n-img" accept="image/png,image/jpeg,image/webp"></label>
    <label class="chk2"><input type="checkbox" id="n-pin" ${v.pinned?"checked":""}> Épingler en haut de l'accueil</label>
    ${ed?`<p class="hint">La modification corrige l'annonce affichée ; aucune nouvelle notification n'est envoyée aux patients.</p>`
      :`<label class="chk2"><input type="checkbox" id="n-notif"> Envoyer une notification aux patients qui l'ont accepté${typeof S.audience==="number"?` (${S.audience} patient${S.audience>1?"s":""})`:""} <small class="hint">à réserver aux annonces importantes</small></label>`}
    <div class="btnrow"><button class="btn" type="submit" id="n-pub">${ed?"Enregistrer les modifications":"Publier"}</button>${ed?`<button class="btn ghost" type="button" id="n-cancel">Annuler</button>`:""}</div>
   </form>
   <section class="card"><h3>Annonces</h3>
    <div class="list">${S.allNews.length?S.allNews.map(n=>{const live=!n.expires_at||new Date(n.expires_at)>now;return `<div class="medrow ${n.id===S.editNews?"sel":""}"><div class="ic">${IC.news}</div><div><b>${esc(n.title)}</b><small>${esc(n.category)} · publiée ${fmt(n.published_at)}${n.expires_at?` · ${live?"jusqu'au":"expirée le"} ${fmtDate(n.expires_at)}`:""}${n.pinned?" · épinglée":""}</small></div><div class="acts"><button class="mini" data-edit-news="${n.id}">Modifier</button><button class="mini" data-pin="${n.id}" data-v="${n.pinned?0:1}">${n.pinned?"Désépingler":"Épingler"}</button><button class="linkbtn" style="font-size:12px;color:var(--muted)" data-del="${n.id}">Retirer</button></div></div>`}).join(""):`<div class="empty">Aucune annonce.</div>`}</div>
   </section>
  </div>`;
}
// grande image (affiche en haute définition) : réduite à 1920 px de large et enregistrée en JPEG
async function shrinkPoster(f){
  try{ const bm=await createImageBitmap(f); const sc=Math.min(1,1920/Math.max(bm.width,bm.height));
    if(sc===1&&f.size<=1.5e6) return f;
    const c=document.createElement("canvas"); c.width=Math.round(bm.width*sc); c.height=Math.round(bm.height*sc);
    const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); x.drawImage(bm,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",0.86)); if(!blob) return f;
    return new File([blob],f.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}); }catch(e){ return f; } }
async function uploadNewsImage(f){
  f=await shrinkPoster(f);
  if(f.size>3e6) throw new Error("Image trop lourde (3 Mo maximum).");
  const path=`${Date.now()}-${f.name.replace(/[^\w.-]/g,"_")}`;
  const up=await sb.storage.from("announcements").upload(path,f,{contentType:f.type}); if(up.error) throw up.error;
  return sb.storage.from("announcements").getPublicUrl(path).data.publicUrl;
}
function bindNewsAdmin(){
  if(isAdmin()&&S.photos) bindPhotosAdmin();
  const ed=S.editNews?S.allNews.find(n=>n.id===S.editNews):null;
  $("#newsform").onsubmit=async e=>{ e.preventDefault(); const btn=$("#n-pub"); btn.disabled=true;
    try{
      const IM=S.newsMode==="img", title=$("#n-title").value.trim(), body=IM?"":$("#n-body").value.trim();
      const exp=$("#n-exp").value, f=$("#n-img").files[0];
      if(!title) throw new Error(IM?"Donnez un titre court à l'affiche.":"Donnez un titre et un texte.");
      if(!IM&&!body) throw new Error("Donnez un titre et un texte.");
      if(IM&&!f&&!(ed&&ed.image_path&&!$("#n-noimg")?.checked)) throw new Error("Choisissez l'image de l'affiche.");
      const fields={title,body,category:$("#n-cat").value,pinned:$("#n-pin").checked,expires_at:exp?new Date(exp+"T23:59:00").toISOString():null};
      if(ed){
        if(f) fields.image_path=await uploadNewsImage(f); else if($("#n-noimg")?.checked) fields.image_path=null;
        const up=await sb.from("announcements").update(fields).eq("id",ed.id).select("id");
        if(up.error) throw up.error; if(!(up.data||[]).length) throw new Error("Modification refusée.");
        S.editNews=null; toast("Annonce modifiée"); await refresh();
      } else {
        fields.image_path=f?await uploadNewsImage(f):null; fields.notify=$("#n-notif").checked;
        const ins=await sb.from("announcements").insert(fields); if(ins.error) throw ins.error;
        S.newsMode=null; toast("Annonce publiée"); await refresh();
      }
    }catch(err){ toast(frError(err)); btn.disabled=false; } };
  const c=$("#n-cancel"); if(c) c.onclick=()=>{ S.editNews=null; render(); };
  $$("[data-nmode]").forEach(b=>b.onclick=()=>{ S.newsMode=b.dataset.nmode; render(); });
  $$("[data-edit-news]").forEach(b=>b.onclick=()=>{ S.editNews=+b.dataset.editNews; render(); $("#newsform").scrollIntoView({behavior:"smooth",block:"start"}); $("#n-title").focus({preventScroll:true}); });
  $$("[data-pin]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.from("announcements").update({pinned:b.dataset.v==="1"}).eq("id",+b.dataset.pin),"Enregistré")) await refresh(); });
  $$("[data-del]").forEach(b=>b.onclick=async()=>{ if(S.editNews===+b.dataset.del) S.editNews=null; if(await run(()=>sb.from("announcements").delete().eq("id",+b.dataset.del),"Annonce retirée")) await refresh(); });
}

/* ----- mes notifications (équipe) ----- */
const SETOPTS=["Immédiate","2 fois par jour","Résumé du matin","Aucune"];
const RDV_MODES=[["secretariat","Au secrétariat uniquement"],["copie","Au secrétariat, et je suis prévenu(e) en copie"],["direct","Directement chez moi"]];
function settingsHTML(){
  const s=S.settings||{haute:"Immédiate",normale:"2 fois par jour",by_email:false,away:false,forward_to:null};
  const sel=(id,val)=>`<select id="${id}">${SETOPTS.map(o=>`<option ${o===val?"selected":""}>${o}</option>`).join("")}</select>`;
  const others=S.team.filter(t=>t.id!==S.me.id&&t.status==="active");
  return `<div class="chead"><div><h1>Mon profil et mes notifications</h1><p>Quand et comment vous êtes prévenu des nouvelles demandes et des messages de patients. Les notifications ne contiennent jamais de donnée médicale.</p></div></div>
  <div class="settings">
   ${photoCardHTML("Facultatif. Visible par les patients dans les conversations, et par l'équipe.")}
   ${faceIdCardHTML()}
   ${trustCardHTML()}
   ${textSizeHTML()}
   <section class="card"><h3>Quand me prévenir</h3><div class="pgrid">
    <label class="fld">Haute priorité (à voir en moins de 24 h)${sel("s-haute",s.haute)}</label>
    <label class="fld">Pas pressé (à voir en moins de 72 h)${sel("s-normale",s.normale)}</label></div>
    <p class="hint">« 2 fois par jour » : à 11:00 et à 16:00. « Résumé du matin » : à 9:00.</p>
    <label class="chk2"><input type="checkbox" id="s-after" ${s.after_hours?"checked":""}> Me prévenir aussi en dehors des heures d'ouverture (soirs, week-ends, jours de fermeture)</label>
    <p class="hint">Décoché : rien n'est envoyé quand le centre est fermé ; les alertes arrivent à la réouverture.</p>
    <label class="chk2"><input type="checkbox" id="s-mail" ${s.by_email?"checked":""}> Aussi par e-mail</label>
    ${pushBlockHTML(true)}</section>
   ${S.me.provider_id?`<section class="card"><h3>Contact par les patients</h3>
    <label class="chk2"><input type="checkbox" id="s-direct" ${P.byId(S.me.provider_id)?.direct_contact!==false?"checked":""}> Les patients peuvent m'écrire directement</label>
    <p class="hint">Décoché : les questions, demandes de prescription, de rapport et les documents qui vous sont destinés arrivent d'abord au secrétariat, qui vous les transfère si nécessaire. Dans tous les cas, un patient qui dit ne vous avoir jamais consulté passe par le secrétariat.</p>
    <label class="fld">Demandes de rendez-vous qui me sont adressées<select id="s-rdv">${RDV_MODES.map(([v,t])=>`<option value="${v}" ${(P.byId(S.me.provider_id)?.rdv_mode||"secretariat")===v?"selected":""}>${t}</option>`).join("")}</select></label>
    <p class="hint">Seulement quand le patient dit vous avoir déjà consulté (sinon : toujours au secrétariat). « Directement chez moi » : vous fixez le créneau vous-même, ou vous transférez la demande au secrétariat.</p></section>`:""}
   <section class="card"><h3>Mes congés</h3>
    <p class="hint">Pendant chaque période, vous êtes automatiquement considéré(e) comme absent(e) : vos notifications vont au collègue choisi ci-dessous${S.me.provider_id?" et les patients qui vous écrivent reçoivent une réponse automatique avec votre date de retour":""}. Les patients voient vos dates d'absence, jamais le motif.</p>
    ${(S.leaves||[]).length?`<ul class="leavelist">${S.leaves.map(l=>`<li><span>Du <b>${fmtDate(l.starts+"T12:00")}</b> au <b>${fmtDate(l.ends+"T12:00")}</b> inclus</span><button type="button" class="linkbtn" data-lvdel="${l.id}">Supprimer</button></li>`).join("")}</ul>`:`<p class="hint">Aucun congé programmé.</p>`}
    <div class="pgrid"><label class="fld">Du<input type="date" id="lv-from" min="${todayISO()}"></label><label class="fld">Au (inclus)<input type="date" id="lv-to" min="${todayISO()}"></label></div>
    <div class="btnrow"><button type="button" class="btn ghost" id="lv-add">Ajouter cette période</button></div>
    ${S.me.provider_id?`<label class="chk2"><input type="checkbox" id="s-lvauto" ${s.leave_auto!==false?"checked":""}> Pendant mes congés, répondre automatiquement aux patients qui m'écrivent (avec ma date de retour)</label>`:""}
    <label class="fld">Pendant mes congés et absences, renvoyer mes notifications vers<select id="s-fw"><option value="">Ne pas renvoyer</option>${others.map(t=>`<option value="${t.id}" ${t.id===s.forward_to?"selected":""}>${esc((t.first_name||"")+" "+(t.last_name||""))} · ${ROLE_LABEL[t.role]}</option>`).join("")}</select></label>
   </section>
   <section class="card"><h3>Absence imprévue</h3>
    <label class="chk2"><input type="checkbox" id="s-away" ${s.away?"checked":""}> Je suis absent(e) maintenant (maladie, imprévu…)</label>
    <div id="s-awaybox" class="awaybox" ${s.away?"":"hidden"}>
     <label class="fld">Jusqu'au (inclus) — facultatif : l'absence s'arrête toute seule après cette date<input type="date" id="s-until" value="${s.away_until||""}"></label>
     ${S.me.provider_id?`<label class="chk2"><input type="checkbox" id="s-amsg" ${s.away_message?"checked":""}> Répondre automatiquement aux patients qui m'écrivent</label>
     <textarea id="s-msg" rows="5" maxlength="1000" ${s.away_message?"":"hidden"} aria-label="Message automatique">${esc(s.away_message||"")}</textarea>
     <p class="hint" id="s-msghint" ${s.away_message?"":"hidden"}>Envoyé une seule fois par conversation, signé « ${esc(provName(S.me.provider_id))} · message automatique ». Il ne compte pas comme une réponse : la demande reste à traiter.</p>`:""}
    </div></section>
   <div class="btnrow"><button class="btn" id="s-save">Enregistrer</button></div>
   <p class="hint">« Aussi par e-mail » : un résumé envoyé à votre adresse de connexion, sans nom de patient ni contenu médical.</p>
   ${versionHTML()}
  </div>`;
}
function awayDefaultText(u=$("#s-until")?.value, fwId=$("#s-fw")?.value){
  const fw=S.team.find(t=>t.id===fwId);
  const until=u?` jusqu'au ${new Date(u+"T12:00").toLocaleDateString(LOC,{weekday:"long",day:"numeric",month:"long"})} inclus`:"";
  return `Bonjour,\nJe suis absent(e)${until}. Votre message a bien été reçu${fw?` et sera traité par ${(fw.first_name||"")+" "+(fw.last_name||"")}`:" et sera traité à mon retour"}.\nPour une question qui ne peut pas attendre, appelez le secrétariat au 02 781 18 75. Urgence vitale : 112.`;
}
function bindSettings(){
  bindPhotoCard(); bindPush(); bindTextSize(); bindFaceIdCard(); bindTrustCard();
  const dc=$("#s-direct"); if(dc) dc.onchange=async()=>{ const v=dc.checked;
    if(await run(()=>sb.rpc("set_my_direct_contact",{p_ok:v}),v?"Les patients peuvent vous écrire directement":"Les demandes passeront d'abord par le secrétariat")){ const pr=P.byId(S.me.provider_id); if(pr) pr.direct_contact=v; } else dc.checked=!v; };
  $("#lv-add").onclick=async()=>{ const f=$("#lv-from").value, t=$("#lv-to").value;
    if(!f||!t) return toast("Choisissez les deux dates.");
    if(t<f) return toast("La date de fin doit être après la date de début.");
    if(await run(()=>sb.rpc("add_my_leave",{p_starts:f,p_ends:t}),"Congé ajouté")){ await loadLeaves(); render(); } };
  $$("[data-lvdel]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("delete_my_leave",{p_id:+b.dataset.lvdel}),"Congé supprimé")){ await loadLeaves(); render(); } });
  const rm=$("#s-rdv"); if(rm){ rm.dataset.prev=rm.value; rm.onchange=async()=>{ const v=rm.value;
    if(await run(()=>sb.rpc("set_my_rdv_mode",{p_mode:v}),"Enregistré")){ const pr=P.byId(S.me.provider_id); if(pr) pr.rdv_mode=v; rm.dataset.prev=v; } else rm.value=rm.dataset.prev; }; }
  const away=$("#s-away"), box=$("#s-awaybox"), am=$("#s-amsg"), msg=$("#s-msg"), hint=$("#s-msghint");
  if(msg) msg.dataset.auto=msg.value.trim()?"":"1";
  const fill=()=>{ if(msg&&msg.dataset.auto) msg.value=awayDefaultText(); };
  away.onchange=()=>{ box.hidden=!away.checked; };
  $("#s-until").onchange=fill; $("#s-fw").onchange=fill;
  if(am){ am.onchange=()=>{ msg.hidden=hint.hidden=!am.checked; if(am.checked){ if(!msg.value.trim()){ msg.dataset.auto="1"; fill(); } msg.focus(); } };
    msg.oninput=()=>{ msg.dataset.auto=""; }; }
  $("#s-save").onclick=async()=>{
    const row={user_id:S.me.id,haute:$("#s-haute").value,normale:$("#s-normale").value,by_email:$("#s-mail").checked,after_hours:$("#s-after").checked,...($("#s-lvauto")?{leave_auto:$("#s-lvauto").checked}:{}),
      away:away.checked,away_until:$("#s-until").value||null,forward_to:$("#s-fw").value||null,
      away_message:am&&am.checked&&msg.value.trim()?msg.value.trim():null};
    if(row.away&&!row.forward_to&&!row.away_message) return toast(am?"Choisissez un collègue, ou activez le message automatique.":"Choisissez le collègue qui recevra vos notifications.");
    if(row.away_until&&row.away_until<new Date().toISOString().slice(0,10)) return toast("La date de retour est déjà passée.");
    if(await run(()=>sb.from("staff_settings").upsert(row),"Enregistré")){ S.settings={...(S.settings||{}),...row}; render(); }
  };
}

/* ---------- temps réel : les nouveaux messages arrivent instantanément ---------- */
let RT=null, rtTimer=null; const RTQ=new Set();
/* =====================================================================
   ORGANISATION (version 20261027a)
   Navigation par rubriques · Recherche · Agenda Rosa dans l'app ·
   Dessins de profil · Horaires des accueillantes · Caisse
   ===================================================================== */
const canOffice = () => !!S.me && (isDesk()||isGestion()||isAdmin());
const canManageOffice = () => !!S.me && (isGestion()||isAdmin());
SI.search='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
SI.clock='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
SI.euro='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/></svg>';
SI.more='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
SI.pin='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5"/><path d="M9 3h6l-1 6 4 3v2H6v-2l4-3z"/></svg>';

/* ---------- navigation par rubriques ---------- */
function navGroups(){
  const nIn=S.reqs.filter(awaitingStaff).length;
  const G=[
   {h:"Patients",it:[
     {cs:"inbox",ic:SI.inbox,t:"Demandes",n:nIn,hot:myUrgent().length},
     {cs:"compose",ic:SI.pen,t:"Écrire à un patient"},
     {cs:"patients",ic:IC.user,t:"Fiches patients"},
     {cs:"waitlist",ic:SI.hourglass,t:"Listes d'attente"},
     ...(isAdmin()?[{cs:"accounts",ic:SI.ucheck,t:"Comptes à valider",n:S.pending.length+(S.pendingKids||[]).length}]:[])]},
   {h:"Équipe",it:[
     {cs:"messages",ic:SI.chat,t:"Messages",n:teamUnread()},
     {cs:"tasks",ic:SI.tasks,t:"Tâches",n:myTasks().length},
     {cs:"leaves",ic:SI.cal,t:"Congés"},
     ...(isAdmin()||isGestion()?[{cs:"team",ic:SI.team,t:"Comptes de l'équipe"}]:[])]},
   {h:"Secrétariat",it:[
     {cs:"desk",ic:SI.phone,t:"Accueil",n:isDesk()?deskTodayCount():0},
     ...(canOffice()?[{cs:"hours",ic:SI.clock,t:"Horaires"},{cs:"cash",ic:SI.euro,t:"Caisse"}]:[])]},
   {h:"Le centre",it:[
     ...(canPub()?[{cs:"news",ic:SI.news||IC.news,t:"Actualités"}]:[]),
     {cs:"binder",ic:SI.book,t:"Classeur"},
     {cs:"fiches",ic:IC.doc,t:"Fiches conseils"},
     {cs:"inventory",ic:SI.box,t:"Inventaire",n:invOpen()}]}];
  return G;
}
const ME_SCREENS=["settings","help","templates"];
function staffNavHTML(sc){
  const G=navGroups();
  const av=AV.get(S.me.id)?avatarHTML(AV.get(S.me.id),"",36):`<span class="avl">${esc((S.me.first_name||"?").slice(0,1).toUpperCase())}</span>`;
  const who=`${esc([S.me.first_name,S.me.last_name].filter(Boolean).join(" ")||"")}`;
  const item=x=>`<button class="sitem" data-cs="${x.cs}" aria-current="${sc===x.cs?"page":"false"}">${x.ic}<span>${x.t}</span>${x.hot?`<span class="sn hot" title="${x.hot} prioritaire${x.hot>1?"s":""}">🔴 ${x.n}</span>`:badge(x.n)}</button>`;
  const ddItem=x=>`<button role="menuitem" class="ddi" data-cs="${x.cs}" aria-current="${sc===x.cs?"page":"false"}">${x.ic}<span>${x.t}</span>${badge(x.n)}</button>`;
  const rosaBtn=cls=>`<button type="button" class="${cls}" data-rosa>${SI.cal}<span>Agenda Rosa</span>${SI.ext}</button>`;
  const meMenu=`<div class="dd ddme" id="dd-me" hidden role="menu" aria-label="Mon compte"><p class="ddwho"><b>${who}</b>${ROLE_LABEL[S.me.role]}${S.me.provider_id?` · ${esc(provName(S.me.provider_id))}`:""}</p>
     <button role="menuitem" class="ddi" data-cs="settings">${IC.bell}<span>Mon profil et notifications</span></button>
     <button role="menuitem" class="ddi" data-cs="templates">${SI.tpl}<span>Mes réponses types</span></button>
     <button role="menuitem" class="ddi" data-cs="help">${IC.help}<span>Aide</span></button>
     <hr><button role="menuitem" class="ddi" id="logout">${SI.out}<span>Se déconnecter</span></button></div>`;
  // « Plus » sur téléphone : tout, rangé par rubriques
  const more=`<div class="dd ddmore" id="dd-more" hidden role="menu" aria-label="Toutes les rubriques">${G.map(g=>`<p class="ddsec">${g.h}</p>${g.it.filter(x=>!["inbox","messages","compose"].includes(x.cs)).map(ddItem).join("")}`).join("")}
     <hr>${rosaBtn("ddi ddrosa")}</div>`;
  const inMore=G.some(g=>g.it.some(x=>x.cs===sc&&!["inbox","messages","compose","tasks"].includes(x.cs)));
  const nMore=G.reduce((t,g)=>t+g.it.filter(x=>!["inbox","messages","compose","tasks"].includes(x.cs)).reduce((u,x)=>u+(x.n||0),0),0);
  return `<aside class="sside" aria-label="Navigation de l'équipe">
    <div class="sshead">${BRAND}</div>
    <button type="button" class="ssearch" data-search>${SI.search}<span>Rechercher</span><kbd>${/Mac/.test(navigator.platform)?"⌘":"Ctrl"} K</kbd></button>
    <nav class="sgroups">${G.map(g=>`<p class="sgh">${g.h}</p>${g.it.map(item).join("")}`).join("")}</nav>
    <div class="sfoot">${rosaBtn("sitem srosa2")}${availBtnHTML()}
     <button type="button" class="sme" data-dd="dd-me" aria-current="${ME_SCREENS.includes(sc)?"page":"false"}" aria-haspopup="true">${av}<span><b>${who}</b><small>${ROLE_LABEL[S.me.role]}</small></span></button></div>
   </aside>
   <header class="top stop">${BRAND}<div class="sact">
     <button type="button" class="iconbtn" data-search aria-label="Rechercher">${SI.search}</button>
     ${availBtnHTML()}
     <button class="savbtn" data-dd="dd-me" aria-label="Mon compte : ${who}" aria-current="${ME_SCREENS.includes(sc)?"page":"false"}">${av}</button></div>
   </header>
   ${meMenu}${more}
   <nav class="sbar" aria-label="Navigation de l'équipe">
    <button data-cs="inbox" aria-current="${sc==="inbox"?"page":"false"}">${SI.inbox}<span>Demandes</span>${myUrgent().length?`<span class="sn hot">${S.reqs.filter(awaitingStaff).length}</span>`:badge(S.reqs.filter(awaitingStaff).length)}</button>
    <button data-cs="messages" aria-current="${sc==="messages"?"page":"false"}">${SI.chat}<span>Messages</span>${badge(teamUnread())}</button>
    <button class="sfab" data-cs="compose" aria-current="${sc==="compose"?"page":"false"}"><i>${SI.pen}</i><span>Écrire</span></button>
    <button data-cs="tasks" aria-current="${sc==="tasks"?"page":"false"}">${SI.tasks}<span>Tâches</span>${badge(myTasks().length)}</button>
    <button data-dd="dd-more" aria-current="${inMore?"page":"false"}">${SI.more}<span>Plus</span>${badge(nMore)}</button>
   </nav><div class="ddback" hidden></div>`;
}

/* ---------- Agenda Rosa : dans l'app (fenêtre intégrée) ou à côté (ordinateur) ---------- */
let rosaWin=null;
async function openRosa(){
  closeDD();
  if(IS_NATIVE){
    const br=capPlugin("Browser",["open"]);
    if(br){ try{ await Promise.race([br.open({url:ROSA_PRO_URL,presentationStyle:"popover"}),new Promise((_,ko)=>setTimeout(()=>ko(new Error("délai")),2500))]); return; }
      catch(e){ console.warn("Rosa dans l'app indisponible :",e&&e.message); } }
    // ancienne version de l'app (sans le module) : l'app ouvre le site externe dans Safari
    location.href=ROSA_PRO_URL; return;
  }
  if(!ON_PHONE&&!IS_NATIVE){
    // une fenêtre posée à droite de l'écran, réutilisée à chaque clic (pas un nouvel onglet)
    const w=Math.min(1100,Math.round(screen.availWidth*0.55)), h=screen.availHeight-40, l=screen.availWidth-w;
    if(rosaWin&&!rosaWin.closed){ rosaWin.focus(); return; }
    rosaWin=window.open(ROSA_PRO_URL,"cmpl-rosa",`popup=yes,width=${w},height=${h},left=${l},top=0`);
    if(rosaWin) return;
  }
  window.open(ROSA_PRO_URL,"cmpl-rosa","noopener");
}

/* ---------- recherche ---------- */
const SRCH={q:"",n:0};
function snip(text,q){ const t=String(text||"").replace(/\s+/g," "), n=norm(t), i=n.indexOf(norm(q));
  if(i<0) return esc(t.slice(0,90)); const a=Math.max(0,i-35), part=(a?"…":"")+t.slice(a,a+110)+(a+110<t.length?"…":""); return hlite(part,q); }
function matchAll(text,words){ const n=norm(String(text||"")); return words.every(w=>n.includes(w)); }
function staffSearch(q){
  const words=norm(q).split(/\s+/).filter(Boolean), out=[]; if(!words.length) return out;
  const add=(g,ic,title,sub,go)=>out.push({g,ic,title,sub,go});
  for(const r of S.reqs){ const ms=msgsOf(r), base=`${reqName(r)} ${TYPES[r.type]?.label||""} ${Object.values(r.answers||{}).filter(v=>typeof v==="string").join(" ")}`;
    const hit=matchAll(base,words)?null:ms.find(m=>matchAll(m.body,words)); if(!matchAll(base,words)&&!hit) continue;
    add("Demandes",IEMO[r.type]||"📋",`${reqName(r)} · ${TYPES[r.type]?.label||""}`,hit?snip(hit.body,words[0]):esc(summaryLine(r.answers||{})).slice(0,120)+` · ${fmt(r.created_at)}`,
      ()=>{ S.sel=r.id; S.scope="all"; S.iq=""; S.itype="all"; S.archive=r.status==="traite"; S.cscreen="inbox"; }); }
  for(const t of S.team2.threads||[]){ const title=tTitle(t);
    if(matchAll(title,words)) add("Messages de l'équipe","💬",title,"Conversation",()=>{ S.cscreen="messages"; S.tthread=t.id; });
    for(const m of tMsgs(t.id)) if(matchAll(m.body,words)) add("Messages de l'équipe","💬",title,`${esc(staffName(m.author_id))} : ${snip(m.body,words[0])} · ${fmt(m.created_at)}`,()=>{ S.cscreen="messages"; S.tthread=t.id; }); }
  for(const t of S.tasks||[]) if(matchAll(`${t.title} ${t.notes||""} ${taskForLabel?taskForLabel(t):""}`,words))
    add("Tâches",t.done_at?"✅":"☑️",esc(t.title),t.notes?snip(t.notes,words[0]):(t.done_at?"Terminée":"À faire"),()=>{ S.cscreen="tasks"; S.tview=t.done_at?"done":"todo"; S.tkind="all"; });
  for(const r of S.records||[]) if(matchAll(`${r.first_name} ${r.last_name} ${r.phone||""} ${r.email||""}`,words))
    add("Fiches patients","👤",esc(`${r.first_name} ${r.last_name}`),`Né(e) le ${fmtDate(r.birth_date)} · Tél. ${esc(r.phone||"—")}`,()=>{ S.cscreen="patients"; S.recQ=q; });
  for(const w of S.waitlist||[]) if(matchAll(`${wlWho(w)} ${w.reason||""} ${w.phone||""} ${provName(w.provider_id)}`,words))
    add("Listes d'attente","⏳",esc(wlWho(w)),`${esc(provName(w.provider_id))}${w.reason?" · "+esc(w.reason):""}`,()=>{ S.cscreen="waitlist"; });
  for(const i of S.inventory||[]) if(matchAll(`${i.title} ${i.quantity||""} ${i.notes||""}`,words))
    add("Inventaire","📦",esc(i.title),`${INV_ST[i.status]} · ${fmt(i.created_at)}`,()=>{ S.cscreen="inventory"; (S.inv||(S.inv=newInv())).tab=i.status; });
  for(const b of S.binder||[]) if(matchAll(`${b.title} ${b.body||""} ${b.phone||""} ${b.url||""}`,words))
    add("Classeur",(BCAT[b.category]||["","📄"])[1],esc(b.title),b.phone?esc(b.phone):snip(b.body||"",words[0]),()=>{ S.cscreen="binder"; S.bq=q; S.bfilter="tout"; });
  for(const n of S.allNews||[]) if(matchAll(`${n.title} ${n.body||""} ${n.category||""}`,words))
    add("Actualités","📰",esc(n.title),`${esc(n.category||"")} · ${fmt(n.published_at)}`,()=>{ S.cscreen="news"; });
  for(const t of S.tpls||[]) if(matchAll(`${t.title} ${t.body}`,words))
    add("Réponses types","✍️",esc(t.title),snip(t.body,words[0]),()=>{ S.cscreen="templates"; });
  for(const t of S.team||[]) if(t.status==="active"&&matchAll(staffName(t.id)+" "+(t.first_name||"")+" "+(t.last_name||""),words))
    add("Équipe","🧑‍⚕️",esc(staffName(t.id)),ROLE_LABEL[t.role],()=>{ S.cscreen="messages"; S.tthread=null; });
  for(const c of S.cash||[]) if(matchAll(`${eur(c.amount)} ${cashKind(c.kind)} ${c.note||""} ${provName(c.provider_id)}`,words))
    add("Caisse","💶",`${eur(c.amount)} · ${cashKind(c.kind)}`,`${fmtDate(c.paid_on+"T12:00")}${c.note?" · "+esc(c.note):""}`,()=>{ S.cscreen="cash"; S.cashMonth=c.paid_on.slice(0,7); });
  return out;
}
function patientSearch(q){
  const words=norm(q).split(/\s+/).filter(Boolean), out=[]; if(!words.length) return out;
  const add=(g,ic,title,sub,go)=>out.push({g,ic,title,sub,go});
  for(const r of S.reqs){ if(r.purged_at) continue; const ms=msgsOf(r), base=`${reqWho(r)} ${TYPES[r.type]?.label||""} ${Object.values(r.answers||{}).filter(v=>typeof v==="string").join(" ")}`;
    const hit=matchAll(base,words)?null:ms.find(m=>matchAll(m.body,words)); if(!matchAll(base,words)&&!hit) continue;
    add("Mes demandes",IEMO[r.type]||"📋",`${esc(reqWho(r))} · ${TYPES[r.type]?.label||""}`,hit?snip(hit.body,words[0]):`${esc(summaryLine(r.answers||{}))} · ${fmt(r.created_at)}`,()=>{ openRequest(r.id); return true; }); }
  for(const n of S.news||[]) if(matchAll(`${n.title} ${n.body||""} ${n.category||""}`,words))
    add("Actualités","📰",esc(n.title),esc(n.category||""),()=>{ S.screen="news"; S.openNews=n.id; });
  for(const [qq,a] of FAQ) if(matchAll(`${qq} ${a}`,words)) add("Aide","❓",esc(qq),snip(a,words[0]),()=>{ S.screen="help"; });
  for(const p of S.providers||[]) if(matchAll(`${p.display_name} ${p.specialty} ${p.job||""}`,words))
    add("Prestataires du centre","🩺",esc(p.display_name),esc(p.job||p.specialty),()=>{ S.screen="absences"; });
  return out;
}
function openSearch(){
  closeDD(); if($(".srch")) return;
  const staff=S.me&&S.me.role!=="patient";
  const v=document.createElement("div"); v.className="modal srch"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true"); v.setAttribute("aria-label","Rechercher");
  v.innerHTML=`<div class="mbox srchbox"><div class="srchin">${SI.search}<input id="sr-q" type="search" autocomplete="off" enterkeyhint="search" placeholder="${staff?"Patient, demande, message, tâche, inventaire…":"Rechercher dans mes demandes, les actualités, l'aide…"}" value="${esc(SRCH.q)}"><button type="button" class="cbtn" id="sr-x" aria-label="Fermer">✕</button></div>
    <div id="sr-res" class="srchres" aria-live="polite"></div></div>`;
  document.body.appendChild(v);
  const inp=v.querySelector("#sr-q"), res=v.querySelector("#sr-res");
  const close=()=>{ v.remove(); removeEventListener("keydown",key); };
  const key=e=>{ if(e.key==="Escape") close(); }; addEventListener("keydown",key);
  v.querySelector("#sr-x").onclick=close; v.onclick=e=>{ if(e.target===v) close(); };
  let items=[], remoteT=null;
  const draw_=()=>{ const q=inp.value.trim(); SRCH.q=q;
    if(q.length<2){ res.innerHTML=`<p class="hint center">${staff?"Tapez au moins 2 lettres : nom d'un patient, mot d'un message, matériel, numéro…":"Tapez au moins 2 lettres."}</p>`; return; }
    items=staff?staffSearch(q):patientSearch(q);
    const groups=[...new Set(items.map(x=>x.g))];
    res.innerHTML=items.length?groups.map(g=>{ const its=items.map((x,i)=>[x,i]).filter(([x])=>x.g===g); return `<p class="srg">${esc(g)} <span>${its.length}</span></p>${its.slice(0,8).map(([x,i])=>`<button type="button" class="srow" data-sr="${i}"><span class="sric" aria-hidden="true">${x.ic}</span><span><b>${x.title}</b><small>${x.sub||""}</small></span></button>`).join("")}${its.length>8?`<p class="hint small">… et ${its.length-8} autre${its.length-8>1?"s":""} : précisez la recherche.</p>`:""}`; }).join("")
      :`<p class="hint center">Rien trouvé pour « ${esc(q)} ».</p>`;
    if(staff) res.insertAdjacentHTML("beforeend",`<div id="sr-pat"></div>`);
    res.querySelectorAll("[data-sr]").forEach(b=>b.onclick=()=>{ const it=items[+b.dataset.sr]; close(); const done=it.go(); if(done!==true){ render(); scrollTo(0,0); } });
    if(staff){ clearTimeout(remoteT); remoteT=setTimeout(async()=>{ const words=norm(q).split(/\s+/).filter(Boolean); const ps=await searchPatients(words); const box=v.querySelector("#sr-pat"); if(!box||!ps||!ps.length||inp.value.trim()!==q) return;
      box.innerHTML=`<p class="srg">Patients inscrits dans l'app <span>${ps.length}</span></p>`+ps.map((p,i)=>`<button type="button" class="srow" data-srp="${i}"><span class="sric" aria-hidden="true">${p.child?"🧒":"👤"}</span><span><b>${esc(`${p.first_name||""} ${p.last_name||""}`)}</b><small>Né(e) le ${fmtDate(p.birth_date)} · ${p.child?"enfant":"Tél. "+esc(p.phone||"—")} · lui écrire</small></span></button>`).join("");
      box.querySelectorAll("[data-srp]").forEach(b=>b.onclick=()=>{ const p=ps[+b.dataset.srp]; close(); S.cscreen="compose"; S.compose=S.compose||{patient:null,subject:SUBJECTS[0],body:"",files:[],reply:true,q:""}; S.compose.patient=p; render(); scrollTo(0,0); }); },300); }
  };
  let t=null; inp.oninput=()=>{ clearTimeout(t); t=setTimeout(draw_,120); };
  inp.onkeydown=e=>{ if(e.key==="Enter"){ const f=res.querySelector("[data-sr],[data-srp]"); if(f) f.click(); } };
  draw_(); inp.focus(); inp.select();
}
document.addEventListener("keydown",e=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"&&S.me&&S.me.status==="active"){ e.preventDefault(); openSearch(); } });
document.addEventListener("click",e=>{ if(e.target.closest("[data-cs-help]")){ S.screen="help"; render(); scrollTo(0,0); return; } const b=e.target.closest("[data-search]"); if(b){ e.preventDefault(); openSearch(); return; }
  const r=e.target.closest("[data-rosa]"); if(r){ e.preventDefault(); openRosa(); } });

/* ---------- dessins de profil ---------- */
const AVD_TONES={clair:["#f3d5c0","#e5bba0"],mat:["#d9a67e","#c38d65"],fonce:["#8e5b3e","#774a31"]};
const AVD_KINDS=[
 ["femme","Femme","#efe2d6"],["homme","Homme","#dde5ec"],["voilee","Femme voilée","#e9dfe6"],["barbe","Homme barbu","#e3e6dc"],
 ["dame","Dame","#efe6d4"],["monsieur","Monsieur","#e2e2e8"],["fille","Fille","#f3dfdd"],["garcon","Garçon","#dbe7e6"],
 ["bebe","Bébé","#f2ead9"],["medf","Médecin (femme)","#dbe4ee"],["medh","Médecin (homme)","#dfe8e1"],["accueil","Accueil","#efe0e1"]];
function avdSVG(kind,tone){
  const [sk,sk2]=AVD_TONES[tone]||AVD_TONES.clair, bg=(AVD_KINDS.find(k=>k[0]===kind)||AVD_KINDS[0])[2];
  const hair=tone==="clair"?"#4a3226":"#241a17", grey="#cfc9c3", ink="#3a2622";
  const kid=["fille","garcon","bebe"].includes(kind), baby=kind==="bebe";
  // proportions : les enfants ont une tête plus grande et des épaules plus étroites
  const hy=baby?56:kid?52:49, hrx=baby?23:kid?21:19, hry=baby?23:kid?22.5:22.5;
  const cloth={femme:"#702629",homme:"#2f3e52",voilee:"#5b4a63",barbe:"#4d5b45",dame:"#8a6d33",monsieur:"#4b4f5c",fille:"#c8706d",garcon:"#3f7a78",bebe:"#e9c98f",medf:"#ffffff",medh:"#ffffff",accueil:"#702629"}[kind];
  let back="", front="", body="", extra="";
  const shoulders=(c,w=46,top=84)=>`<path d="M${60-w} 122 C${60-w} ${top+10} ${60-w*0.55} ${top} 60 ${top} C${60+w*0.55} ${top} ${60+w} ${top+10} ${60+w} 122 Z" fill="${c}"/>`;
  const neck=`<path d="M52 ${hy+14} h16 v${baby?10:16} a8 6 0 0 1 -16 0 Z" fill="${sk2}"/>`;
  const ears=baby?"":`<ellipse cx="${60-hrx}" cy="${hy+2}" rx="3.2" ry="4.6" fill="${sk2}"/><ellipse cx="${60+hrx}" cy="${hy+2}" rx="3.2" ry="4.6" fill="${sk2}"/>`;
  const head=`<ellipse cx="60" cy="${hy}" rx="${hrx}" ry="${hry}" fill="${sk}"/>`;
  const ey=hy+3, face=`<g fill="${ink}"><ellipse cx="${60-7.5}" cy="${ey}" rx="1.7" ry="2.1"/><ellipse cx="${60+7.5}" cy="${ey}" rx="1.7" ry="2.1"/></g>
    <path d="M55.5 ${ey+9} q4.5 3.4 9 0" stroke="${ink}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <g fill="#e48f84" opacity=".28"><ellipse cx="${60-12}" cy="${ey+6}" rx="3.6" ry="2.4"/><ellipse cx="${60+12}" cy="${ey+6}" rx="3.6" ry="2.4"/></g>`;
  const glasses=`<g stroke="${ink}" stroke-width="1.5" fill="none"><circle cx="52.5" cy="${ey}" r="5.2"/><circle cx="67.5" cy="${ey}" r="5.2"/><path d="M57.7 ${ey} h4.6"/></g>`;
  const coat=`${shoulders("#ffffff")}<path d="M60 84 L49 122 H44 C44 104 48 92 60 84 Z M60 84 L71 122 H76 C76 104 72 92 60 84 Z" fill="#e8ecef"/>
    <path d="M52 86 L60 100 L68 86" fill="#9fb7c9"/><path d="M47 90 c-3 9 2 14 8 14 M73 90 c3 9 -2 14 -8 14" stroke="#3b4b5a" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="55" cy="105" r="3.2" fill="#3b4b5a"/><circle cx="65" cy="105" r="3" fill="#ffffff" stroke="#3b4b5a" stroke-width="2"/>`;
  switch(kind){
    case "femme":
      back=`<path d="M38 ${hy-2} C36 ${hy-30} 84 ${hy-30} 82 ${hy-2} C84 ${hy+22} 86 ${hy+40} 80 ${hy+46} H40 C34 ${hy+40} 36 ${hy+22} 38 ${hy-2} Z" fill="${hair}"/>`;
      front=`<path d="M40 ${hy-4} C42 ${hy-26} 78 ${hy-28} 80 ${hy-6} C72 ${hy-14} 58 ${hy-16} 48 ${hy-8} C45 ${hy-6} 42 ${hy-4} 40 ${hy+4} Z" fill="${hair}"/>`;
      body=shoulders(cloth); extra=`<path d="M50 85 Q60 96 70 85" fill="none" stroke="#f3e2c8" stroke-width="2"/>`; break;
    case "homme":
      front=`<path d="M40 ${hy-2} C38 ${hy-26} 82 ${hy-30} 80 ${hy-4} C80 ${hy-8} 76 ${hy-13} 70 ${hy-14} C62 ${hy-11} 52 ${hy-13} 44 ${hy-10} C42 ${hy-8} 41 ${hy-5} 40 ${hy-2} Z" fill="${hair}"/>`;
      body=shoulders(cloth)+`<path d="M53 84 L60 94 L67 84 Z" fill="#f4f1ec"/>`; break;
    case "barbe":
      front=`<path d="M40 ${hy-2} C38 ${hy-27} 82 ${hy-30} 80 ${hy-4} C79 ${hy-10} 74 ${hy-14} 66 ${hy-13} C58 ${hy-15} 48 ${hy-12} 42 ${hy-6} Z" fill="${hair}"/>
        <path d="M41 ${hy+2} C41 ${hy+22} 50 ${hy+26} 60 ${hy+26} C70 ${hy+26} 79 ${hy+22} 79 ${hy+2} C76 ${hy+12} 70 ${hy+14} 60 ${hy+11} C50 ${hy+14} 44 ${hy+12} 41 ${hy+2} Z" fill="${hair}"/>
        <path d="M54 ${ey+9} q6 3 12 0" stroke="${sk}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      body=shoulders(cloth); break;
    case "voilee":
      back=`<path d="M34 ${hy+2} C32 ${hy-34} 88 ${hy-34} 86 ${hy+2} C88 ${hy+22} 92 ${hy+30} 98 ${hy+40} C84 ${hy+36} 36 ${hy+36} 22 ${hy+40} C28 ${hy+30} 32 ${hy+22} 34 ${hy+2} Z" fill="${cloth}"/>`;
      front=`<path d="M38 ${hy+4} C36 ${hy-28} 84 ${hy-28} 82 ${hy+4} C82 ${hy+20} 74 ${hy+30} 60 ${hy+30} C46 ${hy+30} 38 ${hy+20} 38 ${hy+4} Z M60 ${hy-20} C48 ${hy-20} 42 ${hy-10} 42 ${hy+2} C42 ${hy+16} 50 ${hy+24} 60 ${hy+24} C70 ${hy+24} 78 ${hy+16} 78 ${hy+2} C78 ${hy-10} 72 ${hy-20} 60 ${hy-20} Z" fill="${cloth}" fill-rule="evenodd"/>
        <path d="M42 ${hy-2} C46 ${hy-16} 74 ${hy-16} 78 ${hy-2}" stroke="#ffffff" stroke-opacity=".18" stroke-width="2" fill="none"/>`;
      body=shoulders(cloth,48,80); break;
    case "dame":
      back=`<circle cx="60" cy="${hy-24}" r="9" fill="${grey}"/>`;
      front=`<path d="M40 ${hy+2} C37 ${hy-28} 83 ${hy-28} 80 ${hy+2} C78 ${hy-8} 72 ${hy-14} 60 ${hy-13} C48 ${hy-14} 42 ${hy-8} 40 ${hy+2} Z" fill="${grey}"/>`+glasses;
      body=shoulders(cloth)+`<g fill="#f6efe2"><circle cx="52" cy="88" r="1.8"/><circle cx="56" cy="90.5" r="1.8"/><circle cx="60" cy="91.3" r="1.8"/><circle cx="64" cy="90.5" r="1.8"/><circle cx="68" cy="88" r="1.8"/></g>`; break;
    case "monsieur":
      front=`<path d="M40 ${hy+4} C38 ${hy-6} 40 ${hy-12} 44 ${hy-14} C44 ${hy-6} 43 ${hy} 43 ${hy+6} Z M80 ${hy+4} C82 ${hy-6} 80 ${hy-12} 76 ${hy-14} C76 ${hy-6} 77 ${hy} 77 ${hy+6} Z" fill="${grey}"/>
        <path d="M51 ${ey+8} q9 -3 18 0 q-9 4 -18 0 Z" fill="${grey}"/>`+glasses;
      body=shoulders(cloth)+`<path d="M53 84 L60 96 L67 84 Z" fill="#f4f1ec"/><path d="M58.5 88 h3 l1.5 12 -3 4 -3 -4 Z" fill="#702629"/>`; break;
    case "fille":
      back=`<circle cx="${60-hrx-6}" cy="${hy-6}" r="8" fill="${hair}"/><circle cx="${60+hrx+6}" cy="${hy-6}" r="8" fill="${hair}"/><circle cx="${60-hrx-1}" cy="${hy-11}" r="2.6" fill="#f2b8b2"/><circle cx="${60+hrx+1}" cy="${hy-11}" r="2.6" fill="#f2b8b2"/>`;
      front=`<path d="M39 ${hy+2} C37 ${hy-30} 83 ${hy-30} 81 ${hy+2} C76 ${hy-10} 66 ${hy-12} 60 ${hy-18} C54 ${hy-12} 44 ${hy-10} 39 ${hy+2} Z" fill="${hair}"/>`;
      body=shoulders(cloth,36,86)+`<path d="M52 86 Q60 92 68 86" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="2"/>`; break;
    case "garcon":
      front=`<path d="M39 ${hy} C36 ${hy-26} 84 ${hy-32} 81 ${hy-2} C80 ${hy-10} 76 ${hy-12} 72 ${hy-12} L70 ${hy-16} L66 ${hy-11} L60 ${hy-17} L56 ${hy-11} L50 ${hy-15} L48 ${hy-9} C44 ${hy-8} 41 ${hy-5} 39 ${hy} Z" fill="${hair}"/>`;
      body=shoulders(cloth,36,86)+`<path d="M24 112 h72" stroke="#ffffff" stroke-opacity=".35" stroke-width="4"/>`; break;
    case "bebe":
      front=`<path d="M60 ${hy-23} c-6 -6 2 -12 6 -7 c2 3 -2 6 -4 3" stroke="${hair}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      body=shoulders(cloth,32,90)+`<path d="M48 92 Q60 102 72 92" fill="#ffffff" fill-opacity=".7"/>`; break;
    case "medf":
      back=`<circle cx="60" cy="${hy-24}" r="8.5" fill="${hair}"/>`;
      front=`<path d="M40 ${hy+2} C37 ${hy-28} 83 ${hy-28} 80 ${hy+2} C76 ${hy-10} 68 ${hy-14} 58 ${hy-12} C50 ${hy-11} 43 ${hy-6} 40 ${hy+2} Z" fill="${hair}"/>`;
      body=coat; break;
    case "medh":
      front=`<path d="M40 ${hy-2} C38 ${hy-26} 82 ${hy-30} 80 ${hy-4} C80 ${hy-8} 76 ${hy-13} 70 ${hy-14} C62 ${hy-11} 52 ${hy-13} 44 ${hy-10} C42 ${hy-8} 41 ${hy-5} 40 ${hy-2} Z" fill="${hair}"/>`+glasses;
      body=coat; break;
    case "accueil":
      back=`<path d="M38 ${hy-2} C36 ${hy-30} 84 ${hy-30} 82 ${hy-2} C83 ${hy+12} 84 ${hy+22} 80 ${hy+26} H40 C36 ${hy+22} 37 ${hy+12} 38 ${hy-2} Z" fill="${hair}"/>`;
      front=`<path d="M40 ${hy-2} C42 ${hy-26} 78 ${hy-28} 80 ${hy-4} C70 ${hy-12} 54 ${hy-16} 46 ${hy-6} C44 ${hy-4} 42 ${hy-3} 40 ${hy+2} Z" fill="${hair}"/>
        <path d="M37 ${hy+2} C35 ${hy-30} 85 ${hy-30} 83 ${hy+2}" stroke="${ink}" stroke-width="2.6" fill="none"/><rect x="33" y="${hy-4}" width="7" height="12" rx="3" fill="${ink}"/><rect x="80" y="${hy-4}" width="7" height="12" rx="3" fill="${ink}"/>
        <path d="M37 ${hy+8} C38 ${hy+20} 46 ${hy+22} 52 ${hy+20}" stroke="${ink}" stroke-width="1.8" fill="none"/><circle cx="53" cy="${hy+20}" r="2.2" fill="${ink}"/>`;
      body=shoulders(cloth)+`<path d="M50 85 Q60 96 70 85" fill="none" stroke="#d8bb80" stroke-width="2"/>`; break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><defs><clipPath id="avc"><circle cx="60" cy="60" r="60"/></clipPath></defs>
   <g clip-path="url(#avc)"><rect width="120" height="120" fill="${bg}"/><g transform="translate(60 66) scale(1.1) translate(-60 -62)">${back}${neck}${body}${extra}${ears}${head}${face}${front}</g></g></svg>`;
}
// dessin → image PNG 256 px (envoyée comme une photo de profil)
async function avdPng(kind,tone){
  const url="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(avdSVG(kind,tone));
  const img=await new Promise((ok,ko)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=ko; i.src=url; });
  const c=document.createElement("canvas"); c.width=c.height=256; c.getContext("2d").drawImage(img,0,0,256,256);
  return await new Promise(ok=>c.toBlob(ok,"image/png"));
}
function openAvatarPicker(){
  const kids=S.me.role==="patient";
  let tone=(()=>{ try{ return localStorage.getItem("cmpl_avtone")||"clair"; }catch(e){ return "clair"; } })(), pick=null;
  const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true"); v.setAttribute("aria-labelledby","avp-t");
  const kinds=AVD_KINDS.filter(k=>kids?!["medf","medh","accueil"].includes(k[0]):true);
  const drawGrid=()=>v.querySelector(".avgrid").innerHTML=kinds.map(([k,l])=>`<button type="button" class="avopt" data-avk="${k}" aria-pressed="${pick===k}" aria-label="${esc(l)}"><span>${avdSVG(k,tone).replace(/avc/g,"avc-"+k)}</span><small>${esc(l)}</small></button>`).join("");
  v.innerHTML=`<div class="mbox avbox"><h2 id="avp-t">Choisir un dessin</h2><p class="hint">Si vous préférez ne pas mettre de photo. Vous pourrez le changer quand vous voulez.</p>
    <div class="seg avtones" role="group" aria-label="Teinte de peau">${[["clair","Clair"],["mat","Mat"],["fonce","Foncé"]].map(([k,l])=>`<button type="button" data-tone="${k}" aria-pressed="${tone===k}"><i style="background:${AVD_TONES[k][0]}"></i>${l}</button>`).join("")}</div>
    <div class="avgrid"></div>
    <div class="btnrow"><button class="btn" id="avp-ok" disabled>Utiliser ce dessin</button><button class="btn ghost" id="avp-x">Annuler</button></div></div>`;
  document.body.appendChild(v); drawGrid();
  const close=()=>v.remove(); v.querySelector("#avp-x").onclick=close; v.onclick=e=>{ if(e.target===v) close(); };
  v.querySelectorAll("[data-tone]").forEach(b=>b.onclick=()=>{ tone=b.dataset.tone; try{ localStorage.setItem("cmpl_avtone",tone); }catch(e){} v.querySelectorAll("[data-tone]").forEach(x=>x.setAttribute("aria-pressed",x===b)); drawGrid(); });
  v.querySelector(".avgrid").onclick=e=>{ const b=e.target.closest("[data-avk]"); if(!b) return; pick=b.dataset.avk; v.querySelectorAll("[data-avk]").forEach(x=>x.setAttribute("aria-pressed",x===b)); v.querySelector("#avp-ok").disabled=false; };
  v.querySelector("#avp-ok").onclick=async()=>{ if(!pick) return; const ok=v.querySelector("#avp-ok"); ok.disabled=true;
    try{ const blob=await avdPng(pick,tone), data=await blobToB64(blob);
      if(await run(()=>sb.rpc("set_my_avatar",{p_data:data}),"Dessin enregistré")){ const old=AV.get(S.me.id); if(old) URL.revokeObjectURL(old); AV.set(S.me.id,URL.createObjectURL(blob)); close(); render(); } else ok.disabled=false; }
    catch(e){ ok.disabled=false; toast("Le dessin n'a pas pu être préparé. Réessayez."); } };
}

/* ---------- messagerie : épingles, classement, « concerne des patients » ---------- */
const tPinned = t => !!tMembers(t.id).find(m=>m.user_id===S.me.id)?.pinned_at;
const TFILTERS=[["all","Toutes"],["unread","Non lues"],["group","Groupes"],["direct","À deux"],["pat","Patients"]];
function tFilterOk(t,f){ return f==="all"||(f==="unread"&&tUnread(t)>0)||(f==="group"&&t.kind!=="direct")||(f==="direct"&&t.kind==="direct")||(f==="pat"&&t.patient_related); }
async function loadOlder(t){
  const first=tMsgs(t.id)[0], before=first?first.created_at:new Date().toISOString();
  const {data,error}=await sb.from("team_messages").select("id,thread_id,author_id,body,request_id,file_mime,file_name,file_size,created_at").eq("thread_id",t.id).lt("created_at",before).order("created_at",{ascending:false}).limit(100);
  if(error){ toast(frError(error)); return; }
  const have=new Set(S.team2.msgs.map(m=>m.id)), add=(data||[]).filter(m=>!have.has(m.id));
  S.team2.msgs=[...add,...S.team2.msgs].sort((a,b)=>a.created_at.localeCompare(b.created_at));
  (S.team2.older||(S.team2.older={}))[t.id]=(data||[]).length<100?"fin":"plus";
  render();
}

/* ---------- horaires des accueillantes ---------- */
const HK={travail:["Travail",""],conge:["Congé","CO"],maladie:["Maladie","MA"],ferie:["Férié","FE"],formation:["Formation","FO"],recup:["Récupération","RE"],autre:["Autre","AU"]};
const DOWS=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
const isoD = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function mondayOf(iso){ const d=new Date(iso+"T12:00"); d.setDate(d.getDate()-((d.getDay()+6)%7)); return isoD(d); }
const hm2min = t => { if(!t) return 0; const [h,m]=t.split(":").map(Number); return h*60+m; };
const minTxt = m => { const s=m<0?"-":""; m=Math.abs(Math.round(m)); return `${s}${Math.floor(m/60)} h ${String(m%60).padStart(2,"0")}`; };
const hoursOf = r => r&&r.kind==="travail" ? Math.max(0,hm2min(r.end_t)-hm2min(r.start_t)-(r.break_min||0)) : 0;
const t5 = t => (t||"").slice(0,5);
function officePeople(from,to){
  const ids=new Set((S.team||[]).filter(t=>t.status==="active"&&t.role==="secretariat").map(t=>t.id));
  (S.hours2||[]).filter(h=>h.day>=from&&h.day<=to).forEach(h=>ids.add(h.user_id));
  (S.hoursExtra||[]).forEach(id=>ids.add(id));
  if(S.me.role==="secretariat") ids.add(S.me.id);
  return [...ids].sort((a,b)=>(a===S.me.id?-1:b===S.me.id?1:staffName(a).localeCompare(staffName(b))));
}
async function loadHours(fromISO,toISO){
  const [h,w]=await Promise.all([sb.from("staff_hours").select("*").gte("day",fromISO).lte("day",toISO).order("day"),
    sb.from("staff_hours_weeks").select("*").gte("week_start",addDays(fromISO,-6)).lte("week_start",toISO)]);
  if(h.error){ S.hours2=[]; S.hoursErr=frError(h.error); return; }
  S.hoursErr=null;
  if(S.hcolorsOk!==false){ const hc=await sb.from("staff_hours_colors").select("user_id,color"); if(hc.error) S.hcolorsOk=false; else { S.hcolorsOk=true; S.hcolors=hc.data||[]; } }
  const keep=(S.hours2||[]).filter(x=>x.day<fromISO||x.day>toISO); S.hours2=[...keep,...(h.data||[])];
  if(S.hnotesOk!==false){ const nt=await sb.from("staff_hours_notes").select("*").gte("week_start",addDays(fromISO,-6)).lte("week_start",toISO);
    if(nt.error) S.hnotesOk=false; else { S.hnotesOk=true; const ks=new Set((nt.data||[]).map(x=>x.week_start)); S.hnotes=[...(S.hnotes||[]).filter(x=>!ks.has(x.week_start)),...(nt.data||[])]; } }
  const keepW=(S.hweeks||[]).filter(x=>!(w.data||[]).some(y=>y.user_id===x.user_id&&y.week_start===x.week_start)); S.hweeks=[...keepW,...(w.data||[])];
}
const hourRow = (uid,day) => (S.hours2||[]).find(h=>h.user_id===uid&&h.day===day);
const weekOk = (uid,wk) => !!(S.hweeks||[]).find(w=>w.user_id===uid&&w.week_start===wk&&w.validated_at);
function hoursHTML(){
  const H=S.hv||(S.hv={week:mondayOf(todayISO()),mode:"week",month:todayISO().slice(0,7)});
  const tabs=`<div class="seg" role="group" aria-label="Affichage"><button data-hmode="week" aria-pressed="${H.mode==="week"}">Semaine</button><button data-hmode="month" aria-pressed="${H.mode==="month"}">Mois (secrétariat social)</button></div>`;
  const head=`<div class="chead"><div><h1>Horaires de l'accueil</h1><p>Les accueillantes encodent et corrigent les heures de toute l'équipe de l'accueil ; l'administration vérifie et valide chaque semaine. Les totaux se calculent tout seuls.</p></div>${tabs}</div>`;
  if(S.hoursLoaded!==`${H.mode}:${H.mode==="week"?H.week:H.month}`) return head+`<div class="empty">Chargement…</div>`;
  if(S.hoursErr) return head+`<div class="empty">Les horaires ne sont pas encore disponibles (${esc(S.hoursErr)}). La mise à jour du serveur (migration 049) est-elle faite ?</div>`;
  return head+(H.mode==="week"?hoursWeekHTML(H):hoursMonthHTML(H));
}
// accueillantes : elles encodent pour toute l'équipe de l'accueil ; l'administration pour tout le monde
const canEditHours = uid => canManageOffice() || uid===S.me.id || (S.team||[]).some(t=>t.id===uid&&t.role==="secretariat");
function hoursNoteHTML(wk){
  if(S.hnotesOk===false) return "";
  const n=(S.hnotes||[]).find(x=>x.week_start===wk), d=S.hnoteDraft&&S.hnoteDraft.wk===wk?S.hnoteDraft.body:(n?.body||"");
  return `<section class="card hnote"><label class="fld" for="hn-body"><b>Désidératas et indisponibilités de la semaine</b>
    <textarea id="hn-body" rows="4" maxlength="4000" placeholder="Ex. Leïla : pas disponible jeudi après-midi. Fatima : souhaite finir à 17 h mercredi.">${esc(d)}</textarea></label>
    <div class="btnrow"><button type="button" class="btn" id="hn-save" ${S.hnoteDraft&&S.hnoteDraft.wk===wk?"":"disabled"}>Enregistrer</button><small class="hint">${n?`Modifié par ${esc(teamName(n.updated_by))} ${fmt(n.updated_at)}`:"Visible par le secrétariat et l'administration."}</small></div></section>`;
}
const hDot = uid => `<button type="button" class="hdot" data-hcolor="${uid}" style="background:${hoursColor(uid)}" title="Changer la couleur" aria-label="Couleur de ${esc(staffName(uid))}"></button>`;
function bindHoursNote(wk){
  const t=$("#hn-body"), b=$("#hn-save"); if(!t) return;
  t.oninput=()=>{ S.hnoteDraft={wk,body:t.value}; b.disabled=false; };
  b.onclick=async()=>{ b.disabled=true; const body=t.value;
    if(await run(()=>sb.rpc("set_hours_note",{p_week:wk,p_body:body}),"Enregistré")){ S.hnotes=(S.hnotes||[]).filter(x=>x.week_start!==wk); if(body.trim()) S.hnotes.push({week_start:wk,body,updated_by:S.me.id,updated_at:new Date().toISOString()}); S.hnoteDraft=null; render(); } else b.disabled=false; };
}
function hoursWeekHTML(H){
  const days=[...Array(6)].map((_,i)=>addDays(H.week,i)), wkEnd=addDays(H.week,6), people=officePeople(H.week,wkEnd), mgr=canManageOffice();
  const cell=(uid,day,tag)=>{ const r=hourRow(uid,day), can=mgr||(canEditHours(uid)&&!weekOk(uid,H.week));
    const inner=!r?`<span class="hz">—</span>`:r.kind==="travail"?`<b>${t5(r.start_t)}–${t5(r.end_t)}</b><small>${r.break_min?`pause ${r.break_min} min · `:""}${minTxt(hoursOf(r))}</small>`:`<b class="hk hk-${r.kind}">${HK[r.kind][0]}</b>${r.note?`<small>${esc(r.note)}</small>`:""}`;
    const tint=r&&r.kind==="travail"?` hasc" style="--hc:${hoursColor(uid)}`:"";
    const btn=can?`<button type="button" class="hcell${tint}" data-hc="${uid}|${day}" aria-label="${esc(staffName(uid))}, ${fmtDate(day+"T12:00")}">${inner}</button>`:`<div class="hcell ro${tint}">${inner}</div>`;
    return tag==="li"?`<li class="${day===todayISO()?"today":""}"><span class="hday">${DOWS[(new Date(day+"T12:00").getDay()+6)%7]} ${day.slice(8)}/${day.slice(5,7)}</span>${btn}</li>`:`<td class="${day===todayISO()?"today":""}">${btn}</td>`; };
  const tot=uid=>days.reduce((t,d)=>t+hoursOf(hourRow(uid,d)),0), abs=uid=>days.filter(d=>{ const r=hourRow(uid,d); return r&&r.kind!=="travail"; }).length;
  return `<div class="hweek">
   <div class="hnav"><button type="button" class="btn ghost" data-hw="-7" aria-label="Semaine précédente">‹</button><b>Semaine du ${H.week.slice(8)}/${H.week.slice(5,7)} au ${addDays(H.week,5).slice(8)}/${addDays(H.week,5).slice(5,7)}</b><button type="button" class="btn ghost" data-hw="7" aria-label="Semaine suivante">›</button>${H.week!==mondayOf(todayISO())?`<button type="button" class="linkbtn" data-hw="0">Cette semaine</button>`:""}</div>
   <div class="htable-wrap"><table class="htable"><thead><tr><th>Accueillante</th>${days.map(d=>`<th class="${d===todayISO()?"today":""}">${DOWS[new Date(d+"T12:00").getDay()===0?6:new Date(d+"T12:00").getDay()-1]} ${d.slice(8)}/${d.slice(5,7)}</th>`).join("")}<th>Total</th></tr></thead>
   <tbody>${people.length?people.map(uid=>{ const ok=weekOk(uid,H.week); return `<tr><th scope="row"><span class="hname">${hDot(uid)}${esc(staffName(uid))}${uid===S.me.id?" <small>(moi)</small>":""}</span>${ok?`<span class="pill st-traite">Validée</span>`:""}</th>${days.map(d=>cell(uid,d)).join("")}
     <td class="htot"><b>${minTxt(tot(uid))}</b>${abs(uid)?`<small>${abs(uid)} j. d'absence</small>`:""}${mgr?`<button type="button" class="mini ${ok?"ghostmini":""}" data-hval="${uid}" data-ok="${ok?0:1}">${ok?"Rouvrir":"Valider"}</button>`:""}</td></tr>`; }).join("")
     :`<tr><td colspan="8"><div class="empty">Aucune accueillante. Les comptes avec le rôle « Secrétariat » apparaissent ici.</div></td></tr>`}</tbody></table></div>
   <div class="hcards">${people.map(uid=>{ const ok=weekOk(uid,H.week); return `<section class="hcard"><header>${hDot(uid)}<b>${esc(staffName(uid))}${uid===S.me.id?" <small>(moi)</small>":""}</b>${ok?`<span class="pill st-traite">Validée</span>`:""}<span class="htot2">${minTxt(tot(uid))}</span></header><ul>${days.map(d=>cell(uid,d,"li")).join("")}</ul>${mgr?`<button type="button" class="mini ${ok?"ghostmini":""}" data-hval="${uid}" data-ok="${ok?0:1}">${ok?"Rouvrir la semaine":"Valider la semaine"}</button>`:""}</section>`; }).join("")}</div>
   <div class="btnrow">${mgr?`<button type="button" class="btn ghost" id="h-addp">+ Ajouter une personne au tableau</button>`:""}<button type="button" class="btn ghost" id="h-copy">Copier la semaine précédente (cases vides)</button><button type="button" class="btn ghost" data-hxlsx="${H.week.slice(0,7)}">Planning Excel du mois</button></div>
   <p class="hint">Touchez une case pour encoder l'heure d'arrivée, de départ et la pause. Une semaine validée ne peut plus être changée que par l'administration. Gardé 5 ans.</p>
   ${hoursNoteHTML(H.week)}</div>`;
}
function monthDays(ym){ const [y,m]=ym.split("-").map(Number), n=new Date(y,m,0).getDate(); return [...Array(n)].map((_,i)=>`${ym}-${String(i+1).padStart(2,"0")}`); }
function hoursMonthHTML(H){
  const days=monthDays(H.month), people=officePeople(days[0],days[days.length-1]);
  const label=new Date(H.month+"-15").toLocaleDateString("fr-BE",{month:"long",year:"numeric"});
  const row=uid=>{ const rs=days.map(d=>hourRow(uid,d)).filter(Boolean), work=rs.filter(r=>r.kind==="travail");
    const cnt=k=>rs.filter(r=>r.kind===k).length, weeks=[...new Set(days.map(mondayOf))], nv=weeks.filter(w=>rs.some(r=>mondayOf(r.day)===w)&&!weekOk(uid,w)).length;
    return `<tr><th scope="row">${esc(staffName(uid))}</th><td><b>${minTxt(work.reduce((t,r)=>t+hoursOf(r),0))}</b></td><td>${work.length}</td>${["conge","maladie","ferie","formation","recup","autre"].map(k=>`<td>${cnt(k)||""}</td>`).join("")}<td>${nv?`<span class="pill st-wait">${nv} à valider</span>`:rs.length?`<span class="pill st-traite">OK</span>`:""}</td></tr>`; };
  return `<div class="hweek"><div class="hnav"><button type="button" class="btn ghost" data-hm="-1" aria-label="Mois précédent">‹</button><b class="cap">${label}</b><button type="button" class="btn ghost" data-hm="1" aria-label="Mois suivant">›</button></div>
   <div class="htable-wrap hm"><table class="htable hmonth"><thead><tr><th>Accueillante</th><th>Heures prestées</th><th>Jours</th>${["conge","maladie","ferie","formation","recup","autre"].map(k=>`<th>${HK[k][0]}</th>`).join("")}<th>Semaines</th></tr></thead>
   <tbody>${people.map(row).join("")||`<tr><td colspan="10"><div class="empty">Rien d'encodé ce mois-ci.</div></td></tr>`}</tbody></table></div>
   <div class="btnrow"><button type="button" class="btn" data-hxlsx="${H.month}">Télécharger le planning Excel</button><button type="button" class="linkbtn" id="h-csv">Détail jour par jour (CSV)</button></div>
   <p class="hint">Le planning Excel reprend le tableau du secrétariat : les heures de la journée, une couleur par accueillante, les désidératas de chaque semaine et le total du mois (pour le secrétariat social). Le détail CSV donne une ligne par jour et par personne.</p></div>`;
}
function csvDownload(name,rows){
  const txt="﻿"+rows.map(r=>r.map(c=>{ const s=String(c??""); return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }).join(";")).join("\r\n");
  const blob=new Blob([txt],{type:"text/csv;charset=utf-8"});
  saveFile(blob,name).catch(()=>toast("Le fichier n'a pas pu être enregistré."));
}
async function hoursEnsure(){ const H=S.hv; const k=`${H.mode}:${H.mode==="week"?H.week:H.month}`; if(S.hoursLoaded===k) return;
  if(H.mode==="week") await loadHours(addDays(H.week,-7),addDays(H.week,6)); else { const d=monthDays(H.month); await loadHours(mondayOf(d[0]),d[d.length-1]); }
  S.hoursLoaded=k; if(S.cscreen==="hours") render(); }
function editHourCell(uid,day){
  const r=hourRow(uid,day)||{kind:"travail",start_t:null,end_t:null,break_min:0,note:""};
  const prev=(S.hours2||[]).filter(h=>h.user_id===uid&&h.kind==="travail"&&h.day<day).sort((a,b)=>b.day.localeCompare(a.day))[0];
  const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true"); v.setAttribute("aria-labelledby","hc-t");
  v.innerHTML=`<div class="mbox"><h2 id="hc-t">${esc(staffName(uid))}</h2><p class="hint capp">${new Date(day+"T12:00").toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long"})}</p>
    <label class="fld">Type<select id="hc-k">${Object.entries(HK).map(([k,[l]])=>`<option value="${k}" ${r.kind===k?"selected":""}>${l}</option>`).join("")}</select></label>
    <div id="hc-times" class="row3"><label class="fld">Arrivée<input id="hc-s" type="time" step="300" value="${t5(r.start_t)||t5(prev?.start_t)||"09:00"}"></label><label class="fld">Départ<input id="hc-e" type="time" step="300" value="${t5(r.end_t)||t5(prev?.end_t)||"17:00"}"></label><label class="fld">Pause (min)<input id="hc-b" type="number" min="0" max="600" step="5" inputmode="numeric" value="${r.kind==="travail"?(r.break_min||0):(prev?.break_min??30)}"></label></div>
    <p class="hint" id="hc-tot"></p>
    <label class="fld">Remarque (facultatif)<input id="hc-n" maxlength="80" value="${esc(r.note||"")}" placeholder="Ex. remplacement de Fatima"></label>
    <div class="btnrow"><button class="btn" id="hc-ok">Enregistrer</button>${hourRow(uid,day)?`<button class="btn ghost" id="hc-del">Vider la case</button>`:""}<button class="btn ghost" id="hc-x">Annuler</button></div></div>`;
  document.body.appendChild(v);
  const k=v.querySelector("#hc-k"), s=v.querySelector("#hc-s"), e=v.querySelector("#hc-e"), b=v.querySelector("#hc-b");
  const upd=()=>{ v.querySelector("#hc-times").hidden=k.value!=="travail"; const m=hm2min(e.value)-hm2min(s.value)-(+b.value||0);
    v.querySelector("#hc-tot").textContent=k.value!=="travail"?"Pas d'heures comptées : le jour est noté comme absence.":m>0?`Heures prestées : ${minTxt(m)}`:"Vérifiez les heures (le départ doit être après l'arrivée)."; };
  [k,s,e,b].forEach(x=>x.oninput=x.onchange=upd); upd();
  const close=()=>v.remove(); v.querySelector("#hc-x").onclick=close; v.onclick=ev=>{ if(ev.target===v) close(); };
  const save=async(kind)=>{ const args={p_user:uid,p_day:day,p_kind:kind,p_start:kind==="travail"?s.value:null,p_end:kind==="travail"?e.value:null,p_break:kind==="travail"?(+b.value||0):0,p_note:v.querySelector("#hc-n").value};
    if(await run(()=>sb.rpc("set_hours",args),kind?"Enregistré":"Case vidée")){ S.hours2=(S.hours2||[]).filter(h=>!(h.user_id===uid&&h.day===day));
      if(kind) S.hours2.push({user_id:uid,day,kind,start_t:args.p_start,end_t:args.p_end,break_min:args.p_break,note:args.p_note.trim()||null}); close(); render(); } };
  v.querySelector("#hc-ok").onclick=()=>save(k.value);
  const d=v.querySelector("#hc-del"); if(d) d.onclick=()=>save("");
  k.focus();
}
function bindHours(){
  const H=S.hv; hoursEnsure();
  $$("[data-hmode]").forEach(b=>b.onclick=()=>{ H.mode=b.dataset.hmode; render(); });
  $$("[data-hw]").forEach(b=>b.onclick=()=>{ const n=+b.dataset.hw; H.week=n?addDays(H.week,n):mondayOf(todayISO()); render(); });
  $$("[data-hm]").forEach(b=>b.onclick=()=>{ const [y,m]=H.month.split("-").map(Number), d=new Date(y,m-1+(+b.dataset.hm),15); H.month=isoD(d).slice(0,7); render(); });
  $$("[data-hc]").forEach(b=>b.onclick=()=>{ const [u,d]=b.dataset.hc.split("|"); editHourCell(u,d); });
  $$("[data-hval]").forEach(b=>b.onclick=async()=>{ const ok=b.dataset.ok==="1";
    if(await run(()=>sb.rpc("validate_hours_week",{p_user:b.dataset.hval,p_week:H.week,p_ok:ok}),ok?"Semaine validée":"Semaine rouverte")){
      S.hweeks=(S.hweeks||[]).filter(w=>!(w.user_id===b.dataset.hval&&w.week_start===H.week)); S.hweeks.push({user_id:b.dataset.hval,week_start:H.week,validated_at:ok?new Date().toISOString():null}); render(); } });
  const ap=$("#h-addp"); if(ap) ap.onclick=()=>pickColleagues("Ajouter au tableau",officePeople(H.week,addDays(H.week,6)),async ids=>{ S.hoursExtra=[...new Set([...(S.hoursExtra||[]),...ids])]; render(); return true; });
  bindHoursNote(H.week);
  $$("[data-hcolor]").forEach(b=>b.onclick=e=>{ e.stopPropagation(); pickHoursColor(b.dataset.hcolor); });
  $$("[data-hxlsx]").forEach(b=>b.onclick=async()=>{ const ym=b.dataset.hxlsx, d=monthDays(ym); b.disabled=true;
    try{ await loadHours(mondayOf(d[0]),d[d.length-1]); if(!(S.hours2||[]).some(h=>h.day>=d[0]&&h.day<=d[d.length-1])){ toast("Rien d'encodé ce mois-là."); return; }
      await saveFile(hoursPlanningXlsx(ym),`horaires-accueil-${ym}.xlsx`); }
    catch(e){ console.error(e); toast("Le fichier n'a pas pu être préparé."); } finally{ b.disabled=false; } });
  const cp=$("#h-copy"); if(cp) cp.onclick=async()=>{ const who=officePeople(H.week,addDays(H.week,6)).filter(canEditHours); let n=0;
    for(const uid of who){ if(!canManageOffice()&&weekOk(uid,H.week)) continue;
      for(let i=0;i<6;i++){ const d=addDays(H.week,i), src=hourRow(uid,addDays(d,-7)); if(!src||hourRow(uid,d)) continue;
        const {error}=await sb.rpc("set_hours",{p_user:uid,p_day:d,p_kind:src.kind,p_start:src.start_t,p_end:src.end_t,p_break:src.break_min,p_note:src.note});
        if(error){ toast(frError(error)); break; } n++; } }
    S.hoursLoaded=null; toast(n?`${n} case${n>1?"s":""} recopiée${n>1?"s":""}`:"Rien à recopier (cases déjà remplies, ou semaine précédente vide)"); render(); };
  const csv=$("#h-csv"); if(csv) csv.onclick=()=>{ const days=monthDays(H.month), people=officePeople(days[0],days[days.length-1]), rows=[["Nom","Date","Jour","Type","Arrivée","Départ","Pause (min)","Heures","Heures (décimal)","Remarque","Semaine validée"]];
    for(const uid of people) for(const d of days){ const r=hourRow(uid,d); if(!r) continue; const m=hoursOf(r);
      rows.push([staffName(uid),`${d.slice(8)}/${d.slice(5,7)}/${d.slice(0,4)}`,DOWS[(new Date(d+"T12:00").getDay()+6)%7],HK[r.kind][0],t5(r.start_t),t5(r.end_t),r.kind==="travail"?r.break_min:"",r.kind==="travail"?minTxt(m):"",r.kind==="travail"?(m/60).toFixed(2).replace(".",","):"",r.note||"",weekOk(uid,mondayOf(d))?"oui":"non"]); }
    if(rows.length<2) return toast("Rien d'encodé ce mois-ci.");
    csvDownload(`horaires-accueil-${H.month}.csv`,rows); };
}

/* ---------- caisse (paiements en espèces) ---------- */
const CASH_KINDS={consultation:"Consultation",visite:"Visite à domicile",attestation:"Attestation",certificat:"Certificat",vaccin:"Vaccin",autre:"Autre"};
const cashKind = k => CASH_KINDS[k]||"Autre";
const eur = v => (Number(v)||0).toLocaleString("fr-BE",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
async function loadCash(ym){
  const d=monthDays(ym);
  const [c,r,to]=await Promise.all([sb.from("cash_payments").select("*").gte("paid_on",d[0]).lte("paid_on",d[d.length-1]).order("paid_on",{ascending:false}).order("id",{ascending:false}),
    sb.from("cash_reports").select("*").order("month",{ascending:false}).limit(24), S.cashTo===undefined?sb.rpc("get_cash_report_to"):Promise.resolve({data:S.cashTo})]);
  if(c.error){ S.cashErr=frError(c.error); S.cash=[]; } else { S.cashErr=null; S.cash=c.data||[]; }
  S.cashReports=r.data||[]; if(!to.error) S.cashTo=to.data||"admin@cmpl.be"; S.cashLoaded=ym; if(S.cscreen==="cash") render();
}
function cashHTML(){
  const ym=S.cashMonth||(S.cashMonth=todayISO().slice(0,7)), D=S.cashDraft||(S.cashDraft={day:todayISO(),amount:"",prov:S.me.provider_id||"",kind:"consultation",note:""});
  const label=new Date(ym+"-15").toLocaleDateString("fr-BE",{month:"long",year:"numeric"});
  const head=`<div class="chead"><div><h1>Caisse</h1><p>Les paiements en espèces, sans nom de patient. Rien ne s'efface : une erreur s'annule avec un motif. Le 1er de chaque mois, le résumé du mois précédent part par e-mail à <b>${esc(S.cashTo||"admin@cmpl.be")}</b>.</p></div></div>`;
  if(S.cashLoaded!==ym) return head+`<div class="empty">Chargement…</div>`;
  if(S.cashErr) return head+`<div class="empty">La caisse n'est pas encore disponible (${esc(S.cashErr)}). La mise à jour du serveur (migration 049) est-elle faite ?</div>`;
  const ok=(S.cash||[]).filter(c=>!c.cancelled_at), total=ok.reduce((t,c)=>t+Number(c.amount),0), today=ok.filter(c=>c.paid_on===todayISO()).reduce((t,c)=>t+Number(c.amount),0);
  const byProv={}; ok.forEach(c=>{ const k=c.provider_id||""; byProv[k]=(byProv[k]||0)+Number(c.amount); });
  const sent=(S.cashReports||[]).find(r=>r.month===ym+"-01");
  const days=[...new Set((S.cash||[]).map(c=>c.paid_on))];
  const canCancel=c=>!c.cancelled_at&&(canManageOffice()||(c.created_by===S.me.id&&Date.now()-new Date(c.created_at)<864e5));
  return head+`<div class="taskgrid cashgrid">
   <section class="card taskform"><h3>Nouveau paiement</h3>
    <div class="row2"><label class="fld">Montant (€)<input id="ca-amt" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex. 25" value="${esc(D.amount)}"></label>
     <label class="fld">Date<input id="ca-day" type="date" value="${esc(D.day)}" max="${todayISO()}"></label></div>
    <div class="cachips" role="group" aria-label="Montant rapide">${[3,4,6,11].map(v=>`<button type="button" class="mini ghostmini" data-camt="${v}">${v} €</button>`).join("")}</div>
    <div class="row2"><label class="fld">Prestataire<select id="ca-prov"><option value="">— (aucun)</option>${P.list().map(p=>`<option value="${p.id}" ${D.prov===p.id?"selected":""}>${esc(p.display_name)}</option>`).join("")}</select></label>
     <label class="fld">Prestation<select id="ca-kind">${Object.entries(CASH_KINDS).map(([k,l])=>`<option value="${k}" ${D.kind===k?"selected":""}>${l}</option>`).join("")}</select></label></div>
    <label class="fld">Remarque (facultatif, jamais de nom de patient)<input id="ca-note" maxlength="80" value="${esc(D.note)}" placeholder="Ex. 2 certificats"></label>
    <div class="btnrow"><button class="btn" id="ca-add">Encoder le paiement</button></div>
   </section>
   <section>
    <div class="hnav"><button type="button" class="btn ghost" data-cm="-1" aria-label="Mois précédent">‹</button><b class="cap">${label}</b><button type="button" class="btn ghost" data-cm="1" aria-label="Mois suivant" ${ym>=todayISO().slice(0,7)?"disabled":""}>›</button></div>
    <div class="cashsum"><div><small>Total du mois</small><b>${eur(total)}</b><small>${ok.length} paiement${ok.length>1?"s":""}</small></div>${ym===todayISO().slice(0,7)?`<div><small>Aujourd'hui</small><b>${eur(today)}</b></div>`:""}
     <div class="cashprov">${Object.entries(byProv).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span>${esc(provName(k)||"Sans prestataire")} <b>${eur(v)}</b></span>`).join("")}</div></div>
    <div class="list cashlist">${days.length?days.map(d=>{ const its=(S.cash||[]).filter(c=>c.paid_on===d), st=its.filter(c=>!c.cancelled_at).reduce((t,c)=>t+Number(c.amount),0);
      return `<p class="cashday"><span class="cap">${new Date(d+"T12:00").toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long"})}</span><b>${eur(st)}</b></p>`+its.map(c=>`<div class="cashrow ${c.cancelled_at?"off":""}"><b class="camt">${eur(c.amount)}</b><span><b>${cashKind(c.kind)}</b>${c.provider_id?` · ${esc(provName(c.provider_id))}`:""}${c.note?`<small>${esc(c.note)}</small>`:""}<small>Encodé par ${esc(teamName(c.created_by))} à ${new Date(c.created_at).toLocaleTimeString("fr-BE",{hour:"2-digit",minute:"2-digit"})}${c.cancelled_at?` · <b>annulé</b> par ${esc(teamName(c.cancelled_by))} : ${esc(c.cancel_reason||"")}`:""}</small></span>${canCancel(c)?`<button type="button" class="linkbtn" data-cacx="${c.id}">Annuler</button>`:""}</div>`).join(""); }).join("")
      :`<div class="empty">Aucun paiement en espèces ce mois-ci.</div>`}</div>
    <div class="btnrow"><button type="button" class="btn ghost" id="ca-csv" ${(S.cash||[]).length?"":"disabled"}>Télécharger pour Excel</button>${canManageOffice()?`<button type="button" class="btn ghost" id="ca-send">Envoyer le résumé de ce mois maintenant</button>`:""}${isAdmin()?`<button type="button" class="linkbtn" id="ca-to">Changer l'adresse du résumé</button>`:""}</div>
    <p class="hint">${sent?`Résumé de ce mois envoyé le ${fmtDate(sent.sent_at)} à ${esc(sent.sent_to||"")}.`:"Résumé de ce mois : pas encore envoyé."} Gardé 10 ans (documents comptables).</p>
   </section></div>`;
}
function bindCash(){
  const ym=S.cashMonth, D=S.cashDraft; if(S.cashLoaded!==ym){ loadCash(ym); return; }
  const f={amount:"#ca-amt",day:"#ca-day",prov:"#ca-prov",kind:"#ca-kind",note:"#ca-note"};
  Object.entries(f).forEach(([k,s])=>{ const el=$(s); if(el) el.oninput=el.onchange=()=>{ D[k]=el.value; }; });
  $$("[data-camt]").forEach(b=>b.onclick=()=>{ D.amount=b.dataset.camt; $("#ca-amt").value=D.amount; });
  $$("[data-cm]").forEach(b=>b.onclick=()=>{ const [y,m]=ym.split("-").map(Number); S.cashMonth=isoD(new Date(y,m-1+(+b.dataset.cm),15)).slice(0,7); render(); });
  $("#ca-add").onclick=async()=>{ const amt=parseFloat(String(D.amount).replace(",",".").replace(/[^\d.]/g,""));
    if(!(amt>0)) return toast("Indiquez le montant.");
    const btn=$("#ca-add"); btn.disabled=true;
    if(await run(()=>sb.rpc("add_cash",{p_day:D.day||null,p_amount:amt,p_provider:D.prov||null,p_kind:D.kind,p_note:D.note}),`${eur(amt)} encodé`)){
      S.cashDraft={...D,amount:"",note:""}; S.cashMonth=(D.day||todayISO()).slice(0,7); S.cashLoaded=null; render(); } else btn.disabled=false; };
  $$("[data-cacx]").forEach(b=>b.onclick=()=>{
    const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true");
    v.innerHTML=`<div class="mbox"><h2>Annuler ce paiement</h2><p class="hint">Il restera visible, barré, avec le motif. Il ne sera plus compté.</p><label class="fld">Motif<input id="cx-r" maxlength="120" placeholder="Ex. erreur de montant, encodé deux fois"></label>
      <div class="btnrow"><button class="btn" id="cx-ok">Annuler le paiement</button><button class="btn ghost" id="cx-x">Retour</button></div></div>`;
    document.body.appendChild(v); const close=()=>v.remove(); v.querySelector("#cx-x").onclick=close; v.onclick=e=>{ if(e.target===v) close(); };
    v.querySelector("#cx-ok").onclick=async()=>{ if(await run(()=>sb.rpc("cancel_cash",{p_id:+b.dataset.cacx,p_reason:v.querySelector("#cx-r").value}),"Paiement annulé")){ close(); S.cashLoaded=null; render(); } };
    v.querySelector("#cx-r").focus(); });
  const csv=$("#ca-csv"); if(csv) csv.onclick=()=>{ const rows=[["Date","Montant","Prestataire","Prestation","Remarque","Encodé par","Annulé","Motif annulation"]];
    (S.cash||[]).slice().reverse().forEach(c=>rows.push([`${c.paid_on.slice(8)}/${c.paid_on.slice(5,7)}/${c.paid_on.slice(0,4)}`,Number(c.amount).toFixed(2).replace(".",","),provName(c.provider_id),cashKind(c.kind),c.note||"",teamName(c.created_by),c.cancelled_at?"oui":"",c.cancel_reason||""]));
    csvDownload(`caisse-${ym}.csv`,rows); };
  const snd=$("#ca-send"); if(snd) snd.onclick=async()=>{ if(!confirmInline(snd,"Envoyer le résumé ?")) return; snd.disabled=true;
    const {data,error}=await sb.rpc("send_cash_report",{p_month:ym+"-01"}); snd.disabled=false; if(error) return toast(frError(error)); toast(data||"Envoyé"); S.cashLoaded=null; render(); };
  const to=$("#ca-to"); if(to) to.onclick=()=>{ const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true");
    v.innerHTML=`<div class="mbox"><h2>Adresse du résumé mensuel</h2><label class="fld">E-mail<input id="ct-e" type="email" value="${esc(S.cashTo||"admin@cmpl.be")}"></label><div class="btnrow"><button class="btn" id="ct-ok">Enregistrer</button><button class="btn ghost" id="ct-x">Annuler</button></div></div>`;
    document.body.appendChild(v); const close=()=>v.remove(); v.querySelector("#ct-x").onclick=close;
    v.querySelector("#ct-ok").onclick=async()=>{ const e=v.querySelector("#ct-e").value.trim(); if(await run(()=>sb.rpc("set_cash_report_to",{p_email:e}),"Adresse enregistrée")){ S.cashTo=e.toLowerCase(); close(); render(); } }; };
}

/* ---------- couleurs des accueillantes + fichier Excel « planning » (20261028a) ---------- */
const HCOLORS=[["#e9dc6e","Jaune"],["#8eb4e3","Bleu"],["#e0453f","Rouge"],["#e5b3e8","Rose"],["#9bd38b","Vert"],["#f2a65a","Orange"],["#7fd1c9","Turquoise"],["#c9c9c9","Gris"]];
function hoursColor(uid){
  const c=(S.hcolors||[]).find(x=>x.user_id===uid); if(c) return c.color;
  const ids=[...new Set([...(S.team||[]).filter(t=>t.role==="secretariat").map(t=>t.id),...(S.hours2||[]).map(h=>h.user_id)])].sort((a,b)=>staffName(a).localeCompare(staffName(b)));
  const used=new Set((S.hcolors||[]).map(x=>x.color)), free=HCOLORS.map(x=>x[0]).filter(x=>!used.has(x));
  const i=ids.filter(id=>!(S.hcolors||[]).some(x=>x.user_id===id)).indexOf(uid);
  return (free.length?free:HCOLORS.map(x=>x[0]))[Math.max(0,i)%(free.length||HCOLORS.length)];
}
function pickHoursColor(uid){
  const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true");
  const cur=hoursColor(uid);
  v.innerHTML=`<div class="mbox"><h2>Couleur de ${esc(staffName(uid))}</h2><p class="hint">La même couleur dans le tableau et dans le fichier Excel.</p>
    <div class="hcpick">${HCOLORS.map(([c,l])=>`<button type="button" data-hcol="${c}" aria-pressed="${c===cur}" aria-label="${l}"><i style="background:${c}"></i>${l}</button>`).join("")}</div>
    <div class="btnrow"><button class="btn ghost" id="hcp-x">Fermer</button></div></div>`;
  document.body.appendChild(v); const close=()=>v.remove(); v.querySelector("#hcp-x").onclick=close; v.onclick=e=>{ if(e.target===v) close(); };
  v.querySelectorAll("[data-hcol]").forEach(b=>b.onclick=async()=>{ const c=b.dataset.hcol;
    if(await run(()=>sb.rpc("set_hours_color",{p_user:uid,p_color:c}),"Couleur enregistrée")){ S.hcolors=[...(S.hcolors||[]).filter(x=>x.user_id!==uid),{user_id:uid,color:c}]; close(); render(); } });
}
// --- petit écrivain de fichiers .xlsx (sans bibliothèque externe) ---
const CRC_T=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0; } return t; })();
function crc32(u8){ let c=0xFFFFFFFF; for(let i=0;i<u8.length;i++) c=CRC_T[(c^u8[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function zipStore(files){ // files: [[name, string]]
  const enc=new TextEncoder(), parts=[], central=[]; let off=0;
  const u16=n=>[n&255,(n>>>8)&255], u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
  for(const [name,str] of files){ const nm=enc.encode(name), data=enc.encode(str), crc=crc32(data);
    const head=[...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),...u16(0)];
    parts.push(new Uint8Array(head),nm,data);
    central.push([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)],nm);
    off+=head.length+nm.length+data.length; }
  let csize=0; const cparts=[]; for(let i=0;i<central.length;i+=2){ const h=new Uint8Array(central[i]); cparts.push(h,central[i+1]); csize+=h.length+central[i+1].length; }
  const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(csize),...u32(off),...u16(0)]);
  return new Blob([...parts,...cparts,end],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}
const xesc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"");
const colName = n => { let s=""; n++; while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; };
// feuille : cells = Map("r,c" -> {v, fill, bold, border, align, wrap, italic, size}), merges=[[r1,c1,r2,c2]], widths=[...], heights={r:h}
function buildXlsx(sheetName, sh){
  const fills=["none","gray125"], xfs=[], xfKey=new Map(), fontsL=[`<font><sz val="11"/><name val="Calibri"/></font>`];
  const fontIdx=(b,i,sz)=>{ const k=`<font>${b?"<b/>":""}${i?"<i/>":""}<sz val="${sz||11}"/><name val="Calibri"/></font>`; let ix=fontsL.indexOf(k); if(ix<0){ fontsL.push(k); ix=fontsL.length-1; } return ix; };
  const fillIdx=c=>{ if(!c) return 0; const k=c.replace("#","").toUpperCase(); let ix=fills.indexOf(k); if(ix<0){ fills.push(k); ix=fills.length-1; } return ix; };
  const style=c=>{ const f=fontIdx(c.bold,c.italic,c.size), fi=fillIdx(c.fill), b=c.border?1:0, al=c.align||"", w=c.wrap?1:0;
    const k=`${f}|${fi}|${b}|${al}|${w}`; if(!xfKey.has(k)){ xfs.push({f,fi,b,al,w}); xfKey.set(k,xfs.length); } return xfKey.get(k); };
  const rows=new Map(); for(const [key,c] of sh.cells){ const [r,cc]=key.split(",").map(Number); if(!rows.has(r)) rows.set(r,[]); rows.get(r).push([cc,c]); }
  let sd=""; [...rows.keys()].sort((a,b)=>a-b).forEach(r=>{ const cs=rows.get(r).sort((a,b)=>a[0]-b[0]);
    sd+=`<row r="${r+1}"${sh.heights&&sh.heights[r]?` ht="${sh.heights[r]}" customHeight="1"`:""}>`+cs.map(([cc,c])=>{ const ref=colName(cc)+(r+1), s=style(c);
      return c.v===undefined||c.v===""?`<c r="${ref}" s="${s}"/>`:typeof c.v==="number"?`<c r="${ref}" s="${s}"><v>${c.v}</v></c>`:`<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xesc(c.v)}</t></is></c>`; }).join("")+`</row>`; });
  const cols=(sh.widths||[]).map((w,i)=>w?`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`:"").join("");
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" showGridLines="1"/></sheetViews><sheetFormatPr defaultRowHeight="18"/>${cols?`<cols>${cols}</cols>`:""}<sheetData>${sd}</sheetData>${sh.merges&&sh.merges.length?`<mergeCells count="${sh.merges.length}">${sh.merges.map(([r1,c1,r2,c2])=>`<mergeCell ref="${colName(c1)}${r1+1}:${colName(c2)}${r2+1}"/>`).join("")}</mergeCells>`:""}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const thin=`<left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="${fontsL.length}">${fontsL.join("")}</fonts><fills count="${fills.length}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.slice(2).map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join("")}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${thin}</border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length+1}"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>${xfs.map(x=>`<xf numFmtId="0" fontId="${x.f}" fillId="${x.fi}" borderId="${x.b}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"${x.al?` horizontal="${x.al}"`:""}${x.w?` wrapText="1"`:""}/></xf>`).join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const nm=xesc(sheetName).slice(0,31);
  return zipStore([
    ["[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
    ["_rels/.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nm}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml",styles],["xl/worksheets/sheet1.xml",sheet]]);
}
// --- le planning du mois, au format du tableau du secrétariat ---
const hTxt = t => { if(!t) return ""; const [h,m]=t.split(":").map(Number); return m?`${h}h${String(m).padStart(2,"0")}`:`${h}h`; };
const SLOTS=[9,10,11,12,13,14,15,16,17,18];
function hoursPlanningXlsx(ym){
  const days=monthDays(ym), label=new Date(ym+"-15").toLocaleDateString("fr-BE",{month:"long",year:"numeric"});
  const people=officePeople(days[0],days[days.length-1]);
  const hasSat=days.some(d=>new Date(d+"T12:00").getDay()===6&&(S.hours2||[]).some(h=>h.day===d));
  const work=days.filter(d=>{ const g=new Date(d+"T12:00").getDay(); return g>=1&&g<=5||(g===6&&hasSat); });
  const weeks=[]; work.forEach(d=>{ const w=mondayOf(d); let x=weeks.find(y=>y.w===w); if(!x){ x={w,days:[]}; weeks.push(x); } x.days.push(d); });
  const cells=new Map(), merges=[], widths=[11], heights={}; const set=(r,c,o)=>cells.set(`${r},${c}`,o);
  const slotOf=t=>{ const [h,m]=t.split(":").map(Number); return Math.min(9,Math.max(0,h-9)); };
  const endSlot=t=>{ const [h,m]=t.split(":").map(Number); const x=h*60+m-1; return Math.min(9,Math.max(0,Math.floor(x/60)-9)); };
  let r=0;
  set(r,0,{v:`Horaires de l'accueil – ${label}`,bold:true,size:14}); heights[r]=24; r+=2;
  for(const wk of weeks){
    // colonnes : une ou plusieurs « voies » par jour (horaires qui se chevauchent)
    let c=1; const top=r;
    set(r,0,{v:"Heure",bold:true,border:true,align:"center",fill:"#e7e6e6"});
    for(const d of wk.days){
      const shifts=people.map(u=>hourRow(u,d)).filter(x=>x&&x.kind==="travail").sort((a,b)=>a.start_t.localeCompare(b.start_t));
      const lanes=[]; shifts.forEach(s=>{ let i=lanes.findIndex(l=>l[l.length-1].end_t<=s.start_t); if(i<0){ lanes.push([s]); } else lanes[i].push(s); });
      const n=Math.max(2,lanes.length);
      set(r,c,{v:new Date(d+"T12:00").toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"}),bold:true,border:true,align:"center",fill:"#e7e6e6"});
      for(let k=1;k<n;k++) set(r,c+k,{border:true,fill:"#e7e6e6"});
      merges.push([r,c,r,c+n-1]);
      SLOTS.forEach((h,si)=>{ for(let k=0;k<n;k++) set(r+1+si,c+k,{border:true,align:"center"}); });
      lanes.forEach((ln,k)=>ln.forEach(s=>{ const a=slotOf(s.start_t), b=endSlot(s.end_t), col=hoursColor(s.user_id);
        for(let si=a;si<=b;si++) set(r+1+si,c+k,{border:true,align:"center",fill:col,v:si===a&&si===b?`${hTxt(s.start_t)}–${hTxt(s.end_t)}`:si===a?hTxt(s.start_t):si===b?hTxt(s.end_t):""}); }));
      for(let k=0;k<n;k++) widths[c+k]=n>2?9:12;
      c+=n;
    }
    SLOTS.forEach((h,si)=>set(r+1+si,0,{v:`${h}-${h+1}h`,border:true,align:"center"}));
    r+=1+SLOTS.length+1;
    // sous le tableau : heures de la semaine, absences, désidératas
    const tot=people.map(u=>[u,wk.days.reduce((t,d)=>t+hoursOf(hourRow(u,d)),0)]).filter(x=>x[1]>0);
    if(tot.length){ set(r,0,{v:"Heures de la semaine : "+tot.map(([u,m])=>`${staffName(u)} ${minTxt(m)}`).join(" · "),italic:true}); r++; }
    const abs=[]; wk.days.forEach(d=>people.forEach(u=>{ const x=hourRow(u,d); if(x&&x.kind!=="travail") abs.push(`${staffName(u)} : ${HK[x.kind][0].toLowerCase()} le ${new Date(d+"T12:00").toLocaleDateString("fr-BE",{weekday:"long",day:"numeric"})}${x.note?` (${x.note})`:""}`); }));
    if(abs.length){ set(r,0,{v:"Absences : "+abs.join(" · "),italic:true}); r++; }
    const note=(S.hnotes||[]).find(x=>x.week_start===wk.w);
    if(note&&note.body.trim()){ const lines=note.body.split("\n").length; set(r,0,{v:"Désidératas et indisponibilités :",bold:true}); r++;
      set(r,0,{v:note.body,wrap:true,border:true,fill:"#fff8e1"}); merges.push([r,0,r,Math.max(6,c-1)]); heights[r]=Math.min(400,18*Math.max(2,lines+Math.ceil(note.body.length/140))); r++; }
    r+=2;
  }
  // légende des couleurs + total du mois (pour le secrétariat social)
  set(r,0,{v:"Légende",bold:true}); r++;
  people.forEach(u=>{ set(r,0,{v:staffName(u),fill:hoursColor(u),border:true}); merges.push([r,0,r,1]); set(r,1,{border:true,fill:hoursColor(u)}); r++; });
  r++; const kinds=["conge","maladie","ferie","formation","recup","autre"];
  ["Accueillante","Heures prestées","Heures (décimal)","Jours travaillés",...kinds.map(k=>HK[k][0])].forEach((h,i)=>set(r,i,{v:h,bold:true,border:true,fill:"#e7e6e6",align:"center",wrap:true})); heights[r]=30; r++;
  people.forEach(u=>{ const rs=days.map(d=>hourRow(u,d)).filter(Boolean), wm=rs.filter(x=>x.kind==="travail").reduce((t,x)=>t+hoursOf(x),0);
    set(r,0,{v:staffName(u),border:true,fill:hoursColor(u)}); set(r,1,{v:minTxt(wm),border:true,align:"center"}); set(r,2,{v:Math.round(wm/60*100)/100,border:true,align:"center"});
    set(r,3,{v:rs.filter(x=>x.kind==="travail").length,border:true,align:"center"}); kinds.forEach((k,i)=>{ const n=rs.filter(x=>x.kind===k).length; set(r,4+i,{v:n||"",border:true,align:"center"}); }); r++; });
  for(let i=0;i<10;i++) widths[i]=Math.max(widths[i]||0,i===0?18:12);
  return buildXlsx(label.replace(/^./,x=>x.toUpperCase()),{cells,merges,widths,heights});
}

function startRealtime(){
  if(RT||!sb.channel||!S.session||!S.me||S.me.status!=="active") return;
  try{
    RT=sb.channel("cmpl-"+S.me.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},p=>rtQueue(p.new&&p.new.request_id))
      .on("postgres_changes",{event:"*",schema:"public",table:"requests"},p=>rtQueue(p.new&&p.new.id))
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"request_updates"},p=>rtQueue(p.new&&p.new.request_id))
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications"},()=>rtQueue(null))
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"team_messages"},()=>teamRt())
      .subscribe();
  }catch(e){ console.error(e); RT=null; }
}
function stopRealtime(){ if(RT){ try{ sb.removeChannel(RT); }catch(e){} RT=null; } }
function rtQueue(id){ if(id) RTQ.add(id); clearTimeout(rtTimer); rtTimer=setTimeout(rtFlush,400); }
async function rtFlush(){
  if(!S.me) return; const ids=[...RTQ]; RTQ.clear(); const pat=S.me.role==="patient";
  try{
    if(ids.length){ const {data,error}=await reqQuery(sel=>sb.from("requests").select(sel).in("id",ids)); if(error) throw error;
      for(const r of data||[]){ const i=S.reqs.findIndex(x=>x.id===r.id); if(i>=0) S.reqs[i]=r; else S.reqs.unshift(r); } }
    if(pat){ const {data}=await sb.from("notifications").select("*").eq("user_id",S.me.id).order("created_at",{ascending:false}).limit(50); if(data) S.notifs=data; }
  }catch(e){ console.error(e); return; }
  const openId = pat ? (S.screen==="req"?S.openReq:null) : (S.cscreen==="inbox"?S.sel:null);
  if(audioPlaying()){ updateBadges(); setTimeout(()=>rtQueue(null),3000); return; }   // ne pas couper un message vocal en cours d'écoute
  const el=document.activeElement, typing=!!(el&&(el.tagName==="TEXTAREA"||el.tagName==="INPUT"||el.tagName==="SELECT"));
  const busy = S.screen==="flow" || S.editNews || (!pat && ["compose","settings","tasks","inventory"].includes(S.cscreen));
  if(typing||REC||CREC||S.pend||document.querySelector(".viewer,.scanner,.tour")){
    // en pleine saisie : on ne met à jour que le fil de la conversation ouverte (le texte en cours reste intact)
    const chat=$("#chat"), r=openId&&ids.includes(openId)&&S.reqs.find(x=>x.id===openId);
    if(chat&&r){ const t=document.createElement("div"); t.innerHTML=chatHTML(r,pat?"patient":"centre"); chat.replaceWith(t.firstElementChild); hydrateAtt(); scrollChat(); }
    updateBadges();
  } else if(!busy) render(); else updateBadges();
  if(pat&&openId&&ids.includes(openId)){ const unread=S.notifs.filter(n=>n.request_id===openId&&!n.read_at);
    if(unread.length){ const now=new Date().toISOString(); await sb.from("notifications").update({read_at:now}).in("id",unread.map(n=>n.id)); unread.forEach(n=>n.read_at=now); updateBadges(); } }
}

/* =====================================================================
   DÉMARRAGE
   ===================================================================== */
sb.auth.onAuthStateChange((event, session)=>{
  S.session=session;
  if(event==="PASSWORD_RECOVERY"){ S.recovery=true; render(); return; }
  if(event==="SIGNED_IN"||event==="SIGNED_OUT"||event==="USER_UPDATED") setTimeout(refresh,0);
});
(async()=>{
  applyLang(L);
  try{ const {data}=await sb.auth.getSession(); S.session=data.session; await refresh(); }
  catch(e){ console.error(e); app().innerHTML=`<div class="wrap"><div class="err" style="margin-top:20px">Impossible de joindre le centre pour l'instant. Vérifiez votre connexion internet puis rechargez la page.</div></div>`; return; }
  S.loading=false; render();
})();
// Actualisation automatique (toutes les 60 s, et au retour sur l'app), sans perdre ce qui est en cours d'écriture
let busy=false;
async function autoRefresh(){ if(busy||!S.session||S.loading||document.hidden||S.mfa) return; const el=document.activeElement;
  if(el&&(el.tagName==="TEXTAREA"||el.tagName==="INPUT"||el.tagName==="SELECT")) return;
  if(S.screen==="flow"||S.rec||S.pend||S.editNews||S.cscreen==="compose"||S.cscreen==="settings"||S.cscreen==="tasks"||S.cscreen==="inventory"&&S.inv&&(S.inv.title||S.inv.photos.length)||CREC||document.querySelector(".viewer,.scanner,.tour")) return; busy=true; try{ await refresh(); } finally{ busy=false; } }
setInterval(autoRefresh, 60000);
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) autoRefresh(); });
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
console.log("CMPL app version "+APP_VERSION);
})();
