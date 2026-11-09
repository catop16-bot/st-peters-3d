import * as THREE from 'three';
import { GeoBucket, FacadeBuilder, lathe, boxAt, flatPolygon } from '../../core/geometry';
import { clipPolygon, cleanRing, type Vec2 } from '../../core/geo';
import type { MaterialLibrary } from '../../core/materials';
import { DIM } from '../../data/dimensions';
import { buildMainDome, buildMinorDome } from './Dome';
import { buildFacade, ClockFace, inscriptionMesh, zoneFront } from './Facade';
import { buildStatues, type StatueSpec } from '../statue';

const B = DIM.basilica;

export interface BasilicaFrame {
  angle: number;
  origin: Vec2;
  toLocal(p: Vec2): Vec2;
  toWorld(p: Vec2): Vec2;
}

export function basilicaFrame(): BasilicaFrame {
  const [cx, cz] = B.domeCenter;
  const [fx, fz] = B.facadeCenter;
  const angle = Math.atan2(-(fz - cz), fx - cx);
  const ca = Math.cos(angle), sa = Math.sin(angle);
  return {
    angle,
    origin: [cx, cz],
    toLocal: ([x, z]) => {
      const dx = x - cx, dz = z - cz;
      return [dx * ca - dz * sa, dx * sa + dz * ca];
    },
    toWorld: ([x, z]) => [cx + x * ca + z * sa, cz - x * sa + z * ca],
  };
}

/** 兩坡屋頂（沿 dir 方向），從 s0 到 s1，半寬 hw */
function gableRoof(dirX: number, dirZ: number, s0: number, s1: number, hw: number, eave: number, ridge: number) {
  const px = -dirZ, pz = dirX; // 垂直方向
  const P = (s: number, t: number, y: number) => [dirX * s + px * t, y, dirZ * s + pz * t];
  const a0 = P(s0, -hw, eave), a1 = P(s1, -hw, eave), r0 = P(s0, 0, ridge), r1 = P(s1, 0, ridge), b0 = P(s0, hw, eave), b1 = P(s1, hw, eave);
  const pos = [
    ...a0, ...a1, ...r1, ...a0, ...r1, ...r0,
    ...b0, ...r0, ...r1, ...b0, ...r1, ...b1,
    ...a0, ...r0, ...b0, ...a1, ...b1, ...r1,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fixUp(g);
  return g;
}

/** 讓每個三角形法線朝上或朝外（以質心相對 (cx, cz) 判斷） */
function fixUp(g: THREE.BufferGeometry, cx = 0, cz = 0) {
  const p = g.attributes.position.array as Float32Array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < p.length; i += 9) {
    a.fromArray(p, i); b.fromArray(p, i + 3); c.fromArray(p, i + 6);
    n.subVectors(b, a).cross(c.clone().sub(a));
    const mx = (a.x + b.x + c.x) / 3 - cx, mz = (a.z + b.z + c.z) / 3 - cz;
    // 斜屋面：法線一律朝上；山牆等垂直面：朝外
    const score = Math.abs(n.y) > 0.2 * n.length() ? n.y : n.x * mx + n.z * mz;
    if (score < 0) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  }
  g.computeVertexNormals();
}

export interface BasilicaResult {
  group: THREE.Group;
  clock: ClockFace;
  frame: BasilicaFrame;
  bodyLocal: Vec2[];
}

