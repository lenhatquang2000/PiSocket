export async function up(db) {
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
      UNIQUE(username, skill_id)
    )
  `);
}

export async function down(db) {
  db.run(`DROP TABLE IF EXISTS skills`);
}
