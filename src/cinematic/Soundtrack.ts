import { DURATION, SHOTS, CUES } from './shots';

/**
 * 以 Web Audio 離線合成 30 秒環境音軌（全部程式生成，無任何外部音樂素材）。
 * 風聲、鳥鳴、噴泉、雨聲、教堂鐘聲與和聲墊音，依分鏡時間自動化。
 */
export const SAMPLE_RATE = 48000;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseBuffer(ctx: BaseAudioContext, seconds: number, pink: boolean, seed: number) {
  const n = Math.floor(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const rnd = mulberry(seed + ch * 977);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd() * 2 - 1;
      if (!pink) { d[i] = w; continue; }
      // Paul Kellet 粉紅噪音濾波
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

const shot = (id: string) => SHOTS.find((s) => s.id === id)!;

/** 依 [時間, 值] 設定增益曲線；cut = true 時在該點快速切換（配合硬切） */
function automate(p: AudioParam, pts: [number, number][], ramp = 0.06) {
  p.setValueAtTime(pts[0][1], 0);
  for (let i = 1; i < pts.length; i++) {
    const [t, v] = pts[i];
    const [tp] = pts[i - 1];
    if (t - tp <= ramp + 0.001) { p.setValueAtTime(pts[i - 1][1], Math.max(0, t - ramp)); p.linearRampToValueAtTime(v, t); }
    else p.linearRampToValueAtTime(v, t);
  }
}

export async function renderSoundtrack(): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, DURATION * SAMPLE_RATE, SAMPLE_RATE);
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
  master.connect(comp).connect(ctx.destination);
  automate(master.gain, [[0, 0], [1.2, 0.9], [28.6, 0.9], [30, 0]]);

  const pinkBuf = noiseBuffer(ctx, DURATION, true, 11);
  const whiteBuf = noiseBuffer(ctx, DURATION, false, 23);
  const src = (buf: AudioBuffer) => { const s = ctx.createBufferSource(); s.buffer = buf; s.start(0); return s; };

  // ── 風聲（全片底噪，依鏡頭強弱與音色變化）──
  {
    const s = src(pinkBuf);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
    const g = ctx.createGain();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start(0);
    const D = shot('dome'), S = shot('snow'), R = shot('rain'), N = shot('night');
    automate(lp.frequency, [[0, 420], [D.start, 420], [D.start + 0.01, 900], [D.end, 900], [D.end + 0.01, 420], [S.start, 420], [S.start + 0.01, 230], [S.end, 230], [S.end + 0.01, 360]]);
    automate(g.gain, [[0, 0.32], [5, 0.3], [8.5, 0.18], [shot('fountain').start, 0.16], [D.start, 0.16], [D.start + 0.06, 0.5], [D.end, 0.5], [R.start, 0.5], [R.start + 0.06, 0.12], [S.start, 0.12], [S.start + 0.06, 0.42], [S.end, 0.42], [N.start, 0.42], [N.start + 0.06, 0.16], [30, 0.1]]);
    s.connect(lp).connect(g).connect(master);
  }

  // ── 晨鳥（第 1–2 鏡，FM 短促掃頻）──
  {
    const rnd = mulberry(5);
    for (let k = 0; k < 16; k++) {
      const t0 = 0.6 + rnd() * 7.2;
      const pan = ctx.createStereoPanner(); pan.pan.value = rnd() * 1.6 - 0.8;
      const notes = 2 + Math.floor(rnd() * 3);
      for (let j = 0; j < notes; j++) {
        const t = t0 + j * (0.09 + rnd() * 0.05);
        const o = ctx.createOscillator(); o.type = 'sine';
        const f = 3200 + rnd() * 1800;
        o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.25 + rnd() * 0.3), t + 0.06);
        const fm = ctx.createOscillator(); fm.frequency.value = 55 + rnd() * 40;
        const fmg = ctx.createGain(); fmg.gain.value = 260;
        fm.connect(fmg).connect(o.frequency);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.045, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
        o.connect(g).connect(pan); o.start(t); o.stop(t + 0.1); fm.start(t); fm.stop(t + 0.1);
      }
      pan.connect(master);
    }
  }

  // ── 噴泉（第 4 鏡）──
  {
    const F = shot('fountain');
    const s = src(whiteBuf);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.5;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
    const g = ctx.createGain();
    automate(g.gain, [[0, 0], [F.start, 0], [F.start + 0.06, 0.22], [F.end - 0.5, 0.34], [F.end, 0.34], [F.end + 0.06, 0]]);
    s.connect(bp).connect(hp).connect(g).connect(master);
  }

  // ── 雨（第 6 鏡）：嘶嘶聲 + 隨機雨滴 ──
  {
    const R = shot('rain');
    const s = src(whiteBuf);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    const g = ctx.createGain();
    automate(g.gain, [[0, 0], [R.start, 0], [R.start + 0.06, 0.3], [R.end, 0.3], [R.end + 0.06, 0]]);
    s.connect(hp).connect(lp).connect(g).connect(master);
    const rnd = mulberry(77);
    const drop = noiseBuffer(ctx, 0.05, false, 99);
    for (let k = 0; k < 90; k++) {
      const t = R.start + rnd() * (R.end - R.start);
      const b = ctx.createBufferSource(); b.buffer = drop;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500 + rnd() * 3500; f.Q.value = 4;
      const dg = ctx.createGain(); dg.gain.setValueAtTime(0.25 * rnd(), t); dg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      const p = ctx.createStereoPanner(); p.pan.value = rnd() * 2 - 1;
      b.connect(f).connect(dg).connect(p).connect(master); b.start(t); b.stop(t + 0.05);
    }
  }

  // ── 和聲墊音：D 大調 → B 小調（雨雪）→ D add9（夜）──
  {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.3;
    const padBus = ctx.createGain(); padBus.gain.value = 1;
    lp.connect(padBus).connect(master);
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const chord = (notes: number[], t0: number, t1: number, peak: number, attack: number, release: number) => {
      for (const n of notes) for (const det of [-6, 5]) {
        const o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.value = hz(n); o.detune.value = det;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(peak, t0 + attack);
        g.gain.setValueAtTime(peak, Math.max(t0 + attack, t1 - release)); g.gain.linearRampToValueAtTime(0, t1);
        o.connect(g).connect(lp); o.start(t0); o.stop(t1 + 0.05);
      }
    };
    const R = shot('rain'), N = shot('night');
    chord([50, 57, 62, 66, 69], 0, R.start + 1.2, 0.022, 4.0, 2.0); // D
    chord([47, 54, 59, 62, 66], R.start - 0.8, N.start + 1.0, 0.02, 1.5, 1.8); // Bm
    chord([50, 57, 62, 64, 66, 69], N.start - 0.6, 30, 0.024, 2.2, 3.2); // Dadd9
    // 高音閃爍（夜景）
    for (let k = 0; k < 6; k++) {
      const t = N.start + 0.8 + k * 0.62;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz([81, 78, 76, 74, 76, 74][k]);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.018, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.6);
      o.connect(g).connect(master); o.start(t); o.stop(t + 1.7);
    }
  }

  // ── 教堂鐘聲（加法合成，非諧和泛音）──
  {
    const partials: [number, number, number][] = [
      // [頻率比, 相對振幅, 衰減秒數]
      [0.5, 0.55, 7.5], [1.0, 1.0, 5.5], [1.183, 0.55, 4.0], [1.506, 0.4, 3.2], [2.0, 0.45, 3.0],
      [2.514, 0.22, 2.2], [2.662, 0.18, 2.0], [3.011, 0.14, 1.6], [4.166, 0.1, 1.1],
    ];
    for (const b of CUES.bells) {
      const out = ctx.createGain(); out.gain.value = b.gain;
      let node: AudioNode = out;
      if (b.distant) {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
        out.connect(lp); node = lp;
      }
      // 簡易殘響：兩道回授延遲
      const dry = ctx.createGain(); dry.gain.value = 1;
      const wet = ctx.createGain(); wet.gain.value = 0.35;
      const d1 = ctx.createDelay(1); d1.delayTime.value = 0.137;
      const d2 = ctx.createDelay(1); d2.delayTime.value = 0.211;
      const fb = ctx.createGain(); fb.gain.value = 0.45;
      node.connect(dry).connect(master);
      node.connect(d1); d1.connect(d2); d2.connect(fb).connect(d1); d2.connect(wet).connect(master);
      for (const [ratio, amp, decay] of partials) {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = b.f0 * 2 * ratio;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, b.t); g.gain.linearRampToValueAtTime(amp * 0.12, b.t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, Math.min(DURATION, b.t + decay));
        o.connect(g).connect(out); o.start(b.t); o.stop(Math.min(DURATION, b.t + decay + 0.05));
      }
    }
  }

  return ctx.startRendering();
}
