class_name Board
extends Node3D
## Bàn cờ 3D: đế, sân giữa + huy hiệu, 32 ô đất (mặt ô bằng shader, chữ Label3D sắc nét), sân đấu (đèn chạy viền, cột đèn,
## vòng vàng, đạo cụ 4 ô góc). Toạ độ khớp với bản Three.js cũ (app/skin/scene3d.js).

const CORNER := 1.45
const GAP := 0.05
const TH := 0.16
const SIZES := [CORNER, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, CORNER]
static var W: float = CORNER * 2 + 7.0 + GAP * 8

const STYLE := {
	"midnight": {"top": "#2a3366", "side": "#1a2147", "ped": "#141a3a", "trim": "#7B61FF", "court": ["#232B55", "#1D2449", "#2E3870"], "bulb": "#c9b8ff", "tile_side": "#cfd3ef"},
	"wood": {"top": "#f3e3c6", "side": "#d9ae6e", "ped": "#a26c38", "trim": "#e0a030", "court": ["#EBC994", "#E3BB84", "#9C6B3A"], "bulb": "#ffe2a0", "tile_side": "#efe4cc"},
	"ocean": {"top": "#fffaf0", "side": "#bfe9e6", "ped": "#1e3a5f", "trim": "#ffb703", "court": ["#FFF6E2", "#CFF3EE", "#1E3A5F"], "bulb": "#fff6c8", "tile_side": "#efe4cc"},
	"sakura": {"top": "#ffffff", "side": "#fbe6f0", "ped": "#e5bcd3", "trim": "#e8467c", "court": ["#FFF8FB", "#FBE6F0", "#EBCFE0"], "bulb": "#ffd6e8", "tile_side": "#f6e9ee"},
}
const TILE_BG := {
	"city": ["#ffffff", "#f7f1e6"], "resort": ["#fff6dc", "#fde9b8"], "chance": ["#fff3f6", "#ffd3e1"], "tax": ["#f6f6f6", "#dcdcdc"],
	"start": ["#fff7c7", "#ffd76a"], "island": ["#d7fbff", "#8fdcea"], "festival": ["#ffe0f0", "#ff9ccb"], "airport": ["#e3efff", "#9cc2ff"],
}

static var TILE: Array = []   # khung toạ độ từng ô
var tiles: Array = []         # {grp, body, top, mat, labels, st}
var theme := "sakura"
var font_title: FontFile
var font_body: FontFile

var base_top: StandardMaterial3D
var base_side: StandardMaterial3D
var ped_mat: StandardMaterial3D
var trim_mat: StandardMaterial3D
var tile_side_mat: StandardMaterial3D
var court_mat: ShaderMaterial
var ring_labels: Array = []
var bulbs: MultiMeshInstance3D
var bulb_on := Color("#ffd6e8")
var orbs: Array = []
var orb_lights: Array = []
var studs_mat: StandardMaterial3D
var beacon: MeshInstance3D
var flags: Array = []


static func cell_c(k: int) -> float:
	var x := -W / 2
	for j in range(1, k):
		x += SIZES[j - 1] + GAP
	return x + SIZES[k - 1] / 2


static func grid_pos(i: int) -> Vector2i:
	if i <= 8:
		return Vector2i(9, 9 - i)
	if i <= 16:
		return Vector2i(9 - (i - 8), 1)
	if i <= 24:
		return Vector2i(1, 1 + (i - 16))
	return Vector2i(1 + (i - 24), 9)


static func side_of(i: int) -> String:
	return "c" if i % 8 == 0 else ["b", "l", "t", "r"][i / 8]


static func _static_init() -> void:
	for i in 32:
		var rc := grid_pos(i)
		var s := side_of(i)
		var col := s == "l" or s == "r"
		TILE.append({
			"x": cell_c(rc.y), "z": cell_c(rc.x), "w": SIZES[rc.y - 1], "d": SIZES[rc.x - 1], "side": s,
			"along": Vector3(0, 0, -1) if col else Vector3(1, 0, 0),
			"far": Vector3(-1, 0, 0) if col else Vector3(0, 0, -1),
			"alen": CORNER if s == "c" else 1.0, "dlen": CORNER,
			"rot_y": PI / 2 if col else 0.0,
		})


