// Quân cờ (12 nhân vật chibi tự dựng bằng Blender, có khung xương + 6 hoạt ảnh), công trình Việt Nam theo cấp
// (13 mô hình tự dựng, mái/đèn theo màu chủ đất), xúc xắc 12 bộ, đống tiền, hiệu ứng (lấp lánh, cột sáng, pháo hoa).
import {
  THREE, ctx, TILE, TH, tp, faceNear, canvas, texOf, rr, FONT, toon, flat, toToon, contactShadow, glowTex, col, mixHex, ease, rnd,
} from './core.js';
import { onFx, setTileTarget } from './board.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const glbCache = new Map();
function glb(path) { if (!glbCache.has(path)) glbCache.set(path, loader.loadAsync(path).catch((e) => { console.warn('không nạp được', path, e); return null; })); return glbCache.get(path); }
export const preloadModels = () => Promise.all([
  ...[...Array(12).keys()].map((k) => glb(`skin/models3/chars/c${k}.glb`)),
  ...Object.values(BUILD).flat().map((n) => glb(`skin/models3/build/${n}.glb`)),
]);

// ======================= quân cờ =======================
export let tokens = [];
export let curPid = 0;
const TOKEN_H = 0.8;
const SLOTS = [[0], [-0.2, 0.2], [-0.27, 0, 0.27], [-0.33, -0.11, 0.11, 0.33]];
const ANIM = { idle: 'idle', walk: 'walk', jump: 'jump', 'emote-yes': 'cheer', 'emote-no': 'hit', die: 'die' };
const camYaw = () => { const c = ctx.camera.position; return Math.atan2(c.x - ctx.cam.tx, c.z - ctx.cam.tz); };

async function charToken(k) {
  const gl = await glb(`skin/models3/chars/c${((k % 12) + 12) % 12}.glb`);
  if (!gl) return null;
  const o = SkeletonUtils.clone(gl.scene);
  toToon(o, { stroke: 0.0034 });
  o.traverse((c) => { if (c.isMesh) c.frustumCulled = false; });
  o.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(o), H = box.max.y - box.min.y || 1;
  const s = TOKEN_H / H; o.scale.multiplyScalar(s); o.position.y = -box.min.y * s;
  const wrap = new THREE.Group(); wrap.add(o);
  const mixer = new THREE.AnimationMixer(o), acts = {};
  gl.animations.forEach((clip) => { acts[clip.name] = mixer.clipAction(clip); });
  const play = (n, { once = false, fade = 0.2 } = {}) => {
    const a = acts[ANIM[n] || n]; if (!a) return;
    if (wrap.userData.cur === a && !once) return;
    a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); a.clampWhenFinished = once;
    if (wrap.userData.cur && wrap.userData.cur !== a) wrap.userData.cur.crossFadeTo(a, fade, false);
    a.play(); wrap.userData.cur = a;
  };
  mixer.addEventListener('finished', () => { if (!wrap.userData.dead) play('idle'); });
  play('idle'); mixer.update(Math.random() * 2);
  return { wrap, mixer, play };
}
function plinth(color) {
  // đế tròn: vành màu người chơi + mặt ngà
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.215, 0.06, 40), toon(color, { stroke: 0.0026 })); ring.position.y = 0.03; g.add(ring);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.16, 0.022, 40), toon('#fbf3e3', { outline: false })); top.position.y = 0.068; g.add(top);
  const sh = contactShadow(0.62, 0.62, 0.9); sh.position.y = 0.004; g.add(sh);
  g.traverse((o) => { if (o.isMesh && o !== sh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function turnArrow(color) {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.13, 4), toon(color, { stroke: 0.0026 })); cone.rotation.x = Math.PI; g.add(cone);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  halo.scale.setScalar(0.42); onFx(halo); g.add(halo);
  return g;
}
function toyPlane(color) {
  // máy bay đồ chơi: thân trắng ngà sọc màu người chơi, cánh, đuôi, cánh quạt quay
  const g = new THREE.Group(), body = toon('#f8f3ea'), stripe = toon(color, { stroke: 0.0024 }), dark = toon('#3b3f4f'), glass = toon('#8fd0f5');
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.36, 6, 14), body); fus.rotation.x = Math.PI / 2; g.add(fus);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.07, 18), stripe); band.rotation.x = Math.PI / 2; band.position.z = -0.05; g.add(band);
  const cock = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass); cock.scale.set(1, 0.8, 1.5); cock.position.set(0, 0.055, 0.1); g.add(cock);
  const wing = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.028, 0.15, 2, 0.012), stripe); wing.position.set(0, -0.01, 0.02); g.add(wing);
  const tailW = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.022, 0.08, 2, 0.01), stripe); tailW.position.set(0, 0.02, -0.25); g.add(tailW);
  const fin = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.13, 0.1, 2, 0.01), stripe); fin.position.set(0, 0.09, -0.25); g.add(fin);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 12), dark); nose.rotation.x = Math.PI / 2; nose.position.z = 0.29; g.add(nose);
  const prop = new THREE.Group(); prop.position.z = 0.31;
  [0, Math.PI / 2].forEach((a) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.26, 0.012, 1, 0.005), dark); b.rotation.z = a; prop.add(b); });
  g.add(prop); g.userData.prop = prop;
  [-1, 1].forEach((s) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), dark); w.rotation.z = Math.PI / 2; w.position.set(s * 0.07, -0.11, 0.08); g.add(w); });
  const sh = contactShadow(1.2, 0.9, 0.7); sh.name = 'planeShadow';
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.scale.setScalar(1.8); g.userData.size = 1.8;
  g.userData.shadow = sh;
  return g;
}
function planeLeave(plane, dir) {
  // thả quân xong: máy bay bay vút lên rồi biến mất
  const t0 = performance.now(), p0 = plane.position.clone(), sh = plane.userData.shadow;
  ctx.anims.add((t, dt) => {
    const a = (performance.now() - t0) / 900;
    plane.position.copy(p0).addScaledVector(dir, a * 2.6).add(new THREE.Vector3(0, a * a * 1.6, 0));
    plane.rotation.x = -0.35 * Math.min(1, a * 2);
    plane.userData.prop.rotation.z += dt * 40;
    plane.scale.setScalar(plane.userData.size * Math.max(0.01, 1 - Math.max(0, a - 0.6) / 0.4));
    sh.material.opacity = Math.max(0, 0.7 - a);
    if (a >= 1) { ctx.groups.fx.remove(plane); ctx.groups.fx.remove(sh); return false; }
    return true;
  });
}

