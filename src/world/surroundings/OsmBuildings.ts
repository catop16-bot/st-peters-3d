import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { FacadeBuilder, GeoBucket, signedArea } from '../../core/geometry';
import { toLocal, cleanRing, centroid, pointInPolygon, polygonArea, hash01, type Vec2 } from '../../core/geo';
import type { MaterialLibrary } from '../../core/materials';
import { G } from '../../core/materials';

export interface OsmBuilding { id: string; tags: Record<string, string>; rings: { role: string; pts: [number, number][] }[]; }
export interface Poi { lat: number; lon: number; name: string; kind: string; }

interface Prepared {
  id: string;
  tags: Record<string, string>;
  outer: Vec2[];
  holes: Vec2[][];
  c: Vec2;
  area: number;
  minH: number;
  H: number;
  isPart: boolean;
  style: number;
  tint: THREE.Color;
  seed: number;
  stone: boolean;
  /** 屬於大教堂整體的建築（廣場兩側直走廊）：不受淨空裁切 */
  keep?: boolean;
  shopEdges: Set<number>;
  roof: 'flat' | 'hip' | 'dome' | 'none';
  roofMat: 'tiles' | 'flat' | 'lead';
}

const PALETTE = [
  [0.86, 0.66, 0.38], [0.74, 0.4, 0.26], [0.88, 0.6, 0.45], [0.91, 0.83, 0.66], [0.93, 0.79, 0.52],
  [0.68, 0.43, 0.29], [0.89, 0.86, 0.78], [0.82, 0.55, 0.32], [0.95, 0.72, 0.48], [0.78, 0.5, 0.36],
].map(([r, g, b]) => new THREE.Color(r, g, b));

const NAMED_COLORS: Record<string, string> = {
  lightyellow: '#efe2b8', yellow: '#e2bf6c', beige: '#e3d3b0', white: '#ece8de', orange: '#d8935a', red: '#b2553a',
  brown: '#9a6a48', grey: '#a8a49c', gray: '#a8a49c', lightcoral: '#cf8f7a', pink: '#dfa48e', cream: '#eadcbc', tan: '#cfae84',
};

