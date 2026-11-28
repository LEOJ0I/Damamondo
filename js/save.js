// Damamondo – salvare e riprendere una partita (testo JSON). Nessun DOM qui.
(function (DM) {
  'use strict';
  const VERSION = 1;
  const KEYS = ['seed', 'phase', 'np', 'names', 'players', 'p', 'round', 'moved', 'shots', 'berried',
    'units', 'sites', 'roads', 'bridges', 'rad', 'events', 'uid', 'gid', 'sid', 'bid', 'bots'];

  // La mappa si rifà da opzioni + numero; si salvano solo le eruzioni in corso.
  DM.serialize = function (G) {
    if (G.map.custom) throw new Error('Le mappe disegnate a mano non si salvano.');
    const o = { v: VERSION, game: 'damamondo', saved: Date.now(), map: { opts: G.map.opts, erupt: G.map.erupt } };
    KEYS.forEach(k => { o[k] = G[k]; });
    // territorio: una cifra per cella (0 = di nessuno, 1–6 = giocatore)
    let t = '';
    for (let i = 0; i < G.terr.length; i++) t += String.fromCharCode(48 + G.terr[i] + 1);
    o.terr = t;
    return JSON.stringify(o);
  };

  DM.deserialize = function (text) {
    const o = JSON.parse(text);
    if (!o || o.game !== 'damamondo' || !o.map || typeof o.terr !== 'string') throw new Error('Questo non è un salvataggio di Damamondo.');
    if (o.v > VERSION) throw new Error('Salvataggio di una versione più nuova del gioco.');
    const G = DM.newGame(Object.assign({ gen: 1 }, o.map.opts), o.seed);   // salvataggi vecchi: generatore 1
    KEYS.forEach(k => { if (o[k] !== undefined) G[k] = o[k]; });
    G.map.erupt = o.map.erupt || [];
    if (G.map.erupt.some(z => z.until > G.round)) DM.rebuildMap(G.map, G.round);
    if (o.terr.length !== G.terr.length) throw new Error('Salvataggio rovinato (territorio).');
    for (let i = 0; i < G.terr.length; i++) G.terr[i] = o.terr.charCodeAt(i) - 49;
    return G;
  };

  // Riassunto per l'elenco dei salvataggi
  DM.saveSummary = function (text) {
    try {
      const o = JSON.parse(text);
      return { when: o.saved, round: o.round, np: o.np, phase: o.phase, names: o.names, turn: o.names && o.names[o.p], classic: !!(o.map && o.map.opts && o.map.opts.mode === 'classico') };
    } catch (e) { return null; }
  };
})(globalThis.DM = globalThis.DM || {});
