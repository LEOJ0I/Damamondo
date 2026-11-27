// Le mappe segrete: si trovano con il numero e le opzioni giuste, e i biomi stanno dove sono (o erano) davvero.
const test = require('node:test'), assert = require('node:assert/strict');
const DM = require('./load')();

const CASES = [['oggi', {}, 0], ['pangea', { isl: 0 }, 0], ['glaciale', { temp: 4 }, 0], ['cretaceo', { temp: 0 }, 0], ['saharaverde', { hum: 4 }, 0], ['anello', { comp: 4 }, 0],
  ['italia', {}, 39], ['napoli', {}, 79], ['mediterraneo', {}, 753], ['atlantico', {}, 1492], ['nordatlantico', {}, 1912], ['himalaya', {}, 8848], ['alpi', {}, 4808], ['luna', {}, 1969]];
const maps = {};
const get = id => { if (!maps[id]) { const c = CASES.find(k => k[0] === id); const m = DM.makeMap(c[1], c[2]); DM.rebuildMap(m, 1); maps[id] = m; } return maps[id]; };
// bioma alla longitudine/latitudine vera, nella vista della mappa
const VIEWS = { oggi: 'mondo', glaciale: 'mondo', saharaverde: 'mondo', anello: 'mondo', italia: 'italia', napoli: 'napoli', mediterraneo: 'mediterraneo', atlantico: 'atlantico', nordatlantico: 'nordatlantico', himalaya: 'himalaya', alpi: 'alpi' };
function at(id, lon, lat) {
  const v = DM.SECRET_MASKS[VIEWS[id]].view, x = (lon - v[0]) / (v[1] - v[0]) * DM.W, y = (lat - v[2]) / (v[3] - v[2]) * DM.H;
  return DM.mapAt(get(id), x, y);
}
const is = (id, lon, lat, ok, what) => { const b = at(id, lon, lat); assert.ok(ok.includes(b), `${id}: ${what} (${lon}, ${lat}) è ${DM.BIOME_NAME[b]}, mi aspettavo ${[...ok].map(k => DM.BIOME_NAME[k]).join(' o ')}`); };

test('si trovano con il numero e le opzioni giuste (e solo così)', () => {
  for (const [id, o, seed] of CASES) assert.equal(DM.makeMap(o, seed).secret, id, id);
  assert.equal(DM.makeMap({ comp: 3 }, 0).secret, undefined, 'numero 0 con altre opzioni: mappa normale');
  assert.equal(DM.makeMap({ isl: 0, temp: 4 }, 0).secret, undefined);
  assert.equal(DM.makeMap({}, 40).secret, undefined);
  assert.equal(DM.makeMap({ gen: 4 }, 39).secret, undefined, 'le partite vecchie (generatore 4) restano com’erano');
  assert.equal(DM.SECRETS.length, 14);
  assert.equal(DM.newGame({}, 0).seed, 0, 'lo 0 resta 0');
});

test('la Terra di oggi', () => {
  is('oggi', 10, 23, 'D', 'Sahara'); is('oggi', 45, 23, 'D', 'Arabia'); is('oggi', 133, -25, 'D', 'Australia');
  is('oggi', -62, -6, 'GF', 'Amazzonia'); is('oggi', 22, 0, 'GF', 'Congo'); is('oggi', 113, 0, 'GF', 'Borneo');
  is('oggi', -40, 72, 'H', 'Groenlandia'); is('oggi', 88, 32, 'AF', 'Tibet'); is('oggi', 100, 70, 'TF', 'Siberia');
  is('oggi', -30, 30, 'S', 'Atlantico'); is('oggi', -150, 0, 'S', 'Pacifico'); is('oggi', 50.5, 42, 'F', 'mar Caspio');
  is('oggi', -105, 40, 'MA', 'Montagne Rocciose'); is('oggi', 2, 47, 'P', 'Francia');
  assert.ok(get('oggi').volc.length >= 5);
});

test('l’era glaciale: ponti di terra, calotte di ghiaccio, Sahara più grande', () => {
  is('glaciale', 3, 54, 'PTHMDFL', 'Doggerland (oggi Mare del Nord)'); is('glaciale', 110, -5, 'PGDMLF', 'Sonda (oggi Mar di Giava)'); is('glaciale', 138, -10, 'PGDLMF', 'Sahul (Australia–Nuova Guinea)');
  is('glaciale', -90, 55, 'H', 'Canada sotto il ghiaccio'); is('glaciale', 15, 62, 'H', 'Scandinavia sotto il ghiaccio'); is('glaciale', 10, 23, 'D', 'Sahara');
  is('oggi', 3, 54, 'S', 'oggi il Mare del Nord è mare');
});

test('il Sahara verde: savana e laghi dove oggi c’è il deserto', () => {
  is('saharaverde', 10, 23, 'PFL', 'Sahara'); is('saharaverde', 17, 15.5, 'F', 'Mega-Ciad'); is('saharaverde', 45, 23, 'PF', 'Arabia');
  is('saharaverde', 133, -25, 'D', 'Australia (resta deserto)');
});

