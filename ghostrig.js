// ghostrig.js – loads the rigged ghost GLB (Mixamo skeleton) and drives it procedurally.
//
// CODER API (all angles in radians, expressed in CHARACTER space, the character faces +Z, its left side is +X):
//   const rig = await GhostRig.load('assets/ghost.glb');   // rig.root is the Object3D to add to the scene
//   rig.play('run', 0.15)                 // action: idle | stare | creep | walk | run | crouch | scream | jumpscare | reach
//   rig.gesture('headSnap', 0.6)          // one-shot overlay: headSnap | tilt | point | reach | shudder | lunge
//   rig.setOffset('Head', x, y, z)        // manual per-bone offset (until the next update; use rig.hold(...) to keep it)
//   rig.hold('Head', [x, y, z] | null)    // pin a bone offset on top of the action (null releases it)
//   rig.update(dt, { speed })             // call every frame
//   rig.bones.Head / rig.bones.LeftHand … // the raw THREE.Bone objects (names without the "mixamorig:" prefix)
// Axis semantics: +X pitches the TOP of a bone forward (head nods down, torso bends forward, an arm hanging down swings BACKWARD,
// so arm/leg "forward" is negative X). +Y turns toward the character's left. +Z rolls the top toward the character's right
// (left arm: +Z = outward, right arm: -Z = outward).
import { THREE } from './core.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const S = Math.sin, C = Math.cos, mx = Math.max;
const FING = ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb'];
const BONE_NAMES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];

