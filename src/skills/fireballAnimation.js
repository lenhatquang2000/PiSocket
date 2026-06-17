import { AnimatedSprite, Assets } from 'pixi.js';

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

/**
 * Plays the fireball projectile moving from startX, startY to targetX, targetY,
 * then triggers playExplosionSkill.
 */
export function playFireballSkill({
    startX,
    startY,
    targetX,
    targetY,
    world,
    explosionFrames,
    shakeOffset
}) {
    // If start coordinates are not provided, or are the same as target, play explosion directly
    if (startX === undefined || startY === undefined || (startX === targetX && startY === targetY)) {
        playExplosionSkill({ targetX, targetY, world, explosionFrames, shakeOffset });
        return;
    }

    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 10) {
        playExplosionSkill({ targetX, targetY, world, explosionFrames, shakeOffset });
        return;
    }

    const angle = Math.atan2(dy, dx);
    let normalizedAngle = angle;
    if (normalizedAngle < 0) {
        normalizedAngle += Math.PI * 2;
    }

    const directions = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
    const octant = Math.round(normalizedAngle / (Math.PI / 4)) % 8;
    const dir = directions[octant];

    // Load projectile frames
    const projectileFrames = [];
    for (let i = 0; i < 6; i++) {
        const framePath = `/skill_animation/Fireball/${dir}/frame_00${i}.png`;
        const texture = Assets.get(framePath);
        if (texture) {
            projectileFrames.push(texture);
        }
    }

    if (projectileFrames.length === 0) {
        console.warn(`⚠️ [FireballAnimation] Missing projectile frames for dir: ${dir}, playing explosion directly.`);
        playExplosionSkill({ targetX, targetY, world, explosionFrames, shakeOffset });
        return;
    }

    const projectile = new AnimatedSprite(projectileFrames);
    projectile.anchor.set(0.5, 0.5);
    projectile.animationSpeed = 0.25;
    projectile.loop = true;
    projectile.scale.set(1.5);
    projectile.x = startX;
    projectile.y = startY;
    projectile.zIndex = 10001; // Render projectile on top of players

    world.addChild(projectile);
    projectile.play();

    // Constant speed of 12 pixels per frame at ~60fps
    const speed = 12;
    const vx = (dx / distance) * speed;
    const vy = (dy / distance) * speed;

    let currentX = startX;
    let currentY = startY;
    let lastTime = performance.now();
    let animFrameId = null;

    const update = (now) => {
        const dt = Math.min(2.0, (now - lastTime) / 16.666); // Cap dt to prevent massive jumps
        lastTime = now;

        currentX += vx * dt;
        currentY += vy * dt;

        // Check if we reached or overshot the target
        const currentDx = targetX - currentX;
        const currentDy = targetY - currentY;
        const dotProduct = currentDx * vx + currentDy * vy;

        if (dotProduct <= 0) {
            cancelAnimationFrame(animFrameId);
            if (projectile.parent) {
                projectile.parent.removeChild(projectile);
            }
            projectile.destroy();
            playExplosionSkill({ targetX, targetY, world, explosionFrames, shakeOffset });
        } else {
            projectile.x = currentX;
            projectile.y = currentY;
            animFrameId = requestAnimationFrame(update);
        }
    };

    animFrameId = requestAnimationFrame(update);
}

