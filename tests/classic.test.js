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
  assert.deepEqual(Object.keys(DM.POTIONS), ['poz_stipendio', 'poz_velocita', 'poz_curacitta', 'poz_congela']);
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

test('Classico: le carte dei giri (pioggia, meteoriti) e quelle dei biomi', () => {
  const G = classic();
  const cap = DM.capitalOf(G, 0);
  // al 5° giro la grande pioggia: gittata dimezzata per 3 giri
  const s = DM.addUnit(G, 'S', 0, cap.x + 1, cap.y);
  assert.equal(DM.stat(G, s)[1], 2);
  while (G.round < 5) DM.endTurn(G);
  assert.equal(G.events.length, 1);
  assert.equal(DM.stat(G, s)[1], 1);
  assert.equal(G.cardsShown.at(-1).deck, 'giri5');
  while (G.round < 8) DM.endTurn(G);
  assert.equal(DM.stat(G, s)[1], 2, 'dopo 3 giri finisce');
  // al 10° giro: pioggia e meteoriti insieme; Elicotteri, Navi, Carrarmati a metà prezzo
  while (G.round < 10) DM.endTurn(G);
  assert.deepEqual(G.cardsShown.slice(-2).map(c => c.deck), ['giri5', 'giri10']);
  assert.equal(DM.costOf(G, 'T')[0].m, 7500);
  assert.equal(DM.costOf(G, 'S')[0].m, 1000, 'i Soldati no');
  G.p = 0; cap.inv.mon = 100000; const before = DM.moneyOf(G, 0);
  assert.match(DM.buy(G, cap, 'E'), /creato/);
  assert.equal(before - DM.moneyOf(G, 0), 3500);
  // carte dei biomi: un esercito di 10 Soldati che entra in Alta montagna (valanga 90%, almeno 6) — con il dado truccato
  DM.rand = () => .3;   // seconda carta del mazzo "A": la valanga
  const r = DM.drawCard(G, 'A', Array.from({ length: 10 }, (_, i) => DM.addUnit(G, 'S', 0, 30, 20 + i * .01)));
  assert.match(r.result, /9 Soldati muoiono/);
  assert.match(DM.drawCard(G, 'A', [DM.addUnit(G, 'S', 0, 31, 21)]).result, /1 Soldato muore/, 'se sono meno del minimo muoiono tutti');
  // la multa: 1.000 a ogni altro giocatore
  DM.rand = () => 0;
  const m0 = DM.moneyOf(G, 0), m1 = DM.moneyOf(G, 1);
  assert.match(DM.drawCard(G, 'M', [s]).result, /Pagati 1\.?000/);
  assert.deepEqual([m0 - DM.moneyOf(G, 0), DM.moneyOf(G, 1) - m1], [1000, 1000]);
  // flotta di 1 Nave: nessuna affonda; flotta di 3: ne affonda 1, con i Soldati a bordo
  DM.rand = () => .5;
  const n1 = DM.addUnit(G, 'N', 0, 2, 2);
  assert.match(DM.drawCard(G, 'F', [n1]).result, /meno di 2 Navi/);
  const fl = [0, 1, 2].map(i => DM.addUnit(G, 'N', 0, 2 + i * .1, 3));
  fl.forEach(v => { DM.addUnit(G, 'S', 0, v.x, v.y).carried = v.id; });
  const res = DM.drawCard(G, 'F', fl).result;
  assert.match(res, /1 Nave affonda, annegano 1 truppe/);
  DM.rand = Math.random;
});

