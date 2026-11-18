# Xử lý ảnh nhân vật / công trình / đạo cụ sau khi chụp từ SubViewport trong suốt của Godot:
# đổi từ alpha nhân sẵn (premultiplied) sang alpha thẳng, khử viền rìa, tăng độ tươi vừa phải mà KHÔNG làm cháy vùng sáng.
# Chạy: python godot/tools/fix_chars.py [--force] [tên ...]
import os, sys, glob
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image, ImageFilter
from PIL.PngImagePlugin import PngInfo

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.normpath(os.path.join(HERE, "..", "assets"))


def fix(path, force=False):
    im = Image.open(path).convert("RGBA")
    if not force and im.info.get("fixed") == "1":
        return False
    a = np.asarray(im).astype(np.float32) / 255.0
    al = a[..., 3:4]
    # Khử nhân sẵn alpha an toàn
    rgb = np.where(al > 0.006, a[..., :3] / np.maximum(al, 0.006), 0.0)
    rgb = np.clip(rgb, 0.0, 1.0)

    # Làm sạch màu ở mép bán trong suốt rất mỏng (tránh viền xám/trắng khi thu phóng)
    core_mask = (al[..., 0] > 0.35).astype(np.float32)
    if core_mask.any():
        w_im = Image.fromarray((core_mask * 255).astype(np.uint8), "L").filter(ImageFilter.BoxBlur(2))
        w = (np.asarray(w_im).astype(np.float32) / 255.0)[..., None]
        chs = []
        for ch in range(3):
            c_im = Image.fromarray((rgb[..., ch] * core_mask * 255).astype(np.uint8), "L").filter(ImageFilter.BoxBlur(2))
            chs.append(np.asarray(c_im).astype(np.float32) / 255.0)
        near_rgb = np.stack(chs, axis=-1) / np.maximum(w, 1e-4)
        fringe = (al > 0.004) & (al <= 0.35) & (w > 0.02)
        rgb = np.where(fringe, np.clip(near_rgb, 0.0, 1.0), rgb)

    # Tăng độ tươi màu ở vùng trung gian, giữ nguyên chi tiết vùng sáng (hộp sọ, tóc sáng, tường trắng)
    luma = rgb[..., 0:1] * 0.299 + rgb[..., 1:2] * 0.587 + rgb[..., 2:3] * 0.114
    hi_guard = 1.0 - np.clip((luma - 0.72) / 0.28, 0.0, 1.0)
    vib = 1.0 + 0.16 * hi_guard
    rgb = np.clip(luma + (rgb - luma) * vib, 0.0, 1.0)
    # Đường cong S rất nhẹ giữ 0 và 1 không bị cắt cụt
    rgb = np.clip(rgb * (1.03 - 0.03 * rgb), 0.0, 1.0)

    out = np.dstack([rgb, al])
    img = Image.fromarray((out * 255.0 + 0.5).astype(np.uint8), "RGBA")
    meta = PngInfo()
    meta.add_text("fixed", "1")
    img.save(path, optimize=True, pnginfo=meta)
    return True


