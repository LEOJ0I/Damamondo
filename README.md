# Damamondo Classico – prototipo

Gioco da tavolo di strategia, versione digitale da giocare sul telefono (tutti sullo stesso telefono, a turno).
Si apre `index.html` nel browser: non serve installare niente.

## Come è fatto

| File | Cosa contiene |
|---|---|
| `index.html` | la pagina |
| `css/style.css` | aspetto (pensato per il telefono, tema chiaro e scuro) |
| `js/data.js` | tutte le tabelle del regolamento: truppe, biomi, costi, kit, Banco, miniere |
| `js/map.js` | generazione della mappa 60×42 cm (biomi, fiumi, laghi, vulcani, banchisa) |
| `js/game.js` | stato della partita, preparazione, edifici, Capitale |
| `js/territory.js` | territori, conquista, cessione |
| `js/troops.js` | velocità, movimento, strade, ponti, eserciti, schieramento |
| `js/combat.js` | spari, Bombe, Superbombe, bacche, pozioni |
| `js/economy.js` | soldi e materiali, Banco, acquisti, carichi, miniere, rendite |
| `js/buildings.js` | costruzione di edifici, Porti, Aeroporti, strade, ponti |
| `js/transport.js` | truppe a bordo dei veicoli, autista, Porti |
| `js/turn.js` | fine turno, giri, eruzioni, Lavico |
| `js/save.js` | salvare e riprendere la partita |
| `js/render.js` | disegno della mappa |
| `js/decor.js` | dettagli quando si ingrandisce (opzione): alberi, montagne, onde, minerali, case, disegni delle truppe |
| `js/ui.js` | schermata di gioco: tocchi, pannelli, pulsanti |
| `js/menu.js` | menu iniziale (Gioca → Locale / Multiplayer, Regole) e le 3 partite salvate |
| `js/rules.js` | il regolamento completo, con le tabelle prese dai dati del gioco |
| `js/main.js` | avvio |

Le regole (`data` … `turn`) non usano la pagina: si possono provare da sole e riusare per un'app.

## Prove

```
npm test               # 53 prove delle regole (serve Node 18+)
npm run test:browser   # 34 passi giocati in un browser che finge un iPhone (serve Playwright)
```

## Regole decise insieme (oltre al PDF)

Le correzioni del documento di passaggio e le decisioni prese con l'utente sono tutte nel regolamento dentro il gioco (menu "Regole"). Le principali:

- **Bersagli**: chi spara sceglie se colpire una truppa, un esercito, le truppe dentro un edificio (come un esercito) o l'edificio. Le truppe non sparano mai alle cose proprie; Bombe, Superbombe e bacche invece possono colpire anche quelle.
- **Edificio distrutto**: si perde quello che conteneva, ma le truppe dentro restano vive (le ferisce solo una Bomba sull'edificio, che colpisce tutto quello che c'è dentro).
- **Ponti a pezzi**: si comprano pezzi da 1 cm; il ponte usa un pezzo per ogni cm d'acqua, arrotondato per eccesso.
- **Strade**: si fermano all'acqua e si collegano alle estremità dei ponti; si paga solo la parte sulla terra.
- **Navi e Porti**: le Navi partono da un Porto o da un fiume entro 1 cm da una propria Città; sulle navi si sale e si scende solo in un proprio Porto.
- **Bomba con limite sotto 3**: una sola, se non si è ancora sparato. **Superbomba**: 5 spari, quindi dal giro 16.
- **Città con meno di 5.000 soldi**: niente rendita. **Coltivazione**: solo nei biomi che danno bacche.

## Menu e salvataggi

All'apertura c'è il menu: **Gioca** (Locale o Multiplayer, che per ora dice "Coming soon") e **Regole** (tutto il regolamento con le correzioni).
In Locale si tengono fino a 3 partite nel telefono: ognuna si salva da sola a ogni mossa e si riprende con "Continua". Dal pannello "Salvataggi" della partita si scarica un file, che si può riaprire da "Apri da file".

## Ancora da fare

1. Multiplayer.
2. Pubblicare fuori da Claude (per esempio GitHub Pages) e, più avanti, farne un'app.
