const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../dist/js/updates.js'),'utf8');
function events(object={}){const map=new Map();return Object.assign(object,{addEventListener(k,f){(map.get(k)||map.set(k,[]).get(k)).push(f);},emit(k,event={}){for(const f of map.get(k)||[])f(event);}});}
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function environment({safe=true,flush=true,waiting=false,storage=new Map(),registerFailures=0}={}){
 let reloads=0,checks=0,preparations=0,time=100000;
 const intervals=[],statuses=[],messages=[];
 const worker=events({state:'activated',postMessage(message){messages.push(message);}});
 const reg=events({waiting:waiting?worker:null,installing:null,update:async()=>{checks++;}});
 const serviceWorker=events({controller:worker,register:async(url,options)=>{if(registerFailures-->0)throw Error('offline');assert.equal(url,'sw.js');assert.equal(options.updateViaCache,'none');return reg;}});
 const document=events({visibilityState:'visible'}),window=events(),navigator={serviceWorker,onLine:true};
 const location={pathname:'/renfo/dist/',protocol:'https:',reload(){reloads++;}};
 const sessionStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 vm.runInNewContext(source,{window,document,navigator,location,sessionStorage,Date:{now:()=>time},setInterval:(fn,delay)=>intervals.push({fn,delay}),console});
 const config={version:'old',ready:()=>safe,beforeReload:async()=>{preparations++;return typeof flush==='function'?flush():flush;},onStatus:s=>statuses.push(s)};
 return {api:window.RenfoUpdates,window,document,navigator,reg,worker,storage,intervals,statuses,messages,config,
 setSafe:value=>{safe=value;},advance:(ms=2000)=>{time+=ms;},stats:()=>({reloads,checks,preparations}),
 version(value){serviceWorker.emit('message',{source:worker,data:{type:'RENFO_VERSION',version:value}});}};
}
test('a waiting update activates automatically and reloads once only after writes finish',async()=>{
 let finish;const e=environment({waiting:true,flush:()=>new Promise(r=>{finish=r;})});
 await e.api.start(e.config);assert.ok(e.messages.some(m=>m.type==='SKIP_WAITING'));
 e.version('new');await settle();assert.equal(e.stats().reloads,0);
 finish(true);await settle();assert.equal(e.stats().reloads,1);
 e.version('new');e.navigator.serviceWorker.emit('controllerchange');await settle();assert.equal(e.stats().reloads,1);
});
test('editing and running timers defer reload; ending them applies without user confirmation',async()=>{
 const e=environment({safe:false});await e.api.start(e.config);e.version('new');await settle();
 assert.equal(e.stats().preparations,0);assert.equal(e.api.getState(),'waiting');
 e.setSafe(true);e.advance();e.intervals.find(i=>i.delay===1500).fn();await settle();assert.equal(e.stats().reloads,1);
});
test('failed persistence, hidden pages and matching versions never reload',async()=>{
 const e=environment({flush:false});await e.api.start(e.config);e.version('old');await settle();assert.equal(e.stats().reloads,0);
 e.document.visibilityState='hidden';e.version('new');await settle();assert.equal(e.stats().preparations,0);
 e.document.visibilityState='visible';e.document.emit('visibilitychange');await settle();assert.equal(e.api.getState(),'blocked');assert.equal(e.stats().reloads,0);
});
test('version guard stops a stale-shell reload loop and an unrelated message cannot trigger a reload',async()=>{
 const shared=new Map(),first=environment({storage:shared});await first.api.start(first.config);first.version('new');await settle();assert.equal(first.stats().reloads,1);
 const second=environment({storage:shared});await second.api.start(second.config);second.advance(400000);second.version('new');await settle();assert.equal(second.stats().reloads,0);assert.equal(second.api.getState(),'blocked');
 const third=environment();await third.api.start(third.config);third.navigator.serviceWorker.emit('message',{source:{},data:{type:'RENFO_VERSION',version:'other'}});await settle();assert.equal(third.stats().reloads,0);
});
test('checks run on reconnect and are throttled on repeated focus events',async()=>{
 const e=environment();await e.api.start(e.config);const count=e.stats().checks;
 e.window.emit('focus');e.window.emit('focus');await settle();assert.equal(e.stats().checks,count);
 e.navigator.onLine=false;await e.api.check();assert.equal(e.api.getState(),'offline');assert.equal(e.stats().checks,count);
 e.navigator.onLine=true;e.window.emit('online');await settle();assert.equal(e.stats().checks,count+1);
});

test('registration retries after an offline startup when the connection returns',async()=>{
 const e=environment({registerFailures:1});await e.api.start(e.config);assert.equal(e.api.getState(),'error');
 e.window.emit('online');await settle();assert.equal(e.stats().checks,1);e.version('new');await settle();assert.equal(e.stats().reloads,1);
});