## điểm trên mặt ô: a theo chiều chữ (-0.5..0.5), s từ mép xa (0) tới mép gần (1)
static func tp(i: int, a := 0.0, s := 0.5, y := TH) -> Vector3:
	var t: Dictionary = TILE[i]
	return Vector3(t.x, y, t.z) + t.along * (a * t.alen) + t.far * (t.dlen * (0.5 - s))


## hướng mặt phẳng ô (để đặt chữ / mặt ô nằm ngang, chữ chạy theo `along`)
static func flat_basis(i: int) -> Basis:
	return Basis(Vector3.UP, TILE[i].rot_y) * Basis(Vector3.RIGHT, -PI / 2)


func _ready() -> void:
	font_title = _font("res://assets/fonts/BeVietnamPro-Black.ttf")
	font_body = _font("res://assets/fonts/BeVietnamPro-ExtraBold.ttf")
	_build_base()
	_build_tiles()
	_build_arena()
	set_theme(theme)


func _font(path: String) -> FontFile:
	var f: FontFile = load(path).duplicate()
	f.multichannel_signed_distance_field = true
	f.msdf_pixel_range = 14
	f.msdf_size = 64
	return f


func _label(text: String, font: Font, size: int, color: Color, px: float) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.font = font
	l.font_size = size
	l.pixel_size = px
	l.modulate = color
	l.outline_size = 0
	l.shaded = false
	l.double_sided = false
	l.alpha_cut = Label3D.ALPHA_CUT_DISCARD
	l.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	l.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return l


# ======================= đế bàn cờ =======================
func _build_base() -> void:
	base_top = StandardMaterial3D.new()
	base_top.roughness = 0.55
	base_side = StandardMaterial3D.new()
	base_side.roughness = 0.6
	var slab := MeshUtil.mesh(MeshUtil.rounded_box(Vector3(W + 0.7, 0.9, W + 0.7), 0.22, 5), base_side, Vector3(0, -0.45, 0))
	add_child(slab)
	trim_mat = StandardMaterial3D.new()
	trim_mat.metallic = 0.85
	trim_mat.roughness = 0.28
	add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(W + 0.84, 0.12, W + 0.84), 0.06, 3), trim_mat, Vector3(0, -0.62, 0)))
	add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(W + 0.84, 0.05, W + 0.84), 0.025, 3), trim_mat, Vector3(0, -0.02, 0)))
	ped_mat = StandardMaterial3D.new()
	ped_mat.roughness = 0.85
	add_child(MeshUtil.mesh(MeshUtil.rounded_box(Vector3(W + 0.95, 2.4, W + 0.95), 0.3, 5), ped_mat, Vector3(0, -2.0, 0)))
	# mặt đế (lớp phẳng phủ trên, nhận bóng đẹp hơn)
	var top := PlaneMesh.new()
	top.size = Vector2(W + 0.5, W + 0.5)
	add_child(MeshUtil.mesh(top, base_top, Vector3(0, 0.001, 0), false))
	# sân giữa
	var inner := W - 2 * CORNER - 2 * GAP - 0.1
	court_mat = ShaderMaterial.new()
	court_mat.shader = load("res://scripts/courtyard.gdshader")
	court_mat.set_shader_parameter("half_size", inner / 2)
	var cp := PlaneMesh.new()
	cp.size = Vector2(inner, inner)
	add_child(MeshUtil.mesh(cp, court_mat, Vector3(0, 0.012, 0), false))
	# chữ chạy vòng quanh huy hiệu
	var text := "CỜ TỶ PHÚ • VIỆT NAM • MUA ĐẤT • XÂY NHÀ • "
	var n := text.length()
	for k in n:
		var ch := text[k]
		if ch == " ":
			continue
		var a := -PI / 2 + TAU * k / n
		var l := _label(ch, font_title, 64, Color.WHITE, 0.0042)
		l.position = Vector3(cos(a) * 1.84, 0.016, sin(a) * 1.84)
		# chữ đứng thẳng theo bán kính, đáy chữ hướng vào tâm
		l.basis = Basis(Vector3.UP, -a - PI / 2) * Basis(Vector3.RIGHT, -PI / 2)
		add_child(l)
		ring_labels.append(l)


