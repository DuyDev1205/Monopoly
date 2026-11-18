shader_type canvas_item;
render_mode blend_premul_alpha;
// Quân cờ Monopoly 3D thời gian thực từ SubViewport trong suốt (premultiplied alpha):
// 1) Giải nhân alpha an toàn cho thân 3D PBR, giữ trọn ánh kim vàng / crôm / men sứ sắc nét.
// 2) Pha flash_col tức thời khi ăn mừng (vàng) hoặc mất tiền (đỏ).
// 3) Viền sáng mỏng 16 hướng theo Porter-Duff source-over giúp quân cờ tách bạch trên cả 4 theme.

uniform vec4 outline : source_color = vec4(1.0, 0.98, 0.99, 0.86);
uniform float width = 1.6;
uniform vec4 flash_col : source_color = vec4(1.0, 0.92, 0.65, 0.0);

float sample_a(sampler2D tex, vec2 uv) {
	if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
	return texture(tex, uv).a;
}

void fragment() {
	vec4 raw = texture(TEXTURE, UV);
	float body_a = clamp(raw.a, 0.0, 1.0);
	vec3 body_rgb = body_a > 0.004 ? clamp(raw.rgb / body_a, 0.0, 1.0) : vec3(0.0);
	body_rgb = mix(body_rgb, flash_col.rgb, flash_col.a);

	vec2 px = TEXTURE_PIXEL_SIZE * width;
	float a_out = 0.0;
	for (int i = 0; i < 16; i++) {
		float an = float(i) * 0.3926991;
		vec2 dir = vec2(cos(an), sin(an));
		a_out = max(a_out, sample_a(TEXTURE, UV + dir * px));
		a_out = max(a_out, sample_a(TEXTURE, UV + dir * px * 0.55));
	}
	float oa = smoothstep(0.08, 0.52, a_out) * outline.a;

	vec3 body_pre = body_rgb * body_a;
	vec3 out_pre = outline.rgb * oa;
	vec3 final_pre = body_pre + out_pre * (1.0 - body_a);
	float final_a = body_a + oa * (1.0 - body_a);
	COLOR = vec4(final_pre * COLOR.rgb, final_a) * COLOR.a;
}
