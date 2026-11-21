// Bộ vẽ 3D bản app (Three.js r170) — kiểu sa bàn đồ chơi (diorama · stroked toon): toon 4 bậc + viền mực mảnh,
// camera ¾ ống kính dài có xoay tự do (giới hạn) + đặt lại, phông tranh vẽ + mặt hồ gương soi bóng bàn cờ.
// Mọi mô hình đều tự dựng (bàn cờ bằng mã ở d3/board.js; nhân vật + công trình bằng script Blender ở app/tools/blender).
// app.js chỉ gọi các hàm xuất ra ở cuối file; luật chơi không phụ thuộc vào file này.
import { THREE, ctx, W, TH, tp, setMaxAni, loadFonts, OUTLINE } from './d3/core.js';
import { THEMES, themeOf } from './d3/themes.js';
import { buildBackdrop, setBackdropTheme, updateBackdrop } from './d3/backdrop.js';
import * as B from './d3/board.js';
import * as P from './d3/pieces.js';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';

export function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

let renderer, scene, camera, clock, raycaster, host, effect;
let hemi, key, fill;
let stageEl = null, mode = 'home';

// ======================= khởi tạo =======================
export async function init({ stage } = {}) {
  stageEl = stage;
  host = document.createElement('canvas');
  host.id = 'gl';
  document.body.prepend(host);
  renderer = new THREE.WebGLRenderer({ canvas: host, antialias: true, alpha: true, powerPreference: 'high-performance' });
  // vẽ dư điểm ảnh (tối thiểu ×1.75) để viền và quân cờ sắc nét cả trên màn hình thường
  renderer.setPixelRatio(Math.min(2, Math.max(1.75, devicePixelRatio || 1)));
  setMaxAni(Math.min(16, renderer.capabilities.getMaxAnisotropy() || 4));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  effect = new OutlineEffect(renderer, { defaultThickness: OUTLINE, defaultColor: [0.153, 0.137, 0.118], defaultAlpha: 1, defaultKeepAlive: true });
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(26, 1, 0.1, 400);
  camera.layers.enable(B.FX_LAYER);
  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();
  Object.assign(ctx, { renderer, scene, camera, project });

  // ánh sáng: nắng chính trên-trái có bóng, trời mát, đèn phụ yếu
  hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1.3); scene.add(hemi);
  key = new THREE.DirectionalLight('#fff3e6', 2.2);
  key.position.set(-6, 14, 8); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8.5, right: 8.5, top: 8.5, bottom: -8.5, near: 2, far: 40 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 2;
  scene.add(key, key.target);
  fill = new THREE.DirectionalLight('#d8d2ff', 0.55); fill.position.set(10, 6, -6); scene.add(fill);

  const g = (name, parent = scene) => { const o = new THREE.Group(); o.name = name; parent.add(o); return o; };
  ctx.groups.board = g('board');
  ctx.groups.tiles = g('tiles', ctx.groups.board);
  ctx.groups.bld = g('bld', ctx.groups.board);
  ctx.groups.tokens = g('tokens', ctx.groups.board);
  ctx.groups.fx = g('fx', ctx.groups.board);

  buildBackdrop(scene);
  await loadFonts();
  setTheme(ctx.theme);
  P.buildDice();
  P.buildMarker();
  P.preloadModels();
  bindOrbit();
  addEventListener('resize', () => fitCamera());
  fitCamera();
  renderer.setAnimationLoop(loop);
  document.body.classList.add('gl');
  return true;
}

