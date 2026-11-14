class_name Scenery2D
extends Node2D
## Cảnh nền 2D kiểu tranh vẽ: trời mây (lớp cố định màn hình), mặt hồ gương, các đảo cỏ phủ thảm cánh hoa,
## cây anh đào vẽ tay đung đưa + bóng phản chiếu, cánh hoa trôi trên nước, cánh hoa bay theo gió.

const THEMES := {
	"sakura": {
		"sky": ["#7d8fe0", "#c6a9ee", "#ffd0dd"], "cloud": ["#fff0f6", "#f39ac0", "#9c86d6"],
		"water": ["#9aa0ea", "#b9e6ee", "#ffd6e4"], "grass": ["#c9ead0", "#a9d9bd"], "rim": "#e6bfd0",
		"petal": "#ffc4d6", "petals": 0.95, "tree": "sakura", "pal": ["#fff0f5", "#ffd6e3", "#ffbfd3", "#f39ab9", "#fff7fa", "#ffdbe7"],
		"trunk": "#5b3b46", "fall": ["#ffd1e1", "#ffb3cb", "#ffe8f0"], "fall_n": 520,
	},
	"wood": {
		"sky": ["#8fb6e6", "#f2d7b0", "#ffd9a8"], "cloud": ["#fff7ea", "#f0b37a", "#c99a7a"],
		"water": ["#7fa7c9", "#a9d6c9", "#ffe0b8"], "grass": ["#b9c96a", "#8fae58"], "rim": "#b98f62",
		"petal": "#f2a043", "petals": 0.55, "tree": "maple", "pal": ["#ffcf6a", "#f5a742", "#e8742a", "#d9481f", "#ffe08a", "#c2391f"],
		"trunk": "#4a3020", "fall": ["#f5a742", "#e8742a", "#ffcf6a"], "fall_n": 260,
	},
	"ocean": {
		"sky": ["#4aa3e8", "#9fdcf2", "#e6fbff"], "cloud": ["#ffffff", "#bfe8f5", "#86b6d6"],
		"water": ["#1b8fbf", "#4fd8d0", "#c9f3f0"], "grass": ["#f2deaa", "#e6c98d"], "rim": "#f7ecd0",
		"petal": "#ffffff", "petals": 0.12, "tree": "palm", "pal": ["#7fd36a", "#5fbf55", "#4fa84a", "#3d8f3f", "#9be07a", "#64c45a"],
		"trunk": "#8a6a44", "fall": [], "fall_n": 0,
	},
	"midnight": {
		"sky": ["#0a0f2e", "#2a2366", "#5a3c88"], "cloud": ["#5d5a9c", "#2c2a5e", "#1a1840"],
		"water": ["#0c1438", "#1d2c62", "#463a7a"], "grass": ["#3d6650", "#2c4f44"], "rim": "#2a2a4a",
		"petal": "#c9b8ff", "petals": 0.3, "tree": "night", "pal": ["#c9b8ff", "#a996ff", "#8d7ae6", "#6f5cc8", "#e6ddff", "#b9a6ff"],
		"trunk": "#1d1730", "fall": ["#d6caff", "#ffffff"], "fall_n": 200,
	},
}
## đảo quanh bàn cờ (toạ độ màn hình so với tâm bàn): tâm, bán kính, số cây, tỉ lệ cây
const ISLANDS := [
	[Vector2(-880, -40), Vector2(270, 140), 2, 1.15],
	[Vector2(880, -40), Vector2(270, 140), 2, 1.15],
	[Vector2(-780, 430), Vector2(230, 100), 1, 0.75],
	[Vector2(780, 430), Vector2(230, 100), 1, 0.75],
	[Vector2(-620, -400), Vector2(220, 72), 3, 0.62],
	[Vector2(620, -400), Vector2(220, 72), 3, 0.62],
]
const HORIZON := -470.0

var theme := ""
var root: Node2D
var sky_layer: CanvasLayer
var sky_rect: ColorRect
var props: Node2D                 # cây / đồ vật (y-sort cùng bàn cờ)
var rng := RandomNumberGenerator.new()
var nt: NoiseTexture2D


