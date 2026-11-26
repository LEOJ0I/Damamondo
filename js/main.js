// Damamondo – avvio della pagina: comandi del gioco pronti, poi il menu.
(function (DM) {
  'use strict';
  DM.Music.init();
  DM.Sfx.init();
  DM.startSettings();
  DM.startUI();
  DM.startMenu();
  // app installabile: il gioco funziona anche senza internet (solo sul sito vero, in https o in prova su localhost)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* dentro alcune pagine non è permesso: il gioco funziona lo stesso */ }
  }
})(globalThis.DM = globalThis.DM || {});
