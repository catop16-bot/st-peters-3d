import * as THREE from 'three';
import { GeoBucket, boxAt, cylAt, lathe, archShape, flatPolygon } from '../core/geometry';
import { enhance, loadTexSet, type MaterialLibrary } from '../core/materials';
import type { Vec2 } from '../core/geo';

/**
 * 聖彼得大教堂內部（真實尺寸）
 * 座標：原點為主穹頂中心，+X 朝入口（東），Z 南北，地坪 y = 0。
 * 主要尺寸：中殿寬約 27.5 m、拱頂 46 m；穹頂內徑 41.47 m、燈籠亭頂 117.6 m；
 * 入口內牆 x ≈ 117（與外部立面塊一致），西端後殿 x ≈ −66，南北翼殿盡頭 |z| ≈ 68.5。
 */
export const IN = {
  halfW: 13.75, // 各臂半寬
  spring: 32, // 拱頂起拱高度
  entabTop: 32,
  archPlane: 23, // 交叉處四拱所在平面距中心
  pierOuter: 33,
  naveEnd: 117,
  apseEnd: -66,
  transeptEnd: 68.5,
  aisleOuter: 33,
  aisleInner: 16.75, // 中殿連拱牆外側
  aisleCeil: 22,
  domeR: 20.7,
  pendSphereR: 26.8,
  ringY: 49,
  drumBase: 52,
  drumTop: 70,
  shellTop: 108,
  lanternTop: 117.6,
  bayW: 14,
  arcHW: 3.6, // 中殿連拱半寬
  pilOff: 2.4, // 中殿柱面雙壁柱的偏移
  wallT: 2, // 入口牆厚度
  porticoX1: 131, // 柱廊外牆（立面內側）
  porticoHalfL: 36, // 柱廊半長
  vestibule: 46, // 兩端騎馬像所在的端廳外緣
};

/** 後殿轉角禮拜堂與通道（|z| 方向以南側為正） */
export const CH = {
  x0: -54, x1: -33, z0: 33, z1: 56, // 禮拜堂方室
  h: 24, // 牆高（上接小穹頂）
  corrX: -46, corrHW: 4, // 後殿臂 → 禮拜堂的迴廊（中心 x、半寬）
  transZ: 50.5, transHW: 3, // 耳堂 → 禮拜堂的通道（中心 |z|、半寬）
};

export interface InteriorMats {
  marble: THREE.MeshStandardMaterial;
  marbleWhite: THREE.MeshStandardMaterial;
  marbleDark: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  vaultX: THREE.MeshStandardMaterial;
  vaultZ: THREE.MeshStandardMaterial;
  stucco: THREE.MeshStandardMaterial;
  dome: THREE.MeshStandardMaterial;
  window: THREE.MeshStandardMaterial;
  bronze: THREE.MeshStandardMaterial;
  gilded: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  mosaicText: THREE.MeshStandardMaterial;
}

export function interiorMaterials(M: MaterialLibrary): InteriorMats {
  const cream = loadTexSet('Marble020'), white = loadTexSet('Marble012'), dark = loadTexSet('Marble016'), goldT = loadTexSet('Metal034'), plas = loadTexSet('Plaster001');
  const no = { snow: false, wet: false };
  const marble = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(1.0, 0.95, 0.88), roughness: 0.5 }), { ...no, tex: cream, scale: 0.18, normalScale: 0.4 });
  const marbleWhite = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.98, 0.97, 0.95), roughness: 0.45 }), { ...no, tex: white, scale: 0.35, normalScale: 0.3 });
  const marbleDark = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.75, 0.72, 0.7), roughness: 0.35 }), { ...no, tex: dark, scale: 0.3, normalScale: 0.3 });
  const gold = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(1.0, 0.8, 0.42), roughness: 0.32, metalness: 1.0 }), { ...no, tex: goldT, scale: 0.6, normalScale: 0.2 });
  const floor = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(1, 0.97, 0.92), roughness: 0.6 }), { ...no, tex: cream, scale: 0.22, normalScale: 0.2, inlay: true });
  const vault = (axis: 'x' | 'z') => enhance(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), {
    ...no, tex: plas, scale: 0.4, normalScale: 0.25, coffer: { axis, spring: IN.spring, radius: IN.halfW, center: 0 },
  });
  const stucco = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.95, 0.92, 0.86), roughness: 0.8 }), { ...no, tex: plas, scale: 0.4, normalScale: 0.3 });
  const dome = enhance(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), { ...no, tex: plas, scale: 0.3, normalScale: 0.2, domeMosaic: { cx: 0, cz: 0, y0: IN.drumTop, y1: IN.shellTop } });
  const window = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0.95, 0.97, 1.0), emissiveIntensity: 1, roughness: 1 });
  const darkM = enhance(new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.9 }), no);
  // 鼓座下緣銘文帶：金色馬賽克字（藍底）
  const mosaicText = new THREE.MeshStandardMaterial({ map: inscriptionTexture(), roughness: 0.35, metalness: 0.4 });
  return {
    marble, marbleWhite, marbleDark, gold, floor, vaultX: vault('x'), vaultZ: vault('z'), stucco, dome, window,
    bronze: M.bronze, gilded: M.gilded, dark: darkM, mosaicText,
  };
}

