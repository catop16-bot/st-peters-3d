import type { Environment, Season, Weather } from '../env/Environment';
import { romeDate } from '../env/Environment';
import type { CameraRig } from '../controls/CameraRig';
import { VIEWPOINTS } from '../controls/CameraRig';
import type { Quality } from '../core/Renderer';
import { t as tr, setLang, onLang, applyLang, type Lang } from '../i18n';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const fmt = (h: number) => {
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

export class Panel {
  constructor(private env: Environment, private rig: CameraRig, private setQuality: (q: Quality) => void, quality: Quality) {
    const time = $<HTMLInputElement>('time');
    time.addEventListener('input', () => { env.setHours(parseFloat(time.value)); this.sync(); });

    const date = $<HTMLInputElement>('date');
    date.value = `${env.year}-${String(env.month + 1).padStart(2, '0')}-${String(env.day).padStart(2, '0')}`;
    date.addEventListener('change', () => {
      const [y, m, d] = date.value.split('-').map(Number);
      if (y && m && d) env.setDate(y, m - 1, d);
      this.sync();
    });

    $('flow').addEventListener('click', () => { env.timeFlow = env.timeFlow ? 0 : 2; this.sync(); });

    for (const b of document.querySelectorAll<HTMLButtonElement>('#presets .chip')) {
      b.addEventListener('click', () => {
        const t = env.sunTimes();
        const map: Record<string, number> = { sunrise: t.sunrise + 0.35, noon: t.noon, sunset: t.sunset - 0.3, night: (t.sunset + 2.2) % 24 };
        env.setHours(map[b.dataset.t!]);
        this.sync();
      });
    }
    for (const b of document.querySelectorAll<HTMLButtonElement>('#seasons .chip')) {
      b.addEventListener('click', () => { env.setSeason(b.dataset.s as Season); this.sync(); });
    }
    for (const b of document.querySelectorAll<HTMLButtonElement>('#weathers .chip')) {
      b.addEventListener('click', () => { env.setWeather(b.dataset.w as Weather); this.sync(); });
    }
    const views = $('views');
    const viewBtns = VIEWPOINTS.map((v) => {
      const btn = document.createElement('button');
      btn.addEventListener('click', () => rig.goTo(v));
      views.appendChild(btn);
      return btn;
    });
    const labelViews = () => viewBtns.forEach((b, i) => { b.textContent = tr(VIEWPOINTS[i].name, VIEWPOINTS[i].en); });
    labelViews();
    // 語言切換
    document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang as Lang)));
    onLang(() => { labelViews(); this.sync(); });
    applyLang();
    $('mode-orbit').addEventListener('click', () => rig.setMode('orbit'));
    $('mode-fly').addEventListener('click', () => rig.setMode('fly'));
    rig.onModeChange = () => this.sync();

    const qBtns = document.querySelectorAll<HTMLButtonElement>('#quality .chip');
    const markQ = (q: Quality) => qBtns.forEach((b) => b.classList.toggle('on', b.dataset.q === q));
    qBtns.forEach((b) => b.addEventListener('click', () => { setQuality(b.dataset.q as Quality); markQ(b.dataset.q as Quality); }));
    markQ(quality);

    $('panel-toggle').addEventListener('click', () => $('panel').classList.toggle('collapsed'));
    this.sheet();
    $('about-open').addEventListener('click', () => $('about').classList.remove('hidden'));
    $('about-close').addEventListener('click', () => $('about').classList.add('hidden'));
    $('about').addEventListener('click', (e) => { if (e.target === $('about')) $('about').classList.add('hidden'); });
    $('info-close').addEventListener('click', () => $('info').classList.add('hidden'));
    env.onChange = () => this.sync();
    if (window.innerWidth < 760) $('panel').classList.add('collapsed');
    this.sync();
  }

  sync() {
    const env = this.env;
    $<HTMLInputElement>('time').value = String(env.hours);
    $('clock-label').textContent = fmt(env.hours);
    const t = env.sunTimes();
    $('sunrise').textContent = `${tr('日出', 'Sunrise')} ${fmt(t.sunrise)}`;
    $('sunset').textContent = `${tr('日落', 'Sunset')} ${fmt(t.sunset)}`;
    $<HTMLInputElement>('date').value = `${env.year}-${String(env.month + 1).padStart(2, '0')}-${String(env.day).padStart(2, '0')}`;
    $('flow').classList.toggle('on', !!env.timeFlow);
    $('flow').textContent = env.timeFlow ? tr('❚❚ 暫停', '❚❚ Pause') : tr('▶ 流動', '▶ Run');
    document.querySelectorAll<HTMLButtonElement>('#seasons .chip').forEach((b) => b.classList.toggle('on', b.dataset.s === env.season));
    document.querySelectorAll<HTMLButtonElement>('#weathers .chip').forEach((b) => b.classList.toggle('on', b.dataset.w === env.weather));
    $('mode-orbit').classList.toggle('on', this.rig.mode === 'orbit');
    $('mode-fly').classList.toggle('on', this.rig.mode === 'fly');
    void romeDate;
  }

  tick() {
    if (this.env.timeFlow) {
      $<HTMLInputElement>('time').value = String(this.env.hours);
      $('clock-label').textContent = fmt(this.env.hours);
    }
  }

  /** 手機底部抽屜：拖曳把手上下拉，放開時依位置與速度停在展開或收合；輕點切換 */
  private sheet() {
    const panel = $('panel'), grip = $('sheet-grip');
    const mobile = () => window.matchMedia('(max-width: 760px)').matches;
    let startY = 0, startT = 0, base = 0, max = 0, lastY = 0, lastT = 0, vel = 0, moved = false, active = false;
    const peek = () => grip.offsetHeight;
    grip.addEventListener('pointerdown', (e) => {
      if (!mobile()) return;
      active = true; moved = false;
      try { grip.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
      max = panel.offsetHeight - peek();
      base = panel.classList.contains('collapsed') ? max : 0;
      startY = lastY = e.clientY; startT = lastT = performance.now(); vel = 0;
      panel.classList.add('dragging');
    });
    grip.addEventListener('pointermove', (e) => {
      if (!active) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 4) moved = true;
      const now = performance.now();
      vel = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY; lastT = now;
      const y = Math.min(max, Math.max(0, base + dy));
      panel.style.transform = `translateY(${y}px)`;
    });
    const end = (e: PointerEvent) => {
      if (!active) return;
      active = false;
      panel.classList.remove('dragging');
      panel.style.transform = '';
      if (!moved) { panel.classList.toggle('collapsed'); return; }
      const y = Math.min(max, Math.max(0, base + (e.clientY - startY)));
      const collapse = vel > 0.5 ? true : vel < -0.5 ? false : y > max / 2;
      panel.classList.toggle('collapsed', collapse);
      void startT;
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    grip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); panel.classList.toggle('collapsed'); } });
  }

  showInfo(title: string, text: string) {
    $('info-title').textContent = title;
    $('info-text').textContent = text;
    $('info').classList.remove('hidden');
    // 手機：顯示說明時收起控制抽屜，讓說明卡停在畫面下方
    if (window.matchMedia('(max-width: 760px)').matches) $('panel').classList.add('collapsed');
  }
}
