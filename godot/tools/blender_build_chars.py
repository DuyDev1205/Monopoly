# Build, enhance textures/materials, normalize to 1.0m rest pose, retarget Mixamo mocap,
# equip Business Tour accessories, render Cycles studio portraits + close-up avatars,
# and export all 12 human characters (.glb) using Blender 4.2 LTS + VALID avatars (MIT).
#
# Run:
#   D:\Blender\blender-4.2.3-windows-x64\blender.exe -b -P godot/tools/blender_build_chars.py -- [--only=0,1] [--no-render]
import bpy
import bmesh
import json
import math
import os
import sys
import numpy as np
from mathutils import Euler, Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
GODOT_DIR = os.path.normpath(os.path.join(HERE, ".."))
RAW_DIR = os.path.join(GODOT_DIR, "blender_src", "raw_valid_uncompressed")
MOCAP_CACHE = r"C:\Users\Bryan Tran\.gemini\antigravity\brain\01241d6a-c8d4-4ef7-85d2-dd560d930526\scratch\xbot_mocap_cache.json"
if not os.path.isfile(MOCAP_CACHE):
    MOCAP_CACHE = os.path.join(GODOT_DIR, "blender_src", "xbot_mocap_cache.json")
GLB_OUT = os.path.join(GODOT_DIR, "assets", "models", "bt_chars")
UI_RAW = os.path.normpath(os.path.join(GODOT_DIR, "..", ".ui_raw", "chars"))

# 12 Business Tour VIP Human Cast (every female uses 3D h_wig hair; faces diverse & natural)
CHARS = [
    # 0: Chủ Tịch Tập Đoàn (Executive Tycoon)
    {"file": "c0_asian_m1_busi.glb", "head_acc": "tophat", "hand_acc": "briefcase",
     "outfit": "busi", "top_hex": "#162d59", "bot_hex": "#132240", "smile": 0.58, "open_smile": 0.14},
    # 1: Nữ Tổng Tài (Female CEO - 3D wig)
    {"file": "c3_asian_f2_busi.glb", "head_acc": "glasses_ceo", "hand_acc": "handbag",
     "outfit": "busi", "top_hex": "#a81845", "bot_hex": "#3a0e1e", "smile": 0.64, "open_smile": 0.12, "hair_tint": "#4a2c20"},
    # 2: Ông Hoàng Tài Phiệt (Royal Billionaire)
    {"file": "c2_white_m2_busi.glb", "head_acc": "crown", "hand_acc": "scepter",
     "outfit": "busi", "top_hex": "#4b1f82", "bot_hex": "#231240", "smile": 0.55, "open_smile": 0.10, "hair_tint": "#d8dce8"},
    # 3: Tiểu Thư Thượng Lưu (VIP Heiress - 3D wig)
    {"file": "c3_hisp_f3_busi.glb", "head_acc": "tiara", "hand_acc": "clutch",
     "outfit": "busi", "top_hex": "#0e8c72", "bot_hex": "#0d3b32", "smile": 0.66, "open_smile": 0.18},
    # 4: Đại Gia Nghỉ Dưỡng (Resort Magnate)
    {"file": "c4_asian_m2_cas.glb", "head_acc": "aviators", "hand_acc": "goblet",
     "outfit": "cas_shirt", "top_hex": "#0ea5bd", "bot_hex": "#1e3a5f", "smile": 0.68, "open_smile": 0.20},
    # 5: Cảnh Sát Trưởng (Police Chief)
    {"file": "c5_asian_m3_util.glb", "head_acc": "police_cap", "hand_acc": "baton",
     "outfit": "util_shirt", "top_hex": "#194899", "bot_hex": "#13294b", "smile": 0.45, "open_smile": 0.08},
    # 6: Kỹ Sư Địa Ốc (Chief Architect)
    {"file": "c6_asian_m1_util.glb", "head_acc": "hardhat", "hand_acc": "blueprint",
     "outfit": "util_shirt", "top_hex": "#ea6a1f", "bot_hex": "#1e3b5c", "smile": 0.62, "open_smile": 0.14},
    # 7: Founder Khởi Nghiệp (Tech Startup Founder)
    {"file": "c7_asian_m3_cas.glb", "head_acc": "headphones", "hand_acc": "tablet",
     "outfit": "cas_shirt", "top_hex": "#2463eb", "bot_hex": "#1e293b", "smile": 0.64, "open_smile": 0.16},
    # 8: Nữ Vlogger Du Lịch (Travel Influencer - 3D wig)
    {"file": "c8_asian_f3_cas.glb", "head_acc": "beret", "hand_acc": "camera",
     "outfit": "cas_shirt", "top_hex": "#f03e6b", "bot_hex": "#28354a", "smile": 0.70, "open_smile": 0.22},
    # 9: Địa Chủ Miền Tây (Land Baron)
    {"file": "c9_hisp_m1_cas.glb", "head_acc": "fedora", "hand_acc": "goldbar",
     "outfit": "cas_shirt", "top_hex": "#d98218", "bot_hex": "#4a3018", "smile": 0.65, "open_smile": 0.16},
    # 10: Tay Chơi Phố Wall (Wall Street Shark)
    {"file": "c10_white_m1_busi.glb", "head_acc": "aviators_dark", "hand_acc": "cash",
     "outfit": "busi", "top_hex": "#232a3b", "bot_hex": "#171c26", "smile": 0.56, "open_smile": 0.12},
    # 11: Tỷ Phú Vũ Trụ (Space/Tech Billionaire - 3D wig)
    {"file": "c11_white_f1_busi.glb", "head_acc": None, "hand_acc": "star_trophy",
     "outfit": "busi", "top_hex": "#1e4fd6", "bot_hex": "#132347", "smile": 0.65, "open_smile": 0.16},
]

TORSO_BONES_BUSI = {
    "Hips", "Spine", "Spine1", "Spine2",
    "LeftShoulder", "RightShoulder", "LeftArm", "RightArm", "LeftForeArm", "RightForeArm",
}
TORSO_BONES_CAS = {"Spine", "Spine1", "Spine2", "LeftShoulder", "RightShoulder", "LeftArm", "RightArm"}
LEG_BONES = {"LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg"}
FOOT_BONES = {"LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase"}


def hex_to_rgb01(hex_str):
    h = hex_str.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


def srgb_to_linear(hex_str):
    out = []
    for c in hex_to_rgb01(hex_str):
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


