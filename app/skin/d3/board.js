// Bàn cờ sa bàn (tự dựng toàn bộ bằng mã): bệ sơn mài 2 tầng đứng giữa hồ, nẹp vàng, đèn chạy trong rãnh;
// sân giữa khắc chìm hoạ tiết trống đồng Đông Sơn (chừa tâm cho xúc xắc); 32 ô đất bo cạnh, chữ in trên mặt ô;
// 4 cột đèn lồng lụa Hội An ở góc bệ; cổng lễ hội kiểu cổng làng mái cong đầu đao; tiểu cảnh 4 ô góc.
import {
  THREE, ctx, CORNER, GAP, TH, W, TILE, tp, faceNear, canvas, texOf, rr, FONT, fitText, lines, loadImg, toon, flat,
  setOutline, contactShadow, glowTex, mixHex, seeded, ease, col,
} from './core.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const FX_LAYER = 1;           // quầng sáng / hạt: không vẽ viền, không soi bóng
const E = W / 2 + 0.38;              // nửa cạnh bệ chính
const E2 = E + 0.46;                 // nửa cạnh bệ dưới
const Y1 = -0.86, Y2 = -1.36;        // đáy bệ chính, đáy bệ dưới (= mặt hồ)
const INNER = W - 2 * CORNER - 2 * GAP - 0.1;

export const tiles = [];             // { grp, body, top, frame, info, st }
export const gates = new Map();      // ô -> cổng lễ hội
let T = null;                        // bảng màu theme hiện tại
let base = null, lamps = [], bulbs = null, corners = null;
const glowMat = (color, opacity = 1) => flat(color, { map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity });
export function onFx(o) { o.traverse((c) => c.layers.set(FX_LAYER)); return o; }

// ======================= bệ =======================
function sideTex(Tm) {
  // mặt bên bệ chính: 22 ô khung sơn mài, viền vàng khảm, rãnh đèn ở giữa
  const n = 22, Wc = 2816, Hc = 220, [c, g] = canvas(Wc, Hc);
  const gr = g.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, mixHex(Tm.slabSide, '#ffffff', 0.08)); gr.addColorStop(1, mixHex(Tm.slabSide, '#000000', 0.12));
  g.fillStyle = gr; g.fillRect(0, 0, Wc, Hc);
  const pw = Wc / n;
  for (let k = 0; k < n; k++) {
    const x = k * pw;
    g.fillStyle = mixHex(Tm.slabSide, Tm.slabDark, 0.35); rr(g, x + pw * 0.09, Hc * 0.2, pw * 0.82, Hc * 0.6, 14); g.fill();
    g.strokeStyle = Tm.gold; g.globalAlpha = 0.85; g.lineWidth = 3; rr(g, x + pw * 0.09, Hc * 0.2, pw * 0.82, Hc * 0.6, 14); g.stroke();
    g.globalAlpha = 0.35; g.lineWidth = 1.5; rr(g, x + pw * 0.15, Hc * 0.27, pw * 0.7, Hc * 0.46, 10); g.stroke(); g.globalAlpha = 1;
  }
  // nẹp trên, nẹp chân
  g.fillStyle = Tm.gold; g.fillRect(0, Hc * 0.06, Wc, 5); g.fillRect(0, Hc * 0.9, Wc, 4);
  return texOf(c);
}
function plinthTex(Tm) {
  // bệ dưới: đá xây so le, mạch vữa
  const Wc = 2048, Hc = 160, [c, g] = canvas(Wc, Hc), rand = seeded(3);
  g.fillStyle = Tm.plinth; g.fillRect(0, 0, Wc, Hc);
  const rows = 2, rh = Hc / rows, bl = Wc / 14;
  for (let r = 0; r < rows; r++) for (let k = -1; k < 15; k++) {
    const x = k * bl + (r % 2) * bl / 2, y = r * rh;
    g.fillStyle = mixHex(Tm.plinth, rand() < 0.5 ? '#ffffff' : Tm.plinthDark, rand() * 0.14);
    rr(g, x + 3, y + 3, bl - 6, rh - 6, 6); g.fill();
    g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(x + 6, y + 5, bl - 12, 4);
  }
  return texOf(c);
}
function buildBase() {
  if (base) ctx.groups.board.remove(base);
  base = new THREE.Group(); base.name = 'base';
  // bệ chính (mặt trên + 4 mặt bên khung sơn mài)
  const st = sideTex(T);
  const sideM = toon('#ffffff', { map: st, shared: false });
  const topM = toon(T.slab);
  const slab = new THREE.Mesh(new RoundedBoxGeometry(2 * E, -Y1, 2 * E, 4, 0.07), [sideM, sideM, topM, topM, sideM, sideM]);
  slab.position.y = Y1 / 2; slab.receiveShadow = true; slab.castShadow = true; base.add(slab);
  // nẹp vàng nổi ở mép trên + chân bệ
  const goldM = toon(T.gold, { stroke: 0.0022 });
  [[-0.075, 0.06, 0.035], [Y1 + 0.06, 0.07, 0.04]].forEach(([y, h, o]) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(2 * E + o, h, 2 * E + o, 2, 0.02), goldM); b.position.y = y; base.add(b);
  });
  // mặt bàn: thảm dưới các ô (viền vàng mảnh khảm)
  const matTop = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.2, W + 0.2), flat(T.trim, { transparent: true, opacity: 0.0 }));
  matTop.visible = false; base.add(matTop);
  const inlay = (s, w, color, y = 0.004) => {
    const g = new THREE.Group();
    [[0, s], [0, -s], [s, 0], [-s, 0]].forEach(([x, z]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x ? w : 2 * s + w, x ? 2 * s + w : w), flat(color));
      m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(m);
    });
    return g;
  };
  base.add(inlay(E - 0.14, 0.035, T.gold), inlay(W / 2 + 0.07, 0.02, mixHex(T.slab, T.slabDark, 0.4)));
  // bệ dưới đá xây
  const pt = plinthTex(T);
  const pSide = toon('#ffffff', { map: pt, shared: false });
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(2 * E2, Y1 - Y2, 2 * E2, 3, 0.05), [pSide, pSide, toon(mixHex(T.plinth, '#ffffff', 0.18)), pSide, pSide, pSide]);
  plinth.position.y = (Y1 + Y2) / 2; plinth.receiveShadow = true; plinth.castShadow = true; base.add(plinth);
  // đèn tròn trong rãnh mặt bên (22 mỗi cạnh)
  const per = 22, n = per * 4;
  bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 12, 8), flat('#ffffff'), n);
  const dm = new THREE.Object3D();
  for (let s = 0, k = 0; s < 4; s++) for (let j = 0; j < per; j++, k++) {
    const u = -E + (2 * E * (j + 0.5)) / per;
    const [x, z] = [[u, E + 0.012], [E + 0.012, -u], [-u, -E - 0.012], [-E - 0.012, u]][s];
    dm.position.set(x, Y1 / 2, z); dm.updateMatrix(); bulbs.setMatrixAt(k, dm.matrix); bulbs.setColorAt(k, col(T.bulb));
  }
  base.add(bulbs);
  // quầng mềm dưới chân bệ (bóng tiếp xúc trên mặt nước)
  const sh = contactShadow(2 * E2 + 1.6, 2 * E2 + 1.6, 0.55); sh.position.y = Y2 + 0.005; base.add(sh);
  ctx.groups.board.add(base);
}
function updateBulbs(t) {
  if (!bulbs) return;
  const n = bulbs.count, c = new THREE.Color(), on = col(T.bulb), off = col(T.bulbOff);
  const head = (t * 16) % n;
  for (let k = 0; k < n; k++) {
    const d = Math.min(Math.abs(k - head), n - Math.abs(k - head));
    const v = (k % 3 === Math.floor(t * 3) % 3 ? 0.55 : 0.22) + Math.max(0, 1 - d / 6) * 0.9;
    c.copy(off).lerp(on, Math.min(1, v)); bulbs.setColorAt(k, c);
  }
  bulbs.instanceColor.needsUpdate = true;
}

