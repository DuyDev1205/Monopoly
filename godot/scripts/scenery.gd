class_name Scenery
extends Node3D
## Cảnh nền quanh bàn cờ theo theme. Camera nhìn chéo từ trên xuống nên khung hình chỉ thấy mặt đất quanh bàn:
## bàn cờ là hình thoi ở giữa, cảnh được bố trí có chủ đích vào 4 tam giác quanh nó
##   trên-trái: hồ nước + cầu + anh đào     trên-phải: chùa tháp + rừng tre + anh đào
##   dưới-trái: cổng torii + lối đá + đèn đá  dưới-phải: vườn đá + thông cảnh + ghế đá
## Toạ độ màn hình (u: sang phải, v: lên xa) đổi ra thế giới bằng at(u, v).

const TOP := -0.95                  # mặt đất (ngang đế bàn cờ)
const EXTENT := 30.0                # nửa cạnh vùng đất có cỏ

const THEMES := {
	"sakura": {
		"grass_a": "#9cc46e", "grass_b": "#77a85a", "dry": "#c6c98a", "bank": "#8a7666", "petal": "#ffd3e2", "petal_amt": 0.35,
		"blade_base": "#4a7a3c", "blade_tip": "#b5d68a", "fall": "#ffc6da",
		"tree": "pf/cherry-blossom-tree-3f7ab7", "accent": "pf/japanese-maple-d2fb29", "pine": "pf/sculpted-pine-e45d4f",
		"bush": "pf/azalea-bush-7bb14d", "pond": true, "torii": true, "pagoda": true,
	},
	"wood": {
		"grass_a": "#93b85a", "grass_b": "#6f9a45", "dry": "#c9b46a", "bank": "#7a6248", "petal": "#e8923a", "petal_amt": 0.25,
		"blade_base": "#5a6a2c", "blade_tip": "#cfc46a", "fall": "#e8a040",
		"tree": "pf/maple-tree-65fa12", "accent": "pf/broadleaf-oak-997c22", "pine": "pf/tall-pine-tree-ab4108",
		"bush": "pf/round-bush-cd2ac0", "pond": true, "torii": false, "pagoda": false,
	},
	"ocean": {
		"grass_a": "#e8d7a0", "grass_b": "#dcc88a", "dry": "#f2e6be", "bank": "#c9a464", "petal": "#ffffff", "petal_amt": 0.0,
		"blade_base": "#6f8f4a", "blade_tip": "#c9d98a", "fall": "",
		"tree": "pf/palm-tree-a307da", "accent": "pf/palm-sapling-ef7ae4", "pine": "pf/tamarisk-bush-ba4337",
		"bush": "pf/marram-grass-tuft-8c7a99", "pond": false, "torii": false, "pagoda": false, "sand": true,
	},
	"midnight": {
		"grass_a": "#4f7a4a", "grass_b": "#3b5a3a", "dry": "#5d7650", "bank": "#3a3040", "petal": "#cfe0ff", "petal_amt": 0.0,
		"blade_base": "#22402a", "blade_tip": "#5f8f5a", "fall": "",
		"tree": "pf/tall-pine-tree-ab4108", "accent": "pf/birch-tree-181b33", "pine": "pf/young-pine-0d7695",
		"bush": "pf/round-bush-cd2ac0", "pond": true, "torii": true, "pagoda": true, "night": true,
	},
}

var theme := ""
var root: Node3D
var ground_mat: ShaderMaterial
var noise_tex: NoiseTexture2D
var tree_tpl := {}
var rng := RandomNumberGenerator.new()
var occupied: Array = []            # [Vector2 xz, bán kính] chỗ đã đặt đồ (để cỏ / đồ khác tránh)
var fall: GPUParticles3D
var pond_c := Vector2.ZERO
var pond_r := 2.2


static func at(u: float, v: float, y := TOP) -> Vector3:
	return Vector3((u - v) / sqrt(2.0), y, (-u - v) / sqrt(2.0))


