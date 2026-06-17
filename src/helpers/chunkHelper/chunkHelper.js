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
    try {
        const initialLoadResult = await chunkLoader.loadChunksAroundPlayer(spawnX, spawnY);
        if (initialLoadResult) {
            // Render all loaded chunks
            const allChunksToRender = [
                ...(initialLoadResult.loaded || []),
                ...(initialLoadResult.toRender || [])
            ];
            
            for (const chunk of allChunksToRender) {
                await renderChunk(chunk, chunkLoader, world, objectSprites, collidableObjects, debugGraphics, collisionData);
            }
            
            return true;
        }
    } catch (err) {
        console.error(`Failed to load initial chunks: ${err}`);
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
                await renderChunk(chunk, chunkLoader, world, objectSprites, collidableObjects, debugGraphics, collisionData);
            }
        }
        
        // Re-render chunks that were previously unloaded but are now back in view
        if (streamResult.toRender && streamResult.toRender.length > 0) {
            for (const chunk of streamResult.toRender) {
                await renderChunk(chunk, chunkLoader, world, objectSprites, collidableObjects, debugGraphics, collisionData);
            }
        }
        
        // Unload far chunks
        if (streamResult.unloaded && streamResult.unloaded.length > 0) {
            for (const chunk of streamResult.unloaded) {
                unloadChunkRender(chunk.x, chunk.y, world, objectSprites, collidableObjects, debugGraphics, chunkLoader);
            }
        }
        return streamResult;
    } catch (err) {
        console.error(`Error during chunk streaming: ${err}`);
        return { loaded: [], toRender: [], unloaded: [] };
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
    try {
        // Load target chunk if not already loaded
        const targetChunk = await chunkLoader.loadChunk(targetChunkX, targetChunkY);
        
        if (targetChunk) {
            // Render chunk if successfully loaded
            await renderChunk(targetChunk, chunkLoader, world, objectSprites, collidableObjects, debugGraphics, collisionData);
            
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
            alert(`❌ Chunk (${targetChunkX}, ${targetChunkY}) not found!`);
        }
    } catch (err) {
        alert(`❌ Teleport failed: ${err.message}`);
    }
    return false;
}
