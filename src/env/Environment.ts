import * as THREE from 'three';
import * as SunCalc from 'suncalc';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { G } from '../core/materials';
import { ROME } from '../core/geo';
import { radialTexture } from '../world/surroundings/Streets';

// 修正：夜間天空亮度極低時，雲層遮蔽步驟（texColor -= L0 * alpha）會產生負值，
// 導致環境貼圖出現負輻射而在色調映射後變成 NaN（白色破圖）。在輸出前夾到 >= 0。
// 另加 uDim：陰天 / 雨天時整體調暗天空（同時影響由天空產生的環境光）。
const SkyShader = (Sky as unknown as { SkyShader: { uniforms: Record<string, { value: unknown }>; fragmentShader: string } }).SkyShader;
SkyShader.uniforms.uDim = { value: 1.0 };
SkyShader.uniforms.uGrey = { value: 0.0 };
SkyShader.uniforms.uNightGlow = { value: 0.0 };
SkyShader.uniforms.uGlowCloud = { value: 0.0 };
SkyShader.fragmentShader = SkyShader.fragmentShader
  .replace('uniform float time;', 'uniform float time;\n\t\tuniform float uDim;\n\t\tuniform float uGrey;\n\t\tuniform float uNightGlow;\n\t\tuniform float uGlowCloud;')
  .replace('gl_FragColor = vec4( texColor, 1.0 );', `vec3 skyC = max( texColor, vec3( 0.0 ) );
			float skyL = dot( skyC, vec3( 0.2126, 0.7152, 0.0722 ) );
			skyC = mix( skyC, vec3( skyL ) * vec3( 0.94, 0.97, 1.03 ), uGrey );
			// 限制太陽周圍散射光暈的亮度，避免逆光時泛光成一大片白；保留小而亮的日盤
			vec3 over = max( skyC - 1.2, vec3( 0.0 ) );
			skyC = min( skyC, vec3( 1.2 ) ) + over / ( 1.0 + over / 1.4 ) + vec3( 1.0, 0.92, 0.8 ) * sundisc * 18.0;
			// 城市夜空光害：地平線附近偏暖橘、天頂深藍；雲層會反射城市燈光而更亮
			float hy = clamp( direction.y, 0.0, 1.0 );
			vec3 glow = mix( vec3( 0.021, 0.0135, 0.0085 ), vec3( 0.0034, 0.0045, 0.0085 ), smoothstep( 0.0, 0.45, hy ) );
			glow *= 1.0 + uGlowCloud * 1.6;
			skyC += glow * uNightGlow;
			gl_FragColor = vec4( skyC * uDim, 1.0 );`);

export type Weather = 'clear' | 'cloudy' | 'overcast' | 'rain' | 'fog' | 'snow';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export const SEASON_DATES: Record<Season, [number, number]> = {
  spring: [3, 15], // 4 月 15 日（月份 0 起算）
  summer: [6, 15],
  autumn: [9, 20],
  winter: [0, 15],
};

export function seasonOf(month: number): Season {
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'autumn';
  return 'winter';
}

const dtf = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
function romeOffsetMs(d: Date) {
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - d.getTime();
}
/** 羅馬當地時間 → Date（自動處理夏令時間） */
export function romeDate(year: number, month: number, day: number, hours: number): Date {
  const guess = Date.UTC(year, month, day, 0, 0, 0) + hours * 3600e3;
  return new Date(guess - romeOffsetMs(new Date(guess)));
}

/** suncalc v2：高度角與方位角皆為「度」，方位由北順時針（北 0、東 90、南 180）→ 本地座標（X 東、Z 南） */
function dirFrom(altDeg: number, azDeg: number, out: THREE.Vector3) {
  const alt = THREE.MathUtils.degToRad(altDeg), az = THREE.MathUtils.degToRad(azDeg);
  return out.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt)).normalize();
}

