import * as THREE from 'three';
import { GeoBucket, lathe, pediment, boxAt } from '../../core/geometry';
import type { MaterialLibrary } from '../../core/materials';
import { DIM } from '../../data/dimensions';
import { buildStatues, type StatueSpec } from '../statue';

const C = DIM.colonnade;
const DEG = Math.PI / 180;

/** 環形扇區實體（圓心 cx,cz；角度 t 對應點 (cx + r cos t, cz + sgn·r sin t)） */
export function annularSector(cx: number, cz: number, sgn: number, r0: number, r1: number, t0: number, t1: number, y0: number, y1: number, seg = 64, faces = { top: true, bottom: true, inner: true, outer: true, ends: true }) {
  const pos: number[] = [];
  const P = (r: number, t: number, y: number) => [cx + r * Math.cos(t), y, cz + sgn * r * Math.sin(t)];
  const quad = (a: number[], b: number[], c: number[], d: number[], want: number[]) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * want[0] + ny * want[1] + nz * want[2] >= 0) pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    else pos.push(...a, ...c, ...b, ...a, ...d, ...c);
  };
  const radial = (t: number, s: number) => [Math.cos(t) * s, 0, sgn * Math.sin(t) * s];
  const tangent = (t: number, s: number) => [-Math.sin(t) * s, 0, sgn * Math.cos(t) * s];
  for (let i = 0; i < seg; i++) {
    const ta = t0 + ((t1 - t0) * i) / seg, tb = t0 + ((t1 - t0) * (i + 1)) / seg, tm = (ta + tb) / 2;
    if (faces.top) quad(P(r0, ta, y1), P(r1, ta, y1), P(r1, tb, y1), P(r0, tb, y1), [0, 1, 0]);
    if (faces.bottom) quad(P(r0, ta, y0), P(r0, tb, y0), P(r1, tb, y0), P(r1, ta, y0), [0, -1, 0]);
    if (faces.outer) quad(P(r1, ta, y0), P(r1, tb, y0), P(r1, tb, y1), P(r1, ta, y1), radial(tm, 1));
    if (faces.inner) quad(P(r0, ta, y0), P(r0, ta, y1), P(r0, tb, y1), P(r0, tb, y0), radial(tm, -1));
  }
  if (faces.ends) {
    quad(P(r0, t0, y0), P(r1, t0, y0), P(r1, t0, y1), P(r0, t0, y1), tangent(t0, -1));
    quad(P(r0, t1, y0), P(r0, t1, y1), P(r1, t1, y1), P(r1, t1, y0), tangent(t1, 1));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** 托斯卡尼柱（半徑 1、柱礎在 y=0），供 InstancedMesh 縮放 */
function tuscanColumn(h: number) {
  return lathe([[1.28, 0], [1.28, 0.32], [1.18, 0.4], [1.15, 0.55], [1.0, 0.7], [1.0, 1.0], [0.98, h * 0.35], [0.86, h - 1.25], [0.9, h - 1.1], [0.88, h - 1.0], [1.15, h - 0.6], [1.22, h - 0.45], [1.32, h - 0.45], [1.32, h], [0.0, h]], 20);
}

export function buildColonnade(M: MaterialLibrary, statueNodes: { x: number; z: number; name: string }[]) {
  const group = new THREE.Group();
  group.name = 'colonnade';
  const b = new GeoBucket();
  const colGeo = tuscanColumn(C.columnTop - 0.6);
  const matrices: THREE.Matrix4[] = [];
  const stylo = 0.6;

  C.centers.forEach(([cx, cz], armIdx) => {
    const sgn = cz > 0 ? 1 : -1;
    const t0 = C.angleFrom * DEG, t1 = C.angleTo * DEG;
    const nLines = armIdx === 0 ? 36 : 35; // 合計 71 條徑向線 × 4 列 = 284 根柱
    const pav = 4.6 * DEG; // 端部門廊所占角度
    const ta = t0 + pav, tb = t1 - pav;
    // 柱基台（三級台階）
    for (let k = 0; k < 3; k++) {
      b.add(M.slab, annularSector(cx, cz, sgn, C.innerR - 2.4 + k * 0.7, C.outerR + 0.6 - k * 0.2, t0, t1, 0, stylo * (k + 1) / 3, 72, { top: true, bottom: false, inner: true, outer: true, ends: true }));
    }
    // 柱子
    for (let i = 0; i < nLines; i++) {
      const t = ta + ((tb - ta) * (i + 0.5)) / nLines;
      for (const r of C.rows) {
        const rc = 0.78 * (r / 75.6); // 外列柱較粗，使從中心看去四列重合
        const x = cx + r * Math.cos(t), z = cz + sgn * r * Math.sin(t);
        matrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x, stylo, z), new THREE.Quaternion(), new THREE.Vector3(rc, 1, rc)));
      }
    }
    // 檐部（實體塊，下方即走廊頂棚）
    b.add(M.travertine, annularSector(cx, cz, sgn, C.innerR, C.outerR, t0, t1, C.columnTop, C.entablatureTop - 0.8, 96));
    // 簷口（內外兩側突出）
    b.add(M.travertine, annularSector(cx, cz, sgn, C.innerR - 0.7, C.innerR + 0.5, t0, t1, C.entablatureTop - 0.8, C.entablatureTop, 96));
    b.add(M.travertine, annularSector(cx, cz, sgn, C.outerR - 0.5, C.outerR + 0.7, t0, t1, C.entablatureTop - 0.8, C.entablatureTop, 96));
    // 額枋線腳
    b.add(M.travertine, annularSector(cx, cz, sgn, C.innerR - 0.25, C.innerR, t0, t1, C.columnTop + 1.1, C.columnTop + 1.35, 96, { top: true, bottom: true, inner: true, outer: false, ends: false }));
    // 屋頂（赤陶瓦，低坡）
    const rm = (C.innerR + C.outerR) / 2;
    b.add(M.roofTiles, slopedSector(cx, cz, sgn, C.innerR + 0.8, rm, t0, t1, C.entablatureTop, C.entablatureTop + 2.2));
    b.add(M.roofTiles, slopedSector(cx, cz, sgn, C.outerR - 0.8, rm, t0, t1, C.entablatureTop, C.entablatureTop + 2.2));
    // 內側欄杆
    arcBalustrade(b, M, cx, cz, sgn, C.innerR + 0.05, t0, t1, C.entablatureTop, C.balustradeTop);
    // 外側女兒牆
    b.add(M.travertine, annularSector(cx, cz, sgn, C.outerR - 0.5, C.outerR, t0, t1, C.entablatureTop, C.balustradeTop - 0.4, 96));
    // 走廊地面
    b.add(M.slab, annularSector(cx, cz, sgn, C.innerR - 0.5, C.outerR, t0, t1, 0, stylo + 0.01, 72, { top: true, bottom: false, inner: false, outer: false, ends: false }));

    // 兩端門廊（testate）：山花朝外
    for (const [te, dir] of [[t0, -1], [t1, 1]] as [number, number][]) {
      const tA = dir < 0 ? t0 : t1 - pav * 0.95, tB = dir < 0 ? t0 + pav * 0.95 : t1;
      b.add(M.travertine, annularSector(cx, cz, sgn, C.innerR - 1.2, C.outerR + 1.2, tA, tB, 0, C.entablatureTop + 0.6, 8));
      b.add(M.travertine, annularSector(cx, cz, sgn, C.innerR - 1.4, C.outerR + 1.4, tA, tB, C.entablatureTop + 0.6, C.entablatureTop + 3.6, 8));
      // 山花：位於端面中央，朝切線方向
      const rmid = (C.innerR + C.outerR) / 2;
      const tx = -Math.sin(te) * dir, tz = Math.cos(te) * dir * sgn; // 朝外切線
      const px = cx + rmid * Math.cos(te) + tx * 0.6, pz = cz + sgn * rmid * Math.sin(te) + tz * 0.6;
      const ang = Math.atan2(-tz, tx);
      const ped = pediment(11.5, C.entablatureTop + 3.6, C.entablatureTop + 7.6, 2.0, 0);
      ped.applyMatrix4(new THREE.Matrix4().makeRotationY(ang));
      ped.translate(px, 0, pz);
      b.add(M.travertine, ped);
      // 端面四根巨柱
      for (const off of [-8.2, -3.2, 3.2, 8.2]) {
        const rx = Math.cos(te) * off, rz = sgn * Math.sin(te) * off;
        const c = lathe([[1.0, 0], [1.0, 0.6], [0.85, 0.8], [0.76, C.columnTop - 1.0], [1.0, C.columnTop - 0.4], [1.05, C.columnTop + 0.4]], 14);
        c.translate(px + rx + tx * 1.2, stylo, pz + rz + tz * 1.2);
        b.add(M.travertineSmooth, c);
      }
      // 端面暗色拱門
      const door = boxAt(0.3, stylo, 9.5, 5.2);
      door.applyMatrix4(new THREE.Matrix4().makeRotationY(ang));
      door.translate(px + tx * 0.05, 0, pz + tz * 0.05);
      b.add(M.dark, door);
    }
  });

  b.build(group);
  const im = new THREE.InstancedMesh(colGeo, M.travertineSmooth, matrices.length);
  matrices.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = im.receiveShadow = true;
  im.computeBoundingSphere();
  group.add(im);

  // ── 140 尊聖人像（OSM 位置與名稱）──
  const specs: StatueSpec[] = [];
  const peds = new GeoBucket();
  for (const s of statueNodes) {
    // 判斷所屬弧與徑向位置
    let best = -1, bestErr = 1e9;
    C.centers.forEach(([cx, cz], i) => {
      const r = Math.hypot(s.x - cx, s.z - cz);
      const err = Math.abs(r - C.innerR - 0.6);
      if ((s.z - cz) * Math.sign(cz) > -8 && err < bestErr) { bestErr = err; best = i; }
    });
    let x = s.x, z = s.z, y: number, facing: number;
    if (best >= 0 && bestErr < 8 && s.x > -75) {
      const [cx, cz] = C.centers[best];
      const t = Math.atan2(s.z - cz, s.x - cx);
      const r = C.innerR + 0.5;
      x = cx + r * Math.cos(t); z = cz + r * Math.sin(t);
      y = C.balustradeTop;
      facing = Math.atan2(-(cz - z), cx - x);
      peds.add(M.travertine, boxAt(1.2, C.entablatureTop, y + 0.4, 1.2, x, z));
      y += 0.4;
    } else {
      // 廣場兩側直走廊屋頂
      y = 17.4;
      facing = z < 0 ? -Math.PI / 2 : Math.PI / 2; // 面向廣場中軸
      peds.add(M.travertine, boxAt(1.2, 16.6, y, 1.2, x, z));
    }
    specs.push({ x, y, z, height: C.statueHeight, facing, name: s.name });
  }
  peds.build(group);
  buildStatues(specs, M.statue, group, 'colonnade');
  group.traverse((o) => { o.userData.landmark = o.userData.landmark ?? 'colonnade'; });
  return group;
}

