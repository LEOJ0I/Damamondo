// Damamondo – economia: soldi e materiali negli edifici, Banco, acquisti, carichi, miniere, rendita (6, 7, 9, 10).
(function (DM) {
  'use strict';
  const T = DM.TROOPS;

  DM.fmtInv = function (v) {
    const parts = [];
    if (v.mon) parts.push(DM.fmtN(v.mon) + ' soldi');
    DM.ITEMS.forEach(m => { if (v.mat[m] > 0) parts.push(DM.fmtN(v.mat[m]) + ' ' + DM.unitOf(m) + ' ' + DM.nameOf(m).toLowerCase()); });
    return parts.join(' · ') || 'vuoto';
  };
  DM.costText = o => DM.fmtN(o.m) + ' soldi' + Object.keys(o.r).map(m => ', ' + DM.fmtN(o.r[m]) + ' ' + DM.unitOf(m) + ' ' + m).join('');
  DM.costsText = k => DM.COST[k].map(DM.costText).join(' oppure ');
  DM.mulCost = (o, n) => ({ m: o.m * n, r: Object.fromEntries(Object.entries(o.r).map(e => [e[0], e[1] * n])) });

  const canPay = (invs, o) => invs.reduce((t, I) => t + I.mon, 0) >= o.m &&
    Object.keys(o.r).every(m => invs.reduce((t, I) => t + (I.mat[m] || 0), 0) >= o.r[m]);
  // Paga la prima alternativa possibile prendendo dagli inventari in ordine. Restituisce l'alternativa o null.
  DM.pay = function (invs, ops) {
    const o = ops.find(z => canPay(invs, z));
    if (!o) return null;
    let mon = o.m;
    invs.forEach(I => { const t = Math.min(I.mon, mon); I.mon -= t; mon -= t; });
    for (const m in o.r) {
      let q = o.r[m];
      invs.forEach(I => { const t = Math.min(I.mat[m] || 0, q); I.mat[m] = (I.mat[m] || 0) - t; q -= t; });
    }
    return o;
  };

  // ---- Banco (10): un solo materiale per turno, i soldi restano nell'edificio ----
  DM.sell = function (G, site, m, n) {
    const q = DM.cur(G), [lot, price] = DM.BANK[m];
    n = Math.max(1, Math.floor(n) || 1);
    if (!site || site.o !== G.p) return 'Seleziona prima l’edificio da cui vendere.';
    if (q.sold && q.sold !== m) return 'In un turno puoi vendere un solo tipo di materiale (hai già venduto ' + q.sold + ').';
    if ((site.inv.mat[m] || 0) < lot * n) return 'Non hai abbastanza ' + m + ' in questo edificio (servono ' + DM.fmtN(lot * n) + ' ' + DM.unitOf(m) + ').';
    site.inv.mat[m] -= lot * n;
    site.inv.mon += price * n;
    q.sold = m;
    return 'Venduti ' + DM.fmtN(lot * n) + ' ' + DM.unitOf(m) + ' di ' + m + ' per ' + DM.fmtN(price * n) + ' soldi.';
  };

  // ---- Acquisti dall'edificio selezionato ----
  DM.BUYABLE = Object.keys(DM.COST);
  DM.buy = function (G, site, k) {
    const q = DM.cur(G);
    if (!site || site.o !== G.p) return 'Seleziona prima l’edificio in cui compri (servono i soldi e i materiali lì).';
    if (T[k] && !DM.SPAWNS[site.k].includes(k)) return 'Qui non si può creare ' + DM.nameOf(k) + '.';
    if (T[k] && !DM.canStand(G, k, site.x, site.y)) return DM.nameOf(k) + ' non può stare qui.';
    if (k === 'bomba' && !DM.BOMB.bomba.from.includes(site.k)) return 'Le Bombe si creano in Capitale, Città o Accampamento.';
    if (k === 'superbomba' && !DM.BOMB.superbomba.from.includes(site.k)) return 'Le Superbombe si creano in Capitale o Città.';
    if (!DM.pay([site.inv], DM.COST[k])) return 'Non hai abbastanza risorse in questo edificio per ' + DM.nameOf(k) + '. Serve: ' + DM.costsText(k) + '.';
    if (T[k]) {
      DM.addUnit(G, k, G.p, site.x, site.y);
      DM.claim(G, G.p, site.x, site.y);
      let extra = '';
      if (k === 'X' || k === 'A') {   // in regalo un Carro
        if (DM.canStand(G, 'C', site.x, site.y)) { DM.addUnit(G, 'C', G.p, site.x, site.y); extra = ' In regalo un Carro.'; }
        else { q.res.C = (q.res.C || 0) + 1; extra = ' Il Carro in regalo è nella riserva.'; }
      }
      return DM.nameOf(k) + ' creato in ' + DM.nameOf(site.k) + '.' + extra;
    }
    if (k === 'bomba' || k === 'superbomba' || DM.POTIONS[k]) {
      site.inv.mat[k] = (site.inv.mat[k] || 0) + 1;
      return DM.nameOf(k) + ' creata in ' + DM.nameOf(site.k) + '.';
    }
    q.res[k] = (q.res[k] || 0) + 1;
    return DM.nameOf(k) + ' comprato: lo trovi nella riserva.';
  };

  // 7.2: l'Accampamento diventa Città pagando la differenza
  DM.upgradeCamp = function (G, site) {
    if (!site || site.o !== G.p || site.k !== 'acc') return 'Seleziona un tuo Accampamento.';
    if (DM.NO_CITY.includes(DM.bAt(G, site.x, site.y))) return 'Niente città in Giungla, Palude o Alta montagna.';
    const ops = DM.COST.citta.map(o => ({ m: o.m - DM.COST.acc[0].m, r: o.r }));
    if (!DM.pay([site.inv], ops)) return 'Servono in questo Accampamento: ' + ops.map(DM.costText).join(' oppure ') + '.';
    site.k = 'citta'; site.hp += DM.BUILDING_HP.citta - DM.BUILDING_HP.acc; site.r0 = G.round;
    return 'L’Accampamento ora è una Città.';
  };

  // ---- Carichi (Carro, Nave Carro, Aereo Carro): soldi a multipli di 1000, materiali a peso 1 ----
  DM.cargoPts = g => g.mon / DM.MONEY_PER_POINT + DM.ITEMS.reduce((s, m) => s + (g.mat[m] || 0) / DM.PER_POINT[m], 0);
  const cargo = c => c.cg || (c.cg = { mon: 0, mat: {} });
  const lotOf = m => m === 'mon' ? 1000 : 1;
  DM.cargoNear = (G, site) => G.units.filter(u => u.o === G.p && DM.CARGO_CAP[u.t] && Math.hypot(u.x - site.x, u.y - site.y) <= 1);
  DM.loadCargo = function (G, c, site, m, qty) {
    if (!c || !DM.CARGO_CAP[c.t] || c.o !== G.p) return 'Serve un tuo Carro, Nave Carro o Aereo Carro.';
    if (Math.hypot(c.x - site.x, c.y - site.y) > 1) return 'Il veicolo deve essere entro 1 cm dall’edificio.';
    if (c.t === 'A' && site.k !== 'aer' && !G.sites.some(s => s.o === G.p && s.k === 'aer' && Math.hypot(s.x - c.x, s.y - c.y) <= .3)) return 'L’Aereo Carro carica e scarica solo in un Aeroporto.';
    const I = site.inv, g = cargo(c), per = m === 'mon' ? DM.MONEY_PER_POINT : DM.PER_POINT[m], lot = lotOf(m);
    const free = DM.CARGO_CAP[c.t] - DM.cargoPts(g);
    const have = m === 'mon' ? I.mon : (I.mat[m] || 0);
    const n = Math.floor(Math.min(have, free * per + 1e-6, qty > 0 ? qty : Infinity) / lot) * lot;
    if (n <= 0) return 'Non c’è spazio (o niente da caricare).';
    if (m === 'mon') { I.mon -= n; g.mon += n; } else { I.mat[m] -= n; g.mat[m] = (g.mat[m] || 0) + n; }
    return 'Caricati ' + DM.fmtN(n) + ' ' + (m === 'mon' ? 'soldi' : DM.unitOf(m) + ' di ' + DM.nameOf(m).toLowerCase()) + '.';
  };
  DM.unloadCargo = function (G, c, site, m, qty) {
    if (!c || !c.cg || c.o !== G.p) return 'Niente da scaricare.';
    if (Math.hypot(c.x - site.x, c.y - site.y) > 1) return 'Il veicolo deve essere entro 1 cm dall’edificio.';
    if (c.t === 'A' && site.k !== 'aer' && !G.sites.some(s => s.o === G.p && s.k === 'aer' && Math.hypot(s.x - c.x, s.y - c.y) <= .3)) return 'L’Aereo Carro carica e scarica solo in un Aeroporto.';
    const I = site.inv, g = c.cg, keys = m ? [m] : ['mon'].concat(DM.ITEMS);
    let moved = 0;
    keys.forEach(k => {
      const have = k === 'mon' ? g.mon : (g.mat[k] || 0), lot = lotOf(k);
      const n = Math.floor(Math.min(have, m && qty > 0 ? qty : Infinity) / lot) * lot;
      if (n <= 0) return;
      if (k === 'mon') { g.mon -= n; I.mon += n; } else { g.mat[k] -= n; I.mat[k] = (I.mat[k] || 0) + n; }
      moved++;
    });
    return moved ? 'Scaricato in ' + DM.nameOf(site.k) + '.' : 'Niente da scaricare.';
  };

  // ---- Miniere (9) ----
  DM.mineError = function (G, x, y) {
    const b = DM.bAt(G, x, y);
    if (!(DM.cur(G).res.min > 0)) return 'Non hai Miniere in riserva.';
    if (!b || !DM.MINE_TABLE[b]) return 'Qui non si può scavare (serve terraferma: niente mare, fiumi, Banchisa o Lavico).';
    if (DM.terrAt(G, x, y) !== G.p) return 'Devi costruire dentro il tuo territorio.';
    if (!DM.troopNear(G, G.p, x, y, 2)) return 'Serve una tua truppa entro 2 cm.';
    if (G.sites.some(s => s.k === 'min' && Math.hypot(s.x - x, s.y - y) < 2)) return 'Troppo vicina a un’altra miniera (minimo 2 cm).';
    return '';
  };
  // dice: risultato scelto (kit Maghi) oppure undefined per tirare il dado. Restituisce {err} o {die, mat, qty}.
  DM.buildMine = function (G, x, y, dice) {
    const err = DM.mineError(G, x, y);
    if (err) return { err };
    const q = DM.cur(G);
    let d;
    if (dice && q.dice > 0) { d = dice; q.dice--; } else d = DM.d6();
    const mt = DM.MINE_TABLE[DM.bAt(G, x, y)].split(' ')[d - 1];
    const s = DM.addSite(G, G.p, 'min', x, y, { mt });
    s.inv.mat[mt] = DM.QTY[mt];
    q.res.min--;
    return { die: d, mat: mt, qty: DM.QTY[mt], site: s };
  };

  // ---- Produzione a ogni giro ----
  DM.economyTick = function (G) {
    G.sites.forEach(s => {
      const age = G.round - s.r0;
      if (age <= 0) return;
      // Coltivazioni: una bacca ogni 5 giri, del bioma in cui si trovano
      if (s.k === 'col' && age % 5 === 0) {
        const kind = DM.BERRY_OF_BIOME[DM.bAt(G, s.x, s.y)];
        if (kind) s.inv.mat['bacca_' + kind] = (s.inv.mat['bacca_' + kind] || 0) + 1;
      }
      // Miniere: la stessa quantità ogni 5 giri, se sono ancora nel territorio del proprietario
      if (s.k === 'min' && age % 5 === 0 && DM.terrAt(G, s.x, s.y) === s.o) s.inv.mat[s.mt] = (s.inv.mat[s.mt] || 0) + DM.QTY[s.mt];
      // Rendita ogni 10 giri dalla costruzione. Una Città con meno di 5.000 soldi conta come Accampamento (7.2).
      if ((s.k === 'cap' || (s.k === 'citta' && s.inv.mon >= DM.CITY_MIN_MONEY)) && age % 10 === 0) s.inv.mon += DM.INCOME[s.k] + (s.up || 0);
    });
  };
})(globalThis.DM = globalThis.DM || {});
