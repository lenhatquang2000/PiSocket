export async function up(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS crop_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      growth_time INTEGER DEFAULT 60,
      sprite_path TEXT NOT NULL
    )
  `);
}

export async function down(db) {
  db.run(`DROP TABLE IF EXISTS crop_types`);
}
