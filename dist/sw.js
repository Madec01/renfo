const VERSION="9263ed164dac";
const BASE=new URL('./',self.location.href),PREFIX='renfo@'+encodeURIComponent(BASE.pathname)+':';
const SHELL=PREFIX+'shell-'+VERSION,ASSETS=PREFIX+'assets-'+VERSION;
const FILES=["./", "index.html", "css/app.css", "css/v3.css", "css/library-v3.css", "css/programs.css", "js/install.js", "js/updates.js", "js/data.js", "js/core.js", "js/storage.js", "js/body.js", "js/app.js", "manifest.webmanifest", "assets/icon.svg", "assets/icon-192.png", "assets/icon-512.png"];
const ASSET_REVISIONS={"assets/Fiches_initiales.pdf":"d2914e5c31bafa92af283466a13f68667c7c159e38ef4a8980586136a47918c5","assets/exercises/abduction-hanche-couchee.webp":"3fd0f8c61895172ee9ef120230a0e8142883e0e18ec3878ecedc197c8d59fded","assets/exercises/adduction-hanche-couchee.webp":"ac56e53ff385d245f0f0b2a7298f525bc175b7acf87c2f6f00479237da2f16ca","assets/exercises/bird-dog.webp":"44db4763a3083b179b6129fd304d064006ae94d8b533dfa0d47721ba3bda3921","assets/exercises/coquillage.webp":"8b0796d93439b936a7be26083357076a81e61d9e6aafff78a2fa6b2acf68b45b","assets/exercises/crunch-inverse.webp":"c1d43ed3649e7e3c53707ba390266ca428acd25cda93ab2101dd334aaf58f15a","assets/exercises/crunch.webp":"b3db76b08faa45c8ef52dff8f884a9fcce0d7637bcbf7fdb44a802effca8b9f0","assets/exercises/curl-concentration.webp":"edb3ddc491448a82dacf792154ebcaaff2cf4fbf2d038000bf3defe059878b62","assets/exercises/curl-marteau.webp":"acc94d0f712af0ba0dd178fea77be6846a974bae4b4fe8980b67e1b72aa21b2c","assets/exercises/curl-supination.webp":"e3fb8fc1fb3276d459083dd99e4370a3a314ef2b840a99edadf09f377c67c03e","assets/exercises/deadbug.webp":"94613ac709c494210b5d399235eb91173725b2c3b5a53b443b891fd40a17b5f3","assets/exercises/developpe-epaules.webp":"810afd9deaa8849f618164730214093d259981ba8392384e662e8396108d9704","assets/exercises/developpe-sol.webp":"0714f558fc38eb5f32bab0e27b4c37824e8c27b8982ce4bf7c22f28ddd8f1369","assets/exercises/elevations-laterales.webp":"f73ce94e64f6ee76a656f1dbfab764134c88c3277b8be5ebe87ba0631507f5af","assets/exercises/epaule-developpe.webp":"c9b7ec8fa65641607236212fee6f3e6dc724a99a95ef16115a75ec223f569474","assets/exercises/extension-triceps-dessus-tete.webp":"39a0e0fd2397cd61d1ff54bc13a6156a7d9476f819a0a1b69cab0a328724d2ae","assets/exercises/extension-triceps-kickback.webp":"cbc2b240b7b03648046723d9e638148a161bec7109d8820cb922c7929db44cb9","assets/exercises/fente-arriere.webp":"85b06bb6426a4189d277901b8e0e15a45b2a2d727a6a5c7be5455538525a9cab","assets/exercises/fente-laterale.webp":"aee5fd387acd7b84983372b7f758863874df9975fcb1a4be77afe42ab2841042","assets/exercises/marche-fermier.webp":"4a36fc2e448ebf3f069b0b09e965d18d9f5c1b19f5f7d8d8ffc7629745a4d413","assets/exercises/marche-valise.webp":"f39c106eb4d752680a875019038531e46b3c873717fb3d7a43eacedfbf55694d","assets/exercises/mob-anges-mur.webp":"228b4ef1375cb699fbf3290d26b5b46d2fc7d0431e539e6a78ff5e030ea33e19","assets/exercises/mob-chat-vache.webp":"86f42d4b766f754d2ce36a2933e114b3b42ece3ad77ba1c09433e121074ba999","assets/exercises/mob-cheville-demi-genou.webp":"9a7865531815afd362844f10e96e7d116b0a2ec9a2f8f4d3ee0f593188a3f85d","assets/exercises/mob-chevilles-cercles.webp":"624148ec9af8ad5c8348d420a78f07240ee013016d53fffb48576269035f7e49","assets/exercises/mob-chevilles-flexion.webp":"a78b5b7385f1f16d0eb30ba2c537ad025d0f4a80efe2a69836e073859be31a1e","assets/exercises/mob-epaule-controlee.webp":"7cb0d44244683826586e10f8044615fb8f561202efb9691728f07b640f546885","assets/exercises/mob-hanches-90-90.webp":"195baac147fc96ab35f6f9516691466dc7bafa7e3da26efb311a7ebd904ee4dd","assets/exercises/mob-livre-ouvert.webp":"e3355c8349b61cf72d090eec24c7a8137433210fa6345e76f4989870cb95deb2","assets/exercises/mob-nuque-rotation.webp":"62bba9b9831cfef325b05a3641bffbca09c6986ecfcf4d67e4e2ec4c8945cc77","assets/exercises/mob-rotation-assise.webp":"7700c76ebf5a016e59e6dbda4294c4de1a087e6607dc1946972cb461f9ed8d3d","assets/exercises/mob-rotation-demi-genou.webp":"d9fbc6c0f9f57d30bd4ac48d2c39673d334e3f8f861d7a909601f5d1fc09d9a6","assets/exercises/mob-roules-epaules.webp":"34f1143c5627377ba99dcb6c5a6547d32f86a7ccdb56b34972d08faeec8e9346","assets/exercises/mollets-debout.webp":"2eb020c469330376aa0f38f95da6ea8979a385e464bbae49499a98a5a589d981","assets/exercises/mollets-unilateral.webp":"bcdc769795ef4e54f8a4935d17a62f4c7eb526801aca56df6223d5f5056bb3ec","assets/exercises/montee-marche.webp":"2b057a0d7efe0fab7dc11d49b09862e981b0881b229a491e913e5a9ab8fdecab","assets/exercises/oiseau.webp":"c2b66ef423f95775367402a98a24a88a4932f93cf4d88759df4249c653850c16","assets/exercises/ours-statique.webp":"6307ae47e8470f47b411966e3aa94a9c85b1d56ea77d92b98f81641b9750aa83","assets/exercises/pallof-press.webp":"979717f28c5e0a109c5d837248bf764fdff1c41e38f80762759b738a685e7aeb","assets/exercises/planche-laterale-genoux.webp":"df6abbc15749d7d448a9c3014a8a02978fdf59509cf8f5c997f106f893ca8a0a","assets/exercises/planche-laterale.webp":"8036ff31ec64ca667e9ff6d74ad1e208a1ac79147de7175a0af77441fbba5269","assets/exercises/planche.webp":"dba00a58f3549efd385f6661f75ef0ebe1bf8465c7309dbc14666247fcc938aa","assets/exercises/pompes-genoux.webp":"00c0e65007dbba89ccc46f2d3c0531de5b27e44214d6627b3bc09f8fbdd0810c","assets/exercises/pompes-inclinees.webp":"e2f9096d167d217df886b6ca40a467ba594a868a8a472e35d63f63c479db2a4b","assets/exercises/pompes-mur.webp":"e45573aeaf7ed38767d89ed86340caf83379d0422911defbb6caf07ba9f195a1","assets/exercises/pompes-pique.webp":"e37f1b81c38301a9e814cf48ec7f8695799d22b803e0aa9cf5896ad1c489a2d3","assets/exercises/pompes.webp":"9941c3e49dee5e1125359209b79943d8bd2e7662012ae9cf7dfa376ddcef0f9a","assets/exercises/pont-fessier-unilateral.webp":"1198ef5eaae559ec01a45f0c8e9921d9ff1d84383b65243d286d4f48fc477e60","assets/exercises/pont-fessier.webp":"c0a890a10c883bff724f3961022d079542c76dd56c1f46589f08bce862c532b3","assets/exercises/prep-flexions.webp":"9a6723c3cc5c8ed682a593d2f15598fee26c41625b1385d12d7bde6a3e84ba91","assets/exercises/prep-genoux.webp":"1cc060a3384490203135c4a829f6ecfe245e4d77a797c7aae2a1fae3f0565fa5","assets/exercises/prep-marche.webp":"5ce27f5fbb6f7ad570993ecc309afe0f8361c526a1019a2dd95fb2bddf33cd79","assets/exercises/prep-talons.webp":"d1b983a96e09d0cff5be862c2d1f60d062e7ad37256558c3c2dc1e2cb6cc3e85","assets/exercises/rowing-elastique.webp":"fe599ae304d3d8132dd03e91200492f6dfc93e0e49deeab90315a29a6dd5383b","assets/exercises/rowing-penche.webp":"6cbf6ddf0c999fd8227196f7da5606c2925e10ac1cca3097a9a62bac8e5bfa01","assets/exercises/rowing-unilateral.webp":"351d935e844a3f679b7551f66674e8d0f3343f327c50f28ed9fa39ce61cec2d6","assets/exercises/scaption.webp":"41b73873f166deb810fa2dd94b31965cef7bb50f80b6a2c91799d559f5dab95e","assets/exercises/souleve-terre-roumain-unilateral.webp":"8016ad954bf39ccfbe660e2cba42952267c98f2aa2cce60ce573fef821bb480c","assets/exercises/souleve-terre-roumain.webp":"9c9ac4a9f6fe679c812e286bd961208e56c7acedfdc04206cfd24e1b14747e48","assets/exercises/split-squat.webp":"ce559127fd0bb9e67024dc93cfd7dd6507153ba28b7a972e5819d9aa98c3211c","assets/exercises/squat-goblet.webp":"e65fe6586916655dc4e86db3e7f5d2110e456aa391623f1c2bb8d716fff09cbc","assets/exercises/squat-mur.webp":"cc2f4b120cd8e9c1cee818ec5e4cab70089ddefff37ea21e8b96ecf45ef47434","assets/exercises/squat-poids-corps.webp":"3405f437d5df6b087c1467b43bb4167004e8e30f9fc3d3b5a751dc15ce6f50e8","assets/exercises/stretch-adducteurs.webp":"7a9ded5881fcbe13a01e10797863c566404bdd4a1905b8b430d4b4650991aa28","assets/exercises/stretch-biceps.webp":"00c1b6b5a786b1b1593bbc0b5a1663a09d42531d4cbf0531be59e9834d6dfb7b","assets/exercises/stretch-epaule.webp":"19a8ed590a4ac4788d32c244b755af9cc9531e020c0168ed9268379e0f6eda4c","assets/exercises/stretch-fessiers.webp":"da077b36fee68bc635d25b0ed2dc8a9bc65485eba0d4643e2c610fbe92549361","assets/exercises/stretch-grand-dorsal.webp":"16477dcb398ce039898746bb6bd67e2d49fc9182f8d67180fa3c1bfa8120fb1b","assets/exercises/stretch-hanche-avant.webp":"a6f49c89bfdad271feb5d6f05d66a1bb707aed9b94caea232b7992a93c45f046","assets/exercises/stretch-ischios.webp":"4bbfdd8109b12eab214cb1048652d2f9aa6ddbeef7434b9d21b404ebbfddb9dc","assets/exercises/stretch-mollet-flechi.webp":"82521aa9033c4a61d0bf95c3e368717d9843b049c860e90d69a15b0a765aba04","assets/exercises/stretch-mollet-tendu.webp":"d26fcd86f8a8c3cb30a6f0d30857fe76714304c1ff6d1bc4457a2a22f88aa256","assets/exercises/stretch-pectoraux.webp":"16f20d3b0aa50eb0361b0a083fd9548ca45fc1e57c4476237e148c086fc7f7ac","assets/exercises/stretch-poignet-extenseurs.webp":"6d93e8e6a22ebb40236699b8cd3af9b2380f664b8d339157c2118355fc9c4ffb","assets/exercises/stretch-poignet-flechisseurs.webp":"0716dfab9cb3c744d1250b05e51cc539e21b65a7717c0b481c963f2ac6b942ce","assets/exercises/stretch-poitrine-assis.webp":"326d464fd5601b598a0c2bc25dadd17eb6c7845cd1f949036ab69ba404e76270","assets/exercises/stretch-quadriceps.webp":"75b5419794d5656db06a8f6cbbe324d43180c315b25d35a370e3d2c8260a5727","assets/exercises/stretch-triceps.webp":"2959fa208384c9272fed8eb03e392f4fd5e767b7ee35e511a6b7693a67fd39db","assets/exercises/t-sol.webp":"ee2941043fb0bd7e6ef750c9830a6a947d5b11a6d5ea65ef7bebab8449ec52b5","assets/exercises/tirage-vertical-elastique.webp":"302e330abfb19d6041e640a40ce1d494600ad2ae3aa4d9571fae8f272f5a8eb3","assets/exercises/w-sol.webp":"50fdbba27ccb30b4a225251bc85f3e65dca57510fa79bfb88a8eb85085d32255","assets/exercises/y-sol.webp":"25bf68e25f4fac2be14e9b7e435278edc1480e8301df0c6bcffe714a8ced559e","assets/icon-192.png":"b169ae87ae34a41a4b3bd3c7bb018f95d119a2a182d36e3779fc76ae95af5372","assets/icon-512.png":"8ee3fefc8efcc4bf34acfb7963d5481f72f81082bfc538841d75575747568e84","assets/icon.svg":"c89d5bc0b9809f7dc9a7c60e86a5d91f2df2806fbb2014502e15de0365d758f6"};
const inScope=url=>url.origin===BASE.origin&&url.pathname.startsWith(BASE.pathname);
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(SHELL);
  // Download a complete fresh shell before activating, independently of the HTTP cache.
  await cache.addAll(FILES.map(path=>new Request(new URL(path,BASE).href,{cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')event.waitUntil(self.skipWaiting());
  if(event.data?.type==='GET_VERSION')event.source?.postMessage({type:'RENFO_VERSION',version:VERSION});
});
// Loaded pages keep their forms until the client updater can reload safely.
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