function claw(p, k) { // curl all fingers (k 0..1)
  for (const side of ['Left', 'Right']) for (const f of FING) for (let i = 1; i <= 3; i++) p[`${side}Hand${f}${i}`] = [-(0.35 + i * 0.2) * k * (f === 'Thumb' ? 0.4 : 1), 0, 0];
}
const ACTIONS = {
  idle: (r) => { const p = { Spine: [0.04 + 0.02 * S(r.t * 1.3), 0, 0.02 * S(r.t * 0.9)], Spine2: [0.06, 0, 0], Head: [0.12 + 0.04 * S(r.t * 0.7), 0, 0.1],
    LeftArm: [0.05, 0, 0.1], RightArm: [0.05, 0, -0.1], LeftForeArm: [-0.15, 0, 0], RightForeArm: [-0.15, 0, 0] }; claw(p, 0.6); return p; },
  stare: (r) => { const p = ACTIONS.idle(r); p.Head = [r.tw[0] + 0.1, r.tw[1], r.tw[2] + 0.35]; p.Neck = [0.1, r.tw[1] * 0.4, 0]; p.Spine = [0.06, r.tw[1] * 0.2, 0.05]; return p; },
  walk: (r, c, run = false) => {
    const ph = r.t * (run ? 11 : 4.4), L = S(ph), R = -L, k = run ? 1 : 0.55, p = {
      LeftUpLeg: [-0.55 * k * L, 0, 0], RightUpLeg: [-0.55 * k * R, 0, 0], LeftLeg: [0.1 + 0.7 * k * mx(0, S(ph + 1.3)), 0, 0], RightLeg: [0.1 + 0.7 * k * mx(0, S(ph + 1.3 + Math.PI)), 0, 0],
      Spine: [0.08 + (run ? 0.3 : 0), 0, 0], Spine2: [0.05, S(ph) * 0.1, 0], Head: [r.tw[0] + (run ? -0.15 : 0.15), r.tw[1], r.tw[2] + 0.25], _hipsY: Math.abs(S(ph)) * 0.014 * (run ? 1.6 : 1) };
    if (run) { p.LeftArm = [-1.35 + 0.15 * L, 0, 0.15]; p.RightArm = [-1.35 - 0.15 * L, 0, -0.15]; p.LeftForeArm = [-0.3, 0, 0]; p.RightForeArm = [-0.3, 0, 0]; claw(p, 1); }
    else { p.LeftArm = [-0.3 * R, 0, 0.1]; p.RightArm = [-0.3 * L, 0, -0.1]; p.LeftForeArm = [-0.25, 0, 0]; p.RightForeArm = [-0.25, 0, 0]; claw(p, 0.7); }
    return p;
  },
  run: (r, c) => ACTIONS.walk(r, c, true),
  creep: (r, c) => { const p = ACTIONS.walk(r, c); p.Spine = [0.3, 0, 0]; p.Spine2 = [0.2, 0, 0]; p.Head = [0.45 + r.tw[0] * 0.5, r.tw[1], r.tw[2] + 0.4]; p.LeftArm = [-0.45, 0, 0.12]; p.RightArm = [-0.45, 0, -0.12]; p.LeftForeArm = [-0.7, 0, 0]; p.RightForeArm = [-0.7, 0, 0]; return p; },
  crouch: (r) => { const p = { LeftUpLeg: [-1.35, 0, 0.1], RightUpLeg: [-1.35, 0, -0.1], LeftLeg: [2.0, 0, 0], RightLeg: [2.0, 0, 0], LeftFoot: [-0.5, 0, 0], RightFoot: [-0.5, 0, 0],
    Spine: [0.55, 0, 0], Head: [-0.35 + r.tw[0] * 0.3, r.tw[1] * 0.6, r.tw[2]], LeftArm: [-0.7, 0, 0.2], RightArm: [-0.7, 0, -0.2], LeftForeArm: [-0.8, 0, 0], RightForeArm: [-0.8, 0, 0], _hipsY: -0.27 }; claw(p, 0.8); return p; },
  laugh: (r) => { const sh = S(r.t * 22), p = { Head: [-0.75 + 0.12 * sh, 0, 0.15 * S(r.t * 9)], Neck: [-0.25, 0, 0], Spine: [-0.18 + 0.05 * sh, 0, 0], Spine2: [-0.22 + 0.07 * sh, 0, 0], LeftArm: [-0.15, 0, 0.55], RightArm: [-0.15, 0, -0.55], LeftForeArm: [-0.4, 0, 0], RightForeArm: [-0.4, 0, 0], _hipsY: 0.012 * Math.abs(sh) }; claw(p, 0.8); return p; },
  // ---- the weeping woman (living form) ----
  // arm/leg numbers below were solved with inverse kinematics on this exact skeleton (hands really reach the face / belly / hang at the sides)
  sitcry: (r) => { const bu = mx(0, S(r.t * 1.7)), sob = S(r.t * 13) * bu, p = { LeftUpLeg: [-2.2, 0, 0.15], RightUpLeg: [-2.2, 0, -0.15], LeftLeg: [1.8, 0, 0], RightLeg: [1.8, 0, 0], LeftFoot: [-0.3, 0, 0], RightFoot: [-0.3, 0, 0], // sitting on the ground, knees up, hips resting on the dike
    Spine: [0.3 + 0.012 * sob, 0, 0], Spine1: [0.15, 0, 0], Spine2: [0.1 + 0.015 * sob, 0, 0.008 * S(r.t * 6.5)], Neck: [0.1, 0, 0], Head: [0.15 + 0.015 * sob, 0.01 * S(r.t * 0.9), 0],
    LeftArm: [-0.94, 0.75, -1.05], LeftForeArm: [0.35, 0, -1.89], RightArm: [-1.03, -0.16, 0.62], RightForeArm: [-1.21, 0, 1.48], _hipsY: -0.361 + 0.002 * sob }; claw(p, 0.25); return p; }, // palms held ~2 cm off the face (checked against the real mesh)
  stand: (r) => { const sn = mx(0, S(r.t * 3.1)) ** 4, p = { Spine: [0.08, 0, 0], Spine1: [0.04, 0, 0], Spine2: [0.03 + 0.008 * S(r.t * 1.8), 0, 0], Neck: [0.12, 0, 0], Head: [0.3 + 0.05 * sn, 0.04 * S(r.t * 0.7), 0.05],
    LeftArm: [-0.39, -0.05, -0.52], LeftForeArm: [-0.22, 0, -1.13], RightArm: [0.17, -0.11, 0.21], RightForeArm: [-0.31, 0, 1.18] }; claw(p, 0.3); return p; }, // sniffling; left hand rests on her belly, right arm hangs
  wipe: (r) => { const k = 0.5 + 0.5 * S(r.t * 5.2), A = [-0.75, 0, 0.4, -1.52, 1.41], B = [-0.87, 0.13, 1.05, -1.93, 1.19], m = (i) => A[i] + (B[i] - A[i]) * k, p = { Spine: [0.08, 0, 0], Spine1: [0.04, 0, 0], Spine2: [0.03, 0, 0], Neck: [0.12, 0, 0], Head: [0.3, 0, 0],
    LeftArm: [-0.39, -0.05, -0.52], LeftForeArm: [-0.22, 0, -1.13], RightArm: [m(0), m(1), m(2)], RightForeArm: [m(3), 0, m(4)] }; claw(p, 0.2); return p; }, // right hand sweeps from eye to cheek, kept ~2 cm off the face
  gaze: (r) => { const p = { Spine: [0, 0, 0], Spine1: [0, 0, 0], Spine2: [0.01 * S(r.t * 1.6), 0, 0], Neck: [0, 0, 0], Head: [-0.08, 0, 0.1], LeftArm: [0.16, 0.09, -0.28], LeftForeArm: [-0.32, 0, -1.08], RightArm: [0.17, -0.11, 0.21], RightForeArm: [-0.31, 0, 1.18] }; claw(p, 0.25); return p; },
  neckcrack: (r) => { // keeps her last living pose (arms hanging, head tilted) for 1 s, then only the neck snaps left / right - no raised arms, no body bounce
    const c = r.at - 1, k = Math.floor(c * 3.4) % 4, Y = c < 0 ? 0 : [1.3, -1.4, 1.0, -1.7][k], Z = c < 0 ? 0.1 : 0.4 * (k % 2 ? -1 : 1), p = { Spine: [0.02, Y * 0.08, 0], Neck: [0.04, Y * 0.35, 0], Head: [c < 0 ? -0.08 : -0.12, Y, Z],
      LeftArm: [0.05, 0, 0.1], RightArm: [0.05, 0, -0.1], LeftForeArm: [-0.15, 0, 0], RightForeArm: [-0.15, 0, 0] }; claw(p, 0.9); return p; },
  reach: (r) => { const p = ACTIONS.idle(r); p.LeftArm = [-1.5, 0, 0.1]; p.RightArm = [-1.5, 0, -0.1]; p.LeftForeArm = [-0.1, 0, 0]; p.RightForeArm = [-0.1, 0, 0]; claw(p, 1); return p; },
  scream: (r) => { const p = { Head: [-0.6, 0, S(r.t * 40) * 0.16], Neck: [-0.2, 0, 0], Spine: [-0.2, 0, 0], LeftArm: [-0.9, 0, 0.9], RightArm: [-0.9, 0, -0.9], LeftForeArm: [-0.6, 0, 0], RightForeArm: [-0.6, 0, 0] }; claw(p, 1); return p; },
  jumpscare: (r) => { const p = { Spine: [0.5, S(r.t * 25) * 0.06, 0], Head: [-0.15 + S(r.t * 45) * 0.1, S(r.t * 31) * 0.25, S(r.t * 38) * 0.3], LeftArm: [-1.65, 0, 0.15], RightArm: [-1.65, 0, -0.15],
    LeftForeArm: [-0.2, 0, 0], RightForeArm: [-0.2, 0, 0], LeftUpLeg: [-0.4, 0, 0], RightLeg: [0.5, 0, 0] }; claw(p, 1); return p; },
};
const GESTURES = { // additive overlays; k = envelope 0..1..0
  headSnap: (k, p) => add(p, 'Head', [0, 0.9 * k, 0.2 * k]), tilt: (k, p) => add(p, 'Head', [0, 0, 0.8 * k]),
  point: (k, p) => { add(p, 'RightArm', [-1.4 * k, 0, 0]); add(p, 'RightForeArm', [-0.1 * k, 0, 0]); }, reach: (k, p) => { add(p, 'LeftArm', [-1.4 * k, 0, 0]); add(p, 'RightArm', [-1.4 * k, 0, 0]); },
  slap: (k, p) => { add(p, 'RightArm', [-1.2 * k, 0.7 * k, -1.3 * k]); add(p, 'RightForeArm', [-0.5 * k, 0, 0]); add(p, 'Spine', [0.15 * k, 0.6 * k, 0]); add(p, 'Head', [0.1 * k, 0.3 * k, 0]); },
  shudder: (k, p, t) => { add(p, 'Spine2', [S(t * 60) * 0.08 * k, 0, S(t * 47) * 0.08 * k]); add(p, 'Head', [S(t * 53) * 0.12 * k, S(t * 41) * 0.12 * k, 0]); }, lunge: (k, p) => { add(p, 'Spine', [0.6 * k, 0, 0]); add(p, 'Head', [-0.3 * k, 0, 0]); },
};
function shrink(tex, max) { // downscale big embedded textures (phones run out of memory on 4K maps)
  if (!tex || !tex.image) return tex; const im = tex.image, w = im.width || im.videoWidth, h = im.height || im.videoHeight;
  if (!w || Math.max(w, h) <= max) return tex; const k = max / Math.max(w, h), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); if (im.close) im.close(); tex.image = c; tex.flipY = false; tex.needsUpdate = true; return tex;
}
function add(p, b, v) { const o = p[b] || (p[b] = [0, 0, 0]); o[0] += v[0]; o[1] += v[1]; o[2] += v[2]; }

