class_name Board2D
extends Node2D
## Bàn cờ 2D isometric: bệ 2 tầng đứng giữa hồ (có bóng soi nước), mặt bàn viền vát, sân giữa lát ca-rô + huy hiệu + cánh hoa
## rụng, 32 ô đất bo góc có chiều dày (chữ in trên mặt ô, nghiêng theo bàn), đèn viền chạy, đèn lồng 4 góc.
## Toạ độ ô dùng chung Board.TILE / Board.tp (bản 3D) rồi chiếu qua Iso.
## Vẽ thành 3 lớp: nền (chỉ vẽ lại khi đổi theme) → ô đất + đèn viền (mỗi khung hình) → chữ / icon → đèn lồng.

const TH := 0.16
const R := 0.085              # bán kính bo góc ô (đơn vị bàn)
const STYLE := {
	"sakura": {
		"top": "#fff7fa", "mat": "#f3cfe0", "side": ["#f9dbe8", "#eab6cf"], "side2": ["#e6adc8", "#cf8db0"], "ped": ["#d795b8", "#b8749b"],
		"trim": "#e8467c", "gold": "#ffd98a", "court": ["#fffbfd", "#fbe4ef"], "bulb": "#fff0f6", "ink": "#3b1f3f",
		"tile_side": ["#f4e3ea", "#d3b3c3"], "lantern": "#ff7fa8", "post": "#8a5670", "motif": "flower",
		"petals": ["#ffc2d6", "#ffd9e6", "#ffaecb", "#ffe6ef"], "refl": "#a884c4", "glow": "#ffffff",
	},
	"wood": {
		"top": "#f8ecd6", "mat": "#dfc291", "side": ["#e3bd7e", "#c9965a"], "side2": ["#b98248", "#93602f"], "ped": ["#8a5a2e", "#69421f"],
		"trim": "#d8922a", "gold": "#ffd98a", "court": ["#f6e4c0", "#ebd0a0"], "bulb": "#ffe9b0", "ink": "#3e2a17",
		"tile_side": ["#f1e4cb", "#c9b38c"], "lantern": "#ff8f3a", "post": "#5a3a20", "motif": "star",
		"petals": ["#f5a742", "#e8742a", "#ffcf6a", "#d9481f"], "refl": "#8f6a66", "glow": "#fff3d0",
	},
	"ocean": {
		"top": "#fffdf6", "mat": "#c4ebe6", "side": ["#3f80b0", "#2c5f8c"], "side2": ["#2a5a86", "#1c3a5e"], "ped": ["#1e4a70", "#14304d"],
		"trim": "#ffb703", "gold": "#ffe08a", "court": ["#fff8e6", "#d8f5f0"], "bulb": "#fff6c8", "ink": "#123250",
		"tile_side": ["#f0ead9", "#c3cbc2"], "lantern": "#ffd166", "post": "#1e3a5f", "motif": "star",
		"petals": [], "refl": "#2f86ad", "glow": "#ffffff",
	},
	"midnight": {
		"top": "#2c3569", "mat": "#1a2150", "side": ["#27306a", "#1a2147"], "side2": ["#161c40", "#0d122e"], "ped": ["#10153a", "#080b20"],
		"trim": "#8a72ff", "gold": "#c9b8ff", "court": ["#252d5a", "#1e254c"], "bulb": "#d6c8ff", "ink": "#eef1ff",
		"tile_side": ["#d3d7f2", "#979dca"], "lantern": "#b9a3ff", "post": "#0c1030", "motif": "star",
		"petals": ["#c9b8ff", "#8f86e0", "#e3dbff"], "refl": "#221f5c", "glow": "#8a72ff",
	},
}
## màu mặt ô: [mép xa, mép gần]
const TILE_BG := {
	"city": ["#ffffff", "#f7f1f4"], "resort": ["#fff7de", "#fde6b0"], "chance": ["#fff1f6", "#ffcfe0"], "tax": ["#f8f8f8", "#dcdcdc"],
	"start": ["#fff6c4", "#ffd35f"], "island": ["#defcff", "#8fdcea"], "festival": ["#ffe6f3", "#ff9ccb"], "airport": ["#e8f1ff", "#a2c5ff"],
}

