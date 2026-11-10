// Giao diện Cờ Tỷ Phú Việt Nam
import { BOARD, GROUPS, SIZE, AIRPORT, BAIL, SALARY, RESORT_RENT, PLAYER_COLORS, PLAYER_TOKENS, WIN_LABEL, levelCost, SELL_RATE, BUYOUT_RATE, ICONS } from './data.js';
import { newGame, apply, fmt, rentOf, tileValue, buyoutCost, buildCost, maxBuildLevel, ownedBy, netWorth, animTime, ANIM } from './engine.js';
import { botAction } from './bot.js';
import { HostNet, GuestNet } from './net.js';

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
function beep(freq, dur = 0.06, type = 'square', vol = 0.04) {
  if (!soundOn) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
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
    case 'festival': return 'Thuê ×2';
    case 'airport': return 'Bay tự do';
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
      el.innerHTML = `<div class="band" style="--g:${g}"></div><div class="body">${ico(t.icon)}<div class="txt"><div class="nm">${esc(t.name)}</div><div class="pr">${tileSub(t)}</div></div></div>`;
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
  if (owned) el.style.setProperty('--own', s.players[o.o].color); else el.style.removeProperty('--own');
  renderBuilding(i, s);
  el.querySelector('.pr').textContent = owned ? `Thuê ${fmt(rentOf(s, i))}` : fmt(t.price);
}

