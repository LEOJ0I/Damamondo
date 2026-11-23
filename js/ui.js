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
    bombKind: '', berryKind: '', pz: null, bridgeLv: 1, cargoQty: 0, cedeBTo: false, mineAt: null, rolling: false, Z: 10
  };
  const view = () => ({ sheets: $('oS').checked, biomes: $('oB').checked, terr: $('oR').checked, units: $('oU').checked, grid: $('oG').checked });
  const tapR = () => Math.max(.5, Math.min(1.5, 16 / ui.Z));   // circa 16 pixel, tra 0,5 e 1,5 cm
  const pcol = o => DM.PLAYER_COLORS[o];
  const btn = (act, label, arg, cls) => `<button type="button" data-act="${act}"${arg !== undefined ? ` data-arg="${arg}"` : ''}${cls ? ` class="${cls}"` : ''}>${label}</button>`;
  const row = html => html ? `<div class="r">${html}</div>` : '';

  function resetModes() {
    ui.mode = ''; ui.pick = []; ui.cede = null; ui.pz = null; ui.cedeBTo = false; ui.mineAt = null; ui.spawn = '';
    $('sp').value = '';
  }

  // ---------- Disegno e pannelli ----------
  function draw() {
    if (!G) return;
    G.tapR = tapR();
    if (ui.sel && !G.units.includes(ui.sel)) ui.sel = null;
    if (ui.selB && !G.sites.includes(ui.selB)) ui.selB = null;
    DM.draw($('c'), G, ui, view(), ui.Z);
    hud(); info(); eco(); reserveMenu(); legend(); buttons();
  }
  DM.redraw = draw;

  function hud() {
    $('seedInfo').textContent = 'Mappa attuale: numero ' + G.seed + ' (stesse opzioni + stesso numero = stessa mappa).';
    if (G.phase !== 'play') { $('hud').innerHTML = `<b>Preparazione</b><span>${G.phase === 'num' ? '' : G.names[G.p]}</span>`; return; }
    const q = DM.cur(G);
    $('hud').innerHTML = `<b style="color:${pcol(G.p)}">${G.names[G.p]}</b><span>Giro <b>${G.round}</b></span>` +
      `<span>Mosse ${G.moved}/${DM.moveLimit(G.round)} · Spari ${G.shots}/${DM.shotLimit(G.round)}</span>` +
      (q.noCap ? '<span class="warn">Senza Capitale!</span>' : '');
  }

  function buttons() {
    const play = G.phase === 'play';
    document.querySelectorAll('.playonly').forEach(b => { b.disabled = !play; });
    $('army').textContent = ui.mode === 'army' ? 'Conferma esercito' : 'Forma esercito';
    $('ced').textContent = ui.mode === 'cede' ? 'Conferma linea' : (ui.mode === 'cedeside' || ui.mode === 'cedeto') ? 'Annulla cessione' : 'Cedi territorio';
    $('shoot').textContent = ui.mode === 'shoot' ? 'Annulla sparo' : 'Spara';
  }

  function info() {
    const f = $('info');
    if (ui.rolling) return;
    if (G.phase === 'num') { f.innerHTML = '<b>Quanti giocatori?</b>' + row([2, 3, 4, 5, 6].map(n => btn('players', n, n)).join('')); return; }
    if (G.phase === 'kit') {
      f.innerHTML = `<b style="color:${pcol(G.p)}">${G.names[G.p]}</b>: scegli il kit` +
        row(DM.KITS.map((k, i) => btn('kit', k.name, i)).join('')) + `<small>${kitHelp()}</small>`;
      return;
    }
    if (G.phase === 'cap') {
      f.innerHTML = `<b style="color:${pcol(G.p)}">${G.names[G.p]}</b> (${DM.KITS[G.players[G.p].kit].name}): tocca la mappa per piazzare la Capitale.` +
        (ui.msg ? `<p class="msg">${ui.msg}</p>` : '');
      return;
    }
    let s = '';
    if (ui.mode === 'cedeto') s = cedeUI();
    else if (ui.mineAt) s = '<b>Miniera</b>: scegli il risultato del dado (kit Maghi, ancora ' + DM.cur(G).dice + ')' + row([1, 2, 3, 4, 5, 6].map(d => btn('minedie', DICE[d - 1] + ' ' + d, d)).join('') + btn('minedie', 'Tira il dado', 0) + btn('cancel', 'Annulla'));
    else if (ui.sel) s = unitInfo(ui.sel);
    else if (ui.selB) s = siteInfo(ui.selB);
    if (['road', 'bridge', 'bomb', 'berry', 'pz', 'shoot', 'army'].includes(ui.mode) || ui.spawn) s = row(btn('cancel', ui.mode === 'pz' && !ui.pz.first ? 'Fatto' : 'Annulla')) + s;
    f.innerHTML = (ui.msg ? `<p class="msg">${ui.msg}</p>` : '') + (s || (!ui.msg ? '<small>Tocca una tua truppa o un tuo edificio.</small>' : ''));
  }

  function kitHelp() {
    return DM.KITS.map(k => `<b>${k.name}</b>: ${DM.fmtN(k.money)} soldi` + [['S', 'Soldati'], ['N', 'Navi'], ['E', 'Elicotteri'], ['acc', 'Accampamenti'], ['citta', 'Città'], ['porto', 'Porti'], ['min', 'Miniere'], ['aer', 'Aeroporti'], ['ponte1', 'Ponte liv.1']]
      .filter(e => k[e[0]]).map(e => ', ' + k[e[0]] + ' ' + e[1]).join('') + (k.materials ? ', 1 punto di ogni materiale' : '') + (k.potions ? ', 2 pozioni di ogni tipo (1 Stipendio+)' : '')).join('<br>') +
      '<br>Tutti: Capitale con Aeroporto gratis e 1 Carro.';
  }

  function unitInfo(u) {
    const t = T[u.t], b = DM.bAt(G, u.x, u.y), A = DM.armyOf(G, u), st = DM.stat(G, u);
    const spd = Math.min(...A.map(q => DM.speedAt(G, q, q.x, q.y)));
    let s = `<b style="color:${pcol(u.o)}">${u.g ? 'Esercito ' + u.an + ' (' + DM.composition(A) + ')' : t.name}</b> su ${DM.BIOME_NAME[b]}` +
      (u.g ? ` · ${DM.armyPts(A)}/100 punti` : ` · vita ${u.hp}/${t.hp} · danno ${st[0]} · gittata ${st[1]} cm`) +
      ` · velocità qui ${spd} cm` + (u.m ? ' · già mossa' : '') + (u.s ? ' · ha sparato' : '') +
      (u.bf && u.bf.until > G.round ? ' · bacca ' + DM.BIOME_NAME[u.bf.k] + ' fino al giro ' + (u.bf.until - 1) : '') +
      (u.bn > 0 ? ' · brucia ancora ' + u.bn + ' turni' : '') + (u.oc ? ' · in territorio nemico da ' + u.oc + ' giri' : '');
    if (u.cg) s += '<br>Carico: ' + DM.fmtInv(u.cg) + ` (${DM.cargoPts(u.cg).toFixed(1)}/${DM.CARGO_CAP[u.t]} punti)`;
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

  function siteInfo(s) {
    const q = DM.cur(G), mine = s.o === G.p, I = s.inv;
    const inside = G.units.filter(u => u.o === s.o && Math.hypot(u.x - s.x, u.y - s.y) <= .3);
    let h = `<b style="color:${pcol(s.o)}">${DM.nameOf(s.k)}${s.par ? ' (dentro una città)' : ''}</b> · vita ${s.hp}/${DM.maxHp(s)}` +
      (s.k === 'min' ? ' · ' + s.mt : '') + (s.ign ? ' · ignifuga' : '') + (s.up ? ' · migliorata' : '') +
      `<br>Contiene: ${DM.fmtInv(I)}` + (inside.length ? '<br>Truppe dentro: ' + DM.composition(inside) : '');
    const inner = G.sites.filter(z => z.par === s.id);
    if (inner.length) h += row('<span>Dentro:</span>' + inner.map(z => btn('opensite', (z.k === 'aer' ? '✈ ' : '⚓ ') + DM.nameOf(z.k), z.id)).join(''));
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
    b.push(btn('roadmode', 'Collega con strada'), btn('bridgemode', 'Ponte liv.1' + (q.res.ponte1 ? ' (gratis)' : ''), 1), btn('bridgemode', 'Ponte liv.2', 2));
    if (I.mat.bomba > 0 && DM.BOMB.bomba.from.includes(s.k)) b.push(btn('bombmode', 'Lancia Bomba (' + I.mat.bomba + ')', 'bomba'));
    if (I.mat.superbomba > 0 && DM.BOMB.superbomba.from.includes(s.k)) b.push(btn('bombmode', 'Lancia Superbomba (' + I.mat.superbomba + ')', 'superbomba'));
    if (DM.BERRY_RANGE[s.k]) Object.keys(DM.BERRIES).filter(k => I.mat['bacca_' + k] > 0).forEach(k => b.push(btn('berrymode', 'Bacca ' + k + ' (' + I.mat['bacca_' + k] + ')', k)));
    Object.keys(DM.POTIONS).filter(k => I.mat[k] > 0).forEach(k => b.push(btn('potion', 'Usa ' + DM.POTIONS[k] + ' (' + I.mat[k] + ')', k)));
    if (s.k !== 'cap') b.push(btn('cedeb', 'Cedi edificio'));
    h += row(b.join(''));
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
        return `<div><b>${T[c.t].name}</b> ${DM.cargoPts(g).toFixed(1)}/${DM.CARGO_CAP[c.t]} punti · ${DM.fmtInv(g)}` +
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
    const k = $('by').value;
    $('ecoT').innerHTML = (s ? `<b>${DM.nameOf(s.k)}</b>: ${DM.fmtInv(s.inv)}` : '<small>Seleziona un tuo edificio: si vende e si compra con quello che c’è dentro.</small>') +
      (G.phase === 'play' ? `<br><small>Miniere: ${G.sites.filter(z => z.k === 'min' && z.o === G.p).length} · soldi totali: ${DM.fmtN(DM.moneyOf(G, G.p))}${DM.cur(G).sold ? ' · venduto in questo turno: ' + DM.cur(G).sold : ''}</small>` : '') +
      `<br><small>Costo ${DM.nameOf(k)}: ${DM.costsText(k)}</small>`;
  }

  function reserveMenu() {
    const sp = $('sp'), r = G.phase === 'play' ? DM.cur(G).res : {};
    const keys = Object.keys(r).filter(k => r[k] > 0 && k !== 'ponte1');
    const want = keys.map(k => k + r[k]).join(',');
    if (sp.dataset.k !== want) {
      sp.dataset.k = want;
      sp.length = 1;
      keys.forEach(k => sp.add(new Option((T[k] ? 'Schiera ' : 'Costruisci ') + DM.nameOf(k) + ' (' + r[k] + ')', k)));
    }
    sp.value = ui.spawn;
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
    if (ui.rolling) return;
    if (G.phase === 'cap') {
      ui.msg = DM.placeCapital(G, x, y);
      if (G.phase === 'play') focus();
      draw(); return;
    }
    if (G.phase !== 'play') return;
    if (!$('oU').checked) { ui.msg = 'Truppe nascoste: riattivale per giocare.'; draw(); return; }
    const m = ui.mode;
    if (m === 'cede') { ui.cede.pts.push([x, y]); ui.msg = ui.cede.pts.length + ' punti: continua a toccare o premi "Conferma linea".'; draw(); return; }
    if (m === 'cedeside') {
      const r = DM.cedeCompute(G, ui.cede.pts, x, y, ui.cede.noSnap);
      if (r.err) ui.msg = r.err; else { Object.assign(ui.cede, r, { sx: x, sy: y }); ui.mode = 'cedeto'; ui.msg = ''; }
      draw(); return;
    }
    if (m === 'cedeto' || ui.mineAt) return;
    if (m === 'bridge') { ui.msg = DM.buildBridge(G, ui.selB, x, y, ui.bridgeLv); ui.mode = ''; draw(); return; }
    if (m === 'road') {
      const b = DM.siteNear(G, x, y, s => s.o === G.p && s !== ui.selB)[0];
      ui.msg = DM.buildRoad(G, ui.selB, b); ui.mode = ''; draw(); return;
    }
    if (m === 'bomb') { ui.msg = DM.launchBomb(G, ui.selB, ui.bombKind, x, y); ui.mode = ''; draw(); return; }
    if (m === 'berry') { ui.msg = DM.throwBerry(G, ui.selB, ui.berryKind, x, y); ui.mode = ''; draw(); return; }
    if (m === 'pz') {
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
    if (m === 'shoot') { ui.msg = DM.shoot(G, ui.sel, x, y); ui.mode = ''; draw(); return; }
    if (ui.spawn) { spawnTap(x, y); return; }

    const own = v => v.o === G.p;
    const hit = DM.unitNear(G, x, y, own);
    const sites = DM.siteNear(G, x, y, own);
    if (hit && hit === ui.sel) {   // secondo tocco sulla truppa: passa all'edificio sotto, oppure deseleziona
      ui.sel = null; ui.selB = sites[0] || null; ui.msg = sites.length ? '' : 'Truppa deselezionata.'; draw(); return;
    }
    if (!hit && !ui.sel && sites.length) { ui.selB = sites[(sites.indexOf(ui.selB) + 1) % sites.length]; ui.msg = ''; ui.cedeBTo = false; draw(); return; }
    if (hit) { ui.sel = hit; ui.selB = null; ui.msg = hit.m ? 'Questa truppa ha già mosso.' : 'Tocca la destinazione.'; draw(); return; }
    if (!ui.sel) {
      const enemyU = DM.unitNear(G, x, y), enemyS = DM.siteNear(G, x, y)[0];
      ui.selB = null;
      ui.msg = enemyU ? unitInfo(enemyU) : enemyS ? siteInfo(enemyS) : 'Tocca una tua truppa o un tuo edificio.';
      draw(); return;
    }
    ui.msg = DM.moveUnit(G, ui.sel, x, y);
    draw();
  }

  function spawnTap(x, y) {
    const k = ui.spawn;
    if (T[k]) ui.msg = DM.deploy(G, k, x, y);
    else if (k === 'min') {
      const err = DM.mineError(G, x, y);
      if (err) ui.msg = err;
      else if (DM.cur(G).dice > 0) { ui.mineAt = [x, y]; ui.msg = ''; draw(); return; }
      else { mine(x, y); return; }
    } else ui.msg = DM.buildSite(G, k, x, y);
    ui.spawn = '';
    draw();
  }

  function mine(x, y, die) {
    const r = DM.buildMine(G, x, y, die);
    ui.spawn = ''; ui.mineAt = null;
    if (r.err) { ui.msg = r.err; draw(); return; }
    const done = 'Miniera costruita: dado ' + r.die + ', ' + r.mat + '. Prima produzione: ' + DM.fmtN(r.qty) + ' ' + DM.unitOf(r.mat) + '.';
    ui.selB = r.site; ui.sel = null;
    draw();
    ui.rolling = true;
    let n = 0;
    const t = setInterval(() => {
      n++;
      $('info').innerHTML = `<span class="dice">${DICE[n >= 10 ? r.die - 1 : Math.floor(Math.random() * 6)]}</span> Il dado gira…`;
      if (n >= 10) { clearInterval(t); setTimeout(() => { ui.rolling = false; ui.msg = done; draw(); }, 400); }
    }, 100);
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
    roadmode: () => { resetModes(); ui.mode = 'road'; ui.msg = 'Tocca l’altro tuo edificio da collegare (la strada passa in linea retta).'; },
    bridgemode: lv => { resetModes(); ui.mode = 'bridge'; ui.bridgeLv = +lv; ui.msg = 'Tocca la terra dall’altra parte dell’acqua (il ponte parte dall’edificio selezionato).'; },
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
      ui.msg = k === 'poz_stipendio' ? 'Tocca fino a 3 tue truppe o eserciti.' : k === 'poz_velocita' ? 'Tocca la truppa o l’esercito.' : 'Tocca la truppa da curare (dentro l’edificio).';
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
    deselect: () => { ui.sel = null; ui.msg = ''; },
    opensite: id => { ui.selB = DM.siteById(G, id); ui.sel = null; ui.msg = ''; ui.cedeBTo = false; },
    board: a => { const [v, u] = a.split(':'); ui.msg = DM.board(G, DM.unitById(G, v), DM.unitById(G, u)); },
    unboard: a => { const [v, u] = a.split(':'); ui.msg = DM.unboard(G, DM.unitById(G, v), DM.unitById(G, u)); },
    done: () => { resetModes(); ui.msg = ''; }
  };

  function onAction(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const f = ACT[b.dataset.act];
    if (!f) return;
    const handled = f(b.dataset.arg);
    if (!handled) draw();
  }

  // ---------- Barra dei comandi ----------
  function endTurn() {
    if (G.phase !== 'play' || ui.rolling) return;
    resetModes();
    ui.sel = null; ui.selB = null;
    ui.msg = DM.endTurn(G);
    draw(); focus();
  }
  function undo() {
    ui.msg = DM.undoMove(G, ui.sel);
    draw();
  }
  function army() {
    if (G.phase !== 'play') return;
    if (ui.mode === 'army') {
      if (ui.pick.length >= 2) {
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
  function zoom(f) {
    const v = $('vp'), cx = (v.scrollLeft + v.clientWidth / 2) / ui.Z, cy = (v.scrollTop + v.clientHeight / 2) / ui.Z;
    ui.Z = Math.min(48, Math.max(minZoom(), ui.Z * f));
    draw();
    v.scrollLeft = cx * ui.Z - v.clientWidth / 2; v.scrollTop = cy * ui.Z - v.clientHeight / 2;
  }
  const minZoom = () => Math.max(3, Math.min(($('vp').clientWidth - 2) / W, 48));
  function focus() {
    const c = G.phase === 'play' && DM.capitalOf(G, G.p), v = $('vp');
    if (!c) return;
    v.scrollLeft = c.x * ui.Z - v.clientWidth / 2; v.scrollTop = c.y * ui.Z - v.clientHeight / 2;
  }

  function newGame(ask) {
    if (ask && G && G.phase === 'play' && !confirm('Iniziare una nuova partita? Quella in corso si perde.')) return;
    const opts = { isl: +$('isl').value, hum: +$('hum').value, temp: +$('tmp').value, comp: +$('cmp').value };
    $('info').innerHTML = 'Creo la mappa…';
    setTimeout(() => {
      const seed = Math.floor(+$('seed').value) || Math.floor(Math.random() * 9999) + 1;
      G = DM.game = DM.newGame(opts, seed);
      Object.assign(ui, { sel: null, selB: null, msg: '' });
      resetModes();
      draw();
    }, 20);
  }

  DM.startUI = function (game) {
    $('sp').onchange = e => {
      if (G.phase !== 'play') return;
      const k = e.target.value;
      resetModes();
      ui.spawn = k;
      ui.sel = null;
      ui.msg = ui.spawn ? (T[ui.spawn] ? 'Tocca la mappa per schierare ' + T[ui.spawn].name + (T[ui.spawn].kind === 'sea' ? ' (dentro un tuo Porto).' : ui.spawn === 'A' ? ' (dentro un tuo Aeroporto).' : ' (entro 2 cm da Capitale, Città o Accampamento).') :
        'Tocca la mappa per costruire ' + DM.nameOf(ui.spawn) + (ui.spawn === 'porto' ? ' (in acqua, vicino alla tua costa).' : ' (nel tuo territorio, con una tua truppa entro 2 cm).')) : '';
      draw();
    };
    $('c').addEventListener('click', e => {
      const r = $('c').getBoundingClientRect();
      tap((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
    });
    document.addEventListener('click', onAction);
    document.addEventListener('input', e => { if (e.target.id === 'cq') ui.cargoQty = Math.max(0, Math.floor(+e.target.value) || 0); });
    $('end').onclick = endTurn; $('undo').onclick = undo; $('army').onclick = army; $('shoot').onclick = shoot; $('ced').onclick = cede;
    $('zi').onclick = () => zoom(1.25); $('zo').onclick = () => zoom(.8);
    $('map').onclick = () => newGame(true);
    $('r5').onclick = () => { if (G.phase === 'play') { G.round += 5; ui.msg = 'Giro ' + G.round + ': limiti aggiornati (solo per prova, senza produzione).'; draw(); } };
    ['oS', 'oG', 'oB', 'oR', 'oU'].forEach(i => { $(i).onchange = () => { if (i === 'oB' && !$('oB').checked) $('oR').checked = true; draw(); }; });
    DM.MATERIALS.forEach(m => $('bm').add(new Option(m + ' · ' + DM.fmtN(DM.BANK[m][0]) + ' ' + DM.unitOf(m) + ' = ' + DM.fmtN(DM.BANK[m][1]) + ' soldi', m)));
    DM.BUYABLE.forEach(k => $('by').add(new Option(DM.nameOf(k), k)));
    $('by').onchange = () => eco();
    $('bs').onclick = () => { if (G.phase !== 'play') return; ui.msg = DM.sell(G, ui.selB, $('bm').value, +$('bq').value); draw(); };
    $('bb').onclick = () => { if (G.phase !== 'play') return; ui.msg = DM.buy(G, ui.selB, $('by').value); draw(); };
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(draw, 150); });
    ui.Z = minZoom();
    G = DM.game = game;
    draw();
  };
})(globalThis.DM = globalThis.DM || {});
