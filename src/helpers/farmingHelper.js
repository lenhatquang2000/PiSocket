import { AnimatedSprite, Assets } from 'pixi.js';
import { TILE_SIZE, SOCKET_URL, RICE_FRAME_FILES } from '../config/constants.js';
import { playDigAnimation, playSeedingAnimation } from '../skills/index.js';

/**
 * Checks if a position is on a farmed tile.
 * @param {number} x
 * @param {number} y
 * @param {Array} farmedTiles
 * @returns {boolean}
 */
export function isPositionFarmed(x, y, farmedTiles) {
    const gridX = Math.round(x / TILE_SIZE) * TILE_SIZE;
    const gridY = Math.round(y / TILE_SIZE) * TILE_SIZE;
    return farmedTiles.some(tile => 
        Math.abs(tile.x - gridX) < TILE_SIZE / 2 && 
        Math.abs(tile.y - gridY) < TILE_SIZE / 2
    );
}

/**
 * Checks if a position already has a planted crop.
 * @param {number} x
 * @param {number} y
 * @param {Array} plantedCrops
 * @returns {boolean}
 */
export function isPositionCropped(x, y, plantedCrops) {
    const gridX = Math.round(x / TILE_SIZE) * TILE_SIZE;
    const gridY = Math.round(y / TILE_SIZE) * TILE_SIZE;
    return plantedCrops.some(crop => 
        Math.abs(crop.x - gridX) < TILE_SIZE / 2 && 
        Math.abs(crop.y - gridY) < TILE_SIZE / 2
    );
}

/**
 * Helper to create a farmed tile sprite on the map.
 */
export function createFarmedTileHelper({ x, y, world, farmedTiles, saveToServer = true, chunkLoader }) {
    if (chunkLoader) {
        const { chunkX, chunkY, localX, localY } = chunkLoader.worldToTile(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        const chunk = chunkLoader.renderedChunks.get(chunkKey);
        
        if (chunk) {
            const tile = chunk.tileGrid[localX][localY];
            if (tile.isFarmed || tile.groundType === 'farmed') {
                console.log("⚠️ Vị trí này đã được đào rồi!");
                return null;
            }
            
            const farmedTexture = Assets.get('/assets/Farming1/2D_game_asset_cultivated_farm (14).png');
            if (farmedTexture) {
                const farmedSprite = new AnimatedSprite([farmedTexture]);
                farmedSprite.x = localX * chunk.tileSize;
                farmedSprite.y = localY * chunk.tileSize;
                farmedSprite.anchor.set(0, 0);
                
                const scale = chunk.tileSize / farmedTexture.width;
                farmedSprite.scale.set(scale);
                
                chunk.groundLayer.addChild(farmedSprite);
                chunk.farmedSprites.push(farmedSprite);
                
                tile.groundSprite = farmedSprite;
                tile.groundType = 'farmed';
                tile.isDiggable = false;
                tile.isFarmed = true;
                
                // Keep for global compatibility
                const worldGridX = chunk.container.x + localX * chunk.tileSize;
                const worldGridY = chunk.container.y + localY * chunk.tileSize;
                const mockFarmedSprite = {
                    x: worldGridX,
                    y: worldGridY,
                    isFixedGround: true
                };
                farmedTiles.push(mockFarmedSprite);
                
                // Add to cache
                chunkLoader.addFarmedTileToCache(worldGridX, worldGridY);
                
                if (saveToServer) {
                    fetch(`${SOCKET_URL}/save-farmed-tile`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ x: worldGridX, y: worldGridY })
                    }).catch(err => console.error("❌ Lỗi lưu farmed tile:", err));
                }
                
                return farmedSprite;
            }
        } else {
            // Chunk is not loaded, just add to cache
            const worldGridX = chunkX * 20 * 30 + localX * 30;
            const worldGridY = chunkY * 20 * 30 + localY * 30;
            chunkLoader.addFarmedTileToCache(worldGridX, worldGridY);
            
            if (saveToServer) {
                fetch(`${SOCKET_URL}/save-farmed-tile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ x: worldGridX, y: worldGridY })
                }).catch(err => console.error("❌ Lỗi lưu farmed tile:", err));
            }
            return null;
        }
    } else {
        const tileSize = TILE_SIZE;
        const gridX = Math.round(x / tileSize) * tileSize;
        const gridY = Math.round(y / tileSize) * tileSize;

        // Check if farmed tile already exists
        const existingTile = farmedTiles.find(tile => 
            Math.abs(tile.x - gridX) < tileSize / 2 && 
            Math.abs(tile.y - gridY) < tileSize / 2
        );

        if (existingTile) {
            console.log("⚠️ Vị trí này đã được đào rồi!");
            return null;
        }

        // Create farmed tile sprite
        const farmedTexture = Assets.get('/assets/Farming1/2D_game_asset_cultivated_farm (14).png');
        const farmedSprite = new AnimatedSprite([farmedTexture]);
        farmedSprite.x = gridX;
        farmedSprite.y = gridY;
        farmedSprite.anchor.set(0.5, 0.5);
        
        // Scale sprite to fit the grid
        const textureSize = farmedTexture.width;
        const scale = tileSize / textureSize;
        farmedSprite.scale.set(scale);
        
        farmedSprite.isFixedGround = true;
        farmedSprite.zIndex = -1000000; // Lay underneath player and other objects

        world.addChild(farmedSprite);
        farmedTiles.push(farmedSprite);

        // Persist to server
        if (saveToServer) {
            fetch(`${SOCKET_URL}/save-farmed-tile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: gridX, y: gridY })
            }).catch(err => console.error("❌ Lỗi lưu farmed tile:", err));
        }

        console.log(`✅ Đã tạo ô đất đã đào tại (${gridX}, ${gridY}) với scale ${scale.toFixed(2)}`);
        return farmedSprite;
    }
}

