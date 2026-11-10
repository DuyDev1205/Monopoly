// Server chơi online cho Cờ Tỷ Phú Việt Nam.
// Node.js + ws. Server giữ trạng thái ván (chống gian lận), client chỉ gửi hành động.
// Đồng thời phục vụ file tĩnh của game để chạy thử tại http://localhost:8387
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { newGame, apply, animTime, publicState } from '../js/engine.js';
import { botAction } from '../js/bot.js';

const PORT = +process.env.PORT || 8387;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TURN_LIMIT = (+process.env.TURN_SECONDS || 45) * 1000;   // treo máy quá lâu -> máy đánh hộ
const DISCONNECT_GRACE = 15000;                                // rớt mạng -> chờ 15s rồi máy đánh hộ
const BOT_THINK = 450;
const MAX_ROOMS = 200;
const MAX_PLAYERS = 4;

// ---------- HTTP: file tĩnh + health ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, clients: wss.clients.size }));
  }
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(ROOT, p));
  const ext = path.extname(file);
  if (!file.startsWith(ROOT + path.sep) || file.includes(`${path.sep}server${path.sep}`) || file.includes(`${path.sep}.`) || !MIME[ext]) {
    res.writeHead(404); return res.end('Not found');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'content-type': MIME[ext], 'cache-control': 'no-cache' });
    res.end(data);
  });
});

// ---------- Phòng ----------
const rooms = new Map();      // code -> room
const sessions = new Map();   // token -> { ws, code, name }
const newCode = () => { let c; do c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[crypto.randomInt(32)]).join(''); while (rooms.has(c)); return c; };
const cleanName = (n) => String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Khách';

function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function seatOf(room, token) { return room.seats.findIndex((s) => s.token === token); }
function online(token) { const s = sessions.get(token); return !!(s && s.ws && s.ws.readyState === 1); }

function roomInfo(room, token) {
  return {
    t: 'room', code: room.code, started: !!room.state, host: room.host === token,
    you: seatOf(room, token),
    seats: room.seats.map((s) => ({ name: s.name, bot: s.bot, online: s.bot || online(s.token), host: s.token === room.host })),
    maxRounds: room.maxRounds,
  };
}
function members(room) {
  const out = new Set(room.seats.filter((s) => s.token).map((s) => s.token));
  room.watchers.forEach((t) => out.add(t));
  return out;
}
function broadcastRoom(room) { for (const t of members(room)) send(sessions.get(t)?.ws, roomInfo(room, t)); }
function broadcastState(room, events) {
  const msg = JSON.stringify({ t: 'state', state: publicState(room.state), events, timeLeft: room.deadline ? room.deadline - Date.now() : 0, limit: TURN_LIMIT });
  for (const t of members(room)) { const ws = sessions.get(t)?.ws; if (ws && ws.readyState === 1) ws.send(msg); }
}

function leaveRoom(token) {
  const sess = sessions.get(token);
  const room = sess && rooms.get(sess.code);
  if (!room) return;
  sess.code = null;
  room.watchers.delete(token);
  const i = seatOf(room, token);
  if (i >= 0) {
    if (!room.state) room.seats.splice(i, 1);
    else { room.seats[i].bot = true; room.seats[i].token = null; room.seats[i].name += ' (máy)'; room.state.players[i].bot = true; }
  }
  if (room.host === token) room.host = room.seats.find((s) => s.token)?.token || null;
  if (!room.seats.some((s) => s.token)) { clearTimeout(room.timer); rooms.delete(room.code); return; }
  broadcastRoom(room);
  if (room.state) schedule(room, 0);
}

// Hẹn giờ: máy đánh cho ghế máy / người rớt mạng / người treo máy quá lâu
function schedule(room, animMs) {
  clearTimeout(room.timer);
  const s = room.state;
  if (!s || s.phase === 'over') { room.deadline = 0; return; }
  const seat = room.seats[s.cur];
  let wait;
  if (seat.bot) wait = animMs + BOT_THINK;
  else if (!online(seat.token)) wait = animMs + DISCONNECT_GRACE;
  else wait = animMs + TURN_LIMIT;
  room.deadline = seat.bot ? 0 : Date.now() + wait;
  room.timer = setTimeout(() => {
    if (room.state !== s || s.phase === 'over') return;
    const a = botAction(s, s.cur);
    if (a) act(room, s.cur, a);
  }, wait);
}

function act(room, seat, action) {
  const r = apply(room.state, seat, action);
  if (!r.ok) return r;
  room.lastActive = Date.now();
  const ms = animTime(r.events);
  schedule(room, ms);
  broadcastState(room, r.events);
  return r;
}

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 });

