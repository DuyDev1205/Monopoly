// Nhân vật.
// - kind 'chibi': nhân vật tròn trịa vẽ bằng SVG, áo theo màu người chơi (biến CSS --c).
// - kind 'suit' : doanh nhân — chân dung là ảnh Avataaars (Pablo Stanley, miễn phí cả thương mại; tạo bằng DiceBear),
//                 mỗi nhân vật 5 trạng thái trong assets/chars/<id>-<trạng thái>.svg: idle, blink, excited, victory, shock.
//                 Trên bàn cờ dùng thân chibi mặc vest cùng màu.
// Muốn thêm nhân vật: thêm một mục vào CHARACTERS (+ 5 file ảnh nếu là kiểu 'suit').

export const CHARACTERS = [
  { name: 'Tí', kind: 'chibi', skin: '#ffd9b8', hair: '#3a2a22', style: 'short' },
  { name: 'Mai', kind: 'chibi', skin: '#ffe2c8', hair: '#5a3323', style: 'long' },
  { name: 'Bác Ba', kind: 'chibi', skin: '#f2c79c', hair: '#2b2118', style: 'nonla' },
  { name: 'Na', kind: 'chibi', skin: '#ffd9b8', hair: '#2b2118', style: 'buns' },
  { name: 'Ông Trùm', kind: 'suit', id: 'ongtrum', sex: 'm', skin: '#edb98a', hair: '#2c1b18', style: 'slick', suit: '#25557c', tie: '#A8102A', beard: true },
  { name: 'Nữ Tổng', kind: 'suit', id: 'nutong', sex: 'f', skin: '#ffdbb4', hair: '#4a312c', style: 'bob', suit: '#262e33', tie: '#D4AF37', lips: '#C24D5F', glasses: true },
  { name: 'Thiếu Gia', kind: 'suit', id: 'thieugia', sex: 'm', skin: '#edb98a', hair: '#a55728', style: 'wavy', suit: '#3c4f5c', tie: '#127A3E' },
  { name: 'Bà Trùm', kind: 'suit', id: 'batrum', sex: 'f', skin: '#ffdbb4', hair: '#2c1b18', style: 'bun', suit: '#e05252', tie: '#8E1F3A', lips: '#B03A4E' },
];
export const EMOTIONS = { idle: 'Tự tin', excited: 'Hào hứng', victory: 'Chiến thắng', shock: 'Sốc' };

// ---------- tiện ích màu ----------
const hex = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, k) => Math.round(v + (hex(b)[k] - v) * t).toString(16).padStart(2, '0')).join('');

// ======================= kiểu chibi (giữ nguyên như cũ) =======================
// tóc / mũ: [phần nằm sau đầu, phần nằm trước mặt]
const HAIR = {
  short: (h) => ['', `<path d="M12 25 Q10 5 30 5 Q50 5 48 25 Q45 16 37 14 Q28 20 16 16 Q13 20 12 25Z" fill="${h}"/>`],
  long: (h) => [
    `<path d="M10 24 Q10 3 30 3 Q50 3 50 24 V52 Q50 57 44 57 H16 Q10 57 10 52Z" fill="${h}"/>`,
    `<path d="M12 26 Q10 5 30 5 Q50 5 48 26 Q45 15 30 13 Q15 15 12 26Z" fill="${h}"/>
     <circle cx="44" cy="13" r="3.4" fill="#ff7fb5"/><circle cx="44" cy="13" r="1.3" fill="#ffe066"/>`,
  ],
  nonla: (h) => [
    `<path d="M12 22 Q12 34 14 38 L18 30 V20Z M48 22 Q48 34 46 38 L42 30 V20Z" fill="${h}"/>`,
    `<path d="M2 19 L30 -4 L58 19 Q30 27 2 19Z" fill="#f3dba2" stroke="#c9a65a" stroke-width="1"/>
     <path d="M30 -4 L18 21 M30 -4 L30 23 M30 -4 L42 21" stroke="#d6b871" stroke-width=".8" fill="none"/>
     <path d="M2 19 Q30 27 58 19" stroke="#b98f3f" stroke-width="1.4" fill="none"/>`,
  ],
  buns: (h) => [
    `<circle cx="13" cy="9" r="6.5" fill="${h}"/><circle cx="47" cy="9" r="6.5" fill="${h}"/>`,
    `<path d="M12 25 Q10 5 30 5 Q50 5 48 25 Q44 14 30 16 Q16 14 12 25Z" fill="${h}"/>
     <circle cx="13" cy="9" r="2" fill="#ff5c8a"/><circle cx="47" cy="9" r="2" fill="#ff5c8a"/>`,
  ],
};
const SHIRT = 'style="fill:var(--c)"';
const SHIRT_DARK = 'style="fill:color-mix(in srgb, var(--c) 72%, #000)"';
const SLEEVE = 'style="stroke:color-mix(in srgb, var(--c) 85%, #000)"';

