extends Node
## Chụp các mô hình 3D đạo cụ, cụm tiểu cảnh 4 ô góc, kho báu giữa sân, chân dung 12 nhân vật và 12 bộ xúc xắc UI.
## Ánh sáng studio 3 điểm + AgX tonemap + MSAA 8× + siêu lấy mẫu 2× Lanczos.
## Chạy (cần cửa sổ, không --headless):
##   godot --path godot res://tools/render_props.tscn [-- --only=andon,torii --ui]
## Sau đó chạy: python godot/tools/fix_chars.py --force

const PX := 150.0                 # px ảnh cho 1 đơn vị 3D (bàn cờ: 1 đơn vị chiếu ≈ 90.5 px; chụp dư độ nét để co giãn mượt)
const SS := 2

var args := {}


func _checker_tex() -> ImageTexture:
	var img := Image.create(64, 48, false, Image.FORMAT_RGBA8)
	for y in 3:
		for x in 4:
			img.fill_rect(Rect2i(x * 16, y * 16, 16, 16), Color("#1f1b24") if (x + y) % 2 else Color("#fffaf0"))
	return ImageTexture.create_from_image(img)


## Nhuộm ấm các ô giấy sáng màu của đèn lồng gỗ (andon) để nhìn rõ ánh đèn rực bên trong
func _glow_lantern_panes(grp: Node3D, warm: Color, emit: Color, energy: float) -> void:
	for n in grp.find_children("*", "MeshInstance3D", true, false):
		var mi: MeshInstance3D = n
		if mi.mesh == null:
			continue
		var out := ArrayMesh.new()
		for s in mi.mesh.get_surface_count():
			var arr: Array = mi.mesh.surface_get_arrays(s)
			var mat := mi.mesh.surface_get_material(s)
			if arr[Mesh.ARRAY_COLOR] != null:
				var c: PackedColorArray = arr[Mesh.ARRAY_COLOR].duplicate()
				for k in c.size():
					var cc: Color = c[k]
					var L := 0.3 * cc.r + 0.59 * cc.g + 0.11 * cc.b
					if L > 0.55:
						c[k] = Color(warm.r * 1.35, warm.g * 1.25, warm.b * 0.92, 1.0)
				arr[Mesh.ARRAY_COLOR] = c
			out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			if mat is BaseMaterial3D:
				var m2: StandardMaterial3D = mat.duplicate()
				m2.emission_enabled = true
				m2.emission = emit
				m2.emission_energy_multiplier = energy * 0.16
				out.surface_set_material(out.get_surface_count() - 1, m2)
			else:
				out.surface_set_material(out.get_surface_count() - 1, mat)
		mi.mesh = out


