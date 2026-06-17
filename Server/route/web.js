import fs from 'fs';
import path from 'path';
import { 
  validateUsername, 
  registerNewUser, 
  loginExistingUser, 
  getPlayersForUser, 
  verifyAccessCodeLogin, 
  createNewPlayer, 
  deleteExistingPlayer, 
  checkAccount, 
  getSavedPlayerState, 
  setAccountAuthLevel, 
  getUserAuthLevel, 
  getPlayerSkillsList, 
  recordSkillUsage, 
  getSkillCooldown, 
  saveFarmedTileData, 
  getFarmedTiles, 
  removeFarmedTile, 
  getCropTypes, 
  plantCropData, 
  getPlantedCrops, 
  harvestCropData, 
  saveObjectColliderDataByType, 
  getObjectColliderDataByType, 
  getAllObjectColliderDataByType, 
  getNPCs, 
  moveNPC, 
  saveCurrentPlayerState 
} from '../playerManager.js';
import { generateObjectControllers } from '../helper/objectControllerHelper.js';

export function handleRoutes(req, res, { rootDir, players, loadedChunks, pNeuralBot, io }) {
  // Log request for debugging
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);

  // Allow Editor from port 5173 to send data
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', playersCount: Object.keys(players).length }));
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
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
    return true;
  }
  // Save collider data by object type ID
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
    return true;
  }
  // Get collider data by object type ID
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
    return true;
  }
  // Get all collider data by object type ID
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
    return true;
  }
  // Save collision from Editor
  else if (req.method === 'POST' && req.url === '/save-collision') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const filePath = path.join(rootDir, 'public/assets/Object/collision_data.json');

        let existingData = {};
        if (fs.existsSync(filePath)) {
          const existingContent = fs.readFileSync(filePath, 'utf8');
          if (existingContent.trim()) {
            existingData = JSON.parse(existingContent);
          }
        }

        const newData = JSON.parse(body);
        
        generateObjectControllers(newData, rootDir);

        const mergedData = { ...existingData };

        for (let path in newData) {
          const newEntry = newData[path];
          const existingEntry = existingData[path];

          if (Array.isArray(existingEntry) && typeof newEntry === 'object' && newEntry !== null) {
            mergedData[path] = {
              normal: existingEntry,
              z_index_up: newEntry.z_index_up || [],
              z_index_down: newEntry.z_index_down || [],
              trigger_zone: newEntry.trigger_zone || []
            };
            if (newEntry.normal && newEntry.normal.length > 0) {
              mergedData[path].normal = newEntry.normal;
            }
          }
          else if (typeof existingEntry === 'object' && existingEntry !== null && typeof newEntry === 'object' && newEntry !== null) {
            mergedData[path] = {
              normal: newEntry.normal || existingEntry.normal || [],
              z_index_up: newEntry.z_index_up || existingEntry.z_index_up || [],
              z_index_down: newEntry.z_index_down || existingEntry.z_index_down || [],
              trigger_zone: newEntry.trigger_zone || existingEntry.trigger_zone || []
            };
          }
          else {
            mergedData[path] = newEntry;
          }
        }

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
    return true;
  }
  // Save map from Map Editor
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
    return true;
  }
  // Save submap
  else if (req.method === 'POST' && req.url === '/save-submap') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const submapData = JSON.parse(body);
        const fileName = `${submapData.name}.json`;
        const dirPath = path.join(rootDir, 'public/assets/Map/MapCon');
        
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
    return true;
  }
  // Get list of submaps
  else if (req.method === 'GET' && req.url === '/get-submaps') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Map/MapCon');
      
      if (!fs.existsSync(dirPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ submaps: [] }));
        return true;
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
    return true;
  }
  // Get all images from innerhouse folder
  else if (req.method === 'GET' && req.url === '/get-innerhouse-objects') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Object/innerhouse');
      
      if (!fs.existsSync(dirPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ objects: [] }));
        return true;
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
    return true;
  }
  // Get all images from Map2 folder
  else if (req.method === 'GET' && req.url === '/get-map2-tiles') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Map/Map2');
      
      if (!fs.existsSync(dirPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tiles: [] }));
        return true;
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
    return true;
  }
  // Get all images from topdown folder
  else if (req.method === 'GET' && req.url === '/get-topdown-tiles') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Map/topdown');
      
      if (!fs.existsSync(dirPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tiles: [] }));
        return true;
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
    return true;
  }
  // Get all images from innerhouse folder (tiles version)
  else if (req.method === 'GET' && req.url === '/get-innerhouse-tiles') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Object/innerhouse');
      
      if (!fs.existsSync(dirPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tiles: [] }));
        return true;
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
    return true;
  }
  // Save worldmap
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
    return true;
  }
  // Get latest worldmap
  else if (req.method === 'GET' && req.url === '/get-latest-worldmap') {
    try {
      const dirPath = path.join(rootDir, 'public/assets/Map');
      const files = fs.readdirSync(dirPath);
      const worldmapFiles = files
        .filter(file => file.startsWith('worldmap_') && file.endsWith('.json'))
        .sort()
        .reverse();

      if (worldmapFiles.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No worldmap found' }));
        return true;
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
    return true;
  }
  // Save chunk binary file
  else if (req.method === 'POST' && req.url === '/save-chunk') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const chunkData = JSON.parse(body);
        const { chunkX, chunkY, width, height, tileSize, objects } = chunkData;
        
        const chunkKey = `${chunkX},${chunkY}`;
        loadedChunks.set(chunkKey, chunkData);
        console.log(`📦 Chunk (${chunkX}, ${chunkY}) registered: ${objects.length} objects`);
        
        const chunkFileName = `chunk_${chunkX}_${chunkY}.bin`;
        const chunksDir = path.join(rootDir, 'public/assets/Map/chunks');
        
        if (!fs.existsSync(chunksDir)) {
          fs.mkdirSync(chunksDir, { recursive: true });
        }
        
        const chunkFilePath = path.join(chunksDir, chunkFileName);
        
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
        
        writeInt32(chunkX);
        writeInt32(chunkY);
        writeInt32(width);
        writeInt32(height);
        writeInt32(tileSize);
        writeInt32(objects.length);
        
        objects.forEach((obj) => {
          writeInt32(obj.x);
          writeInt32(obj.y);
          writeString(obj.path);
          writeUInt8(obj.isFree ? 1 : 0);
          writeFloat32(obj.rotation || 0);
          writeFloat32(obj.scale || 1);
          writeInt32(obj.zIndex || 0);
        });
        
        const finalBuffer = Buffer.concat(buffer);
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
    return true;
  }
  // Auto-login endpoint for PNeural
  else if (req.method === 'GET' && req.url === '/auto-login-neural') {
    try {
      const username = 'PNeural';
      const pNeuralCode = 'POPISUPREME2026';

      const exists = checkAccount(username);
      let playerState = null;
      let authLevel = 'user';

      if (!exists) {
        const success = createNewAccount(username);
        if (success) {
          const verification = verifyAccessCodeLogin(pNeuralCode);
          if (verification) {
            authLevel = verification.auth_level;
            setAccountAuthLevel(username, authLevel);
            console.log(`✅ Auto-created PNeural account with auth level: ${authLevel}`);
          }
        }
      } else {
        playerState = getSavedPlayerState(username);
        authLevel = getUserAuthLevel(username);
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
      window.autoLoginData = {
        username: '${username}',
        authLevel: '${authLevel}',
        playerState: ${JSON.stringify(playerState)},
        autoLogin: true
      };
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
    return true;
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
    return true;
  }
  // Summon Neural
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
    return true;
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

        saveCurrentPlayerState(pNeuralBot.username, pNeuralBot.x, pNeuralBot.y, pNeuralBot.dir, pNeuralBot.stats.hp, pNeuralBot.stats.mp);

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
    return true;
  }

  // Not handled by web.js
  return false;
}
