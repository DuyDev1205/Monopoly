class_name Pieces2D
extends Node2D
## Vật thể trên bàn cờ (2D kết hợp SubViewport 3D thời gian thực cho xúc xắc):
## - 12 nhân vật chibi sưu tầm mới (360×360 siêu nét) đứng trên đế cờ mạ vàng tráng men, có hoạt ảnh mượt 60–144fps:
##   đứng thở đung đưa, nhảy bước lắc lư, bay vút, ăn mừng xoay vòng, giật mình toát mồ hôi, ngã choáng váng.
## - Sắp xếp chiều sâu tự động (Y-sort) giữa nhà cửa, cổng lễ hội và quân cờ — không bao giờ đè sai lớp.
## - 12 bộ xúc xắc 3D bo tròn liền khối, chấm lõm cầu phản sáng, lăn nảy 3D thật ở giữa sân.
## - Kho báu giữa sân bằng rương vàng, thỏi vàng & cọc tiền 3D.

const TH := 0.165
const SLOTS := [[0.0], [-0.21, 0.21], [-0.28, 0.0, 0.28], [-0.34, -0.11, 0.11, 0.34]]
const CORNER_SLOTS := [
	[[0.0, 0.62]],
	[[-0.25, 0.62], [0.25, 0.62]],
	[[-0.27, 0.50], [0.27, 0.50], [0.0, 0.78]],
	[[-0.27, 0.49], [0.27, 0.49], [-0.27, 0.78], [0.27, 0.78]],
]
const DICE_KEYS := Pieces.DICE_KEYS
const DICE_SKINS := Pieces.DICE_SKINS

## Quân cờ 3D trong SubViewport 256×256: tâm đáy (0,0,0) chiếu lên màn hình tại (128, 175.5)
const FRAME := 256
const FOOT := Vector2(128.0, 182.4)
const TOKEN_SC := 0.72
const TOKEN_CAM_SIZE := 1.92

## Bảng hình công trình (assets/build2d/houses.png)
const BFW := 300
const BFH := 375
const BCOLS := 8
const BANCHOR := Vector2(150, 275.8)
const BSCALE := 0.66
const BUP := 78.0
const BHEIGHT := [0.64, 0.48, 0.47, 0.50, 0.60, 0.67, 0.66, 0.60, 0.84, 0.80, 0.80, 1.07, 1.32]

## Hoà màu vật thể vào cảnh nền từng theme: [màu nắng, màu bóng, độ nâng vùng tối, độ tươi, màu viền sáng tách nền quân cờ]
const GRADE := {
	"sakura": ["#fff7fa", "#b89be4", 0.22, 1.03, "#fff8fc"],
	"wood": ["#fff4e6", "#d49a6a", 0.20, 1.03, "#fffaf0"],
	"ocean": ["#f8fcff", "#6daee0", 0.16, 1.04, "#ffffff"],
	"midnight": ["#dcdeff", "#5246c2", 0.28, 0.97, "#dcd8ff"],
	"cosmos": ["#e6f4ff", "#4f46e5", 0.26, 1.04, "#a5f3fc"],
}

var tokens: Array = []
var buildings: Array = []        # mỗi ô: {key, info, t0, anim, shake, burn, node} | null
var gates := {}                  # tile -> {t0, node}
var my_skin := "classic"
var active_dice_skin := "classic"
var cur_pid := 0
var last_dice := [5, 6]
var dice_hidden := false
var dice_rolling := false
var target := -1
var target_label := ""
var pile: Array = []
var pile_t := 0.0
var fx: Array = []
var punch := 0.0
var t := 0.0
var ready_at := 0

var font: Font = preload("res://assets/fonts/Montserrat-ExtraBold.ttf")
var blob: Texture2D
var theme := "ocean"
var grade_mat: ShaderMaterial
var token_shader: Shader = preload("res://scripts2d/token.gdshader")
var house_tex: Texture2D = preload("res://assets/build2d/houses.png")
var torii_tex: Texture2D = preload("res://assets/props2d/torii.png")
var torii_r_tex: Texture2D = preload("res://assets/props2d/torii_r.png")
var pile_coin_tex: Texture2D = preload("res://assets/props2d/pile_coin.png")
var pile_ingot_tex: Texture2D = preload("res://assets/props2d/pile_ingot.png")
var pile_chest_tex: Texture2D = preload("res://assets/props2d/pile_chest.png")
const GATE_SC := 0.50

var under_layer: Node2D
var dice_sp: Sprite2D
var ysort_layer: Node2D
var over_layer: Node2D

## Cụm xúc xắc 3D thời gian thực trong SubViewport khớp phép chiếu Iso
var dice_vp: SubViewport
var dice_env: Environment
var dice_key_light: DirectionalLight3D
var dice_nodes: Array = []       # 2 Node3D xúc xắc
var dice_mats := {}
const DICE_HOME := [Vector3(-0.38, 0.31, 0.14), Vector3(0.38, 0.31, -0.14)]
const DICE_PX_PER_UNIT := 90.50967   # 64 * sqrt(2) — khớp chính xác tỉ lệ ngang của Iso


func _ready() -> void:
	buildings.resize(32)
	blob = Painter.soft_blob(64, 0.12)
	grade_mat = ShaderMaterial.new()
	grade_mat.shader = load("res://scripts2d/grade.gdshader")

	under_layer = Node2D.new()
	under_layer.draw.connect(_draw_under)
	add_child(under_layer)

	_setup_dice_3d()

	ysort_layer = Node2D.new()
	ysort_layer.y_sort_enabled = true
	ysort_layer.material = grade_mat
	add_child(ysort_layer)

	over_layer = Node2D.new()
	over_layer.draw.connect(_draw_over)
	add_child(over_layer)

	set_theme(theme)
	show_dice(last_dice)
	z_index = 1


static func scr(w: Vector3) -> Vector2:
	return Iso.v(w)


func _apply_grade(m: ShaderMaterial) -> void:
	var G: Array = GRADE.get(theme, GRADE.ocean)
	m.set_shader_parameter("light", Color(G[0]))
	m.set_shader_parameter("shade", Color(G[1]))
	m.set_shader_parameter("lift", G[2])
	m.set_shader_parameter("sat", G[3])


func set_theme(name: String) -> void:
	theme = name
	if grade_mat == null:
		return
	_apply_grade(grade_mat)
	var G: Array = GRADE.get(theme, GRADE.ocean)
	for tk in tokens:
		tk.sp.material.set_shader_parameter("outline", Color(Color(G[4]), 0.78 if theme in ["midnight", "cosmos"] else 0.86))
		_apply_token_lighting(tk)
	if dice_env:
		var night := theme in ["midnight", "cosmos"]
		dice_env.ambient_light_color = Color(G[0]).lerp(Color(G[1]), 0.35)
		dice_env.ambient_light_energy = 0.46 if night else 0.58
		if dice_key_light:
			dice_key_light.light_color = Color("#dcd8ff") if night else Color("#fff6ea")
			dice_key_light.light_energy = 0.88 if night else 1.02
		_refresh_dice_vp_mode()


