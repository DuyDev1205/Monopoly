class_name Pieces2D
extends Node2D
## Vật thể trong ván (2D): quân cờ (tượng nhân vật trên đế màu), nhà theo cấp (vẽ isometric, mái màu chủ đất),
## khu du lịch, cổng FESTIVAL, xúc xắc isometric 12 bộ, vòng đánh dấu ô đích, đống tiền, hiệu ứng.
## API giống Pieces (bản 3D) để game.gd dùng chung.

const TH := 0.16
const SLOTS := [[0.0], [-0.2, 0.2], [-0.27, 0.0, 0.27], [-0.33, -0.11, 0.11, 0.33]]
const DICE_KEYS := Pieces.DICE_KEYS
const DICE_SKINS := Pieces.DICE_SKINS
const PIPS := {1: [[0.5, 0.5]], 2: [[0.27, 0.27], [0.73, 0.73]], 3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
	4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]], 5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
	6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]]}

## bảng khung hình nhân vật (assets/chars2d/c<k>.png, chụp bằng tools/render_chars.tscn): [khung đầu, số khung, khung/giây, lặp]
const FRAME := 240
const FCOLS := 10
const FOOT := Vector2(120, 183.6)          # điểm bàn chân trong mỗi khung
const TOKEN_SC := 0.92
const ANIMS := {
	"idle": [0, 12, 9.0, true], "walk": [12, 10, 15.0, true], "jump": [22, 10, 0.0, false], "cheer": [32, 14, 10.0, false],
	"hit": [46, 8, 12.0, false], "die": [54, 12, 14.0, false], "walk_u": [66, 10, 15.0, true], "jump_u": [76, 10, 0.0, false],
}

## bảng hình công trình (assets/build2d/houses.png, chụp bằng tools/render_builds.tscn): ô thứ (mô hình × 4 + màu người chơi)
const BFW := 300
const BFH := 375
const BCOLS := 8
const BANCHOR := Vector2(150, 275.8)       # điểm đặt (tâm chân công trình) trong mỗi ô hình
const BSCALE := 0.628                      # px ảnh -> px bàn cờ
const BUP := 73.9                          # px bàn cờ cho 1 đơn vị chiều cao của mô hình
## chiều cao từng mô hình: 0 khu du lịch, 1–4 nhà cấp 1, 5–8 cấp 2, 9–10 cấp 3, 11–12 cấp 4 (khách sạn)
const BHEIGHT := [0.62, 0.45, 0.48, 0.50, 0.42, 0.54, 0.74, 0.74, 0.58, 0.62, 1.00, 1.50, 1.05]

## hoà màu vật thể vào cảnh nền từng theme: [màu nắng, màu bóng, độ nâng vùng tối, độ tươi, màu viền quân cờ]
const GRADE := {
	"sakura": ["#fff6f8", "#b89be4", 0.30, 1.0, "#6a4a8a"],
	"wood": ["#fff0dc", "#d49a6a", 0.24, 1.0, "#5a3a2a"],
	"ocean": ["#f6fdff", "#7fc6ea", 0.20, 1.04, "#1e4a70"],
	"midnight": ["#b9bcf5", "#4a3fb0", 0.34, 0.92, "#0c0e2c"],
}

var tokens: Array = []
var buildings: Array = []        # mỗi ô: {key, info, t0, anim, shake, burn} | null
var gates := {}
var my_skin := "classic"
var cur_pid := 0
var last_dice := [5, 6]
var dice_faces := [[5, 3, 1], [6, 2, 4]]     # [mặt trên, mặt trái, mặt phải]
var dice_off := [Vector2.ZERO, Vector2.ZERO]
var dice_rot := [0.0, 0.0]
var dice_hidden := false
var target := -1
var target_label := ""
var pile: Array = []
var pile_t := 0.0
var fx: Array = []               # hạt hiệu ứng tự vẽ
var punch := 0.0
var t := 0.0
var ready_at := 0
var font: Font = preload("res://assets/fonts/Montserrat-ExtraBold.ttf")
var blob: Texture2D
var coin_tex: Texture2D
var theme := "sakura"
var grade_mat: ShaderMaterial
var house_tex: Texture2D = preload("res://assets/build2d/houses.png")
var token_shader: Shader = preload("res://scripts2d/token.gdshader")


func _ready() -> void:
	buildings.resize(32)
	blob = Painter.soft_blob(64, 0.1)
	coin_tex = load("res://assets/icons/money.webp")
	grade_mat = ShaderMaterial.new()
	grade_mat.shader = load("res://scripts2d/grade.gdshader")
	material = grade_mat
	set_theme(theme)
	z_index = 1


static func scr(w: Vector3) -> Vector2:
	return Iso.v(w)


func _apply_grade(m: ShaderMaterial) -> void:
	var G: Array = GRADE.get(theme, GRADE.sakura)
	m.set_shader_parameter("light", Color(G[0]))
	m.set_shader_parameter("shade", Color(G[1]))
	m.set_shader_parameter("lift", G[2])
	m.set_shader_parameter("sat", G[3])


