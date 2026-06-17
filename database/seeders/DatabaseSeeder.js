import * as cropTypesSeeder from './0001_crop_types_seeder.js';
import * as defaultUsersSeeder from './0002_default_users_seeder.js';

export async function run(db) {
  console.log('🌱 Chạy Seeders...');
  await cropTypesSeeder.run(db);
  await defaultUsersSeeder.run(db);
  console.log('✅ Hoàn thành Seeders.');
}
