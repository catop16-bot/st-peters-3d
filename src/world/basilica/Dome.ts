import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeoBucket, boxAt, cylAt, lathe, pediment, trs } from '../../core/geometry';
import type { MaterialLibrary } from '../../core/materials';
import { DIM } from '../../data/dimensions';

const D = DIM.dome;

/** 外殼剖面：德拉·波爾塔略為拉高的尖拱形 */
function shellProfile(R: number, y0: number, y1: number, rTop: number, steps = 40): [number, number][] {
  // 以兩圓弧組成尖拱：圓心在對側距離 d
  const h = y1 - y0;
  const d = (h * h - R * R) / (2 * R); // (R+d)^2 - d^2 = h^2
  const rho = R + d;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const r = R - (R - rTop) * (i / steps);
    const y = y0 + Math.sqrt(Math.max(0, rho * rho - (r + d) * (r + d)));
    pts.push([r, y]);
  }
  return pts;
}

/** 米開朗基羅主穹頂（座標：穹頂中心為原點，地坪 y=0） */
export function buildMainDome(b: GeoBucket, M: MaterialLibrary) {
  const T = M.travertine, TS = M.travertineSmooth;
  // 基座圓台（從屋頂平台升起）
  b.add(T, lathe([[0, 44], [34.5, 44], [34.5, 50.5], [33.6, 51], [33.6, 54]], 64));
  b.add(T, lathe([[33.6, 54], [34.2, 54.4], [34.2, 55.2], [31.5, 55.2], [31.5, 60]], 64));
  // 鼓座牆
  b.add(T, cylAt(D.drumRadius, D.drumRadius, D.drumBase, D.drumAtticTop, 0, 0, 96, true));
  // 16 組雙柱扶壁 + 窗
  const n = D.ribs;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    // 扶壁本體
    const but = boxAt(3.2, D.drumBase, D.drumColumnTop, 4.2);
    but.applyMatrix4(trs(ca * (D.drumRadius + 1.6), 0, sa * (D.drumRadius + 1.6), -a));
    b.add(T, but);
    // 雙柱（科林斯）
    for (const off of [-1.65, 1.65]) {
      const px = ca * (D.drumRadius + 3.6) - sa * off;
      const pz = sa * (D.drumRadius + 3.6) + ca * off;
      b.add(TS, lathe([[1.05, D.drumBase], [1.05, D.drumBase + 0.6], [0.78, D.drumBase + 0.9], [0.72, D.drumColumnTop - 1.6], [0.95, D.drumColumnTop - 0.3], [1.1, D.drumColumnTop]], 14, px, pz));
    }
    // 柱頂檐部突出塊
    const ent = boxAt(5.4, D.drumColumnTop, D.drumEntablatureTop, 2.8);
    ent.applyMatrix4(trs(ca * (D.drumRadius + 3.6), 0, sa * (D.drumRadius + 3.6), -a));
    b.add(T, ent);
    // 閣樓層上的燭台裝飾
    const cand = lathe([[0.6, 0], [0.6, 0.8], [0.35, 1.2], [0.5, 2.2], [0.15, 3.6], [0, 4.0]], 10);
    cand.translate(ca * (D.drumRadius + 2.6), D.drumAtticTop + 0.6, sa * (D.drumRadius + 2.6));
    b.add(T, cand);
    // 窗戶（扶壁之間），交替三角/弧形山花
    const wa = a + Math.PI / n;
    const wx = Math.cos(wa) * (D.drumRadius + 0.05), wz = Math.sin(wa) * (D.drumRadius + 0.05);
    const win = boxAt(0.3, D.drumBase + 3.2, D.drumBase + 10.8, 3.4);
    win.applyMatrix4(trs(wx, 0, wz, -wa));
    b.add(M.dark, win);
    const frame = boxAt(0.5, D.drumBase + 2.6, D.drumBase + 11.4, 4.6);
    frame.applyMatrix4(trs(Math.cos(wa) * (D.drumRadius - 0.1), 0, Math.sin(wa) * (D.drumRadius - 0.1), -wa));
    b.add(T, frame);
    if (i % 2 === 0) {
      const ped = pediment(2.9, D.drumBase + 11.4, D.drumBase + 13.0, 0.9, D.drumRadius + 0.3);
      ped.applyMatrix4(new THREE.Matrix4().makeRotationY(-wa));
      b.add(T, ped);
    } else {
      const seg = halfDisc(2.9, 0.9, D.drumRadius + 0.3, D.drumBase + 11.4, 0.45);
      seg.applyMatrix4(new THREE.Matrix4().makeRotationY(-wa));
      b.add(T, seg);
    }
  }
  // 鼓座檐部（環）
  b.add(T, lathe([[D.drumRadius, D.drumColumnTop], [D.drumRadius + 1.2, D.drumColumnTop], [D.drumRadius + 1.2, D.drumColumnTop + 2.2], [D.drumRadius + 1.9, D.drumColumnTop + 2.4], [D.drumRadius + 1.9, D.drumEntablatureTop], [D.drumRadius - 0.2, D.drumEntablatureTop]], 96));
  // 閣樓（attic）帶垂花飾
  b.add(T, lathe([[D.drumRadius - 0.2, D.drumEntablatureTop], [D.drumRadius + 0.4, D.drumEntablatureTop], [D.drumRadius + 0.4, D.drumAtticTop - 0.6], [D.drumRadius + 0.9, D.drumAtticTop - 0.3], [D.drumRadius + 0.9, D.drumAtticTop], [D.shellRadius - 0.5, D.drumAtticTop]], 96));
  for (let i = 0; i < n * 2; i++) {
    const a = ((i + 0.5) / (n * 2)) * Math.PI * 2;
    const g = new THREE.TorusGeometry(0.9, 0.18, 6, 12, Math.PI);
    g.rotateZ(Math.PI);
    g.rotateY(Math.PI / 2);
    g.translate(D.drumRadius + 0.5, D.drumEntablatureTop + 2.2, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(-a));
    b.add(TS, g);
  }

  // 外殼（鉛皮）
  const prof = shellProfile(D.shellRadius, D.drumAtticTop, D.shellTop, D.lanternRadius + 0.6);
  b.add(M.lead, lathe(prof, 128));
  // 16 條肋（石灰華色），各帶雙脊
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    for (const w of [-0.035, 0.035]) {
      const rib = ribAlong(prof, 0.55, 0.65);
      rib.applyMatrix4(new THREE.Matrix4().makeRotationY(-(a + w * 0.6)));
      b.add(M.leadRib, rib);
    }
    // 三層屋頂採光窗（老虎窗），位於兩肋之間
    const ma = a + Math.PI / n;
    const tiers = [{ t: 0.16, s: 1.5, kind: 0 }, { t: 0.42, s: 1.0, kind: 1 }, { t: 0.66, s: 0.7, kind: 2 }];
    for (const tier of tiers) {
      const idx = Math.floor(tier.t * (prof.length - 1));
      const [r, y] = prof[idx];
      const [r2, y2] = prof[Math.min(prof.length - 1, idx + 2)];
      const slope = Math.atan2(y2 - y, r - r2);
      const dorm = dormer(tier.s, tier.kind);
      dorm.applyMatrix4(trs(r + 0.2, y, 0, 0, 1, 1, 1, 0, slope * 0.0));
      dorm.applyMatrix4(new THREE.Matrix4().makeRotationY(-ma));
      b.add(M.leadRib, dorm);
      const glass = boxAt(0.2, y + 0.3 * tier.s, y + 1.6 * tier.s, 0.9 * tier.s, r + 0.2 + 0.9 * tier.s);
      glass.applyMatrix4(new THREE.Matrix4().makeRotationY(-ma));
      b.add(M.dark, glass);
    }
  }
  // 燈籠亭
  const L0 = D.shellTop;
  b.add(T, lathe([[D.lanternRadius + 1.4, L0 - 0.4], [D.lanternRadius + 1.4, L0 + 1.4], [D.lanternRadius + 0.8, L0 + 1.6], [0.0, L0 + 1.6]], 48));
  b.add(T, cylAt(D.lanternRadius - 0.9, D.lanternRadius - 0.9, L0 + 1.6, D.lanternTop - 2.2, 0, 0, 48, true));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    // 雙柱扶壁
    const but = boxAt(0.9, L0 + 1.6, D.lanternTop - 2.2, 2.4);
    but.applyMatrix4(trs(ca * (D.lanternRadius - 0.1), 0, sa * (D.lanternRadius - 0.1), -a));
    b.add(TS, but);
    for (const off of [-0.55, 0.55]) {
      const px = ca * (D.lanternRadius + 0.5) - sa * off, pz = sa * (D.lanternRadius + 0.5) + ca * off;
      b.add(TS, cylAt(0.28, 0.24, L0 + 1.6, D.lanternTop - 2.6, px, pz, 8));
    }
    // 窗
    const wa = a + Math.PI / 16;
    const win = boxAt(0.2, L0 + 3.2, L0 + 8.5, 1.3);
    win.applyMatrix4(trs(Math.cos(wa) * (D.lanternRadius - 0.85), 0, Math.sin(wa) * (D.lanternRadius - 0.85), -wa));
    b.add(M.dark, win);
  }
  b.add(T, lathe([[0, D.lanternTop - 2.6], [D.lanternRadius + 1.0, D.lanternTop - 2.6], [D.lanternRadius + 1.2, D.lanternTop - 1.6], [D.lanternRadius + 0.6, D.lanternTop - 1.3], [D.lanternRadius + 0.6, D.lanternTop], [0, D.lanternTop]], 48));
  // 燭台裝飾
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const c = lathe([[0.3, 0], [0.3, 0.5], [0.15, 0.8], [0.25, 1.4], [0.05, 2.2], [0, 2.4]], 8);
    c.translate(Math.cos(a) * (D.lanternRadius + 0.4), D.lanternTop, Math.sin(a) * (D.lanternRadius + 0.4));
    b.add(TS, c);
  }
  // 錐頂（鉛）+ 球 + 十字
  b.add(M.lead, lathe([[D.lanternRadius - 0.2, D.lanternTop], [D.lanternRadius - 1.2, D.lanternTop + 1.2], [3.2, D.lanternTop + 2.6], [1.2, D.coneTop - 0.6], [0.45, D.coneTop]], 32));
  b.add(TS, lathe([[0, D.coneTop - 0.1], [0.9, D.coneTop], [0.6, D.coneTop + 0.3], [0.3, D.ballCenter - 1.0]], 16));
  const ball = new THREE.SphereGeometry(1.25, 24, 16);
  ball.translate(0, D.ballCenter, 0);
  b.add(M.gilded, ball);
  b.add(M.gilded, boxAt(0.32, D.ballCenter + 1.1, D.crossTop, 0.32));
  b.add(M.gilded, boxAt(0.3, D.crossTop - 2.1, D.crossTop - 1.65, 1.9));
}

