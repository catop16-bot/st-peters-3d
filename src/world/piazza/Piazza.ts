import * as THREE from 'three';
import { GeoBucket, boxAt, lathe, flatPolygon } from '../../core/geometry';
import type { MaterialLibrary } from '../../core/materials';
import { G } from '../../core/materials';
import type { Vec2 } from '../../core/geo';
import { DIM } from '../../data/dimensions';
import { buildStatues } from '../statue';

const P = DIM.piazza;
const C = DIM.colonnade;
const DEG = Math.PI / 180;

/** 廣場橢圓區的邊界多邊形（兩圓弧 + 東側國界線） */
export function piazzaOutline(R = C.innerR - 2.4, east = 84): Vec2[] {
  const pts: Vec2[] = [];
  const [scx, scz] = C.centers[0];
  const [ncx, ncz] = C.centers[1];
  pts.push([east, 52 + (R - C.innerR + 2.4) * 0.5]);
  for (let i = 0; i <= 64; i++) {
    const t = (C.angleFrom + ((C.angleTo - C.angleFrom) * i) / 64) * DEG;
    pts.push([scx + R * Math.cos(t), scz + R * Math.sin(t)]);
  }
  pts.push([-67, 48], [-68, -48]);
  for (let i = 64; i >= 0; i--) {
    const t = (C.angleFrom + ((C.angleTo - C.angleFrom) * i) / 64) * DEG;
    pts.push([ncx + R * Math.cos(t), ncz - R * Math.sin(t)]);
  }
  pts.push([east, -52 - (R - C.innerR + 2.4) * 0.5]);
  return pts;
}

export function buildPiazza(M: MaterialLibrary, rettaPoly: Vec2[] | null) {
  const group = new THREE.Group();
  group.name = 'piazza';
  const b = new GeoBucket();

  // ── 橢圓廣場鋪面 ──
  const ground = new THREE.Mesh(flatPolygon(piazzaOutline(), [], 0.03), M.piazzaPaving);
  ground.receiveShadow = true;
  ground.name = 'piazza-ground';
  group.add(ground);

  // ── 直廣場（Piazza Retta）緩坡：OSM 輪廓，高度隨 x 線性上升 ──
  const ramp = (x: number) => THREE.MathUtils.clamp((P.retta.fromX - x) / (P.retta.fromX - P.retta.stepsStartX), 0, 1) * P.retta.rampTopY;
  if (rettaPoly && rettaPoly.length > 3) {
    const g = flatPolygon(rettaPoly, [], 0);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, ramp(pos.getX(i)) + 0.035);
    g.computeVertexNormals();
    // 使法線朝上
    const rm = new THREE.Mesh(g, M.sampietrini);
    rm.receiveShadow = true;
    group.add(rm);
  }

  // ── 教堂前台階（三段）與平台 ──
  const zN = -37, zS = 44;
  const floor = DIM.basilica.floorY;
  const rise = floor - P.retta.rampTopY;
  const steps = 18;
  const flights = [[-126, -131.5], [-135, -140.5], [-143.5, -149]];
  let level = P.retta.rampTopY;
  for (let f = 0; f < 3; f++) {
    const [x0, x1] = flights[f];
    const n = steps / 3;
    const tread = (x0 - x1) / n;
    for (let i = 0; i < n; i++) {
      const top = level + rise / steps;
      const xa = x0 - i * tread;
      // 每階為延伸至平台下方的實體塊，前緣位於 xa
      b.add(M.slab, boxAt(xa + 190, 0, top, zS - zN, (xa - 190) / 2, (zN + zS) / 2));
      level = top;
    }
    // 平台（梯段之間）
    const next = flights[f + 1];
    if (next) b.add(M.slab, boxAt(x1 + 190, 0, level, zS - zN, (x1 - 190) / 2, (zN + zS) / 2));
  }
  // 最上層平台（至立面）
  b.add(M.slab, boxAt(44, 0, floor, zS - zN, -149 - 22, (zN + zS) / 2));
  // 平台兩側擋牆
  for (const z of [zN - 0.5, zS + 0.5]) b.add(M.travertine, boxAt(66, 0, floor + 0.9, 1.0, -158, z));

  // ── 聖彼得與聖保羅像（台階前，OSM 位置）──
  const spStatues = [
    { x: P.statuePeter[0], z: P.statuePeter[1], name: 'San Pietro（聖彼得像，Giuseppe De Fabris, 1840）' },
    { x: P.statuePaul[0], z: P.statuePaul[1], name: 'San Paolo（聖保羅像，Adamo Tadolini, 1838）' },
  ];
  for (const s of spStatues) {
    const y0 = ramp(s.x);
    b.add(M.travertine, boxAt(4.2, y0, y0 + 1.0, 4.2, s.x, s.z));
    b.add(M.travertine, boxAt(3.4, y0 + 1.0, y0 + 4.0, 3.4, s.x, s.z));
    b.add(M.travertine, boxAt(3.9, y0 + 4.0, y0 + 4.6, 3.9, s.x, s.z));
  }
  buildStatues(spStatues.map((s) => ({ x: s.x, y: ramp(s.x) + 4.6, z: s.z, height: 5.5, facing: 0, name: s.name })), M.statue, group, 'peter-paul');

  // ── 方尖碑 ──
  buildObelisk(b, M);

  // ── 方尖碑周圍石柱 ──
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    b.add(M.travertine, lathe([[0.28, 0], [0.28, 0.65], [0.22, 0.8], [0.12, 0.92], [0, 0.95]], 8, Math.cos(a) * 22.6, Math.sin(a) * 22.6));
  }

  b.build(group);

  // ── 噴泉 ──
  const fountains = P.fountains.map((f) => buildFountain(M, f.pos[0], f.pos[1]));
  for (const f of fountains) group.add(f.group);

  group.traverse((o) => { o.userData.landmark = o.userData.landmark ?? 'piazza'; });
  return { group, update: (dt: number) => fountains.forEach((f) => f.update(dt)) };
}

