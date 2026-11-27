// Damamondo – animazioni ed effetti: truppe che viaggiano, bombe in volo, esplosioni, cantieri, dado, scosse.
// Come funziona: prima di un'azione l'interfaccia fa una "foto" della partita (snap); dopo, react() confronta
// le due foto e sceglie animazioni e suoni. Le regole (gli altri file) non sanno niente di tutto questo.
// Le animazioni si disegnano su un canvas trasparente sopra la mappa (#fxc), grande quanto la parte visibile.
// Fasi: "prima" (es. la bomba vola: la mappa mostra ancora com'era, un tocco salta) → commit (la mappa si aggiorna)
// → "dopo" (esplosione, cantiere, numeri dei danni: non bloccano il gioco).
(function (DM) {
  'use strict';
  const P = DM.Prefs, $ = id => document.getElementById(id);
  const T = DM.TROOPS, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const easeOut = p => 1 - Math.pow(1 - p, 3);
  const lerp = (a, b, p) => a + (b - a) * p;
  const rnd = (a, b) => a + Math.random() * (b - a);

  const FX = DM.FX = {
    hidden: { u: new Set(), s: new Set() },   // truppe ed edifici che la mappa non disegna (li disegna l'animazione)
    busy: false,                               // fase "prima": i tocchi saltano l'animazione
    get on() { return !!P.get('anim'); },
    log: []                                    // ultime animazioni (per le prove)
  };

  // ---------- il motore ----------
  let cv = null, cx = null, anims = [], raf = 0, run = null, shakeA = 0, shake0 = 0, shakeDur = 1;
  const now = () => performance.now();
  function overlay() {
    if (!cv) cv = $('fxc');
    return cv;
  }
  // trasformazione: centimetri della mappa → pixel del canvas delle animazioni
  function frame() {
    const c = overlay(), map = $('c');
    if (!c || !map) return null;
    const r = c.getBoundingClientRect(), m = map.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    cx = c.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, w, h);
    const Z = DM.ui.Z;
    return { Z, d, ox: m.left - r.left, oy: m.top - r.top, w: r.width, h: r.height, world: () => cx.setTransform(d * Z, 0, 0, d * Z, d * (m.left - r.left), d * (m.top - r.top)), screen: () => cx.setTransform(d, 0, 0, d, 0, 0) };
  }
  function loop() {
    raf = 0;
    const t = now(), F = frame();
    // scossa dello schermo
    const box = $('vpw');
    if (box) {
      const p = (t - shake0) / shakeDur;
      if (p < 1 && shakeA > 0) {
        const a = shakeA * (1 - p) * (1 - p);
        box.style.transform = `translate(${rnd(-a, a).toFixed(1)}px, ${rnd(-a, a).toFixed(1)}px)`;
      } else if (box.style.transform) { box.style.transform = ''; shakeA = 0; }
    }
    anims = anims.filter(a => {
      const p = a.dur > 0 ? (t - a.t0) / a.dur : 1;
      if (p >= 1 || a.run.dead) { a.done(); return false; }
      if (p >= 0 && F && a.draw) { F.world(); cx.save(); try { a.draw(cx, Math.max(0, p), F); } catch (e) { if (!FX.err) { FX.err = e; console.warn('animazione:', e); } } cx.restore(); }
      return true;
    });
    if (anims.length || shakeA > 0) raf = requestAnimationFrame(loop);
    else if (F) cx.setTransform(1, 0, 0, 1, 0, 0);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

  // Un'esecuzione: le animazioni di una sola azione
  function newRun(commit) {
    const R = {
      dead: false, skipping: false, committed: false, hides: [],
      commit() {
        if (R.committed) return;
        R.committed = true; FX.busy = false;
        commit();
      },
      // animazione di "dur" secondi: draw(cx, p da 0 a 1, F) in centimetri della mappa
      anim(dur, draw, delay) {
        if (R.dead || R.skipping || !FX.on || document.hidden) return Promise.resolve();
        return new Promise(done => { anims.push({ t0: now() + (delay || 0) * 1000, dur: dur * 1000, draw, done, run: R }); kick(); });
      },
      wait: s => R.anim(s, null),
      sfx(name, o, delay) { if (!R.dead && !R.skipping) DM.Sfx.play(name, o, delay); },
      buzz(name) { if (!R.dead && !R.skipping) DM.Sfx.buzz(name); },
      shake(px, s) {
        if (R.dead || R.skipping || !FX.on) return;
        if (px >= shakeA * .6) { shakeA = px; shake0 = now(); shakeDur = s * 1000; kick(); }
      },
      hideU(ids) { if (!FX.on || R.skipping || R.dead) return; ids.forEach(id => { FX.hidden.u.add(id); R.hides.push(['u', id]); }); },
      hideS(ids) { if (!FX.on || R.skipping || R.dead) return; ids.forEach(id => { FX.hidden.s.add(id); R.hides.push(['s', id]); }); },
      unhide() {
        if (!R.hides.length) return;
        R.hides.forEach(([k, id]) => FX.hidden[k].delete(id)); R.hides = [];
        if (R.committed && DM.redraw) DM.redraw();
      }
    };
    return R;
  }
  // Ferma subito tutto (nuova azione, menu, animazioni spente)
  FX.finish = function () {
    if (run) { run.dead = true; if (!run.committed) run.commit(); run.unhide(); }
    anims.forEach(a => a.done()); anims = [];
    FX.hidden.u.clear(); FX.hidden.s.clear();
    shakeA = 0; const box = $('vpw'); if (box) box.style.transform = '';
    hideDice(); FX.busy = false;
    if (cx && cv) { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); }
  };
  // Un tocco durante la fase "prima": salta (senza suoni) fino alla fine
  FX.skip = function () {
    if (!run || run.dead) return;
    run.skipping = true;
    anims.filter(a => a.run === run).forEach(a => { a.run = { dead: true }; a.done(); });
    anims = anims.filter(a => !a.run.dead);
    hideDice();
    shakeA = 0;
  };
  // Esegue lo "script" di un'azione. commit: aggiorna la mappa e i pannelli.
  FX.play = async function (script, commit) {
    FX.finish();
    const R = run = newRun(commit);
    FX.busy = true;
    try { await script(R); } catch (e) { /* in caso di errore la partita si aggiorna lo stesso */ }
    R.commit();
    await Promise.resolve();
    R.unhide();
    if (run === R) run = null;
  };

  // ---------- disegni riutilizzabili ----------
  const minCm = (F, px) => px / F.Z;   // misura minima in cm per non sparire quando la mappa è piccola
  function puff(c, x, y, r, col, a) { c.globalAlpha = a; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.globalAlpha = 1; }
  function parts(n, f) { const a = []; for (let i = 0; i < n; i++) a.push(f(i)); return a; }
  function text(c, F, x, y, s, col, p) {
    F.screen();
    const sx = F.ox + x * F.Z, sy = F.oy + y * F.Z - 10 - 26 * easeOut(p);
    c.globalAlpha = p < .7 ? 1 : 1 - (p - .7) / .3;
    c.font = 'bold 15px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 3.5; c.strokeStyle = 'rgba(0,0,0,.7)'; c.strokeText(s, sx, sy); c.fillStyle = col; c.fillText(s, sx, sy);
    c.globalAlpha = 1; F.world();
  }
  function sparkle(R, x, y, col, n, size) {
    const ps = parts(n || 8, i => ({ a: i / (n || 8) * TAU + rnd(-.3, .3), v: rnd(.6, 1.1), s: rnd(.6, 1.2) }));
    return R.anim(.7, (c, p, F) => {
      const k = Math.max(size || .5, minCm(F, 14));
      ps.forEach(q => {
        const d = k * q.v * easeOut(p), sx = x + Math.cos(q.a) * d, sy = y + Math.sin(q.a) * d, r = k * .14 * q.s * (1 - p);
        c.globalAlpha = 1 - p; c.fillStyle = col; c.beginPath();
        for (let j = 0; j < 8; j++) { const rr = j % 2 ? r * .35 : r; c.lineTo(sx + Math.cos(j * Math.PI / 4) * rr, sy + Math.sin(j * Math.PI / 4) * rr); }
        c.fill();
      });
      c.globalAlpha = 1;
    });
  }
  // posizione lungo una spezzata (pts) alla frazione p
  function along(pts, p) {
    let tot = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
    if (!tot) return pts[pts.length - 1];
    let d = p * tot;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) { const q = seg[i] ? Math.min(1, d / seg[i]) : 1; return [lerp(pts[i][0], pts[i + 1][0], q), lerp(pts[i][1], pts[i + 1][1], q)]; }
      d -= seg[i];
    }
    return pts[pts.length - 1];
  }
  const pathLen = pts => pts.slice(1).reduce((t, q, i) => t + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);
  const detail = () => P.get('detail') !== false;

  // truppe in viaggio: items = [{u, pts}] (u: la truppa com'è dopo la mossa; pts: il percorso)
  function travel(R, G, items) {
    if (!items.length) return Promise.resolve();
    const len = Math.max(...items.map(i => pathLen(i.pts)));
    const dur = clamp(.35 + len * .07, .45, 1.2);
    R.hideU(items.flatMap(i => i.ids));
    const kinds = items.map(i => T[i.u.t].kind);
    R.sfx('move', { kind: kinds[0], t: items[0].u.t, dur });
    return R.anim(dur, (c, p, F) => {
      const q = ease(p);
      items.forEach(it => {
        const [x, y] = along(it.pts, q), k = T[it.u.t].kind, r = DM.unitRadius(it.u, F.Z);
        let lift = 0;
        if (k === 'air') { lift = Math.sin(p * Math.PI) * r * 1.2; puff(c, x, y + r * .2, r * .8, '#000', .18); }
        else if (k === 'land') lift = Math.abs(Math.sin(p * Math.PI * Math.max(2, Math.round(len * 1.5)))) * r * .25;
        else lift = Math.sin(p * Math.PI * 6) * r * .08;
        if (k === 'land' && p < .95) puff(c, x - (it.pts[it.pts.length - 1][0] - it.pts[0][0]) * .02, y + r * .5, r * .45 * (1 - p), '#c9b98f', .45);
        if (k === 'sea') { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = r * .15; c.beginPath(); c.arc(x, y, r * (1.15 + .15 * Math.sin(p * 20)), 0, TAU); c.stroke(); }
        DM.drawUnit(c, G, Object.assign(Object.create(it.u), { x, y: y - lift }), F.Z, detail(), {});
      });
    });
  }
  // nuova truppa: spunta con un anello
  function spawn(R, G, u) {
    R.hideU([u.id]);
    return R.anim(.45, (c, p, F) => {
      const r = DM.unitRadius(u, F.Z), s = p < .7 ? easeOut(p / .7) * 1.15 : lerp(1.15, 1, (p - .7) / .3);
      c.strokeStyle = DM.PLAYER_COLORS[u.o]; c.globalAlpha = 1 - p; c.lineWidth = r * .25;
      c.beginPath(); c.arc(u.x, u.y, r * (1 + p * 1.6), 0, TAU); c.stroke(); c.globalAlpha = 1;
      c.translate(u.x, u.y); c.scale(s, s); c.translate(-u.x, -u.y);
      DM.drawUnit(c, G, u, F.Z, detail(), {});
    });
  }
  // truppa eliminata: sbuffo di fumo
  function poof(R, x, y) {
    const ps = parts(7, i => ({ a: i / 7 * TAU, v: rnd(.4, 1) }));
    return R.anim(.65, (c, p, F) => {
      const k = Math.max(.5, minCm(F, 12));
      ps.forEach(q => puff(c, x + Math.cos(q.a) * k * q.v * easeOut(p), y + Math.sin(q.a) * k * q.v * easeOut(p) - p * k * .4, k * .35 * (1 - p * .4), '#9aa0a6', .75 * (1 - p)));
    });
  }
  // cantiere: polvere, impalcatura, l'edificio sale e prende forma, luccichio finale (circa 1 secondo)
  function construct(R, G, s, dur) {
    dur = dur || 1;
    R.hideS([s.id]);
    const dust = parts(10, i => ({ a: i / 10 * TAU + rnd(-.2, .2), v: rnd(.8, 1.3) }));
    const sparks = parts(4, i => ({ t: .2 + i * .17, a: rnd(0, TAU) }));
    R.sfx('build', { dur });
    return R.anim(dur, (c, p, F) => {
      const z = DM.siteSize(s, F.Z) * 1.15, x = s.x, y = s.y;
      // polvere attorno
      dust.forEach(q => { const pp = clamp(p / .5, 0, 1); puff(c, x + Math.cos(q.a) * z * (1 + q.v * pp), y + Math.sin(q.a) * z * (.7 + q.v * pp * .6), z * .35 * (1 - pp * .5), '#d8c9a3', .7 * (1 - pp)); });
      // l'edificio sale da terra (si scopre dal basso verso l'alto e si allunga)
      const g = clamp((p - .15) / .65, 0, 1);
      if (g > 0) {
        c.save();
        c.beginPath(); c.rect(x - z * 1.6, y + z * 1.2 - g * z * 2.8, z * 3.2, g * z * 2.8 + z * .2); c.clip();
        const sy = p > .8 ? lerp(1.12, 1, (p - .8) / .2) : lerp(.5, 1.12, g);
        c.translate(x, y + z); c.scale(p > .8 ? sy : 1, sy); c.translate(-x, -y - z);
        DM.drawSite(c, G, s, F.Z, detail());
        c.restore();
      }
      // impalcatura di legno
      const fa = p < .8 ? clamp(p / .15, 0, 1) : 1 - (p - .8) / .2;
      c.globalAlpha = fa; c.strokeStyle = '#8a5a2b'; c.lineWidth = Math.max(.05, minCm(F, 1.6)); c.lineCap = 'round';
      const h = z * 1.25;
      c.beginPath();
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { c.moveTo(x + a * h, y + b * h); c.lineTo(x + a * h, y + b * h - h * .5); });
      c.rect(x - h, y - h, 2 * h, 2 * h);
      c.moveTo(x - h, y); c.lineTo(x + h, y);
      c.moveTo(x - h, y - h); c.lineTo(x, y); c.lineTo(x - h, y + h); c.moveTo(x + h, y - h); c.lineTo(x, y); c.lineTo(x + h, y + h);
      c.stroke();
      c.fillStyle = '#5e3b17'; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { c.beginPath(); c.arc(x + a * h, y + b * h, c.lineWidth * 1.3, 0, TAU); c.fill(); });
      c.globalAlpha = 1;
      // scintille delle martellate
      sparks.forEach(q => { const d = (p - q.t) / .12; if (d > 0 && d < 1) for (let j = 0; j < 5; j++) { const a = q.a + j * 1.2; puff(c, x + Math.cos(q.a) * h * .8 + Math.cos(a) * z * .5 * d, y + Math.sin(q.a) * h * .8 + Math.sin(a) * z * .5 * d, z * .07, '#ffe08a', 1 - d); } });
      // lampo finale
      if (p > .82) { const q = (p - .82) / .18; c.strokeStyle = '#fff'; c.globalAlpha = 1 - q; c.lineWidth = z * .15; c.beginPath(); c.arc(x, y, z * (1 + q * 1.2), 0, TAU); c.stroke(); c.globalAlpha = 1; }
    });
  }
  // edificio distrutto: trema, si abbassa e sparisce nella polvere
  function crumble(R, G, s) {
    const deb = parts(12, () => ({ a: rnd(0, TAU), v: rnd(.5, 1.4), r: rnd(.5, 1) }));
    R.sfx('crumble');
    return R.anim(.9, (c, p, F) => {
      const z = DM.siteSize(s, F.Z), j = (1 - p) * z * .12;
      if (p < .6) { c.save(); c.globalAlpha = 1 - p / .6; c.translate(rnd(-j, j), p * z * .6); DM.drawSite(c, G, s, F.Z, detail()); c.restore(); }
      deb.forEach(q => puff(c, s.x + Math.cos(q.a) * z * 1.6 * q.v * easeOut(p), s.y + Math.sin(q.a) * z * q.v * easeOut(p), z * .12 * q.r, '#5b4a3a', 1 - p));
      for (let i = 0; i < 5; i++) puff(c, s.x + (i - 2) * z * .45, s.y + z * .3 - p * z * .8, z * (.45 + p * .5), '#a39e93', .55 * (1 - p));
    });
  }
  // esplosione: lampo, palla di fuoco, onda d'urto, schegge, fumo. big = Superbomba
  function explosion(R, x, y, big) {
    const deb = parts(big ? 26 : 14, () => ({ a: rnd(0, TAU), v: rnd(.5, 1.2), r: rnd(.5, 1) }));
    const smoke = parts(big ? 12 : 7, () => ({ a: rnd(0, TAU), v: rnd(.2, .9), r: rnd(.6, 1.1) }));
    const dur = big ? 2.3 : 1;
    return R.anim(dur, (c, p, F) => {
      const K = big ? Math.max(1.6, minCm(F, 80)) : Math.max(.9, minCm(F, 44));
      // lampo su tutto lo schermo (solo la Superbomba)
      if (big && p < .18) { F.screen(); c.fillStyle = '#fff'; c.globalAlpha = .75 * (1 - p / .18); c.fillRect(0, 0, F.w, F.h); c.globalAlpha = 1; F.world(); }
      // onda d'urto
      [0, big ? .12 : 99].forEach(d => { const q = (p - d) / (big ? .5 : .45); if (q > 0 && q < 1) { c.strokeStyle = big ? '#fff6c8' : '#ffe2a8'; c.globalAlpha = .9 * (1 - q); c.lineWidth = K * .1 * (1 - q); c.beginPath(); c.arc(x, y, K * (.3 + q * (big ? 2.2 : 1.5)), 0, TAU); c.stroke(); c.globalAlpha = 1; } });
      // palla di fuoco
      const f = clamp(p / (big ? .3 : .22), 0, 1), fr = K * (.3 + .7 * easeOut(f)) * (p < .45 ? 1 : 1 - (p - .45) * .9);
      const al = p < .4 ? 1 : Math.max(0, 1 - (p - .4) / .4);
      if (al > 0) {
        const g = c.createRadialGradient(x, y, 0, x, y, Math.max(.01, fr));
        g.addColorStop(0, 'rgba(255,255,235,' + al + ')'); g.addColorStop(.3, 'rgba(255,214,80,' + al + ')');
        g.addColorStop(.65, 'rgba(255,120,30,' + .95 * al + ')'); g.addColorStop(.9, 'rgba(190,50,20,' + .6 * al + ')'); g.addColorStop(1, 'rgba(120,30,10,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, Math.max(.01, fr), 0, TAU); c.fill();
      }
      // schegge
      deb.forEach(q => { const d = K * 1.3 * q.v * easeOut(clamp(p * 1.6, 0, 1)); puff(c, x + Math.cos(q.a) * d, y + Math.sin(q.a) * d, K * .05 * q.r, p < .3 ? '#ffb347' : '#3a2f2a', 1 - p); });
      // fumo che sale
      smoke.forEach(q => { const s = clamp((p - .15) / .85, 0, 1); if (s > 0) puff(c, x + Math.cos(q.a) * K * q.v * .8, y + Math.sin(q.a) * K * q.v * .5 - s * K * .7, K * .3 * q.r * (1 + s), '#6f6a64', .55 * (1 - s)); });
      // Superbomba: fungo
      if (big && p > .15) {
        const m = clamp((p - .15) / .6, 0, 1), fade = p > .7 ? 1 - (p - .7) / .3 : 1, top = y - K * 1.9 * easeOut(m);
        c.globalAlpha = .85 * fade;
        const sg = c.createLinearGradient(0, y, 0, top);
        sg.addColorStop(0, '#5d4b3f'); sg.addColorStop(1, '#b9774a');
        c.fillStyle = sg; c.beginPath(); c.moveTo(x - K * .22, y); c.quadraticCurveTo(x - K * .12, (y + top) / 2, x - K * .16, top); c.lineTo(x + K * .16, top); c.quadraticCurveTo(x + K * .12, (y + top) / 2, x + K * .22, y); c.fill();
        const cr = K * (.4 + .5 * easeOut(m));
        const cg = c.createRadialGradient(x, top, 0, x, top, cr);
        cg.addColorStop(0, '#ffd27a'); cg.addColorStop(.5, '#d0703a'); cg.addColorStop(1, '#5d4b3f');
        c.fillStyle = cg; c.beginPath(); c.ellipse(x, top, cr * 1.25, cr * .7, 0, 0, TAU); c.fill();
        c.globalAlpha = 1;
        // alone delle radiazioni
        c.strokeStyle = '#9be82a'; c.globalAlpha = .7 * fade; c.lineWidth = K * .06; c.setLineDash([K * .15, K * .1]);
        c.beginPath(); c.arc(x, y, .5 + Math.sin(p * 30) * .02, 0, TAU); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      }
    });
  }
  // bomba in volo: arco, ombra a terra che si avvicina. Bomba: palla nera con la miccia. Superbomba: razzo con la fiamma.
  function bombFlight(R, x0, y0, x1, y1, big) {
    const L = Math.hypot(x1 - x0, y1 - y0), dur = big ? clamp(.9 + L * .03, 1.1, 1.8) : clamp(.55 + L * .035, .65, 1.25);
    const trail = [];
    R.sfx(big ? 'superFly' : 'bombFly', { dur });
    return R.anim(dur, (c, p, F) => {
      const K = big ? Math.max(.55, minCm(F, 20)) : Math.max(.38, minCm(F, 14));
      const q = big ? p * p * (3 - 2 * p) : p;
      const gx = lerp(x0, x1, q), gy = lerp(y0, y1, q), hgt = Math.sin(q * Math.PI) * (Math.max(1.5, L * .35) + K * 2), sc = 1 + Math.sin(q * Math.PI) * .6;
      const bx = gx, by = gy - hgt;
      trail.push([bx, by]); if (trail.length > (big ? 22 : 12)) trail.shift();
      // ombra
      puff(c, gx, gy, K * .6 * (.5 + q * .5), '#000', .25);
      // scia
      trail.forEach((t, i) => puff(c, t[0], t[1] + K * .2, K * (big ? .32 : .18) * (i / trail.length), big ? '#f4f1ea' : '#a7a29a', .5 * i / trail.length));
      c.save(); c.translate(bx, by); c.scale(sc, sc);
      if (!big) {
        c.rotate(p * 8);
        c.fillStyle = '#20232a'; c.beginPath(); c.arc(0, 0, K * .42, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(-K * .13, -K * .13, K * .12, 0, TAU); c.fill();
        c.fillStyle = '#555'; c.fillRect(-K * .1, -K * .58, K * .2, K * .18);
        c.strokeStyle = '#c8a26a'; c.lineWidth = K * .07; c.beginPath(); c.moveTo(0, -K * .58); c.quadraticCurveTo(K * .15, -K * .8, K * .05, -K * .9); c.stroke();
        const fl = .7 + Math.random() * .6;
        puff(c, K * .05, -K * .92, K * .13 * fl, '#ffd54a', 1); puff(c, K * .05, -K * .92, K * .07 * fl, '#fff', 1);
      } else {
        // orientato lungo il volo
        const dq = .01, nq = Math.min(1, q + dq), ang = Math.atan2((lerp(y0, y1, nq) - Math.sin(nq * Math.PI) * (Math.max(1.5, L * .35) + K * 2)) - by, lerp(x0, x1, nq) - bx);
        c.rotate(ang);
        const fl = .8 + Math.random() * .5;
        c.fillStyle = '#ff9a2e'; c.beginPath(); c.moveTo(-K * .55, -K * .14); c.lineTo(-K * (.55 + .5 * fl), 0); c.lineTo(-K * .55, K * .14); c.fill();
        c.fillStyle = '#fff3b0'; c.beginPath(); c.moveTo(-K * .55, -K * .07); c.lineTo(-K * (.55 + .25 * fl), 0); c.lineTo(-K * .55, K * .07); c.fill();
        c.fillStyle = '#5a6570'; c.beginPath(); c.moveTo(-K * .5, -K * .18); c.lineTo(-K * .7, -K * .34); c.lineTo(-K * .3, -K * .18); c.moveTo(-K * .5, K * .18); c.lineTo(-K * .7, K * .34); c.lineTo(-K * .3, K * .18); c.fill();
        c.fillStyle = '#e8ecef'; c.beginPath(); c.ellipse(0, 0, K * .6, K * .19, 0, 0, TAU); c.fill();
        c.fillStyle = '#d62f2f'; c.beginPath(); c.moveTo(K * .38, -K * .16); c.quadraticCurveTo(K * .75, 0, K * .38, K * .16); c.fill();
        // simbolo delle radiazioni
        c.fillStyle = '#ffd400'; c.beginPath(); c.arc(-K * .05, 0, K * .13, 0, TAU); c.fill();
        c.fillStyle = '#222';
        for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-K * .05, 0); c.arc(-K * .05, 0, K * .11, i * 2.094 - .45, i * 2.094 + .45); c.fill(); }
        c.fillStyle = '#ffd400'; c.beginPath(); c.arc(-K * .05, 0, K * .03, 0, TAU); c.fill();
      }
      c.restore();
    });
  }
  // bacca in volo e schizzi del suo colore
  function berryFlight(R, x0, y0, x1, y1, col) {
    const L = Math.hypot(x1 - x0, y1 - y0), dur = clamp(.4 + L * .05, .45, .9);
    R.sfx('berryThrow', { dur });
    return R.anim(dur, (c, p, F) => {
      const K = Math.max(.25, minCm(F, 8)), x = lerp(x0, x1, p), y = lerp(y0, y1, p) - Math.sin(p * Math.PI) * Math.max(1, L * .3);
      puff(c, lerp(x0, x1, p), lerp(y0, y1, p), K * .5, '#000', .2);
      c.save(); c.translate(x, y); c.rotate(p * 10);
      c.fillStyle = col; c.beginPath(); c.arc(0, 0, K * .55, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(-K * .18, -K * .18, K * .15, 0, TAU); c.fill();
      c.fillStyle = '#2e7d32'; c.beginPath(); c.ellipse(K * .2, -K * .55, K * .25, K * .1, -.6, 0, TAU); c.fill();
      c.restore();
    });
  }
  function splat(R, x, y, col) {
    const drops = parts(12, () => ({ a: rnd(0, TAU), v: rnd(.5, 1.3), r: rnd(.4, 1) }));
    return R.anim(.8, (c, p, F) => {
      const K = Math.max(.6, minCm(F, 20));
      drops.forEach(q => puff(c, x + Math.cos(q.a) * K * q.v * easeOut(p), y + Math.sin(q.a) * K * q.v * easeOut(p) + p * p * K * .3, K * .1 * q.r * (1 - p * .5), col, 1 - p));
      puff(c, x, y, K * .45 * (1 - p * .3), col, .6 * (1 - p));
    });
  }
  // colpi: dal tiratore al bersaglio, diversi per tipo di truppa
  function shots(R, from, x1, y1) {
    let longest = 0;
    from.forEach(s => { longest = Math.max(longest, Math.hypot(x1 - s.x, y1 - s.y)); });
    const dur = clamp(.22 + longest * .05, .25, .55);
    from.forEach((s, i) => R.sfx('shot', { t: s.t, i }));
    return R.anim(dur + from.length * .07, (c, p, F) => {
      const K = Math.max(.15, minCm(F, 4)), tot = dur + from.length * .07;
      from.forEach((s, i) => {
        const q = clamp((p * tot - i * .07) / dur, 0, 1);
        if (q <= 0 || q >= 1) return;
        const x = lerp(s.x, x1, q), y = lerp(s.y, y1, q) - (s.t === 'N' ? Math.sin(q * Math.PI) * 1.2 : 0);
        if (q < .2) puff(c, s.x, s.y, K * 2.2 * (1 - q * 5), '#ffe08a', .9);   // vampata
        if (s.t === 'S' || s.t === 'E') {
          const bx = x - (x1 - s.x) * .06, by = y - (y1 - s.y) * .06;
          c.strokeStyle = '#ffe9a0'; c.lineWidth = K * .8; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx, by); c.lineTo(x, y); c.stroke();
        } else { puff(c, x, y, K * (s.t === 'T' ? 1.1 : 1.3), '#2b2b2b', 1); puff(c, x, y, K * .5, '#ff9a2e', .8); }
      });
    });
  }
  function impact(R, x, y) {
    const ps = parts(8, () => ({ a: rnd(0, TAU), v: rnd(.4, 1) }));
    R.sfx('impact');
    return R.anim(.45, (c, p, F) => {
      const K = Math.max(.45, minCm(F, 14));
      puff(c, x, y, K * .45 * (1 - p), '#ffcf6b', 1 - p);
      ps.forEach(q => puff(c, x + Math.cos(q.a) * K * q.v * p, y + Math.sin(q.a) * K * q.v * p, K * .07, '#fff2c2', 1 - p));
    });
  }
  // eruzione: la lava si allarga dal cratere, fontana di lava, colonna di cenere
  function eruption(R, G, volc, cells) {
    const w = DM.W * DM.MR, sz = 1 / DM.MR;
    const list = cells.map(i => { const x = (i % w + .5) * sz, y = (Math.floor(i / w) + .5) * sz; let d = Infinity; volc.forEach(v => { d = Math.min(d, Math.hypot(x - v[0], y - v[1])); }); return [x, y, d]; });
    const maxD = Math.max(.5, ...list.map(q => q[2]));
    const blobs = parts(40, () => ({ v: volc[Math.floor(Math.random() * volc.length)], a: rnd(-1.2, 1.2), sp: rnd(.6, 1.2), t: rnd(0, .55), r: rnd(.5, 1) }));
    R.sfx('erupt'); R.buzz('erupt'); R.shake(14, 2.2);
    return R.anim(2.2, (c, p, F) => {
      const K = Math.max(.6, minCm(F, 14)), r = maxD * easeOut(clamp((p - .25) / .7, 0, 1));
      // lava che avanza
      c.fillStyle = '#e8541c';
      list.forEach(([x, y, d]) => { if (d <= r) { c.globalAlpha = clamp((r - d) / .6, .3, 1); c.fillRect(x - sz / 2, y - sz / 2, sz * 1.05, sz * 1.05); } });
      c.globalAlpha = 1;
      // bagliore del cratere
      volc.forEach(v => { const g = c.createRadialGradient(v[0], v[1], 0, v[0], v[1], K * 2); g.addColorStop(0, 'rgba(255,220,120,' + (.9 * (1 - p * .5)) + ')'); g.addColorStop(1, 'rgba(255,80,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(v[0], v[1], K * 2, 0, TAU); c.fill(); });
      // colonna di cenere
      volc.forEach(v => { for (let i = 0; i < 6; i++) { const s = clamp(p * 1.3 - i * .1, 0, 1); if (s > 0) puff(c, v[0] + Math.sin(i * 2 + p * 3) * K * .4, v[1] - s * K * 3.2, K * (.5 + s * .9), '#4a4440', .6 * (1 - s)); } });
      // fontana di lava
      blobs.forEach(b => {
        const q = (p - b.t) / .45; if (q <= 0 || q >= 1) return;
        const x = b.v[0] + Math.sin(b.a) * K * 2.2 * q * b.sp, y = b.v[1] - (Math.cos(b.a) * K * 3.5 * b.sp * q - K * 3.8 * q * q);
        puff(c, x, y, K * .14 * b.r, q < .5 ? '#ffd166' : '#e8541c', 1 - q * .5);
      });
    });
  }
  // territorio preso: le celle nuove si accendono del colore del giocatore e poi si calmano
  function territory(R, cells, col) {
    if (!cells.length) return Promise.resolve();
    const s = 1 / DM.TR, pts = cells.map(i => DM.cellCenter(i));
    return R.anim(.9, (c, p) => {
      c.fillStyle = col; c.globalAlpha = (p < .25 ? p / .25 : 1 - (p - .25) / .75) * .4;   // si accende in fretta e si spegne piano
      pts.forEach(([x, y]) => c.fillRect(x - s / 2, y - s / 2, s, s));
      c.globalAlpha = 1;
    });
  }
  // cartello "Turno di …"
  function banner(name, col, round) {
    if (!FX.on) return;
    const b = $('banner');
    if (!b) return;
    b.innerHTML = `<span style="color:${col}">Turno di ${name}</span><small>Giro ${round}</small>`;
    b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
  }

  // ---------- il dado ----------
  const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
  function face(n) { return '<i class="pips">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<b${PIPS[n].includes(k) ? ' class="on"' : ''}></b>`).join('') + '</i>'; }
  function hideDice() { const d = $('dice'); if (d) { d.hidden = true; d.className = ''; } }
  // il dado rotola e si ferma su n
  FX.rollDice = function (R, n) {
    const d = $('dice');
    R.sfx('diceRoll', { dur: 1 });
    if (!FX.on || !d || R.skipping) { R.sfx('diceStop', { n }, .05); return Promise.resolve(); }
    d.hidden = false; d.className = 'rolling'; d.innerHTML = face(1 + Math.floor(Math.random() * 6));
    let last = 0, gap = 50;
    return R.anim(1.05, (c, p) => {
      const t = p * 1050;
      if (t - last > gap && p < .93) { last = t; gap *= 1.15; d.innerHTML = face(1 + Math.floor(Math.random() * 6)); }
    }).then(() => {
      if (R.dead || R.skipping) { hideDice(); return; }
      d.className = 'landed'; d.innerHTML = face(n);
      R.sfx('diceStop', { n });
      return R.wait(.75).then(() => { d.className = 'out'; return R.wait(.25); }).then(hideDice);
    });
  };

  // ---------- la "foto" della partita e il confronto ----------
  FX.snap = function (G, kind) {
    return {
      units: new Map(G.units.map(u => [u.id, { ref: u, x: u.x, y: u.y, hp: u.hp, carried: u.carried, g: u.g, o: u.o, s: u.s }])),
      sites: new Map(G.sites.map(s => [s.id, { ref: s, k: s.k, hp: s.hp, o: s.o, mon: s.inv.mon, mat: Object.assign({}, s.inv.mat) }])),
      bridges: new Set(G.bridges), roads: new Set(G.roads), rad: G.rad.length,
      terr: G.terr.slice(), p: G.p, round: G.round, erupt: G.map.erupt.length,
      cells: kind === 'turn' ? G.map.cells.slice() : null,
      noCap: G.players.map(q => !!q.noCap),
      sig: JSON.stringify([G.units, G.sites, G.roads, G.bridges, G.rad, G.moved, G.shots, G.berried, G.p, G.round, G.players, G.phase, G.np])
    };
  };
  const berryCount = mat => Object.keys(mat).filter(k => k.startsWith('bacca_')).reduce((t, k) => t + (mat[k] || 0), 0);

  // Cosa è cambiato: elenco di "fatti" da animare
  function changes(G, a) {
    const out = { moved: [], born: [], dead: [], hurt: [], healed: [], built: [], gone: [], upgraded: [], newCap: [], lostCap: [], money: [], berries: [], ores: [], bridges: [], roads: [], terr: [], boarded: 0, cargo: 0 };
    const now = new Map(G.units.map(u => [u.id, u]));
    a.units.forEach((b, id) => {
      const u = now.get(id);
      if (!u) { if (!b.carried) out.dead.push(b); return; }
      if (!!u.carried !== !!b.carried) out.boarded++;
      if (!u.carried && !b.carried && Math.hypot(u.x - b.x, u.y - b.y) > .02) out.moved.push({ u, from: [b.x, b.y] });
      if (b.carried && !u.carried) out.born.push(u);
      if (u.hp < b.hp) out.hurt.push({ u, d: b.hp - u.hp });
      if (u.hp > b.hp) out.healed.push({ u, d: u.hp - b.hp });
    });
    G.units.forEach(u => { if (!a.units.has(u.id) && !u.carried) out.born.push(u); });
    const sNow = new Map(G.sites.map(s => [s.id, s]));
    a.sites.forEach((b, id) => {
      const s = sNow.get(id);
      if (!s) { out.gone.push(b.ref); if (b.k === 'cap') out.lostCap.push(b.o); return; }
      if (s.k !== b.k) (s.k === 'cap' ? out.newCap : out.upgraded).push(s);
      if (s.hp < b.hp) out.hurt.push({ s, d: b.hp - s.hp });
      if (s.inv.mon !== b.mon) out.money.push({ s, d: s.inv.mon - b.mon });
      if (s.k === 'col' && berryCount(s.inv.mat) > berryCount(b.mat)) out.berries.push(s);
      if (s.k === 'min' && (s.inv.mat[s.mt] || 0) > (b.mat[s.mt] || 0)) out.ores.push(s);
      if (JSON.stringify(s.inv.mat) !== JSON.stringify(b.mat)) out.cargo++;
    });
    G.sites.forEach(s => { if (!a.sites.has(s.id)) out.built.push(s); });
    G.bridges.forEach(b => { if (!a.bridges.has(b)) out.bridges.push(b); });
    G.roads.forEach(r => { if (!a.roads.has(r)) out.roads.push(r); });
    const terrBy = {};
    for (let i = 0; i < G.terr.length; i++) if (G.terr[i] !== a.terr[i] && G.terr[i] >= 0) (terrBy[G.terr[i]] = terrBy[G.terr[i]] || []).push(i);
    out.terr = Object.keys(terrBy).map(o => ({ o: +o, cells: terrBy[o] }));
    G.players.forEach((q, o) => { if (q.noCap && !a.noCap[o]) out.lostCap.push(o); });
    return out;
  }
  FX.changes = changes;

  // percorso di una truppa: il viaggio sulla strada (se c'era) o la linea dritta
  function pathOf(G, u, from) {
    const lp = G.lastPath;
    if (lp && lp.ids.includes(u.id) && lp.pts.length > 1) return [from].concat(lp.pts.slice(1, -1).map(q => [q[0] + lp.off[u.id][0], q[1] + lp.off[u.id][1]])).concat([[u.x, u.y]]);
    return [from, [u.x, u.y]];
  }

  // ---------- da azione a spettacolo ----------
  // kind: 'tap' (solo selezione), 'act' (azione generica), 'shoot', 'bomb', 'berry', 'mine', 'turn', 'undo'
  // x: dettagli dell'azione (chi spara, da dove parte la bomba, il dado…)
  FX.react = function (G, kind, a, x, commit, msg) {
    x = x || {};
    const changed = JSON.stringify([G.units, G.sites, G.roads, G.bridges, G.rad, G.moved, G.shots, G.berried, G.p, G.round, G.players, G.phase, G.np]) !== a.sig;
    const ch = changes(G, a);
    FX.log.push(kind); if (FX.log.length > 30) FX.log.shift();
    if (!changed && kind !== 'tap' && kind !== 'turn') { if (msg) DM.Sfx.play('error'); FX.finish(); commit(); return; }
    if (!changed) { FX.finish(); commit(); return; }
    FX.play(async R => {
      const pc = DM.PLAYER_COLORS;
      // ---- fase "prima": la mappa mostra ancora com'era ----
      if (kind === 'shoot' && x.from && x.from.length) {
        await shots(R, x.from, x.tx, x.ty);
      } else if (kind === 'bomb') {
        const big = x.k === 'superbomba';
        await bombFlight(R, x.sx, x.sy, x.tx, x.ty, big);
      } else if (kind === 'berry') {
        await berryFlight(R, x.sx, x.sy, x.tx, x.ty, x.col);
      } else if (kind === 'mine' && x.die) {
        await FX.rollDice(R, x.die);
      } else if (kind === 'turn' && a.cells && G.map.erupt.length > a.erupt) {
        const cellsNew = [], Z = DM.BIOMES.indexOf('Z'), V = DM.BIOMES.indexOf('V');
        for (let i = 0; i < G.map.cells.length; i++) if (G.map.cells[i] !== a.cells[i] && (G.map.cells[i] === Z || G.map.cells[i] === V)) cellsNew.push(i);
        const volc = G.map.erupt.slice(a.erupt).map(z => G.map.volc[z.v]).filter(Boolean);
        if (volc.length) {
          if (FX.on && DM.focusMap) DM.focusMap(volc[0][0], volc[0][1]);   // si guarda il vulcano mentre erutta
          await eruption(R, G, volc, cellsNew);
          if (FX.on && DM.focusMap) DM.focusMap();                       // poi la Capitale di chi gioca
        }
      } else if (ch.bridges.length || ch.roads.length) {
        // ponte o strada che si allunga
        const segs = ch.bridges.map(b => [b.x1, b.y1, b.x2, b.y2, b.lv === 2 ? '#444' : '#8a6b3b', .3]).concat(ch.roads.map(r => [r.x1, r.y1, r.x2, r.y2, '#5b4a3a', .24]));
        R.sfx(ch.bridges.length ? 'build' : 'road', { dur: .6 });
        await R.anim(.6, (c, p) => {
          segs.forEach(([x1, y1, x2, y2, col, w]) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(lerp(x1, x2, easeOut(p)), lerp(y1, y2, easeOut(p))); c.stroke(); });
        });
      }

      // ---- la mappa si aggiorna ----
      const moving = ch.moved.filter(m => !ch.born.includes(m.u));
      // le truppe che viaggiano e quelle nuove si nascondono prima di ridisegnare (le disegna l'animazione)
      const groups = new Map();
      moving.forEach(m => { const key = m.u.g ? 'g' + m.u.g : 'u' + m.u.id; if (!groups.has(key)) groups.set(key, { u: m.u, pts: pathOf(G, m.u, m.from), ids: [] }); groups.get(key).ids.push(m.u.id); });
      const items = [...groups.values()];
      R.hideU(items.flatMap(i => i.ids));
      R.hideU(ch.born.map(u => u.id));
      if (ch.built.length || ch.upgraded.length) R.hideS(ch.built.concat(ch.upgraded).filter(s => !s.par).map(s => s.id));
      R.commit();

      // ---- fase "dopo": non blocca ----
      const jobs = [];
      if (kind === 'turn') {
        banner(G.names[G.p], pc[G.p], G.round);
        R.sfx('turn');
      }
      if (kind === 'bomb') {
        const big = x.k === 'superbomba';
        R.sfx(big ? 'superBoom' : 'bombBoom'); R.buzz(big ? 'super' : 'bomb'); R.shake(big ? 18 : 9, big ? 1.1 : .5);
        jobs.push(explosion(R, x.tx, x.ty, big));
      }
      if (kind === 'berry') { R.sfx('berrySplat'); jobs.push(splat(R, x.tx, x.ty, x.col)); }
      if (kind === 'shoot' && x.from && x.from.length) { jobs.push(impact(R, x.tx, x.ty)); R.buzz('hit'); }
      if (items.length) jobs.push(travel(R, G, items));
      ch.born.forEach(u => { jobs.push(spawn(R, G, u)); });
      if (ch.born.length && !items.length) R.sfx(ch.boarded ? 'board' : 'deploy');
      else if (ch.boarded) R.sfx('board');
      ch.built.forEach(s => {
        if (s.par) { const p0 = DM.siteById(G, s.par); R.sfx('build', { dur: .8 }); if (p0) jobs.push(sparkle(R, p0.x, p0.y, '#fff3b0', 10, .9)); }
        else jobs.push(construct(R, G, s, s.k === 'min' ? .8 : 1));
      });
      ch.upgraded.forEach(s => { R.sfx('upgrade'); jobs.push(construct(R, G, s, .9)); });
      ch.newCap.forEach(s => { R.sfx('capNew'); jobs.push(sparkle(R, s.x, s.y, '#ffd54a', 14, 1.2)); });
      ch.gone.forEach(s => jobs.push(crumble(R, G, s)));
      if (ch.lostCap.length) { R.sfx('capLost', null, .3); R.buzz('capLost'); }
      if (ch.dead.length) { R.sfx('death', null, .1); ch.dead.forEach(b => jobs.push(poof(R, b.x, b.y))); }
      ch.hurt.forEach(h => { const q = h.u || h.s; jobs.push(R.anim(1.1, (c, p, F) => text(c, F, q.x, q.y, '−' + DM.fmtN(h.d), '#ff6b5b', p), .1)); });
      ch.healed.forEach(h => { jobs.push(R.anim(1.1, (c, p, F) => text(c, F, h.u.x, h.u.y, '+' + DM.fmtN(h.d), '#7be08a', p))); jobs.push(sparkle(R, h.u.x, h.u.y, '#b6ffb0', 8, .6)); });
      if (x.potion) { R.sfx('potion'); (x.at ? [x.at] : []).forEach(q => jobs.push(sparkle(R, q[0], q[1], '#d9a6ff', 10, .7))); }
      // soldi (vendite e acquisti): monete, e il numero sull'edificio
      const sold = ch.money.filter(m => m.d !== 0 && kind !== 'turn' && kind !== 'bomb' && kind !== 'shoot');
      if (sold.length) {
        R.sfx('coins', { n: sold.some(m => m.d > 0) ? 4 : 2 });
        sold.forEach(m => jobs.push(R.anim(1.1, (c, p, F) => text(c, F, m.s.x, m.s.y, (m.d > 0 ? '+' : '−') + DM.fmtN(Math.abs(m.d)), m.d > 0 ? '#ffd54a' : '#ffffff', p))));
      } else if (ch.cargo && !ch.built.length && !x.potion && kind === 'act' && !ch.born.length) R.sfx('cargo');
      // a inizio giro: rendite, miniere, bacche cresciute (di tutti)
      if (kind === 'turn') {
        const inc = ch.money.filter(m => m.d > 0);
        if (inc.length) { R.sfx('coins', { n: 4 }, .5); inc.forEach(m => jobs.push(R.anim(1.2, (c, p, F) => text(c, F, m.s.x, m.s.y, '+' + DM.fmtN(m.d), '#ffd54a', p), .5))); }
        if (ch.ores.length) { R.sfx('mine', null, .7); ch.ores.forEach(s => jobs.push(sparkle(R, s.x, s.y, '#e6edf3', 8, .7))); }
        if (ch.berries.length) { R.sfx('berryGrow', null, .9); ch.berries.forEach(s => jobs.push(sparkle(R, s.x, s.y, '#ff7aa8', 10, .8))); }
      }
      // territorio preso
      if (ch.terr.length && kind !== 'turn') {
        R.sfx('conquer', null, items.length ? .4 : 0);
        ch.terr.forEach(t => jobs.push(territory(R, t.cells, pc[t.o])));
      } else if (ch.terr.length) ch.terr.forEach(t => jobs.push(territory(R, t.cells, pc[t.o])));
      if (kind === 'army') R.sfx('army');
      if (kind === 'undo') R.sfx('move', { kind: 'land', t: 'S', dur: .4 });
      await Promise.all(jobs);
    }, commit);
  };

  // Animazioni spente dalle Impostazioni: si ferma tutto subito
  // (e anche il cartello del turno, se è ancora sullo schermo)
  FX.stopAll = function () { FX.finish(); const b = $('banner'); if (b) b.classList.remove('go'); };
  P.on(s => { if (!s.anim) FX.stopAll(); });
})(globalThis.DM = globalThis.DM || {});