/** 真實銘文（馬太福音 16:18–19）：環繞穹頂鼓座下緣 */
export const DOME_INSCRIPTION = 'TU ES PETRUS ET SUPER HANC PETRAM AEDIFICABO ECCLESIAM MEAM · TIBI DABO CLAVES REGNI CAELORUM · ';

function inscriptionTexture() {
  const c = document.createElement('canvas');
  c.width = 8192; c.height = 192;
  const x = c.getContext('2d')!;
  x.fillStyle = '#1b2a5a'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#d9b06a'; x.fillRect(0, 0, c.width, 10); x.fillRect(0, c.height - 10, c.width, 10);
  x.fillStyle = '#f1cf86';
  x.font = '700 128px "Times New Roman", Georgia, serif';
  x.textBaseline = 'middle'; x.textAlign = 'center';
  x.fillText(DOME_INSCRIPTION.split('').join(' '), c.width / 2, c.height / 2 + 6, c.width - 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** 翻轉幾何朝向（給從內部觀看的拱頂、穹頂、半圓殿） */
export function inward(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.index ? g.toNonIndexed() : g.clone();
  const p = n.attributes.position.array as Float32Array;
  for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  for (const key of Object.keys(n.attributes)) if (key !== 'position') n.deleteAttribute(key);
  n.computeVertexNormals();
  return n;
}

/** 帶拱形開口的牆（在 XY 平面建立，沿 +Z 擠出厚度） */
function archedWall(len: number, h: number, thick: number, arches: { c: number; hw: number; h: number }[]) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, h); s.lineTo(0, h); s.closePath();
  for (const a of arches) {
    const hole = archShape(a.hw, a.h);
    const pts = hole.getPoints(16).map((p) => new THREE.Vector2(p.x + a.c, p.y));
    s.holes.push(new THREE.Path(pts));
  }
  return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 16 });
}

/** 半圓柱筒形拱（內側可見）：沿 axis 從 a0 到 a1，起拱高 spring */
function barrelVault(axis: 'x' | 'z', a0: number, a1: number, r: number, spring: number, center = 0) {
  const len = Math.abs(a1 - a0);
  const segs = Math.max(1, Math.round(len / 4));
  let g: THREE.BufferGeometry;
  if (axis === 'x') {
    // rotateZ(90°) 後 y = r·sinθ：θ ∈ [0, π] 為上半
    g = new THREE.CylinderGeometry(r, r, len, 64, segs, true, 0, Math.PI);
    g.rotateZ(Math.PI / 2);
    g.translate((a0 + a1) / 2, spring, center);
  } else {
    // rotateX(90°) 後 y = −r·cosθ：θ ∈ [π/2, 3π/2] 為上半
    g = new THREE.CylinderGeometry(r, r, len, 64, segs, true, Math.PI / 2, Math.PI);
    g.rotateX(Math.PI / 2);
    g.translate(center, spring, (a0 + a1) / 2);
  }
  return inward(g);
}

export interface InteriorBuild {
  scene: THREE.Scene;
  mats: InteriorMats;
  drumWindows: { pos: THREE.Vector3; normal: THREE.Vector3 }[];
  naveWindows: { pos: THREE.Vector3; normal: THREE.Vector3 }[];
  confessio: { x0: number; x1: number; hw: number; depth: number };
  portico: { x0: number; x1: number; halfL: number; vest: number };
}