# ======================= Xúc xắc 3D trong SubViewport =======================
func _setup_dice_3d() -> void:
	dice_vp = SubViewport.new()
	dice_vp.size = Vector2i(520, 420)
	dice_vp.transparent_bg = true
	dice_vp.own_world_3d = true
	dice_vp.msaa_3d = Viewport.MSAA_4X
	dice_vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	add_child(dice_vp)

	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color("#dce6ff")
	sky_mat.sky_horizon_color = Color("#ffeaf2")
	sky_mat.ground_horizon_color = Color("#e8d4e4")
	sky_mat.ground_bottom_color = Color("#b89ec4")
	var sky := Sky.new()
	sky.sky_material = sky_mat

	dice_env = Environment.new()
	dice_env.background_mode = Environment.BG_SKY
	dice_env.sky = sky
	dice_env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	dice_env.ambient_light_sky_contribution = 0.65
	dice_env.ambient_light_energy = 0.58
	dice_env.tonemap_mode = Environment.TONE_MAPPER_AGX
	dice_env.tonemap_exposure = 1.0
	var we := WorldEnvironment.new()
	we.environment = dice_env
	dice_vp.add_child(we)

	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 420.0 / DICE_PX_PER_UNIT
	cam.near = 0.1
	cam.far = 50.0
	var aim := Vector3(0, 0.55, 0)
	dice_vp.add_child(cam)
	cam.look_at_from_position(aim + Vector3(1, 1, 1).normalized() * 14.0, aim, Vector3.UP)

	dice_key_light = DirectionalLight3D.new()
	dice_vp.add_child(dice_key_light)
	dice_key_light.look_at_from_position(Vector3(-0.75, 2.5, 1.7), Vector3.ZERO, Vector3.UP)
	dice_key_light.light_energy = 1.02
	dice_key_light.light_color = Color("#fff6ea")

	var rim := DirectionalLight3D.new()
	dice_vp.add_child(rim)
	rim.look_at_from_position(Vector3(1.5, 1.3, -1.6), Vector3.ZERO, Vector3.UP)
	rim.light_energy = 0.42
	rim.light_color = Color("#d8e6ff")

	for k in 2:
		var d := _make_die_3d()
		d.position = DICE_HOME[k]
		dice_vp.add_child(d)
		dice_nodes.append(d)

	dice_sp = Sprite2D.new()
	dice_sp.texture = dice_vp.get_texture()
	# Tâm khung nhìn vào y=0.55 -> gốc (0,0,0) nằm thấp hơn 0.55 * 0.8165 * 90.51 = 40.6 px
	dice_sp.position = Vector2(0, -40.6)
	var pm := CanvasItemMaterial.new()
	pm.blend_mode = CanvasItemMaterial.BLEND_MODE_PREMULT_ALPHA
	dice_sp.material = pm
	add_child(dice_sp)


func _make_die_3d() -> Node3D:
	var d := Node3D.new()
	var body := MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.62, 0.62, 0.62), 0.09, 6), MeshUtil.std(Color.WHITE, 0.3), Vector3.ZERO, false)
	d.add_child(body)
	d.set_meta("body", body)
	var faces := []
	for k in 6:
		var q := QuadMesh.new()
		q.size = Vector2(0.46, 0.46)
		var f := MeshUtil.mesh(q, null, Vector3.ZERO, false)
		var dir: Vector3 = Pieces.FACE_DIR[k]
		f.position = dir * 0.3106
		f.basis = Basis.looking_at(-dir, Vector3.UP if absf(dir.y) < 0.9 else Vector3.BACK)
		d.add_child(f)
		faces.append(f)
	d.set_meta("faces", faces)
	return d


func _dice_face_mat(key: String, n: int) -> ShaderMaterial:
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


func _refresh_dice_vp_mode() -> void:
	if dice_vp:
		var live := dice_rolling or (active_dice_skin == "cosmos" and not dice_hidden)
		dice_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS if live else SubViewport.UPDATE_ONCE


func _apply_dice_skin(key: String) -> void:
	active_dice_skin = key
	var m_body := Pieces.dice_body_mat(key)
	for d in dice_nodes:
		(d.get_meta("body") as MeshInstance3D).material_override = m_body
		var faces: Array = d.get_meta("faces")
		for k in 6:
			faces[k].material_override = _dice_face_mat(key, Pieces.FACE_N[k])
	_refresh_dice_vp_mode()


func _quat_for(n: int, yaw: float) -> Quaternion:
	var idx := Pieces.FACE_N.find(n)
	var q := Quaternion(Pieces.FACE_DIR[idx], Vector3.UP)
	return Quaternion(Vector3.UP, yaw) * q


func skin_of(pid: int) -> String:
	if pid < 0 or pid >= tokens.size() or tokens[pid].mine:
		return my_skin
	var others := DICE_KEYS.filter(func(k): return k != my_skin)
	return others[(pid * 3 + 1) % others.size()]


func set_dice_skin(k: String) -> void:
	if k in DICE_KEYS:
		my_skin = k
		show_dice(last_dice)


func show_dice(d: Array) -> void:
	last_dice = d
	if dice_nodes.is_empty():
		return
	_apply_dice_skin(skin_of(cur_pid))
	for k in 2:
		dice_nodes[k].position = DICE_HOME[k]
		dice_nodes[k].quaternion = _quat_for(int(d[k]), 0.18 + k * 0.34)
		dice_nodes[k].scale = Vector3.ONE
	_refresh_dice_vp_mode()


func _spawn_cosmic_trail(p3: Vector3, step_i: int) -> void:
	var sp := Iso.p(p3.x, p3.z, p3.y)
	var cols := ["#38f6ff", "#ff55c8", "#ffd166", "#ffffff"]
	fx.append({
		"kind": "star4", "p": sp + Vector2(randf_range(-10, 10), randf_range(-8, 8)),
		"v": Vector2(randf_range(-34, 34), randf_range(-42, -10)), "g": 20.0,
		"life": randf_range(0.32, 0.56), "age": 0.0,
		"col": Color(cols[step_i % cols.size()]), "s": randf_range(7.0, 13.0),
	})
	if step_i % 2 == 0:
		fx.append({
			"kind": "spark", "p": sp + Vector2(randf_range(-6, 6), randf_range(-6, 6)),
			"v": Vector2(randf_range(-24, 24), randf_range(-28, -4)), "g": 12.0,
			"life": randf_range(0.28, 0.45), "age": 0.0,
			"col": Color(cols[(step_i + 1) % cols.size()]), "s": randf_range(9.0, 15.0),
		})


func _spawn_shockwave(p3: Vector3, col: Color, r0 := 14.0, r1 := 82.0, life := 0.48) -> void:
	fx.append({"kind": "shock_ring", "p": scr(p3), "r0": r0, "r1": r1, "life": life, "age": 0.0, "col": col})


