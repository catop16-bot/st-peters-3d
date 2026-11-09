import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode, SMAAEffect, VignetteEffect, Effect, BlendFunction, EffectAttribute } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

export type Quality = 'high' | 'medium' | 'low';

class ExposureEffect extends Effect {
  constructor() {
    super('ExposureEffect', /* glsl */ `
      uniform float exposure;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        // 防護：任何 NaN / 負值都不應進入色調映射
        if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
        outputColor = vec4(max(c, vec3(0.0)) * exposure, inputColor.a);
      }`, { blendFunction: BlendFunction.SET, uniforms: new Map([['exposure', new THREE.Uniform(1)]]) });
  }
  set value(v: number) { (this.uniforms.get('exposure') as THREE.Uniform).value = v; }
}

/** 色彩調整（對比、飽和度），輸出夾在 0..1：避免純黑在對比調整後變成負值，再經 sRGB 編碼成 NaN（白點） */
class GradeEffect extends Effect {
  constructor(contrast = 0.1, saturation = 0.08) {
    super('GradeEffect', /* glsl */ `
      uniform float contrast;
      uniform float saturation;
      uniform vec3 lift;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = clamp(inputColor.rgb, 0.0, 1.0);
        c = (c - 0.5) * (1.0 + contrast) + 0.5;
        c = clamp(c, 0.0, 1.0);
        c = c * (1.0 - lift) + lift; // 提升暗部（夜間不再一片死黑）
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, 1.0 + saturation);
        outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
      }`, { blendFunction: BlendFunction.SET, uniforms: new Map<string, THREE.Uniform>([['contrast', new THREE.Uniform(contrast)], ['saturation', new THREE.Uniform(saturation)], ['lift', new THREE.Uniform(new THREE.Vector3())]]) });
  }
  /** 依夜晚程度調整：夜間降低對比、略微抬升暗部（偏冷藍） */
  setNight(n: number) {
    (this.uniforms.get('contrast') as THREE.Uniform).value = THREE.MathUtils.lerp(0.1, 0.04, n);
    // 線性空間的抬升值經 sRGB 編碼後會被放大：0.004 約等於畫面上 13/255 的黑位
    (this.uniforms.get('lift') as THREE.Uniform).value.set(0.0035, 0.0045, 0.0075).multiplyScalar(n);
  }
}

/**
 * 自動曝光（模擬相機測光／人眼適應）：
 * 每隔幾幀把 HDR 畫面縮到 64×36，計算中央加權的對數平均亮度，
 * 再依晝夜決定目標「顯示亮度」，只做部分補償，保留清晨、黃昏與夜晚的氣氛。
 */
class AutoExposure {
  private rt = new THREE.WebGLRenderTarget(64, 36, { type: THREE.HalfFloatType, depthBuffer: false });
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.ShaderMaterial;
  private buf = new Uint16Array(64 * 36 * 4);
  private weights: Float32Array;
  private logs = new Float32Array(64 * 36);
  value = 0.5; // 目前曝光
  target = 0.5;
  meanLum = 0.5; // 最近一次測得的場景平均亮度（曝光前）
  highLum = 1; // 95 百分位亮度
  private counter = 0;
  private snapNext = true;
  every = 4; // 每幾幀測光一次

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, texel: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
        void main(){
          // 每個輸出像素取 4×4 樣本，避免縮圖時跳過細節
          float acc = 0.0;
          for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
            vec2 o = (vec2(float(x), float(y)) - 1.5) * texel;
            vec3 c = texture2D(tSrc, vUv + o).rgb;
            float l = dot(max(c, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722));
            acc += log(min(l, 40.0) + 1e-4); // 上限避免太陽盤主導
          }
          gl_FragColor = vec4(acc / 16.0, 0.0, 0.0, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat));
    // 中央加權
    this.weights = new Float32Array(64 * 36);
    for (let y = 0; y < 36; y++) for (let x = 0; x < 64; x++) {
      // y = 0 為畫面底部；重心放在畫面中下方（建築與地面），降低天空的影響
      const dx = (x + 0.5) / 64 - 0.5, dy = (y + 0.5) / 36 - 0.4;
      this.weights[y * 64 + x] = Math.exp(-(dx * dx * 3.5 + dy * dy * 7.0)) * ((y + 0.5) / 36 > 0.75 ? 0.35 : 1);
    }
  }

  /** 下一次測光直接採用目標值（鏡頭硬切時用） */
  snap() { this.snapNext = true; this.counter = 0; }

  update(renderer: THREE.WebGLRenderer, src: THREE.Texture, w: number, h: number, dt: number, night: number) {
    if (this.counter-- <= 0 || this.snapNext) {
      this.counter = this.every - 1;
      this.mat.uniforms.tSrc.value = src;
      (this.mat.uniforms.texel.value as THREE.Vector2).set(w / 64 / 4 / w, h / 36 / 4 / h);
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(this.rt);
      renderer.render(this.scene, this.cam);
      renderer.readRenderTargetPixels(this.rt, 0, 0, 64, 36, this.buf);
      renderer.setRenderTarget(prev);
      let sum = 0, ws = 0;
      for (let i = 0; i < 64 * 36; i++) {
        let v = THREE.DataUtils.fromHalfFloat(this.buf[i * 4]);
        if (!Number.isFinite(v)) v = Math.log(1e-4);
        this.logs[i] = v;
        sum += v * this.weights[i]; ws += this.weights[i];
      }
      this.meanLum = Math.exp(sum / Math.max(ws, 1e-6));
      // 高光保護：畫面最亮的 8% 不應嚴重剪裁（夜間投光、逆光天空）
      // 只統計畫面下方 70%：逆光時讓天空略為過曝，換取主體的層次
      const sorted = Float32Array.from(this.logs.subarray(0, 64 * 25)).sort();
      this.highLum = Math.exp(sorted[Math.floor(sorted.length * 0.92)]);
      // 目標顯示亮度：白天約 0.2，夜晚約 0.1；以 (L/ref)^0.25 保留部分明暗差異
      const key = THREE.MathUtils.lerp(0.21, 0.055, night);
      const ref = Math.exp(THREE.MathUtils.lerp(Math.log(0.6), Math.log(0.006), night));
      const shown = key * Math.pow(this.meanLum / ref, 0.25);
      const byMean = shown / Math.max(this.meanLum, 1e-5);
      const byHighlight = THREE.MathUtils.lerp(2.1, 2.8, night) / Math.max(this.highLum, 1e-5); // 曝光後約 2 在 ACES 下接近白但仍有層次
      this.target = THREE.MathUtils.clamp(Math.min(byMean, byHighlight), 0.1, 8);
    }
    if (this.snapNext) { this.value = this.target; this.snapNext = false; return; }
    // 在對數空間平滑適應：變暗（瞳孔收縮）較快，變亮較慢
    const lv = Math.log(this.value), lt = Math.log(this.target);
    const rate = lt < lv ? 3.0 : 1.8;
    this.value = Math.exp(lv + (lt - lv) * (1 - Math.exp(-dt * rate)));
  }
}

