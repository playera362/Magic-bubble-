import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AnimCategory, EquippedAnimations, GirlEmotionState } from './bubble-types';
import { buildShooterTurretCore, ShooterTurretCore } from './procedural-models';
import { getShooterDesignMeta } from './store-catalog';

const GLB_MODEL_URL = '/models/magic-girl.glb?v=2';

let cachedGlbTemplate: THREE.Group | null = null;
let glbLoadPromise: Promise<THREE.Group | null> | null = null;
const clipCache = new Map<string, THREE.AnimationClip>();

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

function qFromEuler(rx: number, ry: number, rz: number): [number, number, number, number] {
  _euler.set(rx, ry, rz, 'XYZ');
  _quat.setFromEuler(_euler);
  return [_quat.x, _quat.y, _quat.z, _quat.w];
}

function enhanceGlbMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    // Prevent bounding-sphere frustum culling from ever hiding the hat or wand during animations!
    obj.frustumCulled = false;
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.frustumCulled = false;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.side = THREE.DoubleSide;
    if (mat.name === 'Gown' || mat.name === 'Accent') {
      mat.roughness = 0.38;
      mat.metalness = 0.1;
    } else if (mat.name === 'Gold') {
      mat.metalness = 0.9;
      mat.roughness = 0.16;
    } else if (mat.name === 'Star' || mat.name === 'CrystalCyan') {
      mat.emissiveIntensity = 1.65;
    } else if (mat.name === 'Skin') {
      mat.roughness = 0.52;
      mat.metalness = 0.01;
    }
  });
}

export function preloadSorceressGlb(): Promise<THREE.Group | null> {
  if (cachedGlbTemplate) return Promise.resolve(cachedGlbTemplate);
  if (glbLoadPromise) return glbLoadPromise;

  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  const loader = new GLTFLoader();
  glbLoadPromise = new Promise((resolve) => {
    loader.load(
      GLB_MODEL_URL,
      (gltf) => {
        const sceneRoot = (gltf.scene.getObjectByName('SorceressRoot') as THREE.Group) || gltf.scene;
        enhanceGlbMaterials(sceneRoot);
        cachedGlbTemplate = sceneRoot;
        resolve(sceneRoot);
      },
      undefined,
      () => {
        resolve(null);
      },
    );
  });
  return glbLoadPromise;
}

/**
 * Instant lightweight synchronous fallback hierarchy matching the exact joint names of magic-girl.glb v2
 * so frame 0 renders immediately even before the async /models/magic-girl.glb fetch completes.
 */
function createFallbackRigSkeleton(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'SorceressRoot';
  const joints: [string, string | null, [number, number, number]][] = [
    ['Pedestal', null, [0, 0, 0]],
    ['DaisRing', 'Pedestal', [0, -0.55, 0]],
    ['Pelvis', null, [0, 0.06, 0]],
    ['LeftHip', 'Pelvis', [-0.13, -0.04, 0.01]],
    ['LeftKnee', 'LeftHip', [0, -0.24, 0]],
    ['RightHip', 'Pelvis', [0.13, -0.04, 0.01]],
    ['RightKnee', 'RightHip', [0, -0.24, 0]],
    ['SkirtPivot', 'Pelvis', [0, 0.02, 0]],
    ['Spine', 'Pelvis', [0, 0.22, 0]],
    ['Chest', 'Spine', [0, 0.04, 0]],
    ['LeftShoulder', 'Chest', [-0.205, 0.24, 0.01]],
    ['LeftElbow', 'LeftShoulder', [0, -0.21, 0]],
    ['RightShoulder', 'Chest', [0.205, 0.24, 0.01]],
    ['RightElbow', 'RightShoulder', [0, -0.21, 0]],
    ['WandPivot', 'RightElbow', [0, -0.205, 0.025]],
    ['WandStar', 'WandPivot', [0, 0, 0.75]],
    ['WandTipMarker', 'WandStar', [0, 0, 0.06]],
    ['Neck', 'Chest', [0, 0.28, 0.01]],
    ['Head', 'Neck', [0, 0.23, 0.02]],
    ['EyelidL', 'Head', [-0.094, 0.014, 0.214]],
    ['EyelidR', 'Head', [0.094, 0.014, 0.214]],
    ['BrowL', 'Head', [-0.094, 0.086, 0.228]],
    ['BrowR', 'Head', [0.094, 0.086, 0.228]],
    ['Mouth', 'Head', [0, -0.068, 0.232]],
    ['HairTwinL', 'Head', [-0.23, 0.05, -0.09]],
    ['HairTwinR', 'Head', [0.23, 0.05, -0.09]],
    ['HatGroup', 'Head', [0, 0.175, -0.01]],
  ];
  const map = new Map<string, THREE.Object3D>();
  for (const [name, parentName, pos] of joints) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(pos[0], pos[1], pos[2]);
    if (name === 'Mouth') g.rotation.set(0, 0, Math.PI);
    const parent = parentName ? map.get(parentName) || root : root;
    parent.add(g);
    map.set(name, g);
  }
  return root;
}

/**
 * Generates any of the 5,000 smooth anatomical THREE.AnimationClips (1,000 per category)
 * targeting the hierarchical joints of magic-girl.glb!
 * Note: Pelvis moves/spins independently of Pedestal so the floor dais NEVER floats or spins!
 */
