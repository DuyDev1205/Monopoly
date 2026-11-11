// Nhạc nền tổng hợp bằng WebAudio: không dùng file, không vướng bản quyền.
// Giai điệu ngũ cung (Đô–Rê–Mi–Sol–La), tiếng gảy giống đàn tranh, 16 ô nhịp lặp lại.

const BPM = 92;
const STEP = 60 / BPM / 2;          // một nốt móc đơn
const VOLUME = 0.2;

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (name) => 440 * 2 ** ((SEMI[name[0]] + 12 * (+name.slice(-1) + 1) - 69) / 12);

// mỗi dòng là một ô nhịp gồm 8 nốt móc đơn; "-" là ngân/nghỉ
const MELODY = [
  'E5 G5 A5 G5 E5 - D5 -', 'C5 D5 E5 G5 E5 - - -', 'A5 G5 E5 D5 C5 - D5 -', 'E5 D5 C5 A4 C5 - - -',
  'G5 A5 C6 A5 G5 - E5 -', 'D5 E5 G5 E5 D5 - - -', 'C5 D5 E5 G5 A5 - G5 -', 'E5 D5 C5 D5 C5 - - -',
  'G5 - E5 G5 A5 - G5 -', 'E5 - D5 E5 G5 - - -', 'A5 - C6 A5 G5 E5 D5 -', 'E5 - G5 - E5 - - -',
  'C6 - A5 G5 A5 - G5 -', 'E5 G5 A5 G5 E5 - D5 -', 'C5 - E5 D5 C5 A4 G4 -', 'C5 - - - - - - -',
].flatMap((bar) => bar.split(' '));
// hợp âm từng ô nhịp: [nốt trầm, ...nốt đệm]
const C = ['C3', 'E4', 'G4'], Am = ['A2', 'E4', 'A4'], F = ['F2', 'F4', 'A4'], G = ['G2', 'D4', 'G4'];
const CHORDS = [C, Am, F, G, C, Am, F, C, Am, F, C, G, Am, C, F, C];
const TOTAL = MELODY.length;

export function createMusic(getCtx) {
  let on = false, timer = null, next = 0, step = 0, out = null;

  function tone(ctx, type, freq, t, dur, vol, attack = 0.006) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function playStep(ctx, i, t) {
    const note = MELODY[i];
    if (note !== '-') {
      // ngân dài hơn nếu các bước sau là "-"
      let hold = 1;
      while (MELODY[(i + hold) % TOTAL] === '-' && hold < 4) hold++;
      const f = hz(note), dur = 0.35 + hold * 0.22;
      tone(ctx, 'triangle', f, t, dur, 0.5);
      tone(ctx, 'sine', f * 2, t, dur * 0.5, 0.12);
    }
    const chord = CHORDS[Math.floor(i / 8)], k = i % 8;
    if (k === 0 || k === 4) tone(ctx, 'sine', hz(chord[0]), t, 0.9, 0.5, 0.02);
    if (k === 2 || k === 6) { tone(ctx, 'triangle', hz(chord[1]), t, 0.3, 0.12); tone(ctx, 'triangle', hz(chord[2]), t, 0.3, 0.12); }
    if (k === 3 || k === 7) tone(ctx, 'sine', 1800, t, 0.04, 0.05);
  }
  function schedule() {
    const ctx = getCtx();
    if (!ctx) return;
    if (next < ctx.currentTime) next = ctx.currentTime + 0.05;   // tab bị treo một lúc: bắt nhịp lại
    while (next < ctx.currentTime + 0.5) { playStep(ctx, step, next); next += STEP; step = (step + 1) % TOTAL; }
  }

  return {
    get playing() { return on; },
    start() {
      const ctx = getCtx();
      if (on || !ctx) return;
      try {
        ctx.resume?.();
        // tiếng vọng nhẹ cho đỡ khô
        out = ctx.createGain();
        const master = ctx.createGain(), delay = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 3200;
        delay.delayTime.value = STEP * 1.5; fb.gain.value = 0.22;
        out.connect(lp); lp.connect(master);
        lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(master);
        master.gain.setValueAtTime(0.0001, ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(VOLUME, ctx.currentTime + 1.2);
        master.connect(ctx.destination);
        this.master = master;
        next = ctx.currentTime + 0.1; on = true;
        timer = setInterval(schedule, 120);
        schedule();
      } catch { on = false; }
    },
    stop() {
      if (!on) return;
      on = false; clearInterval(timer);
      const ctx = getCtx(), m = this.master;
      try {
        m.gain.cancelScheduledValues(ctx.currentTime);
        m.gain.setValueAtTime(m.gain.value, ctx.currentTime);
        m.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
        setTimeout(() => { try { m.disconnect(); } catch {} }, 500);
      } catch {}
    },
  };
}