func _ready() -> void:
	sky_layer = CanvasLayer.new()
	sky_layer.layer = -10
	add_child(sky_layer)
	sky_rect = ColorRect.new()
	sky_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	var sm := ShaderMaterial.new()
	sm.shader = load("res://scripts2d/sky.gdshader")
	nt = NoiseTexture2D.new()
	var fn := FastNoiseLite.new()
	fn.frequency = 0.012
	fn.fractal_octaves = 5
	nt.noise = fn
	nt.seamless = true
	nt.width = 512
	nt.height = 512
	nt.generate_mipmaps = true
	sm.set_shader_parameter("noise_tex", nt)
	sky_rect.material = sm
	sky_layer.add_child(sky_rect)


func set_theme(name: String) -> void:
	if name == theme:
		return
	theme = name if THEMES.has(name) else "sakura"
	var P: Dictionary = THEMES[theme]
	var sm: ShaderMaterial = sky_rect.material
	sm.set_shader_parameter("top_col", Color(P.sky[0]))
	sm.set_shader_parameter("mid_col", Color(P.sky[1]))
	sm.set_shader_parameter("hz_col", Color(P.sky[2]))
	sm.set_shader_parameter("cloud_a", Color(P.cloud[0]))
	sm.set_shader_parameter("cloud_b", Color(P.cloud[1]))
	sm.set_shader_parameter("cloud_shadow", Color(P.cloud[2]))
	if root:
		root.queue_free()
	root = Node2D.new()
	add_child(root)
	rng.seed = hash(theme)
	_build(P)


func _build(P: Dictionary) -> void:
	# mặt hồ (từ đường chân trời trở xuống)
	var water := ColorRect.new()
	water.position = Vector2(-2600, HORIZON)
	water.size = Vector2(5200, 2600)
	var wm := ShaderMaterial.new()
	wm.shader = load("res://scripts2d/water.gdshader")
	wm.set_shader_parameter("far_col", Color(P.water[2]))
	wm.set_shader_parameter("near_col", Color(P.water[1]))
	wm.set_shader_parameter("deep", Color(P.water[0]))
	wm.set_shader_parameter("world_size", water.size)
	wm.set_shader_parameter("noise_tex", nt)
	water.material = wm
	water.z_index = -100
	water.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(water)
	# sương mỏng ở chân trời
	var mist := TextureRect.new()
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(Color(P.water[2]), 0.0), Color(Color(P.water[2]), 0.85), Color(Color(P.water[2]), 0.0)])
	g.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0.5, 0)
	gt.fill_to = Vector2(0.5, 1)
	mist.texture = gt
	mist.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mist.position = Vector2(-2600, HORIZON - 120)
	mist.size = Vector2(5200, 240)
	mist.z_index = -90
	mist.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(mist)
	_far_hills(P)
	# đảo + cây
	props = Node2D.new()
	props.y_sort_enabled = true
	root.add_child(props)
	for k in ISLANDS.size():
		var it: Array = ISLANDS[k]
		_island(P, it[0], it[1], k)
		_trees_on(P, it[0], it[1], it[2], it[3], k)
	_floating_petals(P)
	if P.fall_n > 0:
		_falling(P)


func _far_hills(P: Dictionary) -> void:
	# 2 dải đồi cây xa, mờ trong sương
	for L in 2:
		var pts := PackedVector2Array()
		var y0 := HORIZON + 4 - L * 2
		var n := 90
		for k in n + 1:
			var x := -2600.0 + 5200.0 * k / n
			var hgt := (0.5 + 0.5 * sin(k * 0.37 + L * 2.0)) * 40 + (0.5 + 0.5 * sin(k * 1.31 + L)) * 22 + 18
			pts.append(Vector2(x, y0 - hgt * (1.0 - L * 0.35)))
		pts.append(Vector2(2600, y0 + 2))
		pts.append(Vector2(-2600, y0 + 2))
		var poly := Polygon2D.new()
		poly.polygon = pts
		var c := Color(P.pal[3]).lerp(Color(P.water[2]), 0.65 if L == 0 else 0.4)
		poly.color = c
		poly.z_index = -95 + L
		root.add_child(poly)


