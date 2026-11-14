// Lá cờ bay: lượn sóng theo chiều ngang, mép gắn cột đứng yên.
shader_type spatial;
render_mode cull_disabled;

uniform sampler2D tex : source_color, filter_nearest;
uniform float phase = 0.0;

void vertex() {
	float x = UV.x;
	VERTEX.z += sin(TIME * 6.0 + x * 9.0 + phase) * 0.03 * x;
	VERTEX.y += sin(TIME * 4.0 + x * 6.0 + phase) * 0.008 * x;
}

void fragment() {
	ALBEDO = texture(tex, UV).rgb;
	ROUGHNESS = 0.8;
}
