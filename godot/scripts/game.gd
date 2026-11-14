class_name Game
extends CanvasLayer
## Bộ điều khiển ván + toàn bộ giao diện 2D (trang chủ, thanh trên, 4 thẻ người chơi ở góc, bảng hành động,
## băng rôn sự kiện, thẻ Cơ Hội, menu, màn thắng, luật chơi). Phát lại sự kiện từ Rules giống play() của js/app.js.

const LVL_NAME := ["Chỉ mua đất", "Nhà cấp 1", "Nhà cấp 2", "Nhà cấp 3", "Khách sạn"]
const CHAR_NAMES := ["Hiệp Sĩ", "Phù Thủy", "Tráng Sĩ", "Lãng Khách", "Ninja", "Xương Giáp", "Xương Phép", "Bé Xương", "Xương Ninja", "Chàng Hiệp Sĩ", "Pháp Sư Trẻ", "Thợ Săn"]
const SAVE_PATH := "user://save.json"
const SETTINGS_PATH := "user://settings.json"
const VERSION := "2.0.0"

var main: Node3D
var audio: GameAudio
var net = null                  # chơi online (net.gd), null khi chơi trên máy
var settings := {
	"theme": "sakura", "dice": "classic", "music": true, "sound": true, "follow": true, "time": 60,
	"setup": [{"name": "Bạn", "bot": false, "char": 0}, {"name": "Máy 1", "bot": true, "char": 1}, {"name": "Máy 2", "bot": true, "char": 2}, {"name": "Máy 3", "bot": true, "char": 3}],
	"name": "", "fullscreen": true,
}

# ---- trạng thái ván ----
var mode := ""                  # "local" | "online"
var S = null                    # trạng thái đã hiển thị xong
var auth = null                 # trạng thái gốc (chơi trên máy)
var my_seat := -1
var busy := false
var queue: Array = []
var view := {"pos": [], "money": []}
var last_tick := 0
var bot_timer: SceneTreeTimer = null
var bot_gen := 0
var win_shown := false
var sell_sel := {}
var picks: Array = []
var fest_intro := false

# ---- giao diện ----
var root: Control
var home: Control
var hud: Control
var actions_box: VBoxContainer
var side_box: Control
var turn_pill: PanelContainer
var cards: Array = []
var clock_lbl: Label
var ticker: Label
var toasts: VBoxContainer
var banner_box: Control
var modal: Control
var music_btn: Button
var sound_btn: Button
var cam_btn: Button
var home_mode := "local"
var updater: Updater
var update_ver := ""


func _ready() -> void:
	main = get_parent()
	_load_settings()
	UiKit.set_theme(settings.theme)
	audio = GameAudio.new()
	add_child(audio)
	audio.sound_on = settings.sound
	audio.track_changed.connect(func(t): if mode != "" or true: toast("🎵 %s — %s" % [t.title, t.by], 2.2))
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	main.tile_clicked.connect(_on_tile_click)
	main.pieces.set_dice_skin(settings.dice)
	main.set_theme(settings.theme)
	main.follow_on = settings.follow
	main.apply_quality(int(settings.get("quality", 2)))
	_build_overlays()
	updater = Updater.new()
	add_child(updater)
	updater.found.connect(func(v, _n):
		update_ver = v
		if home and mode == "":
			show_home())
	updater.progress.connect(func(p): toast("Đang tải bản cập nhật… %d%%" % int(p * 100), 0.4))
	updater.failed.connect(func(m): toast(m))
	if not OS.has_feature("editor") and not main.args.has("noupdate"):
		updater.check(VERSION)
	show_home()
	if settings.music:
		audio.set_music(true)
	if settings.fullscreen and not main.args.has("size"):
		get_window().mode = Window.MODE_FULLSCREEN
	# chạy thử: --start (người + 3 máy) hoặc --allbots (4 máy), --home=online
	if main.args.has("home"):
		home_mode = main.args.home
		show_home()
	if main.args.has("start") or main.args.has("allbots"):
		var ps := [{"name": "Bạn", "bot": not main.args.has("start"), "char": 0}, {"name": "Máy 1", "bot": true, "char": 1},
			{"name": "Máy 2", "bot": true, "char": 5}, {"name": "Máy 3", "bot": true, "char": 9}]
		start_local(ps, 60)
	if main.args.has("host"):
		settings.name = "Chủ Godot"
		_start_online_host()
		print("MÃ PHÒNG ", net.code)
	if main.args.has("join"):
		settings.name = "Khách Godot"
		_start_online_join(main.args.join)
	if main.args.has("moneylog"):
		_money_log()
	if main.args.has("speed"):
		Engine.time_scale = float(main.args.speed)
	if main.args.has("autoplay"):
		_autoplay()
		_fps_log()


func _money_log() -> void:
	while is_inside_tree():
		await get_tree().create_timer(5.0).timeout
		if S:
			var ms := []
			for p in S.players:
				ms.append(int(p.money))
			print("TIỀN seq=%d %s" % [int(S.seq), str(ms)])


func _fps_log() -> void:
	var lo := 999.0
	var sum := 0.0
	var n := 0
	while is_inside_tree():
		await get_tree().create_timer(2.0, true, false, true).timeout
		var f := Engine.get_frames_per_second()
		lo = minf(lo, f)
		sum += f
		n += 1
		if n % 5 == 0:
			print("fps tb=%.0f thấp=%.0f phase=%s vòng=%s" % [sum / n, lo, S.phase if S else "-", S.round if S else "-"])


## chạy thử: tự bấm như người chơi (dùng nước đi của máy), ghi lỗi
func _autoplay() -> void:
	while is_inside_tree():
		await get_tree().create_timer(1.2).timeout
		if S and is_mine() and not modal.visible:
			var a = Bot.action(S, int(S.cur))
			if a != null:
				if a.type == "sell":
					a = {"type": "sellMany", "tiles": [a.tile]}
				act(a)


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		if e.keycode == KEY_F11 or (e.keycode == KEY_ENTER and e.alt_pressed):
			_toggle_fullscreen()
		elif e.keycode == KEY_ESCAPE:
			if modal.visible:
				close_modal()
			elif hud and hud.visible:
				open_menu()
		elif e.keycode == KEY_SPACE and is_mine() and S and S.phase == "roll" and not busy:
			act({"type": "roll"})


# ======================= cài đặt + lưu ván =======================
func _load_settings() -> void:
	if FileAccess.file_exists(SETTINGS_PATH):
		var d = JSON.parse_string(FileAccess.get_file_as_string(SETTINGS_PATH))
		if d is Dictionary:
			for k in d:
				settings[k] = Rules.normalize(d[k])


func save_settings() -> void:
	var f := FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(settings))


func _save_game() -> void:
	if auth == null:
		return
	if auth.phase == "over":
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE_PATH))
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(auth))


func _saved_game():
	if not FileAccess.file_exists(SAVE_PATH):
		return null
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if d is Dictionary and int(d.get("v", 0)) == 3:
		return Rules.normalize(d)
	return null


# ======================= lớp phủ chung: thông báo, băng rôn, hộp thoại =======================
func _build_overlays() -> void:
	toasts = UiKit.vbox(8)
	toasts.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	toasts.position = Vector2(-240, -150)
	toasts.size = Vector2(480, 120)
	toasts.alignment = BoxContainer.ALIGNMENT_END
	toasts.mouse_filter = Control.MOUSE_FILTER_IGNORE
	toasts.z_index = 50
	add_child(toasts)
	banner_box = Control.new()
	banner_box.set_anchors_preset(Control.PRESET_FULL_RECT)
	banner_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	banner_box.z_index = 40
	add_child(banner_box)
	modal = Control.new()
	modal.set_anchors_preset(Control.PRESET_FULL_RECT)
	modal.visible = false
	modal.z_index = 60
	add_child(modal)


func toast(text: String, sec := 2.6) -> void:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", UiKit.box(Color(0.1, 0.06, 0.12, 0.86), 99, Color(0, 0, 0, 0), 0, 6, Vector4(18, 9, 18, 9)))
	var l := UiKit.label(text, 15, Color.WHITE, "Bold")
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	p.add_child(l)
	p.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	toasts.add_child(p)
	while toasts.get_child_count() > 3:
		toasts.get_child(0).queue_free()
	p.modulate.a = 0
	var tw := p.create_tween()
	tw.tween_property(p, "modulate:a", 1.0, 0.2)
	tw.tween_interval(sec)
	tw.tween_property(p, "modulate:a", 0.0, 0.3)
	tw.tween_callback(p.queue_free)


## băng rôn giữa màn hình (await)
func banner(title: String, sub: String, color: Color, dur_ms: int) -> void:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", UiKit.box(color, 26, Color.WHITE, 4, 24, Vector4(40, 18, 40, 20)))
	var v := UiKit.vbox(4)
	var t := UiKit.label(title, 40, Color.WHITE, "Black")
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.add_theme_color_override("font_outline_color", color.darkened(0.35))
	t.add_theme_constant_override("outline_size", 8)
	v.add_child(t)
	var s := UiKit.label(sub, 18, Color(1, 1, 1, 0.95), "Bold")
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	s.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	s.custom_minimum_size.x = 420
	v.add_child(s)
	p.add_child(v)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	banner_box.add_child(p)
	await get_tree().process_frame
	var vs := root.get_viewport_rect().size
	p.position = Vector2((vs.x - p.size.x) / 2, vs.y * 0.36 - p.size.y / 2)
	p.pivot_offset = p.size / 2
	p.scale = Vector2(0.4, 0.4)
	p.modulate.a = 0
	var tw := p.create_tween()
	tw.set_parallel(true)
	tw.tween_property(p, "scale", Vector2.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(p, "modulate:a", 1.0, 0.2)
	tw.chain().tween_interval(maxf(0.2, dur_ms / 1000.0 - 0.7))
	tw.chain().tween_property(p, "modulate:a", 0.0, 0.3)
	await tw.finished
	p.queue_free()


func open_modal(content: Control, width := 520) -> void:
	for c in modal.get_children():
		c.queue_free()
	var dim := ColorRect.new()
	dim.color = Color(0.05, 0.02, 0.08, 0.45)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(func(e): if e is InputEventMouseButton and e.pressed: close_modal())
	modal.add_child(dim)
	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	cc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	modal.add_child(cc)
	var p := UiKit.panel(24, 24, Vector4(26, 22, 26, 22))
	p.custom_minimum_size.x = width
	p.add_child(content)
	cc.add_child(p)
	modal.visible = true
	p.pivot_offset = Vector2(width / 2.0, 100)
	p.scale = Vector2(0.92, 0.92)
	p.create_tween().tween_property(p, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func close_modal() -> void:
	modal.visible = false
	for c in modal.get_children():
		c.queue_free()


# ======================= TRANG CHỦ =======================
func show_home() -> void:
	main.set_mode("home")
	if hud:
		hud.queue_free()
		hud = null
	if home:
		home.queue_free()
	home = Control.new()
	home.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(home)
	# nền mờ màu theme phủ nhẹ cảnh 3D để chữ dễ đọc
	var veil := TextureRect.new()
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(UiKit.c("bg1"), 0.92), Color(UiKit.c("bg1"), 0.55), Color(UiKit.c("bg2"), 0.2)])
	g.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0, 0.5)
	gt.fill_to = Vector2(1, 0.5)
	veil.texture = gt
	veil.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	veil.set_anchors_preset(Control.PRESET_FULL_RECT)
	veil.mouse_filter = Control.MOUSE_FILTER_IGNORE
	home.add_child(veil)
	var mc := MarginContainer.new()
	mc.set_anchors_preset(Control.PRESET_FULL_RECT)
	for side in ["left", "right"]:
		mc.add_theme_constant_override("margin_" + side, 90)
	mc.add_theme_constant_override("margin_top", 40)
	mc.add_theme_constant_override("margin_bottom", 40)
	home.add_child(mc)
	var row := UiKit.hbox(60)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	mc.add_child(row)
	row.add_child(_home_left())
	var right := CenterContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_child(_home_right())
	row.add_child(right)
	var cp := UiKit.label("© Trần Thanh Duy", 12, UiKit.c("dim"), "Medium")
	home.add_child(cp)
	_pin(cp, Control.PRESET_BOTTOM_LEFT, Vector2(28, 14))
	var ver := UiKit.label("v" + VERSION, 12, UiKit.c("dim"), "Medium")
	home.add_child(ver)
	_pin(ver, Control.PRESET_BOTTOM_RIGHT, Vector2(28, 14))


