shader_type canvas_item;
// Hoà màu vật thể (nhà, cổng, tiểu cảnh góc, kho báu…) vào ánh sáng của theme mà vẫn giữ độ tương phản trong trẻo.

uniform vec3 light : source_color = vec3(1.0);
uniform vec3 shade : source_color = vec3(0.72, 0.61, 0.88);
uniform float lift = 0.24;
uniform float sat = 1.02;

void fragment() {
	vec4 c = texture(TEXTURE, UV) * COLOR;
	vec3 g = c.rgb * light;
	float l0 = dot(g, vec3(0.299, 0.587, 0.114));
	float sh_mask = pow(clamp(1.0 - l0, 0.0, 1.0), 2.1);
	g = clamp(g + shade * (lift * 0.50 * sh_mask), 0.0, 1.0);
	float l = dot(g, vec3(0.299, 0.587, 0.114));
	g = clamp(mix(vec3(l), g, sat), 0.0, 1.0);
	COLOR = vec4(g, c.a);
}
