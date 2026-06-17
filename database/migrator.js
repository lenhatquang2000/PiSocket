import * as m1 from './migrations/0001_create_users_table.js';
import * as m2 from './migrations/0002_create_players_table.js';
import * as m3 from './migrations/0003_create_skills_table.js';
import * as m4 from './migrations/0004_create_farmed_tiles_table.js';
import * as m5 from './migrations/0005_create_crop_types_table.js';
import * as m6 from './migrations/0006_create_planted_crops_table.js';
import * as m7 from './migrations/0007_create_object_collider_data_table.js';
import * as m8 from './migrations/0008_create_npcs_table.js';
import * as m9 from './migrations/0009_create_access_codes_table.js';
import * as m10 from './migrations/0010_add_attributes_to_players_table.js';
import * as m11 from './migrations/0011_drop_legacy_columns_from_players.js';

import * as DatabaseSeeder from './seeders/DatabaseSeeder.js';

const migrationsList = [
  { name: '0001_create_users_table', module: m1 },
  { name: '0002_create_players_table', module: m2 },
  { name: '0003_create_skills_table', module: m3 },
  { name: '0004_create_farmed_tiles_table', module: m4 },
  { name: '0005_create_crop_types_table', module: m5 },
  { name: '0006_create_planted_crops_table', module: m6 },
  { name: '0007_create_object_collider_data_table', module: m7 },
  { name: '0008_create_npcs_table', module: m8 },
  { name: '0009_create_access_codes_table', module: m9 },
  { name: '0010_add_attributes_to_players_table', module: m10 },
  { name: '0011_drop_legacy_columns_from_players', module: m11 },
];

export async function migrate(db) {
  console.log('🔄 Đang chạy database migrations...');

  // Tạo bảng migrations nếu chưa có
  db.run(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration TEXT UNIQUE NOT NULL,
      batch INTEGER NOT NULL
    )
  `);

  // Lấy danh sách các migration đã chạy
  const stmt = db.prepare('SELECT migration FROM migrations');
  const runMigrations = [];
  while (stmt.step()) {
    runMigrations.push(stmt.getAsObject().migration);
  }
  stmt.free();

  // Xác định số batch tiếp theo
  const maxBatchStmt = db.prepare('SELECT MAX(batch) as max_batch FROM migrations');
  let nextBatch = 1;
  if (maxBatchStmt.step()) {
    const res = maxBatchStmt.getAsObject();
    if (res.max_batch !== null && res.max_batch !== undefined) {
      nextBatch = res.max_batch + 1;
    }
  }
  maxBatchStmt.free();

  let executedAny = false;

  // Duyệt và chạy các migration chưa chạy
  for (const mig of migrationsList) {
    if (!runMigrations.includes(mig.name)) {
      console.log(`Migrating: ${mig.name}`);
      try {
        await mig.module.up(db);
        
        // Ghi lại lịch sử chạy
        const insertStmt = db.prepare('INSERT INTO migrations (migration, batch) VALUES (?, ?)');
        insertStmt.run([mig.name, nextBatch]);
        insertStmt.free();
        
        executedAny = true;
        console.log(`Migrated: ${mig.name}`);
      } catch (err) {
        console.error(`❌ Lỗi khi chạy migration ${mig.name}:`, err);
        throw err;
      }
    }
  }

  // Nếu có bất kì migration nào được chạy mới, chúng ta sẽ chạy seeder dữ liệu
  if (executedAny) {
    console.log('🌱 Chạy database seeders...');
    await DatabaseSeeder.run(db);
  } else {
    console.log('✅ Cơ sở dữ liệu đã cập nhật đầy đủ (No migrations to run).');
  }
}
