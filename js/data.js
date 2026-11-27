// Damamondo – dati del regolamento (tabelle, costi, kit).
// Le correzioni del documento di passaggio hanno la precedenza sul PDF.
(function (DM) {
  'use strict';

  DM.W = 60;       // larghezza mappa in cm (2 fogli A4)
  DM.H = 42;       // altezza mappa in cm
  DM.TR = 4;       // celle di territorio per cm (0,25 cm)
  DM.MR = 10;      // celle di bioma per cm (1 mm)

  // ---- Biomi ----
  DM.BIOMES = 'PDGLTMASFHIVZ';
  DM.BIOME_NAME = {
    P: 'Pianura', D: 'Deserto', G: 'Giungla', L: 'Palude', T: 'Tundra', M: 'Montagna',
    A: 'Alta montagna', S: 'Mare', F: 'Fiume/lago', H: 'Glaciale', I: 'Banchisa',
    V: 'Vulcanico', Z: 'Lavico'
  };
  DM.BIOME_COLOR = {
    P: '#b9d27a', D: '#e6cf8a', G: '#3e8f4a', L: '#4fb3a1', T: '#c9b3e3', M: '#a08f7c',
    A: '#d8d8de', S: '#4a86c5', F: '#7ad0e8', H: '#f1f5f9', I: '#b9e3ee', V: '#6e3b2a', Z: '#ff5a1f'
  };
  DM.WATER = 'SF';               // mare e fiume/lago
  DM.NO_BUILD = 'SFIZ';          // niente edifici: acqua, Banchisa, Lavico
  DM.NO_CITY = 'GLA';            // niente città: Giungla, Palude, Alta montagna
  DM.NO_CAPITAL = 'SGLAFIZ';     // Capitale vietata qui
  DM.NO_CLAIM = 'SFIZ';          // queste zone non diventano territorio
  DM.HARD_ROAD = 'GLA';          // strada a costo doppio

  // ---- Truppe (4.1) ----
  // Velocità a terra per bioma (12.2, Lavico e Banchisa :2, Glaciale e Vulcanico senza malus).
  const SPD = {
    S: { P: 1, D: .3, G: .3, L: .3, T: .5, M: .5, A: .4, H: 1, V: 1, Z: .5, I: .5 },
    T: { P: 1, D: .2, G: .2, L: .2, T: .5, M: .5, A: .2, H: 1, V: 1, Z: .5, I: .5 },
    C: { P: 4, D: 1, G: 1, L: .8, T: 2, M: 2, A: 1.3, H: 4, V: 4, Z: 2, I: 2 }
  };
  DM.TROOPS = {
    S: { name: 'Soldato', label: 'S', kind: 'land', range: 1, dmg: 70, hp: 100, land: SPD.S },
    N: { name: 'Nave', label: 'N', kind: 'sea', range: 3, dmg: 500, hp: 3500, sea: 3, river: 4, ice: 1.5 },
    E: { name: 'Elicottero', label: 'E', kind: 'air', range: 4, dmg: 500, hp: 2000, air: 4 },
    T: { name: 'Carrarmato', label: 'T', kind: 'land', range: 2, dmg: 1500, hp: 5000, land: SPD.T },
    C: { name: 'Carro', label: 'C', kind: 'land', range: 0, dmg: 0, hp: 10000, land: SPD.C },
    X: { name: 'Nave Carro', label: 'NC', kind: 'sea', range: 3, dmg: 100, hp: 20000, sea: 8, river: 0, ice: 6 },
    A: { name: 'Aereo Carro', label: 'AC', kind: 'air', range: 6, dmg: 100, hp: 20000, air: 12 }
  };
  DM.TROOP_KEYS = 'SNETCXA';
  DM.MINE_GAP = 1;        // distanza minima tra due miniere (cm)
  DM.MULTI_MOVE = 'CXA';   // Carro, Nave Carro e Aereo Carro si muovono anche più volte per turno (fino alla loro velocità)

  // 12.3 danno nei biomi (correzione: Carrarmato 1000 Deserto, 2200 Giungla).
  DM.BIOME_DMG = { S: { D: 50, G: 100 }, E: { D: 350, G: 800 }, T: { D: 1000, G: 2200 } };
  // 12.4 gittata x2 in Tundra (per le truppe che subiscono i biomi).
  DM.TUNDRA_RANGE = 'SET';
  // 13.1 effetto dal secondo in poi: [deserto danno, giungla danno, tundra gittata, palude velocità]
  DM.BERRY_STACK = {
    S: [-20, 30, 1, -.1], T: [-500, 600, 2, -.1], C: [0, 0, 0, -.7], N: [-150, 250, 3, -.5],
    X: [-30, 50, 0, -1.5], E: [-150, 250, 4, -.7], A: [-30, 50, 6, -2.3]
  };
  DM.BURN = { S: 20, T: 500, C: 500 };   // 12.5 bruciatura per turno

  // 5.1 punti per il tetto di 100
  DM.FLEET_PTS = { N: 20, E: 15, X: 35, A: 60 };
  DM.LAND_PTS = { S: 1, E: 15, T: 20, C: 10, A: 60 };
  DM.ARMY_MAX = 100;
  DM.CARGO_CAP = { C: 20, X: 50, A: 100 };  // 6.1 punti cose
  DM.TROOP_CAP = { N: 200, E: 4, T: 3, C: 4, X: 500, A: 500 };   // 6.1 punti truppa trasportabili
  DM.TROOP_VALUE = { S: 1, N: 1000, E: 15, T: 20, C: 10 };        // 6.2 (Nave Carro e Aereo Carro non si trasportano)

  // ---- Limiti per giro (3) – se un numero è in due intervalli vince il precedente ----
  DM.moveLimit = r => r <= 4 ? 1 : r <= 10 ? 2 : r <= 15 ? 3 : r <= 20 ? 5 : 8;
  DM.shotLimit = r => r <= 4 ? 1 : r <= 10 ? 1 : r <= 15 ? 2 : r <= 20 ? 5 : 8;

  // ---- Materiali ----
  DM.MATERIALS = ['carbone', 'rame', 'piombo', 'ferro', 'oro', 'argento', 'platino', 'diamanti',
    'titanio', 'uranio', 'petrolio', 'ossidiana'];
  DM.UNIT = { carbone: 't', rame: 't', piombo: 't', petrolio: 'l' };     // gli altri in kg
  DM.SYMBOL = { carbone: 'C', rame: 'Cu', piombo: 'Pb', ferro: 'Fe', oro: 'Au', argento: 'Ag',
    platino: 'Pt', diamanti: 'Di', titanio: 'Ti', uranio: 'U', petrolio: 'Pe', ossidiana: 'Os' };
  // 9.2 produzione di una miniera (= 1 punto cose, 6.3)
  DM.QTY = { carbone: 5, rame: 5, piombo: 10, ferro: 1000, oro: 100, argento: 500, platino: 200,
    diamanti: 50, titanio: 500, uranio: 20, petrolio: 500, ossidiana: 100 };
  // 10 Banco: [lotto, prezzo]
  DM.BANK = { carbone: [1, 1e3], rame: [1, 1e3], piombo: [1, 1e3], ferro: [500, 3e3], oro: [100, 35e3],
    argento: [500, 25e3], platino: [100, 4e4], diamanti: [50, 4e4], titanio: [500, 5e3],
    uranio: [20, 3e4], petrolio: [500, 15e3], ossidiana: [100, 5e4] };
  // 9.1 minerale per bioma e dado
  DM.MINE_TABLE = {
    G: 'diamanti diamanti ferro ferro oro oro', D: 'diamanti diamanti oro oro petrolio petrolio',
    L: 'titanio titanio uranio uranio petrolio petrolio', T: 'titanio titanio titanio titanio oro oro',
    M: 'argento argento argento ferro ferro platino', A: 'argento ferro ferro platino platino platino',
    P: 'carbone carbone rame rame piombo piombo', H: 'ferro ferro diamanti diamanti diamanti petrolio',
    V: 'oro ferro ferro ossidiana ossidiana ossidiana'
  };

  // ---- Oggetti che si tengono negli edifici ----
  DM.BERRIES = { deserto: 'D', giungla: 'G', palude: 'L', tundra: 'T' };
  DM.BERRY_OF_BIOME = { D: 'deserto', G: 'giungla', L: 'palude', T: 'tundra' };
  DM.POTIONS = { poz_stipendio: 'Stipendio+', poz_velocita: 'Velocità', poz_curacitta: 'Curacittà',
    poz_concime: 'Concime', poz_miglioracitta: 'Miglioracittà', poz_curatruppe: 'Curatruppe',
    poz_ignifuga: 'Ignifuga' };
  // Tutto quello che può stare in un inventario, con i punti (6.3): quantità per 1 punto.
  DM.ITEMS = DM.MATERIALS.concat(['bomba', 'superbomba'],
    Object.keys(DM.BERRIES).map(b => 'bacca_' + b), Object.keys(DM.POTIONS));
  DM.PER_POINT = Object.assign({}, DM.QTY, { bomba: 1 / 40, superbomba: 1 / 100 });
  Object.keys(DM.BERRIES).forEach(b => { DM.PER_POINT['bacca_' + b] = 1; DM.UNIT['bacca_' + b] = '×'; });
  Object.keys(DM.POTIONS).forEach(k => { DM.PER_POINT[k] = 0.5; DM.UNIT[k] = '×'; });
  DM.UNIT.bomba = '×'; DM.UNIT.superbomba = '×';
  DM.MONEY_PER_POINT = 30000;
  DM.unitOf = m => DM.UNIT[m] || 'kg';

  // ---- Edifici (8) ----
  DM.BUILDING_HP = { cap: 2e4, citta: 1e4, acc: 5e3, porto: 5e3, aer: 5e3, col: 5e3, min: 5e3 };
  DM.SPAWN_R = { cap: 2, citta: 1, acc: 1, aer: 1 };   // fin dove si schierano le truppe di terra (cm)
  DM.SPAWNS = { cap: 'STCE', citta: 'STCE', acc: 'STCE', porto: 'NX', aer: 'AE', col: '', min: '' };
  DM.INCOME = { cap: 40000, citta: 20000 };
  DM.CITY_MIN_MONEY = 5000;   // 7.2

  // Costi: lista di alternative {m: soldi, r: {materiale: quantità}}
  DM.COST = {
    S: [{ m: 5e3, r: { rame: 1, piombo: 1 } }],
    N: [{ m: 15e3, r: { petrolio: 500, rame: 3, piombo: 2 } }, { m: 15e3, r: { carbone: 5, rame: 3, piombo: 2 } }],
    E: [{ m: 75e3, r: { petrolio: 1000, ferro: 2000, piombo: 4 } }],
    T: [{ m: 125e3, r: { titanio: 1000, petrolio: 1500, piombo: 10 } }],
    C: [{ m: 1e5, r: { titanio: 500 } }, { m: 1e5, r: { ferro: 2000, petrolio: 500 } }],
    X: [{ m: 2e5, r: { titanio: 1000 } }, { m: 2e5, r: { ferro: 5000, petrolio: 1000 } }],
    A: [{ m: 5e5, r: { titanio: 2500 } }, { m: 5e5, r: { ferro: 1e4, petrolio: 2500 } }],
    citta: [{ m: 5e4, r: { argento: 500, ferro: 200 } }, { m: 5e4, r: { platino: 200, ferro: 200 } }],
    acc: [{ m: 5e3, r: {} }],
    porto: [{ m: 5e3, r: { petrolio: 200, rame: 1, piombo: 2 } }],
    aer: [{ m: 15e3, r: { petrolio: 1000, titanio: 500 } }, { m: 15e3, r: { petrolio: 1000, ferro: 2000 } }],
    col: [{ m: 25e3, r: { ferro: 200, carbone: 2 } }],
    min: [{ m: 5e3, r: {} }],
    bomba: [{ m: 2e5, r: { uranio: 30 } }],
    superbomba: [{ m: 5e5, r: { uranio: 50 } }],
    ponte1: [{ m: 5e3, r: { ferro: 100 } }],   // un pezzo di ponte = 1 cm
    ponte2: [{ m: 1e4, r: { ferro: 200 } }],
    poz_stipendio: [{ m: 5e4, r: { oro: 20 } }],
    poz_velocita: [{ m: 1e4, r: { argento: 100 } }],
    poz_curacitta: [{ m: 5e3, r: { platino: 50 } }, { m: 5e3, r: { argento: 100 } }],
    poz_concime: [{ m: 25e3, r: { carbone: 1, ferro: 100 } }],
    poz_miglioracitta: [{ m: 25e3, r: { diamanti: 50, platino: 100 } }, { m: 25e3, r: { diamanti: 50, argento: 200 } }],
    poz_curatruppe: [{ m: 15e3, r: { platino: 100 } }, { m: 15e3, r: { argento: 200 } }],
    poz_ignifuga: [{ m: 2e4, r: { ossidiana: 300 } }]
  };
  // Per cm di ponte, per pezzo di strada (max 5 cm)
  DM.BRIDGE_COST = { 1: { m: 5e3, r: { ferro: 100 } }, 2: { m: 1e4, r: { ferro: 200 } } };
  DM.BRIDGE_HP = { 1: 5e3, 2: 1e4 };
  DM.ROAD_COST = { m: 1e4, r: { ferro: 2000, oro: 100 } };
  DM.ROAD_PIECE = 5;

  DM.BOMB = {
    bomba: { dmg: 5000, range: 15, rangeAcc: 10, shots: 3, from: ['cap', 'citta', 'acc'] },
    superbomba: { dmg: 20000, range: 30, rangeAcc: 0, shots: 5, from: ['cap', 'citta'], radius: .5 }
  };
  DM.BERRY_RANGE = { cap: 15, citta: 15, acc: 10 };

  DM.NAMES = Object.assign({
    cap: 'Capitale', citta: 'Città', acc: 'Accampamento', porto: 'Porto', aer: 'Aeroporto',
    col: 'Coltivazione', min: 'Miniera', ponte1: 'Pezzo di ponte liv. 1', ponte2: 'Pezzo di ponte liv. 2', bomba: 'Bomba', superbomba: 'Superbomba'
  }, DM.POTIONS);
  DM.nameOf = k => DM.TROOPS[k] ? DM.TROOPS[k].name : (DM.NAMES[k] || (k.startsWith('bacca_') ? 'Bacca ' + k.slice(6) : k));

  // ---- Kit di partenza (2) ----
  DM.KITS = [
    { name: 'Tribù', money: 250000, S: 5, N: 1, E: 0, acc: 5, citta: 0, porto: 12, min: 0, aer: 0, ponte1: 1 },
    { name: 'Minatori', money: 5000, S: 5, N: 1, E: 0, acc: 0, citta: 0, porto: 7, min: 5, aer: 0, materials: true },
    { name: 'Mercanti', money: 650000, S: 0, N: 1, E: 0, acc: 0, citta: 1, porto: 7, min: 0, aer: 0 },
    { name: 'Navigatori', money: 20000, S: 15, N: 4, E: 1, acc: 10, citta: 0, porto: 12, min: 0, aer: 2 },
    { name: 'Maghi', money: 30000, S: 5, N: 1, E: 0, acc: 1, citta: 0, porto: 2, min: 2, aer: 0, potions: true, diceChoice: 2 }
  ];
  DM.PLAYER_COLORS = ['#c0392b', '#2563a8', '#2e8b57', '#d98c1f', '#8e44ad', '#16a2b8'];
  DM.MAX_PLAYERS = 6;
  DM.capitalMinDist = np => np <= 2 ? 15 : 10;
})(globalThis.DM = globalThis.DM || {});