func _ready() -> void:
	noise_tex = NoiseTexture2D.new()
	var fn := FastNoiseLite.new()
	fn.frequency = 0.02
	fn.fractal_octaves = 4
	noise_tex.noise = fn
	noise_tex.seamless = true
	noise_tex.width = 512
	noise_tex.height = 512
	noise_tex.generate_mipmaps = true


func set_theme(name: String) -> void:
	if name == theme:
		return
	theme = name if THEMES.has(name) else "sakura"
	if root:
		root.queue_free()
	boats.clear()
	root = Node3D.new()
	root.name = "scene_" + theme
	add_child(root)
	occupied.clear()
	rng.seed = hash(theme)
	var P: Dictionary = THEMES[theme]
	pond_c = Vector2(at(-8.6, 5.4).x, at(-8.6, 5.4).z)
	_build_ground(P)
	if P.get("pond"):
		_build_pond(P)
	if P.get("sand"):
		_build_sea()
	if P.get("torii"):
		_build_torii()
	_build_landmarks(P)
	_build_trees(P)
	_build_grass(P)
	if P.fall != "":
		_build_fall(P)


func _free(x: float, z: float, pad := 0.0) -> bool:
	if absf(x) < Board.W / 2 + 0.75 + pad and absf(z) < Board.W / 2 + 0.75 + pad:
		return false
	for o in occupied:
		if Vector2(x, z).distance_to(o[0]) < o[1] + pad:
			return false
	return true


func _occupy(p: Vector3, r: float) -> void:
	occupied.append([Vector2(p.x, p.z), r])


func _place(name: String, p: Vector3, opts := {}) -> Node3D:
	var m := MeshUtil.kit(name, opts.get("fit", 0.0), opts.get("h", 0.0), opts.get("hmax", 0.0))
	if m == null:
		return null
	m.position = p
	m.rotation.y = opts.get("ry", rng.randf() * TAU)
	root.add_child(m)
	if opts.has("occupy"):
		_occupy(p, opts.occupy)
	return m


# ======================= mặt đất =======================
func _height(x: float, z: float) -> float:
	var h := 0.0
	var r := Vector2(x, z).length()
	# nhấp nhô nhẹ ở xa, gò đồi ngoài rìa
	h += (sin(x * 0.21) * cos(z * 0.17) + sin(x * 0.07 + z * 0.11) * 1.5) * 0.12 * smoothstep(9.0, 16.0, r)
	if THEMES[theme].get("sand"):
		h -= smoothstep(11.0, 14.5, r) * 1.1      # bãi cát thoải dần xuống biển
	else:
		h += smoothstep(22.0, 30.0, r) * 2.5
	# lòng hồ
	if THEMES[theme].get("pond"):
		var d := Vector2(x, z).distance_to(pond_c) / _pond_radius(Vector2(x, z))
		h -= 0.42 * smoothstep(1.15, 0.7, d)
	return h


func _pond_radius(p: Vector2) -> float:
	var a := (p - pond_c).angle()
	return pond_r * (1.0 + 0.13 * sin(a * 3.0 + 0.6) + 0.07 * sin(a * 5.0 + 2.0))


