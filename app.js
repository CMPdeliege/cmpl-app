/* =====================================================================
   App patients — Centre Médical Prince de Liège
   Une seule app pour les patients et pour l'équipe : l'écran affiché
   dépend du rôle du compte (patient, secrétariat, prestataire, admin).
   Toute la sécurité est appliquée par la base (règles d'accès Supabase) :
   l'app ne fait qu'afficher ce que la base autorise.
   ===================================================================== */
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
const POUR_STEP = {id:"pour",kind:"choice",q:"C'est pour qui ?",options:()=>pourOptions(),when:()=>kids().length>0};
const KID_NOTE = {kind:"note",q:"Pour un enfant de moins de 16 ans : ajoutez-le d'abord dans Mon compte → Ma famille.",when:()=>!kids().length};
const FLOWS={
 rdv:[
  {id:"pour",kind:"choice",q:()=>`Bonjour ${S.me?.first_name||""}. Le rendez-vous est pour qui ?`,options:()=>pourOptions(),when:()=>kids().length>0},
  {id:"specialite",kind:"choice",q:"Pour quel type de consultation ?",options:()=>P.specs()},
  {id:"medecin",kind:"choice",q:"Avec qui ?",options:a=>[...P.of(a.specialite).map(P.label),"Peu importe, le premier disponible"],when:a=>P.of(a.specialite).length>1},
  // Médecine générale : motif, délai, détails, lieu
  {id:"motif",kind:"choice",q:"Quel est le motif principal ?",options:GP_MOTIFS,when:isGP},
  {id:"delai",kind:"choice",q:"Pour quand ?",options:["Aujourd'hui","Dans les prochains jours","Pas pressé (cette semaine ou plus tard)"],when:isGP},
  {id:"details",kind:"text",q:"Décrivez en quelques mots ce qui vous amène.",placeholder:"Ex. toux depuis 5 jours, un peu de fièvre le soir",optional:true,when:isGP},
  // Autres prestataires (spécialiste, dentiste, psychologue…) : première fois ou non, et la raison
  {id:"premiere",kind:"choice",q:"Est-ce la première fois que vous consultez ce prestataire ?",options:["Oui, c'est la première fois","Non, je l'ai déjà consulté"],when:a=>!isGP(a)},
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
  {kind:"note",q:"Le document sera vu dans les 72 heures (heures d'ouverture). Le prestataire vous répond ici ou vous propose un rendez-vous."}
];
["question","prescription","rapport","resultats","document"].forEach(k=>FLOWS[k].unshift(POUR_STEP));
FLOWS.rdv.push(KID_NOTE); FLOWS.question.push(KID_NOTE);
const LABELS={doc:"Document",fichiers:"Fichiers",note:"Message",de:"De",pour:"Pour",specialite:"Consultation",medecin:"Prestataire",motif:"Motif",delai:"Pour quand",details:"Détails",moment:"Disponibilités",lieu:"Lieu",
 sujet:"Sujet",depuis:"Depuis",texte:"Question",medicament:"Médicaments",historique:"Déjà prescrit",nouveau:"Choix",remarque:"Remarque",
 examen:"Examen",quand:"Date",demandeur:"Demandé par",contact:"Contact souhaité",
 premiere:"Première consultation",raison:"Raison",destinataire:"Rapport pour",echeance:"Pour quand"};
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
const PRIO_LABEL={haute:"Haute priorité",normale:"Pas pressé"};
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
  if(a.kind==="audio") return `<div class="att aud loading" data-att="${a.id}" data-kind="audio"><audio controls preload="metadata"></audio>${a.duration_s?`<small>${dur(a.duration_s)}</small>`:""}</div>`;
  return `<a class="att pdf loading" data-att="${a.id}" data-kind="pdf" href="#" download="${esc(a.name)}">${IC.doc}<span><b>${esc(a.name)}</b><small>PDF · ${kb(a.size)} · toucher pour ouvrir</small></span></a>`;
}
function chatHTML(r, viewer){
  const mine = m => viewer==="patient" ? m.from_patient : !m.from_patient;
  const dest = provName(r.provider_id)||"Secrétariat";
  let h=`<div class="chat" id="chat">`, day="", who="";
  const sep = d => { const l=dayLabel(d); if(l!==day){ day=l; who=""; h+=`<div class="day"><span>${esc(l)}</span></div>`; } };
  if(viewer==="patient" && !r.purged_at && r.type!=="centre"){
    sep(r.created_at);
    const dl=answersDL(r.answers);
    h+=`<div class="msg me"><div class="bub me reqcard"><b>${TYPES[r.type].title}</b>${dl?`<dl>${dl}</dl>`:""}<span class="t">${hm(r.created_at)}</span></div></div>`;
    if(r.status!=="traite") h+=`<div class="sys"><span>Envoyée à :</span> <b translate="no">${esc(dest)}</b><br><span>${r.priority==="haute"?"Elle sera vue dans les 24 heures (heures d'ouverture).":"Elle sera vue dans les 72 heures (heures d'ouverture)."}</span> <span>${r.provider_id?"Le délai de réponse est ensuite décidé par le prestataire.":"Le délai de réponse est ensuite décidé par le centre."}</span><br>Urgence vitale : 112.</div>`;
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
    return {url:URL.createObjectURL(new Blob([u8],{type:data.mime})), mime:data.mime, name:data.name}; })();
  ATT.set(id,p); p.catch(()=>ATT.delete(id)); return p;
}
function hydrateAtt(){
  $$("[data-att]:not([data-ready])").forEach(async el=>{
    el.dataset.ready="1";
    try{ const a=await attLoad(+el.dataset.att); el.classList.remove("loading");
      if(el.dataset.kind==="image"){ const img=el.querySelector("img"); img.onload=scrollChat; img.src=a.url; el.onclick=()=>openViewer(a.url); }
      else if(el.dataset.kind==="audio"){ const au=el.querySelector("audio"); au.onerror=()=>{ if(!el.querySelector(".attfail")) el.insertAdjacentHTML("beforeend",`<a class="attfail" href="${a.url}" download="message-vocal.${a.mime.includes("webm")?"webm":a.mime.includes("ogg")?"ogg":"m4a"}">Lecture impossible ici : télécharger le message vocal</a>`); }; au.src=a.url; }
      else { el.href=a.url; el.target="_blank"; el.rel="noopener"; }
    }catch(e){ console.error(e); el.classList.remove("loading"); el.classList.add("failed"); el.insertAdjacentHTML("beforeend",`<small class="attfail">Pièce jointe indisponible</small>`); }
  });
}
function openViewer(url){
  const v=document.createElement("div"); v.className="viewer"; v.setAttribute("role","dialog"); v.setAttribute("aria-label","Photo");
  v.innerHTML=`<img alt="Photo agrandie"><button class="cbtn" aria-label="Fermer">✕</button>`; v.querySelector("img").src=url;
  const close=()=>{ v.remove(); removeEventListener("keydown",esc_); }; const esc_=e=>{ if(e.key==="Escape") close(); };
  v.onclick=close; addEventListener("keydown",esc_); document.body.appendChild(v); v.querySelector("button").focus();
}
function scrollChat(){
  const c=$("#chat"); if(!c) return;
  if(c.closest(".detail")) c.scrollTop=c.scrollHeight; else scrollTo(0,document.body.scrollHeight);
}

