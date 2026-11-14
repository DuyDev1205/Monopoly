class_name Foliage
## Phủ lá / hoa thật lên tán cây low-poly: tìm các mặt tán (theo màu đỉnh), làm tối tán gốc,
## rồi rải hàng nghìn chiếc lá (hoặc bông hoa 5 cánh, chùm kim thông) bằng MultiMesh theo diện tích mặt.

const SAKURA := ["#ffb7c9", "#ffa3bd", "#ffc6d5", "#ff94b2", "#ffd7e2", "#ffadc4"]
const AUTUMN := ["#e8742a", "#f2a033", "#d9481f", "#f5c242", "#c2391f", "#e98a2e"]
const JMAPLE := ["#d8402f", "#c2301f", "#e8603a", "#b8241a", "#f08040"]

static var _geo := {}


static func is_green(c: Color) -> bool:
	return c.g > 0.08 and c.g > c.r * 1.25 and c.g > c.b * 1.25


static func is_pink(c: Color) -> bool:
	return c.r > 0.55 and c.r > c.g + 0.06


static func is_maple(c: Color) -> bool:
	return (c.r > 0.4 and c.r > c.b * 2) or is_green(c)


## hình 1 chiếc lá / bông hoa / chùm kim (đơn vị ~1, nằm trong mặt XY, pháp tuyến +Z)
static func shape(kind: String) -> ArrayMesh:
	if _geo.has(kind):
		return _geo[kind]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	match kind:
		"flower":
			# 5 cánh tròn quanh nhuỵ, hơi khum lên
			for k in 5:
				var a := TAU * k / 5
				var dir := Vector2(cos(a), sin(a))
				var side := Vector2(-dir.y, dir.x)
				var pts := [Vector2.ZERO, dir * 0.25 + side * 0.28, dir * 0.62 + side * 0.24, dir * 0.78, dir * 0.62 - side * 0.24, dir * 0.25 - side * 0.28]
				for j in range(1, pts.size() - 1):
					for q in [pts[0], pts[j], pts[j + 1]]:
						var v: Vector2 = q
						st.set_uv(Vector2(v.length(), 0))
						st.add_vertex(Vector3(v.x, v.y, v.length_squared() * 0.35))
		"cluster", "leafcluster":
			# chùm 7 bông hoa (hoặc 9 chiếc lá) trong một khối cầu nhỏ (phủ tán dày mà ít instance)
			var r := RandomNumberGenerator.new()
			r.seed = 11
			var flower := shape("flower" if kind == "cluster" else "leaf")
			var farr: Array = flower.surface_get_arrays(0)
			var fv: PackedVector3Array = farr[Mesh.ARRAY_VERTEX]
			var fnm: PackedVector3Array = farr[Mesh.ARRAY_NORMAL]
			for k in (7 if kind == "cluster" else 9):
				var c := Vector3(r.randf() - 0.5, r.randf() - 0.5, r.randf() * 0.5) * 0.9
				var d := (c + Vector3(0, 0, 0.6)).normalized()
				var b := _basis_from_z(d) * Basis(Vector3.BACK, r.randf() * TAU)
				var sc := 0.32 + r.randf() * 0.14
				for i in fv.size():
					st.set_normal(b * fnm[i])
					st.add_vertex(c + b * (fv[i] * sc))
			var m2 := st.commit()
			_geo[kind] = m2
			return m2
		"needle":
			for k in 3:
				var a := TAU * k / 3
				var b := Basis(Vector3.BACK, a)
				for q in [Vector3(0, 0, 0), Vector3(0.09, 0.5, 0), Vector3(0, 1, 0), Vector3(0, 0, 0), Vector3(0, 1, 0), Vector3(-0.09, 0.5, 0)]:
					st.add_vertex(b * q)
		_:
			# lá bản hình giọt, cong nhẹ
			var ring := []
			for k in 12:
				var t := TAU * k / 12
				var x := sin(t) * 0.4 * (1.0 - 0.35 * cos(t))
				var y := -cos(t) * 0.55
				ring.append(Vector3(x, y, -x * x * 0.5))
			for k in 12:
				for q in [Vector3(0, 0, 0), ring[k], ring[(k + 1) % 12]]:
					st.add_vertex(q)
	st.generate_normals()
	var m := st.commit()
	_geo[kind] = m
	return m


