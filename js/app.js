// Giao diện Cờ Tỷ Phú Việt Nam
import { BOARD, GROUPS, SIZE, AIRPORT, AIRPORT_FEE, BAIL, SALARY, RESORT_RENT, PLAYER_COLORS, WIN_LABEL, levelCost, SELL_RATE, BUYOUT_RATE, ICONS } from './data.js';
import { newGame, apply, tick, timeLeft, BOT_THINK, ownsGroup, fmt, fmtFull, rentOf, tileValue, buyoutCost, buildCost, maxBuildLevel, ownedBy, netWorth, animTime, ANIM } from './engine.js';
import { botAction } from './bot.js';
import { HostNet, GuestNet } from './net.js';
import { charSVG } from './characters.js';
import { createMusic } from './music.js';

// ---------- tiện ích ----------
const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// icon 3D (ảnh) — rơi về emoji nếu không có ảnh
const ico = (e, cls = 'ic') => (ICONS[e] ? `<img class="${cls}" src="assets/icons/${ICONS[e]}.webp" alt="${e}" draggable="false">` : `<span class="${cls}">${e}</span>`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
function toast(text, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = text;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), ms);
}
function showScreen(id) {
  for (const s of ['home', 'lobby', 'game']) $('#' + s).classList.toggle('hidden', s !== id);
  document.body.classList.toggle('ingame', id === 'game');
}

// ---------- âm thanh (tổng hợp, không cần file) ----------
let actx = null;
let soundOn = store.get('ctp_sound', true);
function audioCtx() {
  try { actx ||= new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  return actx;
}
function beep(freq, dur = 0.06, type = 'square', vol = 0.04) {
  if (!soundOn) return;
  try {
    if (!audioCtx()) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch {}
}
const sfx = {
  step: () => beep(540, 0.04, 'triangle', 0.05),
  dice: () => beep(160 + Math.random() * 240, 0.03, 'square', 0.025),
  coin: () => { beep(988, 0.07, 'square', 0.025); setTimeout(() => beep(1319, 0.12, 'square', 0.025), 70); },
  pay: () => beep(196, 0.14, 'sawtooth', 0.03),
  card: () => { beep(660, 0.1, 'sine', 0.06); setTimeout(() => beep(880, 0.14, 'sine', 0.06), 90); },
  build: () => beep(392, 0.1, 'triangle', 0.06),
  clink: () => beep(1400 + Math.random() * 500, 0.06, 'triangle', 0.035),
  upgrade: () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'triangle', 0.06), i * 90)),
  turn: () => beep(740, 0.08, 'sine', 0.05),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'triangle', 0.07), i * 130)),
};