func roll_dice(d: Array, dur := 1.0) -> void:
	last_dice = d
	_apply_dice_skin(skin_of(cur_pid))
	dice_rolling = true
	_refresh_dice_vp_mode()
	var cosmic := active_dice_skin == "cosmos"
	var parts := []
	for k in 2:
		var home: Vector3 = DICE_HOME[k]
		var st_pos := home + Vector3(randf_range(-0.55, 0.55), 0.0, randf_range(0.75, 1.25))
		parts.append({
			"m": dice_nodes[k], "home": home, "start": st_pos, "bounced1": false, "bounced2": false,
			"q1": _quat_for(int(d[k]), 0.18 + k * 0.34 + randf_range(-0.18, 0.18)),
			"axis": Vector3(randf_range(-1, 1), randf_range(-0.4, 0.4), randf_range(-1, 1)).normalized(),
			"turns": randf_range(3.2, 4.8) * TAU,
		})
	var el := 0.0
	var tick := 0
	while el < dur:
		await get_tree().process_frame
		el += get_process_delta_time()
		tick += 1
		var k := minf(1.0, el / dur)
		var e := 1.0 - pow(1.0 - k, 3)
		for p in parts:
			var m: Node3D = p.m
			var xz: Vector3 = (p.start as Vector3).lerp(p.home, e)
			var b := 0.0
			var sq := 0.0
			if k < 0.54:
				b = sin(k / 0.54 * PI) * 1.48
			elif k < 0.80:
				b = sin((k - 0.54) / 0.26 * PI) * 0.42
				if not p.bounced1:
					p.bounced1 = true
					if cosmic:
						_spawn_shockwave(Vector3(xz.x, 0.04, xz.z), Color("#38f6ff"), 14.0, 82.0, 0.48)
						sparkle(Vector3(xz.x, 0.06, xz.z), Color("#7df9ff"), 10, 1.8)
					else:
						puffs(Vector3(xz.x, 0.04, xz.z), 3)
					sq = 1.0
			else:
				b = sin((k - 0.80) / 0.20 * PI) * 0.09
				if not p.bounced2:
					p.bounced2 = true
					if cosmic:
						_spawn_shockwave(Vector3(xz.x, 0.04, xz.z), Color("#ff55c8"), 10.0, 52.0, 0.38)
						sparkle(Vector3(xz.x, 0.06, xz.z), Color("#ffd166"), 7, 1.5)
					else:
						puffs(Vector3(xz.x, 0.04, xz.z), 2)
			m.position = Vector3(xz.x, p.home.y + b, xz.z)
			m.quaternion = Quaternion(p.axis, pow(1.0 - k, 1.7) * p.turns) * p.q1
			m.scale = Vector3(1.0 + 0.08 * sq, 1.0 - 0.10 * sq, 1.0 + 0.08 * sq)
			if cosmic and k < 0.94:
				_spawn_cosmic_trail(m.position, tick)
	for k in 2:
		dice_nodes[k].position = DICE_HOME[k]
		dice_nodes[k].scale = Vector3.ONE
	dice_rolling = false
	_refresh_dice_vp_mode()
	var double_roll := int(d[0]) == int(d[1])
	if cosmic:
		var burst_n := 28 if double_roll else 18
		for idx in burst_n:
			var ang := TAU * float(idx) / float(burst_n) + randf_range(-0.15, 0.15)
			var spd := randf_range(55.0, 155.0 if double_roll else 115.0)
			var bcols := ["#38f6ff", "#ff55c8", "#ffd166", "#ffffff"]
			fx.append({
				"kind": "star4" if idx % 2 == 0 else "spark",
				"p": scr(Vector3(0, 0.32, 0)) + Vector2(randf_range(-16, 16), randf_range(-8, 8)),
				"v": Vector2(cos(ang) * spd, sin(ang) * spd * 0.62 - 42.0), "g": 95.0,
				"life": randf_range(0.55, 0.95), "age": 0.0,
				"col": Color(bcols[idx % bcols.size()]), "s": randf_range(9.0, 16.0),
			})
		_spawn_shockwave(Vector3(0, 0.04, 0), Color("#ffd166") if double_roll else Color("#38f6ff"), 18.0, 115.0 if double_roll else 92.0, 0.56)
		if double_roll:
			beam(Vector3(DICE_HOME[0].x, 0.04, DICE_HOME[0].z), Color("#38f6ff"), 2.4, 1.1)
			beam(Vector3(DICE_HOME[1].x, 0.04, DICE_HOME[1].z), Color("#ff55c8"), 2.4, 1.1)
			_spawn_shockwave(Vector3(0, 0.04, 0), Color("#ff55c8"), 22.0, 138.0, 0.68)
			punch = maxf(punch, 0.06)
	else:
		sparkle(Vector3(0, 0.45, 0), Color("#ffe066") if double_roll else Color("#fff2b0"), 24 if double_roll else 14)
		if double_roll:
			punch = maxf(punch, 0.05)


func hide_dice(on: bool) -> void:
	dice_hidden = on
	if dice_sp:
		dice_sp.visible = not on
	_refresh_dice_vp_mode()


const TOKEN_LIGHTS := {
	"sakura": ["#fff7f0", 1.12, "#f6e8f2", 0.46, "#ffe6f2", 0.30, "#dce8ff", 0.52],
	"wood": ["#fff1de", 1.10, "#f5e4cd", 0.46, "#ffe8d0", 0.28, "#fff2dc", 0.46],
	"ocean": ["#f6fdff", 1.12, "#e0f4ff", 0.46, "#d2f2ff", 0.32, "#ffffff", 0.54],
	"midnight": ["#e2e4ff", 1.02, "#8a86db", 0.46, "#7a70e0", 0.34, "#b0c8ff", 0.66],
	"cosmos": ["#eaf6ff", 1.08, "#8b80f9", 0.48, "#38bdf8", 0.38, "#f472b6", 0.72],
}


func _apply_token_lighting(tk: Dictionary) -> void:
	if not tk.has("env"):
		return
	var L: Array = TOKEN_LIGHTS.get(theme, TOKEN_LIGHTS.ocean)
	var key: DirectionalLight3D = tk.key
	var env: Environment = tk.env
	var fill: DirectionalLight3D = tk.fill
	var rim: DirectionalLight3D = tk.rim
	key.light_color = Color(L[0])
	key.light_energy = L[1]
	env.ambient_light_color = Color(L[2])
	env.ambient_light_energy = L[3]
	fill.light_color = Color(L[4])
	fill.light_energy = L[5]
	rim.light_color = Color(L[6])
	rim.light_energy = L[7]


# ======================= Quân cờ 3D Monopoly thời gian thực =======================
func set_tokens(players: Array) -> void:
	for tk in tokens:
		if is_instance_valid(tk.node):
			tk.node.queue_free()
		if tk.has("vp") and is_instance_valid(tk.vp):
			tk.vp.queue_free()
	tokens.clear()
	ready_at = Time.get_ticks_msec()
	var G: Array = GRADE.get(theme, GRADE.ocean)
	for i in players.size():
		var p: Dictionary = players[i]
		var vp := SubViewport.new()
		vp.size = Vector2i(FRAME, FRAME)
		vp.transparent_bg = true
		vp.own_world_3d = true
		vp.msaa_3d = Viewport.MSAA_4X
		vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		add_child(vp)

		var sky_mat := ProceduralSkyMaterial.new()
		sky_mat.sky_top_color = Color("#eef4ff")
		sky_mat.sky_horizon_color = Color("#fff3f8")
		sky_mat.ground_horizon_color = Color("#ede0ec")
		sky_mat.ground_bottom_color = Color("#c8b2d2")
		var sky := Sky.new()
		sky.sky_material = sky_mat
		var env := Environment.new()
		env.background_mode = Environment.BG_SKY
		env.sky = sky
		env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
		env.ambient_light_sky_contribution = 0.70
		env.ambient_light_energy = 0.62
		env.tonemap_mode = Environment.TONE_MAPPER_AGX
		env.tonemap_exposure = 0.98
		var we := WorldEnvironment.new()
		we.environment = env
		vp.add_child(we)

		var cam := Camera3D.new()
		cam.projection = Camera3D.PROJECTION_ORTHOGONAL
		cam.size = TOKEN_CAM_SIZE
		cam.near = 0.1
		cam.far = 40.0
		var aim := Vector3(0, 0.50, 0)
		vp.add_child(cam)
		cam.look_at_from_position(aim + Vector3(1, 1, 1).normalized() * 14.0, aim, Vector3.UP)

		var key := DirectionalLight3D.new()
		vp.add_child(key)
		key.look_at_from_position(Vector3(-0.75, 2.5, 1.75), Vector3.ZERO, Vector3.UP)
		key.shadow_enabled = false

		var fill := DirectionalLight3D.new()
		vp.add_child(fill)
		fill.look_at_from_position(Vector3(1.4, 0.6, 1.4), Vector3.ZERO, Vector3.UP)
		fill.shadow_enabled = false

		var rim := DirectionalLight3D.new()
		vp.add_child(rim)
		rim.look_at_from_position(Vector3(1.5, 1.4, -1.7), Vector3.ZERO, Vector3.UP)
		rim.shadow_enabled = false

		var rig := TokenModels.build(int(p.get("char", 0)))
		(rig.root as Node3D).rotation.y = PI * 0.18
		vp.add_child(rig.root)

		var n := Node2D.new()
		var ped := Node2D.new()
		ped.use_parent_material = true
		n.add_child(ped)

		var sp := Sprite2D.new()
		sp.texture = vp.get_texture()
		sp.centered = false
		sp.offset = -FOOT
		sp.scale = Vector2.ONE * TOKEN_SC
		sp.position = Vector2(0, -9)
		sp.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		var m := ShaderMaterial.new()
		m.shader = token_shader
		m.set_shader_parameter("outline", Color(Color(G[4]), 0.78 if theme in ["midnight", "cosmos"] else 0.86))
		sp.material = m
		n.add_child(sp)
		ysort_layer.add_child(n)

		var tk := {
			"id": i, "node": n, "ped": ped, "sp": sp, "mat": m,
			"vp": vp, "rig": rig, "env": env, "key": key, "fill": fill, "rim": rim,
			"color": Color(p.color), "mine": p.get("mine", false), "pos": Vector2.ZERO,
			"from": null, "to": null, "t0": 0, "dur": 0.0, "arc": 0.0, "cur": false,
			"emote": "", "et": 99.0, "out": false, "anim": "idle", "at": randf() * 3.0,
			"fly": false, "lift": 0.0, "land": 9.0, "yaw": PI * 0.18, "target_yaw": PI * 0.18,
		}
		_apply_token_lighting(tk)
		ped.draw.connect(_draw_token_pedestal.bind(ped, tk))
		tokens.append(tk)


