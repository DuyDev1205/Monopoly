# PROMPT — Thiết kế lại NHÂN VẬT & BÀN CỜ cho "Cờ Tỷ Phú Việt Nam" (bản app Godot)

> Cách dùng: mở repo `Monopoly/` trong Claude Code / Antigravity rồi nói:
> **"Đọc `docs/redesign/PROMPT.md` và làm theo, bắt đầu từ Bước 0."**
> Trả lời tôi bằng tiếng Việt.

---

## 0. Vai trò và mục tiêu

Bạn đóng vai **art director kiêm technical artist** cho một game cờ tỷ phú 2D isometric làm bằng **Godot 4.7**.

Nhiệm vụ: làm lại toàn bộ phần nhìn của **12 quân cờ nhân vật**, **công trình** (nhà cấp 1–3, khách sạn, khu du lịch) và **bàn cờ** (ô đất, 4 ô góc, sân giữa, bệ, đèn, cổng lễ hội). Mục tiêu là game trông như **một sản phẩm thương mại hoàn chỉnh, chỉ một phong cách, đọc rõ ở kích thước thật trên màn hình**.

- Tôi **không biết vẽ**. Bạn phải tự tạo asset (dựng 3D bằng script Blender/Godot, hoặc lấy asset CC0 rồi chỉnh lại), tự render, tự ghép vào game, tự chụp màn hình để kiểm tra.
- **Không đụng luật chơi, dữ liệu bàn cờ, giao thức online.**
- Mọi quyết định thẩm mỹ phải kiểm chứng bằng **ảnh chụp trong game ở 1600×900**, không chỉ nhìn ảnh render riêng lẻ.

---

## 1. Hiện trạng dự án (đọc kỹ trước khi làm)

| Phần | File | Ghi chú |
|---|---|---|
| Cấu hình | `godot/project.godot` | Cửa sổ thiết kế 1600×900, `stretch=canvas_items`, MSAA 2D/3D = 2 |
| Phép chiếu | `godot/scripts2d/iso.gd` | `A=64, B=37, HS=48`; Xuất Phát ở đáy hình thoi, Lễ Hội ở đỉnh |
| Vẽ bàn cờ | `godot/scripts2d/board2d.gd` | Bệ 2 tầng giữa hồ, 32 ô bo góc, sân giữa, đèn 4 góc; màu theme trong `STYLE`, `TILE_BG`; tiểu cảnh góc `CORNER_TEX`; sân `COURT_TEX` |
| Quân cờ + công trình | `godot/scripts2d/pieces2d.gd` | Quân cờ là **3D thời gian thực trong SubViewport 256×256** (`TOKEN_SC=0.72`, `TOKEN_CAM_SIZE=1.92`, `SLOTS`, `CORNER_SLOTS`). Công trình đọc từ sprite sheet `assets/build2d/houses.png` (ô 300×375, 8 cột, `BANCHOR`, `BSCALE`, `BHEIGHT`). Cổng lễ hội `props2d/torii*.png`, kho báu `props2d/pile_*.png`, hoà màu `GRADE` theo theme |
| Nạp nhân vật | `godot/scripts/token_models.gd` | Nạp `assets/models/bt_chars/c{0..11}.glb`; map hoạt ảnh theo tên có chứa `idle, walk, jump, cheer, hit, die`; **chuẩn hoá chiều cao bằng mesh tên chứa `H_DDS`** (riêng của bộ VALID avatars → phải sửa khi đổi mô hình); đế `plinth()` |
| Dữ liệu | `godot/scripts/data.gd` | 32 ô, 8 nhóm màu, 4 khu du lịch, `PLAYER_COLORS = [#e5383b, #2f6fde, #2a9d5c, #f2a516]` |
| Pipeline nhân vật | `godot/tools/blender_build_chars.py` | Blender 4.2 (`D:\Blender\blender-4.2.3-windows-x64\blender.exe`): VALID avatars + Mixamo, render chân dung Cycles |
| Pipeline chụp 2D | `godot/tools/render_chars.gd`, `render_builds.gd`, `render_props.gd`, `fix_chars.py` | Godot chụp mô hình 3D thành PNG đúng góc Iso; `fix_chars.py` xử lý alpha |
| Vân bề mặt | `godot/tools/render_board.py` | Pillow vẽ `board2d/court_<theme>.png`, `side.png`, `plinth.png`, `paper.png` |
| Ảnh UI | `godot/assets/ui/chars/c{k}.webp` (320×320 toàn thân), `av{k}.webp` (256×256 cận mặt, hiện ~52px trong HUD qua `UiKit.avatar`) | |
| Mô phỏng | `godot/tools/sim.gd` | Chạy nhiều ván tự động để bắt lỗi |

