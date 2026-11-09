// 經緯度 → 本地公尺座標（以聖彼得廣場方尖碑為原點）
// X = 東, Y = 上, Z = 南（three.js 右手座標系，北方為 -Z）

export const ORIGIN = { lat: 41.902223, lon: 12.457263 }; // Obelisco Vaticano
export const ROME = { lat: 41.9022, lon: 12.4539 };

const phi = (ORIGIN.lat * Math.PI) / 180;
// WGS84 每度長度（公尺）
const M_PER_DEG_LAT = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
const M_PER_DEG_LON = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);

export function toLocal(lat: number, lon: number): [number, number] {
  return [(lon - ORIGIN.lon) * M_PER_DEG_LON, -(lat - ORIGIN.lat) * M_PER_DEG_LAT];
}

export type Vec2 = [number, number];

export function polygonArea(pts: Vec2[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return a / 2;
}

export function pointInPolygon(x: number, z: number, pts: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1], xj = pts[j][0], zj = pts[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function centroid(pts: Vec2[]): Vec2 {
  let x = 0, z = 0;
  for (const p of pts) { x += p[0]; z += p[1]; }
  return [x / pts.length, z / pts.length];
}

/** 去除重複的首尾點與極短邊 */
export function cleanRing(pts: Vec2[], minLen = 0.05): Vec2[] {
  const out: Vec2[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > minLen) out.push(p);
  }
  if (out.length > 2) {
    const a = out[0], b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= minLen) out.pop();
  }
  return out;
}

/** Sutherland–Hodgman：以半平面 dot(n, p) <= d 裁切多邊形 */
export function clipPolygon(pts: Vec2[], nx: number, nz: number, d: number): Vec2[] {
  const out: Vec2[] = [];
  const inside = (p: Vec2) => nx * p[0] + nz * p[1] <= d;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const da = nx * a[0] + nz * a[1] - d, db = nx * b[0] + nz * b[1] - d;
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** 由鍵產生 0..1 的穩定亂數 */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
