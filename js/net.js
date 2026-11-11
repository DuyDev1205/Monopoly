// Chơi online KHÔNG CẦN SERVER RIÊNG.
// - Đường chính: các trình duyệt nối thẳng với nhau bằng WebRTC (PeerJS) — nhanh nhất.
// - Đường dự phòng: nếu không nối thẳng được (điện thoại dùng 4G, router chặn P2P…), tin nhắn
//   tự động đi qua MQTT broker công cộng (js/relay.js).
// - Chủ phòng (HostNet) chạy HostRoom ngay trong tab của mình và nghe cả 2 đường.
// - Khách (GuestNet) thử nối thẳng trước, sau vài giây chưa được thì chuyển sang đường dự phòng.
// Hai lớp có cùng giao diện: send(msg), close(); callback on.msg / on.status / on.ping.
import { HostRoom } from './room.js';
import { Mqtt, BROKERS, TOPIC } from './relay.js';

const PEER_CDN = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const PREFIX = 'cotyphu-vn-2026-';
const PEER_OPTS = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};
const CONN_OPTS = { reliable: true, serialization: 'json' };
const FALLBACK_MS = 4000;      // chờ nối thẳng bao lâu rồi dùng đường dự phòng
const NOT_FOUND_MS = 12000;    // quá lâu không ai trả lời -> báo không thấy phòng
// ?relay=1: bỏ qua nối thẳng, chỉ dùng đường dự phòng (để thử nghiệm)
const RELAY_ONLY = new URLSearchParams(location.search).get('relay') === '1';

let peerLib = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  return (peerLib ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PEER_CDN; s.async = true;
    s.onload = () => res(window.Peer);
    s.onerror = () => { peerLib = null; rej(new Error('load')); };
    document.head.appendChild(s);
  }));
}

const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const validToken = (t) => typeof t === 'string' && /^[a-f0-9]{32}$/.test(t);
export function myToken() {
  try {
    let t = localStorage.getItem('ctp_token');
    if (!validToken(t)) { t = rand(16); localStorage.setItem('ctp_token', t); }
    return t;
  } catch { return rand(16); }
}
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
const peerId = (code) => PREFIX + code.toLowerCase();
const relayBase = (code) => `${TOPIC}/${code.toUpperCase()}`;
const HOST_KEY = 'ctp_hostroom';

// chống spam: tối đa 40 tin / 5 giây cho mỗi khách
function limiter() {
  let n = 0, t0 = Date.now();
  return () => { if (Date.now() - t0 > 5000) { t0 = Date.now(); n = 0; } return ++n <= 40; };
}