**Hợp đồng sprite sheet công trình** (`render_builds.gd` ↔ `pieces2d.gd`): thứ tự `MODELS` gồm 13 mô hình. Ô thứ `mô_hình × 4 + màu_người_chơi`.

```
0  resort
1–4   city cấp 1 (4 kiểu)
5–8   city cấp 2 (4 kiểu)
9–10  city cấp 3 (2 kiểu)
11–12 city cấp 4 = khách sạn (2 kiểu)
```

**⚠️ Working tree đang có thay đổi CHƯA COMMIT** (đang chuyển từ KayKit/Polyfork sang `bt_chars`/`bt_city`: ~280 file xoá, ~50 file sửa, thư mục mới `assets/board2d/`, `assets/props2d/`, `assets/models/bt_*`). Xem Bước 0 trước khi đụng vào bất cứ thứ gì.

---

## 2. Vì sao hiện tại chưa đẹp (chẩn đoán cụ thể)

### 2.1 Nhân vật
1. **Tỉ lệ người thật (~7 đầu).** Quân cờ trên bàn cao khoảng **100px** (ước theo `1.06 m × 256/1.92 × 0.72`), nên **mặt chỉ còn ~13px**. Người chơi không thấy biểu cảm, chỉ thấy một que dọc mảnh.
2. **Mặt và da gần như ảnh quét** (VALID avatars, PBR, normal map) nên bị "uncanny". Phong cách này lệch hẳn với nền trời pastel vẽ tay và nhà low-poly màu kẹo. Hiện có **3 phong cách đánh nhau** trên cùng một màn hình.
3. **Dáng A-pose** đứng thẳng, tay buông, không có tính cách. Phụ kiện nhỏ và lơ lửng (vương miện c2 nổi trên đầu), đạo cụ cầm tay chỉ vài pixel.
4. **12 nhân vật khó phân biệt**: 5 người mặc vest tối màu, bảng màu trầm, bóng dáng (silhouette) gần như giống nhau.
5. **c0 đội mũ chóp + mặc vest** gợi nhớ linh vật Monopoly của Hasbro. Cần tránh.
6. Chân dung `av*.webp` cận mặt kiểu ảnh chụp, thu xuống 52px trong HUD thì mờ và vô hồn.
7. Comment đầu `pieces2d.gd` vẫn ghi "12 nhân vật chibi" trong khi mô hình là người thật, tức code và tài liệu đang lệch nhau.

### 2.2 Công trình
1. **Kiến trúc nhà Âu/Mỹ** (mái đầu hồi, townhouse, toà văn phòng) trong một game toàn địa danh Việt Nam.
2. **Màu người chơi phủ cả tường lẫn mái** nên nhìn như nhựa, chói, có dải gradient; các cấp trông cùng một họ. Khách sạn chỉ là toà nhà to hơn có cái chuông trên nóc.
3. **Khu du lịch** là du thuyền + cây dừa trên tấm nền xanh, khó hiểu là gì.

### 2.3 Bàn cờ
1. **Sân giữa caro 8×8 hồng–trắng** trông như gạch nhà tắm; huy hiệu hoa đa giác thô, không có chiều sâu.
2. **Yếu tố Nhật Bản**: cổng torii (cổng lễ hội), đèn andon, các mô hình chùa/machiya/kura. Lạc đề với một game "Việt Nam".
3. **Đạo cụ góc** (rương cam, cờ caro tím, cột cam) màu đồ chơi chói, khác chất liệu với phần còn lại.
4. **Không có thứ bậc tương phản**: nền, mặt bàn, nhà, quân cờ cùng độ sáng và độ tươi, nên mắt không biết nhìn vào đâu.

---

## 3. Hướng mỹ thuật mới: chỉ MỘT phong cách

### "Diorama đồ chơi Việt Nam"
Hình dung một **bộ cờ bàn cao cấp bằng nhựa sơn tay / gỗ sơn mài** đặt trên bàn, nhìn chéo isometric: khối mềm bo tròn, màu ấm, bóng đổ mềm, **toon/cel-shading 3 bậc + viền tối mảnh**.