// ---------- trạng thái giao diện ----------
let mode = null;         // 'local' | 'online'
let S = null;            // trạng thái đã hiển thị xong
let ctl = null;          // bộ điều khiển (LocalCtl | OnlineCtl)
let mySeat = -1;         // ghế của mình khi chơi online
let busy = false;        // đang chạy animation
let winShown = false;
const queue = [];
const view = { pos: [], money: [] };
let timerEnd = 0, timerTotal = 45000;
let stateAt = Date.now();
// đồng hồ đếm ngược của ván
function renderClock() {
  const el = $('#roundInfo');
  if (!S) return;
  const left = S.phase === 'over' ? Math.max(0, timeLeft(S)) : Math.max(0, timeLeft(S) - Math.min(Date.now() - stateAt, 120000));
  const m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
  el.textContent = `⏱ ${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  el.classList.toggle('warn', left < 5 * 60000);
}
setInterval(() => { if (S && !$('#game').classList.contains('hidden')) renderClock(); }, 1000);

const isMine = () => {
  if (!S || S.phase === 'over' || busy) return false;
  return mode === 'local' ? !S.players[S.cur].bot : S.cur === mySeat;
};

// ---------- dựng bàn cờ ----------
const boardEl = $('#board');
const tokensEl = $('#tokens');
const tileEls = [];
let tokenEls = [];

function gridPos(i) {
  if (i <= 8) return [9, 9 - i];
  if (i <= 16) return [9 - (i - 8), 1];
  if (i <= 24) return [1, 1 + (i - 16)];
  return [1 + (i - 24), 9];
}
const sideOf = (i) => (i % 8 === 0 ? 'corner' : ['b', 'l', 't', 'r'][Math.floor(i / 8)]);
function tileSub(t) {
  switch (t.type) {
    case 'city': case 'resort': return fmt(t.price);
    case 'chance': return 'Rút thẻ';
    case 'tax': return '10% tài sản';
    case 'start': return `Nhận ${fmt(SALARY)}`;
    case 'island': return 'Kẹt 3 lượt';
    case 'festival': return 'Thuê ×2 → ×5';
    case 'airport': return `Bay · ${fmt(AIRPORT_FEE)}`;
  }
  return '';
}
function buildBoard() {
  BOARD.forEach((t, i) => {
    const el = document.createElement('div');
    const side = sideOf(i);
    const [r, c] = gridPos(i);
    el.style.gridRow = r; el.style.gridColumn = c;
    el.dataset.i = i;
    if (side === 'corner') {
      el.className = `tile corner ${t.type}`;
      el.innerHTML = `${ico(t.icon)}<div class="nm">${esc(t.name)}</div><div class="pr">${tileSub(t)}</div>`;
    } else {
      el.className = `tile side-${side} ${t.type}`;
      const g = t.group ? GROUPS[t.group].color : t.type === 'resort' ? '#18a0b5' : 'transparent';
      const icon = t.type === 'city' || t.type === 'resort' ? '' : ico(t.icon);
      el.innerHTML = `<div class="band" style="--g:${g}"></div><div class="body">${icon}<div class="txt"><div class="nm">${esc(t.name)}</div><div class="pr">${tileSub(t)}</div></div></div>`;
    }
    el.addEventListener('click', () => onTileClick(i));
    boardEl.insertBefore(el, boardEl.querySelector('.center'));
    tileEls[i] = el;
  });
  new ResizeObserver(() => { tokensEl.classList.add('notrans'); layoutTokens(); bldEls.forEach((_, i) => placeBuilding(i)); requestAnimationFrame(() => tokensEl.classList.remove('notrans')); }).observe(boardEl);
}

function renderTile(i, s = S) {
  const el = tileEls[i], o = s.own[i], t = BOARD[i];
  if (!o) return;
  const owned = o.o >= 0;
  el.classList.toggle('owned', owned);
  el.classList.toggle('fest', s.festival === i);
  el.classList.toggle('mono', owned && t.type === 'city' && ownsGroup(s, o.o, t.group));
  if (owned) el.style.setProperty('--own', s.players[o.o].color); else el.style.removeProperty('--own');
  renderBuilding(i, s);
  el.querySelector('.pr').textContent = owned ? fmt(rentOf(s, i)) : fmt(t.price);
}

// ---------- nhà / công trình mọc trên ô (lớp 3D) ----------
const bldLayer = $('#buildings');
const bldEls = [];
const flatView = matchMedia('(max-width: 900px), (orientation: portrait)');
flatView.addEventListener?.('change', () => bldEls.forEach((_, i) => placeBuilding(i)));
function bldAnchor(i) {
  const t = tileEls[i];
  const L = t.offsetLeft, T = t.offsetTop, W = t.offsetWidth, H = t.offsetHeight;
  if (BOARD[i].type === 'resort') {   // biển ở mép ngoài, chữ trên bãi cát, chòi ở phía trong
    switch (sideOf(i)) {
      case 'b': return [L + W / 2, T + H * 0.24];
      case 't': return [L + W / 2, T + H * 0.76];
      case 'l': return [L + W * 0.76, T + H / 2];
      case 'r': return [L + W * 0.24, T + H / 2];
    }
  }
  switch (sideOf(i)) {
    case 'b': return [L + W / 2, T + H * 0.36];
    case 't': return [L + W / 2, T + H * 0.3];
    case 'l': return [L + W * (flatView.matches ? 0.68 : 0.3), T + H / 2];
    case 'r': return [L + W * 0.36, T + H / 2];
  }
  return [L + W / 2, T + H / 2];
}
function placeBuilding(i) {
  const el = bldEls[i];
  if (!el) return;
  const [x, y] = bldAnchor(i);
  el.style.transform = `translate(${x}px, ${y}px)`;
}
// Dựng khối 3D (tường + mái) bằng CSS. Đơn vị cqw (theo bề rộng bàn cờ).
const u = (n) => `${+n.toFixed(3)}cqw`;
function box(w, d, h, cls) {
  return `<div class="m ${cls}">
    <div class="fc top" style="left:${u(-w / 2)};top:${u(-d / 2)};width:${u(w)};height:${u(d)};transform:translateZ(${u(h)})"></div>
    <div class="fc wf" style="left:${u(-w / 2)};top:${u(d / 2 - h)};width:${u(w)};height:${u(h)}"></div>
    <div class="fc wb" style="left:${u(-w / 2)};top:${u(-d / 2 - h)};width:${u(w)};height:${u(h)}"></div>
    <div class="fc wr" style="left:${u(w / 2 - h)};top:${u(-d / 2)};width:${u(h)};height:${u(d)}"></div>
    <div class="fc wl" style="left:${u(-w / 2)};top:${u(-d / 2)};width:${u(h)};height:${u(d)}"></div>
  </div>`;
}
// mái dốc 2 mái (nóc chạy ngang), 2 đầu hồi tam giác. w: dài nóc, d: sâu, r: chiều cao mái
function roof(w, d, h, r, o = 0.35) {
  const D = d + o * 2, W = w + o * 2;
  const L = Math.hypot(D / 2, r), th = ((Math.atan2(r, D / 2) * 180) / Math.PI).toFixed(2);
  return `<div class="m roof" style="transform:translateZ(${u(h)})">
    <div class="fc rf" style="left:${u(-W / 2)};top:${u(D / 2 - L)};width:${u(W)};height:${u(L)};transform:rotateX(-${th}deg)"></div>
    <div class="fc rb" style="left:${u(-W / 2)};top:${u(-D / 2)};width:${u(W)};height:${u(L)};transform:rotateX(${th}deg)"></div>
    <div class="fc gr" style="left:${u(w / 2 - r)};top:${u(-d / 2)};width:${u(r)};height:${u(d)}"></div>
    <div class="fc gl" style="left:${u(-w / 2)};top:${u(-d / 2)};width:${u(r)};height:${u(d)}"></div>
    <div class="fc ridge" style="left:${u(-W / 2)};top:${u(-0.15)};width:${u(W)};height:${u(0.3)};transform:translateZ(${u(r)})"></div>
  </div>`;
}
const lift = (z, html) => `<div class="m" style="transform:translateZ(${u(z)})">${html}</div>`;
// khói / đèn hiệu gắn vào đúng đỉnh mô hình (tự quay mặt về phía người nhìn)
const SMOKE = '<div class="smoke"><i></i><i></i><i></i></div>';
const house = (w, d, h, r, cls, smoke = false) => `<div class="m house ${cls}">${box(w, d, h, 'walls')}${roof(w, d, h, r)}${smoke ? lift(h + r, SMOKE) : ''}</div>`;
const shift = (x, y, html) => `<div class="m" style="transform:translate(${u(x)},${u(y)})">${html}</div>`;
// mái chóp 4 mặt (nhà mái thái / chùa): w cạnh đáy, h độ cao chân mái, r chiều cao mái, o độ vươn mái
function roof4(w, h, r, o = 0.35) {
  const W = w + o * 2, L = Math.hypot(W / 2, r), th = ((Math.atan2(r, W / 2) * 180) / Math.PI).toFixed(2);
  return `<div class="m roof r4" style="transform:translateZ(${u(h)})">
    <div class="fc p4f" style="left:${u(-W / 2)};top:${u(W / 2 - L)};width:${u(W)};height:${u(L)};transform:rotateX(-${th}deg)"></div>
    <div class="fc p4b" style="left:${u(-W / 2)};top:${u(-W / 2)};width:${u(W)};height:${u(L)};transform:rotateX(${th}deg)"></div>
    <div class="fc p4r" style="left:${u(W / 2 - L)};top:${u(-W / 2)};width:${u(L)};height:${u(W)};transform:rotateY(${th}deg)"></div>
    <div class="fc p4l" style="left:${u(-W / 2)};top:${u(-W / 2)};width:${u(L)};height:${u(W)};transform:rotateY(-${th}deg)"></div>
  </div>`;
}
const hip = (w, h, r, cls = '', smoke = false) => `<div class="m house ${cls}">${box(w, w, h, 'walls')}${roof4(w, h, r)}${smoke ? lift(h + r, SMOKE) : ''}</div>`;
// nhà ống phố cổ: nóc mái chạy dọc theo chiều sâu
const tube = (w, d, h, r, smoke = false) => `<div class="m house tube">${box(w, d, h, 'walls')}<div class="m" style="transform:rotateZ(90deg)">${roof(d, w, h, r)}</div>${smoke ? lift(h + r, SMOKE) : ''}</div>`;
// nhà hiện đại mái bằng: các khối kính xếp lệch
const deck = (x, y, z, w, d, h, top = 'cap') => lift(z, shift(x, y, box(w, d, h, 'glass') + lift(h, box(w + 0.25, d + 0.25, 0.35, top))));
const hotelTop = (z) => `${lift(z, '<div class="sign">HOTEL</div>')}${lift(z + 1.6, '<div class="beacon"></div>')}`;
const STYLE_NAME = ['Mái ngói', 'Mái chùa', 'Hiện đại', 'Phố cổ'];
// độ cao mô hình theo kiểu + cấp (để đặt bảng lễ hội phía trên)
const MODEL_H = [[3, 5, 7.2, 9, 14.2], [3, 5.2, 7.2, 9.4, 14.6], [3, 3.2, 5.6, 8, 17.6], [3, 4.6, 6.6, 7, 13]];
function model(t, lvl, st = 0) {
  if (t.type === 'resort') return house(4, 3.4, 2.2, 2.8, 'hut');
  switch (st) {
    case 1: // mái chùa
      switch (lvl) {
        case 1: return hip(4, 2.8, 2.2, 'lv1', true);
        case 2: return hip(4.4, 4.6, 2.4, 'lv2', true) + roof4(4.4, 2.3, 0.5, 0.75);
        case 3: return shift(-0.5, 0, hip(4.6, 6.2, 2.6, 'lv3', true) + roof4(4.6, 2.2, 0.5, 0.8) + roof4(4.6, 4.2, 0.5, 0.7))
          + shift(3.4, 0.8, hip(2.4, 2.2, 1.5, 'lv1'));
        case 4: return `<div class="m hotel">${box(5.6, 5.6, 4, 'walls')}${roof4(5.6, 4, 1.1, 1)}${lift(4.6, box(4.4, 4.4, 3.4, 'walls'))}${roof4(4.4, 8, 1, 0.9)}${lift(8.6, box(3.2, 3.2, 2.6, 'walls'))}${roof4(3.2, 11.2, 2.6, 0.7)}${hotelTop(12.4)}</div>`;
      }
      break;
    case 2: // hiện đại
      switch (lvl) {
        case 1: return deck(0, 0, 0, 4.6, 3.6, 2.6);
        case 2: return deck(0, 0, 0, 4.8, 3.8, 2.4) + deck(0.6, -0.4, 2.75, 3.6, 3, 2.2, 'garden');
        case 3: return deck(0, 0, 0, 5, 4, 2.4) + deck(-0.5, 0.3, 2.75, 4.2, 3.4, 2.2) + deck(0.5, -0.3, 5.3, 3.4, 2.8, 2.2, 'garden');
        case 4: return `<div class="m hotel">${box(4.8, 4.8, 15.4, 'glass tall')}${lift(15.4, box(5.1, 5.1, 0.6, 'cap'))}${hotelTop(16)}</div>`;
      }
      break;
    case 3: // phố cổ: dãy nhà ống tường vàng
      switch (lvl) {
        case 1: return tube(2.6, 4, 3, 1.6, true);
        case 2: return shift(-1.4, 0, tube(2.6, 4, 3, 1.6, true)) + shift(1.4, 0.2, tube(2.6, 4, 4.6, 1.6));
        case 3: return shift(-2.7, 0.2, tube(2.6, 3.8, 3.4, 1.5)) + shift(0, 0, tube(2.6, 4, 5, 1.6, true)) + shift(2.7, 0.2, tube(2.6, 3.8, 4, 1.5));
        case 4: return `<div class="m hotel">${tube(4.6, 4.6, 8.2, 2.2)}${hotelTop(10.4)}</div>`;
      }
      break;
  }
  switch (lvl) { // mái ngói (mặc định)
    case 1: return house(4, 3.2, 2.8, 2.1, 'lv1', true);
    case 2: return house(4.4, 3.6, 4.6, 2.3, 'lv2', true);
    case 3: return shift(-0.6, 0, house(4.6, 3.8, 6.4, 2.5, 'lv3', true)) + shift(3.2, 0.6, house(2.4, 2.6, 2.6, 1.6, 'lv1'));
    case 4: return `<div class="m hotel">${box(5.4, 5.4, 11, 'tower')}${lift(11, box(3.8, 3.8, 1.3, 'cap'))}${hotelTop(12.3)}</div>`;
  }
  return '';
}
const LVL_BADGE = ['', 'Cấp 1', 'Cấp 2', 'Cấp 3', 'Khách sạn'];
function renderBuilding(i, s) {
  const o = s.own[i];
  if (!o) return;
  let el = bldEls[i];
  if (!el) { el = document.createElement('div'); el.className = 'bld'; bldLayer.appendChild(el); bldEls[i] = el; placeBuilding(i); }
  const key = o.o < 0 ? '' : `${o.o}|${o.lvl}|${s.festival === i ? s.festMult || 2 : 0}`;
  const prev = el.dataset.key || '';
  if (prev === key) return;
  el.dataset.key = key;
  if (!key) { el.innerHTML = ''; return; }
  el.style.setProperty('--c', s.players[o.o].color);
  const t = BOARD[i];
  const lvl = t.type === 'city' ? o.lvl : 0;
  const st = o.o % 4;
  const side = sideOf(i);
  el.className = `bld st${st} s-${side}`;
  const [po, pl] = prev.split('|');
  const same = po === String(o.o) && pl === String(o.lvl);          // chỉ đổi trạng thái lễ hội -> không dựng lại
  const upgraded = !same && po === String(o.o) && +pl < o.lvl;      // nâng cấp nhà
  const sparks = upgraded ? `<div class="sparks3">${Array.from({ length: 10 }, (_, k) => `<i style="--a:${k * 36}deg;--d:${k * 35}ms"></i>`).join('')}</div><b class="lvl-badge">⬆ ${LVL_BADGE[lvl]}</b>` : '';
  el.innerHTML = `<div class="gshadow lv${lvl}"></div>${same ? '' : '<div class="dust"></div>'}<div class="grow${same ? ' still' : upgraded ? ' up' : ''}">${side === 'l' || side === 'r' ? `<div class="m" style="transform:rotateZ(-90deg)">${model(t, lvl, st)}</div>` : model(t, lvl, st)}</div>
    <div class="stand">${sparks}${s.festival === i ? `<div class="fest3" style="--fh:${(t.type === 'resort' ? 5.5 : MODEL_H[st][lvl]) + 1}cqw"><div class="bunt">${'<i></i>'.repeat(7)}</div><b>LỄ HỘI ×${s.festMult || 2}</b></div>` : ''}${lvl === 0 && t.type === 'city' ? '<div class="flag"></div>' : ''}</div>`;
}

function makeTokens() {
  tokensEl.innerHTML = '';
  tokensEl.appendChild(markerEl);
  tokenEls = S.players.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'token';
    el.style.setProperty('--c', p.color);
    el.title = p.name;
    el.innerHTML = `<div class="shadow"></div><div class="stand"><div class="fig">${charSVG(i)}</div></div>`;
    tokensEl.appendChild(el);
    return el;
  });
}
function hop(pid) { const el = tokenEls[pid]; if (!el) return; el.classList.remove('hop'); void el.offsetWidth; el.classList.add('hop'); }
const SLOTS = [[0, 0], [-1, -0.8], [1, -0.8], [-1, 0.9], [1, 0.9]];
function layoutTokens() {
  if (!S) return;
  const unit = boardEl.clientWidth * 0.019;
  const groups = {};
  S.players.forEach((p, i) => { if (!p.out) (groups[view.pos[i]] ||= []).push(i); });
  S.players.forEach((p, i) => {
    const el = tokenEls[i];
    if (!el) return;
    el.classList.toggle('out', p.out);
    if (p.out) return;
    const pos = view.pos[i];
    const t = tileEls[pos];
    const g = groups[pos];
    const k = g.length === 1 ? 0 : g.indexOf(i) + 1;
    const side = sideOf(pos);
    const fx = side === 'l' ? 0.5 : side === 'r' ? 0.62 : 0.5;
    const fy = side === 'b' ? 0.62 : side === 't' ? 0.52 : side === 'corner' ? 0.55 : 0.5;
    const x = t.offsetLeft + t.offsetWidth * fx + SLOTS[k][0] * unit;
    const y = t.offsetTop + t.offsetHeight * fy + SLOTS[k][1] * unit;
    el.style.transform = `translate(${x}px, ${y}px)`;
  });
}

// ---------- đánh dấu ô sẽ dừng ----------
const markerEl = document.createElement('div');
markerEl.className = 'marker hidden';
markerEl.innerHTML = '<div class="ring"></div><div class="stand"><div class="pin"><b></b><i></i></div></div>';
let targetTile = -1;
function tileCenter(i) { const t = tileEls[i]; return [t.offsetLeft + t.offsetWidth / 2, t.offsetTop + t.offsetHeight / 2]; }
function showTarget(i, label) {
  hideTarget();
  targetTile = i;
  const [x, y] = tileCenter(i);
  markerEl.style.transform = `translate(${x}px, ${y}px)`;
  markerEl.querySelector('b').textContent = label;
  markerEl.classList.remove('hidden');
  tileEls[i].classList.add('target');
}
function hideTarget() {
  markerEl.classList.add('hidden');
  if (targetTile >= 0) tileEls[targetTile].classList.remove('target');
  targetTile = -1;
}
function stepFlash(i) { const t = tileEls[i]; t.classList.remove('stepped'); void t.offsetWidth; t.classList.add('stepped'); }

// ---------- hiệu ứng tiền bay, số tiền, tem ----------
const fxEl = $('#fx');
const mid = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
const tileXY = (i) => mid(tileEls[i]);
const cardXY = (pid) => { const el = document.querySelector(`.pc[data-pid="${pid}"] .tk`); return el ? mid(el) : [innerWidth / 2, innerHeight / 2]; };
function fxNode(cls, html = '') { const el = document.createElement('div'); el.className = cls; el.innerHTML = html; fxEl.appendChild(el); return el; }
function coins([x0, y0], [x1, y1], n = 8) {
  for (let k = 0; k < n; k++) {
    const el = fxNode('coin');
    const dx = (Math.random() - 0.5) * 90, dy = -40 - Math.random() * 70;
    el.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: 0 },
      { transform: `translate(${x0 + dx}px, ${y0 + dy}px) scale(1.15)`, opacity: 1, offset: 0.3 },
      { transform: `translate(${x1}px, ${y1}px) scale(.6)`, opacity: 0.9 },
    ], { duration: 700, delay: k * 45, easing: 'cubic-bezier(.45,0,.4,1)', fill: 'both' }).onfinish = () => el.remove();
  }
}
const boardXY = () => mid($('#board .center'));

// ---------- băng rôn thông báo giữa bàn ----------
async function banner(title, sub, color, dur) {
  const [x, y] = boardXY();
  const el = fxNode('banner', `<b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`);
  el.style.setProperty('--bc', color);
  const at = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  el.animate([
    { transform: `${at} scale(.2) rotate(-8deg)`, opacity: 0 },
    { transform: `${at} scale(1.15) rotate(2deg)`, opacity: 1, offset: 0.14 },
    { transform: `${at} scale(1) rotate(0deg)`, opacity: 1, offset: 0.24 },
    { transform: `${at} scale(1) rotate(0deg)`, opacity: 1, offset: 0.85 },
    { transform: `${at} scale(.85)`, opacity: 0 },
  ], { duration: dur, easing: 'ease-out', fill: 'both' }).onfinish = () => el.remove();
  await sleep(dur);
}

// ---------- đống tiền giữa bàn: xu vàng (ít) -> xấp tiền (vừa) -> thỏi vàng (nhiều) ----------
const pileLayer = $('#pile');
// khối hộp 3 mặt nhìn thấy (trên, trước, phải)
const slab = (w, d, h, cls, x, y, z) => `<div class="it ${cls}" style="--x:${u(x)};--y:${u(y)};--z:${u(z)}">
  <div class="fc top" style="left:${u(-w / 2)};top:${u(-d / 2)};width:${u(w)};height:${u(d)};transform:translateZ(${u(h)})"></div>
  <div class="fc wf" style="left:${u(-w / 2)};top:${u(d / 2 - h)};width:${u(w)};height:${u(h)}"></div>
  <div class="fc wr" style="left:${u(w / 2 - h)};top:${u(-d / 2)};width:${u(h)};height:${u(d)}"></div></div>`;
const CASH_POS = [[-2.75, 0, 0], [2.75, 0, 0], [-2.75, -2.95, 0], [2.75, -2.95, 0], [-2.75, 2.95, 0], [2.75, 2.95, 0],
  [-2.75, -1.47, 1], [2.75, -1.47, 1], [-2.75, 1.47, 1], [2.75, 1.47, 1], [-2.75, 0, 2], [2.75, 0, 2]];
const GOLD_POS = [[0, -1.2, 0], [0, 1.2, 0], [0, -3.6, 0], [0, 3.6, 0], [0, 0, 1], [0, -2.4, 1], [0, 2.4, 1], [0, -1.2, 2], [0, 1.2, 2]];
const COIN_POS = [[0, 0], [3.3, -1.1], [-3.1, 1.3], [0.7, 3.4]];
/** amount tính bằng triệu. Trả về [html các món, chiều cao đống] */
function pileItems(amount) {
  const items = [];
  let top = 0;
  const coinStack = (k, x, y) => { for (let j = 0; j < k; j++) items.push(`<div class="it coin3" style="--x:${u(x)};--y:${u(y)};--z:${u(j * 0.36)}"></div>`); top = Math.max(top, k * 0.36); };
  if (amount < 100) {
    const stacks = Math.min(4, 1 + Math.floor(amount / 30));
    for (let k = 0; k < stacks; k++) coinStack(3 + ((Math.round(amount) + k * 3) % 5), COIN_POS[k][0], COIN_POS[k][1]);
  } else if (amount < 600) {
    const n = Math.min(12, Math.max(2, Math.round(amount / 50)));
    for (let k = 0; k < n; k++) { const [x, y, l] = CASH_POS[k]; items.push(slab(5.2, 2.7, 1.1, 'cash', x, y, l * 1.15)); top = Math.max(top, (l + 1) * 1.15); }
  } else {
    const n = Math.min(9, 2 + Math.floor(amount / 300));
    for (let k = 0; k < n; k++) { const [x, y, l] = GOLD_POS[k]; items.push(slab(5, 2.1, 1.35, 'gold', x - 1.6, y, l * 1.4)); top = Math.max(top, (l + 1) * 1.4); }
    coinStack(7, 4.6, -1.8); coinStack(4, 5, 1.6);
  }
  return [items.map((h, k) => h.replace('style="', `style="animation-delay:${k * 70}ms;`)).join(''), top];
}
/** Hiện đống tiền + con số chạy ở giữa bàn. onMid: gọi khi đống tiền đã hiện xong (vd. cho xu bay về chủ đất) */
async function showPile(amount, { minus = false, dur = 2000, onMid } = {}) {
  const [html, top] = pileItems(amount);
  const rootEl = document.createElement('div');
  rootEl.className = 'pile-root';
  rootEl.innerHTML = `${html}<div class="pile-lift" style="transform:translateZ(${u(top + 4.5)})"><div class="pile-num${minus ? ' minus' : ''}"><b></b></div></div>`;
  pileLayer.appendChild(rootEl);
  boardEl.classList.add('paying');
  const num = rootEl.querySelector('b'), t0 = performance.now(), cu = Math.min(900, dur * 0.45);
  const run = (now) => {
    const k = Math.min(1, (now - t0) / cu);
    num.textContent = (minus ? '-' : '') + fmtFull(Math.round(amount * (1 - (1 - k) ** 3)));
    if (k < 1 && rootEl.isConnected) requestAnimationFrame(run);
  };
  run(t0);
  for (let k = 0; k < 5; k++) setTimeout(sfx.clink, 120 + k * 110);
  await sleep(dur * 0.6);
  onMid?.();
  await sleep(dur * 0.4 - 300);
  rootEl.classList.add('out');
  await sleep(300);
  rootEl.remove();
  if (!pileLayer.childElementCount) boardEl.classList.remove('paying');
}
function burst([x, y], color, n = 14) {
  for (let k = 0; k < n; k++) {
    const el = fxNode('burst');
    el.style.setProperty('--sc', color);
    const a = (k / n) * Math.PI * 2, r = 50 + Math.random() * 40;
    el.animate([
      { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 },
      { transform: `translate(${x + Math.cos(a) * r}px, ${y + Math.sin(a) * r}px) scale(.2)`, opacity: 0 },
    ], { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' }).onfinish = () => el.remove();
  }
}

// ---------- lá bài Cơ Hội lật 3D ----------
const CARD_TO = { 0: '🏁', 31: '🐢', 17: '🏮', 24: '✈️', 16: '🎆' };
function cardLook(e) {
  switch (e.kind) {
    case 'money': return e.amount > 0 ? ['🧧', 'good'] : ['💸', 'bad'];
    case 'collectEach': return ['🧧', 'good'];
    case 'freeCard': return ['🛟', 'good'];
    case 'payEach': case 'repairs': return ['💸', 'bad'];
    case 'demolish': return ['💥', 'fire'];
    case 'burn': return ['🔥', 'fire'];
    case 'hostFest': return ['🎆', 'good'];
    case 'island': return ['🌴', 'bad'];
    case 'moveBy': return ['🛵', 'bad'];
    case 'nearestResort': return ['⛱️', 'move'];
    case 'move': return [CARD_TO[e.to] || '✈️', e.to === 0 ? 'good' : 'move'];
  }
  return ['🧧', 'move'];
}
async function showCard(e) {
  const [icon, tone] = cardLook(e);
  const st = $('#cardStage'), c = $('#card3d');
  c.className = `card3d ${tone}`;
  c.querySelector('.cf-ic').innerHTML = ico(icon, 'ic');
  c.querySelector('.cf-text').textContent = e.text;
  st.classList.remove('hidden');
  sfx.card();
  const a = c.animate([
    // không animate opacity: opacity làm trình duyệt ép phẳng khối 3D -> lộ mặt sau
    { transform: 'translateY(-40vh) scale(.05) rotateY(0deg) rotateZ(-14deg)' },
    { transform: 'translateY(0) scale(1) rotateY(0deg) rotateZ(0deg)', offset: 0.16 },
    { transform: 'translateY(0) scale(1.06) rotateY(180deg) rotateZ(0deg)', offset: 0.34 },
    { transform: 'translateY(0) scale(1) rotateY(180deg) rotateZ(0deg)', offset: 0.86 },
    { transform: 'translateY(16vh) scale(.02) rotateY(180deg) rotateZ(8deg)' },
  ], { duration: ANIM.card, easing: 'ease-in-out', fill: 'forwards' });
  await a.finished.catch(() => {});
  st.classList.add('hidden');
}

// ---------- xúc xắc khối lập phương ----------
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
// góc xoay để đưa mặt n lên trên (về phía người nhìn)
const FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
const dieEls = [$('#die0'), $('#die1')];
const dieSpin = [{ x: 0, y: 0, n: 1 }, { x: 0, y: 0, n: 1 }];
dieEls.forEach((d) => {
  d.innerHTML = `<div class="cube">${[1, 2, 3, 4, 5, 6].map((n) => `<div class="face f${n}">${Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[n].includes(k) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
});
function setDie(k, n) {
  const st = dieSpin[k];
  st.n = n;
  const [rx, ry] = FACE_ROT[n];
  dieEls[k].firstElementChild.style.transform = `translateZ(calc(var(--s) / 2)) rotateX(${rx + st.x}deg) rotateY(${ry + st.y}deg)`;
}
function showDice(d) { d.forEach((n, k) => { if (dieSpin[k].n !== n || !dieEls[k].firstElementChild.style.transform) setDie(k, n); }); }
async function rollDice(d) {
  d.forEach((n, k) => {
    const st = dieSpin[k];
    st.x += 360 * (2 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? 1 : -1);
    st.y += 360 * (1 + Math.floor(Math.random() * 2)) * (Math.random() < 0.5 ? 1 : -1);
    dieEls[k].classList.remove('hop'); void dieEls[k].offsetWidth; dieEls[k].classList.add('hop');
    setDie(k, n);
  });
  for (let k = 0; k < 6; k++) { sfx.dice(); await sleep(ANIM.dice / 7); }
  await sleep(ANIM.dice / 7);
}

// ---------- người chơi ----------
function renderPlayers() {
  $('#players').innerHTML = S.players.map((p, i) => {
    const props = ownedBy(S, i).length;
    const tag = p.bot ? 'máy' : (mode === 'online' && i === mySeat ? 'bạn' : '');
    const st = [props ? `🏠 ${props} đất` : 'Chưa có đất', p.island ? `🌴 kẹt ${p.island}` : '', p.travel ? '✈️' : '', p.freeCards ? `🛟×${p.freeCards}` : '', p.out ? '💥 phá sản' : ''].filter(Boolean).join(' · ');
    return `<div class="pc${i === S.cur && S.phase !== 'over' ? ' cur' : ''}${p.out ? ' out' : ''}" style="--c:${p.color}" data-pid="${i}">
      <div class="tk">${charSVG(i, true)}</div>
      <div class="nm">${esc(p.name)}${tag ? `<small>${tag}</small>` : ''}</div>
      <div class="mn${view.money[i] < 0 ? ' neg' : ''}">${fmtFull(view.money[i])}</div>
      <div class="st">${st}</div>
      <div class="nw">Tổng ${fmt(netWorth(S, i))}</div>
    </div>`;
  }).join('');
}
function updMoney(pid) {
  const el = document.querySelector(`.pc[data-pid="${pid}"] .mn`);
  if (el) { el.textContent = fmtFull(view.money[pid]); el.classList.toggle('neg', view.money[pid] < 0); }
}
function floatMoney(pid, delta) {
  const card = document.querySelector(`.pc[data-pid="${pid}"]`);
  if (!card) return;
  const f = document.createElement('div');
  f.className = `float ${delta > 0 ? 'plus' : 'minus'}`;
  f.textContent = (delta > 0 ? '+' : '') + fmt(delta);
  card.appendChild(f);
  setTimeout(() => f.remove(), 1100);
}

// ---------- dòng tin nhanh (thay cho nhật ký) + chat ----------
const tickerEl = $('#ticker');
function addLog(text) {
  tickerEl.textContent = text;
  tickerEl.classList.remove('show'); void tickerEl.offsetWidth; tickerEl.classList.add('show');
}
function addChat(name, text) {
  const el = document.createElement('div');
  el.className = 'bubble';
  el.innerHTML = `<b>${esc(name)}</b> ${esc(text)}`;
  $('#bubbles').appendChild(el);
  while ($('#bubbles').childElementCount > 4) $('#bubbles').firstChild.remove();
  setTimeout(() => el.remove(), 6000);
}

// ---------- vùng thao tác ở giữa bàn ----------
let picks = new Set();
const sellSel = new Set();   // các ô đang tick để bán khi nợ
const sellValue = (k) => Math.floor(tileValue(S, k) * SELL_RATE);
function toggleSell(k) { if (sellSel.has(k)) sellSel.delete(k); else sellSel.add(k); renderActions(); }
function setPicks(list) {
  picks = new Set(list);
  tileEls.forEach((el, i) => { el.classList.toggle('pick', picks.has(i)); el.classList.toggle('dim', picks.size > 0 && !picks.has(i)); });
}
function offerHead(i) {
  const t = BOARD[i];
  const g = t.group ? GROUPS[t.group] : null;
  return `<div class="o-head"><span class="gbar" style="background:${g ? g.color : '#18a0b5'}"></span>${ico(t.icon, 'oi')} ${esc(t.name)}<small class="muted" style="font-weight:600;font-size:.7em">${g ? esc(g.name) : 'Khu du lịch'}</small></div>`;
}
const LVL_NAME = ['Chỉ mua đất', 'Nhà cấp 1', 'Nhà cấp 2', 'Nhà cấp 3', 'Khách sạn'];

function renderActions() {
  const box = $('#actions');
  const p = S.players[S.cur];
  const lbl = $('#turnLabel');
  lbl.style.setProperty('--pc', p.color);
  lbl.innerHTML = S.phase === 'over' ? '' : `<span class="tk" style="--c:${p.color}">${charSVG(S.cur, true)}</span>${isMineRaw() ? (mode === 'local' && S.players.filter((q) => !q.bot).length > 1 ? `Lượt của ${esc(p.name)}` : 'Lượt của bạn') : `Lượt của ${esc(p.name)}`}`;
  setPicks([]);
  tileEls.forEach((el) => el.classList.remove('chosen'));
  if (S.phase !== 'debt') sellSel.clear();
  if (busy || S.phase === 'over') { box.innerHTML = ''; return; }
  if (!isMine()) { box.innerHTML = ''; return; }
  const pd = S.pending;
  let h = '';
  switch (S.phase) {
    case 'roll':
      if (p.island) {
        h = `<div class="msg">🌴 Bạn đang kẹt ở Đảo Hoang (còn ${p.island} lượt)</div>
          <div class="row"><button class="btn primary" data-a="roll">🎲 Gieo tìm đôi</button>
          <button class="btn gold" data-a="payBail" ${p.money < BAIL ? 'disabled' : ''}>⛵ Trả ${fmt(BAIL)}</button>
          ${p.freeCards ? '<button class="btn green" data-a="useCard">🛟 Dùng thẻ cứu hộ</button>' : ''}</div>`;
      } else {
        h = `${S.rolledDouble ? '<div class="msg">🎲 Gieo đôi! Bạn được gieo tiếp</div>' : ''}
          <button class="btn primary big-roll" data-a="roll"><img class="bi" src="assets/icons/die.webp" alt="">Gieo xúc xắc</button>`;
      }
      break;
    case 'travel':
      h = `<div class="msg">✈️ Chọn ô để bay tới · vé <b>${fmtFull(AIRPORT_FEE)}</b></div><button class="btn" data-a="skip">Không bay, gieo xúc xắc</button>`;
      setPicks(BOARD.map((_, i) => i).filter((i) => i !== AIRPORT));
      break;
    case 'target':
      h = `<div class="msg">${pd.kind === 'burn' ? '🔥 Chọn nhà của đối thủ để <b>đốt</b> (giảm 1 cấp)' : '💥 Chọn nhà của đối thủ để <b>phá</b>'}</div><button class="btn" data-a="skip">Bỏ qua</button>`;
      setPicks(pd.tiles);
      break;
    case 'buy': {
      const i = pd.tile, t = BOARD[i];
      if (t.type === 'resort') {
        h = `<div class="offer">${offerHead(i)}<div class="sub">Thuê khi có 1 khu: ${fmt(RESORT_RENT[1])} · càng nhiều khu càng cao</div>
          <div class="row"><button class="btn green" data-a="buy" data-lvl="0" ${p.money < t.price ? 'disabled' : ''}>Mua ${fmt(t.price)}</button><button class="btn" data-a="skip">Bỏ qua</button></div></div>`;
      } else {
        const btns = [0, 1, 2, 3].map((l) => {
          const cost = t.price + buildCost(i, 0, l);
          return `<button class="btn ${l ? 'gold' : 'green'}" data-a="buy" data-lvl="${l}" ${p.money < cost ? 'disabled' : ''}>${LVL_NAME[l]}<small>trả ${fmt(cost)} · thuê ${fmt(t.rent[l])}</small></button>`;
        }).join('');
        h = `<div class="offer">${offerHead(i)}<div class="lvls">${btns}</div><button class="btn" data-a="skip">Bỏ qua</button></div>`;
      }
      break;
    }
    case 'upgrade': {
      const i = pd.tile, t = BOARD[i], o = S.own[i];
      const btns = [];
      for (let l = o.lvl + 1; l <= maxBuildLevel(S, i); l++) {
        const cost = buildCost(i, o.lvl, l);
        btns.push(`<button class="btn ${l === 4 ? 'primary' : 'gold'}" data-a="upgrade" data-lvl="${l}" ${p.money < cost ? 'disabled' : ''}>${LVL_NAME[l]}<small>trả ${fmt(cost)} · thuê ${fmt(t.rent[l])}</small></button>`);
      }
      h = `<div class="offer">${offerHead(i)}<div class="sub">Đất của bạn — hiện có ${o.lvl ? LVL_NAME[o.lvl].toLowerCase() : 'đất trống'}. Nâng cấp?</div><div class="lvls">${btns.join('')}</div><button class="btn" data-a="skip">Để sau</button></div>`;
      break;
    }
    case 'buyout': {
      const i = pd.tile, owner = S.players[S.own[i].o];
      const cost = buyoutCost(S, i);
      h = `<div class="offer">${offerHead(i)}<div class="sub">Mua lại từ <b style="color:${owner.color}">${esc(owner.name)}</b> với giá gấp ${BUYOUT_RATE} lần giá trị</div>
        <div class="row"><button class="btn primary" data-a="buyout" ${p.money < cost ? 'disabled' : ''}>🤝 Mua lại ${fmt(cost)}</button><button class="btn" data-a="skip">Thôi</button></div></div>`;
      break;
    }
    case 'festival':
      h = `<div class="msg">🎆 Chọn đất để mở Lễ Hội${S.festival >= 0 && S.own[S.festival]?.o === S.cur ? ` · chọn lại ${esc(BOARD[S.festival].name)} để lên ×${Math.min(5, (S.festMult || 2) + 1)}` : ' · tiền thuê ×2'}</div><button class="btn" data-a="skip">Bỏ qua</button>`;
      setPicks(ownedBy(S, S.cur));
      break;
    case 'debt': {
      const mine = ownedBy(S, S.cur);
      [...sellSel].forEach((k) => { if (!mine.includes(k)) sellSel.delete(k); });
      const need = -p.money, got = [...sellSel].reduce((a, k) => a + sellValue(k), 0);
      const rows = mine.sort((a, b) => sellValue(a) - sellValue(b)).map((k) => {
        const o = S.own[k], t = BOARD[k];
        const lv = t.type === 'resort' ? 'Khu du lịch' : o.lvl ? LVL_NAME[o.lvl] : 'Đất trống';
        return `<button class="sell-row${sellSel.has(k) ? ' on' : ''}" data-sell="${k}"><i class="ck"></i><span class="sn">${esc(t.name)}<small>${lv}</small></span><b>${fmtFull(sellValue(k))}</b></button>`;
      }).join('');
      h = `<div class="offer sell-box">
        <div class="o-head">💸 Bán đất trả nợ</div>
        <div class="sub">Tick các ô muốn bán (ngân hàng trả ${SELL_RATE * 100}% giá trị), rồi bấm Bán</div>
        <div class="sell-list">${rows}</div>
        <div class="sell-sum"><span>Đang thiếu <b class="neg">${fmtFull(need)}</b></span><span>Đã chọn <b class="${got >= need ? 'ok' : ''}">${fmtFull(got)}</b></span></div>
        <div class="row"><button class="btn primary" data-a="sellMany" ${sellSel.size ? '' : 'disabled'}>Bán ${sellSel.size || ''} ô</button><button class="btn" data-a="bankrupt">Phá sản</button></div>
      </div>`;
      setPicks(mine);
      tileEls.forEach((el, k) => el.classList.toggle('chosen', sellSel.has(k)));
      break;
    }
  }
  box.innerHTML = h;
}
const isMineRaw = () => S && (mode === 'local' ? !S.players[S.cur].bot : S.cur === mySeat);

$('#actions').addEventListener('click', (e) => {
  const row = e.target.closest('[data-sell]');
  if (row && isMine() && S.phase === 'debt') return toggleSell(+row.dataset.sell);
  const b = e.target.closest('button[data-a]');
  if (!b || b.disabled || !isMine()) return;
  const a = { type: b.dataset.a };
  if (a.type === 'sellMany') { a.tiles = [...sellSel]; sellSel.clear(); }
  if (b.dataset.lvl != null) a.lvl = +b.dataset.lvl;
  if (a.type === 'bankrupt' && !confirm('Bạn chắc chắn muốn tuyên bố phá sản?')) return;
  act(a);
});
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.target.closest('input, textarea, select, button')) return;
  if (isMine() && S.phase === 'roll') { e.preventDefault(); act({ type: 'roll' }); }
});

