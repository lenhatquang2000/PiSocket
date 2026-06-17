import { AnimatedSprite, Assets } from 'pixi.js';

/**
 * Plays the digging visual effect at a specific world position and direction.
 */
export function playDigAnimation({ x, y, dir, world }) {
    const frames = [];
    for (let i = 0; i <= 8; i++) {
        const framePath = `/skill_animation/dig/${dir}/frame_00${i}.png`;
        const texture = Assets.get(framePath);
        if (texture) {
            frames.push(texture);
        }
    }

    if (frames.length === 0) {
        console.warn(`⚠️ [DigAnimation] Missing frames for dir: ${dir}`);
        return;
    }

    const sprite = new AnimatedSprite(frames);
    sprite.anchor.set(0.5, 0.5);
    sprite.animationSpeed = 0.25;
    sprite.loop = false;
    sprite.x = x;
    sprite.y = y;
    
    // Sort slightly above ground/relative to depth
    sprite.zIndex = Math.floor(y * 10) + 1;

    sprite.onComplete = () => {
        if (sprite.parent) {
            sprite.parent.removeChild(sprite);
        }
        sprite.destroy();
    };

    world.addChild(sprite);
    sprite.play();
}
