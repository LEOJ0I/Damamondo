// Damamondo – interfaccia: tocchi sulla mappa, pannelli, pulsanti.
(function (DM) {
  'use strict';
  const { W, H } = DM;
  const $ = id => document.getElementById(id);
  const T = DM.TROOPS;
  const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  let G = null;
  const ui = DM.ui = {
    sel: null, selB: null, mode: '', pick: [], spawn: '', msg: '', cede: null, keep: false,
    bombKind: '', berryKind: '', pz: null, choice: null, bridgeA: null, cargoQty: 0, cedeBTo: false, mineAt: null, rolling: false, Z: 10
  };
  const view = () => ({ sheets: $('oS').checked, biomes: $('oB').checked, terr: $('oR').checked, units: $('oU').checked, grid: $('oG').checked, detail: DM.Prefs.get('detail') !== false });
  const tapR = () => Math.max(.5, Math.min(1.5, 16 / ui.Z));   // circa 16 pixel, tra 0,5 e 1,5 cm
  const pcol = o => DM.PLAYER_COLORS[o];
  const btn = (act, label, arg, cls) => `<button type="button" data-act="${act}"${arg !== undefined ? ` data-arg="${arg}"` : ''}${cls ? ` class="${cls}"` : ''}>${label}</button>`;
  const row = html => html ? `<div class="r">${html}</div>` : '';

  function resetModes() {
    ui.mode = ''; ui.pick = []; ui.cede = null; ui.pz = null; ui.cedeBTo = false; ui.mineAt = null; ui.spawn = ''; ui.choice = null; ui.bridgeA = null;
    $('sp').value = '';
  }

  // ---------- Disegno e pannelli ----------
  // Prima di un'azione: begin(tipo, dettagli) fa la "foto" della partita; il draw() che segue passa dalle animazioni
  // (js/fx.js), che decidono quando ridisegnare davvero (render).
  let pend = null;
  function begin(kind, x) { if (G) pend = { kind, x: x || {}, before: DM.FX.snap(G, kind) }; return pend; }
  function draw() {
    if (!G) return;
    if (pend) { const p = pend; pend = null; return DM.FX.react(G, p.kind, p.before, p.x, render, ui.msg); }
    render();
    return Promise.resolve();
  }
  function render() {
    if (!G) return;
    G.tapR = tapR();
    if (ui.sel && !G.units.includes(ui.sel)) ui.sel = null;
    if (ui.selB && !G.sites.includes(ui.selB)) ui.selB = null;
    DM.draw($('c'), G, ui, view(), ui.Z);
    hud(); info(); eco(); reserveMenu(); legend(); buttons();
    autosave(); savesPanel(); bubble(); cardPop();
    if (botNow() && !botBusy) setTimeout(maybeBot, 0);   // tocca a un bot: gioca da solo
  }
  // Classico: la carta pescata, in una finestrella che si gira; un tocco la chiude (e mostra la prossima, se ce n'è)
  const DECK = { giri5: ['⏳', 'Carta 5 giri'], giri10: ['⌛', 'Carta 10 giri'], M: ['⛰️', 'Carta Montagna'], A: ['🏔️', 'Carta Alta montagna'], F: ['🌊', 'Carta Fiume/lago'] };
  function cardPop() {
    const el = $('cardPop'), c = G && G.cardsShown && G.cardsShown[0];
    if (!c) { el.hidden = true; el.dataset.k = ''; return; }
    const k = c.deck + c.text + G.cardsShown.length;
    if (el.dataset.k === k) return;
    el.dataset.k = k;
    const [ic, name] = DECK[c.deck] || ['🃏', 'Carta'];
    el.innerHTML = `<div class="card-in"><div class="deck">${ic} ${name}</div><b>${c.title}</b><p>${c.text}</p>` +
      (c.result ? `<p class="res">${c.result}</p>` : '') + `<button type="button" data-act="cardok" class="go">${G.cardsShown.length > 1 ? 'Avanti (' + (G.cardsShown.length - 1) + ')' : 'OK'}</button></div>`;
    el.hidden = false;
    if (DM.Sfx) DM.Sfx.play('cargo');
  }
  DM.redraw = render;

  const ICON = d => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const GEAR = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.7 7.7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>';
  function hud() {
    $('seedInfo').textContent = 'Mappa attuale: numero ' + G.seed + ' (stesse opzioni + stesso numero = stessa mappa).';
    const menu = `<button type="button" class="hb" id="toMenu" data-act="tomenu" aria-label="Torna al menu">${ICON('<path d="M4 7h16M4 12h16M4 17h16"/>')}</button>`;
    const side = `<button type="button" class="hb side" data-side="ecoP" aria-label="Risorse, Banco e opzioni">${ICON('<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>')}</button>`;
    const gear = `<button type="button" class="hb gearbtn" data-settings aria-label="Impostazioni">${GEAR}</button>`;
    let who;
    if (G.phase !== 'play') who = `<b>Preparazione</b><small>${G.phase === 'num' ? 'Quanti giocatori?' : G.names[G.p]}</small>`;
    else {
      const q = DM.cur(G);
      who = `<b style="color:${pcol(G.p)}"><i style="background:${pcol(G.p)}"></i>${G.names[G.p]}${DM.isBot(G, G.p) ? ' <span class="botmark" title="Bot">🤖</span>' : ''}</b>` +
        `<small>Giro ${G.round} · Mosse ${G.moved}/${DM.moveLimit(G.round)} · Spari ${G.shots}/${DM.shotLimit(G.round)}` +
        (q.noCap ? ' · <span class="warn">Senza Capitale!</span>' : '') + '</small>';
    }
    $('hud').innerHTML = menu + `<div class="who">${who}</div>` + side + gear;
  }

  function buttons() {
    const play = G.phase === 'play' && !botNow();
    document.querySelectorAll('.playonly').forEach(b => { b.disabled = !play; });
    const label = (id, t, on) => { $(id).querySelector('span').textContent = t; $(id).classList.toggle('on', !!on); };
    label('army', ui.mode === 'army' ? 'Conferma' : 'Esercito', ui.mode === 'army');
    label('ced', ui.mode === 'cede' ? 'Conferma' : (ui.mode === 'cedeside' || ui.mode === 'cedeto') ? 'Annulla' : 'Cedi', ui.mode.startsWith('cede'));
    label('shoot', ui.mode === 'shoot' ? 'Annulla' : 'Spara', ui.mode === 'shoot');
    $('army').title = ui.mode === 'army' ? 'Conferma esercito' : 'Forma esercito';
    $('ced').title = 'Cedi territorio'; $('shoot').title = ui.mode === 'shoot' ? 'Annulla sparo' : 'Spara';
    $('undo').title = 'Annulla mossa'; $('end').title = 'Fine turno';
  }

  function info() {
    const f = $('info');
    if (ui.rolling) return;
    if (botNow()) {   // turno di un bot: si guarda (e si può accelerare; se giocano solo bot, anche mettere in pausa)
      const all = allBots(), paused = all && ui.paused;
      const look = paused && (ui.sel && G.units.includes(ui.sel) ? unitInfo(ui.sel, true) : ui.selB && G.sites.includes(ui.selB) ? siteInfo(ui.selB, true) : '');
      f.innerHTML = (paused ? '<p class="msg">⏸ Partita in pausa</p>' + (look || '<small>Tocca una truppa o un edificio di qualsiasi giocatore per vedere com’è. Qui si guarda soltanto.</small>')
        : `<p class="msg"><span style="color:${pcol(G.p)}">${G.names[G.p]}</span> 🤖 sta giocando…</p>` + (ui.msg ? `<p class="botsays">${ui.msg}</p>` : '')) +
        row((all ? btn('botpause', paused ? '▶ Riprendi' : '⏸ Pausa', '', paused ? 'go' : '') : '') +
          (paused ? '' : btn('botfast', ui.botFast ? 'Velocità normale' : 'Più veloce', '', ui.botFast ? 'on' : '')));
      return;
    }
    if (G.phase === 'num') { f.innerHTML = '<b>Quanti giocatori?</b>' + row([2, 3, 4, 5, 6].map(n => btn('players', n, n)).join('')); return; }
    if (G.phase === 'kit') {
      f.innerHTML = (ui.msg ? `<p class="msg">${ui.msg}</p>` : '') + `<b style="color:${pcol(G.p)}">${G.names[G.p]}</b>: scegli il kit` +
        row(DM.KITS.map((k, i) => btn('kit', k.name, i)).join('')) + `<small>${kitHelp()}</small>`;
      return;
    }
    if (G.phase === 'cap') {
      f.innerHTML = `<b style="color:${pcol(G.p)}">${G.names[G.p]}</b> (${DM.KITS[G.players[G.p].kit].name}): tocca la mappa per piazzare la Capitale.` +
        (ui.msg ? `<p class="msg">${ui.msg}</p>` : '');
      return;
    }
    let s = '';
    if (ui.pendingFile) {
      f.innerHTML = '<p class="msg">Aprire il file al posto di questa partita? Questa viene sostituita (scaricala prima se vuoi tenerla).</p>' + row(btn('fileyes', 'Sì, apri il file', '', 'go') + btn('fileno', 'No'));
      return;
    }
    if (ui.choice) {   // più bersagli nello stesso punto: sceglie il giocatore
      f.innerHTML = '<p class="msg">' + ui.choice.title + '</p>' + ui.choice.list.map((t, i) => row(btn('choose', t.label, i))).join('') + row(btn('cancel', 'Annulla'));
      return;
    }
    if (ui.mode === 'cedeto') s = cedeUI();
    else if (ui.mineAt) {   // kit Maghi: si sceglie direttamente il minerale (tra quelli del bioma)
      const tab = DM.MINE_TABLE[DM.bAt(G, ui.mineAt[0], ui.mineAt[1])].split(' '), mats = [...new Set(tab)];
      s = '<b>Miniera</b>: scegli il minerale (kit Maghi, ancora ' + DM.cur(G).dice + ')' + row(mats.map(m => btn('minedie', m[0].toUpperCase() + m.slice(1), tab.indexOf(m) + 1)).join('') + btn('minedie', 'Tira il dado', 0) + btn('cancel', 'Annulla'));
    }
    else if (ui.sel) s = unitInfo(ui.sel);
    else if (ui.selB) s = siteInfo(ui.selB);
    else if (ui.selW && (G.walls || []).includes(ui.selW)) s = wallInfo(ui.selW);
    if (['road', 'bomb', 'berry', 'pz', 'shoot', 'army'].includes(ui.mode) || ui.spawn) s = row(btn('cancel', ui.mode === 'pz' && !ui.pz.first ? 'Fatto' : ui.spawn && !ui.mode ? 'Deseleziona' : 'Annulla')) + s;
    f.innerHTML = (ui.msg ? `<p class="msg">${ui.msg}</p>` : '') + (s || (!ui.msg ? '<small>Tocca una tua truppa o un tuo edificio.</small>' : ''));
  }

  function kitHelp() {
    return DM.KITS.map(k => `<b>${k.name}</b>: ${DM.fmtN(k.money)} soldi` + [['S', 'Soldati'], ['N', 'Navi'], ['E', 'Elicotteri'], ['acc', 'Accampamenti'], ['citta', 'Città'], ['porto', 'Porti'], ['min', 'Miniere'], ['aer', 'Aeroporti'], ['ponte1', 'Ponte liv.1']]
      .filter(e => k[e[0]]).map(e => ', ' + k[e[0]] + ' ' + e[1]).join('') + (k.materials ? ', 1 punto di ogni materiale' : '') + (k.potions ? ', 2 pozioni di ogni tipo (1 Stipendio+)' : '')).join('<br>') +
      '<br>Tutti: Capitale con Aeroporto gratis e 1 Carro.';
  }

  // look: solo da guardare (partita di soli bot in pausa): niente pulsanti
  function wallInfo(w) {
    const mine = w.o === G.p && !botNow(), q = DM.cur(G);
    let s = `<b style="color:${pcol(w.o)}">Muro${w.up ? ' migliorato ❄️' : ''}</b> · vita ${w.hp}/${w.mx}`;
    if (!mine) return s + '<br><small>Blocca le truppe di terra; si può colpire con qualsiasi truppa.</small>';
    const b = [];
    if (!w.up && q.res.muroUp > 0) b.push(btn('wallup', 'Migliora (' + q.res.muroUp + ')'));
    if (w.up) b.push(btn('walltrig', '❄️ Fai scattare il congelamento', '', 'go'));
    return s + row(b.join('')) + '<small>' + (w.up ? 'Il pezzo crolla e congela per 2 giri tutte le truppe entro 2 cm, anche le tue.' : 'Blocca le truppe di terra nemiche (gli Elicotteri volano sopra).') + '</small>';
  }
  function unitInfo(u, look) {
    const t = T[u.t], b = DM.bAt(G, u.x, u.y), A = DM.armyOf(G, u), st = DM.stat(G, u);
    const spd = Math.min(...A.map(q => DM.speedAt(G, q, q.x, q.y)));
    let s = `<b style="color:${pcol(u.o)}">${u.g ? 'Esercito ' + u.an + ' (' + DM.composition(A) + ')' : t.name}</b> su ${DM.BIOME_NAME[b]}` +
      (u.g ? ` · ${DM.armyPts(A)}/100 punti` : ` · vita ${u.hp}/${t.hp} · danno ${st[0]} · gittata ${st[1]} cm`) +
      ` · velocità qui ${spd} cm` + (u.m ? (DM.movesLeft(G, u) ? ' · può muoversi ancora ' + (DM.movesLeft(G, u) > 1 ? DM.movesLeft(G, u) + ' volte' : '1 volta') : ' · già mossa') : DM.movesOf(A) > 1 ? ' · ' + DM.movesOf(A) + ' mosse per turno' : '') + (u.s ? ' · ha sparato' : '') +
      (u.bf && u.bf.until > G.round ? ' · bacca ' + DM.BIOME_NAME[u.bf.k] + ' fino al giro ' + (u.bf.until - 1) : '') +
      (u.bn > 0 ? ' · brucia ancora ' + u.bn + ' turni' : '') + (u.oc ? ' · in territorio nemico da ' + u.oc + ' giri' : '');
    if (u.cg) s += '<br>Carico: ' + DM.fmtInv(u.cg) + ` (${DM.cargoPts(u.cg)}/${DM.CARGO_CAP[u.t]} punti)`;
    if (look) return s + '<br><small>Truppa di ' + G.names[u.o] + '.</small>';
    if (u.o === G.p && u.g && !ui.mode) s += '<div class="r"><small>Fai uscire una truppa:</small>' + A.map(v => btn('leave', T[v.t].name + ' ' + v.hp, v.id)).join('') + '</div>';
    if (u.o === G.p && !u.g) s += transportUI(u);
    if (u.o !== G.p) s += '<br><small>Truppa avversaria.</small>';
    else if (u === ui.sel && !ui.mode) s += row(btn('deselect', 'Deseleziona'));
    return s;
  }

  // Trasporto: chi è a bordo (fai scendere) e chi può salire (entro 1 cm)
  function transportUI(v) {
    if (!DM.TROOP_CAP[v.t]) return '';
    const on = DM.aboard(G, v);
    const can = G.units.filter(u => u !== v && !DM.boardError(G, v, u));
    let h = `<br>A bordo: ${on.length ? DM.composition(on) : 'nessuno'} (${DM.aboardPts(G, v)}/${DM.TROOP_CAP[v.t]} punti truppa)`;
    h += row(on.map(u => btn('unboard', 'Fai scendere ' + T[u.t].name, v.id + ':' + u.id)).join(''));
    h += row(can.map(u => btn('board', 'Fai salire ' + T[u.t].name + (u.cg || DM.aboard(G, u).length ? ' (carico)' : ''), v.id + ':' + u.id)).join(''));
    return h;
  }

  function siteInfo(s, look) {
    const q = DM.cur(G), mine = s.o === G.p && !look, I = s.inv;
    const inside = G.units.filter(u => u.o === s.o && Math.hypot(u.x - s.x, u.y - s.y) <= .3);
    // il contenuto dei propri edifici lo dice il fumetto sopra l'edificio; qui restano nome, vita e pulsanti
    let h = `<b style="color:${pcol(s.o)}">${DM.nameOf(s.k)}${s.par ? ' (dentro una città)' : ''}</b> · vita ${s.hp}/${DM.maxHp(s)}` +
      (s.k === 'min' ? ' · ' + s.mt : '') + (s.ign ? ' · ignifuga' : '') + (s.up ? ' · migliorata' : '') +
      (!mine ? `<br>Contiene: ${DM.fmtInv(I)}` + (inside.length ? '<br>Truppe dentro: ' + DM.composition(inside) : '') : '');
    const inner = G.sites.filter(z => z.par === s.id);
    if (inner.length && mine) h += row(inner.map(z => btn('opensite', 'Apri ' + (z.k === 'aer' ? 'l’Aeroporto' : 'il Porto'), z.id)).join(''));
    if (s.par && DM.siteById(G, s.par)) h += row(btn('opensite', '← Torna a ' + DM.nameOf(DM.siteById(G, s.par).k), s.par));
    if (s.k === 'citta' && I.mon < DM.CITY_MIN_MONEY) h += '<br><small>Con meno di 5.000 soldi dentro conta come Accampamento (niente rendita).</small>';
    if (s.k === 'col') { const k = DM.BERRY_OF_BIOME[DM.bAt(G, s.x, s.y)]; h += '<br><small>Bacche ' + k + ': prossima al giro ' + (G.round + 5 - ((G.round - s.r0) % 5 + 5) % 5) + '.</small>'; }
    if (!mine) return h + '<br><small>Edificio di ' + G.names[s.o] + '.</small>';
    const b = [];
    (DM.SPAWNS[s.k] || '').split('').filter(t => q.res[t] > 0).forEach(t => b.push(btn('deployhere', 'Schiera ' + T[t].name + ' (' + q.res[t] + ')', t)));
    if (s.k === 'acc') b.push(btn('upgrade', 'Trasforma in Città'));
    if (s.k === 'citta' && q.noCap) b.push(btn('makecap', 'Fai diventare Capitale', '', 'go'));
    if ((s.k === 'cap' || s.k === 'citta') && q.res.aer > 0) b.push(btn('inside', 'Aeroporto dentro (' + q.res.aer + ')', 'aer'));
    if ((s.k === 'cap' || s.k === 'citta') && q.res.porto > 0) b.push(btn('inside', 'Porto dentro (' + q.res.porto + ')', 'porto'));
    if (!DM.isClassic()) b.push(btn('roadmode', 'Collega con strada'));
    if (I.mat.bomba > 0 && DM.BOMB.bomba.from.includes(s.k)) b.push(btn('bombmode', 'Lancia Bomba (' + I.mat.bomba + ')', 'bomba'));
    if (I.mat.superbomba > 0 && DM.BOMB.superbomba.from.includes(s.k)) b.push(btn('bombmode', 'Lancia Superbomba (' + I.mat.superbomba + ')', 'superbomba'));
    if (DM.BERRY_RANGE[s.k]) Object.keys(DM.BERRIES).filter(k => I.mat['bacca_' + k] > 0).forEach(k => b.push(btn('berrymode', 'Bacca ' + k + ' (' + I.mat['bacca_' + k] + ')', k)));
    Object.keys(DM.POTIONS).filter(k => I.mat[k] > 0).forEach(k => b.push(btn('potion', 'Usa ' + DM.POTIONS[k] + ' (' + I.mat[k] + ')', k)));
    if (DM.isCityLike(s) || s.k === 'porto' || s.k === 'aer' || s.k === 'min') b.push(btn('bank', DM.isClassic() ? 'Negozio' : 'Banco e acquisti'));
    if (s.k !== 'cap') b.push(btn('cedeb', 'Cedi edificio'));
    h += row(b.join(''));
    // Classico: i soldi si teletrasportano tra la Capitale e le altre città (la Capitale tiene la maggioranza)
    if (DM.isClassic() && s.k !== 'cap' && DM.isCityLike(s) && DM.capitalOf(G, G.p)) h += row('<small>Soldi:</small>' +
      `<input type="number" id="mq" value="${ui.moneyQty || 1000}" min="1000" step="1000" inputmode="numeric" aria-label="Soldi da spostare">` +
      btn('moneyin', 'Porta qui dalla Capitale') + btn('moneyout', 'Manda alla Capitale'));
    if (ui.cedeBTo) h += row('<small>Cedi a:</small>' + G.names.map((n, o) => o !== G.p && !G.players[o].out ? btn('cedebto', n, o) : '').join('') + btn('cancel', 'Annulla'));
    h += cargoUI(s);
    return h + '<small>Per far entrare una truppa: selezionala e tocca l’edificio.</small>';
  }

  function cargoUI(s) {
    const cars = DM.cargoNear(G, s);
    if (!cars.length) return '';
    const I = s.inv, here = ['mon'].concat(DM.ITEMS).filter(m => m === 'mon' ? I.mon > 0 : I.mat[m] > 0);
    const lab = m => m === 'mon' ? 'soldi' : DM.nameOf(m).toLowerCase();
    return `<div class="cargo"><label>Quantità (vuoto = il massimo): <input type="number" id="cq" min="0" inputmode="numeric" value="${ui.cargoQty || ''}"></label>` +
      cars.map(c => {
        const g = c.cg || { mon: 0, mat: {} }, on = ['mon'].concat(DM.ITEMS).filter(m => m === 'mon' ? g.mon > 0 : g.mat[m] > 0);
        return `<div><b>${T[c.t].name}</b> ${DM.cargoPts(g)}/${DM.CARGO_CAP[c.t]} punti · ${DM.fmtInv(g)}` +
          row(here.map(m => btn('load', 'Carica ' + lab(m), c.id + ':' + m)).join('') + on.map(m => btn('unload', 'Scarica ' + lab(m), c.id + ':' + m)).join('') + (on.length ? btn('unload', 'Scarica tutto', c.id + ':') : '')) + '</div>';
      }).join('') + '</div>';
  }

  function cedeUI() {
    const cd = ui.cede;
    if (cd.newp) return '<b>Nuovo giocatore</b>: scegli il suo kit. La sua Capitale sarà nella zona ceduta.' + row(DM.KITS.map((k, i) => btn('cedenew', k.name, i)).join('') + btn('cedeback', 'Indietro'));
    return `<b>Cessione</b>: ${(cd.cells.length / 16).toFixed(1)} cm²${cd.snap ? ' (il confine segue quello dei biomi)' : ' (linea libera)'}. A chi?` +
      row(btn('cedekeep', 'Non cedere edifici: ' + (ui.keep ? 'Sì' : 'No')) + (cd.auto ? btn('cedesnap', cd.noSnap ? 'Aggancia al bioma' : 'Non agganciare al bioma') : '')) +
      row(G.names.map((n, o) => o !== G.p && !G.players[o].out ? btn('cedeto', n, o) : '').join('') + btn('cedeto', 'Nessuno', -1) +
        (G.np < DM.MAX_PLAYERS ? btn('cedenewp', 'Nuovo giocatore') : '') + btn('cedecancel', 'Annulla'));
  }

  function eco() {
    const s = ui.selB;
    $('ecoMsg').textContent = ui.msg && !/[<]/.test(ui.msg) ? ui.msg : '';
    const cl = DM.isClassic();
    $('bancoBox').hidden = cl; $('ecoTab').textContent = cl ? 'Negozio' : 'Banco';   // nel Classico il Banco non c'è
    $('ecoT').innerHTML = (s ? `Edificio scelto: <b style="color:${pcol(s.o)}">${DM.nameOf(s.k)}</b><br>Contiene: ${DM.fmtInv(s.inv)}` : '<small>Prima tocca un tuo edificio sulla mappa: ' + (cl ? 'si compra lì, con i soldi di tutte le tue città.' : 'si vende e si compra con quello che c’è dentro.') + '</small>') +
      (G.phase === 'play' ? (cl ? `<br><small>Soldi totali: ${DM.fmtN(DM.moneyOf(G, G.p))} (la Capitale ne tiene più della metà)</small>` :
        `<br><small>Miniere: ${G.sites.filter(z => z.k === 'min' && z.o === G.p).length} · soldi totali: ${DM.fmtN(DM.moneyOf(G, G.p))}${DM.cur(G).sold ? ' · venduto in questo turno: ' + DM.cur(G).sold : ''}</small>`) : '');
    shop(s);
  }

  // Negozio: tutto quello che si compra, con il costo; più chiaro quello che qui non si può comprare
  const SHOP = [['Truppe', ['S', 'N', 'E', 'T', 'U', 'C', 'X', 'A']], ['Edifici (vanno nella riserva)', ['acc', 'citta', 'porto', 'aer', 'col', 'min']],
    ['Difese (vanno nella riserva)', ['mina', 'minaA', 'muro', 'muroUp']],
    ['Ponti (a pezzi da 1 cm)', ['ponte1', 'ponte2']], ['Armi', ['bomba', 'superbomba']], ['Pozioni', Object.keys(DM.POTIONS)]];
  const chip = (t, cls) => `<span class="chip${cls ? ' ' + cls : ''}">${t}</span>`;
  const costChips = o => chip('💰 ' + DM.fmtN(o.m)) + Object.keys(o.r).map(m => chip(DM.fmtN(o.r[m]) + ' ' + DM.unitOf(m) + ' ' + m)).join('');
  function canBuyHere(s, k) {
    if (!s || s.o !== G.p) return false;
    if (T[k]) { if (k === 'U') return DM.SPAWNS[s.k].includes(k) && !!DM.waterSpot(G, s); if (k === 'N' && (s.k === 'cap' || s.k === 'citta')) return !!DM.riverSpot(G, s); if (!DM.SPAWNS[s.k].includes(k)) return false; }
    if (k === 'minaA' && !(DM.cur(G).res.mina > 0)) return false;
    if (k === 'bomba' && !DM.BOMB.bomba.from.includes(s.k)) return false;
    if (k === 'superbomba' && !DM.BOMB.superbomba.from.includes(s.k)) return false;
    if (k === 'ponte2' && DM.isClassic() && !(DM.cur(G).res.ponte1 > 0)) return false;
    return DM.costOf(G, k).some(o => DM.canPay(DM.payInvs(G, s), o));
  }
  function shop(s) {
    const cl = DM.isClassic();
    $('shop').innerHTML = (s && s.o === G.p ? '' : '<small>Tocca un tuo edificio sulla mappa per comprare' + (cl ? '.' : ' con quello che contiene.') + '</small>') +
      SHOP.map(([title, ks]) => [title, (title === 'Pozioni' ? Object.keys(DM.POTIONS) : ks).filter(k => DM.COST[k])]).filter(([, ks]) => ks.length).map(([title, ks]) => `<h4>${title}</h4>` + ks.map(k => {
        const ok = canBuyHere(s, k);
        return `<div class="item${ok ? '' : ' no'}"><div class="what"><b>${cl && k === 'ponte2' ? 'Migliora un pezzo di ponte al liv. 2' : k === 'minaA' ? 'Migliora una mina (colpisce anche gli Elicotteri)' : k === 'muro' ? 'Pezzo di muro (1 cm)' : DM.nameOf(k)}</b><div class="cost">${DM.costOf(G, k).map(costChips).join('<small class="or">oppure</small>')}${DM.costOf(G, k) !== DM.COST[k] ? chip('☄️ metà prezzo', 'gold') : ''}</div></div>` +
          `<button type="button" class="playonly${ok ? ' go' : ''}" data-act="buyk" data-arg="${k}">Compra</button></div>`;
      }).join('')).join('');
  }

  // Fumetto sopra l'edificio scelto: cosa c'è dentro
  function bubbleHTML(s) {
    const I = s.inv, out = [], inside = G.units.filter(u => u.o === s.o && !u.carried && Math.hypot(u.x - s.x, u.y - s.y) <= .3);
    if (I.mon) out.push(chip('💰 ' + DM.fmtN(I.mon) + ' soldi', 'gold'));
    DM.MATERIALS.forEach(m => { if (I.mat[m] > 0) out.push(chip(DM.fmtN(I.mat[m]) + ' ' + DM.unitOf(m) + ' ' + m)); });
    if (I.mat.bomba > 0) out.push(chip('💣 ' + I.mat.bomba + ' × Bomba'));
    if (I.mat.superbomba > 0) out.push(chip('☢️ ' + I.mat.superbomba + ' × Superbomba'));
    Object.keys(DM.POTIONS).forEach(k => { if (I.mat[k] > 0) out.push(chip('🧪 ' + I.mat[k] + ' × ' + DM.POTIONS[k])); });
    Object.keys(DM.BERRIES).forEach(k => { if (I.mat['bacca_' + k] > 0) out.push(chip('🫐 ' + I.mat['bacca_' + k] + ' × bacca ' + k)); });
    const inner = G.sites.filter(z => z.par === s.id);
    return `<div class="bt"><b style="color:${pcol(s.o)}">${DM.nameOf(s.k)}</b><small>❤ ${DM.fmtN(s.hp)}/${DM.fmtN(DM.maxHp(s))}</small></div>` +
      `<div class="bc">${out.join('') || chip('vuoto', 'empty')}</div>` +
      (inside.length ? `<div class="bi">🪖 ${DM.composition([...new Set(inside.flatMap(u => DM.armyOf(G, u)))])}</div>` : '') +
      (inner.length ? `<div class="bi">🏠 Dentro: ${inner.map(z => DM.nameOf(z.k)).join(', ')}</div>` : '');
  }
  function bubble() {
    const b = $('bubble'), s = G && ui.selB && G.sites.includes(ui.selB) && G.phase === 'play' && (!botNow() || (allBots() && ui.paused)) ? ui.selB : null;
    if (!s) { b.hidden = true; b.dataset.k = ''; b.dataset.sid = ''; return; }
    const html = bubbleHTML(s);
    if (b.dataset.k !== html) { b.innerHTML = html; b.dataset.k = html; }
    b.hidden = false;
    if (b.dataset.sid !== String(s.id)) { b.dataset.sid = s.id; roomForBubble(s); }
    placeBubble();
  }
  // edificio appena scelto: se sopra non c'è posto per il fumetto, la mappa scende un po'
  function roomForBubble(s) {
    const at = s.par ? DM.siteById(G, s.par) || s : s, b = $('bubble'), v = $('vp');
    const c = $('c').getBoundingClientRect(), hud = $('hud').getBoundingClientRect(), dock = document.querySelector('.dock').getBoundingClientRect();
    const py = c.top + at.y * ui.Z, need = hud.bottom + 10 + b.offsetHeight + DM.siteSize(at, ui.Z) * ui.Z + 8;
    if (py < need) v.scrollTop -= need - py;
    else if (py > dock.top - 20) v.scrollTop += py - (dock.top - 20);
  }
  // il fumetto sta sopra l'edificio (sotto, se sopra non c'è posto) e segue la mappa
  function placeBubble() {
    const b = $('bubble'), s = ui.selB;
    if (b.hidden || !s) return;
    const at = s.par ? DM.siteById(G, s.par) || s : s;
    const c = $('c').getBoundingClientRect(), v = $('vp').getBoundingClientRect(), hud = $('hud').getBoundingClientRect(), dock = document.querySelector('.dock').getBoundingClientRect();
    const px = c.left + at.x * ui.Z, py = c.top + at.y * ui.Z, gap = DM.siteSize(at, ui.Z) * ui.Z + 8;
    const w = b.offsetWidth, h = b.offsetHeight;
    if (px < v.left || px > v.right || py < hud.bottom - 10 || py > dock.top + 10) { b.style.visibility = 'hidden'; return; }
    b.style.visibility = '';
    // sopra se c'è posto; altrimenti sotto, se lì non lo copre il riquadro in basso; altrimenti in alto, dove si vede
    const fitsAbove = py - gap - h >= hud.bottom + 4, fitsBelow = py + gap + h <= dock.top - 4;
    const below = !fitsAbove && fitsBelow;
    const top = fitsAbove ? py - gap - h : below ? py + gap : hud.bottom + 4;
    const left = Math.max(8, Math.min(innerWidth - w - 8, px - w / 2));
    b.style.left = left + 'px';
    b.style.top = top + 'px';
    b.classList.toggle('below', below);
    b.classList.toggle('notip', !fitsAbove && !below);
    b.style.setProperty('--tip', Math.max(14, Math.min(w - 14, px - left)) + 'px');
  }

  function reserveMenu() {
    const sp = $('sp'), r = G.phase === 'play' ? DM.cur(G).res : {};
    const keys = Object.keys(r).filter(k => r[k] > 0 && k !== 'muroUp');   // i miglioramenti delle mura si usano toccando il muro
    const want = keys.map(k => k + r[k]).join(',');
    if (sp.dataset.k !== want) {
      sp.dataset.k = want;
      sp.length = 1;
      keys.forEach(k => sp.add(new Option(T[k] ? 'Schiera ' + DM.nameOf(k) + ' (' + r[k] + ')' :
        k === 'mina' || k === 'minaA' ? 'Posa ' + (k === 'minaA' ? 'mina migliorata' : 'mina') + ' (' + r[k] + ')' : k === 'muro' ? 'Costruisci muro (' + r[k] + (r[k] > 1 ? ' pezzi)' : ' pezzo)') :
        k.startsWith('ponte') ? 'Costruisci ponte liv. ' + k.slice(5) + ' (' + r[k] + (r[k] > 1 ? ' pezzi)' : ' pezzo)') : 'Costruisci ' + DM.nameOf(k) + ' (' + r[k] + ')', k)));
    }
    sp.options[0].text = ui.spawn ? '✕ Deseleziona' : 'Schiera o costruisci dalla riserva…';
    sp.value = ui.spawn;
    const n = botNow() ? 0 : keys.reduce((t, k) => t + r[k], 0);
    $('spN').textContent = n ? (n > 99 ? '99+' : String(n)) : '';
    $('spT').classList.toggle('off', !n || G.phase !== 'play' || botNow());
    $('spT').classList.toggle('on', !!ui.spawn);
  }

  function legend() {
    const v = view();
    const it = v.biomes ? Object.keys(DM.BIOME_NAME).map(k => [DM.BIOME_COLOR[k], DM.BIOME_NAME[k]]) : [['#d9d2b0', 'Terra'], ['#4a86c5', 'Mare'], ['#7ad0e8', 'Fiume/lago'], ['#b9e3ee', 'Banchisa']];
    const pl = v.terr ? G.names.map((n, i) => [pcol(i), 'Territorio ' + n]) : [];
    const sym = [['★', 'Capitale'], ['■', 'Città (grande) / Accampamento'], ['✈', 'Aeroporto'], ['⚓', 'Porto'], ['❀', 'Coltivazione'], ['⬢', 'Miniera'], ['●', 'Truppa (lettera) / esercito (numero)']];
    $('leg').innerHTML = it.concat(pl).map(a => `<span><i style="background:${a[0]}"></i>${a[1]}</span>`).join('') +
      sym.map(a => `<span><i class="sym">${a[0]}</i>${a[1]}</span>`).join('');
  }

  // ---------- Tocchi sulla mappa ----------
  function tap(x, y) {
    if (DM.FX.busy) { DM.FX.skip(); return; }   // un tocco salta l'animazione in corso
    if (botNow() && allBots() && ui.paused) { look(x, y); return; }   // partita di soli bot in pausa: si toccano le cose per vederle
    if (ui.rolling || botNow()) return;          // durante il turno di un bot la mappa si guarda soltanto
    begin('act');
    if (G.phase === 'cap') {
      ui.msg = DM.placeCapital(G, x, y);
      if (G.phase === 'play') focus();
      draw(); return;
    }
    if (G.phase !== 'play') { pend = null; return; }
    if (!$('oU').checked) { ui.msg = 'Truppe nascoste: riattivale per giocare.'; draw(); return; }
    const m = ui.mode;
    if (['cede', 'cedeside', 'army'].includes(m)) pend.kind = 'tap';
    if (m === 'cede') { ui.cede.pts.push([x, y]); ui.msg = ui.cede.pts.length + ' punti: continua a toccare o premi "Conferma linea".'; draw(); return; }
    if (m === 'cedeside') {
      const r = DM.cedeCompute(G, ui.cede.pts, x, y, ui.cede.noSnap);
      if (r.err) ui.msg = r.err; else { Object.assign(ui.cede, r, { sx: x, sy: y }); ui.mode = 'cedeto'; ui.msg = ''; }
      draw(); return;
    }
    if (m === 'cedeto' || ui.mineAt || ui.choice) { pend = null; return; }
    if (m === 'road') {
      ui.msg = DM.buildRoad(G, ui.selB, DM.nodeNear(G, x, y, ui.selB)); ui.mode = ''; draw(); return;
    }
    if (m === 'bomb') {
      const site = ui.selB, k = ui.bombKind;
      choose(DM.anyTargets(G, x, y), 'Cosa vuoi colpire con la ' + DM.nameOf(k) + '?', t => DM.launchBombAt(G, site, k, t, x, y), k === 'superbomba',
        t => ['bomb', { k, sx: site.x, sy: site.y, tx: t ? t.x : x, ty: t ? t.y : y }]);
      return;
    }
    if (m === 'berry') {
      const site = ui.selB, k = ui.berryKind;
      choose(DM.berryTargets(G, x, y), 'Su chi lanci la bacca ' + k + '?', t => DM.throwBerryAt(G, site, k, t), false,
        t => ['berry', { sx: site.x, sy: site.y, tx: t ? t.x : x, ty: t ? t.y : y, col: DM.BIOME_COLOR[DM.BERRIES[k]] }]);
      return;
    }
    if (m === 'pz') {
      Object.assign(pend.x, { potion: true, at: [x, y] });
      const r = DM.potionOnUnit(G, ui.selB, ui.pz.k, x, y, ui.pz.first);
      if (r.err) ui.msg = r.err;
      else {
        ui.pz.first = false; ui.pz.left--; ui.msg = r.msg;
        if (r.done || ui.pz.left <= 0) { ui.mode = ''; ui.pz = null; } else ui.msg += ' Puoi sceglierne ancora ' + ui.pz.left + ' (o tocca "Fatto").';
      }
      draw(); return;
    }
    if (m === 'army') {
      const u = DM.unitNear(G, x, y, v => v.o === G.p && !ui.pick.includes(v) && !v.g && !v.m) || DM.unitNear(G, x, y, v => v.o === G.p && !ui.pick.includes(v));
      const err = DM.pickError(G, ui.pick, u);
      if (err) ui.msg = err; else { ui.pick.push(u); ui.msg = ui.pick.length + ' scelte (' + DM.armyPts(ui.pick) + '/100 punti). Tocca altre truppe o premi "Conferma esercito".'; }
      draw(); return;
    }
    if (m === 'shoot') {
      const u = ui.sel, ready = DM.armyOf(G, u).filter(v => !v.s && T[v.t].dmg > 0).map(v => ({ id: v.id, t: v.t, x: v.x, y: v.y }));
      choose(DM.shootTargets(G, x, y), 'A cosa spari?', t => DM.shootAt(G, u, t), false, t => {
        const fired = new Set(DM.armyOf(G, u).filter(v => v.s).map(v => v.id));
        // chi ha sparato davvero (non tutto l'esercito spara): i più forti in portata
        const from = t ? ready.filter(v => fired.has(v.id) && Math.hypot(v.x - t.x, v.y - t.y) <= DM.stat(G, DM.unitById(G, v.id) || u)[1] + 1e-9) : [];
        return ['shoot', { from: from.length ? from : ready.slice(0, 1), tx: t ? t.x : x, ty: t ? t.y : y }];
      });
      return;
    }
    if (ui.spawn) { spawnTap(x, y); return; }

    const own = v => v.o === G.p;
    const hit = DM.unitNear(G, x, y, own);
    const sites = DM.siteNear(G, x, y, own);
    pend.kind = 'tap';
    if (hit && hit === ui.sel) {   // secondo tocco sulla truppa: passa all'edificio sotto, oppure deseleziona
      ui.sel = null; ui.selB = sites[0] || null; ui.msg = sites.length ? '' : 'Truppa deselezionata.'; draw(); return;
    }
    ui.selW = null;
    if (!hit && !ui.sel && sites.length) { DM.Sfx.play('select'); ui.selB = sites[(sites.indexOf(ui.selB) + 1) % sites.length]; ui.msg = ''; ui.cedeBTo = false; draw(); return; }
    // Classico: un pezzo di muro (proprio o avversario)
    const wall = !hit && !ui.sel && DM.isClassic() ? DM.wallAt(G, x, y) : null;
    if (wall) { DM.Sfx.play('select'); ui.selW = wall; ui.selB = null; ui.msg = ''; draw(); return; }
    if (hit) { DM.Sfx.play('select'); ui.sel = hit; ui.selB = null; ui.msg = !hit.m ? 'Tocca la destinazione.' : DM.movesLeft(G, hit) ? 'Tocca la destinazione: può muoversi ancora in questo turno.' : 'Questa truppa ha già mosso.'; draw(); return; }
    if (!ui.sel) {
      const enemyU = DM.unitNear(G, x, y, u => !DM.hiddenFrom(G, u, G.p)), enemyS = DM.siteNear(G, x, y)[0];
      ui.selB = null;
      ui.msg = enemyU ? unitInfo(enemyU) : enemyS ? siteInfo(enemyS) : 'Tocca una tua truppa o un tuo edificio.';
      draw(); return;
    }
    pend.kind = 'act';
    ui.msg = DM.moveUnit(G, ui.sel, x, y);
    draw();
  }

  // Un solo bersaglio: si colpisce subito. Più bersagli: il giocatore sceglie dall'elenco.
  // emptyOk: si può anche colpire il punto vuoto (Superbomba)
  // fx(t): tipo di animazione e dettagli per il bersaglio t (dopo l'azione)
  function choose(list, title, run, emptyOk, fx) {
    if (list.length > 1) { pend = null; ui.choice = { list, title, run, fx }; draw(); return; }
    const t = list[0] || null;
    if (!list.length && !emptyOk) { ui.msg = run(null); ui.mode = ''; draw(); return; }
    ui.msg = run(t); ui.mode = '';
    if (fx && pend) { const [k, x] = fx(t); pend.kind = k; pend.x = x; }
    draw();
  }

  function spawnTap(x, y) {
    const k = ui.spawn;
    if (k === 'mina' || k === 'minaA') { ui.msg = DM.placeMine(G, k, x, y); keepSpawn(k); draw(); return; }
    if (k === 'muro') {   // il muro si posa con due tocchi: inizio e fine
      if (!ui.bridgeA) { ui.bridgeA = [x, y]; ui.msg = 'Ora tocca dove finisce il muro.'; draw(); return; }
      ui.msg = DM.buildWall(G, ui.bridgeA[0], ui.bridgeA[1], x, y);
      ui.bridgeA = null; keepSpawn(k); draw(); return;
    }
    if (k.startsWith('ponte')) {   // il ponte si posa con due tocchi: una riva e poi l'altra
      if (!ui.bridgeA) { ui.bridgeA = [x, y]; ui.msg = 'Ora tocca la terra dall’altra parte dell’acqua.'; draw(); return; }
      ui.msg = DM.buildBridge(G, ui.bridgeA[0], ui.bridgeA[1], x, y, +k.slice(5));
      ui.bridgeA = null; keepSpawn(k); draw(); return;
    }
    if (T[k]) ui.msg = DM.deploy(G, k, x, y);
    else if (k === 'min') {
      const err = DM.mineError(G, x, y);
      if (err) ui.msg = err;
      else if (DM.cur(G).dice > 0) { ui.mineAt = [x, y]; ui.msg = ''; draw(); return; }
      else { mine(x, y); return; }
    } else ui.msg = DM.buildSite(G, k, x, y);
    keepSpawn(k);
    draw();
  }
  // dopo averne messo uno, la stessa cosa resta selezionata finché ce n'è ancora nella riserva
  function keepSpawn(k) {
    const n = G.phase === 'play' ? DM.cur(G).res[k] || 0 : 0;
    ui.spawn = n > 0 ? k : '';
    if (ui.spawn) ui.msg = (ui.msg ? ui.msg + ' ' : '') + 'Nella riserva: ancora ' + n + '. Tocca la mappa per metterne un altro, oppure "Deseleziona".';
  }

  // Miniera: il dado rotola sulla mappa (animazione), poi compare la miniera
  function mine(x, y, die) {
    begin('mine');
    const r = DM.buildMine(G, x, y, die);
    ui.mineAt = null; ui.spawn = '';
    if (r.err) { ui.msg = r.err; keepSpawn('min'); draw(); return; }
    ui.msg = 'Miniera costruita: ' + (die ? 'scelto ' : 'dado ' + r.die + ', ') + r.mat + '. Prima produzione: ' + DM.fmtN(r.qty) + ' ' + DM.unitOf(r.mat) + '.';
    ui.selB = r.site; ui.sel = null;
    keepSpawn('min');
    if (die) { draw(); return; }   // minerale scelto (Maghi): niente dado che gira
    pend.x.die = r.die;
    if (DM.FX.on) $('info').innerHTML = `<span class="dice">${DICE[r.die - 1]}</span> Il dado gira…`;
    draw();
  }

  // ---------- Pulsanti nel pannello (delegati) ----------
  const ACT = {
    players: n => { DM.setPlayers(G, +n); },
    kit: i => { DM.chooseKit(G, +i); ui.msg = ''; },
    leave: id => { ui.msg = DM.leaveArmy(G, DM.unitById(G, id)); },
    deployhere: t => { ui.msg = DM.deploy(G, t, ui.selB.x, ui.selB.y); },
    upgrade: () => { ui.msg = DM.upgradeCamp(G, ui.selB); },
    makecap: () => { ui.msg = DM.chooseCapital(G, ui.selB); },
    inside: k => { ui.msg = DM.buildInside(G, ui.selB, k); },
    roadmode: () => { resetModes(); ui.mode = 'road'; ui.msg = 'Tocca l’altro tuo edificio da collegare, oppure l’estremità di un tuo ponte (la strada va in linea retta e si ferma all’acqua).'; },
    choose: i => { const c = ui.choice; ui.choice = null; ui.msg = c.run(c.list[+i]); ui.mode = ''; },
    bombmode: k => {
      const err = DM.bombError(G, ui.selB, k);
      if (err) { ui.msg = err; return; }
      resetModes(); ui.mode = 'bomb'; ui.bombKind = k;
      ui.msg = 'Tocca il bersaglio (portata ' + DM.bombRange(ui.selB, k) + ' cm' + (k === 'superbomba' ? ', colpisce tutto entro 0,5 cm' : '') + ').';
    },
    berrymode: k => {
      if (G.berried) { ui.msg = 'Puoi lanciare una sola bacca per turno.'; return; }
      resetModes(); ui.mode = 'berry'; ui.berryKind = k; ui.msg = 'Tocca la truppa da colpire, tua o nemica (portata ' + DM.BERRY_RANGE[ui.selB.k] + ' cm).';
    },
    potion: k => {
      const r = DM.usePotion(G, ui.selB, k);
      if (r.msg) { ui.msg = r.msg; return; }
      resetModes(); ui.mode = 'pz'; ui.pz = { k, left: r.left, first: true };
      ui.msg = k === 'poz_congela' ? 'Tocca il punto da congelare: tutte le truppe entro 2 cm (anche le tue) si fermano per 2 giri.' : k === 'poz_stipendio' ? 'Tocca fino a 3 tue truppe o eserciti.' : k === 'poz_velocita' ? 'Tocca la truppa o l’esercito.' : 'Tocca la truppa da curare (anche lontana).';
    },
    cedeb: () => { ui.cedeBTo = !ui.cedeBTo; },
    cedebto: o => { ui.msg = DM.cedeSite(G, ui.selB, +o); ui.cedeBTo = false; ui.selB = null; },
    load: a => { const [id, m] = a.split(':'); ui.msg = DM.loadCargo(G, DM.unitById(G, id), ui.selB, m, ui.cargoQty); },
    unload: a => { const [id, m] = a.split(':'); ui.msg = DM.unloadCargo(G, DM.unitById(G, id), ui.selB, m || undefined, ui.cargoQty); },
    cedekeep: () => { ui.keep = !ui.keep; },
    cedesnap: () => {
      const cd = ui.cede; cd.noSnap = !cd.noSnap;
      const r = DM.cedeCompute(G, cd.pts, cd.sx, cd.sy, cd.noSnap);
      if (r.err) { ui.msg = r.err; ui.mode = 'cedeside'; cd.cells = null; } else Object.assign(cd, r);
    },
    cedeto: o => { const r = DM.cedeApply(G, ui.cede.cells, +o, ui.keep); ui.msg = r.err || r.msg; if (!r.err) resetModes(); },
    cedenewp: () => { ui.cede.newp = true; },
    cedeback: () => { ui.cede.newp = false; },
    cedenew: i => { const r = DM.cedeNewPlayer(G, ui.cede.cells, +i, ui.keep); ui.msg = r.err || r.msg; ui.cede.newp = false; if (!r.err) resetModes(); },
    cedecancel: () => { resetModes(); ui.msg = 'Cessione annullata.'; },
    minedie: d => { const [x, y] = ui.mineAt; mine(x, y, +d || undefined); return true; },
    cancel: () => { resetModes(); ui.msg = ''; },
    download: () => {
      const a = document.createElement('a'), d = new Date();
      a.href = URL.createObjectURL(new Blob([DM.serialize(G)], { type: 'application/json' }));
      a.download = 'damamondo-giro' + G.round + '-' + d.toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      ui.msg = 'File della partita scaricato.';
    },
    deselect: () => { ui.sel = null; ui.msg = ''; },
    tomenu: () => { DM.leaveGame(); DM.showMenu('home'); return true; },
    fileyes: () => { const t = ui.pendingFile; ui.pendingFile = null; loadText(t, 'Partita aperta dal file.'); return true; },
    fileno: () => { ui.pendingFile = null; ui.msg = 'File non aperto.'; },
    opensite: id => { ui.selB = DM.siteById(G, id); ui.sel = null; ui.msg = ''; ui.cedeBTo = false; },
    board: a => { const [v, u] = a.split(':'); ui.msg = DM.board(G, DM.unitById(G, v), DM.unitById(G, u)); },
    unboard: a => { const [v, u] = a.split(':'); ui.msg = DM.unboard(G, DM.unitById(G, v), DM.unitById(G, u)); },
    done: () => { resetModes(); ui.msg = ''; },
    bank: () => { openSide('ecoP'); },
    cardok: () => { if (G.cardsShown) G.cardsShown.shift(); },
    wallup: () => { ui.msg = DM.upgradeWall(G, ui.selW); },
    walltrig: () => { ui.msg = DM.triggerWall(G, ui.selW); ui.selW = null; },
    moneyin: () => { ui.msg = DM.moveMoney(G, ui.selB, ui.moneyQty || 1000, true); },
    moneyout: () => { ui.msg = DM.moveMoney(G, ui.selB, ui.moneyQty || 1000, false); },
    buyk: k => { if (G.phase === 'play') ui.msg = DM.buy(G, ui.selB, k); },
    botpause: () => { ui.paused = !ui.paused; if (!ui.paused) { ui.sel = null; ui.selB = null; } else DM.FX.skip(); },
    botfast: () => { ui.botFast = !ui.botFast; DM.FX.quick = ui.botFast && botNow(); if (DM.FX.quick) DM.FX.skip(); }
  };

  // azioni dei pulsanti che mostrano un'animazione (le altre: solo pannelli)
  const FXK = { buyk: 'act', moneyin: 'act', moneyout: 'act', wallup: 'act', walltrig: 'act', deployhere: 'act', upgrade: 'act', makecap: 'act', inside: 'act', choose: 'act', potion: 'act', cedebto: 'act', load: 'act', unload: 'act',
    cedeto: 'act', cedenew: 'act', board: 'act', unboard: 'act', leave: 'act' };
  function onAction(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const a = b.dataset.act, f = ACT[a];
    if (!f) return;
    if (G && FXK[a]) {
      begin(FXK[a]);
      if (a === 'potion') pend.x = { potion: true, at: ui.selB ? [ui.selB.x, ui.selB.y] : null };
      if (a === 'choose' && ui.choice && ui.choice.fx) { const c = ui.choice, t = c.list[+b.dataset.arg]; pend.fx = () => c.fx(t); }
    }
    const handled = f(b.dataset.arg);
    if (pend && pend.fx) { const [k, x] = pend.fx(); pend.kind = k; pend.x = x; delete pend.fx; }
    if (!handled) draw(); else pend = null;
  }

  // ---------- Barra dei comandi ----------
  function endTurn(byBot) {
    if (G.phase !== 'play' || ui.rolling || (botNow() && !byBot)) return Promise.resolve();
    resetModes();
    ui.sel = null; ui.selB = null;
    begin('turn');
    ui.msg = DM.endTurn(G);
    DM.FX.quick = false;
    if (DM.isBot(G, G.p)) focusBotHome(); else focus();
    return draw();
  }

  // ---------- Bot: giocano da soli, un'azione alla volta, con le animazioni ----------
  let botSeq = 0, botBusy = false;
  // tutti i giocatori sono bot: si guarda la partita (e si può mettere in pausa)
  function allBots() { return !!G && !!G.bots && Array.from({ length: G.np }, (_, i) => i).every(i => G.bots[i]); }
  // in pausa: tocco su una truppa o un edificio di chiunque (ripetendo il tocco si passa al prossimo nello stesso punto)
  function look(x, y) {
    const us = G.units.filter(u => !u.carried && Math.hypot(u.x - x, u.y - y) < G.tapR).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
    const ss = DM.siteNear(G, x, y);
    const all = us.map(u => ['u', u]).concat(ss.map(z => ['s', z]));
    if (!all.length) { ui.sel = null; ui.selB = null; render(); return; }
    const cur = all.findIndex(([k, o]) => (k === 'u' ? ui.sel : ui.selB) === o);
    const [k, o] = all[(cur + 1) % all.length];
    ui.sel = k === 'u' ? o : null; ui.selB = k === 's' ? o : null;
    DM.Sfx.play('select');
    render();
  }
  function botNow() { return !!G && DM.isBot(G, G.p) && ['kit', 'cap', 'play'].includes(G.phase) && DM.alive(G).length > 1; }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function whilePaused(live) { while (ui.paused && allBots() && live()) await sleep(120); }
  const pause = () => ui.botFast ? 40 : 420;
  function focusBotHome() { const c = DM.capitalOf(G, G.p); if (c) focus(c.x, c.y); }
  // porta sullo schermo il punto dell'azione, se è fuori dalla parte libera
  function showSpot([x, y]) {
    const v = $('vp').getBoundingClientRect(), c = $('c').getBoundingClientRect(), px = c.left + x * ui.Z, py = c.top + y * ui.Z;
    if (px < v.left + 30 || px > v.right - 70 || py < v.top + 90 || py > v.top + v.height * .55) focus(x, y);
  }
  function maybeBot() {
    if (!botNow() || botBusy || $('game').hidden) return;
    botBusy = true;
    const my = ++botSeq, live = () => my === botSeq && !!G && !$('game').hidden;
    DM.FX.quick = !!ui.botFast;
    (async () => {
      try {
        await sleep(ui.botFast ? 120 : 650);
        while (live() && botNow() && G.phase !== 'play') {   // preparazione: kit e Capitale
          await whilePaused(live);
          begin('act');
          const r = DM.botSetup(G);
          ui.msg = r ? r.msg : '';
          if (r && r.at) { pend.kind = 'act'; focus(r.at[0], r.at[1]); }
          await draw(); await sleep(pause() * 2);
        }
        if (live() && botNow()) {
          const it = DM.botTurn(G);
          while (live()) {
            await whilePaused(live);
            if (!live()) break;
            const before = DM.FX.snap(G, 'act');
            const r = it.next();
            if (r.done) break;
            const a = r.value;
            ui.msg = a.msg; ui.sel = null; ui.selB = null;
            if (a.at && !ui.botFast) showSpot(a.at);
            await DM.FX.react(G, a.kind, before, a.x, render, a.msg);
            await sleep(pause());
          }
          await whilePaused(live);
          if (live() && botNow()) { await endTurn(true); await sleep(pause()); }
        }
      } catch (e) {
        ui.msg = 'Il bot si è bloccato: ' + e.message;
        if (live() && G.phase === 'play') await endTurn(true);   // per non fermare la partita
      } finally {
        if (my === botSeq) { botBusy = false; DM.FX.quick = false; }
      }
      if (live()) { render(); maybeBot(); }
    })();
  }
  DM.botRunning = () => botBusy;
  function undo() {
    begin('undo');
    ui.msg = DM.undoMove(G, ui.sel);
    draw();
  }
  function army() {
    if (G.phase !== 'play') return;
    if (ui.mode === 'army') {
      if (ui.pick.length >= 2) {
        begin('army');
        const r = DM.formArmy(G, ui.pick);
        ui.msg = r.err || r.msg;
        if (!r.err) ui.sel = ui.pick[0];
      } else ui.msg = 'Formazione annullata (servono almeno 2 truppe).';
      ui.mode = ''; ui.pick = [];
    } else if (ui.mode) ui.msg = 'Finisci prima l’azione in corso.';
    else { resetModes(); ui.mode = 'army'; ui.sel = null; ui.selB = null; ui.msg = 'Tocca la prima truppa dell’esercito (le altre entro 1 cm).'; }
    draw();
  }
  function shoot() {
    if (G.phase !== 'play') return;
    if (ui.mode === 'shoot') { ui.mode = ''; ui.msg = 'Sparo annullato.'; }
    else if (ui.mode) ui.msg = 'Finisci prima l’azione in corso.';
    else { const err = DM.shootError(G, ui.sel); if (err) ui.msg = err; else { ui.mode = 'shoot'; ui.msg = 'Tocca il bersaglio nemico (truppa, edificio o ponte).'; } }
    draw();
  }
  function cede() {
    if (G.phase !== 'play') return;
    if (ui.mode === 'cede') {
      if (ui.cede.pts.length < 2) ui.msg = 'Servono almeno 2 punti.';
      else { ui.mode = 'cedeside'; ui.msg = 'Tocca un punto del tuo territorio, dal lato che vuoi cedere.'; }
    } else if (ui.mode === 'cedeside' || ui.mode === 'cedeto') { resetModes(); ui.msg = 'Cessione annullata.'; }
    else if (ui.mode) ui.msg = 'Finisci prima l’azione in corso.';
    else { resetModes(); ui.mode = 'cede'; ui.cede = { pts: [] }; ui.sel = null; ui.selB = null; ui.msg = 'Tocca i punti della linea di cessione, poi premi "Conferma linea".'; $('oR').checked = true; }
    draw();
  }
  // Zoom tenendo fermo il punto (px, py) dello schermo (di solito il centro, oppure tra le due dita)
  function zoomAt(f, px, py) {
    const v = $('vp'), r = v.getBoundingClientRect(), c = $('c').getBoundingClientRect();
    if (px === undefined) { px = r.left + v.clientWidth / 2; py = r.top + v.clientHeight * .45; }
    const mx = (px - c.left) / ui.Z, my = (py - c.top) / ui.Z;   // punto della mappa sotto le dita (cm)
    ui.Z = Math.min(MAXZ, Math.max(minZoom(), ui.Z * f));
    render();
    const c2 = $('c').getBoundingClientRect();
    v.scrollLeft += (c2.left + mx * ui.Z) - px; v.scrollTop += (c2.top + my * ui.Z) - py;
  }
  const zoom = f => zoomAt(f);
  // più piccolo: tutta la mappa sullo schermo; all'inizio: la mappa riempie lo schermo
  // spazio libero (senza la barra in alto, i comandi e i margini)
  const free = () => { const v = $('vp'), st = getComputedStyle($('vpin')), px = k => parseFloat(st[k]) || 0;
    return [v.clientWidth - px('paddingLeft') - px('paddingRight'), v.clientHeight - px('paddingTop') - px('paddingBottom')]; };
  const MAXZ = 96;    // ingrandimento massimo (pixel per cm)
  const fitZoom = () => { const [w, h] = free(); return Math.max(3, Math.min(w / W, h / H, MAXZ)); };
  const coverZoom = () => { const v = $('vp'); return Math.max(fitZoom(), Math.min(MAXZ, Math.max(v.clientWidth / W, v.clientHeight / H))); };
  const minZoom = fitZoom;
  // porta la Capitale (o il punto x, y) un po' sopra il centro, dove non c'è il riquadro in basso
  function focus(x, y) {
    const c = x === undefined ? G.phase === 'play' && DM.capitalOf(G, G.p) : { x, y }, v = $('vp');
    if (!c) return;
    const cv = $('c'), ox = cv.offsetLeft, oy = cv.offsetTop;
    v.scrollLeft = ox + c.x * ui.Z - v.clientWidth / 2; v.scrollTop = oy + c.y * ui.Z - v.clientHeight * .4;
  }
  DM.focusMap = focus;

  // Due dita: si allarga e si stringe la mappa (durante il gesto si ingrandisce l'immagine, alla fine si ridisegna)
  function pinch() {
    const v = $('vp'), cv = $('c');
    let p0 = null;
    const mid = t => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    v.addEventListener('touchstart', e => {
      if (e.touches.length !== 2) return;
      const r = cv.getBoundingClientRect(), m = mid(e.touches);
      p0 = { d: dist(e.touches), m, ox: m[0] - r.left, oy: m[1] - r.top, s: 1 };
      cv.style.transformOrigin = p0.ox + 'px ' + p0.oy + 'px';
    }, { passive: true });
    v.addEventListener('touchmove', e => {
      if (!p0 || e.touches.length !== 2) return;
      e.preventDefault();
      const lo = minZoom() / ui.Z, hi = MAXZ / ui.Z;
      p0.s = Math.min(hi, Math.max(lo, dist(e.touches) / p0.d));
      cv.style.transform = `scale(${p0.s})`;
    }, { passive: false });
    const end = e => {
      if (!p0 || e.touches.length >= 2) return;
      const s = p0.s, m = p0.m; p0 = null;
      cv.style.transform = ''; cv.style.transformOrigin = '';
      if (Math.abs(s - 1) > .02) zoomAt(s, m[0], m[1]);
    };
    v.addEventListener('touchend', end); v.addEventListener('touchcancel', end);
    // computer: si tiene premuto il tasto sinistro e si trascina la mappa (un trascinamento non conta come clic)
    let drag = null;
    v.addEventListener('pointerdown', e => {
      ui.dragged = 0;   // un nuovo clic: quello di prima non era un trascinamento
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, l: v.scrollLeft, t: v.scrollTop, moved: false, id: e.pointerId };
    });
    v.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 6) return;
      if (!drag.moved) { drag.moved = true; v.classList.add('dragging'); try { v.setPointerCapture(e.pointerId); } catch (er) { /* niente */ } }
      v.scrollLeft = drag.l - dx; v.scrollTop = drag.t - dy;
    });
    const stop = e => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      if (drag.moved) { v.classList.remove('dragging'); ui.dragged = Date.now(); }
      drag = null;
    };
    v.addEventListener('pointerup', stop); v.addEventListener('pointercancel', stop);
    // computer: la rotellina ingrandisce e rimpicciolisce (per spostarsi si trascina la mappa)
    v.addEventListener('wheel', e => { e.preventDefault(); const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY; zoomAt(Math.exp(-Math.max(-200, Math.min(200, d)) / 300), e.clientX, e.clientY); }, { passive: false });
  }

  // ---------- Tendina: Banco, Vista, Partita, Aiuto ----------
  function openSide(tab) {
    const d = $('side');
    d.hidden = false;
    showTab(tab || d.dataset.tab || 'ecoP');
    const t = d.querySelector('[aria-selected="true"]'); if (t) t.focus();
  }
  function closeSide() { $('side').hidden = true; }
  function showTab(tab) {
    $('side').dataset.tab = tab;
    document.querySelectorAll('#side [data-tab]').forEach(b => { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
    document.querySelectorAll('#side .tab').forEach(p => { p.hidden = p.id !== tab; });
  }
  DM.openSide = openSide;

  // ---------- Salvataggi: la partita sta in uno dei 3 posti (vedi menu.js) ----------
  let lastAuto = '';
  function autosave() {
    if (!ui.slot || G.phase === 'num' || G.map.custom) return;
    const text = DM.serialize(G);
    if (text === lastAuto) return;
    lastAuto = text;
    ui.autoOk = DM.Slots.put(ui.slot, text);
  }
  function savesPanel() {
    $('saveT').innerHTML = (ui.slot && ui.autoOk !== false ? '<small>La partita si salva da sola in questo telefono a ogni mossa. Dal Menu la ritrovi in "Gioca → Locale".</small>' : '<small class="warn">Qui il salvataggio automatico non funziona: usa "Scarica file".</small>') +
      row(btn('download', 'Scarica file') + '<label class="file">Apri file<input type="file" id="openfile" accept=".json,application/json"></label>');
  }
  function loadText(text, msg) {
    try {
      const H = DM.deserialize(text);
      DM.playGame(H, ui.slot);
      ui.msg = msg; lastAuto = ''; draw();
    } catch (e) { ui.msg = 'Non riesco a caricare: ' + e.message; draw(); }
  }

  // Mostra la schermata di gioco con la partita H, salvata nel posto "slot"
  DM.playGame = function (H, slot) {
    botSeq++; botBusy = false; DM.FX.quick = false;
    DM.FX.stopAll();
    G = DM.game = H;
    Object.assign(ui, { sel: null, selB: null, msg: '', slot: slot || null, autoOk: undefined, paused: false });
    resetModes();
    lastAuto = '';
    $('menu').hidden = true; $('game').hidden = false; closeSide();
    document.body.classList.add('ingame');
    if (DM.Music) DM.Music.setScene('game');
    ui.Z = coverZoom();
    draw(); focus();
  };
  DM.leaveGame = function () { botSeq++; botBusy = false; DM.FX.quick = false; DM.FX.stopAll(); if (G) autosave(); };

  DM.startUI = function () {
    $('sp').onchange = e => {
      if (G.phase !== 'play') return;
      const k = e.target.value;
      resetModes();
      ui.spawn = k;
      ui.sel = null;
      if (!k) { ui.msg = ''; draw(); return; }   // "Deseleziona"
      ui.msg = ui.spawn ? (T[ui.spawn] ? 'Tocca la mappa per schierare ' + T[ui.spawn].name + (T[ui.spawn].kind === 'sea' ? ' (dentro un tuo Porto).' : ui.spawn === 'A' ? ' (dentro un tuo Aeroporto).' : ' (entro 2 cm dalla Capitale, 1 cm da Città e Accampamenti).') :
        ui.spawn === 'mina' || ui.spawn === 'minaA' ? 'Tocca dove posare la mina (entro 1 cm da una tua truppa). Gli avversari non la vedranno.' :
        ui.spawn === 'muro' ? 'Tocca l’inizio del muro, poi la fine (1 pezzo per cm, al massimo 5 cm, nel tuo territorio).' :
        ui.spawn.startsWith('ponte') ? 'Tocca la terra da una parte dell’acqua, poi dall’altra. Ogni cm di ponte usa un pezzo (anche 0,7 cm usa 1 pezzo, 1,3 cm ne usa 2).' :
        'Tocca la mappa per costruire ' + DM.nameOf(ui.spawn) + (ui.spawn === 'porto' ? ' (in acqua, vicino alla tua costa).' : ' (nel tuo territorio, con una tua truppa entro 2 cm).')) : '';
      draw();
    };
    $('c').addEventListener('click', e => {
      if (ui.dragged && Date.now() - ui.dragged < 300) return;   // era un trascinamento della mappa
      const r = $('c').getBoundingClientRect();
      tap((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
    });
    // durante un'animazione che blocca (la bomba in volo, il dado…), un tocco la salta e basta
    document.addEventListener('click', e => {
      if (!DM.FX.busy || $('game').hidden || e.target.closest('[data-settings], #settings')) return;
      if (e.target.closest('#c')) return;   // sulla mappa ci pensa tap()
      DM.FX.skip(); e.stopPropagation(); e.preventDefault();
    }, true);
    document.addEventListener('click', onAction);
    document.addEventListener('input', e => { if (e.target.id === 'cq') ui.cargoQty = Math.max(0, Math.floor(+e.target.value) || 0); if (e.target.id === 'mq') ui.moneyQty = Math.max(0, Math.floor(+e.target.value) || 0); });
    $('end').onclick = endTurn; $('undo').onclick = undo; $('army').onclick = army; $('shoot').onclick = shoot; $('ced').onclick = cede;
    $('zi').onclick = () => zoom(1.25); $('zo').onclick = () => zoom(.8);
    pinch();
    // tendina
    document.addEventListener('click', e => {
      const o = e.target.closest('[data-side]'); if (o) { openSide(o.dataset.side); return; }
      if (e.target.closest('[data-side-close]')) { closeSide(); return; }
      const t = e.target.closest('#side [data-tab]'); if (t) showTab(t.dataset.tab);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('side').hidden && $('settings').hidden) closeSide(); });
    // riquadro delle informazioni: si riduce e si allarga
    $('grip').onclick = () => { const m = $('sheet').classList.toggle('min'); $('grip').setAttribute('aria-expanded', String(!m)); };
    document.addEventListener('change', e => {
      if (e.target.id !== 'openfile' || !e.target.files[0]) return;
      if (!G) return;
      const r = new FileReader();
      r.onload = () => { ui.pendingFile = String(r.result); e.target.value = ''; draw(); };
      r.readAsText(e.target.files[0]);
    });
    ['oS', 'oG', 'oB', 'oR', 'oU'].forEach(i => { $(i).onchange = () => { if (i === 'oB' && !$('oB').checked) $('oR').checked = true; draw(); }; });
    DM.MATERIALS.forEach(m => $('bm').add(new Option(m + ' · ' + DM.fmtN(DM.BANK[m][0]) + ' ' + DM.unitOf(m) + ' = ' + DM.fmtN(DM.BANK[m][1]) + ' soldi', m)));
    $('bs').onclick = () => { if (G.phase !== 'play') return; begin('act'); ui.msg = DM.sell(G, ui.selB, $('bm').value, +$('bq').value); draw(); };
    $('vp').addEventListener('scroll', () => { if (G && !$('bubble').hidden) placeBubble(); }, { passive: true });
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!$('game').hidden) { ui.Z = Math.max(ui.Z, minZoom()); render(); } }, 150); });
  };
})(globalThis.DM = globalThis.DM || {});