/**
 * Helper to create a planted crop animation on the map.
 */
export function createPlantedCropHelper({
    x,
    y,
    cropData,
    world,
    plantedCrops,
    collidableObjects,
    riceGrowthFrames,
    objectColliderDataByType,
    collisionData,
    saveToServer = true,
    plantedAt = null,
    plantedCropId = null,
    chunkLoader
}) {
    if (chunkLoader) {
        const { chunkX, chunkY, localX, localY } = chunkLoader.worldToTile(x, y);
        const chunkKey = `${chunkX},${chunkY}`;
        const chunk = chunkLoader.renderedChunks.get(chunkKey);
        
        if (chunk) {
            const tile = chunk.tileGrid[localX][localY];
            if (tile.object !== null) {
                console.log("⚠️ Vị trí này đã có cây trồng rồi!");
                return false;
            }
            
            const cropSprite = new AnimatedSprite(riceGrowthFrames.stage1);
            const worldGridX = chunk.container.x + (localX * chunk.tileSize) + (chunk.tileSize / 2);
            const worldGridY = chunk.container.y + (localY * chunk.tileSize) + chunk.tileSize;
            
            cropSprite.x = worldGridX;
            cropSprite.y = worldGridY;
            cropSprite.anchor.set(0.5, 1);
            cropSprite.scale.set(0.5);
            cropSprite.zIndex = Math.floor(worldGridY * 10);
            cropSprite.animationSpeed = 0.02;
            cropSprite.loop = true;
            cropSprite.play();
            
            world.addChild(cropSprite);
            chunk.objectSprites.push(cropSprite);
            
            const stageToPath = {
                1: `/assets/seed/${RICE_FRAME_FILES[0]}`,
                2: `/assets/seed/${RICE_FRAME_FILES[4]}`,
                3: `/assets/seed/${RICE_FRAME_FILES[8]}`,
                4: `/assets/seed/${RICE_FRAME_FILES[12]}`
            };
            
            const objectTypeId = plantedCropId ? `planted_crop_${plantedCropId}` : `crop_${cropData.id}`;
            let hitPoints = [], zIndexUpPoints = [], zIndexDownPoints = [], triggerZonePoints = [];
            const cropPath = stageToPath[1];
            
            if (objectColliderDataByType && objectColliderDataByType[objectTypeId]) {
                const colliderData = objectColliderDataByType[objectTypeId];
                hitPoints = colliderData.normal || [];
                zIndexUpPoints = colliderData.z_index_up || [];
                zIndexDownPoints = colliderData.z_index_down || [];
                triggerZonePoints = colliderData.trigger_zone || [];
            } else if (collisionData && collisionData[cropPath]) {
                const hitData = collisionData[cropPath];
                if (Array.isArray(hitData)) {
                    hitPoints = hitData;
                } else {
                    hitPoints = hitData.normal || [];
                    zIndexUpPoints = hitData.z_index_up || [];
                    zIndexDownPoints = hitData.z_index_down || [];
                    triggerZonePoints = hitData.trigger_zone || [];
                }
            }
            
            const cropObject = {
                sprite: cropSprite,
                x: worldGridX,
                y: worldGridY,
                cropData: cropData,
                plantedAt: plantedAt || Date.now(),
                currentStage: 1,
                maxStage: 4,
                objectTypeId: objectTypeId,
                points: hitPoints,
                zIndexUpPoints: zIndexUpPoints,
                zIndexDownPoints: zIndexDownPoints,
                triggerZonePoints: triggerZonePoints,
                width: cropSprite.texture.width,
                height: cropSprite.texture.height,
                scale: 0.5,
                anchor: cropSprite.anchor,
                path: cropPath,
                stageToPath: stageToPath,
                plantedCropId: plantedCropId,
                chunkX: chunk.chunkX,
                chunkY: chunk.chunkY
            };
            
            plantedCrops.push(cropObject);
            collidableObjects.push(cropObject);
            chunk.collidableObjects.push(cropObject);
            tile.object = cropObject;
            
            const cropSaveData = {
                id: plantedCropId || cropData.id,
                crop_type_id: cropData.id,
                crop_name: cropData.name || cropData.display_name,
                display_name: cropData.display_name,
                sprite_path: cropData.sprite_path || `/assets/seed/${RICE_FRAME_FILES[0]}`,
                x: worldGridX,
                y: worldGridY,
                planted_at: plantedAt ? new Date(plantedAt).toISOString() : new Date().toISOString()
            };
            chunkLoader.addPlantedCropToCache(cropSaveData);
            
            if (saveToServer) {
                fetch(`${SOCKET_URL}/plant-crop`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ x: worldGridX, y: worldGridY, cropTypeId: cropData.id })
                }).catch(err => console.error("❌ Lỗi lưu planted crop:", err));
            }
            
            return true;
        } else {
            const worldGridX = chunkX * 20 * 30 + localX * 30 + 15;
            const worldGridY = chunkY * 20 * 30 + localY * 30 + 30;
            const cropSaveData = {
                id: plantedCropId || cropData.id,
                crop_type_id: cropData.id,
                crop_name: cropData.name || cropData.display_name,
                display_name: cropData.display_name,
                sprite_path: cropData.sprite_path || `/assets/seed/${RICE_FRAME_FILES[0]}`,
                x: worldGridX,
                y: worldGridY,
                planted_at: plantedAt ? new Date(plantedAt).toISOString() : new Date().toISOString()
            };
            chunkLoader.addPlantedCropToCache(cropSaveData);
            
            if (saveToServer) {
                fetch(`${SOCKET_URL}/plant-crop`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ x: worldGridX, y: worldGridY, cropTypeId: cropData.id })
                }).catch(err => console.error("❌ Lỗi lưu planted crop:", err));
            }
            return true;
        }
    } else {
        const tileSize = TILE_SIZE;
        const gridX = Math.round(x / tileSize) * tileSize;
        const gridY = Math.round(y / tileSize) * tileSize;

        // Check if crop already exists
        const existingCrop = plantedCrops.find(crop => 
            Math.abs(crop.x - gridX) < tileSize / 2 && 
            Math.abs(crop.y - gridY) < tileSize / 2
        );

        if (existingCrop) {
            console.log("⚠️ Vị trí này đã có cây trồng rồi!");
            return false;
        }

        // Create crop AnimatedSprite starting at stage 1
        const cropSprite = new AnimatedSprite(riceGrowthFrames.stage1);
        cropSprite.x = gridX;
        cropSprite.y = gridY;
        cropSprite.anchor.set(0.5, 1);
        cropSprite.scale.set(0.5);
        cropSprite.zIndex = Math.floor(gridY * 10);
        cropSprite.animationSpeed = 0.02;
        cropSprite.loop = true;
        cropSprite.play();

        world.addChild(cropSprite);
        
        const stageToPath = {
            1: `/assets/seed/${RICE_FRAME_FILES[0]}`,
            2: `/assets/seed/${RICE_FRAME_FILES[4]}`,
            3: `/assets/seed/${RICE_FRAME_FILES[8]}`,
            4: `/assets/seed/${RICE_FRAME_FILES[12]}`
        };
        
        const objectTypeId = plantedCropId ? `planted_crop_${plantedCropId}` : `crop_${cropData.id}`;
        let hitPoints = [], zIndexUpPoints = [], zIndexDownPoints = [], triggerZonePoints = [];
        
        const cropPath = stageToPath[1];
        
        // Load collider config
        if (objectColliderDataByType[objectTypeId]) {
            const colliderData = objectColliderDataByType[objectTypeId];
            hitPoints = colliderData.normal || [];
            zIndexUpPoints = colliderData.z_index_up || [];
            zIndexDownPoints = colliderData.z_index_down || [];
            triggerZonePoints = colliderData.trigger_zone || [];
        } else {
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
            currentStage: 1,
            maxStage: 4,
            objectTypeId: objectTypeId,
            points: hitPoints,
            zIndexUpPoints: zIndexUpPoints,
            zIndexDownPoints: zIndexDownPoints,
            triggerZonePoints: triggerZonePoints,
            width: cropSprite.texture.width,
            height: cropSprite.texture.height,
            scale: 0.5,
            anchor: cropSprite.anchor,
            path: cropPath,
            stageToPath: stageToPath,
            plantedCropId: plantedCropId
        };
        
        plantedCrops.push(cropObject);
        collidableObjects.push(cropObject);

        // Save to database
        if (saveToServer) {
            fetch(`${SOCKET_URL}/plant-crop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: gridX, y: gridY, cropTypeId: cropData.id })
            }).catch(err => console.error("❌ Lỗi lưu planted crop:", err));
        }

        console.log(`✅ Đã trồng ${cropData.display_name} tại (${gridX}, ${gridY}) - Stage 1`);
        return true;
    }
}

/**
 * Validates, reduces MP, triggers player animation, and runs digging logic on completion.
 */
export function executeDigSkill({
    characterContainer,
    charCtrl,
    currentDir,
    farmedTiles,
    world,
    playerStats,
    farmingSkill,
    cooldownData,
    socket,
    myGameId,
    chunkLoader,
    onStart,
    onComplete
}) {
    // 1. Cooldown check
    const remaining = Math.max(0, cooldownData.cooldownTime - cooldownData.elapsed);
    if (remaining > 0) {
        console.warn(`⏱️ Kỹ năng Farming đang hồi chiêu: ${remaining.toFixed(1)}s`);
        return false;
    }

    // 2. MP check
    if (playerStats.mp < farmingSkill.mp_cost) {
        console.warn(`❌ Không đủ MP! Cần ${farmingSkill.mp_cost}, hiện có ${playerStats.mp}`);
        return false;
    }

    // 3. Tile check using chunk & local tile coordinates
    const { chunkX, chunkY, localX, localY } = chunkLoader.worldToTile(characterContainer.x, characterContainer.y);
    const chunkKey = `${chunkX},${chunkY}`;
    const chunk = chunkLoader.renderedChunks.get(chunkKey);
    
    if (!chunk) {
        console.warn("⚠️ Không tìm thấy chunk tại vị trí hiện tại!");
        return false;
    }

    const tile = chunk.tileGrid[localX][localY];

    // Check if there is an object blocking digging
    if (tile.object !== null) {
        if (tile.object.type === 'tree') {
            console.log("⚠️ Vướng cái cây rồi, không đào đất được! Hãy chặt cây trước.");
            return false;
        } else if (tile.object.type === 'stone') {
            console.log("⚠️ Vướng đá rồi, không đào đất được!");
            return false;
        } else {
            console.log("⚠️ Có vật thể chặn đường, không thể đào!");
            return false;
        }
    }

    // Check if ground is diggable and not already farmed
    if (tile.groundType === 'farmed' || tile.isFarmed || !tile.isDiggable) {
        console.log("⚠️ Vị trí này đã được đào rồi hoặc không thể đào!");
        return false;
    }

    // 4. Consume MP
    playerStats.mp -= farmingSkill.mp_cost;
    console.log(`✅ Sử dụng Farming! MP: ${playerStats.mp}/${playerStats.maxMp}`);

    // 5. Database usage log
    fetch(`${SOCKET_URL}/use-skill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: myGameId, skillId: farmingSkill.skill_id })
    }).catch(err => console.error("❌ Lỗi record skill:", err));

    // 6. Reset Cooldown
    cooldownData.elapsed = 0;

    // 7. Invoke state lock callback
    if (onStart) onStart();

    // Play dig VFX animation
    playDigAnimation({
        x: characterContainer.x,
        y: characterContainer.y,
        dir: currentDir,
        world
    });

    // 8. Play animation on character controller and execute on finish
    charCtrl.play('dig', currentDir, () => {
        if (onComplete) onComplete();
        
        createFarmedTileHelper({
            x: characterContainer.x,
            y: characterContainer.y,
            world,
            farmedTiles,
            saveToServer: true,
            chunkLoader
        });

        socket.emit("playerDig", {
            x: characterContainer.x,
            y: characterContainer.y,
            dir: currentDir
        });
    });

    return true;
}

