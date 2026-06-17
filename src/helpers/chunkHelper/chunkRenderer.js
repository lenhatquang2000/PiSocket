// Chunk Renderer - Render objects from loaded chunks
import { AnimatedSprite, Graphics, Assets } from 'pixi.js';
import { GameChunk } from './chunkLoader.js';

export async function renderChunk(chunkData, chunkLoader, world, objectSprites, collidableObjects, debugGraphics, collisionData) {
  const chunkKey = `${chunkData.chunkX},${chunkData.chunkY}`;

  let gameChunk = chunkLoader.renderedChunks.get(chunkKey);
  if (!gameChunk) {
    gameChunk = new GameChunk(chunkData.chunkX, chunkData.chunkY, chunkData.width, chunkData.height, chunkData.tileSize);
    chunkLoader.renderedChunks.set(chunkKey, gameChunk);
  }

  world.addChild(gameChunk.groundLayer);

  // Collect unique asset paths that need loading
  const uniquePaths = new Set();
  for (const obj of chunkData.objects) {
    uniquePaths.add(obj.path);
  }
  
  // Pre-load any missing assets
  const assetsToLoad = [];
  for (const path of uniquePaths) {
    if (!Assets.get(path)) {
      assetsToLoad.push(path);
    }
  }
  
  if (assetsToLoad.length > 0) {
    try {
      await Promise.all(assetsToLoad.map(path => Assets.load(path)));
    } catch (err) {
      console.error(`Error pre-loading assets: ${err}`);
    }
  }

  // --- BƯỚC 1: XỬ LÝ LỚP NỀN (GROUND LAYER) ---
  for (const obj of chunkData.objects) {
    const isTopdownGround = obj.path.startsWith('/assets/Map/topdown/') || 
                             obj.path.startsWith('/assets/Farming1/2D_game_asset_cultivated_farm');
    
    if (isTopdownGround) {
      const cell = gameChunk.tileGrid[obj.x][obj.y];
      cell.groundType = obj.path.includes('gr1') ? 'dirt' : 'grass';
      cell.isDiggable = true;
      cell.isFarmed = false;

      // Check cache for farmed tiles
      const cachedFarmed = chunkLoader.farmedTilesData.has(chunkKey) && 
                           chunkLoader.farmedTilesData.get(chunkKey).has(`${obj.x},${obj.y}`);
      
      let finalPath = obj.path;
      if (cachedFarmed) {
        finalPath = '/assets/Farming1/2D_game_asset_cultivated_farm (14).png';
        cell.groundType = 'farmed';
        cell.isDiggable = false;
        cell.isFarmed = true;
      }

      const objTexture = Assets.get(finalPath);
      if (!objTexture) continue;

      const groundSprite = new AnimatedSprite([objTexture]);
      groundSprite.x = obj.x * gameChunk.tileSize;
      groundSprite.y = obj.y * gameChunk.tileSize;
      groundSprite.anchor.set(0, 0);

      const scale = obj.scale || (gameChunk.tileSize / objTexture.width);
      groundSprite.scale.set(scale);

      gameChunk.groundLayer.addChild(groundSprite);
      cell.groundSprite = groundSprite;
    }
  }

  // --- BƯỚC 2: XỬ LÝ LỚP VẬT THỂ (OBJECT LAYER) ---
  for (const obj of chunkData.objects) {
    const isTopdownGround = obj.path.startsWith('/assets/Map/topdown/') || 
                             obj.path.startsWith('/assets/Farming1/2D_game_asset_cultivated_farm');
    
    if (!isTopdownGround) {
      const objTexture = Assets.get(obj.path);
      if (!objTexture) {
        console.warn(`Texture not found: ${obj.path}`);
        continue;
      }

      const sprite = new AnimatedSprite([objTexture]);

      // Calculate world position
      const worldX = gameChunk.container.x + (obj.x * gameChunk.tileSize);
      const worldY = gameChunk.container.y + (obj.y * gameChunk.tileSize);

      sprite.x = worldX;
      sprite.y = worldY;
      sprite.anchor.set(0, 0);

      const scale = obj.scale || 1.0;
      sprite.scale.set(scale);

      if (obj.rotation) {
        sprite.rotation = obj.rotation * Math.PI / 180;
      }

      sprite.editorZIndex = (obj.zIndex || 1) * 100;
      sprite.zIndex = Math.floor(sprite.y * 10) + sprite.editorZIndex;
      
      // Tag sprite with chunk info
      sprite.chunkX = chunkData.chunkX;
      sprite.chunkY = chunkData.chunkY;

      world.addChild(sprite);
      objectSprites.push(sprite);
      gameChunk.objectSprites.push(sprite);

      const cell = gameChunk.tileGrid[obj.x][obj.y];
      cell.object = {
        path: obj.path,
        sprite: sprite,
        type: obj.path.includes('forest_obj_11') ? 'tree' : 'stone'
      };

      // Collision data
      const hitData = collisionData[obj.path];
      if (hitData) {
        let hitPoints, zIndexUpPoints, zIndexDownPoints, triggerZonePoints;
        if (Array.isArray(hitData)) {
          hitPoints = hitData;
          zIndexUpPoints = [];
          zIndexDownPoints = [];
          triggerZonePoints = [];
        } else {
          hitPoints = hitData.normal || [];
          zIndexUpPoints = hitData.z_index_up || [];
          zIndexDownPoints = hitData.z_index_down || [];
          triggerZonePoints = hitData.trigger_zone || [];
        }

        const collidableRef = {
          x: sprite.x,
          y: sprite.y,
          scale: scale,
          anchor: sprite.anchor,
          points: hitPoints,
          zIndexUpPoints: zIndexUpPoints,
          zIndexDownPoints: zIndexDownPoints,
          triggerZonePoints: triggerZonePoints,
          width: objTexture.width,
          height: objTexture.height,
          sprite: sprite,
          path: obj.path,
          chunkX: chunkData.chunkX,
          chunkY: chunkData.chunkY
        };

        collidableObjects.push(collidableRef);
        gameChunk.collidableObjects.push(collidableRef);

        // Debug graphics
        const g = new Graphics();
        g.beginFill(0xff0000, 0.5);
        hitPoints.forEach(p => {
          const px = (p.x - objTexture.width * sprite.anchor.x) * scale;
          const py = (p.y - objTexture.height * sprite.anchor.y) * scale;
          g.drawRect(sprite.x + px, sprite.y + py, scale, scale);
        });
        if (zIndexUpPoints.length > 0) {
          g.beginFill(0x00ff00, 0.5);
          zIndexUpPoints.forEach(p => {
            const px = (p.x - objTexture.width * sprite.anchor.x) * scale;
            const py = (p.y - objTexture.height * sprite.anchor.y) * scale;
            g.drawRect(sprite.x + px, sprite.y + py, scale, scale);
          });
        }
        if (zIndexDownPoints.length > 0) {
          g.beginFill(0xffff00, 0.5);
          zIndexDownPoints.forEach(p => {
            const px = (p.x - objTexture.width * sprite.anchor.x) * scale;
            const py = (p.y - objTexture.height * sprite.anchor.y) * scale;
            g.drawRect(sprite.x + px, sprite.y + py, scale, scale);
          });
        }
        g.visible = false;
        debugGraphics.addChild(g);
        sprite.debugBounds = g;
      }
    }
  }

  // --- BƯỚC 3: XỬ LÝ CÂY TRỒNG (CROPS) ---
  if (chunkLoader.plantedCropsData.has(chunkKey) && chunkLoader.riceGrowthFrames) {
    const cropsMap = chunkLoader.plantedCropsData.get(chunkKey);
    const riceGrowthFrames = chunkLoader.riceGrowthFrames;
    const stageToPath = {
      1: '/assets/seed/1._Tiny_green_rice_seedling_sprout_emerg.png',
      2: '/assets/seed/5._Young_green_rice_plant_medium_height.png',
      3: '/assets/seed/9._Tall_green_rice_plant_with_flowering.png',
      4: '/assets/seed/13._Mature_golden_yellow_rice_plant_read.png'
    };

    for (const [coordStr, crop] of cropsMap) {
      const [localX, localY] = coordStr.split(',').map(Number);
      
      const cropData = {
        id: crop.crop_type_id,
        name: crop.crop_name,
        display_name: crop.display_name,
        sprite_path: crop.sprite_path
      };

      const plantedAt = new Date(crop.planted_at).getTime();
      const elapsed = (Date.now() - plantedAt) / 1000; // seconds

      let currentStage = 1;
      if (elapsed < 10) currentStage = 1;
      else if (elapsed < 20) currentStage = 2;
      else if (elapsed < 30) currentStage = 3;
      else currentStage = 4;

      const stageFrames = `stage${currentStage}`;
      const cropSprite = new AnimatedSprite(riceGrowthFrames[stageFrames]);

      // Calculate absolute world coordinates (crops align to center of tile)
      const worldX = gameChunk.container.x + (localX * gameChunk.tileSize) + (gameChunk.tileSize / 2);
      const worldY = gameChunk.container.y + (localY * gameChunk.tileSize) + gameChunk.tileSize;

      cropSprite.x = worldX;
      cropSprite.y = worldY;
      cropSprite.anchor.set(0.5, 1);
      cropSprite.scale.set(0.5);
      cropSprite.zIndex = Math.floor(worldY * 10);
      cropSprite.animationSpeed = 0.02;
      cropSprite.loop = true;
      cropSprite.play();

      world.addChild(cropSprite);
      gameChunk.objectSprites.push(cropSprite);

      const cropObject = {
        sprite: cropSprite,
        x: worldX,
        y: worldY,
        cropData: cropData,
        plantedAt: plantedAt,
        currentStage: currentStage,
        maxStage: 4,
        objectTypeId: `planted_crop_${crop.id}`,
        points: [],
        zIndexUpPoints: [],
        zIndexDownPoints: [],
        triggerZonePoints: [],
        width: cropSprite.texture.width,
        height: cropSprite.texture.height,
        scale: 0.5,
        anchor: cropSprite.anchor,
        path: stageToPath[currentStage],
        stageToPath: stageToPath,
        plantedCropId: crop.id,
        chunkX: chunkData.chunkX,
        chunkY: chunkData.chunkY
      };

      // Load collider config if any
      const hitData = collisionData[cropObject.path];
      if (hitData) {
        if (Array.isArray(hitData)) {
          cropObject.points = hitData;
        } else {
          cropObject.points = hitData.normal || [];
          cropObject.zIndexUpPoints = hitData.z_index_up || [];
          cropObject.zIndexDownPoints = hitData.z_index_down || [];
          cropObject.triggerZonePoints = hitData.trigger_zone || [];
        }
      }

      if (chunkLoader.globalPlantedCrops) {
        chunkLoader.globalPlantedCrops.push(cropObject);
      }
      if (chunkLoader.globalCollidableObjects) {
        chunkLoader.globalCollidableObjects.push(cropObject);
        gameChunk.collidableObjects.push(cropObject);
      }

      gameChunk.tileGrid[localX][localY].object = cropObject;
    }
  }
}