function buildObelisk(b: GeoBucket, M: MaterialLibrary) {
  const T = M.travertine;
  b.add(T, boxAt(11.4, 0, 0.3, 11.4));
  b.add(T, boxAt(9.0, 0.3, 0.75, 9.0));
  b.add(T, boxAt(7.6, 0.75, 1.2, 7.6));
  // 基座
  b.add(M.granite, boxAt(5.6, 1.2, 2.4, 5.6));
  b.add(M.granite, boxAt(4.7, 2.4, 6.9, 4.7));
  b.add(M.granite, boxAt(5.5, 6.9, 7.6, 5.5));
  b.add(M.granite, boxAt(4.1, 7.6, 8.6, 4.1));
  // 四隻青銅獅（以簡化體量表示，托起碑身）
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const lion = new THREE.CapsuleGeometry(0.42, 1.0, 4, 8);
    lion.rotateZ(Math.PI / 2);
    lion.rotateY(Math.atan2(sz, sx));
    lion.translate(sx * 1.25, 9.1, sz * 1.25);
    b.add(M.bronze, lion);
    const head = new THREE.SphereGeometry(0.42, 10, 8);
    head.translate(sx * 1.9, 9.35, sz * 1.9);
    b.add(M.bronze, head);
  }
  // 碑身（錐形四方柱 + 尖頂）
  const y0 = 9.75, shaftH = P.obeliskShaft;
  const shaft = new THREE.CylinderGeometry(1.85 / Math.SQRT2, 2.65 / Math.SQRT2, shaftH - 1.3, 4, 1);
  shaft.rotateY(Math.PI / 4);
  shaft.scale(Math.SQRT2, 1, Math.SQRT2);
  shaft.translate(0, y0 + (shaftH - 1.3) / 2, 0);
  b.add(M.granite, shaft);
  const pyr = new THREE.ConeGeometry(1.85, 1.3, 4);
  pyr.rotateY(Math.PI / 4);
  pyr.translate(0, y0 + shaftH - 0.65, 0);
  b.add(M.granite, pyr);
  // 頂端：基吉家族山形 + 星 + 十字
  const top = y0 + shaftH;
  const cap = lathe([[0.9, 0], [0.9, 0.3], [0.6, 0.6], [0.3, 1.2], [0, 1.4]], 12);
  cap.translate(0, top + 0.4, 0);
  b.add(M.bronze, cap);
  const mounts = new THREE.SphereGeometry(0.55, 10, 8);
  mounts.translate(0, top + 0.5, 0);
  b.add(M.bronze, mounts);
  const star = new THREE.OctahedronGeometry(0.55);
  star.translate(0, top + 1.6, 0);
  b.add(M.gilded, star);
  b.add(M.bronze, boxAt(0.22, top + 2.0, P.obeliskTotal, 0.22));
  b.add(M.bronze, boxAt(0.2, P.obeliskTotal - 2.0, P.obeliskTotal - 1.75, 1.6));
  b.add(M.bronze, boxAt(1.6, P.obeliskTotal - 2.0, P.obeliskTotal - 1.75, 0.2));
  // lathe 平移修正（頂座）
  const seat = lathe([[1.0, top], [1.0, top + 0.25], [0.7, top + 0.45], [0, top + 0.45]], 4);
  seat.rotateY(Math.PI / 4);
  b.add(M.bronze, seat);
}

