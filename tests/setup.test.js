// Preparazione, kit, Capitale, limiti per giro, generazione mappe.
const test = require('node:test'), assert = require('node:assert/strict');
const { DM, testGame, testBiome } = require('./helpers');

test('limiti di movimento e sparo per giro (vince l’intervallo precedente)', () => {
  const mv = [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 5, 5, 5, 5, 5, 8, 8];
  const sh = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 8, 8];
  mv.forEach((v, i) => assert.equal(DM.moveLimit(i + 1), v, 'movimento giro ' + (i + 1)));
  sh.forEach((v, i) => assert.equal(DM.shotLimit(i + 1), v, 'spari giro ' + (i + 1)));
});

test('Capitale: biomi vietati e distanza minima 15 cm (2 giocatori) / 10 cm (3+)', () => {
  const G = DM.newGame({}, 1, DM.mapFromFn(testBiome));
  DM.setPlayers(G, 2);
  DM.chooseKit(G, 0);
  for (const [x, y] of [[1, 1], [10, 5], [11, 36], [30, 20], [17, 36], [55, 35]]) {
    assert.match(DM.placeCapital(G, x, y), /Qui non si può/, 'vietato in ' + DM.bAt(G, x, y));
  }
  assert.equal(DM.placeCapital(G, 15, 20), '');
  assert.equal(G.phase, 'kit');
  DM.chooseKit(G, 1);
  assert.match(DM.placeCapital(G, 28, 20), /minimo 15 cm/);
  assert.match(DM.placeCapital(G, 45, 20), /Schiera/);
  assert.equal(G.phase, 'play');
  assert.equal(G.p, 0);
  const G3 = DM.newGame({}, 1, DM.mapFromFn(testBiome));
  DM.setPlayers(G3, 3);
  DM.chooseKit(G3, 0); DM.placeCapital(G3, 15, 20);
  DM.chooseKit(G3, 0);
  assert.match(DM.placeCapital(G3, 24, 20), /minimo 10 cm/);
  assert.equal(DM.placeCapital(G3, 26, 20), '');
});

test('kit: contenuto, Carro, Aeroporto gratis nella Capitale', () => {
  const G = testGame({ np: 5, kits: [0, 1, 2, 3, 4] });
  const [tri, min, mer, nav, mag] = G.players;
  assert.deepEqual([tri.res.S, tri.res.acc, tri.res.porto, tri.res.N, tri.res.ponte1, tri.res.C], [5, 5, 12, 1, 1, 1]);
  assert.deepEqual([min.res.min, min.res.porto], [5, 7]);
  assert.equal(mer.res.citta, 1);
  assert.deepEqual([nav.res.S, nav.res.N, nav.res.E, nav.res.aer, nav.res.acc], [15, 4, 1, 2, 10]);
  assert.deepEqual([mag.res.min, mag.dice, mag.res.acc, mag.res.porto], [2, 2, 1, 2]);
  const capInv = o => DM.capitalOf(G, o).inv;
  assert.equal(capInv(0).mon, 250000);
  assert.equal(capInv(2).mon, 650000);
  assert.equal(capInv(1).mat.ferro, 1000);
  assert.equal(capInv(1).mat.uranio, 20);
  assert.equal(capInv(1).mat.ossidiana, undefined);
  assert.equal(capInv(4).mat.poz_stipendio, 1);
  assert.equal(capInv(4).mat.poz_ignifuga, 2);
  for (let o = 0; o < 5; o++) {
    const cap = DM.capitalOf(G, o);
    assert.ok(G.sites.some(s => s.o === o && s.k === 'aer' && s.par === cap.id), 'aeroporto gratis ' + o);
    assert.equal(DM.terrAt(G, cap.x + 1.5, cap.y), o, 'territorio attorno alla capitale');
  }
});

test('generazione: tutte le opzioni, bordo sempre mare, Alta montagna solo vicino a Montagna/acqua', () => {
  for (const isl of [0, 1, 2]) for (const hum of [0, 4]) for (const temp of [0, 4]) for (const comp of [0, 1, 2, 3, 4]) {
    const m = DM.makeMap({ isl, hum, temp, comp }, 3 + isl * 7 + comp);
    DM.rebuildMap(m, 1);
    const at = (x, y) => DM.mapAt(m, x, y);
    for (let x = .05; x < 60; x += .5) { assert.equal(at(x, .1), 'S'); assert.equal(at(x, 41.9), 'S'); }
    for (let y = .05; y < 42; y += .5) { assert.equal(at(.1, y), 'S'); assert.equal(at(59.9, y), 'S'); }
    if (comp === 0) assert.ok([...m.cells].every(c => 'PSFAM'.includes(DM.BIOMES[c])), 'semplicissima: solo pianura, montagne e acqua');
    if (comp <= 1) assert.ok(![...m.cells].some(c => 'ZIH'.includes(DM.BIOMES[c])), 'niente biomi speciali con varietà bassa');
  }
  // Alta montagna confina solo con Montagna, fiumi/laghi o altra Alta montagna (campione)
  const m = DM.makeMap({}, 7); DM.rebuildMap(m, 1);
  let bad = 0;
  for (let y = .05; y < 42; y += .1) for (let x = .05; x < 60; x += .1) {
    if (DM.mapAt(m, x, y) !== 'A') continue;
    for (const [dx, dy] of [[.1, 0], [-.1, 0], [0, .1], [0, -.1]]) { const b = DM.mapAt(m, x + dx, y + dy); if (b && !'AMFZV'.includes(b)) bad++; }
  }
  assert.equal(bad, 0);
});
