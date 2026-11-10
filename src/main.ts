import * as THREE from 'three';
import { Renderer, type Quality } from './core/Renderer';
import { MaterialLibrary, setMaxAnisotropy, setTextureTier } from './core/materials';
import { toLocal, pointInPolygon, cleanRing, type Vec2 } from './core/geo';
import { offsetRing } from './core/geometry';
import { Environment } from './env/Environment';
import { CameraRig, VIEWPOINTS } from './controls/CameraRig';
import { Panel } from './ui/Panel';
import { buildBasilica } from './world/basilica/Basilica';
import { buildColonnade } from './world/piazza/Colonnade';
import { buildPiazza, piazzaOutline } from './world/piazza/Piazza';
import { buildCity, buildFarCity, type OsmBuilding, type Poi } from './world/surroundings/OsmBuildings';
import { buildStreets, buildTrees, buildLamps, type OsmRoad, type OsmGreen, type OsmWater } from './world/surroundings/Streets';
import { SceneManager } from './core/SceneManager';
import { DIM, LANDMARK_INFO } from './data/dimensions';
import type { FrameHooks } from './cinematic/Promo';
import type { InteriorMode } from './interior/InteriorMode';
import { t, applyLang } from './i18n';

const loadBar = document.getElementById('load-bar')!;
const loadText = document.getElementById('load-text')!;
const progress = (p: number, msg: string) => { loadBar.style.width = `${Math.round(p * 100)}%`; loadText.textContent = msg; };
// 讓載入畫面有機會更新；分頁在背景時 rAF 會暫停，因此以計時器作為後備
const nextFrame = () => new Promise((r) => { requestAnimationFrame(() => r(null)); setTimeout(() => r(null), 30); });