var theme := "sakura"
var st: Array = []            # trạng thái từng ô
var labels: Array = []        # [name Label, price Label]
var font_b: FontFile
var font_sb: FontFile
var ring_font: Font = preload("res://assets/fonts/Montserrat-ExtraBold.ttf")
var t := 0.0
var target := -1
var base_layer: Node2D
var tile_layer: Node2D
var label_root: Node2D
var top_layer: Node2D
var order: Array = []         # thứ tự vẽ ô: xa trước, gần sau
var fx_layer: Node2D
var geo: Array = []           # hình học từng ô lúc nằm yên (bộ nhớ đệm)
var act: Array = []           # ô nào đang chuyển động
var dirty := true             # cần vẽ lại lớp ô đứng yên
var blob: Texture2D
var petal_tex: Texture2D


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
	top_layer = _layer(_draw_top)
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


## khung toạ độ trên mặt ô: trục a (dọc chữ), trục s (từ mép xa tới mép gần), đổi sang màn hình
func _tile_xf(i: int, a: float, s: float) -> Transform2D:
	var T: Dictionary = Board.TILE[i]
	var o := scr(Board.tp(i, a, s, TH))
	var ax := scr(Board.tp(i, a + 0.5, s, TH)) - scr(Board.tp(i, a - 0.5, s, TH))      # 1 đơn vị dọc chữ
	var sy := scr(Board.tp(i, a, s + 0.5, TH)) - scr(Board.tp(i, a, s - 0.5, TH))       # 1 đơn vị về phía gần
	var alen: float = T.alen
	var dlen: float = T.dlen
	return Transform2D(ax / alen, sy / dlen, o)


func _mk_label(text: String, font: Font, size: int, col: Color) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", col)
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
		var wpx := 96.0 if not corner else 136.0          # bề rộng chữ (px trong toạ độ ô ×100)
		var holder := Node2D.new()
		holder.transform = _tile_xf(i, 0, 0.62 if not corner else 0.66)
		holder.scale *= 0.01
		label_root.add_child(holder)
		var name := _mk_label(info.name, font_b, 24 if corner else 19, Color("#2a1e22"))
		name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		name.size = Vector2(wpx, 52)
		name.position = Vector2(-wpx / 2, -26)
		name.add_theme_constant_override("line_spacing", -4)
		holder.add_child(name)
		var holder2 := Node2D.new()
		holder2.transform = _tile_xf(i, 0, 0.87 if not corner else 0.84)
		holder2.scale *= 0.01
		label_root.add_child(holder2)
		var price := _mk_label(st[i].price, font_b if not corner else font_sb, 22 if not corner else 15, Color("#3b2a20"))
		price.size = Vector2(wpx, 30)
		price.position = Vector2(-wpx / 2, -15)
		holder2.add_child(price)
		# icon ô đặc biệt: hình đứng thẳng (không nghiêng) cho rõ
		if info.type != "city" and info.type != "resort":
			var ip := Data.icon_path(info)
			if ip != "":
				var sp := Sprite2D.new()
				sp.texture = load(ip)
				var sz := 62.0 if corner else 38.0
				sp.scale = Vector2.ONE * sz / sp.texture.get_width()
				sp.position = scr(Board.tp(i, 0, 0.3, TH)) + Vector2(0, -sz * 0.25)
				label_root.add_child(sp)
		labels.append([name, price])
		update_tile(i, {})


func set_theme(name: String) -> void:
	theme = name if STYLE.has(name) else "sakura"
	if label_root:
		_build_labels()
		base_layer.queue_redraw()
		dirty = true


func update_tile(i: int, u: Dictionary) -> void:
	for k in u:
		st[i][k] = u[k]
	var pl: Label = labels[i][1]
	pl.text = st[i].price
	var oc = st[i].owned
	pl.add_theme_color_override("font_color", Color(oc).darkened(0.25) if oc != null else Color("#3b2a20"))
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


## ô dưới điểm màn hình (toạ độ của Board2D)
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


## hình chữ nhật bo góc trên mặt ô (khung a: -0.5..0.5 dọc chữ, s: 0 mép xa..1 mép gần); rf / rn = bán kính bo ở mép xa / gần
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


## màu từng đỉnh: chuyển từ c0 (tại điểm p0) sang c1 (tại p1)
func _grad(pts: PackedVector2Array, p0: Vector2, p1: Vector2, c0: Color, c1: Color) -> PackedColorArray:
	var d := p1 - p0
	var l2 := maxf(d.length_squared(), 0.001)
	var out := PackedColorArray()
	for p in pts:
		out.append(c0.lerp(c1, clampf((p - p0).dot(d) / l2, 0, 1)))
	return out


