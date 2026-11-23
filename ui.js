// ui.js – menus, HUD, toasts, screens, cinematic overlays
import { $, IS_TOUCH, settings, saveSettings } from './core.js';
import { FISH_TYPES } from './fishing.js';

export class UIManager {
  constructor(game) {
    this.g = game; this.cache = {}; this.toastT = null; this.screens = ['loading', 'menu', 'settings', 'howto', 'pause', 'intro', 'gameover', 'victory']; this.prev = 'menu';
    if (IS_TOUCH) $('touch').classList.remove('hidden');
    $('touch').classList.add('hidden');
    $('setVolume').value = settings.volume; $('setSens').value = settings.sens; $('setQuality').value = settings.quality;
    $('setVolume').oninput = (e) => { settings.volume = +e.target.value; saveSettings(); game.audio.setVolume(settings.volume); };
    $('setSens').oninput = (e) => { settings.sens = +e.target.value; saveSettings(); game.controls.pointerSpeed = settings.sens; };
    $('setQuality').onchange = (e) => { settings.quality = e.target.value; saveSettings(); if (game.built) { $('qualityHint').textContent = '⚠ Reload the page to apply the new graphics quality.'; } };
    $('btnStart').onclick = () => game.startNewGame();
    $('btnSettings').onclick = () => { this.prev = 'menu'; this.show('settings'); };
    $('btnPauseSettings').onclick = () => { this.prev = 'pause'; this.show('settings'); };
    $('btnSettingsBack').onclick = () => this.show(this.prev);
    $('btnHow').onclick = () => this.show('howto'); $('btnHowBack').onclick = () => this.show('menu');
    $('btnResume').onclick = () => game.resume(); $('btnPause').onclick = () => game.pause();
    $('btnRestart').onclick = () => game.startNewGame(); $('btnToMenu').onclick = () => game.toMenu();
    $('btnRetry').onclick = () => game.startNewGame(); $('btnDeadMenu').onclick = () => game.toMenu();
    $('btnPlayAgain').onclick = () => game.startNewGame(); $('btnWinMenu').onclick = () => game.toMenu();
    $('introSkip').onclick = () => game.skipIntro(); $('intro').addEventListener('pointerdown', () => game.skipIntro());
    this.grain();
  }
  say(kh, en, ms = 4000) { // on-screen line that "types" itself
    const box = $('dialog'), a = $('dlgKh'), b = $('dlgEn'); clearInterval(this._dt); clearTimeout(this._dh);
    const seg = window.Intl && Intl.Segmenter ? [...new Intl.Segmenter('km', { granularity: 'grapheme' }).segment(kh)].map(x => x.segment) : Array.from(kh); a.textContent = ''; b.textContent = en || ''; box.classList.add('show'); let i = 0;
    this._dt = setInterval(() => { a.textContent = seg.slice(0, ++i).join(''); if (i >= seg.length) clearInterval(this._dt); }, 70); this._dh = setTimeout(() => box.classList.remove('show'), ms);
  }
  loadProgress(p, text) { // horror loading screen: running line + percentage
    p = Math.max(0, Math.min(100, p)); this.lp = Math.max(this.lp || 0, p); if (text) $('loadText').textContent = text;
    if (!this._lt) { const tip = ['កុំសម្លឹងមើលនាងយូរពេក… Do not stare at her for long', 'ដូនតាស្រែ នៅតែមើលអ្នក… The field is watching', 'បិទពិល ពេលឮសំឡេង… Kill the light when you hear it', 'រត់ទៅផ្ទះ… If she runs, you run', 'ទឹកស្រែនៅពេលយប់ មិនមែនស្ងាត់ទេ… The water is never quiet'];
      let i = 0; $('loadHint').textContent = tip[0]; setInterval(() => { i = (i + 1) % tip.length; $('loadHint').textContent = tip[i]; }, 3200);
      this._lt = setInterval(() => { this.lshow = (this.lshow || 0) + ((this.lp || 0) - (this.lshow || 0)) * 0.12; const v = Math.round(this.lshow); $('loadPct').textContent = v + '%'; $('loadFill').style.width = this.lshow.toFixed(1) + '%'; }, 40); }
  }
  show(id) { for (const s of this.screens) $(s).classList.toggle('active', s === id); }
  hideAll() { this.show(null); }
  hud(on) { $('hud').classList.toggle('hidden', !on); if (IS_TOUCH) $('touch').classList.toggle('hidden', !on); }
  set(id, v, prop = 'textContent') { if (this.cache[id + prop] !== v) { this.cache[id + prop] = v; $(id)[prop] = v; } }
  toast(text, ms = 2800, scary = false) {
    const t = $('toast'); t.textContent = text; t.classList.toggle('scary', scary); t.classList.add('show');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => t.classList.remove('show'), ms);
  }
  prompt(text, act) {
    const p = $('prompt'); if (this.cache.pr !== text) { this.cache.pr = text; p.innerHTML = text ? text : ''; p.classList.toggle('show', !!text); }
    $('crosshair').classList.toggle('act', !!act);
  }
  flash(color = '#fff', a = 1, ms = 250) { const f = $('flash'); f.style.background = color; f.style.transition = 'none'; f.style.opacity = a; requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms`; f.style.opacity = 0; }); }
  fade(on) { $('introFade').style.opacity = on ? 1 : 0; }
  introText(html) { const t = $('introText'); t.classList.remove('show'); if (html) setTimeout(() => { t.innerHTML = html; t.classList.add('show'); }, 450); }
  grain() {
    const c = $('grain'), x = c.getContext('2d'); c.width = 160; c.height = 90; const img = x.createImageData(160, 90); let n = 0;
    const draw = () => { if (++n % 2 === 0) { for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } x.putImageData(img, 0, 0); } requestAnimationFrame(draw); };
    draw();
  }
  update(g) {
    const p = g.player, T = g.targets;
    this.set('fishCount', `${g.fishCollected}/${T.fish}`); this.set('trapCount', `${g.trapsPlacedTotal}/${T.traps}`);
    $('fishCount').classList.toggle('done', g.fishCollected >= T.fish); $('trapCount').classList.toggle('done', g.trapsPlacedTotal >= T.traps);
    const ready = g.fishCollected >= T.fish && g.trapsPlacedTotal >= T.traps; this.set('returnState', ready ? 'GO HOME' : '—');
    this.set('objective', g.objective());
    $('batteryBar').style.width = p.battery + '%'; $('batteryBar').classList.toggle('low', p.battery < 20);
    $('staminaBar').style.width = p.stamina + '%'; $('staminaBar').classList.toggle('low', p.exhausted);
    this.set('batteryTxt', p.hasFlashlight ? Math.round(p.battery) + '%' : '—');
    $('slotFlash').classList.toggle('off', !p.hasFlashlight); $('slotFlash').classList.toggle('on', p.flashOn);
    this.set('invTraps', String(p.carried)); this.set('invFish', String(g.fishCollected));
    const c = g.fishByType, parts = Object.keys(FISH_TYPES).filter(k => c[k]).map(k => `${FISH_TYPES[k].km} ×${c[k]}`);
    this.set('invFishDetail', parts.join(' · '));
  }
}
