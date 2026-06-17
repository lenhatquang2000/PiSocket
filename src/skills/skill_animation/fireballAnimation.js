import { AnimatedSprite } from 'pixi.js';

/**
 * Plays the fireball explosion skill VFX at target world position, handling sprite creation and optional camera shake.
 */
export function playExplosionSkill({
    targetX,
    targetY,
    world,
    explosionFrames,
    shakeOffset
}) {
    const explosion = new AnimatedSprite(explosionFrames);
    explosion.anchor.set(0.5, 0.5);
    explosion.animationSpeed = 0.3;
    explosion.loop = false;
    explosion.scale.set(2.0); // Scale up skill size
    
    explosion.x = targetX;
    explosion.y = targetY;
    
    // Render on top
    explosion.zIndex = 10000;
    
    explosion.onComplete = () => {
        world.removeChild(explosion);
        explosion.destroy();
    };

    // Camera shake effect on explosion frames (frame 4-8)
    if (shakeOffset) {
        explosion.onFrameChange = (currentFrame) => {
            if (currentFrame >= 4 && currentFrame <= 8) {
                const intensity = 8;
                shakeOffset.x = (Math.random() - 0.5) * intensity;
                shakeOffset.y = (Math.random() - 0.5) * intensity;
            } else {
                shakeOffset.x = 0;
                shakeOffset.y = 0;
            }
        };
    }

    world.addChild(explosion);
    explosion.play();
}
