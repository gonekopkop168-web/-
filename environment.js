// environment.js – rice-field world, collision, sky, fog, fireflies, FX
import {
  THREE, V3, rand, clamp, pick, lerp, settings, colored, woodTexture, mudTexture, glowTexture, fogTexture, waterNormalTexture, moonEnvTexture,
  HALF, DIKES, DIKE_HW, FLOOR_Y, DRY_Y, MUD_Y, WATER_Y, HOUSE, IS_TOUCH,
} from './core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeTrapMesh } from './fishing.js';
import { buildHouse } from './house.js';

const EDGES = [-HALF - 2, ...DIKES, HALF + 2];
const dikeDist = (c) => { let m = 99; for (const d of DIKES) m = Math.min(m, Math.abs(c - d)); return m; };

export class Environment {
  constructor(game) {
    this.g = game; this.scene = game.scene; this.boxes = []; this.circles = []; this.trees = [];
    this.time = 0; this.gustV = 0; this.riceU = { uTime: { value: 0 }, uGust: { value: 0 } };
    this.waterCells = []; this.riceCells = []; this.makeTrapMesh = makeTrapMesh;
    this.q = settings.quality;
    this.sky(); this.lights(); this.ground(); this.paddies(); this.canals();
    const h = buildHouse(this); this.door = h.door; this.houseItems = h.items;
    this.vegetation(); this.village(); this.fogSprites(); this.fireflies();
  }

