import * as THREE from 'three';
import { IN, CH } from './Interior';

/**
 * 導覽移動的避障路徑：以矩形障礙物（巨柱、中殿連拱柱、入口牆、祭台區、各臂牆）建立可視圖，
 * 用 Dijkstra 找出最短折線，鏡頭沿此折線滑行，不會穿牆。座標為 (x, z)。
 */
type Box = [number, number, number, number]; // x0, x1, z0, z1

const PAD = 0.8;
const boxes: Box[] = (() => {
  const W = IN.halfW, P = IN.pierOuter, out: Box[] = [];
  const both = (x0: number, x1: number, a0: number, a1: number) => { out.push([x0, x1, a0, a1], [x0, x1, -a1, -a0]); };
  // 交叉處四巨柱（含側廊盡頭）
  for (const sx of [-1, 1]) both(Math.min(sx * W, sx * P), Math.max(sx * W, sx * P), W, IN.aisleOuter);
  // 中殿連拱柱（含兩側壁柱、側廊側紀念碑）
  for (let i = 0; i <= 6; i++) {
    const cx = P + i * IN.bayW;
    both(Math.max(P, cx - (IN.bayW / 2 - IN.arcHW)), Math.min(IN.naveEnd, cx + (IN.bayW / 2 - IN.arcHW)), W - 1.2, IN.aisleInner + 2.2);
  }
  // 入口牆（中央大門開口 |z| < 2.4）
  both(IN.naveEnd - 0.4, IN.naveEnd + IN.wallT + 0.4, 2.4, IN.vestibule + 4);
  // 教宗祭台、華蓋與告解堂
  out.push([-7.5, 14.5, -7.5, 7.5]);
  // 兩耳堂東側牆外
  both(W - 0.5, 90, P - 2, 90);
  // 西側：後殿臂、兩座後殿轉角禮拜堂與通道以外的實心區域
  const cL = CH.corrX - CH.corrHW, cR = CH.corrX + CH.corrHW;
  both(-90, CH.x0 - 0.5, W - 0.5, 90); // 禮拜堂以西
  both(CH.x0 - 0.5, cL - 0.5, W - 0.5, CH.z0 - 0.5); // 迴廊以西
  both(cR + 0.5, CH.x1, W - 0.5, CH.z0 - 0.5); // 迴廊以東
  both(CH.x0 - 0.5, -W + 0.5, CH.z1 + 0.5, 90); // 禮拜堂以南（北）
  both(CH.x1 + 0.5, -W + 0.5, P - 2, CH.transZ - CH.transHW - 0.5); // 巨柱與通道之間
  both(CH.x1 + 0.5, -W + 0.5, CH.transZ + CH.transHW + 0.5, CH.z1 + 0.5); // 通道以南（北）
  // 聖彼得青銅像、聖水盆
  out.push([28, 31, -14.2, -11]);
  both(101.6, 104.4, 11.4, W);
  return out.map(([a, b, c, d]) => [a - PAD, b + PAD, c - PAD, d + PAD] as Box);
})();

const inside = (b: Box, x: number, z: number) => x > b[0] && x < b[1] && z > b[2] && z < b[3];

/** 線段是否穿過矩形內部（Liang–Barsky，略縮 1 cm 使沿邊行走合法） */
function hits(b: Box, ax: number, az: number, bx: number, bz: number) {
  const e = 0.01, x0 = b[0] + e, x1 = b[1] - e, z0 = b[2] + e, z1 = b[3] - e;
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - z0], [dz, z1 - az]] as [number, number][]) {
    if (Math.abs(p) < 1e-9) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return t0 < t1;
}

/** 從 a 到 b 的避障路徑（含 a、b），y 由 a、b 線性內插 */
export function navPath(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
  const obs = boxes.filter((o) => !inside(o, a.x, a.z) && !inside(o, b.x, b.z));
  const clear = (p: number[], q: number[]) => obs.every((o) => !hits(o, p[0], p[1], q[0], q[1]));
  if (clear([a.x, a.z], [b.x, b.z])) return [a.clone(), b.clone()];
  const nodes: number[][] = [[a.x, a.z], [b.x, b.z]];
  for (const o of obs) for (const x of [o[0], o[1]]) for (const z of [o[2], o[3]]) {
    if (!obs.some((q) => inside(q, x, z))) nodes.push([x, z]);
  }
  const n = nodes.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity || u === 1) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v]) continue;
      const d = Math.hypot(nodes[u][0] - nodes[v][0], nodes[u][1] - nodes[v][1]);
      if (dist[u] + d < dist[v] && clear(nodes[u], nodes[v])) { dist[v] = dist[u] + d; prev[v] = u; }
    }
  }
  if (prev[1] < 0) return [a.clone(), b.clone()];
  const idx: number[] = [];
  for (let v = 1; v >= 0; v = prev[v]) { idx.unshift(v); if (v === 0) break; }
  const total = dist[1];
  let acc = 0;
  return idx.map((k, j) => {
    if (j > 0) acc += Math.hypot(nodes[k][0] - nodes[idx[j - 1]][0], nodes[k][1] - nodes[idx[j - 1]][1]);
    return new THREE.Vector3(nodes[k][0], THREE.MathUtils.lerp(a.y, b.y, acc / total), nodes[k][1]);
  });
}

/** 折線 → 依弧長取點 */
export class Polyline {
  private cum: number[] = [0];
  readonly length: number;
  constructor(private pts: THREE.Vector3[]) {
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.length = this.cum[this.cum.length - 1];
  }
  at(t: number, out: THREE.Vector3) {
    const d = THREE.MathUtils.clamp(t, 0, 1) * this.length;
    let i = 1;
    while (i < this.pts.length - 1 && this.cum[i] < d) i++;
    const seg = this.cum[i] - this.cum[i - 1] || 1;
    return out.lerpVectors(this.pts[i - 1], this.pts[i], (d - this.cum[i - 1]) / seg);
  }
}
