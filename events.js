// events.js – non-ghost horror events (shadows, jumping fish, moving traps, canal sounds) + per-event cooldowns
import { THREE, V3, rand, clamp, pick, HALF, WATER_Y } from './core.js';
import { makeFishMesh } from './fishing.js';

const COOLDOWN = { cry: 18, whisper: 20, steps: 28, breath: 25, rice: 22, flicker: 16, knock: 30, distant: 50, path: 70, tree: 60, shadow: 50, fishjump: 30, trapmove: 75, canal: 35, behind: 80, watch: 55, creep: 75, ricehide: 60, hunt: 0 };

export class HorrorEvents {
  constructor(game) {
    this.g = game; this.time = 0; this.next = {}; this.shadow = null; this.jump = null; this.jumpMeshes = {};
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); // silhouette texture
    x.fillStyle = '#000'; x.beginPath(); x.arc(32, 22, 11, 0, 6.3); x.fill(); x.fillRect(22, 32, 20, 52); x.beginPath(); x.ellipse(32, 52, 17, 15, 0, 0, 6.3); x.fill();
    x.fillRect(18, 28, 5, 70); x.fillRect(41, 28, 5, 70); x.beginPath(); x.moveTo(20, 80); x.lineTo(44, 80); x.lineTo(50, 126); x.lineTo(14, 126); x.fill();
    const t = new THREE.CanvasTexture(c); this.shadowMat = new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, color: 0x000000 });
    this.shadowSpr = new THREE.Sprite(this.shadowMat); this.shadowSpr.scale.set(1.1, 2.2, 1); this.shadowSpr.visible = false; game.scene.add(this.shadowSpr);
  }
  reset() { this.next = {}; this.time = 0; this.shadow = null; this.shadowSpr.visible = false; if (this.jump) { this.jump.m.visible = false; this.jump = null; } }
  ready(k) { return this.time >= (this.next[k] || 0); }
  mark(k) { this.next[k] = this.time + (COOLDOWN[k] || 15) * rand(0.9, 1.4); }

  // returns true if the event could actually run
  trigger(k) {
    const g = this.g, p = g.player.pos, au = g.audio;
    switch (k) {
      case 'shadow': { // dark figure drifting across the paddies at the edge of the fog
        g.camera.getWorldDirection(this._f || (this._f = V3())); const f = this._f, base = Math.atan2(f.x, f.z) + (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 0.9), d = rand(20, 32);
        const x = p.x + Math.sin(base) * d, z = p.z + Math.cos(base) * d; if (Math.abs(x) > HALF - 3 || Math.abs(z) > HALF - 3) return false;
        const dir = Math.random() < 0.5 ? 1 : -1; this.shadow = { t: 0, dur: 5, x, z, vx: -Math.cos(base) * dir * 1.6, vz: Math.sin(base) * dir * 1.6 }; this.shadowSpr.visible = true; return true;
      }
      case 'fishjump': {
        for (let i = 0; i < 12; i++) { const a = rand(0, 6.28), r = rand(3.5, 10), x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r; if (!g.env.isWaterAt(x, z, 0.5)) continue;
          const type = pick(['snakehead', 'catfish', 'small', 'small']), m = this.jumpMeshes[type] || (this.jumpMeshes[type] = (() => { const q = makeFishMesh(type); g.scene.add(q); q.visible = false; return q; })());
          this.jump = { m, t: 0, dur: 0.9, x, z, a: rand(0, 6.28) }; m.visible = true; g.fx.splash(x, z, 8, 1); au.fishJump({ x, y: 0.1, z }); return true; }
        return false;
      }
      case 'trapmove': {
        const c = g.traps.filter(t => (t.state === 'idle' || t.state === 'caught') && !t.slide && Math.hypot(t.pos.x - p.x, t.pos.z - p.z) < 70); if (!c.length) return false;
        const t = pick(c); if (!t.nudge()) return false; au.scrape({ x: t.pos.x, y: 0.2, z: t.pos.z }); return true;
      }
      case 'canal': {
        const a = { x: clamp(p.x, -80, 80), z: -80 }, b = { x: 80, z: clamp(p.z, -80, 80) }, q = Math.hypot(a.x - p.x, a.z - p.z) < Math.hypot(b.x - p.x, b.z - p.z) ? a : b;
        au.gurgle({ x: q.x, y: 0.2, z: q.z }); g.fx.ripple(q.x, q.z, 1.5, 2); return true;
      }
    }
    return false;
  }
  update(dt) {
    this.time += dt; const g = this.g;
    if (this.shadow) { const s = this.shadow; s.t += dt; s.x += s.vx * dt; s.z += s.vz * dt; const k = s.t / s.dur, a = Math.sin(Math.min(1, k) * Math.PI) * 0.55;
      this.shadowSpr.position.set(s.x, g.env.groundY(s.x, s.z) + 1.1 + Math.sin(s.t * 6) * 0.03, s.z); this.shadowMat.opacity = a; if (k >= 1) { this.shadow = null; this.shadowSpr.visible = false; } }
    if (this.jump) { const j = this.jump; j.t += dt; const k = j.t / j.dur;
      if (k >= 1) { g.fx.splash(j.x, j.z, 6, 0.8); g.audio.splash({ x: j.x, y: 0.1, z: j.z }, 0.6); j.m.visible = false; this.jump = null; }
      else { const dx = Math.cos(j.a) * k * 1.2, dz = Math.sin(j.a) * k * 1.2; j.m.position.set(j.x + dx, WATER_Y + Math.sin(k * Math.PI) * 0.75, j.z + dz); j.m.rotation.set(0, -j.a, Math.cos(k * Math.PI) * 1.0 * 1); j.m.userData.tail.rotation.y = Math.sin(j.t * 40) * 0.7; } }
  }
}
