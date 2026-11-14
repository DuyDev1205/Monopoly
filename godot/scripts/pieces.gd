class_name Pieces
extends Node3D
## Vật thể trong ván: quân cờ nhân vật (KayKit, có hoạt ảnh), nhà theo cấp (phố Á Đông Polyfork, mái tô màu chủ đất),
## khu du lịch, cổng lễ hội, xúc xắc 12 bộ, vòng đánh dấu ô đích, đống tiền giữa bàn, hiệu ứng (lấp lánh, cột sáng, pháo hoa).

const TH := Board.TH
const TOKEN_H := 1.15
const FACE_CAM := PI / 4
const SLOTS := [[0.0], [-0.2, 0.2], [-0.27, 0.0, 0.27], [-0.33, -0.11, 0.11, 0.33]]
## 12 nhân vật: 9 mô hình KayKit, 3 bản bỏ mũ / mũ giáp
const CHAR3D := [
	{"f": "c0"}, {"f": "c1"}, {"f": "c2"}, {"f": "c3"}, {"f": "c4"}, {"f": "c5"}, {"f": "c6"}, {"f": "c7"},
	{"f": "c8"}, {"f": "c0", "hide": "Helmet"}, {"f": "c1", "hide": "Hat"}, {"f": "c2", "hide": "Hat"},
]
const ANIM_ALIAS := {"idle": ["Idle"], "walk": ["Walking_A", "Running_A"], "jump": ["Jump_Full_Short", "Jump_Full_Long"],
	"emote-yes": ["Cheer"], "emote-no": ["Hit_A"], "die": ["Death_A"]}
const HOUSE_SETS := {
	1: ["pf/minka-farmhouse-680475", "pf/open-front-teahouse-c7dd18", "pf/kura-storehouse-5c9631", "pf/alley-bar-hut-3e41f8"],
	2: ["pf/machiya-townhouse-8ef64e", "pf/two-storey-shophouse-183790", "pf/corner-shophouse-ad15c2", "pf/wide-shophouse-089f20"],
	3: ["pf/buddhist-temple-hall-f0aa09", "pf/bathhouse-4ac41a", "pf/buddhist-temple-hall-f0aa09", "pf/bathhouse-4ac41a"],
	4: ["pf/tiered-pagoda-f4ade0", "pf/tenshu-keep-2ff636", "pf/tiered-pagoda-f4ade0", "pf/tenshu-keep-2ff636"],
}
const HOUSE_FIT := {1: [0.5, 0.5], 2: [0.56, 0.72], 3: [0.62, 0.95], 4: [0.6, 1.45]}
const DICE_KEYS := ["classic", "gold", "jade", "ruby", "wood", "neon", "crystal", "sakura", "obsidian", "ocean", "candy", "galaxy"]
const DICE_NAMES := {"classic": "Cổ điển", "gold": "Vàng", "jade": "Ngọc bích", "ruby": "Hồng ngọc", "wood": "Gỗ", "neon": "Neon",
	"crystal": "Pha lê", "sakura": "Anh đào", "obsidian": "Hắc thạch", "ocean": "Đại dương", "candy": "Kẹo ngọt", "galaxy": "Thiên hà"}
const DICE_SKINS := {
	"classic": {"bg": ["#ffffff", "#ece4d6"], "pip": ["#5a5a5a", "#0d0d0d"], "red": ["#ff6b6b", "#b3121b"], "rough": 0.3},
	"gold": {"bg": ["#fff1b8", "#d39a12"], "pip": ["#6b3d00", "#2e1a00"], "red": ["#c0182a", "#5a0008"], "rough": 0.25, "metal": 0.6, "ring": "#b07a08"},
	"jade": {"bg": ["#a8f5cf", "#24905f"], "pip": ["#fff6c8", "#d9a21b"], "red": ["#fff6c8", "#d9a21b"], "rough": 0.15, "deco": 2},
	"ruby": {"bg": ["#ff7a90", "#9c0f2a"], "pip": ["#ffffff", "#f1dde3"], "red": ["#ffe14d", "#d9a21b"], "rough": 0.15},
	"wood": {"bg": ["#e0ac72", "#94592a"], "pip": ["#3a2210", "#140802"], "red": ["#7a1f10", "#2a0802"], "rough": 0.75, "deco": 1},
	"neon": {"bg": ["#232850", "#090b1d"], "pip": ["#c8fbff", "#35d5ff"], "red": ["#ffc4e2", "#ff4f8b"], "rough": 0.3, "glow": 1.0},
	"crystal": {"bg": ["#f4fcff", "#9fd2ee"], "pip": ["#3d74b0", "#16365e"], "red": ["#3d74b0", "#16365e"], "rough": 0.05, "deco": 3},
	"sakura": {"bg": ["#fff3f8", "#f5b5cf"], "pip": ["#e0598d", "#93204c"], "red": ["#e0598d", "#93204c"], "rough": 0.3, "deco": 7},
	"obsidian": {"bg": ["#3a3a44", "#0b0b10"], "pip": ["#ffe9a8", "#d4a017"], "red": ["#ffe9a8", "#d4a017"], "rough": 0.12, "metal": 0.2, "ring": "#b8860b"},
	"ocean": {"bg": ["#7fd8ff", "#1565c0"], "pip": ["#ffffff", "#dbeeff"], "red": ["#ffe066", "#f4a300"], "rough": 0.15, "deco": 4},
	"candy": {"bg": ["#fff7fb", "#ffd9ec"], "pip": ["#7a5cff", "#4a2fc9"], "red": ["#ff4f8b", "#c2185b"], "rough": 0.35, "deco": 5},
	"galaxy": {"bg": ["#3b1d6e", "#0a0620"], "pip": ["#fff4ff", "#ff8af5"], "red": ["#c8fbff", "#35d5ff"], "rough": 0.25, "deco": 6, "glow": 1.0},
}
## mặt hộp: +x, -x, +y, -y, +z, -z  → số chấm
const FACE_N := [2, 5, 1, 6, 3, 4]
const FACE_DIR := [Vector3.RIGHT, Vector3.LEFT, Vector3.UP, Vector3.DOWN, Vector3.BACK, Vector3.FORWARD]