# ======================= ô đất =======================
func _build_tiles() -> void:
	tile_side_mat = StandardMaterial3D.new()
	tile_side_mat.roughness = 0.7
	var shader: Shader = load("res://scripts/tile_top.gdshader")
	for i in 32:
		var info: Dictionary = Data.BOARD[i]
		var t: Dictionary = TILE[i]
		var corner: bool = t.side == "c"
		var grp := Node3D.new()
		grp.name = "tile_%d" % i
		add_child(grp)
		var body := MeshUtil.mesh(MeshUtil.rounded_box(Vector3(t.w, TH, t.d), 0.05, 3), tile_side_mat, Vector3(t.x, TH / 2, t.z))
		grp.add_child(body)
		var sb := StaticBody3D.new()
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(t.w, TH + 0.3, t.d)
		cs.shape = bs
		sb.add_child(cs)
		sb.position = body.position
		sb.set_meta("tile", i)
		grp.add_child(sb)
		var mat := ShaderMaterial.new()
		mat.shader = shader
		var bg: Array = TILE_BG.get(info.type, ["#ffffff", "#eeeeee"])
		mat.set_shader_parameter("bg0", Color(bg[0]))
		mat.set_shader_parameter("bg1", Color(bg[1]))
		var sz := Vector2(CORNER, CORNER) if corner else Vector2(1.0, CORNER)
		mat.set_shader_parameter("size", sz)
		if info.type == "resort":
			mat.set_shader_parameter("kind", 1)
		elif info.has("group"):
			mat.set_shader_parameter("band", Color(Data.GROUPS[info.group].color))
		var q := QuadMesh.new()
		q.size = sz
		var top := MeshUtil.mesh(q, mat, Vector3(t.x, TH + 0.002, t.z), false)
		top.basis = flat_basis(i)
		grp.add_child(top)
		var labels := _tile_labels(i, info, corner)
		for l in labels.values():
			grp.add_child(l)
		tiles.append({"grp": grp, "body": body, "top": top, "mat": mat, "labels": labels, "info": info,
			"st": {"owned": null, "price": Data.tile_sub(info), "dim": false, "pick": false, "chosen": false, "target": false,
				"fest": false, "rfest": false, "mono": false, "flash": 0.0, "step": 0.0, "lift": 0.0, "frame": 0.0}})


func _fit_size(text: String, font: Font, size: int, max_w_px: float) -> int:
	var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	return size if w <= max_w_px else int(size * max_w_px / w)


func _wrap(text: String, font: Font, size: int, max_w_px: float) -> PackedStringArray:
	if font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x <= max_w_px:
		return PackedStringArray([text])
	var words := text.split(" ")
	var best := PackedStringArray([text])
	var best_w := INF
	for k in range(1, words.size()):
		var a := " ".join(words.slice(0, k))
		var b := " ".join(words.slice(k))
		var w := maxf(font.get_string_size(a, 0, -1, size).x, font.get_string_size(b, 0, -1, size).x)
		if w < best_w:
			best_w = w
			best = PackedStringArray([a, b])
	return best


func _tile_labels(i: int, info: Dictionary, corner: bool) -> Dictionary:
	var out := {}
	var B := flat_basis(i)
	const PX := 0.0021        # 1 px chữ = 0.0021 đơn vị
	var width := (CORNER if corner else 1.0) - 0.12
	var ink := Color("#2b2118")
	if corner:
		var nl := _label(info.name, font_title, 150, Color("#3a2a1a"), PX)
		nl.font_size = _fit_size(info.name, font_title, 150, width / PX)
		nl.position = tp(i, 0, 0.66, TH + 0.004)
		nl.basis = B
		out["name"] = nl
		var sub := Data.tile_sub(info)
		var sl := _label(sub, font_body, 86, Color("#5b4630"), PX)
		sl.font_size = _fit_size(sub, font_body, 86, width / PX)
		sl.position = tp(i, 0, 0.83, TH + 0.004)
		sl.basis = B
		out["sub"] = sl
		var ip := Data.icon_path(info)
		if ip != "":
			out["icon"] = _icon(ip, tp(i, 0, 0.3, TH + 0.006), B, 0.52)
	else:
		# ưu tiên 1 dòng (co chữ tới 96px), dài quá mới xuống 2 dòng
		var lines := PackedStringArray([info.name])
		var size := _fit_size(info.name, font_body, 128, width / PX)
		if size < 96:
			lines = _wrap(info.name, font_body, 108, width / PX)
			size = 108
			for ln in lines:
				size = mini(size, _fit_size(ln, font_body, size, width / PX))
		var nl := _label("\n".join(lines), font_body, size, ink, PX)
		nl.line_spacing = -size * 0.18
		nl.position = tp(i, 0, 0.6 if lines.size() == 1 else 0.56, TH + 0.004)
		nl.basis = B
		out["name"] = nl
		var pl := _label(Data.tile_sub(info), font_title, 140, Color("#4a3d2e"), PX)
		pl.font_size = _fit_size(pl.text, font_title, 140, width / PX)
		pl.position = tp(i, 0, 0.86, TH + 0.004)
		pl.basis = B
		out["price"] = pl
		if info.type != "city" and info.type != "resort":
			var ip := Data.icon_path(info)
			if ip != "":
				out["icon"] = _icon(ip, tp(i, 0, 0.32, TH + 0.006), B, 0.36)
	return out