func set_theme(name: String) -> void:
	theme = name
	if grade_mat == null:
		return
	_apply_grade(grade_mat)
	for tk in tokens:
		_apply_grade(tk.sp.material)
		tk.sp.material.set_shader_parameter("outline", Color(Color(GRADE.get(theme, GRADE.sakura)[4]), 0.7))


# ======================= quân cờ =======================
func set_tokens(players: Array) -> void:
	for tk in tokens:
		tk.node.queue_free()
	tokens.clear()
	ready_at = Time.get_ticks_msec()
	for p in players:
		var n := Node2D.new()
		var sp := Sprite2D.new()
		sp.texture = load("res://assets/chars2d/c%d.png" % posmod(int(p.get("char", 0)), 12))
		sp.centered = false
		sp.offset = -FOOT
		sp.region_enabled = true
		sp.region_rect = Rect2(0, 0, FRAME, FRAME)
		sp.scale = Vector2.ONE * TOKEN_SC
		sp.position = Vector2(0, -9)
		sp.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		var m := ShaderMaterial.new()
		m.shader = token_shader
		_apply_grade(m)
		m.set_shader_parameter("outline", Color(Color(GRADE.get(theme, GRADE.sakura)[4]), 0.7))
		sp.material = m
		n.add_child(sp)
		add_child(n)
		tokens.append({"node": n, "sp": sp, "color": Color(p.color), "mine": p.get("mine", false), "pos": Vector2.ZERO,
			"from": null, "to": null, "t0": 0, "dur": 0.0, "arc": 0.0, "cur": false, "emote": "", "et": 0.0, "out": false,
			"anim": "idle", "at": randf() * 1.3, "up": false, "fly": false, "lift": 0.0, "land": 9.0})


func slot_pos(tile: int, k: int, n: int) -> Vector2:
	var arr: Array = SLOTS[mini(n, 4) - 1]
	var a: float = arr[k] if k < arr.size() else 0.0
	return scr(Board.tp(tile, a, 0.55 if tile % 8 == 0 else 0.55, TH))


func place_token(pid: int, place: Dictionary, opt := {}) -> void:
	if pid >= tokens.size():
		return
	var tk: Dictionary = tokens[pid]
	tk.out = place.get("out", false)
	tk.node.visible = not tk.out
	var target_p := slot_pos(place.tile, place.get("k", 0), place.get("n", 1))
	var dur: float = opt.get("dur", 0.0)
	if dur <= 0 or tk.to == null:
		tk.pos = target_p
		tk.to = target_p
		tk.from = null
		return
	tk.from = tk.pos
	tk.to = target_p
	tk.t0 = Time.get_ticks_msec()
	tk.dur = dur
	tk.arc = opt.get("arc", 0.35) * 70.0
	tk.fly = opt.get("arc", 0.35) > 1.0
	# hình gốc quay mặt xuống-trái (hoặc quay lưng lên-trái): đi sang phải thì lật ngang
	var dv := target_p - (tk.pos as Vector2)
	if absf(dv.x) > 2:
		tk.sp.flip_h = dv.x > 0
	tk.up = dv.y < -2
	tk.anim = ("jump" if tk.fly else "walk") + ("_u" if tk.up else "")


func set_current(pid: int) -> void:
	cur_pid = pid
	for i in tokens.size():
		tokens[i].cur = i == pid


func emote(pid: int, e: String) -> void:
	if pid >= tokens.size():
		return
	var tk: Dictionary = tokens[pid]
	tk.emote = e
	tk.et = 0.0
	if tk.from == null:
		tk.anim = {"victory": "cheer", "shock": "hit", "out": "die"}.get(e, "idle")
		tk.at = 0.0


# ======================= nhà / công trình =======================
func building_key(i: int) -> String:
	var b = buildings[i]
	return b.key if b else ""


func set_building(i: int, info) -> Dictionary:
	var key := "" if info == null else "%d|%d|%d" % [info.owner, info.lvl, info.get("festMult", 0)]
	var prev := building_key(i)
	if prev == key:
		return {"prev": prev}
	var pk := prev.split("|")
	if info == null:
		buildings[i] = null
		return {"prev": prev}
	var same := pk.size() > 1 and pk[0] == str(info.owner) and pk[1] == str(info.lvl)
	var up := pk.size() > 1 and pk[0] == str(info.owner) and int(pk[1]) < int(info.lvl)
	buildings[i] = {"key": key, "info": info, "t0": Time.get_ticks_msec() if not same else 0, "anim": "up" if up else "grow", "shake": 0, "burn": false}
	if not same and Time.get_ticks_msec() - ready_at > 1500:
		var lv: int = 1 if info.type == "resort" else int(info.lvl)
		get_tree().create_timer(0.35).timeout.connect(func(): build_fx(Board.tp(i, 0, 0.3, TH), lv))
	return {"prev": prev, "upgraded": up}


