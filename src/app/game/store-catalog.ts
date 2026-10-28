import { AnimCategory, BubbleSpecial, StorePowerKind, StoreTabCategory } from './bubble-types';

export const ANIMATIONS_PER_CATEGORY = 1000;
export const SHOOTER_DESIGNS_COUNT = 24;

export type ShooterWingArchetype =
  | 'cone'
  | 'blade'
  | 'crystal'
  | 'crescent'
  | 'crown'
  | 'crossbow';

export interface ShooterDesignMeta {
  index: number; // 0 .. 23
  displayNumber: number; // 1 .. 24
  name: string;
  styleTag: string;
  description: string;
  icon: string;
  primaryHex: string;
  primaryNum: number;
  secondaryHex: string;
  secondaryNum: number;
  gemHex: string;
  gemNum: number;
  wingArchetype: ShooterWingArchetype;
  ringCount: 2 | 3;
  price: number;
}

export interface StoreCategoryDef {
  id: StoreTabCategory;
  label: string;
  icon: string;
  countLabel: string;
}

export interface EmoteCategoryDef {
  id: AnimCategory;
  label: string;
  icon: string;
  accentHex: string;
  countLabel: string;
}

export const EMOTE_CATEGORIES: EmoteCategoryDef[] = [
  { id: 'happy', label: 'Happy', icon: 'sentiment_very_satisfied', accentHex: '#f472b6', countLabel: '1,000' },
  { id: 'idle', label: 'Idle Pose', icon: 'self_improvement', accentHex: '#38bdf8', countLabel: '1,000' },
  { id: 'win', label: 'Victory', icon: 'emoji_events', accentHex: '#fbbf24', countLabel: '1,000' },
  { id: 'shoot', label: 'Wand Cast', icon: 'auto_fix_high', accentHex: '#34d399', countLabel: '1,000' },
  { id: 'angry', label: 'Angry / Pout', icon: 'mood_bad', accentHex: '#fb7185', countLabel: '1,000' },
];

export const STORE_CATEGORIES: StoreCategoryDef[] = [
  { id: 'shooters', label: 'Shooters', icon: 'gps_fixed', countLabel: '24' },
  { id: 'powers', label: 'Powers', icon: 'bolt', countLabel: '6' },
  { id: 'happy', label: 'Happy Emotes', icon: 'sentiment_very_satisfied', countLabel: '1,000' },
  { id: 'idle', label: 'Idle Emotes', icon: 'self_improvement', countLabel: '1,000' },
  { id: 'win', label: 'Victory Emotes', icon: 'emoji_events', countLabel: '1,000' },
  { id: 'shoot', label: 'Wand Emotes', icon: 'auto_fix_high', countLabel: '1,000' },
  { id: 'angry', label: 'Reaction Emotes', icon: 'mood_bad', countLabel: '1,000' },
];

export interface StoreAnimationMeta {
  category: AnimCategory;
  index: number; // 0 .. 999
  displayNumber: number; // 1 .. 1000
  key: string; // e.g. 'idle:0'
  name: string;
  styleTag: string;
  icon: string;
  accentHex: string;
  price: number;
}

export interface StorePowerDef {
  id: StorePowerKind;
  powerIndex: number; // 0 .. 5
  special: BubbleSpecial;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  accentHex: string;
  ringColorNum: number;
}