export function buildInterior(M: MaterialLibrary): InteriorBuild {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0b09);
  scene.fog = new THREE.FogExp2(0xcbb79a, 0.0018);
  const mats = interiorMaterials(M);
  const b = new GeoBucket();
  const W = IN.halfW;

  // ── 地面（含告解堂下沉區開口）──
  const confessio = { x0: 6, x1: 13.5, hw: 5.2, depth: 3.2 };
  const floorOuter: Vec2[] = [[-70, -72], [IN.naveEnd, -72], [IN.naveEnd, 72], [-70, 72]];
  const hole: Vec2[] = [[confessio.x0, -confessio.hw], [confessio.x1, -confessio.hw], [confessio.x1, confessio.hw], [confessio.x0, confessio.hw]];
  b.add(mats.floor, flatPolygon(floorOuter, [hole], 0));
  // 告解堂：下沉的馬蹄形空間（簡化為矩形），四壁大理石
  b.add(mats.floor, flatPolygon(hole, [], -confessio.depth));
  for (const [x0, z0, x1, z1] of [[confessio.x0, -confessio.hw, confessio.x1, -confessio.hw], [confessio.x1, -confessio.hw, confessio.x1, confessio.hw], [confessio.x1, confessio.hw, confessio.x0, confessio.hw], [confessio.x0, confessio.hw, confessio.x0, -confessio.hw]]) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.PlaneGeometry(L, confessio.depth);
    g.translate(0, -confessio.depth / 2, 0);
    const ang = Math.atan2(-(z1 - z0), x1 - x0);
    g.rotateY(ang);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    b.add(mats.marbleDark, inward(g)); // 面向下沉區內側
    b.add(mats.marbleDark, g);
  }

  // ── 中殿：兩側連拱牆、巨柱式壁柱、檐部、筒形拱頂 ──
  const naveLen = IN.naveEnd - IN.pierOuter; // 84 m，6 開間
  const bays = Math.round(naveLen / IN.bayW);
  const arches = Array.from({ length: bays }, (_, i) => ({ c: (i + 0.5) * IN.bayW, hw: IN.arcHW, h: 23 }));
  for (const side of [-1, 1]) {
    const wall = archedWall(naveLen, IN.entabTop, 3, arches);
    // 牆面在 XY 平面：x ∈ [0, naveLen]；擠出沿 +Z。放到中殿兩側
    if (side < 0) wall.translate(IN.pierOuter, 0, -W - 3);
    else wall.translate(IN.pierOuter, 0, W);
    b.add(mats.marble, wall);
    // 雙壁柱（面向中殿）與鍍金柱頭
    for (let i = 0; i <= bays; i++) {
      const x = IN.pierOuter + i * IN.bayW;
      for (const off of [-IN.pilOff, IN.pilOff]) { // 雙壁柱之間留出創辦人像壁龕
        if ((i === 0 && off < 0) || (i === bays && off > 0)) continue;
        const z = side * (W - 0.35);
        b.add(mats.marbleWhite, boxAt(2.2, 0, 3, 1.2, x + off, z));
        b.add(mats.marble, boxAt(1.9, 3, 24.5, 0.7, x + off, z));
        b.add(mats.gold, boxAt(2.3, 24.5, 27.2, 0.95, x + off, z));
      }
    }
    // 檐部（額枋、鍍金飾帶、簷口）
    b.add(mats.marble, boxAt(naveLen, 27.2, 29.6, 1.6, (IN.pierOuter + IN.naveEnd) / 2, side * (W - 0.6)));
    b.add(mats.gold, boxAt(naveLen, 28.3, 28.9, 0.2, (IN.pierOuter + IN.naveEnd) / 2, side * (W - 1.45)));
    b.add(mats.marble, boxAt(naveLen, 29.6, 32, 2.6, (IN.pierOuter + IN.naveEnd) / 2, side * (W - 1.0)));
    // 拱腹（連拱開口上方的厚度面）與拱腳線腳
    for (const a of arches) {
      const ax = IN.pierOuter + a.c;
      b.add(mats.gold, boxAt(a.hw * 2 + 0.6, a.h - a.hw - 0.4, a.h - a.hw, 0.5, ax, side * (W - 0.05)));
    }
  }
  b.add(mats.vaultX, barrelVault('x', IN.archPlane, IN.naveEnd, W, IN.spring));

  // ── 側廊（中殿兩側，連拱外）──
  for (const side of [-1, 1]) {
    const zIn = side * IN.aisleInner, zOut = side * IN.aisleOuter;
    const cz = (zIn + zOut) / 2, dz = Math.abs(zOut - zIn);
    // 外牆
    const g = new THREE.PlaneGeometry(naveLen, IN.aisleCeil);
    g.translate((IN.pierOuter + IN.naveEnd) / 2, IN.aisleCeil / 2, zOut);
    b.add(mats.marble, side > 0 ? inward(g) : g);
    // 天花與每開間的小穹頂
    const circle = (x: number): Vec2[] => Array.from({ length: 32 }, (_, k) => [x + Math.cos((k / 32) * Math.PI * 2) * 6.2, cz + Math.sin((k / 32) * Math.PI * 2) * 6.2] as Vec2);
    const ceilHoles = Array.from({ length: bays }, (_, i) => circle(IN.pierOuter + (i + 0.5) * IN.bayW));
    const ceilOuter: Vec2[] = [[IN.pierOuter, cz - dz / 2], [IN.naveEnd, cz - dz / 2], [IN.naveEnd, cz + dz / 2], [IN.pierOuter, cz + dz / 2]];
    b.add(mats.stucco, inward(flatPolygon(ceilOuter, ceilHoles, IN.aisleCeil)));
    for (let i = 0; i < bays; i++) {
      const x = IN.pierOuter + (i + 0.5) * IN.bayW;
      if (i === 0) { cornerDome(b, mats, x, cz); continue; } // 轉角禮拜堂（額我略 / 克勉）
      const d = inward(lathe([[6.2, IN.aisleCeil - 0.01], [5.9, IN.aisleCeil + 2.2], [4.6, IN.aisleCeil + 4.4], [2.4, IN.aisleCeil + 5.8], [0.01, IN.aisleCeil + 6.3]], 32, x, cz));
      b.add(mats.stucco, d);
      b.add(mats.gold, lathe([[6.4, IN.aisleCeil - 0.4], [6.4, IN.aisleCeil], [6.1, IN.aisleCeil], [6.1, IN.aisleCeil - 0.4]], 32, x, cz));
    }
  }

  // ── 十字交叉處四巨柱（含對角壁龕）──
  for (const [sx, sz] of [[1, -1], [-1, -1], [-1, 1], [1, 1]] as [number, number][]) {
    const poly: Vec2[] = [[sx * IN.archPlane, sz * W], [sx * IN.pierOuter, sz * W], [sx * IN.pierOuter, sz * IN.pierOuter], [sx * W, sz * IN.pierOuter], [sx * W, sz * IN.archPlane]];
    const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    const pier = new THREE.ExtrudeGeometry(shape, { depth: IN.entabTop, bevelEnabled: false });
    pier.rotateX(-Math.PI / 2);
    b.add(mats.marble, pier);
    // 對角面上的大壁龕（暗色凹面 + 鍍金框）
    const dx = sx * 18.38, dz = sz * 18.38;
    const nich = new THREE.ShapeGeometry(archShape(2.6, 9.5), 16);
    nich.translate(0, 3.2, 0);
    nich.rotateY(Math.atan2(-sx, -sz));
    nich.translate(dx * 0.997, 0, dz * 0.997);
    b.add(mats.dark, nich);
    const frame = new THREE.Shape();
    const outer = archShape(3.1, 10.1);
    frame.setFromPoints(outer.getPoints(16));
    frame.holes.push(new THREE.Path(archShape(2.6, 9.5).getPoints(16)));
    const fr = new THREE.ExtrudeGeometry(frame, { depth: 0.3, bevelEnabled: false, curveSegments: 16 });
    fr.translate(0, 2.9, 0);
    fr.rotateY(Math.atan2(-sx, -sz));
    fr.translate(dx, 0, dz);
    b.add(mats.gold, fr);
    // 上層聖髑陽台（鍍金框的暗色開口）
    const bal = boxAt(4.2, 20.5, 25.5, 0.2);
    bal.rotateY(Math.atan2(-sx, -sz));
    bal.translate(dx * 0.995, 0, dz * 0.995);
    b.add(mats.dark, bal);
    const balF = boxAt(5.2, 19.8, 20.5, 1.2);
    balF.rotateY(Math.atan2(-sx, -sz));
    balF.translate(dx * 0.985, 0, dz * 0.985);
    b.add(mats.gold, balF);
    // 巨柱上的雙壁柱與檐部（面向各臂）
    b.add(mats.marble, boxAt(Math.abs(IN.pierOuter - IN.archPlane) + 0.4, 27.2, IN.entabTop, 1.4, sx * (IN.archPlane + IN.pierOuter) / 2, sz * (W - 0.5)));
    b.add(mats.marble, boxAt(1.4, 27.2, IN.entabTop, Math.abs(IN.pierOuter - IN.archPlane) + 0.4, sx * (W - 0.5), sz * (IN.archPlane + IN.pierOuter) / 2));
  }

  // ── 帆拱（球面：中心 y=32、半徑 26.8，穿過四拱）──
  {
    const R = IN.pendSphereR;
    const g = new THREE.SphereGeometry(R, 160, 40, 0, Math.PI * 2, Math.acos((IN.ringY - IN.spring) / R), Math.PI / 2 - Math.acos((IN.ringY - IN.spring) / R));
    g.translate(0, IN.spring, 0);
    const ni = g.toNonIndexed();
    const p = ni.attributes.position.array as Float32Array;
    const keep: number[] = [];
    for (let i = 0; i < p.length; i += 9) {
      const cx = (p[i] + p[i + 3] + p[i + 6]) / 3, cz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
      if (Math.abs(cx) <= IN.archPlane && Math.abs(cz) <= IN.archPlane) for (let k = 0; k < 9; k++) keep.push(p[i + k]);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
    b.add(mats.stucco, inward(pg));
    // 四拱的拱腹（交叉處側，鍍金）
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const arch = new THREE.TorusGeometry(W, 0.9, 6, 48, Math.PI);
      if (ax !== 0) arch.rotateY(Math.PI / 2);
      arch.translate(ax * IN.archPlane, IN.spring, az * IN.archPlane);
      b.add(mats.gold, arch);
    }
    // 環形簷口 + 銘文帶
    b.add(mats.gold, lathe([[IN.domeR + 0.9, IN.ringY], [IN.domeR + 0.9, IN.ringY + 0.5], [IN.domeR - 0.6, IN.ringY + 0.5], [IN.domeR - 0.6, IN.ringY]], 128));
    // 文字帶使用 UV（inward 會移除 uv），因此以 BackSide 從內側顯示
    const bandG = new THREE.CylinderGeometry(IN.domeR - 0.02, IN.domeR - 0.02, 2.2, 160, 1, true);
    bandG.translate(0, IN.ringY + 1.6, 0);
    const bandMesh = new THREE.Mesh(bandG, mats.mosaicText);
    mats.mosaicText.side = THREE.BackSide;
    const tex = mats.mosaicText.map!;
    tex.repeat.set(-1, 1); // 從內側看文字不會左右顛倒
    scene.add(bandMesh);
    b.add(mats.gold, lathe([[IN.domeR + 0.6, IN.ringY + 2.7], [IN.domeR - 0.9, IN.ringY + 2.7], [IN.domeR - 0.9, IN.drumBase], [IN.domeR + 0.6, IN.drumBase]], 128));
  }

  // ── 鼓座（16 扇窗與雙壁柱）──
  const drumWindows: InteriorBuild['drumWindows'] = [];
  {
    b.add(mats.marble, inward(cylAt(IN.domeR, IN.domeR, IN.drumBase, IN.drumTop, 0, 0, 160, true)));
    for (let i = 0; i < 16; i++) {
      const a = ((i + 0.5) / 16) * Math.PI * 2;
      const nx = Math.cos(a), nz = Math.sin(a);
      const w = new THREE.PlaneGeometry(3.2, 9.5);
      w.rotateY(Math.atan2(-nx, -nz));
      w.translate(nx * (IN.domeR - 0.05), IN.drumBase + 8.2, nz * (IN.domeR - 0.05));
      b.add(mats.window, w);
      drumWindows.push({ pos: new THREE.Vector3(nx * IN.domeR, IN.drumBase + 8.2, nz * IN.domeR), normal: new THREE.Vector3(nx, 0, nz) });
      // 窗間雙壁柱
      const pa = (i / 16) * Math.PI * 2;
      for (const off of [-0.07, 0.07]) {
        const q = pa + off;
        b.add(mats.marbleWhite, cylAt(0.55, 0.5, IN.drumBase + 0.5, IN.drumTop - 2.2, Math.cos(q) * (IN.domeR - 0.6), Math.sin(q) * (IN.domeR - 0.6), 10));
      }
    }
    b.add(mats.gold, lathe([[IN.domeR + 0.2, IN.drumTop - 2.2], [IN.domeR - 1.4, IN.drumTop - 2.2], [IN.domeR - 1.8, IN.drumTop - 1.0], [IN.domeR - 1.8, IN.drumTop], [IN.domeR + 0.2, IN.drumTop]], 128));
  }

  // ── 內層穹頂（馬賽克分格）與燈籠亭 ──
  {
    const prof: [number, number][] = [];
    const H = IN.shellTop - IN.drumTop, R0 = IN.domeR - 1.6, rTop = 3.6;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const ang = t * Math.PI / 2;
      const r = rTop + (R0 - rTop) * Math.cos(ang);
      prof.push([r, IN.drumTop + H * Math.sin(ang)]);
    }
    b.add(mats.dome, inward(lathe(prof, 128)));
    b.add(mats.gold, lathe([[rTop + 0.6, IN.shellTop - 0.4], [rTop + 0.6, IN.shellTop + 0.2], [rTop - 0.2, IN.shellTop + 0.2], [rTop - 0.2, IN.shellTop - 0.4]], 48));
    // 燈籠亭內：明亮的天光與上方聖靈之鴿的圓頂
    b.add(mats.stucco, inward(cylAt(rTop - 0.2, rTop - 0.2, IN.shellTop, IN.lanternTop - 3, 0, 0, 48, true)));
    for (let i = 0; i < 16; i++) {
      const a = ((i + 0.5) / 16) * Math.PI * 2;
      const w = new THREE.PlaneGeometry(1.0, 4.5);
      w.rotateY(Math.atan2(-Math.cos(a), -Math.sin(a)));
      w.translate(Math.cos(a) * (rTop - 0.25), IN.shellTop + 3.5, Math.sin(a) * (rTop - 0.25));
      b.add(mats.window, w);
    }
    b.add(mats.gold, inward(lathe([[rTop - 0.2, IN.lanternTop - 3], [2.4, IN.lanternTop - 1.2], [0.01, IN.lanternTop]], 32)));
  }

  // ── 翼殿（南北）與西端後殿：側牆、筒形拱、半圓殿與半穹頂 ──
  const arm = (dir: 'n' | 's' | 'w') => {
    const sgn = dir === 's' ? 1 : -1;
    const end = dir === 'w' ? Math.abs(IN.apseEnd) : IN.transeptEnd;
    const apseC = end - W; // 半圓殿圓心距中心
    const len = apseC - IN.pierOuter;
    const axis = dir === 'w' ? 'x' : 'z';
    for (const side of [-1, 1]) {
      // 側牆：後殿臂兩側與兩耳堂西牆開拱，通往後殿轉角禮拜堂
      if (axis === 'x') wallSeg(b, mats.marble, -IN.pierOuter, side * W, -apseC, side * W, IN.entabTop, [{ c: -IN.pierOuter - CH.corrX, hw: CH.corrHW, h: 14 }]);
      else if (side < 0) wallSeg(b, mats.marble, -W, sgn * IN.pierOuter, -W, sgn * apseC, IN.entabTop, [{ c: CH.transZ - IN.pierOuter, hw: CH.transHW, h: 12 }]);
      else {
        const g = new THREE.PlaneGeometry(len, IN.entabTop);
        g.rotateY(Math.PI / 2); g.translate(side * W, IN.entabTop / 2, sgn * (IN.pierOuter + apseC) / 2);
        b.add(mats.marble, inward(g));
      }
      // 檐部
      if (axis === 'x') b.add(mats.marble, boxAt(len + IN.pierOuter - IN.archPlane, 27.2, IN.entabTop, 2.0, -(IN.archPlane + apseC) / 2, side * (W - 0.8)));
      else b.add(mats.marble, boxAt(2.0, 27.2, IN.entabTop, len + IN.pierOuter - IN.archPlane, side * (W - 0.8), sgn * (IN.archPlane + apseC) / 2));
      // 壁柱
      for (let k = 0; k <= Math.floor(len / 10); k++) {
        const t = IN.pierOuter + 2 + k * 10;
        if (t > apseC) break;
        if (axis === 'x') { b.add(mats.marble, boxAt(1.9, 0, 27.2, 0.7, -t, side * (W - 0.35))); b.add(mats.gold, boxAt(2.3, 24.5, 27.2, 0.95, -t, side * (W - 0.35))); }
        else { b.add(mats.marble, boxAt(0.7, 0, 27.2, 1.9, side * (W - 0.35), sgn * t)); b.add(mats.gold, boxAt(0.95, 24.5, 27.2, 2.3, side * (W - 0.35), sgn * t)); }
      }
    }
    // 筒形拱
    if (axis === 'x') b.add(mats.vaultX, barrelVault('x', -apseC, -IN.archPlane, W, IN.spring));
    else b.add(mats.vaultZ, barrelVault('z', sgn > 0 ? IN.archPlane : -apseC, sgn > 0 ? apseC : -IN.archPlane, W, IN.spring));
    // 半圓殿牆與半穹頂：lathe φ ∈ [−90°, 90°] 為 +Z 半邊；rotateY(rot) 使 +Z 指向臂的外端
    const rot = dir === 'w' ? -Math.PI / 2 : dir === 's' ? 0 : Math.PI;
    const cx = dir === 'w' ? -apseC : 0, cz = dir === 'w' ? 0 : sgn * apseC;
    const w2 = lathe([[W, 0], [W, IN.entabTop]], 48, 0, 0, -Math.PI / 2, Math.PI);
    w2.rotateY(rot); w2.translate(cx, 0, cz);
    b.add(mats.marble, inward(w2));
    const semi: [number, number][] = [];
    for (let i = 0; i <= 20; i++) { const t = (i / 20) * Math.PI / 2; semi.push([W * Math.cos(t) + 0.001, IN.spring + W * Math.sin(t)]); }
    const s2 = lathe(semi, 48, 0, 0, -Math.PI / 2, Math.PI);
    s2.rotateY(rot); s2.translate(cx, 0, cz);
    b.add(mats.stucco, inward(s2));
    b.add(mats.gold, (() => { const r = lathe([[W + 0.05, IN.spring - 0.5], [W - 0.9, IN.spring - 0.5], [W - 0.9, IN.spring], [W + 0.05, IN.spring]], 48, 0, 0, -Math.PI / 2, Math.PI); r.rotateY(rot); r.translate(cx, 0, cz); return r; })());
    // 半圓殿高窗（翼殿）
    if (dir !== 'w') for (let k = 0; k < 3; k++) {
      const a = rot + ((k - 1) * Math.PI) / 4;
      const nx = Math.sin(a), nz = Math.cos(a);
      const wpl = new THREE.PlaneGeometry(3.4, 8);
      wpl.rotateY(Math.atan2(-nx, -nz));
      wpl.translate(cx + nx * (W - 0.05), 21.5, cz + nz * (W - 0.05));
      b.add(mats.window, wpl);
    }
  };
  arm('n'); arm('s'); arm('w');
  // 後殿兩座轉角禮拜堂（西南：圓柱聖母；西北：聖彌額爾與聖佩特羅尼拉）
  for (const s of [-1, 1]) apseChapel(b, mats, s);

  // ── 中殿高側窗（拱頂弦月窗，位於每開間上方）──
  const naveWindows: InteriorBuild['naveWindows'] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < bays; i++) {
      const x = IN.pierOuter + (i + 0.5) * IN.bayW;
      const g = new THREE.CylinderGeometry(W - 0.06, W - 0.06, 5.2, 12, 1, true, side > 0 ? 0.2 : Math.PI - 0.62, 0.42);
      g.rotateZ(Math.PI / 2);
      g.translate(x, IN.spring, 0);
      const ni = inward(g);
      b.add(mats.window, ni);
      naveWindows.push({ pos: new THREE.Vector3(x, IN.spring + 4.5, side * (W - 1.2)), normal: new THREE.Vector3(0, 0.35, side).normalize() });
    }
  }

  // ── 入口牆（厚 2 m）：中央大門敞開通往柱廊，其餘四扇大門關閉 ──
  const portico = buildPortico(b, mats);
  {
    const Hw = IN.spring + W, half = 46;
    const sh = new THREE.Shape();
    sh.moveTo(-half, 0); sh.lineTo(half, 0); sh.lineTo(half, Hw); sh.lineTo(-half, Hw); sh.closePath();
    sh.holes.push(new THREE.Path(archShape(3.0, 11).getPoints(16)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: IN.wallT, bevelEnabled: false, curveSegments: 16 });
    g.rotateY(Math.PI / 2); // shape x → −z、擠出 → +x
    g.translate(IN.naveEnd, 0, 0);
    b.add(mats.marble, g);
    // 中央門洞的門框內壁（金色）
    b.add(mats.gold, boxAt(IN.wallT + 0.4, 11, 11.6, 7.2, IN.naveEnd + IN.wallT / 2, 0));
    for (const s of [-1, 1]) b.add(mats.gold, boxAt(IN.wallT + 0.4, 0, 11, 0.5, IN.naveEnd + IN.wallT / 2, s * 3.25));
    // 四扇關閉的門：兩面皆為青銅門扇（聖門 z = −25 另有浮雕）
    for (const [z, hw, h] of [[-8.5, 2.2, 8], [8.5, 2.2, 8], [-25, 2.2, 8], [25, 2.2, 8]] as [number, number, number][]) {
      for (const [x, ry] of [[IN.naveEnd - 0.05, -Math.PI / 2], [IN.naveEnd + IN.wallT + 0.05, Math.PI / 2]] as [number, number][]) {
        const d = new THREE.ShapeGeometry(archShape(hw, h), 12);
        d.rotateY(ry);
        d.translate(x, 0, z);
        b.add(mats.bronze, d);
      }
      b.add(mats.gold, boxAt(0.6, h, h + 0.8, hw * 2 + 1.2, IN.naveEnd - 0.3, z));
      b.add(mats.gold, boxAt(0.6, h, h + 0.8, hw * 2 + 1.2, IN.naveEnd + IN.wallT + 0.3, z));
    }
    // 入口上方的大窗
    const ww = new THREE.ShapeGeometry(archShape(4.5, 12), 16);
    ww.rotateY(-Math.PI / 2);
    ww.translate(IN.naveEnd - 0.06, 20, 0);
    b.add(mats.window, ww);
  }

  // ── 外殼：避免從縫隙看到外部背景 ──
  {
    const shell = new THREE.BoxGeometry(220, 140, 160);
    shell.translate(25, 60, 0);
    b.add(mats.dark, inward(shell));
  }

  b.build(scene, { cast: false, receive: false });
  return { scene, mats, drumWindows, naveWindows, confessio, portico };
}