export function getOrCreateSorceressClip(
  category: AnimCategory,
  index: number,
): THREE.AnimationClip {
  const safeIdx = Math.max(0, Math.min(999, Math.floor(index)));
  const cacheKey = `${category}:${safeIdx}`;
  const existing = clipCache.get(cacheKey);
  if (existing) return existing;

  // Keep cache bounded to 96 recently used clips so RAM stays tiny
  if (clipCache.size > 96) {
    const firstKey = clipCache.keys().next().value;
    if (firstKey) clipCache.delete(firstKey);
  }

  const choreo = safeIdx % 10;
  const tier = Math.floor(safeIdx / 10); // 0 .. 99
  const energy = 0.85 + (tier % 7) * 0.08; // 0.85 .. 1.33
  const tempoScale = 0.88 + ((tier * 3) % 5) * 0.07; // 0.88 .. 1.16
  const flairPhase = ((tier % 8) / 8) * Math.PI * 0.5;

  const samples = 9; // t = 0..8 -> seamless loop where u=0 and u=1 match for looping clips!
  let baseDur = 2.2;
  if (category === 'shoot') baseDur = 0.62;
  else if (category === 'happy') baseDur = 1.25;
  else if (category === 'win') baseDur = 1.9;
  else if (category === 'angry') baseDur = 1.5;

  const duration = baseDur / tempoScale;
  const times: number[] = [];
  for (let s = 0; s < samples; s++) {
    times.push((s / (samples - 1)) * duration);
  }

  const pelvisPos: number[] = [];
  const pelvisRot: number[] = [];
  const spineRot: number[] = [];
  const chestRot: number[] = [];
  const headRot: number[] = [];
  const lShoulderRot: number[] = [];
  const lElbowRot: number[] = [];
  const rShoulderRot: number[] = [];
  const rElbowRot: number[] = [];
  const wandRot: number[] = [];
  const lHipRot: number[] = [];
  const lKneeRot: number[] = [];
  const rHipRot: number[] = [];
  const rKneeRot: number[] = [];
  const skirtRot: number[] = [];
  const hairLRot: number[] = [];
  const hairRRot: number[] = [];

  for (let s = 0; s < samples; s++) {
    const u = s / (samples - 1); // 0.0 -> 1.0
    const tau = u * Math.PI * 2;
    const sin1 = Math.sin(tau);
    const cos1 = Math.cos(tau);
    const sin2 = Math.sin(tau * 2);
    const env = Math.sin(u * Math.PI); // Smooth 0 -> 1 -> 0 envelope for one-shots & arcs!

    // Clean comfortable anime standing rest baseline (compact vertical travel so hat ALWAYS stays framed!)
    let px = 0;
    let py = 0.06;
    let pz = 0;
    let prx = 0;
    let pry = 0;
    let prz = 0;

    let srx = 0;
    let sry = 0;
    let srz = 0;

    let crx = -0.03;
    let cry = 0;
    const crz = 0;

    let hrx = -0.03;
    let hry = 0;
    let hrz = 0;

    // Natural A-pose arms; RightHand grips WandPivot whose shaft extends cleanly along +Z!
    // Total X angle (rsrx + rerx + wrx ≈ -0.95 rad) points +Z wand cleanly UPWARD (+81%) & FORWARD (+58%)!
    let lsrx = -0.08;
    let lsry = 0;
    let lsrz = -0.26;
    let lerx = -0.38;
    const lery = 0;
    let lerz = 0.14;

    let rsrx = -0.28;
    let rsry = -0.08;
    let rsrz = 0.24;
    let rerx = -0.58;
    const rery = 0;
    const rerz = -0.08;
    let wrx = -0.12;
    let wry = 0;
    const wrz = 0;

    let lhrx = 0;
    const lhrz = -0.03;
    let lkrx = 0.04;
    let rhrx = 0;
    const rhrz = 0.03;
    let rkrx = 0.04;

    if (category === 'idle') {
      // 10 Distinct Smooth Idle / Dance / Wave / Float / Twirl Archetypes!
      const bob = Math.sin(tau * 2) * 0.02 * energy;
      py = 0.06 + bob;
      lhrx = -Math.max(0, -bob) * 2.0;
      rhrx = -Math.max(0, -bob) * 2.0;
      lkrx = 0.05 + Math.max(0, -bob) * 4.0;
      rkrx = 0.05 + Math.max(0, -bob) * 4.0;

      if (choreo === 0) {
        // Starlight Friendly Wave & Hip Sway
        px = sin1 * 0.045 * energy;
        prz = -sin1 * 0.055;
        srz = sin1 * 0.065;
        hrz = sin1 * 0.08;
        hry = cos1 * 0.08;
        lsrx = -0.62;
        lsrz = -1.95 + sin2 * 0.24 * energy;
        lerx = -0.52 + cos1 * 0.2;
        rsrx = -0.34 + cos1 * 0.08;
        rerx = -0.62;
        wrx = -0.14;
      } else if (choreo === 1) {
        // Graceful 360 Ballet Pirouette (Pelvis spins smoothly while Pedestal & Hat stay rock-solid!)
        pry = u * Math.PI * 2;
        py = 0.06 + env * 0.08 * energy;
        lsrz = -1.05 - env * 0.35;
        lerx = -0.78;
        rsrx = -0.65;
        rerx = -0.55;
        rsrz = 0.58;
        wrx = -0.16;
        rhrx = -0.28 * env;
        rkrx = 0.64 * env;
      } else if (choreo === 2) {
        // Astral Levitation Hover & Wand Orbit
        py = 0.095 + sin1 * 0.045 * energy;
        prx = 0.04;
        lhrx = -0.12 + sin1 * 0.06;
        lkrx = 0.28;
        rhrx = -0.22 - sin1 * 0.06;
        rkrx = 0.48;
        rsrx = -0.68 + sin1 * 0.18;
        rerx = -0.52;
        rsrz = 0.34 + cos1 * 0.18;
        wry = sin1 * 0.26;
        lsrz = -0.58 + cos1 * 0.14;
        hrx = -0.06 + sin1 * 0.05;
      } else if (choreo === 3) {
        // Cute Idol Rhythm Step-Bounce
        px = sin1 * 0.075 * energy;
        py = 0.06 + Math.abs(sin2) * 0.04 * energy;
        pry = sin1 * 0.2;
        sry = -sin1 * 0.14;
        hrz = sin1 * 0.1;
        lsrx = -0.5 + sin2 * 0.22;
        lsrz = -0.5 - Math.abs(sin1) * 0.35;
        lerx = -0.95;
        rsrx = -0.45 - sin2 * 0.18;
        rerx = -0.68;
        wrx = -0.08;
        lhrx = sin1 > 0 ? -0.25 * sin1 : 0;
        lkrx = sin1 > 0 ? 0.5 * sin1 : 0.05;
        rhrx = sin1 < 0 ? 0.25 * sin1 : 0;
        rkrx = sin1 < 0 ? -0.5 * sin1 : 0.05;
      } else if (choreo === 4) {
        // Sky Spell Ribbon Arc
        py = 0.06 + env * 0.04;
        sry = sin1 * 0.15;
        hrx = -0.08 * env;
        hry = sin1 * 0.16;
        rsrx = -0.88 * env - 0.3 * (1 - env);
        rsrz = 0.28 + sin1 * 0.34;
        rerx = -0.48;
        wrx = -0.14 + cos1 * 0.14;
        wry = sin1 * 0.22;
        lsrz = -0.42 - env * 0.32;
      } else if (choreo === 5) {
        // Sassy Hand-on-Hip & Cheeky Head Tilt
        px = 0.035 + sin1 * 0.025;
        prz = -0.06;
        srz = 0.07;
        hrz = 0.12 + sin1 * 0.05;
        hry = 0.11 + cos1 * 0.07;
        lsrx = 0.14;
        lsrz = -0.58;
        lerx = -1.28;
        lerz = 0.62;
        rsrx = -0.38 + sin1 * 0.14;
        rerx = -0.58;
        wrx = -0.14;
        rkrx = 0.2;
        rhrx = -0.1;
      } else if (choreo === 6) {
        // Double Cheer Hop
        const hop = Math.max(0, sin2);
        py = 0.06 + hop * 0.075 * energy;
        lsrz = -0.32 - hop * 1.65;
        rsrx = -0.32 - hop * 0.68;
        rerx = -0.56 + hop * 0.14;
        rsrz = 0.28 + hop * 0.45;
        wrx = -0.12;
        lkrx = 0.07 + (1 - hop) * 0.2;
        rkrx = 0.07 + (1 - hop) * 0.2;
        hrx = -hop * 0.09;
      } else if (choreo === 7) {
        // Figure-8 Wand Weaving
        pry = sin1 * 0.16;
        cry = sin1 * 0.12;
        rsrx = -0.68 + sin2 * 0.2;
        rsry = cos1 * 0.32;
        rsrz = 0.35 + sin1 * 0.28;
        rerx = -0.48 + cos1 * 0.16;
        wry = sin2 * 0.28;
        hry = -sin1 * 0.12;
      } else if (choreo === 8) {
        // Shy Curtsy & Twirl Sway
        const dip = env;
        py = 0.06 - dip * 0.045;
        pry = sin1 * 0.24;
        srx = dip * 0.11;
        hrx = dip * 0.09;
        hrz = sin1 * 0.08;
        lsrz = -0.54 - dip * 0.22;
        rsrz = 0.48 + dip * 0.18;
        rsrx = -0.34;
        rerx = -0.58;
        lhrx = -dip * 0.2;
        lkrx = dip * 0.4;
        rhrx = dip * 0.1;
        rkrx = dip * 0.34;
      } else {
        // Celestial Waltz Glide
        px = sin1 * 0.095 * energy;
        pz = cos1 * 0.035 * (u > 0 && u < 1 ? env : 0);
        pry = cos1 * 0.2 * env;
        prz = -sin1 * 0.07;
        lsrz = -0.78 + sin1 * 0.22;
        lerx = -0.52;
        rsrx = -0.58 + cos1 * 0.18;
        rerx = -0.52;
        hrz = -sin1 * 0.08;
      }
    } else if (category === 'shoot') {
      // 10 Crisp Energetic Magic Wand Casts — Wand sweeps cleanly UPWARD toward the bubbles!
      const castEnv = Math.sin(Math.pow(u, 0.72) * Math.PI);
      py = 0.06 + castEnv * 0.065 * energy;
      crx = -0.03 - castEnv * 0.1;
      hrx = -0.04 - castEnv * 0.1;

      if (choreo % 5 === 0) {
        // Classic Sky-High Star Thrust (Wand points straight upward at peak!)
        rsrx = -0.28 - castEnv * 0.82;
        rsrz = 0.24 - castEnv * 0.1;
        rerx = -0.58 + castEnv * 0.16;
        wrx = -0.12 + castEnv * 0.06;
        lsrz = -0.26 - castEnv * 0.55;
      } else if (choreo % 5 === 1) {
        // Spinning Pirouette Cast
        pry = u * Math.PI * 2;
        py = 0.06 + castEnv * 0.08;
        rsrx = -0.28 - castEnv * 0.76;
        rsrz = 0.24 + castEnv * 0.35;
        rerx = -0.58 + castEnv * 0.14;
        wrx = -0.12 + castEnv * 0.05;
        lsrz = -0.26 - castEnv * 0.95;
      } else if (choreo % 5 === 2) {
        // Twin-Handed Celestial Beam Cast
        sry = castEnv * 0.1;
        rsrx = -0.28 - castEnv * 0.78;
        rsry = castEnv * 0.24;
        rerx = -0.58 + castEnv * 0.16;
        lsrx = -0.08 - castEnv * 1.15;
        lsry = -castEnv * 0.28;
        lsrz = -0.26 + castEnv * 0.12;
        lerx = -0.38 - castEnv * 0.22;
        wrx = -0.12 + castEnv * 0.06;
      } else if (choreo % 5 === 3) {
        // Crescent Diagonal Slash Upward
        pry = -castEnv * 0.3;
        rsrx = -0.28 - castEnv * 0.8;
        rsrz = 0.24 + Math.sin(u * Math.PI * 2) * 0.42;
        rerx = -0.58 + castEnv * 0.18;
        wry = -castEnv * 0.32;
        lhrx = -castEnv * 0.18;
        lkrx = castEnv * 0.4;
      } else {
        // Starburst Overhead Cast
        py = 0.06 + castEnv * 0.09 * energy;
        rsrx = -0.28 - castEnv * 0.86;
        rerx = -0.58 + castEnv * 0.2;
        lsrz = -0.26 - castEnv * 1.35;
        lhrx = -castEnv * 0.22;
        lkrx = castEnv * 0.48;
        rhrx = -castEnv * 0.14;
        rkrx = castEnv * 0.36;
        wrx = -0.12 + castEnv * 0.08;
      }
    } else if (category === 'happy') {
      // 10 Joyful High-Score / Combo / Power-Summon Celebrations!
      const joyArc = env;
      if (choreo % 4 === 0) {
        // Joyful Twirl with Raised Wand
        py = 0.06 + joyArc * 0.095 * energy;
        pry = u * Math.PI * 2;
        lsrz = -0.26 - joyArc * 1.85;
        rsrx = -0.28 - joyArc * 0.78;
        rerx = -0.58 + joyArc * 0.16;
        rsrz = 0.24 + joyArc * 0.48;
        rhrx = -joyArc * 0.28;
        rkrx = joyArc * 0.62;
        hrx = -joyArc * 0.1;
      } else if (choreo % 4 === 1) {
        // Double Star-Hop Cheer
        const hop2 = Math.abs(Math.sin(u * Math.PI * 2));
        py = 0.06 + hop2 * 0.085 * energy;
        prz = sin1 * 0.08;
        lsrz = -0.26 - hop2 * 1.75;
        lerx = -0.38 - hop2 * 0.28;
        rsrx = -0.28 - hop2 * 0.74;
        rerx = -0.58 + hop2 * 0.14;
        lkrx = 0.06 + hop2 * 0.38;
        rkrx = 0.06 + hop2 * 0.38;
        hrz = sin1 * 0.11;
      } else if (choreo % 4 === 2) {
        // Heart-Wave & Pop-Kick
        py = 0.06 + joyArc * 0.075;
        pry = sin1 * 0.28;
        lsrx = -joyArc * 1.35;
        lsrz = -0.26 - joyArc * 1.2;
        rsrx = -0.28 - joyArc * 0.72;
        rerx = -0.58 + joyArc * 0.14;
        lhrx = -joyArc * 0.38;
        lkrx = joyArc * 0.72;
        hrz = -joyArc * 0.12;
      } else {
        // Radiant Ribbon Spin & Cheer
        pry = u * Math.PI * 2;
        py = 0.06 + joyArc * 0.085;
        lsrx = -joyArc * 1.1;
        lsry = -joyArc * 0.38;
        rsrx = -0.28 - joyArc * 0.68;
        rerx = -0.58 + joyArc * 0.12;
        rsry = joyArc * 0.32;
        wrx = -0.14;
      }
    } else if (category === 'win') {
      // 10 Looping Victory Dances!
      const hop = Math.abs(sin2);
      py = 0.06 + hop * 0.085 * energy;
      if (choreo % 3 === 0) {
        pry = u * Math.PI * 2;
        lsrz = -1.9 + sin2 * 0.2;
        rsrx = -0.95 + cos1 * 0.16;
        rerx = -0.45;
        rsrz = 0.58;
        rhrx = -hop * 0.26;
        rkrx = hop * 0.58;
      } else if (choreo % 3 === 1) {
        px = sin1 * 0.11;
        pry = sin1 * 0.38;
        prz = -sin1 * 0.08;
        lsrz = -1.75 - sin2 * 0.24;
        rsrx = -0.9 + sin2 * 0.2;
        rerx = -0.48;
        lhrx = sin1 > 0 ? -0.3 * sin1 : 0;
        lkrx = sin1 > 0 ? 0.62 * sin1 : 0.06;
        rhrx = sin1 < 0 ? 0.3 * sin1 : 0;
        rkrx = sin1 < 0 ? -0.62 * sin1 : 0.06;
      } else {
        // Royal Levitating Victory Hover
        py = 0.11 + sin1 * 0.045;
        pry = sin1 * 0.3;
        lsrz = -1.45 + cos1 * 0.2;
        rsrx = -0.98 + sin1 * 0.16;
        rerx = -0.44;
        lhrx = -0.2;
        lkrx = 0.46;
        rhrx = -0.3;
        rkrx = 0.6;
      }
      hrx = -0.07;
    } else {
      // 'angry' / Reaction: 10 Expressive Pout / Foot-Stomp / Head-Shake Animations!
      if (choreo % 3 === 0) {
        // Impatient Cute Foot Stomp & Pout
        const stompL = Math.max(0, sin1);
        const stompR = Math.max(0, -sin1);
        py = 0.055 + Math.abs(sin2) * 0.03;
        px = sin1 * 0.035;
        srx = 0.06;
        hry = sin2 * 0.15;
        hrx = 0.06;
        lsrx = -0.48;
        lsrz = -0.42;
        lerx = -1.28;
        lerz = 0.52;
        rsrx = -0.42 + stompR * 0.2;
        rerx = -0.65;
        wrx = -0.1;
        lhrx = -stompL * 0.38;
        lkrx = stompL * 0.68;
        rhrx = -stompR * 0.38;
        rkrx = stompR * 0.68;
      } else if (choreo % 3 === 1) {
        // Disappointed Head-Shake & Drooping Shoulders
        py = 0.045 - env * 0.02;
        srx = 0.11 * env;
        hrx = 0.12 * env;
        hry = Math.sin(tau * 3) * 0.25 * env;
        lsrz = -0.16;
        lerx = -0.2;
        rsrx = -0.2;
        rerx = -0.42;
        wrx = -0.05;
      } else {
        // Sassy Huff & Wand-Shake
        pry = -0.2 + sin1 * 0.11;
        hrz = -0.1;
        hry = 0.18 + sin2 * 0.09;
        lsrz = -0.58;
        lerx = -1.32;
        lerz = 0.6;
        rsrx = -0.76 + sin2 * 0.22;
        rerx = -0.5;
        rsrz = 0.36;
        wrx = -0.12;
      }
    }

    // Subtle tier flair variation so all 1,000 items in each category have distinct nuances
    hrz += Math.sin(tau + flairPhase) * 0.02 * (u > 0 && u < 1 ? 1 : 0);

    // Secondary overlapping follow-through on Twintails & Skirt!
    const followSin = Math.sin(tau - 0.55);
    const jumpLift = Math.max(0, py - 0.06);
    const skirtFlareX = -prx * 0.5 + followSin * 0.032;
    const skirtFlareZ = -prz * 0.55;
    const hairFlare = 0.12 + jumpLift * 1.4 + Math.abs(sin1) * 0.07;

    pelvisPos.push(px, py, pz);
    pelvisRot.push(...qFromEuler(prx, pry, prz));
    spineRot.push(...qFromEuler(srx, sry, srz));
    chestRot.push(...qFromEuler(crx, cry, crz));
    headRot.push(...qFromEuler(hrx, hry, hrz));
    lShoulderRot.push(...qFromEuler(lsrx, lsry, lsrz));
    lElbowRot.push(...qFromEuler(lerx, lery, lerz));
    rShoulderRot.push(...qFromEuler(rsrx, rsry, rsrz));
    rElbowRot.push(...qFromEuler(rerx, rery, rerz));
    wandRot.push(...qFromEuler(wrx, wry, wrz));
    lHipRot.push(...qFromEuler(lhrx, 0, lhrz));
    lKneeRot.push(...qFromEuler(lkrx, 0, 0));
    rHipRot.push(...qFromEuler(rhrx, 0, rhrz));
    rKneeRot.push(...qFromEuler(rkrx, 0, 0));
    skirtRot.push(...qFromEuler(skirtFlareX, 0, skirtFlareZ));
    hairLRot.push(...qFromEuler(-followSin * 0.07, 0, -hairFlare));
    hairRRot.push(...qFromEuler(-followSin * 0.07, 0, hairFlare));
  }

  const tracks: THREE.KeyframeTrack[] = [
    new THREE.VectorKeyframeTrack('Pelvis.position', times, pelvisPos),
    new THREE.QuaternionKeyframeTrack('Pelvis.quaternion', times, pelvisRot),
    new THREE.QuaternionKeyframeTrack('Spine.quaternion', times, spineRot),
    new THREE.QuaternionKeyframeTrack('Chest.quaternion', times, chestRot),
    new THREE.QuaternionKeyframeTrack('Head.quaternion', times, headRot),
    new THREE.QuaternionKeyframeTrack('LeftShoulder.quaternion', times, lShoulderRot),
    new THREE.QuaternionKeyframeTrack('LeftElbow.quaternion', times, lElbowRot),
    new THREE.QuaternionKeyframeTrack('RightShoulder.quaternion', times, rShoulderRot),
    new THREE.QuaternionKeyframeTrack('RightElbow.quaternion', times, rElbowRot),
    new THREE.QuaternionKeyframeTrack('WandPivot.quaternion', times, wandRot),
    new THREE.QuaternionKeyframeTrack('LeftHip.quaternion', times, lHipRot),
    new THREE.QuaternionKeyframeTrack('LeftKnee.quaternion', times, lKneeRot),
    new THREE.QuaternionKeyframeTrack('RightHip.quaternion', times, rHipRot),
    new THREE.QuaternionKeyframeTrack('RightKnee.quaternion', times, rKneeRot),
    new THREE.QuaternionKeyframeTrack('SkirtPivot.quaternion', times, skirtRot),
    new THREE.QuaternionKeyframeTrack('HairTwinL.quaternion', times, hairLRot),
    new THREE.QuaternionKeyframeTrack('HairTwinR.quaternion', times, hairRRot),
  ];

  for (const tr of tracks) {
    tr.setInterpolation(THREE.InterpolateSmooth);
  }

  const clip = new THREE.AnimationClip(cacheKey, duration, tracks);
  clipCache.set(cacheKey, clip);
  return clip;
}

