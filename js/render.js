// Damamondo – disegno della mappa sul canvas.
(function (DM) {
  'use strict';
  const { W, H, MR, TR } = DM;
  const MAX_PIXELS = 8e6;   // i telefoni non reggono canvas troppo grandi (iPhone ~16 milioni di pixel)
  const cache = { ver: -1, map: null, bio: null, plain: null };

  const rgb = hex => { const v = parseInt(hex.slice(1), 16); return [v >> 16, v >> 8 & 255, v & 255]; };

  // Immagini di sfondo (con biomi / solo terra e acqua), ricalcolate solo se la mappa cambia
  function baseImages(map) {
    if (cache.map === map && cache.ver === map.version) return cache;
    const w = W * MR, h = H * MR;
    const make = plain => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d'), im = g.createImageData(w, h);
      const pal = DM.BIOMES.split('').map(k => rgb(plain && !'SFI'.includes(k) ? '#d9d2b0' : DM.BIOME_COLOR[k]));
      // acqua più chiara vicino a riva e riva più scura: la costa si legge meglio
      const water = i => DM.WATER.includes(DM.BIOMES[map.cells[i]]);
      const S = DM.BIOMES.indexOf('S');
      for (let i = 0; i < map.cells.length; i++) {
        const q = pal[map.cells[i]], x = i % w;
        let f = 1, lift = 0;
        {
          const wt = water(i);
          let near = 0;
          for (let d = 1; d <= 3 && !near; d++) {
            for (const j of [i - d, i + d, i - d * w, i + d * w]) {
              const jx = j % w;
              if (j < 0 || j >= map.cells.length || Math.abs(jx - x) > 3) continue;
              if (water(j) !== wt) { near = d; break; }
            }
          }
          if (near && wt && map.cells[i] === S) lift = (4 - near) * 12;
          if (near === 1 && !wt) f = .82;
        }
        im.data[i * 4] = Math.min(255, q[0] * f + lift); im.data[i * 4 + 1] = Math.min(255, q[1] * f + lift);
        im.data[i * 4 + 2] = Math.min(255, q[2] * f + lift); im.data[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return c;
    };
    Object.assign(cache, { map, ver: map.version, bio: make(false), plain: make(true) });
    return cache;
  }

  function territoryImage(G) {
    const w = W * TR, h = H * TR, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d'), im = g.createImageData(w, h), cols = DM.PLAYER_COLORS.map(rgb);
    for (let i = 0; i < G.terr.length; i++) {
      const q = G.terr[i];
      if (q < 0) continue;
      im.data[i * 4] = cols[q][0]; im.data[i * 4 + 1] = cols[q][1]; im.data[i * 4 + 2] = cols[q][2]; im.data[i * 4 + 3] = 110;
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  // Ridimensiona il canvas per lo zoom Z (pixel per cm) e restituisce il contesto pronto in cm.
  DM.sizeCanvas = function (cv, Z) {
    const cssW = W * Z, cssH = H * Z;
    let d = Math.min(window.devicePixelRatio || 1, 2);
    d = Math.min(d, Math.sqrt(MAX_PIXELS / (cssW * cssH)));
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    cv.width = Math.round(cssW * d); cv.height = Math.round(cssH * d);
    const cx = cv.getContext('2d');
    cx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    return cx;
  };

  const star = (cx, x, y, r) => {
    cx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
      cx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    cx.closePath();
  };

  // ui: {sel, pick, mode, cede}, view: {sheets, biomes, terr, units}
  DM.draw = function (cv, G, ui, view, Z) {
    const cx = DM.sizeCanvas(cv, Z), pc = DM.PLAYER_COLORS, px = 1 / Z;   // px = un pixel in cm
    const imgs = baseImages(G.map);
    cx.imageSmoothingEnabled = true;
    cx.drawImage(view.biomes ? imgs.bio : imgs.plain, 0, 0, W, H);
    // dettagli del terreno quando si ingrandisce (compaiono piano piano da 10 a 18 pixel per cm)
    if (view.biomes && Z >= 10) {
      cx.globalAlpha = Math.min(1, (Z - 10) / 8);
      cx.drawImage(DM.detailLayer(G.map), 0, 0, W, H);
      cx.globalAlpha = 1;
    }
    if (view.terr) cx.drawImage(territoryImage(G), 0, 0, W, H);
    if (view.sheets) {
      cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = .08; cx.setLineDash([.4, .3]);
      cx.beginPath(); cx.moveTo(W / 2, 0); cx.lineTo(W / 2, H); cx.moveTo(0, H / 2); cx.lineTo(W, H / 2); cx.stroke();
      cx.setLineDash([]);
      cx.fillStyle = 'rgba(255,255,255,.9)'; cx.font = 'bold .9px sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'top';
      [[0, 0], [W / 2, 0], [0, H / 2], [W / 2, H / 2]].forEach((q, i) => cx.fillText('Foglio ' + (i + 1), q[0] + .4, q[1] + .4));
    }
    if (view.grid) {
      // quadretti da 1 cm, più marcati ogni 5 cm, con i numeri ai bordi
      for (let i = 1; i < Math.max(W, H); i++) {
        const strong = i % 5 === 0;
        cx.strokeStyle = strong ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.2)';
        cx.lineWidth = (strong ? 1.5 : 1) * px;
        cx.beginPath();
        if (i < W) { cx.moveTo(i, 0); cx.lineTo(i, H); }
        if (i < H) { cx.moveTo(0, i); cx.lineTo(W, i); }
        cx.stroke();
      }
      cx.fillStyle = 'rgba(0,0,0,.7)'; cx.font = 'bold ' + Math.max(.35, 10 * px) + 'px sans-serif';
      cx.textAlign = 'center'; cx.textBaseline = 'top';
      for (let i = 5; i < W; i += 5) cx.fillText(String(i), i, .1);
      cx.textAlign = 'left'; cx.textBaseline = 'middle';
      for (let i = 5; i < H; i += 5) cx.fillText(String(i), .1, i);
    }
    cx.textAlign = 'center'; cx.textBaseline = 'middle';

    // aree radioattive
    G.rad.forEach(z => { if (z.until > G.round) { cx.fillStyle = 'rgba(120,220,40,.45)'; cx.beginPath(); cx.arc(z.x, z.y, z.r, 0, 7); cx.fill(); } });
    // cessione in corso
    const cd = ui.cede;
    if (cd && cd.cells) { cx.fillStyle = 'rgba(214,36,159,.35)'; cd.cells.forEach(i => { const c = DM.cellCenter(i); cx.fillRect(c[0] - .125, c[1] - .125, .25, .25); }); }
    if (cd && cd.pts.length) {
      cx.strokeStyle = '#d6249f'; cx.lineWidth = Math.max(.12, 2 * px); cx.setLineDash([.3, .2]);
      cx.beginPath(); cd.pts.forEach((q, i) => i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1])); cx.stroke(); cx.setLineDash([]);
      cd.pts.forEach(q => { cx.fillStyle = '#d6249f'; cx.beginPath(); cx.arc(q[0], q[1], Math.max(.18, 4 * px), 0, 7); cx.fill(); });
    }
    // ponti e strade
    G.bridges.forEach(r => {
      cx.lineCap = 'butt'; cx.strokeStyle = r.lv === 2 ? '#444' : '#8a6b3b'; cx.lineWidth = r.lv === 2 ? .34 : .28;
      cx.beginPath(); cx.moveTo(r.x1, r.y1); cx.lineTo(r.x2, r.y2); cx.stroke();
      cx.setLineDash([.15, .1]); cx.strokeStyle = pc[r.o]; cx.lineWidth = .08; cx.stroke(); cx.setLineDash([]);
    });
    // moli dei Porti: dove le truppe scese dalle navi camminano fino a terra
    G.sites.forEach(s => {
      const d = s.k === 'porto' && DM.dockOf(G, s);
      if (!d) return;
      cx.lineCap = 'round'; cx.strokeStyle = '#7a5a33'; cx.lineWidth = .2;
      cx.beginPath(); cx.moveTo(s.x, s.y); cx.lineTo(d[0], d[1]); cx.stroke();
    });
    G.roads.forEach(r => {
      cx.lineCap = 'round'; cx.strokeStyle = '#5b4a3a'; cx.lineWidth = .24;
      cx.beginPath(); cx.moveTo(r.x1, r.y1); cx.lineTo(r.x2, r.y2); cx.stroke();
      cx.strokeStyle = pc[r.o]; cx.lineWidth = .1; cx.stroke();
    });
    // edifici (prima quelli normali, poi quelli dentro le città, sopra)
    const sz = Math.max(1, 6 * px);   // non scendere sotto qualche pixel
    const ICON = { porto: 1, aer: 1, col: 1 }, FILL = { porto: '#1e6fd9', aer: '#ffffff', col: '#6ab04c' }, INK = { porto: '#fff', aer: '#111', col: '#fff' };
    // simboli disegnati a mano (i caratteri ✈ ⚓ non ci sono su tutti i telefoni)
    const glyph = (k, x, y, z) => {
      cx.save(); cx.translate(x, y); cx.scale(z, z);
      cx.fillStyle = cx.strokeStyle = INK[k]; cx.lineWidth = .16; cx.lineCap = 'round';
      cx.beginPath();
      if (k === 'aer') {   // aereo visto dall'alto
        cx.moveTo(0, -.8); cx.lineTo(.12, -.3); cx.lineTo(.8, .05); cx.lineTo(.8, .2); cx.lineTo(.12, .05); cx.lineTo(.1, .5);
        cx.lineTo(.35, .7); cx.lineTo(.35, .8); cx.lineTo(0, .7); cx.lineTo(-.35, .8); cx.lineTo(-.35, .7); cx.lineTo(-.1, .5);
        cx.lineTo(-.12, .05); cx.lineTo(-.8, .2); cx.lineTo(-.8, .05); cx.lineTo(-.12, -.3); cx.closePath(); cx.fill();
      } else if (k === 'porto') {   // ancora
        cx.arc(0, -.55, .18, 0, 7); cx.moveTo(0, -.37); cx.lineTo(0, .65); cx.moveTo(-.35, -.15); cx.lineTo(.35, -.15);
        cx.moveTo(-.6, .2); cx.quadraticCurveTo(-.5, .7, 0, .65); cx.quadraticCurveTo(.5, .7, .6, .2); cx.stroke();
      } else {   // fiore
        for (let i = 0; i < 5; i++) { cx.moveTo(0, 0); cx.arc(Math.cos(i * 1.257) * .4, Math.sin(i * 1.257) * .4, .25, 0, 7); }
        cx.fill();
      }
      cx.restore();
    };
    const badge = (k, x, y, z, col) => {
      cx.fillStyle = FILL[k]; cx.strokeStyle = col; cx.lineWidth = Math.max(.08, 2 * px);
      cx.fillRect(x - z, y - z, 2 * z, 2 * z); cx.strokeRect(x - z, y - z, 2 * z, 2 * z);
      glyph(k, x, y, z * .8);
    };
    G.sites.filter(s => !s.par).concat(G.sites.filter(s => s.par)).forEach(s => {
      const col = pc[s.o];
      cx.lineWidth = .12;
      if (s.par) {
        // edificio dentro una città: sulla mappa si vede solo la città; il pannello dice cosa c'è dentro
      } else if (s.k === 'cap') {
        star(cx, s.x, s.y, .75 * sz); cx.fillStyle = col; cx.fill(); cx.strokeStyle = '#fff'; cx.stroke();
      } else if (s.k === 'min') {
        cx.beginPath();
        for (let i = 0; i < 6; i++) cx.lineTo(s.x + Math.cos(i * 1.047) * .4 * sz, s.y + Math.sin(i * 1.047) * .4 * sz);
        cx.closePath(); cx.fillStyle = col; cx.fill(); cx.strokeStyle = '#fff'; cx.lineWidth = .08; cx.stroke();
        cx.fillStyle = '#fff'; cx.font = 'bold ' + (.3 * sz) + 'px sans-serif'; cx.fillText(DM.SYMBOL[s.mt], s.x, s.y + .02);
        if (Z >= 12) DM.drawOre(cx, s, sz);
      } else if (ICON[s.k]) {
        badge(s.k, s.x, s.y, .38 * sz, col);
      } else {
        const z = (s.k === 'citta' ? .55 : .35) * sz;
        cx.fillStyle = col; cx.strokeStyle = '#fff';
        cx.fillRect(s.x - z, s.y - z, 2 * z, 2 * z); cx.strokeRect(s.x - z, s.y - z, 2 * z, 2 * z);
        if (Z >= 14) DM.drawBuildingDetail(cx, s, sz, col);
      }
      if (ui.selB === s) {
        cx.strokeStyle = '#ffd54a'; cx.lineWidth = Math.max(.12, 3 * px); cx.beginPath(); cx.arc(s.x, s.y, .9 * sz, 0, 7); cx.stroke();
      }
    });
    // raggio del selezionato (movimento o gittata)
    const sel = ui.sel;
    if (sel && G.units.includes(sel)) {
      const A = DM.armyOf(G, sel);
      const r = ui.mode === 'shoot' ? Math.max(...A.map(q => DM.stat(G, q)[1])) : sel.m ? 0 : Math.min(...A.map(q => DM.speedAt(G, q, q.x, q.y)));
      if (r > 0) { cx.setLineDash([.2, .2]); cx.strokeStyle = '#fff'; cx.lineWidth = Math.max(.07, 1.5 * px); cx.beginPath(); cx.arc(sel.x, sel.y, r, 0, 7); cx.stroke(); cx.setLineDash([]); }
    }
    if (ui.selB && (ui.mode === 'bomb' || ui.mode === 'berry')) {
      const R = ui.mode === 'bomb' ? DM.bombRange(ui.selB, ui.bombKind) : DM.BERRY_RANGE[ui.selB.k];
      cx.setLineDash([.4, .3]); cx.strokeStyle = '#ff4d4d'; cx.lineWidth = Math.max(.08, 2 * px); cx.beginPath(); cx.arc(ui.selB.x, ui.selB.y, R, 0, 7); cx.stroke(); cx.setLineDash([]);
    }
    // truppe: un solo pallino per esercito, col numero
    if (view.units) {
      const ur = Math.max(.42, 7 * px);
      const drawn = new Set();
      G.units.forEach(u => {
        if (u.carried) return;   // a bordo: non si vede, conta il numero sul veicolo
        if (u.g) { if (drawn.has(u.g)) return; drawn.add(u.g); }
        const moved = u.o === G.p && u.m, picked = (sel && (u === sel || (sel.g && u.g === sel.g))) || ui.pick.includes(u);
        cx.globalAlpha = moved ? .55 : 1;
        cx.fillStyle = pc[u.o];
        cx.strokeStyle = picked ? '#ffd54a' : u.g ? '#111' : '#fff';
        cx.lineWidth = picked ? ur * .4 : u.g ? ur * .35 : ur * .22;
        cx.beginPath(); cx.arc(u.x, u.y, u.g ? ur * 1.3 : ur, 0, 7); cx.fill(); cx.stroke();
        cx.fillStyle = '#fff'; cx.font = 'bold ' + ur + 'px sans-serif';
        cx.fillText(u.g ? String(u.an) : DM.TROOPS[u.t].label, u.x, u.y + .02);
        const on = G.units.filter(v => v.carried && DM.armyOf(G, u).some(w => w.id === v.carried)).length;
        if (on) {   // quante truppe a bordo
          const bx = u.x + ur * .95, by = u.y - ur * .95;
          cx.fillStyle = '#111'; cx.beginPath(); cx.arc(bx, by, ur * .55, 0, 7); cx.fill();
          cx.fillStyle = '#fff'; cx.font = 'bold ' + (ur * .7) + 'px sans-serif'; cx.fillText(String(on), bx, by + .01);
        }
        cx.globalAlpha = 1;
      });
    }
  };
})(globalThis.DM = globalThis.DM || {});
