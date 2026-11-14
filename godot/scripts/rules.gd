class_name Rules
## Luật chơi — chép từng dòng từ js/engine.js (bản web). Trạng thái là Dictionary có đúng tên trường như bản web
## để gửi/nhận JSON khi chơi online chung. Đổi luật bên này thì đổi cả bên kia.

const TIME_OPTS := [15, 30, 45, 60]
const MONO_MULT := 1.5
const RAND_FEST_MULT := 1.5
const RAND_FEST_COUNT := 3
const START_BONUS_CASH := 100
const ANIM := {"dice": 1000, "target": 550, "step": 210, "fly": 750, "card": 3000, "turn": 450, "rent": 2000, "buy": 2000,
	"upgrade": 1900, "buyout": 2200, "tax": 1900, "build": 700, "fest": 1900, "mono": 2600, "fee": 1500, "demolish": 2000,
	"burn": 2000, "bonus": 2000, "rfest": 2000, "sell": 1100}
const BOT_THINK := 800


static func rnd(n: int) -> int:
	return randi() % n


static func shuffle(a: Array) -> Array:
	for i in range(a.size() - 1, 0, -1):
		var j := rnd(i + 1)
		var t = a[i]
		a[i] = a[j]
		a[j] = t
	return a


static func fmt(n: int) -> String:
	return Data.fmt(n)


## 2000 -> "2.000.000.000"
static func fmt_full(n: int) -> String:
	var s := str(absi(n) * 1000000)
	var out := ""
	var c := 0
	for i in range(s.length() - 1, -1, -1):
		out = s[i] + out
		c += 1
		if c % 3 == 0 and i > 0:
			out = "." + out
	return ("-" if n < 0 else "") + out


static func _fest_tiles() -> Array:
	var out := []
	for i in Data.BOARD.size():
		if Data.BOARD[i].type in ["city", "resort"]:
			out.append(i)
	return out


static func pick_fest_tiles(prev: Array) -> Array:
	var pool := shuffle(_fest_tiles().filter(func(i): return not (i in prev)))
	var out := pool.slice(0, RAND_FEST_COUNT)
	out.sort()
	return out


## players: [{name, bot, char}] ; time_limit (phút)
static func new_game(players: Array, time_limit := 60) -> Dictionary:
	var ps := []
	for i in mini(players.size(), 4):
		var p: Dictionary = players[i]
		var ch = p.get("char", i)
		ps.append({
			"name": str(p.get("name", "Người %d" % (i + 1))).substr(0, 16),
			"bot": bool(p.get("bot", false)),
			"char": int(ch) if (ch is int or ch is float) and int(ch) >= 0 and int(ch) < 16 else i,
			"color": Data.PLAYER_COLORS[i % 4], "token": Data.PLAYER_TOKENS[i % 4],
			"money": Data.START_MONEY, "pos": 0, "island": 0, "freeCards": 0, "travel": false, "out": false,
		})
	var own := []
	for t in Data.BOARD:
		own.append({"o": -1, "lvl": 0} if t.type in ["city", "resort"] else null)
	var deck := []
	for k in Data.CARDS.size():
		deck.append(k)
	return {
		"v": 3, "players": ps, "own": own,
		"cur": 0, "phase": "roll", "dice": [1, 1], "doubles": 0, "rolledDouble": false,
		"pending": null, "festival": -1, "festMult": 2, "randFests": pick_fest_tiles([]), "round": 1,
		"timeLimit": time_limit if time_limit in TIME_OPTS else 60, "playMs": 0,
		"deck": shuffle(deck), "winner": -1, "winReason": "", "log": [], "seq": 0,
	}


# ---------- truy vấn ----------
static func alive(s: Dictionary) -> Array:
	var out := []
	for i in s.players.size():
		if not s.players[i].out:
			out.append(i)
	return out


static func tile_value(s: Dictionary, i: int) -> int:
	var t: Dictionary = Data.BOARD[i]
	var o = s.own[i]
	if o == null:
		return 0
	var v: int = t.price
	if t.type == "city":
		for l in range(1, int(o.lvl) + 1):
			v += Data.level_cost(t, l)
	return v


static func owned_by(s: Dictionary, pid: int) -> Array:
	var out := []
	for i in s.own.size():
		var o = s.own[i]
		if o != null and int(o.o) == pid:
			out.append(i)
	return out


