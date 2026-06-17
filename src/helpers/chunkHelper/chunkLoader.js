// Chunk Loader - Load binary chunk files dynamically
import { getObjectCategories } from '../../config/objectCategories.js';

export class ChunkLoader {
  constructor() {
    this.loadedChunks = new Map(); // Map<"x,y", chunkData>
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
    
    // Check if player moved to a different chunk
    if (this.currentPlayerChunk.x === chunkX && this.currentPlayerChunk.y === chunkY) {
      // Player still in same chunk, no need to reload
      return { loaded: [], unloaded: [] };
    }

    console.log(`🗺️ [CHUNK STREAMING] Player moved to chunk (${chunkX}, ${chunkY})`);
    this.currentPlayerChunk = { x: chunkX, y: chunkY };

    const loadedChunks = [];
    const chunksToLoad = [];
    const chunksToUnload = [];

    // Determine which chunks should be loaded (3x3 grid around player)
    const requiredChunks = new Set();
    for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
      for (let dy = -this.loadRadius; dy <= this.loadRadius; dy++) {
        const cx = chunkX + dx;
        const cy = chunkY + dy;
        requiredChunks.add(`${cx},${cy}`);
        
        if (!this.isChunkLoaded(cx, cy)) {
          chunksToLoad.push({ x: cx, y: cy });
        }
      }
    }

    // Determine which chunks should be unloaded (too far from player)
    for (const [key, _] of this.loadedChunks) {
      if (!requiredChunks.has(key)) {
        const [cx, cy] = key.split(',').map(Number);
        chunksToUnload.push({ x: cx, y: cy });
      }
    }

    // Load new chunks
    console.log(`📥 [CHUNK STREAMING] Loading ${chunksToLoad.length} new chunks...`);
    for (const chunk of chunksToLoad) {
      const chunkData = await this.loadChunk(chunk.x, chunk.y);
      if (chunkData) {
        loadedChunks.push(chunkData);
      }
    }

    // Unload far chunks
    if (chunksToUnload.length > 0) {
      console.log(`🗑️ [CHUNK STREAMING] Unloading ${chunksToUnload.length} far chunks...`);
      for (const chunk of chunksToUnload) {
        this.unloadChunk(chunk.x, chunk.y);
      }
    }

    return {
      loaded: loadedChunks,
      unloaded: chunksToUnload
    };
  }

  // Load chunk từ binary file
  async loadChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Nếu đã load rồi thì return luôn
    if (this.loadedChunks.has(chunkKey)) {
      return this.loadedChunks.get(chunkKey);
    }

    const chunkFileName = `chunk_${chunkX}_${chunkY}.bin`;
    // Add cache busting timestamp
    const chunkPath = `/assets/Map/chunks/${chunkFileName}?t=${Date.now()}`;

    try {
      const response = await fetch(chunkPath);
      if (response.status === 404) {
        return this.generateEmptyChunk(chunkX, chunkY);
      }
      if (!response.ok) {
        return this.generateEmptyChunk(chunkX, chunkY);
      }

      // Kiểm tra content type để đảm bảo là binary file
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        return this.generateEmptyChunk(chunkX, chunkY);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Kiểm tra kích thước file hợp lệ (ít nhất phải có header 24 bytes)
      if (arrayBuffer.byteLength < 24) {
        console.warn(`⚠️ Chunk (${chunkX}, ${chunkY}) file too small - generating empty chunk`);
        return this.generateEmptyChunk(chunkX, chunkY);
      }
      
      const chunkData = this.parseChunkBinary(arrayBuffer);
      
      this.loadedChunks.set(chunkKey, chunkData);
      console.log(`✅ Chunk (${chunkX}, ${chunkY}) loaded: ${chunkData.objects.length} objects`);
      
      // Register chunk to server for collision detection
      await this.saveChunkToServer(chunkData);
      
      return chunkData;
    } catch (err) {
      console.warn(`⚠️ Failed to load chunk (${chunkX}, ${chunkY}):`, err.message);
      return this.generateEmptyChunk(chunkX, chunkY);
    }
  }

  // Generate empty or procedural chunk when file doesn't exist
  async generateEmptyChunk(chunkX, chunkY) {
    console.log(`🔨 Generating procedural chunk (${chunkX}, ${chunkY})`);
    
    const objects = [];
    const width = 20;
    const height = 20;
    
    // Track category counts for logging
    const categoryCounts = {};
    
    // Procedurally generate ground tiles (gr1 or gr2)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Random ground type: 70% gr1, 30% gr2
        const groundType = Math.random() < 0.7 ? 'gr1' : 'gr2';
        const path = `/assets/Map/topdown/${groundType}.png`;
        
        // Get categories for this object
        const categories = getObjectCategories(path);
        
        // Count categories
        categories.forEach(cat => {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
        
        objects.push({
          x: x,
          y: y,
          path: path,
          isFree: false,
          rotation: 0,
          scale: 1,
          zIndex: 1,
          gridType: 'square',
          placementLayer: 'ground',
          categories: categories
        });
      }
    }
    
    // Add random desert objects (5-10 per chunk)
    const numObjects = Math.floor(Math.random() * 6) + 5; // 5-10 objects
    for (let i = 0; i < numObjects; i++) {
      const objX = Math.floor(Math.random() * width);
      const objY = Math.floor(Math.random() * height);
      const objPath = '/assets/Object/desert/desert_obj_7.png';
      
      const categories = getObjectCategories(objPath);
      categories.forEach(cat => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      
      objects.push({
        x: objX,
        y: objY,
        path: objPath,
        isFree: false,
        rotation: 0,
        scale: 1,
        zIndex: 100, // Higher z-index for objects
        gridType: 'square',
        placementLayer: 'object',
        categories: categories
      });
    }
    
    console.log(`✅ Generated ${objects.length} objects for chunk (${chunkX}, ${chunkY})`);
    console.log(`📊 Category distribution in chunk (${chunkX}, ${chunkY}):`, categoryCounts);
    
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
      console.log(`💾 Saving chunk (${chunkData.chunkX}, ${chunkData.chunkY}) to server...`);
      
      const response = await fetch('http://localhost:3000/save-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunkData)
      });
      
      const result = await response.json();
      if (result.success) {
        console.log(`✅ Chunk (${chunkData.chunkX}, ${chunkData.chunkY}) saved: ${result.fileName} (${result.size})`);
      } else {
        console.error(`❌ Failed to save chunk:`, result.error);
      }
    } catch (err) {
      console.error(`❌ Error saving chunk (${chunkData.chunkX}, ${chunkData.chunkY}):`, err.message);
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