Chỉ tham khảo cảm giác, **không sao chép asset**: Monopoly GO, Animal Crossing: New Horizons, Overcooked, Townscaper, Cờ Tỷ Phú ZingPlay.

### Quy tắc chung (áp dụng cho MỌI asset)
- **Ánh sáng thống nhất:** 1 đèn chính từ **trên–trái–phía sau camera**, ánh nắng ấm (≈ `#fff1dc`), ambient mát (≈ `#c9d6ff`). Bóng ngả về phải–dưới. Mọi lần render (nhân vật, nhà, đạo cụ, chân dung) dùng **cùng một setup đèn và cùng một shader**. Viết setup này thành 1 hàm/scene dùng chung.
- **Shader toon chung:** 3 bậc sáng/trung/tối với ranh giới mềm, rim light nhẹ ở viền đối diện đèn, **viền inverted-hull** màu tối ngả theo màu vật thể (không đen tuyền). Viền dày ~2px ở kích thước trong game. Đặt ở `godot/scripts/toon.gdshader` (hoặc tương đương) và dùng chung cho quân cờ realtime và mọi bộ chụp `tools/render_*.gd`.
- **Thứ bậc tương phản (quan trọng nhất):**
  `Nền trời/hồ` (tương phản thấp, ít tươi) **<** `Mặt bàn & ô đất` (sáng, trung tính, ít chi tiết) **<** `Công trình` (vừa) **<** `Quân cờ` (tương phản cao nhất, viền rõ, màu tươi nhất).
- **Hình khối:** bo góc, phóng đại tỉ lệ, **chi tiết to và ít**. Không texture ảnh chụp, không normal map vi chi tiết. Dùng màu phẳng hoặc gradient nhẹ + AO nướng sẵn.
- **Văn hoá Việt Nam:** mái ngói âm dương, tường vàng Hội An, hoa giấy, đèn lồng lụa Hội An, nón lá, khăn rằn, hoa sen, mai/đào Tết, hoạ tiết trống đồng Đông Sơn, cổng tam quan / cổng làng, thuyền thúng. **Không dùng yếu tố Nhật/Trung** (torii, andon, machiya, chùa Nhật, chữ Hán).
- **Không vẽ bản đồ Việt Nam** ở bất cứ đâu (dễ thiếu Hoàng Sa/Trường Sa → nhạy cảm).

---

## 4. Nhân vật: 12 quân cờ

### 4.1 Tỉ lệ và hình khối
- **Chibi 2.5–3 đầu.** Đầu chiếm **38–42%** chiều cao. Thân tròn ngắn, tay dạng găng (không cần ngón rõ), chân ngắn, giày to để dáng đứng chắc.
- **Mặt:** mắt to đơn giản (oval tối + 1–2 đốm sáng), lông mày dày biểu cảm, miệng là đường cong, má hồng. Vẽ bằng texture/decal phẳng, **không dùng da quét**. Nếu được, thêm shape key/texture swap để **chớp mắt** trong idle.
- Mỗi nhân vật có **1 silhouette riêng** (mũ / tóc / đạo cụ to) và **1 màu chủ đạo riêng**. Đạo cụ phóng to ≥ 1/3 chiều cao đầu để nhìn thấy ở 100px.
- **Dáng nghỉ có tính cách** (chống nạnh, ôm đạo cụ, nghiêng đầu…). Không A-pose.
- **Bài test silhouette:** tô đen 12 nhân vật đặt cạnh nhau, phải phân biệt được từng người.

### 4.2 Danh sách. Giữ nguyên **id** và **tên** (id được gửi qua mạng, chơi chéo với bản web)

