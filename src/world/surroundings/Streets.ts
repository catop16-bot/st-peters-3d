import * as THREE from 'three';
import { GeoBucket, ribbon, flatPolygon } from '../../core/geometry';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toLocal, cleanRing, pointInPolygon, hash01, clipPolygon, type Vec2 } from '../../core/geo';
import type { MaterialLibrary } from '../../core/materials';

export interface OsmRoad { id: number; highway: string; name?: string; width?: string; area?: string; tunnel?: string; bridge?: string; layer?: string; covered?: string; pts: [number, number][]; }
export interface OsmGreen { id: number; kind: string; pts: [number, number][]; }
export interface OsmWater { id: number; name?: string; rings: { role: string; pts: [number, number][] }[]; }

const WIDTH: Record<string, [number, 'asphalt' | 'stone']> = {
  primary: [13, 'asphalt'], primary_link: [8, 'asphalt'], secondary: [11, 'asphalt'], secondary_link: [7, 'asphalt'],
  tertiary: [9, 'asphalt'], tertiary_link: [6, 'asphalt'], residential: [6.5, 'stone'], unclassified: [6.5, 'asphalt'],
  living_street: [5.5, 'stone'], service: [4.2, 'asphalt'], pedestrian: [6, 'stone'], footway: [2.4, 'stone'],
  path: [1.8, 'stone'], cycleway: [2, 'asphalt'], steps: [2.6, 'stone'], track: [3, 'stone'],
};

export function buildStreets(M: MaterialLibrary, roads: OsmRoad[], greens: OsmGreen[], water: OsmWater[], skip: Vec2[][]) {
  const group = new THREE.Group();
  group.name = 'streets';
  const b = new GeoBucket();

  // 先整理水域：台伯河需從基底地面挖空
  const RECT = { x0: -16000, x1: 16000, z0: -16000, z1: 16000 }; // 延伸至地平線，遠處由霧淡出
  const clipRect = (ring: Vec2[]) => {
    let r = ring;
    r = clipPolygon(r, 1, 0, RECT.x1); r = clipPolygon(r, -1, 0, -RECT.x0);
    r = clipPolygon(r, 0, 1, RECT.z1); r = clipPolygon(r, 0, -1, -RECT.z0);
    return cleanRing(r);
  };
  const waterRings: { ring: Vec2[]; holes: Vec2[][]; river: boolean }[] = [];
  for (const w of water) {
    if (w.name === 'Fontana di Maderno' || w.name === 'Fontana di Bernini') continue;
    const isRiver = w.rings.length > 3;
    const outers = stitchRings(w.rings.filter((r) => r.role !== 'inner').map((r) => r.pts.map(([la, lo]) => toLocal(la, lo))));
    const inners = stitchRings(w.rings.filter((r) => r.role === 'inner').map((r) => r.pts.map(([la, lo]) => toLocal(la, lo))));
    for (const o of outers) {
      const ring = isRiver ? clipRect(o) : o;
      if (ring.length < 3) continue;
      waterRings.push({ ring, holes: inners.filter((h) => h.length > 2 && pointInPolygon(h[0][0], h[0][1], ring)), river: isRiver });
    }
  }
  // 基底地面（街區間的鋪面），挖去河道
  const rect: Vec2[] = [[RECT.x0, RECT.z0], [RECT.x1, RECT.z0], [RECT.x1, RECT.z1], [RECT.x0, RECT.z1]];
  let baseGeo: THREE.BufferGeometry;
  try { baseGeo = flatPolygon(rect, waterRings.filter((w) => w.river).map((w) => w.ring), -0.02); }
  catch { baseGeo = new THREE.PlaneGeometry(2600, 2000).rotateX(-Math.PI / 2).translate(-100, -0.02, 0); }
  const base = new THREE.Mesh(baseGeo, M.sidewalk);
  base.receiveShadow = true;
  group.add(base);

  const inSkip = (x: number, z: number) => skip.some((p) => pointInPolygon(x, z, p));

  for (const r of roads) {
    if (r.tunnel === 'yes' || r.covered === 'yes' || r.highway === 'corridor' || r.highway === 'platform') continue;
    if (r.layer && parseInt(r.layer, 10) < 0) continue;
    const spec = WIDTH[r.highway];
    if (!spec) continue;
    const pts = r.pts.map(([la, lo]) => toLocal(la, lo));
    if (r.area === 'yes' && pts.length > 3) {
      const ring = cleanRing(pts);
      const c = ring.reduce((a, p) => [a[0] + p[0] / ring.length, a[1] + p[1] / ring.length], [0, 0]);
      if (inSkip(c[0], c[1])) continue;
      try { b.add(spec[1] === 'asphalt' ? M.asphalt : M.sampietrini, flatPolygon(ring, [], 0.012)); } catch { /* 無法三角化 */ }
      continue;
    }
    // 依線段切開，略過位於廣場/教堂內的段落
    let run: Vec2[] = [];
    const flush = () => {
      if (run.length >= 2) {
        const w = parseFloat(r.width ?? '') || spec[0];
        const y = spec[1] === 'asphalt' ? 0.02 : 0.016 + (r.highway === 'footway' ? 0.006 : 0);
        const g = ribbon(run, w, y + (r.bridge ? 0.0 : 0));
        if (g) b.add(spec[1] === 'asphalt' ? M.asphalt : M.sampietrini, g);
      }
      run = [];
    };
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const ok = !inSkip(p[0], p[1]);
      if (ok) run.push(p);
      else flush();
    }
    flush();
  }

  // 綠地
  for (const gr of greens) {
    const ring = cleanRing(gr.pts.map(([la, lo]) => toLocal(la, lo)));
    if (ring.length < 3) continue;
    try { b.add(M.grass, flatPolygon(ring, [], 0.03)); } catch { /* skip */ }
  }

  // 水域（台伯河、庭園噴泉池）
  for (const w of waterRings) {
    try {
      b.add(M.water, flatPolygon(w.ring, w.holes, w.river ? -6.5 : 0.45));
      if (w.river) addEmbankment(b, M, w.ring);
    } catch { /* 無法三角化 */ }
  }
  b.build(group, { cast: false, receive: true });
  return group;
}

