// fishing.js – bamboo fishing trap (បង្កៃ) and fish simulation
import { THREE, V3, rand, lerp, clamp, pick, colored, WATER_Y } from './core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const FISH_TYPES = {
  snakehead: { km: 'ត្រីរ៉ស់', en: 'Snakehead', len: 0.75, body: 0x3a4526, belly: 0xa8a27a, h: 0.1 },
  catfish: { km: 'ត្រីអណ្ដែង', en: 'Catfish', len: 0.5, body: 0x55503f, belly: 0x9a937c, h: 0.11 },
  small: { km: 'ត្រីក្រាញ់', en: 'Climbing perch', len: 0.16, body: 0xb8c4c0, belly: 0xe6ece8, h: 0.06 },
};

let TRAP_GEO = null, TRAP_STOW = null, TRAP_MAT = null;
// បង្កៃ: bent bamboo pole (ដងបង្កៃ) + thin line (ខ្សែបង្កៃ) + bait (នុយ).
// PLACED: pole planted in the mud, line hangs from the tip to the water where the bait floats.
// STOWED (carried / on the table): line pulled taut from the tip back to the pole, tied with the bait at the knot.
function buildTrap(stowed) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z), parts = [];
  const P = stowed ? [[0, -0.3, 0], [0, 0.3, 0], [0, 0.95, 0], [0.04, 1.5, 0], [0.2, 1.82, 0], [0.45, 1.9, 0], [0.62, 1.78, 0]] : [[0, -0.3, 0], [0, 0.3, 0], [0.02, 0.95, 0], [0.12, 1.45, 0], [0.4, 1.8, 0], [0.75, 1.88, 0], [0.9, 1.74, 0]];
  const curve = new THREE.CatmullRomCurve3(P.map(p => V(...p)));
  parts.push(colored(new THREE.TubeGeometry(curve, 28, 0.022, 6, false), 0x5b4121));
  for (const t of [0.22, 0.38, 0.55, 0.7, 0.85]) { const p = curve.getPoint(t), tg = curve.getTangent(t), tor = new THREE.TorusGeometry(0.026, 0.006, 4, 8);
    tor.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), tg)); tor.translate(p.x, p.y, p.z); parts.push(colored(tor, 0x35270f)); }
  const tip = P[6], knot = stowed ? V(0.02, 0.62, 0) : V(0.9, 0.22, 0), from = V(tip[0], tip[1], tip[2]), dir = knot.clone().sub(from), len = dir.length();
  const ln = new THREE.CylinderGeometry(0.004, 0.004, len, 4); ln.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize())); ln.translate(from.x + dir.x / 2, from.y + dir.y / 2, from.z + dir.z / 2);
  parts.push(colored(ln, 0xc4c8cc));
  parts.push(colored(new THREE.SphereGeometry(0.03, 6, 5).scale(1, 1.3, 1).translate(knot.x, knot.y, knot.z), 0xe6c28c));
  const hk = new THREE.TorusGeometry(0.02, 0.003, 4, 8, Math.PI * 1.4); hk.translate(knot.x, knot.y - 0.05, knot.z); parts.push(colored(hk, 0xaaaaaa));
  return mergeGeometries(parts);
}
export function makeTrapMesh(stowed = false) {
  TRAP_GEO = TRAP_GEO || buildTrap(false); TRAP_STOW = TRAP_STOW || buildTrap(true);
  TRAP_MAT = TRAP_MAT || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide, emissive: 0x1d160a });
  const m = new THREE.Mesh(stowed ? TRAP_STOW : TRAP_GEO, TRAP_MAT); m.castShadow = true; return m;
}
export const trapGeometry = () => { makeTrapMesh(); return TRAP_GEO; };
export const stowedGeometry = () => { makeTrapMesh(); return TRAP_STOW; };

