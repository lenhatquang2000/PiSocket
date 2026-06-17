import { Assets } from 'pixi.js';
import { getCharacterAssetUrls } from '../characterController.js';
import { RICE_FRAME_FILES } from '../config/constants.js';

/**
 * Fetches worldmap/submaps, lists all required assets, and preloads them while updating the UI loading bar.
 * @returns {Promise<{worldmapData: any, submapsData: any[], mapConfig: any}>}
 */
export async function preloadGameAssets({
    SOCKET_URL,
    loadingBar,
    loadingText
}) {
    let worldmapData = null;
    let submapsData = [];
    
    try {
        // Load worldmap từ server
        const worldmapResponse = await fetch(`${SOCKET_URL}/get-latest-worldmap`);
        const worldmapResult = await worldmapResponse.json();
        worldmapData = worldmapResult.worldmap;
        
        // Load tất cả submaps
        const submapsResponse = await fetch(`${SOCKET_URL}/get-submaps`);
        const submapsResult = await submapsResponse.json();
        submapsData = submapsResult.submaps || [];
    } catch (err) {
        console.error('❌ Lỗi load worldmap, fallback to map_config.json:', err);
        worldmapData = null;
    }
    
    const mapConfig = worldmapData ? null : await Assets.load('/assets/Map/map_config.json');

    // Danh sách các file cần tải
    const assetsToLoad = [];
    assetsToLoad.push(...getCharacterAssetUrls());
    
    // Tải texture từ worldmap hoặc fallback to old config
    if (worldmapData && submapsData.length > 0) {
        // Load textures từ submaps
        submapsData.forEach(submap => {
            if (submap.objects) {
                submap.objects.forEach(obj => {
                    if (!assetsToLoad.includes(obj.path)) {
                        assetsToLoad.push(obj.path);
                    }
                });
            }
        });
    } else if (mapConfig && mapConfig.zones) {
        // Fallback: Tải texture của tất cả các vùng map từ config cũ
        mapConfig.zones.forEach(zone => {
            assetsToLoad.push(zone.texture);
        });
    }
    
    // Thêm các object sa mạc
    for (let i = 0; i < 12; i++) {
        assetsToLoad.push(`/assets/Object/desert/desert_obj_${i}.png`);
    }

    // Thêm các object rừng (Forest)
    for (let i = 0; i < 16; i++) {
        assetsToLoad.push(`/assets/Object/Forest/forest_obj_${i}.png`);
    }

    // Thêm texture đất đã đào (Farming) - CHỈ 1 TEXTURE
    assetsToLoad.push('/assets/Farming1/2D_game_asset_cultivated_farm (14).png');

    // Thêm texture player frame để dùng cho collider
    assetsToLoad.push('/MC/Girls/Mira/animations/Breathing/south/frame_000.png');

    // Thêm các frame cho skill bộc phá (16 frames)
    for (let i = 0; i < 16; i++) {
        const frameName = i < 10 ? `00${i}` : `0${i}`;
        assetsToLoad.push(`/assets/Skills/Explosion/frame_${frameName}.png`);
    }

    // Thêm các frame cho skill Fireball projectile (8 hướng * 6 frames)
    const directions8 = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
    directions8.forEach(dir => {
        for (let i = 0; i < 6; i++) {
            assetsToLoad.push(`/skill_animation/Fireball/${dir}/frame_00${i}.png`);
        }
    });

    // Thêm các frame cho skill Seeding (8 hướng * 9 frames)
    directions8.forEach(dir => {
        for (let i = 0; i <= 8; i++) {
            assetsToLoad.push(`/skill_animation/seeding/${dir}/frame_00${i}.png`);
        }
    });

    // Thêm các frame cho skill Digging (8 hướng * 9 frames)
    directions8.forEach(dir => {
        for (let i = 0; i <= 8; i++) {
            assetsToLoad.push(`/skill_animation/dig/${dir}/frame_00${i}.png`);
        }
    });

    // Thêm các frame cho cây lúa phát triển
    RICE_FRAME_FILES.forEach(file => assetsToLoad.push(`/assets/seed/${file}`));

    // Collision JSON
    assetsToLoad.push('/assets/Object/collision_data.json');

    let loadedCount = 0;
    const totalAssets = assetsToLoad.length;

    const loadWithProgress = async (url) => {
        const asset = await Assets.load(url);
        loadedCount++;
        const progress = Math.floor((loadedCount / totalAssets) * 100);
        if (loadingBar) loadingBar.style.width = `${progress}%`;
        if (loadingText) loadingText.innerText = `Đang tải tài nguyên... ${progress}%`;
        return asset;
    };

    // Thực hiện tải toàn bộ
    await Promise.all(assetsToLoad.map(url => loadWithProgress(url)));

    return {
        worldmapData,
        submapsData,
        mapConfig
    };
}
