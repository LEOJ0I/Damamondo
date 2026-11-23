// Damamondo – spari, Bombe, Superbombe (3.1, 5, 8.5), bacche (13) e pozioni (14).
(function (DM) {
  'use strict';
  const T = DM.TROOPS;
  const isAir = u => T[u.t].kind === 'air';
  DM.canHit = (shooter, target) => DM.CAN_HIT_AIR.includes(shooter.t) || !isAir(target);

  // Bersagli "edificio" vicino al punto: edifici, miniere e ponti (filter sul proprietario)
  function structuresNear(G, x, y, r, ownerOk) {
    const out = [];
    G.sites.forEach(s => { if (ownerOk(s.o)) out.push({ s, br: false, d: Math.hypot(s.x - x, s.y - y) }); });
    G.bridges.forEach(b => { if (ownerOk(b.o)) out.push({ s: b, br: true, d: DM.segD(x, y, b) }); });
    return out.filter(z => z.d < r).sort((a, b) => (a.d - b.d) || ((a.s.par ? 1 : 0) - (b.s.par ? 1 : 0)));
  }

  // Danno a un edificio o ponte. Restituisce il testo del risultato.
  function hitStructure(G, z, dmg, bomb) {
    if (z.br) {
      const b = z.s;
      if (bomb && b.lv === 2) { b.lv = 1; b.hp = DM.BRIDGE_HP[1]; return ' Il ponte torna di livello 1.'; }
      b.hp -= dmg;
      if (b.hp <= 0) { G.bridges = G.bridges.filter(q => q !== b); return ' Ponte distrutto!'; }
      return ' Vita del ponte: ' + b.hp + '.';
    }
    const s = z.s;
    s.hp -= dmg;
    if (s.hp <= 0) return ' ' + DM.nameOf(s.k) + ' distrutto!' + DM.destroySite(G, s);
    return ' Vita rimasta: ' + s.hp + '.';
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

  // Sparo verso il punto (x, y): truppa nemica, oppure edificio/ponte nemico.
  // Un esercito conta 1 sparo ma fa sparare fino a 2 × limite truppe (5).
  DM.shoot = function (G, u, x, y) {
    const err = DM.shootError(G, u);
    if (err) return err;
    const A = DM.armyOf(G, u), lim = DM.shotLimit(G.round), maxShooters = A.length > 1 ? 2 * lim : 1;
    const tg = DM.unitNear(G, x, y, v => v.o !== G.p);
    if (tg) {
      const TG = DM.armyOf(G, tg);
      const able = A.map(v => ({ v, st: DM.stat(G, v) }))
        .filter(q => q.st[0] > 0 && Math.hypot(q.v.x - tg.x, q.v.y - tg.y) <= q.st[1] + 1e-9 && TG.some(t => DM.canHit(q.v, t)))
        .sort((a, b) => b.st[0] - a.st[0]).slice(0, maxShooters);
      if (!able.length) return 'Bersaglio fuori portata o non colpibile da queste truppe.';
      let hit = 0, dmg = 0;
      for (const q of able) {
        const order = [tg].concat(TG.filter(t => t !== tg));
        const t = order.find(t => t.hp > 0 && DM.canHit(q.v, t));
        if (!t) break;
        t.hp -= q.st[0]; dmg += q.st[0]; hit++;
      }
      A.forEach(v => { v.s = true; });
      G.shots++;
      const dead = DM.cleanupDead(G);
      return hit + (hit > 1 ? ' truppe hanno sparato: ' : ' truppa ha sparato: ') + DM.fmtN(dmg) + ' danni.' +
        (dead.length ? ' Distrutte: ' + dead.length + '.' : '') + (tg.hp > 0 ? ' Il bersaglio ha ' + tg.hp + ' di vita.' : '') + DM.vehicleNote(dead);
    }
    const z = structuresNear(G, x, y, G.tapR, o => o !== G.p)[0];
    if (!z) return 'Tocca un bersaglio nemico (truppa, edificio o ponte).';
    const able = A.map(v => ({ v, st: DM.stat(G, v) }))
      .filter(q => q.st[0] > 0 && (z.br ? DM.segD(q.v.x, q.v.y, z.s) : Math.hypot(q.v.x - z.s.x, q.v.y - z.s.y)) <= q.st[1] + 1e-9 && (!z.br || q.v.t === 'N'))
      .sort((a, b) => b.st[0] - a.st[0]).slice(0, maxShooters);
    if (!able.length) return z.br ? 'I ponti si colpiscono solo con Navi, Bombe e Superbombe (o il ponte è fuori portata).' : 'Edificio fuori portata.';
    const dmg = able.reduce((t, q) => t + q.st[0], 0);
    A.forEach(v => { v.s = true; });
    G.shots++;
    return able.length + (able.length > 1 ? ' truppe hanno sparato: ' : ' truppa ha sparato: ') + DM.fmtN(dmg) + ' danni a ' + (z.br ? 'un ponte' : DM.nameOf(z.s.k)) + '.' + hitStructure(G, z, dmg, false);
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

  DM.launchBomb = function (G, site, k, x, y) {
    const err = DM.bombError(G, site, k);
    if (err) return err;
    const B = DM.BOMB[k], sb = k === 'superbomba', R = DM.bombRange(site, k);
    // Bersaglio: prima truppe nemiche, poi edifici/ponti nemici, poi i propri edifici (per distruggerli prima della conquista)
    const u = DM.unitNear(G, x, y, v => v.o !== G.p);
    const z = u ? null : (structuresNear(G, x, y, G.tapR, o => o !== G.p)[0] || structuresNear(G, x, y, G.tapR, o => o === G.p)[0]);
    let tx, ty;
    if (u) { tx = u.x; ty = u.y; } else if (z) { tx = z.br ? z.s.x : z.s.x; ty = z.s.y; } else if (sb) { tx = x; ty = y; } else return 'Tocca un bersaglio (truppa, edificio o ponte).';
    if (Math.hypot(tx - site.x, ty - site.y) > R) return 'Fuori portata: massimo ' + R + ' cm da questo edificio.';
    site.inv.mat[k]--;
    G.shots += B.shots;
    let us, zs;
    if (sb) {
      us = G.units.filter(v => !v.carried && Math.hypot(v.x - tx, v.y - ty) <= B.radius);
      zs = structuresNear(G, tx, ty, B.radius + 1e-9, () => true);
    } else {
      us = u ? DM.armyOf(G, u) : [];   // danno ad area: tutto l'esercito
      zs = z ? [z] : [];
    }
    us.forEach(v => { v.hp -= B.dmg; });
    const dead = DM.cleanupDead(G);
    let r = DM.nameOf(k) + ': ' + DM.fmtN(B.dmg) + ' danni a ' + us.length + (us.length === 1 ? ' truppa' : ' truppe') +
      (dead.length ? ' (' + dead.length + (dead.length === 1 ? ' distrutta)' : ' distrutte)') : '') + ' e ' + zs.length + (zs.length === 1 ? ' edificio/ponte.' : ' edifici/ponti.');
    zs.forEach(q => { r += hitStructure(G, q, B.dmg, true); });
    if (sb) { G.rad.push({ x: tx, y: ty, r: B.radius, until: G.round + 3 }); r += ' Area radioattiva per 3 giri.'; }
    return r + DM.vehicleNote(dead);
  };

  // ---- Bacche ----
  DM.throwBerry = function (G, site, kind, x, y) {
    if (G.berried) return 'Puoi lanciare una sola bacca per turno.';
    if (!site || site.o !== G.p || !DM.BERRY_RANGE[site.k]) return 'Le bacche si lanciano da Capitale, Città o Accampamenti.';
    const key = 'bacca_' + kind;
    if (!(site.inv.mat[key] > 0)) return 'Qui non ci sono bacche ' + kind + '.';
    const u = DM.unitNear(G, x, y);
    if (!u) return 'Tocca una truppa (tua o nemica).';
    const R = DM.BERRY_RANGE[site.k];
    if (Math.hypot(u.x - site.x, u.y - site.y) > R) return 'Fuori portata: massimo ' + R + ' cm.';
    site.inv.mat[key]--;
    G.berried = true;
    const A = DM.armyOf(G, u);
    A.forEach(v => { v.bf = { k: DM.BERRIES[kind], until: G.round + 3 }; });
    return 'Bacca ' + kind + ' lanciata su ' + A.length + (A.length > 1 ? ' truppe' : ' truppa') + ' per 3 giri.';
  };

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
      c = c.filter(v => Math.hypot(v.x - site.x, v.y - site.y) <= .3 && DM.SPAWNS[site.k].includes(v.t) && v.hp < T[v.t].hp)
        .sort((a, b) => a.hp / T[a.t].hp - b.hp / T[b.t].hp);
      const u = c[0];
      if (!u) return { err: 'Nessuna tua truppa ferita qui dentro adatta a questo edificio.' };
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
