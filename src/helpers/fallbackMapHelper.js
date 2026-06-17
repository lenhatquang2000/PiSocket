import { AnimatedSprite, TilingSprite, Graphics, Assets } from 'pixi.js';

/**
 * Renders the legacy zone-based fallback map (tiling ground, randomly scattered trees/rocks).
 */
export function renderFallbackMapZones({
    mapConfig,
    world,
    objectSprites,
    collidableObjects,
    debugGraphics,
    collisionData
}) {
    if (!mapConfig || !mapConfig.zones) return;
    
    console.log('🗺️ [FALLBACK MAP] Rendering old map system (zones)...');
    mapConfig.zones.forEach(zone => {
        const texture = Assets.get(zone.texture);
        if (!texture) return;
        
        const zoneSprite = new TilingSprite({
            texture,
            width: zone.width,
            height: zone.height,
        });
        zoneSprite.x = zone.x;
        zoneSprite.y = zone.y;
        zoneSprite.zIndex = 0;
        world.addChild(zoneSprite);

        // Rải vật thể đặc trưng vùng
        const isSand = zone.name === "SandLand";
        const count = isSand ? 40 : 60;
        const prefix = isSand ? "desert" : "Forest";
        const objKeyPrefix = isSand ? "desert_obj" : "forest_obj";
        const maxIdx = isSand ? 12 : 16;

        for (let i = 0; i < count; i++) {
            const objIndex = Math.floor(Math.random() * maxIdx);
            if (isSand && [2, 8, 10].includes(objIndex)) continue;

            const path = `/assets/Object/${prefix}/${objKeyPrefix}_${objIndex}.png`;
            const objTexture = Assets.get(path);
            if (objTexture) {
                const sprite = new AnimatedSprite([objTexture]);
                sprite.x = zone.x + Math.random() * zone.width;
                sprite.y = zone.y + Math.random() * zone.height;
                
                let scale = 2.0;
                if (!isSand && [0, 1, 2, 5, 14].includes(objIndex)) scale = 5.0;
                else if (!isSand && objIndex === 10) scale = 1.5;
                else if (isSand && objIndex === 7) scale = 1.5;

                sprite.scale.set(scale);
                sprite.anchor.set(0.5, 0.5);
                if (scale === 5.0) sprite.anchor.set(0.5, 1);

                world.addChild(sprite);
                objectSprites.push(sprite);

                const hitData = collisionData[path];
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
                        sprite: sprite
                    });

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
    });
}

/**
 * Renders the legacy fixed objects fallback map.
 */
export function renderFallbackMapObjects({
    mapConfig,
    world,
    objectSprites,
    collidableObjects,
    debugGraphics,
    collisionData
}) {
    if (!mapConfig || !mapConfig.objects) return;
    
    console.log('🗺️ [FALLBACK MAP] Rendering old map system (objects)...');
    mapConfig.objects.forEach(obj => {
        const path = `/assets/Object/desert/desert_obj_${obj.id}.png`;
        const objTexture = Assets.get(path);
        if (objTexture) {
            const sprite = new AnimatedSprite([objTexture]);
            sprite.x = obj.x;
            sprite.y = obj.y;
            sprite.scale.set(obj.scale || 2.0);
            sprite.anchor.set(0.5, 0.5);
            world.addChild(sprite);
            objectSprites.push(sprite);

            // LƯU DỮ LIỆU VA CHẠM CHI TIẾT
            const hitData = collisionData[path];
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
                    scale: sprite.scale.x,
                    anchor: sprite.anchor,
                    points: hitPoints,
                    zIndexUpPoints: zIndexUpPoints,
                    zIndexDownPoints: zIndexDownPoints,
                    triggerZonePoints: triggerZonePoints,
                    width: objTexture.width,
                    height: objTexture.height,
                    sprite: sprite,
                    path: path
                });

                // Vẽ Debug nếu cần
                const g = new Graphics();
                g.beginFill(0xff0000, 0.5);
                hitPoints.forEach(p => {
                    const px = (p.x - objTexture.width * sprite.anchor.x) * sprite.scale.x;
                    const py = (p.y - objTexture.height * sprite.anchor.y) * sprite.scale.x;
                    g.drawRect(sprite.x + px, sprite.y + py, sprite.scale.x, sprite.scale.x);
                });
                if (zIndexUpPoints.length > 0) {
                    g.beginFill(0x00ff00, 0.5);
                    zIndexUpPoints.forEach(p => {
                        const px = (p.x - objTexture.width * sprite.anchor.x) * sprite.scale.x;
                        const py = (p.y - objTexture.height * sprite.anchor.y) * sprite.scale.x;
                        g.drawRect(sprite.x + px, sprite.y + py, sprite.scale.x, sprite.scale.x);
                    });
                }
                if (zIndexDownPoints.length > 0) {
                    g.beginFill(0xffff00, 0.5);
                    zIndexDownPoints.forEach(p => {
                        const px = (p.x - objTexture.width * sprite.anchor.x) * sprite.scale.x;
                        const py = (p.y - objTexture.height * sprite.anchor.y) * sprite.scale.x;
                        g.drawRect(sprite.x + px, sprite.y + py, sprite.scale.x, sprite.scale.x);
                    });
                }
                g.visible = false;
                debugGraphics.addChild(g);
                sprite.debugBounds = g;
            }
        }
    });
}
