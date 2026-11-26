// Damamondo – la sigla: musica originale suonata dal browser (Web Audio), senza file e senza diritti di altri.
// Re minore, 92 battiti al minuto. Un giro completo dura 64 battute (circa 2 minuti e 47 secondi) e poi ricomincia:
//   sezione 1 (battute 1–16):  archi e arpeggio, basso          → apertura tranquilla
//   sezione 2 (17–32):         + melodia (flauto) e tamburi leggeri
//   sezione 3 (33–48):         + melodia raddoppiata dal corno, tamburi pieni → il momento "avventura"
//   sezione 4 (49–64):         pausa: archi, campanelle e frammenti di melodia, niente tamburi
// La stessa partitura si può "registrare" in un file per i video (DM.Music.render).
(function (DM) {
  'use strict';
  const BPM = 92, BEAT = 60 / BPM, BAR = 4 * BEAT, LOOP = 64;
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);

  // Accordi (note MIDI): Re minore, Si bemolle, Fa, Do, Sol minore, La
  const CH = { Dm: [50, 53, 57], Bb: [46, 50, 53], F: [53, 57, 60], C: [48, 52, 55], Gm: [43, 50, 55], A: [45, 49, 52] };
  const PROG = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Bb', 'F', 'C', 'Dm', 'Bb', 'C', 'Dm', 'A'];
  // Melodia di 16 battute: [nota MIDI o null (pausa), durata in battiti]
  const MEL = [
    [[69, 1], [74, 1], [76, 1], [77, 1]], [[77, 2], [74, 1], [70, 1]], [[72, 1.5], [69, .5], [72, 1], [77, 1]], [[76, 3], [72, 1]],
    [[74, 1], [77, 1], [81, 2]], [[79, 1], [77, 1], [74, 2]], [[70, 1], [74, 1], [79, 1], [77, 1]], [[76, 2], [73, 2]],
    [[74, 1], [77, 1], [82, 2]], [[81, 1.5], [79, .5], [77, 2]], [[79, 2], [76, 1], [72, 1]], [[74, 3], [null, 1]],
    [[77, 1], [79, 1], [81, 1], [82, 1]], [[81, 1], [79, 1], [76, 2]], [[77, 1], [76, 1], [74, 2]], [[73, 2], [76, 2]]
  ];

  // ---------- strumenti (ogni funzione suona una nota sul contesto audio c, verso l'uscita out) ----------
  function env(c, g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  function pad(c, out, notes, t, dur) {        // archi morbidi: due seghe leggermente stonate e filtrate
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = .3;
    const g = c.createGain(); env(c, g, t, .3, .032, Math.max(0, dur - .3), 1.1);
    f.connect(g); g.connect(out);
    notes.forEach(m => [-6, 6].forEach(cents => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = cents;
      o.connect(f); o.start(t); o.stop(t + dur + 1.4);
    }));
  }
  function pluck(c, out, m, t, vol) {          // arpeggio pizzicato
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m);
    const g = c.createGain(); env(c, g, t, .005, vol, 0, .45);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + .5);
  }
  function bell(c, out, m, t) {                // campanella
    [1, 2.76].forEach((r, i) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m) * r;
      const g = c.createGain(); env(c, g, t, .005, i ? .012 : .05, 0, i ? .6 : 1.8);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 2);
    });
  }
  function bass(c, out, m, t, dur) {
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m);
    const g = c.createGain(); env(c, g, t, .02, .16, Math.max(0, dur - .3), .3);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .4);
  }
  function flute(c, out, m, t, dur, vol) {     // melodia: sinusoide con vibrato
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m);
    const v = c.createOscillator(), vg = c.createGain(); v.frequency.value = 5.2; vg.gain.value = hz(m) * .006;
    v.connect(vg); vg.connect(o.frequency);
    const g = c.createGain(); env(c, g, t, .06, vol, Math.max(0, dur - .2), .25);
    o.connect(g); g.connect(out); o.start(t); v.start(t); o.stop(t + dur + .4); v.stop(t + dur + .4);
  }
  function horn(c, out, m, t, dur) {           // corno: sega filtrata, un'ottava sotto la melodia
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m - 12);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = c.createGain(); env(c, g, t, .09, .05, Math.max(0, dur - .25), .3);
    o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .5);
  }
  let noiseBuf = null;
  function noise(c) {
    if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0); let s = 12345;
    for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = s / 0x3fffffff - 1; }
    return noiseBuf;
  }
  function drum(c, out, t, f0, f1, vol, len) { // tamburo: sinusoide che scende di tono
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len * .6);
    const g = c.createGain(); env(c, g, t, .003, vol, 0, len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + .05);
  }
  function shaker(c, out, t, vol) {
    const s = c.createBufferSource(); s.buffer = noise(c);
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = c.createGain(); env(c, g, t, .002, vol, 0, .06);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * .5); s.stop(t + .1);
  }
  // colpo grande (per i video: esplosione, eruzione)
  function boom(c, out, t, vol) {
    drum(c, out, t, 110, 28, vol * .9, 1.6);
    const s = c.createBufferSource(); s.buffer = noise(c);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2500, t); f.frequency.exponentialRampToValueAtTime(200, t + 1.2);
    const g = c.createGain(); env(c, g, t, .005, vol * .5, 0, 1.4);
    s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + 1);
    const s2 = c.createBufferSource(); s2.buffer = noise(c); s2.loop = true;
    const f2 = c.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 5000;
    const g2 = c.createGain(); env(c, g2, t, .01, vol * .08, 0, 2.4);
    s2.connect(f2); f2.connect(g2); g2.connect(out); s2.start(t); s2.stop(t + 2.6);
  }

  // riverbero: risposta all'impulso fatta di rumore che si spegne (2,5 s)
  function reverb(c) {
    const len = Math.floor(c.sampleRate * 2.5), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let s = 777 + ch; for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff - 1) * Math.pow(1 - i / len, 3); } }
    const cv = c.createConvolver(); cv.buffer = b; return cv;
  }
  // catena di uscita: suono diretto + riverbero → master
  function chain(c, master) {
    const dry = c.createGain(), wet = c.createGain(), rv = reverb(c), send = c.createGain();
    dry.gain.value = .8; wet.gain.value = .35; send.gain.value = 1;
    send.connect(dry); send.connect(rv); rv.connect(wet); dry.connect(master); wet.connect(master);
    return send;
  }

  // ---------- la partitura: suona la battuta "bar" (0–63) a partire dal tempo t ----------
  // sec: 0 apertura, 1 melodia, 2 avventura, 3 pausa. quiet: in partita (più leggera, senza tamburi pieni)
  function playBar(c, out, bar, t, sec, quiet) {
    const i = bar % 16, chord = CH[PROG[i]], root = chord[0];
    const tones = chord.concat(chord[0] + 12);
    // archi
    pad(c, out, chord.map(m => m + 12), t, BAR - .1);
    // arpeggio a ottavi
    const pat = [0, 1, 2, 3, 2, 1, 2, 3];
    if (sec !== 3) pat.forEach((k, j) => pluck(c, out, tones[k] + 12, t + j * BEAT / 2, sec === 0 ? .045 : .055));
    else [0, 2].forEach(j => bell(c, out, tones[j * 1 + 1] + 24, t + j * 2 * BEAT));
    // basso
    if (sec === 0 || sec === 3) bass(c, out, root - 12, t, BAR - .1);
    else { bass(c, out, root - 12, t, 1.6 * BEAT); bass(c, out, root - 12, t + 2 * BEAT, 1.4 * BEAT); bass(c, out, chord[2] - 12, t + 3.5 * BEAT, .45 * BEAT); }
    // melodia
    if (sec === 1 || sec === 2) {
      let b = 0;
      MEL[i].forEach(([m, d]) => {
        if (m !== null) { flute(c, out, m, t + b * BEAT, d * BEAT * .95, sec === 2 ? .11 : .095); if (sec === 2) horn(c, out, m, t + b * BEAT, d * BEAT * .9); }
        b += d;
      });
    } else if (sec === 3 && i % 2 === 0) flute(c, out, MEL[i][0][0], t, 2 * BEAT, .06);
    // tamburi
    if (sec === 1 && !quiet) { drum(c, out, t, 90, 50, .22, .5); drum(c, out, t + 2 * BEAT, 90, 50, .16, .5); }
    if (sec === 2) {
      drum(c, out, t, 95, 45, quiet ? .2 : .32, .6); drum(c, out, t + 1.5 * BEAT, 140, 80, quiet ? .08 : .14, .35);
      drum(c, out, t + 2 * BEAT, 95, 45, quiet ? .16 : .26, .6);
      if (!quiet) for (let j = 0; j < 8; j++) shaker(c, out, t + j * BEAT / 2, j % 2 ? .025 : .04);
      if (i % 4 === 3 && !quiet) [3, 3.33, 3.66].forEach((x, k) => drum(c, out, t + x * BEAT, 170 - k * 20, 90, .14, .25));
    }
  }
  const sectionOf = bar => Math.floor((bar % LOOP) / 16);

  // ---------- riproduzione nel sito ----------
  // Un solo contesto audio per musica ed effetti sonori (js/sfx.js); le impostazioni stanno in DM.Prefs.
  const P = DM.Prefs;
  let ctx = null, master = null, out = null, timer = 0, nextBar = 0, nextTime = 0, scene = 'menu';
  const level = () => P.get('music') ? P.get('volume') * (scene === 'game' ? .45 : 1) * .9 : 0;

  function context() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
    out = chain(ctx, master);
    nextBar = 0; nextTime = ctx.currentTime + .15;
    timer = setInterval(tick, 200);
    return ctx;
  }
  function tick() {
    if (!ctx || ctx.state !== 'running' || !P.get('music')) return;
    if (nextTime < ctx.currentTime - .05) nextTime = ctx.currentTime + .1;   // dopo una pausa non recupera le battute perse
    while (nextTime < ctx.currentTime + 1.2) {
      playBar(ctx, out, nextBar, nextTime, sectionOf(nextBar), scene === 'game');
      nextBar = (nextBar + 1) % LOOP; nextTime += BAR;
    }
  }
  const wanted = () => P.get('music') || P.get('sfx');
  function apply() {
    if (!ctx) return;   // partirà al prossimo tocco
    if (wanted() && ctx.state !== 'running' && !document.hidden) { ctx.resume(); nextTime = Math.max(nextTime, ctx.currentTime + .1); }
    master.gain.setTargetAtTime(Math.max(.0001, level()), ctx.currentTime, P.get('music') ? .3 : .15);
    if (P.get('music')) tick();
    if (!wanted()) setTimeout(() => { if (ctx && !wanted()) ctx.suspend(); }, 600);
  }

  DM.Music = {
    get settings() { return { music: P.get('music'), volume: P.get('volume') }; },
    get playing() { return !!ctx && ctx.state === 'running' && P.get('music'); },
    setEnabled(on) { P.set({ music: !!on }); if (on) context(); apply(); },
    setVolume(v) { P.set({ volume: Math.max(0, Math.min(1, +v)) }); apply(); },
    setScene(s) { scene = s; apply(); },
    // contesto audio pronto (dopo il primo tocco), per gli effetti sonori
    get ctx() { return ctx && ctx.state === 'running' ? ctx : null; },
    lib: { env, noise, drum, reverb, hz },
    apply,
    init() {
      // i browser fanno partire l'audio solo dopo un tocco della persona
      const first = () => { if (wanted()) { context(); apply(); } };
      document.addEventListener('pointerdown', first, true);
      document.addEventListener('keydown', first, true);
      // app in secondo piano: audio in pausa
      document.addEventListener('visibilitychange', () => {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else if (wanted()) { ctx.resume(); nextTime = Math.max(nextTime, ctx.currentTime + .1); }
      });
    },
    // "Registra" la sigla in un file (per i video): durata in secondi, colpi forti ai secondi indicati, sfumata finale.
    // order: sezione di ogni battuta (per il video si parte più in fretta con la melodia).
    async render(seconds, hits, order) {
      const rate = 48000, c = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
      const m = c.createGain(); m.gain.value = .9; m.connect(c.destination);
      const o = chain(c, m);
      for (let b = 0, t = 0; t < seconds; b++, t += BAR) playBar(c, o, b, t, order ? order(b) : sectionOf(b), false);
      (hits || []).forEach(t => boom(c, o, t, .9));
      m.gain.setValueAtTime(.9, Math.max(0, seconds - 3)); m.gain.linearRampToValueAtTime(0.0001, seconds - .05);
      return c.startRendering();
    },
    BAR, LOOP
  };
})(globalThis.DM = globalThis.DM || {});