  // ---------- queries ----------
  inHouseXZ(x, z, m = 0) { return x > HOUSE.x0 - m && x < HOUSE.x1 + m && z > HOUSE.z0 - m && z < HOUSE.z1 + m; }
  inYard(x, z) { return Math.abs(x) < 10 && Math.abs(z) < 10; }
  inCanal(x, z) { return (z > -82 && z < -78) || (x > 78 && x < 82); }
  isDry(x, z) { return this.inYard(x, z) || dikeDist(x) < DIKE_HW || dikeDist(z) < DIKE_HW; }
  isWaterAt(x, z, m = 0.3) {
    if (Math.abs(x) > HALF - 1 || Math.abs(z) > HALF - 1) return false;
    if (this.inYard(x, z) || dikeDist(x) < DIKE_HW + m || dikeDist(z) < DIKE_HW + m) return false;
    if ((z > -83 && z < -77) || (x > 77 && x < 83)) return false;
    for (const c of this.circles) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (c.r + m) * (c.r + m)) return false; }
    return true;
  }
  groundY(x, z) {
    if (x > HOUSE.x0 && x < HOUSE.x1 && z > HOUSE.z0 && z < HOUSE.z1) return FLOOR_Y;
    if (Math.abs(x) < 0.95 && z >= 3 && z < 4.8) return FLOOR_Y - 0.8 * (Math.floor((z - 3) / 0.3) + 1) / 6;
    return this.isDry(x, z) ? DRY_Y : MUD_Y;
  }
  blocked(x, z, r, ghost = false) {
    if (Math.abs(x) > HALF || Math.abs(z) > HALF) return true;
    for (const b of this.boxes) {
      if (b.active === false) continue; if (ghost && b.noGhost) continue;
      const cx = clamp(x, b.x0, b.x1), cz = clamp(z, b.z0, b.z1), dx = x - cx, dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    if (!ghost) for (const c of this.circles) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (c.r + r) * (c.r + r)) return true; }
    return false;
  }
  canStand(x, z, y, r) { return !this.blocked(x, z, r) && this.groundY(x, z) - y <= 0.5; }
  tryMove(p, dx, dz, r) {
    if (this.canStand(p.x + dx, p.z, p.y, r)) p.x += dx;
    if (this.canStand(p.x, p.z + dz, p.y, r)) p.z += dz;
  }
  snapToDike(x, z) {
    let bx = x, bz = z, best = 99;
    for (const d of DIKES) {
      if (Math.abs(x - d) < best) { best = Math.abs(x - d); bx = d; bz = z; }
      if (Math.abs(z - d) < best) { best = Math.abs(z - d); bx = x; bz = d; }
    }
    return { x: bx, z: bz };
  }
  gust(sec) { this.gustV = Math.max(this.gustV, sec); }

  // ---------- sky / lights ----------
  sky() {
    const s = this.scene; s.background = new THREE.Color(0x070b14); s.fog = new THREE.FogExp2(0x0b121b, this.q === 'low' ? 0.036 : 0.042);
    this.moonDir = V3(-0.35, 0.5, -0.8).normalize();
    const moon = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), new THREE.MeshBasicMaterial({ color: 0xe3ebff, fog: false }));
    moon.position.copy(this.moonDir).multiplyScalar(420); s.add(moon);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(190,210,255,1)', 128), fog: false, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(150, 150, 1); glow.position.copy(moon.position); s.add(glow);
    const n = 450, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = V3(rand(-1, 1), rand(0.05, 1), rand(-1, 1)).normalize().multiplyScalar(500); pos.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.7 })));
  }
  lights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x3a4c7a, 0x151a10, 1.25));
    this.moon = new THREE.DirectionalLight(0x8fa8e0, 1.5); this.moon.position.copy(this.moonDir).multiplyScalar(100); s.add(this.moon, this.moon.target);
    if (this.q !== 'low') {
      this.moon.castShadow = true; const m = this.q === 'high' ? 2048 : 1024; this.moon.shadow.mapSize.set(m, m);
      const c = this.moon.shadow.camera; c.left = c.bottom = -34; c.right = c.top = 34; c.near = 10; c.far = 230; this.moon.shadow.bias = -0.0004;
    }
  }

  // ---------- terrain ----------
  ground() {
    const s = this.scene;
    const mud = new THREE.MeshStandardMaterial({ map: mudTexture('#26200f', false, 70, 70), roughness: 1 });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), mud); g.rotation.x = -Math.PI / 2; g.position.y = -0.15; g.receiveShadow = true; s.add(g);
    const dikeMat = new THREE.MeshStandardMaterial({ map: mudTexture('#3a3220', true, 30, 1), roughness: 1 });
    const dikeMat2 = new THREE.MeshStandardMaterial({ map: mudTexture('#3a3220', true, 1, 30), roughness: 1 });
    const len = (HALF + 2) * 2;
    DIKES.forEach((d) => {
      const a = new THREE.Mesh(new THREE.BoxGeometry(DIKE_HW * 2, 0.45, len), dikeMat2); a.position.set(d, 0.075, 0); a.receiveShadow = true; s.add(a);
      const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.452, DIKE_HW * 2), dikeMat); b.position.set(0, 0.0755, d); b.receiveShadow = true; s.add(b);
    });
    const yard = new THREE.Mesh(new THREE.BoxGeometry(20, 0.454, 20), new THREE.MeshStandardMaterial({ map: mudTexture('#33291a', true, 8, 8), roughness: 1 }));
    yard.position.set(0, 0.077, 0); yard.receiveShadow = true; s.add(yard);
  }

  paddies() {
    const s = this.scene, q = this.q, sp = q === 'low' ? 1.6 : q === 'medium' ? 1.2 : 0.95;
    this.waterTex = waterNormalTexture(); const env = moonEnvTexture();
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x3b2f1c, roughness: 0.1, metalness: 0.5, normalMap: this.waterTex, normalScale: new THREE.Vector2(0.35, 0.35), envMap: env, envMapIntensity: 1.4, transparent: true, opacity: 0.9 });
    // rice clump: 6 blades with different heights / bends + drooping grain heads on the tall ones (vertex coloured)
    const pos = [], col = [], idx = []; const cb = new THREE.Color(0x1a3811), ct = new THREE.Color(0x6f9a2c), ch = new THREE.Color(0xb9a64a);
    const blades = [[0.3, 1.05, 0.28, 1], [1.4, 0.9, 0.2, 1], [2.3, 0.78, 0.12, 0], [3.4, 1.12, 0.34, 1], [4.4, 0.62, 0.08, 0], [5.4, 0.95, 0.25, 1]];
    for (const [a0, H, bendK, head] of blades) {
      const ca = Math.cos(a0), sa = Math.sin(a0), base = pos.length / 3, ox = Math.cos(a0 * 2) * 0.04, oz = Math.sin(a0 * 2) * 0.04;
      for (let sI = 0; sI <= 4; sI++) {
        const t = sI / 4, w = 0.05 * (1 - t * 0.9), y = t * H, bend = t * t * bendK, c = cb.clone().lerp(ct, Math.min(1, t * 1.2));
        for (const sgn of [-1, 1]) { pos.push(ox + ca * w * sgn + sa * bend, y - t * t * bendK * 0.35, oz + sa * w * sgn - ca * bend); col.push(c.r, c.g, c.b); }
      }
      for (let sI = 0; sI < 4; sI++) { const i = base + sI * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
      if (head) { const b2 = pos.length / 3, tx = ox + sa * bendK, tz = oz - ca * bendK, ty = H - bendK * 0.35; // grain panicle
        for (let k = 0; k < 3; k++) { const pp = k / 2; for (const sgn of [-1, 1]) { pos.push(tx + sa * pp * 0.12 + ca * 0.018 * sgn, ty - pp * pp * 0.1 - 0.02 + pp * 0.0, tz - ca * pp * 0.12 + sa * 0.018 * sgn); col.push(ch.r * (1 - pp * 0.3), ch.g * (1 - pp * 0.3), ch.b * (1 - pp * 0.3)); } }
        for (let k = 0; k < 2; k++) { const i = b2 + k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); } }
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); rg.setIndex(idx); rg.computeVertexNormals();
    const U = this.riceU;
    const rm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
    rm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime; sh.uniforms.uGust = U.uGust;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uGust;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float ph = modelMatrix[3].x*0.31 + modelMatrix[3].z*0.23;
          #ifdef USE_INSTANCING
          ph += instanceMatrix[3].x*0.35 + instanceMatrix[3].z*0.27;
          #endif
          float amp = position.y*position.y*(0.12 + uGust*0.45);
          transformed.x += sin(uTime*1.6+ph)*amp + sin(uTime*3.1+ph*1.7)*amp*0.3;
          transformed.z += cos(uTime*1.3+ph*1.2)*amp*0.7;`);
    };
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tint = new THREE.Color();
    for (let i = 0; i < EDGES.length - 1; i++) for (let j = 0; j < EDGES.length - 1; j++) {
      if (i === 4 && j === 4) continue; // dry yard
      const x0 = EDGES[i] + 0.9, x1 = EDGES[i + 1] - 0.9, z0 = EDGES[j] + 0.9, z1 = EDGES[j + 1] - 0.9, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, h = z1 - z0;
      const wg = new THREE.PlaneGeometry(w + 1.8, h + 1.8); wg.rotateX(-Math.PI / 2);
      const uv = wg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * (w / 5), uv.getY(k) * (h / 5));
      const wm = new THREE.Mesh(wg, this.waterMat); wm.position.set(cx, WATER_Y, cz); wm.receiveShadow = true; s.add(wm); this.waterCells.push({ m: wm, cx, cz });
      const nx = Math.floor(w / sp), nz = Math.floor(h / sp), im = new THREE.InstancedMesh(rg, rm, nx * nz); let n = 0;
      for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
        ps.set(-w / 2 + (a + 0.5) * sp + rand(-0.35, 0.35) * sp, 0, -h / 2 + (b + 0.5) * sp + rand(-0.35, 0.35) * sp);
        qt.setFromAxisAngle(up, rand(0, 6.28)); const k = rand(0.75, 1.3); sc.set(k, rand(0.7, 1.35), k);
        tint.setHSL(rand(0.22, 0.28), rand(0.5, 0.8), rand(0.6, 0.85)); im.setColorAt(n, tint); im.setMatrixAt(n++, m4.compose(ps, qt, sc));
      }
      im.position.set(cx, MUD_Y - 0.05, cz); im.frustumCulled = false; s.add(im); this.riceCells.push({ m: im, cx, cz });
    }
  }

  canals() {
    const s = this.scene; this.canalTex = waterNormalTexture(); this.canalTex.repeat.set(30, 1);
    const cm = new THREE.MeshStandardMaterial({ color: 0x0a1618, roughness: 0.05, metalness: 0.6, normalMap: this.canalTex, normalScale: new THREE.Vector2(0.5, 0.5), envMap: this.waterMat.envMap, envMapIntensity: 1.6 });
    const bank = new THREE.MeshStandardMaterial({ map: mudTexture('#2c2415', true, 20, 1), roughness: 1 });
    const mk = (cx, cz, w, h) => {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cm); pl.rotation.x = -Math.PI / 2; pl.position.set(cx, 0.14, cz); s.add(pl);
      for (const sg of [-1, 1]) { const bb = w > h ? new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 0.5), bank) : new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, h), bank);
        bb.position.set(w > h ? cx : cx + sg * 2.1, 0.05, w > h ? cz + sg * 2.1 : cz); bb.receiveShadow = true; s.add(bb); }
    };
    mk(0, -80, 180, 3.6); mk(80, 0, 3.6, 180);
    this.boxes.push({ x0: -95, x1: 95, z0: -81.8, z1: -78.2, noGhost: true }, { x0: 78.2, x1: 81.8, z0: -95, z1: 95, noGhost: true });
    this.boxes.push({ x0: -HALF - 3, x1: HALF + 3, z0: HALF, z1: HALF + 3 });
  }

  // ---------- trees / bushes ----------
  vegetation() {
    const q = this.q, sc = q === 'low' ? 0.6 : 1;
    const palm = (lean, H, seed) => {
      const parts = [], pts = [V3(0, 0, 0), V3(lean * 0.3, H * 0.4, 0), V3(lean * 0.75, H * 0.75, lean * 0.1), V3(lean, H, 0)];
      parts.push(colored(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.17, 6), 0x5a4a37));
      const fg = new THREE.PlaneGeometry(0.8, 3.4, 1, 8), p = fg.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 1.7) / 3.4; p.setXYZ(i, p.getX(i) * (1 - t * 0.85), -t * t * 1.4 + t * 0.4, t * 3.4); }
      fg.computeVertexNormals();
      for (let k = 0; k < 9; k++) { const m = new THREE.Matrix4().makeTranslation(lean, H, 0).multiply(new THREE.Matrix4().makeRotationY(k / 9 * 6.283 + seed)).multiply(new THREE.Matrix4().makeRotationX(-0.25 + (k % 2) * 0.3)); parts.push(colored(fg, k % 2 ? 0x2c4d1d : 0x25421a, m)); }
      for (let k = 0; k < 3; k++) { const m = new THREE.Matrix4().makeTranslation(lean + Math.sin(k * 2.1) * 0.25, H - 0.25, Math.cos(k * 2.1) * 0.25); parts.push(colored(new THREE.SphereGeometry(0.14, 6, 5), 0x4a5a22, m)); }
      return mergeGeometries(parts);
    };
    const banana = () => {
      const parts = [colored(new THREE.CylinderGeometry(0.1, 0.14, 2.3, 7).translate(0, 1.15, 0), 0x5f7a3a)];
      const lg = new THREE.PlaneGeometry(1.0, 2.8, 1, 6), p = lg.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 1.4) / 2.8; p.setXYZ(i, p.getX(i) * (1 - 0.3 * t), -Math.pow(t, 1.8) * 1.3 + t * 0.5, t * 2.6); }
      lg.computeVertexNormals();
      for (let k = 0; k < 7; k++) parts.push(colored(lg, 0x35652a, new THREE.Matrix4().makeTranslation(0, 2.2, 0).multiply(new THREE.Matrix4().makeRotationY(k * 0.9)).multiply(new THREE.Matrix4().makeRotationX(-0.3))));
      return mergeGeometries(parts);
    };
    const bush = colored(new THREE.IcosahedronGeometry(0.75, 1).scale(1.3, 0.8, 1.3).translate(0, 0.5, 0), 0x1b2f17);
    const oldTree = mergeGeometries([colored(new THREE.CylinderGeometry(0.3, 0.5, 3.6, 7).translate(0, 1.8, 0), 0x3b2d20),
      ...[[0, 4.6, 0, 2.2], [1.4, 4.1, 0.5, 1.6], [-1.3, 4.3, -0.6, 1.7], [0.2, 5.5, 0.9, 1.4]].map(([x, y, z, r]) => colored(new THREE.IcosahedronGeometry(r, 1).translate(x, y, z), 0x1d3318))]);
    const lists = { palm0: [], palm1: [], palm2: [], banana: [], bush: [], old: [] };
    const geos = { palm0: palm(0.8, 6.5, 0), palm1: palm(-1.3, 8, 1), palm2: palm(0.4, 7.2, 2), banana: banana(), bush, old: oldTree };
    this.treeSlots = []; this.treeIM = {};
    const add = (kind, x, z, col = true) => { const tr = { x, z, s: rand(0.9, 1.25), r: rand(0, 6.28) }; if (kind !== 'bush') this.treeSlots.push({ kind, grp: kind.startsWith('palm') ? 'palm' : kind, idx: lists[kind].length, v: Math.random() < 0.5 ? 0 : 1, ...tr, on: false }); lists[kind].push(tr); if (col && kind !== 'bush') { const c = { x, z, r: kind === 'old' ? 0.6 : 0.38 }; this.circles.push(c); this.trees.push(c); } };
    const offLimit = (x, z) => this.inHouseXZ(x, z, 2.5) || (Math.abs(x) < 1.8 && z > 0 && z < 10) || this.inCanal(x, z) || Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 3 || dikeDist(x) < 1.1 || dikeDist(z) < 1.1;
    // yard
    for (let i = 0, n = 0; i < 80 && n < 11; i++) { const x = rand(-9, 9), z = rand(-9, 9); if (this.inHouseXZ(x, z, 2.5) || (Math.abs(x) < 1.8 && z > 0) || Math.abs(x) > 8.6) continue; add(pick(['palm0', 'palm1', 'palm2', 'banana', 'banana', 'old']), x, z); n++; }
    // fields (next to dikes)
    const nF = Math.floor(70 * sc);
    for (let i = 0, n = 0; i < 400 && n < nF; i++) {
      const d = pick(DIKES), t = rand(-80, 80), o = pick([-1, 1]) * rand(1.6, 3.4), ax = Math.random() < 0.5, x = ax ? d + o : t, z = ax ? t : d + o;
      if (offLimit(x, z) || this.inYard(x, z)) continue;
      add(pick(['palm0', 'palm1', 'palm2', 'banana', 'banana', 'bush', 'bush', 'old']), x, z); n++;
    }
    // border tree wall
    for (let a = -HALF - 6; a <= HALF + 6; a += q === 'low' ? 9 : 6) for (const [x, z] of [[a, HALF + rand(1, 5)], [a, -HALF - rand(1, 5)], [HALF + rand(1, 5), a], [-HALF - rand(1, 5), a]])
      add(pick(['palm0', 'palm1', 'palm2', 'old', 'bush', 'banana']), x, z, false);
    const aoG = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), aoT = glowTexture('rgba(0,0,0,1)', 64), aoMat = new THREE.MeshBasicMaterial({ map: aoT, transparent: true, opacity: 0.55, depthWrite: false, color: 0x000000, fog: true });
    const aoIm = new THREE.InstancedMesh(aoG, aoMat, 420); let aoN = 0; const am = new THREE.Matrix4();
    for (const k in lists) for (const t of lists[k]) if (aoN < 420 && k !== 'bush') { const sz = k === 'old' ? 5 : k === 'banana' ? 3 : 2.6; am.makeScale(sz, 1, sz).setPosition(t.x, this.groundY(t.x, t.z) + 0.02, t.z); aoIm.setMatrixAt(aoN++, am); }
    am.makeScale(11, 1, 9).setPosition(0, 0.33, 0); aoIm.setMatrixAt(aoN++, am); aoIm.count = aoN; aoIm.frustumCulled = false; this.scene.add(aoIm);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 }), _w = this.windify(mat, 0.13, 7.5), m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), up = V3(0, 1, 0);
    for (const k in lists) {
      if (!lists[k].length) continue; const im = new THREE.InstancedMesh(geos[k], mat, lists[k].length);
      lists[k].forEach((t, i) => { qt.setFromAxisAngle(up, t.r); m4.compose(V3(t.x, this.groundY(t.x, t.z), t.z), qt, V3(t.s, t.s, t.s)); im.setMatrixAt(i, m4); });
      im.frustumCulled = false; im.castShadow = q !== 'low'; this.scene.add(im); this.treeIM[k] = im;
    }
    this.loadTreeModels(); // your real banana / mango models take over near the player (loads in the background; the generated trees stay if it fails)
  }

  // gentle wind sway done on the GPU (no extra draw calls): the higher and farther from the trunk a point is, the more it moves; gusts (riceU.uGust) make it stronger
  windify(mat, amp, H) {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.riceU.uTime; sh.uniforms.uGust = this.riceU.uGust; sh.uniforms.uAmp = { value: amp }; sh.uniforms.uH = { value: H };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uGust; uniform float uAmp; uniform float uH;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float hh = clamp(position.y / uH, 0.0, 1.0); float rr = clamp(length(position.xz) / (uH * 0.45), 0.0, 1.0);
          float w = hh * hh * (0.35 + 0.65 * rr);
          #ifdef USE_INSTANCING
            float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.53;
          #else
            float ph = 0.0;
          #endif
          float k = uAmp * w * (1.0 + uGust * 1.8);
          transformed.x += (sin(uTime * 1.25 + ph + position.y * 1.7) + 0.35 * sin(uTime * 3.1 + ph * 1.7 + position.x * 9.0 / uH)) * k;
          transformed.z += (cos(uTime * 1.05 + ph * 1.3 + position.y * 1.3) + 0.35 * sin(uTime * 2.7 + ph + position.z * 9.0 / uH)) * k * 0.75; }`);
    };
    mat.customProgramCacheKey = () => 'wind' + amp.toFixed(3) + '_' + H.toFixed(2); mat.needsUpdate = true;
  }
  // ---------- real tree models (banana_a/b, mango_a/b): used only for the trees close to the player, the generated ones stay far away ----------
  async loadTreeModels() {
    if (!this.treeSlots.length || this.treeLod) return;
    const q = this.q, loader = new GLTFLoader(), cap = q === 'low' ? 5 : 10, R = q === 'low' ? 28 : 42;
    const defs = [['banana', 'assets/banana_a.glb?v=1', 5.4], ['banana', 'assets/banana_b.glb?v=1', 5.4], ['old', 'assets/mango_a.glb?v=1', 7.4], ['old', 'assets/mango_b.glb?v=1', 7.0], ['palm', 'assets/palm_a.glb?v=1', 7.8], ['palm', 'assets/palm_b.glb?v=1', 7.2]];
    try {
      const vs = [], cnt = { banana: 0, old: 0, palm: 0 };
      for (const [kind, url, H] of defs) {
        const g = await loader.loadAsync(url); let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; }); if (!mesh) throw new Error('no mesh in ' + url);
        const mat = mesh.material; mat.side = THREE.DoubleSide; mat.roughness = 0.95; mat.metalness = 0; this.windify(mat, ({ banana: 0.2, old: 0.09, palm: 0.22 }[kind]) / (H / 0.98), 0.98); // sway amplitude is given in metres, converted to model units
        if (IS_TOUCH && mat.map && mat.map.image && mat.map.image.width > 512) { // phones: shrink the 1024 texture to 512
          try { const im = mat.map.image, c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(im, 0, 0, 512, 512); const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = mat.map.colorSpace; t.anisotropy = 1; mat.map = t; mat.needsUpdate = true; } catch (e) {}
        }
        const v = { kind, v: cnt[kind]++, scale: H / 0.98, im: new THREE.InstancedMesh(mesh.geometry, mat, cap), list: [] }; v.im.count = 0; v.im.frustumCulled = false; v.im.castShadow = q !== 'low'; this.scene.add(v.im); vs.push(v);
      }
      this.treeLod = { vs, cap, R2: R * R, t: 0 };
    } catch (e) { console.warn('[trees] real tree models not loaded, keeping generated trees', e); }
  }
  treeLodUpdate(dt, pos) {
    const L = this.treeLod; if (!L) return; L.t -= dt; if (L.t > 0) return; L.t = 0.35;
    const m4 = new THREE.Matrix4(), qt = new THREE.Quaternion(), up = V3(0, 1, 0), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const vr of L.vs) {
      const cand = []; for (const t of this.treeSlots) if (t.grp === vr.kind && t.v === vr.v) { const dx = t.x - pos.x, dz = t.z - pos.z, d2 = dx * dx + dz * dz; if (d2 < L.R2) cand.push([d2, t]); }
      cand.sort((a, b) => a[0] - b[0]); const near = cand.slice(0, L.cap).map((c) => c[1]), set = new Set(near);
      for (const t of this.treeSlots) if (t.grp === vr.kind && t.v === vr.v) {
        const on = set.has(t), proc = this.treeIM[t.kind];
        if (on && !t.on) { proc.setMatrixAt(t.idx, zero); proc.instanceMatrix.needsUpdate = true; }
        else if (!on && t.on) { qt.setFromAxisAngle(up, t.r); m4.compose(V3(t.x, this.groundY(t.x, t.z), t.z), qt, V3(t.s, t.s, t.s)); proc.setMatrixAt(t.idx, m4); proc.instanceMatrix.needsUpdate = true; }
        t.on = on;
      }
      near.forEach((t, i) => { qt.setFromAxisAngle(up, t.r); const k = t.s * vr.scale; m4.compose(V3(t.x, this.groundY(t.x, t.z) - 0.03, t.z), qt, V3(k, k, k)); vr.im.setMatrixAt(i, m4); });
      vr.im.count = near.length; vr.im.instanceMatrix.needsUpdate = true;
    }
  }


  village() {
    const dm = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 1 }), wm = new THREE.MeshBasicMaterial({ color: 0xffc061, fog: false });
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * 6.283 + rand(-0.2, 0.2), r = rand(98, 118), g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 5), dm); b.position.y = 3.5; g.add(b);
      const rf = new THREE.Mesh(new THREE.ConeGeometry(5, 2.2, 4), dm); rf.rotation.y = Math.PI / 4; rf.position.y = 6.1; g.add(rf);
      for (const x of [-2.5, 2.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), dm); p.position.set(x, 1.5, 2); g.add(p); }
      if (Math.random() < 0.8) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), wm); w.position.set(rand(-1.5, 1.5), 3.6, 2.52); g.add(w); }
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); g.lookAt(0, 0, 0); this.scene.add(g);
    }
  }
  fogSprites() {
    const tex = fogTexture(), n = this.q === 'low' ? 18 : 34; this.fogS = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x9fb4d0, transparent: true, opacity: rand(0.07, 0.14), depthWrite: false, fog: false }));
      s.scale.set(rand(14, 24), rand(3, 6), 1); s.position.set(rand(-45, 45), rand(0.4, 1.5), rand(-45, 45)); s.userData.v = V3(rand(-0.4, 0.4), 0, rand(-0.3, 0.3)); this.scene.add(s); this.fogS.push(s);
    }
  }
  fireflies() {
    const n = this.q === 'low' ? 40 : 90; this.ff = { n, ph: new Float32Array(n), base: new Float32Array(n * 3) };
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.ff.ph[i] = rand(0, 9); this.ff.base.set([rand(-30, 30), rand(0.5, 2.5), rand(-30, 30)], i * 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.ffPts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.28, map: glowTexture('rgba(220,255,120,1)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.ffPts.frustumCulled = false; this.scene.add(this.ffPts);
  }

  // ---------- per-frame ----------
  update(dt, player) {
    this.time += dt; const t = this.time, p = player.pos;
    this.treeLodUpdate(dt, p);
    this.riceU.uTime.value = t; this.gustV = Math.max(0, this.gustV - dt); this.riceU.uGust.value += ((this.gustV > 0 ? 1 : 0) - this.riceU.uGust.value) * Math.min(1, dt * 1.5);
    this.waterTex.offset.x += dt * 0.012; this.waterTex.offset.y += dt * 0.007; this.canalTex.offset.x += dt * 0.06;
    for (const c of this.waterCells) c.m.visible = Math.hypot(c.cx - p.x, c.cz - p.z) < 70 + Math.max(10, Math.abs(c.m.geometry.parameters.width) * 0.5);
    for (const c of this.riceCells) c.m.visible = Math.hypot(c.cx - p.x, c.cz - p.z) < (this.q === 'low' ? 46 : 58);
    if (this.lamp) this.lamp.intensity = 12 * (0.9 + 0.06 * Math.sin(t * 11) + 0.04 * Math.sin(t * 27.3));
    this.door.update(dt); this.door.col.active = !this.door.open;
    this.moon.position.set(p.x + this.moonDir.x * 100, this.moonDir.y * 100, p.z + this.moonDir.z * 100); this.moon.target.position.set(p.x, 0, p.z);
    for (const s of this.fogS) { s.position.addScaledVector(s.userData.v, dt); const dx = s.position.x - p.x, dz = s.position.z - p.z; if (Math.hypot(dx, dz) > 50) s.position.set(p.x - dx * 0.9, s.position.y, p.z - dz * 0.9); }
    const ff = this.ff, pa = this.ffPts.geometry.attributes.position, ca = this.ffPts.geometry.attributes.color;
    for (let i = 0; i < ff.n; i++) {
      const ph = ff.ph[i] + t * 0.5, wr = (v) => (((v + 30) % 60) + 60) % 60 - 30;
      const wx = p.x + wr(ff.base[i * 3] - p.x), wz = p.z + wr(ff.base[i * 3 + 2] - p.z);
      pa.setXYZ(i, wx + Math.sin(ph * 1.3) * 1.2, ff.base[i * 3 + 1] + Math.sin(ph) * 0.4, wz + Math.cos(ph * 0.9) * 1.2);
      const b = Math.max(0, Math.sin(t * 2.2 + ff.ph[i] * 5)) ** 3; ca.setXYZ(i, b * 0.9, b, b * 0.35);
    }
    pa.needsUpdate = true; ca.needsUpdate = true;
  }
}

// ---------- water ripples + splashes ----------
export class FX {
  constructor(game) {
    this.s = game.scene; this.rings = []; this.drops = []; this.puffs = []; this.sm = null;
    let tex = null; try { // soft, uneven black smoke blob
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      for (let i = 0; i < 9; i++) { const px = 32 + (Math.random() - 0.5) * 22, py = 32 + (Math.random() - 0.5) * 22, r = 14 + Math.random() * 12, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
      tex = new THREE.CanvasTexture(c);
    } catch (e) { tex = null; }
    for (let i = 0; i < (game.low ? 60 : 110); i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x07070a, transparent: true, opacity: 0, depthWrite: false })); sp.visible = false; this.s.add(sp); this.puffs.push({ sp, on: false, t: 0, life: 1, v: V3(), s0: 1, s1: 2, rot: 0, rv: 0 }); }
    const rg = new THREE.RingGeometry(0.82, 1, 28); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xaec4d0, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; this.s.add(m); this.rings.push({ m, t: 0, life: 1, max: 1, on: false }); }
    const dg = new THREE.SphereGeometry(0.03, 5, 4);
    for (let i = 0; i < 36; i++) { const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: 0xd0e2ea, transparent: true, opacity: 0.8 })); m.visible = false; this.s.add(m); this.drops.push({ m, v: V3(), on: false }); }
  }
  ripple(x, z, max = 1.2, life = 1.3) {
    const r = this.rings.find(r => !r.on); if (!r) return; r.on = true; r.t = 0; r.life = life; r.max = max; r.m.visible = true; r.m.position.set(x, WATER_Y + 0.012, z);
  }
  splash(x, z, n = 10, power = 1) {
    this.ripple(x, z, 1.8 * power, 1.4);
    for (let i = 0; i < n; i++) { const d = this.drops.find(d => !d.on); if (!d) break; d.on = true; d.m.visible = true; d.m.position.set(x + rand(-0.1, 0.1), WATER_Y, z + rand(-0.1, 0.1)); d.v.set(rand(-1, 1) * 1.2, rand(2, 3.5) * power, rand(-1, 1) * 1.2); }
  }
  drip(x, y, z) { const d = this.drops.find(d => !d.on); if (!d) return; d.on = true; d.m.visible = true; d.m.position.set(x + rand(-0.15, 0.15), y, z + rand(-0.15, 0.15)); d.v.set(rand(-0.2, 0.2), rand(-0.5, 0.3), rand(-0.2, 0.2)); }
  // black smoke column around a spot (used when the weeping woman turns into the ghost): builds up for `up` seconds, then pours until `dur`
  smokeOn(x, y, z, dur = 3, up = 0.8, h = 1.8) { this.sm = { x, y, z, t: 0, dur, up, h, acc: 0 }; }
  update(dt) {
    const sm = this.sm;
    if (sm) {
      sm.t += dt;
      if (sm.t >= sm.dur) this.sm = null;
      else {
        const ramp = Math.min(1, sm.t / sm.up), fade = Math.min(1, (sm.dur - sm.t) / 0.9); sm.acc += dt * 85 * ramp * Math.max(0.15, fade);
        while (sm.acc >= 1) {
          sm.acc -= 1; const p = this.puffs.find(q => !q.on); if (!p) { sm.acc = 0; break; }
          const a = rand(0, 6.283), r = rand(0.05, 0.4);
          p.on = true; p.t = 0; p.life = rand(1.1, 1.9); p.s0 = rand(0.35, 0.6); p.s1 = rand(1.3, 2.0) * (0.6 + 0.4 * ramp); p.rot = rand(0, 6.28); p.rv = rand(-0.8, 0.8); p.peak = 0.55 + 0.35 * ramp;
          p.v.set(Math.cos(a) * rand(0.1, 0.5), rand(0.4, 1.2), Math.sin(a) * rand(0.1, 0.5));
          p.sp.position.set(sm.x + Math.cos(a) * r, sm.y + rand(0, sm.h), sm.z + Math.sin(a) * r); p.sp.visible = true;
        }
      }
    }
    for (const p of this.puffs) if (p.on) {
      p.t += dt; const k = p.t / p.life; if (k >= 1) { p.on = false; p.sp.visible = false; continue; }
      p.sp.position.addScaledVector(p.v, dt); p.v.multiplyScalar(1 - 0.6 * dt); p.v.x += Math.sin(p.t * 3 + p.rot) * dt * 0.5; p.sp.scale.setScalar(p.s0 + (p.s1 - p.s0) * Math.sqrt(k));
      p.rot += p.rv * dt; p.sp.material.rotation = p.rot; p.sp.material.opacity = p.peak * Math.min(1, k / 0.15) * (1 - k) ** 1.3;
    }
    for (const r of this.rings) if (r.on) { r.t += dt; const k = r.t / r.life; if (k >= 1) { r.on = false; r.m.visible = false; continue; } const s = 0.1 + (r.max - 0.1) * (1 - (1 - k) * (1 - k)); r.m.scale.set(s, 1, s); r.m.material.opacity = 0.5 * (1 - k); }
    for (const d of this.drops) if (d.on) { d.v.y -= 9 * dt; d.m.position.addScaledVector(d.v, dt); if (d.m.position.y < WATER_Y) { d.on = false; d.m.visible = false; } }
  }
}

