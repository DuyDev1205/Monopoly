// Kết nối WebSocket tới server: tự kết nối lại, đo ping, xếp hàng tin nhắn khi chưa sẵn sàng.
import { SERVER_URL } from './config.js';

export function serverUrl() {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  if (location.protocol === 'file:') return SERVER_URL;
  if (location.hostname.endsWith('github.io')) return SERVER_URL;
  // chạy từ chính server (localhost hoặc VPS) -> dùng cùng địa chỉ
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
}

const TOKEN_KEY = 'ctp_token';
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const setToken = (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch {} };

export class Net {
  /** on: { msg(m), status(connected:boolean), ping(ms) } */
  constructor(on) {
    this.on = on;
    this.url = serverUrl();
    this.ready = false;
    this.closed = false;
    this.retry = 0;
    this.outbox = [];
    this.connect();
    this.pingTimer = setInterval(() => this.ready && this.raw({ t: 'ping', at: performance.now() }), 5000);
  }
  connect() {
    if (this.closed) return;
    let ws;
    try { ws = new WebSocket(this.url); } catch { return this.reconnect(); }
    this.ws = ws;
    ws.onopen = () => { this.raw({ t: 'hello', token: getToken() }); };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'welcome') {
        setToken(m.token);
        this.ready = true; this.retry = 0;
        this.on.status(true);
        const q = this.outbox.splice(0);
        q.forEach((x) => this.raw(x));
        this.raw({ t: 'ping', at: performance.now() });
        return;
      }
      if (m.t === 'pong') { if (typeof m.at === 'number') this.on.ping(Math.round(performance.now() - m.at)); return; }
      this.on.msg(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ready = false;
      this.on.status(false);
      this.reconnect();
    };
    ws.onerror = () => {};
  }
  reconnect() {
    if (this.closed) return;
    const ms = Math.min(4000, 300 * 2 ** this.retry++);
    clearTimeout(this.rt);
    this.rt = setTimeout(() => this.connect(), ms);
  }
  raw(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
  send(m) {
    if (this.ready) this.raw(m);
    else this.outbox.push(m);
  }
  close() {
    this.closed = true;
    clearInterval(this.pingTimer); clearTimeout(this.rt);
    try { this.ws && this.ws.close(); } catch {}
  }
}
