// Prova di animazioni, suoni e Impostazioni in un browser vero (Chromium, telefono emulato), con le animazioni accese.
// Avvio: node --test tests/fx.test.js
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('path');
const { chromium, devices } = require('playwright');
const { serve } = require('./server');
let URL, srv;

let browser, page, errors = [], A;
const ev = (fn, arg) => page.evaluate(fn, arg);
const info = () => page.locator('#info').innerText();
const played = () => ev(() => DM.Sfx.played.slice());
const clearPlayed = () => ev(() => { DM.Sfx.played.length = 0; });
const idle = () => page.waitForFunction(() => !DM.FX.busy && !DM.FX.hidden.u.size && !DM.FX.hidden.s.size, null, { timeout: 8000 });
// pixel non trasparenti nel canvas delle animazioni
const fxInk = () => ev(() => { const c = document.getElementById('fxc'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i]) n++; return n; });

async function tapCm(x, y) {
  await ev(([x, y]) => { const v = document.getElementById('vp'), Z = DM.ui.Z; const c = document.getElementById('c'); v.scrollLeft = c.offsetLeft + x * Z - v.clientWidth / 2; v.scrollTop = c.offsetTop + y * Z - v.clientHeight * .4; }, [x, y]);
  await page.locator('#vp').scrollIntoViewIfNeeded();
  const box = await page.locator('#c').boundingBox(), Z = await ev(() => DM.ui.Z);
  await page.touchscreen.tap(box.x + x * Z, box.y + y * Z);
}
const unsel = () => ev(() => { DM.ui.sel = null; DM.ui.selB = null; DM.ui.mode = ''; DM.redraw(); });

test.before(async () => {
  srv = await serve(); URL = srv.url;
  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', d => { errors.push('finestrina: ' + d.message()); d.dismiss(); });
  await page.goto(URL);
  await page.click('[data-m=gioca]'); await page.click('[data-m=locale]'); await page.click('[data-m=nuova]');
  await page.selectOption('#cmp', '3'); await page.fill('#seed', '11'); await page.click('[data-m=inizia]');
  await page.waitForSelector('[data-act=kit]');
  // preparazione veloce: due Capitali in mezzo alla Pianura, lontane
  A = await ev(() => {
    const G = DM.game;
    const spot = far => {
      let best = null, bs = -1;
      for (let y = 6; y < 36; y += .5) for (let x = 6; x < 54; x += .5) {
        if (DM.bAt(G, x, y) !== 'P' || DM.capitalSpotError(G, x, y, G.np) || (far && Math.hypot(x - far[0], y - far[1]) < 14)) continue;
        let sc = 0;
        for (let a = 0; a < 16; a++) for (const r of [1, 2.5, 4]) if (DM.bAt(G, x + Math.cos(a / 16 * 6.283) * r, y + Math.sin(a / 16 * 6.283) * r) === 'P') sc++;
        if (sc > bs) { bs = sc; best = [x, y]; }
      }
      return best;
    };
    DM.chooseKit(G, 0); const a = spot(); DM.placeCapital(G, a[0], a[1]);
    DM.chooseKit(G, 1); const b = spot(a); DM.placeCapital(G, b[0], b[1]);
    DM.redraw();
    return a;
  });
  for (let i = 0; i < 4; i++) await page.click('#zi');
});
test.after(async () => { await browser.close(); srv.close(); });

// punto di Pianura libero vicino a c
const land = (c, rmin, rmax) => ev(([c, rmin, rmax]) => {
  const G = DM.game;
  for (let r = rmin; r <= rmax; r += .2) for (let a = 0; a < 24; a++) {
    const x = c[0] + Math.cos(a * Math.PI / 12) * r, y = c[1] + Math.sin(a * Math.PI / 12) * r;
    if (DM.bAt(G, x, y) !== 'P' || G.sites.concat(G.units).some(q => Math.hypot(q.x - x, q.y - y) < 1)) continue;
    return [x, y];
  }
}, [c, rmin, rmax]);

