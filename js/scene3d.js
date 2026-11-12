// Bộ vẽ 3D (Three.js / WebGL): bàn cờ, ô đất, nhà, quân cờ, xúc xắc, cổng Festival, cảnh nền theo theme.
// app.js chỉ gọi các hàm xuất ra ở cuối file; luật chơi không phụ thuộc vào file này.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

// ======================= hình học bàn cờ =======================
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
// Khung toạ độ của ô: along = chiều chữ chạy, far = phía xa người xem. Mọi ô: nửa gần người xem để chữ, nửa xa để nhà.
const TILE = [];
for (let i = 0; i < 32; i++) {
  const [r, c] = gridPos(i), side = sideOf(i);
  const col = side === 'l' || side === 'r';
  TILE.push({
    x: cellC(c), z: cellC(r), w: SIZES[c - 1], d: SIZES[r - 1], side,
    along: col ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(1, 0, 0),
    far: col ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 0, -1),
    alen: side === 'c' ? CORNER : 1, dlen: side === 'c' ? CORNER : CORNER,
    rotY: col ? Math.PI / 2 : 0,
  });
}
/** điểm trên mặt ô: a theo chiều chữ (-0.5..0.5), s từ mép xa (0) tới mép gần (1) */
function tp(i, a = 0, s = 0.5, y = TH) {
  const t = TILE[i];
  return new THREE.Vector3(t.x, y, t.z).addScaledVector(t.along, a * t.alen).addScaledVector(t.far, t.dlen * (0.5 - s));
}

// ======================= tiện ích =======================
const rnd = (a, b) => a + Math.random() * (b - a);
const ease = { outBack: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2, outCubic: (t) => 1 - (1 - t) ** 3, inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1) };
const col = (c) => new THREE.Color(c);
const mixHex = (a, b, t) => col(a).lerp(col(b), t);
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texOf(c, { repeat } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAXANI;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
let MAXANI = 4;
const FONT = '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif';
function fitText(g, text, maxW, size, weight = 800) {
  let s = size;
  do { g.font = `${weight} ${s}px ${FONT}`; if (g.measureText(text).width <= maxW) break; s -= 2; } while (s > 10);
  return s;
}
// tách tên dài thành 2 dòng
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
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  return imgCache.get(src);
}
const matCache = new Map();
function mat(key, make) { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); }
const std = (c, o = {}) => mat(`std|${c}|${JSON.stringify(o)}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, ...o }));

// ======================= biến toàn cục =======================
let renderer, scene, camera, clock, raycaster, host;
let boardGroup, tilesGroup, bldGroup, tokenGroup, fxGroup, sceneryGroup;
const tiles = [];          // { body, top, frame, info, state }
const buildings = [];      // Group | null
const gates = new Map();   // ô -> cổng Festival
let tokens = [];
let dice = [];
let markerGrp = null, markerLabel = null;
let pileGrp = null;
let theme = 'sakura', mode = 'home', isFlat = false;
let stageEl = null, onPickCb = null;
const anims = new Set();   // hàm cập nhật mỗi frame: (t, dt) => boolean (false = xong)
let sky, sun, hemi, water = null, curTheme = null;
const THEMES = {};

// ======================= khởi tạo =======================
export async function init({ stage, onTileClick }) {
  stageEl = stage; onPickCb = onTileClick;
  host = document.createElement('canvas');
  host.id = 'gl';
  document.body.prepend(host);
  renderer = new THREE.WebGLRenderer({ canvas: host, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(max-width: 900px)').matches ? 1.75 : 2));
  MAXANI = Math.min(16, renderer.capabilities.getMaxAnisotropy() || 4);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 900);
  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();

  // ánh sáng
  hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.25);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-9, 16, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(isMobile() ? 1024 : 2048, isMobile() ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  sceneryGroup = new THREE.Group(); scene.add(sceneryGroup);
  boardGroup = new THREE.Group(); scene.add(boardGroup);
  tilesGroup = new THREE.Group(); boardGroup.add(tilesGroup);
  bldGroup = new THREE.Group(); boardGroup.add(bldGroup);
  tokenGroup = new THREE.Group(); boardGroup.add(tokenGroup);
  fxGroup = new THREE.Group(); boardGroup.add(fxGroup);

  buildSky();
  buildBoardBase();
  buildDice();
  buildMarker();
  try { await document.fonts.load(`800 40px ${FONT}`); await document.fonts.ready; } catch {}

  const mq = matchMedia('(max-width: 900px), (orientation: portrait)');
  isFlat = mq.matches;
  mq.addEventListener?.('change', () => { isFlat = mq.matches; fitCamera(); });
  addEventListener('resize', () => fitCamera());
  fitCamera();
  renderer.setAnimationLoop(loop);
  document.body.classList.add('gl');
  return true;
}
const isMobile = () => matchMedia('(max-width: 900px)').matches;

// ======================= bầu trời =======================
function buildSky() {
  const g = new THREE.SphereGeometry(600, 32, 16);
  sky = new THREE.Mesh(g, new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: col('#2f86d4') }, mid: { value: col('#9ad6f7') }, bot: { value: col('#fff3dc') }, sunDir: { value: new THREE.Vector3(-0.4, 0.35, -1).normalize() }, sunCol: { value: col('#fffbe6') }, sunSize: { value: 0.9985 } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, mid, bot, sunDir, sunCol; uniform float sunSize; varying vec3 vD;
      void main(){ float y = vD.y; vec3 c = y > 0.08 ? mix(mid, top, smoothstep(0.08, 0.55, y)) : mix(bot, mid, smoothstep(-0.05, 0.08, y));
        float s = dot(normalize(vD), normalize(sunDir));
        c += sunCol * (smoothstep(sunSize, 1.0, s) * 1.2 + pow(max(s, 0.), 64.) * 0.35 + pow(max(s, 0.), 6.) * 0.12);
        gl_FragColor = vec4(c, 1.); }`,
  }));
  scene.add(sky);
}

