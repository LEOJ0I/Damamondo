// Damamondo – dettagli che si vedono ingrandendo: alberi, montagne, onde, minerali delle miniere, case.
// Sono solo decorazioni: non cambiano le regole. Scelte provvisorie, l'utente le corregge.
(function (DM) {
  'use strict';
  const { W, H } = DM;
  const R = 32;                     // pixel per cm dello strato dei dettagli
  const cache = { map: null, ver: -1, canvas: null };

  // numero "a caso" ma sempre uguale per lo stesso punto e la stessa mappa
  const rnd = (seed, x, y, k) => { const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 3.7 + k * 19.19) * 43758.5453; return n - Math.floor(n); };

  // ---- piccoli disegni (in cm) ----
  function tree(c, x, y, s, leaf, dark) {
    c.fillStyle = '#6b4a2b'; c.fillRect(x - .02 * s, y, .04 * s, .12 * s);
    c.fillStyle = dark; c.beginPath(); c.arc(x + .02 * s, y - .02 * s, .13 * s, 0, 7); c.fill();
    c.fillStyle = leaf; c.beginPath(); c.arc(x - .02 * s, y - .05 * s, .11 * s, 0, 7); c.fill();
  }
  function pine(c, x, y, s, col) {
    c.fillStyle = '#5b4026'; c.fillRect(x - .015 * s, y + .05 * s, .03 * s, .08 * s);
    c.fillStyle = col;
    for (let i = 0; i < 3; i++) {
      const yy = y - .12 * s + i * .07 * s, w = (.06 + i * .03) * s;
      c.beginPath(); c.moveTo(x, yy - .06 * s); c.lineTo(x + w, yy + .04 * s); c.lineTo(x - w, yy + .04 * s); c.closePath(); c.fill();
    }
  }
  function peak(c, x, y, s, rock, shade, snow) {
    c.fillStyle = rock; c.beginPath(); c.moveTo(x - .22 * s, y + .12 * s); c.lineTo(x, y - .18 * s); c.lineTo(x + .22 * s, y + .12 * s); c.closePath(); c.fill();
    c.fillStyle = shade; c.beginPath(); c.moveTo(x, y - .18 * s); c.lineTo(x + .22 * s, y + .12 * s); c.lineTo(x + .03 * s, y + .12 * s); c.closePath(); c.fill();
    if (snow) { c.fillStyle = snow; c.beginPath(); c.moveTo(x, y - .18 * s); c.lineTo(x + .08 * s, y - .07 * s); c.lineTo(x, y - .09 * s); c.lineTo(x - .08 * s, y - .07 * s); c.closePath(); c.fill(); }
  }
  function strokes(c, col, w, fn) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); fn(); c.stroke(); }

  // un elemento di decorazione per bioma nel punto (x, y); h = numero a caso 0..1
  function decorate(c, b, x, y, h, h2) {
    switch (b) {
      case 'G': tree(c, x, y, 1 + h2 * .4, '#3fa04f', '#23602f'); if (h > .5) tree(c, x + .18, y + .1, .8, '#4cae5a', '#2a6b35'); break;
      case 'P':
        if (h < .1) tree(c, x, y, .9 + h2 * .3, '#7fbf5a', '#4f8a3a');
        else if (h < .4) strokes(c, '#8fb04f', .025, () => { c.moveTo(x - .05, y); c.lineTo(x - .08, y - .08); c.moveTo(x, y); c.lineTo(x, y - .1); c.moveTo(x + .05, y); c.lineTo(x + .08, y - .08); });
        break;
      case 'L':
        if (h < .55) strokes(c, '#2f6f5a', .025, () => { for (let i = -1; i <= 1; i++) { c.moveTo(x + i * .05, y + .06); c.lineTo(x + i * .07, y - .12); } });
        if (h < .3) { c.fillStyle = '#7a5532'; [-1, 0, 1].forEach(i => { c.beginPath(); c.ellipse(x + i * .07, y - .12, .018, .045, 0, 0, 7); c.fill(); }); }
        else if (h < .45) { c.fillStyle = 'rgba(40,120,140,.45)'; c.beginPath(); c.ellipse(x, y, .14, .06, 0, 0, 7); c.fill(); }
        break;
      case 'T':
        if (h < .35) pine(c, x, y, .9 + h2 * .3, '#5c7d6a');
        else if (h < .6) { c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(x, y, .03, 0, 7); c.arc(x + .1, y + .05, .025, 0, 7); c.fill(); }
        break;
      case 'D':
        if (h < .06) { c.fillStyle = '#4d8c45'; c.fillRect(x - .025, y - .14, .05, .2); c.fillRect(x - .1, y - .07, .06, .03); c.fillRect(x - .1, y - .11, .03, .06); c.fillRect(x + .04, y - .09, .06, .03); c.fillRect(x + .07, y - .13, .03, .06); }
        else if (h < .45) strokes(c, '#c9ad62', .03, () => { c.moveTo(x - .2, y); c.quadraticCurveTo(x - .05, y - .1, x + .1, y); c.moveTo(x - .05, y + .1); c.quadraticCurveTo(x + .08, y + .02, x + .2, y + .1); });
        break;
      case 'M': if (h < .5) peak(c, x, y, .9 + h2 * .4, '#8c7a66', '#6e5e4d'); break;
      case 'A': if (h < .65) peak(c, x, y, 1 + h2 * .5, '#9a948f', '#77716c', '#ffffff'); break;
      case 'H': if (h < .3) strokes(c, '#b8cad6', .02, () => { c.moveTo(x - .15, y - .05); c.lineTo(x - .05, y + .03); c.lineTo(x + .03, y - .04); c.lineTo(x + .14, y + .05); }); break;
      case 'I': if (h < .35) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = .02; c.beginPath(); c.moveTo(x - .15, y - .05); c.lineTo(x + .02, y - .12); c.lineTo(x + .16, y); c.lineTo(x + .05, y + .1); c.lineTo(x - .12, y + .08); c.closePath(); c.stroke(); } break;
      case 'S': if (h < .1) strokes(c, 'rgba(255,255,255,.45)', .025, () => { c.moveTo(x - .14, y); c.quadraticCurveTo(x - .07, y - .06, x, y); c.quadraticCurveTo(x + .07, y + .06, x + .14, y); }); break;
      case 'F': if (h < .25) strokes(c, 'rgba(255,255,255,.6)', .02, () => { c.moveTo(x - .08, y); c.quadraticCurveTo(x, y - .04, x + .08, y); }); break;
      case 'V': if (h < .4) { c.fillStyle = h < .2 ? '#4b2a1e' : 'rgba(90,90,90,.55)'; c.beginPath(); c.arc(x, y, .06 + h2 * .05, 0, 7); c.fill(); } break;
      case 'Z': if (h < .6) { c.fillStyle = h < .3 ? '#ffd23f' : '#ff8a1f'; c.beginPath(); c.arc(x, y, .04 + h2 * .05, 0, 7); c.fill(); } break;
    }
  }

  // Strato dei dettagli del terreno, rifatto solo quando la mappa cambia (eruzioni)
  DM.detailLayer = function (map) {
    if (cache.map === map && cache.ver === map.version) return cache.canvas;
    const cv = cache.canvas || document.createElement('canvas');
    cv.width = W * R; cv.height = H * R;
    const c = cv.getContext('2d');
    c.setTransform(R, 0, 0, R, 0, 0);
    c.clearRect(0, 0, W, H);
    const seed = map.seed || 1;
    for (let gy = .25; gy < H; gy += .5) {
      for (let gx = .25; gx < W; gx += .5) {
        const x = gx + (rnd(seed, gx, gy, 1) - .5) * .4, y = gy + (rnd(seed, gx, gy, 2) - .5) * .4;
        const b = DM.mapAt(map, x, y);
        if (!b) continue;
        // niente decorazioni a cavallo di due biomi (alberi nell'acqua…)
        if ([[.2, 0], [-.2, 0], [0, .2], [0, -.2]].some(([dx, dy]) => DM.mapAt(map, x + dx, y + dy) !== b)) continue;
        decorate(c, b, x, y, rnd(seed, gx, gy, 3), rnd(seed, gx, gy, 4));
      }
    }
    Object.assign(cache, { map, ver: map.version, canvas: cv });
    return cv;
  };

  // ---- minerale che esce dalle miniere ----
  const ORE = { carbone: '#222', rame: '#c26a2e', piombo: '#5d6670', ferro: '#8a5a4a', oro: '#f2c230', argento: '#d9dde3',
    platino: '#c8d3e0', diamanti: '#8fe8ff', titanio: '#9aa7b3', uranio: '#7dff4a', petrolio: '#111', ossidiana: '#2b1d33' };
  function sparkle(c, x, y, s) {
    c.strokeStyle = '#fff'; c.lineWidth = s * .25; c.beginPath();
    c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s); c.stroke();
  }
  DM.drawOre = function (c, m, z) {
    const x = m.x, y = m.y, col = ORE[m.mt] || '#888';
    if (m.mt === 'petrolio') {
      // zampillo di petrolio che esce dal terreno
      c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.ellipse(x + .45 * z, y + .35 * z, .35 * z, .1 * z, 0, 0, 7); c.fill();
      c.strokeStyle = '#111'; c.lineWidth = .07 * z; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x + .45 * z, y + .3 * z); c.quadraticCurveTo(x + .5 * z, y - .5 * z, x + .75 * z, y - .2 * z); c.stroke();
      c.beginPath(); c.moveTo(x + .45 * z, y + .3 * z); c.quadraticCurveTo(x + .4 * z, y - .55 * z, x + .2 * z, y - .3 * z); c.stroke();
      c.fillStyle = '#111';
      [[.82, -.1], [.15, -.18], [.9, .05], [.62, -.45], [.3, -.5]].forEach(([dx, dy], i) => { c.beginPath(); c.arc(x + dx * z, y + dy * z, (.04 + (i % 2) * .02) * z, 0, 7); c.fill(); });
      return;
    }
    // mucchietto di minerale accanto alla miniera
    const pts = [[.5, .3], [.62, .18], [.38, .42], [.66, .4], [.52, .5]];
    pts.forEach(([dx, dy], i) => {
      const px = x + dx * z, py = y + dy * z, r = (.08 + (i % 3) * .02) * z;
      c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = .015 * z;
      c.beginPath();
      if (m.mt === 'diamanti' || m.mt === 'ossidiana') { c.moveTo(px, py - r * 1.3); c.lineTo(px + r, py); c.lineTo(px, py + r * 1.3); c.lineTo(px - r, py); c.closePath(); }
      else for (let k = 0; k < 6; k++) { const a = k * 1.047 + i; c.lineTo(px + Math.cos(a) * r * (k % 2 ? .8 : 1.1), py + Math.sin(a) * r * (k % 2 ? .8 : 1.1)); }
      c.fill(); c.stroke();
    });
    if (m.mt === 'uranio') { c.fillStyle = 'rgba(125,255,74,.25)'; c.beginPath(); c.arc(x + .52 * z, y + .38 * z, .3 * z, 0, 7); c.fill(); }
    if (['oro', 'argento', 'platino', 'diamanti'].includes(m.mt)) { sparkle(c, x + .7 * z, y + .08 * z, .07 * z); sparkle(c, x + .35 * z, y + .2 * z, .05 * z); }
  };

  // ---- dettagli degli edifici ----
  DM.drawBuildingDetail = function (c, s, z, col) {
    const house = (x, y, w) => {
      c.fillStyle = '#f4efe6'; c.fillRect(x - w, y - w * .4, 2 * w, w * 1.2);
      c.fillStyle = '#3b2a24'; c.beginPath(); c.moveTo(x - w * 1.2, y - w * .4); c.lineTo(x, y - w * 1.3); c.lineTo(x + w * 1.2, y - w * .4); c.closePath(); c.fill();
    };
    if (s.k === 'cap') {   // la Capitale: case attorno alla stella (la stella si disegna sopra)
      [[-.78, .42], [.78, .42], [-.72, -.5], [.72, -.5], [-.3, .85], [.3, .85]].forEach(([dx, dy], i) => house(s.x + dx * z, s.y + dy * z, (.16 + (i % 2) * .03) * z));
    } else if (s.k === 'citta') { house(s.x - .2 * z, s.y + .1 * z, .12 * z); house(s.x + .2 * z, s.y + .12 * z, .12 * z); house(s.x, s.y - .18 * z, .14 * z); }
    else if (s.k === 'acc') {
      c.fillStyle = '#e8d9b5'; c.strokeStyle = '#6b5333'; c.lineWidth = .02 * z;
      c.beginPath(); c.moveTo(s.x - .25 * z, s.y + .2 * z); c.lineTo(s.x, s.y - .22 * z); c.lineTo(s.x + .25 * z, s.y + .2 * z); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = col; c.beginPath(); c.moveTo(s.x, s.y + .2 * z); c.lineTo(s.x, s.y - .05 * z); c.stroke();
    }
  };

  // ---- disegni delle truppe, dentro il pallino (r = raggio del pallino, in cm) ----
  DM.drawTroopIcon = function (c, t, x, y, r) {
    c.save(); c.translate(x, y); c.scale(r, r);
    c.fillStyle = c.strokeStyle = '#fff'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = .1;
    const P = pts => { c.beginPath(); pts.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.closePath(); c.fill(); };
    switch (t) {
      case 'S':   // soldato con elmetto e fucile
        c.beginPath(); c.arc(0, -.38, .16, 0, 7); c.fill();
        c.beginPath(); c.arc(0, -.44, .22, Math.PI, 0); c.fill();
        P([[-.22, -.18], [.22, -.18], [.18, .3], [-.18, .3]]);
        c.beginPath(); c.moveTo(-.1, .3); c.lineTo(-.14, .62); c.moveTo(.1, .3); c.lineTo(.14, .62); c.stroke();
        c.beginPath(); c.moveTo(.3, -.5); c.lineTo(.3, .25); c.stroke();
        break;
      case 'N':   // nave da guerra
        P([[-.65, .05], [.65, .05], [.45, .38], [-.45, .38]]);
        c.fillRect(-.25, -.2, .4, .25); c.fillRect(-.05, -.45, .08, .25);
        c.beginPath(); c.moveTo(.15, -.08); c.lineTo(.5, -.2); c.stroke();
        break;
      case 'E':   // elicottero
        c.beginPath(); c.ellipse(-.1, .05, .3, .2, 0, 0, 7); c.fill();
        c.beginPath(); c.moveTo(.15, 0); c.lineTo(.62, -.05); c.stroke();
        c.beginPath(); c.moveTo(-.7, -.32); c.lineTo(.5, -.32); c.moveTo(-.1, -.32); c.lineTo(-.1, -.15); c.stroke();
        c.beginPath(); c.moveTo(-.35, .38); c.lineTo(.15, .38); c.stroke();
        break;
      case 'T':   // carrarmato
        c.beginPath(); c.roundRect ? c.roundRect(-.6, .08, 1.2, .32, .16) : c.rect(-.6, .08, 1.2, .32); c.fill();
        P([[-.42, .08], [.4, .08], [.3, -.15], [-.3, -.15]]);
        c.beginPath(); c.arc(-.05, -.2, .16, Math.PI, 0); c.fill();
        c.beginPath(); c.moveTo(.08, -.25); c.lineTo(.65, -.35); c.stroke();
        break;
      case 'C':   // carro con le ruote
        c.fillRect(-.55, -.3, 1.1, .45);
        c.beginPath(); c.arc(-.3, .3, .15, 0, 7); c.arc(.3, .3, .15, 0, 7); c.fill();
        break;
      case 'X':   // nave carro con le casse
        P([[-.7, .1], [.7, .1], [.5, .4], [-.5, .4]]);
        c.fillRect(-.45, -.18, .25, .25); c.fillRect(-.15, -.18, .25, .25); c.fillRect(.15, -.38, .25, .45);
        break;
      case 'A':   // aereo carro
        P([[0, -.7], [.1, -.25], [.7, .05], [.7, .18], [.1, .05], [.08, .45], [.3, .6], [.3, .68], [0, .6], [-.3, .68], [-.3, .6], [-.08, .45], [-.1, .05], [-.7, .18], [-.7, .05], [-.1, -.25]]);
        break;
    }
    c.restore();
  };
})(globalThis.DM = globalThis.DM || {});