/**
 * Reusable Controller managing a 3D GLB Magic Girl instance, her THREE.AnimationMixer,
 * smooth cross-faded actions, facial expressions, blinking eyelids, and wand tip tracking!
 */
export class SorceressRigController {
  readonly holder = new THREE.Group();
  private modelRoot!: THREE.Group;
  private mixer!: THREE.AnimationMixer;
  private currentAction: THREE.AnimationAction | null = null;
  private currentClipKey = '';
  private activeOneShotCategory: AnimCategory | null = null;

  private daisRing: THREE.Object3D | null = null;
  private wandStar: THREE.Object3D | null = null;
  private wandTip: THREE.Object3D | null = null;
  private eyelidL: THREE.Object3D | null = null;
  private eyelidR: THREE.Object3D | null = null;
  private browL: THREE.Object3D | null = null;
  private browR: THREE.Object3D | null = null;
  private mouth: THREE.Object3D | null = null;

  private equipped: EquippedAnimations = {
    idle: 0,
    shoot: 0,
    happy: 0,
    win: 0,
    angry: 0,
  };
  private desiredLoopCategory: AnimCategory = 'idle';
  private desiredLoopIndex = 0;

  constructor() {
    this.mountRigRoot(
      cachedGlbTemplate ? (cachedGlbTemplate.clone(true) as THREE.Group) : createFallbackRigSkeleton(),
    );

    if (!cachedGlbTemplate) {
      preloadSorceressGlb().then((tpl) => {
        if (tpl) {
          this.mountRigRoot(tpl.clone(true) as THREE.Group);
        }
      });
    }
  }

