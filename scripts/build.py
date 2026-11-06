import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
DIST=ROOT/'dist'
strength=json.loads((ROOT/'content/strength.json').read_text())
prep=json.loads((ROOT/'content/preparation.json').read_text())
advice=json.loads((ROOT/'content/advice-sources.json').read_text())
concepts=json.loads((ROOT/'content/routines.json').read_text())
exercises=strength['exercises']+prep['exercises']
for e in exercises:
    if (DIST/f'assets/exercises/{e["id"]}.webp').exists(): e['image']=f'assets/exercises/{e["id"]}.webp'
    elif (DIST/f'assets/exercises/{e["id"]}.png').exists(): e['image']=f'assets/exercises/{e["id"]}.png'
sources={s['id']:s for s in strength['sources']+prep['sources']+advice['sources']}
routines=[]
for r in concepts['warmup_routine_concepts']:
    routines.append({'id':r['id'],'name':r['name'],'family':'echauffement','exerciseIds':r['preparation_ids']+r['strength_rehearsal_ids']})
routines += [
 {'id':'mob-ankle-hip','name':'Chevilles & hanches','family':'mobilisation','exerciseIds':['mob-chevilles-cercles','mob-cheville-demi-genou','mob-hanches-90-90']},
 {'id':'mob-upper','name':'Haut du dos & épaules','family':'mobilisation','exerciseIds':['mob-roules-epaules','mob-livre-ouvert','mob-anges-mur']},
 {'id':'mob-seated','name':'Tout assis','family':'mobilisation','exerciseIds':['mob-chevilles-flexion','mob-rotation-assise','mob-nuque-rotation']},
 {'id':'mob-global','name':'Mobilisation globale','family':'mobilisation','exerciseIds':['mob-chat-vache','mob-rotation-demi-genou','mob-hanches-90-90','mob-epaule-controlee']},
 {'id':'stretch-lower','name':'Bas du corps','family':'etirements','exerciseIds':['stretch-mollet-tendu','stretch-quadriceps','stretch-ischios','stretch-fessiers']},
 {'id':'stretch-upper','name':'Haut du corps','family':'etirements','exerciseIds':['stretch-epaule','stretch-pectoraux','stretch-poitrine-assis']},
 {'id':'stretch-global','name':'Corps entier','family':'etirements','exerciseIds':['stretch-mollet-flechi','stretch-hanche-avant','stretch-adducteurs','stretch-epaule','stretch-pectoraux']},
]
assert len({e['id'] for e in exercises})==76
ids={e['id'] for e in exercises}
assert all(i in ids for r in routines for i in r['exerciseIds'])
for e in exercises:
    assert all(s in sources for s in e['source_ids']),e['id']
    assert all(m in strength['muscles'] for group in e['muscle_roles'].values() for m in group),e['id']
data={'version':'1.0.0','exercises':exercises,'muscles':strength['muscles'],'sources':list(sources.values()),'adviceSources':advice['sources'],'adviceRules':advice['rules'],'routines':routines}
core_files=[p for p in DIST.rglob('*') if p.is_file() and p.suffix in ['.css','.js','.html','.webp'] and p.name not in ['data.js','sw.js']]
digest=hashlib.sha256(json.dumps(data,ensure_ascii=False).encode())
for p in sorted(core_files):digest.update(p.read_bytes())
version=digest.hexdigest()[:12]
data['cacheName']='renfo-assets-'+version
(DIST/'js/data.js').write_text('window.RENFO_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
manifest=json.loads((DIST/'manifest.webmanifest').read_text())
manifest['icons']=[{'src':'assets/icon-192.png','sizes':'192x192','type':'image/png','purpose':'any'},{'src':'assets/icon-512.png','sizes':'512x512','type':'image/png','purpose':'any'},{'src':'assets/icon.svg','sizes':'any','type':'image/svg+xml'}]
(DIST/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False))
shell=['./','index.html','css/app.css','js/data.js','js/core.js','js/storage.js','js/body.js','js/app.js','manifest.webmanifest','assets/icon.svg','assets/icon-192.png','assets/icon-512.png']
sw='''const VERSION=__VERSION__;
const SHELL='renfo-shell-'+VERSION,ASSETS='renfo-assets-'+VERSION;
const FILES=__SHELL__;
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES))));
// No skipWaiting: a session keeps its version until every open Renfo tab closes.
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('renfo-')&&k!==SHELL&&k!==ASSETS).map(k=>caches.delete(k)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cached=await caches.match(req,{ignoreSearch:true});if(cached)return cached;
    try{const response=await fetch(req);if(response.ok&&/\\.(webp|png|svg|pdf)$/.test(url.pathname)){const cache=await caches.open(ASSETS);await cache.put(req,response.clone());}return response;}
    catch(error){if(req.mode==='navigate'){const cache=await caches.open(SHELL);return await cache.match('index.html')||Response.error();}return Response.error();}
  })());
});
'''
(DIST/'sw.js').write_text(sw.replace('__VERSION__',json.dumps(version)).replace('__SHELL__',json.dumps(shell)))
print(json.dumps({'exercises':len(exercises),'illustrated':sum(bool(e.get('image')) for e in exercises),'routines':len(routines),'sources':len(sources),'cache_version':version}))