test('l’Anello di fuoco: tanti vulcani veri', () => {
  const m = get('anello');
  assert.ok(m.volc.length >= 20);
  is('anello', 138.7, 35.4, 'VZ', 'Fuji'); is('anello', 15, 37.75, 'VZ', 'Etna'); is('anello', -78.44, -.68, 'VZ', 'Cotopaxi');
});

test('Pangea e Cretaceo: com’erano i continenti', () => {
  const comp = m => {
    const w = DM.W * DM.MR, h = DM.H * DM.MR, S = DM.BIOMES.indexOf('S'), land = i => m.cells[i] !== S;
    const seen = new Uint8Array(w * h); let n = 0, best = 0;
    for (let i = 0; i < w * h; i++) if (land(i)) { n++; if (!seen[i]) { let sz = 0; const st = [i]; seen[i] = 1; while (st.length) { const c = st.pop(), x = c % w; sz++; for (const d of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w]) if (d >= 0 && d < w * h && land(d) && !seen[d]) { seen[d] = 1; st.push(d); } } best = Math.max(best, sz); } }
    return best / n;
  };
  assert.ok(comp(get('pangea')) > .85, 'Pangea: un solo supercontinente');
  assert.equal(DM.mapAt(get('pangea'), 44, 21.5 + 2), 'S', 'la Tetide entra da est');
  const c = get('cretaceo');
  assert.ok(!c.cells.includes(DM.BIOMES.indexOf('H')), 'Cretaceo: niente ghiaccio');
  assert.ok(comp(c) < .6, 'Cretaceo: continenti già separati');
});

test('Italia, Golfo di Napoli, Mediterraneo, Atlantico', () => {
  is('italia', 12.5, 41.9, 'PFMLV', 'Roma'); is('italia', 12, 40, 'S', 'mar Tirreno'); is('italia', 9, 40, 'PMF', 'Sardegna'); is('italia', 14, 37.5, 'PMVZF', 'Sicilia');
  is('italia', 15, 37.75, 'VZ', 'Etna'); is('italia', 14.43, 40.82, 'VZ', 'Vesuvio'); is('italia', 6.86, 45.83, 'H', 'Monte Bianco'); is('italia', 10.65, 45.65, 'F', 'lago di Garda');
  is('italia', 10, 45.1, 'PF', 'Pianura Padana'); is('italia', 13.57, 42.47, 'A', 'Gran Sasso');
  is('napoli', 14.426, 40.821, 'Z', 'cratere del Vesuvio'); is('napoli', 14.47, 40.79, 'V', 'pendici del Vesuvio'); is('napoli', 14.2, 40.7, 'S', 'golfo di Napoli');
  is('mediterraneo', 13, 41.4, 'L', 'paludi Pontine (prima delle bonifiche)'); is('mediterraneo', 10, 25, 'D', 'Sahara'); is('mediterraneo', 18, 35, 'S', 'mar Ionio');
  is('atlantico', -62, -5, 'GF', 'Amazzonia'); is('atlantico', -75, 15, 'S', 'mar dei Caraibi'); is('atlantico', -6, 40, 'PMF', 'Spagna');
});

test('Nord Atlantico del Titanic, Himalaya, Alpi, Luna', () => {
  const na = get('nordatlantico'), v = DM.SECRET_MASKS.nordatlantico.view, I = DM.BIOMES.indexOf('I');
  let ice = 0;
  for (let lat = 41.5; lat < 46; lat += .25) for (let lon = -52; lon < -46; lon += .25) if (DM.mapAt(na, (lon - v[0]) / (v[1] - v[0]) * DM.W, (lat - v[2]) / (v[3] - v[2]) * DM.H) === 'I') ice++;
  assert.ok(ice > 10, 'ghiaccio sui Grandi Banchi, dove affondò il Titanic');
  is('nordatlantico', -45, 63, 'H', 'Groenlandia del sud');
  is('himalaya', 86.925, 27.988, 'H', 'Everest'); is('himalaya', 88, 31.5, 'TF', 'altopiano del Tibet'); is('himalaya', 83, 26, 'PF', 'pianura del Gange');
  is('alpi', 6.865, 45.833, 'H', 'Monte Bianco'); is('alpi', 10.67, 45.6, 'F', 'lago di Garda'); is('alpi', 9.19, 45.46, 'P', 'Milano'); is('alpi', 8.1, 46.6, 'AHM', 'Alpi svizzere');
  const L = get('luna');
  assert.ok(!L.cells.includes(DM.BIOMES.indexOf('F')), 'sulla Luna niente acqua');
  assert.ok(L.cells.includes(DM.BIOMES.indexOf('V')), 'i mari lunari (basalto)');
});

