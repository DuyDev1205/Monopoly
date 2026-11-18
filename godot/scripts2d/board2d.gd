class_name Board2D
extends Node2D
## Bàn cờ 2D isometric cao cấp: bệ đá 2 tầng giữa hồ gương (có sóng gợn quanh chân bệ & bóng soi nước),
## sân giữa lát đá cẩm thạch 8×8 khảm huy hiệu trống đồng / hoa anh đào / la bàn mạ vàng (render_board.py),
## 32 ô đất bo góc vát khối 3D rõ mặt sáng – mặt tối, dải sóng biển cát vàng cho khu du lịch,
## tiểu cảnh 3D riêng cho 4 ô góc (Xuất Phát, Đảo Hoang, Lễ Hội, Sân Bay), chữ in sắc nét không tràn mép.

const TH := 0.165
const R := 0.085              # bán kính bo góc ô (đơn vị bàn)
const STYLE := {
	"sakura": {
		"top": "#fff6fa", "mat": "#f2cce0", "side": ["#fae0ec", "#e8b2cc"], "side2": ["#e4a8c5", "#c985a8"], "ped": ["#d592b6", "#b36e95"],
		"trim": "#e8467c", "gold": "#ffd98a", "court": ["#fcf1f6", "#f2d2e2"], "bulb": "#fff0f6", "ink": "#3b1f3f",
		"tile_side": ["#fbf0f5", "#cfa9bc"], "lantern": "#ff7fa8", "post": "#8a5670",
		"petals": ["#ffc2d6", "#ffd9e6", "#ffaecb", "#ffe6ef"], "refl": "#a884c4", "glow": "#ffeef6",
	},
	"wood": {
		"top": "#f8ecd6", "mat": "#dfc08e", "side": ["#e5bf80", "#c89456"], "side2": ["#b98248", "#915d2c"], "ped": ["#8a5a2e", "#663f1c"],
		"trim": "#d8922a", "gold": "#ffd98a", "court": ["#f4e2c1", "#e4c596"], "bulb": "#ffe9b0", "ink": "#3e2a17",
		"tile_side": ["#f7ecda", "#c4ac82"], "lantern": "#ff9844", "post": "#5a3a20",
		"petals": ["#f5a742", "#e8742a", "#ffcf6a", "#d9481f"], "refl": "#8f6a66", "glow": "#fff3d0",
	},
	"ocean": {
		"top": "#fdfeff", "mat": "#cde5f7", "side": ["#2d6cdf", "#1a4bb3"], "side2": ["#1d4399", "#0f2866"], "ped": ["#15317a", "#0b1c48"],
		"trim": "#ffb703", "gold": "#ffe08a", "court": ["#fdfbf7", "#dceef8"], "bulb": "#fff6c8", "ink": "#0f2942",
		"tile_side": ["#f4f8fc", "#aec4dc"], "lantern": "#ffd166", "post": "#15317a",
		"petals": [], "refl": "#2672b5", "glow": "#e8f6ff",
	},
	"midnight": {
		"top": "#303a74", "mat": "#1c2456", "side": ["#2b3574", "#1c234d"], "side2": ["#192048", "#0f1433"], "ped": ["#121840", "#090c24"],
		"trim": "#947eff", "gold": "#d8c8ff", "court": ["#283164", "#1d244e"], "bulb": "#e0d4ff", "ink": "#eef1ff",
		"tile_side": ["#dcdff7", "#9097c9"], "lantern": "#c2aeff", "post": "#0c1030",
		"petals": ["#c9b8ff", "#8f86e0", "#e3dbff"], "refl": "#252263", "glow": "#8a72ff",
	},
	"cosmos": {
		"top": "#16204a", "mat": "#0c1330", "side": ["#182657", "#0d1638"], "side2": ["#0f193f", "#070c24"], "ped": ["#0a1130", "#040717"],
		"trim": "#2ce6ff", "gold": "#ffd46b", "court": ["#131b3f", "#0b1029"], "bulb": "#9bf8ff", "ink": "#ecf6ff",
		"tile_side": ["#d6e8ff", "#7c98c9"], "lantern": "#38f6ff", "post": "#080e28",
		"petals": ["#7df9ff", "#e879f9", "#ffd46b"], "refl": "#0e3566", "glow": "#2ce6ff",
	},
}
## màu mặt ô: [mép xa, mép gần]
const TILE_BG := {
	"city": ["#ffffff", "#f6eff3"], "resort": ["#fff9e6", "#fce6b2"], "chance": ["#fff2f7", "#ffd2e2"], "tax": ["#fafafa", "#e0e2e8"],
	"start": ["#fff8cc", "#ffd666"], "island": ["#e2fdff", "#96e0ee"], "festival": ["#ffe8f4", "#ffa4cf"], "airport": ["#eaf2ff", "#a8c9ff"],
}
const CORNER_TEX := {
	0: preload("res://assets/props2d/corner_start.png"),
	8: preload("res://assets/props2d/corner_island.png"),
	16: preload("res://assets/props2d/corner_festival.png"),
	24: preload("res://assets/props2d/corner_airport.png"),
}
const COURT_TEX := {
	"sakura": preload("res://assets/board2d/court_sakura.png"),
	"wood": preload("res://assets/board2d/court_wood.png"),
	"ocean": preload("res://assets/board2d/court_ocean.png"),
	"midnight": preload("res://assets/board2d/court_midnight.png"),
	"cosmos": preload("res://assets/board2d/court_cosmos.png"),
}

