# Hệ Thống Kỹ Năng (Skills System)

## Tổng Quan

Hệ thống kỹ năng cho phép người chơi sử dụng các kỹ năng với cooldown và chi phí MP.

## Cấu Trúc Database

### Bảng `skills`
```sql
CREATE TABLE skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  skill_id INTEGER NOT NULL,
  skill_name TEXT NOT NULL,
  skill_type TEXT DEFAULT 'fireball',
  frames_path TEXT NOT NULL,
  frame_count INTEGER DEFAULT 16,
  animation_speed REAL DEFAULT 0.3,
  cooldown_time REAL DEFAULT 3.0,
  mp_cost INTEGER DEFAULT 10,
  last_used DATETIME,
  FOREIGN KEY (username) REFERENCES accounts(username),
  UNIQUE(username, skill_id)
)
```

## Cách Hoạt Động

### 1. Khởi Tạo Skills
Khi tạo account mới, hệ thống tự động thêm skill mặc định (Fireball):
- **Skill ID**: 1
- **Tên**: Fireball
- **Loại**: fireball
- **Frames**: `/assets/Skills/Explosion/frame_` (16 frames)
- **Cooldown**: 3 giây
- **Chi phí MP**: 10

### 2. Load Skills
Khi game bắt đầu, client sẽ:
1. Gọi endpoint `/get-skills` để lấy danh sách skills
2. Tạo UI cho mỗi skill (nút bấm + thanh cooldown)
3. Khởi tạo cooldown data

### 3. Sử Dụng Skill
Khi người chơi bấm nút skill:
1. Kiểm tra cooldown (phải hết hồi chiêu)
2. Kiểm tra MP (phải đủ chi phí)
3. Trừ MP
4. Ghi nhận sử dụng (gọi `/use-skill`)
5. Reset cooldown
6. Phát hiệu ứng skill
7. Gửi event cho người chơi khác

### 4. Cập Nhật Cooldown
Trong game loop:
- Mỗi frame, tăng `elapsed` của cooldown
- Khi `elapsed >= cooldownTime`, skill sẵn sàng
- UI cập nhật thanh cooldown và text thời gian

## API Endpoints

### GET /get-skills
Lấy danh sách skills của player
```json
POST /get-skills
{
  "username": "player_name"
}

Response:
{
  "skills": [
    {
      "skill_id": 1,
      "skill_name": "Fireball",
      "skill_type": "fireball",
      "frames_path": "/assets/Skills/Explosion/frame_",
      "frame_count": 16,
      "animation_speed": 0.3,
      "cooldown_time": 3.0,
      "mp_cost": 10,
      "last_used": null
    }
  ]
}
```

### POST /use-skill
Ghi nhận sử dụng skill
```json
POST /use-skill
{
  "username": "player_name",
  "skillId": 1
}

Response:
{
  "success": true
}
```

### POST /skill-cooldown
Lấy thông tin cooldown của skill
```json
POST /skill-cooldown
{
  "username": "player_name",
  "skillId": 1
}

Response:
{
  "cooldownData": {
    "cooldown_time": 3.0,
    "seconds_elapsed": 1.5
  }
}
```

## UI Skills

### Vị Trí
- **Góc dưới bên trái** (fixed position)
- Hiển thị dưới stats panel

### Thành Phần
Mỗi skill có:
- **Nút bấm**: Hiển thị số thứ tự (1, 2, 3...)
- **Thanh cooldown**: Thanh đỏ ở dưới, giảm dần khi hồi chiêu
- **Text cooldown**: Hiển thị thời gian còn lại (ví dụ: "2.5s")

### Trạng Thái
- **Sẵn sàng**: Nút bình thường, opacity 100%
- **Hồi chiêu**: Nút mờ (opacity 50%), thanh cooldown hiển thị

## Cách Thêm Skill Mới

### 1. Thêm vào Database
```javascript
// Trong database.js, thêm vào hàm initializePlayerSkills
stmt.run([username, 2, 'Ice Storm', 'ice_storm', '/assets/Skills/IceStorm/frame_', 12, 0.25, 5.0, 15]);
```

### 2. Chuẩn Bị Assets
- Tạo folder: `/public/assets/Skills/IceStorm/`
- Thêm frames: `frame_000.png`, `frame_001.png`, ...

### 3. Cập Nhật playSkillEffect
```javascript
const playSkillEffect = (skill) => {
    if (skill.skill_type === 'fireball') {
        // Fireball logic
    } else if (skill.skill_type === 'ice_storm') {
        // Ice Storm logic
        playIceStormSkill(targetX, targetY);
    }
};
```

## Phím Tắt

- **Phím 1-4**: Test HP/MP (phát triển)
- **Phím 1-9**: Sử dụng skill (có thể thêm)

## Lưu Ý

1. **Cooldown lưu trên client**: Cooldown được tính trên client, không đồng bộ từ server
2. **MP tức thời**: MP được trừ ngay khi sử dụng skill
3. **Frames format**: Frames phải có định dạng `frame_00X.png` (3 chữ số)
4. **Animation speed**: Giá trị từ 0.1 (chậm) đến 1.0 (nhanh)

## Ví Dụ Sử Dụng

```javascript
// Load skills khi game bắt đầu
await loadPlayerSkills(myGameId);

// Sử dụng skill (tự động gọi khi bấm nút)
useSkill(skill, index);

// Cập nhật UI cooldown (trong game loop)
updateSkillsUI();
```

## Tương Lai

- [ ] Thêm nhiều loại skill (Ice Storm, Lightning, Heal, etc.)
- [ ] Skill tree / Upgrade system
- [ ] Skill combo system
- [ ] Skill animation customization
- [ ] Skill effect particles