/** 噴泉：下層水池 + 八角座 + 兩層「蘑菇形」水盤 + 水幕 + 噴水粒子 */
function buildFountain(M: MaterialLibrary, x: number, z: number) {
  const group = new THREE.Group();
  const b = new GeoBucket();
  b.add(M.travertine, lathe([[0, 0], [6.0, 0], [6.0, 0.18], [5.4, 0.2]], 48, x, z));
  b.add(M.granite, lathe([[4.75, 0.2], [5.15, 0.2], [5.25, 0.35], [5.15, 0.75], [5.35, 0.85], [5.35, 1.0], [4.75, 1.0], [4.75, 0.3]], 64, x, z));
  b.add(M.granite, lathe([[1.7, 0.3], [1.7, 0.6], [1.35, 0.9], [1.25, 1.9], [0.75, 2.2], [0.62, 3.0], [0.8, 3.4], [2.7, 4.75], [2.85, 4.95], [2.6, 5.05], [0.55, 4.9], [0.45, 5.6], [0.6, 5.9], [1.35, 6.3], [1.42, 6.45], [0.3, 6.5], [0.28, 7.0], [0, 7.1]], 8, x, z));
  b.build(group);
  const water = new THREE.Mesh(new THREE.CircleGeometry(4.78, 48).rotateX(-Math.PI / 2).translate(x, 0.82, z), M.water);
  water.receiveShadow = true;
  group.add(water);
  // 水盤上方水面
  const top = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32).rotateX(-Math.PI / 2).translate(x, 4.98, z), M.water);
  group.add(top);
  // 溢流水幕
  const sheetMat = new THREE.MeshStandardMaterial({ color: 0xe8f2f4, transparent: true, opacity: 0.26, roughness: 0.15, depthWrite: false, side: THREE.DoubleSide });
  sheetMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = G.uTime;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vUvS;')
      .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n float st = fract(vUvS.x * 40.0 + sin(vUvS.x*120.0)*0.2); float fl = fract(vUvS.y * 3.0 + uTime * 1.6 + st); diffuseColor.a *= (0.35 + 0.65 * smoothstep(0.2, 0.9, fl)) * (0.6 + 0.4 * st);');
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vUvS;').replace('#include <uv_vertex>', '#include <uv_vertex>\n vUvS = uv;');
  };
  const sheet = new THREE.Mesh(new THREE.CylinderGeometry(2.86, 3.05, 4.1, 48, 1, true).translate(x, 2.88, z), sheetMat);
  sheet.renderOrder = 3;
  group.add(sheet);
  // 頂端噴水與水花粒子
  const N = 600;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const life = new Float32Array(N);
  const reset = (i: number) => {
    const a = Math.random() * Math.PI * 2;
    if (i % 3 === 0) {
      // 頂部噴泉
      pos[i * 3] = x; pos[i * 3 + 1] = 7.1; pos[i * 3 + 2] = z;
      vel[i * 3] = Math.cos(a) * 0.6; vel[i * 3 + 1] = 3.8 + Math.random() * 0.8; vel[i * 3 + 2] = Math.sin(a) * 0.6;
    } else {
      // 水盤邊緣落下的水花
      pos[i * 3] = x + Math.cos(a) * 2.9; pos[i * 3 + 1] = 4.9; pos[i * 3 + 2] = z + Math.sin(a) * 2.9;
      vel[i * 3] = Math.cos(a) * 0.35; vel[i * 3 + 1] = 0.2; vel[i * 3 + 2] = Math.sin(a) * 0.35;
    }
    life[i] = 0;
  };
  for (let i = 0; i < N; i++) { reset(i); life[i] = Math.random() * 2; }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pm = new THREE.PointsMaterial({ color: 0xeef6f8, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false });
  const points = new THREE.Points(pg, pm);
  points.frustumCulled = false;
  group.add(points);
  const update = (dt: number) => {
    const d = Math.min(dt, 0.05);
    for (let i = 0; i < N; i++) {
      vel[i * 3 + 1] -= 9.8 * d;
      pos[i * 3] += vel[i * 3] * d; pos[i * 3 + 1] += vel[i * 3 + 1] * d; pos[i * 3 + 2] += vel[i * 3 + 2] * d;
      life[i] += d;
      const yFloor = Math.hypot(pos[i * 3] - x, pos[i * 3 + 2] - z) < 2.7 && pos[i * 3 + 1] > 4.5 ? 4.98 : 0.82;
      if (pos[i * 3 + 1] < yFloor || life[i] > 3) reset(i);
    }
    pg.attributes.position.needsUpdate = true;
  };
  group.userData.landmark = 'fountain';
  return { group, update };
}