func fx_shake(i: int, ms := 500) -> void:
	if buildings[i]:
		buildings[i].shake = Time.get_ticks_msec() + ms


func fx_burn(i: int, on: bool) -> void:
	if buildings[i]:
		buildings[i].burn = on


func collapse(i: int) -> void:
	var b = buildings[i]
	if b == null:
		return
	b.anim = "crumble"
	b.t0 = Time.get_ticks_msec()
	var p := scr(Board.tp(i, 0, 0.3, TH))
	for k in 16:
		fx.append({"kind": "chip", "p": p + Vector2(randf_range(-20, 20), randf_range(-40, -10)), "v": Vector2(randf_range(-160, 160), randf_range(-320, -160)),
			"life": 1.3, "age": 0.0, "col": Color(["#c9a77a", "#8a7a70", "#e9d9b8", "#b05a3a"][k % 4]), "s": randf_range(4, 8), "ground": p.y})
	puffs(Board.tp(i, 0, 0.3, TH), 8)


# ======================= cổng FESTIVAL =======================
func set_fest_gates(list: Array, fresh := false) -> void:
	for i in gates.keys():
		if not (i in list):
			gates.erase(i)
	for i in list:
		if not gates.has(i):
			gates[i] = Time.get_ticks_msec() if fresh else 0


# ======================= xúc xắc =======================
func skin_of(pid: int) -> String:
	if pid < 0 or pid >= tokens.size() or tokens[pid].mine:
		return my_skin
	var others := DICE_KEYS.filter(func(k): return k != my_skin)
	return others[(pid * 3 + 1) % others.size()]


func set_dice_skin(k: String) -> void:
	if k in DICE_KEYS:
		my_skin = k


## mặt trái / phải nhìn thấy khi mặt trên là n (khớp quy ước tổng 2 mặt đối = 7)
static func _sides(n: int, r: int) -> Array:
	var ring := {1: [2, 3, 5, 4], 6: [2, 4, 5, 3], 2: [1, 4, 6, 3], 5: [1, 3, 6, 4], 3: [1, 2, 6, 5], 4: [1, 5, 6, 2]}
	var rg: Array = ring[n]
	return [rg[r % 4], rg[(r + 1) % 4]]


func show_dice(d: Array) -> void:
	last_dice = d
	for k in 2:
		var sd := _sides(int(d[k]), k)
		dice_faces[k] = [int(d[k]), sd[0], sd[1]]
		dice_off[k] = Vector2.ZERO
		dice_rot[k] = 0.0


func roll_dice(d: Array, dur := 1.0) -> void:
	var el := 0.0
	var starts := [Vector2(randf_range(-60, 60), randf_range(90, 150)), Vector2(randf_range(-60, 60), randf_range(90, 150))]
	var flick := 0.0
	while el < dur:
		await get_tree().process_frame
		var dt := get_process_delta_time()
		el += dt
		flick += dt
		var k := minf(1.0, el / dur)
		var e := 1 - pow(1 - k, 3)
		for j in 2:
			var b := 0.0
			if k < 0.55:
				b = sin(k / 0.55 * PI) * 90
			elif k < 0.82:
				b = sin((k - 0.55) / 0.27 * PI) * 22
			else:
				b = sin((k - 0.82) / 0.18 * PI) * 5
			dice_off[j] = (starts[j] as Vector2).lerp(Vector2.ZERO, e) + Vector2(0, -b)
			dice_rot[j] = (1 - e) * 6.0 * (1 if j == 0 else -1)
		if flick > 0.07 and k < 0.85:
			flick = 0
			for j in 2:
				var n := randi_range(1, 6)
				var sd := _sides(n, randi() % 4)
				dice_faces[j] = [n, sd[0], sd[1]]
	show_dice(d)
	sparkle(Vector3(0, 0.5, 0), Color("#fff2b0"), 14)


func hide_dice(on: bool) -> void:
	dice_hidden = on


func _draw_die(c: Vector2, faces: Array, S: Dictionary, rot: float) -> void:
	var s := 30.0
	var bg0 := Color(S.bg[0])
	var bg1 := Color(S.bg[1])
	# 3 mặt của khối lập phương isometric
	var top := [Vector2(0, -s), Vector2(s * 1.0, -s * 0.5), Vector2(0, 0), Vector2(-s * 1.0, -s * 0.5)]
	var lf := [Vector2(-s, -s * 0.5), Vector2(0, 0), Vector2(0, s * 1.1), Vector2(-s, s * 0.6)]
	var rt := [Vector2(0, 0), Vector2(s, -s * 0.5), Vector2(s, s * 0.6), Vector2(0, s * 1.1)]
	var xf := Transform2D(rot * 0.12, c)
	var faces_def := [[top, bg0.lightened(0.05), faces[0]], [lf, bg1.lerp(bg0, 0.5), faces[1]], [rt, bg1.darkened(0.08), faces[2]]]
	for f in faces_def:
		var q: Array = f[0]
		var poly := PackedVector2Array()
		for v in q:
			poly.append(xf * v)
		draw_colored_polygon(poly, f[1])
		draw_polyline(PackedVector2Array([poly[0], poly[1], poly[2], poly[3], poly[0]]), Color(f[1]).darkened(0.18), 1.5, true)
		var n: int = f[2]
		var red: bool = n == 1 or n == 4
		var pc := Color(S.red[1]) if red else Color(S.pip[1])
		for pp in PIPS[n]:
			var u: float = pp[0]
			var v: float = pp[1]
			var pt := poly[0].lerp(poly[1], u).lerp(poly[3].lerp(poly[2], u), v)
			var r := 4.2 if n != 1 else 6.0
			draw_set_transform(pt, (poly[1] - poly[0]).angle(), Vector2(1, (poly[3] - poly[0]).length() / (poly[1] - poly[0]).length()))
			draw_circle(Vector2.ZERO, r, pc)
			draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)


