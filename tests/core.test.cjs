const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../dist/js/core.js');
// Existing fixtures exercise compatibility with actual version-2 exports.
const legacyState=(templates=[])=>{const s=C.newState(templates);s.schema=2;delete s.workouts;delete s.activeWorkoutId;return s;};
const strength=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/strength.json')));
const prep=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/preparation.json')));
const ex=id=>[...strength.exercises,...prep.exercises].find(e=>e.id===id);
const template=(ids,extra={})=>({id:'test',name:'Test',items:ids.map(id=>C.item(ex(id))),...extra});
const start=Date.UTC(2026,10,6,10,0,0);
test('actual series, skipped series and preparation contribute correctly',()=>{
 const t=template(['squat-goblet','prep-marche']);const s=C.createSession(t,[ex('squat-goblet'),ex('prep-marche')],start);
 s.entries[0].rows[0].load=8;s.entries[0].rows[0].reps=10;
 C.complete(s,s.entries[0].id,s.entries[0].rows[0].id,'done',start+10000);
 C.complete(s,s.entries[0].id,s.entries[0].rows[1].id,'skipped',start+15000);
 C.complete(s,s.entries[1].id,s.entries[1].rows[0].id,'done',start+20000);
 C.finish(s,start+30000);const result=C.totals([s]);
 assert.equal(result.done,2);assert.equal(result.volume,80);assert.equal(result.muscles.quadriceps.primary,1);assert.equal(result.durationMs,30000);
});
test('plan and definitions are immutable snapshots in historical sessions',()=>{
 const definition=C.clone(ex('squat-goblet')),t=template(['squat-goblet']);const s=C.createSession(t,[definition],start);
 t.items[0].load=100;definition.name='Changed';definition.muscle_roles.primary=[];
 assert.equal(s.entries[0].plan.load,0);assert.notEqual(s.entries[0].definition.name,'Changed');assert.ok(s.entries[0].definition.muscle_roles.primary.length);
});
test('pause, reload and resume preserve elapsed time and rest remaining',()=>{
 const s=C.createSession(template(['squat-goblet']),[ex('squat-goblet')],start);
 s.restUntil=start+90000;C.pause(s,start+30000);assert.equal(s.restRemaining,60000);assert.equal(C.elapsed(s,start+300000),30000);
 const restored=C.clone(s);C.resume(restored,start+300000);assert.equal(restored.restUntil,start+360000);assert.equal(C.elapsed(restored,start+315000),45000);
 C.pause(restored,start+320000);C.finish(restored,start+400000);assert.equal(C.elapsed(restored,start+999999),50000);
});
test('unilateral sets and two dumbbells have distinct conventions',()=>{
 const s=C.createSession(template(['rowing-unilateral','mollets-debout']),[ex('rowing-unilateral'),ex('mollets-debout')],start);
 assert.equal(s.entries[0].rows.length,6);assert.deepEqual(s.entries[0].rows.slice(0,2).map(r=>r.side),['gauche','droite']);
 const calf=s.entries[1];calf.rows[0].load=4;calf.rows[0].reps=12;C.complete(s,calf.id,calf.rows[0].id);assert.equal(C.totals([s]).volume,96);
});
test('circuits repeat only the strength block, not warm-up or stretches',()=>{
 const t=template(['prep-marche','squat-goblet','pompes','stretch-quadriceps'],{mode:'circuit',rounds:3});
 const s=C.createSession(t,[...strength.exercises,...prep.exercises],start);
 assert.equal(s.entries.length,8);assert.equal(s.entries.filter(e=>e.exerciseId==='prep-marche').length,1);assert.equal(s.entries.filter(e=>e.exerciseId==='squat-goblet').length,3);assert.equal(s.entries[1].rows.length,1);assert.equal(s.entries.at(-1).exerciseId,'stretch-quadriceps');
});
test('undo reverts completion and completed timestamp',()=>{
 const s=C.createSession(template(['squat-goblet']),[ex('squat-goblet')],start),e=s.entries[0],row=e.rows[0];
 C.complete(s,e.id,row.id);assert.equal(row.status,'done');C.undo(s);assert.equal(e.rows[0].status,'pending');assert.equal(e.rows[0].completedAt,null);assert.equal(s.restUntil,null);
});
test('backup round trip keeps body coordinates, loads and active state',()=>{
 const state=legacyState([template(['squat-goblet'])]);const s=C.createSession(state.templates[0],strength.exercises,start);state.sessions=[s];state.activeId=s.id;
 s.entries[0].feedback.push({type:'pain',points:[{x:.3,y:.4,view:'front',region:'Épaule',side:'droite'}],note:'Exemple de test'});
 const restored=C.validateBackup(JSON.parse(JSON.stringify({format:'renfo-backup',version:1,state})));
 assert.equal(restored.activeId,s.id);assert.equal(restored.sessions[0].entries[0].feedback[0].points[0].side,'droite');
});
test('backup validation rejects invalid values and missing active session',()=>{
 const state=legacyState();state.activeId='missing';assert.throws(()=>C.validateBackup(state));
 const s=C.createSession(template(['squat-goblet']),strength.exercises,start);state.activeId=s.id;state.sessions=[s];s.entries[0].rows[0].load=-5;assert.throws(()=>C.validateBackup(state));
});
test('all exercise IDs, muscle references and routines can be resolved',()=>{
 const exercises=[...strength.exercises,...prep.exercises];assert.equal(exercises.length,76);assert.equal(new Set(exercises.map(e=>e.id)).size,76);
 for(const e of exercises){assert.ok(e.steps.length>=4,e.id);for(const m of Object.values(e.muscle_roles).flat())assert.ok(strength.muscles[m],m);}
});
test('v1 migration assigns old records to Martin without altering series or timers',()=>{
 const old=legacyState([template(['squat-goblet'])]);const session=C.createSession(old.templates[0],strength.exercises,start);
 session.entries[0].rows[0].load=8;session.restUntil=start+60000;delete session.profileId;
 old.schema=1;old.sessions=[session];old.activeId=session.id;old.exerciseNotes={'squat-goblet':'Repère historique'};old.favorites=['squat-goblet'];
 delete old.profileData;delete old.profiles;delete old.currentProfileId;
 const migrated=C.validateBackup(old);assert.equal(migrated.schema,3);assert.equal(migrated.sessions[0].profileId,'martin');
 assert.equal(migrated.sessions[0].restUntil,start+60000);assert.equal(migrated.sessions[0].entries[0].rows[0].load,8);
 assert.deepEqual(C.validateBackup(migrated),migrated);assert.equal(migrated.profileData.martin.activeId,session.id);
 C.switchProfile(migrated,'severine');assert.equal(migrated.activeId,null);assert.deepEqual(migrated.favorites,[]);assert.deepEqual(migrated.exerciseNotes,{});
 C.switchProfile(migrated,'martin');assert.equal(migrated.exerciseNotes['squat-goblet'],'Repère historique');assert.equal(migrated.activeId,session.id);
});
test('different people retain independent active sessions, completed volume and preferences',()=>{
 const state=legacyState([template(['squat-goblet'])]);const martin=C.createSession({...state.templates[0],profileId:'martin'},strength.exercises,start);
 state.sessions.push(martin);state.activeId=martin.id;state.preferences.visibility='active';C.switchProfile(state,'severine');
 assert.equal(state.preferences.visibility,'normal');const sev=C.createSession({...state.templates[0],profileId:'severine'},strength.exercises,start+1000);state.sessions.push(sev);state.activeId=sev.id;
 sev.entries[0].rows[0].load=4;C.complete(sev,sev.entries[0].id,sev.entries[0].rows[0].id);C.finish(sev,start+30000);state.activeId=null;
 assert.equal(C.totals(C.personalSessions(state)).volume,40);assert.equal(C.totals(C.personalSessions(state,'martin')).done,0);
 C.switchProfile(state,'martin');assert.equal(state.activeId,martin.id);assert.equal(state.preferences.visibility,'active');assert.doesNotThrow(()=>C.validateBackup(state));
});
test('personal template variations allow different movements and charges without changing the common plan',()=>{
 const t=template(['squat-goblet']);t.items[0].load=8;t.variants={severine:{mode:'classic',rounds:1,items:[C.item(ex('squat-poids-corps'),{sets:2})],blockOrder:[...C.blocks]}};
 const sev=C.templateForProfile(t,'severine');assert.equal(sev.items[0].exerciseId,'squat-poids-corps');assert.equal(sev.items[0].sets,2);
 sev.items[0].sets=5;assert.equal(t.variants.severine.items[0].sets,2);assert.equal(C.templateForProfile(t,'martin').items[0].load,8);
});
test('each phase can be reordered and a circuit only repeats its strength work',()=>{
 const t=template(['squat-goblet','prep-marche','stretch-quadriceps','mob-chat-vache'],{mode:'circuit',rounds:2,blockOrder:['mobilisation','echauffement','renforcement','etirements']});
 const s=C.createSession(t,[...strength.exercises,...prep.exercises],start);
 assert.deepEqual(s.entries.map(e=>e.plan.block),['mobilisation','echauffement','renforcement','renforcement','etirements']);
});
test('backup rejects a profile pointing at another person’s active workout',()=>{
 const state=legacyState([template(['squat-goblet'])]);const s=C.createSession(state.templates[0],strength.exercises,start);state.sessions.push(s);state.profileData.severine.activeId=s.id;
 assert.throws(()=>C.validateBackup(state));
});
test('alternating warm-ups use a single total timer; paired mobility counts pairs, side-based work stays separate',()=>{
 const t=template(['prep-marche','mob-hanches-90-90','stretch-quadriceps','deadbug']);const s=C.createSession(t,[...strength.exercises,...prep.exercises],start);
 assert.equal(s.entries[0].rows.length,1);assert.equal(s.entries[0].rows[0].side,'ensemble');
 assert.equal(s.entries[1].rows.length,1);assert.equal(s.entries[2].rows.length,2);assert.equal(s.entries[3].rows.length,6);
});
test('merging profiles restores imported active workouts and preserves local notes and settings',()=>{
 const local=legacyState(),incoming=legacyState([template(['squat-goblet'])]);local.exerciseNotes['squat-goblet']='Local';local.preferences.sounds=true;
 const s=C.createSession(incoming.templates[0],strength.exercises,start);incoming.sessions=[s];incoming.activeId=s.id;incoming.exerciseNotes['squat-goblet']='Imported';incoming.favorites=['squat-goblet'];
 const merged=C.mergeStates(local,incoming);assert.equal(merged.activeId,s.id);assert.equal(merged.exerciseNotes['squat-goblet'],'Local');assert.equal(merged.preferences.sounds,true);assert.ok(merged.favorites.includes('squat-goblet'));
 assert.equal(local.sessions.length,0);assert.deepEqual(C.mergeStates(merged,incoming),merged);
});

