import { Application, Assets, AnimatedSprite, Container, Text, TextStyle, TilingSprite, Graphics } from 'pixi.js';
import { io } from "socket.io-client";
import { RICE_FRAME_FILES, CROP_GROWTH_STAGES } from './config/constants.js';
import { ChunkLoader } from './chunkLoader.js';
import { renderChunk, unloadChunkRender } from './chunkRenderer.js';
import { ServerMovementController } from './serverMovement.js';

(async () => {
    console.log('🎮 [GAME] Starting game initialization...');
    
    // 0. Kết nối WebSocket
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";
    const socket = io(SOCKET_URL);
    const otherPlayers = {}; // Lưu trữ container của người chơi khác
    const collidableObjects = []; // Lưu trữ các vật thể có va chạm
    const objectSprites = []; // Lưu trữ sprites của objects để depth sorting
    const farmedTiles = []; // Lưu trữ các ô đất đã đào

    // Initialize Chunk Loader
    const chunkLoader = new ChunkLoader();
    console.log('📦 [CHUNK] ChunkLoader initialized');

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
    const digBaseDir = '/assets/A_cute_chibi_anime_girl/animations/dig/';
    const seedingBaseDir = '/assets/A_cute_chibi_anime_girl/animations/seeding/';
    const sleepBaseDir = '/assets/A_cute_chibi_anime_girl/animations/sleep/';
    const sleepingBaseDir = '/assets/A_cute_chibi_anime_girl/animations/Sleeping/';

    // 1. Tải tất cả asset song song và theo dõi tiến trình
    const walkAnimations = {};
    const idleAnimations = {};
    const attackAnimations = {};
    const digAnimations = {};
    const seedingAnimations = {};
    const sleepAnimations = {};
    const sleepingAnimations = {};
    const explosionFrames = [];

    const loadingScreen = document.getElementById('loading-screen');
    const loadingBar = document.getElementById('loading-bar');
    const loadingText = document.getElementById('loading-text');
    const uiOverlay = document.getElementById('ui-overlay');

    // 0. Tải worldmap và submaps thay vì map_config.json cũ
    let worldmapData = null;
    let submapsData = [];
    
    try {
        // Load worldmap từ server
        const worldmapResponse = await fetch(`${SOCKET_URL}/get-latest-worldmap`);
        const worldmapResult = await worldmapResponse.json();
        worldmapData = worldmapResult.worldmap;
        console.log('✅ Loaded worldmap:', worldmapResult.fileName);
        
        // Load tất cả submaps
        const submapsResponse = await fetch(`${SOCKET_URL}/get-submaps`);
        const submapsResult = await submapsResponse.json();
        submapsData = submapsResult.submaps || [];
        console.log(`✅ Loaded ${submapsData.length} submaps`);
    } catch (err) {
        console.error('❌ Lỗi load worldmap, fallback to map_config.json:', err);
        // Fallback to old map_config if worldmap not found
        worldmapData = null;
    }
    
    const mapConfig = worldmapData ? null : await Assets.load('/assets/Map/map_config.json');

    // Danh sách các file cần tải
    const assetsToLoad = [];
    directions.forEach(dir => {
        for (let i = 0; i < 6; i++) assetsToLoad.push(`${walkBaseDir}${dir}/frame_00${i}.png`);
        for (let i = 0; i < 4; i++) assetsToLoad.push(`${idleBaseDir}${dir}/frame_00${i}.png`);
        for (let i = 0; i < 6; i++) assetsToLoad.push(`${attackBaseDir}${dir}/frame_00${i}.png`);
        for (let i = 0; i < 9; i++) assetsToLoad.push(`${digBaseDir}${dir}/frame_00${i}.png`);
        for (let i = 0; i < 9; i++) assetsToLoad.push(`${seedingBaseDir}${dir}/frame_00${i}.png`);
        for (let i = 0; i < 9; i++) assetsToLoad.push(`${sleepBaseDir}${dir}/frame_00${i}.png`);
        // Load sleeping animation
        // east, south, west có frame 003-015
        // north, north-east, north-west, south-east, south-west có frame 004-015
        const startFrame = (dir === 'east' || dir === 'south' || dir === 'west') ? 3 : 4;
        for (let i = startFrame; i <= 15; i++) {
            const frameNum = i < 10 ? `00${i}` : `0${i}`;
            assetsToLoad.push(`${sleepingBaseDir}${dir}/frame_${frameNum}.png`);
        }
    });
    
    // Tải texture từ worldmap hoặc fallback to old config
    if (worldmapData && submapsData.length > 0) {
        // Load textures từ submaps
        submapsData.forEach(submap => {
            if (submap.objects) {
                submap.objects.forEach(obj => {
                    if (!assetsToLoad.includes(obj.path)) {
                        assetsToLoad.push(obj.path);
                    }
                });
            }
        });
        console.log(`📦 Loading assets from ${submapsData.length} submaps`);
    } else if (mapConfig && mapConfig.zones) {
        // Fallback: Tải texture của tất cả các vùng map từ config cũ
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

    // Thêm texture đất đã đào (Farming) - CHỈ 1 TEXTURE
    assetsToLoad.push('/assets/Farming1/2D_game_asset_cultivated_farm (14).png');

    // Thêm texture player frame để dùng cho collider
    assetsToLoad.push('/assets/A_cute_chibi_anime_girl/animations/Breathing_Idle-905887d4/south/frame_000.png');

    // Thêm các frame cho skill bộc phá (16 frames)
    for (let i = 0; i < 16; i++) {
        const frameName = i < 10 ? `00${i}` : `0${i}`;
        assetsToLoad.push(`/assets/Skills/Explosion/frame_${frameName}.png`);
    }

    // Thêm các frame cho cây lúa phát triển (16 frames) - load tất cả files trong thư mục seed
    const riceFrameFiles = [
        '1._Tiny_green_rice_seedling_sprout_emerg.png',
        '2._Tiny_green_rice_seedling_tilted_sligh.png',
        '3._Tiny_green_rice_seedling_standing_upr.png',
        '4._Tiny_green_rice_seedling_tilted_sligh.png',
        '5._Young_green_rice_plant_medium_height.png',
        '6._Young_green_rice_plant_leaning_slight.png',
        '7._Young_green_rice_plant_standing_uprig.png',
        '8._Young_green_rice_plant_leaning_slight.png',
        '9._Tall_green_rice_plant_with_flowering.png',
        '10._Tall_green_rice_plant_with_flowers_s.png',
        '11._Tall_green_rice_plant_with_flowers_s.png',
        '12._Tall_green_rice_plant_with_flowers_s.png',
        '13._Mature_golden_yellow_rice_plant_read.png',
        '14._Mature_golden_yellow_rice_plant_with.png',
        '15._Mature_golden_yellow_rice_plant_with.png',
        '16._Mature_golden_yellow_rice_plant_with.png'
    ];
    riceFrameFiles.forEach(file => assetsToLoad.push(`/assets/seed/${file}`));

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
        const dFrames = [];
        const sFrames = [];
        const slFrames = [];
        const sleepingFrames = [];
        for (let i = 0; i < 6; i++) {
            wFrames.push(Assets.get(`${walkBaseDir}${dir}/frame_00${i}.png`));
        }
        for (let i = 0; i < 4; i++) {
            iFrames.push(Assets.get(`${idleBaseDir}${dir}/frame_00${i}.png`));
        }
        for (let i = 0; i < 6; i++) {
            aFrames.push(Assets.get(`${attackBaseDir}${dir}/frame_00${i}.png`));
        }
        for (let i = 0; i < 9; i++) {
            dFrames.push(Assets.get(`${digBaseDir}${dir}/frame_00${i}.png`));
        }
        for (let i = 0; i < 9; i++) {
            sFrames.push(Assets.get(`${seedingBaseDir}${dir}/frame_00${i}.png`));
        }
        for (let i = 0; i < 9; i++) {
            slFrames.push(Assets.get(`${sleepBaseDir}${dir}/frame_00${i}.png`));
        }
        // Load sleeping animation frames
        // east, south, west có frame 003-015
        // north, north-east, north-west, south-east, south-west có frame 004-015
        const startFrame = (dir === 'east' || dir === 'south' || dir === 'west') ? 3 : 4;
        for (let i = startFrame; i <= 15; i++) {
            const frameNum = i < 10 ? `00${i}` : `0${i}`;
            sleepingFrames.push(Assets.get(`${sleepingBaseDir}${dir}/frame_${frameNum}.png`));
        }
        walkAnimations[dir] = wFrames;
        idleAnimations[dir] = iFrames;
        attackAnimations[dir] = aFrames;
        digAnimations[dir] = dFrames;
        seedingAnimations[dir] = sFrames;
        sleepAnimations[dir] = slFrames;
        sleepingAnimations[dir] = sleepingFrames;
    });

    // Load explosion frames
    for (let i = 0; i < 16; i++) {
        const frameName = i < 10 ? `00${i}` : `0${i}`;
        explosionFrames.push(Assets.get(`/assets/Skills/Explosion/frame_${frameName}.png`));
    }

    // Load rice growth frames (16 frames) - Chia thành 4 giai đoạn
    const riceGrowthFrames = {
        stage1: [], // Frames 1-4: Mầm non
        stage2: [], // Frames 5-8: Cây non
        stage3: [], // Frames 9-12: Cây cao có hoa
        stage4: []  // Frames 13-16: Cây chín vàng
    };
    
    // Stage 1: Mầm non (frames 1-4) - lặp lại để animation mượt hơn
    for (let i = 0; i < 4; i++) {
        riceGrowthFrames.stage1.push(Assets.get(`/assets/seed/${riceFrameFiles[i]}`));
    }
    // Lặp lại frame 1-4 để tạo animation loop mượt hơn
    riceGrowthFrames.stage1.push(riceGrowthFrames.stage1[0], riceGrowthFrames.stage1[1], riceGrowthFrames.stage1[2], riceGrowthFrames.stage1[3]);
    
    // Stage 2: Cây non (frames 5-8) - lặp lại để animation mượt hơn
    for (let i = 4; i < 8; i++) {
        riceGrowthFrames.stage2.push(Assets.get(`/assets/seed/${riceFrameFiles[i]}`));
    }
    // Lặp lại frame 5-8 để tạo animation loop mượt hơn
    riceGrowthFrames.stage2.push(riceGrowthFrames.stage2[0], riceGrowthFrames.stage2[1], riceGrowthFrames.stage2[2], riceGrowthFrames.stage2[3]);
    
    // Stage 3: Cây cao có hoa (frames 9-12) - lặp lại để animation mượt hơn
    for (let i = 8; i < 12; i++) {
        riceGrowthFrames.stage3.push(Assets.get(`/assets/seed/${riceFrameFiles[i]}`));
    }
    // Lặp lại frame 9-12 để tạo animation loop mượt hơn
    riceGrowthFrames.stage3.push(riceGrowthFrames.stage3[0], riceGrowthFrames.stage3[1], riceGrowthFrames.stage3[2], riceGrowthFrames.stage3[3]);
    
    // Stage 4: Cây chín vàng (frames 13-16) - lặp lại để animation mượt hơn
    for (let i = 12; i < 16; i++) {
        riceGrowthFrames.stage4.push(Assets.get(`/assets/seed/${riceFrameFiles[i]}`));
    }
    // Lặp lại frame 13-16 để tạo animation loop mượt hơn
    riceGrowthFrames.stage4.push(riceGrowthFrames.stage4[0], riceGrowthFrames.stage4[1], riceGrowthFrames.stage4[2], riceGrowthFrames.stage4[3]);

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

    // Load collider data theo object type ID từ server
    let objectColliderDataByType = {};
    try {
        const response = await fetch(`${SOCKET_URL}/get-all-object-collider-data`);
        const result = await response.json();
        objectColliderDataByType = result.allColliderData || {};
        console.log("✅ Loaded object collider data by type:", Object.keys(objectColliderDataByType));
    } catch (err) {
        console.error("❌ Lỗi load object collider data by type:", err);
    }

    // === RENDER CHUNKS (NEW SYSTEM) ===
    console.log('🗺️ [CHUNK] Using chunk-based map loading system');
    
    // Load 9 chunks xung quanh spawn point (0, 0)
    console.log('📦 [CHUNK] Loading initial 3x3 chunk grid...');
    const spawnX = worldmapData?.spawnPoint?.x || 500;
    const spawnY = worldmapData?.spawnPoint?.y || 500;
    
    const initialLoadResult = await chunkLoader.loadChunksAroundPlayer(spawnX, spawnY);
    
    if (initialLoadResult.loaded.length > 0) {
        console.log(`✅ [CHUNK] Loaded ${initialLoadResult.loaded.length} initial chunks`);
        for (const chunk of initialLoadResult.loaded) {
            await renderChunk(chunk, world, objectSprites, collidableObjects, debugGraphics, collisionData);
        }
    } else {
        console.error('❌ [CHUNK] Failed to load initial chunks');
        
        // === FALLBACK: RENDER OLD MAP SYSTEM ===
        if (mapConfig && mapConfig.zones) {
        console.log('🗺️ Rendering old map system (zones)...');
        mapConfig.zones.forEach(zone => {
            const texture = Assets.get(zone.texture);
            const zoneSprite = new TilingSprite({
                texture,
                width: zone.width,
                height: zone.height,
            });
            zoneSprite.x = zone.x;
            zoneSprite.y = zone.y;
            zoneSprite.zIndex = 0;
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

                    const hitData = collisionData[path];
                    if (hitData) {
                        let hitPoints, zIndexUpPoints, zIndexDownPoints, triggerZonePoints;
                        if (Array.isArray(hitData)) {
                            hitPoints = hitData;
                            zIndexUpPoints = [];
                            zIndexDownPoints = [];
                            triggerZonePoints = [];
                        } else {
                            hitPoints = hitData.normal || [];
                            zIndexUpPoints = hitData.z_index_up || [];
                            zIndexDownPoints = hitData.z_index_down || [];
                            triggerZonePoints = hitData.trigger_zone || [];
                        }

                        collidableObjects.push({
                            x: sprite.x,
                            y: sprite.y,
                            scale: scale,
                            anchor: sprite.anchor,
                            points: hitPoints,
                            zIndexUpPoints: zIndexUpPoints,
                            zIndexDownPoints: zIndexDownPoints,
                            triggerZonePoints: triggerZonePoints,
                            width: objTexture.width,
                            height: objTexture.height,
                            sprite: sprite
                        });

                        const g = new Graphics();
                        g.beginFill(0xff0000, 0.5);
                        hitPoints.forEach(p => {
                            const px = (p.x - objTexture.width * sprite.anchor.x) * scale;
                            const py = (p.y - objTexture.height * sprite.anchor.y) * scale;
                            g.drawRect(sprite.x + px, sprite.y + py, scale, scale);
                        });
                        if (zIndexUpPoints.length > 0) {
                            g.beginFill(0x00ff00, 0.5);
                            zIndexUpPoints.forEach(p => {
                                const px = (p.x - objTexture.width * sprite.anchor.x) * scale;
                                const py = (p.y - objTexture.height * sprite.anchor.y) * scale;
                                g.drawRect(sprite.x + px, sprite.y + py, scale, scale);
                            });
                        }
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
        } // end if (mapConfig && mapConfig.zones)
    } // end else (fallback)

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

    // Nút Tele Neural
    const teleNeuralBtn = document.getElementById('tele-neural-btn');
    if (teleNeuralBtn) {
        teleNeuralBtn.addEventListener('click', async () => {
            try {
                const response = await fetch(`${SOCKET_URL}/tele-neural-to-player`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        x: characterContainer.x,
                        y: characterContainer.y,
                        dir: currentDir
                    })
                });
                const data = await response.json();
                if (data.success) {
                    console.log(`⚡ Teleported Neural đến vị trí của bạn (${data.x}, ${data.y})`);
                    alert(`⚡ Đã tele Neural đến vị trí của bạn!`);
                } else {
                    console.error("❌ Tele thất bại:", data.error);
                    alert("❌ Tele thất bại!");
                }
            } catch (err) {
                console.error("❌ Lỗi tele Neural:", err);
                alert("❌ Lỗi kết nối server!");
            }
        });
    }

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
    const checkSpecialCollider = (char, obj, points, useTriggerZone = false) => {
        if (!points || points.length === 0) return false;

        const charScale = char.scale.x;
        let charPoints = null;

        // Nếu useTriggerZone = true, dùng triggerZonePoints
        if (useTriggerZone && char.colliderData && char.colliderData.triggerZonePoints) {
            charPoints = char.colliderData.triggerZonePoints;
        } else {
            charPoints = char.colliderData && char.colliderData.hasPixelCollider ? char.colliderData.points : null;
        }

        // Nếu player có pixel collider
        if (charPoints) {
            for (let cp of charPoints) {
                const charPx = char.x + (cp.x - char.colliderData.width * 0.5) * charScale;
                const charPy = char.y + (cp.y - char.colliderData.height * 0.5) * charScale;

                for (let p of points) {
                    const objPx = obj.x + (p.x - obj.width * obj.anchor.x) * obj.scale;
                    const objPy = obj.y + (p.y - obj.height * obj.anchor.y) * obj.scale;

                    const distX = Math.abs(charPx - objPx);
                    const distY = Math.abs(charPy - objPy);
                    const threshold = (obj.scale + charScale) / 2;

                    if (distX < threshold && distY < threshold) {
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

    // Rải các object cố định từ config vào thế giới (chỉ khi dùng old system)
    if (mapConfig && mapConfig.objects) {
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
                    let hitPoints, zIndexUpPoints, zIndexDownPoints, triggerZonePoints;
                    if (Array.isArray(hitData)) {
                        hitPoints = hitData;
                        zIndexUpPoints = [];
                        zIndexDownPoints = [];
                        triggerZonePoints = [];
                    } else {
                        hitPoints = hitData.normal || [];
                        zIndexUpPoints = hitData.z_index_up || [];
                        zIndexDownPoints = hitData.z_index_down || [];
                        triggerZonePoints = hitData.trigger_zone || [];
                    }

                    collidableObjects.push({
                        x: sprite.x,
                        y: sprite.y,
                        scale: sprite.scale.x,
                        anchor: sprite.anchor,
                        points: hitPoints,
                        zIndexUpPoints: zIndexUpPoints,
                        zIndexDownPoints: zIndexDownPoints,
                        triggerZonePoints: triggerZonePoints,
                        width: objTexture.width,
                        height: objTexture.height,
                        sprite: sprite,
                        path: path // Thêm path để debug
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

    // --- HÀM TẠO Ô ĐẤT ĐÃ ĐÀO ---
    const createFarmedTile = (x, y, saveToServer = true) => {
        // Kiểm tra xem vị trí này đã có ô đất đã đào chưa
        const tileSize = 32; // Kích thước grid
        const gridX = Math.round(x / tileSize) * tileSize;
        const gridY = Math.round(y / tileSize) * tileSize;

        // Kiểm tra xem đã có tile tại vị trí này chưa
        const existingTile = farmedTiles.find(tile => 
            Math.abs(tile.x - gridX) < tileSize / 2 && 
            Math.abs(tile.y - gridY) < tileSize / 2
        );

        if (existingTile) {
            console.log("⚠️ Vị trí này đã được đào rồi!");
            return;
        }

        // Tạo sprite đất đã đào - CHỈ DÙNG 1 TEXTURE
        const farmedTexture = Assets.get('/assets/Farming1/2D_game_asset_cultivated_farm (14).png');
        const farmedSprite = new AnimatedSprite([farmedTexture]);
        farmedSprite.x = gridX;
        farmedSprite.y = gridY;
        farmedSprite.anchor.set(0.5, 0.5);
        
        // Tính toán scale để sprite phủ kín grid
        const textureSize = farmedTexture.width;
        const targetSize = tileSize;
        const scale = targetSize / textureSize;
        farmedSprite.scale.set(scale);
        
        farmedSprite.isFixedGround = true;
        farmedSprite.zIndex = -1000000; // Nằm cố định dưới player và objects khác

        world.addChild(farmedSprite);
        farmedTiles.push(farmedSprite);

        // Lưu vào server nếu cần
        if (saveToServer) {
            fetch(`${SOCKET_URL}/save-farmed-tile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: gridX, y: gridY })
            }).catch(err => console.error("❌ Lỗi lưu farmed tile:", err));
        }

        console.log(`✅ Đã tạo ô đất đã đào tại (${gridX}, ${gridY}) với scale ${scale.toFixed(2)}`);
    };

    // --- HÀM LOAD FARMED TILES TỪ SERVER ---
    const loadFarmedTiles = async () => {
        try {
            const response = await fetch(`${SOCKET_URL}/get-farmed-tiles`);
            const data = await response.json();
            const tiles = data.tiles || [];
            
            console.log(`📦 Loading ${tiles.length} farmed tiles from server...`);
            
            tiles.forEach(tile => {
                createFarmedTile(tile.x, tile.y, false); // false = không lưu lại vào server
            });
            
            console.log(`✅ Loaded ${tiles.length} farmed tiles`);
        } catch (err) {
            console.error("❌ Lỗi load farmed tiles:", err);
        }
    };

    // Load farmed tiles từ server
    await loadFarmedTiles();

    // --- CROP MANAGEMENT ---
    const plantedCrops = []; // Lưu trữ các cây đã trồng
    let cropTypes = []; // Danh sách loại cây trồng
    let selectedCropType = null; // Loại cây đang được chọn
    let isSeeding = false; // Khóa di chuyển khi đang trồng cây

    // --- HÀM TẠO CÂY TRỒNG ---
    const createPlantedCrop = (x, y, cropData, saveToServer = true, plantedAt = null, plantedCropId = null) => {
        const tileSize = 32;
        const gridX = Math.round(x / tileSize) * tileSize;
        const gridY = Math.round(y / tileSize) * tileSize;

        // Kiểm tra xem vị trí này đã có cây chưa
        const existingCrop = plantedCrops.find(crop => 
            Math.abs(crop.x - gridX) < tileSize / 2 && 
            Math.abs(crop.y - gridY) < tileSize / 2
        );

        if (existingCrop) {
            console.log("⚠️ Vị trí này đã có cây trồng rồi!");
            return false;
        }

        // Tạo animated sprite cây trồng - BẮT ĐẦU TỪ STAGE 1
        const cropSprite = new AnimatedSprite(riceGrowthFrames.stage1);
        cropSprite.x = gridX;
        cropSprite.y = gridY;
        cropSprite.anchor.set(0.5, 1); // Anchor ở dưới để cây mọc lên từ đất
        cropSprite.scale.set(0.5); // Scale nhỏ lại cho phù hợp với tile 32x32
        cropSprite.zIndex = Math.floor(gridY * 10); // Depth sorting theo Y
        cropSprite.animationSpeed = 0.02; // Chậm để tạo hiệu ứng đung đưa
        cropSprite.loop = true;
        cropSprite.play();

        world.addChild(cropSprite);
        
        // Mapping stage -> path file cho collider data (dùng RICE_FRAME_FILES)
        const stageToPath = {
            1: `/assets/seed/${RICE_FRAME_FILES[0]}`, // Frame 1-4: Stage 1
            2: `/assets/seed/${RICE_FRAME_FILES[4]}`, // Frame 5-8: Stage 2
            3: `/assets/seed/${RICE_FRAME_FILES[8]}`, // Frame 9-12: Stage 3
            4: `/assets/seed/${RICE_FRAME_FILES[12]}` // Frame 13-16: Stage 4
        };
        
        // Load collider data cho crop - ưu tiên dùng objectTypeId từ database
        const objectTypeId = `crop_${cropData.id}`;
        let hitPoints = [], zIndexUpPoints = [], zIndexDownPoints = [], triggerZonePoints = [];
        
        const cropPath = stageToPath[1]; // Stage 1
        
        // Thử load collider data theo objectTypeId từ database
        if (objectColliderDataByType[objectTypeId]) {
            const colliderData = objectColliderDataByType[objectTypeId];
            hitPoints = colliderData.normal || [];
            zIndexUpPoints = colliderData.z_index_up || [];
            zIndexDownPoints = colliderData.z_index_down || [];
            triggerZonePoints = colliderData.trigger_zone || [];
        } else {
            // Fallback: load từ collision_data.json theo path
            const hitData = collisionData[cropPath];
            if (hitData) {
                if (Array.isArray(hitData)) {
                    hitPoints = hitData;
                } else {
                    hitPoints = hitData.normal || [];
                    zIndexUpPoints = hitData.z_index_up || [];
                    zIndexDownPoints = hitData.z_index_down || [];
                    triggerZonePoints = hitData.trigger_zone || [];
                }
            }
        }

        const cropObject = {
            sprite: cropSprite,
            x: gridX,
            y: gridY,
            cropData: cropData,
            plantedAt: plantedAt || Date.now(),
            currentStage: 1, // Bắt đầu từ stage 1
            maxStage: 4, // Tổng cộng 4 giai đoạn
            // Collider data - dùng plantedCropId làm objectTypeId để mỗi cây có ID riêng
            objectTypeId: plantedCropId ? `planted_crop_${plantedCropId}` : `crop_${cropData.id}`,
            points: hitPoints,
            zIndexUpPoints: zIndexUpPoints,
            zIndexDownPoints: zIndexDownPoints,
            triggerZonePoints: triggerZonePoints,
            width: cropSprite.texture.width,
            height: cropSprite.texture.height,
            scale: 0.5,
            anchor: cropSprite.anchor,
            path: cropPath,
            stageToPath: stageToPath, // Lưu mapping để update khi crop lớn lên
            plantedCropId: plantedCropId // Lưu ID của planted crop từ database
        };
        
        plantedCrops.push(cropObject);

        // Thêm crop vào collidableObjects để check special collider
        collidableObjects.push(cropObject);

        // Lưu vào server nếu cần
        if (saveToServer) {
            fetch(`${SOCKET_URL}/plant-crop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: gridX, y: gridY, cropTypeId: cropData.id })
            }).catch(err => console.error("❌ Lỗi lưu planted crop:", err));
        }

        console.log(`✅ Đã trồng ${cropData.display_name} tại (${gridX}, ${gridY}) - Stage 1`);
        return true;
    };

    // --- HÀM LOAD CROP TYPES TỪ SERVER ---
    const loadCropTypes = async () => {
        try {
            const response = await fetch(`${SOCKET_URL}/get-crop-types`);
            const data = await response.json();
            cropTypes = data.cropTypes || [];

            console.log(`📦 Loaded ${cropTypes.length} crop types`);

            // Tự động chọn loại cây đầu tiên
            if (cropTypes.length > 0) {
                selectedCropType = cropTypes[0];
                updateCropSelectionUI();
            }
        } catch (err) {
            console.error("❌ Lỗi load crop types:", err);
        }
    };

    // --- HÀM LOAD PLANTED CROPS TỪ SERVER ---
    const loadPlantedCrops = async () => {
        try {
            const response = await fetch(`${SOCKET_URL}/get-planted-crops`);
            const data = await response.json();
            const crops = data.crops || [];
            
            crops.forEach((crop, index) => {
                const cropData = {
                    id: crop.crop_type_id,
                    name: crop.crop_name,
                    display_name: crop.display_name,
                    sprite_path: crop.sprite_path
                };
                // Parse planted_at từ server (SQLite datetime format)
                const plantedAt = new Date(crop.planted_at).getTime();
                createPlantedCrop(crop.x, crop.y, cropData, false, plantedAt, crop.id);
            });
        } catch (err) {
            console.error("❌ Lỗi load planted crops:", err);
        }
    };

    // --- HÀM CẬP NHẬT UI CHỌN CÂY ---
    const updateCropSelectionUI = () => {
        const cropList = document.getElementById('crop-list');
        if (!cropList) return;

        cropList.innerHTML = '';
        
        cropTypes.forEach(crop => {
            const isSelected = selectedCropType && selectedCropType.id === crop.id;
            const cropItem = document.createElement('div');
            cropItem.style.cssText = `
                padding: 10px;
                background: ${isSelected ? 'rgba(46, 204, 113, 0.3)' : 'rgba(255, 255, 255, 0.1)'};
                border: 2px solid ${isSelected ? '#2ecc71' : 'transparent'};
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.2s;
                color: white;
                font-weight: ${isSelected ? 'bold' : 'normal'};
            `;
            cropItem.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 20px;">🌾</span>
                    <span>${crop.display_name}</span>
                </div>
            `;
            
            cropItem.addEventListener('mouseenter', () => {
                if (!isSelected) {
                    cropItem.style.background = 'rgba(255, 255, 255, 0.2)';
                }
            });
            
            cropItem.addEventListener('mouseleave', () => {
                if (!isSelected) {
                    cropItem.style.background = 'rgba(255, 255, 255, 0.1)';
                }
            });
            
            cropItem.addEventListener('click', () => {
                selectedCropType = crop;
                updateCropSelectionUI();
                console.log(`✅ Đã chọn: ${crop.display_name}`);
            });
            
            cropList.appendChild(cropItem);
        });
    };

    // Load crop types và planted crops
    await loadCropTypes();
    await loadPlantedCrops();

    // Lắng nghe click chuột trái để tung chiêu
    app.canvas.addEventListener('pointerdown', (e) => {
        if (e.button === 0 && isGameStarted) { // 0 là chuột trái
            e.preventDefault(); // Ngăn chặn các sự kiện mặc định khác
            
            // Kiểm tra có skill không
            if (playerSkills.length === 0) {
                console.warn("⚠️ Bạn chưa có kỹ năng nào!");
                return;
            }

            const skill = playerSkills[0]; // Skill đầu tiên (Fireball)
            const cooldownData = skillCooldowns[skill.skill_id];
            const remaining = Math.max(0, cooldownData.cooldownTime - cooldownData.elapsed);
            console.log(`🔍 Check: elapsed=${cooldownData.elapsed.toFixed(2)}, cooldownTime=${cooldownData.cooldownTime}, remaining=${remaining.toFixed(2)}`);

            // Kiểm tra cooldown
            if (remaining > 0) {
                console.warn(`⏱️ Kỹ năng đang hồi chiêu: ${remaining.toFixed(1)}s`);
                return;
            }

            // Kiểm tra MP TRƯỚC khi phát hiệu ứng
            if (playerStats.mp < skill.mp_cost) {
                console.warn(`❌ Không đủ MP! Cần ${skill.mp_cost}, hiện có ${playerStats.mp}`);
                return;
            }

            console.log("🖱️ Left click detected, playerSkills:", playerSkills.length);

            // Trừ MP
            playerStats.mp -= skill.mp_cost;
            console.log(`✅ Click attack! MP: ${playerStats.mp}/${playerStats.maxMp}`);

            // Ghi nhận sử dụng skill
            fetch(`${SOCKET_URL}/use-skill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: myGameId, skillId: skill.skill_id })
            }).catch(err => console.error("❌ Lỗi record skill:", err));

            // Reset cooldown
            skillCooldowns[skill.skill_id].elapsed = 0;
            isSkillOnCooldown = true;
            console.log(`🔄 Cooldown reset! Elapsed: 0, Cooldown time: ${skill.cooldown_time}s`);

            // Chuyển đổi tọa độ click màn hình sang tọa độ trong world
            const rect = app.canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left);
            const mouseY = (e.clientY - rect.top);

            // Tính toán vị trí trong world dựa trên camera (world.x, world.y) và scale
            const worldX = (mouseX - world.x) / world.scale.x;
            const worldY = (mouseY - world.y) / world.scale.y;

            console.log(`💥 Fireball at click (${worldX.toFixed(0)}, ${worldY.toFixed(0)})`);
            playExplosionSkill(worldX, worldY);

            // Gửi event skill cho người chơi khác
            socket.emit("playerSkill", {
                targetX: worldX,
                targetY: worldY
            });

            // Trigger animation tấn công của nhân vật - CHỈ CHẠY KHI ĐỦ ĐIỀU KIỆN SKILL
            if (!isAttacking) {
                isAttacking = true;
                isMoving = false; // Ngừng di chuyển ngay lập tức
                
                character.textures = attackAnimations[currentDir];
                character.animationSpeed = 0.2; // Tốc độ animation attack
                character.loop = false;
                character.gotoAndPlay(0);
                character.onComplete = () => {
                    isAttacking = false; // Mở khóa di chuyển
                    character.textures = idleAnimations[currentDir];
                    character.animationSpeed = 0.05; // Tốc độ idle
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
    let isAttacking = false; // Khóa di chuyển khi đang tấn công
    let isDigging = false; // Khóa di chuyển khi đang đào đất
    let isSleeping = false; // Khóa di chuyển khi đang ngủ
    let isSkillOnCooldown = false; // Đang trong cooldown
    let zIndexOverride = null; // Lưu z-index được điều chỉnh bởi special collider
    let shakeOffset = { x: 0, y: 0 }; // Offset cho hiệu ứng rung màn hình
    let playerStats = {
        hp: 100,
        maxHp: 100,
        mp: 50,
        maxMp: 50,
        moveSpeed: 4
    };

    // --- KHAI BÁO SKILLS ---
    let playerSkills = [];
    let skillCooldowns = {}; // { skillId: { cooldownTime, lastUsed } }

    // --- HÀM CẬP NHẬT UI HP/MP ---
    const updateStatsUI = () => {
        const hpPercent = (playerStats.hp / playerStats.maxHp) * 100;
        const mpPercent = (playerStats.mp / playerStats.maxMp) * 100;
        
        const hpBar = document.getElementById('hp-bar');
        const mpBar = document.getElementById('mp-bar');
        const hpText = document.getElementById('hp-text');
        const mpText = document.getElementById('mp-text');
        const positionText = document.getElementById('position-text');
        
        if (hpBar) hpBar.style.width = `${Math.max(0, Math.min(100, hpPercent))}%`;
        if (mpBar) mpBar.style.width = `${Math.max(0, Math.min(100, mpPercent))}%`;
        if (hpText) hpText.textContent = `${Math.max(0, playerStats.hp)}/${playerStats.maxHp}`;
        if (mpText) mpText.textContent = `${Math.max(0, playerStats.mp)}/${playerStats.maxMp}`;
        
        // Update position display (using characterContainer)
        if (positionText) {
            if (typeof characterContainer !== 'undefined' && characterContainer && characterContainer.visible) {
                const x = Math.round(characterContainer.x);
                const y = Math.round(characterContainer.y);
                positionText.textContent = `X: ${x}, Y: ${y}`;
            } else {
                positionText.textContent = `X: -, Y: -`;
            }
        }
    };

    // --- HÀM CẬP NHẬT UI SKILLS COOLDOWN ---
    const updateSkillsUI = () => {
        playerSkills.forEach((skill, index) => {
            const skillPanel = document.getElementById(`skill-${index}`);
            if (!skillPanel) return;

            const cooldownData = skillCooldowns[skill.skill_id];
            if (!cooldownData) return;

            const remaining = Math.max(0, cooldownData.cooldownTime - cooldownData.elapsed);
            const cooldownPercent = (remaining / cooldownData.cooldownTime) * 100;

            const cooldownBar = skillPanel.querySelector('.skill-cooldown-bar');
            const cooldownText = skillPanel.querySelector('.skill-cooldown-text');

            if (cooldownBar) {
                cooldownBar.style.width = `${cooldownPercent}%`;
                cooldownBar.style.opacity = remaining > 0 ? '0.8' : '0';
            }
            if (cooldownText) {
                cooldownText.textContent = remaining > 0 ? remaining.toFixed(1) : '';
            }

            // Disable/Enable button
            const skillBtn = skillPanel.querySelector('.skill-btn');
            if (skillBtn) {
                skillBtn.disabled = remaining > 0;
                skillBtn.style.opacity = remaining > 0 ? '0.5' : '1';
            }
        });
    };

    // --- HÀM LOAD SKILLS ---
    const loadPlayerSkills = async (username) => {
        try {
            const response = await fetch(`${SOCKET_URL}/get-skills`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const data = await response.json();
            playerSkills = data.skills || [];
            console.log("✅ Loaded skills:", playerSkills);

            // Khởi tạo cooldown cho mỗi skill
            playerSkills.forEach(skill => {
                skillCooldowns[skill.skill_id] = {
                    cooldownTime: skill.cooldown_time,
                    elapsed: skill.cooldown_time // Bắt đầu sẵn sàng
                };
            });

            // Tạo UI cho skills
            createSkillsUI();
        } catch (err) {
            console.error("❌ Lỗi load skills:", err);
        }
    };

    // --- HÀM TẠO UI SKILLS ---
    const createSkillsUI = () => {
        console.log("🎮 Creating skills UI for", playerSkills.length, "skills");
        const skillsContainer = document.getElementById('skills-container');
        if (!skillsContainer) {
            // Tạo container nếu chưa có
            const container = document.createElement('div');
            container.id = 'skills-container';
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 20px;
                display: flex;
                gap: 10px;
                z-index: 150;
            `;
            document.body.appendChild(container);
            console.log("✅ Created skills container");
        }

        const container = document.getElementById('skills-container');
        container.innerHTML = ''; // Clear old skills

        playerSkills.forEach((skill, index) => {
            console.log(`Creating skill button for: ${skill.skill_name}`);
            const skillPanel = document.createElement('div');
            skillPanel.id = `skill-${index}`;
            skillPanel.style.cssText = `
                position: relative;
                width: 60px;
                height: 60px;
                background: rgba(0, 0, 0, 0.7);
                border: 2px solid #1099bb;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            `;

            const skillBtn = document.createElement('button');
            skillBtn.className = 'skill-btn';
            skillBtn.textContent = `${index + 1}`;
            skillBtn.style.cssText = `
                width: 100%;
                height: 100%;
                background: transparent;
                border: none;
                color: white;
                font-weight: bold;
                font-size: 16px;
                cursor: pointer;
                transition: opacity 0.3s;
            `;

            skillBtn.onclick = () => useSkill(skill, index);

            const cooldownBar = document.createElement('div');
            cooldownBar.className = 'skill-cooldown-bar';
            cooldownBar.style.cssText = `
                position: absolute;
                bottom: 0;
                left: 0;
                height: 4px;
                background: linear-gradient(90deg, #ff6b6b, #ff8787);
                width: 0%;
                transition: width 0.1s;
            `;

            const cooldownText = document.createElement('div');
            cooldownText.className = 'skill-cooldown-text';
            cooldownText.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 12px;
                font-weight: bold;
                text-shadow: 0 0 4px rgba(0,0,0,0.8);
            `;

            skillPanel.appendChild(skillBtn);
            skillPanel.appendChild(cooldownBar);
            skillPanel.appendChild(cooldownText);

            container.appendChild(skillPanel);
        });
    };

    // --- HÀM SỬ DỤNG SKILL ---
    const useSkill = async (skill, index) => {
        console.log(`🎯 Attempting to use skill: ${skill.skill_name}`);
        const cooldownData = skillCooldowns[skill.skill_id];
        const remaining = Math.max(0, cooldownData.cooldownTime - cooldownData.elapsed);

        if (remaining > 0) {
            console.log(`⏱️ Skill ${skill.skill_name} còn ${remaining.toFixed(1)}s hồi chiêu`);
            return;
        }

        if (playerStats.mp < skill.mp_cost) {
            console.log(`❌ Không đủ MP! Cần ${skill.mp_cost}, hiện có ${playerStats.mp}`);
            return;
        }

        // Trừ MP
        playerStats.mp -= skill.mp_cost;
        console.log(`✅ Used skill ${skill.skill_name}, MP: ${playerStats.mp}/${playerStats.maxMp}`);

        // Ghi nhận sử dụng skill
        try {
            await fetch(`${SOCKET_URL}/use-skill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: myGameId, skillId: skill.skill_id })
            });
        } catch (err) {
            console.error("❌ Lỗi record skill:", err);
        }

        // Reset cooldown
        skillCooldowns[skill.skill_id].elapsed = 0;
        isSkillOnCooldown = true;

        // Phát hiệu ứng skill
        playSkillEffect(skill);

        console.log(`🎨 Playing skill effect for: ${skill.skill_name}`);
    };

    // --- HÀM PHÁT HIỆU ỨNG SKILL ---
    const playSkillEffect = (skill) => {
        console.log(`🎬 Playing skill effect for: ${skill.skill_type}`);
        if (skill.skill_type === 'fireball') {
            // Lấy tọa độ phía trước nhân vật
            const dirIndex = directions.indexOf(currentDir);
            const angle = (dirIndex / 8) * Math.PI * 2;
            const targetX = characterContainer.x + Math.cos(angle) * 100;
            const targetY = characterContainer.y + Math.sin(angle) * 100;

            console.log(`💥 Fireball at (${targetX.toFixed(0)}, ${targetY.toFixed(0)})`);
            playExplosionSkill(targetX, targetY);

            // Gửi skill cho người chơi khác
            socket.emit("playerSkill", {
                targetX: targetX,
                targetY: targetY
            });
        } else {
            console.warn(`⚠️ Unknown skill type: ${skill.skill_type}`);
        }
    };

    const characterContainer = new Container();
    characterContainer.visible = false; // Ẩn cho đến khi nhấn nút
    world.addChild(characterContainer); // Nhân vật thuộc về world

    const character = new AnimatedSprite(idleAnimations['south']);
    character.anchor.set(0.5, 0.55); // Anchor ở dưới chân
    character.animationSpeed = 0.05;
    character.play();
    characterContainer.addChild(character);

    // Nhãn tên trên đầu
    const nameTag = new Text({ text: '', style: nameStyle });
    nameTag.anchor.set(0.5, 1);
    nameTag.y = -60; // Điều chỉnh vị trí tên trên đầu
    characterContainer.addChild(nameTag);

    // Set initial spawn position from worldmap or default
    if (worldmapData && worldmapData.spawnPoint) {
        characterContainer.x = worldmapData.spawnPoint.x;
        characterContainer.y = worldmapData.spawnPoint.y;
        console.log(`✅ Player spawned at worldmap spawn point: (${worldmapData.spawnPoint.x}, ${worldmapData.spawnPoint.y})`);
    } else {
        characterContainer.x = 500;
        characterContainer.y = 500;
        console.log('⚠️ No spawn point found, using default (500, 500)');
    }
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
    let playerTriggerZonePoints = null;
    if (playerHitData) {
        if (Array.isArray(playerHitData)) {
            playerHitPoints = playerHitData;
        } else if (typeof playerHitData === 'object' && playerHitData.normal) {
            playerHitPoints = playerHitData.normal;
            playerTriggerZonePoints = playerHitData.trigger_zone || [];
        }
    }

    characterContainer.colliderData = {
        hasPixelCollider: !!playerHitPoints,
        points: playerHitPoints || null,
        triggerZonePoints: playerTriggerZonePoints || [],
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
    const accessCodeInput = document.getElementById('access-code');
    const createBtn = document.getElementById('create-btn');

    // === TELEPORT CHUNK FUNCTIONALITY ===
    const chunkXInput = document.getElementById('chunk-x-input');
    const chunkYInput = document.getElementById('chunk-y-input');
    const teleportChunkBtn = document.getElementById('teleport-chunk-btn');
    const currentChunkText = document.getElementById('current-chunk-text');
    const chunkStatusText = document.getElementById('chunk-status-text');

    // Update current chunk display
    const updateChunkUI = () => {
        if (!characterContainer || !characterContainer.visible) return;
        
        const { chunkX, chunkY } = chunkLoader.worldToChunk(characterContainer.x, characterContainer.y);
        if (currentChunkText) {
            currentChunkText.textContent = `Current: Chunk (${chunkX}, ${chunkY})`;
        }
        
        const isLoaded = chunkLoader.isChunkLoaded(chunkX, chunkY);
        if (chunkStatusText) {
            chunkStatusText.textContent = isLoaded ? '✅ Loaded' : '❌ Not Loaded';
            chunkStatusText.style.color = isLoaded ? '#2ecc71' : '#e74c3c';
        }
    };

    // Teleport to chunk event listener
    if (teleportChunkBtn) {
        teleportChunkBtn.addEventListener('click', async () => {
            const targetChunkX = parseInt(chunkXInput.value) || 0;
            const targetChunkY = parseInt(chunkYInput.value) || 0;
            
            console.log(`🚀 [TELEPORT] Teleporting to chunk (${targetChunkX}, ${targetChunkY})...`);
            
            try {
                // Load target chunk if not already loaded
                const targetChunk = await chunkLoader.loadChunk(targetChunkX, targetChunkY);
                
                if (targetChunk) {
                    // Render chunk if successfully loaded
                    await renderChunk(targetChunk, world, objectSprites, collidableObjects, debugGraphics, collisionData);
                    
                    // Calculate world position for chunk center
                    const chunkWorldX = targetChunkX * targetChunk.width * targetChunk.tileSize;
                    const chunkWorldY = targetChunkY * targetChunk.height * targetChunk.tileSize;
                    const centerX = chunkWorldX + (targetChunk.width * targetChunk.tileSize) / 2;
                    const centerY = chunkWorldY + (targetChunk.height * targetChunk.tileSize) / 2;
                    
                    // Teleport player to chunk center
                    characterContainer.x = centerX;
                    characterContainer.y = centerY;
                    
                    // Sync with server movement controller
                    if (window.serverMovement) {
                        window.serverMovement.syncPosition(centerX, centerY);
                    }
                    
                    console.log(`✅ [TELEPORT] Player teleported to chunk (${targetChunkX}, ${targetChunkY}) at world position (${centerX}, ${centerY})`);
                    
                    // Update UI
                    updateChunkUI();
                    
                    // Send position update to server (for backward compatibility)
                    socket.emit("playerMovement", {
                        x: characterContainer.x,
                        y: characterContainer.y,
                        dir: currentDir,
                        isMoving: false,
                        name: myGameId
                    });
                    
                } else {
                    console.error(`❌ [TELEPORT] Failed to load chunk (${targetChunkX}, ${targetChunkY})`);
                    alert(`❌ Chunk (${targetChunkX}, ${targetChunkY}) not found!`);
                }
            } catch (err) {
                console.error(`❌ [TELEPORT] Error:`, err);
                alert(`❌ Teleport failed: ${err.message}`);
            }
        });
    }

    // Auto-login function
    async function autoLogin(username, accessCode = '') {
        try {
            // Check if account exists with access code
            const checkResponse = await fetch(`${SOCKET_URL}/check-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, accessCode })
            });
            const checkData = await checkResponse.json();

            if (!checkData.exists) {
                // Create new account with access code
                const createResponse = await fetch(`${SOCKET_URL}/create-account`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, accessCode })
                });
                const createData = await createResponse.json();

                if (!createData.success) {
                    console.error("❌ Lỗi tạo tài khoản!");
                    return false;
                }
            }

            // Log auth level if provided
            if (checkData.authLevel) {
                console.log(`🔐 Auth Level: ${checkData.authLevel}`);
                if (checkData.authLevel === 'SUPREME_ADMIN') {
                    console.log(`👑 Chào mừng PoPi! PNeural đã sẵn sàng phục vụ.`);
                }
            }

            // Account exists or created successfully, proceed to game
            myGameId = username;
            if (checkData.playerState) {
                characterContainer.x = Number(checkData.playerState.x) || (worldmapData && worldmapData.spawnPoint ? worldmapData.spawnPoint.x : 500);
                characterContainer.y = Number(checkData.playerState.y) || (worldmapData && worldmapData.spawnPoint ? worldmapData.spawnPoint.y : 500);
                currentDir = checkData.playerState.dir || 'south';
                console.log(`✅ Loaded saved position: (${characterContainer.x}, ${characterContainer.y})`);
            }

            // Hide UI overlay
            document.getElementById('ui-overlay').style.display = 'none';

            // Start game
            startGame();
            return true;
        } catch (err) {
            console.error("❌ Auto-login error:", err);
            return false;
        }
    }

    // Check for auto-login data
    if (window.autoLoginData && window.autoLoginData.autoLogin) {
        console.log("🤖 Auto-login detected for:", window.autoLoginData.username);
        const { username, authLevel } = window.autoLoginData;
        const pNeuralCode = 'POPISUPREME2026';

        // Auto-login with API call to ensure account exists
        (async () => {
            try {
                // Check if account exists with access code
                const checkResponse = await fetch(`${SOCKET_URL}/check-account`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, accessCode: pNeuralCode })
                });
                const checkData = await checkResponse.json();

                if (!checkData.exists) {
                    // Create new account with access code
                    console.log("🤖 Creating Neural account...");
                    const createResponse = await fetch(`${SOCKET_URL}/create-account`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, accessCode: pNeuralCode })
                    });
                    const createData = await createResponse.json();

                    if (!createData.success) {
                        console.error("❌ Lỗi tạo tài khoản!");
                        return;
                    }
                }

                // Log auth level
                if (checkData.authLevel === 'SUPREME_ADMIN') {
                    console.log(`👑 Chào mừng PoPi! PNeural đã sẵn sàng phục vụ.`);
                }

                // Set game ID
                myGameId = username;

                // Load position
                if (checkData.playerState) {
                    characterContainer.x = Number(checkData.playerState.x) || (worldmapData && worldmapData.spawnPoint ? worldmapData.spawnPoint.x : 500);
                    characterContainer.y = Number(checkData.playerState.y) || (worldmapData && worldmapData.spawnPoint ? worldmapData.spawnPoint.y : 500);
                    currentDir = checkData.playerState.dir || 'south';
                    console.log(`✅ Loaded saved position: (${characterContainer.x}, ${characterContainer.y})`);
                }

                // Hide UI overlay and start game
                document.getElementById('ui-overlay').style.display = 'none';
                startGame();
            } catch (err) {
                console.error("❌ Auto-login error:", err);
            }
        })();
    } else {
        // Normal login flow
        createBtn.addEventListener('click', async () => {
            const username = gameIdInput.value.trim();
            const accessCode = accessCodeInput.value.trim();

            if (!username) {
                alert("Vui lòng nhập username!");
                return;
            }

            createBtn.disabled = true;
            createBtn.textContent = "Đang kiểm tra...";

            const success = await autoLogin(username, accessCode);

            if (!success) {
                createBtn.disabled = false;
                createBtn.textContent = "Tạo nhân vật";
            }
        });
    }

    // Function to start game
    function startGame() {
        character.textures = idleAnimations[currentDir];
        character.play();

        // Load stats from saved state
        if (window.autoLoginData && window.autoLoginData.playerState) {
            const playerState = window.autoLoginData.playerState;
            playerStats.hp = Number(playerState.hp) || 100;
            playerStats.maxHp = Number(playerState.max_hp) || 100;
            playerStats.mp = Number(playerState.mp) || 50;
            playerStats.maxMp = Number(playerState.max_mp) || 50;
            playerStats.moveSpeed = Number(playerState.move_speed) || 4;
        } else if (worldmapData && worldmapData.spawnPoint) {
            // New player - use spawn point
            characterContainer.x = worldmapData.spawnPoint.x;
            characterContainer.y = worldmapData.spawnPoint.y;
            console.log(`✅ New player spawned at: (${characterContainer.x}, ${characterContainer.y})`);
        }
        nameTag.text = myGameId;
        updateStatsUI(); // Cập nhật UI HP/MP
        loadPlayerSkills(myGameId); // Load skills

        uiOverlay.style.display = 'none'; // Ẩn UI
        characterContainer.visible = true; // Hiện nhân vật
        isGameStarted = true;

        // Initialize server movement controller
        window.serverMovement = new ServerMovementController(socket, characterContainer);
        console.log('🎮 Server movement controller initialized');

        // Hiển thị UI chọn cây trồng
        const cropPanel = document.getElementById('crop-selection-panel');
        if (cropPanel) {
            cropPanel.style.display = 'block';
        }

        console.log("Game started as:", myGameId);

        // Báo cho server biết mình tham gia
        socket.emit("newPlayer", {
            x: characterContainer.x,
            y: characterContainer.y,
            dir: currentDir,
            isMoving: false,
            isAttacking: false,
            name: myGameId,
            stats: playerStats
        });
    }

    // Hàm tạo nhân vật cho người chơi khác
    const createOtherPlayer = (id, data) => {
        if (otherPlayers[id]) return; // Đã tồn tại thì bỏ qua

        console.log("Creating other player:", data.name || id);
        const container = new Container();
        const sprite = new AnimatedSprite(idleAnimations[data.dir || 'south']);
        sprite.anchor.set(0.5, 1); // Anchor ở dưới chân
        sprite.animationSpeed = 0.05;
        sprite.play();
        container.addChild(sprite);

        // Nhãn tên người chơi khác
        const tag = new Text({ text: data.name || id, style: nameStyle });
        tag.anchor.set(0.5, 0);
        tag.y = -50;
        container.addChild(tag);

        container.x = data.x;
        container.y = data.y;
        container.scale.set(0.7); // Scale giống như main character

        world.addChild(container);

        otherPlayers[id] = {
            container,
            sprite,
            tag,
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

    // ============================================
    // Server Tick - Update all players positions
    // ============================================
    socket.on("serverTick", (playerStates) => {
        // Update all other players (not self - serverMovement handles self)
        for (const socketId in playerStates) {
            if (socketId === socket.id) continue; // Skip self
            
            const state = playerStates[socketId];
            const p = otherPlayers[socketId];
            
            if (p) {
                // Direct position update from server
                p.container.x = state.x;
                p.container.y = state.y;
                
                // Update name tag
                p.tag.text = state.name || socketId;
                
                // Update direction and movement state
                p.currentDir = state.dir;
                p.currentIsMoving = state.isMoving;
                
                // Update animation (only if not attacking)
                if (!p.isAttacking) {
                    if (state.isMoving) {
                        if (p.sprite.textures !== walkAnimations[state.dir]) {
                            p.sprite.textures = walkAnimations[state.dir];
                            p.sprite.animationSpeed = 0.15;
                            p.sprite.play();
                        }
                    } else {
                        if (p.sprite.textures !== idleAnimations[state.dir]) {
                            p.sprite.textures = idleAnimations[state.dir];
                            p.sprite.animationSpeed = 0.05;
                            p.sprite.play();
                        }
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

    // NHẬN EVENT ĐÀO ĐẤT (DIG) từ người chơi khác
    socket.on("playerDig", (data) => {
        console.log("Other player digs:", data.id, "at:", data.x, data.y, "dir:", data.dir);
        const otherPlayer = otherPlayers[data.id];
        if (otherPlayer && otherPlayer.sprite) {
            // Chuyển animation sang dig
            otherPlayer.sprite.textures = digAnimations[data.dir];
            otherPlayer.sprite.animationSpeed = 0.15;
            otherPlayer.sprite.loop = false;
            otherPlayer.sprite.gotoAndPlay(0);
            otherPlayer.sprite.onComplete = () => {
                // Quay về idle sau khi đào xong
                otherPlayer.sprite.textures = idleAnimations[data.dir];
                otherPlayer.sprite.animationSpeed = 0.05;
                otherPlayer.sprite.loop = true;
                otherPlayer.sprite.play();
            };
        }

        // Tạo ô đất đã đào tại vị trí người chơi khác đào
        createFarmedTile(data.x, data.y);
    });

    // NHẬN EVENT TRỒNG CÂY (SEED) từ người chơi khác
    socket.on("playerSeed", (data) => {
        console.log("Other player seeds:", data.id, "at:", data.x, data.y, "dir:", data.dir, "crop:", data.cropName);
        const otherPlayer = otherPlayers[data.id];
        if (otherPlayer && otherPlayer.sprite) {
            // Chuyển animation sang seeding
            otherPlayer.sprite.textures = seedingAnimations[data.dir];
            otherPlayer.sprite.animationSpeed = 0.15;
            otherPlayer.sprite.loop = false;
            otherPlayer.sprite.gotoAndPlay(0);
            otherPlayer.sprite.onComplete = () => {
                // Quay về idle sau khi trồng xong
                otherPlayer.sprite.textures = idleAnimations[data.dir];
                otherPlayer.sprite.animationSpeed = 0.05;
                otherPlayer.sprite.loop = true;
                otherPlayer.sprite.play();
            };
        }

        // Tạo cây trồng tại vị trí người chơi khác trồng
        const cropData = {
            id: data.cropTypeId,
            display_name: data.cropName
        };
        createPlantedCrop(data.x, data.y, cropData, false);
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
    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        
        // Xử lý phím V - Kỹ năng Sleep (Ngủ)
        if (e.code === 'KeyV' && isGameStarted && !isDigging && !isAttacking && !isSeeding && !isSleeping) {
            console.log('🔍 [SLEEP DEBUG] Phím V được nhấn');
            
            // Tìm skill Sleep
            const sleepSkill = playerSkills.find(s => s.skill_type === 'sleep');
            console.log('🔍 [SLEEP DEBUG] Sleep skill:', sleepSkill);
            
            if (!sleepSkill) {
                console.warn("⚠️ Bạn chưa có kỹ năng Sleep!");
                return;
            }

            const cooldownData = skillCooldowns[sleepSkill.skill_id];
            console.log('🔍 [SLEEP DEBUG] Cooldown data:', cooldownData);
            
            const remaining = Math.max(0, cooldownData.cooldownTime - cooldownData.elapsed);

            // Kiểm tra cooldown
            if (remaining > 0) {
                console.warn(`⏱️ Kỹ năng Sleep đang hồi chiêu: ${remaining.toFixed(1)}s`);
                return;
            }

            // Kiểm tra MP (sleep không tốn MP nhưng vẫn check)
            if (playerStats.mp < sleepSkill.mp_cost) {
                console.warn(`❌ Không đủ MP! Cần ${sleepSkill.mp_cost}, hiện có ${playerStats.mp}`);
                return;
            }

            // Trừ MP (nếu có)
            if (sleepSkill.mp_cost > 0) {
                playerStats.mp -= sleepSkill.mp_cost;
                console.log(`✅ Sử dụng Sleep! MP: ${playerStats.mp}/${playerStats.maxMp}`);
            } else {
                console.log(`✅ Sử dụng Sleep! (Không tốn MP)`);
            }

            // Ghi nhận sử dụng skill
            fetch(`${SOCKET_URL}/use-skill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: myGameId, skillId: sleepSkill.skill_id })
            }).catch(err => console.error("❌ Lỗi record skill:", err));

            // Reset cooldown
            skillCooldowns[sleepSkill.skill_id].elapsed = 0;
            console.log('🔍 [SLEEP DEBUG] Cooldown reset');

            // Trigger animation sleep (chạy 1 lần)
            isSleeping = true;
            isMoving = false;
            
            console.log('🔍 [SLEEP DEBUG] Current direction:', currentDir);
            console.log('🔍 [SLEEP DEBUG] Sleep animations:', sleepAnimations);
            console.log('🔍 [SLEEP DEBUG] Sleep animation for direction:', sleepAnimations[currentDir]);
            
            character.textures = sleepAnimations[currentDir];
            character.animationSpeed = 0.2;
            character.loop = false;
            character.gotoAndPlay(0);
            
            console.log('🔍 [SLEEP DEBUG] Sleep animation started');
            
            // Sau khi animation sleep kết thúc, chuyển sang sleeping (lặp liên tục)
            character.onComplete = () => {
                console.log('🔍 [SLEEP DEBUG] Sleep animation completed, switching to sleeping loop');
                
                // Chuyển sang animation sleeping và lặp liên tục
                character.textures = sleepingAnimations[currentDir];
                character.animationSpeed = 0.1;
                character.loop = true;
                character.gotoAndPlay(0);
                
                console.log('🔍 [SLEEP DEBUG] Sleeping animation started (looping)');
            };

            // Gửi event sleep cho người chơi khác
            socket.emit("playerSleep", {
                x: characterContainer.x,
                y: characterContainer.y,
                dir: currentDir
            });
        }

        // Xử lý phím T - Kỹ năng Seeding (Trồng cây)
        if (e.code === 'KeyT' && isGameStarted && !isDigging && !isAttacking && !isSeeding) {
            // Kiểm tra đã chọn loại cây chưa
            if (!selectedCropType) {
                console.warn("⚠️ Bạn chưa chọn loại cây để trồng!");
                return;
            }

            // Tìm skill Seeding
            const seedingSkill = playerSkills.find(s => s.skill_type === 'seeding');
            if (!seedingSkill) {
                console.warn("⚠️ Bạn chưa có kỹ năng Seeding!");
                return;
            }

            // Kiểm tra xem vị trí hiện tại có phải là đất đã đào không
            const tileSize = 32;
            const gridX = Math.round(characterContainer.x / tileSize) * tileSize;
            const gridY = Math.round(characterContainer.y / tileSize) * tileSize;
            
            const isFarmedTile = farmedTiles.find(tile => 
                Math.abs(tile.x - gridX) < tileSize / 2 && 
                Math.abs(tile.y - gridY) < tileSize / 2
            );

            if (!isFarmedTile) {
                console.warn("⚠️ Bạn phải đứng trên đất đã đào mới có thể trồng cây!");
                return;
            }

            // Kiểm tra xem vị trí này đã có cây chưa
            const hasPlantedCrop = plantedCrops.find(crop => 
                Math.abs(crop.x - gridX) < tileSize / 2 && 
                Math.abs(crop.y - gridY) < tileSize / 2
            );

            if (hasPlantedCrop) {
                console.warn("⚠️ Vị trí này đã có cây trồng rồi!");
                return;
            }

            const cooldownData = skillCooldowns[seedingSkill.skill_id];
            const remaining = Math.max(0, cooldownData.cooldownTime - cooldownData.elapsed);

            // Kiểm tra cooldown
            if (remaining > 0) {
                console.warn(`⏱️ Kỹ năng Seeding đang hồi chiêu: ${remaining.toFixed(1)}s`);
                return;
            }

            // Kiểm tra MP
            if (playerStats.mp < seedingSkill.mp_cost) {
                console.warn(`❌ Không đủ MP! Cần ${seedingSkill.mp_cost}, hiện có ${playerStats.mp}`);
                return;
            }

            // Trừ MP
            playerStats.mp -= seedingSkill.mp_cost;
            console.log(`✅ Sử dụng Seeding! MP: ${playerStats.mp}/${playerStats.maxMp}`);

            // Ghi nhận sử dụng skill
            fetch(`${SOCKET_URL}/use-skill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: myGameId, skillId: seedingSkill.skill_id })
            }).catch(err => console.error("❌ Lỗi record skill:", err));

            // Reset cooldown
            skillCooldowns[seedingSkill.skill_id].elapsed = 0;

            // Trigger animation seeding
            isSeeding = true;
            isMoving = false;
            
            character.textures = seedingAnimations[currentDir];
            character.animationSpeed = 0.15;
            character.loop = false;
            character.gotoAndPlay(0);
            character.onComplete = () => {
                isSeeding = false;
                character.textures = idleAnimations[currentDir];
                character.animationSpeed = 0.05;
                character.loop = true;
                character.play();
            };

            // Tạo cây trồng tại vị trí player
            createPlantedCrop(characterContainer.x, characterContainer.y, selectedCropType);

            // Gửi event seed cho người chơi khác
            socket.emit("playerSeed", {
                x: characterContainer.x,
                y: characterContainer.y,
                dir: currentDir,
                cropTypeId: selectedCropType.id,
                cropName: selectedCropType.display_name
            });
        }
        
        // Xử lý phím F - Kỹ năng Farming (Dig)
        if (e.code === 'KeyF' && isGameStarted && !isDigging && !isAttacking && !isSeeding && !isSleeping) {
            // Tìm skill Farming
            const farmingSkill = playerSkills.find(s => s.skill_type === 'farming');
            if (!farmingSkill) {
                console.warn("⚠️ Bạn chưa có kỹ năng Farming!");
                return;
            }

            const cooldownData = skillCooldowns[farmingSkill.skill_id];
            const remaining = Math.max(0, cooldownData.cooldownTime - cooldownData.elapsed);

            // Kiểm tra cooldown
            if (remaining > 0) {
                console.warn(`⏱️ Kỹ năng Farming đang hồi chiêu: ${remaining.toFixed(1)}s`);
                return;
            }

            // Kiểm tra MP
            if (playerStats.mp < farmingSkill.mp_cost) {
                console.warn(`❌ Không đủ MP! Cần ${farmingSkill.mp_cost}, hiện có ${playerStats.mp}`);
                return;
            }

            // Trừ MP
            playerStats.mp -= farmingSkill.mp_cost;
            console.log(`✅ Sử dụng Farming! MP: ${playerStats.mp}/${playerStats.maxMp}`);

            // Ghi nhận sử dụng skill
            fetch(`${SOCKET_URL}/use-skill`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: myGameId, skillId: farmingSkill.skill_id })
            }).catch(err => console.error("❌ Lỗi record skill:", err));

            // Reset cooldown
            skillCooldowns[farmingSkill.skill_id].elapsed = 0;

            // Trigger animation dig
            isDigging = true;
            isMoving = false;
            
            character.textures = digAnimations[currentDir];
            character.animationSpeed = 0.15;
            character.loop = false;
            character.gotoAndPlay(0);
            character.onComplete = () => {
                isDigging = false;
                character.textures = idleAnimations[currentDir];
                character.animationSpeed = 0.05;
                character.loop = true;
                character.play();
            };

            // Tạo ô đất đã đào tại vị trí player
            createFarmedTile(characterContainer.x, characterContainer.y);

            // Gửi event dig cho người chơi khác
            socket.emit("playerDig", {
                x: characterContainer.x,
                y: characterContainer.y,
                dir: currentDir
            });
        }
        
        // Test HP/MP - Phím 1 để giảm HP, Phím 2 để tăng HP, Phím 3 để giảm MP, Phím 4 để tăng MP
        if (isGameStarted) {
            if (e.code === 'Digit1') {
                playerStats.hp = Math.max(0, playerStats.hp - 10);
                console.log(`HP: ${playerStats.hp}/${playerStats.maxHp}`);
            }
            if (e.code === 'Digit2') {
                playerStats.hp = Math.min(playerStats.maxHp, playerStats.hp + 10);
                console.log(`HP: ${playerStats.hp}/${playerStats.maxHp}`);
            }
            if (e.code === 'Digit3') {
                playerStats.mp = Math.max(0, playerStats.mp - 5);
                console.log(`MP: ${playerStats.mp}/${playerStats.maxMp}`);
            }
            if (e.code === 'Digit4') {
                playerStats.mp = Math.min(playerStats.maxMp, playerStats.mp + 5);
                console.log(`MP: ${playerStats.mp}/${playerStats.maxMp}`);
            }
        }
    });
    window.addEventListener('keyup', e => keys[e.code] = false);

    // XỬ LÝ TẤN CÔNG (Click chuột trái)
    // Biến isAttacking đã được khai báo ở trên phần KHAI BÁO NHÂN VẬT CHÍNH
    // Event listener cũ đã được thay thế bằng app.view.addEventListener ở trên
    // Không cần event listener window.addEventListener nữa

    let lastSentData = { x: 0, y: 0, dir: '', isMoving: false };

    app.ticker.add(async (ticker) => {
        if (!isGameStarted) return;

        // ============================================
        // SERVER-AUTHORITATIVE MOVEMENT - Chỉ gửi input
        // ============================================
        
        // Nếu đang tấn công, đang đào, đang trồng cây, hoặc đang ngủ thì không xử lý di chuyển
        if (isAttacking || isDigging || isSeeding || isSleeping) {
            if (window.serverMovement && isMoving) {
                window.serverMovement.updateInput({}); // Stop movement
                isMoving = false;
            }
            return;
        }

        // Update input to server (server sẽ tính toán position)
        let moved = false;
        if (window.serverMovement) {
            const isMovingNow = window.serverMovement.updateInput(keys);
            const newDir = window.serverMovement.getCurrentDirection();
            
            // Update animation based on movement state
            if (isMovingNow && (!isMoving || currentDir !== newDir)) {
                isMoving = true;
                currentDir = newDir;
                character.textures = walkAnimations[currentDir];
                character.animationSpeed = 0.15;
                character.play();
            } else if (!isMovingNow && isMoving) {
                isMoving = false;
                character.textures = idleAnimations[currentDir];
                character.animationSpeed = 0.05;
                character.play();
            }
            
            // Check if position changed (for chunk loading)
            const oldX = lastSentData.x || characterContainer.x;
            const oldY = lastSentData.y || characterContainer.y;
            if (Math.abs(characterContainer.x - oldX) > 10 || Math.abs(characterContainer.y - oldY) > 10) {
                moved = true;
                lastSentData.x = characterContainer.x;
                lastSentData.y = characterContainer.y;
            }
        }

        // --- LOGIC CAMERA FOLLOW ---
        // Giữ nhân vật ở giữa màn hình bằng cách di chuyển cả 'world' (có tính đến tỉ lệ phóng to)
        world.x = (app.screen.width / 2) - (characterContainer.x * world.scale.x) + shakeOffset.x;
        world.y = (app.screen.height / 2) - (characterContainer.y * world.scale.y) + shakeOffset.y;

        // --- DEPTH SORTING ---
        // Cập nhật zIndex cho objects (kết hợp Y position và zIndex từ editor)
        objectSprites.forEach(sprite => {
            if (sprite.isTopdownGround) {
                sprite.zIndex = -1000000;
            } else {
                // Base zIndex từ Y position + offset từ editor zIndex
                const baseZIndex = Math.floor(sprite.y * 10);
                const zIndexOffset = sprite.editorZIndex || 0;
                sprite.zIndex = baseZIndex + zIndexOffset;
            }
        });

        // Cập nhật zIndex cho crop sprites (cây trồng) theo Y
        plantedCrops.forEach(crop => {
            if (crop.sprite) {
                crop.sprite.zIndex = Math.floor(crop.y * 10);
                
                // Kiểm tra và update stage dựa trên thời gian
                const elapsed = (Date.now() - crop.plantedAt) / 1000; // seconds
                let newStage = crop.currentStage;
                
                if (elapsed < CROP_GROWTH_STAGES.STAGE_1_DURATION) {
                    newStage = 1;
                } else if (elapsed < CROP_GROWTH_STAGES.STAGE_1_DURATION + CROP_GROWTH_STAGES.STAGE_2_DURATION) {
                    newStage = 2;
                } else if (elapsed < CROP_GROWTH_STAGES.STAGE_1_DURATION + CROP_GROWTH_STAGES.STAGE_2_DURATION + CROP_GROWTH_STAGES.STAGE_3_DURATION) {
                    newStage = 3;
                } else {
                    newStage = 4;
                }
                
                // Update stage và collider data nếu stage thay đổi
                if (newStage !== crop.currentStage) {
                    crop.currentStage = newStage;
                    
                    // Update sprite textures
                    const stageFrames = `stage${newStage}`;
                    crop.sprite.textures = riceGrowthFrames[stageFrames];
                    
                    // Đảm bảo animation tiếp tục play sau khi update textures
                    crop.sprite.animationSpeed = 0.02;
                    crop.sprite.loop = true;
                    if (!crop.sprite.playing) {
                        crop.sprite.play();
                    }
                    
                    // Update collider data
                    const newCropPath = crop.stageToPath[newStage];
                    const newHitData = collisionData[newCropPath];
                    if (newHitData) {
                        if (Array.isArray(newHitData)) {
                            crop.points = newHitData;
                            crop.zIndexUpPoints = [];
                            crop.zIndexDownPoints = [];
                            crop.triggerZonePoints = [];
                        } else {
                            crop.points = newHitData.normal || [];
                            crop.zIndexUpPoints = newHitData.z_index_up || [];
                            crop.zIndexDownPoints = newHitData.z_index_down || [];
                            crop.triggerZonePoints = newHitData.trigger_zone || [];
                        }
                        crop.path = newCropPath;
                    }
                    
                    console.log(`🌱 Crop grew to stage ${newStage} at (${crop.x}, ${crop.y})`);
                }
            }
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
                // Chỉ điều chỉnh nếu object có Y gần với player (trong phạm vi 50 pixel)
                const yDistance = Math.abs(obj.y - characterContainer.y);
                if (yDistance < 50) {
                    // Dùng z-index dựa trên Y của object + offset nhỏ
                    const objZIndex = Math.floor(obj.y * 10);
                    charZIndex = objZIndex + 100; // Offset nhỏ hơn để không ảnh hưởng object xa
                }
            }
            // Kiểm tra collider z-index down (vàng) - nhân vật ở dưới object
            else if (checkSpecialCollider(characterContainer, obj, obj.zIndexDownPoints)) {
                // Chỉ điều chỉnh nếu object có Y gần với player (trong phạm vi 50 pixel)
                const yDistance = Math.abs(obj.y - characterContainer.y);
                if (yDistance < 50) {
                    // Dùng z-index dựa trên Y của object - offset nhỏ
                    const objZIndex = Math.floor(obj.y * 10);
                    charZIndex = objZIndex - 100; // Offset nhỏ hơn để không ảnh hưởng object xa
                }
            }
        });

        characterContainer.zIndex = charZIndex;

        // Kiểm tra trigger zone của player chạm vào z_index_up của object
        if (characterContainer.colliderData.triggerZonePoints && characterContainer.colliderData.triggerZonePoints.length > 0) {
            collidableObjects.forEach(obj => {
                if (!obj.sprite || !obj.zIndexUpPoints || obj.zIndexUpPoints.length === 0) return;

                // Check collision giữa trigger zone của player và z_index_up của object
                const isColliding = checkSpecialCollider(characterContainer, obj, obj.zIndexUpPoints, true);
                if (isColliding) {
                    // Chỉ điều chỉnh nếu object có Y gần với player (trong phạm vi 50 pixel)
                    const yDistance = Math.abs(obj.y - characterContainer.y);
                    if (yDistance < 50) {
                        // Player có z-index cao hơn object
                        characterContainer.zIndex = Math.floor(obj.y * 10) + 100;
                    }
                }
            });
        }

        // Kiểm tra trigger zone (tím) giữa các objects
        // Nếu object A có trigger zone chạm vào z_index_up của object B → A có z-index cao hơn B
        collidableObjects.forEach(objA => {
            if (!objA.sprite || !objA.triggerZonePoints || objA.triggerZonePoints.length === 0) return;

            collidableObjects.forEach(objB => {
                if (!objB.sprite || !objB.zIndexUpPoints || objB.zIndexUpPoints.length === 0) return;
                if (objA === objB) return;

                // Check collision giữa trigger zone của A và z_index_up của B
                if (checkSpecialCollider(objA, objB, objB.zIndexUpPoints)) {
                    // A có z-index cao hơn B
                    objA.sprite.zIndex = Math.floor(objB.y * 10) + 5000;
                }
            });
        });

        // Kiểm tra trigger zone theo object type ID
        // Nếu object A có objectTypeId và trigger zone chạm vào z_index_up của object B có cùng objectTypeId
        const objectsByType = {};
        collidableObjects.forEach(obj => {
            if (obj.objectTypeId) {
                if (!objectsByType[obj.objectTypeId]) {
                    objectsByType[obj.objectTypeId] = [];
                }
                objectsByType[obj.objectTypeId].push(obj);
            }
        });

        // Check trigger zone giữa các objects có cùng objectTypeId
        Object.keys(objectsByType).forEach(typeId => {
            const objects = objectsByType[typeId];
            if (objects.length < 2) return;

            objects.forEach(objA => {
                if (!objA.sprite || !objA.triggerZonePoints || objA.triggerZonePoints.length === 0) return;

                objects.forEach(objB => {
                    if (!objB.sprite || !objB.zIndexUpPoints || objB.zIndexUpPoints.length === 0) return;
                    if (objA === objB) return;

                    // Check collision giữa trigger zone của A và z_index_up của B
                    if (checkSpecialCollider(objA, objB, objB.zIndexUpPoints)) {
                        // A có z-index cao hơn B
                        objA.sprite.zIndex = Math.floor(objB.y * 10) + 5000;
                    }
                });
            });
        });

        // Debug: Log Y của nhân vật và object gần nhất
        if (moved) {
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
        }

        // Update lastSentData and auto-load chunks
        if (moved) {
            lastSentData = { 
                x: characterContainer.x, 
                y: characterContainer.y, 
                dir: currentDir, 
                isMoving: isMoving
            };

            // Auto-load chunks khi player di chuyển
            const streamResult = await chunkLoader.loadChunksAroundPlayer(characterContainer.x, characterContainer.y);
            
            // Render newly loaded chunks
            if (streamResult.loaded.length > 0) {
                for (const chunk of streamResult.loaded) {
                    await renderChunk(chunk, world, objectSprites, collidableObjects, debugGraphics, collisionData);
                }
            }
            
            // Unload far chunks
            if (streamResult.unloaded.length > 0) {
                for (const chunk of streamResult.unloaded) {
                    unloadChunkRender(chunk.x, chunk.y, world, objectSprites, collidableObjects, debugGraphics);
                }
            }
        }

        // Cập nhật UI HP/MP
        updateStatsUI();

        // Update chunk UI
        updateChunkUI();

        // Cập nhật cooldown skills
        playerSkills.forEach(skill => {
            const cooldownData = skillCooldowns[skill.skill_id];
            if (cooldownData) {
                if (cooldownData.elapsed < cooldownData.cooldownTime) {
                    cooldownData.elapsed += ticker.deltaTime / 60;
                    // Debug log
                    if (Math.floor(cooldownData.elapsed) > Math.floor(cooldownData.elapsed - ticker.deltaTime / 60)) {
                        console.log(`⏱️ Cooldown: ${cooldownData.elapsed.toFixed(1)}/${cooldownData.cooldownTime}s`);
                    }
                } else {
                    // Cooldown hết - reset elapsed
                    cooldownData.elapsed = cooldownData.cooldownTime;
                    isSkillOnCooldown = false;
                }
            }
        });
        updateSkillsUI();
    });
})();
