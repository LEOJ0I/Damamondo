// I bot: preparazione, turni completi, limiti delle regole, salvataggio. Molte partite tra bot, senza pagina.
const test = require('node:test'), assert = require('node:assert/strict');
const DM = require('./load')();

// numeri "a caso" ripetibili
const seedRand = s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
function botGame(seed, levels, opts) {
  DM.rand = seedRand(seed);
  const G = DM.newGame(opts || { comp: 2 }, seed);
  DM.setPlayers(G, levels.length);
  levels.forEach((l, o) => DM.setBot(G, o, l));
  let guard = 0;
  while (G.phase !== 'play' && guard++ < 20) DM.botSetup(G);
  return G;
}
const terrOf = (G, o) => { let n = 0; for (const v of G.terr) if (v === o) n++; return n; };

test('nomi e livelli dei bot; si salvano con la partita', () => {
  const G = DM.newGame({}, 3);
  DM.setPlayers(G, 3);
  DM.setBot(G, 1, 'difficile');
  assert.deepEqual(G.names, ['Giocatore 1', 'Ammiraglia Blu', 'Giocatore 3']);
  assert.equal(DM.isBot(G, 0), false); assert.equal(DM.isBot(G, 1), true);
  DM.setBot(G, 1, '');
  assert.equal(G.names[1], 'Giocatore 2'); assert.equal(DM.isBot(G, 1), false);
  const H = botGame(5, ['normale', 'facile']);
  const K = DM.deserialize(DM.serialize(H));
  assert.deepEqual(K.bots, ['normale', 'facile']);
  assert.deepEqual(K.names, ['Generale Rosso', 'Ammiraglia Blu']);
});

test('preparazione: i bot scelgono il kit e mettono la Capitale in un posto valido, lontano dagli altri', () => {
  for (const seed of [1, 2, 3, 4]) {
    const G = botGame(seed, ['normale', 'difficile', 'facile', 'normale']);
    assert.equal(G.phase, 'play');
    const caps = G.sites.filter(s => s.k === 'cap');
    assert.equal(caps.length, 4);
    for (const c of caps) {
      assert.ok(!DM.NO_CAPITAL.includes(DM.bAt(G, c.x, c.y)), 'bioma vietato per la Capitale');
      for (const d of caps) if (d !== c) assert.ok(Math.hypot(c.x - d.x, c.y - d.y) >= DM.capitalMinDist(4) - 1e-9);
    }
  }
});

test('partite intere tra bot: ogni azione cambia qualcosa, si rispettano i limiti, il regno cresce', () => {
  const tally = {}, start = Date.now();
  let turns = 0;
  for (const [seed, levels] of [[11, ['difficile', 'normale', 'facile']], [23, ['normale', 'normale']], [37, ['difficile', 'difficile', 'difficile', 'difficile']], [41, ['facile', 'difficile']]]) {
    const G = botGame(seed, levels, { comp: 3 });
    const t0 = levels.map((_, o) => terrOf(G, o));
    while (G.round <= 40 && DM.alive(G).length > 1) {
      const me = G.p, others = JSON.stringify(G.units.filter(u => u.o !== me).map(u => [u.id, u.x, u.y]));
      for (const a of DM.botTurn(G)) {
        assert.equal(typeof a.msg, 'string');
        assert.ok(a.kind, 'ogni azione dice che tipo è');
        const k = a.kind + ':' + a.msg.split(/[ :.(]/)[0]; tally[k] = (tally[k] || 0) + 1;
      }
      // limiti del turno (la Bomba con limite sotto 3 vale 3 spari: è la regola corretta)
      assert.ok(G.moved <= DM.moveLimit(G.round), 'troppe mosse');
      assert.ok(G.shots <= Math.max(DM.shotLimit(G.round), 3), 'troppi spari');
      // il bot muove solo le sue truppe (le altre si spostano solo se colpite... ma non di posto)
      const after = new Map(G.units.filter(u => u.o !== me).map(u => [u.id, [u.x, u.y]]));
      JSON.parse(others).forEach(([id, x, y]) => { const p = after.get(id); if (p && !G.units.find(u => u.id === id).carried) assert.ok(Math.hypot(p[0] - x, p[1] - y) < 1e-9, 'ha mosso una truppa di un altro'); });
      for (const u of G.units) { assert.ok(u.hp > 0); assert.ok(u.x >= 0 && u.y >= 0 && u.x <= DM.W && u.y <= DM.H, 'truppa fuori mappa'); }
      DM.endTurn(G); turns++;
    }
    levels.forEach((_, o) => { if (!G.players[o].out) assert.ok(terrOf(G, o) > t0[o], 'il bot ' + o + ' non ha preso territorio (partita ' + seed + ')'); });
  }
  const has = re => Object.keys(tally).some(k => re.test(k));
  assert.ok(has(/^act:Mossa/), 'si muovono');
  assert.ok(has(/schierato|^act:Soldato/), 'schierano');
  assert.ok(has(/^act:Venduti/), 'vendono al Banco');
  assert.ok(has(/^mine:/), 'costruiscono miniere');
  assert.ok(has(/^act:Caricati/) && has(/^act:Scaricato/), 'i Carri portano i soldi a casa');
  assert.ok(has(/^shoot:/), 'sparano');
  assert.ok(has(/^army:/), 'formano eserciti');
  const ms = (Date.now() - start) / turns;
  assert.ok(ms < 80, 'un turno di bot deve essere veloce: ' + ms.toFixed(1) + ' ms');
});

test('stesso numero di partenza, stessa partita (niente sorprese)', () => {
  const play = () => { const G = botGame(9, ['normale', 'difficile']); while (G.round <= 12) { DM.botPlayTurn(G); DM.endTurn(G); } return DM.serialize(G).replace(/"saved":\d+/, ''); };
  assert.equal(play(), play());
});

test('senza Capitale il bot sceglie una Città appena ha lì metà dei soldi', () => {
  const G = botGame(5, ['normale', 'normale']);
  const c = DM.capitalOf(G, 0), q = G.players[0];
  const city = DM.addSite(G, 0, 'citta', c.x + 3, c.y);
  const other = DM.addSite(G, 0, 'acc', c.x - 3, c.y);
  other.inv.mon = 100000; city.inv.mon = 1000;   // la Città è povera: la Capitale non si sposta da sola
  DM.destroySite(G, c);
  assert.equal(q.noCap, true);
  city.inv.mon = 200000;                           // arrivano i soldi (per esempio con un Carro)
  G.p = 0;
  const log = DM.botPlayTurn(G);
  assert.ok(log.some(a => /Capitale/.test(a.msg)), 'ha scelto la nuova Capitale');
  assert.equal(DM.capitalOf(G, 0).id, city.id);
  assert.equal(q.noCap, false);
});