test('una partita sulla mappa segreta si salva e si riprende uguale, e ci si gioca', () => {
  for (const [id, o, seed] of [['italia', {}, 39], ['oggi', {}, 0]]) {
    const G = DM.newGame(o, seed);
    assert.equal(G.map.secret, id);
    DM.setPlayers(G, 2);
    DM.setBot(G, 0, 'normale'); DM.setBot(G, 1, 'normale');
    while (G.phase !== 'play') DM.botSetup(G);
    for (let i = 0; i < 6; i++) { DM.botPlayTurn(G); DM.endTurn(G); }
    const H = DM.deserialize(DM.serialize(G));
    assert.equal(H.map.secret, id);
    assert.deepEqual(Array.from(H.map.cells.slice(0, 5000)), Array.from(G.map.cells.slice(0, 5000)));
    assert.equal(H.sites.filter(s => s.k === 'cap').length, 2);
  }
});

test('la mappa originale: il 6 solo dopo tutte le mappe segrete (opts.orig), fatta solo di pianura, mare, acqua e montagne', () => {
  assert.equal(DM.makeMap({}, 6).secret, undefined, 'senza sblocco il 6 non è la mappa originale (è la mappa del simbolo)');
  const m = DM.makeMap({ orig: 1 }, 6);
  assert.equal(m.secret, 'originale');
  assert.equal(DM.makeMap({ orig: 1 }, 7).secret, undefined);
  const B = DM.BIOMES, used = new Set(m.sec.cells);
  assert.deepEqual([...used].map(c => B[c]).sort(), ['A', 'F', 'M', 'P', 'S']);
  const land = m.sec.cells.filter(c => B[c] !== 'S').length / m.sec.cells.length;
  assert.ok(land > .2 && land < .4, 'terra ' + land);
  assert.equal(m.volc.length, 0, 'niente vulcani');
  // il cratere del foglio in alto a sinistra: un'isola di sola montagna con la cima alta (vicino all'angolo in alto a destra del foglio)
  assert.equal(DM.secretBiome(m, 26.9, 3.78, 1), 'A');
  // tutto intorno alla mappa c'è il mare
  for (let x = .05; x < 60; x += .5) for (const y of [.05, 41.95]) assert.equal(DM.secretBiome(m, x, y, 1), 'S');
  for (let y = .05; y < 42; y += .5) for (const x of [.05, 59.95]) assert.equal(DM.secretBiome(m, x, y, 1), 'S');
  assert.equal(DM.secretInfo('originale').emoji, '📜');
  assert.equal(DM.SECRETS.length, 14, 'non conta tra le 14');
  // si salva e si riprende uguale, e i bot ci giocano
  const G = DM.newGame({ orig: 1 }, 6);
  DM.setPlayers(G, 6);
  for (let i = 0; i < 6; i++) DM.setBot(G, i, 'difficile');
  while (G.phase !== 'play') DM.botSetup(G);
  for (let i = 0; i < 12; i++) { DM.botPlayTurn(G); DM.endTurn(G); }
  const H = DM.deserialize(DM.serialize(G));
  assert.equal(H.map.secret, 'originale');
  assert.equal(H.sites.filter(s => s.k === 'cap').length, 6);
});

test('la mappa del simbolo (sfondo dell’icona e del menu): numero 6 prima dello sblocco, sempre 999999999999999', () => {
  const ref = DM.makeMap({}, 7);
  const same = m => { assert.equal(m.symbol, true); assert.deepEqual(Array.from(m.n.h ? [m.n.h(3, 4), m.n.h(10, 20)] : []), [ref.n.h(3, 4), ref.n.h(10, 20)]); };
  same(DM.makeMap({}, 6));
  same(DM.makeMap({ isl: 2, temp: 0 }, 6));
  same(DM.makeMap({}, DM.SYMBOL_SEED));
  same(DM.makeMap({ orig: 1 }, DM.SYMBOL_SEED));
  assert.equal(DM.makeMap({ orig: 1 }, 6).secret, 'originale');
  assert.equal(DM.makeMap({ gen: 4 }, 6).symbol, undefined, 'le partite vecchie restano com’erano');
  // stessi biomi della mappa del menu, e la partita si riprende uguale
  const G = DM.newGame({}, 6), R = DM.newGame({}, 7);
  assert.deepEqual(Array.from(G.map.cells), Array.from(R.map.cells));
  const H = DM.deserialize(DM.serialize(G));
  assert.equal(H.seed, 6); assert.equal(H.map.symbol, true);
  assert.deepEqual(Array.from(H.map.cells), Array.from(G.map.cells));
});

test('ogni mappa segreta ha la sua curiosità', () => {
  for (const s of DM.SECRETS.concat(DM.SECRET_ORIGINAL)) assert.ok(s.fact && s.fact.length > 40 && s.fact.length < 260, s.id + ': ' + s.fact);
  assert.equal(new Set(DM.SECRETS.map(s => s.fact)).size, DM.SECRETS.length, 'tutte diverse');
});
