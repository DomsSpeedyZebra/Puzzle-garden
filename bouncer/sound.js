/* =====================================================================
   BOUNCER — sound effects and music
   Nothing here is a recording: every sound is made live by the phone's
   audio chip (the Web Audio API), the same way old 8-bit games did it.

   Sound.init()        start audio (must happen on a tap — phones insist)
   Sound.sfx("name")   play an effect: wall, paddle, brick, steel, gold,
                       explode, good, bad, laser, launch, lose, clear, net, over
   Sound.startMusic(n) play song n (there are 3; levels cycle through them)
   Sound.stopMusic()
   Sound.setMusic(on) / Sound.setSfx(on)
   ===================================================================== */
const Sound = (() => {
  let ac = null, master, sfxBus, musBus, noiseBuf;
  let musicOn = true, sfxOn = true;
  const lastPlayed = {};            // stops the same effect stacking up 20 times at once

  // ---- Setup ----
  function init() {
    if (ac) { if (ac.state === "suspended") ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 0.55 : 0; sfxBus.connect(master);
    musBus = ac.createGain(); musBus.gain.value = musicOn ? 0.28 : 0; musBus.connect(master);
    // One second of random "hiss" — used for explosions, snares and hi-hats
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);   // note number -> frequency

  // A single beep: wave type, start pitch, end pitch, length, volume
  function tone(type, f0, f1, dur, vol, when, bus) {
    const t = when || ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // A burst of filtered hiss: filter type, start/end filter pitch, length, volume
  function noise(filter, f0, f1, dur, vol, when, bus) {
    const t = when || ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = filter;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ---- Sound effects ----
  const FX = {
    wall:   () => tone("square", 260, 0, 0.03, 0.12),
    paddle: () => { tone("square", 392, 0, 0.06, 0.22); tone("triangle", 196, 0, 0.08, 0.3); },
    brick:  p  => tone("square", 523 + (p || 0) * 70, 0, 0.055, 0.2),
    steel:  () => { tone("square", 1480, 0, 0.05, 0.14); tone("square", 2217, 0, 0.07, 0.09); noise("highpass", 6000, 0, 0.03, 0.15); },
    gold:   () => { tone("triangle", 1760, 1700, 0.14, 0.2); tone("sine", 2640, 0, 0.1, 0.12); },
    explode:() => { noise("lowpass", 1800, 90, 0.5, 0.9); tone("sine", 140, 35, 0.35, 0.7); },
    good:   () => [523, 659, 784, 1047].forEach((f, i) => tone("square", f, 0, 0.07, 0.16, ac.currentTime + i * 0.05)),
    bad:    () => tone("sawtooth", 420, 110, 0.4, 0.2),
    laser:  () => tone("square", 1700, 380, 0.09, 0.12),
    launch: () => tone("square", 660, 880, 0.07, 0.18),
    net:    () => tone("triangle", 300, 520, 0.09, 0.25),
    lose:   () => [600, 450, 300, 160].forEach((f, i) => tone("square", f, f * 0.9, 0.13, 0.2, ac.currentTime + i * 0.12)),
    clear:  () => [523, 659, 784, 1047, 1319].forEach((f, i) => { tone("square", f, 0, 0.16, 0.14, ac.currentTime + i * 0.09); tone("triangle", f / 2, 0, 0.2, 0.18, ac.currentTime + i * 0.09); }),
    over:   () => [392, 330, 262, 196, 131].forEach((f, i) => tone("triangle", f, 0, 0.3, 0.3, ac.currentTime + i * 0.22))
  };

  function sfx(name, arg) {
    if (!ac || !sfxOn || !FX[name]) return;
    const now = ac.currentTime;
    if (lastPlayed[name] && now - lastPlayed[name] < 0.035) return;   // rate limit
    lastPlayed[name] = now;
    try { FX[name](arg); } catch (e) {}
  }

  // ---- Music ----
  // Each song: speed (bpm), 4 chords (root note number + "m" minor / "M" major),
  // a bass rhythm (16 steps: number = notes above the root, null = rest),
  // an arpeggio order, and a drum pattern (k = kick, s = snare, h = hi-hat).
  const SONGS = [
    { bpm: 128, chords: [[45, "m"], [41, "M"], [48, "M"], [43, "M"]],
      bass: [0, null, 0, 12, null, 0, 7, null, 0, null, 0, 12, null, 7, 5, null],
      arp: [0, 1, 2, 3, 2, 1],
      drums: "k.h.s.h.k.hks.h." },
    { bpm: 142, chords: [[40, "m"], [36, "M"], [38, "M"], [35, "m"]],
      bass: [0, 0, 12, 0, 0, 12, 0, 7, 0, 0, 12, 0, 10, 0, 7, 0],
      arp: [0, 2, 1, 3],
      drums: "k.hhs.hhk.hks.hh" },
    { bpm: 116, chords: [[38, "m"], [34, "M"], [41, "M"], [36, "M"]],
      bass: [0, null, null, 0, null, null, 7, null, 0, null, null, 0, 12, null, 10, null],
      arp: [0, 1, 2, 1, 3, 2, 1, 2],
      drums: "k..hs..hk.k.s..h" }
  ];
  const mus = { song: null, step: 0, next: 0, timer: null };

  function playStep(s, step, t, len) {
    const bar = Math.floor(step / 16) % s.chords.length, st = step % 16;
    const [root, q] = s.chords[bar];
    const tones = q === "m" ? [0, 3, 7, 12] : [0, 4, 7, 12];
    const b = s.bass[st];
    if (b !== null) tone("square", midi(root + 12 + b), 0, len * 0.9, 0.16, t, musBus);
    // Lead arpeggio — on the second time round the 4 chords it jumps up an octave
    const up = Math.floor(step / (16 * s.chords.length)) % 2 ? 12 : 0;
    const a = tones[s.arp[st % s.arp.length]];
    tone("square", midi(root + 24 + up + a), 0, len * 0.75, 0.055, t, musBus);
    const d = s.drums[st];
    if (d === "k") tone("sine", 150, 40, 0.13, 0.7, t, musBus);
    if (d === "s") noise("highpass", 1200, 0, 0.11, 0.35, t, musBus);
    if (d === "h") noise("highpass", 7500, 0, 0.03, 0.12, t, musBus);
  }

  function schedule() {
    const s = mus.song, len = 60 / s.bpm / 4;
    while (mus.next < ac.currentTime + 0.12) {      // book notes slightly ahead so they're on time
      playStep(s, mus.step, mus.next, len);
      mus.next += len;
      mus.step = (mus.step + 1) % (16 * s.chords.length * 2);
    }
  }

  function startMusic(n) {
    if (!ac) return;
    stopMusic();
    mus.song = SONGS[n % SONGS.length];
    mus.step = 0;
    mus.next = ac.currentTime + 0.08;
    mus.timer = setInterval(schedule, 25);
  }
  function stopMusic() { if (mus.timer) { clearInterval(mus.timer); mus.timer = null; } }

  function setMusic(on) { musicOn = on; if (musBus) musBus.gain.value = on ? 0.28 : 0; }
  function setSfx(on) { sfxOn = on; if (sfxBus) sfxBus.gain.value = on ? 0.55 : 0; }

  return { init, sfx, startMusic, stopMusic, setMusic, setSfx };
})();
