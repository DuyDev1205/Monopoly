# Vẽ vân bề mặt cho bàn cờ 2D (độ nét cao 1536×1536, ghép lên các mặt isometric bằng UV):
#   court_<theme>.png  sân giữa: 8×8 viên gạch men / đá cẩm thạch bo vát + khung viền góc + huy hiệu trung tâm
#                      (vòng họa tiết trống đồng Việt Nam, chữ chạy vòng sắc nét, hoa anh đào / sao la bàn mạ vàng)
#   side.png           mặt bên đế chính: 22 ô khung lõm có viền nổi (mỗi ô một bóng đèn), nẹp trên / dưới — thang xám
#   plinth.png         mặt bên bệ dưới: đá xây so le vát cạnh có mạch — thang xám
#   paper.png          vân giấy mỹ thuật mịn cho mặt ô đất (lặp liền) — thang xám
# Chạy: python godot/tools/render_board.py   (chỉ cần Pillow, numpy)
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "assets", "board2d"))
FONT_PATH = os.path.normpath(os.path.join(HERE, "..", "assets", "fonts", "Montserrat-ExtraBold.ttf"))
F = np.float32

## [ô sáng, ô đậm, màu viền chính, màu vàng kim, kiểu tâm]
COURT = {
    "sakura":   ["#fcf1f6", "#f2d2e2", "#df4278", "#e8b44c", "flower"],
    "wood":     ["#f4e2c1", "#e4c596", "#c47b22", "#e6b44c", "lotus"],
    "ocean":    ["#fdfbf7", "#dceef8", "#1565c0", "#f0ab1d", "compass"],
    "midnight": ["#283164", "#1d244e", "#8f78ff", "#d8c4ff", "astro"],
    "cosmos":   ["#131b3f", "#0b1029", "#2ce6ff", "#ffd46b", "cosmos"],
}


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], F) / 255.0


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0 + 1e-9), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def blur_arr(a, radius):
    if radius <= 0:
        return a
    if a.ndim == 2:
        im = Image.fromarray(np.clip(a * 255.0, 0, 255).astype(np.uint8), "L")
        return np.asarray(im.filter(ImageFilter.GaussianBlur(radius)), F) / 255.0
    im = Image.fromarray(np.clip(a * 255.0, 0, 255).astype(np.uint8), "RGB")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(radius)), F) / 255.0


def spectral(w, h, beta, seed, sx=1.0, sy=1.0):
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


def blend_rgba(base_rgb, over_pil):
    ov = np.asarray(over_pil, F) / 255.0
    al = ov[..., 3:4]
    return base_rgb * (1.0 - al) + ov[..., :3] * al


def save(a, name, mode="RGB"):
    rng = np.random.default_rng(3)
    v = np.clip(a, 0, 1) * 255.0 + rng.uniform(-0.4, 0.4, a.shape).astype(F)
    v = np.clip(np.rint(v), 0, 255).astype(np.uint8)
    Image.fromarray(v, mode).save(os.path.join(OUT, name), optimize=True)
    print("ok", name, a.shape[1], "x", a.shape[0])


