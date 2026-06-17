import { Server } from "socket.io";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { initDatabase } from './database.js';
import { getSavedPlayerState, saveCurrentPlayerState } from './playerManager.js';
import { checkMovement, getCollidableObjectsFromChunk } from './collisionSystem.js';
import { handleRoutes } from './route/web.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

const players = {};

// Server-Authoritative Movement System
const TICK_RATE = 30; // 30 ticks per second
const TICK_INTERVAL = 1000 / TICK_RATE; // ~33.33ms per tick
const PLAYER_SPEED = 4; // pixels per tick (server-controlled speed)

// Player input states (chỉ lưu input, không lưu vị trí)
const playerInputs = {}; // { socketId: { direction: 'north' | 'south' | ... | null } }

// Loaded chunks for collision detection
const loadedChunks = new Map(); // Map<"x,y", chunkData>

// PNeural AI Bot - Virtual Player
const pNeuralBot = {
  username: 'PNeural',
  x: 500,
  y: 500,
  dir: 'south',
  isMoving: false,
  isAttacking: false,
  stats: { hp: 100, maxHp: 100, mp: 50, maxMp: 50, moveSpeed: 4 },
  isWalking: false,
  targetX: 500,
  targetY: 500
};

// PNeural AI Walk Around Logic
const pNeuralWalkAround = () => {
  if (pNeuralBot.isWalking) return;

  const currentX = pNeuralBot.x;
  const currentY = pNeuralBot.y;

  // Random tọa độ trong phạm vi 100 pixel
  const randomOffsetX = (Math.random() - 0.5) * 200;
  const randomOffsetY = (Math.random() - 0.5) * 200;

  pNeuralBot.targetX = currentX + randomOffsetX;
  pNeuralBot.targetY = currentY + randomOffsetY;

  // Xác định hướng đi dựa trên angle (8 hướng)
  const angle = Math.atan2(randomOffsetY, randomOffsetX);
  const angleDeg = angle * (180 / Math.PI);

  if (angleDeg >= -22.5 && angleDeg < 22.5) pNeuralBot.dir = 'east';
  else if (angleDeg >= 22.5 && angleDeg < 67.5) pNeuralBot.dir = 'south-east';
  else if (angleDeg >= 67.5 && angleDeg < 112.5) pNeuralBot.dir = 'south';
  else if (angleDeg >= 112.5 && angleDeg < 157.5) pNeuralBot.dir = 'south-west';
  else if (angleDeg >= 157.5 || angleDeg < -157.5) pNeuralBot.dir = 'west';
  else if (angleDeg >= -157.5 && angleDeg < -112.5) pNeuralBot.dir = 'north-west';
  else if (angleDeg >= -112.5 && angleDeg < -67.5) pNeuralBot.dir = 'north';
  else if (angleDeg >= -67.5 && angleDeg < -22.5) pNeuralBot.dir = 'north-east';

  pNeuralBot.isWalking = true;
  pNeuralBot.isMoving = true;

  // Di chuyển từng frame
  const moveStep = () => {
    const dx = pNeuralBot.targetX - pNeuralBot.x;
    const dy = pNeuralBot.targetY - pNeuralBot.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 1) {
      // Đã đến đích
      pNeuralBot.isWalking = false;
      pNeuralBot.isMoving = false;
      pNeuralBot.x = pNeuralBot.targetX;
      pNeuralBot.y = pNeuralBot.targetY;

      // Lưu position vào DB
      saveCurrentPlayerState(pNeuralBot.username, pNeuralBot.x, pNeuralBot.y, pNeuralBot.dir, pNeuralBot.stats.hp, pNeuralBot.stats.mp);

      // Emit final position với isMoving = false để client chuyển về idle animation
      io.emit('playerMoved', {
        id: 'pneural-bot',
        x: pNeuralBot.x,
        y: pNeuralBot.y,
        dir: pNeuralBot.dir,
        name: pNeuralBot.username,
        isMoving: false
      });
    } else {
      // Tiếp tục di chuyển
      const speed = 2;
      pNeuralBot.x += (dx / distance) * speed;
      pNeuralBot.y += (dy / distance) * speed;

      // Emit position update cho tất cả clients
      io.emit('playerMoved', {
        id: 'pneural-bot',
        x: pNeuralBot.x,
        y: pNeuralBot.y,
        dir: pNeuralBot.dir,
        name: pNeuralBot.username,
        isMoving: true
      });

      setTimeout(moveStep, 16); // ~60fps
    }
  };

  moveStep();
};

