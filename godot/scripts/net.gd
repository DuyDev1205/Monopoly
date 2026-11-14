class_name Net
extends Node
## Chơi online, không cần server riêng — tương thích với bản web (js/net.js, js/room.js, js/relay.js).
## Bản app đi đường MQTT công cộng (WebSocket). Khách trên web thử nối thẳng (PeerJS) trước, không thấy thì
## tự chuyển sang MQTT sau vài giây, nên vẫn chơi chung được. Chủ phòng giữ trạng thái ván và chạy luật.

const BROKERS := ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt", "wss://test.mosquitto.org:8081/mqtt"]
const TOPIC := "cotyphu-vn-2026"
const TURN_LIMIT := 45000
const DISCONNECT_GRACE := 15000
const MAX_PLAYERS := 4
const CODE_CHARS := "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

var game: Game
var is_host := false
var code := ""
var token := ""
var closed := false
# ---- khách ----
var relay: Mqtt = null
var broker_i := 0
var cid := ""
var is_up := false
var ever := false
var outbox: Array = []
var t_broker := 0.0
var t_ping := 0.0
var t_lost := 0.0
# ---- chủ phòng ----
var relays: Array = []
var room: Room = null
var rclients := {}              # cid -> {token, mq, seen}


static func rand_hex(n: int) -> String:
	var b := PackedByteArray()
	for k in n:
		b.append(randi() % 256)
	return b.hex_encode()


static func new_code() -> String:
	var s := ""
	for k in 4:
		s += CODE_CHARS[randi() % CODE_CHARS.length()]
	return s


static func _my_token(g: Game) -> String:
	var t: String = str(g.settings.get("token", ""))
	if not RegEx.create_from_string("^[a-f0-9]{32}$").search(t):
		t = rand_hex(16)
		g.settings.token = t
		g.save_settings()
	return t


static func host(g: Game, name: String) -> void:
	if name.strip_edges() == "":
		g.toast("Nhập tên của bạn trước nhé")
		return
	var n := Net.new()
	n.game = g
	n.is_host = true
	n.token = _my_token(g)
	n.code = new_code()
	g.add_child(n)
	g.net = n
	n.room = Room.new(n.code, n.token, name, int(g.settings.setup[0].get("char", 0)))
	n.room.net = n
	n.room.attach(n.token, func(m): g.on_net_msg.call_deferred(Rules.normalize(JSON.parse_string(JSON.stringify(m)))))
	for url in BROKERS:
		var mq := Mqtt.new(url)
		n.add_child(mq)
		mq.message.connect(func(_topic, env): n._from_relay(mq, env))
		mq.subscribe("%s/%s/h" % [TOPIC, n.code])
		n.relays.append(mq)
	g.on_net_status(true)


static func join(g: Game, room_code: String, name: String) -> void:
	if name.strip_edges() == "":
		g.toast("Nhập tên của bạn trước nhé")
		return
	var n := Net.new()
	n.game = g
	n.code = room_code.to_upper()
	n.token = _my_token(g)
	n.cid = rand_hex(4)
	g.add_child(n)
	g.net = n
	n.t_lost = 12.0
	n._start_relay(0)
	n.send({"t": "join", "name": name, "char": int(g.settings.setup[0].get("char", 0))})


func _base() -> String:
	return "%s/%s" % [TOPIC, code]


# ======================= KHÁCH =======================
func _start_relay(i: int) -> void:
	if closed:
		return
	if relay:
		relay.close()
		relay.queue_free()
	broker_i = i
	var mq := Mqtt.new(BROKERS[i % BROKERS.size()])
	add_child(mq)
	mq.up.connect(func(): mq.publish(_base() + "/h", {"c": cid, "m": {"t": "hello", "token": token}}))
	mq.down.connect(func():
		is_up = false
		game.on_net_status(false))
	mq.message.connect(func(_t, m): _receive(m))
	mq.subscribe("%s/g/%s" % [_base(), cid])
	relay = mq
	t_broker = 3.0