| id | Tên | Ý tưởng | Màu chủ đạo | Nhận diện (silhouette + đạo cụ) |
|---|---|---|---|---|
| c0 | Chủ Tịch Tập Đoàn | ông chủ trung niên bụng tròn, vui tính | xanh navy `#23407a`, cà vạt đỏ | tóc chải ngược bóng, kính gọng vàng, **cặp da to**. KHÔNG mũ chóp, KHÔNG ria trắng |
| c1 | Nữ Tổng Tài | nữ CEO sắc sảo | đỏ đô `#b3263e` | **tóc búi cao**, kính mắt mèo, máy tính bảng ôm ngang ngực |
| c2 | Ông Hoàng Tài Phiệt | đại gia "hoàng gia" hài hước | tím `#6b3fa0` + vàng | **vương miện nhỏ gắn chặt đầu**, áo choàng viền lông trắng, quyền trượng ngắn, nhẫn to |
| c3 | Tiểu Thư Thượng Lưu | tiểu thư mặc áo dài | xanh ngọc `#1a9e8f` | **áo dài** tà bay, tóc dài kẹp nơ, quạt xếp |
| c4 | Đại Gia Nghỉ Dưỡng | khách VIP ở resort | cam san hô `#f07b4f` | **áo sơ mi hoa**, kính phi công, **trái dừa có ống hút** |
| c5 | Cảnh Sát Trưởng | sếp trật tự hiền khô | xanh ô-liu `#4f6b3a` | **mũ kê-pi to**, còi, gậy chỉ huy. Không dùng phù hiệu thật |
| c6 | Kỹ Sư Địa Ốc | kỹ sư công trình | vàng `#f2b400` + cam phản quang | **mũ bảo hộ**, áo phản quang, cuộn bản vẽ kẹp nách |
| c7 | Founder Khởi Nghiệp | dân startup | hoodie xám `#8c9aae` + xanh chanh `#a6d33a` | **hoodie trùm**, tai nghe chụp, laptop, **ly cà phê sữa đá** |
| c8 | Nữ Vlogger Du Lịch | travel vlogger | hồng `#e85d9a` | mũ bucket, **gậy selfie + điện thoại**, balo nhỏ |
| c9 | Địa Chủ Miền Tây | điền chủ Nam Bộ chất phác | nâu đất `#8a5a2b` + khăn rằn | **nón lá**, áo bà ba, khăn rằn quàng cổ, ôm buồng dừa |
| c10 | Tay Chơi Phố Wall | tay chơi tài chính | đen sọc `#2a2d34` + vàng `#d4a537` | **tóc vuốt keo dựng**, dây đeo quần, điện thoại + xấp tiền |
| c11 | Tỷ Phú Vũ Trụ | tỷ phú mê vũ trụ | trắng + cam `#f26b1d` | **bộ phi hành gia**, mũ kính tròn, ba lô phản lực nhỏ |

**Đế quân cờ:** đế tròn dày, mặt trên trung tính, **vòng viền mang màu người chơi** (`PLAYER_COLORS`) để biết ngay quân của ai, kể cả khi hai người chọn nhân vật cùng tông màu. Thêm mũi tên/vầng sáng chỉ lượt như hiện có.

### 4.3 Hoạt ảnh (bắt buộc; tên clip phải **chứa đúng** các từ dưới)

| Clip | Thời lượng | Mô tả |
|---|---|---|
| `idle` | loop 1.6–2.2s | thở, nhún nhẹ, đung đưa đạo cụ, chớp mắt |
| `walk` | loop | bước nảy kiểu đồ chơi (cả người bật lên mỗi bước) |
| `jump` | ~0.6s | khuỵu → bật → tiếp đất nhún |
| `cheer` | ~1.2s | giơ tay/đạo cụ, nhảy mừng |
| `hit` | ~0.8s | giật mình, ngả ra sau, (tuỳ chọn) giọt mồ hôi |
| `die` | ~1.2s | ngã ngồi choáng, đầu lắc |

- Retarget Mixamo thường **hỏng với tỉ lệ chibi** (tay đâm vào đầu to). Ưu tiên: rig đơn giản (≤ 20 xương) + **keyframe bằng Blender Python**, hoặc dùng rig/anim có sẵn của gói CC0 chibi.
- `TokenModels.animate()` đang tự xoay 360° khi `cheer`. Giữ hoặc bỏ tuỳ clip mới, miễn đẹp.

