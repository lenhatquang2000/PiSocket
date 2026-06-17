/**
 * Update the camera follow coordinates and recalculate z-indices for objects, crops, players, and character.
 */
export function updateCameraAndDepth({
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
    collisionData,
    loopContext
}) {
    // 1. --- LOGIC CAMERA FOLLOW ---
    // Giữ nhân vật ở giữa màn hình bằng cách di chuyển cả 'world' (có tính đến tỉ lệ phóng to)
    world.x = (app.screen.width / 2) - (characterContainer.x * world.scale.x) + shakeOffset.x;
    world.y = (app.screen.height / 2) - (characterContainer.y * world.scale.y) + shakeOffset.y;

    // 2. --- DEPTH SORTING ---
    // Cập nhật zIndex cho objects (kết hợp Y position và zIndex từ editor)
    objectSprites.forEach(sprite => {
        if (sprite.isTopdownGround) {
            sprite.zIndex = -1000000;
        } else {
            // Base zIndex từ Y position + offset từ editor zIndex
            const baseZIndex = Math.floor(sprite.y * 10);
            const zIndexOffset = sprite.editorZIndex || 0;
            sprite.zIndex = baseZIndex + zIndexOffset + (sprite.zIndexAdjustment || 0);
        }
    });

    // 3. --- DEPTH SORTING & CROP GROWTH ---
    // Cập nhật zIndex cho crop sprites (cây trồng) theo Y và quản lý tiến trình phát triển
    plantedCrops.forEach(crop => {
        if (crop.sprite) {
            crop.sprite.zIndex = Math.floor(crop.y * 10) + (crop.sprite.zIndexAdjustment || 0);
            
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
                
                // Signal z-index recalculation since crop visual / collider size changed
                if (loopContext) {
                    loopContext.zIndexRecalculationNeeded = true;
                }
            }
        }
    });

    // 4. --- OTHER PLAYERS zIndex ---
    // Cập nhật zIndex cho other players
    Object.values(otherPlayers).forEach(p => {
        p.container.zIndex = Math.floor(p.container.y * 10);
    });

    // 5. --- MAIN CHARACTER zIndex ---
    // Cập nhật zIndex cho nhân vật với special collider adjustments
    let charZIndex = Math.floor(characterContainer.y * 10);

    // Kiểm tra special colliders để điều chỉnh z-index
    collidableObjects.forEach(obj => {
        if (!obj.sprite) return;

        // Skip immediately if the object is too far vertically (yDistance >= 50px)
        const yDistance = Math.abs(obj.y - characterContainer.y);
        if (yDistance >= 50) return;

        // Check if player is on z-index up (green) - player renders above object
        if (checkSpecialCollider(characterContainer, obj, obj.zIndexUpPoints)) {
            const objZIndex = Math.floor(obj.y * 10);
            charZIndex = objZIndex + 100;
        }
        // Check if player is on z-index down (yellow) - player renders below object
        else if (checkSpecialCollider(characterContainer, obj, obj.zIndexDownPoints)) {
            const objZIndex = Math.floor(obj.y * 10);
            charZIndex = objZIndex - 100;
        }
    });

    characterContainer.zIndex = charZIndex;
}

/**
 * Recalculate z-index adjustments for all static overlapping objects.
 * This runs in O(N^2) but only executes once when a chunk loads/unloads or a crop grows.
 */
export function recalculateStaticObjectZIndices(collidableObjects, checkSpecialCollider) {
    if (!collidableObjects || !checkSpecialCollider) return;

    const startTime = performance.now();

    // 1. Reset zIndexAdjustment on all collidable objects
    collidableObjects.forEach(obj => {
        if (obj.sprite) {
            obj.sprite.zIndexAdjustment = 0;
        }
    });

    let overlapCount = 0;

    // 2. Check trigger zone (tím) giữa các objects
    collidableObjects.forEach(objA => {
        if (!objA.sprite || !objA.triggerZonePoints || objA.triggerZonePoints.length === 0) return;

        collidableObjects.forEach(objB => {
            if (!objB.sprite || !objB.zIndexUpPoints || objB.zIndexUpPoints.length === 0) return;
            if (objA === objB) return;

            if (checkSpecialCollider(objA, objB, objB.zIndexUpPoints)) {
                const baseZIndexA = Math.floor(objA.sprite.y * 10);
                const offsetA = objA.sprite.editorZIndex || 0;
                const targetZIndex = Math.floor(objB.y * 10) + 5000;
                objA.sprite.zIndexAdjustment = targetZIndex - (baseZIndexA + offsetA);
                overlapCount++;
            }
        });
    });

    // 3. Check trigger zone theo object type ID
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
                    const baseZIndexA = Math.floor(objA.sprite.y * 10);
                    const offsetA = objA.sprite.editorZIndex || 0;
                    const targetZIndex = Math.floor(objB.y * 10) + 5000;
                    objA.sprite.zIndexAdjustment = targetZIndex - (baseZIndexA + offsetA);
                    overlapCount++;
                }
            });
        });
    });

    const elapsed = performance.now() - startTime;
    console.log(`⚡ [Z-INDEX RECALCULATION] Recalculated z-indices for ${collidableObjects.length} objects. Found ${overlapCount} overlaps. Took ${elapsed.toFixed(2)}ms`);
}
