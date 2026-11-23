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

  // ---- Strade (8.4): tra due edifici propri, pezzi da 5 cm, pagate dai due edifici ----
  DM.roadPlan = function (G, a, b) {
    const L = Math.hypot(b.x - a.x, b.y - a.y), pieces = Math.max(1, Math.ceil(L / DM.ROAD_PIECE));
    let hard = false;
    for (let i = 0; i <= Math.ceil(L / .1); i++) {
      const f = Math.min(1, i * .1 / L || 0), x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, k = DM.bAt(G, x, y);
      if (!k) return { err: 'La strada esce dalla mappa.' };
      if (k === 'Z' || k === 'I') return { err: 'Niente strade su Banchisa e Lava.' };
      if (DM.WATER.includes(k)) {
        // sull'acqua la strada si interrompe: serve un ponte (o è il tratto che entra in un Porto)
        const nearEnd = Math.min(Math.hypot(x - a.x, y - a.y), Math.hypot(x - b.x, y - b.y)) <= 1.1;
        if (!nearEnd && !G.bridges.some(r => r.o === G.p && DM.segD(x, y, r) < .35)) return { err: 'La strada non può passare sull’acqua: serve un ponte.' };
      } else if (DM.HARD_ROAD.includes(k)) hard = true;
    }
    const cost = DM.mulCost(DM.ROAD_COST, pieces * (hard ? 2 : 1));
    return { pieces, hard, cost, L };
  };
  DM.buildRoad = function (G, a, b) {
    if (!a || !b || a === b || a.o !== G.p || b.o !== G.p) return 'Tocca un altro tuo edificio.';
    if (G.roads.some(r => (r.a === a.id && r.b === b.id) || (r.a === b.id && r.b === a.id))) return 'Sono già collegati.';
    if (Math.hypot(a.x - b.x, a.y - b.y) < .3) return 'Gli edifici sono nello stesso punto.';
    const pl = DM.roadPlan(G, a, b);
    if (pl.err) return pl.err;
    if (!DM.pay([a.inv, b.inv], [pl.cost])) return 'Servono (in totale nei due edifici) ' + DM.costText(pl.cost) + ' per ' + pl.pieces + (pl.pieces > 1 ? ' pezzi' : ' pezzo') + (pl.hard ? ' (costo doppio)' : '') + '.';
    G.roads.push({ o: G.p, a: a.id, b: b.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    return 'Strada costruita (' + pl.pieces + (pl.pieces > 1 ? ' pezzi' : ' pezzo') + (pl.hard ? ', costo doppio' : '') + ').';
  };

  // ---- Ponti (8.3): dall'edificio selezionato al punto toccato, sopra l'acqua ----
  DM.bridgePlan = function (G, a, x, y, lv) {
    const L = Math.hypot(x - a.x, y - a.y), e = DM.bAt(G, x, y);
    if (!e || DM.WATER.includes(e) || L < .2) return { err: 'Il ponte deve attraversare l’acqua e finire sulla terra.' };
    // tratti da 0,05 cm, misurati al centro di ogni tratto
    let f = 0, s = 0;
    const n = Math.ceil(L / .05);
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n, k = DM.bAt(G, a.x + (x - a.x) * t, a.y + (y - a.y) * t);
      if (!k) return { err: 'Il ponte esce dalla mappa.' };
      if (k === 'F') f++; else if (k === 'S') s++;
    }
    if (f + s === 0) return { err: 'Il ponte deve attraversare l’acqua e finire sulla terra.' };
    const water = (f + s) * L / n;
    if (lv === 1 && s > 0) return { err: 'Il ponte liv. 1 non si piazza sul mare.' };
    if (lv === 2 && s > 0 && water >= 2) return { err: 'Sul mare il ponte liv. 2 deve essere più corto di 2 cm.' };
    const cm = Math.max(1, Math.ceil(water - 1e-9));
    return { cm, cost: DM.mulCost(DM.BRIDGE_COST[lv], cm) };
  };
  DM.buildBridge = function (G, a, x, y, lv) {
    if (!a || a.o !== G.p) return 'Seleziona un tuo edificio da cui parte il ponte.';
    const pl = DM.bridgePlan(G, a, x, y, lv);
    if (pl.err) return pl.err;
    const q = DM.cur(G);
    let free = false;
    if (lv === 1 && q.res.ponte1 > 0) { q.res.ponte1--; free = true; }
    else if (!DM.pay([a.inv], [pl.cost])) return 'Servono in questo edificio ' + DM.costText(pl.cost) + ' (' + pl.cm + ' cm di ponte).';
    G.bridges.push({ o: G.p, x: (a.x + x) / 2, y: (a.y + y) / 2, x1: a.x, y1: a.y, x2: x, y2: y, lv, hp: DM.BRIDGE_HP[lv] });
    return 'Ponte liv. ' + lv + ' costruito (' + pl.cm + ' cm' + (free ? ', quello del kit' : '') + ').';
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
