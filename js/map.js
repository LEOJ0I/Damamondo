// Damamondo – generazione della mappa (biomi, fiumi, vulcani). Nessun DOM qui.
(function (DM) {
  'use strict';
  const { W, H, MR } = DM;

  // Parametri delle opzioni (scelte provvisorie, l'utente le può correggere)
  const ISF = [[.07, .2, .5, .5], [.12, .28, .6, .53], [.17, .38, .8, .56]]; // isole: frequenze + livello del mare
  const DT = [.62, .7, 2, 2, 2];          // soglia deserto per temperatura
  const HOFF = [-.14, -.07, 0, .07, .14];  // spostamento umidità
  const RW = [.012, .012, .012, .02, .03]; // larghezza fiumi per umidità
  const LK = [.82, .82, .82, .78, .74];    // soglia laghi per umidità
  const SEA_BORDER = .25;                  // bordo esterno sempre mare

  function noise(seed) {
    const h = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n); };
    const s = t => t * t * (3 - 2 * t);
    const nz = (x, y, f) => {
      x *= f; y *= f;
      const i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j;
      const v = (u, w) => h(i + u, j + w);
      return (v(0, 0) * (1 - s(a)) + v(1, 0) * s(a)) * (1 - s(b)) + (v(0, 1) * (1 - s(a)) + v(1, 1) * s(a)) * s(b);
    };
    return { h, nz };
  }

  // Umidità → bioma "normale"
  function moisture(comp, m) {
    if (comp == 0) return 'P';
    if (comp == 4) return m < .5 ? 'D' : 'L';
    const t = [0, [.14, .82, .7], [.24, .7, .54], [.38, .66, .45]][comp];
    return m < t[0] ? 'D' : m > t[1] ? 'L' : m > t[2] ? 'G' : 'P';
  }

  // Bioma nel punto (x, y) in cm, al giro "round".
  function biome(map, x, y, round) {
    const { isl, hum, temp, comp } = map.opts, { nz } = map.n, f = ISF[isl];
    if (x < SEA_BORDER || y < SEA_BORDER || x > W - SEA_BORDER || y > H - SEA_BORDER) return 'S';
    const d0 = Math.min(x, y, W - x, H - y), fe = Math.min(1, d0 / 9), se = fe * fe * (3 - 2 * fe);
    const b = nz(x, y, f[0]) * .5 + nz(x, y, f[1]) * .4 + nz(x, y, f[2]) * .1;
    const e = (.5 + (b - .5) * 1.5) * se;  // altitudine
    if (e < f[3]) {
      const ice = comp > 1 && (nz(x + 600, y + 600, .1) * .8 + nz(x + 650, y + 650, .35) * .2) >
        .74 - (temp - 2) * .08 - (comp - 2) * .03 + Math.max(0, 3 - d0) * .1;
      return ice ? 'I' : 'S';
    }
    if (Math.abs(nz(x + 400, y + 400, .07) - .6) < RW[hum] ||
      (hum > 2 && Math.abs(nz(x + 500, y + 500, .09) - .5) < RW[hum] * .6) ||
      nz(x + 300, y + 300, .22) > LK[hum]) return 'F';
    for (let i = 0; i < map.volc.length; i++) {
      const v = map.volc[i], d = Math.hypot(x - v[0], y - v[1]);
      const active = map.erupt.some(z => z.v === i && z.until > round);
      if (comp > 1 && (d < .4 || (active && d < 2.1))) return 'Z';
      if (d < 1.1) return comp > 1 && v[2] && nz(x + 800, y + 800, .9) > v[3] ? 'Z' : 'V';
      if (comp > 1 && v[2] && d < 1.7 && nz(x + 800, y + 800, .7) > v[3] + .05) return 'Z';
    }
    if (e > .78) return 'A';
    if (e > .7) return 'M';
    if (comp > 1 && nz(x + 700, y + 700, .09) > .77 - (temp - 2) * .08 - (comp - 2) * .04) return 'H';
    if (comp > 0 && comp < 4 && nz(x + 200, y + 200, .1) > .76 - (temp - 2) * .07 + (comp == 1 ? .06 : 0)) return 'T';
    if (comp > 0 && nz(x + 900, y + 900, .08) > DT[temp]) return 'D';
    return moisture(comp, nz(x + 50, y + 50, .09) + HOFF[hum]);
  }

  DM.makeMap = function (opts, seed) {
    const map = { opts: Object.assign({ isl: 1, hum: 2, temp: 2, comp: 2 }, opts), seed, n: noise(seed),
      volc: [], erupt: [], cells: new Uint8Array(W * MR * H * MR), version: 0 };
    const { h } = map.n, { comp, temp } = map.opts;
    // Vulcani: al massimo uno per riquadro di 14 cm
    for (let gx = 0; gx < W - 8; gx += 14) {
      for (let gy = 0; gy < H - 8; gy += 14) {
        if (comp > 0 && h(gx * 3.1 + 9, gy * 2.7 + 4) > [1.1, .7, .55, .5, .35][comp] + (temp - 2) * .06) {
          const x = gx + 3 + h(gx, gy + 1) * 8, y = gy + 3 + h(gx + 5, gy) * 8;
          if (!'SFIAM'.includes(biome(map, x, y, 1))) map.volc.push([x, y, h(gx + 2, gy + 7) > .25, .5 + h(gx + 9, gy + 3) * .3]);
        }
      }
    }
    return map;
  };

  // Ricalcola la griglia dei biomi (all'inizio e quando un'eruzione inizia o finisce).
  DM.rebuildMap = function (map, round) {
    const w = W * MR, codes = DM.BIOMES;
    const fn = map.custom ? (x, y) => customBiome(map, x, y, round) : (x, y) => biome(map, x, y, round);
    for (let j = 0; j < H * MR; j++) {
      for (let i = 0; i < w; i++) map.cells[j * w + i] = codes.indexOf(fn((i + .5) / MR, (j + .5) / MR));
    }
    map.version++;
  };

  // Mappa disegnata da una funzione: le eruzioni attive coprono di Lavico 2,1 cm attorno al vulcano.
  function customBiome(map, x, y, round) {
    for (let i = 0; i < map.volc.length; i++) {
      const v = map.volc[i];
      if (map.erupt.some(z => z.v === i && z.until > round) && Math.hypot(x - v[0], y - v[1]) < 2.1) return 'Z';
    }
    return map.custom(x, y);
  }

  // Mappa riempita da una funzione (serve ai test e a mappe disegnate a mano).
  // volc: [[x, y], ...] vulcani (il bioma Vulcanico lo disegna la funzione).
  DM.mapFromFn = function (fn, volc) {
    const map = { opts: { isl: 1, hum: 2, temp: 2, comp: 2 }, seed: 0, n: noise(0), volc: volc || [], erupt: [],
      cells: new Uint8Array(W * MR * H * MR), version: 0, custom: fn };
    DM.rebuildMap(map, 1);
    return map;
  };

  DM.mapAt = function (map, x, y) {
    if (!(x >= 0 && y >= 0 && x < W && y < H)) return null;
    return DM.BIOMES[map.cells[Math.floor(y * MR) * W * MR + Math.floor(x * MR)]];
  };
})(globalThis.DM = globalThis.DM || {});
