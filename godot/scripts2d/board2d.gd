class_name Board2D
extends Node2D
## Bàn cờ 2D isometric: đế dày, sân giữa ca-rô + huy hiệu, 32 ô (chữ in trên mặt ô, nghiêng theo bàn), đèn viền chạy,
## cột đèn 4 góc. Toạ độ ô dùng chung Board.TILE / Board.tp (bản 3D) rồi chiếu qua Iso.

const TH := 0.16
const STYLE := {
	"sakura": {"top": "#fffafc", "side": "#f3cfe0", "side2": "#e2adc6", "trim": "#e8467c", "court": ["#fff7fb", "#fbe6f0"], "bulb": "#ffe2ef", "ink": "#3b1f3f"},
	"wood": {"top": "#f6e8cf", "side": "#d9ae6e", "side2": "#a26c38", "trim": "#e0a030", "court": ["#f3dfb8", "#e8cb98"], "bulb": "#ffe2a0", "ink": "#3e2a17"},
	"ocean": {"top": "#fffdf6", "side": "#bfe9e6", "side2": "#1e3a5f", "trim": "#ffb703", "court": ["#fff6e2", "#d6f4ef"], "bulb": "#fff6c8", "ink": "#123250"},
	"midnight": {"top": "#2a3366", "side": "#1a2147", "side2": "#0e1330", "trim": "#7b61ff", "court": ["#232b55", "#1d2449"], "bulb": "#c9b8ff", "ink": "#eef1ff"},
}
const TILE_BG := {
	"city": "#ffffff", "resort": "#fff4d6", "chance": "#ffe9f0", "tax": "#efefef",
	"start": "#ffeaa0", "island": "#c9f3f8", "festival": "#ffd3ea", "airport": "#d9e8ff",
}

var theme := "sakura"
var st: Array = []            # trạng thái từng ô
var labels: Array = []        # [name Label, price Label]
var font_b: FontFile
var font_sb: FontFile
var ring_font: Font = preload("res://assets/fonts/Montserrat-ExtraBold.ttf")
var t := 0.0
var target := -1


static func scr(w: Vector3) -> Vector2:
	return Iso.v(w)


func _ready() -> void:
	font_b = _msdf("res://assets/fonts/Montserrat-Bold.ttf")
	font_sb = _msdf("res://assets/fonts/Montserrat-SemiBold.ttf")
	for i in 32:
		st.append({"owned": null, "price": Data.tile_sub(Data.BOARD[i]), "mono": false, "fest": false, "rfest": false,
			"dim": false, "pick": false, "chosen": false, "flash": 0.0, "step": 0.0})
	_build_labels()


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
	for c in labels:
		for l in c:
			if l:
				l.get_parent().queue_free()
	labels.clear()
	var ink := Color(STYLE[theme].ink)
	for i in 32:
		var info: Dictionary = Data.BOARD[i]
		var corner: bool = Board.TILE[i].side == "c"
		var wpx := 96.0 if not corner else 136.0          # bề rộng chữ (px trong toạ độ ô ×100)
		var holder := Node2D.new()
		holder.transform = _tile_xf(i, 0, 0.62 if not corner else 0.66)
		holder.scale *= 0.01
		add_child(holder)
		var name := _mk_label(info.name, font_b, 24 if corner else 19, Color("#2a1e22"))
		name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		name.size = Vector2(wpx, 52)
		name.position = Vector2(-wpx / 2, -26)
		name.add_theme_constant_override("line_spacing", -4)
		holder.add_child(name)
		var holder2 := Node2D.new()
		holder2.transform = _tile_xf(i, 0, 0.87 if not corner else 0.84)
		holder2.scale *= 0.01
		add_child(holder2)
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
				var sz := 58.0 if corner else 38.0
				sp.scale = Vector2.ONE * sz / sp.texture.get_width()
				sp.position = scr(Board.tp(i, 0, 0.3, TH)) + Vector2(0, -sz * 0.25)
				add_child(sp)
		labels.append([name, price])


func set_theme(name: String) -> void:
	theme = name if STYLE.has(name) else "sakura"
	_build_labels()
	queue_redraw()


func update_tile(i: int, u: Dictionary) -> void:
	for k in u:
		st[i][k] = u[k]
	var pl: Label = labels[i][1]
	pl.text = st[i].price
	var oc = st[i].owned
	pl.add_theme_color_override("font_color", Color(oc).darkened(0.25) if oc != null else Color("#3b2a20"))
	queue_redraw()


