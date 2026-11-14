class_name Painter
extends Node
## Vẽ sẵn texture kiểu tranh vẽ ngay khi chạy (không cần ảnh ngoài): cây anh đào (thân cành thon, tán nhiều lớp
## hồng có sáng tối, rắc hoa 5 cánh), cánh hoa, bông hoa, mảng tán mềm, đảo cỏ phủ thảm cánh hoa.
## Vẽ vào SubViewport một lần rồi chụp lại thành ImageTexture.

const PINKS := ["#ffd6e4", "#ffc2d6", "#ffadc8", "#f794b6", "#ffe6ef", "#ff9fc0"]

static var cache := {}


## ảnh tròn mềm (đốm cọ): trắng, mờ dần ra mép
static func soft_blob(size := 128, hard := 0.35) -> ImageTexture:
	var key := "blob%d_%s" % [size, hard]
	if cache.has(key):
		return cache[key]
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var c := (size - 1) / 2.0
	for y in size:
		for x in size:
			var d := Vector2(x - c, y - c).length() / c
			var a := clampf((1.0 - d) / (1.0 - hard), 0, 1)
			a = a * a * (3 - 2 * a)
			img.set_pixel(x, y, Color(1, 1, 1, a))
	img.generate_mipmaps()
	var t := ImageTexture.create_from_image(img)
	cache[key] = t
	return t


## bông hoa 5 cánh trắng (tô màu bằng modulate), nhuỵ vàng nhạt
static func flower(size := 48) -> ImageTexture:
	var key := "flower%d" % size
	if cache.has(key):
		return cache[key]
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	var c := (size - 1) / 2.0
	for y in size:
		for x in size:
			var d := Vector2(x - c, y - c)
			var r := d.length() / c
			var a := d.angle()
			var petal := 0.6 + 0.4 * absf(cos(2.5 * a))
			var notch := 0.1 * smoothstep(0.93, 1.0, absf(cos(2.5 * a)))
			var edge := petal - notch
			if r > edge + 0.04:
				continue
			var alpha := clampf((edge + 0.04 - r) / 0.08, 0, 1)
			var col := Color(1, 1, 1, alpha)
			if r < 0.12:
				col = Color(1.0, 0.9, 0.7, alpha)
			else:
				var sh := 1.0 - 0.12 * r
				col = Color(sh, sh, sh, alpha)
			img.set_pixel(x, y, col)
	img.generate_mipmaps()
	var t := ImageTexture.create_from_image(img)
	cache[key] = t
	return t


## cánh hoa rơi (hình giọt có khía)
static func petal(size := 32) -> ImageTexture:
	var key := "petal%d" % size
	if cache.has(key):
		return cache[key]
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)
	for y in size:
		for x in size:
			var u := (x - (size - 1) / 2.0) / (size * 0.32)
			var v := (y - (size - 1) / 2.0) / (size * 0.46)
			var half := sqrt(maxf(0, 1 - v * v)) * (1.0 - 0.3 * v)
			var notch := 0.25 * smoothstep(0.75, 1.0, -v) * (1.0 - absf(u) * 3.0)
			var e := absf(u) - half + (notch if -v > 0.7 else 0.0)
			if e > 0.05:
				continue
			var a := clampf(-e / 0.1 + 0.5, 0, 1)
			var sh := 0.88 + 0.12 * (v * 0.5 + 0.5)
			img.set_pixel(x, y, Color(sh, sh, sh, a))
	img.generate_mipmaps()
	var t := ImageTexture.create_from_image(img)
	cache[key] = t
	return t


