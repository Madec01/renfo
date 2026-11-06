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
  const blocks = ['echauffement','renforcement','mobilisation','etirements'];
  const profileDefaults = () => ({favorites:[],exerciseNotes:{},activeId:null,preferences:{sounds:false,voice:false,wakeLock:true,equipment:[],weeklyGoal:3,visibility:'normal'}});
  function newState(templates = []) {
    const personal=profileDefaults();
    return {schema:2,revision:0,updatedAt:null,templates:clone(templates),sessions:[],customExercises:[],lastExport:null,
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
    return s;
  }
  function personalSessions(s,id=s.currentProfileId){return s.sessions.filter(x=>x.profileId===id);}
  function mergeStates(target,incoming){
    const a=clone(target),b=clone(incoming);captureProfile(a);captureProfile(b);
    for(const key of ['templates','sessions','customExercises','profiles']){const ids=new Set(a[key].map(x=>x.id));a[key].push(...b[key].filter(x=>!ids.has(x.id)));}
    for(const p of b.profiles){
      const source=b.profileData[p.id];if(!a.profileData[p.id])a.profileData[p.id]=clone(source);
      else{const dest=a.profileData[p.id];dest.favorites=[...new Set([...dest.favorites,...source.favorites])];dest.exerciseNotes={...source.exerciseNotes,...dest.exerciseNotes};
        if(!dest.activeId&&source.activeId&&a.sessions.some(s=>s.id===source.activeId&&s.profileId===p.id&&s.status==='active'))dest.activeId=source.activeId;}
    }
    Object.assign(a,clone(a.profileData[a.currentProfileId]));return validateBackup(a);
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
  function elapsed(s, now = Date.now()) { return Math.max(0, (s.finishedAt || s.pausedAt || now) - s.startedAt - (s.pausedMs || 0)); }
  function pause(s, now = Date.now()) {
    if (s.pausedAt || s.status !== 'active') return;
    s.pausedAt = now;
    for (const key of ['rest', 'effort']) if (s[key + 'Until']) {
      s[key + 'Remaining'] = Math.max(0, s[key + 'Until'] - now); s[key + 'Until'] = null;
    }
  }
  function resume(s, now = Date.now()) {
    if (!s.pausedAt || s.status !== 'active') return;
    s.pausedMs += now - s.pausedAt; s.pausedAt = null;
    for (const key of ['rest', 'effort']) if (s[key + 'Remaining'] != null) {
      s[key + 'Until'] = now + s[key + 'Remaining']; s[key + 'Remaining'] = null;
    }
  }
  function finish(s, now = Date.now()) {
    if (s.pausedAt) { s.pausedMs += now - s.pausedAt; s.pausedAt = null; }
    s.finishedAt = now; s.status = 'completed'; s.restUntil = null; s.effortUntil = null; s.undo = null;
  }
  function complete(s, entryId, rowId, status = 'done', now = Date.now()) {
    if (s.pausedAt) throw new Error('Reprends la séance avant de valider une série.');
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
    const raw = input?.format === 'renfo-backup' ? input.state : input;
    if(!raw || ![1,2].includes(raw.schema))throw new Error('Sauvegarde Renfo non reconnue.');
    const s = migrate(raw);
    if (!s || s.schema !== 2 || !Array.isArray(s.templates) || !Array.isArray(s.sessions)) throw new Error('Sauvegarde Renfo non reconnue (versions acceptées : 1 ou 2).');
    if (s.sessions.length > 10000 || s.templates.length > 1000) throw new Error('Sauvegarde trop volumineuse.');
    const checkText = (v,max=10000) => typeof v === 'string' && v.length <= max;
    const checkId = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,150}$/.test(v);
    const textList = v => Array.isArray(v) && v.length <= 200 && v.every(x=>checkText(x));
    const checkDefinition = e => e && checkId(e.id) && checkText(e.name,300) && textList(e.steps) && textList(e.equipment)
      && textList(e.key_cues) && textList(e.common_mistakes) && textList(e.source_ids)
      && e.muscle_roles && ['primary','assistance','stabilization'].every(k=>textList(e.muscle_roles[k]))
      && ['repetitions','duree'].includes(e.execution_mode) && ['bilateral','unilateral','alterne'].includes(e.laterality);
    const checkPlan = p => p && checkId(p.exerciseId) && finite(p.sets,1,20) && finite(p.reps,0,10000) && finite(p.duration,0,86400)
      && finite(p.load,0,2000) && finite(p.rest,0,3600) && ['renforcement','echauffement','mobilisation','etirements'].includes(p.block)
      && ['none','single_dumbbell','per_dumbbell','external_total','band'].includes(p.loadMode);
    if(!Array.isArray(s.profiles)||!s.profiles.length||s.profiles.length>100||s.profiles.some(p=>!checkId(p.id)||!checkText(p.name,80))||new Set(s.profiles.map(p=>p.id)).size!==s.profiles.length||!s.profiles.some(p=>p.id===s.currentProfileId))throw Error('Profils invalides.');
    if(!s.profileData||typeof s.profileData!=='object')throw Error('Carnets personnels invalides.');
    for(const p of s.profiles){const d=s.profileData[p.id];if(!d||!Array.isArray(d.favorites)||!d.favorites.every(checkId)||!d.exerciseNotes||!d.preferences||!Array.isArray(d.preferences.equipment))throw Error('Réglages personnels invalides.');if(d.activeId&&!s.sessions.some(x=>x.id===d.activeId&&x.status==='active'&&x.profileId===p.id))throw Error('Séance du profil introuvable.');}
    for(const t of s.templates){if(t.blockOrder&&(!Array.isArray(t.blockOrder)||t.blockOrder.length!==4||new Set(t.blockOrder).size!==4||t.blockOrder.some(b=>!blocks.includes(b))))throw Error('Ordre des blocs invalide.');for(const [id,v] of Object.entries(t.variants||{})){if(!s.profiles.some(p=>p.id===id)||!Array.isArray(v.items)||v.items.length>300||v.items.some(p=>!checkPlan(p))||!['classic','circuit'].includes(v.mode)||(v.mode==='circuit'&&!finite(v.rounds,1,12)))throw Error('Version personnelle invalide.');}}
    const validIDs = new Set();
    for (const session of s.sessions) {
      if (!s.profiles.some(p=>p.id===session.profileId) || !checkId(session.id) || validIDs.has(session.id) || !checkText(session.name,300) || !finite(session.startedAt, 0, Number.MAX_SAFE_INTEGER) || !['active','completed'].includes(session.status) || !Array.isArray(session.entries) || session.entries.length > 1000) throw new Error('Séance invalide dans la sauvegarde.');
      validIDs.add(session.id);
      if (!finite(session.pausedMs || 0, 0, Number.MAX_SAFE_INTEGER) || !finite(session.startedAt, 0, Number.MAX_SAFE_INTEGER)) throw new Error('Durée de séance invalide.');
      for (const e of session.entries) {
        if (!checkId(e.id) || !checkId(e.exerciseId) || !checkDefinition(e.definition) || !Array.isArray(e.rows) || !checkPlan(e.plan) || e.rows.length > 1000) throw new Error('Exercice invalide dans une séance.');
        for (const r of e.rows) if (!checkId(r.id) || !['pending','done','skipped'].includes(r.status) || !finite(r.reps,0,10000) || !finite(r.duration,0,86400) || !finite(r.load,0,2000) || !['none','single_dumbbell','per_dumbbell','external_total','band'].includes(r.loadMode)) throw new Error('Valeurs de série invalides.');
        for (const f of e.feedback || []) if ((f.id && !checkId(f.id)) || !Array.isArray(f.points) || !checkText(f.type,100) || !checkText(f.note || '',10000) || f.points.some(p => !finite(p.x,0,1) || !finite(p.y,0,1) || !['front','back'].includes(p.view))) throw new Error('Retour corporel invalide.');
      }
    }
    for (const t of s.templates) if (!checkId(t.id) || !checkText(t.name,300) || !Array.isArray(t.items) || t.items.length > 300 || t.items.some(p => !checkPlan(p)) || !['classic','circuit',undefined].includes(t.mode) || (t.mode==='circuit'&&!finite(t.rounds,1,12))) throw new Error('Modèle de séance invalide.');
    if (s.activeId && !s.sessions.some(x => x.id === s.activeId && x.status === 'active' && x.profileId === s.currentProfileId)) throw new Error('La séance en cours est introuvable.');
    const result = Object.assign(newState(), clone(s));
    if (!Array.isArray(result.favorites) || !result.favorites.every(checkId) || !Array.isArray(result.customExercises) || !result.customExercises.every(checkDefinition) || typeof result.exerciseNotes !== 'object' || !result.preferences || !Array.isArray(result.preferences.equipment)) throw new Error('Préférences invalides.');
    captureProfile(result);
    return result;
  }
  const api = {mergeStates,sideCount,blocks,profileDefaults,captureProfile,switchProfile,migrate,personalSessions,templateForProfile,orderedItems,clone, uid, number, finite, family, parameters, item, newState, makeRows, makeEntry, createSession, elapsed, pause, resume, finish, complete, undo, totals, lastPerformance, estimate, validateBackup};
  root.RenfoCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
