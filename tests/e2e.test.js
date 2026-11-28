// Prova dell'interfaccia in un browser vero (Chromium, telefono emulato), toccando mappa e pulsanti.
// Avvio: node --test tests/e2e.test.js   (SHOTS=cartella per salvare gli screenshot)
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('path');
const { chromium, devices } = require('playwright');
const { serve } = require('./server');
let URL, srv;
const SHOTS = process.env.SHOTS;

let browser, page, errors = [];
const info = () => page.locator('#info').innerText();
const hud = () => page.locator('#hud').innerText();
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async name => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

// Tocca il punto (x, y) in cm della mappa, come farebbe un dito.
async function tapCm(x, y) {
  await ev(([x, y]) => { const v = document.getElementById('vp'), Z = DM.ui.Z; const c = document.getElementById('c'); v.scrollLeft = c.offsetLeft + x * Z - v.clientWidth / 2; v.scrollTop = c.offsetTop + y * Z - v.clientHeight * .4; }, [x, y]);
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
// Dal menu: Gioca → Locale → Nuova partita (fa posto se ci sono già 3 partite)
async function newFromMenu(np, seed) {
  if (!(await page.locator('#game').isHidden())) await page.click('#toMenu');
  await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
  while ((await page.locator('[data-m=elimina]').count()) >= 3) { await page.locator('[data-m=elimina]').last().click(); await page.click('[data-m=eliminaSi]'); }
  await page.click('[data-m=nuova]');
  await page.click(`[data-m=np][data-arg="${np}"]`);
  if (seed) await page.fill('#seed', String(seed));
  await page.click('[data-m=inizia]');
  await page.waitForSelector('[data-act=kit]');
}
// la tendina (Banco, Vista, Partita, Aiuto)
const side = async tab => { await page.click('#hud [data-side]'); await page.click(`#side [data-tab=${tab}]`); };
const closeSide = () => page.click('#side .x');
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
  srv = await serve(); URL = srv.url;
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  // in queste prove le animazioni sono spente (tutto subito); le animazioni hanno la loro prova (fx.test.js)
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('damamondo-impostazioni')) localStorage.setItem('damamondo-impostazioni', '{"anim":false}'); } catch (e) {} });
  page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // come dentro claude.ai: le finestrine del browser vengono rifiutate, e il gioco non deve usarle
  page.on('dialog', d => { errors.push('finestrina del browser: ' + d.message()); d.dismiss(); });
  await page.goto(URL);
  await page.waitForSelector('[data-m=gioca]');
});
test.after(async () => { await browser.close(); srv.close(); });