export function buildBasilica(M: MaterialLibrary, footprintWorld: Vec2[], facadeStatues: { x: number; z: number; name: string }[]): BasilicaResult {
  const frame = basilicaFrame();
  const group = new THREE.Group();
  group.name = 'basilica';
  group.position.set(frame.origin[0], B.floorY, frame.origin[1]);
  group.rotation.y = frame.angle;

  // ── 主體：OSM 真實平面輪廓擠出 ──
  let ring = cleanRing(footprintWorld.map(frame.toLocal), 0.3);
  ring = clipPolygon(ring, 1, 0, B.facadeBackX + 0.5);
  const fb = new FacadeBuilder();
  const attrs = { tint: new THREE.Color(1, 1, 1), seed: 0.37, shop: 0, style: 1, groundH: 0 };
  fb.walls(ring, -B.floorY, B.bodyHeight, attrs);
  const body = new THREE.Mesh(fb.build(), M.stoneFacade);
  body.castShadow = body.receiveShadow = true;
  body.name = 'basilica-body';
  group.add(body);

  const b = new GeoBucket();
  // 屋頂平台（石灰華鋪面）
  b.add(M.slab, flatPolygon(ring, [], B.bodyHeight));
  // 頂部簷口線腳（沿輪廓）
  const corn = new FacadeBuilder();
  const inset = ring; // 以原輪廓做略突出的簷口
  corn.walls(scaleRing(inset, 0.6), B.bodyHeight - 1.6, B.bodyHeight - 0.4, { ...attrs, style: 9 });
  const cornMesh = new THREE.Mesh(corn.build(), M.travertine);
  cornMesh.castShadow = true;
  group.add(cornMesh);

  // ── 屋頂（赤陶瓦）──
  const eave = B.bodyHeight, ridge = B.bodyHeight + 7.0;
  const hw = 16.5;
  b.add(M.roofTiles, gableRoof(1, 0, 30, B.facadeBackX, hw, eave, ridge)); // 中殿
  // 三個半圓後殿臂（北、南、西）：以輪廓量測臂長
  const armEnd = (dx: number, dz: number) => {
    let m = 0;
    for (const [x, z] of ring) {
      const along = x * dx + z * dz, across = Math.abs(-x * dz + z * dx);
      if (across < hw && along > m) m = along;
    }
    return m;
  };
  for (const [dx, dz] of [[0, 1], [0, -1], [-1, 0]] as [number, number][]) {
    const end = armEnd(dx, dz) - 5.5;
    const s1 = end - hw;
    if (s1 > 31) b.add(M.roofTiles, gableRoof(dx, dz, 30, s1, hw, eave, ridge));
    // 半圓錐屋頂（肋式）
    const ang = Math.atan2(dz, dx);
    // 半圓錐的 φ ∈ [0, π] 位於 +X 半邊；rotateY(-ang) 使其朝向臂的外端
    const cone = lathe([[hw, eave], [hw * 0.55, eave + 4.5], [0.01, ridge]], 24, 0, 0, 0, Math.PI).toNonIndexed();
    cone.rotateY(-ang);
    cone.translate(dx * s1, 0, dz * s1);
    fixUp(cone, dx * s1, dz * s1);
    b.add(M.roofTiles, cone);
  }
  // 中殿兩側的屋頂平台女兒牆
  for (const s of [-1, 1]) b.add(M.travertine, boxAt(B.facadeBackX - 30, eave, eave + 1.0, 0.6, (B.facadeBackX + 30) / 2, s * (hw + 0.3)));

  // ── 主穹頂與小穹頂 ──
  buildMainDome(b, M);
  const MD = DIM.minorDomes;
  for (const [x, z] of MD.offsets) buildMinorDome(b, M, x, z, MD.radius, eave, MD.drumTop, MD.shellTop, MD.lanternTop);
  // 中殿側禮拜堂橢圓小穹頂（航照位置：距穹頂約 62 / 85 / 106 m，偏軸 ±22 m）
  for (const x of [62, 85, 106]) for (const z of [-22, 22]) {
    buildMinorDome(b, M, x, z, 5.2, eave, eave + 3.2, eave + 8.5, eave + 12.0, 1.2, 1.0);
  }

  // ── 馬德諾立面 ──
  buildFacade(b, M);
  b.build(group);
  group.add(inscriptionMesh());
  const clock = new ClockFace();
  clock.meshes(group);

  // ── 立面頂端 13 尊雕像（OSM 位置）──
  const specs: StatueSpec[] = [];
  const peds = new GeoBucket();
  for (const s of facadeStatues) {
    const [, lz] = frame.toLocal([s.x, s.z]);
    const lx = zoneFront(lz) + 0.25;
    const y = DIM.facade.balustradeTop;
    peds.add(M.travertine, boxAt(1.9, y - 0.3, y + 0.5, 1.9, lx, lz));
    specs.push({ x: lx, y: y + 0.5, z: lz, height: DIM.facade.statueHeight * (s.name.includes('Cristo') ? 1.05 : 1), facing: 0, name: s.name });
  }
  peds.build(group);
  buildStatues(specs, M.statue, group, 'facade');

  group.traverse((o) => { o.userData.landmark = o.userData.landmark ?? 'basilica'; });
  return { group, clock, frame, bodyLocal: ring };
}

function scaleRing(ring: Vec2[], grow: number): Vec2[] {
  // 沿頂點法線外擴
  const n = ring.length;
  const out: Vec2[] = [];
  let area = 0;
  for (let i = 0, j = n - 1; i < n; j = i++) area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  const sgn = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const p = ring[i], a = ring[(i - 1 + n) % n], c = ring[(i + 1) % n];
    const e1 = [p[0] - a[0], p[1] - a[1]], e2 = [c[0] - p[0], c[1] - p[1]];
    const l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
    const n1 = [e1[1] / l1 * sgn, -e1[0] / l1 * sgn], n2 = [e2[1] / l2 * sgn, -e2[0] / l2 * sgn];
    let nx = n1[0] + n2[0], nz = n1[1] + n2[1];
    const l = Math.hypot(nx, nz) || 1;
    nx /= l; nz /= l;
    const cos = Math.max(0.4, nx * n1[0] + nz * n1[1]);
    out.push([p[0] + (nx * grow) / cos, p[1] + (nz * grow) / cos]);
  }
  return out;
}
