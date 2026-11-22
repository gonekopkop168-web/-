// ghost.js – the pregnant female ghost: procedural model + unpredictable AI
import { GhostRig } from './ghostrig.js';
import { THREE, IS_TOUCH, V3, rand, clamp, lerp, pick, wchoice, clothTexture, HALF } from './core.js';

export function buildGhostMesh() {
  const g = new THREE.Group(), U = {};
  const skin = new THREE.MeshStandardMaterial({ color: 0xb8b7b0, roughness: 0.85, emissive: 0x1c1c1e });
  const dress = new THREE.MeshStandardMaterial({ map: clothTexture(), roughness: 0.95, side: THREE.DoubleSide, emissive: 0x2a2820 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x040404, roughness: 1, side: THREE.DoubleSide });
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const eyeM = new THREE.MeshBasicMaterial({ color: 0xaa0a0a });
  const M = (geo, mat, x = 0, y = 0, z = 0, p = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); p.add(m); return m; };
  U.body = new THREE.Group(); g.add(U.body);
  // legs + bare feet
  for (const s of [-1, 1]) { M(new THREE.CylinderGeometry(0.045, 0.04, 0.4, 6), skin, s * 0.1, 0.22, 0, U.body); M(new THREE.BoxGeometry(0.09, 0.04, 0.22), skin, s * 0.1, 0.02, 0.05, U.body); }
  // dress (lathe) + big belly
  const prof = [[0.42, 0.3], [0.38, 0.5], [0.3, 0.8], [0.24, 1.0], [0.23, 1.2], [0.19, 1.35], [0.07, 1.42]].map(([r, y]) => new THREE.Vector2(r, y));
  const d = M(new THREE.LatheGeometry(prof, 14), dress, 0, 0, 0, U.body); d.scale.set(1, 1, 0.9);
  const belly = M(new THREE.SphereGeometry(0.27, 14, 12), dress, 0, 0.92, 0.2, U.body); belly.scale.set(1, 1, 1.05);
  M(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), skin, 0, 1.44, 0, U.body);
  // head
  U.head = new THREE.Group(); U.head.position.set(0, 1.5, 0); U.body.add(U.head);
  M(new THREE.SphereGeometry(0.115, 14, 12), skin, 0, 0.1, 0, U.head).scale.set(0.9, 1.15, 1);
  for (const s of [-1, 1]) { M(new THREE.SphereGeometry(0.04, 8, 6), black, s * 0.04, 0.12, 0.088, U.head).scale.set(1, 1.35, 0.8); M(new THREE.SphereGeometry(0.009, 6, 5), eyeM, s * 0.04, 0.12, 0.122, U.head); }
  for (let i = 0; i < 7; i++) M(new THREE.BoxGeometry(0.008, 0.016, 0.006), new THREE.MeshBasicMaterial({ color: 0xcfc8a8 }), -0.03 + i * 0.01, 0.012 - (i % 2) * 0.004, 0.112, U.head);
  U.mouth = M(new THREE.SphereGeometry(0.03, 8, 6), black, 0, 0.0, 0.105, U.head); U.mouth.scale.set(1, 1.4, 0.4);
  const cap = new THREE.SphereGeometry(0.125, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62); M(cap, hairM, 0, 0.11, -0.012, U.head).scale.set(1, 1.17, 1.08);
  const back = new THREE.PlaneGeometry(0.34, 1.0, 1, 5); back.translate(0, -0.5, 0); M(back, hairM, 0, 0.12, -0.13, U.head).rotation.x = 0.06;
  for (const s of [-1, 1]) { const sd = new THREE.PlaneGeometry(0.13, 0.8, 1, 3); sd.translate(0, -0.4, 0); const m = M(sd, hairM, s * 0.11, 0.14, 0.02, U.head); m.rotation.y = s * 1.4; }
  for (let i = 0; i < 30; i++) { const L = rand(0.25, 0.7), st = M(new THREE.BoxGeometry(0.009, L, 0.006), hairM, rand(-0.1, 0.095), 0.2 - L / 2 + 0.02, 0.112 + rand(0, 0.015), U.head); st.rotation.z = rand(-0.12, 0.12); }
  // torn, dirty hem strips
  for (let i = 0; i < 12; i++) { const L = rand(0.18, 0.42), st = new THREE.PlaneGeometry(0.1, L); st.translate(0, -L / 2, 0); const m = M(st, dress, Math.sin(i * 0.52) * 0.4, 0.34, Math.cos(i * 0.52) * 0.4, U.body); m.rotation.y = i * 0.52 + 0.1; m.rotation.x = 0.1; }
  // arms
  const arm = (s) => {
    const sh = new THREE.Group(); sh.position.set(s * 0.21, 1.36, 0); sh.scale.set(1, 1.22, 1); U.body.add(sh);
    M(new THREE.CylinderGeometry(0.035, 0.03, 0.34, 6).translate(0, -0.17, 0), skin, 0, 0, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.34; sh.add(el);
    M(new THREE.CylinderGeometry(0.03, 0.025, 0.34, 6).translate(0, -0.17, 0), skin, 0, 0, 0, el);
    M(new THREE.BoxGeometry(0.06, 0.09, 0.025), skin, 0, -0.39, 0, el);
    for (let f = 0; f < 4; f++) M(new THREE.CylinderGeometry(0.006, 0.004, 0.13, 4).translate(0, -0.065, 0), skin, -0.022 + f * 0.015, -0.43, 0, el);
    return { sh, el };
  };
  U.armL = arm(-1); U.armR = arm(1);
  U.body.scale.set(1.08, 1.13, 1.08); g.userData = U; return g;
}

