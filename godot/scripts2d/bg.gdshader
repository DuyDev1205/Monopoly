shader_type canvas_item;
// Nền tranh vẽ toàn màn hình: trời + mây trôi + núi/đồi (3 ảnh từ tools/render_art.py, chân trời ở mép dưới ảnh),
// nửa dưới là mặt hồ gương: lật 3 lớp trên xuống, gợn sóng, nhoè dọc, lấp lánh dưới mặt trời, cánh hoa trôi.

uniform sampler2D sky_tex : source_color, filter_linear, repeat_disable;
uniform sampler2D cloud_tex : source_color, filter_linear, repeat_enable;
uniform sampler2D land_tex : source_color, filter_linear, repeat_enable;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec2 view_size = vec2(1600.0, 900.0);
uniform float horizon = 0.40;          // vị trí chân trời (phần chiều cao màn hình, tính từ trên)
uniform vec2 shift_px = vec2(0.0);     // xê dịch theo camera (px màn hình)
uniform float zoom = 1.0;
uniform float drift = 0.0;             // mây trôi (0..1 = một vòng ảnh)
uniform float wt = 0.0;                // thời gian cho sóng
uniform vec3 deep_col : source_color = vec3(0.42, 0.42, 0.78);
uniform vec3 tint_col : source_color = vec3(1.0);
uniform vec3 mist_col : source_color = vec3(1.0, 0.88, 0.88);
uniform vec3 glint_col : source_color = vec3(1.0, 0.95, 0.9);
uniform vec3 petal_col : source_color = vec3(1.0, 0.82, 0.88);
uniform float petal_amt = 0.5;
uniform float sun_u = 0.775;
uniform float glint = 1.0;
uniform bool lite = false;                  // máy yếu: bóng nước lấy 1 mẫu thay vì 5
uniform vec2 water_mix = vec2(0.10, 0.50);   // lượng màu nước pha vào bóng: xa → gần

const float TW = 2560.0;
const float SKH = 900.0;
const float LDH = 460.0;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

vec3 scene(float u, float y) {
	y = max(y, 0.5);
	float v = clamp(1.0 - y / SKH, 0.002, 0.998);
	vec3 c = textureLod(sky_tex, vec2(clamp(u, 0.001, 0.999), v), 0.0).rgb;
	vec4 cl = textureLod(cloud_tex, vec2(u + drift, v), 0.0);
	c = mix(c, cl.rgb, cl.a);
	vec4 ld = textureLod(land_tex, vec2(u, clamp(1.0 - y / LDH, 0.002, 0.998)), 0.0);
	c = mix(c, ld.rgb, ld.a * step(y, LDH - 1.0));
	return c;
}

float petal_layer(vec2 P, float seed, float amt) {
	vec2 id = floor(P);
	vec2 f = fract(P) - 0.5;
	float h = hash(id + seed);
	vec2 o = (vec2(hash(id + seed + 3.1), hash(id + seed + 7.7)) - 0.5) * 0.44;
	float ang = hash(id + seed + 1.3) * 6.283 + wt * 0.25 * (h - 0.5);
	vec2 g = f - o;
	g = vec2(g.x * cos(ang) - g.y * sin(ang), g.x * sin(ang) + g.y * cos(ang));
	float sz = mix(0.15, 0.27, hash(id + seed + 5.5));
	float e = length(g * vec2(1.0, 1.6)) / sz;
	float aa = clamp(length(fwidth(P)) / sz, 0.02, 1.0);
	return (1.0 - smoothstep(1.0 - aa, 1.0 + aa, e)) * step(h, amt);
}

void fragment() {
	vec2 px = UV * view_size - shift_px;
	float s = 0.92 * TW / view_size.x / zoom;            // px ảnh trên 1 px màn hình
	float hy = horizon * view_size.y;
	float u = 0.5 + (px.x - 0.5 * view_size.x) * s / TW;
	float y = (hy - px.y) * s;                           // số px ảnh phía trên chân trời
	vec3 sky = scene(u, y);

	// ---------- mặt hồ ----------
	float d = max(-y, 0.0);                              // px ảnh phía dưới chân trời
	float dn = clamp(d / (0.62 * view_size.y * s), 0.0, 1.0);
	// toạ độ trên mặt phẳng nước (phối cảnh: càng gần chân trời càng xa)
	float iz = 1.0 / (d + 16.0);
	vec2 P = vec2((px.x - 0.5 * view_size.x) * s * iz * 11.0, 13500.0 * iz);
	float n1 = texture(noise_tex, P * vec2(0.020, 0.115) + vec2(wt * 0.010, wt * 0.022)).r;
	float n2 = texture(noise_tex, P * vec2(0.047, 0.260) + vec2(-wt * 0.017, wt * 0.035)).r;
	float n3 = texture(noise_tex, P * vec2(0.008, 0.050) + vec2(wt * 0.004, -wt * 0.009)).r;
	float w = (n1 + n2 * 0.6 + n3 * 0.8) / 2.4 - 0.5;    // khoảng -0.5..0.5
	float du = w * mix(0.0006, 0.0070, dn);
	float dy = w * mix(2.0, 38.0, dn);
	float sm = mix(1.0, 13.0, dn);
	float yr = d * 0.97 + dy;
	vec3 r = scene(u + du, yr);
	if (!lite) {
		r = r * 0.34
			+ scene(u + du * 0.6, yr - sm) * 0.22
			+ scene(u + du * 1.3, yr + sm) * 0.22
			+ scene(u + du * 0.2, yr - sm * 2.2) * 0.11
			+ scene(u + du * 1.6, yr + sm * 2.2) * 0.11;
	}
	vec3 water = mix(r * tint_col, deep_col, mix(water_mix.x, water_mix.y, pow(dn, 0.8)));
	// vệt sáng tối theo sóng
	water *= 1.0 + w * mix(0.03, 0.11, dn);
	// lấp lánh: mạnh trong dải dưới mặt trời, lác đác ở nơi khác
	float sp = texture(noise_tex, P * vec2(0.11, 0.62) + vec2(wt * 0.05, -wt * 0.08)).r;
	float sp2 = texture(noise_tex, P * vec2(0.19, 0.95) - vec2(wt * 0.07, wt * 0.04)).r;
	float spark = pow(clamp(sp * sp2 * 2.9, 0.0, 1.0), 9.0);
	float su = (u - sun_u) / (0.020 + 0.085 * dn);
	float path = exp(-su * su) * (1.0 - 0.55 * dn);
	water += glint_col * spark * (path * 2.1 + 0.04) * glint * smoothstep(0.0, 30.0, d);
	water += glint_col * path * 0.07 * glint;
	// cánh hoa trôi trên mặt nước
	if (petal_amt > 0.001) {
		vec2 Pp = P * vec2(1.0, 1.0) + vec2(wt * 0.035 + w * 0.6, w * 0.4);
		float pt = petal_layer(Pp, 0.0, petal_amt) + petal_layer(Pp * 1.7 + 13.7, 9.0, petal_amt * 0.7);
		pt *= smoothstep(30.0, 150.0, d);
		water = mix(water, petal_col * (0.93 + 0.14 * hash(floor(Pp))), clamp(pt, 0.0, 1.0) * 0.92);
	}
	// sương sát chân trời
	water = mix(water, mist_col, exp(-d / 30.0) * 0.50);

	vec3 col = mix(sky, water, step(y, 0.0));
	col += (hash(FRAGCOORD.xy + fract(wt) * 61.0) - 0.5) / 255.0 * 1.6;   // dither chống sọc màu
	COLOR = vec4(col, 1.0);
}