func _quad(ci: CanvasItem, a: Vector2, b: Vector2, c: Vector2, d: Vector2, c_top: Color, c_bot: Color) -> void:
	ci.draw_polygon(PackedVector2Array([a, b, c, d]), PackedColorArray([c_top, c_top, c_bot, c_bot]))


func _sq(h: float, y: float) -> PackedVector2Array:
	return PackedVector2Array([Iso.p(-h, -h, y), Iso.p(h, -h, y), Iso.p(h, h, y), Iso.p(-h, h, y)])


func _circ(r: float, y: float, n := 72, c := Vector2.ZERO) -> PackedVector2Array:
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
	top_layer.queue_redraw()


# ============================== lớp nền (bệ, mặt bàn, sân giữa) ==============================

func _draw_base(ci: CanvasItem) -> void:
	var S: Dictionary = STYLE[theme]
	var W := Board.W
	var E := W / 2 + 0.38                 # nửa cạnh đế chính
	var E2 := E + 0.46                    # nửa cạnh bệ dưới
	var y1 := -0.86                       # đáy đế chính = mặt bệ dưới
	var y2 := -1.36                       # đáy bệ dưới = mặt nước
	var trim := Color(S.trim)
	var gold := Color(S.gold)
	# bóng đổ mềm trên mặt nước
	var c0 := Iso.p(0, 0, y2)
	ci.draw_texture_rect(blob, Rect2(c0 - Vector2(E2 * Iso.A * 1.42, E2 * Iso.B * 1.3) + Vector2(0, 30), Vector2(E2 * Iso.A * 2.84, E2 * Iso.B * 2.75)),
		false, Color(Color(S.refl).darkened(0.55), 0.36))
	# bóng soi của bệ xuống nước (mờ dần)
	var rc := Color(S.refl)
	var rh := 1.7
	_quad(ci, Iso.p(-E2, E2, y2), Iso.p(E2, E2, y2), Iso.p(E2, E2, y2 - rh), Iso.p(-E2, E2, y2 - rh), Color(rc.lightened(0.12), 0.50), Color(rc, 0.0))
	_quad(ci, Iso.p(E2, E2, y2), Iso.p(E2, -E2, y2), Iso.p(E2, -E2, y2 - rh), Iso.p(E2, E2, y2 - rh), Color(rc.darkened(0.12), 0.50), Color(rc, 0.0))
	# bệ dưới
	var pl := Color(S.ped[0])
	var pr := Color(S.ped[1])
	_quad(ci, Iso.p(-E2, E2, y1), Iso.p(E2, E2, y1), Iso.p(E2, E2, y2), Iso.p(-E2, E2, y2), pl, pl.darkened(0.22))
	_quad(ci, Iso.p(E2, E2, y1), Iso.p(E2, -E2, y1), Iso.p(E2, -E2, y2), Iso.p(E2, E2, y2), pr, pr.darkened(0.25))
	ci.draw_colored_polygon(_sq(E2, y1), pl.lightened(0.28))
	ci.draw_polyline(PackedVector2Array([Iso.p(-E2, E2, y1), Iso.p(E2, E2, y1), Iso.p(E2, -E2, y1)]), Color(1, 1, 1, 0.35), 1.5, true)
	ci.draw_polyline(PackedVector2Array([Iso.p(-E2, E2, y2), Iso.p(E2, E2, y2), Iso.p(E2, -E2, y2)]), Color(1, 1, 1, 0.45), 2.0, true)
	ci.draw_polyline(PackedVector2Array([Iso.p(-E2, E2, y1 - 0.13), Iso.p(E2, E2, y1 - 0.13), Iso.p(E2, -E2, y1 - 0.13)]), Color(gold, 0.85), 2.0, true)
	# bóng của đế chính đổ lên bệ dưới
	ci.draw_colored_polygon(PackedVector2Array([Iso.p(-E, E, y1), Iso.p(E, E, y1), Iso.p(E, -E, y1), Iso.p(E + 0.2, -E, y1), Iso.p(E + 0.2, E + 0.2, y1), Iso.p(-E, E + 0.2, y1)]),
		Color(pr.darkened(0.3), 0.35))
	# đế chính: 2 mặt bên nhìn thấy
	_quad(ci, Iso.p(-E, E, 0), Iso.p(E, E, 0), Iso.p(E, E, y1), Iso.p(-E, E, y1), Color(S.side[0]), Color(S.side[1]))
	_quad(ci, Iso.p(E, E, 0), Iso.p(E, -E, 0), Iso.p(E, -E, y1), Iso.p(E, E, y1), Color(S.side2[0]), Color(S.side2[1]))
	# rãnh đèn: dải sẫm chạy giữa mặt bên
	_quad(ci, Iso.p(-E, E, -0.30), Iso.p(E, E, -0.30), Iso.p(E, E, -0.58), Iso.p(-E, E, -0.58), Color(Color(S.side[1]).darkened(0.16), 0.9), Color(Color(S.side[1]).darkened(0.08), 0.9))
	_quad(ci, Iso.p(E, E, -0.30), Iso.p(E, -E, -0.30), Iso.p(E, -E, -0.58), Iso.p(E, E, -0.58), Color(Color(S.side2[1]).darkened(0.16), 0.9), Color(Color(S.side2[1]).darkened(0.08), 0.9))
	# nẹp viền trên / dưới
	for yy in [-0.10, -0.76]:
		ci.draw_polyline(PackedVector2Array([Iso.p(-E, E, yy), Iso.p(E, E, yy)]), trim, 3.0, true)
		ci.draw_polyline(PackedVector2Array([Iso.p(E, E, yy), Iso.p(E, -E, yy)]), trim.darkened(0.22), 3.0, true)
	# ốp góc mạ vàng ở 3 góc nhìn thấy
	var cw := 0.2
	_quad(ci, Iso.p(E - cw, E, 0), Iso.p(E, E, 0), Iso.p(E, E, y1), Iso.p(E - cw, E, y1), gold.lightened(0.25), gold.darkened(0.12))
	_quad(ci, Iso.p(E, E, 0), Iso.p(E, E - cw, 0), Iso.p(E, E - cw, y1), Iso.p(E, E, y1), gold, gold.darkened(0.3))
	_quad(ci, Iso.p(-E, E, 0), Iso.p(-E + cw, E, 0), Iso.p(-E + cw, E, y1), Iso.p(-E, E, y1), gold.lightened(0.25), gold.darkened(0.12))
	_quad(ci, Iso.p(E, -E + cw, 0), Iso.p(E, -E, 0), Iso.p(E, -E, y1), Iso.p(E, -E + cw, y1), gold, gold.darkened(0.3))
	# mặt trên: viền vát sáng + thảm dưới các ô
	ci.draw_colored_polygon(_sq(E, 0), Color(S.top))
	ci.draw_polyline(_closed(_sq(E, 0)), trim, 2.5, true)
	ci.draw_polyline(_closed(_sq(E - 0.09, 0)), Color(gold, 0.9), 2.0, true)
	ci.draw_colored_polygon(_sq(W / 2 + 0.1, 0.0), Color(S.mat))
	ci.draw_polyline(_closed(_sq(W / 2 + 0.1, 0.0)), Color(Color(S.mat).darkened(0.18), 0.7), 1.2, true)
	# sân giữa: ô ca-rô 8×8
	var inner := W - 2 * Board.CORNER - 2 * Board.GAP - 0.1
	var h := inner / 2
	var cell := inner / 8
	for a in 8:
		for b in 8:
			var x0 := -h + a * cell
			var z0 := -h + b * cell
			var poly := PackedVector2Array([Iso.p(x0, z0, 0.01), Iso.p(x0 + cell, z0, 0.01), Iso.p(x0 + cell, z0 + cell, 0.01), Iso.p(x0, z0 + cell, 0.01)])
			ci.draw_colored_polygon(poly, Color(S.court[(a + b) % 2]))
	# vầng sáng giữa sân
	var cc := Iso.p(0, 0, 0.01)
	var gl := Color(S.glow)
	ci.draw_texture_rect(blob, Rect2(cc - Vector2(h * Iso.A * 1.38, h * Iso.B * 1.38), Vector2(h * Iso.A * 2.76, h * Iso.B * 2.76)), false, Color(gl, 0.55 if theme != "midnight" else 0.22))
	# đường chỉ viền sân + hoa văn 4 góc
	ci.draw_polyline(_closed(_sq(h, 0.01)), Color(trim, 0.55), 2.0, true)
	ci.draw_polyline(_closed(_sq(h - 0.2, 0.01)), Color(trim, 0.42), 1.6, true)
	ci.draw_polyline(_closed(_sq(h - 0.29, 0.01)), Color(trim, 0.22), 1.0, true)
	for sv in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var k: Vector2 = sv * (h - 0.2)
		ci.draw_circle(Iso.p(k.x, k.y, 0.01), 5.0, Color(trim, 0.85))
		ci.draw_circle(Iso.p(k.x, k.y, 0.01), 2.6, gold)
		# cung trang trí ôm góc
		var arc := PackedVector2Array()
		for j in 13:
			var an := atan2(-sv.y, -sv.x) - PI / 4 + PI / 2 * j / 12.0
			arc.append(Iso.p(k.x + cos(an) * 0.62, k.y + sin(an) * 0.62, 0.01))
		ci.draw_polyline(arc, Color(trim, 0.38), 1.6, true)
	# huy hiệu: đĩa sáng + các vòng + chữ chạy vòng + hoạ tiết giữa
	ci.draw_colored_polygon(_circ(2.46, 0.012), Color(Color(S.court[0]).lightened(0.4), 0.55))
	for q in [[2.46, 0.8, 3.2], [2.3, 0.45, 1.4], [1.52, 0.55, 1.8], [1.4, 0.28, 1.0]]:
		ci.draw_polyline(_closed(_circ(q[0], 0.012, 96)), Color(trim, q[1]), q[2], true)
	for k in 48:
		var an := TAU * k / 48
		ci.draw_circle(Iso.p(cos(an) * 2.38, sin(an) * 2.38, 0.012), 1.7 if k % 4 else 2.8, Color(gold if k % 4 == 0 else trim, 0.9 if k % 4 == 0 else 0.45))
	var txt := "CỜ TỶ PHÚ • VIỆT NAM • MUA ĐẤT • XÂY NHÀ • "
	for k in txt.length():
		var an := -PI / 2 + TAU * k / txt.length()
		var p := Iso.p(cos(an) * 1.9, sin(an) * 1.9, 0.012)
		var tang := (Iso.p(cos(an + 0.01) * 1.9, sin(an + 0.01) * 1.9) - Iso.p(cos(an) * 1.9, sin(an) * 1.9)).normalized()
		ci.draw_set_transform(p, tang.angle(), Vector2(1, 0.62))
		ci.draw_string(ring_font, Vector2(-7, 7), txt[k], HORIZONTAL_ALIGNMENT_LEFT, -1, 21, Color(trim, 0.88))
	ci.draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
	_draw_motif(ci, S)
	# cánh hoa / lá rụng lác đác trên sân
	var pals: Array = S.petals
	if not pals.is_empty():
		var rng := RandomNumberGenerator.new()
		rng.seed = 7 + hash(theme)
		for k in 78:
			var px := rng.randf_range(-h + 0.15, h - 0.15)
			var pz := rng.randf_range(-h + 0.15, h - 0.15)
			var rot := rng.randf() * TAU
			var sz := rng.randf_range(6.5, 11.0)
			var col := Color(pals[rng.randi() % pals.size()])
			if Vector2(px, pz).length() < 1.25:
				continue
			var pp := Iso.p(px, pz, 0.012)
			ci.draw_set_transform_matrix(Transform2D(Vector2(cos(rot), sin(rot) * 0.6), Vector2(-sin(rot), cos(rot) * 0.6), pp + Vector2(1.2, 1.6)))
			ci.draw_texture_rect(petal_tex, Rect2(-sz, -sz, sz * 2, sz * 2), false, Color(0.3, 0.1, 0.25, 0.16))
			ci.draw_set_transform_matrix(Transform2D(Vector2(cos(rot), sin(rot) * 0.6), Vector2(-sin(rot), cos(rot) * 0.6), pp))
			ci.draw_texture_rect(petal_tex, Rect2(-sz, -sz, sz * 2, sz * 2), false, Color(col, 0.95))
		ci.draw_set_transform_matrix(Transform2D.IDENTITY)