var tokens: Array = []
var buildings: Array = []
var gates := {}
var dice: Array = []
var dice_mats := {}
var my_skin := "classic"
var cur_pid := 0
var last_dice := [5, 6]
var marker: Node3D
var marker_label: Label3D
var pile: Node3D
var anims: Array = []          # Callable(dt) -> bool (false = xong)
var tint_cache := {}
var t := 0.0
var spark_tex: Texture2D
var font: FontFile
var punch := 0.0               # camera rung nhẹ khi có hiệu ứng lớn
var ready_at := 0.0


func _ready() -> void:
	font = load("res://assets/fonts/BeVietnamPro-Black.ttf")
	buildings.resize(32)
	spark_tex = _radial_tex(64, [Color(1, 1, 1, 1), Color(1, 1, 1, 0.85), Color(1, 1, 1, 0)], [0.0, 0.25, 1.0])
	_build_dice()
	_build_marker()


func _process(dt: float) -> void:
	t += dt
	_update_tokens(dt)
	_update_buildings(dt)
	_update_gates()
	if marker.visible:
		marker.get_child(0).scale = Vector3.ONE * (1 + 0.12 * sin(t * 7))
		if marker_label:
			marker_label.position.y = 1.2 + absf(sin(t * 5)) * 0.15
	var keep: Array = []
	for f in anims:
		if f.call(dt):
			keep.append(f)
	anims = keep
	punch = maxf(0, punch - dt * 0.3)


# ======================= tiện ích =======================
func _radial_tex(size: int, cols: Array, stops: Array) -> ImageTexture:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array(stops)
	g.colors = PackedColorArray(cols)
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	gt.width = size
	gt.height = size
	var img := gt.get_image()
	return ImageTexture.create_from_image(img)


func _label(text: String, size: int, fg: Color, outline: Color, h := 0.2) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font = font
	l.font_size = size
	l.pixel_size = h / size
	l.modulate = fg
	l.outline_modulate = outline
	l.outline_size = int(size * 0.28)
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = false
	l.fixed_size = false
	l.render_priority = 2
	l.outline_render_priority = 1
	l.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	return l


static func _ease_out_back(k: float) -> float:
	return 1 + 2.7 * pow(k - 1, 3) + 1.7 * pow(k - 1, 2)


static func _ease_in_out(k: float) -> float:
	return 2 * k * k if k < 0.5 else 1 - pow(-2 * k + 2, 2) / 2


static func _ease_out_elastic(k: float) -> float:
	if k <= 0 or k >= 1:
		return k
	return pow(2, -10 * k) * sin((k * 10 - 0.75) * TAU / 3) + 1


# ======================= quân cờ =======================
func _char_token(k: int) -> Dictionary:
	var ent: Dictionary = CHAR3D[posmod(k, CHAR3D.size())]
	var scn: PackedScene = load("res://assets/models/kk/chr/%s.glb" % ent.f)
	var o: Node3D = scn.instantiate()
	var ap: AnimationPlayer = o.find_child("AnimationPlayer", true, false)
	if ent.has("hide"):
		var re := RegEx.create_from_string("(?i)" + ent.hide)
		for n in o.find_children("*", "", true, false):
			if n != o and re.search(n.name) and n is Node3D:
				n.visible = false
	var bb := MeshUtil.visible_aabb(o)
	var s := TOKEN_H / maxf(bb.size.y, 0.01)
	o.scale = Vector3.ONE * s
	o.position.y = -bb.position.y * s
	MeshUtil.set_shadows(o, true)
	var wrap := Node3D.new()
	wrap.add_child(o)
	wrap.rotation.y = FACE_CAM
	if ap:
		for nm in ["Idle", "Walking_A", "Running_A"]:
			if ap.has_animation(nm):
				ap.get_animation(nm).loop_mode = Animation.LOOP_LINEAR
		ap.playback_default_blend_time = 0.2
	return {"wrap": wrap, "ap": ap, "cur": "", "dead": false}


func _play(m: Dictionary, n: String, once := false, fade := 0.2) -> void:
	var ap: AnimationPlayer = m.ap
	if ap == null:
		return
	var clip := ""
	for c in ANIM_ALIAS.get(n, [n]):
		if ap.has_animation(c):
			clip = c
			break
	if clip == "" or (m.cur == clip and not once):
		return
	ap.play(clip, fade)
	m.cur = clip
	m.once = once


## players: [{char, color, mine}]
func set_tokens(players: Array) -> void:
	for tk in tokens:
		tk.grp.queue_free()
	tokens.clear()
	ready_at = Time.get_ticks_msec()
	for p in players:
		var grp := Node3D.new()
		add_child(grp)
		var col := Color(p.color)
		var base := MeshUtil.mesh(MeshUtil.cyl(0.2, 0.23, 0.07, 32), MeshUtil.std(col, 0.35, 0.1), Vector3(0, 0.035, 0))
		grp.add_child(base)
		var ring := MeshUtil.mesh(_ring_mesh(0.24, 0.3), null, Vector3(0, 0.012, 0), false)
		var rm := StandardMaterial3D.new()
		rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		rm.albedo_color = Color(col, 0)
		rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		rm.cull_mode = BaseMaterial3D.CULL_DISABLED
		ring.material_override = rm
		grp.add_child(ring)
		var m := _char_token(int(p.get("char", 0)))
		m.wrap.position.y = 0.07
		grp.add_child(m.wrap)
		if m.ap:
			m.ap.animation_finished.connect(func(_n):
				if not m.dead:
					_play(m, "idle"))
		_play(m, "idle")
		if m.ap:
			m.ap.seek(randf() * 2.0, true)
		tokens.append({"grp": grp, "model": m, "ring": ring, "ring_mat": rm, "mine": p.get("mine", false),
			"from": null, "to": null, "t0": 0.0, "dur": 0.0, "arc": 0.0, "cur": false, "walk_end": 0.0})


