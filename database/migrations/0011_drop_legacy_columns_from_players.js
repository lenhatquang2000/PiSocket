export async function up(db) {
  // 1. Update attributes for existing players using their legacy column values
  db.run(`
    UPDATE players 
    SET attributes = '{"hp":' || COALESCE(hp, 100) || 
                     ',"max_hp":' || COALESCE(max_hp, 100) || 
                     ',"mp":' || COALESCE(mp, 50) || 
                     ',"max_mp":' || COALESCE(max_mp, 50) || 
                     ',"walk_speed":' || COALESCE(move_speed, 4) || 
                     ',"run_speed":' || (COALESCE(move_speed, 4) * 1.5) || '}'
    WHERE hp IS NOT NULL OR max_hp IS NOT NULL OR mp IS NOT NULL OR max_mp IS NOT NULL OR move_speed IS NOT NULL
  `);

  // 2. Recreate players table without legacy columns to drop them safely in SQLite
  db.run(`
    CREATE TABLE players_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT UNIQUE NOT NULL,
      x REAL DEFAULT 500,
      y REAL DEFAULT 500,
      dir TEXT DEFAULT 'south',
      auth_level TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      attributes TEXT DEFAULT '{"hp":100,"mp":50,"walk_speed":4,"run_speed":6}',
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 3. Copy data to new table
  db.run(`
    INSERT INTO players_new (id, user_id, name, x, y, dir, auth_level, created_at, attributes)
    SELECT id, user_id, name, x, y, dir, auth_level, created_at, attributes FROM players
  `);

  // 4. Drop old table
  db.run(`DROP TABLE players`);

  // 5. Rename new table to players
  db.run(`ALTER TABLE players_new RENAME TO players`);
}

export async function down(db) {
  // Down migration is not strictly needed for this schema refactor,
  // but if we ever rollback we can keep it as is to prevent data loss.
}
