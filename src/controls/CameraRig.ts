import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Viewpoint { id: string; name: string; pos: [number, number, number]; target: [number, number, number]; }

export const VIEWPOINTS: Viewpoint[] = [
  { id: 'aerial', name: '空拍全景', pos: [260, 230, 330], target: [-140, 30, 0] },
  { id: 'conciliazione', name: '協和大道遠眺', pos: [430, 4.5, 3], target: [-200, 55, 4] },
  { id: 'obelisk', name: '方尖碑前', pos: [45, 1.7, -6], target: [-189, 28, 4] },
  { id: 'centro', name: '柱廊中心（四列柱重疊）', pos: [0.9, 1.7, 27], target: [0.9, 6, 100] },
  { id: 'steps', name: '大教堂台階', pos: [-118, 2.9, -22], target: [-189, 30, 6] },
  { id: 'loggia', name: '祝福陽台望向廣場', pos: [-178, 24, 4.4], target: [60, 0, 0] },
  { id: 'cupola', name: '穹頂觀景台', pos: [-309, 116, 7], target: [0, 0, 0] },
  { id: 'colonnade', name: '柱廊走道', pos: [-55, 2.0, -78], target: [40, 3, -88] },
];

export type CamMode = 'orbit' | 'fly';

export class CameraRig {
  controls: OrbitControls;
  mode: CamMode = 'orbit';
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private tween: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; t: number; dur: number } | null = null;
  groundAt: (x: number, z: number) => number = () => 0;
  onModeChange: ((m: CamMode) => void) | null = null;

  constructor(public camera: THREE.PerspectiveCamera, private dom: HTMLElement) {
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 2600;
    this.controls.maxPolarAngle = Math.PI * 0.53;
    this.controls.zoomSpeed = 1.2;
    this.controls.screenSpacePanning = false;
    this.controls.zoomToCursor = true;
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.code === 'KeyF') this.setMode(this.mode === 'orbit' ? 'fly' : 'orbit');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    dom.addEventListener('click', () => { if (this.mode === 'fly' && document.pointerLockElement !== dom) dom.requestPointerLock(); });
    document.addEventListener('mousemove', (e) => {
      if (this.mode !== 'fly' || document.pointerLockElement !== dom) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0022, -1.5, 1.5);
    });
  }

  setMode(m: CamMode) {
    if (m === this.mode) return;
    this.mode = m;
    this.tween = null;
    if (m === 'fly') {
      this.controls.enabled = false;
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.yaw = Math.atan2(-dir.x, -dir.z);
      this.pitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
    } else {
      document.exitPointerLock?.();
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      const dist = Math.max(30, this.camera.position.y * 1.5);
      this.controls.target.copy(this.camera.position).addScaledVector(dir, dist);
      this.controls.enabled = true;
    }
    this.onModeChange?.(m);
  }

  goTo(v: Viewpoint, dur = 2.4) {
    if (this.mode !== 'orbit') this.setMode('orbit');
    this.tween = {
      from: this.camera.position.clone(), to: new THREE.Vector3(...v.pos),
      tFrom: this.controls.target.clone(), tTo: new THREE.Vector3(...v.target), t: 0, dur,
    };
  }

  update(dt: number) {
    if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const e = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - Math.pow(-2 * tw.t + 2, 3) / 2;
      // 以弧線過渡，避免穿過建築
      const p = tw.from.clone().lerp(tw.to, e);
      const lift = Math.sin(e * Math.PI) * Math.min(160, tw.from.distanceTo(tw.to) * 0.25);
      p.y += lift;
      this.camera.position.copy(p);
      this.controls.target.copy(tw.tFrom.clone().lerp(tw.tTo, e));
      if (tw.t >= 1) this.tween = null;
    }
    if (this.mode === 'orbit') {
      // 鍵盤平移
      const move = new THREE.Vector3();
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.z -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.z += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.x += 1;
      if (move.lengthSq() > 0 && !this.tween) {
        const fwd = new THREE.Vector3();
        this.camera.getWorldDirection(fwd);
        fwd.y = 0; fwd.normalize();
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
        const dist = this.camera.position.distanceTo(this.controls.target);
        const speed = Math.max(4, dist * 0.6) * dt * (this.keys.has('ShiftLeft') ? 3 : 1);
        const d = fwd.multiplyScalar(-move.z).add(right.multiplyScalar(move.x)).multiplyScalar(speed);
        this.camera.position.add(d);
        this.controls.target.add(d);
      }
      this.controls.update();
    } else {
      const speed = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 60 : 14) * dt;
      const fwd = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      if (this.keys.has('KeyW')) this.camera.position.addScaledVector(fwd, speed);
      if (this.keys.has('KeyS')) this.camera.position.addScaledVector(fwd, -speed);
      if (this.keys.has('KeyA')) this.camera.position.addScaledVector(right, -speed);
      if (this.keys.has('KeyD')) this.camera.position.addScaledVector(right, speed);
      if (this.keys.has('KeyE') || this.keys.has('Space')) this.camera.position.y += speed;
      if (this.keys.has('KeyQ') || this.keys.has('ControlLeft')) this.camera.position.y -= speed;
      this.camera.lookAt(this.camera.position.clone().add(fwd));
    }
    // 不讓相機落到地面以下
    const gy = this.groundAt(this.camera.position.x, this.camera.position.z) + 1.2;
    if (this.camera.position.y < gy) {
      const dy = gy - this.camera.position.y;
      this.camera.position.y = gy;
      if (this.mode === 'orbit') this.controls.target.y += dy * 0.0;
    }
  }
}
