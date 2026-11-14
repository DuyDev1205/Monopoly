// Nhạc nền: danh sách bài thật (CC0, xem assets/music/CREDITS.txt) phát xáo trộn, chuyển bài mượt.
// Nếu không tải được file thì quay về nhạc tổng hợp bằng WebAudio bên dưới.
//
// Nhạc tổng hợp: bài vui tươi kiểu game giải trí: đàn chuông (marimba) chơi giai điệu, rải hợp âm,
// bè trầm, pad nền, trống nhẹ (kick, clap, shaker) và tiếng vang (reverb).
// 16 ô nhịp (đoạn A + đoạn B) lặp lại, khoảng 37 giây một vòng.

const BPM = 104;
const STEP = 60 / BPM / 2;   // một nốt móc đơn (8 nốt / ô nhịp)
const VOLUME = 0.15;

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (n) => SEMI[n[0]] + (n[1] === '#' ? 1 : n[1] === 'b' ? -1 : 0) + 12 * (+n.slice(-1) + 1);
const hz = (n) => 440 * 2 ** ((midi(n) - 69) / 12);

// Giai điệu: mỗi chuỗi là 1 ô nhịp, 8 nốt móc đơn; "-" = ngân tiếp, "." = nghỉ
const MELODY = [
  // Đoạn A
  'G5 - E5 G5 A5 - G5 -', 'D5 - . E5 D5 - B4 -', 'C5 - E5 A5 G5 - E5 -', 'F5 - E5 D5 C5 - . -',
  'G5 - E5 G5 C6 - B5 C6', 'D6 - B5 G5 D5 - . -', 'A5 - F5 A5 B5 - D6 B5', 'C6 - - - . - G5 -',
  // Đoạn B
  'E5 - A5 - C6 - B5 A5', 'G5 - E5 - B4 - . -', 'A5 - F5 - C6 - A5 F5', 'G5 - E5 C5 E5 - . -',
  'F5 - A5 - D6 - C6 A5', 'B5 - G5 - D5 - G5 -', 'G5 - E5 G5 A5 - C6 -', 'B5 - A5 - G5 - D5 -',
].map((b) => b.split(' '));
// Hợp âm từng nửa ô nhịp: [bè trầm, ...nốt hợp âm]
const CH = {
  C: ['C2', 'C4', 'E4', 'G4'], G: ['G1', 'B3', 'D4', 'G4'], Am: ['A1', 'C4', 'E4', 'A4'], F: ['F1', 'C4', 'F4', 'A4'],
  Em: ['E2', 'B3', 'E4', 'G4'], Dm: ['D2', 'D4', 'F4', 'A4'],
};
const CHORDS = [
  ['C', 'C'], ['G', 'G'], ['Am', 'Am'], ['F', 'F'], ['C', 'C'], ['G', 'G'], ['F', 'G'], ['C', 'C'],
  ['Am', 'Am'], ['Em', 'Em'], ['F', 'F'], ['C', 'C'], ['Dm', 'Dm'], ['G', 'G'], ['Em', 'Am'], ['Dm', 'G'],
];
const BARS = MELODY.length;