export const STORE_POWER_DEFS: StorePowerDef[] = [
  {
    id: 'supernova',
    powerIndex: 0,
    special: BubbleSpecial.Supernova,
    name: 'Supernova Orb',
    shortName: 'Nova',
    description: 'Detonates a massive 3.2-ring golden starlight blast on impact.',
    icon: 'wb_sunny',
    accentHex: '#fbbf24',
    ringColorNum: 0xfbbf24,
  },
  {
    id: 'aurora',
    powerIndex: 1,
    special: BubbleSpecial.Aurora,
    name: 'Prism Borealis',
    shortName: 'Prism',
    description: 'Vaporizes every visible bubble matching the impacted crystal color.',
    icon: 'palette',
    accentHex: '#e879f9',
    ringColorNum: 0xe879f9,
  },
  {
    id: 'meteor',
    powerIndex: 2,
    special: BubbleSpecial.Meteor,
    name: 'Starfall Meteor',
    shortName: 'Meteor',
    description: 'Pierces straight to the ceiling while carving a wide twin-column blaze.',
    icon: 'rocket_launch',
    accentHex: '#fb923c',
    ringColorNum: 0xfb923c,
  },
  {
    id: 'crossbolt',
    powerIndex: 3,
    special: BubbleSpecial.CrossBolt,
    name: 'Thunder Cross',
    shortName: 'Cross',
    description: 'Unleashes simultaneous horizontal row and vertical column lightning beams.',
    icon: 'electric_bolt',
    accentHex: '#38bdf8',
    ringColorNum: 0x38bdf8,
  },
  {
    id: 'frostburst',
    powerIndex: 4,
    special: BubbleSpecial.FrostBurst,
    name: 'Chrono Starburst',
    shortName: 'Chrono',
    description: 'Shatters a wide crystal zone and grants +4 extra shooter bubbles.',
    icon: 'ac_unit',
    accentHex: '#34d399',
    ringColorNum: 0x34d399,
  },
  {
    id: 'celestial_crown',
    powerIndex: 5,
    special: BubbleSpecial.CelestialCrown,
    name: 'Celestial Crown',
    shortName: 'Crown',
    description: 'Sweeps the lowest 4 active rows in a royal astral vortex.',
    icon: 'workspace_premium',
    accentHex: '#fde047',
    ringColorNum: 0xfde047,
  },
];

export const STORE_POWER_BY_ID: Record<StorePowerKind, StorePowerDef> = {
  supernova: STORE_POWER_DEFS[0],
  aurora: STORE_POWER_DEFS[1],
  meteor: STORE_POWER_DEFS[2],
  crossbolt: STORE_POWER_DEFS[3],
  frostburst: STORE_POWER_DEFS[4],
  celestial_crown: STORE_POWER_DEFS[5],
};

export const SPECIAL_TO_STORE_POWER: Partial<Record<BubbleSpecial, StorePowerKind>> = {
  [BubbleSpecial.Supernova]: 'supernova',
  [BubbleSpecial.Aurora]: 'aurora',
  [BubbleSpecial.Meteor]: 'meteor',
  [BubbleSpecial.CrossBolt]: 'crossbolt',
  [BubbleSpecial.FrostBurst]: 'frostburst',
  [BubbleSpecial.CelestialCrown]: 'celestial_crown',
};

/**
 * Exact Per-World Coin Reward Formula:
 * - World 1: 3 Stars = 20 coins, 2 Stars = 15 coins, 1 Star = 5 coins
 * - Each subsequent World multiplies by 1.2: base * (1.2 ^ (worldNumber - 1))
 */
export function calculateStageCoinReward(worldNumber: number, stars: number): number {
  const base = stars >= 3 ? 20 : stars === 2 ? 15 : 5;
  const safeWorldExp = Math.min(62, Math.max(0, Math.floor(worldNumber) - 1));
  return Math.max(1, Math.round(base * Math.pow(1.2, safeWorldExp)));
}

/**
 * Daily Level Win Reward Formula:
 * - Strictly ONLY 3 possible base coin tiers: [20, 25, 30] (picked randomly on win!)
 * - Scales across all subsequent Worlds by 1.2^(worldNumber - 1)!
 */
export const DAILY_BASE_COIN_TIERS: readonly [20, 25, 30] = [20, 25, 30];

export function getDailyCoinRewardTiers(worldNumber: number): [number, number, number] {
  const safeWorldExp = Math.min(62, Math.max(0, Math.floor(worldNumber) - 1));
  const mult = Math.pow(1.2, safeWorldExp);
  return [
    Math.max(20, Math.round(20 * mult)),
    Math.max(25, Math.round(25 * mult)),
    Math.max(30, Math.round(30 * mult)),
  ];
}

export function rollDailyStageCoinReward(worldNumber: number): number {
  const tiers = getDailyCoinRewardTiers(worldNumber);
  const pickIdx = Math.floor(Math.random() * 3); // Randomly picks 0 (20), 1 (25), or 2 (30) scaled by 1.2^(world-1)
  return tiers[pickIdx];
}

