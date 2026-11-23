// Mappa di prova disegnata a mano e partita già avviata con 2 giocatori.
const DM = require('./load')();
// Bordo di mare 2 cm; mare a destra (x>52); fiume verticale x 29,5–30,5; deserto, giungla, tundra,
// montagna, palude, alta montagna, banchisa, lavico in riquadri noti; il resto Pianura.
function testBiome(x, y) {
  if (x < 2 || y < 2 || x > 58 || y > 40) return 'S';
  if (x > 52) return y > 30 ? 'I' : 'S';
  if (x >= 29.5 && x <= 30.5) return 'F';
  if (y < 8) {
    if (x < 8) return 'D'; if (x < 14) return 'G'; if (x < 20) return 'T'; if (x < 26) return 'M';
  }
  if (y > 34) {
    if (x < 8) return 'L'; if (x < 14) return 'A'; if (x < 20) return 'Z'; if (x < 26) return 'H';
  }
  return 'P';
}
function testGame(opts = {}) {
  const G = DM.newGame({}, 1, DM.mapFromFn(opts.biome || testBiome, opts.volc));
  DM.setPlayers(G, opts.np || 2);
  const caps = opts.caps || [[15, 20], [45, 20], [15, 30], [45, 30], [38, 10], [22, 12]];
  for (let i = 0; i < G.np; i++) {
    DM.chooseKit(G, opts.kits ? opts.kits[i] : 0);
    const m = DM.placeCapital(G, caps[i][0], caps[i][1]);
    if (G.phase !== 'play' && G.p !== i + 1) throw new Error('capitale non piazzata: ' + m);
  }
  return G;
}
// Prende terra intorno a un punto per il giocatore o
function own(G, o, x, y) { DM.claim(G, o, x, y); }
module.exports = { DM, testBiome, testGame, own };
