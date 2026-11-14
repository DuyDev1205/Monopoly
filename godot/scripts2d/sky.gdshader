// Trời kiểu tranh vẽ: chuyển màu tím xanh → hồng ở chân trời, mây bông mềm nhiều lớp trôi chậm, quầng nắng.
shader_type canvas_item;

uniform vec4 top_col : source_color = vec4(0.48, 0.55, 0.86, 1.0);
uniform vec4 mid_col : source_color = vec4(0.76, 0.66, 0.9, 1.0);
uniform vec4 hz_col : source_color = vec4(1.0, 0.8, 0.86, 1.0);
uniform vec4 cloud_a : source_color = vec4(1.0, 0.93, 0.97, 1.0);
uniform vec4 cloud_b : source_color = vec4(0.93, 0.6, 0.78, 1.0);
uniform vec4 cloud_shadow : source_color = vec4(0.62, 0.52, 0.82, 1.0);
uniform vec2 sun = vec2(0.72, 0.62);
uniform float speed = 0.006;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
float fbm(vec2 p) {
	return texture(noise_tex, p * 0.25).r * 0.6 + texture(noise_tex, p * 0.61 + 0.37).r * 0.3 + texture(noise_tex, p * 1.43 + 0.71).r * 0.1;
}

void fragment() {
	vec2 uv = UV;
	float y = uv.y;
	vec3 col = mix(top_col.rgb, mid_col.rgb, smoothstep(0.0, 0.55, y));
	col = mix(col, hz_col.rgb, smoothstep(0.45, 1.0, y));
	// quầng nắng hồng vàng
	float d = length((uv - sun) * vec2(1.6, 1.0));
	col += vec3(1.0, 0.85, 0.75) * 0.35 * (1.0 - smoothstep(0.0, 0.55, d));
	// mây: 2 lớp, lớp xa nhạt, lớp gần đậm có bóng dưới đáy
	float t = TIME * speed;
	for (int L = 0; L < 2; L++) {
		float sc = L == 0 ? 2.2 : 3.4;
		vec2 p = vec2(uv.x * sc * 1.6 + t * (L == 0 ? 1.0 : 1.8), uv.y * sc);
		float n = fbm(p);
		float dens = smoothstep(0.42, 0.66, n) * (L == 0 ? 0.75 : 0.95);
		dens *= smoothstep(0.0, 0.18, y) * (1.0 - smoothstep(0.8, 1.0, y) * 0.5);
		float shade = fbm(p + vec2(0.0, 0.08));
		vec3 cc = mix(cloud_b.rgb, cloud_a.rgb, smoothstep(0.45, 0.75, n + 0.1));
		cc = mix(cc, cloud_shadow.rgb, smoothstep(0.55, 0.8, shade - n + 0.55) * 0.35);
		col = mix(col, cc, dens);
	}
	// nét cọ: vân nhẹ cho cảm giác tranh vẽ
	COLOR = vec4(col, 1.0);
}
