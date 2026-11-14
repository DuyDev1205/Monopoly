// Mặt ô đất: nền chuyển màu, dải màu nhóm ở mép xa (hoặc dải biển có sóng cho khu du lịch),
// viền màu chủ đất, khung sáng khi được chọn / đang tới, mờ đi khi không chọn được.
shader_type spatial;
render_mode cull_back;

uniform vec2 size = vec2(1.0, 1.45);       // kích thước thật (đơn vị thế giới)
uniform vec4 bg0 : source_color = vec4(1.0);
uniform vec4 bg1 : source_color = vec4(0.97, 0.94, 0.9, 1.0);
uniform vec4 band : source_color = vec4(0.0);
uniform float band_h = 0.145;              // tỉ lệ chiều sâu của dải màu
uniform int kind = 0;                      // 0 thường, 1 khu du lịch (dải biển)
uniform vec4 owned : source_color = vec4(0.0);   // a = 0: chưa có chủ
uniform vec4 frame_col : source_color = vec4(1.0, 0.82, 0.0, 1.0);
uniform float frame_a = 0.0;
uniform float dim = 0.0;
uniform float flash = 0.0;
uniform float radius = 0.06;
uniform float star = 0.0;                  // độc quyền nhóm

float rbox(vec2 p, vec2 b, float r) {
	vec2 q = abs(p) - b + r;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void fragment() {
	vec2 p = (UV - 0.5) * size;               // toạ độ thật, y dương = phía gần người xem
	float d = rbox(p, size * 0.5, radius);
	if (d > 0.0) discard;
	float g = clamp((UV.x * size.x + UV.y * size.y) / (size.x + size.y), 0.0, 1.0);
	vec3 col = mix(bg0.rgb, bg1.rgb, g);
	col = mix(col, owned.rgb, owned.a * 0.18);
	float bh = band_h;
	if (kind == 1) {
		bh = 0.25;
		if (UV.y < bh) {
			float t = UV.y / bh;
			vec3 sea = mix(vec3(0.16, 0.56, 0.78), vec3(0.56, 0.86, 0.96), t);
			float w = sin(UV.x * size.x * 26.0 + TIME * 1.6 + floor(UV.y * 9.0) * 1.7) * 0.012;
			float lines = (1.0 - smoothstep(0.0, 0.012, abs(fract((UV.y + w) * 9.0) - 0.5) * 0.11));
			col = mix(sea, vec3(1.0), lines * 0.55);
		} else if (UV.y < bh + 0.02) {
			col = vec3(1.0, 0.98, 0.94);
		}
	} else if (band.a > 0.0 && UV.y < bh) {
		col = mix(band.rgb, band.rgb * 0.82, UV.y / bh);
		// ngôi sao độc quyền
		vec2 c = vec2((UV.x - 0.5) * size.x, (UV.y - bh * 0.5) * size.y);
		float a = atan(c.y, c.x), r = length(c);
		float sr = 0.07 * (0.55 + 0.45 * cos(5.0 * a + 1.5708));
		col = mix(col, vec3(1.0), star * (1.0 - smoothstep(0.0, 0.004, r - sr)));
	}
	// viền chủ đất
	float edge = -d;
	col = mix(col, owned.rgb, owned.a * (1.0 - smoothstep(0.035, 0.045, edge)));
	// khung sáng
	float fr = (1.0 - smoothstep(0.04, 0.055, edge)) * smoothstep(0.0, 0.012, edge);
	col = mix(col, frame_col.rgb, fr * frame_a);
	col *= mix(1.0, 0.42, dim);
	col += flash * 0.25;
	ALBEDO = col * 0.9;
	ROUGHNESS = 0.62;
	SPECULAR = 0.35;
	EMISSION = frame_col.rgb * fr * frame_a * 0.9;
}
