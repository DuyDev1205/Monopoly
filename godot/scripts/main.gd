extends Node3D

signal tile_clicked(i: int)
## Cảnh chính: môi trường (bầu trời, ánh sáng toàn cục, bóng mềm, phát sáng, chiều sâu), camera, bàn cờ, cảnh nền.
## Chạy kèm tham số (sau dấu --) để chụp ảnh kiểm tra:  --shot=duong_dan.png --theme=sakura --frames=90 --cam=x,y,z

var board: Board
var scenery: Scenery
var pieces: Pieces
var env: Environment
var sun: DirectionalLight3D
var cam: Camera3D
var cam_attr: CameraAttributesPractical
var theme := "sakura"
var args := {}
var frame := 0
var mode := "home"              # home: camera quay quanh cảnh; game: nhìn bàn cờ
var follow_on := true
var follow_pid := -1
var follow_until := 0
var cam_dist := 25.0
var cam_f := 1.0
var cam_t := Vector2.ZERO
var game: Game

const CAM_DIR := Vector3(0.4926, 0.7174, 0.4926)   # như bản Three.js: cos(.8)/√2, sin(.8), cos(.8)/√2


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=", true, 1)
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	theme = args.get("theme", theme)
	if args.has("size"):
		var wh: PackedStringArray = args.size.split("x")
		get_window().mode = Window.MODE_WINDOWED
		get_window().size = Vector2i(int(wh[0]), int(wh[1]))
	_build_env()
	board = Board.new()
	board.theme = theme
	add_child(board)
	scenery = Scenery.new()
	add_child(scenery)
	pieces = Pieces.new()
	add_child(pieces)
	set_theme(theme)
	cam = Camera3D.new()
	cam.fov = 32
	cam.near = 0.1
	cam.far = 400
	cam_attr = CameraAttributesPractical.new()
	cam_attr.dof_blur_far_enabled = true
	cam_attr.dof_blur_amount = 0.06
	cam.attributes = cam_attr
	add_child(cam)
	get_viewport().size_changed.connect(fit_camera)
	fit_camera()
	if args.has("demo"):
		_demo_state()
		mode = "demo"
	elif not args.has("nogui"):
		game = Game.new()
		add_child(game)


func _build_env() -> void:
	var we := WorldEnvironment.new()
	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	sky.sky_material = ProceduralSkyMaterial.new()
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = int(args.get("tm", "2"))
	env.tonemap_white = 6.0
	env.tonemap_exposure = 1.0
	env.ssao_enabled = true
	env.ssao_radius = 0.6
	env.ssao_intensity = 1.6
	env.ssao_detail = 0.6
	env.ssil_enabled = true
	env.ssil_radius = 2.0
	env.ssil_intensity = 0.6
	env.sdfgi_enabled = true
	env.sdfgi_use_occlusion = true
	env.sdfgi_cascades = 4
	env.sdfgi_min_cell_size = 0.1
	env.sdfgi_energy = 0.8
	env.glow_enabled = true
	env.glow_intensity = 0.55
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 1.05
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_depth_begin = 30
	env.fog_depth_end = 140
	env.fog_density = 1.0
	env.fog_sky_affect = 0.0
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.12
	env.adjustment_contrast = 1.04
	for k in ["glow", "ssao", "ssil", "sdfgi"]:
		if args.has("no" + k):
			env.set(k + "_enabled", false)
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 22, 0)
	sun.shadow_enabled = true
	sun.light_angular_distance = 1.2
	sun.shadow_blur = 1.2
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 60
	sun.shadow_bias = 0.03
	sun.shadow_normal_bias = 1.0
	add_child(sun)


const LOOK := {
	"sakura": {"sky_top": "#8ec5f2", "sky_hz": "#fde8f1", "ground": "#d9ecc8", "sun": "#fff1e6", "sun_e": 1.25, "amb": 0.45, "fog": "#fbe3ee", "exp": 0.92},
	"wood": {"sky_top": "#6aa8e0", "sky_hz": "#f6e6c8", "ground": "#c9d8a0", "sun": "#fff0d8", "sun_e": 1.3, "amb": 0.45, "fog": "#efe2c6", "exp": 0.9},
	"ocean": {"sky_top": "#3f9be0", "sky_hz": "#d8f4ff", "ground": "#bfe6ea", "sun": "#fff6e0", "sun_e": 1.4, "amb": 0.45, "fog": "#cdeff6", "exp": 0.9},
	"midnight": {"sky_top": "#0d1233", "sky_hz": "#3b3a78", "ground": "#1d2240", "sun": "#b9c6ff", "sun_e": 0.55, "amb": 0.35, "fog": "#1e2250", "exp": 1.0},
}


