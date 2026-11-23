// Trasporto (6), autista dei veicoli distrutti, Porto per il mare aperto (8.1), Aereo Carro e Aeroporti (4.3).
const test = require('node:test'), assert = require('node:assert/strict');
const { DM, testGame } = require('./helpers');

test('salire e scendere: capacità in punti truppa, entro 1 cm, non da un esercito, Nave Carro e Aereo Carro non si trasportano', () => {
  const G = testGame();
  const c = DM.addUnit(G, 'C', 0, 20, 20);   // Carro: 4 punti
  const s = [0, 1, 2, 3, 4].map(() => DM.addUnit(G, 'S', 0, 20.5, 20));
  for (let i = 0; i < 4; i++) assert.match(DM.board(G, c, s[i]), /salito/);
  assert.match(DM.board(G, c, s[4]), /Non c’è posto.*liberi 0 su 4/);
  const far = DM.addUnit(G, 'S', 0, 22, 20);
  assert.match(DM.boardError(G, c, far), /entro 1 cm/);
  const t = DM.addUnit(G, 'T', 0, 20, 20);   // Carrarmato: 3 punti, vale 20
  assert.match(DM.board(G, t, s[4]), /salito/);
  assert.match(DM.boardError(G, c, t), /Non c’è posto/);
  const soldier = DM.addUnit(G, 'S', 0, 20, 20);
  assert.match(DM.boardError(G, soldier, s[4]), /non trasporta/);
  const x = DM.addUnit(G, 'X', 0, 20, 20), n = DM.addUnit(G, 'N', 0, 20, 20);
  assert.match(DM.boardError(G, n, x), /non si può trasportare/);
  assert.match(DM.boardError(G, x, n), /non si può trasportare|Non c’è posto/);   // la Nave vale 1000 punti: non entra in niente
  const a = DM.addUnit(G, 'S', 0, 19, 20), b = DM.addUnit(G, 'S', 0, 19, 20);
  DM.formArmy(G, [a, b]);
  assert.match(DM.boardError(G, c, a), /esercito/);
  // chi è a bordo non si muove, non spara, non si tocca, e viaggia con il veicolo
  assert.match(DM.moveUnit(G, s[0], 20, 22), /a bordo/);
  assert.match(DM.shootError(G, s[0]), /a bordo/);
  assert.equal(DM.unitNear(G, 20.5, 20, u => u.t === 'S' && u.carried), undefined);
  DM.moveUnit(G, c, 20, 23);
  assert.ok(Math.abs(s[0].y - c.y) < 1e-9 && c.y > 22.9, 'i passeggeri seguono il Carro');
  // scendere
  assert.match(DM.unboard(G, c, s[0]), /sceso/);
  assert.equal(s[0].carried, 0);
  assert.equal(DM.aboardPts(G, c), 3);
});

test('dalla nave si scende sulla terra più vicina entro 1 cm, non in mezzo al mare', () => {
  const G = testGame();
  DM.addSite(G, 0, 'porto', 1.5, 20);
  const n = DM.addUnit(G, 'N', 0, 1.6, 20), s = DM.addUnit(G, 'S', 0, 2.3, 20);
  assert.match(DM.board(G, n, s), /salito/);
  assert.match(DM.unboard(G, n, s), /sceso/);
  assert.ok(s.x >= 2 && Math.hypot(s.x - n.x, s.y - n.y) <= 1.001, 'a terra vicino: ' + s.x);
  DM.board(G, n, s);
  n.x = 1; n.y = 10;   // lontano dalla costa? x=1 → terra a x=2 entro 1 cm
  DM.syncCarried(G);
  n.x = .5; n.y = .5; DM.syncCarried(G);
  assert.match(DM.unboard(G, n, s), /non può scendere/);
});

