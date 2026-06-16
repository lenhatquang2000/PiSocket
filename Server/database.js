import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

let db;
const DB_PATH = path.join(rootDir, 'game_accounts.db');

export async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      x REAL DEFAULT 500,
      y REAL DEFAULT 500,
      dir TEXT DEFAULT 'south',
      hp INTEGER DEFAULT 100,
      max_hp INTEGER DEFAULT 100,
      mp INTEGER DEFAULT 50,
      max_mp INTEGER DEFAULT 50,
      move_speed REAL DEFAULT 4,
      auth_level TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  ensureColumn('accounts', 'x', 'REAL DEFAULT 500');
  ensureColumn('accounts', 'y', 'REAL DEFAULT 500');
  ensureColumn('accounts', 'dir', "TEXT DEFAULT 'south'");
  ensureColumn('accounts', 'hp', 'INTEGER DEFAULT 100');
  ensureColumn('accounts', 'max_hp', 'INTEGER DEFAULT 100');
  ensureColumn('accounts', 'mp', 'INTEGER DEFAULT 50');
  ensureColumn('accounts', 'max_mp', 'INTEGER DEFAULT 50');
  ensureColumn('accounts', 'move_speed', 'REAL DEFAULT 4');
  ensureColumn('accounts', 'auth_level', "TEXT DEFAULT 'user'");

  // Bảng access_codes - PNeural authentication system
  db.run(`
    CREATE TABLE IF NOT EXISTS access_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      auth_level TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1
    )
  `);
  
  // Bảng skills
  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
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
  `);

  // Bảng farmed_tiles - Lưu trữ các ô đất đã đào
  db.run(`
    CREATE TABLE IF NOT EXISTS farmed_tiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      x REAL NOT NULL,
      y REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(x, y)
    )
  `);

  // Bảng crop_types - Lưu trữ các loại cây trồng
  db.run(`
    CREATE TABLE IF NOT EXISTS crop_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      growth_time INTEGER DEFAULT 60,
      sprite_path TEXT NOT NULL
    )
  `);

  // Bảng planted_crops - Lưu trữ cây đã trồng
  db.run(`
    CREATE TABLE IF NOT EXISTS planted_crops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      x REAL NOT NULL,
      y REAL NOT NULL,
      crop_type_id INTEGER NOT NULL,
      planted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      harvested BOOLEAN DEFAULT 0,
      FOREIGN KEY (crop_type_id) REFERENCES crop_types(id),
      UNIQUE(x, y)
    )
  `);

  // Bảng object_collider_data - Lưu trữ collider data theo object type ID
  db.run(`
    CREATE TABLE IF NOT EXISTS object_collider_data (
      object_type_id TEXT PRIMARY KEY,
      normal TEXT,
      z_index_up TEXT,
      z_index_down TEXT,
      trigger_zone TEXT
    )
  `);

  // Bảng npcs - Lưu trữ NPCs
  db.run(`
    CREATE TABLE IF NOT EXISTS npcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      dir TEXT DEFAULT 'south',
      sprite_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Thêm dữ liệu mẫu cho crop_types (chỉ thêm nếu chưa có)
  db.run(`
    INSERT OR IGNORE INTO crop_types (name, display_name, growth_time, sprite_path)
    VALUES ('rice', 'Lúa', 60, '/assets/Crops/rice.png')
  `);

  // Tạo access code mặc định cho PNeural/PoPi (SUPREME_ADMIN)
  const pNeuralCode = 'POPISUPREME2026';
  db.run(`
    INSERT OR IGNORE INTO access_codes (code, username, auth_level)
    VALUES (?, 'PoPi', 'SUPREME_ADMIN')
  `, [pNeuralCode]);

  // Tạo account PNeural như một player thật
  db.run(`
    INSERT OR IGNORE INTO accounts (username, x, y, dir, hp, max_hp, mp, max_mp, move_speed, auth_level)
    VALUES ('PNeural', 500, 500, 'south', 100, 100, 50, 50, 4, 'SUPREME_ADMIN')
  `);

  // Xóa NPC PNeural cũ nếu có
  db.run(`DELETE FROM npcs WHERE name = 'PNeural'`);

  saveDatabase();

  console.log(`✅ PNeural access code created: ${pNeuralCode}`);
  console.log(`✅ PNeural account created as player (500, 500)`);
  
  console.log("✅ SQLite database initialized");
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function ensureColumn(tableName, columnName, columnDefinition) {
  const result = db.exec(`PRAGMA table_info(${tableName})`);
  const columns = result[0]?.values?.map(row => row[1]) || [];
  if (!columns.includes(columnName)) {
    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
  }
}

