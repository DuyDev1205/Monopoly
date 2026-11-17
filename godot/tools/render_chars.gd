extends Node
## Chụp 12 nhân vật 3D (KayKit) thành bảng khung hình 2D cho bản app 2D: đứng thở, đi, nhảy, reo hò, giật mình, ngã
## (nhìn từ trước) + đi, nhảy (nhìn từ sau). Góc máy khớp phép chiếu của bàn cờ (Iso).
## Chạy (cần cửa sổ, không --headless):  godot --path godot res://tools/render_chars.tscn [-- --only=0,5 --probe]
## Sau đó chạy: python godot/tools/fix_chars.py  (bỏ nhân sẵn alpha, tăng nhẹ độ tươi, nén PNG)
## Xuất: assets/chars2d/c<k>.png — lưới COLS cột, mỗi ô FRAME px; thứ tự khung theo bảng CLIPS (pieces2d.gd dùng cùng bảng).

const FRAME := 240
const SS := 2
const COLS := 10
const VIEW := 1.85                # chiều cao vùng nhìn (đơn vị 3D)
const AIM_Y := 0.60               # máy nhìn vào độ cao này
## [tên, hướng (d = quay mặt xuống-trái, u = quay lưng lên-trái), clip, số khung, lặp]
const CLIPS := [
	["idle", "d", "Idle", 12, true], ["walk", "d", "Walking_A", 10, true], ["jump", "d", "Jump_Full_Short", 10, false],
	["cheer", "d", "Cheer", 14, false], ["hit", "d", "Hit_A", 8, false], ["die", "d", "Death_A", 12, false],
	["walk_u", "u", "Walking_A", 10, true], ["jump_u", "u", "Jump_Full_Short", 10, false],
]

var args := {}


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=", true, 1)
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	var vp := SubViewport.new()
	vp.size = Vector2i(FRAME * SS, FRAME * SS)
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#fff3f6")
	env.ambient_light_energy = 0.85
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	we.environment = env
	vp.add_child(we)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = VIEW
	cam.near = 0.1
	cam.far = 60.0
	vp.add_child(cam)
	cam.position = Vector3(0, AIM_Y, 0) + Vector3(1, 1, 1) * 12.0
	cam.look_at(Vector3(0, AIM_Y, 0))
	var key := DirectionalLight3D.new()            # nắng chính: từ trên, chếch trái-trước
	vp.add_child(key)
	key.look_at_from_position(Vector3(-0.2, 2.2, 1.6), Vector3.ZERO)
	key.light_energy = 1.2
	key.light_color = Color("#fff8ee")
	var rim := DirectionalLight3D.new()            # ánh viền từ sau-phải
	vp.add_child(rim)
	rim.look_at_from_position(Vector3(1.5, 1.2, -1.8), Vector3.ZERO)
	rim.light_energy = 0.38
	rim.light_color = Color("#d9e4ff")
	var only: Array = []
	if args.has("only"):
		for s in str(args.only).split(","):
			only.append(int(s))
	var total := 0
	for c in CLIPS:
		total += c[3]
	var rows := int(ceil(float(total) / COLS))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://assets/chars2d"))
	for k in Pieces.CHAR3D.size():
		if not only.is_empty() and not (k in only):
			continue
		var ent: Dictionary = Pieces.CHAR3D[k]
		var o: Node3D = load("res://assets/models/kk/chr/%s.glb" % ent.f).instantiate()
		var ap: AnimationPlayer = o.find_child("AnimationPlayer", true, false)
		if ent.has("hide"):
			var re := RegEx.create_from_string("(?i)" + ent.hide)
			for n in o.find_children("*", "", true, false):
				if n != o and re.search(n.name) and n is Node3D:
					n.visible = false
		var bb := MeshUtil.visible_aabb(o)
		var sc := Pieces.TOKEN_H / maxf(bb.size.y, 0.01)
		o.scale = Vector3.ONE * sc
		o.position.y = -bb.position.y * sc
		var wrap := Node3D.new()
		wrap.add_child(o)
		vp.add_child(wrap)
		if args.has("probe"):
			for nm in ap.get_animation_list():
				print(k, " ", nm, " ", snappedf(ap.get_animation(nm).length, 0.01))
			wrap.queue_free()
			continue
		var sheet := Image.create(COLS * FRAME, rows * FRAME, false, Image.FORMAT_RGBA8)
		var idx := 0
		var edge := 0
		for c in CLIPS:
			wrap.rotation.y = 0.22 if c[1] == "d" else -PI / 2 - 0.22
			var clip: String = c[2]
			if not ap.has_animation(clip):
				push_error("thiếu clip %s ở nhân vật %d" % [clip, k])
				idx += c[3]
				continue
			var n: int = c[3]
			var L := ap.get_animation(clip).length
			ap.play(clip)
			for i in n:
				var tt := (L * i / n) if c[4] else (L * i / (n - 1))
				ap.seek(minf(tt, L - 0.001), true)
				await RenderingServer.frame_post_draw
				await RenderingServer.frame_post_draw
				var img := vp.get_texture().get_image()
				img.convert(Image.FORMAT_RGBA8)
				img.resize(FRAME, FRAME, Image.INTERPOLATE_LANCZOS)
				for e in FRAME:
					if img.get_pixel(e, 0).a > 0.1 or img.get_pixel(0, e).a > 0.1 or img.get_pixel(FRAME - 1, e).a > 0.1:
						edge += 1
						break
				sheet.blit_rect(img, Rect2i(0, 0, FRAME, FRAME), Vector2i((idx % COLS) * FRAME, (idx / COLS) * FRAME))
				idx += 1
		sheet.save_png(ProjectSettings.globalize_path("res://assets/chars2d/c%d.png" % k))
		print("ok c%d  khung=%d  chạm mép=%d" % [k, idx, edge])
		wrap.queue_free()
		await get_tree().process_frame
	get_tree().quit()