/**
 * 轉角禮拜堂（額我略、克勉）：側廊靠交叉部的第一開間，鼓座 + 高穹頂（額我略禮拜堂穹頂高約 42 m）
 */
function cornerDome(b: GeoBucket, mats: InteriorMats, x: number, cz: number, r = 6.2, y0 = IN.aisleCeil, y1 = 31, top = 38.5) {
  b.add(mats.marble, inward(cylAt(r, r, y0, y1, x, cz, 48, true)));
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    const w = new THREE.PlaneGeometry(1.6, 4.2);
    w.rotateY(Math.atan2(-Math.cos(a), -Math.sin(a)));
    w.translate(x + Math.cos(a) * (r - 0.05), y0 + 4.6, cz + Math.sin(a) * (r - 0.05));
    b.add(mats.window, w);
  }
  const prof: [number, number][] = [];
  for (let i = 0; i <= 16; i++) { const t = (i / 16) * Math.PI / 2; prof.push([1.1 + (r - 1.1) * Math.cos(t), y1 + (top - y1) * Math.sin(t)]); }
  b.add(mats.stucco, inward(lathe(prof, 48, x, cz)));
  b.add(mats.stucco, inward(cylAt(1.1, 1.1, top, top + 3, x, cz, 16, true)));
  b.add(mats.window, inward(lathe([[1.1, top + 3], [0.01, top + 3.5]], 16, x, cz)));
  for (const y of [y0 - 0.4, y1 - 0.4]) b.add(mats.gold, lathe([[r + 0.2, y], [r + 0.2, y + 0.4], [r - 0.3, y + 0.4], [r - 0.3, y]], 48, x, cz));
}

