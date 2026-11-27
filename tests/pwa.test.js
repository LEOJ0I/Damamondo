// App installabile (PWA): manifesto, icone, e il gioco che parte anche senza internet.
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const ROOT = path.join(__dirname, '..');
const { serve } = require('./server');

test('manifesto e icone', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.name, 'Damamondo'); assert.equal(m.short_name, 'Damamondo'); assert.equal(m.display, 'standalone');
  for (const i of m.icons) {
    const buf = fs.readFileSync(path.join(ROOT, i.src));
    const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    assert.equal(w + 'x' + h, i.sizes, i.src);
  }
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /rel="manifest" href="manifest.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="icons\/apple-touch-icon.png"/);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const files = JSON.parse(sw.match(/const FILES = (\[.*\]);/)[1]);
  files.filter(f => f !== './').forEach(f => assert.ok(fs.existsSync(path.join(ROOT, f)), 'manca ' + f));
});

test('installata, la app parte anche senza internet e ritrova la partita', async () => {
  const srv = await serve();
  const url = 'http://localhost:' + srv.address().port + '/Damamondo/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(url);
    await page.waitForSelector('[data-m=gioca]');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();                       // ora la pagina è controllata dal service worker
    await page.waitForSelector('[data-m=gioca]');
    assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'service worker attivo');
    // una partita nuova, salvata nel telefono
    await page.click('[data-m=gioca]'); await page.click('[data-m=locale]'); await page.click('[data-m=nuova]');
    await page.fill('#seed', '7'); await page.click('[data-m=inizia]');
    await page.waitForSelector('[data-act=kit]');
    // senza internet
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('[data-m=gioca]');
    await page.click('[data-m=gioca]'); await page.click('[data-m=locale]');
    assert.match(await page.locator('#menu').innerText(), /Partita 1/);
    await page.click('[data-m=continua]');
    await page.waitForSelector('[data-act=kit]');
    await page.goto(url + 'regole.html');
    assert.match(await page.title(), /Regole di Damamondo/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close(); srv.close();
  }
});
