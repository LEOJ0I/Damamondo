// Damamondo – spari, Bombe, Superbombe (3.1, 5, 8.5), bacche (13) e pozioni (14).
(function (DM) {
  'use strict';
  const T = DM.TROOPS;
  // Decisione dell'utente: tutte le truppe possono colpire anche le truppe aeree.
  DM.canHit = () => true;

  const owner = (G, o) => o >= 0 && G.names[o] ? G.names[o] : 'nessuno';
  // l'edificio (non interno) in cui si trova la truppa, se c'è
  const siteOf = (G, u) => G.sites.filter(s => !s.par && Math.hypot(s.x - u.x, s.y - u.y) <= .3)
    .sort((a, b) => Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(b.x - u.x, b.y - u.y))[0];

  // Tutti i bersagli vicino al punto toccato, divisi in gruppi che si possono scegliere:
  // - truppe: un esercito, una truppa da sola, oppure le truppe dentro un edificio (valgono come un esercito)
  // - edifici e miniere, ponti.
  // unitOk / structOk: quali proprietari si possono colpire. Prima le truppe, poi edifici e ponti, dal più vicino.
  DM.targetsAt = function (G, x, y, unitOk, structOk) {
    const out = [], seen = new Set();
    G.units.filter(u => !u.carried && unitOk(u.o) && Math.hypot(u.x - x, u.y - y) < G.tapR)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).forEach(u => {
        const s = siteOf(G, u);
        let key, units, label;
        if (s) {
          key = 'in' + s.id + ':' + u.o;
          units = G.units.filter(v => !v.carried && v.o === u.o && Math.hypot(v.x - s.x, v.y - s.y) <= .3);
          units = [...new Set(units.flatMap(v => DM.armyOf(G, v)))];
          label = 'Truppe dentro ' + DM.nameOf(s.k) + ' di ' + owner(G, u.o) + ': ' + DM.composition(units);
        } else if (u.g) {
          key = 'g' + u.g; units = DM.armyOf(G, u);
          label = 'Esercito ' + u.an + ' di ' + owner(G, u.o) + ': ' + DM.composition(units);
        } else { key = 'u' + u.id; units = [u]; label = T[u.t].name + ' di ' + owner(G, u.o) + ' (vita ' + u.hp + ')'; }
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ type: 'units', units, lead: u, x: u.x, y: u.y, label });
      });
    const st = [];
    G.sites.forEach(s => { const d = Math.hypot(s.x - x, s.y - y); if (structOk(s.o) && d < G.tapR) st.push({ type: 'site', s, x: s.x, y: s.y, d, label: DM.nameOf(s.k) + (s.par ? ' (dentro la città)' : '') + ' di ' + owner(G, s.o) + ' (vita ' + s.hp + ')' }); });
    G.bridges.forEach(b => { const d = DM.segD(x, y, b); if (structOk(b.o) && d < G.tapR) st.push({ type: 'bridge', b, x: b.x, y: b.y, d, label: 'Ponte liv. ' + b.lv + ' di ' + owner(G, b.o) + ' (vita ' + b.hp + ')' }); });
    st.sort((a, b) => (a.d - b.d) || ((a.s && a.s.par ? 1 : 0) - (b.s && b.s.par ? 1 : 0)));
    return out.concat(st);
  };

  // Danno a un edificio o ponte. Restituisce il testo del risultato.
  function hitStructure(G, z, dmg, bomb) {
    if (z.type === 'bridge') {
      const b = z.b;
      if (bomb && b.lv === 2) { b.lv = 1; b.hp = DM.BRIDGE_HP[1]; return ' Il ponte torna di livello 1.'; }
      b.hp -= dmg;
      if (b.hp <= 0) { DM.removeBridge(G, b); return ' Ponte distrutto!'; }
      return ' Vita del ponte: ' + b.hp + '.';
    }
    const s = z.s;
    if (!G.sites.includes(s)) return '';
    s.hp -= dmg;
    if (s.hp <= 0) return ' ' + DM.nameOf(s.k) + ' distrutto!' + DM.destroySite(G, s);
    return ' ' + DM.nameOf(s.k) + ': vita rimasta ' + s.hp + '.';
  }

  // Si può sparare con questa truppa/esercito?
  DM.shootError = function (G, u) {
    if (!u || u.o !== G.p) return 'Seleziona prima una tua truppa o un tuo esercito.';
    if (G.shots >= DM.shotLimit(G.round)) return 'Limite di spari raggiunto per questo giro (' + DM.shotLimit(G.round) + ').';
    const A = DM.armyOf(G, u);
    if (u.carried) return 'Le truppe a bordo non possono sparare.';
    if (A.some(v => v.s)) return 'Ha già sparato in questo turno.';
    if (!A.some(v => T[v.t].dmg > 0)) return 'Nessuna truppa qui può sparare (il Carro non ha attacco).';
    return '';
  };

  // Le truppe sparano solo agli avversari (truppe, edifici, ponti), mai alle proprie cose.
  DM.shootTargets = (G, x, y) => DM.targetsAt(G, x, y, o => o !== G.p, o => o !== G.p);

  // Sparo a un bersaglio scelto. Un esercito conta 1 sparo ma fa sparare fino a 2 × limite truppe (5).
  DM.shootAt = function (G, u, tg) {
    const err = DM.shootError(G, u);
    if (err) return err;
    if (!tg) return 'Tocca un bersaglio avversario (truppa, edificio o ponte).';
    const A = DM.armyOf(G, u), lim = DM.shotLimit(G.round), maxShooters = A.length > 1 ? 2 * lim : 1;
    const inRange = (q, d) => d <= q.st[1] + 1e-9;
    if (tg.type === 'units') {
      const TG = tg.units, lead = tg.lead;
      const able = A.map(v => ({ v, st: DM.stat(G, v) }))
        .filter(q => q.st[0] > 0 && inRange(q, Math.hypot(q.v.x - lead.x, q.v.y - lead.y)) && TG.some(t => DM.canHit(q.v, t)))
        .sort((a, b) => b.st[0] - a.st[0]).slice(0, maxShooters);
      if (!able.length) return 'Bersaglio fuori portata o non colpibile da queste truppe.';
      // Chi subisce: ogni colpo va su una truppa a caso del gruppo (esercito o truppe dentro l'edificio), solo tra quelle ancora vive.
      let hit = 0, dmg = 0;
      const got = {};
      for (const q of able) {
        const live = TG.filter(t => t.hp > 0 && DM.canHit(q.v, t));
        if (!live.length) break;
        const t = live[Math.min(live.length - 1, Math.floor(DM.rand() * live.length))];
        t.hp -= q.st[0]; dmg += q.st[0]; hit++;
        got[T[t.t].name] = (got[T[t.t].name] || 0) + 1;
      }
      A.forEach(v => { v.s = true; });
      G.shots++;
      const dead = DM.cleanupDead(G);
      const spread = TG.length > 1 ? ' Colpi: ' + Object.entries(got).map(e => e[1] + ' su ' + e[0]).join(', ') + '.' : '';
      return hit + (hit > 1 ? ' truppe hanno sparato: ' : ' truppa ha sparato: ') + DM.fmtN(dmg) + ' danni.' + spread +
        (dead.length ? ' Distrutte: ' + dead.length + '.' : '') + (TG.length === 1 && lead.hp > 0 ? ' Il bersaglio ha ' + lead.hp + ' di vita.' : '') + DM.vehicleNote(dead);
    }
    const br = tg.type === 'bridge';
    const able = A.map(v => ({ v, st: DM.stat(G, v) }))
      .filter(q => q.st[0] > 0 && inRange(q, br ? DM.segD(q.v.x, q.v.y, tg.b) : Math.hypot(q.v.x - tg.x, q.v.y - tg.y)) && (!br || q.v.t === 'N'))
      .sort((a, b) => b.st[0] - a.st[0]).slice(0, maxShooters);
    if (!able.length) return br ? 'I ponti si colpiscono solo con Navi, Bombe e Superbombe (o il ponte è fuori portata).' : 'Edificio fuori portata.';
    const dmg = able.reduce((t, q) => t + q.st[0], 0);
    A.forEach(v => { v.s = true; });
    G.shots++;
    return able.length + (able.length > 1 ? ' truppe hanno sparato: ' : ' truppa ha sparato: ') + DM.fmtN(dmg) + ' danni a ' + (br ? 'un ponte' : DM.nameOf(tg.s.k)) + '.' + hitStructure(G, tg, dmg, false);
  };
  // Sparo verso un punto: se ci sono più bersagli, "pick" dice quale (0 = il primo: truppe prima degli edifici)
  DM.shoot = (G, u, x, y, pick) => {
    const err = DM.shootError(G, u);
    if (err) return err;
    return DM.shootAt(G, u, DM.shootTargets(G, x, y)[pick || 0]);
  };
  DM.vehicleNote = dead => dead.note || '';

  // ---- Bombe e Superbombe ----
  DM.bombError = function (G, site, k) {
    const B = DM.BOMB[k], lim = DM.shotLimit(G.round);
    if (!site || site.o !== G.p) return 'Seleziona un tuo edificio.';
    if (!B.from.includes(site.k)) return k === 'bomba' ? 'Le Bombe partono da Capitale, Città o Accampamenti.' : 'Le Superbombe partono da Capitale o Città.';
    if (!(site.inv.mat[k] > 0)) return 'Qui non ci sono ' + (k === 'bomba' ? 'Bombe.' : 'Superbombe.');
    // Correzione: la Bomba si può lanciare anche con limite < 3 (una sola, conta 3 spari)
    if (G.shots + B.shots <= lim) return '';
    if (k === 'bomba' && lim < B.shots && G.shots === 0) return '';
    return 'Limite di spari: ' + DM.nameOf(k) + ' vale ' + B.shots + ' spari (usati ' + G.shots + ' su ' + lim + ').';
  };
  DM.bombRange = (site, k) => site.k === 'acc' ? DM.BOMB[k].rangeAcc : DM.BOMB[k].range;

  // Bombe e bacche possono colpire qualsiasi cosa, anche le proprie: decide il giocatore.
  DM.anyTargets = (G, x, y) => DM.targetsAt(G, x, y, () => true, () => true);

  // tg: bersaglio scelto (da DM.anyTargets); per la Superbomba può mancare: allora cade nel punto (x, y)
  DM.launchBombAt = function (G, site, k, tg, x, y) {
    const err = DM.bombError(G, site, k);
    if (err) return err;
    const B = DM.BOMB[k], sb = k === 'superbomba', R = DM.bombRange(site, k);
    if (!tg && !sb) return 'Tocca un bersaglio (truppa, edificio o ponte).';
    const tx = tg ? tg.x : x, ty = tg ? tg.y : y;
    if (Math.hypot(tx - site.x, ty - site.y) > R) return 'Fuori portata: massimo ' + R + ' cm da questo edificio.';
    site.inv.mat[k]--;
    G.shots += B.shots;
    let us, zs;
    if (sb) {
      us = G.units.filter(v => !v.carried && Math.hypot(v.x - tx, v.y - ty) <= B.radius);
      zs = DM.targetsAt({ ...G, tapR: B.radius + 1e-9 }, tx, ty, () => false, () => true);
    } else if (tg.type === 'units') {
      us = tg.units; zs = [];   // danno ad area: tutto l'esercito (o tutte le truppe dentro l'edificio)
    } else if (tg.type === 'site') {
      // la Bomba su un edificio colpisce tutto quello che c'è dentro: truppe ed edifici interni
      us = G.units.filter(v => !v.carried && Math.hypot(v.x - tg.s.x, v.y - tg.s.y) <= .3);
      const main = tg.s.par ? DM.siteById(G, tg.s.par) || tg.s : tg.s;
      zs = [tg].concat(G.sites.filter(z => z !== tg.s && (z.par === main.id || z === main) && Math.hypot(z.x - tg.s.x, z.y - tg.s.y) <= .3)
        .map(z => ({ type: 'site', s: z, x: z.x, y: z.y })));
    } else { us = []; zs = [tg]; }
    us.forEach(v => { v.hp -= B.dmg; });
    const dead = DM.cleanupDead(G);
    let r = DM.nameOf(k) + ': ' + DM.fmtN(B.dmg) + ' danni a ' + us.length + (us.length === 1 ? ' truppa' : ' truppe') +
      (dead.length ? ' (' + dead.length + (dead.length === 1 ? ' distrutta)' : ' distrutte)') : '') + ' e ' + zs.length + (zs.length === 1 ? ' edificio/ponte.' : ' edifici/ponti.');
    // prima gli edifici interni, poi quello principale (che distrutto porta via gli interni)
    zs.sort((a, b) => (b.s && b.s.par ? 1 : 0) - (a.s && a.s.par ? 1 : 0)).forEach(q => { r += hitStructure(G, q, B.dmg, true); });
    if (sb) { G.rad.push({ x: tx, y: ty, r: B.radius, until: G.round + 3 }); r += ' Area radioattiva per 3 giri.'; }
    return r + DM.vehicleNote(dead);
  };
  DM.launchBomb = (G, site, k, x, y, pick) => DM.launchBombAt(G, site, k, DM.anyTargets(G, x, y)[pick || 0], x, y);

  // ---- Bacche: su qualsiasi truppa (tutto il gruppo scelto) ----
  DM.berryTargets = (G, x, y) => DM.targetsAt(G, x, y, () => true, () => false);
  DM.throwBerryAt = function (G, site, kind, tg) {
    if (G.berried) return 'Puoi lanciare una sola bacca per turno.';
    if (!site || site.o !== G.p || !DM.BERRY_RANGE[site.k]) return 'Le bacche si lanciano da Capitale, Città o Accampamenti.';
    const key = 'bacca_' + kind;
    if (!(site.inv.mat[key] > 0)) return 'Qui non ci sono bacche ' + kind + '.';
    if (!tg) return 'Tocca una truppa (tua o di un altro giocatore).';
    const R = DM.BERRY_RANGE[site.k];
    if (Math.hypot(tg.x - site.x, tg.y - site.y) > R) return 'Fuori portata: massimo ' + R + ' cm.';
    site.inv.mat[key]--;
    G.berried = true;
    tg.units.forEach(v => { v.bf = { k: DM.BERRIES[kind], until: G.round + 3 }; });
    return 'Bacca ' + kind + ' lanciata su ' + tg.units.length + (tg.units.length > 1 ? ' truppe' : ' truppa') + ' per 3 giri.';
  };
  DM.throwBerry = (G, site, kind, x, y, pick) => DM.throwBerryAt(G, site, kind, DM.berryTargets(G, x, y)[pick || 0]);

  // ---- Pozioni ----
  // Pozioni che agiscono sull'edificio selezionato. Restituisce {msg} oppure {need:'unit'} se serve toccare truppe.
  DM.usePotion = function (G, site, k) {
    const I = site.inv;
    if (!(I.mat[k] > 0)) return { msg: 'Qui non c’è questa pozione.' };
    if (k === 'poz_curacitta') {
      if (!DM.isCityLike(site)) return { msg: 'Si usa su Capitale, Città o Accampamento.' };
      const h = site.k === 'cap' ? 4000 : site.k === 'citta' ? 2000 : 1000;
      site.hp = Math.min(DM.maxHp(site), site.hp + h); I.mat[k]--;
      return { msg: 'Edificio curato: vita ' + site.hp + '.' };
    }
    if (k === 'poz_miglioracitta') {
      if (site.k !== 'citta') return { msg: 'Si usa solo su una Città.' };
      site.up = (site.up || 0) + 10000; site.mx = DM.maxHp(site) + 5000; site.hp += 5000; I.mat[k]--;
      return { msg: 'Città migliorata: +10.000 di rendita e +5.000 di vita.' };
    }
    if (k === 'poz_ignifuga') { site.ign = true; I.mat[k]--; return { msg: 'Edificio protetto dalle eruzioni.' }; }
    if (k === 'poz_concime') {
      if (site.k !== 'col') return { msg: 'Si usa su una Coltivazione.' };
      site.r0 -= 2; I.mat[k]--;
      return { msg: 'Coltivazione accelerata di 2 giri.' };
    }
    return { need: 'unit', left: k === 'poz_stipendio' ? 3 : 1 };
  };
  // Pozioni su truppe: Stipendio+ (fino a 3 truppe/eserciti, la pozione si consuma alla prima), Velocità, Curatruppe.
  DM.potionOnUnit = function (G, site, k, x, y, first) {
    const I = site.inv;
    if (first && !(I.mat[k] > 0)) return { err: 'Qui non c’è questa pozione.' };
    let c = G.units.filter(v => v.o === G.p && Math.hypot(v.x - x, v.y - y) < G.tapR);
    if (k === 'poz_curatruppe') {
      // la truppa si cura dovunque sia: si tocca lei (la più vicina al tocco tra le tue ferite)
      c = c.filter(v => v.hp < T[v.t].hp).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
      const u = c[0];
      if (!u) return { err: 'Tocca una tua truppa ferita.' };
      u.hp = Math.min(T[u.t].hp, u.hp + T[u.t].hp / 2); I.mat[k]--;
      return { msg: T[u.t].name + ' curato: vita ' + u.hp + '.', done: true };
    }
    const u = c.filter(v => !(k === 'poz_stipendio' && v.dd === G.round) && !(k === 'poz_velocita' && v.vp === G.round))
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (!u) return { err: 'Tocca una tua truppa (non ancora potenziata).' };
    const A = DM.armyOf(G, u);
    A.forEach(v => { if (k === 'poz_stipendio') v.dd = G.round; else v.vp = G.round; });
    if (first) I.mat[k]--;
    return { msg: (k === 'poz_stipendio' ? 'Danni doppi' : 'Velocità potenziata') + ' per questo turno (' + A.length + (A.length > 1 ? ' truppe' : ' truppa') + ').' };
  };
})(globalThis.DM = globalThis.DM || {});