func set_picks(list) -> void:
	for i in 32:
		st[i].pick = list != null and i in list
		st[i].dim = list != null and list.size() > 0 and not (i in list)
	queue_redraw()


func set_chosen(list) -> void:
	for i in 32:
		st[i].chosen = list != null and i in list


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


func _process(dt: float) -> void:
	t += dt
	for s in st:
		s.step = maxf(0, s.step - dt * 2.2)
		s.flash = maxf(0, s.flash - dt * 1.6)
	queue_redraw()


func _draw() -> void:
	var S: Dictionary = STYLE[theme]
	var W := Board.W
	var E := W / 2 + 0.38
	# bóng đổ mềm của cả bàn xuống mặt nước / cỏ
	var blob := Painter.soft_blob(128, 0.2)
	var c0 := Iso.p(0, 0, -0.8)
	draw_texture_rect(blob, Rect2(c0 - Vector2(E * Iso.A * 1.25, E * Iso.B * 1.0) + Vector2(30, 60), Vector2(E * Iso.A * 2.5, E * Iso.B * 2.2)), false, Color(0.25, 0.15, 0.35, 0.28))
	# đế: 2 mặt bên nhìn thấy (trái + phải) rồi mặt trên
	var top_y := 0.0
	var bot_y := -0.9
	var pts := [Vector2(-E, E), Vector2(E, E), Vector2(E, -E)]   # mép trước-trái, góc trước, mép trước-phải
	var left := PackedVector2Array([Iso.p(-E, E, top_y), Iso.p(E, E, top_y), Iso.p(E, E, bot_y), Iso.p(-E, E, bot_y)])
	var right := PackedVector2Array([Iso.p(E, E, top_y), Iso.p(E, -E, top_y), Iso.p(E, -E, bot_y), Iso.p(E, E, bot_y)])
	draw_colored_polygon(left, Color(S.side))
	draw_colored_polygon(right, Color(S.side2))
	# dải trang trí + đèn chạy trên 2 mặt bên
	var n := 22
	for side in 2:
		for j in n:
			var u := -E + 2 * E * (j + 0.5) / n
			var w := Vector3(u, -0.42, E) if side == 0 else Vector3(E, -0.42, -u)
			var k := j + side * n
			var head := fmod(t * 14.0, n * 2.0)
			var d := minf(absf(k - head), n * 2 - absf(k - head))
			var v := (0.55 if k % 3 == int(t * 3) % 3 else 0.25) + maxf(0, 1 - d / 5.0) * 0.9
			var col := Color("#6a5060").lerp(Color(S.bulb), minf(1, v))
			var pp := Iso.v(w)
			draw_circle(pp, 7.0, Color(col, 0.35))
			draw_circle(pp, 3.6, col.lightened(0.3))
	draw_line(Iso.p(-E, E, -0.12), Iso.p(E, E, -0.12), Color(S.trim), 3.0, true)
	draw_line(Iso.p(E, E, -0.12), Iso.p(E, -E, -0.12), Color(S.trim).darkened(0.2), 3.0, true)
	var topp := PackedVector2Array([Iso.p(-E, -E, top_y), Iso.p(E, -E, top_y), Iso.p(E, E, top_y), Iso.p(-E, E, top_y)])
	draw_colored_polygon(topp, Color(S.top))
	draw_polyline(PackedVector2Array([topp[0], topp[1], topp[2], topp[3], topp[0]]), Color(S.trim), 2.5, true)
	# sân giữa: ô ca-rô 8×8
	var inner := W - 2 * Board.CORNER - 2 * Board.GAP - 0.1
	var h := inner / 2
	var cell := inner / 8
	for a in 8:
		for b in 8:
			var x0 := -h + a * cell
			var z0 := -h + b * cell
			var poly := PackedVector2Array([Iso.p(x0, z0, 0.01), Iso.p(x0 + cell, z0, 0.01), Iso.p(x0 + cell, z0 + cell, 0.01), Iso.p(x0, z0 + cell, 0.01)])
			draw_colored_polygon(poly, Color(S.court[(a + b) % 2]))
	# huy hiệu: 2 vòng elip + chữ chạy vòng
	for rr in [2.3, 2.1, 1.55]:
		var ring := PackedVector2Array()
		for k in 97:
			var an := TAU * k / 96
			ring.append(Iso.p(cos(an) * rr, sin(an) * rr, 0.012))
		draw_polyline(ring, Color(Color(S.trim), 0.75 if rr > 2.2 else 0.5), 3.0 if rr > 2.2 else 1.6, true)
	var txt := "CỜ TỶ PHÚ • VIỆT NAM • MUA ĐẤT • XÂY NHÀ • "
	for k in txt.length():
		var an := -PI / 2 + TAU * k / txt.length()
		var p := Iso.p(cos(an) * 1.83, sin(an) * 1.83, 0.012)
		var tang := (Iso.p(cos(an + 0.01) * 1.83, sin(an + 0.01) * 1.83) - Iso.p(cos(an) * 1.83, sin(an) * 1.83)).normalized()
		draw_set_transform(p, tang.angle(), Vector2(1, 0.62))
		draw_string(ring_font, Vector2(-7, 7), txt[k], HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(Color(S.trim), 0.85))
	draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
	# ô đất: thân ô (mép dày) + mặt ô
	var pulse := 0.5 + 0.5 * sin(t * 6)
	var order := range(32)
	for i in order:
		var s: Dictionary = st[i]
		var info: Dictionary = Data.BOARD[i]
		var lift: float = (0.06 + 0.04 * pulse if i == target else 0.0) + s.flash * 0.08 + s.step * 0.05
		var y: float = TH + lift
		var face := _tile_poly(i, 0.0, y)
		var base := _tile_poly(i, 0.0, lift)
		# mép trước của ô (2 cạnh gần camera)
		draw_colored_polygon(PackedVector2Array([face[3], face[2], base[2], base[3]]), Color("#e8d4dc") if theme == "sakura" else Color(S.side))
		draw_colored_polygon(PackedVector2Array([face[2], face[1], base[1], base[2]]), Color("#d9bfcb") if theme == "sakura" else Color(S.side2))
		var bg := Color(TILE_BG.get(info.type, "#ffffff"))
		if s.owned != null:
			bg = bg.lerp(Color(s.owned), 0.14)
		if s.dim:
			bg = bg.darkened(0.45)
		bg = bg.lightened(s.flash * 0.25)
		draw_colored_polygon(face, bg)
		# dải màu nhóm / dải biển ở mép xa
		var T: Dictionary = Board.TILE[i]
		if info.type == "resort" or info.has("group"):
			var bh := 0.16 if info.has("group") else 0.26
			var band := PackedVector2Array([scr(Board.tp(i, -0.5, 0.0, y)), scr(Board.tp(i, 0.5, 0.0, y)), scr(Board.tp(i, 0.5, bh, y)), scr(Board.tp(i, -0.5, bh, y))])
			var bc := Color(Data.GROUPS[info.group].color) if info.has("group") else Color("#4fb3e3")
			draw_colored_polygon(band, bc.darkened(0.35) if s.dim else bc)
			if s.mono:
				var c := (band[0] + band[1] + band[2] + band[3]) / 4
				draw_string(font_b, c + Vector2(-6, 6), "★", HORIZONTAL_ALIGNMENT_CENTER, 12, 16, Color.WHITE)
		# viền chủ đất
		if s.owned != null:
			draw_polyline(_closed(_tile_poly(i, 0.05, y)), Color(s.owned), 3.0, true)
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
			draw_polyline(_closed(_tile_poly(i, 0.03, y)), Color(fc, fa), 4.0, true)
		# chữ đi theo độ nâng của ô
		var lb: Array = labels[i]
		lb[0].get_parent().position = scr(Board.tp(i, 0, 0.62 if T.side != "c" else 0.66, y))
		lb[1].get_parent().position = scr(Board.tp(i, 0, 0.87 if T.side != "c" else 0.84, y))
		lb[0].get_parent().modulate.a = 0.45 if s.dim else 1.0
		lb[1].get_parent().modulate.a = 0.45 if s.dim else 1.0
	# cột đèn 4 góc
	for sv in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var b := Iso.p(sv.x * (E + 0.05), sv.y * (E + 0.05), 0)
		var top := b + Vector2(0, -60)
		draw_line(b, top, Color("#ffffff"), 6, true)
		draw_line(b + Vector2(-2, 0), top + Vector2(-2, 0), Color("#e9dbe3"), 2, true)
		draw_circle(b, 9, Color("#f4e4ec"))
		var glow := 0.75 + 0.25 * sin(t * 2.2 + sv.x + sv.y * 2)
		draw_texture_rect(blob, Rect2(top - Vector2(34, 34), Vector2(68, 68)), false, Color(1, 0.86, 0.6, 0.45 * glow))
		draw_circle(top, 10, Color("#fff6d8"))
		draw_circle(top + Vector2(-3, -3), 4, Color.WHITE)


func _closed(p: PackedVector2Array) -> PackedVector2Array:
	var o := p.duplicate()
	o.append(p[0])
	return o
