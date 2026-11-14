// Mặt xúc xắc vẽ bằng shader: nền chuyển màu + chấm tròn nổi, kiểu trang trí theo bộ (vân gỗ, sọc kẹo, sao, sóng, viền, phát sáng…).
shader_type spatial;

uniform int n = 1;
uniform vec4 bg0 : source_color = vec4(1.0);
uniform vec4 bg1 : source_color = vec4(0.92, 0.89, 0.84, 1.0);
uniform vec4 pip0 : source_color = vec4(0.35, 0.35, 0.35, 1.0);
uniform vec4 pip1 : source_color = vec4(0.05, 0.05, 0.05, 1.0);
uniform vec4 red0 : source_color = vec4(1.0, 0.42, 0.42, 1.0);
uniform vec4 red1 : source_color = vec4(0.7, 0.07, 0.1, 1.0);
uniform vec4 ring_col : source_color = vec4(0.0);
uniform int deco = 0;       // 0 không, 1 vân gỗ, 2 vân đá, 3 mặt cắt pha lê, 4 sóng, 5 sọc kẹo, 6 sao, 7 hoa (mặt 1)
uniform float glow = 0.0;
uniform float rough = 0.3;
uniform float metal = 0.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec2 pip_pos(int k) {
	// toạ độ chấm theo số mặt (giống bản web)
	if (n == 1) return vec2(0.5);
	if (n == 2) return k == 0 ? vec2(0.27) : vec2(0.73);
	if (n == 3) return k == 0 ? vec2(0.27) : (k == 1 ? vec2(0.5) : vec2(0.73));
	if (n == 4) return vec2(k % 2 == 0 ? 0.27 : 0.73, k < 2 ? 0.27 : 0.73);
	if (n == 5) { if (k == 4) return vec2(0.5); return vec2(k % 2 == 0 ? 0.27 : 0.73, k < 2 ? 0.27 : 0.73); }
	return vec2(k % 2 == 0 ? 0.27 : 0.73, k < 2 ? 0.25 : (k < 4 ? 0.5 : 0.75));
}

void fragment() {
	vec2 uv = UV;
	vec3 col = mix(bg0.rgb, bg1.rgb, smoothstep(0.0, 0.85, length(uv - vec2(0.31, 0.27))));
	if (deco == 1) col *= 0.88 + 0.12 * sin(uv.y * 80.0 + sin(uv.x * 9.0) * 3.0);
	if (deco == 2) col = mix(col, vec3(1.0), 0.25 * smoothstep(0.02, 0.0, abs(sin(uv.y * 14.0 + sin(uv.x * 7.0) * 1.6) * 0.06)));
	if (deco == 3) { float l = min(min(abs(uv.x - uv.y), abs(uv.x + uv.y - 1.0)), min(abs(uv.x - 0.5), abs(uv.y - 0.5))); col = mix(col, vec3(1.0), 0.5 * (1.0 - smoothstep(0.004, 0.012, l))); }
	if (deco == 4) col = mix(col, vec3(1.0), 0.3 * (1.0 - smoothstep(0.006, 0.016, abs(fract(uv.y * 6.7 + sin(uv.x * 18.0) * 0.06) - 0.5))));
	if (deco == 5) col = mix(col, vec3(1.0, 0.7, 0.84), 0.45 * step(0.5, fract((uv.x + uv.y) * 5.8)));
	if (deco == 6) {
		vec2 c = floor(uv * 22.0);
		float h = hash(c);
		col += vec3(1.0, 0.9, 1.0) * step(0.88, h) * (1.0 - smoothstep(0.05, 0.25, length(fract(uv * 22.0) - 0.5)));
		col += vec3(1.0, 0.35, 0.8) * 0.3 * (1.0 - smoothstep(0.0, 0.45, length(uv - vec2(0.66, 0.35))));
	}
	if (ring_col.a > 0.0) { vec2 q = abs(uv - 0.5); col = mix(col, ring_col.rgb, step(0.43, max(q.x, q.y)) * step(max(q.x, q.y), 0.47)); }
	vec3 em = vec3(0.0);
	bool red = n == 1 || n == 4;
	vec3 c0 = red ? red0.rgb : pip0.rgb;
	vec3 c1 = red ? red1.rgb : pip1.rgb;
	if (deco == 7 && n == 1) {
		vec2 p = uv - 0.5;
		float a = atan(p.y, p.x), r = length(p);
		float petal = 0.3 * (0.62 + 0.38 * abs(cos(2.5 * a))) - 0.02 * smoothstep(0.85, 1.0, abs(cos(2.5 * a)));
		float m = 1.0 - smoothstep(petal - 0.006, petal + 0.006, r);
		col = mix(col, mix(c1, c0, r / 0.3), m);
		col = mix(col, vec3(1.0, 0.83, 0.42), 1.0 - smoothstep(0.045, 0.055, r));
	} else {
		float R = n == 1 ? 0.133 : 0.09;
		for (int k = 0; k < n; k++) {
			vec2 c = pip_pos(k);
			float d = length(uv - c);
			float m = 1.0 - smoothstep(R - 0.006, R + 0.004, d);
			vec3 pc = mix(c0, c1, smoothstep(0.0, R, length(uv - c + vec2(0.027))));
			col = mix(col, pc, m);
			em += c1 * glow * (m + (1.0 - smoothstep(R, R * 2.2, d)) * 0.5);
		}
	}
	ALBEDO = col;
	ROUGHNESS = rough;
	METALLIC = metal;
	EMISSION = em * 1.5;
}