var theme := "ocean"
var st: Array = []            # trạng thái từng ô
var labels: Array = []        # [name Label, price Label]
var font_b: FontFile
var font_sb: FontFile
var t := 0.0
var target := -1
var base_layer: Node2D
var tile_layer: Node2D
var label_root: Node2D
var prop_layer: Node2D
var top_layer: Node2D
var order: Array = []         # thứ tự vẽ ô: xa trước, gần sau
var fx_layer: Node2D
var geo: Array = []           # hình học từng ô lúc nằm yên (bộ nhớ đệm)
var act: Array = []           # ô nào đang chuyển động
var dirty := true             # cần vẽ lại lớp ô đứng yên
var blob: Texture2D
var petal_tex: Texture2D
var paper_tex: Texture2D = preload("res://assets/board2d/paper.png")
var side_tex: Texture2D = preload("res://assets/board2d/side.png")
var plinth_tex: Texture2D = preload("res://assets/board2d/plinth.png")
var lamp_tex: Texture2D = preload("res://assets/props2d/andon.png")
const LAMP_SC := 0.70


static func scr(w: Vector3) -> Vector2:
	return Iso.v(w)


func _ready() -> void:
	blob = Painter.soft_blob(128, 0.2)
	petal_tex = Painter.petal(32)
	font_b = _msdf("res://assets/fonts/Montserrat-Bold.ttf")
	font_sb = _msdf("res://assets/fonts/Montserrat-SemiBold.ttf")
	for i in 32:
		st.append({"owned": null, "price": Data.tile_sub(Data.BOARD[i]), "mono": false, "fest": false, "rfest": false,
			"dim": false, "pick": false, "chosen": false, "flash": 0.0, "step": 0.0})
	order = range(32)
	order.sort_custom(func(a, b): return Board.TILE[a].x + Board.TILE[a].z < Board.TILE[b].x + Board.TILE[b].z)
	geo.resize(32)
	act.resize(32)
	act.fill(false)
	base_layer = _layer(_draw_base)
	tile_layer = _layer(_draw_static)
	fx_layer = _layer(_draw_fx)
	label_root = Node2D.new()
	add_child(label_root)
	prop_layer = _layer(_draw_corner_props)
	top_layer = _layer(_draw_top)
	for n in [base_layer, tile_layer, fx_layer, prop_layer, top_layer]:
		n.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		n.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	_build_labels()


func _layer(fn: Callable) -> Node2D:
	var n := Node2D.new()
	add_child(n)
	n.draw.connect(fn.bind(n))
	return n


func _msdf(path: String) -> FontFile:
	var f: FontFile = load(path).duplicate()
	f.multichannel_signed_distance_field = true
	f.msdf_pixel_range = 12
	f.msdf_size = 48
	return f


func _tile_xf(i: int, a: float, s: float) -> Transform2D:
	var T: Dictionary = Board.TILE[i]
	var o := scr(Board.tp(i, a, s, TH))
	var ax := scr(Board.tp(i, a + 0.5, s, TH)) - scr(Board.tp(i, a - 0.5, s, TH))
	var sy := scr(Board.tp(i, a, s + 0.5, TH)) - scr(Board.tp(i, a, s - 0.5, TH))
	return Transform2D(ax / float(T.alen), sy / float(T.dlen), o)


func _fit_font_size(text: String, font: Font, base_sz: int, max_w: float, min_sz := 11) -> int:
	var lines := text.split("\n")
	var sz := base_sz
	while sz > min_sz:
		var w := 0.0
		for ln in lines:
			w = maxf(w, font.get_string_size(ln, HORIZONTAL_ALIGNMENT_LEFT, -1, sz).x)
		if w <= max_w:
			break
		sz -= 1
	return sz


func _smart_wrap(text: String, font: Font, base_sz: int, max_w: float) -> String:
	if font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, base_sz).x <= max_w:
		return text
	var words := text.split(" ", false)
	if words.size() <= 1:
		return text
	var best := text
	var best_w := INF
	for k in range(1, words.size()):
		var l1 := " ".join(words.slice(0, k))
		var l2 := " ".join(words.slice(k))
		var w := maxf(font.get_string_size(l1, HORIZONTAL_ALIGNMENT_LEFT, -1, base_sz).x,
			font.get_string_size(l2, HORIZONTAL_ALIGNMENT_LEFT, -1, base_sz).x)
		if w < best_w:
			best_w = w
			best = l1 + "\n" + l2
	return best