func _ring_mesh(r0: float, r1: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 48
	for k in n:
		var a0 := TAU * k / n
		var a1 := TAU * (k + 1) / n
		var p := [Vector3(cos(a0) * r0, 0, sin(a0) * r0), Vector3(cos(a0) * r1, 0, sin(a0) * r1), Vector3(cos(a1) * r1, 0, sin(a1) * r1), Vector3(cos(a1) * r0, 0, sin(a1) * r0)]
		for i in [0, 1, 2, 0, 2, 3]:
			st.set_normal(Vector3.UP)
			st.add_vertex(p[i])
	return st.commit()


func slot_pos(tile: int, k: int, n: int) -> Vector3:
	var arr: Array = SLOTS[mini(n, 4) - 1]
	var a: float = arr[k] if k < arr.size() else 0.0
	return Board.tp(tile, a, 0.55 if tile % 8 == 0 else 0.52, TH)


## place = {tile, k, n, out}; opt = {dur (ms), arc}
func place_token(pid: int, place: Dictionary, opt := {}) -> void:
	if pid >= tokens.size():
		return
	var tk: Dictionary = tokens[pid]
	tk.grp.visible = not place.get("out", false)
	var target := slot_pos(place.tile, place.get("k", 0), place.get("n", 1))
	var dur: float = opt.get("dur", 0.0)
	if dur <= 0 or tk.to == null:
		tk.grp.position = target
		tk.to = target
		tk.from = null
		return
	tk.from = tk.grp.position
	tk.to = target
	tk.t0 = Time.get_ticks_msec()
	tk.dur = dur
	tk.arc = opt.get("arc", 0.35)
	var d: Vector3 = target - tk.from
	if Vector2(d.x, d.z).length() > 0.01:
		tk.model.wrap.rotation.y = atan2(d.x, d.z)
	_play(tk.model, "jump" if dur > 600 else "walk", false, 0.08)


func set_current(pid: int) -> void:
	cur_pid = pid
	for i in tokens.size():
		tokens[i].cur = i == pid


func emote(pid: int, e: String) -> void:
	if pid >= tokens.size() or tokens[pid].from != null:
		return
	var m: Dictionary = tokens[pid].model
	match e:
		"victory":
			_play(m, "jump" if randf() < 0.5 else "emote-yes", true)
		"shock":
			_play(m, "emote-no", true)
		"out":
			m.dead = true
			_play(m, "die", true)


func _update_tokens(_dt: float) -> void:
	var now := Time.get_ticks_msec()
	for tk in tokens:
		var m: Dictionary = tk.model
		if tk.from != null:
			var k := minf(1.0, (now - tk.t0) / tk.dur)
			var e := _ease_in_out(k)
			tk.grp.position = (tk.from as Vector3).lerp(tk.to, e)
			m.wrap.position.y = 0.07 + sin(k * PI) * tk.arc
			if k >= 1:
				tk.from = null
				m.wrap.position.y = 0.07
				tk.walk_end = now
		elif tk.walk_end and now - tk.walk_end > 140:
			tk.walk_end = 0.0
			m.wrap.rotation.y = FACE_CAM
			if not m.dead:
				_play(m, "idle", false, 0.25)
		var rm: StandardMaterial3D = tk.ring_mat
		rm.albedo_color.a = 0.6 + 0.3 * sin(t * 5) if tk.cur else 0.0
		tk.ring.scale = Vector3.ONE * (1 + 0.12 * sin(t * 5) if tk.cur else 1.0)


# ======================= nhà / công trình =======================
func _tint_roofs(grp: Node3D, color: Color) -> void:
	## tô lại mặt hướng lên ở nửa trên (mái) theo màu chủ đất, giữ tường sáng
	var bb := MeshUtil.visible_aabb(grp)
	var H := bb.size.y
	var y0 := bb.position.y
	var stack: Array = [[grp, Transform3D.IDENTITY]]
	while stack.size():
		var it: Array = stack.pop_back()
		var n: Node = it[0]
		var tf: Transform3D = it[1]
		if n != grp and n is Node3D:
			tf = tf * (n as Node3D).transform
		for c in n.get_children():
			stack.append([c, tf])
		if not (n is MeshInstance3D) or (n as MeshInstance3D).mesh == null:
			continue
		var mi: MeshInstance3D = n
		var key := "%d|%s" % [mi.mesh.get_instance_id(), color.to_html()]
		if tint_cache.has(key):
			mi.mesh = tint_cache[key]
			continue
		var out := ArrayMesh.new()
		for s in mi.mesh.get_surface_count():
			var arr: Array = mi.mesh.surface_get_arrays(s)
			var mat := mi.mesh.surface_get_material(s)
			if arr[Mesh.ARRAY_COLOR] != null and arr[Mesh.ARRAY_INDEX] != null:
				var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
				var c: PackedColorArray = arr[Mesh.ARRAY_COLOR]
				var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
				# tách đỉnh theo tam giác để tô riêng từng mặt
				var nv := PackedVector3Array()
				var nc := PackedColorArray()
				var nn := PackedVector3Array()
				var nrm: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
				for ti in range(0, idx.size(), 3):
					var A: Vector3 = tf * v[idx[ti]]
					var B: Vector3 = tf * v[idx[ti + 1]]
					var C: Vector3 = tf * v[idx[ti + 2]]
					var fnorm := (C - B).cross(A - B).normalized()
					var cy := (A.y + B.y + C.y) / 3
					var cc: Color = c[idx[ti]]
					var L := 0.3 * cc.r + 0.59 * cc.g + 0.11 * cc.b
					var roof := fnorm.y >= 0.3 and cy >= y0 + H * 0.4 and L <= 0.6
					for j in 3:
						nv.append(v[idx[ti + j]])
						nn.append(nrm[idx[ti + j]])
						if roof:
							var kk := 0.55 + L * 1.2
							nc.append(Color(minf(1, color.r * kk), minf(1, color.g * kk), minf(1, color.b * kk)))
						else:
							nc.append(c[idx[ti + j]])
				var na := []
				na.resize(Mesh.ARRAY_MAX)
				na[Mesh.ARRAY_VERTEX] = nv
				na[Mesh.ARRAY_NORMAL] = nn
				na[Mesh.ARRAY_COLOR] = nc
				out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, na)
			else:
				out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			out.surface_set_material(out.get_surface_count() - 1, mat)
		tint_cache[key] = out
		mi.mesh = out


