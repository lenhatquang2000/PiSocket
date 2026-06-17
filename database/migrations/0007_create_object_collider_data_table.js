export async function up(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS object_collider_data (
      object_type_id TEXT PRIMARY KEY,
      normal TEXT,
      z_index_up TEXT,
      z_index_down TEXT,
      trigger_zone TEXT
    )
  `);
}

export async function down(db) {
  db.run(`DROP TABLE IF EXISTS object_collider_data`);
}
