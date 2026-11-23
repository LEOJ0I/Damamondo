// Spari, eserciti, edifici, Capitale, Bombe, Superbombe, bacche, pozioni.
const test = require('node:test'), assert = require('node:assert/strict');
const { DM, testGame } = require('./helpers');

test('danno e gittata nei biomi (tabelle 12.3 corretta e 12.4)', () => {
  const G = testGame();
  const at = (t, x, y) => DM.stat(G, DM.addUnit(G, t, 0, x, y));
  assert.deepEqual(at('S', 15, 25), [70, 1]);
  assert.deepEqual(at('S', 4, 4), [50, 1]);
  assert.deepEqual(at('S', 10, 4), [100, 1]);
  assert.deepEqual(at('S', 16, 4), [70, 2]);
  assert.deepEqual(at('T', 4, 4), [1000, 2]);     // correzione
  assert.deepEqual(at('T', 10, 4), [2200, 4 / 2]);
  assert.deepEqual(at('T', 16, 4), [1500, 4]);
  assert.deepEqual(at('E', 4, 4), [350, 4]);
  assert.deepEqual(at('E', 10, 4), [800, 4]);
  assert.deepEqual(at('E', 16, 4), [500, 8]);
  assert.deepEqual(at('A', 16, 4), [100, 6]);     // l'Aereo Carro non subisce i biomi
  assert.deepEqual(at('S', 22, 37), [70, 1]);     // Glaciale: niente
});

test('bacche: primo effetto normale, dal secondo valore fisso, deserto+giungla si annullano', () => {
  const G = testGame();
  const b = (t, x, y, k) => { const u = DM.addUnit(G, t, 0, x, y); u.bf = { k, until: G.round + 3 }; return DM.stat(G, u); };
  assert.equal(b('S', 15, 25, 'D')[0], 50);    // 70 : 1,5 = 46,7 → 50
  assert.equal(b('S', 4, 4, 'D')[0], 30);      // 50 − 20
  assert.equal(b('S', 10, 4, 'D')[0], 70);     // giungla + bacca deserto → base
  assert.equal(b('S', 10, 4, 'G')[0], 130);    // 100 + 30
  assert.equal(b('T', 15, 25, 'G')[0], 2250);
  assert.equal(b('X', 1, 20, 'D')[0], 70);     // tabella 12.3 Nave Carro
  assert.equal(b('A', 15, 25, 'G')[0], 150);
  assert.equal(b('S', 15, 25, 'T')[1], 2);
  assert.equal(b('S', 16, 4, 'T')[1], 3);      // 2 + 1
  assert.equal(b('A', 15, 25, 'T')[1], 12);
  const old = DM.addUnit(G, 'S', 0, 15, 25); old.bf = { k: 'D', until: G.round };
  assert.equal(DM.stat(G, old)[0], 70, 'scaduta');
});

test('sparo singolo: gittata, danno, limite di spari, una volta per turno', () => {
  const G = testGame();
  const a = DM.addUnit(G, 'S', 0, 20, 20), e = DM.addUnit(G, 'S', 1, 21.5, 20), f = DM.addUnit(G, 'S', 1, 20.8, 20);
  assert.match(DM.shoot(G, a, 21.5, 20), /fuori portata/);
  assert.match(DM.shoot(G, a, 20.8, 20), /1 truppa ha sparato: 70/);
  assert.equal(f.hp, 30);
  assert.equal(G.shots, 1);
  const b = DM.addUnit(G, 'S', 0, 20, 20.2);
  assert.match(DM.shoot(G, b, 20.8, 20), /Limite di spari/);
  G.round = 11; G.shots = 1;   // limite 2
  assert.match(DM.shoot(G, a, 20.8, 20), /già sparato/);
  assert.match(DM.shoot(G, b, 20.8, 20), /Distrutte: 1/);
  assert.ok(!G.units.includes(f));
  assert.ok(G.units.includes(e));
});

test('truppe aeree: solo Soldati, Navi e Carrarmati le colpiscono', () => {
  const G = testGame();
  G.round = 21;
  const heli = DM.addUnit(G, 'E', 1, 20.5, 20);
  const e = DM.addUnit(G, 'E', 0, 20, 20);
  assert.match(DM.shoot(G, e, 20.5, 20), /non colpibile/);
  const t = DM.addUnit(G, 'T', 0, 19.5, 20);
  assert.match(DM.shoot(G, t, 20.5, 20), /1500/);
  assert.equal(heli.hp, 500);
});

