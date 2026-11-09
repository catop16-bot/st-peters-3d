// 共用 GLSL 片段

export const NOISE_GLSL = /* glsl */ `
float enh_hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float enh_noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(enh_hash(i), enh_hash(i+vec2(1,0)), u.x), mix(enh_hash(i+vec2(0,1)), enh_hash(i+vec2(1,1)), u.x), u.y);
}
float enh_fbm(vec2 p){ float a=0.5, r=0.0; for(int i=0;i<3;i++){ r+=a*enh_noise(p); p*=2.03; a*=0.5; } return r * 1.14; }
`;

/**
 * 羅馬建築立面程序化圖樣
 * vFacade = (u 沿牆公尺, v 高度公尺, 牆段長, 建築高)
 * vMeta   = (seed, 是否有店面, 樣式, 一樓高)
 * 樣式：0 住宅/商業（灰泥+百葉窗）, 1 紀念性（教堂外牆：巨柱壁柱+大窗）, 2 柱廊走廊, 3 宮殿
 */
export const FACADE_GLSL = /* glsl */ `
varying vec4 vFacade;
varying vec3 vTint;
varying vec4 vMeta;

struct FacadeOut { vec3 albedo; float rough; float glass; float lit; float metal; };

float fcBox(vec2 p, vec2 lo, vec2 hi){ vec2 a = step(lo, p) * step(p, hi); return a.x*a.y; }
float fcBoxS(vec2 p, vec2 lo, vec2 hi, float s){
  vec2 a = smoothstep(lo-s, lo+s, p) * (1.0 - smoothstep(hi-s, hi+s, p)); return a.x*a.y;
}

FacadeOut facadePattern(vec3 baseAlbedo){
  FacadeOut o;
  float u = vFacade.x, v = vFacade.y, L = vFacade.z, H = vFacade.w;
  float seed = vMeta.x, shop = vMeta.y, style = vMeta.z, gH = vMeta.w;
  vec3 tint = vTint;
  o.albedo = baseAlbedo * tint;
  o.rough = 0.9; o.glass = 0.0; o.lit = 0.0; o.metal = 0.0;
  float aa = 0.025;

  if (style < 0.5) {
    // ── 住宅 / 商業 ──
    float stain = enh_fbm(vec2(u*0.12 + seed*31.0, v*0.18));
    o.albedo *= 0.86 + 0.24*stain;
    // 雨水垂直污痕
    float streak = enh_noise(vec2(u*1.7 + seed*5.0, v*0.05));
    o.albedo *= 1.0 - 0.12*smoothstep(0.6, 0.95, streak) * (1.0 - smoothstep(0.0, H, v));
    // 勒腳石
    float plinth = 1.0 - smoothstep(0.85, 0.9, v);
    o.albedo = mix(o.albedo, vec3(0.55,0.52,0.47)*baseAlbedo*1.25, plinth);
    // 簷口
    float corn = smoothstep(H-0.75, H-0.7, v);
    o.albedo = mix(o.albedo, o.albedo*1.18 + 0.03, corn);
    o.albedo *= 1.0 - 0.35*fcBoxS(vec2(0.0, v), vec2(-1.0, H-0.95), vec2(1.0, H-0.78), 0.02);

    float fH = 3.35;
    float fi = v < gH ? 0.0 : 1.0 + floor((v-gH)/fH);
    float fv = v < gH ? v : mod(v-gH, fH);
    // 樓層線腳
    if (v > gH - 0.25 && v < gH) o.albedo *= 1.08;

    float spacing = mix(3.2, 3.9, fract(seed*7.31));
    float n = max(1.0, floor(L / spacing));
    float s = L / n;
    float ci = floor(u / s);
    float cx = (fract(u / s) - 0.5) * s;
    float hw = 0.58;
    bool tallEnough = v < H - 1.25;
    float shutterGreen = step(0.45, fract(seed*3.7));
    vec3 shutterCol = mix(vec3(0.33,0.2,0.11), vec3(0.12,0.23,0.15), shutterGreen);

    if (L > 2.0 && tallEnough) {
      if (fi > 0.5) {
        vec2 p = vec2(cx, fv);
        float win = fcBoxS(p, vec2(-hw, 0.95), vec2(hw, 2.75), aa);
        float frame = fcBoxS(p, vec2(-hw-0.16, 0.8), vec2(hw+0.16, 2.92), aa) - win;
        float sill = fcBoxS(p, vec2(-hw-0.26, 0.78), vec2(hw+0.26, 0.92), aa);
        float h = enh_hash(vec2(ci + seed*17.0, fi));
        float closed = step(0.72, h);
        float sh = (fcBoxS(p, vec2(-hw-0.62, 0.95), vec2(-hw-0.02, 2.75), aa) + fcBoxS(p, vec2(hw+0.02, 0.95), vec2(hw+0.62, 2.75), aa)) * step(2.7, s) * (1.0 - closed);
        o.albedo = mix(o.albedo, o.albedo*1.22 + 0.05, clamp(frame + sill, 0.0, 1.0));
        o.albedo = mix(o.albedo, shutterCol * (0.8 + 0.2*step(0.5, fract(fv*9.0))), sh);
        float slats = 0.75 + 0.25*step(0.5, fract(fv*9.0));
        vec3 glassCol = mix(vec3(0.035,0.04,0.045), shutterCol*slats, closed);
        o.albedo = mix(o.albedo, glassCol, win);
        o.rough = mix(o.rough, mix(0.12, 0.8, closed), win);
        o.glass = win * (1.0 - closed);
        o.lit = win * (1.0 - closed) * step(0.6, enh_hash(vec2(ci*1.7 + seed*3.0, fi*2.3)));
        // 窗洞陰影
        o.albedo *= 1.0 - 0.45 * win * smoothstep(2.4, 2.75, fv);
      } else {
        vec2 p = vec2(cx, v);
        if (shop > 0.5) {
          float shw = min(1.45, s*0.42);
          float sf = fcBoxS(p, vec2(-shw, 0.12), vec2(shw, 3.2), aa);
          float fr = fcBoxS(p, vec2(-shw-0.12, 0.0), vec2(shw+0.12, 3.32), aa) - sf;
          float mull = (1.0 - step(0.06, abs(cx))) * step(1.0, v) * sf;
          vec3 inner = mix(vec3(0.05,0.045,0.04), vec3(0.12,0.1,0.08), enh_noise(vec2(u*3.0, v*2.0)));
          o.albedo = mix(o.albedo, vec3(0.06,0.06,0.065), clamp(fr + mull, 0.0, 1.0));
          o.albedo = mix(o.albedo, inner, sf * (1.0 - mull));
          o.rough = mix(o.rough, 0.1, sf);
          o.glass = sf;
          o.lit = sf * step(0.15, enh_hash(vec2(ci, seed)));
          o.metal = fr * 0.6;
        } else {
          float isDoor = step(0.78, enh_hash(vec2(ci + 3.0, seed)));
          if (isDoor > 0.5) {
            float d = fcBoxS(p, vec2(-0.85, 0.0), vec2(0.85, 3.3), aa);
            float arch = fcBoxS(p, vec2(-1.1, 0.0), vec2(1.1, 3.55), aa) - d;
            o.albedo = mix(o.albedo, vec3(0.62,0.58,0.5)*baseAlbedo*1.3, arch);
            o.albedo = mix(o.albedo, vec3(0.2,0.12,0.07)*(0.8+0.2*step(0.5,fract(cx*3.0))), d);
            o.rough = mix(o.rough, 0.6, d);
          } else {
            float w = fcBoxS(p, vec2(-0.55, 1.5), vec2(0.55, 3.1), aa);
            float bars = w * step(0.82, fract(cx*6.0));
            o.albedo = mix(o.albedo, vec3(0.04,0.045,0.05), w);
            o.albedo = mix(o.albedo, vec3(0.08), bars);
            o.glass = w*(1.0-bars);
            o.rough = mix(o.rough, 0.15, w);
            o.lit = w * step(0.8, enh_hash(vec2(ci*3.1, seed)));
          }
        }
      }
    }
  } else if (style < 1.5) {
    // ── 紀念性：米開朗基羅外牆（巨柱式壁柱、雙層窗、閣樓層）──
    float P = 9.2;
    float n = max(1.0, floor(L / P));
    float s = L / n;
    float cx = (fract(u / s) - 0.5) * s;
    float edge = s*0.5 - abs(cx);
    float pil = 1.0 - smoothstep(1.25, 1.3, edge);
    float pilCap = pil * fcBoxS(vec2(0.0,v), vec2(-1.0, 24.0), vec2(1.0, 26.8), 0.05);
    o.albedo *= mix(0.94, 1.08, pil);
    o.albedo *= 1.0 - 0.18*(1.0 - smoothstep(1.3, 1.6, edge)) * (1.0 - pil); // 壁柱側陰影
    o.albedo *= 1.0 - 0.12*pilCap*step(0.5, fract(v*2.5));
    // 檐部
    float ent = fcBoxS(vec2(0.0, v), vec2(-1.0, 26.8), vec2(1.0, 31.5), 0.04);
    o.albedo = mix(o.albedo, o.albedo*1.08, ent);
    o.albedo *= 1.0 - 0.3*fcBoxS(vec2(0.0, v), vec2(-1.0, 31.3), vec2(1.0, 31.7), 0.03);
    o.albedo *= 1.0 - 0.25*fcBoxS(vec2(0.0, v), vec2(-1.0, 28.3), vec2(1.0, 28.45), 0.02);
    // 主層窗（帶山花）與上層小窗
    vec2 p = vec2(cx, v);
    float w1 = fcBoxS(p, vec2(-1.5, 10.0), vec2(1.5, 17.5), aa) * step(2.0, edge);
    float f1 = fcBoxS(p, vec2(-2.0, 9.4), vec2(2.0, 19.2), aa) * step(2.0, edge) - w1;
    float w2 = fcBoxS(p, vec2(-1.1, 20.5), vec2(1.1, 23.2), aa) * step(2.0, edge);
    float w3 = fcBoxS(p, vec2(-1.2, 34.0), vec2(1.2, 39.0), aa) * step(2.0, edge);
    float f3 = fcBoxS(p, vec2(-1.6, 33.6), vec2(1.6, 39.6), aa) * step(2.0, edge) - w3;
    o.albedo = mix(o.albedo, o.albedo*1.15, clamp(f1+f3, 0.0, 1.0));
    float wins = clamp(w1+w2+w3, 0.0, 1.0);
    o.albedo = mix(o.albedo, vec3(0.03,0.03,0.035), wins);
    o.rough = mix(o.rough, 0.2, wins);
    o.glass = wins*0.6;
    // 閣樓頂簷
    o.albedo *= 1.0 - 0.3*fcBoxS(vec2(0.0, v), vec2(-1.0, H-1.6), vec2(1.0, H-1.3), 0.03);
    o.albedo *= 0.92 + 0.12*enh_fbm(vec2(u*0.08, v*0.06));
  } else if (style < 2.5) {
    // ── 貝尼尼廣場兩側直走廊（Braccio）──
    float P = 4.9;
    float n = max(1.0, floor(L / P));
    float s = L / n;
    float cx = (fract(u / s) - 0.5) * s;
    float edge = s*0.5 - abs(cx);
    float pil = 1.0 - smoothstep(0.7, 0.75, edge);
    o.albedo *= mix(0.93, 1.07, pil);
    vec2 p = vec2(cx, v);
    float w1 = fcBoxS(p, vec2(-0.9, 3.0), vec2(0.9, 7.6), aa) * step(1.3, edge);
    float w2 = fcBoxS(p, vec2(-0.7, 9.4), vec2(0.7, 11.8), aa) * step(1.3, edge);
    float wins = clamp(w1 + w2, 0.0, 1.0);
    o.albedo = mix(o.albedo, vec3(0.035), wins);
    o.rough = mix(o.rough, 0.2, wins);
    o.glass = wins * 0.6;
    o.lit = wins * step(0.7, enh_hash(vec2(floor(u/s), seed)));
    o.albedo *= 1.0 - 0.3*fcBoxS(vec2(0.0, v), vec2(-1.0, 13.0), vec2(1.0, 13.3), 0.03);
    o.albedo = mix(o.albedo, o.albedo*1.1, fcBoxS(vec2(0.0, v), vec2(-1.0, 13.3), vec2(1.0, 16.2), 0.03));
  } else {
    // ── 宮殿（梵蒂岡宗座宮等大型建築）──
    float fH = 4.6;
    float fi = floor(v / fH);
    float fv = mod(v, fH);
    float P = 4.2;
    float n = max(1.0, floor(L / P));
    float s = L / n;
    float ci = floor(u / s);
    float cx = (fract(u / s) - 0.5) * s;
    vec2 p = vec2(cx, fv);
    float w = fcBoxS(p, vec2(-0.7, 1.2), vec2(0.7, 3.5), aa) * step(2.4, L) * step(v, H - 1.5);
    float fr = fcBoxS(p, vec2(-0.9, 1.0), vec2(0.9, 3.8), aa) * step(2.4, L) * step(v, H - 1.5) - w;
    o.albedo *= 0.9 + 0.18*enh_fbm(vec2(u*0.1 + seed, v*0.12));
    o.albedo = mix(o.albedo, o.albedo*1.2 + 0.04, fr);
    o.albedo = mix(o.albedo, vec3(0.035,0.038,0.042), w);
    o.rough = mix(o.rough, 0.15, w);
    o.glass = w;
    o.lit = w * step(0.7, enh_hash(vec2(ci + seed*9.0, fi)));
    float corn = smoothstep(H-0.9, H-0.85, v);
    o.albedo = mix(o.albedo, o.albedo*1.15, corn);
  }
  return o;
}
`;
