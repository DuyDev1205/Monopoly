"""Build ALL 13 stylized Vietnamese Regional Buildings for Monopoly ART_V3.

Models exported to app/skin/models3/build/:
  0:  resort_vn.glb       (Bai cat ngoc, 2 choi la, du soc, ghe bo, THUYEN THUNG, dua)
  1:  lvl1_bacbo.glb      (Cap 1: Nha ngói Bac Bo, san gach, chum nuoc)
  2:  lvl1_mientay.glb    (Cap 1: Nha mai la Mien Tay + xuong ba la + dua)
  3:  lvl1_saigon.glb     (Cap 1: Nha Sai Gon mai ton xanh + gian hoa giay)
  4:  lvl1_taynguyen.glb  (Cap 1: Nha san thap Tay Nguyen mai doc go)
  5:  lvl2_hoian.glb      (Cap 2: Nha pho co Hoi An tuong vang + long den)
  6:  lvl2_saigon.glb     (Cap 2: Nha pho Sai Gon ban cong hoa giay + mai hien)
  7:  lvl2_dalat.glb      (Cap 2: Biet thu Phap Da Lat mai doc + ong khoi)
  8:  lvl2_hue.glb        (Cap 2: Nha ruong Hue 2 tang mai cong am duong)
  9:  lvl3_hanoi.glb      (Cap 3: Nha pho Ha Noi 3 tang hep-cao, ban cong sat)
  10: lvl3_minihotel.glb  (Cap 3: Mini hotel ven bien ban cong kinh + mai pergola)
  11: lvl4_indochine.glb  (Cap 4 Hotel: Khach san Dong Duong vang mai vom dai sen)
  12: lvl4_dinhvn.glb     (Cap 4 Hotel: Thap khach san hien dai mai cong kieu dinh Viet)

Rules:
  - ONLY 20-30% accent pieces use Mat_Player (flags, awnings, lanterns, umbrellas, canopies).
  - Beveled toy diorama forms, warm cohesive colors matching shared ART_V3 shader & lights.

Run:
  Blender.exe -b -P app/tools/blender/blender_build_v3_houses.py
"""

import math
import os
import bpy
import bmesh
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "skin", "models3", "build"))

PALETTE = {
    "Mat_Player":        "#f2f2f2",  # Dyed per owner color in render_builds.gd
    "Mat_Stone_Plinth":  "#e6dac6",
    "Mat_Brick_Court":   "#cf7e60",  # Sân gạch đỏ Bắc Bộ
    "Mat_Wall_Ivory":    "#f5ebd8",
    "Mat_Wall_HoiAn":    "#efc14c",
    "Mat_Wall_Butter":   "#f4dc8c",
    "Mat_Wall_Pastel":   "#f3d9d2",  # Tường hồng kem biệt thự Đà Lạt
    "Mat_Wall_Sand":     "#ead7b7",
    "Mat_Roof_Clay":     "#c75037",
    "Mat_Roof_DeepClay": "#9d3926",
    "Mat_Roof_Thatch":   "#d8b363",
    "Mat_Roof_Corrug":   "#2e8bc0",  # Mái tôn xanh lam Sài Gòn
    "Mat_Wood_Teak":     "#5c361e",
    "Mat_Wood_Light":    "#8b5732",
    "Mat_Window_Warm":   "#ffe299",
    "Mat_Window_Frame":  "#3b5a4d",
    "Mat_Glass_Sea":     "#7bd4e6",  # Kính biển mini-hotel / tháp hiện đại
    "Mat_Water_Lagoon":  "#3db7c6",
    "Mat_Foliage":       "#4ca643",
    "Mat_Flower_Pink":   "#e35688",
    "Mat_Gold_Brass":    "#f0b83a",
    "Mat_Terracotta":    "#b8583c",
}