func _mk_label(text: String, font: Font, size: int, col: Color, outline_a := 0.82) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
	if outline_a > 0.0:
		l.add_theme_color_override("font_outline_color", Color(1, 1, 1, outline_a))
		l.add_theme_constant_override("outline_size", 3)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _build_labels() -> void:
	for c in label_root.get_children():
		c.queue_free()
	labels.clear()
	for i in 32:
		var info: Dictionary = Data.BOARD[i]
		var corner: bool = Board.TILE[i].side == "c"
		var wpx := 88.0 if not corner else 138.0
		var raw_name: String = info.name
		var base_nsz := 20 if corner else 18
		var wrapped := raw_name if corner else _smart_wrap(raw_name, font_b, base_nsz, wpx)
		if corner and font_b.get_string_size(raw_name, HORIZONTAL_ALIGNMENT_LEFT, -1, base_nsz).x > wpx:
			wrapped = _smart_wrap(raw_name, font_b, base_nsz, wpx)
		var nsz := _fit_font_size(wrapped, font_b, base_nsz, wpx, 12)

		var s_name := (0.69 if corner else (0.61 if wrapped.contains("\n") else 0.63))
		var holder := Node2D.new()
		holder.transform = _tile_xf(i, 0, s_name)
		holder.scale *= 0.01
		label_root.add_child(holder)
		var name_lbl := _mk_label(wrapped, font_b, nsz, Color("#261822"))
		name_lbl.size = Vector2(wpx + 12, 54)
		name_lbl.position = Vector2(-(wpx + 12) * 0.5, -27)
		name_lbl.add_theme_constant_override("line_spacing", -1 if corner else -3)
		holder.add_child(name_lbl)

		var s_price := 0.86 if corner else 0.865
		var holder2 := Node2D.new()
		holder2.transform = _tile_xf(i, 0, s_price)
		holder2.scale *= 0.01
		label_root.add_child(holder2)
		var pfont := font_b if not corner else font_sb
		var base_psz := 19 if not corner else 15
		var psz := _fit_font_size(st[i].price, pfont, base_psz, wpx, 11)
		var price_lbl := _mk_label(st[i].price, pfont, psz, Color("#3b2820"))
		price_lbl.size = Vector2(wpx + 12, 30)
		price_lbl.position = Vector2(-(wpx + 12) * 0.5, -15)
		holder2.add_child(price_lbl)

		# Icon ô Cơ Hội / Thuế (4 ô góc đã có tiểu cảnh 3D riêng ở prop_layer)
		if not corner and info.type != "city" and info.type != "resort":
			var ip := Data.icon_path(info)
			if ip != "":
				var sp := Sprite2D.new()
				sp.texture = load(ip)
				var sz := 36.0
				sp.scale = Vector2.ONE * sz / sp.texture.get_width()
				sp.position = scr(Board.tp(i, 0, 0.30, TH)) + Vector2(0, -sz * 0.24)
				label_root.add_child(sp)
		labels.append([name_lbl, price_lbl, s_name, s_price])
		update_tile(i, {})


func set_theme(name: String) -> void:
	theme = name if STYLE.has(name) else "ocean"
	if label_root:
		_build_labels()
		base_layer.queue_redraw()
		dirty = true


func update_tile(i: int, u: Dictionary) -> void:
	for k in u:
		st[i][k] = u[k]
	var corner: bool = Board.TILE[i].side == "c"
	var wpx := 88.0 if not corner else 128.0
	var pfont := font_b if not corner else font_sb
	var base_psz := 19 if not corner else 15
	var pl: Label = labels[i][1]
	pl.text = st[i].price
	pl.add_theme_font_size_override("font_size", _fit_font_size(pl.text, pfont, base_psz, wpx, 11))
	var oc = st[i].owned
	pl.add_theme_color_override("font_color", Color(oc).darkened(0.28) if oc != null else Color("#3b2820"))
	dirty = true


func set_picks(list) -> void:
	for i in 32:
		st[i].pick = list != null and i in list
		st[i].dim = list != null and list.size() > 0 and not (i in list)
	dirty = true


func set_chosen(list) -> void:
	for i in 32:
		st[i].chosen = list != null and i in list
	dirty = true


func step_flash(i: int) -> void:
	st[i].step = 1.0


func flash_tile(i: int) -> void:
	st[i].flash = 1.0


func set_target(i: int) -> void:
	target = i


func tile_at(p: Vector2) -> int:
	for i in 32:
		if Geometry2D.is_point_in_polygon(p, _tile_poly(i, 0.0)):
			return i
	return -1


func _tile_poly(i: int, inset: float, y := TH) -> PackedVector2Array:
	var T: Dictionary = Board.TILE[i]
	var hw: float = T.w / 2 - inset
	var hd: float = T.d / 2 - inset
	var x: float = T.x
	var z: float = T.z
	return PackedVector2Array([Iso.p(x - hw, z - hd, y), Iso.p(x + hw, z - hd, y), Iso.p(x + hw, z + hd, y), Iso.p(x - hw, z + hd, y)])


func _shape(i: int, a0: float, a1: float, s0: float, s1: float, y: float, rf := R, rn := R) -> PackedVector2Array:
	var T: Dictionary = Board.TILE[i]
	var al: float = T.alen
	var dl: float = T.dlen
	var pts := PackedVector2Array()
	var cs := [[a0, s0, rf, 1.0, 1.0, PI], [a1, s0, rf, -1.0, 1.0, PI * 1.5], [a1, s1, rn, -1.0, -1.0, 0.0], [a0, s1, rn, 1.0, -1.0, PI * 0.5]]
	for c in cs:
		var r: float = c[2]
		if r < 0.002:
			pts.append(scr(Board.tp(i, c[0], c[1], y)))
			continue
		var ra := r / al
		var rs := r / dl
		var ca: float = c[0] + c[3] * ra
		var cc: float = c[1] + c[4] * rs
		for k in 5:
			var th: float = c[5] + PI * 0.5 * k / 4.0
			pts.append(scr(Board.tp(i, ca + cos(th) * ra, cc + sin(th) * rs, y)))
	return pts


func _inset(i: int, d: float, y: float) -> PackedVector2Array:
	var T: Dictionary = Board.TILE[i]
	return _shape(i, -0.5 + d / T.alen, 0.5 - d / T.alen, d / T.dlen, 1.0 - d / T.dlen, y, maxf(R - d, 0.02), maxf(R - d, 0.02))


func _closed(p: PackedVector2Array) -> PackedVector2Array:
	var o := p.duplicate()
	o.append(p[0])
	return o