test('animazioni e suoni', async (t) => {
  await t.test('le animazioni sono accese di partenza; gli effetti sonori anche', async () => {
    assert.deepEqual(await ev(() => [DM.Prefs.get('anim'), DM.Prefs.get('sfx'), DM.Prefs.get('detail'), DM.FX.on]), [true, true, true, true]);
  });

  await t.test('la truppa viaggia (non si teletrasporta) con il suo suono', async () => {
    const S = await land(A, 1.2, 2), D = await land(S, 2, 2.6);
    const id = await ev(([x, y]) => { const u = DM.addUnit(DM.game, 'T', 0, x, y); DM.redraw(); return u.id; }, S);
    await tapCm(S[0], S[1]);
    assert.ok((await played()).includes('select'), 'suono di selezione');
    await clearPlayed();
    await tapCm(D[0], D[1]);
    assert.match(await info(), /Mossa completata/);
    assert.equal(await ev(id => DM.FX.hidden.u.has(id), id), true, 'durante il viaggio la mappa non la disegna: la disegna l’animazione');
    await page.waitForTimeout(150);
    assert.ok(await fxInk() > 0, 'il canvas delle animazioni disegna qualcosa: ' + await ev(() => String(DM.FX.err) + ' ' + document.getElementById('fxc').width));
    assert.ok((await played()).includes('move'));
    await idle();
    assert.equal(await ev(id => DM.FX.hidden.u.has(id), id), false, 'arrivata: torna sulla mappa');
    const p = await ev(id => { const u = DM.unitById(DM.game, id); return [u.x, u.y]; }, id);
    assert.ok(Math.hypot(p[0] - S[0], p[1] - S[1]) > .3);
    await unsel();
  });

  await t.test('una mossa sbagliata fa il suono di errore', async () => {
    await clearPlayed();
    await ev(() => { DM.ui.sel = DM.game.units.find(u => u.o === 0 && u.m); DM.redraw(); });
    await tapCm(A[0] + 8, A[1]);
    assert.match(await info(), /già mosso/);
    assert.ok((await played()).includes('error'));
    await unsel();
  });

  await t.test('costruire: il cantiere con l’edificio che prende forma', async () => {
    const S = await land(A, 1.4, 2);
    await ev(([x, y]) => { DM.addUnit(DM.game, 'S', 0, x, y); DM.cur(DM.game).res.acc = 1; DM.redraw(); }, S);
    const P = await land(S, 1.1, 1.8);
    await clearPlayed();
    await page.selectOption('#sp', 'acc');
    await tapCm(P[0], P[1]);
    assert.match(await info(), /Accampamento costruito/);
    const sid = await ev(() => DM.game.sites[DM.game.sites.length - 1].id);
    assert.equal(await ev(id => DM.FX.hidden.s.has(id), sid), true, 'durante il cantiere lo disegna l’animazione');
    assert.ok((await played()).includes('build'));
    await page.waitForTimeout(400);
    assert.ok(await fxInk() > 0);
    await idle();
    assert.equal(await ev(id => DM.FX.hidden.s.has(id), sid), false);
  });

  let E;
  await t.test('Bomba: vola, e un tocco la fa arrivare subito (senza suoni dopo)', async () => {
    E = await land(A, 4, 6);
    await ev(([x, y]) => { const G = DM.game; DM.addUnit(G, 'T', 1, x, y); DM.capitalOf(G, 0).inv.mat.bomba = 2; DM.capitalOf(G, 0).inv.mat.superbomba = 1; DM.redraw(); }, E);
    await unsel();
    await tapCm(A[0], A[1]);
    await page.locator('#info button', { hasText: 'Lancia Bomba' }).click();
    await clearPlayed();
    await tapCm(E[0], E[1]);
    assert.equal(await ev(() => DM.FX.busy), true, 'la bomba è in volo');
    assert.doesNotMatch(await info(), /Bomba: 5\.?000 danni/, 'il risultato si vede quando atterra');
    assert.ok((await played()).includes('bombFly'));
    await page.waitForTimeout(150);
    await tapCm(A[0] + .3, A[1] + 5);   // tocco: salta
    assert.equal(await ev(() => DM.FX.busy), false);
    assert.match(await info(), /Bomba: 5\.?000 danni a 1 truppa/);
    assert.ok(!(await played()).includes('bombBoom'), 'saltata: niente esplosione rumorosa');
    await idle();
  });

  await t.test('Bomba fino in fondo: esplosione, scossa dello schermo, vibrazione', async () => {
    await ev(() => { DM.game.shots = 0; });
    await unsel();
    await tapCm(A[0], A[1]);
    await page.locator('#info button', { hasText: 'Lancia Bomba' }).click();
    await clearPlayed();
    await tapCm(E[0], E[1]);
    await page.waitForFunction(() => document.getElementById('vpw').style.transform !== '', null, { timeout: 4000 });
    assert.match(await info(), /Bomba: 5\.?000 danni/);
    assert.ok((await played()).includes('bombBoom'));
    await idle();
    await page.waitForFunction(() => document.getElementById('vpw').style.transform === '', null, { timeout: 4000 });
  });

  await t.test('Superbomba: razzo, fungo e zona radioattiva', async () => {
    await ev(() => { DM.game.shots = 0; DM.game.round = 40; DM.redraw(); });
    await unsel();
    await tapCm(A[0], A[1]);
    await page.locator('#info button', { hasText: 'Lancia Superbomba' }).click();
    await clearPlayed();
    const T = await land(A, 5, 7);
    await tapCm(T[0], T[1]);
    assert.ok((await played()).includes('superFly'));
    await page.waitForFunction(() => DM.Sfx.played.includes('superBoom'), null, { timeout: 5000 });
    assert.equal(await ev(() => DM.game.rad.length), 1);
    await page.waitForTimeout(500);
    assert.ok(await fxInk() > 0, 'il fungo si vede');
    await idle();
  });

  await t.test('sparo: colpi che partono dalla truppa e arrivano sul bersaglio', async () => {
    const S = await land(E, 1, 1.6);
    await ev(([x, y, e]) => { DM.game.shots = 0; DM.addUnit(DM.game, 'T', 0, x, y); DM.addUnit(DM.game, 'T', 1, e[0], e[1]); DM.redraw(); }, [...S, E]);
    await unsel();
    await tapCm(S[0], S[1]);
    await page.click('#shoot');
    await clearPlayed();
    await tapCm(E[0], E[1]);
    await page.waitForFunction(() => DM.Sfx.played.includes('impact'), null, { timeout: 4000 });
    assert.ok((await played()).includes('shot'));
    assert.ok(await ev(() => DM.FX.log.includes('shoot')));
    assert.match(await info(), /truppa ha sparato/);
    await idle();
  });

  await t.test('bacca: vola e schizza del suo colore', async () => {
    await ev(() => {
      const G = DM.game, c = DM.capitalOf(G, 0), u = G.units.find(v => v.o === 1);
      c.inv.mat.bacca_deserto = 1;
      const before = DM.FX.snap(G, 'berry'), tg = DM.berryTargets(Object.assign(G, { tapR: .5 }), u.x, u.y)[0];
      DM.ui.msg = DM.throwBerryAt(G, c, 'deserto', tg);
      DM.FX.react(G, 'berry', before, { sx: c.x, sy: c.y, tx: u.x, ty: u.y, col: DM.BIOME_COLOR.D }, DM.redraw, DM.ui.msg);
    });
    await page.waitForFunction(() => DM.Sfx.played.includes('berrySplat'), null, { timeout: 4000 });
    await idle();
  });

  await t.test('fine turno: cartello "Turno di …" e fanfara', async () => {
    await clearPlayed();
    await page.click('#end');
    await page.waitForFunction(() => document.getElementById('banner').classList.contains('go'));
    assert.match(await page.locator('#banner').innerText(), /Turno di Giocatore 2/);
    assert.ok((await played()).includes('turn'));
    await idle();
  });

  await t.test('eruzione: lava che avanza, lo schermo trema, poi la mappa cambia', async () => {
    const nv = await ev(() => DM.game.map.volc.length);
    assert.ok(nv > 0, 'la mappa "estrema" ha vulcani');
    await ev(() => { const G = DM.game; G.round = 49; G.p = 1; DM._d6 = DM.d6; DM.d6 = () => 1; DM.redraw(); });
    await clearPlayed();
    await page.click('#end');
    assert.equal(await ev(() => DM.FX.busy), true, 'durante l’eruzione la mappa non è ancora cambiata');
    assert.ok((await played()).includes('erupt'));
    await page.waitForTimeout(600);
    assert.notEqual(await ev(() => document.getElementById('vpw').style.transform), '', 'scossa');
    assert.ok(await fxInk() > 0);
    await page.waitForFunction(() => !DM.FX.busy, null, { timeout: 5000 });
    assert.match(await info(), /vulcano è eruttato/);
    await ev(() => { DM.d6 = DM._d6; });
    await idle();
  });

  await t.test('tutti i suoni si suonano senza errori', async () => {
    const r = await ev(() => DM.Sfx.names.filter(n => !DM.Sfx.play(n, {})));
    assert.deepEqual(r, [], 'suoni che non partono');
    assert.equal(await ev(() => DM.Sfx.ready), true);
  });

  await t.test('Impostazioni: effetti, volume, animazioni, vibrazione, dettagli (ricordati)', async () => {
    await page.click('#hud [data-settings]');
    assert.equal(await page.isChecked('#setSfx'), true);
    assert.equal(await page.isChecked('#setAnim'), true);
    assert.equal(await page.isChecked('#setDetail'), true);
    await page.fill('#setSfxVol', '30'); await page.dispatchEvent('#setSfxVol', 'input');
    assert.match(await page.locator('#setSfxOut').innerText(), /30%/);
    await page.click('#setSfx');
    assert.equal(await ev(() => DM.Sfx.play('coins')), false, 'effetti spenti: niente suoni');
    assert.equal(await page.isDisabled('#setSfxVol'), true);
    await page.click('#setAnim');
    await page.click('#setDetail');
    await page.click('#setClose');
    // animazioni spente: tutto subito
    await page.click('#end');
    assert.deepEqual(await ev(() => [DM.FX.busy, DM.FX.hidden.u.size, DM.FX.hidden.s.size]), [false, 0, 0], 'niente in sospeso');
    assert.equal(await ev(() => getComputedStyle(document.getElementById('banner')).opacity), '0', 'niente cartello');
    await page.reload();
    assert.deepEqual(await ev(() => { const s = DM.Prefs.all(); return [s.sfx, s.sfxVol, s.anim, s.detail, s.music]; }), [false, .3, false, false, true]);
    await page.click('#menu [data-settings]');
    assert.equal(await page.isChecked('#setDetail'), false);
    await page.click('#setSfx'); await page.click('#setAnim'); await page.click('#setDetail');
    await page.click('#setClose');
    assert.deepEqual(await ev(() => { const s = DM.Prefs.all(); return [s.sfx, s.anim, s.detail]; }), [true, true, true]);
  });

  await t.test('nessun errore JavaScript', () => { assert.deepEqual(errors, []); });
});
