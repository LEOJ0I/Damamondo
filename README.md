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
npm test               # 51 prove delle regole (serve Node 18+)
npm run test:browser   # 33 passi giocati in un browser che finge un iPhone (serve Playwright)
```

## Decisioni prese (da confermare)

Le correzioni del documento di passaggio hanno la precedenza sul PDF. Dove il regolamento non diceva abbastanza:

- **Bomba con limite sotto 3**: si lancia solo se nel turno non si è ancora sparato. Con limite 5 si lancia 1 Bomba (3+3 supererebbe 5), con 8 due.
- **Superbomba**: vale 5 spari, quindi si usa dal giro 16. Può essere lanciata anche su un punto vuoto (lascia l'area radioattiva).
- **Bombe sui propri edifici**: permesse (consiglio "bombarda la tua città prima che la conquistino"); le truppe nemiche hanno la precedenza.
- **Truppa nemica dentro un edificio**: chi spara colpisce prima la truppa, poi l'edificio.
- **Città con meno di 5.000 soldi**: niente rendita (conta come Accampamento). La Capitale paga sempre.
- **Ponte**: si paga per ogni cm d'acqua attraversata (arrotondato per eccesso).
- **Strade**: possono passare sull'acqua solo sopra un proprio ponte. Il viaggio può passare da più edifici collegati.
- **Porto**: si può costruire in mare, nei fiumi e nei laghi.
- **Coltivazione**: solo nei biomi che danno bacche (Deserto, Giungla, Palude, Tundra).
- **Aereo Carro**: carica e scarica solo in un Aeroporto.
- **Edificio distrutto**: muoiono le truppe del proprietario che ci sono dentro, non quelle nemiche vicine.

- **Navi e Porti** (deciso dall'utente): le Navi partono da un Porto, oppure da un fiume entro 1 cm da una propria Città. Chi scende da una nave scende dentro un proprio Porto e poi va a terra camminando sul molo.
- **Trasporto**: si sale entro 1 cm dal veicolo; chi è a bordo non muove, non spara e non può essere colpito. Il Carro regalato con Nave Carro e Aereo Carro parte a bordo.
- **Veicolo distrutto**: scendono quelli a bordo e l'autista (un Soldato) nel punto più vicino dove possono stare; se sono in mare aperto, si perdono.
- **Aereo Carro**: parte e atterra solo nei propri Aeroporti (al massimo 12 cm a turno), e solo lì carica e scarica.

## Menu e salvataggi

All'apertura c'è il menu: **Gioca** (Locale o Multiplayer, che per ora dice "Coming soon") e **Regole** (tutto il regolamento con le correzioni).
In Locale si tengono fino a 3 partite nel telefono: ognuna si salva da sola a ogni mossa e si riprende con "Continua". Dal pannello "Salvataggi" della partita si scarica un file, che si può riaprire da "Apri da file".

## Ancora da fare

1. Multiplayer.
2. Pubblicare fuori da Claude (per esempio GitHub Pages) e, più avanti, farne un'app.
