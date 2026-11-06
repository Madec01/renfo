const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../dist/js/core.js');
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
 const state=C.newState([template(['squat-goblet'])]);const s=C.createSession(state.templates[0],strength.exercises,start);state.sessions=[s];state.activeId=s.id;
 s.entries[0].feedback.push({type:'pain',points:[{x:.3,y:.4,view:'front',region:'Épaule',side:'droite'}],note:'Exemple de test'});
 const restored=C.validateBackup(JSON.parse(JSON.stringify({format:'renfo-backup',version:1,state})));
 assert.equal(restored.activeId,s.id);assert.equal(restored.sessions[0].entries[0].feedback[0].points[0].side,'droite');
});
test('backup validation rejects invalid values and missing active session',()=>{
 const state=C.newState();state.activeId='missing';assert.throws(()=>C.validateBackup(state));
 const s=C.createSession(template(['squat-goblet']),strength.exercises,start);state.activeId=s.id;state.sessions=[s];s.entries[0].rows[0].load=-5;assert.throws(()=>C.validateBackup(state));
});
test('all exercise IDs, muscle references and routines can be resolved',()=>{
 const exercises=[...strength.exercises,...prep.exercises];assert.equal(exercises.length,76);assert.equal(new Set(exercises.map(e=>e.id)).size,76);
 for(const e of exercises){assert.ok(e.steps.length>=4,e.id);for(const m of Object.values(e.muscle_roles).flat())assert.ok(strength.muscles[m],m);}
});
test('v1 migration assigns old records to Martin without altering series or timers',()=>{
 const old=C.newState([template(['squat-goblet'])]);const session=C.createSession(old.templates[0],strength.exercises,start);
 session.entries[0].rows[0].load=8;session.restUntil=start+60000;delete session.profileId;
 old.schema=1;old.sessions=[session];old.activeId=session.id;old.exerciseNotes={'squat-goblet':'Repère historique'};old.favorites=['squat-goblet'];
 delete old.profileData;delete old.profiles;delete old.currentProfileId;
 const migrated=C.validateBackup(old);assert.equal(migrated.schema,2);assert.equal(migrated.sessions[0].profileId,'martin');
 assert.equal(migrated.sessions[0].restUntil,start+60000);assert.equal(migrated.sessions[0].entries[0].rows[0].load,8);
 assert.deepEqual(C.validateBackup(migrated),migrated);assert.equal(migrated.profileData.martin.activeId,session.id);
 C.switchProfile(migrated,'severine');assert.equal(migrated.activeId,null);assert.deepEqual(migrated.favorites,[]);assert.deepEqual(migrated.exerciseNotes,{});
 C.switchProfile(migrated,'martin');assert.equal(migrated.exerciseNotes['squat-goblet'],'Repère historique');assert.equal(migrated.activeId,session.id);
});
test('different people retain independent active sessions, completed volume and preferences',()=>{
 const state=C.newState([template(['squat-goblet'])]);const martin=C.createSession({...state.templates[0],profileId:'martin'},strength.exercises,start);
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
 const state=C.newState([template(['squat-goblet'])]);const s=C.createSession(state.templates[0],strength.exercises,start);state.sessions.push(s);state.profileData.severine.activeId=s.id;
 assert.throws(()=>C.validateBackup(state));
});
test('alternating warm-ups use a single total timer; paired mobility counts pairs, side-based work stays separate',()=>{
 const t=template(['prep-marche','mob-hanches-90-90','stretch-quadriceps','deadbug']);const s=C.createSession(t,[...strength.exercises,...prep.exercises],start);
 assert.equal(s.entries[0].rows.length,1);assert.equal(s.entries[0].rows[0].side,'ensemble');
 assert.equal(s.entries[1].rows.length,1);assert.equal(s.entries[2].rows.length,2);assert.equal(s.entries[3].rows.length,6);
});
test('merging profiles restores imported active workouts and preserves local notes and settings',()=>{
 const local=C.newState(),incoming=C.newState([template(['squat-goblet'])]);local.exerciseNotes['squat-goblet']='Local';local.preferences.sounds=true;
 const s=C.createSession(incoming.templates[0],strength.exercises,start);incoming.sessions=[s];incoming.activeId=s.id;incoming.exerciseNotes['squat-goblet']='Imported';incoming.favorites=['squat-goblet'];
 const merged=C.mergeStates(local,incoming);assert.equal(merged.activeId,s.id);assert.equal(merged.exerciseNotes['squat-goblet'],'Local');assert.equal(merged.preferences.sounds,true);assert.ok(merged.favorites.includes('squat-goblet'));
 assert.equal(local.sessions.length,0);assert.deepEqual(C.mergeStates(merged,incoming),merged);
});