func _draw_motif(ci: CanvasItem, S: Dictionary) -> void:
	var trim := Color(S.trim)
	var gold := Color(S.gold)
	if S.motif == "flower":
		# hoa anh đào 5 cánh, đầu cánh có khía
		for k in 5:
			var ang := -PI / 2 + TAU * k / 5
			var dir := Vector2(cos(ang), sin(ang))
			var nor := Vector2(-dir.y, dir.x)
			var lf: Array = []
			var rt: Array = []
			for j in 13:
				var u := j / 12.0 * 0.95
				var rad := lerpf(0.14, 1.28, u)
				var half := 0.50 * sin(PI * pow(u, 0.78)) + 0.05
				lf.append(dir * rad + nor * half)
				rt.append(dir * rad - nor * half)
			var pts := PackedVector2Array()
			for q in lf:
				pts.append(Iso.p(q.x, q.y, 0.013))
			var tip := dir * 1.10
			pts.append(Iso.p(tip.x, tip.y, 0.013))
			rt.reverse()
			for q in rt:
				pts.append(Iso.p(q.x, q.y, 0.013))
			var o := Iso.p(0, 0, 0.013)
			ci.draw_polygon(pts, _grad(pts, o, Iso.p(tip.x, tip.y, 0.013), Color(trim, 0.30), Color(trim, 0.10)))
			ci.draw_polyline(_closed(pts), Color(trim, 0.42), 1.5, true)
			var st0 := dir * 0.2
			var st1 := dir * 0.62
			ci.draw_line(Iso.p(st0.x, st0.y, 0.013), Iso.p(st1.x, st1.y, 0.013), Color(trim, 0.35), 1.2, true)
			ci.draw_circle(Iso.p(st1.x, st1.y, 0.013), 2.4, Color(gold, 0.95))
		ci.draw_colored_polygon(_circ(0.17, 0.013, 24), Color(gold, 0.95))
	else:
		# sao la bàn 8 cánh
		var radii := [1.30, 0.34, 0.80, 0.34]
		var pts := PackedVector2Array()
		for k in 16:
			var an := -PI / 2 + TAU * k / 16
			var r: float = radii[k % 4]
			pts.append(Iso.p(cos(an) * r, sin(an) * r, 0.013))
		ci.draw_colored_polygon(pts, Color(trim, 0.22))
		ci.draw_polyline(_closed(pts), Color(trim, 0.5), 1.5, true)
		for k in 8:
			var an := -PI / 2 + TAU * k / 8
			var r: float = 1.30 if k % 2 == 0 else 0.80
			ci.draw_line(Iso.p(0, 0, 0.013), Iso.p(cos(an) * r, sin(an) * r, 0.013), Color(trim, 0.32), 1.1, true)
		ci.draw_colored_polygon(_circ(0.2, 0.013, 24), Color(gold, 0.95))
		ci.draw_polyline(_closed(_circ(0.2, 0.013, 24)), Color(trim, 0.6), 1.2, true)