async function main() {
  const canvas = document.getElementById('scene') as HTMLCanvasElement;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 40000);
  camera.position.set(...VIEWPOINTS[0].pos);

  const R = new Renderer(canvas, scene, camera);
  setMaxAnisotropy(Math.min(R.renderer.capabilities.getMaxAnisotropy(), R.quality === 'low' ? 4 : 16));
  setTextureTier(R.quality === 'low');
  const scenes = new SceneManager(scene);

  let texLoaded = 0;
  applyLang();
  progress(0.05, t('載入材質…', 'Loading materials…'));
  const M = new MaterialLibrary(() => { texLoaded++; if (texLoaded <= 5) loadText.textContent = `${t('載入材質…', 'Loading materials…')} ${texLoaded}/5`; });
  const env = new Environment(scene, R.renderer);

  progress(0.3, t('載入 OpenStreetMap 資料…', 'Loading OpenStreetMap data…'));
  const base = import.meta.env.BASE_URL + 'data/osm/';
  const [bj, rj, pj, lj, wj, fj] = await Promise.all(['buildings', 'roads', 'pois', 'landmarks', 'water', 'far'].map((n) => fetch(`${base}${n}.json`).then((r) => r.json())));
  const buildings: OsmBuilding[] = bj.buildings;
  const landmarks: { type: string; id: number; tags?: Record<string, string>; lat?: number; lon?: number; geometry?: [number, number][] }[] = lj.elements;

  // ── 大教堂 ──
  progress(0.4, t('建構大教堂…', 'Building the basilica…'));
  await nextFrame();
  const basilicaOsm = buildings.find((b) => b.id === 'w244159210')!;
  const basilicaFoot = cleanRing(basilicaOsm.rings[0].pts.map(([la, lo]) => toLocal(la, lo)));
  const facadeStatues = landmarks
    .filter((e) => e.type === 'node' && e.tags?.historic === 'memorial' && (e.tags.height === '52' || e.tags.height === '53'))
    .map((e) => { const [x, z] = toLocal(e.lat!, e.lon!); return { x, z, name: e.tags!.name ?? '' }; });
  const basilica = buildBasilica(M, basilicaFoot, facadeStatues);
  scene.add(basilica.group);

  // ── 柱廊與廣場 ──
  progress(0.52, t('建構貝尼尼柱廊…', "Building Bernini's colonnade…"));
  await nextFrame();
  const colStatues = landmarks
    .filter((e) => e.type === 'node' && e.tags?.height === '22' && (e.tags.historic === 'memorial' || e.tags.tourism === 'artwork'))
    .map((e) => { const [x, z] = toLocal(e.lat!, e.lon!); return { x, z, name: e.tags!.name ?? '（未具名聖人像）' }; });
  scene.add(buildColonnade(M, colStatues));
  const rettaEl = landmarks.find((e) => e.id === 135747106);
  const retta = rettaEl?.geometry ? cleanRing(rettaEl.geometry.map(([la, lo]) => toLocal(la, lo))) : null;
  const piazza = buildPiazza(M, retta);
  scene.add(piazza.group);

  // ── 周邊街區 ──
  progress(0.64, t('建構周邊街區（OSM 建築與店家）…', 'Building the surrounding streets (OSM buildings and shops)…'));
  await nextFrame();
  const colonnadePolys: Vec2[][] = buildings.filter((b) => b.tags.name === 'Colonnato del Bernini').flatMap((b) => b.rings.map((r) => cleanRing(r.pts.map(([la, lo]) => toLocal(la, lo)))));
  const corridorRings: Vec2[][] = buildings.filter((b) => /Braccio di (Costantino|Carlo Magno)/.test(b.tags.name ?? '')).map((b) => cleanRing(b.rings[0].pts.map(([la, lo]) => toLocal(la, lo))));
  const fr = basilica.frame;
  const facadeBlock: Vec2[] = ([[110, -59], [143, -59], [143, 59], [110, 59]] as Vec2[]).map((q) => fr.toWorld(q));
  const city = buildCity(M, buildings, pj.pois as Poi[], {
    polys: [basilicaFoot, piazzaOutline(DIM.colonnade.outerR + 3, 92), ...(retta ? [retta] : [])],
    ids: new Set(['w244159210', 'w149958437', 'r12043628']),
    names: new Set(['Colonnato del Bernini', 'Basilica di San Pietro']),
    // 教堂周邊淨空：OSM 輪廓與手工立面塊（立面比 OSM 輪廓略寬）各外擴 6 m
    // 兩側直走廊屬於教堂整體（不裁切），但鄰近建築需與其保持 3 m
    clearance: [offsetRing(basilicaFoot, 6), offsetRing(facadeBlock, 6), ...corridorRings.map((r) => offsetRing(r, 3))],
  });
  scene.add(city.group);
  progress(0.72, t('外圍羅馬市區…', 'Outer Rome…'));
  await nextFrame();
  scene.add(buildFarCity(M, fj.b));

  progress(0.78, t('道路、綠地與台伯河…', 'Roads, parks and the Tiber…'));
  await nextFrame();
  const skip: Vec2[][] = [piazzaOutline(), ...(retta ? [retta] : []), basilicaFoot, ...colonnadePolys];
  scene.add(buildStreets(M, rj.roads as OsmRoad[], rj.greens as OsmGreen[], wj.water as OsmWater[], skip));
  const trees = buildTrees(M, pj.trees, skip);
  scene.add(trees.group);
  env.deciduous = trees.deciduous;
  env.applySeason(false);
  const lamps = buildLamps(M, pj.lamps, []);
  scene.add(lamps.group);
  env.lampGlow = lamps.glowMat;
  env.lampHeads = M.lampGlow;

  // 命名建築（供點擊查詢）
  const named = buildings.filter((b) => b.tags.name && !b.tags['building:part']).map((b) => ({ name: b.tags.name, ring: cleanRing(b.rings[0].pts.map(([la, lo]) => toLocal(la, lo))) }));

  // ── 控制 ──
  const rig = new CameraRig(camera, canvas);
  rig.controls.target.set(...VIEWPOINTS[0].target);
  rig.groundAt = (x, z) => {
    if (x < -147 && x > -192 && z > -37 && z < 44) return DIM.basilica.floorY;
    if (x < -67 && x > -147) return THREE.MathUtils.clamp((-67 - x) / 65, 0, 1) * 1.2;
    return 0;
  };
  const setQuality = (q: Quality) => { R.setQuality(q); R.setShadowMapSize(env.sun); };
  R.setShadowMapSize(env.sun);
  const panel = new Panel(env, rig, setQuality, R.quality);

  // ── 點擊查詢 ──
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downAt = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (inExterior() === false) return;
    if (rig.mode !== 'orbit' || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return;
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([basilica.group, scene.getObjectByName('colonnade')!, piazza.group, city.group], true);
    const h = hits.find((x) => x.object.visible);
    if (!h) return;
    const ud = h.object.userData;
    if (ud.kind === 'statues' && h.instanceId !== undefined) {
      const name = ud.names[h.instanceId] || t('聖人像', 'Statue of a saint');
      const where = ud.tag === 'facade' ? t('馬德諾立面頂端雕像（高約 5.7 m）', "Statue on top of Maderno's facade (about 5.7 m tall)")
        : ud.tag === 'colonnade' ? t('貝尼尼柱廊頂上的聖人像（高約 3.1 m，共 140 尊）', "Statue of a saint on Bernini's colonnade (about 3.1 m; 140 in all)")
        : t('大教堂台階前雕像', 'Statue in front of the basilica steps');
      panel.showInfo(name, `${where}${t('。位置與名稱取自 OpenStreetMap。', '. Position and name from OpenStreetMap.')}`);
      return;
    }
    if (ud.kind === 'signs' && h.instanceId !== undefined) {
      const kind = String(ud.kinds[h.instanceId]).replace(/^(shop|amenity|tourism):/, '');
      panel.showInfo(ud.names[h.instanceId], t(`店家類型：${KIND_ZH[kind] ?? kind}（資料：OpenStreetMap）`, `Type: ${kind.replace(/_/g, ' ')} (data: OpenStreetMap)`));
      return;
    }
    if (h.object.parent === city.group || h.object.parent?.parent === city.group) {
      const p = h.point;
      const b = named.find((n) => pointInPolygon(p.x, p.z, n.ring));
      if (b) panel.showInfo(b.name, t('建築輪廓與高度取自 OpenStreetMap。', 'Building outline and height from OpenStreetMap.'));
      return;
    }
    let lm = ud.landmark as string | undefined;
    if (lm === 'basilica') lm = h.point.y > 50 + DIM.basilica.floorY ? 'dome' : h.point.x > -205 ? 'facade' : 'basilica';
    if (lm === 'piazza') lm = Math.hypot(h.point.x, h.point.z) < 8 ? 'obelisk' : undefined;
    const info = lm ? LANDMARK_INFO[lm] : undefined;
    if (info) panel.showInfo(t(info.title, info.titleEn), t(info.text, info.textEn));
  });

  window.addEventListener('resize', () => R.resize());
  scenes.register('exterior', scene);

  // ── 教堂內部（雙擊大教堂進入，光之門轉場）──
  // 內部場景在第一次需要時才載入與建構（動態 import），縮短首次載入時間
  const extUI = ['brand', 'panel', 'hint', 'info'].map((id) => document.getElementById(id)!);
  let interior: InteriorMode | null = null;
  let interiorLoading: Promise<InteriorMode> | null = null;
  const loadInterior = () => interiorLoading ??= import('./interior/InteriorMode').then(({ InteriorMode }) => {
    interior = new InteriorMode({
      M, R, env, camera, canvas, exterior: scene, frame: basilica.frame, rig,
      onModeChange: (m) => {
        // 內部隱藏外部介面；回到外部時恢復（資訊卡維持關閉）
        for (const el of extUI) el.classList.toggle('hidden', m === 'interior' || el.id === 'info');
        scenes.current = m;
        rig.controls.enabled = m === 'exterior';
      },
    });
    scenes.register('interior', interior.build.scene);
    return interior;
  });
  /** 是否在外部且不在轉場中 */
  const inExterior = () => !interior || (interior.mode === 'exterior' && !interior.transitioning);
  const enterInterior = async () => {
    if (!inExterior() || hooks.camera) return;
    const btn = document.getElementById('enter-church')!;
    const label = btn.querySelector('.enter-label') as HTMLElement;
    const keep = label.innerHTML;
    if (!interior) label.textContent = t('載入教堂內部…', 'Loading the interior…');
    const it = await loadInterior();
    label.innerHTML = keep;
    it.enter();
  };
  /** 螢幕座標是否落在大教堂本體上（以畫布自身尺寸換算，避免視窗尺寸為 0 時誤判） */
  const hitsBasilicaNDC = (nx: number, ny: number) => {
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return false;
    ndc.set(nx, ny);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(basilica.group, true).length > 0;
  };
  const hitsBasilica = (x: number, y: number) => {
    const r = canvas.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    return hitsBasilicaNDC(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  };
  const tryEnter = (x: number, y: number) => {
    if (!inExterior() || hooks.camera) return;
    if (hitsBasilica(x, y)) { document.getElementById('enter-tip')!.classList.remove('on'); enterInterior(); }
  };
  canvas.addEventListener('dblclick', (e) => tryEnter(e.clientX, e.clientY));
  // 觸控裝置：雙點（300 ms 內、位置相近）視為雙擊
  let lastTap = { t: 0, x: 0, y: 0 };
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    const now = performance.now();
    if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { tryEnter(e.clientX, e.clientY); lastTap.t = 0; }
    else lastTap = { t: now, x: e.clientX, y: e.clientY };
  });
  // 游標停在大教堂上時提示可雙擊進入
  const enterTip = document.getElementById('enter-tip')!;
  let tipT = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (!inExterior() || e.buttons || e.pointerType === 'touch') { enterTip.classList.remove('on'); return; }
    const now = performance.now();
    if (now - tipT < 90) return;
    tipT = now;
    const on = hitsBasilica(e.clientX, e.clientY);
    enterTip.classList.toggle('on', on);
    enterTip.style.left = `${e.clientX}px`; enterTip.style.top = `${e.clientY}px`;
  });
  canvas.addEventListener('pointerleave', () => enterTip.classList.remove('on'));
  document.getElementById('enter-church')!.addEventListener('click', () => enterInterior());

  // ── 主迴圈 ──
  progress(1, t('完成', 'Done'));
  document.getElementById('loading')!.classList.add('done');
  const clock = new THREE.Clock();
  let fpsAcc = 0, fpsN = 0, lowFrames = 0, highFrames = 0, downgrades = 0;
  let panelQualityTouched = false;
  document.getElementById('quality')?.addEventListener('click', () => { panelQualityTouched = true; });
  const fpsEl = document.getElementById('fps')!;
  const focus = new THREE.Vector3();
  const hooks: FrameHooks = { camera: null, exposureMul: 1, paused: false };
  const frame = (dt: number) => {
    const interiorControls = interior ? interior.update(dt) : false;
    if (interiorControls) { /* 內部模式或轉場中：相機由 InteriorMode 控制 */ }
    else if (hooks.camera) hooks.camera(dt);
    else rig.update(dt);
    // 陰影範圍隨相機距離調整
    const dist = camera.position.distanceTo(rig.controls.target);
    // 陰影範圍依距離分級（避免縮放時每幀重繪陰影）
    const shadowSize = THREE.MathUtils.clamp(Math.pow(1.25, Math.round(Math.log(dist * 1.6) / Math.log(1.25))), 160, 1100);
    if (rig.mode === 'orbit') focus.copy(rig.controls.target);
    else focus.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(shadowSize * 0.35));
    if (interior?.mode === 'interior') focus.copy(rig.controls.target);
    env.update(dt, camera, focus, shadowSize);
    if (!interior || interior.mode === 'exterior') {
      piazza.update(dt);
      basilica.clock.draw(Math.floor(env.hours), (env.hours % 1) * 60);
    }
    R.render(dt, env.night, hooks.exposureMul, env.exposure);
  };
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (hooks.paused) { requestAnimationFrame(loop); return; }
    frame(dt);
    panel.tick();
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 1) {
      const fps = fpsN / fpsAcc;
      fpsEl.textContent = `${fps.toFixed(0)} fps`;
      // 持續低幀率時自動降低畫質
      lowFrames = fps < 24 && clock.elapsedTime > 12 ? lowFrames + 1 : 0;
      // 持續高幀率時升回一級（使用者手動選過畫質就不自動調整）
      highFrames = fps > 55 && !panelQualityTouched ? highFrames + 1 : 0;
      const syncChips = () => document.querySelectorAll<HTMLButtonElement>('#quality .chip').forEach((b) => b.classList.toggle('on', b.dataset.q === R.quality));
      if (lowFrames >= 6 && R.quality !== 'low') {
        setQuality(R.quality === 'high' ? 'medium' : 'low');
        syncChips();
        lowFrames = 0; highFrames = 0; downgrades++;
      } else if (highFrames >= 20 && R.quality !== 'high' && downgrades === 0) {
        setQuality(R.quality === 'low' ? 'medium' : 'high');
        syncChips();
        highFrames = 0;
      }
      fpsAcc = 0; fpsN = 0;
    }
    requestAnimationFrame(loop);
  };
  loop();

  // 宣傳片：?promo 即時預覽，?promo=record 離線錄製
  const promo = new URLSearchParams(location.search).get('promo');
  if (promo !== null) {
    const deps = { env, R, camera, controlsTarget: rig.controls.target, frame, hooks };
    import('./cinematic/Promo').then(({ recordPromo, startPromoPreview }) => {
      if (promo === 'record') recordPromo(deps);
      else startPromoPreview(deps);
    });
  }
  // 除錯用：在背景分頁中可手動推進畫面
  (window as unknown as { __app: unknown }).__app = { scene, camera, env, rig, R, M, frame, get interior() { return interior; }, loadInterior, enterInterior, hitsBasilicaNDC };
  // 分享連結：#interior 直接進入教堂；#展品代號（如 #pieta）進入後前往該展品
  const deep = decodeURIComponent(location.hash.slice(1));
  if (deep) {
    (async () => {
      const [{ EXHIBITS }] = await Promise.all([import('./interior/exhibitsData')]);
      const idx = EXHIBITS.findIndex((e) => e.id === deep);
      if (deep !== 'interior' && idx < 0) return;
      await new Promise((r) => setTimeout(r, 600));
      await enterInterior();
      const it = interior!;
      const wait = () => new Promise<void>((r) => { const k = () => (it.mode === 'interior' && !it.transitioning ? r() : setTimeout(k, 100)); k(); });
      await wait();
      if (idx >= 0) it.tour.goTo(idx);
    })();
  }
  // 載入完成後閒置時預先載入內部（不阻塞首屏）
  const idle = (cb: () => void) => ('requestIdleCallback' in window ? (window as unknown as { requestIdleCallback: (f: () => void, o: object) => void }).requestIdleCallback(cb, { timeout: 8000 }) : setTimeout(cb, 4000));
  setTimeout(() => idle(() => { loadInterior().then((it) => idle(() => it.precompile())); }), 2500);
}

const KIND_ZH: Record<string, string> = {
  restaurant: '餐廳', cafe: '咖啡館', bar: '酒吧', pub: '酒館', fast_food: '速食', ice_cream: '冰淇淋店', hotel: '飯店', guest_house: '民宿',
  museum: '博物館', pharmacy: '藥局', bank: '銀行', post_office: '郵局', religion: '宗教用品店', gift: '紀念品店', books: '書店', tobacco: '菸草店',
  clothes: '服飾店', convenience: '便利商店', supermarket: '超市', shoes: '鞋店', pastry: '糕點店', optician: '眼鏡行', jewelry: '珠寶店', bakery: '麵包店',
};

main().catch((e) => {
  console.error(e);
  loadText.textContent = t('載入失敗：', 'Failed to load: ') + (e?.message ?? e);
});