func slot_pos(tile: int, k: int, n: int) -> Vector2:
	var m := clampi(n, 1, 4)
	if tile % 8 == 0:
		var carr: Array = CORNER_SLOTS[m - 1]
		var pt: Array = carr[k] if k < carr.size() else [0.0, 0.62]
		return scr(Board.tp(tile, pt[0], pt[1], TH))
	var arr: Array = SLOTS[m - 1]
	var a: float = arr[k] if k < arr.size() else 0.0
	return scr(Board.tp(tile, a, 0.72, TH))


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
		tk.node.position = target_p
		if place.tile != 0:
			var dx := 0.5 * (target_p.x / Iso.A + target_p.y / Iso.B)
			var dz := 0.5 * (target_p.y / Iso.B - target_p.x / Iso.A)
			var s_idx := int(place.tile / 8)
			var edge_yaws := [-PI * 0.5, PI, PI * 0.5, 0.0]
			tk.target_yaw = edge_yaws[posmod(s_idx, 4)] if place.tile % 8 != 0 else atan2(dx, dz) + PI * 0.5
			tk.yaw = tk.target_yaw
			(tk.rig.root as Node3D).rotation.y = tk.yaw
		else:
			tk.target_yaw = PI * 0.18
			tk.yaw = PI * 0.18
			(tk.rig.root as Node3D).rotation.y = tk.yaw
		return
	tk.from = tk.pos
	tk.to = target_p
	tk.t0 = Time.get_ticks_msec()
	tk.dur = dur
	tk.arc = opt.get("arc", 0.35) * 72.0
	tk.fly = opt.get("arc", 0.35) > 1.0
	var dv := target_p - (tk.pos as Vector2)
	if dv.length() > 2.0:
		var dx := 0.5 * (dv.x / Iso.A + dv.y / Iso.B)
		var dz := 0.5 * (dv.y / Iso.B - dv.x / Iso.A)
		tk.target_yaw = atan2(dx, dz)
	tk.anim = "jump" if tk.fly else "walk"
	tk.at = 0.0


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
	if e == "victory":
		var p: Vector2 = tk.pos
		for k in 10:
			var a := randf() * TAU
			fx.append({"kind": "spark", "p": p + Vector2(0, -52), "v": Vector2(cos(a) * randf_range(40, 95), sin(a) * randf_range(30, 80) - 70),
				"g": 150.0, "life": randf_range(0.6, 1.0), "age": 0.0, "col": Color("#ffe066"), "s": randf_range(11, 18)})


func _draw_token_pedestal(ci: CanvasItem, tk: Dictionary) -> void:
	var col: Color = tk.color
	var up: float = clampf(tk.lift / 140.0, 0.0, 1.0)
	var gold := Color("#f5c85b")

	# Vòng hào quang xoay cho người đang tới lượt
	if tk.cur:
		var g := 0.5 + 0.5 * sin(t * 5.0)
		ci.draw_texture_rect(blob, Rect2(Vector2(-56, -32) * (1.0 + 0.08 * g), Vector2(112, 64) * (1.0 + 0.08 * g)),
			false, Color(col.lightened(0.35), 0.50 + 0.22 * g))
		ci.draw_set_transform(Vector2(0, -3), 0.0, Vector2(0.92, 0.50))
		var r_halo := 36.0 + 2.5 * g
		ci.draw_arc(Vector2.ZERO, r_halo, 0.0, TAU, 44, Color(gold.lightened(0.25), 0.85), 2.8, true)
		for d_i in 6:
			var ha := t * 1.8 + TAU * d_i / 6.0
			ci.draw_circle(Vector2(cos(ha), sin(ha)) * r_halo, 3.2, Color.WHITE)
		ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

	# Đế cờ 3 tầng tráng men viền vàng kim
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2(0.84, 0.46))
	# Bóng đổ trên mặt ô
	ci.draw_circle(Vector2(2, 9), 32.0, Color(0.18, 0.06, 0.20, 0.28))
	# Tầng chân mạ vàng sẫm -> thân màu người chơi -> vành vàng trên -> đĩa tráng men bóng
	ci.draw_circle(Vector2(0, 5), 29.5, gold.darkened(0.38))
	ci.draw_circle(Vector2(0, 2), 29.5, col.darkened(0.38))
	ci.draw_circle(Vector2(0, -3), 28.5, col.darkened(0.14))
	ci.draw_circle(Vector2(0, -7.5), 28.5, gold.lightened(0.12))
	ci.draw_circle(Vector2(0, -8.5), 25.5, col)
	ci.draw_circle(Vector2(-2, -10), 19.5, col.lightened(0.22))
	ci.draw_arc(Vector2(0, -8.5), 25.5, PI * 1.05, PI * 1.65, 16, Color(1, 1, 1, 0.80), 2.6, true)
	# Bóng chân nhân vật trên mặt đế (nhỏ mờ dần khi nhảy cao)
	ci.draw_circle(Vector2(0, -8.5), 14.5 * (1.0 - 0.52 * up), Color(0.14, 0.04, 0.18, 0.32 * (1.0 - 0.65 * up)))
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


# ======================= Nhà / công trình & cổng lễ hội (Y-sorted) =======================
func building_key(i: int) -> String:
	var b = buildings[i]
	return b.key if b else ""


func set_building(i: int, info) -> Dictionary:
	var key := "" if info == null else "%d|%d|%d" % [info.owner, info.lvl, info.get("festMult", 0)]
	var prev := building_key(i)
	if prev == key:
		return {"prev": prev}
	var pk := prev.split("|")
	if buildings[i] != null and is_instance_valid(buildings[i].node):
		buildings[i].node.queue_free()
	if info == null:
		buildings[i] = null
		return {"prev": prev}
	var same := pk.size() > 1 and pk[0] == str(info.owner) and pk[1] == str(info.lvl)
	var up := pk.size() > 1 and pk[0] == str(info.owner) and int(pk[1]) < int(info.lvl)
	var n := Node2D.new()
	n.use_parent_material = true
	n.position = scr(Board.tp(i, 0, 0.28 if info.type == "resort" else 0.25, TH))
	ysort_layer.add_child(n)
	var rec := {"key": key, "info": info, "t0": Time.get_ticks_msec() if not same else 0,
		"anim": "up" if up else "grow", "shake": 0, "burn": false, "node": n}
	n.draw.connect(_draw_building_node.bind(n, i, rec))
	buildings[i] = rec
	if not same and Time.get_ticks_msec() - ready_at > 1500:
		var lv: int = 1 if info.type == "resort" else int(info.lvl)
		get_tree().create_timer(0.35).timeout.connect(func(): build_fx(Board.tp(i, 0, 0.27, TH), lv))
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
	var p := scr(Board.tp(i, 0, 0.27, TH))
	for k in 16:
		fx.append({"kind": "chip", "p": p + Vector2(randf_range(-20, 20), randf_range(-40, -10)),
			"v": Vector2(randf_range(-160, 160), randf_range(-320, -160)),
			"life": 1.3, "age": 0.0, "col": Color(["#c9a77a", "#8a7a70", "#e9d9b8", "#b05a3a"][k % 4]),
			"s": randf_range(4, 8), "ground": p.y})
	puffs(Board.tp(i, 0, 0.27, TH), 8)


