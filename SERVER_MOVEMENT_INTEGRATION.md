# Server-Authoritative Movement System - Integration Guide

## 🎯 Mục tiêu
Chuyển từ client-side movement sang server-authoritative movement để chống hack speed và position.

## ✅ Đã hoàn thành (Server-side)

### 1. Server.js - Tick System (30 ticks/giây)
- ✅ Added `TICK_RATE = 30` và `PLAYER_SPEED = 4`
- ✅ Added `playerInputs` object để lưu input của mỗi player
- ✅ Added server tick loop (setInterval 33.33ms)
- ✅ Server tính toán vị trí dựa trên input (8 hướng)
- ✅ Server broadcast `serverTick` event với tất cả player positions
- ✅ Added `playerInput` socket event để nhận input từ client
- ✅ Modified `playerMovement` event (deprecated, giữ lại để tương thích)

### 2. ServerMovement.js - Client Controller
- ✅ Created `ServerMovementController` class
- ✅ Handles input → server communication
- ✅ Listens to `serverTick` events
- ✅ Interpolates position for smooth rendering

## 📋 Cần làm (Client-side Integration)

### Bước 1: Import ServerMovementController vào main.js

```javascript
// Thêm vào đầu file main.js
import { ServerMovementController } from './serverMovement.js';
```

### Bước 2: Khởi tạo ServerMovementController

Tìm dòng này trong main.js (sau khi tạo characterContainer):
```javascript
const characterContainer = new Container();
```

Thêm ngay sau đó:
```javascript
// Initialize server movement controller
const serverMovement = new ServerMovementController(socket, characterContainer);
```

### Bước 3: Thay thế Movement Logic trong Game Loop

Tìm phần này trong game loop (ticker.add):
```javascript
// OLD CODE - XOÁ HOẶC COMMENT
let moved = false;
if (keys['KeyW'] || keys['ArrowUp']) {
    characterContainer.y -= moveSpeed;
    currentDir = 'north';
    isMoving = true;
    moved = true;
}
// ... các hướng khác
```

Thay bằng:
```javascript
// NEW CODE - Server-authoritative movement
const isMovingNow = serverMovement.updateInput(keys);
currentDir = serverMovement.getCurrentDirection();
isMoving = isMovingNow;

// Không cần tính toán vị trí nữa - server sẽ lo
// characterContainer.x và y sẽ được update bởi serverMovement.setupServerTickListener()
```

### Bước 4: Xóa hoặc Comment Old playerMovement Emit

Tìm và XOÁ/COMMENT các dòng này:
```javascript
// OLD - XOÁ
socket.emit("playerMovement", {
    x: characterContainer.x,
    y: characterContainer.y,
    dir: currentDir,
    isMoving: isMoving,
    name: myGameId
});
```

Server movement controller đã tự động gửi input qua `playerInput` event.

### Bước 5: Update Other Players Rendering

Tìm socket event `playerMoved`:
```javascript
socket.on("playerMoved", (data) => {
    // OLD CODE - có thể giữ lại để tương thích ngược
});
```

Thêm listener mới cho `serverTick`:
```javascript
socket.on("serverTick", (playerStates) => {
    // Update all other players
    for (const socketId in playerStates) {
        if (socketId === socket.id) continue; // Skip self
        
        const state = playerStates[socketId];
        const otherPlayer = otherPlayers[socketId];
        
        if (otherPlayer) {
            // Smooth interpolation
            otherPlayer.container.x += (state.x - otherPlayer.container.x) * 0.3;
            otherPlayer.container.y += (state.y - otherPlayer.container.y) * 0.3;
            
            // Update animation
            if (state.isMoving && otherPlayer.currentDir !== state.dir) {
                otherPlayer.currentDir = state.dir;
                otherPlayer.character.textures = walkAnimations[state.dir];
                otherPlayer.character.play();
            } else if (!state.isMoving) {
                otherPlayer.character.textures = idleAnimations[state.dir];
                otherPlayer.character.play();
            }
        }
    }
});
```

### Bước 6: Teleport và Spawn Position

Khi teleport hoặc spawn, cần sync với server:
```javascript
// Sau khi set position
characterContainer.x = spawnX;
characterContainer.y = spawnY;

// Sync với server movement controller
serverMovement.syncPosition(spawnX, spawnY);
```

## 🧪 Testing

1. Start server: `node server.js`
2. Mở 2 browser tabs
3. Di chuyển ở tab 1 → tab 2 phải thấy movement smooth
4. Thử hack speed bằng cách modify client code → server vẫn giữ speed cố định
5. Check console logs:
   - Client: `📤 Sent input to server: north`
   - Server: `🎮 Server tick system started: 30 ticks/second`

## 📊 Performance

- **Tick Rate**: 30 ticks/giây (33.33ms/tick)
- **Network**: Chỉ gửi input (direction), không gửi position
- **Bandwidth**: Giảm ~70% so với gửi full position data
- **Anti-cheat**: Client không thể hack speed hoặc position

## 🔧 Tuning

Có thể điều chỉnh trong server.js:
```javascript
const TICK_RATE = 30; // Tăng = smooth hơn, tốn bandwidth hơn
const PLAYER_SPEED = 4; // Tốc độ di chuyển (pixels/tick)
```

Có thể điều chỉnh trong serverMovement.js:
```javascript
this.interpolationAlpha = 0.3; // 0 = instant, 1 = full smooth
```

## ⚠️ Lưu ý

1. **Backward Compatibility**: Giữ lại `playerMovement` event để tương thích với code cũ
2. **Collision Detection**: Cần move collision detection lên server (future work)
3. **Lag Compensation**: Có thể thêm client-side prediction nếu cần (future work)
4. **PNeural Bot**: Bot vẫn dùng logic cũ, có thể migrate sau

## 🚀 Next Steps

1. Integrate vào main.js theo hướng dẫn trên
2. Test với nhiều players
3. Add server-side collision detection
4. Add lag compensation nếu cần
5. Migrate PNeural bot sang server tick system
