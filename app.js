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

/* ---------- utilitaires ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const app = () => $("#app");
function toast(t){ const el=$("#toast"); el.textContent=t; el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>el.hidden=true,2600); }
function fmt(d){ d=new Date(d); const h=(Date.now()-d)/3600e3;
  if(h<1/60) return "à l'instant"; if(h<1) return `il y a ${Math.round(h*60)} min`; if(h<24) return `il y a ${Math.round(h)} h`;
  return d.toLocaleDateString("fr-BE",{day:"numeric",month:"short"}); }
function fmtWhen(d){ d=new Date(d); const c=new Date(), hm=d.toLocaleTimeString("fr-BE",{hour:"2-digit",minute:"2-digit"});
  const day=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(); const diff=Math.round((day(d)-day(c))/864e5);
  if(diff===0) return hm; if(diff===1) return "demain "+hm;
  return d.toLocaleDateString("fr-BE",{weekday:"short",day:"numeric",month:"short"})+" "+hm; }
const fmtDate = d => d ? new Date(d).toLocaleDateString("fr-BE") : "—";
function frError(e){
  const m = (e && (e.message || e.error_description || e.msg)) || String(e);
  const map = [
    [/Invalid login credentials/i, "Adresse e-mail ou mot de passe incorrect."],
    [/already registered|already been registered/i, "Un compte existe déjà avec cette adresse."],
    [/Email not confirmed/i, "Confirmez d'abord votre adresse e-mail (lien reçu par e-mail)."],
    [/Password should be at least/i, "Le mot de passe est trop court (8 caractères minimum)."],
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
 search:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
};
const BRAND = `<div class="brand"><div class="mark">CM</div><div><b>Centre Médical Prince de Liège</b><span>Anderlecht</span></div></div>`;
const BANNER112 = `<div class="urgent">${IC.alert}<div><strong>Urgence vitale :</strong> appelez le <span class="nums">112</span>.<br>Les demandes envoyées ici sont lues pendant les heures d'ouverture, pas en urgence.</div></div>`;

/* ---------- état ---------- */
const S = {
  session:null, me:null, providers:[], hours:{}, news:[], reqs:[], meds:[], notifs:[], profiles:{},
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
 resultats:{label:"Résultats",title:"Mes résultats",desc:"Signaler un examen dont vous attendez le résultat"}
};
const GP_MOTIFS=["Maladie aiguë (fièvre, toux, douleur…)","Suivi d'une maladie chronique","Certificat ou document","Bilan ou prévention","Vaccination","Autre"];
const OTHER_MOTIFS=["Première consultation","Consultation de suivi","Contrôle ou soin de routine","Douleur ou problème récent","Autre"];
const FLOWS={
 rdv:[
  {id:"pour",kind:"choice",q:()=>`Bonjour ${S.me?.first_name||""}. Le rendez-vous est pour qui ?`,options:["Pour moi","Pour mon enfant","Pour un autre membre de ma famille"]},
  {id:"specialite",kind:"choice",q:"Pour quel type de consultation ?",options:()=>P.specs()},
  {id:"medecin",kind:"choice",q:"Avec qui ?",options:a=>[...P.of(a.specialite).map(P.label),"Peu importe, le premier disponible"],when:a=>P.of(a.specialite).length>1},
  {id:"motif",kind:"choice",q:"Quel est le motif principal ?",options:a=>a.specialite==="Médecine générale"?GP_MOTIFS:OTHER_MOTIFS},
  {id:"delai",kind:"choice",q:"Pour quand ?",options:["Aujourd'hui","Dans les prochains jours","Pas pressé (cette semaine ou plus tard)"]},
  {id:"details",kind:"text",q:"Décrivez en quelques mots ce qui vous amène.",placeholder:"Ex. toux depuis 5 jours, un peu de fièvre le soir",optional:true},
  {id:"moment",kind:"multi",q:"Quels moments vous conviennent ?",options:["Matin","Midi","Après-midi","Fin de journée"]},
  {id:"lieu",kind:"choice",q:"Vous préférez :",options:["Consultation au centre","Visite à domicile","Téléconsultation"]}
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
  {kind:"note",q:"Pour votre sécurité, les résultats eux-mêmes ne sont pas envoyés dans l'application. Le centre vous contacte dès qu'ils sont analysés."}
 ]
};
const LABELS={pour:"Pour",specialite:"Consultation",medecin:"Prestataire",motif:"Motif",delai:"Pour quand",details:"Détails",moment:"Disponibilités",lieu:"Lieu",
 sujet:"Sujet",depuis:"Depuis",texte:"Question",medicament:"Médicaments",historique:"Déjà prescrit",nouveau:"Choix",remarque:"Remarque",
 examen:"Examen",quand:"Date",demandeur:"Demandé par",contact:"Contact souhaité"};
const HIDDEN_KEYS=new Set(["provider_id","medicaments"]);
const answersDL = a => Object.entries(a||{}).filter(([k])=>!HIDDEN_KEYS.has(k)).map(([k,v])=>`<dt>${esc(LABELS[k]||k)}</dt><dd>${esc(v||"—")}</dd>`).join("");
const summaryLine = a => a.motif||a.texte||a.medicament||a.examen||"";
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
const closedLabel = r => (r.request_items||[]).some(i=>i.decision==="accorde") ? "Prescription faite" : "Classée";
function stLabel(r){ if(r.status==="traite") return closedLabel(r); if(newPatientMsg(r)) return "Nouveau message"; if(!awaitingStaff(r)) return "En attente du patient"; return r.status==="nouveau"?"Nouveau":"En cours"; }
function stClass(r){ if(r.status==="traite") return "traite"; if(newPatientMsg(r)) return "nouveau"; if(!awaitingStaff(r)) return "wait"; return r.status; }
function stLabelP(r){ if(r.status==="traite") return closedLabel(r); if(r.last_from==="staff") return "Réponse reçue"; return r.status==="encours"?"En cours":"Envoyée"; }
function stClassP(r){ if(r.status==="traite") return "traite"; if(r.last_from==="staff") return "reply"; return "encours"; }
const PRIO_LABEL={haute:"Haute priorité",normale:"Pas pressé"};
function dueHTML(r){ if(r.status==="traite") return ""; if(!awaitingStaff(r)) return `<span class="due wait">En attente de la réponse du patient</span>`;
  const late = r.due_at && new Date(r.due_at) < new Date();
  return late ? `<span class="due late">En retard · prévu ${fmtWhen(r.due_at)}</span>` : `<span class="due ${r.priority}">${PRIO_LABEL[r.priority]} · à voir avant ${r.due_at?fmtWhen(r.due_at):"—"}</span>`; }
