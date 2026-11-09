import type { Weather } from '../env/Environment';

/** 宣傳片分鏡（座標：X 東、Z 南，原點方尖碑；單位公尺、秒） */
export type V3 = [number, number, number];

export interface Shot {
  id: string;
  name: string;
  start: number;
  end: number;
  /** 相機位置與注視點路徑（Catmull-Rom，至少兩點） */
  pos: V3[];
  target: V3[];
  fov?: number;
  /** 緩動：0 = 等速；1 = 完整緩入緩出 */
  ease?: number;
  date: [number, number, number]; // 年、月（0 起算）、日
  hours: [number, number]; // 起、訖（羅馬當地時間）
  /** 時刻變化的時間範圍（相對鏡頭起點，秒）；省略則整段 */
  hoursSpan?: [number, number];
  weather: Weather;
  surface: [number, number]; // [積雪, 潮濕]
}

export const DURATION = 30;
export const FADE_IN: [number, number] = [0, 1.0];
export const FADE_OUT: [number, number] = [28.8, 30];

export const SHOTS: Shot[] = [
  {
    id: 'dawn', name: '黎明・協和大道', start: 0, end: 5,
    // 協和大道中央分隔島（OSM 中線約 z = −0.033·x）
    pos: [[432, 3.2, -14.3], [398, 4.6, -13.1], [362, 6.4, -12.0]],
    target: [[-250, 62, 8], [-250, 64, 8], [-250, 66, 8]],
    fov: 42, ease: 0.3,
    date: [2026, 3, 15], hours: [7.75, 7.83], weather: 'clear', surface: [0, 0],
  },
  {
    id: 'reveal', name: '揭幕・廣場全景', start: 5, end: 8.5,
    pos: [[112, 10, 10], [128, 55, 22], [146, 112, 30]],
    target: [[-10, 9, 2], [-28, 4, 1], [-42, 0, 0]],
    fov: 50, ease: 0.6,
    date: [2026, 3, 15], hours: [8.5, 8.55], weather: 'clear', surface: [0, 0],
  },
  {
    id: 'centro', name: '柱廊之心', start: 8.5, end: 11.5,
    pos: [[0.9, 1.7, 27], [3.6, 1.7, 27], [6.9, 1.7, 27]],
    target: [[0.9, 7.5, 100], [1.4, 7.5, 100], [2.2, 7.5, 100]],
    fov: 55, ease: 0.5,
    date: [2026, 3, 15], hours: [10.5, 10.55], weather: 'clear', surface: [0, 0],
  },
  {
    id: 'fountain', name: '貝尼尼噴泉', start: 11.5, end: 14.5,
    pos: orbit([1, 58], 16, -32, 30, 1.5, 2.6, 5),
    target: [[-14, 5.5, 56], [-16, 6, 57], [-18, 6.5, 58]],
    fov: 46, ease: 0.35,
    date: [2026, 3, 15], hours: [12.5, 12.55], weather: 'cloudy', surface: [0, 0],
  },
  {
    id: 'dome', name: '米開朗基羅穹頂', start: 14.5, end: 18.5,
    pos: orbit([-321, 6], 135, 148, 200, 92, 104, 6),
    target: [[-321, 84, 6], [-321, 86, 6], [-321, 88, 6]],
    fov: 44, ease: 0.35,
    date: [2026, 3, 15], hours: [18.45, 18.5], weather: 'clear', surface: [0, 0],
  },
  {
    id: 'rain', name: '雨中台階', start: 18.5, end: 21.5,
    pos: [[-94, 1.6, -11], [-102, 1.75, -8.5], [-110, 1.95, -6]],
    target: [[-189, 21, 4], [-189, 22, 4], [-189, 23, 4]],
    fov: 50, ease: 0.3,
    date: [2026, 9, 20], hours: [10, 10.05], weather: 'rain', surface: [0, 1],
  },
  {
    id: 'snow', name: '冬雪', start: 21.5, end: 24.5,
    pos: [[48, 72, -118], [26, 68, -100], [4, 64, -82]],
    target: [[-150, 22, 0], [-155, 22, 2], [-160, 22, 4]],
    fov: 50, ease: 0.3,
    date: [2026, 0, 15], hours: [11, 11.05], weather: 'snow', surface: [1, 0.3],
  },
  {
    id: 'night', name: '夜色', start: 24.5, end: 30,
    pos: [[22, 6, 4.2], [70, 9, 4.2], [118, 12.5, 4.2], [140, 14, 4.2]],
    target: [[-189, 36, 4], [-189, 40, 4], [-189, 44, 4], [-189, 45, 4]],
    fov: 44, ease: 0.4,
    date: [2026, 3, 15], hours: [19.75, 21.5], hoursSpan: [0, 4.0], weather: 'clear', surface: [0, 0],
  },
];

/** 以圓心、半徑、起訖角度（度）產生環繞路徑點 */
function orbit(c: [number, number], r: number, a0: number, a1: number, y0: number, y1: number, n: number): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = ((a0 + (a1 - a0) * t) * Math.PI) / 180;
    out.push([c[0] + r * Math.cos(a), y0 + (y1 - y0) * t, c[1] + r * Math.sin(a)]);
  }
  return out;
}

/** 音效時間點（秒） */
export const CUES = {
  bells: [
    { t: 1.0, f0: 98, gain: 0.55, distant: false },
    { t: 5.5, f0: 147, gain: 0.4, distant: false },
    { t: 22.3, f0: 131, gain: 0.25, distant: true },
    { t: 26.5, f0: 110, gain: 0.5, distant: false },
  ],
};
