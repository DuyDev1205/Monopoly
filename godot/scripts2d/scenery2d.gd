class_name Scenery2D
extends Node2D
## Cảnh nền 2D kiểu tranh vẽ, phủ kín màn hình phía sau bàn cờ: trời + mây trôi + núi mờ sương + đồi hoa xa
## (3 ảnh trong assets/art, vẽ bằng tools/render_art.py), mặt hồ gương gợn sóng (bg.gdshader), cánh hoa bay theo gió.

const THEMES := {
	"sakura": {
		"deep": "#6f6cc6", "tint": "#f7efff", "mist": "#ffe0e0", "glint": "#fff3e4", "petal": "#ffe0ea", "petals": 0.34,
		"sun_u": 0.775, "glint_amt": 1.0, "water_mix": Vector2(0.10, 0.50),
		"fall": ["#ffd1e1", "#ffb3cb", "#ffe8f0"], "fall_n": 420,
	},
	"wood": {
		"deep": "#5d4a86", "tint": "#fff2e2", "mist": "#ffe3b5", "glint": "#fff1c4", "petal": "#f7b455", "petals": 0.28,
		"sun_u": 0.24, "glint_amt": 1.2, "water_mix": Vector2(0.10, 0.50),
		"fall": ["#f5a742", "#e8742a", "#ffcf6a"], "fall_n": 220,
	},
	"ocean": {
		"deep": "#1193c2", "tint": "#e8fbff", "mist": "#e6fbff", "glint": "#ffffff", "petal": "#ffffff", "petals": 0.0,
		"sun_u": 0.79, "glint_amt": 1.3, "water_mix": Vector2(0.22, 0.66),
		"fall": [], "fall_n": 0,
	},
	"midnight": {
		"deep": "#0a0e30", "tint": "#e0dbff", "mist": "#7a63b3", "glint": "#d9d6ff", "petal": "#d6caff", "petals": 0.10,
		"sun_u": 0.23, "glint_amt": 0.9, "water_mix": Vector2(0.14, 0.52),
		"fall": ["#d6caff", "#ffffff", "#ffc9ec"], "fall_n": 160,
	},
}
const HORIZON := 0.40             # chân trời ở 40% chiều cao màn hình
const DRIFT := 0.00042            # mây trôi: số vòng ảnh mỗi giây (~40 phút một vòng)

var theme := ""
var root: Node2D
var bg_layer: CanvasLayer
var bg: ColorRect
var mat: ShaderMaterial
var rng := RandomNumberGenerator.new()
var drift := 0.0
var wt := 0.0
var par_shift := Vector2.ZERO     # xê dịch nền theo camera (px màn hình), do cảnh chính đặt
var par_zoom := 1.0


func _ready() -> void:
	bg_layer = CanvasLayer.new()
	bg_layer.layer = -10
	add_child(bg_layer)
	bg = ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mat = ShaderMaterial.new()
	mat.shader = load("res://scripts2d/bg.gdshader")
	var nt := NoiseTexture2D.new()
	var fn := FastNoiseLite.new()
	fn.frequency = 0.012
	fn.fractal_octaves = 5
	nt.noise = fn
	nt.seamless = true
	nt.width = 512
	nt.height = 512
	nt.generate_mipmaps = true
	mat.set_shader_parameter("noise_tex", nt)
	mat.set_shader_parameter("horizon", HORIZON)
	bg.material = mat
	bg_layer.add_child(bg)
	drift = randf()


func set_theme(name: String) -> void:
	if name == theme:
		return
	theme = name if THEMES.has(name) else "sakura"
	var P: Dictionary = THEMES[theme]
	for k in ["sky", "clouds", "land"]:
		mat.set_shader_parameter(("cloud" if k == "clouds" else k) + "_tex", load("res://assets/art/%s_%s.png" % [theme, k]))
	mat.set_shader_parameter("deep_col", Color(P.deep))
	mat.set_shader_parameter("tint_col", Color(P.tint))
	mat.set_shader_parameter("mist_col", Color(P.mist))
	mat.set_shader_parameter("glint_col", Color(P.glint))
	mat.set_shader_parameter("petal_col", Color(P.petal))
	mat.set_shader_parameter("petal_amt", P.petals)
	mat.set_shader_parameter("sun_u", P.sun_u)
	mat.set_shader_parameter("glint", P.glint_amt)
	mat.set_shader_parameter("water_mix", P.water_mix)
	if root:
		root.queue_free()
	root = Node2D.new()
	add_child(root)
	rng.seed = hash(theme)
	if P.fall_n > 0:
		_falling(P)


## chất lượng thấp (0): bóng nước đơn giản hơn cho máy yếu
func set_quality(q: int) -> void:
	mat.set_shader_parameter("lite", q <= 0)


## nền xê dịch nhẹ theo camera cho có chiều sâu (off: độ lệch camera tính bằng px màn hình, k: độ phóng so với lúc vừa khung)
func set_view(off: Vector2, k: float) -> void:
	par_shift = off
	par_zoom = k


func _process(dt: float) -> void:
	drift = fmod(drift + dt * DRIFT, 1.0)
	wt = fmod(wt + dt, 3600.0)
	var vs := get_viewport_rect().size
	mat.set_shader_parameter("view_size", vs)
	mat.set_shader_parameter("drift", drift)
	mat.set_shader_parameter("wt", wt)
	var lim := vs.x * 0.03
	mat.set_shader_parameter("shift_px", Vector2(clampf(-par_shift.x * 0.06, -lim, lim), clampf(-par_shift.y * 0.04, -lim, lim)))
	mat.set_shader_parameter("zoom", 1.0 + (par_zoom - 1.0) * 0.12)


func _falling(P: Dictionary) -> void:
	for layer in 2:
		var pt := GPUParticles2D.new()
		pt.amount = int(P.fall_n * (0.6 if layer == 0 else 0.4))
		pt.lifetime = 14.0
		pt.preprocess = 14.0
		pt.texture = Painter.petal(32)
		pt.visibility_rect = Rect2(-2400, -1600, 4800, 3600)
		var pm := ParticleProcessMaterial.new()
		pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
		pm.emission_box_extents = Vector3(1500, 10, 1)
		pm.direction = Vector3(1, 0.6, 0)
		pm.spread = 20
		pm.initial_velocity_min = 40
		pm.initial_velocity_max = 90
		pm.gravity = Vector3(18, 32, 0)
		pm.turbulence_enabled = true
		pm.turbulence_noise_strength = 6.0
		pm.turbulence_noise_scale = 3.0
		pm.turbulence_influence_min = 0.1
		pm.turbulence_influence_max = 0.25
		pm.angle_min = 0
		pm.angle_max = 360
		pm.angular_velocity_min = -120
		pm.angular_velocity_max = 120
		pm.scale_min = 0.35 if layer == 0 else 0.7
		pm.scale_max = 0.7 if layer == 0 else 1.2
		var cr := Gradient.new()
		var cs := PackedColorArray()
		for h in P.fall:
			cs.append(Color(h))
		cr.colors = cs
		var ct := GradientTexture1D.new()
		ct.gradient = cr
		pm.color_initial_ramp = ct
		var al := Gradient.new()
		al.colors = PackedColorArray([Color(1, 1, 1, 0), Color(1, 1, 1, 1), Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
		al.offsets = PackedFloat32Array([0.0, 0.08, 0.85, 1.0])
		var at := GradientTexture1D.new()
		at.gradient = al
		pm.color_ramp = at
		pt.process_material = pm
		pt.position = Vector2(-500, -1170)
		pt.z_index = 50 if layer == 1 else 5
		root.add_child(pt)