static func assets(s: Dictionary, pid: int) -> int:
	var a := 0
	for i in owned_by(s, pid):
		a += tile_value(s, i)
	return a


static func net_worth(s: Dictionary, pid: int) -> int:
	return int(s.players[pid].money) + assets(s, pid)


static func owns_group(s: Dictionary, pid: int, g: String) -> bool:
	for i in Data.GROUP_TILES[g]:
		if int(s.own[i].o) != pid:
			return false
	return true


## Ô bay tới được từ Sân Bay: ô đất/biển chưa có chủ hoặc của mình, Xuất Phát, Lễ Hội
static func can_fly(s: Dictionary, pid: int, i: int) -> bool:
	if i < 0 or i >= Data.SIZE or not (Data.BOARD[i].type in ["city", "resort", "start", "festival"]):
		return false
	var o = s.own[i]
	return not (o != null and int(o.o) >= 0 and int(o.o) != pid)


static func is_rand_fest(s: Dictionary, i: int) -> bool:
	return i in s.get("randFests", [])


static func rent_of(s: Dictionary, i: int, _dice_sum := 7) -> int:
	var t: Dictionary = Data.BOARD[i]
	var o = s.own[i]
	if o == null or int(o.o) < 0:
		return 0
	var r: int
	if t.type == "resort":
		var n := 0
		for k in Data.RESORTS:
			if int(s.own[k].o) == int(o.o):
				n += 1
		r = Data.RESORT_RENT[n]
	else:
		r = t.rent[int(o.lvl)]
		if owns_group(s, int(o.o), t.group):
			r = _jround(r * MONO_MULT)
	if int(s.festival) == i:
		r *= int(s.get("festMult", 2))
	if is_rand_fest(s, i):
		r = _jround(r * RAND_FEST_MULT)
	return r


## Math.round của JS (làm tròn .5 lên) — khác round() của Godot với số âm, giữ đúng như web
static func _jround(x: float) -> int:
	return int(floor(x + 0.5))


static func buyout_cost(s: Dictionary, i: int) -> int:
	return tile_value(s, i) * Data.BUYOUT_RATE


static func build_cost(i: int, from: int, to: int) -> int:
	var t: Dictionary = Data.BOARD[i]
	var c := 0
	for l in range(from + 1, to + 1):
		c += Data.level_cost(t, l)
	return c


static func max_build_level(s: Dictionary, i: int) -> int:
	var o = s.own[i]
	if Data.BOARD[i].type != "city":
		return 0
	if int(s.round) <= 1:
		return 3
	return 4 if int(o.lvl) >= 3 else 3


# ---------- tiện ích nội bộ ----------
static func _log(s: Dictionary, ev: Array, text: String) -> void:
	s.log.append(text)
	if s.log.size() > 80:
		s.log = s.log.slice(s.log.size() - 80)
	ev.append({"t": "msg", "text": text})


static func _money(s: Dictionary, ev: Array, pid: int, delta: int) -> void:
	if delta == 0:
		return
	s.players[pid].money = int(s.players[pid].money) + delta
	ev.append({"t": "money", "pid": pid, "delta": delta})


static func _pay(s: Dictionary, ev: Array, from: int, to: int, amount: int) -> void:
	_money(s, ev, from, -amount)
	if to >= 0:
		_money(s, ev, to, amount)


static func _walk(s: Dictionary, ev: Array, pid: int, steps: int) -> void:
	var p: Dictionary = s.players[pid]
	var path := []
	var pos: int = int(p.pos)
	var dir := -1 if steps < 0 else 1
	for k in absi(steps):
		pos = (pos + dir + Data.SIZE) % Data.SIZE
		path.append(pos)
		if pos == 0 and dir > 0:
			_money(s, ev, pid, Data.SALARY)
	p.pos = pos
	ev.append({"t": "move", "pid": pid, "path": path})
	if 0 in path and dir > 0:
		_log(s, ev, "%s qua Xuất Phát, nhận %s." % [p.name, fmt(Data.SALARY)])


static func _go_to(s: Dictionary, ev: Array, pid: int, to: int, salary := true) -> void:
	var p: Dictionary = s.players[pid]
	var steps := (to - int(p.pos) + Data.SIZE) % Data.SIZE
	if salary:
		_walk(s, ev, pid, steps)
	else:
		p.pos = to
		ev.append({"t": "fly", "pid": pid, "to": to})