// ======================= sân giữa: hoạ tiết trống đồng Đông Sơn chìm =======================
function bird(g, s) {
  // chim Lạc cách điệu: mỏ dài, mào, cánh xoè, đuôi 3 lông — bay theo chiều +x
  g.beginPath(); g.ellipse(0, 0, s * 0.34, s * 0.09, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(s * 0.3, -s * 0.02); g.lineTo(s * 0.78, -s * 0.04); g.lineTo(s * 0.3, s * 0.04); g.fill();      // mỏ
  g.beginPath(); g.moveTo(s * 0.2, -s * 0.06); g.quadraticCurveTo(s * 0.02, -s * 0.26, -s * 0.18, -s * 0.3); g.lineTo(s * 0.12, -s * 0.07); g.fill(); // mào
  g.beginPath(); g.moveTo(s * 0.05, -s * 0.05); g.lineTo(-s * 0.32, -s * 0.46); g.lineTo(-s * 0.12, -s * 0.05); g.fill();  // cánh trên
  g.beginPath(); g.moveTo(s * 0.05, s * 0.05); g.lineTo(-s * 0.32, s * 0.46); g.lineTo(-s * 0.12, s * 0.05); g.fill();    // cánh dưới
  for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(-s * 0.3, 0); g.lineTo(-s * 0.78, k * s * 0.14); g.lineTo(-s * 0.3, k * s * 0.03 + 0.001); g.fill(); }
}
function courtTex() {
  const N = 2048, [c, g] = canvas(N, N), rand = seeded(9);
  const gr = g.createRadialGradient(N / 2, N / 2, N * 0.05, N / 2, N / 2, N * 0.72); gr.addColorStop(0, T.court[0]); gr.addColorStop(1, T.court[1]);
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  for (let k = 0; k < 2600; k++) { g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '120,90,70'},${0.025 + rand() * 0.035})`; g.beginPath(); g.arc(rand() * N, rand() * N, 1 + rand() * 2.5, 0, 7); g.fill(); }
  // viền sân: chỉ kép
  g.strokeStyle = T.motif; g.globalAlpha = T.courtInk * 2.2; g.lineWidth = 8; rr(g, 26, 26, N - 52, N - 52, 36); g.stroke();
  g.globalAlpha = T.courtInk * 1.4; g.lineWidth = 3; rr(g, 50, 50, N - 100, N - 100, 26); g.stroke();
  g.save(); g.translate(N / 2, N / 2);
  g.fillStyle = g.strokeStyle = T.motif;
  const R = N * 0.47, A = T.courtInk;
  const ring = (r, w = 3, a = A) => { g.globalAlpha = a; g.lineWidth = w; g.beginPath(); g.arc(0, 0, r * R, 0, Math.PI * 2); g.stroke(); };
  // mặt trời 14 cánh ở tâm (mờ, để xúc xắc vẫn rõ)
  g.globalAlpha = A * 0.8; g.beginPath();
  for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2, r = (k % 2 ? 0.05 : 0.15) * R; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  g.closePath(); g.fill();
  ring(0.17, 3, A * 0.9); ring(0.185, 2, A * 0.7);
  // vành vòng tròn tiếp tuyến có chấm giữa
  for (let k = 0; k < 30; k++) { const a = (k / 30) * Math.PI * 2, x = Math.cos(a) * 0.225 * R, y = Math.sin(a) * 0.225 * R; g.globalAlpha = A; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 0.024 * R, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, 0.007 * R, 0, 7); g.fill(); }
  ring(0.265, 3); ring(0.28, 2, A * 0.7);
  // vành răng cưa (tam giác gạch chéo)
  for (let k = 0; k < 72; k++) { const a0 = (k / 72) * Math.PI * 2, a1 = ((k + 1) / 72) * Math.PI * 2; g.globalAlpha = A * (k % 2 ? 0.55 : 1); g.beginPath(); g.moveTo(Math.cos(a0) * 0.29 * R, Math.sin(a0) * 0.29 * R); g.lineTo(Math.cos((a0 + a1) / 2) * 0.335 * R, Math.sin((a0 + a1) / 2) * 0.335 * R); g.lineTo(Math.cos(a1) * 0.29 * R, Math.sin(a1) * 0.29 * R); g.fill(); }
  ring(0.345, 3); ring(0.36, 2, A * 0.7);
  // vành chim Lạc bay ngược chiều kim đồng hồ
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; g.save(); g.rotate(a); g.translate(0.445 * R, 0); g.rotate(-Math.PI / 2); g.globalAlpha = A * 1.15; bird(g, 0.11 * R); g.restore(); }
  ring(0.53, 3); ring(0.545, 2, A * 0.7);
  // chữ chạy vòng
  const txt = [...'CỜ TỶ PHÚ  •  VIỆT NAM  •  MUA ĐẤT  •  XÂY NHÀ  •  '], step = (Math.PI * 2) / txt.length;
  g.font = `800 ${Math.round(0.052 * R)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = Math.min(0.75, A * 3.2);
  txt.forEach((ch, k) => { g.save(); g.rotate(k * step - Math.PI / 2); g.translate(0, -0.6 * R); g.fillText(ch, 0, 0); g.restore(); });
  ring(0.655, 3); ring(0.67, 2, A * 0.7);
  // vành chấm tròn
  for (let k = 0; k < 64; k++) { const a = (k / 64) * Math.PI * 2; g.globalAlpha = A; g.beginPath(); g.arc(Math.cos(a) * 0.7 * R, Math.sin(a) * 0.7 * R, 0.0085 * R, 0, 7); g.fill(); }
  ring(0.73, 3);
  // vành gạch chéo ngoài cùng
  for (let k = 0; k < 120; k++) { const a = (k / 120) * Math.PI * 2; g.globalAlpha = A * 0.8; g.lineWidth = 2.5; g.beginPath(); g.moveTo(Math.cos(a) * 0.745 * R, Math.sin(a) * 0.745 * R); g.lineTo(Math.cos(a + 0.03) * 0.79 * R, Math.sin(a + 0.03) * 0.79 * R); g.stroke(); }
  ring(0.8, 4); ring(0.815, 2, A * 0.7);
  g.restore();
  // hoa sen 4 góc sân
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sy]) => {
    g.save(); g.translate(N / 2 + sx * N * 0.41, N / 2 + sy * N * 0.41); g.rotate(Math.atan2(sy, sx) + Math.PI / 2);
    g.fillStyle = T.motif; g.globalAlpha = A * 1.2;
    for (let k = -2; k <= 2; k++) { g.save(); g.rotate(k * 0.42); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-34, -40, -22, -96, 0, -118); g.bezierCurveTo(22, -96, 34, -40, 0, 0); g.fill(); g.restore(); }
    g.restore();
  });
  g.globalAlpha = 1;
  return texOf(c);
}
let court = null;
function buildCourt() {
  if (court) { ctx.groups.board.remove(court); court.material.map?.dispose(); }
  court = new THREE.Mesh(new THREE.PlaneGeometry(INNER, INNER), toon('#ffffff', { map: courtTex(), outline: false, shared: false }));
  court.rotation.x = -Math.PI / 2; court.position.y = 0.006; court.receiveShadow = true; court.name = 'court';
  ctx.groups.board.add(court);
}