interface WeatherParams { grey: number; dim: number; cloud: number; density: number; turbidity: number; rayleigh: number; fog: number; sun: number; wet: number; snow: number; rain: number; flakes: number; }
const WEATHER: Record<Weather, WeatherParams> = {
  clear: { grey: 0, dim: 1.0, cloud: 0.12, density: 0.35, turbidity: 2.2, rayleigh: 1.2, fog: 0.00022, sun: 1.0, wet: 0, snow: 0, rain: 0, flakes: 0 },
  cloudy: { grey: 0.3, dim: 0.85, cloud: 0.5, density: 0.55, turbidity: 4, rayleigh: 1.4, fog: 0.00035, sun: 0.75, wet: 0, snow: 0, rain: 0, flakes: 0 },
  overcast: { grey: 0.8, dim: 0.36, cloud: 0.95, density: 0.9, turbidity: 9, rayleigh: 2.2, fog: 0.0006, sun: 0.14, wet: 0, snow: 0, rain: 0, flakes: 0 },
  rain: { grey: 0.9, dim: 0.2, cloud: 1.0, density: 1.0, turbidity: 12, rayleigh: 2.6, fog: 0.0013, sun: 0.07, wet: 1, snow: 0, rain: 1, flakes: 0 },
  fog: { grey: 0.75, dim: 0.55, cloud: 0.8, density: 0.7, turbidity: 16, rayleigh: 3.5, fog: 0.0075, sun: 0.22, wet: 0.25, snow: 0, rain: 0, flakes: 0 },
  snow: { grey: 0.85, dim: 0.42, cloud: 1.0, density: 0.95, turbidity: 10, rayleigh: 2.4, fog: 0.0022, sun: 0.1, wet: 0, snow: 1, rain: 0, flakes: 1 },
};

const LEAF: Record<Season, [number, number, number]> = {
  spring: [0.34, 0.48, 0.16], summer: [0.2, 0.31, 0.1], autumn: [0.62, 0.36, 0.1], winter: [0.36, 0.3, 0.18],
};
const GRASS: Record<Season, [number, number, number]> = {
  spring: [0.3, 0.44, 0.15], summer: [0.4, 0.4, 0.2], autumn: [0.32, 0.37, 0.16], winter: [0.27, 0.33, 0.16],
};

export class Environment {
  sky: Sky;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  stars: THREE.Points;
  moon: THREE.Sprite;
  rain: THREE.LineSegments;
  snow: THREE.Points;
  fog: THREE.FogExp2;
  sunDir = new THREE.Vector3();
  moonDir = new THREE.Vector3();
  lightDir = new THREE.Vector3();
  exposure = 1;
  night = 0;
  sunAltitude = 0; // 度

  // 狀態
  year = 2026;
  month = 3;
  day = 15;
  hours = 10.5;
  weather: Weather = 'clear';
  season: Season = 'spring';
  timeFlow = 0; // 每秒前進的分鐘數

  private cur: WeatherParams = { ...WEATHER.clear };
  private envDirty = true;
  private envTimer = 0;
  private pmrem: THREE.PMREMGenerator;
  private envScene = new THREE.Scene();
  private envSky: Sky;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private snowAmount = 0;
  private shadowSig = '';
  private wetAmount = 0;
  deciduous: THREE.InstancedMesh[] = [];
  lampGlow: THREE.MeshBasicMaterial | null = null;
  lampHeads: THREE.MeshStandardMaterial | null = null;
  onChange: (() => void) | null = null;

  constructor(private scene: THREE.Scene, private renderer: THREE.WebGLRenderer) {
    this.sky = new Sky();
    this.sky.scale.setScalar(18000);
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.envSky = new Sky();
    this.envSky.scale.setScalar(1000);
    this.envScene.add(this.envSky);
    this.pmrem = new THREE.PMREMGenerator(renderer);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.sun.shadow.radius = 3;
    const sc = this.sun.shadow.camera;
    sc.near = 1; sc.far = 3000;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x5a4a3a, 0.25);
    scene.add(this.hemi);

