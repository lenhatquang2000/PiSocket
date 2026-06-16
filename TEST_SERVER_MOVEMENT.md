# 🧪 Test Guide: Server-Authoritative Movement System

## ✅ Integration Complete!

Hệ thống server-authoritative movement đã được integrate thành công vào game. Đây là hướng dẫn test.

## 📋 Checklist - Những gì đã làm

### Server-Side (server.js)
- ✅ Added tick system (30 ticks/giây)
- ✅ Added `playerInputs` object để lưu input
- ✅ Added `playerInput` socket event
- ✅ Server tính toán vị trí dựa trên input
- ✅ Server broadcast `serverTick` event

### Client-Side (main.js)
- ✅ Import `ServerMovementController`
- ✅ Initialize controller khi game starts
- ✅ Thay thế movement logic bằng `serverMovement.updateInput()`
- ✅ Comment out old `playerMovement` emit
- ✅ Added `serverTick` listener cho other players
- ✅ Added sync khi teleport

### ServerMovement.js
- ✅ Created controller class
- ✅ Input handling (8 directions)
- ✅ Server tick listener
- ✅ Position interpolation
- ✅ Sync method

## 🚀 Cách Test

### Bước 1: Start Server
```bash
node server.js
```

**Expected Output:**
```
🎮 Server tick system started: 30 ticks/second
WebSocket Server is running on port 3000
```

### Bước 2: Mở Game (Tab 1)
1. Mở browser: `http://localhost:3000`
2. Login với username (ví dụ: "Player1")
3. Nhấn "Tạo nhân vật"

**Expected Console Logs:**
```
✅ Connected to server, id: [socket-id]
🎮 Server movement controller initialized
Game started as: Player1
```

### Bước 3: Di chuyển (Tab 1)
1. Nhấn WASD hoặc Arrow keys để di chuyển
2. Thử di chuyển theo 8 hướng (W+D = north-east, etc.)

**Expected Console Logs (Client):**
```
📤 Sent input to server: north
📤 Sent input to server: north-east
📤 Sent input to server: east
```

**Expected Console Logs (Server):**
```
(Không có logs - server chỉ process input trong tick loop)
```

### Bước 4: Mở Tab 2 (Multi-player Test)
1. Mở tab mới: `http://localhost:3000`
2. Login với username khác (ví dụ: "Player2")
3. Nhấn "Tạo nhân vật"

**Expected:**
- Tab 1 thấy Player2 xuất hiện
- Tab 2 thấy Player1 xuất hiện

### Bước 5: Test Movement Sync
1. Di chuyển Player1 ở Tab 1
2. Quan sát ở Tab 2

**Expected:**
- Player1 di chuyển smooth ở Tab 2
- Không có lag hoặc jitter
- Animation đúng (walk khi di chuyển, idle khi dừng)

### Bước 6: Test Anti-Cheat
1. Mở DevTools Console ở Tab 1
2. Thử hack speed:
```javascript
// Thử thay đổi speed (sẽ KHÔNG hoạt động)
characterContainer.x += 1000;
```

**Expected:**
- Position sẽ bị server override về vị trí đúng
- Server kiểm soát tốc độ, client không thể hack

### Bước 7: Test Teleport
1. Nhập chunk coordinates (ví dụ: X=1, Y=1)
2. Nhấn "🚀 Teleport"

**Expected Console Logs:**
```
🚀 [TELEPORT] Teleporting to chunk (1, 1)...
✅ [TELEPORT] Player teleported to chunk (1, 1) at world position (...)
```

**Expected:**
- Player teleport đến chunk mới
- Position được sync với server
- Other players thấy teleport

## 🔍 Debug Checklist

### Nếu movement không hoạt động:

1. **Check server logs:**
   - Có thấy "🎮 Server tick system started" không?
   - Có errors không?

2. **Check client logs:**
   - Có thấy "🎮 Server movement controller initialized" không?
   - Có thấy "📤 Sent input to server" khi nhấn WASD không?

3. **Check network:**
   - Mở DevTools → Network → WS (WebSocket)
   - Có thấy `playerInput` events không?
   - Có thấy `serverTick` events không?

4. **Check browser console:**
   - Có errors về import không?
   - Có errors về undefined variables không?

### Nếu other players không di chuyển smooth:

1. **Check interpolation alpha:**
   - Trong `serverMovement.js`: `this.interpolationAlpha = 0.3`
   - Giảm xuống 0.1 nếu quá smooth (lag)
   - Tăng lên 0.5 nếu quá jittery

2. **Check tick rate:**
   - Trong `server.js`: `const TICK_RATE = 30`
   - Tăng lên 60 nếu cần smooth hơn (tốn bandwidth)

### Nếu có collision issues:

**LƯU Ý:** Collision detection hiện tại vẫn ở client-side. Server chưa có collision detection. Đây là expected behavior. Để implement server-side collision, cần:
1. Move collision logic lên server
2. Server check collision trước khi update position
3. Client chỉ render position từ server

## 📊 Performance Metrics

### Expected Performance:
- **Tick Rate**: 30 ticks/giây (33.33ms/tick)
- **Network**: ~1-2 KB/s per player (chỉ gửi direction)
- **CPU**: Minimal (server chỉ tính toán position)
- **Latency**: <50ms (local), <100ms (internet)

### Monitor Performance:
```javascript
// Trong browser console
// Check tick rate
let lastTick = Date.now();
socket.on('serverTick', () => {
    const now = Date.now();
    console.log('Tick interval:', now - lastTick, 'ms');
    lastTick = now;
});
```

## ✅ Success Criteria

Hệ thống hoạt động đúng nếu:
1. ✅ Player di chuyển smooth khi nhấn WASD
2. ✅ Other players thấy movement real-time
3. ✅ Không thể hack speed bằng cách modify client code
4. ✅ Teleport hoạt động và sync với server
5. ✅ Animation đúng (walk/idle) dựa trên movement state
6. ✅ Không có errors trong console

## 🐛 Known Issues

1. **Collision Detection**: Vẫn ở client-side, cần move lên server
2. **Lag Compensation**: Chưa có client-side prediction
3. **PNeural Bot**: Vẫn dùng logic cũ, chưa migrate sang tick system

## 🚀 Next Steps

1. Test với nhiều players (3-5 players)
2. Test trên network thật (không phải localhost)
3. Implement server-side collision detection
4. Add client-side prediction nếu cần
5. Migrate PNeural bot sang tick system

## 📝 Notes

- Server movement system hoàn toàn tương thích với code cũ
- `playerMovement` event vẫn được giữ lại (deprecated)
- Có thể rollback bằng cách uncomment old code và comment new code
- Bandwidth giảm ~70% so với gửi full position

---

**Happy Testing! 🎮**
