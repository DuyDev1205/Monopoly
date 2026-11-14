// Ngọn cỏ (MultiMesh): gốc tối ngọn sáng, đung đưa theo gió (nhiễu theo vị trí), màu từng ngọn hơi khác nhau.
shader_type spatial;
render_mode cull_disabled;

uniform vec4 base_col : source_color = vec4(0.25, 0.45, 0.2, 1.0);
uniform vec4 tip_col : source_color = vec4(0.62, 0.82, 0.45, 1.0);
uniform float wind = 1.0;
uniform sampler2D noise : filter_linear, repeat_enable;

varying vec3 tint;
varying float hgt;

void vertex() {
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	hgt = clamp(UV.y, 0.0, 1.0);                         // 0 gốc, 1 ngọn
	float gust = textureLod(noise, wp.xz * 0.05 + vec2(TIME * 0.04, TIME * 0.025), 0.0).r;
	float sway = (sin(TIME * 1.8 + wp.x * 0.7 + wp.z * 0.5) * 0.35 + gust * 1.2 - 0.5) * wind;
	VERTEX.x += sway * hgt * hgt * 0.12;
	VERTEX.z += sway * hgt * hgt * 0.06;
	tint = INSTANCE_CUSTOM.rgb;
	NORMAL = vec3(0.0, 1.0, 0.0);                        // ánh sáng mềm như thảm cỏ
}

void fragment() {
	vec3 c = mix(base_col.rgb, tip_col.rgb, hgt);
	ALBEDO = c * tint;
	ROUGHNESS = 0.9;
	SPECULAR = 0.15;
}
