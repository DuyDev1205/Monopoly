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
	var cam := Camera2D.new()
	add_child(cam)
	var sc := Scenery2D.new()
	add_child(sc)
	sc.set_theme(args.get("theme", "sakura"))
	var b := Board2D.new()
	b.theme = args.get("theme", "sakura")
	add_child(b)
	b.update_tile(1, {"owned": Data.PLAYER_COLORS[0], "price": "30tr"})
	b.update_tile(3, {"owned": Data.PLAYER_COLORS[0], "price": "40tr", "mono": true})
	b.update_tile(13, {"owned": Data.PLAYER_COLORS[1], "price": "90tr"})
	b.set_target(10)
	await get_tree().process_frame
	var vs := get_viewport_rect().size
	cam.zoom = Vector2.ONE * minf(vs.x / 1500.0, vs.y / 860.0)
	cam.position = Vector2(0, 0)


func _process(_dt: float) -> void:
	frame += 1
	if args.has("shot") and frame == int(args.get("frames", "90")):
		get_viewport().get_texture().get_image().save_png(args.shot)
		get_tree().quit()
