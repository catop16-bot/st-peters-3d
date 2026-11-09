/**
 * 片頭大字：古羅馬碑刻風格（Cinzel）＋思源宋體副標，金線與菱形飾。
 * 以 2D canvas 繪製，可疊在即時畫面上，也可合成進錄影的每一格。
 */
const IN0 = 0.8, IN1 = 2.0, OUT0 = 3.4, OUT1 = 4.4;

export const TITLE_FONTS = [
  { family: 'Cinzel', url: 'fonts/cinzel-latin.woff2', weight: '400 700' },
  { family: 'Noto Serif TC Title', url: 'fonts/noto-serif-tc-title.woff2', weight: '500' },
];

export async function loadTitleFonts() {
  for (const f of TITLE_FONTS) {
    const face = new FontFace(f.family, `url(${import.meta.env.BASE_URL}${f.url})`, { weight: f.weight, display: 'block' });
    await face.load();
    document.fonts.add(face);
  }
  await document.fonts.load('600 110px Cinzel');
  await document.fonts.load('500 40px "Noto Serif TC Title"', '聖彼得大教堂');
}

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** 在 ctx 上（尺寸 w×h）繪製時間 t 的片頭；t 超出範圍時不畫 */
export function drawTitle(ctx: CanvasRenderingContext2D, t: number, w: number, h: number) {
  if (t < IN0 || t > OUT1) return;
  const a = smooth((t - IN0) / (IN1 - IN0)) * (1 - smooth((t - OUT0) / (OUT1 - OUT0)));
  if (a <= 0.001) return;
  const s = h / 1080; // 以 1080p 為基準縮放
  const settle = smooth((t - IN0) / (OUT1 - IN0));
  const cx = w / 2;
  const cy = h * 0.6 - 10 * s * settle;

  ctx.save();
  // 柔和暗角，讓字在明亮立面前仍清楚
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 760 * s);
  g.addColorStop(0, `rgba(10, 8, 6, ${0.42 * a})`);
  g.addColorStop(0.55, `rgba(10, 8, 6, ${0.22 * a})`);
  g.addColorStop(1, 'rgba(10, 8, 6, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const ivory = `rgba(246, 238, 220, ${a})`;
  const gold = `rgba(214, 182, 118, ${a})`;
  ctx.shadowColor = `rgba(60, 38, 12, ${0.55 * a})`;
  ctx.shadowBlur = 18 * s;

  // 上方小字
  let sp = setSpacing(ctx, (14 + 10 * (1 - settle)) * s);
  ctx.font = `500 ${26 * s}px Cinzel, "Times New Roman", serif`;
  ctx.fillStyle = gold;
  ctx.fillText('ROMA · CITTÀ DEL VATICANO', cx + sp / 2, cy - 92 * s);

  // 主標
  sp = setSpacing(ctx, (8 + 12 * (1 - settle)) * s);
  let size = 96 * s;
  ctx.font = `600 ${size}px Cinzel, "Times New Roman", serif`;
  const maxW = w * 0.84;
  const mw = ctx.measureText('BASILICA DI SAN PIETRO').width;
  if (mw > maxW) { size *= maxW / mw; ctx.font = `600 ${size}px Cinzel, "Times New Roman", serif`; }
  ctx.fillStyle = ivory;
  ctx.fillText('BASILICA DI SAN PIETRO', cx + sp / 2, cy - 6 * s);

  // 金線與菱形
  ctx.shadowBlur = 6 * s;
  const lw = 380 * s * (0.6 + 0.4 * smooth((t - IN0) / 1.6));
  const ly = cy + 66 * s;
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(cx - lw, ly); ctx.lineTo(cx - 18 * s, ly);
  ctx.moveTo(cx + 18 * s, ly); ctx.lineTo(cx + lw, ly);
  ctx.stroke();
  const diamond = (x: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x, ly - r); ctx.lineTo(x + r, ly); ctx.lineTo(x, ly + r); ctx.lineTo(x - r, ly); ctx.closePath();
    ctx.fillStyle = gold; ctx.fill();
  };
  diamond(cx, 7 * s);
  diamond(cx - lw - 8 * s, 3.5 * s);
  diamond(cx + lw + 8 * s, 3.5 * s);

  // 中文副標
  ctx.shadowBlur = 14 * s;
  sp = setSpacing(ctx, (18 + 10 * (1 - settle)) * s);
  ctx.font = `500 ${40 * s}px "Noto Serif TC Title", "Songti TC", serif`;
  ctx.fillStyle = ivory;
  ctx.fillText('聖彼得大教堂', cx + sp / 2, cy + 118 * s);
  ctx.restore();
}

/** 設定字距並回傳其值；置中時需右移半個字距，補償最後一字後多出的間距 */
function setSpacing(ctx: CanvasRenderingContext2D, px: number): number {
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px.toFixed(1)}px`;
  return px;
}
