// Cây / cành đung đưa theo gió: phần trên lắc nhiều, gốc đứng yên. Bản phản chiếu dưới nước: lật, mờ, gợn.
shader_type canvas_item;
render_mode blend_premul_alpha;

uniform float amp = 6.0;          // biên độ (px) ở ngọn
uniform float phase = 0.0;
uniform float speed = 1.0;
uniform bool reflection = false;
uniform float root_v = 1.0;        // UV.y của gốc (1 = đáy ảnh)

void vertex() {
	float h = clamp(root_v - UV.y, 0.0, 1.0);
	float w = sin(TIME * 1.3 * speed + phase) * 0.7 + sin(TIME * 2.9 * speed + phase * 1.7) * 0.3;
	VERTEX.x += w * amp * h * h * (reflection ? -1.0 : 1.0);
}

void fragment() {
	vec2 uv = UV;
	if (reflection) {
		uv.x += sin(uv.y * 60.0 + TIME * 2.0) * 0.004;
	}
	vec4 c = texture(TEXTURE, uv);
	// mờ dần sát mép ảnh (không lộ khung chữ nhật)
	vec2 e = min(uv, 1.0 - uv);
	float fade = smoothstep(0.0, 0.06, e.x) * smoothstep(0.0, 0.05, e.y);
	float k = fade * COLOR.a;
	if (reflection) {
		c.rgb = mix(c.rgb, vec3(0.75, 0.75, 0.95) * c.a, 0.35);
		k *= 0.35 * smoothstep(0.0, 0.6, uv.y);
	}
	COLOR = vec4(c.rgb * COLOR.rgb * k, c.a * k);
}
