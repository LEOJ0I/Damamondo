// Damamondo – effetti sonori, fatti dal browser come la musica (niente file). Morbidi, "da gioco da tavolo".
// DM.Sfx.play('nome', {opzioni}) suona subito; con gli effetti spenti o prima del primo tocco non fa niente.
// DM.Sfx.buzz('nome') fa vibrare il telefono (solo dove il browser lo permette: Android sì, iPhone/iPad no).
(function (DM) {
  'use strict';
  const P = DM.Prefs;
  let bus = null, busCtx = null, muted = 0;
  const L = () => DM.Music.lib;

  // uscita degli effetti: volume proprio + un po' di riverbero
  function output(c) {
    if (bus && busCtx === c) { bus.gain.setTargetAtTime(P.get('sfxVol') * 1.2, c.currentTime, .05); return bus; }
    busCtx = c;
    bus = c.createGain(); bus.gain.value = P.get('sfxVol') * 1.2;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4;
    const dry = c.createGain(), wet = c.createGain(), rv = L().reverb(c);
    dry.gain.value = .85; wet.gain.value = .18;
    bus.connect(dry); bus.connect(rv); rv.connect(wet); dry.connect(comp); wet.connect(comp); comp.connect(c.destination);
    return bus;
  }

  // ---------- mattoncini ----------
  function tone(c, out, t, { f0, f1, type = 'sine', vol = .2, a = .005, hold = 0, rel = .15, glide }) {
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + (glide || a + hold + rel));
    const g = c.createGain(); L().env(c, g, t, a, vol, hold, rel);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + a + hold + rel + .05);
    return o;
  }
  function hiss(c, out, t, { dur = .2, vol = .2, type = 'bandpass', f = 2000, f1, q = 1, a = .005 }) {
    const s = c.createBufferSource(); s.buffer = L().noise(c); s.loop = true;
    const fl = c.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); L().env(c, g, t, a, vol, 0, Math.max(.01, dur - a));
    s.connect(fl); fl.connect(g); g.connect(out); s.start(t, Math.random() * .8); s.stop(t + dur + .05);
  }
  const ting = (c, o, t, f, vol) => { tone(c, o, t, { f0: f, vol, rel: .5 }); tone(c, o, t, { f0: f * 2.76, vol: vol * .35, rel: .25 }); };
  const knock = (c, o, t, f, vol) => { tone(c, o, t, { f0: f, f1: f * .6, vol, rel: .09 }); hiss(c, o, t, { dur: .05, vol: vol * .6, f: 1800, q: .8 }); };
  const D = [62, 65, 69, 74, 77, 81];   // re minore, come la sigla
  const hz = m => L().hz(m);

  // ---------- gli effetti ----------
  const S = {
    click: (c, o, t) => tone(c, o, t, { f0: 1100, f1: 700, vol: .05, rel: .04 }),
    select: (c, o, t) => { tone(c, o, t, { f0: hz(74), type: 'triangle', vol: .09, rel: .12 }); tone(c, o, t + .06, { f0: hz(81), type: 'triangle', vol: .08, rel: .16 }); },
    error: (c, o, t) => { tone(c, o, t, { f0: 330, type: 'triangle', vol: .12, rel: .12 }); tone(c, o, t + .11, { f0: 247, type: 'triangle', vol: .12, rel: .2 }); },

    // movimento: passi, cingoli, onde o eliche, per la durata dell'animazione
    move: (c, o, t, { kind = 'land', t: tt = 'S', dur = .6 } = {}) => {
      if (kind === 'sea') { hiss(c, o, t, { dur: dur + .3, vol: .16, type: 'lowpass', f: 400, f1: 1400, a: .15 }); hiss(c, o, t + dur * .5, { dur: .5, vol: .08, f: 900, f1: 300 }); return; }
      if (kind === 'air') { hiss(c, o, t, { dur: dur + .2, vol: .12, f: 600, f1: 2400, q: 2, a: .1 }); if (tt === 'E') for (let i = 0; i < dur / .07; i++) knock(c, o, t + i * .07, 110, .05); return; }
      if (tt === 'T') { hiss(c, o, t, { dur: dur + .1, vol: .14, type: 'lowpass', f: 180, a: .05 }); for (let i = 0; i < dur / .09; i++) knock(c, o, t + i * .09, 70, .07); return; }
      if (tt === 'C') { for (let i = 0; i < dur / .12; i++) knock(c, o, t + i * .12, 140 + (i % 2) * 30, .06); return; }
      for (let i = 0; i < Math.max(2, dur / .16); i++) hiss(c, o, t + i * .16, { dur: .07, vol: .1, f: 700 + (i % 2) * 250, q: 1.4 });
    },
    deploy: (c, o, t) => { tone(c, o, t, { f0: 180, f1: 520, vol: .14, rel: .12 }); knock(c, o, t + .1, 260, .1); },
    army: (c, o, t) => { [0, .08, .16].forEach((d, i) => L().drum(c, o, t + d, 140 + i * 25, 70, .2, .18)); tone(c, o, t + .24, { f0: hz(74), type: 'triangle', vol: .08, rel: .3 }); },

    // costruzione: martellate e un "ding" quando è pronto
    build: (c, o, t, { dur = 1 } = {}) => {
      const n = 4;
      for (let i = 0; i < n; i++) knock(c, o, t + .1 + i * dur * .17, 420 - (i % 2) * 90, .16);
      hiss(c, o, t, { dur: .35, vol: .07, type: 'lowpass', f: 600 });
      ting(c, o, t + dur * .85, hz(81), .1); ting(c, o, t + dur * .85 + .09, hz(86), .08);
    },
    road: (c, o, t) => { for (let i = 0; i < 5; i++) hiss(c, o, t + i * .09, { dur: .08, vol: .09, f: 1200 + Math.random() * 800, q: .7 }); ting(c, o, t + .5, hz(81), .06); },
    crumble: (c, o, t) => { hiss(c, o, t, { dur: 1, vol: .22, type: 'lowpass', f: 1200, f1: 150 }); for (let i = 0; i < 6; i++) knock(c, o, t + Math.random() * .7, 90 + Math.random() * 120, .1); },
    death: (c, o, t) => { tone(c, o, t, { f0: 520, f1: 160, type: 'triangle', vol: .1, rel: .3 }); hiss(c, o, t, { dur: .25, vol: .06, f: 900, f1: 300 }); },
    upgrade: (c, o, t) => { D.slice(0, 4).forEach((m, i) => tone(c, o, t + i * .07, { f0: hz(m + 12), type: 'triangle', vol: .07, rel: .25 })); },

    // dado: rotola (tic sempre più lenti), si ferma, campanella più alta se il numero è alto
    diceRoll: (c, o, t, { dur = 1 } = {}) => {
      let x = 0, gap = .035;
      while (x < dur) { hiss(c, o, t + x, { dur: .03, vol: .14 * (1 - x / dur * .5), f: 2500 + Math.random() * 1500, q: 3 }); knock(c, o, t + x, 600 + Math.random() * 400, .04); x += gap; gap *= 1.12; }
    },
    diceStop: (c, o, t, { n = 3 } = {}) => { knock(c, o, t, 340, .22); ting(c, o, t + .12, hz(D[n - 1] + 12), .12); },

    // spari: cambia con la truppa
    shot: (c, o, t, { t: tt = 'S', i = 0 } = {}) => {
      t += i * .07;
      if (tt === 'T') { L().drum(c, o, t, 160, 45, .35, .35); hiss(c, o, t, { dur: .3, vol: .2, type: 'lowpass', f: 2200, f1: 300 }); return; }
      if (tt === 'N') { L().drum(c, o, t, 120, 35, .4, .5); hiss(c, o, t, { dur: .45, vol: .18, type: 'lowpass', f: 1500, f1: 200 }); return; }
      if (tt === 'E') { for (let k = 0; k < 5; k++) hiss(c, o, t + k * .05, { dur: .04, vol: .16, type: 'highpass', f: 1800 }); return; }
      hiss(c, o, t, { dur: .12, vol: .22, type: 'highpass', f: 1500, f1: 600 }); tone(c, o, t, { f0: 900, f1: 220, type: 'square', vol: .025, rel: .1 });
    },
    impact: (c, o, t) => { L().drum(c, o, t, 110, 50, .22, .25); hiss(c, o, t, { dur: .2, vol: .1, type: 'lowpass', f: 900 }); },

    // Bomba: fischio che scende; Superbomba: razzo che rimbomba + fischio più grave
    bombFly: (c, o, t, { dur = .9 } = {}) => { tone(c, o, t, { f0: 1900, f1: 650, vol: .06, a: .05, hold: dur - .1, rel: .08, glide: dur }); hiss(c, o, t, { dur: .2, vol: .08, f: 800 }); },
    superFly: (c, o, t, { dur = 1.3 } = {}) => {
      hiss(c, o, t, { dur: dur, vol: .2, type: 'lowpass', f: 250, f1: 700, a: .1 });
      tone(c, o, t, { f0: 55, f1: 80, type: 'sawtooth', vol: .05, a: .1, hold: dur - .2, rel: .1 });
      tone(c, o, t + dur * .35, { f0: 1100, f1: 300, vol: .06, a: .05, hold: dur * .55, rel: .1, glide: dur * .65 });
    },
    bombBoom: (c, o, t) => {
      L().drum(c, o, t, 130, 30, .7, 1.1);
      hiss(c, o, t, { dur: 1.1, vol: .4, type: 'lowpass', f: 3000, f1: 160 });
      for (let i = 0; i < 5; i++) hiss(c, o, t + .1 + Math.random() * .6, { dur: .05, vol: .06, f: 2500, q: 2 });
    },
    superBoom: (c, o, t) => {
      L().drum(c, o, t, 90, 22, .9, 2.4);
      hiss(c, o, t, { dur: 2.6, vol: .5, type: 'lowpass', f: 2600, f1: 90 });
      L().drum(c, o, t + .35, 60, 25, .5, 1.8);
      // radiazioni: ticchettio del contatore e un ronzio basso
      for (let i = 0; i < 14; i++) hiss(c, o, t + 1 + Math.random() * 1.6, { dur: .015, vol: .08, type: 'highpass', f: 4000 });
      tone(c, o, t + .8, { f0: 110, f1: 104, type: 'triangle', vol: .04, a: .4, hold: 1, rel: .8 });
    },

    // eruzione: brontolio dal basso, scoppio, crepitio della lava
    erupt: (c, o, t) => {
      hiss(c, o, t, { dur: 2.2, vol: .35, type: 'lowpass', f: 90, f1: 260, a: .6 });
      L().drum(c, o, t + .7, 75, 24, .8, 1.8);
      hiss(c, o, t + .7, { dur: 1.6, vol: .28, type: 'lowpass', f: 1800, f1: 140 });
      for (let i = 0; i < 26; i++) hiss(c, o, t + .8 + Math.random() * 1.8, { dur: .02, vol: .07, f: 1500 + Math.random() * 2500, q: 2 });
    },

    // bacche: lancio leggero, "splat", crescita (due bolle che salgono e un luccichio)
    berryThrow: (c, o, t, { dur = .6 } = {}) => hiss(c, o, t, { dur, vol: .08, f: 500, f1: 1600, q: 2, a: .05 }),
    berrySplat: (c, o, t) => { tone(c, o, t, { f0: 420, f1: 90, vol: .2, rel: .18 }); hiss(c, o, t, { dur: .25, vol: .2, type: 'lowpass', f: 1300, f1: 300 }); [0, .05, .1].forEach(d => tone(c, o, t + .06 + d, { f0: 700 + Math.random() * 500, f1: 300, vol: .04, rel: .06 })); },
    berryGrow: (c, o, t) => { tone(c, o, t, { f0: 300, f1: 600, vol: .1, rel: .15 }); tone(c, o, t + .13, { f0: 400, f1: 900, vol: .09, rel: .15 }); ting(c, o, t + .28, hz(93), .05); ting(c, o, t + .36, hz(98), .04); },

    // monete e piccone
    coins: (c, o, t, { n = 3 } = {}) => { for (let i = 0; i < n; i++) ting(c, o, t + i * .07, 2100 + Math.random() * 700, .06); },
    mine: (c, o, t) => { [0, .16].forEach(d => { ting(c, o, t + d, 1500 + Math.random() * 300, .09); knock(c, o, t + d, 300, .08); }); },

    // pozione: glu glu e un luccichio
    potion: (c, o, t) => { for (let i = 0; i < 5; i++) tone(c, o, t + i * .07, { f0: 260 + Math.random() * 160, f1: 700 + Math.random() * 300, vol: .07, rel: .06 }); [0, 1, 2].forEach(i => ting(c, o, t + .4 + i * .06, hz(D[3 + i] + 12), .05)); },
    cargo: (c, o, t) => { knock(c, o, t, 160, .16); ting(c, o, t + .08, 1300, .04); },
    board: (c, o, t) => { tone(c, o, t, { f0: 300, f1: 450, type: 'triangle', vol: .08, rel: .12 }); knock(c, o, t + .1, 200, .1); },
    conquer: (c, o, t) => { [62, 69, 74].forEach((m, i) => tone(c, o, t + i * .05, { f0: hz(m), type: 'triangle', vol: .05, a: .08, hold: .15, rel: .4 })); },

    // giro: piccola fanfara (re – fa – la – re)
    turn: (c, o, t) => {
      [[62, 0, .12], [65, .1, .12], [69, .2, .12], [74, .32, .45]].forEach(([m, d, l]) => { tone(c, o, t + d, { f0: hz(m), type: 'triangle', vol: .1, rel: l }); tone(c, o, t + d, { f0: hz(m + 12), vol: .03, rel: l }); });
      L().drum(c, o, t + .32, 110, 55, .18, .3);
    },
    capLost: (c, o, t) => { [69, 67, 65, 62].forEach((m, i) => tone(c, o, t + i * .22, { f0: hz(m), type: 'triangle', vol: .11, a: .02, hold: .1, rel: .35 })); L().drum(c, o, t + .66, 70, 35, .3, 1); },
    capNew: (c, o, t) => { [62, 66, 69, 74].forEach((m, i) => tone(c, o, t + i * .11, { f0: hz(m), type: 'triangle', vol: .11, rel: i === 3 ? .7 : .2 })); ting(c, o, t + .33, hz(86), .07); }
  };

  // Bilanciamento: quanto alzare ogni effetto (misurato registrandoli: così si sentono tutti a un volume simile)
  const GAIN = { click: 1.6, move: 7, berryThrow: 9, death: 3.2, road: 3.2, upgrade: 3.2, diceRoll: 3.6, coins: 3.4, potion: 3.2, cargo: 3.2,
    select: 3, error: 2.6, deploy: 2.8, board: 2.8, berryGrow: 3.2, bombFly: 2.6, superFly: 2.6, berrySplat: 2.6, shot: 2.4, impact: 2.2,
    conquer: 2.4, build: 2.2, crumble: 2.4, diceStop: 2.2, mine: 2.2, capNew: 2.4, army: 2, turn: 1.8, capLost: 1.4, bombBoom: 1.15, superBoom: 1, erupt: .95 };
  function voice(c, name) { const g = c.createGain(); g.gain.value = GAIN[name] || 2; g.connect(output(c)); return g; }

  // Vibrazione (millisecondi: vibra, pausa, vibra…)
  const BUZZ = { bomb: [70], super: [160, 70, 260], erupt: [220, 90, 220, 90, 420], hit: [25], capLost: [120, 80, 120] };

  DM.Sfx = {
    names: Object.keys(S),
    get ready() { return !!DM.Music.ctx; },
    played: [],   // ultimi effetti (per le prove)
    play(name, opts, delay) {
      if (!S[name]) return false;
      DM.Sfx.played.push(name); if (DM.Sfx.played.length > 50) DM.Sfx.played.shift();
      if (!P.get('sfx') || muted) return false;
      const c = DM.Music.ctx;
      if (!c) return false;
      try { S[name](c, voice(c, name), c.currentTime + .01 + (delay || 0), opts || {}); } catch (e) { return false; }
      return true;
    },
    buzz(name) {
      if (!P.get('vibra') || muted || !BUZZ[name] || !DM.Sfx.canBuzz) return false;
      try { return navigator.vibrate(BUZZ[name]); } catch (e) { return false; }
    },
    canBuzz: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    // registra un effetto (per le prove e per i video): restituisce l'AudioBuffer
    render(name, opts, seconds) {
      const c = new OfflineAudioContext(2, Math.ceil((seconds || 3) * 48000), 48000);
      const vol = P.get('sfxVol'); bus = null;
      S[name](c, voice(c, name), .05, opts || {});
      bus = null; busCtx = null; void vol;
      return c.startRendering();
    },
    mute(on) { muted = Math.max(0, muted + (on ? 1 : -1)); },
    setEnabled(on) { P.set({ sfx: !!on }); DM.Music.apply(); },
    setVolume(v) { P.set({ sfxVol: Math.max(0, Math.min(1, +v)) }); if (bus) output(busCtx); }
  };
  // un piccolo "tic" su ogni pulsante
  DM.Sfx.init = function () {
    document.addEventListener('click', e => {
      const b = e.target.closest('button, label.file, summary');
      if (b && !b.disabled && !b.closest('#c')) DM.Sfx.play('click');
    }, true);
  };
})(globalThis.DM = globalThis.DM || {});