function act(a) {
  if (!isMine()) return;
  $('#actions').innerHTML = '';   // tránh bấm 2 lần
  ctl.send(a);
}

function onTileClick(i) {
  if (picks.has(i) && isMine()) {
    if (S.phase === 'debt') return toggleSell(i);
    const type = S.phase === 'travel' ? 'travel' : S.phase === 'festival' ? 'festival' : S.phase === 'target' ? 'target' : null;
    if (type) return act({ type, tile: i });
  }
  showTileInfo(i);
}

function showTileInfo(i) {
  const t = BOARD[i], o = S?.own[i];
  let h = `<h3>${ico(t.icon)} ${esc(t.name)}</h3>`;
  if (t.type === 'city') {
    const g = GROUPS[t.group];
    h += `<span class="gchip" style="background:${g.color}">${esc(g.name)}</span>`;
    h += '<table class="rtable">';
    h += `<tr><td>Giá đất</td><td>${fmt(t.price)}</td></tr>`;
    LVL_NAME.forEach((n, l) => { h += `<tr class="${o && o.o >= 0 && o.lvl === l ? 'now' : ''}"><td>Thuê: ${l === 0 ? 'đất trống (×2 khi đủ bộ màu)' : n}</td><td>${fmt(t.rent[l])}</td></tr>`; });
    h += `<tr><td>Xây mỗi nhà</td><td>${fmt(levelCost(t, 1))}</td></tr><tr><td>Xây khách sạn</td><td>${fmt(levelCost(t, 4))}</td></tr></table>`;
  } else if (t.type === 'resort') {
    h += '<span class="gchip" style="background:#18a0b5">Khu du lịch</span><table class="rtable">';
    h += `<tr><td>Giá</td><td>${fmt(t.price)}</td></tr>`;
    [1, 2, 3, 4].forEach((n) => { h += `<tr><td>Thuê khi có ${n} khu</td><td>${fmt(RESORT_RENT[n])}</td></tr>`; });
    h += '</table>';
  } else {
    const desc = {
      start: `Đi qua hoặc dừng ở đây nhận lương ${fmt(SALARY)}.`,
      chance: 'Rút một thẻ Cơ Hội: may hay rủi tuỳ số!',
      tax: 'Nộp thuế 10% tổng giá trị đất và nhà (tối thiểu 50tr).',
      island: `Kẹt tối đa 3 lượt. Thoát bằng cách gieo đôi, trả ${fmt(BAIL)} hoặc dùng thẻ cứu hộ.`,
      festival: 'Chọn một ô đất của bạn để tổ chức lễ hội: tiền thuê ×2. Tổ chức lại đúng ô đó thì tăng lên ×3, ×4, tối đa ×5.',
      airport: `Lượt sau được bay tới bất kỳ ô nào trên bàn cờ, vé ${fmtFull(AIRPORT_FEE)}. Không muốn bay thì gieo xúc xắc như thường.`,
    };
    h += `<p>${desc[t.type] || ''}</p>`;
  }
  if (o && o.o >= 0 && S) {
    const ow = S.players[o.o];
    h += `<p>Chủ: <b style="color:${ow.color}">${esc(ow.name)}</b>${S.festival === i ? ` · 🎆 Lễ hội ×${S.festMult || 2}` : ''}<br>Tiền thuê hiện tại: <b>${fmt(rentOf(S, i))}</b><br>Giá trị: ${fmt(tileValue(S, i))}${t.type === 'city' && o.lvl >= 4 ? ' · 🏨 Khách sạn: không thể mua lại' : ` · Giá mua lại: ${fmt(buyoutCost(S, i))}`}</p>`;
  }
  h += '<button class="btn wide" data-close>Đóng</button>';
  openModal(h);
}