test('Classico: entrando in Montagna si pesca una carta e la mossa non si annulla più', () => {
  const G = classic();
  // un Soldato in Pianura accanto a una Montagna
  let P = null;
  for (let y = 3; y < 39 && !P; y += .1) for (let x = 3; x < 57 && !P; x += .1) if (DM.bAt(G, x, y) === 'P' && DM.bAt(G, x + .4, y) === 'M') P = [x, y];
  assert.ok(P);
  const u = DM.addUnit(G, 'S', 0, P[0], P[1]);
  DM.rand = () => 0;   // la prima carta: la multa
  const msg = DM.moveUnit(G, u, P[0] + 1, P[1]);
  DM.rand = Math.random;
  assert.match(msg, /🃏 Pagati/);
  assert.equal(G.cardsShown.at(-1).deck, 'M');
  assert.match(DM.undoMove(G, u), /pescato una carta/);
  // nel gioco normale niente carte
  const N = DM.newGame({}, 12);
  assert.equal(DM.roundCards(N), '');
});

test('Classico: congelamento (2 cm, 2 giri, tue e avversarie: niente mosse né spari, si possono colpire)', () => {
  const G = classic();
  const cap = DM.capitalOf(G, 0); cap.inv.mon = 50000;
  assert.match(DM.buy(G, cap, 'poz_congela'), /creata/);
  const a = DM.addUnit(G, 'S', 0, 30, 20), b = DM.addUnit(G, 'S', 1, 31.5, 20), far = DM.addUnit(G, 'S', 1, 33, 20);
  const r = DM.potionOnUnit(G, cap, 'poz_congela', 30.5, 20, true);
  assert.match(r.msg, /Congelate 2 truppe fino al giro 2/);
  assert.equal(cap.inv.mat.poz_congela, 0);
  assert.ok(DM.frozen(G, a) && DM.frozen(G, b) && !DM.frozen(G, far));
  G.round = 5; G.moved = 0; a.fz = 7;
  assert.match(DM.moveUnit(G, a, 30, 21), /Congelata/);
  assert.match(DM.shootError(G, a), /Congelata/);
  G.round = 7;
  assert.ok(!DM.frozen(G, a), 'dopo 2 giri si scongela');
});

test('Classico: mine nascoste, l’esercito nemico si ferma e prende 1.000 a truppa; migliorate colpiscono gli Elicotteri', () => {
  const G = classic();
  const cap = DM.capitalOf(G, 0); cap.inv.mon = 50000;
  DM.buy(G, cap, 'mina'); DM.buy(G, cap, 'mina');
  assert.match(DM.buy(G, cap, 'minaA'), /migliorata/);
  assert.deepEqual([G.players[0].res.mina, G.players[0].res.minaA], [1, 1]);
  // una pianura libera per la prova
  let P = null;
  for (let y = 4; y < 38 && !P; y += .5) for (let x = 4; x < 56 && !P; x += .5) if ([0, 1, 2, 3, 4].every(i => DM.bAt(G, x + i, y) === 'P')) P = [x, y];
  DM.addUnit(G, 'S', 0, P[0] + .8, P[1] + .8);
  assert.match(DM.placeMine(G, 'mina', P[0] + 5, P[1]), /entro 1 cm/);
  assert.match(DM.placeMine(G, 'mina', P[0] + .8, P[1]), /Mina posata/);
  // tocca al giocatore 2: un esercito di 2 Carrarmati e 1 Elicottero ci passa sopra
  DM.endTurn(G); G.moved = 0;
  const t1 = DM.addUnit(G, 'T', 1, P[0], P[1]), t2 = DM.addUnit(G, 'T', 1, P[0], P[1] + .1);
  t1.g = t2.g = 99;
  const msg = DM.moveUnit(G, t1, P[0] + 4, P[1] + .05);   // il Carrarmato fa 1 cm: passa vicino alla mina
  assert.match(msg, /mina nemica.*1.?000 danni a 2 truppe/);
  assert.ok(t1.x < P[0] + .5, 'si ferma alla mina: ' + t1.x);
  assert.deepEqual([t1.hp, t2.hp], [6000, 6000]);
  assert.equal(G.mines.length, 0);
  // un Elicottero passa sopra una mina normale, ma non sopra una migliorata
  DM.endTurn(G); G.moved = 0;
  DM.addUnit(G, 'S', 0, P[0] + 2, P[1] - 1);
  DM.placeMine(G, 'minaA', P[0] + 2, P[1] - 1.5);
  DM.endTurn(G); G.moved = 0;
  const e = DM.addUnit(G, 'E', 1, P[0], P[1] - 1.5);
  assert.match(DM.moveUnit(G, e, P[0] + 3, P[1] - 1.5), /mina nemica/);
  assert.equal(e.hp, 1000);
});

