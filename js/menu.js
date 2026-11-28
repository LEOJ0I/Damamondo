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

  // ---- mappe segrete trovate (obiettivo "Esploratore") ----
  const SKEY = 'damamondo-segreti';
  DM.Secrets = {
    list: () => { try { const l = JSON.parse(store.get(SKEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } },
    // segna la mappa come trovata; restituisce true se è la prima volta
    found(id) { const l = this.list(); if (l.includes(id)) return false; l.push(id); store.set(SKEY, JSON.stringify(l)); return true; },
    medal: n => n >= DM.SECRETS.length ? '🥇' : n >= 7 ? '🥈' : n >= 3 ? '🥉' : '',
    // trovate tutte le 14: si sblocca la mappa originale (numero 6)
    allFound() { const l = this.list(); return DM.SECRETS.every(z => l.includes(z.id)); },
    // trovata la mappa originale: premi sbloccati (sigla epica e capitale dorata)
    hasOrig() { return this.list().includes('originale'); }
  };

  const when = t => new Date(t).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const b = (m, label, cls, arg) => `<button type="button" class="big${cls ? ' ' + cls : ''}" data-m="${m}"${arg !== undefined ? ` data-arg="${arg}"` : ''}>${label}</button>`;
  const title = '<h1 class="title">DAMAMONDO</h1>';
  let msg = '', np = 2, asking = null;
  let who = ['', '', '', '', '', ''];   // per ogni giocatore: '' = persona, oppure il livello del bot
  const lastLvl = ['normale', 'normale', 'normale', 'normale', 'normale', 'normale'];   // il livello si ricorda anche passando a "Persona"   // asking: partita di cui si chiede conferma per eliminarla

  const SCREENS = {
    home: () => {
      const S = DM.Secrets, n = S.list().filter(id => id !== 'originale').length, tot = DM.SECRETS.length;
      return title + '<div class="stack">' + b('gioca', 'Gioca', 'go') + b('regole', 'Regole') + '</div>' +
        `<button type="button" class="explorer" data-m="segreti">🧭 Mappe segrete: <b>${n} di ${tot}</b> ${S.medal(n)}${S.hasOrig() ? ' 📜' : ''}</button>`;
    },
    segreti: () => {
      const S = DM.Secrets, got = S.list(), n = got.filter(id => id !== 'originale').length, tot = DM.SECRETS.length, md = S.medal(n);
      const all = S.allFound(), orig = S.hasOrig(), O = DM.SECRET_ORIGINAL;
      // la catena dei premi: 14 mappe segrete → la mappa originale → sigla epica e capitale dorata
      const step = (ok, open, html) => `<li class="${ok ? 'ok' : open ? 'open' : 'no'}">${html}</li>`;
      const chain = '<ol class="chain">' +
        step(all, true, all ? '🥇 Tutte le mappe segrete trovate' : `🗺️ Trova tutte le ${tot} mappe segrete (${n} di ${tot})`) +
        step(orig, all, orig ? `${O.emoji} Trovata ${O.name}!<small class="fact">💡 ${O.fact}</small>` : all ? '📜 Sbloccata: <b>la mappa originale</b>. Il suo numero? Il numero preferito di chi ha inventato il gioco, ed era anche il numero dei giocatori…' : '🔒 ??? (si sblocca con tutte le mappe segrete)') +
        step(orig, false, orig ? '🎺 Premi: la <b>sigla epica</b> e la <b>capitale dorata</b> (si accendono nelle Impostazioni ⚙️)' : '🔒 ??? (due premi)') +
        (orig ? step(true, false, '⭐ La mappa del simbolo si è spostata: ora è al numero più grande fatto di soli 9') : '') + '</ol>';
      return '<h2>🧭 Esploratore</h2><div class="card"><p class="center"><b>' + n + ' di ' + tot + '</b> mappe segrete trovate ' + md + '</p>' +
        '<p class="note"><small>🥉 con 3 · 🥈 con 7 · 🥇 con tutte. Si trovano scegliendo certi numeri mappa e certe opzioni in “Nuova partita”…</small></p>' +
        '<ul class="secrets">' + DM.SECRETS.map(s2 => got.includes(s2.id) ? `<li>${s2.emoji} ${s2.name}<small class="fact">💡 ${s2.fact}</small></li>` : '<li class="no">❔ ???</li>').join('') + '</ul></div>' +
        '<div class="card"><b>E dopo?</b>' + chain + '</div>' +
        '<div class="stack">' + b('home', '← Menu', 'back') + '</div>';
    },
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
      '<div class="card" id="whoCard">' + whoCard() + '</div>' +
      `<div class="card"><b>La mappa</b><div class="opts">
        <label>Isole <select id="isl"><option value="0">Poche</option><option value="1" selected>Medie</option><option value="2">Tante</option></select></label>
        <label>Umidità <select id="hum"><option value="0">Bassa</option><option value="1">Medio bassa</option><option value="2" selected>Media</option><option value="3">Medio alta</option><option value="4">Alta</option></select></label>
        <label>Temperatura <select id="tmp"><option value="0">Calda</option><option value="1">Medio calda</option><option value="2" selected>Media</option><option value="3">Medio fredda</option><option value="4">Fredda</option></select></label>
        <label>Varietà dei biomi <select id="cmp"><option value="0">Semplicissima</option><option value="1">Semplice</option><option value="2" selected>Media</option><option value="3">Estrema</option><option value="4">Estremissima</option></select></label>
        <label>Numero mappa <input type="number" id="seed" min="0" inputmode="numeric" placeholder="a caso"></label>
      </div><small>Stesse opzioni e stesso numero danno la stessa mappa.</small></div>` +
      '<div class="stack">' + b('inizia', 'Inizia', 'go') + b('locale', '← Indietro', 'back') + '</div>',
    regole: () => '<div class="stack">' + b('home', '← Menu', 'back') + '</div><h2>Regolamento</h2>' +
      '<p class="center"><a href="regole.html" target="_blank" rel="noopener">Apri le regole in una pagina a parte (da stampare o condividere)</a></p>' +
      '<div class="rules">' + DM.rulesHTML() + '</div><div class="stack">' + b('home', '← Menu', 'back') + '</div>'
  };

  // Chi gioca: persona o bot (con il livello), per ogni giocatore
  function whoCard() {
    const lv = DM.BOT_LEVELS;
    return '<b>Chi gioca?</b><small class="sub">I bot giocano da soli, con le stesse regole.</small>' + Array.from({ length: np }, (_, i) => {
      const bot = who[i], name = bot ? DM.BOT_NAMES[i] : 'Giocatore ' + (i + 1);
      return `<div class="who-row"><span class="pname"><i style="background:${DM.PLAYER_COLORS[i]}"></i>${name}</span>` +
        `<span class="seg" role="group" aria-label="${name}: persona o bot">` +
        `<button type="button" data-m="who" data-arg="${i}:" aria-pressed="${!bot}"${!bot ? ' class="on"' : ''}>Persona</button>` +
        `<button type="button" data-m="who" data-arg="${i}:${bot || lastLvl[i]}" aria-pressed="${!!bot}"${bot ? ' class="on"' : ''}>Bot</button></span>` +
        (bot ? `<select data-lvl="${i}" aria-label="Livello di ${name}">${Object.keys(lv).map(k => `<option value="${k}"${k === bot ? ' selected' : ''}>${lv[k]}</option>`).join('')}</select>` : '') + '</div>';
    }).join('');
  }
  const redrawWho = () => { const c = $('whoCard'); if (c) c.innerHTML = whoCard(); };

  let cur = 'home';
  DM.showMenu = function (screen) {
    cur = screen || 'home';
    if (cur !== 'locale') asking = null;
    $('game').hidden = true; $('menu').hidden = false; document.body.classList.remove('ingame');
    if (DM.Music) DM.Music.setScene('menu');
    $('menu').className = 'menu' + (cur === 'regole' ? ' long' : '');
    $('menuBody').innerHTML = SCREENS[cur]();
    msg = '';
    window.scrollTo(0, 0);
    background();
  };

  function start() {
    const opts = { isl: +$('isl').value, hum: +$('hum').value, temp: +$('tmp').value, comp: +$('cmp').value };
    // numero mappa: vuoto = a caso; lo 0 vale (mappe segrete)
    const raw = $('seed').value.trim(), seed = raw !== '' && isFinite(+raw) ? Math.max(0, Math.floor(+raw)) : Math.floor(Math.random() * 9999) + 1;
    // il 6 dà la mappa originale solo dopo aver trovato tutte le mappe segrete (resta scritto nella partita salvata)
    if (seed === 6 && raw !== '' && DM.Secrets.allFound()) opts.orig = 1;
    $('menuBody').innerHTML = title + '<p class="msg center">Creo la mappa…</p>';
    setTimeout(() => {
      const G = DM.newGame(opts, seed);
      DM.setPlayers(G, np);
      for (let i = 0; i < np; i++) if (who[i]) DM.setBot(G, i, who[i]);
      const slot = DM.Slots.create(DM.serialize(G));
      DM.playGame(G, slot);
      if (G.map.symbol) {   // la mappa del simbolo (sfondo dell'icona e del menu)
        DM.ui.msg = '⭐ Hai trovato la mappa del simbolo di Damamondo: è quella dietro la stella dell’icona e sullo sfondo del menu!' +
          '<br><small class="fact">💡 Lo sapevi? È la mappa numero 7 con tutte le opzioni medie: in Damamondo ogni numero è come un seme, e dallo stesso seme nasce sempre lo stesso mondo.</small>' +
          // col 6 (prima dello sblocco) un indizio: questo numero nasconde ancora qualcosa
          (G.seed === 6 ? '<br><small class="fact">🔒 Questo numero non ha ancora detto la sua ultima parola… Ritorna più avanti.</small>' : '');
        DM.redraw();
      }
      if (G.map.secret) {   // mappa segreta trovata!
        const s2 = DM.secretInfo(G.map.secret), first = DM.Secrets.found(G.map.secret), n = DM.Secrets.list().length;
        if (G.map.secret === 'originale') DM.ui.msg = `${s2.emoji} Hai trovato ${s2.name}!` + (first ? ' Premi sbloccati: la sigla epica 🎺 e la capitale dorata ⭐. Accendili nelle Impostazioni ⚙️' : '');
        else {
          const k = n - (DM.Secrets.hasOrig() ? 1 : 0), tot = DM.SECRETS.length;
          DM.ui.msg = `${s2.emoji} Hai trovato una mappa segreta: ${s2.name}!` + (first ? ` Mappe segrete trovate: ${k} di ${tot} ${DM.Secrets.medal(k)}` + (k === tot ? ' Hai sbloccato qualcosa: guarda nell’Esploratore 🧭' : '') : '');
        }
        if (s2.fact) DM.ui.msg += `<br><small class="fact">💡 Lo sapevi? ${s2.fact}</small>`;
        // fanfara: grande per la mappa originale e quando le hai trovate tutte, normale per una nuova, piccola se l'avevi già trovata
        if (DM.Sfx) DM.Sfx.play(!first ? 'capNew' : G.map.secret === 'originale' || (DM.Secrets.allFound() && !DM.Secrets.hasOrig()) ? 'secretBig' : 'secret');
        DM.redraw();
      }
      if (!slot) { DM.ui.msg = 'Attenzione: qui non riesco a salvare la partita nel telefono. Usa "Scarica file" in Salvataggi.'; DM.redraw(); }
    }, 30);
  }

  const ACT = {
    home: () => DM.showMenu('home'), gioca: () => DM.showMenu('gioca'), multi: () => DM.showMenu('multi'),
    locale: () => DM.showMenu('locale'), regole: () => DM.showMenu('regole'), segreti: () => DM.showMenu('segreti'),
    nuova: () => { np = 2; DM.showMenu('nuova'); },
    np: n => { np = +n; document.querySelectorAll('[data-m=np]').forEach(x => { x.classList.toggle('on', +x.dataset.arg === np); x.setAttribute('aria-pressed', +x.dataset.arg === np); }); redrawWho(); },
    who: a => { const [i, lvl] = a.split(':'); who[+i] = lvl; if (lvl) lastLvl[+i] = lvl; redrawWho(); },
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
      if (e.target.dataset.lvl !== undefined) { who[+e.target.dataset.lvl] = lastLvl[+e.target.dataset.lvl] = e.target.value; redrawWho(); return; }
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
