// Nhân vật mặc định (vẽ bằng SVG, áo theo màu người chơi qua biến CSS --c).
// Muốn thêm nhân vật: thêm một mục vào CHARACTERS (và một kiểu tóc/mũ trong HAIR nếu cần).

export const CHARACTERS = [
  { name: 'Tí', skin: '#ffd9b8', hair: '#3a2a22', style: 'short' },
  { name: 'Mai', skin: '#ffe2c8', hair: '#5a3323', style: 'long' },
  { name: 'Bác Ba', skin: '#f2c79c', hair: '#2b2118', style: 'nonla' },
  { name: 'Na', skin: '#ffd9b8', hair: '#2b2118', style: 'buns' },
];

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

/** idx: thứ tự người chơi; bust=true: chỉ lấy phần đầu–vai (ảnh đại diện) */
export function charSVG(idx, bust = false) {
  const c = CHARACTERS[idx % CHARACTERS.length];
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
