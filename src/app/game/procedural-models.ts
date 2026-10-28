import * as THREE from 'three';
import {
  ALL_COLORS,
  ALL_STORE_POWERS,
  BUBBLE_PALETTE,
  BubbleColor,
  PowerKind,
  StorePowerKind,
} from './bubble-types';
import { SorceressRigController } from './sorceress-rig';
import { getShooterDesignMeta, ShooterWingArchetype } from './store-catalog';

export interface ProceduralAssets {
  brassMaterial: THREE.MeshStandardMaterial;
  darkSteelMaterial: THREE.MeshStandardMaterial;
  platinumTrimMaterial: THREE.MeshStandardMaterial;
  obsidianFloorMaterial: THREE.MeshBasicMaterial;
  dangerLineMaterial: THREE.MeshStandardMaterial;
  bubbleShellMaterials: Record<BubbleColor, THREE.MeshPhysicalMaterial>;
  symbolMaterials: Record<BubbleColor, THREE.MeshBasicMaterial>;
  powerBadgeMaterials: Record<PowerKind, THREE.MeshBasicMaterial>;
  storePowerMaterials: Record<StorePowerKind, THREE.MeshPhysicalMaterial>;
  powerCageMaterial: THREE.MeshPhysicalMaterial;
  rainbowMaterial: THREE.MeshPhysicalMaterial;
  bombMaterial: THREE.MeshStandardMaterial;
  lightningMaterial: THREE.MeshStandardMaterial;
  fireballMaterial: THREE.MeshStandardMaterial;
  stoneMaterial: THREE.MeshStandardMaterial;
  iceShellMaterial: THREE.MeshPhysicalMaterial;
  shadowPlaneMaterial: THREE.MeshBasicMaterial;
  dispose: () => void;
}