# ======================= đánh dấu ô đích =======================
func set_target(i: int, label := "") -> void:
	target = i
	target_label = label


# ======================= đống tiền =======================
func show_pile(amount: int) -> float:
	pile.clear()
	pile_t = 0.0
	var n := clampi(2 + amount / 80, 2, 9)
	for k in n:
		var a := TAU * k / n + randf() * 0.4
		var r := 0.0 if k == 0 else randf_range(18, 46)
		pile.append({"p": Vector2(cos(a) * r, sin(a) * r * 0.55), "d": k * 0.07, "s": randf_range(46, 62)})
	hide_dice(true)
	return 0.6


func clear_pile() -> void:
	pile.clear()
	hide_dice(false)


# ======================= hiệu ứng =======================
func sparkle(pos: Vector3, color := Color("#fff2b0"), n := 14, up := 2.2) -> void:
	var p := scr(pos)
	for k in n:
		fx.append({"kind": "spark", "p": p + Vector2(randf_range(-10, 10), 0), "v": Vector2(randf_range(-70, 70), randf_range(-160, -60) * up / 2.2),
			"g": 160.0, "life": randf_range(0.7, 1.2), "age": 0.0, "col": color, "s": randf_range(10, 18)})


func puffs(pos: Vector3, n: int) -> void:
	var p := scr(pos)
	for k in n:
		fx.append({"kind": "puff", "p": p + Vector2(randf_range(-25, 25), randf_range(-5, 5)), "v": Vector2(randf_range(-30, 30), randf_range(-40, -15)),
			"g": 0.0, "life": 1.1, "age": 0.0, "col": Color(0.97, 0.93, 0.95), "s": randf_range(18, 28)})


func beam(pos: Vector3, color := Color("#ffd76a"), h := 3.2, life := 1.6) -> void:
	fx.append({"kind": "beam", "p": scr(pos), "life": life, "age": 0.0, "col": color, "h": h * Iso.HS})


func firework(pos: Vector3, delay := 0.0, color = null) -> void:
	var col := Color(color) if color != null else Color(Pieces.FW_COLORS[randi() % Pieces.FW_COLORS.size()])
	fx.append({"kind": "rocket", "p": scr(pos), "top": scr(pos) + Vector2(randf_range(-30, 30), -randf_range(150, 220)), "life": 0.55, "age": -delay, "col": col})


func fireworks(i: int) -> void:
	for k in 3:
		firework(Board.tp(i, randf_range(-0.3, 0.3), 0.5, TH), k * 0.26)
	punch = maxf(punch, 0.06)


func celebrate(list: Array) -> void:
	for k in list.size():
		var p := Board.tp(list[k], 0, 0.4, TH)
		get_tree().create_timer(k * 0.22).timeout.connect(func():
			beam(p, Color("#ffd76a"), 3, 1.4)
			sparkle(p, Color("#ffe27a"), 16))
		firework(p, 0.3 + k * 0.26, ["#ffd60a", "#ff4d6d", "#06d6a0"][k % 3])
	punch = maxf(punch, 0.1)


func build_fx(pos: Vector3, lvl: int) -> void:
	puffs(pos, 6)
	sparkle(pos + Vector3(0, 0.3, 0), Color("#fff2b0"), 26 if lvl >= 4 else 12)
	if lvl >= 4:
		beam(pos, Color("#ffd76a"), 3.6, 1.7)
		firework(pos, 0.45, "#ffd60a")
		punch = maxf(punch, 0.08)


