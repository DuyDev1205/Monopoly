// Bộ vẽ 3D (Three.js / WebGL): bàn cờ, ô đất, nhà, quân cờ, xúc xắc, cổng Festival, cảnh nền theo theme.
// app.js chỉ gọi các hàm xuất ra ở cuối file; luật chơi không phụ thuộc vào file này.
// Chỉ dùng trong bản app (exe/dmg). Nhà, nhân vật, cây, xu: KayKit (CC0). Cây anh đào, dừa, chòi biển: Polyfork (CC BY 4.0).
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
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  scene = new THREE.Scene();
  { const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'); scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5; }
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 900);
  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();

  // ánh sáng
  hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.25);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(-9, 16, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 60 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  sceneryGroup = new THREE.Group(); scene.add(sceneryGroup);
  boardGroup = new THREE.Group(); scene.add(boardGroup);
  tilesGroup = new THREE.Group(); boardGroup.add(tilesGroup);
  bldGroup = new THREE.Group(); boardGroup.add(bldGroup);
  tokenGroup = new THREE.Group(); boardGroup.add(tokenGroup);
  fxGroup = new THREE.Group(); boardGroup.add(fxGroup);

  if (KIT_BASE) await loadKit();
  buildSky();
  buildBoardBase();
  buildDice();
  buildMarker();
  try { await document.fonts.load(`800 40px ${FONT}`); await document.fonts.ready; } catch {}

  isFlat = false;                       // app: góc nhìn chéo kiểu Business Tour
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
  pickActive = !!set && set.size > 0;
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
  const model = KIT.ready ? kitModel(info.type, info.lvl, info.style, info.color) : buildModel(info.type, info.lvl, info.style, info.color);
  if (!KIT.ready) model.scale.setScalar(1.15);
  root.add(model);
  const p = tp(i, 0, info.type === 'resort' ? 0.32 : 0.3, TH);
  root.position.copy(p);
  root.rotation.y = KIT.ready ? Math.atan2(-t.far.x, -t.far.z) : t.rotY;   // mặt tiền nhà quay ra mép gần (phía chữ)
  root.userData = { key, model, t0: performance.now(), anim: po === String(info.owner) && +pl < info.lvl ? 'up' : 'grow', lvl: info.lvl };
  if (performance.now() - readyAt > 1500) setTimeout(() => buildFx(p.clone(), info.type === 'resort' ? 1 : info.lvl), 350);
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
const TOKEN_H = 1.25;
const FACE_CAM = Math.PI / 4;                 // camera nhìn từ góc +x+z
function charToken(k) {
  const idx = ((k % CHAR3D.length) + CHAR3D.length) % CHAR3D.length;
  const name = `chr/${CHAR3D[idx]}`;
  const src = KIT.tpl[name];
  if (!src || !KIT.skClone) return null;
  const o = KIT.skClone(src);
  o.updateMatrixWorld(true);
  const box = visibleBox(o), H = box.max.y - box.min.y;
  o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.frustumCulled = false; } });
  const s = TOKEN_H / H;
  o.scale.multiplyScalar(s); o.position.y = -box.min.y * s;
  const wrap = new THREE.Group(); wrap.add(o); wrap.rotation.y = FACE_CAM;
  const mixer = new THREE.AnimationMixer(o), acts = {};
  (KIT.anim[name] || []).forEach((clip) => { acts[clip.name] = mixer.clipAction(clip); });
  const pick = (n) => (ANIM_ALIAS[n] || [n]).map((x) => acts[x]).find(Boolean);
  const play = (n, { once = false, fade = 0.2 } = {}) => {
    const a = pick(n); if (!a) return;
    if (wrap.userData.cur === a && !once) return;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once;
    if (wrap.userData.cur && wrap.userData.cur !== a) wrap.userData.cur.crossFadeTo(a, fade, false);
    a.play(); wrap.userData.cur = a;
  };
  mixer.addEventListener('finished', () => { if (!wrap.userData.dead) play('idle'); });
  play('idle');
  mixer.update(Math.random() * 2);
  return { wrap, mixer, play };
}
const HIDE_PROPS = /^$/;
const clipKey = (n) => n;
const ANIM_ALIAS = {
  idle: ['Idle'], walk: ['Walking_A', 'Running_A'], jump: ['Jump_Full_Short', 'Jump_Full_Long'],
  'emote-yes': ['Cheer'], 'emote-no': ['Hit_A'], die: ['Death_A'],
};
function visibleBox(o) {
  const box = new THREE.Box3(), b = new THREE.Box3();
  o.traverse((c) => {
    if (!c.isMesh) return;
    for (let p = c; p; p = p.parent) if (!p.visible) return;
    b.setFromObject(c); box.union(b);
  });
  return box.isEmpty() ? new THREE.Box3().setFromObject(o) : box;
}
function addNonLa() {}
export async function setTokens(players) {
  tokens.forEach((tk) => tokenGroup.remove(tk.grp));
  readyAt = performance.now();
  if (!tokenGroup.userData.lit) { const l = new THREE.DirectionalLight('#ffffff', 1.1); l.position.set(6, 9, 8); tokenGroup.add(l); tokenGroup.userData.lit = true; }
  tokens = await Promise.all(players.map(async (p) => {
    const grp = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.005; grp.add(sh);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 40), new THREE.MeshBasicMaterial({ color: p.color || '#ffd23f', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; grp.add(ring);
    const ch = p.char != null ? charToken(p.char) : null;
    if (ch) {
      // đế quân cờ theo màu người chơi
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.07, 32), new THREE.MeshStandardMaterial({ color: p.color || '#ffd23f', roughness: 0.35, metalness: 0.1 }));
      base.position.y = 0.035; base.castShadow = true; base.receiveShadow = true; grp.add(base);
      ch.wrap.position.y = 0.07;
      grp.add(ch.wrap); tokenGroup.add(grp);
      return { grp, sp: ch.wrap, model: ch, ring, sh, h: TOKEN_H, mine: p.mine ?? !p.bot, from: null, to: null, t0: 0, dur: 0, arc: 0, cur: false, out: false };
    }
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
/** hoạt ảnh cảm xúc của quân 3D: victory -> mừng, shock -> lắc đầu, out -> ngã */
export function emote(pid, e) {
  const m = tokens[pid]?.model; if (!m || tokens[pid].from) return;
  if (e === 'victory') m.play(Math.random() < 0.5 ? 'jump' : 'emote-yes', { once: true });
  else if (e === 'shock') m.play('emote-no', { once: true });
  else if (e === 'out') { m.wrap.userData.dead = true; m.play('die', { once: true }); }
}
function slotPos(tile, k, n) { const a = SLOTS[Math.min(n, 4) - 1][k] ?? 0; return tp(tile, a, tile % 8 === 0 ? 0.55 : 0.52, TH); }
/** đặt / di chuyển quân: places[pid] = { tile, k, n, out }, opt = { dur, arc } */
export function placeToken(pid, place, opt = {}) {
  const tk = tokens[pid]; if (!tk || !place || !TILE[place.tile]) return;
  tk.out = !!place.out; tk.grp.visible = !tk.out;
  const target = slotPos(place.tile, place.k, place.n);
  if (!opt.dur || !tk.to) { tk.grp.position.copy(target); tk.to = target; tk.from = null; return; }
  tk.from = tk.grp.position.clone(); tk.to = target; tk.t0 = performance.now(); tk.dur = opt.dur; tk.arc = opt.arc ?? 0.35;
  if (tk.model) {
    const dx = target.x - tk.from.x, dz = target.z - tk.from.z;
    if (Math.hypot(dx, dz) > 0.01) tk.model.wrap.rotation.y = Math.atan2(dx, dz);
    tk.model.play(opt.dur > 600 ? 'jump' : 'walk', { fade: 0.08 });
  }
}
export function setCurrent(pid) { curPid = pid; tokens.forEach((tk, i) => { tk.cur = i === pid; }); }
function updateTokens(t, now, dt = 0.016) {
  tokens.forEach((tk) => {
    if (tk.model) {
      tk.model.mixer.update(dt);
      if (tk.from) {
        const k = Math.min(1, (now - tk.t0) / tk.dur), e = ease.inOut(k);
        tk.grp.position.lerpVectors(tk.from, tk.to, e);
        tk.sp.position.y = 0.07 + Math.sin(k * Math.PI) * tk.arc;
        if (k >= 1) { tk.from = null; tk.sp.position.y = 0.07; tk.walkEnd = now; }
      } else if (tk.walkEnd && now - tk.walkEnd > 140) {   // dừng hẳn: quay mặt về camera, đứng thở
        tk.walkEnd = 0; tk.model.wrap.rotation.y = FACE_CAM; if (!tk.model.wrap.userData.dead) tk.model.play('idle', { fade: 0.25 });
      }
      tk.ring.material.opacity = tk.cur ? 0.6 + 0.3 * Math.sin(t * 5) : 0;
      tk.ring.scale.setScalar(tk.cur ? 1 + 0.12 * Math.sin(t * 5) : 1);
      return;
    }
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
// 8 bộ xúc xắc; người chơi trên máy này dùng bộ đã chọn, người khác / máy dùng bộ khác
export const DICE_KEYS = ['classic', 'gold', 'jade', 'ruby', 'wood', 'neon', 'crystal', 'sakura'];
const DICE_SKINS = {
  classic: { bg: ['#ffffff', '#ece4d6'], pip: ['#5a5a5a', '#0d0d0d'], red: ['#ff6b6b', '#b3121b'], mat: { roughness: 0.3, clearcoat: 0.6 } },
  gold: { bg: ['#fff1b8', '#d39a12'], pip: ['#6b3d00', '#2e1a00'], red: ['#c0182a', '#5a0008'], mat: { roughness: 0.25, metalness: 0.6, clearcoat: 0.8 }, ring: '#b07a08' },
  jade: { bg: ['#a8f5cf', '#24905f'], pip: ['#fff6c8', '#d9a21b'], red: ['#fff6c8', '#d9a21b'], mat: { roughness: 0.15, clearcoat: 1 }, marble: '#ffffff' },
  ruby: { bg: ['#ff7a90', '#9c0f2a'], pip: ['#ffffff', '#f1dde3'], red: ['#ffe14d', '#d9a21b'], mat: { roughness: 0.15, clearcoat: 1 } },
  wood: { bg: ['#e0ac72', '#94592a'], pip: ['#3a2210', '#140802'], red: ['#7a1f10', '#2a0802'], mat: { roughness: 0.75 }, grain: true },
  neon: { bg: ['#232850', '#090b1d'], pip: ['#c8fbff', '#35d5ff'], red: ['#ffc4e2', '#ff4f8b'], mat: { roughness: 0.3, clearcoat: 0.9 }, glow: true },
  crystal: { bg: ['#f4fcff', '#9fd2ee'], pip: ['#3d74b0', '#16365e'], red: ['#3d74b0', '#16365e'], mat: { roughness: 0.05, clearcoat: 1 }, facets: true },
  sakura: { bg: ['#fff3f8', '#f5b5cf'], pip: ['#e0598d', '#93204c'], red: ['#e0598d', '#93204c'], mat: { roughness: 0.3, clearcoat: 0.7 }, flower: true },
};
const PIPS = { 1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]], 4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]], 6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]] };
// thứ tự mặt BoxGeometry: +x, -x, +y, -y, +z, -z
const FACE_N = [2, 5, 1, 6, 3, 4];
const FACE_DIR = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
function skinFace(n, S) {
  const [c, g] = canvas(256, 256);
  const bg = g.createRadialGradient(80, 70, 10, 128, 128, 200); bg.addColorStop(0, S.bg[0]); bg.addColorStop(1, S.bg[1]);
  g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
  if (S.grain) { for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(80,40,10,${0.12 + (k % 3) * 0.06})`; g.lineWidth = 2 + (k % 4); g.beginPath(); const y = k * 10 + 3; g.moveTo(0, y); for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 30 + k) * 5); g.stroke(); } }
  if (S.marble) { g.globalAlpha = 0.28; g.strokeStyle = S.marble; for (let k = 0; k < 7; k++) { g.lineWidth = 1 + (k % 3); g.beginPath(); let x = (k * 41) % 256, y = 0; g.moveTo(x, y); while (y < 256) { x += Math.sin(y / 23 + k) * 14; y += 12; g.lineTo(x, y); } g.stroke(); } g.globalAlpha = 1; }
  if (S.facets) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; [[0, 0, 256, 256], [256, 0, 0, 256], [128, 0, 128, 256], [0, 128, 256, 128]].forEach(([a, b, x, y]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(x, y); g.stroke(); }); }
  if (S.ring) { g.strokeStyle = S.ring; g.lineWidth = 10; g.strokeRect(12, 12, 232, 232); }
  if (S.flower && n === 1) {
    g.save(); g.translate(128, 128);
    for (let k = 0; k < 5; k++) { g.rotate((Math.PI * 2) / 5); const gr = g.createLinearGradient(0, 0, 0, -78); gr.addColorStop(0, S.pip[1]); gr.addColorStop(1, S.pip[0]); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-46, -24, -42, -78, -10, -80); g.lineTo(0, -66); g.lineTo(10, -80); g.bezierCurveTo(42, -78, 46, -24, 0, 0); g.fill(); }
    g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill(); g.restore();
    return texOf(c);
  }
  PIPS[n].forEach(([x, y]) => {
    const colr = n === 1 || n === 4 ? S.red : S.pip, R = n === 1 ? 34 : 23;
    if (S.glow) { g.shadowColor = colr[1]; g.shadowBlur = 26; }
    const r = g.createRadialGradient(x * 256 - 7, y * 256 - 7, 2, x * 256, y * 256, R); r.addColorStop(0, colr[0]); r.addColorStop(1, colr[1]);
    g.fillStyle = r; g.beginPath(); g.arc(x * 256, y * 256, R, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  });
  return texOf(c);
}
const diceMats = {};
function matsFor(key) {
  if (diceMats[key]) return diceMats[key];
  const S = DICE_SKINS[key] || DICE_SKINS.classic;
  return (diceMats[key] = FACE_N.map((n) => { const t = skinFace(n, S); return new THREE.MeshPhysicalMaterial({ map: t, ...S.mat, emissive: S.glow ? '#ffffff' : '#000000', emissiveMap: S.glow ? t : null, emissiveIntensity: S.glow ? 0.9 : 0 }); }));
}
let mySkin = (() => { try { const k = JSON.parse(localStorage.getItem('ctp_dice')); return DICE_KEYS.includes(k) ? k : 'classic'; } catch { return 'classic'; } })();
let curPid = 0, lastDice = [5, 6];
function skinOf(pid) {
  const tk = tokens[pid];
  if (!tk || tk.mine) return mySkin;
  const others = DICE_KEYS.filter((k) => k !== mySkin);
  return others[(pid * 3 + 1) % others.length];
}
export function setDiceSkin(k) { if (!DICE_KEYS.includes(k)) return; mySkin = k; try { localStorage.setItem('ctp_dice', JSON.stringify(k)); } catch {} if (dice.length) showDice(lastDice); }
export const getDiceSkin = () => mySkin;
function pipTex(n) { return skinFace(n, DICE_SKINS.classic); }
function buildDice() {
  const geo = new RoundedBoxGeometry(0.62, 0.62, 0.62, 5, 0.1);
  dice = [-0.42, 0.42].map((x) => { const m = new THREE.Mesh(geo, matsFor(mySkin)); m.castShadow = true; m.position.set(x, 0.32, 0); m.userData.home = new THREE.Vector3(x, 0.32, 0); boardGroup.add(m); return m; });
  showDice([5, 6]);
}
function quatFor(n, yaw) {
  const idx = FACE_N.indexOf(n);
  const q = new THREE.Quaternion().setFromUnitVectors(FACE_DIR[idx], new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(q);
}
export function showDice(d) {
  lastDice = d; const mats = matsFor(skinOf(curPid));
  dice.forEach((m, k) => { m.material = mats; m.quaternion.copy(quatFor(d[k], (isFlat ? 0 : Math.PI / 4) + k * 0.3)); m.position.copy(m.userData.home); });
}
export function rollDice(d, dur = 1000) {
  const mats = matsFor(skinOf(curPid));
  dice.forEach((m) => { m.material = mats; });
  return new Promise((res) => {
    const t0 = performance.now();
    const parts = dice.map((m, k) => ({ m, landed: false, q1: quatFor(d[k], (isFlat ? 0 : Math.PI / 4) + k * 0.3 + rnd(-0.2, 0.2)), axis: new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 0.3), rnd(-1, 1)).normalize(), turns: rnd(3, 5) * Math.PI * 2, home: m.userData.home, start: m.userData.home.clone().add(new THREE.Vector3(rnd(-0.6, 0.6), 0, rnd(0.8, 1.4))) }));
    anims.add(() => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      parts.forEach((p) => {
        const e = ease.outCubic(k);
        p.m.position.lerpVectors(p.start, p.home, e);
        const b = k < 0.55 ? Math.sin((k / 0.55) * Math.PI) * 1.5 : k < 0.82 ? Math.sin(((k - 0.55) / 0.27) * Math.PI) * 0.35 : Math.sin(((k - 0.82) / 0.18) * Math.PI) * 0.08;
        p.m.position.y = p.home.y + b;
        const spin = new THREE.Quaternion().setFromAxisAngle(p.axis, (1 - e) * p.turns);
        p.m.quaternion.copy(spin.multiply(p.q1));
        if (!p.landed && k > 0.5 && b < 0.04) { p.landed = true; puffs(p.m.position.clone().setY(0.05), 4); }
      });
      if (k >= 1) { sparkle(new THREE.Vector3(0, 0.5, 0), '#fff2b0', 14); res(); return false; }
      return true;
    });
  });
}
export function hideDice(on) { dice.forEach((m) => { m.visible = !on; }); }

// ======================= hiệu ứng: lấp lánh, cột sáng, pháo hoa =======================
let _spark;
function sparkTex() { if (_spark) return _spark; const [c, g] = canvas(64, 64); const r = g.createRadialGradient(32, 32, 1, 32, 32, 31); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return (_spark = texOf(c)); }
function spark(color, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s; }
function sparkle(pos, color = '#fff2b0', n = 14, up = 2.2) {
  for (let k = 0; k < n; k++) {
    const s = spark(color, rnd(0.08, 0.16)); s.position.copy(pos).add(new THREE.Vector3(rnd(-0.15, 0.15), 0, rnd(-0.15, 0.15))); fxGroup.add(s);
    const v = new THREE.Vector3(rnd(-1, 1), rnd(1, up), rnd(-1, 1)), t0 = performance.now(), life = rnd(0.7, 1.2);
    anims.add((t, dt) => { const a = (performance.now() - t0) / 1000; v.y -= 3.2 * dt; s.position.addScaledVector(v, dt); s.material.opacity = Math.max(0, 1 - a / life); if (a > life) { fxGroup.remove(s); return false; } return true; });
  }
}
let _beam;
function beamTex() { if (_beam) return _beam; const [c, g] = canvas(64, 256); const gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const hg = g.createLinearGradient(0, 0, 64, 0); hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(0.5, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = hg; g.fillRect(0, 0, 64, 256); return (_beam = texOf(c)); }
function beam(pos, color = '#ffd76a', h = 3.2, life = 1.6) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, h, 24, 1, true), new THREE.MeshBasicMaterial({ map: beamTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.position.copy(pos).setY(pos.y + h / 2); fxGroup.add(m);
  const t0 = performance.now();
  anims.add(() => { const a = (performance.now() - t0) / 1000 / life; m.material.opacity = a < 0.15 ? a / 0.15 : Math.max(0, 1 - (a - 0.15) / 0.85); m.scale.set(1 + Math.sin(a * Math.PI) * 0.3, 1, 1 + Math.sin(a * Math.PI) * 0.3); m.rotation.y += 0.02; if (a >= 1) { fxGroup.remove(m); return false; } return true; });
}
const FW_COLORS = ['#ff4d6d', '#ffd60a', '#3a86ff', '#06d6a0', '#ff9f1c', '#b15cff', '#ffffff'];
function firework(pos, delay = 0, color) {
  const colr = color || FW_COLORS[(Math.random() * FW_COLORS.length) | 0];
  const born = performance.now() + delay, topY = pos.y + rnd(2.4, 3.4);
  const rocket = spark('#fff4c2', 0.18); rocket.visible = false; rocket.position.copy(pos); fxGroup.add(rocket);
  let done = false;
  anims.add(() => {
    const a = (performance.now() - born) / 1000;
    if (a < 0) return true;
    if (!done) {
      rocket.visible = true; const k = Math.min(1, a / 0.55); rocket.position.y = pos.y + (topY - pos.y) * ease.outCubic(k);
      if (k >= 1) {
        done = true; fxGroup.remove(rocket);
        const c = rocket.position.clone();
        for (let i = 0; i < 40; i++) {
          const s = spark(i % 5 === 0 ? '#ffffff' : colr, rnd(0.1, 0.18)); s.position.copy(c); fxGroup.add(s);
          const v = new THREE.Vector3().randomDirection().multiplyScalar(rnd(1.6, 2.4)), b0 = performance.now(), life = rnd(1, 1.5);
          anims.add((t, dt) => { const q = (performance.now() - b0) / 1000; v.multiplyScalar(1 - dt * 1.8); v.y -= 1.2 * dt; s.position.addScaledVector(v, dt); s.material.opacity = Math.max(0, 1 - q / life) * (0.7 + 0.3 * Math.sin(q * 40)); if (q > life) { fxGroup.remove(s); return false; } return true; });
        }
        const fl = new THREE.PointLight(colr, 18, 8, 1.5); fl.position.copy(c); fxGroup.add(fl);
        const fb = performance.now(); anims.add(() => { const q = (performance.now() - fb) / 450; fl.intensity = 18 * Math.max(0, 1 - q); if (q >= 1) { fxGroup.remove(fl); return false; } return true; });
        return false;
      }
    }
    return true;
  });
}
/** pháo hoa trên một ô (lễ hội, festival) */
export function fireworks(i) { const p = tp(i, 0, 0.5, TH); for (let k = 0; k < 3; k++) firework(p.clone().add(new THREE.Vector3(rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3))), k * 260); cam.punch = Math.max(cam.punch, 0.06); }
/** mừng độc quyền: pháo hoa + cột sáng trên cả nhóm ô */
export function celebrate(list) {
  (list || []).forEach((i, k) => { const p = tp(i, 0, 0.4, TH); setTimeout(() => { beam(p, '#ffd76a', 3, 1.4); sparkle(p, '#ffe27a', 16); }, k * 220); firework(p, 300 + k * 260, ['#ffd60a', '#ff4d6d', '#06d6a0'][k % 3]); });
  cam.punch = Math.max(cam.punch, 0.1);
}
function buildFx(pos, lvl) {
  puffs(pos, 6); sparkle(pos.clone().setY(pos.y + 0.3), '#fff2b0', lvl >= 4 ? 26 : 12);
  if (lvl >= 4) { beam(pos, '#ffd76a', 3.6, 1.7); firework(pos, 450, '#ffd60a'); cam.punch = Math.max(cam.punch, 0.08); }
}
// camera: bám theo quân đang đi rồi lùi về toàn cảnh
const cam = { f: 1, tx: 0, tz: 0, follow: -1, until: 0, punch: 0, base: null, dir: null };
let pickActive = false, readyAt = 0;

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
  const items = [];
  if (amount < 100) {
    const P = [[0, 0], [0.42, -0.2], [-0.4, 0.22], [0.12, 0.45]];
    const n = Math.min(4, 1 + Math.floor(amount / 30));
    for (let k = 0; k < n; k++) items.push(['dun/coin_stack_small', 0.42, P[k][0], P[k][1]]);
  } else if (amount < 600) {
    const P = [[-0.3, -0.1], [0.32, 0.12], [0, 0.42], [-0.05, -0.45], [0.45, -0.38], [-0.48, 0.36]];
    const n = Math.min(6, Math.max(2, Math.round(amount / 90)));
    for (let k = 0; k < n; k++) items.push([k % 2 ? 'dun/coin_stack_medium' : 'dun/coin_stack_large', 0.5, P[k][0], P[k][1]]);
  } else {
    items.push(['dun/chest_gold', 0.9, 0, -0.05]);
    const P = [[0.62, 0.3], [-0.62, 0.32], [0.55, -0.5], [-0.5, -0.52]];
    const n = Math.min(4, 1 + Math.floor(amount / 500));
    for (let k = 0; k < n; k++) items.push(['dun/coin_stack_large', 0.48, P[k][0], P[k][1]]);
  }
  const t0 = performance.now();
  let top = 0.3;
  items.forEach(([name, fit, x, z], k) => {
    const m = kit(name, { fit }); if (!m) return;
    m.position.set(x, 3, z); m.rotation.y = rnd(-0.5, 0.5) + Math.PI / 4; pileGrp.add(m); top = Math.max(top, m.userData.height);
    const delay = k * 90;
    anims.add(() => { const a = (performance.now() - t0 - delay) / 420; if (a < 0) return true; const k2 = Math.min(1, a); m.position.y = 3 * (1 - ease.outBack(k2)); if (k2 >= 1) { m.position.y = 0; sparkle(m.position.clone().setY(0.2), '#ffe27a', 6); return false; } return true; });
  });
  hideDice(true);
  return project(new THREE.Vector3(0, top + 0.5, 0));
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
// ======================= mô hình: KayKit (CC0, kaylousberg.com) + Polyfork (CC BY 4.0, polyfork.dev) =======================
const KIT_BASE = 'skin/models/';
const KIT_FILES = {
  // nhà phố KayKit City Builder Bits: A..H thấp -> cao
  city: ['building_A_withoutBase', 'building_B_withoutBase', 'building_C_withoutBase', 'building_D_withoutBase', 'building_E_withoutBase',
    'building_F_withoutBase', 'building_G_withoutBase', 'building_H_withoutBase', 'streetlight', 'bench', 'bush', 'firehydrant', 'car_taxi', 'car_sedan', 'car_hatchback'].map((n) => `kk/city/${n}.gltf`),
  med: ['tree_single_A', 'tree_single_B', 'trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large', 'trees_B_medium', 'trees_B_small',
    'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E', 'cloud_big', 'cloud_small', 'hill_single_A', 'hill_single_B',
    'mountain_A_grass_trees', 'mountain_C_grass_trees', 'barrel', 'crate_A_big', 'tent'].map((n) => `kk/med/${n}.gltf`),
  dun: ['coin', 'coin_stack_small', 'coin_stack_medium', 'coin_stack_large', 'chest_gold'].map((n) => `kk/dun/${n}.glb`),
  pf: ['cherry-blossom-tree-3f7ab7', 'stone-lantern-d56d0a', 'sculpted-pine-e45d4f', 'azalea-bush-7bb14d', 'palm-tree-a307da', 'palm-sapling-ef7ae4',
    'beach-hut-fc7649', 'sandcastle-ddc562', 'lifebuoy-on-a-post-57421b', 'striped-deck-chair-70b506', 'tamarisk-bush-ba4337', 'small-fishing-boat-4ac0e3'].map((n) => `pf/${n}.glb`),
};
// nhân vật chibi KayKit Adventurers + Skeletons (models/kk/chr/c0..c7), thứ tự trùng CHARACTERS trong characters.js
const CHAR3D = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];
KIT_FILES.chr = CHAR3D.map((n) => `kk/chr/${n}.glb`);
const KIT = { ready: false, tpl: {}, anim: {}, skClone: null };
export const __kitFiles = () => KIT_FILES;
const kitKey = (f) => f.replace(/^(kk\/|pf\/)/, (m) => (m === 'pf/' ? 'pf/' : '')).replace(/\.(gltf|glb)$/, '');
async function loadKit() {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  KIT.skClone = (await import('three/addons/utils/SkeletonUtils.js')).clone;
  const loader = new GLTFLoader();
  const jobs = [];
  for (const files of Object.values(KIT_FILES)) {
    for (const f of files) {
      jobs.push(loader.loadAsync(KIT_BASE + f).then((gl) => {
        gl.scene.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            m.metalness = Math.min(m.metalness ?? 0, 0.1); m.roughness = Math.max(0.55, m.roughness ?? 1);
            if (m.map) { m.map.anisotropy = MAXANI; m.map.colorSpace = THREE.SRGBColorSpace; }
          });
        });
        const key = kitKey(f);
        KIT.tpl[key] = gl.scene;
        if (gl.animations?.length) KIT.anim[key] = gl.animations;
      }).catch((e) => console.warn('Không nạp được mô hình', f, e)));
    }
  }
  await Promise.all(jobs);
  KIT.ready = !!KIT.tpl['city/building_A_withoutBase'];
}
const _v3 = new THREE.Vector3();
/** bản sao mô hình, đặt đáy ở y=0, tâm ở giữa; fit = bề ngang tối đa, h = chiều cao */
function kit(name, { fit, h, hmax } = {}) {
  const src = KIT.tpl[name];
  if (!src) return null;
  // mô hình có khung xương (vd. cây đung đưa của Polyfork) phải nhân bản cả khung xương, nếu không sẽ vẽ ở gốc toạ độ
  let skinned = false; src.traverse((c) => { if (c.isSkinnedMesh) skinned = true; });
  const o = skinned && KIT.skClone ? KIT.skClone(src) : src.clone(true);
  const box = new THREE.Box3().setFromObject(o), size = box.getSize(_v3);
  let s = fit ? fit / Math.max(size.x, size.z) : h ? h / size.y : 1;
  if (hmax && size.y * s > hmax) s = hmax / size.y;
  o.scale.multiplyScalar(s);
  o.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
  const g = new THREE.Group(); g.add(o);
  g.userData.height = size.y * s;
  return g;
}
function tintLeaves() {}
// nhà theo cấp: cấp 1 nhà 2 tầng, cấp 3 nhà 4 tầng, khách sạn = toà cao nhất + bảng HOTEL; đế lát màu chủ đất
const LV_MODELS = {
  1: ['city/building_A_withoutBase', 'city/building_B_withoutBase'],
  2: ['city/building_C_withoutBase', 'city/building_D_withoutBase'],
  3: ['city/building_E_withoutBase', 'city/building_F_withoutBase'],
  4: ['city/building_G_withoutBase', 'city/building_H_withoutBase'],
};
const LV_FIT = { 1: [0.56, 0.62], 2: [0.6, 0.8], 3: [0.62, 1.0], 4: [0.64, 1.45] };
function ownerPlate(color, w = 0.74, d = 0.62) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new RoundedBoxGeometry(w, 0.07, d, 3, 0.03), new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.05 }));
  plate.position.y = 0.035; plate.receiveShadow = true; plate.castShadow = true; g.add(plate);
  const rim = new THREE.Mesh(new RoundedBoxGeometry(w + 0.04, 0.03, d + 0.04, 3, 0.015), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
  rim.position.y = 0.012; g.add(rim);
  return g;
}
function kitModel(type, lvl, st, color) {
  const g = new THREE.Group();
  if (type === 'resort') {
    g.add(ownerPlate(color, 0.7, 0.5));
    const hut = kit('pf/beach-hut-fc7649', { fit: 0.36 }); if (hut) { hut.position.set(-0.12, 0.07, -0.02); g.add(hut); }
    const palm = kit('pf/palm-sapling-ef7ae4', { h: 0.62 }); if (palm) { palm.position.set(0.2, 0.07, 0.05); g.add(palm); }
    const f = ownerFlag(color); f.scale.setScalar(0.8); f.position.set(0.3, 0.07, -0.18); g.add(f);
    return g;
  }
  if (lvl === 0) { g.add(ownerFlag(color)); return g; }
  const L = Math.min(4, lvl);
  const name = LV_MODELS[L][((st % 2) + 2) % 2];
  const m = kit(name, { fit: LV_FIT[L][0], hmax: LV_FIT[L][1] });
  if (!m) return buildModel(type, lvl, st, color);
  g.add(ownerPlate(color));
  m.position.y = 0.07; g.add(m);
  if (L === 4) hotelTop(g, m.userData.height + 0.07, color);
  else { const f = ownerFlag(color); f.scale.setScalar(0.72); f.position.set(0.32, 0.07, 0.22); g.add(f); }
  return g;
}

// ======================= cảnh nền theo theme (đảo nhỏ quanh bàn cờ) =======================
const BOARD_STYLE = {
  midnight: { top: '#2a3366', side: '#1a2147', ped: '#141a3a', trim: '#7B61FF', court: ['#232B55', '#1D2449', '#2E3870'] },
  wood: { top: '#f3e3c6', side: '#d9ae6e', ped: '#a26c38', trim: '#e0a030', court: ['#EBC994', '#E3BB84', '#9C6B3A'] },
  ocean: { top: '#fffaf0', side: '#bfe9e6', ped: '#1e3a5f', trim: '#ffb703', court: ['#FFF6E2', '#CFF3EE', '#1E3A5F'] },
  sakura: { top: '#ffffff', side: '#fbe6f0', ped: '#e5bcd3', trim: '#e8467c', court: ['#FFF8FB', '#FBE6F0', '#EBCFE0'] },
};
const TD_SCENES = {
  midnight: { ground: '#3b5a3a', rim: '#2c4630', dirt: '#2a2340',
    trees: ['tree_single_A', 'tree_single_B', 'trees_A_small', 'tree_single_A', 'trees_B_small'].map((n) => 'med/' + n),
    small: ['med/rock_single_A', 'med/rock_single_C', 'city/bush', 'med/rock_single_E', 'city/bench'],
    far: ['med/mountain_A_grass_trees', 'med/hill_single_A', 'med/mountain_C_grass_trees'],
    lamps: true, hemi: ['#9fb0ff', '#2a2340', 0.9], sun: ['#c9d4ff', 1.6], env: 0.35, exposure: 1.0 },
  wood: { ground: '#8cb556', rim: '#749a47', dirt: '#8a5a34',
    trees: ['tree_single_B', 'trees_B_small', 'tree_single_A', 'trees_A_small', 'tree_single_B'].map((n) => 'med/' + n),
    small: ['med/rock_single_B', 'med/barrel', 'city/bush', 'med/rock_single_D', 'city/bush', 'med/rock_single_C'],
    far: ['med/mountain_A_grass_trees', 'med/hill_single_B', 'med/mountain_C_grass_trees'],
    hemi: ['#fff6e6', '#7a5a3a', 1.05], sun: ['#fff0d8', 2.3], env: 0.5, exposure: 0.95 },
  ocean: { ground: '#f4dea0', rim: '#e6c77f', dirt: '#c9a464', water: true,
    trees: ['pf/palm-tree-a307da', 'pf/palm-sapling-ef7ae4', 'pf/palm-tree-a307da', 'pf/tamarisk-bush-ba4337'],
    small: ['pf/beach-hut-fc7649', 'pf/sandcastle-ddc562', 'pf/lifebuoy-on-a-post-57421b', 'pf/striped-deck-chair-70b506', 'med/rock_single_A'],
    far: [], boat: 'pf/small-fishing-boat-4ac0e3',
    hemi: ['#ffffff', '#5a9aa0', 1.2], sun: ['#fff6e0', 2.8], env: 0.6, exposure: 1.0 },
  sakura: { ground: '#acd38f', rim: '#90bd76', dirt: '#8a6b5a',
    trees: ['pf/cherry-blossom-tree-3f7ab7', 'pf/cherry-blossom-tree-3f7ab7', 'pf/sculpted-pine-e45d4f', 'pf/cherry-blossom-tree-3f7ab7'],
    small: ['pf/stone-lantern-d56d0a', 'pf/azalea-bush-7bb14d', 'med/rock_single_C', 'pf/azalea-bush-7bb14d', 'med/rock_single_A'],
    far: ['med/hill_single_A', 'med/hill_single_B'],
    hemi: ['#fff4fb', '#a07a8a', 1.15], sun: ['#fff1e6', 2.7], env: 0.6, exposure: 1.0 },
};
function courtyardTD(cols, trim) {
  const [c, g] = canvas(1024, 1024);
  const n = 8, s = 1024 / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = (x + y) % 2 ? cols[1] : cols[0]; g.fillRect(x * s, y * s, s, s); }
  const rg = g.createRadialGradient(512, 512, 60, 512, 512, 720); rg.addColorStop(0, 'rgba(255,255,255,.2)'); rg.addColorStop(1, 'rgba(0,0,0,.1)'); g.fillStyle = rg; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = cols[2]; g.globalAlpha = 0.35; g.lineWidth = 6; rr(g, 14, 14, 996, 996, 40); g.stroke(); g.globalAlpha = 1;
  // huy hiệu giữa sân
  g.save(); g.translate(512, 512); g.strokeStyle = trim; g.fillStyle = trim;
  g.globalAlpha = 0.6; g.lineWidth = 12; g.beginPath(); g.arc(0, 0, 330, 0, 7); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 300, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 226, 0, 7); g.stroke();
  const ring = [...'CỜ TỶ PHÚ • VIỆT NAM • MUA ĐẤT • XÂY NHÀ • '], step = (Math.PI * 2) / ring.length;
  g.font = `900 38px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = 0.7;
  ring.forEach((ch, k) => { g.save(); g.rotate(k * step); g.translate(0, -263); g.fillText(ch, 0, 0); g.restore(); });
  g.restore(); g.globalAlpha = 1;
  return texOf(c);
}
// số ngẫu nhiên cố định để cảnh không đổi giữa các lần mở
function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function lampPost() {
  const g = new THREE.Group();
  const m = kit('city/streetlight', { h: 1.7 });
  if (m) g.add(m);
  else { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.7, 8), std('#2a3050')); pole.position.y = 0.85; g.add(pole); }
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffc85a', emissiveIntensity: 3 }));
  head.position.set(0, 1.62, 0.32); g.add(head);
  const light = new THREE.PointLight('#ffcf7a', 9, 7, 1.6); light.position.set(0, 1.6, 0.32); g.add(light);
  return g;
}
function buildTD(key) {
  const P = TD_SCENES[key];
  const g = new THREE.Group();
  const R = 13.5, top = -0.95;
  const groundM = new THREE.MeshStandardMaterial({ color: P.ground, roughness: 1 });
  const rimM = new THREE.MeshStandardMaterial({ color: P.rim, roughness: 1 });
  const island = new THREE.Mesh(new THREE.CylinderGeometry(R, R - 0.25, 0.6, 72), [rimM, groundM, rimM]);
  island.position.y = top - 0.3; island.receiveShadow = true; g.add(island);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.25, R * 0.45, 4.5, 48, 4), new THREE.MeshStandardMaterial({ color: P.dirt, roughness: 1, flatShading: true }));
  { const p = under.geometry.attributes.position; const r2 = seeded(5); for (let k = 0; k < p.count; k++) { const y = p.getY(k); if (y < 2.2) { p.setX(k, p.getX(k) * (0.92 + r2() * 0.14)); p.setZ(k, p.getZ(k) * (0.92 + r2() * 0.14)); } } under.geometry.computeVertexNormals(); }
  under.position.y = top - 0.6 - 2.25; g.add(under);
  if (P.water) {
    const wm = waterMaterial({ deep: '#0f8fa8', sky: '#8ff1ea', sun: '#ffffff', fog: '#34E5D7', fogNear: 30, fogFar: 90 });
    const w = new THREE.Mesh(new THREE.CircleGeometry(90, 64), wm); w.rotation.x = -Math.PI / 2; w.position.y = top - 0.5; g.add(w);
    const shore = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.2, R + 2.2, 0.35, 72), new THREE.MeshStandardMaterial({ color: '#f6e7bd', roughness: 1 }));
    shore.position.y = top - 0.55; shore.receiveShadow = true; g.add(shore);
  }
  const rnd2 = seeded({ midnight: 7, wood: 11, ocean: 23, sakura: 31 }[key]);
  const half = W / 2 + 0.75;
  const spots = [];
  for (let tries = 0; spots.length < 58 && tries < 2000; tries++) {
    const a = rnd2() * Math.PI * 2, r = half + 0.4 + rnd2() * (R - half - 1.1);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < half && Math.abs(z) < half) continue;
    if (Math.hypot(x, z) > R - 0.6) continue;
    if (spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 1.15)) continue;
    spots.push([x, z]);
  }
  spots.forEach(([x, z], k) => {
    const front = x + z > 3.5;                 // phía gần camera: chỉ đồ thấp để không che bàn cờ
    const tall = !front && k % 3 !== 2;
    const name = tall ? P.trees[k % P.trees.length] : P.small[k % P.small.length];
    const cluster = /trees_/.test(name);
    const m = tall ? (cluster ? kit(name, { fit: 1.3 + rnd2() * 0.4, hmax: 2.4 }) : kit(name, { h: 1.9 + rnd2() * 1.1, hmax: 3.2 })) : kit(name, { fit: 0.55 + rnd2() * 0.35, hmax: 1.0 });
    if (!m) return;
    m.position.set(x, top, z); m.rotation.y = rnd2() * Math.PI * 2;
    g.add(m);
  });
  // đồi núi xa phía sau
  [].forEach((n, k) => {
    const m = kit(n, { fit: 4.2 + k * 0.6 }); if (!m) return;
    const a = -Math.PI * 0.75 + (k - 1) * 0.55;
    m.position.set(Math.cos(a) * (R - 2.2), top, Math.sin(a) * (R - 2.2)); m.rotation.y = rnd2() * 6.28; g.add(m);
  });
  if (P.lamps) [[-1, -1], [1, -1], [-1, 1]].forEach(([sx, sz]) => { const l = lampPost(); l.position.set(sx * (half + 0.55), top, sz * (half + 0.55)); l.rotation.y = Math.atan2(-sx, -sz); g.add(l); });
  // mây KayKit trôi trên trời
  const clouds = [];
  for (let k = 0; k < 5; k++) {
    const c = kit(k % 2 ? 'med/cloud_small' : 'med/cloud_big', { fit: 1.6 + rnd2() * 1.0 }); if (!c) continue;
    // mây chỉ trôi ở phía sau bàn cờ, ngang tầm nhìn (không bao giờ che bàn)
    c.userData.u = -14 + rnd2() * 28; c.userData.back = 13 + rnd2() * 6; c.userData.y = 6 + rnd2() * 3; c.userData.drift = 0.25 + rnd2() * 0.3;
    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    g.add(c); clouds.push(c);
  }
  g.userData.clouds = clouds;
  if (P.boat) {
    const boats = [0, 1].map((k) => { const b = kit(P.boat, { fit: 2.4 }); if (!b) return null; b.userData.orbit = { R: R + 5 + k * 3, sp: k ? -0.04 : 0.05, a: k * 2.6 }; g.add(b); return b; }).filter(Boolean);
    g.userData.boats = boats;
  }
  g.userData.style = { bg2d: true, sky: ['#000', '#000', '#000'], fog: ['#000', 50, 200], hemi: P.hemi, sun: P.sun, exposure: P.exposure, env: P.env };
  return g;
}
export function setTheme(name) {
  theme = TD_SCENES[name] ? name : 'midnight';
  if (curTheme) { sceneryGroup.remove(curTheme); }
  water = null;
  curTheme = THEMES[theme] || (THEMES[theme] = buildTD(theme));
  water = curTheme.children.find((o) => o.material?.uniforms?.uTime) || null;
  sceneryGroup.add(curTheme);
  const s = curTheme.userData.style;
  sky.visible = false;
  scene.fog = null;
  renderer.setClearColor(0x000000, 0);
  hemi.color.set(s.hemi[0]); hemi.groundColor.set(s.hemi[1]); hemi.intensity = s.hemi[2];
  sun.color.set(s.sun[0]); sun.intensity = s.sun[1];
  const b = BOARD_STYLE[theme];
  baseTop.color.set(b.top); baseSide.color.set(b.side); trimMat.color.set(b.trim);
  boardGroup.getObjectByName('pedestal').material.color.set(b.ped);
  courtyard.material.map?.dispose(); courtyard.material.map = courtyardTD(b.court, b.trim); courtyard.material.needsUpdate = true;
  renderer.toneMappingExposure = s.exposure;
  scene.environmentIntensity = s.env ?? 0.5;
}
function updateScenery(t, dt) {
  if (water) water.material.uniforms.uTime.value = t;
  if (!curTheme) return;
  const u = curTheme.userData;
  u.boats?.forEach((b) => { const o = b.userData.orbit; o.a += o.sp * dt; b.position.set(Math.cos(o.a) * o.R, -1.48 + Math.sin(t * 1.5 + o.R) * 0.05, Math.sin(o.a) * o.R); b.rotation.y = -o.a - (o.sp > 0 ? Math.PI / 2 : -Math.PI / 2); b.rotation.z = Math.sin(t * 1.2 + o.R) * 0.04; });
  u.clouds?.forEach((c) => { const d = c.userData; d.u += d.drift * dt; if (d.u > 15) d.u = -15; const k = Math.SQRT1_2; c.position.set(-d.back * k + d.u * k, d.y + Math.sin(t * 0.5 + d.drift * 9) * 0.15, -d.back * k - d.u * k); });
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
const syncHidden = () => { if (host) host.style.visibility = mode === 'home' ? 'hidden' : ''; };   // màn chính kiểu TDCaro: không vẽ 3D
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
  rect = { x: Wv * 0.2, y: 70, w: Wv * 0.6, h: Hv - 82 };   // giữa màn hình, 4 góc để thẻ người chơi
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
    D *= Math.max(pw / (rect.w * 0.93), ph / (rect.h * 0.93));
  }
  camera.position.copy(dir).multiplyScalar(D); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  cam.D = D; cam.dir = dir.clone();
  // dịch hình để tâm bàn nằm giữa khung .stage
  const c = new THREE.Vector3(0, 0.3, 0).project(camera);
  const cx = (c.x + 1) / 2 * Wv, cy = (1 - c.y) / 2 * Hv;
  const tx = rect.x + rect.w / 2, ty = rect.y + rect.h / 2;
  camera.setViewOffset(Wv, Hv, cx - tx, cy - ty, Wv, Hv);
  camera.updateProjectionMatrix();
  lastRectKey = `${Math.round(rect.x)}|${Math.round(rect.y)}|${Math.round(rect.w)}|${Math.round(rect.h)}`;
}
function updateCamera(t, dt = 0.016) {
  if (mode === 'debug') return;
  if (mode === 'game' && cam.D) {
    const now = performance.now(), mover = tokens.findIndex((tk) => tk.from);
    if (mover >= 0) { cam.follow = mover; cam.until = now + 900; }
    let tf = 1, tx = 0, tz = 0;
    if (!pickActive && cam.follow >= 0 && now < cam.until && tokens[cam.follow]) { const p = tokens[cam.follow].grp.position; tf = 0.74; tx = p.x * 0.5; tz = p.z * 0.5; } else cam.follow = -1;
    tf -= cam.punch;
    const k = 1 - Math.exp(-dt * 2.6);
    cam.f += (tf - cam.f) * k; cam.tx += (tx - cam.tx) * k; cam.tz += (tz - cam.tz) * k; cam.punch = Math.max(0, cam.punch - dt * 0.3);
    camera.position.copy(cam.dir).multiplyScalar(cam.D * cam.f); camera.position.x += cam.tx; camera.position.z += cam.tz;
    camera.lookAt(cam.tx, 0, cam.tz); camera.updateMatrixWorld();
  }
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
  if (paused || mode === 'home') return;
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime, now = performance.now();
  updateCamera(t, dt);
  updateScenery(t, dt);
  updateTiles(t, dt);
  updateBuildings(t, dt, now);
  updateGates(t, now);
  updateTokens(t, now, dt);
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

// ======================= dùng cho app/tools/portraits.html (chân dung nhân vật + ảnh xem trước xúc xắc) =======================
export const __bake = { THREE, RoundedBoxGeometry, loadKit, KIT, CHAR3D, visibleBox, quatFor, matsFor, DICE_KEYS };

export const __dbg = () => ({ scene, camera, curTheme });
