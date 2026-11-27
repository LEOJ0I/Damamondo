// Truppe: schieramento, velocità per bioma, movimento, ponti, strade, eserciti, annulla.
const test = require('node:test'), assert = require('node:assert/strict');
const { DM, testGame } = require('./helpers');
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, a + ' ≠ ' + b);
const moveDist = (G, u, tx, ty) => { const x0 = u.x, y0 = u.y; const m = DM.moveUnit(G, u, tx, ty); return [Math.hypot(u.x - x0, u.y - y0), m]; };

test('schierare: 2 cm dalla Capitale, solo 1 cm da Città e Accampamenti', () => {
  const G = testGame();
  // un Accampamento lontano dalla Capitale (in 15, 20)
  const acc = DM.addSite(G, 0, 'acc', 25, 20); DM.claim(G, 0, 25, 20);
  assert.match(DM.deploy(G, 'S', 26.5, 20), /Troppo lontano: massimo 2 cm dalla Capitale, 1 cm da Città e Accampamenti/);
  assert.match(DM.deploy(G, 'S', 25.9, 20), /schierato/);
  acc.k = 'citta';
  assert.match(DM.deploy(G, 'S', 25, 21.5), /Troppo lontano/);
  assert.match(DM.deploy(G, 'S', 25, 20.9), /schierato/);
  assert.match(DM.deploy(G, 'S', 16.8, 20), /schierato/, 'dalla Capitale si arriva ancora a 2 cm');
});

test('schierare: entro 2 cm dalla Capitale, navi solo nel Porto, Aereo Carro solo in Aeroporto', () => {
  const G = testGame();
  assert.match(DM.deploy(G, 'S', 15, 23), /Troppo lontano/);
  assert.match(DM.deploy(G, 'S', 16.5, 20), /schierato/);
  assert.equal(G.players[0].res.S, 4);
  assert.match(DM.deploy(G, 'N', 15, 20), /Porto/);
  assert.match(DM.deploy(G, 'T', 15, 20), /Non hai/);
  // Navi: costruisco un porto in mare (sul bordo a x<2), serve terra mia entro 1 cm e una truppa entro 2 cm
  G.players[0].res.acc = 1;
  DM.addUnit(G, 'S', 0, 3, 20); DM.claim(G, 0, 3, 20);
  assert.match(DM.buildSite(G, 'porto', 1.7, 20), /Porto costruito/);
  assert.match(DM.deploy(G, 'N', 1.8, 20.1), /Nave schierato/);
  assert.equal(G.units.at(-1).x, 1.7);
  G.players[0].res.A = 1;
  assert.match(DM.deploy(G, 'A', 15.1, 20), /Aereo Carro schierato/);
  assert.ok(DM.terrAt(G, 3, 20) === 0);
});

test('velocità per bioma (12.2), Montagna e Tundra :2, Lavico e Banchisa :2', () => {
  const G = testGame();
  const cases = [['S', 'P', 1], ['S', 'D', .3], ['S', 'G', .3], ['S', 'L', .3], ['S', 'T', .5], ['S', 'M', .5], ['S', 'A', .4], ['S', 'Z', .5], ['S', 'I', .5], ['S', 'H', 1],
    ['T', 'D', .2], ['T', 'A', .2], ['T', 'T', .5], ['C', 'P', 4], ['C', 'L', .8], ['C', 'A', 1.3], ['C', 'Z', 2], ['E', 'A', 4], ['A', 'D', 12],
    ['N', 'S', 3], ['N', 'F', 4], ['N', 'I', 1.5], ['X', 'S', 8], ['X', 'F', 0], ['X', 'I', 6], ['N', 'P', 0], ['S', 'S', 0], ['S', 'F', 0]];
  cases.forEach(([t, b, v]) => assert.equal(DM.terrainSpeed(t, b), v, t + ' su ' + b));
  // movimento reale: soldato nel deserto fa 0,3 cm
  const u = DM.addUnit(G, 'S', 0, 4, 4);
  near(moveDist(G, u, 4, 7)[0], .3, .051);
});