test('esercito: conta 1 sparo e fa sparare fino a 2 × limite truppe', () => {
  const G = testGame();
  G.round = 16;   // limite 5 → 10 truppe
  const sol = [];
  for (let i = 0; i < 12; i++) sol.push(DM.addUnit(G, 'S', 0, 20 + i * .01, 20));
  assert.match(DM.formArmy(G, sol).msg, /Esercito 1/);
  const tanks = [DM.addUnit(G, 'T', 1, 20.5, 20), DM.addUnit(G, 'T', 1, 20.5, 20.05)];
  DM.formArmy({ ...G, p: 1, units: G.units }, tanks);   // esercito nemico
  assert.ok(tanks[0].g && tanks[0].g === tanks[1].g);
  assert.match(DM.shoot(G, sol[0], 20.5, 20), /10 truppe hanno sparato: 700/);
  assert.equal(G.shots, 1);
  assert.equal(tanks[0].hp, 5000 - 700);
  // un esercito in giro 1: 2 truppe
  const G2 = testGame();
  const two = [DM.addUnit(G2, 'S', 0, 20, 20), DM.addUnit(G2, 'S', 0, 20, 20), DM.addUnit(G2, 'S', 0, 20, 20)];
  DM.formArmy(G2, two);
  DM.addUnit(G2, 'T', 1, 20.5, 20);
  assert.match(DM.shoot(G2, two[0], 20.5, 20), /2 truppe hanno sparato: 140/);
});

test('edifici: si colpiscono, distrutti perdono contenuto e truppe; ponti solo dalle Navi', () => {
  const G = testGame();
  G.round = 21;
  const acc = DM.addSite(G, 1, 'acc', 40, 20);
  acc.inv.mon = 99999;
  const tk = DM.addUnit(G, 'T', 0, 38.5, 20);
  tk.dd = G.round;   // Stipendio+: danni doppi
  assert.match(DM.shoot(G, tk, 40, 20), /1 truppa ha sparato: 3000 danni a Accampamento\. Vita rimasta: 2000/);
  tk.s = false;
  const inside = DM.addUnit(G, 'S', 1, 40, 20);
  assert.match(DM.shoot(G, tk, 40, 20), /Distrutte: 1/, 'se dentro c’è una truppa nemica, si colpisce lei');
  tk.s = false;
  assert.match(DM.shoot(G, tk, 40, 20), /Accampamento distrutto/);
  assert.ok(!G.sites.includes(acc));
  // distruggendo un edificio si perdono le truppe del proprietario che ci sono dentro
  const acc2 = DM.addSite(G, 1, 'acc', 40, 30), in2 = DM.addUnit(G, 'S', 1, 40, 30), att = DM.addUnit(G, 'S', 0, 40.1, 30);
  DM.destroySite(G, acc2);
  assert.ok(!G.units.includes(in2) && G.units.includes(att));
  // ponte nemico
  G.bridges.push({ o: 1, x: 30, y: 15, x1: 29, y1: 15, x2: 31, y2: 15, lv: 1, hp: 5000 });
  const s = DM.addUnit(G, 'S', 0, 29, 15.5);
  assert.match(DM.shoot(G, s, 30, 15), /solo con Navi/);
  const n = DM.addUnit(G, 'N', 0, 30, 18);
  assert.match(DM.shoot(G, n, 30, 15), /500 danni a un ponte/);
  assert.equal(G.bridges[0].hp, 4500);
});

test('Capitale distrutta: passa alla Città con ≥50% dei soldi, altrimenti senza Capitale (−10.000 a turno), senza città perde', () => {
  const G = testGame({ np: 3 });
  const cap1 = DM.capitalOf(G, 1);
  const city = DM.addSite(G, 1, 'citta', 44, 25);
  city.inv.mon = 300000;   // capitale ha 250.000 → la città ha più del 50%
  assert.match(DM.destroySite(G, cap1), /si sposta in una Città/);
  assert.equal(city.k, 'cap');
  // giocatore 2: città povera → senza capitale
  const cap2 = DM.capitalOf(G, 2), c2 = DM.addSite(G, 2, 'citta', 12, 30);
  const rich = DM.addSite(G, 2, 'acc', 18, 30); rich.inv.mon = 500000;
  assert.match(DM.destroySite(G, cap2), /senza Capitale/);
  assert.ok(G.players[2].noCap);
  assert.match(DM.chooseCapital(G, c2), /metà dei tuoi soldi/);
  DM.endTurn(G); DM.endTurn(G);   // tocca al giocatore 2
  assert.equal(G.p, 2);
  assert.equal(rich.inv.mon, 490000);
  c2.inv.mon = 490000;
  assert.match(DM.chooseCapital(G, c2), /Capitale/);
  assert.equal(c2.k, 'cap');
  // giocatore 0 senza città: perde
  const msg = DM.destroySite(G, DM.capitalOf(G, 0));
  assert.match(msg, /Giocatore 1 ha perso/);
  assert.ok(G.players[0].out);
  assert.ok(!G.units.some(u => u.o === 0));
  // l'ultimo rimasto vince
  assert.match(DM.destroySite(G, DM.capitalOf(G, 1)), /Vince Giocatore 3/);
});