function chibiSVG(c, bust) {
  const [back, front] = HAIR[c.style](c.hair);
  const head = `<g class="hd">${back}
    <circle cx="12.5" cy="27" r="3.2" fill="${c.skin}"/><circle cx="47.5" cy="27" r="3.2" fill="${c.skin}"/>
    <circle cx="30" cy="25" r="18" fill="${c.skin}"/>
    <ellipse class="eye" cx="23.5" cy="27" rx="2.3" ry="3.1" fill="#2b2118"/><ellipse class="eye" cx="36.5" cy="27" rx="2.3" ry="3.1" fill="#2b2118"/>
    <circle cx="24.3" cy="25.8" r=".9" fill="#fff"/><circle cx="37.3" cy="25.8" r=".9" fill="#fff"/>
    <ellipse cx="18.5" cy="33" rx="3.2" ry="1.8" fill="#ff8fa3" opacity=".55"/><ellipse cx="41.5" cy="33" rx="3.2" ry="1.8" fill="#ff8fa3" opacity=".55"/>
    <path d="M26.5 34.5 Q30 38 33.5 34.5" stroke="#b5503c" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    ${front}</g>`;
  const body = `<path d="M17 50 Q17 43 25 43 H35 Q43 43 43 50 V73 Q43 75 41 75 H19 Q17 75 17 73Z" ${SHIRT}/>
    <path d="M33 43 H35 Q43 43 43 50 V73 Q43 75 41 75 H33Z" ${SHIRT_DARK}/>
    <path d="M25 43 L30 50 L35 43Z" fill="#fff"/>`;
  if (bust) return `<svg class="chr bust" viewBox="5 -6 50 56" aria-hidden="true">${body}${head}</svg>`;
  return `<svg class="chr" viewBox="0 -6 60 104" aria-hidden="true">
    <rect x="21" y="72" width="8" height="19" rx="3" fill="#39456b"/><rect x="31" y="72" width="8" height="19" rx="3" fill="#2c3657"/>
    <ellipse cx="24" cy="93" rx="6.2" ry="3.8" fill="#fff" stroke="#c9c9d6" stroke-width=".8"/><ellipse cx="36" cy="93" rx="6.2" ry="3.8" fill="#f1f1f6" stroke="#c9c9d6" stroke-width=".8"/>
    <g class="arm l"><path d="M19 48 Q11 53 11 65" stroke-width="7" stroke-linecap="round" fill="none" ${SLEEVE}/><circle cx="11" cy="67" r="3.8" fill="${c.skin}"/></g>
    <g class="arm r"><path d="M41 48 Q49 53 49 65" stroke-width="7" stroke-linecap="round" fill="none" ${SLEEVE}/><circle cx="49" cy="67" r="3.8" fill="${c.skin}"/></g>
    ${body}${head}</svg>`;
}