export class GhostRig {
  static load(url, height = 1.9, maxTex = 1024, track = true) {
    return new Promise((res, rej) => new GLTFLoader().load(url, (g) => { try { if (track) GhostRig.progress = 1; res(new GhostRig(g, height, maxTex)); } catch (e) { rej(e); } }, (x) => { if (track) GhostRig.progress = Math.min(0.97, x.loaded / (x.total || 11603276)); }, (e) => rej(e instanceof Error ? e : new Error('cannot fetch ' + url))));
  }
  static progress = 0;
  static preload(url, h, m, track = true) { const c = GhostRig._pm || (GhostRig._pm = {}); return c[url] || (c[url] = GhostRig.load(url, h, m, track).catch((e) => { c[url] = null; throw e; })); }
  constructor(gltf, height = 1.9, maxTex = 1024) {
    this.root = new THREE.Group(); this.model = gltf.scene; this.root.add(this.model); this.bones = {}; this.rest = {}; this.cur = {}; this.held = {}; this.t = Math.random() * 10;
    this.action = 'idle'; this.g = null; this.tw = [0, 0, 0]; this.twT = 0; this.hipsY = 0;
    this._e = new THREE.Euler(); this._q1 = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._v = new THREE.Vector3();
    this.model.traverse((o) => {
      if (o.isBone) this.bones[o.name.replace(/^mixamorig:?/, '')] = o;
      if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; const m = o.material; // light, cheap material; slight self-glow so she reads through the fog
        let map = m.map; try { map = shrink(m.map, maxTex); } catch (e) { console.warn('texture shrink failed', e); map = m.map; } o.material = new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0, emissive: 0x2c2c2e, emissiveMap: map, side: THREE.DoubleSide }); }
    });
    this.model.updateMatrixWorld(true);
    for (const n in this.bones) { const b = this.bones[n]; this.rest[n] = { q: b.quaternion.clone(), wq: b.getWorldQuaternion(new THREE.Quaternion()), p: b.position.clone() }; this.cur[n] = [0, 0, 0]; }
    const top = this.bones.HeadTop_End || this.bones.Head; let h = top ? top.getWorldPosition(this._v).y : 1; if (!(h > 0.01)) h = 1; this.model.scale.setScalar(height / h);
  }
  play(name, fade = 0.2) { if (ACTIONS[name] && name !== this.action) { this.action = name; this.fade = fade; this.at = 0; } }
  gesture(name, dur = 0.8) { if (GESTURES[name]) this.g = { name, t: 0, dur }; }
  hold(bone, v) { if (v) this.held[bone] = v; else delete this.held[bone]; }
  setOffset(bone, x, y, z) { this.held[bone] = [x, y, z]; }
  _apply(name, v) {
    const b = this.bones[name], r = this.rest[name]; if (!b) return;
    this._q1.setFromEuler(this._e.set(v[0], v[1], v[2], 'XYZ')); this._q2.copy(r.wq).invert().multiply(this._q1).multiply(r.wq); b.quaternion.copy(r.q).multiply(this._q2);
  }
  update(dt, ctx = {}) {
    this.t += dt; this.at = (this.at || 0) + dt; this.twT -= dt; if (this.twT <= 0) { this.twT = 0.08 + Math.random() * 0.35; this.tw = [(Math.random() - 0.4) * 0.4, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9]; }
    const pose = ACTIONS[this.action](this, ctx);
    if (this.g) { const g = this.g; g.t += dt; const k = g.t / g.dur; if (k >= 1) this.g = null; else GESTURES[g.name](S(k * Math.PI), pose, this.t); }
    for (const b in this.held) add(pose, b, this.held[b]);
    const rate = this.action === 'run' || this.action === 'jumpscare' || this.action === 'scream' || this.action === 'neckcrack' ? 22 : this.fade >= 0.4 ? 3 / this.fade : 11, a = 1 - Math.exp(-rate * dt);
    for (const n in this.cur) { const c = this.cur[n], t = pose[n] || [0, 0, 0]; c[0] += (t[0] - c[0]) * a; c[1] += (t[1] - c[1]) * a; c[2] += (t[2] - c[2]) * a; this._apply(n, c); }
    this.hipsY += ((pose._hipsY || 0) - this.hipsY) * a; const hp = this.bones.Hips; if (hp) hp.position.y = this.rest.Hips.p.y + this.hipsY;
  }
}

