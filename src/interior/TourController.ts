import * as THREE from 'three';
import { EXHIBITS } from './Exhibits';
import { navPath, Polyline } from './nav';

/**
 * 線上博物館式導覽：
 * - 拖曳：在原地環視（yaw / pitch）
 * - 滾輪：調整視角（FOV）
 * - 點擊地面光圈或資訊點：滑行到該展品的導覽點並轉向展品
 * - 依序導覽：自動依序前往各展品，每件停留閱讀
 */
export class TourController {
  active = -1;
  enabled = false;
  autoTour = false;
  private yaw = 0;
  private pitch = 0;
  private fov = 60;
  private pos = new THREE.Vector3();
  private tween: { path: Polyline; p1: THREE.Vector3; q0: THREE.Quaternion; q1: THREE.Quaternion; f0: number; f1: number; t: number; dur: number } | null = null;
  private dragging = false;
  private moved = 0;
  private last = { x: 0, y: 0 };
  private dwell = 0;
  private ray = new THREE.Raycaster();
  onArrive: ((i: number) => void) | null = null;
  onSelect: ((i: number) => void) | null = null;
  onHover: ((i: number | null) => void) | null = null;
  pickables: THREE.Object3D[] = [];
  /** 目前路線（依官方平面圖參觀順序）；精選路線為其子集 */
  route: number[] = EXHIBITS.map((_, i) => i);
  get position() { return this.pos; }
  get heading() { return this.yaw; }

  constructor(private camera: THREE.PerspectiveCamera, private dom: HTMLElement) {
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      this.dragging = true; this.moved = 0; this.last = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      if (this.dragging) {
        const dx = e.clientX - this.last.x, dy = e.clientY - this.last.y;
        this.moved += Math.abs(dx) + Math.abs(dy);
        this.last = { x: e.clientX, y: e.clientY };
        if (this.tween) return;
        const k = 0.0032 * (this.fov / 60);
        this.yaw += dx * k;
        this.pitch = THREE.MathUtils.clamp(this.pitch + dy * k, -1.2, 1.45);
        this.stopAuto();
      } else {
        const i = this.pick(e.clientX, e.clientY);
        this.dom.style.cursor = i !== null ? 'pointer' : 'grab';
        this.onHover?.(i);
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (!this.enabled || !this.dragging) return;
      this.dragging = false;
      if (this.moved < 5) {
        const i = this.pick(e.clientX, e.clientY);
        if (i !== null) { this.stopAuto(); this.goTo(i); }
      }
    });
    dom.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.fov = THREE.MathUtils.clamp(this.fov + e.deltaY * 0.03, 28, 85);
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'ArrowRight') { this.stopAuto(); this.next(1); }
      if (e.code === 'ArrowLeft') { this.stopAuto(); this.next(-1); }
    });
  }

  private pick(x: number, y: number): number | null {
    const r = this.dom.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
    const hit = this.ray.intersectObjects(this.pickables, false)[0];
    return hit ? (hit.object.userData.exhibit as number) : null;
  }

  /** 進入內部時的起始位置（入口，望向中殿） */
  start(i = 0) {
    const e = EXHIBITS[i];
    this.pos.set(...e.station);
    this.lookAtPoint(new THREE.Vector3(0, 24, 0));
    this.fov = 66;
    this.active = -1;
    this.apply();
  }

  /** 進場時鏡頭沿入口向前緩推（配合轉場） */
  setPose(pos: THREE.Vector3, look: THREE.Vector3, fov: number) {
    this.pos.copy(pos);
    this.lookAtPoint(look);
    this.fov = fov;
    this.apply();
  }

  private lookAtPoint(p: THREE.Vector3) {
    const d = p.clone().sub(this.pos).normalize();
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
  }

  private quatFor(yaw: number, pitch: number) {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  }

  goTo(i: number) {
    const e = EXHIBITS[i];
    this.active = i;
    this.onSelect?.(i);
    const p1 = new THREE.Vector3(...e.station);
    const d = new THREE.Vector3(...e.look).sub(p1).normalize();
    const yaw1 = Math.atan2(-d.x, -d.z), pitch1 = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    const path = new Polyline(navPath(this.pos, p1));
    const dist = path.length;
    this.tween = {
      path, p1,
      q0: this.quatFor(this.yaw, this.pitch), q1: this.quatFor(yaw1, pitch1),
      f0: this.fov, f1: e.fov ?? 60,
      t: 0, dur: THREE.MathUtils.clamp(1.4 + dist / 26, 1.6, 7),
    };
    this.yaw = yaw1; this.pitch = pitch1;
  }

  next(dir: number) {
    const r = this.route, n = r.length;
    const k = r.indexOf(this.active);
    if (k < 0) {
      // 不在路線上：前往路線中離目前展品最近的下一站
      const after = r.find((i) => i > this.active);
      this.goTo(dir > 0 ? (after ?? r[0]) : r[n - 1]);
      return;
    }
    this.goTo(r[(k + dir + n) % n]);
  }

  startAuto(route?: number[]) {
    if (route) this.route = route;
    this.autoTour = true; this.dwell = 0;
    if (this.route.includes(this.active)) this.goTo(this.active); else this.next(1);
  }
  stopAuto() { this.autoTour = false; }

  update(dt: number) {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - Math.pow(-2 * tw.t + 2, 3) / 2;
      tw.path.at(e, this.pos);
      this.camera.quaternion.slerpQuaternions(tw.q0, tw.q1, THREE.MathUtils.smoothstep(tw.t, 0.05, 0.85));
      this.camera.position.copy(this.pos);
      this.fov = THREE.MathUtils.lerp(tw.f0, tw.f1, e);
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
      if (tw.t >= 1) { this.tween = null; this.dwell = 0; this.onArrive?.(this.active); }
      return;
    }
    if (this.autoTour) {
      this.dwell += dt;
      // 閱讀時間依解說長度
      const read = 6 + (EXHIBITS[this.active]?.text.length ?? 80) / 22;
      if (this.dwell > read) { this.dwell = 0; this.next(1); }
      // 停留時緩慢環視
      this.yaw += dt * 0.02;
    }
    this.apply();
  }

  private apply() {
    this.camera.position.copy(this.pos);
    this.camera.quaternion.copy(this.quatFor(this.yaw, this.pitch));
    if (this.camera.fov !== this.fov) { this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); }
  }
}
