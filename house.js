// house.js – the old Cambodian wooden stilt house (procedural)
import { THREE, V3, woodTexture, FLOOR_Y, MUD_Y } from './core.js';

export function buildHouse(env) {
  const scene = env.scene, grp = new THREE.Group(); scene.add(grp);
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture('#4b3321', 2, 1), roughness: 0.9 });
  const woodDark = new THREE.MeshStandardMaterial({ map: woodTexture('#2e1f14', 2, 1), roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ map: woodTexture('#3d2a1b', 3, 3), roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3428, roughness: 0.6, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 });

  const box = (w, h, d, mat, x, y, z, parent = grp, cast = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
    m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  };
  const addCol = (x0, x1, z0, z1, extra = {}) => { const c = Object.assign({ x0, x1, z0, z1 }, extra); env.boxes.push(c); return c; };

  // stilts + floor
  for (const x of [-3.7, 0, 3.7]) for (const z of [-2.7, 0, 2.7]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, FLOOR_Y + 0.15, 8), woodDark);
    p.position.set(x, (FLOOR_Y - 0.15) / 2, z); p.castShadow = true; grp.add(p);
  }
  box(8.4, 0.16, 6.4, floorMat, 0, FLOOR_Y - 0.08, 0);
  box(8.4, 0.06, 6.4, woodDark, 0, FLOOR_Y + 2.62, 0, grp, false); // ceiling

  // stairs (6 steps) + rails
  for (let i = 0; i < 6; i++) {
    const top = FLOOR_Y - 0.8 * (i + 1) / 6, h = top + 0.15;
    box(1.9, h, 0.3, wood, 0, (top - 0.15) / 2 + 0.0, 3 + 0.3 * i + 0.15);
  }
  for (const sx of [-1, 1]) {
    const rail = box(0.06, 0.06, 2.0, wood, sx * 1.0, (FLOOR_Y + 0.3) / 2 + 0.9, 3.9); rail.rotation.x = Math.atan2(0.8, 1.8);
    box(0.07, 1.3, 0.07, wood, sx * 1.0, 0.6, 3.1); box(0.07, 0.9, 0.07, wood, sx * 1.0, 0.3, 4.75);
    addCol(sx * 1.0 - 0.06, sx * 1.0 + 0.06, 3.0, 4.85);
  }

  // walls with window holes. axis 'x' runs along x at z=fixed; 'z' runs along z at x=fixed
  const H = 2.6, sill = 1.0, head = 2.0, ww = 0.9, T = 0.14;
  function wall(axis, fixed, a, b, wins) {
    const B = (s0, s1, y0, y1) => {
      if (s1 - s0 < 0.01) return; const len = s1 - s0, mid = (s0 + s1) / 2, hh = y1 - y0, yc = FLOOR_Y + (y0 + y1) / 2;
      if (axis === 'x') box(len, hh, T, wood, mid, yc, fixed); else box(T, hh, len, wood, fixed, yc, mid);
    };
    if (!wins.length) B(a, b, 0, H);
    else {
      B(a, b, 0, sill); B(a, b, head, H);
      let cur = a; for (const cw of wins) { B(cur, cw - ww / 2, sill, head); cur = cw + ww / 2; } B(cur, b, sill, head);
      for (const cw of wins) { // frame, bars, half-open shutter
        const yc = FLOOR_Y + (sill + head) / 2;
        for (const k of [-0.25, 0, 0.25]) {
          if (axis === 'x') box(0.03, 1.0, 0.03, dark, cw + k, yc, fixed); else box(0.03, 1.0, 0.03, dark, fixed, yc, cw + k);
        }
        const sh = box(axis === 'x' ? 0.42 : 0.03, 1.0, axis === 'x' ? 0.03 : 0.42, woodDark, axis === 'x' ? cw + ww / 2 + 0.1 : fixed + (fixed > 0 ? 0.2 : -0.2), yc, axis === 'x' ? fixed + (fixed > 0 ? 0.2 : -0.2) : cw + ww / 2 + 0.1);
        sh.rotation.y = axis === 'x' ? 0.9 : -0.9;
      }
    }
    if (axis === 'x') addCol(a, b, fixed - 0.16, fixed + 0.16); else addCol(fixed - 0.16, fixed + 0.16, a, b);
  }
  wall('x', -3, -4, 4, [-1.6, 1.6]);
  wall('z', -4, -3, 3, [-1.2, 1.2]);
  wall('z', 4, -3, 3, [-1.2, 1.2]);
  wall('x', 3, -4, -0.7, [-2.4]);
  wall('x', 3, 0.7, 4, [2.4]);
  box(1.4, 0.5, T, wood, 0, FLOOR_Y + 2.35, 3); // lintel

  // roof (ridge along z) + gables
  const rise = 1.96, th = Math.atan2(rise, 4.4), len = Math.hypot(4.4, rise) + 0.35;
  for (const s of [-1, 1]) {
    const r = box(len, 0.1, 7.4, roofMat, s * 2.3, FLOOR_Y + H + rise / 2 + 0.05, 0); r.rotation.z = -s * th;
  }
  const gs = new THREE.Shape(); gs.moveTo(-4.1, 0); gs.lineTo(4.1, 0); gs.lineTo(0, rise + 0.05); gs.closePath();
  for (const z of [-3, 3]) { const g = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: 0.12, bevelEnabled: false }), woodDark); g.position.set(0, FLOOR_Y + H, z - 0.06); g.castShadow = true; grp.add(g); }

  // door (hinged at x=-0.7, opens inward)
  const pivot = new THREE.Group(); pivot.position.set(-0.7, FLOOR_Y, 3); grp.add(pivot);
  box(1.4, 2.1, 0.08, woodDark, 0.7, 1.05, 0, pivot);
  box(0.05, 0.05, 0.14, new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.4 }), 1.25, 1.05, 0, pivot);
  const doorCol = addCol(-0.7, 0.7, 2.88, 3.12, { door: true });
  const door = {
    open: false, t: 0, pivot, col: doorCol,
    update(dt) {
      const target = this.open ? 1 : 0; this.t += Math.sign(target - this.t) * Math.min(Math.abs(target - this.t), dt * 1.6);
      const e = this.t * this.t * (3 - 2 * this.t); pivot.rotation.y = e * 1.75;
    },
  };
  doorCol.active = true;

  // ---- furniture ----
  // bed + mat
  box(1.7, 0.45, 2.1, wood, -3.05, FLOOR_Y + 0.22, -1.85);
  box(1.6, 0.06, 2.0, new THREE.MeshStandardMaterial({ color: 0x6b2a2a, roughness: 1 }), -3.05, FLOOR_Y + 0.48, -1.85, grp, false);
  box(0.6, 0.12, 0.35, new THREE.MeshStandardMaterial({ color: 0xcfc8b4, roughness: 1 }), -3.05, FLOOR_Y + 0.55, -2.6, grp, false);
  addCol(-3.9, -2.2, -2.9, -0.8);
  // table
  const TOP = FLOOR_Y + 0.78, TX = 0.8, TZ = 0.4;
  box(1.5, 0.08, 0.9, wood, TX, TOP - 0.04, TZ); addCol(TX - 0.75, TX + 0.75, TZ - 0.45, TZ + 0.45);
  for (const [dx, dz] of [[-0.68, -0.38], [0.68, -0.38], [-0.68, 0.38], [0.68, 0.38]]) box(0.07, 0.74, 0.07, woodDark, TX + dx, FLOOR_Y + 0.37, TZ + dz);
  // jars, sack, shelf
  const jarMat = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.8 });
  for (const [x, z, r] of [[3.4, -2.5, 0.28], [3.0, -2.7, 0.2], [-3.5, 2.5, 0.25]]) { const j = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, r * 2.2, 10), jarMat); j.position.set(x, FLOOR_Y + r * 1.1, z); j.castShadow = true; grp.add(j); }
  box(0.7, 0.5, 0.5, new THREE.MeshStandardMaterial({ color: 0x8a7a55, roughness: 1 }), 3.3, FLOOR_Y + 0.25, 2.3); addCol(2.95, 3.65, 2.05, 2.55);
  box(1.6, 0.05, 0.4, wood, 2.9, FLOOR_Y + 1.5, -2.78); box(0.9, 0.05, 0.3, wood, 3.4, FLOOR_Y + 1.2, 2.0, grp, false);

  // lamp (old kerosene) on table
  const lampG = new THREE.Group(); lampG.position.set(TX + 0.55, TOP, TZ - 0.1); grp.add(lampG);
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x6a5a30, metalness: 0.7, roughness: 0.4 })); lampBase.position.y = 0.06; lampG.add(lampBase);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.2, 10), new THREE.MeshBasicMaterial({ color: 0xffb35a })); glass.position.y = 0.22; lampG.add(glass);
  const lamp = new THREE.PointLight(0xffa850, 12, 11, 2); lamp.position.set(TX + 0.55, TOP + 0.3, TZ - 0.1); grp.add(lamp);
  env.lamp = lamp;

  // flashlight
  const fl = new THREE.Group(); fl.position.set(TX - 0.45, TOP + 0.03, TZ + 0.34); fl.rotation.y = 0.5; grp.add(fl);
  const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.6, roughness: 0.4 })); fb.rotation.z = Math.PI / 2; fl.add(fb);
  const fh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.06, 10), new THREE.MeshStandardMaterial({ color: 0x333336, metalness: 0.7 })); fh.rotation.z = Math.PI / 2; fh.position.x = 0.12; fl.add(fh);
  // batteries
  const bat = new THREE.Group(); bat.position.set(TX + 0.15, TOP + 0.03, TZ + 0.34); grp.add(bat);
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xb08a1a : 0x1d4a8a, metalness: 0.5, roughness: 0.5 })); c.rotation.z = Math.PI / 2; c.position.z = i * 0.045 - 0.045; bat.add(c); }

  // fishing traps – 4 on table, 3 on the floor
  const traps = [];
  const spots = [[TX, TOP + 0.13, TZ - 0.3, 0], [TX, TOP + 0.13, TZ - 0.1, 0.03], [TX, TOP + 0.13, TZ + 0.1, -0.03], [TX, TOP + 0.3, TZ - 0.2, 0.02],
    [-0.9, FLOOR_Y + 0.13, 1.6, 0.4], [-1.1, FLOOR_Y + 0.13, 2.0, -0.2], [2.4, FLOOR_Y + 0.13, -0.4, 1.2]];
  const items = [];
  spots.forEach(([x, y, z, ry], i) => {
    const m = env.makeTrapMesh(true); m.rotation.z = Math.PI / 2; m.scale.setScalar(0.7); const w = new THREE.Group(); w.add(m); w.position.set(x + 0.6, y - 0.08, z); w.rotation.y = ry; grp.add(w);
    const it = { type: 'trap', mesh: w, pos: V3(x, y, z), range: 2.9, label: '', taken: false }; traps.push(it); items.push(it);
  });
  items.push({ type: 'flash', mesh: fl, pos: V3(TX - 0.45, TOP + 0.05, TZ + 0.34), range: 2.9, taken: false });
  items.push({ type: 'battery', mesh: bat, pos: V3(TX + 0.15, TOP + 0.05, TZ + 0.34), range: 2.9 });
  items.push({ type: 'door', pos: V3(0, FLOOR_Y + 1.1, 3), range: 3.4 });
  return { door, items, grp };
}
