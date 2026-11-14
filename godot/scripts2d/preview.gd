extends Node2D
## Xem thử cảnh 2D: godot --path godot res://scripts2d/preview.tscn -- --shot=... --theme=sakura

var args := {}
var frame := 0


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
	env.glow_enabled = not args.has("noglow")
	env.glow_intensity = 0.45
	env.glow_bloom = 0.12
	env.glow_hdr_threshold = 0.85
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	we.environment = env
	add_child(we)
	var cam := Camera2D.new()
	add_child(cam)
	var sc := Scenery2D.new()
	add_child(sc)
	sc.set_theme(args.get("theme", "sakura"))
	# khung bàn cờ tạm (hình thoi)
	var d := Polygon2D.new()
	var W := 10.3
	d.polygon = PackedVector2Array([Iso.p(-W / 2, -W / 2), Iso.p(W / 2, -W / 2), Iso.p(W / 2, W / 2), Iso.p(-W / 2, W / 2)])
	d.color = Color(1, 0.97, 0.98)
	add_child(d)
	await get_tree().process_frame
	var vs := get_viewport_rect().size
	cam.zoom = Vector2.ONE * minf(vs.x / 1920.0, vs.y / 1300.0)
	cam.position = Vector2(0, -110)


func _process(_dt: float) -> void:
	frame += 1
	if args.has("shot") and frame == int(args.get("frames", "90")):
		get_viewport().get_texture().get_image().save_png(args.shot)
		get_tree().quit()
