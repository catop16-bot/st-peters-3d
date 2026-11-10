import * as THREE from 'three';
import type { Renderer } from '../core/Renderer';
import type { Environment } from '../env/Environment';
import type { MaterialLibrary } from '../core/materials';
import { G } from '../core/materials';
import type { CameraRig } from '../controls/CameraRig';
import type { BasilicaFrame } from '../world/basilica/Basilica';
import { DIM } from '../data/dimensions';
import { buildInterior, type InteriorBuild } from './Interior';
import { InteriorLighting } from './Lighting';
import { buildExhibits, type ExhibitBuild } from './Exhibits';
import { TourController } from './TourController';
import { InteriorUI } from './InteriorUI';
import { FloorReflections } from './Reflections';

interface Deps {
  M: MaterialLibrary;
  R: Renderer;
  env: Environment;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  exterior: THREE.Scene;
  frame: BasilicaFrame;
  rig: CameraRig;
  onModeChange: (m: 'exterior' | 'interior') => void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * 教堂內部模式：光之門轉場、內部場景、博物館式導覽。
 * 內部場景以大教堂本地座標建立（原點為穹頂中心、+X 朝入口、地坪 y = 0）。
 */
export class InteriorMode {
  mode: 'exterior' | 'interior' = 'exterior';
  build: InteriorBuild;
  lighting: InteriorLighting;
  exhibits: ExhibitBuild;
  tour: TourController;
  ui: InteriorUI;
  refl: FloorReflections;
  private tl: { kind: 'enter' | 'exit'; t: number; swapped: boolean; path?: THREE.CatmullRomCurve3; look0?: THREE.Vector3; look1?: THREE.Vector3 } | null = null;
  private saved = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: 50, near: 0.5, far: 40000 };
  private exitPose = { pos: new THREE.Vector3(), look: new THREE.Vector3() };

  get transitioning() { return this.tl !== null; }