// Load PNeural state từ DB khi server khởi động
const loadPNeuralState = () => {
  const state = getSavedPlayerState('PNeural');
  if (state) {
    pNeuralBot.x = state.x || 500;
    pNeuralBot.y = state.y || 500;
    pNeuralBot.dir = state.dir || 'south';
    pNeuralBot.stats.hp = state.hp || 100;
    pNeuralBot.stats.maxHp = state.max_hp || 100;
    pNeuralBot.stats.mp = state.mp || 50;
    pNeuralBot.stats.maxMp = state.max_mp || 50;
    console.log(`✅ Loaded PNeural state: (${pNeuralBot.x}, ${pNeuralBot.y})`);
  }
};

await initDatabase();
loadPNeuralState();

// Bắt đầu AI Walk Around mỗi 5s
setInterval(() => {
  pNeuralWalkAround();
}, 5000);

// ============================================
// SERVER TICK SYSTEM - 30 ticks per second
// ============================================
setInterval(() => {
  // Process all player movements based on their input
  for (const socketId in playerInputs) {
    const input = playerInputs[socketId];
    const player = players[socketId];
    
    if (!player || !input) {
      continue;
    }
    
    // Check if player has direction input
    if (!input.direction) {
      player.isMoving = false;
      continue;
    }
    
    // Calculate movement based on direction (8-directional)
    let dx = 0;
    let dy = 0;
    
    switch (input.direction) {
      case 'north':
        dy = -PLAYER_SPEED;
        break;
      case 'south':
        dy = PLAYER_SPEED;
        break;
      case 'east':
        dx = PLAYER_SPEED;
        break;
      case 'west':
        dx = -PLAYER_SPEED;
        break;
      case 'north-east':
        dx = PLAYER_SPEED * 0.707;
        dy = -PLAYER_SPEED * 0.707;
        break;
      case 'north-west':
        dx = -PLAYER_SPEED * 0.707;
        dy = -PLAYER_SPEED * 0.707;
        break;
      case 'south-east':
        dx = PLAYER_SPEED * 0.707;
        dy = PLAYER_SPEED * 0.707;
        break;
      case 'south-west':
        dx = -PLAYER_SPEED * 0.707;
        dy = PLAYER_SPEED * 0.707;
        break;
    }
    
    // Calculate new position
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    // Get collidable objects from chunks around player (loadRadius = 2)
    const collidableObjects = [];
    const chunkSize = 20;
    const tileSize = 30;
    const chunkWidth = chunkSize * tileSize;
    const playerChunkX = Math.floor(player.x / chunkWidth);
    const playerChunkY = Math.floor(player.y / chunkWidth);
    const loadRadius = 2;

    for (let dx = -loadRadius; dx <= loadRadius; dx++) {
      for (let dy = -loadRadius; dy <= loadRadius; dy++) {
        const cx = playerChunkX + dx;
        const cy = playerChunkY + dy;
        const chunkKey = `${cx},${cy}`;
        const chunkData = loadedChunks.get(chunkKey);
        if (chunkData) {
          const chunkObjects = getCollidableObjectsFromChunk(chunkData);
          collidableObjects.push(...chunkObjects);
        }
      }
    }
    
    // Check collision and get valid position
    const movementResult = checkMovement(
      { x: player.x, y: player.y, scale: 0.7 },
      newX,
      newY,
      collidableObjects
    );
    
    // Update player position (with collision)
    const oldX = player.x;
    const oldY = player.y;
    player.x = movementResult.validX;
    player.y = movementResult.validY;
    player.dir = input.direction;
    
    // Only set isMoving if player actually moved
    player.isMoving = (player.x !== oldX || player.y !== oldY);
    
    // Update z-index triggers (objects player should be above)
    player.zIndexTriggers = movementResult.zIndexTriggers || [];
    
    // Log z-index triggers (only when changed)
    if (player.zIndexTriggers.length > 0 && !player.lastZIndexTriggerCount) {
      console.log(`🎨 Player ${player.name} triggered z-index: ${player.zIndexTriggers.length} objects`);
      player.lastZIndexTriggerCount = player.zIndexTriggers.length;
    } else if (player.zIndexTriggers.length === 0 && player.lastZIndexTriggerCount) {
      console.log(`🎨 Player ${player.name} left z-index trigger zone`);
      player.lastZIndexTriggerCount = 0;
    }
  }
  
  // Broadcast updated positions to all clients
  const playerStates = {};
  for (const socketId in players) {
    const player = players[socketId];
    playerStates[socketId] = {
      x: player.x,
      y: player.y,
      dir: player.dir,
      isMoving: player.isMoving,
      name: player.name,
      zIndexTriggers: player.zIndexTriggers || []
    };
  }
  
  // Only broadcast if there are players
  if (Object.keys(playerStates).length > 0) {
    io.emit('serverTick', playerStates);
  }
}, TICK_INTERVAL);