test('partita completa sul telefono', async (t) => {
  let A, B;
  await t.test('menu: titolo, Gioca, Multiplayer "coming soon", Regole', async () => {
    assert.match(await page.locator('#menu').innerText(), /DAMAMONDO/);
    assert.deepEqual(await page.locator('.social a').evaluateAll(as => as.map(a => a.href)), ['https://www.youtube.com/@Damamondo', 'https://www.tiktok.com/@damamondo']);
    assert.match(await page.locator('.social').innerText(), /@Damamondo[\s\S]*@damamondo/);
    await page.click('[data-m=gioca]');
    await page.click('[data-m=multi]');
    assert.match(await page.locator('#menu').innerText(), /Coming soon/i);
    await page.click('[data-m=gioca]');
    await page.click('[data-m=home]');
    await page.click('[data-m=regole]');
    const r = await page.locator('.rules').innerText();
    assert.match(r, /1\. Introduzione/); assert.doesNotMatch(r, /Scelte del prototipo/); assert.match(r, /0,7 cm usa 1 pezzo/);
    assert.match(r, /Carrarmato\s+2\s+1500/);
    assert.doesNotMatch(r, /undefined|NaN/);
    assert.equal(await page.locator('.rules section').count(), 16);
    await page.locator('[data-m=home]').first().click();
    await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
    assert.match(await page.locator('#menu').innerText(), /Nessuna partita salvata/);
  });

  await t.test('preparazione: giocatori, kit, Capitali (anche nei punti vietati)', async () => {
    await page.click('[data-m=nuova]');
    await page.fill('#seed', '7');
    await page.click('[data-m=inizia]');
    await page.waitForSelector('[data-act=kit]');
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
    assert.equal(big[0], 96, 'si può ingrandire fino a 96 px per cm');
    assert.ok(big[1] <= 8.1e6, 'canvas troppo grande per un telefono: ' + big[1]);
    for (let i = 0; i < 20; i++) await page.click('#zo');
    const zmin = await ev(() => DM.ui.Z);
    assert.ok(zmin < z0, 'all’inizio la mappa riempie lo schermo; rimpicciolendo si vede tutta');
    assert.ok(zmin * 60 <= 390 && zmin * 42 <= 844, 'tutta la mappa sta nello schermo');
    while (await ev(() => DM.ui.Z) < 19) await page.click('#zi');   // circa 20 px per cm
  });

  await t.test('schierare dalla riserva, muovere, annullare', async () => {
    await page.selectOption('#sp', 'S');
    await tapCm(A[0] + 4, A[1]);
    assert.match(await info(), /Troppo lontano/);
    await page.selectOption('#sp', 'S');
    await tapCm(A[0] + 1.5, A[1]);
    assert.match(await info(), /Soldato schierato.*Nella riserva: ancora \d+/s);
    // resta selezionato: se ne mette subito un altro, poi "Deseleziona"
    assert.equal(await page.inputValue('#sp'), 'S');
    assert.equal(await page.locator('#sp option').first().innerText(), '✕ Deseleziona');
    await tapCm(A[0] + 1.5, A[1] + .6);
    assert.match(await info(), /Soldato schierato/);
    await act('Deseleziona');
    assert.equal(await ev(() => DM.ui.spawn), '');
    assert.equal(await page.locator('#sp option').first().innerText(), 'Schiera o costruisci dalla riserva…');
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
    assert.match(await info(), /Capitale.*vita 20000\/20000/s);
    // fumetto sopra la Capitale: cosa contiene, senza aprire niente
    assert.equal(await page.isVisible('#bubble'), true);
    assert.match(await page.locator('#bubble').innerText(), /Capitale[\s\S]*250\.000 soldi[\s\S]*Dentro: Aeroporto/);
    const bb = await page.locator('#bubble').boundingBox(), cv = await page.locator('#c').boundingBox(), Zb = await ev(() => DM.ui.Z);
    assert.ok(Math.abs(bb.x + bb.width / 2 - (cv.x + A[0] * Zb)) < bb.width / 2, 'il fumetto è sopra la Capitale');
    assert.ok(bb.y + bb.height < cv.y + A[1] * Zb || bb.y > cv.y + A[1] * Zb, 'non copre la Capitale');
    await act('Schiera Carro');
    assert.match(await info(), /Carro schierato/);
    await side('ecoP');
    assert.match(await page.locator('#shop').innerText(), /Soldato[\s\S]*5\.?000[\s\S]*1 t rame[\s\S]*1 t piombo/, 'nel negozio si vedono i costi');
    assert.match(await page.locator('#shop').innerText(), /Superbomba[\s\S]*500\.000[\s\S]*50 kg uranio/);
    assert.equal(await page.locator('#shop .item.no', { hasText: 'Soldato' }).count(), 1, 'senza rame e piombo il Soldato è "spento"');
    await page.click('#shop [data-arg=S]');
    assert.match(await info(), /Non hai abbastanza risorse/);
    await ev(() => { const c = DM.capitalOf(DM.game, 0); c.inv.mat.rame = 2; c.inv.mat.piombo = 2; c.inv.mat.ferro = 1000; DM.redraw(); });
    assert.equal(await page.locator('#shop .item.no', { hasText: 'Soldato' }).count(), 0, 'ora si può comprare');
    await page.click('#shop [data-arg=S]');
    assert.match(await info(), /Soldato creato in Capitale/);
    await page.selectOption('#bm', 'ferro');
    await page.fill('#bq', '2');
    await page.click('#bs');
    assert.match(await info(), /Venduti 1000 kg di ferro per 6000 soldi/);
    await page.selectOption('#bm', 'rame');
    await page.fill('#bq', '1');
    await page.click('#bs');
    assert.match(await info(), /un solo tipo di materiale/);
    assert.match(await page.locator('#ecoMsg').innerText(), /un solo tipo di materiale/, 'il messaggio si legge anche nella tendina');
    await closeSide();
    await page.fill('#cq', '1500');
    await act('Carica soldi');
    assert.match(await info(), /Caricati 1000 soldi/);
    assert.match(await info(), /Carro.*1000 soldi/s);
    await act('Scarica tutto');
    assert.match(await info(), /Scaricato in Capitale/);
  });

  await t.test('Aeroporto dentro la Capitale: si vede e si apre', async () => {
    await selectAt(A[0], A[1], /^Capitale/m);
    assert.match(await page.locator('#bubble').innerText(), /Dentro: Aeroporto/);
    assert.match(await info(), /Apri l’Aeroporto/);
    await act('Apri l’Aeroporto');
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
    // un punto di Pianura nel proprio territorio, vicino alla Capitale (lì accanto c'è un fiume)
    const P = await freeSpot(A, 1.3, 1.9, true);
    await page.selectOption('#sp', 'acc');
    await tapCm(P[0], P[1]);
    assert.match(await info(), /Accampamento costruito/);
    await page.selectOption('#sp', '');   // anche la prima voce della riserva deseleziona
    await selectAt(A[0], A[1], /^Capitale/m);
    await act('Collega con strada');
    await tapCm(P[0], P[1]);
    assert.match(await info(), /Servono \(in totale nei due edifici\)/);
    await ev(() => { const c = DM.capitalOf(DM.game, 0); c.inv.mat.ferro = 5000; c.inv.mat.oro = 500; });
    await selectAt(A[0], A[1], /^Capitale/m);
    await act('Collega con strada');
    await tapCm(P[0], P[1]);
    assert.match(await info(), /Strada costruita/);
    // il ponte si posa dalla riserva con due tocchi (qui non c'è acqua, quindi non si può)
    await page.selectOption('#sp', 'ponte1');
    assert.match(await info(), /Ogni cm di ponte usa un pezzo/);
    await tapCm(A[0] + .8, A[1] + .8);
    assert.match(await info(), /dall’altra parte dell’acqua/);
    await tapCm(A[0] + 1.3, A[1] + .9);
    assert.match(await info(), /non c’è acqua|Tocca la terra/);
    await shot('04-strada');
  });

  await t.test('scegliere il bersaglio: l’edificio o le truppe che ci sono dentro', async () => {
    await page.click('#end'); await page.click('#end');
    const P = [A[0] + 1.5, A[1] - .9];
    await ev(([x, y]) => { const G = DM.game; DM.addSite(G, 1, 'acc', x, y); DM.addUnit(G, 'S', 1, x, y); DM.ui.sel = G.units.find(u => u.o === 0 && u.t === 'S' && Math.hypot(u.x - x, u.y - y) <= 1); DM.ui.selB = null; DM.redraw(); }, P);
    await page.click('#shoot');
    await tapCm(P[0], P[1]);
    assert.match(await info(), /A cosa spari\?/);
    assert.match(await info(), /Truppe dentro Accampamento di Giocatore 2/);
    await shot('04b-bersaglio');
    await page.locator('#info button', { hasText: /^Accampamento di Giocatore 2/ }).click();
    assert.match(await info(), /1 truppa ha sparato: 70 danni a Accampamento/);
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
    await ev(() => DM.Prefs.set({ anim: true }));   // qui il dado rotola davvero
    await tapCm(B[0] + 1.5, B[1] + 1);
    await page.waitForFunction(() => /Il dado gira/.test(document.getElementById('info').innerText));
    assert.equal(await page.isVisible('#dice'), true, 'il dado si vede sopra la mappa');
    await page.waitForFunction(() => /Miniera costruita: dado \d/.test(document.getElementById('info').innerText), null, { timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('dice').hidden, null, { timeout: 5000 });
    assert.match(await info(), /Miniera/);
    assert.match(await page.locator('#bubble').innerText(), /Miniera[\s\S]*(t|kg|l) /, 'nel fumetto c’è la prima produzione');
    await ev(() => DM.Prefs.set({ anim: false }));
  });

  await t.test('opzioni di visualizzazione e legenda', async () => {
    await side('opt');
    await page.uncheck('#oB');
    assert.equal(await page.isChecked('#oR'), true);
    assert.match(await page.locator('#leg').innerText(), /Terra.*Mare.*Territorio Giocatore 1/s);
    await page.uncheck('#oU');
    await closeSide();
    await tapCm(B[0], B[1]);
    assert.match(await info(), /Truppe nascoste/);
    await side('opt');
    assert.equal(await page.isChecked('#oS'), false, 'i fogli sono nascosti di partenza');
    await page.check('#oS'); await page.uncheck('#oS');
    await page.check('#oU'); await page.check('#oB');
    await page.check('#oG');
    assert.equal(await page.locator('#oD').count(), 0, '"Dettagli quando ingrandisci" è passato nelle Impostazioni');
    assert.match(await page.locator('#leg').innerText(), /✈\s*Aeroporto/);
    await shot('06-vista');
    await closeSide();
  });

  await t.test('Menu e ritorno: la partita resta in Locale e si continua', async () => {
    const round = await ev(() => DM.game.round);
    await page.click('#toMenu');
    await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
    assert.match(await page.locator('#menu').innerText(), new RegExp('Partita 1[\\s\\S]*2 giocatori · giro ' + round));
    await page.click('[data-m=continua]');
    assert.match(await hud(), new RegExp('Giro ' + round));
  });

  await t.test('nessun errore JavaScript nella pagina', () => { assert.deepEqual(errors, []); });
});

test('pulsanti dei pannelli: pozioni, bacche, Superbomba, dado dei Maghi, edifici, cessioni, nuova Capitale', async (t) => {
  // partita nuova sulla mappa numero 7: Maghi contro Tribù
  await newFromMenu(2, 7);
  assert.match(await page.locator('#seedInfo').textContent(), /numero 7/);
  await act('Maghi');
  const A = await findSpot(); await tapCm(A[0], A[1]);
  await act('Tribù');
  const B = await findSpot(A, 16); await tapCm(B[0], B[1]);
  for (let i = 0; i < 5; i++) await page.click('#zi');
  const S1 = await freeSpot(A, 1.2, 1.9, true);
  await page.selectOption('#sp', 'S'); await tapCm(S1[0], S1[1]);
  assert.match(await info(), /Soldato schierato/);

  await t.test('miniera: i Maghi scelgono il minerale', async () => {
    const M = await freeSpot(S1, 1.2, 1.9, true);
    await page.selectOption('#sp', 'min');
    await tapCm(M[0], M[1]);
    assert.match(await info(), /scegli il minerale.*ancora 2/s);
    const mats = await ev(([x, y]) => DM.MINE_TABLE[DM.bAt(DM.game, x, y)].split(' '), M);
    const want = mats[4];   // un minerale del bioma (quello del 5 sul dado)
    assert.equal(await page.locator('#info button[data-act=minedie]').count(), new Set(mats).size + 1, 'un pulsante per minerale, più "Tira il dado"');
    await page.locator('#info button[data-act=minedie]', { hasText: new RegExp('^' + want + '$', 'i') }).click();
    await page.waitForFunction(w => new RegExp('Miniera costruita: scelto ' + w).test(document.getElementById('info').innerText), want, { timeout: 5000 });
    assert.equal(await ev(() => DM.game.sites.filter(s => s.k === 'min').pop().mt), want);
    assert.equal(await ev(() => DM.cur(DM.game).dice), 1);
    await act('Deseleziona');
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
  await newFromMenu(2, 7);
  await act('Tribù');
  const A = await findSpot(); await tapCm(A[0], A[1]);
  await act('Tribù');
  const B = await findSpot(A, 16); await tapCm(B[0], B[1]);
  const S1 = await freeSpot(A, 1.2, 1.9, true);
  await page.selectOption('#sp', 'S'); await tapCm(S1[0], S1[1]);
  await ev(() => { DM.capitalOf(DM.game, 0).inv.mat.ferro = 4321; });
  await page.click('#end');
  const before = await ev(() => DM.serialize(DM.game));

  await t.test('la pagina si ricarica: da Gioca → Locale la partita è com’era', async () => {
    await page.reload();
    await page.waitForSelector('[data-m=gioca]');
    await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
    const first = page.locator('.card.slot').first();
    assert.match(await first.innerText(), /2 giocatori · giro 1 · tocca a Giocatore 2/);
    await first.locator('[data-m=continua]').click();
    assert.match(await hud(), /Giocatore 2.*Giro 1/s);
    const after = await ev(() => DM.serialize(DM.game));
    assert.equal(JSON.stringify({ ...JSON.parse(after), saved: 0 }), JSON.stringify({ ...JSON.parse(before), saved: 0 }));
  });

  await t.test('al massimo 3 partite; Elimina fa posto', async () => {
    await page.click('#toMenu'); await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
    while ((await page.locator('.card.slot').count()) < 3) {
      await page.click('[data-m=nuova]'); await page.click('[data-m=inizia]'); await page.waitForSelector('[data-act=kit]');
      await page.click('#toMenu'); await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
    }
    assert.equal(await page.locator('[data-m=nuova]').count(), 0);
    assert.match(await page.locator('#menu').innerText(), /Hai già 3 partite/);
    await page.locator('[data-m=elimina]').last().click();
    assert.match(await page.locator('#menu').innerText(), /Eliminare questa partita\?/);
    await page.click('[data-m=eliminaNo]');
    assert.equal(await page.locator('.card.slot').count(), 3, 'con No non si elimina');
    await page.locator('[data-m=elimina]').last().click();
    await page.click('[data-m=eliminaSi]');
    assert.match(await page.locator('#menu').innerText(), /Partita eliminata/);
    assert.equal(await page.locator('.card.slot').count(), 2);
    assert.equal(await page.locator('[data-m=nuova]').count(), 1);
    // torno alla partita della prova (la più recente con il giro 1 e tocca a Giocatore 2)
    const card = page.locator('.card.slot', { hasText: 'tocca a Giocatore 2' }).first();
    await card.locator('[data-m=continua]').click();
    assert.match(await hud(), /Giocatore 2.*Giro 1/s);
  });

  await t.test('scarica il file e riaprilo', async () => {
    await side('saveP');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#saveT [data-act=download]')]);
    assert.match(dl.suggestedFilename(), /^damamondo-giro1-.*\.json$/);
    const file = await dl.path();
    await closeSide();
    await page.click('#end'); await page.click('#end');
    assert.match(await hud(), /Giro 2/);
    await page.setInputFiles('#openfile', file);
    await page.waitForSelector('[data-act=fileyes]');
    await act('Sì, apri il file');
    await page.waitForFunction(() => /Partita aperta dal file/.test(document.getElementById('info').innerText));
    assert.match(await hud(), /Giocatore 2.*Giro 1/s);
    assert.equal(await ev(() => DM.capitalOf(DM.game, 0).inv.mat.ferro), 4321);
    await shot('09-salvataggi');
  });

  await t.test('Apri da file dal menu: diventa una partita nuova', async () => {
    await side('saveP');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#saveT [data-act=download]')]);
    const file = await dl.path();
    await closeSide();
    await page.click('#toMenu'); await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
    const n = await page.locator('.card.slot').count();
    if (n >= 3) { await page.locator('[data-m=elimina]').last().click(); await page.click('[data-m=eliminaSi]'); }
    await page.setInputFiles('#menufile', file);
    await page.waitForFunction(() => /Partita aperta dal file/.test(document.getElementById('info').innerText));
    assert.equal(await ev(() => DM.capitalOf(DM.game, 0).inv.mat.ferro), 4321);
  });

  await t.test('un file sbagliato dà un messaggio, non rompe la partita', async () => {
    await page.setInputFiles('#openfile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
    await page.waitForSelector('[data-act=fileyes]');
    await act('Sì, apri il file');
    await page.waitForFunction(() => /Non riesco a caricare/.test(document.getElementById('info').innerText));
    assert.match(await hud(), /Giro 1/);
  });

  await t.test('nessun errore JavaScript nella pagina', () => { assert.deepEqual(errors, []); });
});

test('impostazioni: ingranaggio nel menu e in partita, musica sì/no e volume ricordati', async () => {
  if (!(await page.locator('#game').isHidden())) await page.click('#toMenu');
  await page.locator('#menu .gear').click();
  assert.equal(await page.isVisible('#settings'), true);
  await page.waitForFunction(() => DM.Music.playing, null, { timeout: 3000 });   // dopo un tocco la musica suona (l'audio parte in un attimo)
  await page.fill('#setVol', '40'); await page.dispatchEvent('#setVol', 'input');
  assert.match(await page.locator('#setVolOut').innerText(), /40%/);
  await page.click('#setMusic');
  assert.deepEqual(await ev(() => DM.Music.settings), { music: false, volume: .4 });
  await page.click('#setClose');
  assert.equal(await page.isHidden('#settings'), true);
  await page.reload(); await page.waitForSelector('[data-m=gioca]');
  assert.deepEqual(await ev(() => DM.Music.settings), { music: false, volume: .4 }, 'ricordate dopo la ricarica');
  await page.click('[data-m=gioca]');
  assert.equal(await ev(() => DM.Music.playing), false, 'spenta: non riparte');
  await page.click('[data-m=locale]'); await page.click('[data-m=continua] >> nth=0');
  await page.locator('#hud [data-settings]').click();
  await page.click('#setMusic');
  await page.waitForFunction(() => DM.Music.playing, null, { timeout: 3000 });   // riaccesa in partita
  await page.keyboard.press('Escape');
  assert.equal(await page.isHidden('#settings'), true);
  assert.deepEqual(errors, []);
});

test('schermata di gioco: mappa a tutto schermo, tendina, riquadro, zoom con due dita', async () => {
  if (await page.locator('#game').isHidden()) {
    await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
    await page.locator('[data-m=continua]').first().click();
  }
  // la mappa occupa tutto lo schermo; niente pagina che scorre
  const vp = await page.locator('#vp').boundingBox(), vw = page.viewportSize();
  assert.ok(vp.width >= vw.width - 1 && vp.height >= vw.height - 1, 'mappa a tutto schermo');
  assert.equal(await ev(() => document.scrollingElement.scrollHeight <= innerHeight + 1), true);
  // tendina: si apre dalla borsa, cambia scheda, si chiude con la X e toccando fuori
  await page.click('#hud [data-side]');
  assert.equal(await page.isVisible('#ecoP'), true);
  for (const tab of ['opt', 'saveP', 'helpP']) {
    await page.click(`#side [data-tab=${tab}]`);
    assert.equal(await page.isVisible('#' + tab), true, tab);
    assert.equal(await page.isVisible('#ecoP'), false);
  }
  assert.match(await page.locator('#helpP').innerText(), /due dita/);
  await page.click('#side .x');
  assert.equal(await page.isHidden('#side'), true);
  await page.click('#hud [data-side]');
  await page.mouse.click(20, 400);   // fuori dal pannello
  assert.equal(await page.isHidden('#side'), true);
  // dal pannello di un edificio: "Banco e acquisti" apre la tendina sul Banco
  await ev(() => { DM.ui.selB = DM.game.sites.find(s => s.o === DM.game.p && s.k === 'cap'); DM.redraw(); });
  await act('Banco e acquisti');
  assert.equal(await page.isVisible('#ecoP'), true);
  assert.match(await page.locator('#ecoT').innerText(), /Edificio scelto: Capitale/);
  await page.click('#side .x');
  // il riquadro delle informazioni si riduce e si riallarga
  await page.click('#grip');
  assert.equal(await ev(() => document.getElementById('sheet').classList.contains('min')), true);
  await page.click('#grip');
  assert.equal(await ev(() => document.getElementById('sheet').classList.contains('min')), false);
  // riserva: il numero sul pulsante
  assert.match(await page.locator('#spN').innerText(), /^\d+$/);
  // zoom con due dita (allargando) e con Ctrl + rotellina (stringendo)
  const z0 = await ev(() => DM.ui.Z);
  await ev(() => {
    const v = document.getElementById('vp'), t = (id, x, y) => new Touch({ identifier: id, target: v, clientX: x, clientY: y });
    const fire = (type, ts) => v.dispatchEvent(new TouchEvent(type, { touches: ts, targetTouches: ts, changedTouches: ts, bubbles: true, cancelable: true }));
    fire('touchstart', [t(1, 150, 300), t(2, 230, 300)]);
    fire('touchmove', [t(1, 110, 300), t(2, 270, 300)]);   // dita due volte più lontane
    v.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(1, 110, 300)], bubbles: true }));
  });
  const z1 = await ev(() => DM.ui.Z);
  assert.ok(Math.abs(z1 / z0 - 2) < .05 || z1 === 48, 'con due dita la mappa si ingrandisce: ' + z0 + ' → ' + z1);
  await ev(() => document.getElementById('vp').dispatchEvent(new WheelEvent('wheel', { deltaY: 140, ctrlKey: true, clientX: 190, clientY: 300, bubbles: true, cancelable: true })));
  assert.ok(await ev(() => DM.ui.Z) < z1, 'Ctrl + rotellina rimpicciolisce');
  assert.deepEqual(errors, []);
});

