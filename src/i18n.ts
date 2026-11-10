/**
 * 中英雙語：
 * - 靜態 HTML 以 `.zh` / `.en` 成對標記，由 <html data-lang> 決定顯示哪一個（見 style.css）
 * - 程式產生的字串用 t(中文, 英文)
 * 預設依瀏覽器語言，選擇存在 localStorage。
 */
export type Lang = 'zh' | 'en';

const KEY = 'sp3d-lang';
function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch { /* 無法使用 localStorage 時依瀏覽器語言 */ }
  return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
}

let lang: Lang = detect();
const listeners: ((l: Lang) => void)[] = [];

export const getLang = () => lang;
/** 依目前語言回傳中文或英文 */
export const t = (zh: string, en: string) => (lang === 'en' ? en : zh);

export function onLang(f: (l: Lang) => void) { listeners.push(f); }

export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* 忽略 */ }
  applyLang();
  for (const f of listeners) f(l);
}

export function applyLang() {
  const root = document.documentElement;
  root.dataset.lang = lang;
  root.lang = lang === 'en' ? 'en' : 'zh-Hant';
  document.title = t('聖彼得大教堂 3D 觀覽', "St. Peter's Basilica 3D");
  document.querySelectorAll<HTMLElement>('[data-title-zh]').forEach((el) => { el.title = t(el.dataset.titleZh!, el.dataset.titleEn ?? el.dataset.titleZh!); });
  document.querySelectorAll<HTMLElement>('[data-aria-zh]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.ariaZh!, el.dataset.ariaEn ?? el.dataset.ariaZh!)));
  document.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach((b) => b.classList.toggle('on', b.dataset.lang === lang));
}
