// Lõi dùng chung của bản vẽ 3D kiểu sa bàn đồ chơi (diorama · stroked toon):
// hình học bàn cờ, tiện ích canvas/chữ, vật liệu toon 4 bậc + viền mực, trạng thái chạy chung (ctx).
import * as THREE from 'three';
export { THREE };

// ======================= hình học bàn cờ (khớp js/app.js: 32 ô, Xuất Phát ở góc gần người xem) =======================
export const CORNER = 1.45, GAP = 0.05, TH = 0.16;
export const SIZES = [CORNER, 1, 1, 1, 1, 1, 1, 1, CORNER];
export const W = SIZES.reduce((a, b) => a + b, 0) + GAP * 8;
const cellC = (k) => { let x = -W / 2; for (let j = 1; j < k; j++) x += SIZES[j - 1] + GAP; return x + SIZES[k - 1] / 2; };
export function gridPos(i) {
  if (i <= 8) return [9, 9 - i];
  if (i <= 16) return [9 - (i - 8), 1];
  if (i <= 24) return [1, 1 + (i - 16)];
  return [1 + (i - 24), 9];
}
export const sideOf = (i) => (i % 8 === 0 ? 'c' : ['b', 'l', 't', 'r'][Math.floor(i / 8)]);
// khung toạ độ của ô: along = chiều chữ chạy, far = phía xa người xem (nửa xa để nhà, nửa gần để chữ)
export const TILE = [];
for (let i = 0; i < 32; i++) {
  const [r, c] = gridPos(i), side = sideOf(i);
  const col = side === 'l' || side === 'r';
  TILE.push({
    x: cellC(c), z: cellC(r), w: SIZES[c - 1], d: SIZES[r - 1], side,
    along: col ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(1, 0, 0),
    far: col ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 0, -1),
    alen: side === 'c' ? CORNER : 1, dlen: CORNER,
    rotY: col ? Math.PI / 2 : 0,
  });
}
/** điểm trên mặt ô: a theo chiều chữ (-0.5..0.5), s từ mép xa (0) tới mép gần (1) */
export function tp(i, a = 0, s = 0.5, y = TH) {
  const t = TILE[i];
  return new THREE.Vector3(t.x, y, t.z).addScaledVector(t.along, a * t.alen).addScaledVector(t.far, t.dlen * (0.5 - s));
}
/** góc quay để mặt tiền (+Z của mô hình) nhìn ra mép gần của ô (phía chữ) */
export const faceNear = (i) => Math.atan2(-TILE[i].far.x, -TILE[i].far.z);

// ======================= tiện ích =======================
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const ease = {
  outBack: (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
export const col = (c) => new THREE.Color(c);
export const mixHex = (a, b, t) => '#' + col(a).lerp(col(b), t).getHexString();
/** số ngẫu nhiên cố định (cảnh giống nhau mỗi lần mở) */
export function seeded(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export let MAXANI = 4;
export const setMaxAni = (v) => { MAXANI = v; };
export function texOf(c, { repeat, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAXANI;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
export function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// chữ: Be Vietnam Pro (đủ dấu tiếng Việt, nạp sẵn từ skin/fonts) — không có thì dùng font hệ thống
export const FONT = '"Be Vietnam Pro", "Segoe UI", Arial, sans-serif';
export function fitText(g, text, maxW, size, weight = 800) {
  let s = size;
  do { g.font = `${weight} ${s}px ${FONT}`; if (g.measureText(text).width <= maxW) break; s -= 2; } while (s > 10);
  return s;
}
/** tách tên dài thành 2 dòng cân nhau */
export function lines(g, text, maxW, size, weight = 800) {
  g.font = `${weight} ${size}px ${FONT}`;
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
export function loadImg(src) {
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  return imgCache.get(src);
}
export async function loadFonts(base = 'skin/fonts/') {
  const faces = [['Be Vietnam Pro', 'BeVietnamPro-Medium.ttf', '500'], ['Be Vietnam Pro', 'BeVietnamPro-Bold.ttf', '700'],
    ['Be Vietnam Pro', 'BeVietnamPro-ExtraBold.ttf', '800'], ['Be Vietnam Pro', 'BeVietnamPro-Black.ttf', '900']];
  await Promise.all(faces.map(async ([fam, file, weight]) => {
    try { const f = new FontFace(fam, `url(${base}${file})`, { weight }); await f.load(); document.fonts.add(f); } catch {}
  }));
  try { await document.fonts.ready; } catch {}
}

// ======================= vật liệu: toon 4 bậc + viền mực mảnh (diorama · stroked toon) =======================
export const BANDS = [68, 122, 184, 246];
export const OUTLINE = 0.0032;
export const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array(BANDS), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
export function setOutline(material, enabled = true, thickness = OUTLINE) {
  material.userData.outlineParameters = { ...(material.userData.outlineParameters || {}), visible: enabled, thickness };
  return material;
}
const toonCache = new Map();
/** vật liệu toon; màu trơn được dùng chung theo khoá, có map thì tạo riêng */
export function toon(color, { outline = true, stroke = OUTLINE, shared = true, ...opts } = {}) {
  const key = shared && !opts.map ? `${new THREE.Color(color).getHexString()}|${outline}|${stroke}|${JSON.stringify(opts)}` : null;
  if (key && toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...opts });
  setOutline(m, outline, stroke);
  if (key) toonCache.set(key, m);
  return m;
}
/** vật liệu không đổ bóng sáng tối (chữ in, quầng sáng, decal) — không viền */
export function flat(color, opts = {}) { return setOutline(new THREE.MeshBasicMaterial({ color, ...opts }), false); }
/** đổi mọi vật liệu của mô hình nạp từ .glb sang toon, giữ màu + texture */
export function toToon(root, { outline = true, stroke = OUTLINE, tint = null } = {}) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (m) => {
      const t = new THREE.MeshToonMaterial({ color: m.color ? m.color.clone() : new THREE.Color('#ffffff'), map: m.map || null, gradientMap: ramp,
        transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, vertexColors: m.vertexColors });
      if (m.map) m.map.anisotropy = MAXANI;
      t.name = m.name;
      if (tint && tint[m.name]) t.color.set(tint[m.name]);
      setOutline(t, outline, stroke);
      return t;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    o.castShadow = true; o.receiveShadow = true;
  });
  return root;
}
/** hình bóng tròn mềm đặt sát nền — neo vật vào mặt bàn (diorama: contact shadow) */
let _contact;
export function contactTex() {
  if (_contact) return _contact;
  const [c, g] = canvas(128, 128);
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(40,20,40,.55)'); r.addColorStop(0.55, 'rgba(40,20,40,.22)'); r.addColorStop(1, 'rgba(40,20,40,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return (_contact = texOf(c));
}
export function contactShadow(w, d = w, opacity = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), flat('#ffffff', { map: contactTex(), transparent: true, depthWrite: false, opacity }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}
let _glow;
export function glowTex() {
  if (_glow) return _glow;
  const [c, g] = canvas(128, 128);
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 62); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return (_glow = texOf(c));
}

// ======================= trạng thái chạy chung =======================
export const ctx = {
  renderer: null, scene: null, camera: null,
  groups: {},              // board, tiles, bld, tokens, fx
  anims: new Set(),        // hàm cập nhật mỗi khung hình: (t, dt) => false để dừng
  theme: 'sakura',
  readyAt: 0,
  cam: { f: 1, tx: 0, tz: 0, follow: -1, until: 0, punch: 0 },
  outlinePass: false,
  project: (v) => [0, 0],
};
