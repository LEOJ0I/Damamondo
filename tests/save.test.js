// Salvare e riprendere una partita.
const test = require('node:test'), assert = require('node:assert/strict');
const { DM } = require('./helpers');

function realGame() {
  const G = DM.newGame({ isl: 1, hum: 2, temp: 2, comp: 2 }, 7);
  DM.setPlayers(G, 2);
  const spots = [];
  for (let y = 4; y < 38 && spots.length < 2; y++) for (let x = 4; x < 56 && spots.length < 2; x++) {
    if (DM.bAt(G, x, y) === 'P' && !DM.capitalSpotError(G, x, y, 2) && !spots.some(q => Math.hypot(q[0] - x, q[1] - y) < 15)) spots.push([x, y]);
  }
  for (const [x, y] of spots) { DM.chooseKit(G, 0); DM.placeCapital(G, x, y); }
  return { G, spots };
}
const state = G => JSON.stringify({ u: G.units, s: G.sites, r: G.roads, b: G.bridges, p: G.players, round: G.round, cur: G.p, terr: Array.from(G.terr), e: G.map.erupt, rad: G.rad });

test('salva e riprendi: tutto uguale, e la partita continua', () => {
  const { G, spots } = realGame();
  const [A] = spots;
  DM.deploy(G, 'S', A[0] + .5, A[1]);
  DM.deploy(G, 'C', A[0], A[1] + .5);
  const c = G.units.find(u => u.t === 'C'), s = G.units.find(u => u.t === 'S');
  assert.match(DM.board(G, c, s), /salito/);
  DM.capitalOf(G, 0).inv.mat.ferro = 123;
  G.rad.push({ x: 30, y: 20, r: .5, until: 4 });
  DM.endTurn(G); DM.endTurn(G);
  const text = DM.serialize(G);
  const H = DM.deserialize(text);
  assert.equal(state(H), state(G));
  assert.equal(H.map.cells.length, G.map.cells.length);
  assert.ok(H.map.cells.every((v, i) => v === G.map.cells[i]), 'stessa mappa');
  // si continua a giocare sul gioco ripreso
  const c2 = H.units.find(u => u.t === 'C');
  assert.match(DM.unboard(H, c2, H.units.find(u => u.carried === c2.id)), /sceso/);
  assert.match(DM.endTurn(H), /Turno di Giocatore 2/);
  assert.ok(DM.saveSummary(text).round === 2);
});

test('salvataggio con un’eruzione in corso: la lava torna come era', () => {
  const { G } = realGame();
  if (!G.map.volc.length) return;
  G.round = 10;
  DM.erupt(G, 0);
  DM.rebuildMap(G.map, G.round);
  const H = DM.deserialize(DM.serialize(G));
  assert.ok(H.map.cells.every((v, i) => v === G.map.cells[i]));
});

test('testi sbagliati non rompono niente', () => {
  assert.throws(() => DM.deserialize('{"a":1}'), /non è un salvataggio/);
  assert.throws(() => DM.deserialize('ciao'));
  assert.equal(DM.saveSummary('ciao'), null);
});
