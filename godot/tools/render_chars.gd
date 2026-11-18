extends Node
## Kết xuất 12 nhân vật hình người 3D (TokenModels) thành chân dung UI trên bệ vàng (320×320, tự động cắt khung theo vùng alpha sao cho nhân vật chiếm ~91% chiều cao)
## tại .ui_raw/chars/c0..c11.png (fix_chars.py sẽ chuyển sang assets/ui/chars/*.webp).
## Chạy (cần cửa sổ, không --headless):
##   godot --path godot res://tools/render_chars.tscn [-- --only=0,5]
## Sau đó chạy: python godot/tools/fix_chars.py --force

const PORT_PX := 320
const PORT_SS := 768
const FILL_PX := 292
const SS := 2

var args := {}


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.trim_prefix("--").split("=", true, 1)
		args[kv[0]] = kv[1] if kv.size() > 1 else "1"

	var vp := SubViewport.new()
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_8X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)

	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color("#e8f0ff")
	sky_mat.sky_horizon_color = Color("#fff2f7")
	sky_mat.ground_horizon_color = Color("#ece0ea")
	sky_mat.ground_bottom_color = Color("#c8b2d2")
	var sky := Sky.new()
	sky.sky_material = sky_mat
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_sky_contribution = 0.56
	env.ambient_light_color = Color("#fff5fb")
	env.ambient_light_energy = 0.46
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.tonemap_exposure = 0.96
	we.environment = env
	vp.add_child(we)

	var cam := Camera3D.new()
	cam.near = 0.1
	cam.far = 40.0
	vp.add_child(cam)

	var key := DirectionalLight3D.new()
	vp.add_child(key)
	key.look_at_from_position(Vector3(-1.0, 2.5, 2.2), Vector3.ZERO)
	key.light_energy = 1.08
	key.light_color = Color("#fff7ed")
	key.shadow_enabled = true
	key.shadow_opacity = 0.28
	key.shadow_blur = 1.8
	key.directional_shadow_max_distance = 12.0

	var fill := DirectionalLight3D.new()
	vp.add_child(fill)
	fill.look_at_from_position(Vector3(1.6, 0.8, 1.6), Vector3.ZERO)
	fill.light_energy = 0.40
	fill.light_color = Color("#ffebf4")

	var rim := DirectionalLight3D.new()
	vp.add_child(rim)
	rim.look_at_from_position(Vector3(1.5, 1.5, -1.9), Vector3.ZERO)
	rim.light_energy = 0.58
	rim.light_color = Color("#dce8ff")

	var only: Array = []
	if args.has("only"):
		for s in str(args.only).split(","):
			only.append(int(s))

	var raw_dir := ProjectSettings.globalize_path("res://../.ui_raw/chars")
	DirAccess.make_dir_recursive_absolute(raw_dir)

	# Góc xoay 3/4 tinh tế khoe trọn biểu cảm mắt, trang phục và đạo cụ tay phải
	var ui_yaws := [0.34, 0.30, 0.34, 0.32, 0.32, 0.30, 0.32, 0.34, 0.34, 0.32, 0.30, 0.34]

	for k in 12:
		if not only.is_empty() and not (k in only):
			continue

		# Ảnh chân dung UI chất lượng cao (768×768 -> auto-crop sát khung 320×320)
		vp.size = Vector2i(PORT_SS, PORT_SS)
		cam.projection = Camera3D.PROJECTION_PERSPECTIVE
		cam.fov = 22.0

		var stage := Node3D.new()
		var plinth := TokenModels.plinth()
		stage.add_child(plinth)
		var rig := TokenModels.build(k)
		(rig.root as Node3D).position.y = 0.065
		(rig.root as Node3D).rotation.y = ui_yaws[k]
		TokenModels.animate(rig, 0.22, "idle", 0.0, 1.0, false)
		stage.add_child(rig.root)
		vp.add_child(stage)

		var bb := MeshUtil.visible_aabb(stage)
		var aim := bb.position + bb.size * 0.5
		var span := maxf(bb.size.y, maxf(bb.size.x, bb.size.z))
		var dist := (span * 0.60) / tan(deg_to_rad(cam.fov * 0.5))
		cam.look_at_from_position(aim + Vector3(0.0, 0.22, 1.0).normalized() * dist, aim, Vector3.UP)

		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		var raw_img := vp.get_texture().get_image()
		raw_img.convert(Image.FORMAT_RGBA8)
		var out_img := _tight_frame_portrait(raw_img)
		out_img.save_png("%s/c%d.png" % [raw_dir, k])
		print("ok portrait c%d" % k)
		stage.queue_free()
		await get_tree().process_frame

	get_tree().quit()


func _tight_frame_portrait(src: Image) -> Image:
	## Cắt sát hộp alpha thực tế của nhân vật + bệ và co giãn vừa khít ~91% khung 320×320.
	var w := src.get_width()
	var h := src.get_height()
	var x0 := w
	var y0 := h
	var x1 := -1
	var y1 := -1
	for y in h:
		for x in w:
			if src.get_pixel(x, y).a > 0.015:
				if x < x0: x0 = x
				if x > x1: x1 = x
				if y < y0: y0 = y
				if y > y1: y1 = y
	if x1 < x0 or y1 < y0:
		var fallback := src.duplicate()
		fallback.resize(PORT_PX, PORT_PX, Image.INTERPOLATE_LANCZOS)
		return fallback

	var bw := x1 - x0 + 1
	var bh := y1 - y0 + 1
	var crop := src.get_region(Rect2i(x0, y0, bw, bh))
	var scale := float(FILL_PX) / float(maxi(bw, bh))
	var tw := maxi(1, int(round(float(bw) * scale)))
	var th := maxi(1, int(round(float(bh) * scale)))
	crop.resize(tw, th, Image.INTERPOLATE_LANCZOS)

	var canvas := Image.create(PORT_PX, PORT_PX, false, Image.FORMAT_RGBA8)
	canvas.fill(Color(0, 0, 0, 0))
	var dx := (PORT_PX - tw) / 2
	var dy := PORT_PX - th - 12
	if dy < (PORT_PX - th) / 2:
		dy = (PORT_PX - th) / 2
	canvas.blit_rect(crop, Rect2i(0, 0, tw, th), Vector2i(dx, dy))
	return canvas
