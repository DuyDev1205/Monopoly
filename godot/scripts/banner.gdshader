// Băng rôn FESTIVAL: nền xanh chuyển màu, viền vàng, cong nhẹ.
shader_type spatial;
render_mode cull_disabled;

void vertex() {
	float x = VERTEX.x / 0.49;
	VERTEX.y += 0.08 * cos(x * 1.5708);
	VERTEX.z += 0.03 * cos(x * 1.5708);
}

void fragment() {
	vec3 col = mix(vec3(0.25, 0.83, 0.49), vec3(0.07, 0.48, 0.24), UV.y);
	vec2 q = abs(UV - 0.5) * vec2(1.0, 1.0);
	float edge = max(q.x * 1.0, q.y * 1.0);
	col = mix(col, vec3(1.0, 0.82, 0.25), step(0.455, max(q.x, q.y * 0.94)));
	ALBEDO = col;
	ROUGHNESS = 0.5;
}