test('Bomba: limite di spari (anche con limite <3, una sola), danno a tutto l’esercito, ponte liv.2 → liv.1', () => {
  const G = testGame();
  const cap = DM.capitalOf(G, 0);
  cap.inv.mat.bomba = 5; cap.inv.mat.superbomba = 2;
  const a = DM.addUnit(G, 'T', 1, 25, 20), b = DM.addUnit(G, 'T', 1, 25, 20.1);
  DM.formArmy({ ...G, p: 1, units: G.units }, [a, b]);
  assert.match(DM.launchBomb(G, cap, 'bomba', 25, 20), /5000 danni a 2 truppe \(2 distrutte\)/);
  assert.equal(G.shots, 3);
  DM.addUnit(G, 'S', 1, 25, 22);
  assert.match(DM.launchBomb(G, cap, 'bomba', 25, 22), /Limite di spari/);
  assert.match(DM.bombError(G, cap, 'superbomba'), /Limite di spari/);
  G.shots = 0; G.round = 16;   // limite 5: una Bomba (3) sì, la seconda (6) no
  assert.match(DM.launchBomb(G, cap, 'bomba', 25, 22), /Bomba/);
  assert.match(DM.launchBomb(G, cap, 'bomba', 25, 22), /Limite/);
  G.shots = 0; G.round = 21;   // limite 8: due Bombe
  G.bridges.push({ o: 1, x: 30, y: 20, x1: 29, y1: 20, x2: 31, y2: 20, lv: 2, hp: 10000 });
  assert.match(DM.launchBomb(G, cap, 'bomba', 30, 20), /torna di livello 1/);
  assert.equal(G.bridges[0].lv, 1);
  assert.equal(G.shots, 3);
  assert.match(DM.launchBomb(G, cap, 'bomba', 40, 40), /Tocca un bersaglio/);
  DM.addUnit(G, 'S', 1, 31, 20);
  assert.match(DM.launchBomb(G, cap, 'bomba', 31, 20), /Fuori portata: massimo 15/);
  assert.equal(cap.inv.mat.bomba, 2);
  // Accampamento: gittata 10, niente Superbombe
  const acc = DM.addSite(G, 0, 'acc', 20, 20); acc.inv.mat.superbomba = 1;
  assert.match(DM.bombError(G, acc, 'superbomba'), /Capitale o Città/);
});

test('Superbomba: 5 spari, tutto entro 0,5 cm, area radioattiva 3 giri anche sul mare, il turno non finisce', () => {
  const G = testGame();
  G.round = 16;
  const cap = DM.capitalOf(G, 0);
  cap.inv.mat.superbomba = 2;
  const e1 = DM.addUnit(G, 'T', 1, 30, 26), e2 = DM.addUnit(G, 'S', 1, 30.4, 26), e3 = DM.addUnit(G, 'S', 1, 30.7, 26);
  const mine = DM.addUnit(G, 'C', 0, 29.8, 26);
  const acc = DM.addSite(G, 1, 'acc', 30.2, 26.2);
  assert.match(DM.launchBomb(G, cap, 'superbomba', 30, 26), /20\.000 danni a 3 truppe \(3 distrutte\)/);
  assert.ok(!G.units.includes(e1) && !G.units.includes(e2) && G.units.includes(e3));
  assert.ok(!G.units.includes(mine));
  assert.ok(!G.sites.includes(acc));
  assert.equal(G.shots, 5);
  assert.equal(G.p, 0, 'il turno non finisce');
  assert.ok(DM.inRad(G, 30, 26));
  assert.match(DM.bombError(G, cap, 'superbomba'), /Limite/);
  // Superbomba anche su un punto vuoto in mare
  G.shots = 0;
  assert.match(DM.launchBomb(G, cap, 'superbomba', 15, 41), /Area radioattiva/);
  const ship = DM.addUnit(G, 'N', 0, 15, 41);
  assert.equal(DM.speedAt(G, ship, 15, 41), 0, 'senza Porto niente mare aperto');
  DM.addSite(G, 0, 'porto', 1, 20);
  assert.equal(DM.speedAt(G, ship, 15, 41), 1.5);
  G.round += 3;
  G.rad = G.rad.filter(z => z.until > G.round);
  assert.ok(!DM.inRad(G, 30, 26));
});