test('Classico: sottomarino nascosto (si vede quando spara e dalle Navi entro 2 cm), niente flotte, porta 20 punti', () => {
  const G = classic();
  const u = DM.addUnit(G, 'U', 0, 2, 2);
  assert.equal(DM.hiddenFrom(G, u, 1), true);
  assert.equal(DM.hiddenFrom(G, u, 0), false);
  // una Nave nemica vicina lo vede
  const n = DM.addUnit(G, 'N', 1, 3.5, 2);
  assert.equal(DM.hiddenFrom(G, u, 1), false);
  n.x = 10;
  assert.equal(DM.hiddenFrom(G, u, 1), true);
  // non è un bersaglio finché è nascosto
  G.p = 1;
  assert.equal(DM.shootTargets(G, 2, 2).length, 0);
  // quando spara si scopre fino al suo turno dopo
  G.p = 0; u.rv = true;
  assert.equal(DM.hiddenFrom(G, u, 1), false);
  assert.equal(DM.compatible('U', 'N'), false);
  assert.equal(DM.TROOP_CAP.U, 20);
  assert.equal(DM.TROOPS.U.hp, 1500);
});

test('Classico: muri (bloccano le truppe di terra nemiche, si spara oltre, migliorati congelano quando crollano o col pulsante)', () => {
  const G = classic();
  const cap = DM.capitalOf(G, 0); cap.inv.mon = 100000;
  for (let i = 0; i < 3; i++) DM.buy(G, cap, 'muro');
  DM.buy(G, cap, 'muroUp');
  assert.deepEqual([G.players[0].res.muro, G.players[0].res.muroUp], [3, 5]);
  // un muro verticale di 2 cm in una pianura del territorio
  let P = null;
  for (let y = 4; y < 38 && !P; y += .5) for (let xx = 4; xx < 56 && !P; xx += .5) if ([1, 1.5, 2, 2.5, 3, 3.5].every(i => [-1, -.5, 0, .5, 1].every(j => DM.bAt(G, xx + i, y + j) === 'P'))) P = [xx, y];
  DM.claim(G, 0, P[0] + 2, P[1]);
  const x = P[0] + 2, y1 = P[1] - 1, y2 = P[1] + 1, cy = P[1];
  DM.addUnit(G, 'S', 0, x + .5, cy);
  const r = DM.buildWall(G, x, y1, x, y2);
  assert.match(r, /2 pezzi/, r);
  assert.equal(G.walls.length, 2);
  // un Soldato nemico non lo attraversa, un Elicottero sì
  DM.endTurn(G); G.moved = 0; G.round = 30;
  const s = DM.addUnit(G, 'S', 1, x - .5, cy - .5);
  DM.moveUnit(G, s, x + 1.5, cy - .5);
  assert.ok(s.x < x, 'il muro lo ferma: ' + s.x);
  const e = DM.addUnit(G, 'E', 1, x - .5, cy + .5);
  DM.moveUnit(G, e, x + 1.5, cy + .5);
  assert.ok(e.x > x, 'l’Elicottero passa sopra');
  // si spara oltre il muro, e il muro si può colpire
  assert.ok(DM.shootTargets(G, x, y1 + .5).some(t => t.type === 'wall'));
  // muro migliorato: il pulsante lo fa crollare e congela tutto entro 2 cm
  DM.endTurn(G); G.p = 0;
  const w = G.walls[0];
  assert.match(DM.upgradeWall(G, w), /migliorato/);
  assert.equal(w.hp, 2500);
  const m = DM.triggerWall(G, w);
  assert.match(m, /congelamento.*Congelate/);
  assert.equal(G.walls.length, 1);
  assert.ok(DM.frozen(G, s));
});
