// Bộ vẽ 2.5D của bản app (PixiJS / WebGL). Toàn bộ nhà, cây, nhân vật, xúc xắc là ảnh dựng sẵn từ mô hình 3D
// (app/tools/bake.html -> app/skin/sprites). Bàn cờ, ô đất, hiệu ứng vẽ bằng PixiJS.
// Xuất ra đúng các hàm app.js đang gọi (giống scene3d.js) nên luật chơi / chơi online không đổi.
import { Application, Assets, BlurFilter, CanvasSource, Container, FillGradient, Graphics, Matrix, Rectangle, Sprite, Text, Texture } from './vendor/pixi/pixi.min.mjs';

export function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// ======================= hình học bàn cờ (giống scene3d.js) =======================
const CORNER = 1.45, GAP = 0.05, TH = 0.16;
const SIZES = [CORNER, 1, 1, 1, 1, 1, 1, 1, CORNER];
const W = SIZES.reduce((a, b) => a + b, 0) + GAP * 8;
const cellC = (k) => { let x = -W / 2; for (let j = 1; j < k; j++) x += SIZES[j - 1] + GAP; return x + SIZES[k - 1] / 2; };
function gridPos(i) {
  if (i <= 8) return [9, 9 - i];
  if (i <= 16) return [9 - (i - 8), 1];
  if (i <= 24) return [1, 1 + (i - 16)];
  return [1 + (i - 24), 9];
}
const sideOf = (i) => (i % 8 === 0 ? 'c' : ['b', 'l', 't', 'r'][Math.floor(i / 8)]);
const TILE = [];
for (let i = 0; i < 32; i++) {
  const [r, c] = gridPos(i), side = sideOf(i), col = side === 'l' || side === 'r';
  TILE.push({ x: cellC(c), z: cellC(r), w: SIZES[c - 1], d: SIZES[r - 1], side,
    along: col ? { x: 0, z: -1 } : { x: 1, z: 0 }, far: col ? { x: -1, z: 0 } : { x: 0, z: -1 },
    alen: side === 'c' ? CORNER : 1, dlen: CORNER, rot: col ? 1 : 0 });
}
/** điểm trên mặt ô: a theo chiều chữ (-0.5..0.5), s từ mép xa (0) tới mép gần (1) */
function tp(i, a = 0, s = 0.5, y = TH) {
  const t = TILE[i], k = t.dlen * (0.5 - s);
  return { x: t.x + t.along.x * a * t.alen + t.far.x * k, y, z: t.z + t.along.z * a * t.alen + t.far.z * k };
}

// ======================= phép chiếu isometric =======================
let E = 0.72, K = 200;                 // lấy lại từ sprites.json
let SIN = Math.sin(E), COS = Math.cos(E);
const C = Math.SQRT1_2;
let S = 80, OX = 0, OY = 0;            // điểm ảnh / đơn vị, gốc màn hình
const px = (x, y, z) => [(x - z) * C, (x + z) * C * SIN - y * COS];          // toạ độ màn hình theo đơn vị
const screen = (p) => [OX + px(p.x, p.y, p.z)[0] * S, OY + px(p.x, p.y, p.z)[1] * S];
const depth = (x, z) => (x + z) * 1000;
/** ma trận đưa mặt phẳng ngang (x, z) ở độ cao y về màn hình (đơn vị) */
const planeMatrix = (y = 0) => new Matrix(C, C * SIN, -C, C * SIN, 0, -y * COS);

