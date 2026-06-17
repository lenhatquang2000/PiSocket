export async function up(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT UNIQUE NOT NULL,
      x REAL DEFAULT 500,
      y REAL DEFAULT 500,
      dir TEXT DEFAULT 'south',
      hp INTEGER DEFAULT 100,
      max_hp INTEGER DEFAULT 100,
      mp INTEGER DEFAULT 50,
      max_mp INTEGER DEFAULT 50,
      move_speed REAL DEFAULT 4,
      auth_level TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

export async function down(db) {
  db.run(`DROP TABLE IF EXISTS players`);
}