// ======================= kiểu doanh nhân: chân dung nhiều lớp =======================
const STATES = ['idle', 'blink', 'excited', 'victory', 'shock'];
const avatarSrc = (c, st) => `assets/chars/${c.id}-${st}.svg`;
// Chân dung doanh nhân: 5 ảnh chồng lên nhau, CSS hiện ảnh theo cảm xúc (data-emo) và chớp mắt (class blink)
function portraitHTML(c, emo) {
  return `<span class="chr pt" data-emo="${emo}"><span class="pt-rig">${STATES.map((st) => `<img class="s-${st}" src="${avatarSrc(c, st)}" alt="" draggable="false">`).join('')}</span><i class="pt-sweat"></i><i class="pt-spk"></i></span>`;
}

// thân doanh nhân trên bàn cờ (tỉ lệ chibi để nhìn rõ khi nhỏ)
const TOKEN_HAIR = {
  slick: ['', 'M12 24 Q10 6 30 6 Q50 6 48 24 Q43 13 30 13 Q19 13 12 24Z'],
  bob: ['M10 22 Q10 3 30 3 Q50 3 50 22 V40 Q50 44 45 44 H15 Q10 44 10 40Z', 'M12 25 Q12 6 32 6 Q48 8 48 25 Q40 14 26 16 Q18 18 12 25Z'],
  wavy: ['', 'M12 24 Q11 5 30 5 Q49 6 48 24 Q44 18 40 19 Q37 13 30 15 Q24 13 21 18 Q16 18 12 24Z'],
  bun: ['M23 4 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0Z', 'M12 24 Q12 6 30 6 Q48 6 48 24 Q42 13 30 13 Q18 13 12 24Z'],
};
function suitTokenSVG(c) {
  const f = c.sex === 'f';
  const [hb, hf] = TOKEN_HAIR[c.style];
  const dark = mix(c.suit, '#000000', 0.3);
  return `<svg class="chr" viewBox="0 -6 60 104" aria-hidden="true">
    <rect x="21" y="72" width="8" height="19" rx="3" fill="${mix(c.suit, '#000000', 0.2)}"/><rect x="31" y="72" width="8" height="19" rx="3" fill="${dark}"/>
    <ellipse cx="24" cy="93" rx="6.2" ry="3.6" fill="#1b1b22"/><ellipse cx="36" cy="93" rx="6.2" ry="3.6" fill="#101016"/>
    <ellipse cx="22.5" cy="92" rx="2.4" ry="1" fill="#fff" opacity=".35"/>
    <g class="arm l"><path d="M19 48 Q11 53 11 65" stroke="${c.suit}" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="11" cy="67" r="3.8" fill="${c.skin}"/></g>
    <g class="arm r"><path d="M41 48 Q49 53 49 65" stroke="${dark}" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="49" cy="67" r="3.8" fill="${c.skin}"/></g>
    <path d="M17 50 Q17 43 25 43 H35 Q43 43 43 50 V73 Q43 75 41 75 H19 Q17 75 17 73Z" fill="${c.suit}"/>
    <path d="M33 43 H35 Q43 43 43 50 V73 Q43 75 41 75 H33Z" fill="${dark}"/>
    <path d="M25 43 L30 54 L35 43Z" fill="#f4f6fa"/>
    ${f ? '<circle cx="30" cy="50" r="1.3" fill="#D4AF37"/>' : `<path d="M29 45.5 H31 L32.2 57 L30 60.5 L27.8 57Z" fill="${c.tie}"/>`}
    <path d="M25 43 L30 54 L26.4 57 L21.6 45Z" fill="${mix(c.suit, '#000000', 0.15)}"/><path d="M35 43 L30 54 L33.6 57 L38.4 45Z" fill="${mix(c.suit, '#000000', 0.4)}"/>
    <circle cx="23.6" cy="50" r="1.6" fill="#E8577A"/>
    <g class="hd">${hb ? `<path d="${hb}" fill="${c.hair}"/>` : ''}
      <circle cx="12.5" cy="27" r="3.2" fill="${c.skin}"/><circle cx="47.5" cy="27" r="3.2" fill="${c.skin}"/>
      <circle cx="30" cy="25" r="18" fill="${c.skin}"/>
      <ellipse class="eye" cx="23.5" cy="27" rx="2.3" ry="3.1" fill="#2b2118"/><ellipse class="eye" cx="36.5" cy="27" rx="2.3" ry="3.1" fill="#2b2118"/>
      <circle cx="24.3" cy="25.8" r=".9" fill="#fff"/><circle cx="37.3" cy="25.8" r=".9" fill="#fff"/>
      <path d="M21 21.5 L26 20.6 M34 20.6 L39 21.5" stroke="${c.hair}" stroke-width="1.5" stroke-linecap="round"/>
      <ellipse cx="18.5" cy="33" rx="3.2" ry="1.8" fill="#ff8fa3" opacity="${f ? 0.6 : 0.35}"/><ellipse cx="41.5" cy="33" rx="3.2" ry="1.8" fill="#ff8fa3" opacity="${f ? 0.6 : 0.35}"/>
      <path d="M26.5 34.8 Q30.5 37 34 33.8" stroke="${f ? c.lips : '#9A4A3A'}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="${hf}" fill="${c.hair}"/>
      ${c.glasses ? '<g fill="none" stroke="#262e33" stroke-width="1.3"><circle cx="23.5" cy="27" r="4.3"/><circle cx="36.5" cy="27" r="4.3"/><path d="M27.8 27 H32.2"/></g>' : ''}
      ${c.beard ? `<path d="M14 30 Q15 43 30 44 Q45 43 46 30 Q44 38 38 39 Q30 41 22 39 Q16 38 14 30Z" fill="${c.hair}"/><path d="M26.5 35.6 Q30.5 37.8 34 34.8" stroke="#fff" stroke-width="1" fill="none" opacity=".6"/>` : ''}
      ${c.style === 'bun' ? `<path d="M24 1 L37 7" stroke="#D4AF37" stroke-width="1.4" stroke-linecap="round"/>` : ''}
    </g></svg>`;
}

