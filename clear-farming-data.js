// Script để xóa tất cả dữ liệu farming (farmed tiles và planted crops)
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'game_accounts.db');

console.log('🗑️  Đang xóa dữ liệu farming...');
console.log('📁 Database path:', dbPath);

try {
  // Load sql.js
  const SQL = await initSqlJs();
  
  // Đọc database file
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Kiểm tra số lượng trước khi xóa
  console.log('\n📊 Trước khi xóa:');
  const farmedBefore = db.exec('SELECT COUNT(*) as count FROM farmed_tiles');
  const farmedCount = farmedBefore[0]?.values[0][0] || 0;
  console.log(`   - Farmed tiles: ${farmedCount}`);

  const cropsBefore = db.exec('SELECT COUNT(*) as count FROM planted_crops');
  const cropsCount = cropsBefore[0]?.values[0][0] || 0;
  console.log(`   - Planted crops: ${cropsCount}`);

  // Xóa tất cả farmed tiles
  db.run('DELETE FROM farmed_tiles');
  
  // Xóa tất cả planted crops
  db.run('DELETE FROM planted_crops');

  // Reset AUTO_INCREMENT
  db.run("DELETE FROM sqlite_sequence WHERE name='farmed_tiles'");
  db.run("DELETE FROM sqlite_sequence WHERE name='planted_crops'");

  // Kiểm tra sau khi xóa
  console.log('\n📊 Sau khi xóa:');
  const farmedAfter = db.exec('SELECT COUNT(*) as count FROM farmed_tiles');
  const farmedCountAfter = farmedAfter[0]?.values[0][0] || 0;
  console.log(`   - Farmed tiles: ${farmedCountAfter}`);

  const cropsAfter = db.exec('SELECT COUNT(*) as count FROM planted_crops');
  const cropsCountAfter = cropsAfter[0]?.values[0][0] || 0;
  console.log(`   - Planted crops: ${cropsCountAfter}`);

  // Lưu lại database
  const data = db.export();
  const buffer2 = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer2);
  console.log('\n💾 Đã lưu database');
  
  db.close();

  console.log('\n🎉 Hoàn tất! Tất cả dữ liệu farming đã được xóa.');
  console.log('\n⚠️  QUAN TRỌNG:');
  console.log('   1. Dừng server (Ctrl+C)');
  console.log('   2. Khởi động lại server: node server.js');
  console.log('   3. Reload trình duyệt (F5)');
} catch (err) {
  console.error('❌ Lỗi:', err.message);
  console.error(err);
}
