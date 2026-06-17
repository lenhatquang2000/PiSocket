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
    collisionData
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
            sprite.zIndex = baseZIndex + zIndexOffset;
        }
    });

    // 3. --- DEPTH SORTING & CROP GROWTH ---
    // Cập nhật zIndex cho crop sprites (cây trồng) theo Y và quản lý tiến trình phát triển
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
}