/** 從 rLow（簷口，y0）傾斜到 rHigh（屋脊，y1）的弧形屋面 */
function slopedSector(cx: number, cz: number, sgn: number, rLow: number, rHigh: number, t0: number, t1: number, y0: number, y1: number, seg = 96) {
  const pos: number[] = [];
  const P = (r: number, t: number, y: number) => [cx + r * Math.cos(t), y, cz + sgn * r * Math.sin(t)];
  for (let i = 0; i < seg; i++) {
    const ta = t0 + ((t1 - t0) * i) / seg, tb = t0 + ((t1 - t0) * (i + 1)) / seg;
    const a = P(rLow, ta, y0), b2 = P(rLow, tb, y0), c = P(rHigh, tb, y1), d = P(rHigh, ta, y1);
    pos.push(...a, ...b2, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const p = g.attributes.position.array as Float32Array;
  const A = new THREE.Vector3(), Bv = new THREE.Vector3(), Cv = new THREE.Vector3();
  for (let i = 0; i < p.length; i += 9) {
    A.fromArray(p, i); Bv.fromArray(p, i + 3); Cv.fromArray(p, i + 6);
    const n = Bv.clone().sub(A).cross(Cv.clone().sub(A));
    if (n.y < 0) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  }
  g.computeVertexNormals();
  return g;
}

function arcBalustrade(b: GeoBucket, M: MaterialLibrary, cx: number, cz: number, sgn: number, r: number, t0: number, t1: number, y: number, top: number) {
  b.add(M.travertine, annularSector(cx, cz, sgn, r - 0.35, r + 0.35, t0, t1, y, y + 0.28, 96));
  b.add(M.travertine, annularSector(cx, cz, sgn, r - 0.4, r + 0.4, t0, t1, top - 0.26, top, 96));
  const h = top - y - 0.54;
  const proto = lathe([[0.13, 0], [0.1, 0.1], [0.17, 0.38], [0.1, 0.8], [0.075, 0.92], [0.13, h]], 6);
  const len = r * (t1 - t0);
  const n = Math.floor(len / 0.42);
  for (let i = 0; i < n; i++) {
    const t = t0 + ((t1 - t0) * (i + 0.5)) / n;
    const g = proto.clone();
    g.translate(cx + r * Math.cos(t), y + 0.28, cz + sgn * r * Math.sin(t));
    b.add(M.travertineSmooth, g);
  }
}