static func _to_island(s: Dictionary, ev: Array, pid: int) -> void:
	var p: Dictionary = s.players[pid]
	p.pos = Data.ISLAND
	p.island = 3
	p.travel = false
	ev.append({"t": "fly", "pid": pid, "to": Data.ISLAND})
	_log(s, ev, "%s bị dạt ra Đảo Hoang 🌴" % p.name)
	s.rolledDouble = false


# ---------- thời gian ----------
static func tick(s: Dictionary, ms: int) -> void:
	if s.phase != "over":
		s.playMs = int(s.get("playMs", 0)) + maxi(0, mini(ms, 120000))


static func time_left(s: Dictionary) -> float:
	return int(s.timeLimit) * 60000 - int(s.get("playMs", 0)) if int(s.get("timeLimit", 0)) else INF


static func _time_up(s: Dictionary) -> bool:
	return time_left(s) <= 0


# ---------- vòng lượt ----------
static func _next_turn(s: Dictionary, ev: Array) -> void:
	s.pending = null
	s.doubles = 0
	s.rolledDouble = false
	var n: int = s.players.size()
	var i: int = int(s.cur)
	for k in n:
		i = (i + 1) % n
		if not s.players[i].out:
			break
	if i <= int(s.cur):
		s.round = int(s.round) + 1
	if _time_up(s):
		var al := alive(s)
		al.sort_custom(func(a, b): return net_worth(s, a) > net_worth(s, b))
		_log(s, ev, "⏰ Hết giờ!")
		_win(s, ev, al[0], "time")
		return
	s.cur = i
	var p: Dictionary = s.players[i]
	if p.travel and not p.get("freeFly", false) and int(p.money) < Data.AIRPORT_FEE:
		p.travel = false
		_log(s, ev, "%s không đủ %s mua vé máy bay." % [p.name, fmt(Data.AIRPORT_FEE)])
	s.phase = "travel" if p.travel else "roll"
	ev.append({"t": "turn", "pid": i})


static func _win(s: Dictionary, ev: Array, pid: int, reason: String) -> void:
	s.winner = pid
	s.winReason = reason
	s.phase = "over"
	s.pending = null
	_log(s, ev, "🏆 %s chiến thắng — %s!" % [s.players[pid].name, Data.WIN_LABEL[reason]])
	ev.append({"t": "win", "pid": pid, "reason": reason})


static func _check_win(s: Dictionary, ev: Array, pid: int) -> bool:
	if s.phase == "over":
		return true
	var al := alive(s)
	if al.size() == 1:
		_win(s, ev, al[0], "last")
		return true
	if pid < 0 or s.players[pid].out:
		return false
	var groups := 0
	for g in Data.GROUP_TILES:
		if owns_group(s, pid, g):
			groups += 1
	if groups >= 3:
		_win(s, ev, pid, "groups")
		return true
	for side in Data.SIDES:
		var all := true
		for i in side:
			if int(s.own[i].o) != pid:
				all = false
				break
		if all:
			_win(s, ev, pid, "side")
			return true
	var res := true
	for i in Data.RESORTS:
		if int(s.own[i].o) != pid:
			res = false
	if res:
		_win(s, ev, pid, "resorts")
		return true
	return false


static func _proceed(s: Dictionary, ev: Array) -> void:
	if s.phase == "over":
		return
	var pid: int = int(s.cur)
	var p: Dictionary = s.players[pid]
	for k in s.players.size():
		var q: Dictionary = s.players[k]
		if k != pid and not q.out and int(q.money) < 0:
			_auto_liquidate(s, ev, k, pid)
	if s.phase == "over":
		return
	if int(p.money) < 0:
		if owned_by(s, pid).is_empty():
			_bankrupt(s, ev, pid)
			return
		s.phase = "debt"
		s.pending = null
		_log(s, ev, "%s đang nợ %s, cần bán tài sản." % [p.name, fmt(-int(p.money))])
		return
	if s.rolledDouble and not int(p.island) and not p.travel:
		s.phase = "roll"
		s.pending = null
		ev.append({"t": "again", "pid": pid})
		return
	_next_turn(s, ev)


