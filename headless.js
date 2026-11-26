// headless.js – LEVEL 2 event: (1) walking up to a trap, a severed ghost head surfaces and eats the bait (the camera is forced to watch);
// (2) when it sinks, the headless body is already standing behind your back. Turn round and it runs at you and chokes you off the ground.
// With the necklace (taken from the bed) it only drains half your blood, drops you and burns up; without it you die.
import { THREE, V3, rand, clamp, lerp, pick, $, IS_TOUCH, WATER_Y } from './core.js';
import { GhostRig, loadPropModel } from './ghostrig.js';

const ez = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const COOL_FIRST = 38, COOL_NEXT = 110;

export class HeadlessEvent {
  constructor(game) {
    this.g = game; this.ready = false; this.reset();
  }
  reset() {
    this.stage = 0;
    this.cool = COOL_FIRST; this.phase = null; this.t = 0; this.pending = 0; this.tr = null;
    if (this.head) this.head.visible = false; if (this.body) this.body.root.visible = false; if (this.light) this.light.intensity = 0; if (this.fl) this.fl.intensity = 0;
    if (this.g.fx && this.g.fx.fireOff) this.g.fx.fireOff();
  }
  load() { // called when level 2 starts (the day cut-scene hides the loading)
    if (this._p) return this._p; const tex = IS_TOUCH ? 512 : 1024, g = this.g;
    return this._p = Promise.all([loadPropModel('assets/ghost_head.glb?v=1', 0.85, tex, 0x46525c), GhostRig.load('assets/headless.glb?v=1', 2.1, tex, false)]).then(([head, body]) => {
      const wrap = new THREE.Group(); head.position.y = 0.33; wrap.add(head); wrap.visible = false; g.scene.add(wrap); this.head = wrap; // the face centre sits at the origin
      body.root.visible = false; g.scene.add(body.root); this.body = body; body.model.traverse((o) => { if (o.isMesh && o.material && o.material.color) o.material.color.multiplyScalar(0.5); }); // keep the flashlight from blowing the body out to white at close range
      this.light = new THREE.PointLight(0xb8d0dc, 0, 6, 2); g.scene.add(this.light); this.fl = new THREE.PointLight(0xff7a24, 0, 14, 2); g.scene.add(this.fl); // pre-created so no shader hitch happens mid-event
      this.ready = true; console.log('[level2] head + headless models ready'); return true;
    }).catch((e) => { console.warn('[level2] headless models failed, events disabled', e); this._p = null; return false; });
  }
  // ---------- scheduling (called every frame while playing) ----------
  tick(dt) {
    const g = this.g; if (g.level !== 2 || !this.ready) return;
    if (this.phase === 'wait') return this.waitUpdate(dt);
    this.cool -= dt; if (this.cool > 0) return;
    if (g.ghost.hunting || g.ghost.state !== 'dormant' || g.player.inHouse || g.weeping) return;
    const p = g.player.pos, f = this._f || (this._f = V3()); g.camera.getWorldDirection(f); const c = [];
    for (const t of g.traps) { if (t.state !== 'idle' || t.busy || t.slide) continue; const dx = t.pos.x - p.x, dz = t.pos.z - p.z, d = Math.hypot(dx, dz); if (d > 1.7 && d < 4.0 && (f.x * dx + f.z * dz) / d > 0.5) c.push(t); }
    if (c.length && Math.random() < dt * 0.4) this.startHead(pick(c));
  }
  onPull() {}

