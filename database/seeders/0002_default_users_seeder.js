export async function run(db) {
  // PNeural user & player
  db.run(`
    INSERT OR IGNORE INTO users (id, username, password)
    VALUES (9999, 'PNeural', 'POPISUPREME2026')
  `);
  
  db.run(`
    INSERT OR IGNORE INTO players (id, user_id, name, x, y, dir, attributes, auth_level)
    VALUES (9999, 9999, 'PNeural', 500, 500, 'south', '{"hp":100,"max_hp":100,"mp":50,"max_mp":50,"walk_speed":4,"run_speed":6}', 'SUPREME_ADMIN')
  `);

  // Default access code
  db.run(`
    INSERT OR IGNORE INTO access_codes (code, username, auth_level)
    VALUES ('POPISUPREME2026', 'PoPi', 'SUPREME_ADMIN')
  `);
}
