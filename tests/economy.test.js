// Banco, acquisti, edifici, carichi, miniere, rendita, bacche nelle coltivazioni.
const test = require('node:test'), assert = require('node:assert/strict');
const { DM, testGame } = require('./helpers');

test('Banco: multipli del lotto, un solo materiale per turno, soldi nell’edificio', () => {
  const G = testGame({ kits: [1, 0] });   // Minatori: 1 punto di ogni materiale
  const cap = DM.capitalOf(G, 0);
  assert.match(DM.sell(G, cap, 'ferro', 3), /servono 1500/);
  assert.match(DM.sell(G, cap, 'ferro', 2), /Venduti 1000 kg di ferro per 6000 soldi/);
  assert.equal(cap.inv.mon, 5000 + 6000);
  assert.equal(cap.inv.mat.ferro, 0);
  assert.match(DM.sell(G, cap, 'oro', 1), /un solo tipo/);
  DM.endTurn(G); DM.endTurn(G);
  assert.match(DM.sell(G, cap, 'oro', 1), /35\.000/);
});

test('acquisti: truppe nell’edificio giusto, Nave Carro regala un Carro, bombe e pozioni nell’edificio, edifici in riserva', () => {
  const G = testGame();
  const cap = DM.capitalOf(G, 0);
  assert.match(DM.buy(G, cap, 'S'), /Serve: 5000 soldi, 1 t rame, 1 t piombo/);
  cap.inv.mat = { rame: 10, piombo: 30, titanio: 5000, uranio: 100, oro: 100, petrolio: 10000, ferro: 10000, argento: 2000, platino: 1000 };
  assert.match(DM.buy(G, cap, 'S'), /Soldato creato/);
  assert.equal(cap.inv.mon, 245000);
  assert.match(DM.buy(G, cap, 'N'), /Qui non si può creare Nave/);
  assert.match(DM.buy(G, cap, 'acc'), /riserva/);
  assert.equal(G.players[0].res.acc, 6);
  cap.inv.mon = 150000;
  assert.match(DM.buy(G, cap, 'bomba'), /Non hai abbastanza/);
  cap.inv.mon = 2e6;
  assert.match(DM.buy(G, cap, 'bomba'), /Bomba creata/);
  assert.equal(cap.inv.mat.bomba, 1);
  assert.match(DM.buy(G, cap, 'poz_stipendio'), /creata/);
  // porto in mare: Nave Carro con il Carro in regalo già a bordo
  DM.addUnit(G, 'S', 0, 3, 20); DM.claim(G, 0, 3, 20);
  DM.buildSite(G, 'porto', 1.7, 20);
  const port = G.sites.at(-1);
  port.inv.mon = 1e6; port.inv.mat.titanio = 1000;
  assert.match(DM.buy(G, port, 'X'), /In regalo un Carro, già a bordo/);
  const nc = G.units.find(u => u.t === 'X'), gift = G.units.find(u => u.carried === nc.id);
  assert.equal(gift.t, 'C');
  // Aereo Carro nella Capitale (c'è l'Aeroporto gratis): Carro in regalo sul posto
  const aer = G.sites.find(s => s.k === 'aer' && s.o === 0);
  aer.inv.mon = 1e6; aer.inv.mat.titanio = 2500;
  assert.match(DM.buy(G, aer, 'A'), /In regalo un Carro/);
});

test('Accampamento → Città pagando la differenza; costruzione di edifici dalla riserva', () => {
  const G = testGame();
  const cap = DM.capitalOf(G, 0);
  DM.addUnit(G, 'S', 0, 16, 21);
  assert.match(DM.buildSite(G, 'acc', 30, 20), /Serve una tua truppa/);
  assert.match(DM.buildSite(G, 'acc', 16.5, 21), /costruito/);
  const acc = G.sites.at(-1);
  assert.match(DM.upgradeCamp(G, acc), /Servono/);
  acc.inv.mon = 45000; acc.inv.mat = { argento: 500, ferro: 200 };
  assert.match(DM.upgradeCamp(G, acc), /ora è una Città/);
  assert.deepEqual([acc.k, acc.hp, acc.inv.mon], ['citta', 10000, 0]);
  G.players[0].res.citta = 1; G.players[0].res.col = 2; G.players[0].res.porto = 1;
  DM.addUnit(G, 'S', 0, 4, 4); DM.claim(G, 0, 4, 4);
  DM.addUnit(G, 'S', 0, 10, 4); DM.claim(G, 0, 10, 4);
  assert.match(DM.buildSite(G, 'citta', 10, 4), /Niente città in Giungla/);
  assert.match(DM.buildSite(G, 'col', 15.5, 21), /solo in Deserto/);
  assert.match(DM.buildSite(G, 'col', 4, 4), /costruito/);
  G.players[0].res.acc = 0;
  assert.match(DM.buildSite(G, 'acc', 12, 22), /Non hai/);
  assert.match(DM.buildSite(G, 'citta', 18, 20), /dentro il tuo territorio|truppa/);
  assert.match(DM.buildInside(G, cap, 'aer'), /Non hai|già/);
  G.players[0].res.aer = 1;
  assert.match(DM.buildInside(G, cap, 'aer'), /già/);
  assert.match(DM.buildInside(G, cap, 'porto'), /0,2 cm dall’acqua/);
});