# ============================== lớp ô đất + đèn viền ==============================

## hình học của một ô ở độ nâng `lift` (lift = 0 thì lấy sẵn trong bộ nhớ đệm)
func _geo(i: int, lift: float) -> Dictionary:
	if lift == 0.0 and geo[i] != null:
		return geo[i]
	var info: Dictionary = Data.BOARD[i]
	var T: Dictionary = Board.TILE[i]
	var y: float = TH + lift
	var g := {"y": y}
	g.face = _shape(i, -0.5, 0.5, 0.0, 1.0, y)
	var foot := _shape(i, -0.5, 0.5, 0.0, 1.0, lift)
	var sh := _shape(i, -0.5, 0.5, 0.0, 1.0, 0.0)
	for k in sh.size():
		sh[k] += Vector2(1.5, 4.5 + lift * 60.0)
	g.sh = sh
	var both: PackedVector2Array = g.face.duplicate()
	both.append_array(foot)
	var hull := Geometry2D.convex_hull(both)
	hull.resize(hull.size() - 1)
	g.hull = hull
	g.cx = scr(Board.tp(i, 0, 0.5, y)).x
	g.hw = absf(scr(Board.tp(i, 0.5, 0.5, y)).x - scr(Board.tp(i, -0.5, 0.5, y)).x) + absf(scr(Board.tp(i, 0, 1.0, y)).x - scr(Board.tp(i, 0, 0.0, y)).x)
	g.pf = scr(Board.tp(i, 0, 0.0, y))
	g.pn = scr(Board.tp(i, 0, 1.0, y))
	g.banded = info.type == "resort" or info.has("group")
	if g.banded:
		var bh := 0.2 if info.has("group") else 0.27
		g.band = _shape(i, -0.5, 0.5, 0.0, bh, y, R, 0.0)
		g.pb = scr(Board.tp(i, 0, bh, y))
		g.gloss = _shape(i, -0.42, 0.42, 0.028, 0.062, y, 0.02, 0.02)
		g.l0 = scr(Board.tp(i, -0.5, bh, y))
		g.l1 = scr(Board.tp(i, 0.5, bh, y))
		g.star = scr(Board.tp(i, 0, bh * 0.5, y))
	else:
		var pc := Board.tp(i, 0, 0.3, y)
		g.plate = _circ(0.40 if T.side == "c" else 0.27, y, 28, Vector2(pc.x, pc.z))
	g.in25 = _closed(_inset(i, 0.025, y))
	g.in30 = _closed(_inset(i, 0.03, y))
	g.in55 = _closed(_inset(i, 0.055, y))
	g.name = scr(Board.tp(i, 0, 0.62 if T.side != "c" else 0.66, y))
	g.price = scr(Board.tp(i, 0, 0.87 if T.side != "c" else 0.84, y))
	if lift == 0.0:
		geo[i] = g
	return g


