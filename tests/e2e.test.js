// Prova dell'interfaccia in un browser vero (Chromium, telefono emulato), toccando mappa e pulsanti.
// Avvio: node --test tests/e2e.test.js   (SHOTS=cartella per salvare gli screenshot)
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('path');
const { chromium, devices } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const SHOTS = process.env.SHOTS;

let browser, page, errors = [];
const info = () => page.locator('#info').innerText();
const hud = () => page.locator('#hud').innerText();
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

// Tocca il punto (x, y) in cm della mappa, come farebbe un dito.
async function tapCm(x, y) {
  await ev(([x, y]) => { const v = document.getElementById('vp'), Z = DM.ui.Z; v.scrollLeft = x * Z - v.clientWidth / 2; v.scrollTop = y * Z - v.clientHeight / 2; }, [x, y]);
  await page.locator('#vp').scrollIntoViewIfNeeded();
  const box = await page.locator('#c').boundingBox(), Z = await ev(() => DM.ui.Z);
  await page.touchscreen.tap(box.x + x * Z, box.y + y * Z);
}
// Punto libero (r tra rmin e rmax da c), in Pianura; own = deve essere territorio del giocatore di turno
const freeSpot = (c, rmin, rmax, own) => ev(([c, rmin, rmax, own]) => {
  const G = DM.game;
  for (let r = rmin; r <= rmax; r += .2) for (let a = 0; a < 24; a++) {
    const x = c[0] + Math.cos(a * Math.PI / 12) * r, y = c[1] + Math.sin(a * Math.PI / 12) * r;
    if (DM.bAt(G, x, y) !== 'P' || (own && DM.terrAt(G, x, y) !== G.p)) continue;
    if (G.sites.concat(G.units).some(q => Math.hypot(q.x - x, q.y - y) < 1.2)) continue;
    return [x, y];
  }
}, [c, rmin, rmax, own]);
// Tocca più volte lo stesso punto finché nel pannello compare l'edificio voluto (truppe e edifici sovrapposti)
async function selectAt(x, y, re) {
  for (let i = 0; i < 5; i++) { await tapCm(x, y); if (re.test(await info())) return; }
  throw new Error('non riesco a selezionare ' + re + ': ' + await info());
}
const act = async (text) => { await page.locator('#info button', { hasText: text }).first().click(); };

// Punto di Pianura con tanta Pianura intorno, lontano da "lontano"
const findSpot = (far, minD) => ev(([far, minD]) => {
  const G = DM.game;
  let best = null, bs = -1;
  for (let y = 4; y < 38; y += .5) for (let x = 4; x < 56; x += .5) {
    if (DM.bAt(G, x, y) !== 'P' || DM.capitalSpotError(G, x, y, G.np)) continue;
    if (far && Math.hypot(x - far[0], y - far[1]) < minD) continue;
    let s = 0;
    for (let a = 0; a < 16; a++) for (const r of [1, 2, 3]) if (DM.bAt(G, x + Math.cos(a / 16 * 6.283) * r, y + Math.sin(a / 16 * 6.283) * r) === 'P') s++;
    if (s > bs) { bs = s; best = [x, y]; }
  }
  return best;
}, [far, minD]);

test.before(async () => {
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => d.accept());
  await page.goto(URL);
  await page.waitForSelector('[data-act=players]');
});
test.after(async () => { await browser.close(); });