def make_pbr(name, hex_col, rough=0.45, metal=0.0, coat=0.0, alpha=1.0, emit_hex=None, emit_strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = srgb_to_linear(hex_col)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    if alpha < 0.999:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    else:
        m.blend_method = "OPAQUE"
    if emit_hex and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = srgb_to_linear(emit_hex)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


def setup_cycles(scene, samples=72):
    scene.render.engine = "CYCLES"
    cprefs = bpy.context.preferences.addons["cycles"].preferences
    configured = False
    for dev_type in ("OPTIX", "CUDA"):
        try:
            cprefs.compute_device_type = dev_type
            cprefs.get_devices()
            gpus = [d for d in cprefs.devices if d.type == dev_type]
            if gpus:
                for d in cprefs.devices:
                    d.use = (d.type == dev_type)
                scene.cycles.device = "GPU"
                configured = True
                break
        except Exception:
            pass
    if not configured:
        scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "AgX"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    scene.view_settings.exposure = 0.06


def rasterize_uv_masks(body_obj, res=256, coat_cut_z=None, torso_bones=TORSO_BONES_BUSI):
    """Build exact boolean (torso_mask, leg_mask) in image pixel space (y=0 top)."""
    mesh = body_obj.data
    mesh.calc_loop_triangles()
    uv_layer = mesh.uv_layers.active
    if not uv_layer:
        z = np.zeros((res, res), dtype=bool)
        return z, z
    uv_data = uv_layer.data

    v_bone = {}
    grp_names = {g.index: g.name for g in body_obj.vertex_groups}
    for v in mesh.vertices:
        best_g, best_w = None, 0.25
        for gp in v.groups:
            if gp.weight > best_w:
                best_w = gp.weight
                best_g = grp_names.get(gp.group)
        v_bone[v.index] = best_g

    torso_mask = np.zeros((res, res), dtype=bool)
    leg_mask = np.zeros((res, res), dtype=bool)

    for tri in mesh.loop_triangles:
        bones = [v_bone.get(vi) for vi in tri.vertices]
        if any(b in FOOT_BONES for b in bones):
            continue
        is_cloth_t = sum(1 for b in bones if b in torso_bones) >= 2
        is_cloth_l = sum(1 for b in bones if b in LEG_BONES) >= 2
        if not is_cloth_t and not is_cloth_l:
            continue
        if coat_cut_z is not None:
            # Clean geometric waist/blazer-hem split instead of noisy hip-bone weight transition
            avg_z = sum((body_obj.matrix_world @ mesh.vertices[vi].co).z for vi in tri.vertices) / 3.0
            is_torso = avg_z >= coat_cut_z
            is_leg = not is_torso
        else:
            is_torso = is_cloth_t
            is_leg = (not is_torso) and is_cloth_l
        if not is_torso and not is_leg:
            continue
        pts = [uv_data[li].uv for li in tri.loops]
        xs = [p.x * (res - 1) for p in pts]
        ys = [(1.0 - p.y) * (res - 1) for p in pts]  # image top-down for numpy; later flipped back for Blender
        x0 = max(0, int(math.floor(min(xs))))
        x1 = min(res - 1, int(math.ceil(max(xs))))
        y0 = max(0, int(math.floor(min(ys))))
        y1 = min(res - 1, int(math.ceil(max(ys))))
        if x1 < x0 or y1 < y0:
            continue
        ax, ay = xs[0], ys[0]
        bx, by = xs[1] - ax, ys[1] - ay
        cx, cy = xs[2] - ax, ys[2] - ay
        denom = bx * cy - by * cx
        if abs(denom) < 1e-6:
            continue
        target = torso_mask if is_torso else leg_mask
        for py in range(y0, y1 + 1):
            for px in range(x0, x1 + 1):
                dx, dy = px - ax, py - ay
                u = (dx * cy - dy * cx) / denom
                v = (bx * dy - by * dx) / denom
                if u >= -0.05 and v >= -0.05 and (u + v) <= 1.05:
                    target[py, px] = True

    # Dilate by 1px to guard UV seams against mip bleeding
    def dilate1(m):
        out = m.copy()
        out[1:, :] |= m[:-1, :]
        out[:-1, :] |= m[1:, :]
        out[:, 1:] |= m[:, :-1]
        out[:, :-1] |= m[:, 1:]
        return out

    torso_mask = dilate1(torso_mask)
    leg_mask = dilate1(leg_mask) & (~torso_mask)
    return torso_mask, leg_mask


def enhance_and_resize_textures(body_obj, meshes, spec, k):
    """Resize textures to crisp 1024/512, warm skin, recolor suit/shirt UV islands smoothly."""
    mat_body = bpy.data.materials.get("_Body")
    if not mat_body or not mat_body.use_nodes:
        return
    col_img, nm_img = None, None
    for n in mat_body.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image:
            if "nm" in n.image.name.lower() or n.image.colorspace_settings.name == "Non-Color":
                nm_img = n.image
            else:
                col_img = n.image

    if col_img:
        if col_img.size[0] > 1024:
            col_img.scale(1024, 1024)
        w, h = col_img.size
        buf = np.empty(w * h * 4, dtype=np.float32)
        col_img.pixels.foreach_get(buf)
        # Blender stores bottom-to-top rows; flip vertically to top-down [y, x, rgba]
        rgba = buf.reshape((h, w, 4))[::-1].copy()
        rgb = rgba[..., :3]

        # Build UV bone masks at 256 (with clean blazer-hem height split at 0.482 on Busi suits)
        outfit = spec.get("outfit", "busi")
        coat_cut_z = None
        if outfit == "busi":
            raw_zs = [(body_obj.matrix_world @ v.co).z for v in body_obj.data.vertices]
            rz_min, rz_max = min(raw_zs), max(raw_zs)
            coat_cut_z = rz_min + (rz_max - rz_min) * 0.482
            t256, l256 = rasterize_uv_masks(body_obj, 256, coat_cut_z=coat_cut_z, torso_bones=TORSO_BONES_BUSI)
        else:
            t256, l256 = rasterize_uv_masks(body_obj, 256, coat_cut_z=None, torso_bones=TORSO_BONES_CAS)
        rep = max(1, h // 256)
        torso_m = np.repeat(np.repeat(t256, rep, axis=0), rep, axis=1)[:h, :w]
        leg_m = np.repeat(np.repeat(l256, rep, axis=0), rep, axis=1)[:h, :w]

        yy, xx = np.mgrid[0:h, 0:w]
        # Never bleed leg mask into upper-right shoe UV quadrant
        leg_m &= ~((xx > int(0.75 * w)) & (yy < int(0.44 * h)))

        mx = rgb.max(axis=-1)
        mn = rgb.min(axis=-1)
        diff = mx - mn
        sat = np.where(mx > 1e-4, diff / np.maximum(mx, 1e-4), 0.0)
        r_c, g_c, b_c = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        lum = 0.2126 * r_c + 0.7152 * g_c + 0.0722 * b_c
        is_skin = (r_c > 0.24) & (r_c > g_c + 0.015) & (g_c >= b_c - 0.01) & (sat > 0.14) & (sat < 0.65)
        is_white_trim = (lum > 0.26) & (sat < 0.25)
        is_vneck_inner = (xx >= int(0.84 * w)) & (yy >= int(0.64 * h)) & (yy <= int(0.81 * h)) & ((sat > 0.16) | (lum > 0.08))
        is_blue_jeans = (b_c > r_c * 1.25) & (sat > 0.22)

        def dye_cloth(mask, target_hex, allow_light=False):
            tl = np.array(srgb_to_linear(target_hex)[:3], dtype=np.float32)
            m = mask & (~is_skin) & (~is_white_trim)
            if not allow_light:
                # Re-dye all dark/charcoal suit fabric cleanly, keeping ONLY V-neck inner blouse/tie untouched
                m &= (~is_vneck_inner) & (mx < 0.35)
            else:
                # Casual/Util shirt: keep dark leather belts & blue denim trousers intact
                m &= (mx > 0.08) & (~is_blue_jeans)
            if not m.any():
                return
            med_lum = float(np.median(lum[m]))
            norm_lum = np.clip(lum / max(med_lum, 0.025), 0.50, 1.50)
            new_col = tl[None, None, :] * norm_lum[..., None]
            rgb[m] = np.clip(new_col[m], 0.0, 1.0)

        if outfit == "busi":
            dye_cloth(torso_m, spec["top_hex"], allow_light=False)
            dye_cloth(leg_m, spec["bot_hex"], allow_light=False)
        else:
            dye_cloth(torso_m, spec["top_hex"], allow_light=True)
            dye_cloth(leg_m, spec["bot_hex"], allow_light=False)

        eye_box = (yy < int(0.15 * h)) & (
            ((xx > int(0.06 * w)) & (xx < int(0.24 * w))) |
            ((xx > int(0.41 * w)) & (xx < int(0.60 * w)))
        )
        # Deepen c2 pale ice-blue iris to crisp sapphire so eyes stand out clearly
        if k == 2:
            iris_zone = (yy > int(0.030 * h)) & (yy < int(0.090 * h)) & (
                ((xx > int(0.115 * w)) & (xx < int(0.175 * w))) |
                ((xx > int(0.475 * w)) & (xx < int(0.535 * w)))
            )
            iris_blue = iris_zone & (lum > 0.06) & ((b_c - r_c) > 0.015)
            if iris_blue.any():
                rgb[iris_blue] *= np.array([0.32, 0.55, 0.94], dtype=np.float32)

        skin_mask = is_skin & (~torso_m) & (~leg_m) & (~eye_box)
        if skin_mask.any():
            rgb[skin_mask, 0] = np.clip(rgb[skin_mask, 0] * 1.05 + 0.010, 0.0, 1.0)
            rgb[skin_mask, 1] = np.clip(rgb[skin_mask, 1] * 1.03 + 0.005, 0.0, 1.0)

        rgba[..., :3] = rgb
        col_img.pixels.foreach_set(rgba[::-1].ravel())
        col_img.update()
        col_img.pack()

    if nm_img:
        if nm_img.size[0] > 512:
            nm_img.scale(512, 512)
        nm_img.pack()

    # Optional silver/custom hair tint on wigs or painted hair (via gentle base tint node)
    mat_hair = bpy.data.materials.get("Hair")
    if mat_hair:
        mat_hair.blend_method = "OPAQUE"
        if mat_hair.use_nodes:
            for n in mat_hair.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image:
                    if n.image.size[0] > 1024:
                        n.image.scale(1024, 1024)
                    if "hair_tint" in spec:
                        hw, hh = n.image.size
                        hb_arr = np.empty(hw * hh * 4, dtype=np.float32)
                        n.image.pixels.foreach_get(hb_arr)
                        hp = hb_arr.reshape((hh, hw, 4))
                        hlum = np.clip(0.2126 * hp[..., 0] + 0.7152 * hp[..., 1] + 0.0722 * hp[..., 2], 0.0, 1.0)
                        th = np.array(srgb_to_linear(spec["hair_tint"])[:3], dtype=np.float32)
                        med_h = max(float(np.median(hlum)), 0.02)
                        hp[..., :3] = np.clip(th[None, None, :] * np.clip(hlum / med_h, 0.3, 1.8)[..., None], 0.0, 1.0)
                        n.image.pixels.foreach_set(hp.ravel())
                        n.image.update()
                    n.image.pack()
            hb = next((n for n in mat_hair.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if hb:
                hb.inputs["Roughness"].default_value = 0.62
                if "Specular IOR Level" in hb.inputs:
                    hb.inputs["Specular IOR Level"].default_value = 0.28
                if "Coat Weight" in hb.inputs:
                    hb.inputs["Coat Weight"].default_value = 0.0
    elif "hair_tint" in spec and col_img:
        # Tint painted scalp hair in top-head region (y < 0.30, dark low-chroma non-skin)
        w, h = col_img.size
        buf = np.empty(w * h * 4, dtype=np.float32)
        col_img.pixels.foreach_get(buf)
        rgba = buf.reshape((h, w, 4))[::-1].copy()
        yy = np.arange(h)[:, None]
        mxh = rgba[..., :3].max(axis=-1)
        mnh = rgba[..., :3].min(axis=-1)
        lumh = 0.2126 * rgba[..., 0] + 0.7152 * rgba[..., 1] + 0.0722 * rgba[..., 2]
        hair_p = (yy < int(0.32 * h)) & (lumh < 0.28) & ((mxh - mnh) < 0.14)
        if hair_p.any():
            th = np.array(srgb_to_linear(spec["hair_tint"])[:3], dtype=np.float32)
            med_p = max(float(np.median(lumh[hair_p])), 0.03)
            rgba[hair_p, :3] = np.clip((th[None, :] * np.clip(lumh[hair_p] / med_p, 0.4, 1.6)[:, None]), 0.0, 1.0)
            col_img.pixels.foreach_set(rgba[::-1].ravel())
            col_img.update()
            col_img.pack()

    # Material calibration: opaque _Body, glossy clearcoat BT_Eye for lively catchlights, opaque Hair
    mat_body.blend_method = "OPAQUE"
    bsdf = next((n for n in mat_body.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = 0.48
        if "Subsurface Weight" in bsdf.inputs:
            bsdf.inputs["Subsurface Weight"].default_value = 0.10
            bsdf.inputs["Subsurface Scale"].default_value = 0.015

    # Separate crisp eye material with gentle corneal sparkle (no blown-out Coat mirror wash!)
    mat_eye = mat_body.copy()
    mat_eye.name = f"BT_{k}_Eye"
    eb = next((n for n in mat_eye.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if eb:
        eb.inputs["Roughness"].default_value = 0.34
        if "Coat Weight" in eb.inputs:
            eb.inputs["Coat Weight"].default_value = 0.0
        if "Specular IOR Level" in eb.inputs:
            eb.inputs["Specular IOR Level"].default_value = 0.40
        if "Subsurface Weight" in eb.inputs:
            eb.inputs["Subsurface Weight"].default_value = 0.0
    for o in meshes:
        if o.name in ("h_L_eye", "h_R_eye"):
            o.data.materials.clear()
            o.data.materials.append(mat_eye)

    # Duplicate bottom hair block removed (moved up into hair_tint block)


def apply_expressions_and_normalize(arm_obj, meshes, spec, k):
    """Apply natural FACS smile, straight eye contact, scale Head 1.12x, relax fingers, bake to 1.0m rest pose."""
    for o in meshes:
        if not o.data.shape_keys:
            continue
        kbs = o.data.shape_keys.key_blocks
        if "HighRes" in o.name:
            sm = spec.get("smile", 0.58)
            op = spec.get("open_smile", 0.14)
            expr = {
                "h_expressions.RsmileClose_h": sm,
                "h_expressions.LsmileClose_h": sm,
                "h_expressions.RsmileOpen_h": op,
                "h_expressions.LsmileOpen_h": op,
                "h_expressions.Rsquint_h": 0.20,
                "h_expressions.Lsquint_h": 0.20,
                "h_expressions.RbrowUp_h": 0.15,
                "h_expressions.LbrowUp_h": 0.15,
                "h_expressions.MouthOpen_h": op * 0.25,
            }
            for kn, val in expr.items():
                if kn in kbs:
                    kbs[kn].value = val
        elif "TeethDown" in o.name:
            op = spec.get("open_smile", 0.14)
            # Keep lower teeth slightly tucked back/down so they never poke through smile lips
            for kn in kbs.keys():
                if "CurlDown" in kn or "Down" in kn:
                    kbs[kn].value = op * 0.22

    # Poses applied permanently into rest pose
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "QUATERNION"

    # Keep eye gaze natural & parallel; scale Head 1.12x for stylized clarity on board
    def rot_world(pb, deg_x=0.0, deg_y=0.0, deg_z=0.0):
        r_w = Euler((math.radians(deg_x), math.radians(deg_y), math.radians(deg_z)), "XYZ").to_matrix()
        m_w = (arm_obj.matrix_world.to_3x3() @ pb.bone.matrix_local.to_3x3()).normalized()
        pb.rotation_quaternion = (m_w.inverted() @ r_w @ m_w).to_quaternion()

    if "Head" in arm_obj.pose.bones:
        arm_obj.pose.bones["Head"].scale = (1.12, 1.12, 1.12)

    # Relaxed natural finger curl baked into rest pose so hands never look stiff
    for side, sgn in (("Left", 1.0), ("Right", -1.0)):
        seg_curls = (28.0, 34.0, 26.0) if (side == "Right" and spec.get("hand_acc")) else (22.0, 26.0, 20.0)
        for finger in ("Index", "Middle", "Ring", "Pinky"):
            for idx_s, deg_c in zip((1, 2, 3), seg_curls):
                pb = arm_obj.pose.bones.get(f"{side}Hand{finger}{idx_s}")
                if pb:
                    rot_world(pb, deg_y=deg_c * sgn)
        t2 = arm_obj.pose.bones.get(f"{side}HandThumb2")
        if t2:
            rot_world(t2, deg_z=20.0 * (-sgn), deg_y=16.0 * sgn)

    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode="OBJECT")

    # Bake shape keys, apply old Armature modifier (converting cm -> 1.0m meters cleanly), optimize poly count
    decimate_ratios = {"H_DDS_HighRes": 0.34, "h_wig": 0.58, "h_TeethDown": 0.25, "h_TeethUp": 0.25}
    for o in meshes:
        if o.data.shape_keys and len(o.data.shape_keys.key_blocks) > 1:
            o.shape_key_add(name="__BAKED__", from_mix=True)
            for kb in list(o.data.shape_keys.key_blocks):
                if kb.name != "__BAKED__":
                    o.shape_key_remove(kb)
            o.shape_key_remove(o.data.shape_keys.key_blocks[0])
        elif o.data.shape_keys:
            o.shape_key_remove(o.data.shape_keys.key_blocks[0])

        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        for mod in list(o.modifiers):
            if mod.type == "ARMATURE":
                bpy.ops.object.modifier_apply(modifier=mod.name)

        ratio = decimate_ratios.get(o.name, None)
        if ratio is not None and len(o.data.polygons) > 3500:
            dm = o.modifiers.new(name="Opt", type="DECIMATE")
            dm.decimate_type = "COLLAPSE"
            dm.ratio = ratio
            dm.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=dm.name)

        for p in o.data.polygons:
            p.use_smooth = True

    # Apply normalized 1.0m Pose as permanent Rest Pose
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    for o in meshes:
        mod = o.modifiers.new(name="Armature", type="ARMATURE")
        mod.object = arm_obj


def add_bm_cyl(bm, r1, r2, depth, segs, center_world, rot_euler=(0.0, 0.0, 0.0)):
    m = Matrix.Translation(center_world) @ Euler(rot_euler, "XYZ").to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth, matrix=m)


def add_bm_box(bm, size_xyz, center_world, rot_euler=(0.0, 0.0, 0.0), bevel=0.0):
    res = bmesh.ops.create_cube(bm, size=1.0)
    verts = res["verts"]
    scale_m = Matrix.Diagonal((size_xyz[0], size_xyz[1], size_xyz[2], 1.0))
    xf = Matrix.Translation(center_world) @ Euler(rot_euler, "XYZ").to_matrix().to_4x4() @ scale_m
    for v in verts:
        v.co = xf @ v.co
    if bevel > 0.0:
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=2, affect="EDGES", clamp_overlap=True)


def add_bm_sphere(bm, rad_xyz, center_world, u_segs=20, v_segs=12, rot_euler=(0.0, 0.0, 0.0)):
    res = bmesh.ops.create_uvsphere(bm, u_segments=u_segs, v_segments=v_segs, radius=1.0)
    scale_m = Matrix.Diagonal((rad_xyz[0], rad_xyz[1], rad_xyz[2], 1.0))
    xf = Matrix.Translation(center_world) @ Euler(rot_euler, "XYZ").to_matrix().to_4x4() @ scale_m
    for v in res["verts"]:
        v.co = xf @ v.co


def new_mesh_obj(name, arm_obj, bone_name, mat, build_fn):
    bm = bmesh.new()
    build_fn(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    inv = arm_obj.matrix_world.inverted()
    for v in bm.verts:
        v.co = inv @ v.co
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = arm_obj
    obj.matrix_local = Matrix.Identity(4)
    if mat:
        mesh.materials.append(mat)
    vg = obj.vertex_groups.new(name=bone_name)
    vg.add(list(range(len(mesh.vertices))), 1.0, "REPLACE")
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    return obj


def build_head_accessory(kind, arm_obj, meshes):
    if not kind:
        return []
    l_eye = arm_obj.matrix_world @ arm_obj.data.bones["LeftEye"].head_local
    r_eye = arm_obj.matrix_world @ arm_obj.data.bones["RightEye"].head_local
    eye_mid = (l_eye + r_eye) * 0.5
    eye_dist = (l_eye - r_eye).length
    cx = eye_mid.x
    eye_z = eye_mid.z
    front_y = eye_mid.y - 0.022  # right in front of corneal bulge & nose bridge

    # Measure skull width and crown top height near head X/Y
    head_mesh = next((o for o in meshes if "HighRes" in o.name), meshes[0])
    head_pts = [head_mesh.matrix_world @ v.co for v in head_mesh.data.vertices if (head_mesh.matrix_world @ v.co).z > eye_z - 0.05]
    top_z = max(p.z for p in head_pts)
    head_w = max(p.x for p in head_pts) - min(p.x for p in head_pts)
    half_w = min(0.095, head_w * 0.5)
    head_cy = eye_mid.y + 0.075

    mat_gold = make_pbr("Acc_Gold", "#f5c242", rough=0.18, metal=0.92, coat=0.3)
    mat_black = make_pbr("Acc_SilkBlack", "#161822", rough=0.35, metal=0.04, coat=0.2)
    mat_navy = make_pbr("Acc_CapNavy", "#152b5e", rough=0.45, metal=0.04, coat=0.1)
    mat_rim = make_pbr("Acc_RimDark", "#1d2028", rough=0.20, metal=0.82, coat=0.25)
    mat_tint = make_pbr("Acc_AmberLens", "#c47d3b", rough=0.06, metal=0.1, coat=0.9, alpha=0.48)
    mat_dark_lens = make_pbr("Acc_SmokeLens", "#1e293b", rough=0.06, metal=0.2, coat=0.9, alpha=0.68)
    mat_gem = make_pbr("Acc_Diamond", "#7dd3fc", rough=0.05, metal=0.15, coat=1.0, emit_hex="#38bdf8", emit_strength=0.5)
    mat_coral = make_pbr("Acc_BeretCoral", "#dc1d4b", rough=0.60, metal=0.0, coat=0.04)
    mat_yellow = make_pbr("Acc_HardhatYellow", "#f5b818", rough=0.22, metal=0.04, coat=0.45)
    mat_straw = make_pbr("Acc_Fedora", "#d9a95b", rough=0.62, metal=0.0, coat=0.0)

    created = []
    if kind == "tophat":
        c = Vector((cx, head_cy - 0.004, top_z - 0.056))
        tilt = (math.radians(-6), math.radians(4), 0.0)
        created.append(new_mesh_obj("Hat_Body", arm_obj, "Head", mat_black, lambda bm: (
            add_bm_cyl(bm, 0.142, 0.142, 0.015, 32, c + Vector((0, 0, 0.006)), tilt),
            add_bm_cyl(bm, 0.095, 0.106, 0.145, 32, c + Vector((0, 0, 0.078)), tilt),
        )))
        created.append(new_mesh_obj("Hat_Band", arm_obj, "Head", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.100, 0.102, 0.024, 32, c + Vector((0, 0, 0.028)), tilt),
        )))
    elif kind == "crown":
        c = Vector((cx, head_cy - 0.010, top_z - 0.036))
        created.append(new_mesh_obj("Crown_Gold", arm_obj, "Head", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.088, 0.096, 0.024, 24, c, (math.radians(-8), 0, 0)),
            *[add_bm_box(bm, (0.016, 0.010, 0.036), c + Vector((math.sin(a) * 0.090, -math.cos(a) * 0.090, 0.022)), (0, 0, -a), bevel=0.002)
              for a in (-0.9, -0.45, 0.0, 0.45, 0.9)],
        )))
        created.append(new_mesh_obj("Crown_Gem", arm_obj, "Head", mat_gem, lambda bm: (
            add_bm_sphere(bm, (0.012, 0.010, 0.014), c + Vector((0, -0.096, 0.018))),
        )))
    elif kind in ("glasses_ceo", "aviators", "aviators_dark"):
        fmat = mat_gold if kind != "aviators_dark" else mat_rim
        y_gl = front_y - 0.006
        ew = max(0.044, eye_dist * 0.66)
        eh = 0.026 if kind == "glasses_ceo" else 0.030
        ex = eye_dist * 0.52
        if kind == "glasses_ceo":
            def _wire(bm, x0):
                add_bm_box(bm, (ew, 0.005, 0.0045), Vector((x0, y_gl, eye_z + eh * 0.5)), bevel=0.001)
                add_bm_box(bm, (ew, 0.005, 0.0045), Vector((x0, y_gl, eye_z - eh * 0.5)), bevel=0.001)
                add_bm_box(bm, (0.0045, 0.005, eh), Vector((x0 - ew * 0.5, y_gl, eye_z)), bevel=0.001)
                add_bm_box(bm, (0.0045, 0.005, eh), Vector((x0 + ew * 0.5, y_gl, eye_z)), bevel=0.001)
            created.append(new_mesh_obj("Glasses_Frame", arm_obj, "Head", fmat, lambda bm: (
                add_bm_box(bm, (eye_dist * 0.35, 0.005, 0.0045), Vector((cx, y_gl, eye_z + 0.004)), bevel=0.001),
                _wire(bm, cx - ex),
                _wire(bm, cx + ex),
                add_bm_box(bm, (0.004, 0.095, 0.0045), Vector((cx - ex - ew * 0.5, y_gl + 0.048, eye_z + 0.005))),
                add_bm_box(bm, (0.004, 0.095, 0.0045), Vector((cx + ex + ew * 0.5, y_gl + 0.048, eye_z + 0.005))),
            )))
        else:
            lmat = mat_tint if kind == "aviators" else mat_dark_lens
            created.append(new_mesh_obj("Shades_Frame", arm_obj, "Head", fmat, lambda bm: (
                add_bm_box(bm, (eye_dist + ew, 0.006, 0.0055), Vector((cx, y_gl, eye_z + eh * 0.52)), bevel=0.0015),
                add_bm_box(bm, (0.005, 0.095, 0.005), Vector((cx - ex - ew * 0.5, y_gl + 0.048, eye_z + 0.008))),
                add_bm_box(bm, (0.005, 0.095, 0.005), Vector((cx + ex + ew * 0.5, y_gl + 0.048, eye_z + 0.008))),
            )))
            created.append(new_mesh_obj("Shades_Lens", arm_obj, "Head", lmat, lambda bm: (
                add_bm_box(bm, (ew, 0.006, eh), Vector((cx - ex, y_gl, eye_z - 0.001)), bevel=0.003),
                add_bm_box(bm, (ew, 0.006, eh), Vector((cx + ex, y_gl, eye_z - 0.001)), bevel=0.003),
            )))
    elif kind == "tiara":
        c = Vector((cx, head_cy - 0.015, top_z - 0.025))
        created.append(new_mesh_obj("Tiara_Gold", arm_obj, "Head", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.088, 0.094, 0.016, 24, c, (math.radians(-12), 0, 0)),
            add_bm_box(bm, (0.022, 0.008, 0.036), c + Vector((0, -0.090, 0.018)), bevel=0.002),
            add_bm_box(bm, (0.014, 0.008, 0.026), c + Vector((-0.036, -0.082, 0.014)), (0, 0.35, 0), bevel=0.002),
            add_bm_box(bm, (0.014, 0.008, 0.026), c + Vector((0.036, -0.082, 0.014)), (0, -0.35, 0), bevel=0.002),
        )))
        created.append(new_mesh_obj("Tiara_Gem", arm_obj, "Head", mat_gem, lambda bm: (
            add_bm_sphere(bm, (0.011, 0.009, 0.015), c + Vector((0, -0.094, 0.022))),
        )))
    elif kind == "police_cap":
        c = Vector((cx, head_cy, top_z - 0.032))
        tilt = (math.radians(-8), 0.0, 0.0)
        created.append(new_mesh_obj("Cap_Navy", arm_obj, "Head", mat_navy, lambda bm: (
            add_bm_cyl(bm, 0.098, 0.114, 0.068, 28, c + Vector((0, 0, 0.034)), tilt),
        )))
        created.append(new_mesh_obj("Cap_Visor", arm_obj, "Head", mat_black, lambda bm: (
            add_bm_cyl(bm, 0.112, 0.112, 0.012, 24, c + Vector((0, -0.068, 0.002)), (math.radians(8), 0, 0)),
        )))
        created.append(new_mesh_obj("Cap_Badge", arm_obj, "Head", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.099, 0.099, 0.016, 28, c + Vector((0, 0, 0.012)), tilt),
            add_bm_sphere(bm, (0.015, 0.008, 0.018), c + Vector((0, -0.104, 0.044))),
        )))
    elif kind == "hardhat":
        c = Vector((cx, head_cy, top_z - 0.035))
        created.append(new_mesh_obj("Hardhat", arm_obj, "Head", mat_yellow, lambda bm: (
            add_bm_sphere(bm, (0.104, 0.116, 0.082), c + Vector((0, 0, 0.022)), 24, 14),
            add_bm_cyl(bm, 0.118, 0.118, 0.012, 24, c + Vector((0, -0.045, 0.002)), (math.radians(6), 0, 0)),
            add_bm_box(bm, (0.026, 0.175, 0.020), c + Vector((0, 0, 0.094)), bevel=0.006),
        )))
    elif kind == "headphones":
        created.append(new_mesh_obj("Headphones_Band", arm_obj, "Head", mat_rim, lambda bm: (
            add_bm_box(bm, (half_w * 2 + 0.024, 0.022, 0.016), Vector((cx, head_cy, top_z + 0.006)), bevel=0.005),
            add_bm_box(bm, (0.015, 0.020, top_z - eye_z + 0.008), Vector((cx - half_w - 0.008, head_cy, (top_z + eye_z) * 0.5)), bevel=0.004),
            add_bm_box(bm, (0.015, 0.020, top_z - eye_z + 0.008), Vector((cx + half_w + 0.008, head_cy, (top_z + eye_z) * 0.5)), bevel=0.004),
        )))
        created.append(new_mesh_obj("Headphones_Cups", arm_obj, "Head", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.034, 0.034, 0.022, 20, Vector((cx - half_w - 0.008, head_cy, eye_z)), (0, math.pi * 0.5, 0)),
            add_bm_cyl(bm, 0.034, 0.034, 0.022, 20, Vector((cx + half_w + 0.008, head_cy, eye_z)), (0, math.pi * 0.5, 0)),
        )))
    elif kind == "beret":
        c = Vector((cx - 0.018, head_cy + 0.008, top_z - 0.015))
        created.append(new_mesh_obj("Beret", arm_obj, "Head", mat_coral, lambda bm: (
            add_bm_sphere(bm, (0.118, 0.122, 0.045), c, 24, 12, (math.radians(-6), math.radians(15), 0)),
            add_bm_cyl(bm, 0.008, 0.005, 0.018, 10, c + Vector((-0.01, 0, 0.042))),
        )))
        created.append(new_mesh_obj("Beret_Pin", arm_obj, "Head", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.014, 0.014, 0.006, 16, c + Vector((-0.05, -0.088, 0.004)), (math.pi * 0.5, 0, 0.3)),
        )))
    elif kind == "fedora":
        c = Vector((cx, head_cy, top_z - 0.032))
        tilt = (math.radians(-5), math.radians(3), 0.0)
        created.append(new_mesh_obj("Fedora_Hat", arm_obj, "Head", mat_straw, lambda bm: (
            add_bm_cyl(bm, 0.165, 0.165, 0.012, 32, c + Vector((0, 0, 0.004)), tilt),
            add_bm_cyl(bm, 0.098, 0.088, 0.102, 28, c + Vector((0, 0, 0.056)), tilt),
        )))
        created.append(new_mesh_obj("Fedora_Band", arm_obj, "Head", mat_black, lambda bm: (
            add_bm_cyl(bm, 0.100, 0.098, 0.022, 28, c + Vector((0, 0, 0.022)), tilt),
        )))
    return created