const FISH_CACHE = {};
function fishAssets(type) {
  if (FISH_CACHE[type]) return FISH_CACHE[type];
  const T = FISH_TYPES[type], c = (hex, e) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, emissive: new THREE.Color(hex).multiplyScalar(e) });
  const A = { mat: c(T.body, 0.3), belly: c(T.belly, 0.25), eye: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    body: new THREE.SphereGeometry(0.5, 12, 8), tail: new THREE.ConeGeometry(T.h * 0.9, T.len * 0.3, 4).rotateZ(Math.PI / 2).translate(-T.len * 0.14, 0, 0),
    fin: new THREE.ConeGeometry(T.h * 0.3, T.len * 0.4, 3).rotateZ(Math.PI / 2), pect: new THREE.ConeGeometry(T.h * 0.25, T.len * 0.18, 3).rotateZ(Math.PI / 2),
    whisk: new THREE.CylinderGeometry(0.004, 0.003, 0.2, 4).rotateZ(Math.PI / 2), head: new THREE.SphereGeometry(0.5, 8, 6), eyeG: new THREE.SphereGeometry(0.008, 5, 4) };
  return (FISH_CACHE[type] = A);
}
export function makeFishMesh(type) {
  const T = FISH_TYPES[type], A = fishAssets(type), g = new THREE.Group(), M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const flat = type === 'snakehead' ? 0.8 : 1;
  M(A.body, A.mat).scale.set(T.len, T.h, T.h * 1.1 * flat);
  M(A.body, A.belly, 0, -T.h * 0.25, 0).scale.set(T.len * 0.92, T.h * 0.55, T.h);
  const hd = M(A.head, A.mat, T.len * (type === 'snakehead' ? 0.4 : 0.36), 0, 0); hd.scale.set(T.len * (type === 'catfish' ? 0.3 : 0.26), T.h * (type === 'snakehead' ? 0.75 : 1), T.h * (type === 'catfish' ? 1.5 : 1.0));
  for (const s of [-1, 1]) { M(A.eyeG, A.eye, T.len * 0.42, T.h * 0.3, s * T.h * 0.4); M(A.pect, A.mat, T.len * 0.22, -T.h * 0.2, s * T.h * 0.9).rotation.y = s * 0.6; }
  const tail = new THREE.Group(); tail.position.x = -T.len * 0.5; g.add(tail); const tm = new THREE.Mesh(A.tail, A.mat); tm.scale.z = 0.3; tail.add(tm);
  M(A.fin, A.mat, -T.len * 0.05, T.h * 0.55, 0).scale.z = 0.2;
  if (type === 'snakehead') M(A.fin, A.mat, -T.len * 0.3, T.h * 0.45, 0).scale.set(1.8, 0.7, 0.2);
  if (type === 'catfish') for (const s of [-1, 1]) for (const k of [0, 1]) { const w = M(A.whisk, A.mat, T.len * 0.52, -0.01, s * (0.035 + k * 0.03)); w.rotation.y = s * (0.5 + k * 0.5); }
  g.userData.tail = tail; g.userData.head = hd; return g;
}

const FISH_WEIGHTS = [['snakehead', 0.25], ['catfish', 0.3], ['small', 0.45]];
const rollType = (g) => { // level 2 only needs catfish + snakehead: weight each by how many are still missing
  if (g && g.level === 2 && g.targets.byType) { if (Math.random() < 0.30) return 'small'; /* a wasted pull: climbing perch does not count */ const w = Object.entries(g.targets.byType).map(([k, n]) => [k, Math.max(0, n - (g.fishByType[k] || 0)) + 0.6]); let r = Math.random() * w.reduce((a, b) => a + b[1], 0); for (const [k, x] of w) { r -= x; if (r <= 0) return k; } return w[0][0]; }
  let r = Math.random(); for (const [k, w] of FISH_WEIGHTS) { r -= w; if (r <= 0) return k; } return 'small'; };

