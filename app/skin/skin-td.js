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
  const side = el('aside', 'td-side');
  const head = el('div', 'td-head', `
    <div class="td-mini"><span class="td-g-die sm"><i></i><i></i><i></i><i></i><i></i></span><div><b>Cờ Tỷ Phú</b><small>Việt Nam</small></div></div>`);
  const pills = el('div', 'td-pills');
  pills.append($('#roundInfo'), $('#netInfo'));
  head.appendChild(pills);
  const status = $('.statusbar', game);
  status.classList.add('td-status');
  const players = $('#players');
  const btns = el('div', 'td-btns');
  const menu = $('#btnMenu'); menu.insertAdjacentHTML('beforeend', '<span>Menu</span>');
  btns.append(menu, $('#btnMusic'), $('#btnSound'));
  side.append(head, status, players, el('div', 'td-spacer'), $('#chatForm'), btns);
  game.appendChild(side);
  $('.topbar', game)?.classList.add('td-topbar');

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
  v.title = 'Trang tải bản mới';
  v.addEventListener('click', () => openUrl(`https://github.com/${REPO}/releases`));
  document.body.appendChild(v);
  const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : null))
    .then((rel) => {
      const tag = (rel?.tag_name || '').replace(/^[^\d]*/, '');
      if (!tag || !newer(tag, VERSION)) return;
      const n = el('button', 'td-update', `<b>Có bản mới v${tag}</b><small>Bấm để tải về</small>`);
      n.type = 'button';
      n.addEventListener('click', () => openUrl(rel.html_url));
      document.body.appendChild(n);
    })
    .catch(() => {});
}

// link ngoài (ví dụ trang luật / github) mở bằng trình duyệt của máy
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="http"]');
  if (a && window.__TAURI__) { e.preventDefault(); openUrl(a.href); }
});

floats();
buildHome();
buildGame();
versionTag();
setTheme(document.documentElement.dataset.td || 'midnight');