export async function setTokens(players) {
  tokens.forEach((tk) => ctx.groups.tokens.remove(tk.grp));
  ctx.readyAt = performance.now();
  tokens = await Promise.all(players.map(async (p) => {
    const color = p.color || '#ffd23f';
    const grp = new THREE.Group();
    grp.add(plinth(color));
    const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.23, 0.3, 40), flat(color, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    glowRing.rotation.x = -Math.PI / 2; glowRing.position.y = 0.006; grp.add(glowRing);
    const ch = await charToken(p.char ?? 0);
    const arrow = turnArrow(color); arrow.visible = false; grp.add(arrow);
    if (ch) { ch.wrap.position.y = 0.08; grp.add(ch.wrap); }
    ctx.groups.tokens.add(grp);
    return { grp, model: ch, color, ring: glowRing, arrow, mine: p.mine ?? !p.bot, from: null, to: null, t0: 0, dur: 0, arc: 0, cur: false, out: false, walkEnd: 0, plane: null };
  }));
}
/** hoạt ảnh cảm xúc: victory -> reo hò, shock -> giật mình, out -> ngã */
export function emote(pid, e) {
  const tk = tokens[pid], m = tk?.model; if (!m || tk.from) return;
  if (e === 'victory') m.play(Math.random() < 0.5 ? 'jump' : 'emote-yes', { once: true });
  else if (e === 'shock') m.play('emote-no', { once: true });
  else if (e === 'out') { m.wrap.userData.dead = true; m.play('die', { once: true }); }
}
function slotPos(tile, k, n) { const a = SLOTS[Math.min(n, 4) - 1][k] ?? 0; return tp(tile, a, tile % 8 === 0 ? 0.56 : 0.7, TH); }
/** đặt / di chuyển quân: place = { tile, k, n, out }, opt = { dur, arc } */
export function placeToken(pid, place, opt = {}) {
  const tk = tokens[pid]; if (!tk || !place || !TILE[place.tile]) return;
  tk.out = !!place.out; tk.grp.visible = !tk.out;
  const target = slotPos(place.tile, place.k, place.n);
  if (!opt.dur || !tk.to) { tk.grp.position.copy(target); tk.to = target; tk.from = null; return; }
  tk.from = tk.grp.position.clone(); tk.to = target; tk.t0 = performance.now(); tk.dur = opt.dur; tk.arc = opt.arc ?? 0.35;
  if (tk.arc >= 1) {
    // bay qua Sân Bay: máy bay đồ chơi xuống đón, chở quân qua bàn rồi thả xuống ô đích
    if (tk.plane) { ctx.groups.fx.remove(tk.plane); ctx.groups.fx.remove(tk.plane.userData.shadow); }
    tk.plane = toyPlane(tk.color); ctx.groups.fx.add(tk.plane, tk.plane.userData.shadow);
    tk.arc = Math.min(tk.arc * 0.62, 1.5);
    if (tk.model) { const dx = target.x - tk.from.x, dz = target.z - tk.from.z; tk.model.wrap.rotation.y = Math.atan2(dx, dz); tk.model.play('emote-yes', { fade: 0.1 }); }
    return;
  }
  if (tk.model) {
    const dx = target.x - tk.from.x, dz = target.z - tk.from.z;
    if (Math.hypot(dx, dz) > 0.01) tk.model.wrap.rotation.y = Math.atan2(dx, dz);
    tk.model.play(opt.dur > 600 ? 'jump' : 'walk', { fade: 0.08 });
  }
}
export function setCurrent(pid) { curPid = pid; tokens.forEach((tk, i) => { tk.cur = i === pid; }); }
function updateTokens(t, now, dt) {
  const yaw = camYaw();
  tokens.forEach((tk) => {
    const m = tk.model;
    m?.mixer.update(dt);
    if (tk.from && tk.plane) {
      // 0–0.18: máy bay hạ xuống đón · 0.18–0.86: chở bay theo vòng cung · 0.86–1: hạ cánh thả quân
      const k = Math.min(1, (now - tk.t0) / tk.dur), pl = tk.plane;
      const dir = new THREE.Vector3().subVectors(tk.to, tk.from).setY(0); const len = dir.length() || 1; dir.divideScalar(len);
      const u = THREE.MathUtils.clamp((k - 0.18) / 0.68, 0, 1), e = ease.inOut(u);
      tk.grp.position.lerpVectors(tk.from, tk.to, e);
      const lift = Math.sin(u * Math.PI) * tk.arc + 0.42 * Math.min(1, k / 0.18) * Math.min(1, (1 - k) / 0.14);
      pl.position.copy(tk.grp.position).add(new THREE.Vector3(0, lift + 0.12, 0));
      if (k < 0.18) pl.position.addScaledVector(dir, -(1 - k / 0.18) * 1.2).y += (1 - k / 0.18) * 1.0;
      pl.rotation.set(0, Math.atan2(dir.x, dir.z), 0); pl.rotateX(-Math.cos(u * Math.PI) * 0.35 * (u > 0 && u < 1 ? 1 : 0));
      pl.userData.prop.rotation.z += dt * 45;
      const sh = pl.userData.shadow; sh.position.set(pl.position.x, TH + 0.01, pl.position.z); sh.material.opacity = 0.7 / (1 + lift * 1.2);
      // quân ngồi lọt vào buồng lái (nửa dưới khuất trong thân máy bay), lùi nhẹ ra sau mũi
      if (m) { m.wrap.position.y = k < 0.18 ? 0.08 : Math.max(0.08, lift + 0.02); m.wrap.position.x = k < 0.18 ? 0 : -dir.x * 0.06; m.wrap.position.z = k < 0.18 ? 0 : -dir.z * 0.06; }
      if (k >= 1) { tk.from = null; if (m) { m.wrap.position.set(0, 0.08, 0); } tk.walkEnd = now; planeLeave(pl, dir); tk.plane = null; }
    } else if (tk.from) {
      const k = Math.min(1, (now - tk.t0) / tk.dur), e = ease.inOut(k);
      tk.grp.position.lerpVectors(tk.from, tk.to, e);
      if (m) m.wrap.position.y = 0.08 + Math.sin(k * Math.PI) * tk.arc;
      if (k >= 1) { tk.from = null; if (m) m.wrap.position.y = 0.08; tk.walkEnd = now; }
    } else if (m && tk.walkEnd && now - tk.walkEnd > 140) {
      tk.walkEnd = 0; if (!m.wrap.userData.dead) m.play('idle', { fade: 0.25 });
    }
    // đứng yên: quay mặt về phía người xem
    if (m && !tk.from && !tk.walkEnd) { let d = yaw - m.wrap.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); m.wrap.rotation.y += d * Math.min(1, dt * 6); }
    tk.ring.material.opacity = tk.cur ? 0.55 + 0.3 * Math.sin(t * 5) : 0;
    tk.ring.scale.setScalar(tk.cur ? 1 + 0.1 * Math.sin(t * 5) : 1);
    tk.arrow.visible = tk.cur && !tk.from && !tk.out;
    if (tk.arrow.visible) { tk.arrow.position.y = TOKEN_H + 0.32 + Math.abs(Math.sin(t * 4.2)) * 0.07; tk.arrow.rotation.y = t * 1.5; }
  });
}

