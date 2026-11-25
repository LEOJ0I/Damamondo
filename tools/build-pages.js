// Damamondo – crea le pagine statiche dalle regole del gioco:
//   regole.html   il regolamento completo, leggibile da persone, motori di ricerca e AI (senza far partire il gioco)
//   llms.txt      presentazione breve per le AI (formato llmstxt.org)
//   llms-full.txt tutte le regole in testo semplice
// Avvio: npm run pagine   (da rifare quando cambiano le regole: la prova tests/pages.test.js controlla che siano aggiornate)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SITE = 'https://leoj0i.github.io/Damamondo/';

function loadDM() {
  for (const f of ['data', 'map', 'game', 'territory', 'troops', 'combat', 'economy', 'buildings', 'transport', 'turn', 'save', 'rules']) {
    require(path.join(ROOT, 'js', f + '.js'));
  }
  return globalThis.DM;
}

const INTRO = 'Damamondo (Damamondo Classico) è un gioco di strategia da tavolo per 2 o più giocatori ' +
  'che si gioca su carta (4 fogli A4 con righello, dadi e perline) oppure sul telefono, a turni sullo stesso dispositivo. ' +
  'Ogni giocatore guida un popolo: costruisce città, porti e miniere, vende i minerali al Banco, addestra Soldati, Navi, ' +
  'Elicotteri e Carrarmati e conquista territori su una mappa di 60 × 42 cm con biomi, fiumi e vulcani.';
const NOT = 'Damamondo non è il gioco della campana (o "mondo"), non è la dama e non ha niente a che fare con i mobili "Dama" di Mondo Convenienza: è un nome proprio inventato per questo gioco.';

// HTML del regolamento → testo semplice (titoli, elenchi, tabelle con " | ")
function htmlToText(html) {
  return html
    .replace(/<nav class="toc">[\s\S]*?<\/nav>/, '')
    .replace(/<h3>(.*?)<\/h3>/g, '\n\n## $1\n')
    .replace(/<h4>(.*?)<\/h4>/g, '\n\n### $1\n')
    .replace(/<tr>/g, '\n').replace(/<\/t[hd]><t[hd]>/g, ' | ')
    .replace(/<li>/g, '\n- ')
    .replace(/<p>/g, '\n\n').replace(/<br>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

function build() {
  const DM = loadDM();
  const rules = DM.rulesHTML();
  const desc = 'Regole complete di Damamondo Classico, gioco di strategia da tavolo: kit di partenza, truppe, eserciti, trasporto, città, edifici, miniere, Banco, territori, biomi, bacche e pozioni.';
  const regole = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Regole di Damamondo – gioco di strategia da tavolo</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${SITE}regole.html">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Damamondo">
  <meta property="og:title" content="Regole di Damamondo">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${SITE}regole.html">
  <meta property="og:image" content="${SITE}anteprima.png">
  <link rel="stylesheet" href="css/style.css">
  <style>
    body { display: block; max-width: 820px; margin: 0 auto; padding: 16px; }
    .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .top a.play { background: var(--ac); color: #111; font-weight: 700; padding: 12px 18px; border-radius: 12px; text-decoration: none; }
    h1 { margin: 6px 0; font-size: 30px; }
    .intro { font-size: 17px; }
    .note { opacity: .85; }
    @media print { .top a.play { display: none; } .tw { overflow: visible; } }
  </style>
  <script type="application/ld+json">
  ${JSON.stringify({ '@context': 'https://schema.org', '@type': 'Game', name: 'Damamondo', alternateName: 'Damamondo Classico', url: SITE, description: INTRO, inLanguage: 'it', numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 2 } })}
  </script>
</head>
<body>
  <div class="top"><b>DAMAMONDO</b><a class="play" href="index.html">Gioca a Damamondo</a></div>
  <h1>Regole di Damamondo Classico</h1>
  <p class="intro">${INTRO}</p>
  <p class="note">${NOT}</p>
  <div class="rules">
${rules}
  </div>
  <p><a href="index.html">← Torna al gioco</a></p>
</body>
</html>
`;
  const llms = `# Damamondo

> ${INTRO}

${NOT}

Per vincere bisogna sconfiggere gli avversari: chi resta senza Capitale e senza una Città in cui trasferirla perde. I giocatori possono anche decidere di giocare all'infinito.

## Pagine

- [Gioca a Damamondo](${SITE}): il gioco nel browser, pensato per il telefono (menu: Gioca → Locale, Regole)
- [Regole complete](${SITE}regole.html): il regolamento ufficiale con tutte le tabelle
- [Regole in testo semplice](${SITE}llms-full.txt): lo stesso regolamento, in testo

## In breve

- Mappa di 60 × 42 cm (4 fogli A4), distanze in cm; biomi: Pianura, Deserto, Giungla, Palude, Tundra, Montagna, Alta montagna, fiumi e laghi, Vulcanico, Lavico, Glaciale, Banchisa.
- 5 kit di partenza: Tribù, Minatori, Mercanti, Navigatori, Maghi.
- 7 truppe: Soldato, Nave, Elicottero, Carrarmato, Carro, Nave Carro, Aereo Carro; eserciti e flotte fino a 100 punti.
- Economia: soldi e materiali dentro gli edifici, miniere con il dado, Banco che compra i minerali, Carri per trasportare.
- Armi e oggetti: Bombe, Superbombe, bacche e pozioni.
`;
  const full = `# Regole di Damamondo Classico\n\n${INTRO}\n\n${NOT}\n\nFonte: ${SITE}regole.html\n\n${htmlToText(rules)}\n`;
  return { 'regole.html': regole, 'llms.txt': llms, 'llms-full.txt': full };
}

module.exports = { build, ROOT };

if (require.main === module) {
  const out = build();
  for (const [name, text] of Object.entries(out)) {
    fs.writeFileSync(path.join(ROOT, name), text);
    console.log('scritto', name, text.length, 'caratteri');
  }
}