def build_hand_accessory(kind, arm_obj):
    if not kind:
        return []
    b_hand = arm_obj.data.bones.get("RightFingerBase")
    if not b_hand:
        return []
    # In T-pose (normalized 1.0m): arm extends -X, palm faces -Z (down), fingers extend further -X!
    grip = (arm_obj.matrix_world @ b_hand.head_local) + Vector((-0.068, -0.008, -0.014))

    mat_gold = make_pbr("Prop_Gold", "#f5c242", rough=0.18, metal=0.92, coat=0.30)
    mat_leather = make_pbr("Prop_Leather", "#5c3317", rough=0.34, metal=0.05, coat=0.22)
    mat_handbag = make_pbr("Prop_Handbag", "#be123c", rough=0.30, metal=0.04, coat=0.30)
    mat_clutch = make_pbr("Prop_Clutch", "#f5d061", rough=0.22, metal=0.68, coat=0.32)
    mat_silver = make_pbr("Prop_Silver", "#cbd5e1", rough=0.20, metal=0.88, coat=0.25)
    mat_screen = make_pbr("Prop_Screen", "#0284c7", rough=0.10, metal=0.15, coat=0.8, emit_hex="#38bdf8", emit_strength=0.45)
    mat_blue = make_pbr("Prop_Blueprint", "#0284c7", rough=0.45, metal=0.0, coat=0.1)
    mat_cash = make_pbr("Prop_CashGreen", "#16a34a", rough=0.62, metal=0.0, coat=0.0)
    mat_band = make_pbr("Prop_WhiteBand", "#f8fafc", rough=0.55, metal=0.0, coat=0.0)
    mat_baton = make_pbr("Prop_Baton", "#1e293b", rough=0.28, metal=0.15, coat=0.3)
    mat_ruby = make_pbr("Prop_Ruby", "#ef4444", rough=0.08, metal=0.2, coat=0.95, emit_hex="#f87171", emit_strength=0.40)
    mat_star = make_pbr("Prop_Star", "#38bdf8", rough=0.08, metal=0.25, coat=0.95, emit_hex="#7dd3fc", emit_strength=0.65)

    created = []
    # Note: In normalized T-pose, when RightArm drops ~72 deg downward around +Y,
    # local -X rotates down to -Z (vertical), and local -Y stays pointing FORWARD (-Y)!
    if kind == "briefcase":
        created.append(new_mesh_obj("Prop_Briefcase", arm_obj, "RightFingerBase", mat_leather, lambda bm: (
            add_bm_box(bm, (0.24, 0.32, 0.085), grip + Vector((-0.175, 0.0, 0.0)), bevel=0.012),
        )))
        created.append(new_mesh_obj("Prop_BriefcaseGold", arm_obj, "RightFingerBase", mat_gold, lambda bm: (
            add_bm_box(bm, (0.045, 0.095, 0.022), grip + Vector((-0.025, 0.0, 0.0)), bevel=0.005),
            add_bm_box(bm, (0.028, 0.042, 0.088), grip + Vector((-0.10, -0.058, 0.0)), bevel=0.004),
            add_bm_box(bm, (0.028, 0.042, 0.088), grip + Vector((-0.10, 0.058, 0.0)), bevel=0.004),
        )))
    elif kind == "handbag":
        created.append(new_mesh_obj("Prop_Handbag", arm_obj, "RightFingerBase", mat_handbag, lambda bm: (
            add_bm_box(bm, (0.20, 0.25, 0.095), grip + Vector((-0.145, 0.0, 0.0)), bevel=0.016),
        )))
        created.append(new_mesh_obj("Prop_HandbagGold", arm_obj, "RightFingerBase", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.044, 0.044, 0.016, 16, grip + Vector((-0.025, 0.0, 0.0)), (0, math.pi * 0.5, 0)),
            add_bm_box(bm, (0.030, 0.036, 0.099), grip + Vector((-0.10, 0.0, 0.0)), bevel=0.004),
        )))
    elif kind == "clutch":
        created.append(new_mesh_obj("Prop_Clutch", arm_obj, "RightFingerBase", mat_clutch, lambda bm: (
            add_bm_box(bm, (0.14, 0.21, 0.052), grip + Vector((-0.10, 0.0, 0.0)), bevel=0.010),
        )))
    elif kind == "scepter":
        created.append(new_mesh_obj("Prop_Scepter", arm_obj, "RightFingerBase", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.016, 0.022, 0.65, 16, grip + Vector((0.0, -0.14, 0.0)), (math.pi * 0.5, 0, 0)),
            add_bm_cyl(bm, 0.042, 0.042, 0.020, 16, grip + Vector((0.0, -0.47, 0.0)), (math.pi * 0.5, 0, 0)),
        )))
        created.append(new_mesh_obj("Prop_ScepterGem", arm_obj, "RightFingerBase", mat_ruby, lambda bm: (
            add_bm_sphere(bm, (0.040, 0.040, 0.040), grip + Vector((0.0, -0.505, 0.0))),
        )))
    elif kind == "goblet":
        created.append(new_mesh_obj("Prop_Goblet", arm_obj, "RightFingerBase", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.030, 0.012, 0.075, 16, grip + Vector((0.0, 0.035, 0.0)), (math.pi * 0.5, 0, 0)),
            add_bm_cyl(bm, 0.012, 0.052, 0.125, 18, grip + Vector((0.0, -0.07, 0.0)), (math.pi * 0.5, 0, 0)),
        )))
    elif kind == "baton":
        created.append(new_mesh_obj("Prop_Baton", arm_obj, "RightFingerBase", mat_baton, lambda bm: (
            add_bm_cyl(bm, 0.016, 0.020, 0.40, 14, grip + Vector((0.0, -0.12, 0.0)), (math.pi * 0.5, 0, 0)),
        )))
        created.append(new_mesh_obj("Prop_BatonCap", arm_obj, "RightFingerBase", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.023, 0.023, 0.032, 14, grip + Vector((0.0, -0.32, 0.0)), (math.pi * 0.5, 0, 0)),
        )))
    elif kind == "blueprint":
        created.append(new_mesh_obj("Prop_Blueprint", arm_obj, "RightFingerBase", mat_blue, lambda bm: (
            add_bm_cyl(bm, 0.035, 0.035, 0.38, 18, grip + Vector((0.0, -0.08, 0.0)), (math.pi * 0.5, 0, 0)),
        )))
        created.append(new_mesh_obj("Prop_BlueprintBand", arm_obj, "RightFingerBase", mat_band, lambda bm: (
            add_bm_cyl(bm, 0.038, 0.038, 0.042, 18, grip + Vector((0.0, -0.08, 0.0)), (math.pi * 0.5, 0, 0)),
        )))
    elif kind == "tablet":
        created.append(new_mesh_obj("Prop_Tablet", arm_obj, "RightFingerBase", mat_silver, lambda bm: (
            add_bm_box(bm, (0.19, 0.24, 0.016), grip + Vector((-0.09, -0.09, 0.0)), bevel=0.005),
        )))
        created.append(new_mesh_obj("Prop_TabletScreen", arm_obj, "RightFingerBase", mat_screen, lambda bm: (
            add_bm_box(bm, (0.16, 0.20, 0.008), grip + Vector((-0.09, -0.09, -0.008)), bevel=0.002),
        )))
    elif kind == "camera":
        created.append(new_mesh_obj("Prop_Camera", arm_obj, "RightFingerBase", mat_baton, lambda bm: (
            add_bm_box(bm, (0.09, 0.13, 0.065), grip + Vector((-0.04, -0.05, 0.0)), bevel=0.010),
        )))
        created.append(new_mesh_obj("Prop_CameraLens", arm_obj, "RightFingerBase", mat_silver, lambda bm: (
            add_bm_cyl(bm, 0.033, 0.030, 0.050, 18, grip + Vector((-0.04, -0.095, 0.0)), (math.pi * 0.5, 0, 0)),
        )))
    elif kind == "goldbar":
        created.append(new_mesh_obj("Prop_GoldBar", arm_obj, "RightFingerBase", mat_gold, lambda bm: (
            add_bm_box(bm, (0.11, 0.20, 0.060), grip + Vector((-0.04, -0.04, 0.0)), bevel=0.010),
        )))
    elif kind == "cash":
        created.append(new_mesh_obj("Prop_Cash", arm_obj, "RightFingerBase", mat_cash, lambda bm: (
            add_bm_box(bm, (0.13, 0.22, 0.050), grip + Vector((-0.04, -0.06, 0.0)), bevel=0.006),
        )))
        created.append(new_mesh_obj("Prop_CashBand", arm_obj, "RightFingerBase", mat_gold, lambda bm: (
            add_bm_box(bm, (0.136, 0.050, 0.055), grip + Vector((-0.04, -0.06, 0.0)), bevel=0.003),
        )))
    elif kind == "star_trophy":
        created.append(new_mesh_obj("Prop_StarHandle", arm_obj, "RightFingerBase", mat_gold, lambda bm: (
            add_bm_cyl(bm, 0.018, 0.025, 0.22, 16, grip + Vector((0.0, -0.07, 0.0)), (math.pi * 0.5, 0, 0)),
        )))
        created.append(new_mesh_obj("Prop_StarGem", arm_obj, "RightFingerBase", mat_star, lambda bm: (
            add_bm_sphere(bm, (0.064, 0.064, 0.064), grip + Vector((0.0, -0.21, 0.0))),
        )))
    return created