func _lift(i: int) -> float:
	var s: Dictionary = st[i]
	return (0.06 + 0.04 * (0.5 + 0.5 * sin(t * 6)) if i == target else 0.0) + s.flash * 0.08 + s.step * 0.05


## ô đang chuyển động (phải vẽ lại mỗi khung hình)
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
	# đèn chạy trong rãnh trên 2 mặt bên
	var n := 22
	var bulb := Color(S.bulb)
	var off := Color(S.side2[1]).darkened(0.25)
	for side in 2:
		for j in n:
			var u := -E + 2 * E * (j + 0.5) / n
			var w := Vector3(u, -0.44, E) if side == 0 else Vector3(E, -0.44, -u)
			var k := j + side * n
			var head := fmod(t * 14.0, n * 2.0)
			var d := minf(absf(k - head), n * 2 - absf(k - head))
			var v := minf(1.0, (0.55 if k % 3 == int(t * 3) % 3 else 0.22) + maxf(0, 1 - d / 5.0) * 0.9)
			var pp := Iso.v(w)
			ci.draw_texture_rect(blob, Rect2(pp - Vector2(16, 16), Vector2(32, 32)), false, Color(bulb, 0.65 * v))
			ci.draw_circle(pp, 5.6, off)
			ci.draw_circle(pp, 4.5, off.lerp(bulb, v))
			ci.draw_circle(pp + Vector2(-1.3, -1.4), 1.6, Color(1, 1, 1, 0.8 * v))
	for i in order:
		if act[i]:
			_draw_tile(ci, i, _lift(i))


