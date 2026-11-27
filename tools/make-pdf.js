// Damamondo – crea il regolamento in PDF (Damamondo_Regolamento_Classico.pdf) dalle stesse regole del gioco.
// Avvio: npm run pdf   (serve Playwright; da rifare quando cambiano le regole, come "npm run pagine")
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
for (const f of ['data', 'map', 'game', 'territory', 'troops', 'combat', 'economy', 'buildings', 'transport', 'turn', 'save', 'rules']) require(path.join(ROOT, 'js', f + '.js'));
const DM = globalThis.DM;

const rules = DM.rulesHTML();
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'icons', 'icon-512.png')).toString('base64');
const html = `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Damamondo Classico – Regolamento</title>
<style>
  @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: "Helvetica Neue", Arial, sans-serif; font-size: 10.3pt; line-height: 1.45; color: #1d232a; margin: 0; }
  .cover { height: 255mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }
  .cover img { width: 46mm; height: 46mm; border-radius: 10mm; box-shadow: 0 2mm 6mm rgba(0,0,0,.25); }
  .cover h1 { font-size: 38pt; letter-spacing: 3pt; margin: 12mm 0 0; }
  .cover h2 { font-size: 16pt; font-weight: 400; margin: 2mm 0 14mm; color: #555; }
  .cover p { font-size: 12pt; max-width: 130mm; color: #333; }
  .cover .site { margin-top: 16mm; font-size: 11pt; color: #1e6fd9; }
  nav.toc { page-break-after: always; }
  nav.toc b { font-size: 18pt; display: block; margin-bottom: 6mm; }
  nav.toc ol { font-size: 12pt; line-height: 2; padding-left: 8mm; }
  nav.toc a { color: #1d232a; text-decoration: none; }
  section.rule { page-break-before: always; }
  section.rule:first-of-type { page-break-before: auto; }
  h3 { font-size: 17pt; margin: 0 0 4mm; padding-bottom: 1.5mm; border-bottom: 1.2pt solid #c0392b; }
  h4 { font-size: 11.5pt; margin: 5mm 0 2mm; color: #2a3440; break-after: avoid; }
  p { margin: 1.6mm 0; orphans: 3; widows: 3; }
  p.art > b:first-child { display: inline-block; min-width: 9mm; color: #c0392b; }
  p.note { font-size: 9pt; color: #555; }
  .tw { margin: 2.5mm 0 3mm; }
  table { border-collapse: collapse; width: 100%; font-size: 8.6pt; break-inside: auto; }
  tr { break-inside: avoid; }
  th, td { border: .5pt solid #b9c0c8; padding: 1.3mm 1.8mm; text-align: left; vertical-align: top; }
  th { background: #eef1f4; }
  ul { margin: 1.5mm 0; padding-left: 6mm; }
</style></head><body>
<div class="cover">
  <img src="${icon}" alt="">
  <h1>DAMAMONDO</h1>
  <h2>Classico · Regolamento ufficiale</h2>
  <p>Gioco di strategia da tavolo per due o più giocatori. Si gioca su carta, con quattro fogli A4, righello, dadi e perline, oppure nel browser.</p>
  <p class="site">leoj0i.github.io/Damamondo</p>
</div>
${rules}
</body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  await p.emulateMedia({ media: 'print', colorScheme: 'light' });
  const out = path.join(ROOT, 'Damamondo_Regolamento_Classico.pdf');
  await p.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:7.5pt;color:#888;width:100%;padding:0 16mm;text-align:right;font-family:Arial">Damamondo Classico · Regolamento</div>',
    footerTemplate: '<div style="font-size:8pt;color:#888;width:100%;text-align:center;font-family:Arial"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' } });
  await b.close();
  console.log('scritto', out);
})();