func _receive(m) -> void:
	if not (m is Dictionary) or not (m.get("t") is String) or closed:
		return
	m = Rules.normalize(m)
	if m.t == "welcome":
		game.settings.token = m.token
		token = m.token
		is_up = true
		ever = true
		t_broker = 0
		game.on_net_status(true)
		for x in outbox:
			_send_now(x)
		outbox.clear()
		_send_now({"t": "ping", "at": Time.get_ticks_msec()})
		return
	if m.t == "pong":
		game.on_net_ping(Time.get_ticks_msec() - int(m.get("at", 0)))
		return
	game.on_net_msg(m)


func _send_now(m: Dictionary) -> void:
	if relay:
		relay.publish(_base() + "/h", {"c": cid, "m": m})


func send(m: Dictionary) -> void:
	if is_host:
		if m.t != "ping" and room:
			room.handle(token, m)
		return
	if is_up:
		_send_now(m)
	elif m.t != "ping":
		outbox.append(m)


func _process(dt: float) -> void:
	if closed:
		return
	if is_host:
		# khách đi đường MQTT không có sự kiện "ngắt": 20s im lặng (khách ping mỗi 4s) = đã rời
		var now := Time.get_ticks_msec()
		for id in rclients.keys():
			var c: Dictionary = rclients[id]
			if now - c.seen > 20000:
				if c.token != "" and room:
					room.detach(c.token, c.send)
				rclients.erase(id)
		return
	if t_broker > 0:
		t_broker -= dt
		if t_broker <= 0 and relay and not relay.is_up and not ever:
			_start_relay(broker_i + 1)
	if t_lost > 0 and not ever:
		t_lost -= dt
		if t_lost <= 0:
			game.on_net_msg({"t": "error", "text": "Không vào được phòng %s. Kiểm tra mã phòng và chủ phòng còn mở game không." % code})
			game.on_net_msg({"t": "left"})
	t_ping += dt
	if t_ping > 4 and is_up:
		t_ping = 0
		_send_now({"t": "ping", "at": Time.get_ticks_msec()})


# ======================= CHỦ PHÒNG: nhận tin từ khách qua MQTT =======================
func _from_relay(mq: Mqtt, env) -> void:
	if not (env is Dictionary) or not (env.get("c") is String) or room == null:
		return
	if not RegEx.create_from_string("^[a-z0-9]{4,24}$").search(env.c):
		return
	var m = env.get("m")
	if not (m is Dictionary) or not (m.get("t") is String):
		return
	m = Rules.normalize(m)
	var c: Dictionary = rclients.get(env.c, {})
	if c.is_empty():
		c = {"token": "", "send": Callable(), "seen": 0, "n": 0, "t0": Time.get_ticks_msec()}
		rclients[env.c] = c
	c.seen = Time.get_ticks_msec()
	# chống spam: tối đa 40 tin / 5 giây
	if c.seen - c.t0 > 5000:
		c.t0 = c.seen
		c.n = 0
	c.n += 1
	if c.n > 40:
		return
	var topic := "%s/g/%s" % [_base(), env.c]
	var reply := func(x): mq.publish(topic, x)
	if m.t == "hello":
		var tk: String = str(m.get("token", ""))
		c.token = tk if RegEx.create_from_string("^[a-f0-9]{32}$").search(tk) and tk != token else rand_hex(16)
		c.send = reply
		reply.call({"t": "welcome", "token": c.token})
		room.attach(c.token, reply)
		return
	if c.token == "":
		return
	if m.t == "ping":
		reply.call({"t": "pong", "at": m.get("at", 0)})
		return
	if m.t == "bye":
		room.detach(c.token, c.send)
		rclients.erase(env.c)
		return
	room.handle(c.token, m)


func close() -> void:
	if closed:
		return
	if is_host:
		if room and not room.closed:
			room.close("Chủ phòng đã đóng phòng")
	else:
		if is_up:
			_send_now({"t": "leave"})
			_send_now({"t": "bye"})
	closed = true
	await get_tree().create_timer(0.4).timeout
	for r in relays:
		r.close()
	if relay:
		relay.close()
	queue_free()


