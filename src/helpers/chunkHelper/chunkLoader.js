// Chunk Loader - Load binary chunk files dynamically
import { getObjectCategories } from '../../config/objectCategories.js';
import { SCATTER_OBJECTS, pickRandomGroundTile } from './config.js';
import { debugLog } from '../debugHelper.js';

export class ChunkLoader {
  constructor() {
    this.loadedChunks = new Map(); // Map<"x,y", chunkData>
    this.renderedChunks = new Set(); // Track which chunks are currently rendered on screen
    this.chunkSize = 20; // 20x20 tiles per chunk
    this.loadRadius = 1; // Load 1 chunk radius around player (3x3 grid)
    this.currentPlayerChunk = { x: 0, y: 0 }; // Track player's current chunk
  }

  // Chuyển đổi world coordinates sang chunk coordinates
  worldToChunk(worldX, worldY) {
    const chunkX = Math.floor(worldX / (this.chunkSize * 30)); // 30 = tileSize
    const chunkY = Math.floor(worldY / (this.chunkSize * 30));
    return { chunkX, chunkY };
  }

  // Load 9 chunks xung quanh player (3x3 grid)
  async loadChunksAroundPlayer(playerX, playerY) {
    const { chunkX, chunkY } = this.worldToChunk(playerX, playerY);
    
    debugLog(`🗺️ [CHUNK STREAMING] Checking chunks around player position (${playerX}, ${playerY}) = chunk (${chunkX}, ${chunkY})`);
    
    const loadedChunks = [];
    const chunksToLoad = [];
    const chunksToUnload = [];
    const chunksToRender = []; // Chunks loaded but not rendered yet

    // Determine which chunks should be loaded (3x3 grid around player)
    const requiredChunks = new Set();
    debugLog(`🔄 Calculating 3x3 chunk grid (radius=${this.loadRadius})...`);
    
    for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
      for (let dy = -this.loadRadius; dy <= this.loadRadius; dy++) {
        const cx = chunkX + dx;
        const cy = chunkY + dy;
        const chunkKey = `${cx},${cy}`;
        requiredChunks.add(chunkKey);
        
        // Check if loaded in memory
        if (!this.isChunkLoaded(cx, cy)) {
          chunksToLoad.push({ x: cx, y: cy });
          debugLog(`   ├─ Chunk (${cx}, ${cy}) not in memory - will load`);
        } else {
          // Chunk in memory, check if rendered on screen
          if (!this.renderedChunks.has(chunkKey)) {
            const chunkData = this.getChunk(cx, cy);
            chunksToRender.push(chunkData);
            debugLog(`   ├─ Chunk (${cx}, ${cy}) in memory but not rendered - will render`);
          } else {
            debugLog(`   ├─ Chunk (${cx}, ${cy}) already loaded and rendered`);
          }
        }
      }
    }

    // Determine which chunks should be unloaded (too far from player)
    for (const [key, _] of this.loadedChunks) {
      if (!requiredChunks.has(key)) {
        const [cx, cy] = key.split(',').map(Number);
        chunksToUnload.push({ x: cx, y: cy });
        this.renderedChunks.delete(key); // Mark as not rendered
        debugLog(`   └─ Chunk (${cx}, ${cy}) too far - will unload`);
      }
    }

    // Load new chunks
    if (chunksToLoad.length > 0) {
      debugLog(`📥 [CHUNK STREAMING] Loading/generating ${chunksToLoad.length} chunks...`);
      for (const chunk of chunksToLoad) {
        debugLog(`   ├─ Processing chunk (${chunk.x}, ${chunk.y})...`);
        try {
          const chunkData = await this.loadChunk(chunk.x, chunk.y);
          if (chunkData) {
            debugLog(`   └─ ✅ Got chunk (${chunk.x}, ${chunk.y}): ${chunkData.objects.length} objects`);
            loadedChunks.push(chunkData);
            chunksToRender.push(chunkData); // Newly loaded chunks need rendering
          } else {
            debugLog(`   └─ ⚠️ Failed to get chunk (${chunk.x}, ${chunk.y})`);
          }
        } catch (err) {
          debugLog(`   └─ ❌ Error processing chunk (${chunk.x}, ${chunk.y}): ${err}`);
        }
      }
    } else {
      debugLog(`✅ All required chunks already in memory`);
    }

