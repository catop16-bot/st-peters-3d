import { EXHIBITS } from './Exhibits';
import type { TourController } from './TourController';

/** 內部導覽介面：展品目錄、解說卡、依序導覽、返回廣場 */
export class InteriorUI {
  private root: HTMLElement;
  private card: HTMLElement;
  private list: HTMLElement;
  private tourBtn: HTMLButtonElement;
  private tip: HTMLElement;
  onExit: (() => void) | null = null;

  constructor(private tour: TourController) {
    this.root = document.createElement('div');
    this.root.id = 'interior-ui';
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <div class="int-top">
        <div class="int-brand"><div class="t1">聖彼得大教堂</div><div class="t2">Interno della Basilica · 線上導覽</div></div>
        <button class="int-exit" id="int-exit">返回廣場</button>
      </div>
      <aside class="int-list"><div class="int-h">展品目錄</div><ol id="int-items"></ol>
        <button class="int-tour" id="int-tour">▶ 依序導覽</button></aside>
      <div class="int-card hidden" id="int-card">
        <div class="int-num" id="int-num"></div>
        <h2 id="int-title"></h2>
        <div class="int-sub" id="int-sub"></div>
        <p id="int-text"></p>
        <div class="int-nav"><button id="int-prev">‹ 上一件</button><button id="int-next">下一件 ›</button></div>
      </div>
      <div class="int-tip" id="int-tip"></div>
      <div class="int-hint">拖曳環視 · 點擊地面光圈或 <i>i</i> 前往展品 · 滾輪縮放 · ← → 切換展品</div>`;
    document.body.appendChild(this.root);
    this.card = this.root.querySelector('#int-card')!;
    this.list = this.root.querySelector('#int-items')!;
    this.tourBtn = this.root.querySelector('#int-tour')!;
    this.tip = this.root.querySelector('#int-tip')!;
    EXHIBITS.forEach((e, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span>${e.title.split(' ')[0]}`;
      li.addEventListener('click', () => { tour.stopAuto(); this.syncTour(); tour.goTo(i); });
      this.list.appendChild(li);
    });
    this.root.querySelector('#int-exit')!.addEventListener('click', () => this.onExit?.());
    this.root.querySelector('#int-prev')!.addEventListener('click', () => { tour.stopAuto(); this.syncTour(); tour.next(-1); });
    this.root.querySelector('#int-next')!.addEventListener('click', () => { tour.stopAuto(); this.syncTour(); tour.next(1); });
    this.tourBtn.addEventListener('click', () => {
      if (tour.autoTour) tour.stopAuto(); else tour.startAuto();
      this.syncTour();
    });
    tour.onSelect = (i) => this.show(i);
    tour.onHover = (i) => {
      if (i === null) { this.tip.classList.remove('on'); return; }
      this.tip.textContent = EXHIBITS[i].title;
      this.tip.classList.add('on');
    };
  }

  syncTour() { this.tourBtn.textContent = this.tour.autoTour ? '❚❚ 暫停導覽' : '▶ 依序導覽'; }

  show(i: number) {
    const e = EXHIBITS[i];
    (this.card.querySelector('#int-num') as HTMLElement).textContent = `${String(i + 1).padStart(2, '0')} / ${String(EXHIBITS.length).padStart(2, '0')}`;
    (this.card.querySelector('#int-title') as HTMLElement).textContent = e.title;
    (this.card.querySelector('#int-sub') as HTMLElement).textContent = e.subtitle;
    (this.card.querySelector('#int-text') as HTMLElement).textContent = e.text;
    this.card.classList.remove('hidden');
    this.card.classList.remove('in'); void this.card.offsetWidth; this.card.classList.add('in');
    this.list.querySelectorAll('li').forEach((li, k) => li.classList.toggle('on', k === i));
    this.syncTour();
  }

  setVisible(v: boolean) {
    this.root.classList.toggle('hidden', !v);
    if (!v) { this.card.classList.add('hidden'); this.list.querySelectorAll('li').forEach((li) => li.classList.remove('on')); }
  }
}
