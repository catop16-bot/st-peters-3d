import * as THREE from 'three';
import { GeoBucket, boxAt, cylAt, lathe, archShape } from '../core/geometry';
import { statueGeometry } from '../world/statue';
import type { InteriorBuild } from './Interior';
import { IN, CH } from './Interior';

import { EXHIBITS } from './exhibitsData';
export { EXHIBITS, ZONES, type Exhibit, type Zone } from './exhibitsData';

/** 為一尊站立的簡化雕像生成網格（朝向 faceDir） */
function figure(variant: number, x: number, y: number, z: number, h: number, faceX: number, faceZ: number) {
  const g = statueGeometry(variant);
  g.scale(h, h, h);
  g.rotateY(Math.atan2(-faceZ, faceX));
  g.translate(x, y, z);
  return g;
}

/** 坐姿人物（聖殤的聖母、聖彼得像） */
function seated(x: number, y: number, z: number, h: number, faceX: number, faceZ: number) {
  const parts: THREE.BufferGeometry[] = [];
  const robe = lathe([[0.0, 0], [0.48, 0], [0.5, 0.12], [0.44, 0.3], [0.36, 0.42], [0.22, 0.52], [0.2, 0.62], [0.22, 0.72], [0.16, 0.8], [0.06, 0.82], [0, 0.83]], 24);
  robe.scale(1, 1, 0.8);
  parts.push(robe);
  const lap = new THREE.BoxGeometry(0.5, 0.14, 0.62); lap.translate(0.22, 0.42, 0); parts.push(lap);
  const head = new THREE.SphereGeometry(0.075, 14, 10); head.translate(0.02, 0.9, 0); parts.push(head);
  const g = mergeAll(parts);
  g.scale(h, h, h);
  g.rotateY(Math.atan2(-faceZ, faceX));
  g.translate(x, y, z);
  return g;
}

/**
 * 聖殤（簡化構圖）：聖母坐姿、寬大的三角形衣袍，頭戴頭紗微俯；
 * 基督橫躺於其膝上，頭向右後仰、雙腿垂向左側、右臂下垂。高約 1.74 m、寬約 1.95 m。
 */
function pieta(x: number, y: number, z: number) {
  const parts: THREE.BufferGeometry[] = [];
  // 聖母衣袍（寬底、向上收窄）
  const robe = lathe([[0, 0], [0.98, 0], [1.0, 0.1], [0.86, 0.32], [0.62, 0.62], [0.42, 0.95], [0.3, 1.2], [0.26, 1.36], [0.14, 1.44], [0, 1.46]], 32);
  robe.scale(1, 1, 0.62);
  parts.push(robe);
  // 頭與頭紗
  const head = new THREE.SphereGeometry(0.115, 16, 12); head.translate(0.04, 1.56, 0.04); parts.push(head);
  const veil = new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62); veil.rotateZ(-0.35); veil.translate(0.0, 1.59, 0.0); parts.push(veil);
  // 聖母左手微張
  const hand = new THREE.CapsuleGeometry(0.05, 0.35, 4, 8); hand.rotateZ(1.1); hand.translate(-0.55, 1.0, 0.25); parts.push(hand);
  // 基督：軀幹橫躺於膝上
  const torso = new THREE.CapsuleGeometry(0.15, 0.62, 4, 10); torso.rotateZ(Math.PI / 2 - 0.18); torso.translate(0.18, 0.86, 0.32); parts.push(torso);
  const ch = new THREE.SphereGeometry(0.1, 12, 10); ch.translate(0.66, 0.84, 0.36); parts.push(ch);
  // 雙腿垂向左側
  for (const dz of [0.24, 0.4]) {
    const thigh = new THREE.CapsuleGeometry(0.075, 0.42, 4, 8); thigh.rotateZ(Math.PI / 2 + 0.25); thigh.translate(-0.36, 0.78, dz); parts.push(thigh);
    const shin = new THREE.CapsuleGeometry(0.06, 0.46, 4, 8); shin.rotateZ(0.35); shin.translate(-0.7, 0.42, dz + 0.04); parts.push(shin);
  }
  // 右臂下垂
  const arm = new THREE.CapsuleGeometry(0.05, 0.55, 4, 8); arm.rotateZ(-0.15); arm.translate(0.42, 0.52, 0.52); parts.push(arm);
  const g = mergeAll(parts);
  g.translate(x, y, z);
  return g;
}

