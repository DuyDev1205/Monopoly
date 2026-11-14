extends Node
## Chạy thử N ván toàn máy chơi: kiểm tra không kẹt, không lỗi, ván nào cũng kết thúc.
## godot --headless --path godot --script res://tools/sim.gd -- 500

func _ready() -> void:
	var n := 500
	var args := OS.get_cmdline_user_args()
	if args.size():
		n = int(args[0])
	var stuck := 0
	var errors := 0
	var reasons := {}
	var turns_total := 0
	var events_kinds := {}
	for g in n:
		var players := []
		var np := 2 + g % 3
		for i in np:
			players.append({"name": "Máy %d" % (i + 1), "bot": true})
		var s := Rules.new_game(players, [15, 30, 45, 60][g % 4])
		var steps := 0
		while s.phase != "over" and steps < 6000:
			steps += 1
			Rules.tick(s, 3000)
			var pid: int = s.cur
			var a = Bot.action(s, pid)
			if a == null:
				errors += 1
				printerr("bot không có nước đi: phase=", s.phase)
				break
			var r := Rules.apply(s, pid, a)
			if not r.ok:
				errors += 1
				printerr("lỗi: ", r.error, " phase=", s.phase, " a=", a)
				break
			for e in r.events:
				events_kinds[e.t] = events_kinds.get(e.t, 0) + 1
			# bất biến: tiền người còn chơi không âm khi ở pha khác debt
			for k in s.players.size():
				var p: Dictionary = s.players[k]
				if not p.out and p.money < 0 and s.phase != "debt" and s.phase != "over" and k == s.cur:
					errors += 1
					printerr("tiền âm ngoài pha nợ: ", p.money, " phase=", s.phase)
		if s.phase != "over":
			stuck += 1
		else:
			reasons[s.winReason] = reasons.get(s.winReason, 0) + 1
		turns_total += steps
	print("ván=", n, " kẹt=", stuck, " lỗi=", errors, " trung bình bước=", turns_total / n)
	print("thắng theo: ", reasons)
	print("sự kiện: ", events_kinds)
	print(JSON.stringify(Rules.public_state(Rules.new_game([{"name": "A"}, {"name": "B", "bot": true}]))).substr(0, 300))
	get_tree().quit()