static func _mono_check(s: Dictionary, ev: Array, pid: int, i: int) -> void:
	var t: Dictionary = Data.BOARD[i]
	if t.type != "city" or not owns_group(s, pid, t.group):
		return
	ev.append({"t": "mono", "pid": pid, "group": t.group, "tiles": Data.GROUP_TILES[t.group]})
	_log(s, ev, "👑 %s độc quyền vùng %s!" % [s.players[pid].name, Data.GROUPS[t.group].name])


static func _sell_tile(s: Dictionary, ev: Array, pid: int, i: int) -> void:
	var v := int(floor(tile_value(s, i) * Data.SELL_RATE))
	ev.append({"t": "sell", "pid": pid, "tile": i, "value": v})
	s.own[i] = {"o": -1, "lvl": 0}
	if int(s.festival) == i:
		s.festival = -1
	_money(s, ev, pid, v)
	ev.append({"t": "build", "tile": i})
	_log(s, ev, "%s bán %s được %s." % [s.players[pid].name, Data.BOARD[i].name, fmt(v)])


static func _auto_liquidate(s: Dictionary, ev: Array, pid: int, _creditor: int) -> void:
	var p: Dictionary = s.players[pid]
	var tiles := owned_by(s, pid)
	tiles.sort_custom(func(a, b): return tile_value(s, a) < tile_value(s, b))
	while int(p.money) < 0 and tiles.size():
		_sell_tile(s, ev, pid, tiles.pop_front())
	if int(p.money) < 0:
		_bankrupt(s, ev, pid)


static func _bankrupt(s: Dictionary, ev: Array, pid: int) -> void:
	var p: Dictionary = s.players[pid]
	for i in owned_by(s, pid):
		s.own[i] = {"o": -1, "lvl": 0}
		if int(s.festival) == i:
			s.festival = -1
		ev.append({"t": "build", "tile": i})
	p.out = true
	p.money = 0
	_log(s, ev, "💥 %s phá sản!" % p.name)
	ev.append({"t": "bankrupt", "pid": pid})
	if _check_win(s, ev, -1):
		return
	if int(s.cur) == pid:
		_next_turn(s, ev)


static func _land(s: Dictionary, ev: Array, pid: int, dice_sum: int) -> void:
	var p: Dictionary = s.players[pid]
	var i: int = int(p.pos)
	var t: Dictionary = Data.BOARD[i]
	var o = s.own[i]
	s.pending = null
	match t.type:
		"city", "resort":
			if int(o.o) < 0:
				s.phase = "buy"
				s.pending = {"tile": i}
				return
			if int(o.o) == pid:
				if t.type == "city" and int(o.lvl) < max_build_level(s, i):
					s.phase = "upgrade"
					s.pending = {"tile": i}
					return
				_proceed(s, ev)
				return
			var owner: Dictionary = s.players[int(o.o)]
			var rent := rent_of(s, i, dice_sum)
			_log(s, ev, "%s trả %s tiền thuê %s cho %s." % [p.name, fmt(rent), t.name, owner.name])
			ev.append({"t": "rent", "from": pid, "to": int(o.o), "tile": i, "amount": rent})
			_pay(s, ev, pid, int(o.o), rent)
			if int(p.money) >= 0 and not (t.type == "city" and int(o.lvl) >= 4) and int(p.money) >= buyout_cost(s, i):
				s.phase = "buyout"
				s.pending = {"tile": i, "cost": buyout_cost(s, i)}
				return
			_proceed(s, ev)
		"chance":
			_draw_card(s, ev, pid, dice_sum)
		"tax":
			var tax := maxi(Data.TAX_MIN, _jround(assets(s, pid) * Data.TAX_RATE / 5.0) * 5)
			_log(s, ev, "%s nộp thuế %s." % [p.name, fmt(tax)])
			ev.append({"t": "tax", "pid": pid, "tile": i, "amount": tax})
			_money(s, ev, pid, -tax)
			_proceed(s, ev)
		"island":
			_to_island(s, ev, pid)
			_proceed(s, ev)
		"airport":
			p.travel = true
			s.rolledDouble = false
			_log(s, ev, "%s tới Sân Bay — lượt sau được bay tới ô bất kỳ (vé %s) ✈️" % [p.name, fmt(Data.AIRPORT_FEE)])
			_proceed(s, ev)
		"festival":
			_start_festival(s, ev, pid)
		"start":
			_start_bonus(s, ev, pid)
			_proceed(s, ev)
		_:
			_proceed(s, ev)