function createSymbolTexture(symbol: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  ctx.beginPath();
  ctx.arc(128, 128, 84, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10, 15, 30, 0.58)';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 108px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, 128, 132);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPowerBadgeTexture(kind: PowerKind, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  const bgColors: Record<PowerKind, [string, string]> = {
    bomb: ['#fb923c', '#9a3412'],
    rainbow: ['#e879f9', '#6b21a8'],
    lightning: ['#38bdf8', '#0369a1'],
    fireball: ['#f87171', '#991b1b'],
  };

  const [lightHex, darkHex] = bgColors[kind];
  const grad = ctx.createRadialGradient(110, 100, 14, 128, 128, 108);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.28, lightHex);
  grad.addColorStop(0.88, darkHex);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.arc(128, 128, 106, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 6;

  if (kind === 'bomb') {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 64 : 30;
      const px = 128 + Math.cos(ang) * r;
      const py = 128 + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'rainbow') {
    ctx.beginPath();
    const pts = [
      [128, 54],
      [148, 108],
      [202, 128],
      [148, 148],
      [128, 202],
      [108, 148],
      [54, 128],
      [108, 108],
    ];
    pts.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'lightning') {
    ctx.beginPath();
    ctx.moveTo(144, 52);
    ctx.lineTo(86, 134);
    ctx.lineTo(126, 134);
    ctx.lineTo(110, 204);
    ctx.lineTo(172, 118);
    ctx.lineTo(132, 118);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(128, 52);
    ctx.quadraticCurveTo(186, 104, 172, 154);
    ctx.quadraticCurveTo(160, 196, 128, 198);
    ctx.quadraticCurveTo(96, 196, 84, 154);
    ctx.quadraticCurveTo(70, 104, 128, 52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRainbowGradientTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0.0, '#f43f5e');
  grad.addColorStop(0.25, '#f59e0b');
  grad.addColorStop(0.5, '#10b981');
  grad.addColorStop(0.75, '#38bdf8');
  grad.addColorStop(1.0, '#a855f7');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createFloorGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Pure ultra-deep midnight obsidian background — ZERO cloudy nebula fog or white diffuse glare!
  const bg = ctx.createLinearGradient(0, 0, 0, 1024);
  bg.addColorStop(0, '#030611');
  bg.addColorStop(0.5, '#050a19');
  bg.addColorStop(1, '#02050d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 1024);

  // Crisp razor-sharp architectural starlight hairlines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.045)';
  ctx.lineWidth = 1;
  const step = 128;
  for (let x = 0; x <= 1024; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 1024);
    ctx.stroke();
  }
  for (let y = 0; y <= 1024; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }

  // Crisp pinpoint 8K starfield dots (deterministic pattern, zero blur!)
  for (let i = 0; i < 42; i++) {
    const sx = ((i * 211 + 73) % 990) + 17;
    const sy = ((i * 389 + 129) % 990) + 17;
    const r = i % 5 === 0 ? 1.5 : 1.0;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = i % 5 === 0 ? 'rgba(253, 224, 71, 0.45)' : 'rgba(226, 232, 240, 0.32)';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(512, 512, 290, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.05)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 4);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createProceduralAssets(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): ProceduralAssets {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const texturesToDispose: THREE.Texture[] = [];
  const materialsToDispose: THREE.Material[] = [];

  const trackMat = <T extends THREE.Material>(m: T): T => {
    materialsToDispose.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    texturesToDispose.push(t);
    return t;
  };

  // Fast Studio Metals (MeshStandardMaterial avoids expensive multi-lobe physical shader cost)
  const brassMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeab308,
      emissive: 0x713f12,
      emissiveIntensity: 0.14,
      metalness: 0.88,
      roughness: 0.2,
    }),
  );

  const darkSteelMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.72,
      roughness: 0.44,
    }),
  );

  const platinumTrimMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.9,
      roughness: 0.15,
    }),
  );

  const floorTex = trackTex(createFloorGridTexture(maxAniso));
  // Unlit MeshBasicMaterial prevents frontal DirectionalLight + RoomEnvironment from creating milky white haze!
  const obsidianFloorMaterial = trackMat(
    new THREE.MeshBasicMaterial({
      map: floorTex,
      fog: false,
    }),
  );

  const dangerLineMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.4,
    }),
  );

  const bubbleShellMaterials = {} as Record<BubbleColor, THREE.MeshPhysicalMaterial>;
  const symbolMaterials = {} as Record<BubbleColor, THREE.MeshBasicMaterial>;

  const createVividBubbleTexture = (hex: string, darkHex: string): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Ultra-pure saturated 8K jewel base fill with crisp deep contour edge
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, hex);
    grad.addColorStop(0.66, hex);
    grad.addColorStop(1, darkHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Razor-sharp studio jewel highlight (zero milky haze!)
    const spec = ctx.createRadialGradient(184, 134, 8, 184, 134, 148);
    spec.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    spec.addColorStop(0.28, 'rgba(255, 255, 255, 0.2)');
    spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = spec;
    ctx.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  };

  for (const c of ALL_COLORS) {
    const info = BUBBLE_PALETTE[c];
    const vividTex = trackTex(createVividBubbleTexture(info.hex, info.darkHex));
    bubbleShellMaterials[c] = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: vividTex,
        emissive: new THREE.Color(info.hex),
        emissiveIntensity: 0.46,
        roughness: 0.04,
        metalness: 0.02,
        // Low envMapIntensity keeps gold/platinum gleaming while eliminating milky white RoomEnvironment reflection on bubbles!
        envMapIntensity: 0.2,
        clearcoat: isSoftwareGl ? 0 : 1.0,
        clearcoatRoughness: 0.025,
      }),
    );

    const symTex = trackTex(createSymbolTexture(info.symbol, maxAniso));
    symbolMaterials[c] = trackMat(
      new THREE.MeshBasicMaterial({
        map: symTex,
        transparent: true,
        depthWrite: false,
      }),
    );
  }

  const powerKinds: PowerKind[] = ['bomb', 'rainbow', 'lightning', 'fireball'];
  const powerBadgeMaterials = {} as Record<PowerKind, THREE.MeshBasicMaterial>;
  for (const pk of powerKinds) {
    const pTex = trackTex(createPowerBadgeTexture(pk, maxAniso));
    powerBadgeMaterials[pk] = trackMat(
      new THREE.MeshBasicMaterial({
        map: pTex,
        transparent: true,
        depthWrite: false,
      }),
    );
  }

  // Distinct Luminous Materials for all 6 Purchased Store Powers!
  const storeColors: Record<StorePowerKind, { col: number; em: number }> = {
    supernova: { col: 0xfef08a, em: 0xf59e0b },
    aurora: { col: 0xf5d0fe, em: 0xc026d3 },
    meteor: { col: 0xfed7aa, em: 0xea580c },
    crossbolt: { col: 0xbae6fd, em: 0x0284c7 },
    frostburst: { col: 0xa7f3d0, em: 0x059669 },
    celestial_crown: { col: 0xfef9c3, em: 0xeab308 },
  };
  const storePowerMaterials = {} as Record<StorePowerKind, THREE.MeshPhysicalMaterial>;
  for (const sk of ALL_STORE_POWERS) {
    const sc = storeColors[sk];
    storePowerMaterials[sk] = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: sc.col,
        emissive: sc.em,
        emissiveIntensity: 0.95,
        roughness: 0.08,
        metalness: 0.25,
        clearcoat: isSoftwareGl ? 0 : 1.0,
      }),
    );
  }

  const powerCageMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );

  const rainbowTex = trackTex(createRainbowGradientTexture(maxAniso));
  const rainbowMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      map: rainbowTex,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: isSoftwareGl ? 0 : 0.9,
      emissive: 0xffffff,
      emissiveMap: rainbowTex,
      emissiveIntensity: 0.4,
    }),
  );

  const bombMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x18181b,
      emissive: 0xf97316,
      emissiveIntensity: 0.55,
      roughness: 0.32,
      metalness: 0.85,
    }),
  );

  const lightningMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 1.0,
      roughness: 0.14,
      metalness: 0.5,
    }),
  );

  const fireballMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfb923c,
      emissive: 0xea580c,
      emissiveIntensity: 1.15,
      roughness: 0.18,
      metalness: 0.2,
    }),
  );

  const stoneMaterial = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.8,
      metalness: 0.38,
    }),
  );

  const iceShellMaterial = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      emissive: 0x0284c7,
      emissiveIntensity: 0.24,
      roughness: 0.12,
      metalness: 0.05,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    }),
  );

  const shadowTex = trackTex(createRadialShadowTexture());
  const shadowPlaneMaterial = trackMat(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );

  return {
    brassMaterial,
    darkSteelMaterial,
    platinumTrimMaterial,
    obsidianFloorMaterial,
    dangerLineMaterial,
    bubbleShellMaterials,
    symbolMaterials,
    powerBadgeMaterials,
    storePowerMaterials,
    powerCageMaterial,
    rainbowMaterial,
    bombMaterial,
    lightningMaterial,
    fireballMaterial,
    stoneMaterial,
    iceShellMaterial,
    shadowPlaneMaterial,
    dispose: () => {
      texturesToDispose.forEach((t) => t.dispose());
      materialsToDispose.forEach((m) => m.dispose());
    },
  };
}