// ======================= theme =======================
export function setTheme(name) {
  const k = THEMES[name] ? name : 'sakura';
  ctx.theme = k;
  const T = themeOf(k);
  hemi.color.set(T.hemi[0]); hemi.groundColor.set(T.hemi[1]); hemi.intensity = T.hemi[2];
  key.color.set(T.key[0]); key.intensity = T.key[1];
  fill.color.set(T.fill[0]); fill.intensity = T.fill[1];
  const ink = new THREE.Color(T.ink);
  effect.setSize?.(innerWidth, innerHeight);
  scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach((m) => { if (m.userData.outlineParameters?.visible !== false) m.userData.outlineParameters = { ...(m.userData.outlineParameters || {}), color: ink.toArray() }; }); });
  ctx.ink = ink.toArray();
  setBackdropTheme(k, T);
  B.setBoardTheme(T);
  // viền mực theo theme cho mọi vật liệu tạo sau
  scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach((m) => { if (m.userData.outlineParameters && m.userData.outlineParameters.visible !== false) m.userData.outlineParameters.color = ctx.ink; }); });
}

// ======================= camera: góc ¾ chuẩn + xoay tự do có giới hạn =======================
const HERO = { az: Math.PI / 4, el: 0.72 };            // nhìn từ góc +x+z (Xuất Phát ở gần), cao ~41°: thấy rõ mặt quân cờ, chữ ô vẫn đọc được
const orbit = { az: 0, el: 0, zoom: 1 };              // độ lệch do người chơi xoay / phóng
const LIM = { az: 1.05, elMin: 0.3, elMax: 1.22, zMin: 0.62, zMax: 1.3 };
let viewRect = null, baseD = 26;
let followOn = (() => { try { return JSON.parse(localStorage.getItem('ctp_follow') ?? 'true'); } catch { return true; } })();
export function setFollow(on) { followOn = !!on; try { localStorage.setItem('ctp_follow', JSON.stringify(followOn)); } catch {} }
export const getFollow = () => followOn;
const camDir = (az, el) => new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
function fitCamera() {
  if (!renderer) return;
  const Wv = innerWidth, Hv = innerHeight;
  renderer.setSize(Wv, Hv, false);
  host.style.width = Wv + 'px'; host.style.height = Hv + 'px';
  camera.aspect = Wv / Hv;
  camera.clearViewOffset();
  if (mode === 'home') { camera.updateProjectionMatrix(); return; }
  // vùng dành cho bàn cờ: giữa màn hình, chừa 4 góc cho thẻ người chơi
  // 4 thẻ người chơi nằm ở 4 góc: bàn hình thoi được rộng gần hết bề ngang ở giữa
  const rect = { x: Wv * 0.1, y: 64, w: Wv * 0.8, h: Hv - 92 };
  viewRect = rect;
  const dir = camDir(HERO.az, HERO.el);
  const pts = [];
  // căn theo mặt bàn (ô đất), bệ dưới được phép tràn ra mép
  const R = W / 2 + 0.3;
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => [-0.45, 0.35].forEach((y) => pts.push(new THREE.Vector3(sx * R, y, sz * R)))));
  let D = 30;
  for (let it = 0; it < 4; it++) {
    camera.position.copy(dir).multiplyScalar(D); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    let minx = 1, maxx = -1, miny = 1, maxy = -1;
    pts.forEach((p) => { const v = p.clone().project(camera); minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x); miny = Math.min(miny, v.y); maxy = Math.max(maxy, v.y); });
    const pw = ((maxx - minx) / 2) * Wv, ph = ((maxy - miny) / 2) * Hv;
    D *= Math.max(pw / (rect.w * 0.97), ph / (rect.h * 0.97));
  }
  baseD = D;
  // dịch hình để tâm bàn nằm giữa khung dành cho bàn
  camera.position.copy(dir).multiplyScalar(D); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  const c = new THREE.Vector3(0, 0.1, 0).project(camera);
  const cx = (c.x + 1) / 2 * Wv, cy = (1 - c.y) / 2 * Hv;
  camera.setViewOffset(Wv, Hv, cx - (rect.x + rect.w / 2), cy - (rect.y + rect.h / 2), Wv, Hv);
  camera.updateProjectionMatrix();
  effect.setSize?.(Wv, Hv);
}
export function resetView() { orbit.az = 0; orbit.el = 0; orbit.zoom = 1; }
function placeCamera(t, dt) {
  if (mode === 'debug') return;
  const now = performance.now(), cam = ctx.cam;
  if (mode === 'home') {
    const a = t * 0.05 + HERO.az;
    camera.position.copy(camDir(a, 0.55)).multiplyScalar(baseD * 1.05); camera.lookAt(0, -0.4, 0); camera.updateMatrixWorld();
    return;
  }
  const mover = P.tokens.findIndex((tk) => tk.from);
  if (mover >= 0) { cam.follow = mover; cam.until = now + 900; }
  let tf = 1, tx = 0, tz = 0;
  if (followOn && !B.pickActive && cam.follow >= 0 && now < cam.until && P.tokens[cam.follow]) { const p = P.tokens[cam.follow].grp.position; tf = 0.74; tx = p.x * 0.5; tz = p.z * 0.5; } else cam.follow = -1;
  tf -= cam.punch;
  const k = 1 - Math.exp(-dt * 2.6);
  cam.f += (tf - cam.f) * k; cam.tx += (tx - cam.tx) * k; cam.tz += (tz - cam.tz) * k; cam.punch = Math.max(0, cam.punch - dt * 0.3);
  const s = orbit;
  s.cAz = (s.cAz ?? 0) + (s.az - (s.cAz ?? 0)) * Math.min(1, dt * 10);
  s.cEl = (s.cEl ?? 0) + (s.el - (s.cEl ?? 0)) * Math.min(1, dt * 10);
  s.cZ = (s.cZ ?? 1) + (s.zoom - (s.cZ ?? 1)) * Math.min(1, dt * 8);
  const el = Math.min(LIM.elMax, Math.max(LIM.elMin, HERO.el + s.cEl));
  const dir = camDir(HERO.az + s.cAz, el);
  camera.position.copy(dir).multiplyScalar(baseD * cam.f * s.cZ); camera.position.x += cam.tx; camera.position.z += cam.tz;
  camera.lookAt(cam.tx, 0, cam.tz); camera.updateMatrixWorld();
}
function backdropView() {
  const s = orbit;
  return { horizon: 0.40 - ((s.cEl ?? 0)) * 0.75, zoom: 1 + ((s.cZ ?? 1) * ctx.cam.f - 1) * -0.18, shiftX: -(s.cAz ?? 0) * innerWidth * 0.32, shiftY: 0 };
}
function bindOrbit() {
  // xoay bằng kéo chuột / ngón tay trên vùng bàn cờ; nhấp (không kéo) vẫn chọn ô như cũ
  let drag = null, moved = false;
  const inStage = (e) => mode === 'game' && stageEl && e.target.closest?.('.stage') && !e.target.closest('.hud > *, button, input, select, a, .modal, .panel');
  addEventListener('pointerdown', (e) => { if (!inStage(e) || e.button > 0) return; drag = { x: e.clientX, y: e.clientY, az: orbit.az, el: orbit.el }; moved = false; }, true);
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true;
    orbit.az = Math.max(-LIM.az, Math.min(LIM.az, drag.az - dx * 0.006));
    orbit.el = Math.max(LIM.elMin - HERO.el, Math.min(LIM.elMax - HERO.el, drag.el + dy * 0.005));
  }, true);
  addEventListener('pointerup', () => { drag = null; }, true);
  addEventListener('pointercancel', () => { drag = null; }, true);
  // kéo xong thì không tính là nhấp chọn ô
  addEventListener('click', (e) => { if (moved) { moved = false; e.stopPropagation(); e.preventDefault(); } }, true);
  addEventListener('wheel', (e) => { if (!inStage(e)) return; orbit.zoom = Math.max(LIM.zMin, Math.min(LIM.zMax, orbit.zoom * (e.deltaY > 0 ? 1.08 : 1 / 1.08))); }, { passive: true });
  addEventListener('dblclick', (e) => { if (inStage(e)) resetView(); });
  addEventListener('keydown', (e) => {
    if (mode !== 'game' || e.target.closest?.('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (k === 'r') resetView();
    else if (e.key === 'ArrowLeft') orbit.az = Math.max(-LIM.az, orbit.az - 0.12);
    else if (e.key === 'ArrowRight') orbit.az = Math.min(LIM.az, orbit.az + 0.12);
    else if (e.key === 'ArrowUp') orbit.el = Math.min(LIM.elMax - HERO.el, orbit.el + 0.08);
    else if (e.key === 'ArrowDown') orbit.el = Math.max(LIM.elMin - HERO.el, orbit.el - 0.08);
  });
}
const syncHidden = () => { if (host) host.style.visibility = mode === 'home' ? 'hidden' : ''; };
export function setMode(m) { mode = m; if (m !== 'game') resetView(); fitCamera(); syncHidden(); }
/** chỉ để kiểm tra hình: đặt camera tự do */
export function debugCam(p, t, fov = 26) { mode = 'debug'; camera.clearViewOffset(); camera.fov = fov; camera.position.set(...p); camera.lookAt(...t); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); }
/** chỉ để kiểm tra hình: xoay camera theo độ lệch (radian) so với góc chuẩn */
export function debugOrbit(az = 0, el = 0, zoom = 1) { Object.assign(orbit, { az, el, zoom, cAz: az, cEl: el, cZ: zoom }); }

