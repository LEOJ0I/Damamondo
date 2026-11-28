// Damamondo – la modalità Classico (si sblocca trovando la mappa originale): Damamondo com'era prima dei biomi speciali e delle miniere.
// Niente miniere, Banco, bacche, Coltivazioni, Aeroporti, strade, Carri, vulcani; solo Pianura, Mare, Fiumi/laghi, Montagna e Alta montagna.
// I soldi "si teletrasportano" tra le città del giocatore, ma la Capitale deve sempre tenerne più della metà.
// Funziona come un interruttore: DM.setMode('classico') cambia sul posto le tabelle di data.js (gli altri file tengono
// gli stessi oggetti), DM.setMode('normale') rimette quelle di sempre. La modalità sta in G.map.opts.mode (si salva con la partita).
(function (DM) {
  'use strict';
  const clone = o => JSON.parse(JSON.stringify(o));
  const KEYS = ['TROOPS', 'COST', 'BUILDING_HP', 'INCOME', 'BOMB', 'SPAWNS', 'POTIONS', 'KITS', 'SPAWN_R'];
  const NORMAL = {}; KEYS.forEach(k => { NORMAL[k] = clone(DM[k]); });
  const NORMAL_SCALARS = { CITY_MIN_MONEY: DM.CITY_MIN_MONEY };

  // ---- le tabelle del Classico ----
  const C = clone(NORMAL);
  // velocità a terra: Montagna :2, Alta montagna :4, fiumi e laghi a guado :2 (gli altri biomi non ci sono)
  const land = p => ({ P: p, M: p / 2, A: p / 4, F: p / 2, D: p, G: p, L: p, T: p, H: p, V: p, Z: p, I: p });
  Object.assign(C.TROOPS.S, { range: 2, dmg: 70, hp: 100, land: land(2) });
  Object.assign(C.TROOPS.N, { range: 3, dmg: 500, hp: 3500, sea: 3, river: 3, ice: 1.5 });
  Object.assign(C.TROOPS.E, { range: 3, dmg: 160, hp: 2000, air: 3 });
  Object.assign(C.TROOPS.T, { range: 3, dmg: 1500, hp: 7000, land: land(1) });
  const money = m => [{ m, r: {} }];
  C.COST = {
    S: money(1000), N: money(5000), E: money(7000), T: money(15000),
    citta: money(5000), acc: money(5000), porto: money(5000),
    ponte1: money(1000), ponte2: money(1000),   // liv. 2: si migliora un pezzo di liv. 1 della riserva
    bomba: money(25000), superbomba: money(100000),
    poz_stipendio: money(4000), poz_velocita: money(2000), poz_curacitta: money(1000)
  };
  Object.assign(C.BUILDING_HP, { cap: 20000, citta: 10000 });
  C.INCOME = { cap: 20000, citta: 10000 };
  C.BOMB.bomba.dmg = 2500;
  Object.assign(C.BOMB.superbomba, { dmg: 10000, radTurns: 5, radDmg: 100 });
  C.SPAWNS = { cap: 'SET', citta: 'SET', acc: 'SET', porto: 'N', aer: '', col: '', min: '' };
  C.SPAWN_R = { cap: 2, citta: 1, acc: 1, aer: 1 };
  C.POTIONS = { poz_stipendio: 'Stipendio+', poz_velocita: 'Velocità', poz_curacitta: 'Curacittà' };
  C.KITS = [{ name: 'Classico', money: 30000, S: 2, N: 0, E: 0, C: 0, acc: 0, citta: 0, porto: 10, min: 0, aer: 0, ponte1: 5 }];
  const CLASSIC_SCALARS = { CITY_MIN_MONEY: 0 };

  // cambia le tabelle sul posto (stessi oggetti: gli altri file ne tengono il riferimento)
  function put(target, src) {
    if (Array.isArray(target)) { target.length = 0; clone(src).forEach(x => target.push(x)); return; }
    Object.keys(target).forEach(k => { delete target[k]; });
    Object.assign(target, clone(src));
  }
  DM.mode = 'normale';
  DM.isClassic = () => DM.mode === 'classico';
  DM.setMode = function (mode) {
    mode = mode === 'classico' ? 'classico' : 'normale';
    if (mode === DM.mode) return;
    const src = mode === 'classico' ? C : NORMAL;
    KEYS.forEach(k => put(DM[k], src[k]));
    Object.assign(DM, mode === 'classico' ? CLASSIC_SCALARS : NORMAL_SCALARS);
    DM.BUYABLE = Object.keys(DM.COST);
    DM.mode = mode;
  };
  // i biomi del Classico: tutto quello che non c'era diventa Pianura, Montagna, Alta montagna o Mare
  DM.CLASSIC_BIOME = { D: 'P', G: 'P', L: 'P', T: 'P', H: 'A', I: 'S', V: 'M', Z: 'M' };

  // ---- le carte del Classico ----
  // Carte dei giri: ogni 5 giri si pesca dal mazzo "5 giri", ogni 10 dal mazzo "10 giri" (al 10°, 20°… tutte e due).
  // Carte dei biomi: ogni volta che una truppa (o un esercito) entra in Montagna, Alta montagna o in un fiume/lago, se ne pesca una
  // del mazzo di quel bioma. Le carte si rimettono nel mazzo: ogni volta se ne pesca una a caso.
  const soldiers = A => A.filter(u => u.t === 'S');
  // quanti ne muoiono: la percentuale (per difetto) ma almeno "min" (e non più di quanti ce ne sono)
  const howMany = (n, pct, min) => Math.min(n, Math.max(min, Math.floor(n * pct / 100)));
  const killSome = (G, list, n) => { list.slice().sort(() => DM.rand() - .5).slice(0, n).forEach(u => { u.hp = 0; u.lost = true; }); return n; };
  const fine = (G, p, each) => {   // paga "each" a ogni altro giocatore ancora in gioco
    const others = G.players.map((q, o) => o).filter(o => o !== p && !G.players[o].out);
    let paid = 0;
    others.forEach(o => {
      const have = DM.moneyOf(G, p), t = Math.min(each, have);
      if (t <= 0) return;
      DM.takeMoney(G, p, t); const c = DM.capitalOf(G, o) || DM.sitesOf(G, o)[0]; if (c) c.inv.mon += t; paid += t;
    });
    DM.balanceAll(G);
    return paid;
  };
  const deathCard = (pct, min, verb) => (G, A) => {
    const S = soldiers(A), n = killSome(G, S, howMany(S.length, pct, min));
    return n ? n + (n === 1 ? ' Soldato ' + verb : ' Soldati ' + (verb === 'muore' ? 'muoiono' : verb === 'scompare' ? 'scompaiono' : verb)) + '.' : 'Nessun Soldato nell’esercito: per questa volta niente.';
  };
  DM.CARDS = {
    giri5: [
      { title: 'È passato un po’ di tempo…', text: '…c’è una grande pioggia: per i prossimi 3 giri la gittata di tutte le truppe diminuisce del 50%.',
        play: G => { G.events.push({ k: 'pioggia', until: G.round + 3 }); return 'Gittata dimezzata fino al giro ' + (G.round + 2) + '.'; } }
    ],
    giri10: [
      { title: 'È passato un po’ di tempo…', text: '…c’è una pioggia di meteoriti: per i prossimi 3 giri costruire Elicotteri, Navi e Carrarmati costa la metà.',
        play: G => { G.events.push({ k: 'meteoriti', until: G.round + 3 }); return 'Elicotteri, Navi e Carrarmati a metà prezzo fino al giro ' + (G.round + 2) + '.'; } }
    ],
    M: [
      { title: 'Ti sei addentrato in Montagna…', text: '…alcuni tuoi Soldati hanno mangiato delle piante protette: paga 1.000 soldi a ogni giocatore.',
        play: (G, A, p) => 'Pagati ' + DM.fmtN(fine(G, p, 1000)) + ' soldi.' },
      { title: 'Ti sei addentrato in Montagna…', text: '…il 10% dei Soldati che ti ha fatto pescare questa carta ha mangiato delle bacche velenose, quindi muore (deve morire almeno 1 Soldato).', play: deathCard(10, 1, 'muore') },
      { title: 'Ti sei addentrato in Montagna…', text: '…oh no, ci sono delle slavine: il 50% dei Soldati dell’esercito che ti ha fatto pescare questa carta muore (devono morire almeno 3 Soldati).', play: deathCard(50, 3, 'muore') },
      { title: 'Ti sei addentrato in Montagna…', text: '…c’è stata una nevicata: il 20% dei Soldati dell’esercito che ti ha fatto pescare questa carta è scomparso (devono scomparire almeno 2 Soldati).', play: deathCard(20, 2, 'scompare') }
    ],
    F: [
      { title: 'Ti sei addentrato in un fiume/lago…', text: '…la tua Nave uccide un banco di pesci protetti: paga una multa di 2.000 soldi a ogni giocatore.',
        play: (G, A, p) => 'Pagati ' + DM.fmtN(fine(G, p, 2000)) + ' soldi di multa.' },
      { title: 'Ti sei addentrato in un fiume/lago…', text: '…il 10% delle Navi nella flotta che ti ha fatto pescare questa carta affonda (deve affondare almeno una Nave, a meno che nella flotta ci siano meno di 2 Navi) e annegano tutti i Soldati a bordo.',
        play: G => G.cardArmy ? (() => {
          const N = G.cardArmy.filter(u => u.t === 'N');
          const n = N.length < 2 ? 0 : howMany(N.length, 10, 1);
          let drowned = 0;
          N.slice().sort(() => DM.rand() - .5).slice(0, n).forEach(v => { G.units.filter(u => u.carried === v.id).forEach(u => { u.hp = 0; u.lost = true; drowned++; }); v.hp = 0; v.lost = true; });
          return n ? n + (n === 1 ? ' Nave affonda' : ' Navi affondano') + (drowned ? ', annegano ' + drowned + ' truppe a bordo' : '') + '.' : 'Nella flotta ci sono meno di 2 Navi: si salvano tutte.';
        })() : '' },
      { title: 'Ti sei addentrato in un fiume/lago…', text: '…il 10% dei Soldati dell’esercito che ti ha fatto pescare questa carta è caduto nel fiume ed è morto (deve morire almeno 1 Soldato).', play: deathCard(10, 1, 'muore') }
    ],
    A: [
      { title: 'Ti sei addentrato in Alta montagna…', text: '…sei così in alto che manca l’ossigeno: muore il 50% dei Soldati dell’esercito che ti ha fatto pescare questa carta (devono morire almeno 4 Soldati).', play: deathCard(50, 4, 'muore') },
      { title: 'Ti sei addentrato in Alta montagna…', text: '…oh no, una valanga! Il 90% dei Soldati dell’esercito che ti ha fatto pescare questa carta muore (devono morire almeno 6 Soldati).', play: deathCard(90, 6, 'muore') },
      { title: 'Ti sei addentrato in Alta montagna…', text: '…fa tanto freddo: il 60% dei Soldati dell’esercito che ti ha fatto pescare questa carta muore di ipotermia (devono morire almeno 5 Soldati).', play: deathCard(60, 5, 'muore') },
      { title: 'Ti sei addentrato in Alta montagna…', text: '…c’è stata una grande nevicata: il 50% dei Soldati dell’esercito che ti ha fatto pescare questa carta scompare (devono scomparire almeno 5 Soldati).', play: deathCard(50, 5, 'scompare') }
    ]
  };
  // costo di una cosa adesso (Classico, pioggia di meteoriti: Elicotteri, Navi e Carrarmati a metà)
  DM.costOf = (G, k) => DM.COST[k] && DM.eventOn(G, 'meteoriti') && 'ENT'.includes(k) && k.length === 1 ? DM.COST[k].map(o => ({ m: o.m / 2, r: o.r })) : DM.COST[k];
  DM.eventOn = (G, k) => !!(G.events || []).some(e => e.k === k && e.until > G.round);
  // pesca una carta dal mazzo e la gioca. A = l'esercito che l'ha fatta pescare (per le carte dei biomi)
  DM.drawCard = function (G, deck, A, p) {
    const list = DM.CARDS[deck], c = list[Math.min(list.length - 1, Math.floor(DM.rand() * list.length))];
    G.events = G.events || [];
    G.cardArmy = A || null;
    const result = c.play(G, A || [], p === undefined ? G.p : p);
    G.cardArmy = null;
    const dead = DM.cleanupDead(G);
    const card = { deck, title: c.title, text: c.text, result };
    (G.cardsShown = G.cardsShown || []).push(card);   // per la finestrella della carta (non si salva)
    return card;
  };
  // inizio giro: le carte dei giri
  DM.roundCards = function (G) {
    if (!DM.isClassic()) return '';
    G.events = (G.events || []).filter(e => e.until > G.round);
    let msg = '';
    if (G.round % 5 === 0) msg += ' 🃏 ' + DM.drawCard(G, 'giri5', null, -1).result;
    if (G.round % 10 === 0) msg += ' 🃏 ' + DM.drawCard(G, 'giri10', null, -1).result;
    return msg;
  };
  // dopo una mossa: i biomi in cui l'esercito è entrato (Montagna, Alta montagna, fiume/lago fuori dai ponti)
  DM.biomesEntered = function (G, A, x0, y0, pts) {
    if (A.every(u => DM.TROOPS[u.t].kind === 'air')) return [];
    const kindOf = (x, y) => { const b = DM.bAt(G, x, y); return b === 'F' && DM.bridgeAt(G, x, y) ? 'ponte' : b; };
    let prev = kindOf(x0, y0), px = 0, py = 0;
    const out = [];
    for (const [qx, qy] of pts) {
      const L = Math.hypot(qx - px, qy - py), n = Math.max(1, Math.ceil(L / .1));
      for (let i = 1; i <= n; i++) {
        const k = kindOf(x0 + px + (qx - px) * i / n, y0 + py + (qy - py) * i / n);
        if (k !== prev && 'MAF'.includes(k) && k.length === 1 && !out.includes(k)) out.push(k);
        prev = k;
      }
      px = qx; py = qy;
    }
    return out;
  };
  DM.biomeCards = function (G, A, entered) {
    let msg = '';
    entered.forEach(b => { if (G.units.some(u => A.includes(u))) msg += ' 🃏 ' + DM.drawCard(G, b, A.filter(u => G.units.includes(u))).result; });
    if (msg) A.forEach(u => { u.card = true; });   // dopo una carta la mossa non si annulla
    return msg;
  };

  // ---- il regolamento del Classico (si legge nel menu Regole solo dopo averlo sbloccato) ----
  DM.classicRulesHTML = function () {
    const n = DM.fmtN, T = C.TROOPS, K = C.KITS[0];
    const table = (head, rows) => '<div class="tw"><table><thead><tr>' + head.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
    let an = 0;
    const art = (text, title) => `<p class="art"><b>C.${++an}</b> ${title ? `<b>${title}.</b> ` : ''}${text}</p>`;
    const sp = v => String(v).replace('.', ',');
    return '<section class="rule" id="regC"><h3>🏛️ Modalità Damamondo Classico</h3>' +
      art('Damamondo com’era prima dei biomi speciali e delle miniere. Valgono le regole di Damamondo, con le differenze di questo capitolo.', 'Che cos’è') +
      art('Si gioca sulla mappa originale oppure su una mappa generata con soli cinque biomi: Pianura, Mare, Fiumi e laghi, Montagna e Alta montagna. Non ci sono vulcani.', 'Mappa') +
      art('Non esistono miniere, minerali, Banco, bacche, Coltivazioni, Aeroporti, strade, Carro, Nave Carro e Aereo Carro. Le pozioni sono solo Stipendio+, Velocità e Curacittà.', 'Cosa non c’è') +
      art(`Un solo kit, uguale per tutti: la Capitale, ${n(K.money)} soldi, ${K.S} Soldati, ${K.porto} Porti e ${K.ponte1} pezzi di ponte liv. 1.`, 'Kit') +
      art('I soldi si spostano all’istante tra le città del giocatore (Capitale, Città e Accampamenti), e si spende da qualsiasi città. La Capitale deve però tenere sempre <b>più della metà</b> dei soldi del giocatore. Se una città viene distrutta, i soldi che c’erano dentro vanno perduti.', 'Soldi') +
      art(`La Capitale rende ${n(C.INCOME.cap)} soldi e ogni Città ${n(C.INCOME.citta)} soldi, ogni 10 giri.`, 'Rendita') +
      art('Soldati, Elicotteri e Carrarmati nascono da Capitale, Città e Accampamenti, le Navi dai Porti.', 'Schieramento') +
      table(['Truppa', 'Gittata (cm)', 'Danno', 'Vita', 'Velocità (cm)', 'Costo'], 'SNET'.split('').map(k => {
        const t = T[k];
        return [t.name, t.range, n(t.dmg), n(t.hp), t.kind === 'land' ? t.land.P : t.kind === 'sea' ? t.sea : t.air, n(C.COST[k][0].m)];
      })) +
      art(`A terra la velocità si divide per 2 in Montagna e per 4 in Alta montagna. Fiumi e laghi si attraversano anche a guado, a velocità dimezzata (Soldato ${sp(T.S.land.F)} cm, Carrarmato ${sp(T.T.land.F)} cm); sui ponti si va a velocità piena.`, 'Biomi') +
      table(['Edificio o arma', 'Costo', 'Note'], [
        ['Città', n(C.COST.citta[0].m), 'vita ' + n(C.BUILDING_HP.citta)], ['Accampamento', n(C.COST.acc[0].m), 'serve a schierare truppe'], ['Porto', n(C.COST.porto[0].m), ''],
        ['Pezzo di ponte liv. 1', n(C.COST.ponte1[0].m), '1 cm'], ['Ponte liv. 2', n(C.COST.ponte2[0].m), 'migliora un pezzo di liv. 1 della riserva: sopra passano i Carrarmati, sotto le Navi'],
        ['Bomba', n(C.COST.bomba[0].m), 'danno ' + n(C.BOMB.bomba.dmg)], ['Superbomba', n(C.COST.superbomba[0].m), 'danno ' + n(C.BOMB.superbomba.dmg) + '; area radioattiva per ' + C.BOMB.superbomba.radTurns + ' giri, ' + C.BOMB.superbomba.radDmg + ' danni a turno a chi ci resta dentro'],
        ['Stipendio+', n(C.COST.poz_stipendio[0].m), ''], ['Velocità', n(C.COST.poz_velocita[0].m), ''], ['Curacittà', n(C.COST.poz_curacitta[0].m), '']]) +
      art('Se la Capitale viene distrutta, diventa Capitale la Città più ricca del giocatore.', 'Capitale distrutta') +
      '<h4>Le carte</h4>' +
      art('All’inizio di ogni 5° giro si pesca una carta dal mazzo «5 giri», e di ogni 10° giro dal mazzo «10 giri» (al 10°, 20°… si pescano tutte e due). Valgono per tutti.', 'Carte dei giri') +
      art('Ogni volta che una truppa o un esercito entra in Montagna, in Alta montagna o in un fiume/lago (non sui ponti) si pesca una carta del mazzo di quel bioma. Le truppe volanti non pescano. Dopo una carta la mossa non si può annullare.', 'Carte dei biomi') +
      art('Le carte tornano nel mazzo: ogni volta se ne pesca una a caso. Le percentuali si arrotondano per difetto, ma valgono i minimi scritti sulla carta (se le truppe sono meno del minimo, le subiscono tutte).', 'Mazzo') +
      table(['Mazzo', 'Carta'], [['5 giri', 'giri5'], ['10 giri', 'giri10'], ['Montagna', 'M'], ['Fiume/lago', 'F'], ['Alta montagna', 'A']]
        .flatMap(([name, k]) => DM.CARDS[k].map(c => [name, c.text.replace(/^…/, '')]))) +
      '</section>';
  };

  // ---- i soldi del Classico ----
  const cityLike = s => s.k === 'cap' || s.k === 'citta' || s.k === 'acc';
  DM.moneyOf = (G, p) => G.sites.filter(s => s.o === p && cityLike(s)).reduce((t, s) => t + s.inv.mon, 0);
  // inventari da cui si paga: prima l'edificio scelto, poi le altre città del giocatore (i soldi si teletrasportano)
  DM.payInvs = (G, site) => !DM.isClassic() ? [site.inv]
    : [site.inv].concat(G.sites.filter(s => s !== site && s.o === site.o && cityLike(s)).sort((a, b) => (a.k === 'cap') - (b.k === 'cap')).map(s => s.inv));
  // la Capitale deve avere più della metà dei soldi: se non ce l'ha, le città le mandano il necessario
  DM.balanceMoney = function (G, p) {
    if (!DM.isClassic()) return;
    const cap = DM.capitalOf(G, p);
    if (!cap) return;
    const others = G.sites.filter(s => s.o === p && s !== cap && cityLike(s)).sort((a, b) => b.inv.mon - a.inv.mon);
    let tot = DM.moneyOf(G, p);
    for (const s of others) {
      if (cap.inv.mon * 2 > tot || tot === 0) break;
      const need = Math.floor(tot / 2) + 1 - cap.inv.mon, t = Math.min(need, s.inv.mon);
      s.inv.mon -= t; cap.inv.mon += t;
    }
  };
  DM.balanceAll = G => { if (DM.isClassic()) G.players.forEach((q, p) => DM.balanceMoney(G, p)); };
  // sposta soldi tra la Capitale e un'altra città (in un senso o nell'altro), lasciando alla Capitale la maggioranza
  DM.moveMoney = function (G, site, amount, toSite) {
    if (!DM.isClassic()) return 'Solo nel Classico i soldi si spostano da soli.';
    const cap = DM.capitalOf(G, G.p);
    amount = Math.floor(+amount / 1000) * 1000;
    if (!site || site.o !== G.p || !cityLike(site) || site === cap) return 'Scegli una tua Città o un tuo Accampamento.';
    if (!cap) return 'Senza Capitale i soldi non si spostano.';
    if (!(amount > 0)) return 'Scrivi quanti soldi spostare (a multipli di 1.000).';
    const from = toSite ? cap : site, to = toSite ? site : cap;
    if (from.inv.mon < amount) return 'Lì ci sono solo ' + DM.fmtN(from.inv.mon) + ' soldi.';
    const tot = DM.moneyOf(G, G.p), capAfter = cap.inv.mon + (toSite ? -amount : amount);
    if (capAfter * 2 <= tot) return 'La Capitale deve tenere più della metà dei tuoi soldi: puoi spostare al massimo ' + DM.fmtN(Math.max(0, Math.floor((cap.inv.mon - Math.floor(tot / 2) - 1) / 1000) * 1000)) + ' soldi.';
    from.inv.mon -= amount; to.inv.mon += amount;
    return 'Spostati ' + DM.fmtN(amount) + ' soldi ' + (toSite ? 'dalla Capitale a ' + DM.nameOf(site.k) : 'alla Capitale') + '.';
  };
})(globalThis.DM = globalThis.DM || {});
