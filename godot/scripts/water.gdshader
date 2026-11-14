// Mặt nước suối / hồ: màu sâu theo độ trong, gợn sóng chạy theo dòng, phản chiếu bầu trời (fresnel), bọt mép bờ.
shader_type spatial;
render_mode cull_back, specular_schlick_ggx;

uniform vec4 deep : source_color = vec4(0.13, 0.45, 0.6, 1.0);
uniform vec4 shallow : source_color = vec4(0.45, 0.78, 0.82, 1.0);
uniform vec2 flow = vec2(0.25, 0.0);
uniform sampler2D noise : filter_linear_mipmap, repeat_enable;
uniform sampler2D depth_tex : hint_depth_texture, filter_linear_mipmap;

varying vec3 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = wpos.xz;
	float n1 = texture(noise, p * 0.18 + flow * TIME * 0.4).r;
	float n2 = texture(noise, p * 0.31 - flow.yx * TIME * 0.3 + 0.5).r;
	vec3 nrm = normalize(vec3((n1 - 0.5) * 0.5, 1.0, (n2 - 0.5) * 0.5));
	NORMAL = (VIEW_MATRIX * vec4(nrm, 0.0)).xyz;
	// độ sâu dưới mặt nước (so với đáy đã vẽ)
	float zd = texture(depth_tex, SCREEN_UV).r;
	vec4 ndc = vec4(SCREEN_UV * 2.0 - 1.0, zd, 1.0);
	vec4 vp = INV_PROJECTION_MATRIX * ndc;
	vp.xyz /= vp.w;
	float depth = clamp((VERTEX.z - vp.z) * 2.2, 0.0, 1.0);
	vec3 col = mix(shallow.rgb, deep.rgb, depth);
	float foam = (1.0 - smoothstep(0.0, 0.12, depth)) * (0.6 + 0.4 * n1);
	ALBEDO = mix(col, vec3(1.0), foam * 0.7);
	ROUGHNESS = 0.06;
	METALLIC = 0.0;
	SPECULAR = 0.7;
	ALPHA = mix(0.78, 0.95, depth);
}