/** 沿外殼剖面的肋 */
function ribAlong(prof: [number, number][], w: number, h: number) {
  const pos: number[] = [];
  const P = (r: number, y: number, z: number) => [r, y, z];
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
    // 法向（剖面向外）
    const tx = r1 - r0, ty = y1 - y0;
    const l = Math.hypot(tx, ty);
    const nx = ty / l, ny = -tx / l;
    const a0 = P(r0 + nx * h, y0 + ny * h, -w / 2), b0 = P(r0 + nx * h, y0 + ny * h, w / 2);
    const a1 = P(r1 + nx * h, y1 + ny * h, -w / 2), b1 = P(r1 + nx * h, y1 + ny * h, w / 2);
    const c0 = P(r0, y0, -w / 2), d0 = P(r0, y0, w / 2), c1 = P(r1, y1, -w / 2), d1 = P(r1, y1, w / 2);
    // 頂面
    pos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1);
    // 側面
    pos.push(...c0, ...a0, ...a1, ...c0, ...a1, ...c1);
    pos.push(...d0, ...d1, ...b1, ...d0, ...b1, ...b0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return fixWinding(g);
}

/** 確保三角形朝外（以 (x,z) 徑向判斷） */
function fixWinding(g: THREE.BufferGeometry) {
  const p = g.attributes.position.array as Float32Array;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), cen = new THREE.Vector3();
  for (let i = 0; i < p.length; i += 9) {
    a.fromArray(p, i); b.fromArray(p, i + 3); c.fromArray(p, i + 6);
    n.subVectors(b, a).cross(c.clone().sub(a));
    cen.copy(a).add(b).add(c).divideScalar(3);
    // 期望法線朝外：與 (x, *, z)、或向上 的方向一致
    const out = new THREE.Vector3(cen.x, 0, cen.z).normalize();
    const side = Math.abs(n.z) > Math.abs(n.x) * 2 && Math.abs(n.z) > Math.abs(n.y) * 2;
    let ok: boolean;
    if (side) ok = n.z * Math.sign(cen.z || 1) > 0;
    else ok = n.dot(out) + n.y * 0.5 > 0;
    if (!ok) {
      for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    }
  }
  g.attributes.position.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** 半圓盤（軸向沿 X），用於弧形山花 */
