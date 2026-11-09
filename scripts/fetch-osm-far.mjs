// 遠景：抓取外圍羅馬市區建築（僅輪廓與高度，壓縮為本地公寸座標）
import { writeFileSync } from 'node:fs';
const INNER = [41.8975, 12.4470, 41.9080, 12.4685];
const OUTER = [41.8860, 12.4280, 41.9200, 12.4920];
const LAT0 = 41.902223, LON0 = 12.457263;
const phi = LAT0 * Math.PI / 180;
const MLAT = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
const MLON = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
const q = `[out:json][timeout:240][maxsize:536870912];way["building"](${OUTER});out tags geom;`;
const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'st-peters-3d-viewer/0.1' }, body: 'data=' + encodeURIComponent(q) });
if (!res.ok) { console.error('HTTP', res.status); process.exit(1); }
const json = await res.json();
const out = [];
for (const e of json.elements) {
  if (!e.geometry || e.geometry.length < 4) continue;
  const t = e.tags || {};
  if (t.building === 'roof' || t.location === 'underground') continue;
  let la = 0, lo = 0;
  for (const g of e.geometry) { la += g.lat; lo += g.lon; }
  la /= e.geometry.length; lo /= e.geometry.length;
  if (la > INNER[0] && la < INNER[2] && lo > INNER[1] && lo < INNER[3]) continue;
  const p = [];
  for (const g of e.geometry) p.push(Math.round((g.lon - LON0) * MLON * 10), Math.round(-(g.lat - LAT0) * MLAT * 10));
  const h = parseFloat((t.height || '').replace(',', '.'));
  const l = parseFloat(t['building:levels'] || '');
  out.push([Number.isFinite(h) ? Math.round(h * 10) / 10 : 0, Number.isFinite(l) ? l : 0, p, t.building === 'church' || t.building === 'cathedral' || t.building === 'basilica' ? 1 : 0]);
}
writeFileSync(new URL('../public/data/osm/far.json', import.meta.url), JSON.stringify({ meta: { source: 'OpenStreetMap contributors, ODbL 1.0', bbox: OUTER, units: 'decimeters, local frame' }, b: out }));
console.log('far buildings', out.length);