func _build_ground(P: Dictionary) -> void:
	var res := 0.5
	var n := int(EXTENT * 2 / res)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for j in n + 1:
		for i in n + 1:
			var x := -EXTENT + i * res
			var z := -EXTENT + j * res
			var wet := 0.0
			if P.get("sand"):
				wet = smoothstep(11.6, 12.8, Vector2(x, z).length())
			if P.get("pond"):
				var d := Vector2(x, z).distance_to(pond_c) / _pond_radius(Vector2(x, z))
				wet = smoothstep(1.35, 0.95, d)
			st.set_color(Color(wet, 0, 0))
			st.set_uv(Vector2(x, z))
			st.add_vertex(Vector3(x, TOP + _height(x, z), z))
	for j in n:
		for i in n:
			var a := j * (n + 1) + i
			st.add_index(a)
			st.add_index(a + 1)
			st.add_index(a + n + 1)
			st.add_index(a + 1)
			st.add_index(a + n + 2)
			st.add_index(a + n + 1)
	st.generate_normals()
	ground_mat = ShaderMaterial.new()
	ground_mat.shader = load("res://scripts/ground.gdshader")
	ground_mat.set_shader_parameter("noise", noise_tex)
	ground_mat.set_shader_parameter("grass_a", Color(P.grass_a))
	ground_mat.set_shader_parameter("grass_b", Color(P.grass_b))
	ground_mat.set_shader_parameter("grass_dry", Color(P.dry))
	ground_mat.set_shader_parameter("bank", Color(P.bank))
	ground_mat.set_shader_parameter("petal", Color(P.petal))
	ground_mat.set_shader_parameter("petal_amt", P.petal_amt)
	var g := MeshUtil.mesh(st.commit(), ground_mat, Vector3.ZERO, false)
	root.add_child(g)


# ======================= hồ nước + cầu + súng + sậy + đá viền =======================
func _build_pond(P: Dictionary) -> void:
	var wm := ShaderMaterial.new()
	wm.shader = load("res://scripts/water.gdshader")
	wm.set_shader_parameter("noise", noise_tex)
	if theme == "midnight":
		wm.set_shader_parameter("deep", Color("#0d2340"))
		wm.set_shader_parameter("shallow", Color("#2a4f70"))
	var disc := MeshUtil.cyl(pond_r * 1.2, pond_r * 1.2, 0.001, 64)
	var w := MeshUtil.mesh(disc, wm, Vector3(pond_c.x, TOP - 0.12, pond_c.y), false)
	root.add_child(w)
	_occupy(Vector3(pond_c.x, 0, pond_c.y), pond_r * 1.05)
	# đá viền bờ
	for k in 30:
		var a := TAU * k / 30 + rng.randf() * 0.15
		var p := Vector2(pond_c.x, pond_c.y) + Vector2(cos(a), sin(a)) * _pond_radius(pond_c + Vector2(cos(a), sin(a))) * (1.02 + rng.randf() * 0.08)
		_place("pf/garden-rock-2d3b51", Vector3(p.x, TOP + _height(p.x, p.y) - 0.04, p.y), {"fit": 0.3 + rng.randf() * 0.3, "hmax": 0.25})
	# súng
	for k in 10:
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * (pond_r - 0.6)
		_place("pf/lily-pad-86edbb", Vector3(pond_c.x + cos(a) * r, TOP - 0.115, pond_c.y + sin(a) * r), {"fit": 0.35 + rng.randf() * 0.2, "hmax": 0.08})
	# sậy phía xa
	for k in 9:
		var a := deg_to_rad(200 + rng.randf() * 80)
		var p := pond_c + Vector2(cos(a), sin(a)) * (pond_r - 0.1)
		_place("pf/cattail-reed-6abbb3", Vector3(p.x, TOP - 0.1, p.y), {"fit": 0.35, "hmax": 0.75 + rng.randf() * 0.3})
	# cầu gỗ bắc ngang hồ
	_place("pf/moat-bridge-4fbcd9", Vector3(pond_c.x, TOP - 0.02, pond_c.y), {"fit": pond_r * 2.3, "hmax": 0.9, "ry": PI / 4})


# ======================= biển quanh đảo cát + thuyền =======================
var boats: Array = []