func _grad(pts: PackedVector2Array, p0: Vector2, p1: Vector2, c0: Color, c1: Color) -> PackedColorArray:
	var d := p1 - p0
	var l2 := maxf(d.length_squared(), 0.001)
	var out := PackedColorArray()
	for p in pts:
		out.append(c0.lerp(c1, clampf((p - p0).dot(d) / l2, 0, 1)))
	return out


func _tquad(ci: CanvasItem, a: Vector2, b: Vector2, c: Vector2, d: Vector2, tex: Texture2D, c_top: Color, c_bot: Color, u1 := 1.0) -> void:
	ci.draw_polygon(PackedVector2Array([a, b, c, d]), PackedColorArray([c_top, c_top, c_bot, c_bot]),
		PackedVector2Array([Vector2(0, 0), Vector2(u1, 0), Vector2(u1, 1), Vector2(0, 1)]), tex)


func _uv(pts: PackedVector2Array, k: float) -> PackedVector2Array:
	var o := PackedVector2Array()
	for p in pts:
		o.append(p / k)
	return o


func _lamp(ci: CanvasItem, b: Vector2, S: Dictionary, glow: float) -> void:
	var lan := Color(S.lantern)
	var night := theme in ["midnight", "cosmos"]
	var sz := Vector2(lamp_tex.get_size()) * LAMP_SC
	var anc := Vector2(lamp_tex.get_width() * 0.5, lamp_tex.get_height() * 0.88) * LAMP_SC
	var c := b + Vector2(0, -54 * LAMP_SC)
	# Bóng chân đèn
	ci.draw_texture_rect(blob, Rect2(b - Vector2(36, 14), Vector2(72, 28)), false, Color(0.16, 0.06, 0.20, 0.30))
	# Quầng sáng ấm toả ra từ đèn lồng
	ci.draw_texture_rect(blob, Rect2(c - Vector2(76, 72), Vector2(152, 144)), false,
		Color(lan.lightened(0.45), (0.62 if night else 0.36) * glow))
	ci.draw_texture_rect(lamp_tex, Rect2(b - anc, sz), false)
	# Lõi sáng bên trong ô giấy của đèn
	var core_col := Color(0.75, 0.97, 1.0, 0.66 * glow) if theme == "cosmos" else Color(1.0, 0.92, 0.68, (0.62 if night else 0.42) * glow)
	ci.draw_texture_rect(blob, Rect2(c - Vector2(22, 26), Vector2(44, 52)), false, core_col)


func _quad(ci: CanvasItem, a: Vector2, b: Vector2, c: Vector2, d: Vector2, c_top: Color, c_bot: Color) -> void:
	ci.draw_polygon(PackedVector2Array([a, b, c, d]), PackedColorArray([c_top, c_top, c_bot, c_bot]))


func _sq(h: float, y: float) -> PackedVector2Array:
	return PackedVector2Array([Iso.p(-h, -h, y), Iso.p(h, -h, y), Iso.p(h, h, y), Iso.p(-h, h, y)])


func _circ(r: float, y: float, n := 56, c := Vector2.ZERO) -> PackedVector2Array:
	var ring := PackedVector2Array()
	for k in n:
		var an := TAU * k / n
		ring.append(Iso.p(c.x + cos(an) * r, c.y + sin(an) * r, y))
	return ring


func _process(dt: float) -> void:
	t += dt
	for s in st:
		s.step = maxf(0, s.step - dt * 2.2)
		s.flash = maxf(0, s.flash - dt * 1.6)
	for i in 32:
		var a := _is_active(i)
		if a != act[i]:
			act[i] = a
			dirty = true
	if dirty:
		dirty = false
		tile_layer.queue_redraw()
	fx_layer.queue_redraw()
	prop_layer.queue_redraw()
	top_layer.queue_redraw()


# ============================== lớp nền (bệ đá 2 tầng, mặt bàn, sân cẩm thạch + huy hiệu) ==============================