/**
 * Exact Store Emote/Animation Pricing Formula:
 * - Index 0 (#1 Starter Emote in each category) = Free default owned (0 coins)
 * - Index 1 (First purchasable emote) = 100 coins
 * - Every next emote multiplies by 1.6 (100, 160, 256, 410, 655, 1049...)
 */
export function getAnimationPrice(index: number): number {
  if (index <= 0) return 0;
  const safeExp = Math.min(58, index - 1);
  return Math.max(100, Math.round(100 * Math.pow(1.6, safeExp)));
}

/**
 * Exact Store Power Pricing Formula (Unlimited Repeatable Purchases!):
 * - First Power = 100 coins, each next Power tier multiplies by 1.9
 *   (100, 190, 361, 686, 1,303, 2,476)
 * - Price does NOT inflate per purchase so the player can buy any Power as many times as they want!
 */
export function getStorePowerPrice(powerIndex: number): number {
  const safeExp = Math.min(44, Math.max(0, powerIndex));
  return Math.max(100, Math.round(100 * Math.pow(1.9, safeExp)));
}

/**
 * Exact 3D Bubble Shooter Pricing Formula:
 * - Index 0 (#1 Classic Astral Ring) = Free starter shooter (0 coins, OWNED by default)
 * - Index 1 (First purchasable new Shooter) = 120 coins
 * - Every next Shooter multiplies by 1.3: Math.round(120 * 1.3^(index - 1))
 *   (120, 156, 203, 264, 343, 446, 580, 754, 980, 1,274...)
 */
export function getShooterPrice(index: number): number {
  if (index <= 0) return 0;
  const safeExp = Math.min(60, Math.max(0, Math.floor(index) - 1));
  return Math.max(120, Math.round(120 * Math.pow(1.3, safeExp)));
}

