import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ScanInfo {
  url: string; // public/ 下的 .glb（Draco 壓縮）
  title: string;
  credit: string; // 作者與掃描對象
  license: string;
  source: string; // 原始頁面
}

/**
 * 真實 3D 掃描檢視器：獨立的小視窗與渲染器，可旋轉、縮放。
 * GLTFLoader / DRACOLoader 在第一次開啟時才動態載入。
 */
export class ScanViewer {
  private root: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private raf = 0;
  private static exists = new Map<string, Promise<boolean>>();

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'scan-modal hidden';
    this.root.innerHTML = `
      <div class="scan-box">
        <button class="close" aria-label="關閉">×</button>
        <div class="scan-title"></div>
        <div class="scan-stage"><canvas></canvas><div class="scan-status">載入中…</div></div>
        <div class="scan-credit"></div>
      </div>`;
    document.body.appendChild(this.root);
    this.canvas = this.root.querySelector('canvas')!;
    this.root.querySelector('.close')!.addEventListener('click', () => this.close());
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !this.root.classList.contains('hidden')) { e.stopPropagation(); this.close(); } }, true);
  }

  /** 掃描檔是否已放進專案（沒有檔案時不顯示按鈕） */
  static available(url: string) {
    let p = ScanViewer.exists.get(url);
    if (!p) {
      p = fetch(import.meta.env.BASE_URL + url, { method: 'HEAD' }).then((r) => r.ok && !(r.headers.get('content-type') ?? '').includes('text/html'), () => false);
      ScanViewer.exists.set(url, p);
    }
    return p;
  }

  async open(info: ScanInfo) {
    this.root.classList.remove('hidden');
    (this.root.querySelector('.scan-title') as HTMLElement).textContent = info.title;
    const credit = this.root.querySelector('.scan-credit') as HTMLElement;
    credit.innerHTML = '';
    credit.append(`${info.credit} · ${info.license} · `);
    const a = document.createElement('a'); a.href = info.source; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '原始掃描頁面';
    credit.appendChild(a);
    const status = this.root.querySelector('.scan-status') as HTMLElement;
    status.textContent = '載入中…'; status.style.display = '';

    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
    ]);
    const stage = this.canvas.parentElement!;
    const r = (this.renderer ??= new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setSize(stage.clientWidth, stage.clientHeight, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15120e);
    scene.add(new THREE.HemisphereLight(0xfff3e0, 0x3a3028, 1.2));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.6); key.position.set(2, 3, 2.5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xc8d8ff, 0.8); rim.position.set(-3, 1, -2); scene.add(rim);
    const cam = new THREE.PerspectiveCamera(35, stage.clientWidth / stage.clientHeight, 0.01, 100);
    const ctl = new OrbitControls(cam, this.canvas);
    ctl.enableDamping = true;

    const draco = new DRACOLoader(); // 解碼器路徑由打包工具自動處理
    const loader = new GLTFLoader().setDRACOLoader(draco);
    try {
      const gltf = await loader.loadAsync(import.meta.env.BASE_URL + info.url, (e) => {
        if (e.total) status.textContent = `載入中… ${Math.round((e.loaded / e.total) * 100)}%`;
      });
      const obj = gltf.scene;
      obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !(m.material as THREE.MeshStandardMaterial).map) {
          m.material = new THREE.MeshStandardMaterial({ color: 0xece4d6, roughness: 0.55 }); // 大理石色
        }
      });
      // 置中並調整鏡頭距離
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      obj.position.sub(c);
      scene.add(obj);
      const R = size.length() / 2;
      cam.position.set(0, R * 0.15, R * 2.6);
      cam.near = R / 100; cam.far = R * 20; cam.updateProjectionMatrix();
      ctl.target.set(0, 0, 0);
      status.style.display = 'none';
    } catch (err) {
      status.textContent = '掃描檔載入失敗';
      console.error(err);
    } finally {
      draco.dispose();
    }
    const loop = () => {
      if (this.root.classList.contains('hidden')) return;
      const w = stage.clientWidth, h = stage.clientHeight;
      if (this.canvas.width !== Math.round(w * r.getPixelRatio())) { r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      ctl.update();
      r.render(scene, cam);
      this.raf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.raf);
    loop();
    this.dispose = () => { ctl.dispose(); scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }); };
  }

  private dispose: (() => void) | null = null;

  close() {
    this.root.classList.add('hidden');
    cancelAnimationFrame(this.raf);
    this.dispose?.(); this.dispose = null;
  }
}
