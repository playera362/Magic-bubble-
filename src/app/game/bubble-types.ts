export enum BubbleColor {
  Ruby = 'ruby',
  Sapphire = 'sapphire',
  Emerald = 'emerald',
  Topaz = 'topaz',
  Amethyst = 'amethyst',
  Coral = 'coral',
}

export enum BubbleSpecial {
  None = 'none',
  Bomb = 'bomb',
  Lightning = 'lightning',
  Rainbow = 'rainbow',
  Fireball = 'fireball',
  Frozen = 'frozen',
  Stone = 'stone',
  // Purchased Store Powers (loaded directly into shooter bubble with 3D animations!)
  Supernova = 'supernova',
  Aurora = 'aurora',
  Meteor = 'meteor',
  CrossBolt = 'crossbolt',
  FrostBurst = 'frostburst',
  CelestialCrown = 'celestial_crown',
}

export enum GameMode {
  Campaign = 'campaign',
  Endless = 'endless',
  Daily = 'daily',
}

export enum GamePhase {
  IntroLoading = 'intro_loading',
  Title = 'title',
  LevelRoad = 'level_road',
  Playing = 'playing',
  Paused = 'paused',
  Victory = 'victory',
  WorldTransition = 'world_transition',
  GameOver = 'gameover',
}

export enum CameraPreset {
  Arcade = 'arcade',
  Tactical = 'tactical',
  Dynamic = 'dynamic',
}

export type DifficultyMode = 'easy' | 'normal' | 'hard';
export type StageDifficultyTier = 'Easy' | 'Medium' | 'Hard' | 'Boss';
export type GirlEmotionState = 'idle' | 'happy' | 'miss' | 'upset' | 'win';
export type PowerKind = 'bomb' | 'rainbow' | 'lightning' | 'fireball';
export type StorePowerKind =
  | 'supernova'
  | 'aurora'
  | 'meteor'
  | 'crossbolt'
  | 'frostburst'
  | 'celestial_crown';
export type AnimCategory = 'idle' | 'shoot' | 'happy' | 'win' | 'angry';
export type StoreTabCategory = AnimCategory | 'shooters' | 'powers';
export type VaultSection = 'emotes' | 'shooters' | 'powers';
export type LoseReason = 'out_of_bubbles' | 'danger_line';

export interface EquippedAnimations {
  idle: number;
  shoot: number;
  happy: number;
  win: number;
  angry: number;
}

export interface WorldInfo {
  worldNumber: number;
  name: string;
  icon: string;
  hazardName: string;
  signaturePower: PowerKind;
  imageUrl: string;
  imageHueRotateDeg: number;
  bgTopHex: string;
  bgBottomHex: string;
  accentHex: string;
  skyNum: number;
  startLevel: number;
  endLevel: number;
  levelCount: number;
}

export interface GridCell {
  id: number;
  row: number;
  col: number;
  color: BubbleColor;
  special: BubbleSpecial;
  frozen: boolean;
  trappedPower: PowerKind | null;
  scale: number;
  wobble: number;
  wobbleVel: number;
  hitFlash: number;
}

export interface ProjectileBubble {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: BubbleColor;
  special: BubbleSpecial;
  trailTimer: number;
  bounces: number;
  piercing: boolean;
}

export interface FallingBubble {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  vRotX: number;
  vRotY: number;
  color: BubbleColor;
  special: BubbleSpecial;
  points: number;
  life: number;
}

export interface PoppingBubble {
  x: number;
  y: number;
  color: BubbleColor;
  special: BubbleSpecial;
  progress: number;
  duration: number;
}

export interface ShockwaveRingEffect {
  x: number;
  y: number;
  colorHex: number;
  progress: number;
  duration: number;
  maxRadius: number;
}

export interface FloatingScorePopup {
  id: number;
  screenX: number;
  screenY: number;
  text: string;
  subtext?: string;
  colorHex: string;
  age: number;
}

