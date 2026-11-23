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
| `js/turn.js` | fine turno, giri, eruzioni, Lavico |
| `js/render.js` | disegno della mappa |
| `js/ui.js`, `js/main.js` | tocchi, pannelli, pulsanti, avvio |

Le regole (`data` … `turn`) non usano la pagina: si possono provare da sole e riusare per un'app.

## Prove

```
npm test               # 42 prove delle regole (serve Node 18+)
npm run test:browser   # 23 passi giocati in un browser che finge un iPhone (serve Playwright)
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

## Ancora da fare

1. Porto obbligatorio per navigare in mare aperto.
2. Trasporto di truppe sui veicoli e Soldato "autista" lasciato dai veicoli distrutti.
3. Pubblicare fuori da Claude (per esempio GitHub Pages) e, più avanti, farne un'app.
