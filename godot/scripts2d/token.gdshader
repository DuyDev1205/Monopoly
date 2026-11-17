shader_type canvas_item;
// Quân cờ: thêm viền mảnh quanh hình nhân vật cho nổi khỏi nền bàn cờ (kiểu hình dán).

uniform vec4 outline : source_color = vec4(0.23, 0.12, 0.25, 0.85);
uniform float width = 1.8;          // bề dày viền (px của ảnh)

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	vec2 px = TEXTURE_PIXEL_SIZE * width;
	float a = 0.0;
	for (int i = 0; i < 12; i++) {
		float an = float(i) * 0.5235988;
		a = max(a, texture(TEXTURE, UV + vec2(cos(an), sin(an)) * px).a);
	}
	float oa = a * outline.a;
	float outa = max(oa, c.a);
	vec3 rgb = mix(outline.rgb, c.rgb, c.a / max(outa, 0.001));
	COLOR = vec4(rgb, outa);
}
