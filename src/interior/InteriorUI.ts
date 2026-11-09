import * as THREE from 'three';
import { EXHIBITS, ZONES } from './exhibitsData';
import type { TourController } from './TourController';
import { IN } from './Interior';
import { ScanViewer } from './ScanViewer';

const FEATURED = EXHIBITS.map((e, i) => (e.featured ? i : -1)).filter((i) => i >= 0);
const ALL = EXHIBITS.map((_, i) => i);

/** 平面圖座標：u = −z（入內後右側在右）、v = x（入口在下） */
const U = (z: number) => -z, V = (x: number) => x;

/** 內部導覽介面：分區展品目錄、精選 / 完整路線、解說卡（含資料來源）、小平面圖、返回廣場 */
export class InteriorUI {
  private root: HTMLElement;
  private card: HTMLElement;
  private list: HTMLElement;
  private btnFeat: HTMLButtonElement;
  private btnAll: HTMLButtonElement;
  private tip: HTMLElement;
  private me: SVGGElement;
  private dots: SVGCircleElement[] = [];
  private scanViewer: ScanViewer | null = null;
  private current = -1;
  onExit: (() => void) | null = null;

  constructor(private tour: TourController) {
    this.root = document.createElement('div');
    this.root.id = 'interior-ui';
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <div class="int-top">
        <div class="int-brand"><div class="t1">聖彼得大教堂</div><div class="t2">Interno della Basilica · 線上導覽</div></div>
        <div class="int-actions"><button class="int-exit int-menu" id="int-menu">目錄</button><button class="int-exit" id="int-exit">返回廣場</button></div>
      </div>
      <aside class="int-list">
        <div class="int-h">展品目錄 <span class="int-count">${EXHIBITS.length} 件</span></div>
        <div class="int-tours"><button class="int-tour" id="int-feat">▶ 精選 ${FEATURED.length} 件</button><button class="int-tour" id="int-all">▶ 完整路線</button></div>
        <div class="int-scroll" id="int-items"></div>
      </aside>
      <div class="int-map" id="int-map"></div>
      <div class="int-card hidden" id="int-card">
        <button class="int-fold" id="int-fold" aria-label="收合解說">⌄</button>
        <div class="int-num" id="int-num"></div>
        <h2 id="int-title"></h2>
        <div class="int-sub" id="int-sub"></div>
        <p id="int-text"></p>
        <button class="int-scan hidden" id="int-scan">◎ 真實 3D 掃描</button>
        <div class="int-src" id="int-src"></div>
        <div class="int-nav"><button id="int-prev">‹ 上一件</button><button id="int-next">下一件 ›</button></div>
      </div>
      <div class="int-tip" id="int-tip"></div>
      <div class="int-hint">拖曳環視 · 點擊地面光圈、<i>i</i> 或平面圖上的點前往展品 · 滾輪縮放 · ← → 切換展品</div>`;
    document.body.appendChild(this.root);
    this.card = this.root.querySelector('#int-card')!;
    this.list = this.root.querySelector('#int-items')!;
    this.btnFeat = this.root.querySelector('#int-feat')!;
    this.btnAll = this.root.querySelector('#int-all')!;
    this.tip = this.root.querySelector('#int-tip')!;

    // 分區目錄（可收合）
    for (const z of ZONES) {
      const items = EXHIBITS.map((e, i) => ({ e, i })).filter(({ e }) => e.zone === z.id);
      if (!items.length) continue;
      const sec = document.createElement('details');
      sec.open = true;
      sec.innerHTML = `<summary>${z.name}<span>${items.length}</span></summary>`;
      const ol = document.createElement('ol');
      for (const { e, i } of items) {
        const li = document.createElement('li');
        li.dataset.i = String(i);
        li.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${e.title.replace(/ [A-Z].*$/, '')}</span>${e.featured ? '<span class="star">★</span>' : ''}`;
        li.addEventListener('click', () => { tour.stopAuto(); this.syncTour(); this.closeDrawer(); tour.goTo(i); });
        ol.appendChild(li);
      }
      sec.appendChild(ol);
      this.list.appendChild(sec);
    }
    this.me = this.buildMap();

    this.root.querySelector('#int-exit')!.addEventListener('click', () => this.onExit?.());
    // 手機：目錄抽屜、解說卡收合
    this.root.querySelector('#int-menu')!.addEventListener('click', () => this.root.classList.toggle('drawer-open'));
    this.root.querySelector('#int-fold')!.addEventListener('click', () => this.card.classList.toggle('min'));
    this.root.querySelector('#int-scan')!.addEventListener('click', () => {
      const sc = EXHIBITS[this.current]?.scan;
      if (!sc) return;
      tour.stopAuto(); this.syncTour();
      (this.scanViewer ??= new ScanViewer()).open(sc);
    });
    this.root.querySelector('#int-prev')!.addEventListener('click', () => { tour.stopAuto(); this.syncTour(); tour.next(-1); });
    this.root.querySelector('#int-next')!.addEventListener('click', () => { tour.stopAuto(); this.syncTour(); tour.next(1); });
    const toggle = (route: number[]) => {
      const same = tour.autoTour && tour.route.length === route.length;
      if (same) tour.stopAuto(); else { tour.stopAuto(); tour.startAuto(route); }
      this.syncTour();
    };
    this.btnFeat.addEventListener('click', () => { toggle(FEATURED); this.closeDrawer(); });
    this.btnAll.addEventListener('click', () => { toggle(ALL); this.closeDrawer(); });
    tour.onSelect = (i) => this.show(i);
    tour.onHover = (i) => {
      if (i === null) { this.tip.classList.remove('on'); return; }
      this.tip.textContent = EXHIBITS[i].title;
      this.tip.classList.add('on');
    };
  }

  private buildMap(): SVGGElement {
    const NS = 'http://www.w3.org/2000/svg';
    const W = IN.halfW, apseC = Math.abs(IN.apseEnd) - W, trC = IN.transeptEnd - W;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `${-IN.vestibule - 2} ${IN.apseEnd - 2} ${2 * IN.vestibule + 4} ${IN.porticoX1 - IN.apseEnd + 4}`);
    const path = (d: string, cls: string) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', cls); svg.appendChild(p); };
    const rect = (x0: number, x1: number, z0: number, z1: number) => `M${U(z0)} ${V(x0)} L${U(z1)} ${V(x0)} L${U(z1)} ${V(x1)} L${U(z0)} ${V(x1)} Z`;
    // 外廓：中殿＋側廊、交叉部、三臂與半圓殿、柱廊
    const circ = (x: number, z: number, r: number, cls: string) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', String(U(z))); c.setAttribute('cy', String(V(x))); c.setAttribute('r', String(r)); c.setAttribute('class', cls); svg.appendChild(c); };
    path(rect(IN.pierOuter, IN.naveEnd, -IN.aisleOuter, IN.aisleOuter), 'm-fill');
    path(rect(-apseC, IN.pierOuter, -W, W), 'm-fill');
    path(rect(-W, W, -trC, trC), 'm-fill');
    path(rect(-IN.pierOuter, IN.pierOuter, -IN.pierOuter, IN.pierOuter), 'm-fill');
    path(rect(IN.naveEnd + IN.wallT, IN.porticoX1, -IN.vestibule, IN.vestibule), 'm-fill');
    circ(-apseC, 0, W, 'm-fill'); circ(0, trC, W, 'm-fill'); circ(0, -trC, W, 'm-fill');
    circ(40, -24.9, 6.2, 'm-dome'); circ(40, 24.9, 6.2, 'm-dome');
    const dome = document.createElementNS(NS, 'circle');
    dome.setAttribute('cx', '0'); dome.setAttribute('cy', '0'); dome.setAttribute('r', String(IN.domeR)); dome.setAttribute('class', 'm-dome');
    svg.appendChild(dome);
    EXHIBITS.forEach((e, i) => {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', String(U(e.look[2]))); c.setAttribute('cy', String(V(e.look[0])));
      c.setAttribute('r', '3.2'); c.setAttribute('class', 'm-dot');
      const t = document.createElementNS(NS, 'title'); t.textContent = e.title; c.appendChild(t);
      c.addEventListener('click', () => { this.tour.stopAuto(); this.syncTour(); this.closeDrawer(); this.tour.goTo(i); });
      svg.appendChild(c);
      this.dots.push(c);
    });
    const me = document.createElementNS(NS, 'g');
    me.setAttribute('class', 'm-me');
    me.innerHTML = '<path d="M0 -7 L4.5 4 L0 2 L-4.5 4 Z"/>';
    svg.appendChild(me);
    this.root.querySelector('#int-map')!.appendChild(svg);
    return me;
  }

  private closeDrawer() { this.root.classList.remove('drawer-open'); }

  /** 每幀更新小平面圖上的目前位置與朝向 */
  update() {
    const p = this.tour.position;
    // yaw = 0 時鏡頭朝 −z（平面圖的右方）
    const deg = 90 - THREE.MathUtils.radToDeg(this.tour.heading);
    this.me.setAttribute('transform', `translate(${U(p.z)} ${V(p.x)}) rotate(${deg})`);
  }

  syncTour() {
    const on = this.tour.autoTour, featured = on && this.tour.route.length === FEATURED.length;
    this.btnFeat.textContent = on && featured ? '❚❚ 暫停' : `▶ 精選 ${FEATURED.length} 件`;
    this.btnAll.textContent = on && !featured ? '❚❚ 暫停' : '▶ 完整路線';
  }

  show(i: number) {
    const e = EXHIBITS[i];
    this.current = i;
    const scanBtn = this.card.querySelector('#int-scan') as HTMLElement;
    scanBtn.classList.add('hidden');
    if (e.scan) ScanViewer.available(e.scan.url).then((ok) => { if (ok && this.current === i) scanBtn.classList.remove('hidden'); });
    (this.card.querySelector('#int-num') as HTMLElement).textContent = `${String(i + 1).padStart(2, '0')} / ${String(EXHIBITS.length).padStart(2, '0')} · ${ZONES.find((z) => z.id === e.zone)!.name}`;
    (this.card.querySelector('#int-title') as HTMLElement).textContent = e.title;
    (this.card.querySelector('#int-sub') as HTMLElement).textContent = e.subtitle;
    (this.card.querySelector('#int-text') as HTMLElement).textContent = e.text;
    const src = this.card.querySelector('#int-src') as HTMLElement;
    src.innerHTML = '資料來源：';
    e.sources.forEach((u, k) => {
      const a = document.createElement('a');
      a.href = u; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = u.includes('wikipedia') ? 'Wikipedia' : `St. Peter's Basilica.info${e.sources.length > 1 ? ` ${k + 1}` : ''}`;
      src.appendChild(a);
    });
    this.card.classList.remove('hidden', 'min');
    this.card.classList.remove('in'); void this.card.offsetWidth; this.card.classList.add('in');
    this.list.querySelectorAll('li').forEach((li) => {
      const on = Number((li as HTMLElement).dataset.i) === i;
      li.classList.toggle('on', on);
      if (on) { (li.closest('details') as HTMLDetailsElement).open = true; li.scrollIntoView({ block: 'nearest' }); }
    });
    this.dots.forEach((d, k) => d.classList.toggle('on', k === i));
    this.syncTour();
  }

  setVisible(v: boolean) {
    this.root.classList.toggle('hidden', !v);
    if (!v) { this.card.classList.add('hidden'); this.list.querySelectorAll('li').forEach((li) => li.classList.remove('on')); }
  }
}