function createSynth(getCtx) {
  let on = false, timer = null, next = 0, step = 0;
  let ctx = null, bus = null, master = null, noise = null;

  function buildGraph() {
    ctx = getCtx();
    master = ctx.createGain();
    master.gain.value = 0.0001;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    // phòng vang: nhiễu tắt dần làm impulse response
    const len = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.28;
    bus = ctx.createGain();
    bus.connect(master);
    bus.connect(verb); verb.connect(wet).connect(master);
    // nhiễu trắng dùng cho trống
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const n = noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  }

  const panTo = (node, pan) => {
    if (!ctx.createStereoPanner || !pan) return node.connect(bus);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    node.connect(p).connect(bus);
  };
  // một nốt: các sóng (type, tỉ lệ tần số, âm lượng) qua bộ lọc, đường bao attack/decay
  function voice(freq, t, { parts, dur, vol, attack = 0.005, cutoff = 6000, pan = 0 }) {
    const g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    f.connect(g); panTo(g, pan);
    for (const [type, ratio, v] of parts) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = type; o.frequency.value = freq * ratio; og.gain.value = v;
      o.connect(og).connect(f);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }
  const marimba = (n, t, dur) => voice(hz(n), t, { parts: [['sine', 1, 1], ['sine', 4, 0.22], ['triangle', 2, 0.12]], dur: Math.min(1.1, 0.4 + dur * 0.5), vol: 0.32, cutoff: 5000 });
  const pluck = (n, t, pan) => voice(hz(n), t, { parts: [['triangle', 1, 1], ['sine', 2, 0.3]], dur: 0.32, vol: 0.07, cutoff: 3500, pan });
  const bass = (n, t, dur) => voice(hz(n), t, { parts: [['sine', 1, 1], ['triangle', 2, 0.25]], dur, vol: 0.34, attack: 0.01, cutoff: 900 });
  const pad = (notes, t, dur) => notes.forEach((n, k) => voice(hz(n), t, {
    parts: [['sawtooth', 1, 0.5], ['sawtooth', 1.006, 0.5]], dur, vol: 0.018, attack: 0.35, cutoff: 1100, pan: k % 2 ? 0.3 : -0.3,
  }));
  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(bus); o.start(t); o.stop(t + 0.25);
  }
  function hiss(t, { freq, q = 1, dur, vol, type = 'bandpass', pan = 0 }) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g); panTo(g, pan);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  function playStep(i, t) {
    const bar = Math.floor(i / 8) % BARS, k = i % 8, half = k < 4 ? 0 : 1;
    const chord = CH[CHORDS[bar][half]];
    // giai điệu
    const note = MELODY[bar][k];
    if (note !== '-' && note !== '.') {
      let hold = 1;
      while (hold < 6 && MELODY[(bar + Math.floor((k + hold) / 8)) % BARS][(k + hold) % 8] === '-') hold++;
      marimba(note, t, hold * STEP);
    }
    // pad: mỗi nửa ô nhịp
    if (k === 0 || (k === 4 && CHORDS[bar][0] !== CHORDS[bar][1])) pad(chord.slice(1), t, (k === 0 && CHORDS[bar][0] === CHORDS[bar][1] ? 8 : 4) * STEP + 0.3);
    // bè trầm: nhịp 1, 3 và nốt nảy trước nhịp 3
    if (k === 0 || k === 4) bass(chord[0], t, STEP * 2.6);
    if (k === 3 || k === 7) bass(chord[0].replace(/\d/, (d) => +d + 1), t, STEP * 0.8);
    // rải hợp âm ở quãng cao, xen kẽ trái/phải
    if (k % 2 === 1) pluck(chord[1 + ((k >> 1) % 3)].replace(/\d/, (d) => +d + 1), t, k % 4 === 1 ? -0.35 : 0.35);
    // trống: kick 1 & 3, clap 2 & 4, shaker mỗi móc đơn (phách sau mạnh hơn)
    if (k === 0 || k === 4) kick(t);
    if (k === 2 || k === 6) hiss(t, { freq: 1600, q: 0.8, dur: 0.14, vol: 0.12 });
    hiss(t, { freq: 9000, type: 'highpass', dur: 0.05, vol: k % 2 ? 0.05 : 0.025, pan: 0.2 });
  }
  function schedule() {
    if (next < ctx.currentTime) next = ctx.currentTime + 0.05;   // tab bị treo một lúc: bắt nhịp lại
    while (next < ctx.currentTime + 0.5) { playStep(step, next); next += STEP; step = (step + 1) % (BARS * 8); }
  }

  return {
    get playing() { return on; },
    start() {
      if (on) return;
      try {
        if (!ctx) { if (!getCtx()) return; buildGraph(); }
        ctx.resume?.()?.catch?.(() => {});
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(VOLUME, ctx.currentTime + 1.5);
        next = ctx.currentTime + 0.1; on = true;
        timer = setInterval(schedule, 120);
        schedule();
      } catch { on = false; }
    },
    stop() {
      if (!on) return;
      on = false; clearInterval(timer);
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      } catch {}
    },
  };
}

