// 抓取廣場內的地標物件（噴泉、方尖碑、雕像、廣場面）
import { writeFileSync } from 'node:fs';
const BBOX = [41.9000, 12.4520, 41.9045, 12.4590];
const q = `[out:json][timeout:60];
(
  nwr["amenity"="fountain"](${BBOX});
  nwr["man_made"~"obelisk|flagpole|lamp|tower"](${BBOX});
  nwr["historic"](${BBOX});
  nwr["artwork_type"](${BBOX});
  nwr["tourism"="artwork"](${BBOX});
  nwr["place"="square"](${BBOX});
  nwr["highway"="pedestrian"]["area"="yes"](${BBOX});
  way["barrier"](${BBOX});
  nwr["natural"="tree"](${BBOX});
);
out body geom;`;
const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'st-peters-3d-viewer/0.1' }, body: 'data=' + encodeURIComponent(q) });
const json = await res.json();
const out = json.elements.map(e => ({ type: e.type, id: e.id, tags: e.tags, lat: e.lat, lon: e.lon, geometry: e.geometry?.map(g => [g.lat, g.lon]), members: e.members?.filter(m => m.geometry).map(m => ({ role: m.role, pts: m.geometry.map(g => [g.lat, g.lon]) })) }));
writeFileSync(new URL('../public/data/osm/landmarks.json', import.meta.url), JSON.stringify({ meta: { source: 'OpenStreetMap contributors, ODbL 1.0', bbox: BBOX }, elements: out }));
console.log(out.length);
