// Damamondo – territori: terre mai conquistate, conquista (11) e cessione.
(function (DM) {
  'use strict';
  const { W, H, TR } = DM;

  const cellCenter = i => [(i % (W * TR) + .5) / TR, (Math.floor(i / (W * TR)) + .5) / TR];
  DM.cellCenter = cellCenter;

  // 11.1: le terre di nessuno entro 2 cm diventano del giocatore. Restituisce le celle prese.
  DM.claim = function (G, o, x, y) {
    const out = [], w = W * TR, h = H * TR, r = 2 * TR, a = Math.floor(x * TR), b = Math.floor(y * TR);
    for (let j = Math.max(0, b - r); j <= Math.min(h - 1, b + r); j++) {
      for (let i = Math.max(0, a - r); i <= Math.min(w - 1, a + r); i++) {
        const k = j * w + i;
        if (G.terr[k] >= 0 || (i + .5 - x * TR) ** 2 + (j + .5 - y * TR) ** 2 > r * r) continue;
        if (DM.NO_CLAIM.includes(DM.bAt(G, (i + .5) / TR, (j + .5) / TR))) continue;
        G.terr[k] = o; out.push(k);
      }
    }
    return out;
  };

  // 11.2–11.3: conquista attorno alla truppa u (2 cm). Restituisce un messaggio.
  DM.conquer = function (G, u) {
    const w = W * TR, r = 2 * TR, a = Math.floor(u.x * TR), b = Math.floor(u.y * TR);
    let n = 0, msg = '';
    for (let j = Math.max(0, b - r); j <= Math.min(H * TR - 1, b + r); j++) {
      for (let i = Math.max(0, a - r); i <= Math.min(w - 1, a + r); i++) {
        const c = G.terr[j * w + i];
        if (c >= 0 && c !== u.o && (i + .5 - u.x * TR) ** 2 + (j + .5 - u.y * TR) ** 2 <= r * r) { G.terr[j * w + i] = u.o; n++; }
      }
    }
    const taken = G.sites.filter(s => s.o !== u.o && Math.hypot(s.x - u.x, s.y - u.y) <= 2);
    const losers = new Set(), capLost = new Set();
    taken.forEach(s => {
      if (s.k === 'cap') { s.k = 'citta'; capLost.add(s.o); }
      losers.add(s.o);
      s.o = u.o;
    });
    G.roads = G.roads.filter(r2 => !taken.some(s => s.id === r2.a || s.id === r2.b));
    losers.forEach(o => {
      if (capLost.has(o)) msg += DM.capitalLost(G, o);
      else if (G.players[o].noCap) msg += DM.checkEliminated(G, o);
    });
    if (n || taken.length) msg = ' ' + G.names[u.o] + ' ha conquistato territori' + (taken.length ? ' e ' + taken.length + ' edifici' : '') + '.' + msg;
    return msg;
  };

  // Ogni giro: truppe in territorio nemico da 3 giri senza nemici entro 2 cm → conquista.
  DM.conquestTick = function (G) {
    let msg = '';
    G.units.forEach(u => {
      const c = DM.terrAt(G, u.x, u.y);
      if (c >= 0 && c !== u.o) {
        u.oc = (u.oc || 0) + 1;
        if (u.oc >= 3 && !G.units.some(v => v.o !== u.o && Math.hypot(v.x - u.x, v.y - u.y) <= 2)) msg += DM.conquer(G, u);
      } else u.oc = 0;
    });
    return msg;
  };

  // ---- Cessione di territorio ----
  const segD = DM.segD = function (x, y, r) {
    const dx = r.x2 - r.x1, dy = r.y2 - r.y1;
    const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (y - r.y1) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - r.x1 - t * dx, y - r.y1 - t * dy);
  };
  const cross = (a, b, c, d) => {
    const o = (p1, p2, p3) => (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
  };

  // pts: punti della linea; (sx, sy): punto del lato da cedere. Restituisce {cells, auto, snap} oppure {err}.
  DM.cedeCompute = function (G, pts, sx, sy, noSnap) {
    const w = W * TR, h = H * TR, i0 = DM.terrIdx(sx, sy), o = G.p;
    if (pts.length < 2) return { err: 'Servono almeno 2 punti.' };
    if (i0 < 0 || G.terr[i0] !== o) return { err: 'Tocca un punto del TUO territorio.' };
    const segs = pts.slice(1).map((q, k) => ({ x1: pts[k][0], y1: pts[k][1], x2: q[0], y2: q[1] }));
    const bio = i => { const c = cellCenter(i); return DM.bAt(G, c[0], c[1]); };
    // La linea segue un confine tra biomi? (70% dei punti vicino a un cambio di bioma)
    let near = 0, tot = 0;
    segs.forEach(s => {
      const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), n = Math.max(1, Math.ceil(L / .25));
      for (let k = 0; k <= n; k++) {
        const px = s.x1 + (s.x2 - s.x1) * k / n, py = s.y1 + (s.y2 - s.y1) * k / n, b0 = DM.bAt(G, px, py);
        tot++;
        if ([0, 1, 2, 3, 4, 5, 6, 7].some(a => DM.bAt(G, px + Math.cos(a * .785) * .5, py + Math.sin(a * .785) * .5) !== b0)) near++;
      }
    });
    const auto = tot > 0 && near / tot >= .7;
    let snap = !noSnap && auto;
    const fill = barrier => {
      const seen = new Uint8Array(w * h), q = [i0], out = [];
      seen[i0] = 1;
      while (q.length) {
        const i = q.pop();
        out.push(i);
        for (const j of [i - 1, i + 1, i - w, i + w]) {
          if (j < 0 || j >= w * h || seen[j] || G.terr[j] !== o) continue;
          if ((j === i - 1 && i % w === 0) || (j === i + 1 && j % w === 0)) continue;
          if (barrier) {
            const a = cellCenter(i), b = cellCenter(j);
            if (snap) {
              const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
              if (Math.min(...segs.map(s => segD(m[0], m[1], s))) < .6 && bio(i) !== bio(j)) continue;
            } else if (segs.some(s => cross([s.x1, s.y1], [s.x2, s.y2], a, b))) continue;
          }
          seen[j] = 1; q.push(j);
        }
      }
      return out;
    };
    const all = fill(false);
    let cells = fill(true);
    // se i confini dei biomi vicini alla linea non chiudono la zona, vale la linea libera
    if (snap && cells.length === all.length) { snap = false; cells = fill(true); }
    if (cells.length === all.length) return { err: 'La linea non divide il tuo territorio: traccia una linea che lo attraversi da un lato all’altro.' };
    return { cells, auto, snap };
  };

  const inCells = cells => { const S = new Set(cells); return s => S.has(DM.terrIdx(s.x, s.y)); };

  // Cede le celle al giocatore "to" (-1 = nessuno). keep = non cedere edifici.
  DM.cedeApply = function (G, cells, to, keep) {
    const at = inCells(cells), o = G.p;
    if (!keep && G.sites.some(s => s.o === o && s.k === 'cap' && at(s))) return { err: 'La zona contiene la tua Capitale: attiva "Non cedere edifici" o cambia linea.' };
    cells.forEach(i => { G.terr[i] = to; });
    const moved = keep ? [] : G.sites.filter(s => s.o === o && at(s));
    if (to >= 0) moved.forEach(s => { s.o = to; });
    else moved.forEach(s => DM.destroySite(G, s));
    G.roads = G.roads.filter(r => !moved.some(s => s.id === r.a || s.id === r.b));
    return { msg: 'Territorio ceduto' + (to >= 0 ? ' a ' + G.names[to] : ' (senza proprietario)') + '. Edifici passati: ' + moved.length + (to < 0 && moved.length ? ' (persi)' : '') + '.' };
  };

  // Cessione a un nuovo giocatore che nasce con il kit scelto e la Capitale nella zona.
  DM.cedeNewPlayer = function (G, cells, kitIdx, keep) {
    if (G.np >= DM.MAX_PLAYERS) return { err: 'Il massimo è ' + DM.MAX_PLAYERS + ' giocatori.' };
    const at = inCells(cells);
    if (!keep && G.sites.some(s => s.o === G.p && s.k === 'cap' && at(s))) return { err: 'La zona contiene la tua Capitale: attiva "Non cedere edifici" o cambia linea.' };
    let mx = 0, my = 0;
    cells.forEach(i => { const c = cellCenter(i); mx += c[0]; my += c[1]; });
    mx /= cells.length; my /= cells.length;
    // Punto valido più vicino al centro della zona, rispettando la distanza minima tra Capitali
    const spot = cells.map(cellCenter).filter(c => !DM.capitalSpotError(G, c[0], c[1], G.np + 1))
      .sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my))[0];
    if (!spot) return { err: 'Nella zona non c’è un punto valido per la Capitale (bioma adatto e almeno ' + DM.capitalMinDist(G.np + 1) + ' cm dalle altre Capitali).' };
    const o = G.np++;
    G.names.push('Giocatore ' + G.np);
    G.players[o] = { kit: kitIdx, res: {}, sold: '', out: false };
    const r = DM.cedeApply(G, cells, o, keep);
    DM.initPlayer(G, o, kitIdx, spot[0], spot[1]);
    return { msg: G.names[o] + ' (kit ' + DM.KITS[kitIdx].name + ') è entrato in gioco, con la Capitale nella zona ceduta. ' + r.msg };
  };
})(globalThis.DM = globalThis.DM || {});