static func _start_bonus(s: Dictionary, ev: Array, pid: int) -> void:
	var p: Dictionary = s.players[pid]
	var up := owned_by(s, pid).filter(func(k): return Data.BOARD[k].type == "city" and int(s.own[k].lvl) < max_build_level(s, k))
	var pool := [["cash", 25], ["card", 15], ["fly", 20]]
	if up.size():
		pool.append(["upgrade", 40])
	var total := 0
	for it in pool:
		total += it[1]
	var r := rnd(total)
	var kind: String = pool[0][0]
	for it in pool:
		if r < it[1]:
			kind = it[0]
			break
		r -= it[1]
	match kind:
		"upgrade":
			var k: int = up[rnd(up.size())]
			var o: Dictionary = s.own[k]
			o.lvl = int(o.lvl) + 1
			ev.append({"t": "bonus", "pid": pid, "kind": kind, "tile": k, "lvl": o.lvl})
			ev.append({"t": "build", "tile": k, "up": true})
			_log(s, ev, "🎁 Thưởng Xuất Phát: %s được nâng %s lên %s miễn phí!" % [p.name, Data.BOARD[k].name, "Khách sạn" if int(o.lvl) >= 4 else "nhà cấp %d" % int(o.lvl)])
		"cash":
			ev.append({"t": "bonus", "pid": pid, "kind": kind, "amount": START_BONUS_CASH})
			_money(s, ev, pid, START_BONUS_CASH)
			_log(s, ev, "🎁 Thưởng Xuất Phát: %s nhận thêm %s!" % [p.name, fmt(START_BONUS_CASH)])
		"card":
			p.freeCards = int(p.freeCards) + 1
			ev.append({"t": "bonus", "pid": pid, "kind": kind})
			_log(s, ev, "🎁 Thưởng Xuất Phát: %s nhận 1 thẻ cứu hộ (rời Đảo Hoang miễn phí)." % p.name)
		"fly":
			p.travel = true
			p.freeFly = true
			s.rolledDouble = false
			ev.append({"t": "bonus", "pid": pid, "kind": kind})
			_log(s, ev, "🎁 Thưởng Xuất Phát: %s được vé bay miễn phí, lượt sau bay tới ô bất kỳ ✈️" % p.name)


static func _start_festival(s: Dictionary, ev: Array, pid: int) -> void:
	if owned_by(s, pid).is_empty():
		_log(s, ev, "%s chưa có đất để tổ chức Lễ Hội." % s.players[pid].name)
		_proceed(s, ev)
		return
	s.phase = "festival"
	s.pending = {"tile": int(s.players[pid].pos)}


static func attack_targets(s: Dictionary, pid: int, kind: String) -> Array:
	var out := []
	for i in s.own.size():
		var o = s.own[i]
		if o == null or int(o.o) < 0 or int(o.o) == pid or s.players[int(o.o)].out:
			continue
		var city: bool = Data.BOARD[i].type == "city"
		if city and int(o.lvl) >= 4:
			continue
		if kind == "burn" and not (city and int(o.lvl) >= 1):
			continue
		out.append(i)
	return out