func _icon(path: String, pos: Vector3, B: Basis, size: float) -> Sprite3D:
	var s := Sprite3D.new()
	s.texture = load(path)
	s.pixel_size = size / s.texture.get_width()
	s.position = pos
	s.basis = B
	s.shaded = false
	s.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	s.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	s.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return s


## cập nhật trạng thái ô: owned (Color|null), price (String), mono, fest, rfest
func update_tile(i: int, u: Dictionary) -> void:
	var T: Dictionary = tiles[i]
	var st: Dictionary = T.st
	for k in u:
		st[k] = u[k]
	var oc = st.owned
	T.mat.set_shader_parameter("owned", Color(oc, 1.0) if oc != null else Color(0, 0, 0, 0))
	T.mat.set_shader_parameter("star", 1.0 if st.mono else 0.0)
	if T.labels.has("price"):
		var pl: Label3D = T.labels.price
		pl.text = st.price
		pl.modulate = (Color(oc) * 0.75) if oc != null else Color("#4a3d2e")
		pl.modulate.a = 1
		pl.font_size = _fit_size(pl.text, font_title, 150 if oc != null else 140, 0.88 / 0.0021)


func set_picks(list) -> void:
	for i in 32:
		var st: Dictionary = tiles[i].st
		st.pick = list != null and i in list
		st.dim = list != null and list.size() > 0 and not (i in list)


func set_chosen(list) -> void:
	for i in 32:
		tiles[i].st.chosen = list != null and i in list


func step_flash(i: int) -> void:
	tiles[i].st.step = 1.0


func flash_tile(i: int) -> void:
	tiles[i].st.flash = 1.0


func set_target(i: int) -> void:
	for k in 32:
		tiles[k].st.target = k == i


# ======================= sân đấu =======================
func _build_arena() -> void:
	var E := W / 2 + 0.38
	# đèn chạy quanh viền bàn
	var per := 24
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.instance_count = per * 4
	mm.mesh = MeshUtil.sphere(0.05, 12)
	for s in 4:
		for j in per:
			var u := -E + 2 * E * (j + 0.5) / per
			var xz: Vector2 = [Vector2(u, E), Vector2(E, -u), Vector2(-u, -E), Vector2(-E, u)][s]
			mm.set_instance_transform(s * per + j, Transform3D(Basis(), Vector3(xz.x, -0.2, xz.y)))
			mm.set_instance_color(s * per + j, Color.WHITE)
	bulbs = MultiMeshInstance3D.new()
	bulbs.multimesh = mm
	var bm := StandardMaterial3D.new()
	bm.vertex_color_use_as_albedo = true
	bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bm.albedo_color = Color(2.2, 2.0, 1.8)   # > 1 để phát sáng (glow)
	bulbs.material_override = bm
	bulbs.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(bulbs)
	# cột đèn 4 góc
	var post_mat := MeshUtil.std(Color("#ffffff"), 0.35, 0.15)
	for sv in [Vector2(1, 1), Vector2(1, -1), Vector2(-1, -1), Vector2(-1, 1)]:
		var p := Node3D.new()
		p.add_child(MeshUtil.mesh(MeshUtil.cyl(0.17, 0.21, 0.12), post_mat, Vector3(0, 0.06, 0)))
		p.add_child(MeshUtil.mesh(MeshUtil.cyl(0.06, 0.08, 0.62), post_mat, Vector3(0, 0.43, 0)))
		p.add_child(MeshUtil.mesh(MeshUtil.cyl(0.14, 0.1, 0.06), trim_mat, Vector3(0, 0.76, 0)))
		var orb := MeshUtil.mesh(MeshUtil.sphere(0.13, 24), MeshUtil.emissive(Color("#fff6d8"), Color("#ffcf6a"), 2.5), Vector3(0, 0.9, 0), false)
		p.add_child(orb)
		orbs.append(orb)
		var ol := OmniLight3D.new()
		ol.light_color = Color("#ffd68a")
		ol.light_energy = 1.2
		ol.omni_range = 2.6
		ol.position = Vector3(0, 0.9, 0)
		p.add_child(ol)
		orb_lights.append(ol)
		p.position = Vector3(sv.x * (E + 0.05), 0, sv.y * (E + 0.05))
		add_child(p)
	# vòng vàng + đinh sáng quanh huy hiệu
	var tor := TorusMesh.new()
	tor.inner_radius = 2.02
	tor.outer_radius = 2.09
	tor.rings = 96
	tor.ring_segments = 10
	var ring := MeshUtil.mesh(tor, trim_mat, Vector3(0, 0.03, 0))
	ring.scale = Vector3(1, 0.6, 1)
	add_child(ring)
	var sm := MultiMesh.new()
	sm.transform_format = MultiMesh.TRANSFORM_3D
	sm.instance_count = 24
	sm.mesh = MeshUtil.sphere(0.035, 10)
	for k in 24:
		var a := TAU * k / 24
		sm.set_instance_transform(k, Transform3D(Basis(), Vector3(cos(a) * 2.24, 0.035, sin(a) * 2.24)))
	var studs := MultiMeshInstance3D.new()
	studs.multimesh = sm
	studs_mat = MeshUtil.emissive(Color("#fff6d8"), Color("#ffd36a"), 2.0)
	studs.material_override = studs_mat
	add_child(studs)
	_corner_props()