const GIRL_URL = 'assets/girl.glb?v=1', GLB_URL = 'assets/ghost.glb?v=3', GLB_TEX = IS_TOUCH ? 512 : 1024;
GhostRig.preload(GLB_URL, 1.9, GLB_TEX).catch((e) => console.warn('[ghost] preload failed, will retry', e)); GhostRig.preload(GIRL_URL, 1.62, GLB_TEX, false).catch(() => {}); // start downloading while the menu is open
export class GhostAI {
  constructor(game) {
    this.g = game; this.mesh = new THREE.Group(); this.proc = buildGhostMesh(); this.mesh.add(this.proc); this.mesh.visible = false; game.scene.add(this.mesh);
    this.U = this.proc.userData; this.rig = null; this.rigFail = false; this.light = new THREE.PointLight(0x9fb4ff, 0, 9, 2); this.light.position.y = 1.3; this.mesh.add(this.light);
    this._f = V3(); this._v = V3(); this.pos = V3(); this.reset();
  }
  loadRig() { // called by the game AFTER the world is built, so a heavy model can never block the loading screen
    if (this.rig && this.girl) return Promise.resolve(); if (this.loadP) return this.loadP; const game = this.g;
    const gp = GhostRig.preload(GIRL_URL, 1.62, GLB_TEX, false).then((r) => { this.girl = r; this.mesh.add(r.root); r.root.visible = false; console.log('[ghost] weeping-woman model loaded'); }).catch((e) => console.warn('[ghost] girl.glb failed (weeper event disabled)', e));
    const rp = GhostRig.preload(GLB_URL, 1.9, GLB_TEX).then((r) => { this.rig = r; this.mesh.add(r.root); this.proc.visible = false; console.log('[ghost] 3D rigged model loaded'); game.ui.toast('👻 3D ghost model loaded', 2500); })
      .catch((e) => { this.loadP = null; this.tries = (this.tries || 0) + 1; if (this.tries < 3) setTimeout(() => this.loadRig(), 4000); console.error('[ghost] ghost.glb FAILED to load – using old procedural ghost:', e); game.ui.toast('⚠ ghost.glb មិនផ្ទុក: ' + (e && e.message ? e.message : e), 9000); });
    return this.loadP = Promise.all([rp, gp]).then(() => {});
  }
  // ---- the weeping woman: she sits crying on a dike; when you come close she asks to be spoken to, stands, wipes her tears, then turns into the ghost and hunts you ----
  setForm(f) { if (this.rig) this.rig.root.visible = f === 'ghost'; if (this.girl) this.girl.root.visible = f === 'girl'; this.proc.visible = f === 'ghost' && !this.rig; }
  startWeeper() {
    const g = this.g, p = g.player.pos; if (!this.girl) { this.eventTimer = 6; return false; }
    const s = this.findSpot(16, 26, 'path'); if (!s || !g.env.isDry(s.x, s.z)) { this.eventTimer = 5; return false; }
    this.put(s.x, s.z); this.setForm('girl'); this.state = 'weeper'; this.age = 0; this.sobT = 0.4; this.wAct = 'sitcry'; this.wFade = 0.2; this.wRig = 'girl'; this.wBob = 0; this.wScale = 1; this.wLight = 0.7; this.sink = 0; this.mesh.visible = true; this.mesh.scale.set(1, 1, 1);
    this.yaw = Math.atan2(p.x - this.pos.x, p.z - this.pos.z) + 2.2; this.light.intensity = 0.7; return true;
  }
  weepAnimate(dt) {
    const m = this.mesh; m.position.set(this.pos.x, this.pos.y + (this.wBob || 0), this.pos.z); m.rotation.y = this.yaw; m.scale.setScalar(this.wScale || 1);
    const r = this.wRig === 'ghost' ? this.rig : this.girl; if (r) { try { r.play(this.wAct, this.wFade); r.update(dt); } catch (e) { console.warn('weep rig error', e); } }
    this.light.intensity = this.wLight == null ? 0.25 : this.wLight;
  }
  reset() {
    if (this.g.audio) this.g.audio.weepStop(0.1); this.state = 'dormant'; this.mesh.visible = false; this.mesh.position.set(0, -50, 0); this.mesh.scale.set(1, 1, 1); this.hunting = false; this.light.intensity = 0; this.wounded = false; this.stagger = 0;
    this.eventTimer = rand(30, 45); this.huntCooldown = 0; this.outside = 0; this.seenFirst = false; this.huntTime = 0; this.rushTime = 0; this.siege = 0; this.age = 0; this.lookT = 0;
    this.sink = 0; this.sub = 'stare'; this.awayT = 0; this.pendingT = 0; this.pendingFn = null; this.hideT = 0; this.hideCool = 8; this.vanishT = 0; this.then = null; this.jerkT = 1; this.frozen = 0; this.farT = 0; this.knockT = 0; this.stuckT = 0; this.stagger = 0; this.escapeT = 0; this.wounded = false;
    this.yaw = 0; this.anim = 0; this.poseT = 0; this.headT = V3(); this.surprise = false; this.maxAge = 12; this.vanishOnLook = true; this.threat = 0; this.firstHunt = false; this.firstWeeper = false;
  }
  get dist() { const p = this.g.player.pos; return Math.hypot(this.pos.x - p.x, this.pos.z - p.z); }

