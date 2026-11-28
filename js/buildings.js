// Damamondo – costruzione di edifici, Porti, Aeroporti, strade e ponti (8).
(function (DM) {
  'use strict';

  const ring = (x, y, rs) => {
    const out = [];
    rs.forEach(r => { for (let a = 0; a < 16; a++) out.push([x + Math.cos(a * Math.PI / 8) * r, y + Math.sin(a * Math.PI / 8) * r]); });
    return out;
  };

  // Costruisce dalla riserva: acc, citta, col, aer, porto. Restituisce un messaggio.
  DM.buildSite = function (G, k, x, y) {
    const q = DM.cur(G), b = DM.bAt(G, x, y);
    if (!(q.res[k] > 0)) return 'Non hai ' + DM.nameOf(k) + ' in riserva.';
    if (!DM.troopNear(G, G.p, x, y, 2)) return 'Serve una tua truppa entro 2 cm.';
    if (k === 'porto') {
      if (!b || !DM.WATER.includes(b)) return 'Il Porto va in acqua (mare, fiume o lago), attaccato alla tua costa.';
      const own = ring(x, y, [.5, 1]).some(([px, py]) => { const c = DM.bAt(G, px, py); return c && !DM.NO_BUILD.includes(c) && DM.terrAt(G, px, py) === G.p; });
      if (!own) return 'Serve terra tua entro 1 cm.';
    } else {
      if (!b || DM.NO_BUILD.includes(b)) return 'Qui non si costruisce (mare, fiumi, Banchisa e Lavico no).';
      if (DM.terrAt(G, x, y) !== G.p) return 'Devi costruire dentro il tuo territorio.';
      if (k === 'citta' && DM.NO_CITY.includes(b)) return 'Niente città in Giungla, Palude o Alta montagna.';
      if (k === 'col' && !DM.BERRY_OF_BIOME[b]) return 'Le bacche crescono solo in Deserto, Giungla, Palude e Tundra.';
    }
    DM.addSite(G, G.p, k, x, y);
    q.res[k]--;
    return DM.nameOf(k) + ' costruito.';
  };

  // Aeroporto o Porto dentro una Città/Capitale (Porto solo se la città è entro 0,2 cm dall'acqua)
  DM.buildInside = function (G, site, k) {
    const q = DM.cur(G);
    if (!site || site.o !== G.p || (site.k !== 'cap' && site.k !== 'citta')) return 'Seleziona una tua Città o la Capitale.';
    if (!(q.res[k] > 0)) return 'Non hai ' + DM.nameOf(k) + ' in riserva.';
    if (!DM.troopNear(G, G.p, site.x, site.y, 2)) return 'Serve una tua truppa entro 2 cm.';
    if (G.sites.some(s => s.par === site.id && s.k === k)) return 'C’è già un ' + DM.nameOf(k) + ' qui dentro.';
    if (k === 'aer') {
      DM.addSite(G, G.p, 'aer', site.x, site.y, { par: site.id });
    } else {
      const w = ring(site.x, site.y, [.05, .1, .15, .2]).find(([px, py]) => DM.WATER.includes(DM.bAt(G, px, py) || 'x'));
      if (!w) return 'Per avere un Porto dentro, la città deve essere a 0,2 cm dall’acqua.';
      DM.addSite(G, G.p, 'porto', w[0], w[1], { par: site.id });
    }
    q.res[k]--;
    return DM.nameOf(k) + ' costruito dentro la ' + DM.nameOf(site.k) + '.';
  };

  // ---- Nodi della rete stradale: edifici (id numerico) ed estremità dei ponti ('b<id>:1' / 'b<id>:2') ----
  DM.bridgeId = (G, b) => b.id || (b.id = G.bid = (G.bid || 0) + 1);
  DM.nodePos = function (G, id) {
    if (typeof id === 'string' && id[0] === 'b') {
      const [bid, end] = id.slice(1).split(':'), b = G.bridges.find(z => String(z.id) === bid);
      return b ? { x: end === '1' ? b.x1 : b.x2, y: end === '1' ? b.y1 : b.y2, bridge: b } : null;
    }
    const s = DM.siteById(G, id);
    return s ? { x: s.x, y: s.y, site: s } : null;
  };
  // nodo proprio vicino al punto toccato: prima gli edifici, poi le estremità dei ponti
  DM.nodeNear = function (G, x, y, exclude, r) {
    const R = r || G.tapR;
    const s = G.sites.filter(z => z.o === G.p && z !== exclude && Math.hypot(z.x - x, z.y - y) < R)
      .sort((a, b) => (Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)) || ((a.par ? 1 : 0) - (b.par ? 1 : 0)))[0];
    if (s) return { id: s.id, x: s.x, y: s.y, site: s };
    const ends = [];
    G.bridges.filter(b => b.o === G.p).forEach(b => {
      const id = DM.bridgeId(G, b);
      ends.push({ id: 'b' + id + ':1', x: b.x1, y: b.y1, bridge: b }, { id: 'b' + id + ':2', x: b.x2, y: b.y2, bridge: b });
    });
    return ends.filter(e => Math.hypot(e.x - x, e.y - y) < R).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] || null;
  };

  // ---- Strade (8.4): pezzi da 5 cm. Sull'acqua la strada si interrompe: dall'altra parte la collega un ponte ----
  DM.roadPlan = function (G, a, b) {
    const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / .05));
    let hard = false, land = 0;
    const port = e => e.site && e.site.k === 'porto';
    for (let i = 0; i < n; i++) {
      const f = (i + .5) / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, k = DM.bAt(G, x, y);
      if (!k) return { err: 'La strada esce dalla mappa.' };
      if (k === 'Z' || k === 'I') return { err: 'Niente strade su Banchisa e Lava.' };
      if (DM.WATER.includes(k)) {
        // ammessa solo dove l'acqua la attraversa un tuo ponte, o vicino a un Porto o all'estremità di un ponte collegato
        const da = Math.hypot(x - a.x, y - a.y), db = Math.hypot(x - b.x, y - b.y);
        const ok = G.bridges.some(r => r.o === G.p && DM.segD(x, y, r) < .35) ||
          (port(a) && da <= 1.1) || (port(b) && db <= 1.1) || (a.bridge && da <= .3) || (b.bridge && db <= .3);
        if (!ok) return { err: 'La strada si ferma all’acqua: costruisci un ponte e collega la strada al ponte.' };
      } else {
        land += L / n;
        if (DM.HARD_ROAD.includes(k)) hard = true;
      }
    }
    const pieces = Math.max(1, Math.ceil(land / DM.ROAD_PIECE - 1e-9));
    return { pieces, hard, cost: DM.mulCost(DM.ROAD_COST, pieces * (hard ? 2 : 1)), L, land };
  };
  // a: edificio da cui parte (paga lui, insieme a b se è un edificio); b: edificio o estremità di un ponte (da DM.nodeNear)
  DM.buildRoad = function (G, a, b) {
    if (DM.isClassic && DM.isClassic()) return 'Nel Classico non ci sono strade.';
    if (!a || a.o !== G.p) return 'Seleziona un tuo edificio da cui parte la strada.';
    if (!b || b.site === a || (b.site && b.site.o !== G.p)) return 'Tocca un altro tuo edificio, oppure l’estremità di un tuo ponte.';
    if (G.roads.some(r => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id))) return 'Sono già collegati.';
    if (Math.hypot(a.x - b.x, a.y - b.y) < .3) return 'Sono nello stesso punto.';
    const pl = DM.roadPlan(G, { id: a.id, x: a.x, y: a.y, site: a }, b);
    if (pl.err) return pl.err;
    const invs = [a.inv].concat(b.site ? [b.site.inv] : []);
    if (!DM.pay(invs, [pl.cost])) return 'Servono ' + (b.site ? '(in totale nei due edifici) ' : 'in questo edificio ') + DM.costText(pl.cost) + ' per ' + pl.pieces + (pl.pieces > 1 ? ' pezzi' : ' pezzo') + (pl.hard ? ' (costo doppio)' : '') + '.';
    G.roads.push({ o: G.p, a: a.id, b: b.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    return 'Strada costruita (' + pl.pieces + (pl.pieces > 1 ? ' pezzi' : ' pezzo') + (pl.hard ? ', costo doppio' : '') + (b.bridge ? ', collegata al ponte' : '') + ').';
  };

  // ---- Ponti (8.3): si comprano a pezzi da 1 cm e si posano toccando le due rive ----
  // (x1, y1) e (x2, y2): due punti sulla terra ai lati dell'acqua. Il ponte copre solo l'acqua.
  DM.bridgePlan = function (G, x1, y1, x2, y2, lv) {
    const L = Math.hypot(x2 - x1, y2 - y1), land = (x, y) => { const k = DM.bAt(G, x, y); return k && !DM.WATER.includes(k); };
    if (!land(x1, y1) || !land(x2, y2)) return { err: 'Tocca la terra da una parte e dall’altra dell’acqua.' };
    const n = Math.max(1, Math.ceil(L / .02));
    let first = -1, last = -1, sea = false, gap = false;
    for (let i = 0; i <= n; i++) {
      const t = i / n, k = DM.bAt(G, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
      if (!k) return { err: 'Il ponte esce dalla mappa.' };
      if (DM.WATER.includes(k)) { if (last >= 0 && last < i - 1) gap = true; if (first < 0) first = i; last = i; if (k === 'S') sea = true; }
    }
    if (first < 0) return { err: 'Tra i due punti non c’è acqua: il ponte serve ad attraversarla.' };
    if (gap) return { err: 'Un ponte alla volta: tra i due punti c’è acqua, poi terra, poi di nuovo acqua.' };
    // le estremità sono sulle due rive
    const t1 = Math.max(0, (first - .5) / n), t2 = Math.min(1, (last + .5) / n);
    const a = [x1 + (x2 - x1) * t1, y1 + (y2 - y1) * t1], b = [x1 + (x2 - x1) * t2, y1 + (y2 - y1) * t2];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (lv === 1 && sea) return { err: 'Il ponte liv. 1 non si piazza sul mare (solo fiumi e laghi).' };
    if (lv === 2 && sea && len >= 2) return { err: 'Sul mare il ponte liv. 2 deve essere più corto di 2 cm.' };
    // punti di terra subito prima e subito dopo l'acqua (per controllare territorio e truppe)
    const pt = i => [x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n];
    return { a, b, len, pieces: Math.max(1, Math.ceil(len - 1e-9)), landA: pt(Math.max(0, first - 1)), landB: pt(Math.min(n, last + 1)) };
  };
  DM.buildBridge = function (G, x1, y1, x2, y2, lv) {
    const q = DM.cur(G), key = 'ponte' + lv;
    const pl = DM.bridgePlan(G, x1, y1, x2, y2, lv);
    if (pl.err) return pl.err;
    const [a, b] = [pl.a, pl.b], [la, lb] = [pl.landA, pl.landB];
    if (DM.terrAt(G, la[0], la[1]) !== G.p && DM.terrAt(G, lb[0], lb[1]) !== G.p) return 'Almeno una riva deve essere nel tuo territorio.';
    if (!DM.troopNear(G, G.p, la[0], la[1], 2) && !DM.troopNear(G, G.p, lb[0], lb[1], 2)) return 'Serve una tua truppa entro 2 cm da una riva.';
    const have = q.res[key] || 0;
    if (have < pl.pieces) return 'Il ponte è lungo ' + pl.len.toFixed(1).replace('.', ',') + ' cm: servono ' + pl.pieces + (pl.pieces > 1 ? ' pezzi' : ' pezzo') + ' di ponte liv. ' + lv + ', ne hai ' + have + ' (si comprano negli acquisti).';
    q.res[key] -= pl.pieces;
    const br = { o: G.p, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, x1: a[0], y1: a[1], x2: b[0], y2: b[1], lv, hp: DM.BRIDGE_HP[lv] };
    DM.bridgeId(G, br);
    G.bridges.push(br);
    return 'Ponte liv. ' + lv + ' costruito: ' + pl.len.toFixed(1).replace('.', ',') + ' cm, ' + pl.pieces + (pl.pieces > 1 ? ' pezzi usati.' : ' pezzo usato.');
  };
  DM.removeBridge = function (G, b) {
    G.bridges = G.bridges.filter(z => z !== b);
    if (b.id) G.roads = G.roads.filter(r => r.a !== 'b' + b.id + ':1' && r.a !== 'b' + b.id + ':2' && r.b !== 'b' + b.id + ':1' && r.b !== 'b' + b.id + ':2');
  };

  // Cede un edificio (con quello che contiene e gli edifici interni) a un altro giocatore
  DM.cedeSite = function (G, s, o) {
    if (!s || s.o !== G.p) return 'Seleziona un tuo edificio.';
    if (s.k === 'cap') return 'La Capitale non si può cedere.';
    if (!(o >= 0) || !G.players[o] || G.players[o].out || o === G.p) return 'Giocatore non valido.';
    G.sites.filter(z => z === s || z.par === s.id).forEach(z => { z.o = o; });
    G.roads = G.roads.filter(r => r.a !== s.id && r.b !== s.id);
    return DM.nameOf(s.k) + ' ceduto a ' + G.names[o] + '.';
  };
})(globalThis.DM = globalThis.DM || {});
