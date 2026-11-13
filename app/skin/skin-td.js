// ảnh chân dung 3D cho 4 nhân vật đầu (characters.js đọc biến này)
globalThis.__charImg = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => `skin/chars/c${k}.webp`);
import { CHARACTERS } from '../js/characters.js';
// tên theo mô hình 3D của bản app (bản web giữ tên cũ)
['Tí', 'Mai', 'Bác Ba', 'Na', 'Thuyền Trưởng', 'Chị Sáu', 'Thiếu Gia', 'Đại Ca'].forEach((n, k) => { if (CHARACTERS[k]) { CHARACTERS[k].name = n; CHARACTERS[k].kind = 'chibi'; } });
// Giao diện bản app (phong cách TDCaro): chỉ sắp xếp lại DOM + thêm vài chi tiết trang trí.
// Không đụng vào luật chơi: app.js vẫn tìm phần tử theo id nên di chuyển chúng là an toàn.
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
const VERSION = document.documentElement.dataset.version || '1.0.0';
const REPO = 'DuyDev1205/Monopoly';

// ---------- giao diện màu (4 theme như TDCaro) ----------
export const TD_THEMES = [
  { key: 'midnight', name: 'Midnight Neon', board: '#1A2040', a: '#FF4F8B', b: '#35D5FF' },
  { key: 'wood', name: 'Gỗ Cổ Điển', board: '#E8C48C', a: '#C0392B', b: '#1F3A5F' },
  { key: 'ocean', name: 'Đại Dương', board: '#FFF9EC', a: '#1E3A5F', b: '#FF6B5B' },
  { key: 'sakura', name: 'Hoa Anh Đào', board: '#FFFFFF', a: '#E8467C', b: '#6F4BE8' },
];
function setTheme(key) {
  document.documentElement.dataset.td = key;
  try { localStorage.setItem('ctp_td_theme', JSON.stringify(key)); } catch {}
  document.querySelectorAll('.td-sw').forEach((b) => b.classList.toggle('on', b.dataset.k === key));
  window.__td3d?.setTheme(key);
}
const swatches = () => {
  const box = el('div', 'td-themes', '<div class="td-label">Giao diện</div><div class="td-sws"></div>');
  const row = $('.td-sws', box);
  TD_THEMES.forEach((t) => {
    const b = el('button', 'td-sw', `<span class="td-sw-prev" style="--bd:${t.board}"><i style="--c:${t.a}"></i><b style="--c:${t.b}"></b></span><small>${t.name}</small>`);
    b.dataset.k = t.key; b.type = 'button';
    b.addEventListener('click', () => setTheme(t.key));
    row.appendChild(b);
  });
  return box;
};

// ---------- trang chủ: 2 cột ----------
function buildHome() {
  const card = $('#home .home-card');
  if (!card) return;
  const brand = $('.brand', card), modes = $('.modes', card), foot = $('.home-foot', card);
  brand.innerHTML = `
    <div class="td-glyphs"><span class="td-g-die"><i></i><i></i><i></i><i></i><i></i></span><span class="td-g-coin">₫</span></div>
    <h1 class="td-title">Cờ Tỷ Phú</h1>
    <div class="td-tag">VIỆT NAM <span>·</span> MUA ĐẤT <span>·</span> XÂY NHÀ</div>
    <p class="td-desc">Đi khắp 3 miền, mua đất, xây nhà, mở lễ hội và trở thành tỷ phú giàu nhất bàn cờ.</p>`;
  const left = el('div', 'td-left'), panel = el('div', 'td-panel');
  left.append(brand, modes, $('.foot-btns', foot));
  panel.append($('#tab-local', card), $('#tab-online', card), swatches());
  foot.classList.add('hidden');            // nút theme cũ vẫn giữ trong DOM cho app.js
  card.prepend(left, panel);
  card.appendChild(foot);
}