/** 將多段 way 依端點串接成閉合環 */
function stitchRings(segs: Vec2[][]): Vec2[][] {
  const rings: Vec2[][] = [];
  const pool = segs.filter((s) => s.length >= 2).map((s) => [...s]);
  const close = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5;
  while (pool.length) {
    let cur = pool.shift()!;
    let guard = 0;
    while (!close(cur[0], cur[cur.length - 1]) && guard++ < 500) {
      const end = cur[cur.length - 1];
      const idx = pool.findIndex((s) => close(s[0], end) || close(s[s.length - 1], end));
      if (idx < 0) break;
      let s = pool.splice(idx, 1)[0];
      if (!close(s[0], end)) s = s.reverse();
      cur = cur.concat(s.slice(1));
    }
    rings.push(cleanRing(cur));
  }
  return rings;
}

function addEmbankment(b: GeoBucket, M: MaterialLibrary, ring: Vec2[]) {
  const pos: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length];
    if (Math.hypot(c[0] - a[0], c[1] - a[1]) > 400) continue;
    pos.push(a[0], -6.5, a[1], c[0], -6.5, c[1], c[0], 0.0, c[1], a[0], -6.5, a[1], c[0], 0.0, c[1], a[0], 0.0, a[1]);
  }
  // 雙面：同時加入反向三角形
  const rev: number[] = [];
  for (let i = 0; i < pos.length; i += 9) rev.push(pos[i], pos[i + 1], pos[i + 2], pos[i + 6], pos[i + 7], pos[i + 8], pos[i + 3], pos[i + 4], pos[i + 5]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos.concat(rev), 3));
  g.computeVertexNormals();
  b.add(M.travertine, g);
}

// ── 樹木 ──
type TreeKind = 'pine' | 'plane' | 'oak' | 'palm' | 'cypress';