func _home_left() -> Control:
	var v := UiKit.vbox(14)
	v.custom_minimum_size.x = 540
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	var logo := UiKit.hbox(14)
	for pth in ["res://assets/icons/die.webp", "res://assets/icons/money.webp"]:
		var tr := TextureRect.new()
		tr.texture = UiKit.tex(pth)
		tr.custom_minimum_size = Vector2(64, 64)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		logo.add_child(tr)
	v.add_child(logo)
	var title := UiKit.label("Cờ Tỷ Phú", 92, UiKit.c("accent"), "Black")
	title.add_theme_color_override("font_shadow_color", Color(UiKit.c("accent"), 0.25))
	title.add_theme_constant_override("shadow_offset_y", 6)
	v.add_child(title)
	var sub := UiKit.label("V I Ệ T   N A M   ·   M U A   Đ Ấ T   ·   X Â Y   N H À", 17, UiKit.c("accent"), "ExtraBold")
	v.add_child(sub)
	var desc := UiKit.label("Đi khắp 3 miền, mua đất, xây nhà, mở lễ hội và trở thành tỷ phú giàu nhất bàn cờ.", 16, UiKit.c("dim"), "Medium")
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(desc)
	var modes := UiKit.hbox(14)
	modes.add_child(_mode_tab("local", "🎲", "Chơi với máy", "Một mình hoặc nhiều người chung máy"))
	modes.add_child(_mode_tab("online", "🌐", "Chơi online", "Mời bạn bè qua link hoặc mã phòng"))
	v.add_child(modes)
	var chips := UiKit.hbox(10)
	var mb := UiKit.button("🎵 Nhạc: " + ("Bật" if settings.music else "Tắt"), "chip", 14)
	mb.pressed.connect(func():
		_toggle_music()
		mb.text = "🎵 Nhạc: " + ("Bật" if settings.music else "Tắt"))
	chips.add_child(mb)
	var rb := UiKit.button("📜 Luật chơi", "chip", 14)
	rb.pressed.connect(open_rules)
	chips.add_child(rb)
	var fb := UiKit.button("⛶ Toàn màn hình", "chip", 14)
	fb.pressed.connect(_toggle_fullscreen)
	chips.add_child(fb)
	v.add_child(chips)
	v.add_child(_picks_panel())
	return v


func _mode_tab(key: String, ico: String, title: String, sub: String) -> Button:
	var b := Button.new()
	b.custom_minimum_size = Vector2(250, 84)
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var on := home_mode == key
	var sb := UiKit.box(UiKit.c("panel"), 18, UiKit.c("accent") if on else UiKit.c("border"), 3 if on else 1, 14 if on else 6)
	b.add_theme_stylebox_override("normal", sb)
	b.add_theme_stylebox_override("hover", UiKit.box(UiKit.c("panel"), 18, UiKit.c("accent"), 3 if on else 1, 12))
	b.add_theme_stylebox_override("pressed", sb)
	var h := UiKit.hbox(12)
	h.set_anchors_preset(Control.PRESET_FULL_RECT)
	h.offset_left = 16
	h.offset_right = -12
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ic := PanelContainer.new()
	ic.add_theme_stylebox_override("panel", UiKit.box(UiKit.c("accent") if on else UiKit.c("panel2"), 14, Color(0, 0, 0, 0), 0, 0, Vector4(8, 6, 8, 6)))
	ic.add_child(UiKit.label(ico, 24))
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(ic)
	var tv := UiKit.vbox(2)
	tv.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	tv.add_child(UiKit.label(title, 17, null, "ExtraBold"))
	var sl := UiKit.label(sub, 12, UiKit.c("dim"), "Medium")
	sl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sl.custom_minimum_size.x = 160
	tv.add_child(sl)
	h.add_child(tv)
	for n in h.find_children("*", "Control", true, false):
		n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(h)
	b.pressed.connect(func():
		home_mode = key
		show_home())
	return b


func _section(text: String, small := "") -> Control:
	var h := UiKit.hbox(10)
	h.add_child(UiKit.label(" ".join(text.split("")), 14, Color(UiKit.c("accent")).lerp(UiKit.c("dim"), 0.4), "ExtraBold"))
	if small != "":
		var s := UiKit.label(small, 12, UiKit.c("dim"), "Medium")
		s.size_flags_vertical = Control.SIZE_SHRINK_END
		h.add_child(s)
	return h


func _picks_panel() -> Control:
	var p := UiKit.panel(20, 10, Vector4(18, 16, 18, 16))
	var v := UiKit.vbox(10)
	p.add_child(v)
	v.add_child(_section("GIAO DIỆN"))
	var tg := GridContainer.new()
	tg.columns = 4
	tg.add_theme_constant_override("h_separation", 10)
	for k in UiKit.THEMES:
		var on: bool = settings.theme == k
		var b := Button.new()
		b.custom_minimum_size = Vector2(112, 76)
		b.focus_mode = Control.FOCUS_NONE
		b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		var pal: Dictionary = UiKit.PALETTE[k]
		var sb := UiKit.box(UiKit.c("panel2"), 14, UiKit.c("accent") if on else UiKit.c("border"), 2 if on else 1, 0, Vector4(6, 6, 6, 6))
		b.add_theme_stylebox_override("normal", sb)
		b.add_theme_stylebox_override("hover", UiKit.box(UiKit.c("panel2"), 14, UiKit.c("accent"), 2, 0, Vector4(6, 6, 6, 6)))
		b.add_theme_stylebox_override("pressed", sb)
		var vv := UiKit.vbox(4)
		vv.set_anchors_preset(Control.PRESET_FULL_RECT)
		vv.offset_left = 8
		vv.offset_right = -8
		vv.offset_top = 8
		vv.offset_bottom = -6
		var sw := PanelContainer.new()
		sw.custom_minimum_size.y = 38
		sw.add_theme_stylebox_override("panel", UiKit.box(Color(pal.bg1) if k != "midnight" else Color(pal.panel), 10, Color(pal.border), 1, 0, Vector4.ZERO))
		var dots := UiKit.label("■ ●", 18, Color(pal.accent), "Black")
		dots.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		dots.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		sw.add_child(dots)
		vv.add_child(sw)
		var nl := UiKit.label(UiKit.THEME_NAMES[k], 12, UiKit.c("text") if on else UiKit.c("dim"), "Bold")
		nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vv.add_child(nl)
		for n in [vv, sw, dots, nl]:
			n.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(vv)
		b.pressed.connect(func(): apply_theme(k))
		tg.add_child(b)
	v.add_child(tg)
	v.add_child(_section("XÚC XẮC CỦA BẠN"))
	var dg := GridContainer.new()
	dg.columns = 6
	dg.add_theme_constant_override("h_separation", 8)
	dg.add_theme_constant_override("v_separation", 8)
	for k in Pieces.DICE_KEYS:
		var on: bool = settings.dice == k
		var b := Button.new()
		b.custom_minimum_size = Vector2(76, 70)
		b.focus_mode = Control.FOCUS_NONE
		b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		b.tooltip_text = Pieces.DICE_NAMES[k]
		var sb := UiKit.box(UiKit.c("panel"), 12, UiKit.c("accent") if on else UiKit.c("border"), 2 if on else 1, 0, Vector4(4, 4, 4, 4))
		b.add_theme_stylebox_override("normal", sb)
		b.add_theme_stylebox_override("hover", UiKit.box(UiKit.c("panel"), 12, UiKit.c("accent"), 2, 0, Vector4(4, 4, 4, 4)))
		b.add_theme_stylebox_override("pressed", sb)
		var vv := UiKit.vbox(0)
		vv.set_anchors_preset(Control.PRESET_FULL_RECT)
		vv.offset_top = 4
		var tr := TextureRect.new()
		tr.texture = UiKit.tex("res://assets/ui/dice/%s.webp" % k)
		tr.custom_minimum_size = Vector2(0, 40)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		vv.add_child(tr)
		var nl := UiKit.label(Pieces.DICE_NAMES[k], 11, UiKit.c("text") if on else UiKit.c("dim"), "Bold")
		nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vv.add_child(nl)
		for n in [vv, tr, nl]:
			n.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(vv)
		b.pressed.connect(func():
			settings.dice = k
			save_settings()
			main.pieces.set_dice_skin(k)
			show_home())
		dg.add_child(b)
	v.add_child(dg)
	return p


