export async function run(db) {
  // PNeural user & player
  db.run(`
    INSERT OR IGNORE INTO users (id, username, password)
    VALUES (9999, 'PNeural', 'POPISUPREME2026')
  `);
  
  db.run(`
    INSERT OR IGNORE INTO players (id, user_id, name, x, y, dir, hp, max_hp, mp, max_mp, move_speed, auth_level)
    VALUES (9999, 9999, 'PNeural', 500, 500, 'south', 100, 100, 50, 50, 4, 'SUPREME_ADMIN')
  `);

  // Default access code
  db.run(`
    INSERT OR IGNORE INTO access_codes (code, username, auth_level)
    VALUES ('POPISUPREME2026', 'PoPi', 'SUPREME_ADMIN')
  `);
}