/* ----- barre d'écriture : texte, pièce jointe, message vocal ----- */
function composerHTML(key){
  const draft=S.drafts[key]||"", pf=S.pend&&S.pend.key===key?S.pend:null;
  return `<div class="chatbar" id="chatbar">
   ${pf?`<div class="attprev">${pf.kind==="image"?`<img src="${pf.url}" alt="">`:IC.doc}<span><b>${esc(pf.name)}</b><small>${kb(pf.blob.size)} · prêt à envoyer</small></span><button type="button" class="cbtn sm" id="c-unatt" aria-label="Retirer la pièce jointe">✕</button></div>`:""}
   <div class="cbrow" id="cbrow">
    <button type="button" class="cbtn" id="c-att" aria-label="Joindre une photo ou un PDF" title="Photo ou PDF">${IC.clip}</button>
    <button type="button" class="cbtn" id="c-scan" aria-label="Scanner un document" title="Scanner un document">${IC.scan}</button>
    <input type="file" id="c-file" accept="image/*,application/pdf" hidden>
    <textarea id="c-text" rows="1" maxlength="4000" placeholder="${pf?"Ajouter un message (facultatif)":"Écrire un message"}" aria-label="Message">${esc(draft)}</textarea>
    <button type="button" class="cbtn go" id="c-go"></button>
   </div>
   <div class="recbar" id="recbar" hidden>
    <button type="button" class="cbtn" id="r-cancel" aria-label="Annuler le message vocal">${IC.trash}</button>
    <span class="recdot" aria-hidden="true"></span><span id="r-time" class="rtime">0:00</span><span class="lvl" aria-hidden="true"><i id="r-lvl"></i></span><span class="rech">Parlez… (3 min max.)</span>
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
  para(`Avec : ${provName(r.provider_id)||"Secrétariat"} · Commencée le ${fmtDate(r.created_at)}${r.closed_at?` · Clôturée le ${fmtDate(r.closed_at)}`:""}`,{size:10,color:GREY});
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
async function saveFile(blob,name){
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
  const finish=doSend=>{ if(!REC||REC.mr!==mr) return; clearInterval(REC.tick);
    mr.onstop=async()=>{ stream.getTracks().forEach(t=>t.stop()); const measured=!!(ac&&ac.state==="running"); try{ ac&&ac.close(); }catch(e){} REC=null; S.rec=false;
      const secs=Math.round((Date.now()-t0)/1000);
      if(!doSend) return render();
      if(secs<1||!chunks.length){ toast("Message vocal trop court."); return render(); }
      if(measured&&peak<0.02){ toast("Aucun son n'a été capté. Vérifiez que le micro est autorisé et non coupé, puis réessayez."); return render(); }
      const mime=((mr.mimeType||type||"audio/webm").split(";")[0]).replace("audio/x-m4a","audio/mp4").replace("audio/aac","audio/mp4");
      const ok=await send($("#c-text")?.value.trim()||"", {key,kind:"audio",mime,name:"Message vocal",blob:new Blob(chunks,{type:mime}),duration:secs});
      if(!ok) render(); };
    try{ mr.requestData(); }catch(e){}
    mr.stop(); };
  REC.tick=setInterval(()=>{ const s=Math.floor((Date.now()-t0)/1000), el=$("#r-time"); if(el) el.textContent=dur(s);
    if(an){ an.getByteTimeDomainData(buf); let m=0; for(const v of buf){ const d=Math.abs(v-128)/128; if(d>m) m=d; } peak=Math.max(peak,m);
      const lv=$("#r-lvl"); if(lv) lv.style.transform=`scaleX(${Math.min(1,0.08+m*2.5)})`; }
    if(s>=180) finish(true); },100);
  $("#r-cancel").onclick=()=>finish(false);
  $("#r-send").onclick=()=>finish(true);
  mr.start();
}
const patientName = id => { const p=S.profiles[id]; return p ? `${p.first_name||""} ${p.last_name||""}`.trim() || "Patient" : "Patient"; };
const kidName = id => { const c=S.children?.[id]; return c ? `${c.first_name} ${c.last_name}` : "Enfant"; };
const reqName = r => r.child_id ? kidName(r.child_id) : patientName(r.patient_id);

/* ---------- actualités ---------- */
function newsCard(n, full){
  return `<article class="news ${n.pinned?"pinned":""}">${n.image_path?`<img src="${esc(n.image_path)}" alt="">`:""}<div class="nbody"><div class="nmeta"><span class="ncat">${esc(n.category)}</span>${n.pinned?'<span class="ncat pin">Épinglé</span>':""}<span>${fmt(n.published_at)}</span></div><h3 translate="no" dir="auto">${esc(n.title)}</h3><p translate="no" dir="auto" class="${full?"":"clamp"}">${esc(n.body)}</p></div></article>`;
}

/* =====================================================================
   CHARGEMENT DES DONNÉES
   ===================================================================== */
async function loadPublic(){
  const [pr, oh, nw] = await Promise.all([
    sb.from("providers").select("id,display_name,specialty,job,is_physician,sort_order").order("sort_order"),
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
  if(S.me.status==="active"){ const f=await sb.rpc("my_family"); S.family=f.error?null:f.data; }
  await Promise.all([loadProviderAvatars(), loadAvatars([uid, ...S.reqs.flatMap(r=>(r.messages||[]).filter(m=>!m.from_patient).map(m=>m.author_id))])]);
}
async function loadStaff(){
  const role=S.me.role;
  const rq = await sb.from("requests").select(REQ_SELECT).order("created_at",{ascending:false}).limit(500);
  S.reqs = rq.data||[];
  const ids=[...new Set(S.reqs.map(r=>r.patient_id))];
  const tasks=[];
  if(ids.length) tasks.push(sb.from("profiles").select("id,first_name,last_name,birth_date,phone").in("id",ids).then(r=>{ for(const p of r.data||[]) S.profiles[p.id]=p; }));
  if(role==="secretariat"||role==="admin") tasks.push(sb.from("profiles").select("id,first_name,last_name,birth_date,phone,created_at").eq("role","patient").eq("status","pending").order("created_at").then(r=>S.pending=r.data||[]));
  tasks.push(sb.from("profiles").select("id,first_name,last_name,role,provider_id,status,created_at").neq("role","patient").then(r=>S.team=r.data||[]));
  tasks.push(sb.from("motif_durations").select("motif,minutes").then(r=>{ S.durations=Object.fromEntries((r.data||[]).map(d=>[d.motif,d.minutes])); }));
  tasks.push(sb.from("staff_settings").select("*").eq("user_id",S.me.id).maybeSingle().then(r=>S.settings=r.data));
  if(role==="secretariat"||role==="admin") tasks.push(sb.from("announcements").select("*").order("published_at",{ascending:false}).limit(100).then(r=>S.allNews=r.data||[]));
  if(role==="secretariat"||role==="admin") tasks.push(sb.rpc("news_audience").then(r=>S.audience=r.data));
  if(role==="secretariat"||role==="admin") tasks.push(sb.from("children").select("id,first_name,last_name,birth_date,status,created_by,created_at").eq("status","pending").is("removed_at",null).order("created_at").then(r=>S.pendingKids=r.data||[]));
  tasks.push(sb.from("tasks").select("*").order("created_at",{ascending:false}).limit(500).then(r=>S.tasks=r.data||[]));
  await Promise.all(tasks);
  // enfants (demandes, tâches) et parents à afficher
  const kidIds=[...new Set([...S.reqs.map(r=>r.child_id),...(S.tasks||[]).map(t=>t.child_id)].filter(Boolean))].filter(id=>!S.children[id]);
  if(kidIds.length){ const {data}=await sb.from("children").select("id,first_name,last_name,birth_date,status,created_by").in("id",kidIds); for(const c of data||[]) S.children[c.id]=c; }
  const more=[...new Set([...(S.pendingKids||[]).map(c=>c.created_by),...(S.tasks||[]).map(t=>t.patient_id)].filter(Boolean))].filter(id=>!S.profiles[id]);
  if(more.length){ const {data}=await sb.from("profiles").select("id,first_name,last_name,birth_date,phone").in("id",more); for(const p of data||[]) S.profiles[p.id]=p; }
  await Promise.all([loadProviderAvatars(), loadAvatars([S.me.id, ...ids, ...S.team.map(t=>t.id)])]);
  // Le premier onglet utile selon le rôle
  if(role==="provider") S.tab="prestataires";
}
async function refresh(){
  await loadPublic();
  if(!S.session){ S.me=null; render(); return; }
  await loadMe();
  if(!S.me){ render(); return; }
  syncLang();
  S.mfa=null;
  if(S.me.status==="active"&&S.me.role!=="patient"){
    if(idleTooLong()){ await logout("Vous avez été déconnecté après 30 minutes d'inactivité."); return; }
    const {data:aal}=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if(!aal||aal.currentLevel!=="aal2"){ S.mfa={hasFactor:aal&&aal.nextLevel==="aal2"}; render(); return; }
    markActive();
  }
  if(S.me.status==="active"){ if(S.me.role==="patient") await loadPatient(); else await loadStaff(); }
  render();
}

// L'équipe travaille toujours en français ; le patient retrouve sa langue sur tous ses appareils
function syncLang(){
  if(S.me.role!=="patient"){ if(L!=="fr") applyLang("fr"); return; }
  const saved=savedLang();
  if(!saved&&S.me.lang&&LANGS[S.me.lang]&&S.me.lang!==L){ try{ localStorage.setItem("cmpl_lang",S.me.lang); }catch(e){} applyLang(S.me.lang); }
  else if(S.me.lang!==L&&(saved||!S.me.lang)){ const l=L; S.me.lang=l; sb.from("profiles").update({lang:l}).eq("id",S.me.id).then(()=>{}); }
}
/* ---------- équipe : déconnexion après 30 minutes d'inactivité ---------- */
const IDLE_MS=30*60*1000;
function markActive(){ try{ localStorage.setItem("cmpl_last_active", String(Date.now())); }catch(e){} }
function idleTooLong(){ try{ const t=+localStorage.getItem("cmpl_last_active"); return t>0 && Date.now()-t>IDLE_MS; }catch(e){ return false; } }
let lastAct=Date.now(), lastSaved=0;
["pointerdown","keydown","touchstart","scroll"].forEach(ev=>addEventListener(ev,()=>{ lastAct=Date.now(); if(lastAct-lastSaved>60000){ lastSaved=lastAct; markActive(); } },{passive:true}));
setInterval(()=>{ if(S.me&&S.me.role!=="patient"&&S.session&&Date.now()-lastAct>IDLE_MS) logout("Vous avez été déconnecté après 30 minutes d'inactivité."); },60000);

/* ---------- équipe : double authentification ---------- */
function renderMfa(a){
  a.className="wrap";
  const enroll=!S.mfa.hasFactor;
  a.innerHTML=`<div class="top">${BRAND}<button class="iconbtn" id="logout" aria-label="Se déconnecter">${IC.user}</button></div>
  <div class="auth"><h1>${enroll?"Activer la double authentification":"Code de sécurité"}</h1>
  <p class="sub" style="margin:0">${enroll?"Les comptes de l'équipe donnent accès à des données de santé. Une étape de sécurité supplémentaire est obligatoire, une seule fois par appareil et par connexion.":"Ouvrez votre application d'authentification et entrez le code à 6 chiffres affiché pour « Centre Médical Prince de Liège »."}</p>
  <div class="form">
   ${enroll?`<ol class="legal" style="margin:0;padding-left:18px"><li>Installez sur votre téléphone une application d'authentification : <b>Google Authenticator</b> ou <b>Microsoft Authenticator</b> (gratuites).</li><li>Dans l'application, choisissez « Ajouter un compte », puis « Scanner un code QR ».</li><li>Scannez le code ci-dessous, puis entrez le code à 6 chiffres affiché.</li></ol>
   <div id="qr" style="display:grid;place-items:center;min-height:200px"><span class="hint">Préparation du code…</span></div>`:""}
   <label class="fld" for="mfa-code">Code à 6 chiffres<input id="mfa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"></label>
   <div id="mfa-msg"></div>
   <button class="btn full" id="mfa-go">${enroll?"Activer":"Valider"}</button>
  </div>
  <p class="hint">Téléphone perdu ou changé ? L'administrateur peut réinitialiser votre double authentification.</p></div>`;
  $("#logout").onclick=()=>logout();
  const msg=t=>$("#mfa-msg").innerHTML=`<div class="err">${esc(t)}</div>`;
  let factorId=null;
  (async()=>{
    const {data:lf}=await sb.auth.mfa.listFactors();
    if(enroll){
      for(const f of (lf?.all||[])) if(f.status!=="verified") await sb.auth.mfa.unenroll({factorId:f.id});
      const {data,error}=await sb.auth.mfa.enroll({factorType:"totp",issuer:"Centre Médical Prince de Liège",friendlyName:"CMPL "+new Date().toISOString().slice(0,16)});
      if(error){ console.error("MFA enroll",error); msg("La préparation du code a échoué (erreur "+(error.status||"?")+(error.code?" "+error.code:"")+"). "+(error.message&&error.message!=="{}"?frError(error):"")+" Réessayez dans un instant ; si cela persiste, prévenez l'administrateur."); return; }
      factorId=data.id;
      const raw=String(data.totp.qr_code||""), svg=raw.replace(/^data:image\/svg\+xml;[^,]*,/,""), qrSrc=svg.trim().startsWith("<")?"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg):raw;
      $("#qr").innerHTML=`<img src="${esc(qrSrc)}" alt="Code QR à scanner" style="width:200px;height:200px;background:#fff;padding:8px;border-radius:12px"><p class="hint" style="text-align:center;word-break:break-all">Impossible de scanner ? Entrez cette clé : <b>${esc(data.totp.secret)}</b></p>`;
    } else {
      factorId=(lf?.totp||[]).find(f=>f.status==="verified")?.id;
    }
  })();
  $("#mfa-code").focus();
  $("#mfa-go").onclick=async e=>{
    const code=$("#mfa-code").value.replace(/\D/g,"");
    if(code.length!==6) return msg("Entrez les 6 chiffres du code.");
    if(!factorId) return msg("Un instant, la préparation n'est pas terminée. Réessayez dans quelques secondes.");
    e.target.disabled=true;
    const {error}=await sb.auth.mfa.challengeAndVerify({factorId,code});
    if(error){ e.target.disabled=false; return msg(/invalid|expired/i.test(error.message)?"Code incorrect ou expiré. Entrez le code actuellement affiché.":frError(error)); }
    markActive(); lastAct=Date.now(); toast("Accès sécurisé activé"); await refresh();
  };
}

