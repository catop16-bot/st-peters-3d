import * as THREE from 'three';
import { GeoBucket, boxAt, cylAt, lathe, pediment, archShape, trs } from '../../core/geometry';
import type { MaterialLibrary } from '../../core/materials';
import { DIM } from '../../data/dimensions';
import { halfDisc } from './Dome';

const B = DIM.basilica;
const F = DIM.facade;
const FX = B.facadeWallX;
const HW = B.facadeHalfWidth;

/** 立面三個分區的牆面前緣（中央最突出） */
export function zoneFront(z: number): number {
  const a = Math.abs(z);
  if (a < F.pedimentHalfWidth) return FX + 1.6;
  if (a < 29.5) return FX + 0.8;
  return FX;
}

/** 檐部前緣：中央與次中央區的檐部連續跨越柱頂 */
export function entFront(z: number): number {
  const a = Math.abs(z);
  if (a < 29.5) return zoneFront(z) + 0.35 + DIM.facade.columnRadius * 2 + 0.1;
  return FX + 0.55;
}

const ZONES: [number, number, number][] = [
  [-HW, -29.5, FX], [-29.5, -15.5, FX + 0.8], [-15.5, 15.5, FX + 1.6], [15.5, 29.5, FX + 0.8], [29.5, HW, FX],
];

function zbox(b: GeoBucket, m: THREE.Material, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  b.add(m, g);
}

/** 科林斯柱（含柱礎、收分柱身、柱頭） */
function corinthian(b: GeoBucket, M: MaterialLibrary, x: number, z: number, r: number, top: number) {
  zbox(b, M.travertine, x - r * 1.25, x + r * 1.25, 0, 0.7, z - r * 1.25, z + r * 1.25);
  b.add(M.travertineSmooth, lathe([[r * 1.2, 0.7], [r * 1.2, 1.0], [r * 1.05, 1.3], [r * 1.12, 1.55], [r, 1.8], [r, 2.2], [r * 0.86, top - 2.6], [r * 0.9, top - 2.4]], 28, x, z));
  // 柱頭：茛苕葉以多層外翻表示
  const capH = 2.6;
  b.add(M.travertineSmooth, lathe([[r * 0.9, top - capH], [r * 1.0, top - capH + 0.4], [r * 1.12, top - capH + 0.5], [r * 1.0, top - capH + 0.9], [r * 1.2, top - capH + 1.2], [r * 1.08, top - capH + 1.55], [r * 1.32, top - capH + 1.9], [r * 1.25, top - 0.55]], 16, x, z));
  // 葉片突起
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const leaf = new THREE.SphereGeometry(r * 0.32, 6, 4);
    leaf.scale(0.6, 1.4, 1);
    leaf.translate(x + Math.cos(a) * r * 1.05, top - capH + 1.0, z + Math.sin(a) * r * 1.05);
    b.add(M.travertineSmooth, leaf);
  }
  // 柱頂板（四角渦卷）
  zbox(b, M.travertine, x - r * 1.5, x + r * 1.5, top - 0.55, top, z - r * 1.5, z + r * 1.5);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const vol = new THREE.SphereGeometry(r * 0.3, 8, 6);
    vol.translate(x + sx * r * 1.3, top - 0.8, z + sz * r * 1.3);
    b.add(M.travertineSmooth, vol);
  }
}

function pilaster(b: GeoBucket, M: MaterialLibrary, xFront: number, z: number, w: number, d: number, y0: number, top: number) {
  zbox(b, M.travertine, xFront - 0.2, xFront + d + 0.25, y0, y0 + 1.6, z - w / 2 - 0.25, z + w / 2 + 0.25);
  zbox(b, M.travertineSmooth, xFront - 0.2, xFront + d, y0 + 1.6, top - 2.4, z - w / 2, z + w / 2);
  zbox(b, M.travertineSmooth, xFront - 0.2, xFront + d + 0.2, top - 2.4, top - 0.5, z - w / 2 - 0.15, z + w / 2 + 0.15);
  zbox(b, M.travertine, xFront - 0.2, xFront + d + 0.4, top - 0.5, top, z - w / 2 - 0.35, z + w / 2 + 0.35);
}

