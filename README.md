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
| `js/secret.js`, `js/secret-data.js` | le mappe segrete (Easter egg): si trovano con certi numeri mappa e certe opzioni. I contorni delle terre vengono da [Natural Earth](https://www.naturalearthdata.com) (pubblico dominio), tramite il pacchetto world-atlas. C’è anche la mappa originale, ricopiata dai quattro fogli disegnati a mano |
| `js/bot.js` | i bot (Facile, Normale, Difficile): scelgono kit e Capitale; hanno una "lista della spesa" (truppe e armi che vogliono) e tengono i materiali che servono, vendendo solo il resto; scelgono le miniere per il minerale che manca e mandano un soldato (o il Carro) dove aprirle; i Carri portano tutto in Capitale; comprano anche negli Accampamenti, che mettono sul confine con le terre libere; formano eserciti, sparano, lanciano bombe, difendono la Capitale e attaccano quella nemica più debole; se il nemico è oltre il mare puntano su Elicotteri e Navi. Un'azione alla volta, con le stesse regole delle persone |
| `js/render.js` | disegno della mappa |
| `js/decor.js` | dettagli quando si ingrandisce (opzione): alberi, montagne, onde, minerali, case, disegni delle truppe |
| `js/ui.js` | schermata di gioco: tocchi, pannelli, pulsanti |
| `js/menu.js` | menu iniziale (Gioca → Locale / Multiplayer, Regole) e le 3 partite salvate |
| `js/rules.js` | il regolamento completo, con le tabelle prese dai dati del gioco |
| `js/music.js` | la sigla di Damamondo: musica originale suonata dal browser, nel menu e in partita |
| `js/prefs.js` | le Impostazioni ricordate nel telefono |
| `js/sfx.js` | effetti sonori fatti dal browser (bombe, eruzioni, passi, dado, cantiere, monete, bacche…) e vibrazione |
| `js/fx.js` | animazioni: truppe che viaggiano, bombe in volo, esplosioni, cantieri, dado, cartello del turno, scosse |
| `js/settings.js` | la finestra Impostazioni (ingranaggio): musica, effetti sonori, animazioni, vibrazione, dettagli quando ingrandisci |
| `js/main.js` | avvio |
| `tools/build-pages.js` | crea `regole.html`, `llms.txt` e `llms-full.txt` dalle regole del gioco (`npm run pagine`) |
| `regole.html` | il regolamento come pagina normale: da leggere, stampare, e per Google e le AI |
| `llms.txt`, `llms-full.txt` | cos'è Damamondo e le regole in testo, per le AI |
| `manifest.webmanifest`, `icons/`, `sw.js` | app installabile (PWA): nome, icona con la stella, a tutto schermo, funziona senza internet. `sw.js` lo crea `npm run pagine`; le icone `node tools/make-icons.js` |

Le regole (`data` … `turn`) non usano la pagina: si possono provare da sole e riusare per un'app.

Animazioni e suoni non toccano le regole: prima di un'azione l'interfaccia fa una "foto" della partita, dopo `js/fx.js` guarda cosa è cambiato (truppe mosse o eliminate, edifici nuovi o distrutti, soldi, territorio, lava) e sceglie animazione e suono. Le azioni che "volano" (bomba, bacca, colpi, dado, eruzione) mostrano il risultato sulla mappa solo all'arrivo; un tocco le salta.

## Prove

```
npm test               # 77 prove delle regole, dei bot (anche partite intere tra bot) e delle mappe segrete (anche che le pagine statiche siano aggiornate) (serve Node 18+)
npm run test:browser   # 41 passi giocati (anche contro i bot, sulle mappe segrete e sulla mappa originale), 15 prove di animazioni e suoni, prova dell'app senza internet, in un browser che finge un iPhone (serve Playwright)
```

## Regole decise insieme (oltre al PDF)

Le correzioni del documento di passaggio e le decisioni prese con l'utente sono tutte nel regolamento dentro il gioco (menu "Regole"). Le principali:

- **Truppe aeree**: tutte le truppe le possono colpire.
- **Colpi sugli eserciti**: chi subisce riceve ogni colpo su una truppa a caso, solo tra le vive (anche le truppe dentro un edificio). Chi spara resta com'era.
- **Bersagli**: chi spara sceglie se colpire una truppa, un esercito, le truppe dentro un edificio (come un esercito) o l'edificio. Le truppe non sparano mai alle cose proprie; Bombe, Superbombe e bacche invece possono colpire anche quelle.
- **Edificio distrutto**: si perde quello che conteneva, ma le truppe dentro restano vive (le ferisce solo una Bomba sull'edificio, che colpisce tutto quello che c'è dentro).
- **Ponti a pezzi**: si comprano pezzi da 1 cm; il ponte usa un pezzo per ogni cm d'acqua, arrotondato per eccesso.
- **Strade**: si fermano all'acqua e si collegano alle estremità dei ponti; si paga solo la parte sulla terra.
- **Navi e Porti**: le Navi partono da un Porto o da un fiume entro 1 cm da una propria Città; sulle navi si sale e si scende solo in un proprio Porto.
- **Bomba con limite sotto 3**: una sola, se non si è ancora sparato. **Superbomba**: 5 spari, quindi dal giro 16.
- **Città con meno di 5.000 soldi**: niente rendita. **Coltivazione**: solo nei biomi che danno bacche.

## App sul telefono

Dal sito: Safari → tasto condividi → **Aggiungi alla schermata Home** (Android/Chrome: menu → **Installa app**). Si apre a tutto schermo con l'icona della stella e funziona anche senza internet; quando il sito si aggiorna, l'app si aggiorna da sola.

## Menu e salvataggi

All'apertura c'è il menu: **Gioca** (Locale o Multiplayer, che per ora dice "Coming soon") e **Regole** (tutto il regolamento con le correzioni).
In Locale si tengono fino a 3 partite nel telefono: ognuna si salva da sola a ogni mossa e si riprende con "Continua". Dal pannello "Salvataggi" della partita si scarica un file, che si può riaprire da "Apri da file".

## Ancora da fare

1. Multiplayer.
2. Pubblicare fuori da Claude (per esempio GitHub Pages) e, più avanti, farne un'app.