test('movimento: limite per giro, si ferma prima dell’acqua, aria non atterra su Lavico/Banchisa', () => {
  const G = testGame();
  const a = DM.addUnit(G, 'S', 0, 15, 22), b = DM.addUnit(G, 'S', 0, 16, 22);
  const [d] = moveDist(G, a, 15, 25);
  near(d, 1, .051);
  assert.match(DM.moveUnit(G, a, 15, 26), /già mosso/);
  assert.match(DM.moveUnit(G, b, 16, 25), /Limite di movimento/);
  // soldato vicino al fiume si ferma sulla riva
  G.moved = 0;
  const r = DM.addUnit(G, 'S', 0, 29, 20);
  DM.moveUnit(G, r, 31, 20);
  assert.ok(r.x < 29.5 && r.x > 29.3, 'fermo sulla riva: ' + r.x);
  // elicottero: Banchisa vietata per l'atterraggio
  G.moved = 0;
  const e = DM.addUnit(G, 'E', 0, 51, 33);
  assert.match(DM.moveUnit(G, e, 54, 33), /non possono atterrare/);
  G.moved = 0;
  const e2 = DM.addUnit(G, 'E', 0, 15, 33);
  assert.match(DM.moveUnit(G, e2, 17, 36), /non possono atterrare/);
});

test('Elicottero da Aeroporto: 6 cm alla partenza; altrove 4', () => {
  const G = testGame();
  const e = DM.addUnit(G, 'E', 0, 15, 20);
  near(moveDist(G, e, 25, 20)[0], 6, .051);
  G.moved = 0; e.m = false;
  near(moveDist(G, e, 25, 20)[0], 4, .051);
});

test('area radioattiva: velocità :2 dopo il bioma, arrotondata per eccesso al mm (0,3 → 0,2)', () => {
  const G = testGame();
  G.rad.push({ x: 4, y: 4, r: 3, until: G.round + 3 });
  const u = DM.addUnit(G, 'S', 0, 4, 4);
  assert.equal(DM.speedAt(G, u, 4, 4), .2);
  const p = DM.addUnit(G, 'S', 0, 15, 26);
  G.rad.push({ x: 15, y: 26, r: 3, until: G.round + 3 });
  assert.equal(DM.speedAt(G, p, 15, 26), .5);
  G.round += 3;
  assert.equal(DM.speedAt(G, p, 15, 26), 1, 'dopo 3 giri finisce');
});

test('pozione Velocità e bacca Palude sulla velocità', () => {
  const G = testGame();
  const u = DM.addUnit(G, 'S', 0, 4, 4);   // deserto
  u.vp = G.round;
  near(DM.speedAt(G, u, 4, 4), .6);        // malus → raddoppia
  const p = DM.addUnit(G, 'S', 0, 15, 26);
  p.vp = G.round;
  near(DM.speedAt(G, p, 15, 26), 2);       // pianura → +1
  const h = DM.addUnit(G, 'S', 0, 22, 37); // glaciale: nessun malus → +1
  h.vp = G.round;
  near(DM.speedAt(G, h, 22, 37), 2);
  const l = DM.addUnit(G, 'S', 0, 4, 37);  // palude
  l.bf = { k: 'L', until: G.round + 3 };
  near(DM.speedAt(G, l, 4, 37), .2);        // 0,3 − 0,1
  const q = DM.addUnit(G, 'S', 0, 15, 26);
  q.bf = { k: 'L', until: G.round + 3 };
  near(DM.speedAt(G, q, 15, 26), .2);       // 1 : 5
});