// ======================= CHỦ PHÒNG =======================
export class HostNet {
  /** opts: { name, restore } — restore là bản lưu phòng khi tải lại trang */
  constructor(on, opts) {
    this.on = on;
    this.token = myToken();
    this.isHost = true;
    this.queue = [];
    this.conns = new Set();
    this.opts = opts;
    this.code = opts.restore?.code || newCode();
    this.tries = 0;
    this.local = (m) => queueMicrotask(() => this.on.msg(structuredClone(m)));
    this.rclients = new Map();   // khách đi đường dự phòng: id -> { token, send, seen, ok }
    this.links = new Map();      // token -> { p2p, relay, send }: ưu tiên nối thẳng, mất thì dùng dự phòng
    // PeerJS không tải được / không lên được trong 5s -> vẫn mở phòng, chỉ dùng đường dự phòng
    this.roomTimer = setTimeout(() => this.ensureRoom(), RELAY_ONLY ? 0 : 5000);
    if (!RELAY_ONLY) this.start();
  }
  ensureRoom() {
    clearTimeout(this.roomTimer);
    if (this.room || this.closed) return;
    const save = () => this.save();
    this.room = this.opts.restore
      ? HostRoom.restore(this.opts.restore, save)
      : new HostRoom({ code: this.code, host: this.token, name: this.opts.name, char: this.opts.char, onChange: save });
    this.room.attach(this.token, this.local);
    this.queue.splice(0).forEach((m) => this.room.handle(this.token, m));
    this.startRelay();
    this.on.status(true);
  }
  async start() {
    let Peer;
    try { Peer = await loadPeer(); } catch { return this.ensureRoom(); }
    if (this.closed) return;
    const peer = new Peer(peerId(this.code), PEER_OPTS);
    this.peer = peer;
    peer.on('open', () => { this.tries = 0; this.ensureRoom(); this.on.status(true); });
    peer.on('connection', (conn) => this.accept(conn));
    peer.on('disconnected', () => setTimeout(() => !peer.destroyed && !this.closed && peer.reconnect(), 1500));
    peer.on('error', (e) => {
      if (e.type !== 'unavailable-id') return;
      peer.destroy();
      if (this.room) return;   // phòng đã mở bằng đường dự phòng: bỏ nối thẳng, vẫn chơi được
      // tải lại trang: mã cũ có thể còn bị giữ vài giây -> thử lại; phòng mới thì đổi mã
      if (this.opts.restore && this.tries++ < 20) setTimeout(() => this.start(), 2500);
      else if (!this.opts.restore) { this.code = newCode(); this.start(); }
      else this.ensureRoom();
    });
  }
  link(token, kind, send) {
    let L = this.links.get(token);
    if (!L) { L = { p2p: null, relay: null }; L.send = (x) => (L.p2p || L.relay)?.(x); this.links.set(token, L); }
    L[kind] = send;
    this.room.attach(token, L.send);
  }
  unlink(token, kind, send) {
    const L = this.links.get(token);
    if (!L || L[kind] !== send) return;
    L[kind] = null;
    if (!L.p2p && !L.relay) { this.links.delete(token); this.room.detach(token, L.send); }
    else this.room.attach(token, L.send);   // còn đường kia: gửi lại trạng thái qua đường đó
  }
  accept(conn) {
    let token = null, send = null;
    const ok = limiter();
    conn.on('data', (m) => {
      if (!ok() || !m || typeof m.t !== 'string' || !this.room) return;
      if (m.t === 'hello') {
        token = validToken(m.token) && m.token !== this.token ? m.token : rand(16);
        send = (x) => { if (conn.open) conn.send(x); };
        conn.send({ t: 'welcome', token });
        this.link(token, 'p2p', send);
        return;
      }
      if (!token) return;
      if (m.t === 'ping') return conn.send({ t: 'pong', at: m.at });
      this.room.handle(token, m);
    });
    const gone = () => { this.conns.delete(conn); if (token && this.room) this.unlink(token, 'p2p', send); };
    conn.on('close', gone);
    conn.on('error', gone);
    this.conns.add(conn);
  }
  // ---- đường dự phòng: nghe trên mọi broker, trả lời qua đúng broker khách đang dùng ----
  startRelay() {
    if (this.relays) return;
    const base = relayBase(this.code);
    this.relays = BROKERS.map((url) => {
      const mq = new Mqtt(url, { message: (topic, env) => this.fromRelay(mq, env) });
      mq.subscribe(`${base}/h`);
      return mq;
    });
    // khách đi đường dự phòng không có sự kiện "ngắt": 20s im lặng (khách ping mỗi 4s) = đã rời
    this.sweep = setInterval(() => {
      for (const [id, c] of this.rclients) {
        if (Date.now() - c.seen < 20000) continue;
        if (c.token && this.room) this.unlink(c.token, 'relay', c.send);
        this.rclients.delete(id);
      }
    }, 5000);
  }
  fromRelay(mq, env) {
    if (!env || typeof env.c !== 'string' || !/^[a-z0-9]{4,24}$/.test(env.c) || !this.room) return;
    const m = env.m;
    if (!m || typeof m.t !== 'string') return;
    let c = this.rclients.get(env.c);
    if (!c) { c = { token: null, send: null, ok: limiter() }; this.rclients.set(env.c, c); }
    c.seen = Date.now();
    if (!c.ok()) return;
    const reply = (x) => mq.publish(`${relayBase(this.code)}/g/${env.c}`, x);
    if (m.t === 'hello') {
      c.token = validToken(m.token) && m.token !== this.token ? m.token : rand(16);
      c.send = reply;
      reply({ t: 'welcome', token: c.token });
      this.link(c.token, 'relay', c.send);
      return;
    }
    if (!c.token) return;
    if (m.t === 'ping') return reply({ t: 'pong', at: m.at });
    if (m.t === 'bye') { this.unlink(c.token, 'relay', c.send); this.rclients.delete(env.c); return; }
    this.room.handle(c.token, m);
  }
  send(m) {
    if (m.t === 'ping') return;
    if (!this.room) this.queue.push(m);
    else this.room.handle(this.token, m);
  }
  save() {
    if (!this.room) return;
    try {
      if (this.room.closed) localStorage.removeItem(HOST_KEY);
      else localStorage.setItem(HOST_KEY, JSON.stringify(this.room.snapshot()));
    } catch {}
  }
  forget() { try { localStorage.removeItem(HOST_KEY); } catch {} }
  close() {
    this.closed = true;
    clearTimeout(this.roomTimer); clearInterval(this.sweep);
    if (this.room && !this.room.closed) this.room.close('Chủ phòng đã đóng phòng');
    this.forget();
    setTimeout(() => {
      try { this.peer?.destroy(); } catch {}
      this.relays?.forEach((r) => r.close());
    }, 400);
  }
  static saved() {
    try {
      const s = JSON.parse(localStorage.getItem(HOST_KEY) || 'null');
      return s && Date.now() - s.at < 3 * 3600e3 ? s : null;
    } catch { return null; }
  }
}