  // ---- helpers ----
  looking(maxD) {
    const cam = this.g.camera; cam.getWorldDirection(this._f);
    this._v.set(this.pos.x - cam.position.x, this.pos.y + 1.2 - cam.position.y, this.pos.z - cam.position.z); const d = this._v.length();
    return d < maxD && this._f.dot(this._v.divideScalar(d)) > 0.86;
  }
  findSpot(minD, maxD, mode = 'front') {
    const env = this.g.env, p = this.g.player.pos; this.g.camera.getWorldDirection(this._f);
    const base = Math.atan2(this._f.x, this._f.z);
    for (let i = 0; i < 16; i++) {
      const a = mode === 'front' || mode === 'path' ? base + rand(-0.9, 0.9) : mode === 'back' ? base + Math.PI + rand(-0.8, 0.8) : rand(0, 6.283), d = rand(minD, maxD);
      let x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      if (mode === 'path') { const s = env.snapToDike(x, z); x = s.x; z = s.z; }
      if (Math.abs(x) > HALF - 2 || Math.abs(z) > HALF - 2 || env.inHouseXZ(x, z, 2) || env.inCanal(x, z) || env.blocked(x, z, 0.4)) continue;
      return V3(x, 0, z);
    }
    return null;
  }
  put(x, z) { this.pos.set(x, this.g.env.groundY(x, z), z); this.mesh.position.copy(this.pos); }
  faceTo(t, dt, rate = 4) { const a = Math.atan2(t.x - this.pos.x, t.z - this.pos.z); let d = a - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += clamp(d, -rate * dt, rate * dt); }
  show(on) { this.mesh.visible = on; this.light.intensity = on ? 0.5 : 0; }
  move(target, sp, dt) {
    const env = this.g.env, dx = target.x - this.pos.x, dz = target.z - this.pos.z, l = Math.hypot(dx, dz); if (l < 0.01) return;
    this.curSp = sp; const st = Math.min(l, sp * dt) * (env.isDry(this.pos.x, this.pos.z) ? 1 : 0.88), nx = this.pos.x + dx / l * st, nz = this.pos.z + dz / l * st, ox = this.pos.x, oz = this.pos.z;
    if (!env.blocked(nx, this.pos.z, 0.3, true)) this.pos.x = nx; if (!env.blocked(this.pos.x, nz, 0.3, true)) this.pos.z = nz;
    this.stuckT = Math.hypot(this.pos.x - ox, this.pos.z - oz) < st * 0.2 ? this.stuckT + dt : 0;
    this.pos.y += (env.groundY(this.pos.x, this.pos.z) - this.pos.y) * Math.min(1, dt * 8);
    this.faceTo(target, dt, 6);
  }
  vanishThen(fn) { this.state = 'vanishing'; this.vanishT = 0.4; this.then = fn; }
  hide() { this.g.audio.weepStop(0.3); this.show(false); this.state = 'dormant'; this.sink = 0; this.wBob = 0; this.wScale = 1; this.mesh.scale.set(1, 1, 1); this.setForm('ghost'); }

