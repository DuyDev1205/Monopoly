// Luật chơi Cờ Tỷ Phú Việt Nam — module thuần, dùng chung cho trình duyệt và server Node.
import {
  BOARD, GROUPS, GROUP_TILES, RESORTS, SIDES, CARDS, SIZE,
  START_MONEY, SALARY, BAIL, ISLAND, FESTIVAL, AIRPORT, SELL_RATE, BUYOUT_RATE,
  RESORT_RENT, TAX_RATE, TAX_MIN, PLAYER_COLORS, PLAYER_TOKENS, levelCost, WIN_LABEL,
  FEST_MAX,
  AIRPORT_FEE,
} from './data.js';

const rnd = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Tiền lưu theo đơn vị triệu đồng.
// fmt: dạng gọn cho chỗ hẹp (720tr, 1,5 tỷ). fmtFull: con số đầy đủ (2.000.000.000).
export function fmt(n) {
  const sign = n < 0 ? '-' : '', a = Math.abs(n);
  if (a >= 1000) return `${sign}${String(+(a / 1000).toFixed(3)).replace('.', ',')} tỷ`;
  return `${sign}${a}tr`;
}
export const fmtFull = (n) => `${n < 0 ? '-' : ''}${String(Math.round(Math.abs(n) * 1e6)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export const TIME_OPTS = [15, 30, 45, 60];
/** players: [{name, bot}] ; opts: {timeLimit} (phút) */
export function newGame(players, opts = {}) {
  return {
    v: 3,
    players: players.slice(0, 4).map((p, i) => ({
      name: String(p.name || `Người ${i + 1}`).slice(0, 16),
      bot: !!p.bot,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      token: PLAYER_TOKENS[i % PLAYER_TOKENS.length],
      money: START_MONEY, pos: 0, island: 0, freeCards: 0, travel: false, out: false,
    })),
    own: BOARD.map((t) => (t.type === 'city' || t.type === 'resort' ? { o: -1, lvl: 0 } : null)),
    cur: 0, phase: 'roll', dice: [1, 1], doubles: 0, rolledDouble: false,
    pending: null, festival: -1, festMult: 2, randFests: pickFestTiles([]), round: 1,
    timeLimit: TIME_OPTS.includes(opts.timeLimit) ? opts.timeLimit : 60, playMs: 0,
    deck: shuffle(CARDS.map((_, i) => i)),
    winner: -1, winReason: '', log: [], seq: 0,
  };
}

// ---------- truy vấn ----------
export const alive = (s) => s.players.map((p, i) => i).filter((i) => !s.players[i].out);
export function tileValue(s, i) {
  const t = BOARD[i], o = s.own[i];
  if (!o) return 0;
  let v = t.price;
  if (t.type === 'city') for (let l = 1; l <= o.lvl; l++) v += levelCost(t, l);
  return v;
}
export const ownedBy = (s, pid) => s.own.map((o, i) => (o && o.o === pid ? i : -1)).filter((i) => i >= 0);
export const assets = (s, pid) => ownedBy(s, pid).reduce((a, i) => a + tileValue(s, i), 0);
export const netWorth = (s, pid) => s.players[pid].money + assets(s, pid);
export const ownsGroup = (s, pid, g) => GROUP_TILES[g].every((i) => s.own[i].o === pid);
export const MONO_MULT = 1.5;
export function rentOf(s, i, diceSum = 7) {
  const t = BOARD[i], o = s.own[i];
  if (!o || o.o < 0) return 0;
  let r;
  if (t.type === 'resort') r = RESORT_RENT[RESORTS.filter((k) => s.own[k].o === o.o).length];
  else {
    r = t.rent[o.lvl];
    if (ownsGroup(s, o.o, t.group)) r = Math.round(r * MONO_MULT);   // độc quyền: cả vùng +50%
  }
  if (s.festival === i) r *= s.festMult || 2;
  if (isRandFest(s, i)) r = Math.round(r * RAND_FEST_MULT);
  return r;
}
export const buyoutCost = (s, i) => tileValue(s, i) * BUYOUT_RATE;
// Tổng chi phí mua đất + xây tới cấp lvl (từ cấp hiện tại `from`)
export function buildCost(i, from, to) {
  const t = BOARD[i];
  let c = 0;
  for (let l = from + 1; l <= to; l++) c += levelCost(t, l);
  return c;
}
export function maxBuildLevel(s, i) {
  const o = s.own[i];
  if (BOARD[i].type !== 'city') return 0;
  return o.lvl >= 3 ? 4 : 3;
}

// ---------- tiện ích nội bộ ----------
function log(s, ev, text) {
  s.log.push(text);
  if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
  ev.push({ t: 'msg', text });
}
function money(s, ev, pid, delta) {
  if (!delta) return;
  s.players[pid].money += delta;
  ev.push({ t: 'money', pid, delta });
}
function pay(s, ev, from, to, amount) {
  money(s, ev, from, -amount);
  if (to >= 0) money(s, ev, to, amount);
}
function walk(s, ev, pid, steps) {
  const p = s.players[pid];
  const path = [];
  let pos = p.pos;
  const dir = steps < 0 ? -1 : 1;
  for (let k = 0; k < Math.abs(steps); k++) {
    pos = (pos + dir + SIZE) % SIZE;
    path.push(pos);
    if (pos === 0 && dir > 0) { money(s, ev, pid, SALARY); }
  }
  p.pos = pos;
  ev.push({ t: 'move', pid, path });
  if (path.includes(0) && dir > 0) log(s, ev, `${p.name} qua Xuất Phát, nhận ${fmt(SALARY)}.`);
}
function goTo(s, ev, pid, to, salary = true) {
  const p = s.players[pid];
  const steps = (to - p.pos + SIZE) % SIZE;
  if (salary) walk(s, ev, pid, steps);
  else { p.pos = to; ev.push({ t: 'fly', pid, to }); }
}
function toIsland(s, ev, pid) {
  const p = s.players[pid];
  p.pos = ISLAND; p.island = 3; p.travel = false;
  ev.push({ t: 'fly', pid, to: ISLAND });
  log(s, ev, `${p.name} bị dạt ra Đảo Hoang 🌴`);
  s.rolledDouble = false;
}

// ---------- thời gian ----------
// Bộ điều khiển (máy / chủ phòng) gọi tick() trước mỗi hành động để cộng thời gian chơi.
// Khoảng nghỉ dài (đóng tab, treo máy) chỉ tính tối đa 2 phút.
export function tick(s, ms) { if (s.phase !== 'over') s.playMs = (s.playMs || 0) + Math.max(0, Math.min(ms, 120000)); }
export const timeLeft = (s) => (s.timeLimit ? s.timeLimit * 60000 - (s.playMs || 0) : Infinity);
const timeUp = (s) => timeLeft(s) <= 0;

// ---------- vòng lượt ----------
// ---------- lễ hội địa phương (ngẫu nhiên mỗi vòng) ----------
export const RAND_FEST_MULT = 1.5;   // tiền thuê +50%
export const RAND_FEST_COUNT = 3;    // 3 ô, chọn ngẫu nhiên lúc bắt đầu ván và giữ tới hết ván
const FEST_TILES = BOARD.map((t, i) => (t.type === 'city' || t.type === 'resort' ? i : -1)).filter((i) => i >= 0);
// chọn ngẫu nhiên các ô Festival (không trùng các ô trong prev)
function pickFestTiles(prev) {
  const pool = shuffle(FEST_TILES.filter((i) => !prev.includes(i)));
  return pool.slice(0, RAND_FEST_COUNT).sort((a, b) => a - b);
}
export const isRandFest = (s, i) => (s.randFests || []).includes(i);

function nextTurn(s, ev) {
  s.pending = null; s.doubles = 0; s.rolledDouble = false;
  const n = s.players.length;
  let i = s.cur;
  for (let k = 0; k < n; k++) {
    i = (i + 1) % n;
    if (!s.players[i].out) break;
  }
  if (i <= s.cur) {
    s.round++;
  }
  if (timeUp(s)) {
    const best = alive(s).sort((a, b) => netWorth(s, b) - netWorth(s, a))[0];
    log(s, ev, '⏰ Hết giờ!');
    return win(s, ev, best, 'time');
  }
  s.cur = i;
  const p = s.players[i];
  if (p.travel && !p.freeFly && p.money < AIRPORT_FEE) { p.travel = false; log(s, ev, `${p.name} không đủ ${fmt(AIRPORT_FEE)} mua vé máy bay.`); }
  s.phase = p.travel ? 'travel' : 'roll';
  ev.push({ t: 'turn', pid: i });
}

function win(s, ev, pid, reason) {
  s.winner = pid; s.winReason = reason; s.phase = 'over'; s.pending = null;
  log(s, ev, `🏆 ${s.players[pid].name} chiến thắng — ${WIN_LABEL[reason]}!`);
  ev.push({ t: 'win', pid, reason });
}

function checkWin(s, ev, pid) {
  if (s.phase === 'over') return true;
  const al = alive(s);
  if (al.length === 1) { win(s, ev, al[0], 'last'); return true; }
  if (pid < 0 || s.players[pid].out) return false;
  const groups = Object.keys(GROUP_TILES).filter((g) => ownsGroup(s, pid, g)).length;
  if (groups >= 3) { win(s, ev, pid, 'groups'); return true; }
  if (SIDES.some((side) => side.every((i) => s.own[i].o === pid))) { win(s, ev, pid, 'side'); return true; }
  if (RESORTS.every((i) => s.own[i].o === pid)) { win(s, ev, pid, 'resorts'); return true; }
  return false;
}

// Gọi khi người chơi hiện tại đã xử lý xong ô đang đứng
function proceed(s, ev) {
  if (s.phase === 'over') return;
  const pid = s.cur, p = s.players[pid];
  // người khác có thể âm tiền (thẻ lì xì) -> tự bán
  s.players.forEach((q, k) => { if (k !== pid && !q.out && q.money < 0) autoLiquidate(s, ev, k, pid); });
  if (s.phase === 'over') return;
  if (p.money < 0) {
    if (ownedBy(s, pid).length === 0) return bankrupt(s, ev, pid);
    s.phase = 'debt'; s.pending = null;
    log(s, ev, `${p.name} đang nợ ${fmt(-p.money)}, cần bán tài sản.`);
    return;
  }
  if (s.rolledDouble && !p.island && !p.travel) {
    s.phase = 'roll'; s.pending = null;
    ev.push({ t: 'again', pid });
    return;
  }
  nextTurn(s, ev);
}

// vừa gom đủ một vùng màu -> độc quyền (tiền thuê cả vùng +50%)
function monoCheck(s, ev, pid, i) {
  const t = BOARD[i];
  if (t.type !== 'city' || !ownsGroup(s, pid, t.group)) return;
  ev.push({ t: 'mono', pid, group: t.group, tiles: GROUP_TILES[t.group] });
  log(s, ev, `👑 ${s.players[pid].name} độc quyền vùng ${GROUPS[t.group].name}!`);
}

function sellTile(s, ev, pid, i) {
  const v = Math.floor(tileValue(s, i) * SELL_RATE);
  ev.push({ t: 'sell', pid, tile: i, value: v });
  s.own[i] = { o: -1, lvl: 0 };
  if (s.festival === i) s.festival = -1;
  money(s, ev, pid, v);
  ev.push({ t: 'build', tile: i });
  log(s, ev, `${s.players[pid].name} bán ${BOARD[i].name} được ${fmt(v)}.`);
}

function autoLiquidate(s, ev, pid, creditor) {
  const p = s.players[pid];
  const tiles = ownedBy(s, pid).sort((a, b) => tileValue(s, a) - tileValue(s, b));
  while (p.money < 0 && tiles.length) sellTile(s, ev, pid, tiles.shift());
  if (p.money < 0) bankrupt(s, ev, pid);
}

function bankrupt(s, ev, pid) {
  const p = s.players[pid];
  ownedBy(s, pid).forEach((i) => { s.own[i] = { o: -1, lvl: 0 }; if (s.festival === i) s.festival = -1; ev.push({ t: 'build', tile: i }); });
  p.out = true; p.money = 0;
  log(s, ev, `💥 ${p.name} phá sản!`);
  ev.push({ t: 'bankrupt', pid });
  if (checkWin(s, ev, -1)) return;
  if (s.cur === pid) nextTurn(s, ev);
}

function land(s, ev, pid, diceSum) {
  const p = s.players[pid];
  const i = p.pos, t = BOARD[i], o = s.own[i];
  s.pending = null;
  switch (t.type) {
    case 'city':
    case 'resort': {
      if (o.o < 0) {
        s.phase = 'buy'; s.pending = { tile: i };
        return;
      }
      if (o.o === pid) {
        if (t.type === 'city' && o.lvl < 4) { s.phase = 'upgrade'; s.pending = { tile: i }; return; }
        return proceed(s, ev);
      }
      const owner = s.players[o.o];
      const rent = rentOf(s, i, diceSum);
      log(s, ev, `${p.name} trả ${fmt(rent)} tiền thuê ${t.name} cho ${owner.name}.`);
      ev.push({ t: 'rent', from: pid, to: o.o, tile: i, amount: rent });
      pay(s, ev, pid, o.o, rent);
      if (p.money >= 0 && !(t.type === 'city' && o.lvl >= 4) && p.money >= buyoutCost(s, i)) {
        s.phase = 'buyout'; s.pending = { tile: i, cost: buyoutCost(s, i) };
        return;
      }
      return proceed(s, ev);
    }
    case 'chance': return drawCard(s, ev, pid, diceSum);
    case 'tax': {
      const tax = Math.max(TAX_MIN, Math.round((assets(s, pid) * TAX_RATE) / 5) * 5);
      log(s, ev, `${p.name} nộp thuế ${fmt(tax)}.`);
      ev.push({ t: 'tax', pid, tile: i, amount: tax });
      money(s, ev, pid, -tax);
      return proceed(s, ev);
    }
    case 'island': toIsland(s, ev, pid); return proceed(s, ev);
    case 'airport':
      p.travel = true; s.rolledDouble = false;
      log(s, ev, `${p.name} tới Sân Bay — lượt sau được bay tới ô bất kỳ (vé ${fmt(AIRPORT_FEE)}) ✈️`);
      return proceed(s, ev);
    case 'festival': return startFestival(s, ev, pid);
    case 'start': startBonus(s, ev, pid); return proceed(s, ev);
    default: return proceed(s, ev);
  }
}

// Thưởng khi dừng đúng ô Xuất Phát (ngoài lương): nâng cấp miễn phí 1 nhà ngẫu nhiên (trừ khách sạn),
// thưởng thêm tiền, thẻ cứu hộ hoặc vé bay miễn phí.
export const START_BONUS_CASH = 100;
function startBonus(s, ev, pid) {
  const p = s.players[pid];
  const up = ownedBy(s, pid).filter((k) => BOARD[k].type === 'city' && s.own[k].lvl < 4);
  const pool = [['cash', 25], ['card', 15], ['fly', 20]];
  if (up.length) pool.push(['upgrade', 40]);
  let r = rnd(pool.reduce((a, [, w]) => a + w, 0)), kind = pool[0][0];
  for (const [k, w] of pool) { if (r < w) { kind = k; break; } r -= w; }
  switch (kind) {
    case 'upgrade': {
      const k = up[rnd(up.length)], o = s.own[k];
      o.lvl += 1;
      ev.push({ t: 'bonus', pid, kind, tile: k, lvl: o.lvl });
      ev.push({ t: 'build', tile: k, up: true });
      log(s, ev, `🎁 Thưởng Xuất Phát: ${p.name} được nâng ${BOARD[k].name} lên ${o.lvl >= 4 ? 'Khách sạn' : `nhà cấp ${o.lvl}`} miễn phí!`);
      break;
    }
    case 'cash':
      ev.push({ t: 'bonus', pid, kind, amount: START_BONUS_CASH });
      money(s, ev, pid, START_BONUS_CASH);
      log(s, ev, `🎁 Thưởng Xuất Phát: ${p.name} nhận thêm ${fmt(START_BONUS_CASH)}!`);
      break;
    case 'card':
      p.freeCards++;
      ev.push({ t: 'bonus', pid, kind });
      log(s, ev, `🎁 Thưởng Xuất Phát: ${p.name} nhận 1 thẻ cứu hộ (rời Đảo Hoang miễn phí).`);
      break;
    case 'fly':
      p.travel = true; p.freeFly = true; s.rolledDouble = false;
      ev.push({ t: 'bonus', pid, kind });
      log(s, ev, `🎁 Thưởng Xuất Phát: ${p.name} được vé bay miễn phí, lượt sau bay tới ô bất kỳ ✈️`);
      break;
  }
}

function startFestival(s, ev, pid) {
  const mine = ownedBy(s, pid);
  if (!mine.length) { log(s, ev, `${s.players[pid].name} chưa có đất để tổ chức Lễ Hội.`); return proceed(s, ev); }
  s.phase = 'festival'; s.pending = { tile: s.players[pid].pos };
}

// Nhà của đối thủ có thể bị phá / đốt (khách sạn được miễn)
export function attackTargets(s, pid, kind) {
  return s.own.map((o, i) => {
    if (!o || o.o < 0 || o.o === pid || s.players[o.o].out) return -1;
    const city = BOARD[i].type === 'city';
    if (city && o.lvl >= 4) return -1;
    if (kind === 'burn') return city && o.lvl >= 1 ? i : -1;
    return i;
  }).filter((i) => i >= 0);
}

function drawCard(s, ev, pid, diceSum) {
  const p = s.players[pid];
  if (!s.deck.length) s.deck = shuffle(CARDS.map((_, k) => k));
  const c = CARDS[s.deck.shift()];
  ev.push({ t: 'card', pid, text: c.text, kind: c.kind, amount: c.amount || 0, to: c.to });
  log(s, ev, `🧧 ${p.name}: ${c.text}`);
  switch (c.kind) {
    case 'money': money(s, ev, pid, c.amount); return proceed(s, ev);
    case 'move': goTo(s, ev, pid, c.to); return land(s, ev, pid, diceSum);
    case 'moveBy': walk(s, ev, pid, c.n); return land(s, ev, pid, diceSum);
    case 'nearestResort': {
      let k = p.pos;
      do k = (k + 1) % SIZE; while (BOARD[k].type !== 'resort');
      goTo(s, ev, pid, k);
      return land(s, ev, pid, diceSum);
    }
    case 'island': toIsland(s, ev, pid); return proceed(s, ev);
    case 'hostFest': return startFestival(s, ev, pid);
    case 'demolish': case 'burn': {
      const tiles = attackTargets(s, pid, c.kind);
      if (!tiles.length) { log(s, ev, `Không có nhà nào của đối thủ để ${c.kind === 'burn' ? 'đốt' : 'phá'}.`); return proceed(s, ev); }
      s.phase = 'target'; s.pending = { kind: c.kind, tiles };
      return;
    }
    case 'freeCard': p.freeCards++; return proceed(s, ev);
    case 'repairs': {
      let cost = 0;
      ownedBy(s, pid).forEach((k) => { const l = s.own[k].lvl; if (BOARD[k].type === 'city') cost += l >= 4 ? 3 * c.house + c.landmark : l * c.house; });
      if (cost) money(s, ev, pid, -cost);
      log(s, ev, `${p.name} trả ${fmt(cost)} tiền sửa nhà.`);
      return proceed(s, ev);
    }
    case 'payEach':
      alive(s).forEach((k) => { if (k !== pid) pay(s, ev, pid, k, c.amount); });
      return proceed(s, ev);
    case 'collectEach':
      alive(s).forEach((k) => { if (k !== pid) pay(s, ev, k, pid, c.amount); });
      return proceed(s, ev);
    default: return proceed(s, ev);
  }
}

function doRoll(s, ev, pid) {
  const p = s.players[pid];
  const d = [rnd(6) + 1, rnd(6) + 1];
  s.dice = d;
  const dbl = d[0] === d[1];
  ev.push({ t: 'dice', pid, d });
  if (p.island > 0) {
    if (dbl) {
      p.island = 0; s.rolledDouble = false;
      log(s, ev, `${p.name} gieo đôi ${d[0]}-${d[1]}, thoát khỏi Đảo Hoang!`);
    } else {
      p.island--;
      log(s, ev, `${p.name} gieo ${d[0]}-${d[1]}, vẫn kẹt trên đảo${p.island ? ` (còn ${p.island} lượt)` : ''}.`);
      s.rolledDouble = false;
      return nextTurn(s, ev);
    }
  } else {
    s.rolledDouble = dbl;
    if (dbl) {
      s.doubles++;
      if (s.doubles >= 3) {
        log(s, ev, `${p.name} gieo đôi 3 lần liền!`);
        toIsland(s, ev, pid);
        return nextTurn(s, ev);
      }
    }
  }
  walk(s, ev, pid, d[0] + d[1]);
  land(s, ev, pid, d[0] + d[1]);
}

// ---------- hành động ----------
// Trả về {ok, error, events}
export function apply(s, pid, a) {
  const ev = [];
  const err = (m) => ({ ok: false, error: m, events: [] });
  if (!a || typeof a.type !== 'string') return err('Hành động không hợp lệ');
  if (s.phase === 'over') return err('Ván đã kết thúc');
  if (pid !== s.cur) return err('Chưa tới lượt bạn');
  const p = s.players[pid];
  const pd = s.pending;
  const tile = Number.isInteger(a.tile) && a.tile >= 0 && a.tile < SIZE ? a.tile : -1;

  switch (a.type) {
    case 'roll':
      if (s.phase !== 'roll') return err('Không thể gieo lúc này');
      doRoll(s, ev, pid); break;

    case 'payBail':
      if (s.phase !== 'roll' || !p.island) return err('Bạn không ở trên đảo');
      if (p.money < BAIL) return err('Không đủ tiền');
      money(s, ev, pid, -BAIL); p.island = 0;
      log(s, ev, `${p.name} trả ${fmt(BAIL)} thuê thuyền rời đảo.`);
      doRoll(s, ev, pid); break;

    case 'useCard':
      if (s.phase !== 'roll' || !p.island || !p.freeCards) return err('Không dùng được thẻ');
      p.freeCards--; p.island = 0;
      log(s, ev, `${p.name} dùng thẻ cứu hộ rời đảo.`);
      doRoll(s, ev, pid); break;

    case 'travel': {
      if (s.phase !== 'travel') return err('Không thể bay lúc này');
      if (tile < 0 || tile === AIRPORT) return err('Chọn ô khác');
      const fee = p.freeFly ? 0 : AIRPORT_FEE;
      if (p.money < fee) return err(`Cần ${fmt(fee)} để mua vé`);
      p.travel = false; p.freeFly = false;
      if (fee) { ev.push({ t: 'fee', pid, amount: fee }); money(s, ev, pid, -fee); }
      log(s, ev, `✈️ ${p.name} bay tới ${BOARD[tile].name}.`);
      goTo(s, ev, pid, tile);
      s.rolledDouble = false;
      land(s, ev, pid, 7); break;
    }

    case 'buy': {
      if (s.phase !== 'buy' || !pd) return err('Không thể mua lúc này');
      const i = pd.tile, t = BOARD[i];
      const lvl = t.type === 'city' ? Math.max(0, Math.min(3, a.lvl | 0)) : 0;
      const cost = t.price + buildCost(i, 0, lvl);
      if (p.money < cost) return err('Không đủ tiền');
      ev.push({ t: 'buy', pid, tile: i, cost });
      money(s, ev, pid, -cost);
      s.own[i] = { o: pid, lvl };
      ev.push({ t: 'build', tile: i, up: true });
      log(s, ev, `${p.name} mua ${t.name}${lvl ? ` và xây nhà cấp ${lvl}` : ''} (${fmt(cost)}).`);
      monoCheck(s, ev, pid, i);
      if (checkWin(s, ev, pid)) break;
      proceed(s, ev); break;
    }

    case 'upgrade': {
      if (s.phase !== 'upgrade' || !pd) return err('Không thể xây lúc này');
      const i = pd.tile, o = s.own[i];
      const max = maxBuildLevel(s, i);
      const lvl = Math.min(max, a.lvl | 0);
      if (lvl <= o.lvl) return err('Cấp xây không hợp lệ');
      const cost = buildCost(i, o.lvl, lvl);
      if (p.money < cost) return err('Không đủ tiền');
      ev.push({ t: 'upgrade', pid, tile: i, cost, lvl });
      money(s, ev, pid, -cost);
      o.lvl = lvl;
      ev.push({ t: 'build', tile: i, up: true });
      log(s, ev, `${p.name} ${lvl === 4 ? "xây Khách sạn 🏨 ở" : `nâng lên nhà cấp ${lvl} ở`} ${BOARD[i].name} (${fmt(cost)}).`);
      proceed(s, ev); break;
    }

    case 'buyout': {
      if (s.phase !== 'buyout' || !pd) return err('Không thể mua lại lúc này');
      const i = pd.tile, o = s.own[i];
      const cost = buyoutCost(s, i);
      if (p.money < cost) return err('Không đủ tiền');
      const prev = o.o;
      ev.push({ t: 'buyout', pid, from: prev, tile: i, cost });
      pay(s, ev, pid, prev, cost);
      o.o = pid;
      ev.push({ t: 'build', tile: i, up: true });
      log(s, ev, `🤝 ${p.name} mua lại ${BOARD[i].name} từ ${s.players[prev].name} với giá ${fmt(cost)}.`);
      monoCheck(s, ev, pid, i);
      if (checkWin(s, ev, pid)) break;
      if (BOARD[i].type === 'city' && o.lvl < 4) { s.phase = 'upgrade'; s.pending = { tile: i }; break; }
      proceed(s, ev); break;
    }

    case 'festival': {
      if (s.phase !== 'festival') return err('Không thể tổ chức lúc này');
      if (tile < 0 || !s.own[tile] || s.own[tile].o !== pid) return err('Chọn đất của bạn');
      // tổ chức lại đúng chỗ đang có lễ hội: hệ số tăng dần; chỗ mới: bắt đầu lại từ ×2
      s.festMult = s.festival === tile ? Math.min(FEST_MAX, (s.festMult || 2) + 1) : 2;
      s.festival = tile;
      ev.push({ t: 'fest', pid, tile, mult: s.festMult });
      ev.push({ t: 'build', tile });
      log(s, ev, `🎆 ${p.name} tổ chức Lễ Hội ở ${BOARD[tile].name}: tiền thuê ×${s.festMult}!`);
      proceed(s, ev); break;
    }

    case 'skip':
      if (s.phase === 'travel') {   // không bay: gieo xúc xắc như bình thường
        p.travel = false; p.freeFly = false; s.phase = 'roll';
        log(s, ev, `${p.name} không bay, gieo xúc xắc.`);
        break;
      }
      if (!['buy', 'upgrade', 'buyout', 'festival', 'target'].includes(s.phase)) return err('Không thể bỏ qua');
      proceed(s, ev); break;

    case 'target': {
      if (s.phase !== 'target' || !pd || !pd.tiles.includes(tile)) return err('Chọn một nhà được đánh dấu');
      const o = s.own[tile], from = o.o, name = BOARD[tile].name;
      if (pd.kind === 'burn') {
        o.lvl -= 1;
        ev.push({ t: 'burn', pid, tile, from, lvl: o.lvl });
        log(s, ev, `🔥 ${p.name} đốt nhà của ${s.players[from].name} ở ${name}: còn ${o.lvl ? `nhà cấp ${o.lvl}` : 'đất trống'}.`);
      } else {
        s.own[tile] = { o: -1, lvl: 0 };
        if (s.festival === tile) s.festival = -1;
        ev.push({ t: 'demolish', pid, tile, from });
        log(s, ev, `💥 ${p.name} phá nhà của ${s.players[from].name} ở ${name}!`);
      }
      ev.push({ t: 'build', tile });
      proceed(s, ev); break;
    }

    case 'sellMany': {   // bán một lúc nhiều ô đã chọn
      if (s.phase !== 'debt') return err('Chỉ bán khi đang nợ');
      const list = Array.isArray(a.tiles) ? [...new Set(a.tiles)].filter((k) => Number.isInteger(k) && s.own[k] && s.own[k].o === pid) : [];
      if (!list.length) return err('Chưa chọn ô nào để bán');
      list.forEach((k) => sellTile(s, ev, pid, k));
      proceed(s, ev); break;
    }

    case 'sell':
      if (s.phase !== 'debt') return err('Chỉ bán khi đang nợ');
      if (tile < 0 || !s.own[tile] || s.own[tile].o !== pid) return err('Không phải đất của bạn');
      sellTile(s, ev, pid, tile);
      if (p.money >= 0) proceed(s, ev);
      break;

    case 'bankrupt':
      if (s.phase !== 'debt') return err('Không thể phá sản lúc này');
      bankrupt(s, ev, pid); break;

    default: return err('Hành động lạ');
  }
  s.seq++;
  return { ok: true, events: ev };
}

// Thời lượng animation (ms) của một loạt sự kiện — client và server dùng chung
export const ANIM = { dice: 1000, target: 550, step: 210, fly: 750, card: 3000, turn: 450, rent: 2000, buy: 2000, upgrade: 1900, buyout: 2200, tax: 1900, build: 700, fest: 1900, mono: 1900, fee: 1500, demolish: 2000, burn: 2000, bonus: 2000, rfest: 2000, sell: 1100 };
export const BOT_THINK = 800;   // máy "nghĩ" trước mỗi hành động
export function animTime(events) {
  let t = 0;
  for (const e of events) {
    if (e.t === 'dice') t += ANIM.dice;
    else if (e.t === 'move') t += e.path.length * ANIM.step + 80 + ANIM.target;
    else if (e.t === 'fly') t += ANIM.fly + ANIM.target;
    else if (['rent', 'buy', 'buyout', 'tax', 'upgrade', 'fest', 'mono', 'fee', 'demolish', 'burn', 'bonus', 'rfest', 'sell'].includes(e.t)) t += ANIM[e.t];
    else if (e.t === 'build' && e.up) t += ANIM.build;
    else if (e.t === 'card') t += ANIM.card;
    else if (e.t === 'turn') t += ANIM.turn;
  }
  return t;
}

// Bản trạng thái gửi cho client (giấu thứ tự bộ bài)
export const publicState = (s) => ({ ...s, deck: undefined });

export { BOARD, GROUPS, GROUP_TILES, RESORTS, SIDES, WIN_LABEL };
