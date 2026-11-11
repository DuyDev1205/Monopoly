// Đường chuyển tiếp dự phòng khi 2 máy không nối thẳng được (4G, router chặn P2P…):
// tin nhắn đi qua MQTT broker công cộng bằng WebSocket. Client MQTT 3.1.1 tối giản, chỉ QoS 0.

export const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];
export const TOPIC = 'cotyphu-vn-2026';

const enc = new TextEncoder(), dec = new TextDecoder();
const str = (s) => { const b = enc.encode(s); return [b.length >> 8, b.length & 255, ...b]; };
function packet(type, body) {
  const out = [type];
  let n = body.length;
  do { let d = n % 128; n = Math.floor(n / 128); if (n) d |= 128; out.push(d); } while (n);
  const u = new Uint8Array(out.length + body.length);
  u.set(out); u.set(body, out.length);
  return u;
}

/** Một kết nối tới 1 broker. on: { message(topic, obj), up(), down() } */
export class Mqtt {
  constructor(url, on) {
    this.url = url; this.on = on;
    this.subs = new Set(); this.buf = new Uint8Array(0);
    this.ready = false; this.closed = false; this.retry = 0; this.pid = 1;
    this.connect();
  }
  connect() {
    if (this.closed) return;
    let ws;
    try { ws = new WebSocket(this.url, ['mqtt']); } catch { return this.reconnect(); }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    const id = 'ctp' + Math.random().toString(36).slice(2, 12);
    ws.onopen = () => ws.send(packet(0x10, [...str('MQTT'), 4, 0x02, 0, 30, ...str(id)]));
    ws.onmessage = (e) => this.feed(new Uint8Array(e.data));
    ws.onclose = () => {
      if (this.ws !== ws) return;
      const was = this.ready;
      this.ready = false; clearInterval(this.ping);
      if (was) this.on.down?.();
      this.reconnect();
    };
    ws.onerror = () => {};
  }
  reconnect() {
    if (this.closed) return;
    clearTimeout(this.rt);
    this.rt = setTimeout(() => this.connect(), Math.min(5000, 500 * 2 ** this.retry++));
  }
  feed(chunk) {
    // gom dữ liệu rồi tách từng gói MQTT
    const b = new Uint8Array(this.buf.length + chunk.length);
    b.set(this.buf); b.set(chunk, this.buf.length);
    let i = 0;
    while (i + 2 <= b.length) {
      let len = 0, mul = 1, k = i + 1, byte;
      do { if (k >= b.length) { this.buf = b.slice(i); return; } byte = b[k++]; len += (byte & 127) * mul; mul *= 128; } while (byte & 128);
      if (k + len > b.length) break;
      this.handle(b[i] >> 4, b.subarray(k, k + len));
      i = k + len;
    }
    this.buf = b.slice(i);
  }
  handle(type, body) {
    if (type === 2) {   // CONNACK
      if (body[1] !== 0) return this.ws.close();
      this.ready = true; this.retry = 0;
      this.subs.forEach((t) => this.sendSub(t));
      clearInterval(this.ping);
      this.ping = setInterval(() => this.raw(new Uint8Array([0xc0, 0])), 20000);
      this.on.up?.();
    } else if (type === 3) {   // PUBLISH (QoS 0)
      const tl = (body[0] << 8) | body[1];
      const topic = dec.decode(body.subarray(2, 2 + tl));
      let obj;
      try { obj = JSON.parse(dec.decode(body.subarray(2 + tl))); } catch { return; }
      this.on.message?.(topic, obj);
    }
  }
  raw(u8) { if (this.ws && this.ws.readyState === 1) this.ws.send(u8); }
  sendSub(topic) {
    const id = this.pid++ & 0xffff || 1;
    this.raw(packet(0x82, [id >> 8, id & 255, ...str(topic), 0]));
  }
  subscribe(topic) { this.subs.add(topic); if (this.ready) this.sendSub(topic); }
  publish(topic, obj) {
    if (!this.ready) return false;
    const payload = enc.encode(JSON.stringify(obj));
    const head = str(topic);
    const body = new Uint8Array(head.length + payload.length);
    body.set(head); body.set(payload, head.length);
    this.raw(packet(0x30, body));
    return true;
  }
  close() {
    this.closed = true; this.ready = false;
    clearInterval(this.ping); clearTimeout(this.rt);
    try { this.raw(new Uint8Array([0xe0, 0])); this.ws?.close(); } catch {}
  }
}