function parseNum(v?: string): number | undefined {
  if (!v) return undefined;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

export interface CityResult { group: THREE.Group; signs: THREE.InstancedMesh | null; footprints: { outer: Vec2[]; H: number }[]; }

export function buildCity(M: MaterialLibrary, buildings: OsmBuilding[], pois: Poi[], exclude: { polys: Vec2[][]; ids: Set<string>; names: Set<string>; clearance?: Vec2[][] }): CityResult {
  const group = new THREE.Group();
  group.name = 'city';
  const prepared: Prepared[] = [];
  // 廣場兩側直走廊（Braccio）：以完整外框從地面建到頂，其內部的 OSM 零件不重複繪製
  const CORRIDOR = /Braccio di (Costantino|Carlo Magno)/;
  const corridorRings = buildings.filter((b) => CORRIDOR.test(b.tags.name ?? '')).map((b) => cleanRing(b.rings[0].pts.map(([la, lo]) => toLocal(la, lo))));

  for (const b of buildings) {
    if (exclude.ids.has(b.id)) continue;
    const t = b.tags;
    if (t.name && exclude.names.has(t.name)) continue;
    if (t.building === 'roof' || t['building:part'] === 'roof' || t.location === 'underground') continue;
    if (t['building:part'] === 'steps' || t['building:part'] === 'column') continue;
    const outers = b.rings.filter((r) => r.role !== 'inner');
    if (!outers.length) continue;
    // 只取最大外環
    let outer: Vec2[] = [];
    for (const r of outers) {
      const pts = cleanRing(r.pts.map(([la, lo]) => toLocal(la, lo)));
      if (pts.length > outer.length) outer = pts;
    }
    if (outer.length < 3) continue;
    const holes = b.rings.filter((r) => r.role === 'inner').map((r) => cleanRing(r.pts.map(([la, lo]) => toLocal(la, lo)))).filter((h) => h.length >= 3);
    const c = centroid(outer);
    if (exclude.polys.some((p) => pointInPolygon(c[0], c[1], p))) continue;
    const area = Math.abs(polygonArea(outer));
    if (area < 4) continue;
    const isPart = !!t['building:part'];
    if (isPart && corridorRings.some((r) => pointInPolygon(c[0], c[1], r))) continue;
    const levels = parseNum(t['building:levels']);
    let H = parseNum(t.height);
    const seed = hash01(parseInt(b.id.slice(1), 10) % 100000);
    if (H === undefined) {
      if (levels !== undefined) H = levels * 3.35 + 1.4;
      else if (area < 30) H = 3.5 + seed * 2;
      else if (t.building === 'church' || t.building === 'chapel') H = 18 + seed * 6;
      else H = 14 + seed * 8 + Math.min(area / 400, 4);
    }
    let minH = parseNum(t.min_height) ?? 0;
    if (minH === 0 && parseNum(t['building:min_level'])) minH = parseNum(t['building:min_level'])! * 3.35;
    if (H - minH < 1) continue;

    const vatican = c[0] < -60 && !(c[1] > 120 && c[0] > -250); // 大致位於梵蒂岡城內
    let style = 0;
    let stone = false;
    let tint = PALETTE[Math.floor(seed * PALETTE.length)].clone();
    const col = t['building:colour'];
    if (col) {
      try { tint = new THREE.Color(NAMED_COLORS[col] ?? col); } catch { /* 忽略無法解析的顏色 */ }
    }
    let keep = false;
    if (t.name && CORRIDOR.test(t.name)) {
      // OSM 將 Braccio di Costantino 標為 min_height 15（只畫屋頂層），實際是落地的走廊建築
      style = 2; stone = true; tint = new THREE.Color(1, 1, 1); H = 17.0; minH = 0; keep = true;
    } else if (vatican && area > 900) {
      style = 3; tint = new THREE.Color(0.93, 0.85, 0.66).lerp(tint, 0.25);
    } else if (area > 6000) {
      style = 3;
    }
    if (t.building === 'church' || t.building === 'basilica' || t.building === 'chapel') { style = 3; tint = new THREE.Color(0.92, 0.86, 0.72); }

    let roof: Prepared['roof'] = 'flat';
    const rs = t['roof:shape'];
    if (rs === 'dome') roof = 'dome';
    else if (rs === 'hipped' || rs === 'gabled' || rs === 'pyramidal') roof = 'hip';
    else if (!rs && !isPart && area < 1800 && area > 25 && !vatican) roof = 'hip';
    else if (!rs && !isPart && vatican && area < 1200) roof = 'hip';
    const roofMat: Prepared['roofMat'] = t['roof:material'] === 'copper' || t['roof:material'] === 'lead' ? 'lead' : vatican && area > 1500 ? 'flat' : 'tiles';

    prepared.push({ id: b.id, tags: t, outer, holes, c, area, minH, H, isPart, style, tint, seed, stone, keep, shopEdges: new Set(), roof, roofMat });
  }

  // ── 與大教堂主體保持間距：將「主體輪廓外擴數公尺」的範圍從鄰近建築中挖除 ──
  // OSM 中緊貼或與教堂輪廓重疊的建築，會穿進手工建模的教堂牆面
  if (exclude.clearance && exclude.clearance.length) {
    const zone = polygonClipping.union(...exclude.clearance.map((r) => [r.map((q) => [q[0], q[1]] as [number, number])]) as [[[number, number][]], ...[[number, number][]][]]);
    const allPts = exclude.clearance.flat();
    const zx = allPts.map((q) => q[0]), zz = allPts.map((q) => q[1]);
    const zb = [Math.min(...zx), Math.max(...zx), Math.min(...zz), Math.max(...zz)];
    const cut: Prepared[] = [];
    for (const p of prepared) {
      if (p.keep) { cut.push(p); continue; }
      const xs = p.outer.map((q) => q[0]), zs = p.outer.map((q) => q[1]);
      if (Math.max(...xs) < zb[0] || Math.min(...xs) > zb[1] || Math.max(...zs) < zb[2] || Math.min(...zs) > zb[3]) { cut.push(p); continue; }
      let res: [number, number][][][];
      try {
        res = polygonClipping.difference([p.outer, ...p.holes].map((r) => r.map((q) => [q[0], q[1]] as [number, number])), zone);
      } catch { cut.push(p); continue; }
      res.forEach((poly, k) => {
        const rings = poly.map((r) => cleanRing(r.map((q) => [q[0], q[1]] as Vec2)));
        const [o, ...hs] = rings;
        if (!o || o.length < 3) return;
        const holes = hs.filter((h) => h.length >= 3);
        const A = Math.abs(polygonArea(o)) - holes.reduce((s2, h) => s2 + Math.abs(polygonArea(h)), 0);
        // 去除挖除後殘留的細長碎片（平均寬度 < 4 m 或面積太小）
        let per = 0;
        for (let i = 0; i < o.length; i++) { const q0 = o[i], q1 = o[(i + 1) % o.length]; per += Math.hypot(q1[0] - q0[0], q1[1] - q0[1]); }
        if (A < 25 || A / (per / 2) < 4) return;
        cut.push({ ...p, id: `${p.id}#${k}`, outer: o, holes, c: centroid(o), area: A, shopEdges: new Set() });
      });
    }
    prepared.length = 0;
    prepared.push(...cut);
  }

  // 有 building:part 的建築外框不重複繪製
  const parts = prepared.filter((p) => p.isPart);
  const partGrid = new Map<string, Prepared[]>();
  const key = (x: number, z: number) => `${Math.floor(x / 40)},${Math.floor(z / 40)}`;
  for (const p of parts) {
    const k = key(p.c[0], p.c[1]);
    (partGrid.get(k) ?? partGrid.set(k, []).get(k)!).push(p);
  }
  // 只有在 building:part 幾乎完整覆蓋外框時才省略外框；
  // OSM 常只畫出部分 part（塔樓、穹頂），若直接省略外框，建築會缺一大塊
  const final = prepared.filter((p) => {
    if (p.isPart) return true;
    const xs = p.outer.map((q) => q[0]), zs = p.outer.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    let covered = 0, any = false;
    for (let gx = Math.floor(x0 / 40); gx <= Math.floor(x1 / 40); gx++)
      for (let gz = Math.floor(z0 / 40); gz <= Math.floor(z1 / 40); gz++)
        for (const q of partGrid.get(`${gx},${gz}`) ?? []) if (pointInPolygon(q.c[0], q.c[1], p.outer)) {
          any = true;
          if (q.minH < 0.5) covered += q.area;
        }
    if (!any) return true;
    if (covered / p.area >= 0.9) return false;
    // 保留外框作為主體量；改為平頂，避免四坡屋頂與 part 互相穿插
    p.roof = 'flat';
    return true;
  });

  // ── 店家：找最近的牆段 ──
  interface Edge { b: Prepared; i: number; a: Vec2; c: Vec2; }
  const edgeGrid = new Map<string, Edge[]>();
  const ek = (x: number, z: number) => `${Math.floor(x / 25)},${Math.floor(z / 25)}`;
  for (const p of final) {
    if (p.minH > 0.5 || p.H < 5 || p.stone) continue;
    for (let i = 0; i < p.outer.length; i++) {
      const a = p.outer[i], c2 = p.outer[(i + 1) % p.outer.length];
      if (Math.hypot(c2[0] - a[0], c2[1] - a[1]) < 2.5) continue;
      const m: Vec2 = [(a[0] + c2[0]) / 2, (a[1] + c2[1]) / 2];
      const k = ek(m[0], m[1]);
      (edgeGrid.get(k) ?? edgeGrid.set(k, []).get(k)!).push({ b: p, i, a, c: c2 });
    }
  }
  interface SignSpec { name: string; kind: string; x: number; z: number; nx: number; nz: number; w: number; }
  const signs: SignSpec[] = [];
  const sorted = pois.map((p) => ({ ...p, loc: toLocal(p.lat, p.lon) })).sort((a, b) => Math.hypot(...a.loc) - Math.hypot(...b.loc));
  const usedSpots: Vec2[] = [];
  for (const poi of sorted) {
    if (signs.length >= 500) break;
    if (poi.kind.startsWith('tourism:information')) continue;
    const [px, pz] = poi.loc;
    let best: Edge | null = null, bestD = 18, bestT = 0;
    for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) {
      for (const e of edgeGrid.get(`${Math.floor(px / 25) + gx},${Math.floor(pz / 25) + gz}`) ?? []) {
        const dx = e.c[0] - e.a[0], dz = e.c[1] - e.a[1];
        const L2 = dx * dx + dz * dz;
        const t = THREE.MathUtils.clamp(((px - e.a[0]) * dx + (pz - e.a[1]) * dz) / L2, 0.1, 0.9);
        const d = Math.hypot(e.a[0] + dx * t - px, e.a[1] + dz * t - pz);
        // 只選面向道路的牆（法線方向需朝向 POI 一側或外部）
        if (d < bestD) { bestD = d; best = e; bestT = t; }
      }
    }
    if (!best) continue;
    best.b.shopEdges.add(best.i);
    const dx = best.c[0] - best.a[0], dz = best.c[1] - best.a[1];
    const L = Math.hypot(dx, dz);
    const ccw = signedArea(best.b.outer) > 0;
    let nx = dz / L, nz = -dx / L;
    if (!ccw) { nx = -nx; nz = -nz; }
    const sx = best.a[0] + dx * bestT, sz = best.a[1] + dz * bestT;
    if (usedSpots.some(([ux, uz]) => Math.hypot(ux - sx, uz - sz) < 3.2)) continue;
    usedSpots.push([sx, sz]);
    const w = THREE.MathUtils.clamp(poi.name.length * 0.24 + 0.8, 1.6, Math.min(5.5, L * 0.9));
    signs.push({ name: poi.name, kind: poi.kind, x: sx + nx * 0.12, z: sz + nz * 0.12, nx, nz, w });
  }

  // ── 幾何：依 250 m 分塊合併 ──
  const chunks = new Map<string, { plaster: FacadeBuilder; stone: FacadeBuilder; roofs: GeoBucket }>();
  const footprints: { outer: Vec2[]; H: number }[] = [];
  for (const p of final) {
    const k = `${Math.floor(p.c[0] / 250)},${Math.floor(p.c[1] / 250)}`;
    let ch = chunks.get(k);
    if (!ch) chunks.set(k, (ch = { plaster: new FacadeBuilder(), stone: new FacadeBuilder(), roofs: new GeoBucket() }));
    const fb = p.stone ? ch.stone : ch.plaster;
    const attrs = { tint: p.tint, seed: p.seed, shop: 0, style: p.style, groundH: 4.4 };
    fb.walls(p.outer, p.minH, p.H, attrs, p.shopEdges.size ? p.shopEdges : undefined);
    // 中庭的牆朝向中庭內
    for (const h of p.holes) fb.walls(h, p.minH, p.H, attrs, undefined, true);
    // 懸空部件（min_height > 0）補上底面，否則從下方看是空心的
    if (p.minH > 0.5) fb.cap(p.outer, p.holes, p.minH, attrs, p.H, true);
    if (!p.isPart) footprints.push({ outer: p.outer, H: p.H });

    const roofMat = p.roofMat === 'lead' ? M.lead : p.roofMat === 'flat' ? M.roofFlat : M.roofTiles;
    if (p.roof === 'hip') {
      const roofGeo = p.holes.length ? null : hipRoof(p.outer, p.H);
      if (roofGeo) ch.roofs.add(roofMat, roofGeo);
      // 屋頂下方一律封頂：四坡屋頂若略大於輪廓，從屋簷下也不會看穿
      fb.cap(p.outer, p.holes, p.H, attrs, p.H);
    } else if (p.roof === 'dome') {
      const r = Math.sqrt(p.area / Math.PI);
      const dome = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      const rh = parseNum(p.tags['roof:height']) ?? r;
      dome.scale(1, rh / r, 1);
      dome.translate(p.c[0], p.H - rh, p.c[1]);
      ch.roofs.add(M.lead, dome);
      fb.cap(p.outer, p.holes, p.H - rh, attrs, p.H);
    } else {
      // 平頂：小型住宅以瓦面呈現，大型建築為平台
      const cap = new FacadeBuilder();
      cap.cap(p.outer, p.holes, p.H, attrs, p.H);
      const g = cap.build();
      ch.roofs.add(p.area > 2500 || p.roofMat === 'flat' ? M.roofFlat : M.roofTiles, g);
      // 女兒牆（雙面：從屋頂上往外看也看得到內側）
      if (p.area > 200 && p.H > 8) {
        const ring = insetRing(p.outer, 0.35);
        fb.walls(ring, p.H, p.H + 0.8, { ...attrs, style: 9 });
        fb.walls(ring, p.H, p.H + 0.8, { ...attrs, style: 9 }, undefined, true);
      }
    }
  }
  for (const ch of chunks.values()) {
    if (!ch.plaster.empty) {
      const m = new THREE.Mesh(ch.plaster.build(), M.plaster);
      m.castShadow = m.receiveShadow = true;
      group.add(m);
    }
    if (!ch.stone.empty) {
      const m = new THREE.Mesh(ch.stone.build(), M.stoneFacade);
      m.castShadow = m.receiveShadow = true;
      group.add(m);
    }
    ch.roofs.build(group);
  }

  const signMesh = buildSigns(signs, group);
  return { group, signs: signMesh, footprints };
}