func _plot(color: Color, lvl: int, w := 0.78, d := 0.66, lawn_col := Color("#86c46a")) -> Node3D:
	var g := Node3D.new()
	g.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(w, 0.06, d), 0.025, 3), MeshUtil.std(color, 0.45, 0.05), Vector3(0, 0.03, 0)))
	g.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(w - 0.1, 0.02, d - 0.1), 0.01, 2), MeshUtil.std(lawn_col, 1.0), Vector3(0, 0.065, 0)))
	var spots := [[0.3, 0.24]]
	if lvl == 2:
		spots = [[-0.3, 0.24], [0.3, 0.24]]
	elif lvl >= 3:
		spots = [[-0.3, 0.24], [0.3, 0.24], [-0.3, -0.24]]
	for sp in spots:
		var b := MeshUtil.kit("pf/round-bush-cd2ac0", 0.14)
		if b:
			b.position = Vector3(sp[0], 0.075, sp[1])
			g.add_child(b)
	if lvl >= 2:
		var lamp := Node3D.new()
		lamp.add_child(MeshUtil.mesh(MeshUtil.cyl(0.008, 0.01, 0.2, 6), MeshUtil.std(Color("#3a3040")), Vector3(0, 0.1, 0)))
		lamp.add_child(MeshUtil.mesh(MeshUtil.sphere(0.022, 10), MeshUtil.emissive(Color("#fff3c4"), Color("#ffc85a"), 3.0), Vector3(0, 0.21, 0), false))
		lamp.position = Vector3(-0.32, 0.075, -0.22)
		g.add_child(lamp)
	return g


func _owner_flag(color: Color) -> Node3D:
	var g := Node3D.new()
	g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.012, 0.012, 0.42, 8), MeshUtil.std(Color("#5b4630")), Vector3(0, 0.21, 0)))
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for p in [Vector3(0, 0, 0), Vector3(0.2, -0.06, 0), Vector3(0, -0.13, 0)]:
		st.set_normal(Vector3.BACK)
		st.add_vertex(p)
	var fm := StandardMaterial3D.new()
	fm.albedo_color = color
	fm.cull_mode = BaseMaterial3D.CULL_DISABLED
	var f := MeshUtil.mesh(st.commit(), fm, Vector3(0.01, 0.41, 0))
	f.set_meta("wave", true)
	g.add_child(f)
	return g


func _hotel_top(g: Node3D, y: float, color: Color) -> void:
	var l := _label("HOTEL", 64, Color("#fff3b0"), color.darkened(0.3), 0.16)
	l.position.y = y + 0.14
	g.add_child(l)
	var bc := MeshUtil.mesh(MeshUtil.sphere(0.035, 12), MeshUtil.emissive(Color("#ff3b3b"), Color("#ff2020"), 4.0), Vector3(0, y + 0.3, 0), false)
	bc.material_override = bc.material_override.duplicate()
	bc.set_meta("beacon", true)
	g.add_child(bc)


func _house_model(type: String, lvl: int, st: int, color: Color) -> Node3D:
	var g := Node3D.new()
	if type == "resort":
		g.add_child(_plot(color, 1, 0.74, 0.54, Color("#f2dfa6")))
		var hut := MeshUtil.kit("pf/beach-hut-fc7649", 0.36)
		if hut:
			hut.position = Vector3(-0.12, 0.075, -0.02)
			g.add_child(hut)
		var palm := MeshUtil.kit("pf/palm-sapling-ef7ae4", 0, 0.62)
		if palm:
			palm.position = Vector3(0.2, 0.075, 0.05)
			g.add_child(palm)
		var f := _owner_flag(color)
		f.scale = Vector3.ONE * 0.8
		f.position = Vector3(0.3, 0.075, -0.18)
		g.add_child(f)
		return g
	if lvl == 0:
		g.add_child(_owner_flag(color))
		return g
	var L := mini(4, lvl)
	var name: String = HOUSE_SETS[L][posmod(st, 4)]
	var m := MeshUtil.kit(name, HOUSE_FIT[L][0], 0, HOUSE_FIT[L][1])
	if m == null:
		g.add_child(_owner_flag(color))
		return g
	_tint_roofs(m, color)
	g.add_child(_plot(color, L))
	m.position.y = 0.075
	g.add_child(m)
	if L == 4:
		_hotel_top(g, m.get_meta("height") + 0.075, color)
	else:
		var f := _owner_flag(color)
		f.scale = Vector3.ONE * 0.7
		f.position = Vector3(0.34, 0.075, -0.24)
		g.add_child(f)
	return g


func building_key(i: int) -> String:
	var b: Node3D = buildings[i]
	return b.get_meta("key") if b else ""


## info = {owner, color, lvl, style, type, festMult} hoặc null
func set_building(i: int, info) -> Dictionary:
	var key := "" if info == null else "%d|%d|%d" % [info.owner, info.lvl, info.get("festMult", 0)]
	var cur: Node3D = buildings[i]
	var prev_key := building_key(i)
	if prev_key == key:
		return {"prev": prev_key}
	var pk := prev_key.split("|")
	var same := info != null and pk.size() > 1 and pk[0] == str(info.owner) and pk[1] == str(info.lvl)
	if same:
		_set_fest_label(cur, info.get("festMult", 0))
		cur.set_meta("key", key)
		return {"prev": prev_key}
	if cur:
		cur.queue_free()
	buildings[i] = null
	if info == null:
		return {"prev": prev_key}
	var T: Dictionary = Board.TILE[i]
	var root := Node3D.new()
	var model := _house_model(info.type, info.lvl, info.get("style", i), Color(info.color))
	root.add_child(model)
	var p := Board.tp(i, 0, 0.32 if info.type == "resort" else 0.3, TH)
	root.position = p
	root.rotation.y = atan2(-T.far.x, -T.far.z)    # mặt tiền quay ra mép gần (phía chữ)
	var up := pk.size() > 1 and pk[0] == str(info.owner) and int(pk[1]) < int(info.lvl)
	root.set_meta("key", key)
	root.set_meta("model", model)
	root.set_meta("anim", "up" if up else "grow")
	root.set_meta("t0", Time.get_ticks_msec())
	root.set_meta("shake", 0.0)
	add_child(root)
	buildings[i] = root
	_set_fest_label(root, info.get("festMult", 0))
	if Time.get_ticks_msec() - ready_at > 1500:
		var lv: int = 1 if info.type == "resort" else int(info.lvl)
		get_tree().create_timer(0.35).timeout.connect(func(): build_fx(p, lv))
	return {"prev": prev_key, "upgraded": up}


