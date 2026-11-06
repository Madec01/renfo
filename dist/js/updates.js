(function () {
  'use strict';
  let options, registration, starting, checking, applying=false, reloadPending=false, reloading=false;
  let targetVersion=null, lastCheck=0, state='idle', lastAttempt=0, listenersBound=false;
  const watched=new WeakSet();
  function notify(next) { if(state===next)return;state=next;options?.onStatus?.(next); }
  function askVersion() { navigator.serviceWorker.controller?.postMessage({type:'GET_VERSION'}); }
  function activateWaiting() { registration?.waiting?.postMessage({type:'SKIP_WAITING'}); }
  async function apply() {
    if(!reloadPending||!targetVersion||applying||reloading||document.visibilityState!=='visible')return;
    if(!options.ready()){notify('waiting');return;}
    if(Date.now()-lastAttempt<1500)return;
    lastAttempt=Date.now();applying=true;
    try {
      // The app flushes existing writes; this must not overwrite another tab's newer state.
      if(await options.beforeReload()===false){notify('blocked');return;}
      if(document.visibilityState!=='visible'||!options.ready()){notify('waiting');return;}
      const key='renfo-update-reload:'+location.pathname;
      let previous=null;
      try { previous=JSON.parse(sessionStorage.getItem(key)||'null'); } catch(_) {}
      if(previous?.from===options.version&&previous?.to===targetVersion){notify('blocked');return;}
      try {sessionStorage.setItem(key,JSON.stringify({from:options.version,to:targetVersion,at:Date.now()}));}catch(_){notify('blocked');return;}
      reloading=true;notify('reloading');location.reload();
    } catch(_) {notify('blocked');}
    finally {applying=false;}
  }
  function watch(worker) {
    if(!worker||watched.has(worker))return;watched.add(worker);
    worker.addEventListener('statechange',()=>{
      if(worker.state==='installed'){activateWaiting();askVersion();}
      if(worker.state==='activated')askVersion();
      if(worker.state==='redundant')notify('error');
    });
    if(worker.state==='installing')notify('downloading');
  }
  async function check(force=false) {
    if(!registration||reloading)return;
    activateWaiting();askVersion();
    if(navigator.onLine===false){notify('offline');return;}
    if(checking)return checking;
    if(!force&&Date.now()-lastCheck<60000)return;
    lastCheck=Date.now();notify('checking');
    checking=(async()=>{
      try {await registration.update();watch(registration.installing);activateWaiting();askVersion();if(!registration.installing&&!registration.waiting&&!reloadPending)notify('current');}
      catch(_){notify(navigator.onLine===false?'offline':'error');}
      finally {checking=null;}
    })();
    return checking;
  }
  function wake(force=false) {return registration?check(force):start(options);}
  async function start(config) {
    if(starting)return starting;
    options=config;
    if(!('serviceWorker' in navigator)||location.protocol==='file:'){notify('unsupported');return;}
    // Subscribe before registration: an update can finish while IndexedDB is opening.
    if(!listenersBound){
    listenersBound=true;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{askVersion();});
    navigator.serviceWorker.addEventListener('message',event=>{
      if(event.source!==navigator.serviceWorker.controller||event.data?.type!=='RENFO_VERSION'||typeof event.data.version!=='string')return;
      if(event.data.version===options.version){reloadPending=false;notify('current');return;}
      targetVersion=event.data.version;reloadPending=true;void apply();
    });
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){void wake();void apply();}});
    window.addEventListener('online',()=>void wake(true));
    window.addEventListener('focus',()=>{void wake();void apply();});
    }
    starting=(async()=>{
      try {
        registration=await navigator.serviceWorker.register('sw.js',{updateViaCache:'none'});
        registration.addEventListener('updatefound',()=>{watch(registration.installing);});
        watch(registration.installing);activateWaiting();askVersion();
        await check(true);
        setInterval(()=>{if(document.visibilityState==='visible')void check();},5*60*1000);
        setInterval(()=>void apply(),1500);
      } catch(_) {starting=null;notify('error');}
    })();
    return starting;
  }
  window.RenfoUpdates=Object.freeze({start,check:()=>wake(true),getState:()=>state});
})();