func set_theme(name: String) -> void:
	theme = name if LOOK.has(name) else "sakura"
	var L: Dictionary = LOOK[theme]
	var sm: ProceduralSkyMaterial = env.sky.sky_material
	sm.sky_top_color = Color(L.sky_top)
	sm.sky_horizon_color = Color(L.sky_hz)
	sm.ground_horizon_color = Color(L.sky_hz)
	sm.ground_bottom_color = Color(L.ground)
	sm.sun_angle_max = 20
	sm.sky_curve = 0.12
	sun.light_color = Color(L.sun)
	sun.light_energy = L.sun_e
	env.ambient_light_energy = L.amb
	env.ambient_light_color = Color(L.get("amb_col", "#fff4ee"))
	env.ambient_light_sky_contribution = 0.55
	env.fog_light_color = Color(L.fog)
	env.tonemap_exposure = L.exp
	board.set_theme(theme)
	scenery.set_theme(theme)


## đặt camera để bàn cờ vừa khung giữa màn hình (chừa 4 góc cho thẻ người chơi)
func fit_camera() -> void:
	var vs := get_viewport().get_visible_rect().size
	if args.has("cam"):
		var p: PackedStringArray = args.cam.split(",")
		cam.position = Vector3(float(p[0]), float(p[1]), float(p[2]))
		var lk: PackedStringArray = args.get("look", "0,0,0").split(",")
		cam.look_at(Vector3(float(lk[0]), float(lk[1]), float(lk[2])))
		cam_attr.dof_blur_far_enabled = false
		return
	var rect := Rect2(vs.x * 0.15, 58, vs.x * 0.7, vs.y - 92)
	var E := Board.W / 2 + 0.45
	var pts := []
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			for y in [-0.35, 0.6]:
				pts.append(Vector3(sx * E, y, sz * E))
	var D := 26.0
	cam.h_offset = 0
	cam.v_offset = 0
	for it in 4:
		cam.position = CAM_DIR * D
		cam.look_at(Vector3.ZERO)
		var mn := Vector2(INF, INF)
		var mx := Vector2(-INF, -INF)
		for p in pts:
			var s := cam.unproject_position(p)
			mn = mn.min(s)
			mx = mx.max(s)
		D *= maxf((mx.x - mn.x) / (rect.size.x * 0.97), (mx.y - mn.y) / (rect.size.y * 0.97))
	cam.position = CAM_DIR * D
	cam.look_at(Vector3.ZERO)
	# dời khung hình cho hộp bao của bàn cờ nằm giữa vùng dành cho bàn cờ
	var mn := Vector2(INF, INF)
	var mx := Vector2(-INF, -INF)
	for p in pts:
		var s := cam.unproject_position(p)
		mn = mn.min(s)
		mx = mx.max(s)
	var c := (mn + mx) / 2
	var want := rect.get_center()
	var world_per_px := 2.0 * D * tan(deg_to_rad(cam.fov) / 2) / vs.y
	cam.h_offset = (c.x - want.x) * world_per_px
	cam.v_offset = -(c.y - want.y) * world_per_px
	if args.has("debug"):
		print("fit vs=", vs, " D=", D, " c=", c, " want=", want, " off=", Vector2(cam.h_offset, cam.v_offset))
	cam_dist = D
	cam_attr.dof_blur_far_distance = D + 9
	cam_attr.dof_blur_far_transition = 14