def _tight_frame_rgba(im, out_sz, fill_ratio=0.91, bottom_pad=10):
    a = np.asarray(im)
    ys, xs = np.where(a[..., 3] > 6)
    if len(xs) == 0:
        return im.resize((out_sz, out_sz), Image.Resampling.LANCZOS)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    bw, bh = crop.size
    target = int(round(out_sz * fill_ratio))
    sc = float(target) / float(max(bw, bh))
    tw = max(1, int(round(bw * sc)))
    th = max(1, int(round(bh * sc)))
    crop = crop.resize((tw, th), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (out_sz, out_sz), (0, 0, 0, 0))
    dx = (out_sz - tw) // 2
    dy = max((out_sz - th) // 2, out_sz - th - bottom_pad)
    canvas.paste(crop, (dx, dy))
    return canvas


def add_ui_silhouette(path_or_im):
    """Thêm viền mảnh tối ấm (~1.5px) và bóng đổ nhẹ phía sau chân dung UI giúp tách nền sáng rõ nét."""
    im = (path_or_im if isinstance(path_or_im, Image.Image) else Image.open(path_or_im)).convert("RGBA")
    arr = np.asarray(im).astype(np.float32) / 255.0
    fg_rgb = arr[..., :3]
    fg_a = arr[..., 3:4]

    # 1) Viền micro-outline ấm (48, 28, 62, 0.34) mở rộng ~1.5px quanh đường bao nhân vật
    al_img = Image.fromarray((np.clip(fg_a[..., 0], 0.0, 1.0) * 255.0).astype(np.uint8), "L")
    ol_img = al_img.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.55))
    ol_a = (np.asarray(ol_img).astype(np.float32) / 255.0)[..., None] * 0.34

    # 2) Bóng đổ tiếp xúc mềm phía dưới-sau (dịch +3px Y)
    sh_src = Image.new("L", al_img.size, 0)
    sh_src.paste(al_img, (0, 3))
    sh_img = sh_src.filter(ImageFilter.GaussianBlur(3.2))
    sh_a = (np.asarray(sh_img).astype(np.float32) / 255.0)[..., None] * 0.14

    bg_col = np.array([48.0 / 255.0, 28.0 / 255.0, 62.0 / 255.0], dtype=np.float32)[None, None, :]
    # Hợp nhất bóng + viền ở lớp nền: a_back = ol_a + sh_a * (1 - ol_a)
    back_a = ol_a + sh_a * (1.0 - ol_a)
    # Hợp chất tiền cảnh lên lớp nền (Porter-Duff straight alpha over)
    out_a = fg_a + back_a * (1.0 - fg_a)
    premul_rgb = fg_rgb * fg_a + bg_col * back_a * (1.0 - fg_a)
    out_rgb = np.where(out_a > 1e-4, premul_rgb / np.maximum(out_a, 1e-4), 0.0)

    res = np.dstack([np.clip(out_rgb, 0.0, 1.0), np.clip(out_a, 0.0, 1.0)])
    return Image.fromarray((res * 255.0 + 0.5).astype(np.uint8), "RGBA")


if __name__ == "__main__":
    raw_args = sys.argv[1:]
    force = "--force" in raw_args
    keep_raw = "--keep-raw" in raw_args
    only = [x for x in raw_args if x not in ("--force", "--keep-raw")]
    files = (sorted(glob.glob(os.path.join(ASSETS_DIR, "build2d", "*.png")))
             + sorted(glob.glob(os.path.join(ASSETS_DIR, "props2d", "*.png"))))
    if os.path.isdir(os.path.join(ASSETS_DIR, "chars2d")):
        files = sorted(glob.glob(os.path.join(ASSETS_DIR, "chars2d", "c*.png"))) + files
    for p in files:
        base = os.path.basename(p)[:-4]
        k = base[1:] if base.startswith("c") else base
        if only and k not in only and base not in only:
            continue
        print(os.path.basename(p), "đã sửa" if fix(p, force=force) else "bỏ qua (đã sửa rồi)", os.path.getsize(p) // 1024, "KB")
    # Nếu có ảnh thô giao diện (.ui_raw) thì xử lý (cắt sát khung nếu render từ Blender Cycles 640/512px) và xuất sang assets/ui/{chars,dice}/*.webp
    raw_root = os.path.normpath(os.path.join(HERE, "..", "..", ".ui_raw"))
    if os.path.isdir(raw_root):
        for sub in ("chars", "dice"):
            src_dir = os.path.join(raw_root, sub)
            dst_dir = os.path.normpath(os.path.join(ASSETS_DIR, "ui", sub))
            if not os.path.isdir(src_dir):
                continue
            os.makedirs(dst_dir, exist_ok=True)
            for p in sorted(glob.glob(os.path.join(src_dir, "*.png"))):
                bname = os.path.basename(p)
                if sub == "chars":
                    im = Image.open(p).convert("RGBA")
                    if bname.startswith("av"):
                        out_im = im.resize((256, 256), Image.Resampling.LANCZOS)
                    elif im.width > 400:
                        cropped = _tight_frame_rgba(im, 320, fill_ratio=0.91, bottom_pad=10)
                        out_im = add_ui_silhouette(cropped)
                    else:
                        fix(p, force=True)
                        out_im = add_ui_silhouette(p)
                else:
                    fix(p, force=True)
                    out_im = Image.open(p)
                wpath = os.path.join(dst_dir, bname[:-4] + ".webp")
                out_im.save(wpath, "WEBP", lossless=True, quality=100)
                print("ui", sub, os.path.basename(wpath), os.path.getsize(wpath) // 1024, "KB")
        if not keep_raw:
            import shutil
            shutil.rmtree(raw_root, ignore_errors=True)