static func _draw_card(s: Dictionary, ev: Array, pid: int, dice_sum: int) -> void:
	var p: Dictionary = s.players[pid]
	if s.deck.is_empty():
		var d := []
		for k in Data.CARDS.size():
			d.append(k)
		s.deck = shuffle(d)
	var c: Dictionary = Data.CARDS[int(s.deck.pop_front())]
	var e := {"t": "card", "pid": pid, "text": c.text, "kind": c.kind, "amount": c.get("amount", 0)}
	if c.has("to"):
		e["to"] = c.to
	ev.append(e)
	_log(s, ev, "🧧 %s: %s" % [p.name, c.text])
	match c.kind:
		"money":
			_money(s, ev, pid, c.amount)
			_proceed(s, ev)
		"move":
			_go_to(s, ev, pid, c.to)
			_land(s, ev, pid, dice_sum)
		"moveBy":
			_walk(s, ev, pid, c.n)
			_land(s, ev, pid, dice_sum)
		"nearestResort":
			var k: int = int(p.pos)
			while true:
				k = (k + 1) % Data.SIZE
				if Data.BOARD[k].type == "resort":
					break
			_go_to(s, ev, pid, k)
			_land(s, ev, pid, dice_sum)
		"island":
			_to_island(s, ev, pid)
			_proceed(s, ev)
		"hostFest":
			_start_festival(s, ev, pid)
		"demolish", "burn":
			var tiles := attack_targets(s, pid, c.kind)
			if tiles.is_empty():
				_log(s, ev, "Không có nhà nào của đối thủ để %s." % ("đốt" if c.kind == "burn" else "phá"))
				_proceed(s, ev)
				return
			s.phase = "target"
			s.pending = {"kind": c.kind, "tiles": tiles}
		"freeCard":
			p.freeCards = int(p.freeCards) + 1
			_proceed(s, ev)
		"repairs":
			var cost := 0
			for k in owned_by(s, pid):
				var l: int = int(s.own[k].lvl)
				if Data.BOARD[k].type == "city":
					cost += 3 * c.house + c.landmark if l >= 4 else l * c.house
			if cost:
				_money(s, ev, pid, -cost)
			_log(s, ev, "%s trả %s tiền sửa nhà." % [p.name, fmt(cost)])
			_proceed(s, ev)
		"payEach":
			for k in alive(s):
				if k != pid:
					_pay(s, ev, pid, k, c.amount)
			_proceed(s, ev)
		"collectEach":
			for k in alive(s):
				if k != pid:
					_pay(s, ev, k, pid, c.amount)
			_proceed(s, ev)
		_:
			_proceed(s, ev)


static func _do_roll(s: Dictionary, ev: Array, pid: int) -> void:
	var p: Dictionary = s.players[pid]
	var d := [rnd(6) + 1, rnd(6) + 1]
	s.dice = d
	var dbl: bool = d[0] == d[1]
	ev.append({"t": "dice", "pid": pid, "d": d})
	if int(p.island) > 0:
		if dbl:
			p.island = 0
			s.rolledDouble = false
			_log(s, ev, "%s gieo đôi %d-%d, thoát khỏi Đảo Hoang!" % [p.name, d[0], d[1]])
		else:
			p.island = int(p.island) - 1
			_log(s, ev, "%s gieo %d-%d, vẫn kẹt trên đảo%s." % [p.name, d[0], d[1], " (còn %d lượt)" % int(p.island) if int(p.island) else ""])
			s.rolledDouble = false
			_next_turn(s, ev)
			return
	else:
		s.rolledDouble = dbl
		if dbl:
			s.doubles = int(s.doubles) + 1
			if int(s.doubles) >= 3:
				_log(s, ev, "%s gieo đôi 3 lần liền!" % p.name)
				_to_island(s, ev, pid)
				_next_turn(s, ev)
				return
	_walk(s, ev, pid, d[0] + d[1])
	_land(s, ev, pid, d[0] + d[1])