// ---------- modal ----------
function openModal(html) {
  $('#modalBox').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });

// ---------- vẽ toàn bộ ----------
function render() {
  if (!S) return;
  S.players.forEach((p, i) => { view.pos[i] = p.pos; view.money[i] = p.money; });
  BOARD.forEach((_, i) => renderTile(i));
  showDice(S.dice);
  renderPlayers();
  layoutTokens();
  tokenEls.forEach((el, i) => el.classList.toggle('cur', i === S.cur && S.phase !== 'over'));
  renderClock();
  renderActions();
  renderTimer();
  if (S.phase === 'over' && !winShown) showWin();
}

function renderTimer() {
  const bar = $('#timer');
  const show = mode === 'online' && timerEnd > Date.now() && S.phase !== 'over' && !S.players[S.cur].bot && !busy;
  bar.classList.toggle('hidden', !show);
  if (!show) return;
  const rem = timerEnd - Date.now();
  const i = bar.firstElementChild;
  i.style.transition = 'none';
  i.style.width = `${Math.min(100, (rem / timerTotal) * 100)}%`;
  void i.offsetWidth;
  i.style.transition = `width ${rem}ms linear`;
  i.style.width = '0%';
}

// ---------- phát animation theo sự kiện ----------
function pushUpdate(state, events) {
  queue.push({ state, events });
  if (!busy) pump();
}
async function pump() {
  busy = true;
  renderActions();
  $('#timer').classList.add('hidden');
  while (queue.length) {
    const u = queue.shift();
    try { await play(u.events, u.state); } catch (err) { console.error(err); }
    S = u.state;
    stateAt = Date.now();
  }
  busy = false;
  render();
}
async function play(events, fin) {
  const fast = document.hidden || queue.length > 1;
  const name = (pid) => fin.players[pid]?.name || '';
  for (const e of events) {
    switch (e.t) {
      case 'dice': if (fast) showDice(e.d); else await rollDice(e.d); break;
      case 'move':
        if (!fast) { showTarget(e.path[e.path.length - 1], e.path.length); sfx.turn(); await sleep(ANIM.target); }
        for (const p of e.path) {
          view.pos[e.pid] = p; hop(e.pid); layoutTokens();
          if (!fast) { stepFlash(p); sfx.step(); await sleep(ANIM.step); }
        }
        hideTarget();
        if (!fast) await sleep(80);
        break;
      case 'fly': {
        const el = tokenEls[e.pid];
        if (!fast) { showTarget(e.to, '✈'); await sleep(ANIM.target); }
        el.classList.add('fly');
        view.pos[e.pid] = e.to; layoutTokens();
        if (!fast) await sleep(ANIM.fly);
        el.classList.remove('fly');
        hideTarget();
        break;
      }
      case 'rent':
        if (fast) break;
        sfx.pay();
        await showPile(e.amount, { minus: true, dur: ANIM.rent, onMid: () => coins(boardXY(), cardXY(e.to), 10) });
        break;
      case 'tax':
        if (fast) break;
        sfx.pay();
        await showPile(e.amount, { minus: true, dur: ANIM.tax });
        break;
      case 'buy': case 'upgrade':
        if (fast) break;
        await showPile(e.cost, { dur: ANIM[e.t] });
        break;
      case 'buyout':
        if (fast) break;
        await showPile(e.cost, { dur: ANIM.buyout, onMid: () => coins(boardXY(), cardXY(e.from), 10) });
        break;
      case 'fest':
        BOARD.forEach((_, k) => renderTile(k, fin));   // ô lễ hội cũ (nếu có) cũng được gỡ bảng ngay
        if (fast) break;
        sfx.upgrade(); burst(tileXY(e.tile), '#ff5fa2', 20);
        await banner(`🎆 LỄ HỘI ×${e.mult}`, BOARD[e.tile].name, '#e0267a', ANIM.fest);
        break;
      case 'fee':
        if (fast) break;
        sfx.pay();
        await showPile(e.amount, { minus: true, dur: ANIM.fee });
        break;
      case 'demolish': case 'burn': {
        if (fast) break;
        const el = bldEls[e.tile], xy = tileXY(e.tile), burn = e.t === 'burn';
        el?.classList.add(burn ? 'on-fire' : 'boom');
        if (el && burn) el.querySelector('.stand')?.insertAdjacentHTML('afterbegin', `<div class="flames">${ico('🔥', 'fi')}${ico('🔥', 'fi')}${ico('🔥', 'fi')}</div>`);
        burst(xy, burn ? '#ff7a1a' : '#8a7a70', 22); sfx.pay();
        const lv = burn ? (e.lvl ? `còn nhà cấp ${e.lvl}` : 'còn đất trống') : `${fin.players[e.from].name} mất nhà`;
        await banner(burn ? '🔥 ĐỐT NHÀ' : '💥 PHÁ NHÀ', `${BOARD[e.tile].name} · ${lv}`, burn ? '#e8590c' : '#5b4b45', ANIM[e.t] - 200);
        el?.classList.remove('on-fire', 'boom');
        break;
      }
      case 'mono':
        e.tiles.forEach((k) => renderTile(k, fin));
        if (fast) break;
        sfx.win();
        e.tiles.forEach((k) => burst(tileXY(k), fin.players[e.pid].color, 12));
        await banner('👑 ĐỘC QUYỀN', `${GROUPS[e.group].name} · thuê đất trống ×2`, GROUPS[e.group].color, ANIM.mono);
        break;
      case 'money':
        view.money[e.pid] += e.delta; updMoney(e.pid);
        if (!fast) { floatMoney(e.pid, e.delta); (e.delta > 0 ? sfx.coin : sfx.pay)(); }
        break;
      case 'card':
        if (fast) break;
        await showCard(e);
        break;
      case 'build': {
        const before = bldEls[e.tile]?.dataset.key || '';
        renderTile(e.tile, fin);
        if (fast) break;
        tileEls[e.tile].classList.remove('flash'); void tileEls[e.tile].offsetWidth; tileEls[e.tile].classList.add('flash');
        if (e.up) {
          const o = fin.own[e.tile];
          (before && +before.split('|')[1] < o.lvl ? sfx.upgrade : sfx.build)();
          burst(tileXY(e.tile), fin.players[o.o].color);
          await sleep(ANIM.build);
        }
        break;
      }
      case 'msg': addLog(e.text); break;
      case 'again': addLog(`🎲 ${name(e.pid)} gieo đôi, được gieo tiếp!`); break;
      case 'turn':
        tokenEls.forEach((el, i) => el.classList.toggle('cur', i === e.pid));
        if (!fast) { if (isMineSeat(e.pid, fin)) sfx.turn(); await sleep(ANIM.turn); }
        break;
      case 'bankrupt': layoutTokensFrom(fin); break;
    }
  }
}
const isMineSeat = (pid, s) => (mode === 'local' ? !s.players[pid].bot : pid === mySeat);
function layoutTokensFrom(fin) { const prev = S; S = fin; layoutTokens(); S = prev; }

