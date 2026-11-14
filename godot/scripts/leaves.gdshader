// Tán cây xù (stylized): mỗi instance là một "thẻ lá" luôn quay về camera, pháp tuyến lấy theo khối cầu của tán
// (ánh sáng mềm, tròn trịa), lá xuyên sáng, đung đưa theo gió, lõi tán tối hơn.
shader_type spatial;
render_mode world_vertex_coords, cull_disabled, diffuse_lambert_wrap, specular_schlick_ggx;

uniform sampler2D leaf_tex : source_color, filter_linear_mipmap;
uniform float wind = 1.0;
uniform float alpha_cut = 0.45;
uniform vec3 translucency = vec3(0.35, 0.45, 0.2);

varying float outer;

float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }

void vertex() {
	vec3 origin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float size = length(MODEL_MATRIX[0].xyz);
	// toạ độ góc của thẻ trong hệ toạ độ cục bộ (QuadMesh 1×1)
	vec2 c = (UV - 0.5) * vec2(1.0, -1.0);
	float a = hash(origin) * 6.2832;
	c = mat2(vec2(cos(a), sin(a)), vec2(-sin(a), cos(a))) * c;
	vec3 right = INV_VIEW_MATRIX[0].xyz;
	vec3 up = INV_VIEW_MATRIX[1].xyz;
	vec3 bn = INSTANCE_CUSTOM.rgb * 2.0 - 1.0;
	outer = INSTANCE_CUSTOM.a;
	// gió: lay theo nhiễu vị trí, lá ngoài rìa lay mạnh hơn
	float w = sin(TIME * 1.7 + origin.x * 0.9 + origin.z * 0.7) * 0.5 + sin(TIME * 3.1 + origin.y * 2.3) * 0.25;
	vec3 sway = vec3(w, 0.0, w * 0.6) * 0.035 * wind * (0.4 + outer);
	VERTEX = origin + (right * c.x + up * c.y) * size + sway;
	// pháp tuyến: khối cầu của tán, đẩy nhẹ về phía camera để mặt trước sáng đều
	NORMAL = normalize(bn + (INV_VIEW_MATRIX[2].xyz) * 0.25);
}

void fragment() {
	vec4 t = texture(leaf_tex, UV);
	if (t.a < alpha_cut) discard;
	float ao = mix(0.45, 1.0, outer);
	ALBEDO = COLOR.rgb * t.rgb * ao;
	ROUGHNESS = 0.82;
	SPECULAR = 0.25;
	BACKLIGHT = translucency * ao;
}
