import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ALL_COLORS,
  ALL_STORE_POWERS,
  AnimCategory,
  BUBBLE_PALETTE,
  BubbleColor,
  BubbleSpecial,
  CameraPreset,
  DifficultyMode,
  EquippedAnimations,
  FallingBubble,
  FloatingScorePopup,
  GameHudSnapshot,
  GameMode,
  GamePhase,
  GirlEmotionState,
  GridCell,
  LoseReason,
  PoppingBubble,
  PowerKind,
  ProjectileBubble,
  ShockwaveRingEffect,
  StorePowerKind,
} from './bubble-types';
import {
  getDailyStageForToday,
  getStageForLevel,
  getTodayDateKey,
  getTodayDisplayLabel,
  getWorldInfo,
  getWorldLevelBounds,
  getWorldNumberForLevel,
  MAX_UNLIMITED_LEVELS,
  TOTAL_WORLDS,
} from './levels';
import {
  buildArenaArchitecture,
  buildLauncherTurretModel,
  createProceduralAssets,
  ProceduralAssets,
} from './procedural-models';
import { preloadSorceressGlb } from './sorceress-rig';
import { SoundSynth } from './sound-synth';
import {
  calculateStageCoinReward,
  getAnimationPrice,
  getShooterPrice,
  getStorePowerPrice,
  rollDailyStageCoinReward,
  SHOOTER_DESIGNS_COUNT,
  SPECIAL_TO_STORE_POWER,
  STORE_POWER_BY_ID,
} from './store-catalog';

// Odd-R Hexagonal Grid Constants (40 Rows for Tall Top-to-Bottom Bubble Streams)
const EVEN_COLS = 10;
const ODD_COLS = 9;
const MAX_ROWS = 40;
const BUBBLE_RADIUS = 0.5;
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2.0;
const ROW_STEP_Y = BUBBLE_RADIUS * Math.sqrt(3);
const BOARD_HALF_WIDTH = (EVEN_COLS * BUBBLE_DIAMETER) / 2;
const TOP_BASE_Y = 6.2;
const DANGER_LINE_Y = -3.75;
const LAUNCHER_Y = -5.35;
const PROJECTILE_SPEED = 22.0;
const COLLISION_DIST = BUBBLE_DIAMETER * 0.88;

const _vec3 = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _particleColor = new THREE.Color();

interface ParticleData {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  life: number;
  maxLife: number;
  colorHex: number;
}

export class BubbleEngine {
  private container: HTMLElement;
  private sound: SoundSynth;
  private onHudChange: (snapshot: GameHudSnapshot) => void;

  private isSoftwareGl = false;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private assets!: ProceduralAssets;

  private frameId = 0;
  private destroyed = false;
  private lastTimestamp = 0;

  // 3D Scene Groups & Shared Geometries
  private launcher!: ReturnType<typeof buildLauncherTurretModel>;
  private arena!: ReturnType<typeof buildArenaArchitecture>;
  private bubblesGroup = new THREE.Group();
  private aimDotsGroup = new THREE.Group();
  private aimDotMeshes: THREE.Mesh[] = [];
  private aimDotMat!: THREE.MeshBasicMaterial;
  private ghostSnapRing!: THREE.Mesh;
  private ghostRingMat!: THREE.MeshBasicMaterial;
  private projectileGroup = new THREE.Group();
  private projectileMesh!: THREE.Mesh;
  private projectileHaloMesh!: THREE.Mesh;
  private sharedSphereGeo!: THREE.SphereGeometry;
  private sharedSymbolGeo!: THREE.PlaneGeometry;
  private sharedPowerBadgeGeo!: THREE.PlaneGeometry;
  private sharedPowerHaloGeo!: THREE.TorusGeometry;
  private sharedShockwaveGeo!: THREE.RingGeometry;
  private sharedIceGeo!: THREE.IcosahedronGeometry;
  private sharedFuseGeo!: THREE.CylinderGeometry;
  private sharedLightningRingGeo!: THREE.TorusGeometry;
  private sharedStoneBandGeo!: THREE.TorusGeometry;
  private resizeObserver: ResizeObserver | null = null;
  private isMobileDevice = false;

  // Pooled InstancedMesh Particle System (160 particles — zero GC)
  private readonly maxParticles = 160;
  private particleMesh!: THREE.InstancedMesh;
  private particles: ParticleData[] = [];

  // Active Mesh Caches
  private cellMeshMap = new Map<number, THREE.Group>();
  private fallingMeshMap = new Map<number, THREE.Mesh>();
  private poppingMeshes: { mesh: THREE.Mesh; data: PoppingBubble }[] = [];
  private shockwaveMeshes: {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    data: ShockwaveRingEffect;
  }[] = [];

  // Game State
  private phase: GamePhase = GamePhase.Title;
  private mode: GameMode = GameMode.Campaign;
  private stageIndex = 0;
  private nextEntityId = 1;

  private grid: (GridCell | null)[][] = [];
  private rowParityOffset = 0;
  private scrollVisualY = 0;
  private scrollTargetY = 0;
  private ceilingDropVisualY = 0;
  private ceilingDropTargetY = 0;
  private ceilingDropsCount = 0;

  private aimAngle = Math.PI / 2;
  private targetAimAngle = Math.PI / 2;
  private recoilOffset = 0;
  private wandCastTimer = 0;
  private happyTimer = 0;
  private missTimer = 0;
  private winSparkleTimer = 0;
  private dangerProximity = false;
  private girlEmotion: GirlEmotionState = 'idle';
  private difficultyMode: DifficultyMode = 'normal';
  private hitstopTimer = 0;
  private shakeIntensity = 0;

  private score = 0;
  private highScore = 0;
  private combo = 0;
  private maxCombo = 0;
  private shotsFired = 0;
  private shotsLimit = 38;
  private shotsRemaining = 38;
  private loseReason: LoseReason = 'out_of_bubbles';
  private selectedPowerTarget: PowerKind = 'bomb';
  private missesCount = 0;
  private missThreshold = 6;
  private powerCharge = 0;
  private starsEarned = 3;
  private unlockedStage = 1;
  private stageStars: Record<number, number> = {};
  private stageStarsSnapshot: Record<number, number> = {};
  private justCompletedWorld = false;
  private transitionFromWorld = 1;
  private transitionToWorld = 2;
  private dailyCompletedDate = '';

  // Coin Economy, Store Powers & 5x1000 Animations State
  private coins = 0;
  private coinsEarnedLastWin = 0;
  private ownedAnimations = new Set<string>([
    'idle:0',
    'shoot:0',
    'happy:0',
    'win:0',
    'angry:0',
  ]);
  private equippedAnimations: EquippedAnimations = {
    idle: 0,
    shoot: 0,
    happy: 0,
    win: 0,
    angry: 0,
  };
  private ownedShooters = new Set<number>([0]);
  private equippedShooterIndex = 0;
  private storePowersInventory: Record<StorePowerKind, number> = {
    supernova: 0,
    aurora: 0,
    meteor: 0,
    crossbolt: 0,
    frostburst: 0,
    celestial_crown: 0,
  };
  private storePowersBoughtCounts: Record<StorePowerKind, number> = {
    supernova: 0,
    aurora: 0,
    meteor: 0,
    crossbolt: 0,
    frostburst: 0,
    celestial_crown: 0,
  };
  private practiceInventoryBackup: Record<StorePowerKind, number> | null = null;

  private currentColor: BubbleColor = BubbleColor.Ruby;
  private currentSpecial: BubbleSpecial = BubbleSpecial.None;
  private nextColor: BubbleColor = BubbleColor.Sapphire;
  private nextSpecial: BubbleSpecial = BubbleSpecial.None;

  private availablePowers: Record<PowerKind, number> = {
    bomb: 0,
    rainbow: 0,
    lightning: 0,
    fireball: 0,
  };

  private activeProjectile: ProjectileBubble | null = null;
  private fallingBubbles: FallingBubble[] = [];
  private popups: FloatingScorePopup[] = [];

  private aimAssistLength: 'short' | 'medium' | 'full' = 'medium';
  private colorblindSymbols = false;
  private cameraPreset: CameraPreset = CameraPreset.Arcade;

  private keysHeld = new Set<string>();
  private activeAimPointerId: number | null = null;
  private pointerStartClientY = 0;
  private pointerMinClientY = 0;
  private aimCanceled = false;