const SHOOTER_CATALOG_SPECS: {
  name: string;
  styleTag: string;
  description: string;
  icon: string;
  primaryHex: string;
  primaryNum: number;
  secondaryHex: string;
  secondaryNum: number;
  gemHex: string;
  gemNum: number;
  wingArchetype: ShooterWingArchetype;
  ringCount: 2 | 3;
}[] = [
  {
    name: 'Classic Astral Ring',
    styleTag: 'Starter Ring',
    description: 'Balanced golden spell ring with twin starlight aiming cones.',
    icon: 'radio_button_checked',
    primaryHex: '#eab308',
    primaryNum: 0xeab308,
    secondaryHex: '#f1f5f9',
    secondaryNum: 0xf1f5f9,
    gemHex: '#38bdf8',
    gemNum: 0x38bdf8,
    wingArchetype: 'cone',
    ringCount: 2,
  },
  {
    name: 'Phoenix Twin Wing',
    styleTag: 'Blazing Wings',
    description: 'Crimson-gold swept phoenix blades with an ember ruby core.',
    icon: 'local_fire_department',
    primaryHex: '#f97316',
    primaryNum: 0xf97316,
    secondaryHex: '#fde047',
    secondaryNum: 0xfde047,
    gemHex: '#ff1744',
    gemNum: 0xff1744,
    wingArchetype: 'blade',
    ringCount: 3,
  },
  {
    name: 'Frostbite Prism Cannon',
    styleTag: 'Glacier Prisms',
    description: 'Four floating diamond ice prisms orbiting a sapphire rune ring.',
    icon: 'ac_unit',
    primaryHex: '#38bdf8',
    primaryNum: 0x38bdf8,
    secondaryHex: '#e0f2fe',
    secondaryNum: 0xe0f2fe,
    gemHex: '#00e5ff',
    gemNum: 0x00e5ff,
    wingArchetype: 'crystal',
    ringCount: 3,
  },
  {
    name: 'Emerald Dragon Arc',
    styleTag: 'Jade Crescent',
    description: 'Curved emerald dragon bow with twin luminous jade finials.',
    icon: 'auto_awesome',
    primaryHex: '#10b981',
    primaryNum: 0x10b981,
    secondaryHex: '#fde047',
    secondaryNum: 0xfde047,
    gemHex: '#00e676',
    gemNum: 0x00e676,
    wingArchetype: 'crescent',
    ringCount: 2,
  },
  {
    name: 'Royal Sunburst Crown',
    styleTag: 'Solar Spire',
    description: 'Five-spire sovereign sun crown forged in gleaming imperial gold.',
    icon: 'workspace_premium',
    primaryHex: '#fbbf24',
    primaryNum: 0xfbbf24,
    secondaryHex: '#fffbeb',
    secondaryNum: 0xfffbeb,
    gemHex: '#f59e0b',
    gemNum: 0xf59e0b,
    wingArchetype: 'crown',
    ringCount: 3,
  },
  {
    name: 'Nebula Vortex Crossbow',
    styleTag: 'Twin Rail',
    description: 'Precision astral twin-rail crossbow powered by amethyst starlight.',
    icon: 'gps_fixed',
    primaryHex: '#a855f7',
    primaryNum: 0xa855f7,
    secondaryHex: '#e9d5ff',
    secondaryNum: 0xe9d5ff,
    gemHex: '#d500f9',
    gemNum: 0xd500f9,
    wingArchetype: 'crossbow',
    ringCount: 3,
  },
  {
    name: 'Sakura Blossom Harp',
    styleTag: 'Petal Bow',
    description: 'Rose-gold celestial harp cradle that sings with cherry-blossom light.',
    icon: 'spa',
    primaryHex: '#f472b6',
    primaryNum: 0xf472b6,
    secondaryHex: '#fce7f3',
    secondaryNum: 0xfce7f3,
    gemHex: '#ec4899',
    gemNum: 0xec4899,
    wingArchetype: 'crescent',
    ringCount: 3,
  },
  {
    name: 'Thunderbolt Coil',
    styleTag: 'Voltaic Rail',
    description: 'Cobalt-platinum dual coil launcher crackling with sky-blue voltage.',
    icon: 'electric_bolt',
    primaryHex: '#0284c7',
    primaryNum: 0x0284c7,
    secondaryHex: '#bae6fd',
    secondaryNum: 0xbae6fd,
    gemHex: '#38bdf8',
    gemNum: 0x38bdf8,
    wingArchetype: 'crossbow',
    ringCount: 3,
  },
  {
    name: 'Ruby Valkyrie Blades',
    styleTag: 'Winged Spear',
    description: 'Scarlet valkyrie wing-guards with polished platinum rune halos.',
    icon: 'military_tech',
    primaryHex: '#e11d48',
    primaryNum: 0xe11d48,
    secondaryHex: '#f8fafc',
    secondaryNum: 0xf8fafc,
    gemHex: '#fb7185',
    gemNum: 0xfb7185,
    wingArchetype: 'blade',
    ringCount: 3,
  },
  {
    name: 'Diamond Starlight Prism',
    styleTag: 'Pure Crystal',
    description: 'Iridescent white-diamond crystal shards around a starlight core.',
    icon: 'diamond',
    primaryHex: '#e2e8f0',
    primaryNum: 0xe2e8f0,
    secondaryHex: '#38bdf8',
    secondaryNum: 0x38bdf8,
    gemHex: '#ffffff',
    gemNum: 0xffffff,
    wingArchetype: 'crystal',
    ringCount: 3,
  },
  {
    name: 'Moonveil Eclipse Bow',
    styleTag: 'Lunar Arc',
    description: 'Midnight indigo crescent bow trimmed in silver moonbeam filigree.',
    icon: 'nights_stay',
    primaryHex: '#6366f1',
    primaryNum: 0x6366f1,
    secondaryHex: '#e0e7ff',
    secondaryNum: 0xe0e7ff,
    gemHex: '#818cf8',
    gemNum: 0x818cf8,
    wingArchetype: 'crescent',
    ringCount: 3,
  },
  {
    name: 'Solaris Empress Diadem',
    styleTag: 'Radiant Crown',
    description: 'Sunfire orange-gold royal diadem with triple harmonic orbit rings.',
    icon: 'wb_sunny',
    primaryHex: '#f59e0b',
    primaryNum: 0xf59e0b,
    secondaryHex: '#fef08a',
    secondaryNum: 0xfef08a,
    gemHex: '#fde047',
    gemNum: 0xfde047,
    wingArchetype: 'crown',
    ringCount: 3,
  },
  {
    name: 'Coral Reef Trident',
    styleTag: 'Oceanic Wing',
    description: 'Turquoise lagoon wing-fins accented with warm sunset coral gems.',
    icon: 'water_drop',
    primaryHex: '#06b6d4',
    primaryNum: 0x06b6d4,
    secondaryHex: '#ffedd5',
    secondaryNum: 0xffedd5,
    gemHex: '#ff6d00',
    gemNum: 0xff6d00,
    wingArchetype: 'blade',
    ringCount: 2,
  },
  {
    name: 'Amethyst Oracle Ring',
    styleTag: 'Mystic Cones',
    description: 'Deep violet oracle rings paired with gilded astral sight cones.',
    icon: 'flare',
    primaryHex: '#9333ea',
    primaryNum: 0x9333ea,
    secondaryHex: '#fde047',
    secondaryNum: 0xfde047,
    gemHex: '#e879f9',
    gemNum: 0xe879f9,
    wingArchetype: 'cone',
    ringCount: 3,
  },
  {
    name: 'Verdant Sylvan Crossbow',
    styleTag: 'Forest Arbiter',
    description: 'Enchanted emerald-brass arbor crossbow with glowing leaf-jade sight.',
    icon: 'forest',
    primaryHex: '#059669',
    primaryNum: 0x059669,
    secondaryHex: '#fcd34d',
    secondaryNum: 0xfcd34d,
    gemHex: '#34d399',
    gemNum: 0x34d399,
    wingArchetype: 'crossbow',
    ringCount: 2,
  },
  {
    name: 'Aurora Borealis Shards',
    styleTag: 'Polar Crystal',
    description: 'Mint-and-magenta polar crystal cluster with luminous sky rings.',
    icon: 'palette',
    primaryHex: '#2dd4bf',
    primaryNum: 0x2dd4bf,
    secondaryHex: '#f0abfc',
    secondaryNum: 0xf0abfc,
    gemHex: '#5eead4',
    gemNum: 0x5eead4,
    wingArchetype: 'crystal',
    ringCount: 3,
  },
  {
    name: 'Crimson Dragon Sovereign',
    styleTag: 'Dragon Crown',
    description: 'Regal ruby-and-gold dragon crest engineered for boss stages.',
    icon: 'whatshot',
    primaryHex: '#dc2626',
    primaryNum: 0xdc2626,
    secondaryHex: '#fbbf24',
    secondaryNum: 0xfbbf24,
    gemHex: '#facc15',
    gemNum: 0xfacc15,
    wingArchetype: 'crown',
    ringCount: 3,
  },
  {
    name: 'Zephyr Skywing',
    styleTag: 'Aero Blades',
    description: 'Featherlight sky-silver wings built for bank-shot precision.',
    icon: 'air',
    primaryHex: '#38bdf8',
    primaryNum: 0x38bdf8,
    secondaryHex: '#ffffff',
    secondaryNum: 0xffffff,
    gemHex: '#7dd3fc',
    gemNum: 0x7dd3fc,
    wingArchetype: 'blade',
    ringCount: 3,
  },
  {
    name: 'Opaline Mirage Cradle',
    styleTag: 'Opal Crescent',
    description: 'Shimmering pearl-pink crescent bow with turquoise starlight trim.',
    icon: 'brightness_auto',
    primaryHex: '#f9a8d4',
    primaryNum: 0xf9a8d4,
    secondaryHex: '#67e8f9',
    secondaryNum: 0x67e8f9,
    gemHex: '#fdf4ff',
    gemNum: 0xfdf4ff,
    wingArchetype: 'crescent',
    ringCount: 3,
  },
  {
    name: 'Obsidian Nova Rail',
    styleTag: 'Dark Matter',
    description: 'Midnight titanium twin-rail cannon with blazing golden nova coils.',
    icon: 'rocket_launch',
    primaryHex: '#475569',
    primaryNum: 0x475569,
    secondaryHex: '#fbbf24',
    secondaryNum: 0xfbbf24,
    gemHex: '#f97316',
    gemNum: 0xf97316,
    wingArchetype: 'crossbow',
    ringCount: 3,
  },
  {
    name: 'Starfall Crystal Sanctum',
    styleTag: 'Comet Shards',
    description: 'Golden-cobalt comet crystals orbiting a triple harmonic sanctum.',
    icon: 'stars',
    primaryHex: '#eab308',
    primaryNum: 0xeab308,
    secondaryHex: '#38bdf8',
    secondaryNum: 0x38bdf8,
    gemHex: '#fef08a',
    gemNum: 0xfef08a,
    wingArchetype: 'crystal',
    ringCount: 3,
  },
  {
    name: ' Velvet Rose Tiara',
    styleTag: 'Royal Tiara',
    description: 'Velvet magenta tiara turret crowned with five sparkling rose spires.',
    icon: 'favorite',
    primaryHex: '#db2777',
    primaryNum: 0xdb2777,
    secondaryHex: '#fde68a',
    secondaryNum: 0xfde68a,
    gemHex: '#f472b6',
    gemNum: 0xf472b6,
    wingArchetype: 'crown',
    ringCount: 3,
  },
  {
    name: 'Celestial Seraph Wings',
    styleTag: 'Six-Star Wing',
    description: 'Radiant pearl-and-gold seraph wings blessed with pure astral light.',
    icon: 'flight_takeoff',
    primaryHex: '#fde047',
    primaryNum: 0xfde047,
    secondaryHex: '#f8fafc',
    secondaryNum: 0xf8fafc,
    gemHex: '#38bdf8',
    gemNum: 0x38bdf8,
    wingArchetype: 'blade',
    ringCount: 3,
  },
  {
    name: 'Sovereign Infinity Cannon',
    styleTag: 'Mythic Rail',
    description: 'Ultimate Playera mythic starlight launcher with triple infinity halos.',
    icon: 'all_inclusive',
    primaryHex: '#c084fc',
    primaryNum: 0xc084fc,
    secondaryHex: '#fde047',
    secondaryNum: 0xfde047,
    gemHex: '#00e5ff',
    gemNum: 0x00e5ff,
    wingArchetype: 'crossbow',
    ringCount: 3,
  },
];