# ======================= PHÒNG (chạy ở máy chủ phòng) — chép từ js/room.js =======================
class Room:
	var net: Net
	var code: String
	var host: String
	var seats: Array = []
	var watchers := {}
	var state = null
	var time_limit := 60
	var last_tick := 0
	var clients := {}           # token -> Callable(msg)
	var deadline := 0
	var gen := 0
	var closed := false

	func _init(c: String, h: String, name: String, ch: int) -> void:
		code = c
		host = h
		seats = [{"token": h, "name": clean_name(name), "bot": false, "char": ch}]

	static func clean_name(n) -> String:
		var s := str(n if n != null else "").strip_edges().substr(0, 16)
		return s if s != "" else "Khách"

	func attach(tk: String, send: Callable) -> void:
		clients[tk] = send
		broadcast_room()
		if state != null:
			send_to(tk, state_msg([]))
			if seat_of(tk) == int(state.cur):
				schedule(0)

	func detach(tk: String, send: Callable) -> void:
		if clients.get(tk) != send:
			return
		clients.erase(tk)
		broadcast_room()
		if state != null and seat_of(tk) == int(state.cur):
			schedule(0)

	func free_char() -> int:
		var used := seats.map(func(s): return int(s.get("char", -1)))
		for c in 12:
			if not (c in used):
				return c
		return 0

	func online(tk) -> bool:
		return tk == host or clients.has(tk)

	func seat_of(tk) -> int:
		for i in seats.size():
			if seats[i].token == tk and tk != null:
				return i
		return -1

	func members() -> Array:
		var out := {}
		for s in seats:
			if s.token:
				out[s.token] = true
		for t in watchers:
			out[t] = true
		return out.keys()

	func send_to(tk, msg: Dictionary) -> void:
		var f = clients.get(tk)
		if f is Callable and f.is_valid():
			f.call(msg)

	func broadcast(msg: Dictionary) -> void:
		for t in members():
			send_to(t, msg)

	func room_msg(tk) -> Dictionary:
		var ss := []
		for i in seats.size():
			var s: Dictionary = seats[i]
			ss.append({"name": s.name, "char": s.get("char", i), "bot": s.bot, "online": s.bot or online(s.token), "host": s.token == host})
		return {"t": "room", "code": code, "started": state != null, "host": host == tk, "you": seat_of(tk), "seats": ss, "timeLimit": time_limit}

	func broadcast_room() -> void:
		for t in members():
			send_to(t, room_msg(t))

	func state_msg(events: Array) -> Dictionary:
		return {"t": "state", "state": Rules.public_state(state), "events": events,
			"timeLeft": deadline - Time.get_ticks_msec() if deadline else 0, "limit": TURN_LIMIT}

	func schedule(anim_ms: int) -> void:
		gen += 1
		var g := gen
		if state == null or state.phase == "over":
			deadline = 0
			return
		var seat: Dictionary = seats[int(state.cur)]
		var wait := 0
		if seat.bot:
			wait = anim_ms + Rules.BOT_THINK
		elif not online(seat.token):
			wait = anim_ms + DISCONNECT_GRACE
		else:
			wait = anim_ms + TURN_LIMIT
		deadline = 0 if seat.bot else Time.get_ticks_msec() + wait
		await net.get_tree().create_timer(wait / 1000.0).timeout
		if g != gen or state == null or state.phase == "over" or closed:
			return
		var a = Bot.action(state, int(state.cur))
		if a != null:
			act(int(state.cur), a)

	func act(seat: int, action) -> Dictionary:
		var now := Time.get_ticks_msec()
		Rules.tick(state, now - last_tick)
		last_tick = now
		var r := Rules.apply(state, seat, action)
		if not r.ok:
			return r
		schedule(Rules.anim_time(r.events))
		broadcast(state_msg(r.events))
		return r

	func handle(tk: String, m: Dictionary) -> void:
		var is_host_tk := tk == host
		var err := func(text): send_to(tk, {"t": "error", "text": text})
		match m.t:
			"join":
				if seat_of(tk) >= 0:
					broadcast_room()
					return
				if state != null:
					watchers[tk] = true
					broadcast_room()
					send_to(tk, state_msg([]))
					return
				if seats.size() >= MAX_PLAYERS:
					err.call("Phòng đã đủ %d người" % MAX_PLAYERS)
					return
				var ch = m.get("char")
				seats.append({"token": tk, "name": clean_name(m.get("name")), "bot": false, "char": int(ch) if ch is int and ch >= 0 and ch < 16 else free_char()})
				broadcast_room()
			"leave":
				if is_host_tk:
					close("Chủ phòng đã đóng phòng")
					return
				watchers.erase(tk)
				var i := seat_of(tk)
				if i >= 0:
					if state == null:
						seats.remove_at(i)
					else:
						var s: Dictionary = seats[i]
						s.token = null
						s.bot = true
						s.name += " (máy)"
						state.players[i].bot = true
				send_to(tk, {"t": "left"})
				clients.erase(tk)
				broadcast_room()
				if state != null:
					schedule(0)
			"char":
				var i := seat_of(tk)
				var ch = m.get("char")
				if i < 0 or state != null or not (ch is int) or ch < 0 or ch >= 16:
					return
				seats[i].char = ch
				broadcast_room()
			"addBot":
				if not is_host_tk or state != null:
					return
				if seats.size() >= MAX_PLAYERS:
					err.call("Phòng đã đủ %d người" % MAX_PLAYERS)
					return
				seats.append({"token": null, "name": "Máy %d" % (seats.filter(func(s): return s.bot).size() + 1), "bot": true, "char": free_char()})
				broadcast_room()
			"kick":
				if not is_host_tk or state != null:
					return
				var si := int(m.get("seat", -1))
				if si < 0 or si >= seats.size() or seats[si].token == tk:
					return
				var s: Dictionary = seats[si]
				seats.remove_at(si)
				if s.token:
					send_to(s.token, {"t": "left", "text": "Bạn đã bị mời ra khỏi phòng"})
					clients.erase(s.token)
				broadcast_room()
			"settings":
				if not is_host_tk or state != null:
					return
				if int(m.get("timeLimit", 0)) in Rules.TIME_OPTS:
					time_limit = int(m.timeLimit)
				broadcast_room()
			"start":
				if not is_host_tk or state != null:
					return
				if seats.size() < 2:
					err.call("Cần ít nhất 2 người (có thể thêm máy)")
					return
				var ps := []
				for i in seats.size():
					ps.append({"name": seats[i].name, "bot": seats[i].bot, "char": seats[i].get("char", i)})
				state = Rules.new_game(ps, time_limit)
				last_tick = Time.get_ticks_msec()
				broadcast_room()
				schedule(0)
				broadcast(state_msg([{"t": "turn", "pid": 0}]))
			"act":
				if state == null:
					return
				var seat := seat_of(tk)
				if seat < 0:
					return
				var r := act(seat, m.get("action"))
				if not r.ok:
					err.call(r.error)
			"chat":
				var text := str(m.get("text", "")).strip_edges().substr(0, 200)
				if text == "":
					return
				var i := seat_of(tk)
				broadcast({"t": "chat", "name": seats[i].name if i >= 0 else "Khách", "text": text})
			"rematch":
				if not is_host_tk or state == null or state.phase != "over":
					return
				state = null
				seats = seats.filter(func(s): return s.bot or s.token)
				for t in watchers:
					if seats.size() < MAX_PLAYERS:
						seats.append({"token": t, "name": "Khách", "bot": false})
				watchers.clear()
				broadcast_room()

	func close(text: String) -> void:
		gen += 1
		for t in members():
			send_to(t, {"t": "left", "text": "" if t == host else text})
		closed = true