// ---------- small frogs hopping along the dikes (pooled) ----------
export class Frogs {
  constructor(game) {
    this.g = game; this.list = [];
    const geo = new THREE.SphereGeometry(0.5, 8, 6), mat = new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 0.6, emissive: 0x0d1205 }), eyeM = new THREE.MeshBasicMaterial({ color: 0xc8c070 });
    const n = game.low ? 4 : 8;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Group(), b = new THREE.Mesh(geo, mat); b.scale.set(0.1, 0.07, 0.14); m.add(b);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(geo, eyeM); e.scale.setScalar(0.03); e.position.set(s * 0.035, 0.05, 0.07); m.add(e); const l = new THREE.Mesh(geo, mat); l.scale.set(0.03, 0.03, 0.1); l.position.set(s * 0.07, -0.02, -0.07); m.add(l); }
      m.visible = false; game.scene.add(m); this.list.push({ m, x: 0, z: 0, y: 0, state: 'gone', t: rand(0, 3), x0: 0, z0: 0, x1: 0, z1: 0, dur: 0.45, ribT: rand(3, 9), water: false });
    }
  }
  spawn(f) {
    const env = this.g.env, p = this.g.player.pos;
    for (let i = 0; i < 12; i++) {
      const a = rand(0, 6.28), r = rand(4, 22), q = env.snapToDike(p.x + Math.sin(a) * r, p.z + Math.cos(a) * r);
      if (Math.abs(q.x) < HALF - 3 && Math.abs(q.z) < HALF - 3 && !env.inHouseXZ(q.x, q.z, 1) && !env.inCanal(q.x, q.z) && !env.blocked(q.x, q.z, 0.2)) { f.x = q.x; f.z = q.z; f.y = env.groundY(q.x, q.z); f.state = 'idle'; f.t = rand(1, 4); f.m.visible = true; f.m.position.set(f.x, f.y, f.z); return; }
    }
    f.t = 2;
  }
  hop(f, x1, z1, water) { f.x0 = f.x; f.z0 = f.z; f.x1 = x1; f.z1 = z1; f.dur = water ? 0.55 : 0.4; f.t = 0; f.state = 'hop'; f.water = water; f.m.rotation.y = Math.atan2(x1 - f.x, z1 - f.z); }
  update(dt) {
    const g = this.g, p = g.player.pos, env = g.env;
    for (const f of this.list) {
      if (f.state === 'gone') { f.t -= dt; if (f.t <= 0) this.spawn(f); continue; }
      const d = Math.hypot(f.x - p.x, f.z - p.z);
      if (f.state === 'idle') {
        f.t -= dt; f.ribT -= dt;
        if (f.ribT <= 0) { f.ribT = rand(5, 14); if (d < 40) g.audio.ribbit({ x: f.x, y: f.y + 0.1, z: f.z }); }
        if (d > 40) { f.state = 'gone'; f.t = 0.5; f.m.visible = false; continue; }
        if (d < 2.4) { const dx = f.x - p.x, dz = f.z - p.z, l = Math.hypot(dx, dz) || 1, wx = f.x + (-dz / l) * 1.6 + dx / l * 0.4, wz = f.z + (dx / l) * 1.6 + dz / l * 0.4; this.hop(f, wx, wz, true); }
        else if (f.t <= 0) { const a = rand(0, 6.28), r = rand(0.5, 1.1), nx = f.x + Math.sin(a) * r, nz = f.z + Math.cos(a) * r; if (env.isDry(nx, nz) && !env.blocked(nx, nz, 0.1)) this.hop(f, nx, nz, false); f.t = rand(1.5, 6); }
      } else if (f.state === 'hop') {
        f.t += dt; const k = Math.min(1, f.t / f.dur); f.x = lerp(f.x0, f.x1, k); f.z = lerp(f.z0, f.z1, k);
        f.m.position.set(f.x, (f.water ? f.y : f.y) + Math.sin(k * Math.PI) * (f.water ? 0.4 : 0.22), f.z); f.m.rotation.x = -Math.cos(k * Math.PI) * 0.5;
        if (k >= 1) { f.m.rotation.x = 0; if (f.water) { g.fx.splash(f.x, f.z, 5, 0.4); g.audio.splash({ x: f.x, y: 0.1, z: f.z }, 0.35); f.state = 'gone'; f.t = rand(4, 8); f.m.visible = false; } else { f.y = env.groundY(f.x, f.z); f.state = 'idle'; f.m.position.y = f.y; g.audio.hop({ x: f.x, y: f.y, z: f.z }); } }
      }
    }
  }
  reset() { for (const f of this.list) { f.state = 'gone'; f.t = rand(0, 2); f.m.visible = false; } }
}