### 4.4 Kỹ thuật nhân vật
- ≤ 6–10k tam giác/nhân vật, 1 material + 1 texture atlas ≤ 1024². Phong cách cần đọc được khi thu nhỏ, không cần chi tiết.
- Vì quân cờ render **realtime trong Godot**, shading phải nằm **trong Godot** (shader toon chung), không phụ thuộc Cycles.
- Xuất ra **thư mục mới** `godot/assets/models/v3_chars/c{k}.glb`: mặt trước +Z, trục đứng +Y, chân chạm y=0 tại (0,0). Mesh thân đặt tên theo quy ước mới (vd. `Body`), phụ kiện gắn vào xương (không lơ lửng).
- Sửa `TokenModels.build()`: bỏ lọc `H_DDS`, chuẩn hoá chiều cao theo quy ước mới. Chỉnh lại `TOKEN_SC`, `TOKEN_CAM_SIZE`, `SLOTS`, `CORNER_SLOTS` trong `pieces2d.gd` vì chibi **rộng hơn**: 4 quân cùng một ô không được che nhau quá ~30%.
- **Chân dung** render bằng **cùng shader và đèn** (ưu tiên sửa `tools/render_chars.gd` để chụp trong Godot):
  - `assets/ui/chars/c{k}.webp`: 320×320, toàn thân, góc 3/4, nền trong suốt, mọi nhân vật cùng khung và cùng chiều cao đầu.
  - `assets/ui/chars/av{k}.webp`: 256×256, **đầu + vai, đầu chiếm ~70% khung**, phải còn rõ khi thu xuống 52px.

### 4.5 Nguồn mô hình (theo thứ tự ưu tiên)
1. **Gói CC0 chibi có rig + anim sẵn, cùng một tác giả** để đồng bộ (ví dụ cần tự kiểm tra license và chất lượng: Kenney, Quaternius, KayKit), rồi chỉnh mạnh trang phục / đạo cụ / màu trong Blender cho đúng bảng 4.2.
2. **Tự dựng bằng Blender Python** từ khối cơ bản + subdivision + boolean mềm, mặt vẽ bằng texture.
3. Nếu có công cụ tạo ảnh AI: chỉ dùng để làm **concept / turnaround** chốt hướng. Asset cuối phải là 3D tự dựng hoặc CC0 để kiểm soát nhất quán.

**Cấm:** VALID avatars / mô hình quét người thật, asset trích xuất từ game khác (Business Tour, Monopoly GO…), nhân vật có bản quyền. Ghi nguồn đầy đủ vào `assets/models/CREDITS.txt`.

---

## 5. Công trình

### 5.1 Quy tắc
- **Kiến trúc Việt Nam theo vùng.** Cấp càng cao càng **cao hơn, nhiều tầng hơn, nhiều chi tiết hơn**; phải phân biệt cấp 1 → khách sạn **chỉ bằng silhouette**.
- **Màu người chơi chỉ nằm ở vài chỗ dễ thấy**: cờ đuôi nheo trên nóc, mái hiên bạt, viền đế/sân trước, đèn lồng. Chiếm ~20–30% diện tích ảnh, **tường giữ tông kem / vàng vôi / trắng**, mái ngói giữ màu đất nung. Nhận ra chủ đất qua màu **ở ≥ 2 vị trí**.
- Chân công trình ≤ ~60% mặt ô, **chừa mép trước cho quân cờ** (v2.2.1 đã đẩy quân ra mép ô) và **không che tên/giá của ô**.
- Chiều cao tham khảo (theo `FIT` trong `render_builds.gd`): cấp 1 ≈ 0.55, cấp 2 ≈ 0.8, cấp 3 ≈ 1.05, khách sạn ≈ 1.45 đơn vị.
- Vẫn chạy được hiệu ứng có sẵn: mọc lên (`grow`/`up`), sập (`crumble`), cháy (`burn`).

### 5.2 Danh sách mô hình (giữ thứ tự `MODELS`, 13 mô hình × 4 màu người chơi)

| # | Loại | Thiết kế mới |
|---|---|---|
| 0 | resort | Bãi cát nhỏ viền nước, 2 chòi lá, dù sọc, ghế bố, **thuyền thúng**, cây dừa |
| 1 | cấp 1 | Nhà cấp 4 Bắc Bộ: mái ngói đỏ, sân gạch, chum nước |
| 2 | cấp 1 | Nhà miền Tây: mái lá, hàng dừa nhỏ, xuồng ba lá cạnh nhà |
| 3 | cấp 1 | Nhà mái tôn Sài Gòn + giàn hoa giấy |
| 4 | cấp 1 | Nhà sàn thấp Tây Nguyên, mái dốc |
| 5 | cấp 2 | Nhà ống phố cổ Hội An: tường vàng, cửa gỗ, đèn lồng |
| 6 | cấp 2 | Nhà phố Sài Gòn: ban công hoa giấy, mái hiên bạt |
| 7 | cấp 2 | Biệt thự Pháp nhỏ Đà Lạt: mái dốc, ống khói |
| 8 | cấp 2 | Nhà rường Huế, 2 lớp mái |
| 9 | cấp 3 | Nhà phố Hà Nội hẹp–cao, ban công sắt, biển hiệu |
| 10 | cấp 3 | Mini hotel ven biển, ban công kính, cây xanh |
| 11 | khách sạn | Khách sạn kiểu Đông Dương: toà vàng, mái vòm, cờ, đèn hắt |
| 12 | khách sạn | Tháp khách sạn hiện đại có mái cong kiểu đình, đèn viền |

