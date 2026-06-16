# 💾 Hệ Thống Lưu Trữ Ô Đất Đã Đào (Farmed Tiles Persistence)

## Tổng Quan
Hệ thống lưu trữ persistent cho các ô đất đã đào, đảm bảo dữ liệu không bị mất khi reload trang hoặc khởi động lại server.

## Kiến Trúc

### 1. **Database Schema**
```sql
CREATE TABLE farmed_tiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  x REAL NOT NULL,
  y REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(x, y)
)
```

### 2. **API Endpoints**

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/save-farmed-tile` | POST | Lưu một ô đất đã đào |
| `/get-farmed-tiles` | GET | Lấy tất cả ô đất đã đào |
| `/delete-farmed-tile` | POST | Xóa một ô đất đã đào |

### 3. **Client-Side Flow**

#### **Khi Game Khởi Động:**
1. Load tất cả assets
2. Gọi `loadFarmedTiles()` để load từ server
3. Tạo sprites cho mỗi ô đất đã đào
4. Hiển thị UI

#### **Khi Player Đào Đất (Nhấn V):**
1. Kiểm tra MP và cooldown
2. Tạo sprite ô đất đã đào
3. Gửi POST request đến `/save-farmed-tile`
4. Broadcast socket event `playerDig` cho người chơi khác

#### **Khi Người Chơi Khác Đào Đất:**
1. Nhận socket event `playerDig`
2. Tạo sprite ô đất đã đào (không lưu lại vào server)
3. Hiển thị animation dig

## Cấu Trúc Code

### **Database Functions (database.js)**
```javascript
saveFarmedTile(x, y)           // Lưu ô đất mới
getAllFarmedTiles()            // Lấy tất cả ô đất
deleteFarmedTile(x, y)         // Xóa ô đất
clearAllFarmedTiles()          // Xóa tất cả ô đất
```

### **Player Manager (playerManager.js)**
```javascript
saveFarmedTileData(x, y)       // Wrapper cho saveFarmedTile
getFarmedTiles()               // Wrapper cho getAllFarmedTiles
removeFarmedTile(x, y)         // Wrapper cho deleteFarmedTile
clearFarmedTiles()             // Wrapper cho clearAllFarmedTiles
```

### **Client Functions (main.js)**
```javascript
createFarmedTile(x, y, saveToServer = true)  // Tạo sprite và lưu vào server
loadFarmedTiles()                             // Load từ server khi khởi động
```

## Tính Năng

### ✅ **Persistent Storage**
- Dữ liệu được lưu trong SQLite database
- Không bị mất khi reload trang
- Không bị mất khi restart server

### ✅ **Multiplayer Sync**
- Socket event `playerDig` broadcast cho tất cả người chơi
- Người chơi mới vào sẽ thấy tất cả ô đất đã đào trước đó

### ✅ **Duplicate Prevention**
- UNIQUE constraint trên (x, y) trong database
- Client-side check trước khi tạo sprite

### ✅ **Grid-Based System**
- Tọa độ được snap vào grid 32x32
- Đảm bảo không có khoảng trắng giữa các ô

## Cách Sử Dụng

### **Đào Đất**
```javascript
// Nhấn phím V
// → createFarmedTile(x, y, true) được gọi
// → Sprite được tạo
// → POST /save-farmed-tile
// → Socket broadcast playerDig
```

### **Load Khi Khởi Động**
```javascript
// Game start
// → loadFarmedTiles() được gọi
// → GET /get-farmed-tiles
// → Tạo sprites cho tất cả tiles
```

### **Xóa Ô Đất (Admin)**
```javascript
// Gọi từ console hoặc admin panel
fetch('http://localhost:3000/delete-farmed-tile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ x: 100, y: 200 })
});
```

## Debug & Monitoring

### **Console Logs**
- `📦 Loading X farmed tiles from server...` - Bắt đầu load
- `✅ Loaded X farmed tiles` - Load thành công
- `✅ Đã tạo ô đất đã đào tại (X, Y)` - Tạo tile mới
- `⚠️ Vị trí này đã được đào rồi!` - Duplicate prevention

### **Database Query**
```sql
-- Xem tất cả ô đất đã đào
SELECT * FROM farmed_tiles ORDER BY created_at DESC;

-- Đếm số lượng
SELECT COUNT(*) FROM farmed_tiles;

-- Xóa tất cả (reset)
DELETE FROM farmed_tiles;
```

## Performance

### **Optimization**
- Grid-based system giảm số lượng sprites
- UNIQUE constraint ngăn duplicates
- Batch load khi khởi động
- Async save không block gameplay

### **Scalability**
- Hiện tại: Unlimited tiles
- Khuyến nghị: Thêm limit nếu cần (ví dụ: 10,000 tiles)
- Có thể thêm spatial indexing nếu cần

## Future Enhancements

1. **Tile Expiration**: Ô đất tự động reset sau X ngày
2. **Per-Player Tiles**: Mỗi player có ô đất riêng
3. **Tile States**: Thêm trạng thái (đã trồng, đã thu hoạch, etc.)
4. **Spatial Queries**: Chỉ load tiles gần player
5. **Undo/Redo**: Cho phép hoàn tác đào đất

---

**Phiên bản**: 1.0  
**Ngày tạo**: 2026-05-28  
**Tác giả**: AI Assistant
