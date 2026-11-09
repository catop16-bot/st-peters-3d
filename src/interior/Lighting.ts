import * as THREE from 'three';
import type { Environment } from '../env/Environment';
import type { InteriorBuild } from './Interior';
import { IN } from './Interior';
import { G } from '../core/materials';
import { radialTexture } from '../world/surroundings/Streets';

/**
 * 內部光影：
 * - 環境光：暖色漸層「室內天光」生成 PMREM（金屬、拋光大理石才有反射）
 * - 天光束：依外部真實太陽方向，從鼓座窗與中殿高側窗射入的體積光柱，與地面光斑
 * - 微塵：被光照到的漂浮塵埃
 * - 夜間：吊燈、燭台般的暖色點光源
 */
export class InteriorLighting {
  private hemi: THREE.HemisphereLight;
  private lamps: THREE.PointLight[] = [];
  private shafts = new THREE.Group();
  private patches = new THREE.Group();
  private shaftMat: THREE.ShaderMaterial;
  private patchMat: THREE.MeshBasicMaterial;
  private dust: THREE.Points;
  private envDay: THREE.Texture;
  private envNight: THREE.Texture;
  private lastKey = '';
  private sunLocal = new THREE.Vector3();
  gloryMat: THREE.MeshStandardMaterial | null = null;

