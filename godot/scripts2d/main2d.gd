extends Node2D
## Cảnh chính bản 2D: nền tranh vẽ + bàn cờ isometric + quân cờ / nhà / hiệu ứng, camera 2D, giao diện (Game).
## API giống scripts/main.gd (bản 3D) để game.gd dùng chung.
## Tham số chạy thử (sau --): --shot=a.png --frames=120 --size=1600x900 --theme=sakura --demo --start --autoplay ...

signal tile_clicked(i: int)

var board: Board2D
var pieces: Pieces2D
var scenery: Scenery2D
var cam: Camera2D
var game: Game
var args := {}
var frame := 0
var mode := "home"
var theme := "sakura"
var follow_on := true
var follow_pid := -1
var follow_until := 0
var quality := 2
var fit_zoom := 1.0
var fit_pos := Vector2.ZERO
var cam_k := 1.0
var cam_t := Vector2.ZERO


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=", true, 1)
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	if args.has("size"):
		var wh: PackedStringArray = args.size.split("x")
		get_window().mode = Window.MODE_WINDOWED
		get_window().size = Vector2i(int(wh[0]), int(wh[1]))
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CANVAS
	env.glow_enabled = true
	env.glow_intensity = 0.4
	env.glow_bloom = 0.08
	env.glow_hdr_threshold = 0.9
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	we.environment = env
	add_child(we)
	cam = Camera2D.new()
	add_child(cam)
	scenery = Scenery2D.new()
	add_child(scenery)
	board = Board2D.new()
	add_child(board)
	pieces = Pieces2D.new()
	add_child(pieces)
	get_viewport().size_changed.connect(fit_camera)
	set_theme(args.get("theme", theme))
	await get_tree().process_frame
	fit_camera()
	if args.has("demo"):
		_demo_state()
		mode = "game"
	elif not args.has("nogui"):
		game = Game.new()
		add_child(game)


func set_theme(name: String) -> void:
	theme = name
	scenery.set_theme(name)
	board.set_theme(name)


func apply_quality(q: int) -> void:
	quality = clampi(q, 0, 2)
	scenery.visible = true


## bàn cờ vừa khung giữa màn hình (chừa 4 góc cho thẻ người chơi)
func fit_camera() -> void:
	var vs := get_viewport_rect().size
	var rect := Rect2(vs.x * 0.15, 58, vs.x * 0.7, vs.y - 92)
	var E := Board.W / 2 + 0.5
	var bw := 4 * E * Iso.A
	var bh := 4 * E * Iso.B + 1.0 * Iso.HS + 80
	fit_zoom = minf(rect.size.x / bw, rect.size.y / bh) * 0.98
	# tâm khung (theo toạ độ màn hình) trùng tâm bàn
	var want := rect.get_center() - vs / 2
	fit_pos = Vector2(0, 0.45 * Iso.HS * 0.5) - want / fit_zoom
	cam.zoom = Vector2.ONE * fit_zoom
	cam.position = fit_pos


func set_mode(m: String) -> void:
	mode = m
	if m == "game":
		fit_camera()


func follow(pid: int) -> void:
	follow_pid = pid
	follow_until = Time.get_ticks_msec() + 1600


func screen_of(w: Vector3) -> Vector2:
	return get_viewport().get_canvas_transform() * Iso.v(w)


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_LEFT and mode == "game":
		var wp: Vector2 = get_canvas_transform().affine_inverse() * e.position
		var i := board.tile_at(wp)
		if i >= 0:
			tile_clicked.emit(i)


func _process(dt: float) -> void:
	frame += 1
	var t := Time.get_ticks_msec() / 1000.0
	if mode == "home":
		# trang chủ: camera trôi chậm qua cảnh, phóng gần
		cam.zoom = Vector2.ONE * fit_zoom * 1.15
		cam.position = Vector2(sin(t * 0.07) * 260, -60 + sin(t * 0.05) * 30)
	elif mode == "game":
		var tk := 1.0
		var tp := fit_pos
		var now := Time.get_ticks_msec()
		if follow_pid >= 0 and follow_pid < pieces.tokens.size() and pieces.tokens[follow_pid].from != null:
			follow_until = now + 900
		if follow_on and follow_pid >= 0 and now < follow_until and follow_pid < pieces.tokens.size() and game and game.picks.is_empty():
			tk = 1.3
			tp = fit_pos.lerp(pieces.tokens[follow_pid].pos, 0.5)
		tk += pieces.punch
		var k := 1.0 - exp(-dt * 2.6)
		cam_k += (tk - cam_k) * k
		cam_t = cam_t.lerp(tp, k) if cam_t != Vector2.ZERO else tp
		cam.zoom = Vector2.ONE * fit_zoom * cam_k
		cam.position = cam_t
	if args.has("shot") and frame == int(args.get("frames", "120")):
		get_viewport().get_texture().get_image().save_png(args.shot)
		print("đã chụp ", args.shot)
		get_tree().quit()
	if args.has("shots") and frame % int(args.get("every", "300")) == 0:
		get_viewport().get_texture().get_image().save_png("%s_%04d.png" % [args.shots, frame])
		if frame >= int(args.get("frames", "3000")):
			get_tree().quit()


func _demo_state() -> void:
	board.update_tile(1, {"owned": Data.PLAYER_COLORS[0], "price": "30tr"})
	board.update_tile(2, {"owned": Data.PLAYER_COLORS[0], "price": "30tr"})
	board.update_tile(3, {"owned": Data.PLAYER_COLORS[0], "price": "40tr", "mono": true})
	board.update_tile(13, {"owned": Data.PLAYER_COLORS[1], "price": "90tr"})
	board.update_tile(27, {"owned": Data.PLAYER_COLORS[2], "price": "1,6 tỷ", "fest": true})
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
	board.set_target(10)