// ======================= đế bàn cờ =======================
let baseTop, baseSide, trimMat, courtyard;
function buildBoardBase() {
  baseTop = new THREE.MeshStandardMaterial({ color: '#f6efe0', roughness: 0.6 });
  baseSide = new THREE.MeshStandardMaterial({ color: '#e9d7b4', roughness: 0.7 });
  const slab = new THREE.Mesh(new RoundedBoxGeometry(W + 0.7, 0.9, W + 0.7, 4, 0.22), [baseSide, baseSide, baseTop, baseSide, baseSide, baseSide]);
  slab.position.y = -0.45; slab.receiveShadow = true; slab.castShadow = true;
  boardGroup.add(slab);
  trimMat = new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.3, metalness: 0.8 });
  const trim = new THREE.Mesh(new RoundedBoxGeometry(W + 0.82, 0.12, W + 0.82, 3, 0.06), trimMat);
  trim.position.y = -0.62; boardGroup.add(trim);
  const ped = new THREE.Mesh(new RoundedBoxGeometry(W + 0.95, 2.4, W + 0.95, 4, 0.3), new THREE.MeshStandardMaterial({ color: '#cbb796', roughness: 0.9 }));
  ped.name = 'pedestal'; ped.position.y = -2.0; ped.receiveShadow = true; boardGroup.add(ped);
  const inner = W - 2 * CORNER - 2 * GAP - 0.1;
  courtyard = new THREE.Mesh(new THREE.PlaneGeometry(inner, inner), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
  courtyard.rotation.x = -Math.PI / 2; courtyard.position.y = 0.012; courtyard.receiveShadow = true;
  boardGroup.add(courtyard);
}
function courtyardTexture(kind) {
  const [c, g] = canvas(1024, 1024);
  if (kind === 'halong') {
    const gr = g.createLinearGradient(0, 0, 1024, 1024); gr.addColorStop(0, '#7fd6ec'); gr.addColorStop(1, '#2d9cc6'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 4;
    for (let y = 20; y < 1024; y += 34) { g.beginPath(); for (let x = 0; x <= 1024; x += 16) g.lineTo(x, y + Math.sin(x / 40 + y) * 5); g.stroke(); }
  } else if (kind === 'lantern') {
    g.fillStyle = '#8e1b2a'; g.fillRect(0, 0, 1024, 1024);
    g.strokeStyle = 'rgba(255,205,90,.35)'; g.lineWidth = 3;
    for (let k = 0; k < 1024; k += 64) for (let j = 0; j < 1024; j += 64) { g.beginPath(); g.arc(k + 32, j + 32, 22, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(k + 32, j + 32, 10, 0, Math.PI * 2); g.stroke(); }
    const rg = g.createRadialGradient(512, 512, 50, 512, 512, 700); rg.addColorStop(0, 'rgba(255,190,80,.35)'); rg.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = rg; g.fillRect(0, 0, 1024, 1024);
  } else {
    const gr = g.createLinearGradient(0, 0, 1024, 1024); gr.addColorStop(0, '#b6ec7a'); gr.addColorStop(1, '#7fcf4a'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 1024);
    for (let k = 0; k < 2600; k++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,110,20'},${rnd(0.04, 0.12)})`; g.fillRect(rnd(0, 1024), rnd(0, 1024), 3, rnd(6, 14)); }
    for (let k = 0; k < 140; k++) { g.save(); g.translate(rnd(0, 1024), rnd(0, 1024)); g.rotate(rnd(0, 6.3)); g.fillStyle = ['#ffd1e6', '#ffb7d5', '#fff0f6'][k % 3]; g.beginPath(); g.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  }
  return texOf(c);
}

// ======================= ô đất =======================
const tileTopGeo = { side: new THREE.PlaneGeometry(1, CORNER), corner: new THREE.PlaneGeometry(CORNER, CORNER) };
const frameTex = (() => { const [c, g] = canvas(256, 372); g.strokeStyle = '#fff'; g.lineWidth = 18; rr(g, 9, 9, 238, 354, 26); g.stroke(); return texOf(c); })();
const frameTexC = (() => { const [c, g] = canvas(372, 372); g.strokeStyle = '#fff'; g.lineWidth = 18; rr(g, 9, 9, 354, 354, 30); g.stroke(); return texOf(c); })();
export function buildTiles(list) {
  // list[i] = { type, name, sub, band, icon }
  list.forEach((info, i) => {
    const t = TILE[i];
    const corner = t.side === 'c';
    const sideMat = new THREE.MeshStandardMaterial({ color: '#efe4cc', roughness: 0.7 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(t.w, TH, t.d, 2, 0.05), sideMat);
    body.position.set(t.x, TH / 2, t.z); body.receiveShadow = true; body.castShadow = true; body.userData.tile = i;
    const topMat = new THREE.MeshStandardMaterial({ roughness: 0.65, color: 0xffffff });
    const top = new THREE.Mesh(corner ? tileTopGeo.corner : tileTopGeo.side, topMat);
    top.rotation.set(-Math.PI / 2, 0, 0); top.rotation.order = 'YXZ'; top.rotation.y = t.rotY;
    top.position.set(t.x, TH + 0.002, t.z); top.receiveShadow = true;
    const frame = new THREE.Mesh(corner ? tileTopGeo.corner : tileTopGeo.side, new THREE.MeshBasicMaterial({ map: corner ? frameTexC : frameTex, transparent: true, opacity: 0, depthWrite: false, color: '#ffd000' }));
    frame.rotation.copy(top.rotation); frame.position.set(t.x, TH + 0.006, t.z); frame.renderOrder = 2;
    const grp = new THREE.Group(); grp.add(body, top, frame);
    tilesGroup.add(grp);
    tiles[i] = { grp, body, top, frame, info, st: { owned: null, price: info.sub, dim: false, pick: false, chosen: false, target: false, fest: false, rfest: false, mono: null, flash: 0, step: 0, lift: 0 } };
    drawTile(i);
  });
}
async function drawTile(i) {
  const T = tiles[i], info = T.info, st = T.st, t = TILE[i];
  const corner = t.side === 'c';
  const Wc = corner ? 372 : 256, Hc = 372;
  const [c, g] = canvas(Wc * 2, Hc * 2); g.scale(2, 2);
  // nền theo loại ô
  const BG = { city: ['#ffffff', '#f7f1e6'], resort: ['#fff6dc', '#fde9b8'], chance: ['#fff3f6', '#ffd3e1'], tax: ['#f6f6f6', '#dcdcdc'],
    start: ['#fff7c7', '#ffd76a'], island: ['#d7fbff', '#8fdcea'], festival: ['#ffe0f0', '#ff9ccb'], airport: ['#e3efff', '#9cc2ff'] }[info.type] || ['#fff', '#eee'];
  const bg = g.createLinearGradient(0, 0, Wc, Hc); bg.addColorStop(0, BG[0]); bg.addColorStop(1, BG[1]);
  g.fillStyle = bg; rr(g, 0, 0, Wc, Hc, 22); g.fill();
  if (st.owned) { g.fillStyle = st.owned + '2e'; rr(g, 0, 0, Wc, Hc, 22); g.fill(); }
  if (info.type === 'resort') {   // dải biển ở mép xa
    const sea = g.createLinearGradient(0, 0, 0, 92); sea.addColorStop(0, '#2a8fc8'); sea.addColorStop(1, '#8fdcf5');
    g.fillStyle = sea; g.fillRect(0, 0, Wc, 92);
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 4;
    for (let y = 18; y < 90; y += 22) { g.beginPath(); for (let x = 0; x <= Wc; x += 10) g.lineTo(x, y + Math.sin(x / 14 + y) * 3); g.stroke(); }
    g.fillStyle = '#fffaf0'; g.fillRect(0, 90, Wc, 8);
  } else if (info.band) {
    const bd = g.createLinearGradient(0, 0, 0, 54); bd.addColorStop(0, info.band); bd.addColorStop(1, '#' + mixHex(info.band, '#000000', 0.18).getHexString());
    g.fillStyle = bd; g.fillRect(0, 0, Wc, 54);
    if (st.mono) { g.fillStyle = 'rgba(255,255,255,.95)'; g.font = `900 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', Wc / 2, 29); }
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (corner) {
    if (info.icon) { const im = await loadImg(info.icon); if (im) g.drawImage(im, Wc / 2 - 80, 40, 160, 160); }
    g.fillStyle = '#3a2a1a'; const s = fitText(g, info.name, Wc - 30, 60); g.font = `900 ${s}px ${FONT}`; g.fillText(info.name, Wc / 2, 252);
    g.fillStyle = '#5b4630'; const s2 = fitText(g, info.sub, Wc - 30, 36, 700); g.font = `700 ${s2}px ${FONT}`; g.fillText(info.sub, Wc / 2, 305);
  } else {
    if (info.icon && info.type !== 'city' && info.type !== 'resort') { const im = await loadImg(info.icon); if (im) g.drawImage(im, Wc / 2 - 54, 70, 108, 108); }
    const ln = lines(g, info.name, Wc - 28, 40);
    const size = Math.min(...ln.map((l) => fitText(g, l, Wc - 20, ln.length > 1 ? 42 : 52)));
    g.font = `800 ${size}px ${FONT}`; g.fillStyle = '#2b2118';
    const y0 = ln.length > 1 ? 222 : 240;
    ln.forEach((l, k) => g.fillText(l, Wc / 2, y0 + k * (size + 4)));
    const price = st.price || info.sub;
    g.fillStyle = st.owned ? '#' + mixHex(st.owned, '#000000', 0.25).getHexString() : '#4a3d2e';
    const ps = fitText(g, price, Wc - 16, st.owned ? 66 : 56, 900); g.font = `900 ${ps}px ${FONT}`;
    g.fillText(price, Wc / 2, 318);
  }
  if (st.owned) { g.strokeStyle = st.owned; g.lineWidth = 14; rr(g, 7, 7, Wc - 14, Hc - 14, 20); g.stroke(); }
  const old = T.top.material.map;
  T.top.material.map = texOf(c); T.top.material.needsUpdate = true;
  old?.dispose();
}
/** cập nhật thông tin ô: { owned: màu|null, price, mono: bool, fest: bool, rfest: bool } */
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
  tiles.forEach((T) => {
    const s = T.st;
    s.step = Math.max(0, s.step - dt * 2.2); s.flash = Math.max(0, s.flash - dt * 1.6);
    let fc = null, fo = 0;
    if (s.target) { fc = '#ffd000'; fo = 0.75 + 0.25 * pulse; }
    else if (s.chosen) { fc = '#1f9d55'; fo = 1; }
    else if (s.pick) { fc = '#ffc800'; fo = 0.85; }
    else if (s.fest) { fc = '#ff5fa2'; fo = 0.9; }
    else if (s.rfest) { fc = '#2fbf6c'; fo = 0.75; }
    if (s.step > 0) { fc = '#fff2a0'; fo = Math.max(fo, s.step); }
    if (fc) T.frame.material.color.set(fc);
    T.frame.material.opacity += (fo - T.frame.material.opacity) * Math.min(1, dt * 12);
    const lift = (s.target ? 0.08 + 0.05 * pulse : 0) + s.flash * 0.12 + s.step * 0.05;
    s.lift += (lift - s.lift) * Math.min(1, dt * 14);
    T.grp.position.y = s.lift;
    const b = s.dim ? 0.38 : 1 + s.flash * 0.25;
    T.top.material.color.setScalar(b); T.body.material.color.set('#efe4cc').multiplyScalar(s.dim ? 0.5 : 1);
  });
}

// ======================= nhà / công trình =======================
const winTexCache = new Map();
function windowTex(wall, win, lit = false, cols = 2, rows = 2) {
  const key = `${wall}|${win}|${lit}|${cols}|${rows}`;
  if (winTexCache.has(key)) return winTexCache.get(key);
  const [c, g] = canvas(128, 128);
  g.fillStyle = wall; g.fillRect(0, 0, 128, 128);
  const cw = 128 / cols, ch = 128 / rows;
  for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
    const px = x * cw + cw * 0.22, py = y * ch + ch * 0.22, w = cw * 0.56, h = ch * 0.56;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(px - 3, py - 3, w + 6, h + 6);
    const gw = g.createLinearGradient(px, py, px + w, py + h); gw.addColorStop(0, lit ? '#fff5c2' : '#d8f1ff'); gw.addColorStop(1, win); g.fillStyle = gw; g.fillRect(px, py, w, h);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(px + w / 2 - 1.5, py, 3, h); g.fillRect(px, py + h / 2 - 1.5, w, 3);
  }
  const t = texOf(c); winTexCache.set(key, t); return t;
}
function walls(w, h, d, wall, win, opts = {}) {
  const tex = windowTex(wall, win, opts.lit, opts.cols || 2, opts.rows || Math.max(1, Math.round(h / 0.22)));
  const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: opts.lit ? '#ffcf5a' : '#000', emissiveMap: opts.lit ? tex : null, emissiveIntensity: opts.lit ? 0.35 : 0 });
  const topM = std(opts.top || '#e8dcc4');
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, topM, topM, side, side]);
  m.position.y = h / 2; m.castShadow = true; m.receiveShadow = true;
  return m;
}
function gable(w, d, h, color, o = 0.06) {   // mái 2 dốc, nóc chạy theo trục x
  const s = new THREE.Shape(); s.moveTo(-d / 2 - o, 0); s.lineTo(0, h); s.lineTo(d / 2 + o, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w + o * 2, bevelEnabled: false }); g.translate(0, 0, -(w + o * 2) / 2); g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, std(color, { roughness: 0.55 })); m.castShadow = true; return m;
}
function hip(w, h, color, flare = 1.12) {      // mái chóp 4 mặt
  const g = new THREE.ConeGeometry((w / Math.SQRT2) * flare, h, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, std(color, { roughness: 0.5, flatShading: true })); m.castShadow = true; return m;
}
function smokeSprites(grp, y) {
  const tex = smokeTex();
  for (let k = 0; k < 3; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData.smoke = { y, phase: k / 3 }; sp.scale.setScalar(0.12); grp.add(sp);
  }
}
let _smoke;
function smokeTex() { if (_smoke) return _smoke; const [c, g] = canvas(64, 64); const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return (_smoke = texOf(c)); }
function labelSprite(text, { bg = '#ffd34d', fg = '#5a2a00', border = '#fff', h = 0.22, font = 900 } = {}) {
  const [c, g] = canvas(512, 128);
  g.font = `${font} 72px ${FONT}`; const tw = Math.min(480, g.measureText(text).width + 70);
  g.fillStyle = bg; rr(g, (512 - tw) / 2, 14, tw, 100, 50); g.fill(); g.lineWidth = 10; g.strokeStyle = border; g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texOf(c), transparent: true, depthTest: false }));
  sp.scale.set(h * 4, h, 1); sp.renderOrder = 10; return sp;
}

function buildModel(type, lvl, st, color) {
  const g = new THREE.Group();
  const roof = '#' + col(color).getHexString(), roofD = '#' + mixHex(color, '#000000', 0.25).getHexString();
  if (type === 'resort') {
    const hut = walls(0.4, 0.2, 0.36, '#e2c27f', '#b98a45', { rows: 1, cols: 2 }); g.add(hut);
    const r = hip(0.5, 0.26, '#d9a94e', 1.2); r.position.y = 0.2; g.add(r);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.34), std('#6a4426')); pole.position.set(0.3, 0.17, 0.18); g.add(pole);
    const um = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.08, 12), std(roof)); um.position.set(0.3, 0.36, 0.18); um.castShadow = true; g.add(um);
    const flag = ownerFlag(color); flag.position.set(-0.28, 0, -0.1); g.add(flag);
    return g;
  }
  if (lvl === 0) { const f = ownerFlag(color); g.add(f); return g; }
  const smoke = (y) => smokeSprites(g, y);
  if (st === 1) {          // mái chùa
    if (lvl <= 3) {
      const h = [0, 0.24, 0.42, 0.6][lvl];
      g.add(walls(0.42, h, 0.42, '#fffaf2', '#c8323a', { rows: lvl, cols: 2, top: '#e9dcc6' }));
      for (let k = 0; k < lvl; k++) { const r = hip(0.46 - k * 0.04, k === lvl - 1 ? 0.22 : 0.08, k === lvl - 1 ? roof : roofD, 1.28); r.position.y = (h / lvl) * (k + 1) - (k === lvl - 1 ? 0 : 0.03); g.add(r); }
      smoke(h + 0.22);
    } else {
      [[0.56, 0.36], [0.46, 0.32], [0.36, 0.3], [0.26, 0.26]].reduce((y, [w, h], k) => {
        const b = walls(w, h, w, '#fffaf2', '#c8323a', { rows: 1, cols: 2, top: '#e9dcc6' }); b.position.y += y; g.add(b);
        const r = hip(w + 0.02, k === 3 ? 0.3 : 0.1, k === 3 ? roof : roofD, 1.3); r.position.y = y + h; g.add(r);
        return y + h + 0.04;
      }, 0);
      hotelTop(g, 1.65, color);
    }
  } else if (st === 2) {   // hiện đại
    const glass = (w, h, d, y, x = 0) => { const m = walls(w, h, d, '#dff2fb', '#4f9fd6', { rows: Math.max(1, Math.round(h / 0.18)), cols: 3, top: '#cfd8df' }); m.position.x = x; m.position.y += y; g.add(m); const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.04, d + 0.03), std(roof)); cap.position.set(x, y + h + 0.02, 0); cap.castShadow = true; g.add(cap); return y + h + 0.04; };
    if (lvl === 1) glass(0.48, 0.24, 0.4, 0);
    else if (lvl === 2) { const y = glass(0.5, 0.22, 0.42, 0); glass(0.36, 0.2, 0.32, y, 0.05); }
    else if (lvl === 3) { let y = glass(0.52, 0.22, 0.44, 0); y = glass(0.42, 0.2, 0.36, y, -0.04); glass(0.32, 0.2, 0.28, y, 0.05); }
    else { const t = walls(0.46, 1.5, 0.46, '#e6f4fb', '#3f8fcf', { rows: 9, cols: 3, lit: true, top: '#9aa6b8' }); g.add(t); const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), std(roof)); cap.position.y = 1.53; g.add(cap); hotelTop(g, 1.56, color); }
  } else if (st === 3) {   // phố cổ: dãy nhà ống vàng
    const tube = (x, h, z = 0) => { const b = walls(0.2, h, 0.36, '#ffd862', '#7b4a2b', { rows: Math.max(1, Math.round(h / 0.2)), cols: 1, top: '#f3cf6a' }); b.position.x = x; b.position.z = z; g.add(b); const r = gable(0.22, 0.38, 0.12, '#' + mixHex(color, '#b5532c', 0.65).getHexString(), 0.02); r.rotation.y = Math.PI / 2; r.position.set(x, h, z); g.add(r); };
    if (lvl === 1) { tube(0, 0.26); smoke(0.42); }
    else if (lvl === 2) { tube(-0.12, 0.26); tube(0.12, 0.4); smoke(0.56); }
    else if (lvl === 3) { tube(-0.24, 0.3); tube(0, 0.5); tube(0.24, 0.36); smoke(0.66); }
    else { const b = walls(0.46, 0.95, 0.42, '#ffd862', '#6a3f23', { rows: 5, cols: 3, lit: true, top: '#f3cf6a' }); g.add(b); const r = gable(0.48, 0.44, 0.22, '#' + mixHex(color, '#b5532c', 0.6).getHexString()); r.position.y = 0.95; g.add(r); hotelTop(g, 1.2, color); }
  } else {                 // mái ngói
    if (lvl <= 3) {
      const h = [0, 0.24, 0.42, 0.6][lvl];
      g.add(walls(0.42, h, 0.36, '#fff6e2', '#6fb8e6', { rows: lvl, cols: 2 }));
      const r = gable(0.42, 0.36, 0.2, roof); r.position.y = h; g.add(r);
      if (lvl === 3) { const a = walls(0.2, 0.2, 0.22, '#fff6e2', '#6fb8e6', { rows: 1, cols: 1 }); a.position.set(0.32, 0, 0.08); g.add(a); const ar = gable(0.2, 0.22, 0.12, roofD); ar.position.set(0.32, 0.2, 0.08); g.add(ar); }
      smoke(h + 0.24);
    } else {
      const t = walls(0.5, 1.1, 0.5, '#eef1f6', '#ffd76a', { rows: 7, cols: 3, lit: true, top: '#9aa6b8' }); g.add(t);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38), std(roof)); cap.position.y = 1.16; cap.castShadow = true; g.add(cap);
      hotelTop(g, 1.22, color);
    }
  }
  return g;
}
function ownerFlag(color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42), std('#5b4630')); pole.position.y = 0.21; pole.castShadow = true; g.add(pole);
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.2, -0.06); s.lineTo(0, -0.13); s.closePath();
  const f = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6 }));
  f.position.set(0.01, 0.41, 0); f.userData.wave = true; f.castShadow = true; g.add(f);
  return g;
}
function hotelTop(g, y, color) {
  const sign = labelSprite('HOTEL', { bg: '#fff3b0', fg: '#' + mixHex(color, '#000000', 0.3).getHexString(), border: color, h: 0.15 }); sign.position.y = y + 0.12; g.add(sign);
  const bc = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: '#ff3b3b', emissive: '#ff2020', emissiveIntensity: 2 }));
  bc.position.y = y + 0.26; bc.userData.beacon = true; g.add(bc);
}
/** ô i có nhà: info = { owner, color, lvl, style, type, festMult } hoặc null */
export function setBuilding(i, info) {
  const key = info ? `${info.owner}|${info.lvl}|${info.festMult || 0}` : '';
  const cur = buildings[i];
  const prevKey = cur?.userData.key || '';
  if (prevKey === key) return { prev: prevKey };
  const [po, pl] = prevKey.split('|');
  const sameModel = info && po === String(info.owner) && pl === String(info.lvl);
  if (sameModel) { setFestLabel(cur, info.festMult); cur.userData.key = key; return { prev: prevKey }; }
  if (cur) { bldGroup.remove(cur); }
  buildings[i] = null;
  if (!info) return { prev: prevKey };
  const t = TILE[i];
  const root = new THREE.Group();
  const model = buildModel(info.type, info.lvl, info.style, info.color);
  model.scale.setScalar(1.15);
  root.add(model);
  const p = tp(i, 0, info.type === 'resort' ? 0.32 : 0.3, TH);
  root.position.copy(p); root.rotation.y = t.rotY;
  root.userData = { key, model, t0: performance.now(), anim: po === String(info.owner) && +pl < info.lvl ? 'up' : 'grow', lvl: info.lvl };
  setFestLabel(root, info.festMult);
  bldGroup.add(root);
  buildings[i] = root;
  return { prev: prevKey, upgraded: root.userData.anim === 'up' };
}
function setFestLabel(root, mult) {
  const old = root.userData.fest; if (old) { root.remove(old); root.userData.fest = null; }
  if (!mult) return;
  const lb = labelSprite(`🎆 LỄ HỘI ×${mult}`, { bg: '#ff5fa2', fg: '#fff', border: '#fff', h: 0.2 });
  const box = new THREE.Box3().setFromObject(root.userData.model);
  lb.position.y = Math.max(0.6, box.max.y - root.position.y + 0.22); root.add(lb); root.userData.fest = lb;
}
export const buildingKey = (i) => buildings[i]?.userData.key || '';
export function fxBurn(i, on) {
  const b = buildings[i]; if (!b) return;
  b.traverse((o) => { if (o.material && !o.isSprite) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (!m.userData.base) m.userData.base = m.color?.clone(); }); } });
  if (on) {
    const flames = new THREE.Group(); flames.userData.flames = true;
    for (let k = 0; k < 5; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set(rnd(-0.18, 0.18), rnd(0.15, 0.45), rnd(-0.15, 0.15)); sp.scale.setScalar(rnd(0.25, 0.38)); sp.userData.flick = Math.random() * 6; flames.add(sp); }
    b.add(flames); b.userData.flames = flames;
  } else if (b.userData.flames) { b.remove(b.userData.flames); b.userData.flames = null; }
}
let _flame;
function flameTex() { if (_flame) return _flame; const [c, g] = canvas(64, 96); const r = g.createRadialGradient(32, 64, 2, 32, 56, 40); r.addColorStop(0, 'rgba(255,255,200,1)'); r.addColorStop(0.35, 'rgba(255,170,40,.95)'); r.addColorStop(0.7, 'rgba(230,60,20,.6)'); r.addColorStop(1, 'rgba(200,30,0,0)'); g.fillStyle = r; g.beginPath(); g.ellipse(32, 60, 26, 36, 0, 0, Math.PI * 2); g.fill(); return (_flame = texOf(c)); }
export function fxShake(i, ms = 500) { const b = buildings[i]; if (b) b.userData.shakeUntil = performance.now() + ms; }
export function collapse(i) {
  const b = buildings[i]; if (!b) return;
  b.userData.anim = 'crumble'; b.userData.t0 = performance.now();
  // gạch đá văng
  for (let k = 0; k < 14; k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.04), std(['#c9a77a', '#8a7a70', '#e9d9b8', '#b05a3a'][k % 4]));
    m.position.copy(b.position).add(new THREE.Vector3(rnd(-0.15, 0.15), rnd(0.1, 0.4), rnd(-0.15, 0.15)));
    const v = new THREE.Vector3(rnd(-1.4, 1.4), rnd(1.5, 3), rnd(-1.4, 1.4)); const spin = new THREE.Vector3(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
    m.castShadow = true; fxGroup.add(m);
    const t0 = performance.now();
    anims.add((t, dt) => { const age = (performance.now() - t0) / 1000; v.y -= 9.8 * dt; m.position.addScaledVector(v, dt); if (m.position.y < TH + 0.02) { m.position.y = TH + 0.02; v.multiplyScalar(0.4); v.y = Math.abs(v.y) * 0.3; } m.rotation.x += spin.x * dt; m.rotation.y += spin.y * dt; if (age > 1.3) { m.scale.multiplyScalar(0.85); } if (age > 1.8) { fxGroup.remove(m); return false; } return true; });
  }
  puffs(b.position, 8);
}
function puffs(pos, n) {
  for (let k = 0; k < n; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), transparent: true, depthWrite: false, color: '#f3e8d8' }));
    sp.position.copy(pos).add(new THREE.Vector3(rnd(-0.25, 0.25), 0.1, rnd(-0.25, 0.25))); fxGroup.add(sp);
    const v = new THREE.Vector3(rnd(-0.4, 0.4), rnd(0.3, 0.7), rnd(-0.4, 0.4)), t0 = performance.now();
    anims.add((t, dt) => { const a = (performance.now() - t0) / 1000; sp.position.addScaledVector(v, dt); sp.scale.setScalar(0.2 + a * 0.7); sp.material.opacity = Math.max(0, 0.9 - a * 0.8); if (a > 1.15) { fxGroup.remove(sp); return false; } return true; });
  }
}
function updateBuildings(t, dt, now) {
  buildings.forEach((b) => {
    if (!b) return;
    const u = b.userData, m = u.model;
    const a = (now - u.t0) / 1000;
    if (u.anim === 'grow') { const k = Math.min(1, a / 0.75); const e = ease.outElastic(k); m.scale.set(1.15 * Math.min(1.08, 0.5 + 0.5 * e), 1.15 * Math.max(0.01, e), 1.15 * Math.min(1.08, 0.5 + 0.5 * e)); if (k >= 1) { u.anim = null; m.scale.setScalar(1.15); } }
    else if (u.anim === 'up') { const k = Math.min(1, a / 0.95); const e = ease.outBack(k); m.position.y = (1 - Math.min(1, k * 1.6)) * 1.6; m.rotation.y = (1 - Math.min(1, k * 1.4)) * -Math.PI * 1.6; m.scale.setScalar(1.15 * (0.6 + 0.4 * e)); if (k >= 1) { u.anim = null; m.position.y = 0; m.rotation.y = 0; m.scale.setScalar(1.15); } }
    else if (u.anim === 'crumble') { const k = Math.min(1, a / 0.6); m.scale.set(1.15 * (1 + k * 0.2), 1.15 * Math.max(0.001, 1 - ease.inOut(k)), 1.15 * (1 + k * 0.2)); m.rotation.z = -k * 0.25; }
    if (u.shakeUntil && now < u.shakeUntil) { m.position.x = Math.sin(now / 22) * 0.03; } else if (u.shakeUntil) { m.position.x = 0; u.shakeUntil = 0; }
    b.traverse((o) => {
      if (o.userData.smoke) { const s = o.userData.smoke; const p = (t * 0.45 + s.phase) % 1; o.position.set(0.12 + p * 0.08, s.y + p * 0.42, 0); o.scale.setScalar(0.08 + p * 0.2); o.material.opacity = Math.sin(p * Math.PI) * 0.75; }
      else if (o.userData.beacon) { o.material.emissiveIntensity = Math.sin(t * 6) > 0 ? 3 : 0.2; }
      else if (o.userData.wave) { o.rotation.y = Math.sin(t * 4 + b.position.x) * 0.35; }
      else if (o.userData.flick != null) { o.scale.y = 0.3 + 0.08 * Math.sin(t * 18 + o.userData.flick); o.material.opacity = 0.75 + 0.25 * Math.sin(t * 23 + o.userData.flick); }
    });
    if (u.fest) u.fest.position.y += Math.sin(t * 3) * 0.0008;
  });
}

// ======================= cổng FESTIVAL =======================
let _bannerTex;
function bannerTex() {
  if (_bannerTex) return _bannerTex;
  const [c, g] = canvas(512, 160);
  const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#3fd47e'); gr.addColorStop(0.55, '#1f9d55'); gr.addColorStop(1, '#127a3e');
  g.fillStyle = gr; rr(g, 6, 6, 500, 148, 24); g.fill(); g.lineWidth = 12; g.strokeStyle = '#ffd23f'; g.stroke();
  g.setLineDash([4, 10]); g.lineWidth = 3; g.strokeStyle = '#ffe680'; rr(g, 22, 22, 468, 116, 16); g.stroke(); g.setLineDash([]);
  g.font = `900 88px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = '#0a4f26'; g.strokeText('FESTIVAL', 256, 86); g.fillStyle = '#ffe14d'; g.fillText('FESTIVAL', 256, 86);
  return (_bannerTex = texOf(c));
}
function buildGate() {
  const g = new THREE.Group();
  const wood = std('#b07a3e', { roughness: 0.6 }), gold = new THREE.MeshStandardMaterial({ color: '#ffc531', metalness: 0.7, roughness: 0.3 });
  [-0.44, 0.44].forEach((x) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.05, 10), wood); p.position.set(x, 0.525, 0); p.castShadow = true; g.add(p);
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), gold); k.position.set(x, 1.08, 0); g.add(k);
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.2, -0.05); s.lineTo(0, -0.11); s.closePath();
    const pn = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color: '#ff4d6d', side: THREE.DoubleSide })); pn.position.set(x, 1.3, 0); pn.userData.wave = true; g.add(pn);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.24), wood); st.position.set(x, 1.22, 0); g.add(st);
  });
  // băng rôn cong
  const geo = new THREE.PlaneGeometry(0.98, 0.3, 24, 1);
  const pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) { const x = pos.getX(k); pos.setY(k, pos.getY(k) + 0.08 * Math.cos((x / 0.49) * Math.PI / 2)); pos.setZ(k, 0.03 * Math.cos((x / 0.49) * Math.PI / 2)); }
  geo.computeVertexNormals();
  const ban = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: bannerTex(), side: THREE.DoubleSide, roughness: 0.5 }));
  ban.position.y = 0.86; ban.castShadow = true; g.add(ban); g.userData.banner = ban;
  // dây cờ
  const colors = ['#ff4d6d', '#ffb703', '#3a86ff', '#ff8c42', '#b15cff', '#06d6a0', '#ffd60a'];
  for (let k = 0; k < 9; k++) {
    const x = -0.4 + k * 0.1, y = 0.66 - 0.06 * Math.cos((x / 0.44) * Math.PI / 2);
    const s = new THREE.Shape(); s.moveTo(-0.035, 0); s.lineTo(0.035, 0); s.lineTo(0, -0.07); s.closePath();
    const f = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color: colors[k % 7], side: THREE.DoubleSide }));
    f.position.set(x, y, 0.01); f.userData.bunt = k; g.add(f);
  }
  return g;
}
export function setFestGates(list, fresh = false) {
  const want = new Set(list || []);
  for (const [i, g] of gates) if (!want.has(i)) { bldGroup.remove(g); gates.delete(i); }
  for (const i of want) {
    if (gates.has(i)) continue;
    const g = buildGate(); const t = TILE[i];
    g.position.copy(tp(i, 0, 0.03, TH)); g.rotation.y = t.rotY;
    g.userData.t0 = fresh ? performance.now() : 0;
    bldGroup.add(g); gates.set(i, g);
  }
}
function updateGates(t, now) {
  for (const g of gates.values()) {
    if (g.userData.t0) { const k = Math.min(1, (now - g.userData.t0) / 800); g.scale.set(1, Math.max(0.01, ease.outBack(k)), 1); if (k >= 1) g.userData.t0 = 0; }
    g.userData.banner.rotation.x = Math.sin(t * 2 + g.position.x) * 0.06;
    g.children.forEach((o) => { if (o.userData.bunt != null) o.rotation.z = Math.sin(t * 5 + o.userData.bunt) * 0.25; else if (o.userData.wave) o.rotation.y = Math.sin(t * 6 + o.position.x * 3) * 0.4; });
  }
}