# ======================= MQTT 3.1.1 tối giản qua WebSocket (chỉ QoS 0) =======================
class Mqtt:
	extends Node
	signal message(topic: String, obj)
	signal up
	signal down

	var url: String
	var ws := WebSocketPeer.new()
	var subs: Array = []
	var buf := PackedByteArray()
	var is_up := false
	var closed := false
	var retry := 0
	var pid := 1
	var t_ping := 0.0
	var t_retry := 0.0
	var connecting := false

	func _init(u: String) -> void:
		url = u

	func _ready() -> void:
		_connect()

	static func _str(s: String) -> PackedByteArray:
		var b := s.to_utf8_buffer()
		var out := PackedByteArray([b.size() >> 8, b.size() & 255])
		out.append_array(b)
		return out

	static func _packet(type: int, body: PackedByteArray) -> PackedByteArray:
		var out := PackedByteArray([type])
		var n := body.size()
		while true:
			var d := n % 128
			n = n / 128
			if n:
				d |= 128
			out.append(d)
			if not n:
				break
		out.append_array(body)
		return out

	func _connect() -> void:
		if closed:
			return
		ws = WebSocketPeer.new()
		ws.supported_protocols = PackedStringArray(["mqtt"])
		ws.inbound_buffer_size = 1 << 20
		ws.outbound_buffer_size = 1 << 20
		var e := ws.connect_to_url(url)
		connecting = e == OK
		if e != OK:
			_reconnect()

	func _reconnect() -> void:
		if closed:
			return
		t_retry = minf(5.0, 0.5 * pow(2, retry))
		retry += 1

	func _process(dt: float) -> void:
		if closed:
			return
		if t_retry > 0:
			t_retry -= dt
			if t_retry <= 0:
				_connect()
			return
		ws.poll()
		var st := ws.get_ready_state()
		if st == WebSocketPeer.STATE_OPEN:
			if connecting:
				connecting = false
				var body := _str("MQTT")
				body.append_array(PackedByteArray([4, 0x02, 0, 30]))
				body.append_array(_str("ctp" + Net.rand_hex(5)))
				ws.send(_packet(0x10, body))
			while ws.get_available_packet_count():
				_feed(ws.get_packet())
			if is_up:
				t_ping += dt
				if t_ping > 20:
					t_ping = 0
					ws.send(PackedByteArray([0xc0, 0]))
		elif st == WebSocketPeer.STATE_CLOSED:
			var was := is_up
			is_up = false
			connecting = false
			if was:
				down.emit()
			_reconnect()

	func _feed(chunk: PackedByteArray) -> void:
		buf.append_array(chunk)
		var i := 0
		while i + 2 <= buf.size():
			var length := 0
			var mul := 1
			var k := i + 1
			var byte := 0
			var incomplete := false
			while true:
				if k >= buf.size():
					incomplete = true
					break
				byte = buf[k]
				k += 1
				length += (byte & 127) * mul
				mul *= 128
				if not (byte & 128):
					break
			if incomplete or k + length > buf.size():
				break
			_handle(buf[i] >> 4, buf.slice(k, k + length))
			i = k + length
		buf = buf.slice(i)

	func _handle(type: int, body: PackedByteArray) -> void:
		if type == 2:   # CONNACK
			if body.size() < 2 or body[1] != 0:
				ws.close()
				return
			is_up = true
			retry = 0
			for t in subs:
				_send_sub(t)
			up.emit()
		elif type == 3:   # PUBLISH QoS 0
			var tl := (body[0] << 8) | body[1]
			var topic := body.slice(2, 2 + tl).get_string_from_utf8()
			var obj = JSON.parse_string(body.slice(2 + tl).get_string_from_utf8())
			if obj != null:
				message.emit(topic, obj)

	func _send_sub(topic: String) -> void:
		var id := pid & 0xffff
		pid += 1
		if id == 0:
			id = 1
		var body := PackedByteArray([id >> 8, id & 255])
		body.append_array(_str(topic))
		body.append(0)
		ws.send(_packet(0x82, body))

	func subscribe(topic: String) -> void:
		subs.append(topic)
		if is_up:
			_send_sub(topic)

	func publish(topic: String, obj) -> bool:
		if not is_up:
			return false
		var body := _str(topic)
		body.append_array(JSON.stringify(obj).to_utf8_buffer())
		ws.send(_packet(0x30, body))
		return true

	func close() -> void:
		closed = true
		is_up = false
		if ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
			ws.send(PackedByteArray([0xe0, 0]))
			ws.close()