func _build_sea() -> void:
	var wm := ShaderMaterial.new()
	wm.shader = load("res://scripts/water.gdshader")
	wm.set_shader_parameter("noise", noise_tex)
	wm.set_shader_parameter("deep", Color("#0a7fa0"))
	wm.set_shader_parameter("shallow", Color("#58d6d0"))
	wm.set_shader_parameter("flow", Vector2(0.12, 0.08))
	var sea := MeshUtil.mesh(MeshUtil.cyl(90, 90, 0.001, 96), wm, Vector3(0, TOP - 0.38, 0), false)
	root.add_child(sea)
	for k in 3:
		var b := MeshUtil.kit("pf/small-fishing-boat-4ac0e3", 2.2)
		if b:
			root.add_child(b)
			boats.append({"n": b, "r": 16.0 + k * 3.0, "sp": 0.05 if k % 2 == 0 else -0.04, "a": k * 2.2})
	# dừa + phi lao dọc bãi
	for k in 22:
		var a := TAU * k / 22 + rng.randf() * 0.15
		var r := 9.0 + rng.randf() * 2.6
		var p := Vector3(cos(a) * r, 0, sin(a) * r)
		p.y = TOP + _height(p.x, p.z)
		if not _free(p.x, p.z, 0.4):
			continue
		if p.x + p.z > 2.0:     # phía gần camera: chỉ đồ thấp để không che bàn cờ
			_place(["pf/marram-grass-tuft-8c7a99", "pf/driftwood-log-89a68f", "pf/garden-rock-2d3b51"][k % 3], p, {"fit": 0.6 + rng.randf() * 0.4, "hmax": 0.4, "occupy": 0.4})
		else:
			_put_tree("pf/palm-tree-a307da" if k % 3 else "pf/palm-sapling-ef7ae4", p, 2.2 + rng.randf() * 1.2)


func _process(dt: float) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	for b in boats:
		b.a += b.sp * dt
		var n: Node3D = b.n
		if not is_instance_valid(n):
			continue
		n.position = Vector3(cos(b.a) * b.r, TOP - 0.42 + sin(t * 1.5 + b.r) * 0.05, sin(b.a) * b.r)
		n.rotation = Vector3(0, -b.a - (PI / 2 if b.sp > 0 else -PI / 2), sin(t * 1.2 + b.r) * 0.04)


# ======================= cổng torii + lối đá + đèn đá (dưới-trái) =======================
func _build_torii() -> void:
	var gate := at(-10.6, -3.2)
	_place("pf/torii-gate-402f30", gate, {"h": 2.4, "ry": atan2(-gate.x, -gate.z), "occupy": 1.2})
	var end := at(-7.0, -0.9)
	for k in 11:
		var u := k / 10.0
		var p := gate.lerp(end, u) + Vector3(sin(u * 5.0) * 0.12, 0.005, 0)
		_place("pf/round-path-stone-4130f3", p, {"fit": 0.48 + rng.randf() * 0.1, "hmax": 0.07, "occupy": 0.35})
	var dir := (end - gate).normalized()
	var side := Vector3(-dir.z, 0, dir.x)
	for u in [0.3, 0.75]:
		for sd in [-1, 1]:
			var p: Vector3 = gate.lerp(end, u) + side * 0.8 * sd
			var l := _place("pf/stone-lantern-d56d0a", p, {"h": 0.85, "occupy": 0.4})
			_lamp(l, Vector3(0, 0.62, 0), 0.6)


func _lamp(parent: Node3D, pos: Vector3, energy: float) -> void:
	if parent == null:
		return
	var ol := OmniLight3D.new()
	ol.light_color = Color("#ffb35a")
	ol.light_energy = energy * (3.0 if THEMES[theme].get("night") else 1.0)
	ol.omni_range = 2.2
	ol.position = pos
	parent.add_child(ol)


