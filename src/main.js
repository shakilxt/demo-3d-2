import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createMaterials } from './materials.js';
import { createRobot } from './robot.js';
import { studioEnvironment } from './studio.js';
import { DURATION, poseAt } from './timeline.js';

export const BACKGROUND = 0xdcdcdc; // uniform light grey (sRGB)
const ASPECT = 2 / 3;

const params = new URLSearchParams(location.search);
const capture = params.has('capture');
const quality = params.get('quality') || 'high';
const fixedW = Number(params.get('w')) || 0;
const fixedH = Number(params.get('h')) || 0;

const canvas = document.querySelector('canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  preserveDrawingBuffer: capture,
  powerPreference: 'high-performance',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.environment = studioEnvironment(renderer);
scene.environmentIntensity = 0.5;

// ---------------- lights: soft studio setup ----------------
const key = new THREE.DirectionalLight(0xfff7ef, 3.6);
key.position.set(-6, 9, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -4;
key.shadow.camera.right = 4;
key.shadow.camera.top = 5;
key.shadow.camera.bottom = -4;
key.shadow.camera.near = 1;
key.shadow.camera.far = 30;
key.shadow.bias = -0.0002;
key.shadow.normalBias = 0.015;
key.shadow.radius = 4;
scene.add(key);
const fill = new THREE.DirectionalLight(0xeef3ff, 0.55);
fill.position.set(7, 2, 6);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 2.2);
rim.position.set(4, 6, -9);
scene.add(rim);
const under = new THREE.DirectionalLight(0xffffff, 0.35);
under.position.set(-2, -6, 4);
scene.add(under);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.2));

// ---------------- robot ----------------
const robot = createRobot(createMaterials());
robot.root.rotation.y = -0.62; // body three-quarter, facing screen-left
scene.add(robot.root);

// ---------------- fixed camera ----------------
const camera = new THREE.PerspectiveCamera(26.5, ASPECT, 0.1, 100);
camera.position.set(-0.2, 2.05, 12.4);
camera.lookAt(-0.55, 1.12, 0);
camera.updateMatrixWorld();

// ---------------- solve key head angles against the camera ----------------
function solve(dirFn) {
  let yaw = 0;
  let pitch = 0;
  const base = { roll: 0, lid: 0, breathe: 0 };
  for (let i = 0; i < 40; i++) {
    robot.applyPose({ ...base, yaw, pitch });
    robot.root.updateWorldMatrix(true, true);
    const f = robot.headForwardWorld();
    const d = dirFn(robot.eyeCentreWorld());
    yaw += Math.atan2(d.x, d.z) - Math.atan2(f.x, f.z);
    pitch += Math.asin(-f.y) * -1 + Math.asin(-d.y);
  }
  return [yaw, pitch];
}
const toCamera = (eye) => camera.position.clone().sub(eye).normalize();
const profile = (eye) => {
  const view = eye.clone().sub(camera.position).normalize();
  const left = new THREE.Vector3(0, 1, 0).cross(view).normalize();
  const down = 0.3; // bowed, as in the reference
  return left.multiplyScalar(Math.cos(down)).add(new THREE.Vector3(0, -Math.sin(down), 0));
};
const [yaw1, pitch1] = solve(toCamera);
const [yaw0, pitch0] = solve(profile);
const keys = { yaw0, pitch0, yaw1, pitch1 };

// ---------------- post ----------------
let composer;
let gtao;
function setupComposer(w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    samples: quality === 'low' ? 0 : 4,
  });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  if (quality !== 'low') {
    gtao = new GTAOPass(scene, camera, w, h);
    gtao.blendIntensity = 0.85;
    gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.2, scale: 1 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    composer.addPass(gtao);
  }
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.3, 0.25, 4.0));
  composer.addPass(new OutputPass());
}

scene.background = new THREE.Color(BACKGROUND);

// The background goes through tone mapping like everything else, so nudge its
// linear value until the final canvas pixel is exactly the requested grey.
function calibrateBackground() {
  const target = (BACKGROUND >> 16) & 255;
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  let v = scene.background.r;
  for (let i = 0; i < 12; i++) {
    scene.background.setRGB(v, v, v, THREE.LinearSRGBColorSpace);
    composer.render();
    gl.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const err = target - px[0];
    if (Math.abs(err) < 0.5) break;
    v *= Math.pow((target + 0.5) / Math.max(1, px[0] + 0.5), 2.2);
  }
}
function resize() {
  let w;
  let h;
  if (fixedW && fixedH) {
    w = fixedW;
    h = fixedH;
    renderer.setPixelRatio(1);
  } else {
    const box = canvas.parentElement.getBoundingClientRect();
    h = box.height;
    w = h * ASPECT;
    if (w > box.width) {
      w = box.width;
      h = w / ASPECT;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }
  renderer.setSize(Math.round(w), Math.round(h), !capture);
  const pr = renderer.getPixelRatio();
  if (composer) composer.dispose?.();
  setupComposer(Math.round(w * pr), Math.round(h * pr));
  composer.setPixelRatio?.(1);
  composer.setSize(Math.round(w * pr), Math.round(h * pr));
}
resize();
calibrateBackground();
if (!capture) addEventListener('resize', resize);

// ---------------- per-frame ----------------
const LAG1 = 0.07;
const LAG2 = 0.2;
function frame(t) {
  robot.applyPose(poseAt(t - LAG2, keys));
  const lag2 = robot.anchorsSnapshot();
  robot.applyPose(poseAt(t - LAG1, keys));
  const lag1 = robot.anchorsSnapshot();
  const p = poseAt(t, keys);
  robot.applyPose(p);
  const now = robot.anchorsSnapshot();
  robot.updateCables(now, lag1, lag2);
  robot.updatePistons();
  robot.aimEyes(camera.position, p.gazeX, p.gazeY);
  composer.render();
}

if (capture) {
  window.__duration = DURATION;
  window.__renderFrame = (t) => {
    frame(t);
    return true;
  };
  window.__ready = true;
} else {
  const start = performance.now();
  const loop = () => {
    const t = ((performance.now() - start) / 1000) % DURATION;
    frame(t);
    requestAnimationFrame(loop);
  };
  loop();
}
