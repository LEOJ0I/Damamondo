// Damamondo – finestra delle Impostazioni (ingranaggio nel menu e in partita):
// musica (sì/no, volume), effetti sonori (sì/no, volume), animazioni e scosse, vibrazione, dettagli quando ingrandisci.
(function (DM) {
  'use strict';
  const $ = id => document.getElementById(id);
  const P = DM.Prefs;
  let back = null;   // elemento da cui si è aperta la finestra (per ridargli il fuoco alla chiusura)
  const pct = v => Math.round(v * 100);

  function show() {
    const s = P.all();
    $('setMusic').checked = s.music;
    $('setVol').value = pct(s.volume); $('setVol').disabled = !s.music; $('setVolOut').textContent = pct(s.volume) + '%';
    $('setSfx').checked = s.sfx;
    $('setSfxVol').value = pct(s.sfxVol); $('setSfxVol').disabled = !s.sfx; $('setSfxOut').textContent = pct(s.sfxVol) + '%';
    $('setAnim').checked = s.anim;
    $('setDetail').checked = s.detail;
    $('setVibra').checked = s.vibra && DM.Sfx.canBuzz;
    $('setVibra').disabled = !DM.Sfx.canBuzz;
    $('setVibraNote').textContent = DM.Sfx.canBuzz ? 'Per bombe, eruzioni e colpi' : 'Questo telefono o browser non la permette (iPhone e iPad)';
  }
  function open(from) { back = from || null; show(); $('settings').hidden = false; $('setClose').focus(); }
  function close() { $('settings').hidden = true; if (back && document.contains(back)) back.focus(); }
  const redraw = () => { if (DM.redraw && !$('game').hidden) DM.redraw(); };

  DM.startSettings = function () {
    document.addEventListener('click', e => { const g = e.target.closest('[data-settings]'); if (g) open(g); });
    $('setClose').onclick = close;
    $('settings').addEventListener('click', e => { if (e.target === $('settings')) close(); });   // tocco fuori dal riquadro
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('settings').hidden) close(); });
    $('setMusic').onchange = e => { DM.Music.setEnabled(e.target.checked); show(); };
    $('setVol').oninput = e => { DM.Music.setVolume(e.target.value / 100); show(); };
    $('setSfx').onchange = e => { DM.Sfx.setEnabled(e.target.checked); show(); if (e.target.checked) DM.Sfx.play('select'); };
    $('setSfxVol').oninput = e => { DM.Sfx.setVolume(e.target.value / 100); show(); };
    $('setSfxVol').onchange = () => DM.Sfx.play('coins');   // per sentire il volume nuovo
    $('setAnim').onchange = e => { P.set({ anim: e.target.checked }); show(); };
    $('setVibra').onchange = e => { P.set({ vibra: e.target.checked }); show(); if (e.target.checked) DM.Sfx.buzz('hit'); };
    $('setDetail').onchange = e => { P.set({ detail: e.target.checked }); show(); redraw(); };
  };
  DM.openSettings = open;
})(globalThis.DM = globalThis.DM || {});
