class_name UiKit
## Bộ dựng giao diện: bảng màu 4 theme (giống skin-td.css của bản app cũ), nút / thẻ / nhãn bo tròn có bóng đổ.

const PALETTE := {
	"midnight": {"bg1": "#0E1330", "bg2": "#1B0F2E", "panel": "#151A33", "panel2": "#1D2342", "border": "#2B3360",
		"text": "#EEF1FF", "dim": "#8C94C0", "accent": "#7B61FF", "a2": "#35D5FF", "gold": "#FFC857", "money": "#5BE49B", "shadow": Color(0, 0, 0, 0.55)},
	"wood": {"bg1": "#F6EEE3", "bg2": "#E5D1B8", "panel": "#FFFBF5", "panel2": "#F6EDE1", "border": "#E6D5BF",
		"text": "#3E2A17", "dim": "#8F7458", "accent": "#B8642E", "a2": "#1F3A5F", "gold": "#F0A020", "money": "#2f7d32", "shadow": Color(0.31, 0.18, 0.04, 0.28)},
	"ocean": {"bg1": "#34E5D7", "bg2": "#12B3C6", "panel": "#F6FFFE", "panel2": "#E6F7F6", "border": "#BFE9E6",
		"text": "#123250", "dim": "#56788F", "accent": "#0C93A5", "a2": "#FF6B5B", "gold": "#FFB703", "money": "#13895a", "shadow": Color(0.04, 0.24, 0.31, 0.3)},
	"sakura": {"bg1": "#FFF0F5", "bg2": "#EDE2FF", "panel": "#FFFFFF", "panel2": "#FBF2F8", "border": "#F0D9E7",
		"text": "#3B1F3F", "dim": "#9C7C9A", "accent": "#E8467C", "a2": "#6F4BE8", "gold": "#FFB020", "money": "#1f9d55", "shadow": Color(0.47, 0.16, 0.35, 0.22)},
}
const THEME_NAMES := {"midnight": "Midnight Neon", "wood": "Gỗ Cổ Điển", "ocean": "Đại Dương", "sakura": "Hoa Anh Đào"}
const THEMES := ["midnight", "wood", "ocean", "sakura"]

static var P: Dictionary = PALETTE.sakura
static var fonts := {}


static func set_theme(name: String) -> void:
	P = PALETTE.get(name, PALETTE.sakura)


static func c(key: String) -> Color:
	var v = P[key]
	return v if v is Color else Color(v)


static func font(weight := "Bold") -> FontFile:
	if not fonts.has(weight):
		fonts[weight] = load("res://assets/fonts/BeVietnamPro-%s.ttf" % weight)
	return fonts[weight]


static func box(bg: Color, radius := 18, border := Color(0, 0, 0, 0), bw := 0, shadow := 0, pad := Vector4(14, 12, 14, 12)) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	s.corner_detail = 10
	s.anti_aliasing = true
	if bw > 0:
		s.border_color = border
		s.set_border_width_all(bw)
	if shadow > 0:
		s.shadow_color = c("shadow")
		s.shadow_size = shadow
		s.shadow_offset = Vector2(0, shadow * 0.45)
	s.content_margin_left = pad.x
	s.content_margin_top = pad.y
	s.content_margin_right = pad.z
	s.content_margin_bottom = pad.w
	return s


static func panel(radius := 22, shadow := 14, pad := Vector4(18, 16, 18, 16)) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", box(c("panel"), radius, c("border"), 1, shadow, pad))
	return p


static func label(text: String, size := 16, color = null, weight := "Bold") -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_override("font", font(weight))
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color if color != null else c("text"))
	return l


static func rich(text: String, size := 16, color = null) -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.text = text
	r.add_theme_font_override("normal_font", font("Medium"))
	r.add_theme_font_override("bold_font", font("ExtraBold"))
	r.add_theme_font_size_override("normal_font_size", size)
	r.add_theme_font_size_override("bold_font_size", size)
	r.add_theme_color_override("default_color", color if color != null else c("text"))
	return r


## kind: normal | primary | green | gold | ghost | chip
static func button(text: String, kind := "normal", size := 16, sub := "") -> Button:
	var b := Button.new()
	b.text = text if sub == "" else text + "\n" + sub
	b.add_theme_font_override("font", font("ExtraBold"))
	b.add_theme_font_size_override("font_size", size)
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	style_button(b, kind)
	return b