// ---------- chiến thắng ----------
function showWin() {
  winShown = true;
  const w = S.players[S.winner];
  if (!w) return;
  sfx.win();
  confetti();
  const ranking = S.players.map((p, i) => i).sort((a, b) => netWorth(S, b) - netWorth(S, a));
  let h = `<div class="win-big">${ico('🏆', 'wi')}</div><h3 style="justify-content:center"><span class="av" style="--c:${w.color}">${charSVG(S.winner, true)}</span> ${esc(w.name)} chiến thắng!</h3><p class="center muted">${WIN_LABEL[S.winReason]}</p><table class="rtable">`;
  ranking.forEach((i, k) => { const p = S.players[i]; h += `<tr><td>${k + 1}. <span class="av sm" style="--c:${p.color}">${charSVG(i, true)}</span> ${esc(p.name)}${p.out ? ' 💥' : ''}</td><td>${fmtFull(netWorth(S, i))}</td></tr>`; });
  h += '</table><div class="menu-list">';
  if (mode === 'local') h += '<button class="btn primary wide" id="wAgain">🔁 Ván mới</button>';
  else if (lobbyInfo?.host) h += '<button class="btn primary wide" id="wRematch">🔁 Chơi lại phòng này</button>';
  h += '<button class="btn wide" data-close>Xem lại bàn cờ</button><button class="btn ghost wide" id="wHome" style="background:var(--paper2)">🏠 Trang chủ</button></div>';
  openModal(h);
  $('#wAgain')?.addEventListener('click', () => { closeModal(); startLocal(S.players.map((p) => ({ name: p.name, bot: p.bot })), S.timeLimit); });
  $('#wRematch')?.addEventListener('click', () => { closeModal(); net.send({ t: 'rematch' }); });
  $('#wHome').addEventListener('click', () => { closeModal(); goHome(); });
}
function confetti() {
  const colors = ['#e5383b', '#f2b705', '#2f6fde', '#2a9d5c', '#8e44ad', '#ff7aa2'];
  for (let k = 0; k < 90; k++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = colors[k % colors.length];
    c.style.animationDuration = 2 + Math.random() * 2.5 + 's';
    c.style.animationDelay = Math.random() * 0.8 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 6000);
  }
}

