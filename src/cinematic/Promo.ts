import * as THREE from 'three';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { Environment } from '../env/Environment';
import type { Renderer } from '../core/Renderer';
import { Director } from './Director';
import { DURATION, SHOTS } from './shots';
import { drawTitle, loadTitleFonts } from './TitleCard';
import { renderSoundtrack, SAMPLE_RATE } from './Soundtrack';

/** main.ts 的算圖迴圈掛勾：宣傳片模式下由導演接管相機與曝光 */
export interface FrameHooks {
  camera: ((dt: number) => void) | null;
  exposureMul: number;
  paused: boolean;
}

export interface PromoDeps {
  env: Environment;
  R: Renderer;
  camera: THREE.PerspectiveCamera;
  controlsTarget: THREE.Vector3;
  frame: (dt: number) => void;
  hooks: FrameHooks;
}

const W = 1920, H = 1080, FPS = 60;

/** 讓出執行緒；背景分頁中 setTimeout 會被節流到 ≥1 秒，MessageChannel 不會 */
const yieldNow = () => new Promise<void>((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });

function hideUI() {
  for (const id of ['brand', 'panel', 'hint', 'info', 'about']) document.getElementById(id)?.classList.add('hidden');
}

function overlayButton(label: string, onClick: () => void) {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;padding:14px 26px;font:600 16px "Noto Sans TC",sans-serif;letter-spacing:.2em;color:#f1eadb;background:rgba(18,16,14,.7);border:1px solid rgba(217,184,113,.6);border-radius:999px;cursor:pointer;backdrop-filter:blur(10px)';
  b.addEventListener('click', () => { b.remove(); onClick(); });
  document.body.appendChild(b);
  return b;
}

/** 即時預覽：同步播放合成音軌 */
export async function startPromoPreview(d: PromoDeps) {
  hideUI();
  await loadTitleFonts();
  const director = new Director(d.env, d.camera);
  director.onCut = () => d.R.autoExposure.snap();
  const overlay = document.createElement('canvas');
  overlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:4';
  document.body.appendChild(overlay);
  const octx = overlay.getContext('2d')!;
  let audio: AudioBuffer | null = null;
  let t0 = 0;
  let ac: AudioContext | null = null;
  let playing = false;
  let held = 0.0001; // 未播放時停留的時間點（供 seek 檢查畫面）

  const play = async () => {
    audio ??= await renderSoundtrack();
    ac ??= new AudioContext({ sampleRate: SAMPLE_RATE });
    await ac.resume();
    const src = ac.createBufferSource();
    src.buffer = audio;
    src.connect(ac.destination);
    director.reset();
    t0 = ac.currentTime + 0.05;
    src.start(t0);
    playing = true;
  };
  d.hooks.camera = () => {
    const t = playing && ac ? Math.min(DURATION, ac.currentTime - t0) : held;
    d.hooks.exposureMul = director.apply(Math.max(0.0001, t));
    d.controlsTarget.copy(director.target);
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (overlay.width !== Math.round(innerWidth * dpr)) { overlay.width = Math.round(innerWidth * dpr); overlay.height = Math.round(innerHeight * dpr); }
    octx.clearRect(0, 0, overlay.width, overlay.height);
    drawTitle(octx, t, overlay.width, overlay.height);
    if (playing && t >= DURATION) {
      playing = false;
      overlayButton('↻ 重新播放', play);
    }
  };
  overlayButton('▶ 播放宣傳片', play);
  (window as unknown as { __promo: unknown }).__promo = { director, seek: (t: number) => { director.reset(); held = Math.max(0.0001, t); } };
}