func _home_right() -> Control:
	var p := UiKit.panel(26, 24, Vector4(26, 24, 26, 24))
	p.custom_minimum_size.x = 560
	var v := UiKit.vbox(14)
	p.add_child(v)
	if home_mode == "online":
		_online_form(v)
		return p
	if update_ver != "":
		var ub := UiKit.button("⬆ Có bản mới v%s — Cập nhật ngay" % update_ver, "green", 16)
		ub.pressed.connect(func():
			toast("Đang tải bản cập nhật…")
			updater.install())
		v.add_child(ub)
	var saved = _saved_game()
	if saved:
		var rb := UiKit.button("▶ Chơi tiếp ván đã lưu (vòng %d)" % int(saved.round), "ghost", 16)
		rb.pressed.connect(resume_local)
		v.add_child(rb)
	v.add_child(_section("NGƯỜI CHƠI", "Bấm vào nhân vật để đổi"))
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 14)
	grid.add_theme_constant_override("v_separation", 14)
	var setup: Array = settings.setup
	for i in setup.size():
		grid.add_child(_player_card(i))
	if setup.size() < 4:
		var add := UiKit.button("+ Thêm người chơi", "ghost", 15)
		add.custom_minimum_size = Vector2(246, 140)
		add.pressed.connect(func():
			var used := setup.map(func(q): return int(q.char))
			var ch := 0
			while ch in used:
				ch += 1
			setup.append({"name": "Máy %d" % setup.size(), "bot": true, "char": ch})
			save_settings()
			show_home())
		grid.add_child(add)
	v.add_child(grid)
	v.add_child(_section("⏱ THỜI GIAN VÁN"))
	var seg := UiKit.hbox(10)
	for m in Rules.TIME_OPTS:
		var b := UiKit.button("%d phút" % m, "primary" if int(settings.time) == m else "normal", 16)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(func():
			settings.time = m
			save_settings()
			show_home())
		seg.add_child(b)
	v.add_child(seg)
	var start := UiKit.button("BẮT ĐẦU CHƠI", "primary", 22)
	start.custom_minimum_size.y = 60
	start.pressed.connect(func():
		var ps := []
		for q in settings.setup:
			ps.append({"name": q.name, "bot": q.bot, "char": q.char})
		start_local(ps, int(settings.time)))
	v.add_child(start)
	return p


func _player_card(i: int) -> Control:
	var setup: Array = settings.setup
	var q: Dictionary = setup[i]
	var col := Color(Data.PLAYER_COLORS[i])
	var p := PanelContainer.new()
	p.custom_minimum_size = Vector2(246, 140)
	p.add_theme_stylebox_override("panel", UiKit.box(UiKit.c("panel2"), 18, UiKit.c("border"), 1, 0, Vector4(12, 12, 12, 12)))
	var h := UiKit.hbox(10)
	p.add_child(h)
	var av := Button.new()
	av.custom_minimum_size = Vector2(96, 96)
	av.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	av.focus_mode = Control.FOCUS_NONE
	av.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var sb := UiKit.box(col.lerp(UiKit.c("panel"), 0.7), 18, col, 3, 0, Vector4.ZERO)
	av.add_theme_stylebox_override("normal", sb)
	av.add_theme_stylebox_override("hover", UiKit.box(col.lerp(UiKit.c("panel"), 0.55), 18, col, 3, 6, Vector4.ZERO))
	av.add_theme_stylebox_override("pressed", sb)
	av.icon = UiKit.portrait(int(q.char))
	av.expand_icon = true
	av.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
	av.tooltip_text = "Đổi nhân vật"
	av.pressed.connect(func(): open_char_picker(i))
	h.add_child(av)
	var v := UiKit.vbox(6)
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var top := UiKit.hbox(4)
	var tag := UiKit.label("P%d · %s" % [i + 1, CHAR_NAMES[posmod(int(q.char), 12)]], 12, col, "ExtraBold")
	tag.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(tag)
	if setup.size() > 2:
		var x := UiKit.button("✕", "chip", 11)
		x.add_theme_stylebox_override("normal", StyleBoxEmpty.new())
		x.pressed.connect(func():
			setup.remove_at(i)
			save_settings()
			show_home())
		top.add_child(x)
	v.add_child(top)
	var le := LineEdit.new()
	le.text = q.name
	le.max_length = 16
	le.add_theme_font_override("font", UiKit.font("ExtraBold"))
	le.add_theme_font_size_override("font_size", 17)
	le.add_theme_color_override("font_color", UiKit.c("text"))
	le.add_theme_stylebox_override("normal", UiKit.box(UiKit.c("panel"), 10, UiKit.c("border"), 1, 0, Vector4(10, 6, 10, 6)))
	le.add_theme_stylebox_override("focus", UiKit.box(UiKit.c("panel"), 10, UiKit.c("accent"), 2, 0, Vector4(10, 6, 10, 6)))
	le.text_changed.connect(func(t):
		q.name = t
		save_settings())
	v.add_child(le)
	var seg := UiKit.hbox(6)
	for bot in [false, true]:
		var b := UiKit.button("😊 Người" if not bot else "🤖 Máy", "primary" if q.bot == bot else "normal", 13)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(func():
			q.bot = bot
			save_settings()
			show_home())
		seg.add_child(b)
	v.add_child(seg)
	h.add_child(v)
	return p


func open_char_picker(i: int) -> void:
	var setup: Array = settings.setup
	var v := UiKit.vbox(14)
	v.add_child(UiKit.label("Chọn nhân vật cho P%d" % (i + 1), 22, null, "Black"))
	var g := GridContainer.new()
	g.columns = 4
	g.add_theme_constant_override("h_separation", 12)
	g.add_theme_constant_override("v_separation", 12)
	var taken := []
	for k in setup.size():
		if k != i:
			taken.append(int(setup[k].char))
	for k in 12:
		var b := Button.new()
		b.custom_minimum_size = Vector2(130, 150)
		b.focus_mode = Control.FOCUS_NONE
		b.disabled = k in taken
		var on: bool = int(setup[i].char) == k
		b.add_theme_stylebox_override("normal", UiKit.box(UiKit.c("panel2"), 16, UiKit.c("accent") if on else UiKit.c("border"), 3 if on else 1, 0, Vector4(6, 6, 6, 6)))
		b.add_theme_stylebox_override("hover", UiKit.box(UiKit.c("panel2"), 16, UiKit.c("accent"), 2, 6, Vector4(6, 6, 6, 6)))
		b.add_theme_stylebox_override("disabled", UiKit.box(UiKit.c("panel2"), 16, UiKit.c("border"), 1, 0, Vector4(6, 6, 6, 6)))
		b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
		var vv := UiKit.vbox(2)
		vv.set_anchors_preset(Control.PRESET_FULL_RECT)
		vv.offset_top = 6
		var tr := TextureRect.new()
		tr.texture = UiKit.portrait(k)
		tr.custom_minimum_size.y = 110
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		if b.disabled:
			tr.modulate.a = 0.35
		vv.add_child(tr)
		var nl := UiKit.label(CHAR_NAMES[k] + (" · đã chọn" if b.disabled else ""), 13, UiKit.c("dim") if b.disabled else UiKit.c("text"), "ExtraBold")
		nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		vv.add_child(nl)
		for n in [vv, tr, nl]:
			n.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(vv)
		b.pressed.connect(func():
			setup[i].char = k
			save_settings()
			close_modal()
			show_home())
		g.add_child(b)
	v.add_child(g)
	open_modal(v, 620)


func _online_form(v: VBoxContainer) -> void:
	v.add_child(_section("CHƠI ONLINE", "Chơi chung với bạn trên web hoặc app"))
	var le := LineEdit.new()
	le.placeholder_text = "Tên của bạn"
	le.text = settings.get("name", "")
	le.max_length = 16
	le.add_theme_font_size_override("font_size", 18)
	le.add_theme_font_override("font", UiKit.font("ExtraBold"))
	le.add_theme_stylebox_override("normal", UiKit.box(UiKit.c("panel2"), 12, UiKit.c("border"), 1, 0, Vector4(12, 10, 12, 10)))
	le.add_theme_stylebox_override("focus", UiKit.box(UiKit.c("panel2"), 12, UiKit.c("accent"), 2, 0, Vector4(12, 10, 12, 10)))
	le.add_theme_color_override("font_color", UiKit.c("text"))
	le.text_changed.connect(func(t):
		settings.name = t
		save_settings())
	v.add_child(le)
	var host := UiKit.button("🏠 Tạo phòng mới", "primary", 18)
	host.custom_minimum_size.y = 54
	host.pressed.connect(func(): _start_online_host())
	v.add_child(host)
	v.add_child(_section("HOẶC VÀO PHÒNG BẠN BÈ"))
	var h := UiKit.hbox(10)
	var code := LineEdit.new()
	code.placeholder_text = "Mã phòng (4 ký tự)"
	code.max_length = 4
	code.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	code.add_theme_font_size_override("font_size", 20)
	code.add_theme_font_override("font", UiKit.font("Black"))
	code.add_theme_stylebox_override("normal", UiKit.box(UiKit.c("panel2"), 12, UiKit.c("border"), 1, 0, Vector4(12, 10, 12, 10)))
	code.add_theme_color_override("font_color", UiKit.c("text"))
	h.add_child(code)
	var join := UiKit.button("Vào phòng", "green", 17)
	join.pressed.connect(func(): _start_online_join(code.text.strip_edges().to_upper()))
	h.add_child(join)
	v.add_child(h)
	var note := UiKit.label("Bạn bè trên web vào link duydev1205.github.io/Monopoly rồi nhập mã phòng là chơi chung được.", 13, UiKit.c("dim"), "Medium")
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(note)


func _start_online_host() -> void:
	if net:
		net.close()
	Net.host(self, str(settings.get("name", "")))


func _start_online_join(code: String) -> void:
	if code.length() != 4:
		toast("Nhập mã phòng 4 ký tự")
		return
	if net:
		net.close()
	Net.join(self, code, str(settings.get("name", "")))
	toast("Đang vào phòng %s…" % code)


func apply_theme(k: String) -> void:
	settings.theme = k
	save_settings()
	UiKit.set_theme(k)
	main.set_theme(k)
	if hud and hud.visible:
		_build_hud()
		render()
	else:
		show_home()


func _toggle_music() -> void:
	settings.music = not settings.music
	save_settings()
	audio.set_music(settings.music)
	if music_btn:
		music_btn.modulate.a = 1.0 if settings.music else 0.45


func _toggle_fullscreen() -> void:
	var w := get_window()
	w.mode = Window.MODE_WINDOWED if w.mode == Window.MODE_FULLSCREEN or w.mode == Window.MODE_EXCLUSIVE_FULLSCREEN else Window.MODE_FULLSCREEN
	settings.fullscreen = w.mode == Window.MODE_FULLSCREEN
	save_settings()