# ======================= cây anh đào =======================
class TreeCanvas:
	extends Node2D
	var seed := 1
	var W := 768
	var H := 640
	var kind := "sakura"
	var pal: Array = []
	var trunk := Color("#6b4a5a")

	var twigs: Array = []        # [điểm, độ sâu] dọc các cành để mọc hoa

	func _draw() -> void:
		var rng := RandomNumberGenerator.new()
		rng.seed = seed
		var ends: Array = []
		twigs.clear()
		var root := Vector2(W / 2.0 + rng.randf_range(-20, 20), H - 8)
		var light := Vector2(-0.55, -0.8).normalized()
		var blob := Painter.soft_blob(128, 0.15)
		var fl := Painter.flower(48)
		# quầng hồng mờ phía sau tán (vẽ trước, nằm dưới thân cành)
		var pre := RandomNumberGenerator.new()
		pre.seed = seed
		_branch(rng, root, Vector2(rng.randf_range(-0.2, 0.2), -1).normalized(), H * 0.2, 38.0, 0, ends)
		var cc := Vector2.ZERO
		for e in ends:
			cc += e
		cc /= maxf(1, ends.size())
		# hoa mọc dọc cành con: phía nắng trắng hồng, phía khuất hồng đậm; mép tán thưa như ren
		for i in twigs.size():
			var tw: Array = twigs[i]
			var p: Vector2 = tw[0]
			var dep: int = tw[1]
			if dep < 2:
				continue
			var lit := clampf(0.5 + 0.5 * (p - cc).normalized().dot(light) + (cc.y - p.y) / 600.0, 0, 1)
			var halo := Color(pal[2]).lerp(Color(pal[0]), lit)
			halo.a = 0.22
			var hr := rng.randf_range(36, 56)
			draw_texture_rect(blob, Rect2(p - Vector2(hr, hr * 0.8), Vector2(hr * 2, hr * 1.6)), false, halo)
		for i in twigs.size():
			var tw: Array = twigs[i]
			var p: Vector2 = tw[0]
			var dep: int = tw[1]
			if dep < 2:
				continue
			var n := 13 if dep >= 4 else 7
			for k in n:
				var a := rng.randf() * TAU
				var rr := sqrt(rng.randf()) * 28
				var q := p + Vector2(cos(a) * rr, sin(a) * rr * 0.8)
				var lit := clampf(0.5 + 0.5 * (q - cc).normalized().dot(light) + (cc.y - q.y) / 500.0, 0, 1)
				var col := Color(pal[2]).lerp(Color(pal[0]), 0.35 + lit * 0.65).lerp(Color.WHITE, lit * 0.35)
				if rng.randf() < 0.12:
					col = Color(pal[3])          # vài bông đậm tạo chiều sâu
				var sz := rng.randf_range(10, 17) * (1.1 if dep >= 4 else 1.0)
				draw_set_transform(q, rng.randf() * TAU, Vector2.ONE)
				draw_texture_rect(fl, Rect2(-sz / 2, -sz / 2, sz, sz), false, col)
				draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)
		# vài cánh rơi lơ lửng quanh tán
		var pt := Painter.petal(32)
		for k in 18:
			var q := cc + Vector2(rng.randf_range(-260, 260), rng.randf_range(-40, 260))
			var sz := rng.randf_range(7, 11)
			draw_set_transform(q, rng.randf() * TAU, Vector2.ONE)
			draw_texture_rect(pt, Rect2(-sz / 2, -sz / 2, sz, sz), false, Color(pal[0]))
			draw_set_transform(Vector2.ZERO, 0, Vector2.ONE)


	func _branch(rng: RandomNumberGenerator, p: Vector2, dir: Vector2, length: float, width: float, depth: int, ends: Array) -> void:
		var seg := 6
		var pts: Array[Vector2] = [p]
		var d := dir
		for k in seg:
			d = (d + Vector2(rng.randf_range(-0.3, 0.3), rng.randf_range(-0.05, 0.08))).normalized()
			pts.append(pts[-1] + d * length / seg)
		# thân thon dần, mặt sáng bên trái
		var w0 := width
		var w1 := width * 0.62
		var left: PackedVector2Array = []
		var right: PackedVector2Array = []
		for k in pts.size():
			var t := float(k) / (pts.size() - 1)
			var tan := (pts[mini(k + 1, pts.size() - 1)] - pts[maxi(k - 1, 0)]).normalized()
			var nrm := Vector2(-tan.y, tan.x)
			var w := lerpf(w0, w1, t) / 2
			left.append(pts[k] + nrm * w)
			right.append(pts[k] - nrm * w)
		var poly := left.duplicate()
		right.reverse()
		poly.append_array(right)
		draw_colored_polygon(poly, trunk)
		for k in range(1, pts.size()):
			twigs.append([pts[k], depth])
		var hl := PackedVector2Array()
		for k in pts.size():
			hl.append(left[k].lerp(pts[k], 0.45))
		draw_polyline(hl, trunk.lightened(0.25), maxf(1.5, width * 0.12), true)
		var end := pts[-1]
		if depth >= 5 or width < 2.5:
			ends.append(end)
			return
		var n := 2 if depth < 1 else rng.randi_range(2, 3)
		for k in n:
			var spread := lerpf(-1.15, 1.15, (k + 0.5) / n) + rng.randf_range(-0.2, 0.2)
			var nd := d.rotated(spread).normalized()
			nd.y = minf(nd.y, -0.15)		  # cành xoè ngang nhưng vẫn vươn lên
			_branch(rng, end, nd.normalized(), length * rng.randf_range(0.66, 0.82), w1 * 0.7, depth + 1, ends)
		if depth >= 1:
			ends.append(end)


## vẽ một cây anh đào thành texture (await)
static func tree(host: Node, kind: String, seed: int, pal: Array, trunk := Color("#5a3a3a")) -> ImageTexture:
	var key := "tree_%s_%d" % [kind, seed]
	if cache.has(key):
		return cache[key]
	var vp := SubViewport.new()
	vp.size = Vector2i(768, 640)
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	vp.disable_3d = true
	var tc := TreeCanvas.new()
	tc.seed = seed
	tc.kind = kind
	tc.pal = pal
	tc.trunk = trunk
	vp.add_child(tc)
	host.add_child(vp)
	await RenderingServer.frame_post_draw
	var img := vp.get_texture().get_image()
	img.generate_mipmaps()
	var t := ImageTexture.create_from_image(img)
	vp.queue_free()
	cache[key] = t
	return t
