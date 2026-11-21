"""Build all 12 Collectible Chibi Figurine characters (c0..c11) for Monopoly ART_V3.

Technique (Commercial Pop Mart / Nendoroid / ZingPlay Grade):
  - 2x supersampled anime-vinyl face atlas (1024x1024 -> 512x512 LANCZOS) with low-set
    large expressive gradient irises, tapered upper lashes, clean sculpted brows & petite smiles;
    plus vertical Pop Mart airbrush gradient swatches (zero inter-swatch color bleeding).
  - Sculpted volumetric hair dome (continuous beveled hairline wrapping front bangs & side locks)
    layered with flat diamond-lens swept ribbon blades (never stacked spheres or pointy cones).
  - Continuous Bezier tubular sleeves/arms with cuffs, multi-layer open coats/lapels/collars/belts,
    and oversized recognizable silhouette props cleanly separated from torso.
  - 15-bone deterministic rig with explicit axis alignment & 6 responsive NLA clips.

Run:
  1) python app/tools/blender/blender_build_v3_chars.py --atlas
  2) Blender.exe -b -P app/tools/blender/blender_build_v3_chars.py -- [--only=0,9] [--subdiv=1]
"""

import math
import os
import sys
import numpy as np

if "--atlas" in sys.argv:
    from PIL import Image, ImageDraw, ImageFilter
else:
    import bpy
    import bmesh
    from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
V3_CHAR_OUT = os.path.normpath(os.path.join(HERE, "..", "..", "skin", "models3", "chars"))
ATLAS_DIR = os.path.normpath(os.path.join(HERE, "..", "..", ".tex_tmp"))
TEX_SIZE = 1024


def hex_rgb(hx):
    hx = hx.lstrip("#")
    return tuple(int(hx[i:i + 2], 16) for i in (0, 2, 4))


def hex_rgba(hx, a=255):
    return hex_rgb(hx) + (int(a),)


def mix_hex(h0, h1, t):
    r0, g0, b0 = hex_rgb(h0)
    r1, g1, b1 = hex_rgb(h1)
    t = max(0.0, min(1.0, t))
    return "#%02x%02x%02x" % (
        int(r0 * (1.0 - t) + r1 * t),
        int(g0 * (1.0 - t) + g1 * t),
        int(b0 * (1.0 - t) + b1 * t),
    )


# Palette & personality configuration for all 12 cast IDs (strictly matching data.gd & PROMPT.md 4.2)
CHAR_SPECS = {
    0: dict(
        name="Chu Tich Tap Doan", skin="#f8ceb6", hair="#36241f", eye="#24130f", iris="#7a4822",
        top="#213d78", bot="#16264a", acc1="#d8343a", acc2="#ffffff", shoe="#47281a",
        hat="#36241f", prop1="#8f4f24", prop2="#f4c242", prop3="#4d2811",
        eye_style="confident", smile="warm_smile", lash=False, pattern="pinstripe_navy", hat_tex="solid",
    ),
    1: dict(
        name="Nu Tong Tai", skin="#fce2d4", hair="#26171b", eye="#1d0d16", iris="#9e335c",
        top="#b5243e", bot="#47101f", acc1="#f5d167", acc2="#fff5f7", shoe="#5c1024",
        hat="#b5243e", prop1="#1e293b", prop2="#38bdf8", prop3="#f43f5e",
        eye_style="cat", smile="smirk_smile", lash=True, pattern="houndstooth_red", hat_tex="solid",
    ),
    2: dict(
        name="Ong Hoang Tai Phiet", skin="#f8d2ba", hair="#d8deea", eye="#26193b", iris="#6d4cc2",
        top="#6a3ea1", bot="#361c5c", acc1="#f4c242", acc2="#fcf8f2", shoe="#492175",
        hat="#f4c242", prop1="#f4c242", prop2="#e11d48", prop3="#8b5cf6",
        eye_style="jolly", smile="open_laugh", lash=False, pattern="royal_purple", hat_tex="crown_gold",
    ),
    3: dict(
        name="Tieu Thu Thuong Luu", skin="#fde4d7", hair="#201518", eye="#171012", iris="#218c7a",
        top="#189c8d", bot="#fcf8f2", acc1="#f58eb0", acc2="#f7c85c", shoe="#11695e",
        hat="#f58eb0", prop1="#fff2f5", prop2="#e85d9a", prop3="#189c8d",
        eye_style="sweet", smile="gentle_smile", lash=True, pattern="aodai_lotus", hat_tex="fan_lotus",
    ),
    4: dict(
        name="Dai Gia Nghi Duong", skin="#eab085", hair="#66381c", eye="#21140d", iris="#1496b0",
        top="#f27649", bot="#183d63", acc1="#fef08a", acc2="#ffffff", shoe="#1d90b8",
        hat="#e69d24", prop1="#3da83b", prop2="#f43f5e", prop3="#fef9c3",
        eye_style="cheerful", smile="open_laugh", lash=False, pattern="hawaii_coral", hat_tex="coconut",
    ),
    5: dict(
        name="Canh Sat Truong", skin="#f4c5a5", hair="#28201d", eye="#1b1715", iris="#496632",
        top="#4c6b36", bot="#324524", acc1="#f0c23c", acc2="#d9e0cc", shoe="#1f1e22",
        hat="#4c6b36", prop1="#cbd5e1", prop2="#5e371f", prop3="#f0c23c",
        eye_style="stern_kind", smile="warm_smile", lash=False, pattern="uniform_olive", hat_tex="kepi_band",
    ),
    6: dict(
        name="Ky Su Dia Oc", skin="#f5c6a6", hair="#362219", eye="#21130d", iris="#945524",
        top="#ed6a1c", bot="#244069", acc1="#d4f739", acc2="#ffffff", shoe="#693e1e",
        hat="#f2b400", prop1="#2b84f0", prop2="#94a3b8", prop3="#f2b400",
        eye_style="happy", smile="wide_grin", lash=False, pattern="hivis_stripe", hat_tex="blueprint",
    ),
    7: dict(
        name="Founder Khoi Nghiep", skin="#fad6bf", hair="#24202b", eye="#1c1926", iris="#59a82b",
        top="#8090a6", bot="#2b3444", acc1="#a3d433", acc2="#f1f5f9", shoe="#323947",
        hat="#a3d433", prop1="#c46b2c", prop2="#16a34a", prop3="#f5efe6",
        eye_style="energetic", smile="cheer_smile", lash=True, pattern="hoodie_knit", hat_tex="cap_coffee",
    ),
    8: dict(
        name="Nu Vlogger Du Lich", skin="#fce3d4", hair="#803923", eye="#261217", iris="#cc397c",
        top="#eb5b99", bot="#2e4063", acc1="#fff2d6", acc2="#6ee7b7", shoe="#eb4e8a",
        hat="#f7e6cf", prop1="#334155", prop2="#38bdf8", prop3="#f472b6",
        eye_style="sparkle", smile="cheer_smile", lash=True, pattern="plaid_pink", hat_tex="bucket_stitch",
    ),
    9: dict(
        name="Dia Chu Mien Tay", skin="#f4c4a2", hair="#261812", eye="#21110b", iris="#9e4c1c",
        top="#96612d", bot="#322a27", acc1="#f7f1e6", acc2="#d83f36", shoe="#6e3c1e",
        hat="#ebd092", prop1="#43ad38", prop2="#284d1a", prop3="#f3dfb8",
        eye_style="jolly", smile="open_laugh", lash=False, pattern="khan_ran", hat_tex="non_la",
    ),
    10: dict(
        name="Tay Choi Pho Wall", skin="#f6ccb0", hair="#522f1a", eye="#1f150f", iris="#c4811d",
        top="#272a32", bot="#191c22", acc1="#ebb634", acc2="#ffffff", shoe="#1a181c",
        hat="#522f1a", prop1="#2ea34d", prop2="#ebb634", prop3="#0f172a",
        eye_style="confident", smile="smirk_smile", lash=False, pattern="pinstripe_wall", hat_tex="dollar_bill",
    ),
    11: dict(
        name="Ty Phu Vu Tru", skin="#fde4d8", hair="#70301e", eye="#1a1536", iris="#2d7cf7",
        top="#f4f7fc", bot="#254896", acc1="#f26b1d", acc2="#38bdf8", shoe="#f26b1d",
        hat="#254896", prop1="#f4c242", prop2="#38bdf8", prop3="#fef08a",
        eye_style="sparkle", smile="cheer_smile", lash=True, pattern="space_patch", hat_tex="visor_cyan",
    ),
}