test('bot: si sceglie nel menu, gioca da solo il suo turno, poi tocca di nuovo a te', async () => {
  if (!(await page.locator('#game').isHidden())) await page.click('#toMenu');
  await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
  while ((await page.locator('[data-m=elimina]').count()) >= 3) { await page.locator('[data-m=elimina]').last().click(); await page.click('[data-m=eliminaSi]'); }
  await page.click('[data-m=nuova]');
  await page.click('[data-m=np][data-arg="3"]');
  assert.match(await page.locator('#whoCard').innerText(), /Giocatore 1[\s\S]*Giocatore 2[\s\S]*Giocatore 3/);
  await page.click('[data-m=who][data-arg="1:normale"]');
  await page.click('[data-m=who][data-arg="2:normale"]');
  await page.selectOption('[data-lvl="2"]', 'facile');
  await page.click('[data-m=who][data-arg="2:"]');          // ci ripenso: il 3 è una persona…
  await page.click('[data-m=who][data-arg="2:facile"]');    // …no, bot facile
  assert.match(await page.locator('#whoCard').innerText(), /Ammiraglia Blu[\s\S]*Barone Verde/);
  await page.fill('#seed', '7'); await page.click('[data-m=inizia]');
  await page.waitForSelector('[data-act=kit]');
  assert.deepEqual(await ev(() => DM.game.bots), [null, 'normale', 'facile']);
  await act('Tribù');
  const A = await findSpot(); await tapCm(A[0], A[1]);
  // i due bot scelgono kit e Capitale da soli
  await page.waitForFunction(() => DM.game.phase === 'play' && DM.game.p === 0 && !DM.botRunning(), null, { timeout: 20000 });
  assert.equal(await ev(() => DM.game.sites.filter(s => s.k === 'cap').length), 3);
  assert.match(await hud(), /Giocatore 1/);
  // fine turno: gioca Ammiraglia Blu; intanto non si può fare niente (solo guardare)
  await page.click('#end');
  await page.waitForFunction(() => DM.game.p === 1);
  assert.match(await hud(), /Ammiraglia Blu/);
  assert.equal(await page.isDisabled('#end'), true);
  assert.match(await info(), /Ammiraglia Blu 🤖 sta giocando/);
  await page.waitForFunction(() => DM.game.p === 0 && !DM.botRunning(), null, { timeout: 60000 });
  assert.match(await hud(), /Giocatore 1.*Giro 2/s);
  assert.ok(await ev(() => DM.game.units.filter(u => u.o === 1).length) > 0, 'il bot ha schierato truppe');
  assert.equal(await page.isDisabled('#end'), false);
  // "Più veloce"
  await page.click('#end');
  await page.waitForFunction(() => DM.game.p === 1);
  await act('Più veloce');
  await page.waitForFunction(() => DM.game.p === 0 && !DM.botRunning(), null, { timeout: 60000 });
  // si esce al menu mentre gioca un bot: rientrando, il bot finisce il suo turno
  await page.click('#end');
  await page.waitForFunction(() => DM.game.p === 1);
  await page.click('#toMenu');
  await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
  await page.locator('.card.slot', { hasText: 'tocca a Ammiraglia Blu' }).first().locator('[data-m=continua]').click();
  await page.waitForFunction(() => DM.game.p === 0 && !DM.botRunning(), null, { timeout: 60000 });
  assert.match(await hud(), /Giocatore 1.*Giro 4/s);
  assert.deepEqual(errors, []);
});

