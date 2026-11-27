// Damamondo – crea il regolamento in PDF (Damamondo_Regolamento.pdf) dalle stesse regole del gioco.
// Stile del regolamento originale: copertina con cornice blu e oro, capitoli su fascia blu, tabelle con intestazione blu,
// riquadri "Esempio" e "Importante", indice con i numeri di pagina (calcolati con una prima stampa di prova).
// Avvio: npm run pdf   (serve Playwright e pdftotext; da rifare quando cambiano le regole, come "npm run pagine")
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..');
for (const f of ['data', 'map', 'game', 'territory', 'troops', 'combat', 'economy', 'buildings', 'transport', 'turn', 'save', 'rules']) require(path.join(ROOT, 'js', f + '.js'));
const DM = globalThis.DM;

const NAVY = '#1f2a44', GOLD = '#b8902a';
// le regole senza l'indice del sito (nel PDF c'è il suo, con le pagine); in ogni titolo un segno invisibile per trovarne la pagina
const rules = DM.rulesHTML().replace(/<nav class="toc">[\s\S]*?<\/nav>/, '')
  .replace(/<h3>(\d+)\. (.*?)<\/h3>/g, (_, n, t) => `<h3><span class="num">${n}</span>${t}</h3>`);
const titles = [...rules.matchAll(/<h3><span class="num">(\d+)<\/span>(.*?)<\/h3>/g)].map(m => [m[1], m[2]]);

const html = pages => `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Damamondo – Regolamento</title>
<style>
  @page { size: A4; margin: 20mm 17mm 18mm 17mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; font-size: 9.6pt; line-height: 1.45; color: #1c2330; margin: 0; }
  td.long { text-align: left; }
  /* copertina */
  .cover { height: 257mm; border: 2.4pt solid ${NAVY}; padding: 4mm; page-break-after: always; }
  .cover .in { height: 100%; border: 1pt solid ${GOLD}; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 18mm; }
  .cover .tag { color: ${GOLD}; font-weight: 700; letter-spacing: 2.5pt; font-size: 10.5pt; }
  .cover h1 { color: ${NAVY}; font-size: 46pt; letter-spacing: 2pt; margin: 7mm 0 4mm; }
  .cover .star { width: 16mm; height: 16mm; margin: 2mm 0 6mm; }
  .cover .sub { font-size: 13pt; color: #2a3440; margin: 0 0 3mm; }
  .cover .line { font-style: italic; color: #6a7380; font-size: 10.5pt; max-width: 120mm; }
  .cover .ed { margin-top: 48mm; color: #6a7380; font-size: 9.5pt; }
  /* indice */
  .toc { page-break-after: always; }
  .toc ol { list-style: none; padding: 0; margin: 5mm 0 0; font-size: 10.5pt; }
  .toc li { display: flex; align-items: baseline; margin: 2.6mm 0; }
  .toc li .t { text-transform: uppercase; }
  .toc li .dots { flex: 1; border-bottom: 1.2pt dotted #9aa3ae; margin: 0 2mm; transform: translateY(-1mm); }
  /* capitoli */
  h3, .bar { background: ${NAVY}; color: #fff; text-transform: uppercase; font-size: 12.5pt; letter-spacing: .6pt; padding: 2.2mm 3.5mm; margin: 7mm 0 3mm; break-after: avoid; }
  h3 .num { margin-right: 2.5mm; }
  section.rule:first-of-type h3 { margin-top: 0; }
  h4 { color: ${NAVY}; font-size: 10.8pt; margin: 4.5mm 0 1.5mm; break-after: avoid; }
  p { margin: 1.4mm 0; orphans: 3; widows: 3; }
  p.art > b:first-child { color: ${NAVY}; display: inline-block; min-width: 8.5mm; }
  p.note { font-size: 8.4pt; color: #5b6470; }
  ul { margin: 1.2mm 0; padding-left: 5mm; }
  /* tabelle */
  .tw { margin: 2.4mm 0 3.2mm; }
  table { border-collapse: collapse; width: 100%; font-size: 8.3pt; }
  tr { break-inside: avoid; }
  th { background: ${NAVY}; color: #fff; font-weight: 700; text-align: center; padding: 1.4mm 1.6mm; border: .5pt solid ${NAVY}; }
  td { padding: 1.2mm 1.6mm; border: .5pt solid #c9cfd8; text-align: center; vertical-align: middle; }
  td:first-child { text-align: left; font-weight: 700; color: #1f2a44; }
  tbody tr:nth-child(even) td { background: #f1f3f7; }
  /* riquadri */
  .box { margin: 2.5mm 0 3mm; padding: 2.4mm 3.5mm; background: #fff4d6; border-left: 2.4pt solid ${GOLD}; font-size: 8.9pt; break-inside: avoid; }
  .box b { display: block; text-transform: uppercase; font-size: 8pt; letter-spacing: .6pt; color: #5a4210; margin-bottom: .6mm; }
  .box.imp { background: #fdecea; border-color: #c0392b; }
  .box.imp b { color: #8e2318; }
</style></head><body>
<div class="cover"><div class="in">
  <div class="tag">REGOLAMENTO UFFICIALE</div>
  <h1>DAMAMONDO</h1>
  <svg class="star" viewBox="-1 -1 2 2"><path fill="${GOLD}" d="${Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .42 : .95; return (i ? 'L' : 'M') + (Math.cos(a) * r).toFixed(3) + ' ' + (Math.sin(a) * r).toFixed(3); }).join(' ')}Z"/></svg>
  <p class="sub">Gioco da tavolo di strategia per 2 o più giocatori</p>
  <p class="line">Costruisci città e porti, estrai minerali, commercia, addestra truppe e conquista il mondo.</p>
  <p class="ed">Edizione di novembre 2026</p>
</div></div>
<div class="toc"><div class="bar">Indice</div><ol>
${titles.map(([n, t]) => `<li><span class="t">${n}&nbsp;&nbsp;${t}</span><span class="dots"></span><span>${pages[n] || ''}</span></li>`).join('\n')}
</ol></div>
${rules}
</body></html>`;

