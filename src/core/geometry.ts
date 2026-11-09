import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Vec2 } from './geo';

/** 依材質累積幾何，最後合併為少量網格以提升效能 */
export class GeoBucket {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();

  add(mat: THREE.Material, geo: THREE.BufferGeometry, matrix?: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    // 只保留 position / normal（材質使用三平面貼圖）
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    let arr = this.parts.get(mat);
    if (!arr) this.parts.set(mat, (arr = []));
    arr.push(g);
  }

  build(group: THREE.Object3D, opts: { cast?: boolean; receive?: boolean; name?: string } = {}) {
    for (const [mat, geos] of this.parts) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = opts.cast ?? true;
      mesh.receiveShadow = opts.receive ?? true;
      mesh.name = opts.name ?? '';
      group.add(mesh);
    }
    this.parts.clear();
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

export function trs(x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0): THREE.Matrix4 {
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return _m.clone().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/** 中心在 (x, y0..y1, z) 的方塊 */
export function boxAt(w: number, y0: number, y1: number, d: number, x = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, y1 - y0, d);
  g.applyMatrix4(trs(x, (y0 + y1) / 2, z, ry));
  return g;
}

export function cylAt(r0: number, r1: number, y0: number, y1: number, x = 0, z = 0, seg = 24, open = false) {
  const g = new THREE.CylinderGeometry(r1, r0, y1 - y0, seg, 1, open);
  g.translate(x, (y0 + y1) / 2, z);
  return g;
}

/** 由剖面 (r, y) 旋轉成形 */
export function lathe(profile: [number, number][], seg = 32, x = 0, z = 0, phiStart = 0, phiLen = Math.PI * 2) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), seg, phiStart, phiLen);
  g.translate(x, 0, z);
  return g;
}

/** 三角柱（山花） */
export function pediment(halfW: number, y0: number, apex: number, depth: number, x: number, z = 0, ry = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfW, 0);
  shape.lineTo(halfW, 0);
  shape.lineTo(0, apex - y0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  // shape 在 XY 平面，擠出沿 +Z；轉為：寬沿 Z、深沿 X
  g.rotateY(Math.PI / 2);
  g.translate(x - depth / 2, y0, z);
  if (ry) g.rotateY(ry);
  return g;
}

/** 拱形開口（半圓頂）平面形狀 */
export function archShape(halfW: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  const spring = h - halfW;
  s.moveTo(-halfW, 0);
  s.lineTo(halfW, 0);
  s.lineTo(halfW, spring);
  s.absarc(0, spring, halfW, 0, Math.PI, false);
  s.lineTo(-halfW, 0);
  return s;
}

export interface FacadeAttrs { tint: THREE.Color; seed: number; shop: number; style: number; groundH: number; }

/**
 * 將多邊形擠出成牆面 + 屋頂，並寫入立面座標屬性
 * 輸出含 aFacade / aTint / aMeta，供 plaster 材質的程序化立面使用
 */
export class FacadeBuilder {
  pos: number[] = [];
  nor: number[] = [];
  fac: number[] = [];
  tint: number[] = [];
  meta: number[] = [];

  private push(p: number[], n: number[], f: number[], a: FacadeAttrs) {
    this.pos.push(...p);
    this.nor.push(...n);
    this.fac.push(...f);
    this.tint.push(a.tint.r, a.tint.g, a.tint.b);
    this.meta.push(a.seed, a.shop, a.style, a.groundH);
  }

  /**
   * ring：逆時針或順時針皆可；y0..y1 牆高
   * inward = true 時牆面朝向環內（中庭的牆，從中庭內看得到）
   */
  walls(ring: Vec2[], y0: number, y1: number, a: FacadeAttrs, shopEdges?: Set<number>, inward = false) {
    const n = ring.length;
    const ccw = (signedArea(ring) > 0) !== inward;
    const H = y1 - y0;
    for (let i = 0; i < n; i++) {
      const p0 = ring[i], p1 = ring[(i + 1) % n];
      const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
      const L = Math.hypot(dx, dz);
      if (L < 0.01) continue;
      // 外法線
      let nx = dz / L, nz = -dx / L;
      if (!ccw) { nx = -nx; nz = -nz; }
      // 確保三角形朝外
      const [a0, a1] = ccw ? [p1, p0] : [p0, p1];
      const u0 = ccw ? L : 0, u1 = ccw ? 0 : L;
      const shop = shopEdges ? (shopEdges.has(i) ? 1 : 0) : a.shop;
      const attrs = { ...a, shop };
      const v = (x: number, z: number, y: number, u: number) => this.push([x, y, z], [nx, 0, nz], [u, y - y0, L, H], attrs);
      v(a0[0], a0[1], y0, u0); v(a1[0], a1[1], y0, u1); v(a1[0], a1[1], y1, u1);
      v(a0[0], a0[1], y0, u0); v(a1[0], a1[1], y1, u1); v(a0[0], a0[1], y1, u0);
    }
  }