test('ponti a pezzi da 1 cm: si comprano, si posano tra due rive; liv.1 per Soldati, non Carrarmati né Navi sotto; liv.2 per tutti', () => {
  const G = testGame();
  DM.addUnit(G, 'S', 0, 28.5, 25); DM.claim(G, 0, 28.5, 25);
  assert.match(DM.buildBridge(G, 28.8, 25, 29.3, 25, 1), /non c’è acqua/);
  assert.match(DM.buildBridge(G, 29, 25, 30, 25, 1), /Tocca la terra/);
  assert.match(DM.buildBridge(G, 29, 25, 31, 25, 1), /1,0 cm, 1 pezzo usato/);   // il pezzo del kit Tribù
  assert.equal(G.players[0].res.ponte1, 0);
  const br = G.bridges[0];
  near(br.x1, 29.5, .03); near(br.x2, 30.5, .03);   // il ponte copre solo l'acqua
  const s = DM.addUnit(G, 'S', 0, 29, 25), t = DM.addUnit(G, 'T', 0, 29, 25.05);
  DM.moveUnit(G, s, 31, 25);
  near(s.x, 30, .051);                   // sul ponte va a 1 cm per turno
  G.moved = 0; s.m = false;
  DM.moveUnit(G, s, 31, 25);
  assert.ok(s.x > 30.5, 'il soldato attraversa: ' + s.x);
  DM.moveUnit(G, t, 31, 25.05);
  assert.ok(t.x < 29.5, 'il carrarmato non passa sul liv.1: ' + t.x);
  assert.equal(DM.baseSpeed(G, 'N', 30, 25), 0, 'nave non passa sotto il liv.1');
  assert.equal(DM.baseSpeed(G, 'N', 30, 22), 4, 'nave sul fiume altrove');
  // in diagonale l'acqua è 1,12 cm → servono 2 pezzi
  assert.match(DM.buildBridge(G, 29, 25, 31, 24, 2), /servono 2 pezzi di ponte liv. 2, ne hai 0/);
  const cap = DM.capitalOf(G, 0);
  cap.inv.mat.ferro = 1000;
  assert.match(DM.buy(G, cap, 'ponte2'), /riserva/);
  DM.buy(G, cap, 'ponte2');
  assert.deepEqual([G.players[0].res.ponte2, cap.inv.mon, cap.inv.mat.ferro], [2, 230000, 600]);
  assert.match(DM.buildBridge(G, 29, 25, 31, 24, 2), /1,1 cm, 2 pezzi usati/);
  assert.equal(G.players[0].res.ponte2, 0);
  assert.equal(DM.baseSpeed(G, 'T', 30, 24.5), 1);
  // serve una tua truppa vicino e una riva nel tuo territorio
  G.players[0].res.ponte1 = 3;
  assert.match(DM.buildBridge(G, 29, 10, 31, 10, 1), /territorio|truppa/);
});

test('ponti sul mare: liv.1 vietato, liv.2 più corto di 2 cm; 0,7 cm usa 1 pezzo', () => {
  const G = testGame({ biome: (x, y) => (x < 1 || y < 1 || x > 59 || y > 41) ? 'S' : (x > 30 && x < 31.5) || (x > 40 && x < 43) || (x > 50 && x < 50.7) ? 'S' : 'P' });
  G.players[0].res.ponte1 = 5; G.players[0].res.ponte2 = 10;
  for (const x of [29.5, 39.5, 49.5]) { DM.addUnit(G, 'S', 0, x, 25); DM.claim(G, 0, x, 25); }
  assert.match(DM.buildBridge(G, 29.8, 25, 32, 25, 1), /non si piazza sul mare/);
  assert.match(DM.buildBridge(G, 29.8, 25, 32, 25, 2), /1,5 cm, 2 pezzi usati/);
  assert.match(DM.buildBridge(G, 39.8, 25, 43.5, 25, 2), /più corto di 2 cm/);
  assert.match(DM.buildBridge(G, 49.8, 25, 51, 25, 2), /0,7 cm, 1 pezzo usato/);
  assert.equal(G.players[0].res.ponte2, 7);
});