  private boundResize = () => this.onResize();
  private boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);
  private boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e);
  private boundBlur = () => {
    this.keysHeld.clear();
    this.activeAimPointerId = null;
    this.aimCanceled = false;
  };
  private boundPointerMove = (e: PointerEvent) => this.onPointerMove(e);
  private boundPointerDown = (e: PointerEvent) => this.onPointerDown(e);
  private boundPointerUp = (e: PointerEvent) => this.onPointerUp(e);
  private boundPointerCancel = (e: PointerEvent) => this.onPointerCancel(e);
  private boundContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (this.phase === GamePhase.Playing) {
      this.swapBubbles();
    }
  };

  constructor(
    container: HTMLElement,
    sound: SoundSynth,
    onHudChange: (snapshot: GameHudSnapshot) => void,
  ) {
    this.container = container;
    this.sound = sound;
    this.onHudChange = onHudChange;

    preloadSorceressGlb();
    this.loadPersistentState();

    this.initThree();
    this.launcher.sorceress.setEquippedAnimations(this.equippedAnimations);
    this.launcher.setShooterStyle(this.equippedShooterIndex);
    const startupIdx = Math.max(0, Math.min(this.unlockedStage - 1, MAX_UNLIMITED_LEVELS - 1));
    this.loadStage(startupIdx, GameMode.Campaign, false);
    this.phase = GamePhase.IntroLoading;
    this.emitHud();
    this.startLoop();
  }

  private loadPersistentState(): void {
    try {
      const savedBest = localStorage.getItem('aetheris_high_score');
      if (savedBest) this.highScore = parseInt(savedBest, 10) || 0;

      const savedUnlocked = localStorage.getItem('aetheris_unlocked_stage');
      if (savedUnlocked) {
        this.unlockedStage = Math.max(1, parseInt(savedUnlocked, 10) || 1);
      }

      const savedStars = localStorage.getItem('aetheris_stage_stars');
      if (savedStars) {
        this.stageStars = JSON.parse(savedStars) || {};
        this.stageStarsSnapshot = { ...this.stageStars };
      }

      const savedDaily = localStorage.getItem('aetheris_daily_completed_date');
      if (savedDaily) {
        this.dailyCompletedDate = savedDaily;
      }

      const savedCoins = localStorage.getItem('aetheris_coins');
      if (savedCoins !== null) {
        this.coins = Math.max(0, parseInt(savedCoins, 10) || 0);
      }

      const savedOwnedAnims = localStorage.getItem('aetheris_owned_anims');
      if (savedOwnedAnims) {
        const arr = JSON.parse(savedOwnedAnims);
        if (Array.isArray(arr)) {
          arr.forEach((k: string) => this.ownedAnimations.add(k));
        }
      }

      const savedEq = localStorage.getItem('aetheris_equipped_anims');
      if (savedEq) {
        const parsed = JSON.parse(savedEq);
        if (parsed && typeof parsed === 'object') {
          this.equippedAnimations = {
            idle: Number(parsed.idle) || 0,
            shoot: Number(parsed.shoot) || 0,
            happy: Number(parsed.happy) || 0,
            win: Number(parsed.win) || 0,
            angry: Number(parsed.angry) || 0,
          };
        }
      }

      const savedStoreInv = localStorage.getItem('aetheris_store_powers');
      if (savedStoreInv) {
        const parsed = JSON.parse(savedStoreInv);
        if (parsed && typeof parsed === 'object') {
          for (const sk of ALL_STORE_POWERS) {
            this.storePowersInventory[sk] = Math.max(0, Number(parsed[sk]) || 0);
          }
        }
      }

      const savedStoreBuys = localStorage.getItem('aetheris_store_power_buys');
      if (savedStoreBuys) {
        const parsed = JSON.parse(savedStoreBuys);
        if (parsed && typeof parsed === 'object') {
          for (const sk of ALL_STORE_POWERS) {
            this.storePowersBoughtCounts[sk] = Math.max(0, Number(parsed[sk]) || 0);
          }
        }
      }

      const savedOwnedShooters = localStorage.getItem('aetheris_owned_shooters');
      if (savedOwnedShooters) {
        const arr = JSON.parse(savedOwnedShooters);
        if (Array.isArray(arr)) {
          arr.forEach((n: unknown) => {
            const idx = Math.floor(Number(n));
            if (Number.isFinite(idx) && idx >= 0 && idx < SHOOTER_DESIGNS_COUNT) {
              this.ownedShooters.add(idx);
            }
          });
        }
      }

      const savedEqShooter = localStorage.getItem('aetheris_equipped_shooter');
      if (savedEqShooter !== null) {
        const idx = Math.floor(Number(savedEqShooter));
        if (
          Number.isFinite(idx) &&
          idx >= 0 &&
          idx < SHOOTER_DESIGNS_COUNT &&
          this.ownedShooters.has(idx)
        ) {
          this.equippedShooterIndex = idx;
        }
      }
    } catch {
      // Ignore storage access errors in restricted sandboxes
    }
  }

  private saveEconomyState(): void {
    try {
      localStorage.setItem('aetheris_coins', String(this.coins));
      localStorage.setItem(
        'aetheris_owned_anims',
        JSON.stringify(Array.from(this.ownedAnimations)),
      );
      localStorage.setItem('aetheris_equipped_anims', JSON.stringify(this.equippedAnimations));
      localStorage.setItem('aetheris_store_powers', JSON.stringify(this.storePowersInventory));
      localStorage.setItem(
        'aetheris_store_power_buys',
        JSON.stringify(this.storePowersBoughtCounts),
      );
      localStorage.setItem(
        'aetheris_owned_shooters',
        JSON.stringify(Array.from(this.ownedShooters)),
      );
      localStorage.setItem('aetheris_equipped_shooter', String(this.equippedShooterIndex));
    } catch {
      // Ignore storage errors
    }
  }

  private initThree(): void {
    this.isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.isMobileDevice =
      window.matchMedia('(pointer: coarse)').matches || Math.min(width, height) < 768;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // NeutralToneMapping keeps primary jewel colors 100% pure & saturated with zero milky filmic fog!
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    // Full native Super-Retina / 8K clarity (up to 3.0x DPR)!
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 3.0),
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = false;

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    this.container.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());

    this.scene = new THREE.Scene();
    const skyBg = new THREE.Color(0x040712);
    this.scene.background = skyBg;
    // Zero fog haze across gameplay arena so bubbles & character stay 100% razor-sharp 8K HD!
    this.scene.fog = null;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 140);
    this.camera.position.set(0, -1.2, 20.5);
    this.camera.lookAt(0, 0.4, 0);

    const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x0f172a, 1.15);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.35);
    keyLight.position.set(7.5, 11.0, 12.5);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.45);
    rimLight.position.set(-8.5, 5.0, -6.0);
    this.scene.add(rimLight);

    this.assets = createProceduralAssets(this.renderer, this.isSoftwareGl);
    const segs = 32;
    this.sharedSphereGeo = new THREE.SphereGeometry(BUBBLE_RADIUS * 0.97, segs, segs);
    this.sharedSymbolGeo = new THREE.PlaneGeometry(0.56, 0.56);
    this.sharedPowerBadgeGeo = new THREE.PlaneGeometry(0.68, 0.68);
    this.sharedPowerHaloGeo = new THREE.TorusGeometry(0.54, 0.036, 8, 22);
    this.sharedShockwaveGeo = new THREE.RingGeometry(0.42, 0.56, 32);
    this.sharedIceGeo = new THREE.IcosahedronGeometry(BUBBLE_RADIUS * 1.07, 1);
    this.sharedFuseGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.25, 8);
    this.sharedLightningRingGeo = new THREE.TorusGeometry(0.5, 0.04, 8, 20);
    this.sharedStoneBandGeo = new THREE.TorusGeometry(0.47, 0.055, 8, 14);

    this.arena = buildArenaArchitecture(
      this.assets,
      BOARD_HALF_WIDTH,
      TOP_BASE_Y,
      DANGER_LINE_Y,
      LAUNCHER_Y,
    );
    this.scene.add(this.arena.arenaGroup);

    this.launcher = buildLauncherTurretModel(this.assets);
    this.launcher.root.position.set(0, LAUNCHER_Y, 0);
    this.scene.add(this.launcher.root);

    this.scene.add(this.bubblesGroup);
    this.scene.add(this.aimDotsGroup);
    this.scene.add(this.projectileGroup);

    const dotGeo = new THREE.SphereGeometry(0.095, 8, 8);
    this.aimDotMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.92,
    });
    for (let i = 0; i < 52; i++) {
      const m = new THREE.Mesh(dotGeo, this.aimDotMat);
      m.visible = false;
      this.aimDotsGroup.add(m);
      this.aimDotMeshes.push(m);
    }

    const ringGeo = new THREE.RingGeometry(0.36, 0.5, 24);
    this.ghostRingMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    this.ghostSnapRing = new THREE.Mesh(ringGeo, this.ghostRingMat);
    this.ghostSnapRing.visible = false;
    this.scene.add(this.ghostSnapRing);

    this.projectileMesh = new THREE.Mesh(
      this.sharedSphereGeo,
      this.assets.bubbleShellMaterials[BubbleColor.Ruby],
    );
    this.projectileHaloMesh = new THREE.Mesh(this.sharedPowerHaloGeo, this.assets.brassMaterial);
    this.projectileHaloMesh.visible = false;
    this.projectileGroup.visible = false;
    this.projectileGroup.add(this.projectileMesh);
    this.projectileGroup.add(this.projectileHaloMesh);

    const partGeo = new THREE.IcosahedronGeometry(0.11, 0);
    const partMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    this.particleMesh = new THREE.InstancedMesh(partGeo, partMat, this.maxParticles);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -999,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0,
        life: 0,
        maxLife: 1,
        colorHex: 0xffffff,
      });
      _dummyObj.position.set(0, -999, 0);
      _dummyObj.scale.setScalar(0.0001);
      _dummyObj.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummyObj.matrix);
      this.particleMesh.setColorAt(i, _particleColor.setHex(0xffffff));
    }
    this.scene.add(this.particleMesh);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.boundResize);
    window.addEventListener('orientationchange', this.boundResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);
    }
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
    window.addEventListener('blur', this.boundBlur);
    canvas.addEventListener('pointermove', this.boundPointerMove, { passive: true });
    canvas.addEventListener('pointerdown', this.boundPointerDown);
    canvas.addEventListener('pointerup', this.boundPointerUp);
    canvas.addEventListener('pointercancel', this.boundPointerCancel);
    canvas.addEventListener('contextmenu', this.boundContextMenu);

    this.onResize();
  }

  // ============================================================================
  // STORE, COINS & ANIMATIONS PUBLIC API
  // ============================================================================

  isAnimationOwned(category: AnimCategory, index: number): boolean {
    if (index === 0) return true;
    return this.ownedAnimations.has(`${category}:${index}`);
  }

  /**
   * Returns all owned emote indices (0..999) sorted ascending for a specific Emote Category!
   * Used by the Vault Modal so Happy emotes appear under Happy, Victory under Victory, etc.
   */
  getOwnedAnimationIndices(category: AnimCategory): number[] {
    const ownedSet = new Set<number>([0]);
    const prefix = `${category}:`;
    this.ownedAnimations.forEach((key) => {
      if (key.startsWith(prefix)) {
        const idx = parseInt(key.slice(prefix.length), 10);
        if (Number.isFinite(idx) && idx >= 0 && idx < 1000) {
          ownedSet.add(idx);
        }
      }
    });
    return Array.from(ownedSet).sort((a, b) => a - b);
  }

  equipOwnedAnimation(category: AnimCategory, index: number): boolean {
    const safeIdx = Math.max(0, Math.min(999, Math.floor(index)));
    if (!this.isAnimationOwned(category, safeIdx)) return false;
    this.equippedAnimations = {
      ...this.equippedAnimations,
      [category]: safeIdx,
    };
    this.launcher.sorceress.setEquippedAnimations(this.equippedAnimations);
    this.saveEconomyState();
    this.sound.playEmoteSound(category, safeIdx);
    this.emitHud();
    return true;
  }

  buyOrEquipAnimation(
    category: AnimCategory,
    index: number,
  ): 'equipped' | 'bought_and_equipped' | 'insufficient_coins' {
    const safeIdx = Math.max(0, Math.min(999, Math.floor(index)));
    const key = `${category}:${safeIdx}`;

    if (this.isAnimationOwned(category, safeIdx)) {
      this.equippedAnimations = {
        ...this.equippedAnimations,
        [category]: safeIdx,
      };
      this.launcher.sorceress.setEquippedAnimations(this.equippedAnimations);
      this.saveEconomyState();
      this.sound.playEmoteSound(category, safeIdx);
      this.emitHud();
      return 'equipped';
    }

    const price = getAnimationPrice(safeIdx);
    if (this.coins < price) {
      return 'insufficient_coins';
    }

    this.coins -= price;
    this.ownedAnimations.add(key);
    this.equippedAnimations = {
      ...this.equippedAnimations,
      [category]: safeIdx,
    };
    this.launcher.sorceress.setEquippedAnimations(this.equippedAnimations);
    this.saveEconomyState();
    this.sound.playStorePurchase();
    this.sound.playEmoteSound(category, safeIdx);
    this.emitHud();
    return 'bought_and_equipped';
  }

  isShooterOwned(index: number): boolean {
    if (index <= 0) return true;
    return this.ownedShooters.has(Math.floor(index));
  }

  getOwnedShooterIndices(): number[] {
    const ownedSet = new Set<number>([0]);
    this.ownedShooters.forEach((idx) => {
      if (idx >= 0 && idx < SHOOTER_DESIGNS_COUNT) {
        ownedSet.add(idx);
      }
    });
    return Array.from(ownedSet).sort((a, b) => a - b);
  }

  equipOwnedShooter(index: number): boolean {
    const safeIdx = Math.max(0, Math.min(SHOOTER_DESIGNS_COUNT - 1, Math.floor(index)));
    if (!this.isShooterOwned(safeIdx)) return false;
    this.equippedShooterIndex = safeIdx;
    this.launcher.setShooterStyle(safeIdx);
    this.saveEconomyState();
    this.sound.playSwap();
    this.emitHud();
    return true;
  }

  buyOrEquipShooter(
    index: number,
  ): 'equipped' | 'bought_and_equipped' | 'insufficient_coins' {
    const safeIdx = Math.max(0, Math.min(SHOOTER_DESIGNS_COUNT - 1, Math.floor(index)));
    if (this.isShooterOwned(safeIdx)) {
      this.equippedShooterIndex = safeIdx;
      this.launcher.setShooterStyle(safeIdx);
      this.saveEconomyState();
      this.sound.playSwap();
      this.emitHud();
      return 'equipped';
    }

    const price = getShooterPrice(safeIdx);
    if (this.coins < price) {
      return 'insufficient_coins';
    }

    this.coins -= price;
    this.ownedShooters.add(safeIdx);
    this.equippedShooterIndex = safeIdx;
    this.launcher.setShooterStyle(safeIdx);
    this.saveEconomyState();
    this.sound.playStorePurchase();
    this.emitHud();
    return 'bought_and_equipped';
  }

  getStorePowerCurrentPrice(kind: StorePowerKind): number {
    const def = STORE_POWER_BY_ID[kind];
    return getStorePowerPrice(def.powerIndex);
  }

  buyStorePower(kind: StorePowerKind): boolean {
    const price = this.getStorePowerCurrentPrice(kind);
    if (this.coins < price) {
      return false;
    }
    this.coins -= price;
    this.storePowersInventory[kind] = (this.storePowersInventory[kind] || 0) + 1;
    if (this.practiceInventoryBackup) {
      this.practiceInventoryBackup[kind] = (this.practiceInventoryBackup[kind] || 0) + 1;
    }
    this.storePowersBoughtCounts[kind] = (this.storePowersBoughtCounts[kind] || 0) + 1;
    this.saveEconomyState();
    this.sound.playStorePurchase();
    this.emitHud();
    return true;
  }

  private restorePracticeInventoryIfNeeded(): void {
    if (this.practiceInventoryBackup) {
      this.storePowersInventory = { ...this.practiceInventoryBackup };
      this.practiceInventoryBackup = null;
    }
  }

  /**
   * Equips a Purchased Store Power directly into the Shooter Bubble during Level Play
   * and triggers a 3D Magic Girl Summon Animation + Golden Shockwave Ring!
   */
  equipStorePowerInGame(kind: StorePowerKind): void {
    if (this.phase !== GamePhase.Playing || this.activeProjectile) return;
    const def = STORE_POWER_BY_ID[kind];
    const isPractice = this.mode === GameMode.Endless;

    // If this Store Power is already loaded in the shooter bubble, unequip & refund back to inventory
    if (this.currentSpecial === def.special) {
      this.currentSpecial = BubbleSpecial.None;
      this.storePowersInventory[kind]++;
      if (!isPractice) this.saveEconomyState();
      this.syncLauncherOrbMaterials();
      this.sound.playSwap();
      this.emitHud();
      return;
    }

    if ((this.storePowersInventory[kind] || 0) <= 0) return;

    // Refund any currently loaded World Power or Store Power first so nothing is ever lost!
    this.refundCurrentlyLoadedSpecial();

    this.storePowersInventory[kind]--;
    this.currentSpecial = def.special;
    if (!isPractice) this.saveEconomyState();
    this.syncLauncherOrbMaterials();

    // Trigger 3D Magic Girl Summon Animation + 3D Bubble Power Shockwave!
    this.happyTimer = 1.25;
    this.launcher.sorceress.triggerOneShot('happy', this.equippedAnimations.happy);
    this.sound.playPowerSummon();
    this.spawnShockwaveRing(0, LAUNCHER_Y + 0.96, def.ringColorNum, 2.2, 0.42);
    this.spawnBurstParticles(0, LAUNCHER_Y + 0.96, def.ringColorNum, 20, 6.0);
    this.spawnScorePopup(0, LAUNCHER_Y + 1.85, `${def.name.toUpperCase()} READY!`, def.accentHex);
    this.emitHud();
  }

  private refundSpecialSlot(spec: BubbleSpecial): void {
    if (spec === BubbleSpecial.None) return;

    const worldReverse: Partial<Record<BubbleSpecial, PowerKind>> = {
      [BubbleSpecial.Bomb]: 'bomb',
      [BubbleSpecial.Rainbow]: 'rainbow',
      [BubbleSpecial.Lightning]: 'lightning',
      [BubbleSpecial.Fireball]: 'fireball',
    };
    const wKind = worldReverse[spec];
    if (wKind) {
      this.availablePowers[wKind]++;
      return;
    }

    const sKind = SPECIAL_TO_STORE_POWER[spec];
    if (sKind) {
      this.storePowersInventory[sKind]++;
    }
  }

  private refundCurrentlyLoadedSpecial(): void {
    if (this.currentSpecial !== BubbleSpecial.None) {
      this.refundSpecialSlot(this.currentSpecial);
      this.currentSpecial = BubbleSpecial.None;
    }
    if (this.nextSpecial !== BubbleSpecial.None) {
      this.refundSpecialSlot(this.nextSpecial);
      this.nextSpecial = BubbleSpecial.None;
    }
  }

  // ============================================================================
  // PUBLIC CONTROLS FOR ANGULAR SHELL HUD
  // ============================================================================

  completeIntroLoading(): void {
    if (this.phase === GamePhase.IntroLoading) {
      this.mode = GameMode.Campaign;
      const focusIdx = Math.max(0, Math.min(this.unlockedStage - 1, MAX_UNLIMITED_LEVELS - 1));
      this.loadStage(focusIdx, GameMode.Campaign, false);
      this.phase = GamePhase.LevelRoad;
      this.emitHud();
    }
  }

  isGlobalLevelUnlocked(globalLevel: number): boolean {
    return globalLevel >= 1 && globalLevel <= this.unlockedStage;
  }

  getUnlockedLevelForWorld(worldNumber: number): number {
    const bounds = getWorldLevelBounds(worldNumber);
    if (this.unlockedStage < bounds.startLevel) {
      return 0;
    }
    return Math.min(bounds.endLevel, this.unlockedStage);
  }

  openLevelRoad(targetWorldNumber?: number): void {
    const wasCampaignVictory =
      this.phase === GamePhase.Victory && this.mode === GameMode.Campaign;
    const wasNonCampaign = this.mode !== GameMode.Campaign;

    this.refundCurrentlyLoadedSpecial();
    this.restorePracticeInventoryIfNeeded();
    this.saveEconomyState();
    this.mode = GameMode.Campaign;
    let targetGlobalLevel = this.stageIndex + 1;

    if (targetWorldNumber !== undefined) {
      const bounds = getWorldLevelBounds(targetWorldNumber);
      if (this.unlockedStage >= bounds.startLevel) {
        targetGlobalLevel = Math.min(bounds.endLevel, this.unlockedStage);
      } else {
        targetGlobalLevel = bounds.startLevel;
      }
    } else if (wasCampaignVictory) {
      // After winning a level, automatically advance the Magic Girl onto the NEXT level!
      targetGlobalLevel = Math.min(
        MAX_UNLIMITED_LEVELS,
        Math.min(this.unlockedStage, this.stageIndex + 2),
      );
    } else if (wasNonCampaign || targetGlobalLevel < 1 || targetGlobalLevel > this.unlockedStage) {
      targetGlobalLevel = this.unlockedStage;
    }

    this.loadStage(targetGlobalLevel - 1, GameMode.Campaign, false);
    this.phase = GamePhase.LevelRoad;
    this.sound.playSwap();
    this.emitHud();
  }

  jumpToCurrentUnlockedStage(): void {
    this.mode = GameMode.Campaign;
    const focusIdx = Math.max(0, Math.min(this.unlockedStage - 1, MAX_UNLIMITED_LEVELS - 1));
    this.loadStage(focusIdx, GameMode.Campaign, false);
    this.phase = GamePhase.LevelRoad;
    this.sound.playSwap();
    this.emitHud();
  }

  selectRoadStage(stageIdx: number): void {
    const globalLvl = stageIdx + 1;
    if (!this.isGlobalLevelUnlocked(globalLvl)) return;
    this.loadStage(stageIdx, GameMode.Campaign, false);
    this.phase = GamePhase.LevelRoad;
    this.sound.playSwap();
    this.emitHud();
  }

  launchStagePlay(mode: GameMode, stageIdx: number): void {
    const globalLvl = stageIdx + 1;
    if (mode === GameMode.Campaign && !this.isGlobalLevelUnlocked(globalLvl)) return;

    this.refundCurrentlyLoadedSpecial();
    this.restorePracticeInventoryIfNeeded();

    if (mode === GameMode.Endless) {
      // Endless Mode is strictly Practice Mode — snapshot Store Powers so real uses are NEVER lost!
      this.practiceInventoryBackup = { ...this.storePowersInventory };
    }

    this.mode = mode;
    this.justCompletedWorld = false;
    this.coinsEarnedLastWin = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.happyTimer = 0;
    this.missTimer = 0;
    this.dangerProximity = false;
    this.availablePowers =
      mode === GameMode.Endless
        ? { bomb: 2, rainbow: 2, lightning: 2, fireball: 2 }
        : { bomb: 0, rainbow: 0, lightning: 0, fireball: 0 };
    this.powerCharge = 30;
    this.loadStage(
      stageIdx,
      mode,
      mode === GameMode.Endless || mode === GameMode.Daily || stageIdx === 0,
    );
    this.phase = GamePhase.Playing;
    this.launcher.sorceress.syncGameplayEmotion('idle');
    this.sound.playLaunch();
    this.emitHud();
  }

  launchDailyStage(): void {
    this.launchStagePlay(GameMode.Daily, 0);
  }

  playWorldFlightPreview(fromWorld: number, toWorld: number): void {
    this.transitionFromWorld = Math.max(1, Math.min(TOTAL_WORLDS, fromWorld));
    this.transitionToWorld = Math.max(1, Math.min(TOTAL_WORLDS, toWorld));
    this.justCompletedWorld = true;
    this.phase = GamePhase.WorldTransition;
    this.sound.playWorldFlightCutscene();
    this.emitHud();
  }

  finishWorldTransitionCutscene(): void {
    this.justCompletedWorld = false;
    this.openLevelRoad(this.transitionToWorld);
  }

  nextCampaignStage(): void {
    if (this.mode === GameMode.Daily || this.mode === GameMode.Endless) {
      this.openLevelRoad();
      return;
    }
    const nextIdx = Math.min(MAX_UNLIMITED_LEVELS - 1, this.stageIndex + 1);
    if (this.isGlobalLevelUnlocked(nextIdx + 1)) {
      this.launchStagePlay(GameMode.Campaign, nextIdx);
    } else {
      this.openLevelRoad();
    }
  }

  retryCurrentStage(): void {
    this.refundCurrentlyLoadedSpecial();
    this.restorePracticeInventoryIfNeeded();
    this.saveEconomyState();
    if (this.mode === GameMode.Endless) {
      this.launchStagePlay(GameMode.Endless, 0);
    } else if (this.mode === GameMode.Daily) {
      this.launchDailyStage();
    } else {
      this.score = Math.max(0, this.score - 300);
      this.coinsEarnedLastWin = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.happyTimer = 0;
      this.missTimer = 0;
      this.dangerProximity = false;
      this.powerCharge = 30;
      this.availablePowers = { bomb: 0, rainbow: 0, lightning: 0, fireball: 0 };
      this.loadStage(this.stageIndex, GameMode.Campaign, false);
      this.phase = GamePhase.Playing;
      this.launcher.sorceress.syncGameplayEmotion('idle');
      this.sound.playLaunch();
      this.emitHud();
    }
  }

  togglePause(): void {
    if (this.phase === GamePhase.Playing) {
      this.phase = GamePhase.Paused;
      this.emitHud();
    } else if (this.phase === GamePhase.Paused) {
      this.phase = GamePhase.Playing;
      this.emitHud();
    }
  }

  swapBubbles(): void {
    if (this.phase !== GamePhase.Playing || this.activeProjectile) return;
    const tmpC = this.currentColor;
    const tmpS = this.currentSpecial;
    this.currentColor = this.nextColor;
    this.currentSpecial = this.nextSpecial;
    this.nextColor = tmpC;
    this.nextSpecial = tmpS;
    this.syncLauncherOrbMaterials();
    this.sound.playSwap();
    this.emitHud();
  }

  equipPowerBubble(kind: PowerKind): void {
    if (this.phase !== GamePhase.Playing || this.activeProjectile) return;

    const map: Record<PowerKind, BubbleSpecial> = {
      bomb: BubbleSpecial.Bomb,
      rainbow: BubbleSpecial.Rainbow,
      lightning: BubbleSpecial.Lightning,
      fireball: BubbleSpecial.Fireball,
    };

    this.selectedPowerTarget = kind;

    if (this.availablePowers[kind] > 0) {
      if (this.currentSpecial === map[kind]) {
        this.currentSpecial = BubbleSpecial.None;
        this.availablePowers[kind]++;
      } else {
        this.refundCurrentlyLoadedSpecial();
        this.saveEconomyState();
        this.availablePowers[kind]--;
        this.currentSpecial = map[kind];
        this.launcher.sorceress.triggerOneShot('happy', this.equippedAnimations.happy);
        this.spawnShockwaveRing(0, LAUNCHER_Y + 0.96, 0xfef08a, 1.8, 0.35);
      }
      this.syncLauncherOrbMaterials();
      this.sound.playSwap();
      this.emitHud();
      return;
    }

    this.summonSelectedPowerIntoVisibleBubble(kind);
    this.sound.playSwap();
    this.emitHud();
  }

  cycleAimAssist(): void {
    const order: ('short' | 'medium' | 'full')[] = ['short', 'medium', 'full'];
    const idx = order.indexOf(this.aimAssistLength);
    this.aimAssistLength = order[(idx + 1) % order.length];
    this.emitHud();
  }

  toggleColorblindSymbols(): void {
    this.colorblindSymbols = !this.colorblindSymbols;
    this.rebuildAllGridMeshes();
    this.emitHud();
  }

  setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
    this.emitHud();
  }

  toggleMute(): void {
    const next = !this.sound.isMuted();
    this.sound.setMuted(next);
    this.emitHud();
  }

  // ============================================================================
  // HEXAGONAL ODD-R GRID MATH & STAGE SETUP
  // ============================================================================

  private isShiftedRow(row: number): boolean {
    return (row + this.rowParityOffset) % 2 === 1;
  }

  private getColsForRow(row: number): number {
    return this.isShiftedRow(row) ? ODD_COLS : EVEN_COLS;
  }

  private gridToWorld(row: number, col: number): { x: number; y: number } {
    const shifted = this.isShiftedRow(row) ? BUBBLE_RADIUS : 0;
    const x = -BOARD_HALF_WIDTH + BUBBLE_RADIUS + col * BUBBLE_DIAMETER + shifted;
    const y = TOP_BASE_Y + this.scrollVisualY - this.ceilingDropVisualY - row * ROW_STEP_Y;
    return { x, y };
  }

  private gridToLogicalWorld(row: number, col: number): { x: number; y: number } {
    const shifted = this.isShiftedRow(row) ? BUBBLE_RADIUS : 0;
    const x = -BOARD_HALF_WIDTH + BUBBLE_RADIUS + col * BUBBLE_DIAMETER + shifted;
    const y = TOP_BASE_Y + this.scrollTargetY - this.ceilingDropTargetY - row * ROW_STEP_Y;
    return { x, y };
  }

  private getNeighbors(row: number, col: number): { row: number; col: number }[] {
    const shifted = this.isShiftedRow(row);
    const offsets = shifted
      ? [
          [0, -1],
          [0, 1],
          [-1, 0],
          [-1, 1],
          [1, 0],
          [1, 1],
        ]
      : [
          [0, -1],
          [0, 1],
          [-1, -1],
          [-1, 0],
          [1, -1],
          [1, 0],
        ];

    const res: { row: number; col: number }[] = [];
    for (const [dr, dc] of offsets) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < MAX_ROWS) {
        const maxCols = this.getColsForRow(nr);
        if (nc >= 0 && nc < maxCols) {
          res.push({ row: nr, col: nc });
        }
      }
    }
    return res;
  }

  private recomputeVerticalScrollTarget(snapImmediately: boolean): void {
    if (this.mode === GameMode.Endless) {
      this.scrollTargetY = 0;
      if (snapImmediately) this.scrollVisualY = 0;
      return;
    }

    let maxOccupiedRow = 0;
    for (let r = 0; r < MAX_ROWS; r++) {
      for (const cell of this.grid[r]) {
        if (cell) {
          maxOccupiedRow = Math.max(maxOccupiedRow, r);
        }
      }
    }

    const desiredBottomY = -1.55;
    this.scrollTargetY = Math.max(0, desiredBottomY + maxOccupiedRow * ROW_STEP_Y - TOP_BASE_Y);
    if (snapImmediately) {
      this.scrollVisualY = this.scrollTargetY;
    }
  }

  private summonSelectedPowerIntoVisibleBubble(kind: PowerKind): void {
    let bestExisting: GridCell | null = null;
    for (let r = MAX_ROWS - 1; r >= 0; r--) {
      for (const cell of this.grid[r]) {
        if (!cell || !cell.trappedPower) continue;
        const pos = this.gridToLogicalWorld(cell.row, cell.col);
        if (pos.y >= -2.4 && pos.y <= 5.4) {
          bestExisting = cell;
          break;
        }
      }
      if (bestExisting) break;
    }

    if (bestExisting) {
      bestExisting.trappedPower = kind;
      bestExisting.wobble = 0.26;
      const oldMesh = this.cellMeshMap.get(bestExisting.id);
      if (oldMesh) {
        this.bubblesGroup.remove(oldMesh);
        this.cellMeshMap.delete(bestExisting.id);
      }
      this.createCellMesh(bestExisting);
      const wPos = this.gridToWorld(bestExisting.row, bestExisting.col);
      this.spawnBurstParticles(wPos.x, wPos.y, 0xfef08a, 12, 5.0);
      this.spawnScorePopup(wPos.x, wPos.y, `FREE FOR ${kind.toUpperCase()}!`, '#fde047');
      return;
    }

    let maxRow = 0;
    for (let r = 0; r < MAX_ROWS; r++) {
      if (this.grid[r].some((c) => c !== null)) maxRow = r;
    }
    const targetRowStart = Math.max(1, maxRow - 3);
    for (let r = targetRowStart; r >= 0; r--) {
      const candidates = this.grid[r].filter(
        (c): c is GridCell => c !== null && c.special === BubbleSpecial.None && !c.frozen,
      );
      if (candidates.length > 0) {
        const chosen = candidates[Math.floor(candidates.length / 2)];
        chosen.trappedPower = kind;
        chosen.wobble = 0.28;
        const oldMesh = this.cellMeshMap.get(chosen.id);
        if (oldMesh) {
          this.bubblesGroup.remove(oldMesh);
          this.cellMeshMap.delete(chosen.id);
        }
        this.createCellMesh(chosen);
        const wPos = this.gridToWorld(chosen.row, chosen.col);
        this.spawnBurstParticles(wPos.x, wPos.y, 0xfef08a, 12, 5.0);
        this.spawnScorePopup(wPos.x, wPos.y, `FREE FOR ${kind.toUpperCase()}!`, '#fde047');
        return;
      }
    }
  }

  private grantFreedPower(kind: PowerKind, worldX: number, worldY: number): void {
    this.availablePowers[kind]++;
    this.happyTimer = Math.max(this.happyTimer, 1.35);
    this.launcher.sorceress.triggerOneShot('happy', this.equippedAnimations.happy);
    this.sound.playSwap();
    this.spawnBurstParticles(worldX, worldY, 0xfef08a, 14, 6.0);
    this.spawnScorePopup(worldX, worldY, `+1 ${kind.toUpperCase()} UNLOCKED!`, '#fde047');
  }

  private loadStage(stageIdx: number, mode: GameMode, resetScore: boolean): void {
    this.clearBoardMeshes();
    this.stageIndex = stageIdx;
    this.mode = mode;
    if (resetScore) {
      this.score = 0;
    }

    this.rowParityOffset = 0;
    this.scrollVisualY = 0;
    this.scrollTargetY = 0;
    this.ceilingDropVisualY = 0;
    this.ceilingDropTargetY = 0;
    this.ceilingDropsCount = 0;
    this.shotsFired = 0;
    this.missesCount = 0;
    this.combo = 0;
    this.loseReason = 'out_of_bubbles';
    this.activeProjectile = null;
    this.projectileGroup.visible = false;
    this.activeAimPointerId = null;
    this.aimCanceled = false;
    this.aimAngle = Math.PI / 2;
    this.targetAimAngle = Math.PI / 2;

    this.grid = Array.from({ length: MAX_ROWS }, (_, r) =>
      Array.from({ length: this.getColsForRow(r) }, () => null),
    );

    if (mode === GameMode.Campaign || mode === GameMode.Daily) {
      const stage =
        mode === GameMode.Daily
          ? getDailyStageForToday()
          : getStageForLevel(stageIdx + 1, this.difficultyMode);
      const worldInfo = getWorldInfo(stage.worldNumber);

      // Default World Power target to this World's own signature power!
      this.selectedPowerTarget = worldInfo.signaturePower;

      if (this.scene?.background instanceof THREE.Color) {
        // Deep high-contrast dark obsidian tint per world — zero hazy washout!
        this.scene.background.setHex(worldInfo.skyNum).multiplyScalar(0.48);
      }
      this.scene.fog = null;
      this.missThreshold = stage.missThreshold;
      this.shotsLimit = stage.shotsLimit;
      this.shotsRemaining = stage.shotsLimit;

      const powerCycle: PowerKind[] = ['bomb', 'rainbow', 'lightning', 'fireball'];
      let powerTokenIdx = 0;

      stage.pattern.forEach((line, r) => {
        if (r >= MAX_ROWS) return;
        const cols = this.getColsForRow(r);
        for (let c = 0; c < Math.min(cols, line.length); c++) {
          const ch = line[c];
          if (ch === '.') continue;

          if (ch === 'P') {
            const pKind =
              powerTokenIdx === 0
                ? this.selectedPowerTarget
                : powerCycle[(stage.stageNumber + powerTokenIdx) % powerCycle.length];
            powerTokenIdx++;

            const cPool = ALL_COLORS.slice(0, stage.colorsCount);
            const cellColor = cPool[(r + c) % cPool.length];
            const cell: GridCell = {
              id: this.nextEntityId++,
              row: r,
              col: c,
              color: cellColor,
              special: BubbleSpecial.None,
              frozen: false,
              trappedPower: pKind,
              scale: 1,
              wobble: 0,
              wobbleVel: 0,
              hitFlash: 0,
            };
            this.grid[r][c] = cell;
            continue;
          }

          const parsed = this.parsePatternChar(ch);
          if (parsed) {
            const cell: GridCell = {
              id: this.nextEntityId++,
              row: r,
              col: c,
              color: parsed.color,
              special: parsed.special,
              frozen: parsed.frozen,
              trappedPower: null,
              scale: 1,
              wobble: 0,
              wobbleVel: 0,
              hitFlash: 0,
            };
            this.grid[r][c] = cell;
          }
        }
      });

      this.recomputeVerticalScrollTarget(true);
      for (let r = 0; r < MAX_ROWS; r++) {
        for (const cell of this.grid[r]) {
          if (cell) this.createCellMesh(cell);
        }
      }
    } else {
      this.missThreshold = 5;
      this.shotsLimit = 999;
      this.shotsRemaining = 999;
      const endlessColors = ALL_COLORS.slice(0, 4);
      for (let r = 0; r < 8; r++) {
        const cols = this.getColsForRow(r);
        for (let c = 0; c < cols; c++) {
          const rand = Math.random();
          let special = BubbleSpecial.None;
          let trappedPower: PowerKind | null = null;
          if (r === 5 && c === 4) {
            trappedPower = this.selectedPowerTarget;
          } else if (r >= 2 && rand < 0.04) {
            special = BubbleSpecial.Bomb;
          } else if (r >= 2 && rand >= 0.04 && rand < 0.07) {
            special = BubbleSpecial.Rainbow;
          }

          const color = endlessColors[Math.floor(Math.random() * endlessColors.length)];
          const cell: GridCell = {
            id: this.nextEntityId++,
            row: r,
            col: c,
            color,
            special,
            frozen: r === 3 && Math.random() < 0.1,
            trappedPower,
            scale: 1,
            wobble: 0,
            wobbleVel: 0,
            hitFlash: 0,
          };
          this.grid[r][c] = cell;
          this.createCellMesh(cell);
        }
      }
    }

    this.currentSpecial = BubbleSpecial.None;
    this.nextSpecial = BubbleSpecial.None;
    this.currentColor = this.pickSmartRemainingColor();
    this.nextColor = this.pickSmartRemainingColor();
    this.dangerProximity = false;
    this.syncLauncherOrbMaterials();
  }

  private parsePatternChar(ch: string): {
    color: BubbleColor;
    special: BubbleSpecial;
    frozen: boolean;
  } | null {
    const upper = ch.toUpperCase();
    const isLower = ch !== upper;
    const colorMap: Record<string, BubbleColor> = {
      R: BubbleColor.Ruby,
      S: BubbleColor.Sapphire,
      E: BubbleColor.Emerald,
      T: BubbleColor.Topaz,
      A: BubbleColor.Amethyst,
      C: BubbleColor.Coral,
    };

    if (colorMap[upper]) {
      return {
        color: colorMap[upper],
        special: BubbleSpecial.None,
        frozen: isLower,
      };
    }
    if (upper === 'X') {
      return {
        color: BubbleColor.Ruby,
        special: BubbleSpecial.Stone,
        frozen: false,
      };
    }
    if (upper === 'B') {
      return {
        color: BubbleColor.Topaz,
        special: BubbleSpecial.Bomb,
        frozen: false,
      };
    }
    if (upper === 'L') {
      return {
        color: BubbleColor.Sapphire,
        special: BubbleSpecial.Lightning,
        frozen: false,
      };
    }
    if (upper === 'W') {
      return {
        color: BubbleColor.Amethyst,
        special: BubbleSpecial.Rainbow,
        frozen: false,
      };
    }
    return null;
  }

  private isColorPresentOnBoard(target: BubbleColor): boolean {
    for (let r = 0; r < MAX_ROWS; r++) {
      for (const cell of this.grid[r]) {
        if (cell && cell.special === BubbleSpecial.None && cell.color === target) {
          return true;
        }
      }
    }
    return false;
  }

  private pickSmartRemainingColor(): BubbleColor {
    let maxRow = 0;
    for (let r = 0; r < MAX_ROWS; r++) {
      if (this.grid[r].some((c) => c !== null)) maxRow = r;
    }
    const minVisibleRow = Math.max(0, maxRow - 9);
    const visibleColors = new Set<BubbleColor>();
    const allActiveColors = new Set<BubbleColor>();

    for (let r = 0; r < MAX_ROWS; r++) {
      for (const cell of this.grid[r]) {
        if (cell && cell.special === BubbleSpecial.None) {
          allActiveColors.add(cell.color);
          if (r >= minVisibleRow) {
            visibleColors.add(cell.color);
          }
        }
      }
    }

    const list =
      visibleColors.size > 0 ? Array.from(visibleColors) : Array.from(allActiveColors);
    if (list.length === 0) {
      return ALL_COLORS[Math.floor(Math.random() * 4)];
    }
    return list[Math.floor(Math.random() * list.length)];
  }

  private countRemainingClearableBubbles(): number {
    let count = 0;
    for (let r = 0; r < MAX_ROWS; r++) {
      for (const cell of this.grid[r]) {
        if (cell && cell.special !== BubbleSpecial.Stone) {
          count++;
        }
      }
    }
    return count;
  }

  // ============================================================================
  // MESH CREATION & VISUAL SYNCHRONIZATION
  // ============================================================================

  private getMaterialForBubble(
    color: BubbleColor,
    special: BubbleSpecial,
  ): THREE.Material {
    const storeKind = SPECIAL_TO_STORE_POWER[special];
    if (storeKind) {
      return this.assets.storePowerMaterials[storeKind];
    }
    switch (special) {
      case BubbleSpecial.Rainbow:
        return this.assets.rainbowMaterial;
      case BubbleSpecial.Bomb:
        return this.assets.bombMaterial;
      case BubbleSpecial.Lightning:
        return this.assets.lightningMaterial;
      case BubbleSpecial.Fireball:
        return this.assets.fireballMaterial;
      case BubbleSpecial.Stone:
        return this.assets.stoneMaterial;
      default:
        return this.assets.bubbleShellMaterials[color];
    }
  }

  private createCellMesh(cell: GridCell): void {
    const group = new THREE.Group();
    const shellMesh = new THREE.Mesh(
      this.sharedSphereGeo,
      this.getMaterialForBubble(cell.color, cell.special),
    );
    group.add(shellMesh);

    if (cell.trappedPower) {
      const cageShell = new THREE.Mesh(this.sharedIceGeo, this.assets.powerCageMaterial);
      cageShell.renderOrder = 2;
      group.add(cageShell);

      const haloRing = new THREE.Mesh(this.sharedPowerHaloGeo, this.assets.brassMaterial);
      haloRing.name = 'powerHalo';
      haloRing.position.z = 0.14;
      group.add(haloRing);

      const powerBadge = new THREE.Mesh(
        this.sharedPowerBadgeGeo,
        this.assets.powerBadgeMaterials[cell.trappedPower],
      );
      powerBadge.name = 'powerBadge';
      powerBadge.position.z = BUBBLE_RADIUS * 1.08;
      powerBadge.renderOrder = 3;
      group.add(powerBadge);
    } else if (cell.special === BubbleSpecial.Bomb) {
      const fuse = new THREE.Mesh(this.sharedFuseGeo, this.assets.brassMaterial);
      fuse.position.set(0, 0.45, 0.12);
      group.add(fuse);
    } else if (cell.special === BubbleSpecial.Lightning) {
      const ring = new THREE.Mesh(
        this.sharedLightningRingGeo,
        this.assets.platinumTrimMaterial,
      );
      group.add(ring);
    } else if (cell.special === BubbleSpecial.Stone) {
      const band = new THREE.Mesh(
        this.sharedStoneBandGeo,
        this.assets.darkSteelMaterial,
      );
      group.add(band);
    } else if (this.colorblindSymbols && cell.special === BubbleSpecial.None) {
      const symPlane = new THREE.Mesh(
        this.sharedSymbolGeo,
        this.assets.symbolMaterials[cell.color],
      );
      symPlane.position.z = BUBBLE_RADIUS * 0.99;
      group.add(symPlane);
    }

    if (cell.frozen) {
      const iceShell = new THREE.Mesh(this.sharedIceGeo, this.assets.iceShellMaterial);
      iceShell.name = 'iceShell';
      iceShell.renderOrder = 2;
      group.add(iceShell);
    }

    const pos = this.gridToWorld(cell.row, cell.col);
    group.position.set(pos.x, pos.y, 0);
    this.bubblesGroup.add(group);
    this.cellMeshMap.set(cell.id, group);
  }

  private rebuildAllGridMeshes(): void {
    this.cellMeshMap.forEach((g) => this.bubblesGroup.remove(g));
    this.cellMeshMap.clear();
    for (let r = 0; r < MAX_ROWS; r++) {
      for (const cell of this.grid[r]) {
        if (cell) this.createCellMesh(cell);
      }
    }
  }

  private clearBoardMeshes(): void {
    this.cellMeshMap.forEach((g) => this.bubblesGroup.remove(g));
    this.cellMeshMap.clear();
    this.fallingMeshMap.forEach((m) => this.scene.remove(m));
    this.fallingMeshMap.clear();
    this.fallingBubbles = [];
    this.poppingMeshes.forEach((p) => this.scene.remove(p.mesh));
    this.poppingMeshes = [];
    this.shockwaveMeshes.forEach((s) => {
      this.scene.remove(s.mesh);
      s.mat.dispose();
    });
    this.shockwaveMeshes = [];
  }

  private syncLauncherOrbMaterials(): void {
    this.launcher.loadedOrbMesh.material = this.getMaterialForBubble(
      this.currentColor,
      this.currentSpecial,
    );
    this.launcher.loadedPowerHalo.visible = this.currentSpecial !== BubbleSpecial.None;
    this.launcher.reserveOrbMesh.material = this.getMaterialForBubble(
      this.nextColor,
      this.nextSpecial,
    );

    let sightColorHex = BUBBLE_PALETTE[this.currentColor].num;
    const storeKind = SPECIAL_TO_STORE_POWER[this.currentSpecial];
    if (storeKind) {
      sightColorHex = STORE_POWER_BY_ID[storeKind].ringColorNum;
    } else if (this.currentSpecial === BubbleSpecial.Bomb) {
      sightColorHex = 0xf97316;
    } else if (this.currentSpecial === BubbleSpecial.Lightning) {
      sightColorHex = 0x38bdf8;
    } else if (this.currentSpecial === BubbleSpecial.Fireball) {
      sightColorHex = 0xea580c;
    } else if (this.currentSpecial === BubbleSpecial.Rainbow) {
      sightColorHex = 0xc084fc;
    }

    if (this.aimDotMat) this.aimDotMat.color.setHex(sightColorHex);
    if (this.ghostRingMat) this.ghostRingMat.color.setHex(sightColorHex);
  }

  // ============================================================================
  // SHOOTING, STORE POWER EFFECTS, COLLISION & SNAP LOGIC
  // ============================================================================

  fireBubble(): void {
    if (this.phase !== GamePhase.Playing || this.activeProjectile) return;
    if (
      (this.mode === GameMode.Campaign || this.mode === GameMode.Daily) &&
      this.shotsRemaining <= 0
    ) {
      return;
    }

    const barrelTipDist = 1.05;
    const startX = Math.cos(this.aimAngle) * barrelTipDist;
    const startY = LAUNCHER_Y + Math.sin(this.aimAngle) * barrelTipDist;

    const isPiercing =
      this.currentSpecial === BubbleSpecial.Fireball ||
      this.currentSpecial === BubbleSpecial.Meteor;

    this.activeProjectile = {
      x: startX,
      y: startY,
      vx: Math.cos(this.aimAngle) * PROJECTILE_SPEED,
      vy: Math.sin(this.aimAngle) * PROJECTILE_SPEED,
      color: this.currentColor,
      special: this.currentSpecial,
      trailTimer: 0,
      bounces: 0,
      piercing: isPiercing,
    };

    this.projectileMesh.material = this.getMaterialForBubble(
      this.currentColor,
      this.currentSpecial,
    );
    this.projectileHaloMesh.visible = this.currentSpecial !== BubbleSpecial.None;
    this.projectileGroup.position.set(startX, startY, 0);
    this.projectileGroup.visible = true;

    this.recoilOffset = 0.24;
    this.wandCastTimer = 0.45;
    // Play equipped 3D Magic Girl Shoot / Wand Cast Animation!
    this.launcher.sorceress.triggerOneShot('shoot', this.equippedAnimations.shoot);
    this.launcher.sorceress.getWandTipWorldPosition(_vec3);
    this.spawnBurstParticles(_vec3.x, _vec3.y + 0.15, 0xfef08a, 10, 5.0);

    this.shotsFired++;
    if (this.mode === GameMode.Campaign || this.mode === GameMode.Daily) {
      this.shotsRemaining = Math.max(0, this.shotsRemaining - 1);
    }
    this.sound.playLaunch();

    this.currentColor = this.nextColor;
    this.currentSpecial = this.nextSpecial;
    this.nextColor = this.pickSmartRemainingColor();
    this.nextSpecial = BubbleSpecial.None;
    this.syncLauncherOrbMaterials();
    this.emitHud();
  }

  private computeAimTrajectory(): {
    points: { x: number; y: number }[];
    snapTarget: { x: number; y: number } | null;
  } {
    const points: { x: number; y: number }[] = [];
    const step = 0.28;
    const maxSteps =
      this.aimAssistLength === 'short'
        ? 22
        : this.aimAssistLength === 'medium'
          ? 40
          : 70;

    let x = Math.cos(this.aimAngle) * 1.1;
    let y = LAUNCHER_Y + Math.sin(this.aimAngle) * 1.1;
    let dx = Math.cos(this.aimAngle);
    const dy = Math.sin(this.aimAngle);

    const minX = -BOARD_HALF_WIDTH + BUBBLE_RADIUS;
    const maxX = BOARD_HALF_WIDTH - BUBBLE_RADIUS;
    const ceilingY = TOP_BASE_Y + this.scrollTargetY - this.ceilingDropTargetY;

    let hitPos: { x: number; y: number } | null = null;

    for (let i = 0; i < maxSteps; i++) {
      x += dx * step;
      y += dy * step;

      if (x <= minX) {
        x = minX + (minX - x);
        dx = -dx;
      } else if (x >= maxX) {
        x = maxX - (x - maxX);
        dx = -dx;
      }

      if (y >= ceilingY) {
        y = ceilingY;
        points.push({ x, y });
        hitPos = { x, y };
        break;
      }

      let collided = false;
      for (let r = 0; r < MAX_ROWS; r++) {
        for (const cell of this.grid[r]) {
          if (!cell) continue;
          const cw = this.gridToLogicalWorld(cell.row, cell.col);
          const distSq = (x - cw.x) * (x - cw.x) + (y - cw.y) * (y - cw.y);
          if (distSq <= COLLISION_DIST * COLLISION_DIST) {
            collided = true;
            break;
          }
        }
        if (collided) break;
      }

      points.push({ x, y });
      if (collided) {
        hitPos = { x, y };
        break;
      }
    }

    let snapTarget: { x: number; y: number } | null = null;
    if (hitPos) {
      const slot = this.findNearestEmptySlot(hitPos.x, hitPos.y);
      if (slot) {
        snapTarget = this.gridToLogicalWorld(slot.row, slot.col);
      }
    }

    return { points, snapTarget };
  }

  private findNearestEmptySlot(
    wx: number,
    wy: number,
  ): { row: number; col: number } | null {
    let best: { row: number; col: number } | null = null;
    let bestDistSq = Infinity;

    for (let r = 0; r < MAX_ROWS; r++) {
      const cols = this.getColsForRow(r);
      for (let c = 0; c < cols; c++) {
        if (this.grid[r][c] !== null) continue;

        const hasNeighbor =
          r === 0 ||
          this.getNeighbors(r, c).some((n) => this.grid[n.row][n.col] !== null);
        if (!hasNeighbor) continue;

        const pos = this.gridToLogicalWorld(r, c);
        const dSq = (wx - pos.x) * (wx - pos.x) + (wy - pos.y) * (wy - pos.y);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          best = { row: r, col: c };
        }
      }
    }

    return best;
  }

  private updateProjectile(dt: number): void {
    const proj = this.activeProjectile;
    if (!proj) return;

    const subSteps = 3;
    const subDt = dt / subSteps;
    const minX = -BOARD_HALF_WIDTH + BUBBLE_RADIUS;
    const maxX = BOARD_HALF_WIDTH - BUBBLE_RADIUS;
    const ceilingY = TOP_BASE_Y + this.scrollTargetY - this.ceilingDropTargetY;

    proj.trailTimer += dt;
    if (proj.trailTimer >= 0.03) {
      proj.trailTimer = 0;
      const storeKind = SPECIAL_TO_STORE_POWER[proj.special];
      const trailHex = storeKind
        ? STORE_POWER_BY_ID[storeKind].ringColorNum
        : BUBBLE_PALETTE[proj.color].num;
      this.spawnBurstParticles(proj.x, proj.y, trailHex, 2, 1.8);
    }

    for (let s = 0; s < subSteps; s++) {
      proj.x += proj.vx * subDt;
      proj.y += proj.vy * subDt;

      if (proj.x <= minX) {
        proj.x = minX + (minX - proj.x);
        proj.vx = Math.abs(proj.vx);
        proj.bounces++;
        this.sound.playWallBounce();
      } else if (proj.x >= maxX) {
        proj.x = maxX - (proj.x - maxX);
        proj.vx = -Math.abs(proj.vx);
        proj.bounces++;
        this.sound.playWallBounce();
      }

      if (proj.piercing) {
        const hitRadius =
          proj.special === BubbleSpecial.Meteor
            ? BUBBLE_DIAMETER * 1.65
            : BUBBLE_DIAMETER * 0.95;
        for (let r = 0; r < MAX_ROWS; r++) {
          for (let c = 0; c < this.grid[r].length; c++) {
            const cell = this.grid[r][c];
            if (!cell) continue;
            const cw = this.gridToLogicalWorld(r, c);
            const distSq = (proj.x - cw.x) ** 2 + (proj.y - cw.y) ** 2;
            if (distSq <= hitRadius * hitRadius) {
              this.popSingleCell(cell, 85);
            }
          }
        }
        if (proj.y >= Math.min(ceilingY + 0.3, 8.2)) {
          this.activeProjectile = null;
          this.projectileGroup.visible = false;
          this.sound.playExplosion();
          this.spawnShockwaveRing(proj.x, proj.y, 0xfb923c, 3.0, 0.45);
          this.shakeIntensity = 0.2;
          this.resolveFloatingClusters(1);
          this.checkBoardOutcome(true);
          this.emitHud();
          return;
        }
        continue;
      }

      if (proj.y >= ceilingY) {
        proj.y = ceilingY;
        this.landProjectile(proj);
        return;
      }

      for (let r = 0; r < MAX_ROWS; r++) {
        for (const cell of this.grid[r]) {
          if (!cell) continue;
          const cw = this.gridToLogicalWorld(cell.row, cell.col);
          const distSq = (proj.x - cw.x) ** 2 + (proj.y - cw.y) ** 2;
          if (distSq <= COLLISION_DIST * COLLISION_DIST) {
            this.landProjectile(proj);
            return;
          }
        }
      }
    }

    this.projectileGroup.position.set(proj.x, proj.y, 0);
    if (this.projectileHaloMesh.visible) {
      this.projectileHaloMesh.rotation.z += dt * 7.0;
    }
  }

  private landProjectile(proj: ProjectileBubble): void {
    this.activeProjectile = null;
    this.projectileGroup.visible = false;

    const slot = this.findNearestEmptySlot(proj.x, proj.y);
    if (!slot) {
      this.triggerGameOver();
      return;
    }

    const landedCell: GridCell = {
      id: this.nextEntityId++,
      row: slot.row,
      col: slot.col,
      color: proj.color,
      special: proj.special,
      frozen: false,
      trappedPower: null,
      scale: 0.72,
      wobble: 0.28,
      wobbleVel: 0,
      hitFlash: 0.6,
    };

    this.grid[slot.row][slot.col] = landedCell;
    this.createCellMesh(landedCell);
    this.sound.playSnap();

    for (const n of this.getNeighbors(slot.row, slot.col)) {
      const nb = this.grid[n.row][n.col];
      if (nb) nb.wobble = 0.18;
    }

    const bankBonusMultiplier = proj.bounces > 0 ? 1.25 : 1.0;
    const scoreBeforeShot = this.score;
    let clearedAny = false;

    // 1. Evaluate Purchased Store Power Special Impacts!
    if (landedCell.special === BubbleSpecial.Supernova) {
      this.detonateRadiusBlast(slot.row, slot.col, BUBBLE_DIAMETER * 3.25, 0xfbbf24, 'SUPERNOVA');
      clearedAny = true;
    } else if (landedCell.special === BubbleSpecial.Aurora) {
      this.detonateAuroraColorSweep(slot.row, slot.col);
      clearedAny = true;
    } else if (landedCell.special === BubbleSpecial.CrossBolt) {
      this.detonateThunderCross(slot.row, slot.col);
      clearedAny = true;
    } else if (landedCell.special === BubbleSpecial.FrostBurst) {
      this.detonateRadiusBlast(slot.row, slot.col, BUBBLE_DIAMETER * 2.65, 0x34d399, 'CHRONO +4 BUBBLES');
      if (this.mode !== GameMode.Endless) {
        this.shotsRemaining += 4;
      }
      clearedAny = true;
    } else if (landedCell.special === BubbleSpecial.CelestialCrown) {
      this.detonateCelestialCrown(slot.row, slot.col);
      clearedAny = true;
    } else if (landedCell.special === BubbleSpecial.Bomb) {
      this.detonateRadiusBlast(slot.row, slot.col, BUBBLE_DIAMETER * 2.15, 0xf97316, 'BLAST');
      clearedAny = true;
    } else if (landedCell.special === BubbleSpecial.Lightning) {
      this.triggerLightningRow(slot.row);
      clearedAny = true;
    } else {
      const touchedSpecials = this.getNeighbors(slot.row, slot.col)
        .map((n) => this.grid[n.row][n.col])
        .filter(
          (c): c is GridCell =>
            c !== null &&
            (c.special === BubbleSpecial.Bomb || c.special === BubbleSpecial.Lightning),
        );

      for (const sp of touchedSpecials) {
        if (sp.special === BubbleSpecial.Bomb) {
          this.detonateRadiusBlast(sp.row, sp.col, BUBBLE_DIAMETER * 2.15, 0xf97316, 'BLAST');
          clearedAny = true;
        } else if (sp.special === BubbleSpecial.Lightning) {
          this.triggerLightningRow(sp.row);
          clearedAny = true;
        }
      }

      const matched = this.findColorMatches(landedCell);
      if (matched.length >= 3) {
        clearedAny = true;
        this.combo++;
        this.maxCombo = Math.max(this.maxCombo, this.combo);

        const basePerBubble = 20 * this.combo;
        let totalPopScore = 0;

        const thawedIds = new Set<number>();
        matched.forEach((mCell, idx) => {
          for (const n of this.getNeighbors(mCell.row, mCell.col)) {
            const nb = this.grid[n.row][n.col];
            if (nb && nb.frozen && !thawedIds.has(nb.id)) {
              nb.frozen = false;
              thawedIds.add(nb.id);
              const g = this.cellMeshMap.get(nb.id);
              const ice = g?.getObjectByName('iceShell');
              if (g && ice) g.remove(ice);
            }
          }

          const pts = Math.round(basePerBubble * bankBonusMultiplier);
          totalPopScore += pts;
          this.popSingleCell(mCell, 0);
          this.sound.playPop(idx, this.combo);
        });

        this.addScore(totalPopScore);
        this.chargePowerMeter(matched.length * 9);

        const centerWorld = this.gridToWorld(slot.row, slot.col);
        const label =
          proj.bounces > 0
            ? `+${totalPopScore} BANK!`
            : this.combo > 1
              ? `+${totalPopScore} (${this.combo}x)`
              : `+${totalPopScore}`;
        this.spawnScorePopup(
          centerWorld.x,
          centerWorld.y,
          label,
          BUBBLE_PALETTE[proj.color].hex,
        );

        if (matched.length >= 5) {
          this.hitstopTimer = 0.04;
          this.shakeIntensity = 0.14;
        }
      }
    }

    if (clearedAny) {
      if (this.combo >= 2 && this.missesCount > 0) {
        this.missesCount = Math.max(0, this.missesCount - 1);
      }
      this.resolveFloatingClusters(bankBonusMultiplier);

      const gained = this.score - scoreBeforeShot;
      this.missTimer = 0;
      if (gained >= 150 || this.combo >= 2) {
        this.happyTimer = 1.35;
        this.launcher.sorceress.triggerOneShot('happy', this.equippedAnimations.happy);
        this.sound.playEmoteSound('happy', this.equippedAnimations.happy);
        this.spawnBurstParticles(-1.45, LAUNCHER_Y + 0.95, 0xfbbf24, 10, 5.2);
      }
    } else {
      this.combo = 0;
      this.happyTimer = 0;
      this.missTimer = 1.05;
      if (this.shotsRemaining <= 5 || this.mode === GameMode.Endless) {
        this.sound.playEmoteSound('angry', this.equippedAnimations.angry);
      }
      if (this.mode === GameMode.Endless) {
        this.missesCount++;
        if (this.missesCount >= this.missThreshold) {
          this.missesCount = 0;
          this.applyCeilingPenalty();
        }
      }
    }

    this.checkBoardOutcome(clearedAny);
    this.emitHud();
  }

  private detonateRadiusBlast(
    centerRow: number,
    centerCol: number,
    blastRadius: number,
    colorNum: number,
    tag: string,
  ): void {
    const centerPos = this.gridToLogicalWorld(centerRow, centerCol);
    const visPos = this.gridToWorld(centerRow, centerCol);
    let count = 0;

    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        const cell = this.grid[r][c];
        if (!cell) continue;
        const pos = this.gridToLogicalWorld(r, c);
        if (Math.hypot(pos.x - centerPos.x, pos.y - centerPos.y) <= blastRadius) {
          count++;
          this.popSingleCell(cell, 0);
        }
      }
    }

    const pts = count * 65;
    this.addScore(pts);
    this.chargePowerMeter(20);
    this.hitstopTimer = 0.05;
    this.shakeIntensity = 0.28;
    this.sound.playExplosion();
    this.spawnShockwaveRing(visPos.x, visPos.y, colorNum, blastRadius * 1.25, 0.48);
    this.spawnBurstParticles(visPos.x, visPos.y, colorNum, 24, 7.2);
    this.spawnScorePopup(visPos.x, visPos.y, `+${pts} ${tag}!`, '#fde047');
  }

  private detonateAuroraColorSweep(centerRow: number, centerCol: number): void {
    const visPos = this.gridToWorld(centerRow, centerCol);
    let targetColor: BubbleColor | null = null;
    for (const n of this.getNeighbors(centerRow, centerCol)) {
      const nb = this.grid[n.row][n.col];
      if (nb && nb.special === BubbleSpecial.None) {
        targetColor = nb.color;
        break;
      }
    }
    if (!targetColor) targetColor = this.pickSmartRemainingColor();

    const centerCell = this.grid[centerRow]?.[centerCol];
    if (centerCell) this.popSingleCell(centerCell, 0);

    let count = 1;
    for (let r = Math.max(0, centerRow - 12); r < MAX_ROWS; r++) {
      for (const cell of this.grid[r]) {
        if (!cell) continue;
        if (cell.color === targetColor && cell.special !== BubbleSpecial.Stone) {
          count++;
          this.popSingleCell(cell, 0);
        }
      }
    }

    const pts = count * 70;
    this.addScore(pts);
    this.sound.playLightning();
    this.spawnShockwaveRing(visPos.x, visPos.y, 0xe879f9, 4.6, 0.52);
    this.spawnScorePopup(visPos.x, visPos.y, `+${pts} PRISM SWEEP!`, '#f0abfc');
  }

  private detonateThunderCross(centerRow: number, centerCol: number): void {
    const centerPos = this.gridToLogicalWorld(centerRow, centerCol);
    const visPos = this.gridToWorld(centerRow, centerCol);
    let count = 0;

    for (let r = 0; r < MAX_ROWS; r++) {
      for (const cell of this.grid[r]) {
        if (!cell) continue;
        const pos = this.gridToLogicalWorld(cell.row, cell.col);
        if (r === centerRow || Math.abs(pos.x - centerPos.x) <= 0.65) {
          count++;
          this.popSingleCell(cell, 0);
        }
      }
    }

    const pts = count * 75;
    this.addScore(pts);
    this.shakeIntensity = 0.26;
    this.sound.playLightning();
    this.spawnShockwaveRing(visPos.x, visPos.y, 0x38bdf8, 4.5, 0.45);
    this.spawnScorePopup(visPos.x, visPos.y, `+${pts} THUNDER CROSS!`, '#38bdf8');
  }

  private detonateCelestialCrown(centerRow: number, centerCol: number): void {
    const visPos = this.gridToWorld(centerRow, centerCol);
    let maxRow = centerRow;
    for (let r = 0; r < MAX_ROWS; r++) {
      if (this.grid[r].some((c) => c !== null)) maxRow = r;
    }

    const minSweepRow = Math.max(0, maxRow - 3);
    let count = 0;
    for (let r = minSweepRow; r <= maxRow; r++) {
      for (const cell of this.grid[r]) {
        if (!cell) continue;
        count++;
        this.popSingleCell(cell, 0);
      }
    }
    const centerCell = this.grid[centerRow]?.[centerCol];
    if (centerCell) {
      count++;
      this.popSingleCell(centerCell, 0);
    }

    const pts = count * 80;
    this.addScore(pts);
    this.shakeIntensity = 0.3;
    this.sound.playExplosion();
    this.spawnShockwaveRing(0, visPos.y, 0xfde047, 5.2, 0.55);
    this.spawnScorePopup(0, visPos.y, `+${pts} CELESTIAL CROWN!`, '#fde047');
  }

  private triggerLightningRow(targetRow: number): void {
    const rowY = TOP_BASE_Y + this.scrollVisualY - this.ceilingDropVisualY - targetRow * ROW_STEP_Y;
    let count = 0;

    for (const cell of this.grid[targetRow]) {
      if (!cell) continue;
      count++;
      this.popSingleCell(cell, 0);
    }

    const pts = count * 75;
    this.addScore(pts);
    this.chargePowerMeter(22);
    this.shakeIntensity = 0.22;
    this.sound.playLightning();
    this.spawnShockwaveRing(0, rowY, 0x38bdf8, 4.4, 0.4);
    this.spawnScorePopup(0, rowY, `+${pts} VOLTAIC ROW!`, '#38bdf8');
  }

  private findColorMatches(startCell: GridCell): GridCell[] {
    if (startCell.special === BubbleSpecial.Stone || startCell.frozen) {
      return [];
    }

    const candidateColors = new Set<BubbleColor>();
    if (startCell.special === BubbleSpecial.Rainbow) {
      for (const n of this.getNeighbors(startCell.row, startCell.col)) {
        const nb = this.grid[n.row][n.col];
        if (nb && nb.special === BubbleSpecial.None && !nb.frozen) {
          candidateColors.add(nb.color);
        }
      }
      if (candidateColors.size === 0) candidateColors.add(startCell.color);
    } else {
      candidateColors.add(startCell.color);
    }

    const bestCluster = new Map<number, GridCell>();

    for (const targetColor of candidateColors) {
      const visited = new Set<number>();
      const queue: GridCell[] = [startCell];
      const cluster: GridCell[] = [];
      visited.add(startCell.id);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        cluster.push(curr);

        for (const n of this.getNeighbors(curr.row, curr.col)) {
          const nb = this.grid[n.row][n.col];
          if (!nb || visited.has(nb.id) || nb.frozen) continue;
          if (nb.special === BubbleSpecial.Stone) continue;

          const matchesColor =
            nb.special === BubbleSpecial.Rainbow ||
            (nb.special === BubbleSpecial.None && nb.color === targetColor);

          if (matchesColor) {
            visited.add(nb.id);
            queue.push(nb);
          }
        }
      }

      if (cluster.length >= 3) {
        cluster.forEach((c) => bestCluster.set(c.id, c));
      }
    }

    return Array.from(bestCluster.values());
  }

  private popSingleCell(cell: GridCell, bonusScore: number): void {
    if (this.grid[cell.row]?.[cell.col]?.id === cell.id) {
      this.grid[cell.row][cell.col] = null;
    }
    const group = this.cellMeshMap.get(cell.id);
    const wPos = this.gridToWorld(cell.row, cell.col);
    if (group) {
      this.bubblesGroup.remove(group);
      this.cellMeshMap.delete(cell.id);
    }

    if (cell.trappedPower) {
      this.grantFreedPower(cell.trappedPower, wPos.x, wPos.y);
    }

    const popMesh = new THREE.Mesh(
      this.sharedSphereGeo,
      this.getMaterialForBubble(cell.color, cell.special),
    );
    popMesh.position.set(wPos.x, wPos.y, 0);
    this.scene.add(popMesh);
    this.poppingMeshes.push({
      mesh: popMesh,
      data: {
        x: wPos.x,
        y: wPos.y,
        color: cell.color,
        special: cell.special,
        progress: 0,
        duration: 0.15,
      },
    });

    this.spawnBurstParticles(wPos.x, wPos.y, BUBBLE_PALETTE[cell.color].num, 6, 4.8);
    if (bonusScore > 0) {
      this.addScore(bonusScore);
    }
  }

  private resolveFloatingClusters(multiplier: number): void {
    const connected = new Set<number>();
    const queue: GridCell[] = [];

    for (const topCell of this.grid[0]) {
      if (topCell) {
        connected.add(topCell.id);
        queue.push(topCell);
      }
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const n of this.getNeighbors(curr.row, curr.col)) {
        const nb = this.grid[n.row][n.col];
        if (nb && !connected.has(nb.id)) {
          connected.add(nb.id);
          queue.push(nb);
        }
      }
    }

    const detached: GridCell[] = [];
    for (let r = 0; r < MAX_ROWS; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        const cell = this.grid[r][c];
        if (cell && !connected.has(cell.id)) {
          detached.push(cell);
          this.grid[r][c] = null;
          const g = this.cellMeshMap.get(cell.id);
          if (g) {
            this.bubblesGroup.remove(g);
            this.cellMeshMap.delete(cell.id);
          }
        }
      }
    }

    if (detached.length === 0) return;

    let cascadeScore = 0;
    let avgX = 0;
    let avgY = 0;

    detached.forEach((cell, idx) => {
      const wPos = this.gridToWorld(cell.row, cell.col);
      if (cell.trappedPower) {
        this.grantFreedPower(cell.trappedPower, wPos.x, wPos.y);
      }
      avgX += wPos.x;
      avgY += wPos.y;
      const itemPts = Math.round(
        Math.min(640, 30 * Math.pow(1.35, Math.min(idx, 9))) * multiplier,
      );
      cascadeScore += itemPts;

      const fallObj: FallingBubble = {
        id: cell.id,
        x: wPos.x,
        y: wPos.y,
        z: 0.15,
        vx: (Math.random() - 0.5) * 3.8,
        vy: 2.2 + Math.random() * 2.0,
        vz: 1.4 + Math.random() * 2.2,
        rotX: 0,
        rotY: 0,
        vRotX: (Math.random() - 0.5) * 6,
        vRotY: (Math.random() - 0.5) * 6,
        color: cell.color,
        special: cell.special,
        points: itemPts,
        life: 0,
      };
      this.fallingBubbles.push(fallObj);

      const fMesh = new THREE.Mesh(
        this.sharedSphereGeo,
        this.getMaterialForBubble(cell.color, cell.special),
      );
      fMesh.position.set(fallObj.x, fallObj.y, fallObj.z);
      this.scene.add(fMesh);
      this.fallingMeshMap.set(fallObj.id, fMesh);
    });

    avgX /= detached.length;
    avgY /= detached.length;

    this.addScore(cascadeScore);
    this.chargePowerMeter(detached.length * 14);
    this.sound.playCascadeDrop(detached.length);
    if (detached.length >= 4) {
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.2);
    }

    this.spawnScorePopup(
      avgX,
      avgY,
      `+${cascadeScore} AVALANCHE (${detached.length})`,
      '#34d399',
    );
  }

  private applyCeilingPenalty(): void {
    this.ceilingDropsCount++;
    this.sound.playCeilingDrop();
    this.shakeIntensity = 0.24;

    if (this.mode === GameMode.Campaign) {
      this.ceilingDropTargetY += ROW_STEP_Y;
    } else {
      this.rowParityOffset = (this.rowParityOffset + 1) % 2;
      const newGrid: (GridCell | null)[][] = Array.from({ length: MAX_ROWS }, (_, r) =>
        Array.from({ length: this.getColsForRow(r) }, () => null),
      );

      for (let r = MAX_ROWS - 2; r >= 0; r--) {
        for (let c = 0; c < this.grid[r].length; c++) {
          const cell = this.grid[r][c];
          if (cell && c < newGrid[r + 1].length) {
            cell.row = r + 1;
            newGrid[r + 1][c] = cell;
          }
        }
      }

      const cols0 = this.getColsForRow(0);
      const colorsPool = ALL_COLORS.slice(
        0,
        Math.min(6, 4 + Math.floor(this.ceilingDropsCount / 3)),
      );
      for (let c = 0; c < cols0; c++) {
        const rand = Math.random();
        let special = BubbleSpecial.None;
        if (rand < 0.04) special = BubbleSpecial.Bomb;
        else if (rand >= 0.04 && rand < 0.08) special = BubbleSpecial.Rainbow;

        const cell: GridCell = {
          id: this.nextEntityId++,
          row: 0,
          col: c,
          color: colorsPool[Math.floor(Math.random() * colorsPool.length)],
          special,
          frozen: false,
          trappedPower:
            c === 4 && this.ceilingDropsCount % 2 === 0 ? this.selectedPowerTarget : null,
          scale: 0.85,
          wobble: 0.15,
          wobbleVel: 0,
          hitFlash: 0,
        };
        newGrid[0][c] = cell;
      }

      this.grid = newGrid;
      this.rebuildAllGridMeshes();
    }
  }

  private checkBoardOutcome(clearedAny: boolean): void {
    const remaining = this.countRemainingClearableBubbles();
    if (remaining === 0 && this.mode === GameMode.Endless) {
      this.resolveFloatingClusters(1);
      this.addScore(500);
      this.spawnScorePopup(0, 1.2, '+500 WAVE CLEARED!', '#fbbf24');
      for (let w = 0; w < 3; w++) {
        this.applyCeilingPenalty();
      }
      this.missesCount = 0;
      if (this.currentSpecial === BubbleSpecial.None) {
        this.currentColor = this.pickSmartRemainingColor();
      }
      if (this.nextSpecial === BubbleSpecial.None) {
        this.nextColor = this.pickSmartRemainingColor();
      }
      this.syncLauncherOrbMaterials();
      this.recomputeVerticalScrollTarget(false);
      this.sound.playVictory();
      return;
    }

    if (remaining === 0 && (this.mode === GameMode.Campaign || this.mode === GameMode.Daily)) {
      this.resolveFloatingClusters(1);
      this.refundCurrentlyLoadedSpecial();

      const stage =
        this.mode === GameMode.Daily
          ? getDailyStageForToday()
          : getStageForLevel(this.stageIndex + 1, this.difficultyMode);

      if (this.shotsFired <= stage.parShots) this.starsEarned = 3;
      else if (this.shotsFired <= Math.round(stage.parShots * 1.4)) this.starsEarned = 2;
      else this.starsEarned = 1;

      const clearBonus =
        this.starsEarned * 1000 +
        this.shotsRemaining * 40 +
        (this.mode === GameMode.Daily ? 2500 : 0);
      this.addScore(clearBonus);

      if (this.mode === GameMode.Daily) {
        // Daily Level Win Reward: Strictly ONLY [20, 25, 30] base Coins (random pick),
        // scaled by 1.2^(playerWorld - 1) across all subsequent Worlds!
        const playerWorld = getWorldNumberForLevel(this.unlockedStage);
        const dailyReward = rollDailyStageCoinReward(playerWorld);
        this.coins += dailyReward;
        this.coinsEarnedLastWin = dailyReward;
        this.saveEconomyState();
        this.sound.playDailyReward();

        const todayKey = getTodayDateKey();
        this.dailyCompletedDate = todayKey;
        try {
          localStorage.setItem('aetheris_daily_completed_date', todayKey);
        } catch {
          // Ignore storage errors
        }
        this.happyTimer = 2.0;
        this.missTimer = 0;
        this.dangerProximity = false;
        this.phase = GamePhase.Victory;
        this.launcher.sorceress.syncGameplayEmotion('win');
        this.sound.playVictory();
        this.emitHud();
        return;
      }

      // Award Exact Per-World Star Coins (World 1: 20 / 15 / 5; Next Worlds: x 1.2)!
      const coinReward = calculateStageCoinReward(stage.worldNumber, this.starsEarned);
      this.coins += coinReward;
      this.coinsEarnedLastWin = coinReward;
      this.saveEconomyState();
      this.sound.playCoinEarn();

      const currentNum = stage.stageNumber;
      const worldBounds = getWorldLevelBounds(stage.worldNumber);
      this.stageStars[currentNum] = Math.max(
        this.stageStars[currentNum] || 0,
        this.starsEarned,
      );
      this.stageStarsSnapshot = { ...this.stageStars };
      if (currentNum >= this.unlockedStage && currentNum < MAX_UNLIMITED_LEVELS) {
        this.unlockedStage = currentNum + 1;
      }
      try {
        localStorage.setItem('aetheris_unlocked_stage', String(this.unlockedStage));
        localStorage.setItem('aetheris_stage_stars', JSON.stringify(this.stageStars));
      } catch {
        // Ignore storage errors
      }

      this.happyTimer = 2.0;
      this.missTimer = 0;
      this.dangerProximity = false;

      if (currentNum === worldBounds.endLevel && stage.worldNumber < TOTAL_WORLDS) {
        this.justCompletedWorld = true;
        this.transitionFromWorld = stage.worldNumber;
        this.transitionToWorld = Math.min(TOTAL_WORLDS, stage.worldNumber + 1);
        this.phase = GamePhase.WorldTransition;
        this.sound.playWorldFlightCutscene();
        this.emitHud();
        return;
      }

      this.justCompletedWorld = false;
      this.phase = GamePhase.Victory;
      this.launcher.sorceress.syncGameplayEmotion('win');
      this.sound.playVictory();
      this.emitHud();
      return;
    }

    this.recomputeVerticalScrollTarget(false);

    if (this.mode === GameMode.Campaign || this.mode === GameMode.Daily) {
      if (this.shotsRemaining <= 0 && remaining > 0) {
        this.loseReason = 'out_of_bubbles';
        this.dangerProximity = true;
        this.triggerGameOver();
        return;
      }
      this.dangerProximity = this.shotsRemaining <= 5;
    } else {
      let lowestY = Infinity;
      for (let r = 0; r < MAX_ROWS; r++) {
        for (const cell of this.grid[r]) {
          if (!cell) continue;
          const pos = this.gridToLogicalWorld(cell.row, cell.col);
          const bottomEdge = pos.y - BUBBLE_RADIUS;
          if (bottomEdge < lowestY) lowestY = bottomEdge;
          if (bottomEdge <= DANGER_LINE_Y + 0.05) {
            this.loseReason = 'danger_line';
            this.dangerProximity = true;
            this.triggerGameOver();
            return;
          }
        }
      }
      this.dangerProximity = lowestY <= DANGER_LINE_Y + 2.2;
    }

    // Bug Fix: Only refresh currentColor if no special power is loaded AND that color was completely cleared!
    if (clearedAny && remaining > 0) {
      let updated = false;
      if (
        this.currentSpecial === BubbleSpecial.None &&
        !this.isColorPresentOnBoard(this.currentColor)
      ) {
        this.currentColor = this.pickSmartRemainingColor();
        updated = true;
      }
      if (
        this.nextSpecial === BubbleSpecial.None &&
        !this.isColorPresentOnBoard(this.nextColor)
      ) {
        this.nextColor = this.pickSmartRemainingColor();
        updated = true;
      }
      if (updated) {
        this.syncLauncherOrbMaterials();
      }
    }
  }

  private triggerGameOver(): void {
    this.refundCurrentlyLoadedSpecial();
    this.restorePracticeInventoryIfNeeded();
    this.saveEconomyState();
    this.phase = GamePhase.GameOver;
    this.launcher.sorceress.syncGameplayEmotion('upset');
    this.sound.playEmoteSound('angry', this.equippedAnimations.angry);
    this.sound.playGameOver();
    this.emitHud();
  }

  private addScore(points: number): void {
    this.score += points;
    // Endless Mode is pure Practice Mode — do not overwrite Campaign/Daily high score!
    if (this.mode !== GameMode.Endless && this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('aetheris_high_score', String(this.highScore));
      } catch {
        // Ignore storage error
      }
    }
  }

  private chargePowerMeter(amount: number): void {
    this.powerCharge += amount;
    while (this.powerCharge >= 100) {
      this.powerCharge -= 100;
      const roll = Math.random();
      if (roll < 0.3) this.availablePowers.bomb++;
      else if (roll < 0.6) this.availablePowers.rainbow++;
      else if (roll < 0.85) this.availablePowers.lightning++;
      else this.availablePowers.fireball++;

      this.spawnScorePopup(0, LAUNCHER_Y + 1.8, 'WORLD POWER CHARGED!', '#f59e0b');
    }
  }

  // ============================================================================
  // SHOCKWAVES, PARTICLES & FLOATING POPUPS
  // ============================================================================

  private spawnShockwaveRing(
    x: number,
    y: number,
    colorHex: number,
    maxRadius: number,
    duration: number,
  ): void {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.sharedShockwaveGeo, mat);
    mesh.position.set(x, y, 0.28);
    mesh.scale.setScalar(0.3);
    this.scene.add(mesh);
    this.shockwaveMeshes.push({
      mesh,
      mat,
      data: {
        x,
        y,
        colorHex,
        progress: 0,
        duration,
        maxRadius,
      },
    });
  }

  private spawnBurstParticles(
    x: number,
    y: number,
    colorHex: number,
    count: number,
    speed: number,
  ): void {
    let spawned = 0;
    for (let i = 0; i < this.maxParticles && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        const angle = Math.random() * Math.PI * 2;
        const elev = (Math.random() - 0.35) * speed;
        const spd = (0.35 + Math.random() * 0.65) * speed;
        p.active = true;
        p.x = x;
        p.y = y;
        p.z = 0.25;
        p.vx = Math.cos(angle) * spd;
        p.vy = Math.sin(angle) * spd;
        p.vz = Math.abs(elev) + 0.8;
        p.scale = 0.7 + Math.random() * 0.8;
        p.life = 0;
        p.maxLife = 0.36 + Math.random() * 0.24;
        p.colorHex = colorHex;
        this.particleMesh.setColorAt(i, _particleColor.setHex(colorHex));
        spawned++;
      }
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private spawnScorePopup(
    worldX: number,
    worldY: number,
    text: string,
    colorHex: string,
  ): void {
    _projVec.set(worldX, worldY, 0.4).project(this.camera);
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const screenX = (_projVec.x * 0.5 + 0.5) * w;
    const screenY = (-_projVec.y * 0.5 + 0.5) * h;

    this.popups.push({
      id: this.nextEntityId++,
      screenX,
      screenY,
      text,
      colorHex,
      age: 0,
    });
    if (this.popups.length > 5) {
      this.popups.shift();
    }
  }

  // ============================================================================
  // INPUT HANDLING
  // ============================================================================

  private onKeyDown(e: KeyboardEvent): void {
    const code = e.code;
    this.keysHeld.add(code);

    if (
      this.phase === GamePhase.IntroLoading ||
      this.phase === GamePhase.LevelRoad ||
      this.phase === GamePhase.WorldTransition
    ) {
      return;
    }

    if (code === 'Escape' || code === 'KeyP') {
      e.preventDefault();
      this.togglePause();
      return;
    }

    if (this.phase !== GamePhase.Playing) return;

    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
      e.preventDefault();
      this.fireBubble();
    } else if (code === 'KeyC' || code === 'ShiftLeft' || code === 'ShiftRight') {
      e.preventDefault();
      this.swapBubbles();
    } else if (code === 'Digit1') {
      this.equipPowerBubble('bomb');
    } else if (code === 'Digit2') {
      this.equipPowerBubble('rainbow');
    } else if (code === 'Digit3') {
      this.equipPowerBubble('lightning');
    } else if (code === 'Digit4') {
      this.equipPowerBubble('fireball');
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysHeld.delete(e.code);
  }

  private computeWorldPointOnBoard(
    clientX: number,
    clientY: number,
  ): { worldX: number; worldY: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    _vec3.set(ndcX, ndcY, 0.5).unproject(this.camera);
    const dirX = _vec3.x - this.camera.position.x;
    const dirY = _vec3.y - this.camera.position.y;
    const dirZ = _vec3.z - this.camera.position.z;
    if (Math.abs(dirZ) < 0.0001) return null;

    const t = -this.camera.position.z / dirZ;
    return {
      worldX: this.camera.position.x + dirX * t,
      worldY: this.camera.position.y + dirY * t,
    };
  }

  private evaluatePointerAim(
    clientX: number,
    clientY: number,
    isInitialDown: boolean,
  ): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const pt = this.computeWorldPointOnBoard(clientX, clientY);
    if (clientY < this.pointerMinClientY) {
      this.pointerMinClientY = clientY;
    }

    const pulledDownFromPeak = clientY - this.pointerMinClientY >= 38;
    const pulledDownFromStart = !isInitialDown && clientY - this.pointerStartClientY >= 24;
    const inBottomCancelZone =
      !pt ||
      pt.worldY <= LAUNCHER_Y + 0.55 ||
      clientY >= rect.bottom - rect.height * 0.14;

    if (
      pulledDownFromPeak ||
      inBottomCancelZone ||
      (pulledDownFromStart && (!pt || pt.worldY <= LAUNCHER_Y + 2.4))
    ) {
      this.aimCanceled = true;
      return;
    }

    if (this.aimCanceled) {
      // Only re-engage aim if player deliberately slides back up onto the upper board
      if (pt && pt.worldY > LAUNCHER_Y + 1.35 && clientY < this.pointerMinClientY + 18) {
        this.aimCanceled = false;
        this.pointerMinClientY = clientY;
      } else {
        return;
      }
    }

    const dx = pt.worldX;
    const dy = Math.max(0.32, pt.worldY - LAUNCHER_Y);
    const rawAngle = Math.atan2(dy, dx);
    const minAngle = THREE.MathUtils.degToRad(12);
    const maxAngle = THREE.MathUtils.degToRad(168);
    this.targetAimAngle = THREE.MathUtils.clamp(rawAngle, minAngle, maxAngle);
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button === 2) return;
    if (this.phase !== GamePhase.Playing) return;

    const pt = this.computeWorldPointOnBoard(e.clientX, e.clientY);
    if (pt) {
      const distToReserve = Math.hypot(pt.worldX - 2.05, pt.worldY - (LAUNCHER_Y - 0.06));
      if (distToReserve <= 1.05) {
        this.swapBubbles();
        return;
      }
    }

    if (this.activeProjectile) return;

    this.activeAimPointerId = e.pointerId;
    this.pointerStartClientY = e.clientY;
    this.pointerMinClientY = e.clientY;
    this.aimCanceled = false;

    this.evaluatePointerAim(e.clientX, e.clientY, true);
    if (!this.aimCanceled) {
      this.aimAngle = this.targetAimAngle;
    }

    try {
      this.renderer.domElement.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.phase !== GamePhase.Playing) return;
    // Aim line & aim tracking stay strictly OFF until the player touches/holds down!
    if (this.activeAimPointerId !== e.pointerId) return;
    this.evaluatePointerAim(e.clientX, e.clientY, false);
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.activeAimPointerId !== e.pointerId) return;
    const shouldFire =
      this.phase === GamePhase.Playing && !this.aimCanceled && !this.activeProjectile;

    this.activeAimPointerId = null;
    this.aimCanceled = false;

    try {
      this.renderer.domElement.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore release errors
    }

    if (shouldFire) {
      this.aimAngle = this.targetAimAngle;
      this.fireBubble();
    }
  }

  private onPointerCancel(e: PointerEvent): void {
    if (this.activeAimPointerId === e.pointerId) {
      this.activeAimPointerId = null;
      this.aimCanceled = true;
    }
  }

  private onResize(): void {
    if (this.destroyed) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    const aspect = width / height;

    this.camera.aspect = aspect;

    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const tanHalfVFov = Math.tan(vFovRad * 0.5);
    const tanHalfHFov = tanHalfVFov * aspect;

    const arenaRequiredHalfW = aspect < 0.78 ? 5.45 : 5.95;
    const arenaRequiredHalfH = aspect < 0.78 ? 8.55 : 7.8;

    const distForWidth = arenaRequiredHalfW / Math.max(0.18, tanHalfHFov);
    const distForHeight = arenaRequiredHalfH / tanHalfVFov;

    this.cameraBaseZ = THREE.MathUtils.clamp(
      Math.max(distForWidth, distForHeight),
      18.2,
      35.5,
    );
    this.cameraMobileYShift = aspect < 0.78 ? -0.32 : -0.08;

    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 3.0),
    );
    this.renderer.setSize(width, height, false);
  }

  private cameraBaseZ = 19.6;
  private cameraMobileYShift = 0;

  // ============================================================================
  // 60FPS CRISP HD ANIMATION LOOP
  // ============================================================================

  private startLoop(): void {
    this.lastTimestamp = performance.now();
    const tick = () => {
      if (this.destroyed) return;
      const now = performance.now();
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      // Pause 3D Arena WebGL draw completely when full-screen Menu / Intro / Flight Video covers canvas!
      const isCoveredByMenu =
        this.phase === GamePhase.IntroLoading ||
        this.phase === GamePhase.LevelRoad ||
        this.phase === GamePhase.WorldTransition;

      if (!isCoveredByMenu) {
        this.stepSimulation(dt, now * 0.001);
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.destroyed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private stepSimulation(dt: number, elapsedSec: number): void {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    if (this.phase === GamePhase.Playing) {
      const aimSpeed = 1.85;
      if (this.keysHeld.has('ArrowLeft') || this.keysHeld.has('KeyA')) {
        this.targetAimAngle = Math.min(
          THREE.MathUtils.degToRad(167),
          this.targetAimAngle + aimSpeed * dt,
        );
      }
      if (this.keysHeld.has('ArrowRight') || this.keysHeld.has('KeyD')) {
        this.targetAimAngle = Math.max(
          THREE.MathUtils.degToRad(13),
          this.targetAimAngle - aimSpeed * dt,
        );
      }
    }

    this.aimAngle = THREE.MathUtils.damp(this.aimAngle, this.targetAimAngle, 18, dt);
    this.recoilOffset = THREE.MathUtils.damp(this.recoilOffset, 0, 14, dt);

    if (this.wandCastTimer > 0) this.wandCastTimer = Math.max(0, this.wandCastTimer - dt);
    if (this.happyTimer > 0) this.happyTimer = Math.max(0, this.happyTimer - dt);
    if (this.missTimer > 0) this.missTimer = Math.max(0, this.missTimer - dt);

    const rotZ = this.aimAngle - Math.PI / 2;
    this.launcher.turretPivot.rotation.z = rotZ;
    this.launcher.barrelRecoilGroup.position.y = -this.recoilOffset;
    this.launcher.gears[0].rotation.z = elapsedSec * 0.45 + rotZ;
    this.launcher.gears[1].rotation.z = -elapsedSec * 0.7 - rotZ;
    if (this.launcher.gears[2]) {
      this.launcher.gears[2].rotation.z = elapsedSec * 0.95 + rotZ * 0.5;
    }
    this.launcher.loadedOrbMesh.visible = !this.activeProjectile;
    if (this.launcher.loadedPowerHalo.visible) {
      this.launcher.loadedPowerHalo.rotation.z = elapsedSec * 3.6;
      const pulse = 1 + Math.sin(elapsedSec * 6.5) * 0.08;
      this.launcher.loadedPowerHalo.scale.setScalar(pulse);
    }

    // Update Emotional State & Smooth THREE.AnimationMixer on 3D GLB Sorceress!
    let targetEmotion: GirlEmotionState = 'idle';
    if (this.phase === GamePhase.Victory) {
      targetEmotion = 'win';
    } else if (this.phase === GamePhase.GameOver) {
      targetEmotion = 'upset';
    } else if (this.happyTimer > 0) {
      targetEmotion = 'happy';
    } else if (this.missTimer > 0) {
      targetEmotion = 'miss';
    } else if (this.dangerProximity && this.phase === GamePhase.Playing) {
      targetEmotion = 'upset';
    }

    if (targetEmotion !== this.girlEmotion) {
      this.girlEmotion = targetEmotion;
      this.launcher.sorceress.syncGameplayEmotion(targetEmotion);
      this.emitHud();
    }

    // Subtle body turn toward aim angle while keeping pedestal steady
    this.launcher.sorceress.holder.rotation.y = 0.28 - rotZ * 0.18;
    this.launcher.sorceress.update(dt, elapsedSec);

    if (targetEmotion === 'win') {
      this.winSparkleTimer -= dt;
      if (this.winSparkleTimer <= 0) {
        this.winSparkleTimer = 0.48;
        this.launcher.sorceress.getWandTipWorldPosition(_vec3);
        this.spawnBurstParticles(_vec3.x, _vec3.y + 0.2, 0xfbbf24, 10, 5.5);
      }
    }

    const castBoost = this.wandCastTimer > 0 ? (this.wandCastTimer / 0.45) * 2.5 : 0;
    this.launcher.wandLight.intensity = 2.8 + castBoost;

    // Smooth Vertical Tall-Board Scroll & Ceiling Beam
    this.scrollVisualY = THREE.MathUtils.damp(this.scrollVisualY, this.scrollTargetY, 5.6, dt);
    this.ceilingDropVisualY = THREE.MathUtils.damp(
      this.ceilingDropVisualY,
      this.ceilingDropTargetY,
      10,
      dt,
    );
    const beamY = TOP_BASE_Y + this.scrollVisualY - this.ceilingDropVisualY + 0.68;
    this.arena.ceilingBeamGroup.position.y = beamY;
    const rodLen = Math.max(0.4, TOP_BASE_Y + 14.0 - beamY);
    for (const rod of this.arena.pistonRods) {
      rod.scale.y = rodLen;
      rod.position.y = beamY + rodLen * 0.5;
    }
    this.arena.dangerBarMesh.visible = this.mode === GameMode.Endless;

    // Grid Bubbles Update
    for (let r = 0; r < MAX_ROWS; r++) {
      for (const cell of this.grid[r]) {
        if (!cell) continue;
        const g = this.cellMeshMap.get(cell.id);
        if (!g) continue;

        const wPos = this.gridToWorld(cell.row, cell.col);
        g.position.x = wPos.x;
        g.position.y = wPos.y;

        if (cell.trappedPower) {
          const halo = g.getObjectByName('powerHalo');
          if (halo) halo.rotation.z = elapsedSec * 2.4;
          const badge = g.getObjectByName('powerBadge');
          if (badge) {
            badge.scale.setScalar(1 + Math.sin(elapsedSec * 4.5) * 0.1);
          }
        }

        if (cell.scale < 1) {
          cell.scale = THREE.MathUtils.damp(cell.scale, 1, 16, dt);
        }
        if (Math.abs(cell.wobble) > 0.001 || Math.abs(cell.wobbleVel) > 0.001) {
          const force = -180 * cell.wobble - 12 * cell.wobbleVel;
          cell.wobbleVel += force * dt;
          cell.wobble += cell.wobbleVel * dt;
          g.scale.set(
            cell.scale * (1 + cell.wobble),
            cell.scale * (1 - cell.wobble * 0.8),
            cell.scale,
          );
        } else if (cell.wobble !== 0) {
          cell.wobble = 0;
          g.scale.setScalar(cell.scale);
        }
      }
    }

    if (this.phase === GamePhase.Playing && this.activeProjectile) {
      this.updateProjectile(dt);
    }

    // Aiming Laser Dots & Ghost Ring — Strictly hidden until player touches/holds down!
    const isKeyboardAiming =
      this.keysHeld.has('ArrowLeft') ||
      this.keysHeld.has('ArrowRight') ||
      this.keysHeld.has('KeyA') ||
      this.keysHeld.has('KeyD');
    const showAimLine =
      this.phase === GamePhase.Playing &&
      !this.activeProjectile &&
      ((this.activeAimPointerId !== null && !this.aimCanceled) || isKeyboardAiming);

    if (showAimLine) {
      const { points, snapTarget } = this.computeAimTrajectory();
      const pulseOffset = (elapsedSec * 3.5) % 1;
      for (let i = 0; i < this.aimDotMeshes.length; i++) {
        const m = this.aimDotMeshes[i];
        if (i < points.length) {
          m.visible = true;
          m.position.set(points[i].x, points[i].y, 0.12);
          const fade = 1 - (i / Math.max(1, points.length)) * 0.65;
          m.scale.setScalar((0.8 + 0.25 * Math.sin(i * 0.5 - pulseOffset * Math.PI * 2)) * fade);
        } else {
          m.visible = false;
        }
      }
      if (snapTarget) {
        this.ghostSnapRing.visible = true;
        this.ghostSnapRing.position.set(snapTarget.x, snapTarget.y, 0.18);
        this.ghostSnapRing.rotation.z = elapsedSec * 1.8;
      } else {
        this.ghostSnapRing.visible = false;
      }
    } else {
      for (const m of this.aimDotMeshes) m.visible = false;
      this.ghostSnapRing.visible = false;
    }

    // Falling Avalanche Bubbles
    for (let i = this.fallingBubbles.length - 1; i >= 0; i--) {
      const fb = this.fallingBubbles[i];
      fb.vy -= 26.0 * dt;
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;
      fb.z += fb.vz * dt;
      fb.rotX += fb.vRotX * dt;
      fb.rotY += fb.vRotY * dt;
      fb.life += dt;

      const mesh = this.fallingMeshMap.get(fb.id);
      if (mesh) {
        mesh.position.set(fb.x, fb.y, fb.z);
        mesh.rotation.set(fb.rotX, fb.rotY, 0);
      }

      if (fb.y < LAUNCHER_Y - 3.5 || fb.life > 2.0) {
        if (mesh) {
          this.scene.remove(mesh);
          this.fallingMeshMap.delete(fb.id);
        }
        this.fallingBubbles.splice(i, 1);
      }
    }

    // Popping Scale-Burst Meshes
    for (let i = this.poppingMeshes.length - 1; i >= 0; i--) {
      const item = this.poppingMeshes[i];
      item.data.progress += dt / item.data.duration;
      if (item.data.progress >= 1) {
        this.scene.remove(item.mesh);
        this.poppingMeshes.splice(i, 1);
      } else {
        const s = 1 + item.data.progress * 0.55;
        item.mesh.scale.setScalar(s * (1 - item.data.progress * 0.5));
      }
    }

    // 3D Shockwave Rings (for Store & World Powers!)
    for (let i = this.shockwaveMeshes.length - 1; i >= 0; i--) {
      const sw = this.shockwaveMeshes[i];
      sw.data.progress += dt / sw.data.duration;
      if (sw.data.progress >= 1) {
        this.scene.remove(sw.mesh);
        sw.mat.dispose();
        this.shockwaveMeshes.splice(i, 1);
      } else {
        const eased = 1 - Math.pow(1 - sw.data.progress, 2);
        sw.mesh.scale.setScalar(0.3 + eased * sw.data.maxRadius * 2.0);
        sw.mat.opacity = (1 - sw.data.progress) * 0.9;
      }
    }

    // Instanced Particles
    let anyParticlesChanged = false;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyParticlesChanged = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummyObj.position.set(0, -999, 0);
        _dummyObj.scale.setScalar(0.0001);
        _dummyObj.updateMatrix();
        this.particleMesh.setMatrixAt(i, _dummyObj.matrix);
        continue;
      }
      p.vy -= 14.0 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const ratio = 1 - p.life / p.maxLife;
      _dummyObj.position.set(p.x, p.y, p.z);
      _dummyObj.rotation.set(p.life * 6, p.life * 4, 0);
      _dummyObj.scale.setScalar(p.scale * ratio);
      _dummyObj.updateMatrix();
      this.particleMesh.setMatrixAt(i, _dummyObj.matrix);
    }
    if (anyParticlesChanged) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }

    // Score Popups Cleanup (smooth float animation runs purely on GPU via CSS!)
    if (this.popups.length > 0) {
      let changed = false;
      for (let i = this.popups.length - 1; i >= 0; i--) {
        this.popups[i].age += dt;
        if (this.popups[i].age >= 1.1) {
          this.popups.splice(i, 1);
          changed = true;
        }
      }
      if (changed) this.emitHud();
    }

    // Camera Choreography
    this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 12, dt);
    const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

    if (this.cameraPreset === CameraPreset.Tactical) {
      _camTargetPos.set(0, 0.35 + this.cameraMobileYShift, this.cameraBaseZ * 1.02);
      _camLookTarget.set(0, 0.35 + this.cameraMobileYShift, 0);
    } else if (this.cameraPreset === CameraPreset.Dynamic) {
      const aimLeanX = Math.cos(this.aimAngle) * 1.45;
      _camTargetPos.set(aimLeanX, -1.55 + this.cameraMobileYShift, this.cameraBaseZ * 0.97);
      _camLookTarget.set(aimLeanX * 0.35, 0.45 + this.cameraMobileYShift, 0);
    } else {
      _camTargetPos.set(0, -0.75 + this.cameraMobileYShift, this.cameraBaseZ);
      _camLookTarget.set(0, 0.38 + this.cameraMobileYShift, 0);
    }

    this.camera.position.x =
      THREE.MathUtils.damp(this.camera.position.x, _camTargetPos.x, 7.5, dt) + shakeX;
    this.camera.position.y =
      THREE.MathUtils.damp(this.camera.position.y, _camTargetPos.y, 7.5, dt) + shakeY;
    this.camera.position.z = THREE.MathUtils.damp(
      this.camera.position.z,
      _camTargetPos.z,
      7.5,
      dt,
    );
    this.camera.lookAt(_camLookTarget);
  }

  private emitHud(): void {
    const isDaily = this.mode === GameMode.Daily;
    const isEndless = this.mode === GameMode.Endless;
    const stage = isDaily
      ? getDailyStageForToday()
      : getStageForLevel(this.stageIndex + 1, this.difficultyMode);
    const worldInfo = getWorldInfo(stage.worldNumber);
    const worldUnlockedMax = this.getUnlockedLevelForWorld(worldInfo.worldNumber);
    const isViewingLockedWorld =
      this.mode === GameMode.Campaign && this.unlockedStage < worldInfo.startLevel;

    this.sound.setMenuMusicActive(this.phase === GamePhase.LevelRoad);

    this.onHudChange({
      phase: this.phase,
      mode: this.mode,
      worldNumber: worldInfo.worldNumber,
      worldName: worldInfo.name,
      worldHazard: worldInfo.hazardName,
      worldSignaturePower: worldInfo.signaturePower,
      stageNumber: stage.stageNumber,
      stageName: isEndless ? 'Endless Practice' : stage.name,
      stageSubtitle: isEndless ? 'Free Aim & Power Practice · 0 Coins' : stage.subtitle,
      stageBriefing: isEndless
        ? 'Pure Practice Mode: Infinite shots, zero risk, and Store Powers used here are never consumed!'
        : stage.briefing,
      stageFeaturedMechanic: isEndless
        ? 'Free Practice Arena · Unlimited Training'
        : stage.featuredMechanic,
      stageDifficultyTier: stage.difficultyTier,
      isMilestoneHard: stage.isMilestoneHard,
      difficultyMode: this.difficultyMode,
      girlEmotion: this.girlEmotion,
      shotsLimit: this.shotsLimit,
      shotsRemaining: this.shotsRemaining,
      parShots: isEndless ? 0 : stage.parShots,
      unlockedStage: worldUnlockedMax,
      globalUnlockedStage: this.unlockedStage,
      isViewingLockedWorld,
      justCompletedWorld: this.justCompletedWorld,
      transitionFromWorld: this.transitionFromWorld,
      transitionToWorld: this.transitionToWorld,
      dailyCompletedToday: this.dailyCompletedDate === getTodayDateKey(),
      dailyLabel: getTodayDisplayLabel(),
      loseReason: this.loseReason,
      selectedPowerTarget: this.selectedPowerTarget,
      stageStars: this.stageStarsSnapshot,
      coins: this.coins,
      coinsEarnedLastWin: this.coinsEarnedLastWin,
      equippedAnimations: { ...this.equippedAnimations },
      equippedShooterIndex: this.equippedShooterIndex,
      storePowersInventory: { ...this.storePowersInventory },
      storePowersBoughtCounts: { ...this.storePowersBoughtCounts },
      score: this.score,
      highScore: this.highScore,
      combo: this.combo,
      maxCombo: this.maxCombo,
      shotsFired: this.shotsFired,
      bubblesRemaining: this.countRemainingClearableBubbles(),
      missesCount: this.missesCount,
      missThreshold: this.missThreshold,
      ceilingDrops: this.ceilingDropsCount,
      currentColor: this.currentColor,
      currentSpecial: this.currentSpecial,
      nextColor: this.nextColor,
      nextSpecial: this.nextSpecial,
      powerCharge: Math.min(100, Math.round(this.powerCharge)),
      starsEarned: this.starsEarned,
      aimAssistLength: this.aimAssistLength,
      colorblindSymbols: this.colorblindSymbols,
      cameraPreset: this.cameraPreset,
      muted: this.sound.isMuted(),
      popups: [...this.popups],
      availablePowers: { ...this.availablePowers },
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.sound.setMenuMusicActive(false);
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.boundResize);
    window.removeEventListener('orientationchange', this.boundResize);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
    window.removeEventListener('blur', this.boundBlur);

    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('pointermove', this.boundPointerMove);
      canvas.removeEventListener('pointerdown', this.boundPointerDown);
      canvas.removeEventListener('pointerup', this.boundPointerUp);
      canvas.removeEventListener('pointercancel', this.boundPointerCancel);
      canvas.removeEventListener('contextmenu', this.boundContextMenu);
      canvas.remove();
    }

    this.sharedSphereGeo?.dispose();
    this.sharedSymbolGeo?.dispose();
    this.sharedPowerBadgeGeo?.dispose();
    this.sharedPowerHaloGeo?.dispose();
    this.sharedShockwaveGeo?.dispose();
    this.sharedIceGeo?.dispose();
    this.sharedFuseGeo?.dispose();
    this.sharedLightningRingGeo?.dispose();
    this.sharedStoneBandGeo?.dispose();
    this.launcher?.dispose();
    this.assets?.dispose();
    this.renderer?.dispose();
  }
}