function mergeAll(gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [];
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...(g.attributes.position.array as Float32Array));
    nor.push(...(g.attributes.normal.array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

/** 所羅門式螺旋柱（華蓋）：柱身中心沿螺旋線擺動，並有縱向溝紋 */
function solomonic(x: number, z: number, y0: number, h: number, r: number) {
  const g = new THREE.CylinderGeometry(r, r * 1.08, h, 24, 96, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  const turns = 3;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const t = (vy + h / 2) / h;
    const ph = t * turns * Math.PI * 2;
    const amp = r * 0.45 * Math.sin(Math.min(1, t * 6) * Math.PI / 2) * Math.sin(Math.min(1, (1 - t) * 8) * Math.PI / 2);
    const ang = Math.atan2(vz, vx);
    const flute = 1 + 0.06 * Math.sin(ang * 10 + ph * 1.5);
    p.setXYZ(i, vx * flute + Math.cos(ph) * amp, vy, vz * flute + Math.sin(ph) * amp);
  }
  g.computeVertexNormals();
  g.translate(x, y0 + h / 2, z);
  return g;
}

export interface ExhibitBuild {
  pickables: THREE.Object3D[];
  markers: THREE.Mesh[];
  gloryMat: THREE.MeshStandardMaterial;
  update: (t: number, active: number) => void;
}

export function buildExhibits(build: InteriorBuild): ExhibitBuild {
  const { scene, mats } = build;
  const b = new GeoBucket();
  // 室內青銅（深色、局部鍍金），華蓋與聖彼得像使用
  const bronze = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.12, 0.085, 0.055), roughness: 0.42, metalness: 0.75 });
  const porphyry = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.36, 0.08, 0.07), roughness: 0.25, metalness: 0.0 });

  // 1. 斑岩圓盤
  b.add(porphyry, new THREE.CircleGeometry(1.3, 48).rotateX(-Math.PI / 2).translate(111.5, 0.015, 0));
  b.add(mats.marbleWhite, new THREE.RingGeometry(1.3, 1.5, 48).rotateX(-Math.PI / 2).translate(111.5, 0.014, 0));

  // 2. 聖門：16 格浮雕青銅門與鍍金十字
  for (let r = 0; r < 8; r++) for (let c = 0; c < 2; c++) {
    b.add(mats.bronze, boxAt(0.25, 0.4 + r * 0.95, 1.2 + r * 0.95, 1.8, IN.naveEnd - 0.2, -25 + (c - 0.5) * 2.05));
  }
  b.add(mats.gilded, boxAt(0.3, 8.6, 10.6, 0.25, IN.naveEnd - 0.3, -25));
  b.add(mats.gilded, boxAt(0.3, 9.6, 9.85, 1.4, IN.naveEnd - 0.3, -25));

  // 3. 聖殤：祭台、聖母坐像與橫躺的基督、玻璃
  const px = 110, pz = -31;
  b.add(mats.marbleDark, boxAt(3.4, 0, 1.3, 1.6, px, pz));
  b.add(mats.marble, boxAt(3.0, 1.3, 1.55, 1.4, px, pz));
  b.add(mats.marbleWhite, pieta(px, 1.55, pz));
  // 禮拜堂後牆：深色大理石拱龕＋鍍金框
  {
    const nich = new THREE.ShapeGeometry(archShape(3.2, 9), 16);
    nich.translate(px, 0, pz - 1.6);
    b.add(mats.marbleDark, nich);
    const fr = new THREE.Shape(); fr.setFromPoints(archShape(3.6, 9.4).getPoints(16)); fr.holes.push(new THREE.Path(archShape(3.2, 9).getPoints(16)));
    const fg = new THREE.ExtrudeGeometry(fr, { depth: 0.25, bevelEnabled: false, curveSegments: 16 }); fg.translate(px, 0, pz - 1.6);
    b.add(mats.gold, fg);
  }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.5).translate(px, 2.25, -24.5), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, roughness: 0.02, metalness: 0.0, depthWrite: false }));
  scene.add(glass);

  // 5. 聖彼得青銅像（東北巨柱面向中殿處）
  b.add(mats.marbleDark, boxAt(2.0, 0, 2.2, 1.6, 29.5, -12.6));
  b.add(mats.marble, boxAt(2.2, 2.2, 2.5, 1.8, 29.5, -12.6));
  b.add(bronze, seated(29.5, 2.5, -12.6, 2.1, 0, 1));
  b.add(bronze, boxAt(1.3, 2.5, 4.8, 0.25, 29.5, -13.4)); // 寶座椅背
  b.add(mats.gilded, boxAt(0.08, 3.9, 4.4, 0.08, 29.3, -12.0));

  // 6. 華蓋、教宗祭台、告解堂
  {
    // 祭台平台（七級台階）與祭台
    for (let k = 0; k < 6; k++) b.add(mats.marble, cylAt(6.6 - k * 0.35, 6.6 - k * 0.35, k * 0.22, (k + 1) * 0.22, 0, 0, 4));
    b.add(mats.marbleWhite, boxAt(4.4, 1.32, 2.4, 2.2));
    const C = 5.6;
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = sx * C, z = sz * C;
      b.add(mats.marbleDark, boxAt(2.3, 0, 2.4, 2.3, x, z)); // 大理石柱座（蜜蜂紋章所在）
      b.add(mats.gold, boxAt(2.4, 2.4, 2.6, 2.4, x, z));
      // 螺旋柱身＋柱頭合計約 20 m
      b.add(bronze, solomonic(x, z, 2.6, 18.4, 0.66));
      b.add(mats.gilded, lathe([[0.8, 0], [1.1, 0.5], [1.3, 1.2], [0.95, 1.3]], 12, x, z).translate(0, 21.0, 0));
      b.add(bronze, boxAt(2.0, 22.3, 23.6, 2.0, x, z));
      // 角落天使（簡化）
      b.add(mats.gilded, figure((sx + sz + 4) % 4, x, 23.6, z, 2.3, -sx, -sz));
      // 渦卷肋向上匯聚
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x * 0.95, 23.8, z * 0.95), new THREE.Vector3(x * 0.75, 25.7, z * 0.75), new THREE.Vector3(x * 0.35, 26.7, z * 0.35), new THREE.Vector3(0, 26.85, 0)]);
      b.add(bronze, new THREE.TubeGeometry(curve, 24, 0.32, 8));
    }
    // 檐部（四邊）與垂飾帷幔
    for (const [w, d, x, z] of [[2 * C + 2, 1.2, 0, C], [2 * C + 2, 1.2, 0, -C], [1.2, 2 * C + 2, C, 0], [1.2, 2 * C + 2, -C, 0]] as [number, number, number, number][]) {
      b.add(bronze, boxAt(w, 22.0, 23.6, d, x, z));
      b.add(mats.gilded, boxAt(w, 21.2, 22.0, d * 0.6, x, z));
    }
    // 頂端：球與十字（總高約 28.5–29 m）
    b.add(mats.gilded, lathe([[1.1, 26.7], [0.8, 27.1], [0.45, 27.3]], 16));
    const orb = new THREE.SphereGeometry(0.5, 20, 14); orb.translate(0, 27.7, 0); b.add(mats.gilded, orb);
    b.add(mats.gilded, boxAt(0.16, 28.1, 28.6, 0.16));
    b.add(mats.gilded, boxAt(0.5, 28.38, 28.5, 0.14));
    // 華蓋內頂：光芒中的聖靈之鴿
    b.add(mats.gilded, (() => { const g = new THREE.CircleGeometry(2.2, 32); g.rotateX(Math.PI / 2); g.translate(0, 21.9, 0); return g; })());
    // 告解堂欄杆與長明燈
    const cf = build.confessio;
    const rail: [number, number, number, number][] = [[cf.x0, -cf.hw, cf.x1, -cf.hw], [cf.x1, -cf.hw, cf.x1, cf.hw], [cf.x1, cf.hw, cf.x0, cf.hw]];
    for (const [x0, z0, x1, z1] of rail) {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const g = boxAt(L, 0, 1.0, 0.45);
      g.rotateY(Math.atan2(-(z1 - z0), x1 - x0));
      g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      b.add(mats.marble, g);
    }
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1.0, 0.7, 0.35), emissiveIntensity: 4 });
  {
    const cf = build.confessio;
    const lampPts: THREE.Vector3[] = [];
    // 46 盞豐饒角形油燈，沿欄杆三邊均勻排列
    const L1 = cf.x1 - cf.x0, L2 = 2 * cf.hw, tot = 2 * L1 + L2;
    for (let i = 0; i < 46; i++) {
      const d = ((i + 0.5) / 46) * tot;
      if (d < L1) lampPts.push(new THREE.Vector3(cf.x0 + d, 1.35, -cf.hw));
      else if (d < L1 + L2) lampPts.push(new THREE.Vector3(cf.x1, 1.35, -cf.hw + (d - L1)));
      else lampPts.push(new THREE.Vector3(cf.x1 - (d - L1 - L2), 1.35, cf.hw));
    }
    const lg = new THREE.SphereGeometry(0.09, 8, 6);
    const im = new THREE.InstancedMesh(lg, lampMat, lampPts.length);
    lampPts.forEach((p, i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    scene.add(im);
    const holder = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.05, 0.35, 6), mats.gilded, lampPts.length);
    lampPts.forEach((p, i) => holder.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y - 0.25, p.z)));
    scene.add(holder);
  }

  // 7. 四柱巨像（壁龕內，朝向中心）
  const pierSaints: [number, number, number][] = [[1, -1, 0], [-1, -1, 1], [-1, 1, 2], [1, 1, 3]]; // 東北聖朗基努斯、西北聖海倫娜、西南聖維羅妮卡、東南聖安德烈
  for (const [sx, sz, v] of pierSaints) {
    const x = sx * 17.9, z = sz * 17.9;
    b.add(mats.marble, boxAt(3.4, 0, 3.2, 3.4, x, z));
    b.add(mats.marbleWhite, figure(v, x, 3.2, z, 5.0, -sx, -sz));
  }

  // 8. 聖彼得寶座與光之窗
  const gloryMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1.0, 0.82, 0.45), emissiveIntensity: 4, roughness: 1 });
  {
    const x0 = IN.apseEnd + 2.4; // ≈ −63.6
    b.add(mats.marbleDark, boxAt(3.0, 0, 1.5, 7.5, x0 + 1, 0));
    b.add(mats.marble, boxAt(2.4, 1.5, 3.2, 9.0, x0 + 0.5, 0));
    // 四位聖師（前兩位較大）
    for (const [dz, dx, h, v] of [[4.2, 2.6, 5.4, 0], [-4.2, 2.6, 5.4, 2], [2.4, 0.6, 4.8, 1], [-2.4, 0.6, 4.8, 3]] as [number, number, number, number][]) {
      b.add(bronze, figure(v, x0 + dx, 3.2, dz, h, 1, -dz * 0.15));
    }
    // 寶座（鍍金青銅，浮在四聖師之上）
    b.add(bronze, boxAt(3.4, 7.6, 8.2, 4.6, x0 + 1.0, 0));
    b.add(mats.gilded, boxAt(3.0, 8.2, 11.4, 4.2, x0 + 1.0, 0));
    b.add(mats.gilded, boxAt(0.7, 11.4, 16.2, 4.0, x0 - 0.2, 0));
    b.add(mats.gilded, lathe([[2.0, 0], [1.6, 0.6], [0.4, 1.4], [0, 1.6]], 16).scale(1, 1, 1).translate(x0 - 0.2, 16.2, 0));
    for (const dz of [-2.2, 2.2]) b.add(mats.gilded, boxAt(0.6, 10.2, 13.4, 0.5, x0 + 1.0, dz));
    // 光芒與雲（圍繞雪花石膏窗）
    const gx = IN.apseEnd + 0.25, gy = 21.5;
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const len = 5.0 + (i % 2) * 3.4 + (i % 5 === 0 ? 2.0 : 0);
      const g = boxAt(0.1, 0, len, 0.22);
      g.translate(0, 2.7, 0);
      g.rotateX(a);
      g.translate(gx + 0.2, gy, 0);
      b.add(mats.gold, g);
    }
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + (i % 2) * 0.07;
      const r = 3.0 + (i % 4) * 0.9;
      const c = new THREE.SphereGeometry(0.55 + (i % 3) * 0.22, 10, 8);
      c.scale(0.5, 1, 1);
      c.translate(gx + 0.5, gy + Math.sin(a) * r, Math.cos(a) * r);
      b.add(mats.stucco, c);
    }
    const win = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48).scale(1, 1.15, 1).rotateY(Math.PI / 2).translate(gx + 0.05, gy, 0), gloryMat);
    scene.add(win);
    // 聖靈之鴿（翼展約 1.6 m）
    const dove = new THREE.Group();
    const body = new THREE.CapsuleGeometry(0.16, 0.35, 4, 8); body.rotateX(Math.PI / 2);
    const wing = new THREE.BoxGeometry(0.04, 0.24, 0.8);
    const dm = new THREE.MeshStandardMaterial({ color: 0x3a2a14, roughness: 0.6 });
    const bd = new THREE.Mesh(body, dm); const w1 = new THREE.Mesh(wing, dm); const w2 = new THREE.Mesh(wing, dm);
    w1.position.set(0, 0.05, 0.4); w2.position.set(0, 0.05, -0.4); w1.rotation.x = 0.25; w2.rotation.x = -0.25;
    dove.add(bd, w1, w2);
    dove.rotation.y = Math.PI / 2;
    dove.position.set(gx + 0.12, gy + 0.2, 0);
    scene.add(dove);
  }

  // 9. 亞歷山大七世紀念碑：左（南）耳堂外側牆，包住通往出口的門
  alexanderVII(b, mats).put(b, -IN.halfW + 0.3, 40, 1, 0); // 牆厚 0.6 m，貼齊牆面

  // 10. 其餘展品與祭台
  buildMore(b, build, bronze, porphyry);

  b.build(scene, { cast: false, receive: false });

  // ── 導覽點與資訊熱點 ──
  const pickables: THREE.Object3D[] = [];
  const markers: THREE.Mesh[] = [];
  const ringGeo = new THREE.RingGeometry(0.55, 0.75, 40).rotateX(-Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(0.55, 40).rotateX(-Math.PI / 2);
  const hotTex = hotspotTexture();
  EXHIBITS.forEach((e, i) => {
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.55), transparent: true, opacity: 0.8, depthWrite: false, fog: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(e.station[0], 0.03, e.station[2]);
    ring.userData = { exhibit: i };
    const disc = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.9, 0.7), transparent: true, opacity: 0.18, depthWrite: false, fog: false }));
    disc.position.copy(ring.position);
    disc.userData = { exhibit: i };
    scene.add(ring, disc);
    markers.push(ring);
    pickables.push(ring, disc);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: hotTex, transparent: true, depthTest: false, fog: false }));
    sp.position.set(...e.hotspot);
    sp.scale.setScalar(0.9);
    sp.userData = { exhibit: i, hotspot: true };
    sp.renderOrder = 10;
    scene.add(sp);
    pickables.push(sp);
  });

  return {
    pickables, markers, gloryMat,
    update: (t: number, active: number) => {
      markers.forEach((m, i) => {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + i);
        (m.material as THREE.MeshBasicMaterial).opacity = i === active ? 0.25 : 0.45 + 0.4 * pulse;
        m.scale.setScalar(1 + 0.12 * pulse);
      });
      lampMat.emissiveIntensity = 3.5 + 0.5 * Math.sin(t * 7.3) * Math.sin(t * 3.1);
    },
  };
}

function hotspotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,230,170,0.95)');
  g.addColorStop(0.5, 'rgba(230,180,90,0.55)');
  g.addColorStop(1, 'rgba(230,180,90,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  x.fillStyle = 'rgba(40,28,10,0.85)';
  x.beginPath(); x.arc(64, 64, 26, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#f6e3b4';
  x.font = 'italic 700 38px "Times New Roman", serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('i', 64, 66);
  return new THREE.CanvasTexture(c);
}

// ───────────────────────── 共用構件 ─────────────────────────
type Mats = InteriorBuild['mats'];

/**
 * 在「本地座標」中組裝的構件：牆面為 x = 0、房間在 +x、寬度沿 z。
 * put() 依面向 (fx, fz) 旋轉後放到 (x, z)。
 */
class Piece {
  items: [THREE.Material, THREE.BufferGeometry][] = [];
  add(m: THREE.Material, g: THREE.BufferGeometry) { this.items.push([m, g]); return this; }
  put(b: GeoBucket, x: number, z: number, fx: number, fz: number, y = 0) {
    const a = Math.atan2(-fz, fx);
    for (const [m, g] of this.items) { g.rotateY(a); g.translate(x, y, z); b.add(m, g); }
    this.items = [];
  }
}

/** 牆面上的拱形板（面向 +x） */
function archPanel(hw: number, h: number, lx: number, y0 = 0) {
  const g = new THREE.ShapeGeometry(archShape(hw, h), 16);
  g.rotateY(Math.PI / 2);
  g.translate(lx, y0, 0);
  return g;
}
/** 拱形框（面向 +x，厚 depth） */
function archFrame(hwIn: number, hIn: number, t: number, depth: number, lx: number, y0 = 0) {
  const fr = new THREE.Shape();
  fr.setFromPoints(archShape(hwIn + t, hIn + t).getPoints(16));
  fr.holes.push(new THREE.Path(archShape(hwIn, hIn).getPoints(16)));
  const g = new THREE.ExtrudeGeometry(fr, { depth, bevelEnabled: false, curveSegments: 16 });
  g.rotateY(Math.PI / 2);
  g.translate(lx, y0, 0);
  return g;
}

interface ExtraMats { granite: THREE.Material; mosaic: THREE.Material; iron: THREE.Material; yellow: THREE.Material; bronze: THREE.Material; porphyry: THREE.Material }
let X: ExtraMats;

/**
 * 祭台：台階、祭台桌、兩側深色花崗岩柱、檐部，與鍍金框中的祭壇畫。
 * 祭壇畫多為馬賽克複製；此處以深色畫板表示，不仿造畫面。
 */
function altar(M: Mats, o: { w?: number; h?: number; panel?: THREE.Material; mensa?: boolean; cols?: boolean } = {}) {
  const w = o.w ?? 5, h = o.h ?? 9, P = new Piece();
  P.add(M.marbleDark, boxAt(0.25, 0, h + 1.2, w + 2.0, 0.12));
  if (o.mensa !== false) {
    P.add(M.marble, boxAt(2.6, 0, 0.3, w + 1.2, 1.3));
    P.add(M.marbleWhite, boxAt(1.2, 0.3, 1.3, Math.min(3.4, w - 0.6), 0.85));
    P.add(M.gold, boxAt(0.05, 0.75, 0.85, Math.min(3.4, w - 0.6) - 0.2, 1.46));
  }
  const pw = w - 1.4;
  P.add(o.panel ?? X.mosaic, boxAt(0.1, 1.9, h - 0.9, pw, 0.3));
  for (const y of [1.65, h - 0.9]) P.add(M.gold, boxAt(0.22, y, y + 0.25, pw + 0.5, 0.36));
  for (const s of [-1, 1]) P.add(M.gold, boxAt(0.22, 1.65, h - 0.65, 0.25, 0.36, s * (pw / 2 + 0.12)));
  if (o.cols !== false) for (const s of [-1, 1]) {
    P.add(M.marble, boxAt(1.0, 0, 1.4, 1.0, 0.8, s * (w / 2 + 0.2)));
    P.add(X.granite, cylAt(0.36, 0.32, 1.4, h - 0.7, 0.8, s * (w / 2 + 0.2), 16));
    P.add(M.gold, boxAt(0.9, h - 0.9, h - 0.6, 0.9, 0.8, s * (w / 2 + 0.2)));
  }
  P.add(M.marble, boxAt(1.4, h - 0.6, h + 0.2, w + 1.8, 0.7));
  P.add(M.gold, boxAt(1.45, h - 0.35, h - 0.25, w + 1.85, 0.7));
  return P;
}

/** 教宗紀念碑：壁龕、基座、石棺、上方教宗像，可選兩尊寓意像 */
function tomb(M: Mats, o: { pope: 'seated' | 'kneel' | 'stand'; popeMat: THREE.Material; figMat?: THREE.Material; sarc?: THREE.Material; allegories?: boolean; skeleton?: boolean }) {
  const P = new Piece();
  P.add(M.marbleDark, archPanel(2.7, 10.5, 0.03));
  P.add(M.gold, archFrame(2.7, 10.5, 0.4, 0.25, 0.0));
  P.add(M.marble, boxAt(1.8, 0, 1.4, 4.6, 1.0));
  P.add(o.sarc ?? M.marbleDark, boxAt(1.4, 1.4, 2.7, 3.2, 0.95));
  P.add(M.gold, boxAt(1.45, 2.5, 2.6, 3.25, 0.95));
  P.add(M.marble, boxAt(1.2, 2.7, 3.5, 1.7, 0.75));
  if (o.pope === 'seated') P.add(o.popeMat, seated(0.75, 3.5, 0, 2.3, 1, 0));
  else P.add(o.popeMat, figure(o.pope === 'kneel' ? 2 : 0, 0.75, 3.5, 0, o.pope === 'kneel' ? 2.0 : 2.7, 1, 0));
  if (o.allegories !== false) for (const s of [-1, 1]) P.add(o.figMat ?? M.marbleWhite, figure(s > 0 ? 1 : 3, 2.1, 0, s * 1.75, 2.6, 1, s * 0.3));
  if (o.skeleton) P.add(M.gilded, figure(3, 1.75, 1.6, 0.6, 1.2, 1, 0));
  return P;
}

/** 獅子（簡化：臥姿，朝 +x） */
function lion(P: Piece, mat: THREE.Material, lx: number, lz: number) {
  const body = new THREE.CapsuleGeometry(0.42, 1.2, 4, 10); body.rotateZ(Math.PI / 2); body.scale(1, 0.75, 1); body.translate(lx - 0.2, 0.4, lz); P.add(mat, body);
  const head = new THREE.SphereGeometry(0.42, 14, 10); head.translate(lx + 0.75, 0.7, lz); P.add(mat, head);
  const mane = new THREE.SphereGeometry(0.55, 14, 10); mane.scale(0.7, 1, 1); mane.translate(lx + 0.55, 0.7, lz); P.add(mat, mane);
}

/** 騎馬像（簡化：揚蹄戰馬與騎者，朝 +x） */
function equestrian(P: Piece, mat: THREE.Material, S: number, y0: number) {
  const parts: THREE.BufferGeometry[] = [];
  const torso = new THREE.CapsuleGeometry(0.36, 1.1, 4, 12); torso.rotateZ(Math.PI / 2); torso.translate(0, 1.35, 0); parts.push(torso);
  const neck = new THREE.CapsuleGeometry(0.2, 0.6, 4, 8); neck.rotateZ(-0.7); neck.translate(0.85, 1.75, 0); parts.push(neck);
  const head = new THREE.CapsuleGeometry(0.13, 0.42, 4, 8); head.rotateZ(-1.9); head.translate(1.2, 2.0, 0); parts.push(head);
  for (const [lx, lz, fr] of [[0.6, 0.18, 1], [0.6, -0.18, 1], [-0.6, 0.18, 0], [-0.6, -0.18, 0]] as [number, number, number][]) {
    const leg = new THREE.CapsuleGeometry(0.08, 0.95, 4, 6);
    if (fr) { leg.rotateZ(1.1); leg.translate(lx + 0.35, 1.05, lz); } else leg.translate(lx, 0.6, lz);
    parts.push(leg);
  }
  const tail = new THREE.CapsuleGeometry(0.07, 0.7, 4, 6); tail.rotateZ(0.5); tail.translate(-0.95, 1.05, 0); parts.push(tail);
  const rider = statueGeometry(1); rider.scale(1.15, 1.15, 1.15); rider.translate(0.05, 1.25, 0); parts.push(rider);
  const g = mergeAll(parts);
  g.rotateZ(0.35); // 揚蹄
  g.scale(S, S, S);
  g.translate(0, y0 + 0.25 * S, 0);
  P.add(mat, g);
}

/** 亞歷山大七世紀念碑（本地座標） */
function alexanderVII(b: GeoBucket, M: Mats) {
  void b;
  const P = new Piece();
  const jasper = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.48, 0.16, 0.1), roughness: 0.3 });
  P.add(M.marbleDark, archPanel(3.7, 14.2, 0.03));
  P.add(M.gold, archFrame(3.7, 14.2, 0.35, 0.3, 0.0));
  P.add(M.marbleDark, boxAt(1.6, 0, 1.0, 7.0, 0.8));
  P.add(M.dark, archPanel(1.3, 4.2, 0.06));
  const drape = new THREE.CylinderGeometry(3.2, 3.5, 4.2, 24, 1, true, 0, Math.PI);
  drape.scale(0.35, 1, 1); drape.translate(0.2, 6.3, 0);
  P.add(jasper, drape);
  P.add(M.marble, boxAt(1.4, 8.4, 9.8, 3.2, 0.7));
  P.add(M.marbleWhite, figure(2, 0.7, 9.8, 0, 2.6, 1, 0)); // 跪姿教宗（簡化）
  for (const [dz, v] of [[-2.8, 0], [2.8, 1]] as [number, number][]) P.add(M.marbleWhite, figure(v, 1.4, 1.0, dz, 3.0, 1, -dz * 0.1));
  for (const [dz, v] of [[-1.9, 2], [1.9, 3]] as [number, number][]) P.add(M.marbleWhite, figure(v, 1.0, 8.4, dz, 2.4, 1, -dz * 0.1));
  P.add(M.gilded, figure(3, 0.6, 4.4, 0, 1.6, 1, 0)); // 高舉沙漏的鍍金骷髏（簡化）
  return P;
}