/** 拱形或矩形開口：深色凹面 + 突出框 */
function opening(b: GeoBucket, M: MaterialLibrary, xFront: number, z: number, halfW: number, y0: number, h: number, arch: boolean, frame = 0.45) {
  if (arch) {
    const s = archShape(halfW, h);
    const g = new THREE.ShapeGeometry(s, 12);
    g.rotateY(Math.PI / 2);
    g.translate(xFront + 0.03, y0, z);
    b.add(M.dark, g);
    // 拱框
    const outer = archShape(halfW + frame, h + frame);
    outer.holes.push(Object.assign(new THREE.Path(), archShape(halfW, h)));
    const fr = new THREE.ExtrudeGeometry(outer, { depth: 0.35, bevelEnabled: false, curveSegments: 12 });
    fr.rotateY(Math.PI / 2);
    fr.translate(xFront, y0, z);
    b.add(M.travertine, fr);
  } else {
    zbox(b, M.dark, xFront, xFront + 0.04, y0, y0 + h, z - halfW, z + halfW);
    zbox(b, M.travertine, xFront, xFront + 0.35, y0 - frame, y0, z - halfW - frame, z + halfW + frame);
    zbox(b, M.travertine, xFront, xFront + 0.35, y0 + h, y0 + h + frame, z - halfW - frame, z + halfW + frame);
    zbox(b, M.travertine, xFront, xFront + 0.35, y0, y0 + h, z - halfW - frame, z - halfW);
    zbox(b, M.travertine, xFront, xFront + 0.35, y0, y0 + h, z + halfW, z + halfW + frame);
  }
}

function balcony(b: GeoBucket, M: MaterialLibrary, xFront: number, z: number, halfW: number, y: number, depth = 1.2) {
  zbox(b, M.travertine, xFront, xFront + depth, y - 0.45, y, z - halfW, z + halfW);
  zbox(b, M.travertine, xFront + depth - 0.25, xFront + depth, y, y + 1.1, z - halfW, z + halfW);
  zbox(b, M.travertine, xFront + depth - 0.3, xFront + depth + 0.05, y + 1.1, y + 1.25, z - halfW - 0.05, z + halfW + 0.05);
}

/** 欄杆：扶手 + 瓶形柱 */
export function balustrade(b: GeoBucket, M: MaterialLibrary, x: number, z0: number, z1: number, y: number, h = 1.95) {
  zbox(b, M.travertine, x - 0.5, x + 0.5, y, y + 0.3, z0, z1);
  zbox(b, M.travertine, x - 0.55, x + 0.55, y + h - 0.3, y + h, z0, z1);
  const n = Math.floor((z1 - z0) / 0.5);
  const proto = lathe([[0.16, 0], [0.13, 0.12], [0.2, 0.45], [0.12, 0.95], [0.09, 1.1], [0.16, h - 0.6]], 8);
  for (let i = 0; i < n; i++) {
    const g = proto.clone();
    g.translate(x, y + 0.3, z0 + (i + 0.5) * ((z1 - z0) / n));
    b.add(M.travertineSmooth, g);
  }
}

