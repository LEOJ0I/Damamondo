// Damamondo – disegna le icone dell'app (la stella della Capitale su una mappa del gioco).
// Avvio: node tools/make-icons.js   (serve Playwright; le icone si rifanno solo se cambia il disegno)
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
const SIZES = [
  { file: 'icon-512.png', size: 512, pad: 0 },
  { file: 'icon-192.png', size: 192, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
  { file: 'icon-maskable-512.png', size: 512, pad: .12 },   // la stella resta dentro la zona sicura (Android ritaglia i bordi)
  { file: 'favicon-32.png', size: 32, pad: 0 }
];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.join(ROOT, 'index.html'));
  await p.waitForSelector('[data-m=gioca]');
  for (const s of SIZES) {
    const data = await p.evaluate(({ size, pad }) => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d');
      // sfondo: un pezzo di mappa (mappa numero 7) con un'isola
      const map = DM.makeMap({}, 7); DM.rebuildMap(map, 1);
      const img = DM.mapImage(map);
      const cm = DM.MR, sx = 4 * cm, sy = 6 * cm, side = 22 * cm;
      g.imageSmoothingEnabled = true;
      g.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      g.fillStyle = 'rgba(16,23,30,.18)'; g.fillRect(0, 0, size, size);
      // la stella della Capitale
      const r = size * (.36 - pad * .9), cx = size / 2, cy = size / 2 + size * .02;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
        g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      g.closePath();
      g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = size * .04; g.shadowOffsetY = size * .015;
      g.fillStyle = '#c0392b'; g.fill();
      g.shadowColor = 'transparent';
      g.lineJoin = 'round'; g.lineWidth = Math.max(1.5, size * .045); g.strokeStyle = '#ffffff'; g.stroke();
      return c.toDataURL('image/png');
    }, s);
    require('fs').writeFileSync(path.join(ROOT, 'icons', s.file), Buffer.from(data.split(',')[1], 'base64'));
    console.log('scritta', s.file);
  }
  await b.close();
})();