/** 近矩形建築的四坡屋頂（以最小面積外接矩形） */
function hipRoof(outer: Vec2[], H: number): THREE.BufferGeometry | null {
  const area = Math.abs(polygonArea(outer));
  const hull = convexHull(outer);
  let best: { a: number; ux: number; uz: number; minU: number; maxU: number; minV: number; maxV: number } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i], q = hull[(i + 1) % hull.length];
    let ux = q[0] - p[0], uz = q[1] - p[1];
    const l = Math.hypot(ux, uz);
    if (l < 1e-6) continue;
    ux /= l; uz /= l;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const r of hull) {
      const u = r[0] * ux + r[1] * uz, v = -r[0] * uz + r[1] * ux;
      minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v);
    }
    const a = (maxU - minU) * (maxV - minV);
    if (!best || a < best.a) best = { a, ux, uz, minU, maxU, minV, maxV };
  }
  if (!best || area / best.a < 0.88) return null;
  let { ux, uz, minU, maxU, minV, maxV } = best;
  // 長軸沿 u
  if (maxV - minV > maxU - minU) {
    [ux, uz] = [-uz, ux];
    const nu0 = minV, nu1 = maxV;
    const nv0 = -maxU, nv1 = -minU;
    minU = nu0; maxU = nu1; minV = nv0; maxV = nv1;
  }
  const hw = (maxV - minV) / 2, cv = (minV + maxV) / 2;
  const rh = Math.min(3.8, hw * 0.55);
  const W = (u: number, v: number, y: number) => [u * ux - v * uz, y, u * uz + v * ux];
  const o = 0.35; // 出簷
  const u0 = minU - o, u1 = maxU + o, v0 = minV - o, v1 = maxV + o;
  const r0 = Math.min(u0 + hw, (u0 + u1) / 2), r1 = Math.max(u1 - hw, (u0 + u1) / 2);
  const A = W(u0, v0, H), B = W(u1, v0, H), C = W(u1, v1, H), D = W(u0, v1, H);
  const R0 = W(r0, cv, H + rh), R1 = W(r1, cv, H + rh);
  const pos = [...A, ...B, ...R1, ...A, ...R1, ...R0, ...C, ...D, ...R0, ...C, ...R0, ...R1, ...B, ...C, ...R1, ...D, ...A, ...R0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const p = g.attributes.position.array as Float32Array;
  for (let i = 0; i < p.length; i += 9) {
    const ax = p[i], ay = p[i + 1], az = p[i + 2];
    const bx = p[i + 3] - ax, by = p[i + 4] - ay, bz = p[i + 5] - az;
    const cx = p[i + 6] - ax, cy = p[i + 7] - ay, cz = p[i + 8] - az;
    const ny = bz * cx - bx * cz;
    void by; void cy;
    if (ny < 0) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  }
  // 加上反向的屋簷底面：從屋簷下仰望不會看穿屋頂
  const under: number[] = [];
  for (let i = 0; i < p.length; i += 9) under.push(p[i], p[i + 1], p[i + 2], p[i + 6], p[i + 7], p[i + 8], p[i + 3], p[i + 4], p[i + 5]);
  g.setAttribute('position', new THREE.Float32BufferAttribute([...p, ...under], 3));
  g.computeVertexNormals();
  return g;
}