// ======================= vòng lặp =======================
let paused = false;
document.addEventListener('visibilitychange', () => { paused = document.hidden; });
function render() {
  renderer.render(scene, camera);
  // lượt vẽ viền mực: bỏ quầng sáng / hạt (lớp FX) và mặt hồ
  ctx.outlinePass = true;
  camera.layers.disable(B.FX_LAYER);
  effect.renderOutline(scene, camera);
  camera.layers.enable(B.FX_LAYER);
  ctx.outlinePass = false;
}
function loop() {
  if (paused || mode === 'home') return;
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime, now = performance.now();
  placeCamera(t, dt);
  updateBackdrop(t, dt, backdropView());
  B.updateBoard(t, dt, now);
  P.updatePieces(t, dt, now);
  for (const f of ctx.anims) if (f(t, dt) === false) ctx.anims.delete(f);
  render();
}
/** vẽ ngay 1 khung hình (dùng khi chụp ảnh kiểm tra) */
export function renderNow(t = clock?.elapsedTime ?? 0) { placeCamera(t, 0.016); updateBackdrop(t, 0.016, backdropView()); B.updateBoard(t, 0.016, performance.now()); P.updatePieces(t, 0.016, performance.now()); render(); }

// ======================= toạ độ màn hình + chọn ô =======================
function project(v) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; }
export const tileScreen = (i) => project(tp(i, 0, 0.5, TH + 0.2));
export const centerScreen = () => project(new THREE.Vector3(0, 0.4, 0));
export function pickTile(x, y) {
  raycaster.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
  const hit = raycaster.intersectObjects(B.tiles.map((T) => T.body), false)[0];
  return hit ? hit.object.userData.tile : -1;
}
export { W as BOARD_W };

// ======================= giao diện cho app.js (giữ nguyên tên hàm của bản cũ) =======================
export const { buildTiles, updateTile, setPicks, setChosen, stepFlash, flashTile, setFestGates } = B;
export const {
  setBuilding, buildingKey, fxBurn, fxShake, collapse, setTokens, emote, placeToken, setCurrent,
  DICE_KEYS, setDiceSkin, getDiceSkin, showDice, rollDice, hideDice, fireworks, celebrate, setTarget, showPile, clearPile, setHouseStyle,
} = P;
export const __dbg = () => ({ scene, camera, ctx, B, P, orbit });