- **Tuỳ chọn (nên làm):** chọn kiểu cấp 1–2 **theo vùng của ô** (nhóm `brown/sky` → miền Nam, `pink/orange` → miền Trung/Tây Nguyên, `red/yellow` → Hội An/Huế, `green/navy` → Bắc Bộ/đô thị) qua `building_key()` trong `pieces2d.gd`.
- **Tuỳ chọn:** 4 khu du lịch có mô hình riêng (Phú Quốc, Mũi Né đồi cát, Côn Đảo rùa biển, Cát Bà vịnh/khỉ). Nếu làm thì mở rộng `MODELS` và `building_key()` gọn gàng, cập nhật cả `render_builds.gd` lẫn `pieces2d.gd`.
- Xuất sprite sheet mới bằng `render_builds.gd` (shader toon + đèn chung). Cập nhật `BHEIGHT`, `BANCHOR`, `BSCALE` nếu đổi.

---

## 6. Bàn cờ

### 6.1 Ô đất
- Mặt ô: nền **kem / giấy dó sáng**, ít chi tiết, vân `paper.png` rất nhẹ.
- **Dải màu nhóm** dày ~20% chiều sâu ô, đặt cố định ở **một** mép (mép phía sân giữa hoặc phía ngoài, chọn một và giữ nhất quán), như Monopoly cổ điển. Chỉnh 8 màu nhóm về **cùng độ sáng và độ tươi** (giữ nguyên hue trong `data.gd`).
- Bố cục: biểu tượng địa danh (giữ `assets/icons/*.webp`, đồng bộ cỡ + thêm bóng mềm) → **tên** → **giá**. Font hỗ trợ tốt tiếng Việt (Montserrat đang dùng hoặc Be Vietnam Pro), cỡ tối thiểu ~13px ở 1600×900. **Kiểm tra dấu không bị cắt**: "Buôn Ma Thuột", "TP. Hồ Chí Minh", "Phan Thiết", "Quy Nhơn".
- **Trạng thái ô** phải đọc được ngay:
  - Có chủ: viền hoặc góc cờ màu người chơi **trên chính ô** (không chỉ dựa vào nhà).
  - Độc quyền: viền vàng + hoạ tiết.
  - Lễ hội ×2: treo đèn lồng.
  - FESTIVAL (+50%): cổng lễ hội.
  - Đang chọn / mờ / nhấp nháy: giữ logic cũ, làm lại hình.
- Ô **Cơ Hội**: phong bao lì xì đỏ–vàng. Ô **Thuế**: túi tiền / biên lai. **Khu du lịch**: nền cát–nước.

### 6.2 Bốn ô góc (tiểu cảnh 3D cùng phong cách nhà, chụp bằng `render_props.gd`)
- **Xuất Phát:** cổng chào nhỏ có băng rôn, mũi tên hướng đi, đồng xu vàng.
- **Đảo Hoang:** đảo cát tròn, cây dừa nghiêng, thuyền thúng mắc cạn, phao cứu sinh.
- **Lễ Hội:** sân khấu đình làng nhỏ, dây đèn lồng, trống, pháo hoa (hiệu ứng).
- **Sân Bay:** đài kiểm soát nhỏ, đường băng ngắn, máy bay đồ chơi.

### 6.3 Sân giữa
- **Bỏ hẳn ô caro.** Thay bằng một mặt sân **tương phản thấp**: gradient nhẹ + hoạ tiết vòng **trống đồng Đông Sơn** chìm ở rìa + logo "CỜ TỶ PHÚ" ở giữa (một khối, không chữ chạy vòng lộn xộn).
- **Chừa trống vùng giữa** cho xúc xắc 3D và đống kho báu (`pile_*`); xúc xắc phải nổi rõ trên sân ở cả 4 theme.
- Cập nhật `tools/render_board.py` để sinh `court_<theme>.png` mới.