export function halfDisc(r: number, depth: number, x: number, y: number, squash = 1) {
  const c = new THREE.CylinderGeometry(r, r, depth, 16, 1, false, 0, Math.PI);
  c.rotateZ(Math.PI / 2);
  c.scale(1, squash, 1);
  c.translate(x, y, 0);
  return c;
}

function dormer(s: number, kind: number) {
  const g: THREE.BufferGeometry[] = [boxAt(1.8 * s, 0, 1.9 * s, 1.5 * s, 0.75 * s)];
  if (kind === 0) g.push(pediment(1.05 * s, 1.9 * s, 2.6 * s, 1.7 * s, 0.75 * s));
  else if (kind === 1) g.push(halfDisc(0.95 * s, 1.6 * s, 0.75 * s, 1.9 * s));
  else g.push(boxAt(1.5 * s, 1.9 * s, 2.2 * s, 1.3 * s, 0.75 * s));
  const out = mergeGeometries(g.map((m) => {
    const n = m.index ? m.toNonIndexed() : m;
    for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
    return n;
  }), false)!;
  return out;
}

/** 維尼奧拉 / 德拉·波爾塔設計的四座小穹頂與中殿側邊橢圓小穹頂 */
export function buildMinorDome(b: GeoBucket, M: MaterialLibrary, x: number, z: number, R: number, base: number, drumTop: number, shellTop: number, lanternTop: number, sx = 1, sz = 1) {
  const add = (mat: THREE.Material, geo: THREE.BufferGeometry) => { geo.scale(sx, 1, sz); geo.translate(x, 0, z); b.add(mat, geo); };
  add(M.travertine, lathe([[0, base], [R + 0.8, base], [R + 0.8, base + 1.0], [R, base + 1.2], [R, drumTop - 1.0], [R + 0.6, drumTop - 0.6], [R + 0.6, drumTop], [R - 0.3, drumTop]], 32));
  // 鼓座小柱
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const c = cylAt(0.32, 0.28, base + 1.2, drumTop - 1.0, Math.cos(a) * (R + 0.35), Math.sin(a) * (R + 0.35), 8);
    add(M.travertineSmooth, c);
    const wa = a + Math.PI / 8;
    const w = boxAt(0.2, base + 2.2, drumTop - 2.2, 1.4);
    w.applyMatrix4(trs(Math.cos(wa) * (R + 0.02), 0, Math.sin(wa) * (R + 0.02), -wa));
    add(M.dark, w);
  }
  const prof = shellProfile(R - 0.3, drumTop, shellTop, 1.4, 20);
  add(M.lead, lathe(prof, 48));
  for (let i = 0; i < 8; i++) {
    const rib = ribAlong(prof, 0.3, 0.25);
    rib.applyMatrix4(new THREE.Matrix4().makeRotationY(-(i / 8) * Math.PI * 2));
    add(M.leadRib, rib);
  }
  add(M.travertine, lathe([[1.9, shellTop - 0.2], [1.9, shellTop + 0.4], [1.4, shellTop + 0.5], [1.4, lanternTop - 1.6], [1.8, lanternTop - 1.3], [1.6, lanternTop - 1.0], [0.6, lanternTop - 0.3], [0.2, lanternTop]], 16));
  add(M.gilded, lathe([[0, lanternTop], [0.35, lanternTop + 0.3], [0, lanternTop + 0.7]], 10));
  add(M.gilded, boxAt(0.12, lanternTop + 0.6, lanternTop + 2.0, 0.12));
  add(M.gilded, boxAt(0.1, lanternTop + 1.45, lanternTop + 1.6, 0.7));
}