/** 其餘展品與祭台（位置依官方平面圖近似） */
function buildMore(b: GeoBucket, build: InteriorBuild, bronze: THREE.Material, porphyry: THREE.Material) {
  const M = build.mats, W = IN.halfW, A = IN.aisleOuter, AI = IN.aisleInner;
  X = {
    granite: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.06, 0.055, 0.055), roughness: 0.28 }),
    mosaic: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.15, 0.1), roughness: 0.45, metalness: 0.25 }),
    iron: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.05, 0.045, 0.04), roughness: 0.5, metalness: 0.8 }),
    yellow: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.78, 0.6, 0.32), roughness: 0.3 }),
    bronze, porphyry,
  };
  const navMosaic = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.1, 0.16, 0.2), roughness: 0.4, metalness: 0.3 });

  // ── 柱廊 ──
  const PX = IN.naveEnd + IN.wallT, PX1 = IN.porticoX1, pcx = (PX + PX1) / 2;
  {
    // 菲拉雷特銅門：兩扇門扇向柱廊敞開
    const th = 1.15;
    for (const s of [-1, 1]) {
      const P = new Piece();
      P.add(bronze, boxAt(3.0, 0, 8, 0.22));
      for (let r = 0; r < 3; r++) for (const c of [-0.72, 0.72]) P.add(M.bronze, boxAt(1.2, 0.5 + r * 2.5, 2.7 + r * 2.5, 0.32, c, 0));
      P.add(M.gilded, boxAt(3.0, 7.75, 8, 0.3));
      const dir = [Math.sin(th), -s * Math.cos(th)];
      P.put(b, PX + dir[0] * 1.5, s * 3 + dir[1] * 1.5, dir[0], dir[1]);
    }
    // 聖門（柱廊側）：16 格青銅浮雕
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) b.add(M.bronze, boxAt(0.2, 0.5 + r * 1.85, 2.15 + r * 1.85, 0.95, PX + 0.15, -25 + (c - 1.5) * 1.03));
    b.add(M.gilded, boxAt(0.25, 8.6, 9.6, 3.2, PX + 0.15, -25));
    // 《小船》馬賽克：中央拱洞上方（立面內側）
    b.add(M.gold, boxAt(0.2, 9.5, 13.0, 8.4, PX1 - 0.1, 0));
    b.add(navMosaic, boxAt(0.2, 9.75, 12.75, 7.8, PX1 - 0.2, 0));
    // 君士坦丁（北端，國王階梯腳下）：揚蹄戰馬，身後灰泥帷幔
    const c = new Piece();
    c.add(M.marble, boxAt(4.6, 0, 2.2, 2.4));
    equestrian(c, M.marbleWhite, 1.55, 2.2);
    c.put(b, pcx, -41.5, 0.9, 0.44);
    const drape = new THREE.CylinderGeometry(3.8, 4.1, 9, 24, 1, true, Math.PI * 0.65, Math.PI * 0.7);
    drape.translate(pcx, 6.5, -41.5);
    b.add(M.stucco, inward2(drape));
    // 查理曼（南端）
    const ch = new Piece();
    ch.add(M.marble, boxAt(4.6, 0, 2.2, 2.4));
    equestrian(ch, M.marbleWhite, 1.5, 2.2);
    ch.put(b, pcx, 41.5, 0.9, -0.44);
  }

  // ── 中殿：聖水盆與小天使（第一拱旁兩側） ──
  for (const s of [-1, 1]) {
    const P = new Piece();
    P.add(X.yellow, lathe([[0.02, 0], [0.55, 0.05], [0.95, 0.3], [1.05, 0.5], [0.9, 0.52], [0.5, 0.3], [0.02, 0.25]], 24).scale(1, 1, 0.75).translate(1.1, 0.95, 0));
    P.add(M.marble, cylAt(0.3, 0.22, 0, 0.95, 1.1, 0, 12));
    P.add(M.marbleWhite, figure(s > 0 ? 1 : 0, 0.55, 0, s * 0.55, 2.0, 1, 0));
    P.put(b, 103, s * W, 0, -s);
  }

  // ── 左側廊（南，z > 0） ──
  // 洗禮堂：古代紅斑岩洗禮池與鍍金青銅池蓋、祭壇畫
  { const P = altar(M, { w: 5.6, h: 9.5, mensa: false }); P.put(b, 110, A, 0, -1); }
  b.add(porphyry, lathe([[0.01, 0], [0.8, 0], [1.0, 0.4], [1.5, 0.75], [1.6, 1.15], [1.45, 1.2]], 32, 110, 28.6));
  b.add(M.gilded, lathe([[1.55, 1.2], [1.2, 1.6], [0.6, 2.2], [0.25, 2.8], [0.1, 3.2], [0.01, 3.35]], 24, 110, 28.6));
  // 斯圖亞特王族紀念碑（Canova）：白色碑、三人肖像、墓門兩側天使
  {
    const P = new Piece();
    P.add(M.marbleWhite, boxAt(0.8, 0, 1.0, 3.6, 0.45));
    P.add(M.marbleWhite, boxAt(0.6, 1.0, 8.6, 2.8, 0.35));
    P.add(M.marbleWhite, lathe([[0.01, 0], [1.4, 0], [0.01, 0.9]], 4, 0.35, 0).scale(0.3, 1, 1).translate(0, 8.6, 0));
    P.add(M.dark, boxAt(0.05, 1.0, 3.6, 1.4, 0.67));
    for (let k = 0; k < 3; k++) {
      const med = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 24); med.rotateZ(Math.PI / 2); med.translate(0.7, 4.6 + k * 1.1, 0); P.add(M.marbleWhite, med);
    }
    for (const s of [-1, 1]) P.add(M.marbleWhite, figure(s > 0 ? 0 : 1, 1.2, 1.0, s * 1.15, 2.1, 1, 0));
    P.put(b, 103, AI, 0, 1);
  }
  // 依諾增爵八世紀念碑（青銅）：坐姿教宗在上、臥像在下
  {
    const P = tomb(M, { pope: 'seated', popeMat: bronze, figMat: bronze, sarc: bronze, allegories: false });
    const rec = new THREE.CapsuleGeometry(0.28, 1.6, 4, 10); rec.rotateX(Math.PI / 2); rec.translate(1.0, 1.85, 0); P.add(bronze, rec);
    P.put(b, 89, AI, 0, 1);
  }
  // 主顯聖容祭台（聖安德烈柱外側）、克勉禮拜堂聖額我略祭台
  altar(M, { w: 5.2, h: 10 }).put(b, IN.pierOuter, 25, 1, 0);
  altar(M, { w: 5.2, h: 9.5 }).put(b, 40, A, 0, -1);
  // 左側廊其他禮拜堂（獻主禮拜堂、詠禮司鐸禮拜堂）：祭台與鐵門
  altar(M, { w: 5.2, h: 9 }).put(b, 96, A, 0, -1);
  chapelGate(M).put(b, 82, A, 0, -1);

  // ── 左耳堂（南）三祭台：中央聖若瑟，右（西）聖多默，左（東）聖伯多祿倒釘十字架 ──
  transeptAltars(b, M, 1);
  // ── 右耳堂（北）三祭台：中央聖普羅策素與瑪爾定，右（東）聖文策老，左（西）聖伊拉斯謨 ──
  transeptAltars(b, M, -1);

  // ── 後殿 ──
  // 聖良一世祭台：大理石高浮雕（兩側黑色花崗岩柱）
  {
    const P = altar(M, { w: 5.6, h: 10.5, panel: M.marbleDark });
    for (const [dz, v, h] of [[-1.3, 0, 2.6], [0.2, 2, 2.9], [1.5, 1, 2.4]] as [number, number, number][]) {
      const g = statueGeometry(v); g.scale(0.45 * h, h, h); g.translate(0.55, 2.4, dz); P.add(M.marbleWhite, g);
    }
    P.put(b, CH.x0 + 0.3, 44.5, 1, 0); // 圓柱聖母禮拜堂右側
  }

  // ── 39 尊修會創辦人像：依官方位置圖分區擺放（同區內各尊的確切壁龕未標示，雕像不標名） ──
  founderNiches(b, M);

  // ── 後殿轉角禮拜堂（牆厚 0.6 m，構件貼齊牆面 +0.3） ──
  const brocatello = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.32, 0.16), roughness: 0.3 });
  // 西南：圓柱聖母禮拜堂一帶
  altar(M, { w: 5, h: 9.5 }).put(b, -37.5, CH.z0 + 0.3, 0, 1); // 耶穌聖心
  altar(M, { w: 5, h: 9.5 }).put(b, -43.5, CH.z1 - 0.3, 0, -1); // 治癒癱子
  {
    const P = altar(M, { w: 5.4, h: 10 }); // 圓柱聖母：聖像繪於大理石柱段上
    P.add(M.marble, boxAt(0.5, 3.0, 8.2, 1.6, 0.55));
    P.add(M.gold, boxAt(0.25, 4.4, 7.4, 1.9, 0.5));
    P.put(b, CH.x1 - 0.3, 40, -1, 0);
  }
  tomb(M, { pope: 'seated', popeMat: bronze }).put(b, CH.corrX - CH.corrHW + 0.3, 23.5, 1, 0); // 亞歷山大八世
  // 西北：聖彌額爾與聖佩特羅尼拉禮拜堂一帶
  tomb(M, { pope: 'seated', popeMat: M.marbleWhite }).put(b, CH.corrX - CH.corrHW + 0.3, -23.5, 1, 0); // 克勉十世
  altar(M, { w: 5.6, h: 10 }).put(b, CH.x0 + 0.3, -44.5, 1, 0); // 聖佩特羅尼拉（禮拜堂後方）
  altar(M, { w: 5, h: 9.5 }).put(b, -43.5, -CH.z1 + 0.3, 0, 1); // 聖彌額爾
  altar(M, { w: 5, h: 9.5 }).put(b, CH.x1 - 0.3, -40, -1, 0); // 塔比莎
  {
    const P = altar(M, { w: 5, h: 9.5, cols: false }); // 《小船》祭台：兩旁為 brocatello 大理石柱
    for (const s of [-1, 1]) P.add(brocatello, cylAt(0.36, 0.32, 1.4, 8.8, 0.8, s * 2.7, 16));
    P.put(b, -37.5, -CH.z0 - 0.3, 0, -1);
  }
  // 保祿三世（寶座左側）、烏爾巴諾八世（寶座右側）：位於後殿半圓牆上
  const apseC = -(Math.abs(IN.apseEnd) - W), th = (55 * Math.PI) / 180;
  for (const s of [1, -1]) {
    const px = apseC - W * Math.cos(th) + 0.25 * Math.cos(th), pz = s * (W * Math.sin(th) - 0.25 * Math.sin(th));
    const P = s > 0
      ? tomb(M, { pope: 'seated', popeMat: bronze, sarc: M.marbleDark })
      : tomb(M, { pope: 'stand', popeMat: bronze, sarc: X.granite, skeleton: true });
    P.put(b, px, pz, Math.cos(th), -s * Math.sin(th));
  }

  // ── 右耳堂外側牆：克勉十三世紀念碑（Canova）：跪姿教宗、墓門兩側石獅 ──
  {
    const P = new Piece();
    P.add(M.marbleDark, archPanel(3.4, 13, 0.03));
    P.add(M.gold, archFrame(3.4, 13, 0.35, 0.3, 0.0));
    P.add(M.marbleWhite, boxAt(1.6, 0, 1.0, 6.2, 0.85));
    P.add(M.dark, archPanel(1.0, 2.8, 0.06, 1.0));
    P.add(M.marbleWhite, boxAt(1.2, 1.0, 5.6, 3.6, 0.6));
    P.add(M.marbleWhite, boxAt(1.3, 5.6, 6.6, 2.0, 0.65));
    P.add(M.marbleWhite, figure(2, 0.7, 6.6, 0, 2.2, 1, 0));
    for (const s of [-1, 1]) {
      lion(P, M.marbleWhite, 1.4, s * 1.9);
      P.add(M.marbleWhite, figure(s > 0 ? 0 : 1, 1.6, 1.0, s * 2.4, 2.6, 1, -s * 0.2));
    }
    P.put(b, -W + 0.3, -40, 1, 0);
  }

  // ── 右側廊（北，z < 0） ──
  // 聖熱羅尼莫祭台（聖朗基努斯柱背面）、額我略禮拜堂援助聖母祭台
  altar(M, { w: 5.2, h: 10 }).put(b, IN.pierOuter, -25, 1, 0);
  {
    const P = altar(M, { w: 5.2, h: 9.5 });
    P.add(M.gold, boxAt(0.15, 4.0, 6.4, 1.8, 0.4)); // 12 世紀木板聖像的鍍金外框
    P.add(porphyry, boxAt(0.9, 0.35, 1.25, 1.6, 0.85)); // 祭台下的斑岩甕（簡化）
    P.put(b, 40, -A, 0, 1);
  }
  // 聖體禮拜堂：只在鐵門外觀看
  chapelGate(M).put(b, 82, -A, 0, 1);
  // 瑪蒂爾達女伯爵紀念碑：壁龕中的立像、石棺正面浮雕
  {
    const P = new Piece();
    P.add(M.marbleDark, archPanel(2.4, 10, 0.03));
    P.add(M.gold, archFrame(2.4, 10, 0.35, 0.25, 0.0));
    P.add(M.marble, boxAt(1.6, 0, 1.2, 4.2, 0.9));
    P.add(M.marbleWhite, boxAt(1.3, 1.2, 2.9, 3.4, 0.8));
    P.add(M.marble, boxAt(0.08, 1.4, 2.7, 3.0, 1.48));
    P.add(M.marbleWhite, figure(1, 0.8, 2.9, 0, 3.0, 1, 0));
    P.put(b, 89, -AI, 0, -1);
  }
  // 聖塞巴斯蒂安禮拜堂（聖若望保祿二世之墓）與兩側教宗立像
  {
    const P = altar(M, { w: 5.4, h: 9.5 });
    for (const s of [-1, 1]) {
      P.add(M.marble, boxAt(1.2, 0, 1.6, 1.2, 1.3, s * 4.6));
      P.add(bronze, figure(s > 0 ? 0 : 2, 1.3, 1.6, s * 4.6, 2.8, 1, 0));
    }
    P.put(b, 96, -A, 0, 1);
  }
  // 瑞典女王克莉絲蒂娜紀念碑：鍍金青銅圓章、白色大理石浮雕
  {
    const P = new Piece();
    P.add(M.marbleDark, archPanel(2.3, 9.5, 0.03));
    P.add(M.marble, boxAt(1.4, 0, 1.4, 3.8, 0.8));
    P.add(M.marbleWhite, boxAt(0.25, 1.6, 3.4, 3.2, 1.0));
    P.add(M.marbleDark, boxAt(1.2, 3.6, 4.8, 3.0, 0.7));
    const med = new THREE.CylinderGeometry(0.85, 0.85, 0.18, 32); med.rotateZ(Math.PI / 2); med.translate(0.45, 6.4, 0); P.add(M.gilded, med);
    P.add(M.gilded, lathe([[0.01, 0], [0.5, 0.1], [0.01, 0.8]], 8, 0.45, 0).translate(0, 7.3, 0));
    P.put(b, 103, -AI, 0, -1);
  }
}