function convexHull(pts: Vec2[]): Vec2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [], upper: Vec2[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

function insetRing(ring: Vec2[], d: number): Vec2[] {
  const c = centroid(ring);
  return ring.map(([x, z]) => {
    const dx = x - c[0], dz = z - c[1];
    const l = Math.hypot(dx, dz) || 1;
    return [x - (dx / l) * d, z - (dz / l) * d] as Vec2;
  });
}

// ── 店家招牌（OSM 真實店名）──
const SIGN_STYLE: Record<string, { bg: string; fg: string; font?: string }> = {
  restaurant: { bg: '#5a1a17', fg: '#f3e6c4' }, cafe: { bg: '#1f3d2b', fg: '#f1e7c8' }, bar: { bg: '#1e1e1e', fg: '#e8c77b' },
  pub: { bg: '#20301f', fg: '#e8c77b' }, fast_food: { bg: '#8b2b1c', fg: '#ffffff' }, ice_cream: { bg: '#f2e2c4', fg: '#7a2b31' },
  hotel: { bg: '#1d2a44', fg: '#e5c879' }, guest_house: { bg: '#2d3a4f', fg: '#efe2c0' }, museum: { bg: '#3d3528', fg: '#efe2c0' },
  pharmacy: { bg: '#0f7a3c', fg: '#ffffff' }, bank: { bg: '#3a4a5c', fg: '#ffffff' }, post_office: { bg: '#f6c400', fg: '#1a3a7a' },
  religion: { bg: '#23284a', fg: '#e5c879' }, gift: { bg: '#2c2445', fg: '#f0d68a' }, books: { bg: '#3b2d20', fg: '#f3e6c4' },
  tobacco: { bg: '#1b1b1b', fg: '#ffffff' }, default: { bg: '#141414', fg: '#f1ece0' },
};

function buildSigns(signs: { name: string; kind: string; x: number; z: number; nx: number; nz: number; w: number }[], group: THREE.Group): THREE.InstancedMesh | null {
  if (!signs.length) return null;
  const cols = 8, cellW = 512, cellH = 64;
  const rows = Math.ceil(signs.length / cols);
  const canvas = document.createElement('canvas');
  canvas.width = cols * cellW;
  canvas.height = THREE.MathUtils.ceilPowerOfTwo(rows * cellH);
  const ctx = canvas.getContext('2d')!;
  const uvRect = new Float32Array(signs.length * 4);
  signs.forEach((s, i) => {
    const cx = (i % cols) * cellW, cy = Math.floor(i / cols) * cellH;
    const sub = s.kind.split(':')[1] ?? '';
    const st = SIGN_STYLE[sub] ?? SIGN_STYLE.default;
    ctx.fillStyle = st.bg;
    ctx.fillRect(cx, cy, cellW, cellH);
    ctx.strokeStyle = st.fg; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.strokeRect(cx + 4, cy + 4, cellW - 8, cellH - 8); ctx.globalAlpha = 1;
    ctx.fillStyle = st.fg;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let fs = 40;
    const serif = /restaurant|hotel|museum|religion|cafe|books|guest_house/.test(sub);
    const font = (n: number) => `${serif ? '600' : '700'} ${n}px ${serif ? '"Times New Roman", Georgia, serif' : '"Helvetica Neue", Arial, sans-serif'}`;
    ctx.font = font(fs);
    const target = Math.min(cellW - 30, s.w * 92);
    while (ctx.measureText(s.name).width > target && fs > 14) { fs -= 2; ctx.font = font(fs); }
    if (sub === 'pharmacy') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx + 16, cy + 26, 30, 12); ctx.fillRect(cx + 25, cy + 17, 12, 30);
      ctx.fillStyle = st.fg;
    }
    ctx.fillText(s.name, cx + cellW / 2, cy + cellH / 2 + 2, cellW - 24);
    const wFrac = Math.min(1, (s.w * 92 + 40) / cellW);
    uvRect.set([(cx + (cellW * (1 - wFrac)) / 2) / canvas.width, 1 - (cy + cellH) / canvas.height, (cellW * wFrac) / canvas.width, cellH / canvas.height], i * 4);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(uvRect, 4));
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0, roughness: 0.55 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = G.uNight;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aUvRect;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = uv * aUvRect.zw + aUvRect.xy;\n#ifdef USE_EMISSIVEMAP\nvEmissiveMapUv = vMapUv;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= uNight * 0.9;');
  };
  // emissiveIntensity 由 shader 內的 uNight 控制
  mat.emissiveIntensity = 1;
  const im = new THREE.InstancedMesh(geo, mat, signs.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  signs.forEach((s, i) => {
    const ang = Math.atan2(s.nx, s.nz); // 平面法線 +Z → (nx, nz)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
    m.compose(new THREE.Vector3(s.x, 3.75, s.z), q, new THREE.Vector3(s.w, 0.62, 1));
    im.setMatrixAt(i, m);
  });
  im.castShadow = false;
  im.receiveShadow = true;
  im.userData = { kind: 'signs', names: signs.map((s) => s.name), kinds: signs.map((s) => s.kind) };
  group.add(im);
  return im;
}

