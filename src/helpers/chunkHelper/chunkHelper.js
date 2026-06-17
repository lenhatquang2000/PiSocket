import { renderChunk, unloadChunkRender } from './chunkRenderer.js';

/**
 * Loads the initial 3x3 grid of chunks around the spawn position and renders them.
 */
export async function loadInitialChunksHelper({
    chunkLoader,
    world,
    objectSprites,
    collidableObjects,
    debugGraphics,
    collisionData,
    spawnX,
    spawnY
}) {
    console.log('🗺️ [CHUNK HELPER] Loading initial 3x3 chunk grid...');
    try {
        const initialLoadResult = await chunkLoader.loadChunksAroundPlayer(spawnX, spawnY);
        if (initialLoadResult) {
            console.log(`✅ [CHUNK HELPER] Loaded ${initialLoadResult.loaded.length} initial chunks`);
            for (const chunk of initialLoadResult.loaded) {
                await renderChunk(chunk, world, objectSprites, collidableObjects, debugGraphics, collisionData);
            }
            return true;
        }
    } catch (err) {
        console.error('❌ [CHUNK HELPER] Failed to load initial chunks:', err);
    }
    return false;
}

/**
 * Handles automatic loading/unloading of chunks when player moves.
 */
export async function streamChunksHelper({
    chunkLoader,
    world,
    objectSprites,
    collidableObjects,
    debugGraphics,
    collisionData,
    playerX,
    playerY
}) {
    try {
        const streamResult = await chunkLoader.loadChunksAroundPlayer(playerX, playerY);
        
        // Render newly loaded chunks
        if (streamResult.loaded && streamResult.loaded.length > 0) {
            for (const chunk of streamResult.loaded) {
                await renderChunk(chunk, world, objectSprites, collidableObjects, debugGraphics, collisionData);
            }
        }
        
        // Unload far chunks
        if (streamResult.unloaded && streamResult.unloaded.length > 0) {
            for (const chunk of streamResult.unloaded) {
                unloadChunkRender(chunk.x, chunk.y, world, objectSprites, collidableObjects, debugGraphics);
            }
        }
        return streamResult;
    } catch (err) {
        console.error('❌ [CHUNK HELPER] Error during chunk streaming:', err);
        return { loaded: [], unloaded: [] };
    }
}

/**
 * Teleports player to the center of target chunk after loading and rendering it.
 */
export async function teleportToChunkHelper({
    chunkLoader,
    targetChunkX,
    targetChunkY,
    characterContainer,
    world,
    objectSprites,
    collidableObjects,
    debugGraphics,
    collisionData,
    socket,
    currentDir,
    myGameId,
    updateChunkUI
}) {
    console.log(`🚀 [TELEPORT HELPER] Teleporting to chunk (${targetChunkX}, ${targetChunkY})...`);
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
            
            console.log(`✅ [TELEPORT HELPER] Player teleported to chunk (${targetChunkX}, ${targetChunkY}) at world position (${centerX}, ${centerY})`);
            
            // Update UI
            if (updateChunkUI) {
                updateChunkUI();
            }
            
            // Send position update to server
            socket.emit("playerMovement", {
                x: characterContainer.x,
                y: characterContainer.y,
                dir: currentDir,
                isMoving: false,
                name: myGameId
            });
            
            return true;
        } else {
            console.error(`❌ [TELEPORT HELPER] Failed to load chunk (${targetChunkX}, ${targetChunkY})`);
            alert(`❌ Chunk (${targetChunkX}, ${targetChunkY}) not found!`);
        }
    } catch (err) {
        console.error(`❌ [TELEPORT HELPER] Error:`, err);
        alert(`❌ Teleport failed: ${err.message}`);
    }
    return false;
}
