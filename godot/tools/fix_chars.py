# Xử lý bảng khung hình nhân vật sau khi chụp bằng tools/render_chars.tscn:
# ảnh chụp từ viewport trong suốt của Godot là alpha nhân sẵn -> đổi về alpha thẳng, tăng nhẹ độ tươi, nén lại PNG.
# Chạy: python godot/tools/fix_chars.py [k ...]
import os, sys, glob
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.normpath(os.path.join(HERE, "..", "assets", "chars2d"))


def fix(path):
    im = Image.open(path).convert("RGBA")
    if im.info.get("fixed") == "1":
        return False
    a = np.asarray(im).astype(np.float32) / 255.0
    al = a[..., 3:4]
    rgb = np.where(al > 0.004, a[..., :3] / np.maximum(al, 0.004), 0.0)
    rgb = np.clip(rgb, 0, 1)
    # tăng nhẹ độ tươi + tương phản
    g = rgb.mean(-1, keepdims=True)
    rgb = np.clip(g + (rgb - g) * 1.14, 0, 1)
    rgb = np.clip((rgb - 0.5) * 1.05 + 0.52, 0, 1)
    out = np.dstack([rgb, al])
    img = Image.fromarray((out * 255 + 0.5).astype(np.uint8), "RGBA")
    from PIL.PngImagePlugin import PngInfo
    meta = PngInfo()
    meta.add_text("fixed", "1")
    img.save(path, optimize=True, pnginfo=meta)
    return True


if __name__ == "__main__":
    only = sys.argv[1:]
    for p in sorted(glob.glob(os.path.join(DIR, "c*.png"))):
        k = os.path.basename(p)[1:-4]
        if only and k not in only:
            continue
        print(os.path.basename(p), "đã sửa" if fix(p) else "bỏ qua (đã sửa rồi)", os.path.getsize(p) // 1024, "KB")
