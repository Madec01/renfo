const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../dist/js/core.js');
const context={window:{},URL,document:{baseURI:'https://example.test/renfo/'}};
vm.runInNewContext(fs.readFileSync(require.resolve('../dist/js/data.js'),'utf8'),context);
const D=JSON.parse(JSON.stringify(context.window.RENFO_DATA));
const now=Date.UTC(2026,10,6,14);

test('all proposed programmes include their linked warmup, suitable working block and final stretches',()=>{
 assert.equal(D.sessionPrograms.length,24);
 assert.deepEqual(['targeted','mixed','mobility'].map(kind=>D.sessionPrograms.filter(p=>p.kind===kind).length),[15,3,6]);
 for(const p of D.sessionPrograms){
  const warmup=D.routines.find(r=>r.id===p.warmupRoutineId);
  assert.deepEqual(p.items.filter(i=>i.block==='echauffement').map(({id,tempo,band,...i})=>i),warmup.items);
  assert.ok(p.items.some(i=>i.block==='etirements'));
  assert.ok(p.items.some(i=>i.block===(p.kind==='mobility'?'mobilisation':'renforcement')));
  if(p.kind==='mixed')assert.ok(p.items.some(i=>i.block==='mobilisation'));
  if(p.kind==='mobility')assert.ok(p.items.every(i=>i.block!=='renforcement'));
  for(const i of p.items){
   const e=D.exercises.find(e=>e.id===i.exerciseId);assert.ok(e);
   assert.ok(i.sets>0);assert.ok(i[e.execution_mode==='duree'?'duration':'reps']>0);
   assert.equal(i.load,0);if(i.block!=='renforcement')assert.equal(i.loadMode,'none');
  }
  assert.ok(Number.isFinite(C.estimate(p,D.exercises)));
 }
});

test('personal programme copies never mutate the catalogue, saved versions, or another person’s settings',()=>{
 const source=D.sessionPrograms.find(p=>p.kind==='targeted'),before=JSON.stringify(source);
 const a=C.programTemplate(source,['martin','severine']),b=C.programTemplate(source,['martin']);
 assert.notEqual(a.id,b.id);assert.notEqual(a.items[0].id,b.items[0].id);
 const work=a.items.find(i=>i.block==='renforcement');
 a.variants.severine={items:C.clone(a.items),mode:'classic',rounds:1,blockOrder:[...C.blocks]};
 a.variants.severine.items.find(i=>i.id===work.id).sets=1;
 work.sets=4;
 const s=C.newState([a]);C.addWorkout(s,a,D.exercises,a.participantIds,now);
 const group=C.getWorkout(s),martin=C.workoutSession(s,group,'martin'),severine=C.workoutSession(s,group,'severine');
 assert.equal(martin.entries.find(e=>e.plan.id===work.id).plan.sets,4);
 assert.equal(severine.entries.find(e=>e.plan.id===work.id).plan.sets,1);
 a.items[0].duration=999;
 assert.notEqual(martin.entries[0].plan.duration,999);
 assert.equal(JSON.stringify(source),before);
 assert.notEqual(b.items[0].duration,999);
 C.validateBackup(s);
});

test('every catalogue programme creates a valid shared workout and mobility never creates strength volume',()=>{
 for(const program of D.sessionPrograms){
  const template=C.programTemplate(program,['martin','severine']),s=C.newState();
  C.addWorkout(s,template,D.exercises,template.participantIds,now);
  const group=C.getWorkout(s);assert.equal(group.slots.length,template.items.length);
  for(const pid of group.participantIds){
   const session=C.workoutSession(s,group,pid);
   for(const entry of session.entries)for(const row of entry.rows)C.complete(session,entry.id,row.id,'done',now+1000);
   if(program.kind==='mobility'){assert.equal(C.totals([session]).volume,0);assert.deepEqual(C.totals([session]).muscles,{});}
  }
  C.finishWorkout(s,group,now+2000);C.validateBackup(s);
 }
});

