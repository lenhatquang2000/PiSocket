import { playDigAnimation, playSeedingAnimation } from '../skills/index.js';

/**
 * Register all socket event listeners for other player sync (movement, attack, skills, disconnects, etc.).
 */
export function setupSocketListeners(socket, {
    world,
    otherPlayers,
    createOtherPlayer,
    walkAnimations,
    idleAnimations,
    attackAnimations,
    digAnimations,
    seedingAnimations,
    playFireballSkill,
    explosionFrames,
    shakeOffset,
    createFarmedTile,
    createPlantedCrop
}) {
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
            // Timestamp-based linear interpolation: snapshot from → to
            p.fromX = p.container.x;
            p.fromY = p.container.y;
            p.toX = data.x;
            p.toY = data.y;
            p.tickReceivedAt = performance.now();
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

    // Server Tick - Update all players positions
    socket.on("serverTick", (playerStates) => {
        // Update all other players (not self)
        for (const socketId in playerStates) {
            if (socketId === socket.id) continue; // Skip self
            
            const state = playerStates[socketId];
            const p = otherPlayers[socketId];
            
            if (p) {
                // Timestamp-based linear interpolation: snapshot from → to
                p.fromX = p.container.x;
                p.fromY = p.container.y;
                p.toX = state.x;
                p.toY = state.y;
                p.tickReceivedAt = performance.now();

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
        playFireballSkill({
            startX: data.startX,
            startY: data.startY,
            targetX: data.targetX,
            targetY: data.targetY,
            world,
            explosionFrames,
            shakeOffset
        });
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

        // Play digging VFX
        playDigAnimation({
            x: data.x,
            y: data.y,
            dir: data.dir,
            world
        });

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

        // Play seeding VFX
        playSeedingAnimation({
            x: data.x,
            y: data.y,
            dir: data.dir,
            world
        });

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
}