// Check if username exists
export function accountExists(username) {
  const stmt = db.prepare('SELECT id FROM accounts WHERE username = ?');
  stmt.bind([username]);
  const result = stmt.step();
  stmt.free();
  return result;
}

// Create new account
export function createAccount(username) {
  const stmt = db.prepare('INSERT INTO accounts (username, x, y, dir, hp, max_hp, mp, max_mp, move_speed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  try {
    stmt.run([username, 500, 500, 'south', 100, 100, 50, 50, 4]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function getPlayerState(username) {
  const stmt = db.prepare('SELECT username, x, y, dir, hp, max_hp, mp, max_mp, move_speed FROM accounts WHERE username = ?');
  stmt.bind([username]);
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return result;
}

export function savePlayerState(username, x, y, dir, hp, mp) {
  const stmt = db.prepare('UPDATE accounts SET x = ?, y = ?, dir = ?, hp = ?, mp = ? WHERE username = ?');
  try {
    stmt.run([x, y, dir, hp, mp, username]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

// Get all accounts
export function getAllAccounts() {
  const stmt = db.prepare('SELECT * FROM accounts ORDER BY created_at DESC');
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// --- SKILL MANAGEMENT ---
export function initializePlayerSkills(username) {
  // Thêm skill mặc định cho player mới
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO skills (username, skill_id, skill_name, skill_type, frames_path, frame_count, animation_speed, cooldown_time, mp_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  try {
    stmt.run([username, 1, 'Fireball', 'fireball', '/assets/Skills/Explosion/frame_', 16, 0.3, 5.0, 10]);
    stmt.run([username, 2, 'Farming', 'farming', '/assets/A_cute_chibi_anime_girl/animations/dig/', 9, 0.15, 2.0, 5]);
    stmt.run([username, 3, 'Seeding', 'seeding', '/assets/A_cute_chibi_anime_girl/animations/seeding/', 9, 0.15, 2.0, 3]);
    stmt.run([username, 4, 'Sleep', 'sleep', '/assets/A_cute_chibi_anime_girl/animations/sleep/', 9, 0.2, 1.0, 0]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function getPlayerSkills(username) {
  const stmt = db.prepare(`
    SELECT skill_id, skill_name, skill_type, frames_path, frame_count, animation_speed, cooldown_time, mp_cost, last_used
    FROM skills
    WHERE username = ?
    ORDER BY skill_id
  `);
  stmt.bind([username]);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function updateSkillLastUsed(username, skillId) {
  const stmt = db.prepare(`
    UPDATE skills
    SET last_used = CURRENT_TIMESTAMP
    WHERE username = ? AND skill_id = ?
  `);
  try {
    stmt.run([username, skillId]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function getSkillCooldownRemaining(username, skillId) {
  const stmt = db.prepare(`
    SELECT 
      cooldown_time,
      CAST((julianday('now') - julianday(last_used)) * 86400 AS REAL) as seconds_elapsed
    FROM skills
    WHERE username = ? AND skill_id = ?
  `);
  stmt.bind([username, skillId]);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

// --- FARMED TILES MANAGEMENT ---
export function saveFarmedTile(x, y) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO farmed_tiles (x, y)
    VALUES (?, ?)
  `);
  try {
    stmt.run([x, y]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function getAllFarmedTiles() {
  const stmt = db.prepare(`
    SELECT x, y, created_at
    FROM farmed_tiles
    ORDER BY created_at ASC
  `);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function deleteFarmedTile(x, y) {
  const stmt = db.prepare(`
    DELETE FROM farmed_tiles
    WHERE x = ? AND y = ?
  `);
  try {
    stmt.run([x, y]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function clearAllFarmedTiles() {
  const stmt = db.prepare(`DELETE FROM farmed_tiles`);
  try {
    stmt.run([]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

// --- OBJECT COLLIDER DATA MANAGEMENT ---
export function saveObjectColliderData(objectTypeId, colliderData) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO object_collider_data (object_type_id, normal, z_index_up, z_index_down, trigger_zone)
    VALUES (?, ?, ?, ?, ?)
  `);
  try {
    stmt.run([
      objectTypeId,
      JSON.stringify(colliderData.normal || []),
      JSON.stringify(colliderData.z_index_up || []),
      JSON.stringify(colliderData.z_index_down || []),
      JSON.stringify(colliderData.trigger_zone || [])
    ]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    console.error("❌ Lỗi save object collider data:", err);
    return false;
  }
}

export function getObjectColliderData(objectTypeId) {
  const stmt = db.prepare(`
    SELECT normal, z_index_up, z_index_down, trigger_zone
    FROM object_collider_data
    WHERE object_type_id = ?
  `);
  try {
    stmt.bind([objectTypeId]);
    if (stmt.step()) {
      const result = stmt.getAsObject();
      stmt.free();
      return {
        normal: JSON.parse(result.normal || '[]'),
        z_index_up: JSON.parse(result.z_index_up || '[]'),
        z_index_down: JSON.parse(result.z_index_down || '[]'),
        trigger_zone: JSON.parse(result.trigger_zone || '[]')
      };
    }
    stmt.free();
    return null;
  } catch (err) {
    stmt.free();
    console.error("❌ Lỗi get object collider data:", err);
    return null;
  }
}

export function getAllObjectColliderData() {
  const stmt = db.prepare(`
    SELECT object_type_id, normal, z_index_up, z_index_down, trigger_zone
    FROM object_collider_data
  `);
  const results = {};
  while (stmt.step()) {
    const result = stmt.getAsObject();
    results[result.object_type_id] = {
      normal: JSON.parse(result.normal || '[]'),
      z_index_up: JSON.parse(result.z_index_up || '[]'),
      z_index_down: JSON.parse(result.z_index_down || '[]'),
      trigger_zone: JSON.parse(result.trigger_zone || '[]')
    };
  }
  stmt.free();
  return results;
}

// --- CROP TYPES MANAGEMENT ---
export function getAllCropTypes() {
  const stmt = db.prepare(`
    SELECT id, name, display_name, growth_time, sprite_path
    FROM crop_types
    ORDER BY id ASC
  `);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// --- PLANTED CROPS MANAGEMENT ---
export function plantCrop(x, y, cropTypeId) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO planted_crops (x, y, crop_type_id)
    VALUES (?, ?, ?)
  `);
  try {
    stmt.run([x, y, cropTypeId]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function getAllPlantedCrops() {
  const stmt = db.prepare(`
    SELECT 
      pc.id, pc.x, pc.y, pc.planted_at, pc.harvested, pc.crop_type_id,
      ct.name as crop_name, ct.display_name, ct.growth_time, ct.sprite_path
    FROM planted_crops pc
    JOIN crop_types ct ON pc.crop_type_id = ct.id
    WHERE pc.harvested = 0
    ORDER BY pc.planted_at ASC
  `);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function harvestCrop(x, y) {
  const stmt = db.prepare(`
    UPDATE planted_crops
    SET harvested = 1
    WHERE x = ? AND y = ? AND harvested = 0
  `);
  try {
    stmt.run([x, y]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function deletePlantedCrop(x, y) {
  const stmt = db.prepare(`
    DELETE FROM planted_crops
    WHERE x = ? AND y = ?
  `);
  try {
    stmt.run([x, y]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

// --- ACCESS CODES MANAGEMENT (PNeural Authentication) ---
export function createAccessCode(code, username, authLevel) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO access_codes (code, username, auth_level)
    VALUES (?, ?, ?)
  `);
  try {
    stmt.run([code, username, authLevel]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function verifyAccessCode(code) {
  const stmt = db.prepare(`
    SELECT username, auth_level, is_active
    FROM access_codes
    WHERE code = ? AND is_active = 1
  `);
  stmt.bind([code]);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

export function getAllAccessCodes() {
  const stmt = db.prepare(`
    SELECT code, username, auth_level, created_at, is_active
    FROM access_codes
    ORDER BY created_at DESC
  `);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function deactivateAccessCode(code) {
  const stmt = db.prepare(`
    UPDATE access_codes
    SET is_active = 0
    WHERE code = ?
  `);
  try {
    stmt.run([code]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function updateAccountAuthLevel(username, authLevel) {
  const stmt = db.prepare(`
    UPDATE accounts
    SET auth_level = ?
    WHERE username = ?
  `);
  try {
    stmt.run([authLevel, username]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function getAccountAuthLevel(username) {
  const stmt = db.prepare(`
    SELECT auth_level
    FROM accounts
    WHERE username = ?
  `);
  stmt.bind([username]);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result?.auth_level || 'user';
}

// --- NPC MANAGEMENT ---
export function getAllNPCs() {
  const stmt = db.prepare(`
    SELECT id, name, x, y, dir, sprite_path
    FROM npcs
    ORDER BY id ASC
  `);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function createNPC(name, x, y, dir, spritePath) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO npcs (name, x, y, dir, sprite_path)
    VALUES (?, ?, ?, ?, ?)
  `);
  try {
    stmt.run([name, x, y, dir, spritePath]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function updateNPCPosition(name, x, y, dir) {
  const stmt = db.prepare(`
    UPDATE npcs
    SET x = ?, y = ?, dir = ?
    WHERE name = ?
  `);
  try {
    stmt.run([x, y, dir, name]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}