test('veicolo distrutto: scende chi era a bordo e in più l’autista; in mare si perdono', () => {
  const G = testGame();
  const c = DM.addUnit(G, 'C', 1, 25, 20), p1 = DM.addUnit(G, 'S', 1, 25, 20);
  G.p = 1; DM.board(G, c, p1); G.p = 0;
  c.hp = 10;
  const sh = DM.addUnit(G, 'S', 0, 25.5, 20);
  const msg = DM.shoot(G, sh, 25, 20);
  assert.match(msg, /Carro distrutto: l’autista si salva, scendono 1 truppe/);
  const mine = G.units.filter(u => u.o === 1 && u.t === 'S');
  assert.equal(mine.length, 2);
  assert.ok(mine.every(u => !u.carried));
  // in mare
  DM.addSite(G, 1, 'porto', 1, 30);
  const n = DM.addUnit(G, 'N', 1, 1, 30), t = DM.addUnit(G, 'T', 1, 1, 30.1);
  t.x = 1; G.p = 1; t.carried = n.id; G.p = 0;
  n.x = .5; n.y = 30; DM.syncCarried(G);
  n.hp = 1;
  G.round = 21; G.shots = 0;
  const sh2 = DM.addUnit(G, 'T', 0, 2.2, 30);
  assert.match(DM.shoot(G, sh2, .5, 30), /Nave distrutto: l’autista finisce in acqua, 1 truppe a bordo perse/);
  assert.ok(!G.units.includes(t));
});

test('Nave Carro comprata: il Carro in regalo parte a bordo con il carico, e scende a terra', () => {
  const G = testGame();
  const cap = DM.capitalOf(G, 0);
  DM.addUnit(G, 'S', 0, 3, 20); DM.claim(G, 0, 3, 20);
  G.players[0].res.porto = 1;
  DM.buildSite(G, 'porto', 1.7, 20);
  const port = G.sites.at(-1);
  port.inv.mon = 1e6; port.inv.mat.titanio = 1000;
  DM.buy(G, port, 'X');
  const x = G.units.find(u => u.t === 'X'), c = DM.aboard(G, x)[0];
  assert.equal(c.t, 'C');
  assert.match(DM.unboard(G, x, c), /sceso/);
  assert.ok(DM.canStand(G, 'C', c.x, c.y));
  assert.ok(cap);
});

test('Porto necessario per il mare aperto; sui fiumi basta una Città entro 1 cm', () => {
  const G = testGame();
  G.players[0].res.N = 2;
  // fiume a x 29,5–30,5: città a 1 cm → la nave si mette in acqua senza Porto
  DM.addSite(G, 0, 'citta', 28.8, 15);
  assert.match(DM.deploy(G, 'N', 29.7, 15), /Nave schierato/);
  assert.match(DM.deploy(G, 'N', 30, 22), /Porto/);
  const n = G.units.at(-1);
  assert.equal(DM.speedAt(G, n, 30, 14), 4, 'sul fiume va');
  const sea = DM.addUnit(G, 'N', 0, 1, 20);
  assert.match(DM.moveUnit(G, sea, 1, 22), /serve almeno un Porto/);
  DM.addSite(G, 0, 'porto', 1, 30);
  assert.match(DM.moveUnit(G, sea, 1, 22), /Mossa completata/);
});

test('Aereo Carro: parte e atterra solo negli Aeroporti, al massimo 12 cm', () => {
  const G = testGame();
  const cap = DM.capitalOf(G, 0);
  const a = DM.addUnit(G, 'A', 0, cap.x, cap.y);
  assert.match(DM.moveUnit(G, a, 20, 20), /atterra solo in un tuo Aeroporto/);
  DM.addSite(G, 0, 'aer', 25, 20);
  assert.match(DM.moveUnit(G, a, 25, 20), /Mossa completata/);
  assert.equal(a.x, 25);
  G.moved = 0; a.m = false;
  DM.addSite(G, 0, 'aer', 45, 25);
  assert.match(DM.moveUnit(G, a, 45, 25), /troppo lontano/);
  G.moved = 0; a.m = false;
  a.x = 26;
  assert.match(DM.moveUnit(G, a, 25, 20), /parte solo da un tuo Aeroporto/);
  // carica e scarica truppe solo in Aeroporto
  a.x = 25;
  const s = DM.addUnit(G, 'S', 0, 25.3, 20);
  assert.match(DM.board(G, a, s), /salito/);
  a.x = 27; DM.syncCarried(G);
  assert.match(DM.unboard(G, a, s), /solo in un Aeroporto/);
});
