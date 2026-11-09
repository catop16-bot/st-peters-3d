import * as THREE from 'three';
import { NOISE_GLSL, FACADE_GLSL } from './shaderChunks';

/** 所有材質共用的環境 uniform（季節、天氣、夜晚） */
export const G = {
  uTime: { value: 0 },
  uSnow: { value: 0 },
  uWet: { value: 0 },
  uNight: { value: 0 },
  uFloodColor: { value: new THREE.Color(0.82, 0.6, 0.36) },
  uLeafColor: { value: new THREE.Color(0.22, 0.32, 0.12) },
  uGrassColor: { value: new THREE.Color(0.26, 0.36, 0.14) },
};

export interface TexSet { map: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture; }

export interface EnhanceOptions {
  tex?: TexSet;
  scale?: number; // 每公尺重複次數
  normalScale?: number;
  snow?: boolean;
  wet?: boolean;
  flood?: number; // 夜間投光強度
  grime?: boolean; // 石材風化污痕
  facade?: boolean;
  ground?: boolean; // 地面：雨天積水
  water?: boolean;
  foliage?: boolean;
  grass?: boolean;
  macro?: number; // 大尺度色彩變化
  piazza?: boolean; // 聖彼得廣場鋪面圖樣
  inlay?: boolean; // 教堂內部多色大理石拼花地面
  coffer?: { axis: 'x' | 'z'; spring: number; radius: number; center: number }; // 筒形拱鍍金藻井
  domeMosaic?: { cx: number; cz: number; y0: number; y1: number }; // 穹頂內部馬賽克分格
}

const loader = new THREE.TextureLoader();
let maxAniso = 8;
export function setMaxAnisotropy(n: number) { maxAniso = n; }