func set_fest_gates(list: Array, fresh := false) -> void:
	for i in gates.keys():
		if not (i in list):
			if is_instance_valid(gates[i].node):
				gates[i].node.queue_free()
			gates.erase(i)
	for i in list:
		if not gates.has(i):
			var n := Node2D.new()
			n.use_parent_material = true
			n.position = scr(Board.tp(i, 0, 0.05, TH))
			ysort_layer.add_child(n)
			var g := {"t0": Time.get_ticks_msec() if fresh else 0, "node": n}
			n.draw.connect(_draw_gate_node.bind(n, i, g))
			gates[i] = g


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


func _flag(ci: CanvasItem, fp: Vector2, col: Color, h: float, ph: float) -> void:
	ci.draw_line(fp, fp + Vector2(0, -h), Color("#5b4630"), 2.5, true)
	ci.draw_circle(fp + Vector2(0, -h), 2.6, Color("#ffd98a"))
	var wv := sin(t * 4.0 + ph) * 3.8
	var top := fp + Vector2(0, -h + 2)
	ci.draw_colored_polygon(PackedVector2Array([top, top + Vector2(20, 6 + wv), top + Vector2(0, 14)]), col)
	ci.draw_polyline(PackedVector2Array([top, top + Vector2(20, 6 + wv), top + Vector2(0, 14)]), col.darkened(0.3), 1.2, true)


func _draw_building_node(ci: CanvasItem, i: int, b: Dictionary) -> void:
	var now := Time.get_ticks_msec()
	var info: Dictionary = b.info
	var T: Dictionary = Board.TILE[i]
	var col := Color(info.color)
	var a: float = (now - b.t0) / 1000.0 if b.t0 else 9.0
	var sy := 1.0
	var sx := 1.0
	var off := Vector2.ZERO
	match b.anim:
		"grow":
			var k := minf(1.0, a / 0.75)
			sy = maxf(0.02, (pow(2, -10 * k) * sin((k * 10 - 0.75) * TAU / 3) + 1) if k > 0 and k < 1 else k)
		"up":
			var k := minf(1.0, a / 0.95)
			off.y -= (1.0 - minf(1.0, k * 1.6)) * 80.0
			var q := clampf((k - 0.62) / 0.38, 0.0, 1.0)
			sy = 1.0 - 0.14 * sin(q * PI) * (1.0 - q)
			sx = 1.0 + 0.10 * sin(q * PI) * (1.0 - q)
		"crumble":
			var k := minf(1.0, a / 0.6)
			sy = maxf(0.01, 1.0 - k)
			sx = 1.0 + k * 0.2
	if b.shake and now < b.shake:
		off.x += sin(now / 22.0) * 3.0

	var lvl: int = int(info.lvl)
	var resort: bool = info.type == "resort"
	var flip := -1.0 if (T.side == "l" or T.side == "r") else 1.0
	var hgt := 0.0

	if resort or lvl >= 1:
		var m := build_model(info, i)
		hgt = BHEIGHT[m]
		var ci_idx := maxi(0, Data.PLAYER_COLORS.find("#" + col.to_html(false)))
		if ci_idx == 0 and info.has("owner") and Color(Data.PLAYER_COLORS[0]) != col:
			ci_idx = posmod(int(info.owner), 4)
		var idx := m * 4 + ci_idx
		ci.draw_texture_rect(blob, Rect2(off + Vector2(-58 + 7 * flip, -26), Vector2(116, 62)), false, Color(0.2, 0.08, 0.22, 0.28))
		ci.draw_set_transform(off, 0.0, Vector2(sx * flip, sy))
		ci.draw_texture_rect_region(house_tex, Rect2(-BANCHOR * BSCALE, Vector2(BFW, BFH) * BSCALE),
			Rect2((idx % BCOLS) * BFW, (idx / BCOLS) * BFH, BFW, BFH))
	else:
		ci.draw_set_transform(off, 0.0, Vector2(sx * flip, sy))

	if resort:
		_flag(ci, Iso.p(0.28, -0.15, 0.0) + Vector2(0, -4), col, 32, i)
	elif lvl == 0:
		ci.draw_set_transform(off + Vector2(0, 4), 0.0, Vector2(sx, 0.55 * sy))
		ci.draw_circle(Vector2.ZERO, 10.5, Color(0.2, 0.08, 0.22, 0.22))
		ci.draw_circle(Vector2(0, -3), 7.2, col.darkened(0.15))
		ci.draw_set_transform(off, 0.0, Vector2(sx, sy))
		_flag(ci, Vector2(0, 2), col, 46, i)
	elif lvl < 4:
		_flag(ci, Iso.p(0.32, -0.20, 0.0) + Vector2(0, -5), col, 38, i)
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

	if b.burn:
		for k in 6:
			var fp := off + Vector2(randf_range(-20, 20), randf_range(-14 - hgt * BUP * 0.8, -8))
			var fs := randf_range(18, 30)
			ci.draw_texture_rect(blob, Rect2(fp - Vector2(fs, fs * 1.3) * 0.5, Vector2(fs, fs * 1.3)),
				false, Color(1.0, randf_range(0.4, 0.7), 0.1, 0.8))