func _draw_base(ci: CanvasItem) -> void:
	var S: Dictionary = STYLE[theme]
	var W := Board.W
	var E := W / 2 + 0.38
	var E2 := E + 0.46
	var y1 := -0.86
	var y2 := -1.36
	var trim := Color(S.trim)
	var gold := Color(S.gold)

	# Bóng đổ mềm trên mặt hồ
	var c0 := Iso.p(0, 0, y2)
	ci.draw_texture_rect(blob, Rect2(c0 - Vector2(E2 * Iso.A * 1.44, E2 * Iso.B * 1.32) + Vector2(0, 32),
		Vector2(E2 * Iso.A * 2.88, E2 * Iso.B * 2.80)), false, Color(Color(S.refl).darkened(0.55), 0.38))

	# Bóng soi của bệ đá xuống mặt nước
	var rc := Color(S.refl)
	var rh := 1.75
	_quad(ci, Iso.p(-E2, E2, y2), Iso.p(E2, E2, y2), Iso.p(E2, E2, y2 - rh), Iso.p(-E2, E2, y2 - rh),
		Color(rc.lightened(0.14), 0.52), Color(rc, 0.0))
	_quad(ci, Iso.p(E2, E2, y2), Iso.p(E2, -E2, y2), Iso.p(E2, -E2, y2 - rh), Iso.p(E2, E2, y2 - rh),
		Color(rc.darkened(0.10), 0.52), Color(rc, 0.0))

	# Bệ đá dưới (tầng sát mặt nước)
	var pl := Color(S.ped[0])
	var pr := Color(S.ped[1])
	_tquad(ci, Iso.p(-E2, E2, y1), Iso.p(E2, E2, y1), Iso.p(E2, E2, y2), Iso.p(-E2, E2, y2), plinth_tex, pl.lightened(0.08), pl.darkened(0.16))
	_tquad(ci, Iso.p(E2, E2, y1), Iso.p(E2, -E2, y1), Iso.p(E2, -E2, y2), Iso.p(E2, E2, y2), plinth_tex, pr, pr.darkened(0.20))
	ci.draw_colored_polygon(_sq(E2, y1), pl.lightened(0.28))
	ci.draw_polyline(PackedVector2Array([Iso.p(-E2, E2, y1), Iso.p(E2, E2, y1), Iso.p(E2, -E2, y1)]), Color(1, 1, 1, 0.38), 1.6, true)
	ci.draw_polyline(PackedVector2Array([Iso.p(-E2, E2, y2), Iso.p(E2, E2, y2), Iso.p(E2, -E2, y2)]), Color(1, 1, 1, 0.52), 2.2, true)
	ci.draw_polyline(PackedVector2Array([Iso.p(-E2, E2, y1 - 0.13), Iso.p(E2, E2, y1 - 0.13), Iso.p(E2, -E2, y1 - 0.13)]), Color(gold, 0.88), 2.2, true)

	# Bóng của đế chính đổ lên mặt bệ dưới
	ci.draw_colored_polygon(PackedVector2Array([Iso.p(-E, E, y1), Iso.p(E, E, y1), Iso.p(E, -E, y1),
		Iso.p(E + 0.22, -E, y1), Iso.p(E + 0.22, E + 0.22, y1), Iso.p(-E, E + 0.22, y1)]), Color(pr.darkened(0.32), 0.36))

	# Đèn lồng ở góc xa (vẽ trước đế chính)
	_lamp(ci, Iso.p(-(E + 0.23), -(E + 0.23), y1), S, 0.88)

	# Đế chính: 2 mặt bên có phào khung lõm
	_tquad(ci, Iso.p(-E, E, 0), Iso.p(E, E, 0), Iso.p(E, E, y1), Iso.p(-E, E, y1), side_tex, Color(S.side[0]), Color(S.side[1]))
	_tquad(ci, Iso.p(E, E, 0), Iso.p(E, -E, 0), Iso.p(E, -E, y1), Iso.p(E, E, y1), side_tex, Color(S.side2[0]), Color(S.side2[1]))
	for yy in [-0.10, -0.76]:
		ci.draw_polyline(PackedVector2Array([Iso.p(-E, E, yy), Iso.p(E, E, yy)]), trim, 3.0, true)
		ci.draw_polyline(PackedVector2Array([Iso.p(E, E, yy), Iso.p(E, -E, yy)]), trim.darkened(0.22), 3.0, true)

	# Ốp góc mạ vàng ở 3 góc nhìn thấy
	var cw := 0.21
	_quad(ci, Iso.p(E - cw, E, 0), Iso.p(E, E, 0), Iso.p(E, E, y1), Iso.p(E - cw, E, y1), gold.lightened(0.28), gold.darkened(0.10))
	_quad(ci, Iso.p(E, E, 0), Iso.p(E, E - cw, 0), Iso.p(E, E - cw, y1), Iso.p(E, E, y1), gold, gold.darkened(0.28))
	_quad(ci, Iso.p(-E, E, 0), Iso.p(-E + cw, E, 0), Iso.p(-E + cw, E, y1), Iso.p(-E, E, y1), gold.lightened(0.28), gold.darkened(0.10))
	_quad(ci, Iso.p(E, -E + cw, 0), Iso.p(E, -E, 0), Iso.p(E, -E, y1), Iso.p(E, -E + cw, y1), gold, gold.darkened(0.28))

	# Mặt trên của bàn: viền chỉ kép mạ vàng + thảm lót các ô đất
	ci.draw_colored_polygon(_sq(E, 0), Color(S.top))
	ci.draw_polyline(_closed(_sq(E, 0)), trim, 2.6, true)
	ci.draw_polyline(_closed(_sq(E - 0.085, 0)), Color(gold, 0.92), 2.0, true)
	ci.draw_colored_polygon(_sq(W / 2 + 0.1, 0.0), Color(S.mat))
	ci.draw_polyline(_closed(_sq(W / 2 + 0.1, 0.0)), Color(Color(S.mat).darkened(0.20), 0.72), 1.4, true)

	# Sân giữa: gạch cẩm thạch 8×8 + khung viền + huy hiệu trung tâm siêu nét (từ court_<theme>.png)
	var inner := W - 2 * Board.CORNER - 2 * Board.GAP - 0.1
	var h := inner / 2
	var sq := _sq(h, 0.01)
	ci.draw_polygon(sq, PackedColorArray([Color.WHITE, Color.WHITE, Color.WHITE, Color.WHITE]),
		PackedVector2Array([Vector2(0, 0), Vector2(1, 0), Vector2(1, 1), Vector2(0, 1)]),
		COURT_TEX[theme])

	# Vầng sáng dịu giữa sân (nhẹ nhàng, giữ trọn vân gạch và họa tiết huy hiệu)
	var cc := Iso.p(0, 0, 0.012)
	ci.draw_texture_rect(blob, Rect2(cc - Vector2(h * Iso.A * 0.95, h * Iso.B * 0.95), Vector2(h * Iso.A * 1.9, h * Iso.B * 1.9)),
		false, Color(Color(S.glow), 0.14 if not (theme in ["midnight", "cosmos"]) else 0.20))

	# Cánh hoa / lá thu vương nhẹ ở 4 góc sân (tránh vùng chữ huy hiệu ở giữa)
	var pals: Array = S.petals
	if not pals.is_empty():
		var rng := RandomNumberGenerator.new()
		rng.seed = 19 + hash(theme)
		for k in 54:
			var px := rng.randf_range(-h + 0.22, h - 0.22)
			var pz := rng.randf_range(-h + 0.22, h - 0.22)
			if Vector2(px, pz).length() < 2.55:
				continue
			var rot := rng.randf() * TAU
			var sz := rng.randf_range(6.0, 10.2)
			var col := Color(pals[rng.randi() % pals.size()])
			var pp := Iso.p(px, pz, 0.012)
			ci.draw_set_transform_matrix(Transform2D(Vector2(cos(rot), sin(rot) * 0.6), Vector2(-sin(rot), cos(rot) * 0.6), pp + Vector2(1.2, 1.5)))
			ci.draw_texture_rect(petal_tex, Rect2(-sz, -sz, sz * 2, sz * 2), false, Color(0.25, 0.08, 0.22, 0.16))
			ci.draw_set_transform_matrix(Transform2D(Vector2(cos(rot), sin(rot) * 0.6), Vector2(-sin(rot), cos(rot) * 0.6), pp))
			ci.draw_texture_rect(petal_tex, Rect2(-sz, -sz, sz * 2, sz * 2), false, Color(col, 0.92))
		ci.draw_set_transform_matrix(Transform2D.IDENTITY)