  private mountRigRoot(rootObj: THREE.Group): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    this.holder.clear();
    this.modelRoot = rootObj;
    this.holder.add(this.modelRoot);

    this.daisRing = this.modelRoot.getObjectByName('DaisRing') || null;
    this.wandStar = this.modelRoot.getObjectByName('WandStar') || null;
    this.wandTip = this.modelRoot.getObjectByName('WandTipMarker') || null;
    this.eyelidL = this.modelRoot.getObjectByName('EyelidL') || null;
    this.eyelidR = this.modelRoot.getObjectByName('EyelidR') || null;
    this.browL = this.modelRoot.getObjectByName('BrowL') || null;
    this.browR = this.modelRoot.getObjectByName('BrowR') || null;
    this.mouth = this.modelRoot.getObjectByName('Mouth') || null;

    this.mixer = new THREE.AnimationMixer(this.modelRoot);
    this.mixer.addEventListener('finished', () => {
      this.activeOneShotCategory = null;
      this.playLoop(this.desiredLoopCategory, this.desiredLoopIndex, 0.24);
    });

    this.currentAction = null;
    this.currentClipKey = '';
    this.playLoop(this.desiredLoopCategory, this.desiredLoopIndex, 0);
  }

  setEquippedAnimations(eq: EquippedAnimations): void {
    const prevIdle = this.equipped.idle;
    this.equipped = { ...eq };
    if (this.desiredLoopCategory === 'idle' && eq.idle !== prevIdle && !this.activeOneShotCategory) {
      this.desiredLoopIndex = eq.idle;
      this.playLoop('idle', eq.idle, 0.22);
    }
  }

  playLoop(category: AnimCategory, index: number, fadeSec = 0.22): void {
    this.desiredLoopCategory = category;
    this.desiredLoopIndex = index;
    if (this.activeOneShotCategory) return;

    const clip = getOrCreateSorceressClip(category, index);
    if (this.currentClipKey === clip.name && this.currentAction) return;

    const nextAction = this.mixer.clipAction(clip);
    nextAction.reset();
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.clampWhenFinished = false;
    nextAction.play();

    if (this.currentAction && fadeSec > 0) {
      this.currentAction.crossFadeTo(nextAction, fadeSec, false);
    } else if (this.currentAction) {
      this.currentAction.stop();
    }

    this.currentAction = nextAction;
    this.currentClipKey = clip.name;
    this.applyFacialExpression(category);
  }

  triggerOneShot(category: AnimCategory, index?: number): void {
    const idx = index ?? this.equipped[category];
    const clip = getOrCreateSorceressClip(category, idx);
    this.activeOneShotCategory = category;

    const nextAction = this.mixer.clipAction(clip);
    nextAction.reset();
    nextAction.setLoop(THREE.LoopOnce, 1);
    nextAction.clampWhenFinished = true;
    nextAction.play();

    if (this.currentAction && this.currentAction !== nextAction) {
      this.currentAction.crossFadeTo(nextAction, 0.12, false);
    }

    this.currentAction = nextAction;
    this.currentClipKey = clip.name;
    this.applyFacialExpression(category);
  }

  syncGameplayEmotion(emotion: GirlEmotionState): void {
    if (emotion === 'win') {
      this.activeOneShotCategory = null;
      this.playLoop('win', this.equipped.win, 0.22);
    } else if (emotion === 'upset' || emotion === 'miss') {
      if (this.activeOneShotCategory !== 'shoot') {
        this.activeOneShotCategory = null;
        this.playLoop('angry', this.equipped.angry, 0.2);
      }
    } else if (emotion === 'happy') {
      if (this.activeOneShotCategory !== 'happy') {
        this.triggerOneShot('happy', this.equipped.happy);
      }
    } else {
      this.desiredLoopCategory = 'idle';
      this.desiredLoopIndex = this.equipped.idle;
      if (!this.activeOneShotCategory) {
        this.playLoop('idle', this.equipped.idle, 0.24);
      }
    }
  }

  private applyFacialExpression(category: AnimCategory): void {
    const isAngry = category === 'angry';
    const isCheer = category === 'happy' || category === 'win';
    if (this.mouth) {
      this.mouth.rotation.z = isAngry ? 0 : Math.PI;
      this.mouth.position.y = isAngry ? -0.084 : -0.068;
      this.mouth.scale.setScalar(isCheer ? 1.3 : 1.0);
    }
    if (this.browL && this.browR) {
      if (isAngry) {
        this.browL.rotation.z = -0.34;
        this.browR.rotation.z = 0.34;
      } else if (isCheer) {
        this.browL.rotation.z = 0.15;
        this.browR.rotation.z = -0.15;
      } else {
        this.browL.rotation.z = 0.05;
        this.browR.rotation.z = -0.05;
      }
    }
  }

  getWandTipWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    if (this.wandTip) {
      return this.wandTip.getWorldPosition(out);
    }
    return this.holder.getWorldPosition(out);
  }

  update(dt: number, elapsedSec: number): void {
    this.mixer.update(dt);

    // Stationary dais rune ring gentle spin & wand star spin around wand shaft (+Z)
    if (this.daisRing) {
      this.daisRing.rotation.y = elapsedSec * 0.7;
    }
    if (this.wandStar) {
      this.wandStar.rotation.z = elapsedSec * 2.2;
    }

    // Smooth natural anime blinking every 3.4s
    if (this.eyelidL && this.eyelidR) {
      const phase = elapsedSec % 3.4;
      let lidScale = 0.01;
      if (phase > 3.22 && phase < 3.38) {
        const blinkU = (phase - 3.22) / 0.16;
        lidScale = 0.01 + Math.sin(blinkU * Math.PI) * 1.05;
      }
      this.eyelidL.visible = lidScale > 0.05;
      this.eyelidR.visible = lidScale > 0.05;
      this.eyelidL.scale.y = lidScale;
      this.eyelidR.scale.y = lidScale;
    }
  }
}

