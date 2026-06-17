// Chunk Loader - Load binary chunk files dynamically
import { Container } from 'pixi.js';
import { getObjectCategories } from '../../config/objectCategories.js';
import { SCATTER_OBJECTS, pickRandomGroundTile } from './config.js';

export class GameChunk {
  constructor(chunkX, chunkY, width = 20, height = 20, tileSize = 30) {
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;

    // 1. PIXI Containers
    this.container = new Container();
    this.container.x = chunkX * width * tileSize;
    this.container.y = chunkY * height * tileSize;
    this.container.sortableChildren = false;

    this.groundLayer = new Container();
    this.groundLayer.x = chunkX * width * tileSize;
    this.groundLayer.y = chunkY * height * tileSize;
    this.groundLayer.zIndex = -1000000;
    this.groundLayer.sortableChildren = false; // Ground doesn't need depth sorting
    this.container.addChild(this.groundLayer);

    // Trackers for objects rendered in this chunk (added directly to world for global depth sorting)
    this.objectSprites = [];
    this.collidableObjects = [];
    this.farmedSprites = []; // Farmed tiles sprites added to groundLayer

    // 2. Logic Matrix/Grid
    this.tileGrid = [];
    for (let x = 0; x < this.width; x++) {
      this.tileGrid[x] = [];
      for (let y = 0; y < this.height; y++) {
        this.tileGrid[x][y] = {
          x,
          y,
          groundType: 'grass', // 'grass', 'dirt', 'farmed'
          isDiggable: true,
          groundSprite: null,
          object: null // { path, sprite, type, collidableRef, etc. }
        };
      }
    }
  }
}

export class ChunkLoader {
  constructor() {
    this.loadedChunks = new Map(); // Map<"x,y", chunkData>
    this.renderedChunks = new Map(); // Track rendered chunks: Map<"x,y", GameChunk>
    this.chunkSize = 20; // 20x20 tiles per chunk
    this.loadRadius = 2; // Load 2 chunks radius around player (5x5 grid = 25 chunks total)
    this.currentPlayerChunk = { x: 0, y: 0 }; // Track player's current chunk

    // Global farmed tiles and crops data cache
    this.farmedTilesData = new Map(); // Map<"chunkX,chunkY", Set<"localX,localY">>
    this.plantedCropsData = new Map(); // Map<"chunkX,chunkY", Map<"localX,localY", cropData>>
  }

  // Chuyển đổi world coordinates sang chunk coordinates
  worldToChunk(worldX, worldY) {
    const chunkX = Math.floor(worldX / (this.chunkSize * 30)); // 30 = tileSize
    const chunkY = Math.floor(worldY / (this.chunkSize * 30));
    return { chunkX, chunkY };
  }

  // Chuyển đổi world coordinates sang chunk coordinates và local tile coordinates
  worldToTile(worldX, worldY) {
    const chunkX = Math.floor(worldX / (this.chunkSize * 30));
    const chunkY = Math.floor(worldY / (this.chunkSize * 30));
    const chunkWorldX = chunkX * this.chunkSize * 30;
    const chunkWorldY = chunkY * this.chunkSize * 30;
    const localX = Math.floor((worldX - chunkWorldX) / 30);
    const localY = Math.floor((worldY - chunkWorldY) / 30);
    
    // Clamp values just in case
    const clampedLocalX = Math.max(0, Math.min(this.chunkSize - 1, localX));
    const clampedLocalY = Math.max(0, Math.min(this.chunkSize - 1, localY));
    
    return { chunkX, chunkY, localX: clampedLocalX, localY: clampedLocalY };
  }

  cacheFarmedTiles(tilesList) {
    this.farmedTilesData.clear();
    tilesList.forEach(tile => {
      const { chunkX, chunkY, localX, localY } = this.worldToTile(tile.x, tile.y);
      const chunkKey = `${chunkX},${chunkY}`;
      if (!this.farmedTilesData.has(chunkKey)) {
        this.farmedTilesData.set(chunkKey, new Set());
      }
      this.farmedTilesData.get(chunkKey).add(`${localX},${localY}`);
    });
  }

  cachePlantedCrops(cropsList) {
    this.plantedCropsData.clear();
    cropsList.forEach(crop => {
      const { chunkX, chunkY, localX, localY } = this.worldToTile(crop.x, crop.y);
      const chunkKey = `${chunkX},${chunkY}`;
      if (!this.plantedCropsData.has(chunkKey)) {
        this.plantedCropsData.set(chunkKey, new Map());
      }
      this.plantedCropsData.get(chunkKey).set(`${localX},${localY}`, crop);
    });
  }

