export async function up(db) {
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
}

export async function down(db) {
  db.run(`DROP TABLE IF EXISTS planted_crops`);
}
