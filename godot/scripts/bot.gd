class_name Bot
## Máy chơi — chép từ js/bot.js.


static func _group_bonus(s: Dictionary, pid: int, i: int) -> float:
	var t: Dictionary = Data.BOARD[i]
	if t.type == "resort":
		var n := 0
		for k in Data.RESORTS:
			if int(s.own[k].o) == pid:
				n += 1
		return n * 0.5 + 0.5
	var tiles: Array = Data.GROUP_TILES[t.group]
	var mine := 0
	for k in tiles:
		if k != i and int(s.own[k].o) == pid:
			mine += 1
	return 3.0 if mine == tiles.size() - 1 else (1.2 if mine else 0.6)


static func _reserve(s: Dictionary) -> float:
	var max_rent := 0
	for i in s.own.size():
		var o = s.own[i]
		if o != null and int(o.o) >= 0:
			max_rent = maxi(max_rent, Rules.rent_of(s, i))
	return minf(600, 120 + max_rent * 0.6)


static func action(s: Dictionary, pid: int):
	if int(s.cur) != pid:
		return null
	var p: Dictionary = s.players[pid]
	var pd = s.pending
	var res := _reserve(s)
	var money: int = int(p.money)
	match s.phase:
		"roll":
			if int(p.island):
				if int(p.freeCards):
					return {"type": "useCard"}
				if money > Data.BAIL + res + 200:
					return {"type": "payBail"}
			return {"type": "roll"}
		"travel":
			if not p.get("freeFly", false) and money < Data.AIRPORT_FEE + res * 0.5:
				return {"type": "skip"}
			var best := 0
			var best_score := -1.0
			for i in Data.BOARD.size():
				if not Rules.can_fly(s, pid, i):
					continue
				var t: Dictionary = Data.BOARD[i]
				var o = s.own[i]
				var sc := 0.0
				if o != null and int(o.o) < 0 and money - t.price > res:
					sc = _group_bonus(s, pid, i) * 10 + t.price / 50.0
				elif o != null and int(o.o) == pid and t.type == "city" and int(o.lvl) < 4:
					sc = 5 + int(o.lvl)
				elif i == Data.FESTIVAL and Rules.owned_by(s, pid).size():
					sc = 4
				elif i == 0:
					sc = 3
				elif o != null and int(o.o) >= 0 and int(o.o) != pid:
					sc = -Rules.rent_of(s, i)
				if sc > best_score:
					best_score = sc
					best = i
			return {"type": "travel", "tile": best}
		"buy":
			var i: int = int(pd.tile)
			var t: Dictionary = Data.BOARD[i]
			var bonus := _group_bonus(s, pid, i)
			if t.type == "resort":
				return {"type": "buy"} if money - t.price >= res * 0.6 or (bonus >= 1.5 and money >= t.price) else {"type": "skip"}
			for l in range(3, -1, -1):
				var cost: int = t.price + Rules.build_cost(i, 0, l)
				if money - cost >= res:
					return {"type": "buy", "lvl": l}
			if bonus >= 3 and money >= t.price:
				return {"type": "buy", "lvl": 0}
			return {"type": "skip"}
		"upgrade":
			var i: int = int(pd.tile)
			var o: Dictionary = s.own[i]
			for l in range(Rules.max_build_level(s, i), int(o.lvl), -1):
				if money - Rules.build_cost(i, int(o.lvl), l) >= res:
					return {"type": "upgrade", "lvl": l}
			return {"type": "skip"}
		"buyout":
			var i: int = int(pd.tile)
			var cost := Rules.buyout_cost(s, i)
			var bonus := _group_bonus(s, pid, i)
			var ok := (bonus >= 3 and money - cost >= res * 0.5) or money - cost >= res * 2.5
			return {"type": "buyout"} if ok else {"type": "skip"}
		"festival":
			var mine := Rules.owned_by(s, pid)
			if mine.is_empty():
				return {"type": "skip"}
			mine.sort_custom(func(a, b): return Rules.rent_of(s, a) > Rules.rent_of(s, b))
			return {"type": "festival", "tile": mine[0]}
		"target":
			var tl: Array = pd.tiles.duplicate()
			if tl.is_empty():
				return {"type": "skip"}
			tl.sort_custom(func(a, b): return Rules.tile_value(s, a) > Rules.tile_value(s, b))
			return {"type": "target", "tile": tl[0]}
		"debt":
			var mine := Rules.owned_by(s, pid)
			if mine.is_empty():
				return {"type": "bankrupt"}
			var score := func(i): return Rules.tile_value(s, i) * (3 if Data.BOARD[i].type == "city" and Rules.owns_group(s, pid, Data.BOARD[i].group) else 1)
			mine.sort_custom(func(a, b): return score.call(a) < score.call(b))
			return {"type": "sell", "tile": mine[0]}
	return null
