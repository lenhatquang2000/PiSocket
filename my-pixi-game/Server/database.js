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