# ============================== lớp ô đất + sóng nước + đèn viền ==============================

func _geo(i: int, lift: float) -> Dictionary:
	if lift == 0.0 and geo[i] != null:
		return geo[i]
	var info: Dictionary = Data.BOARD[i]
	var T: Dictionary = Board.TILE[i]
	var y: float = TH + lift
	var g := {"y": y}
	g.face = _shape(i, -0.5, 0.5, 0.0, 1.0, y)
	g.fuv = _uv(g.face, 240.0)
	var foot := _shape(i, -0.5, 0.5, 0.0, 1.0, lift)
	var sh := _shape(i, -0.5, 0.5, 0.0, 1.0, 0.0)
	for k in sh.size():
		sh[k] += Vector2(1.4, 4.8 + lift * 62.0)
	g.sh = sh

	# Tách 2 vách đứng phía trước của ô (bên trái sáng, bên phải tối) theo đúng chiều đi qua cạnh trước (y lớn hơn)
	var face_pts: PackedVector2Array = g.face
	var n: int = face_pts.size()
	var i_left := 0
	var i_right := 0
	var i_bot := 0
	for k in n:
		if face_pts[k].x < face_pts[i_left].x:
			i_left = k
		if face_pts[k].x > face_pts[i_right].x:
			i_right = k
		if face_pts[k].y > face_pts[i_bot].y:
			i_bot = k
	var step_f := 1 if face_pts[(i_left + 1) % n].y > face_pts[(i_left - 1 + n) % n].y else -1
	var wl := PackedVector2Array()
	var idx := i_left
	for _guard in n:
		wl.append(face_pts[idx])
		if idx == i_bot:
			break
		idx = (idx + step_f + n) % n
	for _guard in n:
		wl.append(foot[idx])
		if idx == i_left:
			break
		idx = (idx - step_f + n) % n
	var wr := PackedVector2Array()
	idx = i_bot
	for _guard in n:
		wr.append(face_pts[idx])
		if idx == i_right:
			break
		idx = (idx + step_f + n) % n
	for _guard in n:
		wr.append(foot[idx])
		if idx == i_bot:
			break
		idx = (idx - step_f + n) % n
	g.wall_l = wl
	g.wall_r = wr
	g.ridge_top = face_pts[i_bot]
	g.ridge_bot = foot[i_bot]

	g.pf = scr(Board.tp(i, 0, 0.0, y))
	g.pn = scr(Board.tp(i, 0, 1.0, y))
	g.resort = info.type == "resort"
	g.banded = g.resort or info.has("group")
	if g.banded:
		var bh := 0.205 if info.has("group") else 0.275
		g.band = _shape(i, -0.5, 0.5, 0.0, bh, y, R, 0.0)
		g.pb = scr(Board.tp(i, 0, bh, y))
		g.gloss = _shape(i, -0.43, 0.43, 0.026, 0.064, y, 0.02, 0.02)
		g.l0 = scr(Board.tp(i, -0.5, bh, y))
		g.l1 = scr(Board.tp(i, 0.5, bh, y))
		g.star = scr(Board.tp(i, 0, bh * 0.52, y))
		if g.resort:
			g.sea = _shape(i, -0.5, 0.5, 0.0, 0.205, y, R, 0.0)
			g.foam = _shape(i, -0.5, 0.5, 0.185, 0.222, y, 0.0, 0.0)
			g.psea = scr(Board.tp(i, 0, 0.205, y))
	else:
		var pc := Board.tp(i, 0, 0.29 if T.side == "c" else 0.30, y)
		g.plate = _circ(0.42 if T.side == "c" else 0.27, y, 32, Vector2(pc.x, pc.z))
	g.in22 = _closed(_inset(i, 0.022, y))
	g.in30 = _closed(_inset(i, 0.030, y))
	g.in55 = _closed(_inset(i, 0.055, y))
	var s_n: float = labels[i][2] if i < labels.size() else (0.69 if T.side == "c" else 0.62)
	var s_p: float = labels[i][3] if i < labels.size() else (0.86 if T.side == "c" else 0.865)
	g.name = scr(Board.tp(i, 0, s_n, y))
	g.price = scr(Board.tp(i, 0, s_p, y))
	g.prop = scr(Board.tp(i, 0, 0.29, y))
	if lift == 0.0:
		geo[i] = g
	return g


