// Chơi online KHÔNG CẦN SERVER: các trình duyệt nối thẳng với nhau bằng WebRTC (PeerJS).
// - Chủ phòng (HostNet) chạy HostRoom ngay trong tab của mình.
// - Khách (GuestNet) nối tới chủ phòng theo mã phòng.
// Hai lớp có cùng giao diện: send(msg), close(); callback on.msg / on.status / on.ping.
import { HostRoom } from './room.js';

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
const HOST_KEY = 'ctp_hostroom';

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
    this.start();
  }
  async start() {
    let Peer;
    try { Peer = await loadPeer(); } catch { this.on.msg({ t: 'error', text: 'Không tải được thư viện kết nối, kiểm tra mạng.' }); return; }
    if (this.closed) return;
    const peer = new Peer(peerId(this.code), PEER_OPTS);
    this.peer = peer;
    peer.on('open', () => {
      this.tries = 0;
      if (!this.room) {
        const save = () => this.save();
        this.room = this.opts.restore
          ? HostRoom.restore(this.opts.restore, save)
          : new HostRoom({ code: this.code, host: this.token, name: this.opts.name, onChange: save });
        this.room.attach(this.token, this.local);
        this.queue.splice(0).forEach((m) => this.room.handle(this.token, m));
      }
      this.on.status(true);
    });
    peer.on('connection', (conn) => this.accept(conn));
    peer.on('disconnected', () => { this.on.status(false); setTimeout(() => !peer.destroyed && !this.closed && peer.reconnect(), 1500); });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') {
        peer.destroy();
        // tải lại trang: mã cũ có thể còn bị giữ vài giây -> thử lại; phòng mới thì đổi mã
        if (this.opts.restore && this.tries++ < 20) setTimeout(() => this.start(), 2500);
        else if (!this.opts.restore) { this.code = newCode(); this.start(); }
        else { this.on.msg({ t: 'error', text: 'Không mở lại được phòng cũ.' }); this.forget(); this.on.msg({ t: 'left' }); }
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
        this.on.status(false);
      }
    });
  }
  accept(conn) {
    let token = null, send = null;
    let n = 0, t0 = Date.now();
    conn.on('data', (m) => {
      if (Date.now() - t0 > 5000) { t0 = Date.now(); n = 0; }
      if (++n > 40 || !m || typeof m.t !== 'string' || !this.room) return;
      if (m.t === 'hello') {
        token = validToken(m.token) && m.token !== this.token ? m.token : rand(16);
        send = (x) => { if (conn.open) conn.send(x); };
        conn.send({ t: 'welcome', token });
        this.room.attach(token, send);
        return;
      }
      if (!token) return;
      if (m.t === 'ping') return conn.send({ t: 'pong', at: m.at });
      this.room.handle(token, m);
    });
    const gone = () => { this.conns.delete(conn); if (token && this.room) this.room.detach(token, send); };
    conn.on('close', gone);
    conn.on('error', gone);
    this.conns.add(conn);
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
    if (this.room && !this.room.closed) this.room.close('Chủ phòng đã đóng phòng');
    this.forget();
    setTimeout(() => { try { this.peer?.destroy(); } catch {} }, 300);
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
    this.fails = 0;
    this.start();
    this.pingTimer = setInterval(() => this.ready && this.conn.send({ t: 'ping', at: performance.now() }), 4000);
  }
  async start() {
    let Peer;
    try { Peer = await loadPeer(); } catch { this.on.msg({ t: 'error', text: 'Không tải được thư viện kết nối, kiểm tra mạng.' }); return; }
    if (this.closed) return;
    const peer = new Peer(PEER_OPTS);
    this.peer = peer;
    peer.on('open', () => this.dial());
    peer.on('disconnected', () => setTimeout(() => !peer.destroyed && !this.closed && peer.reconnect(), 1500));
    peer.on('error', (e) => {
      if (e.type === 'peer-unavailable') {
        if (!this.ever && ++this.fails >= 2) {
          this.on.msg({ t: 'error', text: `Không tìm thấy phòng ${this.code} (chủ phòng cần đang mở game).` });
          this.on.msg({ t: 'left' });
          this.close();
        } else this.retry();
      } else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
        this.on.status(false);
      }
    });
  }
  dial() {
    if (this.closed) return;
    const conn = this.peer.connect(peerId(this.code), CONN_OPTS);
    this.conn = conn;
    conn.on('open', () => conn.send({ t: 'hello', token: myToken() }));
    conn.on('data', (m) => {
      if (!m || typeof m.t !== 'string') return;
      if (m.t === 'welcome') {
        try { localStorage.setItem('ctp_token', m.token); } catch {}
        this.ready = true; this.ever = true; this.fails = 0;
        this.on.status(true);
        this.outbox.splice(0).forEach((x) => conn.send(x));
        conn.send({ t: 'ping', at: performance.now() });
        return;
      }
      if (m.t === 'pong') { if (typeof m.at === 'number') this.on.ping(Math.round(performance.now() - m.at)); return; }
      this.on.msg(m);
    });
    const drop = () => {
      if (this.conn !== conn) return;
      this.ready = false;
      this.on.status(false);
      this.retry();
    };
    conn.on('close', drop);
    conn.on('error', drop);
  }
  retry() {
    if (this.closed) return;
    clearTimeout(this.rt);
    this.rt = setTimeout(() => {
      if (this.peer.disconnected && !this.peer.destroyed) this.peer.reconnect();
      if (this.peer.open) this.dial();
    }, 1500);
  }
  send(m) {
    if (this.ready && this.conn?.open) this.conn.send(m);
    else if (m.t !== 'ping') this.outbox.push(m);
  }
  close() {
    this.closed = true;
    clearInterval(this.pingTimer); clearTimeout(this.rt);
    setTimeout(() => { try { this.peer?.destroy(); } catch {} }, 300);
  }
}
