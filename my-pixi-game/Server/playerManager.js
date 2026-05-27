import { accountExists, createAccount, getPlayerState, savePlayerState, initializePlayerSkills, getPlayerSkills, updateSkillLastUsed, getSkillCooldownRemaining } from './database.js';

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
  return getPlayerState(username);
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

// Validate username
export function validateUsername(username) {
  if (!username || username.trim