import { CampaignStage, DifficultyMode, PowerKind, StageDifficultyTier, WorldInfo } from './bubble-types';

export const TOTAL_WORLDS = 4321;
export const MAX_UNLIMITED_LEVELS = 987654321;
export const ASTRAL_PORTAL_IMAGE_URL =
  '/src/assets/images/astral_world_portal_8k_1793015579223.jpg';

interface WorldThemeArchetype {
  baseName: string;
  icon: string;
  hazardName: string;
  signaturePower: PowerKind;
  imageUrl: string;
  bgTopHex: string;
  bgBottomHex: string;
  accentHex: string;
  skyNum: number;
}

const WORLD_ARCHETYPES: WorldThemeArchetype[] = [
  {
    baseName: 'Starlight Valley',
    icon: 'auto_awesome',
    hazardName: 'Starlight Twin Ribbons',
    signaturePower: 'bomb',
    imageUrl: '/src/assets/images/world_starlight_valley_1792977764402.jpg',
    bgTopHex: '#0d1b3e',
    bgBottomHex: '#060a17',
    accentHex: '#fbbf24',
    skyNum: 0x0b1329,
  },
  {
    baseName: 'Frostspire Kingdom',
    icon: 'ac_unit',
    hazardName: 'Glacier Frost Shells',
    signaturePower: 'rainbow',
    imageUrl: '/src/assets/images/world_frostspire_peaks_1792977765250.jpg',
    bgTopHex: '#082f49',
    bgBottomHex: '#041322',
    accentHex: '#38bdf8',
    skyNum: 0x071d30,
  },
  {
    baseName: 'Sunforge Citadel',
    icon: 'wb_sunny',
    hazardName: 'Volcanic Stone Bridges',
    signaturePower: 'fireball',
    imageUrl: '/src/assets/images/world_sunforge_citadel_1792977767228.jpg',
    bgTopHex: '#431407',
    bgBottomHex: '#180904',
    accentHex: '#f59e0b',
    skyNum: 0x220f08,
  },
  {
    baseName: 'Emerald Sanctuary',
    icon: 'forest',
    hazardName: 'Enchanted Vine Arches',
    signaturePower: 'rainbow',
    imageUrl: '/src/assets/images/world_emerald_sanctuary_1792977768161.jpg',
    bgTopHex: '#064e3b',
    bgBottomHex: '#031914',
    accentHex: '#34d399',
    skyNum: 0x06211b,
  },
  {
    baseName: 'Coral Sky Lagoon',
    icon: 'water_drop',
    hazardName: 'Tidal Voltaic Reefs',
    signaturePower: 'lightning',
    imageUrl: '/src/assets/images/world_coral_lagoon_1792980601534.jpg',
    bgTopHex: '#0c3b5e',
    bgBottomHex: '#051526',
    accentHex: '#22d3ee',
    skyNum: 0x072238,
  },
  {
    baseName: 'Sakura Cloud Realm',
    icon: 'spa',
    hazardName: 'Blossom Bomb Clusters',
    signaturePower: 'bomb',
    imageUrl: '/src/assets/images/world_sakura_skyrealm_1792980602793.jpg',
    bgTopHex: '#4a1238',
    bgBottomHex: '#180614',
    accentHex: '#f472b6',
    skyNum: 0x240a1d,
  },
  {
    baseName: 'Astral Palace',
    icon: 'nights_stay',
    hazardName: 'Astral Prism Spirals',
    signaturePower: 'fireball',
    imageUrl: '/src/assets/images/world_astral_palace_1792977769073.jpg',
    bgTopHex: '#3b0764',
    bgBottomHex: '#130524',
    accentHex: '#e879f9',
    skyNum: 0x1a092e,
  },
];

const REALM_ADJECTIVES = [
  'Celestial', 'Moonveil', 'Crystal', 'Whispering', 'Golden', 'Sapphire', 'Crimson', 'Aurora',
  'Velvet', 'Silver', 'Obsidian', 'Solstice', 'Twilight', 'Radiant', 'Mystic', 'Glimmering',
  'Enchanted', 'Cloudborne', 'Starfall', 'Luminous', 'Prism', 'Opal', 'Rosewood', 'Cobalt',
  'Sunken', 'Floating', 'Arcane', 'Amber', 'Jade', 'Sovereign', 'Dreaming', 'Mirage',
  'Frostbound', 'Sunlit', 'Zephyr', 'Halcyon', 'Mythic', 'Crown', 'Aether', 'Harmonic',
  'Echoing', 'Runic', 'Sylvan', 'Nebula', 'Phantom', 'Coral', 'Diamond', 'Serene',
  'Blazing', 'Eclipsed', 'Ivory', 'Scarlet', 'Tempest', 'Boreal', 'Verdant', 'Ethereal',
  'Gilded', 'Infinite', 'Lucid', 'Starborn', 'Lunar', 'Solar', 'Dawn', 'Dusk', 'Royal',
];