func _demo_state() -> void:
	# vài ô có chủ, ô đang tới, lễ hội — để chụp ảnh kiểm tra
	board.update_tile(1, {"owned": Data.PLAYER_COLORS[0], "price": "30tr"})
	board.update_tile(2, {"owned": Data.PLAYER_COLORS[0], "price": "30tr"})
	board.update_tile(3, {"owned": Data.PLAYER_COLORS[0], "price": "40tr", "mono": true})
	board.update_tile(13, {"owned": Data.PLAYER_COLORS[1], "price": "90tr"})
	board.update_tile(27, {"owned": Data.PLAYER_COLORS[2], "price": "1,6 tỷ", "fest": true})
	board.set_target(10)
	pieces.set_tokens([{"char": 0, "color": Data.PLAYER_COLORS[0], "mine": true}, {"char": 5, "color": Data.PLAYER_COLORS[1]},
		{"char": 7, "color": Data.PLAYER_COLORS[2]}, {"char": 10, "color": Data.PLAYER_COLORS[3]}])
	pieces.place_token(0, {"tile": 0, "k": 0, "n": 2})
	pieces.place_token(1, {"tile": 0, "k": 1, "n": 2})
	pieces.place_token(2, {"tile": 13, "k": 0, "n": 1})
	pieces.place_token(3, {"tile": 27, "k": 0, "n": 1})
	pieces.set_current(0)
	var lv := [1, 2, 3, 4]
	for k in 4:
		pieces.set_building([1, 2, 3, 5][k], {"owner": 0, "color": Data.PLAYER_COLORS[0], "lvl": lv[k], "type": "city", "style": k})
	pieces.set_building(13, {"owner": 1, "color": Data.PLAYER_COLORS[1], "lvl": 3, "type": "city", "style": 1})
	pieces.set_building(27, {"owner": 2, "color": Data.PLAYER_COLORS[2], "lvl": 4, "type": "city", "style": 0, "festMult": 3})
	pieces.set_building(4, {"owner": 0, "color": Data.PLAYER_COLORS[0], "lvl": 0, "type": "resort"})
	pieces.set_fest_gates([10, 21])
	pieces.set_target(10, "7")
	pieces.set_dice_skin(args.get("dice", "classic"))


func set_mode(m: String) -> void:
	mode = m
	if m == "game":
		fit_camera()


## camera bám theo quân đang đi (khoảng 1 giây) rồi lùi về toàn cảnh
func follow(pid: int) -> void:
	follow_pid = pid
	follow_until = Time.get_ticks_msec() + 1600


func _update_camera(dt: float) -> void:
	if args.has("cam"):
		return
	var t := Time.get_ticks_msec() / 1000.0
	if mode == "home":
		var a := t * 0.06
		cam.h_offset = 0
		cam.v_offset = 0
		cam.position = Vector3(cos(a) * 26, 13, sin(a) * 26)
		cam.look_at(Vector3(0, -0.5, 0))
		cam_attr.dof_blur_far_distance = 40
		return
	if mode != "game":
		return
	var tf := 1.0
	var tx := Vector2.ZERO
	var now := Time.get_ticks_msec()
	if follow_on and follow_pid >= 0 and now < follow_until and follow_pid < pieces.tokens.size() and pieces.tokens[follow_pid].from != null:
		follow_until = now + 900
	if follow_on and follow_pid >= 0 and now < follow_until and follow_pid < pieces.tokens.size() and game and game.picks.is_empty():
		var p: Vector3 = pieces.tokens[follow_pid].grp.position
		tf = 0.74
		tx = Vector2(p.x, p.z) * 0.5
	tf -= pieces.punch
	var k := 1.0 - exp(-dt * 2.6)
	cam_f += (tf - cam_f) * k
	cam_t += (tx - cam_t) * k
	cam.position = CAM_DIR * cam_dist * cam_f + Vector3(cam_t.x, 0, cam_t.y)
	cam.look_at(Vector3(cam_t.x, 0, cam_t.y))
	cam_attr.dof_blur_far_distance = cam_dist * cam_f + 9


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT and mode == "game":
		var from := cam.project_ray_origin(e.position)
		var to := from + cam.project_ray_normal(e.position) * 200
		var q := PhysicsRayQueryParameters3D.create(from, to)
		var hit := get_world_3d().direct_space_state.intersect_ray(q)
		if hit and hit.collider.has_meta("tile"):
			tile_clicked.emit(int(hit.collider.get_meta("tile")))


func tile_screen(i: int) -> Vector2:
	return cam.unproject_position(Board.tp(i, 0, 0.5, Board.TH + 0.2))


func _process(dt: float) -> void:
	frame += 1
	_update_camera(dt)
	if args.has("debug") and frame == 5:
		var E := Board.W / 2 + 0.45
		print("frame5 vs=", get_viewport().get_visible_rect().size, " win=", get_window().size, " near=", cam.unproject_position(Vector3(E, -0.35, E)), " far=", cam.unproject_position(Vector3(-E, 0.6, -E)), " cur=", cam.current, " campos=", cam.global_position)
	if args.has("shots") and frame % int(args.get("every", "300")) == 0:
		get_viewport().get_texture().get_image().save_png("%s_%04d.png" % [args.shots, frame])
		if frame >= int(args.get("frames", "3000")):
			get_tree().quit()
	if args.has("shot") and frame == int(args.get("frames", "120")):
		var img := get_viewport().get_texture().get_image()
		img.save_png(args.shot)
		print("đã chụp ", args.shot)
		get_tree().quit()