func _process(dt: float) -> void:
	t += dt
	punch = maxf(0, punch - dt * 0.3)
	pile_t += dt
	var now := Time.get_ticks_msec()
	for tk in tokens:
		var frame := 0
		tk.land += dt
		if tk.from != null:
			var k := minf(1.0, (now - tk.t0) / tk.dur)
			var e := 2 * k * k if k < 0.5 else 1 - pow(-2 * k + 2, 2) / 2
			tk.pos = (tk.from as Vector2).lerp(tk.to, e)
			tk.lift = sin(k * PI) * tk.arc
			tk.at += dt
			var A: Array = ANIMS[tk.anim] if ANIMS.has(tk.anim) else ANIMS.walk
			if tk.fly:
				# nhảy xa: khung hình đi theo tiến độ (nhún → bật → rơi → tiếp đất)
				frame = A[0] + clampi(int((0.12 + k * 0.76) * A[1]), 0, A[1] - 1)
			else:
				frame = A[0] + int(tk.at * A[2]) % int(A[1])
			if k >= 1:
				tk.from = null
				tk.lift = 0.0
				tk.land = 0.0
				if tk.fly:
					for q in 6:
						var a := randf() * TAU
						fx.append({"kind": "puff", "p": (tk.pos as Vector2) + Vector2(cos(a) * 14, sin(a) * 6), "v": Vector2(cos(a) * 46, sin(a) * 18 - 8),
							"life": 0.45, "age": 0.0, "col": Color(1, 1, 1, 0.85), "s": randf_range(14, 22)})
				tk.anim = {"victory": "cheer", "shock": "hit", "out": "die"}.get(tk.emote, "idle") if tk.et < 0.3 else "idle"
				tk.at = 0.0
		else:
			tk.lift = absf(sin(t * 3.2)) * 3.0 if tk.cur and tk.anim == "idle" else 0.0
			tk.at += dt
			var A: Array = ANIMS[tk.anim] if ANIMS.has(tk.anim) else ANIMS.idle
			var fi := int(tk.at * A[2])
			if A[3]:
				frame = A[0] + fi % int(A[1])
			elif fi >= A[1]:
				if tk.anim == "die":
					frame = A[0] + A[1] - 1                 # nằm luôn
				else:
					tk.anim = "idle"
					tk.at = 0.0
					frame = 0
			else:
				frame = A[0] + fi
		tk.et += dt
		# nhún khi vừa tiếp đất
		var sq := maxf(0.0, 1.0 - tk.land / 0.2)
		tk.sp.scale = Vector2(TOKEN_SC * (1 + 0.12 * sq), TOKEN_SC * (1 - 0.16 * sq))
		tk.sp.position.y = -9 - tk.lift
		tk.sp.region_rect = Rect2((frame % FCOLS) * FRAME, (frame / FCOLS) * FRAME, FRAME, FRAME)
		tk.node.position = tk.pos
		tk.node.z_index = int(tk.pos.y / 4) + 600
	var keep: Array = []
	for f in fx:
		f.age += dt
		if f.kind in ["spark", "puff", "chip"]:
			if f.age < 0:
				keep.append(f)
				continue
			f.v.y += f.get("g", 600.0 if f.kind == "chip" else 0.0) * dt
			f.p += f.v * dt
			if f.kind == "chip" and f.p.y > f.ground:
				f.p.y = f.ground
				f.v *= 0.4
		elif f.kind == "rocket" and f.age >= f.life:
			for k in 46:
				var a := randf() * TAU
				var sp := randf_range(90, 170)
				fx.append({"kind": "spark", "p": f.top, "v": Vector2(cos(a), sin(a)) * sp, "g": 60.0, "life": randf_range(1.0, 1.5), "age": 0.0,
					"col": Color.WHITE if k % 5 == 0 else f.col, "s": randf_range(12, 20)})
			continue
		if f.age < f.life:
			keep.append(f)
	fx = keep
	queue_redraw()


