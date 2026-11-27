// Damamondo – le mappe segrete (Easter egg). Nessun DOM qui.
// Numero mappa 0 con le opzioni giuste: la Terra di oggi e la Terra com'era davvero in altre epoche.
// Altri numeri (con qualsiasi opzione): posti e momenti veri (39 = prefisso dell'Italia, 1492 = Colombo…).
// I biomi stanno dove sono (o erano) davvero: deserti, giungle, ghiacci, montagne, fiumi, laghi e vulcani,
// scritti con le coordinate vere (longitudine, latitudine) e approssimati alla scala della mappa.
(function (DM) {
  'use strict';
  const { W, H, MR } = DM;
  const CW = 240, CH = 168, CR = 4;                 // griglia delle maschere: 0,25 cm
  const FW = W * MR, FH = H * MR;                    // griglia dei biomi: 1 mm
  const MED = o => o.isl == 1 && o.hum == 2 && o.temp == 2 && o.comp == 2;
  const only = (o, k, v) => Object.keys({ isl: 1, hum: 2, temp: 2, comp: 2 }).every(z => z === k ? o[z] == v : o[z] == { isl: 1, hum: 2, temp: 2, comp: 2 }[z]);

  // ---------- l'elenco ----------
  const LIST = [
    { id: 'oggi', n: 0, ok: MED, name: 'la Terra di oggi', emoji: '🌍' },
    { id: 'pangea', n: 0, ok: o => only(o, 'isl', 0), name: 'la Pangea (250 milioni di anni fa)', emoji: '🦕' },
    { id: 'glaciale', n: 0, ok: o => only(o, 'temp', 4), name: 'l’ultima era glaciale (20.000 anni fa)', emoji: '❄️' },
    { id: 'cretaceo', n: 0, ok: o => only(o, 'temp', 0), name: 'la Terra dei dinosauri (Cretaceo, 90 milioni di anni fa)', emoji: '🦖' },
    { id: 'saharaverde', n: 0, ok: o => only(o, 'hum', 4), name: 'il Sahara verde (6.000 anni fa)', emoji: '🌿' },
    { id: 'anello', n: 0, ok: o => only(o, 'comp', 4), name: 'l’Anello di fuoco: i vulcani veri della Terra', emoji: '🌋' },
    { id: 'italia', n: 39, name: 'l’Italia (39 è il suo prefisso)', emoji: '🇮🇹' },
    { id: 'napoli', n: 79, name: 'il Golfo di Napoli nell’anno 79, quando il Vesuvio seppellì Pompei', emoji: '🌋' },
    { id: 'mediterraneo', n: 753, name: 'il Mediterraneo dei Romani (Roma nasce nel 753 a.C.)', emoji: '🏛️' },
    { id: 'atlantico', n: 1492, name: 'l’Atlantico di Cristoforo Colombo (1492)', emoji: '⛵' },
    { id: 'nordatlantico', n: 1912, name: 'il Nord Atlantico del Titanic (1912), con i ghiacci', emoji: '🧊' },
    { id: 'himalaya', n: 8848, name: 'l’Himalaya (8848 metri: l’Everest)', emoji: '🏔️' },
    { id: 'alpi', n: 4808, name: 'le Alpi (4808 metri: il Monte Bianco)', emoji: '⛰️' },
    { id: 'luna', n: 1969, name: 'la Luna (1969: il primo sbarco)', emoji: '🌕' }
  ];
  DM.SECRETS = LIST.map(s => ({ id: s.id, name: s.name, emoji: s.emoji }));
  // Quale mappa segreta per queste opzioni e questo numero (o null)
  DM.secretFor = (opts, seed) => LIST.find(s => s.n === seed && (!s.ok || s.ok(opts))) || null;
  DM.secretInfo = id => DM.SECRETS.find(s => s.id === id) || null;

  // ---------- attrezzi ----------
  const decode = rle => {
    const m = new Uint8Array(CW * CH);
    rle.split(';').forEach((row, j) => { let i = 0, v = 0; row.split(',').forEach(r => { const n = parseInt(r, 36); if (v) m.fill(1, j * CW + i, j * CW + i + n); i += n; v ^= 1; }); });
    return m;
  };
  // proiezione: longitudine/latitudine ↔ cm della mappa
  const proj = v => ({
    x: lon => (lon - v[0]) / (v[1] - v[0]) * W, y: lat => (lat - v[2]) / (v[3] - v[2]) * H,
    lon: x => v[0] + x / W * (v[1] - v[0]), lat: y => v[2] + y / H * (v[3] - v[2]),
    cm: Math.abs(W / (v[1] - v[0]))   // cm per grado (in orizzontale)
  });
  function inPoly(pts, a, b) {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > b) !== (yj > b) && a < (xj - xi) * (b - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  function segDist(px, py, [ax, ay], [bx, by]) {
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  }
  const lineDist = (pts, x, y) => { let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x, y, pts[i - 1], pts[i])); return d; };
  const code = b => DM.BIOMES.indexOf(b);

  // Regole "a zone": ognuna dice un bioma e dove (in gradi). Si guarda in ordine: vince la prima che contiene il punto.
  //  {b, p: [[lon,lat]…]} poligono · {b, e: [lon, lat, raggioLon, raggioLat]} ellisse · {b, l: [[lon,lat]…], w: gradi} linea con larghezza
  //  {b, f: (lon, lat) => vero/falso} funzione. "sea: true": vale per il mare (banchisa); le altre per la terra.
  function zone(rules, lon, lat, sea) {
    for (const r of rules) {
      if (!r.any && !!r.sea !== sea) continue;   // "any": vale per terra e mare (i laghi)
      if (r.p && inPoly(r.p, lon, lat)) return r.b;
      if (r.e && ((lon - r.e[0]) / r.e[2]) ** 2 + ((lat - r.e[1]) / r.e[3]) ** 2 <= 1) return r.b;
      if (r.l && lineDist(r.l, lon, lat) <= r.w) return r.b;
      if (r.f && r.f(lon, lat)) return r.b;
    }
    return sea ? 'S' : 'P';
  }

  // ---------- la Terra (oggi): zone in gradi ----------
  const RIVERS = [
    [[33, -1], [32.6, 3.5], [31.6, 9.5], [32.5, 15.6], [33.5, 18], [32.9, 21.8], [31.3, 25.5], [31.2, 30.5]],                  // Nilo
    [[-77, -4.5], [-73, -4.2], [-70, -3.4], [-65, -3.6], [-60, -3.2], [-55, -2.3], [-52, -1.6], [-50, -.3]],                   // Rio delle Amazzoni
    [[-95, 47.3], [-93, 44.9], [-91, 42], [-90.2, 38.6], [-89.6, 35], [-91, 32], [-90.6, 30], [-89.4, 29.2]],                // Mississippi
    [[-111, 45.9], [-104, 47.8], [-100.8, 46.8], [-96.5, 42.5], [-94.6, 39.1], [-90.2, 38.8]],                                // Missouri
    [[26.5, -8], [25.2, .5], [22, 1.8], [18, 1.2], [16.4, -1.5], [15.3, -4.3], [12.3, -6]],                                   // Congo
    [[-10.8, 10.9], [-8, 12.6], [-4, 14.4], [-3, 16.7], [0, 16.5], [2.3, 14], [4.4, 11.5], [6.5, 8], [6.2, 4.4]],             // Niger
    [[91, 33.5], [97, 32.5], [100, 28], [104, 28.8], [107, 29.7], [111.5, 30.4], [114.3, 30.6], [117, 31], [121.4, 31.4]],    // Fiume Azzurro
    [[96.5, 34.5], [103.6, 36], [106.8, 40], [110, 40.6], [110.5, 35], [114, 34.8], [117, 36.6], [118.9, 37.7]],             // Fiume Giallo
    [[78.5, 30], [80.3, 26.5], [83, 25.3], [87, 25.2], [88.5, 22.5]],                                                         // Gange
    [[79, 32.5], [75, 35], [72.5, 33.7], [71, 30.3], [68.5, 26], [67.5, 24]],                                                 // Indo
    [[33, 57], [38, 57.6], [44, 56.3], [48, 55.8], [49, 53.2], [46.5, 48.5], [47.8, 46.5]],                                   // Volga
    [[8.5, 48], [12, 48.7], [16.4, 48.2], [18.9, 47.5], [20.3, 44.8], [22.5, 44.2], [26, 43.7], [28, 44.5], [29.6, 45.2]],    // Danubio
    [[9.5, 47.5], [7.6, 47.6], [8.4, 49], [7.6, 50.4], [6.8, 51.2], [4.2, 51.9]],                                             // Reno
    [[7.3, 44.9], [8.6, 45.1], [10.6, 45.05], [12.55, 44.95]],                                                               // Po
    [[12, 43.8], [12.45, 42.7], [12.5, 42], [12.25, 41.73]],                                                                 // Tevere
    [[6.2, 46.2], [4.8, 45.7], [4.8, 44], [4.7, 43.4]],                                                                       // Rodano
    [[-3.8, 43], [-1.5, 42.1], [.8, 40.7]],                                                                                   // Ebro
    [[94, 33], [99, 29.5], [100.3, 22], [102.5, 18], [105.8, 15.2], [105.9, 11.5], [106.7, 9.8]],                            // Mekong
    [[86, 51], [84, 55.5], [80, 60.5], [69, 61], [66.5, 66.5]],                                                               // Ob
    [[93, 51.5], [92.5, 56], [90.5, 60], [87, 65], [86.5, 69.5]],                                                             // Enisej
    [[107, 55], [113, 58], [123, 60.5], [129.7, 62], [127, 68], [127, 72.5]],                                                 // Lena
    [[-117, 61], [-121.5, 62.5], [-124, 65.3], [-134, 68.5]],                                                                 // Mackenzie
    [[-47, -19.5], [-51.5, -22.7], [-54.6, -25.5], [-58.6, -27.4], [-59.3, -31], [-58.4, -34]],                               // Paraná
    [[148, -36.5], [144, -35.8], [140.5, -34.2], [139.3, -35.4]],                                                             // Murray
    [[24, -12], [23.5, -15.8], [25.8, -17.9], [28, -16.5], [31.5, -15.6], [35.5, -17.5], [36.3, -18.8]],                     // Zambesi
    [[-65, 3], [-67.5, 6], [-64, 8], [-61, 8.6]],                                                                             // Orinoco
    [[-76.5, 44.2], [-73.5, 45.5], [-71.2, 46.8], [-68, 48.5]],                                                               // San Lorenzo
    [[38.5, 38.5], [40, 36], [43.5, 33], [46, 31], [48, 30]]                                                                  // Tigri ed Eufrate
  ];
  const LAKES0 = [
    { b: 'F', p: [[46.7, 44.6], [47.5, 45.6], [49, 46.6], [51, 47], [53.3, 45.3], [52.8, 42.5], [54, 40.5], [53.9, 37.4], [51, 36.6], [49, 37.7], [48.6, 40.3], [49.5, 41], [47.5, 43]] },  // Caspio
    { b: 'F', e: [-87.5, 47.6, 3.2, 1] }, { b: 'F', e: [-87, 44, .8, 2.2] }, { b: 'F', e: [-82.3, 44.8, 1.5, 1.3] }, { b: 'F', e: [-81.2, 42.2, 2, .5] }, { b: 'F', e: [-77.8, 43.6, 1.4, .4] },  // Grandi Laghi
    { b: 'F', e: [33, -1, 1.4, 1.4] }, { b: 'F', l: [[103.7, 51.6], [109.9, 55.7]], w: .5 }, { b: 'F', e: [60, 45, 1.3, 1] },  // Vittoria, Bajkal, Aral
    { b: 'F', l: [[29.3, -3.3], [31.2, -8.7]], w: .45 }, { b: 'F', e: [31.5, 60.8, 1.2, .8] }, { b: 'F', e: [-69.4, -15.8, .7, .5] },
    { b: 'F', e: [-121, 66, 2.5, 1] }, { b: 'F', e: [-114.5, 61.5, 2.5, .7] }, { b: 'F', l: [[-97.8, 50.5], [-98.5, 53.7]], w: .5 }, { b: 'F', l: [[73.5, 46.2], [79, 46.8]], w: .4 },
    { b: 'F', e: [12.3, 45.4, .1, .12] }, { b: 'F', e: [10.65, 45.65, .12, .3] }, { b: 'F', e: [6.55, 46.45, .35, .1] }  // laguna di Venezia, Garda, Lemano
  ];
  const LAKES = LAKES0.map(r => Object.assign({ any: true }, r));
  // montagne (le alte prima), deserti, giungle, paludi; le larghezze sono in gradi
  const ANDES = [[-78.5, 1], [-77.5, -6], [-75.5, -11], [-71, -15], [-68.5, -19], [-68.2, -24], [-69.8, -30], [-70.3, -33], [-71, -39], [-72, -46], [-73.3, -50]];
  const ALPS = [[7.2, 44.2], [7, 45], [6.9, 45.85], [7.8, 45.95], [8.5, 46.4], [9.8, 46.4], [10.5, 46.5], [11.8, 46.7], [12.7, 47.05], [13.8, 47.1], [15.5, 47.6]];
  const APENNINES = [[8.6, 44.45], [10, 44.3], [11.2, 44.05], [12.1, 43.6], [13, 42.9], [13.55, 42.45], [14.1, 42], [14.8, 41.3], [15.4, 40.6], [16.2, 39.9], [16.3, 39], [15.9, 38.3]];
  const HIGH = [
    { b: 'A', p: [[73, 37], [77, 36.5], [80, 35.8], [86, 35.2], [92, 35], [98, 33.5], [99, 30], [97, 28], [92, 27.5], [88, 27.5], [84, 28.2], [80.5, 29.5], [77, 31.2], [74.5, 34]] },  // Himalaya e Tibet
    { b: 'A', p: [[67, 37.5], [71, 39.5], [75, 39.5], [77, 36.5], [73, 35], [70, 35.5]] },                                  // Pamir e Hindu Kush
    { b: 'A', p: [[-71, -14.5], [-66, -15.5], [-65.5, -21], [-67.5, -24], [-69, -22], [-70.5, -17]] },                      // Altipiano andino
    { b: 'A', l: ANDES, w: .9 }, { b: 'A', l: ALPS, w: .3 }
  ];
  const MOUNT = [
    { b: 'M', l: ANDES, w: 2.2 }, { b: 'M', l: ALPS, w: .9 }, { b: 'M', l: APENNINES, w: .45 },
    { b: 'M', l: [[-138, 61], [-125, 57], [-117, 52], [-113, 48], [-110, 44], [-106.5, 40], [-105.5, 36], [-107, 32]], w: 2.2 },  // Montagne Rocciose
    { b: 'M', l: [[-123, 49], [-121.5, 44], [-120, 38.5]], w: .8 },                                                         // Cascate e Sierra Nevada
    { b: 'M', l: [[-108, 30], [-104, 24], [-100, 20], [-97, 17.5]], w: 1.2 },                                               // Sierra Madre
    { b: 'M', l: [[-85, 34], [-81, 37], [-78, 39.5], [-75, 41.8], [-71, 44.2], [-68, 46]], w: 1 },                          // Appalachi
    { b: 'M', l: [[-1.5, 43], [3, 42.5]], w: .45 }, { b: 'M', l: [[17.5, 48.5], [22, 49.2], [25, 47.8], [26, 45.6], [22.5, 45]], w: .6 },  // Pirenei, Carpazi
    { b: 'M', l: [[38, 44.5], [42, 43.3], [46, 42], [49.5, 40.5]], w: .8 }, { b: 'M', l: [[45.5, 37], [48, 33.5], [51, 30], [55, 27.5]], w: 1.3 },  // Caucaso, Zagros
    { b: 'M', l: [[59.5, 51.5], [59, 56], [59.5, 61], [63, 67.5], [66, 69]], w: .7 }, { b: 'M', l: [[6.5, 58.5], [8.5, 61.5], [12.5, 63.5], [15, 66.5], [18.5, 68.5], [22, 70]], w: 1.2 },  // Urali, Alpi scandinave
    { b: 'M', l: [[-9.5, 30.5], [-5, 32], [-1, 33.5], [3, 35.5], [9, 36.5]], w: .9 }, { b: 'M', e: [39, 10, 4, 4] },       // Atlante, altopiano etiopico
    { b: 'M', l: [[70, 42.3], [76, 42], [80, 42.5], [86, 43.5], [90, 46.5], [90, 49.5], [87, 49.5]], w: 1.6 },              // Tien Shan e Altaj
    { b: 'M', l: [[145.5, -16], [147, -22], [151, -29], [149.5, -34], [147, -37.5]], w: .9 },                               // Grande Catena Divisoria
    { b: 'M', l: [[167, -46], [171, -43.5], [173, -41.5]], w: .6 }, { b: 'M', l: [[-153, 63], [-147, 63.4], [-141, 61.5]], w: 1.2 },  // Alpi neozelandesi, Alaska
    { b: 'M', l: [[27, -31], [29.5, -29], [31, -26]], w: .6 }, { b: 'M', l: [[29.5, 37], [33, 37.2], [36.5, 37.5], [40, 38.5]], w: .7 },  // Drakensberg, Tauro
    { b: 'M', l: [[14.5, 45.8], [15.5, 44.8], [17, 43.8], [18.5, 42.8], [19.8, 42.2], [20.5, 41.2], [21.2, 39.5]], w: .6 },  // Dinaridi e Pindo
    { b: 'M', l: [[138, 36.5], [137.8, 35.5]], w: .6 }                                                                       // Alpi giapponesi
  ];
  const DESERT = [
    { b: 'D', p: [[-17, 21], [-16, 27], [-12, 29], [-5, 30.5], [2, 31.5], [9, 32], [11, 30.5], [20, 30.8], [29, 30.8], [33, 29], [35, 24], [37, 19], [34, 15.5], [27, 15], [20, 15.5], [14, 15.5], [5, 16], [-5, 15.5], [-12, 16], [-16.5, 17]] },  // Sahara
    { b: 'D', p: [[34.8, 29.5], [39, 32], [44, 31], [47.5, 29.8], [50, 26], [56, 24.5], [59, 22.3], [55, 17.5], [52, 16.5], [45, 13.5], [43, 15.5], [39, 21], [36, 26]] },  // Arabia
    { b: 'D', p: [[50, 35], [55, 35.8], [60, 35.5], [61.5, 31], [63, 28], [70, 28.5], [73.5, 27], [72, 24.5], [68, 24], [62, 25.5], [57, 27], [53, 30], [51, 32.5]] },  // Iran e Thar
    { b: 'D', p: [[52.5, 42], [56, 45], [62, 46], [67, 45], [68, 41], [63, 38], [58, 37.5], [54, 38]] }, { b: 'D', e: [83, 39, 7, 2.3] },  // Karakum, Taklamakan
    { b: 'D', p: [[92, 45], [98, 46.5], [106, 45.3], [112, 44], [114, 42.5], [106, 40], [99, 40], [94, 41.5]] },             // Gobi
    { b: 'D', p: [[114.5, -21.5], [118, -20], [126, -19.5], [132, -18], [138, -19.5], [143, -23], [146, -27.5], [143, -31], [138, -31.5], [133, -31.5], [126, -31], [120, -30], [116, -27]] },  // Australia
    { b: 'D', p: [[12, -17], [15, -17.5], [21, -19.5], [25, -21], [27, -24.5], [24, -27.5], [20, -29.5], [16.5, -29], [15, -26], [13, -21]] },  // Kalahari e Namib
    { b: 'D', p: [[-71, -17.5], [-69, -18], [-68.5, -26], [-70.5, -29], [-71.5, -27]] },                                      // Atacama
    { b: 'D', p: [[-120, 36], [-115, 40], [-112, 41.5], [-108, 38], [-106, 33], [-104, 29], [-102, 26], [-106, 24], [-110, 26], [-114, 30], [-117, 32.5]] },  // deserti nordamericani
    { b: 'D', p: [[41, 11], [44, 10.5], [51, 11.8], [50, 6], [47, 4], [42, 2], [40, 4]] }                                    // Corno d'Africa
  ];
  const JUNGLE = [
    { b: 'G', p: [[-79, 2], [-75, 6], [-67, 6], [-60, 6.5], [-53, 4], [-50, 1.5], [-46, -2], [-44, -4], [-47, -8], [-55, -12], [-63, -13], [-69, -12.5], [-74, -10], [-77, -5]] },  // Amazzonia
    { b: 'G', p: [[-92, 18.5], [-88, 18], [-83, 15], [-80, 9], [-77, 8], [-79, 9.5], [-84, 11], [-87, 13.5], [-91, 15]] },   // America centrale
    { b: 'G', p: [[-13, 9.5], [-8, 8], [-2, 7], [3, 7], [9, 6.5], [13, 5], [18, 5.5], [24, 5], [30, 3], [30.5, -2], [28, -6], [22, -6.5], [17, -5], [12.5, -5], [9, -1], [9.5, 3], [6, 4.3], [-2, 4.7], [-8, 4.5], [-13, 7.5]] },  // Congo e Africa occidentale
    { b: 'G', p: [[92, 21], [97, 21], [100, 20.5], [106, 21], [108, 17], [109, 12], [105, 9], [100, 7], [99, 2], [104, 1], [110, -1], [115, -3], [120, -3], [125, -7], [141, -5], [150, -6], [155, -6], [152, -10], [143, -9], [135, -5], [129, -8], [120, -9], [113, -8.5], [106, -7], [100, -3], [95, 3], [97, 9], [97.5, 16]] },  // Sud-est asiatico
    { b: 'G', p: [[108.5, 2], [111, 7.5], [117.5, 7.2], [119.5, 5], [118, -1], [116, -4.5], [110, -3.5]] }, { b: 'G', p: [[95, 5.8], [98, 4], [104, -2], [106, -6], [102, -5.5], [96, 1]] },  // Borneo, Sumatra
    { b: 'G', p: [[118, 5], [127, 6], [126, 13], [124, 18], [120, 18.5], [118, 10]] }, { b: 'G', p: [[89, 27.5], [96, 28], [95, 22], [92, 21.5]] },  // Filippine, India nord-est
    { b: 'G', p: [[48, -14], [50, -15], [49.5, -20], [47, -25], [46.5, -24], [48, -18]] }, { b: 'G', p: [[143, -11], [146, -15], [146.5, -19], [145, -17], [143, -14]] }
  ];
  const SWAMP = [
    { b: 'L', e: [-57, -18, 2.2, 2] }, { b: 'L', e: [89.5, 22, 1.6, .8] }, { b: 'L', p: [[64, 59], [66, 64], [78, 66], [86, 64], [82, 58], [72, 56]] },  // Pantanal, Sundarbans, Siberia
    { b: 'L', e: [30.5, 8, 2.5, 2] }, { b: 'L', e: [-80.8, 26, .9, 1] }, { b: 'L', e: [22.7, -19.3, 1.3, 1] }, { b: 'L', e: [47, 31, 1.2, .8] },  // Sudd, Everglades, Okavango, Mesopotamia
    { b: 'L', p: [[-95, 57.5], [-90, 57], [-82, 55], [-80, 51.5], [-86, 52.5], [-93, 55]] }, { b: 'L', e: [12.25, 44.8, .18, .15] }  // Baia di Hudson, delta del Po
  ];
  const ICE = [{ b: 'H', f: (lon, lat) => lat < -63 }, { b: 'H', p: [[-74, 76], [-60, 82], [-30, 84], [-10, 82], [-18, 75], [-21, 70], [-32, 68], [-40, 64], [-43, 59.5], [-50, 61], [-54, 66], [-58, 75]] }];
  const TUNDRA = [{ b: 'T', f: (lon, lat) => lat > 66 || (lat > 60 && (lon < -60 || lon > 60)) || (lat > 58 && lon > 140) }];
  const SEA_ICE = [{ b: 'I', sea: true, f: (lon, lat) => lat > 78 || lat < -65 }];
  const today = (extra) => [].concat(extra || [], LAKES, ICE, HIGH, MOUNT, DESERT, JUNGLE, SWAMP, TUNDRA, SEA_ICE);

  // vulcani veri: [lon, lat, con la lava (Lavico)]
  const V_TODAY = [[15, 37.75, 1], [138.7, 35.4, 0], [105.4, -6.1, 1], [-98.6, 19, 1], [37.35, -3.07, 0], [-19.7, 63.98, 1]];
  const V_RING = V_TODAY.concat([[14.43, 40.82, 1], [130.66, 31.58, 1], [120.35, 15.13, 0], [123.69, 13.26, 1], [110.45, -7.54, 1], [118, -8.25, 0],
    [175.57, -39.28, 1], [160.64, 56.06, 1], [-163.97, 54.75, 1], [-153.43, 59.36, 0], [-122.18, 46.2, 0], [-103.62, 19.51, 1], [-90.88, 14.47, 1],
    [-84.7, 10.46, 1], [-78.44, -.68, 0], [-71.41, -16.29, 0], [-71.94, -39.42, 1], [-155.29, 19.41, 1], [29.25, -1.52, 1], [40.67, 13.6, 1], [-16.64, 28.27, 0]]);

  // Era glaciale: ponti di terra (mare più basso di 120 m), calotte di ghiaccio, banchisa più a sud
  const BRIDGES = [
    [[95, 6], [100, 8], [105, 10], [109, 9], [110, 4], [117, 6], [119, 1], [117, -4], [115, -8.5], [110, -8], [105, -6.5], [101, -3], [96, 3]],  // Sonda
    [[130, -9], [136, -6], [142, -8.5], [147, -9.5], [142, -12], [136, -12], [131, -11]], [[143.5, -38.5], [148.5, -38.5], [148.5, -40.5], [144, -40.5]],  // Sahul, stretto di Bass
    [[-6, 51], [-5, 49.5], [3, 50.5], [8, 53.5], [8, 55.5], [4, 56], [-1, 56], [-6, 55]],                                     // Doggerland: Gran Bretagna unita all'Europa
    [[48, 30], [51, 27], [56, 26], [56, 24.5], [51.5, 24], [49, 27]], [[117, 40], [122, 40.5], [126, 37], [127, 33], [124, 28], [121, 28], [119, 32], [118, 37]],  // Golfo Persico, Mar Giallo
    [[-81.5, 25], [-79, 27], [-77, 26], [-78, 24]], [[-68, -55], [-64, -55], [-58, -52], [-56, -46], [-58, -40], [-62, -40], [-66, -44], [-66, -48]],  // Florida, Patagonia
    [[105, 73], [140, 73], [150, 72], [150, 76], [110, 77]], [[-169, 63], [-160, 60], [-157, 58], [-163, 54], [-169, 55]], [[178, 62], [191, 63], [191, 56], [178, 58]]  // Siberia, Beringia (ai due bordi)
  ];
  const ICE_AGE = [
    { b: 'H', f: (lon, lat) => lat < -60 }, ICE[1],
    { b: 'H', p: [[-140, 60], [-135, 58], [-128, 50], [-123, 47], [-118, 48], [-110, 48.5], [-102, 46], [-97, 43], [-93, 40], [-89, 38], [-85, 39], [-82, 40], [-78, 41], [-73, 41], [-70, 42], [-63, 44], [-55, 47], [-52, 52], [-60, 60], [-75, 64], [-80, 70], [-90, 77], [-110, 80], [-130, 76], [-140, 69]] },  // Laurentide e Cordigliera
    { b: 'H', p: [[-11, 54], [-6, 51.5], [-2, 52], [2, 53], [8, 53], [13, 52.5], [20, 52.5], [26, 54], [32, 57], [38, 60], [44, 63], [52, 64], [60, 67], [66, 72], [60, 78], [30, 81], [12, 81], [0, 72], [-8, 62], [-12, 57]] },  // Fennoscandia e Isole britanniche
    { b: 'H', p: [[-76, -38], [-71, -38], [-71, -56], [-76, -56]] }, { b: 'H', e: [10, 46.3, 4, 1.2] }                       // Patagonia, Alpi
  ];
  const ICE_AGE_SEA = [{ b: 'I', sea: true, f: (lon, lat) => lat > 58 || lat < -52 || (lat > 46 && lon > -65 && lon < 10) }];
  const COLD = [{ b: 'T', f: (lon, lat) => (lat > 44 && lon > -12 && lon < 140) || (lat > 36 && lon > -125 && lon < -60) || lat > 60 }];
  const DRY = [
    { b: 'D', p: [[-17, 18], [-16, 30], [-10, 33], [10, 34], [33, 32], [37, 25], [40, 14], [30, 12], [15, 12], [0, 13], [-12, 13]] },  // Sahara più grande
    { b: 'G', p: [[-72, 0], [-60, 2], [-52, 1], [-55, -5], [-65, -8], [-72, -6]] }, { b: 'G', p: [[12, 3], [24, 3], [28, 0], [24, -3], [14, -2]] },  // foreste rifugio
    { b: 'G', p: [[95, 5], [119, 6], [118, -4], [105, -6], [100, -2]] }
  ];
  // Sahara verde: savana, il Mega-Ciad, il lago Fezzan e fiumi oggi scomparsi
  const GREEN = [
    { b: 'F', e: [17, 15.5, 4.5, 3.5] }, { b: 'F', e: [13, 26.5, 2, 1.5] }, { b: 'F', e: [36, 3.5, .9, 2.4] },               // Mega-Ciad, Fezzan, Turkana più grande
    { b: 'L', e: [-4, 14.5, 2, 1.3] }, { b: 'L', e: [17, 15.5, 6, 4.8] },                                                    // paludi del delta del Niger interno e attorno al Ciad
    { b: 'D', p: [[22, 23], [30, 23], [31, 30], [24, 30.5], [21, 27]] },                                                     // il Grande Mare di Sabbia resta deserto
    { b: 'P', p: [[-17, 15], [-16, 28], [-5, 31], [10, 33], [33, 31], [37, 18], [34, 14], [0, 14]] }, { b: 'P', p: [[34.8, 29.5], [47.5, 29.8], [59, 22.3], [52, 16.5], [43, 15.5], [36, 26]] }  // savana dove oggi c'è il deserto
  ];
  const GREEN_RIVERS = [[[5, 24], [0, 23], [-6, 21.5], [-12, 20.5], [-16.5, 20.2]], [[24, 17], [30, 17.8], [32.5, 18]], [[11, 24], [13, 26.5], [17, 30], [19, 30.8]]];

  // ---------- costruzione della griglia dei biomi ----------
  // landFine(x, y): terra o mare (con un po' di rumore per coste naturali); zone a 0,25 cm; fiumi e laghi a 1 mm
  function build(map, o) {
    const { nz } = map.n, P = o.view ? proj(o.view) : null;
    const cells = new Uint8Array(FW * FH), coarse = new Array(CW * CH);
    const jit = o.jit || .6;   // spostamento delle zone (gradi), per bordi naturali
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
      const x = (i + .5) / CR, y = (j + .5) / CR, land = o.mask[j * CW + i];
      if (P) {
        const lon = P.lon(x) + (nz(x + 33, y + 7, .7) - .5) * jit, lat = P.lat(y) + (nz(x + 71, y + 19, .7) - .5) * jit;
        coarse[j * CW + i] = zone(o.rules, lon, lat, !land);
      } else coarse[j * CW + i] = o.zone(x, y, !land);
    }
    // terra/mare a 1 mm: media dei quadratini vicini + rumore
    const m = o.mask, mv = (i, j) => m[Math.max(0, Math.min(CH - 1, j)) * CW + Math.max(0, Math.min(CW - 1, i))];
    for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
      const x = (i + .5) / MR, y = (j + .5) / MR, gx = x * CR - .5, gy = y * CR - .5, i0 = Math.floor(gx), j0 = Math.floor(gy), a = gx - i0, b = gy - j0;
      const v = mv(i0, j0) * (1 - a) * (1 - b) + mv(i0 + 1, j0) * a * (1 - b) + mv(i0, j0 + 1) * (1 - a) * b + mv(i0 + 1, j0 + 1) * a * b;
      const land = v + (nz(x + 5, y + 9, 2.2) - .5) * .35 > .5;
      // la zona: quella del quadratino (spostata un po' col rumore), ma terra resta terra e mare resta mare
      const ci = Math.max(0, Math.min(CW - 1, Math.floor((x + (nz(x, y, 1.6) - .5) * .5) * CR))), cj = Math.max(0, Math.min(CH - 1, Math.floor((y + (nz(x + 9, y, 1.6) - .5) * .5) * CR)));
      let z = coarse[cj * CW + ci];
      if (land && (z === 'S' || z === 'I')) z = coarse[Math.floor(y * CR) * CW + Math.floor(x * CR)];
      if (land && (z === 'S' || z === 'I')) z = 'P';
      if (!land && !'SIF'.includes(z)) z = P ? zone(o.rules, P.lon(x), P.lat(y), true) : o.zone(x, y, true);
      cells[j * FW + i] = code(z);
    }
    // fiumi (sulla terra) a 1 mm
    const F = code('F'), wr = o.riverW || .11;
    (o.rivers || []).forEach(line => {
      const pts = P ? line.map(([lo, la]) => [P.x(lo), P.y(la)]) : line;
      for (let k = 1; k < pts.length; k++) {
        const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
        for (let y = Math.min(ay, by) - wr; y <= Math.max(ay, by) + wr; y += 1 / MR) for (let x = Math.min(ax, bx) - wr; x <= Math.max(ax, bx) + wr; x += 1 / MR) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const idx = Math.floor(y * MR) * FW + Math.floor(x * MR);
          if (cells[idx] === code('S') || cells[idx] === code('I')) continue;
          if (segDist(x, y, [ax, ay], [bx, by]) <= wr) cells[idx] = F;
        }
      }
    });
    if (o.post) o.post(cells, P);
    return cells;
  }
  const dilate = (m, n) => { let a = m; for (let k = 0; k < n; k++) { const b = a.slice(); for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) if (!a[j * CW + i] && ((i > 0 && a[j * CW + i - 1]) || (i < CW - 1 && a[j * CW + i + 1]) || (j > 0 && a[(j - 1) * CW + i]) || (j < CH - 1 && a[(j + 1) * CW + i]))) b[j * CW + i] = 1; a = b; } return a; };
  const maskFrom = fn => { const m = new Uint8Array(CW * CH); for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) m[j * CW + i] = fn((i + .5) / CR, (j + .5) / CR) ? 1 : 0; return m; };
  // distanza dal mare (in quadratini da 0,25 cm)
  function coastDist(m) {
    const d = new Int16Array(CW * CH).fill(-1), q = [];
    for (let k = 0; k < m.length; k++) if (!m[k]) { d[k] = 0; q.push(k); }
    for (let h = 0; h < q.length; h++) { const k = q[h], i = k % CW; for (const n of [i > 0 ? k - 1 : -1, i < CW - 1 ? k + 1 : -1, k - CW, k + CW]) if (n >= 0 && n < m.length && d[n] < 0) { d[n] = d[k] + 1; q.push(n); } }
    return d;
  }
  const vToMap = (P, list, lavic) => list.map(([lo, la, z]) => [P.x(lo), P.y(la), !!(lavic === undefined ? z : lavic), .55]);

  // ---------- le mappe ----------
  const MASK = id => decode(DM.SECRET_MASKS[id].rle), VIEW = id => DM.SECRET_MASKS[id].view;
  const MAKERS = {
    oggi: map => { const v = VIEW('mondo'); map.volc = vToMap(proj(v), V_TODAY); return { view: v, mask: MASK('mondo'), rules: today(), rivers: RIVERS }; },
    anello: map => { const v = VIEW('mondo'); map.volc = vToMap(proj(v), V_RING); return { view: v, mask: MASK('mondo'), rules: today(), rivers: RIVERS }; },
    saharaverde: map => { const v = VIEW('mondo'); map.volc = vToMap(proj(v), V_TODAY); return { view: v, mask: MASK('mondo'), rules: today(GREEN), rivers: RIVERS.concat(GREEN_RIVERS) }; },
    glaciale: map => {
      const v = VIEW('mondo'), P = proj(v), base = dilate(MASK('mondo'), 1);
      const mask = maskFrom((x, y) => base[Math.floor(y * CR) * CW + Math.floor(x * CR)] || BRIDGES.some(p => inPoly(p, P.lon(x), P.lat(y))));
      map.volc = vToMap(P, V_TODAY);
      return { view: v, mask, rules: [].concat(LAKES.slice(0, 1), ICE_AGE, HIGH, DRY, MOUNT, DESERT, COLD, SWAMP, ICE_AGE_SEA), rivers: RIVERS.filter((r, i) => ![3, 21, 26].includes(i)) };
    },
    pangea: map => {
      // un solo supercontinente al centro, il mare della Tetide che entra da est, l'oceano Pantalassa tutto intorno
      const { nz } = map.n, wob = (x, y) => (nz(x * .9 + 3, y * .9, .35) - .5) * 1.8;
      // Laurasia (a nord) e Gondwana (a sud) sono un solo continente a ovest; a est si apre il mare della Tetide
      const LAUR = [[17, 5], [26, 3.5], [36, 4], [44, 6], [50, 9], [52, 13], [49, 16], [42, 17.5], [36, 18.5], [32, 20], [30, 24], [24, 25], [17, 25], [13, 20], [14, 11]];
      const GOND = [[14, 18], [22, 18], [29, 19], [31, 21], [34, 23], [37, 25], [40, 27], [42, 31], [40, 35], [34, 38.5], [26, 39.5], [18, 38], [13, 34], [11, 28], [12, 23]];
      const ISL = [[38, 21.5, 2, .7], [44, 21, 1.6, .6], [53, 17.5, 2.4, 1.4], [55.5, 12.5, 1.8, 1.6], [7, 12, .9, .6], [6, 30, .7, .5]];
      const mask = maskFrom((x, y) => { const a = x + wob(x, y), b = y + wob(y + 40, x); return inPoly(LAUR, a, b) || inPoly(GOND, a, b) || ISL.some(([cx, cy, rx, ry]) => ((a - cx) / rx) ** 2 + ((b - cy) / ry) ** 2 <= 1); });
      // i Monti Centrali della Pangea: dove si sono scontrati i due continenti (oggi Appalachi, Mauritanidi, Caledonidi)
      const dist = coastDist(mask), MOUNTS = [[13, 27], [16, 24.5], [20, 22.5], [24, 21.5], [28, 20.5], [31, 19.5]], lat = y => 90 - y / H * 180;
      map.volc = [[46, 7, true, .5], [41, 20.4, true, .55], [24, 31, false, .6]];
      return {
        mask, rivers: [[[22, 19], [19, 13], [17.5, 6.5]], [[20, 23], [24, 30], [27, 38.5]], [[33, 23.5], [36, 21.5]]],
        zone: (x, y, sea) => {
          const k = Math.floor(y * CR) * CW + Math.floor(x * CR), d = dist[k] / CR, la = lat(y);
          if (sea) return 'S';   // nel Triassico ai poli non c'era ghiaccio
          const md = lineDist(MOUNTS, x, y);
          if (md < .45) return 'A';
          if (md < 1.3) return 'M';
          if (Math.abs(la) > 62) return 'T';
          if (d > 3 && Math.abs(la) < 40) return 'D';             // l'interno: un deserto enorme (lontano dal mare non piove)
          if (x > 30 && y > 16 && y < 27 && d < 1.2) return 'L';   // le coste calde della Tetide: paludi
          if (Math.abs(la) < 15) return 'G';                       // all'equatore: foreste
          return 'P';
        }
      };
    },
    cretaceo: map => {
      // 90 milioni di anni fa: Atlantico stretto, un mare in mezzo al Nord America, l'India isola, Australia attaccata all'Antartide, niente ghiaccio
      const v = VIEW('mondo'), P = proj(v), { nz } = map.n;
      const LANDS = [
        [[-150, 70], [-130, 72], [-118, 62], [-110, 48], [-108, 38], [-104, 28], [-98, 20], [-102, 18], [-112, 26], [-122, 40], [-130, 52], [-145, 58], [-158, 64]],  // Laramidia
        [[-100, 72], [-85, 74], [-70, 70], [-62, 58], [-58, 48], [-66, 40], [-75, 33], [-82, 28], [-88, 30], [-90, 36], [-92, 44], [-95, 55], [-100, 64]],             // Appalachia
        [[-72, 82], [-40, 82], [-28, 72], [-40, 62], [-50, 60], [-58, 66], [-66, 74]],                                                                                 // Groenlandia
        [[-25, 40], [-17, 43], [-11, 41], [-13, 36], [-21, 35]], [[-8, 72], [10, 72], [25, 68], [25, 58], [12, 55], [0, 58], [-6, 64]],                               // Iberia, Baltica
        [[-5, 52], [5, 53], [8, 48], [0, 46], [-6, 48]], [[10, 50], [18, 51], [20, 47], [12, 45]],                                                                     // isole europee
        [[30, 72], [70, 76], [110, 76], [150, 70], [160, 62], [145, 52], [130, 40], [120, 25], [105, 15], [95, 22], [80, 32], [60, 38], [45, 42], [38, 48], [34, 58]],  // Asia
        [[-25, 25], [-18, 32], [0, 33], [15, 30], [25, 28], [30, 20], [38, 10], [42, 0], [35, -15], [28, -30], [18, -36], [8, -30], [2, -12], [-5, 0], [-15, 2], [-25, 10]],  // Africa
        [[-70, 8], [-55, 7], [-38, -2], [-32, -8], [-34, -20], [-42, -30], [-52, -40], [-62, -52], [-70, -55], [-73, -45], [-72, -30], [-78, -15], [-80, -3]],       // Sud America
        [[50, -5], [58, -3], [62, -12], [58, -25], [50, -22], [47, -12]], [[42, -14], [47, -12], [48, -22], [44, -25], [41, -20]],                                  // India, Madagascar
        [[-60, -62], [-20, -66], [30, -65], [70, -62], [110, -60], [150, -64], [170, -70], [191, -74], [-169, -74], [-120, -72], [-90, -68], [-70, -66]],           // Antartide
        [[110, -40], [125, -35], [140, -38], [155, -42], [155, -55], [140, -58], [118, -58], [108, -50]]                                                             // Australia
      ];
      const SEAS = [[[-2, 20], [8, 22], [12, 10], [8, 5], [2, 8], [-4, 12]], [[-104, 62], [-96, 62], [-96, 30], [-104, 30]]];   // mare trans-sahariano, mare interno nordamericano
      const mask = maskFrom((x, y) => { const lo = P.lon(x) + (nz(x, y, .6) - .5) * 5, la = P.lat(y) + (nz(x + 50, y, .6) - .5) * 4; return LANDS.some(p => inPoly(p, lo, la)) && !SEAS.some(p => inPoly(p, lo, la)); });
      map.volc = vToMap(P, [[55, -15, 1], [-120, 45, 0], [-72, -30, 1], [138, 38, 1]]);   // trappi del Deccan, archi vulcanici
      return {
        view: v, mask, jit: 3, rivers: [[[-62, -5], [-50, -3], [-40, -2]], [[20, 10], [25, 20], [24, 27]]],
        rules: [
          { b: 'M', l: [[-150, 66], [-125, 55], [-114, 45], [-110, 35], [-104, 24]], w: 3 }, { b: 'M', l: [[-79, -3], [-73, -25], [-72, -45]], w: 2.5 },  // montagne del Pacifico
          { b: 'T', f: (lo, la) => Math.abs(la) > 66 },                                    // ai poli foreste fredde, niente ghiaccio
          { b: 'D', f: (lo, la) => Math.abs(la) > 15 && Math.abs(la) < 32 && (lo > -20 && lo < 60) },  // fascia arida
          { b: 'G', f: (lo, la) => Math.abs(la) < 16 }, { b: 'L', f: (lo, la) => (lo > -104 && lo < -88 && la > 28 && la < 64) || (lo > 0 && lo < 25 && la > 44 && la < 56) },  // coste del mare interno: paludi (dinosauri!)
          { b: 'S', sea: true, f: () => true }
        ]
      };
    },
    italia: map => {
      const v = VIEW('italia'), P = proj(v);
      map.volc = vToMap(P, [[14.99, 37.75, 1], [14.43, 40.82, 1], [15.21, 38.79, 1]]);
      return {
        view: v, mask: MASK('italia'), jit: .15, riverW: .12,
        rivers: [[[7.3, 44.9], [7.7, 45.05], [8.6, 45.1], [9.7, 45.05], [10.6, 45.05], [11.6, 45], [12.3, 44.95], [12.55, 44.95]], [[12, 43.8], [12.3, 43.3], [12.45, 42.7], [12.5, 42], [12.25, 41.73]],
          [[11.8, 43.8], [11.25, 43.77], [10.3, 43.68]], [[10.5, 46.7], [11.1, 46.2], [11.2, 45.4], [12.3, 45.15]], [[6.2, 46.2], [5.1, 45.8], [4.8, 45.2], [4.8, 44], [4.7, 43.4]],
          [[14.5, 46.1], [16, 45.7], [18, 45.1], [20.4, 44.8]], [[8.6, 46.3], [8.8, 45.7], [9.15, 45.15]], [[15.4, 41.2], [16.3, 41.3]], [[14.6, 41.4], [14.2, 41.1], [13.93, 41.02]]],
        rules: [
          { b: 'F', l: [[10.7, 45.45], [10.65, 45.85]], w: .1 }, { b: 'F', l: [[8.55, 45.75], [8.75, 46.15]], w: .05 }, { b: 'F', l: [[9.3, 45.85], [9.35, 46.15]], w: .04 },  // Garda, Maggiore, Como
          { b: 'F', e: [12.1, 43.13, .12, .08] }, { b: 'F', e: [11.93, 42.6, .1, .1] }, { b: 'F', e: [6.55, 46.45, .35, .09] }, { b: 'F', e: [17.75, 46.85, .4, .1] }, { b: 'F', e: [12.32, 45.42, .1, .12] },
          { b: 'H', e: [6.86, 45.83, .2, .14] }, { b: 'H', e: [7.87, 45.94, .2, .12] }, { b: 'H', e: [9.9, 46.38, .18, .12] }, { b: 'H', e: [12.69, 47.07, .18, .1] },  // ghiacciai
          { b: 'A', l: ALPS, w: .28 }, { b: 'A', e: [13.57, 42.47, .2, .15] },                                                    // Alpi, Gran Sasso
          { b: 'M', l: ALPS, w: .75 }, { b: 'M', l: APENNINES, w: .35 }, { b: 'M', e: [9.3, 40.1, .4, .5] }, { b: 'M', e: [9, 42.2, .2, .4] },  // Appennini, Sardegna, Corsica
          { b: 'M', l: [[13.3, 37.9], [14.3, 37.9], [15.3, 38.1]], w: .15 }, { b: 'M', l: [[14.5, 45.8], [15.5, 44.8], [17, 43.8], [18.5, 42.8], [19.8, 42.2], [20.5, 41.2], [21.2, 39.5]], w: .45 },
          { b: 'M', l: [[3, 44.2], [4, 45], [3.2, 45.8]], w: .4 }, { b: 'M', l: [[22.5, 44.5], [23.3, 42.5]], w: .4 },          // Massiccio centrale, Balcani
          { b: 'L', e: [12.25, 44.75, .16, .14] }, { b: 'L', e: [4.6, 43.55, .2, .1] },                                          // delta del Po, Camargue
          { b: 'D', f: (lo, la) => la < 34.6 && lo < 11.5 },                                                                    // Tunisia del sud
          { b: 'S', sea: true, f: () => true }
        ]
      };
    },
    napoli: map => {
      const v = VIEW('napoli'), P = proj(v);
      map.volc = [[P.x(14.426), P.y(40.821), true, .5]];   // il Vesuvio (nel 79 era il Somma-Vesuvio, più grande)
      return {
        view: v, mask: MASK('napoli'), jit: .025, riverW: .15, vr: 3.2, crater: .5,
        rivers: [[[14.62, 40.83], [14.55, 40.77], [14.47, 40.73]], [[14.35, 41.12], [14.05, 41.06], [13.93, 41.02]], [[14.45, 40.98], [14.25, 40.97], [14.05, 40.95]]],   // Sarno, Volturno, Clanio
        rules: [
          { b: 'F', e: [14.08, 40.84, .012, .008] }, { b: 'F', e: [14.04, 40.93, .03, .015] }, { b: 'F', e: [14.05, 40.86, .015, .01] },  // laghi d'Averno, Patria, Lucrino
          { b: 'V', e: [14.14, 40.83, .09, .05] }, { b: 'V', e: [13.9, 40.73, .06, .04] },                                       // Campi Flegrei, Ischia
          { b: 'A', e: [14.5, 40.66, .05, .025] }, { b: 'M', l: [[14.37, 40.63], [14.5, 40.66], [14.62, 40.67], [14.78, 40.69]], w: .05 },  // Monti Lattari, monte Faito
          { b: 'M', e: [14.24, 40.55, .03, .02] }, { b: 'M', p: [[14.8, 40.78], [15.13, 40.86], [15.13, 40.6], [14.9, 40.65]] }, { b: 'M', p: [[14.45, 41.13], [14.7, 41.13], [14.7, 41.03], [14.45, 41.05]] },  // Capri, Picentini, Tifatini
          { b: 'S', sea: true, f: () => true }
        ]
      };
    },
    mediterraneo: map => {
      const v = VIEW('mediterraneo'), P = proj(v);
      map.volc = vToMap(P, [[14.43, 40.82, 1], [14.99, 37.75, 1], [25.4, 36.4, 1], [15.21, 38.79, 1]]);
      return {
        view: v, mask: MASK('mediterraneo'), jit: .4, riverW: .12, rivers: RIVERS,
        rules: today([{ b: 'L', e: [13, 41.4, .3, .15] }, { b: 'F', e: [13.55, 41.99, .1, .07] }, { b: 'F', e: [35.5, 31.5, .1, .4] }, { b: 'F', e: [42.9, 38.6, .4, .25] }, { b: 'L', e: [31, 31, 1, .5] }])  // paludi Pontine, lago Fucino, Mar Morto, lago di Van, delta del Nilo
      };
    },
    atlantico: map => { const v = VIEW('atlantico'), P = proj(v); map.volc = vToMap(P, [[-16.64, 28.27, 0], [-28.4, 38.47, 0], [-61.17, 14.8, 1]]); return { view: v, mask: MASK('atlantico'), jit: .5, rivers: RIVERS, rules: today() }; },
    nordatlantico: map => {
      const v = VIEW('nordatlantico'), P = proj(v), { nz } = map.n, mask = MASK('nordatlantico'), dist = coastDist(mask.map(x => 1 - x));
      const fromLand = (lo, la) => { const i = Math.floor(P.x(lo) * CR), j = Math.floor(P.y(la) * CR); return i < 0 || j < 0 || i >= CW || j >= CH ? 99 : dist[j * CW + i] / CR; };   // cm dalla terra
      map.volc = vToMap(P, [[-19.7, 63.98, 1]]);
      // aprile 1912: il campo di ghiaccio sui Grandi Banchi di Terranova (il Titanic affondò a 41,7° N, 49,9° O) e la banchisa del Labrador e della Groenlandia
      const FIELD = [[-52, 47], [-48, 46.5], [-46, 44], [-47.5, 41.5], [-50, 41.3], [-53, 43], [-54.5, 46]];
      return {
        view: v, mask, jit: .4, rivers: RIVERS,
        rules: today([{ b: 'I', sea: true, f: (lo, la) => (inPoly(FIELD, lo, la) && nz(lo * 3, la * 3, 1.2) > .45) ||   // il campo di ghiaccio e gli iceberg dei Grandi Banchi
          (la > 51 && lo < -50 && fromLand(lo, la) < 2.2 + nz(lo, la, .5) * 2) ||                                         // banchisa del Labrador
          (la > 58 && lo > -48 && lo < -18 && fromLand(lo, la) < 1.5 + nz(lo, la, .5) * 2.5) }])                           // banchisa lungo la Groenlandia
      };
    },
    alpi: map => {
      const v = VIEW('alpi'), P = proj(v);
      const CREST = [[7.25, 43.95], [7.1, 44.35], [6.95, 44.7], [7, 45.1], [6.9, 45.45], [6.87, 45.83], [7.3, 45.92], [7.87, 45.94], [8.4, 46.4], [9, 46.5], [9.9, 46.38], [10.5, 46.5], [11, 46.85], [12, 47], [12.7, 47.08], [13.5, 47.15], [14.5, 47.4], [15.5, 47.6], [16, 47.7]];
      const PEAKS = [[6.865, 45.833], [7.867, 45.937], [7.658, 45.976], [8, 46.5], [9.908, 46.382], [10.54, 46.51], [10.5, 46.15], [12.69, 47.07], [7.27, 45.52], [6.36, 44.92]];
      map.volc = [];
      return {
        view: v, mask: MASK('alpi'), jit: .08, riverW: .13,
        rivers: [[[7, 44.7], [7.65, 45.05], [8.6, 45.1], [9.7, 45.05], [10.6, 45], [11.6, 44.95], [12.3, 44.95], [12.6, 44.95]], [[8.6, 46.3], [8.8, 45.7], [9.15, 45.15]],
          [[10.5, 46.8], [11.15, 46.5], [11.1, 46], [11, 45.45], [11.6, 45.2], [12.3, 45.15]], [[8.3, 46.55], [7.5, 46.25], [6.9, 46.4]], [[6.15, 46.2], [5.8, 46.1], [5.1, 45.75], [4.83, 45.75], [4.8, 45], [4.75, 44], [4.65, 43.5]],
          [[9.6, 46.6], [9.5, 47.1], [9.6, 47.5]], [[8.6, 47.65], [7.6, 47.57], [7.8, 48.5], [8.4, 49], [8.45, 49.25]], [[8.5, 47.95], [9.5, 48.2], [11.4, 48.75], [12.1, 48.95], [13.4, 48.57], [14.3, 48.3], [15.5, 48.4], [16.37, 48.2], [17.1, 48.15]],
          [[9.8, 46.5], [10.5, 46.85], [11.4, 47.27], [12.2, 47.85], [13.45, 48.57]], [[12.3, 46.75], [13.85, 46.6], [15.65, 46.55], [17.1, 45.9]], [[13.9, 46.4], [14.5, 46.05], [15.6, 45.85], [16.4, 45.45], [17.1, 45.15]],
          [[6.9, 45.6], [6.3, 45.4], [5.7, 45.2], [4.9, 44.9]], [[11.9, 46.6], [12.2, 46.1], [12.5, 45.6]]],
        rules: [
          { b: 'F', l: [[10.7, 45.45], [10.65, 45.85]], w: .09 }, { b: 'F', l: [[8.55, 45.75], [8.75, 46.15]], w: .045 }, { b: 'F', l: [[9.25, 45.82], [9.35, 46.15]], w: .035 },
          { b: 'F', l: [[6.15, 46.22], [6.6, 46.4], [6.9, 46.42]], w: .07 }, { b: 'F', l: [[9, 47.75], [9.65, 47.5]], w: .08 }, { b: 'F', l: [[8.55, 47.35], [8.85, 47.2]], w: .035 },
          { b: 'F', l: [[6.65, 46.8], [7.05, 47.05]], w: .05 }, { b: 'F', e: [10.07, 45.73, .03, .06] }, { b: 'F', e: [12.45, 47.87, .07, .04] }, { b: 'F', e: [12.32, 45.42, .1, .13] }, { b: 'F', e: [8.35, 47.02, .1, .03] },
          { b: 'H', f: (lo, la) => PEAKS.some(([a, b]) => ((lo - a) / .2) ** 2 + ((la - b) / .13) ** 2 <= 1) },                 // ghiacciai sulle cime più alte
          { b: 'A', l: CREST, w: .3 }, { b: 'M', l: CREST, w: .85 },
          { b: 'M', l: [[5.6, 46.2], [6.3, 46.7], [7, 47.2], [7.8, 47.5]], w: .18 }, { b: 'M', e: [8.1, 48.2, .35, .5] }, { b: 'M', e: [7, 48.2, .25, .5] },  // Giura, Foresta Nera, Vosgi
          { b: 'M', l: [[8, 44.3], [9, 44.5], [10, 44.3], [11, 44.1], [12, 43.7], [12.8, 43.1]], w: .28 }, { b: 'M', l: [[14, 46], [15, 45.2], [16, 44.4], [17, 43.6]], w: .35 }, { b: 'M', e: [4.3, 45.2, .4, .6] },
          { b: 'L', e: [12.3, 44.85, .2, .16] }, { b: 'L', e: [4.6, 43.55, .25, .1] },
          { b: 'S', sea: true, f: () => true }
        ]
      };
    },
    himalaya: map => {
      const v = VIEW('himalaya'), P = proj(v);
      const CREST = [[76.5, 34], [78, 32.5], [79.5, 30.9], [81, 30], [83.5, 28.7], [85, 28.3], [86.9, 27.99], [88.2, 27.8], [89.5, 28], [91.5, 27.9], [93.5, 28.4], [95, 29.2], [96.5, 29]];
      const crestLat = lon => { for (let i = 1; i < CREST.length; i++) if (lon <= CREST[i][0]) { const [a, b] = CREST[i - 1], [c, d] = CREST[i], t = (lon - a) / (c - a); return b + (d - b) * Math.max(0, Math.min(1, t)); } return CREST[CREST.length - 1][1]; };
      const PEAKS = [[86.925, 27.988], [88.15, 27.7], [79.97, 30.38], [83.82, 28.6], [83.49, 28.7], [87.09, 27.89], [86.66, 28.09], [95.06, 29.63], [85.78, 28.35], [81.5, 30.5]];
      map.volc = [];
      return {
        view: v, mask: MASK('himalaya'), jit: .1, riverW: .14,
        rivers: [[[82, 30.2], [85, 29.3], [88, 29.3], [91, 29.3], [93.5, 29.4], [95, 29.8], [95.3, 28.5], [95, 27.8], [93.5, 26.8], [91.7, 26.2], [90, 25.3], [89.7, 24]],  // Yarlung Tsangpo e Brahmaputra
          [[81, 31], [79.5, 32.4], [77.5, 34.2]], [[78.2, 30], [78.9, 28.3], [80.3, 26.5], [81.9, 25.4], [83.5, 25.4], [85.2, 25.6], [87.3, 25.2], [88.1, 24.3], [88.7, 23.5]],  // Indo, Gange
          [[77.6, 30.4], [77.2, 28.6], [78, 27.2], [79.5, 26.4], [81.8, 25.4]], [[86.9, 27.2], [87, 26.3], [87.2, 25.4]], [[84, 27.7], [84.4, 26.6], [85.2, 25.6]], [[81.2, 28.5], [82.2, 27], [83.3, 26.2], [84.1, 25.7]]],  // Yamuna, Kosi, Gandak, Ghaghara
        rules: [
          { b: 'F', e: [90.6, 30.7, .35, .13] }, { b: 'F', e: [89, 31.75, .4, .13] }, { b: 'F', e: [90.7, 28.95, .2, .08] }, { b: 'F', e: [81.45, 30.7, .12, .09] }, { b: 'F', l: [[78.4, 33.85], [79.6, 33.55]], w: .06 }, { b: 'F', e: [86.3, 31.1, .25, .12] },
          { b: 'H', f: (lo, la) => PEAKS.some(([a, b]) => ((lo - a) / .28) ** 2 + ((la - b) / .2) ** 2 <= 1) },   // ghiacciai sulle cime (Everest, Kangchenjunga, Annapurna…)
          { b: 'A', f: (lo, la) => Math.abs(la - crestLat(lo)) < .55 }, { b: 'A', l: [[77, 35], [82, 35.5], [88, 35.5], [94, 35.3]], w: .6 },  // la catena principale, il Kunlun
          { b: 'M', l: [[80, 31.6], [84, 30.6], [88, 30.4], [92, 30.5]], w: .3 }, { b: 'M', f: (lo, la) => la < crestLat(lo) && la > crestLat(lo) - 1.5 },  // Transhimalaya, colline
          { b: 'T', f: (lo, la) => la > crestLat(lo) },                                                                              // l'altopiano del Tibet: steppa fredda
          { b: 'M', l: [[89.9, 25.5], [92.5, 25.4]], w: .35 },                                                                       // colline del Meghalaya
          { b: 'G', f: (lo, la) => (la > crestLat(lo) - 2.1 && lo > 80) || (lo > 91 && la > 26) },                                // Terai e Assam: foreste
          { b: 'L', l: [[80.5, 28.6], [84, 27.2], [88, 26.4]], w: .2 },                                                              // le paludi del Terai
          { b: 'D', f: (lo, la) => lo < 78.3 && la < 27.3 }                                                                          // il bordo del deserto del Thar
        ]
      };
    },
    luna: map => {
      // la faccia visibile della Luna: i "mari" (pianure scure di basalto) dove sono davvero, gli altopiani chiari, i crateri.
      // Niente acqua: il blu del bordo è lo spazio.
      const { nz } = map.n, lon = x => (x - W / 2) / (W / 2) * 95, lat = y => (H / 2 - y) / (H / 2) * 72;
      const MARIA = [[-17, 33, 18, 13], [17.5, 28, 8.5, 8], [31, 8.5, 10, 9], [59, 17, 6, 5.5], [-57, 18, 18, 24], [-17, -21, 9, 8], [-38, -24, 7.5, 8], [51, -4.5, 8, 10], [36, -15, 6, 6.5], [-10, 3, 6, 5], [-23, -8, 8, 6], [21, -5, 3, 4]];   // Imbrium, Serenitatis, Tranquillitatis, Crisium, Procellarum, Nubium, Humorum, Fecunditatis, Nectaris, Medii, Cognitum, Insularum
      const CRAT = [[-11.4, -43.3, 4], [-20.1, 9.6, 4.5], [-9.3, 51.6, 4], [-47.4, 23.7, 2.2], [-38, 8.1, 2.1], [-1.5, -58.7, 6.5], [26.4, -11.4, 4], [-3.6, -13.4, 4.8], [11.1, 9.6, 2.5], [44.4, 46.8, 4]];   // Tycho, Copernico, Platone, Aristarco, Keplero, Clavius, Teofilo, Tolomeo, Mänder, Atlante
      const mask = maskFrom((x, y) => ((x - W / 2) / (W / 2 - .6)) ** 2 + ((y - H / 2) / (H / 2 - .6)) ** 2 <= 1);
      map.volc = [];
      return {
        mask, rivers: [],
        zone: (x, y, sea) => {
          if (sea) return 'S';
          const lo = lon(x), la = lat(y);
          for (const [a, b, r] of CRAT) { const d = Math.hypot(lo - a, la - b); if (d < r * .45) return 'V'; if (d < r) return 'M'; if (d < r * 1.3) return 'A'; }
          const mare = MARIA.some(([a, b, rx, ry]) => ((lo - a + (nz(x, y, .4) - .5) * 6) / rx) ** 2 + ((la - b + (nz(x + 9, y, .4) - .5) * 6) / ry) ** 2 <= 1);
          if (mare) return 'V';                                 // i mari: basalto scuro
          return nz(x * 2, y * 2, .9) > .72 ? 'M' : 'D';        // gli altopiani: polvere chiara e piccoli crateri
        }
      };
    }
  };

  // Prepara la mappa segreta (una volta sola): griglia dei biomi e vulcani
  DM.secretSetup = function (map) {
    const o = MAKERS[map.secret](map);
    map.sec = { cells: build(map, o), vr: o.vr || .6, crater: o.crater || .22 };
  };
  // Bioma nel punto (x, y) al giro "round": la griglia preparata, più i vulcani (e le eruzioni in corso)
  DM.secretBiome = function (map, x, y, round) {
    for (let i = 0; i < map.volc.length; i++) {
      const v = map.volc[i], d = Math.hypot(x - v[0], y - v[1]);
      const active = map.erupt.some(z => z.v === i && z.until > round);
      if (active && d < 2.1) return 'Z';
      if (d < map.sec.crater && v[2]) return 'Z';
      if (d < map.sec.vr) return 'V';
    }
    const c = map.sec.cells[Math.min(FH - 1, Math.floor(y * MR)) * FW + Math.min(FW - 1, Math.floor(x * MR))];
    return DM.BIOMES[c];
  };
})(globalThis.DM = globalThis.DM || {});
