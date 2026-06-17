export async function up(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS farmed_tiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      x REAL NOT NULL,
      y REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(x, y)
    )
  `);
}

export async function down(db) {
  db.run(`DROP TABLE IF EXISTS farmed_tiles`);
}