export class FishingTrap {
  constructor(game, x, z, yaw) {
    this.g = game; this.mesh = makeTrapMesh(true); this.pos = V3(x, -0.12, z); this.yaw = yaw;
    this.mesh.rotation.y = yaw;
    this.mesh.position.set(x, 0.5, z); game.scene.add(this.mesh);
    this.state = 'placing'; this.t = 0; this.catchChance = rand(0.4, 0.85); this.timer = rand(18, 45);
    this.fishType = null; this.fishMesh = null; this.splashT = 0; this.busy = false; this.age = 0; this.tug = 0; this.pullT = 0; this.onPulled = null; this.slide = null;
    this.mouth = V3(); this.updateMouth();
  }
  updateMouth() { const a = this.mesh.rotation.y; this.mouth.set(this.pos.x + Math.cos(a) * 0.9, WATER_Y, this.pos.z - Math.sin(a) * 0.9); }
  nudge() { // mysterious movement
    if (this.state === 'placing' || this.state === 'pulling' || this.slide) return false; const a = rand(0, 6.28), d = rand(0.7, 1.3), x1 = this.pos.x + Math.cos(a) * d, z1 = this.pos.z + Math.sin(a) * d;
    if (!this.g.env.isWaterAt(x1, z1, 0.4)) return false; this.slide = { t: 0, dur: 1.6, x0: this.pos.x, z0: this.pos.z, x1, z1 }; return true;
  }
  beginPull(cb) { if (this.state === 'pulling' || this.state === 'placing') return false; this.state = 'pulling'; this.pullT = 0; this.onPulled = cb; this.slide = null; this.busy = true; this.g.audio.splash(this.pos, 0.8); this.g.fx.splash(this.pos.x, this.pos.z, 8, 0.8); return true; }
  update(dt) {
    this.age += dt;
    if (this.state === 'pulling') {
      this.pullT += dt; const k = clamp(this.pullT / 1.1, 0, 1), e = k * k * (3 - 2 * k), p = this.g.player.pos;
      this.mesh.position.set(lerp(this.pos.x, p.x + (this.pos.x - p.x) * 0.45, e), lerp(this.pos.y, 0.3, e), lerp(this.pos.z, p.z + (this.pos.z - p.z) * 0.45, e));
      this.mesh.rotation.z = Math.sin(this.pullT * 18) * 0.12 * (this.fishMesh ? 1 : 0.3); this.mesh.rotation.x = -0.35 * e;
      if (this.fishMesh) this.fishMesh.userData.tail.rotation.y = Math.sin(this.pullT * 30) * 0.8;
      if (Math.random() < dt * 20) this.g.fx.drip(this.mesh.position.x, this.mesh.position.y - 0.1, this.mesh.position.z);
      if (this.pullT >= 1.35) { const f = this.onPulled; this.onPulled = null; f && f(); }
      return;
    }
    if (this.slide) { const s = this.slide; s.t += dt; const k = clamp(s.t / s.dur, 0, 1); this.pos.x = lerp(s.x0, s.x1, k); this.pos.z = lerp(s.z0, s.z1, k); this.mesh.position.x = this.pos.x; this.mesh.position.z = this.pos.z;
      if (Math.random() < dt * 8) this.g.fx.ripple(this.pos.x, this.pos.z, 0.7, 0.9); if (k >= 1) { this.slide = null; this.updateMouth(); } }
    if (this.tug > 0) { this.tug -= dt; this.mesh.rotation.z = Math.sin(this.age * 40) * 0.08 * Math.min(1, this.tug); }
    if (this.state === 'placing') {
      this.t += dt / 0.55; const e = clamp(this.t, 0, 1), k = e * e;
      this.mesh.position.y = lerp(0.5, this.pos.y, k); this.mesh.rotation.z = Math.sin(e * 9) * 0.25 * (1 - e);
      if (this.t >= 1) { this.mesh.geometry = trapGeometry(); this.state = 'idle'; this.mesh.rotation.z = 0; this.g.fx.splash(this.mouth.x, this.mouth.z, 8, 0.8); this.g.audio.place(this.pos); }
      return;
    }
    if (this.state === 'idle') {
      if (!this.busy) { this.timer -= dt; if (this.timer <= 0) this.attempt(); }
    } else if (this.state === 'caught') {
      this.splashT -= dt;
      if (this.splashT <= 0) {
        this.splashT = rand(1.8, 4); this.g.fx.splash(this.pos.x, this.pos.z, 5, 0.6);
        if (this.pos.distanceTo(this.g.player.pos) < 45) this.g.audio.flop(this.pos);
      }
      this.mesh.rotation.z = Math.sin(this.age * 22) * 0.04 * (this.splashT > 1.6 ? 1 : 0.2);
      if (this.fishMesh) { this.fishMesh.userData.tail.rotation.y = Math.sin(this.age * 25) * 0.6; }
    }
  }
  attempt() {
    this.busy = true; const ok = Math.random() < this.catchChance;
    this.g.fishSys.dispatch(this, ok, ok ? rollType(this.g) : 'small');
  }
  attemptDone(success, type) {
    this.busy = false;
    if (success) {
      this.state = 'caught'; this.fishType = type; this.splashT = 0.4;
      this.fishMesh = makeFishMesh(type); const s = Math.min(1, 0.55 / FISH_TYPES[type].len); this.fishMesh.scale.setScalar(s);
      this.fishMesh.position.set(0.9, 0.2, 0); this.fishMesh.rotation.set(0, 0, 1.15); this.mesh.add(this.fishMesh); this.tug = 1.5;
    } else this.timer = rand(14, 35);
  }
  takeFish() { const type = this.fishType; if (this.fishMesh) this.mesh.remove(this.fishMesh); this.fishMesh = null; this.fishType = null; return type; }
  dispose() { this.g.scene.remove(this.mesh); if (this.fishMesh) { this.mesh.remove(this.fishMesh); this.fishMesh = null; } } // (the old version removed children while traverse() was iterating them, which threw when a trap still held a fish -> restart after winning hung)
}

