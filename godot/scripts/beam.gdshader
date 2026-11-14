// Cột sáng: ống trong suốt cộng sáng, đậm ở đáy, mờ dần lên trên, mép trong suốt.
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never;

uniform vec4 col : source_color = vec4(1.0, 0.84, 0.42, 1.0);
uniform float alpha = 1.0;

void fragment() {
	float v = 1.0 - UV.y;                          // 1 ở đáy
	float side = 1.0 - abs(dot(NORMAL, VIEW));     // mép ống sáng hơn
	float a = pow(v, 1.4) * (0.35 + 0.65 * (1.0 - side)) * alpha;
	ALBEDO = col.rgb * 2.0 * a;
	ALPHA = a;
}