test('shared slots align stable plans with different exercises, doses and independent snapshots',()=>{
 const t=template(['prep-marche','squat-goblet','stretch-quadriceps'],{blockOrder:[...C.blocks]});
 const variant=C.clone(t.items);variant[1]=C.item(ex('squat-poids-corps'),{id:t.items[1].id,sets:2,reps:6});
 t.items[1].load=8;t.variants={severine:{items:variant,mode:'classic',rounds:3,blockOrder:[...C.blocks]}};
 const state=C.newState([t]),w=C.addWorkout(state,t,[...strength.exercises,...prep.exercises],['martin','severine'],start);
 const martin=C.workoutSession(state,w,'martin'),sev=C.workoutSession(state,w,'severine');
 assert.equal(w.slots.length,3);assert.equal(w.slots[1].entries.martin,martin.entries[1].id);assert.equal(w.slots[1].entries.severine,sev.entries[1].id);
 assert.equal(martin.entries[1].exerciseId,'squat-goblet');assert.equal(sev.entries[1].exerciseId,'squat-poids-corps');
 assert.equal(martin.entries[1].rows.length,3);assert.equal(sev.entries[1].rows.length,2);assert.equal(sev.entries[1].rows[0].reps,6);
 assert.equal(martin.entries[1].rows[0].load,8);assert.equal(sev.entries[1].rows[0].load,0);
 t.items[1].load=50;assert.equal(martin.entries[1].rows[0].load,8);
 C.switchProfile(state,'severine');assert.equal(C.getWorkout(state).id,w.id);
 assert.deepEqual(C.validateBackup(state),state);
});