export function buildFacade(b: GeoBucket, M: MaterialLibrary) {
  const T = M.travertine;
  // ── 立面主體塊 ──
  zbox(b, T, B.facadeBackX, FX, 0, F.atticCorniceTop - 0.6, -HW, HW);
  for (const [z0, z1, fx] of ZONES) if (fx > FX) zbox(b, T, FX, fx, 0, F.atticCorniceTop - 0.6, z0, z1);
  // 勒腳
  for (const [z0, z1, fx] of ZONES) zbox(b, T, fx, fx + 0.5, 0, 1.6, z0, z1);

  // ── 巨柱與壁柱 ──
  for (const s of [-1, 1]) {
    for (const cz of F.columnZ) {
      const z = s * cz;
      const front = zoneFront(z);
      pilaster(b, M, front, z, 2.6, 0.4, 0, F.orderTop); // 柱後壁柱
      corinthian(b, M, front + F.columnRadius + 0.35, z, F.columnRadius, F.orderTop);
      // 閣樓壁柱
      zbox(b, M.travertineSmooth, front, front + 0.45, F.entablatureTop, F.atticTop, z - 1.2, z + 1.2);
    }
    for (const pz of F.pilasterZ) {
      const z = s * pz;
      const front = zoneFront(z);
      pilaster(b, M, front, z, 2.9, 0.6, 0, F.orderTop);
      zbox(b, T, front, front + 1.0, F.orderTop, F.entablatureTop - 1.3, z - 1.9, z + 1.9);
      zbox(b, T, front, front + 2.0, F.entablatureTop - 1.3, F.entablatureTop, z - 2.4, z + 2.4);
      zbox(b, M.travertineSmooth, front, front + 0.45, F.entablatureTop, F.atticTop, z - 1.2, z + 1.2);
    }
    // 外角壁柱
    pilaster(b, M, FX, s * (HW - 1.4), 2.6, 0.4, 0, F.orderTop);
  }

  // ── 檐部（額枋、飾帶、簷口）──
  for (const [z0, z1, fx] of ZONES) {
    const ef = entFront((z0 + z1) / 2);
    zbox(b, T, fx, ef + 0.12, F.orderTop, F.orderTop + 1.8, z0, z1); // 額枋
    zbox(b, T, fx, ef, F.orderTop + 1.8, F.entablatureTop - 1.3, z0, z1); // 飾帶
    zbox(b, T, fx, ef + 1.0, F.entablatureTop - 1.3, F.entablatureTop - 0.6, z0, z1); // 簷口
    zbox(b, T, fx, ef + 1.4, F.entablatureTop - 0.6, F.entablatureTop, z0 - 0.1, z1 + 0.1);
    // 閣樓頂簷
    zbox(b, T, fx, fx + 0.9, F.atticTop, F.atticCorniceTop, z0, z1);
    // 欄杆
    balustrade(b, M, fx + 0.2, z0, z1, F.atticCorniceTop, F.balustradeTop - F.atticCorniceTop);
  }

  // ── 中央山花（波格賽家族徽章）──
  const cf = FX + 1.6;
  b.add(T, pediment(F.pedimentHalfWidth + 1.0, F.entablatureTop, F.pedimentApex + 0.7, 1.4, cf + 1.6));
  b.add(T, pediment(F.pedimentHalfWidth, F.entablatureTop, F.pedimentApex, 1.0, cf + 0.6));
  const arms = cylAt(2.0, 2.0, 0, 0.5, 0, 0, 24);
  arms.rotateZ(Math.PI / 2);
  arms.translate(cf + 1.3, F.entablatureTop + 3.6, 0);
  b.add(M.travertineSmooth, arms);
  const tiara = lathe([[0, 0], [1.0, 0], [1.05, 0.5], [0.9, 1.0], [0.95, 1.4], [0.7, 1.9], [0.25, 2.3], [0, 2.6]], 16);
  tiara.translate(cf + 1.3, F.entablatureTop + 5.6, 0);
  b.add(M.travertineSmooth, tiara);

  // ── 開口 ──
  type Bay = { z: number; hw: number; kind: 'main' | 'door' | 'arch' | 'narrow' };
  const bays: Bay[] = [{ z: 0, hw: 2.8, kind: 'main' }];
  for (const s of [-1, 1]) {
    bays.push({ z: s * 8.75, hw: 1.3, kind: 'narrow' });
    bays.push({ z: s * 22, hw: 2.3, kind: 'door' });
    bays.push({ z: s * 33.5, hw: 2.4, kind: 'door' });
    bays.push({ z: s * 47.5, hw: 4.6, kind: 'arch' });
  }
  for (const bay of bays) {
    const front = zoneFront(bay.z) + 0.02;
    if (bay.kind === 'main' || bay.kind === 'door') {
      opening(b, M, front, bay.z, bay.hw, 0, bay.kind === 'main' ? 11.5 : 10.2, true, 0.5);
      // 門楣浮雕板
      zbox(b, M.travertineSmooth, front, front + 0.25, 12.4, 13.2, bay.z - bay.hw - 0.4, bay.z + bay.hw + 0.4);
      // 二樓：開窗陽台（中央為祝福陽台）
      const wHW = bay.kind === 'main' ? 2.7 : 1.8;
      const wy = bay.kind === 'main' ? 14.2 : 14.6;
      const wh = bay.kind === 'main' ? 8.6 : 7.4;
      opening(b, M, front, bay.z, wHW, wy, wh, true, 0.45);
      balcony(b, M, front, bay.z, wHW + 0.9, wy, bay.kind === 'main' ? 1.8 : 1.0);
      if (bay.kind === 'main') {
        b.add(T, pediment(wHW + 1.1, wy + wh + 0.5, wy + wh + 2.3, 1.0, front + 0.5, bay.z));
      } else {
        const seg = halfDisc(wHW + 0.8, 0.9, front + 0.45, wy + wh + 0.5, 0.35);
        seg.translate(0, 0, bay.z);
        b.add(T, seg);
      }
      // 閣樓窗
      opening(b, M, front, bay.z, bay.kind === 'main' ? 0 : 1.6, 35.2, 4.4, false, 0.4);
    } else if (bay.kind === 'arch') {
      opening(b, M, front, bay.z, bay.hw, 0, 19.0, true, 0.7);
      opening(b, M, front, bay.z, 2.2, 23.0, 2.6, false, 0.35);
      opening(b, M, front, bay.z, 1.9, 34.8, 4.8, false, 0.4);
    } else {
      // 窄開間：上下壁龕
      opening(b, M, front, bay.z, bay.hw, 2.5, 7.0, true, 0.3);
      opening(b, M, front, bay.z, bay.hw, 15.0, 6.0, true, 0.3);
    }
  }

  // ── 時鐘（瓦拉迪耶，1790 年）──
  for (const s of [-1, 1]) {
    const z = s * F.clockZ;
    zbox(b, T, FX - 4, FX + 0.3, F.balustradeTop, F.balustradeTop + 3.4, z - 6, z + 6);
    // 側面渦卷
    for (const side of [-1, 1]) {
      const v = new THREE.TorusGeometry(1.3, 0.45, 8, 14, Math.PI * 1.3);
      v.rotateY(Math.PI / 2);
      v.translate(FX - 0.5, F.balustradeTop + 4.6, z + side * 4.4);
      b.add(M.travertineSmooth, v);
    }
    const ring = new THREE.TorusGeometry(2.6, 0.4, 10, 40);
    ring.rotateY(Math.PI / 2);
    ring.translate(FX + 0.2, F.balustradeTop + 5.6, z);
    b.add(M.travertineSmooth, ring);
    zbox(b, T, FX - 3, FX - 0.1, F.balustradeTop + 3.4, F.balustradeTop + 8.4, z - 3, z + 3);
    // 頂部冠飾
    const crown = lathe([[0, 0], [1.6, 0], [1.4, 0.8], [0.9, 1.6], [0.3, 2.6], [0, 3.0]], 16);
    crown.translate(FX - 1.2, F.balustradeTop + 8.4, z);
    b.add(M.travertineSmooth, crown);
    b.add(M.travertineSmooth, boxAt(0.25, F.balustradeTop + 11.2, F.balustradeTop + 12.6, 0.25, FX - 1.2, z));
    b.add(M.travertineSmooth, boxAt(0.22, F.balustradeTop + 11.9, F.balustradeTop + 12.1, 1.0, FX - 1.2, z));
  }

  // ── 階梯（立面前的柱廊入口台階）──
  for (let i = 0; i < 4; i++) {
    zbox(b, M.slab, FX + 3 + i * 0.6, FX + 5.6 + i * 0.6, -0.6 - i * 0.15 + 0.6, 0.0 - i * 0.15, -HW + 2, HW - 2);
  }
  void trs;
}