// ======================= tiện ích =======================
const rnd = (a, b) => a + Math.random() * (b - a);
const ease = { outBack: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2, outCubic: (t) => 1 - (1 - t) ** 3, inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1) };
const hex = (c) => parseInt(String(c).replace('#', ''), 16);
function mixHex(a, b, t) {
  const A = hex(a), Bc = hex(b);
  const ch = (v, s) => (v >> s) & 255;
  const m = (s) => Math.round(ch(A, s) + (ch(Bc, s) - ch(A, s)) * t);
  return '#' + [16, 8, 0].map((s) => m(s).toString(16).padStart(2, '0')).join('');
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texOf(c) { return new Texture({ source: new CanvasSource({ resource: c, autoGenerateMipmaps: true, scaleMode: 'linear', anisotropicLevel: 8 }) }); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const FONT = '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "SF Pro Display", Arial, sans-serif';
function fitText(g, text, maxW, size, weight = 800) {
  let s = size;
  do { g.font = `${weight} ${s}px ${FONT}`; if (g.measureText(text).width <= maxW) break; s -= 2; } while (s > 10);
  return s;
}
function lines(g, text, maxW, size) {
  g.font = `800 ${size}px ${FONT}`;
  if (g.measureText(text).width <= maxW) return [text];
  const w = text.split(' ');
  let best = [text], bestW = Infinity;
  for (let k = 1; k < w.length; k++) {
    const a = w.slice(0, k).join(' '), b = w.slice(k).join(' ');
    const m = Math.max(g.measureText(a).width, g.measureText(b).width);
    if (m < bestW) { bestW = m; best = [a, b]; }
  }
  return best;
}
const imgCache = new Map();
function loadImg(src) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  return imgCache.get(src);
}
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const radialTex = (() => {
  const cache = new Map();
  return (stops, size = 128) => {
    const key = JSON.stringify(stops); if (cache.has(key)) return cache.get(key);
    const [c, g] = canvas(size, size); const r = g.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    stops.forEach(([o, col]) => r.addColorStop(o, col)); g.fillStyle = r; g.fillRect(0, 0, size, size);
    const t = Texture.from(c); cache.set(key, t); return t;
  };
})();

// ======================= ảnh dựng sẵn =======================
const SPR = {};          // tên sheet -> { tên khung -> { tex, ax, ay } }
async function loadSprites() {
  const base = 'skin/sprites/';
  const idx = await (await fetch(base + 'sprites.json')).json();
  E = idx.E; K = idx.K; SIN = Math.sin(E); COS = Math.cos(E);
  await Promise.all(Object.entries(idx.sheets).map(async ([name, sh]) => {
    const tex = await Assets.load(base + sh.file);
    tex.source.scaleMode = 'linear'; tex.source.autoGenerateMipmaps = true; tex.source.updateMipmaps?.();
    const frames = {};
    for (const [fn, [x, y, w, h, ax, ay]] of Object.entries(sh.frames)) {
      frames[fn] = { tex: new Texture({ source: tex.source, frame: new Rectangle(x, y, w, h) }), ax: ax / w, ay: ay / h };
    }
    SPR[name] = frames;
  }));
}
function spr(sheet, name) {
  const f = SPR[sheet]?.[name]; if (!f) return null;
  const s = new Sprite(f.tex); s.anchor.set(f.ax, f.ay); s.scale.set(1 / K); return s;
}
function setFrame(s, sheet, name) { const f = SPR[sheet]?.[name]; if (!f) return; s.texture = f.tex; s.anchor.set(f.ax, f.ay); }

// ======================= biến toàn cục =======================
let app, host, stageEl;
let world, sceneryLayer, boardLayer, tileLayer, objLayer, fxLayer, overLayer;
const tiles = [];
const buildings = [];
const gates = new Map();
let tokens = [];
let dice = [];
let marker = null, pile = null;
let theme = 'midnight', mode = 'home';
const anims = new Set();
let t0 = performance.now();
const nowS = () => (performance.now() - t0) / 1000;

// ======================= khởi tạo =======================
export async function init({ stage }) {
  stageEl = stage;
  await loadSprites();
  app = new Application();
  await app.init({ backgroundAlpha: 0, antialias: true, resolution: Math.min(2, devicePixelRatio || 1), autoDensity: true, resizeTo: window, powerPreference: 'high-performance' });
  host = app.canvas; host.id = 'gl';
  document.body.prepend(host);
  world = new Container();
  sceneryLayer = new Container(); boardLayer = new Container(); tileLayer = new Container();
  objLayer = new Container(); objLayer.sortableChildren = true;
  fxLayer = new Container(); overLayer = new Container();
  world.addChild(sceneryLayer, boardLayer, tileLayer, objLayer, fxLayer, overLayer);
  app.stage.addChild(world);
  buildBoardBase();
  buildDice();
  buildMarker();
  addEventListener('resize', () => fit());
  app.ticker.add(() => loop());
  fit();
  document.body.classList.add('gl');
  return true;
}
function fit() {
  if (!app) return;
  const Wv = innerWidth, Hv = innerHeight;
  const rect = { x: Wv * 0.17, y: 58, w: Wv * 0.66, h: Hv - 64 };
  const ext = W / 2 + 0.35;
  const pts = [];
  [-1, 1].forEach((a) => [-1, 1].forEach((b) => [-0.5, 0.5].forEach((y) => pts.push(px(a * ext, y, b * ext)))));
  const x0 = Math.min(...pts.map((p) => p[0])), x1 = Math.max(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  S = Math.min(rect.w / (x1 - x0), rect.h / (y1 - y0)) * 0.97;
  OX = rect.x + rect.w / 2 - ((x0 + x1) / 2) * S;
  OY = rect.y + rect.h / 2 - ((y0 + y1) / 2) * S;
  world.position.set(OX, OY); world.scale.set(S);
}
export function setMode(m) { mode = m; if (host) host.style.visibility = m === 'home' ? 'hidden' : ''; fit(); }

// ======================= đế bàn cờ =======================
const STYLE = {
  midnight: { top: '#2a3366', side: '#1a2147', side2: '#141a3a', trim: '#7B61FF', tile: '#e9e6f5', tileSide: '#b9b4d6', court: ['#232B55', '#1D2449', '#2E3870'] },
  wood: { top: '#f3e3c6', side: '#c99a5c', side2: '#a26c38', trim: '#e0a030', tile: '#fffaf0', tileSide: '#e6cfa6', court: ['#EBC994', '#E3BB84', '#9C6B3A'] },
  ocean: { top: '#fffaf0', side: '#bfe9e6', side2: '#1e3a5f', trim: '#ffb703', tile: '#ffffff', tileSide: '#cfe6ea', court: ['#FFF6E2', '#CFF3EE', '#1E3A5F'] },
  sakura: { top: '#ffffff', side: '#fbe6f0', side2: '#e5bcd3', trim: '#e8467c', tile: '#ffffff', tileSide: '#f1d6e4', court: ['#FFF8FB', '#FBE6F0', '#EBCFE0'] },
};
let base = null;
/** đa giác thẳng đứng nối 2 điểm trên mặt đất, từ y0 lên y1 */
function wall(g, ax, az, bx, bz, y0, y1, fill) {
  const p = [px(ax, y1, az), px(bx, y1, bz), px(bx, y0, bz), px(ax, y0, az)];
  g.poly(p.flat()).fill(fill);
}
function buildBoardBase() {
  base?.destroy({ children: true });
  base = new Container(); boardLayer.addChild(base);
  const st = STYLE[theme] || STYLE.midnight;
  const e = W / 2 + 0.35, e2 = W / 2 + 0.45;
  // bóng đổ của bàn xuống đảo
  const sh = new Graphics(); sh.setFromMatrix(planeMatrix(-0.95));
  sh.roundRect(-e2 + 0.5, -e2 + 0.7, e2 * 2, e2 * 2, 0.6).fill({ color: 0x1a0f2a, alpha: 0.22 });
  sh.filters = [new BlurFilter({ strength: 12 })];
  base.addChild(sh);
  // thân bàn: 2 mặt đứng nhìn thấy (+z, +x) + viền kim loại
  const g = new Graphics();
  const gz = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: st.side }, { offset: 1, color: st.side2 }], textureSpace: 'local' });
  const gx = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: mixHex(st.side, '#000000', 0.12) }, { offset: 1, color: mixHex(st.side2, '#000000', 0.15) }], textureSpace: 'local' });
  wall(g, -e2, e2, e2, e2, -0.95, -0.05, gz);
  wall(g, e2, e2, e2, -e2, -0.95, -0.05, gx);
  wall(g, -e2, e2, e2, e2, -0.62, -0.5, st.trim);
  wall(g, e2, e2, e2, -e2, -0.62, -0.5, mixHex(st.trim, '#000000', 0.2));
  base.addChild(g);
  // mặt bàn
  const top = new Graphics(); top.setFromMatrix(planeMatrix(-0.05));
  top.roundRect(-e2, -e2, e2 * 2, e2 * 2, 0.3).fill(st.top);
  top.roundRect(-e2, -e2, e2 * 2, e2 * 2, 0.3).stroke({ width: 0.05, color: st.trim, alpha: 0.9 });
  base.addChild(top);
  // sân giữa: ô bàn cờ xen kẽ
  const inner = W - 2 * CORNER - 2 * GAP - 0.1;
  const [c, cg] = canvas(1024, 1024);
  const n = 8, s = 1024 / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { cg.fillStyle = (x + y) % 2 ? st.court[1] : st.court[0]; cg.fillRect(x * s, y * s, s, s); }
  const rg = cg.createRadialGradient(512, 512, 60, 512, 512, 720); rg.addColorStop(0, 'rgba(255,255,255,.22)'); rg.addColorStop(1, 'rgba(0,0,0,.14)'); cg.fillStyle = rg; cg.fillRect(0, 0, 1024, 1024);
  cg.strokeStyle = st.court[2]; cg.globalAlpha = 0.4; cg.lineWidth = 8; rr(cg, 14, 14, 996, 996, 40); cg.stroke();
  const court = new Sprite(texOf(c)); court.anchor.set(0.5); court.width = inner; court.height = inner;
  const cw = new Container(); cw.setFromMatrix(planeMatrix(0.01)); cw.addChild(court); base.addChild(cw);
}

