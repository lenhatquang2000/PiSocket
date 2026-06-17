export async function up(db) {
  db.run(`
    ALTER TABLE players ADD COLUMN attributes TEXT DEFAULT '{"hp":100,"mp":50,"walk_speed":4,"run_speed":6}'
  `);
}

export async function down(db) {
  // SQLite does not support ALTER TABLE DROP COLUMN easily in older versions, 
  // but we can leave down empty or drop/recreate table if needed.
  // We'll leave it empty to avoid data loss.
}