export function getShooterDesignMeta(index: number): ShooterDesignMeta {
  const clamped = Math.max(0, Math.min(SHOOTER_DESIGNS_COUNT - 1, Math.floor(index)));
  const spec = SHOOTER_CATALOG_SPECS[clamped];
  return {
    index: clamped,
    displayNumber: clamped + 1,
    name: spec.name.trim(),
    styleTag: spec.styleTag,
    description: spec.description,
    icon: spec.icon,
    primaryHex: spec.primaryHex,
    primaryNum: spec.primaryNum,
    secondaryHex: spec.secondaryHex,
    secondaryNum: spec.secondaryNum,
    gemHex: spec.gemHex,
    gemNum: spec.gemNum,
    wingArchetype: spec.wingArchetype,
    ringCount: spec.ringCount,
    price: getShooterPrice(clamped),
  };
}

/**
 * Cleanly formats coin prices & balances (exact up to 99,999; compact suffixes above).
 */
export function formatCoinAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0';
  if (amount < 100000) {
    return Math.round(amount).toLocaleString('en-US');
  }
  const units = [
    { val: 1e15, sym: 'Q' },
    { val: 1e12, sym: 'T' },
    { val: 1e9, sym: 'B' },
    { val: 1e6, sym: 'M' },
    { val: 1e3, sym: 'K' },
  ];
  for (const u of units) {
    if (amount >= u.val) {
      const scaled = amount / u.val;
      return `${scaled >= 100 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, '')}${u.sym}`;
    }
  }
  return String(Math.round(amount));
}

