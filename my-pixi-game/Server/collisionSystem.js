// Server-side Collision Detection System
// Supports 4 types of colliders: normal (red), z_index_up (green), z_index_down (yellow), trigger_zone (purple)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load collision data from file
let collisionData = {};
try {
  const collisionPath = path.join(__dirname, '../public/assets/Object/collision_data.json');
  if (fs.existsSync(collisionPath)) {
    const data = fs.readFileSync(collisionPath, 'utf8');
    collisionData = JSON.parse(data);
    console.log(`✅ Loaded collision data: ${Object.keys(collisionData).length} objects`);
  }
} catch (err) {
  console.warn('⚠️ Failed to load collision data:', err.message);
}

// Player collider data (from character sprite)
const PLAYER_COLLIDER = {
  width: 30,
  height: 30,
  anchor: { x: 0.5, y: 0.55 },
  scale: 0.7,
  normal: [], // Red - blocking collision
  trigger_zone: [] // Purple - for z-index triggers
};

// Load player collision data if available
const playerPath = '/assets/A_cute_chibi_anime_girl/animations/Breathing_Idle-905887d4/south/frame_000.png';
if (collisionData[playerPath]) {
  const playerHitData = collisionData[playerPath];
  
  if (Array.isArray(playerHitData)) {
    // Old format - treat as normal collision
    PLAYER_COLLIDER.normal = playerHitData;
  } else if (typeof playerHitData === 'object') {
    // Load trigger_zone from collision data
    PLAYER_COLLIDER.trigger_zone = playerHitData.trigger_zone || [];
    
    // Use default small collision at feet for blocking (more accurate)
    // Instead of using the large normal collision from editor
    PLAYER_COLLIDER.normal = [
      { x: 13, y: 25 }, { x: 14, y: 25 }, { x: 15, y: 25 }, { x: 16, y: 25 }, { x: 17, y: 25 },
      { x: 12, y: 26 }, { x: 13, y: 26 }, { x: 14, y: 26 }, { x: 15, y: 26 }, { x: 16, y: 26 }, { x: 17, y: 26 }, { x: 18, y: 26 },
      { x: 12, y: 27 }, { x: 13, y: 27 }, { x: 14, y: 27 }, { x: 15, y: 27 }, { x: 16, y: 27 }, { x: 17, y: 27 }, { x: 18, y: 27 },
      { x: 13, y: 28 }, { x: 14, y: 28 }, { x: 15, y: 28 }, { x: 16, y: 28 }, { x: 17, y: 28 }
    ];
  }
  
  console.log(`✅ Player collision loaded: ${PLAYER_COLLIDER.normal.length} normal (feet), ${PLAYER_COLLIDER.trigger_zone.length} trigger_zone`);
} else {
  // Default player hitbox (circle-like shape at feet)
  PLAYER_COLLIDER.normal = [
    { x: 13, y: 25 }, { x: 14, y: 25 }, { x: 15, y: 25 }, { x: 16, y: 25 }, { x: 17, y: 25 },
    { x: 12, y: 26 }, { x: 13, y: 26 }, { x: 14, y: 26 }, { x: 15, y: 26 }, { x: 16, y: 26 }, { x: 17, y: 26 }, { x: 18, y: 26 },
    { x: 12, y: 27 }, { x: 13, y: 27 }, { x: 14, y: 27 }, { x: 15, y: 27 }, { x: 16, y: 27 }, { x: 17, y: 27 }, { x: 18, y: 27 },
    { x: 13, y: 28 }, { x: 14, y: 28 }, { x: 15, y: 28 }, { x: 16, y: 28 }, { x: 17, y: 28 }
  ];
  console.log(`⚠️ Player collision NOT FOUND, using default: ${PLAYER_COLLIDER.normal.length} points`);
}

/**
 * Check collision between two sets of points
 * @param {Array} points1 - First set of collision points with world positions
 * @param {Array} points2 - Second set of collision points with world positions
 * @returns {boolean} - true if any points overlap
 */