test('catalogue availability does not depend on reseeding or migrating an existing carnet',()=>{
 const old=C.newState([{id:'personal',name:'Mon modèle conservé',mode:'classic',items:[C.item(D.exercises[0])]}]);
 old.templates[0].items[0].load=7;
 const restored=C.validateBackup(old);
 assert.equal(restored.templates.length,1);assert.equal(restored.templates[0].items[0].load,7);
 const template=C.programTemplate(D.sessionPrograms[0],['martin']);
 C.addWorkout(restored,template,D.exercises,['martin'],now);
 assert.equal(restored.templates.length,1);assert.equal(restored.templates[0].id,'personal');
 assert.ok(restored.sessions.length);assert.equal(D.sessionPrograms.length,24);
});

test('multi-group composition merges programmes without duplicates or multiplying warmups',()=>{
 const targeted=D.sessionPrograms.filter(p=>p.kind==='targeted'),before=JSON.stringify(D);
 for(let a=0;a<targeted.length;a++)for(let b=a+1;b<targeted.length;b++){
  const ids=[targeted[a].id,targeted[b].id],p=C.composeProgram(D.sessionPrograms,D.routines,ids,{perGroup:2,mobility:true});
  assert.deepEqual(p.targetGroupIds,ids);
  const warmup=D.routines.find(r=>r.id===p.warmupRoutineId);
  assert.deepEqual(p.items.filter(i=>i.block==='echauffement').map(i=>i.exerciseId),warmup.exerciseIds);
  for(const block of C.blocks){const items=p.items.filter(i=>i.block===block);assert.equal(new Set(items.map(i=>i.exerciseId)).size,items.length);}
  assert.ok(p.items.some(i=>i.block==='mobilisation'));
  assert.ok(p.items.some(i=>i.block==='etirements'));
  const template=C.programTemplate(p,['martin','severine']),state=C.newState([template]);
  C.addWorkout(state,template,D.exercises,template.participantIds,now);C.validateBackup(state);
 }
 assert.equal(JSON.stringify(D),before);
 const short=C.composeProgram(D.sessionPrograms,D.routines,['programme-dos','programme-biceps']);
 assert.equal(short.items.filter(i=>i.block==='renforcement').length,2);
 assert.equal(short.items.filter(i=>i.block==='mobilisation').length,0);
 assert.equal(short.warmupRoutineId,'warmup-8-haut-sans-sol');
 assert.throws(()=>C.composeProgram(D.sessionPrograms,D.routines,['programme-dos','programme-dos']),/deux groupes/);
 const full=C.composeProgram(D.sessionPrograms,D.routines,targeted.map(p=>p.id),{perGroup:2,mobility:true});
 assert.ok(full.name.length<=100);assert.ok(C.estimate(full,D.exercises)>0);
});

test('muscle filters use OR across groups and distinguish primary, assisting and stabilizing muscles',()=>{
 const groups=D.sessionPrograms.filter(p=>['programme-dos','programme-biceps','programme-abdominaux'].includes(p.id));
 const e={muscle_roles:{primary:['grand_dorsal'],assistance:['biceps'],stabilization:['transverse']}};
 assert.deepEqual(C.exerciseGroupMatches(e,groups).map(m=>[m.id,m.role]),[['programme-dos','primary']]);
 assert.deepEqual(C.exerciseGroupMatches(e,groups,'assistance').map(m=>m.id),['programme-dos','programme-biceps']);
 assert.deepEqual(C.exerciseGroupMatches(e,groups,'all').map(m=>m.role),['primary','assistance','stabilization']);
 assert.equal(C.exerciseGroupMatches(e,[]).length,0);
 assert.equal(C.exerciseGroupMatches({muscle_roles:{primary:[]}},groups).length,0);
 const custom={muscle_roles:{primary:['biceps'],assistance:[],stabilization:[]}};
 assert.equal(C.exerciseGroupMatches(custom,groups)[0].id,'programme-biceps');
});