export interface ShooterTurretCore {
  group: THREE.Group;
  turretPivot: THREE.Group;
  barrelRecoilGroup: THREE.Group;
  gears: THREE.Object3D[];
  loadedOrbMesh: THREE.Mesh;
  loadedPowerHalo: THREE.Mesh;
  setShooterStyle: (designIndex: number) => void;
  dispose: () => void;
}

/**
 * Builds the standalone 3D Bubble Shooter Turret (rings with rune gems, 6 wing archetypes,
 * aiming gimbal, recoil barrel, and chambered orb). Shared by live Gameplay and the
 * Store / Vault Live 3D Shooter Firing Preview!
 */
export function buildShooterTurretCore(
  initialOrbMat: THREE.Material,
  haloMat: THREE.Material,
): ShooterTurretCore {
  const group = new THREE.Group();
  const gears: THREE.Object3D[] = [];
  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometriesToDispose.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materialsToDispose.push(m);
    return m;
  };

  const shooterPrimaryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xeab308,
      emissive: 0x713f12,
      emissiveIntensity: 0.24,
      metalness: 0.88,
      roughness: 0.18,
    }),
  );
  const shooterSecondaryMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      emissive: 0x1e293b,
      emissiveIntensity: 0.16,
      metalness: 0.9,
      roughness: 0.15,
    }),
  );
  const shooterGemMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.05,
      metalness: 0.25,
      roughness: 0.1,
    }),
  );

  const runeNodeGeo = trackGeo(new THREE.OctahedronGeometry(0.085, 0));

  // Ring 1: Outer Enchanted Rune Ring + 4 Cardinal Rune Studs (visibly rotates!)
  const outerRingGroup = new THREE.Group();
  outerRingGroup.position.set(0, 0.52, -0.1);
  const outerRuneRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.86, 0.048, 12, 44)),
    shooterPrimaryMat,
  );
  outerRingGroup.add(outerRuneRing);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const stud = new THREE.Mesh(runeNodeGeo, shooterGemMat);
    stud.position.set(Math.cos(ang) * 0.86, Math.sin(ang) * 0.86, 0.03);
    outerRingGroup.add(stud);
  }
  group.add(outerRingGroup);
  gears.push(outerRingGroup);

  // Ring 2: Inner Counter-Rotating Ring + 4 Diagonal Trim Studs
  const innerRingGroup = new THREE.Group();
  innerRingGroup.position.set(0, 0.52, -0.06);
  const innerRuneRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.66, 0.034, 10, 36)),
    shooterSecondaryMat,
  );
  innerRingGroup.add(innerRuneRing);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const stud = new THREE.Mesh(runeNodeGeo, shooterPrimaryMat);
    stud.scale.setScalar(0.75);
    stud.position.set(Math.cos(ang) * 0.66, Math.sin(ang) * 0.66, 0.02);
    innerRingGroup.add(stud);
  }
  group.add(innerRingGroup);
  gears.push(innerRingGroup);

  // Ring 3: Grand Outer Halo Ring (for 3-Ring Luxury Shooters!) + 6 Starlight Gems
  const grandOuterGroup = new THREE.Group();
  grandOuterGroup.position.set(0, 0.52, -0.14);
  const grandOuterRing = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(1.06, 0.032, 10, 48)),
    shooterGemMat,
  );
  grandOuterGroup.add(grandOuterRing);
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const stud = new THREE.Mesh(runeNodeGeo, shooterSecondaryMat);
    stud.scale.setScalar(0.85);
    stud.position.set(Math.cos(ang) * 1.06, Math.sin(ang) * 1.06, 0.02);
    grandOuterGroup.add(stud);
  }
  grandOuterGroup.visible = false;
  group.add(grandOuterGroup);
  gears.push(grandOuterGroup);

  // Center Base Crest Jewel + Pedestal Arc
  const basePedestal = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.42, 0.56, 0.22, 18)),
    shooterPrimaryMat,
  );
  basePedestal.position.set(0, -0.08, 0.06);
  group.add(basePedestal);

  const baseGemMesh = new THREE.Mesh(
    trackGeo(new THREE.OctahedronGeometry(0.17, 0)),
    shooterGemMat,
  );
  baseGemMesh.position.set(0, 0.04, 0.28);
  group.add(baseGemMesh);

  // Rotating Aiming Gimbal & Recoil Barrel
  const turretPivot = new THREE.Group();
  group.add(turretPivot);

  const barrelRecoilGroup = new THREE.Group();
  turretPivot.add(barrelRecoilGroup);

  const spellCollar = new THREE.Mesh(
    trackGeo(new THREE.TorusGeometry(0.52, 0.046, 10, 32)),
    shooterSecondaryMat,
  );
  spellCollar.position.set(0, 0.92, 0.12);
  barrelRecoilGroup.add(spellCollar);

  // Pre-built 3D Wing Archetype Groups (zero allocation when switching Shooters!)
  const archetypeGroups: Record<ShooterWingArchetype, THREE.Group> = {
    cone: new THREE.Group(),
    blade: new THREE.Group(),
    crystal: new THREE.Group(),
    crescent: new THREE.Group(),
    crown: new THREE.Group(),
    crossbow: new THREE.Group(),
  };

  // 1. 'cone' — Classic Astral Pointer Cones
  {
    const g = archetypeGroups.cone;
    const coneGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.38, 12));
    const leftCone = new THREE.Mesh(coneGeo, shooterPrimaryMat);
    leftCone.position.set(-0.58, 0.94, 0.18);
    leftCone.rotation.z = 0.15;
    g.add(leftCone);

    const rightCone = new THREE.Mesh(coneGeo, shooterPrimaryMat);
    rightCone.position.set(0.58, 0.94, 0.18);
    rightCone.rotation.z = -0.15;
    g.add(rightCone);
    barrelRecoilGroup.add(g);
  }

  // 2. 'blade' — Swept Twin Phoenix / Valkyrie Wings
  {
    const g = archetypeGroups.blade;
    const mainBladeGeo = trackGeo(new THREE.ConeGeometry(0.14, 0.78, 4));
    const subFeatherGeo = trackGeo(new THREE.ConeGeometry(0.09, 0.52, 4));
    const wingGemGeo = trackGeo(new THREE.OctahedronGeometry(0.09, 0));
    for (const side of [-1, 1]) {
      const mainWing = new THREE.Mesh(mainBladeGeo, shooterPrimaryMat);
      mainWing.position.set(side * 0.72, 0.98, 0.16);
      mainWing.rotation.z = -side * 0.38;
      g.add(mainWing);

      const outerFeather = new THREE.Mesh(subFeatherGeo, shooterSecondaryMat);
      outerFeather.position.set(side * 0.96, 0.82, 0.12);
      outerFeather.rotation.z = -side * 0.68;
      g.add(outerFeather);

      const wingGem = new THREE.Mesh(wingGemGeo, shooterGemMat);
      wingGem.position.set(side * 0.62, 0.76, 0.28);
      g.add(wingGem);
    }
    g.visible = false;
    barrelRecoilGroup.add(g);
  }

  // 3. 'crystal' — Floating Faceted Prism Shards
  {
    const g = archetypeGroups.crystal;
    const shardGeo = trackGeo(new THREE.OctahedronGeometry(0.15, 0));
    const positions: [number, number, number][] = [
      [-0.68, 1.06, 0.22],
      [0.68, 1.06, 0.22],
      [-0.84, 0.68, 0.16],
      [0.84, 0.68, 0.16],
    ];
    positions.forEach(([px, py, pz], idx) => {
      const shard = new THREE.Mesh(shardGeo, idx % 2 === 0 ? shooterPrimaryMat : shooterGemMat);
      shard.position.set(px, py, pz);
      shard.scale.set(0.85, 1.45, 0.85);
      shard.rotation.z = px < 0 ? 0.28 : -0.28;
      g.add(shard);
    });
    g.visible = false;
    barrelRecoilGroup.add(g);
  }

  // 4. 'crescent' — Enchanted Lunar / Blossom Bow Cradle
  {
    const g = archetypeGroups.crescent;
    const bowArcGeo = trackGeo(new THREE.TorusGeometry(0.78, 0.055, 12, 36, Math.PI * 1.18));
    const bowArc = new THREE.Mesh(bowArcGeo, shooterPrimaryMat);
    bowArc.position.set(0, 0.96, 0.14);
    bowArc.rotation.z = Math.PI * 0.91;
    g.add(bowArc);

    const tipGemGeo = trackGeo(new THREE.OctahedronGeometry(0.12, 0));
    for (const side of [-1, 1]) {
      const tipGem = new THREE.Mesh(tipGemGeo, shooterGemMat);
      tipGem.position.set(side * 0.76, 1.22, 0.22);
      g.add(tipGem);
    }
    g.visible = false;
    barrelRecoilGroup.add(g);
  }

  // 5. 'crown' — Five-Spire Royal Sunburst Crown
  {
    const g = archetypeGroups.crown;
    const spireGeo = trackGeo(new THREE.ConeGeometry(0.085, 0.42, 6));
    const angles = [-0.72, -0.36, 0, 0.36, 0.72];
    angles.forEach((ang, idx) => {
      if (idx === 2) return;
      const r = 0.68;
      const sx = Math.sin(ang) * r;
      const sy = 0.84 + Math.cos(ang) * 0.36;
      const spire = new THREE.Mesh(
        spireGeo,
        idx % 2 === 0 ? shooterPrimaryMat : shooterSecondaryMat,
      );
      spire.position.set(sx, sy, 0.16);
      spire.rotation.z = -ang * 0.85;
      g.add(spire);
    });
    const crownBandGeo = trackGeo(new THREE.TorusGeometry(0.64, 0.045, 10, 28, Math.PI * 0.9));
    const crownBand = new THREE.Mesh(crownBandGeo, shooterPrimaryMat);
    crownBand.position.set(0, 0.88, 0.18);
    crownBand.rotation.z = Math.PI * 1.05;
    g.add(crownBand);
    g.visible = false;
    barrelRecoilGroup.add(g);
  }

  // 6. 'crossbow' — Precision Twin-Rail Astral Crossbow
  {
    const g = archetypeGroups.crossbow;
    const railGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 0.82, 12));
    const armGeo = trackGeo(new THREE.BoxGeometry(0.58, 0.08, 0.12));
    const coilGeo = trackGeo(new THREE.TorusGeometry(0.12, 0.028, 8, 18));
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, shooterSecondaryMat);
      rail.position.set(side * 0.56, 1.04, 0.18);
      g.add(rail);

      const arm = new THREE.Mesh(armGeo, shooterPrimaryMat);
      arm.position.set(side * 0.82, 0.78, 0.14);
      arm.rotation.z = -side * 0.24;
      g.add(arm);

      const coil = new THREE.Mesh(coilGeo, shooterGemMat);
      coil.position.set(side * 0.56, 1.24, 0.18);
      coil.rotation.x = Math.PI / 2;
      g.add(coil);
    }
    g.visible = false;
    barrelRecoilGroup.add(g);
  }

  const loadedOrbGeo = trackGeo(new THREE.SphereGeometry(0.5, 32, 32));
  const loadedOrbMesh = new THREE.Mesh(loadedOrbGeo, initialOrbMat);
  loadedOrbMesh.position.set(0, 0.96, 0.34);
  barrelRecoilGroup.add(loadedOrbMesh);

  const loadedPowerHaloGeo = trackGeo(new THREE.TorusGeometry(0.64, 0.032, 10, 32));
  const loadedPowerHalo = new THREE.Mesh(loadedPowerHaloGeo, haloMat);
  loadedPowerHalo.position.set(0, 0.96, 0.34);
  loadedPowerHalo.visible = false;
  barrelRecoilGroup.add(loadedPowerHalo);

  const setShooterStyle = (designIndex: number): void => {
    const meta = getShooterDesignMeta(designIndex);
    shooterPrimaryMat.color.setHex(meta.primaryNum);
    shooterPrimaryMat.emissive.setHex(meta.primaryNum).multiplyScalar(0.32);

    shooterSecondaryMat.color.setHex(meta.secondaryNum);
    shooterSecondaryMat.emissive.setHex(meta.secondaryNum).multiplyScalar(0.18);

    shooterGemMat.color.setHex(meta.gemNum);
    shooterGemMat.emissive.setHex(meta.gemNum);

    grandOuterGroup.visible = meta.ringCount >= 3;

    (Object.keys(archetypeGroups) as ShooterWingArchetype[]).forEach((arch) => {
      archetypeGroups[arch].visible = arch === meta.wingArchetype;
    });
  };

  setShooterStyle(0);

  return {
    group,
    turretPivot,
    barrelRecoilGroup,
    gears,
    loadedOrbMesh,
    loadedPowerHalo,
    setShooterStyle,
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
    },
  };
}

