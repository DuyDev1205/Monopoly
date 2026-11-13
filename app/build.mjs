// Đóng gói bản web thành thư mục app/dist cho Tauri, rồi gắn giao diện riêng của bản app (skin "td").
// Bản web (index.html, css/, js/ ở gốc repo) KHÔNG bị sửa — skin chỉ có trong app/dist.
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dist = join(here, 'dist');
const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));

mkdirSync(dist, { recursive: true });
for (const f of readdirSync(dist)) rmSync(join(dist, f), { recursive: true, force: true });   // giữ thư mục (có thể đang được mở)
for (const p of ['css', 'js', 'assets', 'manifest.webmanifest']) {
  if (existsSync(join(root, p))) cpSync(join(root, p), join(dist, p), { recursive: true });
}
// mô hình 3D + Three.js chỉ cần khi dựng ảnh (BAKE=1 node build.mjs); bản đóng gói chỉ chở ảnh đã dựng
const BAKE = process.env.BAKE === '1';
// bản đóng gói chỉ chở các mô hình được dùng (danh sách KIT_FILES trong scene3d.js)
const s3 = readFileSync(join(here, 'skin', 'scene3d.js'), 'utf8');
const PF_USED = new Set([...s3.matchAll(/'([a-z0-9-]+-[0-9a-f]{6})'/g)].map((m) => m[1] + '.glb'));
const SKIP = ['sprites', 'scene2d.js', join('vendor', 'pixi')].map((p) => join(here, 'skin', p));
const PF = join(here, 'skin', 'models', 'pf');
cpSync(join(here, 'skin'), join(dist, 'skin'), { recursive: true, filter: (src) => {
  if (SKIP.some((s) => src === s || src.startsWith(s + sep))) return false;
  if (src.startsWith(PF + sep) && !BAKE && !PF_USED.has(src.slice(PF.length + 1))) return false;
  return true;
} });


let html = readFileSync(join(root, 'index.html'), 'utf8');
const must = (cond, what) => { if (!cond) throw new Error('build.mjs: không tìm thấy ' + what + ' trong index.html'); };
must(html.includes('<html lang="vi">'), '<html lang="vi">');
must(html.includes('<link rel="stylesheet" href="css/style.css">'), 'css/style.css');
must(html.includes('<script type="module" src="js/app.js"></script>'), 'js/app.js');
const theme = '<script>try{document.documentElement.dataset.td=JSON.parse(localStorage.getItem("ctp_td_theme"))||"midnight"}catch(e){document.documentElement.dataset.td="midnight"}</script>';
html = html
  .replace('<html lang="vi">', `<html lang="vi" data-skin="td" data-version="${pkg.version}">`)
  // app chạy offline: bỏ font Google, dùng font hệ thống (Segoe UI / SF Pro) như TDCaro
  .replace(/<link rel="preconnect"[^>]*>\n?/g, '')
  .replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>\n?/, '')
  .replace('<link rel="stylesheet" href="css/style.css">', `<link rel="stylesheet" href="css/style.css">\n<link rel="stylesheet" href="skin/skin-td.css">\n${theme}`)
  .replace('<script type="module" src="js/app.js"></script>',
    `<script type="importmap">${JSON.stringify({ imports: { three: './skin/vendor/three/three.module.js', 'three/addons/': './skin/vendor/three/addons/' } })}</script>\n` +
    '<script type="module" src="skin/skin-td.js"></script>\n<script type="module" src="js/app.js"></script>');
writeFileSync(join(dist, 'index.html'), html);
console.log(`app/dist sẵn sàng (v${pkg.version})`);