func _set_fest_label(root: Node3D, mult) -> void:
	if root.has_meta("fest") and is_instance_valid(root.get_meta("fest")):
		root.get_meta("fest").queue_free()
		root.remove_meta("fest")
	if not mult:
		return
	var lb := _label("LỄ HỘI ×%d" % int(mult), 64, Color.WHITE, Color("#e0267a"), 0.2)
	var bb := MeshUtil.visible_aabb(root.get_meta("model"))
	lb.position.y = maxf(0.6, bb.end.y + 0.22)
	root.add_child(lb)
	root.set_meta("fest", lb)


func fx_shake(i: int, ms := 500) -> void:
	if buildings[i]:
		buildings[i].set_meta("shake", Time.get_ticks_msec() + ms)


func fx_burn(i: int, on: bool) -> void:
	var b: Node3D = buildings[i]
	if b == null:
		return
	if on:
		var fl := GPUParticles3D.new()
		fl.amount = 40
		fl.lifetime = 0.7
		var pm := ParticleProcessMaterial.new()
		pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
		pm.emission_box_extents = Vector3(0.2, 0.05, 0.18)
		pm.direction = Vector3.UP
		pm.spread = 15
		pm.initial_velocity_min = 0.4
		pm.initial_velocity_max = 0.9
		pm.gravity = Vector3(0, 0.6, 0)
		pm.scale_min = 0.6
		pm.scale_max = 1.2
		var cr := Gradient.new()
		cr.colors = PackedColorArray([Color(1, 1, 0.8, 1), Color(1, 0.6, 0.15, 0.9), Color(0.9, 0.2, 0.05, 0)])
		cr.offsets = PackedFloat32Array([0.0, 0.4, 1.0])
		var ct := GradientTexture1D.new()
		ct.gradient = cr
		pm.color_ramp = ct
		fl.process_material = pm
		fl.draw_pass_1 = _spark_quad(0.22, true)
		fl.position.y = 0.2
		b.add_child(fl)
		b.set_meta("flames", fl)
	elif b.has_meta("flames"):
		b.get_meta("flames").queue_free()
		b.remove_meta("flames")


func collapse(i: int) -> void:
	var b: Node3D = buildings[i]
	if b == null:
		return
	b.set_meta("anim", "crumble")
	b.set_meta("t0", Time.get_ticks_msec())
	for k in 14:
		var m := MeshUtil.mesh(BoxMesh.new(), MeshUtil.std(Color(["#c9a77a", "#8a7a70", "#e9d9b8", "#b05a3a"][k % 4])))
		(m.mesh as BoxMesh).size = Vector3(0.05, 0.035, 0.04)
		m.position = b.position + Vector3(randf_range(-0.15, 0.15), randf_range(0.1, 0.4), randf_range(-0.15, 0.15))
		add_child(m)
		var v := Vector3(randf_range(-1.4, 1.4), randf_range(1.5, 3), randf_range(-1.4, 1.4))
		var spin := Vector3(randf_range(-9, 9), randf_range(-9, 9), randf_range(-9, 9))
		var age := [0.0]
		anims.append(func(dt):
			age[0] += dt
			v.y -= 9.8 * dt
			m.position += v * dt
			if m.position.y < TH + 0.02:
				m.position.y = TH + 0.02
				v *= 0.4
				v.y = absf(v.y) * 0.3
			m.rotation += spin * dt
			if age[0] > 1.3:
				m.scale *= 0.85
			if age[0] > 1.8:
				m.queue_free()
				return false
			return true)
	puffs(b.position, 8)


func _update_buildings(_dt: float) -> void:
	var now := Time.get_ticks_msec()
	for b in buildings:
		if b == null:
			continue
		var m: Node3D = b.get_meta("model")
		var a: float = (now - b.get_meta("t0")) / 1000.0
		match b.get_meta("anim"):
			"grow":
				var k := minf(1, a / 0.75)
				var e := _ease_out_elastic(k)
				m.scale = Vector3(minf(1.08, 0.5 + 0.5 * e), maxf(0.01, e), minf(1.08, 0.5 + 0.5 * e))
				if k >= 1:
					b.set_meta("anim", "")
					m.scale = Vector3.ONE
			"up":
				var k := minf(1, a / 0.95)
				var e := _ease_out_back(k)
				m.position.y = (1 - minf(1, k * 1.6)) * 1.6
				m.rotation.y = (1 - minf(1, k * 1.4)) * -PI * 1.6
				m.scale = Vector3.ONE * (0.6 + 0.4 * e)
				if k >= 1:
					b.set_meta("anim", "")
					m.position.y = 0
					m.rotation.y = 0
					m.scale = Vector3.ONE
			"crumble":
				var k := minf(1, a / 0.6)
				m.scale = Vector3(1 + k * 0.2, maxf(0.001, 1 - _ease_in_out(k)), 1 + k * 0.2)
				m.rotation.z = -k * 0.25
		var sh: float = b.get_meta("shake")
		if sh > 0 and now < sh:
			m.position.x = sin(now / 22.0) * 0.03
		elif sh > 0:
			m.position.x = 0
			b.set_meta("shake", 0.0)
		for n in b.find_children("*", "MeshInstance3D", true, false):
			if n.has_meta("beacon"):
				(n.material_override as StandardMaterial3D).emission_energy_multiplier = 6.0 if sin(t * 6) > 0 else 0.3
			elif n.has_meta("wave"):
				n.rotation.y = sin(t * 4 + b.position.x) * 0.35