test('strade: costo per pezzo, doppio nei biomi difficili, acqua solo con ponte, viaggio tra edifici a velocità doppia', () => {
  const G = testGame();
  const cap = DM.capitalOf(G, 0);
  const a = DM.addSite(G, 0, 'acc', 15, 21.8), b = DM.addSite(G, 0, 'acc', 15, 25.3), c = DM.addSite(G, 0, 'acc', 18, 25.3);
  assert.match(DM.buildRoad(G, cap, a), /Servono/);
  cap.inv.mat.ferro = 10000; cap.inv.mat.oro = 1000;
  assert.match(DM.buildRoad(G, cap, a), /1 pezzo/);
  assert.equal(cap.inv.mon, 240000);
  assert.equal(cap.inv.mat.ferro, 8000);
  assert.match(DM.buildRoad(G, a, cap), /già collegati/);
  a.inv.mon = b.inv.mon = 1e5; a.inv.mat = { ferro: 1e4, oro: 1e3 }; b.inv.mat = { ferro: 1e4, oro: 1e3 };
  assert.match(DM.buildRoad(G, a, b), /costruita/);
  assert.match(DM.buildRoad(G, b, c), /costruita/);
  // Soldato: 3 cm da cap ad a, 3,5 da a a b → 6,5 cm > 2 (velocità doppia) → non arriva fino a b in un turno
  const s = DM.addUnit(G, 'S', 0, 15, 20);
  assert.match(DM.moveUnit(G, s, 15, 21.8), /strada/);   // 1,8 cm a velocità doppia
  assert.equal(s.y, 21.8);
  G.moved = 0; s.m = false;
  // da a a c passando da b: 3,5 + 3 = 6,5 → no; da b a c: 3 cm → 2 cm max con la strada → no ... soldato veloce 2: non basta
  assert.doesNotMatch(DM.moveUnit(G, s, 18, 25.3), /strada/);
  // Carro (velocità 4, non raddoppia): cap → a → b = 6,5 cm > 4 → non viaggia sulla strada
  G.moved = 0;
  const carro = DM.addUnit(G, 'C', 0, 15, 20);
  assert.doesNotMatch(DM.moveUnit(G, carro, 15, 25.3), /strada/);
  // Soldato su strada corta (1,8 cm) con velocità doppia: ci arriva
  const d = DM.addSite(G, 0, 'acc', 16.8, 20);
  assert.match(DM.buildRoad(G, cap, d), /costruita/);
  G.moved = 0;
  const s2 = DM.addUnit(G, 'S', 0, 15, 20);
  assert.match(DM.moveUnit(G, s2, 16.8, 20), /strada/);
  assert.equal(s2.x, 16.8);
  // più tratti: cap → d e cap → a, da d ad a (3,5 cm circa) passando dalla capitale: 1,8 + 3 = 4,8 → no; Carrarmato no
  // strada sull'acqua senza ponte
  const e = DM.addSite(G, 0, 'acc', 28, 30), f = DM.addSite(G, 0, 'acc', 32, 30);
  e.inv.mon = 1e6; e.inv.mat.ferro = 1e5; e.inv.mat.oro = 1e4;
  assert.match(DM.buildRoad(G, e, f), /si ferma all’acqua/);
  G.players[0].res.ponte2 = 1;
  DM.addUnit(G, 'S', 0, 29, 30); DM.claim(G, 0, 29, 30);
  assert.match(DM.buildBridge(G, 29.2, 30, 30.8, 30, 2), /1 pezzo usato/);
  assert.match(DM.buildRoad(G, e, f), /costruita \(1 pezzo\)/);   // si paga solo la terra: 3 cm
  // costo doppio in Giungla
  const g1 = DM.addSite(G, 0, 'acc', 9, 5), g2 = DM.addSite(G, 0, 'acc', 12, 5);
  g1.inv.mon = 1e6; g1.inv.mat.ferro = 1e5; g1.inv.mat.oro = 1e4;
  assert.match(DM.buildRoad(G, g1, g2), /costo doppio/);
  assert.equal(g1.inv.mon, 1e6 - 20000);
  // Lavico vietato
  const z1 = DM.addSite(G, 0, 'acc', 15, 36), z2 = DM.addSite(G, 0, 'acc', 21, 36);
  assert.match(DM.buildRoad(G, z1, z2), /Banchisa e Lava/);
});

test('strada collegata al ponte: si attacca all’estremità del ponte e il viaggio passa sopra il ponte', () => {
  const G = testGame();
  G.players[0].res.ponte2 = 1;
  DM.addUnit(G, 'S', 0, 29, 15); DM.claim(G, 0, 29, 15);
  assert.match(DM.buildBridge(G, 29.1, 15, 30.9, 15, 2), /costruito/);
  const a = DM.addSite(G, 0, 'acc', 29.2, 15.1), b = DM.addSite(G, 0, 'acc', 30.8, 15.1);
  [a, b].forEach(z => { z.inv.mon = 1e6; z.inv.mat.ferro = 1e5; z.inv.mat.oro = 1e4; });
  const end1 = DM.nodeNear(G, 29.5, 15, a), end2 = DM.nodeNear(G, 30.5, 15, b);   // come nel gioco: si esclude l'edificio di partenza
  assert.ok(end1 && end1.bridge && end2 && end2.bridge, 'si toccano le estremità del ponte');
  assert.match(DM.buildRoad(G, a, end1), /collegata al ponte/);
  assert.match(DM.buildRoad(G, b, end2), /collegata al ponte/);
  // con la pozione Velocità il soldato fa strada (0,3 cm) + ponte (1 cm) + strada (0,3 cm) in un turno
  const s = DM.addUnit(G, 'S', 0, 29.2, 15.1);
  s.vp = G.round;
  assert.match(DM.moveUnit(G, s, 30.8, 15.1), /3 tratti/);
  assert.equal(s.x, 30.8);
  // distrutto il ponte, le strade collegate spariscono
  DM.removeBridge(G, G.bridges[0]);
  assert.equal(G.roads.length, 0);
});

