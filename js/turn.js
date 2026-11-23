// Damamondo – fine turno, giri, eruzioni (12.5), bruciature e penalità senza Capitale.
(function (DM) {
  'use strict';

  DM.erupt = function (G, i) {
    const v = G.map.volc[i];
    G.map.erupt.push({ v: i, until: G.round + 3 });
    const near = (x, y) => Math.hypot(x - v[0], y - v[1]) <= 2.1;
    G.units = G.units.filter(u => !near(u.x, u.y));
    let msg = ' Un vulcano è eruttato!';
    G.sites.filter(s => near(s.x, s.y) && !s.ign).forEach(s => { msg += DM.destroySite(G, s); });
    return msg;
  };

  // Eventi di inizio giro
  DM.tick = function (G) {
    let msg = '';
    const m = G.map, before = m.erupt.length;
    m.erupt = m.erupt.filter(z => z.until > G.round);
    let changed = m.erupt.length !== before;
    if (G.round % 10 === 0 && m.opts.comp > 1) {
      m.volc.forEach((v, i) => { if (DM.d6() === 1) { msg += DM.erupt(G, i); changed = true; } });
    }
    if (changed) DM.rebuildMap(m, G.round);
    G.rad = G.rad.filter(z => z.until > G.round);
    DM.economyTick(G);
    msg += DM.conquestTick(G);
    return msg;
  };

  DM.endTurn = function (G) {
    if (G.phase !== 'play') return '';
    let msg = '';
    const q0 = G.p;
    if (G.players.every(q => q.out)) return '';
    do { G.p = (G.p + 1) % G.np; } while (G.players[G.p].out);
    G.players.forEach(q => { q.sold = ''; });
    if (G.p <= q0) { G.round++; msg += DM.tick(G); }
    G.berried = false; G.moved = 0; G.shots = 0;
    G.units.forEach(u => { u.m = false; u.s = false; });
    // Bruciature del Lavico (3 turni, non si sommano) per le truppe del giocatore di turno
    G.units.filter(u => u.o === G.p && !u.carried).forEach(u => {
      if (DM.bAt(G, u.x, u.y) === 'Z' && DM.TROOPS[u.t].kind !== 'air') u.bn = 3;
      if (u.bn > 0) { u.hp -= DM.BURN[u.t] || 0; u.bn--; }
    });
    const burnt = DM.cleanupDead(G);
    if (burnt.length) msg += ' ' + burnt.length + ' truppe bruciate nel Lavico.' + DM.vehicleNote(burnt);
    const q = DM.cur(G);
    if (q.noCap) { DM.takeMoney(G, G.p, 10000); msg += ' Senza Capitale: −10.000 soldi.'; }
    return 'Turno di ' + G.names[G.p] + '.' + msg;
  };
})(globalThis.DM = globalThis.DM || {});
