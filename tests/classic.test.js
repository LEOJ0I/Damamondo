// La modalità Classico: tabelle, kit, mappa con 5 biomi, soldi che si teletrasportano, guado, Superbomba, ponte liv. 2.
const test = require('node:test'), assert = require('node:assert/strict');
const DM = require('./load')();

const classic = (seed = 12, extra = {}) => {
  const G = DM.newGame(Object.assign({ mode: 'classico' }, extra), seed);
  DM.setPlayers(G, 2);
  // Capitali su Pianura, lontane
  const spots = [];
  for (let y = 4; y < 38 && spots.length < 2; y += .5) for (let x = 4; x < 56 && spots.length < 2; x += .5)
    if (!DM.capitalSpotError(G, x, y, 2) && (!spots.length || Math.hypot(spots[0][0] - x, spots[0][1] - y) > 16)) spots.push([x, y]);
  for (let i = 0; i < 2; i++) { DM.chooseKit(G, 0); DM.placeCapital(G, ...spots[i]); }
  return G;
};

test('Classico: tabelle e kit; tornando al normale tutto torna com’era', () => {
  const N = { S: DM.COST.S[0].m, hp: DM.TROOPS.T.hp, inc: DM.INCOME.citta, kits: DM.KITS.length };
  const G = classic();
  assert.equal(DM.mode, 'classico');
  assert.equal(G.phase, 'play');
  assert.deepEqual([DM.COST.S[0].m, DM.COST.N[0].m, DM.COST.E[0].m, DM.COST.T[0].m], [1000, 5000, 7000, 15000]);
  assert.deepEqual([DM.COST.citta[0].m, DM.COST.acc[0].m, DM.COST.porto[0].m, DM.COST.ponte1[0].m, DM.COST.bomba[0].m, DM.COST.superbomba[0].m], [5000, 5000, 5000, 1000, 25000, 100000]);
  assert.deepEqual(Object.keys(DM.POTIONS), ['poz_stipendio', 'poz_velocita', 'poz_curacitta']);
  assert.ok(!DM.COST.C && !DM.COST.min && !DM.COST.aer && !DM.COST.col, 'niente Carri, miniere, Aeroporti, Coltivazioni');
  const T = DM.TROOPS;
  assert.deepEqual([T.S.range, T.S.land.P, T.N.dmg, T.E.dmg, T.E.range, T.E.air, T.T.hp, T.T.range, T.T.land.P], [2, 2, 500, 160, 3, 3, 7000, 3, 1]);
  assert.deepEqual([DM.INCOME.cap, DM.INCOME.citta, DM.BOMB.bomba.dmg, DM.BOMB.superbomba.dmg], [20000, 10000, 2500, 10000]);
  // kit: 30.000 soldi, 2 Soldati, 10 Porti, 5 pezzi di ponte, niente Carro né Aeroporto gratis
  const q = G.players[0], cap = DM.capitalOf(G, 0);
  assert.equal(cap.inv.mon, 30000);
  assert.deepEqual([q.res.S, q.res.porto, q.res.ponte1, q.res.C, q.res.N], [2, 10, 5, 0, 0]);
  assert.ok(!G.sites.some(s => s.k === 'aer'));
  assert.match(DM.buildRoad(G, cap, cap), /non ci sono strade/);
  // si torna al normale
  DM.newGame({}, 3);
  assert.equal(DM.mode, 'normale');
  assert.deepEqual([DM.COST.S[0].m, DM.TROOPS.T.hp, DM.INCOME.citta, DM.KITS.length], [N.S, N.hp, N.inc, N.kits]);
  assert.ok(DM.COST.C && DM.POTIONS.poz_ignifuga);
});

test('Classico: la mappa ha solo Pianura, Mare, Fiumi, Montagna e Alta montagna, e niente vulcani', () => {
  for (const [seed, o] of [[12, {}], [5, { temp: 0, hum: 4, comp: 4 }], [8, { temp: 4 }]]) {
    const G = DM.newGame(Object.assign({ mode: 'classico' }, o), seed);
    const used = new Set(G.map.cells);
    assert.deepEqual([...used].map(c => DM.BIOMES[c]).filter(b => !'PSFMA'.includes(b)), [], 'seme ' + seed);
    assert.equal(G.map.volc.length, 0);
  }
  // le mappe segrete non escono nel Classico, la mappa originale sì
  assert.equal(DM.newGame({ mode: 'classico' }, 39).map.secret, undefined);
  assert.equal(DM.newGame({ mode: 'classico', orig: 1 }, 6).map.secret, 'originale');
});

