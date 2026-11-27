// Damamondo – i bot: giocatori guidati dal computer. Usano le stesse regole delle persone e non barano
// (fanno solo quello che si può fare dai pulsanti). Nessun DOM qui: si provano da soli in Node.
// DM.botSetup(G): sceglie il kit e piazza la Capitale.
// DM.botTurn(G): "generatore" che fa UNA azione alla volta; dopo ogni azione restituisce cosa ha fatto
//   ({kind, x, msg, at}), così la pagina può mostrarla con le animazioni. Finite le azioni, si chiama DM.endTurn.
(function (DM) {
  'use strict';
  const T = DM.TROOPS;

  DM.BOT_NAMES = ['Generale Rosso', 'Ammiraglia Blu', 'Barone Verde', 'Duchessa Arancio', 'Mago Viola', 'Capitana Turchese'];
  DM.BOT_LEVELS = { facile: 'Facile', normale: 'Normale', difficile: 'Difficile' };
  // Come gioca ogni livello
  const LEVEL = {
    facile: { moves: .5, aggro: 5, armies: false, bombs: false, superbomb: false, buy: ['min', 'S', 'acc'], buys: 1, keep: 60000, shootP: .6, defend: false, campaign: 99 },
    normale: { moves: 1, aggro: 9, armies: true, bombs: true, superbomb: false, buy: ['min', 'acc', 'S', 'E', 'T', 'bomba'], buys: 2, keep: 30000, shootP: 1, defend: true, campaign: 14 },
    difficile: { moves: 1, aggro: 14, armies: true, bombs: true, superbomb: true, buy: ['min', 'T', 'E', 'acc', 'S', 'bomba', 'superbomba'], buys: 3, keep: 15000, shootP: 1, defend: true, campaign: 8 }
  };

  DM.isBot = (G, o) => !!(G.bots && G.bots[o]);
  // Fa diventare bot (lvl) o persona (lvl vuoto) il giocatore o; i bot hanno un nome loro
  DM.setBot = function (G, o, lvl) {
    G.bots = G.bots || [];
    while (G.bots.length < G.np) G.bots.push(null);
    G.bots[o] = lvl && LEVEL[lvl] ? lvl : null;
    G.names[o] = G.bots[o] ? DM.BOT_NAMES[o] : 'Giocatore ' + (o + 1);
  };
  // giocatori ancora in gioco (anche quelli che, in preparazione, non hanno ancora scelto il kit)
  DM.alive = G => Array.from({ length: G.np }, (_, i) => i).filter(i => !(G.players[i] && G.players[i].out));

  // ---------- attrezzi ----------
  const rnd = () => DM.rand();
  const pick = a => a[Math.floor(rnd() * a.length)];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const land = (G, x, y) => { const b = DM.bAt(G, x, y); return !!b && !DM.WATER.includes(b); };
  const inMap = (x, y) => x > .3 && y > .3 && x < DM.W - .3 && y < DM.H - .3;
  // punti attorno a (x, y) tra r0 e r1 cm
  function ring(x, y, r0, r1, step, n) {
    const out = [];
    for (let r = r0; r <= r1 + 1e-9; r += step || .5) {
      const k = n || Math.max(8, Math.round(r * 8)), a0 = rnd() * Math.PI * 2;
      for (let i = 0; i < k; i++) { const a = a0 + i / k * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; if (inMap(px, py)) out.push([px, py]); }
    }
    return out;
  }
  // "Firma" della partita: se non cambia, l'azione non è riuscita (niente da mostrare)
  // (senza "dock": è il molo del Porto, che il gioco calcola la prima volta che serve)
  const sig = G => JSON.stringify([G.units, G.sites, G.players, G.moved, G.shots, G.berried, G.roads.length, G.bridges.length, G.rad.length, G.phase, G.p], (k, v) => k === 'dock' ? undefined : v);
  function attempt(G, fn) {
    const s0 = sig(G);
    let r;
    try { r = fn(); } catch (e) { return null; }
    if (sig(G) === s0) return null;
    return r && typeof r === 'object' ? r : { msg: r || '' };
  }
  const value = m => DM.BANK[m] ? DM.BANK[m][1] / DM.BANK[m][0] : 0;   // soldi per unità di materiale
  const enemyOf = (G, o) => x => x.o !== o && x.o >= 0 && !(G.players[x.o] && G.players[x.o].out);

  // ---------- preparazione ----------
  DM.botKit = function (G) {
    const lvl = G.bots[G.p];
    if (lvl === 'facile') return Math.floor(rnd() * DM.KITS.length);
    return pick(lvl === 'difficile' ? [0, 2, 3] : [0, 0, 2, 3, 4]);   // Tribù, Mercanti, Navigatori (e Maghi)
  };
  // Il posto migliore per la Capitale: tanta terra buona attorno, lontano dalle altre
  DM.botCapitalSpot = function (G) {
    let best = null, bs = -Infinity;
    const caps = G.sites.filter(s => s.k === 'cap');
    for (let y = 3; y < DM.H - 3; y += 1) for (let x = 3; x < DM.W - 3; x += 1) {
      const px = x + rnd() * .8 - .4, py = y + rnd() * .8 - .4;
      if (DM.capitalSpotError(G, px, py, G.np)) continue;
      let sc = 0;
      for (let a = 0; a < 12; a++) for (const r of [1, 2.5, 4]) {
        const b = DM.bAt(G, px + Math.cos(a / 12 * 6.283) * r, py + Math.sin(a / 12 * 6.283) * r);
        if (b === 'P' || b === 'D' || b === 'T') sc += 1; else if (b && !DM.WATER.includes(b) && !'ZI'.includes(b)) sc += .5;
        else if (b === 'S' && r === 4) sc += .15;   // un po' di mare vicino serve per i Porti
      }
      if (caps.length) sc += Math.min(30, Math.min(...caps.map(c => Math.hypot(c.x - px, c.y - py)))) * .25;
      sc += rnd() * 2;
      if (sc > bs) { bs = sc; best = [px, py]; }
    }
    return best;
  };
  // Un passo di preparazione: kit, poi Capitale. Restituisce {kind, msg, at} o null.
  DM.botSetup = function (G) {
    if (G.phase === 'kit') { DM.chooseKit(G, DM.botKit(G)); return { kind: 'tap', msg: G.names[G.p] + ' sceglie il kit ' + DM.KITS[G.players[G.p].kit].name + '.' }; }
    if (G.phase === 'cap') {
      const s = DM.botCapitalSpot(G) || [DM.W / 2, DM.H / 2];
      const o = G.p, msg = DM.placeCapital(G, s[0], s[1]);
      return { kind: 'act', msg: G.names[o] + ' ha piazzato la Capitale. ' + (msg || ''), at: s };
    }
    return null;
  };

  // ---------- il turno ----------
  DM.botTurn = function* (G) {
    const o = G.p, q = G.players[o], L = LEVEL[(G.bots || [])[o]] || LEVEL.normale;
    const saveR = G.tapR; G.tapR = .6;
    const mine = s => s.o === o, foe = enemyOf(G, o);
    const cap = () => DM.capitalOf(G, o);
    const say = (r, kind, at, x) => ({ kind: kind || 'act', msg: r.msg, at, x: x || {} });
    let r;

    // 0) senza Capitale: una Città con metà dei soldi diventa Capitale
    if (q.noCap) for (const s of G.sites.filter(s => mine(s) && s.k === 'citta')) if ((r = attempt(G, () => DM.chooseCapital(G, s)))) { yield say(r, 'act', [s.x, s.y]); break; }

    // 1) Banco: si vende il materiale che rende di più (un solo tipo per turno)
    {
      const tot = {};
      G.sites.filter(mine).forEach(s => DM.MATERIALS.forEach(m => { const n = Math.floor((s.inv.mat[m] || 0) / DM.BANK[m][0]); if (n > 0) tot[m] = (tot[m] || 0) + n * DM.BANK[m][1]; }));
      // i materiali che servono per comprare truppe si tengono (rame, piombo; titanio e petrolio per i più forti)
      const keepMat = ['rame', 'piombo'].concat(L.buy.includes('T') ? ['titanio', 'petrolio'] : []).concat(L.bombs ? ['uranio'] : []);
      const m = q.sold || Object.keys(tot).filter(k => !keepMat.includes(k) || tot[k] > 60000).sort((a, b) => tot[b] - tot[a])[0];
      if (m) for (const s of G.sites.filter(mine)) {
        const n = Math.floor((s.inv.mat[m] || 0) / DM.BANK[m][0]);
        if (n > 0 && (r = attempt(G, () => DM.sell(G, s, m, n)))) yield say(r, 'act', [s.x, s.y]);
      }
    }

    // 2) acquisti nei propri edifici (tenendo da parte qualche soldo)
    {
      let n = 0;
      const shops = G.sites.filter(s => mine(s) && (s.k === 'cap' || s.k === 'citta')).sort((a, b) => b.inv.mon - a.inv.mon);
      for (const s of shops) for (const k of L.buy) {
        if (n >= L.buys) break;
        if ((k === 'bomba' || k === 'superbomba') && !(k === 'bomba' ? L.bombs : L.superbomb)) continue;
        if ((k === 'bomba' || k === 'superbomba') && (s.inv.mat[k] || 0) >= 1) continue;
        if ((k === 'acc' || k === 'min') && (q.res[k] || 0) >= 2) continue;
        const c = DM.COST[k] && DM.COST[k][0];
        if (!c || s.inv.mon - c.m < L.keep) continue;
        if ((r = attempt(G, () => DM.buy(G, s, k)))) { n++; yield say(r, 'act', [s.x, s.y]); }
      }
    }

    // 3) costruzioni dalla riserva: miniere, Accampamenti e Città sul bordo del territorio, un Porto se servono navi
    const own = () => G.units.filter(u => u.o === o && !u.carried);
    const homeSpots = (r0, r1) => {
      const c = cap(), bases = (c ? [c] : []).concat(own().slice(0, 12), G.sites.filter(s => mine(s) && s.k !== 'cap'));
      const out = [];
      bases.forEach(b => ring(b.x, b.y, r0, r1, .6).forEach(p => out.push(p)));
      return out;
    };
    for (let i = 0; i < 3 && q.res.min > 0; i++) {
      const ok = homeSpots(1, 2).filter(([x, y]) => !DM.mineError(G, x, y) && !G.sites.some(s => Math.hypot(s.x - x, s.y - y) < 1));
      if (!ok.length) break;
      // i Maghi scelgono il dado: quello del minerale che vale di più qui
      const [x, y] = pick(ok.slice(0, 20));
      let die;
      if (q.dice > 0) { const tab = DM.MINE_TABLE[DM.bAt(G, x, y)].split(' '); die = 1 + tab.map((m, j) => [value(m) * DM.QTY[m], j]).sort((a, b) => b[0] - a[0])[0][1]; }
      const res = DM.buildMine(G, x, y, die);
      if (res.err) break;
      yield { kind: 'mine', msg: G.names[o] + ' costruisce una Miniera: dado ' + res.die + ', ' + res.mat + '.', at: [x, y], x: { die: res.die } };
    }
    for (const k of ['citta', 'acc']) for (let i = 0; i < 3 && q.res[k] > 0; i++) {
      const c = cap();
      const ok = homeSpots(.8, 1.9).filter(([x, y]) => !DM.NO_BUILD.includes(DM.bAt(G, x, y) || 'S') && DM.terrAt(G, x, y) === o &&
        !(k === 'citta' && DM.NO_CITY.includes(DM.bAt(G, x, y))) && !G.sites.some(s => Math.hypot(s.x - x, s.y - y) < 2.5) && DM.troopNear(G, o, x, y, 2));
      if (!ok.length) break;
      ok.sort((a, b) => c ? Math.hypot(b[0] - c.x, b[1] - c.y) - Math.hypot(a[0] - c.x, a[1] - c.y) : 0);   // lontano dalla Capitale: il regno si allarga
      const [x, y] = ok[0];
      if ((r = attempt(G, () => DM.buildSite(G, k, x, y)))) yield say(r, 'act', [x, y]); else break;
    }
    if (q.res.porto > 0 && (q.res.N > 0 || q.res.X > 0) && !G.sites.some(s => mine(s) && s.k === 'porto')) {
      const ok = homeSpots(.4, 1.6).filter(([x, y]) => DM.bAt(G, x, y) === 'S' || DM.bAt(G, x, y) === 'F');
      for (const [x, y] of ok.slice(0, 40)) if ((r = attempt(G, () => DM.buildSite(G, 'porto', x, y)))) { yield say(r, 'act', [x, y]); break; }
    }

    // 4) schierare le truppe della riserva vicino alle basi (dal lato libero), le navi nei Porti
    for (const t of ['T', 'E', 'S', 'C', 'N', 'X']) {
      for (let i = 0; i < 20 && q.res[t] > 0; i++) {
        let done = false;
        if (T[t].kind === 'sea') {
          for (const s of G.sites.filter(s => mine(s) && s.k === 'porto')) if ((r = attempt(G, () => DM.deploy(G, t, s.x, s.y)))) { yield say(r, 'act', [s.x, s.y]); done = true; break; }
        } else {
          const bases = G.sites.filter(s => mine(s) && ['cap', 'citta', 'acc'].includes(s.k));
          const spots = bases.flatMap(b => ring(b.x, b.y, .8, 1.8, .5)).filter(([x, y]) => land(G, x, y) && !'ZI'.includes(DM.bAt(G, x, y)) && !G.units.some(u => Math.hypot(u.x - x, u.y - y) < .7));
          // meglio verso le terre di nessuno
          spots.sort((a, b) => (DM.terrAt(G, b[0], b[1]) === -1 ? 1 : 0) - (DM.terrAt(G, a[0], a[1]) === -1 ? 1 : 0));
          for (const [x, y] of spots.slice(0, 12)) if ((r = attempt(G, () => DM.deploy(G, t, x, y)))) { yield say(r, 'act', [x, y]); done = true; break; }
        }
        if (!done) break;
      }
    }

    // 5) Carri: caricano soldi e materiali dalle miniere e li portano alla Capitale
    const carts = () => own().filter(u => DM.CARGO_CAP[u.t] && u.t === 'C');
    const goods = s => s.inv.mon + DM.MATERIALS.reduce((t, m) => t + (s.inv.mat[m] || 0) * value(m), 0);
    for (const c of carts()) {
      const here = G.sites.filter(s => mine(s) && dist(s, c) <= 1);
      const home = here.find(s => s.k === 'cap');
      if (home && c.cg && DM.cargoPts(c.cg) > 0) { if ((r = attempt(G, () => DM.unloadCargo(G, c, home)))) yield say(r, 'act', [home.x, home.y]); continue; }
      for (const s of here.filter(s => s.k !== 'cap' && goods(s) > 5000)) {
        for (const m of ['mon'].concat(DM.MATERIALS.slice().sort((a, b) => value(b) - value(a)))) {
          if ((m === 'mon' ? s.inv.mon : (s.inv.mat[m] || 0)) <= 0) continue;
          if ((r = attempt(G, () => DM.loadCargo(G, c, s, m, 0)))) yield say(r, 'act', [s.x, s.y]);
        }
      }
    }

    // 6) eserciti: truppe di terra vicine, ancora ferme, si uniscono
    if (L.armies) {
      const free = own().filter(u => !u.g && !u.m && T[u.t].kind === 'land' && u.t !== 'C');
      const used = new Set();
      for (const u of free) {
        if (used.has(u)) continue;
        const grp = [u];
        for (const v of free) if (v !== u && !used.has(v) && dist(u, v) <= 1 && !DM.pickError(G, grp, v)) grp.push(v);
        if (grp.length >= 3 && !DM.pickError(G, [], u)) {
          grp.forEach(v => used.add(v));
          if ((r = attempt(G, () => { const f = DM.formArmy(G, grp); return f.err ? '' : f.msg; }))) yield say(r, 'army', [u.x, u.y]);
        }
      }
    }

    // 7) spari e bombe (prima di muoversi, con chi è già in portata)
    yield* shootAll();
    if (L.bombs) yield* bombs();

    // 8) movimenti: difesa della Capitale, attacco ai nemici vicini, poi conquista di terre libere
    const limit = Math.max(1, Math.round(DM.moveLimit(G.round) * L.moves));
    const movers = () => {
      const seen = new Set(), out = [];
      own().forEach(u => { const key = u.g ? 'g' + u.g : 'u' + u.id; if (!seen.has(key) && !u.m) { seen.add(key); out.push(u); } });
      return out;
    };
    const enemies = () => G.units.filter(u => foe(u) && !u.carried).concat(G.sites.filter(s => foe(s) && !s.par));
    const skip = new Set();   // chi non è riuscito a muoversi: non si riprova in questo turno
    for (let step = 0, tries = 0; step < limit && G.moved < DM.moveLimit(G.round) && tries < 12; tries++) {
      const c = cap(), E = enemies();
      let best = null;
      for (const u of movers().filter(u => !skip.has(u.id))) {
        const A = DM.armyOf(G, u), kind = T[u.t].kind, st = DM.stat(G, u), strong = A.reduce((t, v) => t + v.hp, 0);
        let goal = null, score = 0;
        if (u.t === 'C' && A.length === 1) {   // Carro: verso casa se carico, altrimenti verso la miniera più ricca
          if (c && u.cg && DM.cargoPts(u.cg) > 0) { goal = [c.x, c.y]; score = 5; }
          else {
            const s = G.sites.filter(z => mine(z) && z.k !== 'cap' && goods(z) > 20000).sort((a, b) => goods(b) - goods(a))[0];
            if (s && dist(s, u) > .8) { goal = [s.x, s.y]; score = 4; }
          }
        } else {
          // difesa: un nemico vicino alla Capitale
          const danger = c && L.defend ? E.filter(e => e.hp && !e.k && dist(e, c) < 6).sort((a, b) => dist(a, c) - dist(b, c))[0] : null;
          if (danger && dist(u, c) < 10 && st[0] > 0) { goal = toward(u, danger, st[1] * .8); score = 30 - dist(u, danger); }
          // attacco: il nemico più vicino entro "aggro"
          if (!goal && st[0] > 0) {
            const e = E.filter(e => dist(e, u) < L.aggro && reach(kind, e)).sort((a, b) => dist(a, u) - dist(b, u))[0];
            if (e && (e.k || strong >= (e.hp || 0) * .6)) { goal = toward(u, e, st[1] * .8); score = 20 - dist(u, e); }
          }
          // campagna: più avanti nella partita gli eserciti (e qualche truppa) marciano verso gli edifici nemici
          if (!goal && kind !== 'sea' && st[0] > 0 && G.round >= L.campaign && (u.g || rnd() < .35)) {
            const e = E.filter(e => e.k && reach(kind, e)).sort((a, b) => dist(a, u) - dist(b, u))[0];
            if (e) { goal = toward(u, e, st[1] * .8); score = (L.campaign < 10 ? 16 : 12) + (u.g ? 4 : 0); }
          }
          // conquista: terra di nessuno (o, più avanti, del nemico) vicina
          if (!goal && kind !== 'sea') {
            const late = G.round >= 15 && L.defend;
            for (const R of [1.5, 3, 5, 8, 12]) {
              const p = ring(u.x, u.y, R, R, 1, 24).find(([x, y]) => land(G, x, y) && DM.bAt(G, x, y) !== 'Z' && (DM.terrAt(G, x, y) === -1 || (late && foe({ o: DM.terrAt(G, x, y) }))));
              if (p) { goal = p; score = 10 - R * .5 + (u.t === 'S' ? 1 : 0); break; }
            }
          }
          if (!goal && kind === 'sea' && E.length) {   // navi: verso il nemico più vicino sulla costa
            const e = E.filter(e => DM.WATER.includes(DM.bAt(G, e.x, e.y) || 'P') || ring(e.x, e.y, 1, 1, 1, 8).some(([x, y]) => DM.bAt(G, x, y) === 'S')).sort((a, b) => dist(a, u) - dist(b, u))[0];
            if (e) { goal = toward(u, e, st[1] * .8); score = 6; }
          }
        }
        if (goal && (!best || score + rnd() > best.score)) best = { u, goal, score: score + rnd() };
      }
      if (!best) break;
      const { u, goal } = best;
      if ((r = attempt(G, () => DM.moveUnit(G, u, goal[0], goal[1])))) { step++; yield say(r, 'act', goal); }
      else DM.armyOf(G, u).forEach(v => skip.add(v.id));
    }
    // 9) di nuovo spari, con chi si è avvicinato
    yield* shootAll();

    G.tapR = saveR;

    // --- aiuti del turno ---
    function toward(u, e, keep) {   // punto verso e, fermandosi a "keep" cm (la portata)
      const d = dist(u, e);
      if (d <= keep) return [u.x, u.y];
      const f = (d - keep) / d;
      return [u.x + (e.x - u.x) * f, u.y + (e.y - u.y) * f];
    }
    function reach(kind, e) {   // una truppa di terra non insegue chi sta in mare, una nave chi sta lontano dalla costa
      const b = DM.bAt(G, e.x, e.y) || 'S';
      if (kind === 'land') return !DM.WATER.includes(b);
      if (kind === 'sea') return DM.WATER.includes(b) || ring(e.x, e.y, 1, 1, 1, 8).some(([x, y]) => DM.WATER.includes(DM.bAt(G, x, y) || 'P'));
      return true;
    }
    function* shootAll() {
      const seen = new Set();
      for (const u of own()) {
        if (G.shots >= DM.shotLimit(G.round)) return;
        const key = u.g ? 'g' + u.g : 'u' + u.id;
        if (seen.has(key)) continue; seen.add(key);
        if (DM.shootError(G, u) || rnd() > L.shootP) continue;
        const A = DM.armyOf(G, u), R = Math.max(...A.map(v => DM.stat(G, v)[1])), dmg = A.reduce((t, v) => t + DM.stat(G, v)[0], 0);
        const E = G.units.filter(e => foe(e) && !e.carried && dist(e, u) <= R).sort((a, b) => ((a.hp <= dmg ? 0 : 1) - (b.hp <= dmg ? 0 : 1)) || a.hp - b.hp)
          .concat(G.sites.filter(s => foe(s) && !s.par && dist(s, u) <= R).sort((a, b) => a.hp - b.hp));
        for (const e of E) {
          const tg = DM.shootTargets(G, e.x, e.y).find(t => (t.type === 'units' && t.units.includes(e)) || t.s === e);
          if (!tg) continue;
          const from = A.filter(v => DM.stat(G, v)[0] > 0).map(v => ({ id: v.id, t: v.t, x: v.x, y: v.y }));
          if ((r = attempt(G, () => DM.shootAt(G, u, tg)))) { yield say(r, 'shoot', [tg.x, tg.y], { from: from.slice(0, 6), tx: tg.x, ty: tg.y }); break; }
        }
      }
    }
    function* bombs() {
      for (const s of G.sites.filter(s => mine(s))) for (const k of ['superbomba', 'bomba']) {
        if (!(s.inv.mat[k] > 0) || (k === 'superbomba' && !L.superbomb) || DM.bombError(G, s, k)) continue;
        const R = DM.bombRange(s, k);
        // il bersaglio che vale di più: un esercito forte o un edificio importante
        const cands = G.units.filter(e => foe(e) && !e.carried && dist(e, s) <= R).map(e => ({ e, v: DM.armyOf(G, e).reduce((t, v) => t + v.hp, 0) }))
          .concat(G.sites.filter(z => foe(z) && !z.par && dist(z, s) <= R).map(z => ({ e: z, v: z.k === 'cap' ? 30000 : z.k === 'citta' ? 15000 : 4000 })))
          .sort((a, b) => b.v - a.v);
        const c = cands[0];
        if (!c || c.v < (k === 'superbomba' ? 15000 : 5000)) continue;
        const tg = DM.anyTargets(G, c.e.x, c.e.y).find(t => (t.type === 'units' && t.units.includes(c.e)) || t.s === c.e) || null;
        if ((r = attempt(G, () => DM.launchBombAt(G, s, k, tg, c.e.x, c.e.y)))) yield say(r, 'bomb', [c.e.x, c.e.y], { k, sx: s.x, sy: s.y, tx: tg ? tg.x : c.e.x, ty: tg ? tg.y : c.e.y });
      }
    }
  };

  // Un turno intero di bot, senza animazioni (per le prove e per far giocare i bot da soli)
  DM.botPlayTurn = function (G) {
    const log = [];
    for (const a of DM.botTurn(G)) log.push(a);
    return log;
  };
})(globalThis.DM = globalThis.DM || {});