test('partita di soli bot: pausa, si toccano truppe ed edifici di tutti (solo da guardare), poi si riprende', async () => {
  if (!(await page.locator('#game').isHidden())) await page.click('#toMenu');
  await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
  while ((await page.locator('[data-m=elimina]').count()) >= 3) { await page.locator('[data-m=elimina]').last().click(); await page.click('[data-m=eliminaSi]'); }
  await page.click('[data-m=nuova]');
  await page.click('[data-m=who][data-arg="0:normale"]');
  await page.click('[data-m=who][data-arg="1:normale"]');
  await page.fill('#seed', '7'); await page.click('[data-m=inizia]');
  // i bot preparano e giocano da soli; la pausa c'è solo perché giocano tutti bot
  await page.waitForFunction(() => DM.game && DM.game.np === 2 && DM.game.bots && DM.game.bots[0] && DM.game.bots[1] && DM.game.phase === 'play' && DM.game.units.length > 3, null, { timeout: 30000 });
  await page.locator('#info button', { hasText: 'Pausa' }).click();
  assert.match(await info(), /Partita in pausa/);
  const snap = () => ev(() => DM.serialize(DM.game).replace(/"saved":\d+/, ''));
  const stop = await snap();
  await page.waitForTimeout(1500);
  assert.ok(await snap() === stop, 'in pausa i bot non fanno niente');
  // tocco una Capitale (di chiunque): si vede com'è, con il fumetto, ma senza pulsanti per agire
  const cap = await ev(() => { const c = DM.game.sites.find(s => s.k === 'cap'); return [c.x, c.y, DM.game.names[c.o]]; });
  for (let i = 0; i < 15 && !/^Capitale/m.test(await info()); i++) await tapCm(cap[0], cap[1]);
  const pos = await info();
  assert.match(pos, /Capitale.*vita/s);
  assert.match(pos, new RegExp('Edificio di ' + cap[2]));
  assert.doesNotMatch(pos, /Schiera|Collega con strada|Lancia|Banco e acquisti/, 'niente pulsanti per agire');
  assert.equal(await page.isVisible('#bubble'), true);
  // una truppa
  const u = await ev(() => { const v = DM.game.units.find(x => !x.carried); return [v.x, v.y]; });
  for (let i = 0; i < 12 && !/Truppa di|Esercito/.test(await info()); i++) await tapCm(u[0], u[1]);
  assert.match(await info(), /Truppa di|Esercito/);
  assert.doesNotMatch(await info(), /Fai salire|Fai uscire|Deseleziona/);
  // si riprende: i bot vanno avanti
  await page.locator('#info button', { hasText: 'Riprendi' }).click();
  await page.waitForFunction(s => DM.serialize(DM.game).replace(/"saved":\d+/, '') !== s, stop, { timeout: 20000 });
  await page.locator('#info button', { hasText: 'Pausa' }).click();
  await page.click('#toMenu');
  assert.deepEqual(errors, []);
});

