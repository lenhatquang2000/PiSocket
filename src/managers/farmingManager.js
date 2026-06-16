import { AnimatedSprite } from 'pixi.js';
import { SOCKET_URL, TILE_SIZE, CROP_GROWTH_STAGES } from '../config/constants.js';

export class FarmingManager {
    constructor(world, riceGrowthFrames) {
        this.world = world;
        this.riceGrowthFrames = riceGrowthFrames;
        this.farmedTiles = [];
        this.plantedCrops = [];
        this.cropTypes = [];
        this.selectedCropType = null;
    }

    // --- FARMED TILES ---
    createFarmedTile(x, y, farmedTexture, saveToServer = true) {
        const gridX = Math.round(x / TILE_SIZE) * TILE_SIZE;
        const gridY = Math.round(y / TILE_SIZE) * TILE_SIZE;

        const existingTile = this.farmedTiles.find(tile => 
            Math.abs(tile.x - gridX) < TILE_SIZE / 2 && 
            Math.abs(tile.y - gridY) < TILE_SIZE / 2
        );

        if (existingTile) {
            console.log("⚠️ Vị trí này đã được đào rồi!");
            return;
        }

        const farmedSprite = new AnimatedSprite([farmedTexture]);
        farmedSprite.x = gridX;
        farmedSprite.y = gridY;
        farmedSprite.anchor.set(0.5, 0.5);
        
        const textureSize = farmedTexture.width;
        const scale = TILE_SIZE / textureSize;
        farmedSprite.scale.set(scale);
        farmedSprite.isFixedGround = true;
        farmedSprite.zIndex = -1000000;

        this.world.addChild(farmedSprite);
        this.farmedTiles.push(farmedSprite);

        if (saveToServer) {
            fetch(`${SOCKET_URL}/save-farmed-tile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: gridX, y: gridY })
            }).catch(err => console.error("❌ Lỗi lưu farmed tile:", err));
        }

        console.log(`✅ Đã tạo ô đất đã đào tại (${gridX}, ${gridY})`);
    }

    async loadFarmedTiles(farmedTexture) {
        try {
            const response = await fetch(`${SOCKET_URL}/get-farmed-tiles`);
            const data = await response.json();
            const tiles = data.tiles || [];
            
            console.log(`📦 Loading ${tiles.length} farmed tiles from server...`);
            
            tiles.forEach(tile => {
                this.createFarmedTile(tile.x, tile.y, farmedTexture, false);
            });
            
            console.log(`✅ Loaded ${tiles.length} farmed tiles`);
        } catch (err) {
            console.error("❌ Lỗi load farmed tiles:", err);
        }
    }

    // --- CROP MANAGEMENT ---
    createPlantedCrop(x, y, cropData, saveToServer = true, plantedAt = null) {
        const gridX = Math.round(x / TILE_SIZE) * TILE_SIZE;
        const gridY = Math.round(y / TILE_SIZE) * TILE_SIZE;

        const existingCrop = this.plantedCrops.find(crop => 
            Math.abs(crop.x - gridX) < TILE_SIZE / 2 && 
            Math.abs(crop.y - gridY) < TILE_SIZE / 2
        );

        if (existingCrop) {
            console.log("⚠️ Vị trí này đã có cây trồng rồi!");
            return false;
        }

        const cropSprite = new AnimatedSprite(this.riceGrowthFrames.stage1);
        cropSprite.x = gridX;
        cropSprite.y = gridY;
        cropSprite.anchor.set(0.5, 1);
        cropSprite.scale.set(0.5);
        cropSprite.zIndex = Math.floor(gridY * 10); // Depth sorting theo Y
        cropSprite.animationSpeed = 0.05;
        cropSprite.loop = true;
        cropSprite.play();

        this.world.addChild(cropSprite);
        
        const cropObject = {
            sprite: cropSprite,
            x: gridX,
            y: gridY,
            cropData: cropData,
            plantedAt: plantedAt || Date.now(),
            currentStage: 1,
            maxStage: CROP_GROWTH_STAGES.TOTAL_STAGES
        };
        
        this.plantedCrops.push(cropObject);

        if (saveToServer) {
            fetch(`${SOCKET_URL}/plant-crop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x: gridX, y: gridY, cropTypeId: cropData.id })
            }).catch(err => console.error("❌ Lỗi lưu planted crop:", err));
        }

        console.log(`✅ Đã trồng ${cropData.display_name} tại (${gridX}, ${gridY}) - Stage 1`);
        return true;
    }

    async loadCropTypes() {
        try {
            const response = await fetch(`${SOCKET_URL}/get-crop-types`);
            const data = await response.json();
            this.cropTypes = data.cropTypes || [];
            
            console.log(`📦 Loaded ${this.cropTypes.length} crop types`);
            
            if (this.cropTypes.length > 0) {
                this.selectedCropType = this.cropTypes[0];
            }
            
            return this.cropTypes;
        } catch (err) {
            console.error("❌ Lỗi load crop types:", err);
            return [];
        }
    }

    async loadPlantedCrops() {
        try {
            const response = await fetch(`${SOCKET_URL}/get-planted-crops`);
            const data = await response.json();
            const crops = data.crops || [];
            
            console.log(`📦 Loading ${crops.length} planted crops from server...`);
            
            crops.forEach(crop => {
                const cropData = {
                    id: crop.crop_type_id,
                    name: crop.crop_name,
                    display_name: crop.display_name,
                    sprite_path: crop.sprite_path
                };
                const plantedAt = new Date(crop.planted_at).getTime();
                this.createPlantedCrop(crop.x, crop.y, cropData, false, plantedAt);
            });
            
            console.log(`✅ Loaded ${crops.length} planted crops`);
        } catch (err) {
            console.error("❌ Lỗi load planted crops:", err);
        }
    }

    // --- CROP GROWTH UPDATE ---
    updateCropGrowth() {
        const now = Date.now();
        
        this.plantedCrops.forEach(crop => {
            const elapsedSeconds = (now - crop.plantedAt) / 1000;
            
            // Tính stage dựa trên thời gian đã trồng
            let newStage = 1;
            if (elapsedSeconds >= CROP_GROWTH_STAGES.STAGE_1_DURATION * 3) {
                newStage = 4; // Stage 4: Chín vàng
            } else if (elapsedSeconds >= CROP_GROWTH_STAGES.STAGE_1_DURATION * 2) {
                newStage = 3; // Stage 3: Cây cao có hoa
            } else if (elapsedSeconds >= CROP_GROWTH_STAGES.STAGE_1_DURATION) {
                newStage = 2; // Stage 2: Cây non
            }
            
            // Nếu stage thay đổi, cập nhật animation
            if (newStage !== crop.currentStage && newStage <= crop.maxStage) {
                crop.currentStage = newStage;
                
                // Chuyển sang animation của stage mới
                const stageKey = `stage${newStage}`;
                crop.sprite.textures = this.riceGrowthFrames[stageKey];
                crop.sprite.gotoAndPlay(0);
                
                console.log(`🌱 Cây tại (${crop.x}, ${crop.y}) phát triển lên Stage ${newStage}`);
            }
        });
    }

    // --- HELPERS ---
    isFarmedTile(x, y) {
        const gridX = Math.round(x / TILE_SIZE) * TILE_SIZE;
        const gridY = Math.round(y / TILE_SIZE) * TILE_SIZE;
        
        return this.farmedTiles.find(tile => 
            Math.abs(tile.x - gridX) < TILE_SIZE / 2 && 
            Math.abs(tile.y - gridY) < TILE_SIZE / 2
        );
    }

    hasPlantedCrop(x, y) {
        const gridX = Math.round(x / TILE_SIZE) * TILE_SIZE;
        const gridY = Math.round(y / TILE_SIZE) * TILE_SIZE;
        
        return this.plantedCrops.find(crop => 
            Math.abs(crop.x - gridX) < TILE_SIZE / 2 && 
            Math.abs(crop.y - gridY) < TILE_SIZE / 2
        );
    }

    selectCropType(cropType) {
        this.selectedCropType = cropType;
        console.log(`✅ Đã chọn: ${cropType.display_name}`);
    }

    getSelectedCropType() {
        return this.selectedCropType;
    }

    getCropTypes() {
        return this.cropTypes;
    }
}
