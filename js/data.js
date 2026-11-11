// Dữ liệu bàn cờ: 32 ô, địa danh Việt Nam. Đơn vị tiền: "tr" (triệu đồng).

export const START_MONEY = 2000;
export const SALARY = 200;
export const BAIL = 100;          // phí rời Đảo Hoang
export const ISLAND = 8;          // ô Đảo Hoang
export const FESTIVAL = 16;       // ô Lễ Hội
export const AIRPORT = 24;        // ô Sân Bay
export const AIRPORT_FEE = 50;   // vé máy bay khi bay từ Sân Bay
export const SELL_RATE = 0.5;     // bán cho ngân hàng được 50% giá trị
export const BUYOUT_RATE = 2;     // mua lại tài sản đối thủ: gấp 2 giá trị
export const SIZE = 32;
export const FEST_MAX = 5;        // lễ hội tổ chức lại cùng chỗ: ×2 → ×3 → … tối đa ×5

export const GROUPS = {
  brown:  { name: 'Miền Tây',          color: '#9a6240', house: 50 },
  sky:    { name: 'Nam Bộ',            color: '#4fb3e3', house: 50 },
  pink:   { name: 'Biển miền Trung',   color: '#d9539e', house: 100 },
  orange: { name: 'Tây Nguyên',        color: '#f08a24', house: 100 },
  red:    { name: 'Di sản',            color: '#e03b3b', house: 150 },
  yellow: { name: 'Đường thiên lý',    color: '#e8b512', house: 150 },
  green:  { name: 'Miền Bắc',          color: '#2f9e5b', house: 200 },
  navy:   { name: 'Đô thị',            color: '#2741a8', house: 200 },
};

// Hệ số giá thuê theo cấp: [đất trống, 1 nhà, 2 nhà, 3 nhà, công trình]
const RENT_MULT = [1, 5, 14, 30, 50];
const r5 = (x) => (x < 20 ? x : Math.round(x / 5) * 5);
function rents(price) {
  const base = Math.max(4, Math.round(price * 0.1));
  return RENT_MULT.map((m) => r5(base * m));
}

const C = (name, group, price, icon) => ({ type: 'city', name, group, price, rent: rents(price), icon });
const R = (name, icon) => ({ type: 'resort', name, price: 200, icon });
const chance = () => ({ type: 'chance', name: 'Cơ Hội', icon: '🧧' });

// Bố cục theo kiểu Business Tour: khu nghỉ dưỡng ven biển ở ô 4, 14, 18, 25; Cơ Hội giữa 3 cạnh; Thuế giữa 2 đô thị.
export const BOARD = [
  { type: 'start', name: 'Xuất Phát', icon: '🏁' },          // 0
  C('Cà Mau', 'brown', 60, '🦀'),
  C('Bạc Liêu', 'brown', 60, '🎻'),
  C('Cần Thơ', 'brown', 80, '🛶'),
  R('Phú Quốc', '🏝️'),                                        // 4: biển
  C('Vĩnh Long', 'sky', 100, '🍊'),
  C('Bình Phước', 'sky', 100, '🌳'),
  C('Vũng Tàu', 'sky', 120, '🏖️'),
  { type: 'island', name: 'Đảo Hoang', icon: '🌴' },         // 8
  C('Phan Thiết', 'pink', 140, '🐟'),
  C('Nha Trang', 'pink', 140, '🌊'),
  C('Quy Nhơn', 'pink', 160, '⛱️'),
  chance(),                                                  // 12
  C('Đà Lạt', 'orange', 180, '🌸'),
  R('Mũi Né', '🏜️'),                                          // 14: biển
  C('Buôn Ma Thuột', 'orange', 200, '☕'),
  { type: 'festival', name: 'Lễ Hội', icon: '🎆' },          // 16
  C('Hội An', 'red', 220, '🏮'),
  R('Côn Đảo', '🐢'),                                         // 18: biển
  C('Huế', 'red', 240, '🏛️'),
  chance(),                                                  // 20
  C('Đà Nẵng', 'yellow', 260, '🐉'),
  C('Vinh', 'yellow', 260, '🌾'),
  C('Ninh Bình', 'yellow', 280, '⛰️'),
  { type: 'airport', name: 'Sân Bay', icon: '✈️' },          // 24
  R('Cát Bà', '🐒'),                                          // 25: biển
  C('Sa Pa', 'green', 300, '🏔️'),
  C('Hạ Long', 'green', 320, '🛳️'),
  chance(),                                                  // 28
  C('TP. Hồ Chí Minh', 'navy', 360, '🏙️'),
  { type: 'tax', name: 'Thuế', icon: '💸' },                 // 30
  C('Hà Nội', 'navy', 400, '🐢'),
];

// Thuê khu du lịch theo số khu đang sở hữu
export const RESORT_RENT = [0, 50, 100, 200, 400];
// Thuế: % tổng giá trị tài sản (đất + nhà)
export const TAX_RATE = 0.1;
export const TAX_MIN = 50;

export const GROUP_TILES = {};
BOARD.forEach((t, i) => { if (t.type === 'city') (GROUP_TILES[t.group] ||= []).push(i); });
export const RESORTS = BOARD.map((t, i) => (t.type === 'resort' ? i : -1)).filter((i) => i >= 0);
// Thành phố trên từng cạnh bàn cờ
export const SIDES = [0, 1, 2, 3].map((s) => {
  const out = [];
  for (let i = s * 8 + 1; i < s * 8 + 8; i++) if (BOARD[i].type === 'city') out.push(i);
  return out;
});

