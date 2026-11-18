// Mặt xúc xắc 3D cao cấp liền khối: bo tròn mép hoà liền vào thân xúc xắc (không lộ rìa),
// họa tiết 12 bộ + chấm lõm cầu 3D có pháp tuyến thật để bắt sáng bóng bẩy.
shader_type spatial;

uniform int n = 1;
uniform vec4 bg0 : source_color = vec4(1.0);
uniform vec4 bg1 : source_color = vec4(0.92, 0.89, 0.84, 1.0);
uniform vec4 pip0 : source_color = vec4(0.35, 0.35, 0.35, 1.0);
uniform vec4 pip1 : source_color = vec4(0.05, 0.05, 0.05, 1.0);
uniform vec4 red0 : source_color = vec4(1.0, 0.42, 0.42, 1.0);
uniform vec4 red1 : source_color = vec4(0.7, 0.07, 0.1, 1.0);
uniform vec4 ring_col : source_color = vec4(0.0);
uniform int deco = 0;       // 0 không, 1 vân gỗ, 2 ngọc bích, 3 pha lê, 4 đại dương, 5 kẹo ngọt, 6 thiên hà, 7 anh đào, 8 vũ trụ
uniform float glow = 0.0;
uniform float rough = 0.3;
uniform float metal = 0.0;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