/* =====================================================================
   RENDU
   ===================================================================== */
function render(){
  if(REC) stopRec();
  draw(); hydrateAtt();
  if($("#chat")) requestAnimationFrame(scrollChat);
}
function draw(){
  const a=app();
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
<p><b>Pourquoi ?</b> Uniquement pour communiquer avec le centre : rendez-vous, questions, renouvellements de prescription, résultats. Base légale : la relation de soins (RGPD, art. 6.1.b et 9.2.h). Les notifications d'annonces du centre reposent sur votre accord, que vous pouvez retirer à tout moment (art. 6.1.a).</p>
<p><b>Qui les voit ?</b> Vous, et seulement les membres de l'équipe concernés par votre demande, tenus au secret professionnel. Chaque ouverture d'une conversation ou d'une pièce jointe par l'équipe est enregistrée. Aucune publicité, aucun traceur, aucune revente.</p>
<p><b>Où ?</b> Les données sont hébergées par Supabase dans l'Union européenne (Irlande), sous contrat de protection des données. Les pages de l'app sont fournies par GitHub, qui enregistre l'adresse IP des visiteurs à des fins de sécurité. Les e-mails de notification sont envoyés par Brevo (France, UE) et ne contiennent aucune information médicale.</p>
<p><b>Combien de temps ?</b> Une conversation est effacée 15 jours après sa clôture ; ce qui est utile à votre suivi est reporté par le prestataire dans votre dossier médical au centre, conservé selon la loi. Notifications : 90 jours. Compte non validé : 60 jours. Compte sans connexion pendant 3 ans : supprimé. Journal de sécurité : 5 ans.</p>
<p><b>Vos droits.</b> Accès, rectification, effacement, limitation, opposition, portabilité, retrait de votre accord. Dans « Mon compte », vous pouvez télécharger vos données et supprimer votre compte. Pour toute autre demande : admin@cmpl.be (réponse dans un délai d'un mois). Vous pouvez aussi introduire une plainte auprès de l'Autorité de protection des données (autoriteprotectiondonnees.be, rue de la Presse 35, 1000 Bruxelles).</p>
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
    <label class="fld" for="f-email">Adresse e-mail<input id="f-email" type="email" autocomplete="email" required></label>
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
  bindLangPicker();
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
function renderRecovery(a){
  a.className="wrap";
  a.innerHTML=`<div class="top">${BRAND}</div><div class="auth"><h1>Nouveau mot de passe</h1>
  <form class="form" id="recform"><label class="fld" for="r-pass">Nouveau mot de passe (8 caractères minimum)<input id="r-pass" type="password" autocomplete="new-password"></label><div id="r-msg"></div><button class="btn full" type="submit">Enregistrer</button></form></div>`;
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
async function logout(reason){ await sb.auth.signOut(); const keep=savedLang(); if(keep&&keep!==L) applyLang(keep); S.session=null; S.me=null; S.mfa=null; S.screen="home"; S.cscreen="inbox"; try{ localStorage.removeItem("cmpl_last_active"); }catch(e){} render(); if(typeof reason==="string") toast(reason); }

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
  return patientHome(a);
}
function topBar(){
  const unread=S.notifs.filter(n=>!n.read_at).length;
  return `<div class="top">${BRAND}<div class="menu"><button class="iconbtn bell" id="bell" aria-label="Notifications">${IC.bell}${unread?`<span class="badge">${unread}</span>`:""}</button><button class="iconbtn" id="acct" aria-label="Mon compte">${AV.get(S.me.id)?avatarHTML(AV.get(S.me.id),"",42):IC.user}</button></div></div>`;
}
function bindTop(){ $("#bell").onclick=()=>{S.screen="notifs";render()}; $("#acct").onclick=()=>{S.screen="account";render()}; }
function patientHome(a){
  const pinned=S.news.filter(n=>n.pinned), others=S.news.filter(n=>!n.pinned);
  const fk=famKids(), who=S.who&&(S.who==="me"||fk.some(c=>c.id===S.who))?S.who:"all";
  const forWho = x => who==="all" || (who==="me" ? !x.child_id : x.child_id===who);
  const mine=S.reqs.filter(forWho).sort((x,y)=>(x.status==="traite")-(y.status==="traite")||new Date(y.created_at)-new Date(x.created_at));
  const meds=S.meds.filter(forWho);
  const grown=fk.filter(c=>c.status==="active"&&c.age>=CHILD_MAX_AGE), waiting=fk.filter(c=>c.status==="pending");
  const chips=fk.length?`<div class="tabs whochips" role="group" aria-label="Afficher pour">${[["all","Tous"],["me","Moi"],...fk.map(c=>[c.id,c.first_name])].map(([id,l])=>`<button class="tab" data-who="${id}" aria-pressed="${who===id}">${esc(l)}</button>`).join("")}</div>`:"";
  const forTag = x => x.child_id ? ` · pour ${esc(childFirst(x.child_id))}` : "";
  a.innerHTML=`${topBar()}
  <h1 class="hello">Bonjour ${esc(S.me.first_name||"")}</h1>
  <p class="sub">Que pouvons-nous faire pour vous ?</p>
  ${S.me.news_choice_at?"":`<section class="consent" aria-labelledby="cq"><h2 id="cq">Annonces du centre</h2><p>Souhaitez-vous recevoir une notification pour les annonces importantes du centre (fermetures exceptionnelles, campagnes de vaccination) ?</p><p class="hint">Les réponses à vos demandes vous sont toujours notifiées. Vous pourrez changer d'avis à tout moment dans Notifications.</p><div class="btnrow"><button class="btn" data-consent="1">Oui, me prévenir</button><button class="btn ghost" data-consent="0">Non merci</button></div></section>`}
  ${pinned.map(n=>`<button class="newsbtn" data-news="${n.id}" style="margin-bottom:12px">${newsCard(n,false)}</button>`).join("")}
  ${BANNER112}
  ${grown.map(c=>`<div class="famnote"><b>${esc(c.first_name)} a ${c.age} ans.</b> Il ou elle doit maintenant créer son propre compte dans l'app pour ses demandes (Créer un compte, avec sa propre adresse e-mail).</div>`).join("")}
  ${waiting.length?`<div class="famnote soft">En attente de validation par le centre : ${waiting.map(c=>esc(c.first_name)).join(", ")}. Vous pourrez ensuite faire des demandes en son nom.</div>`:""}
  <div class="actions">${PATIENT_TYPES.map(k=>[k,TYPES[k]]).map(([k,t])=>`<button class="act" data-start="${k}"><div class="ic">${IC[k]}</div><b>${t.title}</b><span>${t.desc}</span></button>`).join("")}</div>
  ${others.length?`<div class="sechead"><h2>Actualités</h2><button class="linkbtn" id="allnews">Tout voir</button></div>
  <div class="newslist" style="margin-bottom:26px">${others.slice(0,2).map(n=>`<button class="newsbtn" data-news="${n.id}">${newsCard(n,false)}</button>`).join("")}</div>`:""}
  ${chips}
  <div class="sechead"><h2>${fk.length?"Médicaments":"Mes médicaments"}</h2><small class="hint">Accordés par votre médecin</small></div>
  <div class="list" style="margin-bottom:26px">${meds.length?meds.map(m=>`<div class="medrow"><div class="ic">${IC.prescription}</div><div><b>${esc(m.label)}</b><small>${m.child_id?`Pour ${esc(childFirst(m.child_id))} · `:fk.length?"Pour moi · ":""}Dernière prescription ${fmt(m.last_granted_at)} · ${m.times_granted} fois</small></div><div class="acts"><button class="mini" data-renew="${esc(m.label)}" data-renewkid="${m.child_id||""}">Renouveler</button><button class="linkbtn" style="font-size:12px;color:var(--muted)" data-forget="${m.id}">Retirer</button></div></div>`).join(""):`<div class="empty">Vos médicaments apparaîtront ici après votre première prescription accordée.</div>`}</div>
  <div class="sechead"><h2>${fk.length?"Demandes":"Mes demandes"}</h2></div>
  <div class="list">${mine.length?mine.map(r=>{const ms=msgsOf(r),last=ms[ms.length-1],unread=S.notifs.some(n=>n.request_id===r.id&&!n.read_at&&n.title!=="Demande bien reçue");
    const prev=r.purged_at?"Contenu effacé":last?(last.from_patient?"Vous : ":"")+msgPreview(last):summaryLine(r.answers);
    return `<button class="row chatrow ${unread?"unread":""}" data-req="${r.id}"><div class="ic">${IC[r.type]}</div><div><b>${esc(provName(r.provider_id)||"Secrétariat")} · ${TYPES[r.type].label}${forTag(r)}</b><small>${esc(prev)}</small></div><div class="rside"><small>${fmt(last?last.created_at:r.created_at)}</small>${unread?`<span class="dot" aria-label="Nouveau message"></span>`:`<span class="pill st-${stClassP(r)}">${stLabelP(r)}</span>`}</div></button>`}).join(""):`<div class="empty">Aucune demande pour l'instant.</div>`}</div>`;
  bindTop();
  $$("[data-start]").forEach(b=>b.onclick=()=>startFlow(b.dataset.start));
  $$("[data-consent]").forEach(b=>b.onclick=async()=>{ const ok=b.dataset.consent==="1";
    if(await run(()=>sb.rpc("set_news_consent",{p_ok:ok}),ok?"Vous serez prévenu des annonces importantes":"C'est noté : pas de notification pour les annonces")){ S.me.news_push=ok; S.me.news_choice_at=new Date().toISOString(); render(); } });
  $$("[data-news]").forEach(b=>b.onclick=()=>{S.openNews=+b.dataset.news;S.screen="news";render();scrollTo(0,0)});
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
  <div class="list">${S.notifs.length?S.notifs.map(n=>`<button class="row nrow ${n.read_at?"":"unread"}" data-n="${n.id}"><div class="ic">${n.announcement_id?IC.news:IC.bell}</div><div><b>${esc(n.title)}</b><small style="white-space:normal">${esc(n.body)}</small><small>${fmt(n.created_at)}</small></div><span></span></button>`).join(""):`<div class="empty">Aucune notification.</div>`}</div>`;
  $("#back").onclick=()=>{S.screen="home";render()};
  $("#emailnotif").onchange=async e=>{ const v=e.target.checked; if(await run(()=>sb.from("profiles").update({email_notify:v}).eq("id",S.me.id),v?"Vous serez prévenu par e-mail":"Plus d'e-mail de notification")) S.me.email_notify=v; else e.target.checked=!v; };
  $("#newspush").onchange=async e=>{ const v=e.target.checked; if(await run(()=>sb.rpc("set_news_consent",{p_ok:v}),v?"Annonces activées":"Annonces désactivées")){ S.me.news_push=v; S.me.news_choice_at=new Date().toISOString(); } else e.target.checked=!v; };
  $$("[data-n]").forEach(b=>b.onclick=async()=>{ const n=S.notifs.find(x=>x.id===+b.dataset.n);
    if(!n.read_at){ await sb.from("notifications").update({read_at:new Date().toISOString()}).eq("id",n.id); n.read_at=new Date().toISOString(); }
    if(n.request_id) openRequest(n.request_id); else if(n.announcement_id){ S.openNews=n.announcement_id; S.screen="news"; render(); } else render(); });
}
function patientAccount(a){
  const m=S.me;
  a.innerHTML=`<div class="convhead"><button class="back" id="back" aria-label="Retour">${IC.back}</button><div><h2>Mon compte</h2><small>${esc(S.session.user.email)}</small></div></div>
  <section class="card langcard"><h3>Langue de l'application</h3><p class="hint">Les messages restent écrits par le centre en français.</p>${langPickerHTML()}</section>
  ${photoCardHTML("Facultatif. Visible uniquement par vous et par l'équipe du centre, pour vous reconnaître.")}
  ${m.status==="active"?familyCardHTML():""}
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
  <div class="btnrow" style="margin-top:18px"><button class="btn ghost" id="logout">Se déconnecter</button></div>`;
  $("#back").onclick=()=>{S.screen="home";render()};
  $("#logout").onclick=logout;
  $("#export").onclick=exportMyData;
  $("#delask").onclick=()=>{ $("#delbox").hidden=false; $("#delconf").focus(); };
  $("#delno").onclick=()=>{ $("#delbox").hidden=true; $("#delconf").value=""; $("#delgo").disabled=true; };
  $("#delconf").oninput=e=>{ $("#delgo").disabled=e.target.value.trim().toUpperCase()!=="SUPPRIMER"; };
  $("#delgo").onclick=async e=>{ e.target.disabled=true;
    if(await run(()=>sb.rpc("delete_my_account"))){ await logout("Votre compte et ses données ont été supprimés."); } else e.target.disabled=false; };
  bindPhotoCard(); bindFamily(); bindLangPicker();
  $("#acctform").onsubmit=async e=>{ e.preventDefault();
    const upd={first_name:$("#a-first").value.trim(),last_name:$("#a-last").value.trim(),birth_date:$("#a-birth").value||null,phone:$("#a-phone").value.trim()};
    if(await run(()=>sb.from("profiles").update(upd).eq("id",m.id),"Enregistré")) Object.assign(S.me,upd); };
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
    destinataire:provName(r.provider_id)||"Secrétariat", reponses:Object.fromEntries(Object.entries(r.answers||{}).filter(([k])=>!HIDDEN_KEYS.has(k)).map(([k,v])=>[LABELS[k]||k,v])),
    medicaments:(r.request_items||[]).map(i=>({medicament:i.label,boites:i.quantity||1,decision:i.decision})),
    messages:msgsOf(r).map(m=>({de:m.from_patient?"Vous":m.author_label,le:m.created_at,texte:m.body,pieces_jointes:(m.attachments||[]).map(a=>({type:a.kind,nom:a.name,taille_octets:a.size}))})) });
  const data={ exporte_le:new Date().toISOString(), source:"Application du Centre Médical Prince de Liège (app.cmpl.be)",
    compte:{ email:S.session.user.email, prenom:S.me.first_name, nom:S.me.last_name, date_de_naissance:S.me.birth_date, telephone:S.me.phone, cree_le:S.me.created_at, valide_le:S.me.approved_at,
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
  if(!current) steps.filter(s=>s.kind==="note").forEach(s=>html+=`<div class="bub bot note">${esc(s.q)}</div>`);
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
    toast("Demande envoyée"); openRequest(r.data.id);
    loadPatient().then(()=>{ if(S.screen==="req") render(); });
  };
}
function patientReq(a){
  const r=S.reqs.find(x=>x.id===S.openReq); if(!r){ S.screen="home"; return draw(); }
  const items=(r.request_items||[]), key="p"+r.id;
  const itemsHTML = r.type==="prescription"&&items.some(i=>i.decision) ? `<div class="itemlist">${items.map(i=>`<div><span>${esc(i.label)}<small class="qty">${qtyText(i.quantity||1)}</small></span><span class="dtag ${i.decision==="accorde"?"ok":"no"}">${i.decision==="accorde"?"Prescrit":i.decision?"Non renouvelé":"En attente"}</span></div>`).join("")}</div>` : "";
  a.className="wrap chatpage";
  a.innerHTML=`<div class="convhead sticky"><button class="back" id="back" aria-label="Retour">${IC.back}</button>${PAV.get(r.provider_id)?avatarHTML(PAV.get(r.provider_id),"",40):`<div class="ic avatar">${IC[r.type]}</div>`}<div style="min-width:0"><h2>${esc(provName(r.provider_id)||"Secrétariat")}</h2><small>${TYPES[r.type].label}${r.child_id?` · pour ${esc(childFirst(r.child_id))}`:""} · ${stLabelP(r)}</small></div></div>
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
const ROLE_LABEL={secretariat:"Secrétariat",provider:"Prestataire",admin:"Administrateur",patient:"Patient"};
const isDesk = () => S.me.role==="secretariat"||S.me.role==="admin";
function renderStaff(a){
  a.className="wrap wide";
  const sc=S.cscreen;
  const nav=`<div class="top">${BRAND}<div class="menu">${AV.get(S.me.id)?avatarHTML(AV.get(S.me.id),"",34):""}<span class="who">${esc(S.me.first_name||"")} · ${ROLE_LABEL[S.me.role]}${S.me.provider_id?` · ${esc(provName(S.me.provider_id))}`:""}</span><button class="iconbtn" id="logout" aria-label="Se déconnecter" title="Se déconnecter">${IC.user}</button></div></div>
  <div class="nav">
   <button data-cs="inbox" aria-pressed="${sc==="inbox"}">Demandes<span class="n">${S.reqs.filter(awaitingStaff).length||""}</span></button>
   <button data-cs="compose" aria-pressed="${sc==="compose"}">Écrire à un patient</button>
   <button data-cs="tasks" aria-pressed="${sc==="tasks"}">Tâches<span class="n">${myTasks().length||""}</span></button>
   ${isDesk()?`<button data-cs="accounts" aria-pressed="${sc==="accounts"}">Comptes à valider<span class="n">${(S.pending.length+(S.pendingKids||[]).length)||""}</span></button>`:""}
   ${isDesk()?`<button data-cs="news" aria-pressed="${sc==="news"}">Actualités</button>`:""}
   ${S.me.role==="admin"?`<button data-cs="team" aria-pressed="${sc==="team"}">Équipe</button>`:""}
   <button data-cs="settings" aria-pressed="${sc==="settings"}">Mon profil</button>
   <button id="reload">Actualiser</button>
   <a class="navlink" href="${ROSA_PRO_URL}" target="_blank" rel="noopener" title="Ouvre votre agenda Rosa (connexion avec votre propre compte Rosa)">Mon agenda Rosa ↗</a>
  </div>`;
  let body="";
  if(sc==="compose") body=composeHTML(); else if(sc==="tasks") body=tasksHTML(); else if(sc==="accounts") body=accountsHTML(); else if(sc==="news") body=newsAdminHTML(); else if(sc==="team") body=teamHTML(); else if(sc==="settings") body=settingsHTML(); else body=inboxHTML();
  a.innerHTML=nav+body;
  $("#logout").onclick=logout;
  $("#reload").onclick=async()=>{ await refresh(); toast("Actualisé"); };
  $$("[data-cs]").forEach(b=>b.onclick=()=>{ S.cscreen=b.dataset.cs; render(); });
  if(sc==="compose") bindCompose(); else if(sc==="tasks") bindTasks(); else if(sc==="accounts") bindAccounts(); else if(sc==="news") bindNewsAdmin(); else if(sc==="team") bindTeam(); else if(sc==="settings") bindSettings(); else bindInbox();
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
function inboxList(){
  const inTab = r => r.queue===S.tab && (S.tab!=="prestataires"||S.provFilter==="tous"||r.provider_id===S.provFilter);
  const rank = r => r.status==="traite"?2:awaitingStaff(r)?0:1;
  const lastAt = r => { const m=msgsOf(r); return new Date(m.length?m[m.length-1].created_at:r.created_at); };
  return S.reqs.filter(inTab).filter(r=>S.archive?r.status==="traite":r.status!=="traite").filter(r=>S.archive||!S.short||isShort(r))
    .sort((x,y)=>rank(x)-rank(y)||(rank(x)===0?new Date(x.due_at)-new Date(y.due_at):lastAt(y)-lastAt(x)));
}
function inboxHTML(){
  const open=S.reqs.filter(r=>r.status!=="traite");
  const queues=[...new Set(S.reqs.map(r=>r.queue))];
  if(!queues.includes(S.tab) && queues.length) S.tab=queues[0];
  const list=inboxList();
  if(!list.find(r=>r.id===S.sel)) S.sel=list[0]?.id??null;
  const late=open.filter(r=>awaitingStaff(r)&&r.due_at&&new Date(r.due_at)<new Date()).length;
  const now=new Date();
  const provs=[...new Set(S.reqs.filter(r=>r.queue==="prestataires").map(r=>r.provider_id))].filter(Boolean);
  const nArch=S.reqs.filter(r=>r.queue===S.tab&&r.status==="traite").length;
  const nShort=S.reqs.filter(r=>r.queue===S.tab&&r.status!=="traite"&&isShort(r)&&(S.tab!=="prestataires"||S.provFilter==="tous"||r.provider_id===S.provFilter)).length;
  return `<div class="chead"><div><h1>Demandes des patients</h1><p>${now.toLocaleDateString(LOC,{weekday:"long",day:"numeric",month:"long"})} · ${isOpen(now)?'<span class="state on">Ouvert</span>':`<span class="state off">Fermé · réouverture ${fmtWhen(nextOpen(now))}</span>`}</p></div>
   <div class="counts"><div class="count"><b>${open.filter(r=>r.priority==="haute"&&awaitingStaff(r)).length}</b>haute priorité</div><div class="count"><b>${open.filter(r=>r.status==="nouveau").length}</b>nouvelles</div><div class="count"><b>${open.filter(newPatientMsg).length}</b>messages patients</div><div class="count ${late?"urg":""}"><b>${late}</b>en retard</div></div></div>
  ${queues.length>1?`<div class="tabs">${queues.map(q=>`<button class="tab" data-tab="${q}" aria-pressed="${S.tab===q}">${q==="secretariat"?"Secrétariat":"Prestataires"}<span class="n">${S.reqs.filter(r=>r.queue===q&&r.status!=="traite").length}</span></button>`).join("")}</div>`:""}
  ${S.tab==="prestataires"&&provs.length>1?`<div class="tabs">${["tous",...provs].map(id=>{const k=S.reqs.filter(r=>r.provider_id===id&&r.queue==="prestataires"&&r.status!=="traite").length;return `<button class="tab" data-pf="${id}" aria-pressed="${S.provFilter===id}" style="font-weight:400">${id==="tous"?"Tous":esc(provName(id))}${id!=="tous"&&k?`<span class="n">${k}</span>`:""}</button>`}).join("")}</div>`:""}
  <div class="seg" role="group" aria-label="Filtrer" style="margin-bottom:10px"><button id="f-open" aria-pressed="${!S.archive}">À traiter</button><button id="f-arch" aria-pressed="${S.archive}">Classées (${nArch})</button></div>${!S.archive&&(nShort||S.short)?` <button class="tab shortbtn" id="f-short" aria-pressed="${!!S.short}" title="Rendez-vous de médecine générale de 10 minutes ou moins">⏱ Rendez-vous courts (≤ 10 min)<span class="n">${nShort}</span></button>`:""}
  <div class="pane">
   <div class="list inbox">${list.length?list.map(r=>{const ms=msgsOf(r);return `<button class="row" data-sel="${r.id}" aria-current="${r.id===S.sel}"><span class="prio ${r.priority==="haute"&&awaitingStaff(r)?"on":""}"></span><div class="ic">${IC[r.type]}</div><div><b>${esc(reqName(r))}</b>${r.child_id?`<small class="kidtag">Enfant · demande de ${esc(patientName(r.patient_id))}</small>`:""}<small>${TYPES[r.type].label} · ${esc(summaryLine(r.answers))}</small>${durHTML(r)}<small>${ms.length?`${ms.length} message${ms.length>1?"s":""} · dernier ${fmt(ms[ms.length-1].created_at)}`:`Reçue ${fmt(r.created_at)}`}</small>${dueHTML(r)}</div><span class="pill st-${stClass(r)}">${stLabel(r)}</span></button>`}).join(""):`<div class="empty">${S.archive?"Aucune conversation classée.":"Rien à traiter."}</div>`}</div>
   <div id="detail">${detailHTML()}</div>
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
  const transferOpts=[`<option value="">Secrétariat</option>`,...S.providers.map(pv=>`<option value="${pv.id}" ${pv.id===r.provider_id?"selected":""}>${esc(P.label(pv))}</option>`)].join("");
  return `<div class="detail">
   <div class="dhead">${r.child_id?avatarHTML(null,reqName(r),52):avatarHTML(AV.get(r.patient_id),patientName(r.patient_id),52)}<div><h2>${esc(reqName(r))}</h2>
    ${r.child_id?`<div class="pinfo"><span>Né(e) le <b>${fmtDate(S.children[r.child_id]?.birth_date)}</b></span><span>Enfant de <b>${esc(patientName(r.patient_id))}</b></span><span>Tél. parent <b>${esc(p.phone||"—")}</b></span></div>`
    :`<div class="pinfo"><span>Né(e) le <b>${fmtDate(p.birth_date)}</b></span><span>Tél. <b>${esc(p.phone||"—")}</b></span></div>`}
    <div class="meta" style="margin-top:6px"><span class="tag">${TYPES[r.type].label}</span>${durHTML(r)}<span class="pill st-${stClass(r)}">${stLabel(r)}</span><span>Reçue ${fmt(r.created_at)} · ${esc(provName(r.provider_id)||"Secrétariat")}</span></div></div></div>
   ${open?`<div class="prioedit"><span class="hint">Priorité</span>${["haute","normale"].map(k=>`<button class="dec p-${k}" aria-pressed="${r.priority===k}" data-prio="${k}">${PRIO_LABEL[k]}</button>`).join("")}</div><div>${dueHTML(r)}</div>`:""}
   ${r.purged_at?"":`<dl class="qa">${Object.entries(r.answers||{}).filter(([k])=>!HIDDEN_KEYS.has(k)).map(([k,v])=>`<div><dt>${esc(LABELS[k]||k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`}
   ${items.some(i=>i.decision)?`<div class="itemlist">${items.filter(i=>i.decision).map(i=>`<div><span>${esc(i.label)}<small class="qty">${qtyText(i.quantity||1)}</small></span><span class="dtag ${i.decision==="accorde"?"ok":"no"}">${i.decision==="accorde"?"Accordé":"Refusé"}</span></div>`).join("")}</div>`:""}
   ${msgsOf(r).length||r.purged_at||!open?chatHTML(r,"centre"):""}
   ${open?`${isRx?`<div class="rx"><p class="hint" style="margin:0">Décision par médicament</p>${todo.map(it=>`<div class="rxrow"><span>${esc(it.label)}<b class="qty">${qtyText(it.quantity||1)}</b></span><div class="decs"><button class="dec ok" aria-pressed="${dec[it.id]==="accorde"}" data-dec="${it.id}:accorde">Accorder</button><button class="dec no" aria-pressed="${dec[it.id]==="refuse"}" data-dec="${it.id}:refuse">Refuser</button></div></div>`).join("")}</div>`:""}
   ${composerHTML("s"+r.id)}
   <div class="btnrow"><button class="btn" id="close" ${canClose?"":"disabled"}>${closeBtn}</button></div>
   <p class="hint">Le message écrit ci-dessus est envoyé avec la clôture. <b>Avant de classer, reportez dans CareConnect ce qui doit rester au dossier</b> : la conversation et ses pièces jointes sont effacées ${PURGE_DAYS} jours après la clôture.</p>
   <div class="transfer">${r.status==="nouveau"?'<button class="linkbtn" id="take">Je m\'en occupe</button>':""}<label class="hint" for="tr">Transférer à</label><select id="tr">${transferOpts}</select><button class="linkbtn" id="dotr">Transférer</button></div>
   <p class="hint">Envoyer garde la conversation ouverte. Pas de diagnostic ni de résultat détaillé par message : pour un problème médical, proposez un rendez-vous.</p>`
   :r.purged_at?`<div class="closed"><b>Contenu effacé le ${fmtDate(r.purged_at)}</b><span>Effacement automatique ${PURGE_DAYS} jours après la clôture.</span></div>`
   :`<div class="closed"><b>Classée ${r.closed_at?fmt(r.closed_at):""}</b><span>Le patient peut la relire mais plus y écrire. Effacement automatique le ${fmtDate(purgeDate(r))}.</span><button class="btn ghost" id="reopen">Rouvrir</button></div>`}
  </div>`;
}
const opened=new Set();
function bindInbox(){
  $$("[data-tab]").forEach(b=>b.onclick=()=>{ S.tab=b.dataset.tab; S.sel=null; render(); });
  $$("[data-pf]").forEach(b=>b.onclick=()=>{ S.provFilter=b.dataset.pf; S.sel=null; render(); });
  $("#f-open").onclick=()=>{ S.archive=false; S.sel=null; render(); };
  $("#f-arch").onclick=()=>{ S.archive=true; S.sel=null; render(); };
  const fs=$("#f-short"); if(fs) fs.onclick=()=>{ S.short=!S.short; S.sel=null; render(); };
  $$("[data-sel]").forEach(b=>b.onclick=()=>{ clearPend(); S.sel=+b.dataset.sel; render(); if(innerWidth<760) $("#detail").scrollIntoView({behavior:"smooth"}); });
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
  $$("[data-prio]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_request_priority",{p_id:r.id,p_priority:b.dataset.prio}),`Priorité : ${PRIO_LABEL[b.dataset.prio]}`)) await refresh(); });
  $$("[data-dec]").forEach(b=>b.onclick=()=>{ const [id,d]=b.dataset.dec.split(":"); dec[id]=dec[id]===d?undefined:d; if(!dec[id]) delete dec[id]; render(); });
  close.onclick=async()=>{ close.disabled=true; const text=($("#c-text")?.value||"").trim();
    const decisions={}; for(const [k,v] of Object.entries(dec)) decisions[k]=v;
    if(await run(()=>sb.rpc("close_request",{p_id:r.id,p_body:text||null,p_decisions:decisions}),"Conversation classée")){ S.drafts[key]=""; delete S.drafts["d"+r.id]; clearPend(); await refresh(); } else close.disabled=false; };
  const tk=$("#take"); if(tk) tk.onclick=async()=>{ if(await run(()=>sb.rpc("take_request",{p_id:r.id}),"Demande prise en charge")) await refresh(); };
  $("#dotr").onclick=async()=>{ const v=$("#tr").value||null;
    if(await run(()=>sb.rpc("transfer_request",{p_id:r.id,p_provider:v}),`Transférée : ${v?provName(v):"Secrétariat"}`)){ S.sel=null; await refresh(); } };
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
const patientPickRow = p => `<button type="button" class="row" data-pick="${p.id}"><div class="ic">${IC.user}</div><div><b>${esc(`${p.first_name||""} ${p.last_name||""}`)}</b><small>Né(e) le ${fmtDate(p.birth_date)} · ${p.child?"Enfant (via ses parents)":`Tél. ${esc(p.phone||"—")}`}</small></div><span></span></button>`;
function composeHTML(){
  const C=S.compose||(S.compose={patient:null,subject:SUBJECTS[0],body:"",files:[],reply:true,q:""}), pt=C.patient;
  const who=S.me.provider_id?provName(S.me.provider_id):"Secrétariat";
  return `<div class="chead"><div><h1>Écrire à un patient</h1><p>Pour un patient qui a un compte validé dans l'app. Il reçoit une notification neutre, sans contenu médical. Envoyé au nom de : <b>${esc(who)}</b>.</p></div></div>
  <div class="compose card">
   <h3>1. Destinataire</h3>
   ${pt?`<div class="recipient">${AV.get(pt.id)?avatarHTML(AV.get(pt.id),`${pt.first_name||""} ${pt.last_name||""}`,40):`<div class="ic">${IC.user}</div>`}<div><b>${esc(`${pt.first_name||""} ${pt.last_name||""}`)}</b><small>Né(e) le ${fmtDate(pt.birth_date)} · ${pt.child?"Enfant : le message va à ses parents dans l'app":`Tél. ${esc(pt.phone||"—")}`}</small></div><button type="button" class="linkbtn" id="cp-change">Changer</button></div>
     <p class="hint" style="margin:0">Vérifiez la date de naissance : un message au mauvais patient est une fuite de données.</p>`
   :`<label class="fld" for="cp-q">Nom ou prénom du patient<input id="cp-q" type="text" autocomplete="off" placeholder="Au moins 2 lettres" value="${esc(C.q)}"></label><div id="cp-res"></div>`}
   <h3>2. Message</h3>
   <label class="fld" for="cp-subj">Sujet<select id="cp-subj">${SUBJECTS.map(x=>`<option ${x===C.subject?"selected":""}>${x}</option>`).join("")}</select></label>
   <label class="fld" for="cp-body">Message au patient<textarea id="cp-body" rows="5" maxlength="4000" placeholder="Ex. Vos résultats de prise de sang sont normaux. Vous les trouverez en pièce jointe.">${esc(C.body)}</textarea></label>
   <div class="filelist">${C.files.map((f,i)=>`<div class="fileitem">${f.kind==="image"?`<img src="${f.url}" alt="">`:IC.doc}<span><b>${esc(f.name)}</b><small>${f.pages?f.pages+" page"+(f.pages>1?"s":"")+" · ":""}${kb(f.blob.size)}</small></span><button type="button" class="linkbtn" data-cprm="${i}">Retirer</button></div>`).join("")}</div>
   <input type="file" id="cp-file" accept="image/*,application/pdf" multiple hidden>
   ${C.files.length<5?`<div class="btnrow"><button type="button" class="btn ghost" id="cp-pick">${IC.clip} Joindre un PDF ou une photo</button><button type="button" class="btn ghost" id="cp-scan">${IC.scan} Scanner</button></div>`:""}
   <h3>3. Réponse</h3>
   <label class="chk2"><input type="radio" name="cp-r" value="1" ${C.reply?"checked":""}> Le patient peut répondre</label>
   <label class="chk2"><input type="radio" name="cp-r" value="0" ${C.reply?"":"checked"}> Pour information (classée d'emblée, le patient peut la lire mais pas répondre)</label>
   <div class="btnrow"><button class="btn" id="cp-send" ${pt&&C.body.trim()?"":"disabled"}>${pt?`Envoyer à ${esc(`${pt.first_name||""} ${pt.last_name||""}`.trim())}`:"Choisissez d'abord le patient"}</button><button type="button" class="btn ghost" id="cp-reset">Effacer</button></div>
  </div>`;
}
function bindCompose(){
  const C=S.compose;
  const upd=()=>{ const b=$("#cp-send"); if(b) b.disabled=!(C.patient&&C.body.trim()); };
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
  $("#cp-reset").onclick=()=>{ C.files.forEach(f=>f.url&&URL.revokeObjectURL(f.url)); S.compose=null; render(); };
  const send=$("#cp-send"); send.onclick=async()=>{ send.disabled=true; send.textContent="Envoi…";
    const r=await run(()=>sb.rpc("staff_start_conversation",{p_patient:C.patient.child?null:C.patient.id,p_subject:C.subject,p_body:C.body.trim(),p_child:C.patient.child?C.patient.id:null}));
    if(!r){ send.disabled=false; send.textContent="Réessayer"; return; }
    const id=r.data; let okAll=true;
    for(const f of C.files){ if(!await uploadAtt(id,f,null)){ okAll=false; break; } }
    if(!C.reply) await run(()=>sb.rpc("close_request",{p_id:id,p_body:null}));
    toast(okAll?"Message envoyé · patient notifié":"Message envoyé, mais une pièce jointe a échoué : ajoutez-la dans la conversation.");
    C.files.forEach(f=>f.url&&URL.revokeObjectURL(f.url)); S.compose=null;
    if(C.patient.child) S.children[C.patient.id]=C.patient; else S.profiles[C.patient.id]=C.patient; S.cscreen="inbox"; S.archive=!C.reply; await refresh();
    const nr=S.reqs.find(x=>x.id===id); if(nr){ S.tab=nr.queue; S.sel=id; render(); } };
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
function taskLinkHTML(t){ if(!t.patient_id&&!t.child_id) return "";
  const nm=t.child_id?kidName(t.child_id):patientName(t.patient_id), bd=t.child_id?S.children[t.child_id]?.birth_date:S.profiles[t.patient_id]?.birth_date;
  return `<span class="tasklink">${IC.user}<b>${esc(nm)}</b>${bd?` · né(e) le ${fmtDate(bd)}`:""}${t.child_id?" · enfant":""}</span>`; }
function tasksHTML(){
  const D=S.tdraft||(S.tdraft={title:"",notes:"",due:"",to:"me",patient:null,q:""}), V=S.tview||"todo";
  const all=S.tasks||[], todo=myTasks().sort(byDue), given=all.filter(t=>!t.done_at&&t.created_by===S.me.id&&!forMe(t)).sort(byDue),
        done=all.filter(t=>t.done_at).sort((a,b)=>new Date(b.done_at)-new Date(a.done_at));
  const list=V==="todo"?todo:V==="given"?given:done;
  const others=S.team.filter(t=>t.id!==S.me.id&&t.status==="active");
  const pt=D.patient;
  return `<div class="chead"><div><h1>Tâches</h1><p>Pour vous, pour un collègue ou pour tout le secrétariat. Une tâche peut être liée à un patient. Elle n'est visible que par vous et la ou les personnes qui doivent la faire.</p></div></div>
  <div class="taskgrid">
  <section class="card taskform"><h3>Nouvelle tâche</h3>
   <label class="fld">Tâche<input id="tk-title" maxlength="200" autocomplete="off" placeholder="Ex. Changer les filtres de la ventilation" value="${esc(D.title)}"></label>
   <label class="fld">Note (facultatif)<textarea id="tk-notes" rows="3" maxlength="2000" placeholder="Ex. Vérifier sa prise de sang et l'appeler si anomalie">${esc(D.notes)}</textarea></label>
   <div class="row2"><label class="fld">Pour<select id="tk-to"><option value="me" ${D.to==="me"?"selected":""}>Moi</option><option value="secretariat" ${D.to==="secretariat"?"selected":""}>Secrétariat (toute l'équipe du secrétariat)</option>${others.map(t=>`<option value="${t.id}" ${D.to===t.id?"selected":""}>${esc(`${t.first_name||""} ${t.last_name||""}`.trim())} · ${ROLE_LABEL[t.role]}</option>`).join("")}</select></label>
   <label class="fld">Échéance (facultatif)<input id="tk-due" type="date" value="${esc(D.due)}"></label></div>
   <div class="fld">Patient lié (facultatif)
   ${pt?`<div class="recipient">${`<div class="ic">${IC.user}</div>`}<div><b>${esc(`${pt.first_name||""} ${pt.last_name||""}`)}</b><small>Né(e) le ${fmtDate(pt.birth_date)}${pt.child?" · enfant":""}</small></div><button type="button" class="linkbtn" id="tk-unpick">Retirer</button></div>`
   :`<input id="tk-q" type="text" autocomplete="off" placeholder="Nom ou prénom (au moins 2 lettres)" value="${esc(D.q)}"><div id="tk-res"></div>`}</div>
   <div class="btnrow"><button class="btn" id="tk-add" ${D.title.trim()?"":"disabled"}>Ajouter la tâche</button></div>
  </section>
  <section>
   <div class="seg" role="group" aria-label="Afficher" style="margin-bottom:10px"><button data-tv="todo" aria-pressed="${V==="todo"}">À faire (${todo.length})</button><button data-tv="given" aria-pressed="${V==="given"}">Confiées (${given.length})</button><button data-tv="done" aria-pressed="${V==="done"}">Terminées</button></div>
   <div class="list tasks">${list.length?list.map(t=>`<div class="taskrow ${t.done_at?"done":""}">
     <button class="tcheck" data-tdone="${t.id}" aria-pressed="${!!t.done_at}" aria-label="${t.done_at?"Marquer comme à faire":"Marquer comme faite"}">${t.done_at?"✓":""}</button>
     <div><b>${esc(t.title)}</b>${t.notes?`<p class="tnotes">${esc(t.notes)}</p>`:""}${taskLinkHTML(t)}
      <small>${t.assigned_group?"Pour : secrétariat":"Pour : "+esc(teamName(t.assigned_to))} · de ${esc(teamName(t.created_by))} · ${fmt(t.created_at)}${t.done_at?` · faite ${fmt(t.done_at)} par ${esc(teamName(t.done_by))}`:""}</small>${dueTag(t)}</div>
     ${t.created_by===S.me.id?`<button class="linkbtn tdel" data-tdel="${t.id}">Supprimer</button>`:"<span></span>"}</div>`).join("")
     :`<div class="empty">${V==="todo"?"Rien à faire pour l'instant.":V==="given"?"Aucune tâche confiée en cours.":"Aucune tâche terminée (elles sont effacées après 90 jours)."}</div>`}</div>
  </section></div>`;
}
function bindTasks(){
  const D=S.tdraft, add=$("#tk-add");
  const upd=()=>{ add.disabled=!D.title.trim(); };
  $("#tk-title").oninput=e=>{ D.title=e.target.value; upd(); };
  $("#tk-notes").oninput=e=>{ D.notes=e.target.value; };
  $("#tk-to").onchange=e=>{ D.to=e.target.value; };
  $("#tk-due").onchange=e=>{ D.due=e.target.value; };
  const un=$("#tk-unpick"); if(un) un.onclick=()=>{ D.patient=null; render(); $("#tk-q")?.focus(); };
  const q=$("#tk-q");
  if(q){ let tm; const go=async()=>{ D.q=q.value; const words=norm(q.value).replace(/[*%,().]/g," ").split(/\s+/).filter(w=>w.length>=2), out=$("#tk-res");
      if(!words.length){ out.innerHTML=""; return; }
      const rows=await searchPatients(words); if(rows===null){ out.innerHTML=`<p class="hint">La recherche n'a pas fonctionné.</p>`; return; }
      out.innerHTML=rows.length?`<div class="list">${rows.map(patientPickRow).join("")}</div>`:`<p class="hint">Aucun patient ne correspond.</p>`;
      out.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{ D.patient=rows.find(p=>p.id===b.dataset.pick); render(); }); };
    q.oninput=()=>{ clearTimeout(tm); tm=setTimeout(go,300); }; if(D.q) go(); }
  add.onclick=async()=>{ add.disabled=true; const pt=D.patient;
    const r=await run(()=>sb.rpc("create_task",{p_title:D.title.trim(),p_notes:D.notes.trim()||null,p_due:D.due||null,
      p_assignee:D.to==="me"?S.me.id:D.to==="secretariat"?null:D.to,p_group:D.to==="secretariat"?"secretariat":null,
      p_patient:pt&&!pt.child?pt.id:null,p_child:pt&&pt.child?pt.id:null}),"Tâche ajoutée");
    if(!r){ upd(); return; }
    if(pt){ if(pt.child) S.children[pt.id]=pt; else S.profiles[pt.id]=pt; }
    S.tdraft=null; S.tview=D.to==="me"||(D.to==="secretariat"&&isDesk())?"todo":"given"; await refresh(); };
  $$("[data-tv]").forEach(b=>b.onclick=()=>{ S.tview=b.dataset.tv; render(); });
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
  <div class="list">${S.pending.length?S.pending.map(p=>`<div class="medrow"><div class="ic">${IC.user}</div><div><b>${esc((p.first_name||"")+" "+(p.last_name||""))}</b><small>Né(e) le ${fmtDate(p.birth_date)} · Tél. ${esc(p.phone||"—")} · inscrit ${fmt(p.created_at)}</small></div><div class="acts"><button class="mini" data-ok="${p.id}">Valider</button><button class="linkbtn" style="font-size:12px;color:var(--muted)" data-no="${p.id}">Refuser</button></div></div>`).join(""):`<div class="empty">Aucun compte en attente.</div>`}</div>`;
}
function bindAccounts(){
  $$("[data-kok]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_child_status",{p_child:b.dataset.kok,p_status:"active"}),"Enfant validé · parents prévenus")) await refresh(); });
  $$("[data-kno]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_child_status",{p_child:b.dataset.kno,p_status:"blocked"}),"Ajout refusé · parents prévenus")) await refresh(); });
  $$("[data-ok]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_patient_status",{p_patient:b.dataset.ok,p_status:"active"}),"Compte validé")) await refresh(); });
  $$("[data-no]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_patient_status",{p_patient:b.dataset.no,p_status:"blocked"}),"Compte refusé")) await refresh(); });
}

/* ----- équipe (administrateur) ----- */
function teamHTML(){
  const provOpts=sel=>`<option value="">— prestataire —</option>`+S.providers.map(p=>`<option value="${p.id}" ${p.id===sel?"selected":""}>${esc(P.label(p))}</option>`).join("");
  return `<div class="chead"><div><h1>Équipe</h1><p>Chaque membre de l'équipe crée d'abord son compte dans l'app (« Créer un compte »). Retrouvez-le ensuite ci-dessous et donnez-lui son rôle.</p></div></div>
  <section class="card" style="margin-bottom:12px"><h3>Donner un rôle à un compte</h3>
   <label class="fld" for="t-search">Nom de la personne inscrite<input id="t-search" type="text" placeholder="Tapez au moins 2 lettres du nom"></label>
   <div id="t-results"></div></section>
  <div class="list">${S.team.map(t=>`<div class="medrow">${avatarHTML(AV.get(t.id),`${t.first_name||""} ${t.last_name||""}`,32)}<div><b>${esc((t.first_name||"")+" "+(t.last_name||""))}</b><small>${ROLE_LABEL[t.role]}${t.provider_id?" · "+esc(provName(t.provider_id)):""}</small></div><div class="acts">${t.id!==S.me.id?`<button class="linkbtn" style="font-size:12px;color:var(--muted)" data-demote="${t.id}">Retirer de l'équipe</button>`:""}</div></div>`).join("")}</div>
  <template id="t-row"><div class="person" style="border-top:1px solid var(--line);padding-top:10px;margin-top:10px"><b class="t-name"></b><div class="pgrid"><label>Rôle<select class="t-role"><option value="secretariat">Secrétariat</option><option value="provider">Prestataire</option><option value="admin">Administrateur</option></select></label><label>Prestataire<select class="t-prov">${provOpts("")}</select></label></div><div class="btnrow"><button class="btn t-go">Enregistrer</button></div></div></template>`;
}
function bindTeam(){
  const inp=$("#t-search"), out=$("#t-results"); let timer;
  inp.oninput=()=>{ clearTimeout(timer); timer=setTimeout(async()=>{ const q=inp.value.trim(); out.innerHTML=""; if(q.length<2) return;
    const {data}=await sb.from("profiles").select("id,first_name,last_name,birth_date,role").or(`first_name.ilike.*${q.replace(/[*%,().]/g,"")}*,last_name.ilike.*${q.replace(/[*%,().]/g,"")}*`).limit(10);
    (data||[]).forEach(p=>{ const node=$("#t-row").content.cloneNode(true);
      node.querySelector(".t-name").textContent=`${p.first_name||""} ${p.last_name||""} · né(e) le ${fmtDate(p.birth_date)} · actuellement : ${ROLE_LABEL[p.role]}`;
      const role=node.querySelector(".t-role"), prov=node.querySelector(".t-prov"), go=node.querySelector(".t-go");
      go.onclick=async()=>{ if(await run(()=>sb.rpc("set_staff_role",{p_user:p.id,p_role:role.value,p_provider:prov.value||null}),"Rôle enregistré")) await refresh(); };
      out.appendChild(node); });
    if(!(data||[]).length) out.innerHTML=`<p class="hint">Aucun compte trouvé. La personne doit d'abord s'inscrire dans l'app.</p>`;
  },300); };
  $$("[data-demote]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_staff_role",{p_user:b.dataset.demote,p_role:"patient",p_provider:null}),"Retiré de l'équipe")) await refresh(); });
}