const REALM_LANDMARKS = [
  'Valley', 'Sanctuary', 'Citadel', 'Spire', 'Gardens', 'Isles', 'Archipelago', 'Peaks',
  'Observatory', 'Temple', 'Highlands', 'Glade', 'Bastion', 'Falls', 'Canyon', 'Keep',
  'Haven', 'Grove', 'Palace', 'Bridge', 'Meadows', 'Labyrinth', 'Hollow', 'Dominion',
  'Cliffs', 'Shrine', 'Atoll', 'Caverns', 'Terraces', 'Pinnacle', 'Woods', 'Lagoon',
  'Tower', 'Vault', 'Oasis', 'Crown', 'Horizon', 'Gate', 'Court', 'Ridge',
  'Caldera', 'Fjord', 'Reach', 'Summit', 'Harbor', 'Grotto', 'Crossing', 'Hall',
  'Plateau', 'Steppe', 'Sanctum', 'Expanse', 'Conduit', 'Lanterns', 'Throne', 'Ascent',
  'Chasm', 'Promenade', 'Monolith', 'Cascades', 'Mirrors', 'Wilds', 'Frontier', 'Nexus', 'Realm',
];

const EXTRA_ICONS = [
  'auto_awesome', 'ac_unit', 'wb_sunny', 'forest', 'water_drop', 'spa', 'nights_stay',
  'diamond', 'flare', 'bolt', 'castle', 'landscape', 'explore',
];

