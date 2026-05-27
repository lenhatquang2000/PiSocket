import { Server } from "socket.io";
import http from "http";

const players = {};

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', playersCount: Object.keys(players).length }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  // Chỉ khi người chơi nhấn nút "Tạo nhân vật" (gửi newPlayer)
  socket.on("newPlayer", (playerData) => {
    // 1. Lưu dữ liệu người chơi mới
    players[socket.id] = playerData;
    
    // 2. Gửi danh sách TẤT CẢ người chơi hiện tại cho người chơi MỚI này
    socket.emit("currentPlayers", players);

    // 3. Thông báo cho những người chơi CŨ biết có người MỚI tham gia
    socket.broadcast.emit("newPlayer", { id: socket.id, ...playerData });
    
    console.log(`Player ${playerData.name} (${socket.id}) joined the game.`);
  });

  // Cập nhật vị trí (chỉ movement, không có attack)
  socket.on("playerMovement", (movementData) => {
    if (players[socket.id]) {
      players[socket.id].x = movementData.x;
      players[socket.id].y = movementData.y;
      players[socket.id].dir = movementData.dir;
      players[socket.id].isMoving = movementData.isMoving;
      players[socket.id].name = movementData.name; 
      socket.broadcast.emit("playerMoved", { id: socket.id, ...players[socket.id] });
    }
  });

  // Event riêng cho tấn công — broadcast ngay lập tức, đảm bảo không bị mất
  socket.on("playerAttack", (attackData) => {
    if (players[socket.id]) {
      players[socket.id].dir = attackData.dir; // cập nhật hướng
      console.log(`Player ${players[socket.id].name} attacks facing ${attackData.dir}`);
      socket.broadcast.emit("playerAttack", { id: socket.id, dir: attackData.dir });
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WebSocket Server is running on port ${PORT}`);
});
