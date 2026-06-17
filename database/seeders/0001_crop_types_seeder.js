export async function run(db) {
  db.run(`
    INSERT OR IGNORE INTO crop_types (id, name, display_name, growth_time, sprite_path)
    VALUES (1, 'rice', 'Lúa', 60, '/assets/Crops/rice.png')
  `);
}
