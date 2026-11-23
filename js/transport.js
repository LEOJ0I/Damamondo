// Damamondo – trasporto di truppe sui veicoli e autista dei veicoli distrutti (6), Porti (8.1).
(function (DM) {
  'use strict';
  const T = DM.TROOPS;

  DM.hasPort = (G, o) => G.sites.some(s => s.o === o && s.k === 'porto');

  // Molo di un Porto: dal Porto alla terra più vicina (entro 1,2 cm). Le truppe di terra ci camminano.
  DM.dockOf = function (G, s) {
    if (s.dock === undefined) {
      s.dock = null;
      for (let r = 0; r <= 1.2001 && !s.dock; r += .05) {
        for (let a = 0; a < 32; a++) {
          const x = s.x + Math.cos(a * Math.PI / 16) * r, y = s.y + Math.sin(a * Math.PI / 16) * r, b = DM.bAt(G, x, y);
          if (b && !DM.WATER.includes(b) && b !== 'I') { s.dock = [x, y]; break; }
        }
      }
    }
    return s.dock;
  };
  DM.onPier = (G, o, x, y) => G.sites.some(s => s.o === o && s.k === 'porto' && Math.hypot(s.x - x, s.y - y) < 1.6 &&
    (Math.hypot(s.x - x, s.y - y) <= .35 || (DM.dockOf(G, s) && DM.segD(x, y, { x1: s.x, y1: s.y, x2: s.dock[0], y2: s.dock[1] }) <= .2)));
  // punto di fiume entro 1 cm dalla città (per mettere in acqua una Nave senza Porto)
  DM.riverSpot = function (G, s) {
    for (let r = .1; r <= 1.0001; r += .1) for (let a = 0; a < 24; a++) {
      const x = s.x + Math.cos(a * Math.PI / 12) * r, y = s.y + Math.sin(a * Math.PI / 12) * r;
      if (DM.bAt(G, x, y) === 'F') return [x, y];
    }
    return null;
  };
  DM.portAt = (G, o, x, y) => G.sites.find(s => s.o === o && s.k === 'porto' && Math.hypot(s.x - x, s.y - y) <= .35);
  DM.aboard = (G, v) => G.units.filter(u => u.carried === v.id);
  DM.aboardPts = (G, v) => DM.aboard(G, v).reduce((s, u) => s + DM.TROOP_VALUE[u.t], 0);
  const atAirport = (G, v) => G.sites.some(s => s.o === v.o && s.k === 'aer' && Math.hypot(s.x - v.x, s.y - v.y) <= .3);

  // Le truppe a bordo stanno sempre dove sta il loro veicolo (anche un Carro dentro una Nave Carro)
  DM.syncCarried = function (G) {
    for (let k = 0; k < 4; k++) {
      G.units.forEach(u => {
        if (!u.carried) return;
        const v = DM.unitById(G, u.carried);
        if (v) { u.x = u.px = v.x; u.y = u.py = v.y; }
      });
    }
  };

  // Può u salire sul veicolo v? '' se sì
  DM.boardError = function (G, v, u) {
    if (!v || !u || v.o !== G.p || u.o !== G.p) return 'Servono un tuo veicolo e una tua truppa.';
    if (!DM.TROOP_CAP[v.t]) return T[v.t].name + ' non trasporta truppe.';
    if (u === v || u.carried) return 'Questa truppa è già a bordo.';
    if (v.carried) return 'Il veicolo è a sua volta a bordo di un altro.';
    if (!DM.TROOP_VALUE[u.t]) return T[u.t].name + ' non si può trasportare.';
    if (u.g) return 'La truppa è in un esercito: falla uscire prima.';
    if (Math.hypot(u.x - v.x, u.y - v.y) > 1) return 'La truppa deve essere entro 1 cm dal veicolo.';
    if (v.t === 'A' && !atAirport(G, v)) return 'L’Aereo Carro carica solo in un Aeroporto.';
    const free = DM.TROOP_CAP[v.t] - DM.aboardPts(G, v);
    if (DM.TROOP_VALUE[u.t] > free) return 'Non c’è posto: ' + T[u.t].name + ' vale ' + DM.TROOP_VALUE[u.t] + ' punti, liberi ' + free + ' su ' + DM.TROOP_CAP[v.t] + '.';
    return '';
  };
  DM.board = function (G, v, u) {
    const err = DM.boardError(G, v, u);
    if (err) return err;
    u.carried = v.id;
    DM.syncCarried(G);
    return T[u.t].name + ' è salito su ' + T[v.t].name + ' (' + DM.aboardPts(G, v) + '/' + DM.TROOP_CAP[v.t] + ' punti).';
  };

  // Punto dove una truppa può scendere: sul veicolo o il più vicino entro 1 cm
  function dropSpot(G, t, x, y, o) {
    const ok = (px, py) => DM.canStand(G, t, px, py, o) && !(T[t].kind === 'air' && 'ZI'.includes(DM.bAt(G, px, py)));
    if (ok(x, y)) return [x, y];
    for (let r = .2; r <= 1.001; r += .1) {
      for (let a = 0; a < 24; a++) {
        const px = x + Math.cos(a * Math.PI / 12) * r, py = y + Math.sin(a * Math.PI / 12) * r;
        if (ok(px, py)) return [px, py];
      }
    }
    return null;
  }

  DM.unboard = function (G, v, u) {
    if (!v || !u || u.carried !== v.id || v.o !== G.p) return 'Questa truppa non è a bordo di questo veicolo.';
    if (v.t === 'A' && !atAirport(G, v)) return 'L’Aereo Carro fa scendere le truppe solo in un Aeroporto.';
    let spot;
    if (T[v.t].kind === 'sea' && T[u.t].kind !== 'sea') {
      // dalle navi si scende dentro un proprio Porto
      const port = DM.portAt(G, v.o, v.x, v.y);
      if (!port) return 'Dalle navi si scende solo dentro un tuo Porto: porta la nave nel Porto.';
      spot = [port.x, port.y];
    } else spot = dropSpot(G, u.t, v.x, v.y, v.o);
    if (!spot) return 'Qui ' + T[u.t].name + ' non può scendere (serve un terreno adatto entro 1 cm).';
    u.carried = 0;
    u.x = u.px = spot[0]; u.y = u.py = spot[1];
    DM.claim(G, u.o, u.x, u.y);
    DM.syncCarried(G);
    return T[u.t].name + ' è sceso da ' + T[v.t].name + '.';
  };

  // Veicolo distrutto: scendono quelli a bordo (se il terreno lo permette) e in più 1 Soldato, l'autista
  DM.releaseOnDeath = function (G, v) {
    if (v.t === 'S' || v.carried || v.lost) return '';
    const on = DM.aboard(G, v);
    let saved = 0, lost = 0;
    on.forEach(u => {
      u.carried = 0;
      const spot = dropSpot(G, u.t, v.x, v.y, v.o);
      if (spot) { u.x = u.px = spot[0]; u.y = u.py = spot[1]; saved++; } else { u.hp = 0; u.lost = true; lost++; }
    });
    const ds = dropSpot(G, 'S', v.x, v.y, v.o);
    let msg = ' ' + T[v.t].name + ' distrutto: ';
    if (ds) { DM.addUnit(G, 'S', v.o, ds[0], ds[1]).m = true; msg += 'l’autista si salva'; } else msg += 'l’autista finisce in acqua';
    if (saved) msg += ', scendono ' + saved + ' truppe';
    if (lost) msg += ', ' + lost + ' truppe a bordo perse';
    return msg + '.';
  };
})(globalThis.DM = globalThis.DM || {});