function checkPointsCollision(points1, points2) {
  for (let p1 of points1) {
    for (let p2 of points2) {
      // Check if pixels overlap (within 1 pixel tolerance)
      if (Math.abs(p1.worldX - p2.worldX) < 1 && Math.abs(p1.worldY - p2.worldY) < 1) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check collision with distance tolerance (for debugging)
 */
function checkPointsCollisionWithTolerance(points1, points2, tolerance = 10) {
  let minDist = Infinity;
  for (let p1 of points1) {
    for (let p2 of points2) {
      const dist = Math.sqrt(Math.pow(p1.worldX - p2.worldX, 2) + Math.pow(p1.worldY - p2.worldY, 2));
      if (dist < minDist) minDist = dist;
      if (dist < tolerance) {
        return { collision: true, minDist: dist };
      }
    }
  }
  return { collision: false, minDist };
}

/**
 * Convert local collision points to world coordinates
 * @param {Array} points - Local collision points
 * @param {Object} entity - Entity with x, y, scale, anchor, width, height
 * @returns {Array} - Points with worldX, worldY
 */
function toWorldCoordinates(points, entity) {
  const scale = entity.scale || 1;
  const anchor = entity.anchor || { x: 0.5, y: 0.5 };
  const width = entity.width || 32;
  const height = entity.height || 32;
  
  return points.map(p => ({
    worldX: entity.x + (p.x - width * anchor.x) * scale,
    worldY: entity.y + (p.y - height * anchor.y) * scale
  }));
}

/**
 * Check collision between player and object (normal collision - blocks movement)
 * @param {Object} player - { x, y, scale }
 * @param {Object} object - { x, y, path, scale, anchor, width, height }
 * @returns {boolean} - true if collision detected
 */
export function checkCollision(player, object) {
  // Get object collision data
  const objCollisionData = collisionData[object.path];
  if (!objCollisionData) return false;

  // Parse object normal collision points (red)
  let objNormalPoints = [];
  if (Array.isArray(objCollisionData)) {
    objNormalPoints = objCollisionData;
  } else if (objCollisionData.normal) {
    objNormalPoints = objCollisionData.normal;
  }

  if (objNormalPoints.length === 0) return false;

  // Quick distance check first
  const dist = Math.sqrt(Math.pow(player.x - object.x, 2) + Math.pow(player.y - object.y, 2));
  if (dist > 200) return false;

  // Convert to world coordinates
  const playerWorldPoints = toWorldCoordinates(PLAYER_COLLIDER.normal, {
    x: player.x,
    y: player.y,
    scale: player.scale || PLAYER_COLLIDER.scale,
    anchor: PLAYER_COLLIDER.anchor,
    width: PLAYER_COLLIDER.width,
    height: PLAYER_COLLIDER.height
  });

  const objWorldPoints = toWorldCoordinates(objNormalPoints, object);

  // Check collision
  const hasCollision = checkPointsCollision(playerWorldPoints, objWorldPoints);
  
  // No logging - too spammy at 30 ticks/second
  
  return hasCollision;
}

/**
 * Check z-index trigger collision
 * Player trigger_zone (purple) vs Object z_index_up (green)
 * @param {Object} player - { x, y, scale }
 * @param {Object} object - { x, y, path, scale, anchor, width, height }
 * @returns {string|null} - 'up' if player should be above object, null otherwise
 */
export function checkZIndexTrigger(player, object) {
  // Get object collision data
  const objCollisionData = collisionData[object.path];
  if (!objCollisionData || !objCollisionData.z_index_up) return null;

  const objZIndexUpPoints = objCollisionData.z_index_up;
  if (objZIndexUpPoints.length === 0) return null;

  // Player must have trigger_zone points
  if (PLAYER_COLLIDER.trigger_zone.length === 0) {
    // Log once per session
    if (!checkZIndexTrigger.logged) {
      console.log(`⚠️ Player has no trigger_zone points - cannot trigger z-index changes`);
      checkZIndexTrigger.logged = true;
    }
    return null;
  }

  // Quick distance check
  const dist = Math.sqrt(Math.pow(player.x - object.x, 2) + Math.pow(player.y - object.y, 2));
  if (dist > 200) return null;

  // DEBUG: Log when checking z-index for desert_obj_7
  if (object.path === '/assets/Object/desert/desert_obj_7.png' && dist < 100) {
    console.log(`🔍 Z-Index check: Player at (${player.x.toFixed(0)}, ${player.y.toFixed(0)}) vs Object at (${object.x.toFixed(0)}, ${object.y.toFixed(0)}), dist: ${dist.toFixed(1)}`);
    console.log(`   - Player trigger_zone points: ${PLAYER_COLLIDER.trigger_zone.length}`);
    console.log(`   - Object z_index_up points: ${objZIndexUpPoints.length}`);
  }

  // Convert to world coordinates
  const playerTriggerPoints = toWorldCoordinates(PLAYER_COLLIDER.trigger_zone, {
    x: player.x,
    y: player.y,
    scale: player.scale || PLAYER_COLLIDER.scale,
    anchor: PLAYER_COLLIDER.anchor,
    width: PLAYER_COLLIDER.width,
    height: PLAYER_COLLIDER.height
  });

  const objZIndexPoints = toWorldCoordinates(objZIndexUpPoints, object);

  // DEBUG: Check collision with tolerance
  if (object.path === '/assets/Object/desert/desert_obj_7.png' && dist < 100) {
    const result = checkPointsCollisionWithTolerance(playerTriggerPoints, objZIndexPoints, 20);
    console.log(`   - Closest distance between trigger_zone and z_index_up: ${result.minDist.toFixed(1)} pixels`);
    if (!result.collision) {
      console.log(`   - ❌ No collision (need < 1 pixel overlap)`);
    }
  }

  // Check if player trigger_zone touches object z_index_up
  if (checkPointsCollision(playerTriggerPoints, objZIndexPoints)) {
    console.log(`🎨 Z-Index Trigger: Player above ${object.path}`);
    return 'up'; // Player should be rendered above object
  }

  return null;
}

/**
 * Check if player can move to new position
 * @param {Object} player - { x, y, scale }
 * @param {number} newX - new X position
 * @param {number} newY - new Y position
 * @param {Array} collidableObjects - array of objects with collision data
 * @returns {Object} - { canMove: boolean, validX: number, validY: number, zIndexTriggers: Array }
 */
export function checkMovement(player, newX, newY, collidableObjects) {
  const testPlayer = { ...player, x: newX, y: newY };
  const zIndexTriggers = []; // Objects that player should be above

  // Check collision with all objects
  for (let obj of collidableObjects) {
    // Check z-index trigger first
    const zTrigger = checkZIndexTrigger(testPlayer, obj);
    if (zTrigger === 'up') {
      zIndexTriggers.push(obj.id || obj.path); // Track which objects player is above
    }

    // Check blocking collision
    if (checkCollision(testPlayer, obj)) {
      // Collision detected - try to slide along obstacles
      
      // Try X-only movement
      const testX = { ...player, x: newX, y: player.y };
      let canMoveX = true;
      for (let obj2 of collidableObjects) {
        if (checkCollision(testX, obj2)) {
          canMoveX = false;
          break;
        }
      }

      // Try Y-only movement
      const testY = { ...player, x: player.x, y: newY };
      let canMoveY = true;
      for (let obj2 of collidableObjects) {
        if (checkCollision(testY, obj2)) {
          canMoveY = false;
          break;
        }
      }

      // Return valid position (slide along obstacle)
      return {
        canMove: false,
        validX: canMoveX ? newX : player.x,
        validY: canMoveY ? newY : player.y,
        zIndexTriggers
      };
    }
  }

  // No collision - can move freely
  return {
    canMove: true,
    validX: newX,
    validY: newY,
    zIndexTriggers
  };
}

/**
 * Get collidable objects in a chunk
 * @param {Object} chunkData - chunk data with objects array
 * @returns {Array} - array of collidable objects with world positions
 */
export function getCollidableObjectsFromChunk(chunkData) {
  if (!chunkData || !chunkData.objects) return [];

  const collidableObjects = [];
  const tileSize = chunkData.tileSize || 30;
  const chunkWorldX = chunkData.chunkX * chunkData.width * tileSize;
  const chunkWorldY = chunkData.chunkY * chunkData.height * tileSize;

  for (let obj of chunkData.objects) {
    // Check if object has collision data
    const objCollisionData = collisionData[obj.path];
    if (!objCollisionData) continue;

    // Parse collision data
    let objPoints = [];
    if (Array.isArray(objCollisionData)) {
      objPoints = objCollisionData;
    } else if (objCollisionData.normal) {
      objPoints = objCollisionData.normal;
    }

    if (objPoints.length === 0) continue;

    // Calculate world position for this specific object instance
    const worldX = chunkWorldX + obj.x * tileSize + tileSize / 2;
    const worldY = chunkWorldY + obj.y * tileSize + tileSize / 2;

    collidableObjects.push({
      id: `${chunkData.chunkX}_${chunkData.chunkY}_${obj.x}_${obj.y}`, // Unique ID per instance
      x: worldX,
      y: worldY,
      path: obj.path,
      scale: obj.scale || 1,
      anchor: { x: 0.5, y: 0.5 },
      width: 48,
      height: 48,
      chunkX: chunkData.chunkX,
      chunkY: chunkData.chunkY,
      gridX: obj.x,
      gridY: obj.y
    });
  }

  return collidableObjects;
}

/**
 * Reload collision data from file (for hot-reload)
 */
export function reloadCollisionData() {
  try {
    const collisionPath = path.join(__dirname, '../public/assets/Object/collision_data.json');
    if (fs.existsSync(collisionPath)) {
      const data = fs.readFileSync(collisionPath, 'utf8');
      collisionData = JSON.parse(data);
      console.log(`✅ Reloaded collision data: ${Object.keys(collisionData).length} objects`);
      return true;
    }
  } catch (err) {
    console.error('❌ Failed to reload collision data:', err.message);
    return false;
  }
}