  // ---------- 1) the head eats your bait ----------
  startHead(tr) {
    const g = this.g, cam = g.camera; g.state = 'headev'; this.phase = 'head'; this.t = 0; this.tr = tr; this.F = {}; this.cool = COOL_NEXT;
    this.M = V3(tr.mouth.x, WATER_Y, tr.mouth.z); this.base = cam.position.clone(); this.q = cam.quaternion.clone();
    this.head.visible = true; this.head.position.set(this.M.x, WATER_Y - 0.75, this.M.z); this.head.rotation.set(0, 0, 0); this.head.scale.setScalar(1);
    g.ui.prompt(null, false); g.player.flicker(1.2);
  }
  headUpdate(dt) {
    const g = this.g, cam = g.camera, M = this.M, F = this.F, au = g.audio, tr = this.tr, t = (this.t += dt), h = this.head;
    g.ui.prompt(null, false); g.env.update(dt, g.player); g.fx.update(dt); for (const x of g.traps) x.update(dt); g.frogs.update(dt); au.update(dt, g.player);
    // the camera is forced to look at the bait, then drifts up to a level view as the head sinks
    const T_UP = 1.6, T_EAT = 4.4, T_STARE = 5.5, T_SINK = 6.3, T_END = 6.9;
    const kk = t > T_STARE ? ez((t - T_STARE) / 1.2) : 0, dd = Math.hypot(cam.position.x - M.x, cam.position.z - M.z), tgt = V3(M.x, lerp(WATER_Y + 0.22, cam.position.y - 0.12 * dd, kk), M.z), m = new THREE.Matrix4().lookAt(cam.position, tgt, V3(0, 1, 0)), qt = new THREE.Quaternion().setFromRotationMatrix(m); this.q.slerp(qt, 1 - Math.exp(-dt * 5)); cam.quaternion.copy(this.q);
    if (t >= 0.3 && !F.up) { F.up = 1; g.fx.splash(M.x, M.z, 12, 0.9); au.splash({ x: M.x, y: 0.1, z: M.z }, 1.2); au.gurgle({ x: M.x, y: 0.2, z: M.z }); au.sting(0.5); }
    const toCam = Math.atan2(cam.position.x - M.x, cam.position.z - M.z);
    let y = WATER_Y + 0.14, rx = 0, ry = toCam + 0.25, sq = 1;
    if (t < T_UP) { y = lerp(WATER_Y - 0.75, WATER_Y + 0.14, ez((t - 0.3) / (T_UP - 0.3))); rx = 0.2; }
    else if (t < T_EAT) { rx = 0.2 + 0.08 * Math.sin(t * 14); sq = 1 + 0.06 * Math.sin(t * 14); ry = toCam + 0.25 - 0.18 * Math.sin(t * 2.2); // chewing: the head bobs over the bait, the pole jerks
      F.cr = (F.cr || 0) - dt; if (F.cr <= 0) { F.cr = rand(0.13, 0.22); au.noise({ dur: 0.08, type: 'bandpass', freq: rand(600, 1500), q: 2.2, vol: 0.13, pos: { x: M.x, y: 0.3, z: M.z } }); if (Math.random() < 0.3) au.noise({ dur: 0.05, type: 'highpass', freq: 3000, vol: 0.08, pos: { x: M.x, y: 0.3, z: M.z } }); }
      tr.tug = 1; tr.mesh.rotation.z = Math.sin(t * 26) * 0.1; if (Math.random() < dt * 5) g.fx.ripple(M.x + rand(-0.2, 0.2), M.z + rand(-0.2, 0.2), 0.5, 0.8); }
    else if (t < T_SINK) { const k = ez((t - T_EAT) / 0.5); rx = lerp(0.2, -0.1, k); ry = lerp(toCam + 0.25, toCam, k); // it stops chewing and looks straight at you
      if (t >= T_EAT && !F.stare) { F.stare = 1; au.sting(1); g.ui.flash('#000', 0.55, 260); g.player.flicker(1.4); au.whisper({ x: M.x, y: 0.5, z: M.z }); } y += 0.03 * Math.sin(t * 7); }
    else { const k = ez((t - T_SINK) / (T_END - T_SINK - 0.1)); y = lerp(WATER_Y + 0.14, WATER_Y - 0.8, k); rx = -0.1 + 0.3 * k; ry = toCam;
      if (!F.sink) { F.sink = 1; au.gurgle({ x: M.x, y: 0.2, z: M.z }); g.fx.splash(M.x, M.z, 6, 0.5); this.spawnBehind(); } if (Math.random() < dt * 9) g.fx.ripple(M.x, M.z, 0.9, 1.1); }
    h.position.set(M.x + (t >= T_EAT && t < T_SINK ? rand(-0.004, 0.004) : 0), y, M.z); h.rotation.set(rx, ry, 0.05 * Math.sin(t * 1.7)); h.scale.set(1, sq, 1);
    this.light.position.set(M.x, WATER_Y + 0.5, M.z); this.light.intensity = 2.4 * ez(t / 1.6) * (t > T_SINK ? 1 - ez((t - T_SINK) / 0.6) : 1) * (0.85 + 0.15 * Math.sin(t * 31));
    if (t >= T_END) { // the bait is gone; you can pull it back normally
      h.visible = false; this.light.intensity = 0; tr.timer = Math.max(tr.timer, 35); tr.tug = 0; tr.mesh.rotation.z = 0; this.phase = 'wait'; this.t = 0; this.F = {}; g.state = 'playing'; // you are free again... and something stands behind you
      g.ghost.eventTimer = Math.max(g.ghost.eventTimer, 40); g.ui.toast('នុយបង្កៃបាត់ហើយ… · The bait is gone…', 2600, true);
    }
  }