    this.fog = new THREE.FogExp2(0xb8c6d6, 0.0003);
    scene.fog = this.fog;

    // 星空
    const N = 4000;
    const sp = new Float32Array(N * 3);
    const ss = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      sp.set([r * Math.cos(th) * 15000, Math.abs(u) * 15000, r * Math.sin(th) * 15000], i * 3);
      ss[i] = Math.pow(Math.random(), 6) * 3 + 0.6;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('size', new THREE.BufferAttribute(ss, 1));
    const smat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: 'attribute float size; varying float vS; void main(){ vS = size; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size; }',
      fragmentShader: 'uniform float uAlpha; varying float vS; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(vec3(1.0,0.97,0.9) * (0.6 + vS*0.4), uAlpha * (1.0 - d*2.0)); }',
      transparent: true, depthWrite: false, fog: false,
    });
    this.stars = new THREE.Points(sg, smat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -1;
    scene.add(this.stars);

    // 月亮
    const mtex = moonTexture();
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mtex, color: 0xffffff, transparent: true, depthWrite: false, fog: false }));
    this.moon.scale.setScalar(240);
    scene.add(this.moon);

    this.rain = makeRain();
    this.snow = makeSnow();
    scene.add(this.rain, this.snow);
    this.applySeason(true);
  }

  setWeather(w: Weather) { this.weather = w; this.envDirty = true; this.onChange?.(); }
  /** 立即套用天氣參數（略過過渡），供影片硬切使用 */
  snapWeather() { this.cur = { ...WEATHER[this.weather] }; this.envDirty = true; this.envTimer = 0; }
  /** 直接指定地表積雪與潮濕量（0..1） */
  setSurface(snow: number, wet: number) { this.snowAmount = snow; this.wetAmount = wet; }
  /** 環境貼圖重新生成的最短間隔（秒）；錄影時調小以免縮時畫面跳動 */
  envInterval = 0.25;
  setSeason(s: Season) {
    this.season = s;
    const [m, d] = SEASON_DATES[s];
    this.month = m; this.day = d;
    this.applySeason(false);
    this.envDirty = true;
    this.onChange?.();
  }
  setDate(y: number, m: number, d: number) {
    this.year = y; this.month = m; this.day = d;
    const s = seasonOf(m);
    if (s !== this.season) { this.season = s; this.applySeason(false); }
    this.envDirty = true;
    this.onChange?.();
  }
  setHours(h: number) { this.hours = ((h % 24) + 24) % 24; this.envDirty = true; }

  applySeason(_init: boolean) {
    const l = LEAF[this.season], g = GRASS[this.season];
    G.uLeafColor.value.setRGB(l[0], l[1], l[2]);
    G.uGrassColor.value.setRGB(g[0], g[1], g[2]);
    for (const m of this.deciduous) m.visible = this.season !== 'winter';
  }

  /** 當日日出、日落（羅馬當地小時） */
  sunTimes() {
    const date = romeDate(this.year, this.month, this.day, 12);
    const t = SunCalc.getTimes(date, ROME.lat, ROME.lon);
    const toH = (d: Date | null) => {
      if (!d || isNaN(d.getTime())) return 12;
      const off = romeOffsetMs(d);
      const local = new Date(d.getTime() + off);
      return local.getUTCHours() + local.getUTCMinutes() / 60;
    };
    return { sunrise: toH(t.sunrise), sunset: toH(t.sunset), noon: toH(t.solarNoon) };
  }

  update(dt: number, camera: THREE.Camera, shadowFocus: THREE.Vector3, shadowSize: number) {
    if (this.timeFlow) { this.hours += (this.timeFlow * dt) / 60; if (this.hours >= 24) this.hours -= 24; this.envDirty = true; }
    G.uTime.value += dt;
    const date = romeDate(this.year, this.month, this.day, this.hours);
    const sp = SunCalc.getPosition(date, ROME.lat, ROME.lon);
    dirFrom(sp.altitude, sp.azimuth, this.sunDir);
    const mp = SunCalc.getMoonPosition(date, ROME.lat, ROME.lon);
    dirFrom(mp.altitude, mp.azimuth, this.moonDir);
    const illum = SunCalc.getMoonIllumination(date).fraction;
    this.sunAltitude = sp.altitude;

    // 天氣參數平滑過渡
    const target = WEATHER[this.weather];
    const k = 1 - Math.exp(-dt * 1.5);
    for (const key of Object.keys(target) as (keyof WeatherParams)[]) this.cur[key] += (target[key] - this.cur[key]) * k;
    const c = this.cur;
    // 積雪 / 潮濕的累積與消退
    this.snowAmount += ((c.snow > 0.5 ? 1 : 0) - this.snowAmount) * (1 - Math.exp(-dt * (c.snow > 0.5 ? 0.12 : 0.05)));
    this.wetAmount += ((c.wet > 0.5 ? 1 : c.wet) - this.wetAmount) * (1 - Math.exp(-dt * (c.wet > 0.5 ? 0.3 : 0.06)));
    G.uSnow.value = this.snowAmount;
    G.uWet.value = Math.max(this.wetAmount, this.snowAmount * 0.3);

    const altDeg = sp.altitude;
    this.night = THREE.MathUtils.smoothstep(-altDeg, -3, 9); // 0 = 白天, 1 = 夜
    G.uNight.value = this.night;

    // 天空
    for (const sky of [this.sky, this.envSky]) {
      const u = sky.material.uniforms;
      u.sunPosition.value.copy(this.sunDir);
      u.turbidity.value = c.turbidity;
      u.rayleigh.value = c.rayleigh * (1 - this.night * 0.5);
      u.mieCoefficient.value = 0.005 + c.cloud * 0.01;
      u.mieDirectionalG.value = 0.8;
      u.cloudCoverage.value = c.cloud;
      u.cloudDensity.value = c.density;
      u.cloudElevation.value = 0.55;
      u.cloudScale.value = 0.00018;
      u.cloudSpeed.value = 0.00004;
      u.time.value = G.uTime.value;
      u.showSunDisc.value = c.cloud > 0.9 ? 0 : 1;
      u.uDim.value = c.dim;
      u.uGrey.value = c.grey;
      u.uNightGlow.value = this.night;
      u.uGlowCloud.value = c.cloud;
    }
    this.sky.position.copy(camera.position);

    // 主光源：白天為太陽，夜間為月光
    const sunUp = altDeg > -2;
    this.lightDir.copy(sunUp ? this.sunDir : this.moonDir);
    if (this.lightDir.y < 0.05) this.lightDir.y = 0.05;
    this.lightDir.normalize();
    const elev = Math.max(0, Math.sin(THREE.MathUtils.degToRad(sp.altitude)));
    let intensity: number;
    const col = new THREE.Color();
    if (sunUp) {
      // 大氣衰減：低角度偏橘紅
      const t = THREE.MathUtils.clamp(altDeg / 25, 0, 1);
      col.setRGB(1.0, 0.55 + 0.42 * t, 0.32 + 0.6 * t);
      intensity = 6.0 * THREE.MathUtils.smoothstep(altDeg, -2, 8) * (0.35 + 0.65 * Math.min(1, elev * 2.2)) * c.sun;
    } else {
      col.setRGB(0.55, 0.65, 0.9);
      intensity = 0.32 * illum * Math.max(0, Math.min(1, this.moonDir.y * 4)) * (0.2 + 0.8 * c.sun);
    }
    this.sun.color.copy(col);
    this.sun.intensity = intensity;
    this.sun.castShadow = intensity > 0.02;
    this.sun.shadow.intensity = THREE.MathUtils.clamp(0.25 + c.sun * 0.8, 0.25, 1);
    // 陰影相機跟隨視點，並對齊像素避免閃爍
    const sc = this.sun.shadow.camera;
    const half = shadowSize / 2;
    sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
    sc.updateProjectionMatrix();
    const texel = shadowSize / this.sun.shadow.mapSize.x;
    const focus = shadowFocus.clone();
    // 在光源座標中對齊
    const lightMat = new THREE.Matrix4().lookAt(new THREE.Vector3(), this.lightDir.clone().negate(), new THREE.Vector3(0, 1, 0));
    const inv = lightMat.clone().invert();
    focus.applyMatrix4(inv);
    focus.x = Math.round(focus.x / texel) * texel;
    focus.y = Math.round(focus.y / texel) * texel;
    focus.applyMatrix4(lightMat);
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(this.lightDir, 1200);
    this.sun.target.updateMatrixWorld();
    // 陰影貼圖只在光源方向、焦點或範圍改變時重繪（環繞旋轉時不需重繪）
    const sig = `${this.lightDir.x.toFixed(4)},${this.lightDir.y.toFixed(4)},${this.lightDir.z.toFixed(4)},${focus.x.toFixed(2)},${focus.y.toFixed(2)},${focus.z.toFixed(2)},${shadowSize}`;
    if (sig !== this.shadowSig) { this.shadowSig = sig; this.renderer.shadowMap.needsUpdate = true; }

    // 半球光：天空色 / 地面反射
    const dayAmb = THREE.MathUtils.smoothstep(altDeg, -6, 10);
    this.hemi.intensity = 0.05 + 0.08 * dayAmb + 0.035 * this.night;
    this.hemi.color.setRGB(0.6 + 0.2 * dayAmb, 0.7 + 0.15 * dayAmb, 1.0);
    this.hemi.groundColor.setRGB(0.35, 0.3, 0.25);

    // 環境貼圖（由天空生成，節流更新）
    this.envTimer -= dt;
    if (this.envDirty && this.envTimer <= 0) {
      this.envRT?.dispose();
      this.envRT = this.pmrem.fromScene(this.envScene, 0, 1, 2000);
      this.scene.environment = this.envRT.texture;
      this.envDirty = false;
      this.envTimer = this.envInterval;
    }
    if (Math.abs(G.uTime.value % 3) < dt) this.envDirty = true; // 雲移動時偶爾更新
    this.scene.environmentIntensity = 0.3 + (1 - c.sun) * 0.4 + this.night * 2.3;

    // 霧（顏色依天光）
    const fogDay = new THREE.Color().setRGB(0.66, 0.73, 0.82).lerp(new THREE.Color(0.6, 0.62, 0.64), Math.min(1, c.cloud * 1.1)).multiplyScalar(0.35 + 0.65 * c.dim);
    if (altDeg < 12 && altDeg > -6) fogDay.lerp(new THREE.Color(0.85, 0.62, 0.45), (1 - Math.abs(altDeg - 3) / 9) * 0.5 * (1 - c.cloud));
    // 夜間霧色與天空地平線的城市光害一致，遠景自然融入夜空
    const fogNight = new THREE.Color(0.021, 0.0135, 0.0085).multiplyScalar(1 + c.cloud * 1.6);
    this.fog.color.copy(fogDay).multiplyScalar(0.5 + 0.5 * dayAmb).lerp(fogNight, this.night);
    this.fog.density = c.fog;

    // 星空與月亮
    (this.stars.material as THREE.ShaderMaterial).uniforms.uAlpha.value = this.night * (1 - c.cloud * 0.95);
    this.stars.position.copy(camera.position);
    this.moon.position.copy(camera.position).addScaledVector(this.moonDir, 12000);
    this.moon.visible = this.moonDir.y > -0.05;
    (this.moon.material as THREE.SpriteMaterial).opacity = (0.15 + 0.85 * this.night) * (1 - c.cloud * 0.9);
    this.moon.scale.setScalar(260);

    // 降雨 / 降雪
    const rm = this.rain.material as THREE.ShaderMaterial;
    rm.uniforms.uTime.value = G.uTime.value;
    rm.uniforms.uCam.value.copy(camera.position);
    rm.uniforms.uAlpha.value = c.rain * (0.55 + 0.35 * dayAmb);
    this.rain.visible = c.rain > 0.02;
    const sm = this.snow.material as THREE.ShaderMaterial;
    sm.uniforms.uTime.value = G.uTime.value;
    sm.uniforms.uCam.value.copy(camera.position);
    sm.uniforms.uAlpha.value = c.flakes * (0.5 + 0.5 * dayAmb);
    this.snow.visible = c.flakes > 0.02;

    // 夜間燈光
    if (this.lampGlow) this.lampGlow.opacity = this.night * 0.22;
    if (this.lampHeads) this.lampHeads.emissiveIntensity = this.night * 3;

    // 曝光：夜間提高以模擬人眼適應
    // 曝光由 Renderer 的自動曝光決定；這裡只保留陰天的少量補償
    this.exposure = 1 + (1 - c.sun) * 0.1;
  }
}

function moonTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,250,235,1)');
  g.addColorStop(0.18, 'rgba(250,245,230,1)');
  g.addColorStop(0.22, 'rgba(220,225,255,0.35)');
  g.addColorStop(1, 'rgba(200,210,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = 'rgba(180,175,160,0.35)';
  for (const [cx, cy, r] of [[58, 58, 5], [70, 66, 4], [62, 72, 3]]) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }
  void radialTexture;
  return new THREE.CanvasTexture(c);
}

function makeRain() {
  const N = 14000;
  const pos = new Float32Array(N * 6);
  const seed = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const x = Math.random() * 120 - 60, y = Math.random() * 60, z = Math.random() * 120 - 60;
    pos.set([x, y, z, x, y, z], i * 6);
    const s = Math.random();
    seed[i * 2] = s; seed[i * 2 + 1] = s;
  }
  const end = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { end[i * 2] = 0; end[i * 2 + 1] = 1; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; attribute float aEnd; uniform float uTime; uniform vec3 uCam; varying float vA;
      void main(){
        vec3 p = position;
        float speed = 22.0 + aSeed * 8.0;
        p.y = mod(p.y - uTime * speed, 60.0);
        p.x = mod(p.x - uCam.x + 60.0 + uTime * 2.0, 120.0) - 60.0 + uCam.x;
        p.z = mod(p.z - uCam.z + 60.0, 120.0) - 60.0 + uCam.z;
        p.y += uCam.y - 25.0;
        p += vec3(0.08, 0.9, 0.0) * aEnd * 0.9;
        vA = aEnd;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: 'uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(0.75,0.8,0.88, uAlpha * (0.25 + 0.5*vA)); }',
    transparent: true, depthWrite: false, fog: false,
  });
  const ls = new THREE.LineSegments(g, m);
  ls.frustumCulled = false;
  ls.visible = false;
  return ls;
}

function makeSnow() {
  const N = 12000;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos.set([Math.random() * 100 - 50, Math.random() * 50, Math.random() * 100 - 50], i * 3);
    seed[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform vec3 uCam;
      void main(){
        vec3 p = position;
        float sp = 1.0 + aSeed * 0.8;
        p.y = mod(p.y - uTime * sp, 50.0);
        p.x += sin(uTime * 0.7 + aSeed * 40.0) * 1.2 + uTime * 0.6;
        p.z += cos(uTime * 0.5 + aSeed * 23.0) * 1.2;
        p.x = mod(p.x - uCam.x + 50.0, 100.0) - 50.0 + uCam.x;
        p.z = mod(p.z - uCam.z + 50.0, 100.0) - 50.0 + uCam.z;
        p.y += uCam.y - 20.0;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(60.0 / -mv.z, 1.0, 9.0) * (0.6 + aSeed * 0.6);
      }`,
    fragmentShader: 'uniform float uAlpha; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, uAlpha * (1.0 - d * 2.0)); }',
    transparent: true, depthWrite: false, fog: false,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.visible = false;
  return p;
}