# ======================= cổng FESTIVAL =======================
func _build_gate() -> Node3D:
	var g := Node3D.new()
	var wood := MeshUtil.std(Color("#b07a3e"), 0.6)
	var gold := MeshUtil.std(Color("#ffc531"), 0.3, 0.7)
	for x in [-0.44, 0.44]:
		g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.035, 0.045, 1.05, 10), wood, Vector3(x, 0.525, 0)))
		g.add_child(MeshUtil.mesh(MeshUtil.sphere(0.06, 14), gold, Vector3(x, 1.08, 0)))
		var pn := _owner_flag(Color("#ff4d6d"))
		pn.scale = Vector3.ONE * 0.55
		pn.position = Vector3(x, 1.08, 0)
		g.add_child(pn)
	# băng rôn cong màu xanh, chữ vàng
	var pm := PlaneMesh.new()
	pm.size = Vector2(0.98, 0.3)
	pm.orientation = PlaneMesh.FACE_Z
	pm.subdivide_width = 20
	var bm := ShaderMaterial.new()
	bm.shader = load("res://scripts/banner.gdshader")
	var ban := MeshUtil.mesh(pm, bm, Vector3(0, 0.86, 0))
	g.add_child(ban)
	g.set_meta("banner", ban)
	for side in [1, -1]:
		var l := Label3D.new()
		l.text = "FESTIVAL"
		l.font = font
		l.font_size = 64
		l.pixel_size = 0.0026
		l.modulate = Color("#ffe14d")
		l.outline_modulate = Color("#0a4f26")
		l.outline_size = 14
		l.position = Vector3(0, 0, 0.012 * side)
		l.rotation.y = 0.0 if side == 1 else PI
		l.render_priority = 3
		l.outline_render_priority = 2
		ban.add_child(l)
	var colors := ["#ff4d6d", "#ffb703", "#3a86ff", "#ff8c42", "#b15cff", "#06d6a0", "#ffd60a"]
	for k in 9:
		var x := -0.4 + k * 0.1
		var y := 0.66 - 0.06 * cos((x / 0.44) * PI / 2)
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for p in [Vector3(-0.035, 0, 0), Vector3(0.035, 0, 0), Vector3(0, -0.07, 0)]:
			st.set_normal(Vector3.BACK)
			st.add_vertex(p)
		var fm := StandardMaterial3D.new()
		fm.albedo_color = Color(colors[k % 7])
		fm.cull_mode = BaseMaterial3D.CULL_DISABLED
		var f := MeshUtil.mesh(st.commit(), fm, Vector3(x, y, 0.01))
		f.set_meta("bunt", k)
		g.add_child(f)
	return g


func set_fest_gates(list: Array, fresh := false) -> void:
	for i in gates.keys():
		if not (i in list):
			gates[i].queue_free()
			gates.erase(i)
	for i in list:
		if gates.has(i):
			continue
		var g := _build_gate()
		g.position = Board.tp(i, 0, 0.03, TH)
		g.rotation.y = Board.TILE[i].rot_y
		g.set_meta("t0", Time.get_ticks_msec() if fresh else 0)
		add_child(g)
		gates[i] = g


func _update_gates() -> void:
	var now := Time.get_ticks_msec()
	for g in gates.values():
		var t0: int = g.get_meta("t0")
		if t0:
			var k := minf(1, (now - t0) / 800.0)
			g.scale = Vector3(1, maxf(0.01, _ease_out_back(k)), 1)
			if k >= 1:
				g.set_meta("t0", 0)
		g.get_meta("banner").rotation.x = sin(t * 2 + g.position.x) * 0.06
		for o in g.get_children():
			if o.has_meta("bunt"):
				o.rotation.z = sin(t * 5 + o.get_meta("bunt")) * 0.25


# ======================= xúc xắc =======================
func dice_mat(key: String, n: int) -> ShaderMaterial:
	var id := "%s|%d" % [key, n]
	if dice_mats.has(id):
		return dice_mats[id]
	var S: Dictionary = DICE_SKINS.get(key, DICE_SKINS.classic)
	var m := ShaderMaterial.new()
	m.shader = load("res://scripts/dice_face.gdshader")
	m.set_shader_parameter("n", n)
	m.set_shader_parameter("bg0", Color(S.bg[0]))
	m.set_shader_parameter("bg1", Color(S.bg[1]))
	m.set_shader_parameter("pip0", Color(S.pip[0]))
	m.set_shader_parameter("pip1", Color(S.pip[1]))
	m.set_shader_parameter("red0", Color(S.red[0]))
	m.set_shader_parameter("red1", Color(S.red[1]))
	m.set_shader_parameter("ring_col", Color(S.ring) if S.has("ring") else Color(0, 0, 0, 0))
	m.set_shader_parameter("deco", S.get("deco", 0))
	m.set_shader_parameter("glow", S.get("glow", 0.0))
	m.set_shader_parameter("rough", S.rough)
	m.set_shader_parameter("metal", S.get("metal", 0.0))
	dice_mats[id] = m
	return m


func _die_node() -> Node3D:
	var d := Node3D.new()
	var body := MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.62, 0.62, 0.62), 0.1, 5), MeshUtil.std(Color.WHITE, 0.3))
	d.add_child(body)
	d.set_meta("body", body)
	var faces := []
	for k in 6:
		var q := QuadMesh.new()
		q.size = Vector2(0.5, 0.5)
		var f := MeshUtil.mesh(q, null, Vector3.ZERO, false)
		var dir: Vector3 = FACE_DIR[k]
		f.position = dir * 0.3105
		f.basis = Basis.looking_at(-dir, Vector3.UP if absf(dir.y) < 0.9 else Vector3.BACK)
		d.add_child(f)
		faces.append(f)
	d.set_meta("faces", faces)
	return d


func _build_dice() -> void:
	for x in [-0.42, 0.42]:
		var d := _die_node()
		d.position = Vector3(x, 0.32, 0)
		d.set_meta("home", d.position)
		add_child(d)
		dice.append(d)
	show_dice([5, 6])