test('strade a più tratti: il viaggio passa dagli edifici collegati', () => {
  const G = testGame();
  const a = DM.addSite(G, 0, 'acc', 20, 15), b = DM.addSite(G, 0, 'acc', 20.9, 15), c = DM.addSite(G, 0, 'acc', 21.8, 15);
  [a, b].forEach(z => { z.inv.mon = 1e6; z.inv.mat.ferro = 1e5; z.inv.mat.oro = 1e4; });
  assert.match(DM.buildRoad(G, a, b), /costruita/);
  assert.match(DM.buildRoad(G, b, c), /costruita/);
  const s = DM.addUnit(G, 'S', 0, 20, 15);
  assert.match(DM.moveUnit(G, s, 21.8, 15), /2 tratti/);
  assert.equal(s.x, 21.8);
});

test('eserciti: compatibilità, 1 cm, tetto 100 punti, velocità della truppa più lenta, uscita', () => {
  const G = testGame();
  const s = DM.addUnit(G, 'S', 0, 15, 22), t = DM.addUnit(G, 'T', 0, 15.5, 22), n = DM.addUnit(G, 'N', 0, 15.2, 22), far = DM.addUnit(G, 'S', 0, 17, 22);
  assert.equal(DM.pickError(G, [], s), '');
  assert.match(DM.pickError(G, [s], far), /Troppo lontana/);
  assert.match(DM.pickError(G, [s], n), /non può stare/);
  assert.ok(DM.compatible('N', 'E') && DM.compatible('N', 'X') && DM.compatible('X', 'A') && !DM.compatible('X', 'S') && !DM.compatible('N', 'A'));
  const ts = [];
  for (let i = 0; i < 5; i++) ts.push(DM.addUnit(G, 'T', 0, 15 + i * .1, 23));
  assert.equal(DM.armyPts(ts), 100);
  assert.match(DM.pickError(G, ts, DM.addUnit(G, 'S', 0, 15, 23)), /100 punti/);
  assert.equal(DM.armyPts([DM.addUnit(G, 'N', 0, 1, 1), DM.addUnit(G, 'X', 0, 1, 1), DM.addUnit(G, 'E', 0, 1, 1)]), 70);
  const r = DM.formArmy(G, [s, t]);
  assert.match(r.msg, /Esercito 1/);
  assert.equal(s.x, t.x);
  // si muove alla velocità del più lento (pianura: entrambi 1) → in Tundra il carrarmato 0,5
  const [d] = moveDist(G, s, 15, 26);
  near(d, 1, .051);
  assert.ok(t.m && s.m);
  assert.match(DM.leaveArmy(G, s), /già mosso/);
  s.m = t.m = false;
  assert.match(DM.leaveArmy(G, s), /sciolto/);
  assert.equal(t.g, 0);
  // formazione impossibile se il punto non va bene per tutti
  const sl = DM.addUnit(G, 'S', 0, 29.3, 30), e = DM.addUnit(G, 'E', 0, 30, 30);
  const r2 = DM.formArmy(G, [e, sl]);
  assert.ok(r2.msg, 'si unisce dove sta il soldato');
  assert.equal(e.x, 29.3);
});