function treeGeos() {
  const strip = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
  const blob = (r: number, x: number, y: number, z: number, sy = 1) => { const g = mergeVertices(new THREE.IcosahedronGeometry(r, 2)); g.scale(1, sy, 1); g.translate(x, y, z); jitter(g, r * 0.22); return strip(g); };
  const merge = (gs: THREE.BufferGeometry[]) => {
    const pos: number[] = [], nor: number[] = [];
    for (const g of gs) { pos.push(...(g.attributes.position.array as Float32Array)); nor.push(...(g.attributes.normal.array as Float32Array)); }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return out;
  };
  const trunk = (h: number, r: number, lean = 0) => { const g = new THREE.CylinderGeometry(r * 0.7, r, h, 7); g.translate(0, h / 2, 0); if (lean) g.rotateZ(lean); return strip(g); };
  // 傘松（Pinus pinea）：高瘦樹幹 + 扁平寬冠
  const pineCanopy = merge([blob(4.5, 0, 13, 0, 0.42), blob(3.6, 3.2, 12.6, 1.5, 0.4), blob(3.4, -3, 12.8, -1.2, 0.42), blob(3, 0.8, 13.4, -3.2, 0.4), blob(3, -1.2, 12.5, 3.2, 0.38)]);
  const pineTrunk = merge([trunk(12.5, 0.38, 0.06)]);
  // 懸鈴木：圓冠
  const planeCanopy = merge([blob(4.2, 0, 10.5, 0, 0.9), blob(3.2, 2.6, 9.2, 1, 0.85), blob(3.2, -2.4, 9.6, -1.2, 0.85), blob(2.8, 0.5, 12.6, 0, 0.8)]);
  const planeTrunk = merge([trunk(8, 0.4), (() => { const g = new THREE.CylinderGeometry(0.12, 0.2, 5, 5); g.rotateZ(0.6); g.translate(1.5, 9, 0); return strip(g); })(), (() => { const g = new THREE.CylinderGeometry(0.12, 0.2, 5, 5); g.rotateZ(-0.55); g.rotateY(2); g.translate(-1.2, 9, 0.8); return strip(g); })()]);
  // 冬青櫟：深綠圓冠
  const oakCanopy = merge([blob(3.6, 0, 6.5, 0, 0.85), blob(2.8, 1.9, 5.8, 0.8), blob(2.8, -1.8, 6, -0.8), blob(2.4, 0, 8, 0.3)]);
  const oakTrunk = merge([trunk(4.5, 0.3)]);
  // 棕櫚
  const palmFronds = merge(Array.from({ length: 12 }, (_, i) => {
    const g = new THREE.ConeGeometry(0.5, 4.2, 3);
    g.rotateZ(-Math.PI / 2 + 0.5);
    g.translate(1.9, 0, 0);
    g.rotateY((i / 12) * Math.PI * 2);
    g.translate(0, 9.2, 0);
    return strip(g);
  }));
  const palmTrunk = merge([trunk(9, 0.42)]);
  // 柏樹
  const cypCanopy = merge([(() => { const g = new THREE.ConeGeometry(1.4, 13, 8); g.translate(0, 8, 0); jitter(g, 0.2); return strip(g); })()]);
  const cypTrunk = merge([trunk(2, 0.25)]);
  return { pineCanopy, pineTrunk, planeCanopy, planeTrunk, oakCanopy, oakTrunk, palmFronds, palmTrunk, cypCanopy, cypTrunk };
}

function jitter(g: THREE.BufferGeometry, a: number) {
  // 以頂點座標為鍵產生位移：同一位置的頂點位移相同，樹冠表面不會裂開
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = Math.round(x * 1000) * 0.0131 + Math.round(y * 1000) * 0.0173 + Math.round(z * 1000) * 0.0119;
    const h1 = hash01(k), h2 = hash01(k + 17.3), h3 = hash01(k + 41.9);
    p.setXYZ(i, x + (h1 - 0.5) * a, y + (h2 - 0.5) * a, z + (h3 - 0.5) * a);
  }
  g.computeVertexNormals();
}

export interface TreesResult { group: THREE.Group; deciduous: THREE.InstancedMesh[]; }