test('shared circuits align each round and keep participant-only exercises separate',()=>{
 const t=template(['prep-marche','squat-goblet','pompes','stretch-quadriceps'],{mode:'circuit',rounds:2,blockOrder:[...C.blocks]});
 const items=C.clone(t.items);items.splice(2,1);items.push(C.item(ex('mollets-debout')));
 t.variants={severine:{items,mode:'circuit',rounds:3,blockOrder:[...C.blocks]}};
 const {workout:w,sessions}=C.createWorkout(t,[...strength.exercises,...prep.exercises],['martin','severine'],start);
 const m=sessions.find(s=>s.profileId==='martin'),v=sessions.find(s=>s.profileId==='severine');
 assert.equal(w.slots[0].block,'echauffement');assert.equal(w.slots.at(-1).block,'etirements');
 const shared=w.slots.filter(slot=>slot.entries.martin&&slot.entries.severine);
 assert.equal(shared.length,4); // warm-up, two shared rounds, stretch
 for(const slot of shared.filter(x=>x.block==='renforcement'))assert.equal(m.entries.find(e=>e.id===slot.entries.martin).round,v.entries.find(e=>e.id===slot.entries.severine).round);
 assert.equal(w.slots.filter(slot=>!slot.entries.martin).length,4); // three calf rounds and the third squat round
});