// ===== Danh sách bài (CC0 — OpenGameArt.org) =====
export const TRACKS = [
  { file: 'apple-cider', title: 'Apple Cider', by: 'Zane Little Music' },
  { file: 'happy-lofi-day', title: 'Happy Lofi Day', by: 'Tarush Singhal' },
  { file: 'shop-theme', title: 'Buy Something!', by: 'Cleyton Kauffman' },
  { file: 'chill-lofi-inspired', title: 'Chill Lofi Inspired', by: 'omfgdude' },
  { file: 'town-theme-rpg', title: 'Town Theme', by: 'cynicmusic' },
  { file: 'flowerbed-fields-loop', title: 'Flowerbed Fields', by: 'Zane Little Music' },
];
const TRACK_VOL = 0.15;      // nhạc nền nhỏ, để nghe rõ tiếng hiệu ứng
const XFADE = 3;             // giây chuyển bài
const BASE = new URL('../assets/music/', import.meta.url).href;

export function createMusic(getCtx) {
  const synth = createSynth(getCtx);
  let on = false, useSynth = false, fails = 0, timer = null, listener = null;
  let order = [], pos = -1, cur = null;
  const decks = [];            // 2 máy phát luân phiên để chuyển bài mượt

  function deck() {
    const a = new Audio(); a.preload = 'auto'; a.crossOrigin = 'anonymous';
    const d = { a, g: null, vol: 0, target: 0 };
    // đi qua WebAudio để chỉnh âm lượng được cả trên iPhone (ở đó audio.volume bị khoá)
    try { const ctx = getCtx(); if (ctx) { d.g = ctx.createGain(); d.g.gain.value = 0; ctx.createMediaElementSource(a).connect(d.g).connect(ctx.destination); } } catch { d.g = null; }
    a.addEventListener('error', () => { if (d === cur && on && !useSynth) { if (++fails >= 2) toSynth(); else next(); } });
    a.addEventListener('playing', () => { if (d === cur) fails = 0; });
    a.addEventListener('ended', () => { if (d === cur && on) next(); });
    return d;
  }
  const setVol = (d, v) => { d.vol = v; if (d.g) d.g.gain.value = v; else d.a.volume = Math.min(1, v); };

  function shuffle() {
    const last = order[order.length - 1];
    order = TRACKS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (order.length > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];   // không lặp lại bài vừa nghe
    pos = -1;
  }
  function next() {
    if (pos + 1 >= order.length) shuffle();
    const t = TRACKS[order[++pos]];
    if (!decks.length) decks.push(deck(), deck());
    const old = cur;
    cur = decks[0] === old ? decks[1] : decks[0];
    if (old) old.target = 0;
    cur.a.src = BASE + t.file + '.mp3';
    cur.target = TRACK_VOL; setVol(cur, 0);
    cur.a.play().catch(() => {});
    listener?.(t);
  }
  // mỗi 100 ms: kéo âm lượng về đích, gần hết bài thì chuyển sang bài kế
  function tick() {
    const step = (TRACK_VOL / XFADE) * 0.1;
    for (const d of decks) {
      const v = d.vol < d.target ? Math.min(d.target, d.vol + step) : Math.max(d.target, d.vol - step * (on ? 1.5 : 5));
      if (v !== d.vol) setVol(d, v);
      if ((d !== cur || !on) && d.vol <= 0 && !d.a.paused) d.a.pause();
    }
    const a = cur?.a;
    if (on && a && a.duration && !a.paused && a.duration - a.currentTime < XFADE) next();
  }
  function toSynth() {
    useSynth = true;
    decks.forEach((d) => { d.target = 0; d.a.pause(); });
    if (on) synth.start();
    listener?.(null);
  }

  return {
    get playing() { return on; },
    /** gọi lại khi đổi bài: fn({ title, by }) hoặc fn(null) khi dùng nhạc tổng hợp */
    onTrack(fn) { listener = fn; },
    start() {
      if (on) return;
      on = true;
      if (useSynth) return synth.start();
      try {
        getCtx()?.resume?.()?.catch?.(() => {});
        if (!cur) next();
        else { cur.target = TRACK_VOL; cur.a.play().catch(() => {}); }
        timer ??= setInterval(tick, 100);
      } catch { toSynth(); }
    },
    stop() {
      if (!on) return;
      on = false;
      if (useSynth) return synth.stop();
      decks.forEach((d) => { d.target = 0; });   // tắt dần (~0,6 s) rồi tạm dừng; bật lại nghe tiếp đúng chỗ
    },
    skip() { if (on && !useSynth) next(); },
  };
}
