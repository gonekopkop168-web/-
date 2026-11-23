// audio.js – fully procedural positional horror audio (Web Audio API)
import { rand, pick, clamp, settings } from './core.js';

export class AudioManager {
  constructor(game) { this.g = game; this.ctx = null; this.on = false; this.timers = []; this.gv = null; this.canal = null; this.hb = 0; }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = settings.volume;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(c.destination);
    const n = c.sampleRate * 3; this.noiseBuf = c.createBuffer(1, n, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.on = true; this._ambient(); this._ghostVoice(); this.loadLaugh(); this.loadCry(); this.loadSfx();
  }
  setVolume(v) { if (this.master) this.master.gain.value = v; }
  suspend() { if (this.ctx) this.ctx.suspend(); }
  resume() { if (this.ctx) this.ctx.resume(); }

  // ---- helpers ----
  _setPos(p, x, y, z) {
    if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
  }
  _pan(pos) {
    const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
    p.refDistance = 2.5; p.maxDistance = 300; p.rolloffFactor = 1.3;
    this._setPos(p, pos.x, pos.y, pos.z); p.connect(this.master); return p;
  }
  _dest(pos) { return pos ? this._pan(pos) : this.master; }
  setListener(cam) {
    if (!this.on) return; const L = this.ctx.listener, p = cam.position, e = cam.matrixWorld.elements;
    const fx = -e[8], fy = -e[9], fz = -e[10], ux = e[4], uy = e[5], uz = e[6];
    if (L.positionX) {
      L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz; L.upX.value = ux; L.upY.value = uy; L.upZ.value = uz;
    } else { L.setPosition(p.x, p.y, p.z); L.setOrientation(fx, fy, fz, ux, uy, uz); }
  }
  tone({ f = 440, f2 = null, dur = 0.3, type = 'sine', vol = 0.2, pos = null, attack = 0.01, lp = 0, delay = 0 }) {
    if (!this.on) return; const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); let out = g;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); out = f; }
    out.connect(this._dest(pos)); o.start(t); o.stop(t + dur + 0.05);
  }
  noise({ dur = 0.2, type = 'lowpass', freq = 800, freq2 = null, q = 1, vol = 0.2, pos = null, attack = 0.005, delay = 0 }) {
    if (!this.on) return; const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this._dest(pos)); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }
  // sung / wailing voice: saw + vibrato through formant filters
  voice({ f0 = 500, f1 = 650, f2 = 320, dur = 2.4, vol = 0.12, pos = null, vib = 16, formants = [900, 2500], delay = 0 }) {
    if (!this.on) return; const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur * 0.25); o.frequency.linearRampToValueAtTime(f2, t + dur);
    const l = c.createOscillator(); l.frequency.value = 5.5; const lg = c.createGain(); lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.2); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const dest = this._dest(pos);
    for (const fm of formants) { const b = c.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fm; b.Q.value = 3; o.connect(b); b.connect(g); }
    g.connect(dest); o.start(t); l.start(t); o.stop(t + dur + 0.1); l.stop(t + dur + 0.1);
  }

  // ---- ambience ----
  _ambient() {
    const c = this.ctx;
    // wind
    const w = c.createBufferSource(); w.buffer = this.noiseBuf; w.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420;
    const wg = c.createGain(); wg.gain.value = 0.09;
    const wl = c.createOscillator(); wl.frequency.value = 0.09; const wlg = c.createGain(); wlg.gain.value = 0.05; wl.connect(wlg); wlg.connect(wg.gain);
    w.connect(wf); wf.connect(wg); wg.connect(this.master); w.start(); wl.start();
    // crickets
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator(); o.frequency.value = 3800 + i * 330 + rand(0, 100);
      const g1 = c.createGain(); g1.gain.value = 0.004;
      const sq = c.createOscillator(); sq.type = 'square'; sq.frequency.value = 15 + i * 3.1; const sg = c.createGain(); sg.gain.value = 0.004; sq.connect(sg); sg.connect(g1.gain);
      const g2 = c.createGain(); g2.gain.value = 0.5;
      const gl = c.createOscillator(); gl.frequency.value = 0.22 + i * 0.13; const gg = c.createGain(); gg.gain.value = 0.5; gl.connect(gg); gg.connect(g2.gain);
      const sp = c.createStereoPanner(); sp.pan.value = -0.9 + i * 0.6;
      o.connect(g1); g1.connect(g2); g2.connect(sp); sp.connect(this.master); o.start(); sq.start(); gl.start();
    }
    // canal water (positional, follows nearest canal)
    const cs = c.createBufferSource(); cs.buffer = this.noiseBuf; cs.loop = true;
    const cf = c.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 360; cf.Q.value = 1.1; // narrow + low = gentle flowing water, not a wide hiss like rain
    const cg = c.createGain(); cg.gain.value = 0.2; this.canal = this._pan({ x: 0, y: 0, z: -80 }); this.canal.refDistance = 9; this.canal.rolloffFactor = 1.8; // quiet even right at the edge
    const cl = c.createOscillator(); cl.frequency.value = 0.17; const clg = c.createGain(); clg.gain.value = 0.04; cl.connect(clg); clg.connect(cg.gain); cl.start();
    cs.connect(cf); cf.connect(cg); cg.connect(this.canal); cs.start();
    // random events
    const loop = (fn, a, b) => { const run = () => { if (this.g.state === 'playing' || this.g.state === 'intro') fn(); this.timers.push(setTimeout(run, rand(a, b) * 1000)); }; this.timers.push(setTimeout(run, rand(a, b) * 500)); };
    loop(() => this.frog(), 0.5, 2.2); loop(() => this.dog(), 14, 34); loop(() => this.owl(), 18, 45);
  }
  _around(minR, maxR) {
    const p = this.g.camera.position, a = rand(0, 6.283), r = rand(minR, maxR);
    return { x: p.x + Math.sin(a) * r, y: 0.5, z: p.z + Math.cos(a) * r };
  }
  frog() { const pos = this._around(8, 30), n = 2 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i++) this.tone({ f: rand(140, 190), f2: 100, dur: 0.13, type: 'sawtooth', vol: 0.05, lp: 650, pos, delay: i * 0.17 }); }
  dog() { const pos = this._around(70, 100), n = 2 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i++) { this.tone({ f: 460, f2: 250, dur: 0.2, type: 'sawtooth', vol: 0.06, lp: 1100, pos, delay: i * 0.34 }); this.noise({ dur: 0.12, type: 'bandpass', freq: 900, vol: 0.04, pos, delay: i * 0.34 }); } }
  owl() { const pos = this._around(20, 45); pos.y = 8; if (this.sample('owl', pos, 1.5, 10, rand(0.96, 1.04))) return; // your owl.mp3
    this.tone({ f: 430, f2: 380, dur: 0.55, vol: 0.09, lp: 900, pos, attack: 0.08 }); this.tone({ f: 420, f2: 340, dur: 0.8, vol: 0.09, lp: 900, pos, attack: 0.08, delay: 0.75 }); }
  update(dt, player) {
    if (!this.on) return;
    if (this.canal) { const p = player.pos; // nearest canal (z=-80 line or x=80 line)
      const a = { x: p.x, z: -80 }, b = { x: 80, z: p.z };
      const da = Math.abs(p.z + 80), db = Math.abs(p.x - 80), q = da < db ? a : b; this._setPos(this.canal, q.x, 0.2, q.z); }
  }

  // ---- ghost voice (persistent, follows ghost) ----
  _ghostVoice() {
    const c = this.ctx, pan = this._pan({ x: 0, y: 0, z: 100 });
    const g = c.createGain(); g.gain.value = 0;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 92;
    const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 139;
    const v = c.createOscillator(); v.frequency.value = 4.5; const vg = c.createGain(); vg.gain.value = 8; v.connect(vg); vg.connect(o1.frequency); vg.connect(o2.frequency);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 4;
    o1.connect(bp); o2.connect(bp); bp.connect(g); g.connect(pan);
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1800; nf.Q.value = 2;
    const ng = c.createGain(); ng.gain.value = 0; n.connect(nf); nf.connect(ng); ng.connect(pan);
    o1.start(); o2.start(); v.start(); n.start();
    this.gv = { pan, g, ng, bp };
  }
  ghostVoice(pos, level, t) {
    if (!this.gv) return; const T = this.ctx.currentTime;
    this._setPos(this.gv.pan, pos.x, pos.y + 1.4, pos.z);
    this.gv.g.gain.setTargetAtTime(level * 0.2, T, 0.12);
    this.gv.ng.gain.setTargetAtTime(level * 0.1 * (0.5 + 0.5 * Math.sin(t * 2.3)), T, 0.1);
    this.gv.bp.frequency.setTargetAtTime(420 + 260 * Math.sin(t * 0.8), T, 0.1);
  }

  // ---- one-shots ----
  step(surface, run) {
    const v = run ? 1.3 : 1;
    if (surface === 'wood') { this.noise({ dur: 0.1, freq: 650, vol: 0.18 * v }); this.tone({ f: 95, f2: 60, dur: 0.12, vol: 0.2 * v }); }
    else if (surface === 'water') { if (this.sample('water_step', null, 0.8 * v, 4, (run ? 1.2 : 1) * rand(0.94, 1.06))) return; this.noise({ dur: 0.28, type: 'bandpass', freq: 500, freq2: 250, q: 0.8, vol: 0.2 * v }); this.tone({ f: 220, f2: 70, dur: 0.12, vol: 0.06 }); this.noise({ dur: 0.18, type: 'highpass', freq: 2500, vol: 0.05 * v, delay: 0.05 }); }
    else this.noise({ dur: 0.14, freq: 900, freq2: 350, vol: 0.14 * v });
  }
  splash(pos, big = 1) {
    const now = this.ctx ? this.ctx.currentTime : 0; if (this.sfx && this.sfx.splash) { if (now - (this._spT || -9) < 0.2) return; this._spT = now; if (this.sample('splash', pos, Math.min(1.7, 0.55 + 0.6 * big), 5, rand(0.93, 1.07) * (big < 0.7 ? 1.18 : 1))) return; } // your splash.mp3 (small splashes play it faster/quieter)
    this.noise({ dur: 0.45 * big, type: 'bandpass', freq: 1800, freq2: 400, q: 0.7, vol: 0.2, pos }); this.tone({ f: 300, f2: 90, dur: 0.2, vol: 0.1, pos }); }
  flop(pos) { this.splash(pos, 0.6); this.noise({ dur: 0.1, freq: 1200, vol: 0.12, pos, delay: 0.14 }); }
  place(pos) { this.noise({ dur: 0.2, type: 'bandpass', freq: 2200, q: 1.5, vol: 0.12, pos }); this.splash(pos, 0.9); }
  pickup() { this.tone({ f: 520, f2: 760, dur: 0.12, type: 'triangle', vol: 0.12 }); this.noise({ dur: 0.08, type: 'highpass', freq: 3000, vol: 0.06 }); }
  click() { this.tone({ f: 1400, f2: 700, dur: 0.04, type: 'square', vol: 0.06 }); }
  door(pos) { this.tone({ f: 190, f2: 120, dur: 0.9, type: 'sawtooth', vol: 0.07, lp: 500, attack: 0.15, pos }); this.noise({ dur: 0.5, freq: 300, vol: 0.08, pos }); }
  knock(pos) { for (let i = 0; i < 3; i++) { this.tone({ f: 120, f2: 70, dur: 0.12, vol: 0.45, pos, delay: i * 0.28 }); this.noise({ dur: 0.08, freq: 500, vol: 0.2, pos, delay: i * 0.28 }); } }
  cry(pos) { this.voice({ f0: 520, f1: 700, f2: 300, dur: 2.8, vol: 0.14, pos, vib: 22 }); this.voice({ f0: 530, f1: 690, f2: 310, dur: 2.8, vol: 0.06, pos, vib: 28, delay: 0.05, formants: [1300, 3000] }); }
  whisper(pos) { const n = 4 + Math.floor(rand(0, 3));
    for (let i = 0; i < n; i++) this.noise({ dur: rand(0.12, 0.25), type: 'bandpass', freq: rand(2200, 4200), q: 3, vol: 0.13, pos, attack: 0.03, delay: i * rand(0.2, 0.32) }); }
  breath(pos) { for (let i = 0; i < 2; i++) { this.noise({ dur: 0.7, type: 'bandpass', freq: 700, freq2: 1100, q: 1, vol: 0.16, pos, attack: 0.35, delay: i * 1.5 }); this.noise({ dur: 0.8, type: 'bandpass', freq: 1000, freq2: 500, q: 1, vol: 0.12, pos, attack: 0.1, delay: i * 1.5 + 0.75 }); } }
  stepsBehind(from, back, n = 7) {
    for (let i = 0; i < n; i++) { const d = 7 - i * 0.55, pos = { x: from.x + back.x * d, y: 0.1, z: from.z + back.z * d };
      this.noise({ dur: 0.2, type: 'bandpass', freq: 450, q: 0.8, vol: 0.28, pos, delay: i * 0.55 }); this.tone({ f: 110, f2: 55, dur: 0.12, vol: 0.14, pos, delay: i * 0.55 }); } }
  playerBreath(level) { this.noise({ dur: 0.55, type: 'bandpass', freq: 900, freq2: 600, q: 0.9, vol: 0.09 * level, attack: 0.2 }); }
  heartbeat(level) { if (this.sample('heartbeat', null, Math.min(1.5, 0.55 + 0.85 * level), 4, clamp(0.9 + 0.45 * level, 0.95, 1.5))) return; this.tone({ f: 62, f2: 40, dur: 0.16, vol: 0.4 * level }); this.tone({ f: 55, f2: 38, dur: 0.14, vol: 0.26 * level, delay: 0.2 }); }
  jumpscare() {
    this.noise({ dur: 1.3, type: 'lowpass', freq: 6000, freq2: 300, vol: 0.9, attack: 0.01 });
    this.tone({ f: 55, f2: 28, dur: 1.5, vol: 0.9, attack: 0.01 });
    this.voice({ f0: 800, f1: 1750, f2: 1000, dur: 1.5, vol: 0.5, vib: 60, formants: [1200, 3000] });
    this.tone({ f: 940, f2: 1900, dur: 1.2, type: 'sawtooth', vol: 0.25, lp: 4000 });
  }
  ribbit(pos) { const n = 2 + Math.floor(rand(0, 3)); for (let i = 0; i < n; i++) this.tone({ f: rand(120, 170), f2: 90, dur: 0.14, type: 'sawtooth', vol: 0.09, lp: 600, pos, delay: i * 0.16 }); }
  hop(pos) { this.noise({ dur: 0.06, type: 'bandpass', freq: 900, q: 1, vol: 0.05, pos }); }
  sting(v = 0.5) { this.tone({ f: 70, f2: 45, dur: 1.6, vol: 0.5 * v, attack: 0.02 }); this.tone({ f: 466, f2: 440, dur: 1.4, type: 'sawtooth', vol: 0.06 * v, lp: 1200, attack: 0.05 }); this.tone({ f: 493, f2: 466, dur: 1.4, type: 'sawtooth', vol: 0.05 * v, lp: 1200, attack: 0.05 }); }
  gurgle(pos) { for (let i = 0; i < 5; i++) this.tone({ f: rand(250, 500), f2: rand(600, 1000), dur: 0.12, vol: 0.09, pos, delay: i * rand(0.12, 0.25), lp: 1500 }); this.noise({ dur: 1.4, type: 'bandpass', freq: 400, freq2: 900, q: 1.5, vol: 0.12, pos, attack: 0.3 }); }
  scrape(pos) { this.noise({ dur: 1.3, type: 'bandpass', freq: 500, freq2: 250, q: 3, vol: 0.14, pos, attack: 0.3 }); this.tone({ f: 130, f2: 90, dur: 1.2, type: 'sawtooth', vol: 0.04, lp: 400, pos }); }
  fishJump(pos) { this.noise({ dur: 0.18, type: 'bandpass', freq: 1500, q: 1, vol: 0.12, pos }); this.splash(pos, 1); this.splash(pos, 0.5); }
  sob(pos) { this.voice({ f0: 430, f1: 360, f2: 300, dur: 0.6, vol: 0.1, pos, vib: 20, formants: [800, 2200] }); this.voice({ f0: 400, f1: 340, f2: 290, dur: 0.45, vol: 0.08, pos, vib: 22, delay: 0.7, formants: [800, 2200] }); this.noise({ dur: 0.35, type: 'bandpass', freq: 1200, q: 1, vol: 0.04, pos, delay: 1.3 }); }
  crack(pos) { this.noise({ dur: 0.05, type: 'bandpass', freq: 2200, q: 2, vol: 0.45, pos }); this.noise({ dur: 0.09, type: 'lowpass', freq: 420, vol: 0.4, pos, delay: 0.03 }); this.tone({ f: 170, f2: 70, dur: 0.1, vol: 0.3, pos, type: 'square', lp: 600 }); }
  slap(pos) { if (this.sample('slap', pos, 1.7, 4)) { this.splash(pos, 0.8); return; } this.noise({ dur: 0.18, type: 'bandpass', freq: 2600, freq2: 700, q: 0.8, vol: 0.5, pos }); this.tone({ f: 140, f2: 50, dur: 0.35, vol: 0.55, pos }); this.noise({ dur: 0.5, type: 'lowpass', freq: 500, vol: 0.35, pos, delay: 0.05 }); this.splash(pos, 1.2); }
  loadSfx() { // assets/flash.mp3, door_open.mp3, door_close.mp3 (your recordings); each falls back to the synthesized sound if it cannot load
    this.sfx = this.sfx || {}; if (!this.ctx) return;
    for (const n of ['flash', 'door_open', 'door_close', 'splash', 'water_step', 'heartbeat', 'owl', 'slap']) { if (this.sfx[n] || this['_ld_' + n]) continue; this['_ld_' + n] = true;
      fetch(`assets/${n}.mp3`).then((r) => r.arrayBuffer()).then((b) => new Promise((res, rej) => this.ctx.decodeAudioData(b, res, rej))).then((buf) => { this.sfx[n] = buf; }).catch((e) => { this['_ld_' + n] = false; console.warn(`[audio] ${n}.mp3 not loaded, using synthesized sound`, e); }); }
  }
  sample(n, pos, vol = 1, ref = 4, rate = 1) { // true when the recorded sample was played
    const b = this.sfx && this.sfx[n]; if (!this.on || !b) return false; const c = this.ctx, s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = vol; s.connect(g);
    if (pos) { const pn = this._dest(pos); pn.refDistance = ref; g.connect(pn); } else g.connect(this.master); s.start(); return true;
  }
  flashSfx() { if (!this.sample('flash', null, 0.9)) this.click(); }
  doorOpen(pos) { if (!this.sample('door_open', pos, 1.3)) this.door(pos); }
  doorClose(pos) { if (!this.sample('door_close', pos, 1.3)) this.door(pos); }
  loadCry() { // assets/cry.mp3 = the weeping woman's sobbing (loops while she sits on the dike)
    if (this.cryBuf || this.cryLoading || !this.ctx) return; this.cryLoading = true;
    fetch('assets/cry.mp3').then((r) => r.arrayBuffer()).then((b) => new Promise((res, rej) => this.ctx.decodeAudioData(b, res, rej))).then((buf) => { this.cryBuf = buf; }).catch((e) => { this.cryLoading = false; console.warn('[audio] cry.mp3 not loaded, using synthesized sobbing', e); });
  }
  weepStart(pos) { if (!this.on || !this.cryBuf || this.weepLoop) return; const c = this.ctx, s = c.createBufferSource(), g = c.createGain(); s.buffer = this.cryBuf; s.loop = true; g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(1.8, c.currentTime + 1.5); const pn = this._dest(pos); pn.refDistance = 5; pn.rolloffFactor = 0.6; s.connect(g); g.connect(pn); s.start(0, Math.random() * Math.max(0, this.cryBuf.duration - 1)); this.weepLoop = { s, g }; }
  weepStop(fade = 1) { const w = this.weepLoop; if (!w) return; this.weepLoop = null; const c = this.ctx; try { w.g.gain.cancelScheduledValues(c.currentTime); w.g.gain.setValueAtTime(w.g.gain.value, c.currentTime); w.g.gain.linearRampToValueAtTime(0.0001, c.currentTime + fade); w.s.stop(c.currentTime + fade + 0.1); } catch (e) {} }
  loadLaugh() { // assets/laugh.mp3 replaces the synthesized cackle (the final shriek stays procedural)
    if (this.laughBuf || this.laughLoading || !this.ctx) return; this.laughLoading = true;
    fetch('assets/laugh.mp3').then((r) => r.arrayBuffer()).then((b) => new Promise((res, rej) => this.ctx.decodeAudioData(b, res, rej))).then((buf) => { this.laughBuf = buf; }).catch((e) => { this.laughLoading = false; console.warn('[audio] laugh.mp3 not loaded, using synthesized laugh', e); });
  }
  laughShriekAt() { return this.laughBuf ? Math.max(1.5, this.laughBuf.duration - 0.4) : 2.5; } // when the closing shriek starts, seconds after the laugh starts
  laugh(pos) {
    if (!this.on) return; const c = this.ctx;
    if (this.laughBuf) { const s = c.createBufferSource(), g = c.createGain(); s.buffer = this.laughBuf; g.gain.value = 1.6; s.connect(g); g.connect(this._dest(pos)); s.start(); }
    else for (let i = 0; i < 9; i++) { const up = 1 + i * 0.03; this.voice({ f0: 500 * up, f1: (600 + rand(-40, 60)) * up, f2: 340, dur: 0.26, vol: 0.17, pos, vib: 14, delay: i * 0.27, formants: [i % 2 ? 700 : 1100, 2600] }); this.voice({ f0: 250 * up, f1: 310 * up, f2: 170, dur: 0.28, vol: 0.09, pos, vib: 10, delay: i * 0.27 + 0.02, formants: [500, 1500] }); }
    this.voice({ f0: 300, f1: 780, f2: 240, dur: 1.5, vol: 0.13, pos, vib: 34, delay: this.laughShriekAt() }); // the long shriek at the end (unchanged)
  }
  win() { [262, 330, 392, 523].forEach((f, i) => this.tone({ f, dur: 2.2, vol: 0.1, attack: 0.3, delay: i * 0.35, lp: 1500 })); }
}
