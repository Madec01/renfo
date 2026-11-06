(async function () {
  'use strict';
  const C = RenfoCore, B = RenfoBody, D = RENFO_DATA;
  const $ = (q, p = document) => p.querySelector(q);
  const $$ = (q, p = document) => [...p.querySelectorAll(q)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const safeURL = v => /^https?:\/\//.test(v || '') ? esc(v) : '#';
  const n = v => new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 1}).format(v || 0);
  const date = (v, opts = {}) => new Date(v).toLocaleDateString('fr-FR', {day:'numeric',month:'long',...opts});
  const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; };
  const icons = {
    home:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z', workout:'M4 8v8m4-11v14m8-14v14m4-11v8M8 12h8', library:'M4 4h6v16H4Zm10 0h6v16h-6Z',
    history:'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v5l4 3', chart:'M4 20h17M7 16v-5m5 5V5m5 11V8', plus:'M12 5v14M5 12h14',
    arrow:'M5 12h14m-5-5 5 5-5 5', back:'M19 12H5m5-5-5 5 5 5', search:'M20 20l-5-5m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
    settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
    close:'m6 6 12 12M6 18 18 6', check:'m5 12 4 4L19 6', play:'m8 4 12 8-12 8Z', pause:'M8 4v16M16 4v16',
    timer:'M9 2h6m-3 4v6l3 2m5-1a8 8 0 1 1-16 0 8 8 0 0 1 16 0', star:'m12 3 3 6 6 1-5 5 1 6-5-3-5 3 1-6-5-5 6-1Z',
    edit:'m15 4 5 5-11 11H4v-5ZM13 6l5 5', copy:'M8 8h12v13H8ZM4 16H2V2h12v2', download:'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7', up:'m6 14 6-6 6 6', down:'m6 10 6 6 6-6', info:'M12 11v6m0-10v1m10 4a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    body:'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4M4 9l8 2 8-2M12 11v4m0 0-4 7m4-7 4 7', save:'M4 3h13l4 4v14H3V3Zm3 0v6h10V3M7 21v-8h10v8', bolt:'m13 2-9 12h7l-1 8 10-13h-7Z'
  };
  const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]||icons.info}"/></svg>`;
  const btn = (label, action, attrs='', style='secondary') => `<button type="button" class="btn ${style}" data-action="${action}" ${attrs}>${label}</button>`;
  const ibtn = (name,label,action,attrs='') => `<button type="button" class="icon-btn" aria-label="${esc(label)}" title="${esc(label)}" data-action="${action}" ${attrs}>${icon(name)}</button>`;
  const labels = {renforcement:'Renforcement',echauffement:'Échauffement',mobilisation:'Mobilisation',etirements:'Étirements'};
  const equipmentNames = {haltere:'Un haltère',halteres:'Deux haltères',tapis:'Tapis',elastique:'Élastique',banc_stable:'Banc stable',chaise_stable:'Chaise stable',marche_stable:'Marche stable',mur:'Mur',serviette:'Serviette',appui_fixe:'Appui fixe',ancrage_adapte:'Ancrage adapté',support_haut_stable:'Support haut stable',sans_materiel:'Sans matériel'};
  const loadNames = {none:'Poids du corps',single_dumbbell:'Un haltère',per_dumbbell:'Kg par haltère (×2)',external_total:'Charge totale (kg)',band:'Élastique'};
  let state, route = 'home', activeTab = 'renforcement', search = '', filterMuscle = '', filterEquipment = '', onlyFavorites = false;
  let draft = null, pickerTarget = null, feedbackDraft = null, modalReturnFocus, activeHistory = null, toastTimer, wakeLock;
  let statsPeriod = 'week', statsRole = 'all', selectedStatsMuscle = '', historyMonth = new Date().toISOString().slice(0,7), historyDay = '';
  let channel, pendingExternal = null, saveStatus = 'saved', initialized = false, onlyMyEquipment = false;
  const catalog = () => [...D.exercises, ...state.customExercises];
  const exercise = id => catalog().find(e => e.id === id);
  const active = () => state.sessions.find(s => s.id === state.activeId && s.status === 'active');
  const currentSession = () => activeHistory ? state.sessions.find(s=>s.id === activeHistory) : active();
  const roleLegend = () => `<div class="legend"><span><i class="dot primary"></i>Principal</span><span><i class="dot assistance"></i>Assistance</span><span><i class="dot stabilization"></i>Stabilisation</span></div>`;
  function sourceLinks(ids) { return (ids || []).map(id => D.sources.find(x => x.id === id)).filter(Boolean).map(s => `<li><a href="${safeURL(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join(''); }
  function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('#toast').classList.remove('visible'),3500); }
  async function save() {
    if (pendingExternal) { toast('Une autre fenêtre a modifié les données. Recharge avant de continuer.'); return false; }
    state.revision++; state.updatedAt = Date.now(); saveStatus='saving'; updateSaveStatus();
    try { await RenfoStorage.save(state); saveStatus='saved'; channel?.postMessage({revision:state.revision,updatedAt:state.updatedAt}); updateSaveStatus(); return true; }
    catch(e) { saveStatus='error'; updateSaveStatus(); toast('Sauvegarde impossible. Exporte tes données avant de fermer.'); return false; }
  }
  function updateSaveStatus() { $$('.save-status').forEach(el=>{el.innerHTML=icon(saveStatus==='error'?'info':'check')+(saveStatus==='saved'?'Enregistré sur cet appareil':saveStatus==='saving'?'Enregistrement…':'Échec de sauvegarde'); el.classList.toggle('error',saveStatus==='error');}); }
  function seeds() {
    const make = (id,name,desc,ids,extra={}) => ({id,name,description:desc,mode:'classic',rounds:3,items:ids.map(id=>C.item(D.exercises.find(e=>e.id===id))).filter(Boolean),...extra});
    const models = [
      make('starter-personal','Ma séance de départ','Les six mouvements de tes premières fiches.', ['squat-goblet','epaule-developpe','rowing-unilateral','mollets-debout','deadbug','w-sol']),
      make('starter-full','Corps entier · sans matériel','Des mouvements accessibles pour varier les appuis.', ['squat-poids-corps','pompes-mur','pont-fessier','bird-dog','planche-laterale-genoux']),
      make('starter-lower','Jambes & stabilité','Squat, hanches et mollets.', ['squat-goblet','fente-arriere','souleve-terre-roumain','mollets-debout','deadbug'])
    ];
    for (const p of models[0].items) { if(p.exerciseId==='squat-goblet')p.load=8; if(p.exerciseId==='rowing-unilateral')p.load=6; if(p.exerciseId==='mollets-debout')p.load=4; }
    return models;
  }
  function photo(e, cls='', loading='lazy') {
    if (e.image) return `<img class="exercise-image ${cls}" src="${esc(e.image)}" alt="Positions clés : ${esc(e.name)}" loading="${loading}" decoding="async">`;
    return `<div class="movement-text ${cls}">${icon(C.family(e)==='etirements'?'body':'workout')}<span>${esc(e.setup)}</span><small>Consignes détaillées dans la fiche</small></div>`;
  }
  function frame() {
    const nav = [['home','home','Accueil'],['templates','workout','Séances'],['library','library','Exercices'],['history','history','Historique'],['stats','chart','Bilan']];
    $('#app').innerHTML = `<aside class="sidebar"><a class="brand" href="#home" aria-label="Renfo, accueil"><span class="brand-mark">r.</span><span>renfo<span class="brand-dot">.</span></span></a><div class="nav-caption">TON ESPACE</div><nav aria-label="Navigation principale">${nav.map(([r,i,l])=>`<a href="#${r}" class="nav-link ${route===r?'active':''}" ${route===r?'aria-current="page"':''}>${icon(i)}<span>${l}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="local-badge"><span class="status-dot"></span>Ton carnet personnel</div>${btn(icon('settings')+' Réglages','settings','','plain')}</div></aside>
    <div class="workspace"><header class="topbar"><span class="breadcrumb">MON ENTRAÎNEMENT <span>/</span> ${nav.find(x=>x[0]===route)?.[2] || 'Séance en cours'}</span><div class="top-actions"><span class="save-status"></span>${ibtn('settings','Réglages et sauvegardes','settings')}</div></header><main id="main" tabindex="-1"></main><footer class="app-footer">À ton rythme, une séance après l’autre.<span>Renfo · 1.0</span></footer></div>
    <nav class="mobile-nav" aria-label="Navigation mobile">${nav.map(([r,i,l])=>`<a href="#${r}" class="${route===r?'active':''}">${icon(i)}<span>${l}</span></a>`).join('')}</nav>`;
    if (pendingExternal) $('#main').insertAdjacentHTML('beforebegin',`<div class="notice warning">Une autre fenêtre a modifié ton carnet. ${btn('Recharger les données','reload')}</div>`);
    updateSaveStatus();
  }
  function heading(kicker,title,description,action='') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${description?`<p>${description}</p>`:''}</div>${action}</div>`; }
  function empty(iconName,title,text,action='') { return `<div class="empty-state">${icon(iconName)}<h3>${title}</h3><p>${text}</p>${action}</div>`; }
  function render() {
    if (!initialized) return;
    frame();
    const pages = {home:homePage,templates:templatesPage,library:libraryPage,history:historyPage,stats:statsPage,session:sessionPage};
    $('#main').innerHTML = (pages[route] || homePage)();
    tick();
  }
  function navigate(page) { if(location.hash.slice(1)===page){route=page;render();}else location.hash=page; window.scrollTo({top:0,behavior:'instant'}); }
  function homePage() {
    const done = state.sessions.filter(s=>s.status==='completed'), week = recentSessions('week'), total=C.totals(week), s=active();
    const goal=Math.max(1,Number(state.preferences.weeklyGoal)||3), weekly=week.length;
    const model=state.templates[0];
    return heading(date(Date.now(),{weekday:'long'}).toUpperCase(),'Chaque séance compte.','Ton entraînement, tes repères, tes progrès.',btn(icon('plus')+' Séance libre','quick-start','','primary'))+
      (s?`<div class="resume-banner"><div><span class="status-dot"></span><strong>Une séance t’attend</strong><span>${esc(s.name)} · <span data-clock="${s.id}">${clock(C.elapsed(s))}</span></span></div>${btn('Reprendre '+icon('arrow'),'resume-session','','primary')}</div>`:'')+
      `<section class="dashboard-hero"><div class="hero-copy"><span class="pill">PRÊT QUAND TU L’ES</span><h2>Un peu plus fort.<br>Un geste à la fois.</h2><p>Choisis ta séance, ajuste ton effort et garde une trace de ce qui compte pour toi.</p>${model?btn(icon('play')+' Lancer ma séance','start-template',`data-id="${model.id}"`,'lime'):btn('Créer ma séance','new-template','','lime')}<a href="#templates" class="hero-link">Explorer mes séances ${icon('arrow')}</a></div><div class="hero-visual">${photo(exercise('squat-goblet'),'hero-person','eager')}<div class="hero-sticker">BOUGER<br><strong>à ton rythme.</strong></div><span class="hero-orbit"></span></div></section>
      <section class="stat-grid"><div class="stat-card"><span>Séances cette semaine</span><strong>${weekly}<small> / ${goal}</small></strong><div class="mini-progress"><i style="width:${Math.min(100,weekly/goal*100)}%"></i></div></div><div class="stat-card"><span>Temps d’entraînement</span><strong>${n(Math.round(total.durationMs/60000))}<small> min</small></strong><p>Cette semaine · pauses exclues</p></div><div class="stat-card"><span>Muscles sollicités</span><strong>${Object.keys(total.muscles).length}<small> groupes</small></strong><p>Sur tes séries de renforcement validées</p></div></section>
      <div class="section-heading"><h2>Tes séances</h2><a href="#templates">Tout voir ${icon('arrow')}</a></div><div class="template-grid">${state.templates.slice(0,3).map(templateCard).join('')||empty('workout','Un premier repère','Crée une séance qui te ressemble.',btn('Créer une séance','new-template'))}</div>
      <div class="home-bottom"><section class="panel"><div class="section-heading"><h2>Ton dernier entraînement</h2><a href="#history">Historique</a></div>${done.length?sessionCard([...done].sort((a,b)=>b.startedAt-a.startedAt)[0]):`<div class="quiet-empty">${icon('history')}<div><strong>Le début de ton histoire</strong><p>Ta première séance apparaîtra ici une fois terminée.</p></div></div>`}</section><section class="panel tip-panel"><span class="eyebrow">LE BON REPÈRE</span><h3>Le geste avant le chiffre.</h3><p>Retrouve les positions clés et les muscles concernés sur chaque fiche, même pendant une séance.</p><a href="#library">Ouvrir les exercices ${icon('arrow')}</a></section></div>`;
  }
  function templateCard(t) {
    const roles = {primary:[],assistance:[],stabilization:[]};
    for(const p of t.items) { const e=exercise(p.exerciseId); if(e) roles.primary.push(...e.muscle_roles.primary); }
    return `<article class="template-card"><div class="template-top"><span class="template-icon">${icon('workout')}</span><span class="pill muted">${t.mode==='circuit'?'Circuit · '+t.rounds+' tours':t.items.length+' exercices'}</span><div class="menu-pair">${ibtn('copy','Dupliquer '+t.name,'duplicate-template',`data-id="${t.id}"`)}${ibtn('edit','Modifier '+t.name,'edit-template',`data-id="${t.id}"`)}</div></div><h3>${esc(t.name)}</h3><p>${esc(t.description || t.items.map(p=>exercise(p.exerciseId)?.name).filter(Boolean).slice(0,3).join(' · '))}</p><div class="template-meta">${icon('timer')} Environ ${C.estimate(t,catalog())} min <span>·</span> ${t.items.length} mouvements</div><div class="card-actions">${btn('Commencer '+icon('arrow'),'start-template',`data-id="${t.id}"`,'primary')} ${ibtn('trash','Supprimer le modèle '+t.name,'delete-template',`data-id="${t.id}"`)}</div></article>`;
  }
  function templatesPage() {
    return heading('À TA FAÇON','Mes séances','Compose tes séances et adapte-les à ta journée.',btn(icon('plus')+' Nouvelle séance','new-template','','primary'))+
      `<div class="template-grid">${state.templates.map(templateCard).join('')}</div><div class="section-heading"><h2>Préparer, mobiliser, étirer</h2><p>Des propositions à personnaliser</p></div><div class="routine-grid">${(D.routines||[]).map(r=>`<article class="routine-card"><span class="pill ${r.family}">${labels[r.family]}</span><h3>${esc(r.name)}</h3><p>${r.exerciseIds.length} mouvements · paramètres modifiables</p>${btn('Personnaliser '+icon('arrow'),'routine-template',`data-id="${r.id}"`)}</article>`).join('')}</div>`;
  }
  function filteredExercises() {
    const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return catalog().filter(e=>C.family(e)===activeTab && (!search||normalize(e.name+' '+(e.aliases||[]).join(' ')+' '+Object.values(e.muscle_roles).flat().map(m=>D.muscles[m]||m).join(' ')).includes(normalize(search))) && (!filterMuscle||Object.values(e.muscle_roles).flat().includes(filterMuscle)) && (!filterEquipment||(filterEquipment==='none'?!(e.equipment||[]).some(x=>['haltere','halteres','elastique','banc_stable'].includes(x)):e.equipment.includes(filterEquipment))) && (!onlyFavorites||state.favorites.includes(e.id)) && (!onlyMyEquipment || e.equipment.every(x => ['tapis','mur','serviette','sans_materiel'].includes(x) || state.preferences.equipment.includes(x))));
  }
  function libraryPage() {
    return heading('LE MOUVEMENT EN CLAIR','Les exercices','Les bons gestes et les muscles concernés, côte à côte.',btn(icon('plus')+' Mon exercice','custom-exercise'))+
      `<div class="category-tabs" role="tablist" aria-label="Familles d’exercices">${Object.entries(labels).map(([id,label])=>`<button role="tab" aria-selected="${activeTab===id}" class="${activeTab===id?'selected':''}" data-action="library-tab" data-id="${id}">${label}<span>${catalog().filter(e=>C.family(e)===id).length}</span></button>`).join('')}</div>
      <div class="filter-bar"><label class="search-field">${icon('search')}<input id="exercise-search" type="search" placeholder="Rechercher un exercice ou un muscle…" value="${esc(search)}" aria-label="Rechercher un exercice"></label><label class="sr-only" for="muscle-filter">Muscle</label><select id="muscle-filter"><option value="">Tous les muscles</option>${Object.entries(D.muscles).map(([id,name])=>`<option value="${id}" ${filterMuscle===id?'selected':''}>${esc(name)}</option>`).join('')}</select><label class="sr-only" for="equipment-filter">Matériel</label><select id="equipment-filter"><option value="">Tout le matériel</option><option value="none" ${filterEquipment==='none'?'selected':''}>Sans charge ni élastique</option>${['haltere','halteres','elastique','banc_stable'].map(id=>`<option value="${id}" ${filterEquipment===id?'selected':''}>${equipmentNames[id]}</option>`).join('')}</select><button class="icon-btn ${onlyFavorites?'selected':''}" aria-label="Afficher les favoris" aria-pressed="${onlyFavorites}" data-action="filter-favorites">${icon('star')}</button></div><label class="inventory-filter"><input type="checkbox" id="my-equipment-filter" ${onlyMyEquipment?'checked':''}> Avec mon matériel disponible</label><div id="exercise-results">${exerciseResults()}</div>`;
  }
  function exerciseResults() {
    const list=filteredExercises();
    return `<div class="results-count">${list.length} exercice${list.length>1?'s':''}</div><div class="exercise-grid">${list.map(e=>`<article class="exercise-card"><div class="exercise-visuals"><button class="gesture-preview" data-action="sheet" data-id="${e.id}" aria-label="Voir le geste : ${esc(e.name)}">${photo(e)}</button><button class="muscle-preview" data-action="sheet" data-id="${e.id}" aria-label="Voir les muscles : ${esc(e.name)}">${B.maps(e.muscle_roles,{compact:true})}<span>${activeTab==='etirements'?'Zones étirées':activeTab==='mobilisation'?'Zones mobilisées':'Muscles'}</span></button></div><div class="exercise-card-info"><div class="exercise-card-top"><span class="micro-label">${esc(e.difficulty==='intermediaire'?'Intermédiaire':'Accessible')}</span>${ibtn('star',state.favorites.includes(e.id)?'Retirer des favoris':'Ajouter aux favoris','favorite',`data-id="${e.id}" aria-pressed="${state.favorites.includes(e.id)}"`)}</div><h3>${esc(e.name)}</h3><p>${e.muscle_roles.primary.map(m=>esc(D.muscles[m]||m)).slice(0,3).join(' · ')||esc((e.target_regions||[]).join(' · '))}</p><div class="exercise-card-footer"><span>${esc(e.equipment.filter(x=>x!=='tapis').slice(0,2).map(x=>equipmentNames[x]||x.replaceAll('_',' ')).join(' + ')||'Poids du corps')}</span><button data-action="sheet" data-id="${e.id}" class="text-btn">Voir la fiche ${icon('arrow')}</button></div></div></article>`).join('')||empty('search','Aucun exercice trouvé','Essaie un autre mot ou enlève un filtre.',btn('Réinitialiser les filtres','reset-filters'))}</div>`;
  }
  function showModal(title,html,wide=false) {
    if(!$('#dialog'))modalReturnFocus=document.activeElement;
    $('#modal-root').innerHTML=`<dialog id="dialog" class="${wide?'wide':''}"><div class="dialog-head"><h2>${title}</h2>${ibtn('close','Fermer','close-modal')}</div><div class="dialog-content">${html}</div></dialog>`;
    const d=$('#dialog'); d.showModal(); d.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
    d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
  }
  function closeModal() { $('#dialog')?.close(); $('#modal-root').innerHTML=''; modalReturnFocus?.isConnected&&modalReturnFocus.focus(); feedbackDraft=null; }
  function openSheet(id, definition) {
    const e=definition||exercise(id); if(!e)return;
    const roleContext=C.family(e)==='etirements'?'Zones étirées':C.family(e)==='mobilisation'?'Zones mobilisées':'Muscles sollicités';
    showModal(esc(e.name),`<div class="sheet-toolbar"><span class="pill">${labels[C.family(e)]}</span><span>${esc(e.equipment.map(x=>equipmentNames[x]||x.replaceAll('_',' ')).join(' · '))}</span>${btn(icon('download')+' Imprimer / PDF','print-sheet','','plain')}</div><div class="sheet-visuals"><figure>${e.image?`<button type="button" class="zoom-image" data-action="zoom-gesture" data-id="${e.id}" aria-label="Agrandir l’illustration">${photo(e,'','eager')}</button>`:photo(e,'','eager')}<figcaption>${e.image?'Toucher pour agrandir · ':''}Positions clés du mouvement</figcaption></figure><figure>${B.maps(e.muscle_roles)}<figcaption>${roleContext}</figcaption>${roleLegend()}</figure></div><p class="map-note">Carte simplifiée. Les muscles profonds sont représentés par leur région. Les couleurs décrivent des rôles, pas une intensité mesurée.</p><div class="sheet-objective"><strong>L’objectif</strong><p>${esc(e.objective)}</p></div><div class="sheet-columns"><section><h3>Installe-toi</h3><p>${esc(e.setup)}</p><h3>Le mouvement, pas à pas</h3><ol class="step-list">${e.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><div class="cue-box"><strong>Respiration & rythme</strong><p>${esc(e.breathing)}</p><p>${esc(e.tempo)}</p></div></section><aside><h3>Les bons repères</h3><ul class="check-list">${e.key_cues.map(x=>`<li>${icon('check')}${esc(x)}</li>`).join('')}</ul><h3>À éviter</h3><ul>${e.common_mistakes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><h3>Adapter le mouvement</h3><p><strong>Plus accessible :</strong> ${esc(e.easier_variant)}</p><p><strong>Progression :</strong> ${esc(e.harder_variant)}</p><h3>Compter correctement</h3><p>${esc(e.counting_instructions||'Enregistre la durée ou les répétitions de chaque côté séparément si nécessaire.')}</p><p>${esc(e.load_instructions||loadNames[e.load_input]||'Sans charge externe.')}</p></aside></div><div class="muscle-details">${Object.entries({primary:'Principaux / cibles',assistance:'Assistance',stabilization:'Stabilisation'}).map(([r,l])=>`<div><strong>${l}</strong><p>${e.muscle_roles[r].map(m=>esc(D.muscles[m]||m)).join(', ')||'—'}</p></div>`).join('')}</div><label class="field">Ma note pour cet exercice<textarea id="pinned-note" rows="2" maxlength="3000" placeholder="Un repère à retrouver la prochaine fois…">${esc(state.exerciseNotes[e.id]||'')}</textarea></label><div class="row-actions">${btn('Enregistrer ma note','save-note',`data-id="${e.id}"`)}${btn(icon('plus')+' Ajouter à une séance','sheet-add',`data-id="${e.id}"`)}</div><details class="source-details"><summary>Sources et précisions</summary><ul>${sourceLinks(e.source_ids)}</ul>${(e.editorial_notes||[]).map(x=>`<p>${esc(x)}</p>`).join('')}</details>`,true);
  }
  function openBuilder(id) {
    draft=id?C.clone(state.templates.find(t=>t.id===id)):{id:C.uid(),name:'Ma nouvelle séance',description:'',mode:'classic',rounds:3,items:[]};
    renderBuilder();
  }
  function renderBuilder() {
    if(!draft)return;
    showModal('Composer ma séance',`<form id="template-form"><div class="form-grid"><label class="field">Nom de la séance<input name="templateName" id="template-name" value="${esc(draft.name)}" required maxlength="100"></label><label class="field">Organisation<select id="template-mode"><option value="classic" ${draft.mode==='classic'?'selected':''}>Séries classiques</option><option value="circuit" ${draft.mode==='circuit'?'selected':''}>Circuit / supersérie</option></select></label><label class="field ${draft.mode==='circuit'?'':'hidden'}">Tours de circuit<input type="number" id="template-rounds" min="1" max="12" value="${draft.rounds||3}"></label></div><label class="field">Description<input id="template-description" maxlength="300" value="${esc(draft.description||'')}" placeholder="Le fil conducteur de cette séance…"></label><div class="builder-caption"><strong>${draft.items.length} exercices</strong><span>Environ ${C.estimate(draft,catalog())} min</span><span class="pill muted">Modifications à enregistrer</span></div>${draft.mode==='circuit'?'<p class="notice">Chaque tour contient une série par exercice de renforcement, dans cet ordre. Les blocs de préparation et d’étirement ne sont pas répétés. Une supersérie se compose de deux exercices.</p>':''}<div class="builder-items">${draft.items.map((p,i)=>builderItem(p,i)).join('')||empty('plus','Une séance à ton image','Ajoute tes premiers exercices ci-dessous.')}</div><div class="builder-add">${btn(icon('plus')+' Ajouter des exercices','builder-add')}${btn(icon('bolt')+' Ajouter un échauffement','builder-warmup')}</div><div class="dialog-footer"><span>Tu pourras tout ajuster pendant la séance.</span><button class="btn primary" type="submit">${icon('save')} Enregistrer la séance</button></div></form>`,true);
  }
  function builderItem(p,i) {
    const e=exercise(p.exerciseId); if(!e)return '';
    const duration=e.execution_mode==='duree', isCircuit=draft.mode==='circuit'&&p.block==='renforcement';
    return `<article class="builder-item"><div class="builder-item-head"><span class="number-badge">${i+1}</span><div><strong>${esc(e.name)}</strong><span>${['unilateral','alterne'].includes(e.laterality)?'Saisie par côté':'Deux côtés ensemble'} · ${labels[p.block]}</span></div><div class="reorder-actions">${ibtn('up','Monter cet exercice','builder-up',`data-index="${i}" ${i===0?'disabled':''}`)}${ibtn('down','Descendre cet exercice','builder-down',`data-index="${i}" ${i===draft.items.length-1?'disabled':''}`)}${ibtn('trash','Retirer cet exercice','builder-remove',`data-index="${i}"`)}</div></div><div class="builder-fields"><label class="field">Bloc<select data-plan="block" data-index="${i}">${Object.entries(labels).map(([k,l])=>`<option value="${k}" ${p.block===k?'selected':''}>${l}</option>`).join('')}</select></label><label class="field">${isCircuit?'Série / tour':'Séries'}<input type="number" min="1" max="20" value="${isCircuit?1:p.sets}" data-plan="sets" data-index="${i}" ${isCircuit?'disabled':''}></label><label class="field">${duration?'Durée (s)':'Répétitions'}<input type="number" min="1" max="${duration?3600:1000}" data-plan="${duration?'duration':'reps'}" data-index="${i}" value="${duration?p.duration:p.reps}"></label><label class="field">Type de charge<select data-plan="loadMode" data-index="${i}">${Object.entries(loadNames).map(([k,l])=>`<option value="${k}" ${p.loadMode===k?'selected':''}>${l}</option>`).join('')}</select></label>${p.loadMode==='band'?`<label class="field">Élastique<input data-plan="band" data-index="${i}" value="${esc(p.band||'')}" placeholder="Couleur / résistance" maxlength="80"></label>`:!['none','band'].includes(p.loadMode)?`<label class="field">${p.loadMode==='per_dumbbell'?'Kg / haltère':'Kg'}<input type="number" min="0" max="1000" step="0.25" data-plan="load" data-index="${i}" value="${p.load}"></label>`:''}<label class="field">Repos (s)<input type="number" min="0" max="3600" step="5" data-plan="rest" data-index="${i}" value="${p.rest}"></label></div></article>`;
  }
  function openPicker(target, category='all') {
    pickerTarget=target;
    showModal(target==='builder'?'Ajouter des exercices':'Choisir un exercice',`<label class="search-field">${icon('search')}<input id="picker-search" type="search" placeholder="Nom ou muscle…" aria-label="Rechercher dans les exercices"></label><div class="picker-categories">${['all',...Object.keys(labels)].map(k=>btn(k==='all'?'Tout':labels[k],'picker-category',`data-id="${k}"`,k===category?'primary':'plain')).join('')}</div><div id="picker-list">${pickerList('',category)}</div><div class="dialog-footer">${btn(target==='builder'?'Revenir à ma séance':'Fermer','picker-done')}</div>`,true);
    $('#picker-search').dataset.category=category;
  }
  function pickerList(q, category) {
    const low=q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return `<div class="picker-list">${catalog().filter(e=>(category==='all'||C.family(e)===category)&&(e.name+' '+Object.values(e.muscle_roles).flat().map(m=>D.muscles[m]).join(' ')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(low)).map(e=>`<div class="picker-row"><div class="picker-thumb">${photo(e)}</div><div><strong>${esc(e.name)}</strong><small>${labels[C.family(e)]} · ${esc(e.equipment.map(x=>equipmentNames[x]||x).slice(0,2).join(', '))}</small></div>${btn(icon('plus')+(pickerTarget==='replace'?' Remplacer':' Ajouter'),'pick-exercise',`data-id="${e.id}"`)}</div>`).join('')}</div>`;
  }
  function chooseWarmup() {
    const rs=(D.routines||[]).filter(r=>r.family==='echauffement');
    showModal('Préparer la séance',`<p>Choisis une proposition. Les mouvements seront ajoutés au début de ta séance, avec des paramètres modifiables et sans reprendre tes charges de travail.</p><div class="routine-grid">${rs.map(r=>`<article class="routine-card"><h3>${esc(r.name)}</h3><p>${r.exerciseIds.map(id=>esc(exercise(id)?.name||'')).join(' · ')}</p>${btn('Ajouter cet échauffement','insert-warmup',`data-id="${r.id}"`)}</article>`).join('')}</div>`,true);
  }
  async function startTemplate(id) {
    if(active()){navigate('session');toast('Reprends ou termine la séance en cours avant d’en commencer une autre.');return;}
    const t=state.templates.find(x=>x.id===id); if(!t?.items.length){toast('Ajoute au moins un exercice à la séance.');return;}
    const s=C.createSession(t,catalog());state.sessions.unshift(s);state.activeId=s.id;activeHistory=null;await save();closeModal();navigate('session');requestWakeLock();
  }
  async function quickStart() {
    if(active()){navigate('session');return;}
    const s=C.createSession({id:null,name:'Séance libre',items:[]},catalog());state.sessions.unshift(s);state.activeId=s.id;activeHistory=null;await save();navigate('session');openPicker('session');requestWakeLock();
  }
  function loadLabel(r) {
    if(r.loadMode==='none')return 'Poids du corps'; if(r.loadMode==='band')return esc(r.band||'Élastique');
    return r.loadMode==='per_dumbbell'?`2 × ${n(r.load)} kg`:`${n(r.load)} kg`;
  }
  function sessionPage() {
    const s=currentSession(); if(!s)return heading('TON CARNET','Aucune séance en cours','Choisis une séance ou commence librement.',btn('Voir mes séances','go-templates','','primary'));
    s.cursor=Math.max(0,Math.min(s.cursor,s.entries.length-1)); const e=s.entries[s.cursor];
    const rows=s.entries.flatMap(x=>x.rows), done=rows.filter(r=>r.status==='done').length, processed=rows.filter(r=>r.status!=='pending').length;
    const isActive=s.status==='active';
    return `<div class="session-heading"><div><button class="text-btn" data-action="${isActive?'go-templates':'go-history'}">${icon('back')} ${isActive?'Mes séances':'Historique'}</button><h1>${esc(s.name)}</h1><p>${isActive?'Séance en cours':date(s.startedAt,{year:'numeric'})} · ${done} série${done>1?'s':''} validée${done>1?'s':''}</p></div><div class="session-controls"><div class="session-clock">${icon('timer')}<strong data-clock="${s.id}">${clock(C.elapsed(s))}</strong>${s.pausedAt?'<span>En pause</span>':''}</div>${isActive?btn(icon(s.pausedAt?'play':'pause')+(s.pausedAt?' Reprendre':' Pause'),'pause-session')+btn('Terminer','finish-dialog','','primary'):btn(icon('copy')+' Refaire cette séance','repeat-session',`data-id="${s.id}"`,'primary')}</div></div><div class="session-progress" aria-label="${processed} séries traitées sur ${rows.length}"><i style="width:${rows.length?processed/rows.length*100:0}%"></i></div>
    ${s.pausedAt?'<div class="notice warning">La séance et les minuteurs sont en pause.</div>':''}
    ${!e?empty('workout','Ta séance commence ici','Ajoute un exercice pour enregistrer tes premières séries.',btn(icon('plus')+' Choisir un exercice','session-add','','primary')):`<div class="session-layout"><aside class="session-track"><div class="section-heading"><h3>Le programme</h3>${ibtn('plus','Ajouter un exercice à la séance','session-add')}</div>${s.entries.map((entry,i)=>`<button class="track-item ${i===s.cursor?'selected':''}" data-action="select-entry" data-index="${i}"><span class="track-number ${entry.rows.every(r=>r.status!=='pending')?'done':''}">${entry.rows.every(r=>r.status!=='pending')?icon('check'):i+1}</span><span><strong>${esc(entry.definition.name)}</strong><small>${entry.round?'Tour '+entry.round+' · ':''}${entry.rows.filter(r=>r.status==='done').length}/${entry.rows.length} séries · ${labels[entry.plan.block]}</small></span></button>`).join('')}<div class="mode-setting"><label><input type="checkbox" id="guided-mode" ${s.guided?'checked':''}> Repos automatique</label><small>Décoche pour tenir ton journal librement.</small></div></aside><section class="active-exercise"><div class="active-exercise-heading"><div><span class="eyebrow">${labels[e.plan.block]} ${e.round?'· TOUR '+e.round:''}</span><h2>${esc(e.definition.name)}</h2></div><div>${ibtn('edit','Remplacer cet exercice','session-replace')}${btn('Voir la fiche','session-sheet')}</div></div>
    <div class="active-visuals"><div class="active-gesture">${photo(e.definition,'','eager')}</div><div class="active-muscles">${B.maps(e.definition.muscle_roles,{compact:true})}${roleLegend()}</div></div>
    <div class="exercise-cue">${icon('info')}<p>${esc(e.definition.key_cues[0]||e.definition.setup)}${state.exerciseNotes[e.exerciseId]?`<span>Ta note : ${esc(state.exerciseNotes[e.exerciseId])}</span>`:''}</p></div>
    ${previousLine(e,s)}
    <div class="set-options"><label>Charge <select id="entry-load-mode">${Object.entries(loadNames).map(([k,l])=>`<option value="${k}" ${(e.rows.find(r=>r.status==='pending')?.loadMode||e.plan.loadMode)===k?'selected':''}>${l}</option>`).join('')}</select></label><label>Repos <input id="entry-rest" type="number" min="0" max="3600" value="${e.plan.rest}"> s</label>${btn('Copier la dernière performance','use-last')}</div>
    <p class="counting-note">${esc(e.definition.counting_instructions||'Saisie par côté si indiqué.')}${(e.rows[0]?.loadMode==='per_dumbbell')?' La charge saisie est celle d’un seul haltère.':''}</p>
    <div class="sets-table"><div class="set-head"><span>Série</span><span>${e.definition.execution_mode==='duree'?'Secondes':'Répétitions'}</span><span>Charge</span><span>Effort / 10</span><span>Validation</span></div>${e.rows.map(r=>setRow(e,r,s)).join('')}</div><div class="set-bottom">${btn(icon('plus')+' Ajouter une série','add-set')}${s.undo?btn('Annuler la dernière validation','undo-set','','plain'):''}${btn(icon('body')+' Commenter mon ressenti','feedback-open')}</div>
    <div class="timer-panel" id="rest-panel" ${!s.restUntil&&!s.restRemaining?'hidden':''}><div>${icon('timer')}<span>Récupération</span><strong id="rest-clock"></strong></div><div>${btn('+15 s','rest-more')}${btn('Passer le repos','rest-skip')}</div></div>
    <div class="timer-panel effort" id="effort-panel" ${!s.effortUntil&&!s.effortRemaining?'hidden':''}><div>${icon('timer')}<span>Durée du mouvement</span><strong id="effort-clock"></strong></div>${btn('Arrêter le minuteur','effort-stop')}</div>
    <label class="field">Note sur cet exercice<textarea id="entry-note" maxlength="3000" rows="2" placeholder="Ce que tu souhaites retrouver…">${esc(e.note||'')}</textarea></label>${feedbackCards(e,s)}
    <div class="exercise-nav">${btn(icon('back')+' Précédent','prev-entry',s.cursor===0?'disabled':'')}${s.cursor<s.entries.length-1?btn('Exercice suivant '+icon('arrow'),'next-entry','','primary'):isActive?btn('Bilan de la séance '+icon('arrow'),'finish-dialog','','primary'):''}</div></section></div>`}`;
  }
  function previousLine(e,s) {
    const last=C.lastPerformance(state.sessions,e.exerciseId,s.id);
    return `<div class="previous-line">${icon('history')} ${last?`Dernière fois, le ${date(last.date)} : <strong>${e.definition.execution_mode==='duree'?n(last.row.duration)+' s':n(last.row.reps)+' répétitions'} · ${loadLabel(last.row)}</strong>`:'Première réalisation enregistrée pour cet exercice.'}</div>`;
  }
  function setRow(e,r,s) {
    const duration=e.definition.execution_mode==='duree', attr=`data-row="${r.id}" data-entry="${e.id}"`;
    return `<div class="set-row ${r.status}" data-set-id="${r.id}"><span class="set-label"><strong>${r.number}</strong><small>${r.side==='ensemble'?'':r.side==='gauche'?'Gauche':'Droite'}</small></span><label><span class="sr-only">${duration?'Durée':'Répétitions'} série ${r.number} ${r.side}</span><input type="number" min="1" max="${duration?86400:10000}" value="${duration?r.duration:r.reps}" data-set-field="${duration?'duration':'reps'}" ${attr}></label><label><span class="sr-only">Charge série ${r.number}</span>${r.loadMode==='band'?`<input value="${esc(r.band)}" placeholder="Élastique" maxlength="80" data-set-field="band" ${attr}>`:r.loadMode==='none'?'<span class="bodyweight">PDC</span>':`<input type="number" min="0" max="1000" step="0.25" value="${r.load}" data-set-field="load" ${attr}><small>${r.loadMode==='per_dumbbell'?'kg / haltère':'kg'}</small>`}</label><label><span class="sr-only">Effort ressenti sur 10</span><input type="number" min="1" max="10" value="${r.effort}" placeholder="—" data-set-field="effort" ${attr}></label><div class="set-row-actions">${r.status==='done'?`<button class="done-button" data-action="reopen-set" ${attr} aria-label="Dévalider la série">${icon('check')}<span>Fait</span></button>`:r.status==='skipped'?btn('Passée','reopen-set',attr,'plain'):`${duration?ibtn('timer','Démarrer le minuteur de cette série','start-effort',attr):''}${ibtn('check','Valider la série '+r.number+' '+r.side,'complete-set',attr)}${ibtn('arrow','Passer cette série','skip-set',attr)}`}</div></div>`;
  }
  function finishDialog() {
    const s=active();if(!s)return;const t=C.totals([s]),pending=s.entries.flatMap(e=>e.rows).filter(r=>r.status==='pending').length;
    showModal('Faire le point',`<div class="finish-stats"><div><strong>${t.done}</strong><span>Séries validées</span></div><div><strong>${n(Math.round(C.elapsed(s)/60000))}</strong><span>Minutes</span></div><div><strong>${Object.keys(t.muscles).length}</strong><span>Groupes sollicités</span></div></div>${pending?`<p class="notice">${pending} série${pending>1?'s restent':' reste'} non réalisée${pending>1?'s':''}. Seules les séries validées compteront dans le bilan.</p>`:''}${B.maps(B.rolesFromTotals(t.muscles),{compact:true})}${roleLegend()}<form id="finish-form"><label class="field">Un mot sur cette séance<textarea name="note" maxlength="5000" rows="3" placeholder="Énergie, difficultés, satisfaction…">${esc(s.note)}</textarea></label><button type="submit" class="btn primary full">Terminer et enregistrer</button></form>`);
  }
  function sessionCard(s) {
    const t=C.totals([s]);return `<button class="history-card" data-action="open-session" data-id="${s.id}"><span class="date-tile"><strong>${new Date(s.startedAt).getDate()}</strong>${new Date(s.startedAt).toLocaleDateString('fr-FR',{month:'short'})}</span><span class="history-card-body"><strong>${esc(s.name)}</strong><small>${t.exercises} exercices · ${t.done} séries · ${n(Math.round(C.elapsed(s)/60000))} min</small>${s.note?`<span>${esc(s.note.slice(0,100))}</span>`:''}</span>${icon('arrow')}</button>`;
  }
  function historyPage() {
    const completed=state.sessions.filter(s=>s.status==='completed').sort((a,b)=>b.startedAt-a.startedAt);
    const [year,month]=historyMonth.split('-').map(Number), first=new Date(year,month-1,1), offset=(first.getDay()+6)%7, days=new Date(year,month,0).getDate();
    const localKey=t=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
    const byDate={};for(const s of completed)(byDate[localKey(s.startedAt)]||=[]).push(s);
    const filtered=completed.filter(s=>localKey(s.startedAt).startsWith(historyMonth)&&(!historyDay||localKey(s.startedAt)===historyDay));
    return heading('LE CHEMIN PARCOURU','Mon historique','Retrouve ce que tu as réellement fait, séance après séance.',btn(icon('download')+' Exporter mes données','export'))+
    `<div class="history-layout"><section class="panel calendar-panel"><div class="calendar-toolbar">${ibtn('back','Mois précédent','month-prev')}<label><span class="sr-only">Mois de l’historique</span><input type="month" id="history-month" value="${historyMonth}"></label>${ibtn('arrow','Mois suivant','month-next')}</div><div class="calendar-grid">${['L','M','M','J','V','S','D'].map(x=>`<span class="calendar-label">${x}</span>`).join('')}${Array.from({length:offset},()=>'<span></span>').join('')}${Array.from({length:days},(_,i)=>{const key=historyMonth+'-'+String(i+1).padStart(2,'0');return `<button class="calendar-day ${byDate[key]?'has-session':''} ${historyDay===key?'selected':''}" data-action="history-day" data-id="${key}" aria-label="${i+1} ${first.toLocaleDateString('fr-FR',{month:'long'})}, ${byDate[key]?.length||0} séance"><span>${i+1}</span>${byDate[key]?'<i></i>':''}</button>`;}).join('')}</div><p class="calendar-legend"><i class="status-dot"></i> Une séance enregistrée</p>${historyDay?btn('Voir tout le mois','history-reset','','plain'):''}</section><section><div class="section-heading"><h2>${historyDay?date(new Date(historyDay+'T12:00:00')):'Les séances du mois'}</h2><span>${filtered.length} séance${filtered.length>1?'s':''}</span></div>${filtered.map(s=>`<div class="history-row">${sessionCard(s)}${ibtn('trash','Supprimer la séance '+s.name,'delete-session',`data-id="${s.id}"`)}</div>`).join('')||empty('history','Aucune séance sur cette période','Tes séances terminées apparaîtront ici.',btn('Choisir une séance','go-templates'))}</section></div>`;
  }
  function recentSessions(period) {
    const from=new Date();from.setHours(0,0,0,0);
    if(period==='week')from.setDate(from.getDate()-((from.getDay()+6)%7)); else if(period==='month')from.setDate(1); else from.setTime(0);
    return state.sessions.filter(s=>s.status==='completed'&&s.startedAt>=from.getTime());
  }
  function statsPage() {
    const sessions=recentSessions(statsPeriod),t=C.totals(sessions),roles=B.rolesFromTotals(t.muscles,statsRole),muscles=Object.entries(t.muscles).filter(([m,v])=>statsRole==='all'||v[statsRole]).sort((a,b)=>{const sum=v=>statsRole==='all'?v.primary+v.assistance+v.stabilization:v[statsRole];return sum(b[1])-sum(a[1]);});
    const max=Math.max(1,...muscles.map(([m,v])=>v.primary+v.assistance+v.stabilization));
    return heading('COMPRENDRE TON ENTRAÎNEMENT','Le bilan musculaire','Un aperçu de tes séries réalisées, par groupe et par rôle.')+
    `<div class="stats-toolbar"><div class="segmented">${[['week','Cette semaine'],['month','Ce mois'],['all','Tout']].map(([k,l])=>btn(l,'stats-period',`data-id="${k}"`,statsPeriod===k?'selected':'plain')).join('')}</div><label>Rôle <select id="stats-role"><option value="all">Tous les rôles</option>${Object.entries({primary:'Principal',assistance:'Assistance',stabilization:'Stabilisation'}).map(([k,l])=>`<option value="${k}" ${statsRole===k?'selected':''}>${l}</option>`).join('')}</select></label></div>
    <div class="stat-grid"><div class="stat-card"><span>Séances réalisées</span><strong>${sessions.length}</strong></div><div class="stat-card"><span>Temps total</span><strong>${n(Math.round(t.durationMs/60000))}<small> min</small></strong></div><div class="stat-card"><span>Séries validées</span><strong>${t.done}</strong><p>Toutes les familles d’activité</p></div></div><div class="stats-layout"><section class="panel body-stat"><h2>Les zones sollicitées</h2>${B.maps(roles)}${roleLegend()}<p class="map-note">Carte simplifiée du renforcement. Les couleurs indiquent le rôle attendu, sans mesurer l’activation ni la récupération. Une région peut avoir plusieurs rôles selon l’exercice.</p></section><section class="panel"><h2>Le détail par muscle</h2><p class="subtle">Nombre de séries validées pour chaque rôle. Gauche et droite sont des séries distinctes.</p><div class="muscle-bars">${muscles.map(([m,v])=>`<button class="muscle-bar-row ${selectedStatsMuscle===m?'selected':''}" data-action="stats-muscle" data-id="${m}"><span>${esc(D.muscles[m]||m)}</span><div class="stack-bar">${['primary','assistance','stabilization'].filter(r=>statsRole==='all'||r===statsRole).map(r=>`<i class="${r}" style="width:${v[r]/max*100}%" title="${r}: ${v[r]}"></i>`).join('')}</div><strong>${statsRole==='all'?v.primary+v.assistance+v.stabilization:v[statsRole]}</strong></button>`).join('')||empty('body','Le corps garde ses repères','Termine une séance de renforcement pour remplir ce bilan.')}</div>${selectedStatsMuscle&&t.muscles[selectedStatsMuscle]?`<div class="muscle-detail"><h3>${esc(D.muscles[selectedStatsMuscle])}</h3><p>Principal : ${t.muscles[selectedStatsMuscle].primary} · Assistance : ${t.muscles[selectedStatsMuscle].assistance} · Stabilisation : ${t.muscles[selectedStatsMuscle].stabilization}</p>${[...t.muscles[selectedStatsMuscle].exercises].map(id=>btn(esc(exercise(id)?.name||id),'sheet',`data-id="${id}"`,'plain')).join('')}</div>`:''}</section></div>
    <section class="panel progress-panel"><div class="section-heading"><h2>Progression par exercice</h2><label class="sr-only" for="progress-exercise">Exercice à comparer</label><select id="progress-exercise"><option value="">Choisir un exercice réalisé</option>${[...new Set(state.sessions.filter(s=>s.status==='completed').flatMap(s=>s.entries.filter(e=>e.rows.some(r=>r.status==='done')).map(e=>e.exerciseId)))].map(id=>`<option value="${id}">${esc(exercise(id)?.name||id)}</option>`).join('')}</select></div><div id="progress-details"><p class="subtle">Compare les répétitions, la durée et les charges à convention identique.</p></div></section>`;
  }
  function progressDetails(id) {
    const rows=state.sessions.filter(s=>s.status==='completed').sort((a,b)=>a.startedAt-b.startedAt).flatMap(s=>s.entries.filter(e=>e.exerciseId===id).flatMap(e=>e.rows.filter(r=>r.status==='done').map(r=>({s,e,r}))));
    if(!rows.length)return '<p>Aucune série réalisée.</p>';
    return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Date</th><th>Côté</th><th>Répétitions / durée</th><th>Charge</th><th>Effort</th></tr></thead><tbody>${rows.slice(-40).reverse().map(({s,e,r})=>`<tr><td>${date(s.startedAt)}</td><td>${r.side==='ensemble'?'Ensemble':esc(r.side)}</td><td>${e.definition.execution_mode==='duree'?n(r.duration)+' s':n(r.reps)+' rep.'}</td><td>${loadLabel(r)}</td><td>${r.effort?n(r.effort)+'/10':'—'}</td></tr>`).join('')}</tbody></table></div><p class="map-note">40 dernières séries. La charge seule ne décrit pas la difficulté : compare aussi la variante, l’amplitude et les répétitions.</p>`;
  }
  function feedbackCards(e,s) {
    if(!e.feedback?.length)return '';
    const names={pain:'Douleur / gêne',notfelt:'Muscle peu ressenti',effort:'Effort musculaire',stretch:'Sensation d’étirement',fine:'Aucun problème',sensory:'Engourdissement / fourmillements',control:'Contrôle du geste'};
    return `<div class="feedback-list">${e.feedback.map(f=>`<article class="feedback-card"><div><span class="pill ${f.type==='pain'?'pain':''}">${names[f.type]||esc(f.type)}</span><small>${date(f.createdAt)}</small>${ibtn('trash','Supprimer ce commentaire','delete-feedback',`data-id="${f.id}"`)}</div><p>${f.points.map(p=>esc(p.region+' '+(p.side||''))).join(' · ')||'Sans zone indiquée'}${f.type==='pain'?' · Intensité '+f.intensity+'/10':''} · ${esc(f.timing||'')}</p>${f.note?`<p>${esc(f.note)}</p>`:''}<details><summary>Repères et conseil affiché</summary><p>${esc(f.advice?.message||'')}</p>${f.advice?.cues?.length?`<ul>${f.advice.cues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<p class="map-note">Conseil technique général · règle ${esc(f.advice?.ruleId||'v1')}</p><ul>${sourceLinks(f.advice?.sourceIds)}</ul></details><div class="feedback-outcome"><span>Depuis ce retour :</span>${[['better','Mieux'],['same','Pareil'],['worse','Pire']].map(([id,l])=>`<button class="chip ${f.outcome===id?'selected':''}" data-action="feedback-outcome" data-id="${f.id}" data-value="${id}">${l}</button>`).join('')}</div></article>`).join('')}</div>`;
  }
  function openFeedback() {
    const s=currentSession(),e=s?.entries[s.cursor];if(!e)return;
    feedbackDraft={id:C.uid(),entryId:e.id,sessionId:s.id,points:[]};
    showModal('Comment s’est passé le mouvement ?',`<form id="feedback-form"><p class="subtle">${esc(e.definition.name)} · Sélectionne une ou plusieurs zones sur le corps, ou décris-les avec tes mots.</p><div class="feedback-layout"><section><div id="feedback-body">${B.maps({}, {interactive:true,points:[]})}</div><div id="feedback-points"><p class="map-note">Face : ta droite apparaît à gauche du dessin. Dos : ta droite apparaît à droite.</p></div>${btn('Effacer les points','clear-points','','plain')}<label class="field">Ou choisir une zone<select id="feedback-region"><option value="">Sélectionner…</option>${['Nuque','Épaule','Bras','Avant-bras','Poignet','Poitrine','Haut du dos','Lombaires','Abdominaux','Hanche','Fessier','Cuisse','Genou','Mollet','Cheville','Pied'].map(x=>`<option>${x}</option>`).join('')}</select></label><div class="form-grid"><label class="field">Côté<select id="feedback-side"><option value="droite">Droit</option><option value="gauche">Gauche</option><option value="centre">Centre</option></select></label>${btn('Ajouter la zone','add-region')}</div></section><section><label class="field">Le ressenti<select name="type" id="feedback-type"><option value="effort">Effort / fatigue musculaire</option><option value="pain">Douleur ou gêne</option><option value="notfelt">Muscle peu ou pas ressenti</option><option value="sensory">Engourdissement / fourmillements</option><option value="control">Geste difficile à contrôler, sans douleur</option><option value="stretch">Sensation d’étirement</option><option value="fine">Aucun problème</option></select></label><div id="pain-fields" hidden><label class="field">Intensité de la douleur / gêne, de 0 à 10<input name="intensity" type="number" min="0" max="10" value="3"></label><p class="map-note">Cette échelle est distincte de la difficulté de l’effort.</p></div><div id="notfelt-fields" hidden><label class="field">Muscle que tu attendais<select name="expectedMuscle"><option value="">Choisir…</option>${Object.entries(D.muscles).map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('')}</select></label><label class="field">Ce que tu as ressenti à la place<input name="feltInstead" maxlength="200" placeholder="Zone ou sensation…"></label></div><div class="form-grid"><label class="field">Quand ?<select name="timing"><option>Pendant l’exercice</option><option>Juste après</option><option>Plus tard dans la journée</option><option>Le lendemain</option></select></label><label class="field">Phase du geste<select name="phase"><option>Non précisée</option><option>Installation</option><option>Montée / poussée / tirage</option><option>Descente / retour</option><option>Maintien</option></select></label></div><label class="field">Série concernée<select name="rowId"><option value="">L’exercice en général</option>${e.rows.map(r=>`<option value="${r.id}">Série ${r.number}${r.side==='ensemble'?'':' · '+r.side} · ${e.definition.execution_mode==='duree'?r.duration+' s':r.reps+' rep.'} · ${loadLabel(r)}</option>`).join('')}</select></label><label class="field">Ton commentaire<textarea name="note" rows="3" maxlength="3000" placeholder="Où, à quel moment, ce qui change…"></textarea></label><div class="notice" id="feedback-explainer">Le commentaire sera lié à cet exercice et à ses paramètres.</div><button type="submit" class="btn primary full">Enregistrer et voir les repères</button></section></div></form>`,true);
  }
  function bodyPointsRender() {
    if(!feedbackDraft)return;
    $('#feedback-body').innerHTML=B.maps({}, {interactive:true,points:feedbackDraft.points});
    $('#feedback-points').innerHTML=feedbackDraft.points.length?feedbackDraft.points.map((p,i)=>`<span class="zone-tag">${i+1}. ${esc(p.region)} ${esc(p.side)} · ${p.view==='front'?'face':'dos'}</span>`).join(''):'<p class="map-note">Aucune zone sélectionnée.</p>';
  }
  function adviceFor(f,e) {
    const base={version:1,createdAt:Date.now(),sourceIds:e.definition.source_ids||[],cues:[],ruleId:'technical-general-v1'};
    const phasePattern=f.phase?.includes('Descente')?/descend|redescend|retour|reviens|ramène/i:f.phase?.includes('Montée')?/monte|pousse|tire|ramène|étends/i:f.phase==='Installation'?/place|aligne|engage|garde/i:null;
    const phaseCue=phasePattern?e.definition.steps.find(step=>phasePattern.test(step)):null;
    const contextualCues=[...new Set([...(phaseCue?[phaseCue]:[]),...e.definition.key_cues])].slice(0,3);
    const ruleFor = id => D.adviceRules.find(r=>r.id===id);
    if(f.type==='pain') { const a=ruleFor('pain_stop'), b=ruleFor('persistent_pain');return {...base,ruleId:'pain-context-v1',sourceIds:[...new Set([...a.source_ids,...b.source_ids])],message:a.message+' '+b.message,cues:[]}; }
    if(f.type==='sensory') {const r=ruleFor('sensory_change');return {...base,ruleId:r.id+'-v1',sourceIds:r.source_ids,message:r.message,cues:[]};}
    if(f.type==='control') {const r=ruleFor('form_control');return {...base,ruleId:r.id+'-v1',sourceIds:[...r.source_ids,...base.sourceIds],message:r.message,cues:contextualCues};}
    if(f.type==='notfelt') {const r=ruleFor('low_muscle_sensation'),role=Object.entries(e.definition.muscle_roles).find(([k,ids])=>ids.includes(f.expectedMuscle))?.[0];const detail=f.expectedMuscle?' Dans cette variante, '+(D.muscles[f.expectedMuscle]||'ce muscle')+(role?' est répertorié en '+({primary:'cible principale',assistance:'assistance',stabilization:'stabilisation'}[role])+'.':' n’est pas une cible répertoriée ; la liste est simplifiée.') : '';return {...base,ruleId:r.id+'-v1',sourceIds:[...r.source_ids,...base.sourceIds],message:r.message+detail+' N’augmente pas automatiquement la charge pour rechercher une sensation.',cues:contextualCues};}
    if(f.type==='fine')return {...base,ruleId:'positive-log-v1',message:'Ce repère est enregistré pour la prochaine séance. Tu peux conserver les mêmes paramètres tant que le geste reste maîtrisé.'};
    return {...base,message:'Observe la qualité du geste et garde une respiration régulière. Ces repères concernent la technique générale ; ils ne déterminent pas la cause d’une gêne.',cues:e.definition.key_cues.slice(0,2)};
  }
  function openSettings() {
    showModal('Mon carnet & mes réglages',`<div class="settings-summary">${icon('save')}<div><strong>${esc(RenfoStorage.mode)}</strong><p>Les séances et commentaires restent sur cet appareil. Ils ne sont pas envoyés dans le dépôt ou vers un service d’IA.</p></div></div><form id="settings-form"><div class="form-grid"><label class="field">Objectif de séances / semaine<input name="weeklyGoal" type="number" min="1" max="14" value="${state.preferences.weeklyGoal||3}"></label><label class="checkbox-field"><input name="sounds" type="checkbox" ${state.preferences.sounds?'checked':''}> Signal sonore à la fin des minuteurs</label><label class="checkbox-field"><input name="wakeLock" type="checkbox" ${state.preferences.wakeLock?'checked':''}> Garder l’écran actif si disponible</label></div><h3>Mon matériel</h3><p class="subtle">À retrouver dans les filtres de la bibliothèque.</p><div class="equipment-checks">${Object.entries(equipmentNames).filter(([id])=>id!=='sans_materiel').map(([id,name])=>`<label><input type="checkbox" name="equipment" value="${id}" ${state.preferences.equipment?.includes(id)?'checked':''}>${name}</label>`).join('')}</div><button type="submit" class="btn primary">Enregistrer les réglages</button></form><hr><h3>Garder une copie</h3><p>Une sauvegarde exportée contient tes séances, modèles, notes et points corporels. Conserve-la dans un endroit personnel. Sans synchronisation, chaque appareil a son propre carnet.</p><p class="subtle">Dernier export : ${state.lastExport?date(state.lastExport,{hour:'2-digit',minute:'2-digit'}):'Pas encore d’export'}</p><div class="row-actions">${btn(icon('download')+' Exporter une sauvegarde','export')}${btn('Importer une sauvegarde','import-open')}${btn('Demander un stockage persistant','persist-storage','','plain')}</div><input type="file" id="import-file" accept="application/json,.json" hidden><hr><h3>Sur ton téléphone</h3><p>Utilise « Ajouter à l’écran d’accueil » dans le menu du navigateur. Après un premier chargement connecté, le contenu peut être conservé hors ligne.</p><p class="map-note">Le navigateur peut suspendre les sons et vibrations en arrière-plan. Les temps sont recalculés au retour à l’écran.</p><div class="row-actions">${btn('Préparer les images hors ligne','cache-images')}${btn('Vérifier les mises à jour','check-update','','plain')}</div><div id="offline-status" class="subtle" role="status"></div><hr><a href="assets/Fiches_initiales.pdf" target="_blank" rel="noopener">Télécharger les six fiches A4 initiales</a>`);
  }
  function downloadJSON(value, filename) {
    const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function exportState() { state.lastExport=Date.now();await save();downloadJSON({format:'renfo-backup',version:1,exportedAt:new Date().toISOString(),state},'renfo-sauvegarde-'+new Date().toISOString().slice(0,10)+'.json');toast('Sauvegarde exportée.'); }
  let importCandidate=null;
  async function prepareImport(file) {
    if(!file)return;if(file.size>30*1024*1024){toast('Ce fichier dépasse 30 Mo.');return;}
    try {importCandidate=C.validateBackup(JSON.parse(await file.text()));showModal('Importer ton carnet',`<p>Le fichier contient <strong>${importCandidate.sessions.length} séances</strong> et <strong>${importCandidate.templates.length} modèles</strong>.</p><p>Une copie de ton carnet actuel sera téléchargée avant l’import.</p><form id="import-form"><label class="radio-option"><input type="radio" name="mode" value="merge" checked><span><strong>Ajouter les éléments nouveaux</strong><small>Les éléments avec un identifiant déjà présent restent inchangés.</small></span></label><label class="radio-option"><input type="radio" name="mode" value="replace"><span><strong>Remplacer ce carnet</strong><small>Le fichier importé devient le carnet de cet appareil.</small></span></label><button class="btn primary" type="submit">Importer la sauvegarde</button></form>`);}
    catch(e){toast(e.message||'Fichier de sauvegarde illisible.');}
  }
  function customExerciseForm() {
    showModal('Mon exercice personnalisé',`<form id="custom-form"><label class="field">Nom<input name="name" required maxlength="100"></label><div class="form-grid"><label class="field">Famille<select name="category">${Object.entries(labels).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label><label class="field">Comptage<select name="execution_mode"><option value="repetitions">Répétitions</option><option value="duree">Durée</option></select></label><label class="field">Côtés<select name="laterality"><option value="bilateral">Ensemble</option><option value="unilateral">Gauche et droite séparés</option></select></label></div><label class="field">Objectif<input name="objective" maxlength="300" required></label><label class="field">Position de départ<textarea name="setup" rows="2" maxlength="1000" required></textarea></label><label class="field">Étapes (une par ligne)<textarea name="steps" rows="4" maxlength="4000" required></textarea></label><label class="field">Muscles principaux<select name="muscles" multiple size="5">${Object.entries(D.muscles).map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('')}</select><small>Plusieurs choix possibles avec Ctrl / Cmd.</small></label><button class="btn primary" type="submit">Créer mon exercice</button></form>`);
  }
  async function askConfirm(title, text, action, data='') {showModal(title,`<p>${text}</p><div class="dialog-footer">${btn('Annuler','close-modal')}${btn('Confirmer',action,data,'danger')}</div>`);}
  async function requestWakeLock() {
    if(state.preferences.wakeLock&&active()&&!active().pausedAt&&'wakeLock' in navigator){try{wakeLock=await navigator.wakeLock.request('screen');}catch{}}
  }
  let audioContext;
  function enableAudio(){try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();}catch{}}
  function beep(){if(!state.preferences.sounds||!audioContext)return;try{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.connect(gain);gain.connect(audioContext.destination);osc.frequency.value=660;gain.gain.setValueAtTime(.07,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.3);osc.start();osc.stop(audioContext.currentTime+.3);}catch{}}
  let restNotified=null,effortNotified=null;
  function tick() {
    $$('[data-clock]').forEach(el=>{const s=state.sessions.find(s=>s.id===el.dataset.clock);if(s)el.textContent=clock(C.elapsed(s));});
    const s=active();if(!s)return;
    for(const key of ['rest','effort']) {
      const remaining=s.pausedAt?s[key+'Remaining']:(s[key+'Until']?Math.max(0,s[key+'Until']-Date.now()):null),el=$('#'+key+'-clock');
      if(el)el.textContent=remaining===null?'00:00':clock(remaining+999);
      if(remaining!==null&&remaining<=0&&!s.pausedAt){
        if(key==='rest'&&restNotified!==s.restUntil){restNotified=s.restUntil;beep();toast('Repos terminé. À toi de reprendre quand tu es prêt.');}
        if(key==='effort'&&effortNotified!==s.effortUntil){effortNotified=s.effortUntil;beep();toast('Durée atteinte. Valide la série si elle est réalisée.');}
      }
    }
  }
  document.addEventListener('click',async event=>{
    const pointTarget=event.target.closest?.('[data-body-view]');
    if(pointTarget&&feedbackDraft){
      const box=pointTarget.getBoundingClientRect(),region=event.target.closest?.('[data-body-region]'),view=pointTarget.dataset.bodyView;
      const x=Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y=Math.max(0,Math.min(1,(event.clientY-box.top)/box.height));
      feedbackDraft.points.push({x,y,view,region:region?.dataset.bodyRegion||'Zone libre',side:region?.dataset.bodySide||(x>.46&&x<.54?'centre':view==='front'?(x<.5?'droite':'gauche'):(x<.5?'gauche':'droite'))});bodyPointsRender();return;
    }
    const button=event.target.closest?.('[data-action]');if(!button||button.disabled)return;
    const action=button.dataset.action,id=button.dataset.id,index=Number(button.dataset.index);
    if(pendingExternal&&!['reload','export','settings'].includes(action)){toast('Recharge les données modifiées dans une autre fenêtre.');return;}
    enableAudio();
    const s=currentSession(),entry=s?.entries[s.cursor];
    try {
      switch(action){
        case 'reload': location.reload();break;
        case 'settings':openSettings();break;
        case 'close-modal':closeModal();break;
        case 'go-templates':closeModal();navigate('templates');break;
        case 'go-history':closeModal();activeHistory=null;navigate('history');break;
        case 'sheet':openSheet(id);break;
        case 'session-sheet':openSheet(entry.exerciseId,entry.definition);break;
        case 'zoom-gesture':{const e=exercise(id);showModal(esc(e.name),`<div class="image-large"><img src="${esc(e.image)}" alt="${esc(e.name)}"></div>${btn('Revenir à la fiche','sheet',`data-id="${e.id}"`)}`,true);break;}
        case 'print-sheet':window.print();break;
        case 'library-tab':activeTab=id;render();break;
        case 'filter-favorites':onlyFavorites=!onlyFavorites;render();break;
        case 'reset-filters':search='';filterMuscle='';filterEquipment='';onlyFavorites=false;onlyMyEquipment=false;render();break;
        case 'favorite':state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];await save();$('#exercise-results')&&($('#exercise-results').innerHTML=exerciseResults());break;
        case 'save-note':state.exerciseNotes[id]=$('#pinned-note').value.trim();await save();toast('Repère personnel enregistré.');break;
        case 'new-template':openBuilder();break;
        case 'edit-template':openBuilder(id);break;
        case 'duplicate-template':{const t=C.clone(state.templates.find(x=>x.id===id));t.id=C.uid();t.name+=' · copie';t.items.forEach(p=>p.id=C.uid());state.templates.push(t);await save();render();toast('Séance dupliquée.');break;}
        case 'delete-template':askConfirm('Supprimer ce modèle ?','Les séances déjà réalisées seront conservées.','confirm-delete-template',`data-id="${id}"`);break;
        case 'confirm-delete-template':state.templates=state.templates.filter(t=>t.id!==id);await save();closeModal();render();break;
        case 'builder-add':openPicker('builder');break;
        case 'builder-warmup':chooseWarmup();break;
        case 'builder-up':case 'builder-down':{const to=index+(action==='builder-up'?-1:1);[draft.items[index],draft.items[to]]=[draft.items[to],draft.items[index]];renderBuilder();break;}
        case 'builder-remove':draft.items.splice(index,1);renderBuilder();break;
        case 'picker-category':openPicker(pickerTarget,id);break;
        case 'picker-done':if(pickerTarget==='builder')renderBuilder();else closeModal();break;
        case 'pick-exercise':{
          const ex=exercise(id);
          if(pickerTarget==='builder'){draft.items.push(C.item(ex));button.innerHTML=icon('check')+' Ajouté';toast(ex.name+' ajouté.');setTimeout(()=>{if(button.isConnected)button.innerHTML=icon('plus')+' Ajouter';},900);}
          else if(pickerTarget==='replace'){
            // Preserve performed rows as a separate completed entry before replacing its unfinished work.
            const old=currentSession().entries[currentSession().cursor],remaining=old.rows.filter(r=>r.status==='pending').length;
            if(old.rows.some(r=>r.status==='done')){old.rows=old.rows.filter(r=>r.status!=='pending');currentSession().entries.splice(currentSession().cursor+1,0,C.makeEntry(C.item(ex,{sets:Math.max(1,Math.ceil(remaining/(['unilateral','alterne'].includes(ex.laterality)?2:1)))}),ex));currentSession().cursor++;}
            else currentSession().entries[currentSession().cursor]=C.makeEntry(C.item(ex),ex);
            await save();closeModal();render();
          }else{const target=currentSession();target.entries.push(C.makeEntry(C.item(ex),ex));target.cursor=target.entries.length-1;await save();closeModal();render();}
          break;
        }
        case 'insert-warmup':{const r=D.routines.find(x=>x.id===id);draft.items.unshift(...r.exerciseIds.map(id=>{const ex=exercise(id);return C.item(ex,{block:'echauffement',sets:1,reps:ex.default_reps||6,load:0,duration:ex.default_duration||30,rest:10});}));renderBuilder();break;}
        case 'routine-template':{const r=D.routines.find(x=>x.id===id);draft={id:C.uid(),name:r.name,description:labels[r.family],mode:'classic',rounds:1,items:r.exerciseIds.map(id=>C.item(exercise(id),{block:r.family,sets:1,load:0,rest:10}))};renderBuilder();break;}
        case 'sheet-add':{
          const ex=exercise(id);closeModal();
          if(active()){activeHistory=null;active().entries.push(C.makeEntry(C.item(ex),ex));active().cursor=active().entries.length-1;await save();navigate('session');}
          else{openBuilder();draft.items.push(C.item(ex));renderBuilder();}break;
        }
        case 'start-template':await startTemplate(id);break;
        case 'quick-start':await quickStart();break;
        case 'resume-session':activeHistory=null;navigate('session');requestWakeLock();break;
        case 'session-add':openPicker('session');break;
        case 'session-replace':openPicker('replace');break;
        case 'select-entry':s.cursor=index;await save();render();break;
        case 'prev-entry':s.cursor=Math.max(0,s.cursor-1);await save();render();break;
        case 'next-entry':s.cursor=Math.min(s.entries.length-1,s.cursor+1);await save();render();window.scrollTo({top:0,behavior:'smooth'});break;
        case 'pause-session':if(s.pausedAt){C.resume(s);requestWakeLock();}else{C.pause(s);wakeLock?.release();}await save();render();break;
        case 'complete-set':case 'skip-set':C.complete(s,button.dataset.entry,button.dataset.row,action==='complete-set'?'done':'skipped');await save();render();break;
        case 'reopen-set':{const r=entry.rows.find(x=>x.id===button.dataset.row);r.status='pending';r.completedAt=null;await save();render();break;}
        case 'undo-set':C.undo(s);await save();render();break;
        case 'add-set':{const next=Math.max(0,...entry.rows.map(r=>r.number))+1;const last=entry.rows.at(-1);const rows=C.makeRows(entry.definition,{...entry.plan,sets:1,...last});rows.forEach(r=>r.number=next);entry.rows.push(...rows);await save();render();break;}
        case 'use-last':{const last=C.lastPerformance(state.sessions,entry.exerciseId,s.id);if(!last){toast('Aucune performance précédente à reprendre.');break;}for(const row of entry.rows.filter(r=>r.status==='pending')){for(const k of ['load','loadMode','band','reps','duration'])row[k]=last.row[k];}entry.plan.loadMode=last.row.loadMode;await save();render();toast('Dernières valeurs reprises pour les séries à venir.');break;}
        case 'start-effort':{if(s.pausedAt){toast('Reprends la séance avant de lancer le minuteur.');break;}const r=entry.rows.find(x=>x.id===button.dataset.row);s.effortUntil=Date.now()+r.duration*1000;s.effortRowId=r.id;effortNotified=null;await save();render();break;}
        case 'effort-stop':s.effortUntil=null;s.effortRemaining=null;s.effortRowId=null;await save();render();break;
        case 'rest-more':if(s.pausedAt)s.restRemaining=(s.restRemaining||0)+15000;else s.restUntil=Math.max(Date.now(),s.restUntil||Date.now())+15000;restNotified=null;await save();tick();break;
        case 'rest-skip':s.restUntil=null;s.restRemaining=null;await save();render();break;
        case 'finish-dialog':finishDialog();break;
        case 'open-session':activeHistory=id;navigate('session');break;
        case 'repeat-session':{
          if(active()){activeHistory=null;navigate('session');toast('Une séance est déjà en cours.');break;}
          const source=state.sessions.find(x=>x.id===id), t={id:null,name:source.name,items:source.entries.map(e=>{const first=e.rows.find(r=>r.status==='done');return {...e.plan,...(first?{load:first.load,loadMode:first.loadMode,reps:first.reps,duration:first.duration,band:first.band}:{}),exerciseId:e.exerciseId,sets:Math.max(1,new Set(e.rows.map(r=>r.number)).size)};})};
          const defs=source.entries.map(e=>e.definition),created=C.createSession(t,defs);state.sessions.unshift(created);state.activeId=created.id;activeHistory=null;await save();render();requestWakeLock();break;
        }
        case 'delete-session':askConfirm('Supprimer cette séance ?','Ses séries et commentaires seront retirés de ton historique.','confirm-delete-session',`data-id="${id}"`);break;
        case 'confirm-delete-session':state.sessions=state.sessions.filter(s=>s.id!==id);await save();closeModal();render();break;
        case 'history-day':historyDay=historyDay===id?'':id;render();break;
        case 'history-reset':historyDay='';render();break;
        case 'month-prev':case 'month-next':{const [y,m]=historyMonth.split('-').map(Number),d=new Date(y,m-1+(action==='month-prev'?-1:1),1);historyMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;historyDay='';render();break;}
        case 'stats-period':statsPeriod=id;selectedStatsMuscle='';render();break;
        case 'stats-muscle':selectedStatsMuscle=selectedStatsMuscle===id?'':id;render();break;
        case 'feedback-open':openFeedback();break;
        case 'clear-points':feedbackDraft.points=[];bodyPointsRender();break;
        case 'add-region':{
          const region=$('#feedback-region').value,side=$('#feedback-side').value;if(!region){toast('Choisis une zone.');break;}
          const regions={Nuque:[.5,.18,'back'],Épaule:[.29,.26,'front'],Bras:[.24,.35,'front'],'Avant-bras':[.21,.45,'front'],Poignet:[.19,.50,'front'],Poitrine:[.42,.28,'front'],'Haut du dos':[.42,.32,'back'],Lombaires:[.45,.46,'back'],Abdominaux:[.45,.4,'front'],Hanche:[.33,.51,'front'],Fessier:[.40,.55,'back'],Cuisse:[.38,.63,'front'],Genou:[.36,.72,'front'],Mollet:[.37,.80,'back'],Cheville:[.35,.90,'front'],Pied:[.35,.94,'front']};
          let [x,y,view]=regions[region];if(side==='centre')x=.5;else if((view==='front'&&side==='gauche')||(view==='back'&&side==='droite'))x=1-x;
          feedbackDraft.points.push({x,y,view,region,side});bodyPointsRender();break;
        }
        case 'delete-feedback':entry.feedback=entry.feedback.filter(f=>f.id!==id);await save();render();break;
        case 'feedback-outcome':entry.feedback.find(f=>f.id===id).outcome=button.dataset.value;await save();render();break;
        case 'export':await exportState();break;
        case 'import-open':if(active()){toast('Termine la séance en cours avant d’importer un carnet.');break;}$('#import-file').click();break;
        case 'persist-storage':toast(await navigator.storage?.persist?.()?'Stockage persistant accordé sur cet appareil.':'Le navigateur n’a pas accordé le stockage persistant. Garde une sauvegarde exportée.');break;
        case 'cache-images':await cacheOffline();break;
        case 'check-update':{const reg=await navigator.serviceWorker?.getRegistration();if(reg){await reg.update();toast(reg.waiting?'Une mise à jour est prête. Elle sera appliquée après fermeture des onglets Renfo.':'Vérification effectuée.');}else toast('Les mises à jour automatiques nécessitent la version hébergée.');break;}
        case 'custom-exercise':customExerciseForm();break;
      }
    }catch(error){console.error(error);toast(error.message||'Cette action n’a pas pu être terminée.');}
  });
  document.addEventListener('input',event=>{
    const el=event.target;
    if(pendingExternal)return;
    if(el.dataset.plan && el.type==='number' && el.value!=='' && el.checkValidity())draft.items[Number(el.dataset.index)][el.dataset.plan]=Number(el.value);
    if(el.id==='entry-rest' && el.value!=='' && el.checkValidity()){const session=currentSession();if(session?.entries[session.cursor]){session.entries[session.cursor].plan.rest=Number(el.value);save();}}
    if(el.dataset.setField && (el.type!=='number' || (el.value!=='' && el.checkValidity()) || (el.dataset.setField==='effort' && el.value===''))){
      const session=currentSession(), entry=session?.entries.find(e=>e.id===el.dataset.entry), row=entry?.rows.find(r=>r.id===el.dataset.row),key=el.dataset.setField;
      if(row){row[key]=key==='band'?el.value:(key==='effort'&&el.value===''?'':Number(el.value));save();}
    }
    if(el.id==='entry-note'){const session=currentSession();if(session?.entries[session.cursor]){session.entries[session.cursor].note=el.value;save();}}
    if(el.id==='exercise-search'){search=el.value;$('#exercise-results').innerHTML=exerciseResults();}
    if(el.id==='picker-search')$('#picker-list').innerHTML=pickerList(el.value,el.dataset.category);
    if(el.id==='template-name'&&draft)draft.name=el.value;
    if(el.id==='template-description'&&draft)draft.description=el.value;
  });
  document.addEventListener('change',async event=>{
    const el=event.target,s=currentSession(),entry=s?.entries[s.cursor];
    if(pendingExternal){toast('Recharge pour continuer.');return;}
    if(el.type==='number'&&!el.checkValidity()){el.reportValidity();return;}
    try{
      if(el.dataset.plan){const p=draft.items[Number(el.dataset.index)],key=el.dataset.plan;p[key]=['sets','reps','duration','load','rest'].includes(key)?Number(el.value):el.value;if(['block','loadMode'].includes(key))renderBuilder();return;}
      if(el.dataset.setField){const target=s.entries.find(x=>x.id===el.dataset.entry),row=target.rows.find(x=>x.id===el.dataset.row),key=el.dataset.setField;row[key]=key==='band'?el.value:(key==='effort'&&el.value===''?'':Number(el.value));await save();return;}
      switch(el.id){
        case 'my-equipment-filter':onlyMyEquipment=el.checked;$('#exercise-results').innerHTML=exerciseResults();break;
        case 'muscle-filter':filterMuscle=el.value;$('#exercise-results').innerHTML=exerciseResults();break;
        case 'equipment-filter':filterEquipment=el.value;$('#exercise-results').innerHTML=exerciseResults();break;
        case 'template-mode':draft.mode=el.value;renderBuilder();break;
        case 'template-rounds':draft.rounds=Number(el.value);renderBuilder();break;
        case 'guided-mode':s.guided=el.checked;await save();break;
        case 'entry-load-mode':entry.plan.loadMode=el.value;entry.rows.filter(r=>r.status==='pending').forEach(r=>r.loadMode=el.value);await save();render();break;
        case 'entry-rest':entry.plan.rest=Number(el.value);await save();break;
        case 'entry-note':entry.note=el.value;await save();break;
        case 'history-month':if(el.value){historyMonth=el.value;historyDay='';render();}break;
        case 'stats-role':statsRole=el.value;render();break;
        case 'progress-exercise':$('#progress-details').innerHTML=progressDetails(el.value);break;
        case 'feedback-type':$('#pain-fields').hidden=el.value!=='pain';$('#notfelt-fields').hidden=el.value!=='notfelt';$('#feedback-explainer').textContent=el.value==='pain'?'Une douleur ne se déduit pas d’un schéma : le retour sera enregistré, avec des repères de prudence et sans diagnostic.':'Le commentaire sera lié à cet exercice et à ses paramètres.';break;
        case 'import-file':await prepareImport(el.files[0]);break;
      }
    }catch(error){toast(error.message);}
  });
  document.addEventListener('submit',async event=>{
    const form=event.target;if(!['template-form','finish-form','feedback-form','settings-form','import-form','custom-form'].includes(form.id))return;
    event.preventDefault();if(!form.reportValidity())return;if(pendingExternal){toast('Recharge les données avant de continuer.');return;}
    const fd=new FormData(form);
    try {
      switch(form.id){
        case 'template-form':{
          if(!draft.items.length){toast('Ajoute au moins un exercice.');return;}
          for(const input of $$('[data-plan]',form)){const p=draft.items[Number(input.dataset.index)],k=input.dataset.plan;if(!input.disabled)p[k]=['sets','reps','duration','load','rest'].includes(k)?Number(input.value):input.value;}
          draft.mode=$('#template-mode').value;draft.rounds=Number($('#template-rounds').value)||3;
          draft.name=$('#template-name').value.trim();if(!draft.name){toast('Donne un nom à la séance.');return;}
          const i=state.templates.findIndex(t=>t.id===draft.id);if(i>=0)state.templates[i]=C.clone(draft);else state.templates.push(C.clone(draft));await save();closeModal();navigate('templates');toast('Séance enregistrée.');draft=null;break;
        }
        case 'finish-form':{
          const s=active();s.note=fd.get('note').trim();C.finish(s);state.activeId=null;await save();wakeLock?.release();closeModal();activeHistory=null;navigate('history');toast('Séance enregistrée dans ton historique.');break;
        }
        case 'feedback-form':{
          const s=state.sessions.find(s=>s.id===feedbackDraft.sessionId),e=s.entries.find(e=>e.id===feedbackDraft.entryId),row=e.rows.find(r=>r.id===fd.get('rowId'));
          const f={...feedbackDraft,type:fd.get('type'),intensity:Number(fd.get('intensity')),timing:fd.get('timing'),phase:fd.get('phase'),rowId:row?.id||null,rowSnapshot:row?C.clone(row):null,expectedMuscle:fd.get('expectedMuscle'),feltInstead:fd.get('feltInstead'),note:fd.get('note').trim(),createdAt:Date.now(),outcome:null};
          f.advice=adviceFor(f,e);e.feedback.push(f);await save();closeModal();render();toast('Commentaire enregistré. Les repères sont sous les séries.');break;
        }
        case 'settings-form':state.preferences={...state.preferences,weeklyGoal:Number(fd.get('weeklyGoal')),sounds:fd.has('sounds'),wakeLock:fd.has('wakeLock'),equipment:fd.getAll('equipment')};await save();closeModal();render();toast('Réglages enregistrés.');break;
        case 'import-form':{
          if(!importCandidate)return;
          downloadJSON({format:'renfo-backup',version:1,state},'renfo-avant-import-'+new Date().toISOString().slice(0,10)+'.json');
          if(fd.get('mode')==='replace'){state=importCandidate;}
          else {
            for(const field of ['templates','sessions','customExercises']){const ids=new Set(state[field].map(x=>x.id));state[field].push(...importCandidate[field].filter(x=>!ids.has(x.id)));}
            state.favorites=[...new Set([...state.favorites,...importCandidate.favorites])];state.exerciseNotes={...importCandidate.exerciseNotes,...state.exerciseNotes};
            if(!state.activeId&&importCandidate.activeId&&state.sessions.some(x=>x.id===importCandidate.activeId))state.activeId=importCandidate.activeId;
          }
          await save();importCandidate=null;closeModal();render();toast('Import terminé.');break;
        }
        case 'custom-form':{
          const e={id:'custom-'+C.uid(),name:fd.get('name').trim(),aliases:[],category:fd.get('category'),equipment:[],difficulty:'debutant',movement_patterns:[],execution_mode:fd.get('execution_mode'),laterality:fd.get('laterality'),repetition_counting:fd.get('laterality')==='unilateral'?'par_cote':'total',counting_instructions:fd.get('laterality')==='unilateral'?'Enregistre chaque côté séparément.':'Un aller-retour compte une répétition.',load_input:'none',load_instructions:'Sans charge externe par défaut ; modifiable dans la séance.',muscle_roles:{primary:fd.getAll('muscles'),assistance:[],stabilization:[]},objective:fd.get('objective').trim(),setup:fd.get('setup').trim(),steps:fd.get('steps').split('\n').map(x=>x.trim()).filter(Boolean),breathing:'Garde une respiration régulière.',tempo:'Choisis un rythme maîtrisé.',key_cues:[],common_mistakes:[],easier_variant:'À préciser dans tes notes.',harder_variant:'À préciser dans tes notes.',substitution_ids:[],source_ids:[],editorial_notes:['Exercice personnel, rédigé par l’utilisateur.']};
          if(!e.name||!e.steps.length){toast('Le nom et les étapes sont nécessaires.');return;}
          state.customExercises.push(e);await save();closeModal();activeTab=C.family(e);navigate('library');toast('Exercice ajouté à ta bibliothèque.');break;
        }
      }
    }catch(error){console.error(error);toast(error.message||'Enregistrement impossible.');}
  });
  async function cacheOffline(){
    const out=$('#offline-status');
    if(!('caches' in window)||location.protocol==='file:'){toast('Le mode hors ligne installable nécessite la version hébergée.');return;}
    try{const cache=await caches.open(D.cacheName||'renfo-assets-v1'),urls=[...new Set(D.exercises.filter(e=>e.image).map(e=>e.image))];let done=0,failed=0;
      for(const url of urls){try{const response=await fetch(url);if(!response.ok)throw Error();await cache.put(url,response);done++;}catch{failed++;}if(out)out.textContent=`${done} / ${urls.length} illustrations enregistrées hors ligne…`;}
      if(out)out.textContent=failed?`${done} images disponibles ; ${failed} échecs. Réessaie une fois connecté.`:`Les ${done} illustrations sont prêtes hors ligne.`;
    }catch{toast('Espace de stockage indisponible.');}
  }
  window.addEventListener('hashchange',()=>{route=location.hash.slice(1)||'home';if(route!=='session')activeHistory=null;render();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){tick();requestWakeLock();}});
  document.addEventListener('error',event=>{const img=event.target;if(img instanceof HTMLImageElement&&img.classList.contains('exercise-image')){const p=document.createElement('div');p.className='movement-text';p.textContent='Illustration indisponible hors ligne. Ouvre la fiche pour les consignes.';img.replaceWith(p);}},true);
  try {
    const restored=await RenfoStorage.open();
    state=restored?C.validateBackup(restored):C.newState(seeds());
    if(!restored)await save();
    if('BroadcastChannel' in window){channel=new BroadcastChannel('renfo-updates');channel.onmessage=event=>{if(event.data.updatedAt>state.updatedAt){pendingExternal=event.data;toast('Ton carnet a changé dans une autre fenêtre. Recharge pour continuer.');render();}};}
    initialized=true;route=location.hash.slice(1)||'home';render();setInterval(tick,500);
    if(RenfoStorage.error)toast(RenfoStorage.error);
    if('serviceWorker' in navigator&&location.protocol!=='file:'&&location.hostname!=='127.0.0.1'&&location.hostname!=='localhost')navigator.serviceWorker.register('sw.js').catch(()=>{});
  }catch(error){
    console.error(error);$('#app').innerHTML=`<main class="loading-screen"><h1>Ton carnet n’a pas pu s’ouvrir</h1><p>Les données existantes n’ont pas été effacées.</p><p>${esc(error.message)}</p><button class="btn primary" id="rescue-export">Exporter les données pour les récupérer</button></main>`;
    $('#rescue-export').onclick=async()=>{const stored=await RenfoStorage.open();downloadJSON({format:'renfo-backup',version:1,state:stored},'renfo-recuperation.json');};
  }
})();
