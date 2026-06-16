// Object Categories Enum
// Định nghĩa các categories cho objects trong game để thiết lập rules

export const ObjectCategory = {
  // Ground tiles
  CT1: 'CT1', // Category 1 - Ground tiles (gr1, gr2)
  CT2: 'CT2', // Category 2 - Reserved for future use
  CT3: 'CT3', // Category 3 - Reserved for future use
  
  // Objects
  TREE: 'TREE',           // Cây cối
  ROCK: 'ROCK',           // Đá
  BUILDING: 'BUILDING',   // Công trình
  DECORATION: 'DECORATION', // Trang trí
  
  // Farming
  FARMLAND: 'FARMLAND',   // Đất đã đào
  CROP: 'CROP',           // Cây trồng
  
  // Special
  WATER: 'WATER',         // Nước
  OBSTACLE: 'OBSTACLE',   // Vật cản
};

// Object Category Mapping
// Map từ object path sang category
export const ObjectCategoryMap = {
  // Ground tiles - CT1
  '/assets/Map/topdown/gr1.png': [ObjectCategory.CT1],
  '/assets/Map/topdown/gr2.png': [ObjectCategory.CT1],
  
  // Farming
  '/assets/Farming1/2D_game_asset_cultivated_farm (14).png': [ObjectCategory.FARMLAND, ObjectCategory.CT1],
  
  // Forest objects - có thể có nhiều categories
  '/assets/Object/Forest/forest_obj_0.png': [ObjectCategory.TREE, ObjectCategory.OBSTACLE],
  '/assets/Object/Forest/forest_obj_1.png': [ObjectCategory.TREE, ObjectCategory.OBSTACLE],
  '/assets/Object/Forest/forest_obj_2.png': [ObjectCategory.TREE, ObjectCategory.OBSTACLE],
  '/assets/Object/Forest/forest_obj_5.png': [ObjectCategory.TREE, ObjectCategory.OBSTACLE],
  '/assets/Object/Forest/forest_obj_14.png': [ObjectCategory.TREE, ObjectCategory.OBSTACLE],
  
  // Desert objects
  '/assets/Object/desert/desert_obj_7.png': [ObjectCategory.ROCK, ObjectCategory.OBSTACLE],
  
  // Add more mappings as needed...
};

// Helper function: Get categories for an object path
export function getObjectCategories(path) {
  return ObjectCategoryMap[path] || [];
}

// Helper function: Check if object has category
export function hasCategory(path, category) {
  const categories = getObjectCategories(path);
  return categories.includes(category);
}

// Helper function: Get all objects by category
export function getObjectsByCategory(category) {
  return Object.keys(ObjectCategoryMap).filter(path => 
    ObjectCategoryMap[path].includes(category)
  );
}

// Rules Engine (for future use)
// Ví dụ: Chỉ cho phép trồng cây trên CT1
export const PlacementRules = {
  // Rule: Crops can only be planted on CT1 ground
  canPlantCrop: (groundPath) => {
    return hasCategory(groundPath, ObjectCategory.CT1);
  },
  
  // Rule: Buildings cannot be placed on water
  canPlaceBuilding: (groundPath) => {
    return !hasCategory(groundPath, ObjectCategory.WATER);
  },
  
  // Add more rules as needed...
};

console.log('📋 Object Categories loaded');