func _draw() -> void:
	var now := Time.get_ticks_msec()
	# vòng đích + số bước
	if target >= 0:
		var c := scr(Board.tp(target, 0, 0.5, TH))
		var r := 46.0 * (1 + 0.12 * sin(t * 7))
		draw_set_transform(c, 0, Vector2(1, Iso.B / Iso.A))
		draw_arc(Vector2.ZERO, r, 0, TAU, 48, Color("#ffd000"), 5, true)
		draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
	# cổng festival + nhà + đế quân cờ: vẽ theo thứ tự y (xa trước, gần sau)
	var items: Array = []
	for i in 32:
		if buildings[i]:
			items.append([scr(Board.tp(i, 0, 0.3, TH)).y, "b", i])
	for i in gates:
		items.append([scr(Board.tp(i, 0, 0.03, TH)).y, "g", i])
	items.sort_custom(func(a, b): return a[0] < b[0])
	for it in items:
		if it[1] == "b":
			_draw_building(it[2], now)
		else:
			_draw_gate(it[2], now)
	# đế + bóng quân cờ
	for tk in tokens:
		if tk.out:
			continue
		var p: Vector2 = tk.pos
		var col: Color = tk.color
		var up: float = clampf(tk.lift / 150.0, 0, 1)
		# quầng sáng quanh đế của người đang tới lượt
		if tk.cur:
			var g := 0.5 + 0.5 * sin(t * 5)
			draw_texture_rect(blob, Rect2(p - Vector2(70, 40) * (1 + 0.1 * g), Vector2(140, 80) * (1 + 0.1 * g)), false, Color(col.lightened(0.35), 0.55 + 0.25 * g))
		draw_set_transform(p, 0, Vector2(1, 0.54))
		draw_circle(Vector2(2, 9), 33, Color(0.2, 0.08, 0.22, 0.26))
		# thân đế (dày) → mặt đế → vành sáng
		draw_circle(Vector2(0, 5), 29, col.darkened(0.42))
		draw_circle(Vector2(0, -1), 29, col.darkened(0.2))
		draw_circle(Vector2(0, -8), 29, col)
		draw_circle(Vector2(0, -8), 23.5, col.lightened(0.22))
		draw_arc(Vector2(0, -8), 26.2, 0, TAU, 44, Color(1, 1, 1, 0.55), 2.2, true)
		draw_arc(Vector2(0, -8), 23.5, PI * 1.05, PI * 1.6, 14, Color(1, 1, 1, 0.75), 3.0, true)
		# bóng nhân vật trên mặt đế (nhỏ lại khi nhảy lên)
		draw_circle(Vector2(0, -8), 15.0 * (1 - 0.5 * up), Color(0.15, 0.05, 0.2, 0.30 * (1 - 0.6 * up)))
		if tk.cur:
			draw_arc(Vector2(0, -8), 37 + 4 * sin(t * 5), 0, TAU, 44, Color(col.lightened(0.4), 0.9), 4, true)
		draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
	# xúc xắc
	if not dice_hidden:
		var S: Dictionary = DICE_SKINS.get(skin_of(cur_pid), DICE_SKINS.classic)
		for k in 2:
			var c: Variant = scr(Vector3(-0.42 + k * 0.84, 0.0, 0.42 - k * 0.84) * 0.7) + dice_off[k] + Vector2(0, -10)
			draw_set_transform(scr(Vector3(-0.42 + k * 0.84, 0, 0.42 - k * 0.84) * 0.7) + Vector2(0, 20), 0, Vector2(1, 0.45))
			draw_circle(Vector2.ZERO, 32, Color(0.2, 0.1, 0.25, 0.22))
			draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
			_draw_die(c, dice_faces[k], S, dice_rot[k])
	# đống tiền
	for k in pile.size():
		var c: Dictionary = pile[k]
		var a := clampf((pile_t - c.d) / 0.42, 0, 1)
		var e := 1 + 2.7 * pow(a - 1, 3) + 1.7 * pow(a - 1, 2)
		var p: Vector2 = c.p + Vector2(0, -240 * (1 - e)) + Vector2(0, -20)
		var s: float = c.s
		draw_texture_rect(coin_tex, Rect2(p - Vector2(s, s) / 2, Vector2(s, s)), false, Color(1, 1, 1, a))
	# hiệu ứng
	for f in fx:
		if f.age < 0:
			continue
		var k: float = f.age / f.life
		match f.kind:
			"spark":
				var col: Color = f.col
				col.a = 1 - k
				draw_texture_rect(blob, Rect2(f.p - Vector2(f.s, f.s) / 2, Vector2(f.s, f.s)), false, col * Color(1.4, 1.4, 1.4, 1))
			"puff":
				var col: Color = f.col
				col.a = 0.8 * (1 - k)
				var s: float = f.s * (1 + k * 1.6)
				draw_texture_rect(blob, Rect2(f.p - Vector2(s, s) / 2, Vector2(s, s)), false, col)
			"chip":
				draw_rect(Rect2(f.p - Vector2(f.s, f.s * 0.7) / 2, Vector2(f.s, f.s * 0.7)), Color(f.col, 1 - maxf(0, k - 0.6) / 0.4))
			"beam":
				var a := k / 0.15 if k < 0.15 else maxf(0, 1 - (k - 0.15) / 0.85)
				var w := 40.0 * (1 + sin(k * PI) * 0.3)
				draw_texture_rect(blob, Rect2(f.p - Vector2(w, f.h), Vector2(w * 2, f.h + 10)), false, Color(f.col, 0.55 * a))
				draw_texture_rect(blob, Rect2(f.p - Vector2(w * 0.35, f.h * 0.9), Vector2(w * 0.7, f.h * 0.9 + 6)), false, Color(1, 1, 1, 0.6 * a))
			"rocket":
				var p: Vector2 = (f.p as Vector2).lerp(f.top, 1 - pow(1 - clampf(k, 0, 1), 3))
				draw_texture_rect(blob, Rect2(p - Vector2(9, 9), Vector2(18, 18)), false, Color(1, 0.96, 0.8))
	# mũi tên nhún phía trên đầu người đang tới lượt
	for tk in tokens:
		if tk.out or not tk.cur or tk.from != null:
			continue
		var ap: Vector2 = (tk.pos as Vector2) + Vector2(0, -142 - absf(sin(t * 4.2)) * 9)
		var tri := PackedVector2Array([ap + Vector2(-13, -12), ap + Vector2(13, -12), ap + Vector2(0, 8)])
		var tri2 := PackedVector2Array([ap + Vector2(-17, -15.5), ap + Vector2(17, -15.5), ap + Vector2(0, 13)])
		draw_colored_polygon(tri2, Color.WHITE)
		draw_colored_polygon(tri, tk.color)
	# nhãn ô đích (trên cùng)
	if target >= 0 and target_label != "":
		var c := scr(Board.tp(target, 0, 0.5, TH)) + Vector2(0, -150 - absf(sin(t * 5)) * 10)
		draw_circle(c, 26, Color("#ffd000"))
		draw_circle(c, 26, Color.WHITE, false, 3, true)
		draw_string(font, c + Vector2(-30, 10), target_label, HORIZONTAL_ALIGNMENT_CENTER, 60, 28, Color("#6a3b00"))