  // ---------- 2) the headless ghost ----------
  spawnBehind() { // while the head sinks it is already standing behind you
    const g = this.g, p = g.player.pos, b = this.body, f = this._f || (this._f = V3()); g.camera.getWorldDirection(f); f.y = 0; f.normalize();
    this.gp = V3(p.x - f.x * 3.4, 0, p.z - f.z * 3.4); this.gp.y = g.env.groundY(this.gp.x, this.gp.z); b.root.visible = true; b.root.position.copy(this.gp); b.root.rotation.y = Math.atan2(f.x, f.z); b.play('hlstand', 0.1); b.update(0.01, {});
  }
  seen() { // is it inside your view?
    const g = this.g, f = this._f || (this._f = V3()); g.camera.getWorldDirection(f); const dx = this.gp.x - g.player.pos.x, dz = this.gp.z - g.player.pos.z, d = Math.hypot(dx, dz) || 1, fl = Math.hypot(f.x, f.z) || 1;
    return d < 14 && (f.x * dx + f.z * dz) / (d * fl) > 0.62;
  }
  waitUpdate(dt) { // it just stands there behind your back; turn round and it comes
    const g = this.g, b = this.body, p = g.player.pos, t = (this.t += dt), F = this.F, au = g.audio; if (!b.root.visible) { this.phase = null; return; }
    const seen = this.seen(); let dx = this.gp.x - p.x, dz = this.gp.z - p.z, d = Math.hypot(dx, dz) || 1;
    if (!seen && d > 4.2) { // you walked off: it silently steps back in behind you (only while you are not looking)
      const f = this._f; g.camera.getWorldDirection(f); f.y = 0; f.normalize(); this.gp.set(p.x - f.x * 3.4, 0, p.z - f.z * 3.4); this.gp.y = g.env.groundY(this.gp.x, this.gp.z); dx = this.gp.x - p.x; dz = this.gp.z - p.z; d = Math.hypot(dx, dz) || 1;
    }
    b.root.position.set(this.gp.x, g.env.groundY(this.gp.x, this.gp.z), this.gp.z); b.root.rotation.y = Math.atan2(-dx, -dz); b.update(dt, {});
    F.b = (F.b || 0) - dt; if (F.b <= 0) { F.b = rand(1.3, 2.2); au.breath({ x: p.x + dx / d * 1.2, y: 1.5, z: p.z + dz / d * 1.2 }); }
    if (t > 6 && !F.w) { F.w = 1; au.whisper({ x: p.x + dx / d * 1.0, y: 1.5, z: p.z + dz / d * 1.0 }); g.player.flicker(1.2); }
    if (seen) return this.startRun();
    if (t > 40) { b.root.visible = false; this.phase = null; } // you never dared to look: it gives up
  }
  startRun() { // you saw it: it sprints at you
    const g = this.g; g.state = 'hl'; this.phase = 'run'; this.t = 0; this.F = {}; this.worn = !!g.necklace.worn; this.body.play('run', 0.05); this.qq = g.camera.quaternion.clone();
    g.ui.prompt(null, false); g.audio.sting(1); g.ui.flash('#000', 0.5, 220); g.audio.cry(this.gp); g.player.flicker(1.5);
  }
  startGrab(ux, uz) {
    const g = this.g, cam = g.camera, p = g.player.pos; g.state = 'hl'; this.phase = 'grab'; this.t = 0; this.F = {}; this.u = V3(ux, 0, uz); // u = from you toward it
    this.base = cam.position.clone(); this.hp0 = g.hp; this.worn = !!g.necklace.worn; this.target = this.worn ? Math.min(this.hp0, Math.max(12, this.hp0 * 0.5)) : 0;
    this.from = this.gp.clone(); this.to = V3(p.x + ux * 0.52, g.env.groundY(p.x + ux * 0.52, p.z + uz * 0.52), p.z + uz * 0.52); this.body.play('hlgrab', 0.12);
    g.audio.sting(1); g.ui.flash('#000', 0.6, 300);
  }
  aim(dt, ty, rate, roll = 0) { // the camera is pulled round so the ghost's body stays centred in the frame
    const g = this.g, cam = g.camera, r = this.body.root.position, m = new THREE.Matrix4().lookAt(cam.position, V3(r.x, r.y + ty, r.z), V3(0, 1, 0)), qt = new THREE.Quaternion().setFromRotationMatrix(m);
    this.qq = this.qq || cam.quaternion.clone(); this.qq.slerp(qt, 1 - Math.exp(-dt * rate)); cam.quaternion.copy(this.qq); if (roll) cam.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), roll));
  }
  level(dt, rate) { // ease the view back to a level, un-rolled horizon, keeping the heading
    const cam = this.g.camera, e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ'); const k = 1 - Math.exp(-dt * rate);
    e.x += (-0.12 - e.x) * k; e.z += (0 - e.z) * k; cam.quaternion.setFromEuler(e); this.qq = null;
  }
  update(dt) { // game state 'hl': grab -> (choke) -> drop -> burn -> vanish   |   or death
    const g = this.g, cam = g.camera, p = g.player, b = this.body, au = g.audio, F = this.F, t = (this.t += dt), U = this.u, root = b.root;
    g.ui.prompt(null, false); g.env.update(dt, p); g.fx.update(dt); for (const x of g.traps) x.update(dt); g.frogs.update(dt); au.update(dt, p);
    const hpShow = () => { $('hpBar').style.width = g.hp + '%'; $('hpTxt').textContent = Math.round(g.hp); };
    if (this.phase === 'run') { // sprinting at you
      const P = p.pos, dx = this.gp.x - P.x, dz = this.gp.z - P.z, d = Math.hypot(dx, dz) || 1, step = Math.min(d - 0.52, 6.5 * dt); this.gp.x -= dx / d * Math.max(0, step); this.gp.z -= dz / d * Math.max(0, step);
      root.position.set(this.gp.x, g.env.groundY(this.gp.x, this.gp.z), this.gp.z); root.rotation.y = Math.atan2(-dx, -dz); b.update(dt, { speed: 1 });
      F.st = (F.st || 0) - dt; if (F.st <= 0) { F.st = 0.18; au.noise({ dur: 0.1, type: 'lowpass', freq: 260, vol: 0.3, pos: root.position }); }
      this.aim(dt, 1.2, 8); if (d <= 0.6) this.startGrab(dx / d, dz / d); return;
    }
    if (this.phase === 'grab') {
      const lunge = ez(t / 0.3), lift = ez((t - 0.25) / 0.9) * 0.55;
      root.position.set(lerp(this.from.x, this.to.x, lunge), this.to.y, lerp(this.from.z, this.to.z, lunge)); root.rotation.y = Math.atan2(-U.x, -U.z); b.update(dt, {});
      if (t >= 0.3 && !F.g) { F.g = 1; au.slap(root.position); au.noise({ dur: 0.5, type: 'lowpass', freq: 500, q: 0.8, vol: 0.25 }); g.ui.flash('#a00000', 0.8, 400); }
      // you are lifted by the neck: feet leave the ground, vision shakes and darkens, the heart races
      const sh = 0.012 + 0.03 * clamp((t - 0.4) / 3, 0, 1); cam.position.set(this.base.x + rand(-sh, sh), this.base.y + lift + rand(-sh, sh), this.base.z + rand(-sh, sh));
      this.aim(dt, 1.9, 5, 0.1 * Math.sin(t * 9) * clamp((t - 0.3) / 1.5, 0, 1));
      // blood drain
      if (t > 0.5) { const rate = this.worn ? 20 : 18; g.hp = Math.max(this.worn ? this.target : 0, g.hp - rate * dt); g.hpRegenT = 10; hpShow(); }
      $('bloodTint').style.opacity = String(clamp(1 - g.hp / 100, 0, 1) * 0.9 + 0.05 * Math.sin(t * 8));
      F.hb = (F.hb || 0) - dt; if (F.hb <= 0) { F.hb = lerp(0.7, 0.3, clamp(t / 4, 0, 1)); au.heartbeat(0.7 + 0.6 * clamp(t / 4, 0, 1)); }
      F.br = (F.br || 0) - dt; if (F.br <= 0) { F.br = 0.75; au.playerBreath(1.8); au.noise({ dur: 0.4, type: 'bandpass', freq: 400, freq2: 150, q: 4, vol: 0.12 }); } // the throat rattles
      if (g.hp <= 0.01) { // no necklace: this is the end
        this.phase = 'die'; this.t = 0; g.ui.flash('#000', 1, 900); au.jumpscare(); return;
      }
      if (this.worn && g.hp <= this.target + 0.01) { // the necklace flares
        this.phase = 'drop'; this.t = 0; this.F = {}; this.cp = cam.position.clone(); g.ui.flash('#ffe2a8', 1, 700); au.sting(1); au.noise({ dur: 1.2, type: 'highpass', freq: 2500, vol: 0.2 });
        g.fx.fireOn(root, 9, 2.0, 0.38); this.fl.intensity = 6; g.necklace.worn = false; g.necklace.broken = true; g.ui.toast('ខ្សែកភ្លឺ! · The necklace burns it!', 2800); b.play('hlburn', 0.05);
        const dst = root.position.clone(); this.burnFrom = dst; this.ang = Math.atan2(-U.x, -U.z);
      }
      return;
    }
    if (this.phase === 'die') { b.update(dt, {}); if (t > 0.9) { $('bloodTint').style.opacity = 0; g.state = 'over'; this.phase = null; root.visible = false; g.gameOver(); } return; }
    if (this.phase === 'drop') { // dropped on the ground; the camera swings round to watch it burn
      const down = ez(t / 0.22), eye = this.base.y; cam.position.set(this.base.x, lerp(this.cp.y, eye, down) + (t < 0.5 ? rand(-0.03, 0.03) * (1 - t * 2) : 0), this.base.z);
      if (t >= 0.2 && !F.th) { F.th = 1; au.slap(cam.position); au.noise({ dur: 0.3, type: 'lowpass', freq: 220, vol: 0.4 }); au.crack(root.position); }
      this.aim(dt, 1.0, 4);
      $('bloodTint').style.opacity = String(Math.max(0, parseFloat($('bloodTint').style.opacity || 0) - dt * 0.8));
      this.burnUpdate(dt, t); if (t >= 0.6) { this.phase = 'burn'; this.t = 0; this.F = {}; }
      return;
    }
    if (this.phase === 'burn') {
      if (t < 4.2) this.aim(dt, 1.0, 3); else this.level(dt, 3.5); // when it sags, the view settles back to a level horizon
      this.burnUpdate(dt, t);
      if (t >= 5.2 && !F.sm) { F.sm = 1; g.fx.smokeOn(root.position.x, root.position.y, root.position.z, 2.6, 0.4, 2.0); au.noise({ dur: 1.8, type: 'lowpass', freq: 380, q: 0.6, vol: 0.12, pos: root.position }); }
      if (t >= 5.2) { const k = clamp((t - 5.2) / 1.4, 0, 1); root.position.y = this.burnFrom.y - 2.1 * ez(k); root.visible = t < 6.4 ? (Math.random() < 0.7) : false; this.fl.intensity = 6 * (1 - k); }
      if (t >= 6.6) { root.visible = false; this.fl.intensity = 0; g.fx.fireOff(); this.phase = null; g.state = 'playing'; g.ghost.eventTimer = Math.max(g.ghost.eventTimer, 30); g.ghost.huntCooldown = Math.max(g.ghost.huntCooldown, 40); this.qq = null; g.ui.flash('#000', 0, 1); this.level(1, 99); }
    }
  }
  burnUpdate(dt, t) { // it thrashes in the fire, stumbling away from you, screaming
    const g = this.g, b = this.body, root = b.root, au = g.audio, F = this.F, tt = this.phase === 'drop' ? t : t + 0.6;
    // it backs away from you one stumbling step at a time (no flying), then reels sideways and drops
    const sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, stag = 2.6 * sm((tt - 0.3) / 3.2), reel = sm((tt - 3.0) / 1.0) * (1 - sm((tt - 5.2) / 1.0)), side = reel * 0.55 * Math.sin(tt * 1.7), U = this.u, px = -U.z, pz = U.x;
    root.position.x = this.burnFrom.x + U.x * stag + px * side; root.position.z = this.burnFrom.z + U.z * stag + pz * side; root.position.y = g.env.groundY(root.position.x, root.position.z);
    root.rotation.y = this.ang + Math.sin(tt * 1.5) * 0.18 + reel * 0.35 * Math.sin(tt * 2.1); b.update(dt, {});
    this.fl.position.set(root.position.x, root.position.y + 1.1, root.position.z); this.fl.intensity = (this.fl.intensity > 0 ? 6 : 0) * (0.7 + 0.3 * Math.sin(tt * 33) + 0.2 * Math.sin(tt * 17));
    F.cr = (F.cr || 0) - dt; if (F.cr <= 0) { F.cr = rand(0.05, 0.14); au.noise({ dur: 0.1, type: 'bandpass', freq: rand(1200, 3500), q: 1.2, vol: 0.14, pos: root.position }); }
    F.sc = (F.sc || 0) - dt; if (F.sc <= 0) { F.sc = rand(1.1, 1.8); au.cry(root.position); au.voice({ f0: 700, f1: 380, f2: 260, dur: 1.2, vol: 0.12, pos: root.position, vib: 30 }); }
  }
}
