import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * 簡化的著袍立像（高度 = 1，朝向 +X）。
 * 雕像的實際造型無法逐尊還原；這裡以比例正確的著袍人物表示，
 * 位置、數量、高度與名稱皆來自 OpenStreetMap / 文獻。
 */
function strip(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  return n;
}

function limb(a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const len = a.distanceTo(b);
  const g = new THREE.CapsuleGeometry(r, len, 4, 8);
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return strip(g);
}

export function statueGeometry(variant: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // 袍身：橢圓截面旋轉體 + 衣褶
  const prof: [number, number][] = [
    [0.0, 0.05], [0.175, 0.05], [0.18, 0.09], [0.165, 0.2], [0.145, 0.4], [0.14, 0.55], [0.15, 0.66],
    [0.158, 0.74], [0.17, 0.79], [0.12, 0.825], [0.05, 0.835], [0.0, 0.84],
  ];
  const robe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 28);
  const p = robe.attributes.position as THREE.BufferAttribute;
  const lean = (variant % 3) * 0.04 - 0.04;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ang = Math.atan2(z, x);
    const folds = 1 + 0.07 * Math.sin(ang * 9 + y * 6 + variant) * (1 - y) + 0.03 * Math.sin(ang * 17 + variant * 2);
    // 對立式（contrapposto）：膝部微彎
    const knee = Math.sin(y * Math.PI) * lean;
    p.setXYZ(i, x * folds + knee * 0.3, y, z * 0.72 * folds);
  }
  robe.computeVertexNormals();
  parts.push(strip(robe));
  // 斗篷披掛（斜向一側）
  const cloak = new THREE.CylinderGeometry(0.16, 0.2, 0.42, 16, 1, true, -0.3, Math.PI * 1.1);
  cloak.rotateZ(0.18 * (variant % 2 ? 1 : -1));
  cloak.translate(-0.02, 0.52, 0);
  parts.push(strip(cloak));
  // 頭部
  const head = new THREE.SphereGeometry(0.068, 14, 10);
  head.scale(0.9, 1.08, 0.88);
  head.translate(0.01, 0.9, 0);
  parts.push(strip(head));
  // 鬍鬚 / 髮
  const hair = new THREE.SphereGeometry(0.072, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
  hair.translate(-0.005, 0.905, 0);
  parts.push(strip(hair));
  // 手臂與持物
  const shL = new THREE.Vector3(0.0, 0.79, 0.15), shR = new THREE.Vector3(0.0, 0.79, -0.15);
  switch (variant % 4) {
    case 0: { // 舉手祝福 + 持書
      parts.push(limb(shL, new THREE.Vector3(0.12, 0.92, 0.22), 0.04));
      parts.push(limb(new THREE.Vector3(0.12, 0.92, 0.22), new THREE.Vector3(0.14, 1.04, 0.2), 0.032));
      parts.push(limb(shR, new THREE.Vector3(0.08, 0.6, -0.18), 0.042));
      const book = new THREE.BoxGeometry(0.09, 0.12, 0.03);
      book.rotateY(0.6);
      book.translate(0.12, 0.6, -0.16);
      parts.push(strip(book));
      break;
    }
    case 1: { // 持長杖 / 十字
      parts.push(limb(shL, new THREE.Vector3(0.14, 0.66, 0.2), 0.042));
      const staff = new THREE.CylinderGeometry(0.014, 0.014, 1.0, 6);
      staff.translate(0.16, 0.55, 0.22);
      parts.push(strip(staff));
      const bar = new THREE.BoxGeometry(0.02, 0.02, 0.16);
      bar.translate(0.16, 0.98, 0.22);
      parts.push(strip(bar));
      parts.push(limb(shR, new THREE.Vector3(0.05, 0.48, -0.17), 0.04));
      break;
    }
    case 2: { // 雙手攤開
      parts.push(limb(shL, new THREE.Vector3(0.12, 0.68, 0.3), 0.04));
      parts.push(limb(shR, new THREE.Vector3(0.12, 0.7, -0.3), 0.04));
      break;
    }
    default: { // 撫胸 + 持棕櫚枝
      parts.push(limb(shL, new THREE.Vector3(0.14, 0.7, 0.05), 0.042));
      parts.push(limb(shR, new THREE.Vector3(0.1, 0.62, -0.2), 0.04));
      const palm = new THREE.ConeGeometry(0.04, 0.4, 6);
      palm.translate(0.12, 0.85, -0.22);
      parts.push(strip(palm));
      break;
    }
  }
  // 小底座
  const base = new THREE.BoxGeometry(0.38, 0.05, 0.32);
  base.translate(0, 0.025, 0);
  parts.push(strip(base));
  const g = mergeGeometries(parts, false)!;
  g.computeBoundingSphere();
  return g;
}

export interface StatueSpec { x: number; y: number; z: number; height: number; facing: number; name?: string; }

/** 以 InstancedMesh 放置雕像（4 種姿態分組） */
export function buildStatues(specs: StatueSpec[], mat: THREE.Material, group: THREE.Object3D, tag: string) {
  const byVar: StatueSpec[][] = [[], [], [], []];
  specs.forEach((s, i) => byVar[(i * 7 + Math.floor(s.x * 3)) & 3].push(s));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const meshes: THREE.InstancedMesh[] = [];
  byVar.forEach((list, v) => {
    if (!list.length) return;
    const geo = statueGeometry(v);
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.facing);
      m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(s.height, s.height, s.height));
      im.setMatrixAt(i, m);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    im.userData = { kind: 'statues', tag, names: list.map((s) => s.name ?? '') };
    im.computeBoundingSphere();
    group.add(im);
    meshes.push(im);
  });
  return meshes;
}