function threadHTML(r, viewer){
  const mine = m => viewer==="patient" ? m.from_patient : !m.from_patient;
  return `<div class="thread">${msgsOf(r).map(m=>`<div class="msg ${mine(m)?"me":"them"}"><small>${esc(m.from_patient&&viewer==="patient"?"Vous":m.author_label)} · ${fmt(m.created_at)}</small><div class="bub ${mine(m)?"me":"bot"}">${esc(m.body)}</div></div>`).join("")}</div>`;
}
const patientName = id => { const p=S.profiles[id]; return p ? `${p.first_name||""} ${p.last_name||""}`.trim() || "Patient" : "Patient"; };

/* ---------- actualités ---------- */
function newsCard(n, full){
  return `<article class="news ${n.pinned?"pinned":""}">${n.image_path?`<img src="${esc(n.image_path)}" alt="">`:""}<div class="nbody"><div class="nmeta"><span class="ncat">${esc(n.category)}</span>${n.pinned?'<span class="ncat pin">Épinglé</span>':""}<span>${fmt(n.published_at)}</span></div><h3>${esc(n.title)}</h3><p class="${full?"":"clamp"}">${esc(n.body)}</p></div></article>`;
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
const REQ_SELECT = "*, messages(id,from_patient,author_label,body,created_at), request_items(id,label,decision)";
async function loadPatient(){
  const uid=S.session.user.id;
  const [rq, md, nt] = await Promise.all([
    sb.from("requests").select(REQ_SELECT).eq("patient_id", uid).order("created_at",{ascending:false}).limit(100),
    sb.from("patient_meds").select("*").eq("patient_id", uid).order("last_granted_at",{ascending:false}),
    sb.from("notifications").select("*").eq("user_id", uid).order("created_at",{ascending:false}).limit(50)
  ]);
  S.reqs = rq.data||[]; S.meds = md.data||[]; S.notifs = nt.data||[];
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
  tasks.push(sb.from("staff_settings").select("*").eq("user_id",S.me.id).maybeSingle().then(r=>S.settings=r.data));
  if(role==="secretariat"||role==="admin") tasks.push(sb.from("announcements").select("*").order("published_at",{ascending:false}).limit(100).then(r=>S.allNews=r.data||[]));
  await Promise.all(tasks);
  // Le premier onglet utile selon le rôle
  if(role==="provider") S.tab="prestataires";
}
async function refresh(){
  await loadPublic();
  if(!S.session){ S.me=null; render(); return; }
  await loadMe();
  if(!S.me){ render(); return; }
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
<p>Vos données (identité, coordonnées, demandes et messages) servent uniquement à votre communication avec le Centre Médical Prince de Liège. Elles sont hébergées dans l'Union européenne (Francfort) et ne sont lisibles que par vous et par les membres de l'équipe concernés par votre demande. Chaque accès de l'équipe est enregistré. Vous pouvez demander à consulter, corriger ou supprimer vos données en écrivant à info@cmpl.be.</p>
<p><i>Texte provisoire, à valider par le centre avant l'ouverture aux patients.</i></p></details>`;
function renderAuth(a){
  a.className="wrap";
  const m=S.authMode;
  const pinned=S.news.filter(n=>n.pinned);
  a.innerHTML=`<div class="top">${BRAND}</div>
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
   ${BANNER112}
  </div>`;
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
  <h1 class="hello">Bonjour ${esc(S.me.first_name||"")}</h1>
  <div class="promise" style="margin:12px 0 18px;max-width:none"><b>Votre compte est en attente de validation</b><span>Le secrétariat vérifie que vous êtes bien patient du centre. Vous pourrez ensuite envoyer vos demandes. Revenez dans l'app après la validation.</span></div>
  ${BANNER112}
  ${S.news.length?`<div class="sechead"><h2>Actualités</h2></div><div class="newslist">${S.news.map(n=>newsCard(n,true)).join("")}</div>`:""}`;
  $("#logout").onclick=logout;
}
function renderBlocked(a){
  a.className="wrap";
  a.innerHTML=`<div class="top">${BRAND}<button class="iconbtn" id="logout" aria-label="Se déconnecter">${IC.user}</button></div>
  <div class="closed"><b>Compte non validé</b><span>Ce compte n'a pas pu être validé. Contactez le secrétariat au 02 781 18 75.</span></div>`;
  $("#logout").onclick=logout;
}
async function logout(reason){ await sb.auth.signOut(); S.session=null; S.me=null; S.mfa=null; S.screen="home"; S.cscreen="inbox"; try{ localStorage.removeItem("cmpl_last_active"); }catch(e){} render(); if(typeof reason==="string") toast(reason); }

/* =====================================================================
   PATIENT
   ===================================================================== */
function renderPatient(a){
  a.className="wrap";
  const sc=S.screen;
  if(sc==="flow") return patientFlow(a);
  if(sc==="sent") return patientSent(a);
  if(sc==="req") return patientReq(a);
  if(sc==="notifs") return patientNotifs(a);
  if(sc==="news") return patientNews(a);
  if(sc==="account") return patientAccount(a);
  return patientHome(a);
}
function topBar(){
  const unread=S.notifs.filter(n=>!n.read_at).length;
  return `<div class="top">${BRAND}<div class="menu"><button class="iconbtn bell" id="bell" aria-label="Notifications">${IC.bell}${unread?`<span class="badge">${unread}</span>`:""}</button><button class="iconbtn" id="acct" aria-label="Mon compte">${IC.user}</button></div></div>`;
}
function bindTop(){ $("#bell").onclick=()=>{S.screen="notifs";render()}; $("#acct").onclick=()=>{S.screen="account";render()}; }
function patientHome(a){
  const pinned=S.news.filter(n=>n.pinned), others=S.news.filter(n=>!n.pinned);
  const mine=S.reqs.slice().sort((x,y)=>(x.status==="traite")-(y.status==="traite")||new Date(y.created_at)-new Date(x.created_at));
  a.innerHTML=`${topBar()}
  <h1 class="hello">Bonjour ${esc(S.me.first_name||"")}</h1>
  <p class="sub">Que pouvons-nous faire pour vous ?</p>
  ${pinned.map(n=>`<button class="newsbtn" data-news="${n.id}" style="margin-bottom:12px">${newsCard(n,false)}</button>`).join("")}
  ${BANNER112}
  <div class="actions">${Object.entries(TYPES).map(([k,t])=>`<button class="act" data-start="${k}"><div class="ic">${IC[k]}</div><b>${t.title}</b><span>${t.desc}</span></button>`).join("")}</div>
  ${others.length?`<div class="sechead"><h2>Actualités</h2><button class="linkbtn" id="allnews">Tout voir</button></div>
  <div class="newslist" style="margin-bottom:26px">${others.slice(0,2).map(n=>`<button class="newsbtn" data-news="${n.id}">${newsCard(n,false)}</button>`).join("")}</div>`:""}
  <div class="sechead"><h2>Mes médicaments</h2><small class="hint">Accordés par votre médecin</small></div>
  <div class="list" style="margin-bottom:26px">${S.meds.length?S.meds.map(m=>`<div class="medrow"><div class="ic">${IC.prescription}</div><div><b>${esc(m.label)}</b><small>Dernière prescription ${fmt(m.last_granted_at)} · ${m.times_granted} fois</small></div><div class="acts"><button class="mini" data-renew="${esc(m.label)}">Renouveler</button><button class="linkbtn" style="font-size:12px;color:var(--muted)" data-forget="${m.id}">Retirer</button></div></div>`).join(""):`<div class="empty">Vos médicaments apparaîtront ici après votre première prescription accordée.</div>`}</div>
  <div class="sechead"><h2>Mes demandes</h2></div>
  <div class="list">${mine.length?mine.map(r=>{const ms=msgsOf(r),last=ms[ms.length-1];return `<button class="row" data-req="${r.id}"><div class="ic">${IC[r.type]}</div><div><b>${TYPES[r.type].label}</b><small>${esc(summaryLine(r.answers))} · ${fmt(last?last.created_at:r.created_at)}</small></div><span class="pill st-${stClassP(r)}">${stLabelP(r)}</span></button>`}).join(""):`<div class="empty">Aucune demande pour l'instant.</div>`}</div>`;
  bindTop();
  $$("[data-start]").forEach(b=>b.onclick=()=>startFlow(b.dataset.start));
  $$("[data-news]").forEach(b=>b.onclick=()=>{S.openNews=+b.dataset.news;S.screen="news";render();scrollTo(0,0)});
  const an=$("#allnews"); if(an) an.onclick=()=>{S.openNews=null;S.screen="news";render();scrollTo(0,0)};
  $$("[data-renew]").forEach(b=>b.onclick=()=>startFlow("prescription",[b.dataset.renew]));
  $$("[data-forget]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.from("patient_meds").delete().eq("id",+b.dataset.forget),"Retiré de vos médicaments")){ S.meds=S.meds.filter(m=>m.id!==+b.dataset.forget); render(); } });
  $$("[data-req]").forEach(b=>b.onclick=()=>openRequest(+b.dataset.req));
}
async function openRequest(id){
  S.openReq=id; S.screen="req"; render(); scrollTo(0,0);
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
  <label class="pref"><input type="checkbox" id="newspush" ${S.me.news_push?"checked":""}><span><b>Annonces importantes du centre</b><small>Fermetures exceptionnelles, campagnes de vaccination. Les réponses à vos demandes restent toujours notifiées.</small></span></label>
  <div class="list">${S.notifs.length?S.notifs.map(n=>`<button class="row nrow ${n.read_at?"":"unread"}" data-n="${n.id}"><div class="ic">${n.announcement_id?IC.news:IC.bell}</div><div><b>${esc(n.title)}</b><small style="white-space:normal">${esc(n.body)}</small><small>${fmt(n.created_at)}</small></div><span></span></button>`).join(""):`<div class="empty">Aucune notification.</div>`}</div>`;
  $("#back").onclick=()=>{S.screen="home";render()};
  $("#newspush").onchange=async e=>{ const v=e.target.checked; if(await run(()=>sb.from("profiles").update({news_push:v}).eq("id",S.me.id),v?"Annonces activées":"Annonces désactivées")) S.me.news_push=v; };
  $$("[data-n]").forEach(b=>b.onclick=async()=>{ const n=S.notifs.find(x=>x.id===+b.dataset.n);
    if(!n.read_at){ await sb.from("notifications").update({read_at:new Date().toISOString()}).eq("id",n.id); n.read_at=new Date().toISOString(); }
    if(n.request_id) openRequest(n.request_id); else if(n.announcement_id){ S.openNews=n.announcement_id; S.screen="news"; render(); } else render(); });
}
function patientAccount(a){
  const m=S.me;
  a.innerHTML=`<div class="convhead"><button class="back" id="back" aria-label="Retour">${IC.back}</button><div><h2>Mon compte</h2><small>${esc(S.session.user.email)}</small></div></div>
  <form class="form acct" id="acctform">
   <div class="row2"><label class="fld" for="a-first">Prénom<input id="a-first" value="${esc(m.first_name)}"></label><label class="fld" for="a-last">Nom<input id="a-last" value="${esc(m.last_name)}"></label></div>
   <div class="row2"><label class="fld" for="a-birth">Date de naissance<input id="a-birth" type="date" value="${esc(m.birth_date||"")}"></label><label class="fld" for="a-phone">Téléphone<input id="a-phone" type="tel" value="${esc(m.phone)}"></label></div>
   <button class="btn" type="submit">Enregistrer</button>
  </form>
  <div style="margin-top:14px">${PRIVACY}</div>
  <div class="btnrow" style="margin-top:18px"><button class="btn ghost" id="logout">Se déconnecter</button></div>`;
  $("#back").onclick=()=>{S.screen="home";render()};
  $("#logout").onclick=logout;
  $("#acctform").onsubmit=async e=>{ e.preventDefault();
    const upd={first_name:$("#a-first").value.trim(),last_name:$("#a-last").value.trim(),birth_date:$("#a-birth").value||null,phone:$("#a-phone").value.trim()};
    if(await run(()=>sb.from("profiles").update(upd).eq("id",m.id),"Enregistré")) Object.assign(S.me,upd); };
}

/* ----- formulaire guidé ----- */
function startFlow(k, preset){ S.flow=k; S.answers={}; S.drug={q:"",basket:preset?[...preset]:[],manual:false}; S.screen="flow"; render(); scrollTo(0,0); }
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
function answerUI(s){
  if(s.kind==="drug") return drugUI();
  if(s.kind==="choice") return `<div class="answer"><div class="opts">${optsOf(s).map(o=>`<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join("")}</div></div>`;
  if(s.kind==="multi") return `<div class="answer"><div class="opts">${optsOf(s).map(o=>`<button class="opt" aria-pressed="false" data-m="${esc(o)}">${esc(o)}</button>`).join("")}</div><div class="btnrow"><button class="btn" id="mnext" disabled>Continuer</button></div></div>`;
  return `<div class="answer"><label for="ta" class="hint">${s.optional?"Facultatif":"Votre réponse"}</label><textarea id="ta" rows="3" maxlength="2000" placeholder="${esc(s.placeholder||"")}"></textarea><div class="btnrow"><button class="btn" id="tnext" ${s.optional?"":"disabled"}>Continuer</button></div></div>`;
}
function bindAnswer(s){
  if(s.kind==="drug") return bindDrug(s);
  if(s.kind==="choice") $$("[data-o]").forEach(b=>b.onclick=()=>{ const v=b.dataset.o;
    if(s.jump&&s.jump[v]){ toast("On passe à la demande de rendez-vous"); startFlow(s.jump[v]); return; }
    S.answers[s.id]=v; render(); });
  if(s.kind==="multi"){ const btns=$$("[data-m]"), next=$("#mnext");
    btns.forEach(b=>b.onclick=()=>{ b.setAttribute("aria-pressed", b.getAttribute("aria-pressed")!=="true"); next.disabled=!btns.some(x=>x.getAttribute("aria-pressed")==="true"); });
    next.onclick=()=>{ S.answers[s.id]=btns.filter(b=>b.getAttribute("aria-pressed")==="true").map(b=>b.dataset.m).join(", "); render(); }; }
  if(s.kind==="text"){ const ta=$("#ta"), n=$("#tnext"); ta.focus({preventScroll:true});
    ta.oninput=()=>{ if(!s.optional) n.disabled=!ta.value.trim(); }; n.onclick=()=>{ S.answers[s.id]=ta.value.trim(); render(); }; }
}
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
  h+=`<p class="src">Liste officielle des médicaments disponibles en Belgique (CBIP).</p></div><div class="btnrow"><button class="btn" id="dnext" ${D.basket.length?"":"disabled"}>Continuer${D.basket.length>1?` avec ${D.basket.length} médicaments`:""}</button></div></div>`;
  return h;
}
function bindDrug(s){
  const D=S.drug, again=()=>{ render(); const f=$("#dq")||$("#dman"); if(f) f.focus({preventScroll:true}); };
  $$("[data-rm]").forEach(b=>b.onclick=()=>{ D.basket=D.basket.filter(x=>x!==b.dataset.rm); again(); });
  $$("[data-my]").forEach(b=>b.onclick=()=>{ const l=b.dataset.my; D.basket=D.basket.includes(l)?D.basket.filter(x=>x!==l):[...D.basket,l]; render(); });
  $("#dnext").onclick=()=>{ S.answers[s.id]=D.basket.join(" ; "); render(); };
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
    : `<div class="urgent">${IC.alert}<div><strong>Le centre est fermé.</strong> Votre demande sera vue à partir de ${fmtWhen(nextOpen(now))}.<br>Urgence vitale : appelez le <span class="nums">112</span>.</div></div>`;
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
    if(S.flow==="prescription") ans.medicaments=[...S.drug.basket];
    const r = await run(()=>sb.from("requests").insert({type:S.flow, answers:ans}).select(REQ_SELECT).single());
    if(!r){ e.target.disabled=false; return; }
    S.lastSent=r.data; S.reqs.unshift(r.data); S.screen="sent"; render(); scrollTo(0,0);
    loadPatient().then(()=>{ if(S.screen!=="flow") render(); });
  };
}
function patientSent(a){
  const r=S.lastSent, prov=provName(r.provider_id);
  a.innerHTML=`<div class="done"><div class="ok">${IC.check}</div><h2>Demande envoyée</h2><p>Transmise à : <b>${esc(prov||"Secrétariat")}</b>.</p>
  <div class="promise"><b>Votre demande sera vue ${r.priority==="haute"?"dans les 24 heures":"dans les 72 heures"}</b><span>${isOpen(new Date())?"":"Le centre est fermé : le délai démarre à l'ouverture. "}Le délai de réponse est ensuite décidé par ${prov?"le prestataire":"le centre"}, selon votre demande.</span><span>Urgence vitale : appelez le 112.</span></div>
  <div class="btnrow" style="justify-content:center"><button class="btn" id="home">Retour à l'accueil</button></div></div>`;
  $("#home").onclick=()=>{S.screen="home";render()};
}
function patientReq(a){
  const r=S.reqs.find(x=>x.id===S.openReq); if(!r){ S.screen="home"; return render(); }
  const open=r.status!=="traite", items=(r.request_items||[]);
  const itemsHTML = r.type==="prescription"&&r.status==="traite" ? `<div class="itemlist">${items.map(i=>`<div><span>${esc(i.label)}</span><span class="dtag ${i.decision==="accorde"?"ok":"no"}">${i.decision==="accorde"?"Prescrit":"Non renouvelé"}</span></div>`).join("")}</div>` : "";
  const ms=msgsOf(r), draft=S.drafts["p"+r.id]||"";
  a.innerHTML=`<div class="convhead"><button class="back" id="back" aria-label="Retour">${IC.back}</button><div><h2>${TYPES[r.type].label}</h2><small>Envoyée ${fmt(r.created_at)} · à ${esc(provName(r.provider_id)||"Secrétariat")}</small></div><span class="pill st-${stClassP(r)}" style="margin-left:auto">${stLabelP(r)}</span></div>
  <details class="summary" ${ms.length?"":"open"}><summary>Votre demande</summary><dl style="margin-top:10px">${answersDL(r.answers)}</dl></details>
  ${itemsHTML}${threadHTML(r,"patient")}
  ${!ms.length?`<p class="hint" style="margin-top:12px">Pas encore de réponse. Vous recevrez une notification.</p>`:""}
  ${open?`<div class="composer"><label for="pmsg" class="hint">Écrire au centre</label><textarea id="pmsg" rows="3" maxlength="4000" placeholder="Votre message">${esc(draft)}</textarea><div class="btnrow"><button class="btn" id="psend" ${draft.trim()?"":"disabled"}>Envoyer</button></div><p class="hint">Lu pendant les heures d'ouverture. Urgence vitale : appelez le 112.</p></div>`
  :`<div class="closed"><b>Conversation classée</b><span>Pour une nouvelle question, ouvrez une nouvelle demande.</span><button class="btn ghost" id="newq">Poser une nouvelle question</button></div>`}`;
  $("#back").onclick=()=>{S.screen="home";render()};
  if(open){ const ta=$("#pmsg"), b=$("#psend");
    ta.oninput=()=>{ S.drafts["p"+r.id]=ta.value; b.disabled=!ta.value.trim(); };
    b.onclick=async()=>{ b.disabled=true; const body=ta.value.trim();
      const res=await run(()=>sb.from("messages").insert({request_id:r.id, body}),"Message envoyé");
      if(res){ S.drafts["p"+r.id]=""; await loadPatient(); } else b.disabled=false; render(); };
  } else $("#newq").onclick=()=>startFlow("question");
}

/* =====================================================================
   ÉQUIPE
   ===================================================================== */
const ROLE_LABEL={secretariat:"Secrétariat",provider:"Prestataire",admin:"Administrateur",patient:"Patient"};
const isDesk = () => S.me.role==="secretariat"||S.me.role==="admin";
function renderStaff(a){
  a.className="wrap wide";
  const sc=S.cscreen;
  const nav=`<div class="top">${BRAND}<div class="menu"><span class="who">${esc(S.me.first_name||"")} · ${ROLE_LABEL[S.me.role]}${S.me.provider_id?` · ${esc(provName(S.me.provider_id))}`:""}</span><button class="iconbtn" id="logout" aria-label="Se déconnecter" title="Se déconnecter">${IC.user}</button></div></div>
  <div class="nav">
   <button data-cs="inbox" aria-pressed="${sc==="inbox"}">Demandes<span class="n">${S.reqs.filter(awaitingStaff).length||""}</span></button>
   ${isDesk()?`<button data-cs="accounts" aria-pressed="${sc==="accounts"}">Comptes à valider<span class="n">${S.pending.length||""}</span></button>`:""}
   ${isDesk()?`<button data-cs="news" aria-pressed="${sc==="news"}">Actualités</button>`:""}
   ${S.me.role==="admin"?`<button data-cs="team" aria-pressed="${sc==="team"}">Équipe</button>`:""}
   <button data-cs="settings" aria-pressed="${sc==="settings"}">Mes notifications</button>
   <button id="reload">Actualiser</button>
  </div>`;
  let body="";
  if(sc==="accounts") body=accountsHTML(); else if(sc==="news") body=newsAdminHTML(); else if(sc==="team") body=teamHTML(); else if(sc==="settings") body=settingsHTML(); else body=inboxHTML();
  a.innerHTML=nav+body;
  $("#logout").onclick=logout;
  $("#reload").onclick=async()=>{ await refresh(); toast("Actualisé"); };
  $$("[data-cs]").forEach(b=>b.onclick=()=>{ S.cscreen=b.dataset.cs; render(); });
  if(sc==="accounts") bindAccounts(); else if(sc==="news") bindNewsAdmin(); else if(sc==="team") bindTeam(); else if(sc==="settings") bindSettings(); else bindInbox();
}

/* ----- boîte de réception ----- */
function inboxList(){
  const inTab = r => r.queue===S.tab && (S.tab!=="prestataires"||S.provFilter==="tous"||r.provider_id===S.provFilter);
  const rank = r => r.status==="traite"?2:awaitingStaff(r)?0:1;
  const lastAt = r => { const m=msgsOf(r); return new Date(m.length?m[m.length-1].created_at:r.created_at); };
  return S.reqs.filter(inTab).filter(r=>S.archive?r.status==="traite":r.status!=="traite")
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
  return `<div class="chead"><div><h1>Demandes des patients</h1><p>${now.toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long"})} · ${isOpen(now)?'<span class="state on">Ouvert</span>':`<span class="state off">Fermé · réouverture ${fmtWhen(nextOpen(now))}</span>`}</p></div>
   <div class="counts"><div class="count"><b>${open.filter(r=>r.priority==="haute"&&awaitingStaff(r)).length}</b>haute priorité</div><div class="count"><b>${open.filter(r=>r.status==="nouveau").length}</b>nouvelles</div><div class="count"><b>${open.filter(newPatientMsg).length}</b>messages patients</div><div class="count ${late?"urg":""}"><b>${late}</b>en retard</div></div></div>
  ${queues.length>1?`<div class="tabs">${queues.map(q=>`<button class="tab" data-tab="${q}" aria-pressed="${S.tab===q}">${q==="secretariat"?"Secrétariat":"Prestataires"}<span class="n">${S.reqs.filter(r=>r.queue===q&&r.status!=="traite").length}</span></button>`).join("")}</div>`:""}
  ${S.tab==="prestataires"&&provs.length>1?`<div class="tabs">${["tous",...provs].map(id=>{const k=S.reqs.filter(r=>r.provider_id===id&&r.queue==="prestataires"&&r.status!=="traite").length;return `<button class="tab" data-pf="${id}" aria-pressed="${S.provFilter===id}" style="font-weight:400">${id==="tous"?"Tous":esc(provName(id))}${id!=="tous"&&k?`<span class="n">${k}</span>`:""}</button>`}).join("")}</div>`:""}
  <div class="seg" role="group" aria-label="Filtrer" style="margin-bottom:10px"><button id="f-open" aria-pressed="${!S.archive}">À traiter</button><button id="f-arch" aria-pressed="${S.archive}">Classées (${nArch})</button></div>
  <div class="pane">
   <div class="list inbox">${list.length?list.map(r=>{const ms=msgsOf(r);return `<button class="row" data-sel="${r.id}" aria-current="${r.id===S.sel}"><span class="prio ${r.priority==="haute"&&awaitingStaff(r)?"on":""}"></span><div class="ic">${IC[r.type]}</div><div><b>${esc(patientName(r.patient_id))}</b><small>${TYPES[r.type].label} · ${esc(summaryLine(r.answers))}</small><small>${ms.length?`${ms.length} message${ms.length>1?"s":""} · dernier ${fmt(ms[ms.length-1].created_at)}`:`Reçue ${fmt(r.created_at)}`}</small>${dueHTML(r)}</div><span class="pill st-${stClass(r)}">${stLabel(r)}</span></button>`}).join(""):`<div class="empty">${S.archive?"Aucune conversation classée.":"Rien à traiter."}</div>`}</div>
   <div id="detail">${detailHTML()}</div>
  </div>`;
}
function detailHTML(){
  const r=S.reqs.find(x=>x.id===S.sel); if(!r) return "";
  const p=S.profiles[r.patient_id]||{}, open=r.status!=="traite", items=r.request_items||[];
  const isRx=r.type==="prescription"&&open&&items.length;
  const dec=S.drafts["d"+r.id]||{}; const allDecided=isRx&&items.every(i=>dec[i.id]);
  const draft=S.drafts["s"+r.id]||"";
  const staffWrote=msgsOf(r).some(m=>!m.from_patient);
  const canClose=isRx?allDecided:(staffWrote||!!draft.trim());
  const closeBtn=!isRx?"Clôturer et classer":!allDecided?`Décidez pour chaque médicament (${items.filter(i=>dec[i.id]).length}/${items.length})`:items.some(i=>dec[i.id]==="accorde")?"Valider la prescription et classer":"Envoyer le refus et classer";
  const transferOpts=[`<option value="">Secrétariat</option>`,...S.providers.map(pv=>`<option value="${pv.id}" ${pv.id===r.provider_id?"selected":""}>${esc(P.label(pv))}</option>`)].join("");
  return `<div class="detail">
   <div><h2>${esc(patientName(r.patient_id))}</h2>
    <div class="pinfo"><span>Né(e) le <b>${fmtDate(p.birth_date)}</b></span><span>Tél. <b>${esc(p.phone||"—")}</b></span></div>
    <div class="meta" style="margin-top:6px"><span class="tag">${TYPES[r.type].label}</span><span class="pill st-${stClass(r)}">${stLabel(r)}</span><span>Reçue ${fmt(r.created_at)} · ${esc(provName(r.provider_id)||"Secrétariat")}</span></div></div>
   ${open?`<div class="prioedit"><span class="hint">Priorité</span>${["haute","normale"].map(k=>`<button class="dec p-${k}" aria-pressed="${r.priority===k}" data-prio="${k}">${PRIO_LABEL[k]}</button>`).join("")}</div><div>${dueHTML(r)}</div>`:""}
   <dl class="qa">${Object.entries(r.answers||{}).filter(([k])=>!HIDDEN_KEYS.has(k)).map(([k,v])=>`<div><dt>${esc(LABELS[k]||k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
   ${msgsOf(r).length?`<p class="hint" style="margin:0">Conversation</p>${threadHTML(r,"centre")}`:""}
   ${open?`${isRx?`<div class="rx"><p class="hint" style="margin:0">Décision par médicament</p>${items.map(it=>`<div class="rxrow"><span>${esc(it.label)}</span><div class="decs"><button class="dec ok" aria-pressed="${dec[it.id]==="accorde"}" data-dec="${it.id}:accorde">Accorder</button><button class="dec no" aria-pressed="${dec[it.id]==="refuse"}" data-dec="${it.id}:refuse">Refuser</button></div></div>`).join("")}</div>`:""}
   <label for="rep" class="hint">${isRx?"Message au patient (facultatif)":"Message au patient"}</label>
   <textarea id="rep" rows="3" maxlength="4000" placeholder="Votre réponse, une question pour préciser, ou une proposition de rendez-vous">${esc(draft)}</textarea>
   <div class="btnrow"><button class="btn ghost" id="sendmsg" ${draft.trim()?"":"disabled"}>Envoyer</button><button class="btn" id="close" ${canClose?"":"disabled"}>${closeBtn}</button></div>
   <div class="transfer">${r.status==="nouveau"?'<button class="linkbtn" id="take">Je m\'en occupe</button>':""}<label class="hint" for="tr">Transférer à</label><select id="tr">${transferOpts}</select><button class="linkbtn" id="dotr">Transférer</button></div>
   <p class="hint">« Envoyer » garde la conversation ouverte. « Clôturer et classer » la termine. Pas de diagnostic ni de résultat détaillé par message : pour un problème médical, proposez un rendez-vous.</p>`
   :`<div class="closed"><b>Classée ${r.closed_at?fmt(r.closed_at):""}</b><span>Le patient ne peut plus écrire dans cette conversation.</span><button class="btn ghost" id="reopen">Rouvrir</button></div>`}
  </div>`;
}
const opened=new Set();
function bindInbox(){
  $$("[data-tab]").forEach(b=>b.onclick=()=>{ S.tab=b.dataset.tab; S.sel=null; render(); });
  $$("[data-pf]").forEach(b=>b.onclick=()=>{ S.provFilter=b.dataset.pf; S.sel=null; render(); });
  $("#f-open").onclick=()=>{ S.archive=false; S.sel=null; render(); };
  $("#f-arch").onclick=()=>{ S.archive=true; S.sel=null; render(); };
  $$("[data-sel]").forEach(b=>b.onclick=()=>{ S.sel=+b.dataset.sel; render(); if(innerWidth<760) $("#detail").scrollIntoView({behavior:"smooth"}); });
  bindDetail();
}
function bindDetail(){
  const r=S.reqs.find(x=>x.id===S.sel); if(!r) return;
  if(!opened.has(r.id)){ opened.add(r.id); sb.rpc("mark_request_opened",{p_id:r.id}).then(()=>{}); }
  const ro=$("#reopen"); if(ro){ ro.onclick=async()=>{ if(await run(()=>sb.rpc("reopen_request",{p_id:r.id}),"Conversation rouverte")){ S.archive=false; await refresh(); } }; return; }
  const ta=$("#rep"), send=$("#sendmsg"), close=$("#close");
  const dec=S.drafts["d"+r.id]||(S.drafts["d"+r.id]={});
  ta.oninput=()=>{ S.drafts["s"+r.id]=ta.value; send.disabled=!ta.value.trim();
    if(!(r.type==="prescription"&&(r.request_items||[]).length)) close.disabled=!(msgsOf(r).some(m=>!m.from_patient)||ta.value.trim()); };
  $$("[data-prio]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.rpc("set_request_priority",{p_id:r.id,p_priority:b.dataset.prio}),`Priorité : ${PRIO_LABEL[b.dataset.prio]}`)) await refresh(); });
  $$("[data-dec]").forEach(b=>b.onclick=()=>{ const [id,d]=b.dataset.dec.split(":"); dec[id]=dec[id]===d?undefined:d; if(!dec[id]) delete dec[id]; render(); });
  send.onclick=async()=>{ send.disabled=true; if(await run(()=>sb.rpc("staff_message",{p_id:r.id,p_body:ta.value.trim()}),"Message envoyé · patient notifié")){ S.drafts["s"+r.id]=""; await refresh(); } else send.disabled=false; };
  close.onclick=async()=>{ close.disabled=true;
    const decisions={}; for(const [k,v] of Object.entries(dec)) decisions[k]=v;
    if(await run(()=>sb.rpc("close_request",{p_id:r.id,p_body:ta.value.trim()||null,p_decisions:decisions}),"Conversation classée")){ S.drafts["s"+r.id]=""; delete S.drafts["d"+r.id]; await refresh(); } else close.disabled=false; };
  const tk=$("#take"); if(tk) tk.onclick=async()=>{ if(await run(()=>sb.rpc("take_request",{p_id:r.id}),"Demande prise en charge")) await refresh(); };
  $("#dotr").onclick=async()=>{ const v=$("#tr").value||null;
    if(await run(()=>sb.rpc("transfer_request",{p_id:r.id,p_provider:v}),`Transférée : ${v?provName(v):"Secrétariat"}`)){ S.sel=null; await refresh(); } };
}

/* ----- comptes à valider ----- */
function accountsHTML(){
  return `<div class="chead"><div><h1>Comptes à valider</h1><p>Vérifiez que la personne est bien patiente du centre (nom, date de naissance, téléphone) avant de valider.</p></div></div>
  <div class="list">${S.pending.length?S.pending.map(p=>`<div class="medrow"><div class="ic">${IC.user}</div><div><b>${esc((p.first_name||"")+" "+(p.last_name||""))}</b><small>Né(e) le ${fmtDate(p.birth_date)} · Tél. ${esc(p.phone||"—")} · inscrit ${fmt(p.created_at)}</small></div><div class="acts"><button class="mini" data-ok="${p.id}">Valider</button><button class="linkbtn" style="font-size:12px;color:var(--muted)" data-no="${p.id}">Refuser</button></div></div>`).join(""):`<div class="empty">Aucun compte en attente.</div>`}</div>`;
}
function bindAccounts(){
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
  <div class="list">${S.team.map(t=>`<div class="medrow"><div class="ic">${IC.user}</div><div><b>${esc((t.first_name||"")+" "+(t.last_name||""))}</b><small>${ROLE_LABEL[t.role]}${t.provider_id?" · "+esc(provName(t.provider_id)):""}</small></div><div class="acts">${t.id!==S.me.id?`<button class="linkbtn" style="font-size:12px;color:var(--muted)" data-demote="${t.id}">Retirer de l'équipe</button>`:""}</div></div>`).join("")}</div>
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
  const now=new Date();
  return `<div class="chead"><div><h1>Actualités</h1><p>Publiées dans l'app des patients. Informations pratiques uniquement, sans donnée personnelle.</p></div></div>
  <div class="pane">
   <form class="card" id="newsform">
    <h3>Nouvelle annonce</h3>
    <label class="fld" for="n-title">Titre<input type="text" id="n-title" maxlength="80" required></label>
    <label class="fld" for="n-body">Texte<textarea id="n-body" rows="5" maxlength="800" required></textarea></label>
    <div class="pgrid"><label class="fld" for="n-cat">Catégorie<select id="n-cat">${NEWS_CATS.map(c=>`<option>${c}</option>`).join("")}</select></label>
    <label class="fld" for="n-exp">Retirer automatiquement le<input type="date" id="n-exp"></label></div>
    <label class="fld" for="n-img">Image (facultatif)<input type="file" id="n-img" accept="image/png,image/jpeg,image/webp"></label>
    <label class="chk2"><input type="checkbox" id="n-pin"> Épingler en haut de l'accueil</label>
    <label class="chk2"><input type="checkbox" id="n-notif"> Envoyer une notification aux patients <small class="hint">à réserver aux annonces importantes</small></label>
    <div class="btnrow"><button class="btn" type="submit" id="n-pub">Publier</button></div>
   </form>
   <section class="card"><h3>Annonces</h3>
    <div class="list">${S.allNews.length?S.allNews.map(n=>{const live=!n.expires_at||new Date(n.expires_at)>now;return `<div class="medrow"><div class="ic">${IC.news}</div><div><b>${esc(n.title)}</b><small>${esc(n.category)} · publiée ${fmt(n.published_at)}${n.expires_at?` · ${live?"jusqu'au":"expirée le"} ${fmtDate(n.expires_at)}`:""}${n.pinned?" · épinglée":""}</small></div><div class="acts"><button class="mini" data-pin="${n.id}" data-v="${n.pinned?0:1}">${n.pinned?"Désépingler":"Épingler"}</button><button class="linkbtn" style="font-size:12px;color:var(--muted)" data-del="${n.id}">Retirer</button></div></div>`}).join(""):`<div class="empty">Aucune annonce.</div>`}</div>
   </section>
  </div>`;
}
function bindNewsAdmin(){
  $("#newsform").onsubmit=async e=>{ e.preventDefault(); const btn=$("#n-pub"); btn.disabled=true;
    try{
      const title=$("#n-title").value.trim(), body=$("#n-body").value.trim(); if(!title||!body) throw new Error("Donnez un titre et un texte.");
      let image_path=null; const f=$("#n-img").files[0];
      if(f){ if(f.size>3e6) throw new Error("Image trop lourde (3 Mo maximum).");
        const path=`${Date.now()}-${f.name.replace(/[^\w.-]/g,"_")}`;
        const up=await sb.storage.from("announcements").upload(path,f,{contentType:f.type}); if(up.error) throw up.error;
        image_path=sb.storage.from("announcements").getPublicUrl(path).data.publicUrl; }
      const exp=$("#n-exp").value;
      const ins=await sb.from("announcements").insert({title,body,category:$("#n-cat").value,pinned:$("#n-pin").checked,notify:$("#n-notif").checked,image_path,expires_at:exp?new Date(exp+"T23:59:00").toISOString():null});
      if(ins.error) throw ins.error;
      toast("Annonce publiée"); await refresh();
    }catch(err){ toast(frError(err)); btn.disabled=false; } };
  $$("[data-pin]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.from("announcements").update({pinned:b.dataset.v==="1"}).eq("id",+b.dataset.pin),"Enregistré")) await refresh(); });
  $$("[data-del]").forEach(b=>b.onclick=async()=>{ if(await run(()=>sb.from("announcements").delete().eq("id",+b.dataset.del),"Annonce retirée")) await refresh(); });
}

/* ----- mes notifications (équipe) ----- */
const SETOPTS=["Immédiate","2 fois par jour","Résumé du matin","Aucune"];
function settingsHTML(){
  const s=S.settings||{haute:"Immédiate",normale:"2 fois par jour",by_email:false,away:false,forward_to:null};
  const sel=(id,val)=>`<select id="${id}">${SETOPTS.map(o=>`<option ${o===val?"selected":""}>${o}</option>`).join("")}</select>`;
  const others=S.team.filter(t=>t.id!==S.me.id&&t.status==="active");
  return `<div class="chead"><div><h1>Mes notifications</h1><p>Quand et comment vous êtes prévenu des nouvelles demandes et des messages de patients. Les notifications ne contiennent jamais de donnée médicale.</p></div></div>
  <div class="settings">
   <section class="card"><h3>Quand me prévenir</h3><div class="pgrid">
    <label class="fld">Haute priorité (à voir en moins de 24 h)${sel("s-haute",s.haute)}</label>
    <label class="fld">Pas pressé (à voir en moins de 72 h)${sel("s-normale",s.normale)}</label></div>
    <p class="hint">« 2 fois par jour » : à 11:00 et à 16:00. « Résumé du matin » : à 9:00. Rien n'est envoyé quand le centre est fermé.</p>
    <label class="chk2"><input type="checkbox" id="s-mail" ${s.by_email?"checked":""}> Aussi par e-mail</label></section>
   <section class="card"><h3>Absence</h3>
    <label class="chk2"><input type="checkbox" id="s-away" ${s.away?"checked":""}> Je suis absent : renvoyer mes notifications vers</label>
    <select id="s-fw"><option value="">— choisir un collègue —</option>${others.map(t=>`<option value="${t.id}" ${t.id===s.forward_to?"selected":""}>${esc((t.first_name||"")+" "+(t.last_name||""))} · ${ROLE_LABEL[t.role]}</option>`).join("")}</select></section>
   <div class="btnrow"><button class="btn" id="s-save">Enregistrer</button></div>
   <p class="hint">Les notifications sur le téléphone seront activées à l'étape suivante de la mise en place.</p>
  </div>`;
}
function bindSettings(){
  $("#s-save").onclick=async()=>{
    const row={user_id:S.me.id,haute:$("#s-haute").value,normale:$("#s-normale").value,by_email:$("#s-mail").checked,away:$("#s-away").checked,forward_to:$("#s-fw").value||null};
    if(row.away&&!row.forward_to) return toast("Choisissez le collègue qui recevra vos notifications.");
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
  try{ const {data}=await sb.auth.getSession(); S.session=data.session; await refresh(); }
  catch(e){ console.error(e); app().innerHTML=`<div class="wrap"><div class="err" style="margin-top:20px">Impossible de joindre le centre pour l'instant. Vérifiez votre connexion internet puis rechargez la page.</div></div>`; return; }
  S.loading=false; render();
})();
// Actualisation automatique (toutes les 60 s, et au retour sur l'app), sans perdre ce qui est en cours d'écriture
let busy=false;
async function autoRefresh(){ if(busy||!S.session||S.loading||document.hidden) return; const el=document.activeElement;
  if(el&&(el.tagName==="TEXTAREA"||el.tagName==="INPUT"||el.tagName==="SELECT")) return;
  if(S.screen==="flow") return; busy=true; try{ await refresh(); } finally{ busy=false; } }
setInterval(autoRefresh, 60000);
document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) autoRefresh(); });
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
console.log("CMPL app version 20261012b");
})();
