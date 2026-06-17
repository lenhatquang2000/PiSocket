/**
 * Setup keyboard inputs and skills hotkey listener.
 */
export function setupInputListeners(window, {
    keys,
    loopContext,
    playerSkills,
    skillCooldowns,
    playerStats,
    charCtrl,
    characterContainer,
    farmedTiles,
    plantedCrops,
    collidableObjects,
    world,
    selectedCropType,
    riceGrowthFrames,
    objectColliderDataByType,
    collisionData,
    socket,
    myGameId,
    SOCKET_URL,
    chunkLoader,
    executeDigSkill,
    executeSeedSkill
}) {
    window.addEventListener('keydown', e => {
        keys[e.code] = true;
        
        // Xử lý phím V - Kỹ năng Sleep (Ngủ)
        if (e.code === 'KeyV' && loopContext.isGameStarted && !loopContext.isDigging && !loopContext.isAttacking && !loopContext.isSeeding && !loopContext.isSleeping) {
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
            loopContext.isSleeping = true;
            loopContext.isMoving = false;
            
            console.log('🔍 [SLEEP DEBUG] Sleep animation started');
            charCtrl.play('sleep', loopContext.currentDir, () => {
                console.log('🔍 [SLEEP DEBUG] Sleep animation completed, switching to sleeping loop');
                
                // Chuyển sang animation sleeping và lặp liên tục
                charCtrl.play('sleeping', loopContext.currentDir);
                
                console.log('🔍 [SLEEP DEBUG] Sleeping animation started (looping)');
            });


            // Gửi event sleep cho người chơi khác
            socket.emit("playerSleep", {
                x: characterContainer.x,
                y: characterContainer.y,
                dir: loopContext.currentDir
            });
        }

        // Xử lý phím T - Kỹ năng Seeding (Trồng cây)
        if (e.code === 'KeyT' && loopContext.isGameStarted && !loopContext.isDigging && !loopContext.isAttacking && !loopContext.isSeeding) {
            const seedingSkill = playerSkills.find(s => s.skill_type === 'seeding');
            if (!seedingSkill) {
                console.warn("⚠️ Bạn chưa có kỹ năng Seeding!");
            } else {
                executeSeedSkill({
                    characterContainer,
                    charCtrl,
                    currentDir: loopContext.currentDir,
                    farmedTiles,
                    plantedCrops,
                    collidableObjects,
                    world,
                    selectedCropType,
                    playerStats,
                    seedingSkill,
                    cooldownData: skillCooldowns[seedingSkill.skill_id],
                    riceGrowthFrames,
                    objectColliderDataByType,
                    collisionData,
                    socket,
                    myGameId,
                    chunkLoader,
                    onStart: () => {
                        loopContext.isSeeding = true;
                        loopContext.isMoving = false;
                    },
                    onComplete: () => {
                        loopContext.isSeeding = false;
                        charCtrl.play('idle', loopContext.currentDir);
                    }
                });
            }
        }
        
        // Xử lý phím F - Kỹ năng Farming (Dig)
        if (e.code === 'KeyF' && loopContext.isGameStarted && !loopContext.isDigging && !loopContext.isAttacking && !loopContext.isSeeding && !loopContext.isSleeping) {
            const farmingSkill = playerSkills.find(s => s.skill_type === 'farming');
            if (!farmingSkill) {
                console.warn("⚠️ Bạn chưa có kỹ năng Farming!");
            } else {
                executeDigSkill({
                    characterContainer,
                    charCtrl,
                    currentDir: loopContext.currentDir,
                    farmedTiles,
                    world,
                    playerStats,
                    farmingSkill,
                    cooldownData: skillCooldowns[farmingSkill.skill_id],
                    socket,
                    myGameId,
                    chunkLoader,
                    onStart: () => {
                        loopContext.isDigging = true;
                        loopContext.isMoving = false;
                    },
                    onComplete: () => {
                        loopContext.isDigging = false;
                        charCtrl.play('idle', loopContext.currentDir);
                    }
                });
            }
        }
        
        // Test HP/MP - Phím 1 để giảm HP, Phím 2 để tăng HP, Phím 3 để giảm MP, Phím 4 để tăng MP
        if (loopContext.isGameStarted) {
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
}
