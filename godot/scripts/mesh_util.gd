class_name MeshUtil
## Tiện ích dựng hình: khối hộp bo tròn, nạp mô hình glTF có co giãn, vật liệu nhanh.

static var _mat_cache := {}
static var _kit_cache := {}


## Khối hộp bo tròn mọi cạnh (giống RoundedBoxGeometry của Three.js), pháp tuyến mượt.
static func rounded_box(size: Vector3, r: float, seg := 4) -> ArrayMesh:
	r = minf(r, minf(size.x, minf(size.y, size.z)) * 0.5 - 0.0001)
	var h := size * 0.5 - Vector3(r, r, r)
	var rows := []   # [phi, dấu y]
	for i in seg + 1:
		rows.append([PI * 0.5 * i / seg, 1.0])
	for i in seg + 1:
		rows.append([PI * 0.5 + PI * 0.5 * i / seg, -1.0])
	var cols := []   # [theta, dấu x, dấu z]
	var signs := [[1.0, 1.0], [-1.0, 1.0], [-1.0, -1.0], [1.0, -1.0]]
	for q in 4:
		for j in seg + 1:
			cols.append([PI * 0.5 * q + PI * 0.5 * j / seg, signs[q][0], signs[q][1]])
	var verts := PackedVector3Array()
	var norms := PackedVector3Array()
	var uvs := PackedVector2Array()
	for rw in rows:
		for cl in cols:
			var n := Vector3(sin(rw[0]) * cos(cl[0]), cos(rw[0]), sin(rw[0]) * sin(cl[0]))
			var p: Vector3 = n * r + Vector3(cl[1] * h.x, rw[1] * h.y, cl[2] * h.z)
			verts.append(p)
			norms.append(n)
			uvs.append(Vector2(p.x / size.x + 0.5, p.z / size.z + 0.5))
	var idx := PackedInt32Array()
	var nc := cols.size()
	for a in rows.size() - 1:
		for b in nc:
			var b2 := (b + 1) % nc
			var i0 := a * nc + b
			var i1 := a * nc + b2
			var i2 := (a + 1) * nc + b
			var i3 := (a + 1) * nc + b2
			idx.append_array([i0, i1, i2, i1, i3, i2])
	# nắp trên + nắp dưới (phần phẳng giữa)
	var base := verts.size()
	for sy in [1.0, -1.0]:
		var y: float = sy * (h.y + r)
		for c in [Vector2(h.x, h.z), Vector2(-h.x, h.z), Vector2(-h.x, -h.z), Vector2(h.x, -h.z)]:
			verts.append(Vector3(c.x, y, c.y))
			norms.append(Vector3(0, sy, 0))
			uvs.append(Vector2(c.x / size.x + 0.5, c.y / size.z + 0.5))
	idx.append_array([base, base + 2, base + 1, base, base + 3, base + 2])
	idx.append_array([base + 4, base + 5, base + 6, base + 4, base + 6, base + 7])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = norms
	arr[Mesh.ARRAY_TEX_UV] = uvs
	arr[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return m


static func std(color: Color, rough := 0.75, metal := 0.0, extra := {}) -> StandardMaterial3D:
	var key := "%s|%s|%s|%s" % [color.to_html(), rough, metal, str(extra)]
	if _mat_cache.has(key):
		return _mat_cache[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	for k in extra:
		m.set(k, extra[k])
	_mat_cache[key] = m
	return m


static func emissive(color: Color, glow: Color, energy: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.emission_enabled = true
	m.emission = glow
	m.emission_energy_multiplier = energy
	m.roughness = 0.25
	return m


static func mesh(m: Mesh, mat: Material = null, pos := Vector3.ZERO, shadow := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = m
	if mat:
		mi.material_override = mat
	mi.position = pos
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadow else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


static func cyl(top_r: float, bot_r: float, h: float, segs := 24) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.top_radius = top_r
	c.bottom_radius = bot_r
	c.height = h
	c.radial_segments = segs
	c.rings = 1
	return c


static func sphere(r: float, segs := 24) -> SphereMesh:
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2
	s.radial_segments = segs
	s.rings = segs / 2
	return s


## Hộp bao của các mesh nhìn thấy được (theo toạ độ của gốc `root`)
static func visible_aabb(root: Node3D) -> AABB:
	var out := AABB()
	var first := true
	var inv := root.global_transform.affine_inverse() if root.is_inside_tree() else Transform3D.IDENTITY
	var stack: Array = [[root, Transform3D.IDENTITY]]
	while stack.size():
		var it: Array = stack.pop_back()
		var n: Node = it[0]
		var tf: Transform3D = it[1]
		if n is Node3D and n != root:
			tf = tf * (n as Node3D).transform
		if n is VisualInstance3D and n.visible and (n is MeshInstance3D):
			var bb: AABB = tf * (n as MeshInstance3D).get_aabb()
			out = bb if first else out.merge(bb)
			first = false
		for c in n.get_children():
			stack.append([c, tf])
	return out


## Nạp mô hình glTF (res://assets/models/<name>.glb|.gltf) và co giãn:
## fit = cạnh ngang lớn nhất, h = chiều cao, hmax = chiều cao tối đa. Gốc toạ độ đặt ở đáy, giữa.
static func kit(name: String, fit := 0.0, h := 0.0, hmax := 0.0) -> Node3D:
	var scn: PackedScene = _kit_cache.get(name)
	if scn == null:
		for ext in [".glb", ".gltf"]:
			var p: String = "res://assets/models/" + name + ext
			if ResourceLoader.exists(p):
				scn = load(p)
				break
		if scn == null:
			push_warning("thiếu mô hình " + name)
			return null
		_kit_cache[name] = scn
		_fix_vertex_colors(scn.instantiate())
	var inner: Node3D = scn.instantiate()
	var bb := visible_aabb(inner)
	var s := 1.0
	if fit > 0:
		s = fit / maxf(bb.size.x, bb.size.z)
	if h > 0:
		s = h / bb.size.y
	if hmax > 0 and bb.size.y * s > hmax:
		s = hmax / bb.size.y
	var wrap := Node3D.new()
	wrap.name = name.get_file()
	inner.scale = Vector3.ONE * s
	inner.position = Vector3(-(bb.position.x + bb.size.x * 0.5) * s, -bb.position.y * s, -(bb.position.z + bb.size.z * 0.5) * s)
	wrap.add_child(inner)
	wrap.set_meta("height", bb.size.y * s)
	set_shadows(wrap, true)
	return wrap


## Mô hình Polyfork tô màu bằng màu đỉnh (COLOR_0): bật dùng màu đỉnh cho vật liệu (sửa 1 lần, dùng chung)
static func _fix_vertex_colors(root: Node) -> void:
	var stack: Array = [root]
	while stack.size():
		var n: Node = stack.pop_back()
		stack.append_array(n.get_children())
		if not (n is MeshInstance3D) or (n as MeshInstance3D).mesh == null:
			continue
		var m: Mesh = (n as MeshInstance3D).mesh
		for s in m.get_surface_count():
			if not (m.surface_get_format(s) & Mesh.ARRAY_FORMAT_COLOR):
				continue
			var mat = m.surface_get_material(s)
			if mat is BaseMaterial3D and not mat.vertex_color_use_as_albedo:
				mat.vertex_color_use_as_albedo = true
			elif mat == null:
				var sm := StandardMaterial3D.new()
				sm.vertex_color_use_as_albedo = true
				sm.roughness = 0.8
				m.surface_set_material(s, sm)
	root.free()


static func set_shadows(n: Node, on: bool) -> void:
	if n is GeometryInstance3D:
		n.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if on else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for c in n.get_children():
		set_shadows(c, on)


## Số ngẫu nhiên cố định theo hạt giống (cảnh giống nhau mỗi lần mở)
class Seeded:
	var s: int

	func _init(seed: int) -> void:
		s = seed & 0xffffffff

	func next() -> float:
		s = (s * 1664525 + 1013904223) & 0xffffffff
		return s / 4294967296.0

	func range(a: float, b: float) -> float:
		return a + next() * (b - a)
