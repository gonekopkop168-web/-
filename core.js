// core.js – shared utilities, constants, settings and procedural textures
import * as THREE from 'three';
export { THREE };

export const rand = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const $ = (id) => document.getElementById(id);
export const wchoice = (items) => {
  let t = 0; for (const i of items) t += i.w;
  let r = Math.random() * t;
  for (const i of items) { r -= i.w; if (r <= 0) return i.k; }
  return items[0].k;
};
export const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export const settings = Object.assign(
  { volume: 0.8, sens: 1, quality: IS_TOUCH ? 'low' : 'high' },
  (() => { try { return JSON.parse(localStorage.getItem('mf_settings') || '{}'); } catch (e) { return {}; } })()
);
export const saveSettings = () => { try { localStorage.setItem('mf_settings', JSON.stringify(settings)); } catch (e) {} };

// ---- world constants ----
export const HALF = 84;                       // playable half-size
export const DIKES = [-70, -50, -30, -10, 10, 30, 50, 70];
export const DIKE_HW = 0.65;                  // dike half width
export const FLOOR_Y = 1.1;                   // house floor
export const DRY_Y = 0.3;                     // dikes / yard top
export const MUD_Y = -0.1;                    // standing height in paddy
export const WATER_Y = 0.1;
export const HOUSE = { x0: -4, x1: 4, z0: -3, z1: 3 };

// ---- procedural textures ----
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function texFrom(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}
export function woodTexture(base = '#4a3220', rx = 1, ry = 1) {
  const c = mk(256, 256), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  const n = 6, pw = 256 / n;
  for (let i = 0; i < n; i++) {
    const sh = rand(-0.18, 0.18);
    g.fillStyle = sh > 0 ? `rgba(255,220,180,${sh})` : `rgba(0,0,0,${-sh})`;
    g.fillRect(i * pw, 0, pw, 256);
    for (let k = 0; k < 36; k++) {
      g.strokeStyle = `rgba(20,10,5,${rand(0.05, 0.25)})`; g.lineWidth = rand(0.5, 1.6);
      const x = i * pw + rand(2, pw - 2);
      g.beginPath(); g.moveTo(x, 0);
      g.bezierCurveTo(x + rand(-4, 4), 80, x + rand(-4, 4), 170, x + rand(-3, 3), 256); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(i * pw, 0, 1.6, 256);
  }
  return texFrom(c, rx, ry);
}
export function mudTexture(base = '#2a2116', grass = false, rx = 1, ry = 1) {
  const c = mk(256, 256), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3500; i++) {
    const v = Math.floor(rand(20, 70));
    g.fillStyle = `rgba(${v + 10},${v},${v - 10},${rand(0.2, 0.6)})`;
    g.fillRect(rand(0, 256), rand(0, 256), rand(1, 4), rand(1, 4));
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(0,0,0,${rand(0.08, 0.2)})`;
    g.beginPath(); g.ellipse(rand(0, 256), rand(0, 256), rand(8, 28), rand(5, 16), rand(0, 3), 0, 6.3); g.fill();
  }
  if (grass) for (let i = 0; i < 700; i++) {
    g.strokeStyle = `rgba(${Math.floor(rand(30, 60))},${Math.floor(rand(60, 100))},25,${rand(0.3, 0.7)})`;
    const x = rand(0, 256), y = rand(0, 256); g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-3, 3), y - rand(3, 9)); g.stroke();
  }
  return texFrom(c, rx, ry);
}
export function clothTexture() {
  const c = mk(128, 256), g = c.getContext('2d');
  g.fillStyle = '#d9d2bf'; g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${Math.floor(rand(60, 110))},${Math.floor(rand(40, 70))},${Math.floor(rand(20, 40))},${rand(0.08, 0.3)})`;
    g.beginPath(); g.ellipse(rand(0, 128), rand(0, 256), rand(4, 22), rand(8, 40), 0, 0, 6.3); g.fill();
  }
  for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(90,0,0,${rand(0.1, 0.35)})`; g.fillRect(rand(0, 128), rand(100, 256), rand(1, 4), rand(20, 90)); }
  return texFrom(c, 1, 1);
}
export function glowTexture(inner = 'rgba(255,255,255,1)', size = 64) {
  const c = mk(size, size), g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.4, inner.replace(/[\d.]+\)$/, '0.35)')); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return texFrom(c, 1, 1);
}
export function fogTexture() {
  const c = mk(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(200,215,235,.9)'); gr.addColorStop(0.5, 'rgba(180,200,225,.35)'); gr.addColorStop(1, 'rgba(160,180,210,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return texFrom(c, 1, 1);
}
export function waterNormalTexture(N = 128) {
  const c = mk(N, N), g = c.getContext('2d'), img = g.createImageData(N, N), TP = Math.PI * 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    const dU = 0.5 * Math.cos(TP * (3 * u + 2 * v)) * 3 * TP + 0.3 * Math.cos(TP * (-5 * u + 4 * v) + 1) * -5 * TP + 0.2 * Math.cos(TP * (7 * u + 9 * v) + 2) * 7 * TP;
    const dV = 0.5 * Math.cos(TP * (3 * u + 2 * v)) * 2 * TP + 0.3 * Math.cos(TP * (-5 * u + 4 * v) + 1) * 4 * TP + 0.2 * Math.cos(TP * (7 * u + 9 * v) + 2) * 9 * TP;
    const s = 0.04, nx = -dU * s, ny = -dV * s, l = Math.hypot(nx, ny, 1), i = (y * N + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return texFrom(c, 1, 1, false);
}
export function moonEnvTexture() {
  const c = mk(512, 256), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#16223c'); gr.addColorStop(0.5, '#0a111e'); gr.addColorStop(1, '#030507');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  const mg = g.createRadialGradient(150, 70, 0, 150, 70, 40);
  mg.addColorStop(0, '#ffffff'); mg.addColorStop(0.3, 'rgba(200,220,255,.8)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mg; g.fillRect(90, 10, 120, 120);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

// colored non-indexed geometry (for merging into one draw call)
export function colored(geo, hex, matrix) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (matrix) g.applyMatrix4(matrix);
  g.deleteAttribute('uv');
  const n = g.attributes.position.count, arr = new Float32Array(n * 3), c = new THREE.Color(hex);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