float vnoise(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
	           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float rbox(vec2 p, vec2 b, float r) {
	vec2 q = abs(p) - b + r;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float seg_dist(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
	return length(pa - ba * h);
}

vec2 pip_pos(int k) {
	if (n == 1) return vec2(0.5);
	if (n == 2) return k == 0 ? vec2(0.26, 0.26) : vec2(0.74, 0.74);
	if (n == 3) return k == 0 ? vec2(0.25, 0.25) : (k == 1 ? vec2(0.5) : vec2(0.75, 0.75));
	if (n == 4) return vec2(k % 2 == 0 ? 0.27 : 0.73, k < 2 ? 0.27 : 0.73);
	if (n == 5) { if (k == 4) return vec2(0.5); return vec2(k % 2 == 0 ? 0.26 : 0.74, k < 2 ? 0.26 : 0.74); }
	return vec2(k % 2 == 0 ? 0.27 : 0.73, k < 2 ? 0.23 : (k < 4 ? 0.5 : 0.77));
}

void fragment() {
	vec2 uv = UV;
	// Bo tròn mặt phẳng và hoà màu rìa về đúng bg1 (màu thân xúc xắc) để liền một khối không vết ghép
	float db = rbox(uv - vec2(0.5), vec2(0.495), 0.11);
	if (db > 0.0) discard;
	float inner_fade = smoothstep(0.0, 0.075, -db);

	vec3 col = mix(bg0.rgb, bg1.rgb, smoothstep(0.0, 0.78, length(uv - vec2(0.32, 0.28))));
	float rgh = rough;
	float mtl = metal;
	vec3 em = vec3(0.0);
	vec3 nrm_ts = vec3(0.0, 0.0, 1.0);

	// Họa tiết bề mặt từng bộ xúc xắc (mờ dần ở sát mép vát để liền khối)
	vec3 pat = col;
	if (deco == 1) {
		float gr = sin(uv.y * 64.0 + vnoise(uv * 7.5) * 5.2);
		pat *= 0.89 + 0.11 * gr;
	} else if (deco == 2) {
		float vn = vnoise(uv * 6.0 + vec2(vnoise(uv * 12.0) * 1.3));
		pat = mix(pat, vec3(0.92, 1.0, 0.96), smoothstep(0.56, 0.86, vn) * 0.42);
		float vein = 1.0 - smoothstep(0.0, 0.028, abs(vn - 0.52));
		pat = mix(pat, vec3(1.0, 0.96, 0.82), vein * 0.30);
	} else if (deco == 3) {
		vec2 p = abs(uv - 0.5);
		float d1 = abs(p.x + p.y - 0.40);
		float d2 = min(abs(uv.x - uv.y), abs(uv.x + uv.y - 1.0));
		float facet = max(1.0 - smoothstep(0.003, 0.015, d1), (1.0 - smoothstep(0.003, 0.014, d2)) * 0.65);
		pat = mix(pat, vec3(1.0), facet * 0.52);
	} else if (deco == 4) {
		for (int w = 0; w < 3; w++) {
			float wy = 0.25 + float(w) * 0.25 + sin(uv.x * 14.0 + float(w) * 2.1) * 0.032;
			float crest = 1.0 - smoothstep(0.005, 0.022, abs(uv.y - wy));
			pat = mix(pat, vec3(0.95, 0.99, 1.0), crest * 0.36);
		}
	} else if (deco == 5) {
		float st = smoothstep(-0.05, 0.05, sin((uv.x + uv.y) * 32.0));
		pat = mix(pat, vec3(1.0, 0.72, 0.86), st * 0.45);
	} else if (deco == 6) {
		float n1 = vnoise(uv * 4.2 + 1.7);
		float n2 = vnoise(uv * 7.8 + 5.3);
		float neb = n1 * 0.65 + n2 * 0.35;
		pat += vec3(0.58, 0.16, 0.75) * smoothstep(0.32, 0.82, neb) * 0.48;
		pat += vec3(0.12, 0.52, 0.92) * smoothstep(0.42, 0.88, vnoise(uv * 5.0 + 9.1)) * 0.34;
		vec2 cell = floor(uv * 19.0);
		vec2 rnd = vec2(hash(cell), hash(cell + 17.3));
		float star = step(0.84, hash(cell + 3.1)) * (1.0 - smoothstep(0.02, 0.14, length(fract(uv * 19.0) - (0.2 + rnd * 0.6))));
		pat += vec3(1.0, 0.96, 1.0) * star * 0.95;
		em += vec3(0.85, 0.65, 1.0) * star * 0.55 * inner_fade;
	} else if (deco == 7) {
		vec2 cp = uv - vec2(0.79, 0.21);
		float cr = length(cp);
		float ca = atan(cp.y, cp.x);
		float pet = 0.11 * (0.65 + 0.35 * abs(cos(2.5 * ca)));
		pat = mix(pat, vec3(1.0, 0.74, 0.85), (1.0 - smoothstep(pet - 0.01, pet + 0.01, cr)) * 0.45);
	} else if (deco == 8) {
		// Thiên hà xoắn ốc + tinh vân sắc màu chuyển động + bầu trời sao nhấp nháy
		vec2 gp = uv - vec2(0.5);
		float gr = length(gp);
		float ga = atan(gp.y, gp.x) - TIME * 0.55 - gr * 7.2;
		float arm = pow(0.5 + 0.5 * cos(ga * 2.0 + vnoise(uv * 5.2 + TIME * 0.08) * 1.4), 1.8);
		float core_g = exp(-gr * 5.2);
		float neb_w = vnoise(vec2(uv.x * 5.8 - TIME * 0.06, uv.y * 5.8 + TIME * 0.04));
		pat = mix(bg1.rgb, vec3(0.45, 0.04, 0.72), neb_w * 0.55);
		pat += vec3(0.0, 0.90, 1.0) * arm * smoothstep(0.50, 0.08, gr) * 0.65;
		pat += vec3(0.97, 0.15, 0.52) * smoothstep(0.38, 0.86, neb_w) * smoothstep(0.55, 0.12, gr) * 0.45;
		pat += vec3(1.0, 0.82, 0.40) * core_g * 0.45;

		vec2 c1 = floor(uv * 16.0);
		vec2 r1 = vec2(hash(c1), hash(c1 + 11.7));
		float tw1 = 0.55 + 0.45 * sin(TIME * 3.8 + hash(c1 + 4.3) * 6.283);
		float st1 = step(0.76, hash(c1 + 2.9)) * (1.0 - smoothstep(0.02, 0.15, length(fract(uv * 16.0) - (0.2 + r1 * 0.6)))) * tw1;

		vec2 c2 = floor(uv * 27.0 + 3.4);
		vec2 r2 = vec2(hash(c2), hash(c2 + 19.1));
		float tw2 = 0.55 + 0.45 * sin(TIME * 5.1 + hash(c2 + 9.2) * 6.283);
		float st2 = step(0.84, hash(c2 + 5.7)) * (1.0 - smoothstep(0.015, 0.12, length(fract(uv * 27.0 + 3.4) - (0.2 + r2 * 0.6)))) * tw2;

		pat += vec3(0.85, 0.97, 1.0) * st1 * 0.95 + vec3(1.0, 0.84, 0.96) * st2 * 0.85;
		em += (vec3(0.0, 0.72, 0.95) * arm * 0.30 + vec3(0.85, 0.25, 0.68) * smoothstep(0.52, 0.90, neb_w) * 0.22 + vec3(1.0, 0.85, 0.45) * core_g * 0.28) * inner_fade;
		em += (vec3(0.75, 0.95, 1.0) * st1 * 0.75 + vec3(1.0, 0.75, 0.98) * st2 * 0.65) * inner_fade;
	}
	col = mix(bg1.rgb, pat, inner_fade);

	// Khung viền bo góc kim loại / neon nằm gọn bên trong mặt phẳng
	float dr = rbox(uv - vec2(0.5), vec2(0.435), 0.085);
	if (ring_col.a > 0.0) {
		float ring_m = (1.0 - smoothstep(0.004, 0.016, abs(dr)));
		col = mix(col, ring_col.rgb, ring_m * 0.92);
		mtl = mix(mtl, 0.88, ring_m);
		rgh = mix(rgh, 0.18, ring_m);
	}
	if (glow > 0.2) {
		float neon_fr = 1.0 - smoothstep(0.003, 0.015, abs(dr));
		vec3 rcol = pip1.rgb;
		if (deco == 8) {
			vec2 rgp = uv - vec2(0.5);
			float phase = 0.5 + 0.5 * sin(atan(rgp.y, rgp.x) * 3.0 - TIME * 2.5);
			rcol = mix(vec3(0.18, 0.94, 1.0), vec3(1.0, 0.35, 0.85), phase);
			rcol = mix(rcol, vec3(1.0, 0.86, 0.42), pow(phase, 3.0) * 0.65);
		}
		col = mix(col, rcol, neon_fr * (deco == 8 ? 0.82 : 0.70));
		em += rcol * neon_fr * glow * (deco == 8 ? 0.75 : 0.60);
	}

	// Chấm (pips) lõm cầu 3D có pháp tuyến & đốm sáng phản quang
	bool red = n == 1 || n == 4;
	vec3 c0 = red ? red0.rgb : pip0.rgb;
	vec3 c1 = red ? red1.rgb : pip1.rgb;

	if (deco == 7 && n == 1) {
		vec2 p = uv - 0.5;
		float a = atan(p.y, p.x), r = length(p);
		float petal = 0.285 * (0.62 + 0.38 * abs(cos(2.5 * a))) - 0.022 * smoothstep(0.84, 1.0, abs(cos(2.5 * a)));
		float m = 1.0 - smoothstep(petal - 0.008, petal + 0.008, r);
		vec3 fcol = mix(c1, c0, clamp(r / 0.285, 0.0, 1.0));
		col = mix(col, fcol, m);
		float ctr = 1.0 - smoothstep(0.048, 0.060, r);
		col = mix(col, vec3(1.0, 0.84, 0.35), ctr);
		if (m > 0.01) {
			vec2 g2 = -p / max(petal, 0.05) * 0.45;
			nrm_ts = normalize(vec3(g2.x, g2.y, 1.0));
			rgh = mix(rgh, 0.20, m);
		}
	} else if (deco == 8 && n == 1) {
		// Mặt 1 vũ trụ: tinh cầu siêu tân tinh có vành đai 3D nghiêng + tia 4 cánh chói lọi
		vec2 p = uv - vec2(0.5);
		float ca = 0.92866, sa = -0.37092;
		vec2 rp = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
		float re = length(vec2(rp.x, rp.y * 2.5));
		float ring_m = smoothstep(0.19, 0.205, re) * (1.0 - smoothstep(0.29, 0.305, re));
		ring_m *= 1.0 - 0.65 * exp(-pow((re - 0.245) / 0.012, 2.0));
		vec3 ring_c = mix(vec3(0.22, 0.96, 1.0), vec3(1.0, 0.84, 0.42), smoothstep(0.20, 0.29, re));
		float back_m = ring_m * step(rp.y, 0.0);
		col = mix(col, ring_c * 0.85, back_m * 0.88);
		em += ring_c * back_m * 0.95;

		float ds = length(p);
		float sm = 1.0 - smoothstep(0.118, 0.128, ds);
		if (sm > 0.001) {
			vec2 u2 = p / 0.125;
			float r2 = min(dot(u2, u2), 0.98);
			vec3 sph_n = normalize(vec3(u2.x * 0.72, -u2.y * 0.72, sqrt(1.0 - r2 * 0.52)));
			nrm_ts = mix(nrm_ts, sph_n, sm);
			vec3 sc = mix(vec3(0.95, 0.35, 0.88), vec3(1.0, 0.88, 0.42), 1.0 - clamp(ds / 0.125, 0.0, 1.0));
			sc = mix(sc, vec3(1.0, 0.99, 0.95), exp(-ds * 18.0));
			col = mix(col, sc, sm);
			em += sc * sm * 1.35;
			rgh = mix(rgh, 0.08, sm);
		}
		float front_m = ring_m * step(0.0, rp.y);
		col = mix(col, ring_c, front_m * 0.94);
		em += ring_c * front_m * 1.15;

		float flare4 = exp(-abs(p.x) * 44.0) * exp(-abs(p.y) * 9.0) + exp(-abs(p.y) * 44.0) * exp(-abs(p.x) * 9.0);
		float flare_r = flare4 * (0.85 + 0.15 * sin(TIME * 4.5));
		col += vec3(0.95, 0.98, 1.0) * flare_r * 0.55;
		em += mix(vec3(0.35, 0.95, 1.0), vec3(1.0, 0.88, 0.48), 0.45) * flare_r * 1.10;
	} else {
		float R = n == 1 ? 0.145 : 0.095;
		if (n == 1 && glow < 0.2) {
			float d1 = length(uv - vec2(0.5));
			float halo = smoothstep(R + 0.018, R + 0.026, d1) * (1.0 - smoothstep(R + 0.038, R + 0.046, d1));
			col = mix(col, mix(c1, vec3(0.88, 0.68, 0.24), 0.55), halo * 0.55);
		}
		if (deco == 8) {
			for (int k = 0; k < n - 1; k++) {
				float ld = seg_dist(uv, pip_pos(k), pip_pos(k + 1));
				float line_m = 1.0 - smoothstep(0.004, 0.015, ld);
				vec3 lcol = red ? vec3(1.0, 0.82, 0.48) : vec3(0.28, 0.92, 1.0);
				col = mix(col, lcol, line_m * 0.55);
				em += lcol * line_m * 0.85;
			}
		}
		for (int k = 0; k < n; k++) {
			vec2 c = pip_pos(k);
			vec2 dp = uv - c;
			float d = length(dp);
			float m = 1.0 - smoothstep(R - 0.007, R + 0.006, d);
			if (m > 0.001) {
				vec2 u2 = dp / R;
				float r2 = min(dot(u2, u2), 0.98);
				vec3 concave = normalize(vec3(-u2.x * 0.72, u2.y * 0.72, sqrt(1.0 - r2 * 0.52)));
				nrm_ts = mix(nrm_ts, concave, m);
				float spec_bias = clamp(dot(u2, normalize(vec2(0.55, 0.65))) * 0.5 + 0.5, 0.0, 1.0);
				vec3 pc = mix(c1 * 0.82, c0, pow(spec_bias, 1.5) * 0.86);
				float glint = 1.0 - smoothstep(0.08, 0.28, length(u2 - vec2(0.32, 0.34)));
				pc = mix(pc, mix(c0, vec3(1.0), 0.68), glint * 0.55);
				col = mix(col, pc, m);
				rgh = mix(rgh, 0.15, m);
				mtl = mix(mtl, max(mtl, 0.15), m);
			}
			float lip = smoothstep(R - 0.008, R + 0.004, d) * (1.0 - smoothstep(R + 0.006, R + 0.022, d));
			col *= 1.0 - lip * 0.08;
			em += c0 * glow * (m * 0.90 + (1.0 - smoothstep(R, R * 1.95, d)) * 0.38);
			if (deco == 8) {
				float p_fl = (exp(-abs(dp.x) * 62.0) * exp(-abs(dp.y) * 14.0) + exp(-abs(dp.y) * 62.0) * exp(-abs(dp.x) * 14.0)) * (0.8 + 0.2 * sin(TIME * 4.2 + float(k) * 1.3));
				em += c0 * p_fl * 0.85;
			}
		}
	}

	ALBEDO = clamp(col, 0.0, 1.0);
	ROUGHNESS = rgh;
	METALLIC = mtl;
	SPECULAR = 0.62;
	NORMAL_MAP = nrm_ts * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 1.0;
	EMISSION = em * 1.4;
}