def hex_rgba(hx):
    hx = hx.lstrip("#")
    return tuple(int(hx[i:i + 2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)


def make_materials():
    mats = {}
    for idx, (name, hx) in enumerate(PALETTE.items()):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = hex_rgba(hx)
        bsdf.inputs["Roughness"].default_value = 0.78 if name != "Mat_Gold_Brass" else 0.42
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.16 if name != "Mat_Gold_Brass" else 0.45
        mats[name] = (m, idx)
    return mats


def assign_faces(bm, faces, mat_idx):
    for f in faces:
        f.material_index = mat_idx


def add_box(bm, mat_idx, size_xyz, center, rot=(0, 0, 0), bevel=0.010, segs=2):
    before = set(bm.verts)
    before_f = set(bm.faces)
    res = bmesh.ops.create_cube(bm, size=1.0)
    sm = Matrix.Diagonal((*size_xyz, 1.0))
    for v in res["verts"]:
        v.co = sm @ v.co
    if bevel > 0.0:
        edges = list({e for v in res["verts"] for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=segs, affect="EDGES", clamp_overlap=True)
    new_verts = [v for v in bm.verts if v not in before]
    new_faces = [f for f in bm.faces if f not in before_f]
    xf = Matrix.Translation(center) @ Euler(rot, "XYZ").to_matrix().to_4x4()
    for v in new_verts:
        v.co = xf @ v.co
    assign_faces(bm, new_faces, mat_idx)
    return new_verts


def add_cyl(bm, mat_idx, r1, r2, depth, center, rot=(0, 0, 0), segs=18, bevel=0.004):
    before = set(bm.verts)
    before_f = set(bm.faces)
    res = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth)
    if bevel > 0.0:
        edges = [e for e in {e for v in res["verts"] for e in v.link_edges} if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4]
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, affect="EDGES", clamp_overlap=True)
    new_verts = [v for v in bm.verts if v not in before]
    new_faces = [f for f in bm.faces if f not in before_f]
    xf = Matrix.Translation(center) @ Euler(rot, "XYZ").to_matrix().to_4x4()
    for v in new_verts:
        v.co = xf @ v.co
    assign_faces(bm, new_faces, mat_idx)
    return new_verts


def add_sphere(bm, mat_idx, rad_xyz, center, rot=(0, 0, 0), u_segs=16, v_segs=10):
    before_f = set(bm.faces)
    res = bmesh.ops.create_uvsphere(bm, u_segments=u_segs, v_segments=v_segs, radius=1.0)
    xf = Matrix.Translation(center) @ Euler(rot, "XYZ").to_matrix().to_4x4() @ Matrix.Diagonal((*rad_xyz, 1.0))
    for v in res["verts"]:
        v.co = xf @ v.co
    assign_faces(bm, [f for f in bm.faces if f not in before_f], mat_idx)
    return res["verts"]


def add_pitched_roof(bm, mat_idx, ridge_idx, w, d, h, z_base, offset_x=0.0, offset_y=0.0, axis="x", up_ends=False):
    ang = math.atan2(h, (d if axis == "x" else w) * 0.5)
    slope_len = math.hypot(h, (d if axis == "x" else w) * 0.5) + 0.025
    th = 0.032
    if axis == "x":
        for sgn in (-1, 1):
            add_box(bm, mat_idx, (w, slope_len, th), (offset_x, offset_y + sgn * d * 0.25, z_base + h * 0.5),
                    rot=(-sgn * ang, 0.0, 0.0), bevel=0.009, segs=2)
        add_box(bm, ridge_idx, (w + 0.018, 0.038, 0.036), (offset_x, offset_y, z_base + h + 0.008), bevel=0.008)
        if up_ends:
            for ex in (-1, 1):
                add_box(bm, ridge_idx, (0.045, 0.045, 0.055), (offset_x + ex * w * 0.48, offset_y, z_base + h + 0.024),
                        rot=(0, ex * 0.45, 0), bevel=0.008)
    else:
        for sgn in (-1, 1):
            add_box(bm, mat_idx, (slope_len, d, th), (offset_x + sgn * w * 0.25, offset_y, z_base + h * 0.5),
                    rot=(0.0, sgn * ang, 0.0), bevel=0.009, segs=2)
        add_box(bm, ridge_idx, (0.038, d + 0.018, 0.036), (offset_x, offset_y, z_base + h + 0.008), bevel=0.008)
        if up_ends:
            for ey in (-1, 1):
                add_box(bm, ridge_idx, (0.045, 0.045, 0.055), (offset_x, offset_y + ey * d * 0.48, z_base + h + 0.024),
                        rot=(-ey * 0.45, 0, 0), bevel=0.008)


def add_hipped_roof(bm, mat_idx, ridge_idx, w, d, h, z_base, offset_x=0.0, offset_y=0.0):
    before_f = set(bm.faces)
    b = 0.016
    hw, hd = w * 0.5, d * 0.5
    tw, td = max(0.04, hw - h * 0.85), max(0.03, hd - h * 0.85)
    v_bot = [bm.verts.new((offset_x + sx * hw, offset_y + sy * hd, z_base)) for sx, sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    v_mid = [bm.verts.new((offset_x + sx * hw, offset_y + sy * hd, z_base + b)) for sx, sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    v_top = [bm.verts.new((offset_x + sx * tw, offset_y + sy * td, z_base + h)) for sx, sy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    bm.faces.new(reversed(v_bot))
    bm.faces.new(v_top)
    for i in range(4):
        ni = (i + 1) % 4
        bm.faces.new((v_bot[i], v_bot[ni], v_mid[ni], v_mid[i]))
        bm.faces.new((v_mid[i], v_mid[ni], v_top[ni], v_top[i]))
    assign_faces(bm, [f for f in bm.faces if f not in before_f], mat_idx)
    add_box(bm, ridge_idx, (tw * 2.0 + 0.025, td * 2.0 + 0.025, 0.024), (offset_x, offset_y, z_base + h + 0.008), bevel=0.007)


def add_lantern(bm, player_idx, wood_idx, center, rad=0.028):
    add_sphere(bm, player_idx, (rad, rad, rad * 1.18), center, u_segs=14, v_segs=10)
    add_cyl(bm, wood_idx, rad * 0.45, rad * 0.45, 0.010, (center[0], center[1], center[2] + rad * 1.15), segs=10, bevel=0.0)
    add_cyl(bm, wood_idx, rad * 0.40, rad * 0.40, 0.010, (center[0], center[1], center[2] - rad * 1.15), segs=10, bevel=0.0)


def add_palm_tree(bm, wood_idx, leaf_idx, base_pos, lean=(0.06, -0.04), h=0.40):
    steps = 5
    pts = [Vector((base_pos[0] + lean[0] * (i / float(steps)) ** 1.6,
                   base_pos[1] + lean[1] * (i / float(steps)) ** 1.6,
                   base_pos[2] + h * (i / float(steps)))) for i in range(steps + 1)]
    for i in range(steps):
        p0, p1 = pts[i], pts[i + 1]
        d = p1 - p0
        rot = d.normalized().to_track_quat("Z", "Y").to_euler("XYZ")
        add_cyl(bm, wood_idx, 0.026 * (1.0 - 0.4 * i / steps), 0.026 * (1.0 - 0.4 * (i + 1) / steps), d.length + 0.012, (p0 + p1) * 0.5, rot=rot, segs=10, bevel=0.0)
    top = pts[-1]
    for k in range(5):
        ang = 2.0 * math.pi * k / 5.0 + 0.25
        add_sphere(bm, leaf_idx, (0.118, 0.048, 0.026), (top.x + math.cos(ang) * 0.11, top.y + math.sin(ang) * 0.11, top.z + 0.008), rot=(0.0, 0.28, ang), u_segs=12, v_segs=8)


def add_window(bm, frame_idx, glass_idx, center, size=(0.085, 0.022, 0.11), rot=(0, 0, 0)):
    add_box(bm, frame_idx, size, center, rot=rot, bevel=0.004, segs=1)
    add_box(bm, glass_idx, (size[0] * 0.72, size[1] + 0.006, size[2] * 0.76), center, rot=rot, bevel=0.003, segs=1)


def add_bougainvillea(bm, leaf_idx, fl_idx, pts):
    for px, py, pz, r in pts:
        add_sphere(bm, leaf_idx, (r, r, r * 0.9), (px, py, pz))
        add_sphere(bm, fl_idx, (r * 0.55, r * 0.55, r * 0.55), (px + 0.015, py - 0.015, pz + 0.018))


def finalize_and_export(bm, mats, name):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    min_z = min((v.co.z for v in bm.verts), default=0.0)
    if abs(min_z) > 1e-4:
        for v in bm.verts:
            v.co.z -= min_z
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    for m, _ in sorted(mats.values(), key=lambda kv: kv[1]):
        mesh.materials.append(m)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    out_path = os.path.join(OUT_DIR, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True, export_materials="EXPORT")
    max_z = max((v.co.z for v in obj.data.vertices), default=0.0)
    print(f"OK {name}: tris={len(mesh.polygons)} h={max_z:.2f}m -> {os.path.getsize(out_path)//1024}KB")


# ---------------- 0: RESORT VN (2 chòi lá, dù sọc, ghế bố, thuyền thúng, palms!) ----------------
def build_resort(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Wall_Sand"), (0.66, 0.64, 0.052), (0.0, 0.0, 0.026), bevel=0.022)
    add_box(bm, m("Mat_Water_Lagoon"), (0.34, 0.28, 0.020), (-0.15, -0.17, 0.048), bevel=0.010)
    # Hai chòi mái lá (1 chính lớn + 1 chòi phụ nhỏ xinh)
    for cx, cy, sc in [(0.11, 0.11, 1.0), (-0.16, 0.12, 0.72)]:
        add_box(bm, m("Mat_Wood_Light"), (0.24 * sc, 0.24 * sc, 0.032), (cx, cy, 0.064), bevel=0.008)
        add_box(bm, m("Mat_Wall_Ivory"), (0.18 * sc, 0.18 * sc, 0.16 * sc), (cx, cy, 0.08 + 0.08 * sc), bevel=0.010)
        add_cyl(bm, m("Mat_Roof_Thatch"), 0.20 * sc, 0.02 * sc, 0.16 * sc, (cx, cy, 0.16 + 0.15 * sc), segs=18)
        add_sphere(bm, m("Mat_Gold_Brass"), (0.02, 0.02, 0.026), (cx, cy, 0.16 + 0.24 * sc))
    # Thuyền thúng tròn đặc trưng biển Việt Nam trên mép cát!
    add_cyl(bm, m("Mat_Wood_Teak"), 0.095, 0.115, 0.055, (-0.16, -0.13, 0.072), rot=(0.08, -0.12, 0.35), segs=18)
    add_cyl(bm, m("Mat_Wood_Light"), 0.078, 0.085, 0.058, (-0.16, -0.13, 0.078), rot=(0.08, -0.12, 0.35), segs=18)
    add_box(bm, m("Mat_Wood_Teak"), (0.14, 0.014, 0.016), (-0.12, -0.13, 0.105), rot=(0.15, 0.08, 0.65), bevel=0.003)
    # Ô dù biển + ghế bố + đèn lồng + cờ DÙNG MAT_PLAYER (~25%)
    add_cyl(bm, m("Mat_Wood_Teak"), 0.008, 0.008, 0.22, (0.16, -0.15, 0.16), segs=8)
    add_cyl(bm, m("Mat_Player"), 0.13, 0.018, 0.068, (0.16, -0.15, 0.28), rot=(-0.10, 0.08, 0.0), segs=14)
    add_box(bm, m("Mat_Player"), (0.065, 0.12, 0.018), (0.15, -0.15, 0.072), rot=(0, 0, 0.32), bevel=0.005)
    add_lantern(bm, m("Mat_Player"), m("Mat_Wood_Teak"), (0.02, -0.02, 0.22), rad=0.024)
    add_cyl(bm, m("Mat_Wood_Teak"), 0.007, 0.006, 0.24, (0.24, 0.02, 0.17), segs=8)
    add_box(bm, m("Mat_Player"), (0.09, 0.012, 0.058), (0.28, 0.02, 0.26), bevel=0.003)
    add_palm_tree(bm, m("Mat_Wood_Light"), m("Mat_Foliage"), (-0.04, 0.22, 0.05), lean=(-0.05, 0.04), h=0.40)
    add_palm_tree(bm, m("Mat_Wood_Light"), m("Mat_Foliage"), (0.23, 0.22, 0.05), lean=(0.05, 0.05), h=0.46)
    finalize_and_export(bm, mats, "resort_vn")


# ---------------- 1: CẤP 1 BẮC BỘ (Ngói đỏ + sân gạch + chum nước) ----------------
def build_lvl1_bacbo(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Brick_Court"), (0.50, 0.48, 0.052), (0.0, 0.0, 0.026), bevel=0.015)
    add_box(bm, m("Mat_Wall_Ivory"), (0.38, 0.32, 0.25), (0.0, 0.02, 0.175), bevel=0.012)
    add_box(bm, m("Mat_Wood_Teak"), (0.11, 0.024, 0.16), (0.0, -0.142, 0.135), bevel=0.005)
    add_window(bm, m("Mat_Wood_Teak"), m("Mat_Window_Warm"), (-0.115, -0.142, 0.17), (0.065, 0.022, 0.078))
    add_window(bm, m("Mat_Wood_Teak"), m("Mat_Window_Warm"), (0.115, -0.142, 0.17), (0.065, 0.022, 0.078))
    add_pitched_roof(bm, m("Mat_Roof_Clay"), m("Mat_Roof_DeepClay"), 0.46, 0.40, 0.19, 0.30, offset_y=0.02, axis="x")
    # Chum nước gốm sân góc phải & bụi chuối/cây
    add_sphere(bm, m("Mat_Terracotta"), (0.044, 0.044, 0.058), (0.18, -0.16, 0.095))
    add_box(bm, m("Mat_Player"), (0.24, 0.095, 0.030), (0.0, -0.185, 0.248), rot=(0.35, 0, 0), bevel=0.010)
    add_lantern(bm, m("Mat_Player"), m("Mat_Wood_Teak"), (-0.13, -0.18, 0.24), rad=0.024)
    add_lantern(bm, m("Mat_Player"), m("Mat_Wood_Teak"), (0.13, -0.18, 0.24), rad=0.024)
    finalize_and_export(bm, mats, "lvl1_bacbo")


# ---------------- 2: CẤP 1 MIỀN TÂY (Mái lá + xuồng ba lá + dừa nhỏ) ----------------
def build_lvl1_mientay(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Water_Lagoon"), (0.50, 0.48, 0.040), (0.0, 0.0, 0.020), bevel=0.015)
    add_box(bm, m("Mat_Wood_Light"), (0.40, 0.34, 0.032), (0.02, 0.05, 0.060), bevel=0.008)
    add_box(bm, m("Mat_Wall_Butter"), (0.34, 0.28, 0.22), (0.02, 0.05, 0.185), bevel=0.012)
    add_box(bm, m("Mat_Wood_Teak"), (0.10, 0.022, 0.15), (0.02, -0.092, 0.15), bevel=0.004)
    add_pitched_roof(bm, m("Mat_Roof_Thatch"), m("Mat_Wood_Teak"), 0.43, 0.37, 0.20, 0.295, offset_x=0.02, offset_y=0.05, axis="x")
    # Xuồng ba lá gỗ đậu ngay bến nước phía trước (-Y)!
    add_box(bm, m("Mat_Wood_Light"), (0.22, 0.068, 0.036), (-0.06, -0.17, 0.055), rot=(0, 0, -0.18), bevel=0.016)
    add_box(bm, m("Mat_Player"), (0.22, 0.09, 0.028), (0.02, -0.135, 0.245), rot=(0.35, 0, 0), bevel=0.008)
    add_cyl(bm, m("Mat_Wood_Teak"), 0.006, 0.006, 0.12, (0.16, 0.05, 0.52), segs=8)
    add_box(bm, m("Mat_Player"), (0.075, 0.010, 0.045), (0.20, 0.05, 0.55), bevel=0.003)
    add_palm_tree(bm, m("Mat_Wood_Light"), m("Mat_Foliage"), (0.20, -0.14, 0.04), lean=(0.04, -0.04), h=0.28)
    finalize_and_export(bm, mats, "lvl1_mientay")


# ---------------- 3: CẤP 1 SÀI GÒN (Mái tôn xanh lam + giàn hoa giấy) ----------------
def build_lvl1_saigon(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Stone_Plinth"), (0.48, 0.44, 0.052), (0.0, 0.0, 0.026), bevel=0.014)
    add_box(bm, m("Mat_Wall_Ivory"), (0.36, 0.32, 0.27), (0.0, 0.01, 0.185), bevel=0.012)
    add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (-0.08, -0.152, 0.165), (0.11, 0.022, 0.15))
    add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.09, -0.152, 0.195), (0.085, 0.022, 0.095))
    add_pitched_roof(bm, m("Mat_Roof_Corrug"), m("Mat_Stone_Plinth"), 0.44, 0.39, 0.15, 0.32, offset_y=0.01, axis="x")
    add_bougainvillea(bm, m("Mat_Foliage"), m("Mat_Flower_Pink"), [(0.18, -0.14, 0.24, 0.052), (0.19, -0.04, 0.28, 0.046), (0.15, -0.16, 0.15, 0.044)])
    add_box(bm, m("Mat_Player"), (0.26, 0.10, 0.030), (0.0, -0.19, 0.265), rot=(0.38, 0, 0), bevel=0.008)
    add_lantern(bm, m("Mat_Player"), m("Mat_Wood_Teak"), (-0.14, -0.19, 0.22), rad=0.024)
    add_cyl(bm, m("Mat_Gold_Brass"), 0.006, 0.005, 0.10, (0.0, 0.01, 0.52), segs=8)
    add_box(bm, m("Mat_Player"), (0.075, 0.010, 0.045), (0.038, 0.01, 0.54), bevel=0.003)
    finalize_and_export(bm, mats, "lvl1_saigon")


# ---------------- 4: CẤP 1 TÂY NGUYÊN (Nhà sàn gỗ thấp + mái dốc cao) ----------------
def build_lvl1_taynguyen(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Stone_Plinth"), (0.48, 0.46, 0.042), (0.0, 0.0, 0.021), bevel=0.014)
    for px, py in [(-0.14, -0.12), (0.14, -0.12), (-0.14, 0.12), (0.14, 0.12)]:
        add_cyl(bm, m("Mat_Wood_Teak"), 0.020, 0.022, 0.13, (px, py, 0.10), segs=10)
    add_box(bm, m("Mat_Wood_Light"), (0.38, 0.34, 0.028), (0.0, 0.0, 0.165), bevel=0.006)
    add_box(bm, m("Mat_Wood_Teak"), (0.32, 0.26, 0.17), (0.0, 0.02, 0.26), bevel=0.010)
    # Thang gỗ chéo lên sàn mặt trước
    add_box(bm, m("Mat_Wood_Light"), (0.085, 0.022, 0.16), (0.0, -0.175, 0.095), rot=(0.55, 0, 0), bevel=0.004)
    add_pitched_roof(bm, m("Mat_Roof_Thatch"), m("Mat_Wood_Teak"), 0.42, 0.38, 0.25, 0.345, offset_y=0.02, axis="x")
    # Nhấn màu người chơi: Băng vải thổ cẩm treo mái sàn + cờ đỉnh mái + đèn lồng
    add_box(bm, m("Mat_Player"), (0.28, 0.022, 0.042), (0.0, -0.155, 0.175), bevel=0.005)
    add_lantern(bm, m("Mat_Player"), m("Mat_Wood_Teak"), (-0.12, -0.155, 0.31), rad=0.024)
    add_lantern(bm, m("Mat_Player"), m("Mat_Wood_Teak"), (0.12, -0.155, 0.31), rad=0.024)
    add_cyl(bm, m("Mat_Gold_Brass"), 0.006, 0.005, 0.11, (0.0, 0.02, 0.63), segs=8)
    add_box(bm, m("Mat_Player"), (0.08, 0.010, 0.045), (0.04, 0.02, 0.65), bevel=0.003)
    finalize_and_export(bm, mats, "lvl1_taynguyen")


# ---------------- 5: CẤP 2 HỘI AN (Vàng nghệ, ban công gỗ, 3 đèn lồng lụa) ----------------
def build_lvl2_hoian(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Stone_Plinth"), (0.48, 0.46, 0.055), (0.0, 0.0, 0.0275), bevel=0.016)
    add_box(bm, m("Mat_Wall_HoiAn"), (0.37, 0.35, 0.47), (0.0, 0.01, 0.29), bevel=0.014)
    add_box(bm, m("Mat_Wood_Teak"), (0.40, 0.38, 0.026), (0.0, 0.0, 0.295), bevel=0.006)
    add_box(bm, m("Mat_Wood_Teak"), (0.31, 0.085, 0.024), (0.0, -0.195, 0.305), bevel=0.006)
    add_box(bm, m("Mat_Wood_Light"), (0.30, 0.016, 0.068), (0.0, -0.23, 0.35), bevel=0.004)
    add_window(bm, m("Mat_Wood_Teak"), m("Mat_Window_Warm"), (0.0, -0.172, 0.145), (0.16, 0.022, 0.17))
    add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (-0.085, -0.17, 0.41), (0.085, 0.022, 0.115))
    add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.085, -0.17, 0.41), (0.085, 0.022, 0.115))
    add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.186, 0.02, 0.41), (0.022, 0.10, 0.11))
    add_pitched_roof(bm, m("Mat_Roof_Clay"), m("Mat_Roof_DeepClay"), 0.45, 0.43, 0.21, 0.525, offset_y=0.01, axis="x")
    add_bougainvillea(bm, m("Mat_Foliage"), m("Mat_Flower_Pink"), [(0.18, -0.18, 0.33, 0.048), (0.20, -0.11, 0.25, 0.044)])
    add_box(bm, m("Mat_Player"), (0.31, 0.11, 0.032), (0.0, -0.21, 0.265), rot=(0.38, 0, 0), bevel=0.010)
    add_box(bm, m("Mat_Player"), (0.16, 0.022, 0.052), (0.0, -0.185, 0.51), bevel=0.006)
    for lx, lz in [(-0.11, 0.22), (0.0, 0.23), (0.11, 0.22)]:
        add_lantern(bm, m("Mat_Player"), m("Mat_Wood_Teak"), (lx, -0.255, lz), rad=0.028)
    finalize_and_export(bm, mats, "lvl2_hoian")


# ---------------- 6: CẤP 2 NHÀ PHỐ SÀI GÒN (Ban công hoa giấy + mái hiên bạt lớn) ----------------
def build_lvl2_saigon(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Stone_Plinth"), (0.48, 0.46, 0.052), (0.0, 0.0, 0.026), bevel=0.015)
    add_box(bm, m("Mat_Wall_Ivory"), (0.38, 0.36, 0.52), (0.0, 0.01, 0.31), bevel=0.014)
    add_box(bm, m("Mat_Stone_Plinth"), (0.41, 0.10, 0.026), (0.0, -0.20, 0.315), bevel=0.006)
    add_box(bm, m("Mat_Wood_Teak"), (0.40, 0.016, 0.068), (0.0, -0.24, 0.36), bevel=0.004)
    add_window(bm, m("Mat_Wood_Teak"), m("Mat_Window_Warm"), (0.0, -0.175, 0.155), (0.20, 0.022, 0.17))
    add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (-0.09, -0.175, 0.44), (0.09, 0.022, 0.12))
    add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.09, -0.175, 0.44), (0.09, 0.022, 0.12))
    add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.19, 0.01, 0.44), (0.022, 0.12, 0.12))
    add_box(bm, m("Mat_Roof_Clay"), (0.42, 0.40, 0.065), (0.0, 0.01, 0.60), bevel=0.010)
    add_box(bm, m("Mat_Wood_Teak"), (0.28, 0.26, 0.12), (0.0, 0.02, 0.69), bevel=0.008)
    add_bougainvillea(bm, m("Mat_Foliage"), m("Mat_Flower_Pink"), [(-0.15, -0.22, 0.38, 0.048), (0.14, -0.22, 0.37, 0.046), (0.18, -0.16, 0.28, 0.044)])
    add_box(bm, m("Mat_Player"), (0.34, 0.12, 0.032), (0.0, -0.215, 0.27), rot=(0.35, 0, 0), bevel=0.010)
    add_box(bm, m("Mat_Player"), (0.30, 0.08, 0.028), (0.0, -0.195, 0.56), rot=(0.38, 0, 0), bevel=0.008)
    add_cyl(bm, m("Mat_Gold_Brass"), 0.007, 0.006, 0.14, (0.0, 0.02, 0.80), segs=8)
    add_box(bm, m("Mat_Player"), (0.095, 0.012, 0.055), (0.046, 0.02, 0.83), bevel=0.003)
    finalize_and_export(bm, mats, "lvl2_saigon")


