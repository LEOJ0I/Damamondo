// Damamondo – crea anteprima.png (1200 × 630), l'immagine che compare quando si condivide il link del gioco.
// Sfondo: la mappa del menu (numero 7), sfocata. Avvio: node tools/make-preview.js (serve Playwright)
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForSelector('[data-m=gioca]');
  const bg = await p.evaluate(() => { const m = DM.makeMap({}, 7); DM.rebuildMap(m, 1); return DM.mapImage(m).toDataURL('image/png'); });
  await p.setContent(`<!DOCTYPE html><html><head><style>
    body { margin: 0; width: 1200px; height: 630px; overflow: hidden; font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif; }
    .bg { position: absolute; inset: -30px; background: url(${bg}) center / cover; filter: blur(7px); }
    .veil { position: absolute; inset: 0; background: rgba(255,255,255,.28); }
    .t { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    h1 { margin: 0; font-size: 148px; font-weight: 900; letter-spacing: 4px; color: #16202c; text-shadow: 0 4px 0 #c98a1a, 0 10px 24px rgba(0,0,0,.25); }
    p { margin: 34px 0 0; font-size: 38px; font-weight: 600; color: #16202c; }
  </style></head><body><div class="bg"></div><div class="veil"></div>
    <div class="t"><h1>DAMAMONDO</h1><p>Gioco di strategia da tavolo · gioca dal telefono</p></div></body></html>`);
  await p.screenshot({ path: path.join(ROOT, 'anteprima.png') });
  await b.close();
  console.log('scritta anteprima.png');
})();