def _draw_ring_text(overlay, cx, cy, radius_px, text, color_rgba, font_px):
    """Vẽ chữ chạy vòng tròn mượt (lấy mẫu siêu mịn ×2 để không răng cưa khi xoay)."""
    font = ImageFont.truetype(FONT_PATH, font_px * 2)
    n = len(text)
    for k, ch in enumerate(text):
        if ch == " ":
            continue
        # Bắt đầu từ góc dưới-phải để câu "CỜ TỶ PHÚ VIỆT NAM" nằm ngay hướng người chơi nhìn vào
        ang = math.pi * 0.75 + 2.0 * math.pi * k / n
        px = cx + math.cos(ang) * radius_px
        py = cy + math.sin(ang) * radius_px
        rot_deg = -math.degrees(ang + math.pi * 0.5)
        box = font.getbbox(ch)
        gw = max(box[2] - box[0], 4) + 24
        gh = max(box[3] - box[1], 4) + 24
        gim = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
        gd = ImageDraw.Draw(gim)
        gd.text(((gw - (box[2] - box[0])) * 0.5 - box[0], (gh - (box[3] - box[1])) * 0.5 - box[1]),
                ch, font=font, fill=color_rgba)
        gim = gim.resize((gw // 2, gh // 2), Image.Resampling.LANCZOS)
        rot = gim.rotate(rot_deg, resample=Image.Resampling.BICUBIC, expand=True)
        overlay.alpha_composite(rot, (int(round(px - rot.width * 0.5)), int(round(py - rot.height * 0.5))))


def _medallion_overlay(N, theme, c0_hex, c1_hex, trim_hex, gold_hex, motif):
    """Vẽ khung viền sân + hoa văn góc + huy hiệu trung tâm siêu nét ở độ phân giải 2× rồi thu mượt."""
    S = 2
    M = N * S
    ov = Image.new("RGBA", (M, M), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    dark = theme in ("midnight", "cosmos")

    def rgba(hx, a=255):
        hx = hx.lstrip("#")
        return (int(hx[0:2], 16), int(hx[2:4], 16), int(hx[4:6], 16), int(a))

    def mix_hex(h1, h2, t):
        a1, a2 = hexc(h1), hexc(h2)
        m = np.clip(a1 * (1 - t) + a2 * t, 0, 1) * 255
        return "#{:02x}{:02x}{:02x}".format(int(m[0]), int(m[1]), int(m[2]))

    cx = cy = M * 0.5

    # 1. Khung chỉ viền kép quanh sân + hoa văn 4 góc
    m1 = int(M * 0.026)
    m2 = int(M * 0.040)
    d.rectangle([m1, m1, M - m1, M - m1], outline=rgba(trim_hex, 145), width=6)
    d.rectangle([m2, m2, M - m2, M - m2], outline=rgba(gold_hex, 175 if dark else 195), width=4)

    # Hoa văn vòng cung kép & nút ngọc ở 4 góc sân
    cr = int(M * 0.082)
    for sx in (-1, 1):
        for sy in (-1, 1):
            kx = m2 if sx < 0 else M - m2
            ky = m2 if sy < 0 else M - m2
            a0 = {( -1, -1): 0, (1, -1): 90, (1, 1): 180, (-1, 1): 270}[(sx, sy)]
            d.arc([kx - cr, ky - cr, kx + cr, ky + cr], a0, a0 + 90, fill=rgba(trim_hex, 130), width=5)
            cr2 = int(cr * 0.68)
            d.arc([kx - cr2, ky - cr2, kx + cr2, ky + cr2], a0, a0 + 90, fill=rgba(gold_hex, 170), width=4)
            # Nút hoa 4 cánh ở góc
            d.ellipse([kx - 14, ky - 14, kx + 14, ky + 14], fill=rgba(trim_hex, 220))
            d.ellipse([kx - 8, ky - 8, kx + 8, ky + 8], fill=rgba(gold_hex, 255))

    # 4 điểm thoi giữa 4 cạnh sân
    for mx, my in [(cx, m2), (cx, M - m2), (m2, cy), (M - m2, cy)]:
        pts = [(mx, my - 14), (mx + 14, my), (mx, my + 14), (mx - 14, my)]
        d.polygon(pts, fill=rgba(gold_hex, 230), outline=rgba(trim_hex, 200))

    # 2. Đĩa nền huy hiệu trung tâm
    R_out = M * 0.345
    R_stud = M * 0.330
    R_in1 = M * 0.314
    R_txt = M * 0.258
    R_in2 = M * 0.204
    R_drum = M * 0.186

    plate_hex = mix_hex(c0_hex, "#ffffff" if not dark else ("#1d2c68" if theme == "cosmos" else "#38448a"), 0.42 if not dark else 0.32)
    d.ellipse([cx - R_out, cy - R_out, cx + R_out, cy + R_out], fill=rgba(plate_hex, 215))
    d.ellipse([cx - R_out, cy - R_out, cx + R_out, cy + R_out], outline=rgba(trim_hex, 215), width=9)
    d.ellipse([cx - R_in1, cy - R_in1, cx + R_in1, cy + R_in1], outline=rgba(gold_hex, 220), width=5)
    d.ellipse([cx - R_in2, cy - R_in2, cx + R_in2, cy + R_in2], outline=rgba(trim_hex, 180), width=6)
    d.ellipse([cx - R_drum, cy - R_drum, cx + R_drum, cy + R_drum], outline=rgba(gold_hex, 175), width=3)

    # Họa tiết răng cưa trống đồng Đông Sơn mảnh giữa R_in2 và R_drum
    n_teeth = 36
    for k in range(n_teeth):
        a_mid = 2 * math.pi * (k + 0.5) / n_teeth
        a_l = 2 * math.pi * k / n_teeth
        a_r = 2 * math.pi * (k + 1) / n_teeth
        p_tip = (cx + math.cos(a_mid) * (R_in2 - 3), cy + math.sin(a_mid) * (R_in2 - 3))
        p_l = (cx + math.cos(a_l) * (R_drum + 3), cy + math.sin(a_l) * (R_drum + 3))
        p_r = (cx + math.cos(a_r) * (R_drum + 3), cy + math.sin(a_r) * (R_drum + 3))
        d.polygon([p_l, p_tip, p_r], fill=rgba(gold_hex if k % 2 == 0 else trim_hex, 85 if not dark else 105))

    # Vòng đinh tán ngọc & vàng (48 hạt)
    for k in range(48):
        an = 2 * math.pi * k / 48.0
        px = cx + math.cos(an) * R_stud
        py = cy + math.sin(an) * R_stud
        major = (k % 4 == 0)
        rr = 8.5 if major else 4.8
        d.ellipse([px - rr, py - rr, px + rr, py + rr],
                  fill=rgba(gold_hex if major else trim_hex, 245 if major else 145))

    # 3. Họa tiết trung tâm theo theme
    if motif == "flower":
        # Hoa anh đào 5 cánh 2 lớp mềm mại + nhụy vàng (xoay -135° để cánh đầu hướng thẳng 12h khi chiếu isometric)
        for layer, sc_r, alpha_f in [(0, 1.0, 76), (1, 0.66, 118)]:
            rot0 = -math.pi * 0.75 + (math.pi / 5.0 if layer == 1 else 0.0)
            for k in range(5):
                ang = rot0 + 2 * math.pi * k / 5.0
                dx, dy = math.cos(ang), math.sin(ang)
                nx, ny = -dy, dx
                pts = []
                steps = 18
                for j in range(steps + 1):
                    u = j / steps * 0.96
                    rad = (0.10 + 0.90 * u) * R_drum * 0.92 * sc_r
                    half = (0.40 * math.sin(math.pi * (u ** 0.76)) + 0.03) * R_drum * sc_r
                    pts.append((cx + dx * rad + nx * half, cy + dy * rad + ny * half))
                notch = 0.80 * R_drum * 0.92 * sc_r
                pts.append((cx + dx * notch, cy + dy * notch))
                for j in range(steps, -1, -1):
                    u = j / steps * 0.96
                    rad = (0.10 + 0.90 * u) * R_drum * 0.92 * sc_r
                    half = (0.40 * math.sin(math.pi * (u ** 0.76)) + 0.03) * R_drum * sc_r
                    pts.append((cx + dx * rad - nx * half, cy + dy * rad - ny * half))
                d.polygon(pts, fill=rgba(trim_hex if layer == 0 else gold_hex, alpha_f),
                          outline=rgba(trim_hex, 155 if layer == 0 else 120))
        # Nhụy hoa vàng kim
        for k in range(10):
            an = -math.pi * 0.5 + 2 * math.pi * k / 10.0
            r1 = R_drum * (0.48 if k % 2 == 0 else 0.36)
            x0, y0 = cx + math.cos(an) * (R_drum * 0.13), cy + math.sin(an) * (R_drum * 0.13)
            x1, y1 = cx + math.cos(an) * r1, cy + math.sin(an) * r1
            d.line([x0, y0, x1, y1], fill=rgba(trim_hex, 155), width=4)
            d.ellipse([x1 - 7, y1 - 7, x1 + 7, y1 + 7], fill=rgba(gold_hex, 245))
    elif motif == "cosmos":
        # Vòng thiên văn Astrolabe đồng tâm + quỹ đạo hành tinh nghiêng + 12 ngôi sao chòm
        for wr, hx_c, al in [(0.82, "#2ce6ff", 130), (0.58, "#e879f9", 115)]:
            rr = R_drum * wr
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=rgba(hx_c, al), width=4)
        for tilt_deg, hx_o, al in [(-25.0, "#2ce6ff", 175), (25.0, "#e879f9", 125)]:
            ca, sa = math.cos(math.radians(tilt_deg)), math.sin(math.radians(tilt_deg))
            pts_o = []
            for j in range(97):
                t = 2.0 * math.pi * j / 96.0
                ox = math.cos(t) * (R_drum * 1.04)
                oy = math.sin(t) * (R_drum * 0.42)
                pts_o.append((cx + ox * ca - oy * sa, cy + ox * sa + oy * ca))
            d.line(pts_o, fill=rgba(hx_o, al), width=4)
        for k in range(12):
            an = 2.0 * math.pi * k / 12.0 - math.pi * 0.5
            sr = R_drum * (0.72 if k % 2 == 0 else 0.70)
            sx = cx + math.cos(an) * sr
            sy = cy + math.sin(an) * sr
            rr_s = 6.5 if k % 3 == 0 else 4.5
            d.ellipse([sx - rr_s, sy - rr_s, sx + rr_s, sy + rr_s],
                      fill=rgba("#ffd46b" if k % 2 == 0 else "#9bf8ff", 240))
        # Sao siêu tân tinh 8 cánh vát nổi khối hai màu vàng kim & lục lam điện tử
        for k in range(8):
            an = -math.pi * 0.5 + 2.0 * math.pi * k / 8.0
            r_tip = R_drum * (0.94 if k % 2 == 0 else 0.66)
            r_mid = R_drum * 0.24
            al = an - math.pi / 8.0
            ar = an + math.pi / 8.0
            tip = (cx + math.cos(an) * r_tip, cy + math.sin(an) * r_tip)
            pl = (cx + math.cos(al) * r_mid, cy + math.sin(al) * r_mid)
            pr = (cx + math.cos(ar) * r_mid, cy + math.sin(ar) * r_mid)
            col_a = "#ffd46b" if k % 2 == 0 else "#2ce6ff"
            col_b = "#c98b18" if k % 2 == 0 else "#1a80b8"
            d.polygon([(cx, cy), pl, tip], fill=rgba(col_a, 235))
            d.polygon([(cx, cy), tip, pr], fill=rgba(col_b, 200))
            d.line([pl, tip, pr], fill=rgba("#ffffff", 185), width=3)
    else:
        # Sao la bàn / hoa sen 8 cánh hai mặt vát sáng-tối (kiểu trống đồng & hải đồ)
        if motif == "compass":
            for wr in (0.76, 0.54):
                rr = R_drum * wr
                d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=rgba(trim_hex, 95), width=4)
        for k in range(8):
            an = -math.pi * 0.5 + 2 * math.pi * k / 8.0
            r_tip = R_drum * (0.92 if k % 2 == 0 else 0.64)
            r_mid = R_drum * 0.24
            al = an - math.pi / 8.0
            ar = an + math.pi / 8.0
            tip = (cx + math.cos(an) * r_tip, cy + math.sin(an) * r_tip)
            pl = (cx + math.cos(al) * r_mid, cy + math.sin(al) * r_mid)
            pr = (cx + math.cos(ar) * r_mid, cy + math.sin(ar) * r_mid)
            # Hai nửa cánh sáng / đậm tạo khối 3D như chạm nổi vàng đồng
            d.polygon([(cx, cy), pl, tip], fill=rgba(gold_hex, 215 if k % 2 == 0 else 165))
            d.polygon([(cx, cy), tip, pr], fill=rgba(trim_hex, 165 if k % 2 == 0 else 120))
            d.line([pl, tip, pr], fill=rgba(trim_hex, 190), width=3)

    # Ngọc tâm huy hiệu
    rc = R_drum * 0.15
    d.ellipse([cx - rc - 4, cy - rc - 4, cx + rc + 4, cy + rc + 4], fill=rgba(trim_hex, 220))
    d.ellipse([cx - rc, cy - rc, cx + rc, cy + rc], fill=rgba(gold_hex, 255))

    ov_1x = ov.resize((N, N), Image.Resampling.LANCZOS)
    # Vẽ chữ vòng trực tiếp lên bản 1x (hàm tự lấy mẫu ×2)
    txt = "CỜ TỶ PHÚ VIỆT NAM  •  MUA ĐẤT  •  XÂY NHÀ  •  "
    txt_col = rgba(trim_hex if not dark else gold_hex, 228)
    _draw_ring_text(ov_1x, N * 0.5, N * 0.5, N * 0.258, txt, txt_col, int(N * 0.030))
    return ov_1x


def court(theme):
    N, n = 1536, 8
    c = N // n
    cfg = COURT[theme]
    c0, c1 = hexc(cfg[0]), hexc(cfg[1])
    yy, xx = np.mgrid[0:N, 0:N].astype(F)
    u, v = xx % c, yy % c
    i, j = (xx // c).astype(int), (yy // c).astype(int)
    base = np.where(((i + j) % 2 == 0)[..., None], c0, c1)
    dark = theme in ("midnight", "cosmos")

    # Vân đá cẩm thạch / gỗ mịn tự nhiên
    m = spectral(N, N, 2.4, 11 + hash(theme) % 97)
    vein = 1.0 - np.abs(spectral(N, N, 1.65, 29, sx=1.0, sy=1.3) * 2.0 - 1.0)
    vein = blur_arr(smooth(0.945, 0.996, vein), 1.3)
    shade = 1.0 + (m - 0.5) * 0.042 - vein * (0.026 if not dark else -0.032)

    # Mặt vát từng viên gạch: sáng phía trên-trái, bóng nhẹ phía dưới-phải
    bw = c * 0.072
    hi = 1.0 - smooth(0, bw, np.minimum(u, v))
    lo = 1.0 - smooth(0, bw, np.minimum(c - u, c - v))
    shade = shade + hi * (0.048 if not dark else 0.085) - lo * (0.068 if not dark else 0.055)
    shade = shade + (0.5 - (u + v) / (2.0 * c)) * 0.024

    # Chuyển sáng dịu từ tâm sân ra 4 góc (không làm cháy trắng mặt gạch)
    rad = np.hypot(xx - N * 0.5, yy - N * 0.5) / (N * 0.707)
    shade = shade * (1.02 - 0.075 * (rad ** 1.5))
    img = base * shade[..., None]

    # Mạch vữa mảnh có chỉ vàng nhạt
    g = c * 0.013
    grout = 1.0 - smooth(g * 0.55, g * 1.55, np.minimum(np.minimum(u, c - u), np.minimum(v, c - v)))
    gcol = (c0 + c1) * 0.5 * (0.84 if not dark else 0.70)
    img = img * (1.0 - grout[..., None]) + gcol * grout[..., None]
    img = img + (spectral(N, N, 0.65, 13)[..., None] - 0.5) * 0.010

    # Ghép khung viền + huy hiệu trung tâm
    ov = _medallion_overlay(N, theme, cfg[0], cfg[1], cfg[2], cfg[3], cfg[4])
    img = blend_rgba(np.clip(img, 0, 1), ov)
    save(img, "court_%s.png" % theme)


def rrect(xx, yy, x0, y0, x1, y1, r):
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - r, (y1 - y0) / 2 - r
    qx, qy = np.abs(xx - cx) - hx, np.abs(yy - cy) - hy
    out = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0))
    return out + np.minimum(np.maximum(qx, qy), 0) - r