# ---------------- 7: CẤP 2 BIỆT THỰ ĐÀ LẠT (Tường hồng phấn, mái dốc, ống khói đá) ----------------
def build_lvl2_dalat(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Stone_Plinth"), (0.49, 0.47, 0.058), (0.0, 0.0, 0.029), bevel=0.016)
    add_box(bm, m("Mat_Wall_Pastel"), (0.38, 0.36, 0.44), (0.0, 0.01, 0.278), bevel=0.014)
    # Ống khói đá đặc trưng Đà Lạt!
    add_box(bm, m("Mat_Stone_Plinth"), (0.09, 0.09, 0.32), (0.15, 0.12, 0.62), bevel=0.008)
    add_box(bm, m("Mat_Roof_DeepClay"), (0.11, 0.11, 0.025), (0.15, 0.12, 0.78), bevel=0.005)
    add_window(bm, m("Mat_Wood_Teak"), m("Mat_Window_Warm"), (0.0, -0.175, 0.145), (0.11, 0.022, 0.15))
    add_window(bm, m("Mat_Wood_Teak"), m("Mat_Window_Warm"), (-0.095, -0.175, 0.38), (0.075, 0.022, 0.105))
    add_window(bm, m("Mat_Wood_Teak"), m("Mat_Window_Warm"), (0.095, -0.175, 0.38), (0.075, 0.022, 0.105))
    add_hipped_roof(bm, m("Mat_Roof_Clay"), m("Mat_Roof_DeepClay"), 0.45, 0.43, 0.26, 0.495, offset_y=0.01)
    add_sphere(bm, m("Mat_Foliage"), (0.055, 0.055, 0.095), (-0.19, -0.15, 0.135))
    add_box(bm, m("Mat_Player"), (0.20, 0.11, 0.032), (0.0, -0.22, 0.24), rot=(0.28, 0, 0), bevel=0.010)
    add_lantern(bm, m("Mat_Player"), m("Mat_Wood_Teak"), (-0.10, -0.22, 0.20), rad=0.024)
    add_lantern(bm, m("Mat_Player"), m("Mat_Wood_Teak"), (0.10, -0.22, 0.20), rad=0.024)
    finalize_and_export(bm, mats, "lvl2_dalat")


# ---------------- 8: CẤP 2 NHÀ RƯỜNG HUẾ (2 tầng mái ngói cong đầu đao) ----------------
def build_lvl2_hue(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Stone_Plinth"), (0.50, 0.48, 0.058), (0.0, 0.0, 0.029), bevel=0.016)
    add_box(bm, m("Mat_Wood_Teak"), (0.40, 0.36, 0.24), (0.0, 0.01, 0.175), bevel=0.010)
    add_window(bm, m("Mat_Gold_Brass"), m("Mat_Window_Warm"), (0.0, -0.172, 0.17), (0.16, 0.022, 0.14))
    add_pitched_roof(bm, m("Mat_Roof_Clay"), m("Mat_Gold_Brass"), 0.48, 0.44, 0.15, 0.295, offset_y=0.01, axis="x", up_ends=True)
    # Tầng cổ lầu phía trên + mái thứ 2 uốn cong đầu đao Huế!
    add_box(bm, m("Mat_Wall_Butter"), (0.26, 0.24, 0.15), (0.0, 0.01, 0.51), bevel=0.010)
    add_pitched_roof(bm, m("Mat_Roof_Clay"), m("Mat_Gold_Brass"), 0.35, 0.32, 0.16, 0.585, offset_y=0.01, axis="x", up_ends=True)
    add_sphere(bm, m("Mat_Gold_Brass"), (0.024, 0.024, 0.032), (0.0, 0.01, 0.785))
    add_lantern(bm, m("Mat_Player"), m("Mat_Gold_Brass"), (-0.17, -0.21, 0.24), rad=0.028)
    add_lantern(bm, m("Mat_Player"), m("Mat_Gold_Brass"), (0.17, -0.21, 0.24), rad=0.028)
    add_box(bm, m("Mat_Player"), (0.18, 0.024, 0.056), (0.0, -0.14, 0.49), bevel=0.006)
    add_box(bm, m("Mat_Player"), (0.24, 0.016, 0.042), (0.0, -0.22, 0.075), bevel=0.004)
    finalize_and_export(bm, mats, "lvl2_hue")


# ---------------- 9: CẤP 3 HÀ NỘI (Biệt thự phố 3 tầng) ----------------
def build_lvl3_hanoi(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Stone_Plinth"), (0.54, 0.52, 0.06), (0.0, 0.0, 0.03), bevel=0.018)
    add_box(bm, m("Mat_Wall_Ivory"), (0.44, 0.40, 0.24), (0.0, 0.01, 0.18), bevel=0.014)
    add_box(bm, m("Mat_Wall_Butter"), (0.42, 0.38, 0.44), (0.0, 0.01, 0.52), bevel=0.014)
    for pz in (0.305, 0.525, 0.740):
        add_box(bm, m("Mat_Stone_Plinth"), (0.46, 0.42, 0.026), (0.0, 0.01, pz), bevel=0.006)
    for bz in (0.315, 0.535):
        add_box(bm, m("Mat_Stone_Plinth"), (0.28, 0.08, 0.022), (0.0, -0.21, bz), bevel=0.006)
        add_box(bm, m("Mat_Wood_Teak"), (0.27, 0.014, 0.058), (0.0, -0.245, bz + 0.036), bevel=0.004)
    add_window(bm, m("Mat_Wood_Teak"), m("Mat_Window_Warm"), (0.0, -0.192, 0.15), (0.14, 0.024, 0.18))
    for fl_z in (0.41, 0.63):
        add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (-0.095, -0.182, fl_z), (0.085, 0.022, 0.125))
        add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.095, -0.182, fl_z), (0.085, 0.022, 0.125))
        add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.21, -0.06, fl_z), (0.022, 0.085, 0.115))
        add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.21, 0.09, fl_z), (0.022, 0.085, 0.115))
    add_hipped_roof(bm, m("Mat_Roof_Clay"), m("Mat_Roof_DeepClay"), 0.50, 0.46, 0.18, 0.745, offset_y=0.01)
    add_box(bm, m("Mat_Wall_Butter"), (0.22, 0.20, 0.12), (0.0, 0.01, 0.89), bevel=0.010)
    add_hipped_roof(bm, m("Mat_Roof_Clay"), m("Mat_Gold_Brass"), 0.27, 0.25, 0.11, 0.95, offset_y=0.01)
    add_box(bm, m("Mat_Player"), (0.22, 0.13, 0.036), (0.0, -0.25, 0.275), rot=(0.25, 0, 0), bevel=0.012)
    add_box(bm, m("Mat_Player"), (0.24, 0.07, 0.026), (0.0, -0.22, 0.505), rot=(0.35, 0, 0), bevel=0.008)
    add_cyl(bm, m("Mat_Gold_Brass"), 0.008, 0.007, 0.16, (0.0, 0.01, 1.12), segs=10)
    add_box(bm, m("Mat_Player"), (0.11, 0.014, 0.068), (0.055, 0.01, 1.16), bevel=0.004)
    finalize_and_export(bm, mats, "lvl3_hanoi")