// ======================= ô đất =======================
const BG = { city: ['#fffdf8', '#f5efe4'], resort: ['#fff8e4', '#fbe7b8'], chance: ['#fff4f6', '#ffdbe5'], tax: ['#f7f6f3', '#e2e0da'],
  start: ['#fff6cf', '#ffd977'], island: ['#e2fbff', '#a3e2ee'], festival: ['#ffe9f3', '#ffb0d2'], airport: ['#eaf2ff', '#b3cdff'] };
const frameTex = (w, h) => { const [c, g] = canvas(w, h); g.strokeStyle = '#fff'; g.lineWidth = 18; rr(g, 9, 9, w - 18, h - 18, 28); g.stroke(); return texOf(c); };
let _frameS, _frameC;
export function buildTiles(list) {
  tiles.splice(0).forEach((Ti) => ctx.groups.tiles.remove(Ti.grp));
  _frameS ||= frameTex(256, 372); _frameC ||= frameTex(372, 372);
  list.forEach((info, i) => {
    const t = TILE[i], corner = t.side === 'c';
    const bodyM = toon(T ? T.tileSide : '#f0e2d8', { shared: false, stroke: 0.0026 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(t.w - 0.02, TH, t.d - 0.02, 3, 0.045), bodyM);
    body.position.set(t.x, TH / 2, t.z); body.receiveShadow = true; body.castShadow = true; body.userData.tile = i;
    const pw = (corner ? CORNER : 1) - 0.07, ph = CORNER - 0.07;
    const topM = toon('#ffffff', { outline: false, shared: false });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), topM);
    top.rotation.order = 'YXZ'; top.rotation.set(-Math.PI / 2, t.rotY, 0);
    top.position.set(t.x, TH + 0.003, t.z); top.receiveShadow = true;
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.02, ph + 0.02), flat('#ffd000', { map: corner ? _frameC : _frameS, transparent: true, opacity: 0, depthWrite: false }));
    frame.rotation.copy(top.rotation); frame.position.set(t.x, TH + 0.008, t.z); frame.renderOrder = 2;
    const grp = new THREE.Group(); grp.add(body, top, frame);
    ctx.groups.tiles.add(grp);
    tiles[i] = { grp, body, top, frame, info, st: { owned: null, price: info.sub, dim: false, pick: false, chosen: false, target: false, fest: false, rfest: false, mono: null, flash: 0, step: 0, lift: 0 } };
    drawTile(i);
  });
}
async function drawTile(i) {
  const Ti = tiles[i]; if (!Ti) return;
  const info = Ti.info, st = Ti.st, t = TILE[i], corner = t.side === 'c';
  const Wc = corner ? 372 : 256, Hc = 372, K = 2.5;
  const [c, g] = canvas(Wc * K, Hc * K); g.scale(K, K);
  const bg = BG[info.type] || BG.city;
  const gr = g.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]);
  g.fillStyle = gr; rr(g, 0, 0, Wc, Hc, 22); g.fill();
  if (st.owned) { g.fillStyle = st.owned + '22'; rr(g, 0, 0, Wc, Hc, 22); g.fill(); }
  g.save(); rr(g, 0, 0, Wc, Hc, 22); g.clip();
  if (info.type === 'resort') {
    // dải biển ở mép xa
    const sea = g.createLinearGradient(0, 0, 0, 86); sea.addColorStop(0, '#2b93c9'); sea.addColorStop(1, '#8fdcf2');
    g.fillStyle = sea; g.fillRect(0, 0, Wc, 86);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 4;
    for (let y = 18; y < 84; y += 22) { g.beginPath(); for (let x = 0; x <= Wc; x += 10) g.lineTo(x, y + Math.sin(x / 14 + y) * 3); g.stroke(); }
    g.fillStyle = '#fff6dc'; g.fillRect(0, 84, Wc, 9);
  } else if (info.band) {
    const bd = g.createLinearGradient(0, 0, 0, 62); bd.addColorStop(0, mixHex(info.band, '#ffffff', 0.12)); bd.addColorStop(1, info.band);
    g.fillStyle = bd; g.fillRect(0, 0, Wc, 62);
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(14, 10, Wc - 28, 8);
    if (st.mono) { g.fillStyle = '#ffffff'; g.font = `900 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★', Wc / 2, 34); }
  }
  g.restore();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const ink = '#2b2118';
  if (corner) {
    // ô góc: nửa xa để tiểu cảnh 3D, chữ to ở nửa gần
    g.fillStyle = ink; const s = fitText(g, info.name, Wc - 40, 64, 900); g.font = `900 ${s}px ${FONT}`; g.fillText(info.name, Wc / 2, 262);
    g.fillStyle = '#5b4630'; const s2 = fitText(g, info.sub, Wc - 40, 36, 700); g.font = `700 ${s2}px ${FONT}`; g.fillText(info.sub, Wc / 2, 314);
  } else {
    if (info.icon && info.type !== 'city' && info.type !== 'resort') { const im = await loadImg(info.icon); if (im) g.drawImage(im, Wc / 2 - 56, 56, 112, 112); }
    const ln = lines(g, info.name, Wc - 30, 44);
    const size = Math.min(...ln.map((l) => fitText(g, l, Wc - 24, ln.length > 1 ? 44 : 52)));
    g.font = `800 ${size}px ${FONT}`; g.fillStyle = ink;
    const y0 = ln.length > 1 ? 214 : 236;
    ln.forEach((l, k) => g.fillText(l, Wc / 2, y0 + k * (size + 4)));
    const price = st.price || info.sub;
    g.fillStyle = st.owned ? mixHex(st.owned, '#000000', 0.28) : '#4a3d2e';
    const ps = fitText(g, price, Wc - 20, st.owned ? 62 : 54, 900); g.font = `900 ${ps}px ${FONT}`;
    g.fillText(price, Wc / 2, 318);
  }
  if (st.owned) {
    // viền màu chủ đất + ruy-băng tam giác ở góc gần trái
    g.strokeStyle = st.owned; g.lineWidth = 12; rr(g, 6, 6, Wc - 12, Hc - 12, 20); g.stroke();
    g.fillStyle = st.owned; g.beginPath(); g.moveTo(0, Hc - 92); g.lineTo(92, Hc); g.lineTo(0, Hc); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(20, Hc - 20, 7, 0, 7); g.fill();
  }
  const old = Ti.top.material.map;
  const tex = texOf(c); Ti.top.material.map = tex; Ti.top.material.needsUpdate = true;
  old?.dispose();
}
/** cập nhật thông tin ô: { owned: màu|null, price, mono, fest, rfest } */
export function updateTile(i, u) {
  const Ti = tiles[i]; if (!Ti) return;
  const st = Ti.st;
  const redraw = u.owned !== st.owned || u.price !== st.price || !!u.mono !== !!st.mono;
  Object.assign(st, { owned: u.owned, price: u.price, mono: !!u.mono, fest: !!u.fest, rfest: !!u.rfest });
  if (redraw) drawTile(i);
}
export let pickActive = false;
export function setPicks(list) {
  const set = list ? new Set(list) : null;
  tiles.forEach((Ti, i) => { Ti.st.pick = !!set && set.has(i); Ti.st.dim = !!set && set.size > 0 && !set.has(i); });
  pickActive = !!set && set.size > 0;
}
export function setChosen(list) { const s = new Set(list || []); tiles.forEach((Ti, i) => { Ti.st.chosen = s.has(i); }); }
export function stepFlash(i) { if (tiles[i]) tiles[i].st.step = 1; }
export function flashTile(i) { if (tiles[i]) tiles[i].st.flash = 1; }
export function setTileTarget(i) { tiles.forEach((Ti, k) => { Ti.st.target = k === i; }); }
function updateTiles(t, dt) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  const sideC = col(T.tileSide);
  tiles.forEach((Ti) => {
    const s = Ti.st;
    s.step = Math.max(0, s.step - dt * 2.2); s.flash = Math.max(0, s.flash - dt * 1.6);
    let fc = null, fo = 0;
    if (s.target) { fc = '#ffc400'; fo = 0.75 + 0.25 * pulse; }
    else if (s.chosen) { fc = '#1f9d55'; fo = 1; }
    else if (s.pick) { fc = '#ffc800'; fo = 0.85; }
    else if (s.fest) { fc = '#ff5fa2'; fo = 0.9; }
    else if (s.rfest) { fc = '#2fbf6c'; fo = 0.75; }
    if (s.step > 0) { fc = '#fff2a0'; fo = Math.max(fo, s.step); }
    if (fc) Ti.frame.material.color.set(fc);
    Ti.frame.material.opacity += (fo - Ti.frame.material.opacity) * Math.min(1, dt * 12);
    const lift = (s.target ? 0.08 + 0.05 * pulse : 0) + s.flash * 0.12 + s.step * 0.05;
    s.lift += (lift - s.lift) * Math.min(1, dt * 14);
    Ti.grp.position.y = s.lift;
    const b = s.dim ? 0.42 : 1 + s.flash * 0.22;
    Ti.top.material.color.setScalar(b);
    Ti.body.material.color.copy(sideC).multiplyScalar(s.dim ? 0.55 : 1);
  });
}

// ======================= đèn lồng lụa Hội An =======================
function lanternTex(color) {
  // lụa căng trên nan tre: sọc dọc mảnh + viền hoa văn vàng ở 2 đầu
  const [c, g] = canvas(256, 256);
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(0,0,0,.18)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.2)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(70,20,10,.45)'; g.lineWidth = 3;
  for (let k = 0; k < 12; k++) { const x = (k + 0.5) * (256 / 12); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  g.fillStyle = 'rgba(255,214,120,.9)';
  for (const y of [22, 222]) { g.fillRect(0, y, 256, 6); for (let x = 6; x < 256; x += 16) { g.beginPath(); g.arc(x, y + 14, 3.2, 0, 7); g.fill(); } }
  return texOf(c);
}
function lanternMesh(color, glowCol, scale = 1) {
  const g = new THREE.Group();
  // dáng đèn Hội An: bầu tròn, thắt 2 đầu
  const prof = [[0.035, -0.17], [0.085, -0.15], [0.125, -0.1], [0.15, -0.035], [0.155, 0.0], [0.15, 0.04], [0.125, 0.1], [0.085, 0.145], [0.035, 0.165]]
    .map(([r, y]) => new THREE.Vector2(r * scale, y * scale));
  const silk = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), toon('#ffffff', { map: lanternTex(color), emissive: col(glowCol), emissiveIntensity: 0.35, shared: false, stroke: 0.0024 }));
  silk.castShadow = false; g.add(silk); g.userData.silk = silk;
  const capM = toon('#3a2016', { stroke: 0.002 }), goldM = toon('#e8b54a', { stroke: 0.002 });
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.04 * scale, 0.03 * scale, 16), capM); capT.position.y = 0.178 * scale; g.add(capT);
  const capB = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.05 * scale, 0.03 * scale, 16), capM); capB.position.y = -0.18 * scale; g.add(capB);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022 * scale, 12, 8), goldM); knob.position.y = -0.205 * scale; g.add(knob);
  // tua rua
  const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * scale, 0.03 * scale, 0.14 * scale, 10), toon(mixHex(color, '#000000', 0.15), { stroke: 0.0018 }));
  tas.position.y = -0.29 * scale; g.add(tas);
  // quầng sáng (không viền, không soi bóng)
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: glowCol, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  halo.scale.setScalar(0.85 * scale); onFx(halo); g.add(halo); g.userData.halo = halo;
  return g;
}
function lampPost() {
  const g = new THREE.Group();
  const postM = toon(T.post), goldM = toon(T.gold, { stroke: 0.002 });
  const H = 1.86;
  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.08, 0.2, 2, 0.02), toon(mixHex(T.plinth, '#ffffff', 0.25))); foot.position.y = 0.04; g.add(foot);
  const post = new THREE.Mesh(new RoundedBoxGeometry(0.075, H, 0.075, 2, 0.015), postM); post.position.y = H / 2 + 0.05; g.add(post);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.12, 4), goldM); cap.rotation.y = Math.PI / 4; cap.position.y = H + 0.11; g.add(cap);
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), goldM); bud.position.y = H + 0.2; g.add(bud);
  // cần treo cong (vươn vào phía bàn cờ)
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, H - 0.08, 0), new THREE.Vector3(0, H + 0.08, 0.28), new THREE.Vector3(0, H - 0.02, 0.46));
  const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.018, 8), postM); g.add(arm);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), goldM); tip.position.set(0, H - 0.02, 0.46); g.add(tip);
  // dây + đèn (đung đưa quanh móc treo)
  const hang = new THREE.Group(); hang.position.set(0, H - 0.03, 0.46);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6), toon('#2a1a12', { outline: false })); cord.position.y = -0.08; hang.add(cord);
  const lan = lanternMesh(T.lantern, T.lanternHi, 1.25); lan.position.y = -0.4; hang.add(lan);
  g.add(hang);
  const light = new THREE.PointLight(T.lanternHi, 0, 4.5, 1.6); light.position.set(0, H - 0.43, 0.46); g.add(light);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { hang, lan, light };
  return g;
}
function buildLamps() {
  lamps.forEach((l) => ctx.groups.board.remove(l)); lamps = [];
  [[1, 1], [1, -1], [-1, -1], [-1, 1]].forEach(([sx, sz], k) => {
    const l = lampPost();
    l.position.set(sx * (E + 0.22), Y1, sz * (E + 0.22));
    l.rotation.y = Math.atan2(-sx, -sz);   // cần treo hướng vào tâm bàn
    l.userData.ph = k * 1.7;
    ctx.groups.board.add(l); lamps.push(l);
  });
}
function updateLamps(t) {
  const night = ctx.theme === 'midnight';
  const cp = ctx.camera.position, ca = Math.atan2(cp.x, cp.z);
  lamps.forEach((l) => {
    // cột đèn ở góc gần người xem nhất che bàn cờ: ẩn đi (cắt cảnh kiểu sa bàn)
    const la = Math.atan2(l.position.x, l.position.z); let d = Math.abs(la - ca); d = Math.min(d, Math.PI * 2 - d);
    l.visible = d > 0.62;
    const u = l.userData, f = 0.8 + 0.2 * Math.sin(t * 2.3 + u.ph) + 0.06 * Math.sin(t * 11 + u.ph * 3);
    u.hang.rotation.x = Math.sin(t * 1.1 + u.ph) * 0.07; u.hang.rotation.z = Math.sin(t * 0.8 + u.ph * 2) * 0.05;
    u.lan.userData.silk.material.emissiveIntensity = (night ? 0.85 : 0.32) * f;
    u.lan.userData.halo.material.opacity = (night ? 0.9 : 0.42) * f;
    u.light.intensity = (night ? 4.2 : 0.9) * f;
  });
}

// ======================= cổng lễ hội: cổng làng mái cong đầu đao =======================
function plaqueTex() {
  const [c, g] = canvas(512, 168);
  g.fillStyle = '#8f1d1b'; rr(g, 6, 6, 500, 156, 18); g.fill();
  g.lineWidth = 10; g.strokeStyle = '#e8b54a'; rr(g, 6, 6, 500, 156, 18); g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,220,140,.7)'; rr(g, 24, 24, 464, 120, 10); g.stroke();
  g.font = `900 84px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#4a0c0a'; g.fillText('LỄ HỘI', 258, 92); g.fillStyle = '#ffd56a'; g.fillText('LỄ HỘI', 256, 88);
  return texOf(c);
}
let _plaque;
function roofGeo(len, depth, rise, curl) {
  // mái 2 dốc: mặt cắt hình chữ A dẹt kéo dài theo x, 2 đầu cong vút lên (đầu đao)
  const s = new THREE.Shape();
  s.moveTo(-depth / 2, 0); s.lineTo(0, rise); s.lineTo(depth / 2, 0); s.lineTo(depth / 2 - 0.03, -0.035); s.lineTo(0, rise - 0.045); s.lineTo(-depth / 2 + 0.03, -0.035); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, steps: 24 });
  g.translate(0, 0, -len / 2); g.rotateY(Math.PI / 2);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), u = Math.abs(x) / (len / 2);
    const e = Math.max(0, (u - 0.62) / 0.38);
    p.setY(k, p.getY(k) + curl * e * e);
    p.setZ(k, p.getZ(k) * (1 + 0.25 * e * e));
  }
  g.computeVertexNormals();
  return g;
}
function tileTex() {
  // ngói âm dương: hàng ngói xếp lớp
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#c8653a'; g.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 128; y += 16) for (let x = (y / 16) % 2 ? 0 : 8; x < 256; x += 16) {
    g.fillStyle = 'rgba(120,40,20,.35)'; g.fillRect(x, y + 11, 16, 5);
    g.fillStyle = 'rgba(255,210,170,.22)'; g.fillRect(x + 2, y + 1, 12, 3);
  }
  const t = texOf(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
let _tile;
function buildGate() {
  // cổng làng: 2 trụ vôi có mái nhỏ + nụ sen, tường cổng mang biển LỄ HỘI, vòm cổng, mái ngói 2 tầng đầu đao
  const g = new THREE.Group();
  const span = 0.86, Hp = 0.9;
  const wallM = toon('#f1e4c6'), trimM = toon('#c9a978'), redM = toon('#a8241e'), goldM = toon('#e5b04a', { stroke: 0.002 });
  _tile ||= tileTex();
  const roofM = toon('#ffffff', { map: _tile, shared: false });
  [-1, 1].forEach((s) => {
    const x = s * span / 2;
    const foot = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.07, 0.2, 2, 0.02), trimM); foot.position.set(x, 0.035, 0); g.add(foot);
    const p = new THREE.Mesh(new RoundedBoxGeometry(0.15, Hp, 0.15, 2, 0.025), wallM); p.position.set(x, Hp / 2 + 0.06, 0); g.add(p);
    const band = new THREE.Mesh(new RoundedBoxGeometry(0.165, 0.035, 0.165, 1, 0.01), trimM); band.position.set(x, Hp * 0.72, 0); g.add(band);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.075, Hp * 0.42), redM); strip.position.set(x, Hp * 0.42, 0.077); g.add(strip);
    // mái nhỏ trên đầu trụ + nụ sen
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.1, 4), roofM); cap.rotation.y = Math.PI / 4; cap.position.set(x, Hp + 0.11, 0); g.add(cap);
    const lotus = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), goldM); lotus.scale.y = 1.35; lotus.position.set(x, Hp + 0.21, 0); g.add(lotus);
  });
  // tường cổng phía trên lối đi + vòm
  const wall = new THREE.Mesh(new RoundedBoxGeometry(span - 0.12, 0.3, 0.1, 2, 0.02), wallM); wall.position.y = Hp - 0.08; g.add(wall);
  const arch = new THREE.Shape(); arch.moveTo(-0.33, 0); arch.lineTo(-0.33, 0.04); arch.quadraticCurveTo(0, 0.17, 0.33, 0.04); arch.lineTo(0.33, 0); arch.lineTo(0.3, 0); arch.quadraticCurveTo(0, 0.12, -0.3, 0); arch.closePath();
  const archM = new THREE.Mesh(new THREE.ExtrudeGeometry(arch, { depth: 0.11, bevelEnabled: false }), redM); archM.position.set(0, Hp - 0.27, -0.055); g.add(archM);
  _plaque ||= plaqueTex();
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.145), toon('#ffffff', { map: _plaque, shared: false, outline: false })); plaque.position.set(0, Hp - 0.07, 0.052); g.add(plaque);
  // mái ngói 2 tầng, đầu đao cong vút
  const roof1 = new THREE.Mesh(roofGeo(span + 0.5, 0.42, 0.12, 0.12), roofM); roof1.position.y = Hp + 0.09; g.add(roof1);
  const roof2 = new THREE.Mesh(roofGeo(span * 0.55, 0.3, 0.12, 0.08), roofM); roof2.position.y = Hp + 0.27; g.add(roof2);
  const wall2 = new THREE.Mesh(new RoundedBoxGeometry(span * 0.42, 0.13, 0.08, 1, 0.015), wallM); wall2.position.y = Hp + 0.24; g.add(wall2);
  const ridge = new THREE.Mesh(new RoundedBoxGeometry(span * 0.52, 0.03, 0.035, 1, 0.01), goldM); ridge.position.y = Hp + 0.4; g.add(ridge);
  [-1, 1].forEach((s) => {
    [[span / 2 + 0.25, Hp + 0.21, 0.05], [span * 0.275 + 0.02, Hp + 0.4, 0.035]].forEach(([x, y, r]) => {
      const curl = new THREE.Mesh(new THREE.TorusGeometry(r, 0.011, 8, 16, Math.PI * 1.25), goldM);
      curl.position.set(s * x, y, 0); curl.rotation.z = s > 0 ? -0.3 : Math.PI + 0.3; g.add(curl);
    });
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), goldM); pearl.position.set(0, Hp + 0.44, 0); g.add(pearl);
    // đèn lồng treo 2 bên vòm
    const lan = lanternMesh('#d92b2b', '#ffb36a', 0.4); lan.position.set(s * 0.22, Hp - 0.34, 0.07); g.add(lan); lan.userData.swing = s;
  });
  // dây cờ đuôi nheo căng giữa 2 trụ
  const colors = ['#e63946', '#f4a261', '#2a9d8f', '#e9c46a', '#8e5bd6', '#3a86ff', '#ff7aa2'];
  for (let k = 0; k < 8; k++) {
    const x = -span / 2 + 0.1 + k * ((span - 0.2) / 7), y = Hp * 0.6 - 0.04 * Math.cos((x / (span / 2)) * Math.PI / 2);
    const s = new THREE.Shape(); s.moveTo(-0.03, 0); s.lineTo(0.03, 0); s.lineTo(0, -0.07); s.closePath();
    const f = new THREE.Mesh(new THREE.ShapeGeometry(s), toon(colors[k % colors.length], { side: THREE.DoubleSide, outline: false }));
    f.position.set(x, y, 0.09); f.userData.bunt = k; g.add(f);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function setFestGates(list, fresh = false) {
  const want = new Set(list || []);
  for (const [i, g] of gates) if (!want.has(i)) { ctx.groups.bld.remove(g); gates.delete(i); }
  for (const i of want) {
    if (gates.has(i)) continue;
    const g = buildGate();
    g.position.copy(tp(i, 0, 0.06, TH)); g.rotation.y = faceNear(i);
    g.userData.t0 = fresh ? performance.now() : 0;
    ctx.groups.bld.add(g); gates.set(i, g);
  }
}
function updateGates(t, now) {
  for (const g of gates.values()) {
    if (g.userData.t0) { const k = Math.min(1, (now - g.userData.t0) / 800); g.scale.set(1, Math.max(0.01, ease.outBack(k)), 1); if (k >= 1) g.userData.t0 = 0; }
    g.children.forEach((o) => {
      if (o.userData.bunt != null) o.rotation.x = Math.sin(t * 5 + o.userData.bunt) * 0.35;
      else if (o.userData.swing) o.rotation.z = Math.sin(t * 1.6 + o.userData.swing) * 0.08;
    });
  }
}

// ======================= tiểu cảnh 4 ô góc =======================
function palm(h = 0.9) {
  const g = new THREE.Group(), trunkM = toon('#9a6a3e'), leafM = toon('#3fa35a', { side: THREE.DoubleSide });
  let p = new THREE.Vector3();
  for (let k = 0; k < 7; k++) {
    const r = 0.045 - k * 0.004, seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h / 7, 10), trunkM);
    p = new THREE.Vector3(Math.sin(k * 0.22) * 0.05 * k, (k + 0.5) * h / 7, 0); seg.position.copy(p); seg.rotation.z = -0.06 * k; g.add(seg);
  }
  const top = new THREE.Vector3(p.x + 0.02, h, 0);
  for (let k = 0; k < 8; k++) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.12, 0.06, 0.42, 0); s.quadraticCurveTo(0.12, -0.06, 0, 0);
    const geo = new THREE.ShapeGeometry(s, 8); const pos = geo.attributes.position;
    for (let j = 0; j < pos.count; j++) { const x = pos.getX(j); pos.setZ(j, -x * x * 0.9); }
    geo.computeVertexNormals();
    const leaf = new THREE.Mesh(geo, leafM); leaf.rotation.order = 'YXZ'; leaf.rotation.set(-Math.PI / 2 + 0.25, (k / 8) * Math.PI * 2, 0); leaf.position.copy(top); g.add(leaf);
  }
  [0, 1, 2].forEach((k) => { const n = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), toon('#6b4a22')); n.position.copy(top).add(new THREE.Vector3(Math.cos(k * 2.1) * 0.04, -0.03, Math.sin(k * 2.1) * 0.04)); g.add(n); });
  return g;
}
function drum() {
  // trống đồng: tang phình, thân thắt, mặt có ngôi sao
  const g = new THREE.Group();
  const prof = [[0.0, 0], [0.2, 0], [0.22, 0.02], [0.2, 0.08], [0.17, 0.14], [0.19, 0.2], [0.24, 0.27], [0.245, 0.3], [0.0, 0.3]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), toon('#b98a4c')); g.add(body);
  const [c, gg] = canvas(256, 256); gg.fillStyle = '#c99a58'; gg.fillRect(0, 0, 256, 256); gg.translate(128, 128); gg.fillStyle = '#7a5428';
  gg.beginPath(); for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2, r = k % 2 ? 14 : 44; gg.lineTo(Math.cos(a) * r, Math.sin(a) * r); } gg.closePath(); gg.fill();
  gg.strokeStyle = '#7a5428'; gg.lineWidth = 4; [62, 86, 110, 122].forEach((r) => { gg.beginPath(); gg.arc(0, 0, r, 0, 7); gg.stroke(); });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.244, 40), toon('#ffffff', { map: texOf(c), shared: false, outline: false }));
  face.rotation.x = -Math.PI / 2; face.position.y = 0.302; g.add(face);
  [0, 1, 2, 3].forEach((k) => { const h = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12, Math.PI), toon('#8a6232')); h.position.set(Math.cos(k * Math.PI / 2) * 0.19, 0.2, Math.sin(k * Math.PI / 2) * 0.19); h.rotation.y = -k * Math.PI / 2; g.add(h); });
  return g;
}
function tower() {
  const g = new THREE.Group();
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.55, 14), toon('#eef1f5')); tb.position.y = 0.275; g.add(tb);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14), toon('#e9563f')); band.position.y = 0.42; g.add(band);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.14, 8), toon('#8fd0f5', { emissive: col('#2a6fb0'), emissiveIntensity: 0.25 })); cab.position.y = 0.62; g.add(cab);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.09, 8), toon('#3a4a63')); roof.position.y = 0.74; g.add(roof);
  const bc = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), flat('#ff3b3b')); bc.position.y = 0.81; g.add(bc); g.userData.beacon = bc;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.03, 20), toon('#c9ced8')); pad.position.y = 0.015; g.add(pad);
  return g;
}
function flag() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.66, 8), toon('#c9a227')); pole.position.y = 0.33; g.add(pole);
  const [c, gg] = canvas(64, 48); for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) { gg.fillStyle = (x + y) % 2 ? '#1d1d1d' : '#ffffff'; gg.fillRect(x * 16, y * 16, 16, 16); }
  const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2, 10, 1), toon('#ffffff', { map: texOf(c), side: THREE.DoubleSide, shared: false, stroke: 0.002 }));
  cl.position.set(0.15, 0.55, 0); cl.userData.flagWave = Math.random() * 6; g.add(cl);
  return g;
}
function buildCorners() {
  if (corners) ctx.groups.board.remove(corners);
  corners = new THREE.Group(); corners.name = 'corners';
  const at = (i, a, s) => tp(i, a, s, TH);
  [-0.36, 0.36].forEach((a) => { const f = flag(); f.position.copy(at(0, a, 0.16)); f.rotation.y = faceNear(0) + Math.PI / 2; corners.add(f); });
  const p = palm(0.92); p.position.copy(at(8, -0.22, 0.2)); corners.add(p);
  const sand = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#f1dca0')); sand.scale.set(1.3, 0.22, 1); sand.position.copy(at(8, -0.15, 0.22)); corners.add(sand);
  [[0.3, 0.16, 0.09], [0.42, 0.25, 0.06]].forEach(([a, s, r]) => { const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), toon('#9aa0a6')); rk.position.copy(at(8, a, s)).add(new THREE.Vector3(0, r * 0.5, 0)); corners.add(rk); });
  const d = drum(); d.position.copy(at(16, 0, 0.22)); corners.add(d);
  [-0.42, 0.42].forEach((a) => { const l = lanternMesh('#d92b2b', '#ffb36a', 0.6); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), toon('#3a2016')); st.position.copy(at(16, a, 0.14)).add(new THREE.Vector3(0, 0.25, 0)); corners.add(st); l.position.copy(at(16, a, 0.14)).add(new THREE.Vector3(0, 0.38, 0)); corners.add(l); });
  const tw = tower(); tw.position.copy(at(24, 0.34, 0.2)); corners.add(tw); corners.userData.beacon = tw.userData.beacon;
  corners.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  ctx.groups.board.add(corners);
}
function updateCorners(t) {
  if (!corners) return;
  const b = corners.userData.beacon; if (b) b.material.color.set(Math.sin(t * 6) > 0 ? '#ff3b3b' : '#6a1a1a');
  corners.traverse((o) => {
    if (o.userData.flagWave == null) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.15; p.setZ(i, Math.sin(t * 6 + x * 18 + o.userData.flagWave) * 0.025 * x * 4); }
    p.needsUpdate = true;
  });
}

// ======================= theme + vòng lặp =======================
export function setBoardTheme(Tm) {
  T = Tm;
  buildBase(); buildCourt(); buildLamps(); buildCorners();
  tiles.forEach((Ti, i) => { Ti.body.material.color.set(T.tileSide); drawTile(i); });
}
export function updateBoard(t, dt, now) {
  if (!T) return;
  updateBulbs(t); updateTiles(t, dt); updateLamps(t); updateGates(t, now); updateCorners(t);
}
export const BASE = { E, E2, Y1, Y2 };