/**
 * 柱廊（前廊）：入口牆外到立面內側，長約 72 m；筒形拱頂、五個朝向廣場的拱洞，
 * 兩端為端廳（北：君士坦丁像，國王階梯腳下；南：查理曼像）。
 */
function buildPortico(b: GeoBucket, mats: InteriorMats) {
  const x0 = IN.naveEnd + IN.wallT, x1 = IN.porticoX1, L = IN.porticoHalfL, V = IN.vestibule;
  const cx = (x0 + x1) / 2, r = (x1 - x0) / 2, spring = 13;
  b.add(mats.floor, flatPolygon([[IN.naveEnd, -V], [x1, -V], [x1, V], [IN.naveEnd, V]], [], 0));
  // 立面內側牆：五個拱洞，洞外為廣場天光
  const H = spring + r + 0.5;
  const sh = new THREE.Shape();
  sh.moveTo(-V, 0); sh.lineTo(V, 0); sh.lineTo(V, H); sh.lineTo(-V, H); sh.closePath();
  const openings: [number, number, number][] = [[0, 3.2, 9], [-13, 2.6, 8], [13, 2.6, 8], [-26, 2.6, 8], [26, 2.6, 8]];
  for (const [z, hw, h] of openings) sh.holes.push(new THREE.Path(archShape(hw, h).getPoints(16).map((p) => new THREE.Vector2(p.x - z, p.y))));
  const fw = new THREE.ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: false, curveSegments: 16 });
  fw.rotateY(Math.PI / 2);
  fw.translate(x1, 0, 0);
  b.add(mats.marble, fw);
  for (const [z, hw, h] of openings) {
    const g = new THREE.ShapeGeometry(archShape(hw + 0.2, h + 0.2), 12);
    g.rotateY(-Math.PI / 2);
    g.translate(x1 + 1.4, 0, z);
    b.add(mats.window, g);
  }
  // 筒形拱頂（沿 z）與兩端牆（大拱通往端廳）
  b.add(mats.stucco, barrelVault('z', -L, L, r, spring, cx));
  for (const s of [-1, 1]) {
    const e = new THREE.Shape();
    e.moveTo(x0, 0); e.lineTo(x1, 0); e.lineTo(x1, H); e.lineTo(x0, H); e.closePath();
    e.holes.push(new THREE.Path(archShape(4.2, 11.5).getPoints(16).map((p) => new THREE.Vector2(p.x + cx, p.y))));
    const eg = new THREE.ExtrudeGeometry(e, { depth: 1.2, bevelEnabled: false, curveSegments: 16 });
    eg.translate(0, 0, s > 0 ? L : -L - 1.2);
    b.add(mats.marble, eg);
    // 端廳：平頂與後牆
    const z0 = s * (L + 1.2), z1 = s * V;
    b.add(mats.stucco, inward(flatPolygon([[x0, Math.min(z0, z1)], [x1, Math.min(z0, z1)], [x1, Math.max(z0, z1)], [x0, Math.max(z0, z1)]], [], 14)));
    const bw = new THREE.PlaneGeometry(x1 - x0, 14);
    bw.translate(cx, 7, z1);
    b.add(mats.marble, s > 0 ? inward(bw) : bw);
  }
  // 拱頂橫向金色肋
  for (let z = -L + 6; z < L; z += 12) {
    const t = new THREE.TorusGeometry(r - 0.05, 0.25, 6, 32, Math.PI);
    t.translate(cx, spring, z);
    b.add(mats.gold, t);
  }
  return { x0, x1, halfL: L, vest: V };
}