func _corner_props() -> void:
	# Xuất Phát: 2 cờ ca-rô bay phấp phới
	var img := Image.create(64, 48, false, Image.FORMAT_RGBA8)
	for y in 3:
		for x in 4:
			img.fill_rect(Rect2i(x * 16, y * 16, 16, 16), Color("#111111") if (x + y) % 2 else Color.WHITE)
	var checker := ImageTexture.create_from_image(img)
	var fsh: Shader = load("res://scripts/flag.gdshader")
	for a in [-0.38, 0.38]:
		var f := Node3D.new()
		f.add_child(MeshUtil.mesh(MeshUtil.cyl(0.014, 0.014, 0.66, 8), MeshUtil.std(Color("#c9a227"), 0.3, 0.7), Vector3(0, 0.33, 0)))
		var pm := PlaneMesh.new()
		pm.size = Vector2(0.32, 0.21)
		pm.subdivide_width = 10
		pm.orientation = PlaneMesh.FACE_Z
		var fm := ShaderMaterial.new()
		fm.shader = fsh
		fm.set_shader_parameter("tex", checker)
		fm.set_shader_parameter("phase", randf() * 6.0)
		f.add_child(MeshUtil.mesh(pm, fm, Vector3(0.16, 0.54, 0)))
		f.position = tp(0, a, 0.12)
		f.rotation.y = PI / 4
		add_child(f)
		flags.append(fm)
	# Đảo Hoang: dừa + đá
	var palm := MeshUtil.kit("pf/palm-sapling-ef7ae4", 0, 0.85)
	if palm:
		palm.position = tp(8, -0.32, 0.14)
		add_child(palm)
	var rk := MeshUtil.kit("pf/garden-rock-2d3b51", 0.26)
	if rk:
		rk.position = tp(8, 0.32, 0.18)
		add_child(rk)
	# Lễ Hội: 2 đèn lồng giấy phát sáng
	for a in [-0.35, 0.35]:
		var l := MeshUtil.kit("pf/paper-lantern-3387e9", 0, 0.5)
		if l:
			l.position = tp(16, a, 0.14)
			add_child(l)
			var ol := OmniLight3D.new()
			ol.light_color = Color("#ff9a5a")
			ol.light_energy = 0.8
			ol.omni_range = 1.4
			ol.position = Vector3(0, 0.3, 0)
			l.add_child(ol)
	# Sân Bay: tháp điều khiển có đèn nháy
	var tw := Node3D.new()
	tw.add_child(MeshUtil.mesh(MeshUtil.cyl(0.07, 0.1, 0.55, 16), MeshUtil.std(Color("#e8edf3"), 0.5), Vector3(0, 0.275, 0)))
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color("#7fc8ff")
	glass.roughness = 0.08
	glass.metallic = 0.4
	glass.emission_enabled = true
	glass.emission = Color("#2a6fb0")
	glass.emission_energy_multiplier = 0.5
	tw.add_child(MeshUtil.mesh(MeshUtil.cyl(0.16, 0.12, 0.14, 8), glass, Vector3(0, 0.62, 0)))
	tw.add_child(MeshUtil.mesh(MeshUtil.cyl(0.0, 0.18, 0.08, 8), MeshUtil.std(Color("#3a4a63"), 0.6), Vector3(0, 0.73, 0)))
	beacon = MeshUtil.mesh(MeshUtil.sphere(0.035, 12), MeshUtil.emissive(Color("#ff3b3b"), Color("#ff2020"), 4.0), Vector3(0, 0.8, 0), false)
	beacon.material_override = beacon.material_override.duplicate()
	tw.add_child(beacon)
	tw.position = tp(24, 0.36, 0.14)
	add_child(tw)