func open_rules() -> void:
	var v := UiKit.vbox(10)
	v.add_child(UiKit.label("📜 Luật chơi", 26, null, "Black"))
	var cols := UiKit.hbox(24)
	var left := UiKit.rich("""[b]Mục tiêu[/b]
Trở thành người duy nhất còn trụ lại, hoặc thắng sớm khi:
• Độc quyền [b]3 vùng màu[/b]
• Độc chiếm [b]một cạnh[/b] bàn cờ
• Sở hữu cả [b]4 khu du lịch[/b]
• Hết giờ: người giàu nhất thắng

[b]Mỗi lượt[/b]
Gieo 2 xúc xắc rồi đi. Gieo đôi được gieo tiếp, đôi 3 lần liền thì ra Đảo Hoang.
Qua [b]Xuất Phát[/b] nhận 200tr; dừng đúng ô còn được thưởng thêm.""", 15)
	left.custom_minimum_size.x = 330
	var right := UiKit.rich("""[b]Đất & nhà[/b]
Mua đất trống, xây nhà cấp 1–3, sau vòng đầu lên được Khách sạn. Đối thủ dừng ở đất của bạn phải trả tiền thuê; có thể mua lại đất của bạn với giá gấp đôi (trừ Khách sạn).
Gom đủ một vùng: tiền thuê cả vùng +50%.

[b]Ô đặc biệt[/b]
• [b]Lễ Hội[/b]: chọn đất của bạn, thuê ×2, mở lại cùng chỗ tăng tới ×5
• [b]Sân Bay[/b]: lượt sau bay tới ô bất kỳ
• [b]Cơ Hội[/b]: rút thẻ may rủi
• [b]Đảo Hoang[/b]: kẹt 3 lượt, gieo đôi hoặc trả 100tr để đi
• [b]Thuế[/b]: 10% tài sản""", 15)
	right.custom_minimum_size.x = 330
	cols.add_child(left)
	cols.add_child(right)
	v.add_child(cols)
	var ok := UiKit.button("Đã hiểu", "primary", 17)
	ok.pressed.connect(close_modal)
	v.add_child(ok)
	open_modal(v, 760)


# ======================= GIAO DIỆN TRONG VÁN =======================
## neo control vào một góc / cạnh màn hình với lề (tính lại sau khi nội dung đổi kích thước)
func _pin(c: Control, preset: int, margin := Vector2(20, 16)) -> void:
	c.reset_size()
	var sz := c.get_combined_minimum_size()
	c.set_anchors_preset(preset)
	var right := preset in [Control.PRESET_TOP_RIGHT, Control.PRESET_BOTTOM_RIGHT, Control.PRESET_CENTER_RIGHT]
	var bottom := preset in [Control.PRESET_BOTTOM_LEFT, Control.PRESET_BOTTOM_RIGHT, Control.PRESET_CENTER_BOTTOM]
	var hcenter := preset in [Control.PRESET_CENTER_TOP, Control.PRESET_CENTER_BOTTOM, Control.PRESET_CENTER]
	if hcenter:
		c.offset_left = -sz.x / 2
		c.offset_right = sz.x / 2
	elif right:
		c.offset_left = -margin.x - sz.x
		c.offset_right = -margin.x
	else:
		c.offset_left = margin.x
		c.offset_right = margin.x + sz.x
	if preset in [Control.PRESET_CENTER_RIGHT, Control.PRESET_CENTER_LEFT, Control.PRESET_CENTER]:
		c.offset_top = -sz.y / 2
		c.offset_bottom = sz.y / 2
	elif bottom:
		c.offset_top = -margin.y - sz.y
		c.offset_bottom = -margin.y
	else:
		c.offset_top = margin.y
		c.offset_bottom = margin.y + sz.y


func _build_hud() -> void:
	if hud:
		hud.queue_free()
	hud = Control.new()
	hud.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(hud)
	# thanh trên: trái
	var tl := UiKit.hbox(12)
	var menu := UiKit.icon_button(UiKit.svg_icon(UiKit.ICON_MENU), "Menu")
	menu.pressed.connect(open_menu)
	tl.add_child(menu)
	var logo := TextureRect.new()
	logo.texture = UiKit.tex("res://assets/icons/die.webp")
	logo.custom_minimum_size = Vector2(40, 40)
	logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	tl.add_child(logo)
	var tt := UiKit.hbox(6)
	tt.add_child(UiKit.label("Cờ Tỷ Phú", 20, null, "Black"))
	tt.add_child(UiKit.label("Việt Nam", 20, UiKit.c("accent"), "Black"))
	tt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	tl.add_child(tt)
	hud.add_child(tl)
	_pin(tl, Control.PRESET_TOP_LEFT)
	# thanh trên: phải
	var tr := UiKit.hbox(10)
	var clock := PanelContainer.new()
	clock.add_theme_stylebox_override("panel", UiKit.box(UiKit.c("panel"), 14, UiKit.c("border"), 1, 6, Vector4(14, 8, 14, 8)))
	clock_lbl = UiKit.label("⏱ 60:00", 18, null, "ExtraBold")
	clock.add_child(clock_lbl)
	tr.add_child(clock)
	music_btn = UiKit.icon_button(UiKit.svg_icon(UiKit.ICON_MUSIC), "Nhạc nền")
	music_btn.modulate.a = 1.0 if settings.music else 0.45
	music_btn.pressed.connect(_toggle_music)
	music_btn.gui_input.connect(func(e): if e is InputEventMouseButton and e.pressed and e.button_index == MOUSE_BUTTON_RIGHT: audio.next_track())
	tr.add_child(music_btn)
	sound_btn = UiKit.icon_button(UiKit.svg_icon(UiKit.ICON_SOUND if settings.sound else UiKit.ICON_MUTE), "Âm thanh")
	sound_btn.pressed.connect(func():
		settings.sound = not settings.sound
		audio.sound_on = settings.sound
		save_settings()
		sound_btn.icon = UiKit.svg_icon(UiKit.ICON_SOUND if settings.sound else UiKit.ICON_MUTE))
	tr.add_child(sound_btn)
	cam_btn = UiKit.icon_button(UiKit.svg_icon(UiKit.ICON_CAM), "Camera bám nhân vật")
	cam_btn.modulate.a = 1.0 if settings.follow else 0.45
	cam_btn.pressed.connect(func():
		settings.follow = not settings.follow
		main.follow_on = settings.follow
		save_settings()
		cam_btn.modulate.a = 1.0 if settings.follow else 0.45
		toast("Camera bám nhân vật: " + ("bật" if settings.follow else "tắt")))
	tr.add_child(cam_btn)
	var fs := UiKit.icon_button(UiKit.svg_icon(UiKit.ICON_FULL), "Toàn màn hình (F11)")
	fs.pressed.connect(_toggle_fullscreen)
	tr.add_child(fs)
	hud.add_child(tr)
	_pin(tr, Control.PRESET_TOP_RIGHT)
	# lượt của ai
	turn_pill = PanelContainer.new()
	hud.add_child(turn_pill)
	# 4 thẻ người chơi ở 4 góc
	cards.clear()
	for i in 4:
		var c := PanelContainer.new()
		c.custom_minimum_size = Vector2(300, 0)
		c.visible = false
		hud.add_child(c)
		cards.append(c)
	# dòng tin nhanh
	ticker = UiKit.label("", 14, UiKit.c("text"), "Bold")
	ticker.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	ticker.offset_top = -44
	ticker.offset_bottom = -20
	ticker.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	ticker.add_theme_color_override("font_outline_color", UiKit.c("panel"))
	ticker.add_theme_constant_override("outline_size", 6)
	hud.add_child(ticker)
	# bảng hành động giữa màn hình
	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	cc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(cc)
	actions_box = UiKit.vbox(10)
	actions_box.custom_minimum_size.x = 440
	cc.add_child(actions_box)
	side_box = Control.new()
	side_box.set_anchors_preset(Control.PRESET_FULL_RECT)
	side_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(side_box)


func open_menu() -> void:
	var v := UiKit.vbox(12)
	v.add_child(UiKit.label("☰ Menu", 24, null, "Black"))
	var b1 := UiKit.button("▶ Chơi tiếp", "normal", 17)
	b1.pressed.connect(close_modal)
	v.add_child(b1)
	var nx: String = UiKit.THEMES[(UiKit.THEMES.find(settings.theme) + 1) % 4]
	var b2 := UiKit.button("🎨 Đổi giao diện (sang %s)" % UiKit.THEME_NAMES[nx], "normal", 17)
	b2.pressed.connect(func():
		close_modal()
		apply_theme(nx))
	v.add_child(b2)
	var qn := ["Thấp", "Vừa", "Cao"]
	var nq := (int(settings.get("quality", 2)) + 2) % 3
	var bq := UiKit.button("🖥 Đồ hoạ: %s (đổi sang %s)" % [qn[int(settings.get("quality", 2))], qn[nq]], "normal", 17)
	bq.pressed.connect(func():
		settings.quality = nq
		save_settings()
		main.apply_quality(nq)
		close_modal()
		toast("Đồ hoạ: " + qn[nq]))
	v.add_child(bq)
	var b5 := UiKit.button("📜 Luật chơi", "normal", 17)
	b5.pressed.connect(open_rules)
	v.add_child(b5)
	if mode == "local":
		var b3 := UiKit.button("🔁 Ván mới (cùng người chơi)", "normal", 17)
		b3.pressed.connect(func():
			close_modal()
			var ps := []
			for p in auth.players:
				ps.append({"name": p.name, "bot": p.bot, "char": p.char})
			start_local(ps, int(auth.timeLimit)))
		v.add_child(b3)
		var b4 := UiKit.button("💾 Lưu và về trang chủ", "primary", 17)
		b4.pressed.connect(func():
			close_modal()
			go_home())
		v.add_child(b4)
	else:
		var b4 := UiKit.button("🚪 Rời phòng", "primary", 17)
		b4.pressed.connect(func():
			close_modal()
			go_home())
		v.add_child(b4)
	open_modal(v, 420)


func go_home() -> void:
	bot_gen += 1
	if net:
		net.close()
		net = null
	mode = ""
	S = null
	auth = null
	queue.clear()
	busy = false
	main.pieces.set_target(-1)
	main.board.set_picks(null)
	show_home()


# ======================= điều khiển ván (chơi trên máy) =======================
func start_local(players: Array, time_limit: int) -> void:
	fest_intro = true
	mode = "local"
	auth = Rules.new_game(players, time_limit)
	last_tick = Time.get_ticks_msec()
	_save_game()
	enter_game(auth.duplicate(true))
	_schedule(300)


func resume_local() -> void:
	var s = _saved_game()
	if s == null:
		return
	mode = "local"
	auth = s
	last_tick = Time.get_ticks_msec()
	enter_game(auth.duplicate(true))
	_schedule(300)