## mô hình nào trong bảng hình ứng với công trình này
static func build_model(info: Dictionary, i: int) -> int:
	if info.type == "resort":
		return 0
	var lvl := clampi(int(info.lvl), 1, 4)
	var st := posmod(int(info.get("style", i)), 4)
	match lvl:
		1:
			return 1 + st
		2:
			return 5 + st
		3:
			return 9 + st % 2
	return 11 + st % 2


func _flag(fp: Vector2, col: Color, h: float, ph: float) -> void:
	draw_line(fp, fp + Vector2(0, -h), Color("#5b4630"), 2.6, true)
	draw_circle(fp + Vector2(0, -h), 2.6, Color("#ffd98a"))
	var wv := sin(t * 4 + ph) * 4
	var top := fp + Vector2(0, -h + 2)
	draw_colored_polygon(PackedVector2Array([top, top + Vector2(21, 6 + wv), top + Vector2(0, 15)]), col)
	draw_polyline(PackedVector2Array([top, top + Vector2(21, 6 + wv), top + Vector2(0, 15)]), col.darkened(0.3), 1.2, true)


func _draw_building(i: int, now: int) -> void:
	var b: Dictionary = buildings[i]
	var info: Dictionary = b.info
	var T: Dictionary = Board.TILE[i]
	var base := scr(Board.tp(i, 0, 0.3 if info.type == "resort" else 0.27, TH))
	var col := Color(info.color)
	var a: float = (now - b.t0) / 1000.0 if b.t0 else 9.0
	var sy := 1.0
	var sx := 1.0
	match b.anim:
		"grow":
			var k := minf(1, a / 0.75)
			sy = maxf(0.02, (pow(2, -10 * k) * sin((k * 10 - 0.75) * TAU / 3) + 1) if k > 0 and k < 1 else k)
		"up":
			var k := minf(1, a / 0.95)
			base.y -= (1 - minf(1, k * 1.6)) * 80
			var q := clampf((k - 0.62) / 0.38, 0, 1)
			sy = 1.0 - 0.14 * sin(q * PI) * (1 - q)
			sx = 1.0 + 0.10 * sin(q * PI) * (1 - q)
		"crumble":
			var k := minf(1, a / 0.6)
			sy = maxf(0.01, 1 - k)
			sx = 1 + k * 0.2
	if b.shake and now < b.shake:
		base.x += sin(now / 22.0) * 3
	var lvl: int = int(info.lvl)
	var resort: bool = info.type == "resort"
	# ô ở cạnh trái / phải bàn: lật ngang để mặt tiền vẫn quay ra phía chữ
	var flip := -1.0 if (T.side == "l" or T.side == "r") else 1.0
	var hgt := 0.0
	if resort or lvl >= 1:
		var m := build_model(info, i)
		hgt = BHEIGHT[m]
		var ci := maxi(0, Data.PLAYER_COLORS.find("#" + col.to_html(false)))
		if ci == 0 and info.has("owner") and Color(Data.PLAYER_COLORS[0]) != col:
			ci = posmod(int(info.owner), 4)
		var idx := m * 4 + ci
		# bóng đổ mềm trên mặt ô
		draw_texture_rect(blob, Rect2(base + Vector2(-58 + 8 * flip, -26), Vector2(116, 62)), false, Color(0.2, 0.08, 0.22, 0.30))
		draw_set_transform(base, 0, Vector2(sx * flip, sy))
		draw_texture_rect_region(house_tex, Rect2(-BANCHOR * BSCALE, Vector2(BFW, BFH) * BSCALE),
			Rect2((idx % BCOLS) * BFW, (idx / BCOLS) * BFH, BFW, BFH))
	else:
		draw_set_transform(base, 0, Vector2(sx * flip, sy))
	if resort:
		_flag(Iso.p(0.3, -0.16, 0.0) + Vector2(0, -4), col, 34, i)
	elif lvl == 0:
		# mới mua đất, chưa xây: cắm cờ chủ đất
		draw_set_transform(base, 0, Vector2(sx, sy))
		draw_set_transform(base + Vector2(0, 4), 0, Vector2(sx, 0.55 * sy))
		draw_circle(Vector2.ZERO, 11, Color(0.2, 0.08, 0.22, 0.22))
		draw_circle(Vector2(0, -3), 7.5, col.darkened(0.15))
		draw_set_transform(base, 0, Vector2(sx, sy))
		_flag(Vector2(0, 2), col, 50, i)
	elif lvl < 4:
		_flag(Iso.p(0.34, -0.22, 0.0) + Vector2(0, -5), col, 40, i)
	else:
		# khách sạn: đèn báo nhấp nháy + biển HOTEL trên nóc
		draw_set_transform(base, 0, Vector2(sx, sy))
		var tp := Vector2(0, -(hgt + 0.075) * BUP - 6)
		var bl := 0.5 + 0.5 * sin(t * 6)
		draw_texture_rect(blob, Rect2(tp - Vector2(13, 13), Vector2(26, 26)), false, Color(1, 0.3, 0.2, 0.7 * bl))
		draw_circle(tp, 4.2, Color(1, 0.25, 0.2).lerp(Color(1, 0.85, 0.75), bl))
		var hp := tp + Vector2(0, -22)
		var sb := Rect2(hp - Vector2(30, 11), Vector2(60, 21))
		draw_rect(Rect2(sb.position + Vector2(0, 2.5), sb.size), col.darkened(0.45))
		draw_rect(sb, Color("#fff3b0"))
		draw_rect(sb, col, false, 2.2)
		draw_string(font, hp + Vector2(-30, 5), "HOTEL", HORIZONTAL_ALIGNMENT_CENTER, 60, 13, col.darkened(0.3))
	draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
	if int(info.get("festMult", 0)):
		var p := base + Vector2(0, -(hgt * BUP + (68 if lvl >= 4 else 40)))
		var txt := "LỄ HỘI ×%d" % int(info.festMult)
		var w := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x + 20
		draw_rect(Rect2(p - Vector2(w / 2, 11.5), Vector2(w, 26)), Color("#c2317a"))
		draw_rect(Rect2(p - Vector2(w / 2, 14), Vector2(w, 26)), Color("#ff5fa2"))
		draw_string(font, p + Vector2(-w / 2 + 10, 6), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color.WHITE)
	if b.burn:
		for k in 6:
			var fp := base + Vector2(randf_range(-22, 22), randf_range(-14 - hgt * BUP * 0.8, -8))
			var fs := randf_range(18, 32)
			draw_texture_rect(blob, Rect2(fp - Vector2(fs, fs * 1.3) / 2, Vector2(fs, fs * 1.3)), false, Color(1, randf_range(0.4, 0.7), 0.1, 0.8))