// ---------- ván chơi: bàn cờ bên trái, bảng điều khiển bên phải ----------
function buildGame() {
  const game = $('#game');
  if (!game) return;
  const title = $('.tb-title', game);
  if (title) title.innerHTML = '<span class="td-g-die sm"><i></i><i></i><i></i><i></i><i></i></span>Cờ Tỷ Phú <span>Việt Nam</span>';
  // nút toàn màn hình cạnh nút nhạc / âm thanh
  const fs = el('button', 'icon-btn td-fs', FS_ICON); fs.type = 'button'; fs.title = 'Toàn màn hình (F11)';
  fs.addEventListener('click', toggleFullscreen);
  $('.tb-right', game)?.appendChild(fs);
}
// ---------- toàn màn hình: mở app là toàn màn hình; F11 / nút để bật tắt; Esc để thoát ----------
const FS_ICON = '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"/></svg>';
const appWin = () => window.__TAURI__?.window?.getCurrentWindow?.();
async function isFull() {
  try { const w = appWin(); if (w) return await w.isFullscreen(); } catch {}
  return !!document.fullscreenElement;
}
async function setFull(on) {
  try { const w = appWin(); if (w) { await w.setFullscreen(on); return; } } catch {}
  try { if (on) await document.documentElement.requestFullscreen(); else if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
}
async function toggleFullscreen() { await setFull(!(await isFull())); }
addEventListener('keydown', async (e) => {
  if (e.key === 'F11' || (e.key === 'Enter' && e.altKey)) { e.preventDefault(); toggleFullscreen(); }
  else if (e.key === 'Escape' && !document.querySelector('#modal:not(.hidden)') && (await isFull())) setFull(false);
});
// trang chủ: nút toàn màn hình cạnh nút nhạc / luật chơi
function homeFsButton() {
  const row = $('.td-left .foot-btns');
  if (!row) return;
  const b = el('button', 'chip', '⛶ Toàn màn hình'); b.type = 'button';
  b.addEventListener('click', toggleFullscreen);
  row.appendChild(b);
}

// ---------- nền: biểu tượng trôi nhẹ (như X/O của TDCaro) ----------
function floats() {
  const box = el('div', 'td-floats');
  const kinds = ['f-die', 'f-coin', 'f-house', 'f-die', 'f-coin', 'f-dia'];
  for (let k = 0; k < 16; k++) {
    const s = el('i', 'td-f ' + kinds[k % kinds.length]);
    s.style.cssText = `--x:${(k * 61) % 100}%;--y:${(k * 37 + 11) % 100}%;--s:${0.6 + ((k * 7) % 10) / 10};--d:${18 + (k * 5) % 16}s;--o:${-(k * 3.7)}s`;
    box.appendChild(s);
  }
  document.body.prepend(box);
}

// ---------- phiên bản + kiểm tra bản mới trên GitHub Releases ----------
async function openUrl(url) {
  try { if (window.__TAURI__?.opener?.openUrl) return await window.__TAURI__.opener.openUrl(url); } catch {}
  window.open(url, '_blank');
}
function versionTag() {
  const v = el('button', 'td-ver', `v${VERSION}`);
  v.type = 'button';
  v.title = 'Kiểm tra bản mới';
  v.addEventListener('click', () => checkUpdate(true));
  document.body.appendChild(v);
  setTimeout(() => checkUpdate(false), 1500);
}
// ---------- tự cập nhật (Tauri updater): kiểm tra -> bấm 1 lần -> tải + cài + mở lại ----------
let updBox = null, updBusy = false;
function updUI(html, onClick) {
  if (!updBox) { updBox = el('button', 'td-update'); updBox.type = 'button'; document.body.appendChild(updBox); }
  updBox.innerHTML = html;
  updBox.onclick = onClick || null;
  updBox.classList.toggle('busy', !onClick);
}
async function checkUpdate(manual) {
  if (updBusy) return;
  const U = window.__TAURI__?.updater;
  if (!U?.check) {                                   // chạy ngoài app (trình duyệt): chỉ báo có bản mới
    if (manual) openUrl(`https://github.com/${REPO}/releases/latest`);
    return;
  }
  let up = null;
  try { up = await U.check(); } catch (e) {
    if (manual) { updUI('<b>Không kiểm tra được bản mới</b><small>Kiểm tra mạng rồi bấm lại</small>', () => { updBox.remove(); updBox = null; checkUpdate(true); }); }
    return;
  }
  if (!up) {
    if (manual) { updUI(`<b>Đang dùng bản mới nhất</b><small>v${VERSION}</small>`, () => { updBox.remove(); updBox = null; }); setTimeout(() => { if (updBox && !updBusy) { updBox.remove(); updBox = null; } }, 3000); }
    return;
  }
  updUI(`<b>Có bản mới v${up.version}</b><small>Bấm để tự cập nhật</small>`, () => install(up));
}
async function install(up) {
  updBusy = true;
  let total = 0, got = 0;
  updUI(`<b>Đang tải v${up.version}…</b><small>0%</small><i class="td-bar"><em style="width:0%"></em></i>`);
  try {
    await up.downloadAndInstall((ev) => {
      if (ev.event === 'Started') total = ev.data?.contentLength || 0;
      else if (ev.event === 'Progress') {
        got += ev.data?.chunkLength || 0;
        const pc = total ? Math.min(100, Math.round((got / total) * 100)) : 0;
        updUI(`<b>Đang tải v${up.version}…</b><small>${total ? pc + '%' : (got / 1048576).toFixed(1) + ' MB'}</small><i class="td-bar"><em style="width:${pc}%"></em></i>`);
      } else if (ev.event === 'Finished') updUI(`<b>Đang cài v${up.version}…</b><small>App sẽ tự mở lại</small>`);
    });
    await window.__TAURI__.process.relaunch();
  } catch (e) {
    updBusy = false;
    updUI(`<b>Cập nhật lỗi</b><small>${String(e?.message || e).slice(0, 60)} · bấm để thử lại</small>`, () => install(up));
  }
}

// link ngoài (ví dụ trang luật / github) mở bằng trình duyệt của máy
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="http"]');
  if (a && window.__TAURI__) { e.preventDefault(); openUrl(a.href); }
});

floats();
buildHome();
buildGame();
homeFsButton();
versionTag();
setTheme(document.documentElement.dataset.td || 'midnight');
