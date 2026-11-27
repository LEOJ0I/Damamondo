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

  // Altitudine nel punto (x, y): rumore a più scale, che scende verso i bordi (sempre mare).
  function elevation(map, x, y) {
    const { nz } = map.n, f = ISF[map.opts.isl];
    const d0 = Math.min(x, y, W - x, H - y), fe = Math.min(1, d0 / 9), se = fe * fe * (3 - 2 * fe);
    const b = nz(x, y, f[0]) * .5 + nz(x, y, f[1]) * .4 + nz(x, y, f[2]) * .1;
    let e = (.5 + (b - .5) * 1.5) * se;
    // gen 5, "Poche isole": un grande continente (un rialzo largo vicino al centro) e il mare regolato per avere circa il 40% di terra
    if (map.cont) e += map.cont.bias(x, y) - map.cont.shift;
    return e;
  }

  // Bioma nel punto (x, y) in cm, al giro "round".
  function biome(map, x, y, round) {
    const { isl, hum, temp, comp, gen } = map.opts, { nz } = map.n, f = ISF[isl];
    if (x < SEA_BORDER || y < SEA_BORDER || x > W - SEA_BORDER || y > H - SEA_BORDER) return 'S';
    const d0 = Math.min(x, y, W - x, H - y);
    const e = elevation(map, x, y);  // altitudine
    if (e < f[3]) {
      const ice = comp > 1 && (nz(x + 600, y + 600, .1) * .8 + nz(x + 650, y + 650, .35) * .2) >
        .74 - (temp - 2) * .08 - (comp - 2) * .03 +
        // gen 3: la Banchisa sparisce piano piano prima del bordo, che resta sempre mare aperto
        (gen >= 3 ? Math.max(0, 5 - d0) * .22 : Math.max(0, 3 - d0) * .1);
      return ice ? 'I' : 'S';
    }
    if (Math.abs(nz(x + 400, y + 400, .07) - .6) < RW[hum] ||
      (hum > 2 && Math.abs(nz(x + 500, y + 500, .09) - .5) < RW[hum] * .6) ||
      nz(x + 300, y + 300, .22) > LK[hum]) return 'F';
    for (let i = 0; i < map.volc.length; i++) {
      const v = map.volc[i], d = Math.hypot(x - v[0], y - v[1]);
      const active = map.erupt.some(z => z.v === i && z.until > round);
      if (comp > 1 && (d < .4 || (active && d < 2.1))) return 'Z';
      // gen 4: con varietà estrema ed estremissima la lava è più estesa e le colate arrivano più lontano
      const more = gen >= 4 ? comp - 2 : 0, flow = 1.7 + more * .45, thr = v[3] - more * .07;
      if (d < 1.1) return comp > 1 && v[2] && nz(x + 800, y + 800, .9) > thr ? 'Z' : 'V';
      if (comp > 1 && v[2] && d < flow && nz(x + 800, y + 800, .7) > thr + .05) return 'Z';
    }
    // gen 5: il rialzo del continente conta poco per le montagne (altrimenti il centro sarebbe tutto Alta montagna)
    const em = map.cont ? e - map.cont.bias(x, y) * .8 : e;
    if (em > .78) return 'A';
    if (em > .7) return 'M';
    if (comp > 1 && nz(x + 700, y + 700, .09) > .77 - (temp - 2) * .08 - (comp - 2) * .04) return 'H';
    if (comp > 0 && comp < 4 && nz(x + 200, y + 200, .1) > .76 - (temp - 2) * .07 + (comp == 1 ? .06 : 0)) return 'T';
    if (comp > 0 && nz(x + 900, y + 900, .08) > DT[temp]) return 'D';
    return moisture(comp, nz(x + 50, y + 50, .09) + HOFF[hum]);
  }

  DM.makeMap = function (opts, seed) {
    // gen: versione del generatore. Le partite salvate prima del 25/11/2026 non ce l'hanno (= 1) e tengono la loro mappa.
    // gen 2 (25/11/2026): più vulcani nelle mappe calde. gen 3: Banchisa lontana dai bordi, nessun minimo nelle mappe fredde.
    // gen 4: niente vulcani con varietà semplice; minimo 1/2/3 con media/estrema/estremissima; lava più estesa.
    // gen 5 (27/11/2026): con "Poche isole" un grande continente e circa il 40% di terra (prima poteva essere dal 15% al 47%).
    const map = { opts: Object.assign({ isl: 1, hum: 2, temp: 2, comp: 2, gen: 5 }, opts), seed, n: noise(seed),
      volc: [], erupt: [], cells: new Uint8Array(W * MR * H * MR), version: 0 };
    const { h } = map.n, { comp, temp, gen } = map.opts;
    if (gen >= 5 && map.opts.isl == 0) {
      const cx = W / 2 + (h(31, 17) - .5) * 12, cy = H / 2 + (h(19, 43) - .5) * 8;
      map.cont = { bias: (x, y) => .24 * Math.exp(-(((x - cx) / 16) ** 2 + ((y - cy) / 11) ** 2)), shift: 0 };
      const vals = [];
      for (let y = .25; y < H; y += .5) for (let x = .25; x < W; x += .5) vals.push(elevation(map, x, y));
      vals.sort((a, b) => a - b);
      const land = .4 + (h(5, 9) - .5) * .06;   // tra il 37% e il 43% di terra
      map.cont.shift = vals[Math.floor((1 - land) * vals.length)] - ISF[0][3];
    }
    const ok = (x, y) => !'SFIAM'.includes(biome(map, x, y, 1)) && map.volc.every(v => Math.hypot(v[0] - x, v[1] - y) >= 8);
    const add = (x, y, a, b) => map.volc.push([x, y, h(a + 2, b + 7) > .25, .5 + h(a + 9, b + 3) * .3]);
    // Vulcani: al massimo uno per riquadro di 14 cm
    for (let gx = 0; gx < W - 8; gx += 14) {
      for (let gy = 0; gy < H - 8; gy += 14) {
        if ((gen >= 4 ? comp > 1 : comp > 0) && h(gx * 3.1 + 9, gy * 2.7 + 4) > [1.1, .7, .55, .5, .35][comp] + (temp - 2) * .06) {
          // gen 2, mappe calde: se il primo punto è mare o montagna si provano altri punti del riquadro
          for (let t = 0; t < (gen >= 2 && temp <= 1 ? 3 : 1); t++) {
            const x = gx + 3 + h(gx + t * 17, gy + 1) * 8, y = gy + 3 + h(gx + 5, gy + t * 13) * 8;
            if (gen >= 2 ? ok(x, y) : !'SFIAM'.includes(biome(map, x, y, 1))) { add(x, y, gx, gy); break; }
          }
        }
      }
    }
    // gen 2: con varietà da media in su almeno 1 vulcano; nelle mappe calde con varietà estrema o estremissima almeno 2
    if (gen >= 2 && comp > 1) {
      const min = gen >= 3 && temp >= 3 ? 0                    // gen 3: nelle mappe fredde nessun minimo
        : gen >= 4 ? comp - 1                                   // gen 4: 1 media, 2 estrema, 3 estremissima
          : temp <= 1 && comp >= 3 ? 2 : 1;
      for (let k = 0; k < 400 && map.volc.length < min; k++) {
        const x = 4 + h(k * 3.7, 11) * (W - 8), y = 4 + h(13, k * 5.3) * (H - 8);
        if (ok(x, y)) add(x, y, k, k * 2);
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
    if (!map.custom && (map.opts.gen || 1) >= 3) removeIceCrumbs(map);
    map.version++;
  };

  // gen 3: i pezzetti di Banchisa più piccoli di 0,6 cm² diventano mare (niente briciole di ghiaccio)
  function removeIceCrumbs(map) {
    const w = W * MR, I = DM.BIOMES.indexOf('I'), S = DM.BIOMES.indexOf('S'), c = map.cells;
    const seen = new Uint8Array(c.length), stack = [];
    for (let k = 0; k < c.length; k++) {
      if (c[k] !== I || seen[k]) continue;
      const part = [];
      stack.push(k); seen[k] = 1;
      while (stack.length) {
        const q = stack.pop(), x = q % w;
        part.push(q);
        for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, q - w, q + w]) {
          if (n >= 0 && n < c.length && !seen[n] && c[n] === I) { seen[n] = 1; stack.push(n); }
        }
      }
      if (part.length < 60) part.forEach(q => { c[q] = S; });
    }
  }

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