### 6.4 Bệ, đèn, cổng, nền
- Giữ ý tưởng **bệ 2 tầng giữa hồ** nhưng đổi chất liệu theo theme (vd. gỗ sơn mài đỏ–đen–vàng thếp cho `wood`). Làm lại `side.png`, `plinth.png`.
- Thay đèn `andon` bằng **đèn lồng lụa Hội An** (tròn, có tua). Giữ đèn viền chạy.
- Thay cổng **torii** bằng **cổng tam quan / cổng làng** có biển "LỄ HỘI" và dây đèn lồng (`torii.png`, `torii_r.png` → tên mới, sửa tham chiếu trong `pieces2d.gd`).
- Đạo cụ kho báu `pile_*`: vàng thỏi, đồng xu, rương chung bảng màu ấm; bớt cam chói.
- Nền `assets/art/<theme>_sky|clouds|land.png`: **giảm độ tươi phía sau bàn cờ**, thêm hình bóng xa mang chất Việt (xem mục 7).

---

## 7. Bốn theme (giữ nguyên key để không hỏng cài đặt người dùng)

| Key | Tên hiển thị đề xuất | Cảm hứng | Bảng màu gợi ý |
|---|---|---|---|
| `sakura` | Mai anh đào Đà Lạt | đồi thông, hồ sương, hoa mai anh đào | `#f6e7ee` `#e86a92` `#f7c6d5` `#3e6b5a` `#f3d9a4` |
| `wood` | Gỗ sơn mài cổ điển | sơn mài, vàng thếp, ruộng bậc thang xa | `#f2e3c6` `#b5462e` `#2b1d16` `#d9a441` `#6e4a2e` |
| `ocean` | Vịnh Hạ Long | núi đá vôi, nước ngọc, nắng | `#eaf4f7` `#1f7a8c` `#0f3d5c` `#f2c14e` `#8fb9a8` |
| `midnight` | Phố đêm Hội An | mái phố cổ, đèn lồng, sông Hoài | `#1e2140` `#2e335e` `#f2b544` `#e0565b` `#9fd3c7` |

Cập nhật `STYLE` (`board2d.gd`), `GRADE` (`pieces2d.gd`), `COURT` (`render_board.py`) cho khớp. `GRADE` không được làm bạc màu quân cờ: quân cờ luôn tương phản cao nhất.

---

## 8. Ràng buộc kỹ thuật (KHÔNG được phá)
- Không sửa luật/dữ liệu/mạng: `scripts/rules.gd`, `scripts/data.gd` (trừ màu nếu cần), `scripts/net.gd`, `scripts/bot.gd`. **Chơi chéo với bản web phải chạy như cũ**; id nhân vật 0–11 giữ nguyên ý nghĩa.
- Không đụng bản web (`index.html`, `js/`, `css/`, `assets/` ở gốc) trong đợt này.
- **Làm song song, không xoá đồ cũ cho tới khi tôi duyệt:** asset mới để ở thư mục/tên mới (`v3_chars/`, `houses_v3.png`, …), chuyển qua lại bằng **một hằng số** (vd. `const ART_V3 := true`) để tôi so sánh A/B.
- Hiệu năng: ≥ 60 fps ở 1600×900 trên GPU tích hợp với 4 quân cờ realtime. Bản build không phình quá ~30MB so với hiện tại.
- License: chỉ CC0 / MIT / CC-BY (ghi công đầy đủ). Không dùng IP của người khác.
- Code: GDScript sạch, comment tiếng Việt như code hiện có; cập nhật comment đầu file cho đúng với asset mới.

---

## 9. Quy trình làm việc và điểm dừng duyệt

**Bước 0: An toàn và khảo sát**
1. `git status`. **KHÔNG** chạy `git checkout`, `reset`, `clean`, `stash`. Tạo nhánh `redesign/art-v3` và commit snapshot WIP hiện tại (message: `wip: snapshot trước khi làm lại mỹ thuật`).
2. Đọc các file ở mục 1. Chạy game, chụp màn hình lưu vào `docs/redesign/before/`: màn chọn nhân vật; đầu ván; giữa ván có đủ nhà cấp 1 → khách sạn + khu du lịch + cổng lễ hội; cận cảnh 4 quân cùng một ô; cả 4 theme.
3. Gửi tôi bảng tóm tắt: những gì bạn thấy, có đồng ý với chẩn đoán ở mục 2 không, bổ sung gì.