class Fish {
  constructor(sys, type, x, z) {
    this.sys = sys; this.type = type; this.mesh = makeFishMesh(type); this.x = x; this.z = z; this.y = WATER_Y - 0.045;
    this.head = rand(0, 6.28); this.want = this.head; this.reTurn = rand(1, 3); this.speed = rand(0.25, 0.6) * (type === 'small' ? 1.3 : 1);
    this.mode = 'wander'; this.mission = null; this.hideT = 0; this.pitch = 0; this.t = 0; this.dead = false; this.ph = rand(0, 9); this.ripT = rand(2, 5);
    sys.g.scene.add(this.mesh); this.sync();
  }
  sync() { this.mesh.position.set(this.x, this.y, this.z); this.mesh.rotation.y = this.head; if (this.mode !== 'nibble') this.mesh.rotation.z = Math.sin(this.ph * 2) * 0.03; }
  turnTo(a, dt, rate = 3) { let d = a - this.head; d = Math.atan2(Math.sin(d), Math.cos(d)); this.head += clamp(d, -rate * dt, rate * dt); }
  update(dt) {
    const g = this.sys.g, env = g.env; this.t += dt; this.ph += dt;
    if (this.mode !== 'flee') this.mesh.userData.tail.rotation.y = Math.sin(this.ph * (this.mode === 'hide' ? 3 : 9)) * 0.5;
    let sp = this.speed; const pp = g.player.pos, pd = Math.hypot(this.x - pp.x, this.z - pp.z);
    if ((this.mode === 'wander' || this.mode === 'hide') && pd < 2.6 && (g.player.moving || pd < 1.4)) { // disturbed -> escape
      this.mode = 'flee'; this.t = 0; this.want = Math.atan2(-(this.z - pp.z), this.x - pp.x); this.y = WATER_Y - 0.045;
      if (pd < 2) { g.fx.splash(this.x, this.z, 4, 0.4); if (Math.random() < 0.5) g.audio.splash({ x: this.x, y: 0.1, z: this.z }, 0.4); }
    }
    if (this.mode === 'flee') { this.turnTo(this.want, dt, 8); const nx = this.x + Math.cos(this.head) * 2.4 * dt, nz = this.z - Math.sin(this.head) * 2.4 * dt;
      if (env.isWaterAt(nx, nz, 0.5)) { this.x = nx; this.z = nz; } else this.want += 2; this.mesh.userData.tail.rotation.y = Math.sin(this.ph * 22) * 0.8; if (this.t > 1.3) { this.mode = 'wander'; this.speed = rand(0.25, 0.6); } }
    else if (this.mode === 'hide') { this.hideT -= dt; this.y += ((WATER_Y - 0.13) - this.y) * Math.min(1, dt * 3); if (this.hideT <= 0) { this.mode = 'wander'; this.y = WATER_Y - 0.045; } }
    else if (this.mode === 'wander') {
      if (this.type !== 'small' ? Math.random() < dt * 0.04 : Math.random() < dt * 0.06) { this.mode = 'hide'; this.hideT = rand(4, 9); }
      this.reTurn -= dt; if (this.reTurn <= 0) { this.want = this.head + rand(-1.5, 1.5); this.reTurn = rand(1.5, 4); }
      this.turnTo(this.want, dt, 2);
      this.ripT -= dt; if (this.ripT <= 0) { this.ripT = rand(4, 9); if (Math.hypot(this.x - g.player.pos.x, this.z - g.player.pos.z) < 18) g.fx.ripple(this.x, this.z, 0.5, 1.0); }
      const nx = this.x + Math.cos(this.head) * sp * dt, nz = this.z - Math.sin(this.head) * sp * dt;
      if (env.isWaterAt(nx, nz, 0.6)) { this.x = nx; this.z = nz; } else { this.want = this.head + Math.PI * rand(0.6, 1.4); this.head += 2.5 * dt; }
      if (Math.hypot(this.x - g.player.pos.x, this.z - g.player.pos.z) > 38) this.respawn();
    } else {
      const tr = this.mission.trap, m = tr.mouth;
      if (this.mode === 'approach') {
        const dx = m.x - this.x, dz = m.z - this.z, d = Math.hypot(dx, dz);
        this.turnTo(Math.atan2(-dz, dx), dt, 4); sp = 0.9;
        this.x += Math.cos(this.head) * sp * dt; this.z -= Math.sin(this.head) * sp * dt;
        if (d < 0.3) { if (this.mission.success) { tr.attemptDone(true, this.mission.type); this.remove(); } else { this.mode = 'nibble'; this.t = 0; } }
      } else if (this.mode === 'nibble') {
        const a = this.t * 2.2, bite = Math.sin(this.t * 7) > 0.55; this.x = m.x + Math.cos(a) * (bite ? 0.12 : 0.35); this.z = m.z + Math.sin(a) * (bite ? 0.12 : 0.35); this.head = -a - Math.PI / 2;
        this.mesh.rotation.z = bite ? -0.5 : 0; if (bite && Math.random() < dt * 4) tr.tug = 0.5;
        this.ripT -= dt; if (this.ripT <= 0) { this.ripT = 0.6; g.fx.ripple(m.x, m.z, 0.5, 0.8); if (g.player.pos.distanceTo(m) < 30) g.audio.splash(m, 0.3); }
        if (this.t > 3.2) { this.mode = 'leave'; this.want = rand(0, 6.28); tr.attemptDone(false); }
      } else if (this.mode === 'leave') {
        this.turnTo(this.want, dt, 3); this.x += Math.cos(this.head) * 1.1 * dt; this.z -= Math.sin(this.head) * 1.1 * dt;
        if (!env.isWaterAt(this.x, this.z, 0.3) || this.t > 8) this.remove();
      }
    }
    this.sync();
  }
  respawn() {
    const g = this.sys.g, p = g.player.pos;
    for (let i = 0; i < 15; i++) { const a = rand(0, 6.28), r = rand(6, 26), x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r; if (g.env.isWaterAt(x, z, 1)) { this.x = x; this.z = z; return; } }
  }
  remove() { this.dead = true; this.sys.g.scene.remove(this.mesh); }
}

export class FishSystem {
  constructor(game) { this.g = game; this.fish = []; }
  reset() { for (const f of this.fish) this.g.scene.remove(f.mesh); this.fish = []; const n = this.g.low ? 6 : 10; for (let i = 0; i < n; i++) this.spawnAmbient(); }
  spawnAmbient() { const f = new Fish(this, pick(['small', 'small', 'catfish', 'snakehead']), 0, 0); f.respawn(); f.sync(); this.fish.push(f); }
  dispatch(trap, success, type) {
    const env = this.g.env;
    for (let i = 0; i < 20; i++) {
      const a = rand(0, 6.28), r = rand(3, 5), x = trap.pos.x + Math.cos(a) * r, z = trap.pos.z + Math.sin(a) * r;
      if (env.isWaterAt(x, z, 0.5) || i === 19) {
        const f = new Fish(this, success ? type : 'small', x, z); f.mode = 'approach'; f.mission = { trap, success, type }; f.t = 0; this.fish.push(f); return;
      }
    }
  }
  update(dt) {
    for (const f of this.fish) f.update(dt);
    this.fish = this.fish.filter(f => !f.dead);
  }
}
