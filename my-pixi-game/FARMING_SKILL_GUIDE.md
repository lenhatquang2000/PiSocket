# 🌾 Hướng Dẫn Kỹ Năng Farming (Trồng Trọt)

## Tổng Quan
Kỹ năng **Farming** cho phép nhân vật của bạn đào đất để chuẩn bị trồng trọt. Kỹ năng này sử dụng animation "dig" với 8 hướng khác nhau và tạo ra ô đất đã đào tại vị trí player.

## Thông Tin Kỹ Năng

| Thuộc tính | Giá trị |
|------------|---------|
| **Tên kỹ năng** | Farming |
| **Skill ID** | 2 |
| **Loại** | farming |
| **Phím tắt** | **V** |
| **MP Cost** | 5 MP |
| **Cooldown** | 2 giây |
| **Animation** | 9 frames (dig animation) |
| **Tốc độ animation** | 0.15 |
| **Hiệu ứng** | Tạo ô đất đã đào tại vị trí player |

## Cách Sử Dụng

1. **Đảm bảo có đủ MP**: Bạn cần ít nhất **5 MP** để sử dụng kỹ năng
2. **Nhấn phím V**: Nhân vật sẽ thực hiện animation đào đất theo hướng hiện tại
3. **Ô đất đã đào xuất hiện**: Một sprite đất đã đào sẽ xuất hiện ngay dưới chân player
4. **Chờ cooldown**: Sau khi sử dụng, bạn cần chờ **2 giây** trước khi có thể sử dụng lại

## Đặc Điểm

- ✅ **8 hướng**: Animation dig hoạt động với tất cả 8 hướng (north, north-east, east, south-east, south, south-west, west, north-west)
- ✅ **Khóa di chuyển**: Khi đang đào, nhân vật không thể di chuyển cho đến khi animation hoàn tất
- ✅ **Multiplayer**: Người chơi khác có thể thấy bạn đang đào đất và ô đất đã đào
- ✅ **Cooldown tracking**: Hệ thống theo dõi thời gian hồi chiêu tự động
- ✅ **Grid-based**: Ô đất đã đào được snap vào grid 32x32 pixels
- ✅ **Không trùng lặp**: Không thể đào lại vị trí đã đào
- ✅ **Persistent**: Ô đất đã đào tồn tại vĩnh viễn trên map (trong session hiện tại)

## Thông Báo Console

Khi sử dụng kỹ năng, bạn sẽ thấy các thông báo sau trong console:

- ✅ `Sử dụng Farming! MP: X/Y` - Kỹ năng được kích hoạt thành công
- ⚠️ `Bạn chưa có kỹ năng Farming!` - Kỹ năng chưa được thêm vào database
- ⏱️ `Kỹ năng Farming đang hồi chiêu: X.Xs` - Kỹ năng đang trong thời gian cooldown
- ❌ `Không đủ MP! Cần 5, hiện có X` - Không đủ MP để sử dụng

## Kỹ Thuật

### Database
Kỹ năng được lưu trong bảng `skills` với cấu trúc:
```sql
INSERT INTO skills (username, skill_id, skill_name, skill_type, frames_path, frame_count, animation_speed, cooldown_time, mp_cost)
VALUES (username, 2, 'Farming', 'farming', '/assets/A_cute_chibi_anime_girl/animations/dig/', 9, 0.15, 2.0, 5)
```

### Animation Assets
Animation frames được lưu tại:
```
/assets/A_cute_chibi_anime_girl/animations/dig/
├── north/
│   ├── frame_000.png
│   ├── frame_001.png
│   └── ... (9 frames)
├── north-east/
├── east/
├── south-east/
├── south/
├── south-west/
├── west/
└── north-west/
```

### Socket Events
- **Client → Server**: `playerDig` với data `{ x, y, dir }`
- **Server → Other Clients**: `playerDig` với data `{ id, x, y, dir }`

## Mở Rộng Trong Tương Lai

Kỹ năng Farming hiện tại chỉ là animation đào đất. Có thể mở rộng thêm:

1. **Trồng cây**: Sau khi đào, có thể trồng hạt giống
2. **Thu hoạch**: Sau một thời gian, cây trưởng thành và có thể thu hoạch
3. **Inventory system**: Lưu trữ hạt giống và nông sản
4. **Farming zones**: Chỉ có thể đào ở những vùng đất nhất định
5. **Crop growth**: Hệ thống cây trồng phát triển theo thời gian

## Lưu Ý

- Kỹ năng này được tự động thêm vào tất cả người chơi mới
- Người chơi cũ cần đăng nhập lại để nhận kỹ năng (do `INSERT OR IGNORE`)
- Animation dig không tạo ra hiệu ứng visual nào khác ngoài chuyển động nhân vật
- Kỹ năng không ảnh hưởng đến terrain hay tạo ra vật phẩm

---

**Phiên bản**: 1.0  
**Ngày tạo**: 2026-05-28  
**Tác giả**: AI Assistant
