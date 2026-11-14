// Sân giữa bàn cờ: ô ca-rô 2 màu, viền mảnh, quầng sáng giữa, huy hiệu tròn (chữ vòng là Label3D riêng).
shader_type spatial;

uniform vec4 c0 : source_color = vec4(1.0, 0.97, 0.98, 1.0);
uniform vec4 c1 : source_color = vec4(0.98, 0.9, 0.94, 1.0);
uniform vec4 line_col : source_color = vec4(0.92, 0.81, 0.88, 1.0);
uniform vec4 trim : source_color = vec4(0.91, 0.27, 0.49, 1.0);
uniform float half_size = 3.6;

float ring(float r, float at, float w) { return (1.0 - smoothstep(w * 0.4, w, abs(r - at))); }

void fragment() {
	vec2 p = (UV - 0.5) * 2.0 * half_size;
	vec2 cell = floor(UV * 8.0);
	vec3 col = mod(cell.x + cell.y, 2.0) < 0.5 ? c0.rgb : c1.rgb;
	// rãnh mảnh giữa các ô
	vec2 f = abs(fract(UV * 8.0) - 0.5);
	col = mix(col, col * 0.96, smoothstep(0.47, 0.5, max(f.x, f.y)));
	float r = length(p);
	col *= mix(1.06, 0.92, smoothstep(0.0, half_size * 1.3, r));
	// viền trong
	vec2 q = abs(p) - vec2(half_size - 0.12);
	float dbox = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
	col = mix(col, line_col.rgb, (1.0 - smoothstep(0.0, 0.03, abs(dbox))) * 0.8);
	// huy hiệu
	float em = ring(r, 2.32, 0.045) + ring(r, 2.1, 0.018) + ring(r, 1.58, 0.018);
	col = mix(col, trim.rgb, clamp(em, 0.0, 1.0) * 0.65);
	col = mix(col, mix(col, trim.rgb, 0.1), (1.0 - smoothstep(1.5, 1.6, r)));
	ALBEDO = col;
	ROUGHNESS = 0.55;
	SPECULAR = 0.4;
}