# ======================= công trình điểm nhấn (trên-phải, dưới-phải) =======================
func _build_landmarks(P: Dictionary) -> void:
	if P.get("pagoda"):
		_place("pf/tiered-pagoda-f4ade0", at(9.6, 5.6), {"h": 3.6, "ry": PI * 0.25 + PI, "occupy": 1.4})
		_place("pf/small-shrine-hall-cb8b25", at(12.2, 2.4), {"fit": 1.7, "hmax": 1.3, "ry": PI * 0.75, "occupy": 1.0})
		for k in 9:   # rừng tre sau chùa
			var p := at(11.8 + rng.randf() * 3.0, 6.2 + rng.randf() * 3.5)
			if _free(p.x, p.z, 0.2):
				_place("pf/bamboo-stalk-e4d362", p, {"h": 2.4 + rng.randf() * 1.2, "occupy": 0.25})
	if P.get("sand"):
		_place("pf/beach-hut-fc7649", at(9.8, 5.2), {"fit": 2.0, "hmax": 1.8, "ry": PI * 1.25, "occupy": 1.3})
		_place("pf/lifebuoy-on-a-post-57421b", at(8.2, -3.0), {"h": 0.9, "occupy": 0.4})
		_place("pf/striped-deck-chair-70b506", at(10.2, -2.0), {"fit": 0.8, "ry": PI * 1.1, "occupy": 0.6})
		_place("pf/sandcastle-ddc562", at(-8.8, -3.4), {"fit": 0.9, "occupy": 0.6})
	# vườn đá + ghế đá (dưới-phải)
	_place("pf/wooden-bench-661da4", at(9.0, -4.6), {"fit": 1.1, "ry": PI * 0.75, "occupy": 0.7})
	_place("pf/tsukubai-stone-basin-677586", at(11.0, -3.6), {"fit": 0.6, "occupy": 0.45})
	for k in 5:
		_place("pf/garden-rock-2d3b51", at(10.5 + rng.randf() * 2.5, -5.5 + rng.randf() * 2.5), {"fit": 0.5 + rng.randf() * 0.6, "hmax": 0.5, "occupy": 0.4})
	for k in 6:
		var p := at(9.2 + rng.randf() * 4.0, -7.5 + rng.randf() * 3.0)
		if _free(p.x, p.z, 0.2):
			_place(P.bush, p, {"fit": 0.6 + rng.randf() * 0.4, "hmax": 0.7, "occupy": 0.4})
	var sl := _place("pf/stone-lantern-d56d0a", at(12.0, -5.8), {"h": 0.9, "occupy": 0.4})
	_lamp(sl, Vector3(0, 0.62, 0), 0.6)
	var lp := _place("pf/lantern-post-f47665", at(8.3, -6.4), {"h": 1.5, "occupy": 0.4})
	_lamp(lp, Vector3(0, 1.3, 0), 0.8)


# ======================= cây =======================
func _tree(name: String) -> Node3D:
	if not tree_tpl.has(name):
		var t := MeshUtil.kit(name, 0, 1.0)
		if t == null:
			return null
		match name:
			"pf/cherry-blossom-tree-3f7ab7":
				Foliage.apply(t, {"pred": Foliage.is_pink, "kind": "cluster", "count": 6500, "size_k": 0.15, "palette": Foliage.SAKURA, "darken": 0.55, "seed": 3})
			"pf/japanese-maple-d2fb29":
				var pal: Array = Foliage.JMAPLE if theme != "sakura" else ["#7fb04a", "#93c25a", "#6a9a3c", "#a6cc6a"]
				Foliage.apply(t, {"pred": func(c: Color): return Foliage.is_green(c) or (c.r > 0.12 and c.r > c.g * 1.4), "kind": "leafcluster", "count": 4500, "size_k": 0.12, "palette": pal, "darken": 0.5})
			"pf/maple-tree-65fa12":
				Foliage.apply(t, {"pred": Foliage.is_maple, "kind": "leafcluster", "count": 5000, "size_k": 0.12, "palette": Foliage.AUTUMN, "darken": 0.5})
			"pf/broadleaf-oak-997c22":
				Foliage.apply(t, {"kind": "leafcluster", "count": 5000, "size_k": 0.12, "darken": 0.5})
			"pf/birch-tree-181b33":
				Foliage.apply(t, {"kind": "leafcluster", "count": 3500, "size_k": 0.1, "darken": 0.5})
			"pf/tall-pine-tree-ab4108", "pf/sculpted-pine-e45d4f":
				Foliage.apply(t, {"kind": "needle", "count": 6000, "size_k": 0.06, "darken": 0.55})
			"pf/young-pine-0d7695":
				Foliage.apply(t, {"kind": "needle", "count": 4500, "size_k": 0.065, "darken": 0.55})
		tree_tpl[name] = t
	var n: Node3D = tree_tpl[name].duplicate(7)   # không dựng lại từ scene gốc (giữ tán đã chỉnh màu)
	return n