/** 離線逐格錄製 → MP4（H.264 + AAC/Opus），存到 output/promo.mp4 */
export async function recordPromo(d: PromoDeps) {
  hideUI();
  const status = document.createElement('div');
  status.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:40;font:13px ui-monospace,monospace;color:#f1eadb;background:rgba(0,0,0,.6);padding:8px 12px;border-radius:8px';
  document.body.appendChild(status);
  const say = (s: string) => { status.textContent = s; (window as unknown as { __recStatus: string }).__recStatus = s; };
  try {
    say('準備字體與音軌…');
    await loadTitleFonts();
    const audio = await renderSoundtrack();

    // 鎖定輸出解析度與畫質
    d.hooks.paused = true;
    d.R.setQuality('high');
    d.R.setFixedSize({ w: W, h: H });
    d.R.setShadowMapSize(d.env.sun);
    d.env.envInterval = 1 / 30;
    const director = new Director(d.env, d.camera);
    director.onCut = () => d.R.autoExposure.snap();
    d.R.autoExposure.every = 1; // 錄影時每幀測光，結果可重現
    d.hooks.camera = null;
    let lastShot = -1;
    const step = (t: number, dt: number) => {
      d.hooks.camera = () => { d.hooks.exposureMul = director.apply(t); d.controlsTarget.copy(director.target); };
      // 硬切的那一格先算一次測光，讓輸出的第一格就有正確曝光
      const si = director.shotAt(t);
      if (si !== lastShot) { lastShot = si; d.frame(0); }
      d.frame(dt);
    };

    // 預熱：每個鏡頭先算幾格，讓著色器編譯、陰影與環境貼圖就緒
    say('預熱各鏡頭…');
    for (const s of SHOTS) {
      director.reset();
      lastShot = -1;
      for (let k = 0; k < 6; k++) step(s.start + 0.2 + k / FPS, 1 / FPS);
      await yieldNow();
    }
    director.reset();
    lastShot = -1;

    // 編碼器
    const vCodecs = ['avc1.64002A', 'avc1.640033', 'avc1.4D402A'];
    let vConfig: VideoEncoderConfig | null = null;
    // 優先軟體編碼：硬體編碼器在分頁未置前時可能暫停輸出
    outer: for (const hw of ['prefer-software', 'no-preference'] as HardwareAcceleration[]) {
      for (const codec of vCodecs) {
        const cfg: VideoEncoderConfig = { codec, width: W, height: H, bitrate: 24_000_000, framerate: FPS, avc: { format: 'avc' }, latencyMode: 'quality', hardwareAcceleration: hw };
        if ((await VideoEncoder.isConfigSupported(cfg)).supported) { vConfig = cfg; break outer; }
      }
    }
    if (!vConfig) throw new Error('此瀏覽器不支援 H.264 編碼');
    let aCodec: 'aac' | 'opus' = 'aac';
    let aConfig: AudioEncoderConfig = { codec: 'mp4a.40.2', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 192_000 };
    if (!(await AudioEncoder.isConfigSupported(aConfig)).supported) {
      aCodec = 'opus';
      aConfig = { codec: 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: 2, bitrate: 192_000 };
    }
    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H, frameRate: FPS },
      audio: { codec: aCodec, numberOfChannels: 2, sampleRate: SAMPLE_RATE },
      fastStart: 'in-memory',
    });
    let encErr: unknown = null;
    const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: (e) => { encErr = e; } });
    venc.configure(vConfig);
    const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: (e) => { encErr = e; } });
    aenc.configure(aConfig);

    // 音訊
    const L = audio.getChannelData(0), Rch = audio.getChannelData(1);
    const block = 1024;
    for (let i = 0; i < audio.length; i += block) {
      const n = Math.min(block, audio.length - i);
      const data = new Float32Array(n * 2);
      data.set(L.subarray(i, i + n), 0);
      data.set(Rch.subarray(i, i + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SAMPLE_RATE, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / SAMPLE_RATE) * 1e6), data });
      aenc.encode(ad);
      ad.close();
    }

    // 視訊：WebGL 畫面 + 片頭合成到 2D 畫布
    const comp = document.createElement('canvas');
    comp.width = W; comp.height = H;
    const cctx = comp.getContext('2d')!;
    const gl = d.R.renderer.domElement;
    const total = DURATION * FPS;
    const tStart = performance.now();
    for (let i = 0; i < total; i++) {
      if (encErr) throw encErr;
      const t = i / FPS;
      step(t, 1 / FPS);
      cctx.drawImage(gl, 0, 0, W, H);
      drawTitle(cctx, t, W, H);
      const vf = new VideoFrame(comp, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(vf, { keyFrame: i % FPS === 0 });
      vf.close();
      while (venc.encodeQueueSize > 6) {
        await new Promise<void>((r) => { const done = () => { venc.removeEventListener('dequeue', done); r(); }; venc.addEventListener('dequeue', done); });
      }
      if (i % 15 === 0) {
        const el = (performance.now() - tStart) / 1000;
        say(`錄製中（${vConfig.hardwareAcceleration}）${i}/${total} 格（${((i / total) * 100).toFixed(0)}%）· 已用 ${el.toFixed(0)} 秒`);
        await yieldNow();
      }
    }
    say('完成編碼，封裝中…');
    await venc.flush();
    await aenc.flush();
    if (encErr) throw encErr;
    muxer.finalize();
    const buf = (muxer.target as ArrayBufferTarget).buffer;
    say(`上傳 ${(buf.byteLength / 1e6).toFixed(1)} MB…`);
    const res = await fetch(`${import.meta.env.BASE_URL}__save-video?name=promo.mp4`, { method: 'POST', body: buf });
    const info = await res.json();
    say(`完成：${info.file}（${(info.bytes / 1e6).toFixed(1)} MB，音訊 ${aCodec.toUpperCase()}）`);
    d.R.setFixedSize(null);
    d.hooks.paused = false;
  } catch (e) {
    console.error(e);
    say('錄製失敗：' + ((e as Error)?.message ?? e));
  }
}
