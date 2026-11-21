# Vẽ tranh nền cho bản app 2D (kiểu tranh phong cảnh anime: trời chuyển màu, mây cuộn, núi mờ sương, đồi hoa xa).
# Chạy:  python app/tools/render_art.py [theme ...] [--preview=thư_mục]
# Cần:   Pillow, numpy, scipy
# Xuất vào app/skin/art/ ba lớp cho mỗi theme (đường chân trời nằm ở MÉP DƯỚI ảnh):
#   <theme>_sky.png     trời + mặt trời / trăng sao (đặc)
#   <theme>_clouds.png  mây (trong suốt, nối liền theo chiều ngang để trôi)
#   <theme>_land.png    núi xa + đồi cây ven hồ (trong suốt)
# Mặt hồ không vẽ sẵn: shader skin/scene3d.js (shader mặt hồ) lật 3 lớp trên xuống làm bóng nước, có gợn sóng.
import os, sys, math
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "skin", "art"))

W, H = 2560, 900       # trời / mây
LH = 460               # đất liền (núi, đồi)
F = np.float32


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], F) / 255.0


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0 + 1e-9), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return a + (b - a) * t


def _gauss1d(a, s, axis, wrap=False):
    if s <= 0.05:
        return np.asarray(a, F)
    arr = np.asarray(a, F)
    L = arr.shape[axis]
    if wrap:
        freq = np.fft.rfftfreq(L).astype(F)
        kern = np.exp(-2.0 * (np.pi * s * freq) ** 2).astype(F)
        sh = [1] * arr.ndim
        sh[axis] = len(kern)
        return np.fft.irfft(np.fft.rfft(arr, axis=axis) * kern.reshape(sh), n=L, axis=axis).astype(F)
    p = min(L - 1, max(12, int(math.ceil(s * 3.5))))
    pad_w = [(0, 0)] * arr.ndim
    pad_w[axis] = (p, p)
    padded = np.pad(arr, pad_w, mode="edge")
    Lp = L + 2 * p
    freq = np.fft.rfftfreq(Lp).astype(F)
    kern = np.exp(-2.0 * (np.pi * s * freq) ** 2).astype(F)
    sh = [1] * arr.ndim
    sh[axis] = len(kern)
    res = np.fft.irfft(np.fft.rfft(padded, axis=axis) * kern.reshape(sh), n=Lp, axis=axis).astype(F)
    sl = [slice(None)] * arr.ndim
    sl[axis] = slice(p, p + L)
    return res[tuple(sl)]


def blur_aniso(a, sig_yx, wrap_x=False):
    sy, sx = (sig_yx[0], sig_yx[1]) if isinstance(sig_yx, (tuple, list)) else (sig_yx, sig_yx)
    out = _gauss1d(a, float(sy), axis=0, wrap=False)
    return _gauss1d(out, float(sx), axis=1, wrap=wrap_x)


def blur(a, s, wrap_x=False):
    return blur_aniso(a, (s, s), wrap_x=wrap_x)


def ramp(t, stops):
    t = np.asarray(t, F)
    pos = [s[0] for s in stops]
    out = np.empty(t.shape + (3,), F)
    for c in range(3):
        out[..., c] = np.interp(t, pos, [s[1][c] for s in stops])
    return out


