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

test('dalla nave si scende solo dentro un proprio Porto, e dal Porto si cammina a terra lungo il molo', () => {
  const G = testGame();
  const port = DM.addSite(G, 0, 'porto', 1.3, 20);   // terra da x = 2: molo di 0,7 cm
  const n = DM.addUnit(G, 'N', 0, 1.3, 22.5), s = DM.addUnit(G, 'S', 0, 2.3, 22.5);
  assert.match(DM.board(G, n, s), /salito/);
  assert.match(DM.unboard(G, n, s), /solo dentro un tuo Porto/);
  DM.moveUnit(G, n, 1.3, 20);
  assert.ok(Math.hypot(n.x - port.x, n.y - port.y) < .05, 'la nave è nel Porto');
  assert.match(DM.unboard(G, n, s), /sceso/);
  assert.deepEqual([s.x, s.y], [port.x, port.y], 'dentro il Porto');
  G.moved = 0;
  assert.match(DM.moveUnit(G, s, 4, 20), /Mossa completata/);
  assert.ok(s.x > 2.2, 'il soldato è uscito dal Porto sulla terra: ' + s.x);
  // fuori dal molo il soldato non sta sull'acqua
  assert.equal(DM.canStand(G, 'S', 1.3, 22, 0), false);
  assert.equal(DM.canStand(G, 'S', 1.3, 20, 1), false, 'il Porto di un altro non vale');
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
  // in mare aperto, lontano dai Porti
  const n = DM.addUnit(G, 'N', 1, .5, 10), t = DM.addUnit(G, 'T', 1, .5, 10);
  t.carried = n.id;
  n.hp = 1;
  G.round = 21; G.shots = 0;
  const sh2 = DM.addUnit(G, 'T', 0, 2.2, 10);
  assert.match(DM.shoot(G, sh2, .5, 10), /Nave distrutto: l’autista finisce in acqua, 1 truppe a bordo perse/);
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
  assert.deepEqual([c.x, c.y], [port.x, port.y], 'il Carro scende nel Porto');
  assert.ok(DM.canStand(G, 'C', c.x, c.y, 0));
  assert.ok(cap);
});

test('le Navi partono da un Porto, oppure dal fiume entro 1 cm da una propria Città', () => {
  const G = testGame();
  G.players[0].res.N = 3;
  assert.match(DM.deploy(G, 'N', 1, 20), /nascono dentro un tuo Porto/);
  DM.addSite(G, 0, 'citta', 28.8, 15);
  assert.match(DM.deploy(G, 'N', 29.7, 15), /Nave schierato/);
  assert.match(DM.deploy(G, 'N', 30, 22), /Porto/, 'fiume senza città vicina');
  const city = DM.siteNear(G, 28.8, 15)[0];
  city.inv.mon = 1e5; city.inv.mat = { petrolio: 500, rame: 3, piombo: 2 };
  assert.match(DM.buy(G, city, 'N'), /Nave creato/);
  assert.equal(DM.bAt(G, G.units.at(-1).x, G.units.at(-1).y), 'F');
  const cap = DM.capitalOf(G, 0);
  cap.inv.mat = { petrolio: 500, rame: 3, piombo: 2 };
  assert.match(DM.buy(G, cap, 'N'), /nascono nei Porti/);
  // una volta partita, la nave naviga anche in mare aperto
  const sea = DM.addUnit(G, 'N', 0, 1, 20);
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
