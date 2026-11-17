shader_type canvas_item;
// Hoà màu vật thể (nhà, cổng, đế quân cờ, xúc xắc…) vào cảnh nền của theme:
// nhân với màu nắng của theme, rồi nâng vùng tối về phía màu bóng của theme (bóng không còn đen xám mà ngả tím / nâu / lam).

uniform vec3 light : source_color = vec3(1.0);
uniform vec3 shade : source_color = vec3(0.72, 0.61, 0.88);
uniform float lift = 0.25;
uniform float sat = 1.0;

void fragment() {
	vec4 c = texture(TEXTURE, UV) * COLOR;
	vec3 g = c.rgb * light;
	g = 1.0 - (1.0 - g) * (1.0 - shade * lift);
	float l = dot(g, vec3(0.299, 0.587, 0.114));
	g = mix(vec3(l), g, sat);
	COLOR = vec4(g, c.a);
}
