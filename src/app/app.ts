import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { BubbleEngine } from './game/bubble-engine';
import {
  AnimCategory,
  BUBBLE_PALETTE,
  BubbleColor,
  BubbleSpecial,
  CameraPreset,
  CampaignStage,
  GameHudSnapshot,
  GameMode,
  GamePhase,
  PowerKind,
  StorePowerKind,
  StoreTabCategory,
  VaultSection,
  WorldInfo,
} from './game/bubble-types';
import {
  ASTRAL_PORTAL_IMAGE_URL,
  CAMPAIGN_STAGES,
  getStagesForWorldRoad,
  getTodayDisplayLabel,
  getWorldInfo,
  getWorldNumberForLevel,
  MAX_UNLIMITED_LEVELS,
  TOTAL_WORLDS,
} from './game/levels';
import { preloadSorceressGlb, SorceressPreviewStage } from './game/sorceress-rig';
import { SoundSynth } from './game/sound-synth';
import {
  ANIMATIONS_PER_CATEGORY,
  calculateStageCoinReward,
  EMOTE_CATEGORIES,
  EmoteCategoryDef,
  formatCoinAmount,
  getAnimationItemMeta,
  getDailyCoinRewardTiers,
  getShooterDesignMeta,
  SHOOTER_DESIGNS_COUNT,
  ShooterDesignMeta,
  STORE_CATEGORIES,
  STORE_POWER_DEFS,
  StoreAnimationMeta,
  StorePowerDef,
} from './game/store-catalog';

export interface RoadNodeView {
  stage: CampaignStage;
  stageIndex: number;
  xPct: number;
  yPct: number;
  svgX: number;
  svgY: number;
  unlocked: boolean;
  isCurrentUnlocked: boolean;
  isSelected: boolean;
  stars: number;
  girlOffsetSide: 'left' | 'right';
}

export interface StoreAnimCardView extends StoreAnimationMeta {
  owned: boolean;
  equipped: boolean;
  formattedPrice: string;
  canAfford: boolean;
}

export interface StorePowerCardView extends StorePowerDef {
  ownedCount: number;
  boughtCount: number;
  currentPrice: number;
  formattedPrice: string;
  canAfford: boolean;
  isLoadedInBubble: boolean;
}

export interface VaultEmoteCategoryView extends EmoteCategoryDef {
  ownedCount: number;
}

export interface StoreShooterCardView extends ShooterDesignMeta {
  owned: boolean;
  equipped: boolean;
  formattedPrice: string;
  canAfford: boolean;
}