// Chi phí xây cấp `lvl` (1..3 nhà, 4 = công trình) cho thành phố
export function levelCost(tile, lvl) {
  const h = GROUPS[tile.group].house;
  return lvl === 4 ? h * 3 : h;
}

// Thẻ Cơ Hội. kind: money | move | moveBy | island | freeCard | repairs | payEach | collectEach | nearestResort | festival | travel
export const CARDS = [
  { text: 'Về thẳng Xuất Phát, nhận lương 200tr.', kind: 'move', to: 0 },
  { text: 'Bay ra Hà Nội dự hội nghị. Qua Xuất Phát được nhận lương.', kind: 'move', to: 31 },
  { text: 'Du lịch phố cổ Hội An. Qua Xuất Phát được nhận lương.', kind: 'move', to: 17 },
  { text: 'Ra Sân Bay — lượt sau được bay tới ô bất kỳ.', kind: 'move', to: AIRPORT },
  { text: 'Đi tới Lễ Hội. Qua Xuất Phát được nhận lương.', kind: 'move', to: FESTIVAL },
  { text: 'Tổ chức Lễ Hội ngay tại một thành phố của bạn.', kind: 'hostFest' },
  { text: 'Phá nhà! Chọn một nhà của đối thủ để phá bỏ (không áp dụng với khách sạn).', kind: 'demolish' },
  { text: 'Đốt nhà! Chọn một nhà của đối thủ, nhà bị giảm 1 cấp (không áp dụng với khách sạn).', kind: 'burn' },
  { text: 'Đi nghỉ ở khu du lịch gần nhất.', kind: 'nearestResort' },
  { text: 'Kẹt xe, lùi lại 3 ô.', kind: 'moveBy', n: -3 },
  { text: 'Lạc đường ra Đảo Hoang! Không qua Xuất Phát.', kind: 'island' },
  { text: 'Thẻ cứu hộ: rời Đảo Hoang miễn phí (giữ lại dùng sau).', kind: 'freeCard' },
  { text: 'Trúng xổ số kiến thiết, nhận 150tr.', kind: 'money', amount: 150 },
  { text: 'Thưởng Tết cuối năm, nhận 100tr.', kind: 'money', amount: 100 },
  { text: 'Được mùa sầu riêng, nhận 100tr.', kind: 'money', amount: 100 },
  { text: 'Ngân hàng trả cổ tức, nhận 50tr.', kind: 'money', amount: 50 },
  { text: 'Lì xì Tết! Mỗi người mừng tuổi bạn 20tr.', kind: 'collectEach', amount: 20 },
  { text: 'Được bầu làm trưởng thôn, khao mỗi người 30tr.', kind: 'payEach', amount: 30 },
  { text: 'Chạy quá tốc độ trên cao tốc, phạt 30tr.', kind: 'money', amount: -30 },
  { text: 'Đóng viện phí, trả 100tr.', kind: 'money', amount: -100 },
  { text: 'Đóng học phí cho con, trả 50tr.', kind: 'money', amount: -50 },
  { text: 'Ủng hộ đồng bào vùng lũ, trả 60tr.', kind: 'money', amount: -60 },
  { text: 'Sửa sang nhà cửa: 20tr mỗi nhà, 80tr mỗi khách sạn.', kind: 'repairs', house: 20, landmark: 80 },
];

export const PLAYER_COLORS = ['#e5383b', '#2f6fde', '#2a9d5c', '#f2a516'];
export const PLAYER_TOKENS = ['🛵', '🐃', '🚤', '🐓'];
export const WIN_LABEL = {
  last: 'Người trụ lại cuối cùng',
  groups: 'Độc quyền 3 vùng',
  side: 'Độc chiếm một cạnh bàn cờ',
  resorts: 'Độc quyền 4 khu du lịch',
  time: 'Giàu nhất khi hết giờ',
};

// Ảnh icon 3D (Fluent Emoji 3D của Microsoft, giấy phép MIT) — assets/icons/<tên>.webp
export const ICONS = {
  '🏁': 'start', '🦀': 'crab', '🎻': 'violin', '🧧': 'envelope', '🛶': 'canoe', '🏝️': 'island', '🍊': 'tangerine',
  '🥥': 'coconut', '🌴': 'palm', '🏖️': 'beach', '🐟': 'fish', '🌊': 'wave', '🏜️': 'desert', '🌸': 'blossom',
  '☕': 'coffee', '🎆': 'fireworks', '⛱️': 'umbrella', '🏮': 'lantern', '🦇': 'bat', '🏛️': 'classical', '🐉': 'dragon',
  '🌾': 'rice', '✈️': 'airplane', '⛰️': 'mountain', '🏔️': 'snowmountain', '🛳️': 'ship', '🐒': 'monkey', '💸': 'money',
  '🏙️': 'city', '🐢': 'turtle', '🛵': 'scooter', '🐃': 'buffalo', '🚤': 'speedboat', '🐓': 'rooster', '🛟': 'buoy',
  '🌳': 'tree', '🏆': 'trophy', '🎲': 'die', '💥': 'boom', '🔥': 'fire',
};
