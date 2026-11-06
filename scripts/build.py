import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
DIST=ROOT/'dist'
strength=json.loads((ROOT/'content/strength.json').read_text())
prep=json.loads((ROOT/'content/preparation.json').read_text())
extra=json.loads((ROOT/'content/preparation-extra.json').read_text())
program_catalog=json.loads((ROOT/'content/session-programs.json').read_text())
advice=json.loads((ROOT/'content/advice-sources.json').read_text())
warmups=json.loads((ROOT/'content/warmup-routines.json').read_text())
exercises=strength['exercises']+prep['exercises']+extra['exercises']
for e in exercises:
    if (DIST/f'assets/exercises/{e["id"]}.webp').exists(): e['image']=f'assets/exercises/{e["id"]}.webp'
    elif (DIST/f'assets/exercises/{e["id"]}.png').exists(): e['image']=f'assets/exercises/{e["id"]}.png'
sources={s['id']:s for s in strength['sources']+prep['sources']+extra['sources']+advice['sources']+warmups['sources']+program_catalog['sources']}
routines=list(warmups['routines'])
routines += [
 {'id':'mob-ankle-hip','name':'Chevilles & hanches','family':'mobilisation','exerciseIds':['mob-chevilles-cercles','mob-cheville-demi-genou','mob-hanches-90-90']},
 {'id':'mob-upper','name':'Haut du dos & épaules','family':'mobilisation','exerciseIds':['mob-roules-epaules','mob-livre-ouvert','mob-anges-mur']},
 {'id':'mob-seated','name':'Tout assis','family':'mobilisation','exerciseIds':['mob-chevilles-flexion','mob-rotation-assise','mob-nuque-rotation']},
 {'id':'mob-global','name':'Mobilisation globale','family':'mobilisation','exerciseIds':['mob-chat-vache','mob-rotation-demi-genou','mob-hanches-90-90','mob-epaule-controlee']},
 {'id':'stretch-lower','name':'Bas du corps','family':'etirements','exerciseIds':['stretch-mollet-tendu','stretch-quadriceps','stretch-ischios','stretch-fessiers']},
 {'id':'stretch-upper','name':'Haut du corps','family':'etirements','exerciseIds':['stretch-epaule','stretch-pectoraux','stretch-poitrine-assis']},
 {'id':'stretch-global','name':'Corps entier','family':'etirements','exerciseIds':['stretch-mollet-flechi','stretch-hanche-avant','stretch-adducteurs','stretch-epaule','stretch-pectoraux']},
]
assert len({e['id'] for e in exercises})==len(exercises)
ids={e['id'] for e in exercises}
assert all(i in ids for r in routines for i in r['exerciseIds'])
assert len({r['id'] for r in routines})==len(routines)
for r in warmups['routines']:
    assert r['family']=='echauffement',r['id']
    assert [i['exerciseId'] for i in r['items']]==r['exerciseIds'],r['id']
    assert all(i['block']=='echauffement' for i in r['items']),r['id']
    assert all(s in sources for s in r['source_ids']),r['id']
for e in exercises:
    assert all(s in sources for s in e['source_ids']),e['id']
    assert all(m in strength['muscles'] for group in e['muscle_roles'].values() for m in group),e['id']
by_id={e['id']:e for e in exercises}
warmup_by_id={r['id']:r for r in warmups['routines']}
programs=[]
for source in program_catalog['programs']:
    warmup=warmup_by_id[source['warmupRoutineId']]
    program={**source,'mode':'classic','rounds':1,'blockOrder':['echauffement','renforcement','mobilisation','etirements']}
    program['items']=[{'band':'','tempo':'',**item,'id':source['id']+'-'+str(i)} for i,item in enumerate(warmup['items']+source['items'])]
    assert all(m in strength['muscles'] for m in source['targetMuscles']),source['id']
    assert all(s in sources for s in source['source_ids']),source['id']
    assert any(i['block']=='etirements' for i in program['items']),source['id']
    for i in program['items']:
        e=by_id[i['exerciseId']]
        assert i['block'] in program['blockOrder'],source['id']
        assert 1<=i['sets']<=20 and 0<=i['rest']<=3600 and i['load']==0,source['id']
        assert i['duration']>0 if e['execution_mode']=='duree' else i['reps']>0,(source['id'],e['id'])
        if i['block']!='renforcement':assert i['loadMode']=='none',(source['id'],e['id'])
        if i['block'] in ['mobilisation','etirements']:assert e['category']==i['block'],(source['id'],e['id'])
    programs.append(program)