async function print(p, pages, out) {
  await p.setContent(html(pages), { waitUntil: 'load' });
  // nelle tabelle i testi lunghi vanno a sinistra, i numeri e le parole brevi al centro
  await p.evaluate(() => document.querySelectorAll('table').forEach(t => {
    const rows = [...t.querySelectorAll('tbody tr')];
    const n = Math.max(...rows.map(r => r.cells.length));
    for (let c = 0; c < n; c++) if (rows.some(r => r.cells[c] && r.cells[c].textContent.length > 28)) rows.forEach(r => r.cells[c] && r.cells[c].classList.add('long'));
  }));
  await p.emulateMedia({ media: 'print', colorScheme: 'light' });
  await p.pdf({ path: out, format: 'A4', printBackground: true, displayHeaderFooter: true,
    headerTemplate: `<div style="width:100%;margin:0 17mm;padding-bottom:1.5mm;border-bottom:.5pt solid #c9cfd8;font-family:Arial;font-size:7.5pt;color:#6a7380"><b style="color:${NAVY}">DAMAMONDO</b> · Regolamento</div>`,
    footerTemplate: '<div style="width:100%;text-align:center;font-family:Arial;font-size:8pt;color:#6a7380">- <span class="pageNumber"></span> -</div>',
    margin: { top: '20mm', bottom: '18mm', left: '17mm', right: '17mm' } });
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  // 1ª stampa: dove cade ogni capitolo
  const tmp = path.join(os.tmpdir(), 'damamondo-prova.pdf');
  await print(p, {}, tmp);
  const text = execFileSync('pdftotext', ['-layout', tmp, '-']).toString().split('\f');
  const pages = {};
  const plain = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  text.forEach((pg, i) => {
    if (i < 2) return;   // copertina e indice
    const lines = pg.split('\n').map(plain);
    for (const [n, t] of titles) if (!pages[n] && lines.some(l => l === plain(n + ' ' + t))) pages[n] = i + 1;
  });
  if (Object.keys(pages).length !== titles.length) throw new Error('non trovo tutti i capitoli: ' + JSON.stringify(pages));
  // 2ª stampa: con i numeri di pagina nell'indice
  const out = path.join(ROOT, 'Damamondo_Regolamento.pdf'), body = path.join(os.tmpdir(), 'damamondo-corpo.pdf'), cover = path.join(os.tmpdir(), 'damamondo-copertina.pdf');
  await print(p, pages, body);
  await p.setContent(html(pages).replace(/<div class="toc">[\s\S]*<\/body>/, '</body>'), { waitUntil: 'load' });
  await p.pdf({ path: cover, format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '18mm', left: '17mm', right: '17mm' } });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'damamondo-pagine-'));
  execFileSync('pdfseparate', [body, path.join(dir, 'p-%03d.pdf')]);
  const rest = fs.readdirSync(dir).sort().slice(1).map(f => path.join(dir, f));
  execFileSync('pdfunite', [cover, ...rest, out]);
  [body, cover, ...rest, path.join(dir, 'p-001.pdf')].forEach(f => fs.unlinkSync(f)); fs.rmdirSync(dir);
  await b.close();
  fs.unlinkSync(tmp);
  console.log('scritto', out, '· capitoli alle pagine', JSON.stringify(pages));
})();
