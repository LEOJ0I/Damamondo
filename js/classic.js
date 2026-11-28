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
