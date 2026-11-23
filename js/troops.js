// Damamondo – truppe: velocità, danno/gittata, movimento, strade, eserciti (4, 5, 12, 13, 14).
(function (DM) {
  'use strict';
  const T = DM.TROOPS;

  // Velocità del terreno senza ponti né modificatori
  DM.terrainSpeed = function (t, b) {
    const d = T[t];
    if (!b) return 0;
    if (d.kind === 'air') return d.air;
    if (d.kind === 'sea') return b === 'S' ? d.sea : b === 'I' ? d.ice : b === 'F' ? d.river : 0;
    return DM.WATER.includes(b) ? 0 : d.land[b];
  };

  DM.bridgeAt = (G, x, y) => G.bridges.find(r => DM.segD(x, y, r) < .35);
  DM.inRad = (G, x, y) => G.rad.some(z => z.until > G.round && Math.hypot(z.x - x, z.y - y) <= z.r);

  // Velocità di base nel punto, con i ponti (8.3) e i moli dei Porti del giocatore o
  DM.baseSpeed = function (G, t, x, y, o) {
    const d = T[t], b = DM.bAt(G, x, y);
    if (!b) return 0;
    if (d.kind === 'air' || !DM.WATER.includes(b)) return DM.terrainSpeed(t, b);
    const br = DM.bridgeAt(G, x, y);
    if (d.kind === 'sea') return br && br.lv === 1 ? 0 : DM.terrainSpeed(t, b);
    // a terra sull'acqua: nel proprio Porto e sul suo molo fino alla riva
    if (o !== undefined && DM.onPier(G, o, x, y)) return d.land.P;
    // altrimenti solo sui ponti. Il Carrarmato non passa sul liv. 1, il Carro non attraversa i fiumi.
    return br && t !== 'C' && !(t === 'T' && br.lv === 1) ? d.land.P : 0;
  };
  DM.canStand = (G, t, x, y, o) => DM.baseSpeed(G, t, x, y, o) > 0;

  // Velocità effettiva di una truppa nel punto: bioma → strada → pozione → bacca → radioattività
  DM.speedAt = function (G, u, x, y, road) {
    const d = T[u.t], b = DM.bAt(G, x, y);
    let v = DM.baseSpeed(G, u.t, x, y, u.o);
    if (v <= 0) return 0;
    if (road && (u.t === 'S' || u.t === 'T')) v *= 2;
    if (u.vp === G.round && u.o === G.p) {
      // Pozione Velocità: +1 cm, oppure x2 se il bioma ha un malus (calcolato dopo il malus)
      v = d.kind === 'land' && v < d.land.P ? v * 2 : v + 1;
    }
    if (u.bf && u.bf.until > G.round && u.bf.k === 'L') {
      const st = (DM.BERRY_STACK[u.t] || [0, 0, 0, 0])[3];
      v = d.kind === 'land' && b === 'L' ? Math.max(.05, v + st) : v / 5;
    }
    if (DM.inRad(G, x, y)) v = Math.ceil(v / 2 * 10 - 1e-9) / 10;
    return v;
  };

  // [danno, gittata] di una truppa dove si trova (12.1, 12.3, 12.4, 13, Stipendio+)
  DM.stat = function (G, u) {
    const t = T[u.t], b = DM.bAt(G, u.x, u.y), D = DM.BIOME_DMG[u.t];
    let d = t.dmg, g = t.range;
    if (D && b === 'D') d = D.D;
    if (D && b === 'G') d = D.G;
    if (DM.TUNDRA_RANGE.includes(u.t) && b === 'T') g *= 2;
    const f = u.bf && u.bf.until > G.round ? u.bf.k : null, F = DM.BERRY_STACK[u.t] || [0, 0, 0, 0];
    const feels = !!D;   // truppa che subisce i biomi
    if (f === 'D' || f === 'G') {
      if (feels && b === f) d += F[f === 'D' ? 0 : 1];
      else if (feels && (b === 'D' || b === 'G')) d = t.dmg;   // deserto + giungla si annullano
      else d = Math.round((f === 'D' ? t.dmg / 1.5 : t.dmg * 1.5) / 10) * 10;
    }
    if (f === 'T') g = DM.TUNDRA_RANGE.includes(u.t) && b === 'T' ? g + F[2] : t.range * 2;
    return [Math.max(0, d) * (u.dd === G.round && u.o === G.p ? 2 : 1), g];
  };

  const centroid = us => [us.reduce((s, u) => s + u.x, 0) / us.length, us.reduce((s, u) => s + u.y, 0) / us.length];

  // Movimento libero in linea retta: si ferma dove finisce la velocità o il terreno non va bene.
  DM.planStraight = function (G, us, tx, ty) {
    const [mx, my] = centroid(us), dx = tx - mx, dy = ty - my, L = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(L / .05));
    const lone = us.length === 1 ? us[0] : null;
    // Elicottero che parte da un Aeroporto: +2 cm (4 → 6)
    let bud = lone && lone.t === 'E' && G.sites.some(s => s.o === lone.o && s.k === 'aer' && Math.hypot(s.x - lone.x, s.y - lone.y) <= .3) ? 1.5 : 1;
    let fx = 0, fy = 0;
    for (let i = 1; i <= n; i++) {
      const sx = dx * i / n, sy = dy * i / n;
      let s = Infinity;
      for (const u of us) s = Math.min(s, DM.speedAt(G, u, u.x + sx, u.y + sy));
      if (s <= 0) break;
      const c = (L / n) / s;
      if (bud < c - 1e-9) break;
      bud -= c; fx = sx; fy = sy;
    }
    return { dx: fx, dy: fy, left: bud, path: null };
  };

  // Costo (in frazioni di turno) di un tratto di strada per il gruppo
  function roadCost(G, us, a, b) {
    const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / .05));
    let cost = 0;
    for (let i = 0; i < n; i++) {
      const f = (i + .5) / n, x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
      let s = Infinity;
      for (const u of us) s = Math.min(s, T[u.t].kind === 'land' ? DM.speedAt(G, u, x, y, true) : 0);
      if (s <= 0) return Infinity;
      cost += (L / n) / s;
    }
    return cost;
  }

  // Viaggio sulle strade da un edificio a un altro (passando dagli edifici collegati). Solo truppe di terra.
  DM.planRoad = function (G, us, from, to) {
    if (!from || !to || from === to || us.some(u => T[u.t].kind !== 'land')) return null;
    const dist = new Map([[from.id, 0]]), prev = new Map(), todo = new Set([from.id]);
    while (todo.size) {
      let cur = null;
      todo.forEach(id => { if (cur === null || dist.get(id) < dist.get(cur)) cur = id; });
      todo.delete(cur);
      if (cur === to.id) break;
      const a = DM.siteById(G, cur);
      G.roads.filter(r => r.o === us[0].o && (r.a === cur || r.b === cur)).forEach(r => {
        const nid = r.a === cur ? r.b : r.a, b = DM.siteById(G, nid);
        if (!b) return;
        const c = dist.get(cur) + roadCost(G, us, a, b);
        if (c < (dist.has(nid) ? dist.get(nid) : Infinity)) { dist.set(nid, c); prev.set(nid, cur); todo.add(nid); }
      });
    }
    if (!dist.has(to.id) || dist.get(to.id) > 1 + 1e-9) return null;
    const path = [to.id];
    while (path[0] !== from.id) path.unshift(prev.get(path[0]));
    const [mx, my] = centroid(us);
    return { dx: to.x - mx, dy: to.y - my, left: 1 - dist.get(to.id), path: path.map(id => DM.siteById(G, id)) };
  };

  // Muove la truppa o l'esercito di u verso (tx, ty). Restituisce un messaggio.
  DM.moveUnit = function (G, u, tx, ty) {
    if (u.o !== G.p) return 'Non è una tua truppa.';
    if (u.m) return 'Questa truppa ha già mosso in questo turno.';
    if (u.carried) return 'È a bordo di un veicolo: prima falla scendere.';
    if (G.moved >= DM.moveLimit(G.round)) return 'Limite di movimento raggiunto: puoi muovere al massimo ' + DM.moveLimit(G.round) + ' truppe o eserciti.';
    const A = DM.armyOf(G, u);
    const [mx, my] = centroid(A);
    const own = s => s.o === G.p;
    let target = DM.siteNear(G, tx, ty, own)[0];
    // 4.3: l'Aereo Carro parte e atterra solo negli Aeroporti
    const plane = A.some(v => v.t === 'A');
    if (plane) {
      if (!G.sites.some(s => own(s) && s.k === 'aer' && Math.hypot(s.x - mx, s.y - my) <= .3)) return 'L’Aereo Carro parte solo da un tuo Aeroporto.';
      target = DM.siteNear(G, tx, ty, s => own(s) && s.k === 'aer')[0];
      if (!target) return 'L’Aereo Carro atterra solo in un tuo Aeroporto: tocca l’Aeroporto di arrivo.';
    }
    let plan = null;
    if (target) G.sites.filter(s => own(s) && Math.hypot(s.x - mx, s.y - my) <= .3)
      .forEach(s => { if (!plan) plan = DM.planRoad(G, A, s, target); });
    if (!plan) plan = DM.planStraight(G, A, target ? target.x : tx, target ? target.y : ty);
    const { dx, dy } = plan;
    if (plane && Math.hypot(mx + dx - target.x, my + dy - target.y) > .05) return 'Aeroporto troppo lontano per un turno (' + DM.TROOPS.A.air + ' cm).';
    if (Math.hypot(dx, dy) < .05) return 'Non puoi muoverti verso quel punto.';
    if (A.some(v => T[v.t].kind === 'air' && 'ZI'.includes(DM.bAt(G, v.x + dx, v.y + dy) || ' '))) return 'Le truppe aeree non possono atterrare su Lavico o Banchisa.';
    // punti del percorso per prendere le terre di nessuno lungo la strada
    const pts = plan.path ? plan.path.map(s => [s.x - mx, s.y - my]) : [[dx, dy]];
    A.forEach(v => {
      v.cl = []; v.px = v.x; v.py = v.y;
      let ox = 0, oy = 0;
      pts.forEach(([qx, qy]) => {
        const n = Math.max(1, Math.ceil(Math.hypot(qx - ox, qy - oy) / .5));
        for (let i = 1; i <= n; i++) v.cl.push(...DM.claim(G, v.o, v.px + ox + (qx - ox) * i / n, v.py + oy + (qy - oy) * i / n));
        ox = qx; oy = qy;
      });
      v.x += dx; v.y += dy; v.m = true;
    });
    G.moved++;
    DM.syncCarried(G);
    return plan.path ? 'Viaggio sulla strada completato (' + (plan.path.length - 1) + ' tratti).' : plan.left > .01 ? 'Mossa completata.' : 'Mossa completata: velocità esaurita.';
  };

  DM.undoMove = function (G, u) {
    if (!u || !u.m || u.o !== G.p) return 'Seleziona una truppa che hai appena mosso.';
    const A = DM.armyOf(G, u);
    if (A.some(v => v.s)) return 'Ha già sparato dopo la mossa: non si può annullare.';
    A.forEach(v => { v.x = v.px; v.y = v.py; v.m = false; (v.cl || []).forEach(i => { G.terr[i] = -1; }); v.cl = []; });
    G.moved--;
    DM.syncCarried(G);
    return 'Mossa annullata, anche i territori presi con quella mossa.';
  };

  // ---- Eserciti (5) ----
  DM.compatible = (a, b) => !((a === 'N' && 'STCA'.includes(b)) || (b === 'N' && 'STCA'.includes(a)) ||
    (a === 'X' && 'STC'.includes(b)) || (b === 'X' && 'STC'.includes(a)));
  DM.armyPts = us => {
    const t = us.some(u => u.t === 'N' || u.t === 'X') ? DM.FLEET_PTS : DM.LAND_PTS;
    return us.reduce((s, u) => s + (t[u.t] || 0), 0);
  };
  // Controlla se u può aggiungersi alla scelta pick. Restituisce '' se va bene.
  DM.pickError = function (G, pick, u) {
    if (!u || u.o !== G.p) return 'Tocca una tua truppa.';
    if (u.g) return 'Questa truppa è già in un esercito: scioglilo prima.';
    if (u.m) return 'Questa truppa ha già mosso.';
    if (u.carried) return 'È a bordo di un veicolo.';
    if (pick.includes(u)) return 'Già scelta.';
    if (pick.length && Math.hypot(u.x - pick[0].x, u.y - pick[0].y) > 1) return 'Troppo lontana: serve entro 1 cm dalla prima.';
    if (pick.some(q => !DM.compatible(u.t, q.t))) return T[u.t].name + ' non può stare con queste truppe.';
    if (DM.armyPts(pick.concat(u)) > DM.ARMY_MAX) return 'Tetto di 100 punti superato.';
    return '';
  };
  DM.formArmy = function (G, pick) {
    if (pick.length < 2) return { err: 'Servono almeno 2 truppe.' };
    const pos = pick.find(a => pick.every(u => DM.canStand(G, u.t, a.x, a.y, u.o)));
    if (!pos) return { err: 'Le truppe non possono stare tutte nello stesso punto (terreno non valido).' };
    const g = ++G.gid, used = G.units.filter(u => u.o === G.p && u.g).map(u => u.an);
    let n = 1;
    while (used.includes(n)) n++;
    const px = pos.x, py = pos.y;
    pick.forEach(u => { u.g = g; u.an = n; u.x = u.px = px; u.y = u.py = py; });
    DM.syncCarried(G);
    return { msg: 'Esercito ' + n + ' formato (' + pick.length + ' truppe).', g };
  };
  DM.leaveArmy = function (G, u) {
    if (!u || !u.g || u.o !== G.p) return 'Non è in un tuo esercito.';
    if (u.m) return 'L’esercito ha già mosso: la truppa può uscire dal prossimo turno.';
    const g = u.g, an = u.an;
    u.g = 0; u.an = 0;
    const rest = G.units.filter(v => v.g === g);
    if (rest.length < 2) { rest.forEach(v => { v.g = 0; v.an = 0; }); return 'Esercito ' + an + ' sciolto.'; }
    const spot = [0, 1, 2, 3, 4, 5, 6, 7].map(i => [u.x + Math.cos(i * .785) * .8, u.y + Math.sin(i * .785) * .8]).find(q => DM.canStand(G, u.t, q[0], q[1], u.o));
    if (spot) { u.x = u.px = spot[0]; u.y = u.py = spot[1]; DM.syncCarried(G); }
    return T[u.t].name + ' ha lasciato l’esercito ' + an + '.';
  };
  DM.composition = us => {
    const c = {};
    us.forEach(u => { c[T[u.t].name] = (c[T[u.t].name] || 0) + 1; });
    return Object.entries(c).map(e => e[1] + '× ' + e[0]).join(', ');
  };

  // Schierare una truppa dalla riserva (vicino a Capitale/Città/Accampamento; navi nel Porto; Aereo Carro nell'Aeroporto)
  DM.deploy = function (G, t, x, y) {
    const q = DM.cur(G);
    if (!(q.res[t] > 0)) return 'Non hai ' + T[t].name + ' in riserva.';
    const kinds = T[t].kind === 'sea' ? ['porto'] : t === 'A' ? ['aer'] : t === 'E' ? ['cap', 'citta', 'acc', 'aer'] : ['cap', 'citta', 'acc'];
    const inside = T[t].kind === 'sea' || t === 'A';
    let s = G.sites.filter(z => z.o === G.p && kinds.includes(z.k) && Math.hypot(z.x - x, z.y - y) <= (inside ? G.tapR : 2))
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    // 8.1: sui fiumi il Porto non serve se c'è una tua Città entro 1 cm
    const river = !s && T[t].kind === 'sea' && DM.bAt(G, x, y) === 'F' && G.sites.some(z => z.o === G.p && (z.k === 'cap' || z.k === 'citta') && Math.hypot(z.x - x, z.y - y) <= 1);
    if (!s && !river) return T[t].kind === 'sea' ? 'Le navi nascono dentro un tuo Porto (sui fiumi basta una tua Città entro 1 cm).' : t === 'A' ? 'L’Aereo Carro nasce dentro un tuo Aeroporto: tocca l’Aeroporto.' : 'Troppo lontano da Capitale, Città o Accampamenti (massimo 2 cm).';
    if (s && inside) { x = s.x; y = s.y; }
    if (!DM.canStand(G, t, x, y)) return 'Terreno non valido per ' + T[t].name + '.';
    if (T[t].kind === 'air' && 'ZI'.includes(DM.bAt(G, x, y))) return 'Le truppe aeree non possono atterrare su Lavico o Banchisa.';
    DM.addUnit(G, t, G.p, x, y);
    DM.claim(G, G.p, x, y);
    q.res[t]--;
    return T[t].name + ' schierato.';
  };
})(globalThis.DM = globalThis.DM || {});
