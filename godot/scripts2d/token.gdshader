shader_type canvas_item;
// Quân cờ: hoà màu theo theme (giống grade.gdshader) + viền mảnh quanh hình nhân vật cho nổi khỏi nền bàn cờ.

uniform vec3 light : source_color = vec3(1.0);
uniform vec3 shade : source_color = vec3(0.72, 0.61, 0.88);
uniform float lift = 0.25;
uniform float sat = 1.0;
uniform vec4 outline : source_color = vec4(0.35, 0.22, 0.45, 0.7);
uniform float width = 1.8;          // bề dày viền (px của ảnh)

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	vec3 g = c.rgb * light;
	g = 1.0 - (1.0 - g) * (1.0 - shade * lift);
	float l = dot(g, vec3(0.299, 0.587, 0.114));
	g = mix(vec3(l), g, sat);
	vec2 px = TEXTURE_PIXEL_SIZE * width;
	float a = 0.0;
	for (int i = 0; i < 12; i++) {
		float an = float(i) * 0.5235988;
		a = max(a, texture(TEXTURE, UV + vec2(cos(an), sin(an)) * px).a);
	}
	float oa = a * outline.a;
	float outa = max(oa, c.a);
	vec3 rgb = mix(outline.rgb, g, c.a / max(outa, 0.001));
	COLOR = vec4(rgb, outa);
}
