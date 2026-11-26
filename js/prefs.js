// Damamondo – le Impostazioni ricordate in questo telefono (musica, effetti sonori, animazioni, vibrazione, dettagli).
(function (DM) {
  'use strict';
  const KEY = 'damamondo-impostazioni';
  const DEF = { music: true, volume: .6, sfx: true, sfxVol: .7, anim: true, vibra: true, detail: true };
  const read = () => {
    try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEF); }
  };
  let s = read();
  const subs = [];
  DM.Prefs = {
    DEF,
    get: k => s[k],
    all: () => Object.assign({}, s),
    set(patch) {
      Object.assign(s, patch);
      try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* senza memoria: vale solo per questa visita */ }
      subs.forEach(f => f(s));
    },
    on: f => { subs.push(f); }
  };
})(globalThis.DM = globalThis.DM || {});