// ======================= KHÁCH =======================
export class GuestNet {
  constructor(on, code) {
    this.on = on;
    this.code = code.toUpperCase();
    this.isHost = false;
    this.outbox = [];
    this.ready = false;
    this.ever = false;
    this.mode = null;              // 'p2p' | 'relay' — đường đang dùng
    this.cid = rand(8);            // mã khách trên đường dự phòng
    if (RELAY_ONLY) this.startRelay();
    else {
      this.startP2P();
      this.fallback = setTimeout(() => this.startRelay(), FALLBACK_MS);
    }
    this.lost = setTimeout(() => {
      if (this.ever || this.closed) return;
      this.on.msg({ t: 'error', text: `Không vào được phòng ${this.code}. Kiểm tra mã phòng và chủ phòng còn mở game không.` });
      this.on.msg({ t: 'left' });
      this.close();
    }, NOT_FOUND_MS);
    this.pingTimer = setInterval(() => this.ready && this.sendNow({ t: 'ping', at: performance.now() }), 4000);
  }

  // nhận tin từ một đường; welcome đầu tiên quyết định dùng đường nào
  receive(kind, m) {
    if (!m || typeof m.t !== 'string' || this.closed) return;
    if (m.t === 'welcome') {
      try { localStorage.setItem('ctp_token', m.token); } catch {}
      if (this.mode && this.mode !== kind) return;      // đường kia đã thắng
      const first = !this.mode;
      this.mode = kind;
      clearTimeout(this.fallback);
      if (first) {
        if (kind === 'relay') { try { this.peer?.destroy(); } catch {} this.peer = null; }
        else if (this.relay) { this.relay.publish(`${relayBase(this.code)}/h`, { c: this.cid, m: { t: 'bye' } }); setTimeout(() => this.closeRelay(), 300); }
      }
      this.ready = true; this.ever = true;
      this.on.status(true);
      this.outbox.splice(0).forEach((x) => this.sendNow(x));
      this.sendNow({ t: 'ping', at: performance.now() });
      return;
    }
    if (kind !== this.mode) return;
    if (m.t === 'pong') { if (typeof m.at === 'number') this.on.ping(Math.round(performance.now() - m.at), kind); return; }
    this.on.msg(m);
  }

  // ---- nối thẳng (WebRTC) ----
  async startP2P() {
    let Peer;
    try { Peer = await loadPeer(); } catch { return this.startRelay(); }
    if (this.closed || this.mode === 'relay') return;
    const peer = new Peer(PEER_OPTS);
    this.peer = peer;
    peer.on('open', () => this.dial());
    peer.on('disconnected', () => setTimeout(() => !peer.destroyed && !this.closed && peer.reconnect(), 1500));
    peer.on('error', (e) => {
      // chủ phòng không có trên máy chủ nối thẳng -> thử ngay đường dự phòng
      if (e.type === 'peer-unavailable') { if (!this.ever) this.startRelay(); else this.retryP2P(); }
      else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type) && !this.ever) this.startRelay();
    });
  }
  dial() {
    if (this.closed || !this.peer) return;
    const conn = this.peer.connect(peerId(this.code), CONN_OPTS);
    this.conn = conn;
    conn.on('open', () => conn.send({ t: 'hello', token: myToken() }));
    conn.on('data', (m) => this.receive('p2p', m));
    const drop = () => {
      if (this.conn !== conn || this.mode !== 'p2p') return;
      this.ready = false;
      this.on.status(false);
      this.retryP2P();
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }
  retryP2P() {
    if (this.closed || !this.peer) return;
    clearTimeout(this.rt);
    this.rt = setTimeout(() => {
      if (!this.peer) return;
      if (this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect();
      if (this.peer.open) this.dial();
    }, 1500);
  }

  // ---- đường dự phòng (MQTT): thử lần lượt từng broker ----
  startRelay(i = 0) {
    if (this.closed || this.mode === 'p2p' || (this.relay && i === 0)) return;
    this.closeRelay();
    const url = BROKERS[i % BROKERS.length];
    const base = relayBase(this.code);
    const mq = new Mqtt(url, {
      up: () => { clearTimeout(this.brokerTimer); mq.publish(`${base}/h`, { c: this.cid, m: { t: 'hello', token: myToken() } }); },
      down: () => { if (this.mode === 'relay') { this.ready = false; this.on.status(false); } },
      message: (topic, m) => this.receive('relay', m),
    });
    mq.subscribe(`${base}/g/${this.cid}`);
    this.relay = mq;
    // broker này không lên được trong 3s -> thử broker kế tiếp
    this.brokerTimer = setTimeout(() => { if (!mq.ready && !this.ever) this.startRelay(i + 1); }, 3000);
  }
  closeRelay() {
    clearTimeout(this.brokerTimer);
    if (this.relay) { this.relay.close(); this.relay = null; }
  }

  sendNow(m) {
    if (this.mode === 'relay') this.relay?.publish(`${relayBase(this.code)}/h`, { c: this.cid, m });
    else if (this.conn?.open) this.conn.send(m);
  }
  send(m) {
    if (this.ready) this.sendNow(m);
    else if (m.t !== 'ping') this.outbox.push(m);
  }
  close() {
    if (this.mode === 'relay') this.sendNow({ t: 'bye' });
    this.closed = true;
    clearInterval(this.pingTimer); clearTimeout(this.rt); clearTimeout(this.fallback); clearTimeout(this.lost);
    setTimeout(() => { try { this.peer?.destroy(); } catch {} this.closeRelay(); }, 300);
  }
}
