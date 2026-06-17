export async function up(db) {
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
}

export async function down(db) {
  db.run(`DROP TABLE IF EXISTS npcs`);
}