    // Unload far chunks
    if (chunksToUnload.length > 0) {
      debugLog(`🗑️ [CHUNK STREAMING] Unloading ${chunksToUnload.length} far chunks...`);
      for (const chunk of chunksToUnload) {
        debugLog(`   ├─ Unloading chunk (${chunk.x}, ${chunk.y})`);
        this.unloadChunk(chunk.x, chunk.y);
      }
    }

    debugLog(`✅ [CHUNK STREAMING] Complete - Loaded: ${loadedChunks.length}, ToRender: ${chunksToRender.length}, Unloaded: ${chunksToUnload.length}`);
    
    // Update current player chunk
    this.currentPlayerChunk = { x: chunkX, y: chunkY };
    
    return {
      loaded: loadedChunks,
      toRender: chunksToRender, // Add this - chunks that need rendering
      unloaded: chunksToUnload
    };
  }

  // Load chunk từ binary file
  async loadChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Nếu đã load rồi thì return luôn
    if (this.loadedChunks.has(chunkKey)) {
      debugLog(`📦 Chunk (${chunkX}, ${chunkY}) already loaded in memory`);
      return this.loadedChunks.get(chunkKey);
    }

    const chunkFileName = `chunk_${chunkX}_${chunkY}.bin`;
    const chunkPath = `/assets/Map/chunks/${chunkFileName}?t=${Date.now()}`;

    try {
      debugLog(`🔍 Attempting to fetch chunk file: ${chunkPath}`);
      const response = await fetch(chunkPath);
      
      if (response.status === 404) {
        debugLog(`❌ Chunk file not found (404) - generating new chunk (${chunkX}, ${chunkY})`);
        return await this.generateEmptyChunk(chunkX, chunkY);
      }
      
      if (!response.ok) {
        debugLog(`⚠️ Failed to fetch chunk (status ${response.status}) - generating new chunk (${chunkX}, ${chunkY})`);
        return await this.generateEmptyChunk(chunkX, chunkY);
      }

      // Kiểm tra content type để đảm bảo là binary file
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        debugLog(`⚠️ Got HTML instead of binary - generating new chunk (${chunkX}, ${chunkY})`);
        return await this.generateEmptyChunk(chunkX, chunkY);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Kiểm tra kích thước file hợp lệ (ít nhất phải có header 24 bytes)
      if (arrayBuffer.byteLength < 24) {
        debugLog(`⚠️ Chunk (${chunkX}, ${chunkY}) file too small (${arrayBuffer.byteLength} bytes) - generating empty chunk`);
        return await this.generateEmptyChunk(chunkX, chunkY);
      }
      
      debugLog(`📖 Parsing chunk file (${arrayBuffer.byteLength} bytes)`);
      const chunkData = this.parseChunkBinary(arrayBuffer);
      
      this.loadedChunks.set(chunkKey, chunkData);
      debugLog(`✅ Chunk (${chunkX}, ${chunkY}) loaded from file: ${chunkData.objects.length} objects`);
      
      // Register chunk to server for collision detection
      await this.saveChunkToServer(chunkData);
      
      return chunkData;
    } catch (err) {
      debugLog(`⚠️ Error loading chunk (${chunkX}, ${chunkY}): ${err.message}`);
      debugLog(`🔨 Generating new chunk as fallback (${chunkX}, ${chunkY})`);
      return await this.generateEmptyChunk(chunkX, chunkY);
    }
  }

  // Generate empty or procedural chunk when file doesn't exist
  async generateEmptyChunk(chunkX, chunkY) {
    debugLog(`🔨 Generating procedural chunk (${chunkX}, ${chunkY})`);
    
    const objects = [];
    const width = 20;
    const height = 20;
    
    // Track category counts for logging
    const categoryCounts = {};
    
    // ── Ground tiles (driven by GROUND_TILES config) ──────────────────
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = pickRandomGroundTile();
        const categories = getObjectCategories(tile.path);
        categories.forEach(cat => {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        objects.push({
          x,
          y,
          path: tile.path,
          isFree: false,
          rotation: 0,
          scale: 1,
          zIndex: tile.zIndex,
          gridType: 'square',
          placementLayer: tile.layer,
          categories
        });
      }
    }

    // ── Scatter objects (driven by SCATTER_OBJECTS config) ────────────
    for (const objDef of SCATTER_OBJECTS) {
      const count = Math.floor(Math.random() * (objDef.maxCount - objDef.minCount + 1)) + objDef.minCount;
      for (let i = 0; i < count; i++) {
        const objX = Math.floor(Math.random() * width);
        const objY = Math.floor(Math.random() * height);
        const categories = getObjectCategories(objDef.path);
        categories.forEach(cat => {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        objects.push({
          x: objX,
          y: objY,
          path: objDef.path,
          isFree: false,
          rotation: 0,
          scale: 1,
          zIndex: objDef.zIndex,
          gridType: 'square',
          placementLayer: objDef.layer,
          categories
        });
      }
    }
    
    debugLog(`✅ Generated ${objects.length} objects for chunk (${chunkX}, ${chunkY})`);
    debugLog(`📊 Category distribution in chunk (${chunkX}, ${chunkY}): ${JSON.stringify(categoryCounts)}`);
    
    const chunkData = {
      chunkX,
      chunkY,
      width: width,
      height: height,
      tileSize: 30,
      objects: objects
    };
    
    // Cache the generated chunk
    const chunkKey = `${chunkX},${chunkY}`;
    this.loadedChunks.set(chunkKey, chunkData);
    
    // Save chunk to server as binary file
    await this.saveChunkToServer(chunkData);
    
    return chunkData;
  }

  // Save generated chunk to server as binary file
  async saveChunkToServer(chunkData) {
    try {
      debugLog(`💾 Saving chunk (${chunkData.chunkX}, ${chunkData.chunkY}) to server...`);
      
      const response = await fetch('http://localhost:3000/save-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunkData)
      });
      
      const result = await response.json();
      if (result.success) {
        debugLog(`✅ Chunk (${chunkData.chunkX}, ${chunkData.chunkY}) saved: ${result.fileName} (${result.size})`);
      } else {
        debugLog(`❌ Failed to save chunk: ${result.error}`);
      }
    } catch (err) {
      debugLog(`❌ Error saving chunk (${chunkData.chunkX}, ${chunkData.chunkY}): ${err.message}`);
    }
  }

  // Parse binary chunk data
  parseChunkBinary(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    let offset = 0;

    try {
      // Read header
      const chunkX = view.getInt32(offset, true); offset += 4;
      const chunkY = view.getInt32(offset, true); offset += 4;
      const width = view.getInt32(offset, true); offset += 4;
      const height = view.getInt32(offset, true); offset += 4;
      const tileSize = view.getInt32(offset, true); offset += 4;
      const objectCount = view.getInt32(offset, true); offset += 4;

      if (objectCount < 0 || objectCount > 100000) {
        throw new Error(`Invalid object count: ${objectCount}`);
      }

      const objects = [];

      // Read objects
      for (let i = 0; i < objectCount; i++) {
        if (offset + 4 > arrayBuffer.byteLength) {
          throw new Error(`Unexpected end of buffer at object ${i}, offset ${offset}`);
        }
        
        const x = view.getInt32(offset, true); offset += 4;
        const y = view.getInt32(offset, true); offset += 4;
        
        // Read path string
        const pathLength = view.getInt32(offset, true); offset += 4;
        
        if (pathLength < 0 || pathLength > 1000) {
          throw new Error(`Invalid path length: ${pathLength} at object ${i}`);
        }
        
        if (offset + pathLength > arrayBuffer.byteLength) {
          throw new Error(`Path extends beyond buffer at object ${i}`);
        }
        
        const pathBytes = new Uint8Array(arrayBuffer, offset, pathLength);
        const path = new TextDecoder().decode(pathBytes);
        offset += pathLength;
        
        const isFree = view.getUint8(offset) === 1; offset += 1;
        const rotation = view.getFloat32(offset, true); offset += 4;
        const scale = view.getFloat32(offset, true); offset += 4;
        const zIndex = view.getInt32(offset, true); offset += 4;

        objects.push({
          x, y, path, isFree, rotation, scale, zIndex,
          gridType: 'square',
          placementLayer: 'ground'
        });
      }

      return {
        chunkX,
        chunkY,
        width,
        height,
        tileSize,
        objects
      };
    } catch (err) {
      console.error(`❌ Parse error at offset ${offset}:`, err);
      throw err;
    }
  }

  // Unload chunk để giải phóng memory
  unloadChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    if (this.loadedChunks.has(chunkKey)) {
      this.loadedChunks.delete(chunkKey);
      this.renderedChunks.delete(chunkKey);
      console.log(`🗑️  Unloaded chunk (${chunkX}, ${chunkY})`);
    }
  }

  // Get chunk nếu đã load
  getChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    return this.loadedChunks.get(chunkKey);
  }

  // Check xem chunk đã load chưa
  isChunkLoaded(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    return this.loadedChunks.has(chunkKey);
  }
}
