// player.js – first-person controller, stamina, flashlight, desktop + mobile input
import { makeTrapMesh } from './fishing.js';
import { loadHandModel } from './ghostrig.js';
import { THREE, V3, rand, clamp, lerp, $, IS_TOUCH, settings, FLOOR_Y } from './core.js';

export class PlayerController {
  constructor(game) {
    this.g = game; this.cam = game.camera; this.pos = V3(-1.5, FLOOR_Y, -1.0); this.vy = 0; this.onGround = true; this.r = 0.35; this.eye = 1.62; this.eyeY = FLOOR_Y + this.eye;
    this.keys = {}; this.joy = { x: 0, y: 0 }; this.runHeld = false; this.look = { x: 0, y: 0 };
    this.stamina = 100; this.exhausted = false; this.running = false; this.moving = false; this.inHouse = true; this.phase = 0; this.lastStep = 0; this.breathT = 0; this.vel = V3(); this.t = 0;
    this.battery = 100; this.hasFlashlight = false; this.flashOn = false; this.flickerT = 0; this.carried = 0; this.pulled = 0; this.locked = false;
    // flashlight: spotlight parented to camera + hand model
    this.spot = new THREE.SpotLight(0xfff0d0, 0, 45, 0.45, 0.55, 2); this.spot.position.set(0.1, -0.1, 0); this.spot.target.position.set(0, 0, -5);
    this.cam.add(this.spot, this.spot.target);
    // first-person hands: sleeved arms, flashlight in the right hand, trap in the left hand
    const skin = new THREE.MeshStandardMaterial({ color: 0x9a7a62, roughness: 0.8 }), sleeve = new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 1 });
    const arm = (s) => { const g = new THREE.Group(), sl = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.15), sleeve), fa = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.04, 0.2, 8).rotateX(Math.PI / 2).translate(0, 0, -0.38), skin),
      hd = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.04, 0.1), skin); hd.position.z = -0.52; const pg = new THREE.Group(); pg.add(sl, fa, hd); g.add(pg); g.userData.proc = pg; g.position.set(s * 0.27, -0.34, -0.2); g.rotation.set(0.3, -s * 0.28, 0); return g; };
    this.armR = arm(1); this.armL = arm(-1); this.hands = new THREE.Group(); this.hands.add(this.armR, this.armL); this.cam.add(this.hands);
    // 3D arm models (fallback = the simple procedural arms above). HAND_SCALE shrinks/enlarges both.
    const HAND_SCALE = 0.27, HAND_Z = -0.2, ROLL_L = 0, ROLL_R = 0; // size / distance / roll of the 3D arms (tweak here)
    const HANDS = [['assets/hand_left.glb', this.armL, { base: [-0.119, 0, 0.069], tip: [0.148, 0.79, -0.049], roll: ROLL_L }], ['assets/hand_right.glb', this.armR, { base: [0.089, 0, 0.186], tip: [-0.091, 0.81, -0.176], roll: ROLL_R }]];
    this.handsReady = Promise.all(HANDS.map(([u, a, o]) => loadHandModel(u, IS_TOUCH ? 512 : 1024, o).then((m) => { m.scale.setScalar(HAND_SCALE); m.position.z = HAND_Z; a.add(m); a.userData.model = m; a.userData.proc.visible = false;
      // cloth sleeve that covers the open cut at the wrist-end of the scanned arm and runs back out of view
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.062, 0.7, 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, HAND_Z + 0.33), new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 1, side: THREE.DoubleSide })); sl.frustumCulled = false; a.add(sl); }).catch((e) => console.warn('[hands] model failed', u, e))));
    this.hand = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.6, roughness: 0.4 }));
    b.rotation.x = Math.PI / 2; this.hand.add(b); this.lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), new THREE.MeshBasicMaterial({ color: 0xfff6d0 })); this.lens.position.z = -0.111; this.hand.add(this.lens);
    this.hand.position.set(0, 0, -0.43); this.hand.visible = false; this.armR.add(this.hand);
    this.heldTrap = makeTrapMesh(true); this.heldTrap.scale.setScalar(0.4); this.heldTrap.rotation.set(-0.45, 0, 0); // pole runs through the closed left fist (the fist's grip tube is the arm's local Y axis)
    { const GRIP = new THREE.Vector3(0.011, 0, -0.424), along = new THREE.Vector3(0, 0.3 * 0.4, 0).applyEuler(this.heldTrap.rotation); this.heldTrap.position.copy(GRIP).sub(along); } 
    this.heldTrap.visible = false; this.heldTrap.castShadow = false; this.armL.add(this.heldTrap);
    // flashlight beam cone (cheap volumetric look)
    const cg = new THREE.ConeGeometry(5, 11, 20, 1, true); cg.translate(0, -5.5, 0); cg.rotateX(Math.PI / 2);
    this.beam = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xfff0cc, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide, fog: false }));
    this.beam.position.set(0.12, -0.12, -0.6); this.beam.visible = false; this.cam.add(this.beam); this.act = null; this.lagX = 0; this.lagY = 0;
    this.bindKeys(); if (IS_TOUCH) this.bindTouch();
  }
  reset() {
    this.pos.set(-1.5, FLOOR_Y, -1.0); this.vy = 0; this.onGround = true; this.stamina = 100; this.exhausted = false; this.battery = 100; this.hasFlashlight = false; this.flashOn = false;
    this.carried = 0; this.inHouse = true; this.eyeY = FLOOR_Y + this.eye; this.hand.visible = false; this.beam.visible = false; this.act = null; this.pulled = 0; this.spot.intensity = 0; this.flickerT = 0; this.vel.set(0, 0, 0);
  }
  flicker(s) { this.flickerT = Math.max(this.flickerT, s); }
  toggleFlash() {
    if (!this.hasFlashlight) { this.g.ui.toast('You need to find the flashlight first.', 2200); return; }
    if (this.battery <= 0) { this.g.ui.toast('The battery is dead. Replace it at the table.', 2500); return; }
    this.flashOn = !this.flashOn; this.g.audio.click();
  }

  bindKeys() {
    addEventListener('keydown', (e) => {
      if (e.repeat) return; this.keys[e.code] = true; const g = this.g;
      if (g.state === 'intro' && (e.code === 'Enter' || e.code === 'Space')) g.skipIntro();
      if (g.state !== 'playing') return;
      if (e.code === 'KeyE') g.interact(); else if (e.code === 'KeyF') this.toggleFlash(); else if (e.code === 'KeyP') g.pause();
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('mousedown', (e) => { if (e.button === 0 && this.g.state === 'playing' && this.g.controls.isLocked) this.g.placeTrap(); });
  }
  bindTouch() {
    document.body.classList.add('touch');
    const joyZ = $('joyZone'), look = $('lookZone'), base = $('joyBase'), knob = $('joyKnob'); let jid = null, jc = null, lid = null, lx = 0, ly = 0;
    joyZ.addEventListener('pointerdown', (e) => { jid = e.pointerId; jc = { x: e.clientX, y: e.clientY }; base.style.left = (e.clientX - 58) + 'px'; base.style.bottom = (innerHeight - e.clientY - 58) + 'px'; joyZ.setPointerCapture(jid); });
    joyZ.addEventListener('pointermove', (e) => { if (e.pointerId !== jid) return; let dx = e.clientX - jc.x, dy = e.clientY - jc.y; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; }
      knob.style.transform = `translate(${dx}px,${dy}px)`; this.joy.x = dx / m; this.joy.y = -dy / m; });
    const jend = (e) => { if (e.pointerId !== jid) return; jid = null; this.joy.x = this.joy.y = 0; knob.style.transform = ''; };
    joyZ.addEventListener('pointerup', jend); joyZ.addEventListener('pointercancel', jend);
    look.addEventListener('pointerdown', (e) => { lid = e.pointerId; lx = e.clientX; ly = e.clientY; look.setPointerCapture(lid); });
    look.addEventListener('pointermove', (e) => { if (e.pointerId !== lid) return; this.look.x += e.clientX - lx; this.look.y += e.clientY - ly; lx = e.clientX; ly = e.clientY; });
    const lend = (e) => { if (e.pointerId === lid) lid = null; }; look.addEventListener('pointerup', lend); look.addEventListener('pointercancel', lend);
    const btn = (id, down, up) => { const b = $(id); const d = (e) => { e.preventDefault(); b.classList.add('held'); down && down(); }; const u = (e) => { e.preventDefault(); b.classList.remove('held'); up && up(); };
      b.addEventListener('pointerdown', d); b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u); b.addEventListener('pointerleave', u); };
    const g = this.g, pl = () => g.state === 'playing';
    btn('tRun', () => { this.runHeld = true; }, () => { this.runHeld = false; });
    btn('tJump', () => { if (pl()) this.keys.Space = true; }, () => { this.keys.Space = false; });
    btn('tAct', () => { if (pl()) g.interact(); }); btn('tLight', () => { if (pl()) this.toggleFlash(); }); btn('tTrap', () => { if (pl()) g.placeTrap(); });
  }

  update(dt) {
    const g = this.g, env = g.env, cam = this.cam, k = this.keys; this.t += dt;
    // look (touch swipe)
    if (IS_TOUCH && (this.look.x || this.look.y)) { this.rotate(-this.look.x * 0.0045 * settings.sens, -this.look.y * 0.0045 * settings.sens); this.look.x = this.look.y = 0; }
    // input vector
    cam.getWorldDirection(this._d || (this._d = V3())); const fx = this._d.x, fz = this._d.z, fl = Math.hypot(fx, fz) || 1, fwdx = fx / fl, fwdz = fz / fl, rx = -fwdz, rz = fwdx;
    let iy = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0) + this.joy.y, ix = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + this.joy.x; const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
    this.moving = il > 0.08;
    const wantRun = (k.ShiftLeft || k.ShiftRight || this.runHeld) && this.moving;
    this.running = wantRun && !this.exhausted && this.stamina > 0;
    const water = env.groundY(this.pos.x, this.pos.z) < 0, ghostNear = 0;
    let sp = (this.running ? 5.4 : 2.9) * (water ? 0.74 : 1) * (this.exhausted ? 0.85 : 1) * Math.min(1, il + 0.0);
    const tx = (fwdx * iy + rx * ix) * sp, tz = (fwdz * iy + rz * ix) * sp, a = 1 - Math.exp(-12 * dt);
    this.vel.x += (tx - this.vel.x) * a; this.vel.z += (tz - this.vel.z) * a;
    env.tryMove(this.pos, this.vel.x * dt, this.vel.z * dt, this.r);
    // stamina
    if (this.running) { this.stamina -= 22 * dt; if (this.stamina <= 0) { this.stamina = 0; this.exhausted = true; g.ui.toast('You are exhausted…', 1800); } }
    else { this.stamina = Math.min(100, this.stamina + (this.moving ? 14 : 24) * dt); if (this.exhausted && this.stamina > 28) this.exhausted = false; }
    // vertical
    const gy = env.groundY(this.pos.x, this.pos.z);
    if (k.Space && this.onGround && this.stamina > 10 && g.state === 'playing') { this.vy = 4.3; this.onGround = false; this.stamina -= 8; k.Space = IS_TOUCH ? k.Space : false; }
    if (this.onGround) { if (gy >= this.pos.y || this.pos.y - gy <= 0.2) this.pos.y = gy; else this.onGround = false; }
    if (!this.onGround) {
      this.vy -= 13 * dt; this.pos.y += this.vy * dt;
      if (this.pos.y <= gy) { if (this.vy < -3) { g.audio.step(water ? 'water' : 'dirt', true); if (water) g.fx.splash(this.pos.x, this.pos.z, 6, 0.7); } this.pos.y = gy; this.vy = 0; this.onGround = true; }
    }
    this.inHouse = env.inHouseXZ(this.pos.x, this.pos.z, -0.05) && this.pos.y > 0.9;
    // footsteps + bob
    const spd = Math.hypot(this.vel.x, this.vel.z); this.phase += spd * dt * (this.running ? Math.PI / 1.5 : Math.PI / 1.0);
    const stepIdx = Math.floor(this.phase / Math.PI);
    if (stepIdx !== this.lastStep) { this.lastStep = stepIdx; if (spd > 0.5 && this.onGround) {
      const surf = this.inHouse ? 'wood' : water ? 'water' : 'dirt'; g.audio.step(surf, this.running);
      if (water) { g.fx.ripple(this.pos.x, this.pos.z, 1.0, 1.0); g.fx.splash(this.pos.x, this.pos.z, this.running ? 5 : 2, this.running ? 0.45 : 0.25); } } }
    const amp = this.running ? 0.08 : 0.045, bs = Math.min(1, spd / 2.5), bobY = -Math.abs(Math.sin(this.phase)) * amp * bs + Math.sin(this.t * 1.3) * 0.006, bobX = Math.sin(this.phase) * amp * 0.5 * bs;
    this.eyeY += ((this.pos.y + this.eye) - this.eyeY) * (this.onGround ? Math.min(1, dt * 16) : 1);
    cam.position.set(this.pos.x + rx * bobX, this.eyeY + bobY, this.pos.z + rz * bobX);
    cam.fov += ((this.running ? 76 : 70) - cam.fov) * Math.min(1, dt * 6); cam.updateProjectionMatrix();
    // breathing
    this.breathT -= dt; const tired = this.stamina < 35 || this.exhausted;
    if (this.breathT <= 0 && (tired || this.running)) { g.audio.playerBreath(tired ? 1.4 : 0.7); this.breathT = tired ? 1.1 : 1.8; } else if (this.breathT <= 0) this.breathT = 0.5;
    // flashlight
    if (this.flashOn) { this.battery = Math.max(0, this.battery - 0.18 * dt); if (this.battery <= 0) { this.flashOn = false; g.ui.toast('The flashlight died!', 2500, true); } }
    let inten = this.flashOn ? 90 : 0;
    if (this.flickerT > 0) { this.flickerT -= dt; inten *= Math.random() < 0.5 ? 0.05 : Math.random(); }
    else if (this.flashOn && this.battery < 15 && Math.random() < 0.06) inten *= 0.2;
    else if (this.flashOn && g.ghost.threat > 0.55 && Math.random() < 0.05 * g.ghost.threat) inten *= 0.1;
    this.spot.intensity = inten; this.lens.visible = this.flashOn && inten > 5; this.beam.visible = this.flashOn && inten > 5; this.beam.material.opacity = 0.03 + 0.025 * Math.min(1, inten / 90);
    this.heldTrap.visible = this.carried > 0; for (const a of [this.armL, this.armR]) a.userData.proc.visible = !a.userData.model;
    // hands: bob + look lag + action animations (place / pull)
    this.lagX += (-this.vel.x * 0.0 - this.lagX) * dt * 6; const sway = Math.sin(this.t * 1.3) * 0.004;
    let ax = bobX * 0.5, ay = bobY * 0.7 + sway, az = 0, rxL = 0, ryL = 0, rxR = 0; let lx = 0, ly = 0, lz = 0;
    if (this.act) { const A = this.act; A.t += dt; const k = A.t / A.dur;
      if (k >= 1) { const f = A.done; this.act = null; f && f(); }
      else { const sn = Math.sin(k * Math.PI), e = k < 0.5 ? k * 2 : 2 - k * 2;
        if (A.type === 'place') { lz = -0.28 * sn; ly = -0.18 * sn + (k > 0.55 ? -0.1 * (k - 0.55) : 0); lx = 0.1 * sn; rxL = -0.5 * sn; }
        else { lz = -0.3 * sn; ly = 0.05 * sn; rxL = -0.3 * sn; this.armR.position.z = -0.2 - 0.18 * sn; this.armR.position.y = -0.34 + 0.06 * sn; if (k > 0.5) { ly = 0.12 * (1 - k) * 2; lz = -0.1; } } } }
    if (!this.act || this.act.type === 'place') { this.armR.position.z = -0.2; this.armR.position.y = -0.34; }
    this.hands.position.set(ax, ay, az); this.armL.position.set(-0.27 + lx, -0.34 + ly, -0.2 + lz); this.armL.rotation.x = 0.3 + rxL;
  }
  doAct(type, dur, done) { this.act = { type, t: 0, dur, done }; }
  rotate(dyaw, dpitch) {
    const e = this._e || (this._e = new THREE.Euler(0, 0, 0, 'YXZ')); e.setFromQuaternion(this.cam.quaternion);
    e.y += dyaw; e.x = clamp(e.x + dpitch, -1.5, 1.5); e.z = 0; this.cam.quaternion.setFromEuler(e);
  }
}