/**
 * Builds the Enchanted Spell Ring Launcher + GLB-Rigged 3D Magic Girl ("magic-girl.glb")
 * driven by THREE.AnimationMixer!
 */
export function buildLauncherTurretModel(assets: ProceduralAssets): {
  root: THREE.Group;
  turretPivot: THREE.Group;
  barrelRecoilGroup: THREE.Group;
  gears: THREE.Object3D[];
  loadedOrbMesh: THREE.Mesh;
  loadedPowerHalo: THREE.Mesh;
  reserveOrbMesh: THREE.Mesh;
  sorceress: SorceressRigController;
  wandLight: THREE.PointLight;
  setShooterStyle: (designIndex: number) => void;
  dispose: () => void;
} {
  const root = new THREE.Group();

  // Grounded Soft Radial Contact Shadow
  const shadowGeo = new THREE.PlaneGeometry(5.0, 3.6);
  const shadowMesh = new THREE.Mesh(shadowGeo, assets.shadowPlaneMaterial);
  shadowMesh.position.set(-0.4, -0.45, -0.42);
  root.add(shadowMesh);

  // Core 3D Bubble Shooter Turret
  const shooterCore = buildShooterTurretCore(
    assets.bubbleShellMaterials[BubbleColor.Ruby],
    assets.brassMaterial,
  );
  root.add(shooterCore.group);

  // Right-Side Floating Reserve Bubble Halo (Tap to Swap)
  const reserveDishGeo = new THREE.TorusGeometry(0.46, 0.045, 10, 28);
  const reserveDish = new THREE.Mesh(reserveDishGeo, assets.brassMaterial);
  reserveDish.position.set(2.05, -0.06, 0.12);
  root.add(reserveDish);

  const reserveOrbGeo = new THREE.SphereGeometry(0.46, 28, 28);
  const reserveOrbMesh = new THREE.Mesh(
    reserveOrbGeo,
    assets.bubbleShellMaterials[BubbleColor.Sapphire],
  );
  reserveOrbMesh.position.set(2.05, -0.06, 0.36);
  reserveOrbMesh.scale.setScalar(0.92);
  root.add(reserveOrbMesh);

  // Articulated 3D GLB Magic Girl Character ("magic-girl.glb" v2 + THREE.AnimationMixer!)
  const sorceress = new SorceressRigController();
  sorceress.holder.position.set(-1.54, -0.32, 0.44);
  sorceress.holder.rotation.y = 0.26;
  sorceress.holder.scale.setScalar(1.08);
  root.add(sorceress.holder);

  const wandLight = new THREE.PointLight(0xfffbeb, 2.6, 7.0, 1.4);
  wandLight.position.set(-0.4, 1.05, 2.35);
  root.add(wandLight);

  return {
    root,
    turretPivot: shooterCore.turretPivot,
    barrelRecoilGroup: shooterCore.barrelRecoilGroup,
    gears: shooterCore.gears,
    loadedOrbMesh: shooterCore.loadedOrbMesh,
    loadedPowerHalo: shooterCore.loadedPowerHalo,
    reserveOrbMesh,
    sorceress,
    wandLight,
    setShooterStyle: shooterCore.setShooterStyle,
    dispose: () => {
      shadowGeo.dispose();
      reserveDishGeo.dispose();
      reserveOrbGeo.dispose();
      shooterCore.dispose();
    },
  };
}

