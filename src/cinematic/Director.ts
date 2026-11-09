import * as THREE from 'three';
import type { Environment } from '../env/Environment';
import { SHOTS, FADE_IN, FADE_OUT, type Shot } from './shots';

/** 依時間 t 驅動相機與環境（宣傳片用） */
export class Director {
  private curves: { pos: THREE.CatmullRomCurve3; target: THREE.CatmullRomCurve3 }[];
  private current = -1;
  readonly target = new THREE.Vector3();

  /** 鏡頭切換時呼叫（例如讓自動曝光立即重新測光） */
  onCut: (() => void) | null = null;
  /** 最近一次 apply 是否發生了硬切 */
  cutHappened = false;

  constructor(private env: Environment, private camera: THREE.PerspectiveCamera) {
    const v = (p: [number, number, number][]) => p.map((q) => new THREE.Vector3(...q));
    this.curves = SHOTS.map((s) => ({
      pos: new THREE.CatmullRomCurve3(v(s.pos), false, 'centripetal'),
      target: new THREE.CatmullRomCurve3(v(s.target), false, 'centripetal'),
    }));
  }

  shotAt(t: number): number {
    for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].start) return i;
    return 0;
  }

  /** 進入鏡頭：硬切，立即套用日期、天氣與地表狀態 */
  private enter(i: number) {
    const s = SHOTS[i];
    const e = this.env;
    e.timeFlow = 0;
    e.setDate(s.date[0], s.date[1], s.date[2]);
    e.setWeather(s.weather);
    e.snapWeather();
    e.setSurface(s.surface[0], s.surface[1]);
    this.current = i;
    this.cutHappened = true;
    this.onCut?.();
  }

  /** 套用時間 t，回傳淡入淡出的曝光倍率（0..1） */
  apply(t: number): number {
    const i = this.shotAt(t);
    this.cutHappened = false;
    if (i !== this.current) this.enter(i);
    const s: Shot = SHOTS[i];
    const lt = THREE.MathUtils.clamp((t - s.start) / (s.end - s.start), 0, 1);
    const ease = s.ease ?? 0.4;
    // 等速與緩入緩出的混合：硬切後鏡頭仍在移動，避免「停頓感」
    const u = THREE.MathUtils.lerp(lt, lt - Math.sin(2 * Math.PI * lt) / (2 * Math.PI), ease);
    const c = this.curves[i];
    c.pos.getPoint(u, this.camera.position);
    c.target.getPoint(u, this.target);
    this.camera.lookAt(this.target);
    const fov = s.fov ?? 50;
    if (this.camera.fov !== fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    // 時刻（縮時）
    const span = s.hoursSpan ?? [0, s.end - s.start];
    const ht = THREE.MathUtils.clamp((t - s.start - span[0]) / (span[1] - span[0]), 0, 1);
    const hs = THREE.MathUtils.smoothstep(ht, 0, 1);
    this.env.setHours(THREE.MathUtils.lerp(s.hours[0], s.hours[1], hs));
    // 淡入淡出
    const fin = THREE.MathUtils.smoothstep(t, FADE_IN[0], FADE_IN[1]);
    const fout = 1 - THREE.MathUtils.smoothstep(t, FADE_OUT[0], FADE_OUT[1]);
    return Math.min(fin, fout);
  }

  reset() { this.current = -1; }
}
