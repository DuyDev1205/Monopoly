// Nhân vật (vẽ bằng SVG).
// - kind 'chibi': nhân vật tròn trịa, áo theo màu người chơi (biến CSS --c).
// - kind 'suit' : doanh nhân bán tả thực, chân dung dựng như rig nhiều lớp (thân, cổ, đầu, tóc sau/trước,
//                 chân mày, mắt/tròng mắt, mũi, miệng, viền sáng) — thở, chớp mắt, nhìn theo chuột, 4 cảm xúc.
// Muốn thêm nhân vật: thêm một mục vào CHARACTERS.

export const CHARACTERS = [
  { name: 'Tí', kind: 'chibi', skin: '#ffd9b8', hair: '#3a2a22', style: 'short' },
  { name: 'Mai', kind: 'chibi', skin: '#ffe2c8', hair: '#5a3323', style: 'long' },
  { name: 'Bác Ba', kind: 'chibi', skin: '#f2c79c', hair: '#2b2118', style: 'nonla' },
  { name: 'Na', kind: 'chibi', skin: '#ffd9b8', hair: '#2b2118', style: 'buns' },
  { name: 'Ông Trùm', kind: 'suit', sex: 'm', skin: '#F5CBA7', hair: '#2B1D16', hairHi: '#6a4a36', style: 'slick',
    suit: '#1F2D52', suitHi: '#3a5596', tie: '#A8102A', tieHi: '#e8485f', iris: '#5a3a22' },
  { name: 'Nữ Tổng', kind: 'suit', sex: 'f', skin: '#F8D5BC', hair: '#3A2418', hairHi: '#86553a', style: 'bob',
    suit: '#2E2E38', suitHi: '#5f5f76', tie: '#D4AF37', tieHi: '#ffe590', iris: '#4a3020', lips: '#C24D5F' },
  { name: 'Thiếu Gia', kind: 'suit', sex: 'm', skin: '#F2C6A0', hair: '#6B4423', hairHi: '#b07c45', style: 'wavy',
    suit: '#33343F', suitHi: '#5d5f72', tie: '#127A3E', tieHi: '#45d184', iris: '#2f5a3a' },
  { name: 'Bà Trùm', kind: 'suit', sex: 'f', skin: '#F5CBA7', hair: '#141019', hairHi: '#433a52', style: 'bun',
    suit: '#24345E', suitHi: '#4563a8', tie: '#8E1F3A', tieHi: '#d6506a', iris: '#2a1d14', lips: '#B03A4E' },
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
// Tóc chân dung (hệ toạ độ 120×120, mặt ở giữa x=60): [tóc sau, tóc trước]
const PT_HAIR = {
  slick: [
    'M35 48 C31 20 46 7 60 7 C75 7 89 20 85 48 C83 40 80 34 78 32 L42 32 C40 34 37 40 35 48Z',
    `<path d="M37 41 C38 21 50 12 62 12 C75 12 84 22 83 38 C79 28 71 22 60 22 C50 22 43 27 40 34 C39 36 38 38 37 41Z"/>
     <path d="M42 32 C46 24 54 20 63 20 C71 20 77 23 81 29 C75 25 69 24 62 24 C53 24 47 27 42 32Z" fill="#000" opacity=".18"/>`,
  ],
  bob: [
    'M30 50 C28 17 45 6 60 6 C75 6 92 17 90 50 L90 78 C90 85 83 87 79 82 L79 52 L41 52 L41 82 C37 87 30 85 30 78Z',
    `<path d="M36 46 C35 21 48 11 62 11 C77 11 86 23 84 44 C80 31 72 23 60 24 C54 25 47 29 44 34 C41 38 38 42 36 46Z"/>
     <path d="M36 46 C38 40 42 36 46 34 C42 40 40 46 40 54 C38 52 36 49 36 46Z"/>`,
  ],
  wavy: [
    'M35 48 C31 20 46 7 60 7 C75 7 89 20 85 48 C83 42 80 36 78 34 L42 34 C40 36 37 42 35 48Z',
    `<path d="M36 41 C35 20 49 9 62 10 C77 11 86 23 84 39 C81 33 77 31 73 33 C71 27 65 25 60 29 C56 25 49 27 47 33 C43 31 39 34 36 41Z"/>
     <path d="M47 33 C50 29 55 28 60 29 C56 31 52 33 49 37Z" fill="#000" opacity=".15"/>`,
  ],
  bun: [
    'M35 48 C31 20 46 8 60 8 C74 8 89 20 85 48 C83 40 80 34 78 32 L42 32 C40 34 37 40 35 48Z',
    `<path d="M37 43 C37 22 48 13 60 13 C72 13 83 22 83 43 C79 30 70 22 61 22 C61 22 60 21 59 22 C50 22 41 30 37 43Z"/>
     <path d="M59.5 13.5 C58.5 18 59 21 59.6 22.5" stroke="#000" stroke-width=".9" opacity=".25" fill="none"/>`,
  ],
};
const FACE_M = 'M38 40 C38 22 49 14 60 14 C71 14 82 22 82 40 L82 55 C82 65 78 73 72.5 79.5 C68.5 84 64.5 86.5 60 86.5 C55.5 86.5 51.5 84 47.5 79.5 C42 73 38 65 38 55Z';
const FACE_F = 'M39 41 C39 23 50 15 60 15 C70 15 81 23 81 41 L81 55 C81 66 76 75 69 81.5 C65.5 84.5 62.5 86 60 86 C57.5 86 54.5 84.5 51 81.5 C44 75 39 66 39 55Z';
const STAR = 'M0 -6 C.8 -1.6 1.6 -.8 6 0 C1.6 .8 .8 1.6 0 6 C-.8 1.6 -1.6 .8 -6 0 C-1.6 -.8 -.8 -1.6 0 -6Z';

let defsInstalled = false;
// Gradient / clip dùng chung, nằm trong 1 SVG 0×0 luôn được vẽ (không để trong vùng display:none)
export function installCharacterDefs() {
  if (defsInstalled || typeof document === 'undefined') return;
  defsInstalled = true;
  let d = `
    <linearGradient id="ptRim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF0C2"/><stop offset=".6" stop-color="#FFC25A"/><stop offset="1" stop-color="#FFB347" stop-opacity="0"/></linearGradient>
    <linearGradient id="ptGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF3B0"/><stop offset=".5" stop-color="#D4AF37"/><stop offset="1" stop-color="#8A6A12"/></linearGradient>
    <radialGradient id="ptSclera" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#E4DEE8"/></radialGradient>
    <radialGradient id="ptSweat" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#BFE2FF"/><stop offset="1" stop-color="#6AB0F2"/></radialGradient>
    <clipPath id="ptEyeL"><ellipse cx="51" cy="50" rx="5.4" ry="3.7"/></clipPath>
    <clipPath id="ptEyeR"><ellipse cx="69" cy="50" rx="5.4" ry="3.7"/></clipPath>`;
  CHARACTERS.forEach((c, k) => {
    if (c.kind !== 'suit') return;
    d += `
    <radialGradient id="ptSkin${k}" cx="44%" cy="36%" r="72%"><stop offset="0" stop-color="${mix(c.skin, '#ffffff', 0.38)}"/><stop offset=".55" stop-color="${c.skin}"/><stop offset="1" stop-color="#E59866"/></radialGradient>
    <linearGradient id="ptNeck${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(c.skin, '#7a4a6a', 0.45)}"/><stop offset=".45" stop-color="${mix(c.skin, '#E59866', 0.25)}"/><stop offset="1" stop-color="${c.skin}"/></linearGradient>
    <linearGradient id="ptHair${k}" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${c.hairHi}"/><stop offset=".45" stop-color="${c.hair}"/><stop offset="1" stop-color="${mix(c.hair, '#000000', 0.4)}"/></linearGradient>
    <linearGradient id="ptSuit${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.suitHi}"/><stop offset=".42" stop-color="${c.suit}"/><stop offset="1" stop-color="${mix(c.suit, '#000000', 0.4)}"/></linearGradient>
    <linearGradient id="ptTie${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.tieHi}"/><stop offset=".55" stop-color="${c.tie}"/><stop offset="1" stop-color="${mix(c.tie, '#000000', 0.35)}"/></linearGradient>
    <radialGradient id="ptIris${k}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${mix(c.iris, '#ffffff', 0.4)}"/><stop offset=".65" stop-color="${c.iris}"/><stop offset="1" stop-color="#120c0a"/></radialGradient>`;
  });
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('width', '0'); el.setAttribute('height', '0'); el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  el.innerHTML = `<defs>${d}</defs>`;
  document.body.appendChild(el);
}

function eye(cx, side, k, c) {
  const f = c.sex === 'f';
  const out = side === 'L' ? -1 : 1;   // phía đuôi mắt
  return `<g class="eye">
      <ellipse cx="${cx}" cy="50" rx="5.4" ry="3.7" fill="url(#ptSclera)"/>
      <g clip-path="url(#ptEye${side})"><g class="iris">
        <circle cx="${cx}" cy="50.3" r="3" fill="url(#ptIris${k})"/>
        <circle cx="${cx}" cy="50.3" r="1.35" fill="#0b0b10"/>
        <circle cx="${cx + 1.1}" cy="49.1" r=".95" fill="#fff"/><circle cx="${cx - 1}" cy="51.4" r=".45" fill="#fff" opacity=".75"/>
      </g></g>
      <rect class="lid" x="${cx - 6}" y="45.6" width="12" height="8.6" fill="${c.skin}"/>
      <path d="M${cx - 5.6} 49.6 C${cx - 4} 45.8 ${cx + 4} 45.8 ${cx + 5.6} 49.4" stroke="#2a1a14" stroke-width="${f ? 1.5 : 1.25}" fill="none" stroke-linecap="round"/>
      ${f ? `<path d="M${cx + out * 5.4} ${49.2} L${cx + out * 7.4} ${47.6}" stroke="#2a1a14" stroke-width="1.1" stroke-linecap="round"/>` : ''}
      <path d="M${cx - 4.4} 53 Q${cx} 54.6 ${cx + 4.4} 53" stroke="#b47a63" stroke-width=".6" fill="none" opacity=".6"/>
    </g>
    <path class="happy" d="M${cx - 5} 51 Q${cx} 45.8 ${cx + 5} 51" stroke="#2a1a14" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
}

function portraitSVG(c, k, emo) {
  const f = c.sex === 'f';
  const lip = f ? c.lips : '#9A4A3A';
  const [hb, hf] = PT_HAIR[c.style];
  const neckwear = f
    ? `<path d="M50.5 94 Q60 106 69.5 94" fill="none" stroke="#efe6d8" stroke-width="2.2" stroke-dasharray=".1 2.6" stroke-linecap="round"/>
       <path d="M60 101.5 l2.4 3.2 -2.4 3.4 -2.4 -3.4Z" fill="url(#ptGold)" stroke="#8a6a12" stroke-width=".5"/>`
    : `<path d="M56.8 99.6 L63.2 99.6 L62.3 104.2 L57.7 104.2Z" fill="url(#ptTie${k})"/>
       <path d="M57.7 104.2 L62.3 104.2 L64.6 116 L60 121 L55.4 116Z" fill="url(#ptTie${k})"/>
       <path d="M58.6 106 L61 113" stroke="#fff" stroke-width=".9" opacity=".3" stroke-linecap="round"/>
       <rect x="55.4" y="110" width="9.2" height="1.7" rx=".85" fill="url(#ptGold)"/>`;
  const rose = `<g transform="translate(47.4 104.5)">
       <path d="M-1 3 L-4 7.5" stroke="#2f6b35" stroke-width="1.1"/><path d="M-3 5.6 q-3 -.4 -3.8 1.6 q2.6 .6 3.8 -1.6Z" fill="#3f8a45"/>
       ${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="1.7" ry="2.5" transform="rotate(${a}) translate(0 -1.4)" fill="#E8577A"/>`).join('')}
       <circle r="1.6" fill="#B3264A"/><path d="M-.9 -.3 q.9 -.9 1.8 0" stroke="#ff9ab4" stroke-width=".5" fill="none"/></g>`;
  const mouths = {
    idle: f
      ? `<path d="M53.8 70.4 Q57 69 60 69.8 Q63 69 66.4 69.8 Q63.8 72.2 60 72.4 Q56.4 72.4 53.8 70.4Z" fill="${lip}"/><path d="M55.6 71.2 Q60 70.4 64.6 70.6" stroke="#7a2430" stroke-width=".55" fill="none"/><path d="M57.5 70 Q60 69.6 62 70" stroke="#fff" stroke-width=".5" opacity=".45" fill="none"/>`
      : `<path d="M53.6 71.6 Q59 73.2 64.4 70.4 Q65.8 69.6 66.6 68.4" stroke="${lip}" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M56 74.4 Q60 75.4 63.4 74.2" stroke="#c48466" stroke-width=".7" fill="none" opacity=".5"/>`,
    excited: `<path d="M54.5 69.4 Q60 67.8 65.5 69.4 Q63.6 76.8 60 76.8 Q56.4 76.8 54.5 69.4Z" fill="#6E2420" stroke="${lip}" stroke-width=".8"/><path d="M56.6 74.6 Q60 72.6 63.4 74.6 Q60 76.6 56.6 74.6Z" fill="#E0707A"/>`,
    victory: `<path d="M52.4 68.4 Q60 70.6 67.6 68.4 Q65.6 78.8 60 78.8 Q54.4 78.8 52.4 68.4Z" fill="#5E1A18" stroke="${lip}" stroke-width=".8"/><path d="M53.3 69 Q60 70.9 66.7 69 L66.1 71.3 Q60 72.8 53.9 71.3Z" fill="#fff"/><path d="M56.4 76.2 Q60 74 63.6 76.2 Q60 78.2 56.4 76.2Z" fill="#E0707A"/>`,
    shock: `<path d="M53 70.4 Q60 68.4 67 70.4 L66.4 74 Q60 75.8 53.6 74Z" fill="#fff" stroke="#6E2420" stroke-width="1.2" stroke-linejoin="round"/><path d="M56.2 69.9 V75 M60 69.3 V75.4 M63.8 69.9 V75" stroke="#c9b8b0" stroke-width=".7"/><path d="M53.6 72.2 H66.4" stroke="#c9b8b0" stroke-width=".6"/>`,
  };
  return `<svg class="chr pt" data-emo="${emo}" viewBox="4 -2 112 122" aria-hidden="true"><g class="rig">
    <g class="torso">
      <path d="M6 122 C8 104 22 95 40 92.5 L60 101 L80 92.5 C98 95 112 104 114 122Z" fill="url(#ptSuit${k})"/>
      <path d="M51.5 74 L51.5 95 Q60 99 68.5 95 L68.5 74Z" fill="url(#ptNeck${k})"/>
      <path d="M47 91.5 L60 113 L73 91.5 L67 89.8 L60 100.5 L53 89.8Z" fill="#F2F4F9"/>
      <path d="M53 89.8 L60 100.5 L56.4 102.2 L49.4 93.6Z" fill="#fff"/><path d="M67 89.8 L60 100.5 L63.6 102.2 L70.6 93.6Z" fill="#E1E6F0"/>
      ${neckwear}
      <path d="M40 92.5 L49.4 93.6 L58 112.5 L50 122 L42.4 106 L46 101Z" fill="${mix(c.suit, '#000000', 0.12)}"/>
      <path d="M80 92.5 L70.6 93.6 L62 112.5 L70 122 L77.6 106 L74 101Z" fill="${mix(c.suit, '#000000', 0.3)}"/>
      <path d="M49.4 93.6 L58 112.5" stroke="${c.suitHi}" stroke-width=".9" opacity=".8"/>
      <path d="M71 107.2 L77.4 106 L76.6 109.4 L71.8 110Z" fill="#fff"/>
      ${rose}
      <path d="M82 93.4 C96 95.6 108 103.5 111.5 119" stroke="url(#ptRim)" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".8"/>
      <path d="M38 93.6 C26 96 14 103 9 116" stroke="#AF7AC5" stroke-width="3" fill="none" opacity=".18" stroke-linecap="round"/>
    </g>
    <g class="head"><g class="tilt">
      <path d="${hb}" fill="url(#ptHair${k})"/>
      <ellipse cx="37.4" cy="53" rx="4" ry="7" fill="${mix(c.skin, '#E59866', 0.35)}"/><ellipse cx="82.6" cy="53" rx="4" ry="7" fill="${c.skin}"/>
      <path d="M36.5 50 q1.6 3 .4 6" stroke="#c48466" stroke-width=".7" fill="none"/>
      ${f ? '<circle cx="37.6" cy="60.5" r="1.5" fill="url(#ptGold)"/><circle cx="82.4" cy="60.5" r="1.5" fill="url(#ptGold)"/>' : ''}
      <path d="${f ? FACE_F : FACE_M}" fill="url(#ptSkin${k})"/>
      <path d="M38.5 44 C38.5 60 43 72 51 81 C44 78 39.5 68 39 56Z" fill="#AF7AC5" opacity=".2"/>
      ${f ? '' : '<path d="M40 58 C41 68 48 79 56 84.6 Q60 86.4 64 84.6 C72 79 79 68 80 58" stroke="#b9805f" stroke-width=".8" fill="none" opacity=".45"/>'}
      <ellipse cx="48.5" cy="62.5" rx="5" ry="2.8" fill="#E59866" opacity="${f ? 0.42 : 0.24}"/><ellipse cx="71.5" cy="62.5" rx="5" ry="2.8" fill="#E59866" opacity="${f ? 0.42 : 0.24}"/>
      <path d="M60.5 52 C60 57 58.4 60.5 57 62.6 Q59 64.6 62.4 63.2" stroke="#C48466" stroke-width="1.1" fill="none" stroke-linecap="round"/>
      <path d="M61.3 53 C61.6 57 61.8 59.5 61.6 61" stroke="#fff" stroke-width=".9" opacity=".45" fill="none" stroke-linecap="round"/>
      <path class="pale" d="M43 44 C44 35 51 30 60 30 C69 30 76 35 77 44 C70 40 50 40 43 44Z" fill="#7FA6E8"/>
      <g class="eyes">${eye(51, 'L', k, c)}${eye(69, 'R', k, c)}</g>
      <g class="brows">
        <path class="browL" d="M44.5 43 Q50 39.4 56 41.8" stroke="${mix(c.hair, '#000000', 0.15)}" stroke-width="${f ? 1.9 : 2.8}" fill="none" stroke-linecap="round"/>
        <path class="browR" d="M64 41.8 Q70 39.4 75.5 43" stroke="${mix(c.hair, '#000000', 0.15)}" stroke-width="${f ? 1.9 : 2.8}" fill="none" stroke-linecap="round"/>
      </g>
      <g class="mouth">${Object.entries(mouths).map(([e, m]) => `<g class="m-${e}">${m}</g>`).join('')}</g>
      <g class="hairF" fill="url(#ptHair${k})">${hf}</g>
      ${c.style === 'bun' ? `<circle cx="60" cy="7.5" r="9" fill="url(#ptHair${k})"/><path d="M53 4 L70 11" stroke="url(#ptGold)" stroke-width="1.8" stroke-linecap="round"/><circle cx="70" cy="11" r="1.6" fill="#E8577A"/>` : ''}
      <path d="M81.2 36 C83.2 50 81.4 64 74.6 77.4" stroke="url(#ptRim)" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".75"/>
      <path class="sweat" d="M80.5 31 C80.5 31 77 36 77 38.2 A3.5 3.5 0 0 0 84 38.2 C84 36 80.5 31 80.5 31Z" fill="url(#ptSweat)" stroke="#5a9be0" stroke-width=".6"/>
    </g></g>
    <g class="spk" fill="#FFE27A"><path d="${STAR}" transform="translate(18 26)"/><path d="${STAR}" transform="translate(102 18) scale(.8)"/><path d="${STAR}" transform="translate(104 70) scale(.65)"/></g>
  </g></svg>`;
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
      ${c.style === 'bun' ? `<path d="M24 1 L37 7" stroke="#D4AF37" stroke-width="1.4" stroke-linecap="round"/>` : ''}
    </g></svg>`;
}

/** k: chỉ số nhân vật; bust=true: chân dung (ảnh đại diện); emo: idle | excited | victory | shock */
export function charSVG(k, bust = false, emo = 'idle') {
  const idx = ((k % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
  const c = CHARACTERS[idx];
  if (c.kind === 'suit') { installCharacterDefs(); return bust ? portraitSVG(c, idx, emo) : suitTokenSVG(c); }
  return chibiSVG(c, bust);
}

// ======================= chớp mắt ngẫu nhiên + mắt nhìn theo chuột =======================
let rigStarted = false;
export function startPortraitRig() {
  if (rigStarted || typeof document === 'undefined') return;
  rigStarted = true;
  installCharacterDefs();
  // chớp mắt: mỗi chân dung có lịch riêng 2,5–5,5s; 20% chớp đôi (nhắm 70ms, giữ 40ms, mở 140ms)
  const next = new WeakMap();
  const blink = (el) => { el.classList.add('blink'); setTimeout(() => el.classList.remove('blink'), 110); };
  setInterval(() => {
    const now = performance.now();
    document.querySelectorAll('svg.pt').forEach((el) => {
      if (!el.isConnected || el.dataset.emo === 'victory') return;
      const due = next.get(el);
      if (due == null) { next.set(el, now + 800 + Math.random() * 4000); return; }
      if (now < due) return;
      blink(el);
      if (Math.random() < 0.2) setTimeout(() => blink(el), 260);
      next.set(el, now + 2500 + Math.random() * 3000);
    });
  }, 60);
  // mắt nhìn theo chuột (tối đa 2.2 đơn vị trong hệ toạ độ 120)
  let mx = null, my = null, raf = 0;
  const aim = () => {
    raf = 0;
    document.querySelectorAll('svg.pt').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      let gx = 0, gy = 0;
      if (mx != null) {
        const dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height * 0.42);
        const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260) * 2.2;
        gx = (dx / d) * k; gy = (dy / d) * k * 0.7;
      }
      el.style.setProperty('--gx', gx.toFixed(2)); el.style.setProperty('--gy', gy.toFixed(2));
    });
  };
  document.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(aim); }, { passive: true });
  setInterval(() => { if (!raf) raf = requestAnimationFrame(aim); }, 500);   // chân dung mới vẽ lại cũng nhìn đúng hướng
}
