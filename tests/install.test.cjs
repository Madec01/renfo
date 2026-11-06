const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const path=require('node:path');
const root=path.join(__dirname,'..');

function installEnvironment(navigator={}) {
  const handlers=new Map(),media={matches:false,addEventListener(type,fn){this.change=fn;}};
  const window={isSecureContext:true,matchMedia:()=>media,addEventListener:(type,fn)=>handlers.set(type,fn)};
  vm.runInNewContext(fs.readFileSync(path.join(root,'dist/js/install.js'),'utf8'),{window,navigator,console});
  return {api:window.RenfoInstall,media,emit:(type,event={})=>handlers.get(type)?.(event)};
}
test('iOS and iPadOS offer a guide without pretending a native prompt exists',async()=>{
  for(const navigator of [{userAgent:'iPhone Safari'},{platform:'MacIntel',maxTouchPoints:5}]){
    const {api}=installEnvironment(navigator);
    assert.equal(api.getState().platform,'ios');
    assert.equal(api.getState().canPrompt,false);
    assert.equal((await api.requestInstall()).status,'guide');
  }
});
test('native prompt is consumed once even during double taps and after dismissal',async()=>{
  const {api,emit}=installEnvironment({userAgent:'Android Chrome'});
  let calls=0,resolve;
  const userChoice=new Promise(done=>{resolve=done;});
  emit('beforeinstallprompt',{preventDefault(){},prompt(){calls++;},userChoice});
  assert.equal(api.getState().canPrompt,true);
  const first=api.requestInstall();
  assert.equal(api.getState().busy,true);
  assert.equal((await api.requestInstall()).status,'guide');
  resolve({outcome:'dismissed'});
  assert.equal((await first).status,'dismissed');
  assert.equal((await api.requestInstall()).status,'guide');
  assert.equal(calls,1);
  assert.equal(api.getState().busy,false);
});
test('acceptance, appinstalled and standalone changes have separate truthful states',async()=>{
  const {api,emit,media}=installEnvironment();
  let updates=0;const unsubscribe=api.subscribe(()=>updates++);
  emit('beforeinstallprompt',{preventDefault(){},prompt:async()=>({outcome:'accepted'})});
  assert.equal((await api.requestInstall()).status,'accepted');
  assert.equal(api.getState().installed,false);
  emit('appinstalled');
  assert.equal(api.getState().installed,true);
  assert.equal(api.getState().canPrompt,false);
  assert.equal((await api.requestInstall()).status,'installed');
  unsubscribe();const count=updates;media.change();assert.equal(updates,count);
  const other=installEnvironment();other.media.matches=true;other.media.change();
  assert.equal(other.api.getState().installed,true);
  assert.equal(installEnvironment({standalone:true}).api.getState().installed,true);
});
test('a rejected browser prompt is recoverable and never reports success',async()=>{
  const {api,emit}=installEnvironment();
  emit('beforeinstallprompt',{preventDefault(){},prompt:async()=>{throw Error('blocked');}});
  assert.equal((await api.requestInstall()).status,'error');
  assert.equal(api.getState().busy,false);
  assert.equal(api.getState().installed,false);
  assert.equal((await api.requestInstall()).status,'guide');
});

const base='https://example.test/renfo/dist/';
function swEnvironment(){
  const stores=new Map(),events=new Map();
  const key=input=>new URL(typeof input==='string'?input:input.url,base).href;
  const caches={
    keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),
    open:async name=>{
      if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
      return {
        put:async(request,response)=>store.set(key(request),response.clone()),
        match:async(request,options={})=>{
          const target=key(request),normalize=url=>options.ignoreSearch?url.split('?')[0]:url;
          const entry=[...store].find(([url])=>normalize(url)===normalize(target));
          return entry?.[1].clone();
        },
        keys:async()=>[...store.keys()].map(url=>new Request(url)),
        addAll:async()=>{}
      };
    }
  };
  const self={location:new URL('sw.js',base),clients:{claim:async()=>{}},addEventListener:(type,fn)=>events.set(type,fn)};
  vm.runInNewContext(fs.readFileSync(path.join(root,'dist/sw.js'),'utf8'),{self,caches,URL,Uint8Array,Response,crypto:webcrypto,fetch:async()=>{throw Error('offline');}});
  return {caches,events,stores};
}
test('service worker retains only unchanged images and leaves other scopes untouched',async()=>{
  const {caches,events,stores}=swEnvironment();
  const legacy=await caches.open('renfo-assets-legacy');
  await legacy.put('assets/icon-192.png',new Response(fs.readFileSync(path.join(root,'dist/assets/icon-192.png'))));
  await legacy.put('assets/icon-512.png',new Response('obsolete icon bytes'));
  await (await caches.open('renfo@%2Fanother%2F:assets-old')).put('https://example.test/another/icon.png',new Response('other app'));
  await (await caches.open('renfo-assets-mixed')).put('https://example.test/another/icon.png',new Response('other legacy app'));
  let activation;events.get('activate')({waitUntil:promise=>{activation=promise;}});await activation;
  const current=[...stores.keys()].find(name=>name.startsWith('renfo@%2Frenfo%2Fdist%2F:assets-'));
  assert.ok(current);
  assert.ok(await (await caches.open(current)).match('assets/icon-192.png'));
  assert.equal(await (await caches.open(current)).match('assets/icon-512.png'),undefined);
  assert.equal(stores.has('renfo-assets-legacy'),false);
  assert.equal(stores.has('renfo-assets-mixed'),true);
  assert.equal(stores.has('renfo@%2Fanother%2F:assets-old'),true);
});
test('service worker ignores another app path and uses the shell for offline navigation',async()=>{
  const {caches,events}=swEnvironment();
  let intercepted=false;
  events.get('fetch')({request:{method:'GET',url:'https://example.test/another/'},respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false);
  const source=fs.readFileSync(path.join(root,'dist/sw.js'),'utf8'),version=JSON.parse(source.match(/const VERSION=(.*);/)[1]);
  await (await caches.open('renfo@%2Frenfo%2Fdist%2F:shell-'+version)).put('index.html',new Response('Renfo offline'));
  let response;events.get('fetch')({request:{method:'GET',url:base+'unknown',mode:'navigate'},respondWith:promise=>{response=promise;}});
  assert.equal(await (await response).text(),'Renfo offline');
});