// ---------- khởi động ván ----------
function enterGame(state) {
  S = state;
  stateAt = Date.now();
  winShown = state.phase === 'over';
  queue.length = 0; busy = false;
  const last = (state.log || []).slice(-1)[0];
  if (last) addLog(last);
  makeTokens();
  showScreen('game');
  $('#chatForm').classList.toggle('hidden', mode !== 'online');
  $('#bubbles').innerHTML = '';
  $('#netInfo').classList.toggle('hidden', mode !== 'online');
  requestAnimationFrame(() => { tokensEl.classList.add('notrans'); render(); requestAnimationFrame(() => tokensEl.classList.remove('notrans')); });
}

// ===== Chơi trên máy =====
class LocalCtl {
  constructor(s) { this.s = s; this.t = null; this.last = Date.now(); }
  send(a) {
    const now = Date.now();
    tick(this.s, now - this.last);
    this.last = now;
    const r = apply(this.s, this.s.cur, a);
    if (!r.ok) { toast(r.error); render(); return; }
    this.after(r.events);
  }
  after(events) {
    if (this.s.phase === 'over') store.del('ctp_local'); else store.set('ctp_local', this.s);
    pushUpdate(structuredClone(this.s), events);
    this.schedule(animTime(events));
  }
  schedule(ms) {
    clearTimeout(this.t);
    const s = this.s;
    if (s.phase === 'over' || !s.players[s.cur].bot) return;
    this.t = setTimeout(() => { const a = botAction(s, s.cur); if (a) this.send(a); }, ms + BOT_THINK);
  }
  stop() { clearTimeout(this.t); }
}
function startLocal(players, timeLimit) {
  ctl?.stop?.();
  mode = 'local';
  const s = newGame(players, { timeLimit });
  ctl = new LocalCtl(s);
  enterGame(structuredClone(s));
  store.set('ctp_local', s);
  ctl.schedule(300);
}
function resumeLocal() {
  const s = store.get('ctp_local', null);
  if (!s || s.v !== 3) return;
  ctl?.stop?.();
  mode = 'local';
  ctl = new LocalCtl(s);
  enterGame(structuredClone(s));
  ctl.schedule(300);
}