def _pose_world_rot(arm_obj, pb, q_world):
    """Apply desired world-space rotation quaternion directly to bone while honoring parent rotation if computed procedurally."""
    m_w = pb.bone.matrix_local.to_3x3()
    return (m_w.inverted() @ q_world.to_matrix() @ m_w).to_quaternion()


def build_actions(arm_obj, mocap, prop_kind=None):
    """Build 6 smooth NLA animations using Mixamo Xbot world-space deltas + Business Tour prop guards."""
    arm_obj.animation_data_create()
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "QUATERNION"

    hanging = prop_kind in ("briefcase", "handbag", "clutch")
    held_up = prop_kind is not None and not hanging

    # Build ordered bone list (parents before children) & cache normalized rest matrices
    bone_order = []
    visited = set()
    def visit(b):
        if b.name in visited:
            return
        if b.parent:
            visit(b.parent)
        visited.add(b.name)
        bone_order.append(b.name)
    for b in arm_obj.data.bones:
        visit(b)

    m_rest = {b.name: b.matrix_local.to_3x3().normalized() for b in arm_obj.data.bones}
    parent_of = {b.name: (b.parent.name if b.parent else None) for b in arm_obj.data.bones}
    hips_m_world = m_rest["Hips"]

    def interp_mocap(act_name, u):
        samples = mocap[act_name]
        pos = max(0.0, min(1.0, u)) * (len(samples) - 1)
        i0 = int(math.floor(pos))
        i1 = min(len(samples) - 1, i0 + 1)
        alpha = pos - i0
        s0, s1 = samples[i0], samples[i1]
        dz = s0["hips_dz"] * (1.0 - alpha) + s1["hips_dz"] * alpha
        d_world = {}
        for bname, q0_arr in s0["rots"].items():
            q0 = Quaternion(q0_arr)
            q1 = Quaternion(s1["rots"][bname])
            d_world[bname] = q0.slerp(q1, alpha)
        return dz, d_world

    def apply_world_deltas(d_world, dz_m, f):
        # Compute per-bone local quaternion from cumulative world deltas:
        # D_parent^-1 * D_bone converted into bone rest space
        for bname in bone_order:
            if bname not in d_world:
                continue
            pb = arm_obj.pose.bones.get(bname)
            if not pb:
                continue
            d_self = d_world[bname]
            pname = parent_of.get(bname)
            d_par = Quaternion((1, 0, 0, 0))
            cur = pname
            while cur:
                if cur in d_world:
                    d_par = d_world[cur]
                    break
                cur = parent_of.get(cur)
            rel_world = (d_par.inverted() @ d_self).to_matrix()
            mr = m_rest[bname]
            pb.rotation_quaternion = (mr.inverted() @ rel_world @ mr).to_quaternion()
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
        pb_hips = arm_obj.pose.bones["Hips"]
        pb_hips.location = hips_m_world.inverted() @ Vector((0.0, 0.0, dz_m))
        pb_hips.keyframe_insert(data_path="location", frame=f)

    def make_euler_delta(rx_deg, ry_deg, rz_deg):
        return Euler((math.radians(rx_deg), math.radians(ry_deg), math.radians(rz_deg)), "XYZ").to_quaternion()

    def build_world_chain(local_deltas_deg):
        """Convert intuitive per-joint world Euler deltas (applied hierarchically) into cumulative d_world."""
        d_w = {}
        for bname in bone_order:
            pname = parent_of.get(bname)
            d_par = d_w.get(pname, Quaternion((1, 0, 0, 0)))
            if bname in local_deltas_deg:
                q_loc = make_euler_delta(*local_deltas_deg[bname])
                d_w[bname] = d_par @ q_loc
            elif pname in d_w:
                d_w[bname] = d_par
        return d_w

    def adjust_prop_arm(d_world, mode, u):
        # Smoothly steer RightArm / RightForeArm to keep prop clean & visible without clipping body
        if not prop_kind:
            return
        if mode in ("idle", "walk"):
            sw = math.sin(u * math.tau)
            # Rebuild RightArm/ForeArm/FingerBase chain cleanly relative to Spine2
            sp2 = d_world.get("Spine2", Quaternion((1, 0, 0, 0)))
            if hanging:
                q_arm = sp2 @ make_euler_delta(-5.0 + (sw * 6.0 if mode == "walk" else 0.0), -76.0, 8.0)
                q_fore = q_arm @ make_euler_delta(-10.0, 0.0, 14.0)
            else:
                q_arm = sp2 @ make_euler_delta(-12.0 + (sw * 8.0 if mode == "walk" else 0.0), -68.0, 10.0)
                q_fore = q_arm @ make_euler_delta(-12.0, 0.0, 42.0)
            d_world["RightArm"] = q_arm
            d_world["RightForeArm"] = q_fore
            d_world["RightFingerBase"] = q_fore

    specs = [
        ("idle", "idle_Armature", 48, 4, True),
        ("walk", "walk_Armature", 24, 2, True),
        ("jump", None, 24, 3, False),
        ("cheer", "agree_Armature", 36, 3, False),
        ("hit", "headShake_Armature", 24, 3, False),
        ("die", None, 26, 3, False),
    ]

    actions = {}
    for name, src_act, n_frames, step, cyclic in specs:
        act = bpy.data.actions.new(name=name)
        arm_obj.animation_data.action = act
        frames = list(range(1, n_frames + 1, step))
        if frames[-1] != n_frames:
            frames.append(n_frames)
        for f in frames:
            u = 0.0 if (cyclic and f == n_frames) else float(f - 1) / float(max(1, n_frames - 1))
            if src_act is not None:
                dz, d_world = interp_mocap(src_act, u)
                if name == "cheer":
                    # Blend lively raised cheer arms + happy bounce over Xbot torso/legs!
                    up = math.sin(u * math.pi)
                    wv = math.sin(u * math.tau * 2.0)
                    dz += abs(wv) * 0.075 * up
                    sp2 = d_world.get("Spine2", Quaternion((1, 0, 0, 0)))
                    d_world["LeftArm"] = sp2 @ make_euler_delta(-18.0 * up, -72.0 * (1.0 - up) + (-42.0 + wv * 14.0) * up, -12.0)
                    d_world["LeftForeArm"] = d_world["LeftArm"] @ make_euler_delta(0.0, 0.0, -28.0 * up)
                    d_world["RightArm"] = sp2 @ make_euler_delta(-18.0 * up, 72.0 * (1.0 - up) + (42.0 - wv * 14.0) * up, 12.0)
                    d_world["RightForeArm"] = d_world["RightArm"] @ make_euler_delta(0.0, 0.0, 28.0 * up)
                    d_world["RightFingerBase"] = d_world["RightForeArm"]
                else:
                    adjust_prop_arm(d_world, name, u)
            elif name == "jump":
                up = math.sin(u * math.pi)
                dz = up * 0.22
                d_world = build_world_chain({
                    "Hips": (-5.0 * up, 0.0, 0.0),
                    "Spine": (-5.0 * up, 0.0, 0.0),
                    "Head": (8.0 * up, 0.0, 0.0),
                    "LeftArm": (-28.0 * up - 6.0, 72.0 - 48.0 * up, -10.0),
                    "LeftForeArm": (0.0, 0.0, -32.0 * up - 15.0),
                    "RightArm": (-24.0 * up - 6.0, -72.0 + 44.0 * up, 10.0),
                    "RightForeArm": (0.0, 0.0, 32.0 * up + (14.0 if hanging else 28.0)),
                    "LeftUpLeg": (-34.0 * up - 4.0, 0.0, 4.0),
                    "LeftLeg": (56.0 * up + 6.0, 0.0, 0.0),
                    "RightUpLeg": (-22.0 * up - 4.0, 0.0, -4.0),
                    "RightLeg": (42.0 * up + 6.0, 0.0, 0.0),
                })
            else:  # die
                uu = min(1.0, u * 1.15)
                uu = uu * uu * (3.0 - 2.0 * uu)
                dz = -(uu * uu) * 0.26
                d_world = build_world_chain({
                    "Hips": (-12.0 * uu, 0.0, 0.0),
                    "Spine": (-18.0 * uu, 0.0, 6.0 * uu),
                    "Spine2": (-16.0 * uu, 0.0, 0.0),
                    "Head": (-22.0 * uu, 6.0 * uu, -8.0 * uu),
                    "LeftArm": (-15.0 * uu, 74.0 + 4.0 * uu, -6.0),
                    "LeftForeArm": (0.0, 0.0, -14.0),
                    "RightArm": (-15.0 * uu, -74.0 - 4.0 * uu, 6.0),
                    "RightForeArm": (0.0, 0.0, 14.0),
                    "LeftUpLeg": (-22.0 * uu, 0.0, 6.0),
                    "LeftLeg": (38.0 * uu, 0.0, 0.0),
                    "RightUpLeg": (-22.0 * uu, 0.0, -6.0),
                    "RightLeg": (38.0 * uu, 0.0, 0.0),
                })
            apply_world_deltas(d_world, dz, f)

        for fc in act.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"
                kp.handle_left_type = "AUTO_CLAMPED"
                kp.handle_right_type = "AUTO_CLAMPED"
        track = arm_obj.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(name, 1, act)
        strip.name = name
        actions[name] = act
    arm_obj.animation_data.action = None
    return actions