  // ---- event scheduling ----
  roll() {
    const g = this.g, pl = g.player, ev = g.events, ten = clamp(this.outside / 240, 0, 1), inside = pl.inHouse, o = this.outside;
    if (!inside && !this.seenFirst && o > 28) { this.seenFirst = true; this.run('distant'); return; }
    if (!inside && !this.firstWeeper && o > 55 && this.girl && this.huntCooldown <= 0 && ev.ready('weeper')) { this.run('weeper'); return; } // guaranteed first meeting with the weeping woman
    if (!inside && !this.firstHunt && o > 130 && this.huntCooldown <= 0) { this.firstHunt = true; this.run('hunt'); return; }
    let items = inside ? [{ k: 'cry', w: 2 }, { k: 'whisper', w: 2 }, { k: 'steps', w: 1 }, { k: 'breath', w: 1.5 }, { k: 'flicker', w: 2 }, { k: 'knock', w: 1 }, { k: 'canal', w: 1 }]
      : [{ k: 'cry', w: 2.5 }, { k: 'whisper', w: 2 }, { k: 'steps', w: 2 }, { k: 'breath', w: 1.5 }, { k: 'rice', w: 2 }, { k: 'flicker', w: 1.5 }, { k: 'canal', w: 1.5 },
        { k: 'shadow', w: 1.6 }, { k: 'fishjump', w: 1.6 }, { k: 'distant', w: 2.4 }, { k: 'path', w: 2 }, { k: 'tree', w: 1.6 }, { k: 'watch', w: 2 }, { k: 'ricehide', w: 1.6 }];
    if (!inside && g.traps.length) items.push({ k: 'trapmove', w: 1.2 });
    if (!inside && o > 40) items.push({ k: 'behind', w: 1.4 });
    if (!inside && o > 70 && this.girl && this.huntCooldown <= 0) items.push({ k: 'weeper', w: 2.6 });
    if (!inside && o > 60) items.push({ k: 'creep', w: 1.3 });
    if (!inside && o > 50 && this.huntCooldown <= 0) items.push({ k: 'hunt', w: 0.8 + ten * 2.5 });
    items = items.filter(i => ev.ready(i.k)); if (!items.length) { this.eventTimer = 6; return; }
    this.eventTimer = rand(12, 30) * (1.25 - 0.5 * ten);
    this.run(wchoice(items));
  }
  run(ev) {
    const g = this.g, au = g.audio, p = g.player.pos, near = (r0, r1) => { const a = rand(0, 6.28), r = rand(r0, r1); return { x: p.x + Math.sin(a) * r, y: 1.2, z: p.z + Math.cos(a) * r }; };
    if (['shadow', 'fishjump', 'trapmove', 'canal'].includes(ev)) { if (g.events.trigger(ev)) g.events.mark(ev); else this.eventTimer = 4; return; }
    g.events.mark(ev);
    switch (ev) {
      case 'cry': au.cry(near(14, 40)); break;
      case 'whisper': au.whisper(near(1.2, 2.6)); break;
      case 'steps': { g.camera.getWorldDirection(this._f); au.stepsBehind(p, { x: -this._f.x, z: -this._f.z }); break; }
      case 'breath': { g.camera.getWorldDirection(this._f); au.breath({ x: p.x - this._f.x * 1.1, y: 1.4, z: p.z - this._f.z * 1.1 }); break; }
      case 'rice': g.env.gust(4); au.noise({ dur: 3, type: 'bandpass', freq: 3000, q: 0.5, vol: 0.05, attack: 1 }); break;
      case 'flicker': g.player.flicker(rand(1, 2.2)); break;
      case 'knock': au.knock({ x: 0, y: 2, z: 3.4 }); break;
      case 'distant': this.appear('front', 32, 48, 'stare'); break;
      case 'path': this.appear('path', 18, 32, 'stare'); break;
      case 'watch': this.appear('front', 20, 36, 'watch'); break;
      case 'ricehide': this.appear('any', 14, 28, 'ricehide'); break;
      case 'creep': this.appear('front', 24, 34, 'creep'); break;
      case 'tree': this.appearTree(); break;
      case 'behind': { // whisper + steps behind you, then she is standing there
        g.camera.getWorldDirection(this._f); au.whisper({ x: p.x - this._f.x * 1.5, y: 1.5, z: p.z - this._f.z * 1.5 });
        this.state = 'pending'; this.pendingT = 1.7; this.pendingFn = () => this.appear('back', 6, 9, 'behind'); break; }
      case 'hunt': this.startHunt(); break;
      case 'weeper': if (this.startWeeper()) this.firstWeeper = true; break;
    }
  }
  appear(mode, a, b, sub = 'stare') {
    const s = this.findSpot(a, b, mode);
    if (!s) { this.eventTimer = 4; return; }
    this.put(s.x, s.z); this.beginStand(sub);
  }
  appearTree() {
    const p = this.g.player.pos; this.g.camera.getWorldDirection(this._f);
    const c = this.g.env.trees.filter(t => { const d = Math.hypot(t.x - p.x, t.z - p.z); return d > 12 && d < 30 && ((t.x - p.x) * this._f.x + (t.z - p.z) * this._f.z) / d > 0.3; });
    if (!c.length) return this.appear('front', 25, 40);
    const t = pick(c), a = Math.atan2(p.x - t.x, p.z - t.z) + 1.5708;
    this.put(t.x + Math.sin(a) * (t.r + 0.3), t.z + Math.cos(a) * (t.r + 0.3)); this.beginStand('stare');
  }
  beginStand(sub = 'stare') {
    this.sub = sub; this.state = 'appear'; this.age = 0; this.lookT = 0; this.awayT = 0; this.maxAge = rand(9, 18); this.vanishOnLook = sub === 'stare' ? Math.random() < 0.7 : sub !== 'watch'; this.surprise = Math.random() < 0.3;
    this.sink = sub === 'ricehide' ? 0.8 : 0; if (sub === 'creep') this.maxAge = 45; if (sub === 'behind') this.maxAge = 7; if (sub === 'watch') this.maxAge = 30;
    if (sub !== 'stare' && this.dist < 32) this.g.audio.sting(0.45);
    this.yaw = Math.atan2(this.g.player.pos.x - this.pos.x, this.g.player.pos.z - this.pos.z); this.show(true);
  }
  startHunt() {
    const s = this.findSpot(24, 34, Math.random() < 0.55 ? 'front' : 'back') || this.findSpot(20, 30, 'any'); if (!s) { this.eventTimer = 5; return; }
    this.put(s.x, s.z); this.show(true); this.hunting = true; this.state = 'follow'; this.huntTime = 0; this.rushTime = 0; this.siege = 0; this.farT = 0; this.sink = 0;
    this.g.audio.cry(this.pos); this.g.player.flicker(1.4); this.g.ui.toast('…she is coming…', 3000, true);
  }
  endHunt() { this.wounded = false; this.stagger = 0; this.hunting = false; this.huntCooldown = rand(55, 95); this.vanishThen(() => { this.hide(); this.eventTimer = rand(25, 50); }); }
  reappear() {
    const s = this.findSpot(11, 17, Math.random() < 0.4 ? 'back' : 'any'); if (s) this.put(s.x, s.z);
    this.show(true); this.state = 'follow'; this.g.audio.whisper(this.pos);
  }

