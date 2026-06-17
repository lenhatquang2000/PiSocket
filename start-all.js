import { spawn } from 'child_process';

console.log('🚀 Khởi chạy Backend (Server) và Frontend (Vite)...');

// Khởi chạy Backend
const be = spawn('node', ['Server/server.js'], { stdio: 'inherit', shell: true });

be.on('close', (code) => {
  console.log(`Backend kết thúc với mã lỗi: ${code}`);
  process.exit(code);
});

// Khởi chạy Frontend
const fe = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });

fe.on('close', (code) => {
  console.log(`Frontend kết thúc với mã lỗi: ${code}`);
  process.exit(code);
});