  constructor(private build: InteriorBuild, renderer: THREE.WebGLRenderer, private frameAngle: number) {
    const scene = build.scene;
    // ── 環境貼圖（白天 / 夜晚兩組）──
    const pm = new THREE.PMREMGenerator(renderer);
    this.envDay = pm.fromScene(gradientScene([1.0, 0.95, 0.86], [0.78, 0.68, 0.55], [0.32, 0.26, 0.2], 1.4), 0, 1, 200).texture;
    this.envNight = pm.fromScene(gradientScene([0.42, 0.33, 0.24], [0.5, 0.38, 0.25], [0.22, 0.16, 0.1], 0.6), 0, 1, 200).texture;
    pm.dispose();
    scene.environment = this.envDay;

    this.hemi = new THREE.HemisphereLight(0xfff1dc, 0x5a4636, 0.5);
    scene.add(this.hemi);

    // ── 夜間暖色燈（中殿、交叉處、後殿、翼殿）──
    const spots: [number, number, number][] = [[105, 16, 0], [78, 18, 0], [52, 18, 0], [16, 22, 0], [-16, 22, 0], [0, 22, 16], [-48, 16, 0], [0, 16, -48], [0, 16, 48]];
    for (const p of spots) {
      const l = new THREE.PointLight(0xffc386, 0, 0, 2);
      l.position.set(...p);
      scene.add(l);
      this.lamps.push(l);
    }

    // ── 光束 ──
    this.shaftMat = new THREE.ShaderMaterial({
      uniforms: { uI: { value: 0 }, uTime: G.uTime, uColor: { value: new THREE.Color(1.0, 0.9, 0.72) } },
      vertexShader: /* glsl */ `
        varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vW;
        void main(){
          vT = uv.y;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uI; uniform float uTime; uniform vec3 uColor;
        varying float vT; varying vec3 vN; varying vec3 vV; varying vec3 vW;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
        float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
                     mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){
          float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
          float along = smoothstep(0.0, 0.08, vT) * (1.0 - smoothstep(0.75, 1.0, vT));
          float dust = 0.65 + 0.35 * n3(vW * 0.35 + vec3(0.0, uTime * 0.15, 0.0));
          float a = uI * edge * along * dust * 0.16;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    this.patchMat = new THREE.MeshBasicMaterial({ map: radialTexture(), color: new THREE.Color(1.0, 0.88, 0.7), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
    scene.add(this.shafts, this.patches);

    // ── 微塵 ──
    const N = 7000;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) pos.set([-60 + Math.random() * 175, 1 + Math.random() * 70, -60 + Math.random() * 120], i * 3);
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dm = new THREE.ShaderMaterial({
      uniforms: { uTime: G.uTime, uA: { value: 0.3 } },
      vertexShader: /* glsl */ `uniform float uTime; varying float vF;
        void main(){ vec3 p = position; p.x += sin(uTime*0.07 + position.y)*1.5; p.y += sin(uTime*0.05 + position.x*0.3)*1.2; p.z += cos(uTime*0.06 + position.y*0.2)*1.5;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(40.0 / -mv.z, 0.6, 3.0); vF = fract(sin(dot(position, vec3(1.7, 9.2, 3.1))) * 937.0); }`,
      fragmentShader: 'uniform float uA; varying float vF; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.92, 0.78), uA * (0.4 + 0.6 * vF) * (1.0 - d * 2.0)); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    this.dust = new THREE.Points(dg, dm);
    this.dust.frustumCulled = false;
    scene.add(this.dust);
  }

  /** 每幀更新：依外部環境（太陽方向、晝夜、天氣）調整 */
  update(env: Environment) {
    const night = env.night;
    // 太陽方向轉到教堂本地座標
    const ca = Math.cos(this.frameAngle), sa = Math.sin(this.frameAngle);
    const s = env.sunDir;
    this.sunLocal.set(s.x * ca - s.z * sa, s.y, s.x * sa + s.z * ca).normalize();
    const sunUp = env.sunAltitude > 2;
    const sunK = sunUp ? THREE.MathUtils.clamp(env.sun.intensity / 6, 0, 1) : 0;
    const day = 1 - night;

    const sc = this.build.scene;
    sc.environment = night > 0.5 ? this.envNight : this.envDay;
    sc.environmentIntensity = THREE.MathUtils.lerp(0.35, 1.0, day) * (0.55 + 0.45 * Math.max(sunK, 0.4));
    this.hemi.intensity = 0.15 + 0.35 * day;
    for (const l of this.lamps) l.intensity = 2600 * THREE.MathUtils.smoothstep(night, 0.2, 0.9);
    this.build.mats.window.emissiveIntensity = THREE.MathUtils.lerp(0.06, 2.6, day) * (0.5 + 0.5 * Math.max(sunK, 0.3));
    this.build.mats.window.emissive.setRGB(0.92 + 0.08 * night, 0.95, 1.0);
    if (this.gloryMat) this.gloryMat.emissiveIntensity = THREE.MathUtils.lerp(2.2, 5.5, day);
    (this.dust.material as THREE.ShaderMaterial).uniforms.uA.value = 0.06 + 0.3 * sunK;
    (sc.fog as THREE.FogExp2).color.setRGB(0.8, 0.72, 0.6).multiplyScalar(0.25 + 0.75 * day);

    // 光束只在太陽方向明顯改變時重建
    const key = `${this.sunLocal.x.toFixed(2)},${this.sunLocal.y.toFixed(2)},${this.sunLocal.z.toFixed(2)},${sunUp}`;
    this.shaftMat.uniforms.uI.value = sunK;
    this.patchMat.opacity = 0.55 * sunK;
    if (key !== this.lastKey) { this.lastKey = key; this.rebuildShafts(sunUp); }
  }

  private rebuildShafts(sunUp: boolean) {
    for (const g of [this.shafts, this.patches]) {
      for (const c of [...g.children]) { (c as THREE.Mesh).geometry.dispose(); g.remove(c); }
    }
    if (!sunUp || this.sunLocal.y < 0.08) return;
    const into = this.sunLocal.clone().negate(); // 光線行進方向
    const horiz = new THREE.Vector3(this.sunLocal.x, 0, this.sunLocal.z).normalize();
    const add = (p0: THREE.Vector3, normal: THREE.Vector3, radius: number) => {
      // 窗必須面向太陽
      if (normal.x * horiz.x + normal.z * horiz.z < 0.15) return;
      const t = p0.y / Math.max(0.05, -into.y);
      const p1 = p0.clone().addScaledVector(into, t);
      // 光斑必須落在室內範圍
      if (p1.x > IN.naveEnd - 1 || p1.x < IN.apseEnd + 1 || Math.abs(p1.z) > IN.transeptEnd - 1) return;
      const len = p0.distanceTo(p1);
      const g = new THREE.CylinderGeometry(radius, radius * 1.15, len, 12, 1, true);
      g.translate(0, -len / 2, 0); // 頂端在原點
      const m = new THREE.Mesh(g, this.shaftMat);
      m.position.copy(p0);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), into);
      m.renderOrder = 5;
      this.shafts.add(m);
      // 地面光斑：沿太陽水平方向拉長
      const stretch = 1 / Math.max(0.15, this.sunLocal.y);
      const pg = new THREE.PlaneGeometry(radius * 3.2, radius * 3.2 * Math.min(stretch, 4));
      pg.rotateX(-Math.PI / 2);
      const pm = new THREE.Mesh(pg, this.patchMat);
      pm.position.set(p1.x, 0.03, p1.z);
      pm.rotation.y = Math.atan2(horiz.x, horiz.z);
      pm.renderOrder = 4;
      this.patches.add(pm);
    };
    for (const w of this.build.drumWindows) add(w.pos, w.normal, 1.5);
    for (const w of this.build.naveWindows) add(w.pos, new THREE.Vector3(w.normal.x, 0, w.normal.z).normalize(), 2.0);
  }
}

/** 室內天光漸層：頂部（穹頂天光）明亮、牆面中段暖色、地面較暗 */
function gradientScene(top: number[], mid: number[], bottom: number[], k: number) {
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(...top).multiplyScalar(k) }, uMid: { value: new THREE.Color(...mid).multiplyScalar(k) }, uBot: { value: new THREE.Color(...bottom).multiplyScalar(k) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uTop, uMid, uBot; varying vec3 vD; void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(uMid, uTop, smoothstep(0.0, 0.85, y)) : mix(uMid, uBot, smoothstep(0.0, 0.6, -y)); gl_FragColor = vec4(c, 1.0); }',
    side: THREE.BackSide,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat));
  return s;
}