test('bacche: lancio da città entro 15 cm (10 dagli Accampamenti), una per turno, tutto l’esercito', () => {
  const G = testGame();
  const cap = DM.capitalOf(G, 0);
  cap.inv.mat.bacca_deserto = 2;
  const a = DM.addUnit(G, 'S', 1, 25, 20), b = DM.addUnit(G, 'S', 1, 25, 20);
  DM.formArmy({ ...G, p: 1, units: G.units }, [a, b]);
  DM.addUnit(G, 'S', 1, 31, 20);
  assert.match(DM.throwBerry(G, cap, 'deserto', 31, 20), /massimo 15/);
  assert.match(DM.throwBerry(G, cap, 'deserto', 25, 20), /2 truppe per 3 giri/);
  assert.equal(b.bf.k, 'D');
  assert.equal(b.bf.until, G.round + 3);
  assert.match(DM.throwBerry(G, cap, 'deserto', 25, 20), /una sola bacca/);
  assert.equal(G.shots, 0, 'non conta come sparo');
});

test('pozioni: Curacittà, Miglioracittà, Ignifuga, Concime, Stipendio+ (3), Velocità, Curatruppe', () => {
  const G = testGame({ kits: [4, 0] });   // Maghi
  const cap = DM.capitalOf(G, 0);
  cap.hp = 10000;
  assert.match(DM.usePotion(G, cap, 'poz_curacitta').msg, /14000/);
  assert.match(DM.usePotion(G, cap, 'poz_miglioracitta').msg, /solo su una Città/);
  const city = DM.addSite(G, 0, 'citta', 18, 22); city.inv.mat.poz_miglioracitta = 1;
  assert.match(DM.usePotion(G, city, 'poz_miglioracitta').msg, /migliorata/);
  assert.deepEqual([city.up, city.mx, city.hp], [10000, 15000, 15000]);
  assert.match(DM.usePotion(G, cap, 'poz_ignifuga').msg, /protetto/);
  assert.ok(cap.ign);
  const col = DM.addSite(G, 0, 'col', 5, 5); col.inv.mat.poz_concime = 1;
  assert.match(DM.usePotion(G, col, 'poz_concime').msg, /2 giri/);
  assert.equal(col.r0, -1);
  // Stipendio+: si consuma 1 pozione, fino a 3 truppe/eserciti
  const u1 = DM.addUnit(G, 'S', 0, 16, 20), u2 = DM.addUnit(G, 'S', 0, 17, 20);
  assert.equal(DM.usePotion(G, cap, 'poz_stipendio').left, 3);
  assert.match(DM.potionOnUnit(G, cap, 'poz_stipendio', 16, 20, true).msg, /Danni doppi/);
  assert.match(DM.potionOnUnit(G, cap, 'poz_stipendio', 16, 20, false).err, /non ancora/);
  assert.match(DM.potionOnUnit(G, cap, 'poz_stipendio', 17, 20, false).msg, /Danni doppi/);
  assert.equal(cap.inv.mat.poz_stipendio, 0);
  assert.equal(DM.stat(G, u2)[0], 140);
  assert.match(DM.potionOnUnit(G, cap, 'poz_velocita', 16, 20, true).msg, /Velocità/);
  assert.equal(cap.inv.mat.poz_velocita, 1);
  // Curatruppe: solo dentro l'edificio, 50% della vita
  const hurt = DM.addUnit(G, 'S', 0, 15, 20); hurt.hp = 10;
  assert.match(DM.potionOnUnit(G, cap, 'poz_curatruppe', 16, 20, true).err, /Nessuna/);
  assert.match(DM.potionOnUnit(G, cap, 'poz_curatruppe', 15, 20, true).msg, /vita 60/);
});