def spectral(w, h, beta, seed, sx=1.0, sy=1.0):
    """Nhiễu fractal (phổ 1/f^beta), nối liền cả 2 chiều, chuẩn hoá 0..1."""
    rng = np.random.default_rng(seed)
    fy = (np.fft.fftfreq(h) * h)[:, None]
    fx = (np.fft.rfftfreq(w) * w)[None, :]
    f = np.sqrt((fx * sx) ** 2 + (fy * sy) ** 2)
    f[0, 0] = 1.0
    amp = 1.0 / f ** beta
    amp[0, 0] = 0.0
    ph = rng.random((h, w // 2 + 1)) * 2 * np.pi
    n = np.fft.irfft2(amp * np.exp(1j * ph), s=(h, w)).astype(F)
    lo, hi = np.percentile(n, [0.5, 99.5])
    return np.clip((n - lo) / (hi - lo), 0, 1)


def ridge1d(n, beta, seed, lo=2):
    rng = np.random.default_rng(seed)
    f = np.fft.rfftfreq(n) * n
    amp = np.where(f >= lo, 1.0 / np.maximum(f, 1) ** beta, 0.0)
    ph = rng.random(len(f)) * 2 * np.pi
    r = np.fft.irfft(amp * np.exp(1j * ph), n).astype(F)
    return (r - r.min()) / (r.max() - r.min())


def over(dst, rgb, a):
    """Phủ lớp (rgb thẳng, alpha a) lên dst RGBA đã nhân alpha."""
    a = a[..., None]
    dst[..., :3] = rgb * a + dst[..., :3] * (1 - a)
    dst[..., 3:] = a + dst[..., 3:] * (1 - a)


def save_rgb(img, path):
    rng = np.random.default_rng(1)
    v = np.clip(img, 0, 1) * 255.0 + rng.uniform(-0.5, 0.5, img.shape).astype(F)   # dither chống sọc màu
    Image.fromarray(np.clip(np.rint(v), 0, 255).astype(np.uint8), "RGB").save(path, optimize=True)


def save_rgba(pm, path, wrap_x=False):
    """pm: RGBA đã nhân alpha. Lưu alpha thẳng, loang màu ra vùng trong suốt để không viền tối."""
    a = np.clip(pm[..., 3], 0, 1)
    fill = blur(pm[..., :3], 5, wrap_x) / np.maximum(blur(a, 5, wrap_x), 1e-4)[..., None]
    rgb = np.where(a[..., None] > 0.02, pm[..., :3] / np.maximum(a, 1e-4)[..., None], fill)
    rng = np.random.default_rng(2)
    v = np.clip(np.dstack([rgb, a]), 0, 1) * 255.0
    v[..., :3] += rng.uniform(-0.5, 0.5, rgb.shape).astype(F)
    Image.fromarray(np.clip(np.rint(v), 0, 255).astype(np.uint8), "RGBA").save(path, optimize=True)


# ============================== TRỜI ==============================

def paint_sky(T, seed):
    ya = (H - 1 - np.arange(H, dtype=F)) + 0.5            # số px phía trên chân trời
    st = sorted(T["sky"])
    pos = [s[0] for s in st]
    cols = [hexc(s[1]) for s in st]
    col = np.stack([np.interp(ya, pos, [c[k] for c in cols]) for k in range(3)], -1).astype(F)
    img = np.repeat(col[:, None, :], W, 1)
    yy, xx = np.mgrid[0:H, 0:W].astype(F)
    YA = H - yy
    S = T["sun"]
    sx, sy = S["x"] * W, H - S["y"]
    d = np.hypot(xx - sx, yy - sy)
    # loang màu nước rất nhẹ
    img += (spectral(W, H, 2.6, seed)[..., None] - 0.5) * T.get("wash", 0.03)
    if T.get("stars"):
        rng = np.random.default_rng(seed + 5)
        # dải ngân hà chéo
        u = ((xx - W * 0.5) * 0.42 + (yy - H * 0.42)) / 190.0
        band = np.exp(-u * u) * (0.35 + 0.65 * spectral(W, H, 2.0, seed + 9) ** 1.5)
        band *= smooth(40, 380, YA)
        img += band[..., None] * hexc(T["milky"]) * 0.30
        n = T["stars"]
        px = rng.integers(0, W, n)
        py = rng.integers(0, H, n)
        br = rng.random(n) ** 3.2
        # sao dày hơn trong dải ngân hà
        keep = rng.random(n) < (0.45 + 0.55 * np.clip(band[py, px] * 2.2, 0, 1))
        px, py, br = px[keep], py[keep], br[keep]
        small = np.zeros((H, W), F)
        big = np.zeros((H, W), F)
        np.add.at(small, (py, px), 0.35 + br * 1.2)
        sel = br > 0.55
        np.add.at(big, (py[sel], px[sel]), br[sel])
        stars = blur(small, 0.75) * 1.9 + blur(big, 1.7) * 7.0 + blur(big, 5.0) * 16.0
        stars *= smooth(10, 260, YA) * (1 - np.exp(-(d / (S["r"] * 5.0)) ** 2) * 0.9)
        tint = mix(hexc("#ffffff"), hexc(T["milky"]), rng.random((1, 1, 1)).astype(F) * 0 + 0.25)
        img += np.clip(stars, 0, 1.4)[..., None] * tint
        if T.get("cosmos"):
            # Tinh vân sắc màu đa tầng (lục lam, hồng tím, hoàng kim) uốn lượn dọc nền trời đêm
            neb1 = spectral(W, H, 2.05, seed + 19, sx=1.1, sy=1.4)
            neb2 = spectral(W, H, 1.95, seed + 23, sx=1.5, sy=0.95)
            neb3 = spectral(W, H, 2.2, seed + 31, sx=0.8, sy=1.2)
            v_fade = smooth(18, 340, YA) * (0.45 + 0.55 * band)
            diag = np.exp(-((((xx - W * 0.48) * 0.36 + (yy - H * 0.45)) / 240.0) ** 2))
            cyan_m = smooth(0.45, 0.86, neb1) * (0.35 + 0.65 * diag) * v_fade
            mag_m = smooth(0.46, 0.88, neb2) * (0.30 + 0.70 * diag) * v_fade
            vio_m = smooth(0.38, 0.82, neb3) * v_fade
            gold_m = np.clip((neb1 * neb2 - 0.26) * 3.0, 0.0, 1.0) * diag * v_fade
            img += cyan_m[..., None] * hexc("#14e8ff") * 0.34
            img += mag_m[..., None] * hexc("#ff3ca8") * 0.28
            img += vio_m[..., None] * hexc("#7c3aed") * 0.24
            img += gold_m[..., None] * hexc("#ffd166") * 0.22
            # Khoảng 28 ngôi sao rực rỡ có 4 tia nhiễu xạ sắc nét
            hrng = np.random.default_rng(seed + 41)
            for si in range(28):
                hx = int(hrng.integers(80, W - 80))
                hy = int(hrng.integers(45, H - 90))
                if math.hypot(hx - sx, hy - sy) < S["r"] * 2.1:
                    continue
                sp_r = 28
                y0, y1 = max(0, hy - sp_r), min(H, hy + sp_r + 1)
                x0, x1 = max(0, hx - sp_r), min(W, hx + sp_r + 1)
                dy_p = (np.arange(y0, y1, dtype=F) - hy)[:, None]
                dx_p = (np.arange(x0, x1, dtype=F) - hx)[None, :]
                scol = hexc(["#ffffff", "#8ef7ff", "#ffb8ef", "#ffe69a"][si % 4])
                flare = (
                    np.exp(-(dx_p * dx_p + dy_p * dy_p) / 7.5) * 0.95
                    + (np.exp(-np.abs(dx_p) / 1.15) * np.exp(-np.abs(dy_p) / 14.0)
                       + np.exp(-np.abs(dy_p) / 1.15) * np.exp(-np.abs(dx_p) / 14.0)) * 0.72
                ) * hrng.uniform(0.7, 1.15)
                img[y0:y1, x0:x1] += flare[..., None] * scol
    # quầng sáng mặt trời / trăng / hành tinh (blend screen)
    g = S["amt"] * (0.60 * np.exp(-(d / 70) ** 2) + 0.34 * np.exp(-(d / 210) ** 2)
                    + 0.22 * np.exp(-(d / 560) ** 2) + 0.12 * np.exp(-(d / 1200) ** 2))
    g += S["amt"] * 0.22 * np.exp(-((xx - sx) / 1000) ** 2) * np.exp(-YA / 130)      # hừng sáng sát chân trời
    gc = hexc(S["glow"])
    img = 1 - (1 - np.clip(img, 0, 1)) * (1 - np.clip(g, 0, 1)[..., None] * gc)
    r = S["r"]
    if T.get("cosmos"):
        # Hành tinh khí khổng lồ có vành đai nghiêng 3D + mặt trăng băng phụ
        dx = xx - sx
        dy = yy - sy
        ang = -0.34
        ca, sa = math.cos(ang), math.sin(ang)
        rx = dx * ca + dy * sa
        ry = -dx * sa + dy * ca
        rr = np.hypot(rx, ry * 2.85) / r
        ring_band = smooth(1.26, 1.32, rr) * (1.0 - smooth(2.34, 2.40, rr))
        cassini = 1.0 - 0.85 * np.exp(-((rr - 1.82) / 0.045) ** 2)
        ring_tex = 0.75 + 0.25 * np.sin(rr * 36.0)
        ring_a = np.clip(ring_band * cassini * ring_tex * 0.82, 0.0, 1.0)
        rt = np.clip((rr - 1.26) / 1.14, 0.0, 1.0)
        ring_rgb = ramp(rt, [(0.0, hexc("#9bf8ff")), (0.45, hexc("#ffd6a5")), (1.0, hexc("#c4b5fd"))])
        back_sh = 1.0 - 0.72 * smooth(0.25 * r, 0.90 * r, rx) * (ry < 0)
        back_a = (ring_a * (ry < 0))[..., None]
        img = mix(img, np.clip(ring_rgb * back_sh[..., None], 0, 1), back_a)

        # Thân cầu hành tinh có vân mây vĩ độ & quầng khí quyển phía sáng
        px = np.clip(dx / r, -1.0, 1.0)
        py = np.clip(dy / r, -1.0, 1.0)
        pz = np.sqrt(np.maximum(0.0, 1.0 - px * px - py * py))
        L_pl = np.array([-0.55, -0.48, 0.68], F)
        L_pl /= np.linalg.norm(L_pl)
        nl = np.clip(px * L_pl[0] + py * L_pl[1] + pz * L_pl[2], 0.0, 1.0)
        lat = ry / r + 0.08 * (spectral(W, H, 2.0, seed + 51, sx=1.8, sy=1.0) - 0.5)
        bt = np.clip(0.5 + 0.48 * np.sin(lat * 11.5), 0.0, 1.0)
        p_col = ramp(bt, [(0.0, hexc("#163b7a")), (0.42, hexc("#38bdf8")), (0.72, hexc("#818cf8")), (1.0, hexc("#f4a261"))])
        rim = smooth(0.55, 0.98, np.hypot(px, py)) * (0.25 + 0.75 * nl)
        p_lit = p_col * (0.14 + 0.95 * (nl ** 0.78))[..., None] + hexc("#7df9ff") * (rim * 0.55)[..., None]
        disc = smooth(r + 1.6, r - 1.6, d)
        img = mix(img, np.clip(p_lit, 0, 1), disc[..., None])

        # Nửa trước của vành đai vắt ngang trước hành tinh
        front_a = (ring_a * (ry >= 0))[..., None]
        img = mix(img, ring_rgb * (0.86 + 0.14 * smooth(-r * 1.4, r * 0.4, -rx))[..., None], front_a)

        # Mặt trăng băng nhỏ ở góc trên-trái đối xứng
        mx, my, mr = 0.20 * W, H - 390.0, 24.0
        md = np.hypot(xx - mx, yy - my)
        mdx, mdy = np.clip((xx - mx) / mr, -1.0, 1.0), np.clip((yy - my) / mr, -1.0, 1.0)
        mdz = np.sqrt(np.maximum(0.0, 1.0 - mdx * mdx - mdy * mdy))
        mnl = np.clip(mdx * L_pl[0] + mdy * L_pl[1] + mdz * L_pl[2], 0.0, 1.0)
        m_crater = 1.0 - 0.14 * smooth(0.55, 0.85, spectral(W, H, 2.2, seed + 61))
        m_col = mix(hexc("#8ea8e6"), hexc("#dff7ff"), mnl[..., None]) * m_crater[..., None] * (0.18 + 0.92 * mnl[..., None])
        img = mix(img, np.clip(m_col, 0, 1), smooth(mr + 1.4, mr - 1.4, md)[..., None])
    else:
        disc = smooth(r + 1.6, r - 1.6, d)
        sc = np.broadcast_to(hexc(S["col"]), img.shape).copy()
        if T.get("stars"):                                                              # mặt trăng: vân tối nhẹ
            m = spectral(W, H, 2.2, seed + 3)
            sc *= (1 - 0.16 * smooth(0.5, 0.8, m))[..., None]
        img = mix(img, sc, disc[..., None])
    return np.clip(img, 0, 1)


# ============================== MÂY ==============================

def puff_height(shape, puffs, bias=None):
    """Trường độ cao = hợp các bán cầu. Trả về (Hraw, Hbias, id của bán cầu thắng)."""
    hh, ww = shape
    Hr = np.zeros(shape, F)
    Hb = np.zeros(shape, F)
    idm = np.zeros(shape, np.int32)
    for i, (cx, cy, r) in enumerate(puffs):
        x0, x1 = max(0, int(cx - r - 1)), min(ww, int(cx + r + 2))
        y0, y1 = max(0, int(cy - r - 1)), min(hh, int(cy + r + 2))
        if x1 <= x0 or y1 <= y0:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1].astype(F)
        q = r * r - (xx - cx) ** 2 - (yy - cy) ** 2
        h = np.sqrt(np.maximum(q, 0))
        sub = Hr[y0:y1, x0:x1]
        np.maximum(sub, h, out=sub)
        if bias is not None:
            hb = np.where(q > 0, h + bias[i], 0)
            sb = Hb[y0:y1, x0:x1]
            win = hb > sb
            sb[win] = hb[win]
            idm[y0:y1, x0:x1][win] = i
    return Hr, (Hb if bias is not None else Hr), idm


def relief(Hm, sig, L, k=1.0):
    """Ánh sáng lambert từ trường độ cao đã làm mềm."""
    Hs = blur(Hm, sig)
    gy, gx = np.gradient(Hs)
    nz = 1.0 / np.sqrt(1 + (gx * gx + gy * gy) * k * k)
    return (-gx * k * nz) * L[0] + (-gy * k * nz) * L[1] + nz * L[2]


def billow(w, h, seed, wavelength, octaves=5, gain=0.55):
    """Nhiễu "cuộn" (tổng |nhiễu dải tần|): các ụ tròn ngăn bởi khe sắc — hợp làm mép mây tích. Nối liền 2 chiều."""
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.rfftfreq(w)[None, :]
    f = np.sqrt(fx * fx + fy * fy) + 1e-9
    acc = np.zeros((h, w), F)
    amp, tot, f0 = 1.0, 0.0, 1.0 / wavelength
    for _ in range(octaves):
        band = np.exp(-(np.log2(f / f0) / 0.5) ** 2)
        ph = rng.random((h, w // 2 + 1)) * 2 * np.pi
        n = np.fft.irfft2(band * np.exp(1j * ph), s=(h, w)).astype(F)
        acc += amp * np.abs(n / n.std())
        tot += amp
        amp *= gain
        f0 *= 2
    return acc / tot


def cloud_row(spec, seed, L, P, sky_hz):
    """Một hàng mây cùng cỡ: khối vòm (hợp các hình tròn) + nhiễu cuộn làm mép và khối nổi."""
    cnt, wr, hr, yr, haze, op = spec
    rng = np.random.default_rng(seed)
    puffs, ids, meta = [], [], []
    for i in range(cnt):
        cx = (i + rng.uniform(0.1, 0.9)) / cnt * W
        cw, ch, ya_b = rng.uniform(*wr), rng.uniform(*hr), rng.uniform(*yr)
        base = H - ya_b
        meta.append((base, ch))
        n0 = max(3, int(round(cw / (ch * 0.55))))
        ph = rng.uniform(0, 6.28)
        skew = rng.uniform(-0.4, 0.4)
        for j in range(n0):
            u = (j + 0.5) / n0 * 2 - 1 + rng.uniform(-0.6, 0.6) / n0
            p = max(0.0, 1 - abs(u - skew * (1 - u * u)) ** 2.0) ** 0.8
            p *= 0.75 + 0.25 * math.sin(u * 4.6 + ph)
            r = ch * 0.5 * (0.28 + 0.72 * p) * rng.uniform(0.85, 1.1)
            for dx in (-W, 0, W):
                puffs.append((cx + u * cw / 2 * 0.86 + dx, base - r * 0.74, r))
                ids.append(i)
    hmean = 0.5 * (hr[0] + hr[1])
    Hr, _, _ = puff_height((H, W), puffs)
    _, _, idm = puff_height((H, W), [(x, y, r * 1.6 + 30) for (x, y, r) in puffs], bias=[0.0] * len(puffs))
    ids = np.array(ids, np.int32)[idm]
    base = np.array([m[0] for m in meta], F)[ids]
    chh = np.array([m[1] for m in meta], F)[ids]
    above = (base - np.arange(H, dtype=F)[:, None]) / chh               # 0 ở đáy mây, ~1 ở đỉnh
    E = blur(Hr / (hmean * 0.5), hmean * 0.045, True)
    E = E * smooth(-0.10, 0.10, above)                                   # đáy phẳng
    B = billow(W, H, seed + 1, hmean * 0.62) - 0.8
    thr = 0.24
    D = E + np.clip(B, -0.6, 0.5) * 0.44 * smooth(0.0, 0.25, E + 0.12)
    a = smooth(thr - 0.012, thr + 0.03, D)
    Hh = (1 - np.exp(-np.maximum(D - thr, 0) * 3.0)) * hmean * 0.40 + np.clip(B, -0.6, 0.6) * hmean * 0.05
    lam = 0.5 * relief(Hh, max(1.5, hmean * 0.02), L, 1.2) + 0.5 * relief(Hh, max(4.0, hmean * 0.06), L, 1.5)
    t = 0.30 + 0.46 * smooth(0.0, 0.75, above) + 0.95 * (lam - L[2])
    rgb = ramp(np.clip(t, 0, 1), [(0.0, P["deep"]), (0.28, P["sh"]), (0.58, P["mid"]), (0.88, P["hi"]), (1.0, P["hi"])])
    rgb = blur(rgb, 1.2, True)
    rgb = mix(rgb, sky_hz, haze + 0.35 * (1 - smooth(0.0, 0.35, above))[..., None] * (1 - haze))
    a = a * mix(0.35, 1.0, smooth(-0.02, 0.30, above)) * op              # đáy tan vào sương
    return rgb.astype(F), a.astype(F)


def paint_clouds(T, seed, sky_hz):
    P = {k: hexc(v) for k, v in T["cloud"].items()}
    layer = np.zeros((H, W, 4), F)
    ya = (H - np.arange(H, dtype=F))[:, None]
    if T.get("cosmos"):
        # Dải mây tinh vân phát quang xuyên qua nền sao (liền mép X để trôi mượt trong shader)
        w1 = spectral(W, H, 2.2, seed + 71, sx=1.5, sy=1.0)
        w2 = spectral(W, H, 2.1, seed + 79, sx=1.1, sy=1.3)
        w3 = spectral(W, H, 2.35, seed + 83, sx=2.2, sy=0.7)
        fade = smooth(75, 420, ya)
        over(layer, np.broadcast_to(P["mid"], (H, W, 3)), (smooth(0.48, 0.88, w1) * fade * 0.28).astype(F))
        over(layer, np.broadcast_to(P["hi"], (H, W, 3)), (smooth(0.54, 0.92, w2) * w3 * fade * 0.34).astype(F))
        return layer
    sun_right = T["sun"]["x"] > 0.5
    L = np.array([0.50 if sun_right else -0.50, -0.74, 0.45], F)
    L /= np.linalg.norm(L)
    # mây ti: vệt mỏng kéo ngang trên cao
    n = spectral(W, H, 2.3, seed + 1, sx=2.2, sy=0.8)
    n2 = spectral(W, H, 2.4, seed + 2, sx=1.0, sy=1.0)
    ca = smooth(0.50, 0.92, n) * (0.25 + 0.75 * n2) * smooth(160, 520, ya) * T.get("cirrus", 0.5) * 0.8
    over(layer, np.broadcast_to(mix(P["mid"], P["hi"], 0.6), (H, W, 3)), ca.astype(F))
    for k, spec in enumerate(T["cloud_rows"]):                           # xa vẽ trước
        rgb, a = cloud_row(spec, seed * 31 + k * 7 + 3, L, P, sky_hz)
        over(layer, rgb, a)
    # quầng sáng mềm quanh mây (mộng mơ)
    halo = blur(layer[..., 3], 20, True) * 0.28
    hal = np.zeros_like(layer)
    hal[..., :3] = P["hi"] * halo[..., None]
    hal[..., 3] = halo
    layer = layer + hal * (1 - layer[..., 3:])
    return layer


# ============================== ĐẤT LIỀN ==============================

def mountain(land, hmap, c_top, c_lit, mist, sun_right, mist_h, mist_amt, seed):
    ya = (LH - np.arange(LH, dtype=F))[:, None] - 0.5
    a = np.clip(hmap[None, :] - ya + 0.5, 0, 1)
    depth = np.maximum(hmap[None, :] - ya, 0)
    slope = np.gradient(_gauss1d(hmap, 26, axis=0, wrap=True))
    lit = np.clip(0.40 - slope * (1.0 if sun_right else -1.0) * 2.0, 0, 1)
    xi = np.arange(W)[None, :] + (depth * (0.5 if sun_right else -0.5)).astype(np.int32)
    lit2 = blur_aniso(lit[xi % W], (14, 16), wrap_x=False)
    tex = spectral(W, LH, 2.3, seed, sx=1.2, sy=0.8)
    k = lit2 * np.exp(-depth / 150.0) * 0.75 + (tex - 0.5) * 0.08
    rgb = mix(c_top, c_lit, np.clip(k, 0, 1)[..., None])
    m = (1 - np.clip(ya / mist_h, 0, 1)) ** 1.5 * mist_amt
    rgb = mix(rgb, mist, m[..., None])
    over(land, rgb, a.astype(F))


def mist_band(land, mist, seed, y_top, amt):
    n = spectral(W, LH, 2.3, seed, sx=2.6, sy=0.6)
    ya = (LH - np.arange(LH, dtype=F))[:, None]
    a = smooth(0.35, 0.8, n) * (1 - smooth(y_top * 0.35, y_top, ya)) * amt
    a = np.maximum(a, (1 - smooth(0, y_top * 0.35, ya)) * amt * 0.6)
    over(land, np.broadcast_to(mist, (LH, W, 3)), a.astype(F))


def forest(land, hill, TP, mist, haze, seed, wl, sun_right, lights=None):
    """Rừng cây nhìn từ xa: mép tán + khối nổi lấy từ nhiễu cuộn, tô theo mảng màu."""
    rng = np.random.default_rng(seed)
    ya = (LH - np.arange(LH, dtype=F))[:, None]
    B = np.clip(billow(W, LH, seed, wl * 1.5, octaves=3, gain=0.42) - 0.8, -0.7, 0.7)
    has = smooth(1.0, 6.0, hill)[None, :]
    edge = hill[None, :] + B * wl * 0.95 * np.clip(hill / (wl * 1.6), 0, 1)[None, :]
    a = np.clip(edge - ya + 0.5, 0, 1) * has
    inner = np.maximum(edge - ya, 0)
    Hh = (1 - np.exp(-inner / (wl * 0.45))) * wl * 0.55 + B * wl * 0.42
    L = np.array([0.5 if sun_right else -0.5, -0.74, 0.45], F)
    L /= np.linalg.norm(L)
    lam = 0.5 * relief(Hh, 2.2, L, 0.6) + 0.5 * relief(Hh, wl * 0.3, L, 1.0)
    v = np.clip(ya / np.maximum(hill[None, :] + wl * 0.6, 1), 0, 1)
    t = 0.36 + 0.36 * smooth(0.0, 0.9, v) + 0.85 * (lam - L[2])
    rgb = ramp(np.clip(t, 0, 1), [(0.0, hexc(TP["deep"])), (0.30, hexc(TP["sh"])), (0.62, hexc(TP["mid"])), (1.0, hexc(TP["hi"]))])
    # mảng màu từng cụm cây
    tn = blur(spectral(W, LH, 1.3, seed + 3), wl * 0.28, True)
    lo, hi = np.percentile(tn, [2, 98])
    tn = np.clip((tn - lo) / (hi - lo), 0, 1)
    tints = [hexc(c) for c in TP["tints"]]
    tcol = ramp(tn, [(i / (len(tints) - 1), c) for i, c in enumerate(tints)])
    rgb = rgb * mix(1.0, tcol, 0.6)
    rgb = rgb * (1 - 0.25 * (1 - smooth(0, 6, ya)))[..., None]         # mép nước sẫm nhẹ
    hmax = float(hill.max()) + 1
    rgb = mix(rgb, mist, haze + (1 - haze) * 0.32 * (1 - smooth(0, hmax * 0.45, ya))[..., None])
    over(land, blur(rgb, 0.8, True).astype(F), a.astype(F))
    if lights:
        g = np.zeros((LH, W), F)
        n = lights["n"]
        ok = np.where(hill > 8)[0]
        lx = ok[rng.integers(0, len(ok), n)]
        ly = np.clip(LH - 2 - (hill[lx] * rng.uniform(0.02, 0.5, n)).astype(int), 0, LH - 1)
        np.add.at(g, (ly, lx), rng.uniform(0.5, 1.0, n))
        glow = np.clip(blur(g, 1.3, True) * 9 + blur(g, 5, True) * 40 + blur(g, 14, True) * 90, 0, 1)
        land[..., :3] = land[..., :3] + glow[..., None] * hexc(lights["col"]) * (0.35 + 0.65 * land[..., 3:])
        land[..., 3] = np.clip(land[..., 3] + glow * 0.5, 0, 1)


def paint_land(T, seed):
    land = np.zeros((LH, W, 4), F)
    mist = hexc(T["mist"])
    sun_right = T["sun"]["x"] > 0.5
    x = np.arange(W, dtype=F) / W
    side = np.abs(2 * x - 1)                                            # 0 giữa, 1 hai mép
    for k, M in enumerate(T["mtn"]):
        n = ridge1d(W, M.get("beta", 2.0), seed + 11 * k + 1, lo=M.get("lo", 2))
        n2 = ridge1d(W, 1.4, seed + 11 * k + 5, lo=12)
        shape = n ** M.get("pow", 1.2) * 0.86 + (1 - np.abs(2 * n2 - 1)) * 0.14
        env = M.get("mid", 0.45) + (1 - M.get("mid", 0.45)) * side ** M.get("envp", 1.2)
        hm = (M["base"] + M["amp"] * shape * env).astype(F)
        mountain(land, hm, hexc(M["col"]), hexc(M["lit"]), mist, sun_right, M.get("mist_h", 190), M.get("mist", 0.9), seed + 40 + k)
        mist_band(land, mist, seed + 60 + k, M.get("band", 70), M.get("band_amt", 0.35))
    for k, Hh in enumerate(T["hills"]):
        n = ridge1d(W, 2.3, seed + 100 + 7 * k, lo=Hh.get("lo", 3))
        env = Hh.get("mid", 0.3) + (1 - Hh.get("mid", 0.3)) * side ** Hh.get("envp", 1.5)
        hill = (Hh["base"] + Hh["amp"] * n ** 1.3 * env).astype(F)
        if "gap" in Hh:                                                 # chừa khoảng nước trống (vịnh)
            g = ridge1d(W, 2.0, seed + 300 + k, lo=2)
            hill = hill * smooth(Hh["gap"], Hh["gap"] + 0.12, g)
        forest(land, hill, Hh["pal"], mist, Hh["haze"], seed + 200 + k, Hh["wl"], sun_right, Hh.get("lights"))
    # sương là là sát mặt nước
    ya = (LH - np.arange(LH, dtype=F))[:, None]
    n = spectral(W, LH, 2.2, seed + 77, sx=3.0, sy=0.5)
    a = (1 - smooth(0, T.get("fog_h", 46), ya)) * (0.35 + 0.65 * n) * T.get("fog", 0.55)
    over(land, np.broadcast_to(mist, (LH, W, 3)), a.astype(F))
    return land


# ============================== THEME ==============================

SAKURA_TREE = dict(hi="#fff6f9", mid="#ffc3d8", sh="#d98ab6", deep="#8f62a8", tints=["#ffffff", "#ffd9e6", "#ffb6d0", "#fff3f7", "#ffc9dc", "#f7a3c6", "#ffffff", "#c9a6d9"])

THEMES = {
    "sakura": dict(
        sky=[(900, "#5868cf"), (640, "#747fdb"), (440, "#9d8fe3"), (290, "#cc9fe0"), (170, "#f1b0d3"), (70, "#ffcdd2"), (0, "#ffe7da")],
        sun=dict(x=0.775, y=250, r=30, col="#fffaf0", glow="#ffe0bd", amt=0.85),
        cloud=dict(hi="#fff9f3", mid="#ffd5e3", sh="#c9a3de", deep="#9f90d8"), cirrus=0.55,
        cloud_rows=[(9, (220, 520), (45, 90), (26, 90), 0.52, 0.92),
                    (4, (420, 820), (110, 190), (150, 270), 0.24, 1.0),
                    (2, (560, 860), (230, 320), (290, 400), 0.08, 1.0)],
        mist="#ffe0e0",
        mtn=[dict(base=70, amp=330, col="#cfaee2", lit="#f6cfe6", mid=0.30, mist_h=260, mist=0.92, band=110, band_amt=0.40),
             dict(base=40, amp=250, col="#a98dd8", lit="#e3b4e0", mid=0.28, mist_h=210, mist=0.90, band=90, band_amt=0.42, beta=1.95),
             dict(base=20, amp=170, col="#866fc6", lit="#c897d8", mid=0.22, mist_h=150, mist=0.85, band=60, band_amt=0.40, beta=1.9)],
        hills=[dict(base=8, amp=120, mid=0.20, wl=19, haze=0.40, pal=SAKURA_TREE, gap=0.20),
               dict(base=0, amp=96, mid=0.06, envp=2.0, wl=27, haze=0.14, pal=SAKURA_TREE, gap=0.40)],
        fog=0.55,
    ),
    "wood": dict(
        sky=[(900, "#3f66b4"), (640, "#6c86c8"), (440, "#b79dc0"), (290, "#eeab8f"), (170, "#ffbf7e"), (70, "#ffd795"), (0, "#ffeab8")],
        sun=dict(x=0.24, y=150, r=40, col="#fffbe6", glow="#ffc98a", amt=0.95),
        cloud=dict(hi="#fff6e2", mid="#ffcf9f", sh="#d79a92", deep="#9a7fae"), cirrus=0.6,
        cloud_rows=[(9, (220, 520), (45, 90), (26, 90), 0.52, 0.92),
                    (4, (420, 820), (110, 190), (150, 270), 0.24, 1.0),
                    (2, (560, 860), (230, 320), (290, 400), 0.08, 1.0)],
        mist="#ffe3b5",
        mtn=[dict(base=70, amp=330, col="#c9a3a8", lit="#ffd9a8", mid=0.30, mist_h=260, mist=0.92, band=110, band_amt=0.40),
             dict(base=40, amp=250, col="#a47f8f", lit="#f3b488", mid=0.28, mist_h=210, mist=0.90, band=90, band_amt=0.42, beta=1.95),
             dict(base=20, amp=170, col="#7d5f78", lit="#d98f6c", mid=0.22, mist_h=150, mist=0.85, band=60, band_amt=0.40, beta=1.9)],
        hills=[dict(base=6, amp=110, mid=0.16, wl=24, haze=0.34, gap=0.22,
                    pal=dict(hi="#ffe9a6", mid="#f6a84a", sh="#c9582f", deep="#6e3a3f", tints=["#ffffff", "#ffd27a", "#ff9a4a", "#f2643a", "#ffe9a0"])),
               dict(base=0, amp=78, mid=0.05, envp=2.2, wl=36, haze=0.10, gap=0.42,
                    pal=dict(hi="#ffe9a6", mid="#f6a84a", sh="#c9582f", deep="#6e3a3f", tints=["#ffffff", "#ffd27a", "#ff9a4a", "#f2643a", "#ffe9a0", "#e8503a"]))],
        fog=0.5,
    ),
    "ocean": dict(
        sky=[(900, "#1f78d6"), (640, "#3a98e6"), (440, "#63b7f0"), (290, "#8fd2f6"), (170, "#b9e6fa"), (70, "#dcf5fc"), (0, "#f2fdff")],
        sun=dict(x=0.79, y=330, r=34, col="#ffffff", glow="#fff6cf", amt=0.75),
        cloud=dict(hi="#ffffff", mid="#eef8ff", sh="#a9cdea", deep="#7fa9d6"), cirrus=0.35,
        cloud_rows=[(9, (220, 520), (45, 90), (26, 90), 0.52, 0.92),
                    (4, (420, 820), (110, 190), (150, 270), 0.24, 1.0),
                    (2, (560, 860), (230, 320), (290, 400), 0.08, 1.0)],
        mist="#e6fbff",
        mtn=[dict(base=30, amp=210, col="#8fc4e6", lit="#c9ecf7", mid=0.16, mist_h=200, mist=0.9, band=70, band_amt=0.30, envp=1.8),
             dict(base=10, amp=150, col="#5fa3cf", lit="#a3dcea", mid=0.10, mist_h=150, mist=0.85, band=50, band_amt=0.30, beta=1.95, envp=2.0)],
        hills=[dict(base=0, amp=120, mid=0.02, envp=2.0, wl=27, haze=0.30, gap=0.38,
                    pal=dict(hi="#d9f7a8", mid="#7fd27a", sh="#2f9c78", deep="#1d6a78", tints=["#ffffff", "#e9ffb8", "#b9f0a0", "#ffffff"])),
               dict(base=0, amp=84, mid=0.0, envp=2.6, wl=36, haze=0.08, gap=0.50,
                    pal=dict(hi="#e3fbb0", mid="#86d977", sh="#2fa06f", deep="#1b6a66", tints=["#ffffff", "#e9ffb8", "#b9f0a0", "#fff7c9"]))],
        fog=0.35, fog_h=30,
    ),
    "midnight": dict(
        sky=[(900, "#040720"), (640, "#0a0f33"), (440, "#161a4e"), (290, "#262364"), (170, "#3a2f7c"), (70, "#55408f"), (0, "#7355a3")],
        sun=dict(x=0.23, y=330, r=44, col="#fbf9ff", glow="#8f8cf2", amt=0.36),
        stars=5200, milky="#b7b0ff", wash=0.02,
        cloud=dict(hi="#a9a0ea", mid="#4a4690", sh="#28265e", deep="#16153f"), cirrus=0.18,
        cloud_rows=[(9, (220, 520), (45, 90), (26, 90), 0.52, 0.92),
                    (4, (420, 820), (110, 190), (150, 270), 0.24, 1.0),
                    (2, (560, 860), (230, 320), (290, 400), 0.08, 1.0)],
        mist="#5d4c9c",
        mtn=[dict(base=70, amp=330, col="#3d3581", lit="#6f63b8", mid=0.30, mist_h=260, mist=0.62, band=110, band_amt=0.22),
             dict(base=40, amp=250, col="#2a2666", lit="#544c9f", mid=0.28, mist_h=210, mist=0.55, band=90, band_amt=0.20, beta=1.95),
             dict(base=20, amp=170, col="#1c1a4c", lit="#40397f", mid=0.22, mist_h=150, mist=0.45, band=60, band_amt=0.18, beta=1.9)],
        hills=[dict(base=6, amp=110, mid=0.16, wl=24, haze=0.22, gap=0.22,
                    pal=dict(hi="#c9b6ff", mid="#6a58b8", sh="#33296e", deep="#17143c", tints=["#ffffff", "#e3d6ff", "#ffc9ec", "#c9d6ff"]),
                    lights=dict(n=70, col="#ffd9a0")),
               dict(base=0, amp=78, mid=0.05, envp=2.2, wl=36, haze=0.06, gap=0.42,
                    pal=dict(hi="#d6c4ff", mid="#7461c4", sh="#352b74", deep="#15123a", tints=["#ffffff", "#e3d6ff", "#ffc9ec", "#c9d6ff"]),
                    lights=dict(n=46, col="#ffcf8a"))],
        fog=0.4,
    ),
    "cosmos": dict(
        sky=[(900, "#02030d"), (660, "#050924"), (450, "#0b133d"), (290, "#141f5c"), (160, "#183675"), (65, "#1b568c"), (0, "#247ba0")],
        sun=dict(x=0.76, y=340, r=78, col="#38bdf8", glow="#6d28d9", amt=0.48),
        cosmos=True, stars=9000, milky="#9ef0ff", wash=0.025,
        cloud=dict(hi="#4ff4ff", mid="#a855f7", sh="#2c1d63", deep="#0c0a2a"), cirrus=0.55,
        cloud_rows=[],
        mist="#2ae8f5",
        mtn=[dict(base=60, amp=310, col="#141e52", lit="#38bdf8", mid=0.22, mist_h=240, mist=0.72, band=95, band_amt=0.26),
             dict(base=34, amp=225, col="#101842", lit="#818cf8", mid=0.20, mist_h=190, mist=0.65, band=75, band_amt=0.22, beta=1.95),
             dict(base=14, amp=150, col="#0b102d", lit="#c084fc", mid=0.14, mist_h=135, mist=0.52, band=55, band_amt=0.18, beta=1.9)],
        hills=[dict(base=4, amp=105, mid=0.12, wl=22, haze=0.26, gap=0.26,
                    pal=dict(hi="#7df9ff", mid="#4338ca", sh="#1e1b4b", deep="#09081f", tints=["#7df9ff", "#c084fc", "#f472b6", "#38bdf8"]),
                    lights=dict(n=95, col="#38f6ff")),
               dict(base=0, amp=74, mid=0.03, envp=2.3, wl=32, haze=0.08, gap=0.46,
                    pal=dict(hi="#a5f3fc", mid="#6d28d9", sh="#22174a", deep="#08061a", tints=["#a5f3fc", "#f472b6", "#ffd166", "#818cf8"]),
                    lights=dict(n=60, col="#ff6ad5"))],
        fog=0.36, fog_h=38,
    ),
}
SEEDS = {"sakura": 11, "wood": 23, "ocean": 37, "midnight": 51, "cosmos": 73}


# ============================== XEM THỬ ==============================

def preview(sky, clouds, land, T, path, sw=1600, sh=900, hz=0.40):
    """Ghép thử gần giống shader (không gợn sóng) để xem bố cục."""
    s = 0.92 * W / sw
    full = sky.copy()
    a = clouds[..., 3:]
    full = clouds[..., :3] + full * (1 - a)
    la = land[..., 3:]
    full[H - LH:] = land[..., :3] + full[H - LH:] * (1 - la)
    hy = int(sh * hz)
    x0 = int(W / 2 - sw / 2 * s)
    x1 = int(W / 2 + sw / 2 * s)
    top_h = int(hy * s)
    img8 = lambda a_: Image.fromarray((np.clip(a_, 0, 1) * 255).astype(np.uint8))
    top = img8(full[H - top_h:H, x0:x1]).resize((sw, hy), Image.LANCZOS)
    bot_h = min(H, int((sh - hy) * s))
    refl = full[H - bot_h:H, x0:x1][::-1]
    d = np.linspace(0, 1, bot_h, dtype=F)[:, None, None]
    refl = mix(refl * 0.94, hexc(T.get("deep", "#7a78c8")), 0.18 + 0.4 * d)
    bot = img8(refl).resize((sw, sh - hy), Image.LANCZOS)
    out = Image.new("RGB", (sw, sh))
    out.paste(top, (0, 0))
    out.paste(bot, (0, hy))
    out.save(path)


def main():
    os.makedirs(OUT, exist_ok=True)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    pv = [a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--preview=")]
    for name in THEMES:
        if args and name not in args:
            continue
        T = THEMES[name]
        seed = SEEDS[name]
        sky = paint_sky(T, seed)
        clouds = paint_clouds(T, seed, hexc(sorted(T["sky"])[1][1]))
        land = paint_land(T, seed)
        if pv:
            os.makedirs(pv[0], exist_ok=True)
            preview(sky, clouds, land, T, os.path.join(pv[0], "pv_%s.png" % name))
        if "--nosave" not in sys.argv:
            save_rgb(sky, os.path.join(OUT, name + "_sky.png"))
            save_rgba(clouds, os.path.join(OUT, name + "_clouds.png"), True)
            save_rgba(land, os.path.join(OUT, name + "_land.png"), True)
        print("ok", name)


if __name__ == "__main__":
    main()