def build_studio_plinth():
    mat_navy = make_pbr("Plinth_Navy", "#123466", rough=0.26, metal=0.25, coat=0.45)
    mat_gold = make_pbr("Plinth_Gold", "#f5be3e", rough=0.18, metal=0.92, coat=0.35)
    objs = []
    for nm, r1, r2, h, cz, mat in [
        ("Plinth_Base", 0.36, 0.38, 0.055, -0.028, mat_gold),
        ("Plinth_Disc", 0.32, 0.33, 0.052, -0.024, mat_navy),
    ]:
        bm = bmesh.new()
        add_bm_cyl(bm, r1, r2, h, 48, Vector((0.0, 0.0, cz)))
        mesh = bpy.data.meshes.new(nm)
        bm.to_mesh(mesh)
        bm.free()
        for p in mesh.polygons:
            p.use_smooth = True
        o = bpy.data.objects.new(nm, mesh)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(mat)
        objs.append(o)
    return objs


def create_lighting_and_cam(scene):
    w = bpy.data.worlds.new("BTStudio")
    scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = srgb_to_linear("#eef5ff")
        bg.inputs["Strength"].default_value = 0.62

    def add_area(name, loc, energy, size, hex_col):
        ld = bpy.data.lights.new(name, type="AREA")
        ld.energy = energy
        ld.size = size
        ld.color = srgb_to_linear(hex_col)[:3]
        lo = bpy.data.objects.new(name, ld)
        bpy.context.collection.objects.link(lo)
        lo.location = loc
        direction = (Vector((0.0, -0.05, 1.35)) - Vector(loc)).normalized()
        lo.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        return lo

    # Warm key front-left, bright catchlight fill front-right, cool crisp rim back
    add_area("KeyLight", (-1.8, -2.9, 2.8), 165.0, 2.0, "#fff6eb")
    add_area("FillLight", (1.9, -2.5, 1.9), 105.0, 2.6, "#eaf4ff")
    add_area("RimLight", (1.5, 2.4, 2.6), 145.0, 1.8, "#d4e6ff")

    cd = bpy.data.cameras.new("StudioCam")
    cd.lens = 68.0
    cd.sensor_width = 36.0
    co = bpy.data.objects.new("StudioCam", cd)
    bpy.context.collection.objects.link(co)
    scene.camera = co
    return co