  // ---- update ----
  update(dt) {
    const g = this.g, pl = g.player, p = pl.pos; this.anim += dt;
    if (!pl.inHouse) this.outside += dt;
    if (this.huntCooldown > 0) this.huntCooldown -= dt;
    const d = this.dist, doorClosed = !g.env.door.open;
    switch (this.state) {
      case 'dormant': this.eventTimer -= dt; if (this.eventTimer <= 0) this.roll(); break;
      case 'weeper': {
        this.age += dt; this.sobT -= dt; if (!g.audio.weepLoop) g.audio.weepStart(this.pos); if (!g.audio.weepLoop && this.sobT <= 0) { this.sobT = rand(1.8, 2.6); g.audio.sob(this.pos); }
        if (pl.inHouse || d > 58 || this.age > 90) { this.hide(); this.eventTimer = rand(20, 40); break; }
        if (d < 4.3 && g.state === 'playing') g.startWeep(); break; }
      case 'pending': this.pendingT -= dt; if (this.pendingT <= 0) { const f = this.pendingFn; this.pendingFn = null; this.state = 'dormant'; this.eventTimer = rand(14, 30); f && f(); } break;
      case 'appear': {
        this.age += dt; this.faceTo(p, dt, 2); const seen = this.looking(75), sub = this.sub; this.lookT = seen ? this.lookT + dt : Math.max(0, this.lookT - dt * 0.5);
        const gone = (m) => this.vanishThen(() => { this.hide(); this.eventTimer = rand(14, 34); if (m && Math.random() < 0.4) g.audio.whisper(this.pos); });
        if (sub === 'watch') { // stays while watched; the moment you look away she is gone (sometimes reappearing closer)
          this.awayT = seen ? 0 : this.awayT + dt;
          if (this.lookT > 0.7 && this.awayT > 0.5) { const nd = Math.max(8, d * 0.65), s0 = this.pos.clone(), keep = Math.random() < 0.5;
            return this.vanishThen(() => { this.hide(); this.eventTimer = rand(10, 24); if (keep) { const k = nd / Math.max(d, 1); this.put(p.x + (s0.x - p.x) * k, p.z + (s0.z - p.z) * k); this.pendingT = rand(2, 4); this.pendingFn = () => { this.beginStand('watch'); this.age = 8; }; this.state = 'pending'; } }); }
        } else if (sub === 'creep') { // only moves while you are not looking
          if (!seen) this.move(p, 0.9, dt); else this.faceTo(p, dt, 3);
          if (d < 9) { if (this.huntCooldown <= 0 && Math.random() < 0.5 && !pl.inHouse) { this.hunting = true; this.state = 'rush'; this.rushTime = 0; this.huntTime = 20; this.siege = 0; g.audio.cry(this.pos); pl.flicker(1); } else gone(true); break; }
        } else if (this.vanishOnLook && this.lookT > (sub === 'behind' ? 0.5 : 1.4)) { gone(true); break; }
        if (this.age > this.maxAge) { gone(false); break; }
        if (sub !== 'creep' && d < 11 && !pl.inHouse && sub !== 'behind') {
          if (this.surprise && this.huntCooldown <= 0 && sub !== 'ricehide') { this.hunting = true; this.state = 'rush'; this.rushTime = 0; this.huntTime = 20; this.siege = 0; g.audio.cry(this.pos); pl.flicker(1); }
          else gone(false);
        }
        break;
      }
      case 'vanishing': this.vanishT -= dt; this.mesh.visible = Math.random() < 0.5; if (this.vanishT <= 0) { const f = this.then; this.then = null; this.mesh.visible = true; f && f(); } break;
      case 'follow': case 'rush': case 'hide': this.hunt(dt, d, doorClosed); break;
    }
    // threat + voice
    this.threat = this.hunting && this.mesh.visible ? clamp(1 - (d - 3) / 30, 0, 1) : 0;
    const lvl = this.state === 'follow' || this.state === 'rush' ? 0.4 + 0.6 * this.threat : this.state === 'appear' ? 0.15 : 0;
    g.audio.ghostVoice(this.pos, this.mesh.visible ? lvl : 0, this.anim);
    this.animate(dt);
  }
  hunt(dt, d, doorClosed) {
    const g = this.g, pl = g.player, p = pl.pos; this.huntTime += dt;
    // navigation target (door waypoint when player is inside)
    let target = p;
    const inside = g.env.inHouseXZ(this.pos.x, this.pos.z, 0);
    if (pl.inHouse && !inside) {
      if (doorClosed) { this.siege += dt; if (d < 9) { this.knockT -= dt; if (this.knockT <= 0) { this.knockT = rand(2.2, 4); g.audio.knock({ x: 0, y: 2, z: 3.4 }); } } if (this.siege > 14) return this.endHunt(); }
      else if (this.pos.z > 5.2 || Math.abs(this.pos.x) > 1.4) target = { x: 0, z: 5.8 };
    } else this.siege = Math.max(0, this.siege - dt);
    if (this.state === 'hide') {
      this.sink += ((this.rig ? 0.5 : 0.85) - this.sink) * Math.min(1, dt * 3); this.hideT -= dt; this.faceTo(p, dt, 3);
      if (d < 6 || this.hideT <= 0) { this.state = d < 6 ? 'rush' : 'follow'; this.rushTime = 0; this.hideCool = 10; if (this.state === 'rush') g.audio.cry(this.pos); const f = Math.min(4, Math.max(0, d - 8)) / Math.max(d, 1); this.pos.x += (p.x - this.pos.x) * f; this.pos.z += (p.z - this.pos.z) * f; }
      return;
    }
    this.sink += (0 - this.sink) * Math.min(1, dt * 5); this.hideCool -= dt;
    if (this.stagger > 0) { this.stagger -= dt; this.faceTo(p, dt, 6); return; } // recoiling after a hit
    if (this.wounded) { // player was hit: survive 5 s without being caught and she dissolves
      this.escapeT -= dt;
      if (this.escapeT <= 0) { this.wounded = false; g.ui.toast('ខ្មោចបានរលាយបាត់ · She vanished…', 2600); return this.endHunt(); }
    }
    if (this.state === 'follow') {
      let sp = 1.4 + Math.min(1.2, this.huntTime / 40); const looked = this.looking(60);
      this.jerkT -= dt; if (this.jerkT <= 0) { this.frozen = Math.random() < 0.35 ? rand(0.4, 1.1) : 0; this.jerkT = rand(0.8, 2.2); }
      if (this.frozen > 0) { this.frozen -= dt; sp = 0; } else sp *= looked ? 0.85 : 1.3;
      if (d < 12 || (pl.running && d < 18)) { this.state = 'rush'; this.rushTime = 0; g.audio.cry(this.pos); g.player.flicker(0.8); }
      else if (d > 14 && !looked && this.hideCool <= 0 && Math.random() < dt * 0.07) { this.state = 'hide'; this.hideT = rand(2.5, 5); }
      else if (d > 16 && looked) { this.lookT += dt; if (this.lookT > 3.5) { this.lookT = 0; return this.vanishThen(() => this.reappear()); } } else this.lookT = Math.max(0, this.lookT - dt);
      this.move(target, sp, dt);
      if (d > 46) { this.farT += dt; if (this.farT > 6) return this.endHunt(); } else this.farT = 0;
      if (this.huntTime > 95 && d > 20) return this.endHunt();
    } else { // rush
      this.rushTime += dt; this.move(target, this.wounded ? 4.1 : Math.min(5.5, 4 + this.rushTime * 0.4), dt);
      if (d > 26) { this.state = 'follow'; this.rushTime = 0; }
    }
    if (this.stuckT > 3 && d > 2) { this.stuckT = 0; if (!doorClosed || !pl.inHouse) return this.vanishThen(() => { this.put(0, 6.5); this.show(true); this.state = 'follow'; }); }
    if (d < 0.95 && !(pl.inHouse && doorClosed) && this.mesh.visible) { this.wounded = true; this.escapeT = 5; this.stagger = 1.1; if (this.rig) this.rig.gesture('lunge', 0.6); g.hurtPlayer(this); }
  }
  rigAction() {
    const s = this.state, sp = this.curSp || 0;
    if (s === 'rush') return 'run'; if (s === 'hide') return 'crouch'; if (s === 'caught') return 'jumpscare';
    if (s === 'follow') return this.frozen > 0 ? 'stare' : sp > 2.1 ? 'walk' : 'creep';
    if (s === 'appear' && this.sub === 'creep') return this.looking(75) ? 'stare' : 'creep'; return 'stare';
  }
  animateRig(dt, action) { try { this.rig.play(action); this.rig.update(dt, { speed: this.curSp || 0 }); } catch (e) { console.warn('ghost rig error, falling back', e); this.mesh.remove(this.rig.root); this.rig = null; this.proc.visible = true; } }
  ambPose(dt, action, gesture) { // driven by GameManager.ambushUpdate (the "fake fish" ambush)
    if (this.rig) { if (gesture) this.rig.gesture(gesture, 0.5); this.animateRig(dt, action); return; }
    this.U.head.rotation.x = action === 'laugh' ? -0.7 : 0; this.U.armR.sh.rotation.x = gesture === 'slap' ? -1.6 : this.U.armR.sh.rotation.x;
  }
  scareAnim(dt, t) { // used by the jumpscare camera
    if (this.rig) { this.animateRig(dt, 'jumpscare'); if (this.rig && t > 0.15 && t - dt <= 0.15) this.rig.gesture('headSnap', 0.5); return; }
    this.anim += dt; this.U.head.rotation.z = Math.sin(t * 45) * 0.35; this.U.mouth.scale.y = 5 + Math.sin(t * 30);
  }
  animate(dt) {
    if (this.state === 'weeper' || this.state === 'weepx') return this.weepAnimate(dt);
    const U = this.U, m = this.mesh, t = this.anim, rush = this.state === 'rush', hid = this.state === 'hide';
    m.position.set(this.pos.x, this.pos.y - this.sink, this.pos.z); m.rotation.y = this.yaw; m.scale.y = hid && !this.rig ? 0.8 : m.scale.x;
    if (this.rig) { this.animateRig(dt, this.rigAction()); this.curSp = 0; this.light.intensity = this.mesh.visible ? 0.4 + (rush ? 0.5 : 0) : 0; if (this.rig) return; }
    this.poseT -= dt; if (this.poseT <= 0) { this.poseT = rand(0.08, 0.3); this.headT.set(rand(-0.2, 0.35), rand(-0.45, 0.45), rand(-0.55, 0.55)); }
    const k = Math.min(1, dt * 14);
    U.head.rotation.x += (this.headT.x + (rush ? 0.35 : 0) - U.head.rotation.x) * k; U.head.rotation.y += (this.headT.y - U.head.rotation.y) * k; U.head.rotation.z += (this.headT.z - U.head.rotation.z) * k;
    const moving = this.state === 'follow' && this.frozen <= 0 || rush;
    U.body.rotation.x = lerp(U.body.rotation.x, rush ? 0.3 : 0.05, k * 0.5); U.body.rotation.z = Math.sin(t * 3) * 0.05;
    U.body.position.y = moving ? Math.abs(Math.sin(t * (rush ? 11 : 4))) * 0.05 : 0;
    const sw = moving ? Math.sin(t * (rush ? 11 : 4)) * 0.35 : 0;
    for (const [a, s] of [[U.armL, -1], [U.armR, 1]]) {
      const tx = rush ? -1.4 + Math.sin(t * 16 + s) * 0.15 : sw * s * -1 + 0.05, ex = rush ? -0.3 : -0.15;
      a.sh.rotation.x += (tx - a.sh.rotation.x) * k; a.sh.rotation.z = s * (rush ? 0.12 : 0.05); a.el.rotation.x += (ex - a.el.rotation.x) * k;
    }
    U.mouth.scale.y = rush ? 3 + Math.sin(t * 20) : 1.4;
    this.light.intensity = this.mesh.visible ? 0.4 + (rush ? 0.5 : 0) : 0;
  }
  // used by jumpscare
  jumpscarePose(camPos, fwd) {
    this.hunting = false; this.state = 'caught'; this.mesh.visible = true; this.sink = 0;
    this.pos.set(camPos.x + fwd.x * 0.85, camPos.y - 1.5, camPos.z + fwd.z * 0.85); this.yaw = Math.atan2(-fwd.x, -fwd.z); this.light.intensity = 1.5;
    this.U.mouth.scale.set(2.4, 5, 0.6); this.headT.set(0.1, 0, 0); this.poseT = 99; this.mesh.position.copy(this.pos); this.mesh.rotation.y = this.yaw; this.mesh.scale.set(1.15, 1.15, 1.15);
  }
}