func _put_tree(name: String, p: Vector3, height: float) -> void:
	var t := _tree(name)
	if t == null:
		return
	t.scale = Vector3.ONE * height
	t.position = p
	t.rotation.y = rng.randf() * TAU
	root.add_child(t)
	_occupy(p, 0.5 + height * 0.12)


func _build_trees(P: Dictionary) -> void:
	# cụm cây chính: trên-trái (sau hồ), trên-phải (quanh chùa), hai mép trái/phải, góc dưới
	var spots := [
		[-11.0, 8.6, 3.0], [-6.6, 9.4, 2.6], [-13.6, 4.4, 2.8], [-4.2, 10.6, 2.4], [-9.8, 11.2, 3.2],
		[6.2, 9.6, 2.7], [13.4, 8.2, 3.0], [4.0, 11.0, 2.4], [14.4, 3.6, 2.6],
		[-14.0, -0.6, 2.6], [14.2, -1.2, 2.5],
		[-13.4, -7.6, 2.4], [13.0, -8.4, 2.3],
	]
	for k in spots.size():
		var s: Array = spots[k]
		var p := at(s[0], s[1])
		if not _free(p.x, p.z, 0.3) or (P.get("sand") and Vector2(p.x, p.z).length() > 11.5):
			continue
		var name: String = P.tree
		if k % 5 == 3:
			name = P.accent
		elif k % 7 == 6:
			name = P.pine
		_put_tree(name, p + Vector3(0, _height(p.x, p.z), 0), s[2] * (0.9 + rng.randf() * 0.2))
	# vòng cây bao ngoài (khi camera xoay ở màn chính)
	for k in 26:
		var a := TAU * k / 26 + rng.randf() * 0.1
		var r := 17.0 + rng.randf() * 5.0
		var p := Vector3(cos(a) * r, 0, sin(a) * r)
		p.y = TOP + _height(p.x, p.z)
		if _free(p.x, p.z, 0.5) and not P.get("sand"):
			_put_tree([P.tree, P.pine, P.tree, P.accent][k % 4], p, 2.6 + rng.randf() * 1.4)
	# bụi hoa, bụi cây thấp quanh mép bàn
	for k in 34:
		var a := rng.randf() * TAU
		var r := Board.W / 2 + 1.6 + rng.randf() * 7.0
		var p := Vector3(cos(a) * r, 0, sin(a) * r)
		p.y = TOP + _height(p.x, p.z)
		if _free(p.x, p.z, 0.3):
			_place(P.bush, p, {"fit": 0.5 + rng.randf() * 0.5, "hmax": 0.6, "occupy": 0.35})


# ======================= thảm cỏ (hàng chục nghìn ngọn) =======================
func _blade_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := [[-0.5, 0.0], [0.5, 0.0], [-0.35, 0.45], [0.32, 0.5], [0.05, 1.0]]
	var tri := [[0, 1, 2], [1, 3, 2], [2, 3, 4]]
	for t in tri:
		for i in t:
			st.set_uv(Vector2(pts[i][0] + 0.5, pts[i][1]))
			st.set_normal(Vector3(0, 0.3, 1).normalized())
			st.add_vertex(Vector3(pts[i][0] * 0.03, pts[i][1], pts[i][1] * pts[i][1] * 0.08))
	return st.commit()


