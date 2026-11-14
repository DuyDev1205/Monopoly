class_name Iso
## Phép chiếu isometric (nhìn chéo từ góc +x+z như bản 3D cũ): toạ độ bàn cờ (x, z, cao y) -> điểm trên màn hình.
## Xuất Phát ở đáy hình thoi, Lễ Hội ở đỉnh.

static var A := 64.0      # px theo trục chéo ngang
static var B := 37.0      # px theo trục chéo dọc (độ nghiêng)
static var HS := 48.0     # px cho 1 đơn vị chiều cao


static func p(x: float, z: float, y := 0.0) -> Vector2:
	return Vector2((x - z) * A, (x + z) * B - y * HS)


static func v(w: Vector3) -> Vector2:
	return p(w.x, w.z, w.y)