/** 動態鐘面材質：顯示模擬時間 */
export class ClockFace {
  canvas = document.createElement('canvas');
  tex: THREE.CanvasTexture;
  mat: THREE.MeshStandardMaterial;
  private last = -1;
  constructor() {
    this.canvas.width = this.canvas.height = 256;
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.MeshStandardMaterial({ map: this.tex, roughness: 0.5, emissive: new THREE.Color(0, 0, 0), emissiveMap: this.tex });
    this.draw(10, 0);
  }
  draw(h: number, m: number) {
    const key = Math.floor(h) * 60 + Math.floor(m);
    if (key === this.last) return;
    this.last = key;
    const c = this.canvas.getContext('2d')!;
    c.clearRect(0, 0, 256, 256);
    c.fillStyle = '#e9e2cf';
    c.beginPath(); c.arc(128, 128, 126, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#3a2f22'; c.lineWidth = 5; c.stroke();
    c.fillStyle = '#2a2018';
    c.font = 'bold 26px "Times New Roman", serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    roman.forEach((r, i) => {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      c.save();
      c.translate(128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98);
      c.rotate(a + Math.PI / 2);
      c.fillText(r, 0, 0);
      c.restore();
    });
    const hand = (ang: number, len: number, w: number) => {
      c.lineWidth = w; c.lineCap = 'round';
      c.beginPath(); c.moveTo(128, 128);
      c.lineTo(128 + Math.cos(ang - Math.PI / 2) * len, 128 + Math.sin(ang - Math.PI / 2) * len); c.stroke();
    };
    c.strokeStyle = '#1b140e';
    hand(((h % 12) + m / 60) / 12 * Math.PI * 2, 56, 9);
    hand((m / 60) * Math.PI * 2, 84, 6);
    c.fillStyle = '#1b140e'; c.beginPath(); c.arc(128, 128, 8, 0, Math.PI * 2); c.fill();
    this.tex.needsUpdate = true;
  }
  meshes(group: THREE.Object3D) {
    for (const s of [-1, 1]) {
      const g = new THREE.CircleGeometry(2.45, 48);
      g.rotateY(Math.PI / 2);
      const m = new THREE.Mesh(g, this.mat);
      m.position.set(FX + 0.25, F.balustradeTop + 5.6, s * F.clockZ);
      group.add(m);
    }
  }
}