func _island(P: Dictionary, c: Vector2, r: Vector2, k: int) -> void:
	# đa giác hữu cơ: tâm (giữa = 1) + vòng trong + vòng ngoài (mép = 0)
	var n := 48
	var ring := []
	for i in n:
		var a := TAU * i / n
		var w := 1.0 + 0.1 * sin(a * 3 + k) + 0.06 * sin(a * 7 + k * 2)
		ring.append(Vector2(cos(a) * r.x * w, sin(a) * r.y * w))
	var verts := PackedVector3Array()
	var cols := PackedColorArray()
	var uvs := PackedVector2Array()
	var idx := PackedInt32Array()
	var add := func(p: Vector2, e: float):
		verts.append(Vector3(p.x, p.y, 0))
		cols.append(Color(e, 0, 0, 1))
		uvs.append(Vector2((p.x / r.x) * 0.5 + 0.5, (p.y / r.y) * 0.5 + 0.5))
	add.call(Vector2.ZERO, 1.0)
	for i in n:
		add.call(ring[i] * 0.86, 0.6)
	for i in n:
		add.call(ring[i], 0.0)
	for i in n:
		var a := 1 + i
		var b := 1 + (i + 1) % n
		idx.append_array([0, a, b])
		var oa := 1 + n + i
		var ob := 1 + n + (i + 1) % n
		idx.append_array([a, oa, ob, a, ob, b])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_COLOR] = cols
	arr[Mesh.ARRAY_TEX_UV] = uvs
	arr[Mesh.ARRAY_INDEX] = idx
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	# thành đảo (dải tối phía dưới) + bóng nước
	var side := Polygon2D.new()
	var sp := PackedVector2Array()
	for i in n:
		sp.append(ring[i] + Vector2(0, 14))
	side.polygon = sp
	side.color = Color(P.rim).darkened(0.35)
	side.position = c
	side.z_index = -60
	root.add_child(side)
	var mi := MeshInstance2D.new()
	mi.mesh = m
	var sm := ShaderMaterial.new()
	sm.shader = load("res://scripts2d/island.gdshader")
	sm.set_shader_parameter("grass_a", Color(P.grass[0]))
	sm.set_shader_parameter("grass_b", Color(P.grass[1]))
	sm.set_shader_parameter("petal_col", Color(P.petal))
	sm.set_shader_parameter("rim", Color(P.rim))
	sm.set_shader_parameter("petals", P.petals)
	sm.set_shader_parameter("seed", float(k) * 3.7)
	sm.set_shader_parameter("noise_tex", nt)
	mi.material = sm
	mi.position = c
	mi.z_index = -59
	root.add_child(mi)


func _tree_tex(P: Dictionary, k: int) -> ImageTexture:
	return await Painter.tree(self, P.tree, 100 + k, P.pal, Color(P.trunk))


func _trees_on(P: Dictionary, c: Vector2, r: Vector2, n: int, sc: float, k: int) -> void:
	for i in n:
		var t := (i + 0.5) / n
		var pos := c + Vector2(lerpf(-r.x * 0.5, r.x * 0.5, t) if n > 1 else 0.0, r.y * 0.15)
		var s := sc * rng.randf_range(0.85, 1.12)
		var tex := await _tree_tex(P, (k * 7 + i) % 6)
		if not is_instance_valid(props):
			return
		# bóng phản chiếu dưới nước (lật ngược, mờ, gợn)
		var rf := Sprite2D.new()
		rf.texture = tex
		rf.centered = false
		rf.offset = Vector2(-384, -640)
		rf.scale = Vector2(s, -s * 0.85)
		rf.position = pos + Vector2(0, r.y * 0.9)
		var rm := ShaderMaterial.new()
		rm.shader = load("res://scripts2d/sway.gdshader")
		rm.set_shader_parameter("reflection", true)
		rm.set_shader_parameter("phase", float(k * 3 + i))
		rm.set_shader_parameter("amp", 7.0)
		rf.material = rm
		rf.z_index = -70
		root.add_child(rf)
		# cây
		var sp := Sprite2D.new()
		sp.texture = tex
		sp.centered = false
		sp.offset = Vector2(-384, -636)
		sp.scale = Vector2(s, s) * (1 if rng.randf() < 0.5 else 1)
		if rng.randf() < 0.5:
			sp.scale.x *= -1
		sp.position = pos
		var mm := ShaderMaterial.new()
		mm.shader = load("res://scripts2d/sway.gdshader")
		mm.set_shader_parameter("phase", float(k * 3 + i))
		mm.set_shader_parameter("amp", 9.0)
		sp.material = mm
		props.add_child(sp)