  constructor(private d: Deps) {
    this.build = buildInterior(d.M);
    this.exhibits = buildExhibits(this.build);
    this.lighting = new InteriorLighting(this.build, d.R.renderer, d.frame.angle);
    this.lighting.gloryMat = this.exhibits.gloryMat;
    this.tour = new TourController(d.camera, d.canvas);
    this.tour.pickables = this.exhibits.pickables;
    this.ui = new InteriorUI(this.tour);
    this.refl = new FloorReflections(this.build.scene, this.build.mats.floor);
    this.ui.onExit = () => this.exit();
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.mode === 'interior' && !this.tl) this.exit(); });
  }

  /** 大教堂本地座標 → 外部世界座標 */
  private world(x: number, y: number, z: number) {
    const [wx, wz] = this.d.frame.toWorld([x, z]);
    return new THREE.Vector3(wx, y + DIM.basilica.floorY, wz);
  }

  /** 預先編譯內部著色器，避免第一次進入時卡頓 */
  precompile() {
    try { this.d.R.renderer.compile(this.build.scene, this.d.camera); } catch { /* 忽略 */ }
  }

  enter() {
    if (this.tl || this.mode !== 'exterior') return;
    const { camera, rig } = this.d;
    this.saved.pos.copy(camera.position);
    this.saved.target.copy(rig.controls.target);
    this.saved.fov = camera.fov;
    this.saved.near = camera.near;
    this.saved.far = camera.far;
    if (rig.mode !== 'orbit') rig.setMode('orbit');
    rig.controls.enabled = false;
    const FX = DIM.basilica.facadeWallX;
    const front = this.world(FX + 34, 9, 0);
    const door = this.world(FX + 3, 6.2, 0);
    const inside = this.world(FX - 8, 5.5, 0);
    const start = camera.position.clone();
    const mid = start.clone().lerp(front, 0.55);
    mid.y = Math.max(mid.y, front.y + Math.min(60, start.distanceTo(front) * 0.12));
    this.tl = {
      kind: 'enter', t: 0, swapped: false,
      path: new THREE.CatmullRomCurve3([start, mid, front, door, inside], false, 'centripetal'),
      look0: this.saved.target.clone(), look1: this.world(FX - 30, 6, 0),
    };
  }

  exit() {
    if (this.tl || this.mode !== 'interior') return;
    this.tour.enabled = false;
    this.tour.stopAuto();
    this.exitPose.pos.copy(this.d.camera.position);
    this.exitPose.look.copy(this.d.camera.position).add(this.d.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(10));
    this.tl = { kind: 'exit', t: 0, swapped: false };
  }

  private swapTo(m: 'exterior' | 'interior') {
    const { R, camera } = this.d;
    this.mode = m;
    if (m === 'interior') {
      R.setScene(this.build.scene);
      camera.near = 0.3; camera.far = 600;
      this.tour.enabled = true;
      this.ui.setVisible(true);
    } else {
      R.setScene(this.d.exterior);
      camera.near = this.saved.near; camera.far = this.saved.far;
      this.ui.setVisible(false);
    }
    camera.updateProjectionMatrix();
    this.d.onModeChange(m);
  }

  /** 回傳 true 表示本幀相機已由內部模式控制 */
  update(dt: number): boolean {
    const { R, camera } = this.d;
    R.portal.time = G.uTime.value;
    if (this.mode === 'interior') {
      this.lighting.update(this.d.env);
      this.refl.enabled = R.quality !== 'low';
      this.refl.update(R.renderer, camera.position.x, this.d.env.night);
      this.exhibits.update(G.uTime.value, this.tour.active);
      this.ui.update();
    }
    const tl = this.tl;
    if (!tl) {
      if (this.mode === 'interior') { this.tour.update(dt); return true; }
      return false;
    }
    tl.t += dt;
    if (tl.kind === 'enter') {
      const A = 1.6, B = 2.05, C = 3.7;
      if (tl.t < B) {
        const u = tl.t < A ? ease(tl.t / A) * 0.9 : 0.9 + 0.1 * ((tl.t - A) / (B - A));
        tl.path!.getPoint(Math.min(u, 1), camera.position);
        const look = tl.look0!.clone().lerp(tl.look1!, THREE.MathUtils.smoothstep(tl.t, 0.2, A));
        camera.lookAt(look);
        R.portal.progress = tl.t < A ? THREE.MathUtils.smoothstep(tl.t, 0.4, A) * 0.6 : 0.6 + 0.4 * THREE.MathUtils.smoothstep(tl.t, A, B);
        this.centerOn(this.world(DIM.basilica.facadeWallX, 6.2, 0));
        return true;
      }
      if (!tl.swapped) { tl.swapped = true; this.swapTo('interior'); R.portal.setCenter(0.5, 0.52); }
      const k = THREE.MathUtils.clamp((tl.t - B) / (C - B), 0, 1);
      R.portal.progress = 1 - ease(k);
      this.tour.setPose(new THREE.Vector3(THREE.MathUtils.lerp(126, 107, ease(k)), THREE.MathUtils.lerp(3.2, 1.7, ease(k)), 0), new THREE.Vector3(0, 24, 0), THREE.MathUtils.lerp(80, 66, ease(k)));
      if (k >= 1) { R.portal.progress = 0; this.tl = null; }
      return true;
    }
    // 離開
    const A = 0.95, C = 3.3;
    if (tl.t < A) {
      const k = ease(tl.t / A);
      const doorIn = new THREE.Vector3(126, 4, 0);
      camera.position.lerpVectors(this.exitPose.pos, doorIn, k);
      camera.lookAt(this.exitPose.look.clone().lerp(new THREE.Vector3(140, 4, 0), k));
      R.portal.progress = THREE.MathUtils.smoothstep(tl.t, 0.05, A);
      R.portal.setCenter(0.5, 0.5);
      return true;
    }
    if (!tl.swapped) {
      tl.swapped = true;
      this.swapTo('exterior');
      const FX = DIM.basilica.facadeWallX;
      const start = this.world(FX + 6, 6, 0);
      const mid = this.world(FX + 60, 14, 0);
      tl.path = new THREE.CatmullRomCurve3([start, mid, this.saved.pos.clone()], false, 'centripetal');
      tl.look0 = this.world(FX + 200, 10, 0);
      tl.look1 = this.saved.target.clone();
      camera.fov = this.saved.fov; camera.updateProjectionMatrix();
    }
    const k = THREE.MathUtils.clamp((tl.t - A) / (C - A), 0, 1);
    tl.path!.getPoint(ease(k), camera.position);
    camera.lookAt(tl.look0!.clone().lerp(tl.look1!, THREE.MathUtils.smoothstep(k, 0.1, 0.9)));
    R.portal.progress = 1 - THREE.MathUtils.smoothstep(k, 0, 0.6);
    if (k >= 1) {
      R.portal.progress = 0;
      this.tl = null;
      this.d.rig.controls.target.copy(this.saved.target);
      this.d.rig.controls.enabled = true;
      this.d.rig.controls.update();
    }
    return true;
  }

  /** 讓轉場光芒中心落在大門在畫面上的位置 */
  private centerOn(p: THREE.Vector3) {
    const v = p.clone().project(this.d.camera);
    if (v.z < 1) this.d.R.portal.setCenter(THREE.MathUtils.clamp(v.x * 0.5 + 0.5, 0.15, 0.85), THREE.MathUtils.clamp(v.y * 0.5 + 0.5, 0.15, 0.85));
  }
}