func _draw_gate_node(ci: CanvasItem, i: int, g: Dictionary) -> void:
	var now := Time.get_ticks_msec()
	var t0: int = g.t0
	var k := 1.0 if t0 == 0 else minf(1.0, (now - t0) / 800.0)
	var e := 1.0 - pow(1.0 - k, 3) + sin(k * PI) * 0.08
	var T: Dictionary = Board.TILE[i]
	var tex: Texture2D = torii_r_tex if (T.side == "l" or T.side == "r") else torii_tex
	var base := scr(Board.tp(i, 0, 0.05, TH))
	var sz := Vector2(tex.get_size()) * GATE_SC
	var anc := Vector2(tex.get_width() * 0.5, tex.get_height() * 0.88) * GATE_SC
	var H := 1.38 * 118.0 * GATE_SC
	ci.draw_texture_rect(blob, Rect2(Vector2(-sz.x * 0.35, -12), Vector2(sz.x * 0.70, 25)), false, Color(0.2, 0.08, 0.22, 0.24 * minf(1.0, k * 2.0)))
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2(1.0, maxf(0.02, e)))
	ci.draw_texture_rect(tex, Rect2(-anc, sz), false)

	var a := scr(Board.tp(i, -0.28, 0.05, TH)) - base
	var b := scr(Board.tp(i, 0.28, 0.05, TH)) - base
	var cols := ["#ff4d6d", "#ffb703", "#3a86ff", "#ff8c42", "#b15cff", "#06d6a0", "#ffd60a"]
	var rope := PackedVector2Array()
	for j2 in 13:
		var u := j2 / 12.0
		rope.append(a.lerp(b, u) + Vector2(0, -H * 0.52 + sin(u * PI) * 6.5))
	ci.draw_polyline(rope, Color("#6a4a3a"), 1.2, true)
	for j2 in 7:
		var u := (j2 + 0.5) / 7.0
		var p := a.lerp(b, u) + Vector2(0, -H * 0.52 + sin(u * PI) * 6.5)
		var sw := sin(t * 5.0 + j2 + i) * 2.4
		ci.draw_colored_polygon(PackedVector2Array([p + Vector2(-4.2, 0), p + Vector2(4.2, 0), p + Vector2(sw, 10.5)]), Color(cols[j2 % 7]))

	var pc := (a + b) * 0.5 + Vector2(0, -H * 0.80)
	var txt := "LỄ HỘI"
	var w := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x + 12
	ci.draw_rect(Rect2(pc - Vector2(w * 0.5, 7) + Vector2(0, 1.5), Vector2(w, 14)), Color("#0f2454"))
	ci.draw_rect(Rect2(pc - Vector2(w * 0.5, 7), Vector2(w, 14)), Color("#c81e4b"))
	ci.draw_rect(Rect2(pc - Vector2(w * 0.5, 7), Vector2(w, 14)), Color("#ffd154"), false, 1.5)
	ci.draw_string(font, pc + Vector2(-w * 0.5 + 6, 4), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#fff7d6"))
	ci.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


# ======================= Đánh dấu ô đích & Kho báu giữa sân =======================
func set_target(i: int, label := "") -> void:
	target = i
	target_label = label


func show_pile(amount: int) -> float:
	pile.clear()
	pile_t = 0.0
	if amount >= 500:
		pile.append({"tex": pile_chest_tex, "p": Vector2(0, -4), "d": 0.0, "sc": 0.72})
		var n_side := clampi(amount / 300, 2, 4)
		for k in n_side:
			var a := TAU * k / n_side + 0.5
			pile.append({"tex": pile_ingot_tex if k % 2 == 0 else pile_coin_tex,
				"p": Vector2(cos(a) * 44, sin(a) * 24 + 4), "d": 0.08 * (k + 1), "sc": 0.68})
	else:
		var n := clampi(2 + amount / 70, 2, 6)
		for k in n:
			var a := TAU * k / n + 0.35
			var r := 0.0 if k == 0 else 30.0
			pile.append({"tex": pile_ingot_tex if (amount >= 180 and k % 2 == 0) else pile_coin_tex,
				"p": Vector2(cos(a) * r, sin(a) * r * 0.56), "d": k * 0.07, "sc": 0.72})
	hide_dice(true)
	return 0.6


func clear_pile() -> void:
	pile.clear()
	hide_dice(false)


# ======================= Hiệu ứng hạt & pháo hoa =======================
func sparkle(pos: Vector3, color := Color("#fff2b0"), n := 14, up := 2.2) -> void:
	var p := scr(pos)
	for k in n:
		fx.append({"kind": "spark", "p": p + Vector2(randf_range(-10, 10), 0),
			"v": Vector2(randf_range(-72, 72), randf_range(-165, -65) * up / 2.2),
			"g": 160.0, "life": randf_range(0.7, 1.2), "age": 0.0, "col": color, "s": randf_range(10, 18)})


func puffs(pos: Vector3, n: int) -> void:
	var p := scr(pos)
	for k in n:
		fx.append({"kind": "puff", "p": p + Vector2(randf_range(-22, 22), randf_range(-5, 5)),
			"v": Vector2(randf_range(-28, 28), randf_range(-38, -14)),
			"g": 0.0, "life": 0.95, "age": 0.0, "col": Color(0.98, 0.94, 0.96), "s": randf_range(16, 26)})


func beam(pos: Vector3, color := Color("#ffd76a"), h := 3.2, life := 1.6) -> void:
	fx.append({"kind": "beam", "p": scr(pos), "life": life, "age": 0.0, "col": color, "h": h * Iso.HS})


func firework(pos: Vector3, delay := 0.0, color = null) -> void:
	var col := Color(color) if color != null else Color(Pieces.FW_COLORS[randi() % Pieces.FW_COLORS.size()])
	fx.append({"kind": "rocket", "p": scr(pos), "top": scr(pos) + Vector2(randf_range(-30, 30), -randf_range(150, 220)),
		"life": 0.55, "age": -delay, "col": col})


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


# ======================= Cập nhật khung hình =======================
func _process(dt: float) -> void:
	t += dt
	punch = maxf(0.0, punch - dt * 0.3)
	pile_t += dt
	var now := Time.get_ticks_msec()

	for tk in tokens:
		tk.land += dt
		tk.et += dt
		tk.at += dt
		var sx := 1.0
		var sy := 1.0
		var flash := Color(1, 1, 1, 0)
		var off_x := 0.0
		var state_3d := "idle"
		var anim_prog := 0.0

		if tk.from != null:
			var k := minf(1.0, (now - tk.t0) / maxf(tk.dur, 1.0))
			var e := 2.0 * k * k if k < 0.5 else 1.0 - pow(-2.0 * k + 2.0, 2) * 0.5
			tk.pos = (tk.from as Vector2).lerp(tk.to, e)
			anim_prog = k
			if tk.fly:
				state_3d = "jump"
				tk.lift = sin(k * PI) * tk.arc
				var stretch := sin(k * PI) * 0.10
				sx = 1.0 - stretch * 0.45
				sy = 1.0 + stretch
			else:
				state_3d = "walk"
				var hop := sin(k * PI)
				tk.lift = hop * tk.arc
				sx = 1.0 + 0.05 * cos(k * PI * 2.0) * 0.5
				sy = 1.0 + 0.07 * hop - 0.04 * (1.0 - hop)
			if k >= 1.0:
				tk.from = null
				tk.lift = 0.0
				tk.land = 0.0
				if tk.fly:
					for q in 6:
						var a := randf() * TAU
						fx.append({"kind": "puff", "p": (tk.pos as Vector2) + Vector2(cos(a) * 14, sin(a) * 6),
							"v": Vector2(cos(a) * 46, sin(a) * 18 - 8), "life": 0.45, "age": 0.0,
							"col": Color(1, 1, 1, 0.85), "s": randf_range(14, 22)})
				tk.anim = {"victory": "cheer", "shock": "hit", "out": "die"}.get(tk.emote, "idle") if tk.et < 0.35 else "idle"
				tk.at = 0.0
		else:
			match tk.anim:
				"cheer":
					var u: float = float(tk.at) / 1.25
					if u >= 1.0:
						tk.anim = "idle"
						tk.at = 0.0
					else:
						state_3d = "cheer"
						anim_prog = u
						var bounce: float = absf(sin(u * PI * 3.0)) * (1.0 - u * 0.35)
						tk.lift = bounce * 22.0
						flash = Color(1.0, 0.92, 0.55, 0.24 * sin(u * PI))
				"hit":
					var u: float = float(tk.at) / 0.78
					if u >= 1.0:
						tk.anim = "idle"
						tk.at = 0.0
					else:
						state_3d = "hit"
						anim_prog = u
						var decay: float = 1.0 - u
						tk.lift = sin(minf(u * 3.2, 1.0) * PI) * 10.0 * decay
						off_x = sin(u * 52.0) * 5.0 * decay
						flash = Color(1.0, 0.42, 0.52, 0.36 * decay)
				"die":
					state_3d = "die"
					anim_prog = minf(1.0, float(tk.at) / 0.85)
					tk.lift = sin(minf(anim_prog * 2.0, 1.0) * PI) * 12.0 * (1.0 - anim_prog)
				_:
					state_3d = "idle"
					tk.lift = absf(sin(float(tk.at) * 3.2)) * 3.0 if tk.cur else 0.0

		tk.yaw = lerp_angle(tk.yaw, tk.target_yaw, 1.0 - exp(-dt * 12.0))
		(tk.rig.root as Node3D).rotation.y = tk.yaw
		TokenModels.animate(tk.rig, float(tk.at), state_3d, anim_prog, 1.0, tk.cur, dt)

		# Nhún đàn hồi lúc vừa tiếp đất
		var land_sq := maxf(0.0, 1.0 - tk.land / 0.22)
		sx *= 1.0 + 0.11 * land_sq
		sy *= 1.0 - 0.13 * land_sq

		(tk.mat as ShaderMaterial).set_shader_parameter("flash_col", flash)

		tk.sp.scale = Vector2(TOKEN_SC * sx, TOKEN_SC * sy)
		tk.sp.rotation = 0.0
		tk.sp.position = Vector2(off_x, -9.0 - tk.lift)
		tk.node.position = tk.pos
		tk.ped.queue_redraw()

	for b in buildings:
		if b != null and is_instance_valid(b.node):
			b.node.queue_redraw()
	for g in gates.values():
		if is_instance_valid(g.node):
			g.node.queue_redraw()

	var keep: Array = []
	for f in fx:
		f.age += dt
		if f.kind in ["spark", "puff", "chip", "star4"]:
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
				fx.append({"kind": "spark", "p": f.top, "v": Vector2(cos(a), sin(a)) * sp, "g": 60.0,
					"life": randf_range(1.0, 1.5), "age": 0.0, "col": Color.WHITE if k % 5 == 0 else f.col,
					"s": randf_range(12, 20)})
			continue
		if f.age < f.life:
			keep.append(f)
	fx = keep

	under_layer.queue_redraw()
	over_layer.queue_redraw()


# ======================= Lớp bóng dưới xúc xắc & Kho báu =======================
func _draw_under() -> void:
	if not dice_hidden and dice_nodes.size() == 2:
		var cosmic := active_dice_skin == "cosmos"
		for k in 2:
			var p3: Vector3 = dice_nodes[k].position
			var h := maxf(0.0, p3.y - 0.31)
			var shrink := clampf(1.0 - h * 0.42, 0.38, 1.0)
			var alpha := 0.28 * shrink
			var sp := Iso.p(p3.x, p3.z, 0.015)
			under_layer.draw_set_transform(sp, 0.0, Vector2(1.0, 0.56))
			under_layer.draw_circle(Vector2.ZERO, 30.0 * shrink, Color(0.16, 0.06, 0.22, alpha))
			if cosmic:
				# Cổng năng lượng xoáy tinh vân & vòng quỹ đạo xoay ngược chiều dưới mỗi viên xí ngầu
				var pulse := 0.78 + 0.22 * sin(t * 4.2 + float(k) * 1.9)
				under_layer.draw_texture_rect(blob, Rect2(Vector2(-46, -46) * shrink, Vector2(92, 92) * shrink),
					false, Color(0.18, 0.88, 1.0, 0.34 * shrink * pulse))
				under_layer.draw_texture_rect(blob, Rect2(Vector2(-30, -30) * shrink, Vector2(60, 60) * shrink),
					false, Color(0.95, 0.30, 0.85, 0.28 * shrink * pulse))
				var a0 := t * 2.2 + float(k) * PI
				for arc_i in 3:
					var sa := a0 + float(arc_i) * (TAU / 3.0)
					under_layer.draw_arc(Vector2.ZERO, 34.0 * shrink, sa, sa + 1.45, 18, Color(0.22, 0.96, 1.0, 0.86 * shrink), 2.2, true)
				var a1 := -t * 1.65 + float(k) * 1.2
				for arc_i in 2:
					var sa := a1 + float(arc_i) * PI
					under_layer.draw_arc(Vector2.ZERO, 24.5 * shrink, sa, sa + 2.0, 16, Color(1.0, 0.82, 0.42, 0.80 * shrink), 1.8, true)
				for s_i in 4:
					var sa := a0 * 1.15 + float(s_i) * (PI * 0.5)
					under_layer.draw_circle(Vector2(cos(sa), sin(sa)) * (38.0 * shrink), 2.8 * shrink, Color(0.88, 0.98, 1.0, 0.92 * shrink))
		under_layer.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)