func _floating_petals(P: Dictionary) -> void:
	if P.fall_n <= 0:
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_2D
	mm.use_colors = true
	var q := QuadMesh.new()
	q.size = Vector2(14, 14)
	mm.mesh = q
	var list := []
	for k in 900:
		var p := Vector2(rng.randf_range(-1500, 1500), rng.randf_range(HORIZON + 20, 900))
		var inside := absf(p.x) / 690.0 + absf(p.y) / 400.0 < 1.05
		if inside:
			continue
		list.append(p)
	mm.instance_count = list.size()
	for i in list.size():
		var s := rng.randf_range(0.5, 1.1) * (0.6 + 0.4 * clampf((list[i].y - HORIZON) / 1200.0, 0, 1))
		mm.set_instance_transform_2d(i, Transform2D(rng.randf() * TAU, Vector2(s, s * 0.6), 0, list[i]))
		mm.set_instance_color(i, Color(P.fall[rng.randi() % P.fall.size()]))
	var mi := MultiMeshInstance2D.new()
	mi.multimesh = mm
	mi.texture = Painter.petal(32)
	mi.z_index = -55
	root.add_child(mi)


func _falling(P: Dictionary) -> void:
	for layer in 2:
		var pt := GPUParticles2D.new()
		pt.amount = int(P.fall_n * (0.6 if layer == 0 else 0.4))
		pt.lifetime = 14.0
		pt.preprocess = 14.0
		pt.texture = Painter.petal(32)
		pt.visibility_rect = Rect2(-2400, -1600, 4800, 3600)
		var pm := ParticleProcessMaterial.new()
		pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
		pm.emission_box_extents = Vector3(1500, 10, 1)
		pm.direction = Vector3(1, 0.6, 0)
		pm.spread = 20
		pm.initial_velocity_min = 40
		pm.initial_velocity_max = 90
		pm.gravity = Vector3(18, 32, 0)
		pm.turbulence_enabled = true
		pm.turbulence_noise_strength = 6.0
		pm.turbulence_noise_scale = 3.0
		pm.turbulence_influence_min = 0.1
		pm.turbulence_influence_max = 0.25
		pm.angle_min = 0
		pm.angle_max = 360
		pm.angular_velocity_min = -120
		pm.angular_velocity_max = 120
		pm.scale_min = 0.35 if layer == 0 else 0.7
		pm.scale_max = 0.7 if layer == 0 else 1.2
		var cr := Gradient.new()
		var cs := PackedColorArray()
		for h in P.fall:
			cs.append(Color(h))
		cr.colors = cs
		var ct := GradientTexture1D.new()
		ct.gradient = cr
		pm.color_initial_ramp = ct
		var al := Gradient.new()
		al.colors = PackedColorArray([Color(1, 1, 1, 0), Color(1, 1, 1, 1), Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
		al.offsets = PackedFloat32Array([0.0, 0.08, 0.85, 1.0])
		var at := GradientTexture1D.new()
		at.gradient = al
		pm.color_ramp = at
		pt.process_material = pm
		pt.position = Vector2(-500, HORIZON - 700)
		pt.z_index = 50 if layer == 1 else 5
		root.add_child(pt)