func _lift(i: int) -> float:
	var s: Dictionary = st[i]
	return (0.065 + 0.035 * (0.5 + 0.5 * sin(t * 6.0)) if i == target else 0.0) + s.flash * 0.08 + s.step * 0.05


func _is_active(i: int) -> bool:
	var s: Dictionary = st[i]
	return i == target or s.pick or s.step > 0 or s.flash > 0


func _draw_static(ci: CanvasItem) -> void:
	for i in order:
		if not act[i]:
			_draw_tile(ci, i, 0.0)


func _draw_fx(ci: CanvasItem) -> void:
	var S: Dictionary = STYLE[theme]
	var E := Board.W / 2 + 0.38
	var E2 := E + 0.46
	var y2 := -1.36

	# Vòng gợn sóng nước lan nhẹ ở 3 mũi bệ đá chạm mặt hồ
	for corner in [Vector2(-E2, E2), Vector2(E2, E2), Vector2(E2, -E2)]:
		var cp := Iso.p(corner.x, corner.y, y2)
		for r_i in 2:
			var ph := fmod(t * 0.38 + r_i * 0.5 + (corner.x + corner.y) * 0.07, 1.0)
			var rx := 22.0 + ph * 48.0
			var alpha := sin(ph * PI) * 0.24
			ci.draw_set_transform(cp, 0, Vector2(1.0, Iso.B / Iso.A))
			ci.draw_arc(Vector2.ZERO, rx, 0.0, TAU, 36, Color(1, 1, 1, alpha), 1.4, true)
		ci.draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)

	# Dải đèn ngọc chạy dọc rãnh 2 mặt bên đế bàn
	var n := 22
	var bulb := Color(S.bulb)
	var off := Color(S.side2[1]).darkened(0.28)
	for side in 2:
		for j in n:
			var u := -E + 2 * E * (j + 0.5) / n
			var w := Vector3(u, -0.43, E) if side == 0 else Vector3(E, -0.43, -u)
			var k := j + side * n
			var head := fmod(t * 14.0, n * 2.0)
			var d := minf(absf(k - head), n * 2 - absf(k - head))
			var v := minf(1.0, (0.55 if k % 3 == int(t * 3) % 3 else 0.20) + maxf(0, 1 - d / 5.0) * 0.92)
			var pp := Iso.v(w)
			ci.draw_texture_rect(blob, Rect2(pp - Vector2(17, 17), Vector2(34, 34)), false, Color(bulb, 0.68 * v))
			ci.draw_circle(pp, 5.6, off)
			ci.draw_circle(pp, 4.4, off.lerp(bulb, v))
			ci.draw_circle(pp + Vector2(-1.3, -1.4), 1.6, Color(1, 1, 1, 0.85 * v))

	for i in order:
		if act[i]:
			_draw_tile(ci, i, _lift(i))