/**
 * Validates, reduces MP, triggers player animation, and runs seeding/planting logic on completion.
 */
export function executeSeedSkill({
    characterContainer,
    charCtrl,
    currentDir,
    farmedTiles,
    plantedCrops,
    collidableObjects,
    world,
    selectedCropType,
    playerStats,
    seedingSkill,
    cooldownData,
    riceGrowthFrames,
    objectColliderDataByType,
    collisionData,
    socket,
    myGameId,
    chunkLoader,
    onStart,
    onComplete
}) {
    // 1. Selection check
    if (!selectedCropType) {
        console.warn("⚠️ Bạn chưa chọn loại cây để trồng!");
        return false;
    }

    // 2. Find target tile coordinates
    const { chunkX, chunkY, localX, localY } = chunkLoader.worldToTile(characterContainer.x, characterContainer.y);
    const chunkKey = `${chunkX},${chunkY}`;
    const chunk = chunkLoader.renderedChunks.get(chunkKey);
    
    if (!chunk) {
        console.warn("⚠️ Không tìm thấy chunk tại vị trí hiện tại!");
        return false;
    }

    const tile = chunk.tileGrid[localX][localY];

    // 3. Farmed ground check
    if (!tile.isFarmed && tile.groundType !== 'farmed') {
        console.warn("⚠️ Bạn phải đứng trên đất đã đào mới có thể trồng cây!");
        return false;
    }

    // 4. Existing crop check
    if (tile.object !== null) {
        console.warn("⚠️ Vị trí này đã có cây trồng hoặc vật thể khác!");
        return false;
    }

    // 5. Cooldown check
    const remaining = Math.max(0, cooldownData.cooldownTime - cooldownData.elapsed);
    if (remaining > 0) {
        console.warn(`⏱️ Kỹ năng Seeding đang hồi chiêu: ${remaining.toFixed(1)}s`);
        return false;
    }

    // 6. MP check
    if (playerStats.mp < seedingSkill.mp_cost) {
        console.warn(`❌ Không đủ MP! Cần ${seedingSkill.mp_cost}, hiện có ${playerStats.mp}`);
        return false;
    }

    // 7. Consume MP
    playerStats.mp -= seedingSkill.mp_cost;
    console.log(`✅ Sử dụng Seeding! MP: ${playerStats.mp}/${playerStats.maxMp}`);

    // 8. Database usage log
    fetch(`${SOCKET_URL}/use-skill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: myGameId, skillId: seedingSkill.skill_id })
    }).catch(err => console.error("❌ Lỗi record skill:", err));

    // 9. Reset Cooldown
    cooldownData.elapsed = 0;

    // 10. Invoke state lock callback
    if (onStart) onStart();

    // Play seeding VFX animation
    playSeedingAnimation({
        x: characterContainer.x,
        y: characterContainer.y,
        dir: currentDir,
        world
    });

    // 11. Play animation and plant crop on finish
    charCtrl.play('seeding', currentDir, () => {
        if (onComplete) onComplete();

        createPlantedCropHelper({
            x: characterContainer.x,
            y: characterContainer.y,
            cropData: selectedCropType,
            world,
            plantedCrops,
            collidableObjects,
            riceGrowthFrames,
            objectColliderDataByType,
            collisionData,
            saveToServer: true,
            chunkLoader
        });

        socket.emit("playerSeed", {
            x: characterContainer.x,
            y: characterContainer.y,
            dir: currentDir,
            cropTypeId: selectedCropType.id,
            cropName: selectedCropType.display_name
        });
    });

    return true;
}