func _skin_dice(key: String) -> void:
	var S: Dictionary = DICE_SKINS.get(key, DICE_SKINS.classic)
	var bc := Color(S.bg[1]).lerp(Color(S.bg[0]), 0.35)
	for d in dice:
		(d.get_meta("body") as MeshInstance3D).material_override = MeshUtil.std(bc, S.rough, S.get("metal", 0.0))
		var faces: Array = d.get_meta("faces")
		for k in 6:
			faces[k].material_override = dice_mat(key, FACE_N[k])


func skin_of(pid: int) -> String:
	if pid < 0 or pid >= tokens.size() or tokens[pid].mine:
		return my_skin
	var others := DICE_KEYS.filter(func(k): return k != my_skin)
	return others[(pid * 3 + 1) % others.size()]


func set_dice_skin(k: String) -> void:
	if not (k in DICE_KEYS):
		return
	my_skin = k
	show_dice(last_dice)


func _quat_for(n: int, yaw: float) -> Quaternion:
	var idx := FACE_N.find(n)
	var q := Quaternion(FACE_DIR[idx], Vector3.UP)
	return Quaternion(Vector3.UP, yaw) * q


func show_dice(d: Array) -> void:
	last_dice = d
	_skin_dice(skin_of(cur_pid))
	for k in 2:
		dice[k].quaternion = _quat_for(int(d[k]), PI / 4 + k * 0.3)
		dice[k].position = dice[k].get_meta("home")


## gieo xúc xắc (await)
func roll_dice(d: Array, dur := 1.0) -> void:
	_skin_dice(skin_of(cur_pid))
	var parts := []
	for k in 2:
		var m: Node3D = dice[k]
		var home: Vector3 = m.get_meta("home")
		parts.append({"m": m, "landed": false, "q1": _quat_for(int(d[k]), PI / 4 + k * 0.3 + randf_range(-0.2, 0.2)),
			"axis": Vector3(randf_range(-1, 1), randf_range(-0.3, 0.3), randf_range(-1, 1)).normalized(),
			"turns": randf_range(3, 5) * TAU, "home": home, "start": home + Vector3(randf_range(-0.6, 0.6), 0, randf_range(0.8, 1.4))})
	var el := 0.0
	while el < dur:
		await get_tree().process_frame
		el += get_process_delta_time()
		var k := minf(1.0, el / dur)
		var e := 1 - pow(1 - k, 3)
		for p in parts:
			var m: Node3D = p.m
			m.position = (p.start as Vector3).lerp(p.home, e)
			var b := 0.0
			if k < 0.55:
				b = sin(k / 0.55 * PI) * 1.5
			elif k < 0.82:
				b = sin((k - 0.55) / 0.27 * PI) * 0.35
			else:
				b = sin((k - 0.82) / 0.18 * PI) * 0.08
			m.position.y = p.home.y + b
			m.quaternion = Quaternion(p.axis, (1 - e) * p.turns) * p.q1
			if not p.landed and k > 0.5 and b < 0.04:
				p.landed = true
				puffs(Vector3(m.position.x, 0.05, m.position.z), 4)
	last_dice = d
	sparkle(Vector3(0, 0.5, 0), Color("#fff2b0"), 14)


func hide_dice(on: bool) -> void:
	for d in dice:
		d.visible = not on


# ======================= đánh dấu ô đích =======================
func _build_marker() -> void:
	marker = Node3D.new()
	marker.visible = false
	var tor := TorusMesh.new()
	tor.inner_radius = 0.38
	tor.outer_radius = 0.46
	tor.rings = 48
	var r := MeshUtil.mesh(tor, MeshUtil.emissive(Color("#ffd000"), Color("#ffb300"), 1.6), Vector3(0, 0.04, 0), false)
	r.scale = Vector3(1, 0.5, 1)
	marker.add_child(r)
	add_child(marker)


func set_target(i: int, label := "") -> void:
	if i < 0:
		marker.visible = false
		return
	marker.position = Board.tp(i, 0, 0.5, TH)
	if marker_label:
		marker_label.queue_free()
	marker_label = _label(label, 96, Color("#6a3b00"), Color("#ffd000"), 0.36)
	marker_label.position.y = 1.2
	marker.add_child(marker_label)
	marker.visible = true


# ======================= đống tiền giữa bàn =======================
func show_pile(amount: int) -> float:
	clear_pile()
	pile = Node3D.new()
	add_child(pile)
	var items := []
	if amount < 100:
		var P := [[0, 0], [0.42, -0.2], [-0.4, 0.22], [0.12, 0.45]]
		for k in mini(4, 1 + amount / 30):
			items.append(["kk/dun/coin_stack_small", 0.42, P[k][0], P[k][1]])
	elif amount < 600:
		var P := [[-0.3, -0.1], [0.32, 0.12], [0, 0.42], [-0.05, -0.45], [0.45, -0.38], [-0.48, 0.36]]
		for k in mini(6, maxi(2, roundi(amount / 90.0))):
			items.append(["kk/dun/coin_stack_medium" if k % 2 else "kk/dun/coin_stack_large", 0.5, P[k][0], P[k][1]])
	else:
		items.append(["kk/dun/chest_gold", 0.9, 0, -0.05])
		var P := [[0.62, 0.3], [-0.62, 0.32], [0.55, -0.5], [-0.5, -0.52]]
		for k in mini(4, 1 + amount / 500):
			items.append(["kk/dun/coin_stack_large", 0.48, P[k][0], P[k][1]])
	var top := 0.3
	for k in items.size():
		var it: Array = items[k]
		var m := MeshUtil.kit(it[0], it[1])
		if m == null:
			continue
		m.position = Vector3(it[2], 3, it[3])
		m.rotation.y = randf_range(-0.5, 0.5) + PI / 4
		pile.add_child(m)
		top = maxf(top, m.get_meta("height"))
		var delay := k * 0.09
		var el := [0.0]
		anims.append(func(dt):
			el[0] += dt
			var a: float = (el[0] - delay) / 0.42
			if a < 0:
				return true
			var k2 := minf(1, a)
			if not is_instance_valid(m):
				return false
			m.position.y = 3 * (1 - _ease_out_back(k2))
			if k2 >= 1:
				m.position.y = 0
				sparkle(Vector3(m.position.x, 0.2, m.position.z), Color("#ffe27a"), 6)
				return false
			return true)
	hide_dice(true)
	return top


