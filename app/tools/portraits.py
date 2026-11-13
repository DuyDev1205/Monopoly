"""Dựng chân dung nhân vật + ảnh xem trước xúc xắc cho bản app.

Cách chạy (cần Python + Playwright):  python app/tools/portraits.py
Kết quả: app/skin/chars/c0..c7.webp, app/skin/dice/<bộ>.webp
"""
import base64
import os
import shutil
import subprocess
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright

APP = Path(__file__).resolve().parents[1]
DIST = APP / 'dist'


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


def main():
    subprocess.run('node build.mjs', cwd=APP, check=True, env={**os.environ, 'BAKE': '1'}, shell=True)
    shutil.copy(APP / 'tools' / 'portraits.html', DIST / 'portraits.html')
    srv = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(DIST)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        with sync_playwright() as p:
            b = p.chromium.launch(args=['--use-angle=d3d11', '--ignore-gpu-blocklist'])
            pg = b.new_page()
            pg.on('pageerror', lambda e: print('LỖI', e))
            pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/portraits.html')
            pg.wait_for_function('window.done === true', timeout=300000, polling=500)
            por, dice = pg.evaluate('window.__POR'), pg.evaluate('window.__DICE')
            b.close()
    finally:
        srv.shutdown()
        (DIST / 'portraits.html').unlink(missing_ok=True)
    for sub, data, name in (('chars', por, 'c{}.webp'), ('dice', dice, '{}.webp')):
        d = APP / 'skin' / sub
        d.mkdir(exist_ok=True)
        for k, url in data.items():
            (d / name.format(k)).write_bytes(base64.b64decode(url.split(',', 1)[1]))
    print(f'xong: {len(por)} chân dung, {len(dice)} xúc xắc')


if __name__ == '__main__':
    main()