export interface CampaignStage {
  stageNumber: number;
  worldNumber: number;
  levelInWorld: number;
  name: string;
  subtitle: string;
  briefing: string;
  featuredMechanic: string;
  worldHazard: string;
  difficultyTier: StageDifficultyTier;
  isMilestoneHard: boolean;
  roadX: number; // Percentage X on Level Road SVG (0..100)
  colorsCount: number;
  missThreshold: number;
  shotsLimit: number;
  parShots: number;
  pattern: string[];
}

export interface GameHudSnapshot {
  phase: GamePhase;
  mode: GameMode;
  worldNumber: number;
  worldName: string;
  worldHazard: string;
  worldSignaturePower: PowerKind;
  stageNumber: number;
  stageName: string;
  stageSubtitle: string;
  stageBriefing: string;
  stageFeaturedMechanic: string;
  stageDifficultyTier: StageDifficultyTier;
  isMilestoneHard: boolean;
  difficultyMode: DifficultyMode;
  girlEmotion: GirlEmotionState;
  shotsLimit: number;
  shotsRemaining: number;
  parShots: number;
  unlockedStage: number;
  globalUnlockedStage: number;
  isViewingLockedWorld: boolean;
  justCompletedWorld: boolean;
  transitionFromWorld: number;
  transitionToWorld: number;
  dailyCompletedToday: boolean;
  dailyLabel: string;
  loseReason: LoseReason;
  selectedPowerTarget: PowerKind;
  stageStars: Record<number, number>;
  coins: number;
  coinsEarnedLastWin: number;
  equippedAnimations: EquippedAnimations;
  equippedShooterIndex: number;
  storePowersInventory: Record<StorePowerKind, number>;
  storePowersBoughtCounts: Record<StorePowerKind, number>;
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  shotsFired: number;
  bubblesRemaining: number;
  missesCount: number;
  missThreshold: number;
  ceilingDrops: number;
  currentColor: BubbleColor;
  currentSpecial: BubbleSpecial;
  nextColor: BubbleColor;
  nextSpecial: BubbleSpecial;
  powerCharge: number; // 0 to 100
  starsEarned: number;
  aimAssistLength: 'short' | 'medium' | 'full';
  colorblindSymbols: boolean;
  cameraPreset: CameraPreset;
  muted: boolean;
  popups: FloatingScorePopup[];
  availablePowers: {
    bomb: number;
    rainbow: number;
    lightning: number;
    fireball: number;
  };
}

export const BUBBLE_PALETTE: Record<
  BubbleColor,
  { name: string; hex: string; num: number; symbol: string; darkHex: string }
> = {
  [BubbleColor.Ruby]: {
    name: 'Ruby',
    hex: '#ff1744',
    num: 0xff1744,
    symbol: '▲',
    darkHex: '#b71c1c',
  },
  [BubbleColor.Sapphire]: {
    name: 'Sapphire',
    hex: '#00b0ff',
    num: 0x00b0ff,
    symbol: '◆',
    darkHex: '#01579b',
  },
  [BubbleColor.Emerald]: {
    name: 'Emerald',
    hex: '#00e676',
    num: 0x00e676,
    symbol: '●',
    darkHex: '#00796b',
  },
  [BubbleColor.Topaz]: {
    name: 'Topaz',
    hex: '#ffd600',
    num: 0xffd600,
    symbol: '★',
    darkHex: '#f57f17',
  },
  [BubbleColor.Amethyst]: {
    name: 'Amethyst',
    hex: '#d500f9',
    num: 0xd500f9,
    symbol: '■',
    darkHex: '#6a1b9a',
  },
  [BubbleColor.Coral]: {
    name: 'Coral',
    hex: '#ff6d00',
    num: 0xff6d00,
    symbol: '✦',
    darkHex: '#bf360c',
  },
};

export const ALL_COLORS: BubbleColor[] = [
  BubbleColor.Ruby,
  BubbleColor.Sapphire,
  BubbleColor.Emerald,
  BubbleColor.Topaz,
  BubbleColor.Amethyst,
  BubbleColor.Coral,
];

export const ALL_STORE_POWERS: StorePowerKind[] = [
  'supernova',
  'aurora',
  'meteor',
  'crossbolt',
  'frostburst',
  'celestial_crown',
];