func _build_prop(id: String) -> Array:
	## Trả về [Node3D, Vector2(rộng, cao) theo đơn vị khung chiếu]
	var g := Node3D.new()
	match id:
		"andon":
			# Trụ đèn Art-Deco Business Tour viền vàng kim 24K & cầu pha lê phát sáng
			var navy_m := MeshUtil.std(Color("#15317a"), 0.30, 0.45)
			var gold_m := MeshUtil.std(Color("#f7be38"), 0.18, 0.90)
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.085, 0.105, 0.08, 8), navy_m, Vector3(0, 0.04, 0)))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.068, 0.078, 0.04, 8), gold_m, Vector3(0, 0.10, 0)))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.036, 0.052, 0.44, 12), navy_m, Vector3(0, 0.34, 0)))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.068, 0.044, 0.04, 12), gold_m, Vector3(0, 0.58, 0)))
			g.add_child(MeshUtil.mesh(MeshUtil.sphere(0.088, 18),
				MeshUtil.emissive(Color("#fff5d0"), Color("#ffca58"), 2.4), Vector3(0, 0.69, 0), false))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.020, 0.075, 0.05, 12), gold_m, Vector3(0, 0.785, 0)))
			return [g, Vector2(0.95, 1.35)]

		"torii", "torii_r":
			# Cổng chào Business Tour VIP & Festival hiện đại (trụ đá cẩm thạch + vòm vàng kim 24K + đèn pha)
			var sub := Node3D.new()
			var marble_m := MeshUtil.std(Color("#f8fafc"), 0.32, 0.08)
			var navy_m := MeshUtil.std(Color("#15317a"), 0.28, 0.35)
			var gold_m := MeshUtil.std(Color("#f7be38"), 0.16, 0.92)
			var crimson_m := MeshUtil.std(Color("#e11d48"), 0.26, 0.18)
			for sx in [-0.36, 0.36]:
				sub.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.14, 0.10, 0.14), 0.02, 3), navy_m, Vector3(sx, 0.05, 0)))
				sub.add_child(MeshUtil.mesh(MeshUtil.cyl(0.044, 0.052, 0.92, 16), marble_m, Vector3(sx, 0.56, 0)))
				sub.add_child(MeshUtil.mesh(MeshUtil.cyl(0.060, 0.052, 0.07, 16), gold_m, Vector3(sx, 1.03, 0)))
			sub.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.94, 0.12, 0.11), 0.03, 3), crimson_m, Vector3(0, 1.12, 0)))
			sub.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.98, 0.045, 0.13), 0.015, 3), gold_m, Vector3(0, 1.20, 0)))
			sub.add_child(MeshUtil.mesh(MeshUtil.cyl(0.02, 0.11, 0.10, 16), gold_m, Vector3(0, 1.27, 0)))
			for bx in [-0.28, 0.0, 0.28]:
				sub.add_child(MeshUtil.mesh(MeshUtil.sphere(0.036, 12),
					MeshUtil.emissive(Color("#fff5c0"), Color("#ffbe3b"), 2.2), Vector3(bx, 1.12, 0.065), false))
			if id == "torii_r":
				sub.rotation_degrees.y = 90.0
			g.add_child(sub)
			return [g, Vector2(2.6, 2.4)]

		"corner_start":
			# Bục tròn viền vàng + rương vàng + chồng tiền + 2 cột cờ ca-rô xuất phát
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.42, 0.46, 0.05, 32), MeshUtil.std(Color("#f7d774"), 0.32, 0.55), Vector3(0, 0.025, 0)))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.36, 0.36, 0.055, 32), MeshUtil.std(Color("#fff4d6"), 0.55), Vector3(0, 0.03, 0)))
			var ch := MeshUtil.kit("kk/dun/chest_gold", 0.42)
			if ch:
				ch.position = Vector3(-0.02, 0.055, 0.04)
				ch.rotation_degrees.y = 32.0
				g.add_child(ch)
			var cs := MeshUtil.kit("pf/gold-coin-stack-a9ef52", 0.22)
			if cs:
				cs.position = Vector3(0.22, 0.055, 0.12)
				g.add_child(cs)
			var ig := MeshUtil.kit("pf/gold-ingot-85e62e", 0.18)
			if ig:
				ig.position = Vector3(-0.22, 0.055, 0.16)
				ig.rotation_degrees.y = -25.0
				g.add_child(ig)
			var chk := _checker_tex()
			var fm := StandardMaterial3D.new()
			fm.albedo_texture = chk
			fm.cull_mode = BaseMaterial3D.CULL_DISABLED
			fm.roughness = 0.55
			var gold_m := MeshUtil.std(Color("#e5a922"), 0.28, 0.72)
			for s in [-1.0, 1.0]:
				var fp := Node3D.new()
				fp.position = Vector3(s * 0.28, 0.05, -0.14)
				fp.add_child(MeshUtil.mesh(MeshUtil.cyl(0.018, 0.024, 0.78, 12), gold_m, Vector3(0, 0.39, 0)))
				fp.add_child(MeshUtil.mesh(MeshUtil.sphere(0.042, 12), gold_m, Vector3(0, 0.80, 0)))
				var pm := PlaneMesh.new()
				pm.size = Vector2(0.30, 0.20)
				pm.orientation = PlaneMesh.FACE_Z
				var fl := MeshUtil.mesh(pm, fm, Vector3(s * 0.15, 0.66, 0))
				fl.rotation_degrees.y = -20.0 * s
				fl.rotation_degrees.z = 6.0 * s
				fp.add_child(fl)
				g.add_child(fp)
			return [g, Vector2(1.35, 1.45)]

		"corner_island":
			# Đảo cát vàng viền nước ngọc + cây dừa + lâu đài cát + phao cứu sinh + đá
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.46, 0.50, 0.035, 32), MeshUtil.std(Color("#4cc9dc"), 0.25), Vector3(0, 0.018, 0)))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.38, 0.43, 0.06, 28), MeshUtil.std(Color("#f5dfa3"), 0.78), Vector3(0, 0.035, 0)))
			var palm := MeshUtil.kit("pf/palm-tree-a307da", 0, 0.92)
			if palm:
				palm.position = Vector3(-0.08, 0.06, -0.06)
				palm.rotation_degrees.y = 25.0
				g.add_child(palm)
			var sc := MeshUtil.kit("pf/sandcastle-ddc562", 0.26)
			if sc:
				sc.position = Vector3(0.14, 0.06, 0.10)
				sc.rotation_degrees.y = 35.0
				g.add_child(sc)
			var buoy := MeshUtil.kit("pf/lifebuoy-on-a-post-57421b", 0, 0.42)
			if buoy:
				buoy.position = Vector3(-0.22, 0.06, 0.14)
				buoy.rotation_degrees.y = 40.0
				g.add_child(buoy)
			var rk := MeshUtil.kit("pf/garden-rock-2d3b51", 0.22)
			if rk:
				rk.position = Vector3(0.22, 0.055, -0.10)
				g.add_child(rk)
			return [g, Vector2(1.35, 1.50)]

		"corner_festival":
			# Sân khấu Expo / World Tour Business Tour + Cúp Vàng Vô Địch 24K & cột đèn pha
			var crim_m := MeshUtil.std(Color("#d92652"), 0.30, 0.18)
			var marble_m := MeshUtil.std(Color("#fff5f7"), 0.45)
			var navy_m := MeshUtil.std(Color("#15317a"), 0.28, 0.35)
			var gold_m := MeshUtil.std(Color("#f7be38"), 0.16, 0.92)
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.43, 0.46, 0.05, 32), crim_m, Vector3(0, 0.025, 0)))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.37, 0.37, 0.056, 32), marble_m, Vector3(0, 0.03, 0)))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.16, 0.19, 0.14, 24), navy_m, Vector3(0, 0.125, -0.02)))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.17, 0.17, 0.025, 24), gold_m, Vector3(0, 0.20, -0.02)))
			# Cúp vàng vô địch ở tâm
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.042, 0.085, 0.08, 20), gold_m, Vector3(0, 0.25, -0.02)))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.14, 0.048, 0.20, 24), gold_m, Vector3(0, 0.38, -0.02)))
			g.add_child(MeshUtil.mesh(MeshUtil.sphere(0.055, 16),
				MeshUtil.emissive(Color("#fff5c0"), Color("#ffbe3b"), 2.0), Vector3(0, 0.49, -0.02), false))
			# Hai cột đèn sân khấu phía sau
			for sx in [-0.26, 0.26]:
				g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.022, 0.026, 0.44, 10), gold_m, Vector3(sx, 0.27, 0.12)))
				g.add_child(MeshUtil.mesh(MeshUtil.sphere(0.048, 12),
					MeshUtil.emissive(Color("#fff0f6"), Color("#ff4d7e"), 2.4), Vector3(sx, 0.50, 0.12), false))
			var az := MeshUtil.kit("kk/city/bush", 0.16)
			if az:
				az.position = Vector3(-0.22, 0.055, 0.16)
				g.add_child(az)
			return [g, Vector2(1.35, 1.45)]

		"corner_airport":
			# Sân đỗ đường băng + đài không lưu kính xanh + máy bay phản lực vút mũi lên phía người xem
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.43, 0.46, 0.05, 32), MeshUtil.std(Color("#5c7cfa"), 0.4), Vector3(0, 0.025, 0)))
			g.add_child(MeshUtil.mesh(MeshUtil.cyl(0.38, 0.38, 0.056, 32), MeshUtil.std(Color("#dce6f7"), 0.5), Vector3(0, 0.03, 0)))
			var tw := Node3D.new()
			tw.position = Vector3(-0.15, 0.055, -0.10)
			tw.add_child(MeshUtil.mesh(MeshUtil.cyl(0.065, 0.10, 0.48, 16), MeshUtil.std(Color("#f4f7fc"), 0.42), Vector3(0, 0.24, 0)))
			tw.add_child(MeshUtil.mesh(MeshUtil.cyl(0.12, 0.08, 0.05, 16), MeshUtil.std(Color("#3b5bdb"), 0.35), Vector3(0, 0.50, 0)))
			var glass := StandardMaterial3D.new()
			glass.albedo_color = Color("#74c0fc")
			glass.roughness = 0.12
			glass.metallic = 0.35
			glass.emission_enabled = true
			glass.emission = Color("#339af0")
			glass.emission_energy_multiplier = 0.55
			tw.add_child(MeshUtil.mesh(MeshUtil.cyl(0.145, 0.115, 0.14, 10), glass, Vector3(0, 0.59, 0)))
			tw.add_child(MeshUtil.mesh(MeshUtil.cyl(0.02, 0.16, 0.07, 10), MeshUtil.std(Color("#2b3a55"), 0.5), Vector3(0, 0.69, 0)))
			tw.add_child(MeshUtil.mesh(MeshUtil.sphere(0.035, 12),
				MeshUtil.emissive(Color("#ff6b6b"), Color("#ff2b2b"), 2.8), Vector3(0, 0.75, 0), false))
			g.add_child(tw)
			# Máy bay 3D mini mũi hướng +Z (về phía camera) cất cánh vút lên
			var jet := Node3D.new()
			var white_m := MeshUtil.std(Color("#ffffff"), 0.26, 0.1)
			var blue_m := MeshUtil.std(Color("#228be6"), 0.30, 0.2)
			var win_m := MeshUtil.std(Color("#1864ab"), 0.12, 0.45)
			jet.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.13, 0.13, 0.50), 0.062, 5), white_m))
			var nose := MeshUtil.mesh(MeshUtil.sphere(0.062, 14), white_m, Vector3(0, -0.004, 0.24))
			nose.scale = Vector3(0.95, 0.9, 1.45)
			jet.add_child(nose)
			jet.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.092, 0.036, 0.10), 0.015, 3), win_m, Vector3(0, 0.042, 0.18)))
			var wing := MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.58, 0.022, 0.13), 0.01, 3), blue_m, Vector3(0, -0.015, 0.02))
			jet.add_child(wing)
			for s in [-0.16, 0.16]:
				jet.add_child(MeshUtil.mesh(MeshUtil.cyl(0.026, 0.024, 0.11, 10), white_m, Vector3(s, -0.045, 0.04)))
			var tail_v := MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.024, 0.15, 0.11), 0.01, 3), blue_m, Vector3(0, 0.09, -0.20))
			tail_v.rotation_degrees.x = 18.0
			jet.add_child(tail_v)
			jet.add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(0.22, 0.02, 0.08), 0.008, 2), blue_m, Vector3(0, 0.025, -0.21)))
			jet.position = Vector3(0.13, 0.36, 0.10)
			jet.rotation_degrees = Vector3(-24.0, 22.0, -12.0)
			g.add_child(jet)
			return [g, Vector2(1.35, 1.45)]

		"pile_coin":
			var m := MeshUtil.kit("pf/gold-coin-stack-a9ef52", 0.38)
			if m:
				g.add_child(m)
			return [g, Vector2(0.65, 0.70)]

		"pile_ingot":
			var b := MeshUtil.kit("pf/banded-cash-bundle-7da278", 0.32)
			if b:
				b.position = Vector3(-0.08, 0, 0.04)
				b.rotation_degrees.y = 22.0
				g.add_child(b)
			for k in 2:
				var ig := MeshUtil.kit("pf/gold-ingot-85e62e", 0.24)
				if ig:
					ig.position = Vector3(0.10, k * 0.08, -0.03 + k * 0.02)
					ig.rotation_degrees.y = -28.0 + k * 18.0
					g.add_child(ig)
			return [g, Vector2(0.75, 0.72)]

		"pile_chest":
			var ch := MeshUtil.kit("kk/dun/chest_gold", 0.62)
			if ch:
				ch.rotation_degrees.y = 32.0
				g.add_child(ch)
			for p in [Vector3(-0.26, 0, 0.14), Vector3(0.28, 0, 0.10)]:
				var cs := MeshUtil.kit("pf/gold-coin-stack-a9ef52", 0.26)
				if cs:
					cs.position = p
					g.add_child(cs)
			return [g, Vector2(1.05, 1.05)]
	return [g, Vector2(1.0, 1.0)]


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=", true, 1)
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"
	var only: Array = str(args.get("only", "")).split(",", false)

	var vp := SubViewport.new()
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
	cam.near = 0.1
	cam.far = 80.0
	vp.add_child(cam)

	var key := DirectionalLight3D.new()
	vp.add_child(key)
	key.look_at_from_position(Vector3(-0.85, 2.4, 1.5), Vector3.ZERO)
	key.light_energy = 0.98
	key.light_color = Color("#fff5e6")
	key.shadow_enabled = true
	key.shadow_opacity = 0.38
	key.shadow_blur = 1.5

	var fill := DirectionalLight3D.new()
	vp.add_child(fill)
	fill.look_at_from_position(Vector3(1.2, 0.5, 1.3), Vector3.ZERO)
	fill.light_energy = 0.25
	fill.light_color = Color("#ffe8f4")

	var rim := DirectionalLight3D.new()
	vp.add_child(rim)
	rim.look_at_from_position(Vector3(1.6, 1.2, -1.6), Vector3.ZERO)
	rim.light_energy = 0.42
	rim.light_color = Color("#d8e6ff")

	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://assets/props2d"))
	var ids := ["andon", "torii", "torii_r",
		"corner_start", "corner_island", "corner_festival", "corner_airport",
		"pile_coin", "pile_ingot", "pile_chest"]

	for id in ids:
		if not only.is_empty() and not (id in only):
			continue
		var built := _build_prop(id)
		var m: Node3D = built[0]
		var fw: Vector2 = built[1]
		vp.add_child(m)
		var size := Vector2i(int(fw.x * PX), int(fw.y * PX))
		vp.size = size * SS
		cam.size = fw.y
		var up := Vector3(-1, 2, -1).normalized()
		var foot_off := fw.y * (0.5 - 0.12)
		var target := up * foot_off
		cam.position = target + Vector3(1, 1, 1).normalized() * 20.0
		cam.look_at(target, Vector3.UP)
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		var img := vp.get_texture().get_image()
		img.convert(Image.FORMAT_RGBA8)
		img.resize(size.x, size.y, Image.INTERPOLATE_LANCZOS)
		img.save_png(ProjectSettings.globalize_path("res://assets/props2d/%s.png" % id))
		print("ok prop %s %dx%d" % [id, size.x, size.y])
		m.queue_free()
		await get_tree().process_frame

	if args.has("ui"):
		await _render_ui_dice(vp, cam, key)

	get_tree().quit()