  addFarmedTileToCache(x, y) {
    const { chunkX, chunkY, localX, localY } = this.worldToTile(x, y);
    const chunkKey = `${chunkX},${chunkY}`;
    if (!this.farmedTilesData.has(chunkKey)) {
      this.farmedTilesData.set(chunkKey, new Set());
    }
    this.farmedTilesData.get(chunkKey).add(`${localX},${localY}`);
  }

  addPlantedCropToCache(crop) {
    const { chunkX, chunkY, localX, localY } = this.worldToTile(crop.x, crop.y);
    const chunkKey = `${chunkX},${chunkY}`;
    if (!this.plantedCropsData.has(chunkKey)) {
      this.plantedCropsData.set(chunkKey, new Map());
    }
    this.plantedCropsData.get(chunkKey).set(`${localX},${localY}`, crop);
  }

  removePlantedCropFromCache(x, y) {
    const { chunkX, chunkY, localX, localY } = this.worldToTile(x, y);
    const chunkKey = `${chunkX},${chunkY}`;
    if (this.plantedCropsData.has(chunkKey)) {
      this.plantedCropsData.get(chunkKey).delete(`${localX},${localY}`);
    }
  }

  // Load 9 chunks xung quanh player (3x3 grid)
  async loadChunksAroundPlayer(playerX, playerY) {
    const { chunkX, chunkY } = this.worldToChunk(playerX, playerY);
    
    const loadedChunks = [];
    const chunksToLoad = [];
    const chunksToUnload = [];
    const chunksToRender = []; // Chunks loaded but not rendered yet

    // Determine which chunks should be loaded (3x3 grid around player)
    const requiredChunks = new Set();
    
    for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
      for (let dy = -this.loadRadius; dy <= this.loadRadius; dy++) {
        const cx = chunkX + dx;
        const cy = chunkY + dy;
        const chunkKey = `${cx},${cy}`;
        requiredChunks.add(chunkKey);
        
        // Check if loaded in memory
        if (!this.isChunkLoaded(cx, cy)) {
          chunksToLoad.push({ x: cx, y: cy });
        } else {
          // Chunk in memory, check if rendered on screen
          if (!this.renderedChunks.has(chunkKey)) {
            const chunkData = this.getChunk(cx, cy);
            chunksToRender.push(chunkData);
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
      }
    }

    // Load new chunks
    if (chunksToLoad.length > 0) {
      for (const chunk of chunksToLoad) {
        try {
          const chunkData = await this.loadChunk(chunk.x, chunk.y);
          if (chunkData) {
            loadedChunks.push(chunkData);
            chunksToRender.push(chunkData); // Newly loaded chunks need rendering
          }
        } catch (err) {
          console.error(`Error processing chunk (${chunk.x}, ${chunk.y}): ${err}`);
        }
      }
    }

    // Unload far chunks
    if (chunksToUnload.length > 0) {
      for (const chunk of chunksToUnload) {
        this.unloadChunk(chunk.x, chunk.y);
      }
    }
    
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
      return this.loadedChunks.get(chunkKey);
    }

    const chunkFileName = `chunk_${chunkX}_${chunkY}.bin`;
    const chunkPath = `/assets/Map/chunks/${chunkFileName}?t=${Date.now()}`;

    try {
      const response = await fetch(chunkPath);
      
      if (response.status === 404) {
        return await this.generateEmptyChunk(chunkX, chunkY);
      }
      
      if (!response.ok) {
        return await this.generateEmptyChunk(chunkX, chunkY);
      }

      // Kiểm tra content type để đảm bảo là binary file
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        return await this.generateEmptyChunk(chunkX, chunkY);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // Kiểm tra kích thước file hợp lệ (ít nhất phải có header 24 bytes)
      if (arrayBuffer.byteLength < 24) {
        return await this.generateEmptyChunk(chunkX, chunkY);
      }
      
      const chunkData = this.parseChunkBinary(arrayBuffer);
      
      this.loadedChunks.set(chunkKey, chunkData);
      
      // Register chunk to server for collision detection
      await this.saveChunkToServer(chunkData);
      
      return chunkData;
    } catch (err) {
      return await this.generateEmptyChunk(chunkX, chunkY);
    }
  }

  // Generate empty or procedural chunk when file doesn't exist
  async generateEmptyChunk(chunkX, chunkY) {
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
      const response = await fetch('http://localhost:3000/save-chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunkData)
      });
      
      const result = await response.json();
      if (!result.success) {
        console.error(`Failed to save chunk: ${result.error}`);
      }
    } catch (err) {
      console.error(`Error saving chunk (${chunkData.chunkX}, ${chunkData.chunkY}): ${err.message}`);
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