export function buildTrees(M: MaterialLibrary, trees: [number, number, string, string, string, number][], skip: Vec2[][]): TreesResult {
  const group = new THREE.Group();
  group.name = 'trees';
  const geos = treeGeos();
  const lists: Record<TreeKind, THREE.Matrix4[]> = { pine: [], plane: [], oak: [], palm: [], cypress: [] };
  const evergreen = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.16, 0.24, 0.12), roughness: 0.9 });
  for (const [la, lo, genus, leaf] of trees) {
    const [x, z] = toLocal(la, lo);
    if (skip.some((p) => pointInPolygon(x, z, p))) continue;
    const h = hash01(x * 0.37 + z * 1.13);
    let kind: TreeKind;
    const gl = genus.toLowerCase();
    if (/pinus/.test(gl)) kind = 'pine';
    else if (/platanus/.test(gl)) kind = 'plane';
    else if (/phoenix|washingtonia|trachycarpus|chamaerops/.test(gl) || leaf === 'palm') kind = 'palm';
    else if (/cupressus/.test(gl)) kind = 'cypress';
    else if (leaf === 'needleleaved') kind = h < 0.7 ? 'pine' : 'cypress';
    else if (x > 520) kind = 'plane'; // 台伯河沿岸懸鈴木
    else if (x < -150) kind = h < 0.32 ? 'pine' : h < 0.75 ? 'oak' : h < 0.86 ? 'cypress' : h < 0.93 ? 'palm' : 'plane'; // 梵蒂岡花園
    else kind = h < 0.4 ? 'plane' : h < 0.75 ? 'oak' : 'pine';
    const s = 0.75 + hash01(h * 71) * 0.5;
    lists[kind].push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h * 6.28), new THREE.Vector3(s, s * (0.9 + hash01(h * 13) * 0.25), s)));
  }
  const deciduous: THREE.InstancedMesh[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, list: THREE.Matrix4[], isDec = false) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
    if (isDec) deciduous.push(im);
  };
  const ev = enhanceEvergreen(M, evergreen);
  add(geos.pineCanopy, ev, lists.pine);
  add(geos.pineTrunk, M.bark, lists.pine);
  add(geos.planeCanopy, M.foliage, lists.plane, true);
  add(geos.planeTrunk, M.bark, lists.plane);
  add(geos.oakCanopy, ev, lists.oak);
  add(geos.oakTrunk, M.bark, lists.oak);
  add(geos.palmFronds, ev, lists.palm);
  add(geos.palmTrunk, M.bark, lists.palm);
  add(geos.cypCanopy, ev, lists.cypress);
  add(geos.cypTrunk, M.bark, lists.cypress);
  return { group, deciduous };
}

import { enhance } from '../../core/materials';
function enhanceEvergreen(_M: MaterialLibrary, m: THREE.MeshStandardMaterial) {
  return enhance(m, { macro: 0.4 });
}

// ── 路燈 ──
export function buildLamps(M: MaterialLibrary, lamps: [number, number, string, string][], extra: Vec2[]) {
  const group = new THREE.Group();
  group.name = 'lamps';
  const pts: Vec2[] = lamps.map(([la, lo]) => toLocal(la, lo)).concat(extra);
  const pole = new THREE.CylinderGeometry(0.07, 0.11, 5.2, 6).translate(0, 2.6, 0);
  const arm = new THREE.BoxGeometry(0.9, 0.06, 0.06).translate(0.4, 5.1, 0);
  const head = new THREE.CylinderGeometry(0.18, 0.28, 0.45, 6).translate(0.8, 4.95, 0);
  const n = pts.length;
  const poles = new THREE.InstancedMesh(mergeSimple([pole, arm]), M.ironDark, n);
  const heads = new THREE.InstancedMesh(head, M.lampGlow, n);
  const m = new THREE.Matrix4();
  pts.forEach(([x, z], i) => {
    m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash01(x + z) * 6.28), new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
  });
  poles.castShadow = true;
  group.add(poles, heads);
  // 夜間地面光暈（加法混合貼花）
  const glowTex = radialTexture();
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, color: new THREE.Color(1.0, 0.75, 0.45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), glowMat, n);
  pts.forEach(([x, z], i) => { m.makeTranslation(x, 0.06, z); pools.setMatrixAt(i, m); });
  pools.renderOrder = 1;
  group.add(pools);
  return { group, glowMat, pts };
}

function mergeSimple(gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [];
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...(g.attributes.position.array as Float32Array));
    nor.push(...(g.attributes.normal.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

export function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}
