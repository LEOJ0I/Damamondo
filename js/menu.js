// Damamondo – menu iniziale: Gioca (Locale / Multiplayer), Regole; le 3 partite salvate nel telefono.
(function (DM) {
  'use strict';
  const $ = id => document.getElementById(id);
  const MAX = 3, KEY = 'damamondo-partite', OLD = 'damamondo-auto';

  // ---- le partite salvate (al massimo 3) ----
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  };
  const read = () => { try { return JSON.parse(store.get(KEY) || '[]'); } catch (e) { return []; } };
  DM.Slots = {
    MAX,
    list: () => read().sort((a, b) => b.when - a.when),
    put(id, text) {
      const l = read(), s = l.find(z => z.id === id);
      if (s) { s.text = text; s.when = Date.now(); } else l.push({ id, when: Date.now(), text });
      return store.set(KEY, JSON.stringify(l));
    },
    create(text) {
      const l = read();
      if (l.length >= MAX) return null;
      const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
      return this.put(id, text) ? id : null;
    },
    remove(id) { store.set(KEY, JSON.stringify(read().filter(z => z.id !== id))); }
  };
  // la partita salvata dalla versione precedente diventa la prima delle 3
  if (store.get(KEY) === null && store.get(OLD)) { DM.Slots.create(store.get(OLD)); }

  const when = t => new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const b = (m, label, cls, arg) => `<button type="button" class="big${cls ? ' ' + cls : ''}" data-m="${m}"${arg !== undefined ? ` data-arg="${arg}"` : ''}>${label}</button>`;
  const title = '<h1 class="title">DAMAMONDO<small>Classico</small></h1>';
  let msg = '', np = 2, asking = null;   // asking: partita di cui si chiede conferma per eliminarla

  const SCREENS = {
    home: () => title + '<div class="stack">' + b('gioca', 'Gioca', 'go') + b('regole', 'Regole') + '</div>',
    gioca: () => title + '<div class="stack">' + b('locale', 'Locale', 'go') + b('multi', 'Multiplayer') + b('home', '← Indietro', 'back') + '</div>',
    multi: () => title + '<div class="card soon"><b>Coming soon</b><p>Il multiplayer arriverà più avanti.</p></div><div class="stack">' + b('gioca', '← Indietro', 'back') + '</div>',
    locale: () => {
      const l = DM.Slots.list();
      const cards = l.map((s, i) => {
        const a = DM.saveSummary(s.text) || {};
        const state = a.phase === 'play' ? `giro ${a.round} · tocca a ${a.turn}` : 'in preparazione';
        const info = `<div><b>Partita ${i + 1}</b><br><small>${a.np} giocatori · ${state}<br>salvata ${when(s.when)}</small></div>`;
        if (asking === s.id) return `<div class="card slot ask">${info}<p class="warn">Eliminare questa partita? Non si può tornare indietro.</p>` +
          `<div class="r">${b('eliminaSi', 'Sì, elimina', 'small danger', s.id)}${b('eliminaNo', 'No', 'small')}</div></div>`;
        return `<div class="card slot">${info}<div class="r">${b('continua', 'Continua', 'go', s.id)}${b('elimina', 'Elimina', 'small', s.id)}</div></div>`;
      }).join('');
      return '<h2>Partite in questo telefono</h2>' + (msg ? `<p class="msg">${msg}</p>` : '') +
        (cards || '<p>Nessuna partita salvata.</p>') +
        '<div class="stack">' + (l.length < MAX ? b('nuova', 'Nuova partita', l.length ? '' : 'go') : `<p class="note">Hai già ${MAX} partite: eliminane una per iniziarne un’altra.</p>`) +
        (l.length < MAX ? '<label class="big file">Apri da file<input type="file" id="menufile" accept=".json,application/json"></label>' : '') +
        b('gioca', '← Indietro', 'back') + '</div>';
    },
    nuova: () => '<h2>Nuova partita</h2>' + (msg ? `<p class="msg">${msg}</p>` : '') +
      '<div class="card"><b>Quanti giocatori?</b><div class="r">' + [2, 3, 4, 5, 6].map(n => `<button type="button" class="np${n === np ? ' on' : ''}" data-m="np" data-arg="${n}" aria-pressed="${n === np}">${n}</button>`).join('') + '</div></div>' +
      `<div class="card"><b>La mappa</b><div class="opts">
        <label>Isole <select id="isl"><option value="0">Poche</option><option value="1" selected>Medie</option><option value="2">Tante</option></select></label>
        <label>Umidità <select id="hum"><option value="0">Bassa</option><option value="1">Medio bassa</option><option value="2" selected>Media</option><option value="3">Medio alta</option><option value="4">Alta</option></select></label>
        <label>Temperatura <select id="tmp"><option value="0">Calda</option><option value="1">Medio calda</option><option value="2" selected>Media</option><option value="3">Medio fredda</option><option value="4">Fredda</option></select></label>
        <label>Varietà dei biomi <select id="cmp"><option value="0">Semplicissima</option><option value="1">Semplice</option><option value="2" selected>Media</option><option value="3">Estrema</option><option value="4">Estremissima</option></select></label>
        <label>Numero mappa <input type="number" id="seed" min="1" inputmode="numeric" placeholder="a caso"></label>
      </div><small>Stesse opzioni e stesso numero danno la stessa mappa.</small></div>` +
      '<div class="stack">' + b('inizia', 'Inizia', 'go') + b('locale', '← Indietro', 'back') + '</div>',
    regole: () => '<div class="stack">' + b('home', '← Menu', 'back') + '</div><h2>Regolamento</h2>' +
      '<p class="center"><a href="regole.html" target="_blank" rel="noopener">Apri le regole in una pagina a parte (da stampare o condividere)</a></p>' +
      '<div class="rules">' + DM.rulesHTML() + '</div><div class="stack">' + b('home', '← Menu', 'back') + '</div>'
  };

  let cur = 'home';
  DM.showMenu = function (screen) {
    cur = screen || 'home';
    if (cur !== 'locale') asking = null;
    $('game').hidden = true; $('menu').hidden = false;
    if (DM.Music) DM.Music.setScene('menu');
    $('menu').className = 'menu' + (cur === 'regole' ? ' long' : '');
    $('menuBody').innerHTML = SCREENS[cur]();
    msg = '';
    window.scrollTo(0, 0);
    background();
  };

  function start() {
    const opts = { isl: +$('isl').value, hum: +$('hum').value, temp: +$('tmp').value, comp: +$('cmp').value };
    const seed = Math.floor(+$('seed').value) || Math.floor(Math.random() * 9999) + 1;
    $('menuBody').innerHTML = title + '<p class="msg center">Creo la mappa…</p>';
    setTimeout(() => {
      const G = DM.newGame(opts, seed);
      DM.setPlayers(G, np);
      const slot = DM.Slots.create(DM.serialize(G));
      DM.playGame(G, slot);
      if (!slot) { DM.ui.msg = 'Attenzione: qui non riesco a salvare la partita nel telefono. Usa "Scarica file" in Salvataggi.'; DM.redraw(); }
    }, 30);
  }

  const ACT = {
    home: () => DM.showMenu('home'), gioca: () => DM.showMenu('gioca'), multi: () => DM.showMenu('multi'),
    locale: () => DM.showMenu('locale'), regole: () => DM.showMenu('regole'),
    nuova: () => { np = 2; DM.showMenu('nuova'); },
    np: n => { np = +n; document.querySelectorAll('[data-m=np]').forEach(x => { x.classList.toggle('on', +x.dataset.arg === np); x.setAttribute('aria-pressed', +x.dataset.arg === np); }); },
    inizia: start,
    continua: id => {
      const s = DM.Slots.list().find(z => z.id === id);
      try { DM.playGame(DM.deserialize(s.text), id); } catch (e) { msg = 'Questa partita non si apre: ' + e.message; DM.showMenu('locale'); }
    },
    // niente finestrine del browser (dentro alcune pagine sono bloccate): si chiede conferma nella pagina
    elimina: id => { asking = id; DM.showMenu('locale'); },
    eliminaNo: () => { asking = null; DM.showMenu('locale'); },
    eliminaSi: id => {
      asking = null;
      DM.Slots.remove(id);
      msg = DM.Slots.list().some(z => z.id === id) ? 'Non riesco a eliminarla: il telefono non lascia salvare qui.' : 'Partita eliminata.';
      DM.showMenu('locale');
    }
  };

  // sfondo: una mappa di Damamondo sfumata dietro al menu
  let bgDone = false;
  function background() {
    if (bgDone) return;
    bgDone = true;
    setTimeout(() => {
      const map = DM.makeMap({}, 7); DM.rebuildMap(map, 1);
      const img = DM.mapImage(map), cv = $('menuBg');
      cv.width = img.width; cv.height = img.height;
      cv.getContext('2d').drawImage(img, 0, 0);
    }, 50);
  }

  DM.startMenu = function () {
    $('menuBody').addEventListener('click', e => {
      const x = e.target.closest('[data-m]');
      if (x && ACT[x.dataset.m]) ACT[x.dataset.m](x.dataset.arg);
    });
    $('menuBody').addEventListener('change', e => {
      if (e.target.id !== 'menufile' || !e.target.files[0]) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const G = DM.deserialize(String(r.result));
          const slot = DM.Slots.create(String(r.result));
          DM.playGame(G, slot);
          DM.ui.msg = 'Partita aperta dal file.'; DM.redraw();
        } catch (err) { msg = 'Non riesco ad aprire il file: ' + err.message; DM.showMenu('locale'); }
      };
      r.readAsText(e.target.files[0]);
    });
    DM.showMenu('home');
  };
})(globalThis.DM = globalThis.DM || {});