// ======================= công trình (mô hình Việt Nam tự dựng) =======================
const BUILD = {
  resort: ['resort_vn'],
  1: ['lvl1_bacbo', 'lvl1_mientay', 'lvl1_saigon', 'lvl1_taynguyen'],
  2: ['lvl2_hoian', 'lvl2_hue', 'lvl2_dalat', 'lvl2_saigon'],
  3: ['lvl3_hanoi', 'lvl3_minihotel'],
  4: ['lvl4_dinhvn', 'lvl4_indochine'],
};
export const buildings = [];
let HOUSE_STYLE = 'vn';
export function setHouseStyle(v) { HOUSE_STYLE = v; }
async function houseModel(type, lvl, style, color) {
  const g = new THREE.Group();
  if (type !== 'resort' && lvl === 0) { g.add(ownerFlag(color)); return g; }
  const list = type === 'resort' ? BUILD.resort : BUILD[Math.min(4, lvl)];
  const name = list[((style ?? 0) % list.length + list.length) % list.length];
  const gl = await glb(`skin/models3/build/${name}.glb`);
  if (!gl) { g.add(ownerFlag(color)); return g; }
  const m = gl.scene.clone(true);
  // màu chủ đất: dịu lại một chút để hợp với tường kem, mái ngói
  toToon(m, { stroke: 0.003, tint: { Mat_Player: mixHex(color, '#fff4e6', 0.12) } });
  g.add(m);
  const sh = contactShadow(0.85, 0.85, 0.8); sh.position.y = 0.004; g.add(sh);
  if (type !== 'resort' && lvl < 4) { const f = ownerFlag(color, 0.55); f.position.set(0.31, 0, -0.2); g.add(f); }
  return g;
}
function ownerFlag(color, h = 0.42) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, h), toon('#5b4630', { stroke: 0.0018 })); pole.position.y = h / 2; g.add(pole);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), toon('#e7b54e')); knob.position.y = h + 0.01; g.add(knob);
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.19, -0.055); s.lineTo(0, -0.12); s.closePath();
  const f = new THREE.Mesh(new THREE.ShapeGeometry(s), toon(color, { side: THREE.DoubleSide, stroke: 0.002 }));
  f.position.set(0.01, h - 0.01, 0); f.userData.wave = true; g.add(f);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function labelSprite(text, { bg = '#ffd34d', fg = '#5a2a00', border = '#fff', h = 0.22 } = {}) {
  const [c, g] = canvas(512, 128);
  g.font = `900 70px ${FONT}`; const tw = Math.min(490, g.measureText(text).width + 70);
  g.fillStyle = 'rgba(40,20,30,.35)'; rr(g, (512 - tw) / 2, 20, tw, 100, 50); g.fill();
  g.fillStyle = bg; rr(g, (512 - tw) / 2, 12, tw, 100, 50); g.fill(); g.lineWidth = 9; g.strokeStyle = border; g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 64);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texOf(c), transparent: true, depthTest: false }));
  sp.scale.set(h * 4, h, 1); sp.renderOrder = 10; onFx(sp); return sp;
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
  if (cur) ctx.groups.bld.remove(cur);
  buildings[i] = null;
  if (!info) return { prev: prevKey };
  const root = new THREE.Group();
  const p = tp(i, 0, info.type === 'resort' ? 0.3 : 0.28, TH);
  root.position.copy(p); root.rotation.y = faceNear(i);
  const up = po === String(info.owner) && +pl < info.lvl;
  root.userData = { key, model: null, t0: performance.now(), anim: up ? 'up' : 'grow', lvl: info.lvl };
  ctx.groups.bld.add(root); buildings[i] = root;
  houseModel(info.type, info.lvl, info.style ?? i, info.color).then((m) => {
    if (buildings[i] !== root) return;
    root.add(m); root.userData.model = m; root.userData.t0 = performance.now();
    setFestLabel(root, info.festMult);
  });
  if (performance.now() - ctx.readyAt > 1500) setTimeout(() => buildFx(p.clone(), info.type === 'resort' ? 1 : info.lvl), 350);
  return { prev: prevKey, upgraded: up };
}
function setFestLabel(root, mult) {
  const old = root.userData.fest; if (old) { root.remove(old); root.userData.fest = null; }
  if (!mult || !root.userData.model) return;
  const lb = labelSprite(`LỄ HỘI ×${mult}`, { bg: '#ff5fa2', fg: '#fff', border: '#fff', h: 0.19 });
  const box = new THREE.Box3().setFromObject(root.userData.model);
  lb.position.y = Math.max(0.55, box.max.y - root.position.y + 0.2); root.add(lb); root.userData.fest = lb;
}
export const buildingKey = (i) => buildings[i]?.userData.key || '';
let _flame;
function flameTex() { if (_flame) return _flame; const [c, g] = canvas(64, 96); const r = g.createRadialGradient(32, 64, 2, 32, 56, 40); r.addColorStop(0, 'rgba(255,255,200,1)'); r.addColorStop(0.35, 'rgba(255,170,40,.95)'); r.addColorStop(0.7, 'rgba(230,60,20,.6)'); r.addColorStop(1, 'rgba(200,30,0,0)'); g.fillStyle = r; g.beginPath(); g.ellipse(32, 60, 26, 36, 0, 0, Math.PI * 2); g.fill(); return (_flame = texOf(c)); }
export function fxBurn(i, on) {
  const b = buildings[i]; if (!b) return;
  if (on) {
    const flames = new THREE.Group();
    for (let k = 0; k < 5; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.position.set(rnd(-0.18, 0.18), rnd(0.15, 0.45), rnd(-0.15, 0.15)); sp.scale.setScalar(rnd(0.25, 0.38)); sp.userData.flick = Math.random() * 6; flames.add(sp); }
    onFx(flames); b.add(flames); b.userData.flames = flames;
  } else if (b.userData.flames) { b.remove(b.userData.flames); b.userData.flames = null; }
}
export function fxShake(i, ms = 500) { const b = buildings[i]; if (b) b.userData.shakeUntil = performance.now() + ms; }
export function collapse(i) {
  const b = buildings[i]; if (!b) return;
  b.userData.anim = 'crumble'; b.userData.t0 = performance.now();
  for (let k = 0; k < 14; k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.04), toon(['#c9a77a', '#8a7a70', '#e9d9b8', '#b05a3a'][k % 4], { stroke: 0.0018 }));
    m.position.copy(b.position).add(new THREE.Vector3(rnd(-0.15, 0.15), rnd(0.1, 0.4), rnd(-0.15, 0.15)));
    const v = new THREE.Vector3(rnd(-1.4, 1.4), rnd(1.5, 3), rnd(-1.4, 1.4)), spin = new THREE.Vector3(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
    m.castShadow = true; ctx.groups.fx.add(m);
    const t0 = performance.now();
    ctx.anims.add((t, dt) => { const age = (performance.now() - t0) / 1000; v.y -= 9.8 * dt; m.position.addScaledVector(v, dt); if (m.position.y < TH + 0.02) { m.position.y = TH + 0.02; v.multiplyScalar(0.4); v.y = Math.abs(v.y) * 0.3; } m.rotation.x += spin.x * dt; m.rotation.y += spin.y * dt; if (age > 1.3) m.scale.multiplyScalar(0.85); if (age > 1.8) { ctx.groups.fx.remove(m); return false; } return true; });
  }
  puffs(b.position, 8);
}
function updateBuildings(t, dt, now) {
  buildings.forEach((b) => {
    if (!b || !b.userData.model) return;
    const u = b.userData, m = u.model, a = (now - u.t0) / 1000;
    if (u.anim === 'grow') { const k = Math.min(1, a / 0.75), e = ease.outElastic(k); m.scale.set(Math.min(1.08, 0.5 + 0.5 * e), Math.max(0.01, e), Math.min(1.08, 0.5 + 0.5 * e)); if (k >= 1) { u.anim = null; m.scale.setScalar(1); } }
    else if (u.anim === 'up') { const k = Math.min(1, a / 0.95); m.position.y = (1 - Math.min(1, k * 1.6)) * 1.1; const q = Math.max(0, (k - 0.62) / 0.38); m.scale.set(1 + 0.1 * Math.sin(q * Math.PI) * (1 - q), 1 - 0.14 * Math.sin(q * Math.PI) * (1 - q), 1 + 0.1 * Math.sin(q * Math.PI) * (1 - q)); if (k >= 1) { u.anim = null; m.position.y = 0; m.scale.setScalar(1); } }
    else if (u.anim === 'crumble') { const k = Math.min(1, a / 0.6); m.scale.set(1 + k * 0.2, Math.max(0.01, 1 - k), 1 + k * 0.2); }
    m.position.x = u.shakeUntil && now < u.shakeUntil ? Math.sin(now / 22) * 0.03 : 0;
    m.traverse((o) => { if (o.userData.wave) o.rotation.y = Math.sin(t * 5 + b.position.x * 3) * 0.35; });
    u.flames?.children.forEach((sp) => { sp.scale.setScalar(0.3 + 0.06 * Math.sin(t * 14 + sp.userData.flick)); sp.material.opacity = 0.75 + 0.25 * Math.sin(t * 20 + sp.userData.flick); });
  });
}

