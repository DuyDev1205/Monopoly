// Phòng chơi online chạy NGAY TRONG TRÌNH DUYỆT của chủ phòng (không cần server riêng).
// Chủ phòng giữ trạng thái ván; khách chỉ gửi hành động qua WebRTC.
import { newGame, apply, animTime, publicState, tick, TIME_OPTS } from './engine.js';
import { botAction } from './bot.js';

export const TURN_LIMIT = 45000;       // treo máy quá lâu -> máy đánh hộ
export const DISCONNECT_GRACE = 15000; // rớt mạng -> chờ 15s rồi máy đánh hộ
export const MAX_PLAYERS = 4;
const BOT_THINK = 450;
export const cleanName = (n) => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Khách';

export class HostRoom {
  /** onChange(): gọi sau mỗi thay đổi để chủ phòng lưu lại (khôi phục khi tải lại trang) */
  constructor({ code, host, name, timeLimit = 60, onChange }) {
    this.code = code;
    this.host = host;
    this.seats = [{ token: host, name: cleanName(name), bot: false }];
    this.watchers = new Set();
    this.state = null;
    this.timeLimit = TIME_OPTS.includes(timeLimit) ? timeLimit : 60;
    this.lastTick = Date.now();
    this.clients = new Map(); // token -> send(msg)
    this.timer = null;
    this.deadline = 0;
    this.onChange = onChange || (() => {});
  }

  static restore(snap, onChange) {
    const r = new HostRoom({ code: snap.code, host: snap.host, name: '', onChange });
    r.seats = snap.seats; r.state = snap.state; r.timeLimit = snap.timeLimit || 60;
    r.watchers = new Set(snap.watchers || []);
    return r;
  }
  snapshot() {
    return { code: this.code, host: this.host, seats: this.seats, state: this.state, timeLimit: this.timeLimit, watchers: [...this.watchers], at: Date.now() };
  }

  // ---------- kết nối ----------
  attach(token, send) {
    this.clients.set(token, send);
    this.broadcastRoom();
    if (this.state) {
      this.sendTo(token, this.stateMsg([]));
      if (this.seatOf(token) === this.state.cur) this.schedule(0);
    }
  }
  detach(token, send) {
    if (this.clients.get(token) !== send) return; // đã có kết nối mới thay thế
    this.clients.delete(token);
    this.broadcastRoom();
    if (this.state && this.seatOf(token) === this.state.cur) this.schedule(0);
  }
  online(token) { return token === this.host || this.clients.has(token); }
  seatOf(token) { return this.seats.findIndex((s) => s.token === token); }
  members() {
    const out = new Set(this.seats.filter((s) => s.token).map((s) => s.token));
    this.watchers.forEach((t) => out.add(t));
    return out;
  }
  sendTo(token, msg) { const f = this.clients.get(token); if (f) try { f(msg); } catch {} }
  broadcast(msg) { for (const t of this.members()) this.sendTo(t, msg); }

  roomMsg(token) {
    return {
      t: 'room', code: this.code, started: !!this.state, host: this.host === token, you: this.seatOf(token),
      seats: this.seats.map((s) => ({ name: s.name, bot: s.bot, online: s.bot || this.online(s.token), host: s.token === this.host })),
      timeLimit: this.timeLimit,
    };
  }
  broadcastRoom() { for (const t of this.members()) this.sendTo(t, this.roomMsg(t)); this.onChange(); }
  stateMsg(events) {
    return { t: 'state', state: publicState(this.state), events, timeLeft: this.deadline ? this.deadline - Date.now() : 0, limit: TURN_LIMIT };
  }

  // ---------- máy đánh hộ ----------
  schedule(animMs) {
    clearTimeout(this.timer);
    const s = this.state;
    if (!s || s.phase === 'over') { this.deadline = 0; return; }
    const seat = this.seats[s.cur];
    let wait;
    if (seat.bot) wait = animMs + BOT_THINK;
    else if (!this.online(seat.token)) wait = animMs + DISCONNECT_GRACE;
    else wait = animMs + TURN_LIMIT;
    this.deadline = seat.bot ? 0 : Date.now() + wait;
    this.timer = setTimeout(() => {
      if (this.state !== s || s.phase === 'over') return;
      const a = botAction(s, s.cur);
      if (a) this.act(s.cur, a);
    }, wait);
  }
  act(seat, action) {
    const now = Date.now();
    tick(this.state, now - this.lastTick);
    this.lastTick = now;
    const r = apply(this.state, seat, action);
    if (!r.ok) return r;
    this.schedule(animTime(r.events));
    this.broadcast(this.stateMsg(r.events));
    this.onChange();
    return r;
  }