## một ô đất: bóng → thân (mép dày) → mặt → dải màu → khung
func _draw_tile(ci: CanvasItem, i: int, lift: float) -> void:
	var S: Dictionary = STYLE[theme]
	var s: Dictionary = st[i]
	var info: Dictionary = Data.BOARD[i]
	var g := _geo(i, lift)
	var pulse := 0.5 + 0.5 * sin(t * 6)
	# bóng đổ trên thảm
	ci.draw_colored_polygon(g.sh, Color(0.25, 0.08, 0.22, 0.20))
	# thân ô: bao lồi của mặt trên và chân, sáng bên trái tối bên phải
	var c_l := Color(S.tile_side[0])
	var c_r := Color(S.tile_side[1])
	if s.dim:
		c_l = c_l.darkened(0.4)
		c_r = c_r.darkened(0.4)
	ci.draw_polygon(g.hull, _grad(g.hull, Vector2(g.cx - g.hw * 0.5, 0), Vector2(g.cx + g.hw * 0.5, 0), c_l, c_r))
	# mặt ô: chuyển màu từ mép xa tới mép gần
	var pair: Array = TILE_BG.get(info.type, ["#ffffff", "#f4f4f4"])
	var b0 := Color(pair[0])
	var b1 := Color(pair[1])
	if s.owned != null:
		b0 = b0.lerp(Color(s.owned), 0.10)
		b1 = b1.lerp(Color(s.owned), 0.20)
	if s.dim:
		b0 = b0.darkened(0.45)
		b1 = b1.darkened(0.45)
	b0 = b0.lightened(s.flash * 0.25)
	b1 = b1.lightened(s.flash * 0.25)
	ci.draw_polygon(g.face, _grad(g.face, g.pf, g.pn, b0, b1))
	# dải màu nhóm / dải biển ở mép xa
	if g.banded:
		var bc := Color(Data.GROUPS[info.group].color) if info.has("group") else Color("#3fb4dc")
		if s.dim:
			bc = bc.darkened(0.35)
		ci.draw_polygon(g.band, _grad(g.band, g.pf, g.pb, bc.lightened(0.16), bc.darkened(0.06)))
		ci.draw_colored_polygon(g.gloss, Color(1, 1, 1, 0.30))
		ci.draw_line(g.l0, g.l1, Color(bc.darkened(0.3), 0.55), 1.6, true)
		if s.mono:
			ci.draw_string(font_b, g.star + Vector2(-8, 6), "★", HORIZONTAL_ALIGNMENT_CENTER, 16, 17, Color.WHITE)
	else:
		# ô đặc biệt: đĩa sáng làm nền cho icon
		ci.draw_colored_polygon(g.plate, Color(1, 1, 1, 0.20 if s.dim else 0.55))
		ci.draw_polyline(_closed(g.plate), Color(b1.darkened(0.18), 0.55), 1.4, true)
	# viền sáng mảnh quanh mặt ô
	if not s.dim:
		ci.draw_polyline(g.in25, Color(1, 1, 1, 0.75), 1.2, true)
	# viền chủ đất
	if s.owned != null:
		ci.draw_polyline(g.in55, Color(s.owned), 3.0, true)
	# khung sáng: ô đích, ô chọn được, lễ hội
	var fc = null
	var fa := 0.0
	if i == target:
		fc = Color("#ffcf00")
		fa = 0.75 + 0.25 * pulse
	elif s.chosen:
		fc = Color("#1f9d55")
		fa = 1.0
	elif s.pick:
		fc = Color("#ffc800")
		fa = 0.6 + 0.4 * pulse
	elif s.fest:
		fc = Color("#ff5fa2")
		fa = 0.9
	elif s.rfest:
		fc = Color("#2fbf6c")
		fa = 0.75
	if s.step > 0:
		fc = Color("#fff2a0")
		fa = maxf(fa, s.step)
	if fc != null:
		ci.draw_polyline(g.in30, Color(fc, fa), 4.0, true)
	# chữ đi theo độ nâng của ô
	var lb: Array = labels[i]
	lb[0].get_parent().position = g.name
	lb[1].get_parent().position = g.price
	lb[0].get_parent().modulate.a = 0.45 if s.dim else 1.0
	lb[1].get_parent().modulate.a = 0.45 if s.dim else 1.0


