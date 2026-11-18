class_name TokenModels
extends RefCounted
## Bộ nạp 12 Nhân Vật Hình Người 3D Business Tour được tùy biến & gắn xương (rigged .glb) từ Blender 4.2 LTS.
## Mỗi nhân vật chứa 6 hoạt ảnh xương mượt: idle, walk, jump, cheer, hit, die.
## Quy ước: mặt trước hướng +Z, trục đứng +Y, đáy mô hình tiếp xúc y = 0, tâm chân đặt tại (0, 0).

static var _scene_cache := {}
static var _mat_cache := {}


static func _mat_plinth(col: Color, rough := 0.25, metal := 0.5) -> StandardMaterial3D:
	var key := "%s|%.2f|%.2f" % [col.to_html(), rough, metal]
	if _mat_cache.has(key):
		return _mat_cache[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.roughness = rough
	m.metallic = metal
	m.clearcoat_enabled = true
	m.clearcoat = 0.35
	_mat_cache[key] = m
	return m


static func _setup_anims(ap: AnimationPlayer) -> Dictionary:
	var map := {}
	if ap == null:
		return map
	ap.playback_default_blend_time = 0.16
	for anim_name in ap.get_animation_list():
		var low := String(anim_name).to_lower()
		var anim := ap.get_animation(anim_name)
		if anim:
			if "idle" in low or "walk" in low:
				anim.loop_mode = Animation.LOOP_LINEAR
			else:
				anim.loop_mode = Animation.LOOP_NONE
		for key in ["idle", "walk", "jump", "cheer", "hit", "die"]:
			if low == key or (not map.has(key) and key in low):
				map[key] = anim_name
	return map


static func _scene_for(k: int) -> PackedScene:
	if _scene_cache.has(k):
		return _scene_cache[k]
	var path := "res://assets/models/bt_chars/c%d.glb" % k
	var scn: PackedScene = load(path) if ResourceLoader.exists(path) else null
	_scene_cache[k] = scn
	return scn


## Đế trưng bày vàng kim & xanh hoàng gia (tương thích tools/render_chars.gd)
static func plinth() -> Node3D:
	var g := Node3D.new()
	var gold := _mat_plinth(Color("#f5be3e"), 0.18, 0.90)
	var navy := _mat_plinth(Color("#123466"), 0.26, 0.28)
	var rim := MeshUtil.mesh(MeshUtil.cyl(0.30, 0.325, 0.056, 36), gold, Vector3(0, 0.028, 0))
	var top := MeshUtil.mesh(MeshUtil.cyl(0.275, 0.28, 0.058, 36), navy, Vector3(0, 0.030, 0))
	g.add_child(rim)
	g.add_child(top)
	return g


static func build(id: int) -> Dictionary:
	var k := posmod(id, 12)
	var inner := Node3D.new()
	var ap: AnimationPlayer = null
	var anim_map := {}

	var scn := _scene_for(k)
	if scn:
		var inst := scn.instantiate() as Node3D
		if inst:
			inner.add_child(inst)
			MeshUtil.set_shadows(inst, true)
			ap = inst.find_child("AnimationPlayer", true, false) as AnimationPlayer
			anim_map = _setup_anims(ap)
			if ap and anim_map.has("idle"):
				ap.play(anim_map["idle"])
				ap.advance(0.18)

	# Tính chiều cao cơ thể chuẩn từ AABB cục bộ của thân người (bỏ qua phụ kiện đội đầu / cầm tay để mọi nhân vật cao đồng đều)
	var min_y := INF
	var max_y := -INF
	for mi in inner.find_children("*", "MeshInstance3D", true, false):
		var m_inst := mi as MeshInstance3D
		if m_inst.mesh == null or not ("H_DDS" in m_inst.name):
			continue
		var bb := m_inst.get_aabb()
		min_y = minf(min_y, bb.position.y)
		max_y = maxf(max_y, bb.position.y + bb.size.y)
	if min_y == INF:
		min_y = 0.0
		max_y = 1.84
	var s := 1.06 / maxf(max_y - min_y, 0.01)
	inner.scale = Vector3.ONE * s
	inner.position = Vector3(0.0, -min_y * s, 0.0)

	var pivot := Node3D.new()
	pivot.add_child(inner)
	var root := Node3D.new()
	root.add_child(pivot)
	return {"id": k, "root": root, "pivot": pivot, "inner": inner, "anim_player": ap, "anim_map": anim_map, "anim_state": "idle", "parts": {}}


static func animate(rig: Dictionary, _t: float, state: String, prog: float, move_spd := 1.0, active := false, _dt := 0.016) -> void:
	if rig.is_empty():
		return
	var pivot: Node3D = rig.pivot
	var ap: AnimationPlayer = rig.get("anim_player", null)
	var anim_map: Dictionary = rig.get("anim_map", {})

	var key := state if anim_map.has(state) else "idle"
	if ap and anim_map.has(key):
		var target_anim: StringName = anim_map[key]
		if rig.get("anim_state", "") != key:
			rig["anim_state"] = key
			ap.play(target_anim, 0.14)
			if key in ["jump", "cheer", "hit", "die"]:
				ap.seek(0.0, true)
		elif not ap.is_playing() and key in ["idle", "walk"]:
			ap.play(target_anim, 0.1)
		match key:
			"walk":
				ap.speed_scale = 1.40 * move_spd
			"jump":
				ap.speed_scale = 1.25
			"idle":
				ap.speed_scale = 1.18 if active else 0.92
			_:
				ap.speed_scale = 1.0

	# Hiệu ứng xoay ăn mừng nhẹ trên trục đứng giữ nguyên dáng xương
	if state == "cheer":
		var u := clampf(prog, 0.0, 1.0)
		pivot.rotation.y = TAU * u
	else:
		pivot.rotation.y = 0.0
