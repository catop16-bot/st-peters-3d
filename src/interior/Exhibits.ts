import * as THREE from 'three';
import { GeoBucket, boxAt, cylAt, lathe, archShape } from '../core/geometry';
import { statueGeometry } from '../world/statue';
import type { InteriorBuild } from './Interior';
import { IN } from './Interior';

/** 展品：資料（解說、導覽點）＋程式建模。modelUrl 預留給之後的真實 3D 掃描（glTF） */
export interface Exhibit {
  id: string;
  title: string;
  subtitle: string; // 作者 · 年代 · 材質尺寸
  text: string;
  station: [number, number, number]; // 觀看位置（眼高）
  look: [number, number, number]; // 注視點
  hotspot: [number, number, number]; // 展品旁的資訊點
  fov?: number;
  modelUrl?: string;
}

export const EXHIBITS: Exhibit[] = [
  {
    id: 'rota', title: '斑岩圓盤 Rota Porfiretica', subtitle: '古羅馬紅斑岩 · 直徑約 2.6 m',
    text: '中央大門內的深紅色斑岩圓盤。依傳統，西元 800 年聖誕節，查理曼在舊聖彼得大教堂跪在這塊圓盤上，由教宗良三世加冕為皇帝。新教堂興建後，圓盤被移到今天的位置。',
    station: [106.5, 1.7, 4.5], look: [111.5, 0, 0], hotspot: [111.5, 1.2, 0], fov: 60,
  },
  {
    id: 'holydoor', title: '聖門 Porta Santa', subtitle: '青銅門扇 · Vico Consorti 作，1950 年',
    text: '入口最右側的門，平時封閉，只在禧年由教宗親自開啟，象徵通往恩典之門。最近一次是 2025 年禧年：2024 年 12 月 24 日開啟，2026 年 1 月 6 日關閉。門扇上有 16 幅描繪罪與救贖的浮雕。',
    station: [104, 1.7, -17], look: [117, 4.5, -25], hotspot: [116, 9, -25], fov: 55,
  },
  {
    id: 'pieta', title: '聖殤 Pietà', subtitle: '米開朗基羅 · 1498–1499 · 卡拉拉大理石 174 × 195 cm',
    text: '米開朗基羅二十四歲時完成，也是他唯一簽名的作品，名字刻在聖母胸前的飾帶上。聖母懷抱基督遺體，神情平靜而年輕。1972 年遭人以鎚子破壞後修復，此後置於防彈玻璃之後，位於右側第一禮拜堂。',
    station: [110, 1.7, -19.5], look: [110, 2.6, -31], hotspot: [113, 4.8, -29], fov: 50,
  },
  {
    id: 'nave', title: '中殿', subtitle: '卡洛·馬德諾 · 1607–1615 延伸 · 長 186 m · 拱頂高 46 m',
    text: '馬德諾把米開朗基羅的希臘十字平面向東延伸成拉丁十字，形成世界上最長的教堂中殿之一。鍍金的藻井拱頂高 46 m；地面以黃銅標記刻出其他各大教堂的長度，讓人比較它們與聖彼得大教堂的大小。',
    station: [84, 1.7, 0], look: [0, 30, 0], hotspot: [84, 3, 6], fov: 70,
  },
  {
    id: 'peter', title: '聖彼得青銅像', subtitle: '傳為 Arnolfo di Cambio · 13 世紀末 · 青銅',
    text: '聖彼得端坐於大理石寶座上，右手作祝福手勢，左手持天國的鑰匙。數百年來朝聖者觸摸、親吻他的右腳，使腳趾被磨得光亮平滑。每年 6 月 29 日聖伯多祿與聖保祿節，雕像會披上教宗的祭袍與三重冕。',
    station: [36, 1.7, -3], look: [29.5, 3.2, -12.1], hotspot: [30.5, 5.6, -11.5], fov: 50,
  },
  {
    id: 'baldacchino', title: '貝尼尼華蓋 Baldacchino', subtitle: '貝尼尼 · 1623–1634 · 青銅鍍金 · 高約 28.74 m',
    text: '覆蓋在教宗祭台上方的巨大青銅華蓋，由四根所羅門式螺旋柱撐起，柱上纏繞橄欖與月桂枝葉，並有委託人烏爾巴諾八世家族（Barberini）的蜜蜂紋章。祭台正下方是傳統認定的聖彼得墓；祭台前方下沉的告解堂（Confessio）由馬德諾設計，周圍有長年點燃的油燈。',
    station: [24, 1.7, 9], look: [0, 15, 0], hotspot: [6.5, 10, 6.5], fov: 62,
  },
  {
    id: 'dome', title: '米開朗基羅穹頂（內部）', subtitle: '米開朗基羅設計 · 德拉·波爾塔 1590 年完成 · 內徑 41.47 m',
    text: '從地面到燈籠亭頂約 117.6 m。鼓座 16 扇窗灑下天光，穹頂內面以馬賽克裝飾，由肋拱分為 16 瓣。環繞鼓座下緣的拉丁文銘文出自馬太福音：「你是彼得，我要把我的教會建在這磐石上……我要把天國的鑰匙給你」，每個字母高約 2 m。',
    station: [12, 1.7, -13], look: [0, 95, 0], hotspot: [0, 50, -19], fov: 78,
  },
  {
    id: 'piers', title: '四柱巨像：聖朗基努斯等', subtitle: '貝尼尼、Bolgi、Mochi、Duquesnoy · 1630 年代',
    text: '支撐穹頂的四根巨柱，各在壁龕中立著一尊約 5 m 高的聖人像，代表教堂保存的四件聖髑：手持聖矛的聖朗基努斯（貝尼尼作）、持十字架的聖海倫娜（Andrea Bolgi）、展開聖帕的聖維羅妮卡（Francesco Mochi），以及背負 X 形十字架的聖安德烈（François Duquesnoy）。上方的陽台即為存放聖髑之處。',
    station: [23, 1.7, 1], look: [17.9, 7.5, -17.9], hotspot: [16, 12.5, -16], fov: 58,
  },
  {
    id: 'cathedra', title: '聖彼得寶座 Cathedra Petri', subtitle: '貝尼尼 · 1657–1666 · 鍍金青銅、大理石、灰泥',
    text: '後殿盡頭的鍍金青銅寶座，內藏一張傳統上被視為聖彼得所用的木椅（實為 9 世紀之物）。寶座由四位教會聖師托起：拉丁教會的聖安博、聖奧斯定，與希臘教會的聖亞他那修、金口聖若望。上方的雪花石膏窗中是聖靈之鴿，四周環繞金色光芒與天使，是整座教堂最動人的光。',
    station: [-24, 1.7, 0], look: [-64, 15, 0], hotspot: [-58, 9, 6.5], fov: 55,
  },
  {
    id: 'alexander', title: '亞歷山大七世紀念碑', subtitle: '貝尼尼 · 1671–1678 · 大理石、碧玉、鍍金青銅',
    text: '貝尼尼晚年最後的重要作品。教宗跪在高處祈禱，四周是慈愛、真理、正義、審慎四位寓意人物；下方一具鍍金骷髏從紅色碧玉的帷幔中探出，手持沙漏，提醒人生命的短暫。紀念碑巧妙地包住了原本就在那裡的一扇門。',
    station: [4, 1.7, 46], look: [-13.7, 6.5, 50], hotspot: [-12.5, 9, 46.5], fov: 55,
  },
];

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
      b.add(mats.marbleDark, boxAt(2.3, 0, 3.4, 2.3, x, z)); // 大理石柱礎（蜜蜂紋章所在）
      b.add(mats.gold, boxAt(2.4, 3.4, 3.7, 2.4, x, z));
      b.add(bronze, solomonic(x, z, 3.7, 15.6, 0.62));
      b.add(mats.gilded, lathe([[0.75, 0], [1.05, 0.5], [1.25, 1.2], [0.9, 1.3]], 12, x, z).translate(0, 19.3, 0));
      b.add(bronze, boxAt(2.0, 20.6, 22.0, 2.0, x, z));
      // 角落天使（簡化）
      b.add(mats.gilded, figure((sx + sz + 4) % 4, x, 22.0, z, 2.4, -sx, -sz));
      // 渦卷肋向上匯聚
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x * 0.95, 22.2, z * 0.95), new THREE.Vector3(x * 0.75, 24.8, z * 0.75), new THREE.Vector3(x * 0.35, 26.0, z * 0.35), new THREE.Vector3(0, 26.2, 0)]);
      b.add(bronze, new THREE.TubeGeometry(curve, 24, 0.32, 8));
    }
    // 檐部（四邊）與垂飾帷幔
    for (const [w, d, x, z] of [[2 * C + 2, 1.2, 0, C], [2 * C + 2, 1.2, 0, -C], [1.2, 2 * C + 2, C, 0], [1.2, 2 * C + 2, -C, 0]] as [number, number, number, number][]) {
      b.add(bronze, boxAt(w, 20.3, 22.0, d, x, z));
      b.add(mats.gilded, boxAt(w * (d > 1.5 ? 1 : 1), 19.5, 20.3, d * 0.6, x, z));
    }
    // 頂端：球與十字（總高 28.74 m）
    b.add(mats.gilded, lathe([[1.2, 26.0], [0.9, 26.6], [0.5, 26.9]], 16));
    const orb = new THREE.SphereGeometry(0.75, 20, 14); orb.translate(0, 27.3, 0); b.add(mats.gilded, orb);
    b.add(mats.gilded, boxAt(0.18, 27.9, 28.74, 0.18));
    b.add(mats.gilded, boxAt(0.6, 28.3, 28.45, 0.16));
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
    for (let i = 0; i < 24; i++) lampPts.push(new THREE.Vector3(cf.x0 + (i / 23) * (cf.x1 - cf.x0), 1.35, -cf.hw));
    for (let i = 0; i < 24; i++) lampPts.push(new THREE.Vector3(cf.x0 + (i / 23) * (cf.x1 - cf.x0), 1.35, cf.hw));
    for (let i = 0; i < 16; i++) lampPts.push(new THREE.Vector3(cf.x1, 1.35, -cf.hw + (i / 15) * 2 * cf.hw));
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

  // 9. 亞歷山大七世紀念碑（南翼殿西牆）
  {
    const x = -IN.halfW + 0.2, z = 50; // 位於兩根壁柱之間的開間
    const jasper = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.48, 0.16, 0.1), roughness: 0.3 });
    b.add(mats.marbleDark, boxAt(1.6, 0, 1.0, 7.5, x + 0.8, z));
    const door = new THREE.ShapeGeometry(archShape(1.3, 4.2), 12); door.rotateY(Math.PI / 2); door.translate(x + 0.05, 0, z); b.add(mats.dark, door);
    // 紅色碧玉帷幔（自門上垂落）
    const drape = new THREE.CylinderGeometry(3.4, 3.8, 4.2, 24, 1, true, Math.PI, Math.PI);
    drape.scale(0.35, 1, 1);
    drape.translate(x + 0.2, 6.3, z);
    b.add(jasper, drape);
    b.add(mats.marble, boxAt(1.4, 8.4, 9.8, 3.4, x + 0.7, z));
    b.add(mats.marbleWhite, figure(2, x + 0.7, 9.8, z, 2.6, 1, 0)); // 跪姿教宗（簡化）
    for (const [dz, v] of [[-3.0, 0], [3.0, 1]] as [number, number][]) b.add(mats.marbleWhite, figure(v, x + 1.4, 1.0, z + dz, 3.0, 1, -dz * 0.1));
    b.add(mats.gilded, figure(3, x + 0.6, 4.4, z, 1.6, 1, 0)); // 持沙漏的骷髏（金色，簡化）
    b.add(mats.marbleDark, (() => { const g = new THREE.ShapeGeometry(archShape(4.6, 14.5), 16); g.rotateY(Math.PI / 2); g.translate(x - 0.05, 0, z); return g; })());
    b.add(mats.gold, (() => { const fr = new THREE.Shape(); fr.setFromPoints(archShape(5.0, 14.9).getPoints(16)); fr.holes.push(new THREE.Path(archShape(4.6, 14.5).getPoints(16))); const g = new THREE.ExtrudeGeometry(fr, { depth: 0.3, bevelEnabled: false, curveSegments: 16 }); g.rotateY(Math.PI / 2); g.translate(x - 0.05, 0, z); return g; })());
  }

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