const ANIM_ADJECTIVES = [
  'Starlight', 'Celestial', 'Lunar', 'Sakura', 'Aurora', 'Crystal', 'Royal', 'Velvet',
  'Astral', 'Radiant', 'Moonbeam', 'Prism', 'Golden', 'Sapphire', 'Emerald', 'Mystic',
  'Solar', 'Twilight', 'Gilded', 'Zephyr', 'Diamond', 'Opal', 'Rose', 'Nebula', 'Sylvan',
];

const ANIM_MOVES_BY_CAT: Record<AnimCategory, string[]> = {
  idle: [
    'Waltz Sway', 'Ribbon Float', 'Ballet Breathe', 'Star Wave', 'Crown Twirl',
    'Moon Poise', 'Breeze Step', 'Harp Groove', 'Charm Tilt', 'Orbit Hover',
  ],
  shoot: [
    'Sky Thrust', 'Spiral Cast', 'Pirouette Spell', 'Comet Arc', 'Twin Beam',
    'Crescent Flick', 'Nova Raise', 'Winged Flourish', 'Starlight Snap', 'Vortex Cast',
  ],
  happy: [
    'Joy Hop', 'Heart Spin', 'Star Cheer', 'Twirl Leap', 'Ribbon Clap',
    'Blossom Bounce', 'Victory Wink', 'Sunbeam Jump', 'Sparkle Dance', 'gleam Twirl',
  ],
  win: [
    'Royal Finale', 'Trophy Spin', 'Grand Pirouette', 'Festival Dance', 'Crown Hover',
    'Encore Waltz', 'Starfall Jig', 'Empress Bow', 'Miracle Leap', 'DiamondSpin',
  ],
  angry: [
    'Pout Stomp', 'Sassy Huff', 'Head Shake', 'Wand Tap', 'Frown Sway',
    'Crossed Pout', 'Spark Tantrum', 'Fierce Glare', 'Teacup Sulk', 'Storm Pose',
  ],
};