# ---------------- 10: CẤP 3 MINI HOTEL VEN BIỂN (Ban công kính xanh + sân thượng pergola) ----------------
def build_lvl3_minihotel(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Stone_Plinth"), (0.54, 0.52, 0.06), (0.0, 0.0, 0.03), bevel=0.018)
    add_box(bm, m("Mat_Wall_Ivory"), (0.44, 0.40, 0.74), (0.0, 0.01, 0.43), bevel=0.014)
    for bz in (0.31, 0.53, 0.75):
        add_box(bm, m("Mat_Stone_Plinth"), (0.46, 0.44, 0.022), (0.0, -0.01, bz), bevel=0.006)
        add_box(bm, m("Mat_Glass_Sea"), (0.38, 0.018, 0.056), (0.0, -0.22, bz + 0.036), bevel=0.004)
        add_box(bm, m("Mat_Glass_Sea"), (0.018, 0.34, 0.056), (0.225, -0.01, bz + 0.036), bevel=0.004)
    for fz in (0.18, 0.42, 0.64):
        add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (-0.09, -0.195, fz), (0.10, 0.022, 0.13))
        add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.09, -0.195, fz), (0.10, 0.022, 0.13))
        add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.21, 0.02, fz), (0.022, 0.15, 0.13))
    # Sân thượng gỗ Pergola + cây xanh + mái vòm đón khách màu chủ!
    add_box(bm, m("Mat_Wood_Teak"), (0.34, 0.30, 0.026), (0.0, 0.01, 0.96), bevel=0.006)
    for px, py in [(-0.14, -0.11), (0.14, -0.11), (-0.14, 0.13), (0.14, 0.13)]:
        add_cyl(bm, m("Mat_Wood_Teak"), 0.015, 0.015, 0.16, (px, py, 0.87), segs=10)
    add_sphere(bm, m("Mat_Foliage"), (0.065, 0.065, 0.055), (-0.15, -0.12, 0.84))
    add_box(bm, m("Mat_Player"), (0.24, 0.14, 0.036), (0.0, -0.26, 0.27), rot=(0.20, 0, 0), bevel=0.010)
    add_box(bm, m("Mat_Player"), (0.28, 0.026, 0.060), (0.0, -0.205, 0.77), bevel=0.006)
    add_cyl(bm, m("Mat_Gold_Brass"), 0.008, 0.007, 0.16, (0.0, 0.01, 1.05), segs=10)
    add_box(bm, m("Mat_Player"), (0.11, 0.014, 0.068), (0.055, 0.01, 1.09), bevel=0.004)
    finalize_and_export(bm, mats, "lvl3_minihotel")


