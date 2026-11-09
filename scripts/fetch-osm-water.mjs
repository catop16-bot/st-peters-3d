// 抓取台伯河水域多邊形
import { writeFileSync } from 'node:fs';
const BBOX = [41.8975, 12.4470, 41.9080, 12.4685];
const q = `[out:json][timeout:60];(way["natural"="water"](${BBOX});relation["natural"="water"](${BBOX});way["waterway"="riverbank"](${BBOX}););out body geom;`;
const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'st-peters-3d-viewer/0.1' }, body: 'data=' + encodeURIComponent(q) });
const json = await res.json();
const water = [];
for (const e of json.elements) {
  if (e.type === 'way' && e.geometry) water.push({ id: e.id, name: e.tags?.name, rings: [{ role: 'outer', pts: e.geometry.map(g => [g.lat, g.lon]) }] });
  if (e.type === 'relation') water.push({ id: e.id, name: e.tags?.name, rings: (e.members || []).filter(m => m.geometry).map(m => ({ role: m.role, pts: m.geometry.map(g => [g.lat, g.lon]) })) });
}
writeFileSync(new URL('../public/data/osm/water.json', import.meta.url), JSON.stringify({ meta: { source: 'OpenStreetMap contributors, ODbL 1.0' }, water }));
console.log(water.map(w => [w.id, w.name, w.rings.length, w.rings.map(r => r.pts.length).join('/')]));