func _render_ui_dice(vp: SubViewport, cam: Camera3D, key: DirectionalLight3D) -> void:
	var raw_dir := ProjectSettings.globalize_path("res://../.ui_raw/dice")
	DirAccess.make_dir_recursive_absolute(raw_dir)
	var P := 192
	vp.size = Vector2i(P * SS, P * SS)
	cam.projection = Camera3D.PROJECTION_PERSPECTIVE
	cam.fov = 26.0
	cam.position = Vector3(1.12, 1.24, 1.38)
	cam.look_at(Vector3(0, -0.02, 0), Vector3.UP)
	key.look_at_from_position(Vector3(-0.7, 2.5, 1.9), Vector3.ZERO)

	var helper := Pieces.new()
	var die := helper._die_node()
	vp.add_child(die)
	for skin in Pieces.DICE_KEYS:
		(die.get_meta("body") as MeshInstance3D).material_override = Pieces.dice_body_mat(skin)
		var faces: Array = die.get_meta("faces")
		for f in 6:
			faces[f].material_override = helper.dice_mat(skin, Pieces.FACE_N[f])
		# Mặt trên là 1 cho bộ sakura/cosmos (khoe bông hoa anh đào / tinh cầu vành đai) hoặc 5 cho các bộ khác
		var top_n := 1 if skin in ["sakura", "cosmos"] else 5
		die.quaternion = helper._quat_for(top_n, 0.12)
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		var img := vp.get_texture().get_image()
		img.convert(Image.FORMAT_RGBA8)
		img.resize(P, P, Image.INTERPOLATE_LANCZOS)
		img.save_png("%s/%s.png" % [raw_dir, skin])
		print("ok ui die %s" % skin)
	die.queue_free()
	helper.free()
	await get_tree().process_frame
