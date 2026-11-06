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