func _draw_gate(i: int, now: int) -> void:
	var t0: int = gates[i]
	var k := 1.0 if t0 == 0 else minf(1, (now - t0) / 800.0)
	var T: Dictionary = Board.TILE[i]
	var a := scr(Board.tp(i, -0.44, 0.03, TH))
	var b := scr(Board.tp(i, 0.44, 0.03, TH))
	var H := 95.0 * k
	for p in [a, b]:
		draw_line(p, p + Vector2(0, -H), Color("#b07a3e"), 5, true)
		draw_circle(p + Vector2(0, -H), 6, Color("#ffc531"))
	# băng rôn
	var m := (a + b) / 2 + Vector2(0, -H * 0.82)
	var dir := (b - a).normalized()
	var L := (b - a).length() * 0.98
	var n := Vector2(0, 1)
	var sag := sin(t * 2 + i) * 2
	var poly := PackedVector2Array([m - dir * L / 2 + Vector2(0, -12), m + dir * L / 2 + Vector2(0, -12), m + dir * L / 2 + Vector2(0, 14 + sag), m - dir * L / 2 + Vector2(0, 14 + sag)])
	draw_colored_polygon(poly, Color("#1f9d55"))
	draw_polyline(PackedVector2Array([poly[0], poly[1], poly[2], poly[3], poly[0]]), Color("#ffd23f"), 2.5, true)
	draw_set_transform(m, dir.angle() if absf(dir.angle()) < PI / 2 else dir.angle() + PI, Vector2.ONE)
	draw_string(font, Vector2(-L / 2, 5), "FESTIVAL", HORIZONTAL_ALIGNMENT_CENTER, L, 11, Color("#ffe14d"))
	draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
	# dây cờ đuôi nheo
	var cols := ["#ff4d6d", "#ffb703", "#3a86ff", "#ff8c42", "#b15cff", "#06d6a0", "#ffd60a"]
	for j in 8:
		var u := (j + 0.5) / 8.0
		var p := a.lerp(b, u) + Vector2(0, -H * 0.55 + sin(u * PI) * 8)
		var sw := sin(t * 5 + j) * 3
		draw_colored_polygon(PackedVector2Array([p + Vector2(-6, 0), p + Vector2(6, 0), p + Vector2(sw, 14)]), Color(cols[j % 7]))