static func style_button(b: Button, kind: String) -> void:
	var bg := c("panel2")
	var fg := c("text")
	var bd := c("border")
	var radius := 14
	match kind:
		"primary":
			bg = c("accent")
			fg = Color.WHITE
			bd = Color(0, 0, 0, 0)
		"green":
			bg = Color("#1f9d55")
			fg = Color.WHITE
			bd = Color(0, 0, 0, 0)
		"gold":
			bg = Color("#ffb020")
			fg = Color("#3a2200")
			bd = Color(0, 0, 0, 0)
		"ghost":
			bg = Color(c("accent"), 0.12)
			bd = Color(c("accent"), 0.35)
		"chip":
			bg = c("panel")
			radius = 99
	var pad := Vector4(18, 10, 18, 10) if kind != "chip" else Vector4(14, 8, 14, 8)
	var n := box(bg, radius, bd, 1 if bd.a > 0 else 0, 6 if kind in ["primary", "green", "gold"] else 0, pad)
	var h := box(bg.lightened(0.08), radius, c("accent") if kind in ["normal", "chip", "ghost"] else bd, 1 if (bd.a > 0 or kind in ["normal", "chip", "ghost"]) else 0, 8 if kind in ["primary", "green", "gold"] else 0, pad)
	var pr := box(bg.darkened(0.08), radius, bd, 1 if bd.a > 0 else 0, 0, pad)
	var d := box(bg.lerp(c("panel2"), 0.55), radius, bd, 1 if bd.a > 0 else 0, 0, pad)
	b.add_theme_stylebox_override("normal", n)
	b.add_theme_stylebox_override("hover", h)
	b.add_theme_stylebox_override("pressed", pr)
	b.add_theme_stylebox_override("disabled", d)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	for st in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
		b.add_theme_color_override(st, fg)
	b.add_theme_color_override("font_disabled_color", Color(fg, 0.45))


static func icon_button(tex: Texture2D, tip := "", size := 46) -> Button:
	var b := Button.new()
	b.icon = tex
	b.tooltip_text = tip
	b.expand_icon = true
	b.custom_minimum_size = Vector2(size, size)
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var pad := Vector4(11, 11, 11, 11)
	b.add_theme_stylebox_override("normal", box(c("panel"), 14, c("border"), 1, 6, pad))
	b.add_theme_stylebox_override("hover", box(c("panel"), 14, c("accent"), 1, 8, pad))
	b.add_theme_stylebox_override("pressed", box(c("panel2"), 14, c("accent"), 1, 0, pad))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.add_theme_color_override("icon_normal_color", c("text"))
	b.add_theme_color_override("icon_hover_color", c("accent"))
	return b


static func hbox(sep := 10) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", sep)
	return h


static func vbox(sep := 10) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", sep)
	return v


static func tex(path: String) -> Texture2D:
	return load(path) if ResourceLoader.exists(path) else null


static func portrait(k: int) -> Texture2D:
	return tex("res://assets/ui/chars/c%d.webp" % posmod(k, 12))


## ảnh nhân vật trong khung tròn màu người chơi
static func avatar(k: int, color: Color, size := 64) -> Control:
	var p := Panel.new()
	p.custom_minimum_size = Vector2(size, size)
	var sb := box(color.lerp(c("panel"), 0.72), size / 2, color, maxi(2, size / 22), 0, Vector4.ZERO)
	p.add_theme_stylebox_override("panel", sb)
	p.clip_children = CanvasItem.CLIP_CHILDREN_AND_DRAW
	var tr := TextureRect.new()
	tr.texture = portrait(k)
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	tr.set_anchors_preset(Control.PRESET_FULL_RECT)
	p.add_child(tr)
	return p


static func svg_icon(svg_path_d: String, size := 24) -> ImageTexture:
	var svg := '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="%d" height="%d"><path fill="#ffffff" d="%s"/></svg>' % [size * 2, size * 2, svg_path_d]
	var img := Image.new()
	img.load_svg_from_string(svg, 1.0)
	return ImageTexture.create_from_image(img)


const ICON_MENU := "M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"
const ICON_MUSIC := "M9 4.5v9.9A3.2 3.2 0 1 0 11 17.4V8.6l7-1.4v5.2a3.2 3.2 0 1 0 2 3V3z"
const ICON_SOUND := "M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"
const ICON_MUTE := "M4 9v6h4l5 4V5L8 9H4zm12.3 3 2.6-2.6-1.4-1.4-2.6 2.6-2.6-2.6-1.4 1.4 2.6 2.6-2.6 2.6 1.4 1.4 2.6-2.6 2.6 2.6 1.4-1.4z"
const ICON_CAM := "M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9zm3 5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z"
const ICON_FULL := "M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"
const ICON_CLOCK := "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v5.4l4 2.4-1 1.7-5-3V7z"
