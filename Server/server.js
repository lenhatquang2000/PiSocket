import { Server } from "socket.io";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { initDatabase } from './database.js';
import { checkAccount, createNewAccount, getSavedPlayerState, saveCurrentPlayerState, validateUsername, getPlayerSkillsList, recordSkillUsage, getSkillCooldown, saveFarmedTileData, getFarmedTiles, removeFarmedTile, clearFarmedTiles, getCropTypes, plantCropData, getPlantedCrops, harvestCropData, removePlantedCrop, saveObjectColliderDataByType, getObjectColliderDataByType, getAllObjectColliderDataByType, verifyAccessCodeLogin, setAccountAuthLevel, getUserAuthLevel, generateAccessCode, listAccessCodes, revokeAccessCode, getNPCs, addNPC, moveNPC, registerNewUser, loginExistingUser, getPlayersForUser, createNewPlayer, deleteExistingPlayer } from './playerManager.js';
import { checkMovement, getCollidableObjectsFromChunk } from './collisionSystem.js';

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

  console.log(`🤖 PNeural walking to (${pNeuralBot.targetX.toFixed(1)}, ${pNeuralBot.targetY.toFixed(1)}) dir: ${pNeuralBot.dir}`);

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

      console.log(`🤖 PNeural arrived at (${pNeuralBot.x.toFixed(1)}, ${pNeuralBot.y.toFixed(1)})`);
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
    
    // Get collidable objects from loaded chunks
    const collidableObjects = [];
    for (const [key, chunkData] of loadedChunks) {
      const chunkObjects = getCollidableObjectsFromChunk(chunkData);
      collidableObjects.push(...chunkObjects);
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
  // Register user
  else if (req.method === 'POST' && req.url === '/register') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        if (!username || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Thiếu Username hoặc Password' }));
          return;
        }
        const validation = validateUsername(username);
        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: validation.message }));
          return;
        }
        const result = registerNewUser(username.trim(), password);
        if (result.success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Username đã tồn tại' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Login user
  else if (req.method === 'POST' && req.url === '/login') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username, password } = JSON.parse(body);
        const user = loginExistingUser(username.trim(), password);
        if (user) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, userId: user.id, username: user.username }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Sai tài khoản hoặc mật khẩu' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Get players
  else if (req.method === 'POST' && req.url === '/get-players') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { userId } = JSON.parse(body);
        const playersList = getPlayersForUser(userId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, players: playersList }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Create player
  else if (req.method === 'POST' && req.url === '/create-player') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { userId, name, accessCode } = JSON.parse(body);
        const validation = validateUsername(name);
        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: validation.message }));
          return;
        }

        let authLevel = 'user';
        if (accessCode) {
          const verification = verifyAccessCodeLogin(accessCode);
          if (verification) {
            authLevel = verification.auth_level;
          }
        }

        const result = createNewPlayer(userId, name.trim(), authLevel);
        if (result.success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Tên nhân vật đã tồn tại' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Delete player
  else if (req.method === 'POST' && req.url === '/delete-player') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { userId, playerId } = JSON.parse(body);
        const success = deleteExistingPlayer(userId, playerId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Check if account exists
  else if (req.method === 'POST' && req.url === '/check-account') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { username, accessCode } = JSON.parse(body);
        const validation = validateUsername(username);
        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ exists: false, error: validation.message }));
          return;
        }

        const normalizedUsername = username.trim();
        const exists = checkAccount(normalizedUsername);
        const playerState = exists ? getSavedPlayerState(normalizedUsername) : null;

        // Nếu có access code, verify và set auth level
        let authLevel = 'user';
        if (accessCode) {
          const verification = verifyAccessCodeLogin(accessCode);
          if (verification) {
            authLevel = verification.auth_level;
            // Update account auth level nếu account đã tồn tại
            if (exists) {
              setAccountAuthLevel(normalizedUsername, authLevel);
            }
            console.log(`✅ Access code verified for ${normalizedUsername}: ${authLevel}`);
          } else {
            console.log(`⚠️ Invalid access code for ${normalizedUsername}`);
          }
        } else if (exists) {
          // Nếu không có access code, lấy auth level hiện tại
          authLevel = getUserAuthLevel(normalizedUsername);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists, playerState, authLevel }));
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
        const { username, accessCode } = JSON.parse(body);
        const validation = validateUsername(username);
        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: validation.message }));
          return;
        }

        const normalizedUsername = username.trim();
        const success = createNewAccount(normalizedUsername);

        // Nếu có access code hợp lệ, set auth level cho account mới
        let authLevel = 'user';
        if (success && accessCode) {
          const verification = verifyAccessCodeLogin(accessCode);
          if (verification) {
            authLevel = verification.auth_level;
            setAccountAuthLevel(normalizedUsername, authLevel);
            console.log(`✅ Account ${normalizedUsername} created with auth level: ${authLevel}`);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success, authLevel }));
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
  // Endpoint để lưu collider data theo object type ID
  else if (req.method === 'POST' && req.url === '/save-object-collider-data') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { objectTypeId, colliderData } = JSON.parse(body);
        const success = saveObjectColliderDataByType(objectTypeId, colliderData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success }));
      } catch (err) {
        console.error("❌ Lỗi save object collider data:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  }
  // Endpoint để lấy collider data theo object type ID
  else if (req.method === 'GET' && req.url.startsWith('/get-object-collider-data?')) {
    try {
      const urlParams = new URLSearchParams(req.url.split('?')[1]);
      const objectTypeId = urlParams.get('objectTypeId');
      const colliderData = getObjectColliderDataByType(objectTypeId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ colliderData }));
    } catch (err) {
      console.error("❌ Lỗi get object collider data:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Endpoint để lấy tất cả collider data theo object type ID
  else if (req.method === 'GET' && req.url === '/get-all-object-collider-data') {
    try {
      const allColliderData = getAllObjectColliderDataByType();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ allColliderData }));
    } catch (err) {
      console.error("❌ Lỗi get all object collider data:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Endpoint để nhận dữ liệu va chạm từ Editor
  else if (req.method === 'POST' && req.url === '/save-collision') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const filePath = path.join(rootDir, 'public/assets/Object/collision_data.json');

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
              z_index_down: newEntry.z_index_down || [],
              trigger_zone: newEntry.trigger_zone || []
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
              z_index_down: newEntry.z_index_down || existingEntry.z_index_down || [],
              trigger_zone: newEntry.trigger_zone || existingEntry.trigger_zone || []
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
        const filePath = path.join(rootDir, 'public/assets/Map', fileName);
        
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
        const dirPath = path.join(rootDir, 'public/assets/Map/MapCon');
        
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
      const dirPath = path.join(rootDir, 'public/assets/Map/MapCon');
      
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
  // Endpoint để lấy tất cả ảnh từ thư mục innerhouse
  else if (req.method === 'GET' && req.url === '/get-innerhouse-objects') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Object/innerhouse');
      
      if (!fs.existsSync(dirPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ objects: [] }));
        return;
      }
      
      const files = fs.readdirSync(dirPath);
      const objects = files
        .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
        .map(file => `/assets/Object/innerhouse/${file}`);
      
      console.log(`✅ Found ${objects.length} objects in innerhouse folder`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ objects }));
    } catch (err) {
      console.error("❌ Lỗi get innerhouse objects:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Endpoint để lấy tất cả ảnh từ thư mục Map2
  else if (req.method === 'GET' && req.url === '/get-map2-tiles') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Map/Map2');
      
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
  // Endpoint để lấy tất cả ảnh từ thư mục topdown
  else if (req.method === 'GET' && req.url === '/get-topdown-tiles') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Map/topdown');
      
      if (!fs.existsSync(dirPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tiles: [] }));
        return;
      }
      
      const files = fs.readdirSync(dirPath);
      const tiles = files
        .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
        .map(file => `/assets/Map/topdown/${file}`);
      
      console.log(`✅ Found ${tiles.length} tiles in topdown folder`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tiles }));
    } catch (err) {
      console.error("❌ Lỗi get topdown tiles:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Endpoint để lấy tất cả ảnh từ thư mục innerhouse
  else if (req.method === 'GET' && req.url === '/get-innerhouse-tiles') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Object/innerhouse');
      
      if (!fs.existsSync(dirPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tiles: [] }));
        return;
      }
      
      const files = fs.readdirSync(dirPath);
      const tiles = files
        .filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'))
        .map(file => `/assets/Object/innerhouse/${file}`);
      
      console.log(`✅ Found ${tiles.length} tiles in innerhouse folder`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ tiles }));
    } catch (err) {
      console.error("❌ Lỗi get innerhouse tiles:", err);
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
        const filePath = path.join(rootDir, 'public/assets/Map', fileName);
        
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
  // Endpoint để lấy worldmap mới nhất
  else if (req.method === 'GET' && req.url === '/get-latest-worldmap') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Map');
      const files = fs.readdirSync(dirPath);
      const worldmapFiles = files
        .filter(file => file.startsWith('worldmap_') && file.endsWith('.json'))
        .sort()
        .reverse(); // Lấy file mới nhất

      if (worldmapFiles.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No worldmap found' }));
        return;
      }

      const latestFile = worldmapFiles[0];
      const filePath = path.join(dirPath, latestFile);
      const content = fs.readFileSync(filePath, 'utf8');
      const worldmapData = JSON.parse(content);

      console.log(`✅ Loaded worldmap: ${latestFile}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ worldmap: worldmapData, fileName: latestFile }));
    } catch (err) {
      console.error("❌ Lỗi get worldmap:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Endpoint để lưu chunk binary file
  else if (req.method === 'POST' && req.url === '/save-chunk') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const chunkData = JSON.parse(body);
        const { chunkX, chunkY, width, height, tileSize, objects } = chunkData;
        
        // Register chunk for collision detection
        const chunkKey = `${chunkX},${chunkY}`;
        loadedChunks.set(chunkKey, chunkData);
        console.log(`📦 Chunk (${chunkX}, ${chunkY}) registered: ${objects.length} objects`);
        
        const chunkFileName = `chunk_${chunkX}_${chunkY}.bin`;
        const chunksDir = path.join(rootDir, 'public/assets/Map/chunks');
        
        // Create chunks directory if it doesn't exist
        if (!fs.existsSync(chunksDir)) {
          fs.mkdirSync(chunksDir, { recursive: true });
        }
        
        const chunkFilePath = path.join(chunksDir, chunkFileName);
        
        // Convert chunk data to binary format
        const buffer = [];
        
        function writeInt32(value) {
          const buf = Buffer.allocUnsafe(4);
          buf.writeInt32LE(value, 0);
          buffer.push(buf);
        }
        
        function writeFloat32(value) {
          const buf = Buffer.allocUnsafe(4);
          buf.writeFloatLE(value, 0);
          buffer.push(buf);
        }
        
        function writeUInt8(value) {
          const buf = Buffer.allocUnsafe(1);
          buf.writeUInt8(value, 0);
          buffer.push(buf);
        }
        
        function writeString(str) {
          const strBuf = Buffer.from(str, 'utf8');
          writeInt32(strBuf.length);
          buffer.push(strBuf);
        }
        
        // Write chunk metadata
        writeInt32(chunkX);
        writeInt32(chunkY);
        writeInt32(width);
        writeInt32(height);
        writeInt32(tileSize);
        writeInt32(objects.length);
        
        // Write objects
        objects.forEach((obj) => {
          writeInt32(obj.x);
          writeInt32(obj.y);
          writeString(obj.path);
          writeUInt8(obj.isFree ? 1 : 0);
          writeFloat32(obj.rotation || 0);
          writeFloat32(obj.scale || 1);
          writeInt32(obj.zIndex || 0);
        });
        
        // Combine all buffers
        const finalBuffer = Buffer.concat(buffer);
        
        // Write to file
        fs.writeFileSync(chunkFilePath, finalBuffer);
        
        console.log(`✅ Saved chunk (${chunkX}, ${chunkY}): ${chunkFileName} (${(finalBuffer.length / 1024).toFixed(2)} KB)`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          fileName: chunkFileName,
          size: `${(finalBuffer.length / 1024).toFixed(2)} KB`
        }));
      } catch (err) {
        console.error("❌ Lỗi save chunk:", err);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
  }
  // Auto-login endpoint cho PNeural - username "PNeural" - serve HTML
  else if (req.method === 'GET' && req.url === '/auto-login-neural') {
    try {
      const username = 'PNeural';
      const pNeuralCode = 'POPISUPREME2026';

      // Check if account exists
      const exists = checkAccount(username);
      let playerState = null;
      let authLevel = 'user';

      if (!exists) {
        // Create new account
        const success = createNewAccount(username);
        if (success) {
          // Set auth level với access code
          const verification = verifyAccessCodeLogin(pNeuralCode);
          if (verification) {
            authLevel = verification.auth_level;
            setAccountAuthLevel(username, authLevel);
            console.log(`✅ Auto-created PNeural account with auth level: ${authLevel}`);
          }
        }
      } else {
        // Account exists, get state and auth level
        playerState = getSavedPlayerState(username);
        authLevel = getUserAuthLevel(username);
        // Update auth level nếu chưa có
        if (authLevel === 'user') {
          const verification = verifyAccessCodeLogin(pNeuralCode);
          if (verification) {
            authLevel = verification.auth_level;
            setAccountAuthLevel(username, authLevel);
            console.log(`✅ Updated PNeural auth level to: ${authLevel}`);
          }
        }
      }

      if (!playerState && exists) {
        playerState = getSavedPlayerState(username);
      }

      console.log(`🤖 PNeural auto-login: ${username} (${authLevel})`);

      // Serve HTML với auto-login script
      const htmlContent = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>my-pixi-game - PNeural Auto-Login</title>
  </head>
  <body>
    <div id="app"></div>
    <script>
      // Auto-login data
      window.autoLoginData = {
        username: '${username}',
        authLevel: '${authLevel}',
        playerState: ${JSON.stringify(playerState)},
        autoLogin: true
      };
      // Load main game
      const script = document.createElement('script');
      script.type = 'module';
      script.src = '/src/main.js';
      document.body.appendChild(script);
    </script>
  </body>
</html>
      `;

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(htmlContent);
    } catch (err) {
      console.error("❌ Lỗi auto-login neural:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Get all NPCs
  else if (req.method === 'GET' && req.url === '/get-npcs') {
    try {
      const npcs = getNPCs();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ npcs }));
    } catch (err) {
      console.error("❌ Lỗi get NPCs:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Summon Neural to specific position
  else if (req.method === 'POST' && req.url === '/summon-neural') {
    try {
      const targetX = 2115;
      const targetY = 66;
      const success = moveNPC('PNeural', targetX, targetY, 'south');
      if (success) {
        console.log(`✅ Summoned PNeural to (${targetX}, ${targetY})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, x: targetX, y: targetY }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Failed to move NPC' }));
      }
    } catch (err) {
      console.error("❌ Lỗi summon neural:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  }
  // Tele Neural to player position
  else if (req.method === 'POST' && req.url === '/tele-neural-to-player') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { x, y, dir } = JSON.parse(body);
        pNeuralBot.x = x;
        pNeuralBot.y = y;
        pNeuralBot.dir = dir || 'south';
        pNeuralBot.isWalking = false;
        pNeuralBot.isMoving = false;

        // Lưu vào DB
        saveCurrentPlayerState(pNeuralBot.username, pNeuralBot.x, pNeuralBot.y, pNeuralBot.dir, pNeuralBot.stats.hp, pNeuralBot.stats.mp);

        // Emit cho tất cả clients
        io.emit('playerMoved', {
          id: 'pneural-bot',
          x: pNeuralBot.x,
          y: pNeuralBot.y,
          dir: pNeuralBot.dir,
          name: pNeuralBot.username,
          isMoving: false
        });

        console.log(`⚡ Teleported PNeural to (${x}, ${y})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, x, y }));
      } catch (err) {
        console.error("❌ Lỗi tele neural:", err);
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