# ---------------- 11: CẤP 4 KHÁCH SẠN INDOCHINE (Đài sen vàng) ----------------
def build_lvl4_indochine(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Stone_Plinth"), (0.58, 0.56, 0.068), (0.0, 0.0, 0.034), bevel=0.018)
    add_box(bm, m("Mat_Stone_Plinth"), (0.28, 0.12, 0.038), (0.0, -0.28, 0.019), bevel=0.009)
    add_box(bm, m("Mat_Wall_Ivory"), (0.48, 0.44, 0.28), (0.0, 0.01, 0.208), bevel=0.016)
    add_box(bm, m("Mat_Wall_Ivory"), (0.44, 0.40, 0.68), (0.0, 0.01, 0.688), bevel=0.016)
    for cx, cy in [(-0.21, -0.18), (0.21, -0.18), (-0.21, 0.20), (0.21, 0.20)]:
        add_box(bm, m("Mat_Wall_Butter"), (0.065, 0.065, 0.94), (cx, cy, 0.54), bevel=0.010)
    for pz in (0.348, 0.575, 0.800, 1.028):
        add_box(bm, m("Mat_Stone_Plinth"), (0.48, 0.44, 0.028), (0.0, 0.01, pz), bevel=0.006)
    add_window(bm, m("Mat_Wood_Teak"), m("Mat_Window_Warm"), (0.0, -0.215, 0.168), (0.18, 0.028, 0.20))
    for fl_z in (0.46, 0.69, 0.915):
        for wx in (-0.115, 0.0, 0.115):
            add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (wx, -0.192, fl_z), (0.072, 0.022, 0.125))
        for wy in (-0.095, 0.015, 0.125):
            add_window(bm, m("Mat_Window_Frame"), m("Mat_Window_Warm"), (0.222, wy, fl_z), (0.022, 0.072, 0.125))
    add_hipped_roof(bm, m("Mat_Roof_Clay"), m("Mat_Roof_DeepClay"), 0.52, 0.48, 0.17, 1.032, offset_y=0.01)
    add_box(bm, m("Mat_Wall_Ivory"), (0.23, 0.23, 0.15), (0.0, 0.01, 1.245), bevel=0.014)
    add_window(bm, m("Mat_Gold_Brass"), m("Mat_Window_Warm"), (0.0, -0.112, 1.245), (0.10, 0.022, 0.09))
    add_window(bm, m("Mat_Gold_Brass"), m("Mat_Window_Warm"), (0.112, 0.01, 1.245), (0.022, 0.10, 0.09))
    add_hipped_roof(bm, m("Mat_Roof_Clay"), m("Mat_Gold_Brass"), 0.29, 0.29, 0.11, 1.32, offset_y=0.01)
    add_cyl(bm, m("Mat_Gold_Brass"), 0.042, 0.022, 0.06, (0.0, 0.01, 1.44), segs=12)
    add_sphere(bm, m("Mat_Gold_Brass"), (0.028, 0.028, 0.042), (0.0, 0.01, 1.48))
    add_box(bm, m("Mat_Player"), (0.14, 0.14, 0.014), (0.0, -0.29, 0.045), bevel=0.005)
    add_box(bm, m("Mat_Player"), (0.24, 0.15, 0.040), (0.0, -0.275, 0.295), rot=(0.18, 0, 0), bevel=0.012)
    add_box(bm, m("Mat_Player"), (0.26, 0.026, 0.056), (0.0, -0.205, 1.01), bevel=0.006)
    add_box(bm, m("Mat_Player"), (0.026, 0.24, 0.056), (0.232, 0.01, 1.01), bevel=0.006)
    for fx, fy in [(-0.20, -0.17), (0.20, -0.17)]:
        add_cyl(bm, m("Mat_Gold_Brass"), 0.007, 0.006, 0.15, (fx, fy, 1.12), segs=8)
        add_box(bm, m("Mat_Player"), (0.075, 0.012, 0.046), (fx + 0.036, fy, 1.16), bevel=0.003)
    finalize_and_export(bm, mats, "lvl4_indochine")


