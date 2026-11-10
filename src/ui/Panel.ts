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

  showInfo(title: string, text: string) {
    $('info-title').textContent = title;
    $('info-text').textContent = text;
    $('info').classList.remove('hidden');
  }
}