wss.on('connection', (ws) => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  let token = null;
  let msgCount = 0, windowStart = Date.now();

  ws.on('message', (buf) => {
    // chống spam: tối đa 40 tin / 5 giây
    if (Date.now() - windowStart > 5000) { windowStart = Date.now(); msgCount = 0; }
    if (++msgCount > 40) return;
    let m;
    try { m = JSON.parse(buf); } catch { return; }
    if (!m || typeof m.t !== 'string') return;

    if (m.t === 'hello') {
      token = typeof m.token === 'string' && /^[a-f0-9]{32}$/.test(m.token) ? m.token : crypto.randomBytes(16).toString('hex');
      const old = sessions.get(token);
      if (old?.ws && old.ws !== ws) { try { old.ws.close(4000, 'replaced'); } catch {} }
      const sess = old || { code: null, name: '' };
      sess.ws = ws;
      sessions.set(token, sess);
      send(ws, { t: 'welcome', token });
      const room = sess.code && rooms.get(sess.code);
      if (room) {
        broadcastRoom(room);
        if (room.state) {
          send(ws, { t: 'state', state: publicState(room.state), events: [], timeLeft: room.deadline ? room.deadline - Date.now() : 0, limit: TURN_LIMIT });
          if (seatOf(room, token) === room.state.cur) schedule(room, 0);
        }
      }
      return;
    }
    if (!token) return;
    const sess = sessions.get(token);
    const room = sess.code ? rooms.get(sess.code) : null;
    const err = (text) => send(ws, { t: 'error', text });

    switch (m.t) {
      case 'ping': return send(ws, { t: 'pong', at: m.at });

      case 'create': {
        if (rooms.size >= MAX_ROOMS) return err('Server đang quá tải, thử lại sau.');
        leaveRoom(token);
        const code = newCode();
        const nr = { code, host: token, seats: [{ token, name: cleanName(m.name), bot: false }], watchers: new Set(), state: null, timer: null,
          maxRounds: [0, 20, 30, 50].includes(m.maxRounds) ? m.maxRounds : 0, lastActive: Date.now() };
        rooms.set(code, nr);
        sess.code = code;
        return broadcastRoom(nr);
      }

      case 'join': {
        const code = String(m.code || '').toUpperCase().trim();
        const r = rooms.get(code);
        if (!r) return err('Không tìm thấy phòng ' + code);
        if (room && room !== r) leaveRoom(token);
        sess.code = code;
        if (seatOf(r, token) < 0) {
          if (r.state) r.watchers.add(token);
          else if (r.seats.length >= MAX_PLAYERS) return err(`Phòng đã đủ ${MAX_PLAYERS} người`);
          else r.seats.push({ token, name: cleanName(m.name), bot: false });
        }
        broadcastRoom(r);
        if (r.state) send(ws, { t: 'state', state: publicState(r.state), events: [], timeLeft: r.deadline ? r.deadline - Date.now() : 0, limit: TURN_LIMIT });
        return;
      }

      case 'leave': leaveRoom(token); return send(ws, { t: 'left' });

      case 'addBot':
        if (!room || room.host !== token || room.state) return;
        if (room.seats.length >= MAX_PLAYERS) return err(`Phòng đã đủ ${MAX_PLAYERS} người`);
        room.seats.push({ token: null, name: `Máy ${room.seats.filter((s) => s.bot).length + 1}`, bot: true });
        return broadcastRoom(room);

      case 'kick': {
        if (!room || room.host !== token || room.state) return;
        const i = m.seat | 0;
        const s = room.seats[i];
        if (!s || s.token === token) return;
        room.seats.splice(i, 1);
        if (s.token) { const ks = sessions.get(s.token); if (ks) { ks.code = null; send(ks.ws, { t: 'left', text: 'Bạn đã bị mời ra khỏi phòng' }); } }
        return broadcastRoom(room);
      }

      case 'settings':
        if (!room || room.host !== token || room.state) return;
        if ([0, 20, 30, 50].includes(m.maxRounds)) room.maxRounds = m.maxRounds;
        return broadcastRoom(room);

      case 'start':
        if (!room || room.host !== token || room.state) return;
        if (room.seats.length < 2) return err('Cần ít nhất 2 người (có thể thêm máy)');
        room.state = newGame(room.seats.map((s) => ({ name: s.name, bot: s.bot })), { maxRounds: room.maxRounds });
        broadcastRoom(room);
        schedule(room, 0);
        return broadcastState(room, [{ t: 'turn', pid: 0 }]);

      case 'act': {
        if (!room?.state) return;
        const seat = seatOf(room, token);
        if (seat < 0) return;
        const r = act(room, seat, m.action);
        if (!r.ok) err(r.error);
        return;
      }

      case 'chat': {
        if (!room) return;
        const text = String(m.text || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 200);
        if (!text) return;
        const name = room.seats[seatOf(room, token)]?.name || cleanName(sess.name) || 'Khách';
        const msg = JSON.stringify({ t: 'chat', name, text });
        for (const t of members(room)) { const w = sessions.get(t)?.ws; if (w && w.readyState === 1) w.send(msg); }
        return;
      }

      case 'rematch':
        if (!room || room.host !== token || !room.state || room.state.phase !== 'over') return;
        room.state = null;
        room.seats = room.seats.filter((s) => s.bot || s.token);
        room.watchers.forEach((t) => { if (room.seats.length < MAX_PLAYERS) room.seats.push({ token: t, name: cleanName(sessions.get(t)?.name), bot: false }); });
        room.watchers.clear();
        return broadcastRoom(room);
    }
  });

  ws.on('close', () => {
    const sess = token && sessions.get(token);
    if (!sess || sess.ws !== ws) return;
    sess.ws = null;
    const room = sess.code && rooms.get(sess.code);
    if (room) {
      broadcastRoom(room);
      if (room.state && seatOf(room, token) === room.state.cur) schedule(room, 0);
    }
  });
});

// giữ kết nối sống + dọn phòng bỏ hoang
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive = false; ws.ping();
  }
}, 20000);
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const anyone = [...members(room)].some(online);
    if (!anyone && now - room.lastActive > 30 * 60e3) { clearTimeout(room.timer); rooms.delete(code); }
  }
  for (const [t, s] of sessions) if (!s.ws && !s.code) sessions.delete(t);
}, 5 * 60e3);

server.listen(PORT, HOST, () => console.log(`Cờ Tỷ Phú server: http://${HOST}:${PORT}`));