# ---------- hành động: trả về {ok, error, events} ----------
static func apply(s: Dictionary, pid: int, a) -> Dictionary:
	var ev := []
	if not (a is Dictionary) or not (a.get("type") is String):
		return _err("Hành động không hợp lệ")
	if s.phase == "over":
		return _err("Ván đã kết thúc")
	if pid != int(s.cur):
		return _err("Chưa tới lượt bạn")
	var p: Dictionary = s.players[pid]
	var pd = s.pending
	var tv = a.get("tile", -1)
	var tile: int = int(tv) if (tv is int or (tv is float and tv == floor(tv))) and int(tv) >= 0 and int(tv) < Data.SIZE else -1
	var alvl: int = int(a.get("lvl", 0)) if (a.get("lvl") is int or a.get("lvl") is float) else 0
	match a.type:
		"roll":
			if s.phase != "roll":
				return _err("Không thể gieo lúc này")
			_do_roll(s, ev, pid)
		"payBail":
			if s.phase != "roll" or not int(p.island):
				return _err("Bạn không ở trên đảo")
			if int(p.money) < Data.BAIL:
				return _err("Không đủ tiền")
			_money(s, ev, pid, -Data.BAIL)
			p.island = 0
			_log(s, ev, "%s trả %s thuê thuyền rời đảo." % [p.name, fmt(Data.BAIL)])
			_do_roll(s, ev, pid)
		"useCard":
			if s.phase != "roll" or not int(p.island) or not int(p.freeCards):
				return _err("Không dùng được thẻ")
			p.freeCards = int(p.freeCards) - 1
			p.island = 0
			_log(s, ev, "%s dùng thẻ cứu hộ rời đảo." % p.name)
			_do_roll(s, ev, pid)
		"travel":
			if s.phase != "travel":
				return _err("Không thể bay lúc này")
			if tile < 0 or not can_fly(s, pid, tile):
				return _err("Không bay tới ô này được")
			var fee := 0 if p.get("freeFly", false) else Data.AIRPORT_FEE
			if int(p.money) < fee:
				return _err("Cần %s để mua vé" % fmt(fee))
			p.travel = false
			p.freeFly = false
			if fee:
				ev.append({"t": "fee", "pid": pid, "amount": fee})
				_money(s, ev, pid, -fee)
			_log(s, ev, "✈️ %s bay tới %s." % [p.name, Data.BOARD[tile].name])
			_go_to(s, ev, pid, tile)
			s.rolledDouble = false
			_land(s, ev, pid, 7)
		"buy":
			if s.phase != "buy" or pd == null:
				return _err("Không thể mua lúc này")
			var i: int = int(pd.tile)
			var t: Dictionary = Data.BOARD[i]
			var lvl := clampi(alvl, 0, 3) if t.type == "city" else 0
			var cost: int = t.price + build_cost(i, 0, lvl)
			if int(p.money) < cost:
				return _err("Không đủ tiền")
			ev.append({"t": "buy", "pid": pid, "tile": i, "cost": cost})
			_money(s, ev, pid, -cost)
			s.own[i] = {"o": pid, "lvl": lvl}
			ev.append({"t": "build", "tile": i, "up": true})
			_log(s, ev, "%s mua %s%s (%s)." % [p.name, t.name, " và xây nhà cấp %d" % lvl if lvl else "", fmt(cost)])
			_mono_check(s, ev, pid, i)
			if not _check_win(s, ev, pid):
				_proceed(s, ev)
		"upgrade":
			if s.phase != "upgrade" or pd == null:
				return _err("Không thể xây lúc này")
			var i: int = int(pd.tile)
			var o: Dictionary = s.own[i]
			var lvl := mini(max_build_level(s, i), alvl)
			if lvl <= int(o.lvl):
				return _err("Cấp xây không hợp lệ")
			var cost := build_cost(i, int(o.lvl), lvl)
			if int(p.money) < cost:
				return _err("Không đủ tiền")
			ev.append({"t": "upgrade", "pid": pid, "tile": i, "cost": cost, "lvl": lvl})
			_money(s, ev, pid, -cost)
			o.lvl = lvl
			ev.append({"t": "build", "tile": i, "up": true})
			_log(s, ev, "%s %s %s (%s)." % [p.name, "xây Khách sạn 🏨 ở" if lvl == 4 else "nâng lên nhà cấp %d ở" % lvl, Data.BOARD[i].name, fmt(cost)])
			_proceed(s, ev)
		"buyout":
			if s.phase != "buyout" or pd == null:
				return _err("Không thể mua lại lúc này")
			var i: int = int(pd.tile)
			var o: Dictionary = s.own[i]
			var cost := buyout_cost(s, i)
			if int(p.money) < cost:
				return _err("Không đủ tiền")
			var prev: int = int(o.o)
			ev.append({"t": "buyout", "pid": pid, "from": prev, "tile": i, "cost": cost})
			_pay(s, ev, pid, prev, cost)
			o.o = pid
			ev.append({"t": "build", "tile": i, "up": true})
			_log(s, ev, "🤝 %s mua lại %s từ %s với giá %s." % [p.name, Data.BOARD[i].name, s.players[prev].name, fmt(cost)])
			_mono_check(s, ev, pid, i)
			if not _check_win(s, ev, pid):
				if Data.BOARD[i].type == "city" and int(o.lvl) < max_build_level(s, i):
					s.phase = "upgrade"
					s.pending = {"tile": i}
				else:
					_proceed(s, ev)
		"festival":
			if s.phase != "festival":
				return _err("Không thể tổ chức lúc này")
			if tile < 0 or s.own[tile] == null or int(s.own[tile].o) != pid:
				return _err("Chọn đất của bạn")
			s.festMult = mini(Data.FEST_MAX, int(s.get("festMult", 2)) + 1) if int(s.festival) == tile else 2
			s.festival = tile
			ev.append({"t": "fest", "pid": pid, "tile": tile, "mult": s.festMult})
			ev.append({"t": "build", "tile": tile})
			_log(s, ev, "🎆 %s tổ chức Lễ Hội ở %s: tiền thuê ×%d!" % [p.name, Data.BOARD[tile].name, int(s.festMult)])
			_proceed(s, ev)
		"skip":
			if s.phase == "travel":
				p.travel = false
				p.freeFly = false
				s.phase = "roll"
				_log(s, ev, "%s không bay, gieo xúc xắc." % p.name)
			elif s.phase in ["buy", "upgrade", "buyout", "festival", "target"]:
				_proceed(s, ev)
			else:
				return _err("Không thể bỏ qua")
		"target":
			if s.phase != "target" or pd == null or not (tile in pd.tiles):
				return _err("Chọn một nhà được đánh dấu")
			var o: Dictionary = s.own[tile]
			var from: int = int(o.o)
			var name: String = Data.BOARD[tile].name
			if pd.kind == "burn":
				o.lvl = int(o.lvl) - 1
				ev.append({"t": "burn", "pid": pid, "tile": tile, "from": from, "lvl": o.lvl})
				_log(s, ev, "🔥 %s đốt nhà của %s ở %s: còn %s." % [p.name, s.players[from].name, name, "nhà cấp %d" % int(o.lvl) if int(o.lvl) else "đất trống"])
			else:
				s.own[tile] = {"o": -1, "lvl": 0}
				if int(s.festival) == tile:
					s.festival = -1
				ev.append({"t": "demolish", "pid": pid, "tile": tile, "from": from})
				_log(s, ev, "💥 %s phá nhà của %s ở %s!" % [p.name, s.players[from].name, name])
			ev.append({"t": "build", "tile": tile})
			_proceed(s, ev)
		"sellMany":
			if s.phase != "debt":
				return _err("Chỉ bán khi đang nợ")
			var list := []
			if a.get("tiles") is Array:
				for k in a.tiles:
					var ki := int(k)
					if not (ki in list) and ki >= 0 and ki < Data.SIZE and s.own[ki] != null and int(s.own[ki].o) == pid:
						list.append(ki)
			if list.is_empty():
				return _err("Chưa chọn ô nào để bán")
			for k in list:
				_sell_tile(s, ev, pid, k)
			_proceed(s, ev)
		"sell":
			if s.phase != "debt":
				return _err("Chỉ bán khi đang nợ")
			if tile < 0 or s.own[tile] == null or int(s.own[tile].o) != pid:
				return _err("Không phải đất của bạn")
			_sell_tile(s, ev, pid, tile)
			if int(p.money) >= 0:
				_proceed(s, ev)
		"bankrupt":
			if s.phase != "debt":
				return _err("Không thể phá sản lúc này")
			_bankrupt(s, ev, pid)
		_:
			return _err("Hành động lạ")
	s.seq = int(s.seq) + 1
	return {"ok": true, "events": ev}