assert len({p['id'] for p in programs})==len(programs)
muscles={**strength['muscles'],'avant_bras':'Muscles de l’avant-bras'}
app_version=json.loads((ROOT/'package.json').read_text())['version']
data={'version':app_version,'exercises':exercises,'muscles':muscles,'sources':list(sources.values()),'adviceSources':advice['sources'],'adviceRules':advice['rules'],'routines':routines,'warmupFilters':warmups['filters'],'warmupUseNotes':warmups['use_notes'],'warmupDurationNote':warmups['duration_note'],'sessionPrograms':programs,'sessionProgramNotes':program_catalog['useNotes']}
manifest=json.loads((DIST/'manifest.webmanifest').read_text())
manifest['icons']=[{'src':'assets/icon-192.png','sizes':'192x192','type':'image/png','purpose':'any'},{'src':'assets/icon-512.png','sizes':'512x512','type':'image/png','purpose':'any'},{'src':'assets/icon.svg','sizes':'any','type':'image/svg+xml'}]
(DIST/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False))
shell=['./','index.html','css/app.css','css/v3.css','css/library-v3.css','css/programs.css','js/install.js','js/data.js','js/core.js','js/storage.js','js/body.js','js/app.js','manifest.webmanifest','assets/icon.svg','assets/icon-192.png','assets/icon-512.png']
missing=[name for name in shell if name not in ['./','js/data.js'] and not (DIST/name).is_file()]
assert not missing,'Missing service-worker shell files: '+', '.join(missing)
core_files=[p for p in DIST.rglob('*') if p.is_file() and p.suffix in ['.css','.js','.html','.webp','.webmanifest','.svg','.png','.pdf'] and p.name not in ['data.js','sw.js'] and not p.name.startswith('qa-')]
digest=hashlib.sha256(json.dumps(data,ensure_ascii=False,sort_keys=True).encode())
# Include filenames and build logic as well as all served assets. Manifest-only,
# icon-only and service-worker changes must produce a new cache generation.
digest.update(Path(__file__).read_bytes())
for p in sorted(core_files):
    digest.update(p.relative_to(DIST).as_posix().encode()+b'\0')
    digest.update(p.read_bytes())
version=digest.hexdigest()[:12]
data['cacheVersion']=version
(DIST/'js/data.js').write_text('window.RENFO_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n'+
    "window.RENFO_DATA.cacheName = 'renfo@'+encodeURIComponent(new URL('./', document.baseURI).pathname)+':assets-'+window.RENFO_DATA.cacheVersion;\n")
asset_revisions={p.relative_to(DIST).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
    for p in sorted((DIST/'assets').rglob('*')) if p.is_file()}
sw='''const VERSION=__VERSION__;
const BASE=new URL('./',self.location.href),PREFIX='renfo@'+encodeURIComponent(BASE.pathname)+':';
const SHELL=PREFIX+'shell-'+VERSION,ASSETS=PREFIX+'assets-'+VERSION;
const FILES=__SHELL__;
const ASSET_REVISIONS=__REVISIONS__;
const inScope=url=>url.origin===BASE.origin&&url.pathname.startsWith(BASE.pathname);
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES))));
// No skipWaiting: a session keeps its version until every open Renfo tab closes.
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys(),assets=await caches.open(ASSETS);
  const oldAssets=keys.filter(key=>key!==ASSETS&&(key.startsWith(PREFIX+'assets-')||/^renfo-assets-/.test(key)));
  // Migrate only byte-identical assets. The legacy cache has no revision table,
  // and URL equality alone is unsafe when an illustration has been replaced.
  for(const name of oldAssets){
    const previous=await caches.open(name);
    for(const request of await previous.keys()){
      const url=new URL(request.url);
      if(!inScope(url))continue;
      const path=url.pathname.slice(BASE.pathname.length),expected=ASSET_REVISIONS[path];
      if(!expected)continue;
      const canonical=new URL(path,BASE).href;
      if(await assets.match(canonical))continue;
      try{
        const response=await previous.match(request);
        if(!response?.ok)continue;
        const bytes=await response.clone().arrayBuffer();
        const digest=await crypto.subtle.digest('SHA-256',bytes);
        const actual=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
        if(actual===expected)await assets.put(canonical,response);
      }catch(_){/* A missing or invalid cached image can be downloaded again. */}
    }
  }
  for(const key of keys){
    if(key===SHELL||key===ASSETS)continue;
    if(key.startsWith(PREFIX)){await caches.delete(key);continue;}
    // Retire pre-v3 caches only if every entry belongs to this installation.
    // Another Renfo deployment on this origin keeps its own cached resources.
    if(/^renfo-(shell|assets)-/.test(key)){
      const old=await caches.open(key),requests=await old.keys();
      if(requests.length&&requests.every(request=>inScope(new URL(request.url))))await caches.delete(key);
    }
  }
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||!inScope(url))return;
  event.respondWith((async()=>{
    const shell=await caches.open(SHELL),assets=await caches.open(ASSETS);
    const cached=await shell.match(req,{ignoreSearch:true})||await assets.match(req,{ignoreSearch:true});
    if(cached)return cached;
    try{
      const response=await fetch(req),path=url.pathname.slice(BASE.pathname.length);
      if(response.ok&&ASSET_REVISIONS[path])await assets.put(new URL(path,BASE).href,response.clone());
      return response;
    }catch(error){
      if(req.mode==='navigate')return await shell.match(new URL('index.html',BASE).href)||Response.error();
      return Response.error();
    }
  })());
});
'''
(DIST/'sw.js').write_text(sw.replace('__VERSION__',json.dumps(version)).replace('__SHELL__',json.dumps(shell)).replace('__REVISIONS__',json.dumps(asset_revisions,separators=(',',':'))))
print(json.dumps({'exercises':len(exercises),'illustrated':sum(bool(e.get('image')) for e in exercises),'routines':len(routines),'session_programs':len(programs),'sources':len(sources),'cache_version':version}))