func _local_send(a: Dictionary) -> void:
	var now := Time.get_ticks_msec()
	Rules.tick(auth, now - last_tick)
	last_tick = now
	var r := Rules.apply(auth, int(auth.cur), a)
	if not r.ok:
		toast(r.error)
		render()
		return
	_save_game()
	push_update(auth.duplicate(true), r.events)
	_schedule(Rules.anim_time(r.events))


func _schedule(ms: int) -> void:
	bot_gen += 1
	var gen := bot_gen
	if auth == null or auth.phase == "over" or not auth.players[int(auth.cur)].bot:
		return
	await get_tree().create_timer((ms + Rules.BOT_THINK) / 1000.0).timeout
	if gen != bot_gen or auth == null or mode != "local":
		return
	var a = Bot.action(auth, int(auth.cur))
	if a != null:
		_local_send(a)


func is_mine_raw() -> bool:
	if S == null:
		return false
	return not S.players[int(S.cur)].bot if mode == "local" else int(S.cur) == my_seat


func is_mine() -> bool:
	return is_mine_raw() and not busy


func act(a: Dictionary) -> void:
	if not is_mine():
		return
	for c in actions_box.get_children():
		c.queue_free()
	if mode == "local":
		_local_send(a)
	elif net:
		net.send({"t": "act", "action": a})


## tự hạ chất lượng nếu máy chạy chậm (một lần cho mỗi mức)
func _auto_quality() -> void:
	await get_tree().create_timer(6.0).timeout
	var sum := 0.0
	for k in 8:
		await get_tree().create_timer(1.0).timeout
		sum += Engine.get_frames_per_second()
	if sum / 8 < 40 and main.quality > 0 and hud:
		settings.quality = main.quality - 1
		save_settings()
		main.apply_quality(settings.quality)
		toast("Máy hơi chậm — đã giảm đồ hoạ xuống mức %s (đổi lại trong Menu)" % ["Thấp", "Vừa", "Cao"][settings.quality], 4.0)


func enter_game(state: Dictionary) -> void:
	if not main.args.has("shot") and not main.args.has("shots"):
		_auto_quality()
	S = state
	win_shown = state.phase == "over"
	queue.clear()
	busy = false
	if home:
		home.queue_free()
		home = null
	_build_hud()
	main.set_mode("game")
	view.pos = []
	view.money = []
	for p in S.players:
		view.pos.append(int(p.pos))
		view.money.append(int(p.money))
	var tk := []
	for i in S.players.size():
		var p: Dictionary = S.players[i]
		tk.append({"char": int(p.get("char", i)), "color": p.color, "mine": (i == my_seat) if mode == "online" else not p.bot})
	main.pieces.set_tokens(tk)
	main.pieces.show_dice(S.dice)
	for i in 32:
		render_tile(i, S)
	main.pieces.set_fest_gates(S.get("randFests", []), false)
	layout_tokens()
	render()
	if (fest_intro or (int(S.seq) == 0 and S.get("randFests", []).size())) and S.phase != "over":
		fest_intro = false
		await get_tree().create_timer(0.5).timeout
		var names := []
		for k in S.randFests:
			names.append(Data.BOARD[k].name)
		banner("🎊 FESTIVAL", "%s — thuê +50%% cả ván" % " · ".join(names), Color("#1f9d55"), 2200)


# ======================= vẽ trạng thái =======================
func render_tile(i: int, s: Dictionary) -> void:
	var o = s.own[i]
	if o == null:
		return
	var t: Dictionary = Data.BOARD[i]
	var owned: bool = int(o.o) >= 0
	var oc = s.players[int(o.o)].color if owned else null
	var mono: bool = owned and t.type == "city" and Rules.owns_group(s, int(o.o), t.group)
	main.board.update_tile(i, {"owned": oc, "price": Data.fmt(Rules.rent_of(s, i)) if owned else Data.fmt(t.price),
		"mono": mono, "fest": int(s.festival) == i, "rfest": Rules.is_rand_fest(s, i)})
	main.pieces.set_building(i, {"owner": int(o.o), "color": oc, "lvl": int(o.lvl) if t.type == "city" else 0, "style": int(o.o) * 7 + i,
		"type": t.type, "festMult": int(s.get("festMult", 2)) if int(s.festival) == i else 0} if owned else null)


func layout_tokens(anim := {}) -> void:
	if S == null:
		return
	var groups := {}
	for i in S.players.size():
		if not S.players[i].out:
			var k: int = view.pos[i]
			if not groups.has(k):
				groups[k] = []
			groups[k].append(i)
	for i in S.players.size():
		var g: Array = groups.get(view.pos[i], [i])
		main.pieces.place_token(i, {"tile": view.pos[i], "k": maxi(0, g.find(i)), "n": g.size(), "out": S.players[i].out}, anim if anim.get("pid", -1) == i else {})


func render() -> void:
	if S == null or hud == null:
		return
	for i in S.players.size():
		view.pos[i] = int(S.players[i].pos)
		view.money[i] = int(S.players[i].money)
	render_players()
	layout_tokens()
	main.pieces.set_current(int(S.cur) if S.phase != "over" else -1)
	render_clock()
	render_actions()
	if S.phase == "over" and not win_shown:
		show_win()


func render_clock() -> void:
	if clock_lbl == null or S == null:
		return
	var left := Rules.time_left(S)
	if mode == "local" and auth and S.phase != "over":
		left -= Time.get_ticks_msec() - last_tick
	left = maxf(0, left)
	var sec := int(left / 1000)
	clock_lbl.text = "⏱ %02d:%02d" % [sec / 60, sec % 60]


func _process(_dt: float) -> void:
	if S and hud and Engine.get_process_frames() % 15 == 0:
		render_clock()


func render_players() -> void:
	for i in 4:
		var c: PanelContainer = cards[i]
		if i >= S.players.size():
			c.visible = false
			continue
		c.visible = true
		for ch in c.get_children():
			ch.queue_free()
		var p: Dictionary = S.players[i]
		var col := Color(p.color)
		var cur: bool = i == int(S.cur) and S.phase != "over"
		c.add_theme_stylebox_override("panel", UiKit.box(UiKit.c("panel"), 20, col if cur else UiKit.c("border"), 3 if cur else 1, 14 if cur else 8, Vector4(14, 12, 18, 12)))
		c.modulate.a = 0.55 if p.out else 1.0
		var h := UiKit.hbox(12)
		h.add_child(UiKit.avatar(int(p.get("char", i)), col, 64))
		var v := UiKit.vbox(0)
		var nm := UiKit.hbox(6)
		nm.add_child(UiKit.label(p.name, 18, null, "ExtraBold"))
		var tag := "máy" if p.bot else ("bạn" if mode == "online" and i == my_seat else "")
		if tag != "":
			var tp := PanelContainer.new()
			tp.add_theme_stylebox_override("panel", UiKit.box(col, 99, Color(0, 0, 0, 0), 0, 0, Vector4(7, 1, 7, 1)))
			tp.add_child(UiKit.label(tag, 11, Color.WHITE, "ExtraBold"))
			tp.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			nm.add_child(tp)
		if cur:
			var tp := PanelContainer.new()
			tp.add_theme_stylebox_override("panel", UiKit.box(UiKit.c("accent"), 99, Color(0, 0, 0, 0), 0, 0, Vector4(8, 1, 8, 1)))
			tp.add_child(UiKit.label("ĐẾN LƯỢT", 10, Color.WHITE, "Black"))
			tp.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			nm.add_child(tp)
		v.add_child(nm)
		var money := UiKit.label("● " + Rules.fmt_full(view.money[i]), 24, Color("#d03030") if view.money[i] < 0 else UiKit.c("money"), "Black")
		money.name = "money"
		v.add_child(money)
		var props := Rules.owned_by(S, i).size()
		var st := []
		st.append("🏠 %d đất" % props if props else "Chưa có đất")
		if int(p.island):
			st.append("🌴 kẹt %d" % int(p.island))
		if p.travel:
			st.append("✈️ bay")
		if int(p.freeCards):
			st.append("🛟×%d" % int(p.freeCards))
		if p.out:
			st.append("💥 phá sản")
		v.add_child(UiKit.label(" · ".join(st), 13, UiKit.c("dim"), "Medium"))
		h.add_child(v)
		c.add_child(h)
		var preset: int = [Control.PRESET_TOP_LEFT, Control.PRESET_TOP_RIGHT, Control.PRESET_BOTTOM_LEFT, Control.PRESET_BOTTOM_RIGHT][i]
		_pin.call_deferred(c, preset, Vector2(20, 16 if i >= 2 else 80))
	# lượt của ai
	for ch in turn_pill.get_children():
		ch.queue_free()
	if S.phase == "over":
		turn_pill.visible = false
		return
	turn_pill.visible = true
	var cp: Dictionary = S.players[int(S.cur)]
	turn_pill.add_theme_stylebox_override("panel", UiKit.box(UiKit.c("panel"), 99, Color(cp.color), 2, 12, Vector4(8, 6, 20, 6)))
	var th := UiKit.hbox(10)
	th.add_child(UiKit.avatar(int(cp.get("char", int(S.cur))), Color(cp.color), 40))
	var humans: int = S.players.filter(func(q): return not q.bot).size()
	var txt: String = ("Lượt của %s" % cp.name if mode == "local" and humans > 1 else "Lượt của bạn") if is_mine_raw() else "Lượt của %s" % cp.name
	var tl := UiKit.label(txt, 20, null, "ExtraBold")
	tl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	th.add_child(tl)
	turn_pill.add_child(th)
	_pin.call_deferred(turn_pill, Control.PRESET_CENTER_TOP, Vector2(0, 14))


func _update_money(pid: int) -> void:
	var c: PanelContainer = cards[pid]
	var m: Label = c.find_child("money", true, false)
	if m:
		m.text = "● " + Rules.fmt_full(view.money[pid])
		m.add_theme_color_override("font_color", Color("#d03030") if view.money[pid] < 0 else UiKit.c("money"))


func _float_money(pid: int, delta: int) -> void:
	var c: PanelContainer = cards[pid]
	var l := UiKit.label(("+" if delta > 0 else "") + Data.fmt(delta), 22, UiKit.c("money") if delta > 0 else Color("#e03b3b"), "Black")
	l.add_theme_color_override("font_outline_color", Color.WHITE)
	l.add_theme_constant_override("outline_size", 6)
	hud.add_child(l)
	l.position = c.global_position + Vector2(c.size.x - 110, c.size.y * 0.3)
	var tw := l.create_tween().set_parallel(true)
	tw.tween_property(l, "position:y", l.position.y - 40, 1.0)
	tw.tween_property(l, "modulate:a", 0.0, 1.0).set_delay(0.4)
	tw.chain().tween_callback(l.queue_free)