/** k: chỉ số nhân vật; bust=true: chân dung (ảnh đại diện); emo: idle | excited | victory | shock */
export function charSVG(k, bust = false, emo = 'idle') {
  const idx = ((k % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
  const c = CHARACTERS[idx];
  // bản app: 4 nhân vật đầu là ảnh dựng từ mô hình 3D (app/skin/chars)
  const img = globalThis.__charImg?.[idx];
  if (img) return `<img class="chr chr3d${bust ? ' bust' : ''}" src="${img}" alt="" draggable="false">`;
  if (c.kind === 'suit') return bust ? portraitHTML(c, emo) : suitTokenSVG(c);
  return chibiSVG(c, bust);
}

// ======================= chớp mắt ngẫu nhiên =======================
let rigStarted = false;
export function startPortraitRig() {
  if (rigStarted || typeof document === 'undefined') return;
  rigStarted = true;
  // tải sẵn mọi trạng thái để đổi cảm xúc / chớp mắt không bị nháy trắng
  CHARACTERS.forEach((c) => { if (c.kind === 'suit') STATES.forEach((st) => { new Image().src = avatarSrc(c, st); }); });
  // mỗi chân dung có lịch riêng 2,5–5,5s; 20% chớp đôi (nhắm ~110ms)
  const next = new WeakMap();
  const blink = (el) => { el.classList.add('blink'); setTimeout(() => el.classList.remove('blink'), 120); };
  setInterval(() => {
    const now = performance.now();
    document.querySelectorAll('.pt').forEach((el) => {
      if (el.dataset.emo !== 'idle') return;
      const due = next.get(el);
      if (due == null) { next.set(el, now + 800 + Math.random() * 4000); return; }
      if (now < due) return;
      blink(el);
      if (Math.random() < 0.2) setTimeout(() => blink(el), 260);
      next.set(el, now + 2500 + Math.random() * 3000);
    });
  }, 60);
}
