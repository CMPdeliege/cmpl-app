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
function stLabelP(r){ if(r.status==="traite") return closedLabel(r); if(r.last_from==="staff") return r.type==="centre"?"Message reçu":"Réponse reçue"; return r.status==="encours"?"En cours":"Envoyée"; }
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
function chatHTML(r, viewer){
  const mine = m => viewer==="patient" ? m.from_patient : !m.from_patient;
  const dest = reqWho(r);
  let h=`<div class="chat" id="chat">`, day="", who="";
  const sep = d => { const l=dayLabel(d); if(l!==day){ day=l; who=""; h+=`<div class="day"><span>${esc(l)}</span></div>`; } };
  if(viewer==="patient" && !r.purged_at && r.type!=="centre"){
    sep(r.created_at);
    const dl=answersDL(r.answers);
    h+=`<div class="msg me"><div class="bub me reqcard"><b>${TYPES[r.type].title}</b>${dl?`<dl>${dl}</dl>`:""}<span class="t">${hm(r.created_at)}</span></div></div>`;
    if(r.status!=="traite") h+=`<div class="sys"><span>Envoyée à :</span> <b translate="no">${esc(dest)}</b><br><span>${r.priority==="haute"?"Elle sera vue dans les 24 heures (heures d'ouverture).":r.priority==="basse"?"Elle sera vue dès que possible (heures d'ouverture).":"Elle sera vue dans les 72 heures (heures d'ouverture)."}</span> <span>${r.provider_id?"Le délai de réponse est ensuite décidé par le prestataire.":"Le délai de réponse est ensuite décidé par le centre."}</span><br>Urgence vitale : 112.</div>`;
  }
  for(const m of msgsOf(r)){
    sep(m.created_at);
    const me=mine(m), atts=m.attachments||[];
    const name = viewer==="patient" ? (m.from_patient?"":m.author_label) : (m.from_patient?"":m.author_label);
    const showName = !me && name && name!==who; who = me ? "" : name;
    const showBody = !(atts.length && AUTO_BODY.test(m.body));
    h+=`<div class="msg ${me?"me":"them"}">${showName?`<small class="who">${viewer==="patient"&&!m.from_patient&&AV.get(m.author_id)?avatarHTML(AV.get(m.author_id),name,22):""}${esc(name)}</small>`:""}<div class="bub ${me?"me":"bot"}${atts.length?" hasatt":""}">${atts.map(attHTML).join("")}${showBody?`<div class="txt" dir="auto" translate="${AUTO_BODY.test(m.body)?"yes":"no"}">${esc(m.body)}</div>`:""}<span class="t">${hm(m.created_at)}</span></div></div>`;
  }
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
   <div class="btnrow"><button type="button" class="btn ghost" id="ph-pick">${url?"Changer la photo":"Ajouter une photo"}</button>${url?`<button type="button" class="linkbtn" id="ph-del">Retirer</button>`:""}</div></div></div>
   <input type="file" id="ph-file" accept="image/*" hidden></section>`;
}
function bindPhotoCard(){
  const inp=$("#ph-file"); if(!inp) return;
  $("#ph-pick").onclick=()=>inp.click();
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
function scrollChat(){
  const c=$("#chat"); if(!c) return;
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
    ${tpl?`<button type="button" class="cbtn tplb" id="c-tpl" aria-label="Réponses types" title="Réponses types" aria-haspopup="true">${SI.tpl}</button>`:""}
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
function bindComposer(key, send, onInput){
  const ta=$("#c-text"), go=$("#c-go"), file=$("#c-file"); if(!ta) return;
  const upd=()=>{ const has=!!(ta.value.trim()||(S.pend&&S.pend.key===key)), mic=!has&&canRecord();
    go.innerHTML=mic?IC.mic:IC.send; go.dataset.mode=mic?"mic":"send"; go.disabled=!has&&!mic;
    go.setAttribute("aria-label",mic?"Enregistrer un message vocal":"Envoyer"); go.title=mic?"Message vocal":"Envoyer"; };
  const grow=()=>{ ta.style.height="auto"; ta.style.height=Math.min(ta.scrollHeight,150)+"px"; };
  ta.oninput=()=>{ S.drafts[key]=ta.value; grow(); upd(); if(onInput) onInput(ta.value); };
  grow(); upd();
  $("#c-att").onclick=()=>file.click();
  $("#c-scan").onclick=()=>openScanner(pend=>{ clearPend(); S.pend={...pend,key}; render(); $("#c-text")?.focus({preventScroll:true}); });
  file.onchange=async()=>{ const f=file.files[0]; file.value=""; if(!f) return;
    try{ clearPend(); S.pend=await prepFile(f,key); render(); $("#c-text")?.focus({preventScroll:true}); }catch(e){ toast(e.message); } };
  const un=$("#c-unatt"); if(un) un.onclick=()=>{ clearPend(); render(); };
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
  try{ mr=new MediaRecorder(stream, type?{mimeType:type}:undefined); }
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
function newsCard(n, full){
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
const REQ_SELECT = "*, messages(id,from_patient,author_id,author_label,body,created_at,attachments(id,kind,mime,name,size,duration_s)), request_items(id,label,decision,quantity)";
async function loadPatient(){
  const uid=S.session.user.id;
  const [rq, md, nt] = await Promise.all([
    sb.from("requests").select(REQ_SELECT).order("created_at",{ascending:false}).limit(150),
    sb.from("patient_meds").select("*").order("last_granted_at",{ascending:false}),
    sb.from("notifications").select("*").eq("user_id", uid).order("created_at",{ascending:false}).limit(50)
  ]);
  S.reqs = rq.data||[]; S.meds = md.data||[]; S.notifs = nt.data||[];
  try{ const ab=await sb.rpc("provider_absences"); S.absences=ab.error?[]:(ab.data||[]); }catch(e){ S.absences=[]; }
  if(S.me.status==="active"){ const f=await sb.rpc("my_family"); S.family=f.error?null:f.data; }
  await Promise.all([loadProviderAvatars(), loadAvatars([uid, ...S.reqs.flatMap(r=>(r.messages||[]).filter(m=>!m.from_patient).map(m=>m.author_id))])]);
}
async function loadStaff(){
  const role=S.me.role;
  const rq = await sb.from("requests").select(REQ_SELECT).order("created_at",{ascending:false}).limit(500);
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
  tasks.push(sb.from("tasks").select("*").order("created_at",{ascending:false}).limit(500).then(r=>S.tasks=r.data||[]));
  tasks.push(loadInventory());
  tasks.push(sb.from("patient_records").select("*").order("last_name").then(r=>S.records=r.error?[]:(r.data||[])));
  tasks.push(sb.from("request_notes").select("*").order("created_at").then(r=>S.notes=r.error?[]:(r.data||[])));
  tasks.push(loadLeaves());
  tasks.push(loadTeam());
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
const bioName = () => BIO&&BIO.type==="touchid"?"Touch ID":"Face ID";
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
  const {data,error}=await sb.auth.mfa.enroll({factorType:"totp",issuer:"Centre Médical Prince de Liège",friendlyName:bioName()+" iPhone "+new Date().toISOString().slice(0,19)+" "+Math.random().toString(36).slice(2,6)});
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
  return `<section class="card"><h3>${n}</h3>${faceIdOn()?`<p class="hint">${n} est activé sur cet iPhone : il remplace l'application d'authentification pour vous connecter.</p>
    <div class="btnrow"><button class="btn ghost" id="fid-code">Afficher un code pour l'ordinateur</button><button class="linkbtn" id="fid-off">Désactiver ${n}</button></div><div id="fid-out"></div>`
   :`<p class="hint">Connectez-vous avec ${n} au lieu de taper le code de l'application d'authentification. Cet iPhone pourra aussi vous afficher le code pour vous connecter sur un ordinateur.</p>
    <div class="btnrow"><button class="btn" id="fid-on">Activer ${n} sur cet iPhone</button></div>`}</section>`;
}
function bindFaceIdCard(){
  const on=$("#fid-on"), off=$("#fid-off"), cd=$("#fid-code");
  if(on) on.onclick=async()=>{ on.disabled=true; try{ await faceIdSetup(); toast(bioName()+" activé"); }catch(e){ console.error(e); toast("Activation impossible : "+frError(e)); } render(); };
  if(off) off.onclick=async()=>{ off.disabled=true; await faceIdForget(true); toast(bioName()+" désactivé"); render(); };
  if(cd) cd.onclick=async()=>{ try{ const {s:sec}=await faceIdSecret(); const show=async()=>{ const el=$("#fid-out"); if(!el) return clearInterval(tm);
      const left=30-Math.floor(Date.now()/1000)%30; el.innerHTML=`<p class="fidcode" translate="no">${(await totpCode(sec)).replace(/(\d{3})/,"$1 ")}</p><p class="hint">Valable encore ${left} s. Tapez-le sur l'ordinateur.</p>`; };
      await show(); const tm=setInterval(show,1000); setTimeout(()=>{ clearInterval(tm); const el=$("#fid-out"); if(el) el.innerHTML=""; },90000);
    }catch(e){ if(e&&e.code!=="CANCELED") toast(bioName()+" : lecture impossible. Désactivez puis réactivez "+bioName()+"."); } };
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
          if(e&&e.code!=="ERROR"){ await faceIdForget(false); z.innerHTML=""; msg(n+" n'est plus configuré sur cet iPhone : entrez le code de votre application, puis réactivez "+n+" dans Mon profil."); }
          else msg(n+" n'a pas fonctionné. Réessayez ou entrez le code."); } };
      $("#fid-go").onclick=go; go();
    } else if(enroll){
      z.innerHTML=`<button class="btn full" id="fid-new">Activer avec ${n} (recommandé)</button><p class="hint" style="text-align:center;margin:6px 0 0">Rien à installer : ${n} remplace l'application d'authentification sur cet iPhone. Ou utilisez le code QR ci-dessous.</p>`;
      $("#fid-new").onclick=async e=>{ e.target.disabled=true;
        try{ await faceIdSetup(); markActive(); lastAct=Date.now(); toast(n+" activé"); await refresh(); }
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
      const isBio=f=>/^(Face ID|Touch ID)/.test(f.friendly_name||"");
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
  if($("#chat")) requestAnimationFrame(scrollChat);
  updateBadges();
}

/* ---------- pastille « nouveau » : titre de l'onglet, icône de l'onglet, icône de l'app ---------- */
const BASE_TITLE=document.title;
const badgeCount = () => !S.me||S.me.status!=="active" ? 0
  : S.me.role==="patient" ? S.notifs.filter(n=>!n.read_at).length
  : S.reqs.filter(awaitingStaff).length + (S.team2&&S.team2.threads?teamUnread():0);
let lastBadge=-1, favImg=null;
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
  if(n===lastBadge) return; lastBadge=n;
  document.title = n ? `(${n}) ${BASE_TITLE}` : BASE_TITLE;
  setFavicon(n);
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
  if(pn) c.PushNotifications=pn; if(sec) c.CMPLSecure=sec; return CAP.c=c; };