func _offer_head(i: int) -> Control:
	var t: Dictionary = Data.BOARD[i]
	var g = Data.GROUPS.get(t.get("group", ""), null)
	var h := UiKit.hbox(10)
	var bar := ColorRect.new()
	bar.color = Color(g.color) if g else Color("#18a0b5")
	bar.custom_minimum_size = Vector2(6, 30)
	h.add_child(bar)
	var ip := Data.icon_path(t)
	if ip != "":
		var tr := TextureRect.new()
		tr.texture = UiKit.tex(ip)
		tr.custom_minimum_size = Vector2(32, 32)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		h.add_child(tr)
	h.add_child(UiKit.label(t.name, 22, null, "ExtraBold"))
	var sl := UiKit.label(g.name if g else "Khu du lịch", 13, UiKit.c("dim"), "Bold")
	sl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(sl)
	return h


func _msg(text: String) -> Control:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", UiKit.box(UiKit.c("panel"), 16, UiKit.c("border"), 1, 10, Vector4(18, 10, 18, 10)))
	var r := UiKit.rich("[center]%s[/center]" % text, 16)
	r.custom_minimum_size.x = 400
	p.add_child(r)
	return p


func _act_btn(text: String, kind: String, a: Dictionary, enabled := true, sub := "") -> Button:
	var b := UiKit.button(text, kind, 17, sub)
	b.disabled = not enabled
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if sub != "":
		b.custom_minimum_size.y = 58
	b.pressed.connect(func():
		audio.sfx("click")
		if a.type == "bankrupt":
			_confirm("Bạn chắc chắn muốn tuyên bố phá sản?", func(): act(a))
		else:
			act(a))
	return b


func _confirm(text: String, yes: Callable) -> void:
	var v := UiKit.vbox(14)
	var l := UiKit.label(text, 18, null, "Bold")
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(l)
	var h := UiKit.hbox(10)
	var ok := UiKit.button("Đồng ý", "primary", 16)
	ok.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ok.pressed.connect(func():
		close_modal()
		yes.call())
	var no := UiKit.button("Thôi", "normal", 16)
	no.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	no.pressed.connect(close_modal)
	h.add_child(ok)
	h.add_child(no)
	v.add_child(h)
	open_modal(v, 420)


func _set_picks(list) -> void:
	picks = list if list != null else []
	main.board.set_picks(list if list != null and list.size() else null)


func render_actions() -> void:
	for c in actions_box.get_children():
		c.queue_free()
	for c in side_box.get_children():
		c.queue_free()
	_set_picks(null)
	main.board.set_chosen([])
	if S.phase != "debt":
		sell_sel.clear()
	if busy or S.phase == "over" or not is_mine():
		return
	main.follow_pid = -1		  # tới lượt mình: camera lùi về toàn cảnh
	var p: Dictionary = S.players[int(S.cur)]
	var pd = S.pending
	var money: int = int(p.money)
	match S.phase:
		"roll":
			if int(p.island):
				actions_box.add_child(_msg("🌴 Bạn đang kẹt ở Đảo Hoang (còn %d lượt)" % int(p.island)))
				var row := UiKit.hbox(10)
				row.add_child(_act_btn("🎲 Gieo tìm đôi", "primary", {"type": "roll"}))
				row.add_child(_act_btn("⛵ Trả %s" % Data.fmt(Data.BAIL), "gold", {"type": "payBail"}, money >= Data.BAIL))
				if int(p.freeCards):
					row.add_child(_act_btn("🛟 Dùng thẻ cứu hộ", "green", {"type": "useCard"}))
				actions_box.add_child(row)
			else:
				if S.rolledDouble:
					actions_box.add_child(_msg("🎲 Gieo đôi! Bạn được gieo tiếp"))
				var b := _act_btn("🎲  Gieo xúc xắc", "primary", {"type": "roll"})
				b.add_theme_font_size_override("font_size", 24)
				b.custom_minimum_size = Vector2(300, 68)
				b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
				actions_box.add_child(b)
				var hint := UiKit.label("hoặc nhấn phím Space", 13, UiKit.c("text"), "Bold")
				hint.add_theme_color_override("font_outline_color", UiKit.c("panel"))
				hint.add_theme_constant_override("outline_size", 6)
				hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				actions_box.add_child(hint)
		"travel":
			actions_box.add_child(_msg("✈️ Chọn ô để bay tới · vé [b]%s[/b]" % ("miễn phí 🎁" if p.get("freeFly", false) else Rules.fmt_full(Data.AIRPORT_FEE))))
			actions_box.add_child(_act_btn("Không bay, gieo xúc xắc", "normal", {"type": "skip"}))
			var l := []
			for i in 32:
				if Rules.can_fly(S, int(S.cur), i):
					l.append(i)
			_set_picks(l)
		"target":
			actions_box.add_child(_msg("🔥 Chọn nhà của đối thủ để [b]đốt[/b] (giảm 1 cấp)" if pd.kind == "burn" else "💥 Chọn nhà của đối thủ để [b]phá[/b]"))
			actions_box.add_child(_act_btn("Bỏ qua", "normal", {"type": "skip"}))
			_set_picks(pd.tiles)
		"buy":
			var i: int = int(pd.tile)
			var t: Dictionary = Data.BOARD[i]
			var box := UiKit.panel(22, 18, Vector4(18, 16, 18, 16))
			var v := UiKit.vbox(10)
			box.add_child(v)
			v.add_child(_offer_head(i))
			if t.type == "resort":
				v.add_child(UiKit.label("Thuê khi có 1 khu: %s · càng nhiều khu càng cao" % Data.fmt(Data.RESORT_RENT[1]), 14, UiKit.c("dim"), "Medium"))
				var row := UiKit.hbox(10)
				row.add_child(_act_btn("Mua %s" % Data.fmt(t.price), "green", {"type": "buy", "lvl": 0}, money >= t.price))
				row.add_child(_act_btn("Bỏ qua", "normal", {"type": "skip"}))
				v.add_child(row)
			else:
				var g := GridContainer.new()
				g.columns = 2
				g.add_theme_constant_override("h_separation", 10)
				g.add_theme_constant_override("v_separation", 10)
				for l in 4:
					var cost: int = t.price + Rules.build_cost(i, 0, l)
					var b := _act_btn(LVL_NAME[l], "gold" if l else "green", {"type": "buy", "lvl": l}, money >= cost, "trả %s · thuê %s" % [Data.fmt(cost), Data.fmt(t.rent[l])])
					b.custom_minimum_size.x = 200
					g.add_child(b)
				v.add_child(g)
				v.add_child(_act_btn("Bỏ qua", "ghost", {"type": "skip"}))
			actions_box.add_child(box)
		"upgrade":
			var i: int = int(pd.tile)
			var t: Dictionary = Data.BOARD[i]
			var o: Dictionary = S.own[i]
			var box := UiKit.panel(22, 18, Vector4(18, 16, 18, 16))
			var v := UiKit.vbox(10)
			box.add_child(v)
			v.add_child(_offer_head(i))
			v.add_child(UiKit.label("Đất của bạn — hiện có %s. Nâng cấp?" % (LVL_NAME[int(o.lvl)].to_lower() if int(o.lvl) else "đất trống"), 14, UiKit.c("dim"), "Medium"))
			var g := GridContainer.new()
			g.columns = 2
			g.add_theme_constant_override("h_separation", 10)
			g.add_theme_constant_override("v_separation", 10)
			for l in range(int(o.lvl) + 1, Rules.max_build_level(S, i) + 1):
				var cost := Rules.build_cost(i, int(o.lvl), l)
				var b := _act_btn(LVL_NAME[l], "primary" if l == 4 else "gold", {"type": "upgrade", "lvl": l}, money >= cost, "trả %s · thuê %s" % [Data.fmt(cost), Data.fmt(t.rent[l])])
				b.custom_minimum_size.x = 200
				g.add_child(b)
			v.add_child(g)
			v.add_child(_act_btn("Để sau", "ghost", {"type": "skip"}))
			actions_box.add_child(box)
		"buyout":
			var i: int = int(pd.tile)
			var owner: Dictionary = S.players[int(S.own[i].o)]
			var cost := Rules.buyout_cost(S, i)
			var box := UiKit.panel(22, 18, Vector4(18, 16, 18, 16))
			var v := UiKit.vbox(10)
			box.add_child(v)
			v.add_child(_offer_head(i))
			v.add_child(UiKit.rich("Mua lại từ [b][color=%s]%s[/color][/b] với giá gấp %d lần giá trị" % [owner.color, owner.name, Data.BUYOUT_RATE], 15))
			var row := UiKit.hbox(10)
			row.add_child(_act_btn("🤝 Mua lại %s" % Data.fmt(cost), "primary", {"type": "buyout"}, money >= cost))
			row.add_child(_act_btn("Thôi", "normal", {"type": "skip"}))
			v.add_child(row)
			actions_box.add_child(box)
		"festival":
			var again: bool = int(S.festival) >= 0 and S.own[int(S.festival)] != null and int(S.own[int(S.festival)].o) == int(S.cur)
			actions_box.add_child(_msg("🎆 Chọn đất để mở Lễ Hội" + (" · chọn lại %s để lên ×%d" % [Data.BOARD[int(S.festival)].name, mini(5, int(S.get("festMult", 2)) + 1)] if again else " · tiền thuê ×2")))
			actions_box.add_child(_act_btn("Bỏ qua", "normal", {"type": "skip"}))
			_set_picks(Rules.owned_by(S, int(S.cur)))
		"debt":
			_render_debt(p)