const STORE_ITEMS_PER_PAGE = 25;
const STORE_TOTAL_PAGES = Math.ceil(ANIMATIONS_PER_CATEGORY / STORE_ITEMS_PER_PAGE); // 40 pages = 1,000 items

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(window:keydown)': 'onWindowKeyDown($event)',
  },
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('canvasMount', { static: true })
  canvasMountRef!: ElementRef<HTMLDivElement>;

  @ViewChild('roadScroll')
  roadScrollRef?: ElementRef<HTMLDivElement>;

  @ViewChild('menuGirlMount')
  menuGirlMountRef?: ElementRef<HTMLDivElement>;

  @ViewChild('storeGirlMount')
  storeGirlMountRef?: ElementRef<HTMLDivElement>;

  @ViewChild('vaultGirlMount')
  vaultGirlMountRef?: ElementRef<HTMLDivElement>;

  @ViewChild('victoryGirlMount')
  victoryGirlMountRef?: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly sound = inject(SoundSynth);
  private engine: BubbleEngine | null = null;
  private previewStage: SorceressPreviewStage | null = null;

  private introRafId = 0;
  private worldVideoRafId = 0;
  private endlessRevealTimer = 0;
  private roadScrollRaf = 0;
  private previewMountRaf = 0;
  private girlAnimIntervalId = 0;
  private worldSlideResetTimer = 0;
  private toastResetTimer = 0;
  private vaultToastTimer = 0;

  // Touch/Pointer Swipe Tracking for Worlds Carousel
  private worldPointerId: number | null = null;
  private worldSwipeStartX = 0;
  private worldSwipeMoved = false;

  readonly GamePhase = GamePhase;
  readonly GameMode = GameMode;
  readonly CameraPreset = CameraPreset;
  readonly BubbleSpecial = BubbleSpecial;
  readonly palette = BUBBLE_PALETTE;
  readonly totalWorldsCount = TOTAL_WORLDS;
  readonly maxUnlimitedLevels = MAX_UNLIMITED_LEVELS;
  readonly astralPortalImageUrl = ASTRAL_PORTAL_IMAGE_URL;
  readonly gameLogoUrl = '/src/assets/images/starbubble_realms_logo_1793106166316.jpg';
  readonly gameTitle = 'Magic Bubble Pop';
  readonly companyName = 'Playera';
  readonly packageName = 'com.playera.magicbubblepop';
  readonly appVersion = '1';
  readonly appVersionCode = 1;
  readonly storeCategories = STORE_CATEGORIES;
  readonly storeTotalPages = STORE_TOTAL_PAGES;
  readonly quickJumpAnimIndices = [0, 99, 249, 499, 749, 999];

  readonly loadingProgress = signal(0);
  readonly worldVideoProgress = signal(0);
  readonly showHowToPlay = signal(false);
  readonly hideEndlessOnTouch = signal(false);

  // 5 Live 3D Showcase Poses on the Level Road Menu + Celebrating Pose on Victory Screen
  readonly menuGirlAnimIdx = signal(0);
  readonly victoryGirlPoseOffset = signal(0);

  // Store Modal State (3D Shooters + Unlimited Store Powers + 1,000 Emotes per Category)
  readonly showStoreModal = signal(false);
  readonly activeStoreTab = signal<StoreTabCategory>('shooters');
  readonly storePage = signal(0);
  readonly previewAnimIndex = signal(0);
  readonly previewShooterIndex = signal(0);
  readonly storeVersionTick = signal(0);
  readonly storeToast = signal('');

  // Vault Modal State (Emotes by Category, 3D Shooters, and Purchased Store Powers)
  readonly showVaultModal = signal(false);
  readonly activeVaultSection = signal<VaultSection>('emotes');
  readonly activeVaultEmoteCat = signal<AnimCategory>('happy');
  readonly vaultPreviewIndex = signal(0);
  readonly vaultShooterPreviewIndex = signal(0);
  readonly vaultToast = signal('');

  // Minimalist Touch-Swipeable Worlds Explorer State (Worlds 1 .. 4,321)
  readonly showWorldsModal = signal(false);
  readonly browsingWorldNum = signal(1);
  readonly worldDragOffsetX = signal(0);
  readonly isWorldDragging = signal(false);
  readonly worldSlideClass = signal<'' | 'world-slide-next' | 'world-slide-prev'>('');

  readonly hud = signal<GameHudSnapshot>({
    phase: GamePhase.IntroLoading,
    mode: GameMode.Campaign,
    worldNumber: 1,
    worldName: 'Starlight Valley',
    worldHazard: 'Starlight Twin Ribbons',
    worldSignaturePower: 'bomb',
    stageNumber: 1,
    stageName: CAMPAIGN_STAGES[0].name,
    stageSubtitle: CAMPAIGN_STAGES[0].subtitle,
    stageBriefing: CAMPAIGN_STAGES[0].briefing,
    stageFeaturedMechanic: CAMPAIGN_STAGES[0].featuredMechanic,
    stageDifficultyTier: CAMPAIGN_STAGES[0].difficultyTier,
    isMilestoneHard: CAMPAIGN_STAGES[0].isMilestoneHard,
    difficultyMode: 'normal',
    girlEmotion: 'idle',
    shotsLimit: CAMPAIGN_STAGES[0].shotsLimit,
    shotsRemaining: CAMPAIGN_STAGES[0].shotsLimit,
    parShots: CAMPAIGN_STAGES[0].parShots,
    unlockedStage: 1,
    globalUnlockedStage: 1,
    isViewingLockedWorld: false,
    justCompletedWorld: false,
    transitionFromWorld: 1,
    transitionToWorld: 2,
    dailyCompletedToday: false,
    dailyLabel: getTodayDisplayLabel(),
    loseReason: 'out_of_bubbles',
    selectedPowerTarget: 'bomb',
    stageStars: {},
    coins: 0,
    coinsEarnedLastWin: 0,
    equippedAnimations: {
      idle: 0,
      shoot: 0,
      happy: 0,
      win: 0,
      angry: 0,
    },
    equippedShooterIndex: 0,
    storePowersInventory: {
      supernova: 0,
      aurora: 0,
      meteor: 0,
      crossbolt: 0,
      frostburst: 0,
      celestial_crown: 0,
    },
    storePowersBoughtCounts: {
      supernova: 0,
      aurora: 0,
      meteor: 0,
      crossbolt: 0,
      frostburst: 0,
      celestial_crown: 0,
    },
    score: 0,
    highScore: 0,
    combo: 0,
    maxCombo: 0,
    shotsFired: 0,
    bubblesRemaining: 36,
    missesCount: 0,
    missThreshold: 6,
    ceilingDrops: 0,
    currentColor: BubbleColor.Ruby,
    currentSpecial: BubbleSpecial.None,
    nextColor: BubbleColor.Sapphire,
    nextSpecial: BubbleSpecial.None,
    powerCharge: 30,
    starsEarned: 3,
    aimAssistLength: 'medium',
    colorblindSymbols: false,
    cameraPreset: CameraPreset.Arcade,
    muted: false,
    popups: [],
    availablePowers: {
      bomb: 0,
      rainbow: 0,
      lightning: 0,
      fireball: 0,
    },
  });

  // Memoized stage-road inputs so score/popup ticks during gameplay NEVER recompute world stages!
  private readonly roadWorldNum = computed(() => this.hud().worldNumber);
  private readonly roadStageNum = computed(() => this.hud().stageNumber);
  private readonly roadDiffMode = computed(() => this.hud().difficultyMode);
  private readonly roadUnlockedStage = computed(() => this.hud().unlockedStage);
  private readonly roadStageStars = computed(() => this.hud().stageStars);

  readonly loadingStatusText = computed(() => {
    const pct = this.loadingProgress();
    if (pct < 26) return 'Loading 3D Sorceress & Custom Shooters';
    if (pct < 54) return 'Awakening 4,321 Starbubble Realms';
    if (pct < 82) return 'Preparing Store, Emotes Vault & Audio';
    if (pct < 96) return 'Illuminating Starlight Level Road';
    return 'Ready to Enter Starbubble Realms';
  });

  readonly currentWorldInfo = computed<WorldInfo>(() => {
    return getWorldInfo(this.roadWorldNum());
  });

  readonly worldCoinPreview = computed(() => {
    const w = this.roadWorldNum();
    return {
      three: calculateStageCoinReward(w, 3),
      two: calculateStageCoinReward(w, 2),
      one: calculateStageCoinReward(w, 1),
    };
  });

  readonly dailyCoinTiersPreview = computed(() => {
    const playerWorld = getWorldNumberForLevel(this.hud().globalUnlockedStage);
    const [low, mid, high] = getDailyCoinRewardTiers(playerWorld);
    return {
      world: playerWorld,
      low: formatCoinAmount(low),
      mid: formatCoinAmount(mid),
      high: formatCoinAmount(high),
    };
  });

  readonly currentRoadBgGradient = computed(() => {
    const w = this.currentWorldInfo();
    return `radial-gradient(circle at 50% 14%, ${w.bgTopHex} 0%, ${w.bgBottomHex} 78%, #050811 100%)`;
  });

  readonly currentWorldImgFilter = computed(() => {
    const deg = this.currentWorldInfo().imageHueRotateDeg;
    return deg ? `hue-rotate(${deg}deg) saturate(1.1)` : 'saturate(1.06)';
  });

  readonly browsedWorld = computed<WorldInfo>(() => {
    return getWorldInfo(this.browsingWorldNum());
  });

  readonly browsedWorldBgGradient = computed(() => {
    const w = this.browsedWorld();
    return `radial-gradient(circle at 50% 35%, ${w.bgTopHex} 0%, ${w.bgBottomHex} 72%, #04070f 100%)`;
  });

  readonly browsedWorldImgFilter = computed(() => {
    const deg = this.browsedWorld().imageHueRotateDeg;
    return deg ? `hue-rotate(${deg}deg) saturate(1.12)` : 'saturate(1.06)';
  });

  readonly isBrowsedWorldUnlocked = computed(() => {
    return this.browsedWorld().startLevel <= this.hud().globalUnlockedStage;
  });

  readonly transitionFromWorldInfo = computed<WorldInfo>(() => {
    return getWorldInfo(this.hud().transitionFromWorld);
  });

  readonly transitionToWorldInfo = computed<WorldInfo>(() => {
    return getWorldInfo(this.hud().transitionToWorld);
  });

  readonly worldFlightAct = computed<1 | 2 | 3>(() => {
    const pct = this.worldVideoProgress();
    if (pct < 28) return 1;
    if (pct < 70) return 2;
    return 3;
  });

  readonly worldFlightCaption = computed(() => {
    const act = this.worldFlightAct();
    const fromW = this.transitionFromWorldInfo();
    const toW = this.transitionToWorldInfo();
    if (act === 1) {
      return `World ${fromW.worldNumber} (${fromW.name}) Complete · Taking Flight!`;
    }
    if (act === 2) {
      return `Soaring Across the Celestial Bridge Toward World ${toW.worldNumber}...`;
    }
    return `World ${toW.worldNumber}: ${toW.name} Unlocked!`;
  });

  readonly worldCardTransform = computed(() => {
    const dx = this.worldDragOffsetX();
    if (!this.isWorldDragging() || dx === 0) {
      return 'translate3d(0px, 0px, 0px) rotate(0deg)';
    }
    const tilt = Math.max(-7, Math.min(7, dx * 0.032));
    return `translate3d(${dx.toFixed(1)}px, 0px, 0px) rotate(${tilt.toFixed(2)}deg)`;
  });

  readonly foulPipArray = computed(() => {
    const snap = this.hud();
    const arr: boolean[] = [];
    for (let i = 0; i < snap.missThreshold; i++) {
      arr.push(i < snap.missesCount);
    }
    return arr;
  });

  readonly worldStages = computed<CampaignStage[]>(() => {
    return getStagesForWorldRoad(
      this.roadWorldNum(),
      this.roadStageNum(),
      this.roadDiffMode(),
    );
  });

  readonly roadHeightPx = computed(() => {
    const count = this.worldStages().length;
    return Math.max(1240, count * 96);
  });

  readonly roadSvgViewBox = computed(() => {
    return `0 0 400 ${this.roadHeightPx()}`;
  });

  readonly currentWorldStarsEarned = computed(() => {
    const starsMap = this.roadStageStars();
    const stages = this.worldStages();
    let sum = 0;
    for (const stg of stages) {
      sum += starsMap[stg.stageNumber] ?? 0;
    }
    return sum;
  });

  readonly roadNodes = computed<RoadNodeView[]>(() => {
    const unlockedMax = this.roadUnlockedStage();
    const selectedNum = this.roadStageNum();
    const starsMap = this.roadStageStars();
    const stages = this.worldStages();
    const count = stages.length;
    const totalH = this.roadHeightPx();

    return stages.map((stage, idx) => {
      const yPct = 92 - (idx / Math.max(1, count - 1)) * 84.5;
      const xPct = stage.roadX;
      return {
        stage,
        stageIndex: stage.stageNumber - 1,
        xPct,
        yPct,
        svgX: (xPct / 100) * 400,
        svgY: (yPct / 100) * totalH,
        unlocked: stage.stageNumber <= unlockedMax,
        isCurrentUnlocked: stage.stageNumber === unlockedMax,
        isSelected: selectedNum === stage.stageNumber,
        stars: starsMap[stage.stageNumber] ?? 0,
        girlOffsetSide: xPct > 54 ? 'left' : 'right',
      };
    });
  });

  readonly selectedRoadNode = computed<RoadNodeView>(() => {
    const nodes = this.roadNodes();
    return nodes.find((n) => n.isSelected) ?? nodes[0];
  });

  readonly fullRoadSvgPath = computed(() => {
    const nodes = this.roadNodes();
    if (nodes.length === 0) return '';
    let d = `M ${nodes[0].svgX.toFixed(1)} ${nodes[0].svgY.toFixed(1)}`;
    for (let i = 0; i < nodes.length - 1; i++) {
      const curr = nodes[i];
      const next = nodes[i + 1];
      const midY = ((curr.svgY + next.svgY) * 0.5).toFixed(1);
      d += ` C ${curr.svgX.toFixed(1)} ${midY}, ${next.svgX.toFixed(1)} ${midY}, ${next.svgX.toFixed(1)} ${next.svgY.toFixed(1)}`;
    }
    return d;
  });

  readonly unlockedRoadSvgPath = computed(() => {
    const nodes = this.roadNodes();
    const unlockedNodes = nodes.filter((n) => n.unlocked);
    if (unlockedNodes.length <= 1) return '';
    let d = `M ${unlockedNodes[0].svgX.toFixed(1)} ${unlockedNodes[0].svgY.toFixed(1)}`;
    for (let i = 0; i < unlockedNodes.length - 1; i++) {
      const curr = unlockedNodes[i];
      const next = unlockedNodes[i + 1];
      const midY = ((curr.svgY + next.svgY) * 0.5).toFixed(1);
      d += ` C ${curr.svgX.toFixed(1)} ${midY}, ${next.svgX.toFixed(1)} ${midY}, ${next.svgX.toFixed(1)} ${next.svgY.toFixed(1)}`;
    }
    return d;
  });

  // =========================================================================
  // STORE, VAULT & DUAL GAMEPLAY POWERS COMPUTED VIEWS
  // =========================================================================

  readonly activeAnimCategory = computed<AnimCategory>(() => {
    const tab = this.activeStoreTab();
    return tab === 'powers' || tab === 'shooters' ? 'happy' : tab;
  });

  readonly storeRangeStart = computed(() => {
    return this.storePage() * STORE_ITEMS_PER_PAGE + 1;
  });

  readonly storeRangeEnd = computed(() => {
    return Math.min(ANIMATIONS_PER_CATEGORY, (this.storePage() + 1) * STORE_ITEMS_PER_PAGE);
  });

  readonly storeVisibleAnimations = computed<StoreAnimCardView[]>(() => {
    this.storeVersionTick();
    const snap = this.hud();
    const cat = this.activeAnimCategory();
    const page = this.storePage();
    const startIdx = page * STORE_ITEMS_PER_PAGE;
    const endIdx = Math.min(ANIMATIONS_PER_CATEGORY, startIdx + STORE_ITEMS_PER_PAGE);
    const equippedIdx = snap.equippedAnimations[cat];
    const items: StoreAnimCardView[] = [];

    for (let idx = startIdx; idx < endIdx; idx++) {
      const meta = getAnimationItemMeta(cat, idx);
      const owned = this.engine ? this.engine.isAnimationOwned(cat, idx) : idx === 0;
      items.push({
        ...meta,
        owned,
        equipped: equippedIdx === idx,
        formattedPrice: meta.price === 0 ? 'Free' : formatCoinAmount(meta.price),
        canAfford: snap.coins >= meta.price,
      });
    }
    return items;
  });

  readonly previewedAnimCard = computed<StoreAnimCardView>(() => {
    this.storeVersionTick();
    const snap = this.hud();
    const cat = this.activeAnimCategory();
    const idx = this.previewAnimIndex();
    const meta = getAnimationItemMeta(cat, idx);
    const owned = this.engine ? this.engine.isAnimationOwned(cat, idx) : idx === 0;
    return {
      ...meta,
      owned,
      equipped: snap.equippedAnimations[cat] === idx,
      formattedPrice: meta.price === 0 ? 'Free' : formatCoinAmount(meta.price),
      canAfford: snap.coins >= meta.price,
    };
  });

  readonly storeShooterCards = computed<StoreShooterCardView[]>(() => {
    this.storeVersionTick();
    const snap = this.hud();
    const cards: StoreShooterCardView[] = [];
    for (let idx = 0; idx < SHOOTER_DESIGNS_COUNT; idx++) {
      const meta = getShooterDesignMeta(idx);
      const owned = this.engine ? this.engine.isShooterOwned(idx) : idx === 0;
      cards.push({
        ...meta,
        owned,
        equipped: snap.equippedShooterIndex === idx,
        formattedPrice: meta.price === 0 ? 'Starter' : formatCoinAmount(meta.price),
        canAfford: snap.coins >= meta.price,
      });
    }
    return cards;
  });

  readonly previewedShooterCard = computed<StoreShooterCardView>(() => {
    const all = this.storeShooterCards();
    const idx = this.previewShooterIndex();
    return all[idx] ?? all[0];
  });

  readonly vaultOwnedShooters = computed<StoreShooterCardView[]>(() => {
    return this.storeShooterCards().filter((s) => s.owned);
  });

  readonly vaultPreviewedShooter = computed<StoreShooterCardView>(() => {
    const owned = this.vaultOwnedShooters();
    const targetIdx = this.vaultShooterPreviewIndex();
    return owned.find((s) => s.index === targetIdx) ?? owned[0];
  });

  readonly storePowerCards = computed<StorePowerCardView[]>(() => {
    this.storeVersionTick();
    const snap = this.hud();
    return STORE_POWER_DEFS.map((def) => {
      const currentPrice = this.engine
        ? this.engine.getStorePowerCurrentPrice(def.id)
        : Math.round(100 * Math.pow(1.9, def.powerIndex));
      return {
        ...def,
        ownedCount: snap.storePowersInventory[def.id] ?? 0,
        boughtCount: snap.storePowersBoughtCounts[def.id] ?? 0,
        currentPrice,
        formattedPrice: formatCoinAmount(currentPrice),
        canAfford: snap.coins >= currentPrice,
        isLoadedInBubble: snap.currentSpecial === def.special,
      };
    });
  });

  /**
   * Vault Emote Sub-Categories with Emote Icons & Owned Counts
   * (Happy -> Happy Emotes, Idle Pose -> Idle Emotes, Victory -> Victory Emotes, etc.)
   */
  readonly vaultEmoteCategories = computed<VaultEmoteCategoryView[]>(() => {
    this.storeVersionTick();
    this.hud();
    return EMOTE_CATEGORIES.map((cat) => ({
      ...cat,
      ownedCount: this.engine ? this.engine.getOwnedAnimationIndices(cat.id).length : 1,
    }));
  });

  readonly activeVaultEmoteCategoryMeta = computed<VaultEmoteCategoryView>(() => {
    const cats = this.vaultEmoteCategories();
    const activeId = this.activeVaultEmoteCat();
    return cats.find((c) => c.id === activeId) ?? cats[0];
  });

  readonly vaultOwnedEmotes = computed<StoreAnimCardView[]>(() => {
    this.storeVersionTick();
    const snap = this.hud();
    const cat = this.activeVaultEmoteCat();
    const indices = this.engine ? this.engine.getOwnedAnimationIndices(cat) : [0];
    const equippedIdx = snap.equippedAnimations[cat];
    return indices.map((idx) => {
      const meta = getAnimationItemMeta(cat, idx);
      return {
        ...meta,
        owned: true,
        equipped: equippedIdx === idx,
        formattedPrice: meta.price === 0 ? 'Starter' : formatCoinAmount(meta.price),
        canAfford: true,
      };
    });
  });

  readonly vaultPreviewedEmote = computed<StoreAnimCardView>(() => {
    const list = this.vaultOwnedEmotes();
    const targetIdx = this.vaultPreviewIndex();
    return list.find((item) => item.index === targetIdx) ?? list[0];
  });

  /**
   * Vault Purchased Store Powers — shows every power bought from Store
   * and how many times each power can be used (`ownedCount` uses remaining)!
   */
  readonly vaultPurchasedPowers = computed<StorePowerCardView[]>(() => {
    return this.storePowerCards().filter((p) => p.ownedCount > 0 || p.boughtCount > 0);
  });

  readonly totalStorePowerUses = computed(() => {
    return this.storePowerCards().reduce((acc, p) => acc + p.ownedCount, 0);
  });

  /**
   * Store Powers owned by the player (or currently loaded in the shooter bubble)
   * shown in the bottom power bar during Gameplay alongside World Powers!
   */
  readonly ownedStorePowersForPlay = computed<StorePowerCardView[]>(() => {
    return this.storePowerCards().filter(
      (p) => p.ownedCount > 0 || p.isLoadedInBubble,
    );
  });

  formatCoins(amount: number): string {
    return formatCoinAmount(amount);
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    void preloadSorceressGlb();

    this.previewStage = new SorceressPreviewStage();

    let prevPhase = this.hud().phase;
    let prevWorld = this.hud().worldNumber;
    let prevStage = this.hud().stageNumber;

    this.engine = new BubbleEngine(
      this.canvasMountRef.nativeElement,
      this.sound,
      (snapshot) => {
        const phaseChanged = snapshot.phase !== prevPhase;
        const stageChangedOnRoad =
          snapshot.phase === GamePhase.LevelRoad && snapshot.stageNumber !== prevStage;
        const enteringRoad =
          snapshot.phase === GamePhase.LevelRoad &&
          (prevPhase !== GamePhase.LevelRoad || prevWorld !== snapshot.worldNumber);
        const enteringWorldFlight =
          snapshot.phase === GamePhase.WorldTransition &&
          prevPhase !== GamePhase.WorldTransition;
        const enteringVictory =
          snapshot.phase === GamePhase.Victory && prevPhase !== GamePhase.Victory;

        prevPhase = snapshot.phase;
        prevWorld = snapshot.worldNumber;
        prevStage = snapshot.stageNumber;
        this.hud.set(snapshot);

        if (enteringVictory) {
          this.victoryGirlPoseOffset.set(0);
        }
        if (enteringWorldFlight) {
          this.startWorldFlightVideo();
        }
        if (enteringRoad || stageChangedOnRoad) {
          this.scheduleScrollToActiveRoadNode();
        }
        if (phaseChanged || stageChangedOnRoad) {
          this.schedulePreviewStageSync();
        }
      },
    );

    this.startIntroSequence();

    // Automatically cycle through 5 live 3D Magic Girl poses on the Level Road Menu
    this.girlAnimIntervalId = window.setInterval(() => {
      if (
        this.hud().phase === GamePhase.LevelRoad &&
        !this.showWorldsModal() &&
        !this.showStoreModal() &&
        !this.showVaultModal() &&
        !this.showHowToPlay()
      ) {
        this.menuGirlAnimIdx.update((idx) => (idx + 1) % 5);
        this.applyMenuGirlPose();
      }
    }, 3800);
  }

  ngOnDestroy(): void {
    if (this.introRafId) cancelAnimationFrame(this.introRafId);
    if (this.worldVideoRafId) cancelAnimationFrame(this.worldVideoRafId);
    if (this.roadScrollRaf) cancelAnimationFrame(this.roadScrollRaf);
    if (this.previewMountRaf) cancelAnimationFrame(this.previewMountRaf);
    if (this.endlessRevealTimer) window.clearTimeout(this.endlessRevealTimer);
    if (this.girlAnimIntervalId) window.clearInterval(this.girlAnimIntervalId);
    if (this.worldSlideResetTimer) window.clearTimeout(this.worldSlideResetTimer);
    if (this.toastResetTimer) window.clearTimeout(this.toastResetTimer);
    if (this.vaultToastTimer) window.clearTimeout(this.vaultToastTimer);

    this.previewStage?.destroy();
    this.previewStage = null;

    this.engine?.destroy();
    this.engine = null;
  }

  /**
   * Attaches the single shared 3D GLB SorceressPreviewStage to:
   * 1. Store Live 3D Preview (#storeGirlMount) when Store is open,
   * 2. Vault Live 3D Preview (#vaultGirlMount) when Vault is open,
   * 3. Victory Celebration Stage (#victoryGirlMount) when Level Win screen is shown,
   * 4. Level Road Active Node (#menuGirlMount) when on Level Road,
   * 5. Paused (0% GPU cost) during active Gameplay!
   */
  private schedulePreviewStageSync(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.previewMountRaf) cancelAnimationFrame(this.previewMountRaf);
    this.previewMountRaf = requestAnimationFrame(() => {
      this.previewMountRaf = 0;
      if (!this.previewStage) return;

      if (this.showStoreModal()) {
        const host = this.storeGirlMountRef?.nativeElement ?? null;
        if (host) {
          const w = host.clientWidth || 190;
          const h = host.clientHeight || 220;
          this.previewStage.attachTo(host, w, h);
          const tab = this.activeStoreTab();
          if (tab === 'powers') {
            this.previewStage.previewAnimation('happy', this.hud().equippedAnimations.happy);
          } else if (tab === 'shooters') {
            this.previewStage.previewShooter(this.previewShooterIndex(), true);
          } else {
            this.previewStage.previewAnimation(tab, this.previewAnimIndex());
          }
          return;
        }
      }

      if (this.showVaultModal()) {
        const host = this.vaultGirlMountRef?.nativeElement ?? null;
        if (host) {
          const w = host.clientWidth || 190;
          const h = host.clientHeight || 220;
          this.previewStage.attachTo(host, w, h);
          const section = this.activeVaultSection();
          if (section === 'emotes') {
            this.previewStage.previewAnimation(
              this.activeVaultEmoteCat(),
              this.vaultPreviewedEmote().index,
            );
          } else if (section === 'shooters') {
            this.previewStage.previewShooter(this.vaultPreviewedShooter().index, true);
          } else {
            this.previewStage.previewAnimation('happy', this.hud().equippedAnimations.happy);
          }
          return;
        }
      }

      if (this.hud().phase === GamePhase.Victory) {
        const host = this.victoryGirlMountRef?.nativeElement ?? null;
        if (host) {
          const w = host.clientWidth || 136;
          const h = host.clientHeight || 152;
          this.previewStage.attachTo(host, w, h);
          const winIdx =
            (this.hud().equippedAnimations.win + this.victoryGirlPoseOffset()) %
            ANIMATIONS_PER_CATEGORY;
          this.previewStage.previewAnimation('win', winIdx);
          return;
        }
      }

      if (
        this.hud().phase === GamePhase.LevelRoad &&
        !this.showWorldsModal() &&
        !this.showHowToPlay()
      ) {
        const host = this.menuGirlMountRef?.nativeElement ?? null;
        if (host) {
          const w = host.clientWidth || 70;
          const h = host.clientHeight || 88;
          this.previewStage.attachTo(host, w, h);
          this.applyMenuGirlPose();
          return;
        }
      }

      this.previewStage.attachTo(null, 0, 0);
    });
  }

  private applyMenuGirlPose(): void {
    if (!this.previewStage || this.showStoreModal() || this.showVaultModal()) return;
    const eq = this.hud().equippedAnimations;
    const slot = this.menuGirlAnimIdx() % 5;
    if (slot === 0) {
      this.previewStage.previewAnimation('idle', eq.idle);
    } else if (slot === 1) {
      this.previewStage.previewAnimation('happy', eq.happy || 2);
    } else if (slot === 2) {
      this.previewStage.previewAnimation('shoot', eq.shoot || 1);
    } else if (slot === 3) {
      this.previewStage.previewAnimation('win', eq.win || 3);
    } else {
      this.previewStage.previewAnimation('idle', (eq.idle + 4) % ANIMATIONS_PER_CATEGORY);
    }
  }

  celebrateVictoryGirl(event?: Event): void {
    event?.stopPropagation();
    const nextOffset = (this.victoryGirlPoseOffset() + 1) % 5;
    this.victoryGirlPoseOffset.set(nextOffset);
    const winIdx = (this.hud().equippedAnimations.win + nextOffset) % ANIMATIONS_PER_CATEGORY;
    this.previewStage?.previewAnimation('win', winIdx);
    this.sound.playEmoteSound('win', winIdx);
  }

  private startIntroSequence(): void {
    const durationMs = 3500;
    const startTime = performance.now();

    const step = (now: number) => {
      if (this.hud().phase !== GamePhase.IntroLoading) {
        this.loadingProgress.set(100);
        return;
      }
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      this.loadingProgress.set(Math.min(100, Math.round(eased * 100)));

      if (t < 1) {
        this.introRafId = requestAnimationFrame(step);
      } else {
        this.finishIntroLoading();
      }
    };

    this.introRafId = requestAnimationFrame(step);
  }

  finishIntroLoading(): void {
    if (this.introRafId) {
      cancelAnimationFrame(this.introRafId);
      this.introRafId = 0;
    }
    this.sound.unlockAudio();
    this.loadingProgress.set(100);
    this.engine?.completeIntroLoading();
    this.scheduleScrollToActiveRoadNode();
    this.schedulePreviewStageSync();
  }

  private startWorldFlightVideo(): void {
    if (this.worldVideoRafId) {
      cancelAnimationFrame(this.worldVideoRafId);
      this.worldVideoRafId = 0;
    }
    this.worldVideoProgress.set(0);
    const durationMs = 8600;
    const startTime = performance.now();

    const tick = (now: number) => {
      if (this.hud().phase !== GamePhase.WorldTransition) {
        return;
      }
      const elapsed = now - startTime;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      this.worldVideoProgress.set(pct);

      if (pct < 100) {
        this.worldVideoRafId = requestAnimationFrame(tick);
      } else {
        this.finishWorldFlightVideo();
      }
    };

    this.worldVideoRafId = requestAnimationFrame(tick);
  }

  finishWorldFlightVideo(event?: Event): void {
    event?.stopPropagation();
    if (this.worldVideoRafId) {
      cancelAnimationFrame(this.worldVideoRafId);
      this.worldVideoRafId = 0;
    }
    this.worldVideoProgress.set(100);
    this.engine?.finishWorldTransitionCutscene();
    this.scheduleScrollToActiveRoadNode();
    this.schedulePreviewStageSync();
  }

  watchWorldFlightReplay(event: Event): void {
    event.stopPropagation();
    const targetW = this.browsingWorldNum();
    if (targetW < 2) return;
    this.showWorldsModal.set(false);
    this.engine?.playWorldFlightPreview(targetW - 1, targetW);
    this.schedulePreviewStageSync();
  }

  private scheduleScrollToActiveRoadNode(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.roadScrollRaf) cancelAnimationFrame(this.roadScrollRaf);
    this.roadScrollRaf = requestAnimationFrame(() => {
      const container = this.roadScrollRef?.nativeElement;
      if (!container) return;
      const active = this.selectedRoadNode();
      if (!active) return;
      const targetPixelY = (active.yPct / 100) * container.scrollHeight;
      const desiredScrollTop = Math.max(0, targetPixelY - container.clientHeight * 0.6);
      container.scrollTop = desiredScrollTop;
    });
  }

  cycleMenuGirlAnim(event?: Event): void {
    event?.stopPropagation();
    const nextIdx = (this.menuGirlAnimIdx() + 1) % 5;
    this.menuGirlAnimIdx.set(nextIdx);
    this.applyMenuGirlPose();

    const eq = this.hud().equippedAnimations;
    if (nextIdx === 1) {
      this.sound.playEmoteSound('happy', eq.happy);
    } else if (nextIdx === 2) {
      this.sound.playEmoteSound('shoot', eq.shoot);
    } else if (nextIdx === 3) {
      this.sound.playEmoteSound('win', eq.win);
    } else {
      this.sound.playEmoteSound('idle', eq.idle);
    }
  }

  onRoadScreenTouchStart(): void {
    if (this.endlessRevealTimer) {
      window.clearTimeout(this.endlessRevealTimer);
      this.endlessRevealTimer = 0;
    }
    this.hideEndlessOnTouch.set(true);
  }

  onRoadScreenScroll(): void {
    this.onRoadScreenTouchStart();
    this.scheduleEndlessIconReturn();
  }

  onRoadScreenTouchEnd(): void {
    this.scheduleEndlessIconReturn();
  }

  private scheduleEndlessIconReturn(): void {
    if (this.endlessRevealTimer) {
      window.clearTimeout(this.endlessRevealTimer);
    }
    this.endlessRevealTimer = window.setTimeout(() => {
      this.hideEndlessOnTouch.set(false);
      this.endlessRevealTimer = 0;
    }, 1700);
  }

  // =========================================================================
  // VAULT MODAL CONTROLS (1st Option: Emotes w/ Icons; 2nd Option: Powers!)
  // =========================================================================

  openVaultModal(event?: Event, initialSection: VaultSection = 'emotes'): void {
    event?.stopPropagation();
    this.showHowToPlay.set(false);
    this.showWorldsModal.set(false);
    this.showStoreModal.set(false);
    this.activeVaultSection.set(initialSection);
    const cat = this.activeVaultEmoteCat();
    this.vaultPreviewIndex.set(this.hud().equippedAnimations[cat]);
    this.vaultShooterPreviewIndex.set(this.hud().equippedShooterIndex);
    this.vaultToast.set('');
    this.showVaultModal.set(true);
    this.sound.playVaultOpen();
    this.schedulePreviewStageSync();
  }

  closeVaultModal(event?: Event): void {
    event?.stopPropagation();
    this.showVaultModal.set(false);
    this.vaultToast.set('');
    this.sound.playSwap();
    this.schedulePreviewStageSync();
  }

  selectVaultSection(section: VaultSection): void {
    this.activeVaultSection.set(section);
    if (section === 'emotes') {
      const cat = this.activeVaultEmoteCat();
      const eqIdx = this.hud().equippedAnimations[cat];
      this.vaultPreviewIndex.set(eqIdx);
      this.sound.playEmoteSound(cat, eqIdx);
    } else if (section === 'shooters') {
      this.vaultShooterPreviewIndex.set(this.hud().equippedShooterIndex);
      this.sound.playSwap();
    } else {
      this.sound.playSwap();
    }
    this.schedulePreviewStageSync();
  }

  selectVaultEmoteCategory(cat: AnimCategory): void {
    this.activeVaultEmoteCat.set(cat);
    const eqIdx = this.hud().equippedAnimations[cat];
    this.vaultPreviewIndex.set(eqIdx);
    this.sound.playEmoteSound(cat, eqIdx);
    this.schedulePreviewStageSync();
  }

  previewVaultEmote(index: number): void {
    this.vaultPreviewIndex.set(index);
    const cat = this.activeVaultEmoteCat();
    this.previewStage?.previewAnimation(cat, index);
    this.sound.playEmoteSound(cat, index);
  }

  equipVaultEmote(index: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.engine) return;
    const cat = this.activeVaultEmoteCat();
    this.vaultPreviewIndex.set(index);
    this.previewStage?.previewAnimation(cat, index);
    const ok = this.engine.equipOwnedAnimation(cat, index);
    this.storeVersionTick.update((v) => v + 1);
    if (ok) {
      this.showVaultFeedback(`Equipped Emote #${index + 1}!`);
    }
  }

  previewVaultShooter(index: number): void {
    this.vaultShooterPreviewIndex.set(index);
    this.previewStage?.previewShooter(index, true);
    this.sound.playShooterPreviewFire();
  }

  equipVaultShooter(index: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.engine) return;
    this.vaultShooterPreviewIndex.set(index);
    this.previewStage?.previewShooter(index, true);
    const ok = this.engine.equipOwnedShooter(index);
    this.storeVersionTick.update((v) => v + 1);
    if (ok) {
      const meta = getShooterDesignMeta(index);
      this.showVaultFeedback(`Equipped ${meta.name}!`);
    }
  }

  openStoreFromVault(tab: StoreTabCategory, event?: Event): void {
    event?.stopPropagation();
    this.showVaultModal.set(false);
    this.openStoreModal(undefined, tab);
  }

  private showVaultFeedback(msg: string): void {
    this.vaultToast.set(msg);
    if (this.vaultToastTimer) window.clearTimeout(this.vaultToastTimer);
    this.vaultToastTimer = window.setTimeout(() => {
      this.vaultToast.set('');
      this.vaultToastTimer = 0;
    }, 2400);
  }

  // =========================================================================
  // MAGIC STORE MODAL CONTROLS (3D SHOOTERS + 5,000 EMOTES + STORE POWERS)
  // =========================================================================

  openStoreModal(event?: Event, initialTab?: StoreTabCategory): void {
    event?.stopPropagation();
    this.showHowToPlay.set(false);
    this.showWorldsModal.set(false);
    this.showVaultModal.set(false);
    const tab = initialTab ?? this.activeStoreTab();
    this.activeStoreTab.set(tab);
    if (tab === 'shooters') {
      this.previewShooterIndex.set(this.hud().equippedShooterIndex);
    } else if (tab !== 'powers') {
      const eqIdx = this.hud().equippedAnimations[tab];
      this.previewAnimIndex.set(eqIdx);
      this.storePage.set(Math.floor(eqIdx / STORE_ITEMS_PER_PAGE));
    }
    this.storeToast.set('');
    this.showStoreModal.set(true);
    this.sound.playSwap();
    this.schedulePreviewStageSync();
  }

  closeStoreModal(event?: Event): void {
    event?.stopPropagation();
    this.showStoreModal.set(false);
    this.storeToast.set('');
    this.sound.playSwap();
    this.schedulePreviewStageSync();
  }

  selectStoreTab(tab: StoreTabCategory): void {
    this.activeStoreTab.set(tab);
    if (tab === 'shooters') {
      this.previewShooterIndex.set(this.hud().equippedShooterIndex);
      this.sound.playSwap();
    } else if (tab !== 'powers') {
      const eqIdx = this.hud().equippedAnimations[tab];
      this.previewAnimIndex.set(eqIdx);
      this.storePage.set(Math.floor(eqIdx / STORE_ITEMS_PER_PAGE));
      this.sound.playEmoteSound(tab, eqIdx);
    } else {
      this.sound.playSwap();
    }
    this.schedulePreviewStageSync();
  }

  stepStorePage(delta: -1 | 1): void {
    const next = Math.max(0, Math.min(STORE_TOTAL_PAGES - 1, this.storePage() + delta));
    if (next === this.storePage()) return;
    this.storePage.set(next);
    const firstIdx = next * STORE_ITEMS_PER_PAGE;
    this.previewStoreAnimation(firstIdx, false);
    this.sound.playSwap();
  }

  jumpToStoreAnim(index: number): void {
    const clamped = Math.max(0, Math.min(ANIMATIONS_PER_CATEGORY - 1, index));
    this.storePage.set(Math.floor(clamped / STORE_ITEMS_PER_PAGE));
    this.previewStoreAnimation(clamped, true);
  }

  previewStoreAnimation(index: number, playEmoteSfx = true): void {
    const clamped = Math.max(0, Math.min(ANIMATIONS_PER_CATEGORY - 1, index));
    this.previewAnimIndex.set(clamped);
    const tab = this.activeStoreTab();
    if (tab !== 'powers' && tab !== 'shooters') {
      this.previewStage?.previewAnimation(tab, clamped);
      if (playEmoteSfx) {
        this.sound.playEmoteSound(tab, clamped);
      }
    }
  }

  previewStoreShooter(index: number): void {
    const clamped = Math.max(0, Math.min(SHOOTER_DESIGNS_COUNT - 1, index));
    this.previewShooterIndex.set(clamped);
    this.previewStage?.previewShooter(clamped, true);
    this.sound.playShooterPreviewFire();
  }

  triggerShooterPreviewShot(event?: Event): void {
    event?.stopPropagation();
    this.previewStage?.triggerShooterShot();
    this.sound.playShooterPreviewFire();
  }

  buyOrEquipStoreShooter(index: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.engine) return;
    const clamped = Math.max(0, Math.min(SHOOTER_DESIGNS_COUNT - 1, index));
    this.previewShooterIndex.set(clamped);
    this.previewStage?.previewShooter(clamped, true);

    const result = this.engine.buyOrEquipShooter(clamped);
    this.storeVersionTick.update((v) => v + 1);
    const meta = getShooterDesignMeta(clamped);

    if (result === 'bought_and_equipped') {
      this.showStoreFeedback(`OWNED & Equipped ${meta.name} (Saved in Vault)!`);
    } else if (result === 'equipped') {
      this.showStoreFeedback(`OWNED · Equipped ${meta.name}`);
    } else {
      this.showStoreFeedback(`Need ${formatCoinAmount(meta.price)} Coins to unlock ${meta.name}!`);
    }
  }

  buyOrEquipStoreAnimation(index: number, event?: Event): void {
    event?.stopPropagation();
    if (!this.engine) return;
    const cat = this.activeAnimCategory();
    this.previewAnimIndex.set(index);
    this.previewStage?.previewAnimation(cat, index);

    const result = this.engine.buyOrEquipAnimation(cat, index);
    this.storeVersionTick.update((v) => v + 1);

    if (result === 'bought_and_equipped') {
      this.showStoreFeedback(`OWNED & Equipped Emote #${index + 1} (Added to Vault)!`);
    } else if (result === 'equipped') {
      this.showStoreFeedback(`OWNED · Equipped Emote #${index + 1}`);
    } else {
      this.showStoreFeedback('Win more levels to earn Coins for this Emote!');
    }
  }

  buyStorePowerItem(kind: StorePowerKind, event?: Event): void {
    event?.stopPropagation();
    if (!this.engine) return;
    const ok = this.engine.buyStorePower(kind);
    this.storeVersionTick.update((v) => v + 1);

    if (ok) {
      const totalUses = this.hud().storePowersInventory[kind] ?? 1;
      this.previewStage?.previewAnimation('win', this.hud().equippedAnimations.win);
      this.showStoreFeedback(`+1 Use Added! Ready to use ×${totalUses} times in Vault & Play!`);
    } else {
      this.showStoreFeedback('Not enough Coins yet — clear levels to earn more Coins!');
    }
  }

  equipStorePowerDuringPlay(kind: StorePowerKind): void {
    this.engine?.equipStorePowerInGame(kind);
    this.storeVersionTick.update((v) => v + 1);
  }

  private showStoreFeedback(msg: string): void {
    this.storeToast.set(msg);
    if (this.toastResetTimer) window.clearTimeout(this.toastResetTimer);
    this.toastResetTimer = window.setTimeout(() => {
      this.storeToast.set('');
      this.toastResetTimer = 0;
    }, 2600);
  }

  // =========================================================================
  // MINIMALIST TOUCH-SWIPEABLE WORLDS EXPLORER (4,321 WORLDS)
  // =========================================================================

  openWorldsExplorer(event?: Event): void {
    event?.stopPropagation();
    this.showHowToPlay.set(false);
    this.showStoreModal.set(false);
    this.showVaultModal.set(false);
    this.browsingWorldNum.set(this.hud().worldNumber);
    this.worldDragOffsetX.set(0);
    this.isWorldDragging.set(false);
    this.worldSlideClass.set('');
    this.showWorldsModal.set(true);
    this.sound.playSwap();
    this.schedulePreviewStageSync();
  }

  closeWorldsExplorer(event?: Event): void {
    event?.stopPropagation();
    this.showWorldsModal.set(false);
    this.isWorldDragging.set(false);
    this.worldDragOffsetX.set(0);
    this.schedulePreviewStageSync();
  }

  stepBrowsedWorld(delta: 1 | -1): void {
    const curr = this.browsingWorldNum();
    const next = ((curr - 1 + delta + TOTAL_WORLDS) % TOTAL_WORLDS) + 1;
    this.browsingWorldNum.set(next);
    this.worldSlideClass.set(delta === 1 ? 'world-slide-next' : 'world-slide-prev');
    this.sound.playSwap();

    if (this.worldSlideResetTimer) {
      window.clearTimeout(this.worldSlideResetTimer);
    }
    this.worldSlideResetTimer = window.setTimeout(() => {
      this.worldSlideClass.set('');
      this.worldSlideResetTimer = 0;
    }, 390);
  }

  onWorldPointerDown(event: PointerEvent): void {
    this.worldPointerId = event.pointerId;
    this.worldSwipeStartX = event.clientX;
    this.worldSwipeMoved = false;
    this.isWorldDragging.set(true);
    this.worldDragOffsetX.set(0);
  }

  onWorldPointerMove(event: PointerEvent): void {
    if (!this.isWorldDragging() || event.pointerId !== this.worldPointerId) return;
    const dx = event.clientX - this.worldSwipeStartX;
    if (Math.abs(dx) > 9) {
      this.worldSwipeMoved = true;
    }
    this.worldDragOffsetX.set(Math.max(-240, Math.min(240, dx)));
  }

  onWorldPointerUp(event: PointerEvent): void {
    if (!this.isWorldDragging() || event.pointerId !== this.worldPointerId) return;
    const dx = event.clientX - this.worldSwipeStartX;
    const moved = this.worldSwipeMoved;

    this.isWorldDragging.set(false);
    this.worldDragOffsetX.set(0);
    this.worldPointerId = null;

    if (dx < -40) {
      this.stepBrowsedWorld(1);
      return;
    }
    if (dx > 40) {
      this.stepBrowsedWorld(-1);
      return;
    }
    if (!moved) {
      this.enterBrowsedWorld();
    }
  }

  onWorldPointerCancel(): void {
    this.isWorldDragging.set(false);
    this.worldDragOffsetX.set(0);
    this.worldPointerId = null;
  }

  enterBrowsedWorld(): void {
    const targetWorld = this.browsingWorldNum();
    this.showWorldsModal.set(false);
    this.engine?.openLevelRoad(targetWorld);
    this.scheduleScrollToActiveRoadNode();
    this.schedulePreviewStageSync();
  }

  onWindowKeyDown(event: KeyboardEvent): void {
    if (this.showVaultModal() && event.key === 'Escape') {
      event.preventDefault();
      this.closeVaultModal();
      return;
    }
    if (this.showStoreModal() && event.key === 'Escape') {
      event.preventDefault();
      this.closeStoreModal();
      return;
    }
    if (!this.showWorldsModal()) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.stepBrowsedWorld(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.stepBrowsedWorld(1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.enterBrowsedWorld();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.closeWorldsExplorer();
    }
  }

  // =========================================================================
  // GAMEPLAY, DAILY LEVEL, PRACTICE ENDLESS & WORLD CONTROLS
  // =========================================================================

  openLevelRoad(): void {
    this.showHowToPlay.set(false);
    this.showWorldsModal.set(false);
    this.showStoreModal.set(false);
    this.showVaultModal.set(false);
    this.engine?.openLevelRoad();
    this.scheduleScrollToActiveRoadNode();
    this.schedulePreviewStageSync();
  }

  jumpToUnlockedLevel(): void {
    this.showHowToPlay.set(false);
    this.showWorldsModal.set(false);
    this.showStoreModal.set(false);
    this.showVaultModal.set(false);
    this.engine?.jumpToCurrentUnlockedStage();
    this.scheduleScrollToActiveRoadNode();
    this.schedulePreviewStageSync();
  }

  onRoadNodeTap(node: RoadNodeView): void {
    if (!node.unlocked) return;
    if (this.hud().isViewingLockedWorld) {
      this.jumpToUnlockedLevel();
      return;
    }
    this.showHowToPlay.set(false);
    this.showWorldsModal.set(false);
    this.showStoreModal.set(false);
    this.showVaultModal.set(false);
    this.engine?.launchStagePlay(GameMode.Campaign, node.stageIndex);
    this.schedulePreviewStageSync();
  }

  launchSelectedStage(): void {
    if (this.hud().isViewingLockedWorld) {
      this.jumpToUnlockedLevel();
      return;
    }
    this.showHowToPlay.set(false);
    this.showWorldsModal.set(false);
    this.showStoreModal.set(false);
    this.showVaultModal.set(false);
    const stageIdx = Math.max(0, this.hud().stageNumber - 1);
    this.engine?.launchStagePlay(GameMode.Campaign, stageIdx);
    this.schedulePreviewStageSync();
  }

  startDailyLevel(event?: Event): void {
    event?.stopPropagation();
    this.showHowToPlay.set(false);
    this.showWorldsModal.set(false);
    this.showStoreModal.set(false);
    this.showVaultModal.set(false);
    this.engine?.launchDailyStage();
    this.schedulePreviewStageSync();
  }

  startEndless(event?: Event): void {
    event?.stopPropagation();
    this.showHowToPlay.set(false);
    this.showWorldsModal.set(false);
    this.showStoreModal.set(false);
    this.showVaultModal.set(false);
    this.engine?.launchStagePlay(GameMode.Endless, 0);
    this.schedulePreviewStageSync();
  }

  nextStage(): void {
    this.engine?.nextCampaignStage();
  }

  retryStage(): void {
    this.engine?.retryCurrentStage();
  }

  togglePause(): void {
    this.engine?.togglePause();
  }

  swapBubbles(): void {
    this.engine?.swapBubbles();
  }

  equipPower(kind: PowerKind): void {
    this.engine?.equipPowerBubble(kind);
  }

  cycleAimAssist(): void {
    this.engine?.cycleAimAssist();
  }

  toggleColorblind(): void {
    this.engine?.toggleColorblindSymbols();
  }

  setCamera(preset: CameraPreset): void {
    this.engine?.setCameraPreset(preset);
  }

  toggleMute(): void {
    this.engine?.toggleMute();
  }

  toggleRulesModal(): void {
    this.showHowToPlay.update((v) => !v);
    this.schedulePreviewStageSync();
  }
}