test('partita completa sul telefono', async (t) => {
  let A, B;
  await t.test('preparazione: giocatori, kit, Capitali (anche nei punti vietati)', async () => {
    await act('2');
    assert.match(await info(), /Giocatore 1.*scegli il kit/s);
    await act('Tribù');
    await tapCm(.1, .1);
    assert.match(await info(), /Qui non si può/);
    A = await findSpot();
    await tapCm(A[0], A[1]);
    assert.match(await info(), /Giocatore 2.*scegli il kit/s);
    await act('Minatori');
    await tapCm(A[0] + 3, A[1]);
    assert.match(await info(), /minimo 15 cm/);
    B = await findSpot(A, 16);
    await tapCm(B[0], B[1]);
    assert.match(await hud(), /Giocatore 1.*Giro 1.*Mosse 0\/1.*Spari 0\/1/s);
    await shot('01-inizio');
  });

  await t.test('zoom e limite dei pixel del canvas', async () => {
    const z0 = await ev(() => DM.ui.Z);
    for (let i = 0; i < 20; i++) await page.click('#zi');
    const big = await ev(() => { const c = document.getElementById('c'); return [DM.ui.Z, c.width * c.height]; });
    assert.equal(big[0], 48);
    assert.ok(big[1] <= 8.1e6, 'canvas troppo grande per un telefono: ' + big[1]);
    for (let i = 0; i < 20; i++) await page.click('#zo');
    assert.equal(await ev(() => DM.ui.Z), z0);
    for (let i = 0; i < 5; i++) await page.click('#zi');   // circa 20 px per cm
  });

  await t.test('schierare dalla riserva, muovere, annullare', async () => {
    await page.selectOption('#sp', 'S');
    await tapCm(A[0] + 4, A[1]);
    assert.match(await info(), /Troppo lontano/);
    await page.selectOption('#sp', 'S');
    await tapCm(A[0] + 1.5, A[1]);
    assert.match(await info(), /Soldato schierato/);
    await page.selectOption('#sp', 'S');
    await tapCm(A[0] + 1.5, A[1] + .6);
    assert.match(await info(), /Soldato schierato/);
    await tapCm(A[0] + 1.5, A[1]);
    assert.match(await info(), /Tocca la destinazione.*Soldato su/s);
    const before = await ev(() => { const u = DM.ui.sel; return [u.id, u.x, u.y]; });
    // direzione con 1,2 cm di Pianura davanti (lontano dagli altri pezzi)
    const dir = await ev(([x, y]) => { for (let a = 0; a < 16; a++) { const dx = Math.cos(a * Math.PI / 8), dy = Math.sin(a * Math.PI / 8);
      if ([.2, .4, .6, .8, 1, 1.2].every(t => DM.bAt(DM.game, x + dx * t, y + dy * t) === 'P') && !DM.game.sites.concat(DM.game.units).some(q => Math.hypot(q.x - x - dx * 2, q.y - y - dy * 2) < 1)) return [dx, dy]; } }, [before[1], before[2]]);
    await tapCm(before[1] + dir[0] * 2, before[2] + dir[1] * 2);
    assert.match(await info(), /Mossa completata/);
    const moved = await ev(id => { const u = DM.unitById(DM.game, id); return [u.x, u.y, u.m]; }, before[0]);
    const d = Math.hypot(moved[0] - before[1], moved[1] - before[2]);
    assert.ok(moved[2] && Math.abs(d - 1) < .06, 'si è mosso di 1 cm in pianura: ' + d);
    await page.click('#undo');
    assert.match(await info(), /Mossa annullata/);
    assert.deepEqual(await ev(id => { const u = DM.unitById(DM.game, id); return [u.x, u.y]; }, before[0]), [before[1], before[2]]);
    await shot('02-truppe');
  });

  await t.test('esercito: formazione e uscita', async () => {
    await page.click('#army');
    await tapCm(A[0] + 1.5, A[1]);
    await tapCm(A[0] + 1.5, A[1] + .6);
    assert.match(await info(), /2 scelte \(2\/100 punti\)/);
    await page.click('#army');
    assert.match(await info(), /Esercito 1 formato/);
    assert.match(await info(), /Fai uscire una truppa/);
    await act('Soldato 100');
    assert.match(await info(), /Esercito 1 sciolto/);
    await act('Deseleziona');
    assert.doesNotMatch(await info(), /Soldato su/);
  });

  await t.test('edificio: info, schierare dentro, comprare, vendere al Banco, carico del Carro', async () => {
    await selectAt(A[0], A[1], /^Capitale/m);
    assert.match(await info(), /Capitale.*vita 20000\/20000.*250\.000 soldi/s);
    await act('Schiera Carro');
    assert.match(await info(), /Carro schierato/);
    await page.click('#ecoP summary');
    await page.selectOption('#by', 'S');
    await page.click('#bb');
    assert.match(await info(), /Non hai abbastanza risorse/);
    await ev(() => { const c = DM.capitalOf(DM.game, 0); c.inv.mat.rame = 2; c.inv.mat.piombo = 2; c.inv.mat.ferro = 1000; });
    await page.click('#bb');
    assert.match(await info(), /Soldato creato in Capitale/);
    await page.selectOption('#bm', 'ferro');
    await page.fill('#bq', '2');
    await page.click('#bs');
    assert.match(await info(), /Venduti 1000 kg di ferro per 6000 soldi/);
    await page.selectOption('#bm', 'rame');
    await page.fill('#bq', '1');
    await page.click('#bs');
    assert.match(await info(), /un solo tipo di materiale/);
    await page.fill('#cq', '1500');
    await act('Carica soldi');
    assert.match(await info(), /Caricati 1000 soldi/);
    assert.match(await info(), /Carro.*1000 soldi/s);
    await act('Scarica tutto');
    assert.match(await info(), /Scaricato in Capitale/);
    await page.click('#ecoP summary');
  });

  await t.test('Aeroporto dentro la Capitale: si vede e si apre', async () => {
    await selectAt(A[0], A[1], /^Capitale/m);
    assert.match(await info(), /Dentro:\s*✈ Aeroporto/);
    await act('✈ Aeroporto');
    assert.match(await info(), /^Aeroporto \(dentro una città\)/m);
    await act('Torna a Capitale');
    assert.match(await info(), /^Capitale/m);
    await shot('02b-aeroporto');
  });

  await t.test('trasporto: un Soldato sale sul Carro e scende', async () => {
    const ids = await ev(([x, y]) => { const G = DM.game, c = G.units.find(u => u.t === 'C' && u.o === 0), s = G.units.find(u => u.t === 'S' && u.o === 0 && Math.hypot(u.x - c.x, u.y - c.y) <= 1); return [c.id, s.id]; }, A);
    await ev(id => { DM.ui.sel = DM.unitById(DM.game, id); DM.ui.selB = null; DM.redraw(); }, ids[0]);
    assert.match(await info(), /A bordo: nessuno \(0\/4 punti truppa\)/);
    await act('Fai salire Soldato');
    assert.match(await info(), /Soldato è salito su Carro \(1\/4 punti\)/);
    assert.match(await info(), /A bordo: 1× Soldato/);
    await act('Fai scendere Soldato');
    assert.match(await info(), /Soldato è sceso da Carro/);
    await act('Deseleziona');
  });

  await t.test('Bomba dalla Capitale su una truppa nemica, con il cerchio di portata', async () => {
    await ev(([x, y]) => { const G = DM.game; DM.capitalOf(G, 0).inv.mat.bomba = 1; DM.addUnit(G, 'T', 1, x, y); }, [A[0] - 3, A[1]]);
    await selectAt(A[0], A[1], /^Capitale/m);
    await act('Lancia Bomba');
    assert.match(await info(), /portata 15 cm/);
    await shot('03-bomba');
    await tapCm(A[0] - 3, A[1]);
    assert.match(await info(), /Bomba: 5000 danni a 1 truppa \(1 distrutta\) e 0 edifici/);
    assert.match(await hud(), /Spari 3\/1/);
  });

  await t.test('fine turno e giri', async () => {
    await page.click('#end');
    assert.match(await hud(), /Giocatore 2.*Giro 1/s);
    await page.click('#end');
    assert.match(await hud(), /Giocatore 1.*Giro 2/s);
  });

  await t.test('sparo singolo e sparo con esercito', async () => {
    await tapCm(A[0] + 1.5, A[1]);
    await page.click('#shoot');
    assert.match(await info(), /Tocca il bersaglio/);
    await ev(([x, y]) => { DM.addUnit(DM.game, 'S', 1, x, y); }, [A[0] + 1.5, A[1] - .8]);
    await tapCm(A[0] + 1.5, A[1] - .8);
    assert.match(await info(), /1 truppa ha sparato: 70 danni/);
    await page.click('#shoot');
    assert.match(await info(), /Limite di spari/);
  });

  await t.test('costruire un Accampamento, una strada e provare il ponte', async () => {
    await page.selectOption('#sp', 'acc');
    await tapCm(A[0] + 1.5, A[1] + 1.2);
    assert.match(await info(), /Accampamento costruito/);
    await selectAt(A[0], A[1], /^Capitale/m);
    await act('Collega con strada');
    await tapCm(A[0] + 1.5, A[1] + 1.2);
    assert.match(await info(), /Servono \(in totale nei due edifici\)/);
    await ev(() => { const c = DM.capitalOf(DM.game, 0); c.inv.mat.ferro = 5000; c.inv.mat.oro = 500; });
    await selectAt(A[0], A[1], /^Capitale/m);
    await act('Collega con strada');
    await tapCm(A[0] + 1.5, A[1] + 1.2);
    assert.match(await info(), /Strada costruita/);
    await selectAt(A[0], A[1], /^Capitale/m);
    await act('Ponte liv.1');
    await tapCm(A[0] + 1, A[1] + 1);
    assert.match(await info(), /attraversare l’acqua/);
    await shot('04-strada');
  });

  await t.test('cessione di territorio a nessuno', async () => {
    await page.click('#ced');
    assert.equal(await page.isChecked('#oR'), true, 'mostra i territori');
    // linea verticale a destra della Capitale e punto di territorio mio oltre la linea
    const side = await ev(([x, y]) => { for (let dx = 2.4; dx < 4; dx += .1) if (DM.terrAt(DM.game, x + dx + .4, y) === 0) return dx; }, A);
    await tapCm(A[0] + side, A[1] - 4.5);
    await tapCm(A[0] + side, A[1] + 4.5);
    await page.click('#ced');
    assert.match(await info(), /dal lato che vuoi cedere/);
    await tapCm(A[0] + side + .4, A[1]);
    assert.match(await info(), /Cessione.*cm².*A chi\?/s);
    await shot('05-cessione');
    await act('Nessuno');
    assert.match(await info(), /Territorio ceduto \(senza proprietario\)/);
    assert.equal(await ev(([x, y]) => DM.terrAt(DM.game, x, y), [A[0] + side + .4, A[1]]), -1);
    assert.equal(await ev(([x, y]) => DM.terrAt(DM.game, x, y), [A[0], A[1]]), 0);
  });

  await t.test('miniera con il dado animato (giocatore 2, Minatori)', async () => {
    await page.click('#end');
    await page.selectOption('#sp', 'S');
    await tapCm(B[0] + 1.5, B[1]);
    await page.selectOption('#sp', 'min');
    await tapCm(B[0] + 1.5, B[1] + 1);
    await page.waitForFunction(() => /Il dado gira/.test(document.getElementById('info').innerText));
    await page.waitForFunction(() => /Miniera costruita: dado \d/.test(document.getElementById('info').innerText), null, { timeout: 5000 });
    assert.match(await info(), /Miniera.*Contiene/s);
  });

  await t.test('opzioni di visualizzazione e legenda', async () => {
    await page.click('#opt summary');
    await page.uncheck('#oB');
    assert.equal(await page.isChecked('#oR'), true);
    assert.match(await page.locator('#leg').innerText(), /Terra.*Mare.*Territorio Giocatore 1/s);
    await page.uncheck('#oU');
    await tapCm(B[0], B[1]);
    assert.match(await info(), /Truppe nascoste/);
    await page.check('#oU'); await page.check('#oB'); await page.uncheck('#oS');
    await page.check('#oG');
    assert.match(await page.locator('#leg').innerText(), /✈\s*Aeroporto/);
    await shot('06-vista');
  });

  await t.test('nuova partita (con conferma)', async () => {
    await page.click('text=Nuova partita');
    await page.click('#map');
    await page.waitForSelector('[data-act=players]');
    assert.match(await hud(), /Preparazione/);
  });

  await t.test('nessun errore JavaScript nella pagina', () => { assert.deepEqual(errors, []); });
});