test('mappe segrete: numero 0 = la Terra di oggi, messaggio e Esploratore', async () => {
  if (!(await page.locator('#game').isHidden())) await page.click('#toMenu');
  if (await page.locator('[data-m=gioca]').count() === 0) await page.locator('[data-m=home]').first().click();
  assert.match(await page.locator('.explorer').innerText(), /Mappe segrete: 0 di 14/);
  await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
  while ((await page.locator('[data-m=elimina]').count()) >= 3) { await page.locator('[data-m=elimina]').last().click(); await page.click('[data-m=eliminaSi]'); }
  await page.click('[data-m=nuova]');
  await page.click('[data-m=who][data-arg="0:"]'); await page.click('[data-m=who][data-arg="1:"]');   // due persone (il menu ricorda le scelte di prima)
  await page.fill('#seed', '0'); await page.click('[data-m=inizia]');
  await page.waitForSelector('[data-act=kit]');
  assert.equal(await ev(() => DM.game.map.secret), 'oggi');
  assert.match(await info(), /Hai trovato una mappa segreta: la Terra di oggi!.*1 di 14/s);
  assert.match(await info(), /Lo sapevi\? Circa il 71%/);
  // il Sahara è deserto anche nella pagina
  assert.equal(await ev(() => { const v = DM.SECRET_MASKS.mondo.view; return DM.bAt(DM.game, (10 - v[0]) / (v[1] - v[0]) * 60, (23 - v[2]) / (v[3] - v[2]) * 42); }), 'D');
  await page.click('#toMenu');
  assert.match(await page.locator('.explorer').innerText(), /1 di 14/);
  await page.click('.explorer');
  const list = await page.locator('#menu').innerText();
  assert.match(list, /Esploratore[\s\S]*1 di 14[\s\S]*la Terra di oggi[\s\S]*\?\?\?/);
  assert.equal(await page.locator('ul.secrets li.no').count(), 13);
  assert.match(list, /la Terra di oggi\s*💡 Circa il 71%/);
  assert.match(list, /Trova tutte le 14 mappe segrete \(1 di 14\)/);
  await page.locator('[data-m=home]').first().click();
  assert.deepEqual(errors, []);
});

