// Ngọn cỏ (MultiMesh): gốc hoà vào mặt đất, ngọn sáng; màu loang theo mảng (vàng úa / xanh đậm);
// gió thổi thành từng dải: ngọn cong theo gió và sáng lên khi dải gió lướt qua.
shader_type spatial;
render_mode cull_disabled;

uniform vec4 base_col : source_color = vec4(0.25, 0.45, 0.2, 1.0);
uniform vec4 tip_col : source_color = vec4(0.62, 0.82, 0.45, 1.0);
uniform vec4 dry_col : source_color = vec4(0.78, 0.8, 0.45, 1.0);
uniform vec4 deep_col : source_color = vec4(0.2, 0.42, 0.22, 1.0);
uniform float wind = 1.0;
uniform sampler2D noise : filter_linear, repeat_enable;

varying vec3 tint;
varying float hgt;
varying float gust_v;
varying vec2 pv;

void vertex() {
	hgt = clamp(UV.y, 0.0, 1.0);
	vec3 root = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	// dải gió chạy chéo qua bãi cỏ
	float g = textureLod(noise, root.xz * 0.045 + vec2(TIME * 0.06, TIME * 0.035), 0.0).r;
	float band = smoothstep(0.45, 0.85, g);
	float sway = (sin(TIME * 2.0 + root.x * 0.8 + root.z * 0.6) * 0.25 + band * 1.1) * wind;
	VERTEX.x += sway * hgt * hgt * 0.16;
	VERTEX.z += sway * hgt * hgt * 0.08;
	VERTEX.y -= band * hgt * hgt * 0.04;
	gust_v = band;
	tint = INSTANCE_CUSTOM.rgb;
	pv = vec2(textureLod(noise, root.xz * 0.03 + 0.31, 0.0).r, textureLod(noise, root.xz * 0.11 + 0.77, 0.0).r);
	NORMAL = vec3(0.0, 1.0, 0.0);
}

void fragment() {
	float hh = clamp(hgt, 0.0, 1.0);
	vec3 tip = mix(tip_col.rgb, dry_col.rgb, smoothstep(0.58, 0.8, pv.x) * 0.7);
	tip = mix(tip, deep_col.rgb * 1.3, (1.0 - smoothstep(0.25, 0.42, pv.y)) * 0.45);
	vec3 c = mix(mix(base_col.rgb, tip, 0.45), tip, sqrt(max(hh, 0.0)) * 0.5 + hh * 0.5);
	c *= tint * mix(0.82, 1.0, hh);
	c += vec3(0.08, 0.09, 0.03) * gust_v * hh;
	ALBEDO = c;
	ROUGHNESS = 0.95;
	SPECULAR = 0.08;
}
