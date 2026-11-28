// Damamondo – stato della partita, preparazione, funzioni comuni.
// Tutte le funzioni delle regole restituiscono un messaggio (stringa) per il giocatore.
(function (DM) {
  'use strict';
  const { W, H, TR } = DM;

  DM.rand = Math.random;                     // sostituibile nei test
  DM.d6 = () => 1 + Math.floor(DM.rand() * 6);
  DM.dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  DM.fmtN = n => Math.round(n).toLocaleString('it-IT');
  DM.fmtCm = n => (Math.floor(n * 10 + 1e-6) / 10).toFixed(1).replace('.', ',');   // cm al millimetro (per difetto)

  DM.newGame = function (opts, seed, map) {
    // modalità: Damamondo (normale) o Classico (js/classic.js); sta nelle opzioni della mappa, così si salva con la partita
    if (DM.setMode) DM.setMode((map ? map.opts : opts || {}).mode);
    const G = {
      // il numero mappa 0 vale (mappe segrete)
      seed: seed === 0 ? 0 : seed || 7, phase: 'num', np: 2, names: [], players: [], p: 0, round: 1,
      moved: 0, shots: 0, berried: false, units: [], sites: [], roads: [], bridges: [], rad: [], events: [],
      uid: 0, gid: 0, sid: 0, tapR: .7
    };
    if (map) G.map = map; else { G.map = DM.makeMap(opts || {}, G.seed); DM.rebuildMap(G.map, 1); }
    G.terr = new Int8Array(W * TR * H * TR).fill(-1);
    return G;
  };

  DM.bAt = (G, x, y) => DM.mapAt(G.map, x, y);
  DM.terrIdx = (x, y) => (x >= 0 && y >= 0 && x < W && y < H) ? Math.floor(y * TR) * W * TR + Math.floor(x * TR) : -1;
  DM.terrAt = (G, x, y) => { const i = DM.terrIdx(x, y); return i < 0 ? -1 : G.terr[i]; };
  DM.cur = G => G.players[G.p];

  // ---- Truppe ----
  DM.addUnit = function (G, t, o, x, y) {
    const u = { id: ++G.uid, t, o, x, y, px: x, py: y, m: false, s: false, hp: DM.TROOPS[t].hp, g: 0 };
    G.units.push(u);
    return u;
  };
  DM.unitById = (G, id) => G.units.find(u => u.id == id);
  DM.armyOf = (G, u) => u.g ? G.units.filter(v => v.g === u.g) : [u];
  // Truppa più vicina al punto, entro il raggio di tocco
  // le truppe a bordo di un veicolo non si toccano: sono dentro il veicolo
  DM.unitNear = (G, x, y, filter) => G.units.filter(u => !u.carried && Math.hypot(u.x - x, u.y - y) < G.tapR && (!filter || filter(u)))
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  DM.troopNear = (G, o, x, y, r) => G.units.some(u => u.o === o && !u.carried && Math.hypot(u.x - x, u.y - y) <= (r || 2));

  // Toglie le truppe morte e scioglie gli eserciti rimasti con meno di 2 truppe.
  // Un veicolo distrutto lascia a terra chi portava e l'autista (6.4): dead.note lo racconta.
  DM.cleanupDead = function (G) {
    const dead = [], notes = [];
    for (let guard = 0; guard < 20; guard++) {
      const now = G.units.filter(u => u.hp <= 0);
      if (!now.length) break;
      G.units = G.units.filter(u => u.hp > 0);
      now.forEach(u => { dead.push(u); if (DM.releaseOnDeath) notes.push(DM.releaseOnDeath(G, u)); });
    }
    dead.note = notes.join('');
    if (!dead.length) return dead;
    new Set(dead.map(u => u.g).filter(Boolean)).forEach(g => {
      const r = G.units.filter(u => u.g === g);
      if (r.length < 2) r.forEach(u => { u.g = 0; u.an = 0; });
    });
    return dead;
  };

  // ---- Edifici ----
  DM.addSite = function (G, o, k, x, y, extra) {
    const s = Object.assign({ id: ++G.sid, o, k, x, y, r0: G.round, hp: DM.BUILDING_HP[k], inv: { mon: 0, mat: {} } }, extra || {});
    G.sites.push(s);
    return s;
  };
  DM.siteById = (G, id) => G.sites.find(s => s.id == id);
  DM.sitesOf = (G, o) => G.sites.filter(s => s.o === o);
  DM.capitalOf = (G, o) => G.sites.find(s => s.o === o && s.k === 'cap');
  DM.maxHp = s => s.mx || DM.BUILDING_HP[s.k];
  DM.isCityLike = s => s.k === 'cap' || s.k === 'citta' || s.k === 'acc';
  DM.siteNear = (G, x, y, filter) => G.sites.filter(s => Math.hypot(s.x - x, s.y - y) < G.tapR && (!filter || filter(s)))
    .sort((a, b) => (Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)) || ((a.par ? 1 : 0) - (b.par ? 1 : 0)));
  DM.moneyOf = (G, o) => DM.sitesOf(G, o).reduce((t, s) => t + s.inv.mon, 0);

  // Distrugge un edificio: si perde tutto ciò che conteneva (soldi, materiali, bombe…), gli edifici interni e le strade.
  // Le truppe dentro NON muoiono (decisione dell'utente): si fanno male solo se le colpisce una Bomba.
  DM.destroySite = function (G, s) {
    if (!G.sites.includes(s)) return '';
    const inner = G.sites.filter(z => z.par === s.id);
    G.sites = G.sites.filter(z => z !== s && z.par !== s.id);
    G.roads = G.roads.filter(r => r.a !== s.id && r.b !== s.id && !inner.some(z => z.id === r.a || z.id === r.b));
    let msg = '';
    if (s.k === 'cap') msg += DM.capitalLost(G, s.o);
    else if (s.k === 'citta' && G.players[s.o] && G.players[s.o].noCap) msg += DM.checkEliminated(G, s.o);
    return msg;
  };

  // ---- Capitale (7.3 + correzione) ----
  // Restituisce la Città che può diventare Capitale (almeno il 50% dei soldi del giocatore), se c'è.
  DM.capitalCandidate = function (G, o) {
    const tot = DM.moneyOf(G, o);
    return DM.sitesOf(G, o).filter(s => s.k === 'citta' && s.inv.mon >= tot / 2)
      .sort((a, b) => b.inv.mon - a.inv.mon)[0];
  };
  DM.capitalLost = function (G, o) {
    const q = G.players[o], name = G.names[o];
    // Classico: i soldi si teletrasportano, quindi la Capitale passa subito alla Città più ricca
    const c = DM.isClassic && DM.isClassic() ? DM.sitesOf(G, o).filter(s => s.k === 'citta').sort((a, b) => b.inv.mon - a.inv.mon)[0] : DM.capitalCandidate(G, o);
    if (c) { c.k = 'cap'; c.r0 = c.r0 || G.round; q.noCap = false; if (DM.balanceMoney) DM.balanceMoney(G, o); return ' La Capitale di ' + name + ' si sposta in una Città.'; }
    if (DM.sitesOf(G, o).some(s => s.k === 'citta')) {
      q.noCap = true;
      return ' ' + name + ' è senza Capitale: deve portare almeno metà dei soldi in una Città e sceglierla (perde 10.000 soldi a ogni suo turno).';
    }
    return DM.eliminate(G, o);
  };
  DM.checkEliminated = function (G, o) {
    const q = G.players[o];
    if (q.out || DM.capitalOf(G, o) || DM.sitesOf(G, o).some(s => s.k === 'citta')) return '';
    return DM.eliminate(G, o);
  };
  DM.eliminate = function (G, o) {
    const q = G.players[o];
    q.out = true; q.noCap = false;
    G.units = G.units.filter(u => u.o !== o);
    G.sites = G.sites.filter(s => s.o !== o);
    G.roads = G.roads.filter(r => r.o !== o);
    const left = G.players.map((z, i) => i).filter(i => !G.players[i].out);
    return ' ' + G.names[o] + ' ha perso!' + (left.length === 1 ? ' Vince ' + G.names[left[0]] + '!' : '');
  };
  DM.chooseCapital = function (G, s) {
    const q = G.players[s.o];
    if (!q.noCap) return 'Hai già una Capitale.';
    if (s.k !== 'citta') return 'Solo una Città può diventare Capitale.';
    const tot = DM.moneyOf(G, s.o);
    if (s.inv.mon < tot / 2) return 'Servono qui almeno metà dei tuoi soldi (' + DM.fmtN(Math.ceil(tot / 2)) + '): portali con il Carro.';
    s.k = 'cap'; q.noCap = false;
    return 'Questa Città ora è la tua Capitale.';
  };
  // Toglie soldi dagli edifici del giocatore, dal più ricco
  DM.takeMoney = function (G, o, n) {
    for (const s of DM.sitesOf(G, o).sort((a, b) => b.inv.mon - a.inv.mon)) {
      const t = Math.min(n, s.inv.mon); s.inv.mon -= t; n -= t; if (n <= 0) break;
    }
  };

  // ---- Preparazione ----
  DM.setPlayers = function (G, n) {
    G.np = n; G.names = []; G.players = [];
    for (let i = 0; i < n; i++) G.names.push('Giocatore ' + (i + 1));
    G.phase = 'kit'; G.p = 0;
  };
  DM.chooseKit = function (G, i) {
    G.players[G.p] = { kit: i };
    G.phase = 'cap';
  };
  DM.capitalSpotError = function (G, x, y, np) {
    const b = DM.bAt(G, x, y), m = DM.capitalMinDist(np);
    if (!b || DM.NO_CAPITAL.includes(b)) return 'Qui non si può: niente Capitale in Mare, Giungla, Palude, Alta montagna, fiumi, Lavico o Banchisa.';
    if (G.sites.some(s => s.k === 'cap' && Math.hypot(s.x - x, s.y - y) < m)) return 'Troppo vicino a un’altra Capitale (minimo ' + m + ' cm).';
    return '';
  };
  // Crea il giocatore o con il kit e la Capitale in (x, y)
  DM.initPlayer = function (G, o, kitIdx, x, y) {
    const k = DM.KITS[kitIdx];
    G.players[o] = {
      kit: kitIdx, sold: '', out: false, noCap: false, dice: k.diceChoice || 0,
      res: { S: k.S, C: k.C === undefined ? 1 : k.C, N: k.N, E: k.E, acc: k.acc, citta: k.citta, min: k.min, porto: k.porto, aer: k.aer, col: 0, ponte1: k.ponte1 || 0, ponte2: 0 }
    };
    const cap = DM.addSite(G, o, 'cap', x, y);
    cap.inv.mon = k.money;
    if (k.materials) DM.MATERIALS.forEach(m => { if (m !== 'ossidiana') cap.inv.mat[m] = DM.QTY[m]; });
    if (k.potions) Object.keys(DM.POTIONS).forEach(pz => { cap.inv.mat[pz] = pz === 'poz_stipendio' ? 1 : 2; });
    if (!(DM.isClassic && DM.isClassic())) DM.addSite(G, o, 'aer', x, y, { par: cap.id });   // Aeroporto gratis nella prima città (correzione); nel Classico gli Aeroporti non ci sono
    DM.claim(G, o, x, y);
    return cap;
  };
  DM.placeCapital = function (G, x, y) {
    const err = DM.capitalSpotError(G, x, y, G.np);
    if (err) return err;
    DM.initPlayer(G, G.p, G.players[G.p].kit, x, y);
    if (G.p < G.np - 1) { G.p++; G.phase = 'kit'; return ''; }
    G.p = 0; G.phase = 'play';
    return 'Schiera le tue truppe dalla riserva, vicino alla Capitale.';
  };
})(globalThis.DM = globalThis.DM || {});