/** 外圍羅馬市區（OSM 真實輪廓，較低細節：無店面、無招牌） */
export function buildFarCity(M: MaterialLibrary, data: [number, number, number[], number][]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'city-far';
  const chunks = new Map<string, { walls: FacadeBuilder; roofs: GeoBucket }>();
  for (const [h, lv, flat, church] of data) {
    const ring: Vec2[] = [];
    for (let i = 0; i < flat.length; i += 2) ring.push([flat[i] / 10, flat[i + 1] / 10]);
    const outer = cleanRing(ring);
    if (outer.length < 3) continue;
    const area = Math.abs(polygonArea(outer));
    if (area < 12) continue;
    const c = centroid(outer);
    const seed = hash01(c[0] * 0.13 + c[1] * 0.71);
    const H = h > 0 ? h : lv > 0 ? lv * 3.35 + 1.4 : area < 40 ? 4 + seed * 3 : 15 + seed * 9;
    const k = `${Math.floor(c[0] / 400)},${Math.floor(c[1] / 400)}`;
    let ch = chunks.get(k);
    if (!ch) chunks.set(k, (ch = { walls: new FacadeBuilder(), roofs: new GeoBucket() }));
    const tint = church ? new THREE.Color(0.92, 0.86, 0.72) : PALETTE[Math.floor(seed * PALETTE.length)];
    const attrs = { tint, seed, shop: 0, style: area > 6000 || church ? 3 : 0, groundH: 4.4 };
    ch.walls.walls(outer, 0, H, attrs);
    const roof = area < 1800 && area > 25 ? hipRoof(outer, H) : null;
    if (roof) {
      ch.roofs.add(M.roofTiles, roof);
      try { ch.walls.cap(outer, [], H, attrs, H); } catch { /* skip */ }
    } else {
      const cap = new FacadeBuilder();
      try { cap.cap(outer, [], H, attrs, H); ch.roofs.add(area > 2500 ? M.roofFlat : M.roofTiles, cap.build()); } catch { /* skip */ }
    }
  }
  for (const ch of chunks.values()) {
    if (!ch.walls.empty) {
      const m = new THREE.Mesh(ch.walls.build(), M.plaster);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
    }
    ch.roofs.build(group);
  }
  return group;
}