**Bước 1: Style guide + lát cắt mẫu → DỪNG CHO TÔI DUYỆT**
1. Viết `docs/redesign/STYLE.md`: bảng màu, shader, đèn, tỉ lệ, độ dày viền, quy tắc màu người chơi, thứ bậc tương phản.
2. Làm **1 nhân vật hoàn chỉnh** (gợi ý c9 Địa Chủ Miền Tây hoặc c0), đủ 6 hoạt ảnh. Làm **1 bộ nhà** (cấp 1, 2, 3, khách sạn) và **1 ô đất mẫu**, sân giữa mới cho theme `sakura`.
3. Ghép vào game thật, chụp màn hình **trước/sau đặt cạnh nhau** (`docs/redesign/step1/`), kèm 1 ảnh quân cờ ở đúng kích thước 100px.
4. **Dừng, chờ tôi duyệt hoặc sửa hướng.** Không làm tiếp khi chưa duyệt.

**Bước 2: 12 nhân vật**
Làm đủ 12 + chân dung `c{k}` / `av{k}`. Xuất ảnh: 12 nhân vật xếp hàng (màu + bản tô đen silhouette), 4 quân trên một ô. **Dừng duyệt.**

**Bước 3: Công trình**
13 mô hình × 4 màu → sprite sheet mới. Ảnh chụp giữa ván có đủ các cấp ở cả 4 cạnh bàn.

**Bước 4: Bàn cờ**
Ô đất, ô đặc biệt, 4 ô góc, sân giữa, bệ, đèn lồng, cổng lễ hội, kho báu.

**Bước 5: 4 theme + hoàn thiện**
Bảng màu, `GRADE`, nền xa; bóng đổ, viền, hiệu ứng lên khách sạn/độc quyền vẫn đẹp với phong cách mới.

**Bước 6: Kiểm thử và bàn giao**
1. Chạy `tools/sim.gd`, không lỗi. Chơi thử 1 ván với máy và 1 ván online với bản web.
2. Chụp bộ ảnh `docs/redesign/after/` cùng góc với `before/`.
3. Cập nhật `CREDITS.txt`, README (phần đồ hoạ), xoá asset cũ **chỉ khi tôi đồng ý**.
4. Commit theo từng bước, message tiếng Việt kiểu repo đang dùng (`feat(app): …`).

---

## 10. Tiêu chí nghiệm thu (checklist)
- [ ] Ở 1600×900, mức zoom mặc định: nhìn quân cờ trên ô **nhận ra là ai trong < 1 giây**, thấy rõ mắt và biểu cảm.
- [ ] 12 silhouette tô đen **phân biệt được hết**. 12 màu chủ đạo không trùng nhau.
- [ ] 4 quân cùng một ô không che nhau quá ~30%. Quân không che tên/giá ô.
- [ ] Phân biệt cấp 1 → khách sạn ngay bằng hình khối. Nhận ra chủ đất qua màu ở ≥ 2 vị trí.
- [ ] Tên ô và giá đọc được, **dấu tiếng Việt không bị cắt**.
- [ ] Không còn yếu tố Nhật/Trung (torii, andon, machiya, chùa Nhật).
- [ ] **Một** hướng sáng, **một** shader, **một** kiểu viền cho mọi asset. Chân dung UI khớp quân cờ trên bàn.
- [ ] Thứ bậc tương phản đúng: nền < bàn < nhà < quân cờ, ở cả 4 theme. Xúc xắc nổi rõ trên sân giữa.
- [ ] ≥ 60 fps; build không phình quá ~30MB; `sim.gd` chạy sạch; chơi chéo với web OK.
- [ ] Có bộ ảnh before/after và `STYLE.md`.

---

## 11. Những điều KHÔNG làm
- Không dùng mô hình người tỉ lệ thật / da ảnh quét / PBR bóng loáng cho quân cờ.
- Không phủ màu người chơi lên toàn bộ tường hoặc mái.
- Không thêm chi tiết nhỏ li ti (sẽ thành nhiễu ở kích thước thật). Ưu tiên khối to, màu rõ.
- Không trộn phong cách: mọi asset mới phải qua cùng shader và đèn.
- Không xoá WIP / asset cũ, không force-push, không đổi luật chơi.
- Không báo "xong" khi chưa có ảnh chụp trong game chứng minh.