def side():
    W, H, n = 2816, 160, 22
    yy, xx = np.mgrid[0:H, 0:W].astype(F)
    a = np.full((H, W), 0.92, F)
    a += (spectral(W, H, 2.0, 21, sx=0.5, sy=2.0) - 0.5) * 0.03
    # Phào chỉ nổi trên (0–12%) và chân (88–100%)
    a = np.where(yy < H * 0.12, 0.99 - (yy / (H * 0.12)) * 0.07, a)
    a = np.where(np.abs(yy - H * 0.12) < 1.8, 0.70, a)
    a = np.where(yy > H * 0.88, 0.84, a)
    a = np.where(np.abs(yy - H * 0.88) < 1.6, 1.0, a)
    pw = W / n
    for k in range(n):
        x0, x1 = k * pw + pw * 0.075, (k + 1) * pw - pw * 0.075
        d = rrect(xx, yy, x0, H * 0.19, x1, H * 0.81, H * 0.11)
        inside = d < 0
        ring = (d > -4.5) & (d < 3.2)
        top = yy < H * 0.5
        a = np.where(ring & top, 1.0, a)
        a = np.where(ring & ~top, 0.76, a)
        depth = np.clip(-d / 11.0, 0, 1)
        fill = 0.78 + 0.09 * depth + 0.07 * ((yy - H * 0.19) / (H * 0.62))
        a = np.where(inside & (d < -4.5), fill, a)
    a = blur_arr(a, 0.65)
    save(a, "side.png", "L")


