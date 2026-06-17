import { accountExists, createAccount, getPlayerState, savePlayerState, initializePlayerSkills, getPlayerSkills, updateSkillLastUsed, getSkillCooldownRemaining, saveFarmedTile, getAllFarmedTiles, deleteFarmedTile, clearAllFarmedTiles, getAllCropTypes, plantCrop, getAllPlantedCrops, harvestCrop, deletePlantedCrop, saveObjectColliderData, getObjectColliderData, getAllObjectColliderData, verifyAccessCode, updateAccountAuthLevel, getAccountAuthLevel, createAccessCode, getAllAccessCodes, deactivateAccessCode, getAllNPCs, createNPC, updateNPCPosition, registerUser, loginUser, getPlayersByUserId, createPlayer, deletePlayer } from './database.js';

// Check if account exists
export function checkAccount(username) {
  return accountExists(username);
}

// Create new account
export function createNewAccount(username) {
  const created = createAccount(username);
  if (created) {
    // Khởi tạo skills mặc định cho player mới
    initializePlayerSkills(username);
  }
  return created;
}

export function getSavedPlayerState(username) {
  const state = getPlayerState(username);
  // Luôn khởi tạo skills khi load player state
  if (state) {
    initializePlayerSkills(username);
  }
  return state;
}

export function saveCurrentPlayerState(playerData) {
  if (!playerData?.name) return false;
  const hp = playerData.stats?.hp ?? 100;
  const mp = playerData.stats?.mp ?? 50;
  return savePlayerState(playerData.name, playerData.x, playerData.y, playerData.dir, hp, mp);
}

export function getPlayerSkillsList(username) {
  return getPlayerSkills(username);
}

export function recordSkillUsage(username, skillId) {
  return updateSkillLastUsed(username, skillId);
}

export function getSkillCooldown(username, skillId) {
  return getSkillCooldownRemaining(username, skillId);
}

// Farmed tiles management
export function saveFarmedTileData(x, y) {
  return saveFarmedTile(x, y);
}

export function getFarmedTiles() {
  return getAllFarmedTiles();
}

export function removeFarmedTile(x, y) {
  return deleteFarmedTile(x, y);
}

export function clearFarmedTiles() {
  return clearAllFarmedTiles();
}

// Validate username
export function validateUsername(username) {
  if (!username || username.trim().length === 0) {
    return { valid: false, message: "Username không được để trống" };
  }
  if (username.length < 3) {
    return { valid: false, message: "Username phải có ít nhất 3 ký tự" };
  }
  if (username.length > 20) {
    return { valid: false, message: "Username không được quá 20 ký tự" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, message: "Username chỉ được chứa chữ cái, số và dấu gạch dưới" };
  }
  return { valid: true, message: "" };
}

// Crop management
export function getCropTypes() {
  return getAllCropTypes();
}

export function plantCropData(x, y, cropTypeId) {
  return plantCrop(x, y, cropTypeId);
}

export function getPlantedCrops() {
  return getAllPlantedCrops();
}

export function harvestCropData(x, y) {
  return harvestCrop(x, y);
}

export function removePlantedCrop(x, y) {
  return deletePlantedCrop(x, y);
}

// Object collider data management
export function saveObjectColliderDataByType(objectTypeId, colliderData) {
  return saveObjectColliderData(objectTypeId, colliderData);
}

export function getObjectColliderDataByType(objectTypeId) {
  return getObjectColliderData(objectTypeId);
}

export function getAllObjectColliderDataByType() {
  return getAllObjectColliderData();
}

// --- PNeural Authentication Functions ---
export function verifyAccessCodeLogin(code) {
  return verifyAccessCode(code);
}

export function setAccountAuthLevel(username, authLevel) {
  return updateAccountAuthLevel(username, authLevel);
}

export function getUserAuthLevel(username) {
  return getAccountAuthLevel(username);
}

export function generateAccessCode(code, username, authLevel) {
  return createAccessCode(code, username, authLevel);
}

export function listAccessCodes() {
  return getAllAccessCodes();
}

export function revokeAccessCode(code) {
  return deactivateAccessCode(code);
}

// --- NPC Management Functions ---
export function getNPCs() {
  return getAllNPCs();
}

export function addNPC(name, x, y, dir, spritePath) {
  return createNPC(name, x, y, dir, spritePath);
}

export function moveNPC(name, x, y, dir) {
  return updateNPCPosition(name, x, y, dir);
}

// --- User Authentication & Character Selection ---
export function registerNewUser(username, password) {
  return registerUser(username, password);
}

export function loginExistingUser(username, password) {
  return loginUser(username, password);
}

export function getPlayersForUser(userId) {
  return getPlayersByUserId(userId);
}

export function createNewPlayer(userId, name, authLevel = 'user') {
  const result = createPlayer(userId, name, authLevel);
  if (result.success) {
    initializePlayerSkills(name);
  }
  return result;
}

export function deleteExistingPlayer(userId, playerId) {
  return deletePlayer(userId, playerId);
}

