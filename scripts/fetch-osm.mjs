// 一次性從 OpenStreetMap Overpass API 抓取聖彼得廣場周邊的真實資料
// 用法：node scripts/fetch-osm.mjs
import { writeFileSync } from 'node:fs';

// 範圍：梵蒂岡、Borgo 區、協和大道至聖天使堡
const BBOX = [41.8975, 12.4470, 41.9080, 12.4685]; // S,W,N,E
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const query = `
[out:json][timeout:120];
(
  way["building"](${BBOX});
  relation["building"](${BBOX});
  way["building:part"](${BBOX});
  way["highway"](${BBOX});
  way["leisure"~"park|garden"](${BBOX});
  way["landuse"~"grass"](${BBOX});
  node["natural"="tree"](${BBOX});
  node["shop"]["name"](${BBOX});
  node["amenity"~"restaurant|cafe|bar|pharmacy|bank|fast_food|ice_cream|pub|post_office"]["name"](${BBOX});
  node["tourism"~"hotel|guest_house|museum|hostel|information"]["name"](${BBOX});
  node["highway"="street_lamp"](${BBOX});
);
out body geom;
`;

async function run() {
  for (const url of ENDPOINTS) {
    try {
      console.log('Querying', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'st-peters-3d-viewer/0.1' },
        body: 'data=' + encodeURIComponent(query),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      split(json);
      return;
    } catch (e) {
      console.warn('failed:', e.message);
    }
  }
  process.exit(1);
}

function split(json) {
  const buildings = [], roads = [], greens = [], trees = [], pois = [], lamps = [];
  for (const el of json.elements) {
    const t = el.tags || {};
    if (el.type === 'node') {
      if (t.natural === 'tree') trees.push([el.lat, el.lon, t.genus || t.species || t['species:it'] || '', t.leaf_type || '', t.leaf_cycle || '', +(t.height || 0)]);
      else if (t.highway === 'street_lamp') lamps.push([el.lat, el.lon, t.support || t.lamp_mount || '', t['lamp_mount'] || '']);
      else if (t.name) pois.push({ lat: el.lat, lon: el.lon, name: t.name, kind: t.shop ? 'shop:' + t.shop : t.amenity ? 'amenity:' + t.amenity : 'tourism:' + t.tourism });
      continue;
    }
    if (t.building || t['building:part']) {
      const rings = [];
      if (el.type === 'way' && el.geometry) rings.push({ role: 'outer', pts: el.geometry.map(g => [g.lat, g.lon]) });
      if (el.type === 'relation') for (const m of el.members || []) if (m.geometry) rings.push({ role: m.role || 'outer', pts: m.geometry.map(g => [g.lat, g.lon]) });
      buildings.push({ id: el.type[0] + el.id, tags: pick(t, ['name', 'building', 'building:part', 'height', 'building:levels', 'roof:shape', 'roof:height', 'min_height', 'building:min_level', 'building:colour', 'roof:colour', 'building:material', 'roof:material', 'amenity', 'tourism', 'historic', 'religion', 'location', 'layer', 'man_made']), rings });
    } else if (t.highway && el.geometry) {
      roads.push({ id: el.id, highway: t.highway, name: t.name, lanes: t.lanes, width: t.width, area: t.area, tunnel: t.tunnel, bridge: t.bridge, layer: t.layer, surface: t.surface, covered: t.covered, pts: el.geometry.map(g => [g.lat, g.lon]) });
    } else if ((t.leisure || t.landuse) && el.geometry) {
      greens.push({ id: el.id, kind: t.leisure || t.landuse, pts: el.geometry.map(g => [g.lat, g.lon]) });
    }
  }
  const dir = new URL('../public/data/osm/', import.meta.url);
  const meta = { source: 'OpenStreetMap contributors, ODbL 1.0', fetched: new Date().toISOString(), bbox: BBOX };
  writeFileSync(new URL('buildings.json', dir), JSON.stringify({ meta, buildings }));
  writeFileSync(new URL('roads.json', dir), JSON.stringify({ meta, roads, greens }));
  writeFileSync(new URL('pois.json', dir), JSON.stringify({ meta, pois, trees, lamps }));
  console.log({ buildings: buildings.length, roads: roads.length, greens: greens.length, trees: trees.length, pois: pois.length, lamps: lamps.length });
}

function pick(o, keys) { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; }
run();