## Phủ lá cho mẫu cây `tpl` (đã qua MeshUtil.kit). Gọi 1 lần cho mỗi loại cây rồi nhân bản node.
## opts: pred (Callable(Color)->bool), kind, count, size_k, palette (Array màu hex) | null, darken, petals_ground
static func apply(tpl: Node3D, opts: Dictionary) -> Node3D:
	var pred: Callable = opts.get("pred", is_green)
	var kind: String = opts.get("kind", "leaf")
	var count: int = opts.get("count", 2200)
	var size_k: float = opts.get("size_k", 0.035)
	var palette: Array = opts.get("palette", [])
	var darken: float = opts.get("darken", 0.62)
	var rng := RandomNumberGenerator.new()
	rng.seed = opts.get("seed", 5)
	var tris := []          # [a, b, c, n, color]
	var cum := PackedFloat32Array()
	var area := 0.0
	var min_y := INF
	var max_y := -INF
	var root_inv := tpl.global_transform.affine_inverse() if tpl.is_inside_tree() else Transform3D.IDENTITY
	var stack: Array = [[tpl, Transform3D.IDENTITY]]
	while stack.size():
		var it: Array = stack.pop_back()
		var n: Node = it[0]
		var tf: Transform3D = it[1]
		if n != tpl and n is Node3D:
			tf = tf * (n as Node3D).transform
		for c in n.get_children():
			stack.append([c, tf])
		if not (n is MeshInstance3D) or (n as MeshInstance3D).mesh == null:
			continue
		var mi: MeshInstance3D = n
		var src: Mesh = mi.mesh
		var out := ArrayMesh.new()
		var changed := false
		for s in src.get_surface_count():
			var arr: Array = src.surface_get_arrays(s)
			var mat := src.surface_get_material(s)
			if arr[Mesh.ARRAY_COLOR] == null:
				out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
				out.surface_set_material(out.get_surface_count() - 1, mat)
				continue
			var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var cols: PackedColorArray = arr[Mesh.ARRAY_COLOR]
			var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array(range(verts.size()))
			var mark := {}
			for t in range(0, idx.size(), 3):
				var c0: Color = cols[idx[t]]
				if not pred.call(c0):
					continue
				var A: Vector3 = tf * verts[idx[t]]
				var Bv: Vector3 = tf * verts[idx[t + 1]]
				var Cv: Vector3 = tf * verts[idx[t + 2]]
				var nr := (Cv - Bv).cross(A - Bv)
				var ar := nr.length() / 2
				for j in 3:
					mark[idx[t + j]] = true
				if ar < 1e-7:
					continue
				tris.append([A, Bv, Cv, nr.normalized(), c0])
				area += ar
				cum.append(area)
				min_y = minf(min_y, minf(A.y, minf(Bv.y, Cv.y)))
				max_y = maxf(max_y, maxf(A.y, maxf(Bv.y, Cv.y)))
			if mark.size():
				changed = true
				for v in mark:
					var c: Color = cols[v]
					cols[v] = Color(c.r * darken, c.g * darken, c.b * darken, c.a)
				arr[Mesh.ARRAY_COLOR] = cols
			out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			out.surface_set_material(out.get_surface_count() - 1, mat)
		if changed:
			mi.mesh = out
	if tris.is_empty():
		return tpl
	var span := max_y - min_y
	var size := maxf(span, 0.5) * size_k
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = shape(kind)
	mm.instance_count = count
	var pal: Array = []
	for h in palette:
		pal.append(Color(h))
	for i in count:
		var k := cum.bsearch(rng.randf() * area)
		var t: Array = tris[mini(k, tris.size() - 1)]
		var u := rng.randf()
		var v := rng.randf()
		if u + v > 1:
			u = 1 - u
			v = 1 - v
		var P: Vector3 = t[0] + (t[1] - t[0]) * u + (t[2] - t[0]) * v
		var nn: Vector3 = t[3]
		P += nn * (pow(rng.randf(), 0.7) * 1.4 - 0.15) * size * 1.8
		var dir := (nn + Vector3(rng.randf() - 0.5, rng.randf() * 0.8 - 0.2, rng.randf() - 0.5) * 1.1).normalized()
		var b := _basis_from_z(dir) * Basis(Vector3.BACK, rng.randf() * TAU)
		b = b.scaled(Vector3.ONE * size * (0.65 + rng.randf() * 0.7))
		mm.set_instance_transform(i, Transform3D(b, P))
		var col: Color = pal[rng.randi() % pal.size()] if pal.size() else t[4]
		col = Color.from_hsv(fposmod(col.h + (rng.randf() - 0.5) * 0.04, 1.0), clampf(col.s * (0.9 + rng.randf() * 0.25), 0, 1), clampf(col.v * (0.85 + rng.randf() * 0.4), 0, 1))
		var lift := 0.8 + 0.3 * ((P.y - min_y) / maxf(span, 0.01))   # dưới tán tối, ngọn sáng
		mm.set_instance_color(i, Color(col.r * lift, col.g * lift, col.b * lift))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.roughness = 0.75
	if kind == "flower" or kind == "cluster":
		mat.emission_enabled = true
		mat.emission = Color("#ff9cc2")
		mat.emission_energy_multiplier = 0.08
	mat.diffuse_mode = BaseMaterial3D.DIFFUSE_LAMBERT_WRAP
	mmi.material_override = mat
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	tpl.add_child(mmi)
	tpl.set_meta("canopy_y", Vector2(min_y, max_y))
	return tpl