// ======================= quân cờ =======================
const SLOTS = [[0], [-0.2, 0.2], [-0.27, 0, 0.27], [-0.33, -0.11, 0.11, 0.33]];
let _shadowTex;
function shadowTex() { if (_shadowTex) return _shadowTex; const [c, g] = canvas(64, 64); const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(30,0,40,.55)'); r.addColorStop(1, 'rgba(30,0,40,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return (_shadowTex = texOf(c)); }
/** players: [{ img: url ảnh nhân vật toàn thân, color }] */
export async function setTokens(players) {
  tokens.forEach((tk) => tokenGroup.remove(tk.grp));
  tokens = await Promise.all(players.map(async (p) => {
    const grp = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.005; grp.add(sh);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 40), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; grp.add(ring);
    const im = await loadImg(p.img);
    const [cv, cg] = canvas(240, 416);
    if (im) cg.drawImage(im, 0, 0, 240, 416);
    const tex = texOf(cv);
    const ar = 240 / 416;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.1 }));
    const h = 0.95; sp.scale.set(h * ar, h, 1); sp.center.set(0.5, 0.02); grp.add(sp);
    tokenGroup.add(grp);
    return { grp, sp, ring, sh, h, from: null, to: null, t0: 0, dur: 0, arc: 0, cur: false, out: false };
  }));
}
function slotPos(tile, k, n) { const a = SLOTS[Math.min(n, 4) - 1][k] ?? 0; return tp(tile, a, tile % 8 === 0 ? 0.55 : 0.52, TH); }
/** đặt / di chuyển quân: places[pid] = { tile, k, n, out }, opt = { dur, arc } */
export function placeToken(pid, place, opt = {}) {
  const tk = tokens[pid]; if (!tk || !place || !TILE[place.tile]) return;
  tk.out = !!place.out; tk.grp.visible = !tk.out;
  const target = slotPos(place.tile, place.k, place.n);
  if (!opt.dur || !tk.to) { tk.grp.position.copy(target); tk.to = target; tk.from = null; return; }
  tk.from = tk.grp.position.clone(); tk.to = target; tk.t0 = performance.now(); tk.dur = opt.dur; tk.arc = opt.arc ?? 0.35;
}
export function setCurrent(pid) { tokens.forEach((tk, i) => { tk.cur = i === pid; }); }
function updateTokens(t, now) {
  tokens.forEach((tk) => {
    if (tk.from) {
      const k = Math.min(1, (now - tk.t0) / tk.dur), e = ease.inOut(k);
      tk.grp.position.lerpVectors(tk.from, tk.to, e);
      tk.sp.position.y = Math.sin(k * Math.PI) * tk.arc;
      const sq = k > 0.85 ? 1 - Math.sin(((k - 0.85) / 0.15) * Math.PI) * 0.12 : 1;
      tk.sp.scale.set(tk.h * (240 / 416) * (2 - sq), tk.h * sq, 1);
      if (k >= 1) { tk.from = null; tk.sp.position.y = 0; }
    } else tk.sp.position.y = tk.cur ? Math.abs(Math.sin(t * 3.2)) * 0.06 : 0;
    tk.ring.material.opacity = tk.cur ? 0.55 + 0.35 * Math.sin(t * 5) : 0;
    tk.ring.scale.setScalar(tk.cur ? 1 + 0.12 * Math.sin(t * 5) : 1);
  });
}