console.log(`🎮 Server tick system started: ${TICK_RATE} ticks/second`);


const server = http.createServer((req, res) => {
  handleRoutes(req, res, { rootDir, players, loadedChunks, pNeuralBot, io });
});
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  // Client debug logs listener
  socket.on("client-debug-log", (data) => {
    console.log(`[CLIENT ${socket.id}] ${data.message}`);
  });

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
    
    // Initialize player input state
    playerInputs[socket.id] = {
      direction: null // null = not moving
    };

    // Gửi PNeural bot cho client sau khi họ đã join game
    socket.emit('newPlayer', {
      id: 'pneural-bot',
      x: pNeuralBot.x,
      y: pNeuralBot.y,
      dir: pNeuralBot.dir,
      isMoving: pNeuralBot.isMoving,
      isAttacking: pNeuralBot.isAttacking,
      name: pNeuralBot.username,
      stats: pNeuralBot.stats
    });
    
    // 2. Gửi danh sách TẤT CẢ người chơi hiện tại cho người chơi MỚI này
    socket.emit("currentPlayers", players);

    // 3. Thông báo cho những người chơi CŨ biết có người MỚI tham gia
    socket.broadcast.emit("newPlayer", { id: socket.id, ...players[socket.id] });
    
    console.log(`Player ${playerData.name} (${socket.id}) joined the game.`);
  });

  // ============================================
  // NEW: Player Input System (chỉ gửi hướng di chuyển)
  // ============================================
  socket.on("playerInput", (inputData) => {
    if (playerInputs[socket.id]) {
      // Client chỉ gửi direction: 'north' | 'south' | 'east' | 'west' | 'north-east' | ... | null
      playerInputs[socket.id].direction = inputData.direction;
      
      // Update isMoving state
      if (players[socket.id]) {
        players[socket.id].isMoving = inputData.direction !== null;
      }
    }
  });

  // OLD: Cập nhật vị trí (DEPRECATED - giữ lại để tương thích ngược)
  socket.on("playerMovement", (movementData) => {
    // Không còn tin tưởng vị trí từ client nữa
    // Chỉ cập nhật direction và isMoving
    if (players[socket.id] && playerInputs[socket.id]) {
      playerInputs[socket.id].direction = movementData.isMoving ? movementData.dir : null;
      players[socket.id].dir = movementData.dir;
      players[socket.id].isMoving = movementData.isMoving;
      players[socket.id].name = movementData.name;
      // Không broadcast vị trí nữa - server tick sẽ lo
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
    delete playerInputs[socket.id]; // Clean up input state
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket Server is running on port ${PORT}`);
});
