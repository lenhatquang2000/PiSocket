// Script chuyển Map1.json thành chunk binary files
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đọc Map1.json
const mapPath = path.join(__dirname, 'public/assets/Map/MapCon/Map1.json');
const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

console.log('📦 Converting Map1.json to binary chunks...');
console.log(`   Map size: ${mapData.width}x${mapData.height}`);
console.log(`   Total objects: ${mapData.objects.length}`);

// Tạo thư mục chunks nếu chưa có
const chunksDir = path.join(__dirname, 'public/assets/Map/chunks');
if (!fs.existsSync(chunksDir)) {
  fs.mkdirSync(chunksDir, { recursive: true });
}

// Tính toán chunk (Map1 là 20x20, đặt tại chunk 0,0)
const chunkX = 0;
const chunkY = 0;
const chunkFileName = `chunk_${chunkX}_${chunkY}.bin`;
const chunkFilePath = path.join(chunksDir, chunkFileName);

// Cấu trúc binary:
// [4 bytes] chunkX (int32)
// [4 bytes] chunkY (int32)
// [4 bytes] width (int32)
// [4 bytes] height (int32)
// [4 bytes] tileSize (int32)
// [4 bytes] objectCount (int32)
// Sau đó mỗi object:
//   [4 bytes] x (int32)
//   [4 bytes] y (int32)
//   [4 bytes] pathLength (int32)
//   [pathLength bytes] path (string UTF-8)
//   [1 byte] isFree (boolean)
//   [4 bytes] rotation (float32)
//   [4 bytes] scale (float32)
//   [4 bytes] zIndex (int32)

const buffer = [];

// Write header
function writeInt32(value) {
  const buf = Buffer.allocUnsafe(4);
  buf.writeInt32LE(value, 0);
  buffer.push(buf);
}

function writeFloat32(value) {
  const buf = Buffer.allocUnsafe(4);
  buf.writeFloatLE(value, 0);
  buffer.push(buf);
}

function writeUInt8(value) {
  const buf = Buffer.allocUnsafe(1);
  buf.writeUInt8(value, 0);
  buffer.push(buf);
}

function writeString(str) {
  const strBuf = Buffer.from(str, 'utf8');
  writeInt32(strBuf.length);
  buffer.push(strBuf);
}

// Write chunk metadata
writeInt32(chunkX);
writeInt32(chunkY);
writeInt32(mapData.width);
writeInt32(mapData.height);
writeInt32(mapData.tileSize);
writeInt32(mapData.objects.length);

// Write objects
mapData.objects.forEach((obj, index) => {
  writeInt32(obj.x);
  writeInt32(obj.y);
  writeString(obj.path);
  writeUInt8(obj.isFree ? 1 : 0);
  writeFloat32(obj.rotation || 0);
  writeFloat32(obj.scale || 1);
  writeInt32(obj.zIndex || 0);
  
  if ((index + 1) % 100 === 0) {
    console.log(`   Processed ${index + 1}/${mapData.objects.length} objects...`);
  }
});

// Combine all buffers
const finalBuffer = Buffer.concat(buffer);

// Write to file
fs.writeFileSync(chunkFilePath, finalBuffer);

console.log(`\n✅ Chunk created successfully!`);
console.log(`   File: ${chunkFileName}`);
console.log(`   Size: ${(finalBuffer.length / 1024).toFixed(2)} KB`);
console.log(`   Chunk position: (${chunkX}, ${chunkY})`);
console.log(`\n💡 Next steps:`);
console.log(`   1. Update game to load chunks dynamically`);
console.log(`   2. Add teleport UI with chunk coordinates`);