test('mappa originale: si sblocca con tutte le mappe segrete (numero 6), poi sigla epica e capitale dorata', async () => {
  if (!(await page.locator('#game').isHidden())) await page.click('#toMenu');
  if (await page.locator('[data-m=gioca]').count() === 0) await page.locator('[data-m=home]').first().click();
  // prima dello sblocco il 6 è una mappa normale
  await newFromMenu(2, 6);
  assert.equal(await ev(() => DM.game.map.secret), undefined);
  assert.equal(await ev(() => DM.game.map.opts.orig), undefined);
  assert.equal(await ev(() => DM.game.map.symbol), true, 'prima dello sblocco il 6 è la mappa del simbolo');
  assert.match(await info(), /mappa del simbolo di Damamondo/);
  assert.match(await info(), /non ha ancora detto la sua ultima parola/);
  // il numero dei 9 prima della mappa originale: "troppo grande", e non parte nessuna partita
  await page.click('#toMenu'); await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
  while ((await page.locator('[data-m=elimina]').count()) >= 3) { await page.locator('[data-m=elimina]').last().click(); await page.click('[data-m=eliminaSi]'); }
  await page.click('[data-m=nuova]'); await page.fill('#seed', '999999999999999'); await page.click('[data-m=inizia]');
  assert.match(await page.locator('#seedMsg').innerText(), /troppo grande… per ora/);
  assert.equal(await page.locator('#game').isHidden(), true);
  // più di 15 cifre non si possono scrivere (anche incollando), e le lettere non entrano
  await page.fill('#seed', ''); await page.locator('#seed').pressSequentially('12345678901234567');
  assert.equal(await page.inputValue('#seed'), '123456789012345');
  await page.fill('#seed', '9a9-9999999999999999999');
  assert.equal(await page.inputValue('#seed'), '999999999999999');
  await page.fill('#seed', '12'); await page.click('[data-m=inizia]'); await page.waitForSelector('[data-act=kit]');
  // tutte le 14 trovate
  await ev(() => localStorage.setItem('damamondo-segreti', JSON.stringify(DM.SECRETS.map(s => s.id))));
  await page.click('#toMenu');
  if (await page.locator('.explorer').count() === 0) await page.locator('[data-m=home]').first().click();
  assert.match(await page.locator('.explorer').innerText(), /14 di 14 🥇/);
  await page.click('.explorer');
  assert.match(await page.locator('#menu').innerText(), /Sbloccata: la mappa originale/);
  await shot('orig-esploratore-1');
  // le Impostazioni non mostrano ancora i premi
  await page.click('#menu [data-settings]');
  assert.equal(await page.locator('#setPrize').isHidden(), true);
  await page.click('#setClose');
  await page.locator('[data-m=home]').first().click();
  await newFromMenu(2, 6);
  assert.equal(await ev(() => DM.game.map.secret), 'originale');
  assert.match(await info(), /Hai trovato la mappa originale di Damamondo.*sigla epica.*capitale dorata/s);
  await shot('orig-mappa');
  // la partita salvata si riprende sulla stessa mappa
  await page.reload(); await page.waitForSelector('[data-m=gioca]');
  await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
  await page.locator('[data-m=continua]').first().click();
  assert.equal(await ev(() => DM.game.map.secret), 'originale');
  // premi nelle Impostazioni: sigla epica e capitale dorata
  await page.click('#hud [data-settings]');
  assert.equal(await page.locator('#setPrize').isHidden(), false);
  await page.selectOption('#setTheme', 'epica');
  await page.check('#setGold');
  assert.deepEqual(await ev(() => [DM.Prefs.get('theme'), DM.Prefs.get('gold')]), ['epica', true]);
  await page.click('#setClose');
  // la capitale dorata si disegna (anche nel disegno: un punto della stella è oro, non del colore del giocatore)
  const G = await ev(() => { const G = DM.game; return G.sites.filter(s => s.k === 'cap').length; });
  if (!G) {   // capitali non ancora messe: le mettono i bot per fare prima
    await ev(() => { DM.setBot(DM.game, 0, 'normale'); DM.setBot(DM.game, 1, 'normale'); while (DM.game.phase !== 'play') DM.botSetup(DM.game); DM.setBot(DM.game, 0, ''); DM.setBot(DM.game, 1, ''); DM.redraw(); });
  }
  assert.equal(await ev(() => DM.goldCap(DM.game, 0)), true);
  const px = await ev(() => {
    const cap = DM.game.sites.find(s => s.k === 'cap' && s.o === 0), cv = document.createElement('canvas'); cv.width = cv.height = 100;
    const cx = cv.getContext('2d'); cx.setTransform(10, 0, 0, 10, 50 - cap.x * 10, 50 - cap.y * 10);
    DM.drawSite(cx, DM.game, cap, 10, false); return Array.from(cx.getImageData(50, 50, 1, 1).data);
  });
  assert.ok(px[0] > 200 && px[1] > 150 && px[2] < 120, 'oro: ' + px);
  await page.evaluate(() => DM.focusMap && DM.focusMap(DM.game.sites.find(s => s.k === 'cap').x, DM.game.sites.find(s => s.k === 'cap').y));
  await shot('orig-capitale');
  // la sigla epica si "registra" senza errori e non satura
  const peak = await ev(async () => { const b = await DM.Music.render(8, [], null, true); let m = 0; for (let c = 0; c < 2; c++) for (const v of b.getChannelData(c)) m = Math.max(m, Math.abs(v)); return m; });
  assert.ok(peak > .05 && peak < 1, 'picco ' + peak);
  // l'Esploratore mostra la catena completa
  await page.click('#toMenu'); await page.click('.explorer');
  assert.match(await page.locator('#menu').innerText(), /Trovata la mappa originale[\s\S]*Premi: la sigla epica[\s\S]*soli 9/);
  await page.locator('[data-m=home]').first().click();
  await newFromMenu(2, 999999999999999);
  assert.deepEqual(await ev(() => [DM.game.seed, DM.game.map.symbol]), [999999999999999, true]);
  assert.doesNotMatch(await info(), /ultima parola/, 'col numero dei 9 niente indizio');
  await page.click('#toMenu'); await page.click('.explorer');
  await ev(() => { localStorage.removeItem('damamondo-segreti'); DM.Prefs.set({ theme: 'classica', gold: false }); });
  await page.locator('[data-m=home]').first().click();
  assert.deepEqual(errors, []);
});