// ======================= xúc xắc =======================
export const DICE_KEYS = ['classic', 'gold', 'jade', 'ruby', 'wood', 'neon', 'crystal', 'sakura', 'obsidian', 'ocean', 'candy', 'galaxy'];
const DICE_SKINS = {
  classic: { bg: ['#ffffff', '#ece4d6'], pip: ['#5a5a5a', '#0d0d0d'], red: ['#ff6b6b', '#b3121b'] },
  gold: { bg: ['#fff1b8', '#d39a12'], pip: ['#6b3d00', '#2e1a00'], red: ['#c0182a', '#5a0008'], ring: '#b07a08' },
  jade: { bg: ['#a8f5cf', '#24905f'], pip: ['#fff6c8', '#d9a21b'], red: ['#fff6c8', '#d9a21b'], marble: '#ffffff' },
  ruby: { bg: ['#ff7a90', '#9c0f2a'], pip: ['#ffffff', '#f1dde3'], red: ['#ffe14d', '#d9a21b'] },
  wood: { bg: ['#e0ac72', '#94592a'], pip: ['#3a2210', '#140802'], red: ['#7a1f10', '#2a0802'], grain: true },
  neon: { bg: ['#232850', '#090b1d'], pip: ['#c8fbff', '#35d5ff'], red: ['#ffc4e2', '#ff4f8b'], glow: true },
  crystal: { bg: ['#f4fcff', '#9fd2ee'], pip: ['#3d74b0', '#16365e'], red: ['#3d74b0', '#16365e'], facets: true },
  sakura: { bg: ['#fff3f8', '#f5b5cf'], pip: ['#e0598d', '#93204c'], red: ['#e0598d', '#93204c'], flower: true },
  obsidian: { bg: ['#3a3a44', '#0b0b10'], pip: ['#ffe9a8', '#d4a017'], red: ['#ffe9a8', '#d4a017'], ring: '#b8860b' },
  ocean: { bg: ['#7fd8ff', '#1565c0'], pip: ['#ffffff', '#dbeeff'], red: ['#ffe066', '#f4a300'], waves: true },
  candy: { bg: ['#fff7fb', '#ffd9ec'], pip: ['#7a5cff', '#4a2fc9'], red: ['#ff4f8b', '#c2185b'], stripes: true },
  galaxy: { bg: ['#3b1d6e', '#0a0620'], pip: ['#fff4ff', '#ff8af5'], red: ['#c8fbff', '#35d5ff'], stars: true, glow: true },
};
const PIPS = { 1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]], 4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]], 6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]] };
const FACE_N = [2, 5, 1, 6, 3, 4];   // thứ tự mặt BoxGeometry: +x, -x, +y, -y, +z, -z
const FACE_DIR = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];
function skinFace(n, S) {
  const [c, g] = canvas(256, 256);
  const bg = g.createRadialGradient(80, 70, 10, 128, 128, 200); bg.addColorStop(0, S.bg[0]); bg.addColorStop(1, S.bg[1]);
  g.fillStyle = bg; g.fillRect(0, 0, 256, 256);
  if (S.grain) { for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(80,40,10,${0.12 + (k % 3) * 0.06})`; g.lineWidth = 2 + (k % 4); g.beginPath(); const y = k * 10 + 3; g.moveTo(0, y); for (let x = 0; x <= 256; x += 16) g.lineTo(x, y + Math.sin(x / 30 + k) * 5); g.stroke(); } }
  if (S.marble) { g.globalAlpha = 0.28; g.strokeStyle = S.marble; for (let k = 0; k < 7; k++) { g.lineWidth = 1 + (k % 3); g.beginPath(); let x = (k * 41) % 256, y = 0; g.moveTo(x, y); while (y < 256) { x += Math.sin(y / 23 + k) * 14; y += 12; g.lineTo(x, y); } g.stroke(); } g.globalAlpha = 1; }
  if (S.facets) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; [[0, 0, 256, 256], [256, 0, 0, 256], [128, 0, 128, 256], [0, 128, 256, 128]].forEach(([a, b, x, y]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(x, y); g.stroke(); }); }
  if (S.ring) { g.strokeStyle = S.ring; g.lineWidth = 10; g.strokeRect(12, 12, 232, 232); }
  if (S.waves) { g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 5; for (let y = 30; y < 256; y += 38) { g.beginPath(); for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 22 + y) * 6); g.stroke(); } }
  if (S.stripes) { g.save(); g.globalAlpha = 0.45; g.fillStyle = '#ffb3d6'; for (let k = -256; k < 512; k += 44) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 22, 0); g.lineTo(k + 22 - 256, 256); g.lineTo(k - 256, 256); g.fill(); } g.restore(); }
  if (S.stars) { for (let k = 0; k < 70; k++) { const x = (k * 97) % 256, y = (k * 57 + 13) % 256, r = (k % 5) * 0.5 + 0.6; g.fillStyle = k % 7 ? 'rgba(255,255,255,.75)' : '#ffd6ff'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }
  if (S.flower && n === 1) {
    g.save(); g.translate(128, 128);
    for (let k = 0; k < 5; k++) { g.rotate((Math.PI * 2) / 5); const gr = g.createLinearGradient(0, 0, 0, -78); gr.addColorStop(0, S.pip[1]); gr.addColorStop(1, S.pip[0]); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-46, -24, -42, -78, -10, -80); g.lineTo(0, -66); g.lineTo(10, -80); g.bezierCurveTo(42, -78, 46, -24, 0, 0); g.fill(); }
    g.fillStyle = '#ffd36b'; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill(); g.restore();
    return texOf(c);
  }
  PIPS[n].forEach(([x, y]) => {
    const cr = n === 1 || n === 4 ? S.red : S.pip, R = n === 1 ? 34 : 23;
    if (S.glow) { g.shadowColor = cr[1]; g.shadowBlur = 26; }
    const r = g.createRadialGradient(x * 256 - 7, y * 256 - 7, 2, x * 256, y * 256, R); r.addColorStop(0, cr[0]); r.addColorStop(1, cr[1]);
    g.fillStyle = r; g.beginPath(); g.arc(x * 256, y * 256, R, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
  });
  return texOf(c);
}
const diceMats = {};
export function matsFor(key) {
  if (diceMats[key]) return diceMats[key];
  const S = DICE_SKINS[key] || DICE_SKINS.classic;
  return (diceMats[key] = FACE_N.map((n) => { const t = skinFace(n, S); return toon('#ffffff', { map: t, shared: false, emissive: S.glow ? col('#ffffff') : col('#000000'), emissiveMap: S.glow ? t : null, emissiveIntensity: S.glow ? 0.55 : 0, stroke: 0.003 }); }));
}
let dice = [];
let mySkin = (() => { try { const k = JSON.parse(localStorage.getItem('ctp_dice')); return DICE_KEYS.includes(k) ? k : 'classic'; } catch { return 'classic'; } })();
let lastDice = [5, 6];
function skinOf(pid) {
  const tk = tokens[pid];
  if (!tk || tk.mine) return mySkin;
  const others = DICE_KEYS.filter((k) => k !== mySkin);
  return others[(pid * 3 + 1) % others.length];
}
export function setDiceSkin(k) { if (!DICE_KEYS.includes(k)) return; mySkin = k; try { localStorage.setItem('ctp_dice', JSON.stringify(k)); } catch {} if (dice.length) showDice(lastDice); }
export const getDiceSkin = () => mySkin;
export function buildDice() {
  const geo = new RoundedBoxGeometry(0.62, 0.62, 0.62, 5, 0.1);
  dice = [-0.42, 0.42].map((x) => {
    const m = new THREE.Mesh(geo, matsFor(mySkin)); m.castShadow = true;
    m.position.set(x, 0.32, 0); m.userData.home = new THREE.Vector3(x, 0.32, 0); ctx.groups.board.add(m);
    const sh = contactShadow(0.95, 0.95, 0.75); sh.position.set(x, 0.012, 0); ctx.groups.board.add(sh); m.userData.sh = sh;
    return m;
  });
  showDice([5, 6]);
}
export function quatFor(n, yaw) {
  const idx = FACE_N.indexOf(n);
  const q = new THREE.Quaternion().setFromUnitVectors(FACE_DIR[idx], new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw).multiply(q);
}
export function showDice(d) {
  lastDice = d; const mats = matsFor(skinOf(curPid));
  dice.forEach((m, k) => { m.material = mats; m.quaternion.copy(quatFor(d[k], Math.PI / 4 + k * 0.3)); m.position.copy(m.userData.home); });
}
export function rollDice(d, dur = 1000) {
  const mats = matsFor(skinOf(curPid));
  dice.forEach((m) => { m.material = mats; });
  return new Promise((res) => {
    const t0 = performance.now();
    const parts = dice.map((m, k) => ({ m, landed: false, q1: quatFor(d[k], Math.PI / 4 + k * 0.3 + rnd(-0.2, 0.2)), axis: new THREE.Vector3(rnd(-1, 1), rnd(-0.3, 0.3), rnd(-1, 1)).normalize(), turns: rnd(3, 5) * Math.PI * 2, home: m.userData.home, start: m.userData.home.clone().add(new THREE.Vector3(rnd(-0.6, 0.6), 0, rnd(0.8, 1.4))) }));
    ctx.anims.add(() => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      parts.forEach((p) => {
        const e = ease.outCubic(k);
        p.m.position.lerpVectors(p.start, p.home, e);
        const b = k < 0.55 ? Math.sin((k / 0.55) * Math.PI) * 1.5 : k < 0.82 ? Math.sin(((k - 0.55) / 0.27) * Math.PI) * 0.35 : Math.sin(((k - 0.82) / 0.18) * Math.PI) * 0.08;
        p.m.position.y = p.home.y + b;
        p.m.userData.sh.position.x = p.m.position.x; p.m.userData.sh.position.z = p.m.position.z; p.m.userData.sh.material.opacity = 0.75 / (1 + b * 1.5);
        const spin = new THREE.Quaternion().setFromAxisAngle(p.axis, (1 - e) * p.turns);
        p.m.quaternion.copy(spin.multiply(p.q1));
        if (!p.landed && k > 0.5 && b < 0.04) { p.landed = true; puffs(p.m.position.clone().setY(0.05), 4); }
      });
      if (k >= 1) { sparkle(new THREE.Vector3(0, 0.5, 0), '#fff2b0', 14); res(); return false; }
      return true;
    });
  });
}
export function hideDice(on) { dice.forEach((m) => { m.visible = !on; m.userData.sh.visible = !on; }); }

// ======================= hiệu ứng =======================
let _smoke;
function smokeTex() { if (_smoke) return _smoke; const [c, g] = canvas(64, 64); const r = g.createRadialGradient(32, 32, 2, 32, 32, 30); r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return (_smoke = texOf(c)); }
export function puffs(pos, n) {
  for (let k = 0; k < n; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), transparent: true, depthWrite: false, color: '#f3e8d8' }));
    sp.position.copy(pos).add(new THREE.Vector3(rnd(-0.25, 0.25), 0.1, rnd(-0.25, 0.25))); onFx(sp); ctx.groups.fx.add(sp);
    const v = new THREE.Vector3(rnd(-0.4, 0.4), rnd(0.3, 0.7), rnd(-0.4, 0.4)), t0 = performance.now();
    ctx.anims.add((t, dt) => { const a = (performance.now() - t0) / 1000; sp.position.addScaledVector(v, dt); sp.scale.setScalar(0.2 + a * 0.7); sp.material.opacity = Math.max(0, 0.9 - a * 0.8); if (a > 1.15) { ctx.groups.fx.remove(sp); return false; } return true; });
  }
}
function spark(color, size) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); onFx(s); return s; }
export function sparkle(pos, color = '#fff2b0', n = 14, up = 2.2) {
  for (let k = 0; k < n; k++) {
    const s = spark(color, rnd(0.08, 0.16)); s.position.copy(pos).add(new THREE.Vector3(rnd(-0.15, 0.15), 0, rnd(-0.15, 0.15))); ctx.groups.fx.add(s);
    const v = new THREE.Vector3(rnd(-1, 1), rnd(1, up), rnd(-1, 1)), t0 = performance.now(), life = rnd(0.7, 1.2);
    ctx.anims.add((t, dt) => { const a = (performance.now() - t0) / 1000; v.y -= 3.2 * dt; s.position.addScaledVector(v, dt); s.material.opacity = Math.max(0, 1 - a / life); if (a > life) { ctx.groups.fx.remove(s); return false; } return true; });
  }
}
let _beam;
function beamTex() { if (_beam) return _beam; const [c, g] = canvas(64, 256); const gr = g.createLinearGradient(0, 256, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const hg = g.createLinearGradient(0, 0, 64, 0); hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(0.5, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = hg; g.fillRect(0, 0, 64, 256); return (_beam = texOf(c)); }
function beam(pos, color = '#ffd76a', h = 3.2, life = 1.6) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, h, 24, 1, true), flat(color, { map: beamTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  m.position.copy(pos).setY(pos.y + h / 2); onFx(m); ctx.groups.fx.add(m);
  const t0 = performance.now();
  ctx.anims.add(() => { const a = (performance.now() - t0) / 1000 / life; m.material.opacity = a < 0.15 ? a / 0.15 : Math.max(0, 1 - (a - 0.15) / 0.85); m.scale.set(1 + Math.sin(a * Math.PI) * 0.3, 1, 1 + Math.sin(a * Math.PI) * 0.3); m.rotation.y += 0.02; if (a >= 1) { ctx.groups.fx.remove(m); return false; } return true; });
}
const FW_COLORS = ['#ff4d6d', '#ffd60a', '#3a86ff', '#06d6a0', '#ff9f1c', '#b15cff', '#ffffff'];
function firework(pos, delay = 0, color) {
  const cr = color || FW_COLORS[(Math.random() * FW_COLORS.length) | 0];
  const born = performance.now() + delay, topY = pos.y + rnd(2.4, 3.4);
  const rocket = spark('#fff4c2', 0.18); rocket.visible = false; rocket.position.copy(pos); ctx.groups.fx.add(rocket);
  let done = false;
  ctx.anims.add(() => {
    const a = (performance.now() - born) / 1000;
    if (a < 0) return true;
    if (!done) {
      rocket.visible = true; const k = Math.min(1, a / 0.55); rocket.position.y = pos.y + (topY - pos.y) * ease.outCubic(k);
      if (k >= 1) {
        done = true; ctx.groups.fx.remove(rocket);
        const c = rocket.position.clone();
        for (let i = 0; i < 40; i++) {
          const s = spark(i % 5 === 0 ? '#ffffff' : cr, rnd(0.1, 0.18)); s.position.copy(c); ctx.groups.fx.add(s);
          const v = new THREE.Vector3().randomDirection().multiplyScalar(rnd(1.6, 2.4)), b0 = performance.now(), life = rnd(1, 1.5);
          ctx.anims.add((t, dt) => { const q = (performance.now() - b0) / 1000; v.multiplyScalar(1 - dt * 1.8); v.y -= 1.2 * dt; s.position.addScaledVector(v, dt); s.material.opacity = Math.max(0, 1 - q / life) * (0.7 + 0.3 * Math.sin(q * 40)); if (q > life) { ctx.groups.fx.remove(s); return false; } return true; });
        }
        const fl = new THREE.PointLight(cr, 6, 8, 1.5); fl.position.copy(c); ctx.groups.fx.add(fl);
        const fb = performance.now(); ctx.anims.add(() => { const q = (performance.now() - fb) / 450; fl.intensity = 6 * Math.max(0, 1 - q); if (q >= 1) { ctx.groups.fx.remove(fl); return false; } return true; });
        return false;
      }
    }
    return true;
  });
}
export function fireworks(i) { const p = tp(i, 0, 0.5, TH); for (let k = 0; k < 3; k++) firework(p.clone().add(new THREE.Vector3(rnd(-0.3, 0.3), 0, rnd(-0.3, 0.3))), k * 260); ctx.cam.punch = Math.max(ctx.cam.punch, 0.06); }
export function celebrate(list) {
  (list || []).forEach((i, k) => { const p = tp(i, 0, 0.4, TH); setTimeout(() => { beam(p, '#ffd76a', 3, 1.4); sparkle(p, '#ffe27a', 16); }, k * 220); firework(p, 300 + k * 260, ['#ffd60a', '#ff4d6d', '#06d6a0'][k % 3]); });
  ctx.cam.punch = Math.max(ctx.cam.punch, 0.1);
}
function buildFx(pos, lvl) {
  puffs(pos, 6); sparkle(pos.clone().setY(pos.y + 0.3), '#fff2b0', lvl >= 4 ? 26 : 12);
  if (lvl >= 4) { beam(pos, '#ffd76a', 3.6, 1.7); firework(pos, 450, '#ffd60a'); ctx.cam.punch = Math.max(ctx.cam.punch, 0.08); }
}

// ======================= đánh dấu ô đích =======================
let markerGrp = null, markerLabel = null;
export function buildMarker() {
  markerGrp = new THREE.Group(); markerGrp.visible = false;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 10, 48), toon('#ffc400', { emissive: col('#ffb300'), emissiveIntensity: 0.5, stroke: 0.002 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; markerGrp.add(ring); markerGrp.userData.ring = ring;
  ctx.groups.fx.add(markerGrp);
}
export function setTarget(i, label) {
  if (i < 0) { markerGrp.visible = false; setTileTarget(-1); return; }
  setTileTarget(i);
  markerGrp.position.copy(tp(i, 0, 0.5, TH));
  if (markerLabel) markerGrp.remove(markerLabel);
  markerLabel = labelSprite(String(label), { bg: '#ffc400', fg: '#5a3000', border: '#fff', h: 0.3 });
  markerLabel.position.y = 1.15; markerGrp.add(markerLabel);
  markerGrp.visible = true;
}
function updateMarker(t) { if (!markerGrp?.visible) return; markerGrp.userData.ring.scale.setScalar(1 + 0.12 * Math.sin(t * 7)); if (markerLabel) markerLabel.position.y = 1.15 + Math.abs(Math.sin(t * 5)) * 0.15; }

// ======================= đống tiền giữa bàn (xu vàng + rương, tự dựng) =======================
let pileGrp = null;
function coinStack(n) {
  const g = new THREE.Group(), m = toon('#f2c14e', { stroke: 0.0022 }), rim = toon('#c98f1c', { outline: false });
  for (let k = 0; k < n; k++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 24), [m, m, m]); c.position.set(rnd(-0.01, 0.01), 0.02 + k * 0.038, rnd(-0.01, 0.01)); g.add(c);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.006, 6, 24), rim); r.rotation.x = Math.PI / 2; r.position.y = c.position.y + 0.018; g.add(r);
  }
  g.userData.height = 0.04 * n; return g;
}
function chest() {
  const g = new THREE.Group(), wood = toon('#8a4f24'), gold = toon('#f2c14e', { stroke: 0.0024 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.32, 0.42, 2, 0.03), wood); box.position.y = 0.16; g.add(box);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.62, 20, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2; lid.position.set(0, 0.32, 0); lid.scale.set(1, 1, 0.7); g.add(lid);
  [-0.22, 0.22].forEach((x) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.36, 0.44, 1, 0.01), gold); b.position.set(x, 0.17, 0); g.add(b); });
  const lock = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.1, 0.03, 1, 0.01), gold); lock.position.set(0, 0.28, 0.22); g.add(lock);
  for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), gold); c.position.set(rnd(-0.2, 0.2), 0.36 + rnd(0, 0.05), rnd(-0.1, 0.1)); c.rotation.set(rnd(-0.5, 0.5), 0, rnd(-0.5, 0.5)); g.add(c); }
  g.userData.height = 0.5; return g;
}
export function showPile(amount) {
  clearPile();
  pileGrp = new THREE.Group(); ctx.groups.board.add(pileGrp);
  const items = [];
  if (amount < 100) {
    const P = [[0, 0], [0.42, -0.2], [-0.4, 0.22], [0.12, 0.45]];
    for (let k = 0; k < Math.min(4, 1 + Math.floor(amount / 30)); k++) items.push(['s', 4 + k, ...P[k]]);
  } else if (amount < 600) {
    const P = [[-0.3, -0.1], [0.32, 0.12], [0, 0.42], [-0.05, -0.45], [0.45, -0.38], [-0.48, 0.36]];
    for (let k = 0; k < Math.min(6, Math.max(2, Math.round(amount / 90))); k++) items.push(['s', 6 + (k % 3) * 2, ...P[k]]);
  } else {
    items.push(['c', 0, 0, -0.05]);
    const P = [[0.62, 0.3], [-0.62, 0.32], [0.55, -0.5], [-0.5, -0.52]];
    for (let k = 0; k < Math.min(4, 1 + Math.floor(amount / 500)); k++) items.push(['s', 8, ...P[k]]);
  }
  const t0 = performance.now();
  let top = 0.3;
  items.forEach(([kind, n, x, z], k) => {
    const m = kind === 'c' ? chest() : coinStack(n);
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const sh = contactShadow(kind === 'c' ? 0.95 : 0.4, kind === 'c' ? 0.8 : 0.4, 0.8); sh.position.set(x, 0.012, z); pileGrp.add(sh);
    m.position.set(x, 3, z); m.rotation.y = rnd(-0.5, 0.5) + Math.PI / 4; pileGrp.add(m); top = Math.max(top, m.userData.height);
    const delay = k * 90;
    ctx.anims.add(() => { const a = (performance.now() - t0 - delay) / 420; if (a < 0) return true; const k2 = Math.min(1, a); m.position.y = 3 * (1 - ease.outBack(k2)); if (k2 >= 1) { m.position.y = 0; sparkle(m.position.clone().setY(0.2), '#ffe27a', 6); return false; } return true; });
  });
  hideDice(true);
  return ctx.project(new THREE.Vector3(0, top + 0.5, 0));
}
export function clearPile() { if (pileGrp) { ctx.groups.board.remove(pileGrp); pileGrp = null; } hideDice(false); }

export function updatePieces(t, dt, now) {
  updateBuildings(t, dt, now);
  updateTokens(t, now, dt);
  updateMarker(t);
}