/* ----- actualités (secrétariat, administrateur) ----- */
const NEWS_CATS=["Fermeture","Horaires","Prévention","Nouveau au centre","Pratique"];
function newsAdminHTML(){
  const now=new Date(), ed=S.editNews?S.allNews.find(n=>n.id===S.editNews):null;
  const v=ed||{category:NEWS_CATS[0],title:"",body:"",pinned:false,expires_at:null,image_path:null};
  return `<div class="chead"><div><h1>Actualités</h1><p>Publiées dans l'app des patients. Informations pratiques uniquement, sans donnée personnelle.</p></div></div>
  <div class="pane">
   <form class="card ${ed?"editing":""}" id="newsform">
    <h3>${ed?"Modifier l'annonce":"Nouvelle annonce"}</h3>
    <label class="fld" for="n-title">Titre<input type="text" id="n-title" maxlength="80" required value="${esc(v.title)}"></label>
    <label class="fld" for="n-body">Texte<textarea id="n-body" rows="5" maxlength="800" required>${esc(v.body)}</textarea></label>
    <div class="pgrid"><label class="fld" for="n-cat">Catégorie<select id="n-cat">${NEWS_CATS.map(c=>`<option ${c===v.category?"selected":""}>${c}</option>`).join("")}</select></label>
    <label class="fld" for="n-exp">Retirer automatiquement le<input type="date" id="n-exp" value="${v.expires_at?esc(new Date(v.expires_at).toLocaleDateString("sv-SE")):""}"></label></div>
    ${ed&&v.image_path?`<div class="curimg"><img src="${esc(v.image_path)}" alt=""><label class="chk2"><input type="checkbox" id="n-noimg"> Retirer cette image</label></div>`:""}
    <label class="fld" for="n-img">${ed&&v.image_path?"Remplacer l'image (facultatif)":"Image (facultatif)"}<input type="file" id="n-img" accept="image/png,image/jpeg,image/webp"></label>
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
async function uploadNewsImage(f){
  if(f.size>3e6) throw new Error("Image trop lourde (3 Mo maximum).");
  const path=`${Date.now()}-${f.name.replace(/[^\w.-]/g,"_")}`;
  const up=await sb.storage.from("announcements").upload(path,f,{contentType:f.type}); if(up.error) throw up.error;
  return sb.storage.from("announcements").getPublicUrl(path).data.publicUrl;
}
function bindNewsAdmin(){
  const ed=S.editNews?S.allNews.find(n=>n.id===S.editNews):null;
  $("#newsform").onsubmit=async e=>{ e.preventDefault(); const btn=$("#n-pub"); btn.disabled=true;
    try{
      const title=$("#n-title").value.trim(), body=$("#n-body").value.trim(); if(!title||!body) throw new Error("Donnez un titre et un texte.");
      const exp=$("#n-exp").value, f=$("#n-img").files[0];
      const fields={title,body,category:$("#n-cat").value,pinned:$("#n-pin").checked,expires_at:exp?new Date(exp+"T23:59:00").toISOString():null};
      if(ed){
        if(f) fields.image_path=await uploadNewsImage(f); else if($("#n-noimg")?.checked) fields.image_path=null;
        const up=await sb.from("announcements").update(fields).eq("id",ed.id).select("id");
        if(up.error) throw up.error; if(!(up.data||[]).length) throw new Error("Modification refusée.");
        S.editNews=null; toast("Annonce modifiée"); await refresh();
      } else {
        fields.image_path=f?await uploadNewsImage(f):null; fields.notify=$("#n-notif").checked;
        const ins=await sb.from("announcements").insert(fields); if(ins.error) throw ins.error;
        toast("Annonce publiée"); await refresh();
      }
    }catch(err){ toast(frError(err)); btn.disabled=false; } };
  const c=$("#n-cancel"); if(c) c.onclick=()=>{ S.editNews=null; render(); };
  $$("[data-edit-news]").forEach(b=>b.onclick=()=>{ S.editNews=+b.dataset.editNews; render(); $("#newsform").scrollIntoView({behavior:"smooth",block:"start"}); $("#n-title").focus({preventScroll:true}); });
  $$("[data-pin]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.from("announcements").update({pinned:b.dataset.v==="1"}).eq("id",+b.dataset.pin),"Enregistré")) await refresh(); });
  $$("[data-del]").forEach(b=>b.onclick=async()=>{ if(S.editNews===+b.dataset.del) S.editNews=null; if(await run(()=>sb.from("announcements").delete().eq("id",+b.dataset.del),"Annonce retirée")) await refresh(); });
}

/* ----- mes notifications (équipe) ----- */
const SETOPTS=["Immédiate","2 fois par jour","Résumé du matin","Aucune"];
function settingsHTML(){
  const s=S.settings||{haute:"Immédiate",normale:"2 fois par jour",by_email:false,away:false,forward_to:null};
  const sel=(id,val)=>`<select id="${id}">${SETOPTS.map(o=>`<option ${o===val?"selected":""}>${o}</option>`).join("")}</select>`;
  const others=S.team.filter(t=>t.id!==S.me.id&&t.status==="active");
  return `<div class="chead"><div><h1>Mon profil et mes notifications</h1><p>Quand et comment vous êtes prévenu des nouvelles demandes et des messages de patients. Les notifications ne contiennent jamais de donnée médicale.</p></div></div>
  <div class="settings">
   ${photoCardHTML("Facultatif. Visible par les patients dans les conversations, et par l'équipe.")}
   <section class="card"><h3>Quand me prévenir</h3><div class="pgrid">
    <label class="fld">Haute priorité (à voir en moins de 24 h)${sel("s-haute",s.haute)}</label>
    <label class="fld">Pas pressé (à voir en moins de 72 h)${sel("s-normale",s.normale)}</label></div>
    <p class="hint">« 2 fois par jour » : à 11:00 et à 16:00. « Résumé du matin » : à 9:00. Rien n'est envoyé quand le centre est fermé.</p>
    <label class="chk2"><input type="checkbox" id="s-mail" ${s.by_email?"checked":""}> Aussi par e-mail</label></section>
   <section class="card"><h3>En cas d'absence</h3>
    <label class="chk2"><input type="checkbox" id="s-away" ${s.away?"checked":""}> Je suis absent(e)</label>
    <div id="s-awaybox" class="awaybox" ${s.away?"":"hidden"}>
     <label class="fld">Jusqu'au (inclus) — facultatif : l'absence s'arrête toute seule après cette date<input type="date" id="s-until" value="${s.away_until||""}"></label>
     <label class="fld">Renvoyer mes notifications vers<select id="s-fw"><option value="">Ne pas renvoyer</option>${others.map(t=>`<option value="${t.id}" ${t.id===s.forward_to?"selected":""}>${esc((t.first_name||"")+" "+(t.last_name||""))} · ${ROLE_LABEL[t.role]}</option>`).join("")}</select></label>
     ${S.me.provider_id?`<label class="chk2"><input type="checkbox" id="s-amsg" ${s.away_message?"checked":""}> Répondre automatiquement aux patients qui m'écrivent</label>
     <textarea id="s-msg" rows="5" maxlength="1000" ${s.away_message?"":"hidden"} aria-label="Message automatique">${esc(s.away_message||"")}</textarea>
     <p class="hint" id="s-msghint" ${s.away_message?"":"hidden"}>Envoyé une seule fois par conversation, signé « ${esc(provName(S.me.provider_id))} · message automatique ». Il ne compte pas comme une réponse : la demande reste à traiter.</p>`:""}
    </div></section>
   <div class="btnrow"><button class="btn" id="s-save">Enregistrer</button></div>
   <p class="hint">« Aussi par e-mail » : un résumé envoyé à votre adresse de connexion, sans nom de patient ni contenu médical. Les notifications sur le téléphone seront activées à une étape suivante.</p>
  </div>`;
}
function awayDefaultText(){
  const u=$("#s-until").value, fw=S.team.find(t=>t.id===$("#s-fw").value);
  const until=u?` jusqu'au ${new Date(u+"T12:00").toLocaleDateString(LOC,{weekday:"long",day:"numeric",month:"long"})} inclus`:"";
  return `Bonjour,\nJe suis absent(e)${until}. Votre message a bien été reçu${fw?` et sera traité par ${(fw.first_name||"")+" "+(fw.last_name||"")}`:" et sera traité à mon retour"}.\nPour une question qui ne peut pas attendre, appelez le secrétariat au 02 781 18 75. Urgence vitale : 112.`;
}
function bindSettings(){
  bindPhotoCard();
  const away=$("#s-away"), box=$("#s-awaybox"), am=$("#s-amsg"), msg=$("#s-msg"), hint=$("#s-msghint");
  if(msg) msg.dataset.auto=msg.value.trim()?"":"1";
  const fill=()=>{ if(msg&&msg.dataset.auto) msg.value=awayDefaultText(); };
  away.onchange=()=>{ box.hidden=!away.checked; };
  $("#s-until").onchange=fill; $("#s-fw").onchange=fill;
  if(am){ am.onchange=()=>{ msg.hidden=hint.hidden=!am.checked; if(am.checked){ if(!msg.value.trim()){ msg.dataset.auto="1"; fill(); } msg.focus(); } };
    msg.oninput=()=>{ msg.dataset.auto=""; }; }
  $("#s-save").onclick=async()=>{
    const row={user_id:S.me.id,haute:$("#s-haute").value,normale:$("#s-normale").value,by_email:$("#s-mail").checked,
      away:away.checked,away_until:$("#s-until").value||null,forward_to:$("#s-fw").value||null,
      away_message:am&&am.checked&&msg.value.trim()?msg.value.trim():null};
    if(row.away&&!row.forward_to&&!row.away_message) return toast(am?"Choisissez un collègue, ou activez le message automatique.":"Choisissez le collègue qui recevra vos notifications.");
    if(row.away_until&&row.away_until<new Date().toISOString().slice(0,10)) return toast("La date de retour est déjà passée.");
    if(await run(()=>sb.from("staff_settings").upsert(row),"Enregistré")) S.settings=row;
  };
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
async function autoRefresh(){ if(busy||!S.session||S.loading||document.hidden) return; const el=document.activeElement;
  if(el&&(el.tagName==="TEXTAREA"||el.tagName==="INPUT"||el.tagName==="SELECT")) return;
  if(S.screen==="flow"||S.rec||S.pend||S.editNews||S.cscreen==="compose"||S.cscreen==="settings"||S.cscreen==="tasks"||document.querySelector(".viewer,.scanner")) return; busy=true; try{ await refresh(); } finally{ busy=false; } }
setInterval(autoRefresh, 60000);
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) autoRefresh(); });
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
console.log("CMPL app version 20261016f");
})();