/**
 * 光之門轉場：朝畫面中心的徑向拉伸模糊、金色光芒射線與閃爍光點，最後被白金色光吞沒。
 * progress 0 時完全不影響畫面。
 */
export class PortalEffect extends Effect {
  constructor() {
    super('PortalEffect', /* glsl */ `
      uniform float progress;
      uniform float time;
      uniform vec2 center;
      uniform float aspect;
      float ph(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        if (progress <= 0.0005) { outputColor = inputColor; return; }
        vec2 dir = uv - center;
        float strength = progress * 0.42;
        vec3 acc = vec3(0.0); float ws = 0.0;
        for (int i = 0; i < 20; i++) {
          float t = float(i) / 19.0;
          float w = 1.0 - t * 0.55;
          acc += texture2D(inputBuffer, center + dir * (1.0 - strength * t)).rgb * w;
          ws += w;
        }
        vec3 col = acc / ws;
        vec2 d2 = dir * vec2(aspect, 1.0);
        float r = length(d2);
        float ang = atan(d2.y, d2.x);
        float rays = pow(max(0.0, sin(ang * 23.0 + time * 1.3) * 0.5 + 0.5), 7.0) * 0.6
                   + pow(max(0.0, sin(ang * 41.0 - time * 1.9) * 0.5 + 0.5), 10.0) * 0.5;
        float core = exp(-r * r / (0.006 + progress * progress * 0.9));
        vec3 gold = vec3(1.0, 0.84, 0.55);
        col += gold * (core * 1.6 + rays * core * 1.2) * smoothstep(0.0, 0.6, progress);
        // 光點（向外流動）
        vec2 cell = vec2(ang * 30.0, r * 40.0 - time * 6.0);
        vec2 g = floor(cell);
        float h = ph(g);
        float roundDot = smoothstep(0.42, 0.0, length(fract(cell) - 0.5));
        float sp = step(0.985, h) * roundDot * (0.5 + 0.5 * sin(time * 9.0 + h * 50.0)) * smoothstep(0.1, 0.5, progress) * (1.0 - smoothstep(0.8, 1.0, progress));
        col += gold * sp * 1.4;
        col = mix(col, vec3(1.0, 0.96, 0.88), smoothstep(0.62, 1.0, progress));
        outputColor = vec4(col, inputColor.a);
      }`, {
      blendFunction: BlendFunction.SET,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([['progress', new THREE.Uniform(0)], ['time', new THREE.Uniform(0)], ['center', new THREE.Uniform(new THREE.Vector2(0.5, 0.5))], ['aspect', new THREE.Uniform(16 / 9)]]),
    });
  }
  get progress() { return (this.uniforms.get('progress') as THREE.Uniform).value as number; }
  set progress(v: number) { (this.uniforms.get('progress') as THREE.Uniform).value = v; }
  set time(v: number) { (this.uniforms.get('time') as THREE.Uniform).value = v; }
  setCenter(x: number, y: number) { ((this.uniforms.get('center') as THREE.Uniform).value as THREE.Vector2).set(x, y); }
  set aspect(v: number) { (this.uniforms.get('aspect') as THREE.Uniform).value = v; }
}

