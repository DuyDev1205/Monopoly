# Cờ Tỷ Phú Việt Nam 🏮

Game cờ tỷ phú chạy trên web, bàn cờ 3D, địa danh Việt Nam (Cà Mau, Cần Thơ, Đà Lạt, Hội An, Huế, Hạ Long, Hà Nội…).
Chơi với máy ngay trên trình duyệt, hoặc chơi online cùng bạn bè (2–4 người).

- **Chơi:** https://duydev1205.github.io/Monopoly/
- **Server online:** `wss://vlxd.tail24e2ba.ts.net:8443` (VPS `vlxd`, thư mục `~/_gitclone/monopoly`)

## Luật chơi

| Ô | Tác dụng |
|---|---|
| 🏁 Xuất Phát | Đi qua nhận lương 200tr |
| Thành phố | Mua đất và xây ngay 1–3 nhà. Quay lại đất mình thì xây thêm, đủ 3 nhà thì dựng **Công trình biểu tượng** 🏯 |
| Khu du lịch 🏝️ | Phú Quốc, Mũi Né, Phong Nha, Cát Bà: càng nhiều khu, tiền thuê càng cao |
| 🧧 Cơ Hội | Rút thẻ: lì xì Tết, xổ số, kẹt xe, viện phí… |
| 🌴 Đảo Hoang | Kẹt tối đa 3 lượt. Thoát bằng cách gieo đôi, trả 100tr hoặc dùng thẻ cứu hộ |
| 🎆 Lễ Hội | Chọn 1 đất của mình, tiền thuê ở đó ×2 |
| ✈️ Sân Bay | Lượt sau bay tới ô bất kỳ |
| 💸 Thuế | Nộp 10% giá trị đất và nhà |

- Đến đất người khác: trả tiền thuê, sau đó được **mua lại** với giá gấp đôi giá trị (trừ đất có Công trình biểu tượng).
- Gieo đôi được đi tiếp. Gieo đôi 3 lần liền thì bị dạt ra Đảo Hoang.
- Hết tiền phải bán đất cho ngân hàng (nhận 50% giá trị). Không còn gì để bán thì phá sản.
- **Chiến thắng:** độc quyền 3 vùng màu, chiếm trọn thành phố một cạnh bàn cờ, sở hữu cả 4 khu du lịch, là người cuối cùng còn trụ lại, hoặc giàu nhất khi hết số vòng đã đặt.

## Công nghệ

| Phần | Dùng | Lý do |
|---|---|---|
| Giao diện | HTML, CSS và JavaScript thuần (ES modules) | Không cần build, tổng dung lượng khoảng 60KB, tải tức thì trên GitHub Pages |
| 3D | CSS 3D transforms | Bàn cờ phối cảnh, xúc xắc lập phương, quân cờ đứng. Chạy bằng GPU, không cần thư viện nặng |
| Server | Node.js và [`ws`](https://github.com/websockets/ws) | WebSocket nhẹ, nhanh. Server giữ trạng thái ván để chống gian lận |
| Luật chơi | [`js/engine.js`](js/engine.js) | Dùng chung cho trình duyệt (chơi với máy) và server (chơi online) |

### Chơi online mượt

- Client chỉ gửi hành động (gieo, mua, xây…). Server xử lý luật rồi gửi trạng thái kèm danh sách sự kiện, mỗi máy tự chạy animation từ các sự kiện đó.
- Mất mạng thì tự kết nối lại; tải lại trang vẫn quay về đúng phòng.
- Người chơi rớt mạng quá 15 giây hoặc để quá 45 giây không đánh thì máy tự đánh thay, ván không bị treo.
- Có chat trong phòng, link mời và chia sẻ nhanh.

## Cấu trúc

```
index.html        trang game
css/style.css     giao diện + 3D
js/data.js        bàn cờ, thẻ Cơ Hội, bảng giá
js/engine.js      luật chơi (dùng chung client + server)
js/bot.js         máy chơi
js/app.js         giao diện, animation
js/net.js         kết nối WebSocket
js/config.js      địa chỉ server online
server/server.js  server phòng chơi online
```

## Chạy thử ở máy

```bash
cd server
npm install
npm start          # mở http://localhost:8387 (chơi được cả với máy và online)
```

## Deploy server lên VPS `vlxd`

```bash
ssh vlxd
cd ~/_gitclone && git clone https://github.com/DuyDev1205/Monopoly.git monopoly
cd monopoly/server && npm install --omit=dev
cp monopoly.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now monopoly
tailscale funnel --bg --https=8443 http://127.0.0.1:8387   # mở server ra Internet (HTTPS sẵn)
```

Cập nhật bản mới: `ssh vlxd 'bash ~/_gitclone/monopoly/server/deploy.sh'`

Đổi server khi chơi: thêm `?server=wss://ten-mien-khac` vào link game.