def eval_mesh_bounds(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        if o.type != "MESH" or o.hide_render:
            continue
        eo = o.evaluated_get(dg)
        m = eo.to_mesh()
        for v in m.vertices:
            pts.append(eo.matrix_world @ v.co)
        eo.to_mesh_clear()
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def render_portrait_and_bust(k, cam_obj, arm_obj, char_meshes, plinth_objs, actions):
    scene = bpy.context.scene
    os.makedirs(UI_RAW, exist_ok=True)
    arm_obj.animation_data.use_nla = False
    arm_obj.animation_data.action = actions["idle"]
    scene.frame_set(12)
    bpy.context.view_layer.update()

    cam_dir = Vector((-0.26, -0.96, 0.06)).normalized()
    fov_rad = 2.0 * math.atan(cam_obj.data.sensor_width / (2.0 * cam_obj.data.lens))

    # 1) Full Collector Portrait with Plinth -> c{k}.png (640x640 -> 320x320 in fix_chars.py)
    for po in plinth_objs:
        po.hide_render = False
    bpy.context.view_layer.update()
    mn, mx = eval_mesh_bounds(char_meshes + plinth_objs)
    center = (mn + mx) * 0.5
    span = max(mx.z - mn.z, mx.x - mn.x, mx.y - mn.y)
    dist = (span * 0.62) / math.tan(fov_rad * 0.5)
    cam_obj.location = center + cam_dir * dist
    cam_obj.rotation_euler = (center - cam_obj.location).to_track_quat("-Z", "Y").to_euler()

    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.filepath = os.path.join(UI_RAW, f"c{k}.png")
    bpy.ops.render.render(write_still=True)

    # 2) Close-Up Warm Headshot Bust (no plinth, fits crowns/tophats cleanly inside circle!) -> av{k}.png
    for po in plinth_objs:
        po.hide_render = True
    bpy.context.view_layer.update()
    mn2, mx2 = eval_mesh_bounds(char_meshes)
    eye_l = arm_obj.matrix_world @ arm_obj.pose.bones["LeftEye"].head
    eye_r = arm_obj.matrix_world @ arm_obj.pose.bones["RightEye"].head
    eye_mid = (eye_l + eye_r) * 0.5
    top_z = mx2.z + 0.025
    chest_z = min(eye_mid.z - 0.25, top_z - 0.44)
    bust_center = Vector((eye_mid.x, eye_mid.y, (chest_z + top_z) * 0.5))
    bust_span = max(0.46, top_z - chest_z)
    cam_b_dir = Vector((-0.14, -0.99, 0.03)).normalized()
    dist_b = (bust_span * 0.54) / math.tan(fov_rad * 0.5)
    cam_obj.location = bust_center + cam_b_dir * dist_b
    cam_obj.rotation_euler = (bust_center - cam_obj.location).to_track_quat("-Z", "Y").to_euler()

    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.filepath = os.path.join(UI_RAW, f"av{k}.png")
    bpy.ops.render.render(write_still=True)

    arm_obj.animation_data.action = None
    arm_obj.animation_data.use_nla = True
    bpy.context.view_layer.update()


def build_one(k, mocap, do_render=True):
    spec = CHARS[k]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    src = os.path.join(RAW_DIR, spec["file"])
    bpy.ops.import_scene.gltf(filepath=src)

    # Delete unparented Icosphere helper mesh
    for o in list(bpy.data.objects):
        if o.type == "MESH" and ("Icosphere" in o.name or o.parent is None):
            bpy.data.objects.remove(o, do_unlink=True)

    arm_obj = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    char_meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    body_obj = next((o for o in char_meshes if "HighRes" in o.name), char_meshes[0])

    enhance_and_resize_textures(body_obj, char_meshes, spec, k)
    apply_expressions_and_normalize(arm_obj, char_meshes, spec, k)

    acc_head = build_head_accessory(spec["head_acc"], arm_obj, char_meshes)
    acc_hand = build_hand_accessory(spec["hand_acc"], arm_obj)
    all_meshes = char_meshes + acc_head + acc_hand

    # Reset pose cleanly before building NLA tracks
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.transforms_clear()
    bpy.ops.object.mode_set(mode="OBJECT")

    actions = build_actions(arm_obj, mocap, prop_kind=spec["hand_acc"])

    scene = bpy.context.scene
    setup_cycles(scene, samples=64)
    cam_obj = create_lighting_and_cam(scene)
    plinth_objs = build_studio_plinth()

    if do_render:
        render_portrait_and_bust(k, cam_obj, arm_obj, all_meshes, plinth_objs, actions)

    for o in plinth_objs:
        bpy.data.objects.remove(o, do_unlink=True)

    os.makedirs(GLB_OUT, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        if o.type not in ("CAMERA", "LIGHT"):
            o.select_set(True)
    glb_path = os.path.join(GLB_OUT, f"c{k}.glb")
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
        export_frame_step=2,
        export_def_bones=True,
        export_leaf_bone=False,
        export_optimize_animation_size=True,
        export_skins=True,
        export_materials="EXPORT",
        export_image_format="JPEG",
        export_image_quality=88,
    )
    sz_kb = os.path.getsize(glb_path) // 1024
    tris = sum(len(o.data.polygons) for o in all_meshes)
    print(f"OK c{k}: glb={sz_kb}KB tris={tris} nla={[t.name for t in arm_obj.animation_data.nla_tracks]}")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    only = list(range(12))
    do_render = "--no-render" not in argv
    for a in argv:
        if a.startswith("--only="):
            only = [int(x) for x in a.split("=", 1)[1].split(",") if x.strip() != ""]
    with open(MOCAP_CACHE, "r", encoding="utf-8") as mf:
        mocap_data = json.load(mf)
    for idx in only:
        build_one(idx, mocap_data, do_render=do_render)