static func _err(m: String) -> Dictionary:
	return {"ok": false, "error": m, "events": []}


static func anim_time(events: Array) -> int:
	var t := 0
	for e in events:
		match e.t:
			"dice":
				t += ANIM.dice
			"move":
				t += e.path.size() * ANIM.step + 80 + ANIM.target
			"fly":
				t += ANIM.fly + ANIM.target
			"rent", "buy", "buyout", "tax", "upgrade", "fest", "mono", "fee", "demolish", "burn", "bonus", "rfest", "sell":
				t += ANIM[e.t]
			"build":
				if e.get("up", false):
					t += ANIM.build
			"card":
				t += ANIM.card
			"turn":
				t += ANIM.turn
	return t


## Bản trạng thái gửi cho người khác (giấu thứ tự bộ bài)
static func public_state(s: Dictionary) -> Dictionary:
	var c := s.duplicate(true)
	c.erase("deck")
	return c


## JSON của Godot đọc mọi số thành float: đổi số nguyên về int (để dùng làm chỉ số mảng)
static func normalize(v):
	if v is float and v == floor(v) and absf(v) < 1e15:
		return int(v)
	if v is Array:
		var out := []
		for x in v:
			out.append(normalize(x))
		return out
	if v is Dictionary:
		var d := {}
		for k in v:
			d[k] = normalize(v[k])
		return d
	return v