// First-person arm/fist model (static mesh, forearm base at y=0, fist at the top).
// opt.base / opt.tip = model-space centre of the wrist-end and of the hand: the model is straightened so base->tip points forward (-Z) and the base sits at the origin.
// opt.roll = roll around the forearm (radians). Returns a Group whose local -Z is the forearm direction.
export function loadHandModel(url, maxTex = 1024, opt = {}) {
  return new Promise((res, rej) => new GLTFLoader().load(url, (g) => {
    try {
      g.scene.traverse((o) => {
        if (!o.isMesh) return; o.frustumCulled = false; o.castShadow = false; const m = o.material; let map = m.map; try { map = shrink(m.map, maxTex); } catch (e) { map = m.map; }
        o.material = new THREE.MeshStandardMaterial({ map, roughness: 0.85, metalness: 0, emissive: 0x241a14, emissiveMap: map });
      });
      const b = new THREE.Vector3(...(opt.base || [0, 0, 0])), t = new THREE.Vector3(...(opt.tip || [0, 1, 0])), q = new THREE.Quaternion().setFromUnitVectors(t.clone().sub(b).normalize(), new THREE.Vector3(0, 1, 0));
      const inner = new THREE.Group(); inner.quaternion.copy(q); inner.position.copy(b).applyQuaternion(q).negate(); inner.add(g.scene);
      const pivot = new THREE.Group(); pivot.rotation.x = -Math.PI / 2; pivot.add(inner);
      const wrap = new THREE.Group(); wrap.rotation.z = opt.roll || 0; wrap.add(pivot); res(wrap);
    } catch (e) { rej(e); }
  }, undefined, (e) => rej(e instanceof Error ? e : new Error('cannot fetch ' + url))));
}
