"""Dựng ảnh 2D (sprite) cho bản app PixiJS từ mô hình 3D.

Cách chạy (cần Python + Playwright):
    python app/tools/bake.py      (tự build app/dist với BAKE=1)
Kết quả: app/skin/sprites/*.webp + sprites.json
"""
import base64
import json
import os
import shutil
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parents[1]
DIST = APP / 'dist'
OUT = APP / 'skin' / 'sprites'


def main():
    import subprocess
    subprocess.run('node build.mjs', cwd=APP, check=True, env={**os.environ, 'BAKE': '1'}, shell=True)
    shutil.copy(APP / 'tools' / 'bake.html', DIST / 'bake.html')
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(DIST)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{srv.server_address[1]}/bake.html'
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--use-angle=d3d11', '--ignore-gpu-blocklist'])
            pg = b.new_page()
            pg.on('console', lambda m: print('  ', m.text) if m.text.startswith('baked') or m.type == 'error' else None)
            pg.on('pageerror', lambda e: print('LỖI', e))
            pg.goto(url)
            pg.wait_for_function('window.done === true', timeout=600000, polling=1000)
            out = pg.evaluate('window.__OUT')
            meta = pg.evaluate('window.__META')
            b.close()
    finally:
        srv.shutdown()
        (DIST / 'bake.html').unlink(missing_ok=True)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    index = {'E': meta['E'], 'K': meta['K'], 'sheets': {}}
    total = 0
    for name, sh in out.items():
        raw = base64.b64decode(sh['data'].split(',', 1)[1])
        (OUT / f'{name}.webp').write_bytes(raw)
        total += len(raw)
        index['sheets'][name] = {'file': f'{name}.webp', 'w': sh['w'], 'h': sh['h'], 'frames': sh['frames']}
    (OUT / 'sprites.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'xong: {len(out)} ảnh, {total / 1048576:.1f} MB -> {OUT}')


if __name__ == '__main__':
    main()