func _draw_tile(ci: CanvasItem, i: int, lift: float) -> void:
	var S: Dictionary = STYLE[theme]
	var s: Dictionary = st[i]
	var info: Dictionary = Data.BOARD[i]
	var g := _geo(i, lift)
	var pulse := 0.5 + 0.5 * sin(t * 6.0)

	# Quầng sáng dưới chân ô đích / ô đang chọn
	if i == target or s.pick:
		var gc := Color("#ffd000") if i == target else Color("#ffdc48")
		ci.draw_colored_polygon(g.sh, Color(gc, 0.34 + 0.20 * pulse))
	else:
		ci.draw_colored_polygon(g.sh, Color(0.22, 0.07, 0.20, 0.22))

	# Thân ô dày 3D: vách trái bắt nắng ấm, vách phải đổ bóng dịu, sống mũi giữa sáng nhẹ
	var c_l := Color(S.tile_side[0])
	var c_r := Color(S.tile_side[1])
	if s.owned != null:
		c_l = c_l.lerp(Color(s.owned).lightened(0.35), 0.22)
		c_r = c_r.lerp(Color(s.owned).darkened(0.10), 0.25)
	if s.dim:
		c_l = c_l.darkened(0.42)
		c_r = c_r.darkened(0.42)
	if g.wall_l.size() >= 3:
		ci.draw_colored_polygon(g.wall_l, c_l)
	if g.wall_r.size() >= 3:
		ci.draw_colored_polygon(g.wall_r, c_r)
	ci.draw_line(g.ridge_top, g.ridge_bot, c_l.lightened(0.18), 1.4, true)

	# Mặt ô: chuyển màu mịn + vân giấy mỹ thuật
	var pair: Array = TILE_BG.get(info.type, ["#ffffff", "#f4f4f4"])
	var b0 := Color(pair[0])
	var b1 := Color(pair[1])
	if s.owned != null:
		b0 = b0.lerp(Color(s.owned), 0.09)
		b1 = b1.lerp(Color(s.owned), 0.18)
	if s.dim:
		b0 = b0.darkened(0.45)
		b1 = b1.darkened(0.45)
	b0 = b0.lightened(s.flash * 0.25)
	b1 = b1.lightened(s.flash * 0.25)
	ci.draw_polygon(g.face, _grad(g.face, g.pf, g.pn, b0, b1), g.fuv, paper_tex)

	# Dải màu nhóm / dải biển cát vàng của khu du lịch
	if g.banded:
		if g.resort:
			var sand := Color("#f7de9c") if not s.dim else Color("#f7de9c").darkened(0.38)
			var sea0 := Color("#1789b8") if not s.dim else Color("#1789b8").darkened(0.38)
			var sea1 := Color("#5fd3eb") if not s.dim else Color("#5fd3eb").darkened(0.38)
			ci.draw_colored_polygon(g.band, sand)
			ci.draw_polygon(g.sea, _grad(g.sea, g.pf, g.psea, sea0, sea1))
			ci.draw_colored_polygon(g.foam, Color(1, 1, 1, 0.78 if not s.dim else 0.35))
			ci.draw_colored_polygon(g.gloss, Color(1, 1, 1, 0.32))
			ci.draw_line(g.l0, g.l1, Color("#d4b26a", 0.55), 1.4, true)
		else:
			var bc := Color(Data.GROUPS[info.group].color)
			if s.dim:
				bc = bc.darkened(0.38)
			ci.draw_polygon(g.band, _grad(g.band, g.pf, g.pb, bc.lightened(0.18), bc.darkened(0.08)))
			ci.draw_colored_polygon(g.gloss, Color(1, 1, 1, 0.34))
			ci.draw_line(g.l0, g.l1, Color(bc.darkened(0.32), 0.58), 1.6, true)
			if s.mono:
				ci.draw_circle(g.star, 8.5, Color("#ffd43b"))
				ci.draw_arc(g.star, 8.5, 0, TAU, 20, Color.WHITE, 1.4, true)
				ci.draw_string(font_b, g.star + Vector2(-8, 5.5), "★", HORIZONTAL_ALIGNMENT_CENTER, 16, 13, Color("#663c00"))
	else:
		ci.draw_colored_polygon(g.plate, Color(1, 1, 1, 0.22 if s.dim else 0.52))
		ci.draw_polyline(_closed(g.plate), Color(b1.darkened(0.20), 0.52), 1.4, true)

	# Viền vát sáng mảnh quanh mép trên mặt ô
	if not s.dim:
		ci.draw_polyline(g.in22, Color(1, 1, 1, 0.82), 1.3, true)

	# Viền chủ đất
	if s.owned != null:
		ci.draw_polyline(g.in55, Color(s.owned), 3.0, true)

	# Khung sáng: ô đích, ô chọn được, lễ hội (nằm gọn quanh viền ô, không đè ngang chữ)
	var fc = null
	var fa := 0.0
	if i == target:
		fc = Color("#ffd000")
		fa = 0.82 + 0.18 * pulse
	elif s.chosen:
		fc = Color("#1f9d55")
		fa = 1.0
	elif s.pick:
		fc = Color("#ffc800")
		fa = 0.65 + 0.35 * pulse
	elif s.fest:
		fc = Color("#ff5fa2")
		fa = 0.92
	elif s.rfest:
		fc = Color("#2fbf6c")
		fa = 0.78
	if s.step > 0:
		fc = Color("#fff2a0")
		fa = maxf(fa, s.step)
	if fc != null:
		ci.draw_polyline(g.in30, Color(fc, fa), 4.2, true)

	# Cập nhật vị trí chữ theo độ nâng của ô
	if i < labels.size():
		var lb: Array = labels[i]
		lb[0].get_parent().position = g.name
		lb[1].get_parent().position = g.price
		lb[0].get_parent().modulate.a = 0.45 if s.dim else 1.0
		lb[1].get_parent().modulate.a = 0.45 if s.dim else 1.0


# ============================== tiểu cảnh 3D trên 4 ô góc + đèn lồng 4 góc bệ ==============================

func _draw_corner_props(ci: CanvasItem) -> void:
	for i in [16, 8, 24, 0]:
		var tex: Texture2D = CORNER_TEX[i]
		var g := _geo(i, _lift(i))
		var p: Vector2 = g.prop
		var sc := 0.48
		var sz := Vector2(tex.get_size()) * sc
		var anc := Vector2(sz.x * 0.5, sz.y * 0.86)
		var alpha := 0.45 if st[i].dim else 1.0
		ci.draw_texture_rect(blob, Rect2(p - Vector2(36, 15), Vector2(72, 30)), false, Color(0.2, 0.08, 0.22, 0.22 * alpha))
		ci.draw_texture_rect(tex, Rect2(p - anc, sz), false, Color(1, 1, 1, alpha))
		# Hiệu ứng sống động riêng cho từng góc: đèn nháy đài không lưu Sân Bay & lồng đèn ấm Lễ Hội
		if i == 24 and not st[i].dim:
			var blink := 0.25 + 0.75 * maxf(0.0, sin(t * 5.5))
			var bp := p + Vector2(-9, -56)
			ci.draw_texture_rect(blob, Rect2(bp - Vector2(13, 13), Vector2(26, 26)), false, Color(1.0, 0.25, 0.25, 0.75 * blink))
			ci.draw_circle(bp, 3.0, Color(1.0, 0.88, 0.85, blink))
		elif i == 16 and not st[i].dim:
			var gl := 0.75 + 0.25 * sin(t * 3.0)
			ci.draw_texture_rect(blob, Rect2(p + Vector2(-42, -52), Vector2(84, 52)), false, Color(1.0, 0.65, 0.38, 0.24 * gl))


func _draw_top(ci: CanvasItem) -> void:
	var S: Dictionary = STYLE[theme]
	var E := Board.W / 2 + 0.38
	for sv in [Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var glow := 0.78 + 0.22 * sin(t * 2.2 + sv.x * 1.3 + sv.y * 2.1)
		_lamp(ci, Iso.p(sv.x * (E + 0.23), sv.y * (E + 0.23), -0.86), S, glow)
