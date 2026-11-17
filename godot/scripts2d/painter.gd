class_name Painter
extends Node
## Vẽ sẵn vài texture nhỏ ngay khi chạy (không cần ảnh ngoài): đốm cọ mềm, cánh hoa.

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
