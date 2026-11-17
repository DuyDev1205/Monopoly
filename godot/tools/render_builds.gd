extends Node
## Chụp các công trình 3D (Polyfork) thành một bảng hình 2D cho bản app 2D: khu du lịch + nhà cấp 1–4, mỗi cái 4 màu chủ đất
## (đế + mái tô màu người chơi). Góc máy khớp phép chiếu của bàn cờ (Iso); mặt tiền quay xuống-trái, ô ở cạnh trái / phải thì lật ngang.
## Chạy (cần cửa sổ, không --headless):  godot --path godot res://tools/render_builds.tscn
## Sau đó chạy: python godot/tools/fix_chars.py  (bỏ nhân sẵn alpha, tăng nhẹ độ tươi, nén PNG)
## Xuất: assets/build2d/houses.png — lưới COLS cột, ô FW×FH px; ô thứ (mô hình × 4 + màu). pieces2d.gd dùng cùng bảng MODELS.

const FW := 300
const FH := 375
const SS := 2
const COLS := 8
const VIEW := 2.6                 # chiều cao vùng nhìn (đơn vị 3D)
const AIM_Y := 0.75
## cỡ nhà theo cấp [vừa bề ngang, cao tối đa] — cấp càng cao càng to rõ
const FIT := {1: [0.5, 0.5], 2: [0.56, 0.74], 3: [0.74, 1.0], 4: [0.72, 1.5]}
## [loại, cấp, kiểu]
const MODELS := [
	["resort", 0, 0],
	["city", 1, 0], ["city", 1, 1], ["city", 1, 2], ["city", 1, 3],
	["city", 2, 0], ["city", 2, 1], ["city", 2, 2], ["city", 2, 3],
	["city", 3, 0], ["city", 3, 1],
	["city", 4, 0], ["city", 4, 1],
]


func _ready() -> void:
	var vp := SubViewport.new()
	vp.size = Vector2i(FW * SS, FH * SS)
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#fff1f4")
	env.ambient_light_energy = 0.95
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
	var key := DirectionalLight3D.new()            # nắng chính: từ trên, chếch trái-trước, có đổ bóng
	vp.add_child(key)
	key.look_at_from_position(Vector3(-0.9, 2.4, 1.5), Vector3.ZERO)
	key.light_energy = 1.05
	key.light_color = Color("#fff6ea")
	key.shadow_enabled = true
	key.shadow_opacity = 0.42
	key.shadow_blur = 1.6
	key.directional_shadow_max_distance = 40.0
	var rim := DirectionalLight3D.new()
	vp.add_child(rim)
	rim.look_at_from_position(Vector3(1.6, 1.0, -1.6), Vector3.ZERO)
	rim.light_energy = 0.35
	rim.light_color = Color("#dfe6ff")
	var P := Pieces.new()                          # mượn các hàm dựng nhà của bản 3D (không đưa vào cây cảnh)
	var total := MODELS.size() * 4
	var rows := int(ceil(float(total) / COLS))
	var sheet := Image.create(COLS * FW, rows * FH, false, Image.FORMAT_RGBA8)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://assets/build2d"))
	for m in MODELS.size():
		var M: Array = MODELS[m]
		for ci in 4:
			var color := Color(Data.PLAYER_COLORS[ci])
			var g := Node3D.new()
			var hgt := 0.0
			if M[0] == "resort":
				g.add_child(P._plot(color, 1, 0.74, 0.54, Color("#f2dfa6")))
				var hut := MeshUtil.kit("pf/beach-hut-fc7649", 0.36)
				hut.position = Vector3(-0.12, 0.075, -0.02)
				g.add_child(hut)
				var palm := MeshUtil.kit("pf/palm-sapling-ef7ae4", 0, 0.62)
				palm.position = Vector3(0.2, 0.075, 0.05)
				g.add_child(palm)
				hgt = 0.62
			else:
				var L: int = M[1]
				var mdl := MeshUtil.kit(Pieces.HOUSE_SETS[L][M[2]], FIT[L][0], 0, FIT[L][1])
				_tint_roofs(mdl, color)
				g.add_child(P._plot(color, L))
				mdl.position.y = 0.075
				g.add_child(mdl)
				hgt = mdl.get_meta("height")
			vp.add_child(g)
			await RenderingServer.frame_post_draw
			await RenderingServer.frame_post_draw
			await RenderingServer.frame_post_draw
			var img := vp.get_texture().get_image()
			img.convert(Image.FORMAT_RGBA8)
			img.resize(FW, FH, Image.INTERPOLATE_LANCZOS)
			var edge := false
			for e in FH:
				if img.get_pixel(0, e).a > 0.1 or img.get_pixel(FW - 1, e).a > 0.1 or img.get_pixel(e % FW, 0).a > 0.1:
					edge = true
			var idx := m * 4 + ci
			sheet.blit_rect(img, Rect2i(0, 0, FW, FH), Vector2i((idx % COLS) * FW, (idx / COLS) * FH))
			if ci == 0:
				print("mô hình %d %s cấp %d kiểu %d  cao=%.2f%s" % [m, M[0], M[1], M[2], hgt, "  CHẠM MÉP" if edge else ""])
			g.queue_free()
			await get_tree().process_frame
	sheet.save_png(ProjectSettings.globalize_path("res://assets/build2d/houses.png"))
	P.free()
	get_tree().quit()


## tô mái (mặt hướng lên, ở nửa trên, màu gốc sẫm) theo màu chủ đất đã làm dịu; giữ độ đậm nhạt gốc để còn thấy vân ngói
func _tint_roofs(grp: Node3D, color: Color) -> void:
	var soft := color.lerp(Color.WHITE, 0.16)
	var bb := MeshUtil.visible_aabb(grp)
	var y0 := bb.position.y
	var H := bb.size.y
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
		var out := ArrayMesh.new()
		for s in mi.mesh.get_surface_count():
			var arr: Array = mi.mesh.surface_get_arrays(s)
			var mat := mi.mesh.surface_get_material(s)
			if arr[Mesh.ARRAY_COLOR] != null and arr[Mesh.ARRAY_NORMAL] != null:
				var v: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
				var nr: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
				var c: PackedColorArray = arr[Mesh.ARRAY_COLOR].duplicate()
				for k in v.size():
					var wp: Vector3 = tf * v[k]
					var wn: Vector3 = (tf.basis * nr[k]).normalized()
					var cc: Color = c[k]
					var L := 0.3 * cc.r + 0.59 * cc.g + 0.11 * cc.b
					var sat := maxf(cc.r, maxf(cc.g, cc.b)) - minf(cc.r, minf(cc.g, cc.b))
					if wn.y >= 0.25 and wp.y >= y0 + H * 0.38 and L <= 0.6 and sat < 0.22:
						var kk := 0.62 + L * 1.15
						c[k] = Color(minf(1, soft.r * kk), minf(1, soft.g * kk), minf(1, soft.b * kk))
				arr[Mesh.ARRAY_COLOR] = c
			out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			out.surface_set_material(out.get_surface_count() - 1, mat)
		mi.mesh = out