const CAT_ACCENTS: Record<AnimCategory, string[]> = {
  idle: ['#38bdf8', '#a855f7', '#fbbf24', '#34d399', '#f472b6'],
  shoot: ['#fbbf24', '#38bdf8', '#f97316', '#e879f9', '#22d3ee'],
  happy: ['#f472b6', '#fbbf24', '#34d399', '#c084fc', '#38bdf8'],
  win: ['#fde047', '#f59e0b', '#e879f9', '#38bdf8', '#34d399'],
  angry: ['#fb7185', '#f43f5e', '#f97316', '#e879f9', '#fbbf24'],
};

const CAT_ICONS: Record<AnimCategory, string[]> = {
  idle: ['auto_awesome', 'self_improvement', 'air', 'flare', 'nights_stay'],
  shoot: ['auto_fix_high', 'bolt', 'wb_twilight', 'stars', 'rocket_launch'],
  happy: ['celebration', 'favorite', 'sentiment_very_satisfied', 'grade', 'auto_awesome'],
  win: ['emoji_events', 'workspace_premium', 'military_tech', 'stars', 'diamond'],
  angry: ['mood_bad', 'whatshot', 'flash_on', 'priority_high', 'bolt'],
};

/**
 * O(1) deterministic metadata generator for any of the 1,000 animations per category!
 */
export function getAnimationItemMeta(category: AnimCategory, index: number): StoreAnimationMeta {
  const clamped = Math.max(0, Math.min(ANIMATIONS_PER_CATEGORY - 1, Math.floor(index)));
  const moves = ANIM_MOVES_BY_CAT[category];
  const adj = ANIM_ADJECTIVES[(clamped * 3 + moves.length) % ANIM_ADJECTIVES.length];
  const move = moves[clamped % moves.length];
  const variantTier = Math.floor(clamped / moves.length) + 1;
  const accents = CAT_ACCENTS[category];
  const icons = CAT_ICONS[category];

  return {
    category,
    index: clamped,
    displayNumber: clamped + 1,
    key: `${category}:${clamped}`,
    name: clamped === 0 ? `Classic ${move}` : `${adj} ${move} ${variantTier}`,
    styleTag: move,
    icon: icons[clamped % icons.length],
    accentHex: accents[clamped % accents.length],
    price: getAnimationPrice(clamped),
  };
}