func clear_pile() -> void:
	if pile:
		pile.queue_free()
		pile = null
	hide_dice(false)


# ======================= hiệu ứng =======================
func _spark_quad(size: float, additive := true) -> QuadMesh:
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	var m := StandardMaterial3D.new()
	m.albedo_texture = spark_tex
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if additive:
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.vertex_color_use_as_albedo = true
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.no_depth_test = false
	q.material = m
	return q


func _burst(pos: Vector3, color: Color, n: int, speed := Vector2(1.0, 2.2), life := 1.0, size := 0.14, gravity := -3.2, spread := 180.0, dir := Vector3.UP) -> void:
	var p := GPUParticles3D.new()
	p.one_shot = true
	p.amount = n
	p.lifetime = life
	p.explosiveness = 1.0
	var pm := ParticleProcessMaterial.new()
	pm.direction = dir
	pm.spread = spread
	pm.initial_velocity_min = speed.x
	pm.initial_velocity_max = speed.y
	pm.gravity = Vector3(0, gravity, 0)
	pm.damping_min = 0.5
	pm.damping_max = 1.5
	pm.scale_min = 0.6
	pm.scale_max = 1.2
	pm.color = color * 1.6
	var cr := Gradient.new()
	cr.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	var ct := GradientTexture1D.new()
	ct.gradient = cr
	pm.color_ramp = ct
	p.process_material = pm
	p.draw_pass_1 = _spark_quad(size)
	p.position = pos
	p.emitting = true
	add_child(p)
	get_tree().create_timer(life + 0.5).timeout.connect(p.queue_free)


func sparkle(pos: Vector3, color := Color("#fff2b0"), n := 14, up := 2.2) -> void:
	_burst(pos, color, n, Vector2(1.0, up), 1.0, 0.14, -3.2, 50.0)


func puffs(pos: Vector3, n: int) -> void:
	var p := GPUParticles3D.new()
	p.one_shot = true
	p.amount = n
	p.lifetime = 1.1
	p.explosiveness = 0.9
	var pm := ParticleProcessMaterial.new()
	pm.direction = Vector3.UP
	pm.spread = 70
	pm.initial_velocity_min = 0.3
	pm.initial_velocity_max = 0.7
	pm.gravity = Vector3.ZERO
	pm.scale_min = 1.0
	pm.scale_max = 1.6
	var sc := Curve.new()
	sc.add_point(Vector2(0, 0.3))
	sc.add_point(Vector2(1, 1.0))
	var sct := CurveTexture.new()
	sct.curve = sc
	pm.scale_curve = sct
	var cr := Gradient.new()
	cr.colors = PackedColorArray([Color(0.95, 0.91, 0.85, 0.9), Color(0.95, 0.91, 0.85, 0)])
	var ct := GradientTexture1D.new()
	ct.gradient = cr
	pm.color_ramp = ct
	p.process_material = pm
	p.draw_pass_1 = _spark_quad(0.4, false)
	p.position = pos
	p.emitting = true
	add_child(p)
	get_tree().create_timer(1.6).timeout.connect(p.queue_free)


func beam(pos: Vector3, color := Color("#ffd76a"), h := 3.2, life := 1.6) -> void:
	var c := MeshUtil.cyl(0.32, 0.32, h, 24)
	c.cap_top = false
	c.cap_bottom = false
	var m := ShaderMaterial.new()
	m.shader = load("res://scripts/beam.gdshader")
	m.set_shader_parameter("col", color)
	var mi := MeshUtil.mesh(c, m, pos + Vector3(0, h / 2, 0), false)
	add_child(mi)
	var el := [0.0]
	anims.append(func(dt):
		el[0] += dt
		var a: float = el[0] / life
		m.set_shader_parameter("alpha", a / 0.15 if a < 0.15 else maxf(0, 1 - (a - 0.15) / 0.85))
		var s := 1 + sin(a * PI) * 0.3
		mi.scale = Vector3(s, 1, s)
		mi.rotation.y += 0.02
		if a >= 1:
			mi.queue_free()
			return false
		return true)


const FW_COLORS := ["#ff4d6d", "#ffd60a", "#3a86ff", "#06d6a0", "#ff9f1c", "#b15cff", "#ffffff"]


func firework(pos: Vector3, delay := 0.0, color = null) -> void:
	var col := Color(color) if color != null else Color(FW_COLORS[randi() % FW_COLORS.size()])
	var top_y := pos.y + randf_range(2.4, 3.4)
	var rocket := MeshUtil.mesh(_spark_quad(0.18).duplicate(), null, pos, false)
	rocket.visible = false
	add_child(rocket)
	var el := [-delay]
	anims.append(func(dt):
		el[0] += dt
		if el[0] < 0:
			return true
		rocket.visible = true
		var k := minf(1, el[0] / 0.55)
		rocket.position.y = pos.y + (top_y - pos.y) * (1 - pow(1 - k, 3))
		if k >= 1:
			var c := rocket.position
			rocket.queue_free()
			_burst(c, col, 46, Vector2(1.6, 2.4), 1.4, 0.16, -1.2, 180.0)
			_burst(c, Color.WHITE, 10, Vector2(1.2, 2.0), 1.0, 0.12, -1.2, 180.0)
			var fl := OmniLight3D.new()
			fl.light_color = col
			fl.light_energy = 6
			fl.omni_range = 7
			fl.position = c
			add_child(fl)
			var fe := [0.0]
			anims.append(func(dt2):
				fe[0] += dt2
				fl.light_energy = 6 * maxf(0, 1 - fe[0] / 0.45)
				if fe[0] >= 0.45:
					fl.queue_free()
					return false
				return true)
			return false
		return true)


func fireworks(i: int) -> void:
	var p := Board.tp(i, 0, 0.5, TH)
	for k in 3:
		firework(p + Vector3(randf_range(-0.3, 0.3), 0, randf_range(-0.3, 0.3)), k * 0.26)
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