func _render_debt(p: Dictionary) -> void:
	var mine := Rules.owned_by(S, int(S.cur))
	for k in sell_sel.keys():
		if not (k in mine):
			sell_sel.erase(k)
	var sv := func(k): return int(floor(Rules.tile_value(S, k) * Data.SELL_RATE))
	var need: int = -int(p.money)
	var got := 0
	for k in sell_sel:
		got += sv.call(k)
	var box := UiKit.panel(22, 18, Vector4(18, 16, 18, 16))
	box.custom_minimum_size.x = 380
	var v := UiKit.vbox(8)
	box.add_child(v)
	v.add_child(UiKit.label("💸 Bán đất trả nợ", 20, null, "Black"))
	var sub := UiKit.label("Chọn ô trong danh sách hoặc bấm vào ô trên bàn cờ. Ngân hàng trả %d%% giá trị." % int(Data.SELL_RATE * 100), 13, UiKit.c("dim"), "Medium")
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(sub)
	mine.sort_custom(func(a, b): return sv.call(a) < sv.call(b))
	var sc := ScrollContainer.new()
	sc.custom_minimum_size.y = mini(260, mine.size() * 50)
	var list := UiKit.vbox(6)
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.add_child(list)
	for k in mine:
		var o: Dictionary = S.own[k]
		var t: Dictionary = Data.BOARD[k]
		var lv: String = "Khu du lịch" if t.type == "resort" else (LVL_NAME[int(o.lvl)] if int(o.lvl) else "Đất trống")
		var on: bool = sell_sel.has(k)
		var b := UiKit.button(("☑ " if on else "☐ ") + "%s · %s   %s" % [t.name, lv, Rules.fmt_full(sv.call(k))], "primary" if on else "normal", 14)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.pressed.connect(func(): _toggle_sell(k))
		list.add_child(b)
	v.add_child(sc)
	v.add_child(UiKit.rich("Đang thiếu [b][color=#e03b3b]%s[/color][/b]   ·   Đã chọn [b][color=%s]%s[/color][/b]" % [Rules.fmt_full(need), "#1f9d55" if got >= need else UiKit.c("text").to_html(), Rules.fmt_full(got)], 14))
	var row := UiKit.hbox(10)
	row.add_child(_act_btn("Bán %s ô" % (str(sell_sel.size()) if sell_sel.size() else ""), "primary", {"type": "sellMany", "tiles": sell_sel.keys()}, sell_sel.size() > 0))
	row.add_child(_act_btn("Phá sản", "normal", {"type": "bankrupt"}))
	v.add_child(row)
	side_box.add_child(box)
	_pin.call_deferred(box, Control.PRESET_CENTER_RIGHT, Vector2(30, 0))
	_set_picks(mine)
	main.board.set_chosen(sell_sel.keys())


func _toggle_sell(k: int) -> void:
	if sell_sel.has(k):
		sell_sel.erase(k)
	else:
		sell_sel[k] = true
	render_actions()


func _on_tile_click(i: int) -> void:
	if S == null:
		return
	if i in picks and is_mine():
		if S.phase == "debt":
			_toggle_sell(i)
			return
		var type: String = {"travel": "travel", "festival": "festival", "target": "target"}.get(S.phase, "")
		if type != "":
			act({"type": type, "tile": i})
			return
	show_tile_info(i)


func show_tile_info(i: int) -> void:
	var t: Dictionary = Data.BOARD[i]
	var o = S.own[i] if S else null
	var v := UiKit.vbox(10)
	v.add_child(_offer_head(i))
	if t.type == "city":
		var rows := "[b]Giá đất[/b]: %s\n" % Data.fmt(t.price)
		for l in 5:
			var now: bool = o != null and int(o.o) >= 0 and int(o.lvl) == l
			rows += ("[color=%s]" % UiKit.c("accent").to_html() if now else "") + "Thuê %s: [b]%s[/b]" % ["đất trống" if l == 0 else LVL_NAME[l].to_lower(), Data.fmt(t.rent[l])] + ("  ◀[/color]" if now else "") + "\n"
		rows += "Xây mỗi nhà: %s · Khách sạn: %s" % [Data.fmt(Data.level_cost(t, 1)), Data.fmt(Data.level_cost(t, 4))]
		v.add_child(UiKit.rich(rows, 15))
	elif t.type == "resort":
		v.add_child(UiKit.rich("[b]Giá[/b]: %s\nThuê theo số khu sở hữu: 1 khu %s · 2 khu %s · 3 khu %s · 4 khu %s" % [Data.fmt(t.price), Data.fmt(Data.RESORT_RENT[1]), Data.fmt(Data.RESORT_RENT[2]), Data.fmt(Data.RESORT_RENT[3]), Data.fmt(Data.RESORT_RENT[4])], 15))
	else:
		v.add_child(UiKit.label(Data.tile_sub(t), 15, UiKit.c("dim"), "Bold"))
	if o != null and int(o.o) >= 0 and S:
		var ow: Dictionary = S.players[int(o.o)]
		v.add_child(UiKit.rich("Chủ: [b][color=%s]%s[/color][/b] · thuê hiện tại [b]%s[/b]" % [ow.color, ow.name, Data.fmt(Rules.rent_of(S, i))], 15))
	var ok := UiKit.button("Đóng", "normal", 16)
	ok.pressed.connect(close_modal)
	v.add_child(ok)
	open_modal(v, 440)


# ======================= phát animation theo sự kiện =======================
func push_update(state: Dictionary, events: Array) -> void:
	queue.append({"state": state, "events": events})
	if not busy:
		_pump()


func _pump() -> void:
	busy = true
	render_actions()
	while queue.size():
		var u: Dictionary = queue.pop_front()
		await _play(u.events, u.state)
		S = u.state
		if hud == null:
			busy = false
			return
	busy = false
	render()


func _sleep(ms: float) -> void:
	await get_tree().create_timer(ms / 1000.0).timeout


func _emo(e: Dictionary) -> void:
	match e.t:
		"buy", "upgrade":
			main.pieces.emote(e.pid, "victory")
		"rent":
			main.pieces.emote(e.from, "shock")
		"mono", "win":
			main.pieces.emote(e.pid, "victory")
		"bankrupt":
			main.pieces.emote(e.pid, "out")


func _play(events: Array, fin: Dictionary) -> void:
	var fast := queue.size() > 1
	for e in events:
		if hud == null:
			return
		if not fast:
			_emo(e)
		match e.t:
			"dice":
				main.pieces.cur_pid = int(e.pid)
				if fast:
					main.pieces.show_dice(e.d)
				else:
					audio.sfx("dice")
					for k in 6:
						get_tree().create_timer(k * 0.12).timeout.connect(audio.sfx.bind("dice"))
					await main.pieces.roll_dice(e.d, Rules.ANIM.dice / 1000.0)
			"move":
				var path: Array = e.path
				if path.is_empty():
					continue
				if not fast:
					main.pieces.set_target(path[-1], str(path.size()))
					main.board.set_target(path[-1])
					audio.sfx("turn")
					await _sleep(Rules.ANIM.target)
				main.follow(int(e.pid))
				for p in path:
					view.pos[e.pid] = p
					layout_tokens({"pid": e.pid, "dur": 0.0 if fast else Rules.ANIM.step * 0.95, "arc": 0.32})
					if not fast:
						main.board.step_flash(p)
						audio.sfx("step")
						await _sleep(Rules.ANIM.step)
				main.pieces.set_target(-1)
				main.board.set_target(-1)
				if not fast:
					await _sleep(80)
			"fly":
				if not fast:
					main.pieces.set_target(e.to, "✈")
					main.board.set_target(e.to)
					await _sleep(Rules.ANIM.target)
				main.follow(int(e.pid))
				view.pos[e.pid] = e.to
				layout_tokens({"pid": e.pid, "dur": 0.0 if fast else Rules.ANIM.fly, "arc": 2.2})
				if not fast:
					await _sleep(Rules.ANIM.fly)
				main.pieces.set_target(-1)
				main.board.set_target(-1)
			"rent", "tax", "fee":
				if fast:
					continue
				audio.sfx("pay")
				await _pile(e.amount, Rules.ANIM[e.t])
			"buy", "upgrade", "buyout":
				if fast:
					continue
				await _pile(e.cost, Rules.ANIM[e.t])
			"fest":
				for k in 32:
					render_tile(k, fin)
				if fast:
					continue
				audio.sfx("upgrade")
				main.pieces.fireworks(e.tile)
				await banner("🎆 LỄ HỘI ×%d" % int(e.mult), Data.BOARD[e.tile].name, Color("#e0267a"), Rules.ANIM.fest)
			"demolish", "burn":
				if fast:
					continue
				var burn: bool = e.t == "burn"
				if burn:
					main.pieces.fx_burn(e.tile, true)
				else:
					main.pieces.fx_shake(e.tile, 500)
					get_tree().create_timer(0.5).timeout.connect(main.pieces.collapse.bind(int(e.tile)))
				audio.sfx("pay")
				var lv: String = ("còn nhà cấp %d" % int(e.lvl) if int(e.get("lvl", 0)) else "còn đất trống") if burn else "%s mất nhà" % fin.players[int(e.from)].name
				await banner("🔥 ĐỐT NHÀ" if burn else "💥 PHÁ NHÀ", "%s · %s" % [Data.BOARD[e.tile].name, lv], Color("#e8590c") if burn else Color("#5b4b45"), Rules.ANIM[e.t] - 200)
				if burn:
					main.pieces.fx_burn(e.tile, false)
			"sell":
				if fast:
					continue
				main.pieces.collapse(e.tile)
				await _sleep(Rules.ANIM.sell)
			"bonus":
				if fast:
					continue
				var what := ""
				match e.kind:
					"upgrade":
						what = "%s lên %s miễn phí" % [Data.BOARD[e.tile].name, "Khách sạn" if int(e.lvl) >= 4 else "nhà cấp %d" % int(e.lvl)]
					"cash":
						what = "Thêm %s" % Rules.fmt_full(e.amount)
					"card":
						what = "Nhận 1 thẻ cứu hộ"
					"fly":
						what = "Vé bay miễn phí lượt sau"
				audio.sfx("upgrade")
				await banner("🎁 THƯỞNG XUẤT PHÁT", what, Color("#f08c00"), Rules.ANIM.bonus)
			"mono":
				for k in e.tiles:
					render_tile(k, fin)
				if fast:
					continue
				audio.sfx("win")
				main.pieces.celebrate(e.tiles)
				await banner("👑 ĐỘC QUYỀN", "%s · tiền thuê cả vùng +50%%" % Data.GROUPS[e.group].name, Color(Data.GROUPS[e.group].color), Rules.ANIM.mono)
			"money":
				view.money[e.pid] += int(e.delta)
				_update_money(e.pid)
				if not fast:
					_float_money(e.pid, int(e.delta))
					audio.sfx("coin" if e.delta > 0 else "pay")
			"card":
				if fast:
					continue
				await _show_card(e)
			"build":
				var before: String = main.pieces.building_key(e.tile)
				render_tile(e.tile, fin)
				if fast:
					continue
				main.board.flash_tile(e.tile)
				if e.get("up", false):
					var o: Dictionary = fin.own[e.tile]
					var up := before != "" and int(before.split("|")[1]) < int(o.lvl)
					audio.sfx("upgrade" if up else "build")
					await _sleep(Rules.ANIM.build)
			"msg":
				ticker.text = e.text
				ticker.modulate.a = 1
				var tw := ticker.create_tween()
				tw.tween_interval(4.0)
				tw.tween_property(ticker, "modulate:a", 0.0, 0.6)
			"again":
				ticker.text = "🎲 %s gieo đôi, được gieo tiếp!" % fin.players[e.pid].name
			"turn":
				main.pieces.set_current(e.pid)
				main.pieces.cur_pid = int(e.pid)
				if not fast:
					var mine: bool = (not fin.players[e.pid].bot) if mode == "local" else int(e.pid) == my_seat
					if mine:
						audio.sfx("turn")
					await _sleep(Rules.ANIM.turn)
			"bankrupt":
				var prev = S
				S = fin
				layout_tokens()
				S = prev
			"win":
				main.pieces.celebrate(Rules.owned_by(fin, int(e.pid)).slice(0, 6))


