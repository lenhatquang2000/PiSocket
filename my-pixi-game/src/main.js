import { Application, Assets, AnimatedSprite, Container, Text, TextStyle, TilingSprite, Graphics } from 'pixi.js';
import { io } from "socket.io-client";

(async () => {
    // 0. Kết nối WebSocket
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";
    const socket = io(SOCKET_URL);
    const otherPlayers = {}; // Lưu trữ container của người chơi khác
    const collidableObjects = []; // Lưu trữ các vật thể có va chạm
    const objectSprites = []; // Lưu trữ sprites của objects để depth sorting

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

    // 1. Tải tất cả asset song song và theo dõi tiến trình
    const walkAnimations = {};
    const idleAnimations = {};
    const attackAnimations = {};
    const explosionFrames = [];

    const loadingScreen = document.getElementById('loading-screen');
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');
    const uiOverlay = document.getElementById('ui-overlay');

    // 0. Tải cấu hình map đầu tiên để biết cần tải những gì tiếp theo
    const mapConfig = await Assets.load('/assets/Map/map_config.json');

    // Danh sách các file cần tải
    const assetsToLoad = [];
    directions.forEach(dir => {
        for (let i = 0; i < 6; i++) assetsToLoad.push(`${walkBaseDir}${dir}/frame_00${i}.png`);
        for (let i = 0; i < 4; i++) assetsToLoad.push(`${idleBaseDir}${dir}/frame_00${i}.png`);
        for (let i = 0; i < 6; i++) assetsToLoad.push(`${attackBaseDir}${dir}/frame_00${i}.png`);
    });
    
    // Tải texture của tất cả các vùng map từ config
    if (mapConfig.zones) {
        mapConfig.zones.forEach(zone => {
            assetsToLoad.push(zone.texture);
        });
    }
    
    // Thêm các object sa mạc
    for (let i = 0; i < 12; i++) {
        assetsToLoad.push(`/assets/Object/desert/desert_obj_${i}.png`);
    }

    // Thêm các object rừng (Forest)
    for (let i = 0; i < 16; i++) {
        assetsToLoad.push(`/assets/Object/Forest/forest_obj_${i}.png`);
    }

    // Thêm texture player frame để dùng cho collider
    assetsToLoad.push('/assets/A_cute_chibi_anime_girl/animations/Breathing_Idle-905887d4/south/frame_000.png');

    // Thêm các frame cho skill bộc phá (16 frames)
    for (let i = 0; i < 16; i++) {
        const frameName = i < 10 ? `00${i}` : `0${i}`;
        assetsToLoad.push(`/assets/Skills/Explosion/frame_${frameName}.png`);
    }

    assetsToLoad.push('/assets/Object/collision_data.json');

    let loadedCount = 0;
    const totalAssets = assetsToLoad.length;

    const loadWithProgress = async (url) => {
        const asset = await Assets.load(url);
        loadedCount++;
        const progress = Math.floor((loadedCount / totalAssets) * 100);
        loadingBar.style.width = `${progress}%`;
        loadingText.innerText = `Đang tải tài nguyên... ${progress}%`;
        return asset;
    };

    // Thực hiện tải toàn bộ
    await Promise.all(assetsToLoad.map(url => loadWithProgress(url)));

    // Ẩn loading, hiện UI chọn tên
    loadingScreen.style.display = 'none';
    uiOverlay.style.display = 'block';

    // --- TỔ CHỨC ANIMATIONS ---
    // Tổ chức lại textures vào object để dễ truy xuất
    directions.forEach(dir => {
        // ... existing animation loading ...
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

    // Load explosion frames
    for (let i = 0; i < 16; i++) {
        const frameName = i < 10 ? `00${i}` : `0${i}`;
        explosionFrames.push(Assets.get(`/assets/Skills/Explosion/frame_${frameName}.png`));
    }

    // --- TẠO THẾ GIỚI GAME (World Container) ---
    const world = new Container();
    world.scale.set(1.5); // Phóng to thế giới để camera trông gần hơn
    world.sortableChildren = true; // Cho phép sắp xếp theo zIndex
    app.stage.addChild(world);

    // Đọc dữ liệu va chạm chi tiết
    const collisionData = Assets.get('/assets/Object/collision_data.json') || {};
    let showDebugColliders = false;
    const debugGraphics = new Container();
    world.addChild(debugGraphics);

    // Rải các vùng đất --- (giữ nguyên logic cũ)
    if (mapConfig.zones) {
        mapConfig.zones.forEach(zone => {
            // ... (code cũ tạo zoneSprite)
            const texture = Assets.get(zone.texture);
            const zoneSprite = new TilingSprite({
                texture,
                width: zone.width,
                height: zone.height,
            });
            zoneSprite.x = zone.x;
            zoneSprite.y = zone.y;
            zoneSprite.zIndex = 0; // Nền đất luôn ở dưới cùng
            world.addChild(zoneSprite);

            // Rải vật thể đặc trưng vùng
            const isSand = zone.name === "SandLand";
            const count = isSand ? 40 : 60;
            const prefix = isSand ? "desert" : "Forest";
            const objKeyPrefix = isSand ? "desert_obj" : "forest_obj";
            const maxIdx = isSand ? 12 : 16;

            for (let i = 0; i < count; i++) {
                const objIndex = Math.floor(Math.random() * maxIdx);
                if (isSand && [2, 8, 10].includes(objIndex)) continue;

                const path = `/assets/Object/${prefix}/${objKeyPrefix}_${objIndex}.png`;
                const objTexture = Assets.get(path);
                if (objTexture) {
                    const sprite = new AnimatedSprite([objTexture]);
                    sprite.x = zone.x + Math.random() * zone.width;
                    sprite.y = zone.y + Math.random() * zone.height;
                    
                    let scale = 2.0;
                    if (!isSand && [0, 1, 2, 5, 14].includes(objIndex)) scale = 5.0;
                    else if (!isSand && objIndex === 10) scale = 1.5;
                    else if (isSand && objIndex === 7) scale = 1.5;

                    sprite.scale.set(scale);
                    sprite.anchor.set(0.5, 0.5);
                    if (scale === 5.0) sprite.anchor.set(0.5, 1);

                    world.addChild(sprite);
                    objectSprites.push(sprite);

                    // LƯU DỮ LIỆU VA CHẠM CHI TIẾT
                    const hitData = collisionData[path];
                    if (hitData) {
                        // Backward compatibility: nếu data là array (format cũ)
                        let hitPoints, zIndexUpPoints, zIndexDownPoints;
                        if (Array.isArray(hitData)) {
                            hitPoints = hitData;
                            zIndexUpPoints = [];
                            zIndexDownPoints = [];
                        } else {
                            hitPoints = hitData.normal || [];
                            zIndexUpPoints = hitData.z_index_up || [];
                            zIndexDownPoints = hitData.z_index_down || [];
                        }

                        collidableObjects.push({
                            x: sprite.x,
                            y: sprite.y,
                            scale: scale,
                            anchor: sprite.anchor,
                            points: hitPoints,
                            zIndexUpPoints: zIndexUpPoints,
                            zIndexDownPoints: zIndexDownPoints,
                            width: objTexture.width,
                            height: objTexture.height,
                            sprite: sprite // Lưu reference để điều chỉnh z-index
                        });

                        // Vẽ Debug nếu cần
                        const g = new Graphics();
                        g.beginFill(0xff0000, 0.5);
                        hitPoints.forEach(p => {
                            const px = (p.x - objTexture.width * sprite.anchor.x) * scale;
                            const py = (p.y - objTexture.height * sprite.anchor.y) * scale;
                            g.drawRect(sprite.x + px, sprite.y + py, scale, scale);
                        });
                        // Vẽ debug cho z-index up (xanh) - chỉ nếu có data mới
                        if (zIndexUpPoints.length > 0) {
                            g.beginFill(0x00ff00, 0.5);
                            zIndexUpPoints.forEach(p => {
                                const px = (p.x - objTexture.width * sprite.anchor.x) * scale;
                                const py = (p.y - objTexture.height * sprite.anchor.y) * scale;
                                g.drawRect(sprite.x + px, sprite.y + py, scale, scale);
                            });
                        }
                        // Vẽ debug cho z-index down (vàng) - chỉ nếu có data mới
                        if (zIndexDownPoints.length > 0) {
                            g.beginFill(0xffff00, 0.5);
                            zIndexDownPoints.forEach(p => {
                                const px = (p.x - objTexture.width * sprite.anchor.x) * scale;
                                const py = (p.y - objTexture.height * sprite.anchor.y) * scale;
                                g.drawRect(sprite.x + px, sprite.y + py, scale, scale);
                            });
                        }
                        g.visible = false;
                        debugGraphics.addChild(g);
                        sprite.debugBounds = g;
                    }
                }
            }
        });
    }

    // Nút Bật/Tắt Debug bằng phím H hoặc Nút trên màn hình
    const debugBtn = document.getElementById('debug-btn');
    const toggleDebug = () => {
        showDebugColliders = !showDebugColliders;
        debugGraphics.visible = showDebugColliders;
        // Hiện/ẩn collider của nhân vật
        if (characterContainer.charColliderDebug) {
            characterContainer.charColliderDebug.visible = showDebugColliders;
        }
        debugBtn.innerText = showDebugColliders ? "Hide Colliders (H)" : "Show Colliders (H)";
        debugBtn.style.background = showDebugColliders ? "rgba(231, 76, 60, 0.8)" : "rgba(0,0,0,0.6)";
        console.log("Debug Colliders:", showDebugColliders);
    };

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyH') toggleDebug();
    });
    debugBtn.onclick = toggleDebug;

    // Hàm kiểm tra va chạm Pixel-Perfect
    const checkCollision = (char, obj) => {
        // char: characterContainer, obj: item trong collidableObjects
        const charR = 15; // Bán kính va chạm nhân vật (fallback)

        // Kiểm tra nhanh bằng bounding box trước
        const dist = Math.sqrt(Math.pow(char.x - obj.x, 2) + Math.pow(char.y - obj.y, 2));
        if (dist > 200) return false; // Quá xa thì bỏ qua

        // Nếu player có pixel collider, dùng pixel-based collision
        if (char.colliderData && char.colliderData.hasPixelCollider && char.colliderData.points) {
            const charScale = char.scale.x;
            const charPoints = char.colliderData.points;

            for (let cp of charPoints) {
                // Tính vị trí pixel của player trong world space
                const charPx = char.x + (cp.x - char.colliderData.width * 0.5) * charScale;
                const charPy = char.y + (cp.y - char.colliderData.height * 0.5) * charScale;

                for (let p of obj.points) {
                    const objPx = obj.x + (p.x - obj.width * obj.anchor.x) * obj.scale;
                    const objPy = obj.y + (p.y - obj.height * obj.anchor.y) * obj.scale;

                    // Kiểm tra nếu 2 pixel chồng lên nhau
                    if (Math.abs(charPx - objPx) < (obj.scale + charScale) / 2 &&
                        Math.abs(charPy - objPy) < (obj.scale + charScale) / 2) {
                        return true;
                    }
                }
            }
            return false;
        }

        // Fallback: dùng circle-based collision
        for (let p of obj.points) {
            const px = obj.x + (p.x - obj.width * obj.anchor.x) * obj.scale;
            const py = obj.y + (p.y - obj.height * obj.anchor.y) * obj.scale;

            // Nếu tâm nhân vật đi vào vùng pixel đỏ (có sai số nhỏ)
            if (Math.abs(char.x - px) < (obj.scale) && Math.abs(char.y - py) < (obj.scale)) {
                return true;
            }
        }
        return false;
    };

    // Hàm kiểm tra va chạm với special collider (z-index up/down)
    const checkSpecialCollider = (char, obj, points) => {
        if (!points || points.length === 0) return false;

        const charScale = char.scale.x;
        const charPoints = char.colliderData && char.colliderData.hasPixelCollider ? char.colliderData.points : null;

        // Nếu player có pixel collider
        if (charPoints) {
            for (let cp of charPoints) {
                const charPx = char.x + (cp.x - char.colliderData.width * 0.5) * charScale;
                const charPy = char.y + (cp.y - char.colliderData.height * 0.5) * charScale;

                for (let p of points) {
                    const objPx = obj.x + (p.x - obj.width * obj.anchor.x) * obj.scale;
                    const objPy = obj.y + (p.y - obj.height * obj.anchor.y) * obj.scale;

                    if (Math.abs(charPx - objPx) < (obj.scale + charScale) / 2 &&
                        Math.abs(charPy - objPy) < (obj.scale + charScale) / 2) {
                        return true;
                    }
                }
            }
        } else {
            // Fallback: dùng tâm nhân vật
            for (let p of points) {
                const px = obj.x + (p.x - obj.width * obj.anchor.x) * obj.scale;
                const py = obj.y + (p.y - obj.height * obj.anchor.y) * obj.scale;

                if (Math.abs(char.x - px) < (obj.scale) && Math.abs(char.y - py) < (obj.scale)) {
                    return true;
                }
            }
        }
        return false;
    };

    // Rải các object cố định từ config vào thế giới
    if (mapConfig.objects) {
        mapConfig.objects.forEach(obj => {
            const path = `/assets/Object/desert/desert_obj_${obj.id}.png`;
            const objTexture = Assets.get(path);
            if (objTexture) {
                const sprite = new AnimatedSprite([objTexture]);
                sprite.x = obj.x;
                sprite.y = obj.y;
                sprite.scale.set(obj.scale || 2.0);
                sprite.anchor.set(0.5, 0.5);
                world.addChild(sprite);
                objectSprites.push(sprite);

                // LƯU DỮ LIỆU VA CHẠM CHI TIẾT
                const hitData = collisionData[path];
                if (hitData) {
                    // Backward compatibility: nếu data là array (format cũ)
                    let hitPoints, zIndexUpPoints, zIndexDownPoints;
                    if (Array.isArray(hitData)) {
                        hitPoints = hitData;
                        zIndexUpPoints = [];
                        zIndexDownPoints = [];
                    } else {
                        hitPoints = hitData.normal || [];
                        zIndexUpPoints = hitData.z_index_up || [];
                        zIndexDownPoints = hitData.z_index_down || [];
                    }

                    collidableObjects.push({
                        x: sprite.x,
                        y: sprite.y,
                        scale: sprite.scale.x,
                        anchor: sprite.anchor,
                        points: hitPoints,
                        zIndexUpPoints: zIndexUpPoints,
                        zIndexDownPoints: zIndexDownPoints,
                        width: objTexture.width,
                        height: objTexture.height,
                        sprite: sprite
                    });

                    // Vẽ Debug nếu cần
                    const g = new Graphics();
                    g.beginFill(0xff0000, 0.5);
                    hitPoints.forEach(p => {
                        const px = (p.x - objTexture.width * sprite.anchor.x) * sprite.scale.x;
                        const py = (p.y - objTexture.height * sprite.anchor.y) * sprite.scale.x;
                        g.drawRect(sprite.x + px, sprite.y + py, sprite.scale.x, sprite.scale.x);
                    });
                    // Vẽ debug cho z-index up (xanh) - chỉ nếu có data mới
                    if (zIndexUpPoints.length > 0) {
                        g.beginFill(0x00ff00, 0.5);
                        zIndexUpPoints.forEach(p => {
                            const px = (p.x - objTexture.width * sprite.anchor.x) * sprite.scale.x;
                            const py = (p.y - objTexture.height * sprite.anchor.y) * sprite.scale.x;
                            g.drawRect(sprite.x + px, sprite.y + py, sprite.scale.x, sprite.scale.x);
                        });
                    }
                    // Vẽ debug cho z-index down (vàng) - chỉ nếu có data mới
                    if (zIndexDownPoints.length > 0) {
                        g.beginFill(0xffff00, 0.5);
                        zIndexDownPoints.forEach(p => {
                            const px = (p.x - objTexture.width * sprite.anchor.x) * sprite.scale.x;
                            const py = (p.y - objTexture.height * sprite.anchor.y) * sprite.scale.x;
                            g.drawRect(sprite.x + px, sprite.y + py, sprite.scale.x, sprite.scale.x);
                        });
                    }
                    g.visible = false;
                    debugGraphics.addChild(g);
                    sprite.debugBounds = g;
                }
            }
        });
    }

    // --- MAGE SKILL VFX (EXPLOSION) ---
    const playExplosionSkill = (targetX, targetY) => {
        const explosion = new AnimatedSprite(explosionFrames);
        explosion.anchor.set(0.5, 0.5);
        explosion.animationSpeed = 0.3;
        explosion.loop = false;
        explosion.scale.set(2.0); // Làm skill to ra một chút
        
        // Vị trí skill (tương đối trong world)
        explosion.x = targetX;
        explosion.y = targetY;
        
        // Luôn ở trên cùng
        explosion.zIndex = 10000;
        
        explosion.onComplete = () => {
            world.removeChild(explosion);
            explosion.destroy();
        };

        // Rung màn hình khi tới frame bùng nổ (frame 4-6)
        explosion.onFrameChange = (currentFrame) => {
            if (currentFrame >= 4 && currentFrame <= 8) {
                const intensity = 8;
                shakeOffset.x = (Math.random() - 0.5) * intensity;
                shakeOffset.y = (Math.random() - 0.5) * intensity;
            } else {
                shakeOffset.x = 0;
                shakeOffset.y = 0;
            }
        };

        world.addChild(explosion);
        explosion.play();
    };

    // Lắng nghe click chuột trái để tung chiêu
    app.view.addEventListener('mousedown', (e) => {
        if (e.button === 0 && isGameStarted) { // 0 là chuột trái
            // Chuyển đổi tọa độ click màn hình sang tọa độ trong world
            const rect = app.view.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left);
            const mouseY = (e.clientY - rect.top);

            // Tính toán vị trí trong world dựa trên camera (world.x, world.y) và scale
            const worldX = (mouseX - world.x) / world.scale.x;
            const worldY = (mouseY - world.y) / world.scale.y;

            playExplosionSkill(worldX, worldY);

            // Gửi event skill cho người chơi khác
            socket.emit("playerSkill", {
                targetX: worldX,
                targetY: worldY
            });

            // Trigger animation tấn công của nhân vật
            if (!character.playing || character.textures !== attackAnimations[currentDir]) {
                character.textures = attackAnimations[currentDir];
                character.loop = false;
                character.gotoAndPlay(0);
                character.onComplete = () => {
                    character.textures = idleAnimations[currentDir];
                    character.loop = true;
                    character.play();
                };
            }
        }
    });

    // --- KHAI BÁO NHÂN VẬT CHÍNH ---
    let myGameId = "";
    let isGameStarted = false;
    let currentDir = 'south';
    let isMoving = false;
    let zIndexOverride = null; // Lưu z-index được điều chỉnh bởi special collider
    let shakeOffset = { x: 0, y: 0 }; // Offset cho hiệu ứng rung màn hình

    const characterContainer = new Container();
    characterContainer.visible = false; // Ẩn cho đến khi nhấn nút
    world.addChild(characterContainer); // Nhân vật thuộc về world

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

    characterContainer.x = 500;
    characterContainer.y = 500;
    characterContainer.scale.set(0.7);

    // Vẽ Debug collider cho nhân vật
    const charColliderG = new Graphics();
    charColliderG.visible = false;
    characterContainer.addChild(charColliderG);
    characterContainer.charColliderDebug = charColliderG;

    // Lưu dữ liệu collider cho nhân vật
    const playerPath = '/assets/A_cute_chibi_anime_girl/animations/Breathing_Idle-905887d4/south/frame_000.png';
    const playerTexture = Assets.get(playerPath);
    const playerHitData = collisionData[playerPath];

    // Handle both old array format and new object format
    let playerHitPoints = null;
    if (playerHitData) {
        if (Array.isArray(playerHitData)) {
            playerHitPoints = playerHitData;
        } else if (typeof playerHitData === 'object' && playerHitData.normal) {
            playerHitPoints = playerHitData.normal;
        }
    }

    characterContainer.colliderData = {
        hasPixelCollider: !!playerHitPoints,
        points: playerHitPoints || null,
        radius: 15, // Fallback radius
        width: playerTexture ? playerTexture.width : 30,
        height: playerTexture ? playerTexture.height : 30
    };

    // Vẽ debug collider dựa trên loại collider
    if (playerHitPoints && playerHitPoints.length > 0) {
        charColliderG.beginFill(0x00ff00, 0.3);
        playerHitPoints.forEach(p => {
            const px = (p.x - characterContainer.colliderData.width * 0.5) * 0.7;
            const py = (p.y - characterContainer.colliderData.height * 0.5) * 0.7;
            charColliderG.drawRect(px, py, 0.7, 0.7);
        });
    } else {
        charColliderG.beginFill(0x00ff00, 0.3);
        charColliderG.drawCircle(0, 0, 15);
    }

    // --- XỬ LÝ NÚT TẠO NHÂN VẬT ---
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
        container.scale.set(0.7);
        world.addChild(container); 
        
        otherPlayers[id] = { 
            container, 
            sprite, 
            tag,
            isAttacking: false, 
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

    // NHẬN EVENT KỸ NĂNG (SKILL) từ người chơi khác
    socket.on("playerSkill", (data) => {
        console.log("Other player uses skill:", data.id, "at:", data.targetX, data.targetY);
        playExplosionSkill(data.targetX, data.targetY);
    });

    // Người chơi thoát ra
    socket.on("playerDisconnected", (id) => {
        if (otherPlayers[id]) {
            world.removeChild(otherPlayers[id].container);
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
            
            // Lưu vị trí cũ
            const oldX = characterContainer.x;
            const oldY = characterContainer.y;

            // Thử di chuyển theo trục X
            characterContainer.x += dx * moveSpeed;
            let collisionX = false;
            for (let obj of collidableObjects) {
                if (checkCollision(characterContainer, obj)) {
                    collisionX = true;
                    break;
                }
            }
            if (collisionX) characterContainer.x = oldX; // Nếu va chạm thì trả về vị trí cũ

            // Thử di chuyển theo trục Y
            characterContainer.y += dy * moveSpeed;
            let collisionY = false;
            for (let obj of collidableObjects) {
                if (checkCollision(characterContainer, obj)) {
                    collisionY = true;
                    break;
                }
            }
            if (collisionY) characterContainer.y = oldY; // Nếu va chạm thì trả về vị trí cũ

            if (characterContainer.x !== oldX || characterContainer.y !== oldY) {
                moved = true;
            }

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

        // --- LOGIC CAMERA FOLLOW ---
        // Giữ nhân vật ở giữa màn hình bằng cách di chuyển cả 'world' (có tính đến tỉ lệ phóng to)
        world.x = (app.screen.width / 2) - (characterContainer.x * world.scale.x) + shakeOffset.x;
        world.y = (app.screen.height / 2) - (characterContainer.y * world.scale.y) + shakeOffset.y;

        // --- DEPTH SORTING ---
        // Cập nhật zIndex cho objects trước (chỉ dựa trên Y)
        objectSprites.forEach(sprite => {
            sprite.zIndex = Math.floor(sprite.y * 10);
        });

        // Cập nhật zIndex cho other players
        Object.values(otherPlayers).forEach(p => {
            p.container.zIndex = Math.floor(p.container.y * 10);
        });

        // Cập nhật zIndex cho nhân vật với special collider adjustments
        let charZIndex = Math.floor(characterContainer.y * 10);

        // Kiểm tra special colliders để điều chỉnh z-index
        collidableObjects.forEach(obj => {
            if (!obj.sprite) return;

            // Kiểm tra collider z-index up (xanh) - nhân vật ở trên object
            if (checkSpecialCollider(characterContainer, obj, obj.zIndexUpPoints)) {
                // Dùng z-index dựa trên Y của object + offset lớn
                charZIndex = Math.floor(obj.y * 10) + 5000; // Offset lớn để đảm bảo ở trên
                console.log("Z-Index UP triggered - character above object");
            }
            // Kiểm tra collider z-index down (vàng) - nhân vật ở dưới object
            else if (checkSpecialCollider(characterContainer, obj, obj.zIndexDownPoints)) {
                // Dùng z-index dựa trên Y của object - offset lớn
                charZIndex = Math.floor(obj.y * 10) - 5000; // Offset lớn để đảm bảo ở dưới
                console.log("Z-Index DOWN triggered - character below object");
            }
        });

        characterContainer.zIndex = charZIndex;

        // Debug: Log Y của nhân vật và object gần nhất
        if (moved) {
            console.log(`Character Y: ${characterContainer.y}, zIndex: ${characterContainer.zIndex}`);
            // Tìm object gần nhất
            let nearestObj = null;
            let nearestDist = Infinity;
            objectSprites.forEach(sprite => {
                const dist = Math.abs(sprite.y - characterContainer.y);
                if (dist < 100 && dist < nearestDist) {
                    nearestDist = dist;
                    nearestObj = sprite;
                }
            });
            if (nearestObj) {
                console.log(`Nearest Object Y: ${nearestObj.y}, zIndex: ${nearestObj.zIndex}, Diff: ${nearestObj.y - characterContainer.y}`);
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