test('Classico: i soldi si teletrasportano, ma la Capitale tiene sempre la maggioranza', () => {
  const G = classic();
  const cap = DM.capitalOf(G, 0);
  const city = DM.addSite(G, 0, 'citta', cap.x + 1.5, cap.y);
  // si compra in Città con i soldi della Capitale
  assert.equal(city.inv.mon, 0);
  assert.match(DM.buy(G, city, 'S'), /Soldato creato/);
  assert.equal(DM.moneyOf(G, 0), 29000);
  // spostare soldi: la Capitale deve restare sopra la metà
  assert.match(DM.moveMoney(G, city, 15000, true), /più della metà/);
  assert.match(DM.moveMoney(G, city, 14000, true), /Spostati 14.000/);
  assert.deepEqual([cap.inv.mon, city.inv.mon], [15000, 14000]);
  assert.match(DM.moveMoney(G, city, 4000, false), /alla Capitale/);
  // la rendita della Città la sbilancia: le città mandano alla Capitale il necessario
  city.inv.mon = 40000; DM.balanceMoney(G, 0);
  assert.ok(cap.inv.mon * 2 > DM.moneyOf(G, 0));
  // se la Città viene distrutta, i suoi soldi si perdono
  const before = DM.moneyOf(G, 0), inCity = city.inv.mon;
  DM.destroySite(G, city);
  assert.equal(DM.moneyOf(G, 0), before - inCity);
});

test('Classico: guado dei fiumi a metà velocità, Montagna :2, Alta montagna :4', () => {
  const G = classic();
  let F = null;
  for (let y = 3; y < 39 && !F; y += .1) for (let x = 3; x < 57 && !F; x += .1) if (DM.bAt(G, x, y) === 'F') F = [x, y];
  assert.ok(F, 'c’è un fiume');
  assert.equal(DM.baseSpeed(G, 'S', F[0], F[1]), 1);
  assert.equal(DM.baseSpeed(G, 'T', F[0], F[1]), .5);
  assert.equal(DM.terrainSpeed('S', 'M'), 1); assert.equal(DM.terrainSpeed('S', 'A'), .5);
  // nel gioco normale i fiumi non si attraversano a piedi
  const N = DM.newGame({}, 12);
  let F2 = null;
  for (let y = 3; y < 39 && !F2; y += .1) for (let x = 3; x < 57 && !F2; x += .1) if (DM.bAt(N, x, y) === 'F' && !DM.bridgeAt(N, x, y)) F2 = [x, y];
  assert.equal(DM.baseSpeed(N, 'S', F2[0], F2[1]), 0);
});

test('Classico: Superbomba (area per 5 giri, 100 danni a turno) e ponte liv. 2 come miglioramento', () => {
  const G = classic();
  const cap = DM.capitalOf(G, 0), q = G.players[0];
  // ponte liv. 2: 1.000 soldi e un pezzo di liv. 1 della riserva
  assert.match(DM.buy(G, cap, 'ponte2'), /liv\. 2/);
  assert.deepEqual([q.res.ponte1, q.res.ponte2, cap.inv.mon], [4, 1, 29000]);
  q.res.ponte1 = 0;
  assert.match(DM.buy(G, cap, 'ponte2'), /serve un pezzo di ponte liv\. 1/);
  // Superbomba
  cap.inv.mon = 200000;
  assert.match(DM.buy(G, cap, 'superbomba'), /Superbomba creata/);
  const enemy = DM.capitalOf(G, 1), u = DM.addUnit(G, 'T', 1, enemy.x + 3, enemy.y);
  G.round = 25; G.shots = 0;
  const r = DM.launchBomb(G, cap, 'superbomba', u.x, u.y);
  assert.match(r, /Area radioattiva per 5 giri \(100 danni a turno/, r);
  const v = DM.addUnit(G, 'S', 1, u.x + .1, u.y);
  DM.endTurn(G);   // tocca al giocatore 2: le sue truppe nell'area perdono 100
  assert.ok(!G.units.includes(v) || v.hp <= 0, 'il Soldato (100 di vita) muore');
  const t2 = DM.addUnit(G, 'T', 1, u.x, u.y + .1);
  DM.endTurn(G); DM.endTurn(G);
  assert.equal(t2.hp, 6900);
  assert.equal(G.rad[0].until, 30);
});