func _pile(amount: int, dur: int) -> void:
	main.pieces.show_pile(amount)
	var l := UiKit.label(Rules.fmt_full(amount), 34, Color("#ffcf3f"), "Black")
	l.add_theme_color_override("font_outline_color", Color("#6a3b00"))
	l.add_theme_constant_override("outline_size", 10)
	hud.add_child(l)
	var sp: Vector2 = main.cam.unproject_position(Vector3(0, 1.4, 0))
	l.reset_size()
	l.position = sp - l.size / 2
	l.pivot_offset = l.size / 2
	l.scale = Vector2(0.5, 0.5)
	var tw := l.create_tween()
	tw.tween_property(l, "scale", Vector2.ONE, 0.3).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	await _sleep(dur - 250)
	main.pieces.clear_pile()
	l.queue_free()


func _show_card(e: Dictionary) -> void:
	audio.sfx("card")
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", UiKit.box(Color("#fff8ec"), 22, Color("#e0263f"), 5, 30, Vector4(28, 24, 28, 24)))
	var v := UiKit.vbox(12)
	var head := UiKit.hbox(10)
	var ic := TextureRect.new()
	ic.texture = UiKit.tex("res://assets/icons/envelope.webp")
	ic.custom_minimum_size = Vector2(48, 48)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	head.add_child(ic)
	head.add_child(UiKit.label("CƠ HỘI", 28, Color("#c0182a"), "Black"))
	v.add_child(head)
	var t := UiKit.label(e.text, 20, Color("#3a2010"), "ExtraBold")
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.custom_minimum_size.x = 380
	v.add_child(t)
	var amt: int = int(e.get("amount", 0))
	if amt:
		v.add_child(UiKit.label(("+" if amt > 0 else "") + Rules.fmt_full(amt), 26, Color("#1f9d55") if amt > 0 else Color("#e03b3b"), "Black"))
	p.add_child(v)
	banner_box.add_child(p)
	await get_tree().process_frame
	var vs := root.get_viewport_rect().size
	p.position = Vector2((vs.x - p.size.x) / 2, (vs.y - p.size.y) / 2 - 20)
	p.pivot_offset = p.size / 2
	p.scale = Vector2(0.2, 0.2)
	p.rotation = -0.3
	var tw := p.create_tween().set_parallel(true)
	tw.tween_property(p, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(p, "rotation", 0.0, 0.45)
	await _sleep(Rules.ANIM.card - 300)
	var tw2 := p.create_tween()
	tw2.tween_property(p, "modulate:a", 0.0, 0.25)
	await tw2.finished
	p.queue_free()


func show_win() -> void:
	win_shown = true
	if main.args.has("autoplay"):
		print("KẾT THÚC: ", S.players[int(S.winner)].name, " — ", S.winReason, " vòng ", S.round)
	audio.sfx("win")
	var w: Dictionary = S.players[int(S.winner)]
	var v := UiKit.vbox(14)
	var h := UiKit.hbox(16)
	h.add_child(UiKit.avatar(int(w.get("char", int(S.winner))), Color(w.color), 96))
	var tv := UiKit.vbox(4)
	tv.add_child(UiKit.label("🏆 %s chiến thắng!" % w.name, 28, null, "Black"))
	tv.add_child(UiKit.label(Data.WIN_LABEL.get(S.winReason, ""), 17, UiKit.c("accent"), "ExtraBold"))
	h.add_child(tv)
	v.add_child(h)
	var order := range(S.players.size())
	order.sort_custom(func(a, b): return Rules.net_worth(S, a) > Rules.net_worth(S, b))
	for k in order.size():
		var p: Dictionary = S.players[order[k]]
		v.add_child(UiKit.rich("%d. [b][color=%s]%s[/color][/b] — tài sản %s%s" % [k + 1, p.color, p.name, Data.fmt(Rules.net_worth(S, order[k])), " (phá sản)" if p.out else ""], 16))
	var row := UiKit.hbox(10)
	if mode == "local":
		var again := UiKit.button("🔁 Chơi ván mới", "primary", 17)
		again.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		again.pressed.connect(func():
			close_modal()
			var ps := []
			for p in S.players:
				ps.append({"name": p.name, "bot": p.bot, "char": p.get("char", 0)})
			start_local(ps, int(S.timeLimit)))
		row.add_child(again)
	var hm := UiKit.button("🏠 Về trang chủ", "normal", 17)
	hm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hm.pressed.connect(func():
		close_modal()
		go_home())
	row.add_child(hm)
	v.add_child(row)
	open_modal(v, 520)


# ======================= CHƠI ONLINE: sảnh chờ + nhận tin =======================
var lobby: Dictionary = {}
var net_status_ok := false
var net_ping := -1


func on_net_status(ok: bool) -> void:
	net_status_ok = ok
	if lobby.size() and home:
		_show_lobby()


func on_net_ping(ms: int) -> void:
	net_ping = ms


func on_net_msg(m: Dictionary) -> void:
	match m.t:
		"room":
			lobby = m
			my_seat = int(m.you)
			if main.args.has("autostart") and m.host and not m.started and m.seats.size() >= 2:
				net.send({"t": "start"})
			if not m.started:
				if mode == "online" and S:
					S = null
					close_modal()
				mode = "online"
				_show_lobby()
			else:
				mode = "online"
				if S and hud:
					render_players()
		"state":
			var st: Dictionary = m.state
			if mode != "online" or S == null or hud == null or m.events.is_empty():
				mode = "online"
				if S == null or hud == null:
					enter_game(st)
				else:
					push_update(st, [])
			else:
				push_update(st, m.events)
		"chat":
			toast("💬 %s: %s" % [m.name, m.text], 4.0)
		"error":
			toast(m.text)
			if S and mode == "online":
				render()
		"left":
			if m.get("text", "") != "":
				toast(m.text)
			if net:
				net.close()
				net = null
			lobby = {}
			S = null
			mode = ""
			show_home()


func _show_lobby() -> void:
	main.set_mode("home")
	if hud:
		hud.queue_free()
		hud = null
	if home:
		home.queue_free()
	home = Control.new()
	home.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(home)
	var cc := CenterContainer.new()
	cc.set_anchors_preset(Control.PRESET_FULL_RECT)
	home.add_child(cc)
	var p := UiKit.panel(26, 24, Vector4(28, 24, 28, 24))
	p.custom_minimum_size.x = 560
	cc.add_child(p)
	var v := UiKit.vbox(14)
	p.add_child(v)
	var head := UiKit.hbox(12)
	head.add_child(UiKit.label("Phòng", 22, UiKit.c("dim"), "ExtraBold"))
	head.add_child(UiKit.label(str(lobby.get("code", "")), 40, UiKit.c("accent"), "Black"))
	var st := UiKit.label(("🟢 Đã kết nối" if net_status_ok else "🔴 Đang kết nối…") + (" · %dms" % net_ping if net_ping >= 0 else ""), 14, UiKit.c("dim"), "Bold")
	st.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	head.add_child(st)
	v.add_child(head)
	var inv := UiKit.label("Mời bạn: mở duydev1205.github.io/Monopoly/?room=%s hoặc nhập mã phòng trong app." % lobby.get("code", ""), 14, UiKit.c("dim"), "Medium")
	inv.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(inv)
	var copy := UiKit.button("🔗 Sao chép link mời", "ghost", 15)
	copy.pressed.connect(func():
		DisplayServer.clipboard_set("https://duydev1205.github.io/Monopoly/?room=%s" % lobby.get("code", ""))
		toast("Đã sao chép link mời"))
	v.add_child(copy)
	v.add_child(_section("NGƯỜI CHƠI"))
	var seats: Array = lobby.get("seats", [])
	for i in seats.size():
		var s: Dictionary = seats[i]
		var row := UiKit.hbox(12)
		row.add_child(UiKit.avatar(int(s.get("char", i)), Color(Data.PLAYER_COLORS[i]), 52))
		var nm := UiKit.label(str(s.name) + (" (bạn)" if i == my_seat else ""), 18, null, "ExtraBold")
		nm.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		nm.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(nm)
		var tag := "👑 chủ phòng" if s.get("host", false) else ("🤖 máy" if s.bot else ("online" if s.online else "offline"))
		var tl := UiKit.label(tag, 13, UiKit.c("dim"), "Bold")
		tl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		row.add_child(tl)
		if lobby.get("host", false) and i != my_seat:
			var x := UiKit.button("✕", "chip", 12)
			x.pressed.connect(func(): net.send({"t": "kick", "seat": i}))
			row.add_child(x)
		v.add_child(row)
	if lobby.get("host", false):
		var hr := UiKit.hbox(10)
		var ab := UiKit.button("🤖 Thêm máy", "normal", 15)
		ab.disabled = seats.size() >= 4
		ab.pressed.connect(func(): net.send({"t": "addBot"}))
		hr.add_child(ab)
		for mnt in Rules.TIME_OPTS:
			var tb := UiKit.button("%d'" % mnt, "primary" if int(lobby.get("timeLimit", 60)) == mnt else "normal", 14)
			tb.pressed.connect(func(): net.send({"t": "settings", "timeLimit": mnt}))
			hr.add_child(tb)
		v.add_child(hr)
		var sb := UiKit.button("BẮT ĐẦU CHƠI", "primary", 20)
		sb.custom_minimum_size.y = 56
		sb.disabled = seats.size() < 2
		sb.pressed.connect(func(): net.send({"t": "start"}))
		v.add_child(sb)
	else:
		v.add_child(UiKit.label("Đang chờ chủ phòng bắt đầu…", 15, UiKit.c("dim"), "Bold"))
	var lv := UiKit.button("🚪 Rời phòng", "normal", 15)
	lv.pressed.connect(func():
		if net:
			net.send({"t": "leave"})
		go_home())
	v.add_child(lv)