export function unloadChunkRender(chunkX, chunkY, world, objectSprites, collidableObjects, debugGraphics, chunkLoader) {
  const chunkKey = `${chunkX},${chunkY}`;

  const gameChunk = chunkLoader.renderedChunks.get(chunkKey);
  if (!gameChunk) return;

  // 1. Remove ground layer
  world.removeChild(gameChunk.groundLayer);
  gameChunk.groundLayer.destroy({ children: true });

  // 2. Remove object sprites
  gameChunk.objectSprites.forEach(sprite => {
    world.removeChild(sprite);
    if (sprite.debugBounds) {
      debugGraphics.removeChild(sprite.debugBounds);
    }
    sprite.destroy();
  });

  // 3. Remove from global arrays
  const spritesSet = new Set(gameChunk.objectSprites);
  for (let i = objectSprites.length - 1; i >= 0; i--) {
    if (spritesSet.has(objectSprites[i]) || (objectSprites[i].chunkX === chunkX && objectSprites[i].chunkY === chunkY)) {
      objectSprites.splice(i, 1);
    }
  }

  const collidablesSet = new Set(gameChunk.collidableObjects);
  for (let i = collidableObjects.length - 1; i >= 0; i--) {
    const c = collidableObjects[i];
    if (collidablesSet.has(c) || (c.chunkX === chunkX && c.chunkY === chunkY)) {
      collidableObjects.splice(i, 1);
    }
  }

  if (chunkLoader.globalPlantedCrops) {
    for (let i = chunkLoader.globalPlantedCrops.length - 1; i >= 0; i--) {
      const crop = chunkLoader.globalPlantedCrops[i];
      if (crop.chunkX === chunkX && crop.chunkY === chunkY) {
        chunkLoader.globalPlantedCrops.splice(i, 1);
      }
    }
  }

  chunkLoader.renderedChunks.delete(chunkKey);
}
