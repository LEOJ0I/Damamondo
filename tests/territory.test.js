// Territori, conquista, cessione, turni, eruzioni, Lavico.
const test = require('node:test'), assert = require('node:assert/strict');
const { DM, testGame } = require('./helpers');
const nextRound = G => { const r = G.round; let n = 0; while (G.round === r && n++ < 10) DM.endTurn(G); };

test('terre di nessuno: prese entro 2 cm (non acqua, Banchisa, Lavico), restano anche dopo', () => {
  const G = testGame();
  const u = DM.addUnit(G, 'S', 0, 28, 25);
  DM.claim(G, 0, 28, 25);
  assert.equal(DM.terrAt(G, 29.3, 25), 0);
  assert.equal(DM.terrAt(G, 30, 25), -1, 'il fiume non diventa territorio');
  assert.equal(DM.terrAt(G, 28, 26.8), 0);
  assert.equal(DM.terrAt(G, 28, 27.2), -1);
  u.x = 10;
  assert.equal(DM.terrAt(G, 28, 25), 0);
});

test('conquista: 3 giri nel territorio nemico, solo se entro 2 cm non ci sono truppe nemiche', () => {
  const G = testGame();
  const cap1 = DM.capitalOf(G, 1);
  const city = DM.addSite(G, 1, 'citta', 44, 22); city.inv.mon = 1000; city.inv.mat.bomba = 1;
  const u = DM.addUnit(G, 'S', 0, 44.5, 21.5);
  const guard = DM.addUnit(G, 'S', 1, 46, 21);
  nextRound(G); nextRound(G); nextRound(G); nextRound(G);
  assert.equal(DM.terrAt(G, 44.5, 21.5), 1, 'difeso: niente conquista');
  assert.ok(u.oc >= 3);
  G.units = G.units.filter(v => v !== guard);
  G.p = 0;
  const msg = DM.endTurn(G) + DM.endTurn(G);
  assert.match(msg, /ha conquistato territori e 3 edifici/);
  assert.equal(DM.terrAt(G, 44.5, 21.5), 0);
  assert.equal(city.o, 0);
  assert.equal(city.inv.mat.bomba, 1, 'si prende anche quello che c’è dentro');
  assert.equal(cap1.o, 0);
  assert.equal(cap1.k, 'citta', 'la Capitale presa diventa Città');
  assert.ok(G.players[1].out, 'senza Capitale né Città il giocatore 2 perde');
});

test('cessione di territorio: linea, lato, a un altro giocatore / a nessuno / a un nuovo giocatore', () => {
  const G = testGame({ np: 3 });
  // allargo il territorio del giocatore 1 con una striscia orizzontale
  for (let x = 5; x <= 27; x += 1) DM.claim(G, 0, x, 20);
  const acc = DM.addSite(G, 0, 'acc', 25, 20);
  const line = [[21, 17], [21, 23]];
  assert.match(DM.cedeCompute(G, line, 40, 40).err, /TUO territorio/);
  assert.match(DM.cedeCompute(G, [[21, 17], [21, 19.5]], 25, 20).err, /non divide/);
  const r = DM.cedeCompute(G, line, 25, 20);
  assert.ok(!r.err, r.err);
  assert.ok(r.cells.every(i => DM.cellCenter(i)[0] > 21));
  const r2 = DM.cedeApply(G, r.cells, 1, false);
  assert.match(r2.msg, /ceduto a Giocatore 2\. Edifici passati: 1/);
  assert.equal(acc.o, 1);
  assert.equal(DM.terrAt(G, 25, 20), 1);
  assert.equal(DM.terrAt(G, 19, 20), 0);
  // la zona con la Capitale non si cede, se non con "non cedere edifici"
  const r3 = DM.cedeCompute(G, [[17, 15], [17, 25]], 15, 20);
  assert.match(DM.cedeApply(G, r3.cells, -1, false).err, /Capitale/);
  // a nessuno, tenendo gli edifici
  const r4 = DM.cedeCompute(G, [[9, 15], [9, 25]], 7, 20);
  assert.match(DM.cedeApply(G, r4.cells, -1, true).msg, /senza proprietario/);
  assert.equal(DM.terrAt(G, 7, 20), -1);
});