test('schema-2 migration preserves every active record, including previously unreachable sessions',()=>{
 const state=legacyState([template(['squat-goblet'])]);
 const a=C.createSession(state.templates[0],strength.exercises,start),b=C.createSession(state.templates[0],strength.exercises,start+1000),c=C.createSession({...state.templates[0],profileId:'severine'},strength.exercises,start+2000);
 a.entries[0].note='À conserver';a.entries[0].rows[0].load=9;a.restUntil=start+60000;C.finish(c,start+30000);
 state.sessions=[a,b,c];state.activeId=b.id;C.captureProfile(state);
 const result=C.validateBackup(state);
 assert.equal(result.schema,3);assert.equal(result.workouts.length,3);assert.equal(result.workouts.filter(w=>w.status==='active').length,2);
 assert.equal(result.activeWorkoutId,result.sessions.find(s=>s.id===b.id).workoutId);
 assert.equal(result.sessions[0].restUntil,start+60000);assert.equal(result.sessions[0].entries[0].note,'À conserver');assert.equal(result.sessions[0].entries[0].rows[0].load,9);
 assert.deepEqual(C.validateBackup(result),result);assert.deepEqual(C.validateBackup(state),result);
 assert.equal(state.schema,2);assert.equal(state.sessions[0].workoutId,undefined);
});

test('group pause, reload, resume and finish retain separate timers and only real performances',()=>{
 const state=C.newState(),t=template(['squat-goblet','prep-marche']),w=C.addWorkout(state,t,[...strength.exercises,...prep.exercises],['martin','severine'],start);
 const m=C.workoutSession(state,w,'martin'),v=C.workoutSession(state,w,'severine');
 m.entries[0].rows[0].load=8;C.complete(m,m.entries[0].id,m.entries[0].rows[0].id,'done',start+10000);
 v.effortRowId=v.entries[1].rows[0].id;v.effortUntil=start+60000;
 C.pauseWorkout(state,w,start+20000);assert.equal(m.restRemaining,50000);assert.equal(v.effortRemaining,40000);
 const restored=C.validateBackup(JSON.parse(JSON.stringify(state))),rw=C.getWorkout(restored);
 C.resumeWorkout(restored,rw,start+100000);
 assert.equal(C.workoutSession(restored,rw,'martin').restUntil,start+150000);assert.equal(C.workoutSession(restored,rw,'severine').effortUntil,start+140000);
 C.finishWorkout(restored,rw,start+130000);
 assert.equal(rw.status,'completed');assert.equal(restored.activeWorkoutId,null);assert.equal(restored.activeId,null);
 assert.equal(C.totals(C.personalSessions(restored,'martin')).volume,80);assert.equal(C.totals(C.personalSessions(restored,'severine')).done,0);
 for(const session of restored.sessions){assert.equal(C.elapsed(session),50000);assert.equal(session.restUntil,null);assert.equal(session.effortRowId,null);assert.ok(session.entries.some(e=>e.rows.some(r=>r.status==='pending')));}
 assert.doesNotThrow(()=>C.validateBackup(restored));
 const finishedAt=rw.finishedAt;C.finishWorkout(restored,rw,start+999999);assert.equal(rw.finishedAt,finishedAt);
});

