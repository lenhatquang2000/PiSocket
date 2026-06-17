import { streamChunksHelper } from './chunkHelper/chunkHelper.js';
import { updateCameraAndDepth } from './cameraHelper.js';

/**
 * Register the main game tick loop inside PixiJS application ticker.
 */
export function setupGameLoop(app, {
    loopContext,
    keys,
    charCtrl,
    characterContainer,
    world,
    shakeOffset,
    objectSprites,
    plantedCrops,
    otherPlayers,
    collidableObjects,
    checkSpecialCollider,
    CROP_GROWTH_STAGES,
    riceGrowthFrames,
    collisionData,
    chunkLoader,
    debugGraphics,
    updateStatsUI,
    updateChunkUI,
    playerSkills,
    skillCooldowns,
    updateSkillsUI
}) {
    app.ticker.add(async (ticker) => {
        if (!loopContext.isGameStarted) return;

        // ─── TIMESTAMP-BASED LINEAR INTERPOLATION ──────────────────────────
        // Server ticks at 30Hz (every ~33.33ms). Each tick we snapshot:
        //   fromX/fromY = position at the moment the tick arrived
        //   toX/toY     = new server position
        //   tickReceivedAt = performance.now() at arrival
        // Each frame we slide t = elapsed / 33.33ms from 0 → 1, giving a
        // perfectly smooth, predictable glide that reaches the target in
        // exactly one tick period — no drift, no jitter, no exponential lag.
        const TICK_MS = 1000 / 30; // 33.33ms
        const now = performance.now();
        for (const id in otherPlayers) {
            const p = otherPlayers[id];
            if (p && p.tickReceivedAt !== undefined) {
                const elapsed = now - p.tickReceivedAt;
                const t = Math.min(elapsed / TICK_MS, 1.0);
                p.container.x = p.fromX + (p.toX - p.fromX) * t;
                p.container.y = p.fromY + (p.toY - p.fromY) * t;
            }
        }
        // ────────────────────────────────────────────────────────────────────

        // ============================================
        // SERVER-AUTHORITATIVE MOVEMENT - Chỉ gửi input
        // ============================================
        
        // Nếu đang tấn công, đang đào, đang trồng cây, hoặc đang ngủ thì không xử lý di chuyển
        if (loopContext.isAttacking || loopContext.isDigging || loopContext.isSeeding || loopContext.isSleeping) {
            if (window.serverMovement && loopContext.isMoving) {
                window.serverMovement.updateInput({}); // Stop movement
                loopContext.isMoving = false;
            }
            return;
        }

        // Update input to server (server sẽ tính toán position)
        let moved = false;
        if (window.serverMovement) {
            const isMovingNow = window.serverMovement.updateInput(keys);
            const newDir = window.serverMovement.getCurrentDirection();
            
            // Update animation based on movement state
            if (isMovingNow && (!loopContext.isMoving || loopContext.currentDir !== newDir)) {
                loopContext.isMoving = true;
                loopContext.currentDir = newDir;
                charCtrl.play('walk', loopContext.currentDir);
            } else if (!isMovingNow && loopContext.isMoving) {
                loopContext.isMoving = false;
                charCtrl.play('idle', loopContext.currentDir);
            }

            // Check if position changed (for chunk loading)
            const oldX = loopContext.lastSentData.x || characterContainer.x;
            const oldY = loopContext.lastSentData.y || characterContainer.y;
            if (Math.abs(characterContainer.x - oldX) > 10 || Math.abs(characterContainer.y - oldY) > 10) {
                moved = true;
                loopContext.lastSentData.x = characterContainer.x;
                loopContext.lastSentData.y = characterContainer.y;
            }
        }

        // Cập nhật camera và thứ tự chồng lớp (depth/zIndex sorting)
        updateCameraAndDepth({
            app,
            world,
            characterContainer,
            shakeOffset,
            objectSprites,
            plantedCrops,
            otherPlayers,
            collidableObjects,
            checkSpecialCollider,
            CROP_GROWTH_STAGES,
            riceGrowthFrames,
            collisionData
        });

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
        collidableObjects.forEach(objA => {
            if (!objA.sprite || !objA.triggerZonePoints || objA.triggerZonePoints.length === 0) return;

            collidableObjects.forEach(objB => {
                if (!objB.sprite || !objB.zIndexUpPoints || objB.zIndexUpPoints.length === 0) return;
                if (objA === objB) return;

                if (checkSpecialCollider(objA, objB, objB.zIndexUpPoints)) {
                    objA.sprite.zIndex = Math.floor(objB.y * 10) + 5000;
                }
            });
        });

        // Kiểm tra trigger zone theo object type ID
        const objectsByType = {};
        collidableObjects.forEach(obj => {
            if (obj.objectTypeId) {
                if (!objectsByType[obj.objectTypeId]) {
                    objectsByType[obj.objectTypeId] = [];
                }
                objectsByType[obj.objectTypeId].push(obj);
            }
        });

        Object.keys(objectsByType).forEach(typeId => {
            const objects = objectsByType[typeId];
            if (objects.length < 2) return;

            objects.forEach(objA => {
                if (!objA.sprite || !objA.triggerZonePoints || objA.triggerZonePoints.length === 0) return;

                objects.forEach(objB => {
                    if (!objB.sprite || !objB.zIndexUpPoints || objB.zIndexUpPoints.length === 0) return;
                    if (objA === objB) return;

                    if (checkSpecialCollider(objA, objB, objB.zIndexUpPoints)) {
                        objA.sprite.zIndex = Math.floor(objB.y * 10) + 5000;
                    }
                });
            });
        });

        // Update lastSentData and auto-load chunks
        if (moved) {
            console.log(`🎮 [GAME LOOP] Player moved - calling streamChunksHelper at (${characterContainer.x}, ${characterContainer.y})`);
            loopContext.lastSentData = { 
                x: characterContainer.x, 
                y: characterContainer.y, 
                dir: loopContext.currentDir, 
                isMoving: loopContext.isMoving
            };

            await streamChunksHelper({
                chunkLoader,
                world,
                objectSprites,
                collidableObjects,
                debugGraphics,
                collisionData,
                playerX: characterContainer.x,
                playerY: characterContainer.y
            });
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
                    if (Math.floor(cooldownData.elapsed) > Math.floor(cooldownData.elapsed - ticker.deltaTime / 60)) {
                        console.log(`⏱️ Cooldown: ${cooldownData.elapsed.toFixed(1)}/${cooldownData.cooldownTime}s`);
                    }
                } else {
                    cooldownData.elapsed = cooldownData.cooldownTime;
                    loopContext.isSkillOnCooldown = false;
                }
            }
        });
        updateSkillsUI();
    });
}