/** 沿線段 (x0,z0)→(x1,z1) 的牆（厚 0.6 m，兩面可見），可開拱洞（c 為距起點的距離） */
export function wallSeg(b: GeoBucket, mat: THREE.Material, x0: number, z0: number, x1: number, z1: number, h: number, holes: { c: number; hw: number; h: number }[] = []) {
  const L = Math.hypot(x1 - x0, z1 - z0);
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(L, 0); sh.lineTo(L, h); sh.lineTo(0, h); sh.closePath();
  for (const o of holes) sh.holes.push(new THREE.Path(archShape(o.hw, o.h).getPoints(16).map((p) => new THREE.Vector2(p.x + o.c, p.y))));
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false, curveSegments: 16 });
  g.translate(0, 0, -0.3);
  g.rotateY(Math.atan2(-(z1 - z0), x1 - x0));
  g.translate(x0, 0, z0);
  b.add(mat, g);
}

/** 後殿轉角禮拜堂（s = 1 西南、−1 西北）：方室、小穹頂、兩條通道 */
function apseChapel(b: GeoBucket, mats: InteriorMats, s: number) {
  const W = IN.halfW, { x0, x1, z0, z1, h } = CH;
  const Z = (z: number) => s * z;
  // 方室四牆：北（靠後殿臂）開迴廊口、東（靠耳堂）開通道口
  wallSeg(b, mats.marble, x0, Z(z0), x1, Z(z0), h, [{ c: CH.corrX - x0, hw: CH.corrHW, h: 14 }]);
  wallSeg(b, mats.marble, x1, Z(z0), x1, Z(z1), h, [{ c: CH.transZ - z0, hw: CH.transHW, h: 12 }]);
  wallSeg(b, mats.marble, x0, Z(z0), x0, Z(z1), h);
  wallSeg(b, mats.marble, x0, Z(z1), x1, Z(z1), h);
  // 檐部與壁柱
  for (const [ax0, az0, ax1, az1] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x0, z0, x0, z1], [x0, z1, x1, z1]]) {
    const cx = (ax0 + ax1) / 2, cz = (az0 + az1) / 2, lx = Math.abs(ax1 - ax0), lz = Math.abs(az1 - az0);
    b.add(mats.marble, boxAt(Math.max(lx, 1.6), h - 3, h - 1, Math.max(lz, 1.6), cx, Z(cz)));
    b.add(mats.gold, boxAt(Math.max(lx, 1.7) , h - 2.2, h - 2.0, Math.max(lz, 1.7), cx, Z(cz)));
  }
  // 天花（中央圓洞）＋鼓座、穹頂、燈籠亭
  const cx = (x0 + x1) / 2, cz = Z((z0 + z1) / 2), r = 8.5;
  const circle: Vec2[] = Array.from({ length: 40 }, (_, k) => [cx + Math.cos((k / 40) * Math.PI * 2) * r, cz + Math.sin((k / 40) * Math.PI * 2) * r] as Vec2);
  const zz = [Z(z0), Z(z1)].sort((a, c) => a - c);
  b.add(mats.stucco, inward(flatPolygon([[x0, zz[0]], [x1, zz[0]], [x1, zz[1]], [x0, zz[1]]], [circle], h)));
  cornerDome(b, mats, cx, cz, r, h, h + 7, h + 14.5);
  // 後殿臂 → 禮拜堂的迴廊：兩側牆與平頂
  const cxL = CH.corrX - CH.corrHW, cxR = CH.corrX + CH.corrHW, ch = 15;
  wallSeg(b, mats.marble, cxL, Z(W), cxL, Z(z0), ch);
  wallSeg(b, mats.marble, cxR, Z(W), cxR, Z(z0), ch);
  b.add(mats.stucco, boxAt(CH.corrHW * 2, ch, ch + 0.4, z0 - W, CH.corrX, Z((W + z0) / 2)));
  // 耳堂 → 禮拜堂的通道
  const tz0 = CH.transZ - CH.transHW, tz1 = CH.transZ + CH.transHW, th = 13;
  wallSeg(b, mats.marble, x1, Z(tz0), -W, Z(tz0), th);
  wallSeg(b, mats.marble, x1, Z(tz1), -W, Z(tz1), th);
  b.add(mats.stucco, boxAt(Math.abs(-W - x1), th, th + 0.4, CH.transHW * 2, (x1 - W) / 2, Z(CH.transZ)));
}
