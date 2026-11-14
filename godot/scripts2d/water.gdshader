// Mặt hồ phẳng như gương: phản chiếu màu trời (đảo ngược), gợn sóng ngang mềm, lấp lánh, sương hồng ở xa.
shader_type canvas_item;

uniform vec4 deep : source_color = vec4(0.55, 0.62, 0.9, 1.0);
uniform vec4 near_col : source_color = vec4(0.62, 0.86, 0.92, 1.0);
uniform vec4 far_col : source_color = vec4(1.0, 0.82, 0.9, 1.0);
uniform vec4 glint : source_color = vec4(1.0, 0.95, 0.98, 1.0);
uniform vec2 world_size = vec2(4000.0, 3000.0);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
float noise(vec2 p) { return texture(noise_tex, p * 0.031).r; }

void fragment() {
	vec2 p = UV * world_size;
	float y = UV.y;
	vec3 col = mix(far_col.rgb, mix(deep.rgb, near_col.rgb, 0.5), smoothstep(0.0, 0.55, y));
	col = mix(col, near_col.rgb, smoothstep(0.5, 1.0, y) * 0.6);
	// gợn sóng ngang
	float w = noise(vec2(p.x * 0.006 + TIME * 0.05, p.y * 0.05)) * noise(vec2(p.x * 0.02 - TIME * 0.08, p.y * 0.11));
	col = mix(col, vec3(1.0), smoothstep(0.45, 0.7, w) * 0.12);
	col = mix(col, deep.rgb, smoothstep(0.2, 0.0, w) * 0.15);
	// lấp lánh
	float g = noise(p * 0.07 + vec2(TIME * 0.6, 0.0));
	col += glint.rgb * smoothstep(0.93, 0.99, g) * 0.12;
	COLOR = vec4(col, 1.0);
}