// Màn thiết lập
let setup = store.get('ctp_setup', [
  { name: 'Bạn', bot: false }, { name: 'Máy 1', bot: true }, { name: 'Máy 2', bot: true }, { name: 'Máy 3', bot: true },
]).slice(0, 4);
function renderSetup() {
  $('#localPlayers').innerHTML = setup.map((p, i) => `
    <div class="prow">
      <div class="tok" style="border-color:${PLAYER_COLORS[i]};--c:${PLAYER_COLORS[i]}">${charSVG(i, true)}</div>
      <input data-i="${i}" value="${esc(p.name)}" maxlength="16">
      <button class="toggle ${p.bot ? 'bot' : ''}" data-tg="${i}">${p.bot ? '🤖 Máy' : '🙂 Người'}</button>
      ${setup.length > 2 ? `<button class="xbtn" data-rm="${i}" title="Bỏ">✕</button>` : ''}
    </div>`).join('');
  $('#btnAddPlayer').disabled = setup.length >= 4;
}
$('#localPlayers').addEventListener('input', (e) => { const i = e.target.dataset.i; if (i != null) { setup[i].name = e.target.value; store.set('ctp_setup', setup); } });
$('#localPlayers').addEventListener('click', (e) => {
  const tg = e.target.closest('[data-tg]'), rm = e.target.closest('[data-rm]');
  if (tg) { const p = setup[tg.dataset.tg]; p.bot = !p.bot; }
  else if (rm) setup.splice(+rm.dataset.rm, 1);
  else return;
  store.set('ctp_setup', setup); renderSetup();
});
$('#btnAddPlayer').onclick = () => { if (setup.length < 4) { setup.push({ name: `Máy ${setup.length}`, bot: true }); store.set('ctp_setup', setup); renderSetup(); } };
$('#btnStartLocal').onclick = () => {
  const players = setup.map((p, i) => ({ name: p.name.trim() || `Người ${i + 1}`, bot: p.bot }));
  startLocal(players, +$('#localTime').value);
};
$('#btnResume').onclick = resumeLocal;

