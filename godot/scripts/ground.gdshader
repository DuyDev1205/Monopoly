// Mặt đất: cỏ loang 2-3 tông theo nhiễu, đất ẩm ven suối, cánh hoa rải trên cỏ (theo theme).
shader_type spatial;

uniform vec4 grass_a : source_color = vec4(0.55, 0.74, 0.42, 1.0);
uniform vec4 grass_b : source_color = vec4(0.42, 0.62, 0.32, 1.0);
uniform vec4 grass_dry : source_color = vec4(0.72, 0.76, 0.46, 1.0);
uniform vec4 bank : source_color = vec4(0.45, 0.38, 0.3, 1.0);
uniform vec4 petal : source_color = vec4(1.0, 0.8, 0.88, 1.0);
uniform float petal_amt = 0.0;
uniform sampler2D noise : filter_linear_mipmap, repeat_enable;

varying vec3 wpos;
varying float wet;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wet = COLOR.r;          // 1 = sát bờ suối
}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void fragment() {
	vec2 p = wpos.xz;
	float n1 = texture(noise, p * 0.035).r;
	float n2 = texture(noise, p * 0.13 + 0.37).r;
	float n3 = texture(noise, p * 0.6 + 0.71).r;
	vec3 col = mix(grass_b.rgb, grass_a.rgb, smoothstep(0.3, 0.7, n1));
	col = mix(col, grass_dry.rgb, smoothstep(0.62, 0.85, n2) * 0.55);
	col *= 0.9 + 0.2 * n3;
	col = mix(col, bank.rgb, smoothstep(0.35, 0.9, wet));
	// cánh hoa rơi trên cỏ
	if (petal_amt > 0.0) {
		vec2 cell = floor(p * 5.0);
		vec2 f = fract(p * 5.0);
		float h = hash(cell);
		if (h < petal_amt * (0.5 + n2)) {
			vec2 c = vec2(hash(cell + 1.3), hash(cell + 7.1)) * 0.6 + 0.2;
			float a = hash(cell + 3.7) * 6.283;
			vec2 d = mat2(vec2(cos(a), sin(a)), vec2(-sin(a), cos(a))) * (f - c);
			float e = length(d / vec2(0.11, 0.065));
			col = mix(col, petal.rgb * (0.9 + 0.2 * hash(cell + 9.0)), (1.0 - smoothstep(0.8, 1.0, e)) * (1.0 - wet));
		}
	}
	ALBEDO = col;
	ROUGHNESS = 0.95;
	SPECULAR = 0.2;
}