test('backup rejects mismatched groups, duplicated slots and cross-person links',()=>{
 const original=C.newState(),w=C.addWorkout(original,template(['squat-goblet']),strength.exercises,['martin','severine'],start);
 const cases=[
  s=>s.workouts[0].sessionIds.martin=s.workouts[0].sessionIds.severine,
  s=>s.workouts[0].slots[0].entries.martin=s.sessions.find(x=>x.profileId==='severine').entries[0].id,
  s=>s.sessions[0].workoutId='missing',
  s=>s.workouts[0].participantIds.push('missing'),
  s=>s.workouts[0].slots.push({...C.clone(s.workouts[0].slots[0]),id:C.uid()}),
  s=>s.activeWorkoutId='missing',
  s=>s.workouts[0].status='completed',
  s=>s.workouts=[]
 ];
 for(const mutate of cases){const s=C.clone(original);mutate(s);assert.throws(()=>C.validateBackup(s));}
 assert.equal(C.getWorkout(original).id,w.id);
});

test('completed work, comments and skipped rows can remain outside the current common slots',()=>{
 const state=C.newState(),w=C.addWorkout(state,template(['squat-goblet']),strength.exercises,['martin','severine'],start),m=C.workoutSession(state,w,'martin');
 const old=m.entries[0];old.note='Douleur avant validation';old.rows[0].status='skipped';old.rows[0].completedAt=start+10000;
 old.feedback.push({id:C.uid(),type:'pain',points:[],note:'Épaule'});
 const replacement=C.makeEntry(C.item(ex('pompes')),ex('pompes'));m.entries.push(replacement);w.slots[0].entries.martin=replacement.id;
 const restored=C.validateBackup(state);assert.equal(restored.sessions.find(s=>s.profileId==='martin').entries[0].note,old.note);
 assert.equal(C.totals(C.personalSessions(restored,'martin')).done,0);
});

test('untrusted backups reject markup in rows, malformed clocks, cursors, rounds and undo snapshots',()=>{
 const original=C.newState(),w=C.addWorkout(original,template(['squat-goblet']),strength.exercises,['martin'],start);
 C.complete(original.sessions[0],original.sessions[0].entries[0].id,original.sessions[0].entries[0].rows[0].id,'done',start+10000);
 const cases=[
  s=>s.sessions[0].entries[0].rows[0].number='<img src=x>',
  s=>s.sessions[0].entries[0].rows[0].side='<b>bad</b>',
  s=>s.sessions[0].entries[0].round='<b>bad</b>',
  s=>s.sessions[0].finishedAt='bad',
  s=>s.sessions[0].restUntil='bad',
  s=>s.sessions[0].pausedAt=-1,
  s=>s.sessions[0].pausedMs=-1,
  s=>s.sessions[0].cursor=999,
  s=>s.workouts[0].cursor=999,
  s=>s.sessions[0].undo.previous.number='<b>bad</b>',
  s=>s.sessions[0].effortRowId='missing'
 ];
 for(const mutate of cases){const s=C.clone(original);mutate(s);assert.throws(()=>C.validateBackup(s));}
 const state=C.newState([template(['squat-goblet'])]);state.templates[0].variants={severine:{items:C.clone(state.templates[0].items),mode:'classic',blockOrder:'bad'}};assert.throws(()=>C.validateBackup(state));
 assert.equal(C.getWorkout(original).id,w.id);
});