function titleCase(str: string): string {
  return str
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Exact O(1) progressive level bounds per World:
 * World 1 has 20 levels (1..20).
 * World 2 has 24 levels (21..44).
 * World 3 has 28 levels (45..72).
 * World w has 20 + (w - 1) * 4 levels, and World 4,321 extends to Level 987,654,321!
 */
export function getWorldLevelBounds(worldNumber: number): {
  startLevel: number;
  endLevel: number;
  levelCount: number;
} {
  const w = Math.max(1, Math.min(TOTAL_WORLDS, Math.floor(worldNumber)));
  const startLevel = 1 + (w - 1) * (2 * w + 16);
  if (w === TOTAL_WORLDS) {
    const endLevel = MAX_UNLIMITED_LEVELS;
    return {
      startLevel,
      endLevel,
      levelCount: endLevel - startLevel + 1,
    };
  }
  const levelCount = 20 + (w - 1) * 4;
  return {
    startLevel,
    endLevel: startLevel + levelCount - 1,
    levelCount,
  };
}

export function getWorldNumberForLevel(globalLevel: number): number {
  const lvl = Math.max(1, Math.min(MAX_UNLIMITED_LEVELS, Math.floor(globalLevel)));
  let low = 1;
  let high = TOTAL_WORLDS;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const { startLevel } = getWorldLevelBounds(mid);
    if (lvl >= startLevel) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

export function getWorldInfo(worldNumber: number): WorldInfo {
  const w = Math.max(1, Math.min(TOTAL_WORLDS, Math.floor(worldNumber)));
  const bounds = getWorldLevelBounds(w);
  const archIdx = (w - 1) % WORLD_ARCHETYPES.length;
  const arch = WORLD_ARCHETYPES[archIdx];

  if (w <= WORLD_ARCHETYPES.length) {
    return {
      worldNumber: w,
      name: arch.baseName,
      icon: arch.icon,
      hazardName: arch.hazardName,
      signaturePower: arch.signaturePower,
      imageUrl: arch.imageUrl,
      imageHueRotateDeg: 0,
      bgTopHex: arch.bgTopHex,
      bgBottomHex: arch.bgBottomHex,
      accentHex: arch.accentHex,
      skyNum: arch.skyNum,
      ...bounds,
    };
  }

  if (w === TOTAL_WORLDS) {
    return {
      worldNumber: w,
      name: 'Eternal Infinity Crown',
      icon: 'all_inclusive',
      hazardName: 'Infinity Crown Gauntlet',
      signaturePower: 'fireball',
      imageUrl: WORLD_ARCHETYPES[6].imageUrl,
      imageHueRotateDeg: 45,
      bgTopHex: '#311042',
      bgBottomHex: '#090514',
      accentHex: '#fde047',
      skyNum: 0x180826,
      ...bounds,
    };
  }

  const adj = REALM_ADJECTIVES[(w * 7) % REALM_ADJECTIVES.length];
  const land =
    REALM_LANDMARKS[Math.floor((w - 8) / REALM_ADJECTIVES.length) % REALM_LANDMARKS.length];
  const hueShift = (Math.floor((w - 1) / WORLD_ARCHETYPES.length) * 32) % 360;
  const icon = EXTRA_ICONS[(w - 1) % EXTRA_ICONS.length];

  return {
    worldNumber: w,
    name: titleCase(`${adj} ${land}`),
    icon,
    hazardName: arch.hazardName,
    signaturePower: arch.signaturePower,
    imageUrl: arch.imageUrl,
    imageHueRotateDeg: hueShift,
    bgTopHex: arch.bgTopHex,
    bgBottomHex: arch.bgBottomHex,
    accentHex: arch.accentHex,
    skyNum: arch.skyNum,
    ...bounds,
  };
}

// Deterministic Mulberry32 PRNG so every level 1..987,654,321 is 100% consistent
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAGE_TITLES = [
  'Starlight Gate', 'Prism Bridge', 'Crystal Ribbon', 'Moonbeam Trail', 'Golden Cascade',
  'Sapphire Arch', 'Emerald Stream', 'Velvet Lantern', 'Sunbeam Spire', 'Crown Gauntlet',
  'Whispering Pillar', 'Twilight Curve', 'Opal Fountain', 'Diamond Twin', 'Aurora Path',
  'Mirage Terrace', 'Celestial Steps', 'Rosewood Glade', 'Harmonic Crest', 'Royal Finale',
];

const COLOR_CODES = ['R', 'S', 'E', 'T', 'A', 'C'];

function applyDifficultyModifier(
  stage: CampaignStage,
  difficultyMode: DifficultyMode,
): CampaignStage {
  if (difficultyMode === 'easy') {
    return {
      ...stage,
      shotsLimit: stage.shotsLimit + 12,
      missThreshold: Math.min(9, stage.missThreshold + 2),
      parShots: stage.parShots + 6,
    };
  }
  if (difficultyMode === 'hard') {
    return {
      ...stage,
      shotsLimit: Math.max(24, stage.shotsLimit - 5),
      missThreshold: Math.max(4, stage.missThreshold - 1),
      parShots: Math.max(12, stage.parShots - 3),
    };
  }
  return stage;
}

/**
 * Generates any Campaign Stage (1 .. 987,654,321) with:
 * - A long top-to-bottom connected bubble stream (15..22 rows tall) that scrolls smoothly!
 * - Generous color clusters & open bank-shot channels so winning regular levels is smooth & fun!
 * - Every 10th level (`lvl % 10 === 0`) is a dedicated Hard / Boss milestone!
 * - World-specific signature hazards!
 * - Guaranteed glowing Trapped Power bubbles (`P`) inside the upper bubble stream!
 */
const stageCache = new Map<string, CampaignStage>();

export function getStageForLevel(
  globalLevel: number,
  difficultyMode: DifficultyMode = 'normal',
): CampaignStage {
  const lvl = Math.max(1, Math.min(MAX_UNLIMITED_LEVELS, Math.floor(globalLevel)));
  const cacheKey = `${lvl}:${difficultyMode}`;
  const cached = stageCache.get(cacheKey);
  if (cached) return cached;
  if (stageCache.size > 256) {
    stageCache.clear();
  }

  const worldInfo = getWorldInfo(getWorldNumberForLevel(lvl));
  const levelInWorld = lvl - worldInfo.startLevel + 1;

  // Every 10th level is a Hard milestone!
  const isMilestoneHard = lvl % 10 === 0;
  const isWorldBoss = lvl === worldInfo.endLevel;

  let difficultyTier: StageDifficultyTier = 'Easy';
  if (isWorldBoss) {
    difficultyTier = 'Boss';
  } else if (isMilestoneHard) {
    difficultyTier = 'Hard';
  } else if (lvl % 10 >= 6) {
    difficultyTier = 'Medium';
  } else {
    difficultyTier = 'Easy';
  }

  // Winding S-curve road X coordinate (26% .. 74%)
  const roadCycle = [50, 28, 72, 30, 74, 28, 70, 32, 68, 50];
  const roadX = isWorldBoss || isMilestoneHard ? 50 : roadCycle[(levelInWorld - 1) % roadCycle.length];

  const rng = mulberry32(lvl * 2654435761 + worldInfo.worldNumber * 40503);
  const worldTypeIdx = (worldInfo.worldNumber - 1) % WORLD_ARCHETYPES.length;

  // Keep colors low (3-4 on regular levels, 5 on Hard/higher worlds) so clusters pop effortlessly!
  let colorsCount = 3;
  if (isWorldBoss || isMilestoneHard) {
    colorsCount = worldInfo.worldNumber === 1 ? 4 : 5;
  } else if (worldInfo.worldNumber === 1 && lvl <= 5) {
    colorsCount = 3;
  } else if (difficultyTier === 'Easy') {
    colorsCount = worldInfo.worldNumber <= 2 ? 3 : 4;
  } else {
    colorsCount = 4;
  }

  // Tall Top-to-Bottom Bubble Line: 15 to 21 rows!
  const numRows = isWorldBoss
    ? 21
    : isMilestoneHard
      ? 19
      : 15 + (lvl % 4); // 15..18 rows tall on normal levels!

  // 4 Ribbon Geometries designed for satisfying cascades & easy bank-shot avalanches:
  // 0 = Serpentine S-Ribbon (winds left-right from top to bottom!)
  // 1 = Twin Hanging Ribbons (two vertical streams joined at top!)
  // 2 = Hourglass / Diamond Spine (narrows & widens so cutting a neck drops everything below!)
  // 3 = Center Cascade Column (4-6 wide central stream with wide side bounce alleys!)
  const ribbonStyle = (lvl - 1) % 4;
  const pattern: string[] = [];

  let bandColorA = COLOR_CODES[Math.floor(rng() * colorsCount)];
  let bandColorB = COLOR_CODES[(COLOR_CODES.indexOf(bandColorA) + 1) % colorsCount];

  for (let r = 0; r < numRows; r++) {
    const cols = r % 2 === 1 ? 9 : 10;
    const chars: string[] = new Array(cols).fill('.');

    // Refresh band colors every 2 rows so 2x3 / 2x4 matching color blocks form naturally!
    if (r % 2 === 0) {
      bandColorA = COLOR_CODES[Math.floor(rng() * colorsCount)];
      bandColorB = COLOR_CODES[(COLOR_CODES.indexOf(bandColorA) + 1 + Math.floor(rng() * (colorsCount - 1))) % colorsCount];
    }

    if (r === 0) {
      // Strong Ceiling Anchor Row so the entire long line hangs stably until top anchors are popped
      for (let c = 1; c < cols - 1; c++) {
        chars[c] = c < cols / 2 ? bandColorA : bandColorB;
      }
    } else if (ribbonStyle === 0) {
      // Serpentine Winding Long Line snaking top-to-bottom!
      const waveCenter = (cols - 1) * 0.5 + Math.sin(r * 0.55) * 2.1;
      const halfSpan = isMilestoneHard ? 2.6 : 2.25;
      for (let c = 0; c < cols; c++) {
        if (Math.abs(c - waveCenter) <= halfSpan) {
          chars[c] = c <= waveCenter ? bandColorA : bandColorB;
        }
      }
    } else if (ribbonStyle === 1) {
      // Twin Vertical Streams (joined every 6th row for dramatic dual avalanches)
      for (let c = 0; c < cols; c++) {
        const leftStream = c >= 1 && c <= 3;
        const rightStream = c >= cols - 4 && c <= cols - 2;
        const bridge = r % 6 === 1 && c >= 3 && c <= cols - 4;
        if (leftStream) chars[c] = bandColorA;
        else if (rightStream) chars[c] = bandColorB;
        else if (bridge) chars[c] = bandColorA;
      }
    } else if (ribbonStyle === 2) {
      // Hourglass Neck Spine (narrow 3-bubble necks at r=5, 11 so one match drops huge tails!)
      const neckDist = Math.abs((r % 6) - 3); // 0..3
      const span = 1.3 + neckDist * 0.65;
      const mid = (cols - 1) * 0.5;
      for (let c = 0; c < cols; c++) {
        if (Math.abs(c - mid) <= span) {
          chars[c] = c < mid ? bandColorA : bandColorB;
        }
      }
    } else {
      // Central Tall Pillar Ribbon with wide bank-shot side corridors
      const mid = (cols - 1) * 0.5;
      const span = r % 4 === 3 ? 1.8 : 2.5;
      for (let c = 0; c < cols; c++) {
        if (Math.abs(c - mid) <= span) {
          chars[c] = Math.floor(c / 2) % 2 === 0 ? bandColorA : bandColorB;
        }
      }
    }

    // Apply World-Specific Signature Hazards
    // Kept fair & fun so they never block victory, only reward smart pops/avalanches!
    if (r >= 2 && r < numRows - 2) {
      for (let c = 0; c < cols; c++) {
        if (chars[c] === '.') continue;
        const roll = rng();

        if (worldTypeIdx === 1 && r % 3 === 1 && roll < (isMilestoneHard ? 0.28 : 0.16)) {
          // World 2 (Frostspire): Glacier Frost Shells
          chars[c] = chars[c].toLowerCase();
        } else if (worldTypeIdx === 2 && r % 5 === 3 && (c === 2 || c === cols - 3) && roll < 0.45) {
          // World 3 (Sunforge): Volcanic Stone Bridges (easy to avalanche from above!)
          chars[c] = 'X';
        } else if (worldTypeIdx === 3 && r % 4 === 2 && Math.abs(c - cols / 2) < 1.2) {
          // World 4 (Emerald): Enchanted Rainbow Vine Bridges
          chars[c] = 'W';
        } else if (worldTypeIdx === 4 && r % 6 === 3 && Math.abs(c - cols / 2) < 0.8) {
          // World 5 (Coral Lagoon): Voltaic Lightning Conduits
          chars[c] = 'L';
        } else if (worldTypeIdx === 5 && r % 5 === 2 && Math.abs(c - cols / 2) < 0.9) {
          // World 6 (Sakura): Blossom Bomb Cores
          chars[c] = 'B';
        } else if (worldTypeIdx === 6 && r % 4 === 1 && roll < 0.18) {
          // World 7 (Astral): Mixed Frost & Rainbow Stars
          chars[c] = roll < 0.09 ? 'W' : chars[c].toLowerCase();
        } else if (isMilestoneHard && r % 4 === 2 && roll < 0.16) {
          // Every 10th Hard level gets extra Frost & Bomb spice even in World 1!
          chars[c] = roll < 0.06 ? 'B' : chars[c].toLowerCase();
        }
      }
    }

    pattern.push(chars.join(''));
  }

  // Guarantee 2 Trapped Power Bubbles ('P') in every single level!
  // 1st 'P' near lower-upper visible zone (numRows - 4) so player sees & frees it quickly,
  // 2nd 'P' higher up the tall line (Math.floor(numRows * 0.42))!
  const powerTargetRows = [
    Math.max(2, numRows - 4),
    Math.max(1, Math.floor(numRows * 0.42)),
  ];

  for (const pr of powerTargetRows) {
    const rowArr = pattern[pr].split('');
    // Pick an occupied cell near the middle of that row
    const midIdx = Math.floor(rowArr.length / 2);
    let placed = false;
    for (let offset = 0; offset < rowArr.length; offset++) {
      for (const dir of [1, -1]) {
        const idx = midIdx + offset * dir;
        if (idx >= 0 && idx < rowArr.length && rowArr[idx] !== '.' && rowArr[idx] !== 'X') {
          rowArr[idx] = 'P';
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) {
      rowArr[midIdx] = 'P';
    }
    pattern[pr] = rowArr.join('');
  }

  const titleWord = STAGE_TITLES[(lvl - 1) % STAGE_TITLES.length];
  // Generous Bubble Ammo so clearing the tall line feels smooth & rewarding,
  // while running out of bubbles triggers Game Lose!
  const shotsLimit = isWorldBoss
    ? 44
    : isMilestoneHard
      ? 40
      : 38 + (numRows - 15) * 2;
  const parShots = Math.max(14, Math.round(shotsLimit * 0.56));

  const stage: CampaignStage = {
    stageNumber: lvl,
    worldNumber: worldInfo.worldNumber,
    levelInWorld,
    name: isWorldBoss
      ? `${worldInfo.name} Crown`
      : isMilestoneHard
        ? `Hard Trial ${lvl}`
        : `${titleWord} ${levelInWorld}`,
    subtitle: isWorldBoss
      ? `World ${worldInfo.worldNumber} Boss`
      : isMilestoneHard
        ? '10-Level Hard Milestone'
        : `${worldInfo.hazardName}`,
    briefing: isMilestoneHard
      ? `Every 10th level is a Hard Challenge! Free the Power Bubble above and drop anchor chains before bubbles run out.`
      : `Clear the tall bubble stream before your shooter bubbles run out. Pop the glowing Power Bubble above to unlock & fire your selected Power!`,
    featuredMechanic: worldInfo.hazardName,
    worldHazard: worldInfo.hazardName,
    difficultyTier,
    isMilestoneHard: isMilestoneHard || isWorldBoss,
    roadX,
    colorsCount,
    missThreshold: isMilestoneHard ? 5 : 7,
    shotsLimit,
    parShots,
    pattern,
  };

  const finalStage = applyDifficultyModifier(stage, difficultyMode);
  stageCache.set(cacheKey, finalStage);
  return finalStage;
}

/**
 * Returns the stages to display on the scrollable Bottom-to-Top Level Road for a given World.
 * For worlds up to 64 levels (Worlds 1..12: 20, 24, 28, 32, 36, 40...), returns EVERY stage in the world!
 * For ultra-huge higher worlds (up to Level 987,654,321), returns a smooth 50-level road window.
 */
export function getStagesForWorldRoad(
  worldNumber: number,
  focusLevel: number,
  difficultyMode: DifficultyMode,
): CampaignStage[] {
  const bounds = getWorldLevelBounds(worldNumber);
  const maxRoadWindow = 64;

  let fromLvl = bounds.startLevel;
  let toLvl = bounds.endLevel;

  if (bounds.levelCount > maxRoadWindow) {
    const clampedFocus = Math.max(bounds.startLevel, Math.min(bounds.endLevel, focusLevel));
    fromLvl = Math.max(bounds.startLevel, clampedFocus - 18);
    toLvl = Math.min(bounds.endLevel, fromLvl + maxRoadWindow - 1);
    if (toLvl - fromLvl + 1 < maxRoadWindow) {
      fromLvl = Math.max(bounds.startLevel, toLvl - maxRoadWindow + 1);
    }
  }

  const list: CampaignStage[] = [];
  for (let l = fromLvl; l <= toLvl; l++) {
    list.push(getStageForLevel(l, difficultyMode));
  }
  return list;
}

export const CAMPAIGN_STAGES: CampaignStage[] = Array.from({ length: 20 }, (_, i) =>
  getStageForLevel(i + 1, 'normal'),
);

/**
 * Daily Level Date Helpers & Deterministic Stage Generator
 */
export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDisplayLabel(): string {
  const now = new Date();
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[now.getMonth()]} ${now.getDate()}`;
}

export function getDailyStageForToday(): CampaignStage {
  const key = getTodayDateKey();
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positiveSeed = (hash >>> 0) % 700 + 2; // Picks rich scenic layouts while keeping smooth playability
  const base = getStageForLevel(positiveSeed, 'normal');
  const worldThemeNum = ((hash >>> 0) % WORLD_ARCHETYPES.length) + 1;
  const worldTheme = getWorldInfo(worldThemeNum);
  const label = getTodayDisplayLabel();

  return {
    ...base,
    stageNumber: 1,
    worldNumber: worldTheme.worldNumber,
    levelInWorld: 1,
    name: `Daily Starlight (${label})`,
    subtitle: `Today's Special Level`,
    briefing: `A brand-new magic level crafted exclusively for ${label}! Free the glowing Power Bubbles above and clear the stream.`,
    featuredMechanic: worldTheme.hazardName,
    worldHazard: worldTheme.hazardName,
    difficultyTier: 'Medium',
    isMilestoneHard: false,
    colorsCount: 4,
    shotsLimit: 44,
    parShots: 24,
  };
}