def plinth():
    W, H = 2816, 128
    rows, per = 2, 16
    yy, xx = np.mgrid[0:H, 0:W].astype(F)
    rh = H / rows
    r = (yy // rh).astype(int)
    off = (r % 2) * (W / per / 2)
    bl = W / per
    bx = (xx + off) % bl
    by = yy % rh
    bid = ((xx + off) // bl).astype(int) + r * 97
    rng = np.random.default_rng(31)
    tone = rng.uniform(0.89, 1.0, 4000).astype(F)[bid % 4000]
    a = tone + (spectral(W, H, 1.8, 32) - 0.5) * 0.055
    a += (1 - smooth(0, 5.5, by)) * 0.07 - (1 - smooth(0, 5.5, rh - by)) * 0.09
    a += (1 - smooth(0, 5.5, bx)) * 0.035 - (1 - smooth(0, 5.5, bl - bx)) * 0.055
    mortar = (np.minimum(by, rh - by) < 2.2) | (np.minimum(bx, bl - bx) < 2.2)
    a = np.where(mortar, 0.68, a)
    a = blur_arr(a, 0.55)
    save(a, "plinth.png", "L")


def paper():
    N = 512
    g = spectral(N, N, 0.9, 41) * 0.6 + spectral(N, N, 2.2, 42) * 0.4
    a = 0.96 + (g - 0.5) * 0.048
    save(np.clip(a, 0, 1), "paper.png", "L")


if __name__ == "__main__":
    import sys
    os.makedirs(OUT, exist_ok=True)
    targets = [a for a in sys.argv[1:] if a in COURT]
    if targets:
        for t in targets:
            court(t)
    else:
        for t in COURT:
            court(t)
        side()
        plinth()
        paper()
