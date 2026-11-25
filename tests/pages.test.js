// Le pagine statiche (regole.html, llms.txt, llms-full.txt) devono essere uguali a quelle create dalle regole del gioco.
// Se questa prova fallisce: npm run pagine
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { build, ROOT } = require('../tools/build-pages');

test('regole.html e i file per le AI sono aggiornati con le regole del gioco', () => {
  const out = build();
  for (const [name, text] of Object.entries(out)) {
    assert.equal(fs.readFileSync(path.join(ROOT, name), 'utf8'), text, name + ' non è aggiornato: esegui "npm run pagine"');
  }
});

test('le pagine dicono chiaramente cos’è Damamondo e contengono le regole', () => {
  const out = build();
  assert.match(out['llms.txt'], /^# Damamondo\n\n> Damamondo \(Damamondo Classico\) è un gioco di strategia da tavolo/);
  assert.match(out['llms.txt'], /non è il gioco della campana/);
  assert.match(out['llms.txt'], /\(https:\/\/leoj0i\.github\.io\/Damamondo\/regole\.html\)/);
  assert.match(out['llms-full.txt'], /## 5\. Eserciti e flotte/);
  assert.match(out['llms-full.txt'], /Soldato \| 1 \| 70 \| 100 \| 1/);
  assert.doesNotMatch(out['llms-full.txt'], /<[a-z]|undefined|NaN/);
  assert.match(out['regole.html'], /<title>Regole di Damamondo/);
  assert.equal((out['regole.html'].match(/<section class="rule"/g) || []).length, 16);
});
