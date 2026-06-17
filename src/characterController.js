import { Assets } from 'pixi.js';
import { ANIMATION_PATHS } from './config/constants.js';

export const DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

// Centralized animation definitions defining frames, speeds, loop behaviors, and path generators
export const CHARACTER_ANIMATIONS = {
    walk: {
        name: 'walk',
        baseDir: ANIMATION_PATHS.walk,
        frameCount: 6,
        animationSpeed: 0.15,
        loop: true,
        getFrames: (dir) => {
            const frames = [];
            for (let i = 0; i < 6; i++) {
                frames.push(`${CHARACTER_ANIMATIONS.walk.baseDir}${dir}/frame_00${i}.png`);
            }
            return frames;
        }
    },
    idle: {
        name: 'idle',
        baseDir: ANIMATION_PATHS.idle,
        frameCount: 4,
        animationSpeed: 0.05,
        loop: true,
        getFrames: (dir) => {
            const frames = [];
            for (let i = 0; i < 4; i++) {
                frames.push(`${CHARACTER_ANIMATIONS.idle.baseDir}${dir}/frame_00${i}.png`);
            }
            return frames;
        }
    },
    attack: {
        name: 'attack',
        baseDir: ANIMATION_PATHS.attack,
        frameCount: 6,
        animationSpeed: 0.2,
        loop: false,
        getFrames: (dir) => {
            const frames = [];
            for (let i = 0; i < 6; i++) {
                frames.push(`${CHARACTER_ANIMATIONS.attack.baseDir}${dir}/frame_00${i}.png`);
            }
            return frames;
        }
    },
    dig: {
        name: 'dig',
        baseDir: ANIMATION_PATHS.dig,
        frameCount: 9,
        animationSpeed: 0.15,
        loop: false,
        getFrames: (dir) => {
            const frames = [];
            for (let i = 0; i < 9; i++) {
                frames.push(`${CHARACTER_ANIMATIONS.dig.baseDir}${dir}/frame_00${i}.png`);
            }
            return frames;
        }
    },
    seeding: {
        name: 'seeding',
        baseDir: ANIMATION_PATHS.seeding,
        frameCount: 9,
        animationSpeed: 0.15,
        loop: false,
        getFrames: (dir) => {
            const frames = [];
            for (let i = 0; i < 9; i++) {
                frames.push(`${CHARACTER_ANIMATIONS.seeding.baseDir}${dir}/frame_00${i}.png`);
            }
            return frames;
        }
    },
    sleep: {
        name: 'sleep',
        baseDir: ANIMATION_PATHS.sleep,
        frameCount: 9,
        animationSpeed: 0.2,
        loop: false,
        getFrames: (dir) => {
            const frames = [];
            for (let i = 0; i < 9; i++) {
                frames.push(`${CHARACTER_ANIMATIONS.sleep.baseDir}${dir}/frame_00${i}.png`);
            }
            return frames;
        }
    },
    sleeping: {
        name: 'sleeping',
        baseDir: ANIMATION_PATHS.sleeping,
        animationSpeed: 0.1,
        loop: true,
        getFrames: (dir) => {
            const frames = [];
            // east, south, west have frames 003-015
            // north, north-east, north-west, south-east, south-west have frames 004-015
            const startFrame = (dir === 'east' || dir === 'south' || dir === 'west') ? 3 : 4;
            for (let i = startFrame; i <= 15; i++) {
                const frameNum = i < 10 ? `00${i}` : `0${i}`;
                frames.push(`${CHARACTER_ANIMATIONS.sleeping.baseDir}${dir}/frame_${frameNum}.png`);
            }
            return frames;
        }
    }
};

/**
 * Generates the full flat list of asset paths to load for all animations and all directions.
 * Used at game startup to build the preload list.
 */
export function getCharacterAssetUrls() {
    const urls = [];
    DIRECTIONS.forEach(dir => {
        Object.keys(CHARACTER_ANIMATIONS).forEach(key => {
            const anim = CHARACTER_ANIMATIONS[key];
            urls.push(...anim.getFrames(dir));
        });
    });
    return urls;
}

/**
 * Controller class to manage character animations on a PIXI.AnimatedSprite instance.
 */
export class CharacterController {
    /**
     * @param {import('pixi.js').AnimatedSprite} animatedSprite - The animated sprite to control
     */
    constructor(animatedSprite) {
        this.sprite = animatedSprite;
        this.currentState = 'idle';
        this.currentDir = 'south';
        this.animations = {}; // Loaded textures cache: { [state]: { [dir]: [Texture] } }
    }

    /**
     * Initialize and cache all textures from PIXI Assets.
     * Must be called after all character assets are preloaded.
     */
    initTextures() {
        Object.keys(CHARACTER_ANIMATIONS).forEach(actionKey => {
            const anim = CHARACTER_ANIMATIONS[actionKey];
            this.animations[actionKey] = {};
            
            DIRECTIONS.forEach(dir => {
                const paths = anim.getFrames(dir);
                const textures = [];
                
                paths.forEach(p => {
                    const texture = Assets.get(p);
                    if (texture) {
                        textures.push(texture);
                    } else {
                        console.warn(`⚠️ [CharacterController] Missing preloaded asset: ${p}`);
                    }
                });
                
                if (textures.length > 0) {
                    this.animations[actionKey][dir] = textures;
                }
            });
        });
        console.log('🎮 [CharacterController] Cached all character animations.');
    }

    /**
     * Get textures for a specific animation state and direction.
     * @param {string} state - walk, idle, attack, dig, seeding, sleep, sleeping
     * @param {string} dir - south, north, east, west, etc.
     * @returns {import('pixi.js').Texture[]}
     */
    getTextures(state, dir) {
        return this.animations[state]?.[dir] || [];
    }

    /**
     * Transition the sprite to a new animation state and direction.
     * @param {string} state - walk, idle, attack, dig, seeding, sleep, sleeping
     * @param {string} dir - south, north, east, west, etc.
     * @param {Function} [onComplete] - Callback when animation completes (only for non-looping animations)
     * @returns {boolean} True if successfully started playing, false otherwise
     */
    play(state, dir, onComplete = null) {
        const textures = this.getTextures(state, dir);
        if (textures.length === 0) {
            console.warn(`⚠️ [CharacterController] Animation textures not found for state: ${state}, dir: ${dir}`);
            return false;
        }

        const config = CHARACTER_ANIMATIONS[state];
        this.currentState = state;
        this.currentDir = dir;

        // Apply animations properties to PIXI AnimatedSprite
        this.sprite.textures = textures;
        this.sprite.animationSpeed = config.animationSpeed;
        this.sprite.loop = config.loop;
        
        if (onComplete) {
            this.sprite.onComplete = onComplete;
        } else {
            this.sprite.onComplete = null;
        }

        // Play the sprite
        if (config.loop) {
            this.sprite.play();
        } else {
            this.sprite.gotoAndPlay(0);
        }

        return true;
    }
}
