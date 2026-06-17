/**
 * ============================================================
 * CHUNK AUTO-GENERATION CONFIG
 * ============================================================
 * Thêm/xóa loại object được phép auto-generate ở đây.
 *
 * Cấu trúc mỗi entry:
 *  name        – tên định danh (dùng trong log, debug)
 *  path        – đường dẫn ảnh (key để Assets.get())
 *  layer       – 'ground' | 'object'
 *  zIndex      – z-index khi render
 *  weight      – xác suất tương đối khi random (chỉ dùng cho ground tiles)
 *  minCount    – số lượng tối thiểu spawn mỗi chunk  (chỉ dùng cho object layer)
 *  maxCount    – số lượng tối đa spawn mỗi chunk     (chỉ dùng cho object layer)
 * ============================================================
 */

// ─── GROUND TILES ────────────────────────────────────────────
// Tổng weight sẽ được normalize tự động.
// Muốn thêm tile mới: thêm entry vào mảng bên dưới.
export const GROUND_TILES = [
  {
    name: 'grass-1',
    path: '/assets/Map/topdown/gr1.png',
    layer: 'ground',
    zIndex: 1,
    weight: 70,           // 70% xác suất xuất hiện
  },
  {
    name: 'grass-2',
    path: '/assets/Map/topdown/gr2.png',
    layer: 'ground',
    zIndex: 1,
    weight: 30,           // 30% xác suất xuất hiện
  },
  // Ví dụ thêm tile mới:
  // {
  //   name: 'grass-3',
  //   path: '/assets/Map/topdown/gr3.png',
  //   layer: 'ground',
  //   zIndex: 1,
  //   weight: 10,
  // },
];

// ─── SCATTER OBJECTS ─────────────────────────────────────────
// Mỗi entry là một loại object ngẫu nhiên rải trên chunk.
// minCount / maxCount là số lượng spawn PER CHUNK.
export const SCATTER_OBJECTS = [
//   {
//     name: 'desert-rock',
//     path: '/assets/Object/desert/desert_obj_7.png',
//     layer: 'object',
//     zIndex: 100,
//     minCount: 5,
//     maxCount: 10,
//   },
  // Ví dụ thêm object mới:
  {
    name: 'tree',
    path: '/assets/Object/Forest/forest_obj_11.png',
    layer: 'object',
    zIndex: 100,
    minCount: 1,
    maxCount: 3,
  },
];

// ─── HELPERS ────────────────────────────────────────────────

/**
 * Chọn ngẫu nhiên một ground tile theo weight.
 * @returns {{ name, path, layer, zIndex }}
 */
export function pickRandomGroundTile() {
  const totalWeight = GROUND_TILES.reduce((sum, t) => sum + t.weight, 0);
  let r = Math.random() * totalWeight;
  for (const tile of GROUND_TILES) {
    r -= tile.weight;
    if (r <= 0) return tile;
  }
  return GROUND_TILES[GROUND_TILES.length - 1];
}

/**
 * Trả về tất cả path hình ảnh cần preload (ground + object).
 * @returns {string[]}
 */
export function getAllAutoGeneratePaths() {
  const groundPaths = GROUND_TILES.map(t => t.path);
  const objectPaths = SCATTER_OBJECTS.map(o => o.path);
  return [...new Set([...groundPaths, ...objectPaths])];
}