// ===== Chơi online =====
let net = null;
let lobbyInfo = null;
const netHandlers = {
  msg: (m) => onNetMsg(m),
  status: (ok) => {
    $('#lobbyNet').className = `net-dot ${ok ? 'ok' : 'bad'}`;
    $('#netInfo').textContent = ok ? (net?.isHost ? '👑 Chủ phòng' : '🟢 Online') : '🔴 Đang kết nối lại…';
    $('#netHint').textContent = ok ? '' : 'Đang kết nối…';
  },
  ping: (ms, kind) => { $('#netInfo').textContent = `🟢 ${ms}ms${kind === 'relay' ? ' · chuyển tiếp' : ''}`; },
};
function hostRoom(name, restore) {
  net?.close();
  net = new HostNet(netHandlers, { name, restore });
  store.set('ctp_room', { host: true });
}
function joinRoom(code, name) {
  net?.close();
  net = new GuestNet(netHandlers, code);
  if (name) net.send({ t: 'join', name });
  store.set('ctp_room', { code });
}
function dropNet() { net?.close(); net = null; store.del('ctp_room'); }
function onNetMsg(m) {
  switch (m.t) {
    case 'room':
      lobbyInfo = m;
      mySeat = m.you;
      if (!m.started) {
        if (mode === 'online' && S) { S = null; closeModal(); }
        mode = 'online';
        renderLobby();
        showScreen('lobby');
      } else {
        mode = 'online';
        if (S) renderPlayers();
      }
      break;
    case 'state':
      if (m.timeLeft > 0) { timerEnd = Date.now() + m.timeLeft; timerTotal = m.limit || timerTotal; } else timerEnd = 0;
      if (mode !== 'online' || !S || $('#game').classList.contains('hidden') || !m.events.length) {
        mode = 'online';
        ctl = { send: (a) => net.send({ t: 'act', action: a }), stop() {} };
        if (!S || $('#game').classList.contains('hidden')) enterGame(m.state);
        else pushUpdate(m.state, []);
      } else pushUpdate(m.state, m.events);
      break;
    case 'chat': addChat(m.name, m.text); if (!$('#game').classList.contains('hidden')) sfx.turn(); break;
    case 'error':
      toast(m.text);
      if (S && mode === 'online') render();
      break;
    case 'left':
      if (m.text) toast(m.text);
      dropNet();
      lobbyInfo = null; S = null; mode = null;
      showScreen('home');
      break;
  }
}
function renderLobby() {
  const L = lobbyInfo;
  $('#roomCode').textContent = L.code;
  $('#seatList').innerHTML = L.seats.map((s, i) => `
    <div class="prow">
      <div class="tok" style="border-color:${PLAYER_COLORS[i]};--c:${PLAYER_COLORS[i]}">${charSVG(i, true)}</div>
      <div class="nm">${esc(s.name)}${i === L.you ? ' (bạn)' : ''}</div>
      ${s.host ? '<span class="tag">👑 chủ phòng</span>' : ''}
      <span class="tag ${s.bot ? '' : s.online ? 'on' : 'off'}">${s.bot ? '🤖 máy' : s.online ? 'online' : 'offline'}</span>
      ${L.host && i !== L.you ? `<button class="xbtn" data-kick="${i}" title="Mời ra">✕</button>` : ''}
    </div>`).join('');
  $('#hostCtl').classList.toggle('hidden', !L.host);
  $('#btnStartOnline').classList.toggle('hidden', !L.host);
  $('#onTime').value = String(L.timeLimit || 60);
  $('#btnAddBot').disabled = L.seats.length >= 4;
  $('#btnStartOnline').disabled = L.seats.length < 2;
  $('#lobbyHint').textContent = L.host
    ? (L.seats.length < 2 ? 'Gửi link mời bạn bè hoặc thêm máy để bắt đầu.' : 'Sẵn sàng! Bấm Bắt đầu khi đủ người.')
    : 'Đang chờ chủ phòng bắt đầu…';
}
const inviteLink = () => `${location.origin}${location.pathname}?room=${lobbyInfo?.code || ''}`;
$('#seatList').addEventListener('click', (e) => { const k = e.target.closest('[data-kick]'); if (k) net.send({ t: 'kick', seat: +k.dataset.kick }); });
$('#btnAddBot').onclick = () => net.send({ t: 'addBot' });
$('#onTime').onchange = () => net.send({ t: 'settings', timeLimit: +$('#onTime').value });
$('#btnStartOnline').onclick = () => net.send({ t: 'start' });
$('#btnLeaveLobby').onclick = () => {
  if (net?.isHost && !confirm('Rời phòng sẽ đóng phòng của mọi người. Tiếp tục?')) return;
  net?.send({ t: 'leave' }); dropNet(); lobbyInfo = null; showScreen('home');
};
$('#btnCopyLink').onclick = async () => {
  try { await navigator.clipboard.writeText(inviteLink()); toast('Đã sao chép link mời'); } catch { prompt('Sao chép link này:', inviteLink()); }
};
$('#btnShareLink').onclick = async () => {
  const data = { title: 'Cờ Tỷ Phú Việt Nam', text: `Vào phòng ${lobbyInfo.code} chơi Cờ Tỷ Phú với mình nhé!`, url: inviteLink() };
  if (navigator.share) { try { await navigator.share(data); } catch {} } else $('#btnCopyLink').click();
};
function myName() {
  const n = $('#onName').value.trim();
  if (!n) { toast('Nhập tên của bạn trước nhé'); $('#onName').focus(); return null; }
  store.set('ctp_name', n);
  return n;
}
$('#btnCreate').onclick = () => { const name = myName(); if (!name) return; $('#netHint').textContent = 'Đang tạo phòng…'; hostRoom(name); };
$('#btnJoin').onclick = () => {
  const name = myName(); if (!name) return;
  const code = $('#onCode').value.trim().toUpperCase();
  if (code.length !== 4) return toast('Mã phòng gồm 4 ký tự');
  $('#netHint').textContent = 'Đang vào phòng…';
  joinRoom(code, name);
};
$('#onCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btnJoin').click(); });
$('#chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('#chatIn').value.trim();
  if (t && net) net.send({ t: 'chat', text: t });
  $('#chatIn').value = '';
});

// ===== Menu trong ván =====
function goHome() {
  ctl?.stop?.();
  if (mode === 'online' && net) { net.send({ t: 'leave' }); dropNet(); }
  S = null; mode = null; lobbyInfo = null;
  closeModal();
  refreshHome();
  showScreen('home');
}
$('#btnMenu').onclick = () => {
  const h = `<h3>☰ Menu</h3><div class="menu-list">
    <button class="btn wide" data-close>▶ Chơi tiếp</button>
    <button class="btn wide" id="mTheme">🎨 Đổi giao diện (${theme === 'sakura' ? 'sang Phố đèn lồng' : 'sang Hoa anh đào'})</button>
    ${mode === 'local' ? '<button class="btn wide" id="mNew">🔁 Ván mới (cùng người chơi)</button><button class="btn ghost wide" id="mHome" style="background:var(--paper2)">💾 Lưu và về trang chủ</button>'
      : `<button class="btn wide" id="mInvite">🔗 Sao chép link mời xem</button><button class="btn primary wide" id="mHome">🚪 ${net?.isHost ? 'Đóng phòng' : 'Rời phòng (máy sẽ đánh thay)'}</button>`}
    </div>`;
  openModal(h);
  $('#mNew')?.addEventListener('click', () => { if (confirm('Bỏ ván hiện tại và chơi ván mới?')) { closeModal(); startLocal(S.players.map((p) => ({ name: p.name, bot: p.bot })), S.timeLimit); } });
  $('#mInvite')?.addEventListener('click', () => $('#btnCopyLink').click());
  $('#mTheme').addEventListener('click', () => { applyTheme(theme === 'sakura' ? 'lantern' : 'sakura'); closeModal(); });
  $('#mHome').addEventListener('click', () => { if (mode === 'local' || confirm(net?.isHost ? 'Đóng phòng? Ván sẽ kết thúc với mọi người.' : 'Rời phòng? Máy sẽ chơi thay bạn.')) goHome(); });
};
const SOUND_ON = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4zm12.3 3 2.6-2.6-1.4-1.4-2.6 2.6-2.6-2.6-1.4 1.4 2.6 2.6-2.6 2.6 1.4 1.4 2.6-2.6 2.6 2.6 1.4-1.4z"/></svg>';
const paintSound = () => { $('#btnSound').innerHTML = soundOn ? SOUND_ON : SOUND_OFF; };

// ===== Nhạc nền =====
const MUSIC_SVG = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M9 4.5v9.9A3.2 3.2 0 1 0 11 17.4V8.6l7-1.4v5.2a3.2 3.2 0 1 0 2 3V3z"/>';
const music = createMusic(audioCtx);
let musicOn = store.get('ctp_music', true);
function paintMusic() {
  $('#btnMusic').innerHTML = `${MUSIC_SVG}${musicOn ? '' : '<path stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M4 4l16 16"/>'}</svg>`;
  $('#btnMusic').classList.toggle('off', !musicOn);
  $('#btnMusicHome').textContent = `🎵 Nhạc nền: ${musicOn ? 'Bật' : 'Tắt'}`;
  $('#btnMusicHome').classList.toggle('on', musicOn);
}
function syncMusic() { if (musicOn && !document.hidden) music.start(); else music.stop(); }
function toggleMusic() { musicOn = !musicOn; store.set('ctp_music', musicOn); paintMusic(); syncMusic(); }
$('#btnMusic').onclick = toggleMusic;
$('#btnMusicHome').onclick = toggleMusic;
document.addEventListener('visibilitychange', syncMusic);
// trình duyệt chỉ cho phát âm thanh sau thao tác đầu tiên của người dùng
document.addEventListener('pointerdown', syncMusic, { once: true });
document.addEventListener('keydown', syncMusic, { once: true });
$('#btnSound').onclick = () => { soundOn = !soundOn; store.set('ctp_sound', soundOn); paintSound(); };

// ===== Giao diện (theme) =====
let theme = store.get('ctp_theme', 'sakura');
function applyTheme(t) {
  theme = t === 'lantern' ? 'lantern' : 'sakura';
  document.body.dataset.theme = theme;
  store.set('ctp_theme', theme);
  document.querySelectorAll('.theme-btn').forEach((b) => b.classList.toggle('on', b.dataset.theme === theme));
  document.querySelector('meta[name="theme-color"]').content = theme === 'sakura' ? '#f7c6e0' : '#2a1747';
}
document.querySelectorAll('.theme-btn').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.theme)));

// ===== Trang chủ =====
function refreshHome() {
  const saved = store.get('ctp_local', null);
  $('#resumeBox').classList.toggle('hidden', !(saved && saved.v === 3 && saved.phase !== 'over'));
  renderSetup();
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $('#tab-local').classList.toggle('hidden', t.dataset.tab !== 'local');
  $('#tab-online').classList.toggle('hidden', t.dataset.tab !== 'online');
}));

function init() {
  // thời lượng animation trong CSS lấy theo ANIM để luôn khớp với nhịp game
  const rs = document.documentElement.style;
  rs.setProperty('--t-step', `${ANIM.step}ms`); rs.setProperty('--t-fly', `${ANIM.fly}ms`); rs.setProperty('--t-dice', `${ANIM.dice}ms`);
  paintMusic();
  applyTheme(theme);
  buildBoard();
  paintSound();
  $('#onName').value = store.get('ctp_name', '');
  refreshHome();
  const params = new URLSearchParams(location.search);
  const room = params.get('room');
  if (room) {
    document.querySelector('.tab[data-tab="online"]').click();
    $('#onCode').value = room.toUpperCase().slice(0, 4);
    if ($('#onName').value) $('#btnJoin').click(); else $('#onName').focus();
    history.replaceState(null, '', location.pathname + (params.get('server') ? `?server=${encodeURIComponent(params.get('server'))}` : ''));
  } else {
    // tải lại trang khi đang ở trong phòng online -> nối lại
    const r = store.get('ctp_room', null);
    const saved = HostNet.saved()?.state?.v === 3 || !HostNet.saved()?.state ? HostNet.saved() : null;
    if (r?.host && saved) hostRoom('', saved);
    else if (r?.code) joinRoom(r.code);
  }
  if (location.protocol === 'file:') $('#netHint').textContent = 'Mở qua web (GitHub Pages) để chơi online.';
}
init();