func set_theme(name: String) -> void:
	theme = name if STYLE.has(name) else "sakura"
	var b: Dictionary = STYLE[theme]
	base_top.albedo_color = Color(b.top)
	base_side.albedo_color = Color(b.side)
	ped_mat.albedo_color = Color(b.ped)
	trim_mat.albedo_color = Color(b.trim)
	tile_side_mat.albedo_color = Color(b.tile_side)
	court_mat.set_shader_parameter("c0", Color(b.court[0]))
	court_mat.set_shader_parameter("c1", Color(b.court[1]))
	court_mat.set_shader_parameter("line_col", Color(b.court[2]))
	court_mat.set_shader_parameter("trim", Color(b.trim))
	var rc := Color(b.trim)
	rc.a = 0.85
	for l in ring_labels:
		l.modulate = rc
	bulb_on = Color(b.bulb)


func _process(dt: float) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	# đèn viền: một dải sáng chạy vòng + nhấp nháy 1/3
	var mm := bulbs.multimesh
	var n := mm.instance_count
	var head := fmod(t * 18.0, n)
	var off := Color("#5a4a3a")
	for k in n:
		var d: float = minf(absf(k - head), n - absf(k - head))
		var v: float = (0.55 if k % 3 == int(t * 3) % 3 else 0.25) + maxf(0, 1 - d / 6.0) * 0.9
		mm.set_instance_color(k, off.lerp(bulb_on, minf(1, v)))
	for k in orbs.size():
		var e := 2.2 + 0.8 * sin(t * 2.2 + k)
		(orbs[k].material_override as StandardMaterial3D).emission_energy_multiplier = e
		orb_lights[k].light_energy = 0.8 + 0.3 * sin(t * 2.2 + k)
	studs_mat.emission_energy_multiplier = 1.6 + 0.8 * sin(t * 3)
	(beacon.material_override as StandardMaterial3D).emission_energy_multiplier = 6.0 if sin(t * 6) > 0 else 0.3
	_update_tiles(t, dt)


func _update_tiles(t: float, dt: float) -> void:
	var pulse := 0.5 + 0.5 * sin(t * 6)
	for T in tiles:
		var s: Dictionary = T.st
		s.step = maxf(0, s.step - dt * 2.2)
		s.flash = maxf(0, s.flash - dt * 1.6)
		var fc = null
		var fo := 0.0
		if s.target:
			fc = Color("#ffd000")
			fo = 0.75 + 0.25 * pulse
		elif s.chosen:
			fc = Color("#1f9d55")
			fo = 1.0
		elif s.pick:
			fc = Color("#ffc800")
			fo = 0.85
		elif s.fest:
			fc = Color("#ff5fa2")
			fo = 0.9
		elif s.rfest:
			fc = Color("#2fbf6c")
			fo = 0.75
		if s.step > 0:
			fc = Color("#fff2a0")
			fo = maxf(fo, s.step)
		if fc != null:
			T.mat.set_shader_parameter("frame_col", fc)
		s.frame += (fo - s.frame) * minf(1, dt * 12)
		T.mat.set_shader_parameter("frame_a", s.frame)
		T.mat.set_shader_parameter("dim", 1.0 if s.dim else 0.0)
		T.mat.set_shader_parameter("flash", s.flash)
		var lift: float = (0.08 + 0.05 * pulse if s.target else 0.0) + s.flash * 0.12 + s.step * 0.05
		s.lift += (lift - s.lift) * minf(1, dt * 14)
		T.grp.position.y = s.lift
