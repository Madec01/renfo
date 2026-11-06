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
  let builderScope='personal', pickerBlock=null, routineTarget='builder';
  const person=()=>state.profiles.find(p=>p.id===state.currentProfileId);
  const mySessions=()=>C.personalSessions(state);
  const personalTemplate=t=>C.templateForProfile(t,state.currentProfileId);
  const activeMode=()=>trainingPrefs().visibility==='active' && route==='session' && !activeHistory && !!active();
  const active = () => sharedActive();
  const currentSession = () => activeHistory ? state.sessions.find(s=>s.id === activeHistory) : active();
  const roleLegend = (family='renforcement') => `<div class="legend"><span><i class="dot primary"></i>${family==='etirements'?'Zone étirée':family==='mobilisation'?'Zone mobilisée':'Principal'}</span><span><i class="dot assistance"></i>Assistance</span><span><i class="dot stabilization"></i>Stabilisation</span></div>`;
  function syncEditedWorkouts(){
    // Historical edits can remove a person's entry or move it to another phase.
    for(const w of state.workouts||[]){const moved=[];
      for(const slot of w.slots)for(const [pid,eid] of Object.entries(slot.entries)){
        const entry=C.workoutSession(state,w,pid)?.entries.find(e=>e.id===eid);
        if(!entry)delete slot.entries[pid];
        else if(entry.plan.block!==slot.block){delete slot.entries[pid];moved.push({id:C.uid(),block:entry.plan.block,entries:{[pid]:eid}});}
      }
      w.slots=[...w.slots.filter(slot=>Object.keys(slot.entries).length),...moved];w.cursor=Math.max(0,Math.min(w.cursor,w.slots.length-1));
    }
    for(const s of state.sessions){s.cursor=Math.max(0,Math.min(s.cursor,s.entries.length-1));
      if(s.undo&&!s.entries.find(e=>e.id===s.undo.entryId)?.rows.some(r=>r.id===s.undo.rowId))s.undo=null;
      if(s.effortRowId&&!s.entries.some(e=>e.rows.some(r=>r.id===s.effortRowId)))s.effortUntil=s.effortRemaining=s.effortRowId=null;
    }
    C.syncActivePointers(state);
  }
  function sourceLinks(ids) { return (ids || []).map(id => D.sources.find(x => x.id === id)).filter(Boolean).map(s => `<li><a href="${safeURL(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join(''); }
  function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('#toast').classList.remove('visible'),3500); }
  async function save() {
    if (pendingExternal) { toast('Une autre fenêtre a modifié les données. Recharge avant de continuer.'); return false; }
    syncEditedWorkouts();
    C.captureProfile(state);
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
    const source=e.image||exercise(e.id)?.image;
    if (source) return `<img class="exercise-image ${cls}" src="${esc(source)}" alt="Positions clés : ${esc(e.name)}" loading="${loading}" decoding="async">`;
    return `<div class="movement-text ${cls}">${icon(C.family(e)==='etirements'?'body':'workout')}<span>${esc(e.setup)}</span><small>Consignes détaillées dans la fiche</small></div>`;
  }
  function frame() {
    const nav = [['home','home','Accueil'],['templates','workout','Séances'],['library','library','Exercices'],['history','history','Historique'],['stats','chart','Bilan']];
    $('#app').innerHTML = `<aside class="sidebar"><a class="brand" href="#home" aria-label="Renfo, accueil"><span class="brand-mark">r.</span><span>renfo<span class="brand-dot">.</span></span></a><div class="nav-caption">TON ESPACE</div><nav aria-label="Navigation principale">${nav.map(([r,i,l])=>`<a href="#${r}" class="nav-link ${route===r?'active':''}" ${route===r?'aria-current="page"':''}>${icon(i)}<span>${l}</span></a>`).join('')}</nav><div class="sidebar-bottom"><div class="local-badge"><span class="status-dot"></span>Votre carnet commun</div>${btn(icon('settings')+' Réglages','settings','','plain')}</div></aside>
    <div class="workspace"><header class="topbar">${['history','stats'].includes(route)?`<label class="profile-switch"><span>Suivi de</span><select id="profile-select" aria-label="Personne suivie">${state.profiles.map(p=>`<option value="${p.id}" ${p.id===state.currentProfileId?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>${ibtn('plus','Gérer les personnes','profiles')}`:'<span class="mobile-brand">renfo.</span>'}<span class="breadcrumb">MON ENTRAÎNEMENT <span>/</span> ${nav.find(x=>x[0]===route)?.[2] || 'Séance en cours'}</span><div class="top-actions"><span class="save-status"></span>${ibtn('settings','Réglages et sauvegardes','settings')}</div></header><main id="main" tabindex="-1"></main><footer class="app-footer">À ton rythme, une séance après l’autre.<span>Renfo · 3.0</span></footer></div>
    <nav class="mobile-nav" aria-label="Navigation mobile">${nav.map(([r,i,l])=>`<a href="#${r}" class="${route===r?'active':''}" ${route===r?'aria-current="page"':''}>${icon(i)}<span>${l}</span></a>`).join('')}</nav>`;
    if (pendingExternal) $('#main').insertAdjacentHTML('beforebegin',`<div class="notice warning">Une autre fenêtre a modifié ton carnet. ${btn('Recharger les données','reload')}</div>`);
    updateSaveStatus();
  }
  function heading(kicker,title,description,action='') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1>${description?`<p>${description}</p>`:''}</div>${action}</div>`; }
  function empty(iconName,title,text,action='') { return `<div class="empty-state">${icon(iconName)}<h3>${title}</h3><p>${text}</p>${action}</div>`; }
  function render() {
    if (!initialized) return;
    document.body.dataset.route=route;
    document.body.classList.toggle('distance-mode',activeMode());
    frame();
    const pages = {home:sharedHome,templates:sharedTemplates,library:libraryPage,history:historyPage,stats:statsPage,session:sessionPage};
    $('#main').innerHTML = (pages[route] || homePage)();
    tick();
  }
  function navigate(page) { if(location.hash.slice(1)===page){route=page;render();}else location.hash=page; window.scrollTo({top:0,behavior:'instant'}); }
  function homePage() {
    const done = mySessions().filter(s=>s.status==='completed'), week = recentSessions('week'), total=C.totals(week), s=active();
    const goal=Math.max(1,Number(state.preferences.weeklyGoal)||3), weekly=week.length;
    const model=state.templates[0]&&personalTemplate(state.templates[0]);
    return heading(date(Date.now(),{weekday:'long'}).toUpperCase(),'Le carnet de '+esc(person().name),'Prépare ta séance, puis passe en mode Actif pour la suivre à distance.',btn(icon('plus')+' Séance libre','quick-start','','primary'))+
      (s?`<div class="resume-banner"><div><span class="status-dot"></span><strong>Une séance t’attend</strong><span>${esc(s.name)} · <span data-clock="${s.id}">${clock(C.elapsed(s))}</span></span></div>${btn('Reprendre '+icon('arrow'),'resume-session','','primary')}</div>`:'')+
      `<section class="dashboard-hero compact-hero"><div class="hero-copy"><span class="pill">TA PROCHAINE SÉANCE</span><h2>${esc(model?.name||'À toi de composer')}</h2><p>Quatre blocs, dans l’ordre qui te convient. Choisis les mouvements et ajuste chaque série.</p><div class="phase-chips">${C.blocks.map(b=>`<span class="phase-chip ${b}">${labels[b]}</span>`).join('')}</div>${model?btn(icon('play')+' Commencer','start-template',`data-id="${model.id}"`,'lime')+btn('Adapter ma version','edit-template',`data-id="${model.id}"`,'secondary'):btn('Créer ma séance','new-template','','lime')}</div><div class="hero-visual">${photo(exercise('squat-goblet'),'hero-person','eager')}</div></section>
      <section class="stat-grid"><div class="stat-card"><span>Séances cette semaine</span><strong>${weekly}<small> / ${goal}</small></strong><div class="mini-progress"><i style="width:${Math.min(100,weekly/goal*100)}%"></i></div></div><div class="stat-card"><span>Temps d’entraînement</span><strong>${n(Math.round(total.durationMs/60000))}<small> min</small></strong><p>Cette semaine · pauses exclues</p></div><div class="stat-card"><span>Muscles sollicités</span><strong>${Object.keys(total.muscles).length}<small> groupes</small></strong><p>Sur tes séries de renforcement validées</p></div></section>
      <div class="section-heading"><h2>Tes séances</h2><a href="#templates">Tout voir ${icon('arrow')}</a></div><div class="template-grid">${state.templates.slice(0,3).map(templateCard).join('')||empty('workout','Un premier repère','Crée une séance qui te ressemble.',btn('Créer une séance','new-template'))}</div>
      <div class="home-bottom"><section class="panel"><div class="section-heading"><h2>Ton dernier entraînement</h2><a href="#history">Historique</a></div>${done.length?sessionCard([...done].sort((a,b)=>b.startedAt-a.startedAt)[0]):`<div class="quiet-empty">${icon('history')}<div><strong>Le début de ton histoire</strong><p>Ta première séance apparaîtra ici une fois terminée.</p></div></div>`}</section><section class="panel tip-panel"><span class="eyebrow">LE BON REPÈRE</span><h3>Le geste avant le chiffre.</h3><p>Retrouve les positions clés et les muscles concernés sur chaque fiche, même pendant une séance.</p><a href="#library">Ouvrir les exercices ${icon('arrow')}</a></section></div>`;
  }
  function templateCard(base) {
    const t=personalTemplate(base);
    const roles = {primary:[],assistance:[],stabilization:[]};
    for(const p of t.items) { const e=exercise(p.exerciseId); if(e) roles.primary.push(...e.muscle_roles.primary); }
    return `<article class="template-card"><div class="template-top"><span class="template-icon">${icon('workout')}</span><span class="pill muted">${t.mode==='circuit'?'Circuit · '+t.rounds+' tours':t.items.length+' exercices'}</span><div class="menu-pair">${ibtn('copy','Dupliquer '+t.name,'duplicate-template',`data-id="${t.id}"`)}${ibtn('edit','Modifier '+t.name,'edit-template',`data-id="${t.id}"`)}</div></div><h3>${esc(t.name)}</h3><span class="version-label">${base.variants?.[state.currentProfileId]?'Version de '+esc(person().name):'Base commune'}</span><div class="phase-chips">${C.blocks.filter(b=>t.items.some(p=>p.block===b)).map(b=>`<span class="phase-chip ${b}">${labels[b]} · ${t.items.filter(p=>p.block===b).length}</span>`).join('')}</div><p>${esc(t.description || t.items.map(p=>exercise(p.exerciseId)?.name).filter(Boolean).slice(0,3).join(' · '))}</p><div class="template-meta">${icon('timer')} Environ ${C.estimate(t,catalog())} min <span>·</span> ${t.items.length} mouvements</div><div class="card-actions">${btn('Commencer '+icon('arrow'),'start-template',`data-id="${t.id}"`,'primary')} ${ibtn('trash','Supprimer le modèle '+t.name,'delete-template',`data-id="${t.id}"`)}</div></article>`;
  }
  function templatesPage() {
    return heading('À TA FAÇON','Mes séances','Base commune ou version de '+esc(person().name)+' : mêmes mouvements ou programme différent, à toi de choisir.',btn(icon('plus')+' Nouvelle séance','new-template','','primary'))+
      `<div class="template-grid">${state.templates.map(templateCard).join('')}</div><div class="section-heading"><h2>Préparer, mobiliser, étirer</h2><p>Des propositions à personnaliser</p></div><div class="routine-grid">${(D.routines||[]).map(r=>`<article class="routine-card"><span class="pill ${r.family}">${labels[r.family]}</span><h3>${esc(r.name)}</h3><p>${r.exerciseIds.length} mouvements · paramètres modifiables</p>${btn('Personnaliser '+icon('arrow'),'routine-template',`data-id="${r.id}"`)}</article>`).join('')}</div>`;
  }
  function filteredExercises() {
    const normalize=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    return catalog().filter(e=>C.family(e)===activeTab && (!search||normalize(e.name+' '+(e.aliases||[]).join(' ')+' '+Object.values(e.muscle_roles).flat().map(m=>D.muscles[m]||m).join(' ')).includes(normalize(search))) && (!filterMuscle||Object.values(e.muscle_roles).flat().includes(filterMuscle)) && (!filterEquipment||(filterEquipment==='none'?!(e.equipment||[]).some(x=>['haltere','halteres','elastique','banc_stable'].includes(x)):e.equipment.includes(filterEquipment))) && (!onlyFavorites||state.favorites.includes(e.id)) && (!onlyMyEquipment || e.equipment.every(x => ['tapis','mur','serviette','sans_materiel'].includes(x) || state.preferences.equipment.includes(x))));
  }
  function libraryPage() {
  const hasFilters = !!(filterMuscle || filterEquipment || onlyFavorites || onlyMyEquipment);
  return `<section class="library-v3">${heading('LES FICHES', 'Exercices', 'Choisis un mouvement pour retrouver le geste et les muscles concernés.')}
    <div class="library-families" role="group" aria-label="Famille de mouvements">${Object.entries(labels).map(([id,label])=>`<button type="button" aria-pressed="${activeTab===id}" class="${activeTab===id?'selected':''}" data-action="library-tab" data-id="${id}">${label}<span>${catalog().filter(e=>C.family(e)===id).length}</span></button>`).join('')}</div>
    <label class="search-field library-search">${icon('search')}<input id="exercise-search" type="search" placeholder="Un exercice ou un muscle…" value="${esc(search)}" aria-label="Rechercher un exercice ou un muscle"></label>
    <details class="library-filters" ${hasFilters?'open':''}>
      <summary><span>${icon('settings')} Filtres</span><small>Muscles, matériel, favoris</small></summary>
      <div class="library-filter-fields">
        <label class="field">Muscle<select id="muscle-filter"><option value="">Tous les muscles</option>${Object.entries(D.muscles).map(([id,name])=>`<option value="${id}" ${filterMuscle===id?'selected':''}>${esc(name)}</option>`).join('')}</select></label>
        <label class="field">Matériel<select id="equipment-filter"><option value="">Tout le matériel</option><option value="none" ${filterEquipment==='none'?'selected':''}>Sans charge ni élastique</option>${['haltere','halteres','elastique','banc_stable'].map(id=>`<option value="${id}" ${filterEquipment===id?'selected':''}>${equipmentNames[id]}</option>`).join('')}</select></label>
        <label class="inventory-filter"><input type="checkbox" id="my-equipment-filter" ${onlyMyEquipment?'checked':''}> Avec mon matériel disponible</label>
        <button type="button" class="btn ${onlyFavorites?'primary':'secondary'}" aria-pressed="${onlyFavorites}" data-action="filter-favorites">${icon('star')} Mes favoris</button>
      </div>
    </details>
    <div id="exercise-results">${exerciseResults()}</div>
    <div class="library-custom"><span>Un mouvement à toi ?</span>${btn(icon('plus')+' Créer un exercice','custom-exercise','','plain')}</div>
  </section>`;
}

  function exerciseResults() {
  const list = filteredExercises();
  const filters = [filterMuscle && (D.muscles[filterMuscle] || filterMuscle),filterEquipment && (filterEquipment==='none'?'Sans charge':equipmentNames[filterEquipment] || filterEquipment),onlyFavorites && 'Favoris',onlyMyEquipment && 'Mon matériel'].filter(Boolean);
  return `<div class="library-results-bar"><p class="results-count" role="status" aria-live="polite">${list.length} mouvement${list.length>1?'s':''}${filters.length?`<span>${filters.map(esc).join(' · ')}</span>`:''}</p>${filters.length || search?btn('Tout afficher','reset-filters','','plain'):''}</div>
    <div class="exercise-grid library-grid">${list.map(e=>{
      const family=C.family(e), areas=family==='etirements'?'Zones étirées':family==='mobilisation'?'Zones mobilisées':'Muscles';
      const targets=e.muscle_roles.primary.map(m=>D.muscles[m]||m).slice(0,3).join(' · ') || (e.target_regions||[]).join(' · ');
      const equipment=e.equipment.filter(x=>x!=='tapis').slice(0,2).map(x=>equipmentNames[x]||x.replaceAll('_',' ')).join(' + ') || 'Poids du corps';
      return `<article class="exercise-card library-card-v3">
        <div class="library-card-heading"><h2>${esc(e.name)}</h2>${ibtn('star',state.favorites.includes(e.id)?'Retirer '+e.name+' des favoris':'Ajouter '+e.name+' aux favoris','favorite',`data-id="${e.id}" aria-pressed="${state.favorites.includes(e.id)}"`)}</div>
        <div class="exercise-visuals">
          <button type="button" class="gesture-preview" data-action="sheet" data-id="${e.id}" aria-label="Voir la fiche du mouvement : ${esc(e.name)}">${photo(e)}<span>Geste</span></button>
          <button type="button" class="muscle-preview" data-action="sheet" data-id="${e.id}" aria-label="Voir la fiche et les muscles : ${esc(e.name)}">${B.maps(e.muscle_roles,{compact:true,targetRegions:e.target_regions})}<span>${areas}</span></button>
        </div>
        <div class="exercise-card-info"><p class="library-targets">${esc(targets)}</p><div class="exercise-card-footer"><span>${esc(equipment)}</span><button type="button" data-action="sheet" data-id="${e.id}" class="text-btn" aria-label="Ouvrir la fiche : ${esc(e.name)}">La fiche ${icon('arrow')}</button></div></div>
      </article>`;
    }).join('') || empty('search','Aucun mouvement trouvé','Essaie un autre mot ou enlève un filtre.',btn('Réinitialiser les filtres','reset-filters'))}</div>`;
}

  function showModal(title,html,wide=false) {
    if(!$('#dialog'))modalReturnFocus=document.activeElement;
    $('#modal-root').innerHTML=`<dialog id="dialog" class="${wide?'wide':''}" aria-labelledby="dialog-title"><div class="dialog-head"><h2 id="dialog-title">${title}</h2>${ibtn('close','Fermer','close-modal')}</div><div class="dialog-content">${html}</div></dialog>`;
    const d=$('#dialog'); d.showModal(); d.addEventListener('cancel',e=>{e.preventDefault();closeModal();});
    d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
  }
  function closeModal() { $('#dialog')?.close(); $('#modal-root').innerHTML=''; modalReturnFocus?.isConnected&&modalReturnFocus.focus(); feedbackDraft=null; }
  function openSheet(id, definition) {
  sheetPerson=activeHistory?currentSession()?.profileId:$('#builder-adjust-form')?builderPerson:route==='session'&&workout()?(trainingPerson||workout().participantIds[0]):state.currentProfileId;
    const e=definition||exercise(id); if(!e)return;
  const family=C.family(e), roleContext=family==='etirements'?'Zones étirées':family==='mobilisation'?'Zones mobilisées':'Muscles sollicités';
  const note=(sheetPerson===state.currentProfileId?state.exerciseNotes:state.profileData[sheetPerson]?.exerciseNotes)?.[e.id]||'';
  showModal(esc(e.name),`<section class="sheet-v3">
    <div class="sheet-toolbar"><span class="pill">${labels[family]}</span><span>${esc(e.equipment.map(x=>equipmentNames[x]||x.replaceAll('_',' ')).join(' · '))}</span><span class="sheet-level">${e.difficulty==='intermediaire'?'Intermédiaire':'Accessible'}</span></div>
    <p class="sheet-objective-v3">${esc(e.objective)}</p>
    <div class="sheet-guide-grid">
      <fieldset class="sheet-visual-switch"><legend class="sr-only">Choisir une illustration</legend>
        <input class="sheet-view-input" type="radio" name="sheet-visual" id="sheet-view-gesture" checked><label for="sheet-view-gesture">Geste</label>
        <input class="sheet-view-input" type="radio" name="sheet-visual" id="sheet-view-muscles"><label for="sheet-view-muscles">${family==='etirements'||family==='mobilisation'?'Zones du corps':'Muscles'}</label>
        <figure class="sheet-visual-gesture">${e.image?`<button type="button" class="zoom-image" data-action="zoom-gesture" data-id="${e.id}" aria-label="Agrandir les positions du mouvement">${photo(e,'','eager')}</button>`:photo(e,'','eager')}<figcaption>${e.image?'Toucher l’image pour agrandir':'Positions clés du mouvement'}</figcaption></figure>
        <div class="sheet-visual-muscles"><figure>${B.maps(e.muscle_roles,{targetRegions:e.target_regions})}<figcaption>${roleContext}</figcaption></figure>${roleLegend(family)}<div class="muscle-details">${Object.entries({primary:family==='etirements'?'Zones étirées':family==='mobilisation'?'Zones mobilisées':'Muscles principaux',assistance:'En assistance',stabilization:'En stabilisation'}).map(([r,l])=>`<div><strong>${l}</strong><p>${e.muscle_roles[r].map(m=>esc(D.muscles[m]||m)).join(', ')||'—'}</p></div>`).join('')}</div><p class="map-note">Carte simplifiée. Les muscles profonds sont représentés par leur région. Les couleurs indiquent un rôle, pas une intensité mesurée.</p></div>
      </fieldset>
      <section class="sheet-essentials"><h3>Installe-toi</h3><p>${esc(e.setup)}</p><h3>Le mouvement</h3><ol class="step-list">${e.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></section>
    </div>
    <details class="sheet-extra"><summary>Repères, respiration et erreurs à éviter</summary><div class="sheet-extra-content"><h3>Les bons repères</h3><ul class="check-list">${e.key_cues.map(x=>`<li>${icon('check')}${esc(x)}</li>`).join('')}</ul><div class="cue-box"><strong>Respiration et rythme</strong><p>${esc(e.breathing)}</p><p>${esc(e.tempo)}</p></div><h3>À éviter</h3><ul>${e.common_mistakes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></details>
    <details class="sheet-extra"><summary>Adapter le mouvement et compter</summary><div class="sheet-extra-content"><p><strong>Plus accessible :</strong> ${esc(e.easier_variant)}</p><p><strong>Progression :</strong> ${esc(e.harder_variant)}</p><h3>Répétitions et charge</h3><p>${esc(e.counting_instructions||'Enregistre la durée ou les répétitions de chaque côté séparément si nécessaire.')}</p><p>${esc(e.load_instructions||loadNames[e.load_input]||'Sans charge externe.')}</p></div></details>
    <details class="sheet-extra" ${note?'open':''}><summary>Note de ${esc(participantName(sheetPerson))}${note?' · enregistrée':''}</summary><div class="sheet-extra-content"><label class="field">Un repère pour la prochaine fois<textarea id="pinned-note" rows="3" maxlength="3000" placeholder="Le réglage ou le conseil qui t’aide…">${esc(note)}</textarea></label>${btn('Enregistrer ma note','save-note',`data-id="${e.id}"`)}</div></details>
    <details class="sheet-extra source-details"><summary>Sources et précisions</summary><div class="sheet-extra-content"><ul>${sourceLinks(e.source_ids)}</ul>${(e.editorial_notes||[]).map(x=>`<p>${esc(x)}</p>`).join('')}</div></details>
    <div class="sheet-actions-v3">${btn(icon('plus')+' Ajouter à une séance','sheet-add',`data-id="${e.id}"`,'primary')}${btn(icon('download')+' Imprimer / PDF','print-sheet','','plain')}</div>
  </section>`,true);
}

  function openBuilder(id){openSharedBuilder(id);}
  function renderBuilder(){renderSharedBuilder();}
  function builderItem(p,i) {
    const e=exercise(p.exerciseId); if(!e)return '';
    const duration=e.execution_mode==='duree', isCircuit=draft.mode==='circuit'&&p.block==='renforcement';
    return `<article class="builder-item"><div class="builder-item-head"><span class="number-badge">${i+1}</span><div><strong>${esc(e.name)}</strong><span>${C.sideCount(e)===2?'Saisie par côté':e.repetition_counting==='paire'?'Paires gauche + droite':'Deux côtés ensemble'} · ${labels[p.block]}</span></div><div class="reorder-actions">${ibtn('up','Monter cet exercice','builder-up',`data-index="${i}" ${!draft.items.slice(0,i).some(q=>q.block===p.block)?'disabled':''}`)}${ibtn('down','Descendre cet exercice','builder-down',`data-index="${i}" ${!draft.items.slice(i+1).some(q=>q.block===p.block)?'disabled':''}`)}${ibtn('trash','Retirer cet exercice','builder-remove',`data-index="${i}"`)}</div></div><div class="builder-fields"><label class="field">Bloc<select data-plan="block" data-index="${i}">${Object.entries(labels).map(([k,l])=>`<option value="${k}" ${p.block===k?'selected':''}>${l}</option>`).join('')}</select></label><label class="field">${isCircuit?'Série / tour':'Séries'}<input type="number" min="1" max="20" value="${isCircuit?1:p.sets}" data-plan="sets" data-index="${i}" ${isCircuit?'disabled':''}></label><label class="field">${duration?'Durée (s)':e.repetition_counting==='paire'?'Paires G + D':'Répétitions'}<input type="number" min="1" max="${duration?3600:1000}" data-plan="${duration?'duration':'reps'}" data-index="${i}" value="${duration?p.duration:p.reps}"></label><label class="field">Type de charge<select data-plan="loadMode" data-index="${i}">${Object.entries(loadNames).map(([k,l])=>`<option value="${k}" ${p.loadMode===k?'selected':''}>${l}</option>`).join('')}</select></label>${p.loadMode==='band'?`<label class="field">Élastique<input data-plan="band" data-index="${i}" value="${esc(p.band||'')}" placeholder="Couleur / résistance" maxlength="80"></label>`:!['none','band'].includes(p.loadMode)?`<label class="field">${p.loadMode==='per_dumbbell'?'Kg / haltère':'Kg'}<input type="number" min="0" max="1000" step="0.25" data-plan="load" data-index="${i}" value="${p.load}"></label>`:''}<label class="field">Repos (s)<input type="number" min="0" max="3600" step="5" data-plan="rest" data-index="${i}" value="${p.rest}"></label></div></article>`;
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
  function chooseWarmup(){
    const family=pickerBlock||'echauffement',rs=(D.routines||[]).filter(r=>r.family===family).filter(r=>routineFilter==='all'||routineFilter==='noFloor'&&r.noFloor||String(r.durationMinutes)===routineFilter);
    showModal('Choisir une routine · '+labels[family],`<p>Les durées, répétitions et séries sont déjà réglées. Vous pourrez les adapter.</p>${family==='echauffement'?`<div class="picker-categories">${[['all','Toutes'],['noFloor','Sans sol'],['3','3 min'],['5','5 min'],['8','8 min'],['10','10 min']].map(([k,l])=>btn(l,'routine-filter',`data-id="${k}"`,routineFilter===k?'primary':'secondary')).join('')}</div>`:''}<div class="routine-grid">${rs.map(r=>`<article class="routine-card"><span class="eyebrow">${esc(r.durationLabel||'Routine modulable')}${r.noFloor?' · SANS SOL':''}</span><h3>${esc(r.name)}</h3><p>${esc(r.description||'')}</p><details><summary>${r.exerciseIds.length} mouvements</summary><p>${r.exerciseIds.map(id=>esc(exercise(id)?.name)).join(' · ')}</p></details>${btn('Ajouter cette routine','insert-warmup',`data-id="${r.id}"`,'primary')}</article>`).join('')}</div>`,true);
  }
  async function startTemplate(id) {
    if(active()){navigate('session');toast('Reprends ou termine la séance en cours avant d’en commencer une autre.');return;}
    const base=state.templates.find(x=>x.id===id),t=base&&personalTemplate(base); if(!t?.items.length){toast('Ajoute au moins un exercice à la séance.');return;}
    const s=C.createSession({...t,profileId:state.currentProfileId},catalog());state.sessions.unshift(s);state.activeId=s.id;activeHistory=null;await save();closeModal();navigate('session');requestWakeLock();
  }
  async function quickStart() {
    if(active()){navigate('session');return;}
    const s=C.createSession({id:null,name:'Séance libre',items:[],profileId:state.currentProfileId},catalog());state.sessions.unshift(s);state.activeId=s.id;activeHistory=null;await save();navigate('session');pickerBlock=null;openPicker('session');requestWakeLock();
  }
  function loadLabel(r) {
    if(r.loadMode==='none')return 'Poids du corps'; if(r.loadMode==='band')return esc(r.band||'Élastique');
    return r.loadMode==='per_dumbbell'?`2 × ${n(r.load)} kg`:`${n(r.load)} kg`;
  }
  function sessionPage() {
    if(!activeHistory)return sharedSessionPage();
    const s=currentSession(); if(!s)return heading('TON CARNET','Aucune séance en cours','Choisis une séance ou commence librement.',btn('Voir mes séances','go-templates','','primary'));
    if(activeMode())return distancePage(s);
    s.cursor=Math.max(0,Math.min(s.cursor,s.entries.length-1)); const e=s.entries[s.cursor];
    const rows=s.entries.flatMap(x=>x.rows), done=rows.filter(r=>r.status==='done').length, processed=rows.filter(r=>r.status!=='pending').length;
    const isActive=s.status==='active';
    const content = `<div class="session-heading"><div><button class="text-btn" data-action="${isActive?'go-templates':'go-history'}">${icon('back')} ${isActive?'Mes séances':'Historique'}</button><h1>${esc(s.name)}</h1><p><strong>${esc(participantName(s.profileId))}</strong> · ${isActive?'Séance en cours':date(s.startedAt,{year:'numeric'})} · ${done} série${done>1?'s':''} validée${done>1?'s':''}</p></div><div class="session-controls">${isActive?visibilityControl():''}<div class="session-clock">${icon('timer')}<strong data-clock="${s.id}">${clock(C.elapsed(s))}</strong>${s.pausedAt?'<span>En pause</span>':''}</div>${isActive?btn(icon(s.pausedAt?'play':'pause')+(s.pausedAt?' Reprendre':' Pause'),'pause-session')+btn('Terminer','finish-dialog','','primary'):btn(icon('copy')+' Refaire cette séance','repeat-session',`data-id="${s.id}"`,'primary')}</div></div><div class="session-progress" aria-label="${processed} séries traitées sur ${rows.length}"><i style="width:${rows.length?processed/rows.length*100:0}%"></i></div>
    ${s.pausedAt?'<div class="notice warning">La séance et les minuteurs sont en pause.</div>':''}
    ${!e?empty('workout','Ta séance commence ici','Ajoute un exercice pour enregistrer tes premières séries.',btn(icon('plus')+' Choisir un exercice','session-add','','primary')):`<div class="session-layout"><aside class="session-track"><div class="section-heading"><h3>Le programme</h3></div><div class="session-add-blocks">${C.blocks.map(b=>btn(icon('plus')+labels[b],'session-add',`data-block="${b}"`)).join('')}</div>${s.entries.map((entry,i)=>`<button class="track-item ${i===s.cursor?'selected':''}" data-action="select-entry" data-index="${i}"><span class="track-number ${entry.rows.every(r=>r.status!=='pending')?'done':''}">${entry.rows.every(r=>r.status!=='pending')?icon('check'):i+1}</span><span><strong>${esc(entry.definition.name)}</strong><small>${entry.round?'Tour '+entry.round+' · ':''}${entry.rows.filter(r=>r.status==='done').length}/${entry.rows.length} séries · ${labels[entry.plan.block]}</small></span></button>`).join('')}<div class="mode-setting"><label><input type="checkbox" id="guided-mode" ${s.guided?'checked':''}> Repos automatique</label><small>Décoche pour tenir ton journal librement.</small></div></aside><section class="active-exercise"><div class="active-exercise-heading"><div><span class="eyebrow">${labels[e.plan.block]} ${e.round?'· TOUR '+e.round:''}</span><h2>${esc(e.definition.name)}</h2></div><div>${ibtn('edit','Remplacer cet exercice','session-replace')}${ibtn('up','Monter dans la séance','entry-up',s.cursor===0?'disabled':'')}${ibtn('down','Descendre dans la séance','entry-down',s.cursor===s.entries.length-1?'disabled':'')}${ibtn('trash','Retirer les séries à venir de cet exercice','entry-remove')}${btn('Voir la fiche','session-sheet')}</div></div>
    <div class="active-visuals"><div class="active-gesture">${photo(e.definition,'','eager')}</div><div class="active-muscles">${B.maps(e.definition.muscle_roles,{compact:true,targetRegions:e.definition.target_regions})}${roleLegend(C.family(e.definition))}</div></div>
    <div class="exercise-cue">${icon('info')}<p>${esc(e.definition.key_cues[0]||e.definition.setup)}${state.exerciseNotes[e.exerciseId]?`<span>Ta note : ${esc(state.exerciseNotes[e.exerciseId])}</span>`:''}</p></div>
    ${previousLine(e,s)}
    <div class="set-options"><label>Bloc <select id="entry-block">${C.blocks.map(b=>`<option value="${b}" ${e.plan.block===b?'selected':''}>${labels[b]}</option>`).join('')}</select></label><label>Charge <select id="entry-load-mode">${Object.entries(loadNames).map(([k,l])=>`<option value="${k}" ${(e.rows.find(r=>r.status==='pending')?.loadMode||e.plan.loadMode)===k?'selected':''}>${l}</option>`).join('')}</select></label><label>Repos <input id="entry-rest" type="number" min="0" max="3600" value="${e.plan.rest}"> s</label>${btn('Copier la dernière performance','use-last')}</div>
    <p class="counting-note">${esc(e.definition.counting_instructions||'Saisie par côté si indiqué.')}${(e.rows[0]?.loadMode==='per_dumbbell')?' La charge saisie est celle d’un seul haltère.':''}</p>
    <div class="sets-table"><div class="set-head"><span>Série</span><span>${e.definition.execution_mode==='duree'?'Secondes':e.definition.repetition_counting==='paire'?'Paires G + D':'Répétitions'}</span><span>Charge</span><span>Effort / 10</span><span>Validation</span></div>${e.rows.map(r=>setRow(e,r,s)).join('')}</div><div class="set-bottom">${btn(icon('plus')+' Ajouter une série','add-set')}${s.undo?btn('Annuler la dernière validation','undo-set','','plain'):''}${btn(icon('body')+' Commenter mon ressenti','feedback-open')}</div>
    <div class="timer-panel" id="rest-panel" ${!s.restUntil&&!s.restRemaining?'hidden':''}><div>${icon('timer')}<span>Récupération</span><strong id="rest-clock"></strong></div><div>${btn('+15 s','rest-more')}${btn('Passer le repos','rest-skip')}</div></div>
    <div class="timer-panel effort" id="effort-panel" ${!s.effortUntil&&!s.effortRemaining?'hidden':''}><div>${icon('timer')}<span>Durée du mouvement</span><strong id="effort-clock"></strong></div>${btn('Arrêter le minuteur','effort-stop')}</div>
    <label class="field">Note sur cet exercice<textarea id="entry-note" maxlength="3000" rows="2" placeholder="Ce que tu souhaites retrouver…">${esc(e.note||'')}</textarea></label>${feedbackCards(e,s)}
    <div class="exercise-nav">${btn(icon('back')+' Précédent','prev-entry',s.cursor===0?'disabled':'')}${s.cursor<s.entries.length-1?btn('Exercice suivant '+icon('arrow'),'next-entry','','primary'):isActive?btn('Bilan de la séance '+icon('arrow'),'finish-dialog','','primary'):''}</div></section></div>`}`;
    const totals=C.totals([s]),split=content.indexOf('<div class="session-layout">');
    if(split<0)return content;
    return content.slice(0,split)+`<section class="history-overview"><h2>Ce qui a été réalisé</h2><p>${totals.done} série(s) validée(s) · ${totals.exercises} mouvement(s)</p><details><summary>Muscles sollicités</summary>${B.maps(B.rolesFromTotals(totals.muscles),{compact:true})}${roleLegend()}<p>${Object.keys(totals.muscles).map(m=>esc(D.muscles[m]||m)).join(', ')||'Aucune série de renforcement validée.'}</p></details>${s.note?`<p>${esc(s.note)}</p>`:''}</section><details class="history-corrections"><summary>Exercices, commentaires et corrections</summary>${content.slice(split)}</details>`;

  }
  function visibilityControl(){return `<div class="visibility-toggle" role="group" aria-label="Visibilité de la séance"><button data-action="visibility" ${!activeMode()?'disabled':''} aria-pressed="${!activeMode()}">Normal</button><button data-action="visibility" ${activeMode()?'disabled':''} aria-pressed="${activeMode()}">${icon('play')} Actif · à distance</button></div>`;}
  function openProfiles(){
    showModal('Les personnes suivies',`<p>Un carnet par personne, sur cet appareil. Les séances modèles sont communes, avec une version personnalisable pour chacun.</p><div class="profile-list">${state.profiles.map(p=>`<div><span class="avatar">${esc(p.name.slice(0,1))}</span><strong>${esc(p.name)}</strong><span>${C.personalSessions(state,p.id).filter(s=>s.status==='completed').length} séance(s)</span>${p.id===state.currentProfileId?'<span class="pill">Profil actuel</span>':''}</div>`).join('')}</div><form id="profile-rename"><label class="field">Renommer le profil actuel<input name="name" required maxlength="80" value="${esc(person().name)}"></label><button class="btn secondary" type="submit">Enregistrer le nom</button></form><hr><form id="profile-form"><label class="field">Ajouter une personne<input name="name" required maxlength="80" placeholder="Prénom"></label><button class="btn primary" type="submit">Créer son carnet</button></form><p class="map-note">Les profils ne sont pas protégés par mot de passe. Le choix du profil filtre seulement l’historique et le bilan. Dans une séance commune, chaque personne est visible en même temps.</p>`);
  }
  function distancePage(s){
    s.cursor=Math.max(0,Math.min(s.cursor,s.entries.length-1));
    const e=s.entries[s.cursor],r=e?.rows.find(x=>x.status==='pending');
    const done=s.entries.flatMap(e=>e.rows).filter(r=>r.status==='done').length,total=s.entries.flatMap(e=>e.rows).length;
    const allDone=s.entries.length&&!s.entries.some(e=>e.rows.some(r=>r.status==='pending'));
    return `<section class="distance-shell"><header class="distance-top"><div><span class="eyebrow">${esc(person().name)} · ${esc(s.name)}</span><span class="distance-progress">${done} / ${total} séries validées · <span data-clock="${s.id}">${clock(C.elapsed(s))}</span></span></div><div>${visibilityControl()}${ibtn('body','Plein écran','fullscreen')}${btn(s.pausedAt?'Reprendre':'Pause','pause-session')}${btn('Terminer','finish-dialog')}</div></header>${!e?empty('workout','Prépare ton programme','Ajoute un mouvement, ou reviens au mode Normal pour composer ta séance.',btn('Ajouter un mouvement','session-add','','primary')):`<div class="distance-heading"><span class="phase-chip ${e.plan.block}">${labels[e.plan.block]}${e.round?' · Tour '+e.round:''}</span><h1>${esc(e.definition.name)}</h1><p>${r?`Série ${esc(r.number)} sur ${Math.max(...e.rows.map(r=>r.number))}${r.side==='ensemble'?'':' · CÔTÉ '+r.side.toUpperCase()}`:allDone?'Programme parcouru':'Ce mouvement est terminé'}</p></div><div class="distance-grid"><section class="distance-picture">${photo(e.definition,'','eager')}<div class="distance-cue">${esc(e.definition.key_cues[0]||e.definition.steps[0])}</div><div class="distance-sheet">${btn('Voir la fiche et les muscles','session-sheet')}${btn('Ressenti / commentaire','feedback-open')}</div></section><section class="distance-instructions"><div class="distance-state" id="focus-state" role="status" aria-live="polite"></div><div class="distance-count" id="focus-clock"></div>${r?`<div class="distance-target"><strong>${e.definition.execution_mode==='duree'?r.duration+' s':r.reps+(e.definition.repetition_counting==='paire'?' paires G + D':' répétitions')}</strong><span>${loadLabel(r)}${r.side==='ensemble'?'':' · '+r.side}</span></div>`:''}<div class="distance-primary" id="focus-primary">${focusPrimary(s,e,r,allDone)}</div><div id="focus-rest-actions" ${!s.restUntil&&!s.restRemaining?'hidden':''}>${btn('+15 secondes de repos','rest-more')}${btn('Passer le repos','rest-skip')}</div><div class="distance-secondary">${s.undo?btn('Annuler la dernière validation','undo-set'):''}${btn('Précédent','prev-entry',s.cursor===0?'disabled':'')}${s.cursor<s.entries.length-1?btn('Mouvement suivant','next-entry'):''}</div><p class="distance-note">La fin du chrono ne valide pas la série : confirme ce que tu as réellement fait.</p></section></div>`}<footer class="distance-footer"><div>${btn(state.preferences.sounds?'Sons activés':'Activer les sons','toggle-sound',`aria-pressed="${!!state.preferences.sounds}"`)}${'speechSynthesis' in window?btn(state.preferences.voice?'Voix activée':'Activer la voix','toggle-voice',`aria-pressed="${!!state.preferences.voice}"`):''}</div><span>Clavier : espace = action principale · P = pause<br>Écran maintenu éveillé si le navigateur le permet.</span></footer></section>`;
  }
  function focusPrimary(s,e,r,allDone){
    if(s.pausedAt)return btn(icon('play')+' Reprendre la séance','pause-session','','primary');
    if(s.restUntil&&s.restUntil>Date.now())return btn('Je suis prêt · passer le repos','rest-skip','','primary');
    if(!r)return btn(allDone?'Voir le bilan et terminer':'Continuer le programme',allDone?'finish-dialog':'focus-next','','primary');
    if(e.definition.execution_mode==='duree'&&s.effortRowId!==r.id)return btn(icon('play')+' Démarrer '+r.duration+' secondes','start-effort',`data-entry="${e.id}" data-row="${r.id}"`,'primary');
    return btn(icon('check')+' Série réalisée','focus-done','','primary');
  }
  let focusBusy=false, focusSignature='';
  async function focusDone(){
    if(focusBusy)return;const s=active(),e=s?.entries[s.cursor],r=e?.rows.find(r=>r.status==='pending');if(!r||s.pausedAt)return;
    if(s.restUntil>Date.now()){toast('Le repos est encore en cours.');return;}
    focusBusy=true;try{C.complete(s,e.id,r.id);if(!e.rows.some(r=>r.status==='pending')){const next=s.entries.findIndex((e,i)=>i>s.cursor&&e.rows.some(r=>r.status==='pending'));if(next>=0)s.cursor=next;}if(!s.entries.some(e=>e.rows.some(r=>r.status==='pending')))s.restUntil=null;await save();render();announce(s.restUntil>Date.now()?'Série enregistrée. Repos.':'Série enregistrée.');}finally{setTimeout(()=>focusBusy=false,500);}
  }
  function announceCurrent(prefix=''){
    const s=active(),e=s?.entries[s.cursor],r=e?.rows.find(r=>r.status==='pending');if(!e)return;
    const dose=r?(e.definition.execution_mode==='duree'?r.duration+' secondes':r.reps+(e.definition.repetition_counting==='paire'?' paires gauche droite':' répétitions')):'';
    const charge=!r||r.loadMode==='none'?'':r.loadMode==='band'?'Avec élastique':(r.loadMode==='per_dumbbell'?'Deux haltères de ':'')+r.load+' kilos';
    announce(prefix+e.definition.name+'. '+dose+'. '+charge+'. '+(r&&r.side!=='ensemble'?'Côté '+r.side+'. ':''));
  }
  function announce(message){if(!trainingPrefs().voice||!('speechSynthesis' in window))return;window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(message);speech.lang='fr-FR';speech.rate=.92;window.speechSynthesis.speak(speech);}
  function updateFocus(s){
    if(!activeMode()||!$('#focus-state'))return;
    const e=s.entries[s.cursor],r=e?.rows.find(r=>r.status==='pending');if(!e)return;
    const rest=s.pausedAt?s.restRemaining:(s.restUntil?Math.max(0,s.restUntil-Date.now()):null);
    const effort=s.effortRowId!==r?.id?null:s.pausedAt?s.effortRemaining:(s.effortUntil?Math.max(0,s.effortUntil-Date.now()):null);
    const resting=rest!==null&&rest>0,working=effort!==null;
    const label=s.pausedAt?'EN PAUSE':resting?'REPOS':working?(effort>0?'MOUVEMENT EN COURS':'TEMPS ATTEINT'):r?'À TOI DE JOUER':'MOUVEMENT TERMINÉ';
    if($('#focus-state').textContent!==label)$('#focus-state').textContent=label;
    $('#focus-clock').textContent=resting?clock(rest+999):working?clock(effort+999):r?(e.definition.execution_mode==='duree'?r.duration+' s':r.reps):'✓';
    $('.distance-instructions').classList.toggle('is-rest',resting);$('.distance-instructions').classList.toggle('is-paused',!!s.pausedAt);
    $('#focus-rest-actions').hidden=!resting;
    const signature=[s.id,e.id,r?.id,!!s.pausedAt,resting,s.effortRowId].join('|');
    if(focusSignature!==signature){focusSignature=signature;$('#focus-primary').innerHTML=focusPrimary(s,e,r,!s.entries.some(e=>e.rows.some(r=>r.status==='pending')));}
  }
  document.addEventListener('keydown',event=>{
    if(!activeMode()||$('#dialog')||event.repeat||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,select,textarea,button,a,[contenteditable]'))return;
    if(event.code==='Space'){event.preventDefault();(workout()?.participantIds.length===1?$('[data-person-primary] button'):null)?.click();}
    if(event.key.toLowerCase()==='p'){event.preventDefault();$('[data-action="shared-pause"]')?.click();}
  });
  function previousLine(e,s) {
    const last=C.lastPerformance(C.personalSessions(state,s.profileId),e.exerciseId,s.id);
    return `<div class="previous-line">${icon('history')} ${last?`Dernière fois, le ${date(last.date)} : <strong>${e.definition.execution_mode==='duree'?n(last.row.duration)+' s':n(last.row.reps)+' répétitions'} · ${loadLabel(last.row)}</strong>`:'Première réalisation enregistrée pour cet exercice.'}</div>`;
  }
  function setRow(e,r,s) {
    const duration=e.definition.execution_mode==='duree', attr=`data-row="${r.id}" data-entry="${e.id}"`;
    return `<div class="set-row ${r.status}" data-set-id="${r.id}"><span class="set-label"><strong>${esc(r.number)}</strong><small>${r.side==='ensemble'?'':r.side==='gauche'?'Gauche':'Droite'}</small></span><label><span class="sr-only">${duration?'Durée':e.definition.repetition_counting==='paire'?'Paires G + D':'Répétitions'} série ${esc(r.number)} ${esc(r.side)}</span><input type="number" min="1" max="${duration?86400:10000}" value="${duration?r.duration:r.reps}" data-set-field="${duration?'duration':'reps'}" ${attr}></label><label><span class="sr-only">Charge série ${esc(r.number)}</span>${r.loadMode==='band'?`<input value="${esc(r.band)}" placeholder="Élastique" maxlength="80" data-set-field="band" ${attr}>`:r.loadMode==='none'?'<span class="bodyweight">PDC</span>':`<input type="number" min="0" max="1000" step="0.25" value="${r.load}" data-set-field="load" ${attr}><small>${r.loadMode==='per_dumbbell'?'kg / haltère':'kg'}</small>`}</label><label><span class="sr-only">Effort ressenti sur 10</span><input type="number" min="1" max="10" value="${r.effort}" placeholder="—" data-set-field="effort" ${attr}></label><div class="set-row-actions">${r.status==='done'?`<button class="done-button" data-action="reopen-set" ${attr} aria-label="Dévalider la série">${icon('check')}<span>Fait</span></button>`:r.status==='skipped'?btn('Passée','reopen-set',attr,'plain'):`${duration?ibtn('timer','Démarrer le minuteur de cette série','start-effort',attr):''}${ibtn('check','Valider la série '+r.number+' '+r.side,'complete-set',attr)}${ibtn('arrow','Passer cette série','skip-set',attr)}`}</div></div>`;
  }
  function finishDialog() {
    const s=active();if(!s)return;const t=C.totals([s]),pending=s.entries.flatMap(e=>e.rows).filter(r=>r.status==='pending').length;
    showModal('Faire le point',`<div class="finish-stats"><div><strong>${t.done}</strong><span>Séries validées</span></div><div><strong>${n(Math.round(C.elapsed(s)/60000))}</strong><span>Minutes</span></div><div><strong>${Object.keys(t.muscles).length}</strong><span>Groupes sollicités</span></div></div>${pending?`<p class="notice">${pending} série${pending>1?'s restent':' reste'} non réalisée${pending>1?'s':''}. Seules les séries validées compteront dans le bilan.</p>`:''}${B.maps(B.rolesFromTotals(t.muscles),{compact:true})}${roleLegend()}<form id="finish-form"><label class="field">Un mot sur cette séance<textarea name="note" maxlength="5000" rows="3" placeholder="Énergie, difficultés, satisfaction…">${esc(s.note)}</textarea></label><button type="submit" class="btn primary full">Terminer et enregistrer</button></form>`);
  }
  function sessionCard(s) {
    const t=C.totals([s]);return `<button class="history-card" data-action="open-session" data-id="${s.id}"><span class="date-tile"><strong>${new Date(s.startedAt).getDate()}</strong>${new Date(s.startedAt).toLocaleDateString('fr-FR',{month:'short'})}</span><span class="history-card-body"><strong>${esc(s.name)}</strong><small>${t.exercises} exercices · ${t.done} séries · ${n(Math.round(C.elapsed(s)/60000))} min</small>${s.note?`<span>${esc(s.note.slice(0,100))}</span>`:''}</span>${icon('arrow')}</button>`;
  }
  function historyPage() {
    const completed=mySessions().filter(s=>s.status==='completed').sort((a,b)=>b.startedAt-a.startedAt);
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
    return mySessions().filter(s=>s.status==='completed'&&s.startedAt>=from.getTime());
  }
  function statsPage() {
    const sessions=recentSessions(statsPeriod),t=C.totals(sessions),roles=B.rolesFromTotals(t.muscles,statsRole),muscles=Object.entries(t.muscles).filter(([m,v])=>statsRole==='all'||v[statsRole]).sort((a,b)=>{const sum=v=>statsRole==='all'?v.primary+v.assistance+v.stabilization:v[statsRole];return sum(b[1])-sum(a[1]);});
    const max=Math.max(1,...muscles.map(([m,v])=>v.primary+v.assistance+v.stabilization));
    return heading('COMPRENDRE TON ENTRAÎNEMENT','Le bilan musculaire','Un aperçu de tes séries réalisées, par groupe et par rôle.')+
    `<div class="stats-toolbar"><div class="segmented">${[['week','Cette semaine'],['month','Ce mois'],['all','Tout']].map(([k,l])=>btn(l,'stats-period',`data-id="${k}"`,statsPeriod===k?'selected':'plain')).join('')}</div><label>Rôle <select id="stats-role"><option value="all">Tous les rôles</option>${Object.entries({primary:'Principal',assistance:'Assistance',stabilization:'Stabilisation'}).map(([k,l])=>`<option value="${k}" ${statsRole===k?'selected':''}>${l}</option>`).join('')}</select></label></div>
    <div class="stat-grid"><div class="stat-card"><span>Séances réalisées</span><strong>${sessions.length}</strong></div><div class="stat-card"><span>Temps total</span><strong>${n(Math.round(t.durationMs/60000))}<small> min</small></strong></div><div class="stat-card"><span>Séries validées</span><strong>${t.done}</strong><p>Toutes les familles d’activité</p></div></div><div class="stats-layout"><section class="panel body-stat"><h2>Les zones sollicitées</h2>${B.maps(roles)}${roleLegend()}<p class="map-note">Carte simplifiée du renforcement. Les couleurs indiquent le rôle attendu, sans mesurer l’activation ni la récupération. Une région peut avoir plusieurs rôles selon l’exercice.</p></section><section class="panel"><h2>Le détail par muscle</h2><p class="subtle">Nombre de séries validées pour chaque rôle. Gauche et droite sont des séries distinctes.</p><div class="muscle-bars">${muscles.map(([m,v])=>`<button class="muscle-bar-row ${selectedStatsMuscle===m?'selected':''}" data-action="stats-muscle" data-id="${m}"><span>${esc(D.muscles[m]||m)}</span><div class="stack-bar">${['primary','assistance','stabilization'].filter(r=>statsRole==='all'||r===statsRole).map(r=>`<i class="${r}" style="width:${v[r]/max*100}%" title="${r}: ${v[r]}"></i>`).join('')}</div><strong>${statsRole==='all'?v.primary+v.assistance+v.stabilization:v[statsRole]}</strong></button>`).join('')||empty('body','Le corps garde ses repères','Termine une séance de renforcement pour remplir ce bilan.')}</div>${selectedStatsMuscle&&t.muscles[selectedStatsMuscle]?`<div class="muscle-detail"><h3>${esc(D.muscles[selectedStatsMuscle])}</h3><p>Principal : ${t.muscles[selectedStatsMuscle].primary} · Assistance : ${t.muscles[selectedStatsMuscle].assistance} · Stabilisation : ${t.muscles[selectedStatsMuscle].stabilization}</p>${[...t.muscles[selectedStatsMuscle].exercises].map(id=>btn(esc(exercise(id)?.name||id),'sheet',`data-id="${id}"`,'plain')).join('')}</div>`:''}</section></div>
    <section class="panel progress-panel"><div class="section-heading"><h2>Progression par exercice</h2><label class="sr-only" for="progress-exercise">Exercice à comparer</label><select id="progress-exercise"><option value="">Choisir un exercice réalisé</option>${[...new Set(mySessions().filter(s=>s.status==='completed').flatMap(s=>s.entries.filter(e=>e.rows.some(r=>r.status==='done')).map(e=>e.exerciseId)))].map(id=>`<option value="${id}">${esc(exercise(id)?.name||id)}</option>`).join('')}</select></div><div id="progress-details"><p class="subtle">Compare les répétitions, la durée et les charges à convention identique.</p></div></section>`;
  }
  function progressDetails(id) {
    const rows=mySessions().filter(s=>s.status==='completed').sort((a,b)=>a.startedAt-b.startedAt).flatMap(s=>s.entries.filter(e=>e.exerciseId===id).flatMap(e=>e.rows.filter(r=>r.status==='done').map(r=>({s,e,r}))));
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
    showModal('Ressenti de '+esc(participantName(s.profileId)),`<form id="feedback-form"><p class="subtle">${esc(e.definition.name)} · Sélectionne une ou plusieurs zones sur le corps, ou décris-les avec tes mots.</p><div class="feedback-layout"><section><div id="feedback-body">${B.maps({}, {interactive:true,points:[]})}</div><div id="feedback-points"><p class="map-note">Face : ta droite apparaît à gauche du dessin. Dos : ta droite apparaît à droite.</p></div>${btn('Effacer les points','clear-points','','plain')}<label class="field">Ou choisir une zone<select id="feedback-region"><option value="">Sélectionner…</option>${['Nuque','Épaule','Bras','Avant-bras','Poignet','Poitrine','Haut du dos','Lombaires','Abdominaux','Hanche','Fessier','Cuisse','Genou','Mollet','Cheville','Pied'].map(x=>`<option>${x}</option>`).join('')}</select></label><div class="form-grid"><label class="field">Côté<select id="feedback-side"><option value="droite">Droit</option><option value="gauche">Gauche</option><option value="centre">Centre</option></select></label>${btn('Ajouter la zone','add-region')}</div></section><section><label class="field">Le ressenti<select name="type" id="feedback-type"><option value="effort">Effort / fatigue musculaire</option><option value="pain">Douleur ou gêne</option><option value="notfelt">Muscle peu ou pas ressenti</option><option value="sensory">Engourdissement / fourmillements</option><option value="control">Geste difficile à contrôler, sans douleur</option><option value="stretch">Sensation d’étirement</option><option value="fine">Aucun problème</option></select></label><div id="pain-fields" hidden><label class="field">Intensité de la douleur / gêne, de 0 à 10<input name="intensity" type="number" min="0" max="10" value="3"></label><p class="map-note">Cette échelle est distincte de la difficulté de l’effort.</p></div><div id="notfelt-fields" hidden><label class="field">Muscle que tu attendais<select name="expectedMuscle"><option value="">Choisir…</option>${Object.entries(D.muscles).map(([id,name])=>`<option value="${id}">${esc(name)}</option>`).join('')}</select></label><label class="field">Ce que tu as ressenti à la place<input name="feltInstead" maxlength="200" placeholder="Zone ou sensation…"></label></div><div class="form-grid"><label class="field">Quand ?<select name="timing"><option>Pendant l’exercice</option><option>Juste après</option><option>Plus tard dans la journée</option><option>Le lendemain</option></select></label><label class="field">Phase du geste<select name="phase"><option>Non précisée</option><option>Installation</option><option>Montée / poussée / tirage</option><option>Descente / retour</option><option>Maintien</option></select></label></div><label class="field">Série concernée<select name="rowId"><option value="">L’exercice en général</option>${e.rows.map(r=>`<option value="${r.id}">Série ${esc(r.number)}${r.side==='ensemble'?'':' · '+r.side} · ${e.definition.execution_mode==='duree'?r.duration+' s':r.reps+' rep.'} · ${loadLabel(r)}</option>`).join('')}</select></label><label class="field">Ton commentaire<textarea name="note" rows="3" maxlength="3000" placeholder="Où, à quel moment, ce qui change…"></textarea></label><div class="notice" id="feedback-explainer">Le commentaire sera lié à cet exercice et à ses paramètres.</div><button type="submit" class="btn primary full">Enregistrer et voir les repères</button></section></div></form>`,true);
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
    showModal('Mon carnet & mes réglages',`<div class="settings-summary">${icon('save')}<div><strong>${esc(RenfoStorage.mode)}</strong><p>Les séances et commentaires restent sur cet appareil. Ils ne sont pas envoyés dans le dépôt ou vers un service d’IA.</p></div></div><form id="settings-form"><div class="form-grid"><label class="field">Objectif de séances / semaine<input name="weeklyGoal" type="number" min="1" max="14" value="${state.preferences.weeklyGoal||3}"></label><label class="checkbox-field"><input name="sounds" type="checkbox" ${trainingPrefs().sounds?'checked':''}> Signal sonore à la fin des minuteurs</label><label class="checkbox-field"><input name="wakeLock" type="checkbox" ${trainingPrefs().wakeLock?'checked':''}> Garder l’écran actif si disponible</label></div><h3>Mon matériel</h3><p class="subtle">À retrouver dans les filtres de la bibliothèque.</p><div class="equipment-checks">${Object.entries(equipmentNames).filter(([id])=>id!=='sans_materiel').map(([id,name])=>`<label><input type="checkbox" name="equipment" value="${id}" ${state.preferences.equipment?.includes(id)?'checked':''}>${name}</label>`).join('')}</div><button type="submit" class="btn primary">Enregistrer les réglages</button></form><hr><h3>Personnes suivies</h3><p>Chaque profil a ses séries, ses charges, ses notes et son historique. Les profils sont locaux à cet appareil, sans compte ni synchronisation entre appareils.</p>${btn('Gérer les personnes','profiles')}<hr><h3>Garder une copie</h3><p>Une sauvegarde exportée contient tous les profils, leurs séances, modèles, notes et points corporels. Conserve-la dans un endroit personnel. Sans synchronisation, chaque appareil a son propre carnet.</p><p class="subtle">Dernier export : ${state.lastExport?date(state.lastExport,{hour:'2-digit',minute:'2-digit'}):'Pas encore d’export'}</p><div class="row-actions">${btn(icon('download')+' Exporter une sauvegarde','export')}${btn('Importer une sauvegarde','import-open')}${btn('Demander un stockage persistant','persist-storage','','plain')}</div><input type="file" id="import-file" accept="application/json,.json" hidden><hr><h3>Sur ton téléphone</h3>${btn('Installer Renfo','install-open','','primary')}<p>Utilise « Ajouter à l’écran d’accueil » dans le menu du navigateur. Après un premier chargement connecté, le contenu peut être conservé hors ligne.</p><p class="map-note">Le navigateur peut suspendre les sons et vibrations en arrière-plan. Les temps sont recalculés au retour à l’écran.</p><div class="row-actions">${btn('Préparer les images hors ligne','cache-images')}${btn('Vérifier les mises à jour','check-update','','plain')}</div><div id="offline-status" class="subtle" role="status"></div><hr><a href="assets/Fiches_initiales.pdf" target="_blank" rel="noopener">Télécharger les six fiches A4 initiales</a>`);
  }
  function downloadJSON(value, filename) {
    const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function exportState() { state.lastExport=Date.now();await save();downloadJSON({format:'renfo-backup',version:3,exportedAt:new Date().toISOString(),state},'renfo-sauvegarde-'+new Date().toISOString().slice(0,10)+'.json');toast('Sauvegarde exportée.'); }
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
    if(trainingPrefs().wakeLock&&active()&&!active().pausedAt&&'wakeLock' in navigator){try{if(!wakeLock||wakeLock.released)wakeLock=await navigator.wakeLock.request('screen');}catch{}}else if(wakeLock&&!wakeLock.released){try{await wakeLock.release();}catch{}}
  }
  let audioContext;
  function enableAudio(){try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();}catch{}}
  function beep(){if(!trainingPrefs().sounds||!audioContext)return;try{const osc=audioContext.createOscillator(),gain=audioContext.createGain();osc.connect(gain);gain.connect(audioContext.destination);osc.frequency.value=660;gain.gain.setValueAtTime(.07,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.3);osc.start();osc.stop(audioContext.currentTime+.3);}catch{}}
  let restNotified=null,effortNotified=null;
  function tick() {
    $$('[data-clock]').forEach(el=>{const s=state.sessions.find(s=>s.id===el.dataset.clock);if(s)el.textContent=clock(C.elapsed(s));});
    sharedTick();
    if(workout())return;
    const s=active();if(!s)return;
    updateFocus(s);
    for(const key of ['rest','effort']) {
      const remaining=s.pausedAt?s[key+'Remaining']:(s[key+'Until']?Math.max(0,s[key+'Until']-Date.now()):null),el=$('#'+key+'-clock');
      if(el)el.textContent=remaining===null?'00:00':clock(remaining+999);
      if(remaining!==null&&remaining<=0&&!s.pausedAt){
        if(key==='rest'&&restNotified!==s.restUntil){restNotified=s.restUntil;beep();announceCurrent('Repos terminé. ');toast('Repos terminé. À toi de reprendre quand tu es prêt.');}
        if(key==='effort'&&effortNotified!==s.effortUntil){effortNotified=s.effortUntil;beep();announce('Temps atteint. Confirme la série si elle est réalisée.');toast('Durée atteinte. Valide la série si elle est réalisée.');}
      }
    }
  }
  // Shared workouts: the viewed follow-up profile never selects the training participant.
  let sheetPerson=null,trainingPerson=null, templatesView='hub', builderStep=1, builderBlock='renforcement', builderPerson=null, builderSlot=null, pendingStart=null, routineFilter='all';
  const workout=()=>C.getWorkout(state);
  const participantName=id=>state.profiles.find(p=>p.id===id)?.name||'Participant';
  const trainingPrefs=()=>state.trainingPreferences ||= {visibility:'normal',sounds:false,voice:false,wakeLock:true};
  function selectParticipant(id){
    const w=workout();if(!w)return null;
    trainingPerson=w.participantIds.includes(id)?id:w.participantIds[0];
    const s=C.workoutSession(state,w,trainingPerson),entryId=w.slots[w.cursor]?.entries[trainingPerson];
    if(s&&entryId)s.cursor=Math.max(0,s.entries.findIndex(e=>e.id===entryId));
    return s;
  }
  function sharedActive(){return selectParticipant(trainingPerson);}
  function activeWorkouts(){return (state.workouts||[]).filter(w=>w.status==='active');}
  function activeWorkoutCards(){return activeWorkouts().map(w=>`<div class="resume-banner"><div><strong>${esc(w.name)}</strong><span>${w.participantIds.map(id=>esc(participantName(id))).join(' · ')} · ${date(w.startedAt)}</span></div>${btn('Reprendre','resume-workout',`data-id="${w.id}"`,'primary')}</div>`).join('');}
  function sharedHome(){
    const completed=state.workouts.filter(w=>w.status==='completed'),last=completed.sort((a,b)=>b.startedAt-a.startedAt)[0];
    return heading('VOTRE ESPACE','On bouge ensemble ?','Une séance commune. Un suivi pour chacun.')+activeWorkoutCards()+`<section class="start-panel"><div><span class="eyebrow">À VOTRE RYTHME</span><h2>Préparer la prochaine séance</h2><p>Choisissez un programme, puis adaptez les mouvements et les charges de chacun.</p>${btn('Aller aux séances '+icon('arrow'),'go-templates','','primary')}</div><div class="start-image">${photo(exercise('squat-goblet'),'','eager')}</div></section><div class="home-shortcuts"><a href="#library">${icon('library')} Les gestes et les muscles ${icon('arrow')}</a><a href="#history">${icon('history')} ${last?'Retrouver votre dernière séance':'Consulter le suivi individuel'} ${icon('arrow')}</a></div>${!window.RenfoInstall?.getState().installed?`<div class="install-link">${btn(icon('download')+' Installer Renfo sur le téléphone','install-open','','plain')}</div>`:''}`;
  }
  function sharedTemplates(){
    if(templatesView==='choose')return heading('SÉANCES','Choisir une séance','Les paramètres de chacun restent modifiables.',btn(icon('back')+' Retour','sessions-hub'))+`<div class="template-grid">${state.templates.map(sharedTemplateCard).join('')||empty('workout','Aucun programme','Composez votre première séance.',btn('Créer une séance','new-template'))}</div>`;
    return heading('SÉANCES','Votre prochaine séance','Seul ou ensemble, un programme à votre mesure.')+activeWorkoutCards()+`<div class="session-choices"><button data-action="choose-sessions" class="session-choice"><span>${icon('workout')}</span><h2>Choisir une séance</h2><p>Retrouver un programme enregistré et le démarrer.</p><strong>Voir les séances ${icon('arrow')}</strong></button><button data-action="new-template" class="session-choice"><span>${icon('plus')}</span><h2>${draft?'Reprendre la création':'Créer une séance'}</h2><p>Échauffement, renforcement, mobilisation et étirements.</p><strong>${draft?'Continuer le brouillon':'Composer en 3 étapes'} ${icon('arrow')}</strong></button></div>`;
  }
  function sharedTemplateCard(t){return `<article class="template-card simple-template"><span class="eyebrow">${t.items.length} MOUVEMENTS · ≈ ${C.estimate(t,catalog())} MIN</span><h3>${esc(t.name)}</h3><p>${esc(t.description||t.items.slice(0,3).map(p=>exercise(p.exerciseId)?.name).join(' · '))}</p><div class="phase-chips">${C.blocks.filter(b=>t.items.some(p=>p.block===b)).map(b=>`<span class="phase-chip ${b}">${labels[b]}</span>`).join('')}</div><div class="card-actions">${btn('Choisir','start-template',`data-id="${t.id}"`,'primary')}${ibtn('edit','Modifier '+t.name,'edit-template',`data-id="${t.id}"`)}${ibtn('copy','Dupliquer '+t.name,'duplicate-template',`data-id="${t.id}"`)}${ibtn('trash','Supprimer '+t.name,'delete-template',`data-id="${t.id}"`)}</div></article>`;}
  function openSharedBuilder(id){
    if(id)draft=C.clone(state.templates.find(t=>t.id===id));
    else if(!draft)draft={id:C.uid(),name:'',description:'',mode:'classic',rounds:3,items:[],variants:{},blockOrder:[...C.blocks],participantIds:state.profiles.map(p=>p.id)};
    draft.participantIds ||= state.profiles.map(p=>p.id);draft.variants||={};draft.blockOrder||=[...C.blocks];builderStep=id?2:1;renderSharedBuilder();
  }
  function variantItem(pid,p){
    const v=draft.variants[pid];return v?.items.find(x=>x.id===p.id)||p;
  }
  function editableVariant(pid){
    const v=draft.variants[pid] ||= {items:C.clone(draft.items),mode:draft.mode,rounds:draft.rounds,blockOrder:[...draft.blockOrder]};
    // Merge only genuinely new shared slots; retain independent legacy exercises.
    for(const p of draft.items)if(!v.items.some(x=>x.id===p.id))v.items.push(C.clone(p));
    return v;
  }
  function addSharedItem(p){draft.items.push(p);for(const v of Object.values(draft.variants||{}))v.items.push(C.clone(p));}
  function renderSharedBuilder(){
    if(!draft)return;draft.items=C.orderedItems(draft);
    const steps=['Participants','Mouvements','Réglages'];
    let content='';
    if(builderStep===1)content=`<label class="field">Nom de la séance<input id="template-name" required maxlength="100" placeholder="Ex. Corps entier à deux" value="${esc(draft.name)}"></label><fieldset class="participant-picker"><legend>Qui participe ?</legend>${state.profiles.map(p=>`<label><input type="checkbox" data-builder-person="${p.id}" ${draft.participantIds.includes(p.id)?'checked':''}><span class="avatar">${esc(p.name[0])}</span>${esc(p.name)}</label>`).join('')}</fieldset><p class="subtle">Vous partagez le programme. Chacun garde ses charges, ses séries et son suivi.</p>${btn('Ajouter une personne','builder-person-new','','plain')}`;
    if(builderStep===2)content=`<p class="subtle">Tous les blocs sont facultatifs. Ajoutez les mouvements dont vous avez besoin.</p><div class="block-tabs">${draft.blockOrder.map(b=>btn(labels[b]+` (${draft.items.filter(p=>p.block===b).length})`,'builder-block',`data-id="${b}"`,b===builderBlock?'primary':'secondary')).join('')}</div><div class="builder-program">${draft.items.map((p,i)=>p.block===builderBlock?`<article class="program-line"><div class="program-thumb">${photo(exercise(p.exerciseId))}</div><div><strong>${esc(exercise(p.exerciseId)?.name)}</strong><small>${p.sets} série(s) · ${exercise(p.exerciseId)?.execution_mode==='duree'?p.duration+' s':p.reps+' rép.'}</small></div><div>${ibtn('up','Monter le mouvement','builder-up',`data-index="${i}" ${!draft.items.slice(0,i).some(q=>q.block===p.block)?'disabled':''}`)}${ibtn('down','Descendre le mouvement','builder-down',`data-index="${i}" ${!draft.items.slice(i+1).some(q=>q.block===p.block)?'disabled':''}`)}${ibtn('trash','Retirer le mouvement','builder-remove',`data-index="${i}"`)}</div></article>`:'').join('')||'<div class="quiet-empty">Aucun mouvement dans ce bloc.</div>'}</div><div class="row-actions">${btn(icon('plus')+' Ajouter un mouvement','builder-add',`data-block="${builderBlock}"`,'primary')}${builderBlock!=='renforcement'?btn('Choisir une routine','builder-routine',`data-block="${builderBlock}"`):''}</div><details class="advanced-options"><summary>Organisation et ordre des blocs</summary><label class="field">Organisation du renforcement<select id="template-mode"><option value="classic" ${draft.mode==='classic'?'selected':''}>Séries classiques</option><option value="circuit" ${draft.mode==='circuit'?'selected':''}>Circuit</option></select></label>${draft.mode==='circuit'?`<label class="field">Nombre de tours<input id="template-rounds" type="number" min="1" max="12" value="${draft.rounds}"></label><p>Une série par mouvement de renforcement à chaque tour.</p>`:''}${draft.blockOrder.map((b,i)=>`<div class="block-order"><span>${labels[b]}</span>${ibtn('up','Monter '+labels[b],'block-up',`data-index="${i}" ${i===0?'disabled':''}`)}${ibtn('down','Descendre '+labels[b],'block-down',`data-index="${i}" ${i===3?'disabled':''}`)}</div>`).join('')}</details>`;
    if(builderStep===3)content=`<p class="subtle">Un même tableau pour tous. Touchez une ligne pour adapter les séries, la charge ou choisir un autre exercice.</p><div class="shared-settings">${draft.items.map((p,i)=>`<section><div class="shared-settings-title"><span class="number-badge">${i+1}</span><strong>${esc(exercise(p.exerciseId)?.name)}</strong><small>${labels[p.block]}</small></div><div class="participant-columns">${draft.participantIds.map(pid=>{const v=variantItem(pid,p),e=exercise(v.exerciseId);return `<button class="person-setting" data-action="builder-adjust" data-person="${pid}" data-id="${p.id}"><strong>${esc(participantName(pid))}</strong><span>${e?.id!==p.exerciseId?esc(e.name)+' · ':''}${draft.mode==='circuit'&&p.block==='renforcement'?'1 série / tour':v.sets+' séries'} × ${e?.execution_mode==='duree'?v.duration+' s':v.reps+' rép.'}</span><span>${loadLabel(v)} ${icon('edit')}</span></button>`;}).join('')}</div></section>`).join('')}</div>`;
    showModal(esc(draft.name||'Créer une séance'),`<div class="builder-wizard"><nav class="wizard-steps" aria-label="Étapes de création">${steps.map((s,i)=>`<span class="${builderStep===i+1?'current':''}">${i+1}<b>${s}</b></span>`).join('')}</nav><div class="wizard-body">${content}</div><footer class="wizard-footer">${builderStep>1?btn(icon('back')+' Retour','builder-prev'):btn('Fermer et garder le brouillon','close-modal','','plain')}<span>${draft.items.length} mouvement(s)</span>${btn(builderStep===3?'Enregistrer la séance':'Continuer '+icon('arrow'),builderStep===3?'builder-save':'builder-next','','primary')}</footer></div>`,true);
  }
  function parameterFields(p,e,attr){return `<div class="parameter-grid"><label class="field">Séries<input type="number" min="1" max="20" data-param="sets" ${attr} value="${p.sets}"></label><label class="field">${e.execution_mode==='duree'?'Secondes':'Répétitions'}<input type="number" min="1" max="${e.execution_mode==='duree'?3600:1000}" data-param="${e.execution_mode==='duree'?'duration':'reps'}" ${attr} value="${e.execution_mode==='duree'?p.duration:p.reps}"></label>${!['none','band'].includes(p.loadMode)?`<label class="field">${p.loadMode==='per_dumbbell'?'Kg par haltère':'Charge (kg)'}<input type="number" min="0" max="1000" step="0.25" data-param="load" ${attr} value="${p.load}"></label>`:p.loadMode==='band'?`<label class="field">Élastique<input data-param="band" ${attr} value="${esc(p.band||'')}" maxlength="80"></label>`:''}</div><details class="advanced-options"><summary>Repos et type de charge</summary><label class="field">Repos (secondes)<input type="number" min="0" max="3600" data-param="rest" ${attr} value="${p.rest}"></label><label class="field">Charge<select data-param="loadMode" ${attr}>${Object.entries(loadNames).map(([k,l])=>`<option value="${k}" ${p.loadMode===k?'selected':''}>${l}</option>`).join('')}</select></label></details><p class="map-note">${esc(e.counting_instructions||'')}${draft?.mode==='circuit'&&p.block==='renforcement'?' En circuit : une série par tour.':''}</p>`;}
  function builderAdjust(pid,slotId){
    builderPerson=pid;builderSlot=slotId;const p=editableVariant(pid).items.find(p=>p.id===slotId),e=exercise(p.exerciseId);if(!e)return;
    showModal(esc(participantName(pid))+' · '+esc(e.name),`<div id="builder-adjust-form">${parameterFields(p,e,'data-parameter-scope="builder"')}${btn('Choisir un exercice différent','builder-alternative')}${btn('Voir la fiche','sheet',`data-id="${e.id}"`)}<div class="dialog-footer">${btn('Revenir au tableau commun','builder-return','','primary')}</div></div>`);
  }
  async function saveSharedTemplate(){
    if(!draft.name.trim()||!draft.items.length||!draft.participantIds.length){toast('Ajoute un nom, une personne et au moins un mouvement.');return;}
    draft.items=C.orderedItems(draft);
    for(const v of Object.values(draft.variants)){v.mode=draft.mode;v.rounds=draft.rounds;v.blockOrder=[...draft.blockOrder];v.items.sort((a,b)=>draft.items.findIndex(x=>x.id===a.id)-draft.items.findIndex(x=>x.id===b.id));}
    const i=state.templates.findIndex(t=>t.id===draft.id),copy=C.clone(draft);if(i<0)state.templates.push(copy);else state.templates[i]=copy;
    if(!await save())return;draft=null;templatesView='choose';closeModal();navigate('templates');toast('Séance commune enregistrée.');
  }
  function chooseParticipants(t,defs){
    pendingStart={template:C.clone(t),catalog:defs||catalog(),ids:t.participantIds||state.profiles.map(p=>p.id)};
    showModal(esc(t.name),`<p>Qui participe à cette séance ?</p><fieldset class="participant-picker">${state.profiles.map(p=>`<label><input type="checkbox" data-start-person="${p.id}" ${pendingStart.ids.includes(p.id)?'checked':''}>${esc(p.name)}</label>`).join('')}</fieldset><p class="subtle">Les exercices et les réglages personnels apparaîtront ensemble.</p><details><summary>Voir le programme · ${t.items.length} mouvements</summary><ol>${t.items.map(p=>`<li>${esc((defs||catalog()).find(e=>e.id===p.exerciseId)?.name)} <small>${labels[p.block]}</small></li>`).join('')}</ol></details><div class="dialog-footer">${btn('Annuler','close-modal')}${btn('Commencer la séance','confirm-start','','primary')}</div>`);
  }
  async function requestSharedStart(){
    if(!pendingStart?.ids.length){toast('Choisis au moins une personne.');return;}
    const ws=activeWorkouts();if(ws.length){const w=workout()||ws[0];showModal('Une séance est déjà en cours',`<p><strong>${esc(w.name)}</strong> · ${date(w.startedAt)}</p><p>Que souhaitez-vous faire ? Les séries et commentaires déjà enregistrés seront conservés.</p><div class="choice-stack">${btn('Reprendre cette séance','resume-workout',`data-id="${w.id}"`,'primary')}${btn('Terminer celle-ci et commencer la nouvelle','finish-and-start',`data-id="${w.id}"`)}${btn('Annuler','close-modal','','plain')}</div>${ws.length>1?`<p class="subtle">${ws.length-1} autre(s) séance(s) reste(nt) accessible(s) dans l’onglet Séances.</p>`:''}`);return;}await beginShared();
  }
  async function beginShared(){
    const p=pendingStart;if(!p)return;C.addWorkout(state,p.template,p.catalog,p.ids);pendingStart=null;activeHistory=null;trainingPerson=p.ids[0];
    if(!await save())return;closeModal();navigate('session');requestWakeLock();
  }
  function sharedSessionPage(){
    const w=workout();if(!w)return heading('SÉANCE','Aucune séance en cours','Choisissez ou créez votre programme.',btn('Voir les séances','go-templates','','primary'));
    w.cursor=Math.max(0,Math.min(w.cursor,w.slots.length-1));const slot=w.slots[w.cursor],sessions=w.participantIds.map(pid=>C.workoutSession(state,w,pid)).filter(Boolean),paused=sessions.some(s=>s.pausedAt);
    const pairs=w.participantIds.map(pid=>({pid,s:C.workoutSession(state,w,pid),e:C.workoutSession(state,w,pid)?.entries.find(e=>e.id===slot?.entries[pid])})),first=pairs.find(x=>x.e)?.e,same=pairs.filter(x=>x.e).every(x=>x.e.exerciseId===first?.exerciseId),done=sessions.flatMap(s=>s.entries.flatMap(e=>e.rows)).filter(r=>r.status==='done').length;
    return `<section class="shared-session ${activeMode()?'large-view':''}"><header class="shared-session-head"><div><span class="eyebrow">${esc(w.name)} · ${w.participantIds.map(pid=>esc(participantName(pid))).join(' & ')}</span><div class="session-meta"><span data-clock="${sessions[0]?.id}">${clock(C.elapsed(sessions[0]))}</span><span>${done} séries validées</span></div></div><div>${visibilityControl()}${btn(paused?'Reprendre':'Pause','shared-pause')}${ibtn('settings','Options de séance','shared-options')}</div></header>${paused?'<p class="notice warning">Séance et minuteurs en pause pour tout le monde.</p>':''}${!first?empty('workout','Composez votre séance','Ajoutez le premier mouvement.',btn('Ajouter un mouvement','shared-add','','primary')):`<div class="movement-heading"><span class="phase-chip ${slot.block}">${labels[slot.block]}</span><small>Étape ${w.cursor+1} / ${w.slots.length}</small><h1>${same?esc(first.definition.name):'Chacun son mouvement'}</h1></div><div class="shared-live-grid"><section class="shared-demonstration"><div class="shared-photo">${photo(first.definition,'','eager')}${!same?`<small>${esc(participantName(pairs.find(x=>x.e)?.pid))}</small>`:''}</div><div class="shared-map">${B.maps(first.definition.muscle_roles,{compact:true,targetRegions:first.definition.target_regions})}</div><p>${esc(first.definition.key_cues[0]||first.definition.steps[0])}</p><div>${btn('Voir le geste et les muscles','sheet',`data-id="${first.exerciseId}"`)}</div></section><div class="participants-board">${pairs.map(({pid,s,e})=>participantCard(w,pid,s,e,paused,same)).join('')}</div></div><div class="shared-next">${btn(icon('back')+' Précédent','shared-prev',w.cursor===0?'disabled':'')}${btn('Programme','shared-program')}${btn(w.cursor===w.slots.length-1?'Bilan et fin':'Étape suivante '+icon('arrow'),w.cursor===w.slots.length-1?'shared-finish':'shared-next','','primary')}</div>`}</section>`;
  }
  function participantCard(w,pid,s,e,paused,same){
    if(!e)return `<article class="participant-card"><h2>${esc(participantName(pid))}</h2><p>Pas de mouvement à cette étape.</p></article>`;
    const r=e.rows.find(r=>r.status==='pending'),done=e.rows.filter(r=>r.status==='done').length,attrs=`data-person="${pid}" data-entry="${e.id}"`,rest=paused?s.restRemaining:(s.restUntil?Math.max(0,s.restUntil-Date.now()):null),effort=e.rows.some(r=>r.id===s.effortRowId)?(paused?s.effortRemaining:(s.effortUntil?Math.max(0,s.effortUntil-Date.now()):null)):null;
    return `<article class="participant-card ${r?'':'participant-done'}" data-participant="${pid}"><header><h2>${esc(participantName(pid))}</h2>${ibtn('edit','Ajuster pour '+participantName(pid),'participant-edit',attrs)}</header>${!same?`<div class="different-exercise"><span class="different-thumb">${photo(e.definition)}</span><strong>${esc(e.definition.name)}</strong>${btn('Voir son geste','sheet',`data-id="${e.exerciseId}" data-person="${pid}"`,'plain')}</div>`:''}<div class="person-progress">${done} / ${e.rows.length} séries validées ${r&&r.side!=='ensemble'?`<strong>Côté ${esc(r.side)}</strong>`:''}</div>${r?`<div class="person-dose"><strong>${e.definition.execution_mode==='duree'?r.duration:r.reps}<small>${e.definition.execution_mode==='duree'?' s':e.definition.repetition_counting==='paire'?' paires':' rép.'}</small></strong><span>${loadLabel(r)}</span></div>`:'<div class="person-finished">'+icon('check')+' Mouvement terminé</div>'}<div class="person-timer" data-person-timer="${pid}" role="status">${paused?'En pause':rest>0?'Repos · '+clock(rest+999):effort!==null?'Effort · '+clock(effort+999):r?'Prêt pour la série '+r.number:'À votre rythme'}</div><div data-person-primary="${pid}">${participantPrimary(pid,s,e,paused)}</div><div class="person-secondary">${btn('Ressenti','participant-feedback',attrs,'plain')}${s.undo?btn('Annuler','participant-undo',attrs,'plain'):''}</div></article>`;
  }
  function participantPrimary(pid,s,e,paused){
    const r=e.rows.find(r=>r.status==='pending'),attrs=`data-person="${pid}" data-entry="${e.id}" ${r?`data-row="${r.id}"`:''}`;
    if(paused)return btn('En pause','shared-pause','disabled','primary full');
    if(s.restUntil>Date.now())return btn('Passer le repos','participant-rest',attrs,'secondary full');
    if(!r)return '<span class="ready-label">Terminé pour cette personne</span>';
    if(e.definition.execution_mode==='duree'&&s.effortRowId!==r.id)return btn(icon('play')+' Démarrer '+r.duration+' s','participant-timer',attrs,'primary full');
    return btn(icon('check')+' Valider ma série','participant-done',attrs,'primary full');
  }
  function participantEditor(pid){
    const s=selectParticipant(pid),w=workout(),entry=s?.entries.find(e=>e.id===w.slots[w.cursor]?.entries[pid]);if(!entry)return;
    showModal(esc(participantName(pid))+' · '+esc(entry.definition.name),`<div id="participant-editor"><p>Modifiez les séries à venir ou corrigez les séries réalisées. Ces valeurs concernent uniquement ${esc(participantName(pid))}.</p><div class="row-actions">${btn('Exercice différent','participant-replace',`data-person="${pid}"`)}${btn('Ajouter une série','participant-add-set',`data-person="${pid}"`)}</div><label class="field">Type de charge<select id="entry-load-mode">${Object.entries(loadNames).map(([k,l])=>`<option value="${k}" ${entry.plan.loadMode===k?'selected':''}>${l}</option>`).join('')}</select></label><label class="field">Repos (s)<input id="entry-rest" type="number" min="0" max="3600" value="${entry.plan.rest}"></label><p class="counting-note">${esc(entry.definition.counting_instructions||'')}</p><div class="sets-table"><div class="set-head"><span>Série</span><span>Rép. / s</span><span>Charge</span><span>Effort / 10</span><span>État</span></div>${entry.rows.map(r=>`<div class="participant-row-wrapper">${setRow(entry,r,s).replaceAll('data-action="complete-set"','data-action="participant-row-done"').replaceAll('data-action="skip-set"','data-action="participant-row-skip"').replaceAll('data-action="reopen-set"','data-action="participant-row-reopen"').replaceAll('data-action="start-effort"','data-action="participant-row-timer"')}</div>`).join('')}</div>${previousLine(entry,s)}<label class="field">Note de ${esc(participantName(pid))}<textarea id="entry-note" maxlength="3000" rows="2">${esc(entry.note)}</textarea></label>${feedbackCards(entry,s)}<div class="dialog-footer">${btn('Revenir à la séance','participant-return','','primary')}</div></div>`,true);
  }
  function sharedFinish(){
    const w=workout();if(!w)return;showModal('Bilan de la séance commune',`<p>Seules les séries validées comptent. Les séries restantes ne seront pas ajoutées au bilan.</p><div class="participant-columns">${w.participantIds.map(pid=>{const s=C.workoutSession(state,w,pid),t=C.totals([s]);return `<section class="finish-person"><h3>${esc(participantName(pid))}</h3><p><strong>${t.done} séries · ${Math.round(C.elapsed(s)/60000)} min</strong></p>${B.maps(B.rolesFromTotals(t.muscles),{compact:true})}<p>${Object.keys(t.muscles).map(m=>esc(D.muscles[m]||m)).join(', ')||'Aucune série de renforcement validée.'}</p><label class="field">Note personnelle<textarea data-finish-person="${pid}" maxlength="5000">${esc(s.note)}</textarea></label></section>`;}).join('')}</div>${roleLegend()}<p class="map-note">La carte décrit les rôles musculaires des exercices validés, pas une intensité mesurée. Échauffement, mobilisation et étirements restent dans le journal.</p><div class="dialog-footer">${btn('Continuer la séance','close-modal')}${btn('Terminer pour tout le monde','shared-finish-confirm','','primary')}</div>`,true);
  }
  function sharedProgram(){const w=workout();showModal('Le programme commun',`<div class="shared-program-list">${w.slots.map((slot,i)=>`<button data-action="shared-select-slot" data-index="${i}"><span class="number-badge">${i+1}</span><span><strong>${labels[slot.block]}</strong>${w.participantIds.map(pid=>{const e=C.workoutSession(state,w,pid)?.entries.find(e=>e.id===slot.entries[pid]);return `<small>${esc(participantName(pid))} : ${esc(e?.definition.name||'—')}</small>`;}).join('')}</span></button>`).join('')}</div><div class="row-actions">${btn('Ajouter un mouvement','shared-add')}${btn('Terminer la séance','shared-finish')}</div>`,true);}
  function installGuide(){
    const st=window.RenfoInstall?.getState()||{};showModal(st.installed?'Renfo est installé':'Installer Renfo',st.installed?'<p>Renfo est déjà ouvert comme une application.</p>':`<p>Retrouvez Renfo directement depuis une icône sur votre écran d’accueil.</p>${st.canPrompt?btn('Installer sur cet appareil','install-native','','primary full'):''}${st.platform==='ios'?`<ol class="step-list"><li>Ouvrez cette page dans Safari.</li><li>Touchez <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.</li><li>Activez <strong>Ouvrir comme app web</strong> si proposé, puis <strong>Ajouter</strong>.</li></ol><div class="notice"><strong>Vous avez déjà un carnet ici ?</strong><p>Exportez-le avant l’installation. Sur iPhone, l’application installée peut avoir un stockage séparé de Safari. Ouvrez ensuite Renfo depuis son icône et utilisez Réglages → Importer.</p>${btn('Exporter mon carnet','export')}</div>`:`<ol class="step-list"><li>Ouvrez le menu de votre navigateur <strong>⋮</strong>.</li><li>Choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong> (le libellé varie).</li><li>Confirmez, puis ouvrez l’icône Renfo.</li></ol>${st.platform==='desktop'?'<p>Dans Chrome ou Edge, l’icône d’installation peut aussi apparaître dans la barre d’adresse.</p>':''}`}<details><summary>Utiliser Renfo sans connexion</summary><p>Ouvrez l’application une première fois en ligne. Dans Réglages, utilisez « Préparer les images hors ligne » pour emporter toutes les illustrations. Le suivi reste local à cet appareil.</p></details>`);
  }
  async function sharedAction(action,button){
    const id=button.dataset.id,pid=button.dataset.person||trainingPerson,w=workout();
    if(button.dataset.person)selectParticipant(pid);
    switch(action){
      case 'choose-sessions':templatesView='choose';navigate('templates');return true;
      case 'sessions-hub':templatesView='hub';render();return true;
      case 'go-templates':templatesView='hub';closeModal();navigate('templates');return true;
      case 'new-template':openSharedBuilder();return true;
      case 'edit-template':openSharedBuilder(id);return true;
      case 'duplicate-template':{const t=C.clone(state.templates.find(t=>t.id===id));t.id=C.uid();t.name+=' · copie';state.templates.push(t);if(await save()){render();toast('Séance dupliquée.');}return true;}
      case 'builder-block':builderBlock=id;renderSharedBuilder();return true;
      case 'builder-next':if(builderStep===1&&(!draft.name.trim()||!draft.participantIds.length)){toast('Donne un nom et choisis au moins une personne.');return true;}if(builderStep===2&&!draft.items.length){toast('Ajoute au moins un mouvement.');return true;}builderStep=Math.min(3,builderStep+1);renderSharedBuilder();return true;
      case 'builder-prev':builderStep=Math.max(1,builderStep-1);renderSharedBuilder();return true;
      case 'builder-return':renderSharedBuilder();return true;
      case 'builder-save':await saveSharedTemplate();return true;
      case 'builder-adjust':builderAdjust(pid,id);return true;
      case 'builder-alternative':openPicker('builder-alternative');return true;
      case 'builder-person-new':showModal('Ajouter une personne',`<label class="field">Prénom<input id="builder-new-person" maxlength="80"></label><div class="dialog-footer">${btn('Retour','builder-return')}${btn('Ajouter','builder-person-confirm','','primary')}</div>`);return true;
      case 'builder-person-confirm':{const name=$('#builder-new-person').value.trim();if(!name){toast('Indique un prénom.');return true;}const id=C.uid();state.profiles.push({id,name});state.profileData[id]=C.profileDefaults();draft.participantIds.push(id);if(await save())renderSharedBuilder();return true;}
      case 'builder-remove':{const [p]=draft.items.splice(Number(button.dataset.index),1);for(const v of Object.values(draft.variants))v.items=v.items.filter(x=>x.id!==p.id);renderSharedBuilder();return true;}
      case 'picker-done':if(['builder','builder-alternative'].includes(pickerTarget)){renderSharedBuilder();return true;}if(pickerTarget==='shared-replace'){participantEditor(trainingPerson);return true;}return false;
      case 'pick-exercise':{
        const e=exercise(id);
        if(pickerTarget==='builder'){addSharedItem(C.item(e,{block:pickerBlock||C.family(e)}));button.textContent='Ajouté';toast(e.name+' ajouté.');return true;}
        if(pickerTarget==='builder-alternative'){const p=editableVariant(builderPerson).items.find(x=>x.id===builderSlot);Object.assign(p,C.item(e,{id:p.id,block:p.block,sets:p.sets}));builderAdjust(builderPerson,builderSlot);return true;}
        if(pickerTarget==='shared-add'){
          const p=C.item(e,{block:pickerBlock||C.family(e)}),slot={id:C.uid(),block:p.block,entries:{}};
          for(const who of w.participantIds){const s=C.workoutSession(state,w,who),entry=C.makeEntry(C.clone(p),e);s.entries.push(entry);slot.entries[who]=entry.id;}
          w.slots.push(slot);w.cursor=w.slots.length-1;if(await save()){closeModal();render();}return true;
        }
        if(pickerTarget==='shared-replace'){
          const s=selectParticipant(trainingPerson),slot=w.slots[w.cursor],old=s.entries.find(e=>e.id===slot.entries[trainingPerson]),remaining=old.rows.filter(r=>r.status==='pending').length;
          if(!remaining){toast('Ce mouvement est terminé. Ajoutez un mouvement pour continuer.');return true;}
          const fresh=C.makeEntry(C.item(e,{id:old.plan.id,block:old.plan.block,sets:Math.max(1,Math.ceil(remaining/C.sideCount(e)))}),e),index=s.entries.indexOf(old);
          if(old.note||old.feedback?.length||old.rows.some(r=>r.status!=='pending')){old.rows=old.rows.filter(r=>r.status!=='pending');s.entries.splice(index+1,0,fresh);}else s.entries.splice(index,1,fresh);
          slot.entries[trainingPerson]=fresh.id;s.cursor=s.entries.indexOf(fresh);s.restUntil=s.restRemaining=s.effortUntil=s.effortRemaining=s.effortRowId=null;if(await save()){closeModal();render();}return true;
        }return false;
      }
      case 'insert-warmup':{const r=D.routines.find(r=>r.id===id);for(const p of routineItems(r))addSharedItem(p);renderSharedBuilder();return true;}
      case 'routine-filter':routineFilter=id;chooseWarmup();return true;
      case 'routine-template':{const r=D.routines.find(r=>r.id===id);draft=null;openSharedBuilder();draft.name=r.name;for(const p of routineItems(r))addSharedItem(p);builderStep=2;builderBlock=r.family;renderSharedBuilder();return true;}
      case 'start-template':{const t=state.templates.find(t=>t.id===id);if(t?.items.length)chooseParticipants(t);else toast('Ajoute au moins un exercice.');return true;}
      case 'quick-start':openSharedBuilder();return true;
      case 'confirm-start':await requestSharedStart();return true;
      case 'finish-and-start':{const previous=state.workouts.find(w=>w.id===id);C.finishWorkout(state,previous);await beginShared();return true;}
      case 'resume-workout':{const old=workout();if(old&&old.id!==id)C.pauseWorkout(state,old);state.activeWorkoutId=id;C.syncActivePointers(state);activeHistory=null;trainingPerson=null;pendingStart=null;C.resumeWorkout(state,workout());if(await save()){closeModal();navigate('session');requestWakeLock();}return true;}
      case 'resume-session':activeHistory=null;navigate('session');return true;
      case 'visibility':trainingPrefs().visibility=activeMode()?'normal':'active';await save();render();return true;
      case 'shared-pause':if(C.workoutSession(state,w,w.participantIds[0])?.pausedAt)C.resumeWorkout(state,w);else C.pauseWorkout(state,w);await save();render();requestWakeLock();return true;
      case 'shared-prev':w.cursor=Math.max(0,w.cursor-1);await save();render();return true;
      case 'shared-next':w.cursor=Math.min(w.slots.length-1,w.cursor+1);await save();render();return true;
      case 'shared-select-slot':w.cursor=Number(button.dataset.index);await save();closeModal();render();return true;
      case 'shared-program':sharedProgram();return true;
      case 'shared-add':pickerBlock=null;openPicker('shared-add');return true;
      case 'shared-finish':sharedFinish();return true;
      case 'shared-finish-confirm':for(const el of $$('[data-finish-person]'))C.workoutSession(state,w,el.dataset.finishPerson).note=el.value.trim();C.finishWorkout(state,w);if(await save()){closeModal();activeHistory=null;templatesView='hub';navigate('templates');toast('Séance terminée. Le suivi de chacun est enregistré.');}return true;
      case 'shared-options':showModal('Options de la séance',`<div class="choice-stack">${btn('Voir ou compléter le programme','shared-program')}${btn(trainingPrefs().sounds?'Désactiver les sons':'Activer les sons','shared-sound')}${btn(trainingPrefs().voice?'Désactiver la voix':'Activer la voix','shared-voice')}${btn('Plein écran','fullscreen')}${btn('Terminer la séance','shared-finish')}</div>`);return true;
      case 'shared-sound':trainingPrefs().sounds=!trainingPrefs().sounds;await save();toast(trainingPrefs().sounds?'Sons activés':'Sons désactivés');closeModal();return true;
      case 'shared-voice':trainingPrefs().voice=!trainingPrefs().voice;await save();announce('Les annonces vocales sont activées.');closeModal();return true;
      case 'participant-edit':participantEditor(pid);return true;
      case 'participant-feedback':openFeedback();return true;
      case 'participant-replace':openPicker('shared-replace');return true;
      case 'participant-return':closeModal();render();return true;
      case 'participant-add-set':{const s=selectParticipant(pid),e=s.entries[s.cursor],num=Math.max(0,...e.rows.map(r=>r.number))+1;const rows=C.makeRows(e.definition,{...e.plan,...e.rows.at(-1),sets:1});rows.forEach(r=>r.number=num);e.rows.push(...rows);await save();participantEditor(pid);render();return true;}
      case 'participant-undo':{const s=selectParticipant(pid);C.undo(s);await save();render();return true;}
      case 'participant-done':case 'participant-timer':case 'participant-rest':case 'participant-row-done':case 'participant-row-skip':case 'participant-row-reopen':case 'participant-row-timer':{
        const s=selectParticipant(pid),e=s?.entries.find(e=>e.id===button.dataset.entry)||s?.entries[s.cursor],r=e?.rows.find(r=>r.id===button.dataset.row),editor=action.startsWith('participant-row-');if(!s||s.pausedAt){toast('Reprenez la séance pour continuer.');return true;}
        if(action==='participant-rest'){s.restUntil=s.restRemaining=null;}
        else if(action.endsWith('timer')){if(!r||r.status!=='pending')return true;s.restUntil=null;s.restRemaining=null;s.effortUntil=Date.now()+r.duration*1000;s.effortRemaining=null;s.effortRowId=r.id;}
        else if(action==='participant-row-reopen'){r.status='pending';r.completedAt=null;}
        else {if(!r||r.status!=='pending')return true;C.complete(s,e.id,r.id,action==='participant-row-skip'?'skipped':'done');announce(participantName(pid)+', série '+r.number+' enregistrée.');}
        await save();render();if(editor)participantEditor(pid);else $(`[data-person-primary="${pid}"] button`)?.focus();return true;
      }
      case 'sheet-add':if(workout()){pickerBlock=C.family(exercise(id));pickerTarget='shared-add';return sharedAction('pick-exercise',button);}else{if(!draft)openSharedBuilder();addSharedItem(C.item(exercise(id)));builderStep=2;builderBlock=C.family(exercise(id));renderSharedBuilder();return true;}
      case 'repeat-session':{const s=state.sessions.find(s=>s.id===id),t={id:null,name:s.name,participantIds:[s.profileId],items:s.entries.map(e=>{const r=e.rows.find(r=>r.status==='done')||e.rows[0];return {...e.plan,...(r?{load:r.load,loadMode:r.loadMode,reps:r.reps,duration:r.duration}:{}),id:C.uid(),sets:Math.max(1,new Set(e.rows.map(r=>r.number)).size)};})};chooseParticipants(t,s.entries.map(e=>e.definition));return true;}
      case 'confirm-delete-session':{const s=state.sessions.find(s=>s.id===id),group=state.workouts.find(w=>w.id===s.workoutId);state.sessions=state.sessions.filter(s=>s.id!==id);if(group){group.participantIds=group.participantIds.filter(pid=>pid!==s.profileId);delete group.sessionIds[s.profileId];for(const slot of group.slots)delete slot.entries[s.profileId];group.slots=group.slots.filter(slot=>Object.keys(slot.entries).length);group.cursor=Math.max(0,Math.min(group.cursor,group.slots.length-1));if(!group.participantIds.length)state.workouts=state.workouts.filter(w=>w.id!==group.id);}if(await save()){closeModal();render();}return true;}
      case 'install-open':installGuide();return true;
      case 'install-native':{const r=await RenfoInstall.requestInstall();if(r.status==='accepted')toast('Confirmez l’installation dans le navigateur.');else if(r.status==='dismissed')toast('Installation annulée. Le guide reste disponible.');else if(r.status==='error')toast('L’installation n’a pas abouti. Utilisez le menu du navigateur.');installGuide();return true;}
    }return false;
  }
  function routineItems(r){return r.items?r.items.map(p=>C.item(exercise(p.exerciseId),{...p,id:C.uid(),block:pickerBlock||r.family})):r.exerciseIds.map(id=>C.item(exercise(id),{block:pickerBlock||r.family,sets:1,load:0,loadMode:'none',rest:10}));}
  const sharedTimerNotified=new Set();
  function sharedTick(){
    const w=workout();if(!w||route!=='session'||activeHistory)return;
    for(const pid of w.participantIds){const s=C.workoutSession(state,w,pid),e=s?.entries.find(e=>e.id===w.slots[w.cursor]?.entries[pid]);if(!s||!e)continue;
      const rest=s.pausedAt?s.restRemaining:(s.restUntil?Math.max(0,s.restUntil-Date.now()):null),effort=e.rows.some(r=>r.id===s.effortRowId)?(s.pausedAt?s.effortRemaining:(s.effortUntil?Math.max(0,s.effortUntil-Date.now()):null)):null,r=e.rows.find(r=>r.status==='pending'),el=$(`[data-person-timer="${pid}"]`),primary=$(`[data-person-primary="${pid}"]`);
      if(el)el.textContent=s.pausedAt?'En pause':rest>0?'Repos · '+clock(rest+999):effort!==null?'Effort · '+clock(effort+999):r?'Prêt pour la série '+r.number:'À votre rythme';
      if(primary){const html=participantPrimary(pid,s,e,!!s.pausedAt);if(primary.dataset.signature!==html){primary.innerHTML=html;primary.dataset.signature=html;}}
      for(const key of ['rest','effort'])if(s[key+'Until']&&s[key+'Until']<=Date.now()&&!s.pausedAt){const token=s.id+key+s[key+'Until'];if(!sharedTimerNotified.has(token)){sharedTimerNotified.add(token);beep();announce(participantName(pid)+(key==='rest'?', repos terminé.':', durée atteinte. Validez si la série est réalisée.'));}}
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
    try {if(await sharedAction(action,button))return;}catch(error){console.error(error);toast(error.message||'Action impossible.');return;}
    const s=currentSession(),entry=s?.entries[s.cursor];
    try {
      switch(action){
        case 'profiles':openProfiles();break;
        case 'visibility':state.preferences.visibility=state.preferences.visibility==='active'?'normal':'active';await save();render();window.scrollTo({top:0,behavior:'instant'});requestWakeLock();if(activeMode())announceCurrent();break;
        case 'fullscreen':if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else toast('Plein écran indisponible : utilise Ajouter à l’écran d’accueil.');break;
        case 'toggle-sound':state.preferences.sounds=!state.preferences.sounds;await save();render();if(state.preferences.sounds)beep();break;
        case 'toggle-voice':state.preferences.voice=!state.preferences.voice;await save();render();if(state.preferences.voice)announceCurrent();else window.speechSynthesis?.cancel();break;
        case 'focus-done':await focusDone();break;
        case 'focus-next':{const i=s.entries.findIndex((e,i)=>i>s.cursor&&e.rows.some(r=>r.status==='pending'));s.cursor=i>=0?i:s.entries.findIndex(e=>e.rows.some(r=>r.status==='pending'));s.cursor=Math.max(0,s.cursor);await save();render();break;}
        case 'entry-up':case 'entry-down':{const to=s.cursor+(action==='entry-up'?-1:1);[s.entries[s.cursor],s.entries[to]]=[s.entries[to],s.entries[s.cursor]];s.cursor=to;await save();render();break;}
        case 'entry-remove':askConfirm('Retirer ce mouvement ?', 'Les séries déjà réalisées et leurs commentaires seront conservés. Seules les séries à venir seront retirées.', 'confirm-entry-remove');break;
        case 'confirm-entry-remove':entry.rows=entry.rows.filter(r=>r.status!=='pending');if(!entry.rows.length&&!entry.feedback.length&&!entry.note)s.entries.splice(s.cursor,1);s.cursor=Math.max(0,Math.min(s.cursor,s.entries.length-1));await save();closeModal();render();break;
        case 'block-up':case 'block-down':{const to=index+(action==='block-up'?-1:1);[draft.blockOrder[index],draft.blockOrder[to]]=[draft.blockOrder[to],draft.blockOrder[index]];renderBuilder();break;}
        case 'copy-version':{const base=state.templates.find(t=>t.id===draft.id),from=$('#copy-profile').value,copy=from==='base'?C.clone(base):C.templateForProfile(base,from);draft.items=copy.items;draft.mode=copy.mode;draft.rounds=copy.rounds;draft.blockOrder=copy.blockOrder||[...C.blocks];renderBuilder();toast('Version copiée dans le brouillon. Enregistre pour la conserver.');break;}
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
        case 'save-note':{const owner=sheetPerson||state.currentProfileId,notes=owner===state.currentProfileId?state.exerciseNotes:state.profileData[owner].exerciseNotes;notes[id]=$('#pinned-note').value.trim();if(await save())toast('Repère enregistré pour '+participantName(owner)+'.');break;}
        case 'new-template':openBuilder();break;
        case 'edit-template':openBuilder(id);break;
        case 'duplicate-template':{const t=personalTemplate(state.templates.find(x=>x.id===id));delete t.variants;t.id=C.uid();t.name+=' · copie';t.items.forEach(p=>p.id=C.uid());state.templates.push(t);await save();render();toast('Séance dupliquée.');break;}
        case 'delete-template':askConfirm('Supprimer ce modèle ?','Ce modèle et ses versions personnelles seront retirés pour tout le monde. Les séances déjà réalisées seront conservées.','confirm-delete-template',`data-id="${id}"`);break;
        case 'confirm-delete-template':state.templates=state.templates.filter(t=>t.id!==id);await save();closeModal();render();break;
        case 'builder-add':pickerBlock=button.dataset.block||null;openPicker('builder',pickerBlock||'all');break;
        case 'builder-routine':pickerBlock=button.dataset.block;routineFilter='all';routineTarget='builder';chooseWarmup();break;
        case 'builder-warmup':pickerBlock='echauffement';routineTarget='builder';chooseWarmup();break;
        case 'builder-up':case 'builder-down':{const same=draft.items.map((p,i)=>p.block===draft.items[index].block?i:-1).filter(i=>i>=0),pos=same.indexOf(index),to=same[pos+(action==='builder-up'?-1:1)];if(to===undefined)break;[draft.items[index],draft.items[to]]=[draft.items[to],draft.items[index]];renderBuilder();break;}
        case 'builder-remove':draft.items.splice(index,1);renderBuilder();break;
        case 'picker-category':openPicker(pickerTarget,id);break;
        case 'picker-done':if(pickerTarget==='builder')renderBuilder();else closeModal();break;
        case 'pick-exercise':{
          const ex=exercise(id);
          if(pickerTarget==='builder'){draft.items.push(C.item(ex,{block:pickerBlock||C.family(ex)}));button.innerHTML=icon('check')+' Ajouté';toast(ex.name+' ajouté.');setTimeout(()=>{if(button.isConnected)button.innerHTML=icon('plus')+' Ajouter';},900);}
          else if(pickerTarget==='replace'){
            // Preserve performed rows as a separate completed entry before replacing its unfinished work.
            const old=currentSession().entries[currentSession().cursor],remaining=old.rows.filter(r=>r.status==='pending').length;
            if(!remaining){toast('Aucune série restante à remplacer.');break;}
            if(old.note||old.feedback?.length||old.rows.some(r=>r.status!=='pending')){old.rows=old.rows.filter(r=>r.status!=='pending');currentSession().entries.splice(currentSession().cursor+1,0,C.makeEntry(C.item(ex,{block:old.plan.block,sets:Math.max(1,Math.ceil(remaining/C.sideCount(ex)))}),ex));currentSession().cursor++;}
            else currentSession().entries[currentSession().cursor]=C.makeEntry(C.item(ex,{block:old.plan.block}),ex);
            await save();closeModal();render();
          }else{const target=currentSession();target.entries.push(C.makeEntry(C.item(ex,{block:pickerBlock||C.family(ex)}),ex));target.cursor=target.entries.length-1;await save();closeModal();render();}
          break;
        }
        case 'insert-warmup':{const r=D.routines.find(x=>x.id===id);draft.items.push(...r.exerciseIds.map(id=>{const ex=exercise(id);return C.item(ex,{block:pickerBlock||r.family,sets:1,reps:ex.default_reps||6,load:0,duration:ex.default_duration||30,rest:10});}));renderBuilder();break;}
        case 'routine-template':{builderScope='personal';const r=D.routines.find(x=>x.id===id);draft={id:C.uid(),name:r.name,description:labels[r.family],mode:'classic',rounds:1,items:r.exerciseIds.map(id=>C.item(exercise(id),{block:r.family,sets:1,load:0,rest:10}))};renderBuilder();break;}
        case 'sheet-add':{
          const ex=exercise(id);closeModal();
          if(active()){activeHistory=null;active().entries.push(C.makeEntry(C.item(ex),ex));active().cursor=active().entries.length-1;await save();navigate('session');}
          else{openBuilder();draft.items.push(C.item(ex));renderBuilder();}break;
        }
        case 'start-template':await startTemplate(id);break;
        case 'quick-start':await quickStart();break;
        case 'resume-session':activeHistory=null;navigate('session');requestWakeLock();break;
        case 'session-add':pickerBlock=button.dataset.block||null;openPicker('session',pickerBlock||'all');break;
        case 'session-replace':pickerBlock=entry.plan.block;openPicker('replace');break;
        case 'select-entry':s.cursor=index;await save();render();break;
        case 'prev-entry':s.cursor=Math.max(0,s.cursor-1);await save();render();break;
        case 'next-entry':s.cursor=Math.min(s.entries.length-1,s.cursor+1);await save();render();window.scrollTo({top:0,behavior:'smooth'});break;
        case 'pause-session':if(s.pausedAt){C.resume(s);requestWakeLock();}else{C.pause(s);wakeLock?.release();}await save();render();break;
        case 'complete-set':case 'skip-set':C.complete(s,button.dataset.entry,button.dataset.row,action==='complete-set'?'done':'skipped');await save();render();break;
        case 'reopen-set':{const r=entry.rows.find(x=>x.id===button.dataset.row);r.status='pending';r.completedAt=null;await save();render();break;}
        case 'undo-set':C.undo(s);await save();render();break;
        case 'add-set':{const next=Math.max(0,...entry.rows.map(r=>r.number))+1;const last=entry.rows.at(-1);const rows=C.makeRows(entry.definition,{...entry.plan,sets:1,...last});rows.forEach(r=>r.number=next);entry.rows.push(...rows);await save();render();break;}
        case 'use-last':{const last=C.lastPerformance(C.personalSessions(state,s.profileId),entry.exerciseId,s.id);if(!last){toast('Aucune performance précédente à reprendre.');break;}for(const row of entry.rows.filter(r=>r.status==='pending')){for(const k of ['load','loadMode','band','reps','duration'])row[k]=last.row[k];}entry.plan.loadMode=last.row.loadMode;await save();render();toast('Dernières valeurs reprises pour les séries à venir.');break;}
        case 'start-effort':{if(s.pausedAt){toast('Reprends la séance avant de lancer le minuteur.');break;}s.restUntil=null;s.restRemaining=null;const r=entry.rows.find(x=>x.id===button.dataset.row);s.effortUntil=Date.now()+r.duration*1000;s.effortRowId=r.id;effortNotified=null;await save();render();break;}
        case 'effort-stop':s.effortUntil=null;s.effortRemaining=null;s.effortRowId=null;await save();render();break;
        case 'rest-more':if(s.pausedAt)s.restRemaining=(s.restRemaining||0)+15000;else s.restUntil=Math.max(Date.now(),s.restUntil||Date.now())+15000;restNotified=null;await save();tick();break;
        case 'rest-skip':s.restUntil=null;s.restRemaining=null;await save();render();break;
        case 'finish-dialog':finishDialog();break;
        case 'open-session':activeHistory=id;navigate('session');break;
        case 'repeat-session':{
          if(active()){activeHistory=null;navigate('session');toast('Une séance est déjà en cours.');break;}
          const source=state.sessions.find(x=>x.id===id), t={id:null,name:source.name,items:source.entries.map(e=>{const first=e.rows.find(r=>r.status==='done');return {...e.plan,...(first?{load:first.load,loadMode:first.loadMode,reps:first.reps,duration:first.duration,band:first.band}:{}),exerciseId:e.exerciseId,sets:Math.max(1,new Set(e.rows.map(r=>r.number)).size)};})};
          const defs=source.entries.map(e=>e.definition),created=C.createSession({...t,profileId:state.currentProfileId},defs);state.sessions.unshift(created);state.activeId=created.id;activeHistory=null;await save();render();requestWakeLock();break;
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
        case 'import-open':if(state.sessions.some(s=>s.status==='active')){toast('Termine les séances en cours de chaque personne avant d’importer un carnet.');break;}$('#import-file').click();break;
        case 'persist-storage':toast(await navigator.storage?.persist?.()?'Stockage persistant accordé sur cet appareil.':'Le navigateur n’a pas accordé le stockage persistant. Garde une sauvegarde exportée.');break;
        case 'cache-images':await cacheOffline();break;
        case 'check-update':{const reg=await navigator.serviceWorker?.getRegistration();if(!reg){toast('Les mises à jour automatiques nécessitent la version hébergée.');break;}const ready=()=>toast('Mise à jour prête. Fermez tous les onglets Renfo puis rouvrez l’application. Votre carnet est conservé.');const watch=()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)ready();});};reg.addEventListener('updatefound',watch,{once:true});watch();await reg.update();if(reg.waiting)ready();else toast('Vérification en cours. Une mise à jour éventuelle sera signalée.');break;}

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
    if(el.dataset.param&&el.type==='number'&&el.value!==''&&el.checkValidity()){const p=editableVariant(builderPerson).items.find(p=>p.id===builderSlot);p[el.dataset.param]=Number(el.value);}
  });
  document.addEventListener('change',async event=>{
    const el=event.target,s=currentSession(),entry=s?.entries[s.cursor];
    if(el.dataset.builderPerson){draft.participantIds=el.checked?[...new Set([...draft.participantIds,el.dataset.builderPerson])]:draft.participantIds.filter(id=>id!==el.dataset.builderPerson);return;}
    if(el.dataset.startPerson){pendingStart.ids=el.checked?[...new Set([...pendingStart.ids,el.dataset.startPerson])]:pendingStart.ids.filter(id=>id!==el.dataset.startPerson);return;}
    if(el.dataset.param){if(!el.checkValidity()){el.reportValidity();return;}const p=editableVariant(builderPerson).items.find(x=>x.id===builderSlot),key=el.dataset.param;p[key]=['sets','reps','duration','load','rest'].includes(key)?Number(el.value):el.value;if(key==='loadMode')builderAdjust(builderPerson,builderSlot);return;}

    if(pendingExternal){toast('Recharge pour continuer.');return;}
    if(el.type==='number'&&!el.checkValidity()){el.reportValidity();return;}
    try{
      if(el.dataset.plan){const p=draft.items[Number(el.dataset.index)],key=el.dataset.plan;p[key]=['sets','reps','duration','load','rest'].includes(key)?Number(el.value):el.value;if(['block','loadMode'].includes(key))renderBuilder();return;}
      if(el.dataset.setField){const target=s.entries.find(x=>x.id===el.dataset.entry),row=target.rows.find(x=>x.id===el.dataset.row),key=el.dataset.setField;row[key]=key==='band'?el.value:(key==='effort'&&el.value===''?'':Number(el.value));await save();return;}
      switch(el.id){
        case 'profile-select':C.switchProfile(state,el.value);activeHistory=null;window.speechSynthesis?.cancel();restNotified=null;effortNotified=null;await save();closeModal();render();requestWakeLock();break;
        case 'builder-scope':{builderScope=el.value;const base=state.templates.find(t=>t.id===draft.id);draft=builderScope==='base'?C.clone(base):personalTemplate(base);renderBuilder();break;}
        case 'entry-block':entry.plan.block=el.value;await save();render();break;
        case 'my-equipment-filter':onlyMyEquipment=el.checked;$('#exercise-results').innerHTML=exerciseResults();break;
        case 'muscle-filter':filterMuscle=el.value;$('#exercise-results').innerHTML=exerciseResults();break;
        case 'equipment-filter':filterEquipment=el.value;$('#exercise-results').innerHTML=exerciseResults();break;
        case 'template-mode':draft.mode=el.value;renderBuilder();break;
        case 'template-rounds':draft.rounds=Number(el.value);renderBuilder();break;
        case 'guided-mode':s.guided=el.checked;await save();break;
        case 'entry-load-mode':entry.plan.loadMode=el.value;entry.rows.filter(r=>r.status==='pending').forEach(r=>r.loadMode=el.value);await save();render();if($('#participant-editor'))participantEditor(trainingPerson);break;
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
    const form=event.target;if(!['profile-form','profile-rename','template-form','finish-form','feedback-form','settings-form','import-form','custom-form'].includes(form.id))return;
    event.preventDefault();if(!form.reportValidity())return;if(pendingExternal){toast('Recharge les données avant de continuer.');return;}
    const fd=new FormData(form);
    try {
      switch(form.id){
        case 'profile-form':{const name=fd.get('name').trim();if(!name)return;const id=C.uid();state.profiles.push({id,name});state.profileData[id]=C.profileDefaults();C.switchProfile(state,id);activeHistory=null;await save();closeModal();render();toast('Profil créé : '+name);break;}
        case 'profile-rename':{const name=fd.get('name').trim();if(!name)return;person().name=name;await save();closeModal();render();break;}
        case 'template-form':{
          if(!draft.items.length){toast('Ajoute au moins un exercice.');return;}
          for(const input of $$('[data-plan]',form)){const p=draft.items[Number(input.dataset.index)],k=input.dataset.plan;if(!input.disabled)p[k]=['sets','reps','duration','load','rest'].includes(k)?Number(input.value):input.value;}
          draft.mode=$('#template-mode').value;draft.rounds=Number($('#template-rounds').value)||3;
          draft.name=$('#template-name').value.trim();if(!draft.name){toast('Donne un nom à la séance.');return;}
          draft.items=C.orderedItems(draft);const i=state.templates.findIndex(t=>t.id===draft.id);
          const version={items:C.clone(draft.items),mode:draft.mode,rounds:draft.rounds,blockOrder:C.clone(draft.blockOrder)};
          if(i>=0){const base=state.templates[i];base.name=draft.name;base.description=draft.description;if(builderScope==='base')Object.assign(base,version);else{base.variants||={};base.variants[state.currentProfileId]=version;}}
          else{const base=C.clone(draft);delete base.variants;base.variants={[state.currentProfileId]:version};state.templates.push(base);}await save();closeModal();navigate('templates');toast('Séance enregistrée.');draft=null;break;
        }
        case 'finish-form':{
          const s=active();s.note=fd.get('note').trim();C.finish(s);state.activeId=null;await save();wakeLock?.release();closeModal();activeHistory=null;navigate('history');toast('Séance enregistrée dans ton historique.');break;
        }
        case 'feedback-form':{
          const s=state.sessions.find(s=>s.id===feedbackDraft.sessionId),e=s.entries.find(e=>e.id===feedbackDraft.entryId),row=e.rows.find(r=>r.id===fd.get('rowId'));
          const f={...feedbackDraft,type:fd.get('type'),intensity:Number(fd.get('intensity')),timing:fd.get('timing'),phase:fd.get('phase'),rowId:row?.id||null,rowSnapshot:row?C.clone(row):null,expectedMuscle:fd.get('expectedMuscle'),feltInstead:fd.get('feltInstead'),note:fd.get('note').trim(),createdAt:Date.now(),outcome:null};
          f.advice=adviceFor(f,e);e.feedback.push(f);if(!await save())return;closeModal();render();toast('Commentaire enregistré pour '+participantName(s.profileId)+'. Repères disponibles dans Ajuster.');break;
        }
        case 'settings-form':Object.assign(trainingPrefs(),{sounds:fd.has('sounds'),wakeLock:fd.has('wakeLock')});state.preferences={...state.preferences,weeklyGoal:Number(fd.get('weeklyGoal')),sounds:fd.has('sounds'),wakeLock:fd.has('wakeLock'),equipment:fd.getAll('equipment')};if(!await save())return;closeModal();render();toast('Réglages enregistrés.');break;
        case 'import-form':{
          if(!importCandidate)return;
          downloadJSON({format:'renfo-backup',version:3,state},'renfo-avant-import-'+new Date().toISOString().slice(0,10)+'.json');
          if(fd.get('mode')==='replace'){state=importCandidate;}
          else state=C.mergeStates(state,importCandidate);
          if(!await save())return;importCandidate=null;closeModal();render();toast('Import terminé.');break;
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
    if(!restored||restored.schema<3)await save();
    if('BroadcastChannel' in window){channel=new BroadcastChannel('renfo-updates');channel.onmessage=event=>{if(event.data.updatedAt>state.updatedAt){pendingExternal=event.data;toast('Ton carnet a changé dans une autre fenêtre. Recharge pour continuer.');render();}};}
    initialized=true;route=location.hash.slice(1)||'home';render();setInterval(tick,500);
    if(RenfoStorage.error)toast(RenfoStorage.error);
    if('serviceWorker' in navigator&&location.protocol!=='file:'&&location.hostname!=='127.0.0.1'&&location.hostname!=='localhost')navigator.serviceWorker.register('sw.js').catch(()=>{});
  }catch(error){
    console.error(error);$('#app').innerHTML=`<main class="loading-screen"><h1>Ton carnet n’a pas pu s’ouvrir</h1><p>Les données existantes n’ont pas été effacées.</p><p>${esc(error.message)}</p><button class="btn primary" id="rescue-export">Exporter les données pour les récupérer</button></main>`;
    $('#rescue-export').onclick=async()=>{const stored=await RenfoStorage.open();downloadJSON({format:'renfo-backup',version:3,state:stored},'renfo-recuperation.json');};
  }
})();
