import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.dirname(__dirname);

let db;
const DB_PATH = path.join(rootDir, 'database', 'Life4Dun.db');

import { migrate } from '../database/migrator.js';

export async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Run migrations & seeders
  await migrate(db);

  saveDatabase();
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

// Check if player name exists
export function accountExists(username) {
  const stmt = db.prepare('SELECT id FROM players WHERE name = ?');
  stmt.bind([username]);
  const result = stmt.step();
  stmt.free();
  return result;
}

// Create new account (for compatibility, creates player)
export function createAccount(username) {
  const stmt = db.prepare('INSERT INTO players (user_id, name, x, y, dir, hp, max_hp, mp, max_mp, move_speed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  try {
    stmt.run([1, username, 500, 500, 'south', 100, 100, 50, 50, 4]);
    stmt.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmt.free();
    return false;
  }
}

export function getPlayerState(username) {
  const stmt = db.prepare('SELECT name as username, x, y, dir, hp, max_hp, mp, max_mp, move_speed FROM players WHERE name = ?');
  stmt.bind([username]);
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return result;
}

export function savePlayerState(username, x, y, dir, hp, mp) {
  const stmt = db.prepare('UPDATE players SET x = ?, y = ?, dir = ?, hp = ?, mp = ? WHERE name = ?');
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

// Get all players
export function getAllAccounts() {
  const stmt = db.prepare('SELECT name as username, x, y, dir, hp, max_hp, mp, max_mp, move_speed, auth_level, created_at FROM players ORDER BY created_at DESC');
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// --- NEW USER & PLAYER AUTHENTICATION ---

export function registerUser(username, password) {
  const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
  try {
    stmt.run([username, password]);
    stmt.free();
    saveDatabase();
    return { success: true };
  } catch (err) {
    stmt.free();
    return { success: false, error: err.message };
  }
}

export function loginUser(username, password) {
  const stmt = db.prepare('SELECT id, username FROM users WHERE username = ? AND password = ?');
  stmt.bind([username, password]);
  let user = null;
  if (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();
  return user;
}

export function getPlayersByUserId(userId) {
  const stmt = db.prepare('SELECT id, name, x, y, dir, hp, max_hp, mp, max_mp, move_speed, auth_level FROM players WHERE user_id = ?');
  stmt.bind([userId]);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function createPlayer(userId, name, authLevel = 'user') {
  const stmt = db.prepare('INSERT INTO players (user_id, name, auth_level) VALUES (?, ?, ?)');
  try {
    stmt.run([userId, name, authLevel]);
    stmt.free();
    saveDatabase();
    return { success: true };
  } catch (err) {
    stmt.free();
    return { success: false, error: err.message };
  }
}

export function deletePlayer(userId, playerId) {
  const stmtPlayer = db.prepare('SELECT name FROM players WHERE id = ? AND user_id = ?');
  stmtPlayer.bind([playerId, userId]);
  let playerName = null;
  if (stmtPlayer.step()) {
    playerName = stmtPlayer.getAsObject().name;
  }
  stmtPlayer.free();

  if (!playerName) {
    return false;
  }

  // Delete skills associated with the player name
  const stmtSkills = db.prepare('DELETE FROM skills WHERE username = ?');
  try {
    stmtSkills.run([playerName]);
  } catch(e) {}
  stmtSkills.free();

  // Delete player
  const stmtDel = db.prepare('DELETE FROM players WHERE id = ? AND user_id = ?');
  try {
    stmtDel.run([playerId, userId]);
    stmtDel.free();
    saveDatabase();
    return true;
  } catch (err) {
    stmtDel.free();
    return false;
  }
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
