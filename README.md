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
- `src/interior/ScanViewer.ts`：真實 3D 掃描檢視器（Draco 壓縮 glTF）。掃描檔放在 `public/models/`，檔案存在時解說卡才會出現按鈕。只收錄出處與授權（CC0 / CC BY / CC BY-SA）都查證過的掃描。

## 影像與雕像

- `public/art/`：祭壇畫、Algardi 浮雕、菲拉雷特銅門的實拍影像（維基共享資源，已裁切）；出處與授權在 `src/interior/credits.ts`，並顯示於解說卡與「關於」頁
- `tools/sculpt/build.py`：以 Blender 背景模式產生雕像簡化造型（姿勢骨架 + Skin modifier，長袍與斗篷以布料模擬垂落），包括柱廊／立面／創辦人像共用的 4 種通用聖人像（另有 `_lo` 輕量版），輸出 `public/models/sculpt/*.glb`（Draco）。重新產生：
  `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/sculpt/build.py -- public/models/sculpt`

## 雙語與分享

- `src/i18n.ts`：中英切換（面板頂端或內部右上角），靜態文字以 `.zh` / `.en` 成對標記，程式字串用 `t(中文, 英文)`；選擇存在 localStorage
- `src/interior/exhibitsEn.ts`：47 張解說卡的英文版（依相同出處翻譯）
- 展品網址：`#pieta` 這類 hash 會直接進入教堂並前往該展品；`#interior` 直接進入教堂。解說卡的「分享」按鈕在手機用系統分享、桌面複製連結

## 內部光影

- `src/interior/Reflections.ts`：拋光地面反射（進入時在中殿、交叉部、後殿各拍一次立方體環境，依位置切換；低畫質不啟用）
- 穹頂馬賽克依實拍參考重做分層；四個帆拱加上大圓章（只表現金框與藍金色塊）

## 效能與手機

- 教堂內部與宣傳片程式在需要時才動態載入；第三方套件拆成 `vendor` chunk
- 低畫質（手機預設）使用 `public/textures/*/512/` 的 512 px 貼圖
- 轉場特效只在轉場期間啟用；自動曝光改為非同步讀回；陰影只在相機移動超過一定距離才重繪
- 觸控：雙點教堂進入內部、內部單指環視與雙指縮放；手機版內部介面為抽屜式目錄與可收合解說卡
- `src/interior/Lighting.ts`：依外部太陽方向的光束、地面光斑、微塵、夜間燈光
- `src/interior/TourController.ts`、`InteriorUI.ts`：導覽點滑行、拖曳環視、精選／完整路線、分區目錄、解說卡（附資料來源）、小平面圖
- `src/interior/InteriorMode.ts`：進出轉場與場景切換；轉場效果在 `core/Renderer.ts` 的 `PortalEffect`