export function buildArenaArchitecture(
  assets: ProceduralAssets,
  boardHalfWidth: number,
  topBaseY: number,
  dangerLineY: number,
  bottomY: number,
): {
  arenaGroup: THREE.Group;
  ceilingBeamGroup: THREE.Group;
  pistonRods: THREE.Mesh[];
  dangerBarMesh: THREE.Mesh;
} {
  const arenaGroup = new THREE.Group();

  const extendedTopY = topBaseY + 14.0;
  const totalHeight = extendedTopY - bottomY + 2.4;
  const centerY = (extendedTopY + bottomY) * 0.5;

  const backGeo = new THREE.PlaneGeometry(boardHalfWidth * 2 + 1.2, totalHeight);
  const backMesh = new THREE.Mesh(backGeo, assets.obsidianFloorMaterial);
  backMesh.position.set(0, centerY, -0.58);
  arenaGroup.add(backMesh);

  const railHeight = totalHeight;
  const pillarGeo = new THREE.BoxGeometry(0.42, railHeight, 0.95);
  const bumperTubeGeo = new THREE.CylinderGeometry(0.09, 0.09, railHeight, 16);

  for (const side of [-1, 1]) {
    const sideX = side * (boardHalfWidth + 0.21);
    const pillar = new THREE.Mesh(pillarGeo, assets.darkSteelMaterial);
    pillar.position.set(sideX, centerY, -0.15);
    arenaGroup.add(pillar);

    const innerRail = new THREE.Mesh(bumperTubeGeo, assets.brassMaterial);
    innerRail.position.set(side * (boardHalfWidth + 0.03), centerY, 0.16);
    arenaGroup.add(innerRail);

    for (const capY of [topBaseY + 1.1, 2.2, dangerLineY, bottomY - 0.6]) {
      const bolsterGeo = new THREE.BoxGeometry(0.54, 0.32, 1.08);
      const bolster = new THREE.Mesh(bolsterGeo, assets.platinumTrimMaterial);
      bolster.position.set(sideX, capY, -0.12);
      arenaGroup.add(bolster);
    }
  }

  const ceilingBeamGroup = new THREE.Group();
  const pressBeamGeo = new THREE.BoxGeometry(boardHalfWidth * 2 - 0.04, 0.38, 0.9);
  const pressBeam = new THREE.Mesh(pressBeamGeo, assets.brassMaterial);
  ceilingBeamGroup.add(pressBeam);

  const trimStripGeo = new THREE.BoxGeometry(boardHalfWidth * 2 - 0.1, 0.09, 0.96);
  const trimStrip = new THREE.Mesh(trimStripGeo, assets.platinumTrimMaterial);
  trimStrip.position.y = -0.17;
  ceilingBeamGroup.add(trimStrip);

  ceilingBeamGroup.position.set(0, topBaseY + 0.68, 0.0);
  arenaGroup.add(ceilingBeamGroup);

  const pistonRods: THREE.Mesh[] = [];
  const rodGeo = new THREE.CylinderGeometry(0.11, 0.11, 1.0, 12);
  for (const px of [-boardHalfWidth * 0.62, 0, boardHalfWidth * 0.62]) {
    const rod = new THREE.Mesh(rodGeo, assets.platinumTrimMaterial);
    rod.position.set(px, topBaseY + 2.8, -0.12);
    arenaGroup.add(rod);
    pistonRods.push(rod);
  }

  const dangerGeo = new THREE.CylinderGeometry(0.03, 0.03, boardHalfWidth * 2, 10);
  dangerGeo.rotateZ(Math.PI / 2);
  const dangerBarMesh = new THREE.Mesh(dangerGeo, assets.dangerLineMaterial);
  dangerBarMesh.position.set(0, dangerLineY, 0.05);
  dangerBarMesh.material.polygonOffset = true;
  dangerBarMesh.material.polygonOffsetFactor = -1;
  arenaGroup.add(dangerBarMesh);

  return {
    arenaGroup,
    ceilingBeamGroup,
    pistonRods,
    dangerBarMesh,
  };
}