test('pulsanti dei pannelli: pozioni, bacche, Superbomba, dado dei Maghi, edifici, cessioni, nuova Capitale', async (t) => {
  // partita nuova sulla mappa numero 7: Maghi contro Tribù
  await page.fill('#seed', '7');
  await page.click('#map');
  await page.waitForSelector('[data-act=players]');
  assert.match(await page.locator('#seedInfo').innerText(), /numero 7/);
  await act('2'); await act('Maghi');
  const A = await findSpot(); await tapCm(A[0], A[1]);
  await act('Tribù');
  const B = await findSpot(A, 16); await tapCm(B[0], B[1]);
  for (let i = 0; i < 5; i++) await page.click('#zi');
  const S1 = await freeSpot(A, 1.2, 1.9, true);
  await page.selectOption('#sp', 'S'); await tapCm(S1[0], S1[1]);
  assert.match(await info(), /Soldato schierato/);

  await t.test('miniera: i Maghi scelgono il dado', async () => {
    const M = await freeSpot(S1, 1.2, 1.9, true);
    await page.selectOption('#sp', 'min');
    await tapCm(M[0], M[1]);
    assert.match(await info(), /scegli il risultato del dado.*ancora 2/s);
    await act('5');
    await page.waitForFunction(() => /Miniera costruita: dado 5/.test(document.getElementById('info').innerText), null, { timeout: 5000 });
    assert.equal(await ev(() => DM.cur(DM.game).dice), 1);
  });

  await t.test('pozioni dalla Capitale', async () => {
    await selectAt(A[0], A[1], /^Capitale/m);
    await act('Usa Velocità');
    assert.match(await info(), /Tocca la truppa/);
    await tapCm(S1[0], S1[1]);
    assert.match(await info(), /Velocità potenziata per questo turno \(1 truppa\)/);
    await selectAt(A[0], A[1], /^Capitale/m);
    await act('Usa Stipendio+');
    await tapCm(S1[0], S1[1]);
    assert.match(await info(), /Danni doppi.*ancora 2/s);
    await act('Fatto');
    await selectAt(A[0], A[1], /^Capitale/m);
    await ev(() => { DM.capitalOf(DM.game, 0).hp = 15000; });
    await act('Usa Curacittà');
    assert.match(await info(), /vita 19000/);
    await act('Usa Ignifuga');
    assert.match(await info(), /protetto dalle eruzioni/);
  });

  await t.test('bacca e Superbomba', async () => {
    const E = await freeSpot(A, 3, 8, false);
    await ev(([x, y]) => { const G = DM.game, c = DM.capitalOf(G, 0); c.inv.mat.bacca_tundra = 1; c.inv.mat.superbomba = 1; DM.addUnit(G, 'S', 1, x, y); G.round = 16; }, E);
    await selectAt(A[0], A[1], /^Capitale/m);
    await act('Bacca tundra');
    await tapCm(E[0], E[1]);
    assert.match(await info(), /Bacca tundra lanciata su 1 truppa per 3 giri/);
    await selectAt(A[0], A[1], /^Capitale/m);
    await act('Lancia Superbomba');
    assert.match(await info(), /portata 30 cm, colpisce tutto entro 0,5 cm/);
    await tapCm(E[0], E[1]);
    assert.match(await info(), /Superbomba: 20\.000 danni a 1 truppa \(1 distrutta\).*Area radioattiva/s);
    assert.match(await hud(), /Giocatore 1.*Spari 5\/5/s, 'il turno non finisce');
    await shot('07-superbomba');
  });

  await t.test('Accampamento → Città, Porto e Aeroporto dentro, cedi edificio', async () => {
    const K = await freeSpot(S1, 1.2, 1.9, true);
    await page.selectOption('#sp', 'acc'); await tapCm(K[0], K[1]);
    assert.match(await info(), /Accampamento costruito/);
    await selectAt(K[0], K[1], /^Accampamento/m);
    await act('Trasforma in Città');
    assert.match(await info(), /Servono in questo Accampamento: 45\.000 soldi/);
    await ev(([x, y]) => { const s = DM.siteNear(DM.game, x, y, z => z.k === 'acc')[0]; s.inv.mon = 50000; s.inv.mat.argento = 500; s.inv.mat.ferro = 200; }, [K[0], K[1]]);
    await act('Trasforma in Città');
    assert.match(await info(), /ora è una Città/);
    await ev(() => { DM.cur(DM.game).res.aer = 1; });
    await selectAt(K[0], K[1], /^Città/m);
    await act('Aeroporto dentro');
    assert.match(await info(), /Aeroporto costruito dentro la Città/);
    await selectAt(K[0], K[1], /^Città/m);
    await act('Porto dentro');
    assert.match(await info(), /Porto costruito dentro|0,2 cm dall’acqua/);
    await selectAt(K[0], K[1], /^Città/m);
    await act('Cedi edificio');
    await act('Giocatore 2');
    assert.match(await info(), /Città ceduto a Giocatore 2/);
    assert.equal(await ev(([x, y]) => DM.siteNear(DM.game, x, y, z => z.k === 'citta')[0].o, [K[0], K[1]]), 1);
  });

  await t.test('cessione a un nuovo giocatore', async () => {
    // zona di territorio mio lontana dalle Capitali, tagliata da una linea verticale
    const C = await findSpot(A, 16);
    const okB = await ev(([c, b]) => Math.hypot(c[0] - b[0], c[1] - b[1]) >= 10, [C, B]);
    assert.ok(C && okB, 'sulla mappa 7 serve un punto per la nuova Capitale');
    await ev(c => DM.claim(DM.game, 0, c[0], c[1]), C);
    await page.click('#ced');
    await tapCm(C[0] + 1, C[1] - 3); await tapCm(C[0] + 1, C[1] + 3);
    await page.click('#ced');
    await tapCm(C[0], C[1]);
    assert.match(await info(), /Cessione/);
    await act('Nuovo giocatore');
    await act('Navigatori');
    assert.match(await info(), /Giocatore 3 \(kit Navigatori\) è entrato in gioco/);
    const cap = await ev(() => { const c = DM.capitalOf(DM.game, 2); return [c.x, c.y]; });
    assert.ok(Math.hypot(cap[0] - A[0], cap[1] - A[1]) >= 10 && Math.hypot(cap[0] - B[0], cap[1] - B[1]) >= 10);
    await shot('08-nuovo-giocatore');
  });

  await t.test('Capitale distrutta: si sceglie una Città', async () => {
    await page.click('#end');   // tocca al giocatore 2
    await ev(([x, y]) => { const G = DM.game, c = DM.addSite(G, 1, 'citta', x, y); const acc = DM.addSite(G, 1, 'acc', x - 2, y); acc.inv.mon = 300000; c.inv.mon = 1000; DM.destroySite(G, DM.capitalOf(G, 1)); }, [B[0] + 1, B[1] + 1]);
    assert.equal(await ev(() => DM.cur(DM.game).noCap), true);
    await ev(() => DM.redraw());
    assert.match(await hud(), /Senza Capitale!/);
    await selectAt(B[0] + 1, B[1] + 1, /^Città/m);
    await act('Fai diventare Capitale');
    assert.match(await info(), /Servono qui almeno metà dei tuoi soldi/);
    await ev(([x, y]) => { const G = DM.game, c = DM.siteNear(G, x, y, z => z.k === 'citta' && z.o === 1)[0]; c.inv.mon = 200000; DM.sitesOf(G, 1).find(z => z.k === 'acc').inv.mon = 1000; DM.redraw(); }, [B[0] + 1, B[1] + 1]);
    await act('Fai diventare Capitale');
    assert.match(await info(), /Questa Città ora è la tua Capitale/);
    assert.doesNotMatch(await hud(), /Senza Capitale/);
  });

  await t.test('nessun errore JavaScript nella pagina', () => { assert.deepEqual(errors, []); });
});

