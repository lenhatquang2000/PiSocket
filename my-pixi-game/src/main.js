import { Application, Assets, AnimatedSprite, Container, Text, TextStyle, TilingSprite } from 'pixi.js';
import { io } from "socket.io-client";

(async () => {
    // 0. Kết nối WebSocket
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";
    const socket = io(SOCKET_URL);
    const otherPlayers = {}; // Lưu trữ container của người chơi khác

    // --- SOCKET CONNECTION LOGGING ---
    socket.on("connect", () => console.log("✅ Connected to server, id:", socket.id));
    socket.on("disconnect", (reason) => console.warn("❌ Disconnected:", reason));
    socket.on("connect_error", (err) => console.error("⚠️ Connection error:", err.message));

    const app = new Application();
    await app.init({ 
        background: '#1099bb', 
        resizeTo: window 
    });
    document.body.appendChild(app.canvas);

    // Style cho nhãn tên (Game ID)
    const nameStyle = new TextStyle({
        fontFamily: 'Arial',
        fontSize: 14,
        fontWeight: 'bold',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
    });

    const directions = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
    const walkBaseDir = '/assets/A_cute_chibi_anime_girl/animations/Walking-3023122c/';
    const idleBaseDir = '/assets/A_cute_chibi_anime_girl/animations/Breathing_Idle-905887d4/';
    const attackBaseDir = '/assets/A_cute_chibi_anime_girl/animations/Fireball-4a198baf/';

    // 1. Tải tất cả asset song song
    const walkAnimations = {};
    const idleAnimations = {};
    const attackAnimations = {};

    // Tải walking frames (6 frames mỗi hướng)
    const loadAll = [];
    directions.forEach(dir => {
        // Walking (6 frames)
        for (let i = 0; i < 6; i++) {
            loadAll.push(Assets.load(`${walkBaseDir}${dir}/frame_00${i}.png`));
        }
        // Idle (4 frames cho mọi hướng)
        for (let i = 0; i < 4; i++) {
            loadAll.push(Assets.load(`${idleBaseDir}${dir}/frame_00${i}.png`));
        }
        // Attack (6 frames cho mọi hướng)
        for (let i = 0; i < 6; i++) {
            loadAll.push(Assets.load(`${attackBaseDir}${dir}/frame_00${i}.png`));
        }
    });

    // Tải hình nền map
    loadAll.push(Assets.load('/assets/Map/Standra/Map1.png'));

    await Promise.all(loadAll);

    // Tổ chức lại textures vào object để dễ truy xuất
    directions.forEach(dir => {
        const wFrames = [];
        const iFrames = [];
        const aFrames = [];
        for (let i = 0; i < 6; i++) {
            wFrames.push(Assets.get(`${walkBaseDir}${dir}/frame_00${i}.png`));
        }
        for (let i = 0; i < 4; i++) {
            iFrames.push(Assets.get(`${idleBaseDir}${dir}/frame_00${i}.png`));
        }
        for (let i = 0; i < 6; i++) {
            aFrames.push(Assets.get(`${attackBaseDir}${dir}/frame_00${i}.png`));
        }
        walkAnimations[dir] = wFrames;
        idleAnimations[dir] = iFrames;
        attackAnimations[dir] = aFrames;
    });

    // --- TẠO HÌNH NỀN MAP ---
    const bgTexture = Assets.get('/assets/Map/Standra/Map1.png');
    const background = new TilingSprite({
        texture: bgTexture,
        width: app.screen.width,
        height: app.screen.height,
    });
    background.tileScale.set(1.0, 1.0); // Giữ nguyên kích thước ảnh gốc
    app.stage.addChildAt(background, 0); // Đảm bảo nền ở dưới cùng

    // Cập nhật kích thước nền khi resize
    window.addEventListener('resize', () => {
        background.width = app.screen.width;
        background.height = app.screen.height;
    });

    // --- KHAI BÁO NHÂN VẬT CHÍNH ---
    let myGameId = "";
    let isGameStarted = false;
    let currentDir = 'south';
    let isMoving = false;

    const characterContainer = new Container();
    characterContainer.visible = false; // Ẩn cho đến khi nhấn nút
    app.stage.addChild(characterContainer);

    const character = new AnimatedSprite(idleAnimations['south']);
    character.anchor.set(0.5, 0.5);
    character.animationSpeed = 0.05;
    character.play();
    characterContainer.addChild(character);

    // Nhãn tên trên đầu
    const nameTag = new Text({ text: '', style: nameStyle });
    nameTag.anchor.set(0.5, 1);
    nameTag.y = -60; // Điều chỉnh vị trí tên trên đầu
    characterContainer.addChild(nameTag);

    characterContainer.x = app.screen.width / 2;
    characterContainer.y = app.screen.height / 2;
    characterContainer.scale.set(1.0);

    // --- XỬ LÝ NÚT TẠO NHÂN VẬT ---
    const uiOverlay = document.getElementById('ui-overlay');
    const gameIdInput = document.getElementById('game-id');
    const createBtn = document.getElementById('create-btn');

    createBtn.addEventListener('click', () => {
        myGameId = gameIdInput.value || "Player_" + Math.floor(Math.random() * 1000);
        nameTag.text = myGameId;
        
        uiOverlay.style.display = 'none'; // Ẩn UI
        characterContainer.visible = true; // Hiện nhân vật
        isGameStarted = true;

        console.log("Game started as:", myGameId);

        // Báo cho server biết mình tham gia CHỈ KHI nhấn nút
        socket.emit("newPlayer", {
            x: characterContainer.x,
            y: characterContainer.y,
            dir: currentDir,
            isMoving: false,
            isAttacking: false,
            name: myGameId
        });
    });

    // Hàm tạo nhân vật cho người chơi khác
    const createOtherPlayer = (id, data) => {
        if (otherPlayers[id]) return; // Đã tồn tại thì bỏ qua

        console.log("Creating other player:", data.name || id);
        const container = new Container();
        const sprite = new AnimatedSprite(idleAnimations[data.dir || 'south']);
        sprite.anchor.set(0.5, 0.5);
        sprite.animationSpeed = 0.05;
        sprite.play();
        container.addChild(sprite);

        // Nhãn tên người chơi khác
        const tag = new Text({ text: data.name || id, style: nameStyle });
        tag.anchor.set(0.5, 1);
        tag.y = -60;
        container.addChild(tag);

        container.x = data.x;
        container.y = data.y;
        app.stage.addChild(container);
        otherPlayers[id] = { 
            container, 
            sprite, 
            tag,
            isAttacking: false, // Trạng thái bận tấn công
            currentDir: data.dir || 'south',
            currentIsMoving: data.isMoving || false
        };
    };

    // Nhận danh sách người chơi hiện có
    socket.on("currentPlayers", (players) => {
        console.log("Current players from server:", players);
        Object.keys(players).forEach((id) => {
            if (id !== socket.id) {
                createOtherPlayer(id, players[id]);
            }
        });
    });

    // Có người chơi mới tham gia
    socket.on("newPlayer", (data) => {
        console.log("New player notification:", data.name);
        createOtherPlayer(data.id, data);
    });

    // Cập nhật vị trí người chơi khác (CHỈ movement, không có attack)
    socket.on("playerMoved", (data) => {
        const p = otherPlayers[data.id];
        if (p) {
            p.container.x = data.x;
            p.container.y = data.y;
            p.tag.text = data.name || data.id;
            p.currentDir = data.dir;
            p.currentIsMoving = data.isMoving;
            
            // Chỉ cập nhật Walk/Idle nếu họ KHÔNG đang bận tấn công
            if (!p.isAttacking) {
                if (data.isMoving) {
                    if (p.sprite.textures !== walkAnimations[data.dir]) {
                        p.sprite.textures = walkAnimations[data.dir];
                        p.sprite.animationSpeed = 0.15;
                        p.sprite.play();
                    }
                } else {
                    if (p.sprite.textures !== idleAnimations[data.dir]) {
                        p.sprite.textures = idleAnimations[data.dir];
                        p.sprite.animationSpeed = 0.05;
                        p.sprite.play();
                    }
                }
            }
        }
    });

    // NHẬN EVENT TẤN CÔNG riêng biệt từ người chơi khác
    socket.on("playerAttack", (data) => {
        const p = otherPlayers[data.id];
        if (p && !p.isAttacking) {
            console.log("Other player attacks:", data.id, "dir:", data.dir);
            p.isAttacking = true;
            p.sprite.textures = attackAnimations[data.dir];
            p.sprite.animationSpeed = 0.15;
            p.sprite.loop = false;
            p.sprite.gotoAndPlay(0);
            
            p.sprite.onComplete = () => {
                p.isAttacking = false;
                p.sprite.loop = true;
                p.sprite.onComplete = null;
                // Quay về trạng thái hiện tại (dùng dữ liệu MỚI NHẤT, không dùng closure cũ)
                if (p.currentIsMoving) {
                    p.sprite.textures = walkAnimations[p.currentDir];
                    p.sprite.animationSpeed = 0.15;
                } else {
                    p.sprite.textures = idleAnimations[p.currentDir];
                    p.sprite.animationSpeed = 0.05;
                }
                p.sprite.play();
            };
        }
    });

    // Người chơi thoát ra
    socket.on("playerDisconnected", (id) => {
        if (otherPlayers[id]) {
            app.stage.removeChild(otherPlayers[id].container);
            delete otherPlayers[id];
        }
    });

    // --- XỬ LÝ DI CHUYỂN ---
    const keys = {};
    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);

    // XỎ LÝ TẤN CÔNG (Click chuột trái)
    let isAttacking = false;
    window.addEventListener('mousedown', (e) => {
        if (!isGameStarted || isAttacking) return;
        if (e.button === 0) { // Chuột trái
            isAttacking = true;
            character.textures = attackAnimations[currentDir];
            character.animationSpeed = 0.15;
            character.loop = false;
            character.gotoAndPlay(0); // Bắt đầu từ frame 0
            
            // Khi animation tấn công kết thúc
            character.onComplete = () => {
                isAttacking = false;
                character.loop = true;
                character.onComplete = null;
                // Quay lại animation cũ tùy theo trạng thái di chuyển
                character.textures = isMoving ? walkAnimations[currentDir] : idleAnimations[currentDir];
                character.play();
            };

            // Gửi event TẤN CÔNG riêng biệt (không ghép vào movement)
            console.log("Emitting playerAttack, dir:", currentDir);
            socket.emit("playerAttack", {
                dir: currentDir
            });
        }
    });

    let lastSentData = { x: 0, y: 0, dir: '', isMoving: false };

    app.ticker.add((ticker) => {
        if (!isGameStarted) return; // Chỉ chạy khi đã nhấn nút

        // KHÔNG cho phép di chuyển nếu đang tấn công
        if (isAttacking) return;

        let dx = 0;
        let dy = 0;
        let moved = false;

        if (keys['ArrowUp'] || keys['KeyW']) dy -= 1;
        if (keys['ArrowDown'] || keys['KeyS']) dy += 1;
        if (keys['ArrowLeft'] || keys['KeyA']) dx -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) dx += 1;

        if (dx !== 0 || dy !== 0) {
            moved = true;
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;

            const moveSpeed = 4 * ticker.deltaTime;
            characterContainer.x += dx * moveSpeed;
            characterContainer.y += dy * moveSpeed;

            let newDir = '';
            if (dy < 0) newDir += 'north';
            else if (dy > 0) newDir += 'south';

            if (dx < 0) newDir += (newDir ? '-' : '') + 'west';
            else if (dx > 0) newDir += (newDir ? '-' : '') + 'east';

            if (!isMoving || currentDir !== newDir) {
                isMoving = true;
                currentDir = newDir;
                character.textures = walkAnimations[currentDir];
                character.animationSpeed = 0.15;
                character.play();
            }
        } else {
            if (isMoving) {
                isMoving = false;
                character.textures = idleAnimations[currentDir];
                character.animationSpeed = 0.05;
                character.play();
            }
        }

        // Gửi dữ liệu vị trí lên server nếu có thay đổi (CHỈ movement)
        if (moved || (lastSentData.isMoving !== isMoving) || (lastSentData.dir !== currentDir)) {
            socket.emit("playerMovement", {
                x: characterContainer.x,
                y: characterContainer.y,
                dir: currentDir,
                isMoving: isMoving,
                name: myGameId
            });
            lastSentData = { 
                x: characterContainer.x, 
                y: characterContainer.y, 
                dir: currentDir, 
                isMoving: isMoving
            };
        }
    });
})();
