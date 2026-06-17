export async function up(db) {
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
}

export async function down(db) {
  db.run(`DROP TABLE IF EXISTS access_codes`);
}