test('computer: la mappa si trascina col mouse, e il trascinamento non conta come clic', async () => {
  await newFromMenu(2);
  for (let i = 0; i < 3; i++) await page.click('#zi');
  const box = await page.locator('#vp').boundingBox();
  const before = await ev(() => [document.getElementById('vp').scrollLeft, document.getElementById('vp').scrollTop, DM.ui.msg]);
  const cx = box.x + box.width / 2, cy = box.y + box.height * .35;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx - 60, cy - 40, { steps: 5 }); await page.mouse.move(cx - 120, cy - 80, { steps: 5 });
  await page.mouse.up();
  const after = await ev(() => [document.getElementById('vp').scrollLeft, document.getElementById('vp').scrollTop, DM.ui.msg, DM.game.phase]);
  assert.ok(Math.abs(after[0] - before[0] - 120) < 3 && Math.abs(after[1] - before[1] - 80) < 3, 'spostata: ' + before + ' → ' + after);
  assert.equal(after[2], before[2], 'nessun clic sulla mappa');
  // la rotellina ingrandisce (senza Ctrl) e rimpicciolisce
  const z1 = await ev(() => DM.ui.Z);
  await page.mouse.move(cx, cy); await page.mouse.wheel(0, -200); await page.waitForTimeout(100);
  const z2 = await ev(() => DM.ui.Z);
  assert.ok(z2 > z1 * 1.1, 'rotellina in su: ingrandisce ' + z1 + ' → ' + z2);
  await page.mouse.wheel(0, 200); await page.waitForTimeout(100);
  assert.ok(Math.abs(await ev(() => DM.ui.Z) - z1) < .5, 'rotellina in giù: torna com’era');
  const t0 = Date.now(); for (let i = 0; i < 25; i++) await page.mouse.wheel(0, -200);
  assert.equal(await ev(() => DM.ui.Z), 96);
  assert.ok(Date.now() - t0 < 8000, 'ingrandire al massimo non è lento: ' + (Date.now() - t0) + ' ms');
  // un clic normale (senza trascinare) funziona ancora: dopo il kit, il clic prova a mettere la Capitale
  await act('Tribù');
  await ev(() => { DM.ui.msg = 'prima'; });
  await page.mouse.click(cx, cy);
  assert.notEqual(await ev(() => DM.game.phase === 'cap' && DM.game.sites.length === 0 ? DM.ui.msg : 'capitale messa'), 'prima');
  assert.deepEqual(errors, []);
});