# ============================== lớp trên cùng: đèn lồng 4 góc ==============================

func _draw_top(ci: CanvasItem) -> void:
	var S: Dictionary = STYLE[theme]
	var E := Board.W / 2 + 0.38
	var post := Color(S.post)
	var lan := Color(S.lantern)
	var gold := Color(S.gold)
	for sv in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var b := Iso.p(sv.x * (E + 0.23), sv.y * (E + 0.23), -0.86)
		var top := b + Vector2(0, -84)
		# chân đế + thân cột
		ci.draw_set_transform(b, 0, Vector2(1, 0.58))
		ci.draw_circle(Vector2.ZERO, 12, Color(0, 0, 0, 0.16))
		ci.draw_circle(Vector2(0, -3), 9.5, post.lightened(0.15))
		ci.draw_circle(Vector2(0, -7), 6.5, gold)
		ci.draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
		ci.draw_line(b + Vector2(0, -3), top, post, 5.0, true)
		ci.draw_line(b + Vector2(-1.4, -3), top + Vector2(-1.4, 0), post.lightened(0.35), 1.4, true)
		# đèn lồng giấy
		var c := top + Vector2(0, -15)
		var glow := 0.72 + 0.28 * sin(t * 2.2 + sv.x * 1.3 + sv.y * 2.1)
		ci.draw_texture_rect(blob, Rect2(c - Vector2(52, 52), Vector2(104, 104)), false, Color(lan.lightened(0.45), 0.42 * glow))
		ci.draw_rect(Rect2(c + Vector2(-7, -19), Vector2(14, 5)), post)
		ci.draw_rect(Rect2(c + Vector2(-7, 14), Vector2(14, 5)), post)
		ci.draw_set_transform(c, 0, Vector2(1, 1.08))
		ci.draw_circle(Vector2.ZERO, 15, lan.darkened(0.12))
		ci.draw_circle(Vector2(-1, -1), 13.5, lan)
		ci.draw_circle(Vector2(-2, -2), 9.0, lan.lightened(0.28 + 0.2 * glow))
		ci.draw_circle(Vector2(-4, -5), 4.0, Color(1, 1, 1, 0.55 + 0.3 * glow))
		ci.draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
		for dx in [-8.0, 0.0, 8.0]:
			ci.draw_line(c + Vector2(dx * 0.72, -13), c + Vector2(dx * 0.72, 13), Color(lan.darkened(0.3), 0.35), 1.0, true)
		ci.draw_line(c + Vector2(0, 19), c + Vector2(0, 28), gold, 2.0, true)
		ci.draw_circle(c + Vector2(0, 29), 2.4, gold)