// ======================= ô đất =======================
export function buildTiles(list) {
  tileLayer.removeChildren();
  const st = STYLE[theme] || STYLE.midnight;
  list.forEach((info, i) => {
    const t = TILE[i];
    const root = new Container();
    const sides = new Graphics();
    const x0 = t.x - t.w / 2 + 0.02, x1 = t.x + t.w / 2 - 0.02, z0 = t.z - t.d / 2 + 0.02, z1 = t.z + t.d / 2 - 0.02;
    wall(sides, x0, z1, x1, z1, 0, TH, st.tileSide);
    wall(sides, x1, z1, x1, z0, 0, TH, mixHex(st.tileSide, '#000000', 0.12));
    const plane = new Container(); plane.setFromMatrix(planeMatrix(TH));
    const top = new Sprite(Texture.WHITE); top.anchor.set(0.5);
    const frame = new Graphics();
    plane.addChild(top, frame);
    root.addChild(sides, plane);
    tileLayer.addChild(root);
    tiles[i] = { root, sides, plane, top, frame, info, st: { owned: null, price: info.sub, dim: false, pick: false, chosen: false, target: false, fest: false, rfest: false, mono: null, flash: 0, step: 0, lift: 0, fc: null, fo: 0 } };
    drawTile(i);
  });
}
const TEXW = 256, TEXH = 372;
async function drawTile(i) {
  const T = tiles[i], info = T.info, st = T.st, t = TILE[i];
  const corner = t.side === 'c';
  const Wc = corner ? 372 : 256, Hc = 372, R = 1.5;
  const [c, g] = canvas(Wc * R, Hc * R); g.scale(R, R);
  const BG = { city: ['#ffffff', '#f7f1e6'], resort: ['#fff6dc', '#fde9b8'], chance: ['#fff3f6', '#ffd3e1'], tax: ['#f6f6f6', '#dcdcdc'],
    start: ['#fff7c7', '#ffd76a'], island: ['#d7fbff', '#8fdcea'], festival: ['#ffe0f0', '#ff9ccb'], airport: ['#e3efff', '#9cc2ff'] }[info.type] || ['#fff', '#eee'];
  const bg = g.createLinearGradient(0, 0, Wc, Hc); bg.addColorStop(0, BG[0]); bg.addColorStop(1, BG[1]);
  g.fillStyle = bg; rr(g, 0, 0, Wc, Hc, 22); g.fill();
  if (st.owned) { g.fillStyle = st.owned + '2e'; rr(g, 0, 0, Wc, Hc, 22); g.fill(); }
  if (info.type === 'resort') {
    const sea = g.createLinearGradient(0, 0, 0, 92); sea.addColorStop(0, '#2a8fc8'); sea.addColorStop(1, '#8fdcf5');
    g.save(); rr(g, 0, 0, Wc, Hc, 22); g.clip(); g.fillStyle = sea; g.fillRect(0, 0, Wc, 92);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 4;
    for (let y = 18; y < 90; y += 22) { g.beginPath(); for (let x = 0; x <= Wc; x += 10) g.lineTo(x, y + Math.sin(x / 14 + y) * 3); g.stroke(); }
    g.fillStyle = '#fffaf0'; g.fillRect(0, 90, Wc, 8); g.restore();
  } else if (info.band) {
    const bd = g.createLinearGradient(0, 0, 0, 54); bd.addColorStop(0, info.band); bd.addColorStop(1, mixHex(info.band, '#000000', 0.18));
    g.save(); rr(g, 0, 0, Wc, Hc, 22); g.clip(); g.fillStyle = bd; g.fillRect(0, 0, Wc, 54); g.restore();
    if (st.mono) { g.fillStyle = 'rgba(255,255,255,.95)'; g.font = `900 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', Wc / 2, 29); }
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (corner) {
    if (info.icon) { const im = await loadImg(info.icon); if (im) g.drawImage(im, Wc / 2 - 80, 40, 160, 160); }
    g.fillStyle = '#3a2a1a'; const s = fitText(g, info.name, Wc - 30, 60, 900); g.font = `900 ${s}px ${FONT}`; g.fillText(info.name, Wc / 2, 252);
    g.fillStyle = '#5b4630'; const s2 = fitText(g, info.sub, Wc - 30, 36, 700); g.font = `700 ${s2}px ${FONT}`; g.fillText(info.sub, Wc / 2, 305);
  } else {
    if (info.icon && info.type !== 'city' && info.type !== 'resort') { const im = await loadImg(info.icon); if (im) g.drawImage(im, Wc / 2 - 54, 70, 108, 108); }
    const ln = lines(g, info.name, Wc - 28, 40);
    const size = Math.min(...ln.map((l) => fitText(g, l, Wc - 20, ln.length > 1 ? 42 : 52)));
    g.font = `800 ${size}px ${FONT}`; g.fillStyle = '#2b2118';
    const y0 = ln.length > 1 ? 222 : 240;
    ln.forEach((l, k) => g.fillText(l, Wc / 2, y0 + k * (size + 4)));
    const price = st.price || info.sub;
    g.fillStyle = st.owned ? mixHex(st.owned, '#000000', 0.25) : '#4a3d2e';
    const ps = fitText(g, price, Wc - 16, st.owned ? 66 : 56, 900); g.font = `900 ${ps}px ${FONT}`;
    g.fillText(price, Wc / 2, 318);
  }
  if (st.owned) { g.strokeStyle = st.owned; g.lineWidth = 14; rr(g, 7, 7, Wc - 14, Hc - 14, 20); g.stroke(); }
  const old = T.top.texture;
  T.top.texture = texOf(c);
  // trục x của ảnh -> chiều chữ (along), trục y -> phía gần người xem (-far)
  const sx = (t.alen - 0.04) / (Wc * R), sy = (t.dlen - 0.04) / (Hc * R);
  T.top.setFromMatrix(new Matrix(t.along.x * sx, t.along.z * sx, -t.far.x * sy, -t.far.z * sy, t.x, t.z));
  if (old && old !== Texture.WHITE) old.destroy(true);
  drawFrame(i);
}
function drawFrame(i) {
  const T = tiles[i], t = TILE[i], f = T.frame;
  f.clear();
  if (!T.st.fc) return;
  const w = t.w - 0.08, d = t.d - 0.08;
  f.roundRect(t.x - w / 2, t.z - d / 2, w, d, 0.1).stroke({ width: 0.07, color: T.st.fc });
  f.roundRect(t.x - w / 2, t.z - d / 2, w, d, 0.1).fill({ color: T.st.fc, alpha: 0.12 });
}
export function updateTile(i, u) {
  const T = tiles[i]; if (!T) return;
  const st = T.st;
  const redraw = u.owned !== st.owned || u.price !== st.price || !!u.mono !== !!st.mono;
  Object.assign(st, { owned: u.owned, price: u.price, mono: !!u.mono, fest: !!u.fest, rfest: !!u.rfest });
  if (redraw) drawTile(i);
}
export function setPicks(list) {
  const set = list ? new Set(list) : null;
  tiles.forEach((T, i) => { T.st.pick = !!set && set.has(i); T.st.dim = !!set && set.size > 0 && !set.has(i); });
}
export function setChosen(list) { const s = new Set(list || []); tiles.forEach((T, i) => { T.st.chosen = s.has(i); }); }
export function stepFlash(i) { if (tiles[i]) tiles[i].st.step = 1; }
export function flashTile(i) { if (tiles[i]) tiles[i].st.flash = 1; }
function updateTiles(t, dt) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  tiles.forEach((T, i) => {
    const s = T.st;
    s.step = Math.max(0, s.step - dt * 2.2); s.flash = Math.max(0, s.flash - dt * 1.6);
    let fc = null, fo = 0;
    if (s.target) { fc = '#ffd000'; fo = 0.75 + 0.25 * pulse; }
    else if (s.chosen) { fc = '#1f9d55'; fo = 1; }
    else if (s.pick) { fc = '#ffc800'; fo = 0.9; }
    else if (s.fest) { fc = '#ff5fa2'; fo = 0.9; }
    else if (s.rfest) { fc = '#2fbf6c'; fo = 0.75; }
    if (s.step > 0) { fc = '#fff2a0'; fo = Math.max(fo, s.step); }
    if (fc !== s.fc) { s.fc = fc; drawFrame(i); }
    s.fo += (fo - s.fo) * Math.min(1, dt * 12);
    T.frame.alpha = s.fo;
    const lift = (s.target ? 0.08 + 0.05 * pulse : 0) + s.flash * 0.12 + s.step * 0.05 + (s.pick ? 0.04 : 0);
    s.lift += (lift - s.lift) * Math.min(1, dt * 14);
    T.root.y = -s.lift * COS;
    const tint = s.dim ? 0x5e5a70 : s.flash > 0 ? 0xffffff : 0xffffff;
    T.top.tint = tint; T.sides.tint = s.dim ? 0x5e5a70 : 0xffffff;
  });
}

// ======================= nhà / công trình =======================
function bldName(info, rot) {
  const o = ((info.owner % 4) + 4) % 4;
  if (info.type === 'resort') return `r_${o}_${rot}`;
  if (!info.lvl) return `f_${o}`;
  return `b${Math.min(4, info.lvl)}_${o}_${rot}`;
}
function label(text, { bg = '#ffd34d', fg = '#5a2a00', border = '#ffffff', size = 34 } = {}) {
  const c = new Container();
  const tx = new Text({ text, style: { fontFamily: FONT, fontWeight: '900', fontSize: size, fill: fg } });
  tx.anchor.set(0.5);
  const w = tx.width + size * 1.2, h = size * 1.55;
  const g = new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(bg).stroke({ width: size * 0.16, color: border });
  c.addChild(g, tx);
  return c;
}
export function setBuilding(i, info) {
  const key = info ? `${info.owner}|${info.lvl}|${info.festMult || 0}` : '';
  const cur = buildings[i];
  const prevKey = cur?.key || '';
  if (prevKey === key) return { prev: prevKey };
  const [po, pl] = prevKey.split('|');
  const sameModel = info && po === String(info.owner) && pl === String(info.lvl);
  if (sameModel) { setFestLabel(cur, info.festMult); cur.key = key; return { prev: prevKey }; }
  if (cur) cur.node.destroy({ children: true });
  buildings[i] = null;
  if (!info) return { prev: prevKey };
  const t = TILE[i];
  const p = tp(i, 0, info.type === 'resort' ? 0.32 : 0.3, TH);
  const node = new Container();
  const s = spr('bld', bldName(info, t.rot)) || new Sprite();
  node.addChild(s);
  const [sx, sy] = px(p.x, p.y, p.z); node.position.set(sx, sy); node.zIndex = depth(p.x, p.z);
  objLayer.addChild(node);
  const b = { node, s, key, p, t0: performance.now(), anim: po === String(info.owner) && +pl < info.lvl ? 'up' : 'grow', fest: null, shakeUntil: 0, flames: null };
  buildings[i] = b;
  setFestLabel(b, info.festMult);
  return { prev: prevKey, upgraded: b.anim === 'up' };
}
function setFestLabel(b, mult) {
  if (b.fest) { b.fest.destroy({ children: true }); b.fest = null; }
  if (!mult) return;
  const lb = label(`🎆 LỄ HỘI ×${mult}`, { bg: '#ff5fa2', fg: '#ffffff', size: 30 });
  lb.scale.set(1 / 120);
  const f = b.s.texture.frame; lb.y = -(f.height * b.s.anchor.y) / K - 0.2;
  b.node.addChild(lb); b.fest = lb;
}
export const buildingKey = (i) => buildings[i]?.key || '';
const flameTex = () => radialTex([[0, 'rgba(255,255,210,1)'], [0.35, 'rgba(255,170,40,.95)'], [0.7, 'rgba(230,60,20,.55)'], [1, 'rgba(200,30,0,0)']]);
const smokeTex = () => radialTex([[0, 'rgba(255,255,255,.95)'], [1, 'rgba(255,255,255,0)']]);
export function fxBurn(i, on) {
  const b = buildings[i]; if (!b) return;
  if (on && !b.flames) {
    const fl = new Container();
    for (let k = 0; k < 6; k++) { const s = new Sprite(flameTex()); s.anchor.set(0.5, 0.8); s.blendMode = 'add'; s.position.set(rnd(-0.22, 0.22), -rnd(0.1, 0.5)); s.width = rnd(0.25, 0.4); s.height = s.width * 1.5; s.flick = Math.random() * 6; s.h0 = s.height; fl.addChild(s); }
    b.node.addChild(fl); b.flames = fl;
    b.s.tint = 0x8a5040;
  } else if (!on && b.flames) { b.flames.destroy({ children: true }); b.flames = null; b.s.tint = 0xffffff; }
}
export function fxShake(i, ms = 500) { const b = buildings[i]; if (b) b.shakeUntil = performance.now() + ms; }
export function collapse(i) {
  const b = buildings[i]; if (!b) return;
  b.anim = 'crumble'; b.t0 = performance.now();
  const [bx, by] = px(b.p.x, b.p.y, b.p.z);
  for (let k = 0; k < 16; k++) {
    const g = new Graphics().rect(-0.035, -0.025, 0.07, 0.05).fill(['#c9a77a', '#8a7a70', '#e9d9b8', '#b05a3a'][k % 4]);
    g.position.set(bx + rnd(-0.12, 0.12), by - rnd(0.1, 0.4)); fxLayer.addChild(g);
    const v = { x: rnd(-1.4, 1.4), y: -rnd(1.6, 3) }, spin = rnd(-12, 12), ground = by + rnd(-0.05, 0.12), born = performance.now();
    anims.add((t, dt) => {
      const age = (performance.now() - born) / 1000; v.y += 9.8 * dt; g.x += v.x * dt * 0.6; g.y += v.y * dt * 0.6; g.rotation += spin * dt;
      if (g.y > ground) { g.y = ground; v.y = -Math.abs(v.y) * 0.3; v.x *= 0.5; }
      if (age > 1.2) g.alpha = Math.max(0, 1 - (age - 1.2) * 2);
      if (age > 1.8) { g.destroy(); return false; } return true;
    });
  }
  puffs(bx, by, 9);
}
function puffs(x, y, n, color = 0xf3e8d8) {
  for (let k = 0; k < n; k++) {
    const s = new Sprite(smokeTex()); s.anchor.set(0.5); s.tint = color; s.position.set(x + rnd(-0.3, 0.3), y - 0.1); fxLayer.addChild(s);
    const v = { x: rnd(-0.4, 0.4), y: -rnd(0.3, 0.8) }, born = performance.now();
    anims.add((t, dt) => { const a = (performance.now() - born) / 1000; s.x += v.x * dt; s.y += v.y * dt; const sc = 0.25 + a * 0.8; s.width = s.height = sc; s.alpha = Math.max(0, 0.9 - a * 0.8); if (a > 1.15) { s.destroy(); return false; } return true; });
  }
}
function updateBuildings(t, dt, now) {
  buildings.forEach((b) => {
    if (!b) return;
    const s = b.s, a = (now - b.t0) / 1000, base = 1 / K;
    if (b.anim === 'grow') { const k = Math.min(1, a / 0.75), e = ease.outElastic(k); s.scale.set(base * Math.min(1.08, 0.5 + 0.5 * e), base * Math.max(0.01, e)); s.y = 0; if (k >= 1) { b.anim = null; s.scale.set(base); } }
    else if (b.anim === 'up') { const k = Math.min(1, a / 0.9), e = ease.outBack(k); s.y = -(1 - Math.min(1, k * 1.5)) * 1.8; const sq = k > 0.66 ? 1 - Math.sin(((k - 0.66) / 0.34) * Math.PI) * 0.15 : 1; s.scale.set(base * (2 - sq), base * sq * (0.7 + 0.3 * e)); if (k >= 1) { b.anim = null; s.y = 0; s.scale.set(base); } }
    else if (b.anim === 'crumble') { const k = Math.min(1, a / 0.6); s.scale.set(base * (1 + k * 0.25), base * Math.max(0.001, 1 - ease.inOut(k))); s.rotation = -k * 0.2; }
    s.x = b.shakeUntil && now < b.shakeUntil ? Math.sin(now / 22) * 0.04 : 0;
    if (b.shakeUntil && now >= b.shakeUntil) b.shakeUntil = 0;
    if (b.flames) b.flames.children.forEach((f) => { f.height = f.h0 * (0.85 + 0.25 * Math.sin(t * 18 + f.flick)); f.alpha = 0.75 + 0.25 * Math.sin(t * 23 + f.flick); });
    if (b.fest) b.fest.y += Math.sin(t * 3) * 0.0006;
  });
}

// ======================= cổng FESTIVAL =======================
export function setFestGates(list, fresh = false) {
  const want = new Set(list || []);
  for (const [i, g] of gates) if (!want.has(i)) { g.node.destroy({ children: true }); gates.delete(i); }
  for (const i of want) {
    if (gates.has(i)) continue;
    const t = TILE[i], p = tp(i, 0, 0.03, TH);
    const s = spr('gate', `gate_${t.rot}`); if (!s) continue;
    const node = new Container(); node.addChild(s);
    const [x, y] = px(p.x, p.y, p.z); node.position.set(x, y); node.zIndex = depth(p.x, p.z) - 1;
    objLayer.addChild(node);
    gates.set(i, { node, s, t0: fresh ? performance.now() : 0, ph: Math.random() * 6 });
  }
}
function updateGates(t, now) {
  for (const g of gates.values()) {
    if (g.t0) { const k = Math.min(1, (now - g.t0) / 800); g.s.scale.set(1 / K, Math.max(0.01, ease.outBack(k)) / K); if (k >= 1) g.t0 = 0; }
    g.s.skew.x = Math.sin(t * 2 + g.ph) * 0.015;
  }
}

// ======================= quân cờ (nhân vật dựng sẵn, có hoạt ảnh) =======================
const SLOTS = [[0], [-0.2, 0.2], [-0.27, 0, 0.27], [-0.33, -0.11, 0.11, 0.33]];
const FPS = { idle: 8, walkF: 12, walkB: 12, jump: 14, yes: 12, no: 12, die: 12 };
const NF = { idle: 10, walkF: 8, walkB: 8, jump: 10, yes: 10, no: 10, die: 10 };
const SCALE_CH = 1.3;
export async function setTokens(players) {
  tokens.forEach((tk) => tk.node.destroy({ children: true }));
  tokens = players.map((p, pid) => {
    const k = ((p.char ?? pid) % 8 + 8) % 8, sheet = `chr${k}`;
    const node = new Container();
    const shadow = new Graphics().ellipse(0, 0, 0.2, 0.2 * SIN).fill({ color: 0x1a1030, alpha: 0.3 });
    const ring = new Graphics().ellipse(0, 0, 0.28, 0.28 * SIN).stroke({ width: 0.045, color: p.color || '#ffd23f' });
    ring.alpha = 0;
    const body = spr(sheet, 'idle_0') || new Sprite();
    body.scale.set(SCALE_CH / K);
    node.addChild(shadow, ring, body);
    objLayer.addChild(node);
    return { node, body, ring, shadow, sheet, anim: 'idle', once: false, ft: Math.random(), flip: false, pos: { x: 0, y: TH, z: 0 }, from: null, to: null, t0: 0, dur: 0, arc: 0, cur: false, out: false, dead: false, walkEnd: 0 };
  });
}
function playAnim(tk, name, once = false) { if (tk.anim === name && !once) return; tk.anim = name; tk.once = once; tk.ft = 0; }
export function emote(pid, e) {
  const tk = tokens[pid]; if (!tk || tk.from) return;
  if (e === 'victory') playAnim(tk, Math.random() < 0.5 ? 'jump' : 'yes', true);
  else if (e === 'shock') playAnim(tk, 'no', true);
  else if (e === 'out') { tk.dead = true; playAnim(tk, 'die', true); }
}
function slotPos(tile, k, n) { const a = SLOTS[Math.min(n, 4) - 1][k] ?? 0; return tp(tile, a, tile % 8 === 0 ? 0.55 : 0.52, TH); }
export function placeToken(pid, place, opt = {}) {
  const tk = tokens[pid]; if (!tk || !place || !TILE[place.tile]) return;
  tk.out = !!place.out; tk.node.visible = !tk.out;
  const target = slotPos(place.tile, place.k, place.n);
  if (!opt.dur || !tk.to) { tk.pos = { ...target }; tk.to = target; tk.from = null; return; }
  tk.from = { ...tk.pos }; tk.to = target; tk.t0 = performance.now(); tk.dur = opt.dur; tk.arc = opt.arc ?? 0.35;
  const dx = target.x - tk.from.x, dz = target.z - tk.from.z;
  if (opt.dur > 600) playAnim(tk, 'jump');
  else if (Math.abs(dz) >= Math.abs(dx)) { playAnim(tk, dz > 0 ? 'walkF' : 'walkB'); tk.flip = dz < 0; }
  else { playAnim(tk, dx > 0 ? 'walkF' : 'walkB'); tk.flip = dx > 0; }
}
export function setCurrent(pid) { tokens.forEach((tk, i) => { tk.cur = i === pid; }); }
function updateTokens(t, now, dt) {
  tokens.forEach((tk) => {
    let hop = 0;
    if (tk.from) {
      const k = Math.min(1, (now - tk.t0) / tk.dur), e = ease.inOut(k);
      tk.pos = { x: tk.from.x + (tk.to.x - tk.from.x) * e, y: TH, z: tk.from.z + (tk.to.z - tk.from.z) * e };
      hop = Math.sin(k * Math.PI) * tk.arc;
      if (k >= 1) { tk.from = null; tk.walkEnd = now; }
    } else if (tk.walkEnd && now - tk.walkEnd > 140) { tk.walkEnd = 0; tk.flip = false; if (!tk.dead) playAnim(tk, 'idle'); }
    // khung hình
    tk.ft += dt * (FPS[tk.anim] || 10);
    const n = NF[tk.anim] || 10;
    let f = Math.floor(tk.ft);
    if (tk.once && f >= n) { if (tk.anim === 'die') f = n - 1; else { playAnim(tk, 'idle'); f = 0; } }
    setFrame(tk.body, tk.sheet, `${tk.anim}_${((f % n) + n) % n}`);
    tk.body.scale.set((tk.flip ? -1 : 1) * SCALE_CH / K, SCALE_CH / K);
    const [x, y] = px(tk.pos.x, tk.pos.y, tk.pos.z);
    tk.node.position.set(x, y); tk.node.zIndex = depth(tk.pos.x, tk.pos.z) + 5;
    const bob = tk.cur && !tk.from ? Math.abs(Math.sin(t * 3.2)) * 0.05 : 0;
    tk.body.y = -(hop + bob) * COS;
    tk.shadow.scale.set(1 - hop * 0.6); tk.shadow.alpha = 1 - hop;
    tk.ring.alpha = tk.cur ? 0.6 + 0.35 * Math.sin(t * 5) : 0;
    tk.ring.scale.set(tk.cur ? 1 + 0.1 * Math.sin(t * 5) : 1);
  });
}

// ======================= xúc xắc =======================
function buildDice() {
  dice = [-0.42, 0.42].map((x) => {
    const node = new Container();
    const sh = new Graphics().ellipse(0, 0, 0.36, 0.36 * SIN).fill({ color: 0x1a1030, alpha: 0.28 });
    const s = spr('dice', 'd5') || new Sprite();
    node.addChild(sh, s);
    const [sx, sy] = px(x, 0.01, 0); node.position.set(sx, sy); node.zIndex = depth(x, 0);
    objLayer.addChild(node);
    return { node, s, sh, home: { x, z: 0 } };
  });
  showDice([5, 6]);
}
export function showDice(d) { dice.forEach((m, k) => { setFrame(m.s, 'dice', `d${d[k]}`); const [x, y] = px(m.home.x, 0.01, m.home.z); m.node.position.set(x, y); m.s.y = 0; m.s.rotation = 0; }); }
export function rollDice(d, dur = 1000) {
  return new Promise((res) => {
    const start = performance.now();
    const parts = dice.map((m, k) => ({ m, k, from: { x: m.home.x + rnd(-0.6, 0.6), z: m.home.z + rnd(0.9, 1.5) }, off: Math.floor(rnd(0, 16)), spin: rnd(-8, 8) }));
    anims.add(() => {
      const k = Math.min(1, (performance.now() - start) / dur), e = ease.outCubic(k);
      parts.forEach((p) => {
        const x = p.from.x + (p.m.home.x - p.from.x) * e, z = p.from.z + (p.m.home.z - p.from.z) * e;
        const b = k < 0.55 ? Math.sin((k / 0.55) * Math.PI) * 1.5 : k < 0.82 ? Math.sin(((k - 0.55) / 0.27) * Math.PI) * 0.35 : Math.sin(((k - 0.82) / 0.18) * Math.PI) * 0.08;
        const [sx, sy] = px(x, 0.01, z); p.m.node.position.set(sx, sy); p.m.node.zIndex = depth(x, z);
        p.m.s.y = -b * COS;
        p.m.sh.scale.set(1 - b * 0.35); p.m.sh.alpha = 1 - b * 0.4;
        if (k < 0.88) { setFrame(p.m.s, 'dice', `dr${(p.off + Math.floor(k * 30)) % 16}`); p.m.s.rotation = (1 - e) * p.spin; }
        else { setFrame(p.m.s, 'dice', `d${d[p.k]}`); p.m.s.rotation = 0; }
      });
      if (k >= 1) { showDice(d); res(); return false; }
      return true;
    });
  });
}
export function hideDice(on) { dice.forEach((m) => { m.node.visible = !on; }); }

// ======================= đánh dấu ô đích =======================
function buildMarker() {
  marker = new Container(); marker.visible = false;
  const ring = new Container(); ring.setFromMatrix(planeMatrix(0));
  const rg = new Graphics().circle(0, 0, 0.42).stroke({ width: 0.06, color: '#ffd000' }).circle(0, 0, 0.42).fill({ color: '#ffd000', alpha: 0.15 });
  ring.addChild(rg);
  marker.addChild(ring); marker.ring = rg;
  overLayer.addChild(marker);
}
export function setTarget(i, label_) {
  if (i < 0) { marker.visible = false; tiles.forEach((T) => { T.st.target = false; }); return; }
  tiles.forEach((T, k) => { T.st.target = k === i; });
  const p = tp(i, 0, 0.5, TH + 0.05);
  const [x, y] = px(p.x, p.y, p.z); marker.position.set(x, y);
  if (marker.lb) marker.lb.destroy({ children: true });
  const lb = label(String(label_), { bg: '#ffd000', fg: '#6a3b00', size: 44 }); lb.scale.set(1 / 110); lb.y = -1.05;
  marker.addChild(lb); marker.lb = lb;
  marker.visible = true;
}
function updateMarker(t) { if (!marker?.visible) return; marker.ring.scale.set(1 + 0.12 * Math.sin(t * 7)); if (marker.lb) marker.lb.y = -1.05 - Math.abs(Math.sin(t * 5)) * 0.15; }

// ======================= đống tiền giữa bàn =======================
export function showPile(amount) {
  clearPile();
  pile = new Container(); objLayer.addChild(pile); pile.zIndex = depth(0, 0) + 2;
  const items = [];
  if (amount < 100) {
    const stacks = Math.min(4, 1 + Math.floor(amount / 30));
    const P = [[0, 0], [0.42, -0.2], [-0.4, 0.22], [0.12, 0.45]];
    for (let s = 0; s < stacks; s++) for (let j = 0; j < 3 + ((Math.round(amount) + s * 3) % 5); j++) items.push(['coin', P[s][0], j * 0.055, P[s][1]]);
  } else if (amount < 600) {
    const n = Math.min(12, Math.max(2, Math.round(amount / 50)));
    const P = [[-0.36, 0, 0], [0.36, 0, 0], [-0.36, -0.38, 0], [0.36, -0.38, 0], [-0.36, 0.38, 0], [0.36, 0.38, 0], [-0.36, -0.19, 1], [0.36, -0.19, 1], [-0.36, 0.19, 1], [0.36, 0.19, 1], [-0.36, 0, 2], [0.36, 0, 2]];
    for (let k = 0; k < n; k++) items.push(['cash', P[k][0], P[k][2] * 0.14, P[k][1]]);
  } else {
    const n = Math.min(9, 2 + Math.floor(amount / 300));
    const P = [[0, -0.16, 0], [0, 0.16, 0], [0, -0.48, 0], [0, 0.48, 0], [0, 0, 1], [0, -0.32, 1], [0, 0.32, 1], [0, -0.16, 2], [0, 0.16, 2]];
    for (let k = 0; k < n; k++) items.push(['bar', P[k][0] - 0.22, P[k][2] * 0.17, P[k][1]]);
    for (let j = 0; j < 6; j++) items.push(['coin', 0.62, j * 0.055, -0.2]);
  }
  // vẽ từ xa tới gần, từ dưới lên trên
  items.sort((a, b) => a[2] - b[2] || (a[1] + a[3]) - (b[1] + b[3]));
  const start = performance.now();
  let top = 0;
  items.forEach(([name, x, y, z], k) => {
    const s = spr('money', name); if (!s) return;
    const [sx, sy] = px(x, y, z); s.position.set(sx, sy - 3); pile.addChild(s); top = Math.max(top, y);
    const delay = k * 55;
    anims.add(() => { const a = (performance.now() - start - delay) / 420; if (a < 0) { s.alpha = 0; return true; } s.alpha = 1; const k2 = Math.min(1, a); s.y = sy - 3 * (1 - ease.outCubic(k2)); if (k2 >= 1) { s.y = sy; return false; } return true; });
  });
  hideDice(true);
  return screen({ x: 0, y: top + 0.7, z: 0 });
}
export function clearPile() { if (pile) { pile.destroy({ children: true }); pile = null; } hideDice(false); }

// ======================= cảnh nền: đảo nổi + cây cối theo theme =======================
const SCENE = {
  midnight: { ground: '#2c3d73', rim: '#1d2852', dirt: '#141b3d', trees: 5, tints: 1, small: 6, lamps: true, fx: 'fireflies', water: false },
  wood: { ground: '#a8c45e', rim: '#86a24a', dirt: '#7a5634', trees: 5, tints: 1, small: 7, fx: 'leaves', water: false },
  ocean: { ground: '#f2dda4', rim: '#e1c47f', dirt: '#c9a464', trees: 4, tints: 1, small: 5, fx: 'sparkles', water: true },
  sakura: { ground: '#b7e39a', rim: '#93c77a', dirt: '#8a6b5a', trees: 4, tints: 3, small: 7, fx: 'petals', water: false },
};
let scenery = null, particles = [];
function buildScenery() {
  scenery?.destroy({ children: true }); particles = [];
  objLayer.children.filter((c) => c.isDecor).forEach((c) => c.destroy({ children: true }));
  scenery = new Container(); sceneryLayer.addChild(scenery);
  const P = SCENE[theme] || SCENE.midnight, sheet = `nat_${theme}`;
  const R = 13.5, top = -0.95;
  if (P.water) {
    const wc = new Container(); wc.setFromMatrix(planeMatrix(top - 0.5));
    const wg = new FillGradient({ type: 'radial', center: { x: 0.5, y: 0.5 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5, colorStops: [{ offset: 0, color: '#2fc6d6' }, { offset: 0.6, color: '#14a7c0' }, { offset: 1, color: 'rgba(18,140,180,0)' }], textureSpace: 'local' });
    wc.addChild(new Graphics().circle(0, 0, 40).fill(wg));
    const waves = new Graphics(); wc.addChild(waves); scenery.waves = waves;
    scenery.addChild(wc);
    const shore = new Container(); shore.setFromMatrix(planeMatrix(top - 0.45));
    shore.addChild(new Graphics().circle(0, 0, R + 1.6).fill({ color: '#f6e7bd' }).circle(0, 0, R + 1.6).stroke({ width: 0.18, color: '#ffffff', alpha: 0.7 }));
    scenery.addChild(shore);
  }
  // thân đảo: hình trụ nhìn nghiêng (elip trên + phần đất phía dưới)
  const body = new Graphics();
  const ry = R * SIN, yTop = -top * COS, dep = 2.6 * COS;
  const dg = new FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: P.rim }, { offset: 0.25, color: P.dirt }, { offset: 1, color: mixHex(P.dirt, '#000000', 0.35) }], textureSpace: 'local' });
  body.moveTo(-R, yTop).lineTo(-R * 0.94, yTop + dep * 0.55).quadraticCurveTo(0, yTop + ry + dep * 1.7, R * 0.94, yTop + dep * 0.55).lineTo(R, yTop).ellipse(0, yTop, R, ry).fill(dg);
  body.ellipse(0, yTop, R, ry).fill(P.rim);
  scenery.addChild(body);
  const grass = new Container(); grass.setFromMatrix(planeMatrix(top));
  const gg = new FillGradient({ type: 'radial', center: { x: 0.5, y: 0.5 }, innerRadius: 0, outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5, colorStops: [{ offset: 0, color: mixHex(P.ground, '#ffffff', 0.12) }, { offset: 1, color: P.ground }], textureSpace: 'local' });
  grass.addChild(new Graphics().circle(0, 0, R - 0.2).fill(gg));
  scenery.addChild(grass);
  // cây cối, đồ trang trí (giống buildTD của bản 3D)
  const rnd2 = seeded({ midnight: 7, wood: 11, ocean: 23, sakura: 31 }[theme] || 5);
  const half = W / 2 + 0.75, spots = [];
  for (let tries = 0; spots.length < 64 && tries < 2000; tries++) {
    const a = rnd2() * Math.PI * 2, r = half + 0.4 + rnd2() * (R - half - 1.1);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < half && Math.abs(z) < half) continue;
    if (Math.hypot(x, z) > R - 0.6) continue;
    if (spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 1.05)) continue;
    spots.push([x, z]);
  }
  spots.forEach(([x, z], k) => {
    const front = x + z > 3.5, tall = !front && k % 3 !== 2;
    const name = tall ? `t${k % P.trees}_${k % P.tints}` : `s${k % P.small}`;
    const s = spr(sheet, name); if (!s) return;
    const sc = tall ? 0.8 + rnd2() * 0.5 : 0.7 + rnd2() * 0.5;
    s.scale.set((rnd2() < 0.5 ? -1 : 1) * sc / K, sc / K);
    const node = new Container(); node.addChild(s); node.isDecor = true; node.sway = tall ? rnd2() * 6 : null; node.spr = s;
    const [sx, sy] = px(x, top, z); node.position.set(sx, sy); node.zIndex = depth(x, z) - 100000;
    // bóng mềm dưới gốc (nằm ở lớp mặt đất, dưới bàn cờ)
    const r = (tall ? 0.75 : 0.35) * sc, shd = new Sprite(radialTex([[0, 'rgba(30,15,45,.38)'], [0.6, 'rgba(30,15,45,.16)'], [1, 'rgba(30,15,45,0)']]));
    shd.anchor.set(0.5); shd.width = r * 2.6; shd.height = r * 2.6 * SIN; shd.position.set(sx + r * 0.45, sy - r * 0.12); scenery.addChild(shd);
    objLayer.addChild(node);
  });
  if (P.lamps) [[-1, -1], [1, -1], [-1, 1]].forEach(([a, b]) => {
    const x = a * (half + 0.55), z = b * (half + 0.55);
    const s = spr(sheet, 'lamp'); if (!s) return;
    const node = new Container(); node.isDecor = true;
    const glow = new Sprite(radialTex([[0, 'rgba(255,214,120,.75)'], [0.4, 'rgba(255,190,90,.25)'], [1, 'rgba(255,190,90,0)']])); glow.anchor.set(0.5); glow.width = glow.height = 1.3; glow.y = -1.75 * COS; glow.blendMode = 'add';
    const pool = new Sprite(radialTex([[0, 'rgba(255,210,120,.35)'], [1, 'rgba(255,210,120,0)']])); pool.anchor.set(0.5); pool.width = 2.4; pool.height = 2.4 * SIN; pool.blendMode = 'add';
    node.addChild(pool, s, glow); node.glow = glow;
    const [sx, sy] = px(x, top, z); node.position.set(sx, sy); node.zIndex = depth(x, z) - 100000;
    objLayer.addChild(node);
  });
  // hạt bay: cánh hoa / đom đóm / lá thu / lấp lánh
  for (let k = 0; k < 70; k++) particles.push(makeParticle(P.fx, true));
}
function makeParticle(kind, init) {
  let tex, tint = 0xffffff, size = 0.12;
  if (kind === 'petals') { tex = radialTex([[0, 'rgba(255,220,235,1)'], [0.6, 'rgba(255,170,205,.9)'], [1, 'rgba(255,170,205,0)']], 32); size = 0.16; }
  else if (kind === 'fireflies') { tex = radialTex([[0, 'rgba(255,250,200,1)'], [0.3, 'rgba(200,255,150,.7)'], [1, 'rgba(150,255,120,0)']], 32); size = 0.22; }
  else if (kind === 'leaves') { tex = radialTex([[0, 'rgba(255,190,90,1)'], [0.6, 'rgba(230,120,40,.9)'], [1, 'rgba(230,120,40,0)']], 32); size = 0.17; }
  else { tex = radialTex([[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(200,250,255,.6)'], [1, 'rgba(200,250,255,0)']], 32); size = 0.14; }
  const s = new Sprite(tex); s.anchor.set(0.5); s.width = s.height = size * rnd(0.7, 1.3); s.tint = tint;
  if (kind === 'fireflies' || kind === 'sparkles') s.blendMode = 'add';
  fxLayer.addChild(s);
  const p = { s, kind, x: rnd(-15, 15), y: init ? rnd(-1, 7) : 7, z: rnd(-15, 15), ph: rnd(0, 6), sp: rnd(0.3, 0.9) };
  if (kind === 'fireflies' || kind === 'sparkles') p.y = rnd(-0.6, 2.5);
  return p;
}
function updateScenery(t, dt) {
  objLayer.children.forEach((n) => { if (n.isDecor && n.sway != null) n.spr.skew.x = Math.sin(t * 1.3 + n.sway) * 0.03; if (n.glow) n.glow.alpha = 0.8 + 0.2 * Math.sin(t * 2.5); });
  if (scenery?.waves) {
    const w = scenery.waves; w.clear();
    for (let r = 15; r < 38; r += 3.2) { const rr2 = r + ((t * 0.6) % 3.2); w.circle(0, 0, rr2).stroke({ width: 0.06, color: '#ffffff', alpha: 0.18 * (1 - (rr2 - 15) / 23) }); }
  }
  particles.forEach((p) => {
    if (p.kind === 'petals' || p.kind === 'leaves') {
      p.y -= p.sp * dt; p.x += (Math.sin(t * 0.8 + p.ph) * 0.5 - 0.3) * dt; p.z += 0.25 * dt;
      if (p.y < -1) { p.y = 7; p.x = rnd(-15, 15); p.z = rnd(-15, 12); }
      p.s.rotation = t * p.sp * 2 + p.ph; p.s.alpha = 0.95;
    } else {
      p.x += Math.sin(t * 0.7 + p.ph) * 0.15 * dt; p.z += Math.cos(t * 0.6 + p.ph) * 0.15 * dt; p.y += Math.sin(t * 1.1 + p.ph) * 0.1 * dt;
      p.s.alpha = p.kind === 'fireflies' ? 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + p.ph * 3)) : Math.max(0, Math.sin(t * 3 + p.ph * 5)) ** 3;
    }
    const [x, y] = px(p.x, p.y, p.z); p.s.position.set(x, y);
  });
}
export function setTheme(name) {
  theme = SCENE[name] ? name : 'midnight';
  if (!app) return;
  buildBoardBase();
  const st = STYLE[theme];
  tiles.forEach((T, i) => {
    const t = TILE[i]; T.sides.clear();
    const x0 = t.x - t.w / 2 + 0.02, x1 = t.x + t.w / 2 - 0.02, z0 = t.z - t.d / 2 + 0.02, z1 = t.z + t.d / 2 - 0.02;
    wall(T.sides, x0, z1, x1, z1, 0, TH, st.tileSide); wall(T.sides, x1, z1, x1, z0, 0, TH, mixHex(st.tileSide, '#000000', 0.12));
  });
  buildScenery();
}

// ======================= vòng lặp =======================
let last = performance.now();
function loop() {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (mode === 'home') return;
  const t = nowS();
  updateScenery(t, dt);
  updateTiles(t, dt);
  updateBuildings(t, dt, now);
  updateGates(t, now);
  updateTokens(t, now, dt);
  updateMarker(t);
  for (const f of anims) if (f(t, dt) === false) anims.delete(f);
}

// ======================= toạ độ màn hình + chọn ô =======================
export const tileScreen = (i) => screen(tp(i, 0, 0.5, TH + 0.2));
export const centerScreen = () => screen({ x: 0, y: 0.4, z: 0 });
export function pickTile(x, y) {
  // màn hình -> mặt phẳng mặt ô (độ cao TH)
  const sx = (x - OX) / S, sy = (y - OY) / S + TH * COS;
  const a = sx / C, b = sy / (C * SIN);           // a = x - z, b = x + z
  const wx = (a + b) / 2, wz = (b - a) / 2;
  for (let i = 0; i < 32; i++) { const t = TILE[i]; if (Math.abs(wx - t.x) <= t.w / 2 && Math.abs(wz - t.z) <= t.d / 2) return i; }
  return -1;
}
export { W as BOARD_W };