/** 禮拜堂鐵門（聖體禮拜堂、詠禮司鐸禮拜堂）：深色拱口 + 鐵柵 */
function chapelGate(M: Mats) {
  const P = new Piece();
  P.add(M.dark, archPanel(4.6, 13, 0.03));
  P.add(M.gold, archFrame(4.6, 13, 0.5, 0.35, 0.0));
  for (let k = -16; k <= 16; k++) P.add(X.iron, boxAt(0.06, 0, 4.4, 0.06, 0.7, k * 0.27));
  for (const y of [0.15, 2.2, 4.3]) P.add(X.iron, boxAt(0.1, y, y + 0.12, 9.0, 0.7));
  P.add(M.gilded, boxAt(0.12, 4.4, 4.9, 9.2, 0.7));
  return P;
}

/** 耳堂三祭台：半圓殿中央一座、兩側（±50°）各一座 */
function transeptAltars(b: GeoBucket, M: Mats, sgn: number) {
  const W = IN.halfW, c = IN.transeptEnd - W;
  for (const deg of [0, 50, -50]) {
    const a = (deg * Math.PI) / 180;
    const nx = Math.sin(a), nz = Math.cos(a) * sgn; // 從圓心指向牆
    const x = nx * (W - 0.02), z = sgn * c + nz * (W - 0.02);
    altar(M, { w: deg === 0 ? 5.8 : 5.0, h: deg === 0 ? 10.5 : 9.5 }).put(b, x, z, -nx, -nz);
  }
}