test('merge retains every active group and local edits without silently replacing selected training',()=>{
 const local=C.newState(),incoming=C.newState(),t=template(['squat-goblet']);
 const localWorkout=C.addWorkout(local,t,strength.exercises,['martin','severine'],start),importedWorkout=C.addWorkout(incoming,t,strength.exercises,['martin'],start+1000);
 local.exerciseNotes['squat-goblet']='Note locale';incoming.exerciseNotes['squat-goblet']='Autre appareil';
 const merged=C.mergeStates(local,incoming);
 assert.equal(merged.activeWorkoutId,localWorkout.id);assert.equal(merged.workouts.filter(w=>w.status==='active').length,2);assert.equal(merged.sessions.length,3);assert.equal(merged.exerciseNotes['squat-goblet'],'Note locale');
 merged.activeWorkoutId=importedWorkout.id;C.syncActivePointers(merged);assert.equal(C.getWorkout(merged).id,importedWorkout.id);
 assert.equal(C.workoutSession(merged,C.getWorkout(merged),'martin').id,incoming.sessions[0].id);
 assert.deepEqual(C.mergeStates(merged,incoming),merged);assert.equal(local.sessions.length,2);
});

test('importing an older active copy never reopens a locally finished common workout',()=>{
 const local=C.newState(),w=C.addWorkout(local,template(['squat-goblet']),strength.exercises,['martin','severine'],start),old=C.clone(local);
 C.finishWorkout(local,w,start+30000);const merged=C.mergeStates(local,old);
 assert.equal(merged.activeWorkoutId,null);assert.equal(merged.workouts[0].status,'completed');assert.equal(merged.sessions.length,2);assert.equal(merged.activeId,null);
});

test('warmup catalogue exposes every routine movement once, while other families retain their catalogue',()=>{
 const routines=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/warmup-routines.json'))).routines;
 const catalog=[...strength.exercises,...prep.exercises];
 const movements=C.libraryExercises(catalog,routines,'echauffement');
 const expected=new Set([...prep.exercises.filter(e=>e.category==='echauffement').map(e=>e.id),...routines.flatMap(r=>r.exerciseIds)]);
 assert.deepEqual(new Set(movements.map(e=>e.id)),expected);
 assert.equal(movements.length,expected.size);assert.equal(movements.length,29);
 for(const category of ['renforcement','mobilisation','etirements'])assert.deepEqual(C.libraryExercises(catalog,routines,category),catalog.filter(e=>C.family(e)===category));
 assert.deepEqual(C.libraryExercises(catalog,routines,'all'),catalog);
});
test('adding a strength movement as warmup preserves its warmup dose and excludes it from work volume for both people',()=>{
 const routines=JSON.parse(fs.readFileSync(path.join(__dirname,'../content/warmup-routines.json'))).routines;
 const catalog=[...strength.exercises,...prep.exercises];
 const definition=catalog.find(e=>C.family(e)==='renforcement'&&routines.some(r=>r.exerciseIds.includes(e.id)));
 const plan=C.itemForBlock(definition,'echauffement',routines),dose=routines.flatMap(r=>r.items).find(p=>p.exerciseId===definition.id);
 for(const key of ['sets','reps','duration','rest'])assert.equal(plan[key],dose[key]);
 assert.equal(plan.loadMode,'none');assert.equal(plan.load,0);assert.equal(plan.block,'echauffement');
 const {sessions}=C.createWorkout({id:'warm',name:'Warmup',items:[plan]},catalog,['martin','severine'],start);
 for(const s of sessions){for(const row of s.entries[0].rows)C.complete(s,s.entries[0].id,row.id,'done',start+10000);C.finish(s,start+20000);assert.equal(C.totals([s]).volume,0);assert.deepEqual(C.totals([s]).muscles,{});}
 const strengthPlan=C.itemForBlock(definition,'renforcement',routines);
 assert.equal(strengthPlan.sets,C.parameters(definition).sets);
 assert.notEqual(plan.id,C.itemForBlock(definition,'echauffement',routines).id);
});