func _draw_pill(ci: CanvasItem, center: Vector2, text: String, bg: Color, border: Color, fg: Color, fsz := 12, pad_x := 10.0, h := 20.0) -> void:
	var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fsz).x + pad_x * 2.0
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(int(h * 0.5))
	sb.shadow_color = Color(0.1, 0.03, 0.14, 0.28)
	sb.shadow_size = 4
	sb.shadow_offset = Vector2(0, 2)
	ci.draw_style_box(sb, Rect2(center - Vector2(w * 0.5, h * 0.5), Vector2(w, h)))
	ci.draw_string(font, center + Vector2(-w * 0.5 + pad_x, fsz * 0.38), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fsz, fg)


# ======================= Lớp hiệu ứng, biển báo, vương miện lượt & biểu cảm =======================
func _draw_over() -> void:
	# 1. Kho báu giữa sân (rương vàng, thỏi vàng, cọc tiền 3D)
	for k in pile.size():
		var c: Dictionary = pile[k]
		var a := clampf((pile_t - c.d) / 0.42, 0.0, 1.0)
		if a <= 0.0:
			continue
		var e := 1.0 + 2.7 * pow(a - 1.0, 3) + 1.7 * pow(a - 1.0, 2)
		var tex: Texture2D = c.tex
		var sz := Vector2(tex.get_size()) * float(c.sc)
		var anc := Vector2(sz.x * 0.5, sz.y * 0.86)
		var gp: Vector2 = c.p
		over_layer.draw_texture_rect(blob, Rect2(gp - Vector2(sz.x * 0.38, 12), Vector2(sz.x * 0.76, 24)),
			false, Color(0.18, 0.06, 0.22, 0.24 * a))
		var p := gp + Vector2(0, -220.0 * (1.0 - e))
		over_layer.draw_texture_rect(tex, Rect2(p - anc, sz), false, Color(1, 1, 1, a))

	# 2. Biển LANDMARK & LỄ HỘI ×k gọn đẹp ngay trên đỉnh công trình
	for i in 32:
		var b = buildings[i]
		if b == null:
			continue
		var info: Dictionary = b.info
		var lvl := int(info.lvl)
		var fm := int(info.get("festMult", 0))
		if lvl < 4 and fm <= 0:
			continue
		var base: Vector2 = b.node.position
		var m := build_model(info, i) if (info.type == "resort" or lvl >= 1) else 0
		var hgt: float = BHEIGHT[m] if (info.type == "resort" or lvl >= 1) else 0.35
		var top_y := base.y - hgt * BUP - 14.0
		if lvl >= 4:
			var bl := 0.5 + 0.5 * sin(t * 6.0)
			var beacon_p := Vector2(base.x, top_y + 8.0)
			over_layer.draw_texture_rect(blob, Rect2(beacon_p - Vector2(11, 11), Vector2(22, 22)), false, Color(1, 0.3, 0.2, 0.65 * bl))
			over_layer.draw_circle(beacon_p, 3.6, Color(1, 0.28, 0.22).lerp(Color(1, 0.9, 0.8), bl))
			_draw_pill(over_layer, Vector2(base.x, top_y - 10.0), "★ LANDMARK", Color("#fff6cc"), Color(info.color), Color(info.color).darkened(0.35), 11, 8.0, 19.0)
			top_y -= 24.0
		if fm > 0:
			_draw_pill(over_layer, Vector2(base.x, top_y - 8.0), "LỄ HỘI ×%d" % fm, Color("#ff4d8d"), Color("#ffe066"), Color.WHITE, 12, 9.0, 21.0)

	# 3. Hạt hiệu ứng (lấp lánh, khói, mảnh vỡ, cột sáng, pháo hoa)
	for f in fx:
		if f.age < 0:
			continue
		var k: float = f.age / f.life
		match f.kind:
			"spark":
				var col: Color = f.col
				col.a = 1.0 - k
				over_layer.draw_texture_rect(blob, Rect2(f.p - Vector2(f.s, f.s) * 0.5, Vector2(f.s, f.s)), false, col * Color(1.4, 1.4, 1.4, 1.0))
			"puff":
				var col: Color = f.col
				col.a = 0.78 * (1.0 - k)
				var s: float = f.s * (1.0 + k * 1.5)
				over_layer.draw_texture_rect(blob, Rect2(f.p - Vector2(s, s) * 0.5, Vector2(s, s)), false, col)
			"chip":
				over_layer.draw_rect(Rect2(f.p - Vector2(f.s, f.s * 0.7) * 0.5, Vector2(f.s, f.s * 0.7)),
					Color(f.col, 1.0 - maxf(0.0, k - 0.6) / 0.4))
			"beam":
				var a := k / 0.15 if k < 0.15 else maxf(0.0, 1.0 - (k - 0.15) / 0.85)
				var w := 40.0 * (1.0 + sin(k * PI) * 0.3)
				over_layer.draw_texture_rect(blob, Rect2(f.p - Vector2(w, f.h), Vector2(w * 2, f.h + 10)), false, Color(f.col, 0.55 * a))
				over_layer.draw_texture_rect(blob, Rect2(f.p - Vector2(w * 0.35, f.h * 0.9), Vector2(w * 0.7, f.h * 0.9 + 6)), false, Color(1, 1, 1, 0.6 * a))
			"rocket":
				var p: Vector2 = (f.p as Vector2).lerp(f.top, 1.0 - pow(1.0 - clampf(k, 0.0, 1.0), 3))
				over_layer.draw_texture_rect(blob, Rect2(p - Vector2(9, 9), Vector2(18, 18)), false, Color(1, 0.96, 0.8))
			"star4":
				var a := (1.0 - k) * (0.75 + 0.25 * sin(t * 16.0 + f.p.x * 0.1))
				var R_s := float(f.s) * (1.0 - 0.35 * k)
				var w_s := R_s * 0.24
				var fp: Vector2 = f.p
				var fcol := Color(f.col, a)
				over_layer.draw_texture_rect(blob, Rect2(fp - Vector2(R_s, R_s) * 0.9, Vector2(R_s, R_s) * 1.8), false, Color(f.col, a * 0.45))
				over_layer.draw_colored_polygon(PackedVector2Array([fp + Vector2(0, -R_s), fp + Vector2(w_s, 0), fp + Vector2(0, R_s), fp + Vector2(-w_s, 0)]), fcol)
				over_layer.draw_colored_polygon(PackedVector2Array([fp + Vector2(-R_s, 0), fp + Vector2(0, w_s), fp + Vector2(R_s, 0), fp + Vector2(0, -w_s)]), fcol)
				over_layer.draw_circle(fp, w_s * 0.85, Color(1, 1, 1, a))
			"shock_ring":
				var e := 1.0 - pow(1.0 - k, 2.5)
				var rad := lerpf(float(f.r0), float(f.r1), e)
				var sa := (1.0 - k) * 0.88
				over_layer.draw_set_transform(f.p, 0.0, Vector2(1.0, 0.56))
				over_layer.draw_arc(Vector2.ZERO, rad, 0.0, TAU, 36, Color(f.col, sa), maxf(1.2, 4.2 * (1.0 - k)), true)
				over_layer.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

	# 4. Vương miện chỉ lượt & biểu cảm hoạt hoạ trên đầu quân cờ
	for tk in tokens:
		if tk.out:
			continue
		var head_p: Vector2 = (tk.pos as Vector2) + Vector2(0, -78.0 - tk.lift)
		# Biểu cảm tức thời
		if tk.et < 1.15:
			var ek := 1.0 - clampf((tk.et - 0.75) / 0.40, 0.0, 1.0)
			if tk.emote == "shock":
				for s_i in [-1.0, 1.0]:
					var dp := head_p + Vector2(s_i * (24.0 + tk.et * 10.0), -4.0 + tk.et * 16.0)
					over_layer.draw_circle(dp, 5.0 * ek, Color(0.45, 0.82, 1.0, ek))
					over_layer.draw_colored_polygon(PackedVector2Array([dp + Vector2(-4.5, 0), dp + Vector2(4.5, 0), dp + Vector2(0, -10)]), Color(0.45, 0.82, 1.0, ek))
			elif tk.emote == "out":
				for s_i in 3:
					var da := t * 5.0 + TAU * s_i / 3.0
					var dp := (tk.pos as Vector2) + Vector2(cos(da) * 24.0, -38.0 + sin(da) * 8.0)
					over_layer.draw_circle(dp, 4.5, Color("#ffd43b"))

		if tk.cur and tk.from == null:
			var bob := absf(sin(t * 4.2)) * 8.0
			var cp := head_p + Vector2(0, -14.0 - bob)
			var col: Color = tk.color
			var gold := Color("#ffd43b")
			over_layer.draw_texture_rect(blob, Rect2(cp - Vector2(22, 22), Vector2(44, 44)), false, Color(gold, 0.45))
			# Mũi ngọc & vương miện nhỏ chỉ người đang tới lượt
			var crown := PackedVector2Array([
				cp + Vector2(-13, -4), cp + Vector2(-15, -16), cp + Vector2(-6, -10),
				cp + Vector2(0, -19), cp + Vector2(6, -10), cp + Vector2(15, -16), cp + Vector2(13, -4)
			])
			var crown_bg := PackedVector2Array([
				cp + Vector2(-15, -2), cp + Vector2(-18, -18), cp + Vector2(-6, -12),
				cp + Vector2(0, -22), cp + Vector2(6, -12), cp + Vector2(18, -18), cp + Vector2(15, -2)
			])
			over_layer.draw_colored_polygon(crown_bg, Color("#5c3800"))
			over_layer.draw_colored_polygon(crown, gold)
			over_layer.draw_circle(cp + Vector2(0, -19), 2.8, Color.WHITE)
			over_layer.draw_colored_polygon(PackedVector2Array([cp + Vector2(-8, 1), cp + Vector2(8, 1), cp + Vector2(0, 10)]), Color.WHITE)
			over_layer.draw_colored_polygon(PackedVector2Array([cp + Vector2(-6, 2), cp + Vector2(6, 2), cp + Vector2(0, 8.5)]), col)

	# 5. Huy hiệu bước đi trên ô đích (sắc nét, không vẽ vòng tròn đè lên chữ của ô)
	if target >= 0 and target_label != "":
		var tc := scr(Board.tp(target, 0, 0.5, TH)) + Vector2(0, -118.0 - absf(sin(t * 5.2)) * 9.0)
		var gold := Color("#ffd000")
		over_layer.draw_texture_rect(blob, Rect2(tc - Vector2(38, 38), Vector2(76, 76)), false, Color(gold, 0.48))
		over_layer.draw_colored_polygon(PackedVector2Array([tc + Vector2(-10, 20), tc + Vector2(10, 20), tc + Vector2(0, 33)]), Color.WHITE)
		over_layer.draw_colored_polygon(PackedVector2Array([tc + Vector2(-7.5, 20), tc + Vector2(7.5, 20), tc + Vector2(0, 30)]), gold)
		over_layer.draw_circle(tc, 25.0, gold)
		over_layer.draw_arc(tc, 25.0, 0.0, TAU, 36, Color.WHITE, 3.2, true)
		over_layer.draw_arc(tc, 20.5, 0.0, TAU, 32, Color("#fff8d6", 0.7), 1.4, true)
		over_layer.draw_string(font, tc + Vector2(-28, 9), target_label, HORIZONTAL_ALIGNMENT_CENTER, 56, 25, Color("#5c3200"))