// ======================= xúc xắc =======================
const PIPS = { 1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]], 4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]], 6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]] };
// thứ tự mặt BoxGeometry: +x, -x, +y, -y, +z, -z
const FACE_N = [2, 5, 1, 6, 3, 4];
const FACE_DIR = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
function pipTex(n) {
  const [c, g] = canvas(256, 256);
  const gr = g.createRadialGradient(90, 80, 10, 128, 128, 180); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#efe8dc'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  PIPS[n].forEach(([x, y]) => { const r = g.createRadialGradient(x * 256 - 6, y * 256 - 6, 2, x * 256, y * 256, 26); r.addColorStop(0, n === 1 || n === 4 ? '#ff6b6b' : '#555'); r.addColorStop(1, n === 1 || n === 4 ? '#b3121b' : '#0d0d0d'); g.fillStyle = r; g.beginPath(); g.arc(x * 256, y * 256, n === 1 ? 32 : 22, 0, Math.PI * 2); g.fill(); });
  return texOf(c);
}
function buildDice() {
  const mats = FACE_N.map((n) => new THREE.MeshStandardMaterial({ map: pipTex(n), roughness: 0.35 }));
  const geo = new RoundedBoxGeometry(0.62, 0.62, 0.62, 4, 0.1);
  dice = [-0.42, 0.42].map((x) => { const m = new THREE.Mesh(geo, mats); m.castShadow = true; m.position.set(x, 0.32, 0); m.userData.home = new THREE.Vector3(x, 0.32, 0); boardGroup.add(m); return m; });
  showDice([5, 6]);
}
function quatFor(n, yaw) {
  const idx = FACE_N.indexOf(n);
  const q = new THREE.Quaternion().setFromUnitVectors(FACE_DIR[idx], new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(q);
}
export function showDice(d) { dice.forEach((m, k) => { m.quaternion.copy(quatFor(d[k], (isFlat ? 0 : Math.PI / 4) + k * 0.3)); m.position.copy(m.userData.home); }); }
export function rollDice(d, dur = 1000) {
  return new Promise((res) => {
    const t0 = performance.now();
    const parts = dice.map((m, k) => ({ m, q1: quatFor(d[k], (isFlat ? 0 : Math.PI / 4) + k * 0.3 + rnd(-0.2, 0.2)), axis: new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 0.3), rnd(-1, 1)).normalize(), turns: rnd(3, 5) * Math.PI * 2, home: m.userData.home, start: m.userData.home.clone().add(new THREE.Vector3(rnd(-0.6, 0.6), 0, rnd(0.8, 1.4))) }));
    anims.add(() => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      parts.forEach((p) => {
        const e = ease.outCubic(k);
        p.m.position.lerpVectors(p.start, p.home, e);
        // nảy: cao lúc đầu, nảy nhỏ cuối
        const b = k < 0.55 ? Math.sin((k / 0.55) * Math.PI) * 1.5 : k < 0.82 ? Math.sin(((k - 0.55) / 0.27) * Math.PI) * 0.35 : Math.sin(((k - 0.82) / 0.18) * Math.PI) * 0.08;
        p.m.position.y = p.home.y + b;
        const spin = new THREE.Quaternion().setFromAxisAngle(p.axis, (1 - e) * p.turns);
        p.m.quaternion.copy(spin.multiply(p.q1));
      });
      if (k >= 1) { res(); return false; }
      return true;
    });
  });
}
export function hideDice(on) { dice.forEach((m) => { m.visible = !on; }); }