// ---------- nhà / công trình mọc trên ô (lớp 3D) ----------
const bldLayer = $('#buildings');
const bldEls = [];
function bldAnchor(i) {
  const t = tileEls[i];
  const L = t.offsetLeft, T = t.offsetTop, W = t.offsetWidth, H = t.offsetHeight;
  switch (sideOf(i)) {
    case 'b': return [L + W / 2, T + H * 0.3];
    case 't': return [L + W / 2, T + H * 0.72];
    case 'l': return [L + W * 0.74, T + H * 0.55];
    case 'r': return [L + W * 0.26, T + H * 0.55];
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
const house = (w, d, h, r, cls) => `<div class="m house ${cls}">${box(w, d, h, 'walls')}${roof(w, d, h, r)}</div>`;
const shift = (x, y, html) => `<div class="m" style="transform:translate(${u(x)},${u(y)})">${html}</div>`;
function model(t, lvl) {
  if (t.type === 'resort') return house(4, 3.4, 2.2, 2.8, 'hut');
  switch (lvl) {
    case 1: return house(4, 3.2, 2.8, 2.1, 'lv1');                       // nhà cấp 1: nhà trệt
    case 2: return house(4.4, 3.6, 4.6, 2.3, 'lv2');                     // nhà cấp 2: 2 tầng
    case 3: return shift(-0.6, 0, house(4.6, 3.8, 6.4, 2.5, 'lv3'))      // nhà cấp 3: biệt thự 3 tầng + nhà phụ
      + shift(3.2, 0.6, house(2.4, 2.6, 2.6, 1.6, 'lv1'));
    case 4: return `<div class="m hotel">${box(5.4, 5.4, 11, 'tower')}${lift(11, box(3.8, 3.8, 1.3, 'cap'))}${lift(12.3, '<div class="sign">HOTEL</div>')}</div>`;
  }
  return '';
}
function renderBuilding(i, s) {
  const o = s.own[i];
  if (!o) return;
  let el = bldEls[i];
  if (!el) { el = document.createElement('div'); el.className = 'bld'; bldLayer.appendChild(el); bldEls[i] = el; placeBuilding(i); }
  const key = o.o < 0 ? '' : `${o.o}|${o.lvl}|${s.festival === i}`;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  if (!key) { el.innerHTML = ''; return; }
  el.style.setProperty('--c', s.players[o.o].color);
  const t = BOARD[i];
  const lvl = t.type === 'city' ? o.lvl : 0;
  el.innerHTML = `<div class="gshadow lv${lvl}"></div><div class="grow"><div class="m turn">${model(t, lvl)}</div></div>
    <div class="stand">${s.festival === i ? `<div class="fw">${ico('🎆', 'fi')}</div>` : ''}${lvl === 0 && t.type === 'city' ? '<div class="flag"></div>' : ''}</div>`;
}

function makeTokens() {
  tokensEl.innerHTML = '';
  tokenEls = S.players.map((p) => {
    const el = document.createElement('div');
    el.className = 'token';
    el.style.setProperty('--c', p.color);
    el.title = p.name;
    el.innerHTML = `<div class="shadow"></div><div class="stand"><div class="fig"><div class="head">${ico(p.token, 'hi')}</div><div class="neck"></div><div class="base"></div></div></div>`;
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
    const fx = side === 'l' ? 0.34 : side === 'r' ? 0.66 : 0.5;
    const fy = side === 'b' ? 0.74 : side === 't' ? 0.34 : side === 'corner' ? 0.55 : 0.62;
    const x = t.offsetLeft + t.offsetWidth * fx + SLOTS[k][0] * unit;
    const y = t.offsetTop + t.offsetHeight * fy + SLOTS[k][1] * unit;
    el.style.transform = `translate(${x}px, ${y}px)`;
  });
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
      <div class="tk">${ico(p.token, 'ti')}</div>
      <div class="nm">${esc(p.name)}${tag ? `<small>${tag}</small>` : ''}</div>
      <div class="mn${view.money[i] < 0 ? ' neg' : ''}">${fmt(view.money[i])}</div>
      <div class="st">${st}</div>
      <div class="nw">Tổng ${fmt(netWorth(S, i))}</div>
    </div>`;
  }).join('');
}
function updMoney(pid) {
  const el = document.querySelector(`.pc[data-pid="${pid}"] .mn`);
  if (el) { el.textContent = fmt(view.money[pid]); el.classList.toggle('neg', view.money[pid] < 0); }
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
  lbl.innerHTML = S.phase === 'over' ? '' : `<span class="tk" style="border-color:${p.color}">${ico(p.token, 'ti')}</span>${isMineRaw() ? (mode === 'local' && S.players.filter((q) => !q.bot).length > 1 ? `Lượt của ${esc(p.name)}` : 'Lượt của bạn') : `Lượt của ${esc(p.name)}`}`;
  setPicks([]);
  if (busy || S.phase === 'over') { box.innerHTML = ''; return; }
  if (!isMine()) {
    box.innerHTML = `<div class="sub">${p.bot ? '🤖 Máy đang tính…' : `Đang chờ ${esc(p.name)}…`}</div>`;
    return;
  }
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
          <button class="btn primary big-roll" data-a="roll">🎲 Gieo xúc xắc</button><div class="sub">hoặc nhấn phím Space</div>`;
      }
      break;
    case 'travel':
      h = '<div class="msg">✈️ Chọn một ô bất kỳ trên bàn cờ để bay tới</div>';
      setPicks(BOARD.map((_, i) => i).filter((i) => i !== AIRPORT));
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
      h = '<div class="msg">🎆 Chọn một ô đất của bạn để tổ chức Lễ Hội (tiền thuê ×2)</div><button class="btn" data-a="skip">Bỏ qua</button>';
      setPicks(ownedBy(S, S.cur));
      break;
    case 'debt':
      h = `<div class="msg" style="color:var(--accent)">💸 Bạn đang thiếu ${fmt(-p.money)}!</div><div class="sub">Bấm vào đất của bạn để bán cho ngân hàng (nhận ${SELL_RATE * 100}% giá trị)</div>
        <button class="btn" data-a="bankrupt">💥 Tuyên bố phá sản</button>`;
      setPicks(ownedBy(S, S.cur));
      break;
  }
  box.innerHTML = h;
}
const isMineRaw = () => S && (mode === 'local' ? !S.players[S.cur].bot : S.cur === mySeat);

$('#actions').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-a]');
  if (!b || b.disabled || !isMine()) return;
  const a = { type: b.dataset.a };
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
    const type = S.phase === 'travel' ? 'travel' : S.phase === 'festival' ? 'festival' : S.phase === 'debt' ? 'sell' : null;
    if (type) return act({ type, tile: i });
  }
  showTileInfo(i);
}