test('annulla mossa: torna indietro e restituisce le terre prese; non dopo lo sparo', () => {
  const G = testGame();
  const u = DM.addUnit(G, 'S', 0, 16, 23);
  assert.equal(DM.terrAt(G, 16, 25.5), -1);
  DM.moveUnit(G, u, 16, 24);
  assert.equal(DM.terrAt(G, 16, 25.5), 0);
  assert.match(DM.undoMove(G, u), /annullata/);
  assert.equal(u.y, 23);
  assert.equal(DM.terrAt(G, 16, 25.5), -1);
  assert.equal(G.moved, 0);
  DM.moveUnit(G, u, 16, 24);
  u.s = true;
  assert.match(DM.undoMove(G, u), /già sparato/);
});

test('eserciti sui ponti: con un Carrarmato il liv.1 non si passa, il liv.2 sì', () => {
  const G = testGame();
  G.bridges.push({ o: 0, x: 30, y: 25, x1: 29, y1: 25, x2: 31, y2: 25, lv: 1, hp: 5000 });
  G.bridges.push({ o: 0, x: 30, y: 15, x1: 29, y1: 15, x2: 31, y2: 15, lv: 2, hp: 10000 });
  const a = [DM.addUnit(G, 'S', 0, 29.3, 25), DM.addUnit(G, 'T', 0, 29.3, 25)];
  DM.formArmy(G, a);
  DM.moveUnit(G, a[0], 31, 25);
  assert.ok(a[0].x < 29.5 && a[1].x === a[0].x, 'fermo prima del ponte liv.1: ' + a[0].x);
  G.moved = 0;
  const b = [DM.addUnit(G, 'S', 0, 29.3, 15), DM.addUnit(G, 'T', 0, 29.3, 15)];
  DM.formArmy(G, b);
  DM.moveUnit(G, b[0], 31, 15);
  assert.ok(Math.abs(b[0].x - 30.3) < .06 && b[1].x === b[0].x, 'sul ponte liv.2: ' + b[0].x);
  // una flotta passa sotto il liv.2 ma non sotto il liv.1
  assert.equal(DM.baseSpeed(G, 'N', 30, 15), 4);
  assert.equal(DM.baseSpeed(G, 'N', 30, 25), 0);
});

test('mosse per turno: Carro 3, Nave Carro 2, Aereo Carro 1, ognuna con tutta la velocità; una sola conta nel limite', () => {
  const G = testGame();
  const c = DM.addUnit(G, 'C', 0, 16, 22), s = DM.addUnit(G, 'S', 0, 17, 22);
  G.moved = 0;
  assert.equal(DM.speedAt(G, c, c.x, c.y), 4);   // Pianura
  assert.match(DM.moveUnit(G, c, 16, 30), /Mossa completata: velocità esaurita\. Può muoversi ancora 2 volte/);
  near(c.y, 26, .06); assert.equal(G.moved, 1);
  // seconda e terza mossa: di nuovo 4 cm, e non contano nel limite (al 1° giro si muove 1 sola cosa)
  assert.match(DM.moveUnit(G, c, 20, 26), /ancora 1 volta/); near(c.x, 20, .06);
  assert.match(DM.moveUnit(G, c, 20, 22), /Mosse finite/); near(c.y, 22, .06);
  assert.equal(G.moved, 1);
  assert.match(DM.moveUnit(G, c, 20, 21), /tutte le sue 3 mosse/);
  // le altre truppe no
  assert.match(DM.moveUnit(G, s, 17, 23), /Limite di movimento/);
  G.moved = 0;
  DM.moveUnit(G, s, 17, 23);
  assert.match(DM.moveUnit(G, s, 17, 23.5), /già mosso/);
  // annulla: si torna indietro una mossa alla volta
  DM.undoMove(G, c); near(c.x, 20, .06); near(c.y, 26, .06); assert.equal(c.m, true); assert.equal(DM.movesLeft(G, c), 1);
  DM.undoMove(G, c); DM.undoMove(G, c); near(c.x, 16, .06); near(c.y, 22, .06); assert.equal(c.m, false);
  // Nave Carro 2, Aereo Carro 1
  assert.deepEqual(['X', 'A', 'S', 'N'].map(t => DM.movesOf([{ t }])), [2, 1, 1, 1]);
  // al turno dopo si riparte da capo
  DM.moveUnit(G, c, 17, 22); DM.endTurn(G); DM.endTurn(G);
  assert.equal(DM.movesLeft(G, c), 3);
});