static func _basis_from_z(z: Vector3) -> Basis:
	var up := Vector3.UP if absf(z.y) < 0.99 else Vector3.RIGHT
	var x := up.cross(z).normalized()
	var y := z.cross(x)
	return Basis(x, y, z)


# ======================= tán cây xù (thẻ lá quay về camera) =======================
static var _leaf_tex := {}


## ảnh "chùm lá" trắng xám có kênh alpha (shader tô màu): leaf | blossom | needle
static func leaf_texture(kind: String) -> ImageTexture:
	if _leaf_tex.has(kind):
		return _leaf_tex[kind]
	var N := 128
	var img := Image.create(N, N, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var r := RandomNumberGenerator.new()
	r.seed = hash(kind)
	match kind:
		"blossom":
			for f in 9:
				var cx := N * 0.5 + r.randf_range(-0.3, 0.3) * N
				var cy := N * 0.5 + r.randf_range(-0.3, 0.3) * N
				var R := N * r.randf_range(0.13, 0.18)
				var rot := r.randf() * TAU
				for y in range(int(cy - R), int(cy + R) + 1):
					for x in range(int(cx - R), int(cx + R) + 1):
						if x < 0 or y < 0 or x >= N or y >= N:
							continue
						var d := Vector2(x - cx, y - cy)
						var rr := d.length() / R
						if rr > 1.0:
							continue
						var a := d.angle() - rot
						var petal := 0.62 + 0.38 * absf(cos(2.5 * a))
						var notch := 0.08 * smoothstep(0.92, 1.0, absf(cos(2.5 * a)))
						if rr > petal - notch:
							continue
						var shade := 1.0 - 0.18 * rr
						var col := Color(shade, shade, shade, 1)
						if rr < 0.18:
							col = Color(1.0, 0.85, 0.55, 1)
						elif rr < 0.3:
							col = Color(0.95, 0.75, 0.8, 1)
						img.set_pixel(x, y, col)
		"needle":
			for hub in 6:
				var hx := N * 0.5 + r.randf_range(-0.25, 0.25) * N
				var hy := N * 0.5 + r.randf_range(-0.25, 0.25) * N
				for k in 18:
					var a := r.randf() * TAU
					var L := N * r.randf_range(0.18, 0.3)
					for st in int(L):
						var p := Vector2(hx, hy) + Vector2(cos(a), sin(a)) * st
						var sh := 0.65 + 0.35 * st / L
						for w in [-1, 0, 1]:
							var x: int = int(p.x) + (w if absf(sin(a)) > 0.7 else 0)
							var y: int = int(p.y) + (w if absf(sin(a)) <= 0.7 else 0)
							if x >= 0 and y >= 0 and x < N and y < N:
								img.set_pixel(x, y, Color(sh, sh, sh, 1))
		_:
			for f in 14:
				var cx := N * 0.5 + r.randf_range(-0.28, 0.28) * N
				var cy := N * 0.5 + r.randf_range(-0.28, 0.28) * N
				var L := N * r.randf_range(0.16, 0.24)
				var W := L * r.randf_range(0.42, 0.55)
				var rot := r.randf() * TAU
				var ca := cos(rot)
				var sa := sin(rot)
				var ext := int(L) + 2
				for y in range(int(cy) - ext, int(cy) + ext):
					for x in range(int(cx) - ext, int(cx) + ext):
						if x < 0 or y < 0 or x >= N or y >= N:
							continue
						var dx := x - cx
						var dy := y - cy
						var u := (dx * ca + dy * sa) / L
						var v := (-dx * sa + dy * ca) / W
						if absf(u) > 1:
							continue
						var half := sqrt(maxf(0, 1 - u * u)) * (1.0 - 0.35 * u)
						if absf(v) > half:
							continue
						var sh := 0.72 + 0.28 * (u * 0.5 + 0.5) - 0.12 * absf(v)
						if absf(v) < 0.06:
							sh *= 0.82
						img.set_pixel(x, y, Color(sh, sh, sh, 1))
	img.generate_mipmaps()
	var tex := ImageTexture.create_from_image(img)
	_leaf_tex[kind] = tex
	return tex


## Thay tán khối low-poly bằng tán xù. opts: pred, leaf ("leaf"|"blossom"|"needle"), cards, card_k, palette, darken, seed
static func fluffy(tpl: Node3D, opts: Dictionary) -> Node3D:
	var pred: Callable = opts.get("pred", is_green)
	var leaf: String = opts.get("leaf", "leaf")
	var count: int = opts.get("cards", 700)
	var card_k: float = opts.get("card_k", 0.12)
	var palette: Array = opts.get("palette", [])
	var darken: float = opts.get("darken", 0.42)
	var rng := RandomNumberGenerator.new()
	rng.seed = opts.get("seed", 7)
	var tris := []
	var cum := PackedFloat32Array()
	var area := 0.0
	var min_y := INF
	var max_y := -INF
	var stack: Array = [[tpl, Transform3D.IDENTITY]]
	while stack.size():
		var it: Array = stack.pop_back()
		var n: Node = it[0]
		var tf: Transform3D = it[1]
		if n != tpl and n is Node3D:
			tf = tf * (n as Node3D).transform
		for c in n.get_children():
			stack.append([c, tf])
		if not (n is MeshInstance3D) or (n as MeshInstance3D).mesh == null:
			continue
		var mi: MeshInstance3D = n
		var src: Mesh = mi.mesh
		var out := ArrayMesh.new()
		var changed := false
		for s in src.get_surface_count():
			var arr: Array = src.surface_get_arrays(s)
			var mat := src.surface_get_material(s)
			if arr[Mesh.ARRAY_COLOR] != null:
				var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
				var cols: PackedColorArray = arr[Mesh.ARRAY_COLOR]
				var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array(range(verts.size()))
				var mark := {}
				for t in range(0, idx.size(), 3):
					var c0: Color = cols[idx[t]]
					if not pred.call(c0):
						continue
					var A: Vector3 = tf * verts[idx[t]]
					var Bv: Vector3 = tf * verts[idx[t + 1]]
					var Cv: Vector3 = tf * verts[idx[t + 2]]
					var nr := (Cv - Bv).cross(A - Bv)
					var ar := nr.length() / 2
					for j in 3:
						mark[idx[t + j]] = true
					if ar < 1e-7:
						continue
					tris.append([A, Bv, Cv, nr.normalized(), c0])
					area += ar
					cum.append(area)
					min_y = minf(min_y, minf(A.y, minf(Bv.y, Cv.y)))
					max_y = maxf(max_y, maxf(A.y, maxf(Bv.y, Cv.y)))
				if mark.size():
					changed = true
					for v in mark:
						var c: Color = cols[v]
						cols[v] = Color(c.r * darken, c.g * darken, c.b * darken, c.a)
					arr[Mesh.ARRAY_COLOR] = cols
			out.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
			out.surface_set_material(out.get_surface_count() - 1, mat)
		if changed:
			mi.mesh = out
	if tris.is_empty():
		return tpl
	var span := maxf(max_y - min_y, 0.3)
	var pts := []
	for i in count:
		var k := mini(cum.bsearch(rng.randf() * area), tris.size() - 1)
		var t: Array = tris[k]
		var u := rng.randf()
		var v := rng.randf()
		if u + v > 1:
			u = 1 - u
			v = 1 - v
		pts.append([t[0] + (t[1] - t[0]) * u + (t[2] - t[0]) * v, t[3], t[4]])
	# gom điểm thành các khối cầu (k-means) để có pháp tuyến tròn trịa như tán cây thật
	var K := clampi(int(area / (span * span * 0.08)), 4, 14)
	var centers := []
	for k in K:
		centers.append(pts[rng.randi() % pts.size()][0])
	var assign := PackedInt32Array()
	assign.resize(pts.size())
	for iter in 6:
		var sum := []
		var cnt := []
		for k in K:
			sum.append(Vector3.ZERO)
			cnt.append(0)
		for i in pts.size():
			var best := 0
			var bd := INF
			for k in K:
				var d: float = (pts[i][0] as Vector3).distance_squared_to(centers[k])
				if d < bd:
					bd = d
					best = k
			assign[i] = best
			sum[best] += pts[i][0]
			cnt[best] += 1
		for k in K:
			if cnt[k]:
				centers[k] = sum[k] / cnt[k]
	var radius := []
	for k in K:
		radius.append(0.0)
	for i in pts.size():
		radius[assign[i]] = maxf(radius[assign[i]], (pts[i][0] as Vector3).distance_to(centers[assign[i]]))
	var size := span * card_k
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.use_custom_data = true
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	mm.mesh = q
	mm.instance_count = pts.size()
	var pal: Array = []
	for h in palette:
		pal.append(Color(h))
	for i in pts.size():
		var P: Vector3 = pts[i][0]
		var C: Vector3 = centers[assign[i]]
		var R: float = maxf(radius[assign[i]], 0.01)
		var dirv := P - C
		var n := dirv.normalized() if dirv.length() > 1e-4 else Vector3.UP
		n = (n + Vector3(0, 0.25, 0)).normalized()
		P += n * size * rng.randf_range(-0.1, 0.35)
		var outer := clampf(dirv.length() / R, 0.0, 1.0) * 0.6 + 0.4 * clampf((P.y - min_y) / span, 0, 1)
		var sc := size * rng.randf_range(0.75, 1.25)
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ONE * sc), P))
		var col: Color = pal[rng.randi() % pal.size()] if pal.size() else pts[i][2]
		col = Color.from_hsv(fposmod(col.h + rng.randf_range(-0.02, 0.02), 1.0), clampf(col.s * rng.randf_range(0.9, 1.1), 0, 1), clampf(col.v * rng.randf_range(0.88, 1.12), 0, 1))
		mm.set_instance_color(i, col)
		mm.set_instance_custom_data(i, Color(n.x * 0.5 + 0.5, n.y * 0.5 + 0.5, n.z * 0.5 + 0.5, outer))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	var mat := ShaderMaterial.new()
	mat.shader = load("res://scripts/leaves.gdshader")
	mat.set_shader_parameter("leaf_tex", leaf_texture(leaf))
	if leaf == "blossom":
		mat.set_shader_parameter("translucency", Vector3(0.45, 0.3, 0.35))
	mmi.material_override = mat
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	mmi.custom_aabb = AABB(Vector3(-span * 2, min_y - span, -span * 2), Vector3(span * 4, span * 3, span * 4))
	tpl.add_child(mmi)
	return tpl