function inward2(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g.clone();
  const p = n.attributes.position.array as Float32Array;
  for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  for (const key of Object.keys(n.attributes)) if (key !== 'position') n.deleteAttribute(key);
  n.computeVertexNormals();
  return n;
}

/**
 * 修會創辦人像壁龕（上下兩層）：
 * 左中殿 8、右中殿 7（右側最靠穹頂的下層為聖彼得青銅像）、兩耳堂西側 8、東側 8、後殿兩側 8，共 39 尊。
 */
function founderNiches(b: GeoBucket, M: Mats) {
  const W = IN.halfW, cols: [number, number, number, number, boolean][] = []; // x, z, fx, fz, 有下層
  for (const x of [28, 47, 61, 75]) {
    cols.push([x, W, 0, -1, true]); // 左中殿（南）
    cols.push([x === 28 ? 29.5 : x, -W, 0, 1, x !== 28]); // 右中殿（北）；聖彼得像上方只有上層
  }
  for (const s of [-1, 1]) for (const z of [25.5, 30.5]) {
    cols.push([-W, s * z, 1, 0, true]); // 耳堂西側
    cols.push([W, s * z, -1, 0, true]); // 耳堂東側
    cols.push([-z, s * W, 0, -s, true]); // 後殿兩側
  }
  let v = 0;
  for (const [x, z, fx, fz, lower] of cols) {
    for (const y0 of lower ? [1.2, 12.5] : [12.5]) {
      const P = new Piece();
      P.add(M.marbleDark, archPanel(1.15, 6.0, 0.03, y0));
      P.add(M.gold, archFrame(1.15, 6.0, 0.22, 0.15, 0.0, y0));
      P.add(M.marble, boxAt(0.8, y0, y0 + 0.45, 1.7, 0.4));
      P.add(M.marbleWhite, figure(v++ % 4, 0.45, y0 + 0.45, 0, 4.7, 1, 0));
      P.put(b, x, z, fx, fz);
    }
  }
}