test('cessione a un nuovo giocatore: Capitale nella zona, rispettando la distanza minima', () => {
  // zona tutta entro 10 cm dalla Capitale (15,20): con 3 giocatori servono 10 cm
  const G0 = testGame();
  for (let x = 5; x <= 22; x += 1) DM.claim(G0, 0, x, 20);
  const near = DM.cedeCompute(G0, [[20, 17], [20, 23]], 22, 20);
  assert.ok(near.cells.every(i => Math.hypot(DM.cellCenter(i)[0] - 15, DM.cellCenter(i)[1] - 20) < 10));
  assert.match(DM.cedeNewPlayer(G0, near.cells, 0, false).err, /almeno 10 cm/);
  assert.equal(G0.np, 2);
  const G = testGame();
  for (let x = 5; x <= 27; x += 1) DM.claim(G, 0, x, 20);
  const ok = DM.cedeCompute(G, [[19, 17], [19, 23]], 24, 20);
  const r = DM.cedeNewPlayer(G, ok.cells, 3, false);
  assert.match(r.msg, /Giocatore 3 \(kit Navigatori\) è entrato in gioco/);
  assert.equal(G.np, 3);
  const cap = DM.capitalOf(G, 2);
  assert.ok(Math.hypot(cap.x - 15, cap.y - 20) >= 10);
  assert.equal(cap.inv.mon, 20000);
  assert.equal(G.players[2].res.S, 15);
  assert.equal(DM.terrAt(G, 22, 20), 2);
  // il turno passa anche al nuovo giocatore
  DM.endTurn(G); DM.endTurn(G);
  assert.equal(G.p, 2);
});

test('cedere un singolo edificio', () => {
  const G = testGame();
  const acc = DM.addSite(G, 0, 'acc', 17, 21); acc.inv.mon = 7;
  assert.match(DM.cedeSite(G, DM.capitalOf(G, 0), 1), /non si può cedere/);
  assert.match(DM.cedeSite(G, acc, 1), /ceduto a Giocatore 2/);
  assert.equal(acc.o, 1);
  assert.equal(acc.inv.mon, 7);
});

test('turni e giri: il giro avanza quando tutti hanno giocato, si azzerano movimenti e spari, si salta chi ha perso', () => {
  const G = testGame({ np: 3 });
  G.moved = 1; G.shots = 1; G.berried = true;
  assert.match(DM.endTurn(G), /Turno di Giocatore 2/);
  assert.deepEqual([G.moved, G.shots, G.berried, G.round], [0, 0, false, 1]);
  DM.eliminate(G, 2);
  DM.endTurn(G);
  assert.equal(G.p, 0);
  assert.equal(G.round, 2);
});

test('Lavico: brucia 3 turni (Soldato 20, Carrarmato 500), non si somma, l’aria non brucia', () => {
  const G = testGame();
  const s = DM.addUnit(G, 'S', 0, 17, 36), t = DM.addUnit(G, 'T', 0, 18, 36), e = DM.addUnit(G, 'E', 0, 18, 37);
  nextRound(G);
  assert.equal(s.hp, 80); assert.equal(t.hp, 4500); assert.equal(e.hp, 2000);
  s.x = 15; s.y = 25;   // esce dal Lavico: continua a bruciare per i turni rimasti
  nextRound(G); nextRound(G);
  assert.equal(s.hp, 40);
  nextRound(G);
  assert.equal(s.hp, 40, 'dopo 3 turni smette');
});

test('eruzioni: ogni 10 giri dado, con 1 Lavico per 3 giri e distrugge truppe ed edifici (Ignifuga protegge)', () => {
  const volcBiome = (x, y) => (x < 2 || y < 2 || x > 58 || y > 40) ? 'S' : Math.hypot(x - 30, y - 30) < 1.1 ? 'V' : 'P';
  const G = testGame({ biome: volcBiome, volc: [[30, 30]] });
  const u = DM.addUnit(G, 'S', 1, 31.5, 30), far = DM.addUnit(G, 'S', 1, 33, 30);
  const a = DM.addSite(G, 1, 'acc', 30, 31.8), b = DM.addSite(G, 1, 'acc', 31.8, 30.3); b.ign = true;
  DM.rand = () => 0;   // dado 1
  G.round = 9; G.p = 1;
  const msg = DM.endTurn(G);
  DM.rand = Math.random;
  assert.equal(G.round, 10);
  assert.match(msg, /vulcano è eruttato/);
  assert.ok(!G.units.includes(u) && G.units.includes(far));
  assert.ok(!G.sites.includes(a) && G.sites.includes(b));
  assert.equal(DM.bAt(G, 31.5, 30), 'Z');
  nextRound(G); nextRound(G);
  assert.equal(DM.bAt(G, 31.5, 30), 'Z');
  nextRound(G);
  assert.equal(G.round, 13);
  assert.equal(DM.bAt(G, 31.5, 30), 'P', 'dopo 3 giri torna com’era');
});
