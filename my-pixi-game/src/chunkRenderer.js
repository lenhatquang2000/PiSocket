// Chunk Renderer - Render objects from loaded chunks
import { AnimatedSprite, Graphics, Assets } from 'pixi.js';

export async function renderChunk(chunkData, world, objectSprites, collidableObjects, debugGraphics, collisionData) {
  console.log(`🎨 [CHUNK RENDER] Rendering chunk (${chunkData.chunkX}, ${chunkData.chunkY})`);
  console.log(`   Objects: ${chunkData.objects.length}`);
  console.log(`   Tile size: ${chunkData.tileSize}`);

  const chunkWorldX = chunkData.chunkX * chunkData.width * chunkData.tileSize;
  const chunkWorldY = chunkData.chunkY * chunkData.height * chunkData.tileSize;
  
  console.log(`   Chunk world position: (${chunkWorldX}, ${chunkWorldY})`);

  let renderedCount = 0;

  for (const obj of chunkData.objects) {
    const objTexture = Assets.get(obj.path);
    if (!objTexture) {
      console.warn(`⚠️ Texture not found: ${obj.path}`);
      continue;
    }

    const sprite = new AnimatedSprite([objTexture]);

    // Calculate world position
    const worldX = chunkWorldX + (obj.x * chunkData.tileSize);
    const worldY = chunkWorldY + (obj.y * chunkData.tileSize);

    sprite.x = worldX;
    sprite.y = worldY;
    sprite.anchor.set(0, 0);

    const scale = obj.scale || 1.0;
    sprite.scale.set(scale);

    if (obj.rotation) {
      sprite.rotation = obj.rotation * Math.PI / 180;
    }

    sprite.isTopdownGround = obj.path.startsWith('/assets/Map/topdown/') || 
                             obj.path.startsWith('/assets/Farming1/2D_game_asset_cultivated_farm');
    sprite.editorZIndex = (obj.zIndex || 1) * 100;
    sprite.zIndex = sprite.isTopdownGround ? -1000000 : (obj.zIndex ?? 1);
    
    // Tag sprite with chunk info for later cleanup
    sprite.chunkX = chunkData.chunkX;
    sprite.chunkY = chunkData.chunkY;

    world.addChild(sprite);
    objectSprites.push(sprite);

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

      collidableObjects.push({
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
      });

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

    renderedCount++;
  }

  console.log(`✅ [CHUNK RENDER] Rendered ${renderedCount} objects from chunk (${chunkData.chunkX}, ${chunkData.chunkY})`);
}

// Unload chunk - remove all sprites and collision data from a chunk
export function unloadChunkRender(chunkX, chunkY, world, objectSprites, collidableObjects, debugGraphics) {
  console.log(`🗑️  [CHUNK RENDER] Unloading chunk (${chunkX}, ${chunkY})`);

  // Remove sprites
  const spritesToRemove = objectSprites.filter(s => s.chunkX === chunkX && s.chunkY === chunkY);
  spritesToRemove.forEach(sprite => {
    world.removeChild(sprite);
    if (sprite.debugBounds) {
      debugGraphics.removeChild(sprite.debugBounds);
    }
    sprite.destroy();
  });

  // Remove from objectSprites array
  for (let i = objectSprites.length - 1; i >= 0; i--) {
    if (objectSprites[i].chunkX === chunkX && objectSprites[i].chunkY === chunkY) {
      objectSprites.splice(i, 1);
    }
  }

  // Remove collision data
  for (let i = collidableObjects.length - 1; i >= 0; i--) {
    if (collidableObjects[i].chunkX === chunkX && collidableObjects[i].chunkY === chunkY) {
      collidableObjects.splice(i, 1);
    }
  }

  console.log(`✅ [CHUNK RENDER] Unloaded ${spritesToRemove.length} sprites from chunk (${chunkX}, ${chunkY})`);
}
