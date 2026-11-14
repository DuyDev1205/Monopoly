// Đảo cỏ kiểu tranh vẽ: cỏ loang mềm nhiều tông, mép đảo sáng (nắng) + viền bùn tối, thảm cánh hoa rụng dày ở giữa.
shader_type canvas_item;

uniform vec4 grass_a : source_color = vec4(0.62, 0.83, 0.52, 1.0);
uniform vec4 grass_b : source_color = vec4(0.47, 0.72, 0.5, 1.0);
uniform vec4 petal_col : source_color = vec4(1.0, 0.78, 0.86, 1.0);
uniform vec4 rim : source_color = vec4(0.78, 0.66, 0.72, 1.0);
uniform float petals = 0.6;
uniform float seed = 0.0;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
float noise(vec2 p) { return texture(noise_tex, p * 0.031).r; }

void fragment() {
	// UV: 0..1 trong hộp bao của đa giác; COLOR.a = khoảng cách tới mép (truyền qua màu đỉnh)
	vec2 p = UV * 8.0 + seed;
	float edge = COLOR.r;                 // 0 ở mép, 1 ở giữa
	float n = noise(p * 1.3) * 0.6 + noise(p * 4.0) * 0.4;
	vec3 col = mix(grass_b.rgb, grass_a.rgb, smoothstep(0.3, 0.75, n));
	col = mix(col, col * 1.12 + vec3(0.05, 0.04, 0.0), smoothstep(0.55, 0.9, noise(p * 0.6 + 3.0)) * 0.6);
	// lớp cánh hoa phủ loang thành mảng hồng
	float carpet = smoothstep(0.42, 0.62, noise(p * 0.9 + 4.0)) * petals * smoothstep(0.05, 0.5, edge);
	col = mix(col, mix(petal_col.rgb, vec3(1.0), 0.25), carpet * 0.75);
	// thảm cánh hoa: đốm nhỏ dày dần vào giữa
	float cells = 64.0;
	vec2 q = UV * cells * vec2(1.6, 1.0) + seed * 7.0;
	vec2 ci = floor(q), cf = fract(q);
	float h = hash(ci);
	float dens = petals * smoothstep(0.0, 0.6, edge) * (0.75 + 0.6 * noise(p * 0.5 + 9.0));
	if (h < dens) {
		vec2 c = vec2(hash(ci + 3.1), hash(ci + 5.7)) * 0.6 + 0.2;
		float a = hash(ci + 1.3) * 6.28;
		vec2 d = mat2(vec2(cos(a), sin(a)), vec2(-sin(a), cos(a))) * (cf - c);
		float e = length(d / vec2(0.34, 0.21));
		vec3 pc = petal_col.rgb * (0.9 + 0.2 * hash(ci + 9.0));
		col = mix(col, pc, 1.0 - smoothstep(0.75, 1.0, e));
	}
	// mép: viền đất hồng nhạt + bóng tối dần xuống nước
	col = mix(rim.rgb, col, smoothstep(0.0, 0.3, edge));
	COLOR = vec4(col, smoothstep(0.0, 0.22, edge));
}