# ---------------- 12: CẤP 4 THÁP KHÁCH SẠN HIỆN ĐẠI MÁI ĐÌNH VIỆT (lvl4_dinhvn) ----------------
def build_lvl4_dinhvn(mats):
    bm = bmesh.new()
    m = lambda k: mats[k][1]
    add_box(bm, m("Mat_Stone_Plinth"), (0.58, 0.56, 0.068), (0.0, 0.0, 0.034), bevel=0.018)
    # Thân tháp kính-kem hiện đại 2 khối giật cấp
    add_box(bm, m("Mat_Wall_Ivory"), (0.46, 0.42, 0.56), (0.0, 0.01, 0.348), bevel=0.016)
    add_box(bm, m("Mat_Wall_Ivory"), (0.38, 0.34, 0.44), (0.0, 0.01, 0.848), bevel=0.016)
    add_box(bm, m("Mat_Glass_Sea"), (0.32, 0.36, 0.46), (0.0, 0.01, 0.848), bevel=0.010)
    add_box(bm, m("Mat_Glass_Sea"), (0.36, 0.32, 0.46), (0.0, 0.01, 0.848), bevel=0.010)
    for fz in (0.44, 0.58, 0.72, 0.86, 0.99):
        add_box(bm, m("Mat_Stone_Plinth"), (0.42 if fz < 0.65 else 0.39, 0.38 if fz < 0.65 else 0.35, 0.022), (0.0, 0.01, fz), bevel=0.005)
    add_window(bm, m("Mat_Gold_Brass"), m("Mat_Window_Warm"), (0.0, -0.208, 0.18), (0.20, 0.028, 0.22))
    # Mái đình Việt 2 tầng uốn đầu đao vàng kim trên đỉnh tháp cao (~1.46m)!
    add_pitched_roof(bm, m("Mat_Roof_Clay"), m("Mat_Gold_Brass"), 0.48, 0.44, 0.16, 1.08, offset_y=0.01, axis="x", up_ends=True)
    add_box(bm, m("Mat_Wall_Butter"), (0.24, 0.22, 0.12), (0.0, 0.01, 1.24), bevel=0.010)
    add_pitched_roof(bm, m("Mat_Roof_Clay"), m("Mat_Gold_Brass"), 0.33, 0.30, 0.14, 1.30, offset_y=0.01, axis="x", up_ends=True)
    add_sphere(bm, m("Mat_Gold_Brass"), (0.026, 0.026, 0.036), (0.0, 0.01, 1.48))
    add_box(bm, m("Mat_Player"), (0.26, 0.14, 0.036), (0.0, -0.27, 0.30), rot=(0.16, 0, 0), bevel=0.010)
    add_box(bm, m("Mat_Player"), (0.28, 0.024, 0.054), (0.0, -0.195, 0.62), bevel=0.006)
    add_lantern(bm, m("Mat_Player"), m("Mat_Gold_Brass"), (-0.18, -0.22, 1.05), rad=0.026)
    add_lantern(bm, m("Mat_Player"), m("Mat_Gold_Brass"), (0.18, -0.22, 1.05), rad=0.026)
    finalize_and_export(bm, mats, "lvl4_dinhvn")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    builders = [
        build_resort,
        build_lvl1_bacbo, build_lvl1_mientay, build_lvl1_saigon, build_lvl1_taynguyen,
        build_lvl2_hoian, build_lvl2_saigon, build_lvl2_dalat, build_lvl2_hue,
        build_lvl3_hanoi, build_lvl3_minihotel,
        build_lvl4_indochine, build_lvl4_dinhvn,
    ]
    for builder in builders:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mats = make_materials()
        builder(mats)


if __name__ == "__main__":
    main()