// ======================= đánh dấu ô đích =======================
function buildMarker() {
  markerGrp = new THREE.Group(); markerGrp.visible = false;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 10, 48), new THREE.MeshStandardMaterial({ color: '#ffd000', emissive: '#ffb300', emissiveIntensity: 0.8 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; markerGrp.add(ring); markerGrp.userData.ring = ring;
  fxGroup.add(markerGrp);
}
export function setTarget(i, label) {
  if (i < 0) { markerGrp.visible = false; tiles.forEach((T) => { T.st.target = false; }); return; }
  tiles.forEach((T, k) => { T.st.target = k === i; });
  markerGrp.position.copy(tp(i, 0, 0.5, TH));
  if (markerLabel) markerGrp.remove(markerLabel);
  markerLabel = labelSprite(String(label), { bg: '#ffd000', fg: '#6a3b00', border: '#fff', h: 0.32 });
  markerLabel.scale.set(0.42, 0.42 * 128 / 512 * 4, 1);
  markerLabel.scale.set(1.28, 0.32, 1); markerLabel.position.y = 1.15; markerGrp.add(markerLabel);
  markerGrp.visible = true;
}
function updateMarker(t) { if (!markerGrp.visible) return; markerGrp.userData.ring.scale.setScalar(1 + 0.12 * Math.sin(t * 7)); if (markerLabel) markerLabel.position.y = 1.15 + Math.abs(Math.sin(t * 5)) * 0.15; }

// ======================= đống tiền giữa bàn =======================
export function showPile(amount) {
  clearPile();
  pileGrp = new THREE.Group(); boardGroup.add(pileGrp);
  const gold = new THREE.MeshStandardMaterial({ color: '#ffcc33', metalness: 0.85, roughness: 0.28 });
  const items = [];
  if (amount < 100) {
    const stacks = Math.min(4, 1 + Math.floor(amount / 30));
    const P = [[0, 0], [0.42, -0.2], [-0.4, 0.22], [0.12, 0.45]];
    for (let s = 0; s < stacks; s++) for (let j = 0; j < 3 + ((Math.round(amount) + s * 3) % 5); j++) items.push([new THREE.CylinderGeometry(0.17, 0.17, 0.055, 24), gold, P[s][0], j * 0.06 + 0.03, P[s][1]]);
  } else if (amount < 600) {
    const n = Math.min(12, Math.max(2, Math.round(amount / 50)));
    const cashTex = (() => { const [c, g] = canvas(256, 128); g.fillStyle = '#7ddb7a'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#ffe27a'; g.fillRect(96, 0, 64, 128); g.strokeStyle = '#3f9d4b'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 120); g.fillStyle = '#2f7a3a'; g.font = `900 46px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('₫', 50, 64); g.fillText('₫', 206, 64); return texOf(c); })();
    const side = std('#49a956'), top = new THREE.MeshStandardMaterial({ map: cashTex, roughness: 0.8 });
    const P = [[-0.36, 0, 0], [0.36, 0, 0], [-0.36, -0.38, 0], [0.36, -0.38, 0], [-0.36, 0.38, 0], [0.36, 0.38, 0], [-0.36, -0.19, 1], [0.36, -0.19, 1], [-0.36, 0.19, 1], [0.36, 0.19, 1], [-0.36, 0, 2], [0.36, 0, 2]];
    for (let k = 0; k < n; k++) items.push([new THREE.BoxGeometry(0.68, 0.14, 0.34), [side, side, top, side, side, side], P[k][0], P[k][2] * 0.15 + 0.07, P[k][1]]);
  } else {
    const n = Math.min(9, 2 + Math.floor(amount / 300));
    const bar = new THREE.CylinderGeometry(0.2, 0.26, 0.17, 4, 1); bar.rotateY(Math.PI / 4); bar.scale(1.6, 1, 0.72);
    const P = [[0, -0.16, 0], [0, 0.16, 0], [0, -0.48, 0], [0, 0.48, 0], [0, 0, 1], [0, -0.32, 1], [0, 0.32, 1], [0, -0.16, 2], [0, 0.16, 2]];
    for (let k = 0; k < n; k++) items.push([bar, gold, P[k][0] - 0.22, P[k][2] * 0.18 + 0.09, P[k][1]]);
    for (let j = 0; j < 6; j++) items.push([new THREE.CylinderGeometry(0.15, 0.15, 0.05, 24), gold, 0.62, j * 0.055 + 0.03, -0.2]);
  }
  const t0 = performance.now();
  let top = 0;
  items.forEach(([geo, m, x, y, z], k) => {
    const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.position.set(x, y + 3, z); pileGrp.add(mesh); top = Math.max(top, y);
    const delay = k * 55;
    anims.add(() => { const a = (performance.now() - t0 - delay) / 420; if (a < 0) return true; const k2 = Math.min(1, a); mesh.position.y = y + 3 * (1 - ease.outCubic(k2)); if (k2 >= 1) { mesh.position.y = y; return false; } return true; });
  });
  hideDice(true);
  return project(new THREE.Vector3(0, top + 0.6, 0));
}
export function clearPile() { if (pileGrp) { boardGroup.remove(pileGrp); pileGrp = null; } hideDice(false); }

// ======================= cảnh nền theo theme =======================
function waterMaterial(c) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDeep: { value: col(c.deep) }, uSky: { value: col(c.sky) }, uSun: { value: col(c.sun) }, uSunDir: { value: new THREE.Vector3(-0.4, 0.5, -1).normalize() }, uFog: { value: col(c.fog) }, uFogNear: { value: c.fogNear }, uFogFar: { value: c.fogFar } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime, uFogNear, uFogFar; uniform vec3 uDeep, uSky, uSun, uSunDir, uFog; varying vec3 vW;
      float h(vec2 p){ return sin(p.x*.35+uTime*.9)*.5 + sin(p.y*.42-uTime*.7)*.5 + sin((p.x+p.y)*.9+uTime*1.3)*.25 + sin((p.x-p.y)*1.9-uTime*1.9)*.12 + sin(p.x*3.1+p.y*2.3+uTime*2.6)*.05; }
      void main(){ vec2 p = vW.xz; float e = .06;
        vec3 n = normalize(vec3(-(h(p+vec2(e,0.))-h(p-vec2(e,0.)))*1.6, 1., -(h(p+vec2(0.,e))-h(p-vec2(0.,e)))*1.6));
        vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1. - max(dot(n, V), 0.), 4.);
        vec3 c = mix(uDeep, uSky, clamp(fr * 1.1 + .12, 0., 1.));
        vec3 R = reflect(-V, n);
        c += uSun * (pow(max(dot(R, normalize(uSunDir)), 0.), 220.) * 2.2 + pow(max(dot(R, normalize(uSunDir)), 0.), 18.) * .12);
        float f = smoothstep(uFogNear, uFogFar, length(cameraPosition - vW));
        gl_FragColor = vec4(mix(c, uFog, f), 1.); }`,
  });
}
function karstGeo(h, r, seed) {
  const g = new THREE.CylinderGeometry(r * 0.6, r, h, 14, 14, false); g.translate(0, h / 2, 0);
  const pos = g.attributes.position, colors = [];
  const rock = col('#5f7f86'), rockD = col('#3f5d66'), green = col('#4e9a5a'), greenL = col('#7cc46e');
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), t = y / h, a = Math.atan2(z, x);
    let s = 1 + 0.16 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 7 + seed * 2) + 0.08 * Math.sin(t * 11 + seed);
    if (t > 0.8) s *= Math.cos(((t - 0.8) / 0.2) * Math.PI / 2) * 0.85 + 0.15;
    if (t < 0.06) s *= 1.08;
    pos.setX(k, x * s); pos.setZ(k, z * s); pos.setY(k, y + (t > 0.95 ? Math.sin(a * 2 + seed) * r * 0.08 : 0));
    const streak = 0.5 + 0.5 * Math.sin(a * 9 + seed * 3);
    const c = t > 0.7 ? green.clone().lerp(greenL, Math.random() * 0.5) : rock.clone().lerp(rockD, streak * 0.6 + (1 - t) * 0.2);
    if (t > 0.55 && t <= 0.7 && Math.random() < 0.5) c.lerp(green, 0.6);
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
function junk(sail) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.5), std('#6a3f22')); hull.position.y = 0.15; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.4), std('#a8743f')); deck.position.set(-0.4, 0.42, 0); g.add(deck);
  const ribTex = (() => { const [c, gg] = canvas(64, 128); gg.fillStyle = sail; gg.fillRect(0, 0, 64, 128); gg.strokeStyle = 'rgba(0,0,0,.28)'; gg.lineWidth = 4; for (let y = 12; y < 128; y += 18) { gg.beginPath(); gg.moveTo(0, y); gg.lineTo(64, y); gg.stroke(); } return texOf(c); })();
  [[0.15, 1.3], [0.6, 1.0]].forEach(([x, h]) => {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h + 0.3), std('#4a2f18')); mast.position.set(x, 0.3 + (h + 0.3) / 2, 0); g.add(mast);
    const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.55, h * 0.2, 0.6, h); s.lineTo(0, h * 0.95); s.closePath();
    const sl = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ map: ribTex, side: THREE.DoubleSide, roughness: 0.8 }));
    sl.position.set(x - 0.02, 0.4, 0.02); sl.rotation.y = Math.PI; g.add(sl);
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function cloudSprite(scale) {
  const [c, g] = canvas(256, 128);
  for (let k = 0; k < 9; k++) { const x = 40 + k * 22 + rnd(-8, 8), y = 74 + rnd(-14, 10), r = rnd(26, 46); const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texOf(c), transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(scale * 2, scale, 1); return sp;
}
const BOARD_STYLE = {
  sakura: { top: '#f8f3fb', side: '#e7d8ee', ped: '#c9a9b8', trim: '#e2b14a', court: 'sakura' },
  halong: { top: '#f4fbff', side: '#cfe6f2', ped: '#9fb7bf', trim: '#d4af37', court: 'halong' },
  lantern: { top: '#fff2dd', side: '#c9824a', ped: '#5a2c2c', trim: '#ffc531', court: 'lantern' },
};
function buildHalong() {
  const g = new THREE.Group();
  water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), waterMaterial({ deep: '#1d7aa3', sky: '#bfe8f7', sun: '#fff6d8', fog: '#cde9f5', fogNear: 60, fogFar: 260 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -2.4; g.add(water);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  const placed = [];
  for (let k = 0; k < 70; k++) {
    const ang = rnd(0, Math.PI * 2), dist = rnd(16, 120);
    // tránh phía camera (hướng +x+z) ở gần
    const cx = Math.cos(ang) * dist, cz = Math.sin(ang) * dist;
    if (dist < 45 && cx + cz > 4) continue;
    if (placed.some(([x, z, r]) => Math.hypot(x - cx, z - cz) < r)) continue;
    const h = rnd(5, 16) * (0.6 + dist / 120), r = rnd(1.6, 3.6) * (0.7 + dist / 160);
    const mesh = new THREE.Mesh(karstGeo(h, r, rnd(0, 10)), m); mesh.position.set(cx, -2.6, cz); mesh.rotation.y = rnd(0, 6.3); mesh.castShadow = dist < 40;
    g.add(mesh); placed.push([cx, cz, r * 1.8]);
  }
  // hòn Trống Mái
  const a = new THREE.Mesh(karstGeo(5, 1.1, 1), m); a.position.set(-26, -2.6, -18); a.rotation.z = 0.25; g.add(a);
  const b = new THREE.Mesh(karstGeo(5.5, 1.2, 4), m); b.position.set(-24.2, -2.6, -18.4); b.rotation.z = -0.28; g.add(b);
  // thuyền buồm
  const boats = [['#c8102e', 22, 0.05], ['#e8a33a', 30, -0.035], ['#d2452e', 17, 0.07], ['#c8102e', 38, -0.025]].map(([sail, R, sp], k) => { const j = junk(sail); j.userData.orbit = { R, sp, a: k * 1.7 }; j.scale.setScalar(1.3); g.add(j); return j; });
  g.userData.boats = boats;
  // làng chài nổi
  const v = new THREE.Group();
  const raft = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 2), std('#8a5a32')); v.add(raft);
  ['#2a8fb8', '#e05252', '#f2b84c', '#3f8a45'].forEach((rc, k) => { const h = walls(1.1, 0.9, 1.1, ['#f4d6a0', '#fff2d6', '#d9f0e2', '#f4d6a0'][k], '#5fb8f0', { rows: 1, cols: 2 }); h.position.set(-2.2 + k * 1.45, 0.12, 0); v.add(h); const r = gable(1.1, 1.1, 0.5, rc); r.position.set(-2.2 + k * 1.45, 1.02, 0); v.add(r); });
  v.position.set(-14, -2.45, 10); v.rotation.y = 0.6; g.add(v);
  // mây
  for (let k = 0; k < 9; k++) { const c = cloudSprite(rnd(8, 16)); c.position.set(rnd(-160, 120), rnd(25, 60), rnd(-200, -60)); c.userData.drift = rnd(0.4, 1.2); g.add(c); }
  g.userData.style = { sky: ['#2f86d4', '#9ad6f7', '#fff3dc'], fog: ['#cde9f5', 60, 260], hemi: ['#ffffff', '#7a9aa0', 1.25], sun: ['#fff1dc', 2.4] };
  return g;
}
function buildSakura() {
  // theme Anh đào: nền là tranh phong cảnh 2D (DOM .sakura-sky) nằm sau canvas trong suốt; cảnh 3D chỉ có bàn cờ + mặt hứng bóng
  const g = new THREE.Group();
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: '#7a3a5a', opacity: 0.26 }));
  catcher.rotation.x = -Math.PI / 2; catcher.position.y = -2.9; catcher.receiveShadow = true; g.add(catcher);
  g.userData.style = { bg2d: true, sky: ['#9fc6ff', '#ffd6ec', '#ffe9d6'], fog: ['#f6d7ea', 50, 230], hemi: ['#fff4fb', '#a07a8a', 1.3], sun: ['#fff1e6', 2.2] };
  return g;
}
function buildLantern() {
  const g = new THREE.Group();
  water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), waterMaterial({ deep: '#1a1438', sky: '#c06a9a', sun: '#ffb070', fog: '#4a2a5e', fogNear: 40, fogFar: 200 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -2.6; g.add(water);
  // phố cổ: dãy nhà quanh bàn
  const win = (() => { const [c, gg] = canvas(64, 128); gg.fillStyle = '#2a1a3a'; gg.fillRect(0, 0, 64, 128); for (let y = 6; y < 128; y += 16) for (let x = 6; x < 64; x += 16) { gg.fillStyle = Math.random() < 0.55 ? '#ffcf6a' : '#3a2a4a'; gg.fillRect(x, y, 8, 9); } const t = texOf(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  for (let k = 0; k < 60; k++) {
    const a = rnd(0, Math.PI * 2), d = rnd(22, 75); const x = Math.cos(a) * d, z = Math.sin(a) * d; if (d < 40 && x + z > 6) continue;
    const h = rnd(4, 16), w = rnd(2.5, 5);
    const m = new THREE.MeshStandardMaterial({ color: '#3a2448', map: win, emissive: '#ffb347', emissiveMap: win, emissiveIntensity: 0.9, roughness: 0.8 });
    m.map = win.clone(); m.map.repeat.set(w / 2, h / 3); m.map.needsUpdate = true; m.emissiveMap = m.map;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m); b.position.set(x, -2.6 + h / 2, z); b.rotation.y = a; g.add(b);
    const r = new THREE.Mesh(new THREE.ConeGeometry(w * 0.8, 1.4, 4), std('#6a1f2a')); r.rotation.y = Math.PI / 4 + a; r.position.set(x, -2.6 + h + 0.7, z); g.add(r);
  }
  // đèn trời bay lên
  const N = isMobile() ? 60 : 110;
  const lan = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 10), new THREE.MeshBasicMaterial({ color: '#ffb347' }), N);
  const data = [];
  for (let k = 0; k < N; k++) { let x, z; do { x = rnd(-60, 60); z = rnd(-80, 20); } while (Math.hypot(x, z) < 18 || (x + z > -4 && Math.hypot(x, z) < 34)); data.push({ x, y: rnd(-2, 40), z, vy: rnd(0.4, 1), sw: rnd(0, 6), s: rnd(0.6, 1.4) }); lan.setColorAt(k, col(['#ffb347', '#ffcf6a', '#ff8a4c'][k % 3])); }
  g.add(lan); g.userData.lanterns = { mesh: lan, data };
  g.userData.style = { sky: ['#140d3a', '#6a2f8a', '#ff9a5c'], fog: ['#4a2a5e', 40, 200], hemi: ['#d8b8ff', '#3a1a2a', 0.85], sun: ['#ffb070', 1.6] };
  return g;
}
export function setTheme(name) {
  theme = ['sakura', 'halong', 'lantern'].includes(name) ? name : 'sakura';
  if (curTheme) { sceneryGroup.remove(curTheme); }
  water = null;
  curTheme = THEMES[theme] || (THEMES[theme] = theme === 'halong' ? buildHalong() : theme === 'lantern' ? buildLantern() : buildSakura());
  water = curTheme.children.find((o) => o.material?.uniforms?.uTime) || null;
  sceneryGroup.add(curTheme);
  const s = curTheme.userData.style;
  sky.material.uniforms.top.value.set(s.sky[0]); sky.material.uniforms.mid.value.set(s.sky[1]); sky.material.uniforms.bot.value.set(s.sky[2]);
  const bg2d = !!s.bg2d;
  sky.visible = !bg2d;
  scene.fog = bg2d ? null : new THREE.Fog(s.fog[0], s.fog[1], s.fog[2]);
  renderer.setClearColor(0x000000, bg2d ? 0 : 1);
  document.body.classList.toggle('gl-bg2d', bg2d);
  bg2dTheme = bg2d; syncHidden();
  hemi.color.set(s.hemi[0]); hemi.groundColor.set(s.hemi[1]); hemi.intensity = s.hemi[2];
  sun.color.set(s.sun[0]); sun.intensity = s.sun[1];
  const b = BOARD_STYLE[theme];
  baseTop.color.set(b.top); baseSide.color.set(b.side); trimMat.color.set(b.trim);
  boardGroup.getObjectByName('pedestal').material.color.set(b.ped);
  courtyard.material.map?.dispose(); courtyard.material.map = courtyardTexture(b.court); courtyard.material.needsUpdate = true;
  renderer.toneMappingExposure = theme === 'lantern' ? 1.15 : 1.05;
}
function updateScenery(t, dt) {
  if (water) water.material.uniforms.uTime.value = t;
  if (!curTheme) return;
  const u = curTheme.userData;
  u.boats?.forEach((b) => { const o = b.userData.orbit; o.a += o.sp * dt; b.position.set(Math.cos(o.a) * o.R, -2.45 + Math.sin(t * 1.5 + o.R) * 0.05, Math.sin(o.a) * o.R - 6); b.rotation.y = -o.a - (o.sp > 0 ? Math.PI / 2 : -Math.PI / 2); b.rotation.z = Math.sin(t * 1.2 + o.R) * 0.04; });
  curTheme.children.forEach((c) => { if (c.isSprite && c.userData.drift) { c.position.x += c.userData.drift * dt; if (c.position.x > 180) c.position.x = -180; } });
  if (u.petals) {
    const { mesh, data } = u.petals, m = new THREE.Object3D();
    data.forEach((p, k) => {
      p.y -= p.vy * dt; p.x += (Math.sin(t * 0.8 + p.sw) * 0.5 - 0.35) * dt; p.z += 0.3 * dt;
      if (p.y < -2.8) { p.y = rnd(5, 8); p.x = rnd(-22, 22); p.z = rnd(-24, 18); }
      m.position.set(p.x, p.y, p.z); m.rotation.set(t * p.rs + p.sw, t * p.rs * 0.7, Math.sin(t + p.sw)); m.scale.setScalar(p.s); m.updateMatrix(); mesh.setMatrixAt(k, m.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  if (u.lanterns) {
    const { mesh, data } = u.lanterns, m = new THREE.Object3D();
    data.forEach((p, k) => { p.y += p.vy * dt * 0.6; if (p.y > 45) p.y = -2; m.position.set(p.x + Math.sin(t * 0.5 + p.sw) * 0.8, p.y, p.z); m.rotation.y = t * 0.3 + p.sw; m.scale.setScalar(p.s); m.updateMatrix(); mesh.setMatrixAt(k, m.matrix); });
    mesh.instanceMatrix.needsUpdate = true;
  }
}

// ======================= camera =======================
let viewRect = null, lastRectKey = '';
let bg2dTheme = false;
const syncHidden = () => { if (host) host.style.visibility = mode === 'home' && bg2dTheme ? 'hidden' : ''; };
export function setMode(m) { mode = m; fitCamera(); syncHidden(); }
/** chỉ để kiểm tra hình: đặt camera tự do */
export function debugCam(p, t, fov = 32) { mode = 'debug'; camera.clearViewOffset(); camera.fov = fov; camera.position.set(...p); camera.lookAt(...t); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }
function camDir() {
  if (mode === 'home') return null;
  return isFlat ? new THREE.Vector3(0, Math.sin(1.1), Math.cos(1.1)) : new THREE.Vector3(Math.cos(0.8) * Math.SQRT1_2, Math.sin(0.8), Math.cos(0.8) * Math.SQRT1_2);
}
function fitCamera() {
  if (!renderer) return;
  const Wv = innerWidth, Hv = innerHeight;
  renderer.setSize(Wv, Hv, false);
  host.style.width = Wv + 'px'; host.style.height = Hv + 'px';
  camera.aspect = Wv / Hv;
  camera.clearViewOffset();
  if (mode === 'home') { camera.updateProjectionMatrix(); return; }
  // vùng màn hình dành cho bàn cờ: theo khung .stage
  const r = stageEl?.getBoundingClientRect();
  let rect = r && r.width > 10 ? { x: r.left, y: r.top, w: r.width, h: r.height } : { x: 0, y: 0, w: Wv, h: Hv };
  if (!isFlat) rect = { x: Wv * 0.15, y: 54, w: Wv * 0.7, h: Hv - 60 };
  viewRect = rect;
  const dir = camDir();
  const pts = [];
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => [0, 0.6].forEach((y) => pts.push(new THREE.Vector3(sx * (W / 2 + 0.35), y, sz * (W / 2 + 0.35))))));
  let D = 26;
  for (let it = 0; it < 3; it++) {
    camera.position.copy(dir).multiplyScalar(D); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    let minx = 1, maxx = -1, miny = 1, maxy = -1;
    pts.forEach((p) => { const v = p.clone().project(camera); minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x); miny = Math.min(miny, v.y); maxy = Math.max(maxy, v.y); });
    const pw = ((maxx - minx) / 2) * Wv, ph = ((maxy - miny) / 2) * Hv;
    D *= Math.max(pw / (rect.w * 0.96), ph / (rect.h * 0.96));
  }
  camera.position.copy(dir).multiplyScalar(D); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  // dịch hình để tâm bàn nằm giữa khung .stage
  const c = new THREE.Vector3(0, 0.3, 0).project(camera);
  const cx = (c.x + 1) / 2 * Wv, cy = (1 - c.y) / 2 * Hv;
  const tx = rect.x + rect.w / 2, ty = rect.y + rect.h / 2;
  camera.setViewOffset(Wv, Hv, cx - tx, cy - ty, Wv, Hv);
  camera.updateProjectionMatrix();
  lastRectKey = `${Math.round(rect.x)}|${Math.round(rect.y)}|${Math.round(rect.w)}|${Math.round(rect.h)}`;
}
function updateCamera(t) {
  if (mode === 'debug') return;
  if (mode === 'home') {
    const a = t * 0.06;
    camera.position.set(Math.cos(a) * 30, 15, Math.sin(a) * 30); camera.lookAt(0, -0.5, 0); camera.updateMatrixWorld();
    return;
  }
  if (isFlat && stageEl) {   // điện thoại: khung bàn cờ cuộn theo trang
    const r = stageEl.getBoundingClientRect();
    const key = `${Math.round(r.left)}|${Math.round(r.top)}|${Math.round(r.width)}|${Math.round(r.height)}`;
    if (key !== lastRectKey) fitCamera();
  }
}

// ======================= vòng lặp =======================
let paused = false;
document.addEventListener('visibilitychange', () => { paused = document.hidden; });
function loop() {
  if (paused || (mode === 'home' && bg2dTheme)) return;
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime, now = performance.now();
  updateCamera(t);
  updateScenery(t, dt);
  updateTiles(t, dt);
  updateBuildings(t, dt, now);
  updateGates(t, now);
  updateTokens(t, now);
  updateMarker(t);
  for (const f of anims) if (f(t, dt) === false) anims.delete(f);
  renderer.render(scene, camera);
}

// ======================= toạ độ màn hình + chọn ô =======================
function project(v) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; }
export const tileScreen = (i) => project(tp(i, 0, 0.5, TH + 0.2));
export const centerScreen = () => project(new THREE.Vector3(0, 0.4, 0));
export function pickTile(x, y) {
  raycaster.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const hit = raycaster.intersectObjects(tiles.map((T) => T.body), false)[0];
  return hit ? hit.object.userData.tile : -1;
}
export { W as BOARD_W };