  /** 平頂（down = true 時為朝下的底面，用於懸空的建築部件） */
  cap(outer: Vec2[], holes: Vec2[][], y: number, a: FacadeAttrs, H: number, down = false) {
    for (const [A, B, C] of safeTriangulate(outer, holes)) {
      // 法線向上：(B-A)x(C-A) 的 y 分量 > 0 對應 cross < 0
      const cross = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      const up = cross < 0;
      const order = up !== down ? [A, B, C] : [A, C, B];
      for (const P of order) this.push([P[0], y, P[1]], [0, down ? -1 : 1, 0], [0, H + 1, 1, H], a);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aFacade', new THREE.Float32BufferAttribute(this.fac, 4));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.tint, 3));
    g.setAttribute('aMeta', new THREE.Float32BufferAttribute(this.meta, 4));
    g.computeBoundingSphere();
    return g;
  }

  get empty() { return this.pos.length === 0; }
}

/**
 * 三角化（含中庭），並檢查結果：OSM 多邊形偶有自交或內環碰到外環，
 * 造成三角形溢出建築外（屋頂飄在空中）或缺塊。面積不符時，只保留質心落在
 * 多邊形內、且不在中庭內的三角形。
 */
export function safeTriangulate(outer: Vec2[], holes: Vec2[][] = []): [Vec2, Vec2, Vec2][] {
  const contour = outer.map((p) => new THREE.Vector2(p[0], p[1]));
  const hs = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
  const idx = THREE.ShapeUtils.triangulateShape(contour, hs);
  const all: Vec2[] = [...outer, ...holes.flat()];
  let tris: [Vec2, Vec2, Vec2][] = idx.map((t) => [all[t[0]], all[t[1]], all[t[2]]]);
  const triArea = (t: [Vec2, Vec2, Vec2]) => Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[1][1] - t[0][1]) * (t[2][0] - t[0][0])) / 2;
  const target = Math.abs(signedArea(outer)) - holes.reduce((s, h) => s + Math.abs(signedArea(h)), 0);
  const got = tris.reduce((s, t) => s + triArea(t), 0);
  if (target > 0 && Math.abs(got - target) / target > 0.03) {
    const inside = (x: number, z: number, ring: Vec2[]) => {
      let r = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], zi = ring[i][1], xj = ring[j][0], zj = ring[j][1];
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) r = !r;
      }
      return r;
    };
    tris = tris.filter((t) => {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cz = (t[0][1] + t[1][1] + t[2][1]) / 3;
      return inside(cx, cz, outer) && !holes.some((h) => inside(cx, cz, h));
    });
  }
  return tris;
}

export function signedArea(pts: Vec2[]) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return a / 2;
}

/** 平面多邊形（xz）三角化為水平面幾何 */
export function flatPolygon(outer: Vec2[], holes: Vec2[][] = [], y = 0): THREE.BufferGeometry {
  const pos: number[] = [];
  for (const [A, B, C] of safeTriangulate(outer, holes)) {
    const cross = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
    const order = cross < 0 ? [A, B, C] : [A, C, B];
    for (const P of order) pos.push(P[0], y, P[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const n = new Float32Array(pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

/** 沿折線產生帶狀面（道路） */
export function ribbon(pts: Vec2[], width: number, y: number): THREE.BufferGeometry | null {
  if (pts.length < 2) return null;
  const pos: number[] = [];
  const hw = width / 2;
  const left: Vec2[] = [], right: Vec2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    left.push([p[0] - dz * hw, p[1] + dx * hw]);
    right.push([p[0] + dz * hw, p[1] - dx * hw]);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const l0 = left[i], l1 = left[i + 1], r0 = right[i], r1 = right[i + 1];
    pos.push(l0[0], y, l0[1], r0[0], y, r0[1], r1[0], y, r1[1]);
    pos.push(l0[0], y, l0[1], r1[0], y, r1[1], l1[0], y, l1[1]);
  }
  // 修正朝向
  for (let i = 0; i < pos.length; i += 9) {
    const ax = pos[i], az = pos[i + 2], bx = pos[i + 3], bz = pos[i + 5], cx = pos[i + 6], cz = pos[i + 8];
    const cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    if (cross > 0) {
      pos[i + 3] = cx; pos[i + 5] = cz; pos[i + 6] = bx; pos[i + 8] = bz;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const n = new Float32Array(pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  return g;
}

/** 沿頂點斜接方向外擴（grow > 0）或內縮多邊形 */
export function offsetRing(ring: Vec2[], grow: number): Vec2[] {
  const n = ring.length;
  const sgn = signedArea(ring) > 0 ? 1 : -1;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p = ring[i], a = ring[(i - 1 + n) % n], c = ring[(i + 1) % n];
    const e1 = [p[0] - a[0], p[1] - a[1]], e2 = [c[0] - p[0], c[1] - p[1]];
    const l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
    const n1 = [(e1[1] / l1) * sgn, (-e1[0] / l1) * sgn], n2 = [(e2[1] / l2) * sgn, (-e2[0] / l2) * sgn];
    let nx = n1[0] + n2[0], nz = n1[1] + n2[1];
    const l = Math.hypot(nx, nz) || 1;
    nx /= l; nz /= l;
    const cos = Math.max(0.4, nx * n1[0] + nz * n1[1]);
    out.push([p[0] + (nx * grow) / cos, p[1] + (nz * grow) / cos]);
  }
  return out;
}
