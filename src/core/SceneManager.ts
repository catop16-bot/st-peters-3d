import type * as THREE from 'three';

/**
 * 場景管理（預留）：之後加入「教堂內部博物館導覽」時，
 * 內部場景會以獨立 Scene 註冊，並在入口處切換（共用 renderer 與後製管線）。
 */
export class SceneManager {
  private scenes = new Map<string, THREE.Scene>();
  current = 'exterior';
  constructor(public active: THREE.Scene) {}
  register(id: string, scene: THREE.Scene) { this.scenes.set(id, scene); }
  get(id: string) { return this.scenes.get(id); }
}
