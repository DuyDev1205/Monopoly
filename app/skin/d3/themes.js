// Bảng màu từng theme cho bản 3D. Thứ bậc tương phản (docs/redesign/PROMPT.md):
// nền xa (dịu) < bàn cờ & ô đất (sáng, trung tính) < công trình < quân cờ (tươi nhất).
// Bản sắc Việt: sơn mài, đèn lồng lụa Hội An, trống đồng — không dùng yếu tố Nhật/Trung.
export const THEMES = {
  sakura: {
    name: 'Mai anh đào',
    // bàn cờ
    slab: '#e9b7c9', slabSide: '#c86b8f', slabDark: '#8f3d5e', trim: '#b8406b', gold: '#e2ad45',
    plinth: '#a95f80', plinthDark: '#7a3d58', court: ['#f7e3e2', '#eccfd3'], motif: '#a8436b', courtInk: 0.3,
    tileSide: '#e3cfc6', paper: '#fffaf4', bulb: '#fff0f5', bulbOff: '#9c6a80',
    lantern: '#e0374d', lanternHi: '#ffb27a', post: '#6e3b3f', ink: '#2c1f28',
    // ánh sáng
    hemi: ['#fff6fb', '#c9b2d8', 2.0], key: ['#fff3e6', 1.55], fill: ['#d8d2ff', 0.55],
    // phông nền + mặt hồ (khớp app/tools/render_art.py)
    deep: '#6f6cc6', tint: '#f7efff', mist: '#ffe0e0', glint: '#fff3e4', petal: '#ffe0ea', petals: 0.34, sunU: 0.775,
    glintAmt: 1.0, waterMix: [0.10, 0.50], refl: '#ead8f2',
    fall: ['#ffd1e1', '#ffb3cb', '#ffe8f0'], fallN: 260,
  },
  wood: {
    name: 'Gỗ sơn mài',
    slab: '#7a2318', slabSide: '#9c2f22', slabDark: '#5e1a12', trim: '#1f1512', gold: '#e3b04b',
    plinth: '#4a2419', plinthDark: '#2e150e', court: ['#f1dcb2', '#e3c693'], motif: '#a06a22', courtInk: 0.26,
    tileSide: '#eedfc4', paper: '#fffaf0', bulb: '#ffe6a8', bulbOff: '#5a3a24',
    lantern: '#e9952b', lanternHi: '#ffe08a', post: '#2a1a14', ink: '#24160f',
    hemi: ['#fff4e2', '#b89272', 1.95], key: ['#ffecd2', 1.6], fill: ['#ffd9b0', 0.45],
    deep: '#5d4a86', tint: '#fff2e2', mist: '#ffe3b5', glint: '#fff1c4', petal: '#f7b455', petals: 0.28, sunU: 0.24,
    glintAmt: 1.2, waterMix: [0.10, 0.50], refl: '#f2d6b8',
    fall: ['#f5a742', '#e8742a', '#ffcf6a'], fallN: 150,
  },
  ocean: {
    name: 'Vịnh Hạ Long',
    slab: '#2f6f99', slabSide: '#3a7fa8', slabDark: '#215478', trim: '#f2c14e', gold: '#f2c14e',
    plinth: '#2c6489', plinthDark: '#1b425d', court: ['#d9eef0', '#bfe0e6'], motif: '#2a83ab', courtInk: 0.24,
    tileSide: '#ebe4d2', paper: '#fffdf6', bulb: '#fff6c8', bulbOff: '#26506e',
    lantern: '#f0a33a', lanternHi: '#fff0a0', post: '#1f3e57', ink: '#13283a',
    hemi: ['#f4fbff', '#8fbccc', 2.05], key: ['#fff8ea', 1.65], fill: ['#cfeaff', 0.55],
    deep: '#1193c2', tint: '#e8fbff', mist: '#e6fbff', glint: '#ffffff', petal: '#ffffff', petals: 0.0, sunU: 0.79,
    glintAmt: 1.3, waterMix: [0.22, 0.66], refl: '#d8f2ff',
    fall: [], fallN: 0,
  },
  midnight: {
    name: 'Phố đêm Hội An',
    slab: '#2b3268', slabSide: '#1d2350', slabDark: '#10143a', trim: '#8a72ff', gold: '#e9c46a',
    plinth: '#171c46', plinthDark: '#0b0e2a', court: ['#262d5e', '#20275a'], motif: '#e9c46a', courtInk: 0.30,
    tileSide: '#c9cbe6', paper: '#fbf8ff', bulb: '#ffd98c', bulbOff: '#2a2a58',
    lantern: '#ff5a3c', lanternHi: '#ffd27a', post: '#0f1230', ink: '#110f26',
    hemi: ['#b9bdf5', '#4a3f80', 1.55], key: ['#c9ccff', 1.05], fill: ['#7a68d8', 0.55],
    deep: '#0a0e30', tint: '#e0dbff', mist: '#7a63b3', glint: '#d9d6ff', petal: '#d6caff', petals: 0.10, sunU: 0.23,
    glintAmt: 0.9, waterMix: [0.14, 0.52], refl: '#9a8fe0',
    fall: ['#d6caff', '#ffffff', '#ffc9ec'], fallN: 110,
  },
};
export const themeOf = (k) => THEMES[k] || THEMES.sakura;