export class Renderer {
  /** 光之門轉場效果（跨畫質切換保留同一個實例的狀態） */
  portal = new PortalEffect();
  private portalPass: EffectPass | null = null;
  readonly autoExposure = new AutoExposure();
  renderer: THREE.WebGLRenderer;
  composer!: EffectComposer;
  private ao: N8AOPostPass | null = null;
  private renderPass!: RenderPass;
  private exposure = new ExposureEffect();
  private bloom!: BloomEffect;
  private grade!: GradeEffect;
  quality: Quality = 'high';
  private fixed: { w: number; h: number } | null = null;
  /** 固定輸出解析度（錄影用）；傳 null 恢復跟隨視窗 */
  setFixedSize(size: { w: number; h: number } | null) {
    this.fixed = size;
    this.renderer.setPixelRatio(size ? 1 : Math.min(window.devicePixelRatio, this.quality === 'high' ? 1.5 : this.quality === 'medium' ? 1.0 : 0.85));
    this.resize();
  }

  constructor(private canvas: HTMLCanvasElement, private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true, logarithmicDepthBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.setQuality(this.detectQuality());
  }

  detectQuality(): Quality {
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (mobile) return 'low';
    return 'high';
  }

  setQuality(q: Quality) {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio, q === 'high' ? 1.5 : q === 'medium' ? 1.0 : 0.85);
    this.renderer.setPixelRatio(this.fixed ? 1 : dpr);
    this.composer?.dispose();
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.ao = null;
    if (q !== 'low') {
      this.ao = new N8AOPostPass(this.scene, this.camera, w, h);
      const c = this.ao.configuration;
      c.aoRadius = 4.0;
      c.distanceFalloff = 1.2;
      c.intensity = 2.2;
      c.aoSamples = q === 'high' ? 12 : 6;
      c.denoiseSamples = q === 'high' ? 6 : 4;
      c.gammaCorrection = false;
      this.composer.addPass(this.ao);
    }
    this.exposure = new ExposureEffect();
    this.bloom = new BloomEffect({ luminanceThreshold: 1.6, luminanceSmoothing: 0.3, intensity: 0.7, mipmapBlur: true, radius: 0.7 });
    const effects: Effect[] = [this.exposure, this.bloom, new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }), (this.grade = new GradeEffect(0.1, 0.08)), new VignetteEffect({ offset: 0.3, darkness: 0.4 })];
    effects.push(new SMAAEffect());
    this.composer.addPass(new EffectPass(this.camera, ...effects));
    // 轉場效果需讀取鄰近像素（卷積），必須獨立成一個 pass
    const prevProgress = this.portal.progress;
    this.portal = new PortalEffect();
    this.portal.progress = prevProgress;
    this.portalPass = new EffectPass(this.camera, this.portal);
    this.composer.addPass(this.portalPass);
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }

  /** 切換要算圖的場景（外部廣場 ↔ 教堂內部） */
  setScene(scene: THREE.Scene) {
    this.scene = scene;
    this.renderPass.mainScene = scene;
    if (this.ao) (this.ao as unknown as { scene: THREE.Scene }).scene = scene;
    this.renderer.shadowMap.needsUpdate = true;
    this.autoExposure.snap();
  }

  setShadowMapSize(light: THREE.DirectionalLight) {
    const s = this.quality === 'high' ? 4096 : this.quality === 'medium' ? 2048 : 1024;
    if (light.shadow.mapSize.x !== s) {
      light.shadow.mapSize.set(s, s);
      light.shadow.map?.dispose();
      (light.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
  }

  resize() {
    const w = this.fixed?.w ?? (this.canvas.clientWidth || window.innerWidth), h = this.fixed?.h ?? (this.canvas.clientHeight || window.innerHeight);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** night：0 白天 → 1 夜晚；fade：淡入淡出倍率；bias：天氣等額外曝光補償 */
  render(dt: number, night: number, fade = 1, bias = 1) {
    const exposure = this.autoExposure.value * bias * fade;
    this.exposure.value = exposure;
    this.grade.setNight(night);
    // 泛光門檻以「曝光後」亮度計算：只有燈具、窗光、強烈反光才會泛光
    this.bloom.luminanceMaterial.threshold = 1.6 / Math.max(this.autoExposure.value * bias, 1e-3);
    this.portal.aspect = this.camera.aspect;
    this.composer.render(dt);
    // 以本幀 HDR 畫面（曝光前）測光，供下一幀使用
    const src = this.composer.inputBuffer;
    this.autoExposure.update(this.renderer, src.texture, src.width, src.height, dt, night);
  }
}