function showTileInfo(i) {
  const t = BOARD[i], o = S?.own[i];
  let h = `<h3>${t.icon} ${esc(t.name)}</h3>`;
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
      festival: 'Chọn một ô đất của bạn để tổ chức lễ hội: tiền thuê ở đó ×2.',
      airport: 'Lượt sau được bay tới bất kỳ ô nào trên bàn cờ.',
    };
    h += `<p>${desc[t.type] || ''}</p>`;
  }
  if (o && o.o >= 0 && S) {
    const ow = S.players[o.o];
    h += `<p>Chủ: <b style="color:${ow.color}">${ow.token} ${esc(ow.name)}</b>${S.festival === i ? ' · 🎆 Đang có lễ hội' : ''}<br>Tiền thuê hiện tại: <b>${fmt(rentOf(S, i))}</b><br>Giá trị: ${fmt(tileValue(S, i))}${t.type === 'city' && o.lvl >= 4 ? ' · 🏨 Khách sạn: không thể mua lại' : ` · Giá mua lại: ${fmt(buyoutCost(S, i))}`}</p>`;
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
  $('#roundInfo').textContent = `Vòng ${S.round}${S.maxRounds ? `/${S.maxRounds}` : ''}`;
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
        for (const p of e.path) {
          view.pos[e.pid] = p; hop(e.pid); layoutTokens();
          if (!fast) { sfx.step(); await sleep(ANIM.step); }
        }
        if (!fast) await sleep(80);
        break;
      case 'fly': {
        const el = tokenEls[e.pid];
        el.classList.add('fly');
        view.pos[e.pid] = e.to; layoutTokens();
        if (!fast) await sleep(ANIM.fly);
        el.classList.remove('fly');
        break;
      }
      case 'money':
        view.money[e.pid] += e.delta; updMoney(e.pid);
        if (!fast) { floatMoney(e.pid, e.delta); (e.delta > 0 ? sfx.coin : sfx.pay)(); }
        break;
      case 'card':
        if (fast) break;
        sfx.card();
        $('#cardPop .cp-text').textContent = e.text;
        $('#cardPop').classList.remove('hidden');
        await sleep(ANIM.card);
        $('#cardPop').classList.add('hidden');
        break;
      case 'build':
        renderTile(e.tile, fin);
        if (!fast) { sfx.build(); tileEls[e.tile].classList.remove('flash'); void tileEls[e.tile].offsetWidth; tileEls[e.tile].classList.add('flash'); }
        break;
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
  let h = `<div class="win-big">${ico('🏆', 'wi')}</div><h3 style="justify-content:center">${ico(w.token, 'ti')} ${esc(w.name)} chiến thắng!</h3><p class="center muted">${WIN_LABEL[S.winReason]}</p><table class="rtable">`;
  ranking.forEach((i, k) => { const p = S.players[i]; h += `<tr><td>${k + 1}. ${p.token} ${esc(p.name)}${p.out ? ' 💥' : ''}</td><td>${fmt(netWorth(S, i))}</td></tr>`; });
  h += '</table><div class="menu-list">';
  if (mode === 'local') h += '<button class="btn primary wide" id="wAgain">🔁 Ván mới</button>';
  else if (lobbyInfo?.host) h += '<button class="btn primary wide" id="wRematch">🔁 Chơi lại phòng này</button>';
  h += '<button class="btn wide" data-close>Xem lại bàn cờ</button><button class="btn ghost wide" id="wHome" style="background:var(--paper2)">🏠 Trang chủ</button></div>';
  openModal(h);
  $('#wAgain')?.addEventListener('click', () => { closeModal(); startLocal(S.players.map((p) => ({ name: p.name, bot: p.bot })), S.maxRounds); });
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
const BOT_THINK = 450;
class LocalCtl {
  constructor(s) { this.s = s; this.t = null; }
  send(a) {
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
function startLocal(players, maxRounds) {
  ctl?.stop?.();
  mode = 'local';
  const s = newGame(players, { maxRounds });
  ctl = new LocalCtl(s);
  enterGame(structuredClone(s));
  store.set('ctp_local', s);
  ctl.schedule(300);
}
function resumeLocal() {
  const s = store.get('ctp_local', null);
  if (!s || s.v !== 2) return;
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
      <div class="tok" style="border-color:${PLAYER_COLORS[i]}">${ico(PLAYER_TOKENS[i], 'ti')}</div>
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
  startLocal(players, +$('#localRounds').value);
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
  ping: (ms) => { $('#netInfo').textContent = `🟢 ${ms}ms`; },
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
      <div class="tok" style="border-color:${PLAYER_COLORS[i]}">${ico(PLAYER_TOKENS[i], 'ti')}</div>
      <div class="nm">${esc(s.name)}${i === L.you ? ' (bạn)' : ''}</div>
      ${s.host ? '<span class="tag">👑 chủ phòng</span>' : ''}
      <span class="tag ${s.bot ? '' : s.online ? 'on' : 'off'}">${s.bot ? '🤖 máy' : s.online ? 'online' : 'offline'}</span>
      ${L.host && i !== L.you ? `<button class="xbtn" data-kick="${i}" title="Mời ra">✕</button>` : ''}
    </div>`).join('');
  $('#hostCtl').classList.toggle('hidden', !L.host);
  $('#btnStartOnline').classList.toggle('hidden', !L.host);
  $('#onRounds').value = String(L.maxRounds || 0);
  $('#btnAddBot').disabled = L.seats.length >= 4;
  $('#btnStartOnline').disabled = L.seats.length < 2;
  $('#lobbyHint').textContent = L.host
    ? (L.seats.length < 2 ? 'Gửi link mời bạn bè hoặc thêm máy để bắt đầu.' : 'Sẵn sàng! Bấm Bắt đầu khi đủ người.')
    : 'Đang chờ chủ phòng bắt đầu…';
}
const inviteLink = () => `${location.origin}${location.pathname}?room=${lobbyInfo?.code || ''}`;
$('#seatList').addEventListener('click', (e) => { const k = e.target.closest('[data-kick]'); if (k) net.send({ t: 'kick', seat: +k.dataset.kick }); });
$('#btnAddBot').onclick = () => net.send({ t: 'addBot' });
$('#onRounds').onchange = () => net.send({ t: 'settings', maxRounds: +$('#onRounds').value });
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
    ${mode === 'local' ? '<button class="btn wide" id="mNew">🔁 Ván mới (cùng người chơi)</button><button class="btn ghost wide" id="mHome" style="background:var(--paper2)">💾 Lưu và về trang chủ</button>'
      : `<button class="btn wide" id="mInvite">🔗 Sao chép link mời xem</button><button class="btn primary wide" id="mHome">🚪 ${net?.isHost ? 'Đóng phòng' : 'Rời phòng (máy sẽ đánh thay)'}</button>`}
    </div>`;
  openModal(h);
  $('#mNew')?.addEventListener('click', () => { if (confirm('Bỏ ván hiện tại và chơi ván mới?')) { closeModal(); startLocal(S.players.map((p) => ({ name: p.name, bot: p.bot })), S.maxRounds); } });
  $('#mInvite')?.addEventListener('click', () => $('#btnCopyLink').click());
  $('#mHome').addEventListener('click', () => { if (mode === 'local' || confirm(net?.isHost ? 'Đóng phòng? Ván sẽ kết thúc với mọi người.' : 'Rời phòng? Máy sẽ chơi thay bạn.')) goHome(); });
};
$('#btnSound').onclick = () => { soundOn = !soundOn; store.set('ctp_sound', soundOn); $('#btnSound').textContent = soundOn ? '🔊' : '🔇'; };

// ===== Trang chủ =====
function refreshHome() {
  const saved = store.get('ctp_local', null);
  $('#resumeBox').classList.toggle('hidden', !(saved && saved.v === 2 && saved.phase !== 'over'));
  renderSetup();
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $('#tab-local').classList.toggle('hidden', t.dataset.tab !== 'local');
  $('#tab-online').classList.toggle('hidden', t.dataset.tab !== 'online');
}));

function init() {
  buildBoard();
  $('#btnSound').textContent = soundOn ? '🔊' : '🔇';
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
    const saved = HostNet.saved();
    if (r?.host && saved) hostRoom('', saved);
    else if (r?.code) joinRoom(r.code);
  }
  if (location.protocol === 'file:') $('#netHint').textContent = 'Mở qua web (GitHub Pages) để chơi online.';
}
init();
