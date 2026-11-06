(function (root) {
  'use strict';
  const clone = v => JSON.parse(JSON.stringify(v));
  const uid = () => globalThis.crypto?.randomUUID?.() || 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const finite = (v, min = 0, max = 100000) => Number.isFinite(Number(v)) && Number(v) >= min && Number(v) <= max;
  const number = (v, fallback = 0) => finite(v) ? Number(v) : fallback;
  const family = e => ['echauffement', 'mobilisation', 'etirements'].includes(e.category) ? e.category : 'renforcement';
  function parameters(e) {
    const prep = family(e) !== 'renforcement';
    return {sets: prep ? 1 : 3, reps: e.default_reps || (prep ? 8 : 10), duration: e.default_duration || 30,
      load: 0, loadMode: e.load_input || 'none', band: '', rest: prep ? 15 : 60, tempo: '', block: family(e)};
  }
  function item(e, overrides = {}) { return {id: uid(), exerciseId: e.id, ...parameters(e), ...overrides}; }
  // A movement can also belong to the warmup library through a curated routine.
  function libraryExercises(catalog, routines, category) {
    const warmupIds = new Set(routines.filter(r => r.family === 'echauffement').flatMap(r => r.exerciseIds));
    return catalog.filter(e => category === 'all' || family(e) === category || category === 'echauffement' && warmupIds.has(e.id));
  }
  function itemForBlock(e, block = family(e), routines = [], overrides = {}) {
    const warmup = block === 'echauffement';
    const dose = warmup ? routines.filter(r => r.family === 'echauffement').flatMap(r => r.items || []).find(p => p.exerciseId === e.id) : null;
    return item(e, {...(warmup ? {sets:1,rest:10,...dose,load:0,loadMode:'none',band:''} : {}),id:uid(),block,...overrides});
  }
  const blocks = ['echauffement','renforcement','mobilisation','etirements'];
  const profileDefaults = () => ({favorites:[],exerciseNotes:{},activeId:null,preferences:{sounds:false,voice:false,wakeLock:true,equipment:[],weeklyGoal:3,visibility:'normal'}});
  function newState(templates = []) {
    const personal=profileDefaults();
    return {schema:3,revision:0,updatedAt:null,templates:clone(templates),sessions:[],workouts:[],activeWorkoutId:null,customExercises:[],lastExport:null,
      profiles:[{id:'martin',name:'Martin'},{id:'severine',name:'Séverine'}],currentProfileId:'martin',
      profileData:{martin:clone(personal),severine:profileDefaults()},...personal};
  }
  function captureProfile(s) {
    s.profileData[s.currentProfileId]=clone({favorites:s.favorites,exerciseNotes:s.exerciseNotes,activeId:s.activeId,preferences:s.preferences});
  }
  function switchProfile(s,id) {
    if(!s.profiles.some(p=>p.id===id))throw Error('Personne introuvable.');
    captureProfile(s);s.currentProfileId=id;Object.assign(s,clone(s.profileData[id]));
  }
  function migrate(input) {
    const s=clone(input);
    if(s.schema===1){
      s.schema=2;s.profiles=[{id:'martin',name:'Martin'},{id:'severine',name:'Séverine'}];s.currentProfileId='martin';
      s.preferences={...profileDefaults().preferences,...s.preferences};
      s.profileData={severine:profileDefaults()};captureProfile(s);
      s.sessions.forEach(x=>x.profileId='martin');
    }
    if(s.schema===2){
      // A legacy record is a real, independent workout. Never infer that two people trained together.
      s.workouts=s.sessions.map(session=>{
        const id='legacy-'+session.id;session.workoutId=id;
        return {id,name:session.name,templateId:session.templateId??null,status:session.status,
          participantIds:[session.profileId],sessionIds:{[session.profileId]:session.id},
          slots:session.entries.map((entry,i)=>({id:'slot-'+entry.id,block:entry.plan.block,entries:{[session.profileId]:entry.id}})),
          cursor:session.cursor??0,startedAt:session.startedAt,finishedAt:session.finishedAt??null};
      });
      const selected=s.sessions.find(x=>x.id===s.activeId&&x.status==='active')||s.sessions.find(x=>x.status==='active');
      s.activeWorkoutId=selected?.workoutId||null;s.schema=3;
      for(const t of s.templates){
        t.items.forEach((p,i)=>p.id||=(t.id+'-item-'+i));
        for(const v of Object.values(t.variants||{}))v.items.forEach((p,i)=>p.id||=(t.items[i]?.id||t.id+'-variant-'+i));
      }
      for(const session of s.sessions)for(const entry of session.entries)entry.plan.id||=entry.id;
    }
    return s;
  }
  function personalSessions(s,id=s.currentProfileId){return s.sessions.filter(x=>x.profileId===id);}
  function mergeStates(target,incoming){
    const a=validateBackup(target),b=validateBackup(incoming);captureProfile(a);captureProfile(b);
    for(const key of ['templates','customExercises','profiles']){const ids=new Set(a[key].map(x=>x.id));a[key].push(...b[key].filter(x=>!ids.has(x.id)));}
    const workoutIds=new Set(a.workouts.map(w=>w.id)),sessionIds=new Set(a.sessions.map(s=>s.id));
    for(const w of b.workouts){
      if(workoutIds.has(w.id))continue;
      const sessions=Object.values(w.sessionIds).map(id=>b.sessions.find(s=>s.id===id));
      if(sessions.some(s=>sessionIds.has(s.id)))throw Error('Une séance importée appartient déjà à un autre entraînement. Utilise une sauvegarde cohérente.');
      a.workouts.push(clone(w));a.sessions.push(...clone(sessions));workoutIds.add(w.id);sessions.forEach(s=>sessionIds.add(s.id));
    }
    for(const p of b.profiles){
      const source=b.profileData[p.id];if(!a.profileData[p.id])a.profileData[p.id]=clone(source);
      else{const dest=a.profileData[p.id];dest.favorites=[...new Set([...dest.favorites,...source.favorites])];dest.exerciseNotes={...source.exerciseNotes,...dest.exerciseNotes};
        if(!dest.activeId&&source.activeId&&a.sessions.some(s=>s.id===source.activeId&&s.profileId===p.id&&s.status==='active'))dest.activeId=source.activeId;}
    }
    if(!a.activeWorkoutId)a.activeWorkoutId=a.workouts.some(w=>w.id===b.activeWorkoutId&&w.status==='active')?b.activeWorkoutId:null;
    Object.assign(a,clone(a.profileData[a.currentProfileId]));syncActivePointers(a);return validateBackup(a);
  }
  function templateForProfile(t,id){return {...clone(t),...clone(t.variants?.[id]||{}),id:t.id,name:t.name,description:t.description};}
  function orderedItems(t){if(!t.blockOrder)return t.items;const order=[...new Set([...(t.blockOrder||blocks),...blocks])];return order.flatMap(b=>t.items.filter(p=>p.block===b));}
  function sideCount(e){return e.repetition_counting==='par_cote'||(e.repetition_counting==null&&['unilateral','alterne'].includes(e.laterality))?2:1;}
  function makeRows(e, p) {
    const sides = sideCount(e)===2 ? ['gauche', 'droite'] : ['ensemble'];
    return Array.from({length: Math.max(1, Math.min(20, number(p.sets, 3)))}, (_, i) => sides.map(side => ({
      id: uid(), number: i + 1, side, reps: number(p.reps, 10), duration: number(p.duration, 30),
      load: number(p.load), loadMode: p.loadMode || e.load_input || 'none', band: p.band || '',
      status: 'pending', effort: '', completedAt: null
    }))).flat();
  }
  function makeEntry(p, e, round = null) {
    return {id: uid(), exerciseId: e.id, definition: clone(e), plan: clone(p), round, rows: makeRows(e, p), note: '', feedback: []};
  }
  function createSession(template, catalog, now = Date.now()) {
    const entries = [];
    template={...template,items:orderedItems(template)};
    // Repeat consecutive strength blocks only. Warm-ups and stretches stay single.
    for (let i = 0; i < template.items.length;) {
      const p = template.items[i];
      if (template.mode === 'circuit' && p.block === 'renforcement') {
        const group = [];
        while (i < template.items.length && template.items[i].block === 'renforcement') group.push(template.items[i++]);
        for (let round = 1; round <= number(template.rounds, 3); round++) for (const q of group) {
          const e = catalog.find(x => x.id === q.exerciseId);
          if (e) entries.push(makeEntry({...q, sets: 1}, e, round));
        }
      } else {
        const e = catalog.find(x => x.id === p.exerciseId);
        if (e) entries.push(makeEntry(p, e));
        i++;
      }
    }
    return {id: uid(), profileId: template.profileId || 'martin', templateId: template.id, name: template.name, startedAt: now, finishedAt: null, status: 'active',
      pausedAt: null, pausedMs: 0, entries, cursor: 0, restUntil: null, restRemaining: null, effortUntil: null,
      effortRemaining: null, effortRowId: null, guided: true, note: '', undo: null};
  }
  function createWorkout(template,catalog,participantIds,now=Date.now()){
    if(!Array.isArray(participantIds))throw Error('Choisis au moins une personne.');
    const ids=[...new Set(participantIds)];if(!ids.length)throw Error('Choisis au moins une personne.');
    const source=clone(template),id=uid();
    source.items.forEach(p=>p.id||=uid());
    for(const v of Object.values(source.variants||{}))v.items.forEach((p,i)=>p.id||=(source.items[i]?.id||uid()));
    const sessions=ids.map(profileId=>({...createSession({...templateForProfile(source,profileId),profileId},catalog,now),workoutId:id}));
    const slots=[],byKey=new Map(),planOrder=new Map();
    orderedItems(source).forEach((p,i)=>planOrder.set(p.id,i));
    for(const session of sessions)for(const entry of session.entries){
      if(!planOrder.has(entry.plan.id))planOrder.set(entry.plan.id,planOrder.size);
      const key=JSON.stringify([entry.plan.block,entry.plan.id,entry.round]);
      let slot=byKey.get(key);
      if(!slot){slot={id:uid(),block:entry.plan.block,entries:{}};byKey.set(key,slot);slots.push({slot,planId:entry.plan.id,round:entry.round||0});}
      slot.entries[session.profileId]=entry.id;
    }
    const order=[...new Set([...(source.blockOrder||blocks),...blocks])];
    slots.sort((a,b)=>order.indexOf(a.slot.block)-order.indexOf(b.slot.block)||a.round-b.round||planOrder.get(a.planId)-planOrder.get(b.planId));
    return {workout:{id,name:source.name,templateId:source.id??null,status:'active',participantIds:ids,
      sessionIds:Object.fromEntries(sessions.map(s=>[s.profileId,s.id])),slots:slots.map(x=>x.slot),cursor:0,startedAt:now,finishedAt:null},sessions};
  }
  function getWorkout(state){return state.workouts.find(w=>w.id===state.activeWorkoutId&&w.status==='active')||null;}
  function workoutSession(state,w,pid){return w?state.sessions.find(s=>s.id===w.sessionIds[pid]&&s.profileId===pid&&s.workoutId===w.id)||null:null;}
  function syncActivePointers(state){
    const selected=getWorkout(state);
    for(const p of state.profiles){
      const personal=state.profileData[p.id],current=state.sessions.find(s=>s.id===personal.activeId&&s.profileId===p.id&&s.status==='active');
      personal.activeId=workoutSession(state,selected,p.id)?.id||current?.id||state.sessions.find(s=>s.profileId===p.id&&s.status==='active')?.id||null;
    }
    state.activeId=state.profileData[state.currentProfileId].activeId;
  }
  function addWorkout(state,template,catalog,ids,now=Date.now()){
    if(!Array.isArray(ids)||ids.some(id=>!state.profiles.some(p=>p.id===id)))throw Error('Personne introuvable.');
    captureProfile(state);const result=createWorkout(template,catalog,ids,now);
    state.workouts.unshift(result.workout);state.sessions.unshift(...result.sessions);state.activeWorkoutId=result.workout.id;
    syncActivePointers(state);return result.workout;
  }
  function finishWorkout(state,w,now=Date.now()){
    if(!w||w.status!=='active')return w;
    captureProfile(state);for(const pid of w.participantIds)finish(workoutSession(state,w,pid),now);
    w.status='completed';w.finishedAt=now;if(state.activeWorkoutId===w.id)state.activeWorkoutId=null;
    syncActivePointers(state);return w;
  }
  function pauseWorkout(state,w,now=Date.now()){
    if(w?.status==='active')for(const pid of w.participantIds)pause(workoutSession(state,w,pid),now);return w;
  }
  function resumeWorkout(state,w,now=Date.now()){
    if(w?.status==='active')for(const pid of w.participantIds)resume(workoutSession(state,w,pid),now);return w;
  }
  function elapsed(s, now = Date.now()) { return Math.max(0, (s.finishedAt ?? s.pausedAt ?? now) - s.startedAt - (s.pausedMs || 0)); }
  function pause(s, now = Date.now()) {
    if (s.pausedAt != null || s.status !== 'active') return;
    s.pausedAt = now;
    for (const key of ['rest', 'effort']) if (s[key + 'Until'] != null) {
      s[key + 'Remaining'] = Math.max(0, s[key + 'Until'] - now); s[key + 'Until'] = null;
    }
  }
  function resume(s, now = Date.now()) {
    if (s.pausedAt == null || s.status !== 'active') return;
    s.pausedMs += now - s.pausedAt; s.pausedAt = null;
    for (const key of ['rest', 'effort']) if (s[key + 'Remaining'] != null) {
      s[key + 'Until'] = now + s[key + 'Remaining']; s[key + 'Remaining'] = null;
    }
  }
  function finish(s, now = Date.now()) {
    if(s.status==='completed')return;
    if (s.pausedAt != null) { s.pausedMs += now - s.pausedAt; s.pausedAt = null; }
    s.finishedAt = now; s.status = 'completed'; s.restUntil = null; s.effortUntil = null; s.restRemaining=null;s.effortRemaining=null;s.effortRowId=null;s.undo = null;
  }
  function complete(s, entryId, rowId, status = 'done', now = Date.now()) {
    if (s.pausedAt != null) throw new Error('Reprends la séance avant de valider une série.');
    const entry = s.entries.find(x => x.id === entryId), row = entry?.rows.find(x => x.id === rowId);
    if (!row) throw new Error('Série introuvable.');
    s.undo = {entryId, rowId, previous: clone(row)};
    row.status = status; row.completedAt = now;
    if (s.status === 'active' && status === 'done' && s.guided && number(entry.plan.rest) > 0) s.restUntil = now + entry.plan.rest * 1000;
    s.effortUntil = null; s.effortRemaining = null; s.effortRowId = null;
    return row;
  }
  function undo(s) {
    if (!s.undo) return;
    const e = s.entries.find(x => x.id === s.undo.entryId), i = e?.rows.findIndex(x => x.id === s.undo.rowId);
    if (e && i >= 0) e.rows[i] = s.undo.previous;
    s.undo = null; s.restUntil = null;
  }
  function totals(sessions, role = 'all') {
    const muscles = {}, ids = new Set(); let done = 0, durationMs = 0, volume = 0;
    for (const s of sessions) {
      durationMs += elapsed(s);
      for (const e of s.entries) {
        const rows = e.rows.filter(r => r.status === 'done'); done += rows.length;
        if (rows.length) ids.add(e.exerciseId);
        if (e.plan.block !== 'renforcement') continue;
        for (const r of rows) {
          if (e.definition.execution_mode === 'repetitions' && !['none', 'band'].includes(r.loadMode))
            volume += number(r.reps) * number(r.load) * (r.loadMode === 'per_dumbbell' ? 2 : 1);
        }
        for (const [key, group] of Object.entries(e.definition.muscle_roles || {})) {
          if (role !== 'all' && key !== role) continue;
          for (const m of group) {
            if (!muscles[m]) muscles[m] = {primary: 0, assistance: 0, stabilization: 0, exercises: new Set()};
            muscles[m][key] += rows.length;
            if (rows.length) muscles[m].exercises.add(e.exerciseId);
          }
        }
      }
    }
    for (const k of Object.keys(muscles)) if (!muscles[k].exercises.size) delete muscles[k];
    return {muscles, done, durationMs, volume, exercises: ids.size};
  }
  function lastPerformance(sessions, exerciseId, excludeId) {
    for (const s of [...sessions].sort((a,b) => b.startedAt - a.startedAt)) {
      if (s.id === excludeId || s.status !== 'completed') continue;
      for (const e of s.entries) if (e.exerciseId === exerciseId) {
        const row = [...e.rows].reverse().find(x => x.status === 'done');
        if (row) return {row, definition: e.definition, date: s.startedAt};
      }
    }
    return null;
  }
  function estimate(template, catalog) {
    let seconds = 0;
    for (const p of template.items) {
      const e = catalog.find(x => x.id === p.exerciseId); if (!e) continue;
      const sides = sideCount(e);
      const sets = template.mode === 'circuit' && p.block === 'renforcement' ? number(template.rounds, 3) : number(p.sets, 3);
      seconds += sets * sides * ((e.execution_mode === 'duree' ? number(p.duration, 30) : number(p.reps, 10) * 4) + number(p.rest, 60));
    }
    return Math.max(1, Math.ceil(seconds / 60));
  }
  function validateBackup(input) {
    const raw=input?.format==='renfo-backup'?input.state:input;
    if(!raw||![1,2,3].includes(raw.schema))throw Error('Sauvegarde Renfo non reconnue.');
    const s=migrate(raw);
    if(!Array.isArray(s.templates)||!Array.isArray(s.sessions)||!Array.isArray(s.workouts))throw Error('Sauvegarde Renfo non reconnue (versions acceptées : 1, 2 ou 3).');
    if(s.sessions.length>10000||s.workouts.length>10000||s.templates.length>1000)throw Error('Sauvegarde trop volumineuse.');
    const text=(v,max=10000)=>typeof v==='string'&&v.length<=max;
    const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,219}$/.test(v)&&!['constructor','prototype'].includes(v);
    const num=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
    const integer=(v,min=0,max=Number.MAX_SAFE_INTEGER)=>num(v,min,max)&&Number.isInteger(v);
    const timestamp=v=>integer(v,0,8640000000000000);
    const optionalTime=v=>v==null||timestamp(v);
    const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
    const list=v=>Array.isArray(v)&&v.length<=200&&v.every(x=>text(x));
    const unique=v=>new Set(v).size===v.length;
    const order=v=>v===undefined||(Array.isArray(v)&&v.length===4&&unique(v)&&v.every(b=>blocks.includes(b)));
    const definition=e=>e&&id(e.id)&&text(e.name,300)&&list(e.steps)&&list(e.equipment)&&list(e.key_cues)&&list(e.common_mistakes)&&list(e.source_ids)
      &&record(e.muscle_roles)&&Object.keys(e.muscle_roles).every(k=>['primary','assistance','stabilization'].includes(k))
      &&['primary','assistance','stabilization'].every(k=>list(e.muscle_roles[k]))
      &&['repetitions','duree'].includes(e.execution_mode)&&['bilateral','unilateral','alterne'].includes(e.laterality);
    const loadModes=['none','single_dumbbell','per_dumbbell','external_total','band'];
    const plan=p=>p&&id(p.id)&&id(p.exerciseId)&&integer(p.sets,1,20)&&num(p.reps,0,10000)&&num(p.duration,0,86400)
      &&num(p.load,0,2000)&&num(p.rest,0,3600)&&blocks.includes(p.block)&&loadModes.includes(p.loadMode);
    const notes=v=>record(v)&&Object.entries(v).every(([key,value])=>id(key)&&text(value));
    const preferences=v=>record(v)&&Array.isArray(v.equipment)&&v.equipment.every(x=>text(x,100))
      &&['sounds','voice','wakeLock'].every(k=>v[k]===undefined||typeof v[k]==='boolean')
      &&(v.weeklyGoal===undefined||integer(v.weeklyGoal,0,100))&&(v.visibility===undefined||['normal','active'].includes(v.visibility));
    const personal=d=>record(d)&&Array.isArray(d.favorites)&&d.favorites.every(id)&&notes(d.exerciseNotes)&&preferences(d.preferences);
    const row=r=>record(r)&&id(r.id)&&integer(r.number,1,10000)&&['ensemble','gauche','droite'].includes(r.side)&&['pending','done','skipped'].includes(r.status)
      &&num(r.reps,0,10000)&&num(r.duration,0,86400)&&num(r.load,0,2000)&&loadModes.includes(r.loadMode)&&text(r.band||'',100)
      &&(r.effort===''||r.effort==null||num(r.effort,0,10))&&optionalTime(r.completedAt);
    if(!integer(s.revision??0)||!optionalTime(s.updatedAt)||!optionalTime(s.lastExport))throw Error('Métadonnées du carnet invalides.');
    if(!Array.isArray(s.profiles)||!s.profiles.length||s.profiles.length>100||s.profiles.some(p=>!id(p.id)||!text(p.name,80))||!unique(s.profiles.map(p=>p.id))||!s.profiles.some(p=>p.id===s.currentProfileId))throw Error('Profils invalides.');
    const profileIds=new Set(s.profiles.map(p=>p.id));
    if(!record(s.profileData)||s.profiles.some(p=>!personal(s.profileData[p.id]))||!personal(s))throw Error('Réglages personnels invalides.');
    if(!Array.isArray(s.customExercises)||s.customExercises.length>1000||!s.customExercises.every(definition)||!unique(s.customExercises.map(e=>e.id)))throw Error('Exercices personnels invalides.');
    if(!unique(s.templates.map(t=>t.id)))throw Error('Identifiants de modèles dupliqués.');
    for(const t of s.templates){
      const checkItems=items=>Array.isArray(items)&&items.length<=300&&items.every(plan)&&unique(items.map(p=>p.id));
      if(!id(t.id)||!text(t.name,300)||!checkItems(t.items)||!order(t.blockOrder)||!['classic','circuit',undefined].includes(t.mode)||(t.mode==='circuit'&&!integer(t.rounds,1,12)))throw Error('Modèle de séance invalide.');
      if(t.variants!==undefined&&!record(t.variants))throw Error('Versions personnelles invalides.');
      for(const [pid,v] of Object.entries(t.variants||{}))if(!profileIds.has(pid)||!record(v)||!checkItems(v.items)||!order(v.blockOrder)||!['classic','circuit'].includes(v.mode)||(v.mode==='circuit'&&!integer(v.rounds,1,12)))throw Error('Version personnelle invalide.');
    }
    const sessionMap=new Map();
    for(const session of s.sessions){
      if(!id(session.id)||sessionMap.has(session.id)||!profileIds.has(session.profileId)||!id(session.workoutId)||!text(session.name,300)||!['active','completed'].includes(session.status)||!Array.isArray(session.entries)||session.entries.length>1000)throw Error('Séance invalide dans la sauvegarde.');
      sessionMap.set(session.id,session);
      if(!timestamp(session.startedAt)||!optionalTime(session.finishedAt)||!optionalTime(session.pausedAt)||!num(session.pausedMs??0)
        ||(session.finishedAt!=null&&session.finishedAt<session.startedAt)||(session.pausedAt!=null&&session.pausedAt<session.startedAt)
        ||(session.status==='active'&&session.finishedAt!=null)||(session.status==='completed'&&session.finishedAt==null)
        ||!integer(session.cursor,0,Math.max(0,session.entries.length-1)))throw Error('Durée ou position de séance invalide.');
      if(session.finishedAt!=null&&(session.pausedAt!=null||session.pausedMs>session.finishedAt-session.startedAt))throw Error('Pause de séance invalide.');
      for(const timer of ['rest','effort'])if(!optionalTime(session[timer+'Until'])||(session[timer+'Remaining']!=null&&!num(session[timer+'Remaining']))||(session.pausedAt!=null&&session[timer+'Until']!=null))throw Error('Minuteur invalide.');
      const entryIds=new Set(),rowIds=new Set();
      for(const e of session.entries){
        if(!id(e.id)||entryIds.has(e.id)||!id(e.exerciseId)||!definition(e.definition)||e.exerciseId!==e.definition.id||!plan(e.plan)||e.plan.exerciseId!==e.exerciseId||!Array.isArray(e.rows)||e.rows.length>1000||(e.round!=null&&!integer(e.round,1,12))||!text(e.note||'',10000))throw Error('Exercice invalide dans une séance.');
        entryIds.add(e.id);
        for(const r of e.rows){
          if(!row(r)||rowIds.has(r.id))throw Error('Valeurs de série invalides.');
          rowIds.add(r.id);
        }
        if(e.feedback!==undefined&&!Array.isArray(e.feedback))throw Error('Retour corporel invalide.');
        for(const f of e.feedback||[])if((f.id&&!id(f.id))||!Array.isArray(f.points)||!text(f.type,100)||!text(f.note||'',10000)||!optionalTime(f.createdAt)||f.points.some(p=>!num(p.x,0,1)||!num(p.y,0,1)||!['front','back'].includes(p.view)))throw Error('Retour corporel invalide.');
      }
      if((session.effortRowId!=null&&!rowIds.has(session.effortRowId))||((session.effortUntil!=null||session.effortRemaining!=null)&&session.effortRowId==null))throw Error('Série du minuteur introuvable.');
      if(session.undo!=null&&(!record(session.undo)||!row(session.undo.previous)||session.undo.previous.id!==session.undo.rowId||!session.entries.find(e=>e.id===session.undo.entryId)?.rows.some(r=>r.id===session.undo.rowId)))throw Error('Dernière validation introuvable.');
    }
    const workoutIds=new Set(),linkedSessions=new Set();
    for(const w of s.workouts){
      if(!id(w.id)||workoutIds.has(w.id)||!text(w.name,300)||!['active','completed'].includes(w.status)||!Array.isArray(w.participantIds)||!w.participantIds.length||!unique(w.participantIds)||w.participantIds.some(pid=>!profileIds.has(pid))||!record(w.sessionIds)
        ||Object.keys(w.sessionIds).length!==w.participantIds.length||Object.keys(w.sessionIds).some(pid=>!w.participantIds.includes(pid))||!Array.isArray(w.slots)||w.slots.length>10000||!integer(w.cursor,0,Math.max(0,w.slots.length-1))
        ||!timestamp(w.startedAt)||!optionalTime(w.finishedAt)||(w.status==='active'&&w.finishedAt!=null)||(w.status==='completed'&&(w.finishedAt==null||w.finishedAt<w.startedAt)))throw Error('Entraînement commun invalide.');
      workoutIds.add(w.id);
      for(const pid of w.participantIds){
        const session=sessionMap.get(w.sessionIds[pid]);
        if(!session||linkedSessions.has(session.id)||session.profileId!==pid||session.workoutId!==w.id||session.status!==w.status)throw Error('Lien entre personne et séance invalide.');
        linkedSessions.add(session.id);
      }
      const slotIds=new Set(),linkedEntries=new Set();
      for(const slot of w.slots){
        if(!id(slot.id)||slotIds.has(slot.id)||!blocks.includes(slot.block)||!record(slot.entries)||!Object.keys(slot.entries).length)throw Error('Étape commune invalide.');
        slotIds.add(slot.id);
        for(const [pid,entryId] of Object.entries(slot.entries)){
          const entry=w.participantIds.includes(pid)&&sessionMap.get(w.sessionIds[pid]).entries.find(e=>e.id===entryId),key=pid+'|'+entryId;
          if(!entry||entry.plan.block!==slot.block||linkedEntries.has(key))throw Error('Exercice de l’étape introuvable.');
          linkedEntries.add(key);
        }
      }
    }
    if(linkedSessions.size!==s.sessions.length)throw Error('Une séance ne possède pas son entraînement.');
    if(s.activeWorkoutId!=null&&!s.workouts.some(w=>w.id===s.activeWorkoutId&&w.status==='active'))throw Error('Entraînement en cours introuvable.');
    for(const p of s.profiles){const activeId=s.profileData[p.id].activeId;if(activeId!=null&&!s.sessions.some(x=>x.id===activeId&&x.status==='active'&&x.profileId===p.id))throw Error('Séance du profil introuvable.');}
    if(s.activeId!=null&&!s.sessions.some(x=>x.id===s.activeId&&x.status==='active'&&x.profileId===s.currentProfileId))throw Error('La séance en cours est introuvable.');
    const result=Object.assign(newState(),s);captureProfile(result);return result;
  }
  const api = {libraryExercises,itemForBlock,createWorkout,addWorkout,getWorkout,workoutSession,finishWorkout,pauseWorkout,resumeWorkout,syncActivePointers,mergeStates,sideCount,blocks,profileDefaults,captureProfile,switchProfile,migrate,personalSessions,templateForProfile,orderedItems,clone, uid, number, finite, family, parameters, item, newState, makeRows, makeEntry, createSession, elapsed, pause, resume, finish, complete, undo, totals, lastPerformance, estimate, validateBackup};
  root.RenfoCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
