# 聖彼得大教堂 3D 觀覽

以真實資料重建的聖彼得大教堂、聖彼得廣場與周邊街區，可在瀏覽器中 360° 觀覽，並切換季節、天氣與時間。

## 執行

Node.js 安裝於 `~/.local/node`（未加入系統 PATH），請先：

```bash
export PATH="$HOME/.local/node/bin:$PATH"
npm run dev        # 開發伺服器 http://127.0.0.1:5173
npm run build      # 輸出靜態網站到 dist/
```

## 資料

- `public/data/osm/*.json`：OpenStreetMap 資料（© OpenStreetMap contributors, ODbL），由 `scripts/fetch-osm*.mjs` 產生，執行時不連網。
- `public/textures/`：ambientCG CC0 材質（石灰華、sampietrini 石磚、羅馬瓦、灰泥）。
- 主要尺寸集中於 `src/data/dimensions.ts`，並註明來源。

## 結構

- `src/world/basilica/`：立面（Facade）、穹頂（Dome）、主體（Basilica，依 OSM 輪廓擠出）
- `src/world/piazza/`：貝尼尼柱廊、方尖碑、噴泉、鋪面與台階
- `src/world/surroundings/`：OSM 建築與店家招牌、道路、綠地、台伯河、樹木、路燈、外圍市區
- `src/env/Environment.ts`：太陽／月亮（SunCalc，羅馬經緯度）、天空、雲、霧、雨雪、季節
- `src/core/`：渲染管線（N8AO、Bloom、ACES）、材質系統（三平面貼圖、積雪、潮濕、夜間投光、程序化立面）
- `src/core/SceneManager.ts`：預留給後續的室內導覽場景

## 教堂內部（線上博物館）

在外部雙擊大教堂（或面板的「進入教堂內部」），經「光之門」轉場進入內部：

- `src/interior/Interior.ts`：依真實尺寸建模的柱廊、中殿、側廊（含兩座轉角禮拜堂穹頂）、交叉處（帆拱、鼓座、穹頂、銘文帶）、翼殿與後殿
- `src/interior/exhibitsData.ts`：31 件真實展品的解說、分區、導覽點與資料來源網址（依 stpetersbasilica.info 官方平面圖順序）
- `src/interior/Exhibits.ts`：展品與祭台的程式建模（`modelUrl` 預留換成 glTF 掃描）
- `src/interior/nav.ts`：導覽移動的避障路徑（不穿牆、不穿柱）
- `src/interior/Lighting.ts`：依外部太陽方向的光束、地面光斑、微塵、夜間燈光
- `src/interior/TourController.ts`、`InteriorUI.ts`：導覽點滑行、拖曳環視、精選／完整路線、分區目錄、解說卡（附資料來源）、小平面圖
- `src/interior/InteriorMode.ts`：進出轉場與場景切換；轉場效果在 `core/Renderer.ts` 的 `PortalEffect`
