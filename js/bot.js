// Máy chơi đơn giản nhưng biết tính toán.
import { BOARD, GROUP_TILES, RESORTS, BAIL, AIRPORT, FESTIVAL, AIRPORT_FEE } from './data.js';
import { ownedBy, tileValue, buyoutCost, buildCost, maxBuildLevel, rentOf, ownsGroup } from './engine.js';

// Đất này giúp hoàn thành nhóm / gần hoàn thành?
function groupBonus(s, pid, i) {
  const t = BOARD[i];
  if (t.type === 'resort') return RESORTS.filter((k) => s.own[k].o === pid).length * 0.5 + 0.5;
  const tiles = GROUP_TILES[t.group];
  const mine = tiles.filter((k) => k !== i && s.own[k].o === pid).length;
  return mine === tiles.length - 1 ? 3 : mine ? 1.2 : 0.6;
}

function reserve(s) {
  // giữ tiền dự phòng tỷ lệ với mặt bằng giá thuê trên bàn
  let maxRent = 0;
  s.own.forEach((o, i) => { if (o && o.o >= 0) maxRent = Math.max(maxRent, rentOf(s, i)); });
  return Math.min(600, 120 + maxRent * 0.6);
}

export function botAction(s, pid) {
  if (s.cur !== pid) return null;
  const p = s.players[pid];
  const pd = s.pending;
  const res = reserve(s);
  switch (s.phase) {
    case 'roll':
      if (p.island) {
        if (p.freeCards) return { type: 'useCard' };
        if (p.money > BAIL + res + 200) return { type: 'payBail' };
      }
      return { type: 'roll' };

    case 'travel': {
      if (p.money < AIRPORT_FEE + res * 0.5) return { type: 'skip' };   // tiếc tiền vé
      let best = 0, bestScore = -1;
      BOARD.forEach((t, i) => {
        if (i === AIRPORT) return;
        let sc = 0;
        const o = s.own[i];
        if (o && o.o < 0 && p.money - t.price > res) sc = groupBonus(s, pid, i) * 10 + t.price / 50;
        else if (o && o.o === pid && t.type === 'city' && o.lvl < 4) sc = 5 + o.lvl;
        else if (i === FESTIVAL && ownedBy(s, pid).length) sc = 4;
        else if (i === 0) sc = 3;
        else if (o && o.o >= 0 && o.o !== pid) sc = -rentOf(s, i);
        if (sc > bestScore) { bestScore = sc; best = i; }
      });
      return { type: 'travel', tile: best };
    }

    case 'buy': {
      const i = pd.tile, t = BOARD[i];
      const bonus = groupBonus(s, pid, i);
      if (t.type === 'resort') return p.money - t.price >= res * 0.6 || bonus >= 1.5 && p.money >= t.price ? { type: 'buy' } : { type: 'skip' };
      for (let l = 3; l >= 0; l--) {
        const cost = t.price + buildCost(i, 0, l);
        if (p.money - cost >= res) return { type: 'buy', lvl: l };
      }
      if (bonus >= 3 && p.money >= t.price) return { type: 'buy', lvl: 0 };
      return { type: 'skip' };
    }

    case 'upgrade': {
      const i = pd.tile, o = s.own[i];
      for (let l = maxBuildLevel(s, i); l > o.lvl; l--) {
        if (p.money - buildCost(i, o.lvl, l) >= res) return { type: 'upgrade', lvl: l };
      }
      return { type: 'skip' };
    }

    case 'buyout': {
      const i = pd.tile, cost = buyoutCost(s, i);
      const bonus = groupBonus(s, pid, i);
      const ok = (bonus >= 3 && p.money - cost >= res * 0.5) || p.money - cost >= res * 2.5;
      return ok ? { type: 'buyout' } : { type: 'skip' };
    }

    case 'festival': {
      const mine = ownedBy(s, pid);
      const best = mine.sort((a, b) => rentOf(s, b) - rentOf(s, a))[0];
      return best != null ? { type: 'festival', tile: best } : { type: 'skip' };
    }

    case 'target': {   // phá / đốt nhà đắt nhất của đối thủ
      const best = [...pd.tiles].sort((a, b) => tileValue(s, b) - tileValue(s, a))[0];
      return best != null ? { type: 'target', tile: best } : { type: 'skip' };
    }

    case 'debt': {
      const mine = ownedBy(s, pid);
      if (!mine.length) return { type: 'bankrupt' };
      // bán đất ít giá trị nhất, ưu tiên đất không thuộc nhóm đã đủ
      const score = (i) => tileValue(s, i) * (BOARD[i].type === 'city' && ownsGroup(s, pid, BOARD[i].group) ? 3 : 1);
      mine.sort((a, b) => score(a) - score(b));
      return { type: 'sell', tile: mine[0] };
    }
  }
  return null;
}
