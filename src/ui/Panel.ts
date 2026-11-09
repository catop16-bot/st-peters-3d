import type { Environment, Season, Weather } from '../env/Environment';
import { romeDate } from '../env/Environment';
import type { CameraRig } from '../controls/CameraRig';
import { VIEWPOINTS } from '../controls/CameraRig';
import type { Quality } from '../core/Renderer';

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
    for (const v of VIEWPOINTS) {
      const btn = document.createElement('button');
      btn.textContent = v.name;
      btn.addEventListener('click', () => rig.goTo(v));
      views.appendChild(btn);
    }
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
    $('sunrise').textContent = `日出 ${fmt(t.sunrise)}`;
    $('sunset').textContent = `日落 ${fmt(t.sunset)}`;
    $<HTMLInputElement>('date').value = `${env.year}-${String(env.month + 1).padStart(2, '0')}-${String(env.day).padStart(2, '0')}`;
    $('flow').classList.toggle('on', !!env.timeFlow);
    $('flow').textContent = env.timeFlow ? '❚❚ 暫停' : '▶ 流動';
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
