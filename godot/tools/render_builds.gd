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
## cỡ nhà theo cấp [vừa bề ngang, cao tối đa] — cấp càng cao càng to rõ (Business Tour)
const FIT := {1: [0.54, 0.56], 2: [0.58, 0.80], 3: [0.68, 1.06], 4: [0.72, 1.46]}
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
	vp.msaa_3d = Viewport.MSAA_8X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color("#dce6ff")
	sky_mat.sky_horizon_color = Color("#ffeaf2")
	sky_mat.ground_horizon_color = Color("#e8d4e4")
	sky_mat.ground_bottom_color = Color("#b89ec4")
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_sky_contribution = 0.65
	env.ambient_light_color = Color("#f7ebf2")
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 0.98
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
				g.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.80, 0.056, 0.62), 0.028, 3), MeshUtil.std(color, 0.32, 0.12), Vector3(0, 0.028, 0)))
				g.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.70, 0.022, 0.52), 0.014, 2), MeshUtil.std(Color("#38bdf8"), 0.22, 0.1), Vector3(0, 0.064, 0)))
				g.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.32, 0.028, 0.36), 0.018, 2), MeshUtil.std(Color("#f7e3ab"), 0.85), Vector3(0.16, 0.070, -0.02)))
				var ship := MeshUtil.kit("bt_city/CruiseShip", 0.58)
				if ship:
					ship.position = Vector3(-0.10, 0.075, 0.04)
					ship.rotation_degrees.y = 26.0
					g.add_child(ship)
				var palm := MeshUtil.kit("pf/palm-tree-a307da", 0, 0.56)
				if palm == null:
					palm = MeshUtil.kit("pf/palm-sapling-ef7ae4", 0, 0.56)
				if palm:
					palm.position = Vector3(0.24, 0.078, -0.06)
					g.add_child(palm)
				hgt = 0.64
			else:
				var L: int = M[1]
				var mdl := MeshUtil.kit(Pieces.HOUSE_SETS[L][M[2]], FIT[L][0], 0, FIT[L][1])
				Pieces.decorate_building(mdl, color, L)
				g.add_child(P._plot(color, L))
				mdl.position.y = 0.075
				g.add_child(mdl)
				hgt = mdl.get_meta("height") + (0.26 if L >= 4 else 0.04)
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
