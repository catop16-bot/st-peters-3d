import * as THREE from 'three';

/**
 * 拋光大理石地面的反射：進入教堂時在中殿、交叉部、後殿各拍一次低解析度立方體環境，
 * 地面材質依相機所在區域切換對應的環境貼圖。只在進入或晝夜明顯改變時重拍，不影響幀率。
 */
export class FloorReflections {
  private probes: { x: number; rt: THREE.WebGLCubeRenderTarget; cam: THREE.CubeCamera }[] = [];
  private lastNight = -1;
  private current = -1;
  enabled = true;

  constructor(private scene: THREE.Scene, private floor: THREE.MeshStandardMaterial, size = 128) {
    // 探針位置（大教堂本地座標 x，高度約 1.6 m，z = 0）：中殿、交叉部（華蓋旁）、後殿
    for (const x of [70, 18, -40]) {
      const rt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      const cam = new THREE.CubeCamera(0.5, 400, rt);
      cam.position.set(x, 1.6, 0);
      scene.add(cam);
      this.probes.push({ x, rt, cam });
    }
  }

  /** 重新拍攝（進入教堂時、晝夜改變時） */
  capture(renderer: THREE.WebGLRenderer, night: number) {
    if (!this.enabled) return;
    this.lastNight = night;
    const prevEnv = this.floor.envMap;
    this.floor.envMap = null; // 拍攝時地面不反射自己
    for (const p of this.probes) p.cam.update(renderer, this.scene);
    this.floor.envMap = prevEnv;
    this.current = -1;
  }

  /** 每幀：依相機位置切換地面使用的環境；晝夜變化超過門檻時重拍 */
  update(renderer: THREE.WebGLRenderer, camX: number, night: number) {
    if (!this.enabled) {
      if (this.floor.envMap) { this.floor.envMap = null; this.floor.needsUpdate = true; }
      return;
    }
    if (this.lastNight < 0 || Math.abs(night - this.lastNight) > 0.25) this.capture(renderer, night);
    let best = 0;
    for (let i = 1; i < this.probes.length; i++) if (Math.abs(camX - this.probes[i].x) < Math.abs(camX - this.probes[best].x)) best = i;
    if (best !== this.current) {
      this.current = best;
      this.floor.envMap = this.probes[best].rt.texture;
      this.floor.envMapIntensity = 0.9;
      this.floor.needsUpdate = true;
    }
  }
}