test('salvataggi: ricaricare la pagina e riprendere, copie, file', async (t) => {
  // partita sulla mappa 7, una mossa, poi ricarico la pagina
  await page.fill('#seed', '7');
  await page.click('#map');
  await page.waitForSelector('[data-act=players]');
  await act('2'); await act('Tribù');
  const A = await findSpot(); await tapCm(A[0], A[1]);
  await act('Tribù');
  const B = await findSpot(A, 16); await tapCm(B[0], B[1]);
  const S1 = await freeSpot(A, 1.2, 1.9, true);
  await page.selectOption('#sp', 'S'); await tapCm(S1[0], S1[1]);
  await ev(() => { DM.capitalOf(DM.game, 0).inv.mat.ferro = 4321; });
  await page.click('#end');
  const before = await ev(() => DM.serialize(DM.game));

  await t.test('la pagina si ricarica: "Riprendi la partita" la riporta com’era', async () => {
    await page.reload();
    await page.waitForSelector('[data-act=resume]');
    assert.match(await info(), /Partita salvata.*giro 1, 2 giocatori, tocca a Giocatore 2/s);
    await act('Riprendi la partita');
    assert.match(await hud(), /Giocatore 2.*Giro 1/s);
    const after = await ev(() => DM.serialize(DM.game));
    assert.equal(JSON.stringify({ ...JSON.parse(after), saved: 0 }), JSON.stringify({ ...JSON.parse(before), saved: 0 }));
  });

  await t.test('copia salvata, nuova mossa, ricarico la copia', async () => {
    await page.click('#saveP summary');
    await page.click('#saveT [data-act=saveslot]');
    assert.match(await info(), /Copia salvata/);
    assert.match(await page.locator('#saveT').innerText(), /giro 1 · tocca a Giocatore 2/);
    await page.click('#end');
    assert.match(await hud(), /Giro 2/);
    await page.click('#saveT [data-act=loadslot]');
    assert.match(await info(), /Copia caricata/);
    assert.match(await hud(), /Giocatore 2.*Giro 1/s);
    await page.click('#saveT [data-act=delslot]');
    assert.doesNotMatch(await page.locator('#saveT').innerText(), /tocca a/);
  });

  await t.test('scarica il file e riaprilo', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#saveT [data-act=download]')]);
    assert.match(dl.suggestedFilename(), /^damamondo-giro1-.*\.json$/);
    const file = await dl.path();
    await page.click('#end'); await page.click('#end');
    assert.match(await hud(), /Giro 2/);
    await page.setInputFiles('#openfile', file);
    await page.waitForFunction(() => /Partita aperta dal file/.test(document.getElementById('info').innerText));
    assert.match(await hud(), /Giocatore 2.*Giro 1/s);
    assert.equal(await ev(() => DM.capitalOf(DM.game, 0).inv.mat.ferro), 4321);
    await shot('09-salvataggi');
  });

  await t.test('un file sbagliato dà un messaggio, non rompe la partita', async () => {
    await page.setInputFiles('#openfile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
    await page.waitForFunction(() => /Non riesco a caricare/.test(document.getElementById('info').innerText));
    assert.match(await hud(), /Giro 1/);
  });

  await t.test('nessun errore JavaScript nella pagina', () => { assert.deepEqual(errors, []); });
});
