// script.js – GameManager: renderer, game flow, interactions, win/lose
import { THREE, V3, rand, clamp, lerp, $, IS_TOUCH, settings, FLOOR_Y, WATER_Y } from './core.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { AudioManager } from './audio.js';
import { Environment, FX, Frogs } from './environment.js';
import { HorrorEvents } from './events.js';
import { FishingTrap, FishSystem, FISH_TYPES, trapGeometry } from './fishing.js';
import { GhostAI } from './ghost.js';
import { GhostRig } from './ghostrig.js';
import { PlayerController } from './player.js';
import { UIManager } from './ui.js';

const MAX_CARRY = 6;

class GameManager {
  constructor() {
    this.state = 'menu'; this.built = false; this.low = settings.quality === 'low'; this.targets = { fish: 3, traps: 5 };
    this.renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: settings.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.low ? 1 : settings.quality === 'medium' ? 1.5 : 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.0;
    if (settings.quality !== 'low') { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    document.body.classList.add('q-' + settings.quality); this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 700); this.camera.rotation.order = 'YXZ'; this.camera.position.set(0, FLOOR_Y + 1.6, 0); this.scene.add(this.camera);
    this.controls = new PointerLockControls(this.camera, document.body); this.controls.pointerSpeed = settings.sens;
    this.controls.addEventListener('unlock', () => { if (this.state === 'playing' && !IS_TOUCH) this.pause(); });
    this.audio = new AudioManager(this); this.ui = new UIManager(this); this.clock = new THREE.Clock(); this.threat = 0; this.hb = 0; this.t = 0; this.hp = 100; this.hpRegenT = 0;
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); });
    this.renderer.setSize(innerWidth, innerHeight);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
    this.renderer.setAnimationLoop(() => this.frame());
    // force fullscreen + landscape from the very first tap / key on the loading screen (browsers only allow it after a user gesture)
    for (const ev of ['pointerdown', 'touchend', 'keydown']) addEventListener(ev, () => this.goFullscreen(), { capture: true, passive: true });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) this.ui.toast && this.state === 'playing' && this.ui.toast('ចុចអេក្រង់ដើម្បីត្រឡប់ពេញអេក្រង់ · Tap for fullscreen', 2200); else this.goFullscreen(); });
    this.build().catch((e) => console.error('build failed', e));
  }

  // ---------- setup ----------
  build() { // builds the world + loads the 3D models behind the loading screen (starts as soon as the page opens)
    return this._b || (this._b = (async () => {
      this.ui.show('loading'); const L = (p, t) => this.ui.loadProgress(p, t), tick = () => new Promise(r => setTimeout(r, 30)); L(0, 'កំពុងចាប់ផ្តើម… Waking the field'); await tick();
      try {
        L(4, 'ស្រែ និងផ្ទះ… Rice fields & house'); await tick(); this.env = new Environment(this);
        L(26, 'ទឹក ក្ងាប់ ស្រមោល… Water & frogs'); await tick(); this.fx = new FX(this);
        L(32, 'អ្នកលេង… The player'); await tick(); this.player = new PlayerController(this);
        L(38, 'ត្រី និងបង្កៃ… Fish & traps'); await tick(); this.fishSys = new FishSystem(this); this.events = new HorrorEvents(this); this.frogs = new Frogs(this); this.traps = [];
        L(44, 'វិញ្ញាណ… Something is watching'); await tick(); this.ghost = new GhostAI(this);
        this.previewMesh = new THREE.Mesh(trapGeometry(), new THREE.MeshBasicMaterial({ vertexColors: false, color: 0x55ff77, transparent: true, opacity: 0.45, depthWrite: false })); this.previewMesh.visible = false; this.scene.add(this.previewMesh);
        // wait (max 40 s) for the rigged ghost + arm models so she never pops in later; progress follows the real download
        const t0 = performance.now(); let done = false; const gp = this.ghost.loadRig().then(() => { done = true; }, () => { done = true; }), hp = this.player.handsReady.then(() => {}, () => {});
        while (!done && performance.now() - t0 < 40000) { L(48 + 44 * GhostRig.progress, 'ខ្មោច 3D កំពុងចុះ… Summoning her (' + Math.round(GhostRig.progress * 100) + '%)'); await Promise.race([gp, tick()]); }
        await Promise.race([hp, new Promise(r => setTimeout(r, 6000))]);
        L(100, 'ត្រៀមរួច… She is waiting'); await new Promise(r => setTimeout(r, 450));
        this.built = true; this.ui.hideAll();
      } catch (e) { console.error(e); const p = document.querySelector('#loadText'); if (p) p.textContent = 'ERROR: ' + (e && e.message ? e.message : e) + ' @ ' + String(e && e.stack || '').split('\n').slice(1, 3).join(' | '); throw e; }
          this.ui.show('menu');
    })());
  }
  async startNewGame() {
    this.goFullscreen(); this.audio.init(); this.audio.resume(); this.ui.hideAll(); this.lockPointer();
    if (!this.built) { this.ui.show('loading'); await this.build(); }
    try { this.resetWorld(); } catch (e) { console.error('[game] resetWorld failed, continuing', e); } // never get stuck on a restart
    this.beginIntro();
  }
  resetWorld() {
    for (const t of this.traps) { try { t.dispose(); } catch (e) { console.warn(e); } } this.traps = []; this.fishCollected = 0; this.trapsPlacedTotal = 0; this.fishByType = {}; this.time = 0; this.hudT = 0;
    this.hp = 100; this.hpRegenT = 0; this.ambushCool = 60; this.weeping = false; this.player.reset(); this.ghost.reset(); this.fishSys.reset(); this.events.reset(); this.frogs.reset(); this.threat = 0;
    this.env.door.open = false; this.env.door.t = 0; this.env.door.col.active = true;
    for (const it of this.env.houseItems) if (it.mesh) { it.mesh.visible = true; it.taken = false; }
    this.ghost.mesh.scale.set(1, 1, 1); $('bloodTint').style.opacity = 0;
  }
  beginIntro() {
    this.state = 'intro'; this.introT = 0; this.introStep = -1; this.ui.hud(false); this.ui.show('intro'); this.ui.fade(true);
    this.camera.position.set(-3.05, FLOOR_Y + 0.62, -1.7); this.camera.rotation.set(1.2, Math.PI, 0);
    this.audio.resume();
  }
  skipIntro() { if (this.state === 'intro' && this.introT > 1) this.introT = 9.2; }
  introUpdate(dt) {
    this.introT += dt; const t = this.introT, st = t < 2.2 ? 0 : t < 5 ? 1 : t < 8.5 ? 2 : 3;
    if (st !== this.introStep) {
      this.introStep = st;
      if (st === 0) this.ui.introText('<span class="clock">11:58 PM</span>រាត្រីជ្រៅ…<br>Deep night.');
      if (st === 1) { this.ui.introText('អ្នកភ្ញាក់ឡើងនៅក្នុងផ្ទះឈើចាស់…<br>You wake inside the old wooden house.'); this.ui.fade(false); }
      if (st === 2) this.ui.introText('ដល់ពេលទៅដាក់បង្កៃហើយ។ សូមប្រយ័ត្ន…<br>Time to set the traps. Be careful.');
      if (st === 3) this.finishIntro();
    }
    if (st >= 1 && st < 3) { // rise from the bed and turn toward the door
      const k = clamp((t - 2.2) / 6, 0, 1), e = k * k * (3 - 2 * k);
      this.camera.position.set(lerp(-3.05, -1.5, e), lerp(FLOOR_Y + 0.62, FLOOR_Y + 1.62, e), lerp(-1.7, -1.0, e));
      this.camera.rotation.set(lerp(1.2, 0, e) + Math.sin(t * 2) * 0.01, Math.PI + Math.sin(t * 0.8) * 0.2 * (1 - e), 0);
    }
  }
  finishIntro() {
    this.ui.introText(''); this.ui.show(null); this.ui.hud(true); this.state = 'playing'; this.camera.rotation.set(0, Math.PI, 0);
    this.player.pos.set(-1.5, FLOOR_Y, -1.0); this.player.eyeY = FLOOR_Y + 1.62; if (!IS_TOUCH && !this.controls.isLocked) { this.pause(); return; }
    this.ui.toast('Look around the house. Press E to take the flashlight and the fishing traps.', 6000);
  }
  goFullscreen() { // must run inside a click/tap handler; also locks landscape (Android needs fullscreen first)
    const lock = () => { try { if (IS_TOUCH && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
    try {
      const el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
      if (rq && !document.fullscreenElement && !document.webkitFullscreenElement) { const r = rq.call(el); if (r && r.then) r.then(lock, () => {}); else setTimeout(lock, 300); } else lock();
    } catch (e) {}
  }
  lockPointer() { if (!IS_TOUCH) { try { this.controls.lock(); } catch (e) {} } }

  // ---------- flow ----------
  pause() { if (this.state !== 'playing') return; this.state = 'paused'; this.audio.suspend(); this.ui.show('pause'); if (this.controls.isLocked) document.exitPointerLock(); }
  resume() { if (this.state !== 'paused') return; this.goFullscreen(); this.state = 'playing'; this.ui.show(null); this.audio.resume(); this.lockPointer(); }
  toMenu() { this.state = 'menu'; this.ui.hud(false); this.ui.fade(false); this.ui.show('menu'); this.audio.resume(); if (document.pointerLockElement) document.exitPointerLock(); }
  hurtPlayer(gh) { // ghost touched the player: lose health instead of instant death
    if (this.state !== 'playing') return;
    this.hp = Math.max(0, this.hp - 34); this.hpRegenT = 8;
    if (this.hp <= 0) return this.catchPlayer();
    this.audio.cry(gh.pos); this.ui.flash('#a00000', 0.7, 500); this.player.flicker(1.2);
    this.ui.toast('ខ្មោចវៃអ្នក! រត់ទៅ! · Run! She will vanish if you escape 5s', 2600);
    const dx = this.player.pos.x - gh.pos.x, dz = this.player.pos.z - gh.pos.z, l = Math.hypot(dx, dz) || 1; gh.pos.x -= dx / l * 1.2; gh.pos.z -= dz / l * 1.2; // shove her back
  }
  catchPlayer() {
    if (this.state !== 'playing') return; this.state = 'caught'; this.caughtT = 0; this.ui.hud(false);
    if (document.pointerLockElement) document.exitPointerLock();
    const fwd = V3(); this.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    this.player.spot.intensity = 0; this.ghost.jumpscarePose(this.camera.position, fwd);
    this.camLook = this.camera.position.clone().add(V3(fwd.x * 0.85, -0.12, fwd.z * 0.85)); this.camBase = this.camera.position.clone();
    this.audio.jumpscare(); this.ui.flash('#a00000', 1, 900);
    this.ghost.light.intensity = 2;
  }
  gameOver() {
    this.state = 'over'; this.ui.show('gameover'); this.ghost.mesh.visible = false;
    $('deadStats').innerHTML = `Survived ${Math.floor(this.time / 60)}m ${Math.floor(this.time % 60)}s<br>Fish collected: ${this.fishCollected} · Traps placed: ${this.trapsPlacedTotal}`;
  }
  win() {
    this.state = 'win'; this.ui.hud(false); this.audio.win(); this.ui.show('victory'); if (document.pointerLockElement) document.exitPointerLock();
    const f = Object.keys(this.fishByType).map(k => `${FISH_TYPES[k].km} ×${this.fishByType[k]}`).join(' · ');
    $('winStats').innerHTML = `You returned home with ${this.fishCollected} fish<br>${f}<br>Time: ${Math.floor(this.time / 60)}m ${Math.floor(this.time % 60)}s`;
  }
  objective() {
    const p = this.player, T = this.targets, have = p.carried + this.trapsPlacedTotal;
    if (!p.hasFlashlight) return 'Take the flashlight (ពិល) from the table.';
    if (this.trapsPlacedTotal < T.traps && p.carried === 0 && have < T.traps) return `Take fishing traps (បង្កៃ) from the table. (${p.carried}/${MAX_CARRY})`;
    if (this.trapsPlacedTotal < T.traps) return p.inHouse ? 'Leave the house and walk the rice-field dikes.' : `Place ${T.traps - this.trapsPlacedTotal} more trap(s) in the paddy water. (Click / E)`;
    if (this.fishCollected < T.fish) return `Wait for fish, then check your traps. Collect ${T.fish - this.fishCollected} more.`;
    return 'Return to the old house. Survive.';
  }

  // ---------- interaction ----------
  findInteractable() {
    const cam = this.camera, f = this._f || (this._f = V3()); cam.getWorldDirection(f); let best = null, bs = -9;
    const consider = (it) => {
      if (it.taken) return; const dx = it.pos.x - cam.position.x, dy = it.pos.y - cam.position.y, dz = it.pos.z - cam.position.z, d = Math.hypot(dx, dy, dz);
      if (d > it.range) return; const dot = (f.x * dx + f.y * dy + f.z * dz) / d; if (dot < 0.78) return;
      const s = dot - d * 0.05; if (s > bs) { bs = s; best = it; }
    };
    for (const it of this.env.houseItems) consider(it);
    for (const t of this.traps) if (t.state === 'caught' || t.state === 'idle') { const q = t.item || (t.item = { type: 'pull', trap: t, pos: V3(0, 0.9, 0), range: 3.4 }); q.pos.set(t.pos.x, 0.9, t.pos.z); consider(q); }
    return best;
  }
  promptFor(it) {
    const k = (a) => `<kbd>${IS_TOUCH ? 'E' : 'E'}</kbd>${a}`; const p = this.player;
    switch (it.type) {
      case 'door': return k(this.env.door.open ? 'Close door' : 'Open door');
      case 'flash': return k('Take flashlight (ពិល)'); case 'battery': return k('Replace flashlight batteries');
      case 'trap': return k(`Take fishing trap (${p.carried}/${MAX_CARRY})`);
      case 'pull': return it.trap.state === 'caught' ? k(`Pull up trap – something is thrashing inside! (${FISH_TYPES[it.trap.fishType].km})`) : k('Pull up trap and check the bait');
    }
  }
  interact() {
    if (this.state !== 'playing') return; const it = this.findInteractable(), p = this.player, au = this.audio, ui = this.ui;
    if (!it) { this.placeTrap(true); return; }
    switch (it.type) {
      case 'door': {
        const d = this.env.door;
        if (!d.open) { d.open = true; au.doorOpen({ x: 0, y: 2, z: 3 }); } else {
          if (Math.abs(p.pos.z - 3) < 0.9 && Math.abs(p.pos.x) < 1.1 || (this.ghost.mesh.visible && Math.hypot(this.ghost.pos.x, this.ghost.pos.z - 3) < 1.4)) return ui.toast('Something is in the way.', 1500);
          d.open = false; au.doorClose({ x: 0, y: 2, z: 3 });
        } break;
      }
      case 'flash': p.hasFlashlight = true; it.taken = true; it.mesh.visible = false; p.hand.visible = true; p.flashOn = true; au.pickup(); ui.toast('Flashlight taken. Press F to toggle it.', 3500); break;
      case 'battery': p.battery = 100; au.pickup(); ui.toast('Fresh batteries inserted.', 2000); break;
      case 'trap':
        if (p.carried >= MAX_CARRY) return ui.toast(`You can't carry more than ${MAX_CARRY} traps.`, 2000);
        p.carried++; it.taken = true; it.mesh.visible = false; au.pickup();
        if (p.carried === 1) ui.toast('Fishing trap taken. Take at least 5, then go out to the rice fields.', 4000); break;
      case 'pull': {
        const tr = it.trap;
        // sometimes the "fish" in the trap is HER
        if (tr.state === 'caught' && this.ambushCool <= 0 && this.fishCollected >= 1 && !p.inHouse && !this.ghost.hunting && this.ghost.state === 'dormant' && Math.random() < 0.38) return this.startAmbush(tr);
        if (!tr.beginPull(() => this.finishPull(tr))) return; p.doAct('pull', 1.2); break;
      }
    }
  }
  finishPull(tr) {
    const p = this.player, au = this.audio, ui = this.ui, type = tr.takeFish(); tr.dispose(); this.traps = this.traps.filter(t => t !== tr); p.carried++; p.pulled++; au.pickup();
    if (type) { this.fishCollected++; this.fishByType[type] = (this.fishByType[type] || 0) + 1; ui.toast(`${FISH_TYPES[type].km} · ${FISH_TYPES[type].en} caught! (${this.fishCollected}/${this.targets.fish})`, 3200);
      if (this.fishCollected === this.targets.fish && this.trapsPlacedTotal >= this.targets.traps) ui.toast('Enough fish. Go home — now.', 4000, true); }
    else ui.toast('The bait is gone, but the trap is empty. Put it back in the water.', 3200);
  }
  placementSpot() {
    const p = this.player, f = this._pf || (this._pf = V3()); this.camera.getWorldDirection(f); f.y = 0; f.normalize();
    const x = p.pos.x + f.x * 1.9, z = p.pos.z + f.z * 1.9, yaw = Math.atan2(-f.z, f.x);
    let ok = this.env.isWaterAt(x, z, 0.5) && !p.inHouse;
    if (ok) for (const t of this.traps) if (Math.hypot(t.pos.x - x, t.pos.z - z) < 1.8) { ok = false; break; }
    return { x, z, yaw, ok };
  }
  placeTrap(fromE = false) {
    if (this.state !== 'playing') return; const p = this.player;
    if (p.carried <= 0) return fromE ? undefined : this.ui.toast('You have no traps. Take them from the table.', 2200);
    const s = this.placementSpot(); if (!s.ok) return this.ui.toast('Place traps in the water between the rice, away from dikes and other traps.', 2800);
    p.carried--; if (p.pulled > 0) p.pulled--; else this.trapsPlacedTotal++; p.doAct('place', 0.75); this.traps.push(new FishingTrap(this, s.x, s.z, s.yaw));
    this.ui.toast(this.trapsPlacedTotal === 1 ? 'Trap set. Fish will come… check back later.' : `Trap placed (${this.trapsPlacedTotal}/${this.targets.traps}).`, 2500);
  }

  // ---------- main loop ----------
  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05); this.t += dt;
    if (this.built) {
            if (this.state === 'intro') { this.introUpdate(dt); this.env.update(dt, this.player); this.fx.update(dt); }
      else if (this.state === 'playing') this.playUpdate(dt);
      else if (this.state === 'caught') this.caughtUpdate(dt);
      else if (this.state === 'ambush') this.ambushUpdate(dt);
      else if (this.state === 'menu' || this.state === 'paused' || this.state === 'over' || this.state === 'win') this.env.update(dt * (this.state === 'menu' ? 1 : 0), this.player);
      this.audio.setListener(this.camera);
    }
    this.renderer.render(this.scene, this.camera);
  }
  playUpdate(dt) {
    this.time += dt; const p = this.player;
    p.update(dt); this.env.update(dt, p); this.ghost.update(dt); if (this.weeping) this.weepUpdate(dt); this.fishSys.update(dt); this.fx.update(dt); this.audio.update(dt, p);
    for (const t of this.traps) t.update(dt); this.events.update(dt); this.frogs.update(dt);
    this.ambushCool -= dt;
    if (!this.ghost.hunting && this.hp < 100) { this.hpRegenT -= dt; if (this.hpRegenT <= 0) this.hp = Math.min(100, this.hp + 2 * dt); }
    $('hpBar').style.width = this.hp + '%'; $('hpTxt').textContent = Math.round(this.hp);
    // threat feedback
    this.threat = this.ghost.threat; const th = this.threat;
    $('bloodTint').style.opacity = (th * th * 0.7).toFixed(2);
    if (th > 0.25) { this.hb -= dt; if (this.hb <= 0) { this.audio.heartbeat(0.4 + th); this.hb = lerp(1.1, 0.4, th); } }
    // placement preview + interaction prompts
    const it = this.findInteractable(); let showPrev = false;
    if (it) this.ui.prompt(this.promptFor(it), true);
    else if (p.carried > 0 && !p.inHouse) { const s = this.placementSpot(); showPrev = true; this.previewMesh.position.set(s.x, WATER_Y + 0.02, s.z); this.previewMesh.rotation.y = s.yaw; this.previewMesh.material.color.setHex(s.ok ? 0x55ff77 : 0xff4444);
      this.ui.prompt(s.ok ? `<kbd>${IS_TOUCH ? 'E' : 'E / Click'}</kbd>Place trap` : null, s.ok); }
    else this.ui.prompt(null, false);
    this.previewMesh.visible = showPrev;
    // win condition
    if (p.inHouse && this.fishCollected >= this.targets.fish && this.trapsPlacedTotal >= this.targets.traps) this.win();
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.1; this.ui.update(this); }
  }
  startWeep() { // she is crying on the dike and you came close: the scene plays out while you stay free to move
    this.weeping = true; this.wT = 0; this.wF = {}; this.ghost.state = 'weepx'; this.ui.prompt(null, false);
  }
  weepUpdate(dt) {
    const t = (this.wT += dt), gh = this.ghost, p = this.player, au = this.audio, F = this.wF;
    if (t >= 4.8 && !F.cryOff) { F.cryOff = 1; au.weepStop(1.4); }
    if (!au.weepLoop && (!F.sobT || t >= F.sobT)) { if (t < 4.8) { au.sob(gh.pos); F.sobT = t + 2.2; } else F.sobT = 1e9; }
    if (t >= 0.5 && !F.say) { F.say = 1; this.ui.say('យប់ជ្រៅហើយ តើអ្នកមកយំធ្វើអ្វីនៅកន្លែងនេះ?', "It's deep night. Why are you crying here?", 4300); }
    if (t >= 4.8 && !F.stand) { F.stand = 1; gh.wAct = 'stand'; gh.wFade = 1.4; au.noise({ dur: 0.6, type: 'bandpass', freq: 900, q: 0.7, vol: 0.05, pos: gh.pos }); }
    if (t >= 5.6) gh.faceTo(p.pos, dt, t >= 9.6 ? 7 : 2.2); // once she is up she turns to look at you
    if (t >= 6.6 && !F.wipe) { F.wipe = 1; gh.wAct = 'wipe'; gh.wFade = 0.5; }
    if (t >= 8.3 && !F.gaze) { F.gaze = 1; gh.wAct = 'gaze'; gh.wFade = 1.0; au.sting(0.5); p.flicker(1.2); }
    if (t >= 8.9 && !F.smoke) { F.smoke = 1; this.fx.smokeOn(gh.pos.x, gh.pos.y, gh.pos.z, 2.8, 0.7, 1.9); au.noise({ dur: 1.6, type: 'lowpass', freq: 380, q: 0.6, vol: 0.09, pos: gh.pos }); au.sting(0.4); } // black smoke wells up around her ...
    if (t >= 9.6 && !F.morph) { F.morph = 1; gh.setForm('ghost'); gh.wRig = 'ghost'; gh.wAct = 'neckcrack'; gh.wFade = 0.2; gh.wLight = 1.5; this.ui.flash('#050508', 0.7, 320); au.cry(gh.pos); au.sting(1); p.flicker(2.5); } // ... and hides the swap into the ghost
    for (const ct of [10.65, 10.95, 11.25, 11.6]) if (t >= ct && !F['c' + ct]) { F['c' + ct] = 1; au.crack(gh.pos); }
        if (t >= 12.4) { // she hunts you now
      this.weeping = false; gh.wBob = 0; gh.wScale = 1; gh.mesh.scale.set(1, 1, 1); gh.wRig = null; gh.state = 'rush'; gh.hunting = true; gh.huntTime = 20; gh.rushTime = 0; gh.siege = 0; gh.wounded = false; gh.stagger = 0; gh.sink = 0; gh.light.intensity = 0.8;
      p.flicker(1.2); this.ui.toast('រត់!… RUN!', 2200, true);
    }
  }
  startAmbush(tr) {
    const gh = this.ghost, cam = this.camera; this.state = 'ambush'; this.ambT = 0; this.ambTrap = tr; this.ambF = {};
    this.ambBase = cam.position.clone(); this.ambQ0 = cam.quaternion.clone(); this.ambQ = cam.quaternion.clone();
    const dx = this.ambBase.x - tr.pos.x, dz = this.ambBase.z - tr.pos.z, l = Math.hypot(dx, dz) || 1; this.ambDir = V3(dx / l, 0, dz / l); // from the trap toward the player
    this.ambS = V3(tr.pos.x, 0, tr.pos.z); this.ambH = V3(this.ambBase.x - this.ambDir.x * 1.0, 0, this.ambBase.z - this.ambDir.z * 1.0); // where she rises / where she ends up in front of you
    gh.state = 'ambush'; gh.hunting = false; gh.mesh.visible = true; gh.sink = 1.8; gh.mesh.scale.set(1, 1, 1); gh.pos.set(this.ambS.x, this.env.groundY(this.ambS.x, this.ambS.z), this.ambS.z); gh.yaw = Math.atan2(dx, dz); gh.light.intensity = 0.8;
    this.ui.prompt(null, false); this.fx.splash(tr.pos.x, tr.pos.z, 10, 0.6); this.audio.gurgle(gh.pos); this.audio.splash(gh.pos, 2);
  }
  ambushUpdate(dt) { // she rises from the water, slaps you down (-50 HP), laughs, then dissolves
    const t = (this.ambT += dt), gh = this.ghost, cam = this.camera, F = this.ambF, p = this.player, env = this.env;
    const T_RISE = 1.1, T_LUNGE = 1.5, T_HIT = 1.85, T_LAUGH = 2.4, T_VAN = T_LAUGH + this.audio.laughShriekAt() + 1.3, T_END = T_VAN + 0.8, ez = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    env.update(dt, p); this.fx.update(dt); for (const tr of this.traps) tr.update(dt); this.frogs.update(dt); this.audio.update(dt, p);
    // ghost: rise -> lunge -> stand over you
    const k = ez((t - T_RISE) / (T_LUNGE - T_RISE)); gh.pos.x = this.ambS.x + (this.ambH.x - this.ambS.x) * k; gh.pos.z = this.ambS.z + (this.ambH.z - this.ambS.z) * k; gh.pos.y = env.groundY(gh.pos.x, gh.pos.z);
    gh.sink = 1.8 * (1 - ez(t / T_RISE)); gh.yaw = Math.atan2(this.ambBase.x - gh.pos.x, this.ambBase.z - gh.pos.z);
    gh.mesh.position.set(gh.pos.x, gh.pos.y - gh.sink, gh.pos.z); gh.mesh.rotation.y = gh.yaw; gh.light.intensity = 0.9 + 0.4 * Math.sin(t * 30) * (t > T_HIT ? 1 : 0);
    let act = 'stare', ges = null;
    if (t >= T_RISE && t < T_LUNGE) act = 'run'; else if (t >= T_LAUGH) act = 'laugh';
    if (t >= T_HIT - 0.2 && !F.slap) { F.slap = 1; ges = 'slap'; }
    if (t < T_VAN + 0.5 || gh.mesh.visible) gh.ambPose(dt, act, ges);
    if (t >= T_HIT && !F.hit) { F.hit = 1; this.hp = Math.max(5, this.hp - 50); this.hpRegenT = 10; this.audio.slap(gh.pos); this.audio.sting(0.8); this.ui.flash('#a00000', 1, 700); this.ui.toast('នាងទះអ្នក! ឈាមអស់ពាក់កណ្តាល · She slapped you down!', 2800); p.flicker(1.5); this.fx.splash(this.ambBase.x, this.ambBase.z, 6, 0.4); }
    if (t >= T_LAUGH && !F.laugh) { F.laugh = 1; this.audio.laugh(gh.pos); }
    // camera: watch her, get knocked to the ground, get back up
    const fall = ez((t - T_HIT) / 0.4), up = ez((t - (T_VAN + 0.2)) / 0.8), kk = fall * (1 - up);
    const tgt = t < T_HIT ? V3(gh.pos.x, 0.9 + 0.7 * ez(t / T_RISE), gh.pos.z) : V3(gh.pos.x, 1.55, gh.pos.z), eye = cam.position.clone();
    const m = new THREE.Matrix4().lookAt(eye, tgt, V3(0, 1, 0)), qt = new THREE.Quaternion().setFromRotationMatrix(m); this.ambQ.slerp(qt, 1 - Math.exp(-dt * (t < T_HIT ? 5 : 3)));
    const shake = t > T_HIT && t < T_HIT + 0.45 ? (1 - (t - T_HIT) / 0.45) * 0.07 : 0;
    cam.position.set(this.ambBase.x - this.ambDir.x * 0.0 + this.ambDir.x * 0.8 * fall + rand(-shake, shake), this.ambBase.y - 1.15 * kk + rand(-shake, shake), this.ambBase.z + this.ambDir.z * 0.8 * fall + rand(-shake, shake));
    cam.quaternion.copy(this.ambQ).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), 0.75 * kk));
    if (t >= T_VAN) gh.mesh.visible = t < T_VAN + 0.5 ? Math.random() < 0.45 : false;
    if (t >= T_END) { // back to normal play; you stay where she knocked you
      p.pos.x += this.ambDir.x * 0.8; p.pos.z += this.ambDir.z * 0.8; cam.quaternion.copy(this.ambQ0);
      gh.hide(); gh.sink = 0; gh.eventTimer = rand(25, 45); gh.huntCooldown = Math.max(gh.huntCooldown, 30);
      const tr = this.ambTrap; if (tr && tr.state === 'caught') { tr.takeFish(); tr.state = 'idle'; tr.timer = rand(20, 40); }
      this.ambushCool = 150; this.state = 'playing'; this.ui.flash('#000', 0, 1);
    }
  }
  caughtUpdate(dt) {
    this.caughtT += dt; const t = this.caughtT, s = Math.max(0, 1 - t / 1.6) * 0.06, cam = this.camera;
    cam.position.set(this.camBase.x + rand(-s, s), this.camBase.y + rand(-s, s), this.camBase.z + rand(-s, s)); cam.lookAt(this.camLook.x, this.camLook.y + 0.15 * Math.sin(t * 40) * 0.1, this.camLook.z);
    this.ghost.scareAnim(dt, t);
    this.fx.update(dt); if (t > 0.9 && t - dt <= 0.9) this.ui.flash('#000', 1, 700);
    if (t > 1.9) this.gameOver();
  }
}

window.game = new GameManager();
