// Damamondo – finestra delle Impostazioni (ingranaggio nel menu e in partita). Per ora: musica sì/no e volume.
(function (DM) {
  'use strict';
  const $ = id => document.getElementById(id);
  let back = null;   // elemento da cui si è aperta la finestra (per ridargli il fuoco alla chiusura)

  function show() {
    const s = DM.Music.settings;
    $('setMusic').checked = s.music;
    $('setVol').value = Math.round(s.volume * 100);
    $('setVol').disabled = !s.music;
    $('setVolOut').textContent = Math.round(s.volume * 100) + '%';
  }
  function open(from) { back = from || null; show(); $('settings').hidden = false; $('setClose').focus(); }
  function close() { $('settings').hidden = true; if (back && document.contains(back)) back.focus(); }

  DM.startSettings = function () {
    document.addEventListener('click', e => { const g = e.target.closest('[data-settings]'); if (g) open(g); });
    $('setClose').onclick = close;
    $('settings').addEventListener('click', e => { if (e.target === $('settings')) close(); });   // tocco fuori dal riquadro
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('settings').hidden) close(); });
    $('setMusic').onchange = e => { DM.Music.setEnabled(e.target.checked); show(); };
    $('setVol').oninput = e => { DM.Music.setVolume(e.target.value / 100); show(); };
  };
  DM.openSettings = open;
})(globalThis.DM = globalThis.DM || {});
