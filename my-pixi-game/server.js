import { Server } from "socket.io";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { initDatabase } from './Server/database.js';
import { checkAccount, createNewAccount, getSavedPlayerState, saveCurrentPlayerState, validateUsername, getPlayerSkillsList, recordSkillUsage, getSkillCooldown, saveFarmedTileData, getFarmedTiles, removeFarmedTile, clearFarmedTiles, getCropTypes, plantCropData, getPlantedCrops, harvestCropData, removePlantedCrop } from './Server/playerManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const players = {};

await initDatabase();

const server = http.createServer((req, res) => {
  // Log mọi request để debug
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

  // Cho phép Editor từ port 5173 gửi dữ liệu về
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', playersCount: Object.keys(players).length }));
  }
  // Check if account exists
  else if (req.method === 'POST' && req.url === '/check-account') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username } = JSON.parse(body);
        const validation = validateUsername(username);
        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ exists: false, error: validation.message }));
          return;
        }

        const normalizedUsername = username.trim();
        const exists = checkAccount(normalizedUsername);
        const playerState = exists ? getSavedPlayerState(normalizedUsername) : null;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists, playerState }));
      } catch (err) {
        console.error("❌ Lỗi check account:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Create new account
  else if (req.method === 'POST' && req.url === '/create-account') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username } = JSON.parse(body);
        const validation = validateUsername(username);
        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: validation.message }));
          return;
        }

        const success = createNewAccount(username.trim());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } catch (err) {
        console.error("❌ Lỗi create account:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Get player skills
  else if (req.method === 'POST' && req.url === '/get-skills') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username } = JSON.parse(body);
        const skills = getPlayerSkillsList(username);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ skills }));
      } catch (err) {
        console.error("❌ Lỗi get skills:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Record skill usage
  else if (req.method === 'POST' && req.url === '/use-skill') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username, skillId } = JSON.parse(body);
        recordSkillUsage(username, skillId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error("❌ Lỗi record skill:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Get skill cooldown
  else if (req.method === 'POST' && req.url === '/skill-cooldown') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username, skillId } = JSON.parse(body);
        const cooldownData = getSkillCooldown(username, skillId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ cooldownData }));
      } catch (err) {
        console.error("❌ Lỗi get cooldown:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Save farmed tile
  else if (req.method === 'POST' && req.url === '/save-farmed-tile') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { x, y } = JSON.parse(body);
        const success = saveFarmedTileData(x, y);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } catch (err) {
        console.error("❌ Lỗi save farmed tile:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Get all farmed tiles
  else if (req.method === 'GET' && req.url === '/get-farmed-tiles') {
    try {
      const tiles = getFarmedTiles();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tiles }));
    } catch (err) {
      console.error("❌ Lỗi get farmed tiles:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Delete farmed tile
  else if (req.method === 'POST' && req.url === '/delete-farmed-tile') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { x, y } = JSON.parse(body);
        const success = removeFarmedTile(x, y);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } catch (err) {
        console.error("❌ Lỗi delete farmed tile:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Get all crop types
  else if (req.method === 'GET' && req.url === '/get-crop-types') {
    try {
      const cropTypes = getCropTypes();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cropTypes }));
    } catch (err) {
      console.error("❌ Lỗi get crop types:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Plant a crop
  else if (req.method === 'POST' && req.url === '/plant-crop') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { x, y, cropTypeId } = JSON.parse(body);
        const success = plantCropData(x, y, cropTypeId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } catch (err) {
        console.error("❌ Lỗi plant crop:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Get all planted crops
  else if (req.method === 'GET' && req.url === '/get-planted-crops') {
    try {
      const crops = getPlantedCrops();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ crops }));
    } catch (err) {
      console.error("❌ Lỗi get planted crops:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Harvest a crop
  else if (req.method === 'POST' && req.url === '/harvest-crop') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { x, y } = JSON.parse(body);
        const success = harvestCropData(x, y);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } catch (err) {
        console.error("❌ Lỗi harvest crop:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Endpoint để nhận dữ liệu va chạm từ Editor
  else if (req.method === 'POST' && req.url === '/save-collision') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const filePath = path.join(__dirname, 'public/assets/Object/collision_data.json');

        // Đọc file hiện tại nếu tồn tại
        let existingData = {};
        if (fs.existsSync(filePath)) {
          const existingContent = fs.readFileSync(filePath, 'utf8');
          if (existingContent.trim()) {
            existingData = JSON.parse(existingContent);
          }
        }

        // Merge data mới với data cũ (deep merge)
        const newData = JSON.parse(body);
        const mergedData = { ...existingData };

        for (let path in newData) {
          const newEntry = newData[path];
          const existingEntry = existingData[path];

          // Nếu entry cũ là array (format cũ) và entry mới là object (format mới)
          // Chuyển array cũ sang object format
          if (Array.isArray(existingEntry) && typeof newEntry === 'object' && newEntry !== null) {
            mergedData[path] = {
              normal: existingEntry,
              z_index_up: newEntry.z_index_up || [],
              z_index_down: newEntry.z_index_down || []
            };
            // Merge normal data nếu có
            if (newEntry.normal && newEntry.normal.length > 0) {
              mergedData[path].normal = newEntry.normal;
            }
          }
          // Nếu cả 2 đều là object format, merge từng field
          else if (typeof existingEntry === 'object' && existingEntry !== null && typeof newEntry === 'object' && newEntry !== null) {
            mergedData[path] = {
              normal: newEntry.normal || existingEntry.normal || [],
              z_index_up: newEntry.z_index_up || existingEntry.z_index_up || [],
              z_index_down: newEntry.z_index_down || existingEntry.z_index_down || []
            };
          }
          // Nếu không có entry cũ hoặc entry mới là array, dùng entry mới
          else {
            mergedData[path] = newEntry;
          }
        }

        // Ghi lại file đã merge
        fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2));
        console.log("✅ Đã deep merge và lưu va chạm vào:", filePath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Saved successfully' }));
      } catch (err) {
        console.error("❌ Lỗi lưu file:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Endpoint để lưu map từ Map Editor
  else if (req.method === 'POST' && req.url === '/save-map') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const mapData = JSON.parse(body);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `map_${timestamp}.json`;
        const filePath = path.join(__dirname, 'public/assets/Map', fileName);
        
        fs.writeFileSync(filePath, JSON.stringify(mapData, null, 2));
        console.log("✅ Đã lưu map vào:", filePath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Map saved successfully', fileName }));
      } catch (err) {
        console.error("❌ Lỗi lưu map:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Endpoint để lưu submap (map con)
  else if (req.method === 'POST' && req.url === '/save-submap') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const submapData = JSON.parse(body);
        const fileName = `${submapData.name}.json`;
        const dirPath = path.join(__dirname, 'public/assets/Map/MapCon');
        
        // Create MapCon directory if it doesn't exist
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        
        const filePath = path.join(dirPath, fileName);
        fs.writeFileSync(filePath, JSON.stringify(submapData, null, 2));
        console.log("✅ Đã lưu submap vào:", filePath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Submap saved successfully', fileName }));
      } catch (err) {
        console.error("❌ Lỗi lưu submap:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Endpoint để lấy danh sách submaps
  else if (req.method === 'GET' && req.url === '/get-submaps') {
    try {
      const dirPath = path.join(__dirname, 'public/assets/Map/MapCon');
      
      if (!fs.existsSync(dirPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ submaps: [] }));
        return;
      }
      
      const files = fs.readdirSync(dirPath);
      const submaps = files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(dirPath, file);
          const content = fs.readFileSync(filePath, 'utf8');
          return JSON.parse(content);
        });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ submaps }));
    } catch (err) {
      console.error("❌ Lỗi get submaps:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Endpoint để lấy tất cả ảnh từ thư mục Map2
  else if (req.method === 'GET' && req.url === '/get-map2-tiles') {
    try {
      const dirPath = path.join(__dirname, 'public/assets/Map/Map2');
      
      if (!fs.existsSync(dirPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tiles: [] }));
        return;
      }
      
      const files = fs.readdirSync(dirPath);
      const tiles = files
        .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
        .map(file => `/assets/Map/Map2/${file}`);
      
      console.log(`✅ Found ${tiles.length} tiles in Map2 folder`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tiles }));
    } catch (err) {
      console.error("❌ Lỗi get map2 tiles:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Endpoint để lưu worldmap (map tổng)
  else if (req.method === 'POST' && req.url === '/save-worldmap') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const worldmapData = JSON.parse(body);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `worldmap_${timestamp}.json`;
        const filePath = path.join(__dirname, 'public/assets/Map', fileName);
        
        fs.writeFileSync(filePath, JSON.stringify(worldmapData, null, 2));
        console.log("✅ Đã lưu worldmap vào:", filePath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Worldmap saved successfully', fileName }));
      } catch (err) {
        console.error("❌ Lỗi lưu worldmap:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  else {
    res.writeHead(404);
    res.end();
  }
});
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  // Chỉ khi người chơi nhấn nút "Tạo nhân vật" (gửi newPlayer)
  socket.on("newPlayer", (playerData) => {
    // 1. Lưu dữ liệu người chơi mới với stats
    players[socket.id] = {
      ...playerData,
      stats: playerData.stats || {
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        moveSpeed: 4
      }
    };
    
    // 2. Gửi danh sách TẤT CẢ người chơi hiện tại cho người chơi MỚI này
    socket.emit("currentPlayers", players);

    // 3. Thông báo cho những người chơi CŨ biết có người MỚI tham gia
    socket.broadcast.emit("newPlayer", { id: socket.id, ...players[socket.id] });
    
    console.log(`Player ${playerData.name} (${socket.id}) joined the game.`);
  });

  // Cập nhật vị trí (chỉ movement, không có attack)
  socket.on("playerMovement", (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].dir = movementData.dir;
      players[socket.id].isMoving = movementData.isMoving;
      players[socket.id].name = movementData.name; 
      socket.broadcast.emit("playerMoved", { id: socket.id, ...players[socket.id] });
    }
  });

  // Event riêng cho tấn công — broadcast ngay lập tức, đảm bảo không bị mất
  socket.on("playerAttack", (attackData) => {
    if (players[socket.id]) {
      players[socket.id].dir = attackData.dir; // cập nhật hướng
      console.log(`Player ${players[socket.id].name} attacks facing ${attackData.dir}`);
      socket.broadcast.emit("playerAttack", { id: socket.id, dir: attackData.dir });
    }
  });

  // Event riêng cho kỹ năng (skill) — broadcast với tọa độ mục tiêu
  socket.on("playerSkill", (skillData) => {
    if (players[socket.id]) {
      console.log(`Player ${players[socket.id].name} uses skill at (${skillData.targetX}, ${skillData.targetY})`);
      socket.broadcast.emit("playerSkill", { 
        id: socket.id, 
        targetX: skillData.targetX, 
        targetY: skillData.targetY 
      });
    }
  });

  // Event riêng cho đào đất (dig) — broadcast với vị trí và hướng
  socket.on("playerDig", (digData) => {
    if (players[socket.id]) {
      console.log(`Player ${players[socket.id].name} digs at (${digData.x}, ${digData.y}) facing ${digData.dir}`);
      socket.broadcast.emit("playerDig", { 
        id: socket.id, 
        x: digData.x, 
        y: digData.y,
        dir: digData.dir
      });
    }
  });

  // Event riêng cho trồng cây (seeding) — broadcast với vị trí, hướng và loại cây
  socket.on("playerSeed", (seedData) => {
    if (players[socket.id]) {
      console.log(`Player ${players[socket.id].name} plants ${seedData.cropName} at (${seedData.x}, ${seedData.y}) facing ${seedData.dir}`);
      socket.broadcast.emit("playerSeed", { 
        id: socket.id, 
        x: seedData.x, 
        y: seedData.y,
        dir: seedData.dir,
        cropTypeId: seedData.cropTypeId,
        cropName: seedData.cropName
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    if (players[socket.id]) {
      const saved = saveCurrentPlayerState(players[socket.id]);
      if (saved) {
        console.log(`Saved position for ${players[socket.id].name}: (${players[socket.id].x}, ${players[socket.id].y})`);
      }
    }
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket Server is running on port ${PORT}`);
});