/** 飾帶銘文（真實文字：保祿五世 1612 年） */
export function inscriptionMesh(): THREE.Group {
  const c = document.createElement('canvas');
  c.width = 4096; c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = 'rgba(0,0,0,0)';
  x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = '#ffffff';
  x.font = '600 92px "Times New Roman", Georgia, serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const text = F.inscription.split('').join(String.fromCharCode(8202));
  x.fillText(text, 2048, 68, 4000);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ color: 0x2c2218, alphaMap: tex, transparent: true, roughness: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const W = 58, h = 1.75;
  const y = F.orderTop + 1.8 + (F.entablatureTop - 1.3 - F.orderTop - 1.8) / 2;
  const group = new THREE.Group();
  const segs: [number, number][] = [[-29, -15.5], [-15.5, 15.5], [15.5, 29]];
  for (const [z0, z1] of segs) {
    const g = new THREE.PlaneGeometry(z1 - z0, h);
    // 立面朝 +X，觀者看到的左側為 +Z（南）：u 由 +Z 往 -Z 遞增
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const zz = z1 - u * (z1 - z0); // rotateY(+90°) 後 u=0 位於 +Z 端
      uv.setX(i, (W / 2 - zz) / W);
    }
    g.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(entFront((z0 + z1) / 2) + 0.03, y, (z0 + z1) / 2);
    m.renderOrder = 2;
    group.add(m);
  }
  return group;
}