/**
 * Dedicated Transparent 3D WebGL Preview Stage
 * Supports two mutually exclusive 3D modes on a single WebGL context:
 * 1. 'girl' mode: Renders the 3D GLB Magic Girl for Level Menu, Victory, Emotes, and Powers.
 * 2. 'shooter' mode: Renders the 3D Bubble Shooter Turret actively aiming and shooting crystal bubbles
 *    with barrel recoil, dotted laser sight, flying bubble projectiles, and crystal burst pops (no Magic Girl).
 */
export class SorceressPreviewStage {
  private renderer: THREE.WebGLRenderer | null = null;
  private pmremGenerator: THREE.PMREMGenerator | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.05, 30);
  readonly controller = new SorceressRigController();

  private mode: 'girl' | 'shooter' = 'girl';
  private shooterStageRoot = new THREE.Group();
  private shooterCore: ShooterTurretCore | null = null;
  private nextPreviewOrb: THREE.Mesh | null = null;
  private previewOrbMats: THREE.MeshPhysicalMaterial[] = [];
  private haloMat: THREE.MeshBasicMaterial | null = null;
  private aimDotMat: THREE.MeshBasicMaterial | null = null;
  private aimDots: THREE.Mesh[] = [];
  private targetOrbs: THREE.Mesh[] = [];
  private targetBasePos: THREE.Vector3[] = [];
  private targetRespawnTimers: number[] = [];
  private flyingOrb: THREE.Mesh | null = null;
  private flyingActive = false;
  private flyingVel = new THREE.Vector3();
  private flyingTargetIndex = 2;
  private muzzleRing: THREE.Mesh | null = null;
  private muzzleRingMat: THREE.MeshBasicMaterial | null = null;
  private muzzleTimer = 0;
  private impactRing: THREE.Mesh | null = null;
  private impactRingMat: THREE.MeshBasicMaterial | null = null;
  private impactTimer = 0;
  private burstShards: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; vx: number; vy: number; vz: number; life: number }[] = [];
  private previewDisposables: { dispose(): void }[] = [];

  private shooterOrder = [2, 1, 3, 0, 4, 2, 3, 1];
  private shooterOrderCursor = 0;
  private activeTargetIdx = 2;
  private currentTurretRotZ = 0;
  private shooterCooldown = 0.25;
  private shooterRecoil = 0;
  private shooterSpinBoost = 0;
  private currentColorIdx = 0;
  private nextColorIdx = 1;
  private orbReloadScale = 1;

  private currentHost: HTMLElement | null = null;
  private rafId = 0;
  private lastTime = 0;
  private paused = true;
  private destroyed = false;

  constructor() {
    if (typeof window === 'undefined') return;

    try {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.NeutralToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3.0));
      this.renderer.setClearColor(0x000000, 0);

      this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      const roomEnv = new RoomEnvironment();
      this.envRT = this.pmremGenerator.fromScene(roomEnv, 0.04);
      this.scene.environment = this.envRT.texture;
      roomEnv.dispose();

      const canvas = this.renderer.domElement;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      canvas.style.pointerEvents = 'none';

      // Framed with generous top & side margin so hat, wand, and shooter targets never clip
      this.camera.position.set(0, 0.5, 4.65);
      this.camera.lookAt(0, 0.48, 0);

      const hemi = new THREE.HemisphereLight(0xfffbeb, 0x312e81, 1.35);
      this.scene.add(hemi);

      const key = new THREE.DirectionalLight(0xffffff, 2.45);
      key.position.set(2.4, 3.8, 4.4);
      this.scene.add(key);

      const rim = new THREE.DirectionalLight(0x38bdf8, 1.45);
      rim.position.set(-2.8, 2.2, -2.5);
      this.scene.add(rim);

      const fill = new THREE.PointLight(0xf472b6, 1.05, 8);
      fill.position.set(-1.2, 0.8, 2.4);
      this.scene.add(fill);

      this.controller.holder.position.set(0, -0.1, 0);
      this.scene.add(this.controller.holder);

      this.initShooterPreviewStage();
      this.shooterStageRoot.visible = false;
      this.scene.add(this.shooterStageRoot);

      this.lastTime = performance.now();
    } catch {
      this.renderer = null;
    }
  }

  private initShooterPreviewStage(): void {
    this.shooterStageRoot.position.set(0, -0.94, 0);
    this.shooterStageRoot.scale.setScalar(0.88);

    const palette = [0xf43f5e, 0x38bdf8, 0xfbbf24, 0x10b981, 0xa855f7, 0xf97316];
    this.previewOrbMats = palette.map((hex) => {
      const mat = new THREE.MeshPhysicalMaterial({
        color: hex,
        emissive: hex,
        emissiveIntensity: 0.24,
        roughness: 0.08,
        metalness: 0.06,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      });
      this.previewDisposables.push(mat);
      return mat;
    });

    this.haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    this.previewDisposables.push(this.haloMat);

    this.shooterCore = buildShooterTurretCore(this.previewOrbMats[0], this.haloMat);
    this.shooterCore.loadedPowerHalo.visible = true;
    this.shooterStageRoot.add(this.shooterCore.group);

    // Side "Next Bubble" indicator orb beside pedestal
    const nextOrbGeo = new THREE.SphereGeometry(0.16, 20, 20);
    this.previewDisposables.push(nextOrbGeo);
    this.nextPreviewOrb = new THREE.Mesh(nextOrbGeo, this.previewOrbMats[1]);
    this.nextPreviewOrb.position.set(0.72, -0.02, 0.24);
    this.shooterStageRoot.add(this.nextPreviewOrb);

    // Dotted aiming laser sight
    const dotGeo = new THREE.SphereGeometry(0.042, 10, 10);
    this.previewDisposables.push(dotGeo);
    this.aimDotMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });
    this.previewDisposables.push(this.aimDotMat);

    for (let i = 0; i < 8; i++) {
      const dot = new THREE.Mesh(dotGeo, this.aimDotMat);
      this.shooterStageRoot.add(dot);
      this.aimDots.push(dot);
    }

    // Upper cluster of 5 target crystal bubbles to shoot and pop
    const targetGeo = new THREE.SphereGeometry(0.24, 24, 24);
    const highlightGeo = new THREE.SphereGeometry(0.062, 10, 10);
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
    });
    this.previewDisposables.push(targetGeo, highlightGeo, highlightMat);

    const coords: [number, number, number][] = [
      [-0.88, 2.34, 0.18],
      [-0.44, 2.56, 0.2],
      [0.0, 2.66, 0.22],
      [0.44, 2.56, 0.2],
      [0.88, 2.34, 0.18],
    ];

    coords.forEach(([x, y, z], idx) => {
      const orb = new THREE.Mesh(targetGeo, this.previewOrbMats[idx % this.previewOrbMats.length]);
      orb.position.set(x, y, z);
      const spec = new THREE.Mesh(highlightGeo, highlightMat);
      spec.position.set(-0.065, 0.075, 0.165);
      orb.add(spec);
      this.shooterStageRoot.add(orb);
      this.targetOrbs.push(orb);
      this.targetBasePos.push(new THREE.Vector3(x, y, z));
      this.targetRespawnTimers.push(0);
    });

    // Flying projectile bubble
    const projGeo = new THREE.SphereGeometry(0.21, 24, 24);
    this.previewDisposables.push(projGeo);
    this.flyingOrb = new THREE.Mesh(projGeo, this.previewOrbMats[0]);
    const projSpec = new THREE.Mesh(highlightGeo, highlightMat);
    projSpec.position.set(-0.065, 0.075, 0.165);
    this.flyingOrb.add(projSpec);
    this.flyingOrb.visible = false;
    this.shooterStageRoot.add(this.flyingOrb);

    // Muzzle flash shockwave ring & target impact ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.22, 24);
    this.previewDisposables.push(ringGeo);
    this.muzzleRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.impactRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.previewDisposables.push(this.muzzleRingMat, this.impactRingMat);

    this.muzzleRing = new THREE.Mesh(ringGeo, this.muzzleRingMat);
    this.muzzleRing.visible = false;
    this.shooterStageRoot.add(this.muzzleRing);

    this.impactRing = new THREE.Mesh(ringGeo, this.impactRingMat);
    this.impactRing.visible = false;
    this.shooterStageRoot.add(this.impactRing);

    // 12 crystal pop burst shards
    const shardGeo = new THREE.OctahedronGeometry(0.068, 0);
    this.previewDisposables.push(shardGeo);
    for (let i = 0; i < 12; i++) {
      const shardMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.65,
        roughness: 0.15,
        metalness: 0.35,
        transparent: true,
        opacity: 0,
      });
      this.previewDisposables.push(shardMat);
      const mesh = new THREE.Mesh(shardGeo, shardMat);
      mesh.visible = false;
      this.shooterStageRoot.add(mesh);
      this.burstShards.push({ mesh, mat: shardMat, vx: 0, vy: 0, vz: 0, life: 0 });
    }
  }

  attachTo(host: HTMLElement | null, widthPx: number, heightPx: number): void {
    if (!this.renderer) return;
    if (!host) {
      this.paused = true;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      if (this.currentHost && this.renderer.domElement.parentElement === this.currentHost) {
        this.renderer.domElement.remove();
      }
      this.currentHost = null;
      return;
    }

    if (this.currentHost !== host) {
      this.currentHost = host;
      host.appendChild(this.renderer.domElement);
    }
    const w = Math.max(64, widthPx);
    const h = Math.max(64, heightPx);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);

    this.paused = false;
    if (!this.rafId && !this.destroyed) {
      this.lastTime = performance.now();
      this.startLoop();
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused && this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    } else if (!paused && !this.rafId && this.currentHost && !this.destroyed) {
      this.lastTime = performance.now();
      this.startLoop();
    }
  }

  previewAnimation(category: AnimCategory, index: number): void {
    this.mode = 'girl';
    this.shooterStageRoot.visible = false;
    this.controller.holder.visible = true;
    this.camera.position.set(0, 0.5, 4.65);
    this.camera.lookAt(0, 0.48, 0);

    // Loop previewed emote/power clips continuously in Store, Vault, or Menu
    this.controller['activeOneShotCategory'] = null;
    this.controller.playLoop(category, index, 0.18);
  }

  previewShooter(designIndex: number, fireImmediate = true): void {
    if (!this.shooterCore) return;
    this.mode = 'shooter';
    this.controller.holder.visible = false;
    this.shooterStageRoot.visible = true;
    this.camera.position.set(0, 0.35, 4.95);
    this.camera.lookAt(0, 0.38, 0);

    const clamped = Math.max(0, Math.min(23, Math.floor(designIndex)));
    this.shooterCore.setShooterStyle(clamped);
    const meta = getShooterDesignMeta(clamped);
    if (this.aimDotMat) this.aimDotMat.color.setHex(meta.gemNum);
    if (this.haloMat) this.haloMat.color.setHex(meta.gemNum);
    if (this.muzzleRingMat) this.muzzleRingMat.color.setHex(meta.gemNum);

    if (fireImmediate) {
      this.flyingActive = false;
      if (this.flyingOrb) this.flyingOrb.visible = false;
      this.triggerShooterShot();
    }
  }

  triggerShooterShot(): void {
    if (!this.shooterCore || this.mode !== 'shooter') return;

    // Pick a ready target bubble
    let chosen = this.shooterOrder[this.shooterOrderCursor % this.shooterOrder.length];
    this.shooterOrderCursor++;
    for (let attempt = 0; attempt < this.targetOrbs.length; attempt++) {
      const idx = (chosen + attempt) % this.targetOrbs.length;
      if (this.targetRespawnTimers[idx] <= 0.05) {
        chosen = idx;
        break;
      }
    }
    this.activeTargetIdx = chosen;

    const targetPos = this.targetBasePos[chosen];
    const aimAngle = Math.atan2(targetPos.y, targetPos.x);
    this.currentTurretRotZ = aimAngle - Math.PI / 2;
    this.shooterCore.turretPivot.rotation.z = this.currentTurretRotZ;

    // Launch projectile bubble from barrel nozzle (radius 0.96 from (0,0) pivot)
    const shotMat = this.previewOrbMats[this.currentColorIdx % this.previewOrbMats.length];
    const targetOrb = this.targetOrbs[chosen];
    if (targetOrb) {
      targetOrb.material = shotMat;
    }

    if (this.flyingOrb) {
      this.flyingOrb.material = shotMat;
      const nozzleX = Math.cos(aimAngle) * 0.96;
      const nozzleY = Math.sin(aimAngle) * 0.96;
      this.flyingOrb.position.set(nozzleX, nozzleY, 0.24);
      this.flyingOrb.scale.setScalar(1);
      this.flyingOrb.visible = true;

      const toTarget = new THREE.Vector3(
        targetPos.x - nozzleX,
        targetPos.y - nozzleY,
        targetPos.z - 0.24
      ).normalize();
      this.flyingVel.copy(toTarget).multiplyScalar(6.0);
      this.flyingTargetIndex = chosen;
      this.flyingActive = true;

      if (this.muzzleRing && this.muzzleRingMat) {
        this.muzzleRing.position.set(nozzleX, nozzleY, 0.28);
        this.muzzleRing.scale.setScalar(0.6);
        this.muzzleRing.visible = true;
        this.muzzleRingMat.opacity = 0.95;
        this.muzzleTimer = 1;
      }
    }

    // Cycle chambered & next loaded bubbles + kick barrel recoil
    this.currentColorIdx = this.nextColorIdx;
    this.nextColorIdx = (this.nextColorIdx + 1) % this.previewOrbMats.length;
    this.shooterCore.loadedOrbMesh.material = this.previewOrbMats[this.currentColorIdx];
    if (this.nextPreviewOrb) {
      this.nextPreviewOrb.material = this.previewOrbMats[this.nextColorIdx];
    }
    this.orbReloadScale = 0.25;
    this.shooterRecoil = 1;
    this.shooterSpinBoost = 1;
    this.shooterCooldown = 0.88;
  }

  private triggerTargetPop(targetIdx: number): void {
    const pos = this.targetBasePos[targetIdx];
    const orb = this.targetOrbs[targetIdx];
    if (!pos || !orb) return;

    const popMat = orb.material as THREE.MeshPhysicalMaterial;
    const popHex = popMat?.color ? popMat.color.getHex() : 0x38bdf8;

    this.targetRespawnTimers[targetIdx] = 0.46;
    orb.scale.setScalar(0.001);

    if (this.impactRing && this.impactRingMat) {
      this.impactRing.position.set(pos.x, pos.y, pos.z + 0.05);
      this.impactRing.scale.setScalar(0.6);
      this.impactRing.visible = true;
      this.impactRingMat.color.setHex(popHex);
      this.impactRingMat.opacity = 0.95;
      this.impactTimer = 1;
    }

    for (let i = 0; i < this.burstShards.length; i++) {
      const s = this.burstShards[i];
      const angle = (i / this.burstShards.length) * Math.PI * 2 + (i % 2) * 0.22;
      const speed = 1.35 + (i % 3) * 0.48;
      s.mesh.position.set(pos.x, pos.y, pos.z + 0.04);
      s.mesh.scale.setScalar(1);
      s.mesh.visible = true;
      s.mat.color.setHex(popHex);
      s.mat.emissive.setHex(popHex);
      s.mat.opacity = 1;
      s.vx = Math.cos(angle) * speed;
      s.vy = Math.sin(angle) * speed + 0.35;
      s.vz = ((i % 3) - 1) * 0.55;
      s.life = 1;
    }
  }

  private stepShooterPreview(dt: number, elapsedSec: number): void {
    if (!this.shooterCore) return;

    // Gentle 3D presentation sway so metallic fins, pedestals & 3D rings shine
    this.shooterCore.group.rotation.y = Math.sin(elapsedSec * 1.15) * 0.2;

    // Compute smooth aim toward next target
    const upcomingIdx = this.flyingActive
      ? this.flyingTargetIndex
      : this.shooterOrder[this.shooterOrderCursor % this.shooterOrder.length];
    const aimTarget = this.targetBasePos[upcomingIdx] ?? this.targetBasePos[2];
    const desiredAngle = Math.atan2(aimTarget.y, aimTarget.x);
    const desiredRotZ = desiredAngle - Math.PI / 2;
    this.currentTurretRotZ += (desiredRotZ - this.currentTurretRotZ) * (1 - Math.exp(-11 * dt));
    this.shooterCore.turretPivot.rotation.z = this.currentTurretRotZ;

    // Barrel recoil & chambered bubble reload pop
    this.shooterRecoil = Math.max(0, this.shooterRecoil - dt * 4.4);
    const recoilOffset = Math.sin(this.shooterRecoil * Math.PI) * 0.18;
    this.shooterCore.barrelRecoilGroup.position.y = -recoilOffset;

    this.orbReloadScale = Math.min(1, this.orbReloadScale + dt * 4.2);
    this.shooterCore.loadedOrbMesh.scale.setScalar(this.orbReloadScale);
    this.shooterCore.loadedPowerHalo.rotation.z = elapsedSec * 2.8;

    // Counter-rotating arcane rings with firing spin surge
    this.shooterSpinBoost = Math.max(0, this.shooterSpinBoost - dt * 2.5);
    const spinExtra = this.shooterSpinBoost * 3.2;
    if (this.shooterCore.gears[0]) {
      this.shooterCore.gears[0].rotation.z += dt * (1.55 + spinExtra);
    }
    if (this.shooterCore.gears[1]) {
      this.shooterCore.gears[1].rotation.z -= dt * (2.15 + spinExtra * 1.2);
    }
    if (this.shooterCore.gears[2]) {
      this.shooterCore.gears[2].rotation.z += dt * (1.05 + spinExtra * 0.8);
    }

    // Update dotted laser sight along current turret aim
    const liveAngle = this.currentTurretRotZ + Math.PI / 2;
    const cosA = Math.cos(liveAngle);
    const sinA = Math.sin(liveAngle);
    for (let i = 0; i < this.aimDots.length; i++) {
      const dot = this.aimDots[i];
      const flow = ((elapsedSec * 2.4 + i / this.aimDots.length) % 1);
      const dist = 1.16 + flow * 1.22;
      dot.position.set(cosA * dist, sinA * dist, 0.22);
      const pulse = Math.sin(flow * Math.PI);
      dot.scale.setScalar(0.65 + pulse * 0.55);
    }

    // Animate upper target bubbles (floating + respawning after pop)
    for (let i = 0; i < this.targetOrbs.length; i++) {
      const orb = this.targetOrbs[i];
      const base = this.targetBasePos[i];
      orb.position.y = base.y + Math.sin(elapsedSec * 2.6 + i * 0.9) * 0.035;
      if (this.targetRespawnTimers[i] > 0) {
        this.targetRespawnTimers[i] = Math.max(0, this.targetRespawnTimers[i] - dt);
        if (this.targetRespawnTimers[i] === 0) {
          orb.material =
            this.previewOrbMats[(this.currentColorIdx + i + 2) % this.previewOrbMats.length];
        }
        orb.scale.setScalar(0.001);
      } else {
        const s = orb.scale.x + (1 - orb.scale.x) * (1 - Math.exp(-14 * dt));
        orb.scale.setScalar(s);
      }
    }

    // Advance flying bubble projectile
    if (this.flyingActive && this.flyingOrb) {
      this.flyingOrb.position.addScaledVector(this.flyingVel, dt);
      const dest = this.targetBasePos[this.flyingTargetIndex];
      if (dest && this.flyingOrb.position.distanceTo(dest) <= 0.3) {
        this.flyingActive = false;
        this.flyingOrb.visible = false;
        this.triggerTargetPop(this.flyingTargetIndex);
      } else if (this.flyingOrb.position.y > 3.4) {
        this.flyingActive = false;
        this.flyingOrb.visible = false;
      }
    } else {
      this.shooterCooldown -= dt;
      if (this.shooterCooldown <= 0) {
        this.triggerShooterShot();
      }
    }

    // Muzzle & impact shockwave rings
    if (this.muzzleTimer > 0 && this.muzzleRing && this.muzzleRingMat) {
      this.muzzleTimer = Math.max(0, this.muzzleTimer - dt * 4.2);
      this.muzzleRing.scale.setScalar(0.55 + (1 - this.muzzleTimer) * 1.35);
      this.muzzleRingMat.opacity = this.muzzleTimer * 0.9;
      if (this.muzzleTimer === 0) this.muzzleRing.visible = false;
    }

    if (this.impactTimer > 0 && this.impactRing && this.impactRingMat) {
      this.impactTimer = Math.max(0, this.impactTimer - dt * 3.4);
      this.impactRing.scale.setScalar(0.6 + (1 - this.impactTimer) * 1.9);
      this.impactRingMat.opacity = this.impactTimer * 0.95;
      if (this.impactTimer === 0) this.impactRing.visible = false;
    }

    // Crystal burst shards
    for (const s of this.burstShards) {
      if (s.life <= 0) continue;
      s.life = Math.max(0, s.life - dt * 2.3);
      s.vy -= 3.6 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.mesh.rotation.x += dt * 7;
      s.mesh.rotation.y += dt * 9;
      s.mesh.scale.setScalar(Math.max(0.01, s.life));
      s.mat.opacity = s.life;
      if (s.life === 0) s.mesh.visible = false;
    }
  }

  private startLoop(): void {
    const step = (now: number) => {
      if (this.destroyed || this.paused || !this.currentHost) {
        this.rafId = 0;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      if (this.renderer) {
        if (this.mode === 'shooter') {
          this.stepShooterPreview(dt, now * 0.001);
        } else {
          this.controller.update(dt, now * 0.001);
        }
        this.renderer.render(this.scene, this.camera);
      }

      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  destroy(): void {
    this.destroyed = true;
    this.paused = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.shooterCore?.dispose();
    for (const item of this.previewDisposables) {
      item.dispose();
    }
    this.previewDisposables.length = 0;
    this.envRT?.dispose();
    this.pmremGenerator?.dispose();
    this.renderer?.domElement.remove();
    this.renderer?.dispose();
    this.renderer = null;
    this.currentHost = null;
  }
}