func _build_grass(P: Dictionary) -> void:
	if P.get("sand") or "--nograss" in OS.get_cmdline_user_args():
		return
	var count := 70000
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = _blade_mesh()
	var xf: Array[Transform3D] = []
	var cd: Array[Color] = []
	var tries := 0
	while xf.size() < count and tries < count * 3:
		tries += 1
		# dày ở vùng nhìn thấy quanh bàn, thưa dần ra xa
		var r := Board.W / 2 + 0.6 + pow(rng.randf(), 1.4) * 17.0
		var a := rng.randf() * TAU
		var x := cos(a) * r
		var z := sin(a) * r
		if not _free(x, z, 0.05):
			continue
		var h := 0.14 + rng.randf() * 0.16
		var b := Basis(Vector3.UP, rng.randf() * TAU) * Basis(Vector3.RIGHT, (rng.randf() - 0.5) * 0.45) * Basis.from_scale(Vector3(1.0 + rng.randf(), h, 1.0))
		xf.append(Transform3D(b, Vector3(x, TOP + _height(x, z) - 0.01, z)))
		var v := 0.85 + rng.randf() * 0.3
		cd.append(Color(v * (0.95 + rng.randf() * 0.1), v, v * (0.9 + rng.randf() * 0.1)))
	mm.instance_count = xf.size()
	for i in xf.size():
		mm.set_instance_transform(i, xf[i])
		mm.set_instance_custom_data(i, cd[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	var gm := ShaderMaterial.new()
	gm.shader = load("res://scripts/grass.gdshader")
	gm.set_shader_parameter("noise", noise_tex)
	gm.set_shader_parameter("base_col", Color(P.blade_base))
	gm.set_shader_parameter("tip_col", Color(P.blade_tip))
	mmi.material_override = gm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(mmi)


# ======================= cánh hoa / lá rơi =======================
func _build_fall(P: Dictionary) -> void:
	fall = GPUParticles3D.new()
	fall.amount = 420
	fall.lifetime = 12.0
	fall.preprocess = 12.0
	fall.visibility_aabb = AABB(Vector3(-20, -3, -20), Vector3(40, 14, 40))
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(16, 0.5, 16)
	pm.direction = Vector3(0.3, -1, 0.2)
	pm.spread = 25
	pm.initial_velocity_min = 0.25
	pm.initial_velocity_max = 0.6
	pm.gravity = Vector3(0.15, -0.35, 0.1)
	pm.turbulence_enabled = true
	pm.turbulence_noise_strength = 1.2
	pm.turbulence_noise_scale = 4.0
	pm.turbulence_influence_min = 0.05
	pm.turbulence_influence_max = 0.15
	pm.angle_min = 0
	pm.angle_max = 360
	pm.angular_velocity_min = -180
	pm.angular_velocity_max = 180
	pm.scale_min = 0.6
	pm.scale_max = 1.3
	pm.particle_flag_rotate_y = true
	fall.process_material = pm
	var q := QuadMesh.new()
	q.size = Vector2(0.1, 0.07)
	# cánh hoa hình giọt, mép mờ
	var img := Image.create(32, 32, false, Image.FORMAT_RGBA8)
	for y in 32:
		for x in 32:
			var d := Vector2((x - 15.5) / 15.0, (y - 15.5) / 11.0)
			var e := d.length() + d.x * 0.18
			img.set_pixel(x, y, Color(1, 1, 1, clampf((1.0 - e) * 4.0, 0, 1)))
	var m := StandardMaterial3D.new()
	m.albedo_texture = ImageTexture.create_from_image(img)
	m.albedo_color = Color(P.fall)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	m.alpha_scissor_threshold = 0.4
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.emission_enabled = true
	m.emission = Color(P.fall)
	m.emission_energy_multiplier = 0.25
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.billboard_keep_scale = true
	q.material = m
	fall.draw_pass_1 = q
	fall.position = Vector3(0, 7, 0)
	root.add_child(fall)