const texCache = new Map<string, TexSet>();
/** 低畫質（手機）改用 512 px 貼圖，下載量約為 1/4 */
let texTier = '';
export function setTextureTier(low: boolean) { texTier = low ? '512/' : ''; }
export function loadTexSet(name: string, onLoad?: () => void): TexSet {
  const hit = texCache.get(name);
  if (hit) return hit;
  let pending = 3;
  const done = () => { if (--pending === 0) onLoad?.(); };
  const base = `${import.meta.env.BASE_URL}textures/${name}/${texTier}`;
  const mk = (file: string, srgb: boolean) => {
    const t = loader.load(base + file, done, undefined, done);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    t.name = name; // 供匯出（Blender）辨識貼圖組
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const set = { map: mk('color.jpg', true), normal: mk('normalgl.jpg', false), rough: mk('roughness.jpg', false) };
  texCache.set(name, set);
  return set;
}

/** 在 MeshStandardMaterial 內注入：三平面貼圖、積雪、潮濕、夜間投光、立面圖樣 */
export function enhance<T extends THREE.MeshStandardMaterial>(mat: T, opt: EnhanceOptions = {}): T {
  const o = { snow: true, wet: true, ...opt };
  const defines: string[] = [];
  if (o.tex) defines.push('ENH_TRI');
  if (o.snow) defines.push('ENH_SNOW');
  if (o.wet) defines.push('ENH_WET');
  if (o.flood) defines.push('ENH_FLOOD');
  if (o.grime) defines.push('ENH_GRIME');
  if (o.facade) defines.push('ENH_FACADE');
  if (o.ground) defines.push('ENH_GROUND');
  if (o.water) defines.push('ENH_WATER');
  if (o.foliage) defines.push('ENH_FOLIAGE');
  if (o.grass) defines.push('ENH_GRASS');
  if (o.macro) defines.push('ENH_MACRO');
  if (o.piazza) defines.push('ENH_PIAZZA');
  if (o.inlay) defines.push('ENH_INLAY');
  if (o.coffer) defines.push('ENH_COFFER', o.coffer.axis === 'z' ? 'COFFER_AXIS_Z' : 'COFFER_AXIS_X');
  if (o.domeMosaic) defines.push('ENH_DOME');
  const key = defines.join('|');
  // 記錄參數，供匯出到 Blender 時重建材質
  mat.userData.enh = {
    tex: o.tex?.map.name, scale: o.scale ?? 0.4, normalScale: o.normalScale ?? 1.0, macro: o.macro ?? 0,
    facade: !!o.facade, grass: !!o.grass, foliage: !!o.foliage,
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, G);
    shader.uniforms.tpScale = { value: o.scale ?? 0.4 };
    shader.uniforms.tpNormalScale = { value: o.normalScale ?? 1.0 };
    shader.uniforms.uFlood = { value: o.flood ?? 0 };
    shader.uniforms.uMacro = { value: o.macro ?? 0 };
    shader.uniforms.uCoffer = { value: new THREE.Vector3(o.coffer?.spring ?? 0, o.coffer?.radius ?? 1, o.coffer?.center ?? 0) };
    shader.uniforms.uDome = { value: new THREE.Vector4(o.domeMosaic?.cx ?? 0, o.domeMosaic?.cz ?? 0, o.domeMosaic?.y0 ?? 0, o.domeMosaic?.y1 ?? 1) };
    if (o.tex) {
      shader.uniforms.tpMap = { value: o.tex.map };
      shader.uniforms.tpNormal = { value: o.tex.normal };
      shader.uniforms.tpRough = { value: o.tex.rough };
    }
    const defs = defines.map((d) => `#define ${d}\n`).join('');

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
${defs}
varying vec3 vWPos;
varying vec3 vWNormal;
#ifdef ENH_FACADE
attribute vec4 aFacade;
attribute vec3 aTint;
attribute vec4 aMeta;
varying vec4 vFacade;
varying vec3 vTint;
varying vec4 vMeta;
#endif
#ifdef ENH_FOLIAGE
uniform float uTime;
#endif`)
      .replace('#include <project_vertex>', `
#ifdef ENH_FOLIAGE
  {
    vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      wp0 = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    #endif
    float sway = sin(uTime*1.3 + wp0.x*0.21 + wp0.z*0.17) * 0.05 * max(transformed.y - 2.0, 0.0) / 10.0;
    transformed.x += sway;
  }
#endif
#include <project_vertex>
{
  vec4 enhWP = vec4(transformed, 1.0);
  vec3 enhN = objectNormal;
  #ifdef USE_INSTANCING
    enhWP = instanceMatrix * enhWP;
    enhN = mat3(instanceMatrix) * enhN;
  #endif
  enhWP = modelMatrix * enhWP;
  vWPos = enhWP.xyz;
  vWNormal = normalize(mat3(modelMatrix) * enhN);
  #ifdef ENH_FACADE
    vFacade = aFacade; vTint = aTint; vMeta = aMeta;
  #endif
}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
${defs}
varying vec3 vWPos;
varying vec3 vWNormal;
uniform float uTime, uSnow, uWet, uNight, uFlood, uMacro, tpScale, tpNormalScale;
uniform vec3 uFloodColor, uLeafColor, uGrassColor;
uniform vec3 uCoffer;
uniform vec4 uDome;
#ifdef ENH_TRI
uniform sampler2D tpMap, tpNormal, tpRough;
#endif
${NOISE_GLSL}
#ifdef ENH_FACADE
${FACADE_GLSL}
#endif
float pzLine(float d, float w){ float fw = fwidth(d) * 1.2 + 0.01; return 1.0 - smoothstep(w * 0.5, w * 0.5 + fw, d); }
vec3 enhBlend(vec3 n){ vec3 b = pow(abs(n), vec3(4.0)); return b / (b.x + b.y + b.z + 1e-5); }
`)
      .replace('#include <map_fragment>', `#include <map_fragment>
vec3 enhN = normalize(vWNormal);
float enhUp = enhN.y;
float enhGlass = 0.0;
float enhLit = 0.0;
float enhMetal = -1.0;
float enhRoughMul = 1.0;
#ifdef ENH_TRI
  vec3 tpW = enhBlend(enhN);
  vec2 uvX = vWPos.zy * tpScale, uvY = vWPos.xz * tpScale, uvZ = vWPos.xy * tpScale;
  vec3 tcol = texture2D(tpMap, uvX).rgb * tpW.x + texture2D(tpMap, uvY).rgb * tpW.y + texture2D(tpMap, uvZ).rgb * tpW.z;
  enhRoughMul = texture2D(tpRough, uvX).g * tpW.x + texture2D(tpRough, uvY).g * tpW.y + texture2D(tpRough, uvZ).g * tpW.z;
  diffuseColor.rgb *= tcol;
#endif
#ifdef ENH_MACRO
  diffuseColor.rgb *= 1.0 + uMacro * (enh_noise(vWPos.xz * 0.035 + vWPos.y*0.02) * 0.7 + enh_noise(vWPos.xz * 0.11) * 0.3 - 0.5);
#endif
float enhPiazza = 0.0;
#ifdef ENH_PIAZZA
  {
    vec2 p = vWPos.xz;
    float r = length(p);
    float m = 0.0;
    // 方尖碑基座平台
    m = max(m, 1.0 - step(5.8, max(abs(p.x), abs(p.y))));
    // 同心環
    m = max(m, pzLine(abs(r - 13.8), 0.45));
    m = max(m, pzLine(abs(r - 16.6), 0.45));
    m = max(m, pzLine(abs(r - 19.5), 0.45));
    if (r > 5.8 && r < 13.8) {
      m = max(m, pzLine(abs(abs(p.x) - abs(p.y)) * 0.7071, 0.35));
      m = max(m, pzLine(abs(p.x), 0.35));
      m = max(m, pzLine(abs(p.y), 0.35));
    }
    // 外緣線（與柱廊平行，內縮約 8 m）
    float rs = length(p - vec2(0.9, 27.0)), rn = length(p - vec2(0.9, -27.0));
    float inside = p.y > 27.0 ? step(rs, 61.5) : (p.y < -27.0 ? step(rn, 61.5) : step(abs(p.x - 0.9), 61.5));
    float bd = p.y > 27.0 ? abs(rs - 61.5) : (p.y < -27.0 ? abs(rn - 61.5) : abs(abs(p.x - 0.9) - 61.5));
    m = max(m, pzLine(bd, 0.55));
    // 8 條放射帶（每條由兩道平行石帶構成）
    if (r > 19.5 && inside > 0.5) {
      for (int k = 0; k < 8; k++) {
        float a = float(k) * 0.785398;
        vec2 d = vec2(cos(a), sin(a));
        float along = dot(p, d);
        float perp = d.x * p.y - d.y * p.x;
        if (along > 0.0) m = max(m, pzLine(abs(abs(perp) - 6.0), 0.4));
      }
    }
    // 噴泉外環
    m = max(m, pzLine(abs(length(p - vec2(-2.0, -61.0)) - 8.4), 0.45));
    m = max(m, pzLine(abs(length(p - vec2(1.0, 58.0)) - 8.4), 0.45));
    // 梵蒂岡國界白線（兩柱廊端點之間）
    m = max(m, pzLine(abs(p.x - 84.0), 0.5) * step(abs(p.y), 52.0));
    m *= step(p.x, 86.0);
    enhPiazza = m;
    vec3 trav = vec3(0.78, 0.74, 0.66) * (0.9 + 0.2 * enh_noise(p * 3.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, trav, m);
    // 斑岩「柱廊中心」圓盤
    float disc = max(1.0 - step(0.62, length(p - vec2(0.9, 27.0))), 1.0 - step(0.62, length(p - vec2(0.9, -27.0))));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.12, 0.1), disc);
    enhPiazza = max(enhPiazza, disc);
  }
#endif
#ifdef ENH_INLAY
  {
    // 多色大理石拼花：14 m 一格（約等於中殿一個開間），深色分隔帶、白框、斜帶、黃色環、斑岩圓心
    vec2 f = (fract(vWPos.xz / 14.0) - 0.5) * 14.0;
    float r = length(f);
    float box = max(abs(f.x), abs(f.y));
    float L = dot(diffuseColor.rgb, vec3(0.333));
    vec3 col = diffuseColor.rgb;
    float band = step(6.25, box);
    float frame = step(5.3, box) * (1.0 - band);
    float ring = step(2.55, r) * (1.0 - step(3.15, r));
    float disc = 1.0 - step(2.2, r);
    float diag = (1.0 - step(0.28, abs(abs(f.x) - abs(f.y)) * 0.7071)) * step(3.15, r) * (1.0 - step(5.3, box));
    // 色彩取自實際石材：灰綠蛇紋岩、白色卡拉拉、古黃（giallo antico）、斑岩紅，皆偏低飽和
    col = mix(col, vec3(0.34, 0.36, 0.33) * (0.7 + L * 0.5), band);
    col = mix(col, vec3(0.9, 0.88, 0.84) * (0.8 + L * 0.25), frame);
    col = mix(col, vec3(0.74, 0.63, 0.45) * (0.75 + L * 0.35), ring);
    col = mix(col, vec3(0.45, 0.22, 0.19) * (0.75 + L * 0.35), disc);
    col = mix(col, vec3(0.52, 0.53, 0.49) * (0.75 + L * 0.35), diag);
    diffuseColor.rgb = col;
    enhRoughMul *= 0.3; // 拋光大理石
  }
#endif
#ifdef ENH_COFFER
  if (vWPos.y > uCoffer.x + 0.3) {
    // 筒形拱藻井：a 為沿拱軸座標，s 為沿拱弧長
    #ifdef COFFER_AXIS_Z
      float a = vWPos.z; float lat = vWPos.x - uCoffer.z;
    #else
      float a = vWPos.x; float lat = vWPos.z - uCoffer.z;
    #endif
    float s = atan(vWPos.y - uCoffer.x, lat) * uCoffer.y;
    vec2 g = vec2(a, s) / 3.6;
    vec2 q = abs(fract(g) - 0.5) * 3.6;
    float edge = max(q.x, q.y);
    float rim = smoothstep(1.4, 1.5, edge);
    float inner = 1.0 - smoothstep(1.05, 1.2, edge);
    float ros = 1.0 - smoothstep(0.32, 0.42, length(fract(g) - 0.5) * 3.6);
    vec3 stucco = vec3(0.95, 0.92, 0.85);
    vec3 col = mix(stucco * 0.72, stucco, inner);
    float gold = max(rim, ros);
    col = mix(col, vec3(0.95, 0.74, 0.36), gold);
    diffuseColor.rgb = col * (0.9 + 0.2 * dot(diffuseColor.rgb, vec3(0.33)));
    enhMetal = gold * 0.85;
    enhRoughMul *= mix(1.0, 0.4, gold);
  }
#endif
#ifdef ENH_DOME
  {
    // 穹頂內部：16 條鍍金肋、6 層藍金相間的馬賽克分格與圓章
    vec2 d = vWPos.xz - uDome.xy;
    float ang = atan(d.y, d.x) / 6.2831853 * 16.0;
    float t = clamp((vWPos.y - uDome.z) / (uDome.w - uDome.z), 0.0, 1.0);
    float tier = t * 6.0;
    float fa = abs(fract(ang) - 0.5);
    float ft = abs(fract(tier) - 0.5);
    float rib = 1.0 - smoothstep(0.035, 0.05, 0.5 - fa);
    rib = 1.0 - step(0.06, 0.5 - fa);
    float tierLine = 1.0 - step(0.05, 0.5 - ft);
    float medal = 1.0 - smoothstep(0.16, 0.19, length(vec2(fa - 0.0, (ft) * 0.9)));
    vec3 blue = vec3(0.12, 0.2, 0.42), gold = vec3(0.95, 0.74, 0.36);
    float even = mod(floor(tier), 2.0);
    vec3 panel = mix(blue, gold * 0.85, even * 0.35);
    vec3 col = mix(panel, gold, max(rib, tierLine));
    col = mix(col, mix(gold, blue * 1.3, even), medal * (1.0 - max(rib, tierLine)));
    diffuseColor.rgb = col * (0.85 + 0.25 * dot(diffuseColor.rgb, vec3(0.33)));
    enhMetal = max(rib, tierLine) * 0.8;
    enhRoughMul *= 0.5;
  }
#endif
#ifdef ENH_GRIME
  {
    float st = enh_noise(vec2((vWPos.x + vWPos.z) * 0.9, vWPos.y * 0.04));
    float g = smoothstep(0.55, 0.95, st) * 0.22 + (1.0 - smoothstep(0.0, 6.0, vWPos.y)) * 0.1;
    g += (1.0 - abs(enhUp)) * 0.08 * enh_noise(vWPos.xz * 0.2 + vWPos.y * 0.3);
    diffuseColor.rgb *= 1.0 - g;
  }
#endif
#ifdef ENH_FACADE
  {
    FacadeOut fo = facadePattern(diffuseColor.rgb);
    float isWall = 1.0 - step(0.6, abs(enhUp));
    diffuseColor.rgb = mix(diffuseColor.rgb * vTint, fo.albedo, isWall);
    enhGlass = fo.glass * isWall;
    enhLit = fo.lit * isWall;
    if (isWall > 0.5) { enhRoughMul *= fo.rough / 0.9; enhMetal = fo.metal; }
  }
#endif
#ifdef ENH_FOLIAGE
  diffuseColor.rgb *= uLeafColor * (0.75 + 0.5 * enh_noise(vWPos.xz * 0.9 + vWPos.y));
#endif
#ifdef ENH_GRASS
  diffuseColor.rgb *= uGrassColor * (0.75 + 0.4 * enh_fbm(vWPos.xz * 0.3));
#endif
float enhSnow = 0.0;
#ifdef ENH_SNOW
  if (uSnow > 0.001) {
    float n = enh_fbm(vWPos.xz * 0.6 + vWPos.y * 0.2);
    float cover = smoothstep(0.45, 0.8, enhUp + (n - 0.5) * 0.5 * (1.0 - uSnow) + uSnow * 0.25);
    enhSnow = cover * smoothstep(0.0, 0.35, uSnow - (1.0 - n) * 0.3);
    #ifdef ENH_WATER
      enhSnow *= 0.0;
    #endif
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.9, 0.94), enhSnow);
  }
#endif
float enhWetM = 0.0;
float enhPuddle = 0.0;
#ifdef ENH_WET
  enhWetM = uWet * (0.45 + 0.55 * smoothstep(0.2, 0.9, enhUp)) * (1.0 - enhSnow);
  #ifdef ENH_GROUND
    if (uWet > 0.001) enhPuddle = uWet * smoothstep(0.58, 0.72, enh_fbm(vWPos.xz * 0.12)) * step(0.95, enhUp) * (1.0 - enhSnow);
  #endif
  diffuseColor.rgb *= 1.0 - 0.3 * enhWetM - 0.2 * enhPuddle;
#endif
`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor *= enhRoughMul;
roughnessFactor = mix(roughnessFactor, 0.6, enhPiazza);
#ifdef ENH_SNOW
  roughnessFactor = mix(roughnessFactor, 0.8, enhSnow);
#endif
#ifdef ENH_WET
  roughnessFactor = mix(roughnessFactor, 0.18, enhWetM * 0.75);
  roughnessFactor = mix(roughnessFactor, 0.03, enhPuddle);
#endif
roughnessFactor = clamp(roughnessFactor, 0.03, 1.0);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
if (enhMetal >= 0.0) metalnessFactor = max(metalnessFactor, enhMetal);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
#ifdef ENH_TRI
  {
    vec3 tnX = texture2D(tpNormal, uvX).xyz * 2.0 - 1.0;
    vec3 tnY = texture2D(tpNormal, uvY).xyz * 2.0 - 1.0;
    vec3 tnZ = texture2D(tpNormal, uvZ).xyz * 2.0 - 1.0;
    float ns = tpNormalScale * (1.0 - enhSnow * 0.8) * (1.0 - enhPuddle) * (1.0 - 0.85 * enhPiazza);
    tnX.xy *= ns; tnY.xy *= ns; tnZ.xy *= ns;
    tnX = vec3(tnX.xy + enhN.zy, abs(tnX.z) * enhN.x);
    tnY = vec3(tnY.xy + enhN.xz, abs(tnY.z) * enhN.y);
    tnZ = vec3(tnZ.xy + enhN.xy, abs(tnZ.z) * enhN.z);
    vec3 wn = normalize(tnX.zyx * tpW.x + tnY.xzy * tpW.y + tnZ.xyz * tpW.z);
    normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  }
#endif
#ifdef ENH_WATER
  {
    vec2 q = vWPos.xz * 0.9;
    float t = uTime;
    float e = 0.15;
    float h0 = enh_noise(q + t*0.6) + 0.5*enh_noise(q*2.3 - t*0.9);
    float hx = enh_noise(q + vec2(e,0.0) + t*0.6) + 0.5*enh_noise((q+vec2(e,0.0))*2.3 - t*0.9);
    float hz = enh_noise(q + vec2(0.0,e) + t*0.6) + 0.5*enh_noise((q+vec2(0.0,e))*2.3 - t*0.9);
    vec3 wn = normalize(vec3(-(hx-h0)/e*0.08, 1.0, -(hz-h0)/e*0.08));
    normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  }
#endif`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef ENH_FLOOD
  {
    float face = 0.55 + 0.45 * max(0.0, 1.0 - abs(enhUp));
    float fall = mix(1.0, 0.55, clamp(vWPos.y / 140.0, 0.0, 1.0));
    totalEmissiveRadiance += diffuseColor.rgb * uFloodColor * uNight * uFlood * face * fall;
  }
#endif
#ifdef ENH_FACADE
  totalEmissiveRadiance += vec3(1.0, 0.68, 0.36) * enhLit * uNight * 1.5;
#endif`);
  };
  mat.customProgramCacheKey = () => key + (o.tex ? o.tex.map.uuid : '') + (o.coffer ? JSON.stringify(o.coffer) : '') + (o.domeMosaic ? 'dome' : '');
  return mat;
}

/** 材質庫 */
export class MaterialLibrary {
  travertine!: THREE.MeshStandardMaterial;
  travertineSmooth!: THREE.MeshStandardMaterial;
  statue!: THREE.MeshStandardMaterial;
  lead!: THREE.MeshStandardMaterial;
  leadRib!: THREE.MeshStandardMaterial;
  dark!: THREE.MeshStandardMaterial;
  glass!: THREE.MeshStandardMaterial;
  bronze!: THREE.MeshStandardMaterial;
  gilded!: THREE.MeshStandardMaterial;
  granite!: THREE.MeshStandardMaterial;
  sampietrini!: THREE.MeshStandardMaterial;
  piazzaPaving!: THREE.MeshStandardMaterial;
  slab!: THREE.MeshStandardMaterial;
  plaster!: THREE.MeshStandardMaterial; // 立面圖樣（OSM 建築）
  stoneFacade!: THREE.MeshStandardMaterial; // 石灰華 + 立面圖樣（教堂外牆、宮殿）
  roofTiles!: THREE.MeshStandardMaterial;
  roofFlat!: THREE.MeshStandardMaterial;
  asphalt!: THREE.MeshStandardMaterial;
  sidewalk!: THREE.MeshStandardMaterial;
  grass!: THREE.MeshStandardMaterial;
  water!: THREE.MeshStandardMaterial;
  foliage!: THREE.MeshStandardMaterial;
  bark!: THREE.MeshStandardMaterial;
  ironDark!: THREE.MeshStandardMaterial;
  lampGlow!: THREE.MeshStandardMaterial;
  wood!: THREE.MeshStandardMaterial;

  constructor(onProgress: () => void) {
    const trav = loadTexSet('Travertine009', onProgress);
    const sampi = loadTexSet('PavingStones046', onProgress);
    const slabs = loadTexSet('PavingStones128', onProgress);
    const tiles = loadTexSet('RoofingTiles006', onProgress);
    const plas = loadTexSet('Plaster001', onProgress);

    const travColor = new THREE.Color(0.84, 0.75, 0.6); // 羅馬石灰華：暖米黃
    this.travertine = enhance(new THREE.MeshStandardMaterial({ color: travColor, roughness: 0.85 }), {
      tex: trav, scale: 0.33, normalScale: 0.9, flood: 0.55, grime: true, macro: 0.25,
    });
    this.travertineSmooth = enhance(new THREE.MeshStandardMaterial({ color: travColor, roughness: 0.8 }), {
      tex: trav, scale: 0.5, normalScale: 0.6, flood: 0.55, grime: true,
    });
    this.statue = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.8, 0.74, 0.62), roughness: 0.85 }), {
      tex: trav, scale: 0.8, normalScale: 0.8, flood: 0.5, grime: true,
    });
    this.lead = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.58, 0.6, 0.62), roughness: 0.5, metalness: 0.2 }), {
      tex: plas, scale: 0.25, normalScale: 0.35, flood: 0.35, macro: 0.3,
    });
    this.leadRib = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.8, 0.78, 0.72), roughness: 0.7, metalness: 0.15 }), {
      tex: trav, scale: 0.6, normalScale: 0.5, flood: 0.45,
    });
    this.dark = enhance(new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.9 }), { snow: false });
    this.glass = enhance(new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.08, metalness: 0.2 }), { snow: false });
    this.bronze = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.32, 0.22, 0.12), roughness: 0.45, metalness: 0.85 }), { flood: 0.3 });
    this.gilded = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.95, 0.72, 0.32), roughness: 0.3, metalness: 1.0 }), { flood: 0.4, snow: false });
    this.granite = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.76, 0.68), roughness: 0.6 }), {
      tex: trav, scale: 1.2, normalScale: 0.5, flood: 0.6, grime: true,
    });
    this.sampietrini = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.42, 0.42, 0.44), roughness: 0.95 }), {
      tex: sampi, scale: 0.7, normalScale: 1.2, ground: true, macro: 0.35,
    });
    this.piazzaPaving = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.4, 0.4, 0.42), roughness: 0.95 }), {
      tex: sampi, scale: 0.7, normalScale: 1.2, ground: true, macro: 0.3, piazza: true,
    });
    this.slab = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.8, 0.75, 0.66), roughness: 0.8 }), {
      tex: slabs, scale: 0.4, normalScale: 0.8, ground: true, flood: 0.15,
    });
    this.plaster = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.88, 0.85), roughness: 0.92 }), {
      tex: plas, scale: 0.3, normalScale: 0.7, facade: true,
    });
    this.stoneFacade = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.86, 0.78, 0.64), roughness: 0.88 }), {
      tex: trav, scale: 0.33, normalScale: 0.9, facade: true, flood: 0.55, grime: true,
    });
    this.roofTiles = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.95, 0.85, 0.8), roughness: 0.85 }), {
      tex: tiles, scale: 0.45, normalScale: 1.0, macro: 0.5,
    });
    this.roofFlat = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.5, 0.46), roughness: 0.95 }), {
      tex: plas, scale: 0.3, normalScale: 0.4, macro: 0.4,
    });
    this.asphalt = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.2, 0.21), roughness: 0.92 }), {
      tex: plas, scale: 0.5, normalScale: 0.4, ground: true, macro: 0.4,
    });
    this.sidewalk = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.85, 0.8, 0.72), roughness: 0.85 }), {
      tex: slabs, scale: 0.6, normalScale: 0.6, ground: true,
    });
    this.grass = enhance(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), { grass: true, ground: true });
    this.water = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.05, 0.09, 0.08), roughness: 0.04, metalness: 0.1 }), {
      water: true, snow: false, wet: false,
    });
    this.foliage = enhance(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: false }), { foliage: true });
    this.bark = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.28, 0.22, 0.17), roughness: 0.95 }), {});
    this.ironDark = enhance(new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.8 }), {});
    this.lampGlow = new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: new THREE.Color(1.0, 0.8, 0.5), emissiveIntensity: 0, roughness: 0.3 });
    this.wood = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.25, 0.15, 0.08), roughness: 0.7 }), {});
  }
}