const IS_NATIVE=/CMPLApp/.test(navigator.userAgent)||!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
const IS_STANDALONE=IS_NATIVE||matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
let pushSynced=false;
// --- notifications natives (app iPhone) ---
let nativePush=null;   // granted | denied | prompt | unsupported
const NPUSH = () => IS_NATIVE ? CAP().PushNotifications : null;
const ntokKey = "cmpl_ntoken";
async function nativePushInit(){
  const P=NPUSH(); if(!P){ nativePush="unsupported"; return; }
  if(!nativePushInit.done){ nativePushInit.done=true;
    try{
      P.addListener("registration", async t=>{ if(!S.me) return;
        const {error}=await sb.rpc("register_native_push",{p_token:t.value,p_platform:"ios"}); if(error) console.error(error);
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
  const a=app(); document.body.classList.remove("hasbar","ddopen");
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
  ${pinned.map(n=>`<div style="margin-bottom:12px">${newsCard(n,true)}</div>`).join("")}
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
  <form class="form" id="recform"><label class="fld" for="r-pass">Nouveau mot de passe (8 caractères minimum)<input id="r-pass" type="password" autocomplete="new-password"></label><div id="r-msg"></div><button class="btn full" type="submit">Enregistrer</button></form></div>`;
  addEyes(a);
  $("#recform").onsubmit=async e=>{ e.preventDefault(); const p=$("#r-pass").value;
    if(p.length<8){ $("#r-msg").innerHTML=`<div class="err">Le mot de passe doit contenir au moins 8 caractères.</div>`; return; }
    const {error}=await sb.auth.updateUser({password:p});
    if(error){ $("#r-msg").innerHTML=`<div class="err">${esc(frError(error))}</div>`; return; }
    S.recovery=false; toast("Mot de passe enregistré"); refresh(); };
}
function renderPending(a){
  a.className="wrap";
  a.innerHTML=`<div class="top">${BRAND}<button class="iconbtn" id="logout" aria-label="Se déconnecter" title="Se déconnecter">${IC.user}</button></div>
  <div class="langbar">${langPickerHTML()}</div>
  <h1 class="hello">Bonjour ${esc(S.me.first_name||"")}</h1>
  <div class="promise" style="margin:12px 0 18px;max-width:none"><b>Votre compte est en attente de validation</b><span>Le secrétariat vérifie que vous êtes bien patient du centre. Vous pourrez ensuite envoyer vos demandes. Revenez dans l'app après la validation.</span></div>
  ${BANNER112}
  ${S.news.length?`<div class="sechead"><h2>Actualités</h2></div><div class="newslist">${S.news.map(n=>newsCard(n,true)).join("")}</div>`:""}`;
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
function renderPatient(a){
  a.className="wrap";
  const sc=S.screen;
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
  return `<div class="top">${BRAND}<div class="menu"><button class="iconbtn" id="help" aria-label="Aide">${IC.help}</button><button class="iconbtn bell" id="bell" aria-label="Notifications">${IC.bell}${unread?`<span class="badge">${unread}</span>`:""}</button><button class="iconbtn" id="acct" aria-label="Mon compte">${AV.get(S.me.id)?avatarHTML(AV.get(S.me.id),"",42):IC.user}</button></div></div>`;
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
function patientHome(a){
  const pinned=S.news.filter(n=>n.pinned), others=S.news.filter(n=>!n.pinned);
  const fk=famKids(), who=S.who&&(S.who==="me"||fk.some(c=>c.id===S.who))?S.who:"all";
  const forWho = x => who==="all" || (who==="me" ? !x.child_id : x.child_id===who);
  const mine=S.reqs.filter(forWho).sort((x,y)=>(x.status==="traite")-(y.status==="traite")||new Date(y.created_at)-new Date(x.created_at));
  const meds=S.meds.filter(forWho);
  const grown=fk.filter(c=>c.status==="active"&&c.age>=CHILD_MAX_AGE), waiting=fk.filter(c=>c.status==="pending");
  const chips=fk.length?`<div class="tabs whochips" role="group" aria-label="Afficher pour">${[["all","Tous"],["me","Moi"],...fk.map(c=>[c.id,c.first_name])].map(([id,l])=>`<button class="tab" data-who="${id}" aria-pressed="${who===id}">${esc(l)}</button>`).join("")}</div>`:"";
  const forTag = x => x.child_id ? ` · pour ${esc(childFirst(x.child_id))}` : "";
  a.innerHTML=`<div class="phero">${topBar()}
  <div class="phello"><div><h1 class="hello">Bonjour ${esc(S.me.first_name||"")}</h1>
  <p class="sub">Que pouvons-nous faire pour vous ?</p></div>${SUN_SVG}</div></div>
  ${S.me.news_choice_at?"":`<section class="consent" aria-labelledby="cq"><h2 id="cq">Annonces du centre</h2><p>Souhaitez-vous recevoir une notification pour les annonces importantes du centre (fermetures exceptionnelles, campagnes de vaccination) ?</p><p class="hint">Les réponses à vos demandes vous sont toujours notifiées. Vous pourrez changer d'avis à tout moment dans Notifications.</p><div class="btnrow"><button class="btn" data-consent="1">Oui, me prévenir</button><button class="btn ghost" data-consent="0">Non merci</button></div></section>`}
  ${pinned.map(n=>`<button class="newsbtn" data-news="${n.id}" style="margin-bottom:12px">${newsCard(n,false)}</button>`).join("")}
  ${BANNER112}
  ${grown.map(c=>`<div class="famnote"><b>${esc(c.first_name)} a ${c.age} ans.</b> Il ou elle doit maintenant créer son propre compte dans l'app pour ses demandes (Créer un compte, avec sa propre adresse e-mail).</div>`).join("")}
  ${waiting.length?`<div class="famnote soft">En attente de validation par le centre : ${waiting.map(c=>esc(c.first_name)).join(", ")}. Vous pourrez ensuite faire des demandes en son nom.</div>`:""}
  <div class="actions">${PATIENT_TYPES.map(k=>[k,TYPES[k]]).map(([k,t])=>`<button class="act t-${k}" data-start="${k}"><div class="ic">${IC[k]}</div><b>${t.title}</b><span>${t.desc}</span></button>`).join("")}</div>
  <button class="absrow" id="absbtn">${IC.rdv}<span>Absences des prestataires</span><span aria-hidden="true">›</span></button>
  ${others.length?`<div class="sechead"><h2>Actualités</h2><button class="linkbtn" id="allnews">Tout voir</button></div>
  <div class="newslist" style="margin-bottom:26px">${others.slice(0,2).map(n=>`<button class="newsbtn" data-news="${n.id}">${newsCard(n,false)}</button>`).join("")}</div>`:""}
  ${chips}
  <div class="sechead"><h2>${fk.length?"Médicaments":"Mes médicaments"}</h2><small class="hint">Accordés par votre médecin</small></div>
  <div class="list" style="margin-bottom:26px">${meds.length?meds.map(m=>`<div class="medrow"><div class="ic">${IC.prescription}</div><div><b>${esc(m.label)}</b><small>${m.child_id?`Pour ${esc(childFirst(m.child_id))} · `:fk.length?"Pour moi · ":""}Dernière prescription ${fmt(m.last_granted_at)} · ${m.times_granted} fois</small></div><div class="acts"><button class="mini" data-renew="${esc(m.label)}" data-renewkid="${m.child_id||""}">Renouveler</button><button class="linkbtn" style="font-size:12px;color:var(--muted)" data-forget="${m.id}">Retirer</button></div></div>`).join(""):`<div class="empty">Vos médicaments apparaîtront ici après votre première prescription accordée.</div>`}</div>
  <div class="sechead"><h2>${fk.length?"Demandes":"Mes demandes"}</h2></div>
  <div class="list">${mine.length?mine.map(r=>{const ms=msgsOf(r),last=ms[ms.length-1],unread=S.notifs.some(n=>n.request_id===r.id&&!n.read_at&&n.title!=="Demande bien reçue");
    const prev=r.purged_at?"Contenu effacé":last?(last.from_patient?"Vous : ":"")+msgPreview(last):summaryLine(r.answers);
    return `<button class="row chatrow ${unread?"unread":""}" data-req="${r.id}"><div class="ic t-${r.type}">${IC[r.type]}</div><div><b>${esc(reqWho(r))} · ${TYPES[r.type].label}${forTag(r)}</b><small>${esc(prev)}</small></div><div class="rside"><small>${fmt(last?last.created_at:r.created_at)}</small>${unread?`<span class="dot" aria-label="Nouveau message"></span>`:`<span class="pill st-${stClassP(r)}">${stLabelP(r)}</span>`}</div></button>`}).join(""):`<div class="empty">Aucune demande pour l'instant.</div>`}</div>`;
  bindTop();
  $$("[data-start]").forEach(b=>b.onclick=()=>startFlow(b.dataset.start));
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
  $$("[data-zoom]").forEach(im=>{ im.onclick=()=>openViewer(im.dataset.zoom); im.onkeydown=e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openViewer(im.dataset.zoom); } }; });
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
const APP_VERSION="20261023d";
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
  return `<button class="savail av-${a.k}" id="avail-b" title="Pause des notifications ou absence">${AVAIL_ICON[a.k]}<span>${lab}</span></button>`; }
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
function staffNavHTML(sc){
  const ci=centreItems(), ciD=ci.filter(x=>!x.mob), cn=ciD.reduce((t,x)=>t+(x.n||0),0), cnM=ci.reduce((t,x)=>t+(x.n||0),0), nIn=S.reqs.filter(awaitingStaff).length, nT=myTasks().length, nM=teamUnread();
  const inCentre=ciD.some(x=>x.cs===sc), inCentreM=ci.some(x=>x.cs===sc), single=null;
  const av=AV.get(S.me.id)?avatarHTML(AV.get(S.me.id),"",36):`<span class="avl">${esc((S.me.first_name||"?").slice(0,1).toUpperCase())}</span>`;
  const who=`${esc([S.me.first_name,S.me.last_name].filter(Boolean).join(" ")||"")}`;
  const centreBtn = single
    ? `<button class="stab" data-cs="${single.cs}" aria-current="${sc===single.cs?"page":"false"}">${single.ic}<span>${single.t}</span>${badge(single.n)}</button>`
    : `<div class="ddwrap"><button class="stab" id="dd-centre-b" aria-haspopup="true" aria-expanded="false" aria-controls="dd-centre" aria-current="${inCentre?"page":"false"}">${SI.centre}<span>Le centre</span>${badge(cn)}${SI.down}</button>
       <div class="dd" id="dd-centre" hidden role="menu" aria-label="Le centre"><p class="ddh">Le centre</p>${ci.map(x=>`<button role="menuitem" class="ddi${x.mob?" mobonly":""}" data-cs="${x.cs}" aria-current="${sc===x.cs?"page":"false"}">${x.ic}<span>${x.t}<small>${x.d}</small></span>${badge(x.n)}</button>`).join("")}</div></div>`;
  const meMenu=`<div class="dd ddme" id="dd-me" hidden role="menu" aria-label="Mon compte"><p class="ddwho"><b>${who}</b>${ROLE_LABEL[S.me.role]}${S.me.provider_id?` · ${esc(provName(S.me.provider_id))}`:""}</p>
     <button role="menuitem" class="ddi" data-cs="settings">${IC.bell}<span>Mon profil et notifications</span></button>
     <button role="menuitem" class="ddi" data-cs="templates">${SI.tpl}<span>Mes réponses types</span></button>
     <button role="menuitem" class="ddi" data-cs="help">${IC.help}<span>Aide</span></button>
     <a role="menuitem" class="ddi ddrosa" href="${ROSA_PRO_URL}" target="_blank" rel="noopener">${SI.cal}<span>Mon agenda Rosa</span>${SI.ext}</a>
     <hr><button role="menuitem" class="ddi" id="logout">${SI.out}<span>Se déconnecter</span></button></div>`;
  return `<header class="top stop">${BRAND}
   <nav class="snav" aria-label="Navigation de l'équipe">
    <button class="stab" data-cs="inbox" aria-current="${sc==="inbox"?"page":"false"}">${SI.inbox}<span>Demandes</span>${badge(nIn)}</button>
    <button class="stab" data-cs="messages" aria-current="${sc==="messages"?"page":"false"}">${SI.chat}<span>Messages</span>${badge(nM)}</button>
    <button class="stab" data-cs="tasks" aria-current="${sc==="tasks"?"page":"false"}">${SI.tasks}<span>Tâches</span>${badge(nT)}</button>
    ${centreBtn}
   </nav>
   <div class="sact">
    ${availBtnHTML()}
    <button class="swrite" data-cs="compose" aria-current="${sc==="compose"?"page":"false"}">${SI.pen}<span><b class="lg">Écrire à un patient</b><b class="sh">Écrire</b></span></button>
    <a class="srosa" href="${ROSA_PRO_URL}" target="_blank" rel="noopener" title="Ouvre votre agenda Rosa (connexion avec votre propre compte Rosa)">${SI.cal}<span>Rosa</span>${SI.ext}</a>
    <div class="ddwrap"><button class="savbtn" id="dd-me-b" aria-haspopup="true" aria-expanded="false" aria-controls="dd-me" aria-label="Mon compte : ${who}" aria-current="${["settings","help"].includes(sc)?"page":"false"}">${av}</button>${meMenu}</div>
   </div>
  </header>
  <nav class="sbar" aria-label="Navigation de l'équipe">
   <button data-cs="inbox" aria-current="${sc==="inbox"?"page":"false"}">${SI.inbox}<span>Demandes</span>${badge(nIn)}</button>
   <button data-cs="messages" aria-current="${sc==="messages"?"page":"false"}">${SI.chat}<span>Messages</span>${badge(nM)}</button>
   <button class="sfab" data-cs="compose" aria-current="${sc==="compose"?"page":"false"}"><i>${SI.pen}</i><span>Écrire</span></button>
   ${single?`<button data-cs="${single.cs}" aria-current="${sc===single.cs?"page":"false"}">${single.ic}<span>${single.t}</span>${badge(single.n)}</button>`
     :`<button data-dd="dd-centre" aria-current="${inCentreM?"page":"false"}">${SI.centre}<span>Le centre</span>${badge(cnM)}</button>`}
   <button data-dd="dd-me" aria-current="${["settings","help","templates"].includes(sc)?"page":"false"}">${IC.user}<span>Moi</span></button>
  </nav><div class="ddback" hidden></div>`;
}
function closeDD(){ $$(".dd").forEach(d=>d.hidden=true); $$("[aria-expanded]").forEach(b=>b.setAttribute("aria-expanded","false")); const bk=$(".ddback"); if(bk) bk.hidden=true; document.body.classList.remove("ddopen"); }
function openDD(id){ const d=$("#"+id); if(!d) return; const was=!d.hidden; closeDD(); if(was) return;
  d.hidden=false; const b=$("#"+id+"-b"); if(b) b.setAttribute("aria-expanded","true"); const bk=$(".ddback"); if(bk) bk.hidden=false; document.body.classList.add("ddopen");
  const f=d.querySelector(".ddi"); if(f) f.focus({preventScroll:true}); }
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&$(".dd:not([hidden])")) closeDD(); });
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
      sb.from("team_members").select("thread_id,user_id,last_read_at"),
      sb.from("team_messages").select("id,thread_id,author_id,body,request_id,file_mime,file_name,file_size,created_at").gte("created_at",since).order("created_at").limit(3000),
      sb.from("reply_templates").select("*").order("title"),
      sb.from("binder_items").select("id,category,title,body,phone,url,file_mime,file_name,file_size,updated_by,updated_at,created_at").order("title")]);
    S.team2={threads:t.data||[],members:m.data||[],msgs:g.data||[]}; S.tpls=tp.data||[]; S.binder=b.data||[];
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
function teamHTML2(){
  const list=tSorted(), cur=S.team2.threads.find(t=>t.id===S.tthread)||null;
  const listHTML=`<div class="tlist"><button type="button" class="tnew" id="t-new">+ Nouvelle conversation</button>
    ${list.length?list.map(t=>{ const u=tUnread(t), last=tMsgs(t.id).slice(-1)[0]; return `<button type="button" class="trow ${t.id===S.tthread?"on":""} ${u?"unread":""}" data-thread="${t.id}">${tAvatar(t)}<span class="tx"><b>${esc(tTitle(t))}</b><small>${esc(tPreview(last))}</small></span><span class="tside"><small>${last?fmt(last.created_at):""}</small>${u?`<span class="sn">${u}</span>`:""}</span></button>`; }).join(""):`<div class="empty">Aucune conversation.</div>`}</div>`;
  const thHTML=cur?`<div class="tthread"><div class="thd"><button type="button" class="back tback" id="t-back" aria-label="Retour aux conversations">${IC.back}</button>${tAvatar(cur)}<div class="thinfo"><b>${esc(tTitle(cur))}</b><small>${esc(tMembers(cur.id).map(m=>m.user_id===S.me.id?"vous":staffName(m.user_id)).join(", "))}</small></div>
      ${cur.kind==="group"?`<button type="button" class="linkbtn" id="t-addm">Ajouter</button><button type="button" class="linkbtn" id="t-leave">Quitter</button>`:""}</div>
      <div class="tmsgs" id="tmsgs">${tMsgs(cur.id).map(tMsgHTML).join("")||`<p class="hint center">Écrivez le premier message.</p>`}</div>
      ${S.tattach&&S.tattach.thread===cur.id?`<div class="tattach">${reqCardHTML(S.tattach.id)}<button type="button" class="linkbtn" id="t-unreq">Retirer</button></div>`:""}
      <div class="tcomp"><button type="button" class="cbtn" id="t-req" title="Joindre une demande de patient" aria-label="Joindre une demande de patient">📋</button>${composerHTML("t"+cur.id)}</div>
      <p class="hint small">Messages effacés après 90 jours. Ne remplace pas le dossier médical.</p></div>`
    :`<div class="tthread empty-th"><p class="hint center">Choisissez une conversation, ou créez-en une nouvelle.</p></div>`;
  return `<div class="chead"><div><h1>Messages de l'équipe</h1><p>Conversations à deux ou en groupe. Jamais visibles par les patients.</p></div></div>
  <div class="tpane ${cur?"open":""}">${listHTML}${thHTML}</div>`;
}
let teamRtTimer=null;
function teamRt(){ clearTimeout(teamRtTimer); teamRtTimer=setTimeout(async()=>{ if(!S.me||S.me.role==="patient") return; await loadTeam();
  if(audioPlaying()){ updateBadges(); teamRt(); return; }
  const el=document.activeElement, typing=!!(el&&(el.tagName==="TEXTAREA"||el.tagName==="INPUT"));
  if(S.cscreen==="messages"&&S.tthread){ await sb.rpc("team_read",{p_thread:S.tthread}).then(()=>{ const me=tMembers(S.tthread).find(m=>m.user_id===S.me.id); if(me) me.last_read_at=new Date().toISOString(); }); }
  if(S.cscreen==="messages"&&typing&&$("#tmsgs")){ const t=S.team2.threads.find(x=>x.id===S.tthread); if(t){ $("#tmsgs").innerHTML=tMsgs(t.id).map(tMsgHTML).join(""); hydrateTeam(); tScroll(); } updateBadges(); }
  else if(S.cscreen==="messages"&&!S.pend&&!REC&&!CREC) render(); else updateBadges();
 },500); }
const tScroll = () => { const b=$("#tmsgs"); if(b) b.scrollTop=b.scrollHeight; };
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
function pickColleagues(title, exclude, done, withName){
  const others=(S.team||[]).filter(t=>t.status==="active"&&t.id!==S.me.id&&!exclude.includes(t.id)).sort((a,b)=>staffName(a.id).localeCompare(staffName(b.id)));
  const v=document.createElement("div"); v.className="modal"; v.setAttribute("role","dialog"); v.setAttribute("aria-modal","true");
  v.innerHTML=`<div class="mbox"><h2>${esc(title)}</h2>${withName?`<label class="fld">Nom du groupe (obligatoire si plusieurs collègues)<input id="pc-name" maxlength="60" placeholder="Ex. Médecins, Secrétariat…"></label>`:""}
    <input id="pc-q" class="pcq" placeholder="Rechercher un collègue…" aria-label="Rechercher un collègue">
    <div class="pclist">${others.map(t=>`<label class="chk2 pcrow" data-n="${esc(staffName(t.id).toLowerCase())}"><input type="checkbox" value="${t.id}"> ${esc(staffName(t.id))} <small>· ${ROLE_LABEL[t.role]}</small></label>`).join("")||`<p class="hint">Personne d'autre à ajouter.</p>`}</div>
    <div class="btnrow"><button class="btn" id="pc-ok">Valider</button><button class="btn ghost" id="pc-x">Annuler</button></div></div>`;
  document.body.appendChild(v); const close=()=>v.remove();
  v.querySelector("#pc-x").onclick=close; v.onclick=e=>{ if(e.target===v) close(); };
  v.querySelector("#pc-q").oninput=e=>{ const q=e.target.value.toLowerCase(); v.querySelectorAll(".pcrow").forEach(r=>r.hidden=!r.dataset.n.includes(q)); };
  v.querySelector("#pc-ok").onclick=async()=>{ const ids=[...v.querySelectorAll(".pcrow input:checked")].map(i=>i.value), name=withName?v.querySelector("#pc-name").value.trim():"";
    if(!ids.length) return toast("Choisissez au moins un collègue.");
    if(withName&&ids.length>1&&!name) return toast("Donnez un nom au groupe.");
    if(await done(ids,name)) close(); };
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
  $$("[data-thread]").forEach(b=>b.onclick=()=>{ S.tthread=+b.dataset.thread; const me=tMembers(S.tthread).find(m=>m.user_id===S.me.id); if(me) me.last_read_at=new Date().toISOString(); render(); sb.rpc("team_read",{p_thread:S.tthread}).then(()=>{}); });
  $("#t-new").onclick=()=>pickColleagues("Nouvelle conversation",[],async(ids,name)=>{ const {data,error}=await sb.rpc("team_start",{p_members:ids,p_title:name||null}); if(error){ toast(frError(error)); return false; } await loadTeam(); S.tthread=data; render(); return true; },true);
  const back=$("#t-back"); if(back) back.onclick=()=>{ S.tthread=null; render(); };
  const t=S.team2.threads.find(x=>x.id===S.tthread); if(!t) return;
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
   ["Le menu « Le centre »","Il regroupe ce qui concerne tout le centre : Actualités, Équipe, Classeur, Inventaire, Congés, Comptes à valider (selon votre rôle). Le chiffre rouge indique ce qui attend."],
   ["Trouver et trier les demandes","Onglet Demandes : « Les miennes / Secrétariat / Tout le centre » choisit les demandes affichées ; la recherche trouve un patient par son nom ; les pastilles colorées filtrent par type. Les demandes sont rangées par ce qu'il faut faire : urgent ou en retard, le patient a répondu, nouvelles. « En attente du patient » (vous avez répondu) est replié en bas. Les renouvellements simples peuvent être accordés à la suite dans « Prescriptions en série », après les avoir faits dans CareConnect."],
   ["Un patient sans compte dans l'app","Le centre → Fiches patients : créez une fiche (nom, prénom, date de naissance, téléphone, e-mail). Vous pouvez ensuite lui lier une tâche, en parler à un collègue (« En parler ») ou l'inviter par e-mail à créer son compte. Jamais de note médicale dans une fiche. Quand le patient s'inscrit, l'administrateur relie son compte à la fiche dans Comptes à valider."],
   ["Transférer avec un mot","Dans une demande, choisissez le collègue dans « Transférer à », écrivez un mot dans le champ en dessous, puis Transférer. Le collègue voit le mot en haut de la demande ; le patient ne le voit jamais."],
   ["Ne pas être dérangé(e)","Touchez la cloche en haut de l'écran (à côté de « Écrire à un patient »). « Pause des notifications » : 1 heure, jusqu'à demain 8 h ou jusqu'à ce que vous la retiriez ; les demandes arrivent toujours dans l'app et vous recevez un résumé à la fin de la pause. « Je suis absent(e) » : vos alertes vont au collègue choisi et les patients reçoivent un message automatique. Cloche barrée orange = en pause ; rouge = absent(e)."],
   ["Rappel avant l'échéance d'une tâche","Le centre → Tâches : mettez une échéance, cochez « Recevoir un rappel par e-mail » et choisissez quand (le jour même, la veille, 48 h, 72 h ou 1 semaine avant). L'e-mail part à 8 h vers la personne qui doit faire la tâche. Vous pouvez changer le rappel d'une tâche existante avec la petite cloche 🔔. Les tâches sont classées de la plus urgente à la moins urgente."],
   ["Ordinateur de confiance (accueil)","Au moment du code de sécurité, cochez « Faire confiance à cet ordinateur » : pendant 90 jours, l'e-mail et le mot de passe suffisent sur cet ordinateur, avec déconnexion après 2 heures d'inactivité. Uniquement sur un ordinateur du centre. Pour le retirer : Mon profil et notifications → Ordinateurs de confiance."],
   ["Valider les comptes des patients","Seul un administrateur valide les nouveaux comptes et les enfants ajoutés par un parent (Le centre → Comptes à valider). Un administrateur peut donner ces droits à n'importe quel membre de l'équipe (secrétariat compris) : Le centre → Équipe → case « Administrateur ». La personne garde son rôle."],
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
  if(sc==="compose") body=composeHTML(); else if(sc==="inventory") body=inventoryHTML(); else if(sc==="tasks") body=tasksHTML(); else if(sc==="accounts") body=accountsHTML(); else if(sc==="news") body=newsAdminHTML(); else if(sc==="team") body=teamHTML(); else if(sc==="settings") body=settingsHTML(); else if(sc==="help") body=staffHelpHTML(); else if(sc==="leaves") body=leavesHTML(); else if(sc==="patients") body=patientsHTML(); else if(sc==="messages") body=teamHTML2(); else if(sc==="templates") body=templatesHTML(); else if(sc==="binder") body=binderHTML(); else body=inboxHTML();
  document.body.classList.add("hasbar"); document.body.classList.remove("ddopen");
  a.innerHTML=nav+body;
  $("#logout").onclick=()=>{ closeDD(); logout(); };
  const c=$("#dd-centre-b"); if(c) c.onclick=e=>{ e.stopPropagation(); openDD("dd-centre"); };
  $("#dd-me-b").onclick=e=>{ e.stopPropagation(); openDD("dd-me"); };
  const ab=$("#avail-b"); if(ab) ab.onclick=e=>{ e.stopPropagation(); closeDD(); openAvail(); };
  $$("[data-dd]").forEach(b=>b.onclick=e=>{ e.stopPropagation(); openDD(b.dataset.dd); });
  const bk=$(".ddback"); if(bk) bk.onclick=closeDD;
  $$(".ddrosa").forEach(l=>l.addEventListener("click",()=>closeDD()));
  $$("[data-cs]").forEach(b=>b.onclick=()=>{ closeDD(); if(CREC&&b.dataset.cs!=="compose") composeRecStop(false); S.cscreen=b.dataset.cs; render(); window.scrollTo(0,0); });
  if(sc==="compose") bindCompose(); else if(sc==="inventory") bindInventory(); else if(sc==="tasks") bindTasks(); else if(sc==="accounts") bindAccounts(); else if(sc==="news") bindNewsAdmin(); else if(sc==="team") bindTeam(); else if(sc==="settings") bindSettings(); else if(sc==="help"||sc==="leaves") {} else if(sc==="patients") bindPatients(); else if(sc==="messages") bindTeam2(); else if(sc==="templates") bindTemplates(); else if(sc==="binder") bindBinder(); else bindInbox();
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
  return `<button class="row irow" data-sel="${r.id}" aria-current="${r.id===S.sel}"><div class="ic t-${r.type}" aria-hidden="true">${IEMO[r.type]||IC[r.type]}</div>
   <div class="itx"><b>${esc(reqName(r))}</b>${r.child_id?` <span class="ipill no">enfant</span>`:""}<small>${TYPES[r.type].label}${prev?" · "+esc(prev):""}</small>${durHTML(r)}${S.scope==="all"?`<small class="iwho">${esc(reqWho(r))}</small>`:""}</div>
   <div class="iside">${dueTagI(r)}<small>${r.status==="traite"?fmt(r.closed_at):ms.length?fmt(last.created_at):"reçue "+fmt(r.created_at)}</small></div></button>`; }
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
  else if(S.archive) body=list.map(irowHTML).join("");
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
   ${notesHTML(r)}
   ${r.purged_at?"":`<dl class="qa">${Object.entries(r.answers||{}).filter(([k])=>!HIDDEN_KEYS.has(k)).map(([k,v])=>`<div><dt>${esc(LABELS[k]||k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`}
   ${items.some(i=>i.decision)?`<div class="itemlist">${items.filter(i=>i.decision).map(i=>`<div><span>${esc(i.label)}<small class="qty">${qtyText(i.quantity||1)}</small></span><span class="dtag ${i.decision==="accorde"?"ok":"no"}">${i.decision==="accorde"?"Accordé":"Refusé"}</span></div>`).join("")}</div>`:""}
   ${msgsOf(r).length||r.purged_at||!open?chatHTML(r,"centre"):""}
   ${open?`${isRx?`<div class="rx"><p class="hint" style="margin:0">Décision par médicament</p>${todo.map(it=>`<div class="rxrow"><span>${esc(it.label)}<b class="qty">${qtyText(it.quantity||1)}</b></span><div class="decs"><button class="dec ok" aria-pressed="${dec[it.id]==="accorde"}" data-dec="${it.id}:accorde">Accorder</button><button class="dec no" aria-pressed="${dec[it.id]==="refuse"}" data-dec="${it.id}:refuse">Refuser</button></div></div>`).join("")}</div>`:""}
   ${composerHTML("s"+r.id)}
   <div class="btnrow"><button class="btn" id="close" ${canClose?"":"disabled"}>${closeBtn}</button></div>
   <p class="hint">Le message écrit ci-dessus est envoyé avec la clôture. <b>Avant de classer, reportez dans CareConnect ce qui doit rester au dossier</b> : la conversation et ses pièces jointes sont effacées ${PURGE_DAYS} jours après la clôture.</p>
   <div class="transfer">${r.status==="nouveau"?'<button class="linkbtn" id="take">Je m\'en occupe</button>':""}<label class="hint" for="tr">Transférer à</label><select id="tr">${transferOpts}</select><button class="linkbtn" id="dotr">Transférer</button>
    <textarea id="trnote" class="trnote" rows="2" maxlength="1000" placeholder="Un mot pour le collègue (facultatif) : visible seulement par l'équipe, jamais par le patient"></textarea></div>
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
  const tk=$("#take"); if(tk) tk.onclick=async()=>{ if(await run(()=>sb.rpc("take_request",{p_id:r.id}),"Demande prise en charge")) await refresh(); };
  $("#dotr").onclick=async()=>{ const v=$("#tr").value||null, note=($("#trnote")?.value||"").trim();
    if(note){ const tgt=v==="__admin"?"Administration":v?provName(v):"Secrétariat";
      const {error}=await sb.rpc("add_transfer_note",{p_id:r.id,p_body:note,p_target:tgt}); if(error){ toast("Le mot n'a pas pu être enregistré : "+frError(error)); return; } }
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
   ${C.files.length<5&&!CREC?`<div class="btnrow"><button type="button" class="btn ghost" id="cp-pick">${IC.clip} Joindre un PDF ou une photo</button><button type="button" class="btn ghost" id="cp-scan">${IC.scan} Scanner</button>${canRecord()&&!C.files.some(f=>f.kind==="audio")?`<button type="button" class="btn ghost" id="cp-mic">${IC.mic} Message vocal</button>`:""}</div>`:""}
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
  try{ mr=new MediaRecorder(stream, type?{mimeType:type}:undefined); }
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
  const [it,ph]=await Promise.all([sb.from("inventory_items").select("*").order("created_at",{ascending:false}).limit(300),
    sb.from("inventory_photos").select("id,item_id").limit(900)]);
  if(!it.error) S.inventory=it.data||[]; if(!ph.error) S.invPhotos=ph.data||[];
}
const newInv = () => ({title:"",qty:"",notes:"",urgent:false,photos:[],tab:"a_commander"});
function inventoryHTML(){
  const I=S.inv||(S.inv=newInv());
  const all=S.inventory||[], n=st=>all.filter(i=>i.status===st).length;
  const list=all.filter(i=>i.status===I.tab).sort((a,b)=>(b.urgent-a.urgent)||new Date(b.created_at)-new Date(a.created_at));
  const phs=id=>(S.invPhotos||[]).filter(p=>p.item_id===id);
  return `<div class="chead"><div><h1>Inventaire</h1><p>Le matériel et les consommables qui manquent au centre. Toute l'équipe voit cette liste ; le secrétariat passe commande et met à jour le statut.</p></div></div>
  <div class="inv">
   <section class="card invform"><h3>Signaler un besoin</h3>
    <label class="fld" for="inv-title">Ce qu'il faut<input id="inv-title" maxlength="200" autocomplete="off" placeholder="Ex. gel d'échographie" value="${esc(I.title)}"></label>
    <div class="row2"><label class="fld" for="inv-qty">Quantité (facultatif)<input id="inv-qty" maxlength="60" autocomplete="off" placeholder="Ex. 2 flacons de 250 ml" value="${esc(I.qty)}"></label>
     <label class="chk2 invurg"><input type="checkbox" id="inv-urg" ${I.urgent?"checked":""}> Urgent</label></div>
    <label class="fld" for="inv-notes">Précisions (facultatif)<textarea id="inv-notes" rows="2" maxlength="1000" placeholder="Marque, référence, fournisseur, taille…">${esc(I.notes)}</textarea></label>
    <div class="invphotos">${I.photos.map((p,i)=>`<div class="invph"><img src="${p.url}" alt="Photo ${i+1}"><button type="button" class="invrm" data-invrm="${i}" aria-label="Retirer la photo">✕</button></div>`).join("")}
     ${I.photos.length<3?`<button type="button" class="btn ghost" id="inv-pick">${IC.scan} Ajouter une photo</button>`:""}</div>
    <input type="file" id="inv-file" accept="image/*" hidden>
    <div class="btnrow"><button class="btn" id="inv-add" ${I.title.trim()?"":"disabled"}>Ajouter à la liste</button></div>
   </section>
   <div class="tabs">${Object.entries(INV_ST).map(([k,l])=>`<button class="tab" data-invtab="${k}" aria-pressed="${I.tab===k}">${l}${n(k)?`<span class="n">${n(k)}</span>`:""}</button>`).join("")}</div>
   <div class="list invlist">${list.length?list.map(it=>`<div class="invitem${it.urgent&&it.status!=="recu"?" isurg":""}">
     <div class="invtop"><b>${esc(it.title)}</b>${it.urgent&&it.status!=="recu"?`<span class="invtag">Urgent</span>`:""}${it.quantity?`<span class="invqty">${esc(it.quantity)}</span>`:""}</div>
     ${it.notes?`<p class="invnotes">${esc(it.notes)}</p>`:""}
     ${phs(it.id).length?`<div class="invphotos">${phs(it.id).map(p=>`<button type="button" class="invph" data-invph="${p.id}" aria-label="Agrandir la photo"><img alt=""></button>`).join("")}</div>`:""}
     <small class="invmeta">Demandé par ${esc(teamName(it.created_by))} · ${fmt(it.created_at)}${it.status!=="a_commander"&&it.status_at?` · ${INV_ST[it.status]} ${fmt(it.status_at)}${it.status_by?` (${esc(teamName(it.status_by))})`:""}`:""}</small>
     <div class="btnrow">${it.status==="a_commander"?`<button class="btn" data-invst="commande" data-id="${it.id}">Marquer commandé</button>`:""}${it.status==="commande"?`<button class="btn" data-invst="recu" data-id="${it.id}">Marquer reçu</button>`:""}${it.status!=="a_commander"?`<button class="btn ghost" data-invst="a_commander" data-id="${it.id}">Remettre à commander</button>`:""}${it.created_by===S.me.id||isDesk()||isGestion()?`<button class="linkbtn" data-invdel="${it.id}">Supprimer</button>`:""}</div>
    </div>`).join(""):`<div class="empty">${I.tab==="a_commander"?"Rien à commander pour l'instant.":I.tab==="commande"?"Aucune commande en cours.":"Rien de reçu ces 30 derniers jours."}</div>`}</div>
   <p class="hint">Les éléments reçus disparaissent de la liste après 30 jours.</p>
  </div>`;
}
function bindInventory(){
  const I=S.inv, t=$("#inv-title"), add=$("#inv-add");
  t.oninput=()=>{ I.title=t.value; add.disabled=!I.title.trim(); };
  $("#inv-qty").oninput=e=>{ I.qty=e.target.value; };
  $("#inv-notes").oninput=e=>{ I.notes=e.target.value; };
  $("#inv-urg").onchange=e=>{ I.urgent=e.target.checked; };
  const f=$("#inv-file"), pk=$("#inv-pick"); if(pk) pk.onclick=()=>f.click();
  f.onchange=async()=>{ const x=f.files[0]; f.value=""; if(!x) return;
    try{ const blob=await shrinkImage(x); if(blob.size>3*1048576) throw 0; I.photos.push({blob,url:URL.createObjectURL(blob)}); render(); }
    catch(e){ toast("Cette photo n'a pas pu être lue. Essayez une autre photo."); } };
  $$("[data-invrm]").forEach(b=>b.onclick=()=>{ const ph=I.photos.splice(+b.dataset.invrm,1)[0]; if(ph) URL.revokeObjectURL(ph.url); render(); });
  add.onclick=async()=>{ add.disabled=true; add.textContent="Ajout…";
    const r=await run(()=>sb.rpc("add_inventory_item",{p_title:I.title,p_quantity:I.qty||null,p_notes:I.notes||null,p_urgent:I.urgent}));
    if(!r){ add.disabled=false; add.textContent="Ajouter à la liste"; return; }
    let okAll=true;
    for(const ph of I.photos){ const d=await blobToB64(ph.blob); if(!await run(()=>sb.rpc("add_inventory_photo",{p_item:r.data,p_mime:"image/jpeg",p_data:d}))){ okAll=false; break; } }
    I.photos.forEach(ph=>URL.revokeObjectURL(ph.url)); S.inv=newInv();
    toast(okAll?"Ajouté à l'inventaire":"Ajouté, mais une photo n'a pas pu être envoyée."); await loadInventory(); render(); };
  $$("[data-invtab]").forEach(b=>b.onclick=()=>{ I.tab=b.dataset.invtab; render(); });
  $$("[data-invst]").forEach(b=>b.onclick=async()=>{ b.disabled=true;
    if(await run(()=>sb.rpc("set_inventory_status",{p_id:+b.dataset.id,p_status:b.dataset.invst}),"Statut mis à jour")){ await loadInventory(); render(); } else b.disabled=false; });
  $$("[data-invdel]").forEach(b=>b.onclick=async()=>{
    if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent="Confirmer la suppression"; return; }
    b.disabled=true; if(await run(()=>sb.rpc("delete_inventory_item",{p_id:+b.dataset.invdel}),"Supprimé")){ await loadInventory(); render(); } else b.disabled=false; });
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
const forMe = t => t.assigned_to===S.me.id || (t.assigned_group==="secretariat" && isDesk());
const myTasks = () => (S.tasks||[]).filter(t=>!t.done_at&&forMe(t));
const byDue = (a,b) => (a.due_date||"9999")<(b.due_date||"9999")?-1:(a.due_date||"9999")>(b.due_date||"9999")?1:new Date(b.created_at)-new Date(a.created_at);
function dueTag(t){ if(!t.due_date||t.done_at) return ""; const td=todayISO();
  const d=new Date(t.due_date+"T12:00").toLocaleDateString(LOC,{weekday:"short",day:"numeric",month:"short"});
  return t.due_date<td?`<span class="due late">En retard · ${d}</span>`:t.due_date===td?`<span class="due haute">Aujourd'hui</span>`:`<span class="due">Pour le ${d}</span>`; }
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
      <small>${t.assigned_group?"Pour : secrétariat":"Pour : "+esc(teamName(t.assigned_to))} · de ${esc(teamName(t.created_by))} · ${fmt(t.created_at)}${t.done_at?` · faite ${fmt(t.done_at)} par ${esc(teamName(t.done_by))}`:""}</small>${dueTag(t)}
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
     :`<div class="empty">${V==="todo"?`<span class="yay" aria-hidden="true">✨</span>Rien à faire pour l'instant.`:V==="given"?"Aucune tâche confiée en cours.":"Aucune tâche terminée (elles sont effacées après 90 jours)."}</div>`}</div>
  </section></div>`;
}
function bindTasks(){
  const D=S.tdraft, add=$("#tk-add");
  const upd=()=>{ add.disabled=!D.title.trim(); };
  $("#tk-title").oninput=e=>{ D.title=e.target.value; upd(); };
  $("#tk-notes").oninput=e=>{ D.notes=e.target.value; };
  $("#tk-to").onchange=e=>{ D.to=e.target.value; if(D.due&&D.remind!=null) render(); };
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
    if(D.due&&D.remind!=null){ const {error}=await sb.rpc("set_task_reminder",{p_id:r.data,p_days:D.remind});
      toast(error?"Tâche ajoutée, mais le rappel n'a pas pu être enregistré : "+frError(error):"Tâche ajoutée · rappel "+REMIND[D.remind].toLowerCase()); }
    if(pt&&!pt.record){ if(pt.child) S.children[pt.id]=pt; else S.profiles[pt.id]=pt; }
    S.tdraft=null; S.tview=D.to==="me"||(D.to==="secretariat"&&isDesk())?"todo":"given"; await refresh(); };
  $$("[data-tv]").forEach(b=>b.onclick=()=>{ S.tview=b.dataset.tv; render(); });
  $$("[data-tk]").forEach(b=>b.onclick=()=>{ S.tkind=b.dataset.tk; render(); });
  $$("[data-trem]").forEach(sl=>sl.onchange=async()=>{ const t=S.tasks.find(x=>x.id===+sl.dataset.trem), v=sl.value===""?null:+sl.value;
    if(await run(()=>sb.rpc("set_task_reminder",{p_id:t.id,p_days:v}),v==null?"Rappel retiré":"Rappel : "+REMIND[v].toLowerCase())){ t.remind_days=v; t.reminded_at=null; render(); } else render(); });
  $$("[data-tdone]").forEach(b=>b.onclick=async()=>{ const t=S.tasks.find(x=>x.id===+b.dataset.tdone), d=!t.done_at;
    if(await run(()=>sb.rpc("set_task_done",{p_id:t.id,p_done:d}),d?"Tâche faite":"Tâche remise à faire")){ t.done_at=d?new Date().toISOString():null; t.done_by=d?S.me.id:null; render(); } });
  $$("[data-tdel]").forEach(b=>b.onclick=async()=>{ if(b.dataset.sure!=="1"){ b.dataset.sure="1"; b.textContent="Confirmer ?"; b.style.color="var(--danger)"; return; }
    if(await run(()=>sb.rpc("delete_task",{p_id:+b.dataset.tdel}),"Tâche supprimée")){ S.tasks=S.tasks.filter(x=>x.id!==+b.dataset.tdel); render(); } });
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
async function shrinkImage(f){
  try{ const bm=await createImageBitmap(f); const sc=Math.min(1,1920/Math.max(bm.width,bm.height));
    if(sc===1&&f.size<=1.5e6) return f;
    const c=document.createElement("canvas"); c.width=Math.round(bm.width*sc); c.height=Math.round(bm.height*sc);
    const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); x.drawImage(bm,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",0.86)); if(!blob) return f;
    return new File([blob],f.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}); }catch(e){ return f; } }
async function uploadNewsImage(f){
  f=await shrinkImage(f);
  if(f.size>3e6) throw new Error("Image trop lourde (3 Mo maximum).");
  const path=`${Date.now()}-${f.name.replace(/[^\w.-]/g,"_")}`;
  const up=await sb.storage.from("announcements").upload(path,f,{contentType:f.type}); if(up.error) throw up.error;
  return sb.storage.from("announcements").getPublicUrl(path).data.publicUrl;
}
function bindNewsAdmin(){
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
function startRealtime(){
  if(RT||!sb.channel||!S.session||!S.me||S.me.status!=="active") return;
  try{
    RT=sb.channel("cmpl-"+S.me.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},p=>rtQueue(p.new&&p.new.request_id))
      .on("postgres_changes",{event:"*",schema:"public",table:"requests"},p=>rtQueue(p.new&&p.new.id))
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
    if(ids.length){ const {data,error}=await sb.from("requests").select(REQ_SELECT).in("id",ids); if(error) throw error;
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