test('carichi: soldi a multipli di 1000, materiali a peso 1, capacità in punti, entro 1 cm', () => {
  const G = testGame();
  const cap = DM.capitalOf(G, 0);
  cap.inv.mat.ferro = 50000; cap.inv.mat.oro = 3;
  const c = DM.addUnit(G, 'C', 0, 15.5, 20);
  assert.match(DM.loadCargo(G, c, cap, 'mon', 1500), /Caricati 1000 soldi/);
  assert.match(DM.loadCargo(G, c, cap, 'mon', 0), /Caricati 249\.000 soldi/);   // 249.000 / 30.000 = 8,3 punti
  assert.equal(cap.inv.mon, 0);
  assert.match(DM.loadCargo(G, c, cap, 'oro', 3), /Caricati 3 kg/);
  assert.match(DM.loadCargo(G, c, cap, 'ferro', 0), /Caricati 11\.636 kg/);      // spazio rimasto 20 − 8,333 − 0,03 = 11,636 punti
  assert.ok(Math.abs(DM.cargoPts(c.cg) - 20) < .001);
  assert.match(DM.loadCargo(G, c, cap, 'ferro', 0), /Non c’è spazio/);
  c.x = 17;
  assert.match(DM.unloadCargo(G, c, cap), /entro 1 cm/);
  const city = DM.addSite(G, 0, 'citta', 17, 20);
  assert.match(DM.unloadCargo(G, c, city, 'mon', 2500), /Scaricato/);
  assert.equal(city.inv.mon, 2000);
  assert.match(DM.unloadCargo(G, c, city), /Scaricato/);
  assert.equal(city.inv.mon, 250000);
  assert.equal(city.inv.mat.ferro, 11636);
  assert.equal(DM.cargoPts(c.cg), 0);
  const ac = DM.addUnit(G, 'A', 0, 17, 20);
  assert.match(DM.loadCargo(G, ac, city, 'mon', 0), /solo in un Aeroporto/);
});

test('miniere: territorio, truppa entro 2 cm, 2 cm dalle altre, biomi validi, dado (Maghi lo scelgono)', () => {
  const G = testGame({ kits: [4, 1] });
  DM.rand = () => .99;   // dado 6
  assert.match(DM.buildMine(G, 18, 20).err, /dentro il tuo territorio|truppa/);
  DM.addUnit(G, 'S', 0, 16, 20);
  const r = DM.buildMine(G, 16.5, 20, 3);
  assert.deepEqual([r.die, r.mat, r.qty], [3, 'rame', 5]);   // Pianura, dado scelto 3
  assert.equal(G.players[0].dice, 1);
  assert.match(DM.buildMine(G, 15.5, 21).err, /minimo 2 cm/);
  DM.addUnit(G, 'S', 0, 14, 21);
  const r2 = DM.buildMine(G, 14, 21.6, 1);
  assert.equal(r2.die, 1);
  assert.equal(G.players[0].dice, 0);
  G.players[0].res.min = 1;
  assert.match(DM.buildMine(G, 15.5, 19).err, /minimo 2 cm/);
  // dado casuale per gli altri kit / dopo le scelte
  DM.endTurn(G);
  DM.addUnit(G, 'S', 1, 46, 20);
  const r3 = DM.buildMine(G, 46.5, 21, 1);
  assert.equal(r3.die, 6, 'i Minatori non scelgono il dado');
  assert.equal(r3.mat, 'piombo');
  DM.rand = Math.random;
  // bioma non valido
  const G2 = testGame();
  G2.players[0].res.min = 1;
  DM.addUnit(G2, 'S', 0, 29, 25); DM.claim(G2, 0, 29, 25);
  assert.match(DM.buildMine(G2, 30, 25).err, /non si può scavare/);
});

test('produzione: miniere ogni 5 giri (se nel territorio), rendita ogni 10 dalla costruzione, Città < 5.000 niente rendita, bacche ogni 5', () => {
  const G = testGame();
  const cap = DM.capitalOf(G, 0);
  DM.addUnit(G, 'S', 0, 16, 20);
  G.players[0].res.min = 1;
  DM.rand = () => 0;
  const mine = DM.buildMine(G, 16.5, 20).site;   // carbone 5 t
  DM.rand = Math.random;
  const roundTo = r => { while (G.round < r) { DM.endTurn(G); DM.endTurn(G); } };
  roundTo(6);
  assert.equal(mine.inv.mat.carbone, 10, 'giro 6: 5 giri dalla costruzione');
  roundTo(8);
  const city = DM.addSite(G, 0, 'citta', 14, 22); city.inv.mon = 5000;
  const poor = DM.addSite(G, 0, 'citta', 14, 18);
  const col = DM.addSite(G, 0, 'col', 4, 4); DM.claim(G, 0, 4, 4);
  roundTo(10);
  assert.equal(mine.inv.mat.carbone, 10);
  roundTo(11);
  assert.equal(cap.inv.mon, 290000, 'capitale paga al giro 11 (costruita al giro 1)');
  assert.equal(mine.inv.mat.carbone, 15);
  roundTo(13);
  assert.equal(col.inv.mat.bacca_deserto, 1);
  roundTo(18);
  assert.equal(city.inv.mon, 25000, 'città costruita all’8° paga al 18°');
  assert.equal(poor.inv.mon, 0, 'città senza 5.000 soldi = accampamento');
  // miniera fuori dal territorio: niente produzione
  G.terr[DM.terrIdx(mine.x, mine.y)] = 1;
  roundTo(21);
  assert.equal(mine.inv.mat.carbone, 20);
});
