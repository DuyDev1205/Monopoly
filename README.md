# Cờ Tỷ Phú Việt Nam 🏮

Game cờ tỷ phú chạy trên web, bàn cờ 3D, địa danh Việt Nam (Cà Mau, Cần Thơ, Đà Lạt, Hội An, Đà Nẵng, Hạ Long, Hà Nội…).
Chơi với máy ngay trên trình duyệt, hoặc chơi online cùng bạn bè (2–4 người). **Chỉ cần GitHub Pages, không cần server.**

👉 **Chơi:** https://duydev1205.github.io/Monopoly/

## Bản cài đặt (Windows / macOS)

👉 **Tải:** https://github.com/DuyDev1205/Monopoly/releases/latest — `.exe` cho Windows, `.dmg` cho macOS (chip M và Intel).

Bản app có đồ hoạ riêng, luật chơi và chơi online giống hệt bản web (chơi chung phòng với người dùng web được):

- Giao diện phong cách TDCaro, 4 bảng màu: Midnight Neon, Gỗ Cổ Điển, Đại Dương, Hoa Anh Đào.
- Bàn cờ 3D dựng trực tiếp bằng **Three.js**: nhân vật chibi, nhà phố, cây, xu vàng là mô hình [KayKit](https://kaylousberg.com) (CC0) có hoạt ảnh (đi, nhảy, reo hò, ngã); cây anh đào, dừa, chòi biển của [Polyfork](https://polyfork.dev) (CC BY 4.0, xem `app/skin/models/CREDITS.txt`). Camera bám quân cờ, pháo hoa khi lên khách sạn / độc quyền, 8 bộ xúc xắc.
- Chạy offline (trừ chơi online); tự báo khi có bản mới.

Mã nguồn bản app nằm trong [`app/`](app/): `app/skin/` (giao diện + 3D), `app/src-tauri/` (vỏ [Tauri](https://tauri.app)).
Phát hành: tăng `version` trong `app/package.json`, rồi đẩy tag `vX.Y.Z` — workflow [`release-app.yml`](.github/workflows/release-app.yml) tự build và đăng lên Releases.
Chạy thử trên máy: `cd app && npm i && npm run dev` (cần [Rust](https://rustup.rs)).

## Luật chơi

| Ô | Tác dụng |
|---|---|
| 🏁 Xuất Phát | Đi qua nhận lương 200tr |
| Thành phố | Mua đất và xây ngay nhà cấp 1–3. Quay lại đất mình để nâng cấp, từ cấp 3 lên **Khách sạn** 🏨 |
| Khu du lịch 🏝️ | Phú Quốc, Mũi Né, Phong Nha, Cát Bà: càng nhiều khu, tiền thuê càng cao |
| 🧧 Cơ Hội | Rút thẻ: lì xì Tết, xổ số, kẹt xe, viện phí… |
| 🌴 Đảo Hoang | Kẹt tối đa 3 lượt. Thoát bằng cách gieo đôi, trả 100tr hoặc dùng thẻ cứu hộ |
| 🎆 Lễ Hội | Chọn 1 đất của mình, tiền thuê ở đó ×2 |
| ✈️ Sân Bay | Lượt sau bay (vé 50tr) tới đất trống, đất của mình, Xuất Phát hoặc Lễ Hội |
| 💸 Thuế | Nộp 10% giá trị đất và nhà |
| 🎊 Festival | Đầu ván chọn ngẫu nhiên 3 ô đất/biển dựng cổng FESTIVAL, tiền thuê +50% tới hết ván |

- Đến đất người khác: trả tiền thuê, sau đó được **mua lại** với giá gấp đôi giá trị (trừ đất đã có Khách sạn).
- Gieo đôi được đi tiếp. Gieo đôi 3 lần liền thì bị dạt ra Đảo Hoang.
- Hết tiền phải bán đất cho ngân hàng (nhận 50% giá trị). Không còn gì để bán thì phá sản.
- **Độc quyền:** đủ một vùng màu thì mọi ô trong vùng được +50% tiền thuê.
- **Chiến thắng:** độc quyền 3 vùng màu, chiếm trọn thành phố một cạnh bàn cờ, sở hữu cả 4 khu du lịch, là người cuối cùng còn trụ lại, hoặc giàu nhất khi hết giờ (chọn 15–60 phút).

## Chơi online không cần server

Chơi được giữa máy tính và điện thoại, khác mạng (Wi-Fi, 4G) vẫn vào chung phòng.

- **Đường chính: nối thẳng** giữa các trình duyệt bằng WebRTC ([PeerJS](https://peerjs.com)). Độ trễ thấp nhất.
- **Đường dự phòng: chuyển tiếp qua MQTT broker công cộng** (EMQX, HiveMQ, Mosquitto, qua `wss://`) — tự bật khi sau 4 giây chưa nối thẳng được. Hay gặp khi điện thoại dùng 4G (NAT nhà mạng) hoặc router chặn kết nối trực tiếp. Nhãn mạng trong ván sẽ ghi `· chuyển tiếp`.
- **Chủ phòng** chạy luôn phần "server" trong trình duyệt của mình ([`js/room.js`](js/room.js)) và nghe cả 2 đường; khách có thể đi đường nào cũng được.
- Mất mạng thì tự kết nối lại; khách tải lại trang vẫn vào đúng phòng; chủ phòng tải lại trang thì phòng được khôi phục.
- Ai rớt mạng quá 15 giây hoặc để quá 45 giây không đánh thì máy tự đánh thay.

**Lưu ý:** chủ phòng phải giữ tab game mở trong lúc chơi. Đường dự phòng dùng broker công cộng nên tin nhắn ván chơi (không có thông tin cá nhân) đi qua máy chủ của bên thứ ba.

Thử riêng đường dự phòng: thêm `&relay=1` vào link mời.

## Công nghệ

| Phần | Dùng |
|---|---|
| Giao diện | HTML, CSS và JavaScript thuần (ES modules): không cần build, nhẹ, tải nhanh |
| 3D | CSS 3D transforms: bàn cờ isometric, xúc xắc lập phương, con tốt 3D, nhà và khách sạn dựng bằng khối 3D (tường, cửa sổ, mái màu chủ đất) có khói ống khói, đèn hiệu, cờ bay |
| Giao diện | 3 theme: 🌸 Hoa anh đào (mặc định), 🏮 Phố đèn lồng, 🌊 Vịnh Hạ Long; đổi ở trang chủ hoặc menu trong ván |
| Icon | [Fluent Emoji 3D](https://github.com/microsoft/fluentui-emoji) (Microsoft, giấy phép MIT), đã thu nhỏ thành WebP 96px |
| Online | WebRTC qua PeerJS |
| Nhân vật doanh nhân | [Avataaars](https://avataaars.com/) của Pablo Stanley (miễn phí cho cá nhân và thương mại), tạo bằng [DiceBear](https://www.dicebear.com/) |

## Cấu trúc

```
index.html        trang game
css/style.css     giao diện + 3D
assets/icons/     icon 3D (webp)
js/data.js        bàn cờ, thẻ Cơ Hội, bảng giá
js/engine.js      luật chơi
assets/logo.svg   logo (đồng xu TD); icon PNG cho iPhone/Android trong assets/
js/characters.js  8 nhân vật: 4 chibi + 4 doanh nhân (ảnh trong assets/chars, 5 trạng thái: thường, chớp mắt, hào hứng, chiến thắng, sốc)
js/music.js       nhạc nền: 6 bài CC0 (assets/music, ghi công trong CREDITS.txt) phát xáo trộn; dự phòng nhạc tổng hợp WebAudio
js/bot.js         máy chơi
js/room.js        phòng online (chạy ở máy chủ phòng)
js/net.js         kết nối online: nối thẳng WebRTC + tự chuyển đường dự phòng
js/relay.js       client MQTT tối giản cho đường dự phòng
js/app.js         giao diện, animation, mô hình nhà 3D
```

## Chạy thử ở máy

```bash
python -m http.server 8000     # rồi mở http://localhost:8000
```

Deploy: push lên nhánh `main`, GitHub Pages tự cập nhật.

## Bản app (Godot 4) — `godot/`

Bản cài Windows / macOS dựng bằng **Godot 4.7** (2D tranh vẽ): trời mây, hồ gương, đảo anh đào đung đưa, cánh hoa bay;
bàn cờ isometric. Luật chơi (`godot/scripts/rules.gd`) và máy chơi (`bot.gd`) chép từ `js/engine.js`, `js/bot.js`;
chơi online qua MQTT chung phòng với bản web (`godot/scripts/net.gd`).
Phát hành: đẩy tag `vX.Y.Z` → `.github/workflows/release-app.yml` xuất game, dựng bộ cài NSIS + .dmg, ký và tạo `latest.json`
(bản cũ tự cập nhật sang được).
