(function () {
  'use strict';
  let deferredPrompt = null, installing = false, installedHere = false;
  const listeners = new Set();
  const standalone = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)') : null;
  const ua = navigator.userAgent || '';
  // The platform only selects help text; native support is detected by its event.
  const ios = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const platform = ios ? 'ios' : /Android/i.test(ua) ? 'android' : 'desktop';
  function getState() {
    const installed = installedHere || navigator.standalone === true || !!standalone?.matches;
    return Object.freeze({
      installed,
      canPrompt: !installed && !!deferredPrompt && !installing,
      busy: installing,
      platform,
      secureContext: window.isSecureContext === true
    });
  }
  function notify() {
    const state = getState();
    listeners.forEach(listener => { try { listener(state); } catch (error) { console.error(error); } });
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    if (!getState().installed) deferredPrompt = event;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedHere = true;
    notify();
  });
  if (standalone?.addEventListener) standalone.addEventListener('change', notify);
  else if (standalone?.addListener) standalone.addListener(notify);
  window.RenfoInstall = Object.freeze({
    getState,
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      listener(getState());
      return () => listeners.delete(listener);
    },
    async requestInstall() {
      if (getState().installed) return {status: 'installed', platform};
      if (!deferredPrompt || installing) return {status: 'guide', platform};
      const prompt = deferredPrompt;
      // Consume before awaiting: double taps and refusals cannot reuse this event.
      deferredPrompt = null;
      installing = true;
      notify();
      try {
        const result = await prompt.prompt();
        const choice = prompt.userChoice ? await prompt.userChoice : result;
        return {status: choice?.outcome === 'accepted' ? 'accepted' : 'dismissed', platform};
      } catch (_) {
        return {status: 'error', platform};
      } finally {
        installing = false;
        notify();
      }
    }
  });
})();