  // ---------- xử lý tin nhắn ----------
  handle(token, m) {
    if (!m || typeof m.t !== 'string') return;
    const err = (text) => this.sendTo(token, { t: 'error', text });
    const isHost = token === this.host;
    switch (m.t) {
      case 'join': {
        if (this.seatOf(token) >= 0) return this.broadcastRoom();
        if (this.state) { this.watchers.add(token); this.broadcastRoom(); return this.sendTo(token, this.stateMsg([])); }
        if (this.seats.length >= MAX_PLAYERS) return err(`Phòng đã đủ ${MAX_PLAYERS} người`);
        this.seats.push({ token, name: cleanName(m.name), bot: false });
        return this.broadcastRoom();
      }
      case 'leave': {
        if (isHost) return this.close('Chủ phòng đã đóng phòng');
        this.watchers.delete(token);
        const i = this.seatOf(token);
        if (i >= 0) {
          if (!this.state) this.seats.splice(i, 1);
          else { const s = this.seats[i]; s.token = null; s.bot = true; s.name += ' (máy)'; this.state.players[i].bot = true; }
        }
        this.sendTo(token, { t: 'left' });
        this.clients.delete(token);
        this.broadcastRoom();
        if (this.state) this.schedule(0);
        return;
      }
      case 'addBot':
        if (!isHost || this.state) return;
        if (this.seats.length >= MAX_PLAYERS) return err(`Phòng đã đủ ${MAX_PLAYERS} người`);
        this.seats.push({ token: null, name: `Máy ${this.seats.filter((s) => s.bot).length + 1}`, bot: true });
        return this.broadcastRoom();
      case 'kick': {
        if (!isHost || this.state) return;
        const s = this.seats[m.seat | 0];
        if (!s || s.token === token) return;
        this.seats.splice(m.seat | 0, 1);
        if (s.token) { this.sendTo(s.token, { t: 'left', text: 'Bạn đã bị mời ra khỏi phòng' }); this.clients.delete(s.token); }
        return this.broadcastRoom();
      }
      case 'settings':
        if (!isHost || this.state) return;
        if (TIME_OPTS.includes(m.timeLimit)) this.timeLimit = m.timeLimit;
        return this.broadcastRoom();
      case 'start':
        if (!isHost || this.state) return;
        if (this.seats.length < 2) return err('Cần ít nhất 2 người (có thể thêm máy)');
        this.state = newGame(this.seats.map((s) => ({ name: s.name, bot: s.bot })), { timeLimit: this.timeLimit });
        this.lastTick = Date.now();
        this.broadcastRoom();
        this.schedule(0);
        this.broadcast(this.stateMsg([{ t: 'turn', pid: 0 }]));
        return this.onChange();
      case 'act': {
        if (!this.state) return;
        const seat = this.seatOf(token);
        if (seat < 0) return;
        const r = this.act(seat, m.action);
        if (!r.ok) err(r.error);
        return;
      }
      case 'chat': {
        const text = String(m.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
        if (!text) return;
        const name = this.seats[this.seatOf(token)]?.name || 'Khách';
        return this.broadcast({ t: 'chat', name, text });
      }
      case 'rematch':
        if (!isHost || !this.state || this.state.phase !== 'over') return;
        this.state = null;
        this.seats = this.seats.filter((s) => s.bot || s.token);
        this.watchers.forEach((t) => { if (this.seats.length < MAX_PLAYERS) this.seats.push({ token: t, name: 'Khách', bot: false }); });
        this.watchers.clear();
        return this.broadcastRoom();
    }
  }

  close(text) {
    clearTimeout(this.timer);
    for (const t of this.members()) this.sendTo(t, { t: 'left', text: t === this.host ? '' : text });
    this.closed = true;
    this.onChange();
  }
}