test('modalità Classico: si sblocca con la mappa originale, 5 biomi, kit unico, niente Banco, soldi da tutte le città', async () => {
  if (!(await page.locator('#game').isHidden())) await page.click('#toMenu');
  if (await page.locator('[data-m=gioca]').count() === 0) await page.locator('[data-m=home]').first().click();
  const go = async () => {
    await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
    while ((await page.locator('[data-m=elimina]').count()) >= 3) { await page.locator('[data-m=elimina]').last().click(); await page.click('[data-m=eliminaSi]'); }
    await page.click('[data-m=nuova]');
  };
  // prima dello sblocco la scelta non c'è
  await ev(() => localStorage.removeItem('damamondo-segreti'));
  await go();
  assert.equal(await page.locator('[data-m=mode]').count(), 0);
  await page.locator('[data-m=locale]').first().click(); await page.locator('[data-m=gioca]').first().click().catch(() => {});
  await page.locator('[data-m=home]').first().click().catch(() => {});
  await ev(() => localStorage.setItem('damamondo-segreti', JSON.stringify(DM.SECRETS.map(s => s.id).concat('originale'))));
  await page.reload(); await page.waitForSelector('[data-m=gioca]');
  await go();
  await page.click('[data-m=mode][data-arg=classico]');
  assert.equal(await page.locator('#hum').count(), 0, 'nel Classico niente umidità, temperatura, varietà');
  assert.match(await page.locator('#whoCard').innerText(), /solo persone/);
  await page.fill('#seed', '12'); await page.click('[data-m=inizia]');
  await page.waitForSelector('[data-act=kit]');
  assert.deepEqual(await ev(() => [DM.mode, DM.game.map.opts.mode, DM.KITS.length]), ['classico', 'classico', 1]);
  assert.equal(await ev(() => [...new Set(DM.game.map.cells)].map(c => DM.BIOMES[c]).filter(b => !'PSFMA'.includes(b)).length), 0);
  // kit e Capitale per tutti e due
  for (let i = 0; i < 2; i++) {
    await act('Classico');
    const P = await findSpot(i ? await ev(() => { const c = DM.capitalOf(DM.game, 0); return [c.x, c.y]; }) : null, 16);
    await tapCm(P[0], P[1]);
  }
  await page.waitForFunction(() => DM.game.phase === 'play');
  // il negozio: niente Banco, niente Carri/miniere/Aeroporti; si compra in Città con i soldi della Capitale
  const city = await ev(() => { const c = DM.capitalOf(DM.game, 0); const s = DM.addSite(DM.game, 0, 'citta', c.x + 1.4, c.y); DM.ui.selB = s; DM.ui.sel = null; DM.redraw(); return [s.x, s.y]; });
  await side('ecoP');
  assert.equal(await page.locator('#ecoTab').innerText(), 'Negozio');
  assert.equal(await page.locator('#bancoBox').isHidden(), true);
  const shopTxt = await page.locator('#shop').innerText();
  assert.doesNotMatch(shopTxt, /Carro|Miniera|Aeroporto|Coltivazione|Ignifuga/);
  assert.match(shopTxt, /Migliora un pezzo di ponte al liv\. 2/);
  await page.locator('#shop button[data-arg=S]').click();
  assert.equal(await ev(() => DM.moneyOf(DM.game, 0)), 29000);
  await closeSide();
  // spostare soldi dalla Capitale alla Città
  await ev(([x, y]) => { DM.ui.selB = DM.game.sites.find(s => s.k === 'citta' && Math.hypot(s.x - x, s.y - y) < .1); DM.redraw(); }, city);
  await page.fill('#mq', '5000'); await act('Porta qui dalla Capitale');
  assert.match(await info(), /Spostati 5\.?000 soldi dalla Capitale/);
  // una carta pescata: compare la finestrella, OK la chiude
  await ev(() => { DM.rand = () => .6; DM.drawCard(DM.game, 'M', [DM.addUnit(DM.game, 'S', 0, 30, 20), DM.addUnit(DM.game, 'S', 0, 30, 20.1)]); DM.rand = Math.random; DM.redraw(); });
  assert.equal(await page.locator('#cardPop').isHidden(), false);
  assert.match(await page.locator('#cardPop').innerText(), /Carta Montagna[\s\S]*slavine[\s\S]*2 Soldati muoiono/i);
  await shot('classico-carta');
  await page.locator('#cardPop button').click();
  assert.equal(await page.locator('#cardPop').isHidden(), true);
  // la partita salvata si riprende in Classico; una partita normale rimette tutto com'era
  await page.reload(); await page.waitForSelector('[data-m=gioca]');
  await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
  assert.match(await page.locator('.slot').first().innerText(), /Classico/);
  await page.locator('[data-m=continua]').first().click();
  assert.equal(await ev(() => DM.mode), 'classico');
  // le regole del Classico si leggono nel menu Regole
  await page.click('#toMenu'); await page.locator('[data-m=home]').first().click().catch(() => {});
  await page.click('[data-m=regole]');
  assert.match(await page.locator('.rules').innerText(), /Modalità Damamondo Classico[\s\S]*più della metà[\s\S]*pioggia di meteoriti/);
  assert.match(await page.locator('.rules').innerText(), /250\.000/, 'il regolamento normale resta normale');
  await page.locator('[data-m=home]').first().click();
  await ev(() => { localStorage.removeItem('damamondo-segreti'); });
  assert.deepEqual(errors, []);
});
