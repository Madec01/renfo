(function () {
  'use strict';
  let db, queue = Promise.resolve();
  const KEY = 'renfo-state-v1';
  const storage = window.RenfoStorage = {mode: 'IndexedDB', error: null};
  storage.open = async function () {
    try {
      db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('renfo', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('state');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Une autre fenêtre bloque la base.'));
      });
      db.onversionchange = () => { db.close(); storage.error = 'Recharge cette page pour mettre à jour le stockage.'; };
      return await new Promise((resolve, reject) => {
        const req = db.transaction('state').objectStore('state').get(KEY);
        req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error);
      });
    } catch (e) {
      storage.mode = 'Stockage navigateur';
      try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
      catch { storage.mode = 'Mémoire temporaire'; storage.error = 'Stockage indisponible : exporte tes données avant de fermer.'; return null; }
    }
  };
  storage.save = function (state) {
    const snapshot = structuredClone(state);
    queue = queue.catch(() => {}).then(async () => {
      if (!db) { localStorage.setItem(KEY, JSON.stringify(snapshot)); return; }
      await new Promise((resolve, reject) => {
        const tx = db.transaction('state', 'readwrite');
        tx.objectStore('state').put(snapshot, KEY);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Écriture interrompue'));
      });
    });
    return queue;
  };
  storage.flush = () => queue;
})();