def paint_char_atlas(cid, path):
    """Paint 1024x1024 Pop Mart face (2x SS) + crisp outfit pattern + gradient vinyl swatches."""
    sp = CHAR_SPECS[cid]
    im = Image.new("RGBA", (TEX_SIZE, TEX_SIZE), hex_rgba(sp["top"]))

    # ---------------- QUADRANT (0..512, 0..512): 2x Supersampled Pop Mart Chibi Face (1024 -> 512) ----------------
    F = 1024
    face = Image.new("RGBA", (F, F), hex_rgba(sp["skin"]))

    # Soft diffused blush & translucent brow-edge shadow
    blush = Image.new("RGBA", (F, F), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blush)
    # Subtle warm upper hairline ambient gradient (kept light & smooth)
    bd.ellipse([-80, -240, F + 80, 320], fill=hex_rgba(mix_hex(sp["skin"], "#d47552", 0.20), 82))
    # Soft rosy coral cheek ellipses placed directly below outer eye corners
    bd.ellipse([112, 622, 324, 738], fill=hex_rgba("#ff6e8c", 132))
    bd.ellipse([F - 324, 622, F - 112, 738], fill=hex_rgba("#ff6e8c", 132))
    # Gentle warm upper-eyelid blush shading
    for ex_b in (312, F - 312):
        bd.ellipse([ex_b - 96, 488, ex_b + 96, 560], fill=hex_rgba(mix_hex(sp["skin"], "#de6e52", 0.35), 90))
    blush = blush.filter(ImageFilter.GaussianBlur(34))
    face.alpha_composite(blush, (0, 0))
    fd = ImageDraw.Draw(face)

    # Eyebrows & Big Sparkling Pop Mart Eyes positioned LOWER on face (ey=584, ex=312/712)
    brow_col = hex_rgba(mix_hex(sp["hair"], "#2c1814", 0.35)) if cid != 2 else hex_rgba("#6e768c")
    eye_dark = hex_rgba(sp["eye"])
    iris_mid = hex_rgba(sp["iris"])
    iris_glow = hex_rgba(mix_hex(sp["iris"], "#fff2bd", 0.56))
    lash_dark = hex_rgba("#1c0d14")

    for ex, sgn in [(312, -1), (712, 1)]:
        ey = 584
        # 1) Delicate tapered curved eyebrow polygon (~14px thick center -> 4px tips)
        by = 446
        if sp["eye_style"] in ("cat", "confident"):
            bpts = [(ex - 68 * sgn, by + 10), (ex + 10 * sgn, by - 22), (ex + 72 * sgn, by - 4)]
        elif sp["eye_style"] == "stern_kind":
            bpts = [(ex - 72, by + 2), (ex, by - 16), (ex + 72, by + 2)]
        else:
            bpts = [(ex - 70, by + 12), (ex, by - 22), (ex + 70, by + 12)]
        bw = 14 if sp["lash"] else 18
        fd.line(bpts, fill=brow_col, width=bw, joint="curve")
        for ept in (bpts[0], bpts[-1]):
            r_end = bw * 0.44
            fd.ellipse([ept[0] - r_end, ept[1] - r_end, ept[0] + r_end, ept[1] + r_end], fill=brow_col)

        # 2) Clean ivory sclera almond/oval + soft upper lid crease
        rx_w, ry_w = 96, 102
        fd.ellipse([ex - rx_w, ey - ry_w, ex + rx_w, ey + ry_w], fill=hex_rgba("#fffaf7"))
        fd.arc([ex - 86, ey - 118, ex + 86, ey - 28], 208, 332, fill=hex_rgba(mix_hex(sp["skin"], "#a85a44", 0.42)), width=6)

        # 3) Gradient vinyl iris (deep dark upper rim -> vivid colored body -> warm glow crescent)
        rx_i, ry_i = 72, 86
        fd.ellipse([ex - rx_i, ey - ry_i + 4, ex + rx_i, ey + ry_i + 4], fill=eye_dark)
        fd.chord([ex - 64, ey - 58, ex + 64, ey + 82], 8, 172, fill=iris_mid)
        fd.chord([ex - 46, ey + 14, ex + 46, ey + 74], 12, 168, fill=iris_glow)
        fd.ellipse([ex - 34, ey - 32, ex + 34, ey + 38], fill=hex_rgba("#0d070a"))

        # 4) Tapered upper lash wing polygon (sweeping gracefully wider on outside)
        lash_poly = []
        for st_i in range(13):
            t = st_i / 12.0
            ang = math.radians(196 + t * 150)  # outer/inner arc over top
            # Outer side gets extra thickness (sgn < 0 => left eye outer is left/196deg)
            outer_u = (1.0 - t) if sgn < 0 else t
            thick = 14.0 + 18.0 * (outer_u ** 1.2)
            ox = ex + math.cos(ang) * (rx_w + 4)
            oy = ey + math.sin(ang) * (ry_w + 4) - thick * 0.45
            lash_poly.append((ox, oy))
        for st_i in range(12, -1, -1):
            t = st_i / 12.0
            ang = math.radians(196 + t * 150)
            ix = ex + math.cos(ang) * (rx_w - 3)
            iy = ey + math.sin(ang) * (ry_w - 3)
            lash_poly.append((ix, iy))
        fd.polygon(lash_poly, fill=lash_dark)
        if sp["lash"]:
            lx = ex + sgn * (rx_w - 6)
            fd.polygon([
                (lx - sgn * 14, ey - 46),
                (lx + sgn * 34, ey - 70),
                (lx + sgn * 12, ey - 22),
            ], fill=lash_dark)

        # 5) Twin glossy Nendoroid catchlights + subtle third sparkle dot
        fd.ellipse([ex - 42, ey - 50, ex - 2, ey - 8], fill=hex_rgba("#ffffff"))
        fd.ellipse([ex + 22, ey + 24, ex + 44, ey + 46], fill=hex_rgba("#ffffff", 238))
        if sp["eye_style"] in ("sparkle", "sweet", "cat"):
            fd.ellipse([ex + 28, ey - 38, ex + 42, ey - 24], fill=hex_rgba("#ffffff", 220))

    # Petite charming Nendoroid mouth centered cleanly below nose (y ~ 744 in 1024)
    m_line = hex_rgba("#9c2d40" if not sp["lash"] else "#bf3654")
    if sp["smile"] in ("open_laugh", "wide_grin", "cheer_smile"):
        fd.chord([444, 718, 580, 796], 0, 180, fill=hex_rgba("#b53149"), outline=m_line, width=7)
        fd.chord([458, 725, 566, 764], 0, 180, fill=hex_rgba("#fffaf7"))
        fd.chord([468, 766, 556, 794], 0, 180, fill=hex_rgba("#f47286"))
    elif sp["smile"] == "smirk_smile":
        fd.arc([448, 706, 574, 766], 18, 146, fill=m_line, width=13)
        fd.ellipse([562, 738, 578, 752], fill=m_line)
    else:
        fd.arc([444, 700, 580, 768], 20, 160, fill=m_line, width=13)
        fd.ellipse([486, 764, 538, 780], fill=hex_rgba("#f58da2", 125))

    im.paste(face.resize((512, 512), Image.LANCZOS), (0, 0))
    d = ImageDraw.Draw(im)

    # ---------------- TOP-RIGHT (512..1024, 0..256): PATTERN A ----------------
    pat = sp["pattern"]
    d.rectangle([512, 0, 1024, 256], fill=hex_rgba(sp["top"]))
    if pat in ("pinstripe_navy", "pinstripe_wall"):
        scol = hex_rgba(mix_hex(sp["top"], "#ffffff", 0.24))
        for gx in range(524, 1024, 24):
            d.rectangle([gx, 0, gx + 4, 256], fill=scol)
    elif pat == "houndstooth_red":
        c2 = hex_rgba(mix_hex(sp["top"], "#400b18", 0.34))
        for gy in range(0, 256, 32):
            for gx in range(512, 1024, 32):
                if ((gx // 32) + (gy // 32)) % 2 == 0:
                    d.rectangle([gx, gy, gx + 32, gy + 32], fill=c2)
    elif pat == "royal_purple":
        d.rectangle([512, 196, 1024, 256], fill=hex_rgba(sp["acc1"]))
        for gx in range(544, 1024, 64):
            d.ellipse([gx - 14, 72, gx + 14, 100], fill=hex_rgba(sp["acc1"]))
    elif pat == "aodai_lotus":
        for gy in (70, 175):
            for gx in range(560, 1000, 96):
                ox = gx + (48 if gy > 100 else 0)
                d.ellipse([ox - 12, gy - 22, ox + 12, gy + 16], fill=hex_rgba("#76e0d2", 180))
                d.ellipse([ox - 24, gy - 8, ox, gy + 18], fill=hex_rgba("#f9a8d4", 180))
                d.ellipse([ox, gy - 8, ox + 24, gy + 18], fill=hex_rgba("#f9a8d4", 180))
    elif pat == "hawaii_coral":
        for gx, gy in [(580, 68), (720, 150), (880, 65), (960, 185), (650, 200), (810, 120)]:
            for ang_i in range(5):
                a = 2 * math.pi * ang_i / 5.0
                px_f, py_f = gx + math.cos(a) * 18, gy + math.sin(a) * 18
                d.ellipse([px_f - 14, py_f - 14, px_f + 14, py_f + 14], fill=hex_rgba("#fff6a8"))
            d.ellipse([gx - 9, gy - 9, gx + 9, gy + 9], fill=hex_rgba("#f43f5e"))
        for gx, gy in [(640, 90), (830, 180), (950, 95)]:
            d.polygon([(gx, gy - 20), (gx + 26, gy + 12), (gx - 14, gy + 16)], fill=hex_rgba("#1b9e6b"))
    elif pat == "hivis_stripe":
        d.rectangle([512, 95, 1024, 165], fill=hex_rgba("#e2fb3c"))
        d.rectangle([512, 114, 1024, 146], fill=hex_rgba("#f8fafc"))
    elif pat == "hoodie_knit":
        d.rectangle([512, 210, 1024, 256], fill=hex_rgba(sp["acc1"]))
        for gy in range(8, 200, 20):
            d.line([(512, gy), (1024, gy)], fill=hex_rgba(mix_hex(sp["top"], "#ffffff", 0.14)), width=3)
    elif pat == "plaid_pink":
        for gx in range(512, 1024, 48):
            d.rectangle([gx, 0, gx + 18, 256], fill=hex_rgba("#ffc2dd", 130))
        for gy in range(0, 256, 48):
            d.rectangle([512, gy, 1024, gy + 18], fill=hex_rgba("#ffffff", 110))
    elif pat == "khan_ran":
        d.rectangle([512, 0, 1024, 256], fill=hex_rgba("#f7f1e6"))
        cell = 24
        for gy in range(0, 256, cell):
            for gx in range(512, 1024, cell):
                if (((gx - 512) // cell) + (gy // cell)) % 2 == 0:
                    d.rectangle([gx, gy, min(gx + cell, 1024), min(gy + cell, 256)], fill=hex_rgba("#242024"))
        d.rectangle([512, 0, 1024, 16], fill=hex_rgba("#c43138"))
        d.rectangle([512, 238, 1024, 256], fill=hex_rgba("#c43138"))
    elif pat == "space_patch":
        d.rectangle([512, 180, 1024, 256], fill=hex_rgba("#f26b1d"))
        d.rectangle([512, 100, 1024, 130], fill=hex_rgba("#254896"))
        d.rectangle([512, 130, 1024, 148], fill=hex_rgba("#f26b1d"))

    # ---------------- MID-RIGHT (512..1024, 256..512): PATTERN B (hat / blueprint / cash / chart) ----------------
    htex = sp["hat_tex"]
    if htex == "non_la":
        cx_h, cy_h = 768, 384
        d.rectangle([512, 256, 1024, 512], fill=hex_rgba("#ebd092"))
        for r in range(10, 122, 10):
            d.ellipse([cx_h - r, cy_h - r, cx_h + r, cy_h + r], outline=hex_rgba("#cfa454"), width=3)
        d.ellipse([cx_h - 118, cy_h - 118, cx_h + 118, cy_h + 118], outline=hex_rgba("#a87832"), width=5)
    elif htex == "blueprint":
        d.rectangle([512, 256, 1024, 512], fill=hex_rgba("#1d68c4"))
        for gx in range(512, 1024, 32):
            d.line([(gx, 256), (gx, 512)], fill=hex_rgba("#93c5fd", 140), width=2)
        for gy in range(256, 512, 32):
            d.line([(512, gy), (1024, gy)], fill=hex_rgba("#93c5fd", 140), width=2)
        d.rectangle([590, 310, 860, 460], outline=hex_rgba("#ffffff"), width=5)
    elif htex == "fan_lotus":
        d.rectangle([512, 256, 1024, 512], fill=hex_rgba("#fff3f6"))
        for ang_i in range(0, 180, 18):
            r_l = 120
            x2 = 768 + math.cos(math.radians(ang_i)) * r_l
            y2 = 490 - math.sin(math.radians(ang_i)) * r_l
            d.line([(768, 490), (x2, y2)], fill=hex_rgba("#d97757"), width=3)
        d.ellipse([725, 360, 810, 440], fill=hex_rgba("#f472b6"))
    elif htex == "dollar_bill":
        d.rectangle([512, 256, 1024, 512], fill=hex_rgba("#2ea34d"))
        d.rectangle([532, 276, 1004, 492], outline=hex_rgba("#bbf7d0"), width=6)
        d.ellipse([718, 334, 818, 434], fill=hex_rgba("#86efac"), outline=hex_rgba("#166534"), width=4)
    elif htex == "visor_cyan":
        d.rectangle([512, 256, 1024, 512], fill=hex_rgba("#1e40af"))
        d.rectangle([512, 256, 1024, 340], fill=hex_rgba("#60a5fa"))
        d.rectangle([560, 290, 740, 330], fill=hex_rgba("#e0f2fe"))
    else:
        d.rectangle([512, 256, 1024, 512], fill=hex_rgba(sp["prop1"]))
        if cid == 1:
            d.rectangle([530, 274, 1006, 494], fill=hex_rgba("#0f172a"))
            for bx, bh, bc in [(570, 90, "#f43f5e"), (640, 130, "#fbbf24"), (710, 175, "#34d399"), (780, 155, "#38bdf8"), (850, 195, "#a78bfa")]:
                d.rectangle([bx, 470 - bh, bx + 48, 470], fill=hex_rgba(bc))

    # ---------------- BOTTOM HALF (0..1024, 512..1024): 16 POP MART AIRBRUSHED VINYL SWATCHES ----------------
    # Each swatch (256x128) carries a gentle warm highlight-to-rich-shade vertical gradient inside safe inner band!
    sw_hex = [
        sp["top"], sp["bot"], sp["acc1"], sp["acc2"],
        sp["shoe"], sp["skin"], sp["hair"], sp["hat"],
        "#f4c242", "#faf5ec", "#23222a", sp["prop1"],
        sp["prop2"], sp["prop3"], "#d92b4c", "#2d68d6",
    ]
    for idx_s, hx in enumerate(sw_hex):
        row = idx_s // 4
        col = idx_s % 4
        x0, y0 = col * 256, 512 + row * 128
        hi_c = mix_hex(hx, "#fff6eb", 0.14)
        lo_c = mix_hex(hx, "#1b0d1f", 0.20)
        d.rectangle([x0, y0, x0 + 256, y0 + 128], fill=hex_rgba(hx))
        for ry in range(18, 110, 4):
            t_v = (ry - 18) / 92.0
            c_step = mix_hex(hi_c, hx, t_v * 2.0) if t_v < 0.5 else mix_hex(hx, lo_c, (t_v - 0.5) * 2.0)
            d.rectangle([x0 + 10, y0 + ry, x0 + 246, y0 + ry + 4], fill=hex_rgba(c_step))

    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)


# ---------------- BLENDER SUBSURF & SCULPTED CHIBI MESH HELPERS ----------------
def px_uv(px, py):
    return (px / float(TEX_SIZE), 1.0 - py / float(TEX_SIZE))


def swatch_uv(idx, shade_t=0.45):
    row = idx // 4
    col = idx % 4
    t_s = max(0.0, min(1.0, float(shade_t)))
    return px_uv(col * 256.0 + 128.0, 512.0 + row * 128.0 + 28.0 + t_s * 72.0)


def apply_subsurf_bm(bm, levels=2):
    if levels <= 0:
        return bm
    tmp_mesh = bpy.data.meshes.new("_tmp_ss")
    bm.to_mesh(tmp_mesh)
    bm.free()
    tmp_obj = bpy.data.objects.new("_tmp_ss_obj", tmp_mesh)
    bpy.context.collection.objects.link(tmp_obj)
    mod = tmp_obj.modifiers.new(name="Sub", type="SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    mod.uv_smooth = "PRESERVE_CORNERS"
    bpy.context.view_layer.objects.active = tmp_obj
    bpy.ops.object.modifier_apply(modifier="Sub")
    bm_out = bmesh.new()
    bm_out.from_mesh(tmp_obj.data)
    bpy.data.objects.remove(tmp_obj, do_unlink=True)
    bpy.data.meshes.remove(tmp_mesh)
    return bm_out


def join_part(dst_bm, v_rules, part_records, part_bm, uv_mode, bone_rule, **uv_kw):
    vset = set()
    vert_map = {}
    bmesh.ops.recalc_face_normals(part_bm, faces=part_bm.faces)
    for pv in part_bm.verts:
        nv = dst_bm.verts.new(pv.co)
        v_rules[nv] = bone_rule(pv.co)
        vset.add(nv)
        vert_map[pv] = nv
    for pf in part_bm.faces:
        try:
            dst_bm.faces.new([vert_map[v] for v in pf.verts])
        except ValueError:
            pass
    part_bm.free()
    part_records.append((vset, uv_mode, uv_kw))


def build_chibi_head_part(cx=0.0, cy=-0.005, cz=0.745, sx=0.236, sy=0.206, sz=0.205):
    """Seamless Nendoroid head with soft chubby baby cheeks & subtle petite nose (0 seams)."""
    pbm = bmesh.new()
    bmesh.ops.create_cube(pbm, size=1.0)
    bmesh.ops.subdivide_edges(pbm, edges=pbm.edges[:], cuts=2, use_grid_fill=True)
    for v in pbm.verts:
        x, y, z = v.co.x * 2.0, v.co.y * 2.0, v.co.z * 2.0
        r = math.sqrt(max(x * x + y * y + z * z, 1e-6))
        ux, uy, uz = (x / r, y / r, z / r) if r > 0.1 else (0.0, 0.0, 0.0)
        # Soft round lower cheeks around z=-0.32 and slight jawline roundness
        cheek_boost = 1.0 + 0.095 * math.exp(-((uz + 0.32) ** 2) / 0.20)
        if uy < -0.50:
            uy *= 0.90  # Flatten front face slightly for clean anime vinyl expression
        # Delicate petite chibi button nose (never pointy!)
        if abs(x) < 0.12 and y < -0.78 and -0.32 < z < -0.05:
            uy -= 0.042
        v.co = Vector((cx + ux * sx * cheek_boost, cy + uy * sy, cz + uz * sz))
    return apply_subsurf_bm(pbm, levels=2)


def make_subsurf_box(size_xyz, center, rot=(0, 0, 0), cuts=1, levels=2, flare_bot=1.0, flare_top=1.0, taper_y=1.0):
    pbm = bmesh.new()
    bmesh.ops.create_cube(pbm, size=1.0)
    if cuts > 0:
        bmesh.ops.subdivide_edges(pbm, edges=pbm.edges[:], cuts=cuts, use_grid_fill=True)
    for v in pbm.verts:
        t = v.co.z + 0.5
        fl = flare_bot * (1.0 - t) + flare_top * t
        v.co.x *= size_xyz[0] * fl
        v.co.y *= size_xyz[1] * fl * taper_y
        v.co.z *= size_xyz[2]
    xf = Matrix.Translation(center) @ Euler(rot, "XYZ").to_matrix().to_4x4()
    bmesh.ops.transform(pbm, matrix=xf, verts=pbm.verts)
    return apply_subsurf_bm(pbm, levels=levels)


def make_subsurf_capsule(p0, p1, r0, r1, segs=16, levels=0):
    pbm = bmesh.new()
    p0v, p1v = Vector(p0), Vector(p1)
    d = p1v - p0v
    length = max(d.length, 1e-4)
    mid = (p0v + p1v) * 0.5
    q = d.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    res = bmesh.ops.create_uvsphere(pbm, u_segments=segs, v_segments=12, radius=1.0)
    xf = Matrix.Translation(mid) @ q
    split = 0.36
    for v in res["verts"]:
        uz = v.co.z
        xy_len = math.hypot(v.co.x, v.co.y)
        if uz > split:
            ang = ((uz - split) / (1.0 - split)) * (math.pi * 0.5)
            r = r1 * math.cos(ang)
            z_off = length * 0.5 + r1 * math.sin(ang)
        elif uz < -split:
            ang = ((-uz - split) / (1.0 - split)) * (math.pi * 0.5)
            r = r0 * math.cos(ang)
            z_off = -length * 0.5 - r0 * math.sin(ang)
        else:
            u = (uz + split) / (2.0 * split)
            r = r0 * (1.0 - u) + r1 * u
            z_off = (-0.5 + u) * length
        nx = (v.co.x / xy_len) * r if xy_len > 1e-6 else 0.0
        ny = (v.co.y / xy_len) * r if xy_len > 1e-6 else 0.0
        v.co = xf @ Vector((nx, ny, z_off))
    return apply_subsurf_bm(pbm, levels=levels) if levels > 0 else pbm


def make_bent_arm_tube(sh, el, hd, r_sh=0.045, r_el=0.040, r_wr=0.036, has_cuff=True):
    """Continuous curved arm sleeve without unsightly shoulder/elbow sphere seams."""
    sh_v, el_v, hd_v = Vector(sh), Vector(el), Vector(hd)
    pts = []
    # 7 smooth spline stations from deep inside shoulder -> elbow -> sleeve cuff
    steps = [0.0, 0.20, 0.42, 0.62, 0.80, 0.94, 1.0]
    radii = [r_sh * 0.96, r_sh, (r_sh + r_el) * 0.5, r_el, (r_el + r_wr) * 0.5, r_wr * (1.14 if has_cuff else 0.98), r_wr * (1.06 if has_cuff else 0.90)]
    for t_u, rr in zip(steps, radii):
        p_b = (1.0 - t_u) ** 2 * sh_v + 2.0 * (1.0 - t_u) * t_u * el_v + (t_u ** 2) * hd_v
        pts.append((p_b, rr))
    pbm = bmesh.new()
    rings = []
    cross_n = 14
    for i, (pt, rr) in enumerate(pts):
        if i == 0:
            tan = (pts[1][0] - pt).normalized()
        elif i == len(pts) - 1:
            tan = (pt - pts[i - 1][0]).normalized()
        else:
            tan = (pts[i + 1][0] - pts[i - 1][0]).normalized()
        up_r = Vector((0.0, 1.0, 0.0)) if abs(tan.y) < 0.9 else Vector((1.0, 0.0, 0.0))
        u_ax = tan.cross(up_r).normalized()
        v_ax = u_ax.cross(tan).normalized()
        ring = []
        for j in range(cross_n):
            a = 2.0 * math.pi * j / cross_n
            ring.append(pbm.verts.new(pt + (u_ax * math.cos(a) + v_ax * math.sin(a)) * rr))
        rings.append(ring)
    v_top = pbm.verts.new(pts[0][0] - (pts[1][0] - pts[0][0]).normalized() * 0.025)
    v_bot = pbm.verts.new(pts[-1][0] + (pts[-1][0] - pts[-2][0]).normalized() * 0.015)
    for i in range(len(pts) - 1):
        for j in range(cross_n):
            nj = (j + 1) % cross_n
            pbm.faces.new((rings[i][j], rings[i][nj], rings[i + 1][nj], rings[i + 1][j]))
    for j in range(cross_n):
        nj = (j + 1) % cross_n
        pbm.faces.new((v_top, rings[0][nj], rings[0][j]))
        pbm.faces.new((v_bot, rings[-1][j], rings[-1][nj]))
    return pbm


def make_sculpted_hair_dome(fringe_fn, dome_cx=0.0, dome_cy=0.014, dome_cz=0.752, dome_rx=0.244, dome_ry=0.218, dome_rz=0.214, extra_back_flare=0.0):
    """Volumetric anime/Pop Mart hair dome with custom beveled front bangline z_hem(theta)."""
    pbm = bmesh.new()
    n_u, n_v = 40, 12
    # theta=0 is straight front (-Y); +/-pi/2 sides; pi back (+Y)
    v_crown_out = pbm.verts.new(Vector((dome_cx, dome_cy + 0.01, dome_cz + dome_rz + 0.026)))
    v_crown_in = pbm.verts.new(Vector((dome_cx, dome_cy + 0.01, dome_cz + dome_rz - 0.018)))
    outer_rings = []
    inner_rings = []
    for iv in range(1, n_v + 1):
        t = iv / float(n_v)  # 0=crown, 1=hair hem
        ring_out = []
        ring_in = []
        for iu in range(n_u):
            th = -math.pi + (2.0 * math.pi * iu) / n_u
            sin_t, cos_t = math.sin(th), math.cos(th)
            # Hem target point around head
            z_hem = fringe_fn(th)
            z_top = dome_cz + dome_rz
            z_cur = z_top * (1.0 - t) + z_hem * t
            # Spherical XY envelope smoothly tracking skull height, widening slightly at lower hair tips
            dz_rel = max(-1.15, min(1.0, (z_cur - dome_cz) / dome_rz))
            r_lat = math.sqrt(max(0.06, 1.0 - max(-0.92, dz_rel) ** 2))
            if dz_rel < 0.0:
                r_lat = max(r_lat, 0.88 - dz_rel * 0.08)
            back_boost = extra_back_flare * t * max(0.0, -cos_t)
            # Crisp anime wedge bevel: thick crown/sides, sharp feathered edge right at t=1.0
            thick = (0.032 if abs(cos_t) < 0.5 else 0.028) * (1.0 - 0.70 * (t ** 3.2))
            rx_cur = dome_rx * r_lat + back_boost * 0.35
            ry_cur = dome_ry * r_lat + back_boost
            bx = dome_cx + sin_t * rx_cur
            by = dome_cy - cos_t * ry_cur
            # Inner lining hugs inside head edge seamlessly
            ix = dome_cx + sin_t * (dome_rx * r_lat * 0.90)
            iy = dome_cy - cos_t * (dome_ry * r_lat * 0.90)
            ox = bx + sin_t * thick
            oy = by - cos_t * thick
            oz = z_cur + 0.022 * (1.0 - t)
            iz = z_cur - 0.008 * (1.0 - t)
            ring_out.append(pbm.verts.new(Vector((ox, oy, oz))))
            ring_in.append(pbm.verts.new(Vector((ix, iy, iz))))
        outer_rings.append(ring_out)
        inner_rings.append(ring_in)

    # Outer shell skin
    for iu in range(n_u):
        niu = (iu + 1) % n_u
        pbm.faces.new((v_crown_out, outer_rings[0][iu], outer_rings[0][niu]))
        pbm.faces.new((v_crown_in, inner_rings[0][niu], inner_rings[0][iu]))
    for iv in range(n_v - 1):
        for iu in range(n_u):
            niu = (iu + 1) % n_u
            pbm.faces.new((outer_rings[iv][iu], outer_rings[iv + 1][iu], outer_rings[iv + 1][niu], outer_rings[iv][niu]))
            pbm.faces.new((inner_rings[iv][niu], inner_rings[iv + 1][niu], inner_rings[iv + 1][iu], inner_rings[iv][iu]))
    # Bottom beveled hem loop connecting outer & inner shells
    for iu in range(n_u):
        niu = (iu + 1) % n_u
        pbm.faces.new((outer_rings[-1][iu], inner_rings[-1][iu], inner_rings[-1][niu], outer_rings[-1][niu]))

    return apply_subsurf_bm(pbm, levels=1)


def make_hair_ribbon_blade(points_w_th, levels=1):
    """Sculpt flat wide diamond-lens anime hair blade [(Vector, half_w, half_th), ...] — NEVER sausages!"""
    pbm = bmesh.new()
    rings = []
    n_pts = len(points_w_th)
    # 6-point crisp lens section so hair edges look sculpted & clean after Subsurf 1
    for i, (pt, hw, hth) in enumerate(points_w_th):
        if i == 0:
            tan = (points_w_th[1][0] - pt).normalized()
        elif i == n_pts - 1:
            tan = (pt - points_w_th[i - 1][0]).normalized()
        else:
            tan = (points_w_th[i + 1][0] - points_w_th[i - 1][0]).normalized()
        radial = (Vector((pt.x, pt.y, pt.z)) - Vector((0.0, 0.0, 0.745))).normalized()
        if abs(radial.dot(tan)) > 0.92:
            radial = Vector((0.0, -1.0, 0.0))
        width_ax = tan.cross(radial).normalized()
        front_ax = width_ax.cross(tan).normalized()
        # Lens profile: sharp left/right bevels + plump rounded midrib
        pts_2d = [
            (-hw, 0.0),
            (-hw * 0.45, hth),
            (hw * 0.45, hth),
            (hw, 0.0),
            (hw * 0.45, -hth),
            (-hw * 0.45, -hth),
        ]
        rings.append([pbm.verts.new(pt + width_ax * lx + front_ax * ly) for lx, ly in pts_2d])

    v_s = pbm.verts.new(points_w_th[0][0] - (points_w_th[1][0] - points_w_th[0][0]).normalized() * (points_w_th[0][1] * 0.35))
    v_e = pbm.verts.new(points_w_th[-1][0] + (points_w_th[-1][0] - points_w_th[-2][0]).normalized() * (points_w_th[-1][1] * 0.45))
    cn = 6
    for i in range(n_pts - 1):
        for j in range(cn):
            nj = (j + 1) % cn
            pbm.faces.new((rings[i][j], rings[i][nj], rings[i + 1][nj], rings[i + 1][j]))
    for j in range(cn):
        nj = (j + 1) % cn
        pbm.faces.new((v_s, rings[0][nj], rings[0][j]))
        pbm.faces.new((v_e, rings[-1][j], rings[-1][nj]))
    return apply_subsurf_bm(pbm, levels=levels)


def make_sphere_bm(rad_xyz, center, rot=(0, 0, 0), u_segs=20, v_segs=14):
    pbm = bmesh.new()
    res = bmesh.ops.create_uvsphere(pbm, u_segments=u_segs, v_segments=v_segs, radius=1.0)
    xf = Matrix.Translation(center) @ Euler(rot, "XYZ").to_matrix().to_4x4() @ Matrix.Diagonal((*rad_xyz, 1.0))
    for v in res["verts"]:
        v.co = xf @ v.co
    return pbm


def make_cone_bm(r1, r2, depth, center, rot=(0, 0, 0), segs=24):
    pbm = bmesh.new()
    xf = Matrix.Translation(center) @ Euler(rot, "XYZ").to_matrix().to_4x4()
    bmesh.ops.create_cone(pbm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth, matrix=xf)
    return pbm


def make_torus_bm(major_r, minor_r, xf, maj_segs=32, min_segs=10):
    pbm = bmesh.new()
    rings = []
    for i in range(maj_segs):
        ang = 2.0 * math.pi * i / maj_segs
        ca, sa = math.cos(ang), math.sin(ang)
        loop = []
        for j in range(min_segs):
            phi = 2.0 * math.pi * j / min_segs
            r_xy = major_r + minor_r * math.cos(phi)
            loop.append(pbm.verts.new(xf @ Vector((r_xy * ca, r_xy * sa, minor_r * math.sin(phi)))))
        rings.append(loop)
    for i in range(maj_segs):
        n_i = (i + 1) % maj_segs
        for j in range(min_segs):
            n_j = (j + 1) % min_segs
            pbm.faces.new((rings[i][j], rings[n_i][j], rings[n_i][n_j], rings[i][n_j]))
    return pbm


def assign_part_uv(bm, faces, mode, **kw):
    uv_layer = bm.loops.layers.uv.verify()
    # Compute Z bounds for subtle vertical swatch shade gradient
    zs = [lp.vert.co.z for f in faces for lp in f.loops] if faces else [0.0]
    z_min, z_max = min(zs), max(zs)
    z_span = max(z_max - z_min, 0.05)

    for f in faces:
        for lp in f.loops:
            v = lp.vert.co
            if mode == "swatch":
                shade_t = 1.0 - (v.z - z_min) / z_span  # darker below, lighter above!
                lp[uv_layer].uv = swatch_uv(kw["idx"], shade_t=shade_t * 0.72 + 0.14)
            elif mode == "face_front":
                rel_x = (v.x - kw["cx"]) / kw["rx"]
                rel_y = (v.y - kw["cy"]) / kw["ry"]
                rel_z = (v.z - kw["cz"]) / kw["rz"]
                if rel_y < 0.14:
                    ang_x = math.atan2(rel_x, max(-rel_y, 0.08))
                    px = 256.0 + ang_x * 195.0
                    py = 262.0 - rel_z * 215.0
                    lp[uv_layer].uv = px_uv(np.clip(px, 20.0, 492.0), np.clip(py, 20.0, 492.0))
                else:
                    # Back of head stays safely inside clean skin margin of [0..512, 0..512]!
                    lp[uv_layer].uv = px_uv(256.0, 34.0)
            elif mode == "pat_a":
                px = 528.0 + ((v.x + 0.35) * 650.0 + abs(v.y) * 240.0) % 480.0
                py = 16.0 + ((0.55 - v.z) * 520.0) % 224.0
                lp[uv_layer].uv = px_uv(px, py)
            elif mode == "pat_b_flat":
                px = 528.0 + ((v.x + 0.45) * 420.0) % 480.0
                py = 272.0 + ((0.65 - v.z) * 420.0) % 224.0
                lp[uv_layer].uv = px_uv(px, py)
            elif mode == "nonla":
                c_rel = Vector((v.x, v.y, v.z)) - Vector(kw["center"])
                r_n = min(1.0, math.hypot(c_rel.x, c_rel.y) / kw["radius"])
                ang = math.atan2(c_rel.y, c_rel.x)
                px = 768.0 + math.cos(ang) * r_n * 114.0
                py = 384.0 + math.sin(ang) * r_n * 114.0
                lp[uv_layer].uv = px_uv(px, py)
            elif mode == "fan_lotus":
                rel_x = (v.x - kw["cx"]) / max(kw["r"], 0.01)
                rel_z = (v.z - kw["cz"]) / max(kw["r"], 0.01)
                px = 768.0 + np.clip(rel_x, -1.0, 1.0) * 210.0
                py = 492.0 - np.clip(rel_z, 0.0, 1.0) * 210.0
                lp[uv_layer].uv = px_uv(px, py)


# ---------------- HAIR PRESET BUILDERS (Sculpted Volumetric Dome + Wide Tapered Blades) ----------------
def add_hair(bm, vr, rec, cid):
    h_rule = lambda co: {"Head": 1.0}

    def sideburns_pair(z_bot=0.675, w=0.042):
        for sgn in (-1, 1):
            sb = [
                (Vector((sgn * 0.210, -0.095, 0.805)), w, 0.013),
                (Vector((sgn * 0.228, -0.065, 0.740)), w * 0.85, 0.012),
                (Vector((sgn * 0.212, -0.045, z_bot)), w * 0.28, 0.008),
            ]
            join_part(bm, vr, rec, make_hair_ribbon_blade(sb, levels=1), "swatch", h_rule, idx=6)

    if cid == 0:
        # Executive sleek 7/3 side-part sweep across forehead (NO center pointy spike!)
        def f0(th):
            if abs(th) < 1.05:
                v_part = 0.055 * math.exp(-((th + 0.36) ** 2) / 0.05)
                return 0.785 + 0.020 * abs(th) + v_part
            if abs(th) < 1.65:
                return 0.700
            return 0.655
        join_part(bm, vr, rec, make_sculpted_hair_dome(f0, dome_rz=0.208), "swatch", h_rule, idx=6)
        # Wide sculpted side-parted frontal wave curving gracefully over brow right
        wave = [
            (Vector((-0.09, -0.195, 0.865)), 0.075, 0.016),
            (Vector((0.02, -0.222, 0.842)), 0.088, 0.018),
            (Vector((0.15, -0.175, 0.812)), 0.068, 0.016),
            (Vector((0.225, -0.075, 0.755)), 0.036, 0.012),
        ]
        join_part(bm, vr, rec, make_hair_ribbon_blade(wave, levels=1), "swatch", h_rule, idx=6)
        sideburns_pair(0.680, 0.036)

    elif cid == 1:
        # Female CEO: Asymmetric sleek S-bangs + lush round Chignon top bun + gold hairpin!
        def f1(th):
            if abs(th) < 1.15:
                return 0.778 + 0.048 * math.exp(-((th + 0.32) ** 2) / 0.06)
            if abs(th) < 1.65:
                return 0.685
            return 0.640
        join_part(bm, vr, rec, make_sculpted_hair_dome(f1), "swatch", h_rule, idx=6)
        # Plump round top-back bun (never boxy hat cylinder!) + ornate slanted hairpin
        bun_c = Vector((0.0, 0.058, 0.985))
        join_part(bm, vr, rec, make_sphere_bm((0.108, 0.105, 0.096), bun_c, (0.2, 0, 0), 22, 16), "swatch", h_rule, idx=6)
        join_part(bm, vr, rec, make_torus_bm(0.096, 0.014, Matrix.Translation((0.0, 0.050, 0.935)) @ Euler((0.22, 0, 0), "XYZ").to_matrix().to_4x4(), 24, 8), "swatch", h_rule, idx=8)
        join_part(bm, vr, rec, make_subsurf_capsule((-0.145, 0.055, 0.955), (0.145, 0.065, 1.015), 0.009, 0.009, 10, 0), "swatch", h_rule, idx=8)
        join_part(bm, vr, rec, make_sphere_bm((0.024, 0.024, 0.024), (0.148, 0.065, 1.016)), "swatch", h_rule, idx=12)
        # Wide sculpted S-swoop bangs
        sw_l = [(Vector((-0.07, -0.198, 0.865)), 0.078, 0.016), (Vector((0.08, -0.222, 0.835)), 0.082, 0.017), (Vector((0.215, -0.125, 0.775)), 0.052, 0.014), (Vector((0.220, -0.045, 0.655)), 0.025, 0.010)]
        sw_r = [(Vector((-0.07, -0.198, 0.865)), 0.058, 0.014), (Vector((-0.175, -0.165, 0.815)), 0.054, 0.014), (Vector((-0.228, -0.055, 0.695)), 0.032, 0.011)]
        join_part(bm, vr, rec, make_hair_ribbon_blade(sw_l, levels=1), "swatch", h_rule, idx=6)
        join_part(bm, vr, rec, make_hair_ribbon_blade(sw_r, levels=1), "swatch", h_rule, idx=6)

    elif cid == 2:
        # Royal Silver Fluffy Curls flanking rosy cheeks cleanly under Royal Crown!
        def f2(th):
            if abs(th) < 1.1:
                return 0.785 + 0.040 * math.exp(-((th) ** 2) / 0.07)
            if abs(th) < 1.7:
                return 0.680
            return 0.605
        join_part(bm, vr, rec, make_sculpted_hair_dome(f2, dome_rx=0.250, dome_ry=0.222, extra_back_flare=0.015), "swatch", h_rule, idx=6)
        for sgn in (-1, 1):
            lock = [
                (Vector((sgn * 0.02, -0.20, 0.860)), 0.068, 0.015),
                (Vector((sgn * 0.145, -0.205, 0.822)), 0.072, 0.016),
                (Vector((sgn * 0.232, -0.095, 0.735)), 0.056, 0.016),
                (Vector((sgn * 0.220, -0.025, 0.630)), 0.032, 0.012),
            ]
            join_part(bm, vr, rec, make_hair_ribbon_blade(lock, levels=1), "swatch", h_rule, idx=6)

    elif cid == 3:
        # Tieu Thu Ao Dai: Flowing curtain fringe + sleek waist-length back drape + twin front shoulder locks + pastel silk bow!
        def f3(th):
            if abs(th) < 1.05:
                return 0.772 + 0.046 * math.exp(-((th) ** 2) / 0.06)
            if abs(th) < 1.7:
                return 0.675
            return 0.435  # long cascading black hair down the back!
        join_part(bm, vr, rec, make_sculpted_hair_dome(f3, extra_back_flare=0.055), "swatch", h_rule, idx=6)
        # Wide feathered front fringe curtains (smooth concave curve, 0 sausages!)
        for sgn in (-1, 1):
            fr = [
                (Vector((sgn * 0.012, -0.206, 0.862)), 0.065, 0.014),
                (Vector((sgn * 0.125, -0.212, 0.820)), 0.070, 0.015),
                (Vector((sgn * 0.222, -0.115, 0.740)), 0.048, 0.014),
                (Vector((sgn * 0.208, -0.085, 0.565)), 0.040, 0.012),
                (Vector((sgn * 0.165, -0.105, 0.440)), 0.022, 0.008),
            ]
            join_part(bm, vr, rec, make_hair_ribbon_blade(fr, levels=1), "swatch", h_rule, idx=6)
        # Big signature pink silk ribbon bow at top-back of hair
        for sgn in (-1, 1):
            join_part(bm, vr, rec, make_subsurf_box((0.125, 0.045, 0.085), (sgn * 0.095, 0.105, 0.942), (0.28, 0, sgn * 0.24), cuts=1, levels=2, flare_bot=0.72), "swatch", h_rule, idx=2)
        join_part(bm, vr, rec, make_sphere_bm((0.036, 0.036, 0.036), (0.0, 0.108, 0.942)), "swatch", h_rule, idx=2)

    elif cid == 4:
        # Resort Mogul: Stylish wavy swept surf locks (no messy brow lumps!)
        def f4(th):
            if abs(th) < 1.1:
                return 0.788 + 0.042 * math.exp(-((th + 0.30) ** 2) / 0.07)
            return 0.660
        join_part(bm, vr, rec, make_sculpted_hair_dome(f4, dome_rz=0.212), "swatch", h_rule, idx=6)
        # Windblown surfer wave ribbons
        for bx, tx, tz in [(-0.08, 0.12, 0.855), (0.02, 0.21, 0.805), (-0.16, -0.22, 0.775)]:
            wv = [
                (Vector((bx, -0.185, 0.885)), 0.068, 0.015),
                (Vector(((bx + tx) * 0.55, -0.218, 0.848)), 0.072, 0.016),
                (Vector((tx, -0.165, tz)), 0.042, 0.012),
            ]
            join_part(bm, vr, rec, make_hair_ribbon_blade(wv, levels=1), "swatch", h_rule, idx=6)
        sideburns_pair(0.680, 0.038)

    elif cid in (5, 6, 9):
        # Clean tailored youth fringe + sideburns neatly tucked under Kepi / Hard-hat / Non La
        def fc_neat(th):
            if abs(th) < 1.05:
                return 0.780 + 0.040 * math.exp(-((th - 0.18) ** 2) / 0.06)
            return 0.665
        join_part(bm, vr, rec, make_sculpted_hair_dome(fc_neat, dome_rx=0.240, dome_ry=0.214, dome_rz=0.206), "swatch", h_rule, idx=6)
        # Smooth two-piece asymmetric swept bangs hugging brow cleanly under cap brim
        b_l = [(Vector((-0.02, -0.198, 0.855)), 0.088, 0.015), (Vector((0.12, -0.205, 0.818)), 0.080, 0.015), (Vector((0.218, -0.105, 0.768)), 0.042, 0.012)]
        b_r = [(Vector((-0.03, -0.198, 0.855)), 0.072, 0.014), (Vector((-0.15, -0.185, 0.815)), 0.068, 0.014), (Vector((-0.225, -0.095, 0.755)), 0.038, 0.012)]
        join_part(bm, vr, rec, make_hair_ribbon_blade(b_l, levels=1), "swatch", h_rule, idx=6)
        join_part(bm, vr, rec, make_hair_ribbon_blade(b_r, levels=1), "swatch", h_rule, idx=6)
        sideburns_pair(0.675, 0.038)

    elif cid == 7:
        # Tech Founder: Trendy K-pop 5/5 parted layered curtain bangs framing face under Headphones!
        def f7(th):
            if abs(th) < 1.1:
                return 0.778 + 0.055 * math.exp(-((th) ** 2) / 0.055)
            return 0.640
        join_part(bm, vr, rec, make_sculpted_hair_dome(f7, extra_back_flare=0.018), "swatch", h_rule, idx=6)
        for sgn in (-1, 1):
            curt = [
                (Vector((0.0, -0.202, 0.865)), 0.065, 0.014),
                (Vector((sgn * 0.115, -0.216, 0.815)), 0.076, 0.016),
                (Vector((sgn * 0.215, -0.115, 0.745)), 0.052, 0.014),
                (Vector((sgn * 0.210, -0.055, 0.655)), 0.026, 0.010),
            ]
            join_part(bm, vr, rec, make_hair_ribbon_blade(curt, levels=1), "swatch", h_rule, idx=6)

    elif cid == 8:
        # Travel Vlogger: Cute shoulder-length auburn C-curl inward bob hugging cheeks under Bucket Hat!
        def f8(th):
            if abs(th) < 1.05:
                return 0.775 + 0.044 * math.exp(-((th - 0.15) ** 2) / 0.06)
            return 0.565
        join_part(bm, vr, rec, make_sculpted_hair_dome(f8, extra_back_flare=0.048), "swatch", h_rule, idx=6)
        for sgn in (-1, 1):
            bob = [
                (Vector((sgn * 0.05, -0.205, 0.850)), 0.072, 0.014),
                (Vector((sgn * 0.18, -0.165, 0.775)), 0.068, 0.016),
                (Vector((sgn * 0.232, -0.045, 0.665)), 0.060, 0.018),
                (Vector((sgn * 0.185, 0.025, 0.575)), 0.046, 0.015),
            ]
            join_part(bm, vr, rec, make_hair_ribbon_blade(bob, levels=1), "swatch", h_rule, idx=6)

    elif cid == 10:
        # Wall Street Shark: Slick undercut swept sharply BACKWARD along crown (NO onion horn!)
        def f10(th):
            if abs(th) < 1.05:
                return 0.822 - 0.015 * abs(th)  # Higher slick hairline showing sharp brows!
            if abs(th) < 1.65:
                return 0.715
            return 0.665
        join_part(bm, vr, rec, make_sculpted_hair_dome(f10, dome_rz=0.206), "swatch", h_rule, idx=6)
        # 3 crisp wide brushed-back pompadour blades flowing horizontally toward crown back
        for sx_o, rx_b, z_b in [(-0.07, 0.075, 0.905), (0.01, 0.095, 0.925), (0.09, 0.072, 0.900)]:
            blade = [
                (Vector((sx_o, -0.175, 0.875)), rx_b, 0.015),
                (Vector((sx_o * 1.15, -0.075, z_b + 0.025)), rx_b * 1.08, 0.018),
                (Vector((sx_o * 1.1, 0.095, 0.910)), rx_b * 0.92, 0.015),
                (Vector((sx_o * 0.8, 0.195, 0.835)), rx_b * 0.55, 0.011),
            ]
            join_part(bm, vr, rec, make_hair_ribbon_blade(blade, levels=1), "swatch", h_rule, idx=6)
        sideburns_pair(0.690, 0.032)

    elif cid == 11:
        # Space Billionaire: Sweet feathery bangs inside modern open-face space helmet!
        def f11(th):
            if abs(th) < 1.1:
                return 0.785 + 0.035 * math.exp(-((th) ** 2) / 0.06)
            return 0.675
        join_part(bm, vr, rec, make_sculpted_hair_dome(f11, dome_rx=0.236, dome_ry=0.210, dome_rz=0.204), "swatch", h_rule, idx=6)
        for sgn in (-1, 1):
            fr = [
                (Vector((0.0, -0.202, 0.858)), 0.062, 0.013),
                (Vector((sgn * 0.105, -0.205, 0.822)), 0.068, 0.014),
                (Vector((sgn * 0.195, -0.125, 0.770)), 0.042, 0.012),
            ]
            join_part(bm, vr, rec, make_hair_ribbon_blade(fr, levels=1), "swatch", h_rule, idx=6)


# ---------------- HEADGEAR & GLASSES PER CHARACTER ----------------
def add_headgear_and_glasses(bm, vr, rec, cid):
    h_rule = lambda co: {"Head": 1.0}

    if cid == 0:
        # Delicate ultra-thin gold rectangular-round eyewear framing wide-open sparkling eyes!
        ey_z = 0.704
        for sgn in (-1, 1):
            gx = sgn * 0.088
            xf = Matrix.Translation((gx, -0.214, ey_z)) @ Euler((math.pi * 0.5, 0.0, 0.0), "XYZ").to_matrix().to_4x4()
            join_part(bm, vr, rec, make_torus_bm(0.066, 0.0046, xf, 24, 8), "swatch", h_rule, idx=8)
            join_part(bm, vr, rec, make_subsurf_capsule((gx + sgn * 0.064, -0.208, ey_z), (sgn * 0.218, -0.025, ey_z + 0.01), 0.004, 0.004, 8, 0), "swatch", h_rule, idx=8)
        join_part(bm, vr, rec, make_subsurf_capsule((-0.024, -0.218, ey_z + 0.006), (0.024, -0.218, ey_z + 0.006), 0.004, 0.004, 8, 0), "swatch", h_rule, idx=8)

    elif cid == 1:
        # Sleek chic burgundy/gold cat-eye frames framing sharp eyes without blocking gaze!
        ey_z = 0.706
        for sgn in (-1, 1):
            gx = sgn * 0.090
            xf = Matrix.Translation((gx, -0.214, ey_z)) @ Euler((math.pi * 0.5, 0.0, sgn * -0.14), "XYZ").to_matrix().to_4x4()
            join_part(bm, vr, rec, make_torus_bm(0.066, 0.0048, xf, 24, 8), "swatch", h_rule, idx=8)
            # Signature pointed cat-eye outer wing
            join_part(bm, vr, rec, make_subsurf_capsule((gx + sgn * 0.056, -0.210, ey_z + 0.036), (gx + sgn * 0.086, -0.195, ey_z + 0.056), 0.006, 0.003, 8, 0), "swatch", h_rule, idx=0)
            join_part(bm, vr, rec, make_subsurf_capsule((gx + sgn * 0.064, -0.206, ey_z + 0.02), (sgn * 0.218, -0.025, ey_z + 0.015), 0.004, 0.004, 8, 0), "swatch", h_rule, idx=8)
        join_part(bm, vr, rec, make_subsurf_capsule((-0.026, -0.218, ey_z + 0.008), (0.026, -0.218, ey_z + 0.008), 0.004, 0.004, 8, 0), "swatch", h_rule, idx=8)

    elif cid == 4:
        # Stylish Gold-Frame Aviators perched chicly UP on hair/forehead — FULL cheerful eyes visible!
        av_z = 0.848
        av_rot = Euler((math.pi * 0.36, 0.0, 0.0), "XYZ").to_matrix().to_4x4()
        for sgn in (-1, 1):
            gx = sgn * 0.080
            xf = Matrix.Translation((gx, -0.195, av_z)) @ av_rot
            join_part(bm, vr, rec, make_torus_bm(0.056, 0.0055, xf, 22, 8), "swatch", h_rule, idx=8)
            # Crisp cyan-teal gradient lens disk inside gold rim
            join_part(bm, vr, rec, make_cone_bm(0.052, 0.052, 0.008, (gx, -0.194, av_z), (math.pi * 0.36, 0, 0), segs=20), "swatch", h_rule, idx=12)
        join_part(bm, vr, rec, make_subsurf_capsule((-0.026, -0.205, av_z + 0.01), (0.026, -0.205, av_z + 0.01), 0.0045, 0.0045, 8, 0), "swatch", h_rule, idx=8)

    if cid == 2:
        # Compact Royal Velvet & Gold 5-peak Crown nestled snugly into silver hair!
        cr_rot = Euler((math.radians(-8.0), 0.0, 0.0), "XYZ")
        cr_xf = Matrix.Translation((0.0, -0.015, 0.935)) @ cr_rot.to_matrix().to_4x4()
        join_part(bm, vr, rec, make_torus_bm(0.115, 0.020, cr_xf, 28, 10), "swatch", h_rule, idx=8)
        join_part(bm, vr, rec, make_sphere_bm((0.104, 0.104, 0.055), (0.0, -0.015, 0.962), (-math.radians(8.0), 0, 0), 18, 12), "swatch", h_rule, idx=0)
        for p_i in range(5):
            ang = math.radians(-90 + (p_i - 2) * 56)
            px = math.sin(ang) * 0.112
            py = -math.cos(ang) * 0.112 - 0.015
            join_part(bm, vr, rec, make_cone_bm(0.032, 0.010, 0.072, (px, py, 0.972), (-math.radians(8.0), 0, 0), segs=12), "swatch", h_rule, idx=8)
            join_part(bm, vr, rec, make_sphere_bm((0.018, 0.018, 0.018), (px, py, 1.008)), "swatch", h_rule, idx=12 if p_i % 2 == 0 else 15)

    elif cid == 5:
        # Crisp Structured Olive Police Kepi Cap with glossy brim, gold braid & front star!
        cap_rot = (math.radians(-10.0), 0.0, 0.0)
        cap_c = Vector((0.0, 0.010, 0.945))
        join_part(bm, vr, rec, make_cone_bm(0.212, 0.268, 0.120, cap_c + Vector((0, 0, 0.055)), cap_rot, 32), "swatch", h_rule, idx=0)
        join_part(bm, vr, rec, make_cone_bm(0.214, 0.214, 0.044, cap_c, cap_rot, 32), "swatch", h_rule, idx=10)
        join_part(bm, vr, rec, make_subsurf_box((0.25, 0.175, 0.022), (0.0, -0.198, 0.892), (math.radians(14.0), 0, 0), cuts=1, levels=2, flare_bot=0.84), "swatch", h_rule, idx=10)
        # Gold emblem badge front + crisp gold chinstrap trim
        join_part(bm, vr, rec, make_sphere_bm((0.032, 0.018, 0.034), (0.0, -0.238, 0.968), cap_rot), "swatch", h_rule, idx=8)

    elif cid == 6:
        # Sleek Contoured Dome Hard-Hat hugging crown seamlessly + curved molded brim!
        hd_c = Vector((0.0, 0.008, 0.878))
        join_part(bm, vr, rec, make_sphere_bm((0.246, 0.236, 0.155), hd_c, (-0.08, 0, 0), 28, 18), "swatch", h_rule, idx=7)
        # Integrated subtle crown center rib (never sticks out awkwardly!)
        join_part(bm, vr, rec, make_subsurf_box((0.046, 0.34, 0.032), hd_c + Vector((0, 0.0, 0.145)), (-0.08, 0, 0), cuts=1, levels=2), "swatch", h_rule, idx=7)
        # Flush molded front brim wrapping brow
        join_part(bm, vr, rec, make_subsurf_box((0.255, 0.165, 0.020), (0.0, -0.205, 0.876), (0.14, 0, 0), cuts=1, levels=2, flare_bot=0.88), "swatch", h_rule, idx=7)

    elif cid == 7:
        # Chunky Modern Over-Ear Studio Headphones (lime rings + sleek matte charcoal earcups!)
        for i_a in range(16):
            a0 = math.radians(-82 + i_a * 164.0 / 16)
            a1 = math.radians(-82 + (i_a + 1) * 164.0 / 16)
            p0 = Vector((math.sin(a0) * 0.256, -0.008, 0.75 + math.cos(a0) * 0.238))
            p1 = Vector((math.sin(a1) * 0.256, -0.008, 0.75 + math.cos(a1) * 0.238))
            join_part(bm, vr, rec, make_subsurf_capsule(p0, p1, 0.022, 0.022, 10, 0), "swatch", h_rule, idx=10)
        for sgn in (-1, 1):
            join_part(bm, vr, rec, make_sphere_bm((0.052, 0.074, 0.080), (sgn * 0.258, -0.008, 0.735), (0, sgn * 0.10, 0), 18, 12), "swatch", h_rule, idx=10)
            join_part(bm, vr, rec, make_sphere_bm((0.030, 0.056, 0.060), (sgn * 0.280, -0.008, 0.735), (0, sgn * 0.10, 0), 16, 10), "swatch", h_rule, idx=2)

    elif cid == 8:
        # Pastel Cream Travel Bucket Hat with coral pink ribbon & cute bow!
        bh_c = Vector((0.0, 0.015, 0.905))
        bh_rot = (math.radians(-14.0), 0.0, 0.0)
        join_part(bm, vr, rec, make_cone_bm(0.236, 0.190, 0.120, bh_c + Vector((0, 0, 0.050)), bh_rot, 32), "swatch", h_rule, idx=7)
        join_part(bm, vr, rec, make_cone_bm(0.320, 0.228, 0.068, bh_c + Vector((0, 0, -0.012)), bh_rot, 32), "swatch", h_rule, idx=7)
        join_part(bm, vr, rec, make_cone_bm(0.238, 0.230, 0.026, bh_c + Vector((0, 0, 0.018)), bh_rot, 32), "swatch", h_rule, idx=0)
        join_part(bm, vr, rec, make_sphere_bm((0.035, 0.026, 0.030), (0.215, -0.065, 0.900), bh_rot), "swatch", h_rule, idx=0)

    elif cid == 9:
        # Authentic Woven Bamboo Non La tilted BACK (-22 deg) framing cheerful smile!
        hat_c = Vector((0.0, 0.042, 0.946))
        hat_rot = (math.radians(-22.0), 0.0, 0.0)
        hat_xf = Matrix.Translation(hat_c) @ Euler(hat_rot, "XYZ").to_matrix().to_4x4()
        pbm = make_cone_bm(0.290, 0.016, 0.205, (0, 0, 0.046), segs=40)
        bmesh.ops.transform(pbm, matrix=hat_xf, verts=pbm.verts)
        join_part(bm, vr, rec, pbm, "nonla", h_rule, center=(hat_c.x, hat_c.y, hat_c.z), radius=0.298)
        join_part(bm, vr, rec, make_torus_bm(0.288, 0.013, hat_xf @ Matrix.Translation((0.0, 0.0, -0.054)), 40, 10), "nonla", h_rule, center=(hat_c.x, hat_c.y, hat_c.z), radius=0.298)
        for sgn in (-1, 1):
            join_part(bm, vr, rec, make_subsurf_capsule(hat_xf @ Vector((sgn * 0.200, -0.01, -0.046)), (sgn * 0.130, -0.045, 0.630), 0.006, 0.006, 8, 0), "swatch", h_rule, idx=3)

    elif cid == 11:
        # Sleek Futuristic Open-Face Astronaut Helmet: aerodynamic white shell, blue brow visor, cobalt earpods + antenna!
        join_part(bm, vr, rec, make_torus_bm(0.175, 0.024, Matrix.Translation((0.0, 0.0, 0.542)), 28, 12), "swatch", h_rule, idx=1)
        pbm = bmesh.new()
        bmesh.ops.create_cube(pbm, size=1.0)
        bmesh.ops.subdivide_edges(pbm, edges=pbm.edges[:], cuts=2, use_grid_fill=True)
        for v in pbm.verts:
            x, y, z = v.co.x * 2.0, v.co.y * 2.0, v.co.z * 2.0
            r = math.sqrt(max(x * x + y * y + z * z, 1e-6))
            ux, uy, uz = (x / r, y / r, z / r) if r > 0.1 else (0.0, 0.0, 0.0)
            if uy < -0.14:
                uy = -0.14
            v.co = Vector((ux * 0.278, 0.022 + uy * 0.268, 0.748 + uz * 0.258))
        join_part(bm, vr, rec, apply_subsurf_bm(pbm, levels=2), "swatch", h_rule, idx=0)
        # Cobalt side earpod housings + bright cyan glossy brow shield + compact antenna
        for sgn in (-1, 1):
            join_part(bm, vr, rec, make_sphere_bm((0.042, 0.068, 0.068), (sgn * 0.272, 0.0, 0.742)), "swatch", h_rule, idx=1)
            join_part(bm, vr, rec, make_sphere_bm((0.022, 0.046, 0.046), (sgn * 0.295, 0.0, 0.742)), "swatch", h_rule, idx=2)
        join_part(bm, vr, rec, make_subsurf_box((0.32, 0.08, 0.056), (0.0, -0.195, 0.905), (0.28, 0, 0), cuts=1, levels=2, flare_bot=0.90), "swatch", h_rule, idx=13)
        join_part(bm, vr, rec, make_subsurf_capsule((0.276, 0.0, 0.768), (0.312, 0.0, 0.950), 0.012, 0.007, 10, 0), "swatch", h_rule, idx=2)
        join_part(bm, vr, rec, make_sphere_bm((0.022, 0.022, 0.022), (0.314, 0.0, 0.960)), "swatch", h_rule, idx=12)


# ---------------- CLOTHING, MULTI-LAYER COATS, LIMBS & SILHOUETTE PROPS ----------------
def build_character(cid):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    os.makedirs(ATLAS_DIR, exist_ok=True)
    os.makedirs(V3_CHAR_OUT, exist_ok=True)
    atlas_path = os.path.join(ATLAS_DIR, f"c{cid}_atlas.png")
    if not os.path.isfile(atlas_path):
        raise RuntimeError(f"Missing atlas {atlas_path}. Run with --atlas first.")

    sp = CHAR_SPECS[cid]
    bm = bmesh.new()
    v_rules = {}
    records = []

    # Expressive Silhouette Poses — every prop held cleanly OUTSIDE body outline for 12-Silhouette clarity!
    if cid == 0:  # Executive extending briefcase cleanly right, confident hand on hip left
        sh_r, el_r, hd_r = Vector((-0.155, 0.0, 0.46)), Vector((-0.265, -0.02, 0.34)), Vector((-0.285, -0.06, 0.23))
        sh_l, el_l, hd_l = Vector((0.155, 0.0, 0.46)), Vector((0.260, 0.02, 0.36)), Vector((0.185, -0.06, 0.29))
    elif cid == 1:  # Female CEO cradling glowing chart tablet left, poised gesture chin/chest right
        sh_r, el_r, hd_r = Vector((-0.14, 0.0, 0.46)), Vector((-0.24, -0.03, 0.37)), Vector((-0.15, -0.15, 0.44))
        sh_l, el_l, hd_l = Vector((0.14, 0.0, 0.46)), Vector((0.245, -0.02, 0.35)), Vector((0.20, -0.15, 0.39))
    elif cid == 2:  # Royal Billionaire planting grand ruby scepter outward right
        sh_r, el_r, hd_r = Vector((-0.165, 0.0, 0.46)), Vector((-0.280, -0.05, 0.37)), Vector((-0.305, -0.13, 0.41))
        sh_l, el_l, hd_l = Vector((0.165, 0.0, 0.46)), Vector((0.265, 0.03, 0.36)), Vector((0.195, -0.05, 0.28))
    elif cid == 3:  # Ao Dai heiress fanning lotus fan WIDE past right shoulder!
        sh_r, el_r, hd_r = Vector((-0.135, 0.0, 0.46)), Vector((-0.255, -0.04, 0.38)), Vector((-0.255, -0.13, 0.45))
        sh_l, el_l, hd_l = Vector((0.135, 0.0, 0.46)), Vector((0.220, 0.02, 0.35)), Vector((0.165, -0.07, 0.27))
    elif cid == 4:  # Resort Mogul toasting fresh coconut HIGH & WIDE right, casual wave left!
        sh_r, el_r, hd_r = Vector((-0.155, 0.0, 0.46)), Vector((-0.275, -0.04, 0.38)), Vector((-0.275, -0.13, 0.45))
        sh_l, el_l, hd_l = Vector((0.155, 0.0, 0.46)), Vector((0.250, 0.02, 0.35)), Vector((0.185, -0.06, 0.27))
    elif cid == 5:  # Police Chief raising hero baton smartly right
        sh_r, el_r, hd_r = Vector((-0.15, 0.0, 0.46)), Vector((-0.270, -0.03, 0.37)), Vector((-0.275, -0.12, 0.42))
        sh_l, el_l, hd_l = Vector((0.15, 0.0, 0.46)), Vector((0.245, 0.02, 0.35)), Vector((0.180, -0.05, 0.26))
    elif cid == 6:  # Architect lifting wrench right, clamping oversized blueprint tall over left shoulder!
        sh_r, el_r, hd_r = Vector((-0.155, 0.0, 0.46)), Vector((-0.275, -0.03, 0.37)), Vector((-0.265, -0.12, 0.43))
        sh_l, el_l, hd_l = Vector((0.155, 0.0, 0.46)), Vector((0.255, -0.02, 0.36)), Vector((0.215, -0.14, 0.41))
    elif cid == 7:  # Startup Founder raising iced coffee out right, cradling laptop out left
        sh_r, el_r, hd_r = Vector((-0.155, 0.0, 0.46)), Vector((-0.275, -0.04, 0.38)), Vector((-0.265, -0.13, 0.44))
        sh_l, el_l, hd_l = Vector((0.155, 0.0, 0.46)), Vector((0.255, 0.02, 0.34)), Vector((0.235, -0.06, 0.26))
    elif cid == 8:  # Travel Vlogger lifting tall selfie stick angled clear right
        sh_r, el_r, hd_r = Vector((-0.135, 0.0, 0.46)), Vector((-0.255, -0.04, 0.40)), Vector((-0.295, -0.12, 0.49))
        sh_l, el_l, hd_l = Vector((0.135, 0.0, 0.46)), Vector((0.225, 0.02, 0.35)), Vector((0.165, -0.06, 0.28))
    elif cid == 9:  # Mekong Land Baron carrying lush twin coconuts outward left, hand on hip right
        sh_r, el_r, hd_r = Vector((-0.15, 0.0, 0.465)), Vector((-0.265, 0.02, 0.365)), Vector((-0.185, -0.05, 0.285))
        sh_l, el_l, hd_l = Vector((0.15, 0.0, 0.465)), Vector((0.265, -0.02, 0.365)), Vector((0.245, -0.13, 0.40))
    elif cid == 10:  # Wall Street Shark fanning crisp green banknotes right & gold stock phone left
        sh_r, el_r, hd_r = Vector((-0.155, 0.0, 0.46)), Vector((-0.270, -0.04, 0.37)), Vector((-0.265, -0.12, 0.44))
        sh_l, el_l, hd_l = Vector((0.155, 0.0, 0.46)), Vector((0.260, -0.03, 0.37)), Vector((0.245, -0.12, 0.41))
    else:  # 11: Space Billionaire lifting ringed Saturn trophy wide & proud right!
        sh_r, el_r, hd_r = Vector((-0.155, 0.0, 0.46)), Vector((-0.285, -0.03, 0.40)), Vector((-0.305, -0.12, 0.49))
        sh_l, el_l, hd_l = Vector((0.155, 0.0, 0.46)), Vector((0.250, 0.02, 0.35)), Vector((0.215, -0.08, 0.28))

    # 1) High-Contrast Collectible Shoes / Boots / Sandals + Legs
    for sgn, side in [(-1, "R"), (1, "L")]:
        fx = sgn * 0.088
        foot_rule = lambda co, s=side: {f"Foot_{s}": 1.0}
        leg_rule = lambda co, s=side: {
            f"UpLeg_{s}": float(np.clip((co.z - 0.105) / 0.085, 0.0, 1.0)),
            f"Leg_{s}": float(1.0 - np.clip((co.z - 0.105) / 0.085, 0.0, 1.0)),
        }
        if cid == 9:  # Wooden Guoc Moc + crimson strap + visible bare toes
            join_part(bm, v_rules, records, make_subsurf_box((0.112, 0.172, 0.056), (fx, -0.018, 0.028), cuts=1, levels=1), "swatch", foot_rule, idx=4)
            join_part(bm, v_rules, records, make_subsurf_box((0.116, 0.056, 0.036), (fx, -0.044, 0.050), cuts=1, levels=1), "swatch", foot_rule, idx=3)
            join_part(bm, v_rules, records, make_sphere_bm((0.044, 0.046, 0.022), (fx, -0.072, 0.048), (0, 0, 0), 14, 10), "swatch", foot_rule, idx=5)
        elif cid == 4:  # Bright cerulean-blue resort sandals + coral flip-flop straps!
            join_part(bm, v_rules, records, make_subsurf_box((0.115, 0.176, 0.032), (fx, -0.018, 0.016), cuts=1, levels=1), "swatch", foot_rule, idx=4)
            join_part(bm, v_rules, records, make_sphere_bm((0.045, 0.055, 0.024), (fx, -0.055, 0.038), (0, 0, 0), 14, 10), "swatch", foot_rule, idx=5)
            join_part(bm, v_rules, records, make_subsurf_box((0.108, 0.044, 0.026), (fx, -0.032, 0.046), cuts=1, levels=1), "swatch", foot_rule, idx=0)
        elif cid in (7, 8):  # Sporty Pop Mart Chunky Sneakers (white midsole + colored shoe upper!)
            join_part(bm, v_rules, records, make_subsurf_box((0.118, 0.184, 0.032), (fx, -0.022, 0.016), cuts=1, levels=1), "swatch", foot_rule, idx=9)
            join_part(bm, v_rules, records, make_subsurf_box((0.110, 0.168, 0.064), (fx, -0.016, 0.052), cuts=1, levels=1, flare_bot=1.08, flare_top=0.86), "swatch", foot_rule, idx=4)
            join_part(bm, v_rules, records, make_subsurf_capsule((fx, 0.0, 0.065), (fx, 0.0, 0.125), 0.058, 0.056, 12, 0), "swatch", leg_rule, idx=9)
        elif cid == 11:  # Bold orange-cobalt space boots standing out sharply from cream base!
            join_part(bm, v_rules, records, make_subsurf_box((0.120, 0.186, 0.034), (fx, -0.022, 0.017), cuts=1, levels=1), "swatch", foot_rule, idx=1)
            join_part(bm, v_rules, records, make_subsurf_box((0.114, 0.172, 0.072), (fx, -0.016, 0.056), cuts=1, levels=1, flare_bot=1.08, flare_top=0.86), "swatch", foot_rule, idx=2)
            join_part(bm, v_rules, records, make_subsurf_capsule((fx, 0.0, 0.088), (fx, 0.0, 0.120), 0.062, 0.062, 12, 0), "swatch", leg_rule, idx=1)
        else:  # Crisp tailored boots / leather loafers
            join_part(bm, v_rules, records, make_subsurf_box((0.116, 0.180, 0.028), (fx, -0.020, 0.014), cuts=1, levels=1), "swatch", foot_rule, idx=10)
            join_part(bm, v_rules, records, make_subsurf_box((0.108, 0.166, 0.068), (fx, -0.016, 0.054), cuts=1, levels=1, flare_bot=1.08, flare_top=0.86), "swatch", foot_rule, idx=4)

        leg_idx = 5 if cid == 8 else (5 if cid == 4 else 1)
        join_part(bm, v_rules, records, make_subsurf_capsule((fx, 0.0, 0.074), (fx, 0.0, 0.240), 0.054, 0.072, 16, 0), "swatch", leg_rule, idx=leg_idx)
        if cid == 4:  # Dark Navy Resort Shorts over tanned knees!
            join_part(bm, v_rules, records, make_cone_bm(0.084, 0.074, 0.095, (fx, 0.0, 0.215), segs=18), "swatch", lambda co, s=side: {f"UpLeg_{s}": 0.8, "Hips": 0.2}, idx=1)

    # 2) Multi-Layer Sculpted Pop Mart Outfits, Open Jackets, Collars, Ao Dai & Accessories
    torso_rule = lambda co: (
        {"Hips": 1.0 - float(np.clip((co.z - 0.27) / 0.08, 0.0, 1.0)), "Spine": float(np.clip((co.z - 0.27) / 0.08, 0.0, 1.0))}
        if co.z < 0.37
        else {"Spine": 1.0 - float(np.clip((co.z - 0.37) / 0.08, 0.0, 1.0)), "Chest": float(np.clip((co.z - 0.37) / 0.08, 0.0, 1.0))}
    )
    skirt_rule = lambda co: {"Hips": 0.65, "UpLeg_L": 0.175 if co.x >= 0 else 0.0, "UpLeg_R": 0.175 if co.x < 0 else 0.0, "Spine": 0.175}

    if cid == 3:
        # Authentic Graceful Ao Dai: fitted turquoise silk bodice + high collar + front/back flowing silk flaps!
        join_part(bm, v_rules, records, make_subsurf_box((0.280, 0.230, 0.285), (0.0, 0.0, 0.375), cuts=1, levels=2, flare_bot=1.06, flare_top=0.92), "pat_a", torso_rule)
        join_part(bm, v_rules, records, make_subsurf_box((0.245, 0.028, 0.220), (0.0, -0.135, 0.185), (-0.18, 0, 0), cuts=1, levels=1, flare_bot=1.28, flare_top=0.88), "pat_a", skirt_rule)
        join_part(bm, v_rules, records, make_subsurf_box((0.245, 0.028, 0.220), (0.0, 0.135, 0.185), (0.18, 0, 0), cuts=1, levels=1, flare_bot=1.28, flare_top=0.88), "pat_a", skirt_rule)
        join_part(bm, v_rules, records, make_cone_bm(0.080, 0.076, 0.056, (0.0, 0.0, 0.516), segs=20), "swatch", lambda co: {"Chest": 0.6, "Head": 0.4}, idx=0)
        # Pearl trim brooch & delicate side waist sash
        join_part(bm, v_rules, records, make_sphere_bm((0.022, 0.015, 0.022), (0.055, -0.145, 0.44)), "swatch", lambda co: {"Chest": 1.0}, idx=2)
    else:
        t_mode = "pat_a" if sp["pattern"] in ("pinstripe_navy", "pinstripe_wall", "houndstooth_red", "hawaii_coral", "hivis_stripe", "space_patch") else "swatch"
        w_t = 0.340 if cid in (0, 2, 9) else (0.320 if cid in (4, 5, 6, 7, 10, 11) else 0.290)
        # Base inner shirt/vest vs outer jacket layering!
        if cid in (0, 1, 4):
            # Inner shirt body + Open outer Blazer / Hawaiian Aloha Panels framing V-front!
            inner_idx = 3 if cid in (0, 1, 4) else 0
            join_part(bm, v_rules, records, make_subsurf_box((w_t * 0.90, w_t * 0.78, 0.285), (0.0, 0.0, 0.370), cuts=1, levels=2, flare_bot=1.08, flare_top=0.88), "swatch", torso_rule, idx=inner_idx)
            # Back & Left/Right sculpted open-front blazer/shirt halves leaving central V crisp!
            join_part(bm, v_rules, records, make_subsurf_box((w_t, w_t * 0.52, 0.295), (0.0, 0.055, 0.370), cuts=1, levels=2, flare_bot=1.12, flare_top=0.90), t_mode, torso_rule, idx=0)
            for sgn in (-1, 1):
                join_part(bm, v_rules, records, make_subsurf_box((w_t * 0.42, w_t * 0.44, 0.290), (sgn * w_t * 0.30, -0.055, 0.365), (0, sgn * -0.06, 0), cuts=1, levels=2, flare_bot=1.12, flare_top=0.88), t_mode, torso_rule, idx=0)
                if cid in (0, 1):  # Crisp sculpted coat lapel collars!
                    join_part(bm, v_rules, records, make_subsurf_box((0.055, 0.030, 0.130), (sgn * 0.068, -0.145, 0.445), (-0.18, sgn * 0.20, sgn * -0.30), cuts=1, levels=1), t_mode, lambda co: {"Chest": 0.85, "Spine": 0.15}, idx=0)
            if cid == 0:
                join_part(bm, v_rules, records, make_subsurf_box((0.040, 0.026, 0.165), (0.0, -0.142, 0.390), (-0.08, 0, 0), cuts=1, levels=1, flare_bot=1.25, flare_top=0.5), "swatch", lambda co: {"Chest": 0.65, "Spine": 0.35}, idx=2)
                join_part(bm, v_rules, records, make_subsurf_box((0.036, 0.016, 0.028), (-0.095, -0.152, 0.435), cuts=1, levels=1), "swatch", lambda co: {"Chest": 0.9, "Spine": 0.1}, idx=8)
            if cid == 1:
                join_part(bm, v_rules, records, make_cone_bm(0.162, 0.158, 0.038, (0.0, 0.0, 0.285), segs=22), "swatch", lambda co: {"Hips": 0.6, "Spine": 0.4}, idx=2)
        else:
            join_part(bm, v_rules, records, make_subsurf_box((w_t, w_t * 0.88, 0.295), (0.0, 0.0, 0.370), cuts=1, levels=2, flare_bot=1.12, flare_top=0.88), t_mode, torso_rule, idx=0)

        if cid in (1, 8):
            join_part(bm, v_rules, records, make_cone_bm(0.215, 0.148, 0.135, (0.0, 0.0, 0.225), segs=24), "swatch", skirt_rule, idx=1)
        if cid == 2:  # Rich Regal Crimson Cape + Sculpted Collar Fur Shoulder Mantle!
            join_part(bm, v_rules, records, make_subsurf_box((0.38, 0.055, 0.365), (0.0, 0.152, 0.315), (0.26, 0, 0), cuts=1, levels=1, flare_bot=1.25, flare_top=0.84), "swatch", lambda co: {"Spine": 0.4, "Chest": 0.6}, idx=14)
            for sgn in (-1, 1):
                join_part(bm, v_rules, records, make_sphere_bm((0.088, 0.075, 0.048), (sgn * 0.105, -0.025, 0.495), (0.2, 0, sgn * 0.3), 16, 12), "swatch", lambda co: {"Chest": 0.85, "Head": 0.15}, idx=9)
            join_part(bm, v_rules, records, make_sphere_bm((0.095, 0.068, 0.048), (0.0, 0.088, 0.495), (0, 0, 0), 16, 12), "swatch", lambda co: {"Chest": 0.85, "Head": 0.15}, idx=9)
            join_part(bm, v_rules, records, make_sphere_bm((0.036, 0.024, 0.036), (0.0, -0.152, 0.465)), "swatch", lambda co: {"Chest": 0.9, "Spine": 0.1}, idx=8)
        if cid in (5, 6):
            join_part(bm, v_rules, records, make_cone_bm(0.178, 0.174, 0.042, (0.0, 0.0, 0.295), segs=22), "swatch", lambda co: {"Hips": 0.6, "Spine": 0.4}, idx=10)
            join_part(bm, v_rules, records, make_subsurf_box((0.056, 0.032, 0.046), (0.0, -0.175, 0.295), cuts=1, levels=1), "swatch", lambda co: {"Hips": 0.6, "Spine": 0.4}, idx=8)
            if cid == 5:
                for sgn in (-1, 1):
                    join_part(bm, v_rules, records, make_subsurf_box((0.085, 0.052, 0.024), (sgn * 0.125, -0.005, 0.495), (0, sgn * 0.15, 0), cuts=1, levels=1), "swatch", lambda co: {"Chest": 0.9, "Spine": 0.1}, idx=8)
                join_part(bm, v_rules, records, make_sphere_bm((0.024, 0.020, 0.028), (-0.02, -0.165, 0.415)), "swatch", lambda co: {"Chest": 0.9, "Spine": 0.1}, idx=11)
        if cid == 7:
            join_part(bm, v_rules, records, make_subsurf_box((0.21, 0.06, 0.10), (0.0, -0.155, 0.295), (-0.12, 0, 0), cuts=1, levels=1, flare_bot=1.15, flare_top=0.8), "swatch", lambda co: {"Hips": 0.6, "Spine": 0.4}, idx=2)
            # Soft draped rear hood cowl behind neck (never torus ring!)
            join_part(bm, v_rules, records, make_subsurf_box((0.24, 0.12, 0.08), (0.0, 0.075, 0.500), (0.45, 0, 0), cuts=1, levels=2, flare_bot=1.10, flare_top=0.90), "swatch", lambda co: {"Chest": 0.85, "Head": 0.15}, idx=0)
            for sgn in (-1, 1):
                join_part(bm, v_rules, records, make_subsurf_capsule((sgn * 0.042, -0.145, 0.485), (sgn * 0.048, -0.162, 0.395), 0.009, 0.009, 8, 0), "swatch", lambda co: {"Chest": 0.9, "Spine": 0.1}, idx=3)
        if cid == 8:
            join_part(bm, v_rules, records, make_subsurf_box((0.12, 0.05, 0.055), (0.0, -0.125, 0.495), cuts=1, levels=1), "swatch", lambda co: {"Chest": 0.85, "Head": 0.15}, idx=9)
            join_part(bm, v_rules, records, make_subsurf_box((0.21, 0.12, 0.23), (0.0, 0.165, 0.365), cuts=1, levels=2), "swatch", lambda co: {"Chest": 0.5, "Spine": 0.5}, idx=3)
            join_part(bm, v_rules, records, make_subsurf_box((0.17, 0.05, 0.11), (0.0, 0.220, 0.315), cuts=1, levels=2), "swatch", lambda co: {"Chest": 0.5, "Spine": 0.5}, idx=2)
        if cid == 9:  # Ba Ba buttons + Flat-draped Khan Ran shawl collar + hanging front checkered tails!
            join_part(bm, v_rules, records, make_subsurf_box((0.034, 0.022, 0.19), (0.0, -0.162, 0.370), (-0.06, 0, 0), cuts=1, levels=1), "swatch", lambda co: {"Chest": 0.5, "Spine": 0.5}, idx=0)
            for bz in (0.30, 0.35, 0.40, 0.45):
                join_part(bm, v_rules, records, make_sphere_bm((0.012, 0.009, 0.012), (0.0, -0.172 + (bz - 0.30) * 0.07, bz)), "swatch", lambda co: {"Chest": 0.5, "Spine": 0.5}, idx=9)
            # Soft shoulder cape shawl (flat draped around shoulders, NO rubber ring!)
            join_part(bm, v_rules, records, make_subsurf_box((0.26, 0.22, 0.055), (0.0, 0.005, 0.502), (0.08, 0, 0), cuts=1, levels=2, flare_bot=1.18, flare_top=0.86), "pat_a", lambda co: {"Chest": 0.85, "Head": 0.15})
            join_part(bm, v_rules, records, make_subsurf_box((0.054, 0.026, 0.135), (-0.044, -0.168, 0.422), (-0.18, 0.06, 0.18), cuts=1, levels=1), "pat_a", lambda co: {"Chest": 0.85, "Spine": 0.15})
            join_part(bm, v_rules, records, make_subsurf_box((0.052, 0.026, 0.118), (0.036, -0.168, 0.432), (-0.18, -0.06, -0.16), cuts=1, levels=1), "pat_a", lambda co: {"Chest": 0.85, "Spine": 0.15})
        if cid == 10:  # Wall Street Shark: crisp white shirt V, bold crimson tie & bright gold Y-suspenders!
            join_part(bm, v_rules, records, make_subsurf_box((0.12, 0.04, 0.19), (0.0, -0.145, 0.42), (-0.12, 0, 0), cuts=1, levels=1, flare_bot=0.40, flare_top=1.0), "swatch", lambda co: {"Chest": 0.8, "Spine": 0.2}, idx=9)
            join_part(bm, v_rules, records, make_subsurf_box((0.040, 0.030, 0.165), (0.0, -0.162, 0.390), (-0.10, 0, 0), cuts=1, levels=1, flare_bot=1.25, flare_top=0.5), "swatch", lambda co: {"Chest": 0.6, "Spine": 0.4}, idx=14)
            for sgn in (-1, 1):
                join_part(bm, v_rules, records, make_subsurf_box((0.028, 0.032, 0.225), (sgn * 0.075, -0.145, 0.385), (-0.08, 0, 0), cuts=1, levels=1), "swatch", lambda co: {"Chest": 0.5, "Spine": 0.5}, idx=2)
        if cid == 11:  # Cobalt Belt + Orange Telemetry Chest Pack + Twin White/Orange Jetpack Pods!
            join_part(bm, v_rules, records, make_cone_bm(0.175, 0.172, 0.044, (0.0, 0.0, 0.292), segs=22), "swatch", lambda co: {"Hips": 0.6, "Spine": 0.4}, idx=1)
            join_part(bm, v_rules, records, make_subsurf_box((0.15, 0.046, 0.11), (0.0, -0.162, 0.40), cuts=1, levels=1), "swatch", lambda co: {"Chest": 0.9, "Spine": 0.1}, idx=2)
            join_part(bm, v_rules, records, make_subsurf_box((0.24, 0.13, 0.24), (0.0, 0.18, 0.375), cuts=1, levels=2), "swatch", lambda co: {"Chest": 0.6, "Spine": 0.4}, idx=1)
            for sgn in (-1, 1):
                join_part(bm, v_rules, records, make_cone_bm(0.055, 0.038, 0.20, (sgn * 0.072, 0.21, 0.385), segs=16), "swatch", lambda co: {"Chest": 0.6, "Spine": 0.4}, idx=9)
                join_part(bm, v_rules, records, make_cone_bm(0.046, 0.028, 0.05, (sgn * 0.072, 0.21, 0.265), segs=16), "swatch", lambda co: {"Chest": 0.6, "Spine": 0.4}, idx=12)

    # Neck + Head + Sculpted Hair + Refined Headgear/Glasses
    join_part(bm, v_rules, records, make_subsurf_capsule((0.0, 0.0, 0.49), (0.0, 0.0, 0.565), 0.062, 0.056, 12, 1), "swatch", lambda co: {"Chest": 0.4, "Head": 0.6}, idx=5)
    join_part(bm, v_rules, records, build_chibi_head_part(0.0, -0.005, 0.745, 0.236, 0.206, 0.205), "face_front", lambda co: {"Head": 1.0}, cx=0.0, cy=-0.005, cz=0.745, rx=0.236, ry=0.206, rz=0.205)
    for sgn in (-1, 1):
        join_part(bm, v_rules, records, make_sphere_bm((0.032, 0.028, 0.040), (sgn * 0.220, 0.015, 0.700)), "swatch", lambda co: {"Head": 1.0}, idx=5)
    add_hair(bm, v_rules, records, cid)
    add_headgear_and_glasses(bm, v_rules, records, cid)

    # 3) Seamless Curved Sleeve/Arm Tubes + Toy Mitten Hands
    sleeve_idx = 0 if cid != 10 else 3  # c10 wears crisp white rolled dress shirt!
    for sgn, side, sh, el, hd in [(-1, "R", sh_r, el_r, hd_r), (1, "L", sh_l, el_l, hd_l)]:
        arm_weight = lambda co, s=side, e_v=el: {f"Arm_{s}": float(np.clip((co - e_v).length / 0.14, 0.2, 1.0)) if co.z >= e_v.z else 0.15,
                                                f"ForeArm_{s}": float(np.clip(1.0 - max(co.z - e_v.z, 0.0) / 0.10, 0.0, 1.0))}
        if cid == 4:
            # Aloha short sleeve (sh -> mid-arm) + bare tan forearm!
            mid_a = sh.lerp(el, 0.70)
            join_part(bm, v_rules, records, make_bent_arm_tube(sh, sh.lerp(mid_a, 0.5), mid_a, 0.048, 0.046, 0.046, has_cuff=True), "swatch", lambda co, s=side: {f"Arm_{s}": 1.0}, idx=0)
            join_part(bm, v_rules, records, make_bent_arm_tube(mid_a, el, hd, 0.038, 0.038, 0.034, has_cuff=False), "swatch", lambda co, s=side: {f"Arm_{s}": 0.25, f"ForeArm_{s}": 0.75}, idx=5)
        else:
            join_part(bm, v_rules, records, make_bent_arm_tube(sh, el, hd, 0.046, 0.041, 0.038, has_cuff=True), "swatch", arm_weight, idx=sleeve_idx)
        # Cute mitten hand + thumb neatly emerging from cuff
        hand_idx = 9 if cid == 11 else 5
        join_part(bm, v_rules, records, make_sphere_bm((0.043, 0.043, 0.041), hd, u_segs=14, v_segs=10), "swatch", lambda co, s=side: {f"ForeArm_{s}": 1.0}, idx=hand_idx)
        join_part(bm, v_rules, records, make_sphere_bm((0.019, 0.021, 0.026), hd + Vector((-sgn * 0.024, -0.022, 0.018)), (0.2, sgn * 0.4, 0), 10, 8), "swatch", lambda co, s=side: {f"ForeArm_{s}": 1.0}, idx=hand_idx)

    # 4) Oversized Silhouette Props — Unmistakable in Pure Black Silhouette Row!
    pr_r = lambda co: {"ForeArm_R": 1.0}
    pr_l = lambda co: {"ForeArm_L": 1.0}
    if cid == 0:
        bc_c = hd_r + Vector((-0.04, -0.02, -0.105))
        join_part(bm, v_rules, records, make_subsurf_box((0.080, 0.23, 0.175), bc_c, (0, 0.14, -0.12), cuts=1, levels=2), "swatch", pr_r, idx=11)
        join_part(bm, v_rules, records, make_subsurf_box((0.032, 0.072, 0.024), bc_c + Vector((0, 0, 0.095)), cuts=1, levels=1), "swatch", pr_r, idx=12)
        join_part(bm, v_rules, records, make_subsurf_box((0.088, 0.034, 0.034), bc_c + Vector((-0.01, 0, 0.044)), cuts=1, levels=1), "swatch", pr_r, idx=12)
    elif cid == 1:
        tb_c = hd_l + Vector((0.02, -0.04, 0.04))
        tb_r = (0.35, -0.20, 0.30)
        join_part(bm, v_rules, records, make_subsurf_box((0.205, 0.024, 0.148), tb_c, tb_r, cuts=1, levels=1), "swatch", pr_l, idx=11)
        join_part(bm, v_rules, records, make_subsurf_box((0.185, 0.028, 0.128), tb_c + Vector((0, -0.004, 0)), tb_r, cuts=1, levels=0), "pat_b_flat", pr_l)
    elif cid == 2:
        sc_bot = hd_r + Vector((-0.02, -0.02, -0.24))
        sc_top = hd_r + Vector((-0.04, -0.05, 0.27))
        join_part(bm, v_rules, records, make_subsurf_capsule(sc_bot, sc_top, 0.016, 0.022, 12, 0), "swatch", pr_r, idx=8)
        join_part(bm, v_rules, records, make_sphere_bm((0.066, 0.066, 0.072), sc_top + Vector((0, 0, 0.052)), u_segs=18, v_segs=12), "swatch", pr_r, idx=12)
        join_part(bm, v_rules, records, make_torus_bm(0.068, 0.012, Matrix.Translation(sc_top + Vector((0, 0, 0.048))), 20, 8), "swatch", pr_r, idx=8)
    elif cid == 3:
        fc = hd_r + Vector((-0.03, -0.03, 0.02))
        for k_fan in range(-3, 4):
            a_f = k_fan * 0.25
            f_rot = (-0.20, 0.42 + a_f, -0.35)
            tip = fc + Euler(f_rot, "XYZ").to_matrix() @ Vector((0.0, -0.01, 0.165))
            join_part(bm, v_rules, records, make_subsurf_capsule(fc, tip, 0.013, 0.040, 10, 0), "fan_lotus", pr_r, cx=fc.x, cz=fc.z, r=0.18)
    elif cid == 4:
        cc = hd_r + Vector((-0.04, -0.03, 0.07))
        join_part(bm, v_rules, records, make_sphere_bm((0.092, 0.092, 0.100), cc, u_segs=18, v_segs=12), "swatch", pr_r, idx=11)
        join_part(bm, v_rules, records, make_cone_bm(0.070, 0.075, 0.020, cc + Vector((0, 0, 0.075)), segs=16), "swatch", pr_r, idx=13)
        join_part(bm, v_rules, records, make_subsurf_capsule(cc + Vector((0.02, 0, 0.06)), cc + Vector((0.045, -0.03, 0.22)), 0.010, 0.010, 8, 0), "swatch", pr_r, idx=12)
    elif cid == 5:
        b0 = hd_r + Vector((0.0, -0.01, -0.05))
        b1 = hd_r + Vector((-0.08, -0.06, 0.28))
        join_part(bm, v_rules, records, make_subsurf_capsule(b0, b1, 0.024, 0.032, 12, 1), "swatch", pr_r, idx=12)
        join_part(bm, v_rules, records, make_sphere_bm((0.034, 0.034, 0.034), b1), "swatch", pr_r, idx=8)
    elif cid == 6:
        # Giant tilted Cobalt Blueprint tucked tall above left shoulder + Silver Wrench raised right!
        bp_p0 = hd_l + Vector((0.02, 0.09, -0.10))
        bp_p1 = hd_l + Vector((0.09, -0.10, 0.22))
        join_part(bm, v_rules, records, make_subsurf_capsule(bp_p0, bp_p1, 0.054, 0.054, 16, 1), "pat_b_flat", pr_l)
        mid_bp = (bp_p0 + bp_p1) * 0.5
        q_bp = (bp_p1 - bp_p0).normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
        join_part(bm, v_rules, records, make_torus_bm(0.056, 0.010, Matrix.Translation(mid_bp) @ q_bp, 20, 8), "swatch", pr_l, idx=12)
        # Silver adjustable wrench in Right hand!
        wr_bot = hd_r + Vector((0.01, -0.01, -0.04))
        wr_top = hd_r + Vector((-0.07, -0.04, 0.19))
        join_part(bm, v_rules, records, make_subsurf_capsule(wr_bot, wr_top, 0.018, 0.020, 10, 0), "swatch", pr_r, idx=12)
        join_part(bm, v_rules, records, make_torus_bm(0.044, 0.016, Matrix.Translation(wr_top) @ Euler((math.pi * 0.5, 0, 0.3), "XYZ").to_matrix().to_4x4(), 16, 8), "swatch", pr_r, idx=12)
    elif cid == 7:
        cf_c = hd_r + Vector((-0.04, -0.03, 0.075))
        join_part(bm, v_rules, records, make_cone_bm(0.048, 0.064, 0.140, cf_c, segs=18), "swatch", pr_r, idx=11)
        join_part(bm, v_rules, records, make_sphere_bm((0.066, 0.066, 0.030), cf_c + Vector((0, 0, 0.068))), "swatch", pr_r, idx=13)
        join_part(bm, v_rules, records, make_subsurf_capsule(cf_c + Vector((0.01, 0, 0.05)), cf_c + Vector((0.02, -0.02, 0.185)), 0.009, 0.009, 8, 0), "swatch", pr_r, idx=12)
        join_part(bm, v_rules, records, make_subsurf_box((0.032, 0.19, 0.14), hd_l + Vector((0.04, -0.02, 0.04)), (0.15, 0.15, 0), cuts=1, levels=1), "swatch", pr_l, idx=10)
    elif cid == 8:
        st_top = hd_r + Vector((-0.11, -0.09, 0.25))
        join_part(bm, v_rules, records, make_subsurf_capsule(hd_r, st_top, 0.012, 0.010, 10, 0), "swatch", pr_r, idx=11)
        join_part(bm, v_rules, records, make_subsurf_box((0.105, 0.024, 0.145), st_top + Vector((0, 0, 0.04)), (0.28, -0.18, 0.35), cuts=1, levels=1), "swatch", pr_r, idx=13)
        join_part(bm, v_rules, records, make_subsurf_box((0.082, 0.028, 0.118), st_top + Vector((0, 0.004, 0.04)), (0.28, -0.18, 0.35), cuts=1, levels=0), "swatch", pr_r, idx=12)
    elif cid == 9:  # Woven Bamboo Tray holding 2 Crisp Lush Green Coconuts + Tropical Leaf Left!
        tr_l = hd_l + Vector((0.03, -0.02, 0.03))
        join_part(bm, v_rules, records, make_cone_bm(0.105, 0.130, 0.035, tr_l, segs=20), "nonla", pr_l, center=(tr_l.x, tr_l.y, tr_l.z), radius=0.14)
        join_part(bm, v_rules, records, make_sphere_bm((0.068, 0.065, 0.076), tr_l + Vector((-0.02, -0.015, 0.062)), u_segs=16, v_segs=12), "swatch", pr_l, idx=11)
        join_part(bm, v_rules, records, make_sphere_bm((0.064, 0.062, 0.072), tr_l + Vector((0.065, -0.022, 0.052)), u_segs=16, v_segs=12), "swatch", pr_l, idx=11)
        join_part(bm, v_rules, records, make_subsurf_capsule(tr_l + Vector((0.02, -0.01, 0.11)), tr_l + Vector((0.04, -0.01, 0.185)), 0.016, 0.010, 8, 0), "swatch", pr_l, idx=12)
        join_part(bm, v_rules, records, make_subsurf_box((0.095, 0.045, 0.014), tr_l + Vector((0.095, -0.02, 0.145)), (0.2, -0.4, 0.3), cuts=1, levels=1), "swatch", pr_l, idx=11)
    elif cid == 10:
        for k_b in range(-1, 2):
            join_part(bm, v_rules, records, make_subsurf_box((0.095, 0.018, 0.165), hd_r + Vector((-0.04 + k_b * 0.028, -0.025, 0.085)), (-0.15, 0.12, k_b * 0.28), cuts=1, levels=1), "pat_b_flat", pr_r)
        join_part(bm, v_rules, records, make_subsurf_box((0.072, 0.024, 0.125), hd_l + Vector((0.03, -0.02, 0.05)), (0.3, 0, -0.30), cuts=1, levels=1), "swatch", pr_l, idx=8)
    elif cid == 11:  # Saturn-Ring Star Trophy pushed clearly wide right!
        tr_c = hd_r + Vector((-0.05, -0.03, 0.085))
        join_part(bm, v_rules, records, make_cone_bm(0.048, 0.030, 0.07, tr_c + Vector((0, 0, -0.03)), segs=16), "swatch", pr_r, idx=8)
        join_part(bm, v_rules, records, make_sphere_bm((0.068, 0.068, 0.068), tr_c + Vector((0, 0, 0.06)), u_segs=18, v_segs=12), "swatch", pr_r, idx=8)
        join_part(bm, v_rules, records, make_torus_bm(0.105, 0.014, Matrix.Translation(tr_c + Vector((0, 0, 0.06))) @ Euler((0.45, -0.35, 0), "XYZ").to_matrix().to_4x4(), 24, 8), "swatch", pr_r, idx=12)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.verts.ensure_lookup_table()
    face_assigned = set()
    for v_set, uv_mode, uv_kw in records:
        part_faces = [f for f in bm.faces if f not in face_assigned and all(v in v_set for v in f.verts)]
        face_assigned.update(part_faces)
        assign_part_uv(bm, part_faces, uv_mode, **uv_kw)

    idx_rules = [v_rules[v] for v in bm.verts]
    mesh = bpy.data.meshes.new("Body_Mesh")
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True

    body_obj = bpy.data.objects.new("Body", mesh)
    bpy.context.collection.objects.link(body_obj)

    mat = bpy.data.materials.new(f"Mat_Chibi_c{cid}")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.62
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.20
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(atlas_path)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    mesh.materials.append(mat)

    # 5) 15-bone Deterministic Chibi Armature (align_roll -> world +X is pitch axis for ALL limbs!)
    arm_data = bpy.data.armatures.new("ChibiRig")
    arm_obj = bpy.data.objects.new("Armature", arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")

    bones_def = [
        ("Root", None, (0, 0, 0), (0, 0, 0.14), Vector((0, -1, 0))),
        ("Hips", "Root", (0, 0, 0.24), (0, 0, 0.34), Vector((0, -1, 0))),
        ("Spine", "Hips", (0, 0, 0.34), (0, 0, 0.42), Vector((0, -1, 0))),
        ("Chest", "Spine", (0, 0, 0.42), (0, 0, 0.52), Vector((0, -1, 0))),
        ("Head", "Chest", (0, 0, 0.53), (0, 0, 0.90), Vector((0, -1, 0))),
        ("Arm_L", "Chest", sh_l, el_l, Vector((0, 1, 0))),
        ("ForeArm_L", "Arm_L", el_l, hd_l, Vector((0, 1, 0))),
        ("Arm_R", "Chest", sh_r, el_r, Vector((0, 1, 0))),
        ("ForeArm_R", "Arm_R", el_r, hd_r, Vector((0, 1, 0))),
        ("UpLeg_L", "Hips", (0.088, 0, 0.24), (0.088, 0, 0.14), Vector((0, 1, 0))),
        ("Leg_L", "UpLeg_L", (0.088, 0, 0.14), (0.088, 0, 0.05), Vector((0, 1, 0))),
        ("Foot_L", "Leg_L", (0.088, 0, 0.05), (0.088, -0.09, 0.05), Vector((0, 0, 1))),
        ("UpLeg_R", "Hips", (-0.088, 0, 0.24), (-0.088, 0, 0.14), Vector((0, 1, 0))),
        ("Leg_R", "UpLeg_R", (-0.088, 0, 0.14), (-0.088, 0, 0.05), Vector((0, 1, 0))),
        ("Foot_R", "Leg_R", (-0.088, 0, 0.05), (-0.088, -0.09, 0.05), Vector((0, 0, 1))),
    ]
    eb_map = {}
    for bname, pname, hco, tco, roll_vec in bones_def:
        eb = arm_data.edit_bones.new(bname)
        eb.head = Vector(hco)
        eb.tail = Vector(tco)
        eb.align_roll(roll_vec)
        if pname:
            eb.parent = eb_map[pname]
        eb_map[bname] = eb
    bpy.ops.object.mode_set(mode="OBJECT")

    body_obj.parent = arm_obj
    mod = body_obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    vg_map = {bname: body_obj.vertex_groups.new(name=bname) for bname, _, _, _, _ in bones_def}
    for vi, rule in enumerate(idx_rules):
        for bname, w in rule.items():
            if w > 0.001 and bname in vg_map:
                vg_map[bname].add([vi], float(w), "REPLACE")

    # 5b) Mịn hoá lưới: chia nhỏ Catmull-Clark (mặc định 1 bậc, --subdiv=N) SAU khi gán trọng số xương —
    #     Blender nội suy luôn trọng số + UV, nên khớp xương và atlas mặt vẫn đúng. Lưới dày hơn làm ranh bóng toon
    #     và viền ngoài tròn trịa (không còn gãy khúc theo cạnh tam giác). Giữ UV ở mép đảo (không nhoè mắt, miệng).
    if SUBDIV > 0:
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = body_obj
        body_obj.select_set(True)
        sub = body_obj.modifiers.new(name="Smooth", type="SUBSURF")
        sub.levels = SUBDIV
        sub.render_levels = SUBDIV
        sub.uv_smooth = "PRESERVE_BOUNDARIES"
        sub.boundary_smooth = "PRESERVE_CORNERS"
        sub.use_limit_surface = True
        # đặt trước Armature để áp dụng được ở tư thế nghỉ
        bpy.ops.object.modifier_move_to_index(modifier="Smooth", index=0)
        bpy.ops.object.modifier_apply(modifier="Smooth")
        for p in body_obj.data.polygons:
            p.use_smooth = True

    # 6) Expressive 6 NLA Toy Animations (subtle charming idle contrapposto + natural walk/jump/cheer)
    arm_obj.animation_data_create()
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "XYZ"

    def make_clip(name, total_frames, keys_by_bone):
        act = bpy.data.actions.new(name=name)
        arm_obj.animation_data.action = act
        for bname, frames_dict in keys_by_bone.items():
            pb = arm_obj.pose.bones.get(bname)
            if not pb:
                continue
            for fr, xf in frames_dict.items():
                pb.location = Vector(xf.get("loc", (0.0, 0.0, 0.0)))
                pb.rotation_euler = Euler(tuple(math.radians(a) for a in xf.get("rot", (0.0, 0.0, 0.0))), "XYZ")
                pb.scale = Vector(xf.get("sc", (1.0, 1.0, 1.0)))
                if "loc" in xf:
                    pb.keyframe_insert(data_path="location", frame=fr)
                if "rot" in xf:
                    pb.keyframe_insert(data_path="rotation_euler", frame=fr)
                if "sc" in xf:
                    pb.keyframe_insert(data_path="scale", frame=fr)
        for fc in act.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.handle_left_type = "AUTO_CLAMPED"
                kp.handle_right_type = "AUTO_CLAMPED"
        trk = arm_obj.animation_data.nla_tracks.new()
        trk.name = name
        st = trk.strips.new(name, 1, act)
        st.action_frame_start = 1
        st.action_frame_end = total_frames
        arm_obj.animation_data.action = None

    make_clip("idle", 48, {
        "Hips": {1: {"loc": (0, 0, 0), "rot": (0, -2, -5)}, 24: {"loc": (0, 0, 0.022), "rot": (-2, 2, 4)}, 48: {"loc": (0, 0, 0), "rot": (0, -2, -5)}},
        "Spine": {1: {"rot": (2, 2, 3)}, 24: {"rot": (-2, -2, -3)}, 48: {"rot": (2, 2, 3)}},
        "Chest": {1: {"rot": (2, -2, -3)}, 24: {"rot": (-3, 2, 3)}, 48: {"rot": (2, -2, -3)}},
        "Head": {1: {"rot": (-3, -5, 6)}, 24: {"rot": (2, 5, -4)}, 48: {"rot": (-3, -5, 6)}},
        "Arm_R": {1: {"rot": (0, 0, 0)}, 24: {"rot": (6, 0, 4)}, 48: {"rot": (0, 0, 0)}},
        "Arm_L": {1: {"rot": (0, 0, 0)}, 24: {"rot": (-5, 0, -4)}, 48: {"rot": (0, 0, 0)}},
    })

    make_clip("walk", 16, {
        "Hips": {
            1: {"loc": (0, 0, -0.015), "rot": (6, -5, 8)},
            5: {"loc": (0, 0, 0.055), "rot": (2, 0, 0)},
            9: {"loc": (0, 0, -0.015), "rot": (6, 5, -8)},
            13: {"loc": (0, 0, 0.055), "rot": (2, 0, 0)},
            16: {"loc": (0, 0, -0.015), "rot": (6, -5, 8)},
        },
        "Chest": {1: {"rot": (4, 4, -8)}, 5: {"rot": (2, 0, 0)}, 9: {"rot": (4, -4, 8)}, 13: {"rot": (2, 0, 0)}, 16: {"rot": (4, 4, -8)}},
        "Head": {1: {"rot": (-6, 3, -5)}, 5: {"rot": (-2, 0, 0)}, 9: {"rot": (-6, -3, 5)}, 13: {"rot": (-2, 0, 0)}, 16: {"rot": (-6, 3, -5)}},
        "UpLeg_L": {1: {"rot": (34, 0, 0)}, 5: {"rot": (6, 0, 0)}, 9: {"rot": (-26, 0, 0)}, 13: {"rot": (16, 0, 0)}, 16: {"rot": (34, 0, 0)}},
        "Leg_L": {1: {"rot": (-8, 0, 0)}, 5: {"rot": (-18, 0, 0)}, 9: {"rot": (-22, 0, 0)}, 13: {"rot": (-52, 0, 0)}, 16: {"rot": (-8, 0, 0)}},
        "Foot_L": {1: {"rot": (14, 0, 0)}, 5: {"rot": (0, 0, 0)}, 9: {"rot": (-18, 0, 0)}, 13: {"rot": (8, 0, 0)}, 16: {"rot": (14, 0, 0)}},
        "UpLeg_R": {1: {"rot": (-26, 0, 0)}, 5: {"rot": (16, 0, 0)}, 9: {"rot": (34, 0, 0)}, 13: {"rot": (6, 0, 0)}, 16: {"rot": (-26, 0, 0)}},
        "Leg_R": {1: {"rot": (-22, 0, 0)}, 5: {"rot": (-52, 0, 0)}, 9: {"rot": (-8, 0, 0)}, 13: {"rot": (-18, 0, 0)}, 16: {"rot": (-22, 0, 0)}},
        "Foot_R": {1: {"rot": (-18, 0, 0)}, 5: {"rot": (8, 0, 0)}, 9: {"rot": (14, 0, 0)}, 13: {"rot": (0, 0, 0)}, 16: {"rot": (-18, 0, 0)}},
        "Arm_R": {1: {"rot": (30, 0, 0)}, 9: {"rot": (-26, 0, 0)}, 16: {"rot": (30, 0, 0)}},
        "ForeArm_R": {1: {"rot": (18, 0, 0)}, 9: {"rot": (6, 0, 0)}, 16: {"rot": (18, 0, 0)}},
        "Arm_L": {1: {"rot": (-24, 0, 0)}, 9: {"rot": (28, 0, 0)}, 16: {"rot": (-24, 0, 0)}},
        "ForeArm_L": {1: {"rot": (6, 0, 0)}, 9: {"rot": (18, 0, 0)}, 16: {"rot": (6, 0, 0)}},
    })

    make_clip("jump", 16, {
        "Hips": {1: {"loc": (0, 0, 0), "sc": (1, 1, 1)}, 4: {"loc": (0, 0, -0.045), "sc": (1.08, 1.08, 0.88)},
                 9: {"loc": (0, 0, 0.14), "sc": (0.94, 0.94, 1.08)}, 13: {"loc": (0, 0, -0.025), "sc": (1.06, 1.06, 0.92)}, 16: {"loc": (0, 0, 0), "sc": (1, 1, 1)}},
        "Leg_L": {1: {"rot": (0, 0, 0)}, 4: {"rot": (-28, 0, 0)}, 9: {"rot": (-38, 0, 0)}, 16: {"rot": (0, 0, 0)}},
        "Leg_R": {1: {"rot": (0, 0, 0)}, 4: {"rot": (-28, 0, 0)}, 9: {"rot": (-38, 0, 0)}, 16: {"rot": (0, 0, 0)}},
        "Arm_L": {1: {"rot": (0, 0, 0)}, 4: {"rot": (-12, 0, 0)}, 9: {"rot": (32, 0, 18)}, 16: {"rot": (0, 0, 0)}},
        "Arm_R": {1: {"rot": (0, 0, 0)}, 4: {"rot": (-12, 0, 0)}, 9: {"rot": (32, 0, -18)}, 16: {"rot": (0, 0, 0)}},
    })

    make_clip("cheer", 28, {
        "Hips": {1: {"loc": (0, 0, 0)}, 7: {"loc": (0, 0, 0.11)}, 14: {"loc": (0, 0, 0)}, 21: {"loc": (0, 0, 0.12)}, 28: {"loc": (0, 0, 0)}},
        "Chest": {1: {"rot": (0, 0, 0)}, 7: {"rot": (-10, 8, -8)}, 21: {"rot": (-10, -8, 8)}, 28: {"rot": (0, 0, 0)}},
        "Head": {1: {"rot": (0, 0, 0)}, 7: {"rot": (-10, 10, -8)}, 21: {"rot": (-10, -10, 8)}, 28: {"rot": (0, 0, 0)}},
        "Arm_L": {1: {"rot": (0, 0, 0)}, 7: {"rot": (45, 0, 26)}, 21: {"rot": (48, 0, 30)}, 28: {"rot": (0, 0, 0)}},
        "Arm_R": {1: {"rot": (0, 0, 0)}, 7: {"rot": (48, 0, -28)}, 21: {"rot": (50, 0, -32)}, 28: {"rot": (0, 0, 0)}},
    })

    make_clip("hit", 19, {
        "Hips": {1: {"loc": (0, 0, 0), "rot": (0, 0, 0)}, 5: {"loc": (0, 0.05, -0.02), "rot": (-18, 8, 10)}, 19: {"loc": (0, 0, 0), "rot": (0, 0, 0)}},
        "Head": {1: {"rot": (0, 0, 0)}, 6: {"rot": (-18, -10, -10)}, 12: {"rot": (-8, 10, 8)}, 19: {"rot": (0, 0, 0)}},
        "Arm_R": {1: {"rot": (0, 0, 0)}, 5: {"rot": (24, 0, -32)}, 19: {"rot": (0, 0, 0)}},
        "Arm_L": {1: {"rot": (0, 0, 0)}, 5: {"rot": (20, 0, 26)}, 19: {"rot": (0, 0, 0)}},
    })

    make_clip("die", 28, {
        "Hips": {1: {"loc": (0, 0, 0), "rot": (0, 0, 0)}, 10: {"loc": (0, 0.04, -0.14), "rot": (-22, 6, 8)}, 28: {"loc": (0, 0.06, -0.17), "rot": (-26, 8, 10)}},
        "Head": {1: {"rot": (0, 0, 0)}, 12: {"rot": (22, -14, -16)}, 20: {"rot": (26, 16, 16)}, 28: {"rot": (20, -10, -12)}},
        "UpLeg_L": {1: {"rot": (0, 0, 0)}, 12: {"rot": (72, 0, -15)}, 28: {"rot": (72, 0, -15)}},
        "UpLeg_R": {1: {"rot": (0, 0, 0)}, 12: {"rot": (72, 0, 15)}, 28: {"rot": (72, 0, 15)}},
        "Arm_R": {1: {"rot": (0, 0, 0)}, 12: {"rot": (-14, 0, -28)}, 28: {"rot": (-18, 0, -32)}},
    })

    arm_obj.animation_data.use_nla = True
    bpy.context.view_layer.update()

    glb_path = os.path.join(V3_CHAR_OUT, f"c{cid}.glb")
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    body_obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_force_sampling=True,
        export_frame_step=1,
        export_def_bones=True,
        export_leaf_bone=False,
        export_optimize_animation_size=True,
        export_skins=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )
    tris = len(mesh.polygons)
    sz_kb = os.path.getsize(glb_path) // 1024
    print(f"OK V3 c{cid}: glb={sz_kb}KB tris={tris} nla={[t.name for t in arm_obj.animation_data.nla_tracks]}")


def parse_subdiv(argv, default=1):
    for a in argv:
        if a.startswith("--subdiv="):
            return int(a.split("=", 1)[1])
    return default


SUBDIV = parse_subdiv(sys.argv)


def parse_only(argv):
    ids = list(range(12))
    for a in argv:
        if a.startswith("--only="):
            ids = [int(x) for x in a.split("=", 1)[1].split(",") if x.strip().isdigit()]
    return ids


if __name__ == "__main__":
    only_ids = parse_only(sys.argv)
    if "--atlas" in sys.argv:
        os.makedirs(ATLAS_DIR, exist_ok=True)
        for cid in only_ids:
            out_p = os.path.join(ATLAS_DIR, f"c{cid}_atlas.png")
            paint_char_atlas(cid, out_p)
        print("ATLAS_OK", len(only_ids), "files")
    else:
        for cid in only_ids:
            build_character(cid)
