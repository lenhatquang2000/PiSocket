// Game constants and configuration
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

export const DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

export const ANIMATION_PATHS = {
    walk: '/MC/Girls/Mira/animations/Walking/',
    idle: '/MC/Girls/Mira/animations/Breathing/',
    attack: '/MC/Girls/Mira/animations/Fireball/',
    dig: '/MC/Girls/Mira/animations/dig/',
    seeding: '/MC/Girls/Mira/animations/seeding/',
    sleep: '/MC/Girls/Mira/animations/sleep/',
    sleeping: '/MC/Girls/Mira/animations/Sleeping/'
};

export const RICE_FRAME_FILES = [
    '1._Tiny_green_rice_seedling_sprout_emerg.png',
    '2._Tiny_green_rice_seedling_tilted_sligh.png',
    '3._Tiny_green_rice_seedling_standing_upr.png',
    '4._Tiny_green_rice_seedling_tilted_sligh.png',
    '5._Young_green_rice_plant_medium_height.png',
    '6._Young_green_rice_plant_leaning_slight.png',
    '7._Young_green_rice_plant_standing_uprig.png',
    '8._Young_green_rice_plant_leaning_slight.png',
    '9._Tall_green_rice_plant_with_flowering.png',
    '10._Tall_green_rice_plant_with_flowers_s.png',
    '11._Tall_green_rice_plant_with_flowers_s.png',
    '12._Tall_green_rice_plant_with_flowers_s.png',
    '13._Mature_golden_yellow_rice_plant_read.png',
    '14._Mature_golden_yellow_rice_plant_with.png',
    '15._Mature_golden_yellow_rice_plant_with.png',
    '16._Mature_golden_yellow_rice_plant_with.png'
];

// Crop growth stages (in seconds for testing, change to 300 for 5 minutes)
export const CROP_GROWTH_STAGES = {
    STAGE_1_DURATION: 10, // 10 seconds for testing (change to 300 for 5 min)
    STAGE_2_DURATION: 10, // 10 seconds for testing (change to 300 for 5 min)
    STAGE_3_DURATION: 10, // 10 seconds for testing (change to 300 for 5 min)
    STAGE_4_DURATION: 10, // 10 seconds for testing (change to 300 for 5 min)
    TOTAL_STAGES: 4
};

export const TILE_SIZE = 32;

export const DEFAULT_PLAYER_STATS = {
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    moveSpeed: 4
};
