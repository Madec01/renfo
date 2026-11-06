(function () {
  'use strict';
  const regions = {
    front: [
      ['deltoide_anterieur deltoide_moyen','Épaule','M75 97 Q48 99 46 130 L61 135 79 115Z'],
      ['pectoraux','Pectoraux','M79 101 Q93 96 99 107 L98 136 Q77 144 63 126Z'],
      ['biceps brachial','Bras','M47 134 L61 139 57 177 42 174Z'],
      ['triceps','Arrière du bras','M42 131 L46 134 41 176 35 169Z'],
      ['avant_bras brachio_radial','Avant-bras','M41 179 L55 182 46 217 33 223 34 207Z'],
      ['droit_abdomen','Abdominaux','M86 143 L98 144 98 204 86 199Z'],
      ['transverse obliques dentelle_anterieur','Flanc','M64 140 L80 146 82 203 69 216 68 180Z'],
      ['flechisseurs_hanche','Pli de hanche','M71 214 L96 219 92 240 77 230Z'],
      ['quadriceps','Avant de cuisse','M66 233 L86 240 88 285 82 309 65 308 60 269Z'],
      ['adducteurs','Intérieur de cuisse','M89 242 L99 231 99 278 90 307 87 283Z'],
      ['tenseur_fascia_lata moyen_petit_fessier','Côté de hanche','M61 220 L69 219 67 251 59 258Z'],
      ['gastrocnemiens soleaire','Mollet','M65 327 L82 328 80 365 74 393 63 391 60 361Z'],
    ],
    back: [
      ['trapeze_superieur','Haut du dos','M88 80 L98 83 98 122 71 105Z'],
      ['trapeze_moyen rhomboides','Entre les omoplates','M80 113 L98 128 98 148 78 143Z'],
      ['trapeze_inferieur','Bas des omoplates','M81 147 L98 151 98 178Z'],
      ['deltoide_posterieur deltoide_moyen coiffe_rotateurs','Épaule','M73 100 Q48 101 45 128 L60 139 78 115Z'],
      ['triceps','Arrière du bras','M46 137 L61 140 54 179 39 175Z'],
      ['avant_bras brachio_radial','Avant-bras','M39 180 L54 183 46 219 33 224 33 207Z'],
      ['grand_dorsal','Dos','M64 143 L78 146 92 180 90 204 70 194Z'],
      ['erecteurs_rachis multifides','Lombaires','M92 153 L98 157 98 211 92 211Z'],
      ['carre_lombes obliques','Flanc lombaire','M70 198 L87 207 88 222 68 218Z'],
      ['grand_fessier moyen_petit_fessier','Fessier','M65 224 Q80 217 98 225 L98 257 Q83 275 64 256Z'],
      ['ischio_jambiers','Arrière de cuisse','M63 264 Q77 276 96 265 L87 310 64 310 60 284Z'],
      ['adducteurs','Intérieur de cuisse','M94 266 L99 265 98 286 91 307 87 309Z'],
      ['gastrocnemiens','Mollet','M64 327 Q73 320 83 329 L82 356 75 373 62 361Z'],
      ['soleaire','Bas du mollet','M62 365 L74 376 80 361 75 391 65 392Z'],
    ]
  };
  const silhouette = 'M87 72 Q81 66 81 49 Q80 27 100 26 Q120 27 119 49 Q119 66 113 72 L114 87 Q128 93 140 97 Q153 101 158 120 L165 168 174 209 175 227 Q174 236 168 232 L164 218 161 235 Q157 242 153 235 L150 218 145 191 139 174 135 152 133 190 Q139 213 142 238 L142 278 137 311 139 340 134 377 132 401 Q148 412 139 419 L116 419 Q110 415 115 400 L116 370 115 340 111 314 104 282 100 267 96 282 89 314 85 340 84 370 85 400 Q90 415 84 419 L61 419 Q52 412 68 401 L66 377 61 340 63 311 58 278 58 238 Q61 213 67 190 L65 152 61 174 55 191 50 218 47 235 Q43 242 39 235 L36 218 32 232 Q26 236 25 227 L26 209 35 168 42 120 Q47 101 60 97 Q72 93 86 87Z';
  function escape(v) { return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function roleFor(ids, roles) {
    const a = ids.split(' ');
    for (const role of ['primary','assistance','stabilization']) if (a.some(id => roles[role]?.includes(id))) return role;
    return '';
  }
  function figure(view, roles, options = {}) {
    const interactive = options.interactive;
    const paths = regions[view].map(([ids,label,d]) => {
      const role = roleFor(ids, roles);
      return [false,true].map(mirror => `<path d="${d}" ${mirror?'transform="translate(200 0) scale(-1 1)"':''} class="muscle ${role}" ${interactive ? `data-body-region="${escape(label)}" data-body-side="${view === 'front' ? (mirror ? 'gauche':'droite') : (mirror ? 'droite':'gauche')}"` : ''}><title>${escape(label)}${role?' · '+({primary:'principal',assistance:'assistance',stabilization:'stabilisation'}[role]):''}</title></path>`).join('');
    }).join('');
    const points = (options.points || []).filter(p => p.view === view).map((p,i) => `<g class="body-point"><circle cx="${p.x*200}" cy="${p.y*440}" r="8"/><text x="${p.x*200}" y="${p.y*440+3}">${(options.points || []).indexOf(p)+1}</text></g>`).join('');
    return `<svg viewBox="0 0 200 440" class="body-svg" role="img" aria-label="Corps de ${view==='front'?'face':'dos'}${interactive?', toucher une zone pour la repérer':''}" ${interactive?`data-body-view="${view}"`:''}><path d="${silhouette}" class="body-outline"/>${paths}<path d="M100 84V262" class="body-midline"/>${points}<text x="100" y="438" class="body-caption">${view==='front'?'FACE':'DOS'}</text></svg>`;
  }
  function maps(roles = {}, options = {}) {
    return `<div class="body-pair ${options.compact?'compact':''}">${figure('front', roles, options)}${figure('back', roles, options)}</div>`;
  }
  function rolesFromTotals(muscles, filter = 'all') {
    const roles = {primary:[],assistance:[],stabilization:[]};
    for (const [id, data] of Object.entries(muscles)) for (const role of Object.keys(roles)) if (data[role] && (filter === 'all' || filter === role)) roles[role].push(id);
    return roles;
  }
  window.RenfoBody = {maps, figure, rolesFromTotals};
})();
