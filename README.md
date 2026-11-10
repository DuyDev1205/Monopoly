# Cờ Tỷ Phú Việt Nam 🏮

Game cờ tỷ phú chạy trên web, bàn cờ 3D, địa danh Việt Nam (Cà Mau, Cần Thơ, Đà Lạt, Hội An, Đà Nẵng, Hạ Long, Hà Nội…).
Chơi với máy ngay trên trình duyệt, hoặc chơi online cùng bạn bè (2–4 người). **Chỉ cần GitHub Pages, không cần server.**

👉 **Chơi:** https://duydev1205.github.io/Monopoly/

## Luật chơi

| Ô | Tác dụng |
|---|---|
| 🏁 Xuất Phát | Đi qua nhận lương 200tr |
| Thành phố | Mua đất và xây ngay nhà cấp 1–3. Quay lại đất mình để nâng cấp, từ cấp 3 lên **Khách sạn** 🏨 |
| Khu du lịch 🏝️ | Phú Quốc, Mũi Né, Phong Nha, Cát Bà: càng nhiều khu, tiền thuê càng cao |
| 🧧 Cơ Hội | Rút thẻ: lì xì Tết, xổ số, kẹt xe, viện phí… |
| 🌴 Đảo Hoang | Kẹt tối đa 3 lượt. Thoát bằng cách gieo đôi, trả 100tr hoặc dùng thẻ cứu hộ |
| 🎆 Lễ Hội | Chọn 1 đất của mình, tiền thuê ở đó ×2 |
| ✈️ Sân Bay | Lượt sau bay tới ô bất kỳ |
| 💸 Thuế | Nộp 10% giá trị đất và nhà |

- Đến đất người khác: trả tiền thuê, sau đó được **mua lại** với giá gấp đôi giá trị (trừ đất đã có Khách sạn).
- Gieo đôi được đi tiếp. Gieo đôi 3 lần liền thì bị dạt ra Đảo Hoang.
- Hết tiền phải bán đất cho ngân hàng (nhận 50% giá trị). Không còn gì để bán thì phá sản.
- **Chiến thắng:** độc quyền 3 vùng màu, chiếm trọn thành phố một cạnh bàn cờ, sở hữu cả 4 khu du lịch, là người cuối cùng còn trụ lại, hoặc giàu nhất khi hết giờ (chọn 15–60 phút).

## Chơi online không cần server

Online dùng **WebRTC** (thư viện [PeerJS](https://peerjs.com), chỉ tải khi bấm chơi online):

- **Chủ phòng** chạy luôn phần "server" trong trình duyệt của mình ([`js/room.js`](js/room.js)), dùng cùng file luật [`js/engine.js`](js/engine.js) với chế độ chơi với máy.
- **Khách** nhập mã phòng 4 ký tự (hoặc bấm link mời), rồi nối thẳng tới máy chủ phòng. Độ trễ thấp vì không qua server trung gian.
- Máy chủ PeerJS miễn phí chỉ dùng để hai bên tìm thấy nhau lúc đầu; dữ liệu ván chơi đi thẳng giữa các máy.
- Mất mạng thì tự kết nối lại. Khách tải lại trang vẫn vào đúng phòng. Chủ phòng tải lại trang thì phòng được khôi phục từ bản lưu.
- Ai rớt mạng quá 15 giây hoặc để quá 45 giây không đánh thì máy tự đánh thay, ván không bị treo.

**Lưu ý:** chủ phòng phải giữ tab game mở trong lúc chơi. Một số mạng 4G hoặc mạng công ty chặn kết nối P2P trực tiếp; khi đó nên đổi sang wifi khác.

## Công nghệ

| Phần | Dùng |
|---|---|
| Giao diện | HTML, CSS và JavaScript thuần (ES modules): không cần build, nhẹ, tải nhanh |
| 3D | CSS 3D transforms: bàn cờ isometric, xúc xắc lập phương, con tốt 3D, nhà và khách sạn dựng bằng khối 3D (tường, cửa sổ, mái màu chủ đất) có khói ống khói, đèn hiệu, cờ bay |
| Giao diện | 2 theme: 🌸 Hoa anh đào (mặc định) và 🏮 Phố đèn lồng; đổi ở trang chủ hoặc menu trong ván |
| Icon | [Fluent Emoji 3D](https://github.com/microsoft/fluentui-emoji) (Microsoft, giấy phép MIT), đã thu nhỏ thành WebP 96px |
| Online | WebRTC qua PeerJS |

## Cấu trúc

```
index.html        trang game
css/style.css     giao diện + 3D
assets/icons/     icon 3D (webp)
js/data.js        bàn cờ, thẻ Cơ Hội, bảng giá
js/engine.js      luật chơi
js/bot.js         máy chơi
js/room.js        phòng online (chạy ở máy chủ phòng)
js/net.js         kết nối WebRTC (chủ phòng / khách)
js/app.js         giao diện, animation, mô hình nhà 3D
```

## Chạy thử ở máy

```bash
python -m http.server 8000     # rồi mở http://localhost:8000
```

Deploy: push lên nhánh `main`, GitHub Pages tự cập nhật.
